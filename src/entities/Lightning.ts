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

    public spawn(x1: number, y1: number, x2: number, y2: number, isSub: boolean = false): void {
        this.clear();

        let w = isSub ? 0.35 : 1.0;
        let j = isSub ? 0.6 : 1.0;

        // 计算统一的闪电路径点，确保内层白光和外层光晕完美重叠，而不再是单独进行随机导致分离错位
        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const segments = Math.max(5, Math.floor(dist / 25)); // 根据距离动态决定段数
        const points: { x: number, y: number, forks: { x: number, y: number }[] }[] = [];

        points.push({ x: x1, y: y1, forks: [] });

        for (let i = 1; i < segments; i++) {
            const fraction = i / segments;
            const perpX = -dy / dist; // 垂直法向量计算制造闪电经典“折线”锯齿，而非盲目的圆周乱晃
            const perpY = dx / dist;
            const offset = (Math.random() - 0.5) * 45 * j;

            let tx = x1 + dx * fraction + perpX * offset;
            let ty = y1 + dy * fraction + perpY * offset;

            let forks: { x: number, y: number }[] = [];
            // 25% 概率生成小型分支死胡同，让闪电更生动自然
            if (Math.random() < 0.25) {
                const forkLen = 10 + Math.random() * 20 * j;
                const forkAngle = Math.atan2(dy, dx) + (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.8);
                forks.push({
                    x: tx + Math.cos(forkAngle) * forkLen,
                    y: ty + Math.sin(forkAngle) * forkLen
                });
            }
            points.push({ x: tx, y: ty, forks });
        }
        points.push({ x: x2, y: y2, forks: [] });

        // 绘制三层复合闪电：外层青色晕染 + 中层电道 + 核心白光
        this.drawPath(points, 6 * w, 0x00ffff, 0.3); // 外层
        this.drawPath(points, 3 * w, 0x00ffff, 0.8); // 中层
        this.drawPath(points, 1.5 * w, 0xffffff, 1.0); // 内层

        this.life = isSub ? 0.7 : 1.2;
        this.alpha = 1.0;
        this.isActive = true;
        this.visible = true;
    }

    private drawPath(points: { x: number, y: number, forks: { x: number, y: number }[] }[], thickness: number, color: number, alpha: number): void {
        this.lineStyle(thickness, color, alpha);
        if (points.length === 0) return;
        this.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            const p = points[i];
            this.lineTo(p.x, p.y);
            for (const f of p.forks) {
                this.moveTo(p.x, p.y);
                this.lineTo(f.x, f.y);
                this.moveTo(p.x, p.y);
            }
        }
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
