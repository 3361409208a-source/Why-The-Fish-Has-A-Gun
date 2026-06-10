import { SceneManager, Layers } from '../SceneManager';
import { AssetManager } from '../AssetManager';
import { Fish } from '../entities/Fish';
import { Bullet } from '../entities/Bullet';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { COMBO, CHAIN, ECONOMY, AOE, TALENT } from '../config/balance.config';
import { getSkillEffect, getSkillLevel } from '../config/skilltree.config';
import { SaveManager } from '../SaveManager';
import { LEVELS_PER_AREA, getLayerAreaLevels } from '../config/levels.config';
import { Bullet as BulletEntity } from '../entities/Bullet';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';
import type { SpawnSystem } from '../systems/SpawnSystem';
import type { StatusSystem } from '../systems/StatusSystem';
import type { AttackSystem } from '../systems/AttackSystem';

type DamageOptions = {
    allowCrit?: boolean;
    allowComboOnKill?: boolean;
    showText?: boolean;
};

/**
 * [优化] CombatSystem
 * - 移除 applyDamage 中的动态 import()，改为静态导入（#1 性能杀手）
 * - 碰撞检测使用距离平方避免 Math.sqrt
 * - 缓存 TalentDmgMult 到 ctx 避免每帧读 window
 * - 击杀时 SaveManager.save() 改为防抖
 */
export class CombatSystem {
    private splitCooldown: number = 0;
    private static readonly SPLIT_COOLDOWN_FRAMES = 15;
    private static readonly MAX_SPLIT_BULLETS = 30;
    private static readonly MAX_TOTAL_BULLETS = 200;

    // [优化] 防抖 save
    private saveDebounceTimer: number = 0;
    private static readonly SAVE_DEBOUNCE = 60; // 每秒最多存一次

    constructor(
        private ctx: GameContext,
        private effects: EffectSystem,
        private spawner: SpawnSystem,
        private status: StatusSystem,
        private attacks: AttackSystem,
    ) {}

    /** [优化] 每帧调用，递减 save 防抖计时器 */
    update(delta: number): void {
        if (this.saveDebounceTimer > 0) {
            this.saveDebounceTimer -= delta;
        }
    }

    checkCollisions(delta: number): void {
        if (this.splitCooldown > 0) this.splitCooldown -= delta;

        // [优化] 缓存到局部变量，避免每颗子弹都查 window
        const talentDmgMult = this.ctx._cachedTalentDmgMult || 1.0;

        const bullets = this.ctx.bullets;
        const fishes = this.ctx.fishes;

        for (let bi = bullets.length - 1; bi >= 0; bi--) {
            const b = bullets[bi];
            if (!b.isActive) continue;

            // 闪电弹特殊处理
            if (b.weaponType === 'lightning') {
                if (b.hasHit) continue;
                const target = b.targetFish;
                if (!target || !target.isActive) continue;
                b.hasHit = true;
                const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
                const lvl = this.ctx.weaponLevels[id] || 1;
                this.onHitEffect(id, target.x, target.y, lvl);
                const hitDmg = b.damage * talentDmgMult;
                this.applyDamage(target, hitDmg);
                this.status.applyElectrocute(target, hitDmg);
                this.triggerChainLightning(target, CHAIN.baseTargets + lvl, hitDmg);
                continue;
            }

            // [优化] 普通子弹碰撞 - 使用距离平方
            const pierceCount = b.isSplitBullet ? 0 : getSkillEffect('pierce');
            let pierced = 0;
            const bx = b.x, by = b.y;

            for (let fi = fishes.length - 1; fi >= 0; fi--) {
                const f = fishes[fi];
                if (!f.isActive) continue;
                if (b.hitFishList && b.hitFishList.length > 0 && b.hitFishList.includes(f)) continue;

                // [优化] 先做快速 AABB 排除再做精确圆检测
                const dx = bx - f.x;
                const dy = by - f.y;
                const hitR = f.hitRadius;
                // 快速 AABB 排除：如果任意轴距离 > hitRadius，跳过
                if (dx > hitR || dx < -hitR || dy > hitR || dy < -hitR) continue;
                const distSq = dx * dx + dy * dy;
                if (distSq >= hitR * hitR) continue;

                // 命中
                const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
                const lvl = this.ctx.weaponLevels[id] || 1;
                this.onHitEffect(id, f.x, f.y, lvl);

                if (id !== 'heavy') AssetManager.playSound('hit');
                this.applyDamage(f, b.damage * talentDmgMult);
                this.attacks.onDirectHit({
                    weaponId: id,
                    level: lvl,
                    bulletX: bx,
                    bulletY: by,
                    baseDamage: b.damage,
                    dmgMult: talentDmgMult,
                });

                const splitLevel = getSkillLevel('split');
                if (splitLevel > 0 && !b.isSplitBullet && this.splitCooldown <= 0) {
                    const splitCount = bullets.filter(blb => blb.isSplitBullet).length;
                    if (splitCount < CombatSystem.MAX_SPLIT_BULLETS && bullets.length < CombatSystem.MAX_TOTAL_BULLETS) {
                        this.spawnSplitBullets(b, f, splitLevel);
                        this.splitCooldown = CombatSystem.SPLIT_COOLDOWN_FRAMES;
                    }
                }

                if (pierced < pierceCount) {
                    pierced++;
                    if (!b.hitFishList) b.hitFishList = [];
                    b.hitFishList.push(f);
                    continue;
                }

                b.kill();
                break;
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
                this.effects.spawnParticles(x, y, 40, 0xffdf00, 10);
                this.effects.spawnParticles(x, y, 25, 0xff5500, 8);
                this.effects.spawnParticles(x, y, 20, 0x00ff00, 12);
                this.effects.spawnShockwave(x, y, 2.5 + lvl * 0.5);
                break;
            case 'lightning':
                this.effects.spawnParticles(x, y, 8, 0x00ffff, 5);
                break;
            default:
                this.effects.spawnParticles(x, y, 4, 0xffffff, 2);
        }
    }

    private triggerChainLightning(startFish: Fish, maxCount: number, baseDmg: number): void {
        const chainBoost = getSkillEffect('chainBoost');
        const totalTargets = maxCount + chainBoost;
        const branchDmg = baseDmg * CHAIN.damageFalloff;
        const chainRangeSq = CHAIN.chainRange * CHAIN.chainRange;

        // [优化] 避免创建临时对象数组，直接用内联比较
        const fishes = this.ctx.fishes;
        const candidates: { fish: Fish; distSq: number }[] = [];
        for (let i = fishes.length - 1; i >= 0; i--) {
            const f = fishes[i];
            if (!f.isActive || f === startFish) continue;
            const dx = f.x - startFish.x;
            const dy = f.y - startFish.y;
            const distSq = dx * dx + dy * dy;
            if (distSq <= chainRangeSq) {
                candidates.push({ fish: f, distSq });
            }
        }

        candidates.sort((a, b) => a.distSq - b.distSq);
        const targets = candidates.slice(0, totalTargets);

        for (const t of targets) {
            this.effects.spawnLightning(startFish.x, startFish.y, t.fish.x, t.fish.y, true);
            this.applyDamage(t.fish, branchDmg);
            this.status.applyElectrocute(t.fish, branchDmg, startFish);
        }
    }

    private spawnSplitBullets(parentBullet: Bullet, hitFish: Fish, splitLevel: number): void {
        const splitDmgMult = 0.3 + splitLevel * 0.15;
        const angles = [parentBullet.rotation - 0.4, parentBullet.rotation + 0.4];
        const talentDmgMult = this.ctx._cachedTalentDmgMult || 1.0;

        for (const angle of angles) {
            const sb = this.ctx.pool.get('bullet', () => new BulletEntity());
            if (!sb) continue;
            const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
            const lvl = this.ctx.weaponLevels[id] || 1;
            sb.setType(id, lvl, talentDmgMult, 1.0);
            sb.damage *= splitDmgMult;
            sb.isSplitBullet = true;
            sb.fire(hitFish.x, hitFish.y, angle - Math.PI / 2);

            // [优化] 寻找最近的鱼作为追踪目标
            let nearestDist = Infinity;
            let nearestFish: Fish | null = null;
            const fishes = this.ctx.fishes;
            for (let i = fishes.length - 1; i >= 0; i--) {
                const f = fishes[i];
                if (!f.isActive || f === hitFish) continue;
                const dx = f.x - hitFish.x;
                const dy = f.y - hitFish.y;
                const d = dx * dx + dy * dy;
                if (d < nearestDist) { nearestDist = d; nearestFish = f; }
            }
            sb.homingTarget = nearestFish;
            SceneManager.getLayer(Layers.Bullet).addChild(sb);
            this.ctx.bullets.push(sb);
        }
    }

    /**
     * [优化] applyDamage - 移除了所有动态 import()
     * 原版每次击杀鱼都会调用 import('../config/levels.config') 和 import('../SaveManager')
     * 这在高频战斗中每帧可能触发数十次动态模块加载，是 #1 性能杀手
     */
    applyDamage(fish: Fish, dmg: number, opts: DamageOptions = {}): void {
        const allowCrit = opts.allowCrit ?? true;
        const allowComboOnKill = opts.allowComboOnKill ?? true;
        const showText = opts.showText ?? true;

        const comboBonus = 1 + Math.min(COMBO.maxDmgBonus, this.ctx.comboCount * COMBO.dmgBonusPerCombo);
        const critChance = allowCrit ? ((this.ctx._cachedTalentCritChance) || 0) : 0;
        const critBoostMult = TALENT.critDamageMultiplier + getSkillEffect('critBoost');
        let finalDmg = dmg * comboBonus;
        let isCrit = false;
        if (Math.random() < critChance) { finalDmg *= critBoostMult; isCrit = true; }

        if (showText) {
            const dmgText = `${Math.floor(finalDmg)}`;
            const dmgColor = isCrit ? 0xff3300 : (this.ctx.comboCount > 20 ? 0xffcc00 : 0xffffff);
            EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: fish.x, y: fish.y - fish.hitRadius, text: dmgText, color: dmgColor, isCrit });
        }

        const isDead = fish.takeDamage(finalDmg);
        if (isDead) {
            if (allowComboOnKill) {
                this.ctx.comboCount++;
                this.ctx.comboTimer = COMBO.timeoutFrames;
                EventBus.emit(GameEvents.UI_COMBO, { count: this.ctx.comboCount });
            }

            const roll = Math.random();
            const goldMult = (this.ctx._cachedTalentGoldMult) || 1.0;
            const skillGoldBoost = 1 + getSkillEffect('goldBoost');
            const baseCrystal = fish.isBoss
                ? ECONOMY.bossCrystal
                : (roll > ECONOMY.richDropChance ? ECONOMY.killCrystalRich : ECONOMY.killCrystalBase);
            const val = baseCrystal * 2 * this.ctx.rewardMultiplier * goldMult * skillGoldBoost * (1 + this.ctx.comboCount * COMBO.goldBonusPerCombo);
            this.ctx.crystals += val;

            // [优化] 关卡分数更新 - 使用静态导入，不再动态 import
            if (this.ctx.stageLevel > 0 || this.ctx.isEndless) {
                const scoreVal = fish.isBoss ? 500 : Math.floor(val);
                this.ctx.stageScore += scoreVal;

                if (this.ctx.isEndless) {
                    EventBus.emit(GameEvents.UI_STAGE_SCORE_UPDATE, {
                        currentScore: this.ctx.stageScore,
                        requiredScore: 0,
                        levelId: 0,
                    });
                } else {
                    // [优化] 直接调用静态导入的函数
                    const currentLayer = SaveManager.state.currentLayer || 1;
                    const currentArea = SaveManager.state.currentArea[String(currentLayer)] || 1;
                    const levelInArea = ((this.ctx.stageLevel - 1) % LEVELS_PER_AREA) + 1;
                    const areaLevels = getLayerAreaLevels(currentLayer, currentArea);
                    const nextLevelInArea = levelInArea + 1;
                    const nextLvl = nextLevelInArea <= LEVELS_PER_AREA
                        ? areaLevels[nextLevelInArea - 1]
                        : null;
                    const requiredScore = nextLvl ? nextLvl.unlockScore : 0;

                    EventBus.emit(GameEvents.UI_STAGE_SCORE_UPDATE, {
                        currentScore: this.ctx.stageScore,
                        requiredScore,
                        levelId: this.ctx.stageLevel,
                    });

                    if (nextLvl && this.ctx.stageScore >= requiredScore && !this.ctx.stageUnlockShown) {
                        this.ctx.stageUnlockShown = true;
                        EventBus.emit(GameEvents.STAGE_UNLOCK_REACHED, {
                            currentScore: this.ctx.stageScore,
                            requiredScore,
                            nextLevelName: nextLvl.name,
                        });
                    }
                }
            }

            // [优化] 金币累加 + 防抖 save（不再每杀一只鱼都写 localStorage）
            SaveManager.state.gold += Math.floor(val);
            if (this.saveDebounceTimer <= 0) {
                SaveManager.save();
                this.saveDebounceTimer = CombatSystem.SAVE_DEBOUNCE;
            }

            EventBus.emit(GameEvents.UI_HUD_UPDATE, { crystals: this.ctx.crystals });
            this.effects.spawnParticles(fish.x, fish.y, 20, 0xffffff, 8);
            this.effects.spawnParticles(fish.x, fish.y, 10, 0x00f0ff, 12);

            if (Math.random() < ECONOMY.nanoCoreDropChance) this.spawner.spawnNanoCore(fish.x, fish.y);
        }
    }
}
