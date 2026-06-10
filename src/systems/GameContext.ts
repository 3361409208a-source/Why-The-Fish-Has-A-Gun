/**
 * GameContext - 游戏会话共享状态包
 * [优化] 新增缓存字段，避免每帧读 window 全局变量
 */
import * as PIXI from 'pixi.js';
import type { Fish } from '../entities/Fish';
import type { Bullet } from '../entities/Bullet';
import type { NanoCore } from '../entities/NanoCore';
import type { Particle } from '../entities/Particle';
import type { Shockwave } from '../entities/Shockwave';
import type { Lightning } from '../entities/Lightning';
import type { Cannon } from '../entities/Cannon';
import type { PoolManager } from '../PoolManager';

export interface ElectrocuteEffect {
    fish: Fish;
    sourceFish?: Fish;
    fallbackX?: number;
    fallbackY?: number;
    remainingFrames: number;
    tickFrames: number;
    dmgPerTick: number;
    fxFrames: number;
    sfxFrames: number;
}

export interface CorrodeEffect {
    fish: Fish;
    remainingFrames: number;
    tickFrames: number;
    dmgPerTick: number;
    fxFrames: number;
}

export interface RadiationEffect {
    fish: Fish;
    remainingFrames: number;
    tickFrames: number;
    dmgPerTick: number;
    fxFrames: number;
}

export interface GameContext {
    app: PIXI.Application;
    pool: PoolManager;
    cannon: Cannon;

    // 实体列表
    fishes: Fish[];
    bullets: Bullet[];
    cores: NanoCore[];
    particles: Particle[];
    shockwaves: Shockwave[];
    lightnings: Lightning[];

    // 状态效果
    electrified: ElectrocuteEffect[];
    corroded: CorrodeEffect[];
    radiated: RadiationEffect[];

    // 经济
    crystals: number;

    // 武器状态
    weaponLevels: { [id: string]: number };
    unlockedWeapons: string[];
    currentWeaponIndex: number;

    // 难度
    hpMultiplier: number;
    spawnRate: number;
    rewardMultiplier: number;

    // 连击
    comboCount: number;
    comboTimer: number;

    // 控制
    isPaused: boolean;
    isAutoMode: boolean;
    isManualAiming: boolean;
    manualAimX: number;
    manualAimY: number;
    frozenTime: number;

    // 关卡模式
    stageLevel: number;
    isEndless: boolean;
    stageScore: number;
    stageBossSpawnTimer: number;
    stageBossSpawnInterval: number;
    stageBossAlive: boolean;
    stageUnlockShown: boolean;

    // 狂热
    berserkTimer: number;
    isBerserk: boolean;
    berserkCharge: number;

    // [优化] 缓存 Talent 值，每帧开头更新一次，避免每颗子弹/每条鱼都查 window
    _cachedTalentDmgMult: number;
    _cachedTalentGoldMult: number;
    _cachedTalentCritChance: number;
    _cachedTalentFireRateMult: number;
    _cachedTalentSpeedMult: number;
    // [优化 P1] comboBonus 缓存，主循环顶部计算一次，CombatSystem 直接读取
    _cachedComboBonus: number;
}
