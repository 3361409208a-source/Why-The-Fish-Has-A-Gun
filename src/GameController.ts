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
    
    // 武器系统 (初始全部解锁)
    private unlockedWeapons: string[] = ['cannon_base', 'fish_tuna_mode', 'gatling', 'heavy', 'lightning'];
    private currentWeaponIndex: number = 0;
    private skinMap: {[key: string]: string} = {
        'cannon_base': 'cannon_v3',
        'gatling': 'skin_gatling',
        'heavy': 'skin_heavy',
        'lightning': 'skin_lightning',
        'fish_tuna_mode': 'skin_tuna'
    };
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

    private comboCount: number = 0;
    private comboTimer: number = 0;
    private lastComboValue: number = 0;

    constructor(app: PIXI.Application, config: any) {
        this.app = app;
        this.pool = PoolManager.getInstance();
        
        this.hpMultiplier = config.hpMult || 1.0;
        this.spawnRate = config.spawnRate || 1.0;
        this.rewardMultiplier = config.reward || 1.0;
        
        const skins = {
            'skin_heavy': 'assets/skin_heavy.png',
            'skin_tuna': 'assets/skin_tuna.png',
            'skin_lightning': 'assets/skin_lightning.png'
        };
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

        // [核心优化]：开局即高潮：预先在屏幕内刷出 15-25 只鱼，避免开局等待两边进场
        const preWarmCount = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < preWarmCount; i++) {
            this.spawnFish(
                undefined, 
                200 + Math.random() * (SceneManager.width - 400) // X 轴随机分布在屏幕内
            );
        }
    }

    private initCannon(): void {
        this.cannon = new Cannon();
        this.cannon.x = SceneManager.width / 2;
        this.cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.UI).addChild(this.cannon);

        // 添加“返回主页”按钮
        const backBtn = new PIXI.Container();
        backBtn.x = 20; backBtn.y = SceneManager.height - 60;
        
        const bg = new PIXI.Graphics().beginFill(0x333333, 0.8).lineStyle(2, 0xff0000).drawRoundedRect(0, 0, 120, 40, 5).endFill();
        const txt = new PIXI.Text("退出猎杀", { fontSize: 18, fill: 0xffffff });
        txt.anchor.set(0.5); txt.x = 60; txt.y = 20;
        backBtn.addChild(bg, txt);
        
        backBtn.eventMode = 'static';
        backBtn.cursor = 'pointer';
        backBtn.on('pointerdown', () => {
            if (confirm("确定要放弃本次猎杀并返回总部吗？")) {
                location.reload(); // 最彻底的清理方式
            }
        });
        SceneManager.getLayer(Layers.UI).addChild(backBtn);
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
            AssetManager.playSound('upgrade'); 
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
        // 动态波次间隔：根据难度调整，难度越高（spawnRate越大），出怪间隔越短
        const baseInterval = 180 / this.spawnRate;
        if (this.spawnTimer > (baseInterval + Math.random() * baseInterval)) { 
            // 每一波出怪数量也随难度弹性变化
            const maxSwarm = Math.min(6, Math.floor(1 + this.spawnRate * 1.5));
            const swarmCount = Math.floor(Math.random() * maxSwarm) + 1;
            
            // 垂直分布：一波鱼往往出生在相近的高度，形成真实鱼群感
            const baseSpawnY = 100 + Math.random() * (SceneManager.height - 300);
            
            for (let i = 0; i < swarmCount; i++) {
                setTimeout(() => {
                    if (this.fishes.length < 150) {
                        this.spawnFish(baseSpawnY + (Math.random() - 0.5) * 80);
                    }
                }, i * (Math.random() * 300 + 150));
            }
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

        // 连击计时器
        if (this.comboTimer > 0) {
            this.comboTimer -= delta;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
                UIManager.updateCombo(0);
            }
        }
    }

    private handleAutoFire(delta: number): void {
        const id = this.unlockedWeapons[this.currentWeaponIndex];
        this.autoFireTimer += delta;
        // 连锁闪电射速降低 50% (从 6 帧一发降至 12 帧一发)
        let interval = (id === 'gatling') ? 2 : (id === 'heavy' ? 18 : (id === 'lightning' ? 12 : 6));
        
        const fireRateMult = (window as any).TalentFireRateMult || 1.0;
        if (this.autoFireTimer > interval / fireRateMult) {
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
        AssetManager.playSound('shoot'); // 播放开火音效
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
                    
                    // [核心优化]：将粒子效果和爆炸位置锁定在鱼的中心点 (f.x, f.y)，即便子弹刚触碰到边缘
                    this.onHitEffect(id, f.x, f.y, lvl);

                    if (id === 'heavy') {
                        // 爆炸武器 AOE (使用平方检测)
                        const rangeSq = Math.pow(150 + lvl*20, 2);
                        for (const target of this.fishes) {
                            if (!target.isActive) continue;
                            const tdx = target.x - b.x;
                            const tdy = target.y - b.y;
                            if (tdx*tdx + tdy*tdy < rangeSq) {
                                const dmgMult = (window as any).TalentDmgMult || 1.0;
                                this.applyDamage(target, b.damage * 0.5 * dmgMult);
                            }
                        }
                    } else if (id === 'lightning') {
                        AssetManager.playSound('lightning'); // 播放闪电音效
                        const dmgMult = (window as any).TalentDmgMult || 1.0;
                        this.applyDamage(f, b.damage * dmgMult);
                        this.triggerChainLightning(f, 5+lvl, b.damage*0.5 * dmgMult); 
                    } else {
                        AssetManager.playSound('hit'); // 普通受击音效
                        const dmgMult = (window as any).TalentDmgMult || 1.0;
                        this.applyDamage(f, b.damage * dmgMult);
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
                AssetManager.playSound('explosion'); // 重炮爆炸音效
                this.spawnParticles(x, y, 15, 0xffaa00, 5);
                this.spawnShockwave(x, y, 1.0 + lvl*0.2);
                SceneManager.shake(10, 150);
                break;
            case 'lightning': 
                this.spawnParticles(x, y, 5, 0x00ffff, 4);
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
        // 1. 连击累加与收益
        this.comboCount++;
        this.comboTimer = 120; // 2秒冷却
        const comboBonus = 1 + Math.min(2.0, this.comboCount * 0.01); // 最高 200% 连击伤害加成
        UIManager.updateCombo(this.comboCount);

        // 2. 暴击逻辑
        const critChance = (window as any).TalentCritChance || 0;
        let finalDmg = dmg * comboBonus; // 伤害受连击加成
        let isCrit = false;
        if (Math.random() < critChance) {
            finalDmg *= 3.0; // 强化暴击倍率到 3 倍，让暴击更爽
            isCrit = true;
        }

        // 3. 显示具体的血量伤害数字 (数值越大，弹出速度越快)
        const dmgText = isCrit ? `CRIT ${Math.floor(finalDmg)}` : `${Math.floor(finalDmg)}`;
        const dmgColor = isCrit ? 0xff3300 : (this.comboCount > 50 ? 0xffcc00 : 0xffffff);
        UIManager.showFloatingText(fish.x, fish.y - fish.height/2, dmgText, dmgColor);

        const isDead = fish.takeDamage(finalDmg);
        if (isDead) {
            const roll = Math.random();
            const goldMult = (window as any).TalentGoldMult || 1.0;
            // 连击越高，金币掉落越多 (额外 50% 连击金币红利)
            const val = ((fish as any).isBoss ? 500 : (roll > 0.8 ? 50 : 10)) * 2 * this.rewardMultiplier * goldMult * (1 + this.comboCount * 0.005);
            this.crystals += val;
            
            // 重要：将本次获得的晶体按比例实时同步到永久金币中 (1:1 转换)
            import('./SaveManager').then(({SaveManager}) => {
                SaveManager.state.gold += Math.floor(val);
                SaveManager.save();
            });

            UIManager.updateHUD(this.crystals);
            
            this.spawnParticles(fish.x, fish.y, 20, 0xffffff, 8);
            this.spawnParticles(fish.x, fish.y, 10, 0x00f0ff, 12);

            if (Math.random() < 0.15) this.spawnNanoCore(fish.x, fish.y);
        }
    }

    private spawnFish(preferredY?: number, preferredX?: number): void {
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const x = preferredX !== undefined ? preferredX : (side === 'left' ? -200 : SceneManager.width + 200);
        const y = preferredY !== undefined ? preferredY : 100 + Math.random() * (SceneManager.height - 300);
        
        // BOSS 出现频率极大降低，并随难度系数微调
        // 基础概率 0.5%，简单难度极难出，地狱难度才会频繁出
        const bossThreshold = 0.005 * this.spawnRate;
        const isBoss = Math.random() < bossThreshold;
        
        const fish = this.pool.get('fish', () => new Fish());
        if (fish) {
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
