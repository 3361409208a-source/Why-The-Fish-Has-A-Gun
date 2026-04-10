import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Cannon } from './entities/Cannon';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { WEAPONS } from './config/weapons.config';
import { EventBus } from './core/EventBus';
import { GameEvents } from './core/GameEvents';
import { UIBridge } from './core/UIBridge';
import type { GameContext } from './systems/GameContext';
import { EffectSystem } from './systems/EffectSystem';
import { SpawnSystem } from './systems/SpawnSystem';
import { CombatSystem } from './systems/CombatSystem';
import { WeaponSystem } from './systems/WeaponSystem';
import { InputSystem } from './systems/InputSystem';

/**
 * GameController — 游戏会话协调层
 * 负责创建共享上下文、初始化各子系统，并在每帧按序调度它们。
 */
export class GameController {
    private ctx: GameContext;
    private bridge: UIBridge;
    private effects: EffectSystem;
    private spawner: SpawnSystem;
    private combat: CombatSystem;
    private weapons: WeaponSystem;
    private input: InputSystem;
    private tickerFunc: (delta: number) => void;

    constructor(app: PIXI.Application, config: any, dialogueLines?: any[], onBack?: () => void) {
        const pool = PoolManager.getInstance();
        const cannon = new Cannon();
        cannon.x = SceneManager.width / 2;
        cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.UI).addChild(cannon);

        this.ctx = {
            app,
            pool,
            cannon,
            fishes: [], bullets: [], cores: [],
            particles: [], shockwaves: [], lightnings: [],
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
            frozenTime: 0,
        };

        const savedLevels = SaveManager.state.weaponLevels || {};
        for (const w of WEAPONS) {
            this.ctx.weaponLevels[w.id] = savedLevels[w.id] ?? 1;
        }

        this.bridge  = new UIBridge();
        this.bridge.init();
        this.effects = new EffectSystem(this.ctx);
        this.spawner = new SpawnSystem(this.ctx, this.effects);
        this.combat  = new CombatSystem(this.ctx, this.effects, this.spawner);
        this.weapons = new WeaponSystem(this.ctx, this.effects);
        this.input   = new InputSystem(app, cannon, () => this.ctx.isPaused);

        this.initBackButton(app, onBack);
        this.input.init();
        this.weapons.updateShopUI();

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
        if (this.ctx.frozenTime > 0) { this.ctx.frozenTime -= delta; return; }

        SceneManager.update(delta);
        this.spawner.update(delta);
        if (this.ctx.isAutoMode) this.weapons.handleAutoFire(delta);

        this.updateEntities(this.ctx.fishes, 'fish', delta);
        this.updateEntities(this.ctx.bullets, 'bullet', delta);
        this.updateEntities(this.ctx.cores, 'core', delta);
        this.updateEntities(this.ctx.particles, 'particle', delta);
        this.updateEntities(this.ctx.shockwaves, 'shockwave', delta);
        this.updateEntities(this.ctx.lightnings, 'lightning', delta);

        this.spawner.checkCorePickup();
        this.combat.checkCollisions();

        if (this.ctx.comboTimer > 0) {
            this.ctx.comboTimer -= delta;
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
                list.splice(i, 1);
                this.ctx.pool.put(type, entity);
            }
        }
    }
}
