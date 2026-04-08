import * as PIXI from 'pixi.js';

export class Shockwave extends PIXI.Graphics {
    public isActive: boolean = false;
    private radius: number = 0;
    private maxRadius: number = 200;
    private speed: number = 15;

    constructor() {
        super();
    }

    public spawn(x: number, y: number, scale: number = 1.0): void {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.maxRadius = 150 * scale;
        this.isActive = true;
        this.visible = true;
        this.alpha = 0.5;
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        this.radius += this.speed * delta;
        this.alpha -= 0.02 * delta;

        this.clear();
        this.lineStyle(4, 0xffffff, this.alpha);
        this.drawCircle(0, 0, this.radius);

        if (this.alpha <= 0 || this.radius >= this.maxRadius) {
            this.kill();
        }
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
