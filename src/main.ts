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
    // 让 canvas 背景透明，这样视频背景才能透过 canvas 显示
    if (canvas.style) canvas.style.background = 'transparent';
    
    const app = new PIXI.Application({
        view: canvas,
        width: window.innerWidth,
        height: window.innerHeight,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        backgroundAlpha: 0, // 关键：canvas 本身透明，背景由 body 或 video 提供
        antialias: false,
    });

    // body 默认深海色（普通地图的底色）
    document.body.style.background = '#00050a';

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
        syncTalents();
        
        // 清理旧的视频背景
        const oldVideo = document.getElementById('bg-video');
        if (oldVideo) oldVideo.remove();

        SceneManager.getLayer(Layers.Background).removeChildren();

        if (config.tex === 'map_lunatic') {
            // 视频背景：z-index 正确分层
            // video(z:0) → canvas(z:1) → UI
            document.body.style.background = 'transparent'; // body 透明，不遮挡视频
            
            const video = document.createElement('video');
            video.id = 'bg-video';
            video.src = 'assets/map_lunatic.mp4';
            video.autoplay = true;
            video.loop = true;
            video.muted = true;
            video.playsInline = true;
            Object.assign(video.style, {
                position: 'fixed',
                top: '0', left: '0',
                width: '100%', height: '100%',
                objectFit: 'cover',
                zIndex: '0',   // 在 body 上方，在 canvas 下方
            });
            document.body.insertBefore(video, document.body.firstChild);

            // canvas 需要在视频上方
            if (canvas.style) {
                canvas.style.position = 'fixed';
                canvas.style.zIndex = '1';
            }
        } else {
            // 恢复普通地图：body 深海色，canvas 恢复默认
            document.body.style.background = '#00050a';
            if (canvas.style) {
                canvas.style.position = '';
                canvas.style.zIndex = '';
            }
            const bgTex = AssetManager.textures[config.tex] || AssetManager.textures['bg_ocean'];
            const bg = new PIXI.TilingSprite(bgTex, window.innerWidth, window.innerHeight);
            SceneManager.getLayer(Layers.Background).addChild(bg);
            SceneManager.setBackground(bg);
        }
        
        new GameController(app, config);
    });

    console.log('Game Started with Global Upgrades');
};

initGame();
