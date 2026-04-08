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

export class GameController {
    private app: PIXI.Application;
    private pool: PoolManager;
    private cannon!: Cannon;
    private isAutoMode: boolean = true;
    private autoFireTimer: number = 0;

    // 武器解锁系统 [NEW]
    private unlockedWeapons: string[] = ['cannon_base'];
    private currentWeaponIndex: number = 0;
    
    private fishes: Fish[] = [];
    private bullets: Bullet[] = [];
    private cores: NanoCore[] = [];
    private particles: Particle[] = [];
    private shockwaves: Shockwave[] = [];
    private frozenTime: number = 0;


    private spawnTimer: number = 0;

    // 武器商品库 (暂时全部使用 jgwuqi.png)
    private weaponCatalog = [
        { id: 'cannon_base', name: '标准激光武器', cost: 0, unlocked: true, visual: 'cannon_base' },
        { id: 'fish_tuna_mode', name: '机械鱼模式', cost: 10, unlocked: false, visual: 'cannon_base' },
        { id: 'gatling', name: '等离子加特林', cost: 30, unlocked: false, visual: 'cannon_base' },
        { id: 'heavy', name: '重爆核能炮', cost: 100, unlocked: false, visual: 'cannon_base' },
        { id: 'lightning', name: '连锁闪电', cost: 200, unlocked: false, visual: 'cannon_base' }
    ];

    constructor(app: PIXI.Application) {
        console.log('GameController constructor started');
        this.app = app;
        this.pool = PoolManager.getInstance();
        
        this.initCannon();
        this.initInteraction();
        this.updateShopUI();
        
        // 恢复：Pixi v7 传入的是 delta (number)
        app.ticker.add((delta: number) => {
            try {
                this.update(delta);
            } catch (err: any) {
                console.log('FATAL CRASH in Ticker:', err.message, err.stack);
                app.ticker.stop();
            }
        });
        console.log('GameController constructor finished');
    }

    private updateShopUI(): void {
        const uiData = this.weaponCatalog.map(w => ({
            ...w,
            active: this.unlockedWeapons[this.currentWeaponIndex] === w.id
        }));
        UIManager.setupShop(uiData, (id) => this.handleShopSelect(id));
    }

    private handleShopSelect(id: string): void {
        const item = this.weaponCatalog.find(w => w.id === id);
        if (!item) return;

        if (item.unlocked) {
            // 切换
            const index = this.unlockedWeapons.indexOf(id);
            if (index !== -1) {
                this.currentWeaponIndex = index;
                // 暂时强制使用激光武器图
                this.cannon.switchTexture('cannon_base');
                this.updateShopUI();
            }
        } else {
            // 尝试购买
            if (UIManager.subtractScore(item.cost)) {
                item.unlocked = true;
                this.unlockedWeapons.push(id);
                this.currentWeaponIndex = this.unlockedWeapons.length - 1;
                // 暂时强制使用激光武器图
                this.cannon.switchTexture('cannon_base');
                this.updateShopUI();
                UIManager.showFloatingText(SceneManager.width/2, SceneManager.height/2, `解锁成功：${item.name}`, 0x00ff00);
            } else {
                UIManager.showFloatingText(SceneManager.width - 150, 100, "晶体不足!", 0xff0000);
            }
        }
    }

    private initCannon(): void {
        this.cannon = new Cannon();
        this.cannon.x = SceneManager.width / 2;
        this.cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.UI).addChild(this.cannon);
    }

    private switchWeapon(): void {
        if (this.unlockedWeapons.length <= 1) return;
        this.currentWeaponIndex = (this.currentWeaponIndex + 1) % this.unlockedWeapons.length;
        const nextWeapon = this.unlockedWeapons[this.currentWeaponIndex];
        this.cannon.switchTexture(nextWeapon);
        this.updateShopUI();
    }

    private initInteraction(): void {
        try {
            // 确保全屏可交互：设置一个巨大的点击区域，覆盖整个可能的可视范围
            this.app.stage.eventMode = 'static';
            this.app.stage.hitArea = new PIXI.Rectangle(-2000, -2000, 5000, 5000); 

            const onMove = (e: PIXI.FederatedPointerEvent) => {
                const localPos = e.getLocalPosition(this.app.stage);
                this.cannon.lookAt(localPos.x, localPos.y);
            };

            this.app.stage.on('pointerdown', (e) => {
                onMove(e);
            });

            this.app.stage.on('pointermove', (e) => {
                // 支持按住拖动或移动端滑动瞄准
                if (e.buttons > 0 || e.pointerType === 'touch') {
                    onMove(e);
                }
            });

            console.log('Interaction stabilized with global hitArea');
        } catch (e: any) {
            console.log('initInteraction Error:', e.message);
        }
    }


    private fire(x: number, y: number, angle: number): void {
        try {
            const isPlasma = this.unlockedWeapons[this.currentWeaponIndex] === 'fish_tuna';
            const bullet = this.pool.get('bullet', () => new Bullet());
            if (!bullet) return;

            bullet.setType(isPlasma ? 'plasma' : 'laser');
            bullet.fire(x, y, angle);
            
            const layer = SceneManager.getLayer(Layers.Game);
            if (layer) {
                layer.addChild(bullet);
                this.bullets.push(bullet);
            }

            // 开火闪光 (Muzzle Flash)
            this.spawnParticles(x + Math.cos(angle) * 30, y + Math.sin(angle) * 30, 3);
        } catch (fireErr: any) {
            console.log('Fire Logic Error:', fireErr.message);
        }
    }

    private spawnFish(): void {
        const fish = this.pool.get('fish', () => new Fish());
        if (!fish) return;
        
        const side = Math.random() > 0.5 ? 'left' : 'right';
        const isBoss = Math.random() < 0.05; // 5% 概率出 Boss
        
        const x = side === 'right' ? SceneManager.width + 50 : -50;
        const y = Math.random() * (SceneManager.height - 150) + 50;
        
        fish.spawn(x, y, side, isBoss);
        
        const layer = SceneManager.getLayer(Layers.Game);
        if (layer) {
            layer.addChild(fish);
            this.fishes.push(fish);
        }
    }

    private dropCore(x: number, y: number, isGolden: boolean = false): void {
        const core = this.pool.get('core', () => new NanoCore());
        if (!core) return;
        core.spawn(x, y, isGolden);
        const layer = SceneManager.getLayer(Layers.Game);
        if (layer) {
            layer.addChild(core);
            this.cores.push(core);
        }
    }

    private update(delta: number): void {
        try {
            // 打击感：顿帧系统
            if (this.frozenTime > 0) {
                this.frozenTime -= delta;
                return; // 暂停后续逻辑，只更新特效
            }

            // 0. 特效更新
            SceneManager.update(delta);
            this.checkWeaponUnlock();

            // 1. 鱼群生成
            this.spawnTimer += delta;
            if (this.spawnTimer > 40) { // 大幅提升出鱼速度
                this.spawnFish();
                this.spawnTimer = 0;
            }

            // 1.5 自动瞄准与连发 [NEW]
            if (this.isAutoMode) {
                this.handleAutoFire(delta);
            }

            // 2. 实体更新
            this.updateEntities(this.fishes, 'fish', delta);
            this.updateEntities(this.bullets, 'bullet', delta);
            this.updateEntities(this.cores, 'core', delta);
            this.updateEntities(this.particles, 'particle', delta);
            this.updateEntities(this.shockwaves, 'shockwave', delta);

            // 3. 碰撞检测
            this.checkCollisions();
        } catch (e) {
            console.error('Update loop error:', e);
        }
    }

    private handleAutoFire(delta: number): void {
        const currentWeapon = this.unlockedWeapons[this.currentWeaponIndex];
        this.autoFireTimer += delta;

        let fireInterval = 15;
        if (currentWeapon === 'gatling') fireInterval = 3; // 加特林极速
        if (currentWeapon === 'heavy') fireInterval = 40;  // 重炮缓慢

        if (this.autoFireTimer > fireInterval) {
            const angle = this.cannon.getFireAngle();
            
            if (currentWeapon === 'fish_tuna') {
                // 三路散射
                this.fire(this.cannon.x, this.cannon.y, angle);
                this.fire(this.cannon.x, this.cannon.y, angle - 0.2);
                this.fire(this.cannon.x, this.cannon.y, angle + 0.2);
            } else if (currentWeapon === 'gatling') {
                this.fire(this.cannon.x, this.cannon.y, angle);
            } else if (currentWeapon === 'heavy' || currentWeapon === 'lightning') {
                this.fire(this.cannon.x, this.cannon.y, angle);
            } else {
                this.fire(this.cannon.x, this.cannon.y, angle);
            }
            this.autoFireTimer = 0;
        }
    }

    private findNearestFish(): Fish | null {
        let nearest: Fish | null = null;
        let minDist = Infinity;

        for (const fish of this.fishes) {
            if (!fish.isActive) continue;
            
            const dx = fish.x - this.cannon.x;
            const dy = fish.y - this.cannon.y;
            const dist = dx * dx + dy * dy;

            if (dist < minDist) {
                minDist = dist;
                nearest = fish;
            }
        }
        return nearest;
    }

    private checkWeaponUnlock(): void {
        // [MODIFIED] 移除自动解锁逻辑，现在通过商店购买
    }

    private updateEntities(list: any[], type: string, delta: number): void {
        if (!list || !Array.isArray(list)) {
            console.log(`Warning: list for ${type} is invalid`);
            return;
        }
        
        for (let i = list.length - 1; i >= 0; i--) {
            const entity = list[i];
            if (!entity) continue;
            
            try {
                if (typeof entity.update === 'function') {
                    entity.update(delta);
                }

                // 子弹拖尾效果 (仅限活跃子弹)
                if (type === 'bullet' && entity.isActive) {
                    (entity as any).trailTimer += delta;
                    if ((entity as any).trailTimer > 2) {
                        this.spawnParticles(entity.x, entity.y, 1);
                        (entity as any).trailTimer = 0;
                    }
                }
            } catch (e) {
                console.log(`Entity update error [${type}]:`, e);
            }

            if (!entity.isActive) {
                // 特殊处理核心收集：如果已经走到回收点失活，增加分数
                if (type === 'core') {
                    const val = (entity as NanoCore).value || 1;
                    UIManager.addScore(val);
                    
                    // 弹出飘字特效
                    const color = val >= 10 ? 0xffd700 : 0x00ff00;
                    const text = val >= 10 ? "JACKPOT! +10" : `+${val}`;
                    UIManager.showFloatingText(entity.x, entity.y - 20, text, color);
                }
                this.pool.put(type, entity);
                list.splice(i, 1);
            }
        }
    }

    private spawnParticles(x: number, y: number, count: number): void {
        const layer = SceneManager.getLayer(Layers.Game);
        for (let i = 0; i < count; i++) {
            const p = this.pool.get('particle', () => new Particle());
            if (p) {
                p.spawn(x, y);
                layer.addChild(p);
                this.particles.push(p);
            }
        }
    }

    private spawnShockwave(x: number, y: number, scale: number): void {
        const layer = SceneManager.getLayer(Layers.Game);
        const s = this.pool.get('shockwave', () => new Shockwave());
        if (s) {
            s.spawn(x, y, scale);
            layer.addChild(s);
            this.shockwaves.push(s);
        }
    }

    private checkCollisions(): void {
        // 确保数组存在
        if (!this.bullets || !this.fishes) return;

        for (const bullet of this.bullets) {
            if (!bullet || !bullet.isActive) continue;
            for (const fish of this.fishes) {
                if (!fish || !fish.isActive) continue;
                
                const dx = Math.abs(bullet.x - fish.x);
                const dy = Math.abs(bullet.y - fish.y);
                
                // 精准 Box 碰撞检测：根据鱼的实际宽高进行判定
                const halfW = Math.abs(fish.width) / 2;
                const halfH = Math.abs(fish.height) / 2;

                if (dx < halfW && dy < halfH) {
                    bullet.kill();
                    
                    const currentWeapon = this.unlockedWeapons[this.currentWeaponIndex];
                    
                    if (currentWeapon === 'heavy') {
                        this.spawnShockwave(bullet.x, bullet.y, 1.5);
                        for (const targetFish of this.fishes) {
                            if (!targetFish.isActive) continue;
                            const d_aoe = Math.sqrt(Math.pow(targetFish.x - bullet.x, 2) + Math.pow(targetFish.y - bullet.y, 2));
                            if (d_aoe < 150) {
                                this.applyDamage(targetFish, 5);
                            }
                        }
                    } else if (currentWeapon === 'lightning') {
                        // 闪电弹射：击中第一个，然后弹射 3 个最近的
                        this.applyDamage(fish, 2);
                        this.triggerChainLightning(fish, 3);
                    } else {
                        this.applyDamage(fish, 1);
                    }
                    break;
                }
            }
        }
    }

    private triggerChainLightning(startFish: Fish, jumps: number): void {
        let current = startFish;
        let visited = new Set([startFish]);
        
        for (let j = 0; j < jumps; j++) {
            let next: Fish | null = null;
            let minDist = 300; // 弹射距离限制
            
            for (const f of this.fishes) {
                if (!f.isActive || visited.has(f)) continue;
                const d = Math.sqrt(Math.pow(f.x - current.x, 2) + Math.pow(f.y - current.y, 2));
                if (d < minDist) {
                    minDist = d;
                    next = f;
                }
            }
            
            if (next) {
                this.drawLightningArc(current.x, current.y, next.x, next.y);
                this.applyDamage(next, 2);
                visited.add(next);
                current = next;
            } else break;
        }
    }

    private drawLightningArc(x1: number, y1: number, x2: number, y2: number): void {
        const graphics = new PIXI.Graphics();
        const layer = SceneManager.getLayer(Layers.Game);
        layer.addChild(graphics);
        
        const segments = 5;
        graphics.lineStyle(3, 0x00f0ff, 1);
        graphics.moveTo(x1, y1);
        
        let lastX = x1;
        let lastY = y1;
        
        for (let i = 1; i <= segments; i++) {
            const tx = x1 + (x2 - x1) * (i / segments) + (Math.random() - 0.5) * 30;
            const ty = y1 + (y2 - y1) * (i / segments) + (Math.random() - 0.5) * 30;
            graphics.lineTo(tx, ty);
            lastX = tx;
            lastY = ty;
        }
        graphics.lineTo(x2, y2);
        
        // 瞬间消失特效
        let alpha = 1.0;
        const tick = (delta: number) => {
            alpha -= 0.1 * delta;
            graphics.alpha = alpha;
            if (alpha <= 0) {
                graphics.destroy();
                PIXI.Ticker.shared.remove(tick);
            }
        };
        PIXI.Ticker.shared.add(tick);
    }

    private applyDamage(fish: Fish, dmg: number): void {
        if (!fish.isActive) return;
        
        if (fish.takeDamage(dmg)) {
            // 产生火花粒子
            this.spawnParticles(fish.x, fish.y, 5);
            
            if (fish.hp <= 0) {
                fish.kill();
                
                // 爆率逻辑 (老虎机式爽感)
                const roll = Math.random();
                const isGolden = roll < 0.1 || (fish as any).isBoss; // Boss 必掉金核
                
                if (isGolden) {
                    this.dropCore(fish.x, fish.y, true);
                    UIManager.showFloatingText(fish.x, fish.y, "JACKPOT!!", 0xffd700);
                    SceneManager.shake(15, 30);
                    this.spawnShockwave(fish.x, fish.y, 2.0);
                    this.frozenTime = 5;
                } else if (roll < 0.3) {
                    for (let k = 0; k < 5; k++) {
                        this.dropCore(fish.x + (Math.random() - 0.5) * 40, fish.y + (Math.random() - 0.5) * 40);
                    }
                    UIManager.showFloatingText(fish.x, fish.y, "BIG WIN!", 0x00f0ff);
                    SceneManager.shake(8, 15);
                    this.spawnShockwave(fish.x, fish.y, 1.2);
                } else {
                    this.dropCore(fish.x, fish.y);
                    SceneManager.shake(4, 10);
                }

                // 击杀粒子
                this.spawnParticles(fish.x, fish.y, 15);
            } else {
                SceneManager.shake(2, 5);
            }
        }
    }
}
