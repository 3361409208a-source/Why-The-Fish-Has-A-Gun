/**
 * 无尽模式难度配置
 */

export interface EndlessDifficulty {
    level: number;
    name: string;
    desc: string;
    hpMult: number;
    spawnRate: number;
    reward: number;
    borderColor: number;
    unlockScore: number;
    bgKey: string;
}

const DIFFICULTY_NAMES: string[] = [
    '浅海漫游', '暗流涌动', '深海脉动', '漩涡狩猎',
    '黑潮来袭', '虚空乱流', '深渊呼唤', '混沌侵蚀',
    '湮灭风暴', '神域试炼', '极限深渊', '绝望浪潮',
    '炼狱深渊', '星核崩塌', '时空裂隙', '终焉序幕',
    '绝对混沌', '创世崩毁', '宇宙终焉', '∞ 无限进化',
];

const DIFFICULTY_DESCS: string[] = [
    '深海初探，鱼群稀疏',     '暗流中的第一道考验',  '深海脉动加速',
    '漩涡中的精英猎场',       '黑潮席卷，所向披靡',  '虚空乱流，规律失效',
    '深渊之力开始显现',       '混沌侵蚀现实边界',     '湮灭风暴席卷深海',
    '神明降临的考验',         '生死极限之境',         '绝望笼罩深渊',
    '炼狱之火永不熄灭',       '星核崩塌，宇宙颤抖',   '时空裂开，规则破碎',
    '终焉的序幕已拉开',       '绝对混沌无法回头',     '创世之力走向崩毁',
    '宇宙的最后呼唤',         '超越极限，永无止境',
];

const BORDER_COLORS: number[] = [
    0x00e5ff, 0x00cc88, 0x88dd00, 0xffcc00,
    0xff8800, 0xff4400, 0xff0044, 0xcc00ff,
    0x8800ff, 0xff00ff, 0xff0088, 0xff2244,
    0xff3300, 0xff5500, 0xff7700, 0xffaa00,
    0xffffff, 0xff88ff, 0x88ffff, 0xffd700,
];

const BG_KEYS: string[] = [
    'bg_ocean', 'bg_ocean', 'bg_ocean', 'bg_ocean',
    'bg_abyss', 'bg_abyss', 'bg_abyss', 'bg_abyss',
    'bg_abyss', 'bg_abyss', 'bg_abyss', 'bg_abyss',
    'bg_abyss', 'bg_abyss', 'bg_abyss', 'bg_abyss',
    'bg_abyss', 'bg_abyss', 'bg_abyss', 'bg_abyss',
];

/** 获取指定难度等级的配置（支持任意级数） */
export function getEndlessDifficulty(level: number): EndlessDifficulty {
    const idx = Math.min(level - 1, DIFFICULTY_NAMES.length - 1);
    const n = level;

    // 指数级难度缩放
    const hpMult = parseFloat((Math.pow(1.55, n - 1)).toFixed(2));
    const spawnRate = parseFloat(Math.min(0.7 * Math.pow(1.12, n - 1), 15.0).toFixed(2));
    const reward = parseFloat((1.0 * Math.pow(1.25, n - 1)).toFixed(2));

    // 解锁所需分数：难度1-3免费，之后指数递增
    const unlockScore = n <= 3 ? 0 : Math.floor(5000 * Math.pow(2.2, n - 4));

    const name = level <= DIFFICULTY_NAMES.length
        ? DIFFICULTY_NAMES[idx]
        : `LEVEL ${level}`;

    const desc = level <= DIFFICULTY_DESCS.length
        ? DIFFICULTY_DESCS[idx]
        : `难度等级 ${level}，强度 ×${hpMult}`;

    return {
        level,
        name,
        desc,
        hpMult,
        spawnRate,
        reward,
        borderColor: BORDER_COLORS[idx] ?? 0x00e5ff,
        unlockScore,
        bgKey: BG_KEYS[idx] ?? 'bg_abyss',
    };
}

/** 获取前N个难度列表 */
export function getEndlessDifficultyList(count: number = 20): EndlessDifficulty[] {
    const list: EndlessDifficulty[] = [];
    for (let i = 1; i <= count; i++) {
        list.push(getEndlessDifficulty(i));
    }
    return list;
}
