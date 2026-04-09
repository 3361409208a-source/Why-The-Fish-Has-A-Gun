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
 * 环境补丁：适配微信小游戏等非标准浏览器环境
 */
if (typeof (window as any).wx !== 'undefined') {
    const _window = window as any;
    // 0. 基础环境补丁
    if (!_window.requestAnimationFrame) {
        _window.requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 16);
    }

    // 1. Document 补丁 (避免直接赋值 window.document，因为它可能是只读的)
    try {
        const doc = _window.document || {};
        if (typeof doc.getElementById !== 'function') doc.getElementById = () => null;
        if (typeof doc.createElement !== 'function') doc.createElement = (type: string) => {
            if (type === 'canvas') return _window.wx.createCanvas();
            if (type === 'img' || type === 'image') {
                const img = _window.wx.createImage();
                (img as any).tagName = 'IMG'; // 关键：PIXI 依赖 tagName 识别资源类型
                return img;
            }
            return { style: {}, appendChild: () => {}, insertBefore: () => {} };
        };
        if (!doc.body) doc.body = { style: {}, appendChild: () => {}, insertBefore: () => {} };
        if (!doc.documentElement) doc.documentElement = { style: {} };
    } catch (e) {
        console.warn('Patching document failed', e);
    }

    // 2. Storage 补丁
    try {
        if (typeof _window.localStorage === 'undefined') {
            _window.localStorage = {
                getItem: (key: string) => _window.wx.getStorageSync(key),
                setItem: (key: string, val: string) => _window.wx.setStorageSync(key, val),
                removeItem: (key: string) => _window.wx.removeStorageSync(key),
                clear: () => _window.wx.clearStorageSync()
            };
        }
    } catch (e) {
        console.warn('Patching localStorage failed', e);
    }

    // 3. 屏幕尺寸补丁
    try {
        if (typeof _window.innerWidth === 'undefined') {
            const info = _window.wx.getSystemInfoSync();
            _window.innerWidth = info.screenWidth;
            _window.innerHeight = info.screenHeight;
        }
    } catch (e) {
        console.warn('Patching screen info failed', e);
    }
}

/**
 * 游戏入口：深海余烬 (主页升级版)
 */
const initGame = async () => {
    // 1. 初始化存档
    SaveManager.load();

    const isWX = typeof (window as any).wx !== 'undefined';
    const canvas = (window as any).canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);
    
    if (canvas && ! (window as any).canvas && typeof document !== 'undefined' && document.body) {
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
    if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.background = '#00050a';
    }

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

    let activeController: GameController | null = null;

    // 初始主页背景
    const setMenuBg = () => {
        SceneManager.getLayer(Layers.Background).removeChildren();
        const bgTex = AssetManager.textures['bg_ocean'] || PIXI.Texture.WHITE;
        const bg = new PIXI.Sprite(bgTex);
        SceneManager.getLayer(Layers.Background).addChild(bg);
        SceneManager.setBackground(bg, false);
    };

    // 选图后的核心启动逻辑
    const onMapSelected = (config: any) => {
        // 先销毁旧控制器和清理旧环境
        if (activeController) {
            activeController.destroy();
            activeController = null;
        }

        syncTalents();
        
        // 清理旧的视频背景
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            const oldVideo = document.getElementById('bg-video');
            if (oldVideo) oldVideo.remove();
        }
        // 兼容移除微信视频
        if (isWX && (window as any)._wxVideo) {
            (window as any)._wxVideo.destroy();
            (window as any)._wxVideo = null;
        }

        SceneManager.getLayer(Layers.Background).removeChildren();

        if (config.tex === 'map_lunatic' && !isWX) {
            // 视频背景逻辑 (仅在浏览器环境启用)
            if (typeof document !== 'undefined' && document.body) {
                // 彻底透明化 PIXI 背景
                app.renderer.background.alpha = 0;
                if (document.body.style) document.body.style.background = 'transparent';
                
                const video = document.createElement('video');
                video.id = 'bg-video';
                video.src = 'assets/map_lunatic.mp4';
                video.autoplay = true; video.loop = true; video.muted = true; video.playsInline = true;
                
                // 确保视频层级在最底下
                Object.assign(video.style, {
                    position: 'fixed', top: '0', left: '0',
                    width: '100%', height: '100%', objectFit: 'cover', zIndex: '-1', 
                    backgroundColor: '#000'
                });
                document.body.insertBefore(video, document.body.firstChild);

                if (canvas && canvas.style) {
                    canvas.style.backgroundColor = 'transparent';
                }
            }
        } else {
            // 恢复普通地图：强制设为不透明
            app.renderer.background.alpha = 1;
            app.renderer.background.color = 0x00050a;

            if (typeof document !== 'undefined' && document.body && document.body.style) {
                document.body.style.background = '#00050a';
            }
            
            if (canvas && canvas.style) {
                canvas.style.position = '';
                canvas.style.zIndex = '';
                canvas.style.backgroundColor = '#00050a';
            }
            
            // 动态选择背景图
            const bgTex = AssetManager.textures[config.tex] || AssetManager.textures['bg_ocean'] || PIXI.Texture.WHITE;
            const bg = new PIXI.Sprite(bgTex);
            SceneManager.getLayer(Layers.Background).addChild(bg);
            SceneManager.setBackground(bg, false);
        }
        
        activeController = new GameController(app, config, () => {
            // 当控制器内部触发“返回”时，在这里处理
            if (activeController) activeController.destroy();
            activeController = null;
            setMenuBg();
            UIManager.init(app);
            UIManager.showMapSelection(onMapSelected);
        });
    };

    setMenuBg();
    UIManager.showMapSelection(onMapSelected);

    console.log('Game Started with Global Upgrades');
};

initGame();
