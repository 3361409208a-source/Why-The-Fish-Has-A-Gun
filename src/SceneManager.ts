import * as PIXI from 'pixi.js';

/**
 * 场景图层定义
 */
export enum Layers {
    Background = 'background',
    Game = 'game',
    Bullet = 'bullet', // 子弹层：在鱼（Game）上方，特效（FX）下方
    FX = 'fx',
    UI = 'ui'
}

/**
 * 场景管理器：负责图层管理和屏幕适配
 */
export class SceneManager {
    public static width = 1920;
    public static height = 1080;
    private static app: PIXI.Application;
    private static layers: Map<string, PIXI.Container> = new Map();
    private static bgSprite: PIXI.TilingSprite | null = null;

    public static setBackground(sprite: PIXI.TilingSprite): void {
        this.bgSprite = sprite;
        this.applyResize(); // 立即执行一次适配，防止初始加载时背景没对齐
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

        // 平铺背景全屏适配 (适配旋转后的坐标系，确保覆盖物理全屏)
        if (this.bgSprite) {
            this.bgSprite.width = targetVW / scale;
            this.bgSprite.height = targetVH / scale;
            
            if (rotation === 0) {
                this.bgSprite.x = -this.app.stage.x / scale;
                this.bgSprite.y = -this.app.stage.y / scale;
            } else {
                // 旋转模式下的坐标对齐：逻辑 (0,0) 在屏幕 (vw, 0)
                // 我们需要背景反向偏移以覆盖屏幕左侧和上方
                this.bgSprite.x = -this.app.stage.y / scale;
                this.bgSprite.y = (this.app.stage.x - vw) / scale;
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
