import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import type { Cannon } from '../entities/Cannon';
import type { GameContext } from './GameContext';

export class InputSystem {
    private isDragging: boolean = false;

    constructor(
        private app: PIXI.Application,
        private cannon: Cannon,
        private isPaused: () => boolean,
        private ctx?: GameContext
    ) {}

    init(): void {
        // 仅战斗态拦截舞台空白区域；勿在 lobby 占用 stage 命中
        this.app.stage.eventMode = 'static';
        this.app.stage.interactiveChildren = true;
        this.app.stage.hitArea = new PIXI.Rectangle(-1000, -1000, 3000, 3000);

        const onMove = (e: PIXI.FederatedPointerEvent) => {
            if (this.isPaused()) return;
            const localPos = e.getLocalPosition(this.app.stage);
            this.cannon.lookAt(localPos.x, localPos.y);
            if (this.ctx) { this.ctx.manualAimX = localPos.x; this.ctx.manualAimY = localPos.y; }
        };

        this.app.stage.on('pointerdown', (e) => {
            if (this.isPaused()) return;
            AssetManager.unlockAudio();
            this.isDragging = true;
            if (this.ctx) this.ctx.isManualAiming = true;
            onMove(e);
        });
        this.app.stage.on('pointerup', () => {
            this.isDragging = false;
            if (this.ctx) this.ctx.isManualAiming = false;
        });
        this.app.stage.on('pointerupoutside', () => {
            this.isDragging = false;
            if (this.ctx) this.ctx.isManualAiming = false;
        });
        this.app.stage.on('pointercancel', () => {
            this.isDragging = false;
            if (this.ctx) this.ctx.isManualAiming = false;
        });
        this.app.stage.on('pointermove', (e) => {
            if (this.isPaused()) return;
            if (this.isDragging || e.buttons > 0 || e.pointerType === 'touch') onMove(e);
        });

        // 微信端触摸由 WxPixiTouch → Federated 事件驱动，与 UI 共用 stage 的 pointer 事件
    }
}
