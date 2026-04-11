import type { Fish } from '../entities/Fish';
import type { GameContext, ElectrocuteEffect, CorrodeEffect } from './GameContext';
import type { EffectSystem } from './EffectSystem';
import { AssetManager } from '../AssetManager';

export type DamageApplier = (fish: Fish, dmg: number) => void;

export class StatusSystem {
    constructor(
        private ctx: GameContext,
        private effects: EffectSystem,
        private applyDamage: DamageApplier,
    ) { }

    update(delta: number): void {
        this.updateElectrocute(delta);
        this.updateCorrode(delta);
    }

    applyElectrocute(fish: Fish, baseHitDmg: number, sourceFish?: Fish): void {
        // 3秒持续电击：总DOT=命中伤害的60%，按0.25s跳一次（12跳）
        const totalFrames = 180;
        const ticks = 12;
        const totalDot = baseHitDmg * 0.6;
        const dmgPerTick = totalDot / ticks;

        const existing = this.ctx.electrified.find(e => e.fish === fish);
        if (existing) {
            existing.remainingFrames = Math.max(existing.remainingFrames, totalFrames);
            existing.dmgPerTick = Math.max(existing.dmgPerTick, dmgPerTick);
            existing.tickFrames = Math.min(existing.tickFrames, 15);
            return;
        }

        const e: ElectrocuteEffect = {
            fish,
            sourceFish,
            fallbackX: sourceFish?.x,
            fallbackY: sourceFish?.y,
            remainingFrames: totalFrames,
            tickFrames: 15,
            dmgPerTick,
            fxFrames: 0,
            sfxFrames: 0,
        };
        this.ctx.electrified.push(e);
    }

    applyCorrode(fish: Fish, baseHitDmg: number): void {
        // 4秒腐蚀：总DOT=命中伤害的80%，按0.5s跳一次（8跳）
        const totalFrames = 240;
        const ticks = 8;
        const totalDot = baseHitDmg * 0.8;
        const dmgPerTick = totalDot / ticks;

        const existing = this.ctx.corroded.find(e => e.fish === fish);
        if (existing) {
            existing.remainingFrames = Math.max(existing.remainingFrames, totalFrames);
            existing.dmgPerTick = Math.max(existing.dmgPerTick, dmgPerTick);
            existing.tickFrames = Math.min(existing.tickFrames, 30);
            return;
        }

        const e: CorrodeEffect = {
            fish,
            remainingFrames: totalFrames,
            tickFrames: 30,
            dmgPerTick,
            fxFrames: 0,
        };
        this.ctx.corroded.push(e);
    }

    private updateElectrocute(delta: number): void {
        if (this.ctx.electrified.length === 0) return;
        for (let i = this.ctx.electrified.length - 1; i >= 0; i--) {
            const e = this.ctx.electrified[i];
            if (!e.fish.isActive) { this.ctx.electrified.splice(i, 1); continue; }

            e.remainingFrames -= delta;
            e.tickFrames -= delta;
            e.fxFrames -= delta;
            e.sfxFrames -= delta;

            // 持续电流：不再在单个鱼身上一直闪电击效果，而是画出真正的分叉电流持续 3s
            for (let k = 0; e.fxFrames <= 0 && k < 1; k++) {
                e.fxFrames += 10; // ~6次/秒（即让闪电保持高速跳闪而不瞎眼）

                if (e.sourceFish) {
                    let sx = e.sourceFish.isActive ? e.sourceFish.x : (e.fallbackX || e.sourceFish.x);
                    let sy = e.sourceFish.isActive ? e.sourceFish.y : (e.fallbackY || e.sourceFish.y);
                    this.effects.spawnLightning(sx, sy, e.fish.x, e.fish.y, true);

                    if (e.sourceFish.isActive) {
                        e.fallbackX = sx;
                        e.fallbackY = sy;
                    }
                }
            }

            // 持续电流音：限频播放，避免爆音（AssetManager 内还有全局节流/降音量）
            for (let k = 0; e.sfxFrames <= 0 && k < 2; k++) {
                e.sfxFrames += 30; // ~0.5s一次
                AssetManager.playSound('lightning', 1, 0.18, true);
            }

            for (let k = 0; e.tickFrames <= 0 && k < 4; k++) {
                e.tickFrames += 15; // ~0.25s @60fps
                this.applyDamage(e.fish, e.dmgPerTick);
            }

            if (e.remainingFrames <= 0) this.ctx.electrified.splice(i, 1);
        }
    }

    private updateCorrode(delta: number): void {
        if (this.ctx.corroded.length === 0) return;
        for (let i = this.ctx.corroded.length - 1; i >= 0; i--) {
            const e = this.ctx.corroded[i];
            if (!e.fish.isActive) { this.ctx.corroded.splice(i, 1); continue; }

            e.remainingFrames -= delta;
            e.tickFrames -= delta;
            e.fxFrames -= delta;

            // 持续腐蚀视觉：绿色孢子粒子更密一些
            for (let k = 0; e.fxFrames <= 0 && k < 4; k++) {
                e.fxFrames += 6; // ~10次/秒
                this.effects.spawnParticles(e.fish.x, e.fish.y, 2, 0x66ff44, 4);
            }

            for (let k = 0; e.tickFrames <= 0 && k < 3; k++) {
                e.tickFrames += 30; // ~0.5s
                this.applyDamage(e.fish, e.dmgPerTick);
            }

            if (e.remainingFrames <= 0) this.ctx.corroded.splice(i, 1);
        }
    }
}

