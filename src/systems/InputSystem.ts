import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager, Layers } from '../SceneManager';
import type { Cannon } from '../entities/Cannon';
import type { GameContext } from './GameContext';

export class InputSystem {
    private isDragging: boolean = false;
    private hitBg: PIXI.Graphics | null = null;

    constructor(
        private app: PIXI.Application,
        private cannon: Cannon,
        private isPaused: () => boolean,
        private ctx?: GameContext
    ) {}

    init(): void {
        // 创建一个全屏底层的透明交互拦截层，只在空白区域触发瞄准
        this.hitBg = new PIXI.Graphics();
        this.hitBg.beginFill(0x000000, 0.0001); // 极低透明度保留交互感应
        this.hitBg.drawRect(-1000, -1000, 3000, 3000); // 覆盖整个视口
        this.hitBg.endFill();
        this.hitBg.eventMode = 'static';
        this.hitBg.cursor = 'default';

        const bgLayer = SceneManager.getLayer(Layers.Background);
        bgLayer.addChild(this.hitBg);

        const onMove = (e: PIXI.FederatedPointerEvent) => {
            if (this.isPaused()) return;
            const localPos = e.getLocalPosition(this.app.stage);
            this.cannon.lookAt(localPos.x, localPos.y);
            if (this.ctx) { this.ctx.manualAimX = localPos.x; this.ctx.manualAimY = localPos.y; }
        };

        this.hitBg.on('pointerdown', (e) => {
            if (this.isPaused()) return;
            AssetManager.unlockAudio();
            this.isDragging = true;
            if (this.ctx) this.ctx.isManualAiming = true;
            onMove(e);
        });
        this.hitBg.on('pointerup', () => {
            this.isDragging = false;
            if (this.ctx) this.ctx.isManualAiming = false;
        });
        this.hitBg.on('pointerupoutside', () => {
            this.isDragging = false;
            if (this.ctx) this.ctx.isManualAiming = false;
        });
        this.hitBg.on('pointercancel', () => {
            this.isDragging = false;
            if (this.ctx) this.ctx.isManualAiming = false;
        });
        this.hitBg.on('pointermove', (e) => {
            if (this.isPaused()) return;
            if (this.isDragging || e.buttons > 0 || e.pointerType === 'touch') onMove(e);
        });
    }

    destroy(): void {
        if (this.hitBg) {
            this.hitBg.off('pointerdown');
            this.hitBg.off('pointerup');
            this.hitBg.off('pointerupoutside');
            this.hitBg.off('pointercancel');
            this.hitBg.off('pointermove');
            if (this.hitBg.parent) {
                this.hitBg.parent.removeChild(this.hitBg);
            }
            this.hitBg.destroy();
            this.hitBg = null;
        }
    }
}
