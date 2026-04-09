import * as PIXI from 'pixi.js';
import '@pixi/unsafe-eval';

// 强制跳过多重纹理批处理检测，完美解决 WebGL checkMaxIfs 报错并恢复正常着色器逻辑
PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL_LEGACY;

// 解决图像与粒子泛白边问题
PIXI.BaseTexture.defaultOptions.alphaMode = PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA;

import { AssetManager } from './AssetManager';
import { SceneManager, Layers } from './SceneManager';
import { GameController } from './GameController';
import { UIManager } from './UIManager';

/**
 * 游戏入口：深海余烬 (微信小游戏版)
 */
const initGame = async () => {
    // 1. 获取微信 Canvas 并锁死页面滑动
    const canvas = (window as any).canvas || document.createElement('canvas');
    if (!(window as any).canvas) {
        document.body.appendChild(canvas);
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';
    }
    
    // 强制切断所有平台底层浏览器的默认滑动与缩放事件
    if (canvas.style) {
        canvas.style.touchAction = 'none';
    }
    
    // 全局防滚动阻断 (解决 "滑动屏幕跟着动" 的核心)
    if (typeof window.addEventListener === 'function') {
        window.addEventListener('touchmove', (e: any) => {
            if (e.cancelable) e.preventDefault();
        }, { passive: false });
    }

    const app = new PIXI.Application({
        view: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x00050a,
        antialias: false, // 必须关闭抗锯齿，否则微信下透明贴图会产生白边过滤
    });

    console.log('Pixi Initialized');

    // 2. 初始化所有管理器
    await AssetManager.init(app.renderer as PIXI.Renderer);
    SceneManager.init(app);
    UIManager.init(app);

    // 3. 进入选图界面，选完后再启动控制器
    UIManager.showMapSelection((config) => {
        // 设置所选地图背景
        const bgTex = AssetManager.textures[config.tex] || AssetManager.textures['bg_ocean'];
        const bg = new PIXI.TilingSprite(bgTex, window.innerWidth, window.innerHeight);
        SceneManager.getLayer(Layers.Background).removeChildren();
        SceneManager.getLayer(Layers.Background).addChild(bg);
        SceneManager.setBackground(bg);
        
        // 传入选图配置启动战斗系统
        new GameController(app, config);
    });

    console.log('Game Started');
};

initGame();
