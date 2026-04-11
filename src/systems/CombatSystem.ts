import { SceneManager, Layers } from '../SceneManager';
import { AssetManager } from '../AssetManager';
import { Fish } from '../entities/Fish';
import { Bullet } from '../entities/Bullet';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import { COMBO, CHAIN, ECONOMY, AOE } from '../config/balance.config';
import { getSkillEffect, getSkillLevel } from '../config/skilltree.config';
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
    /** 分裂弹冷却帧计数器，防止高射速下分裂弹爆炸 */
    private splitCooldown: number = 0;
    private static readonly SPLIT_COOLDOWN_FRAMES = 15; // 最少15帧间隔才能再次分裂
    private static readonly MAX_SPLIT_BULLETS = 30; // 场上最多30颗分裂弹
    private static readonly MAX_TOTAL_BULLETS = 200; // 场上子弹总数上限

    constructor(
        private ctx: GameContext,
        private effects: EffectSystem,
        private spawner: SpawnSystem,
        private status: StatusSystem,
        private attacks: AttackSystem,
    ) { }

    checkCollisions(delta: number): void {
        // 分裂弹冷却递减
        if (this.splitCooldown > 0) this.splitCooldown -= delta;

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

            // ── 普通武器：飞行碰撞检测（支持穿透） ──
            // 分裂弹不穿透，避免子弹数量爆炸
            const pierceCount = b.isSplitBullet ? 0 : getSkillEffect('pierce');
            let pierced = 0;
            for (const f of this.ctx.fishes) {
                if (!f.isActive) continue;
                if (b.hitFishList && b.hitFishList.length > 0 && b.hitFishList.includes(f)) continue; // 不重复命中
                const dx = b.x - f.x;
                const dy = b.y - f.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < f.hitRadius * f.hitRadius) {
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

                    // 分裂弹技能：命中后分裂出小子弹（带冷却和数量限制）
                    const splitLevel = getSkillLevel('split');
                    if (splitLevel > 0 && !b.isSplitBullet && this.splitCooldown <= 0) {
                        // 计算当前场上分裂弹数量
                        const splitCount = this.ctx.bullets.filter(bl => bl.isSplitBullet).length;
                        if (splitCount < CombatSystem.MAX_SPLIT_BULLETS && this.ctx.bullets.length < CombatSystem.MAX_TOTAL_BULLETS) {
                            this.spawnSplitBullets(b, f, splitLevel);
                            this.splitCooldown = CombatSystem.SPLIT_COOLDOWN_FRAMES;
                        }
                    }

                    // 穿透判定
                    if (pierced < pierceCount) {
                        pierced++;
                        if (!b.hitFishList) b.hitFishList = [];
                        b.hitFishList.push(f);
                        continue; // 子弹继续飞行，不kill
                    }

                    b.kill();
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
        // 技能树：电弧增辐，每级+2跳跃
        const chainBoost = getSkillEffect('chainBoost');
        const totalTargets = maxCount + chainBoost;
        const branchDmg = baseDmg * CHAIN.damageFalloff;

        let candidates: { fish: Fish; dist: number }[] = [];
        for (const f of this.ctx.fishes) {
            if (!f.isActive || f === startFish) continue;
            const distSq = Math.pow(f.x - startFish.x, 2) + Math.pow(f.y - startFish.y, 2);
            if (distSq <= CHAIN.chainRange * CHAIN.chainRange) {
                candidates.push({ fish: f, dist: distSq });
            }
        }

        // 排序找到最近的 totalTargets 个单位直接分支电击
        candidates.sort((a, b) => a.dist - b.dist);
        const targets = candidates.slice(0, totalTargets);

        for (const t of targets) {
            // 一次性的瞬间受击，后续 3秒的连线效果交给 StatusSystem 处理
            this.effects.spawnLightning(startFish.x, startFish.y, t.fish.x, t.fish.y, true);
            this.applyDamage(t.fish, branchDmg);
            this.status.applyElectrocute(t.fish, branchDmg, startFish);
        }
    }

    /** 分裂弹技能：命中后向两侧分裂出追踪小子弹 */
    private spawnSplitBullets(parentBullet: Bullet, hitFish: Fish, splitLevel: number): void {
        const splitDmgMult = 0.3 + splitLevel * 0.15; // 基础30% + 每级15%
        const angles = [parentBullet.rotation - 0.4, parentBullet.rotation + 0.4]; // 左右各偏0.4弧度
        for (const angle of angles) {
            const sb = this.ctx.pool.get('bullet', () => new Bullet());
            if (!sb) continue;
            const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
            const lvl = this.ctx.weaponLevels[id] || 1;
            const dmgMult = (window as any).TalentDmgMult || 1.0;
            sb.setType(id, lvl, dmgMult, 1.0);
            sb.damage *= splitDmgMult;
            sb.isSplitBullet = true;
            sb.fire(hitFish.x, hitFish.y, angle - Math.PI / 2); // 补偿rotation偏移
            // 自动追击：找最近的活鱼作为追踪目标
            let nearestDist = Infinity;
            let nearestFish: Fish | null = null;
            for (const f of this.ctx.fishes) {
                if (!f.isActive || f === hitFish) continue;
                const d = Math.pow(f.x - hitFish.x, 2) + Math.pow(f.y - hitFish.y, 2);
                if (d < nearestDist) { nearestDist = d; nearestFish = f; }
            }
            sb.homingTarget = nearestFish;
            SceneManager.getLayer(Layers.Bullet).addChild(sb);
            this.ctx.bullets.push(sb);
        }
    }

    applyDamage(fish: Fish, dmg: number, opts: DamageOptions = {}): void {
        const allowCrit = opts.allowCrit ?? true;
        const allowComboOnKill = opts.allowComboOnKill ?? true;
        const showText = opts.showText ?? true;

        const comboBonus = 1 + Math.min(COMBO.maxDmgBonus, this.ctx.comboCount * COMBO.dmgBonusPerCombo);
        const critChance = allowCrit ? ((window as any).TalentCritChance || 0) : 0;
        // 技能树：暴击强化，每级+0.5暴击倍率
        const critBoostMult = 3.0 + getSkillEffect('critBoost');
        let finalDmg = dmg * comboBonus;
        let isCrit = false;
        if (Math.random() < critChance) { finalDmg *= critBoostMult; isCrit = true; }

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
            // 技能树：收益增幅，每级+10%金币
            const skillGoldBoost = 1 + getSkillEffect('goldBoost');
            const baseCrystal = (fish as any).isBoss
                ? ECONOMY.bossCrystal
                : (roll > ECONOMY.richDropChance ? ECONOMY.killCrystalRich : ECONOMY.killCrystalBase);
            const val = baseCrystal * 2 * this.ctx.rewardMultiplier * goldMult * skillGoldBoost * (1 + this.ctx.comboCount * COMBO.goldBonusPerCombo);
            this.ctx.crystals += val;

            // 关卡模式：累积分数
            if (this.ctx.stageLevel > 0) {
                const scoreVal = (fish as any).isBoss ? 500 : Math.floor(val);
                this.ctx.stageScore += scoreVal;

                // 获取下一关所需分数
                import('../config/levels.config').then(({ getLayerLevels, LEVELS_PER_AREA, getLayerAreaLevels }) => {
                    import('../SaveManager').then(({ SaveManager }) => {
                        const currentLayer = SaveManager.state.currentLayer || 1;
                        const currentArea = SaveManager.state.currentArea[String(currentLayer)] || 1;
                        const levelInArea = ((this.ctx.stageLevel - 1) % LEVELS_PER_AREA) + 1;
                        const areaLevels = getLayerAreaLevels(currentLayer, currentArea);
                        const nextLevelInArea = levelInArea + 1;
                        const nextLvl = nextLevelInArea <= LEVELS_PER_AREA
                            ? areaLevels.find((l: typeof areaLevels[0]) => l.id === nextLevelInArea)
                            : null;
                        const requiredScore = nextLvl ? nextLvl.unlockScore : 0;

                        EventBus.emit(GameEvents.UI_STAGE_SCORE_UPDATE, {
                            currentScore: this.ctx.stageScore,
                            requiredScore,
                            levelId: this.ctx.stageLevel,
                        });

                        // 检测是否刚达到解锁分数（仅检测一次）
                        if (nextLvl && this.ctx.stageScore >= requiredScore && !this.ctx.stageUnlockShown) {
                            this.ctx.stageUnlockShown = true;
                            EventBus.emit(GameEvents.STAGE_UNLOCK_REACHED, {
                                currentScore: this.ctx.stageScore,
                                requiredScore,
                                nextLevelName: nextLvl.name,
                            });
                        }
                    });
                });
            }

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
