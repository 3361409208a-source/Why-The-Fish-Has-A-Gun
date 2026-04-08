// 极简版微信小游戏适配器
const canvas = wx.createCanvas();
const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync();

window.canvas = canvas;
window.innerWidth = windowWidth;
window.innerHeight = windowHeight;
window.devicePixelRatio = pixelRatio;
window.requestAnimationFrame = canvas.requestAnimationFrame.bind(canvas);
window.cancelAnimationFrame = canvas.cancelAnimationFrame.bind(canvas);

document.createElement = (type) => {
  if (type === 'canvas') return canvas;
  if (type === 'img') return wx.createImage();
  return null;
};

// 导出供全局使用
export default window;
