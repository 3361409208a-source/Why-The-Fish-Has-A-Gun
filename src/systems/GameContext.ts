/**
 * GameContext — 游戏会话共享状态包
 * 通过引用传递给各个系统，所有系统对同一个对象进行读写。
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
    isManualAiming: boolean; // 玩家正在手动拖动/触摸瞄准，禁止自动追鱼覆盖
    manualAimX: number;      // 最近一次手动指向的屏幕 X
    manualAimY: number;      // 最近一次手动指向的屏幕 Y
    frozenTime: number;
    // 关卡模式（0 = 随机模式，1-10 = 关卡模式）
    stageLevel: number;
    stageBossQueue: string[];      // 待生成的 bossKey 队列（按顺序）
    stageBossNames: string[];      // 对应名称（与队列同步）
    stageBossSpawnTimer: number;   // 下一个 Boss 的生成倒计时（帧）
    stageBossSpawnInterval: number;// Boss 生成间隔（帧）
    stageBossesTotal: number;      // 本关总 Boss 数
    stageBossesKilled: number;     // 已击杀 Boss 数
}
