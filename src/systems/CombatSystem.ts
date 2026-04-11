import { SceneManager } from '../SceneManager';
import { AssetManager } from '../AssetManager';
import { Fish } from '../entities/Fish';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { COMBO, CHAIN, ECONOMY } from '../config/balance.config';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';
import type { SpawnSystem } from './SpawnSystem';
import type { StatusSystem } from './StatusSystem';
import type { AttackSystem } from './AttackSystem';

type DamageOptions = {
    allowCrit?: boolean;
    allowComboOnKill?: boolean;
    showText?: boolean;
};

export class CombatSystem {
    constructor(
        private ctx: GameContext,
        private effects: EffectSystem,
        private spawner: SpawnSystem,
        private status: StatusSystem,
        private attacks: AttackSystem,
    ) { }

    checkCollisions(delta: number): void {
        for (const b of this.ctx.bullets) {
            if (!b.isActive) continue;

            // ── 闪电武器：直接击中锁定的主目标，再由连锁跳到其他鱼 ──
            if (b.weaponType === 'lightning') {
                if (b.hasHit) continue; // 本周期已命中，轨道继续播完
                const target = b.targetFish;
                if (!target || !target.isActive) continue; // 目标不存在或已死
                b.hasHit = true;
                const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
                const lvl = this.ctx.weaponLevels[id] || 1;
                // 从炮台轨道中心射出主电弧到目标鱼
                this.effects.spawnLightning(b.x, b.y, target.x, target.y);
                this.onHitEffect(id, target.x, target.y, lvl);
                const dmgMult = (window as any).TalentDmgMult || 1.0;
                const hitDmg = b.damage * dmgMult;
                this.applyDamage(target, hitDmg);
                this.status.applyElectrocute(target, hitDmg);
                this.triggerChainLightning(target, CHAIN.baseTargets + lvl, hitDmg);
                continue;
            }

            // ── 普通武器：飞行碰撞检测 ──
            for (const f of this.ctx.fishes) {
                if (!f.isActive) continue;
                const dx = b.x - f.x;
                const dy = b.y - f.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < f.hitRadius * f.hitRadius) {
                    b.kill();
                    const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
                    const lvl = this.ctx.weaponLevels[id] || 1;
                    this.onHitEffect(id, f.x, f.y, lvl);

                    if (id !== 'heavy') AssetManager.playSound('hit');
                    const dmgMult = (window as any).TalentDmgMult || 1.0;
                    this.applyDamage(f, b.damage * dmgMult);
                    this.attacks.onDirectHit({
                        weaponId: id,
                        level: lvl,
                        bulletX: b.x,
                        bulletY: b.y,
                        baseDamage: b.damage,
                        dmgMult,
                    });
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

    private triggerChainLightning(startFish: Fish, maxCount: number, baseDmg: number): void {
        let current = startFish;
        let count = 0;
        const hitSet = new Set<Fish>([startFish]);
        let currentDmg = baseDmg * CHAIN.damageFalloff;

        while (count < maxCount) {
            let next: Fish | null = null;
            let minDist = CHAIN.chainRange;
            for (const f of this.ctx.fishes) {
                if (!f.isActive || hitSet.has(f)) continue;
                const d = Math.sqrt(Math.pow(f.x - current.x, 2) + Math.pow(f.y - current.y, 2));
                if (d < minDist) { minDist = d; next = f; }
            }
            if (next) {
                this.effects.spawnLightning(current.x, current.y, next.x, next.y, true);
                this.applyDamage(next, currentDmg);
                this.status.applyElectrocute(next, currentDmg);
                hitSet.add(next);
                current = next;
                count++;
                currentDmg *= CHAIN.damageFalloff;
            } else break;
        }
    }

    applyDamage(fish: Fish, dmg: number, opts: DamageOptions = {}): void {
        const allowCrit = opts.allowCrit ?? true;
        const allowComboOnKill = opts.allowComboOnKill ?? true;
        const showText = opts.showText ?? true;

        const comboBonus = 1 + Math.min(COMBO.maxDmgBonus, this.ctx.comboCount * COMBO.dmgBonusPerCombo);
        const critChance = allowCrit ? ((window as any).TalentCritChance || 0) : 0;
        let finalDmg = dmg * comboBonus;
        let isCrit = false;
        if (Math.random() < critChance) { finalDmg *= 3.0; isCrit = true; }

        if (showText) {
            const dmgText = `${Math.floor(finalDmg)}`;
            const dmgColor = isCrit ? 0xff3300 : (this.ctx.comboCount > 20 ? 0xffcc00 : 0xffffff);
            EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: fish.x, y: fish.y - fish.height / 2, text: dmgText, color: dmgColor, isCrit });
        }

        const isDead = fish.takeDamage(finalDmg);
        if (isDead) {
            if (allowComboOnKill) {
                this.ctx.comboCount++;
                this.ctx.comboTimer = COMBO.timeoutFrames;
                EventBus.emit(GameEvents.UI_COMBO, { count: this.ctx.comboCount });
            }

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
