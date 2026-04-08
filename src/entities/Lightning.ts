import * as PIXI from 'pixi.js';

/**
 * 闪电链特效类 (已池化优化)
 */
export class Lightning extends PIXI.Graphics {
    public isActive: boolean = false;
    private life: number = 0;

    constructor() {
        super();
    }

    public spawn(x1: number, y1: number, x2: number, y2: number): void {
        this.clear();
        this.lineStyle(2, 0x00ffff, 1);
        this.moveTo(x1, y1);

        // 分段绘制闪电，模拟折线感
        const segments = 4;
        for (let i = 1; i <= segments; i++) {
            const tx = x1 + (x2 - x1) * (i / segments) + (Math.random() - 0.5) * 30;
            const ty = y1 + (y2 - y1) * (i / segments) + (Math.random() - 0.5) * 30;
            this.lineTo(tx, ty);
        }
        this.lineTo(x2, y2);

        this.life = 1.0;
        this.alpha = 1.0;
        this.isActive = true;
        this.visible = true;
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        this.life -= 0.1 * delta;
        this.alpha = this.life;

        if (this.life <= 0) {
            this.kill();
        }
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
        this.clear();
    }
}
