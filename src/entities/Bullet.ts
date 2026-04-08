import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Bullet extends PIXI.Sprite {
    public isActive: boolean = false;
    private speed: number = 10;
    private vx: number = 0;
    private vy: number = 0;
    private trailTimer: number = 0;

    constructor() {
        super(AssetManager.textures['bullet_laser']);
        this.anchor.set(0.5);
    }

    public setType(type: string): void {
        this.texture = AssetManager.textures[type === 'plasma' ? 'bullet_plasma' : 'bullet_laser'];
        this.speed = type === 'plasma' ? 15 : 12; // 等离子体更快
        
        // 增加发光滤镜 (可选，如果性能允许)
        // this.filters = [new PIXI.filters.GlowFilter({ distance: 10, outerStrength: 2, color: type === 'plasma' ? 0xff00ff : 0x00ffff })];
    }

    public fire(x: number, y: number, angle: number): void {
        this.x = x;
        this.y = y;
        this.rotation = angle;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.isActive = true;
        this.visible = true;
        this.trailTimer = 0;
    }

    public update(delta: number): void {
        if (!this.isActive) return;
        this.x += this.vx * delta;
        this.y += this.vy * delta;

        // 边界回收 (按虚拟分辨率 1280x720 计算)
        if (this.x < -100 || this.x > 1280 + 100 || 
            this.y < -100 || this.y > 720 + 100) {
            this.kill();
        }

    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
