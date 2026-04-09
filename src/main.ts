import * as PIXI from 'pixi.js';
import '@pixi/unsafe-eval';

// 强制跳过渲染检测
PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL_LEGACY;
PIXI.BaseTexture.defaultOptions.alphaMode = PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA;

import { AssetManager } from './AssetManager';
import { SceneManager, Layers } from './SceneManager';
import { GameController } from './GameController';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';

/**
 * 游戏入口：深海余烬 (主页升级版)
 */
const initGame = async () => {
    // 1. 初始化存档
    SaveManager.load();

    const canvas = (window as any).canvas || document.createElement('canvas');
    if (!(window as any).canvas) {
        document.body.appendChild(canvas);
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';
    }
    
    if (canvas.style) canvas.style.touchAction = 'none';
    
    const app = new PIXI.Application({
        view: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundColor: 0x00050a,
        antialias: false,
    });

    // 2. 将存档中的天赋加成注入到全局 Window，供战斗系统读取
    const syncTalents = () => {
        (window as any).TalentDmgMult = SaveManager.getTalentMult('damage');
        (window as any).TalentFireRateMult = SaveManager.getTalentMult('fireRate');
        (window as any).TalentGoldMult = SaveManager.getTalentMult('goldBonus');
        (window as any).TalentCritChance = SaveManager.getTalentMult('critChance');
        (window as any).TalentSpeedMult = 1.0 + SaveManager.state.talents.fireRate * 0.02; // 子弹飞行速度
    };
    syncTalents();

    // 3. 初始化所有管理器
    await AssetManager.init(app.renderer as PIXI.Renderer);
    SceneManager.init(app);
    UIManager.init(app);

    // 4. 进入选图与升级主页
    UIManager.showMapSelection((config) => {
        syncTalents(); // 战斗前最后一次同步
        
        const bgTex = AssetManager.textures[config.tex] || AssetManager.textures['bg_ocean'];
        const bg = new PIXI.TilingSprite(bgTex, window.innerWidth, window.innerHeight);
        SceneManager.getLayer(Layers.Background).removeChildren();
        SceneManager.getLayer(Layers.Background).addChild(bg);
        SceneManager.setBackground(bg);
        
        new GameController(app, config);
    });

    console.log('Game Started with Global Upgrades');
};

initGame();
