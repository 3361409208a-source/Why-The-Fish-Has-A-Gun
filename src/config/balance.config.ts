/**
 * 数值平衡配置数据层
 * 所有游戏核心公式和系数集中在此，调整数值平衡只改这个文件。
 */

/** 武器升级相关 */
export const UPGRADE = {
    maxLevel: 5,
    /** 计算升级费用（晶体/金币均适用此公式） */
    getCost: (level: number): number => Math.floor(500 * Math.pow(2, level - 1)),
};

/** 连击系统 */
export const COMBO = {
    /** 连击超时帧数（60fps下=3秒） */
    timeoutFrames: 180,
    /** 每1连击增加的伤害加成，上限2.0倍 */
    dmgBonusPerCombo: 0.05,
    maxDmgBonus: 2.0,
    /** 每1连击增加的金币加成系数 */
    goldBonusPerCombo: 0.005,
    /** 每10连击触发屏幕震动 */
    shakeEvery: 10,
};

/** 天赋升级费用系数 */
export const TALENT = {
    baseCost: 500,
    costMultiplier: 1.8,
    getCost: (level: number): number => Math.floor(500 * Math.pow(1.8, level)),

    /** 各天赋每级加成量 */
    damagePerLevel: 0.1,        // 每级+10%伤害
    fireRatePerLevel: 0.05,     // 每级+5%射速
    goldBonusPerLevel: 0.2,     // 每级+20%金币
    critChanceBase: 0.05,       // 基础暴击率5%
    critChancePerLevel: 0.05,   // 每级+5%暴击率
    critDamageMultiplier: 3.0,  // 暴击伤害倍率
};

/** 子弹等级成长 */
export const BULLET_LEVEL = {
    damageBase: 20,         // 基础伤害系数
    damagePerLevel: 10,     // 每级固定增加伤害
    speedPerLevel: 0.2,     // 每级+20%速度
    sizePerLevel: 0.15,     // 每级+15%尺寸
    baseSize: 60,           // 基础尺寸
};

export const AOE = {
    baseRange: 280,      // 大幅增加基础爆炸范围 (150 -> 280)
    rangePerLevel: 40,   // 每级成长增加 (20 -> 40)
    damageFalloff: 0.7,  // 边缘伤害比例提升 (0.5 -> 0.7)
};

/** 连锁闪电参数（lightning武器） */
export const CHAIN = {
    baseTargets: 5,        // 基础跳跃次数（+level）
    chainRange: 180,       // 跳跃最远距离 (原来300，避免连太远)
    damageFalloff: 0.85,   // 每次跳跃伤害乘数
};

/** 经济掉落 */
export const ECONOMY = {
    killCrystalBase: 10,
    killCrystalRich: 50,       // 20%概率
    richDropChance: 0.8,       // roll > 0.8 触发富裕掉落
    bossCrystal: 500,
    nanoCoreBonus: 500,        // 拾取纳米核心奖励
    nanoCoreDropChance: 0.15,  // 鱼死亡后掉落概率
};

/** 技能树升级费用（叠加在 skilltree.config 的 costPerLevel 基础上） */
export const SKILL_TREE = {
    /** 每级费用递增倍率（实际费用 = costPerLevel × levelMultiplier^currentLevel） */
    levelMultiplier: 1.5,
    /** 计算某技能从 currentLevel 升到下一级的实际费用 */
    getUpgradeCost: (costPerLevel: number, currentLevel: number): number => {
        return Math.floor(costPerLevel * Math.pow(1.5, currentLevel));
    },
};
