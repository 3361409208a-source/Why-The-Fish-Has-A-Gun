import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager } from '../SceneManager';

/**
 * [优化] NanoCore
 * - 使用 SceneManager.width/height 替代 window.innerWidth/innerHeight
 * - P2: 生命周期上限 600 帧，超时淡出回收；场景数量上限 30
 */
export class NanoCore extends PIXI.Sprite {
    public isActive: boolean = false;
    public value: number = 1;
    private timer: number = 0;
    private startY: number = 0;
    private isGolden: boolean = false;
    // [优化 P2] 生命周期计时器和上限
    private lifeFrames: number = 0;
    public static readonly MAX_LIFE_FRAMES = 600;
    public static readonly MAX_SCENE_COUNT = 30;

    constructor() {
        super(AssetManager.textures['item_core']);
        this.anchor.set(0.5);
        this.eventMode = 'static';
    }

    public spawn(x: number, y: number, isGolden: boolean = false): void {
        this.x = x;
        this.y = y;
        this.startY = y;
        this.timer = 0;
        this.lifeFrames = 0;
        this.isActive = true;
        this.visible = true;
        this.alpha = 1;
        this.isGolden = isGolden;

        if (isGolden) {
            this.tint = 0xffd700;
            this.scale.set(2.0);
            this.value = 10;
        } else {
            this.tint = 0xffffff;
            this.scale.set(1.0);
            this.value = 1;
        }
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        // [优化 P2] 生命周期上限检查：超时后淡出回收
        this.lifeFrames += delta;
        if (this.lifeFrames > NanoCore.MAX_LIFE_FRAMES) {
            this.alpha -= 0.05 * delta;
            if (this.alpha <= 0) { this.kill(); return; }
        }

        // [优化] 使用 SceneManager 的设计分辨率而非 window
        const targetX = SceneManager.width / 2;
        const targetY = SceneManager.height;
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < 100) { // 10*10 = 100，避免 sqrt
            this.kill();
        } else {
            const dist = Math.sqrt(distSq);
            const speed = 0.05 + (1 / dist) * 10;
            this.x += dx * speed * delta;
            this.y += dy * speed * delta;
            this.rotation += 0.1 * delta;
        }

        this.timer += delta * 0.016; // 大约 60fps 下的秒数
        const breathScale = (this.isGolden ? 2.0 : 1.0) * (1 + Math.sin(this.timer * 2) * 0.1);
        this.scale.set(breathScale);

        if (this.y > SceneManager.height + 50) {
            this.kill();
        }
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
