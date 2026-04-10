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
    frozenTime: number;
}
