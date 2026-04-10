import './weapp-adapter.js';
// 微信小游戏环境下，PIXI 会检测并使用适配器提供的 window/canvas
import PIXI from './pixi.js'; // 假设 pixi 已经被复制到根目录或通过 bundle 引入

// 引入打包后的游戏逻辑
import './game.bundle.js';
