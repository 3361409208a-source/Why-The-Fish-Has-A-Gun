import * as PIXI from 'pixi.js';

/**
 * 闪电链特效类 (已池化优化)
 */
export class Lightning extends PIXI.Graphics {
    public isActive: boolean = false;
    private life: number = 0;

    constructor() {
        super();
        this.blendMode = PIXI.BLEND_MODES.ADD; // 关键修复：加法混合模式，让多次渲染变为叠加的高亮等离子体，摆脱“涂鸦笔”质感
    }

    public spawn(x1: number, y1: number, x2: number, y2: number, isSub: boolean = false): void {
        this.clear();

        let w = isSub ? 0.35 : 1.0;
        let j = isSub ? 0.6 : 1.0;

        // 绘制三层复合闪电：外层青色晕染 + 中层电道 + 核心白光
        // 这样可以模拟出高压电荷的“过曝”视觉效果，看起来更亮、更有攻击性
        this.drawLightningPath(x1, y1, x2, y2, 40 * j, 6 * w, 0x00ffff, 0.3); // 外层
        this.drawLightningPath(x1, y1, x2, y2, 20 * j, 3 * w, 0x00ffff, 0.8); // 中层
        this.drawLightningPath(x1, y1, x2, y2, 10 * j, 1.5 * w, 0xffffff, 1.0); // 内层

        this.life = isSub ? 0.7 : 1.2;
        this.alpha = 1.0;
        this.isActive = true;
        this.visible = true;
    }

    private drawLightningPath(x1: number, y1: number, x2: number, y2: number, jitter: number, thickness: number, color: number, alpha: number): void {
        this.lineStyle(thickness, color, alpha);
        this.moveTo(x1, y1);
        const segments = 6;
        for (let i = 1; i <= segments; i++) {
            const tx = x1 + (x2 - x1) * (i / segments) + (Math.random() - 0.5) * jitter;
            const ty = y1 + (y2 - y1) * (i / segments) + (Math.random() - 0.5) * jitter;
            this.lineTo(tx, ty);
        }
        this.lineTo(x2, y2);
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        this.life -= 0.1 * delta;
        this.alpha = Math.max(0, this.life);

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
