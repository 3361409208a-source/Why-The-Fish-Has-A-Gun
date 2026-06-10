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
 */
export class EffectSystem {
    // [优化] 粒子数量软上限
    private static readonly MAX_PARTICLES = 300;
    // [优化] hitFlash 对象池
    private hitFlashPool: PIXI.Graphics[] = [];
    private static readonly MAX_HIT_FLASHES = 20;

    constructor(private ctx: GameContext) { }

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
     * 原版每次都 new PIXI.Graphics() 并用 requestAnimationFrame，在高频战斗中
     * 会创建大量独立动画循环且不受游戏暂停控制
     */
    spawnHitFlash(x: number, y: number): void {
        if (this.hitFlashPool.length >= EffectSystem.MAX_HIT_FLASHES) return;

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
}
