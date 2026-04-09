import * as PIXI from 'pixi.js';
import { AssetManager } from './AssetManager';

/**
 * 场景图层定义
 */
export enum Layers {
    Background = 'background',
    Game = 'game',
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

    private static underwaterFilter: PIXI.Filter | null = null;
    private static filterTime: number = 0;

    public static setBackground(source: PIXI.Sprite | string, isTiled: boolean = false): void {
        const bgLayer = this.getLayer(Layers.Background);
        
        if (typeof source === 'string') {
            // 关键修复：不要直接使用 PIXI.Texture.from，它在微信端会触发 Illegal constructor
            // 使用已经预加载好的 AssetManager.textures
            const tex = AssetManager.textures[source] || PIXI.Texture.WHITE;
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
        
        // 增加动态海底扭曲滤镜
        if (!this.underwaterFilter) {
            this.underwaterFilter = new PIXI.Filter(undefined, `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform float uTime;
                
                void main(void) {
                    vec2 uv = vTextureCoord;
                    // 微调扭曲力度至平衡点 (0.0018), 既有水动感又不显突兀
                    float waveX = sin(uv.y * 8.0 + uTime * 1.5) * 0.0018;
                    float waveY = cos(uv.x * 8.0 + uTime * 1.2) * 0.0018;
                    gl_FragColor = texture2D(uSampler, uv + vec2(waveX, waveY));
                }
            `, { uTime: 0 });
            this.getLayer(Layers.Background).filters = [this.underwaterFilter];
        }

        this.applyResize(); 
    }

    public static init(app: PIXI.Application): void {
        this.app = app;
        
        // 1. 按层级顺序初始化容器
        this.createLayer(Layers.Background); // 最底层
        this.createLayer(Layers.Game);        // 鱼群
        this.createLayer(Layers.Bullet);      // 子弹（在鱼上方）
        this.createLayer(Layers.FX);          // 粒子特效
        this.createLayer(Layers.UI);          // 最顶层

        this.applyResize();
        window.addEventListener('resize', () => this.applyResize());
        
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

    private static createLayer(name: string): void {
        const container = new PIXI.Container();
        this.layers.set(name, container);
        this.app.stage.addChild(container);
    }

    public static getLayer(name: string): PIXI.Container {
        return this.layers.get(name) || this.app.stage;
    }

    public static applyResize(): void {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        
        // 关键：必须动态调整渲染器分辨率，否则画面会缩在左上角
        this.app.renderer.resize(vw, vh);

        let targetVW = vw;
        let targetVH = vh;
        let rotation = 0;

        // 手机竖屏检测与自动横屏旋转 (Mobile Auto-Landscape)
        if (vw < vh) {
            rotation = Math.PI / 2;
            targetVW = vh;
            targetVH = vw;
        }

        const scale = Math.min(targetVW / this.width, targetVH / this.height);
        
        this.app.stage.scale.set(scale);
        this.app.stage.rotation = rotation;

        if (rotation === 0) {
            // 正常横屏布局
            this.app.stage.x = (vw - this.width * scale) / 2;
            this.app.stage.y = (vh - this.height * scale) / 2;
        } else {
            // 手机竖屏时的旋转布局 (将横屏旋转 90 度塞进竖屏)
            // 旋转中心在 (vw, 0)，X轴指向下方，Y轴指向左方
            this.app.stage.x = vw - (vw - this.height * scale) / 2;
            this.app.stage.y = (vh - this.width * scale) / 2;
        }

        // 背景适配逻辑
        if (this.bgSprite) {
            if (this.isTiled && (this.bgSprite as any).tileScale) {
                // 平铺模式 (TilingSprite)
                const ts = this.bgSprite as any;
                ts.width = targetVW / scale;
                ts.height = targetVH / scale;
                
                if (rotation === 0) {
                    ts.x = -this.app.stage.x / scale;
                    ts.y = -this.app.stage.y / scale;
                } else {
                    ts.x = -this.app.stage.y / scale;
                    ts.y = (this.app.stage.x - vw) / scale;
                }
            } else {
                // 全图拉伸覆盖模式 (Cover Mode)
                const texW = this.bgSprite.texture.width;
                const texH = this.bgSprite.texture.height;
                
                // 计算铺满屏幕所需的比例
                const bgScale = Math.max(
                    (targetVW / scale) / texW,
                    (targetVH / scale) / texH
                );
                
                this.bgSprite.scale.set(bgScale);
                this.bgSprite.anchor.set(0.5);
                
                // 将背景居中锁定
                if (rotation === 0) {
                    this.bgSprite.x = (targetVW / scale) / 2 - this.app.stage.x / scale;
                    this.bgSprite.y = (targetVH / scale) / 2 - this.app.stage.y / scale;
                } else {
                    // 旋转模式下的对齐
                    this.bgSprite.x = (targetVW / scale) / 2 - this.app.stage.y / scale;
                    this.bgSprite.y = (targetVH / scale) / 2 + (this.app.stage.x - vw) / scale;
                }
            }
        }
    }

    public static update(delta: number): void {
        // 全局动画逻辑可在此扩展
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
