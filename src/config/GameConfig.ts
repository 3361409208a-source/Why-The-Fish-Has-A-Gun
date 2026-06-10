/**
 * [优化 P2] GameConfig - 游戏全局魔法数字常量集中管理
 * 所有散落在各子系统中的数值统一在此定义，修改时只需改一处。
 */

/** 碰撞检测参数 */
export const COLLISION = {
    /** AABB 预检使用的最大碰撞半径上限 */
    maxHitRadius: 200,
    /** 圆形精确检测的最小距离平方阈值 */
    minDistSqThreshold: 0,
} as const;

/** 粒子系统参数 */
export const PARTICLE = {
    /** 粒子数量软上限 */
    maxCount: 300,
    /** 重力系数 */
    gravity: 0.1,
    /** 生命周期衰减率（每帧） */
    lifeDecay: 0.03,
    /** 速度随机范围 */
    forceMin: 2,
    forceMax: 7,
} as const;

/** 受击闪烁参数 */
export const HIT_FLASH = {
    /** 对象池上限 */
    poolSize: 40,
    /** 溢出队列上限 */
    queueMax: 20,
    /** 每帧排空数量 */
    queueDrainPerFrame: 3,
    /** 初始半径 */
    initialRadius: 1,
    /** 半径增长速度 */
    radiusGrowth: 6,
    /** 透明度衰减速度 */
    alphaDecay: 0.12,
} as const;

/** 子弹系统参数 */
export const BULLET_CONFIG = {
    /** 普通子弹生命周期（帧） */
    normalLifetime: 240,
    /** 闪电子弹生命周期（帧） */
    lightningLifetime: 4,
    /** 追踪子弹转向速率（弧度/帧） */
    homingTurnRate: 0.08,
    /** 子弹出界边距 */
    margin: 400,
} as const;

/** NanoCore 参数 */
export const NANOCORE = {
    /** 生命周期上限（帧） */
    maxLifeFrames: 600,
    /** 场景内数量上限 */
    maxSceneCount: 30,
    /** 拾取距离 */
    pickupDistance: 80,
    /** 淡出速度 */
    fadeSpeed: 0.05,
} as const;

/** SimpleRope 绳段数配置 */
export const ROPE_SEGMENTS = {
    /** 泰坦 Boss */
    titan: 20,
    /** 普通 Boss / 小兵 */
    boss: 10,
    /** 普通鱼 */
    normal: 6,
} as const;

/** 空间网格参数（1920×1080 画布） */
export const SPATIAL_GRID = {
    cols: 8,
    rows: 5,
    get cellW() { return 1920 / this.cols; },
    get cellH() { return 1080 / this.rows; },
} as const;

/** 帧率与 Delta 参数 */
export const FRAME = {
    /** 浏览器端 Delta Cap */
    browserMaxDelta: 2,
    /** 微信端 Delta Cap */
    wxMaxDelta: 1.5,
    /** 低端机检测阈值（ms/帧） */
    lowEndThreshold: 25,
} as const;

/** 鱼群上限参数 */
export const FISH_LIMITS = {
    /** 鱼群数量上限 */
    maxFish: 120,
    /** 出界判定边距 */
    killMargin: 800,
} as const;

/** 经济系统补充参数（与 balance.config 互补） */
export const ECONOMY_EXTRA = {
    /** NanoCore 掉落概率 */
    nanoCoreDropChance: 0.15,
    /** 金色核心倍率 */
    goldenCoreMultiplier: 10,
} as const;
