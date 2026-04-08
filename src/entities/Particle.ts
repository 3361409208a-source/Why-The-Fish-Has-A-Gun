import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Particle extends PIXI.Sprite {
    public isActive: boolean = false;
    private vx: number = 0;
    private vy: number = 0;
    private life: number = 0;

    constructor() {
        // 使用烘培好的白色圆点纹理，以兼容 ParticleContainer
        super(AssetManager.textures['white_dot']);
        this.anchor.set(0.5);
    }

    public spawn(x: number, y: number, color: number = 0x00f0ff, size: number = 4): void {
        this.x = x;
        this.y = y;
        this.tint = color;
        
        // 纹理原始大小是 8x8 (radius 4)
        this.scale.set(size / 8);
        
        const angle = Math.random() * Math.PI * 2;
        const force = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * force;
        this.vy = Math.sin(angle) * force;
        this.life = 1.0;
        this.alpha = 1;
        this.isActive = true;
        this.visible = true;
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        this.x += this.vx * delta;
        this.y += this.vy * delta;
        this.vy += 0.1 * delta; // 重力
        
        this.life -= 0.03 * delta;
        this.alpha = this.life;

        if (this.life <= 0) {
            this.kill();
        }
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
