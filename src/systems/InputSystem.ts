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
        this.app.stage.eventMode = 'static';
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

        if (typeof (window as any).wx !== 'undefined' && typeof (window as any).wx.onTouchMove === 'function') {
            const wx = (window as any).wx;
            wx.onTouchStart((res: any) => {
                if (this.isPaused()) return;
                AssetManager.unlockAudio();
                this.isDragging = true;
                if (res.touches?.length > 0) {
                    const t = res.touches[0];
                    this.cannon.lookAt(
                        this.app.stage.toLocal(new PIXI.Point(t.clientX, t.clientY)).x,
                        this.app.stage.toLocal(new PIXI.Point(t.clientX, t.clientY)).y
                    );
                }
            });
            wx.onTouchMove((res: any) => {
                if (this.isPaused() || !this.isDragging) return;
                if (res.touches?.length > 0) {
                    const t = res.touches[0];
                    const pos = this.app.stage.toLocal(new PIXI.Point(t.clientX, t.clientY));
                    this.cannon.lookAt(pos.x, pos.y);
                }
            });
            wx.onTouchEnd(() => { this.isDragging = false; if (this.ctx) this.ctx.isManualAiming = false; });
            wx.onTouchCancel(() => { this.isDragging = false; if (this.ctx) this.ctx.isManualAiming = false; });
        }
    }
}
