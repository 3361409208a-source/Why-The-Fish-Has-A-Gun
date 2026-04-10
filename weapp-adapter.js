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

// 预创建全局 Canvas 并初始化尺寸 (防止黑屏)
const mainCanvas = _wx.createCanvas();
mainCanvas.width = screenWidth * devicePixelRatio;
mainCanvas.height = screenHeight * devicePixelRatio;
_window.canvas = mainCanvas;

// 修复：PIXI v7 auto-detect 第一步检查 globalThis.WebGLRenderingContext
// 微信小游戏只支持 WebGL1，注入 WebGLRenderingContext 让 PIXI 探测通过
// 注意：不注入 WebGL2RenderingContext，否则 PIXI 会尝试 getInternalformatParameter 等 WebGL2 API 并崩溃
try {
    // 拦截 getContext('webgl2') 强制返回 null，确保 PIXI 只走 WebGL1 路径
    const _origGetContext = mainCanvas.getContext.bind(mainCanvas);
    mainCanvas.getContext = (type, opts) => (type === 'webgl2' ? null : _origGetContext(type, opts));

    const _glCtx = mainCanvas.getContext('webgl') || mainCanvas.getContext('experimental-webgl');
    if (_glCtx && typeof WebGLRenderingContext === 'undefined') {
        _window.WebGLRenderingContext = _glCtx.constructor;
    }
} catch (e) {}

_window.innerWidth = screenWidth;
_window.innerHeight = screenHeight;
_window.devicePixelRatio = devicePixelRatio;
_window.wx = _wx;

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
            c.tagName = 'CANVAS';
            c.nodeName = 'CANVAS';
            c.addEventListener = c.addEventListener || (() => {});
            c.removeEventListener = c.removeEventListener || (() => {});
            c.getBoundingClientRect = () => ({ left: 0, top: 0, width: screenWidth, height: screenHeight });
            // 拦截 webgl2；若 WebGL1 失败（PC模拟器第二个canvas不支持）则 proxy 到 mainCanvas
            const _cOrig = c.getContext.bind(c);
            c.getContext = (t, o) => {
                if (t === 'webgl2') return null;
                const r = _cOrig(t, o);
                if (!r && (t === 'webgl' || t === 'experimental-webgl')) {
                    return mainCanvas.getContext(t, o);
                }
                return r;
            };
            return c;
        }
        if (type === 'img' || type === 'image') {
            const img = _wx.createImage();
            img.tagName = 'IMG';
            img.nodeName = 'IMG';
            return img;
        }
        return { style: {}, addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {}, tagName: type.toUpperCase() };
    },
    getElementById: (id) => null,
    getElementsByTagName: (name) => [],
    querySelector: (query) => null,
    addEventListener: () => {},
    removeEventListener: () => {}
};

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
    } catch (e) {}
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
