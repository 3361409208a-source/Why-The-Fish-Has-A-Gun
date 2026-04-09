import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Fish } from './entities/Fish';
import { Bullet } from './entities/Bullet';
import { NanoCore } from './entities/NanoCore';
import { UIManager } from './UIManager';
import { Cannon } from './entities/Cannon';
import { AssetManager } from './AssetManager';

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

    // 难度数值
    private hpMultiplier: number = 1.0;
    private spawnRate: number = 1.0;
    private rewardMultiplier: number = 1.0;

    // 武器库定义
    private weaponCatalog = [
        { id: 'cannon_base', name: '标准激光', cost: 0 },
        { id: 'fish_tuna_mode', name: '机械鱼模组', cost: 1000 },
        { id: 'gatling', name: '等离子加特林', cost: 3000 },
        { id: 'heavy', name: '重爆核能炮', cost: 8000 },
        { id: 'lightning', name: '连锁闪电', cost: 15000 }
    ];

    constructor(app: PIXI.Application, config: any) {
        this.app = app;
        this.pool = PoolManager.getInstance();
        
        this.hpMultiplier = config.hpMult || 1.0;
        this.spawnRate = config.spawnRate || 1.0;
        this.rewardMultiplier = config.reward || 1.0;
        
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

        let isDragging = false;

        this.app.stage.on('pointerdown', (e) => {
            isDragging = true;
            onMove(e);
        });

        this.app.stage.on('pointerup', () => isDragging = false);
        this.app.stage.on('pointerupoutside', () => isDragging = false);
        this.app.stage.on('pointercancel', () => isDragging = false);

        this.app.stage.on('pointermove', (e) => {
            if (isDragging || e.buttons > 0 || e.pointerType === 'touch') {
                onMove(e);
            }
        });

        if (typeof (window as any).wx !== 'undefined' && typeof (window as any).wx.onTouchMove === 'function') {
            const wx = (window as any).wx;
            wx.onTouchStart((res: any) => {
                isDragging = true;
                if (res.touches && res.touches.length > 0) {
                    const touch = res.touches[0];
                    const localPos = this.app.stage.toLocal(new PIXI.Point(touch.clientX, touch.clientY));
                    this.cannon.lookAt(localPos.x, localPos.y);
                }
            });
            wx.onTouchMove((res: any) => {
                if (isDragging && res.touches && res.touches.length > 0) {
                    const touch = res.touches[0];
                    const localPos = this.app.stage.toLocal(new PIXI.Point(touch.clientX, touch.clientY));
                    this.cannon.lookAt(localPos.x, localPos.y);
                }
            });
            wx.onTouchEnd(() => isDragging = false);
            wx.onTouchCancel(() => isDragging = false);
        }
    }

    private updateShopUI(): void {
        const weaponsData = this.weaponCatalog.map(w => {
            const lvl = this.weaponLevels[w.id] || 1;
            return {
                ...w,
                unlocked: this.unlockedWeapons.includes(w.id),
                active: this.unlockedWeapons[this.currentWeaponIndex] === w.id,
                level: lvl,
                upgradeCost: 500 * Math.pow(2, lvl - 1),
                isMax: lvl >= 5
            };
        });

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

        this.spawnTimer += delta * this.spawnRate;
        if (this.spawnTimer > 15) {
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
                
                // 优化碰撞：使用更精确的中心点检测，避免 getBounds 带来的性能开销和偏差
                const dx = Math.abs(b.x - f.x);
                const dy = Math.abs(b.y - f.y);
                
                // 根据鱼的类型动态设定判定范围 (鱼的缩放后的物理范围)
                const hitW = (Math.abs(f.width) / 2) * 0.8;
                const hitH = (Math.abs(f.height) / 2) * 0.8;

                if (dx < hitW && dy < hitH) {
                    b.kill();
                    const id = this.unlockedWeapons[this.currentWeaponIndex];
                    const lvl = this.weaponLevels[id] || 1;
                    this.onHitEffect(id, b.x, b.y, lvl);

                    if (id === 'heavy') {
                        // 爆炸武器 AOE (使用平方检测)
                        const rangeSq = Math.pow(150 + lvl*20, 2);
                        for (const target of this.fishes) {
                            if (!target.isActive) continue;
                            const tdx = target.x - b.x;
                            const tdy = target.y - b.y;
                            if (tdx*tdx + tdy*tdy < rangeSq) {
                                this.applyDamage(target, b.damage * 0.5);
                            }
                        }
                    } else if (id === 'lightning') {
                        this.applyDamage(f, b.damage);
                        // 增加 50% 连锁数量 (基础 3 变 5)
                        this.triggerChainLightning(f, 5+lvl, b.damage*0.5); 
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
                break;
            case 'heavy':
                this.spawnParticles(x, y, 15, 0xffaa00, 5);
                this.spawnShockwave(x, y, 1.0 + lvl*0.2);
                SceneManager.shake(10, 150);
                break;
            case 'lightning': this.spawnParticles(x, y, 5, 0x00ffff, 4);
                break;
            default:
                this.spawnParticles(x, y, 3, 0xcccccc, 1);
        }
    }

    private triggerChainLightning(startFish: Fish, maxCount: number, dmg: number): void {
        let current = startFish;
        let count = 0;
        const hitSet = new Set<Fish>([startFish]);

        while(count < maxCount) {
            let next: Fish | null = null;
            let minDist = 300;

            for(const f of this.fishes) {
                if(!f.isActive || hitSet.has(f)) continue;
                const d = Math.sqrt(Math.pow(f.x-current.x,2)+Math.pow(f.y-current.y,2));
                if(d < minDist) {
                    minDist = d;
                    next = f;
                }
            }

            if(next) {
                this.spawnLightning(current.x, current.y, next.x, next.y);
                this.applyDamage(next, dmg);
                hitSet.add(next);
                current = next;
                count++;
            } else break;
        }
    }

    private applyDamage(fish: Fish, dmg: number): void {
        const isDead = fish.takeDamage(dmg);
        if (isDead) {
            const roll = Math.random();
            const val = ((fish as any).isBoss ? 500 : (roll > 0.8 ? 50 : 10)) * 2 * this.rewardMultiplier;
            this.crystals += val;
            UIManager.updateHUD(this.crystals);
            
            this.spawnParticles(fish.x, fish.y, 20, 0xffffff, 8);
            this.spawnParticles(fish.x, fish.y, 10, 0x00f0ff, 12);

            if (Math.random() < 0.15) this.spawnNanoCore(fish.x, fish.y);
        }
    }

    private spawnFish(): void {
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const x = side === 'left' ? -200 : SceneManager.width + 200;
        const y = 100 + Math.random() * (SceneManager.height - 300);
        
        const isBoss = Math.random() < 0.03;
        const fish = this.pool.get('fish', () => new Fish());
        if (fish) {
            // 将难度乘数注入 window 以便 Fish 实体访问，避开构造函数爆炸
            (window as any).DmgMultCurrent = this.hpMultiplier;
            fish.spawn(x, y, side, isBoss);
            SceneManager.getLayer(Layers.Game).addChild(fish);
            this.fishes.push(fish);
        }
    }

    private spawnNanoCore(x: number, y: number): void {
        const core = this.pool.get('core', () => new NanoCore());
        if (core) {
            core.spawn(x, y);
            SceneManager.getLayer(Layers.Game).addChild(core);
            this.cores.push(core);
        }
    }

    private spawnParticles(x: number, y: number, count: number, color: number, intensity: number): void {
        for(let i=0; i<count; i++) {
            const p = this.pool.get('particle', () => new Particle());
            if(p) {
                p.spawn(x, y, color, intensity);
                SceneManager.getLayer(Layers.FX).addChild(p);
                this.particles.push(p);
            }
        }
    }

    private spawnShockwave(x: number, y: number, scale: number): void {
        const s = this.pool.get('shockwave', () => new Shockwave());
        if(s) {
            s.spawn(x, y, scale);
            SceneManager.getLayer(Layers.FX).addChild(s);
            this.shockwaves.push(s);
        }
    }

    private spawnLightning(x1: number, y1: number, x2: number, y2: number): void {
        const l = this.pool.get('lightning', () => new Lightning());
        if(l) {
            l.spawn(x1, y1, x2, y2);
            SceneManager.getLayer(Layers.FX).addChild(l);
            this.lightnings.push(l);
        }
    }

    private updateEntities(list: any[], type: string, delta: number): void {
        for (let i = list.length - 1; i >= 0; i--) {
            const entity = list[i];
            entity.update(delta);
            
            if (type === 'core' && entity.isActive) {
                const dx = entity.x - this.cannon.x;
                const dy = entity.y - this.cannon.y;
                if (Math.sqrt(dx*dx + dy*dy) < 80) {
                    this.crystals += 500;
                    UIManager.updateHUD(this.crystals);
                    this.spawnParticles(entity.x, entity.y, 30, 0x00ffbb, 15);
                    entity.kill();
                    UIManager.showFloatingText(entity.x, entity.y, "+500 核心奖励", 0x00ffbb);
                }
            }

            if (!entity.isActive) {
                list.splice(i, 1);
                this.pool.put(type, entity);
            }
        }
    }
}
