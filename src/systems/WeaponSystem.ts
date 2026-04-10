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

        // 闪电武器：特斯拉线圈模式，自动连接最近敌人
        let targetFish = null;
        if (id === 'lightning') {
            const maxRange = 900;
            let minDist = maxRange;
            for (const f of this.ctx.fishes) {
                if (!f.isActive) continue;
                const d = Math.sqrt((f.x - x) ** 2 + (f.y - y) ** 2);
                if (d < minDist) {
                    minDist = d;
                    targetFish = f;
                }
            }
            if (!targetFish) return; // 没目标不发射
        }

        const b = this.ctx.pool.get('bullet', () => new Bullet());
        if (!b) return;
        const dmgMult = (window as any).TalentDmgMult || 1.0;
        const speedMult = (window as any).TalentSpeedMult || 1.0;
        b.setType(id, lvl, dmgMult, speedMult);
        b.fire(x, y, angle, targetFish || undefined);
        this.ctx.cannon.triggerFire(id);
        // lightning: 持续8s电流音，noOverlap防重叠
        // 其他武器: 每次最多播0.05s短促射击音，noOverlap限速上限防高射速武器爆音
        AssetManager.playSound(id === 'lightning' ? 'lightning' : 'shoot', 1, id === 'lightning' ? 8 : 0.05, true);
        SceneManager.getLayer(Layers.Bullet).addChild(b);
        this.ctx.bullets.push(b);
        this.effects.spawnParticles(x + Math.cos(angle) * 40, y + Math.sin(angle) * 40, 2, 0xffffff, 2);
    }
}
