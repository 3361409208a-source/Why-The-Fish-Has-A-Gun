import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from '../SceneManager';
import { Particle } from '../entities/Particle';
import { Shockwave } from '../entities/Shockwave';
import { Lightning } from '../entities/Lightning';
import type { GameContext } from './GameContext';

/**
 * [优化] EffectSystem
 * - spawnHitFlash 改用 PIXI Ticker 而非 requestAnimationFrame
 * - 添加粒子数量上限防止特效爆炸
 * - hitFlash 对象复用 Graphics 而非每次创建新的
 * - P0: 闪烁池上限提升至 40 + 溢出队列分帧执行
 * - P0: AOE 批量闪烁 Overlay（1 个 Draw Call 替代 N 个 Graphics）
 */
export class EffectSystem {
    // [优化] 粒子数量软上限
    private static readonly MAX_PARTICLES = 300;
    // [优化 P0] hitFlash 对象池扩容 20 → 40
    private hitFlashPool: PIXI.Graphics[] = [];
    private static readonly MAX_HIT_FLASHES = 40;
    // [优化 P0] 闪烁溢出队列（AOE 同帧命中过多时分帧延迟）
    private flashQueue: Array<{ x: number; y: number }> = [];
    private static readonly FLASH_QUEUE_MAX = 20;

    // [优化 P0] AOE 批量闪烁 Overlay
    private aoeOverlay: PIXI.Graphics | null = null;
    private aoeOverlayAlpha: number = 0;
    private aoeOverlayActive: boolean = false;

    constructor(private ctx: GameContext) {
        this.initAoeOverlay();
    }

    /** 初始化 AOE 全屏闪白 Overlay */
    private initAoeOverlay(): void {
        this.aoeOverlay = new PIXI.Graphics();
        this.aoeOverlay.beginFill(0xffffff, 1);
        this.aoeOverlay.drawRect(0, 0, 1920, 1080);
        this.aoeOverlay.endFill();
        this.aoeOverlay.alpha = 0;
        this.aoeOverlay.visible = false;
        this.aoeOverlay.blendMode = PIXI.BLEND_MODES.ADD;
        // 添加到 FX 层最顶部
        SceneManager.getLayer(Layers.FX).addChild(this.aoeOverlay);
    }

    /**
     * [优化 P0] 触发 AOE 批量闪烁
     * 用 1 个全屏闪白 Overlay 代替逐鱼闪烁，1 Draw Call 替代 N 个 Graphics
     */
    public spawnAoeFlash(): void {
        if (!this.aoeOverlay) return;
        this.aoeOverlay.visible = true;
        this.aoeOverlayAlpha = 0.3;
        this.aoeOverlay.alpha = this.aoeOverlayAlpha;
        this.aoeOverlayActive = true;
    }

    spawnParticles(x: number, y: number, count: number, color: number, intensity: number): void {
        // [优化] 粒子数量上限检查
        if (this.ctx.particles.length >= EffectSystem.MAX_PARTICLES) return;
        const actualCount = Math.min(count, EffectSystem.MAX_PARTICLES - this.ctx.particles.length);

        for (let i = 0; i < actualCount; i++) {
            const p = this.ctx.pool.get('particle', () => new Particle());
            if (p) {
                p.spawn(x, y, color, intensity);
                SceneManager.getLayer(Layers.FX).addChild(p);
                this.ctx.particles.push(p);
            }
        }
    }

    spawnShockwave(x: number, y: number, scale: number): void {
        const s = this.ctx.pool.get('shockwave', () => new Shockwave());
        if (s) {
            s.spawn(x, y, scale);
            SceneManager.getLayer(Layers.FX).addChild(s);
            this.ctx.shockwaves.push(s);
        }
    }

    spawnLightning(x1: number, y1: number, x2: number, y2: number, isSub: boolean = false): void {
        const l = this.ctx.pool.get('lightning', () => new Lightning());
        if (l) {
            l.spawn(x1, y1, x2, y2, isSub);
            SceneManager.getLayer(Layers.Game).addChild(l);
            this.ctx.lightnings.push(l);
        }
    }

    /**
     * [优化] spawnHitFlash - 使用对象池 + PIXI Ticker 替代 requestAnimationFrame
     * P0: 池满时入溢出队列，分帧延迟执行
     */
    spawnHitFlash(x: number, y: number): void {
        if (this.hitFlashPool.length >= EffectSystem.MAX_HIT_FLASHES) {
            // [优化 P0] 溢出队列：同帧大量请求入队，分散到后几帧执行
            if (this.flashQueue.length < EffectSystem.FLASH_QUEUE_MAX) {
                this.flashQueue.push({ x, y });
            }
            return;
        }

        let flash: PIXI.Graphics;
        if (this.hitFlashPool.length > 0) {
            flash = this.hitFlashPool.pop()!;
        } else {
            flash = new PIXI.Graphics();
        }

        flash.clear();
        flash.lineStyle(3, 0xffffff, 0.9);
        flash.drawCircle(0, 0, 1);
        flash.x = x;
        flash.y = y;
        flash.visible = true;
        flash.alpha = 1;
        SceneManager.getLayer(Layers.FX).addChild(flash);

        let r = 1;
        let alpha = 0.9;
        const fxLayer = SceneManager.getLayer(Layers.FX);
        const pool = this.hitFlashPool;

        // [优化] 使用 PIXI Ticker 替代 requestAnimationFrame
        const tickHandler = (delta: number) => {
            r += 6 * delta;
            alpha -= 0.12 * delta;
            if (alpha <= 0) {
                this.ctx.app.ticker.remove(tickHandler);
                flash.clear();
                flash.visible = false;
                if (flash.parent) fxLayer.removeChild(flash);
                pool.push(flash);
                return;
            }
            flash.clear();
            flash.lineStyle(3, 0xffffff, alpha);
            flash.drawCircle(0, 0, r);
        };
        this.ctx.app.ticker.add(tickHandler);
    }

    /**
     * [优化 P0] 每帧更新：AOE overlay 淡出 + 闪烁溢出队列排空
     * 由 GameController.update() 调用
     */
    public update(delta: number): void {
        // AOE Overlay 淡出
        if (this.aoeOverlayActive && this.aoeOverlay) {
            this.aoeOverlayAlpha -= 0.06 * delta;
            if (this.aoeOverlayAlpha <= 0) {
                this.aoeOverlayAlpha = 0;
                this.aoeOverlay.alpha = 0;
                this.aoeOverlay.visible = false;
                this.aoeOverlayActive = false;
            } else {
                this.aoeOverlay.alpha = this.aoeOverlayAlpha;
            }
        }

        // 闪烁溢出队列：每帧最多排空 3 个
        const drainCount = Math.min(3, this.flashQueue.length);
        for (let i = 0; i < drainCount; i++) {
            const req = this.flashQueue.shift()!;
            this.spawnHitFlash(req.x, req.y);
        }
    }
}
