import * as PIXI from 'pixi.js';
import { AssetManager } from './AssetManager';
import { SceneManager, Layers } from './SceneManager';
import { GameController } from './GameController';
import { UIManager } from './UIManager';

/**
 * 游戏入口：深海余烬 (微信小游戏版)
 */
const initGame = async () => {
    // 1. 获取微信 Canvas
    const canvas = (window as any).canvas || document.createElement('canvas');
    if (!(window as any).canvas) {
        document.body.appendChild(canvas);
    }

    const app = new PIXI.Application({
        view: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x00050a,
        antialias: true,
    });

    console.log('Pixi Initialized');

    // 2. 初始化所有管理器
    await AssetManager.init(app.renderer as PIXI.Renderer);
    SceneManager.init(app);
    UIManager.init(app);

    // 3. 启动核心控制器
    const bg = new PIXI.TilingSprite(AssetManager.textures['bg_ocean'], window.innerWidth, window.innerHeight);
    SceneManager.getLayer(Layers.Background).addChild(bg);
    SceneManager.setBackground(bg);
    
    new GameController(app);

    console.log('Game Started');
};

initGame();
