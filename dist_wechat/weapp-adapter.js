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
