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
                // 主电弧现在由 Bullet.ts 内部每帧动态绘制并绑定武器坐标，不再生成脱离的附着特效
                // this.effects.spawnLightning(b.originX, b.originY, target.x, target.y);
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
                // 核能爆燃：超大粒子簇
                this.effects.spawnParticles(x, y, 40, 0xffdf00, 10); // 亮黄核心
                this.effects.spawnParticles(x, y, 25, 0xff5500, 8);  // 橙红火光
                this.effects.spawnParticles(x, y, 20, 0x00ff00, 12); // 核能绿光
                // 多重冲击波叠加
                this.effects.spawnShockwave(x, y, 2.5 + lvl * 0.5);
                // setTimeout(() => this.effects.spawnShockwave(x, y, 1.2 + lvl * 0.3), 100);
                // 剧烈震屏已根据用户要求移除
                break;
            case 'lightning':
                this.effects.spawnParticles(x, y, 8, 0x00ffff, 5);
                break;
            default:
                this.effects.spawnParticles(x, y, 4, 0xffffff, 2);
        }
    }

    private triggerChainLightning(startFish: Fish, maxCount: number, baseDmg: number): void {
        const branchDmg = baseDmg * CHAIN.damageFalloff;

        let candidates: { fish: Fish; dist: number }[] = [];
        for (const f of this.ctx.fishes) {
            if (!f.isActive || f === startFish) continue;
            const distSq = Math.pow(f.x - startFish.x, 2) + Math.pow(f.y - startFish.y, 2);
            if (distSq <= CHAIN.chainRange * CHAIN.chainRange) {
                candidates.push({ fish: f, dist: distSq });
            }
        }

        // 排序找到最近的 maxCount 个单位直接分支电击
        candidates.sort((a, b) => a.dist - b.dist);
        const targets = candidates.slice(0, maxCount);

        for (const t of targets) {
            // 一次性的瞬间受击，后续 3秒的连线效果交给 StatusSystem 处理
            this.effects.spawnLightning(startFish.x, startFish.y, t.fish.x, t.fish.y, true);
            this.applyDamage(t.fish, branchDmg);
            this.status.applyElectrocute(t.fish, branchDmg, startFish);
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
