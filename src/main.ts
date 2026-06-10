import * as PIXI from 'pixi.js';
import '@pixi/unsafe-eval';

// 强制跳过渲染检测与适配微信环境
console.log('PIXI Game Initializing on Web Platform...');
PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL_LEGACY;
PIXI.BaseTexture.defaultOptions.alphaMode = PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA;

// 微信小游戏检测：不能依赖 window.wx（此时 weapp-adapter 还没运行）
// 改用 GameGlobal 或 typeof wx 来判断是否在微信环境中
const _isWxEnvEarly = (typeof (globalThis as any).GameGlobal !== 'undefined')
    || (typeof (globalThis as any).wx !== 'undefined')
    || (typeof (global as any) !== 'undefined' && (global as any).wx !== 'undefined');

if (!_isWxEnvEarly) {
    (PIXI.settings as any).FAIL_IF_MAJOR_PERFORMANCE_CAVEAT = false;
    (PIXI.settings as any).CREATE_IMAGE_BITMAP = true; // 浏览器环境下开启以提升性能
    
    // 浏览器环境：尝试锁定横屏方向，失败则依赖 CSS 旋转降级
    try {
        if (typeof screen !== 'undefined' && (screen as any).orientation) {
            console.log('Screen orientation lock available.');
        }
    } catch (e) { }
} else {
    // 微信小游戏：CREATE_IMAGE_BITMAP 不支持，必须禁用，否则所有贴图/文字会静默失败
    (PIXI.settings as any).CREATE_IMAGE_BITMAP = false;
    console.log('WeChat mode detected early: CREATE_IMAGE_BITMAP disabled');
}

// 3. [纠极修复]：直接修正 PIXI 资源探测器的静态测试方法
// 这比注册 Extension 更稳健，能彻底解决 "Unrecognized source type" 报错
try {
    const _ImageResource = (PIXI as any).ImageResource;
    const _CanvasResource = (PIXI as any).CanvasResource;

    if (_ImageResource) {
        const oldTest = _ImageResource.test;
        _ImageResource.test = (source: any) => {
            if (source && (source.tagName === 'IMG' || (source.constructor && source.constructor.name === 'Image'))) return true;
            return oldTest ? oldTest(source) : false;
        };
    }

    if (_CanvasResource) {
        const oldTest = _CanvasResource.test;
        _CanvasResource.test = (source: any) => {
            if (source && (source.tagName === 'CANVAS' || (source.constructor && source.constructor.name === 'Canvas'))) return true;
            return oldTest ? oldTest(source) : false;
        };
    }
} catch (e) {
    console.warn('Failed to patch PIXI resource detectors', e);
}

import { AssetManager } from './AssetManager';
import { SceneManager, Layers } from './SceneManager';
import { GameController } from './GameController';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { getDialogue } from './config/dialogue.config';
import { getMap } from './config/maps.config';
import { LEVELS, getLevelLocation, getLayerAreaLevels } from './config/levels.config';
import { talentManager } from './core/TalentManager';
import { bindWxPixiTouch } from './WxPixiTouch';
import { applyWxTextDefaults } from './utils/wxFont';

/**
 * 游戏入口：深海余烬 (全屏独立页面架构)
 */
const initGame = async () => {
    // 0. 横屏提示：手机端竖屏时在顶部显示提示条（CSS @media 控制显隐，pointer-events: none 不阻挡触摸）
    //    同时尝试 Screen Orientation API 锁定横屏（Android Chrome 支持，iOS 自动降级为提示条）

    // 1. 初始化存档
    SaveManager.load();

    const isWX = typeof (window as any).wx !== 'undefined' ||
        (typeof (window as any).GameGlobal !== 'undefined') ||
        (typeof global !== 'undefined' && (global as any).wx !== 'undefined');
    const _window = (typeof window !== 'undefined' ? window : (typeof (window as any).GameGlobal !== 'undefined' ? (window as any).GameGlobal : (typeof global !== 'undefined' ? global : {}))) as any;

    const canvas = _window.canvas || (typeof document !== 'undefined' ? document.createElement('canvas') : null);

    if (canvas && !(window as any).canvas && typeof document !== 'undefined' && document.body) {
        document.body.appendChild(canvas);
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';
    }

    if (canvas.style) canvas.style.touchAction = 'none';
    if (canvas.style) canvas.style.background = 'transparent';

    // 微信真机修复：用实际游戏 canvas 替换 PIXI 内部 WebGL 探测逻辑
    // (真机上 document.createElement('canvas') 创建的第二个 canvas 不支持 WebGL)
    const sys = (globalThis as any).GameGlobal?.__wxSystemInfo;
    let viewW = sys?.screenWidth ?? sys?.windowWidth ?? window.innerWidth;
    let viewH = sys?.screenHeight ?? sys?.windowHeight ?? window.innerHeight;
    if (viewH > viewW) { const t = viewW; viewW = viewH; viewH = t; }
    const wxDpr = sys?.pixelRatio ?? window.devicePixelRatio ?? 1;
    const rendererDpr = isWX ? 1 : Math.min(wxDpr, 2);

    if (isWX) {
        applyWxTextDefaults();
        PIXI.settings.PREFER_ENV = PIXI.ENV.WEBGL_LEGACY;
    }

    const rendererOptions = {
        view: canvas as HTMLCanvasElement,
        width: viewW,
        height: viewH,
        resolution: rendererDpr,
        autoDensity: true,
        backgroundAlpha: isWX ? 1 : 0,
        backgroundColor: 0x00050a,
        antialias: !isWX,
    };

    let app: PIXI.Application;
    if (isWX) {
        // 微信：isWebGLSupported 是只读 ES Module binding 无法 patch，
        // 直接构造 PIXI.Renderer 完全跳过 autoDetectRenderer 检测
        const renderer = new (PIXI as any).Renderer(rendererOptions) as PIXI.Renderer;
        const stage = new PIXI.Container();
        // 手动创建 Renderer 时须绑定事件根节点，否则 FederatedEvents 无法命中 UI
        const events = (renderer as any).events;
        if (events?.rootBoundary) {
            events.rootBoundary.rootTarget = stage;
        }
        const ticker = new PIXI.Ticker();
        ticker.add(() => renderer.render(stage));
        ticker.start();
        app = { renderer, stage, ticker, view: canvas, screen: renderer.screen } as any as PIXI.Application;
        bindWxPixiTouch(app, stage);
        console.log(`WeChat: Renderer ${viewW}x${viewH} resolution=${rendererDpr} (device dpr=${wxDpr})`);
    } else {
        app = new PIXI.Application(rendererOptions);
    }

    // body 默认深海色（普通地图的底色）
    if (typeof document !== 'undefined' && document.body && document.body.style) {
        document.body.style.background = '#00050a';
    }

    // 2. 初始化天赋系统（向后兼容：同时同步到 window，待 Phase3/4 完成后逐步移除）
    talentManager.syncToWindow();

    // 3. 构建加载界面
    const loadingLayer = new PIXI.Container();
    app.stage.addChild(loadingLayer);

    const loadBg = new PIXI.Graphics().beginFill(0x00050a).drawRect(0, 0, 1920, 1080).endFill();
    loadingLayer.addChild(loadBg);

    const barWidth = 600;
    const barFrame = new PIXI.Graphics().lineStyle(2, 0x00f0ff, 0.5).drawRoundedRect(960 - barWidth / 2, 600, barWidth, 20, 10);
    const progressBar = new PIXI.Graphics();
    const loadText = new PIXI.Text('正在检测海域异常状态...', {
        fontFamily: isWX ? 'sans-serif' : 'Verdana', fontSize: 24, fill: 0x00f0ff, fontWeight: 'bold'
    });
    loadText.anchor.set(0.5); loadText.x = 960; loadText.y = 550;
    loadingLayer.addChild(barFrame, progressBar, loadText);

    // 4. 初始化所有管理器并更新进度
    await AssetManager.init(app.renderer as PIXI.Renderer, (p) => {
        const percent = Math.floor(p * 100);
        loadText.text = `深度同步中... ${percent}%`;
        progressBar.clear().beginFill(0x00f0ff, 0.8).drawRoundedRect(960 - barWidth / 2, 600, barWidth * p, 20, 10).endFill();
    });

    // 加载完成：微信真机立即移除加载层（避免挡住 UI）；浏览器保留淡出
    const removeLoading = () => {
        loadingLayer.visible = false;
        if (loadingLayer.parent) loadingLayer.parent.removeChild(loadingLayer);
    };
    if (isWX) {
        removeLoading();
    } else {
        app.ticker.add((delta) => {
            if (loadingLayer.alpha > 0) {
                loadingLayer.alpha -= 0.05 * delta;
                if (loadingLayer.alpha <= 0) removeLoading();
            }
        });
    }

    // 6. 全局更新循环
    app.ticker.add((delta) => {
        SceneManager.update(delta);
    });

    // 7. 进入游戏流程
    SceneManager.init(app);
    let activeController: GameController | null = null;

    // 统一的地图切入逻辑（包含剧情对话）
    const onMapSelected = async (config: any) => {
        // 先切换对应海域的背景（bgKey来自MapDef）
        SceneManager.setBackground(config.bgKey || config.tex || 'bg_ocean');

        // 进入战斗状态标识
        SceneManager.isGaming = true;
        SceneManager.clearAmbientFishes(); // 立即清理大厅氛围鱼，不带进战斗

        // 从配置中读取剧情台词
        const dialogue = getDialogue(config.id);

        // 停止之前的控制器
        if (activeController) {
            activeController.destroy();
            activeController = null;
        }

        // 清理 UI (隐藏菜单)
        UIManager.hideAll();

        // 渲染器清理（防止视频残留）
        const video = typeof document !== 'undefined' && typeof (document as any).getElementById === 'function' ? document.getElementById('bg-video') : null;
        if (video) video.remove();
        if (isWX && (window as any)._wxVideo) {
            (window as any)._wxVideo.destroy();
            (window as any)._wxVideo = null;
        }

        // 先统一设置静态背景图（保底方案）
        SceneManager.setBackground(config.bgKey || config.tex || 'bg_ocean');

        // 从配置读取地图定义，获取视频地址
        const mapDef = getMap(config.id);
        const videoUrl = !isWX && mapDef?.videoUrl;

        if (videoUrl && typeof document !== 'undefined' && document.body) {
            const video = document.createElement('video');
            video.id = 'bg-video';
            video.src = videoUrl;
            video.autoplay = true; video.loop = true; video.muted = true; video.playsInline = true;
            Object.assign(video.style, {
                position: 'fixed', top: '0', left: '0',
                width: '100%', height: '100%', objectFit: 'cover', zIndex: '1',
                backgroundColor: '#000'
            });

            // 只有当视频正式开始播放时，才隐藏 PIXI 静态背景，实现无缝切换
            video.onplaying = () => {
                app.renderer.background.alpha = 0;
                SceneManager.setBackground('');
                if (document.body.style) document.body.style.background = 'transparent';
            };

            document.body.insertBefore(video, document.body.firstChild);
            video.play().catch(e => {
                console.warn('Video autoplay failed, staying with static image:', e);
            });
        } else {
            app.renderer.background.alpha = 1;
        }





        // 启动新控制器 (传入完成后返回菜单的回调)
        const stageLevel = config.stageLevel || 0;
        activeController = new GameController(app, config, dialogue, () => {
            SceneManager.isGaming = false; // 返回大厅，回显氛围鱼
            UIManager.showMapSelection(onMapSelected);
            SceneManager.setBackground('bg_ocean');
        }, stageLevel, (newConfig) => {
            // 重新开始下一关
            onMapSelected(newConfig);
        });

        talentManager.syncToWindow();
    };

    // 关卡模式切入逻辑
    const onStageSelected = async (levelId: number, config: any) => {
        // 对于非区域1的关卡，需要从对应区域获取关卡定义
        const { area, levelInArea } = getLevelLocation(levelId);
        const areaLevels = getLayerAreaLevels(config.layer || 1, area);
        const lvlDef = areaLevels.find((l: typeof LEVELS[0]) => l.id === levelId);
        if (!lvlDef) {
            console.error('[onStageSelected] Level not found:', levelId, 'area:', area, 'levelInArea:', levelInArea);
            return;
        }

        SceneManager.setBackground(lvlDef.bgKey || 'bg_ocean');
        SceneManager.isGaming = true;
        SceneManager.clearAmbientFishes();

        if (activeController) { activeController.destroy(); activeController = null; }
        UIManager.hideAll();

        const video = typeof document !== 'undefined' && typeof (document as any).getElementById === 'function' ? document.getElementById('bg-video') : null;
        if (video) video.remove();

        const mapDef = getMap(lvlDef.bgKey);
        const videoUrl = !isWX && mapDef?.videoUrl;
        if (videoUrl && typeof document !== 'undefined' && document.body) {
            const v = document.createElement('video');
            v.id = 'bg-video';
            v.src = videoUrl;
            v.autoplay = true; v.loop = true; v.muted = true; v.playsInline = true;
            Object.assign(v.style, { position: 'fixed', top: '0', left: '0', width: '100%', height: '100%', objectFit: 'cover', zIndex: '1' });
            v.onplaying = () => { app.renderer.background.alpha = 0; SceneManager.setBackground(''); };
            document.body.insertBefore(v, document.body.firstChild);
            v.play().catch(() => { });
        } else {
            app.renderer.background.alpha = 1;
        }

        const backToLobby = () => {
            SceneManager.isGaming = false;
            UIManager.showMapSelection(onMapSelected);
            SceneManager.setBackground('bg_ocean');
        };

        activeController = new GameController(
            app,
            config,
            lvlDef.openingDialogue,
            backToLobby,
            levelId,
            (newConfig) => {
                // 重新开始下一关
                onStageSelected(newConfig.stageLevel, newConfig);
            },
        );
        talentManager.syncToWindow();
    };

    // 7. 进入游戏流程
    UIManager.init(app, onMapSelected);
    UIManager.setOnStageSelected(onStageSelected);

    SceneManager.setBackground('bg_ocean');
    SceneManager.applyResize();

    app.renderer.render(app.stage);
    console.log('[Boot] Lobby UI ready');

    console.log('Game Started with Global Upgrades');

    // 尝试锁定横屏方向（Android Chrome 支持，iOS Safari 不支持但 CSS 降级已生效）
    try {
        if (typeof screen !== 'undefined' && (screen as any).orientation?.lock) {
            (screen as any).orientation.lock('landscape').catch(() => {});
        }
    } catch (e) { }
};

// 延迟启动，确保 DOM 就绪
// 微信小游戏无 DOMContentLoaded 事件，直接启动；浏览器端监听事件
if (typeof (window as any).wx !== 'undefined') {
    console.log('===== PIXI STARTING (WeChat) =====');
    initGame().catch(err => {
        console.error('Game Init Error:', err);
    });
} else {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('===== PIXI STARTING =====');
        initGame().catch(err => {
            // 作为最后的手段，如果黑屏且控制台看不到报错，直接弹窗显示
            alert('Game Init Error: ' + err.message);
            console.error('Game Init Error:', err);
        });
    });
}
