/**
 * [优化] GameController - 核心变更:
 * 1. updateEntities 用 swap-and-pop 替代 splice()（O(n) → O(1)）
 * 2. 每帧开头缓存 Talent 值到 ctx，避免全系统读 window
 * 3. CombatSystem 增加 update() 调用（防抖 save）
 * 4. import 路径修正 Combatsystem → CombatSystem
 */
import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Cannon } from './entities/Cannon';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { WEAPONS } from './config/weapons.config';
import { LEVELS, getLayerLevels, getLayerAreaLevels, LAYER_CONFIGS, LEVELS_PER_AREA, isLayerUnlocked } from './config/levels.config';
import { BattleHUD } from './ui/battle/BattleHUD';
import { WeaponShopPanel } from './ui/battle/WeaponShopPanel';
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

export class GameController {
    private ctx: GameContext;
    private bridge!: UIBridge;
    private effects!: EffectSystem;
    private spawner!: SpawnSystem;
    private status!: StatusSystem;
    private attacks!: AttackSystem;
    private combat!: CombatSystem;
    private weapons!: WeaponSystem;
    private input!: InputSystem;
    private tickFunc!: (delta: number) => void;
    private onRestartLevel?: (config: any) => void;
    private backBtn: PIXI.Container | null = null;

    constructor(app: PIXI.Application, config: any, dialogLines?: any[], onBack?: () => void, stageLevel: number = 0, onRestartLevel?: (config: any) => void) {
        this.onRestartLevel = onRestartLevel;

        const currentLayer = config.layer || SaveManager.state.currentLayer || 1;
        const currentArea = config.area || SaveManager.state.currentArea[String(currentLayer)] || 1;
        const areaLevels = getLayerAreaLevels(currentLayer, currentArea);

        this.ctx = {
            app,
            pool: PoolManager.getInstance(),
            cannon: null as any,
            fishes: [], bullets: [], cores: [],
            particles: [], shockwaves: [], lightnings: [],
            electrified: [], corroded: [], radiated: [],
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
            isEndless: config.isEndless ?? false,
            stageScore: 0,
            stageBossSpawnTimer: 0,
            stageBossSpawnInterval: 0,
            stageBossAlive: false,
            stageUnlockShown: false,
            berserkTimer: 0,
            isBerserk: false,
            berserkCharge: 0,
            // [优化] 缓存字段初始化
            _cachedTalentDmgMult: 1.0,
            _cachedTalentGoldMult: 1.0,
            _cachedTalentCritChance: 0,
            _cachedTalentFireRateMult: 1.0,
            _cachedTalentSpeedMult: 1.0,
        };

        if (stageLevel > 0) {
            const levelInArea = ((stageLevel - 1) % LEVELS_PER_AREA) + 1;
            const lvl = areaLevels[levelInArea - 1];
            if (lvl) {
                this.ctx.stageBossSpawnInterval = lvl.bossSpawnInterval;
                this.ctx.stageBossSpawnTimer = 60;
                this.ctx.hpMultiplier = lvl.hpMult;
                this.ctx.spawnRate = lvl.spawnRate;
                this.ctx.rewardMultiplier = lvl.reward;
            }
        }

        const savedLevels = SaveManager.state.weaponLevels || {};
        for (const w of WEAPONS) {
            this.ctx.weaponLevels[w.id] = savedLevels[w.id] ?? 1;
        }

        if (stageLevel > 0) {
            const levelInArea = ((stageLevel - 1) % LEVELS_PER_AREA) + 1;
            const nextLevelInArea = levelInArea + 1;
            const nextLvl = nextLevelInArea <= LEVELS_PER_AREA
                ? areaLevels[nextLevelInArea - 1]
                : null;
            const requiredScore = nextLvl ? nextLvl.unlockScore : 0;
            UIManager.updateStageScore(0, requiredScore, stageLevel);
        }

        const cannon = new Cannon();
        cannon.x = SceneManager.width / 2;
        cannon.y = SceneManager.height - 20;
        SceneManager.getLayer(Layers.Player).addChild(cannon);
        this.ctx.cannon = cannon;

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

        SceneManager.getLayer(Layers.UI).visible = true;
        if (stageLevel > 0 || config.isEndless) {
            UIManager.updateHUD(this.ctx.crystals);
            BattleHUD.show();
            WeaponShopPanel.show();
        }

        if (stageLevel > 0) {
            this.initStageEvents(app, stageLevel, onBack, currentLayer, currentArea);
        } else if (config.isEndless) {
            this.initEndlessEvents(config.endlessLevel ?? 1, onBack);
        }

        this.tickFunc = (delta: number) => {
            if (this.ctx.isPaused) return;
            try { this.update(delta); } catch (err: any) {
                if (err.message.includes('Resource')) return;
                console.error('Update Crash:', err.message);
            }
        };
        app.ticker.add(this.tickFunc);

        this.spawner.preWarm();

        if (dialogLines && dialogLines.length > 0) {
            this.ctx.isPaused = true;
            UIManager.showDialogue(dialogLines).then(() => {
                this.ctx.isPaused = false;
            });
        }
    }

    private initStageEvents(app: PIXI.Application, stageLevel: number, onBack: (() => void) | undefined, currentLayer: number, currentArea: number): void {
        const areaLevels = getLayerAreaLevels(currentLayer, currentArea);
        const levelInArea = ((stageLevel - 1) % LEVELS_PER_AREA) + 1;
        const lvlDef = areaLevels[levelInArea - 1];

        const bossSpawnUnsub = EventBus.on(GameEvents.STAGE_BOSS_SPAWNED, () => {
            if (lvlDef && lvlDef.spawnDialogue && lvlDef.spawnDialogue.length > 0) {
                this.ctx.isPaused = true;
                UIManager.showDialogue(lvlDef.spawnDialogue).then(() => {
                    this.ctx.isPaused = false;
                });
            }
        });

        const unlockReachedUnsub = EventBus.on(GameEvents.STAGE_UNLOCK_REACHED, (payload: { currentScore: number; requiredScore: number; nextLevelName: string }) => {
            this.ctx.isPaused = true;
            UIManager.showStageUnlockPrompt(payload.currentScore, payload.requiredScore, payload.nextLevelName).then((choice) => {
                this.ctx.isPaused = false;
                if (choice === 'next') {
                    const nextLevelInArea = levelInArea + 1;
                    if (nextLevelInArea <= LEVELS_PER_AREA) {
                        const nextLvl = areaLevels[nextLevelInArea - 1];
                        const nextGlobalLevel = nextLvl?.id;
                        const restartCallback = this.onRestartLevel;
                        if (nextLvl && restartCallback) {
                            const layerKey = String(currentLayer);
                            const levelKey = String(stageLevel);
                            if (!SaveManager.state.layerStageScores[layerKey]) {
                                SaveManager.state.layerStageScores[layerKey] = {};
                            }
                            const prev = SaveManager.state.layerStageScores[layerKey][levelKey] ?? 0;
                            if (this.ctx.stageScore > prev) {
                                SaveManager.state.layerStageScores[layerKey][levelKey] = this.ctx.stageScore;
                            }
                            if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                                SaveManager.state.unlockedLayerStages[layerKey] = [];
                            }
                            if (!SaveManager.state.unlockedLayerStages[layerKey].includes(nextGlobalLevel)) {
                                SaveManager.state.unlockedLayerStages[layerKey].push(nextGlobalLevel);
                            }
                            SaveManager.save();
                            this.destroy();
                            restartCallback({
                                id: nextLvl.bgKey,
                                bgKey: nextLvl.bgKey,
                                hpMult: nextLvl.hpMult,
                                spawnRate: nextLvl.spawnRate,
                                reward: nextLvl.reward,
                                stageLevel: nextGlobalLevel,
                                layer: currentLayer,
                                area: currentArea,
                            });
                        }
                    }
                } else if (choice === 'exit') {
                    this.destroy();
                    if (onBack) onBack();
                }
            });
        });

        const bossKilledUnsub = EventBus.on(GameEvents.STAGE_BOSS_KILLED, () => {
            this.ctx.stageBossAlive = false;
            this.ctx.stageBossSpawnTimer = this.ctx.stageBossSpawnInterval;

            if (!this.ctx.stageUnlockShown) {
                const nextLevelInAreaOnKill = levelInArea + 1;
                if (nextLevelInAreaOnKill <= LEVELS_PER_AREA) {
                    const nextLvlOnKill = areaLevels[nextLevelInAreaOnKill - 1];
                    if (nextLvlOnKill) {
                        this.ctx.stageUnlockShown = true;
                        EventBus.emit(GameEvents.STAGE_UNLOCK_REACHED, {
                            currentScore: this.ctx.stageScore,
                            requiredScore: nextLvlOnKill.unlockScore,
                            nextLevelName: nextLvlOnKill.name,
                        });
                    }
                }
            }

            const layerKey = String(currentLayer);
            const levelKey = String(stageLevel);

            if (!SaveManager.state.layerStageScores[layerKey]) {
                SaveManager.state.layerStageScores[layerKey] = {};
            }
            if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                SaveManager.state.unlockedLayerStages[layerKey] = [];
            }
            if (!SaveManager.state.unlockedLayerAreas[layerKey]) {
                SaveManager.state.unlockedLayerAreas[layerKey] = [1];
            }

            const prev = SaveManager.state.layerStageScores[layerKey][levelKey] ?? 0;
            if (this.ctx.stageScore > prev) {
                SaveManager.state.layerStageScores[layerKey][levelKey] = this.ctx.stageScore;
            }

            const nextLevelInArea = levelInArea + 1;
            if (nextLevelInArea <= LEVELS_PER_AREA) {
                const nextLvl = areaLevels[nextLevelInArea - 1];
                if (nextLvl && this.ctx.stageScore >= nextLvl.unlockScore) {
                    const nextGlobalLevel = nextLvl.id;
                    if (!SaveManager.state.unlockedLayerStages[layerKey]?.includes(nextGlobalLevel)) {
                        if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                            SaveManager.state.unlockedLayerStages[layerKey] = [];
                        }
                        SaveManager.state.unlockedLayerStages[layerKey].push(nextGlobalLevel);
                    }
                }
            }

            if (levelInArea === LEVELS_PER_AREA) {
                const nextArea = currentArea + 1;
                if (!SaveManager.state.unlockedLayerAreas[layerKey].includes(nextArea)) {
                    SaveManager.state.unlockedLayerAreas[layerKey].push(nextArea);
                    const nextAreaFirstLevel = nextArea * LEVELS_PER_AREA + 1;
                    if (!SaveManager.state.unlockedLayerStages[layerKey].includes(nextAreaFirstLevel)) {
                        SaveManager.state.unlockedLayerStages[layerKey].push(nextAreaFirstLevel);
                    }
                }
            }

            if (levelInArea === LEVELS_PER_AREA && currentArea >= 3) {
                const nextPlayer = currentLayer + 1;
                if (isLayerUnlocked(nextPlayer, SaveManager.state.layerStageScores)) {
                    if (!SaveManager.state.unlockedLayers.includes(nextPlayer)) {
                        SaveManager.state.unlockedLayers.push(nextPlayer);
                    }
                }
            }

            SaveManager.save();
        });

        const cleanup = () => {
            bossSpawnUnsub();
            unlockReachedUnsub();
            bossKilledUnsub();
            const layerKey = String(currentLayer);
            const levelKey = String(stageLevel);
            if (!SaveManager.state.layerStageScores[layerKey]) {
                SaveManager.state.layerStageScores[layerKey] = {};
            }
            const prev = SaveManager.state.layerStageScores[layerKey][levelKey] ?? 0;
            if (this.ctx.stageScore > prev) {
                SaveManager.state.layerStageScores[layerKey][levelKey] = this.ctx.stageScore;
            }
            const nextLevelInArea = levelInArea + 1;
            if (nextLevelInArea <= LEVELS_PER_AREA) {
                const nextLvl = areaLevels[nextLevelInArea - 1];
                if (nextLvl && this.ctx.stageScore >= nextLvl.unlockScore) {
                    const nextGlobalLevel = nextLvl.id;
                    if (!SaveManager.state.unlockedLayerStages[layerKey]?.includes(nextGlobalLevel)) {
                        if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                            SaveManager.state.unlockedLayerStages[layerKey] = [];
                        }
                        SaveManager.state.unlockedLayerStages[layerKey].push(nextGlobalLevel);
                    }
                }
            }
            SaveManager.save();
        };

        const origDestroy = this.destroy.bind(this);
        this.destroy = () => {
            cleanup();
            origDestroy();
        };
    }

    private initEndlessEvents(endlessLevel: number, onBack: (() => void) | undefined): void {
        const saveScore = () => {
            const key = String(endlessLevel);
            const prev = SaveManager.state.endlessScores[key] ?? 0;
            if (this.ctx.stageScore > prev) {
                SaveManager.state.endlessScores[key] = this.ctx.stageScore;
                SaveManager.save();
            }
        };
        const origDestroy = this.destroy.bind(this);
        this.destroy = () => {
            saveScore();
            origDestroy();
        };
    }

    private initBackButton(app: PIXI.Application, onBack: (() => void) | undefined): void {
        this.backBtn = new PIXI.Container();
        this.backBtn.x = 20; this.backBtn.y = SceneManager.height - 66;
        const btnBg = new PIXI.Graphics()
            .beginFill(0x05e1a, 0.9).lineStyle(2, 0xff4444, 0.9)
            .drawRoundedRect(0, 0, 130, 44, 10).endFill();
        const btnTxt = new PIXI.Text('返回菜单', { fontFamily: 'Verdana', fontSize: 16, fill: 0xff8888, fontWeight: 'bold' });
        btnTxt.anchor.set(0.5); btnTxt.x = 65; btnTxt.y = 22;
        this.backBtn.addChild(btnBg, btnTxt);
        this.backBtn.eventMode = 'static'; this.backBtn.cursor = 'pointer';
        this.backBtn.hitArea = new PIXI.Rectangle(0, 0, 130, 44);
        this.backBtn.on('pointerdown', () => {
            UIManager.showConfirm('确定要退出当前关卡吗？', '确认').then(ok => {
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
        SceneManager.getLayer(Layers.UI).addChild(this.backBtn);
    }

    public destroy(): void {
        if (this.tickFunc) {
            this.ctx.app.ticker.remove(this.tickFunc);
        }
        if (this.input) {
            this.input.destroy();
        }

        [...this.ctx.fishes, ...this.ctx.bullets, ...this.ctx.cores,
         ...this.ctx.particles, ...this.ctx.shockwaves, ...this.ctx.lightnings].forEach(e => {
            if (e.parent) e.parent.removeChild(e);
            if (e.kill) e.kill();
        });
        this.ctx.fishes = []; this.ctx.bullets = []; this.ctx.cores = [];
        this.ctx.particles = []; this.ctx.shockwaves = []; this.ctx.lightnings = [];
        this.ctx.electrified = []; this.ctx.corroded = []; this.ctx.radiated = [];

        if (this.ctx.cannon?.parent) this.ctx.cannon.parent.removeChild(this.ctx.cannon);

        if (this.backBtn) {
            if (this.backBtn.parent) {
                this.backBtn.parent.removeChild(this.backBtn);
            }
            this.backBtn = null;
        }

        SceneManager.getLayer(Layers.Player).removeChildren();
        SceneManager.getLayer(Layers.Game).removeChildren();
        SceneManager.getLayer(Layers.Bullet).removeChildren();
        SceneManager.getLayer(Layers.FX).removeChildren();
        SceneManager.getLayer(Layers.Story).removeChildren();
        SceneManager.getLayer(Layers.UI).visible = true;
        UIManager.hideHUD();
        if (this.weapons) this.weapons.destroy();
        if (this.bridge) this.bridge.destroy();
    }

    /**
     * [优化] update - 每帧开头缓存 Talent 值
     * 原版每个系统都通过 (window as any).TalentXxx 读取天赋值
     * 在 120 条鱼 + 200 颗子弹的场景下，每帧可能触发数千次 window 属性访问
     */
    private update(delta: number): void {
        const dt = Math.min(delta, 3);
        if (this.ctx.frozenTime > 0) { this.ctx.frozenTime -= dt; return; }

        // [优化] 缓存 Talent 值到 ctx，全系统共用
        this.ctx._cachedTalentDmgMult = (window as any).TalentDmgMult || 1.0;
        this.ctx._cachedTalentGoldMult = (window as any).TalentGoldMult || 1.0;
        this.ctx._cachedTalentCritChance = (window as any).TalentCritChance || 0;
        this.ctx._cachedTalentFireRateMult = (window as any).TalentFireRateMult || 1.0;
        this.ctx._cachedTalentSpeedMult = (window as any).TalentSpeedMult || 1.0;

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
        // [优化] CombatSystem 新增 update() 用于 save 防抖
        this.combat.update(dt);
        this.combat.checkCollisions(dt);

        if (this.ctx.comboTimer > 0) {
            this.ctx.comboTimer -= dt;
            if (this.ctx.comboTimer <= 0) {
                this.ctx.comboCount = 0;
                EventBus.emit(GameEvents.UI_COMBO, { count: 0 });
            }
        }
    }

    /**
     * [优化] updateEntities - 使用 swap-and-pop 替代 splice()
     * 原版 splice(i, 1) 是 O(n) 操作，每次移除都会移动后续所有元素
     * 在 120 条鱼的场景下，如果前几条鱼死亡，splice 会触发大量内存移动
     * swap-and-pop 将待移除元素与末尾交换后 pop，是 O(1) 操作
     * 注意：这会改变数组顺序，但游戏实体的更新顺序不影响正确性
     */
    private updateEntities(list: any[], type: string, delta: number): void {
        let writeIdx = 0;
        for (let i = 0; i < list.length; i++) {
            const entity = list[i];
            entity.update(delta);
            if (entity.isActive) {
                list[writeIdx++] = entity;
            } else {
                if (entity.parent) entity.parent.removeChild(entity);
                this.ctx.pool.put(type, entity);
            }
        }
        list.length = writeIdx;
    }
}
