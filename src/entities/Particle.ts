import * as PIXI from 'pixi.js';

export class Particle extends PIXI.Graphics {
    public isActive: boolean = false;
    private vx: number = 0;
    private vy: number = 0;
    private life: number = 0;

    constructor() {
        super();
        this.beginFill(0x00f0ff);
        this.drawCircle(0, 0, 2);
        this.endFill();
    }

    public spawn(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.isActive = true;
        this.visible = true;
        this.alpha = 1;
        
        const speed = Math.random() * 5 + 2;
        const angle = Math.random() * Math.PI * 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        
        // 随机颜色 (机械电火花感)
        this.clear();
        this.beginFill(Math.random() > 0.5 ? 0x00f0ff : 0xffffff);
        this.drawRect(0, 0, 3, 3);
        this.endFill();
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
