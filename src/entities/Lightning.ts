import * as PIXI from 'pixi.js';

/**
 * [优化 P2] 闪电链特效类
 * - 使用确定性伪随机替代 Math.random()，减少 GC 压力
 * - 减少绳段数 6→4（视觉差异极小）
 */
export class Lightning extends PIXI.Graphics {
    public isActive: boolean = false;
    private life: number = 0;
    private frameCount: number = 0;
    private seed: number = 0;

    /** 确定性伪随机：基于种子的快速 hash，避免每帧 Math.random() */
    private fastRandom(): number {
        this.seed = (this.seed * 16807 + 1) & 0x7fffffff;
        return (this.seed / 0x7fffffff) * 2 - 1; // 返回 [-1, 1]
    }

    constructor() {
        super();
        this.blendMode = PIXI.BLEND_MODES.ADD;
    }

    public spawn(x1: number, y1: number, x2: number, y2: number, isSub: boolean = false): void {
        this.clear();

        // [优化 P2] 初始化伪随机种子（基于坐标 hash）
        this.seed = ((x1 * 73856093) ^ (y1 * 19349663) ^ (x2 * 83492791) ^ (y2 * 49979687)) & 0x7fffffff;
        this.frameCount = 0;

        const w = isSub ? 0.35 : 1.0;
        const j = isSub ? 0.6 : 1.0;

        // 三层复合闪电：外层青色晕 + 中层电道 + 核心白光
        this.drawLightningPath(x1, y1, x2, y2, 40 * j, 6 * w, 0x00ffff, 0.3);
        this.drawLightningPath(x1, y1, x2, y2, 20 * j, 3 * w, 0x00ffff, 0.8);
        this.drawLightningPath(x1, y1, x2, y2, 10 * j, 1.5 * w, 0xffffff, 1.0);

        this.life = isSub ? 0.7 : 1.2;
        this.alpha = 1.0;
        this.isActive = true;
        this.visible = true;
    }

    private drawLightningPath(x1: number, y1: number, x2: number, y2: number, jitter: number, thickness: number, color: number, alpha: number): void {
        this.lineStyle(thickness, color, alpha);
        this.moveTo(x1, y1);
        // [优化 P2] 段数从 6 减到 4，使用确定性伪随机
        const segments = 4;
        for (let i = 1; i <= segments; i++) {
            const tx = x1 + (x2 - x1) * (i / segments) + this.fastRandom() * jitter;
            const ty = y1 + (y2 - y1) * (i / segments) + this.fastRandom() * jitter;
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
