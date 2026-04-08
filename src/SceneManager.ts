import * as PIXI from 'pixi.js';

/**
 * 场景图层定义
 */
export enum Layers {
    Background = 0,
    Game = 1,
    UI = 2
}

/**
 * 场景管理器
 * 负责画布适配与图层管理
 */
export class SceneManager {
    public static stage: PIXI.Container;
    public static layerMap: Map<Layers, PIXI.Container> = new Map();
    private static app: PIXI.Application;
    private static shakeAmount: number = 0;
    private static shakeDuration: number = 0;
    private static backgroundSprite: PIXI.TilingSprite | PIXI.Sprite | null = null;

    public static init(app: PIXI.Application): void {
        this.app = app;
        this.stage = app.stage;

        // 创建图层
        for (let i = 0; i <= 2; i++) {
            const container = new PIXI.Container();
            this.stage.addChild(container);
            this.layerMap.set(i as Layers, container);
        }

        window.addEventListener('resize', () => this.resize());
        this.resize();
    }

    public static setBackground(sprite: PIXI.TilingSprite | PIXI.Sprite): void {
        this.backgroundSprite = sprite;
        this.resize();
    }

    public static shake(intensity: number = 5, duration: number = 10): void {
        this.shakeAmount = intensity;
        this.shakeDuration = duration;
    }

    private static offsetX: number = 0;
    private static offsetY: number = 0;

    public static update(delta: number): void {
        if (this.shakeDuration > 0) {
            this.shakeDuration -= delta;
            this.stage.x = this.offsetX + (Math.random() - 0.5) * this.shakeAmount;
            this.stage.y = this.offsetY + (Math.random() - 0.5) * this.shakeAmount;
            
            if (this.shakeDuration <= 0) {
                this.stage.x = this.offsetX;
                this.stage.y = this.offsetY;
            }
        }
    }


    public static getLayer(layer: Layers): PIXI.Container {
        return this.layerMap.get(layer)!;
    }

    private static readonly VIRTUAL_WIDTH = 1280;
    private static readonly VIRTUAL_HEIGHT = 720;

    private static resize(): void {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        // 1. 调整画布物理大小
        this.app.renderer.resize(screenWidth, screenHeight);
        
        // 2. 计算主容器缩放比例 (保持 16:9)
        const scale = Math.min(screenWidth / this.VIRTUAL_WIDTH, screenHeight / this.VIRTUAL_HEIGHT);
        this.stage.scale.set(scale);
        
        // 3. 游戏核心区域居中
        this.offsetX = (screenWidth - this.VIRTUAL_WIDTH * scale) / 2;
        this.offsetY = (screenHeight - this.VIRTUAL_HEIGHT * scale) / 2;
        
        this.stage.x = this.offsetX;
        this.stage.y = this.offsetY;

        // 4. 背景图层调整 (背景本身在 stage 内部，所以应充满 1280x720)
        if (this.backgroundSprite) {
            // 强制背景填满虚拟空间
            this.backgroundSprite.width = this.VIRTUAL_WIDTH;
            this.backgroundSprite.height = this.VIRTUAL_HEIGHT;
            this.backgroundSprite.x = 0;
            this.backgroundSprite.y = 0;
        }
    }


    public static get width(): number { return this.VIRTUAL_WIDTH; }
    public static get height(): number { return this.VIRTUAL_HEIGHT; }
}
