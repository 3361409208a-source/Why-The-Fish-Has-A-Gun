import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Fish } from './entities/Fish';
import { Bullet } from './entities/Bullet';
import { NanoCore } from './entities/NanoCore';
import { UIManager } from './UIManager';
import { Cannon } from './entities/Cannon';

import { Particle } from './entities/Particle';
import { Shockwave } from './entities/Shockwave';
import { Lightning } from './entities/Lightning';

export class GameController {
    private app: PIXI.Application;
    private pool: PoolManager;
    private cannon!: Cannon;
    private isAutoMode: boolean = true;
    private autoFireTimer: number = 0;

    // 经济系统
    private crystals: number = 2000;
    
    // 武器系统
    private unlockedWeapons: string[] = ['cannon_base'];
    private currentWeaponIndex: number = 0;
    private weaponLevels: {[id: string]: number} = {
        'cannon_base': 1,
        'fish_tuna_mode': 1,
        'gatling': 1,
        'heavy': 1,
        'lightning': 1
    };
    
    private fishes: Fish[] = [];
    private bullets: Bullet[] = [];
    private cores: NanoCore[] = [];
    private particles: Particle[] = [];
    private shockwaves: Shockwave[] = [];
    private lightnings: Lightning[] = [];
    private frozenTime: number = 0;

    private spawnTimer: number = 0;

    // 武器库定义
    private weaponCatalog = [
        { id: 'cannon_base', name: '标准激光', cost: 0 },
        { id: 'fish_tuna_mode', name: '机械鱼模组', cost: 1000 },
        { id: 'gatling', name: '等离子加特林', cost: 3000 },
        { id: 'heavy', name: '重爆核能炮', cost: 8000 },
        { id: 'lightning', name: '连锁闪电', cost: 15000 }
    ];

    constructor(app: PIXI.Application) {
        this.app = app;
        this.pool = PoolManager.getInstance();
        
        this.initCannon();
        this.initInteraction();
        this.updateShopUI();
        
        app.ticker.add((delta: number) => {
            try {
                this.update(delta);
            } catch (err: any) {
                console.error('Update Crash:', err.message);
            }
        });
    }

    private initCannon(): void {
        this.cannon = new Cannon();
        this.cannon.x = SceneManager.width / 2;
        this.cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.UI).addChild(this.cannon);
    }

    private initInteraction(): void {
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(-1000, -1000, 3000, 3000); 

        const onMove = (e: PIXI.FederatedPointerEvent) => {
            const localPos = e.getLocalPosition(this.app.stage);
            this.cannon.lookAt(localPos.x, localPos.y);
        };

        this.app.stage.on('pointerdown', onMove);
        this.app.stage.on('pointermove', (e) => {
            if (e.buttons > 0 || e.pointerType === 'touch') onMove(e);
        });
    }

    private updateShopUI(): void {
        const weaponsData = this.weaponCatalog.map(w => ({
            ...w,
            unlocked: this.unlockedWeapons.includes(w.id),
            active: this.unlockedWeapons[this.currentWeaponIndex] === w.id,
            level: this.weaponLevels[w.id] || 1
        }));

        UIManager.setupShop(
            weaponsData, 
            (id) => this.handleShopSelect(id),
            (id) => this.upgradeWeapon(id)
        );
        UIManager.updateHUD(this.crystals);
    }

    private handleShopSelect(id: string): void {
        const index = this.unlockedWeapons.indexOf(id);
        if (index !== -1) {
            this.currentWeaponIndex = index;
            this.cannon.switchTexture(id);
            this.updateShopUI();
        } else {
            const item = this.weaponCatalog.find(w => w.id === id);
            if (item && this.crystals >= item.cost) {
                this.crystals -= item.cost;
                this.unlockedWeapons.push(id);
                this.currentWeaponIndex = this.unlockedWeapons.length - 1;
                this.cannon.switchTexture(id);
                this.updateShopUI();
                UIManager.showFloatingText(640, 360, "解锁成功!", 0x00ff00);
            } else {
                UIManager.showFloatingText(640, 360, "晶体不足!", 0xff0000);
            }
        }
    }

    public upgradeWeapon(id: string): void {
        const lvl = this.weaponLevels[id] || 1;
        if (lvl >= 5) return;
        const cost = 500 * Math.pow(2, lvl - 1);
        if (this.crystals >= cost) {
            this.crystals -= cost;
            this.weaponLevels[id] = lvl + 1;
            this.updateShopUI();
            UIManager.showFloatingText(640, 360, `升级成功! LV.${lvl + 1}`, 0x00ff00);
            this.spawnShockwave(640, 360, 2.0);
        } else {
            UIManager.showFloatingText(640, 360, `晶体不足! 需要 ${cost}`, 0xff0000);
        }
    }

    private update(delta: number): void {
        if (this.frozenTime > 0) {
            this.frozenTime -= delta;
            return;
        }

        SceneManager.update(delta);

        this.spawnTimer += delta;
        if (this.spawnTimer > 30) {
            this.spawnFish();
            this.spawnTimer = 0;
        }

        if (this.isAutoMode) this.handleAutoFire(delta);

        this.updateEntities(this.fishes, 'fish', delta);
        this.updateEntities(this.bullets, 'bullet', delta);
        this.updateEntities(this.cores, 'core', delta);
        this.updateEntities(this.particles, 'particle', delta);
        this.updateEntities(this.shockwaves, 'shockwave', delta);
        this.updateEntities(this.lightnings, 'lightning', delta);

        this.checkCollisions();
    }

    private handleAutoFire(delta: number): void {
        const id = this.unlockedWeapons[this.currentWeaponIndex];
        this.autoFireTimer += delta;
        // 降低射击间隔，提升全武器射速 (约为原来的 2 倍速)
        let interval = (id === 'gatling') ? 2 : (id === 'heavy' ? 18 : 6);
        
        if (this.autoFireTimer > interval) {
            const angle = this.cannon.getFireAngle();
            if (id === 'fish_tuna_mode') {
                this.fire(this.cannon.x, this.cannon.y, angle);
                this.fire(this.cannon.x, this.cannon.y, angle - 0.2);
                this.fire(this.cannon.x, this.cannon.y, angle + 0.2);
            } else {
                this.fire(this.cannon.x, this.cannon.y, angle);
            }
            this.autoFireTimer = 0;
        }
    }

    private fire(x: number, y: number, angle: number): void {
        const id = this.unlockedWeapons[this.currentWeaponIndex];
        const lvl = this.weaponLevels[id] || 1;
        const b = this.pool.get('bullet', () => new Bullet());
        if (!b) return;
        b.setType(id, lvl);
        b.fire(x, y, angle);
        SceneManager.getLayer(Layers.FX).addChild(b);
        this.bullets.push(b);
        this.spawnParticles(x + Math.cos(angle)*40, y + Math.sin(angle)*40, 2, 0xffffff, 2);
    }

    private checkCollisions(): void {
        for (const b of this.bullets) {
            if (!b.isActive) continue;
            for (const f of this.fishes) {
                if (!f.isActive) continue;
                const dx = Math.abs(b.x - f.x);
                const dy = Math.abs(b.y - f.y);
                const hw = (Math.abs(f.width)/2) * 0.7;
                const hh = (Math.abs(f.height)/2) * 0.7;

                if (dx < hw && dy < hh) {
                    b.kill();
                    const id = this.unlockedWeapons[this.currentWeaponIndex];
                    const lvl = this.weaponLevels[id] || 1;
                    this.onHitEffect(id, b.x, b.y, lvl);

                    if (id === 'heavy') {
                        for (const target of this.fishes) {
                            if (!target.isActive) continue;
                            const d = Math.sqrt(Math.pow(target.x-b.x,2)+Math.pow(target.y-b.y,2));
                            if (d < 150 + lvl*20) this.applyDamage(target, b.damage * 0.5);
                        }
                    } else if (id === 'lightning') {
                        this.applyDamage(f, b.damage);
                        this.triggerChainLightning(f, 3+lvl, b.damage*0.8);
                    } else {
                        this.applyDamage(f, b.damage);
                    }
                    break;
                }
            }
        }
    }

    private onHitEffect(id: string, x: number, y: number, lvl: number): void {
        switch(id) {
            case 'gatling':
                this.spawnParticles(x, y, 4, 0xffff00, 3);
                SceneManager.shake(1, 30);
                break;
            case 'heavy':
                this.spawnParticles(x, y, 15, 0xff6600, 8);
                this.spawnShockwave(x, y, 1.2 + lvl*0.2);
                SceneManager.shake(4 + lvl, 100);
                break;
            case 'lightning':
                this.spawnParticles(x, y, 5, 0x00ffff, 4);
                break;
            case 'fish_tuna_mode':
                this.spawnParticles(x, y, 6, 0x00ff00, 5);
                break;
            default:
                this.spawnParticles(x, y, 3, 0x00f8ff, 4);
        }
    }

    private applyDamage(fish: Fish, dmg: number): void {
        if (!fish.isActive) return;
        if (fish.takeDamage(dmg) && fish.hp <= 0) {
            fish.kill();
            const roll = Math.random();
            // 晶体奖励翻倍 (100% 提升)
            const val = ((fish as any).isBoss ? 500 : (roll > 0.8 ? 50 : 10)) * 2;
            this.crystals += val;
            this.updateShopUI();
            this.spawnParticles(fish.x, fish.y, 10, 0xffffff, 5);
            
            // 晶体掉落概率增加 (从 0.3 提升至 0.6)
            if (roll < 0.6) this.dropCore(fish.x, fish.y, roll < 0.1);
            UIManager.showFloatingText(fish.x, fish.y, `+${val}`, 0x00ff00);
        }
    }

    private triggerChainLightning(start: Fish, jumps: number, dmg: number): void {
        let curr = start;
        let seen = new Set([start]);
        for (let j=0; j<jumps; j++) {
            let next: Fish | null = null;
            let dMin = 300;
            for (const f of this.fishes) {
                if (!f.isActive || seen.has(f)) continue;
                const d = Math.sqrt(Math.pow(f.x-curr.x,2)+Math.pow(f.y-curr.y,2));
                if (d < dMin) { dMin = d; next = f; }
            }
            if (next) {
                this.drawLightningArc(curr.x, curr.y, next.x, next.y);
                this.applyDamage(next, dmg);
                seen.add(next);
                curr = next;
            } else break;
        }
    }

    private drawLightningArc(x1: number, y1: number, x2: number, y2: number): void {
        const arc = this.pool.get('lightning', () => new Lightning());
        if (arc) {
            arc.spawn(x1, y1, x2, y2);
            SceneManager.getLayer(Layers.Game).addChild(arc);
            this.lightnings.push(arc);
        }
    }

    private spawnParticles(x: number, y: number, count: number, color: number, size: number): void {
        // 手机端粒子上限保护 (防止过度渲染导致卡顿)
        if (this.particles.length > 300) return; 

        for (let i=0; i<count; i++) {
            const p = this.pool.get('particle', () => new Particle());
            if (p) { p.spawn(x, y, color, size); SceneManager.getLayer(Layers.FX).addChild(p); this.particles.push(p); }
        }
    }

    private spawnShockwave(x: number, y: number, scale: number): void {
        const s = this.pool.get('shockwave', () => new Shockwave());
        if (s) { s.spawn(x, y, scale); SceneManager.getLayer(Layers.Game).addChild(s); this.shockwaves.push(s); }
    }

    private spawnFish(): void {
        const f = this.pool.get('fish', () => new Fish());
        if (!f) return;
        const side = Math.random() > 0.5 ? 'left' : 'right';
        f.spawn(side === 'right' ? 1330 : -50, Math.random()*600+50, side, Math.random()<0.05);
        SceneManager.getLayer(Layers.Game).addChild(f);
        this.fishes.push(f);
    }

    private dropCore(x: number, y: number, gold: boolean): void {
        const c = this.pool.get('core', () => new NanoCore());
        if (c) { c.spawn(x, y, gold); SceneManager.getLayer(Layers.Game).addChild(c); this.cores.push(c); }
    }

    private updateEntities(list: any[], type: string, delta: number): void {
        for (let i = list.length - 1; i >= 0; i--) {
            const e = list[i];
            if (e.update) e.update(delta);
            
            if (!e.isActive) {
                // 关键点：从场景层中移除，防止对象池中的“残留”影子停留
                if (e.parent) e.parent.removeChild(e);
                
                this.pool.put(type, e);
                list.splice(i, 1);
            }
        }
    }
}
