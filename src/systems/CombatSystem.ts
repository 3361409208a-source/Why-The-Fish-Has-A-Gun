import { SceneManager } from '../SceneManager';
import { AssetManager } from '../AssetManager';
import { Fish } from '../entities/Fish';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { COMBO, AOE, CHAIN, ECONOMY } from '../config/balance.config';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';
import type { SpawnSystem } from './SpawnSystem';

export class CombatSystem {
    constructor(
        private ctx: GameContext,
        private effects: EffectSystem,
        private spawner: SpawnSystem
    ) {}

    checkCollisions(): void {
        for (const b of this.ctx.bullets) {
            if (!b.isActive) continue;
            for (const f of this.ctx.fishes) {
                if (!f.isActive) continue;
                const dx = b.x - f.x;
                const dy = b.y - f.y;
                const distSq = dx * dx + dy * dy;
                
                // 核心修正：使用“鱼身最小侧”（通常是高度，即厚度）的一半作为判定基础
                // 同时加入 0.6 的收缩系数，确保子弹必须“碰肉”才爆
                // 使用鱼类自带的物理判定半径，完美避开透明边框干扰
                const hitRadius = f.hitRadius;
                
                if (distSq < hitRadius * hitRadius) {
                    b.kill();
                    const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
                    const lvl = this.ctx.weaponLevels[id] || 1;
                    this.onHitEffect(id, f.x, f.y, lvl);

                    if (id === 'heavy') {
                        const rangeSq = Math.pow(AOE.baseRange + lvl * AOE.rangePerLevel, 2);
                        for (const target of this.ctx.fishes) {
                            if (!target.isActive) continue;
                            const tdx = target.x - b.x;
                            const tdy = target.y - b.y;
                            if (tdx * tdx + tdy * tdy < rangeSq) {
                                const dmgMult = (window as any).TalentDmgMult || 1.0;
                                this.applyDamage(target, b.damage * AOE.damageFalloff * dmgMult);
                            }
                        }
                    } else if (id === 'lightning') {
                        AssetManager.playSound('lightning', 1, 1);
                        const dmgMult = (window as any).TalentDmgMult || 1.0;
                        this.applyDamage(f, b.damage * dmgMult);
                        this.triggerChainLightning(f, CHAIN.baseTargets + lvl, b.damage * CHAIN.damageFalloff * dmgMult);
                    } else {
                        AssetManager.playSound('hit');
                        const dmgMult = (window as any).TalentDmgMult || 1.0;
                        this.applyDamage(f, b.damage * dmgMult);
                    }
                    break;
                }
            }
        }
    }

    private onHitEffect(id: string, x: number, y: number, lvl: number): void {
        this.effects.spawnHitFlash(x, y);
        switch (id) {
            case 'gatling':
                this.effects.spawnParticles(x, y, 6, 0xffff00, 4);
                break;
            case 'heavy':
                AssetManager.playSound('explosion');
                this.effects.spawnParticles(x, y, 18, 0xffaa00, 6);
                this.effects.spawnShockwave(x, y, 1.0 + lvl * 0.2);
                SceneManager.shake(10, 150);
                break;
            case 'lightning':
                this.effects.spawnParticles(x, y, 8, 0x00ffff, 5);
                break;
            default:
                this.effects.spawnParticles(x, y, 4, 0xffffff, 2);
        }
    }

    private triggerChainLightning(startFish: Fish, maxCount: number, dmg: number): void {
        let current = startFish;
        let count = 0;
        const hitSet = new Set<Fish>([startFish]);

        while (count < maxCount) {
            let next: Fish | null = null;
            let minDist = 300;
            for (const f of this.ctx.fishes) {
                if (!f.isActive || hitSet.has(f)) continue;
                const d = Math.sqrt(Math.pow(f.x - current.x, 2) + Math.pow(f.y - current.y, 2));
                if (d < minDist) { minDist = d; next = f; }
            }
            if (next) {
                this.effects.spawnLightning(current.x, current.y, next.x, next.y);
                AssetManager.playSound('lightning', 1, 3);
                this.applyDamage(next, dmg);
                hitSet.add(next);
                current = next;
                count++;
            } else break;
        }
    }

    applyDamage(fish: Fish, dmg: number): void {
        const comboBonus = 1 + Math.min(COMBO.maxDmgBonus, this.ctx.comboCount * COMBO.dmgBonusPerCombo);
        const critChance = (window as any).TalentCritChance || 0;
        let finalDmg = dmg * comboBonus;
        let isCrit = false;
        if (Math.random() < critChance) { finalDmg *= 3.0; isCrit = true; }

        const dmgText = `${Math.floor(finalDmg)}`;
        const dmgColor = isCrit ? 0xff3300 : (this.ctx.comboCount > 20 ? 0xffcc00 : 0xffffff);
        EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: fish.x, y: fish.y - fish.height / 2, text: dmgText, color: dmgColor, isCrit });

        const isDead = fish.takeDamage(finalDmg);
        if (isDead) {
            this.ctx.comboCount++;
            this.ctx.comboTimer = COMBO.timeoutFrames;
            EventBus.emit(GameEvents.UI_COMBO, { count: this.ctx.comboCount });

            const roll = Math.random();
            const goldMult = (window as any).TalentGoldMult || 1.0;
            const baseCrystal = (fish as any).isBoss
                ? ECONOMY.bossCrystal
                : (roll > ECONOMY.richDropChance ? ECONOMY.killCrystalRich : ECONOMY.killCrystalBase);
            const val = baseCrystal * 2 * this.ctx.rewardMultiplier * goldMult * (1 + this.ctx.comboCount * COMBO.goldBonusPerCombo);
            this.ctx.crystals += val;

            import('../SaveManager').then(({ SaveManager }) => {
                SaveManager.state.gold += Math.floor(val);
                SaveManager.save();
            });

            EventBus.emit(GameEvents.UI_HUD_UPDATE, { crystals: this.ctx.crystals });
            this.effects.spawnParticles(fish.x, fish.y, 20, 0xffffff, 8);
            this.effects.spawnParticles(fish.x, fish.y, 10, 0x00f0ff, 12);

            if (Math.random() < ECONOMY.nanoCoreDropChance) this.spawner.spawnNanoCore(fish.x, fish.y);
        }
    }
}
