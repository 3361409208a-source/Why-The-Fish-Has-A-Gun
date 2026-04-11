import { SceneManager, Layers } from '../SceneManager';
import { AssetManager } from '../AssetManager';
import { SaveManager } from '../SaveManager';
import { Bullet } from '../entities/Bullet';
import { WEAPONS, getWeapon } from '../config/weapons.config';
import { UPGRADE } from '../config/balance.config';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';

export class WeaponSystem {
    private autoFireTimer: number = 0;
    private unsubs: Array<() => void> = [];

    constructor(private ctx: GameContext, private effects: EffectSystem) {
        this.unsubs = [
            EventBus.on<{ id: string }>(GameEvents.WEAPON_SELECT,  ({ id }) => this.handleShopSelect(id)),
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
        EventBus.emit(GameEvents.UI_HUD_UPDATE,    { crystals: this.ctx.crystals });
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
        const fireRateMult = (window as any).TalentFireRateMult || 1.0;
        if (this.autoFireTimer > def.fireInterval / fireRateMult) {
            const angle = this.ctx.cannon.getFireAngle();
            const shots = def.multiShot ?? 1;
            if (shots > 1) {
                const spread = 0.2;
                for (let s = 0; s < shots; s++) {
                    const offset = (s - Math.floor(shots / 2)) * spread;
                    this.fire(this.ctx.cannon.x, this.ctx.cannon.y, angle + offset);
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

        // 闪电武器：轨道停在炮台锚点（旋转中心），无需偏移；其他武器从炮眼发射
        const firePos = id === 'lightning'
            ? { x: this.ctx.cannon.x, y: this.ctx.cannon.y }
            : this.ctx.cannon.getMuzzlePosition();

        // 闪电武器：射线与鱼碰撞体求交，取射线上最近的命中鱼（不自动追踪）
        let lightningTarget = undefined;
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
                // 放宽一点容差，避免“发射了但锁不到目标”
                if (perp <= f.hitRadius * 1.25 && dot < minDot) { // 射线穿过鱼体，取最近的
                    minDot = dot;
                    lightningTarget = f;
                }
            }

            // 不兜底：允许打空，避免任何形式的自瞄
        }

        const b = this.ctx.pool.get('bullet', () => new Bullet());
        if (!b) return;
        const dmgMult = (window as any).TalentDmgMult || 1.0;
        const speedMult = (window as any).TalentSpeedMult || 1.0;
        b.setType(id, lvl, dmgMult, speedMult);
        b.fire(firePos.x, firePos.y, angle, lightningTarget);
        this.ctx.cannon.triggerFire(id);
        // lightning: 发射使用通用 shoot；持续电击的电流音由 CombatSystem 的 DOT 期间播放
        // 其他武器: 每次最多播0.05s短促射击音，noOverlap限速上限防高射速武器爆音
        AssetManager.playSound(
            'shoot',
            1,
            id === 'lightning' ? 0.07 : 0.05,
            true
        );
        // 闪电命中(锁定目标)：环绕电弧放 UI 层，避免被炮台遮住
        // 闪电打空(无目标)：放回 Bullet 层，避免压在炮台上层
        const layer =
            id === 'lightning' && lightningTarget ? Layers.UI :
            Layers.Bullet;
        SceneManager.getLayer(layer).addChild(b);
        this.ctx.bullets.push(b);
        this.effects.spawnParticles(firePos.x + Math.cos(angle) * 40, firePos.y + Math.sin(angle) * 40, 2, 0xffffff, 2);
    }
}
