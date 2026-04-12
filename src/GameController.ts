import * as PIXI from 'pixi.js';
import { PoolManager } from './PoolManager';
import { SceneManager, Layers } from './SceneManager';
import { Cannon } from './entities/Cannon';
import { UIManager } from './UIManager';
import { SaveManager } from './SaveManager';
import { WEAPONS } from './config/weapons.config';
import { LEVELS, getLayerLevels, getLayerAreaLevels, LAYER_CONFIGS, LEVELS_PER_AREA } from './config/levels.config';
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
    private bridge!: UIBridge;
    private effects!: EffectSystem;
    private spawner!: SpawnSystem;
    private status!: StatusSystem;
    private attacks!: AttackSystem;
    private combat!: CombatSystem;
    private weapons!: WeaponSystem;
    private input!: InputSystem;
    private tickerFunc!: (delta: number) => void;
    private onRestartLevel?: (config: any) => void;

    constructor(app: PIXI.Application, config: any, dialogueLines?: any[], onBack?: () => void, stageLevel: number = 0, onRestartLevel?: (config: any) => void) {
        this.onRestartLevel = onRestartLevel;

        // 获取当前层和区域配置（支持无限区域系统）
        const currentLayer = config.layer || SaveManager.state.currentLayer || 1;
        const currentArea = config.area || SaveManager.state.currentArea[String(currentLayer)] || 1;
        const areaLevels = getLayerAreaLevels(currentLayer, currentArea);

        // 先初始化游戏上下文（不包含cannon等视觉元素）
        this.ctx = {
            app,
            pool: PoolManager.getInstance(),
            cannon: null as any, // 稍后初始化
            fishes: [], bullets: [], cores: [],
            particles: [], shockwaves: [], lightnings: [],
            electrified: [],
            corroded: [],
            radiated: [],
            crystals: 2000,
            weaponLevels: {},
            unlockedWeapons: ['cannon_base', 'fish_tuna_mode', 'gatling', 'heavy', 'lightning'],
            currentWeaponIndex: 0,
            hpMultiplier: config.hpMult || 1.0,
            spawnRate: config.spawnRate || 1.0,
            rewardMultiplier: config.reward || 1.0,
            comboCount: 0,
            comboTimer: 0,
            isPaused: false, // 初始不暂停，游戏元素先初始化
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
        };

        if (stageLevel > 0) {
            // 计算区域内的本地关卡ID（1-10）
            const levelInArea = ((stageLevel - 1) % LEVELS_PER_AREA) + 1;
            const lvl = areaLevels[levelInArea - 1];
            if (lvl) {
                this.ctx.stageBossSpawnInterval = lvl.bossSpawnInterval;
                this.ctx.stageBossSpawnTimer = 60; // 首个Boss 1秒后生成
                // 应用层+区域难度倍率
                this.ctx.hpMultiplier = lvl.hpMult;
                this.ctx.spawnRate = lvl.spawnRate;
                this.ctx.rewardMultiplier = lvl.reward;
            }
        }

        const savedLevels = SaveManager.state.weaponLevels || {};
        for (const w of WEAPONS) {
            this.ctx.weaponLevels[w.id] = savedLevels[w.id] ?? 1;
        }

        // 初始化关卡分数显示（使用区域关卡数据）
        if (stageLevel > 0) {
            const levelInArea = ((stageLevel - 1) % LEVELS_PER_AREA) + 1;
            const nextLevelInArea = levelInArea + 1;
            const nextLvl = nextLevelInArea <= LEVELS_PER_AREA
                ? areaLevels[nextLevelInArea - 1]
                : null;
            const requiredScore = nextLvl ? nextLvl.unlockScore : 0;
            UIManager.updateStageScore(0, requiredScore, stageLevel);
        }

        // 先初始化游戏元素，确保游戏画面显示
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

        // 确保UI层可见并显示HUD
        SceneManager.getLayer(Layers.UI).visible = true;
        if (stageLevel > 0 || config.isEndless) {
            import('./UIManager').then(({ UIManager }) => {
                UIManager.updateHUD(this.ctx.crystals);
                import('./ui/battle/BattleHUD').then(({ BattleHUD }) => {
                    BattleHUD.show();
                });
                import('./ui/battle/WeaponShopPanel').then(({ WeaponShopPanel }) => {
                    WeaponShopPanel.show();
                });
            });
        }

        if (stageLevel > 0) {
            this.initStageEvents(app, stageLevel, onBack, currentLayer, currentArea);
        } else if (config.isEndless) {
            this.initEndlessEvents(config.endlessLevel ?? 1, onBack);
        }

        this.tickerFunc = (delta: number) => {
            if (this.ctx.isPaused) return;
            try { this.update(delta); } catch (err: any) {
                if (err.message.includes('Resource')) return;
                console.error('Update Crash:', err.message);
            }
        };
        app.ticker.add(this.tickerFunc);

        this.spawner.preWarm();

        // 显示开场白（如果有），游戏画面已经在背景中显示
        if (dialogueLines && dialogueLines.length > 0) {
            this.ctx.isPaused = true;
            UIManager.showDialogue(dialogueLines).then(() => {
                this.ctx.isPaused = false;
            });
        }
    }

    private initStageEvents(app: PIXI.Application, stageLevel: number, onBack: (() => void) | undefined, currentLayer: number, currentArea: number): void {
        const areaLevels = getLayerAreaLevels(currentLayer, currentArea);
        const levelInArea = ((stageLevel - 1) % LEVELS_PER_AREA) + 1;
        const lvlDef = areaLevels[levelInArea - 1];

        // Boss登场对话
        const bossSpawnUnsub = EventBus.on(GameEvents.STAGE_BOSS_SPAWNED, () => {
            if (lvlDef && lvlDef.spawnDialogue && lvlDef.spawnDialogue.length > 0) {
                this.ctx.isPaused = true;
                UIManager.showDialogue(lvlDef.spawnDialogue).then(() => {
                    this.ctx.isPaused = false;
                });
            }
        });

        // 分数达标 → 显示解锁提示
        const unlockReachedUnsub = EventBus.on(GameEvents.STAGE_UNLOCK_REACHED, (payload: { currentScore: number; requiredScore: number; nextLevelName: string }) => {
            this.ctx.isPaused = true;
            import('./UIManager').then(({ UIManager }) => {
                UIManager.showStageUnlockPrompt(payload.currentScore, payload.requiredScore, payload.nextLevelName).then((choice) => {
                    this.ctx.isPaused = false;
                    if (choice === 'next') {
                        // 下一关：直接开始下一关
                        const nextLevelInArea = levelInArea + 1;
                        if (nextLevelInArea <= LEVELS_PER_AREA) {
                            // 使用数组索引获取下一关（areaLevels是按关卡顺序排列的）
                            const nextLvl = areaLevels[nextLevelInArea - 1];
                            const nextGlobalLevel = nextLvl.id; // 直接使用全局ID
                            const restartCallback = this.onRestartLevel;
                            if (nextLvl && restartCallback) {
                                // 保存当前分数到存档（同步）
                                import('./SaveManager').then(({ SaveManager }) => {
                                    const layerKey = String(currentLayer);
                                    const levelKey = String(stageLevel);
                                    if (!SaveManager.state.layerStageScores[layerKey]) {
                                        SaveManager.state.layerStageScores[layerKey] = {};
                                    }
                                    const prev = SaveManager.state.layerStageScores[layerKey][levelKey] || 0;
                                    if (this.ctx.stageScore > prev) {
                                        SaveManager.state.layerStageScores[layerKey][levelKey] = this.ctx.stageScore;
                                    }
                                    // 解锁下一关
                                    if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                                        SaveManager.state.unlockedLayerStages[layerKey] = [];
                                    }
                                    if (!SaveManager.state.unlockedLayerStages[layerKey].includes(nextGlobalLevel)) {
                                        SaveManager.state.unlockedLayerStages[layerKey].push(nextGlobalLevel);
                                    }
                                    SaveManager.save();
                                    // 保存完成后销毁并开始下一关
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
                                });
                            }
                        }
                    } else if (choice === 'exit') {
                        // 退出：返回大厅
                        this.destroy();
                        if (onBack) {
                            onBack();
                        }
                    }
                    // 继续：什么都不做，直接继续当前关卡
                });
            });
        });

        // Boss被击杀 → 记录分数 → 冷却后重新生成Boss
        const bossKilledUnsub = EventBus.on(GameEvents.STAGE_BOSS_KILLED, () => {
            this.ctx.stageBossAlive = false;
            this.ctx.stageBossSpawnTimer = this.ctx.stageBossSpawnInterval;

            // Boss击杀时也检查是否弹出下一关提示（不依赖分数门槛）
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

            // 更新本关最高分到存档（分层+分区存储）
            import('./SaveManager').then(({ SaveManager }) => {
                const layerKey = String(currentLayer);
                const levelKey = String(stageLevel);

                // 初始化层数据（如果不存在）
                if (!SaveManager.state.layerStageScores[layerKey]) {
                    SaveManager.state.layerStageScores[layerKey] = {};
                }
                if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                    SaveManager.state.unlockedLayerStages[layerKey] = [];
                }
                if (!SaveManager.state.unlockedLayerAreas[layerKey]) {
                    SaveManager.state.unlockedLayerAreas[layerKey] = [1];
                }

                const prev = SaveManager.state.layerStageScores[layerKey][levelKey] || 0;
                if (this.ctx.stageScore > prev) {
                    SaveManager.state.layerStageScores[layerKey][levelKey] = this.ctx.stageScore;
                }

                // 检查是否解锁下一关（区域内）
                const nextLevelInArea = levelInArea + 1;
                if (nextLevelInArea <= LEVELS_PER_AREA) {
                    // 使用数组索引获取下一关（areaLevels是按关卡顺序排列的）
                    const nextLvl = areaLevels[nextLevelInArea - 1];
                    if (nextLvl && this.ctx.stageScore >= nextLvl.unlockScore) {
                        const nextGlobalLevel = nextLvl.id; // 直接使用全局ID
                        if (!SaveManager.state.unlockedLayerStages[layerKey].includes(nextGlobalLevel)) {
                            SaveManager.state.unlockedLayerStages[layerKey].push(nextGlobalLevel);
                        }
                    }
                }

                // 检查是否解锁下一区域（第10关通关）
                if (levelInArea === LEVELS_PER_AREA) {
                    const nextArea = currentArea + 1;
                    if (!SaveManager.state.unlockedLayerAreas[layerKey].includes(nextArea)) {
                        SaveManager.state.unlockedLayerAreas[layerKey].push(nextArea);
                        // 解锁下一区域的第1关
                        const nextAreaFirstLevel = nextArea * LEVELS_PER_AREA + 1;
                        if (!SaveManager.state.unlockedLayerStages[layerKey].includes(nextAreaFirstLevel)) {
                            SaveManager.state.unlockedLayerStages[layerKey].push(nextAreaFirstLevel);
                        }
                    }
                }

                // 检查是否解锁下一层（第10关通关且平均分解锁）
                if (levelInArea === LEVELS_PER_AREA && currentArea >= 3) {
                    import('./config/levels.config').then(({ isLayerUnlocked }) => {
                        const nextLayer = currentLayer + 1;
                        if (isLayerUnlocked(nextLayer, SaveManager.state.layerStageScores)) {
                            if (!SaveManager.state.unlockedLayers.includes(nextLayer)) {
                                SaveManager.state.unlockedLayers.push(nextLayer);
                            }
                        }
                    });
                }

                SaveManager.save();
            });
        });

        // 撤退时也保存分数
        const cleanup = () => {
            bossSpawnUnsub();
            unlockReachedUnsub();
            bossKilledUnsub();
            import('./SaveManager').then(({ SaveManager }) => {
                const layerKey = String(currentLayer);
                const levelKey = String(stageLevel);

                if (!SaveManager.state.layerStageScores[layerKey]) {
                    SaveManager.state.layerStageScores[layerKey] = {};
                }

                const prev = SaveManager.state.layerStageScores[layerKey][levelKey] || 0;
                if (this.ctx.stageScore > prev) {
                    SaveManager.state.layerStageScores[layerKey][levelKey] = this.ctx.stageScore;
                }

                const nextLevelInArea = levelInArea + 1;
                if (nextLevelInArea <= LEVELS_PER_AREA) {
                    // 使用数组索引获取下一关（areaLevels是按关卡顺序排列的）
                    const nextLvl = areaLevels[nextLevelInArea - 1];
                    if (nextLvl && this.ctx.stageScore >= nextLvl.unlockScore) {
                        const nextGlobalLevel = nextLvl.id; // 直接使用全局ID
                        if (!SaveManager.state.unlockedLayerStages[layerKey]?.includes(nextGlobalLevel)) {
                            if (!SaveManager.state.unlockedLayerStages[layerKey]) {
                                SaveManager.state.unlockedLayerStages[layerKey] = [];
                            }
                            SaveManager.state.unlockedLayerStages[layerKey].push(nextGlobalLevel);
                        }
                    }
                }
                SaveManager.save();
            });
        };

        // 将 cleanup 绑定到 destroy
        const origDestroy = this.destroy.bind(this);
        this.destroy = () => {
            cleanup();
            origDestroy();
        };
    }

    private initEndlessEvents(endlessLevel: number, onBack: (() => void) | undefined): void {
        const saveScore = () => {
            import('./SaveManager').then(({ SaveManager }) => {
                const key = String(endlessLevel);
                const prev = SaveManager.state.endlessScores[key] ?? 0;
                if (this.ctx.stageScore > prev) {
                    SaveManager.state.endlessScores[key] = this.ctx.stageScore;
                    SaveManager.save();
                }
            });
        };

        const origDestroy = this.destroy.bind(this);
        this.destroy = () => {
            saveScore();
            origDestroy();
        };
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
        if (this.tickerFunc) {
            this.ctx.app.ticker.remove(this.tickerFunc);
        }
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
        this.ctx.electrified = []; this.ctx.corroded = []; this.ctx.radiated = [];

        if (this.ctx.cannon?.parent) this.ctx.cannon.parent.removeChild(this.ctx.cannon);

        SceneManager.getLayer(Layers.Player).removeChildren(); // 清理玩家层
        SceneManager.getLayer(Layers.Game).removeChildren();
        SceneManager.getLayer(Layers.Bullet).removeChildren();
        SceneManager.getLayer(Layers.FX).removeChildren();
        SceneManager.getLayer(Layers.Story).removeChildren(); // 清理对话层
        // 不清理UI层，因为menuContainer由UIManager管理
        SceneManager.getLayer(Layers.UI).visible = true; // 确保UI层可见
        UIManager.hideHUD();
        if (this.weapons) this.weapons.destroy();
        if (this.bridge) this.bridge.destroy();
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
