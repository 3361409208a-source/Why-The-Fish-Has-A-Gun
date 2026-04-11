import type { Fish } from '../entities/Fish';
import type { GameContext } from './GameContext';
import { AOE } from '../config/balance.config';
import type { StatusSystem } from './StatusSystem';

export type DamageApplier = (fish: Fish, dmg: number) => void;

/**
 * AttackSystem — 命中处理器
 * 将“某武器命中后产生的额外效果”（AOE/穿透/控制/状态等）从 CombatSystem 中抽离。
 */
export class AttackSystem {
    constructor(
        private ctx: GameContext,
        private applyDamage: DamageApplier,
        private status: StatusSystem,
    ) { }

    onDirectHit(params: {
        weaponId: string;
        level: number;
        bulletX: number;
        bulletY: number;
        baseDamage: number;
        dmgMult: number;
    }): void {
        const { weaponId, level, bulletX, bulletY, baseDamage, dmgMult } = params;

        // heavy：原子爆破 AOE
        if (weaponId === 'heavy') {
            const range = AOE.baseRange + level * AOE.rangePerLevel;
            const rangeSq = range * range;
            const coreRangeSq = Math.pow(range * 0.35, 2); // 核心探测区：爆炸半径的前35%

            for (const t of this.ctx.fishes) {
                if (!t.isActive) continue;
                const dx = t.x - bulletX;
                const dy = t.y - bulletY;
                const distSq = dx * dx + dy * dy;

                if (distSq < rangeSq) {
                    // 核心区域伤害倍率：200%，边缘：70% (AOE.damageFalloff)
                    const isCore = distSq < coreRangeSq;
                    const finalMult = isCore ? 2.0 : AOE.damageFalloff;

                    this.applyDamage(t, baseDamage * finalMult * dmgMult);
                    // 只要在爆炸范围内的鱼，都会被核辐射致残
                    this.status.applyRadiation(t, baseDamage * dmgMult);
                }
            }
        }

        // acid：孢子覆盖（范围挂腐蚀状态）
        if (weaponId === 'acid') {
            const range = 220 + level * 25;
            const rangeSq = range * range;
            for (const t of this.ctx.fishes) {
                if (!t.isActive) continue;
                const dx = t.x - bulletX;
                const dy = t.y - bulletY;
                if (dx * dx + dy * dy < rangeSq) {
                    this.status.applyCorrode(t, baseDamage * dmgMult);
                }
            }
        }
    }
}

