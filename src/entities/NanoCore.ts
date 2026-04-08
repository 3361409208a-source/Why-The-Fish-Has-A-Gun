import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class NanoCore extends PIXI.Sprite {
    public isActive: boolean = false;
    public value: number = 1;
    private timer: number = 0;
    private startY: number = 0;
    private isGolden: boolean = false;

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
        this.isActive = true;
        this.visible = true;
        this.isGolden = isGolden;
        
        if (isGolden) {
            this.tint = 0xffd700; // 金色
            this.scale.set(2.0);
            this.value = 10;
        } else {
            this.tint = 0xffffff; // 原始色 (绿)
            this.scale.set(1.0);
            this.value = 1;
        }
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        // 磁性自动吸引：向屏幕正下方中央（炮台位置）移动
        const targetX = window.innerWidth / 2;
        const targetY = window.innerHeight;
        
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
            // 到达回收点
            this.kill();
            // 在 GameController 中会检查 isActive 并增加分数
        } else {
            // 越近越快
            const speed = 0.05 + (1 / dist) * 10;
            this.x += dx * speed * delta;
            this.y += dy * speed * delta;
            
            // 简单的旋转动画
            this.rotation += 0.1 * delta;
        }
        
        // 呼吸效果
        this.scale.set(1 + Math.sin(this.timer * 2) * 0.1);

        if (this.y > window.innerHeight + 50) {
            this.kill();
        }
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
