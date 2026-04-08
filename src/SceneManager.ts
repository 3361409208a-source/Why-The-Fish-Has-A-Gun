import * as PIXI from 'pixi.js';

/**
 * 场景图层定义
 */
export enum Layers {
    Background = 'background',
    Game = 'game',
    FX = 'fx', // 高性能特效层
    UI = 'ui'
}

/**
 * 场景管理器：负责图层管理和屏幕适配
 */
export class SceneManager {
    public static width = 1280;
    public static height = 720;
    private static app: PIXI.Application;
    private static layers: Map<string, PIXI.Container> = new Map();
    private static bgSprite: PIXI.TilingSprite | null = null;

    public static setBackground(sprite: PIXI.TilingSprite): void {
        this.bgSprite = sprite;
    }

    public static init(app: PIXI.Application): void {
        this.app = app;
        
        // 1. 背景层 (普通 Container)
        this.createLayer(Layers.Background);
        
        // 2. 游戏层 (包含鱼和动态实体)
        this.createLayer(Layers.Game);
        
        // 3. 特效加速层 (Pixi v7 ParticleContainer)
        // 开启所有的加速属性以支持子弹和粒子的渲染需求
        const fxLayer = new PIXI.ParticleContainer(15000, {
            vertices: true,
            position: true,
            rotation: true,
            scale: true,
            uvs: true,
            tint: true,
            alpha: true
        });
        this.layers.set(Layers.FX, fxLayer);
        app.stage.addChild(fxLayer);
        
        // 4. UI 层
        this.createLayer(Layers.UI);

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
        
        const scale = Math.min(vw / this.width, vh / this.height);
        
        this.app.stage.scale.set(scale);
        this.app.stage.x = (vw - this.width * scale) / 2;
        this.app.stage.y = (vh - this.height * scale) / 2;

        // 平铺背景全屏适配
        if (this.bgSprite) {
            this.bgSprite.width = vw / scale;
            this.bgSprite.height = vh / scale;
            this.bgSprite.x = -this.app.stage.x / scale;
            this.bgSprite.y = -this.app.stage.y / scale;
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
