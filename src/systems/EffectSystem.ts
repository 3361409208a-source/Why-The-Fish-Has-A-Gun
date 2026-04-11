import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from '../SceneManager';
import { Particle } from '../entities/Particle';
import { Shockwave } from '../entities/Shockwave';
import { Lightning } from '../entities/Lightning';
import type { GameContext } from './GameContext';

export class EffectSystem {
    constructor(private ctx: GameContext) { }

    spawnParticles(x: number, y: number, count: number, color: number, intensity: number): void {
        for (let i = 0; i < count; i++) {
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
            SceneManager.getLayer(Layers.FX).addChild(l);
            this.ctx.lightnings.push(l);
        }
    }

    spawnHitFlash(x: number, y: number): void {
        const flash = new PIXI.Graphics();
        flash.lineStyle(3, 0xffffff, 0.9);
        flash.drawCircle(0, 0, 1);
        flash.x = x;
        flash.y = y;
        SceneManager.getLayer(Layers.FX).addChild(flash);

        let r = 1;
        let alpha = 0.9;
        const tick = () => {
            r += 6;
            alpha -= 0.12;
            flash.clear();
            flash.lineStyle(3, 0xffffff, alpha);
            flash.drawCircle(0, 0, r);
            if (alpha > 0) {
                requestAnimationFrame(tick);
            } else {
                SceneManager.getLayer(Layers.FX).removeChild(flash);
            }
        };
        tick();
    }
}
