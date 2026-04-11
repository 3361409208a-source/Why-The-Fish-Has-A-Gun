import { SceneManager, Layers } from '../SceneManager';
import { AssetManager } from '../AssetManager';
import { SaveManager } from '../SaveManager';
import { UIManager } from '../UIManager';
import { Bullet } from '../entities/Bullet';
import { WEAPONS, getWeapon } from '../config/weapons.config';
import { UPGRADE } from '../config/balance.config';
import { getSkillEffect, getSkillLevel } from '../config/skilltree.config';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';

export class WeaponSystem {
    private autoFireTimer: number = 0;
    private unsubs: Array<() => void> = [];

    constructor(private ctx: GameContext, private effects: EffectSystem) {
        this.unsubs = [
            EventBus.on<{ id: string }>(GameEvents.WEAPON_SELECT, ({ id }) => this.handleShopSelect(id)),
            EventBus.on<{ id: string }>(GameEvents.WEAPON_UPGRADE, ({ id }) => this.upgradeWeapon(id)),
        ];
    }

    destroy(): void {
        this.unsubs.forEach(u => u());
        this.unsubs = [];
    }

    updateShopUI(): void {
        const goldUnlocked = SaveManager.state.goldUnlockedWeapons || [];
        const filteredCatalog = WEAPONS.filter(w => !w.isHero || goldUnlocked.includes(w.id));
        const weaponsData = filteredCatalog.map(w => {
            const lvl = this.ctx.weaponLevels[w.id] || 1;
            return {
                id: w.id,
                name: w.name,
                cost: w.unlockCost,
                unlocked: this.ctx.unlockedWeapons.includes(w.id),
                active: this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex] === w.id,
                level: lvl,
                upgradeCost: UPGRADE.getCost(lvl),
                isMax: lvl >= w.maxLevel
            };
        });
        EventBus.emit(GameEvents.UI_SHOP_REFRESH, { weapons: weaponsData });
        EventBus.emit(GameEvents.UI_HUD_UPDATE, { crystals: this.ctx.crystals });
    }

    handleShopSelect(id: string): void {
        const index = this.ctx.unlockedWeapons.indexOf(id);
        if (index !== -1) {
            this.ctx.currentWeaponIndex = index;
            this.ctx.cannon.switchTexture(id);
            this.updateShopUI();
        } else {
            const def = getWeapon(id);
            if (def && this.ctx.crystals >= def.unlockCost) {
                this.ctx.crystals -= def.unlockCost;
                this.ctx.unlockedWeapons.push(id);
                this.ctx.currentWeaponIndex = this.ctx.unlockedWeapons.length - 1;
                this.ctx.cannon.switchTexture(id);
                this.updateShopUI();
                EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: 640, y: 360, text: '解锁成功!', color: 0x00ff00 });
            } else {
                EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: 640, y: 360, text: '晶体不足!', color: 0xff0000 });
            }
        }
    }

    upgradeWeapon(id: string): void {
        const def = getWeapon(id);
        const lvl = this.ctx.weaponLevels[id] || 1;
        if (!def || lvl >= def.maxLevel) return;
        const cost = UPGRADE.getCost(lvl);
        if (this.ctx.crystals >= cost) {
            this.ctx.crystals -= cost;
            this.ctx.weaponLevels[id] = lvl + 1;
            import('../SaveManager').then(({ SaveManager }) => {
                SaveManager.state.weaponLevels = { ...this.ctx.weaponLevels };
                SaveManager.save();
            });
            this.updateShopUI();
            AssetManager.playSound('upgrade');
            EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: 640, y: 360, text: `升级成功! LV.${lvl + 1}`, color: 0x00ff00 });
            this.effects.spawnShockwave(640, 360, 2.0);
        } else {
            EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: 640, y: 360, text: `晶体不足! 需要 ${cost}`, color: 0xff0000 });
        }
    }

    handleAutoFire(delta: number): void {
        this.ctx.cannon.update(delta);
        const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
        const def = getWeapon(id);
        if (!def) return;


        this.autoFireTimer += delta;

        // --- 狂热(Berserk)逻辑实现 ---
        // 10s 为一个周期 (600帧 @60fps). 
        // 前 6s (360帧) 为能量收集阶段，后 4s (240帧) 为爆发阶段 (x5 射速)
        // 技能树：狂热延长，每级+60帧(1秒)
        const berserkBoostFrames = getSkillEffect('berserkBoost');
        const CYCLE_FRAMES = 600 + berserkBoostFrames;
        const BERSERK_DURATION = 240 + berserkBoostFrames;
        const COLLECT_DURATION = CYCLE_FRAMES - BERSERK_DURATION;

        this.ctx.berserkTimer += delta;
        if (this.ctx.berserkTimer >= CYCLE_FRAMES) {
            this.ctx.berserkTimer = 0;
        }

        if (this.ctx.berserkTimer < COLLECT_DURATION) {
            // 能量收集阶段
            this.ctx.isBerserk = false;
            this.ctx.berserkCharge = this.ctx.berserkTimer / COLLECT_DURATION;
        } else {
            // 爆发阶段
            this.ctx.isBerserk = true;
            this.ctx.berserkCharge = 1 - (this.ctx.berserkTimer - COLLECT_DURATION) / BERSERK_DURATION;
        }

        // 更新 UI
        UIManager.updateBerserk(this.ctx.berserkCharge, this.ctx.isBerserk);

        // 技能树：射速超频，每级+5%射速
        const skillFireRateBoost = 1 + getSkillEffect('fireRateBoost');
        let fireRateMult = ((window as any).TalentFireRateMult || 1.0) * skillFireRateBoost;
        if (this.ctx.isBerserk) fireRateMult *= 5.0; // 狂热加成

        if (this.autoFireTimer > def.fireInterval / fireRateMult) {
            const angle = this.ctx.cannon.getFireAngle();
            // 技能树：多管联装，额外增加炮管数量
            const multiCannonLevel = getSkillLevel('multiCannon');
            const extraBarrels = multiCannonLevel; // 每级+1个炮管
            const totalBarrels = 1 + extraBarrels;

            const shots = def.multiShot ?? 1;
            const totalShots = shots * totalBarrels;

            if (totalShots > 1) {
                // 扇形散射：根据总炮管数计算散布角度
                const baseSpread = 0.15; // 基础散布
                const maxSpread = Math.min(0.6, baseSpread * totalBarrels); // 最大散布限制
                const angleStep = totalBarrels > 1 ? maxSpread / (totalBarrels - 1) : 0;

                for (let barrel = 0; barrel < totalBarrels; barrel++) {
                    // 计算该炮管的基础角度偏移
                    const barrelOffset = totalBarrels > 1
                        ? (barrel - (totalBarrels - 1) / 2) * angleStep
                        : 0;

                    for (let s = 0; s < shots; s++) {
                        const shotOffset = shots > 1
                            ? (s - Math.floor(shots / 2)) * 0.1
                            : 0;
                        this.fire(this.ctx.cannon.x, this.ctx.cannon.y, angle + barrelOffset + shotOffset);
                    }
                }
            } else {
                this.fire(this.ctx.cannon.x, this.ctx.cannon.y, angle);
            }
            this.autoFireTimer = 0;
        }
    }

    fire(x: number, y: number, angle: number): void {
        const id = this.ctx.unlockedWeapons[this.ctx.currentWeaponIndex];
        const lvl = this.ctx.weaponLevels[id] || 1;

        const cannonCenter = { x: this.ctx.cannon.x, y: this.ctx.cannon.y };
        const muzzlePos = this.ctx.cannon.getMuzzlePosition();

        // 闪电武器：射线与鱼碰撞体求交，取射线上最近的命中鱼（绝对直线判定，不自动追踪）
        let lightningTarget = undefined;
        let lightningDist = Infinity;
        if (id === 'lightning') {
            const aimAngle = this.ctx.cannon.getFireAngle();
            const aimDx = Math.cos(aimAngle);
            const aimDy = Math.sin(aimAngle);
            let minDot = Infinity;
            for (const f of this.ctx.fishes) {
                if (!f.isActive) continue;
                const dx = f.x - this.ctx.cannon.x;
                const dy = f.y - this.ctx.cannon.y;
                const dot = dx * aimDx + dy * aimDy;
                if (dot <= 0) continue; // 炮台背后跳过
                const perp = Math.abs(dx * aimDy - dy * aimDx); // 鱼心到射线的垂直距离
                // 完全移除自瞄：只有精准穿过目标的碰撞半径才判定命中
                if (perp <= f.hitRadius && dot < minDot) {
                    minDot = dot;
                    lightningTarget = f;
                }
            }
            if (lightningTarget) {
                lightningDist = minDot;
            }
        }

        const b = this.ctx.pool.get('bullet', () => new Bullet());
        if (!b) return;
        // 技能树：火力增幅，每级+8%伤害
        const skillDmgBoost = 1 + getSkillEffect('damageBoost');
        const dmgMult = ((window as any).TalentDmgMult || 1.0) * skillDmgBoost;
        const speedMult = (window as any).TalentSpeedMult || 1.0;
        b.setType(id, lvl, dmgMult, speedMult);
        // 传入炮眼位置和纯直线打击距离，做到与武器动画物理脱钩
        b.fire(muzzlePos.x, muzzlePos.y, angle, lightningTarget, lightningDist);
        this.ctx.cannon.triggerFire(id);
        // lightning: 发射使用通用 shoot；持续电击的电流音由 CombatSystem 的 DOT 期间播放
        // 其他武器: 每次最多播0.05s短促射击音，noOverlap限速上限防高射速武器爆音
        AssetManager.playSound(
            'shoot',
            1,
            id === 'lightning' ? 0.07 : 0.05,
            true
        );
        // 闪电打出后的所有特效图层下放至后台（Game层），避免在视觉上压在武器或UI之上
        const layer = id === 'lightning' ? Layers.Game : Layers.Bullet;
        SceneManager.getLayer(layer).addChild(b);
        this.ctx.bullets.push(b);
        this.effects.spawnParticles(muzzlePos.x + Math.cos(angle) * 40, muzzlePos.y + Math.sin(angle) * 40, 2, 0xffffff, 2);
    }
}
