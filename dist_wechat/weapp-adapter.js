// 极简版微信小游戏适配器
const canvas = wx.createCanvas();
const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

window.canvas = canvas;
window.innerWidth = windowWidth;
window.innerHeight = windowHeight;
window.devicePixelRatio = pixelRatio;
window.requestAnimationFrame = (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : canvas.requestAnimationFrame).bind(window);
window.cancelAnimationFrame = (typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : canvas.cancelAnimationFrame).bind(window);

const origCreateElement = typeof document !== 'undefined' && document.createElement ? document.createElement.bind(document) : null;

// ==============================
// 补齐 Pixi 引擎重度依赖的 DOM 类型
// 修复 `Unrecognized source type to auto-detect Resource` 报错
// ==============================
try {
  const _img = wx.createImage();
  window.Image = _img.constructor;
  window.HTMLImageElement = _img.constructor;
  
  const _can = wx.createCanvas();
  window.Canvas = _can.constructor;
  window.HTMLCanvasElement = _can.constructor;
  
  window.HTMLVideoElement = function(){};
} catch (e) {}

const documentMock = {
  createElement: (type) => {
    if (type === 'canvas') {
      const c = wx.createCanvas();
      c.style = c.style || {};
      c.addEventListener = c.addEventListener || (() => {});
      c.removeEventListener = c.removeEventListener || (() => {});
      c.getBoundingClientRect = c.getBoundingClientRect || (() => ({
        left: 0, top: 0, width: windowWidth, height: windowHeight, right: windowWidth, bottom: windowHeight
      }));
      return c;
    }
    if (type === 'img') return wx.createImage();
    
    // 如果原本的 document 有 createElement，优先用它，避免生成假对象被真实的 appendChild 拒绝
    if (origCreateElement) {
      return origCreateElement(type);
    }
    return { style: {}, addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {}, removeChild: () => {} };
  },
  body: { style: {}, appendChild: () => {}, removeChild: () => {} },
  documentElement: { style: {}, scrollLeft: 0, scrollTop: 0 },
  getElementById: (id) => (id === 'canvas' ? canvas : null),
  getElementsByTagName: (name) => (name === 'canvas' ? [canvas] : []),
  addEventListener: () => {},
  removeEventListener: () => {}
};

try {
  if (window.document) { Object.assign(window.document, documentMock); }
  else { Object.defineProperty(window, 'document', { value: documentMock, enumerable: true, configurable: true }); }
} catch (e) {}

if (typeof GameGlobal !== 'undefined') {
  try {
    if (GameGlobal.document) { Object.assign(GameGlobal.document, documentMock); }
    else { Object.defineProperty(GameGlobal, 'document', { value: documentMock, enumerable: true, configurable: true }); }
  } catch (e) {}
}

// 导出供全局使用
export default window;

