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
    ) {}

    update(delta: number): void {
        this.updateElectrocute(delta);
        this.updateCorrode(delta);
    }

    applyElectrocute(fish: Fish, baseHitDmg: number): void {
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

            // 持续电流：在3秒内持续生成电弧/粒子（比掉血跳数更密）
            for (let k = 0; e.fxFrames <= 0 && k < 6; k++) {
                e.fxFrames += 3; // ~20次/秒
                const fxX = e.fish.x;
                const fxY = e.fish.y;
                const jx = (Math.random() - 0.5) * 110;
                const jy = (Math.random() - 0.5) * 80;
                this.effects.spawnLightning(fxX + jx, fxY + jy, fxX - jx, fxY - jy);
                this.effects.spawnParticles(fxX, fxY, 1, 0x88eeff, 3);
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

