import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager, Layers } from '../SceneManager';
import type { Cannon } from '../entities/Cannon';
import type { GameContext } from './GameContext';

export class InputSystem {
    private isDragging: boolean = false;
    private hitBg: PIXI.Graphics | null = null;
    private keys: { [key: string]: boolean } = {};
    private rotationSpeed: number = 0.05; // 键盘控制旋转速度 (弧度/帧)

    constructor(
        private app: PIXI.Application,
        private cannon: Cannon,
        private isPaused: () => boolean,
        private ctx?: GameContext
    ) { }

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

        // 键盘监听
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        this.app.ticker.add(this.update, this);
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        this.keys[e.key.toLowerCase()] = true;
    };

    private onKeyUp = (e: KeyboardEvent): void => {
        this.keys[e.key.toLowerCase()] = false;
    };

    private update(): void {
        if (this.isPaused()) return;

        let rotationDelta = 0;
        if (this.keys['a'] || this.keys['arrowleft']) {
            rotationDelta -= this.rotationSpeed;
        }
        if (this.keys['d'] || this.keys['arrowright']) {
            rotationDelta += this.rotationSpeed;
        }

        if (rotationDelta !== 0) {
            this.cannon.rotation += rotationDelta;
            // 限制旋转角度，防止炮管转到地面以下 (假设炮管向上，范围限制在约 -80度 到 80度)
            const maxRotation = Math.PI * 0.45;
            this.cannon.rotation = Math.max(-maxRotation, Math.min(maxRotation, this.cannon.rotation));

            // 同步更新 Context 中的瞄准位置，以便自动射击逻辑能跟上
            if (this.ctx) {
                this.ctx.isManualAiming = true;
                const muzzlePos = this.cannon.getMuzzlePosition();
                this.ctx.manualAimX = muzzlePos.x;
                this.ctx.manualAimY = muzzlePos.y;
            }
        }
    }

    destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        this.app.ticker.remove(this.update, this);
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
