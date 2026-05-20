import * as PIXI from 'pixi.js';
import { AssetManager } from './AssetManager';

/**
 * 场景图层定义
 */
export enum Layers {
    Background = 'background',
    Game = 'game',
    Player = 'player',
    Bullet = 'bullet', // 子弹层：在鱼（Game）上方，特效（FX）下方
    FX = 'fx',
    UI = 'ui',
    Story = 'story' // 最高层级：用于剧情对话，不被游戏UI干扰
}

/**
 * 场景管理器：负责图层管理和屏幕适配
 */
export class SceneManager {
    public static width = 1920;
    public static height = 1080;
    private static app: PIXI.Application;
    private static layers: Map<string, PIXI.Container> = new Map();
    private static bgSprite: PIXI.Sprite | null = null;
    private static isTiled: boolean = false;
    public static isGaming: boolean = false;

    private static underwaterFilter: PIXI.Filter | null = null;
    private static filterTime: number = 0;

    public static setBackground(source: PIXI.Sprite | string, isTiled: boolean = false): void {
        const bgLayer = this.getLayer(Layers.Background);

        if (typeof source === 'string') {
            // 关键修复：不要直接使用 PIXI.Texture.from，它在微信端会触发 Illegal constructor
            // 使用已经预加载好的 AssetManager.textures
            const tex = AssetManager.textures[source] || PIXI.Texture.EMPTY;
            if (!this.bgSprite) {
                this.bgSprite = new PIXI.Sprite(tex);
                bgLayer.addChild(this.bgSprite);
            } else {
                this.bgSprite.texture = tex;
            }
        } else {
            this.bgSprite = source;
            bgLayer.removeChildren();
            bgLayer.addChild(this.bgSprite);
        }

        this.isTiled = isTiled;
        this.bgSprite.visible = true; // 强制显示
        this.bgSprite.alpha = 1;

        this.applyResize(); // 立即重新适配屏幕尺寸

        const isWX = typeof (globalThis as any).wx !== 'undefined';
        // 微信真机：关闭背景水波滤镜（省显存）；浏览器保留
        if (isWX) {
            bgLayer.filters = null;
        } else if (!this.underwaterFilter) {
            this.underwaterFilter = new PIXI.Filter(undefined, `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform float uTime;
                
                void main(void) {
                    vec2 uv = vTextureCoord;
                    float waveX = sin(uv.y * 8.0 + uTime * 1.5) * 0.0018;
                    float waveY = cos(uv.x * 8.0 + uTime * 1.2) * 0.0018;
                    gl_FragColor = texture2D(uSampler, uv + vec2(waveX, waveY));
                }
            `, { uTime: 0 });
            this.underwaterFilter.resolution = this.app ? this.app.renderer.resolution : Math.max(window.devicePixelRatio || 1, 2);
            bgLayer.filters = [this.underwaterFilter];
        } else if (this.app && this.underwaterFilter) {
            this.underwaterFilter.resolution = this.app.renderer.resolution;
        }

        this.applyResize();
    }

    public static init(app: PIXI.Application): void {
        this.app = app;
        this.app.stage.sortableChildren = true; // 开启阶段排序支持

        // 1. 按层级顺序初始化容器
        this.createLayer(Layers.Background, 0); // 最底层
        this.createLayer(Layers.Game, 10);      // 鱼群
        this.createLayer(Layers.Player, 15);    // 玩家炮台：在鱼上方、子弹下方
        this.createLayer(Layers.Bullet, 20);    // 子弹（强制在鱼上方）
        this.createLayer(Layers.FX, 30);        // 粒子特效
        this.createLayer(Layers.UI, 100);       // UI层
        this.createLayer(Layers.Story, 200);    // 剧情对话层（最高层）

        this.applyResize();
        const onResize = () => this.applyResize();
        window.addEventListener('resize', onResize);

        const wxApi = (globalThis as any).wx;
        if (wxApi?.onWindowResize) {
            wxApi.onWindowResize((res: { windowWidth?: number; windowHeight?: number }) => {
                if (res?.windowWidth) {
                    (globalThis as any).GameGlobal.__wxSystemInfo = {
                        ...((globalThis as any).GameGlobal?.__wxSystemInfo || {}),
                        windowWidth: res.windowWidth,
                        windowHeight: res.windowHeight,
                    };
                }
                onResize();
            });
        }

        // 启动全局更新
        this.app.ticker.add((delta) => {
            // 背景滤镜更新
            if (this.underwaterFilter) {
                this.filterTime += delta * 0.01;
                this.underwaterFilter.uniforms.uTime = this.filterTime;
            }

            // 环境气泡生成与更新
            this.updateAmbient(delta);
        });
    }

    private static bubbles: PIXI.Graphics[] = [];
    private static bubbleTimer: number = 0;

    private static updateAmbient(delta: number): void {
        this.bubbleTimer += delta;
        if (this.bubbleTimer > 25) { // 约 0.4 秒产生一个
            this.spawnBubble();
            this.bubbleTimer = 0;
        }

        const bgLayer = this.getLayer(Layers.Background);
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.y -= (b as any).speed; // 向上飘
            b.x += Math.sin(b.y * 0.05) * 0.5; // 轻微左右晃动
            b.alpha -= 0.002;
            if (b.y < -100 || b.alpha <= 0) {
                bgLayer.removeChild(b);
                this.bubbles.splice(i, 1);
            }
        }
    }

    private static spawnBubble(): void {
        const b = new PIXI.Graphics();
        const size = 1 + Math.random() * 4;
        b.beginFill(0xffffff, 0.4).drawCircle(0, 0, size).endFill();
        b.x = Math.random() * this.width;
        b.y = this.height + 50;
        (b as any).speed = 0.5 + Math.random() * 1.5;
        this.getLayer(Layers.Background).addChild(b);
        this.bubbles.push(b);
    }

    private static createLayer(name: string, z: number): void {
        const container = new PIXI.Container();
        container.zIndex = z;
        this.layers.set(name, container);
        this.app.stage.addChild(container);
    }

    public static getLayer(name: string): PIXI.Container {
        return this.layers.get(name) || this.app.stage;
    }

    public static applyResize(): void {
        if (!this.app?.renderer) return;

        // 微信真机：必须用完整窗口尺寸，勿用 safeArea（会导致只显示半屏）
        const sys = (globalThis as any).GameGlobal?.__wxSystemInfo;
        let vw = sys?.screenWidth ?? sys?.windowWidth ?? window.innerWidth;
        let vh = sys?.screenHeight ?? sys?.windowHeight ?? window.innerHeight;
        // 横屏小游戏：部分机型 window 仍是竖屏宽高，交换后 UI 才不会被裁到屏外
        if (vh > vw) {
            const t = vw; vw = vh; vh = t;
        }
        const designW = this.width;
        const designH = this.height;

        this.app.renderer.resize(vw, vh);

        const scale = Math.min(vw / designW, vh / designH);

        // game.json 已锁定横屏，不再做竖屏旋转（旋转是真机「半屏」主因）
        this.app.stage.pivot.set(0, 0);
        this.app.stage.rotation = 0;
        this.app.stage.scale.set(scale);
        this.app.stage.x = (vw - designW * scale) / 2;
        this.app.stage.y = (vh - designH * scale) / 2;

        this.layoutBackground();
    }

    /** 背景在设计稿坐标系内铺满 1920×1080 */
    private static layoutBackground(): void {
        if (!this.bgSprite) return;

        const designW = this.width;
        const designH = this.height;

        if (this.isTiled && (this.bgSprite as any).tileScale) {
            const ts = this.bgSprite as any;
            ts.width = designW;
            ts.height = designH;
            ts.x = 0;
            ts.y = 0;
            return;
        }

        const texW = this.bgSprite.texture.width || 1;
        const texH = this.bgSprite.texture.height || 1;
        const bgScale = Math.max(designW / texW, designH / texH);

        this.bgSprite.anchor.set(0.5);
        this.bgSprite.scale.set(bgScale);
        this.bgSprite.x = designW / 2;
        this.bgSprite.y = designH / 2;
    }

    private static ambientFishes: PIXI.Sprite[] = [];
    private static ambientSpawnTimer: number = 0;

    public static update(delta: number): void {
        this.updateAmbientFishes(delta);
    }

    /**
     * 清理所有背景氛围鱼
     */
    public static clearAmbientFishes(): void {
        const bgLayer = this.getLayer(Layers.Background);
        if (!bgLayer) return;

        this.ambientFishes.forEach(fish => {
            bgLayer.removeChild(fish);
        });
        this.ambientFishes = [];
        this.ambientSpawnTimer = 0;
    }

    /**
     * 更新大厅背景氛围鱼群
     */
    private static updateAmbientFishes(delta: number): void {
        // 只有在大厅且没有进行战斗时才生成背景鱼
        const isWX = typeof (globalThis as any).wx !== 'undefined';
        if (!this.isGaming && !isWX) {
            this.ambientSpawnTimer += delta;
            if (this.ambientSpawnTimer > 180) {
                this.ambientSpawnTimer = 0;
                if (this.ambientFishes.length < 8) {
                    this.spawnAmbientFish();
                }
            }
        }

        const bgLayer = this.layers.get(Layers.Background);
        if (!bgLayer) return;

        for (let i = this.ambientFishes.length - 1; i >= 0; i--) {
            const fish = this.ambientFishes[i];
            const speed = (fish as any)._speed || 1;
            const side = (fish as any)._side || 1;

            fish.x += speed * side * delta;
            // 微微上下波浮动
            fish.y += Math.sin(Date.now() * 0.001 + i) * 0.2 * delta;

            // 超出边界移除
            if (side > 0 && fish.x > this.width + 200) {
                bgLayer.removeChild(fish);
                fish.destroy({ children: true, texture: false, baseTexture: false });
                this.ambientFishes.splice(i, 1);
            } else if (side < 0 && fish.x < -200) {
                bgLayer.removeChild(fish);
                fish.destroy({ children: true, texture: false, baseTexture: false });
                this.ambientFishes.splice(i, 1);
            }
        }
    }

    private static spawnAmbientFish(): void {
        const bgLayer = this.layers.get(Layers.Background);
        if (!bgLayer) return;

        const types = ['fish_tuna', 'fish_jelly', 'fish_angler'];
        const type = types[Math.floor(Math.random() * types.length)];
        const tex = AssetManager.textures[type] || PIXI.Texture.WHITE;

        const fish = new PIXI.Sprite(tex);
        const side = Math.random() > 0.5 ? 1 : -1;

        fish.x = side > 0 ? -150 : this.width + 150;
        fish.y = 100 + Math.random() * (this.height - 200);
        fish.alpha = 0.3 + Math.random() * 0.3; // 较淡，作为背景

        const scale = 0.2 + Math.random() * 0.2;
        fish.scale.set(side > 0 ? -scale : scale, scale); // 翻转朝向

        (fish as any)._speed = 0.5 + Math.random() * 1.2;
        (fish as any)._side = side;

        bgLayer.addChild(fish);
        // 确保鱼在背景图层上方，但在 UI 之下
        if (this.bgSprite) {
            bgLayer.setChildIndex(fish, bgLayer.children.length - 1);
        }

        this.ambientFishes.push(fish);
    }

    public static shake(intensity: number = 5, duration: number = 200): void {
        const originalX = this.app.stage.x;
        const originalY = this.app.stage.y;
        const startTime = Date.now();

        const tick = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < duration) {
                const damping = 1 - elapsed / duration;
                this.app.stage.x = originalX + (Math.random() - 0.5) * intensity * damping;
                this.app.stage.y = originalY + (Math.random() - 0.5) * intensity * damping;
                requestAnimationFrame(tick);
            } else {
                this.app.stage.x = originalX;
                this.app.stage.y = originalY;
            }
        };
        tick();
    }
}
