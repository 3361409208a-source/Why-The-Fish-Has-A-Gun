// ==============================
// 微信小游戏环境全量适配器 (针对 PIXI.js 7.x 深度优化版)
// ==============================

const _GameGlobal = (typeof GameGlobal !== 'undefined') ? GameGlobal : (typeof global !== 'undefined' ? global : {});
const _wx = _GameGlobal.wx || (typeof wx !== 'undefined' ? wx : {});

// 1. 核心定时器补丁
const timers = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];
timers.forEach(name => {
    const fn = _GameGlobal[name] || (_wx[name] ? _wx[name].bind(_wx) : null);
    if (fn) {
        if (typeof window !== 'undefined') window[name] = fn;
        if (typeof global !== 'undefined') global[name] = fn;
    }
});

// 2. 环境常量与 Window 初始化
// 优先使用 game.js 异步预取的系统信息，避免同步调用阻塞 Bridge
const sysInfo = _GameGlobal.__wxSystemInfo || _wx.getSystemInfoSync();
const { screenWidth, screenHeight, devicePixelRatio } = sysInfo;

if (typeof window === 'undefined') { _GameGlobal.window = _GameGlobal; }
const _window = _GameGlobal.window;

// PIXI v7 要求 native 事件为 TouchEvent / MouseEvent 实例，且 wx.onTouch* 全局只能注册一个回调
function createListenerHub() {
    const listeners = Object.create(null);
    return {
        add(type, fn) {
            if (typeof fn !== 'function') return;
            if (!listeners[type]) listeners[type] = new Set();
            listeners[type].add(fn);
        },
        remove(type, fn) {
            listeners[type]?.delete(fn);
        },
        dispatch(type, evt) {
            const set = listeners[type];
            if (!set || set.size === 0) return;
            set.forEach((fn) => { try { fn(evt); } catch (e) {} });
        },
    };
}

function patchEventTarget(target, hub) {
    target.addEventListener = (type, fn) => hub.add(type, fn);
    target.removeEventListener = (type, fn) => hub.remove(type, fn);
    target._dispatchEvent = (type, evt) => hub.dispatch(type, evt);
    return target;
}

// TouchEvent / MouseEvent polyfill（PIXI normalizeToPointerData 依赖 instanceof）
class TouchPolyfill {
    constructor(t, target) {
        const x = t.clientX ?? t.x ?? 0;
        const y = t.clientY ?? t.y ?? 0;
        this.identifier = t.identifier ?? 0;
        this.clientX = x;
        this.clientY = y;
        this.pageX = t.pageX ?? x;
        this.pageY = t.pageY ?? y;
        this.target = target;
        this.screenX = x;
        this.screenY = y;
    }
}
class TouchEventPolyfill {
    constructor(type, { touches, changedTouches, target }) {
        this.type = type;
        this.target = target;
        this.touches = touches;
        this.changedTouches = changedTouches;
        this.cancelable = true;
        this.bubbles = true;
        this.cancelBubble = false;
    }
    preventDefault() {}
    stopPropagation() {}
}
// 真机常有原生 TouchEvent，但用 TouchEventPolyfill 创建的事件 instanceof 会失败 → 必须强制覆盖
globalThis.Touch = TouchPolyfill;
globalThis.TouchEvent = TouchEventPolyfill;
if (typeof globalThis.MouseEvent === 'undefined') {
    globalThis.MouseEvent = class MouseEventPolyfill {
        constructor(type, init = {}) {
            this.type = type;
            Object.assign(this, init);
            this.clientX = init.clientX ?? 0;
            this.clientY = init.clientY ?? 0;
            this.button = init.button ?? 0;
            this.buttons = init.buttons ?? (type === 'mouseup' ? 0 : 1);
            this.pointerType = init.pointerType ?? 'mouse';
            this.pointerId = init.pointerId ?? 1;
            this.isPrimary = true;
            this.preventDefault = () => {};
            this.stopPropagation = () => {};
        }
    };
}
try {
    if (!('ontouchstart' in globalThis)) {
        Object.defineProperty(globalThis, 'ontouchstart', { value: null, configurable: true, writable: true });
    }
} catch (e) {}

const canvasHub = createListenerHub();
const windowHub = createListenerHub();
const documentHub = createListenerHub();

function wxTouchToNative(t) {
    const x = t.x ?? t.clientX ?? 0;
    const y = t.y ?? t.clientY ?? 0;
    return new TouchPolyfill({ ...t, x, y, clientX: x, clientY: y }, mainCanvas);
}

function buildTouchEvent(type, res) {
    const touches = (res.touches || []).map(wxTouchToNative);
    const changed = (res.changedTouches || res.touches || []).map(wxTouchToNative);
    return new globalThis.TouchEvent(type, {
        target: mainCanvas,
        touches: touches.length ? touches : changed,
        changedTouches: changed.length ? changed : touches,
    });
}

/** 供 InputSystem 等模块订阅，避免覆盖 wx.onTouchStart */
const wxTouchBus = { start: [], move: [], end: [], cancel: [] };
_GameGlobal.__wxTouchBus = wxTouchBus;

// 预创建全局 Canvas 并初始化尺寸 (防止黑屏)
const mainCanvas = patchEventTarget(_wx.createCanvas(), canvasHub);
mainCanvas.width = screenWidth * devicePixelRatio;
mainCanvas.height = screenHeight * devicePixelRatio;
mainCanvas.style = mainCanvas.style || {};
try { mainCanvas.tagName = 'CANVAS'; } catch (e) {}
try { mainCanvas.nodeName = 'CANVAS'; } catch (e) {}
mainCanvas.getBoundingClientRect = mainCanvas.getBoundingClientRect || (() => ({
    left: 0, top: 0, width: screenWidth, height: screenHeight,
    right: screenWidth, bottom: screenHeight, x: 0, y: 0,
}));
_window.canvas = mainCanvas;

// 修复：PIXI v7 auto-detect 第一步检查 globalThis.WebGLRenderingContext
// 微信小游戏只支持 WebGL1，注入 WebGLRenderingContext 让 PIXI 探测通过
// 注意：不注入 WebGL2RenderingContext，否则 PIXI 会尝试 getInternalformatParameter 等 WebGL2 API 并崩溃
try {
    // 拦截 getContext('webgl2') 强制返回 null，确保 PIXI 只走 WebGL1 路径
    const _origGetContext = mainCanvas.getContext.bind(mainCanvas);
    mainCanvas.getContext = (type, opts) => (type === 'webgl2' ? null : _origGetContext(type, opts));

    const _glCtx = mainCanvas.getContext('webgl', { stencil: true, antialias: true }) || mainCanvas.getContext('experimental-webgl', { stencil: true, antialias: true });
    if (_glCtx && typeof WebGLRenderingContext === 'undefined') {
        _window.WebGLRenderingContext = _glCtx.constructor;
    }
} catch (e) {}

_window.innerWidth = screenWidth;
_window.innerHeight = screenHeight;
_window.devicePixelRatio = devicePixelRatio;
_window.wx = _wx;

// GameGlobal 作为 window；document 也需真实监听器（PIXI pointermove 挂在 document 上）
patchEventTarget(_window, windowHub);

// PIXI 走 WxPixiTouch；此处仅转发 window（EndlessPage 滚轮/触摸）
const forwardTouch = (type, evt) => {
    windowHub.dispatch(type, evt);
};

const bindWxEvents = () => {
    if (typeof _wx.onTouchStart !== 'function') return;

    _wx.onTouchStart((res) => {
        const evt = buildTouchEvent('touchstart', res);
        forwardTouch('touchstart', evt);
        wxTouchBus.start.forEach((fn) => { try { fn(res); } catch (e) {} });
    });
    _wx.onTouchMove((res) => {
        const evt = buildTouchEvent('touchmove', res);
        forwardTouch('touchmove', evt);
        wxTouchBus.move.forEach((fn) => { try { fn(res); } catch (e) {} });
    });
    const onEnd = (res) => {
        const evt = buildTouchEvent('touchend', res);
        forwardTouch('touchend', evt);
        wxTouchBus.end.forEach((fn) => { try { fn(res); } catch (e) {} });
    };
    _wx.onTouchEnd(onEnd);
    _wx.onTouchCancel((res) => {
        const evt = buildTouchEvent('touchcancel', res);
        forwardTouch('touchcancel', evt);
        wxTouchBus.cancel.forEach((fn) => { try { fn(res); } catch (e) {} });
    });

    if (typeof _wx.onWindowResize === 'function') {
        _wx.onWindowResize(() => windowHub.dispatch('resize', new globalThis.MouseEvent('resize', {})));
    }
};
bindWxEvents();

// 6. Performance polyfill (PIXI.js 依赖 performance.now())
if (typeof _window.performance === 'undefined') {
    const startTime = Date.now();
    _window.performance = {
        now: () => Date.now() - startTime,
        mark: () => {},
        measure: () => {},
        getEntries: () => [],
        getEntriesByName: () => [],
        getEntriesByType: () => [],
        clearMarks: () => {},
        clearMeasures: () => {},
        clearResourceTimings: () => {},
        timeOrigin: startTime
    };
}

// 3. 原生构造函数模拟 (关键：PIXI v7 依赖这些来识别资源类型)
try {
    const dummyImage = _wx.createImage();
    _window.HTMLImageElement = dummyImage.constructor;
    _window.Image = dummyImage.constructor;
    
    const dummyCanvas = _wx.createCanvas();
    _window.HTMLCanvasElement = dummyCanvas.constructor;
    _window.Canvas = dummyCanvas.constructor;
    
    _window.HTMLVideoElement = function(){};
    _window.navigator = { userAgent: 'WeChat MiniGame', platform: 'Win64', appVersion: '1.0.0' };
} catch (e) {}

// 4. Document 模拟
const documentMock = {
    readyState: 'complete',
    visibilityState: 'visible',
    documentElement: { style: {} },
    body: { style: {} },
    createElement: (type) => {
        if (type === 'canvas') {
            const c = _wx.createCanvas();
            c.width = screenWidth * devicePixelRatio;
            c.height = screenHeight * devicePixelRatio;
            c.style = c.style || {};
            try { c.tagName = 'CANVAS'; } catch(e) {}
            try { c.nodeName = 'CANVAS'; } catch(e) {}
            patchEventTarget(c, createListenerHub());
            c.getBoundingClientRect = () => ({ left: 0, top: 0, width: screenWidth, height: screenHeight });
            // 拦截 webgl2；若 WebGL1 失败（PC模拟器第二个canvas不支持）则 proxy 到 mainCanvas
            const _cOrig = c.getContext.bind(c);
            c.getContext = (t, o) => {
                if (t === 'webgl2') return null;
                const r = _cOrig(t, o);
                if (!r && (t === 'webgl' || t === 'experimental-webgl')) {
                    return mainCanvas.getContext(t); // 忽略 options，返回已有 context 防止因 options 不同返回 null
                }
                return r;
            };
            return c;
        }
        if (type === 'img' || type === 'image') {
            const img = _wx.createImage();
            try { img.tagName = 'IMG'; } catch(e) {}
            try { img.nodeName = 'IMG'; } catch(e) {}
            return img;
        }
        return { style: {}, addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {}, tagName: type.toUpperCase() };
    },
    getElementById: (id) => null,
    getElementsByTagName: (name) => [],
    querySelector: (query) => null,
    addEventListener: (type, fn) => documentHub.add(type, fn),
    removeEventListener: (type, fn) => documentHub.remove(type, fn),
};

// 真机 PIXI mapPositionToPoint 会检查 parentElement；为空时坐标映射易错
try { mainCanvas.parentElement = documentMock; } catch (e) {}

try {
    Object.defineProperty(_window, 'document', {
        value: documentMock,
        enumerable: true,
        configurable: true,
        writable: true
    });
} catch (e) {
    try {
        Object.assign(_window.document, documentMock);
    } catch (e2) {}
}

if (typeof GameGlobal !== 'undefined') {
    try {
        Object.defineProperty(GameGlobal, 'document', {
            value: documentMock,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } catch (e) {
        try { GameGlobal.document = documentMock; } catch (e2) {}
    }
}

// 5. Storage 补丁
if (!_window.localStorage) {
    _window.localStorage = {
        getItem: (k) => _wx.getStorageSync(k),
        setItem: (k, v) => _wx.setStorageSync(k, v),
        removeItem: (k) => _wx.removeStorageSync(k),
        clear: () => _wx.clearStorageSync()
    };
}

export default _window;
