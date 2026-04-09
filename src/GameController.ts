import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Fish } from './entities/Fish';
import { Bullet } from './entities/Bullet';
import { NanoCore } from './entities/NanoCore';
import { UIManager } from './UIManager';
import { Cannon } from './entities/Cannon';
import { AssetManager } from './AssetManager';
import { SaveManager } from './SaveManager';
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
        { id: 'lightning', name: '连锁闪电', cost: 15000 },
        // --- 永久商城英雄武器 ---
        { id: 'railgun', name: '热能轨道炮', cost: 50000 },
        { id: 'void', name: '虚空投影仪', cost: 120000 },
        { id: 'acid', name: '生化孢子炮', cost: 300000 }
    ];

    private comboCount: number = 0;
    private comboTimer: number = 0;
    private lastComboValue: number = 0;

    private isPaused: boolean = false;
    private tickerFunc: (delta: number) => void;
    private onBack?: () => void;

    constructor(app: PIXI.Application, config: any, dialogueLines?: any[], onBack?: () => void) {
        this.app = app;
        this.onBack = onBack;
        this.pool = PoolManager.getInstance();
        
        this.hpMultiplier = config.hpMult || 1.0;
        this.spawnRate = config.spawnRate || 1.0;
        this.rewardMultiplier = config.reward || 1.0;
        
        this.initCannon();
        this.initInteraction();

        // 绑定更新函数
        this.tickerFunc = (delta: number) => {
            if (this.isPaused) return; // 关键：剧情期间锁定整个逻辑引擎
            try {
                this.update(delta);
            } catch (err: any) {
                if (err.message.includes('Resource')) return;
                console.error('Update Crash:', err.message);
            }
        };
        app.ticker.add(this.tickerFunc);

        const savedLevels = SaveManager.state.weaponLevels || {};
        for (const id of Object.keys(this.weaponLevels)) {
            if (savedLevels[id]) this.weaponLevels[id] = savedLevels[id];
        }
        this.updateShopUI();
        
        // 如果有剧情，先进入强制暂停模式
        if (dialogueLines && dialogueLines.length > 0) {
            this.isPaused = true;
            
            UIManager.showDialogue(dialogueLines).then(() => {
                this.isPaused = false;
                // 剧情结束后再预热出怪
                this.preWarm();
            });
        } else {
            this.preWarm();
        }
    }

    private preWarm(): void {
        const preWarmCount = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < preWarmCount; i++) {
            this.spawnFish(undefined, 200 + Math.random() * (SceneManager.width - 400));
        }
    }

    public destroy(): void {
        this.app.ticker.remove(this.tickerFunc);
        this.app.stage.off('pointerdown');
        this.app.stage.off('pointerup');
        this.app.stage.off('pointermove');
        
        // 清理由本控制器添加的所有阶段监听器或容器
        if (this.app.stage.hitArea) this.app.stage.hitArea = null;

        // 清理所有实体
        [...this.fishes, ...this.bullets, ...this.cores, ...this.particles, ...this.shockwaves, ...this.lightnings].forEach(e => {
            if (e.parent) e.parent.removeChild(e);
            if (e.kill) e.kill();
        });
        
        this.fishes = []; this.bullets = []; this.cores = [];
        this.particles = []; this.shockwaves = []; this.lightnings = [];
        
        if (this.cannon && this.cannon.parent) {
            this.cannon.parent.removeChild(this.cannon);
        }
    }

    private initCannon(): void {
        this.cannon = new Cannon();
        this.cannon.x = SceneManager.width / 2;
        this.cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.UI).addChild(this.cannon);

        const backBtn = new PIXI.Container();
        backBtn.x = 20; backBtn.y = SceneManager.height - 66;
        
        const btnBg = new PIXI.Graphics()
            .beginFill(0x050e1a, 0.9).lineStyle(2, 0xff4444, 0.9)
            .drawRoundedRect(0, 0, 130, 44, 10).endFill();
        const btnTxt = new PIXI.Text("撤退返回", { 
            fontFamily: 'Verdana', fontSize: 16, fill: 0xff8888, fontWeight: 'bold' 
        });
        btnTxt.anchor.set(0.5); btnTxt.x = 65; btnTxt.y = 22;
        backBtn.addChild(btnBg, btnTxt);
        
        backBtn.eventMode = 'static'; backBtn.cursor = 'pointer';
        backBtn.on('pointerdown', () => {
            UIManager.showConfirm("确定要放弃本次猎杀并返回总部吗？", "⚠ 撤退确认").then(ok => {
                if (ok) {
                    if (this.onBack) {
                        this.onBack();
                    } else {
                        // 降级原逻辑
                        this.destroy();
                        SceneManager.getLayer(Layers.Game).removeChildren();
                        SceneManager.getLayer(Layers.Bullet).removeChildren();
                        SceneManager.getLayer(Layers.FX).removeChildren();
                        SceneManager.getLayer(Layers.UI).removeChildren();
                        UIManager.init(this.app);
                        UIManager.showMapSelection((config) => {
                            new GameController(this.app, config);
                        });
                    }
                }
            });
        });
        SceneManager.getLayer(Layers.UI).addChild(backBtn);
    }

    private initInteraction(): void {
        this.app.stage.eventMode = 'static';
        this.app.stage.hitArea = new PIXI.Rectangle(-1000, -1000, 3000, 3000); 

        const onMove = (e: PIXI.FederatedPointerEvent) => {
            if (this.isPaused) return; // 剧情期间禁止旋转和操作
            const localPos = e.getLocalPosition(this.app.stage);
            this.cannon.lookAt(localPos.x, localPos.y);
        };

        let isDragging = false;

        this.app.stage.on('pointerdown', (e) => {
            if (this.isPaused) return;
            isDragging = true;
            onMove(e);
        });

        this.app.stage.on('pointerup', () => isDragging = false);
        this.app.stage.on('pointerupoutside', () => isDragging = false);
        this.app.stage.on('pointercancel', () => isDragging = false);

        this.app.stage.on('pointermove', (e) => {
            if (this.isPaused) return;
            if (isDragging || e.buttons > 0 || e.pointerType === 'touch') {
                onMove(e);
            }
        });

        if (typeof (window as any).wx !== 'undefined' && typeof (window as any).wx.onTouchMove === 'function') {
            const wx = (window as any).wx;
            wx.onTouchStart((res: any) => {
                if (this.isPaused) return;
                isDragging = true;
                if (res.touches && res.touches.length > 0) {
                    const touch = res.touches[0];
                    const localPos = this.app.stage.toLocal(new PIXI.Point(touch.clientX, touch.clientY));
                    this.cannon.lookAt(localPos.x, localPos.y);
                }
            });
            wx.onTouchMove((res: any) => {
                if (this.isPaused) return;
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
        const goldUnlocked = SaveManager.state.goldUnlockedWeapons || [];
        // 过滤：基础武器 + 永久解锁的英雄武器
        const filteredCatalog = this.weaponCatalog.filter(w => 
            !['railgun', 'void', 'acid'].includes(w.id) || goldUnlocked.includes(w.id)
        );

        const weaponsData = filteredCatalog.map(w => {
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
            // [修复] 升级后同步到存档中
            import('./SaveManager').then(({ SaveManager }) => {
                SaveManager.state.weaponLevels = { ...this.weaponLevels };
                SaveManager.save();
            });
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
        // 攻击速度平衡
        let interval = (id === 'gatling') ? 2 : 
                       (id === 'heavy' ? 18 : 
                       (id === 'lightning' ? 24 : 
                       (id === 'railgun' ? 36 : 
                       (id === 'void' ? 60 : 
                       (id === 'acid' ? 28 : 6)))));
        
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
        AssetManager.playSound('shoot');
        SceneManager.getLayer(Layers.Bullet).addChild(b); // 子弹层：在鱼上方，特效下方
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
        // [修复] 所有武器击中都有一个快速闪光环，这就是「击中动画」
        this.spawnHitFlash(x, y);
        switch(id) {
            case 'gatling':
                this.spawnParticles(x, y, 6, 0xffff00, 4);
                break;
            case 'heavy':
                AssetManager.playSound('explosion');
                this.spawnParticles(x, y, 18, 0xffaa00, 6);
                this.spawnShockwave(x, y, 1.0 + lvl*0.2);
                SceneManager.shake(10, 150);
                break;
            case 'lightning': 
                this.spawnParticles(x, y, 8, 0x00ffff, 5);
                break;
            default:
                this.spawnParticles(x, y, 4, 0xffffff, 2);
        }
    }

    // [新增] 击中闪光环动画
    private spawnHitFlash(x: number, y: number): void {
        const flash = new PIXI.Graphics();
        flash.lineStyle(3, 0xffffff, 0.9);
        flash.drawCircle(0, 0, 1);
        flash.x = x;
        flash.y = y;
        SceneManager.getLayer(Layers.FX).addChild(flash);

        let r = 1;
        let alpha = 0.9;
        const tick = () => {
            r += 6;
            alpha -= 0.12;
            flash.clear();
            flash.lineStyle(3, 0xffffff, alpha);
            flash.drawCircle(0, 0, r);
            if (alpha > 0) {
                requestAnimationFrame(tick);
            } else {
                SceneManager.getLayer(Layers.FX).removeChild(flash);
            }
        };
        tick();
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
        // 连击加成（击杀时才+1，见下方 isDead 判断）
        const comboBonus = 1 + Math.min(2.0, this.comboCount * 0.05); // 每1连击+5%伤害，20连击即翻倍

        // 暴击逻辑
        const critChance = (window as any).TalentCritChance || 0;
        let finalDmg = dmg * comboBonus;
        let isCrit = false;
        if (Math.random() < critChance) {
            finalDmg *= 3.0;
            isCrit = true;
        }

        // 显示伤害数字
        const dmgText = `${Math.floor(finalDmg)}`;
        const dmgColor = isCrit ? 0xff3300 : (this.comboCount > 20 ? 0xffcc00 : 0xffffff);
        UIManager.showFloatingText(fish.x, fish.y - fish.height/2, dmgText, dmgColor, isCrit);

        const isDead = fish.takeDamage(finalDmg);
        if (isDead) {
            // 击杀才触发连击+1
            this.comboCount++;
            this.comboTimer = 180; // 3秒内必须继续击杀，否则连击清零
            UIManager.updateCombo(this.comboCount);

            const roll = Math.random();
            const goldMult = (window as any).TalentGoldMult || 1.0;
            const val = ((fish as any).isBoss ? 500 : (roll > 0.8 ? 50 : 10)) * 2 * this.rewardMultiplier * goldMult * (1 + this.comboCount * 0.005);
            this.crystals += val;
            
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
        const sideRoll = Math.random();
        let side: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
        let x: number, y: number;

        // 基础出生点计算
        if (preferredX !== undefined && preferredY !== undefined) {
            x = preferredX; y = preferredY;
        } else {
            if (sideRoll < 0.35) { side = 'left'; x = -300; y = 100 + Math.random() * (SceneManager.height - 300); }
            else if (sideRoll < 0.7) { side = 'right'; x = SceneManager.width + 300; y = 100 + Math.random() * (SceneManager.height - 300); }
            else if (sideRoll < 0.85) { x = 100 + Math.random() * (SceneManager.width - 200); y = -300; }
            else { x = 100 + Math.random() * (SceneManager.width - 200); y = SceneManager.height + 300; }
        }

        // --- 鱼群化改造：随机触发“鱼群爆发” ---
        // 15% 概率生成一整波鱼群（8-15只），共享大致相同的航线
        const isSchool = Math.random() < 0.15 && preferredX === undefined;
        const schoolSize = isSchool ? (8 + Math.floor(Math.random() * 8)) : 1;
        
        // 预设群体共同的目标偏移
        const groupTargetX = SceneManager.width / 2 + (Math.random() - 0.5) * 600;
        const groupTargetY = SceneManager.height / 2 + (Math.random() - 0.5) * 400;

        for (let i = 0; i < schoolSize; i++) {
            const bossThreshold = 0.005 * this.spawnRate;
            const isBoss = Math.random() < bossThreshold;
            
            const fish = this.pool.get('fish', () => new Fish());
            if (fish) {
                (window as any).DmgMultCurrent = this.hpMultiplier;
                
                // 给群组成员一点位置扰动 (松散阵型)
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 150;
                
                fish.spawn(x + offsetX, y + offsetY, side, isBoss);
                
                // [注入逻辑] 强行修正这只鱼的目标，使其向群体目标靠拢
                if (isSchool) {
                    const angle = Math.atan2(groupTargetY - (y + offsetY), groupTargetX - (x + offsetX));
                    (fish as any).vx = Math.cos(angle) * (fish as any).originalSpeed;
                    (fish as any).vy = Math.sin(angle) * (fish as any).originalSpeed;
                }

                SceneManager.getLayer(Layers.Game).addChild(fish);
                this.fishes.push(fish);
            }
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
