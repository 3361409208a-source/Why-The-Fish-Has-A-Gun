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

    // 3. 构建加载界面
    const loadingLayer = new PIXI.Container();
    app.stage.addChild(loadingLayer);

    const loadBg = new PIXI.Graphics().beginFill(0x00050a).drawRect(0, 0, 1920, 1080).endFill();
    loadingLayer.addChild(loadBg);

    const barWidth = 600;
    const barFrame = new PIXI.Graphics().lineStyle(2, 0x00f0ff, 0.5).drawRoundedRect(960 - barWidth/2, 600, barWidth, 20, 10);
    const progressBar = new PIXI.Graphics();
    const loadText = new PIXI.Text('正在检测海域异常状态...', {
        fontFamily: 'Verdana', fontSize: 24, fill: 0x00f0ff, fontWeight: 'bold'
    });
    loadText.anchor.set(0.5); loadText.x = 960; loadText.y = 550;
    loadingLayer.addChild(barFrame, progressBar, loadText);

    // 4. 初始化所有管理器并更新进度
    await AssetManager.init(app.renderer as PIXI.Renderer, (p) => {
        const percent = Math.floor(p * 100);
        loadText.text = `深度同步中... ${percent}%`;
        progressBar.clear().beginFill(0x00f0ff, 0.8).drawRoundedRect(960 - barWidth/2, 600, barWidth * p, 20, 10).endFill();
    });

    // 加载完成，淡出加载界面
    app.ticker.add((delta) => {
        if (loadingLayer.alpha > 0) {
            loadingLayer.alpha -= 0.05 * delta;
            if (loadingLayer.alpha <= 0) {
                loadingLayer.visible = false;
                app.stage.removeChild(loadingLayer);
            }
        }
    });

    SceneManager.init(app);
    UIManager.init(app);

    let activeController: GameController | null = null;

    // 统一的地图切入逻辑（包含剧情对话）
    const onMapSelected = async (config: any) => {
        // 先切换对应海域的背景
        SceneManager.setBackground(config.tex || 'bg_ocean');

        // 收集对应地图的剧情对话
        let dialogue: any[] = [];
        if (config.id === 'normal') {
            dialogue = [
                { speaker: '深度指挥部', text: '已到达外围海域“孢子温床”，开始环境扫描。', avatar: 'cannon_v3', side: 'left' },
                { speaker: '驾驶员', text: '收到。这里的异常波动还算稳定。', avatar: 'skin_tuna', side: 'right' },
                { speaker: '深海安康鱼', text: '……闪烁的光……是食物吗？', avatar: 'fish_angler', side: 'left' },
                { speaker: '驾驶员', text: '那可不是什么好吃的。那是等离子光束！', avatar: 'skin_tuna', side: 'right' },
                { speaker: '深度指挥部', text: '准备战斗，清理该区域。', avatar: 'cannon_v3', side: 'left' }
            ];
        } else if (config.id === 'hard') {
            dialogue = [
                { speaker: '驾驶员', text: '这片海域的辐射值太高了，雷达几乎完全失效。', avatar: 'skin_gatling', side: 'right' },
                { speaker: '机械巨鲨', text: '鲜活的意志……多久没闻到这种味道了。', avatar: 'fish_shark', side: 'left' },
                { speaker: '驾驶员', text: '别在那儿装神弄鬼。我知道你就在废船残骸后面！', avatar: 'skin_gatling', side: 'right' },
                { speaker: '机械巨鲨', text: '哈哈哈哈！你的愤怒只会加速你的腐烂，小虫子。', avatar: 'fish_shark', side: 'left' },
                { speaker: '驾驶员', text: '加特林预热完毕。让我看看你的钢板有多厚！', avatar: 'skin_gatling', side: 'right' },
                { speaker: '机械巨鲨', text: '那就来吧……在死寂中痛苦挣扎吧！', avatar: 'fish_shark', side: 'left' }
            ];
        } else if (config.id === 'lunatic') {
            dialogue = [
                { speaker: '神秘信号', text: '警告：核心温度超过临界值。这里不适合任何生命形式。', avatar: 'skin_heavy', side: 'right' },
                { speaker: '机械鳞龙', text: '……谁在唤醒核心的沉眠？', avatar: 'fish_dragon', side: 'left' },
                { speaker: '驾驶员', text: '这声音……比传闻中还要让人不舒服。', avatar: 'skin_heavy', side: 'right' },
                { speaker: '机械鳞龙', text: '你身上的金属……闻起来有英雄的腐臭味。', avatar: 'fish_dragon', side: 'left' },
                { speaker: '驾驶员', text: '少废话。既然你还没死透，那我就再送你一程！', avatar: 'skin_heavy', side: 'right' },
                { speaker: '机械鳞龙', text: '毁灭是永恒的恩赐！在余烬中化为虚无吧！', avatar: 'fish_dragon', side: 'left' },
                { speaker: '深度指挥部', text: '各单位注意：主炮进入超负荷模式，全面开火！', avatar: 'cannon_v3', side: 'right' }
            ];
        }

        // 销毁旧控制器
        // 收集对话完毕，销毁旧控制器
        if (activeController) activeController.destroy();
        
        // 清理旧的视频背景
        if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
            const oldVideo = document.getElementById('bg-video');
            if (oldVideo) oldVideo.remove();
        }
        if (isWX && (window as any)._wxVideo) {
            (window as any)._wxVideo.destroy();
            (window as any)._wxVideo = null;
        }

        if (config.id === 'lunatic' && !isWX) {
            // 视频背景逻辑 (仅在浏览器环境启用)
            if (typeof document !== 'undefined' && document.body) {
                app.renderer.background.alpha = 0;
                if (document.body.style) document.body.style.background = 'transparent';
                const video = document.createElement('video');
                video.id = 'bg-video';
                video.src = 'assets/map_lunatic.mp4';
                video.autoplay = true; video.loop = true; video.muted = true; video.playsInline = true;
                Object.assign(video.style, {
                    position: 'fixed', top: '0', left: '0',
                    width: '100%', height: '100%', objectFit: 'cover', zIndex: '-1', 
                    backgroundColor: '#000'
                });
                document.body.insertBefore(video, document.body.firstChild);
            }
        } else {
            // 普通场景处理
            app.renderer.background.alpha = 1;
            SceneManager.setBackground(config.tex || 'bg_ocean');
        }
        
        // 启动新控制器 (传入完成后返回菜单的回调)
        activeController = new GameController(app, config, dialogue, () => {
            UIManager.showMapSelection(onMapSelected);
            SceneManager.setBackground('bg_ocean'); 
        });

        syncTalents();
    };

    // 初始设置背景
    SceneManager.setBackground('bg_ocean');

    // 初始显示地图选择
    UIManager.showMapSelection(onMapSelected);

    console.log('Game Started with Global Upgrades');
};

initGame();
