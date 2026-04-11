import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Cannon } from './entities/Cannon';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { WEAPONS } from './config/weapons.config';
import { LEVELS } from './config/levels.config';
import { EventBus } from './core/EventBus';
import { GameEvents } from './core/GameEvents';
import { UIBridge } from './core/UIBridge';
import type { GameContext } from './systems/GameContext';
import { EffectSystem } from './systems/EffectSystem';
import { SpawnSystem } from './systems/SpawnSystem';
import { CombatSystem } from './systems/CombatSystem';
import { WeaponSystem } from './systems/WeaponSystem';
import { InputSystem } from './systems/InputSystem';
import { StatusSystem } from './systems/StatusSystem';
import { AttackSystem } from './systems/AttackSystem';

/**
 * GameController — 游戏会话协调层
 * 负责创建共享上下文、初始化各子系统，并在每帧按序调度它们。
 */
export class GameController {
    private ctx: GameContext;
    private bridge: UIBridge;
    private effects: EffectSystem;
    private spawner: SpawnSystem;
    private status: StatusSystem;
    private attacks: AttackSystem;
    private combat: CombatSystem;
    private weapons: WeaponSystem;
    private input: InputSystem;
    private tickerFunc: (delta: number) => void;

    constructor(app: PIXI.Application, config: any, dialogueLines?: any[], onBack?: () => void, stageLevel: number = 0) {
        const pool = PoolManager.getInstance();
        const cannon = new Cannon();
        cannon.x = SceneManager.width / 2;
        cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.Player).addChild(cannon);

        this.ctx = {
            app,
            pool,
            cannon,
            fishes: [], bullets: [], cores: [],
            particles: [], shockwaves: [], lightnings: [],
            electrified: [],
            corroded: [],
            crystals: 2000,
            weaponLevels: {},
            unlockedWeapons: ['cannon_base', 'fish_tuna_mode', 'gatling', 'heavy', 'lightning'],
            currentWeaponIndex: 0,
            hpMultiplier: config.hpMult || 1.0,
            spawnRate: config.spawnRate || 1.0,
            rewardMultiplier: config.reward || 1.0,
            comboCount: 0,
            comboTimer: 0,
            isPaused: false,
            isAutoMode: true,
            isManualAiming: false,
            manualAimX: 0,
            manualAimY: 0,
            frozenTime: 0,
            stageLevel,
            stageBossQueue: [],
            stageBossNames: [],
            stageBossSpawnTimer: 0,
            stageBossSpawnInterval: 0,
            stageBossesTotal: 0,
            stageBossesKilled: 0,
            berserkTimer: 0,
            isBerserk: false,
            berserkCharge: 0,
        };

        if (stageLevel > 0) {
            const lvl = LEVELS.find(l => l.id === stageLevel);
            if (lvl) {
                this.ctx.stageBossQueue = lvl.bosses.map(b => b.bossKey);
                this.ctx.stageBossNames = lvl.bosses.map(b => b.name);
                this.ctx.stageBossesTotal = lvl.bosses.length;
                this.ctx.stageBossSpawnInterval = lvl.bossSpawnInterval;
                this.ctx.stageBossSpawnTimer = lvl.bossSpawnInterval;
            }
        }

        const savedLevels = SaveManager.state.weaponLevels || {};
        for (const w of WEAPONS) {
            this.ctx.weaponLevels[w.id] = savedLevels[w.id] ?? 1;
        }

        this.bridge = new UIBridge();
        this.bridge.init();
        this.effects = new EffectSystem(this.ctx);
        this.spawner = new SpawnSystem(this.ctx, this.effects);
        this.status = new StatusSystem(this.ctx, this.effects, (fish, dmg) => {
            this.combat.applyDamage(fish, dmg, { allowCrit: false, allowComboOnKill: false, showText: true });
        });
        this.attacks = new AttackSystem(this.ctx, (fish, dmg) => {
            this.combat.applyDamage(fish, dmg);
        }, this.status);
        this.combat = new CombatSystem(this.ctx, this.effects, this.spawner, this.status, this.attacks);
        this.weapons = new WeaponSystem(this.ctx, this.effects);
        this.input = new InputSystem(app, cannon, () => this.ctx.isPaused, this.ctx);

        this.initBackButton(app, onBack);
        this.input.init();
        this.weapons.updateShopUI();
        if (stageLevel > 0) this.initStageEvents(app, stageLevel, onBack);

        this.tickerFunc = (delta: number) => {
            if (this.ctx.isPaused) return;
            try { this.update(delta); } catch (err: any) {
                if (err.message.includes('Resource')) return;
                console.error('Update Crash:', err.message);
            }
        };
        app.ticker.add(this.tickerFunc);

        if (dialogueLines && dialogueLines.length > 0) {
            this.ctx.isPaused = true;
            UIManager.showDialogue(dialogueLines).then(() => {
                this.ctx.isPaused = false;
                this.spawner.preWarm();
            });
        } else {
            this.spawner.preWarm();
        }
    }

    private initStageEvents(app: PIXI.Application, stageLevel: number, onBack?: () => void): void {
        const lvlDef = LEVELS.find(l => l.id === stageLevel);

        // Boss登场对话
        const bossSpawnUnsub = EventBus.on(GameEvents.STAGE_BOSS_SPAWNED, (payload: any) => {
            const bossEntry = lvlDef?.bosses.find(b => b.bossKey === payload.bossKey);
            if (bossEntry?.spawnDialogue && bossEntry.spawnDialogue.length > 0) {
                this.ctx.isPaused = true;
                UIManager.showDialogue(bossEntry.spawnDialogue).then(() => {
                    this.ctx.isPaused = false;
                });
            }
        });

        // 通关处理
        const stageClearUnsub = EventBus.on(GameEvents.STAGE_CLEAR, (payload: any) => {
            bossSpawnUnsub();
            stageClearUnsub();
            this.ctx.isPaused = true;
            import('./SaveManager').then(({ SaveManager }) => {
                if (!SaveManager.state.clearedStages.includes(payload.levelId)) {
                    SaveManager.state.clearedStages.push(payload.levelId);
                    SaveManager.save();
                }
            });
            UIManager.showConfirm(
                `异常清除完毕！\n本局收益: ${UIManager.formatNumber(Math.floor(this.ctx.crystals))} 晶体`,
                `✓ 第 ${payload.levelId} 关 通关！`
            ).then(ok => {
                this.destroy();
                if (onBack) onBack();
                else {
                    SceneManager.getLayer(Layers.UI).removeChildren();
                    UIManager.init(app, (cfg) => new GameController(app, cfg));
                }
            });
        });
    }

    private initBackButton(app: PIXI.Application, onBack?: () => void): void {
        const backBtn = new PIXI.Container();
        backBtn.x = 20; backBtn.y = SceneManager.height - 66;
        const btnBg = new PIXI.Graphics()
            .beginFill(0x050e1a, 0.9).lineStyle(2, 0xff4444, 0.9)
            .drawRoundedRect(0, 0, 130, 44, 10).endFill();
        const btnTxt = new PIXI.Text('撤退返回', { fontFamily: 'Verdana', fontSize: 16, fill: 0xff8888, fontWeight: 'bold' });
        btnTxt.anchor.set(0.5); btnTxt.x = 65; btnTxt.y = 22;
        backBtn.addChild(btnBg, btnTxt);
        backBtn.eventMode = 'static'; backBtn.cursor = 'pointer';
        backBtn.on('pointerdown', () => {
            UIManager.showConfirm('确定要放弃本次猎杀并返回总部吗？', '⚠ 撤退确认').then(ok => {
                if (ok) {
                    this.destroy();
                    if (onBack) {
                        onBack();
                    } else {
                        SceneManager.getLayer(Layers.Game).removeChildren();
                        SceneManager.getLayer(Layers.Bullet).removeChildren();
                        SceneManager.getLayer(Layers.FX).removeChildren();
                        SceneManager.getLayer(Layers.UI).removeChildren();
                        UIManager.init(app, (cfg) => new GameController(app, cfg));
                    }
                }
            });
        });
        SceneManager.getLayer(Layers.UI).addChild(backBtn);
    }

    public destroy(): void {
        this.ctx.app.ticker.remove(this.tickerFunc);
        this.ctx.app.stage.off('pointerdown');
        this.ctx.app.stage.off('pointerup');
        this.ctx.app.stage.off('pointermove');
        if (this.ctx.app.stage.hitArea) this.ctx.app.stage.hitArea = null;

        [...this.ctx.fishes, ...this.ctx.bullets, ...this.ctx.cores,
        ...this.ctx.particles, ...this.ctx.shockwaves, ...this.ctx.lightnings].forEach(e => {
            if (e.parent) e.parent.removeChild(e);
            if (e.kill) e.kill();
        });
        this.ctx.fishes = []; this.ctx.bullets = []; this.ctx.cores = [];
        this.ctx.particles = []; this.ctx.shockwaves = []; this.ctx.lightnings = [];

        if (this.ctx.cannon?.parent) this.ctx.cannon.parent.removeChild(this.ctx.cannon);

        SceneManager.getLayer(Layers.Game).removeChildren();
        SceneManager.getLayer(Layers.Bullet).removeChildren();
        SceneManager.getLayer(Layers.FX).removeChildren();
        UIManager.hideHUD();
        this.weapons.destroy();
        this.bridge.destroy();
    }

    private update(delta: number): void {
        // 防止切后台/卡顿导致 delta 巨大，从而“刚生成就被更新/销毁”，出现发射但看不到特效/子弹的情况
        const dt = Math.min(delta, 3);
        if (this.ctx.frozenTime > 0) { this.ctx.frozenTime -= dt; return; }

        SceneManager.update(dt);
        this.spawner.update(dt);
        if (this.ctx.isAutoMode) this.weapons.handleAutoFire(dt);

        this.updateEntities(this.ctx.fishes, 'fish', dt);
        this.updateEntities(this.ctx.bullets, 'bullet', dt);
        this.updateEntities(this.ctx.cores, 'core', dt);
        this.updateEntities(this.ctx.particles, 'particle', dt);
        this.updateEntities(this.ctx.shockwaves, 'shockwave', dt);
        this.updateEntities(this.ctx.lightnings, 'lightning', dt);

        this.spawner.checkCorePickup();
        this.status.update(dt);
        this.combat.checkCollisions(dt);

        if (this.ctx.comboTimer > 0) {
            this.ctx.comboTimer -= dt;
            if (this.ctx.comboTimer <= 0) {
                this.ctx.comboCount = 0;
                EventBus.emit(GameEvents.UI_COMBO, { count: 0 });
            }
        }
    }

    private updateEntities(list: any[], type: string, delta: number): void {
        for (let i = list.length - 1; i >= 0; i--) {
            const entity = list[i];
            entity.update(delta);
            if (!entity.isActive) {
                // 核心修复：彻底从显示层级移除，防止渲染泄露
                if (entity.parent) {
                    entity.parent.removeChild(entity);
                }
                list.splice(i, 1);
                this.ctx.pool.put(type, entity);
            }
        }
    }
}
