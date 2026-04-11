/**
 * 关卡模式配置数据层
 * 每关对应一个Boss，越往后越难鱼群越密集。
 * 支持多层级（Layer）系统：通关全部10关后解锁下一层，难度递增。
 * 支持无限区域（Area）系统：每层包含无限个区域，每个区域10关。
 * 修改剧情/数值只改此文件，无需碰 SpawnSystem 或 GameController。
 */

import type { DialogueLine } from './dialogue.config';

/** 层级难度系数配置 */
export interface LayerConfig {
    /** 层ID（1开始） */
    layer: number;
    /** 层名称 */
    name: string;
    /** 层副标题 */
    subtitle: string;
    /** 难度倍率（乘以基础值） */
    difficultyMult: number;
    /** HP倍率额外加成 */
    hpMultBonus: number;
    /** 刷怪速率额外加成 */
    spawnRateBonus: number;
    /** 奖励倍率额外加成 */
    rewardBonus: number;
    /** Boss间隔减少（帧） */
    bossIntervalReduction: number;
    /** 解锁条件：上一层需要达到的平均分数 */
    unlockRequiredAvgScore: number;
    /** 边框颜色（随层加深） */
    borderColor: number;
}

export interface LevelDef {
    id: number;
    layer: number;
    area: number; // 区域编号（1开始）
    name: string;
    subtitle: string;
    /** 本关Boss的bossKey（与 Fish.ts 一致） */
    bossKey: string;
    /** Boss显示名称 */
    bossName: string;
    /** Boss封面贴图key（关卡卡片展示用） */
    bossAvatar: string;
    /** 解锁所需分数：上一关累计达到此分数后本关解锁（第1关为0） */
    unlockScore: number;
    /** 背景使用的地图bgKey */
    bgKey: string;
    /** 关卡HP倍率 */
    hpMult: number;
    /** 刷怪速率 */
    spawnRate: number;
    /** 奖励倍率 */
    reward: number;
    /** Boss刷新间隔(帧，60fps)，Boss被击杀后重新生成的冷却 */
    bossSpawnInterval: number;
    /** 开场白对话 */
    openingDialogue: DialogueLine[];
    /** Boss登场台词 */
    spawnDialogue: DialogueLine[];
    /** 边框颜色 */
    borderColor: number;
}

/** 区域配置 */
export interface AreaConfig {
    /** 区域编号（1开始） */
    area: number;
    /** 区域名称 */
    name: string;
    /** 区域难度倍率（每层基础 × 区域递增） */
    areaDifficultyMult: number;
    /** 每关解锁所需分数基础值 */
    baseUnlockScore: number;
}

export const LEVELS: LevelDef[] = [
    // ─────────────────────────────────────────────
    // Lv1  机械鳞龙
    // ─────────────────────────────────────────────
    {
        id: 1,
        layer: 1,
        area: 1,
        name: '深渊初鸣',
        subtitle: '深海边缘 · 机械鳞龙领地',
        bossKey: 'dragon',
        bossName: '机械鳞龙',
        bossAvatar: 'fish_dragon',
        unlockScore: 0,
        bgKey: 'map_normal',
        hpMult: 1.0,
        spawnRate: 0.8,
        reward: 1.2,
        bossSpawnInterval: 900,
        borderColor: 0x00e5ff,
        openingDialogue: [
            { speaker: '深度指挥部', text: '目标海域：外围浅层裂缝。侦测到低频金属共鸣，疑似机械生物活跃。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '接收到了。……这振动……不像普通鱼群。', avatar: 'skin_tuna', side: 'right' },
            { speaker: '深度指挥部', text: '记录显示，三天前有一艘无人探测艇在此失联。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '那就别废话了——武器热机，准备清场。', avatar: 'skin_tuna', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '机械鳞龙', text: '……谁踏进了我的领域？', avatar: 'fish_dragon', side: 'left' },
            { speaker: '驾驶员', text: '就是我。你那把锈钢骨架，今天全部拆了！', avatar: 'skin_tuna', side: 'right' },
            { speaker: '机械鳞龙', text: '胆子不小。用血肉来偿还入侵的代价吧！', avatar: 'fish_dragon', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv2  深渊蝠鲼
    // ─────────────────────────────────────────────
    {
        id: 2,
        layer: 1,
        area: 1,
        name: '冥翼遮天',
        subtitle: '中层暗礁带 · 蝠鲼迁徙路',
        bossKey: 'manta',
        bossName: '深渊蝠鲼',
        bossAvatar: 'boss_manta',
        unlockScore: 5000,
        bgKey: 'map_normal',
        hpMult: 2.0,
        spawnRate: 1.0,
        reward: 2.0,
        bossSpawnInterval: 840,
        borderColor: 0x7700ff,
        openingDialogue: [
            { speaker: '科研部', text: '探测器捕捉到大型翼展生物，正在进行集群迁徙——方向直指我们的阵地。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '翅膀这么宽……是蝠鲼群。领头的那个，不一般。', avatar: 'skin_tuna', side: 'right' },
            { speaker: '科研部', text: '深渊蝠鲼，暗影领主。它的翼展能遮蔽整片海域的光。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '好嘛。翅膀这么宽，用来挡我的炮弹刚好！', avatar: 'skin_tuna', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '深渊蝠鲼', text: '翼下无光，万物皆阴影。你……亦是如此。', avatar: 'boss_manta', side: 'left' },
            { speaker: '驾驶员', text: '哲学家？那就让你看看，光能穿透一切阴影！', avatar: 'skin_tuna', side: 'right' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv3  深海蟹王
    // ─────────────────────────────────────────────
    {
        id: 3,
        layer: 1,
        area: 1,
        name: '甲壳君王',
        subtitle: '海底峡谷 · 蟹王巢穴',
        bossKey: 'crab',
        bossName: '深海蟹王',
        bossAvatar: 'boss_crab',
        unlockScore: 15000,
        bgKey: 'map_hard',
        hpMult: 4.0,
        spawnRate: 1.2,
        reward: 3.5,
        bossSpawnInterval: 780,
        borderColor: 0xff8800,
        openingDialogue: [
            { speaker: '驾驶员', text: '指挥部，热成像显示前方峡谷有……数百个大型甲壳反应。', avatar: 'skin_tuna', side: 'right' },
            { speaker: '深度指挥部', text: '那是蟹王领地。帝国蟹群，每只都比装甲车还重。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '装甲车级别的甲壳？那正好，我的炮弹就是穿甲弹。', avatar: 'skin_tuna', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '深海蟹王', text: '咔——咔——。这峡谷的每块岩石都属于本王。', avatar: 'boss_crab', side: 'left' },
            { speaker: '驾驶员', text: '包括你的脑壳？那我就给你开个天窗。', avatar: 'skin_tuna', side: 'right' },
            { speaker: '深海蟹王', text: '铁钳之下，粉身碎骨！', avatar: 'boss_crab', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv4  利维坦
    // ─────────────────────────────────────────────
    {
        id: 4,
        layer: 1,
        area: 1,
        name: '远古神临',
        subtitle: '深渊断层 · 利维坦沉眠地',
        bossKey: 'leviathan',
        bossName: '利维坦',
        bossAvatar: 'boss_leviathan',
        unlockScore: 35000,
        bgKey: 'map_hard',
        hpMult: 7.0,
        spawnRate: 1.4,
        reward: 5.5,
        bossSpawnInterval: 720,
        borderColor: 0x00ff88,
        openingDialogue: [
            { speaker: '神秘信号', text: '……扰乱者……已进入感知范围……', avatar: 'boss_leviathan', side: 'left' },
            { speaker: '科研部', text: '警告！断层正在位移——这不是地震，是生物在移动！', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '那东西……有多大？', avatar: 'skin_tuna', side: 'right' },
            { speaker: '科研部', text: '超出测量量程。利维坦——上古海神之名。它不应该存在于这个时代。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '存不存在……打完就知道了。', avatar: 'skin_tuna', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '利维坦', text: '千年沉眠……被你们这些碳基噪音所惊扰。', avatar: 'boss_leviathan', side: 'left' },
            { speaker: '驾驶员', text: '你睡得太死了，不打醒你我不放心。', avatar: 'skin_tuna', side: 'right' },
            { speaker: '利维坦', text: '渺小的存在……用你的消亡，偿还这份愚勇。', avatar: 'boss_leviathan', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv5  深渊鲸
    // ─────────────────────────────────────────────
    {
        id: 5,
        layer: 1,
        area: 1,
        name: '鲸落哀歌',
        subtitle: '黑暗海沟 · 深渊鲸墓地',
        bossKey: 'whale',
        bossName: '深渊鲸',
        bossAvatar: 'boss_whale',
        unlockScore: 70000,
        bgKey: 'map_hard',
        hpMult: 12.0,
        spawnRate: 1.6,
        reward: 8.0,
        bossSpawnInterval: 660,
        borderColor: 0x0055ff,
        openingDialogue: [
            { speaker: '驾驶员', text: '这里……是鲸落墓地？到处都是巨型骸骨。', avatar: 'skin_jelly', side: 'right' },
            { speaker: '深度指挥部', text: '那些骸骨里有一具……还在呼吸。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '等等——骸骨里面有活的？！', avatar: 'skin_jelly', side: 'right' },
            { speaker: '深度指挥部', text: '深渊鲸，不死者。它在这里挽歌自鸣，已经数百年了。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '好，今天，我来终结这首歌。', avatar: 'skin_jelly', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '深渊鲸', text: '……哀鸣……哀鸣……是谁，打断了永恒的挽歌……', avatar: 'boss_whale', side: 'left' },
            { speaker: '驾驶员', text: '是我。那首歌不好听，我帮你换个调。', avatar: 'skin_jelly', side: 'right' },
            { speaker: '深渊鲸', text: '……那便用你的鲜血……谱写新的篇章……', avatar: 'boss_whale', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv6  泰坦鲨
    // ─────────────────────────────────────────────
    {
        id: 6,
        layer: 1,
        area: 1,
        name: '辐射猎场',
        subtitle: '放射深渊 · 泰坦鲨狩猎场',
        bossKey: 'titan_shark',
        bossName: '泰坦鲨',
        bossAvatar: 'boss_titan_shark',
        unlockScore: 120000,
        bgKey: 'map_hard',
        hpMult: 18.0,
        spawnRate: 1.8,
        reward: 12.0,
        bossSpawnInterval: 600,
        borderColor: 0xffcc00,
        openingDialogue: [
            { speaker: '科研部', text: '我们检测到了超强辐射源——那是泰坦鲨的核动力装甲在运转。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '核动力？！这鱼装了个反应堆？', avatar: 'skin_heavy', side: 'right' },
            { speaker: '科研部', text: '变异进化。它的每一颗牙齿都能撕碎钛合金。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '有意思。我的炮管，就是专门用来对付钛合金的。', avatar: 'skin_heavy', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '泰坦鲨', text: '猎物。我已经嗅到了你的恐惧。', avatar: 'boss_titan_shark', side: 'left' },
            { speaker: '驾驶员', text: '你嗅错了——那是火药味，不是恐惧。', avatar: 'skin_heavy', side: 'right' },
            { speaker: '泰坦鲨', text: '无论如何……都会被我吞噬！', avatar: 'boss_titan_shark', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv7  泰坦龙
    // ─────────────────────────────────────────────
    {
        id: 7,
        layer: 1,
        area: 1,
        name: '熔岩帝皇',
        subtitle: '余烬核心外围 · 泰坦龙巢穴',
        bossKey: 'titan_dragon',
        bossName: '泰坦龙',
        bossAvatar: 'boss_titan_dragon',
        unlockScore: 200000,
        bgKey: 'map_lunatic',
        hpMult: 25.0,
        spawnRate: 2.0,
        reward: 18.0,
        bossSpawnInterval: 540,
        borderColor: 0xff4400,
        openingDialogue: [
            { speaker: '机械鳞龙', text: '你……居然还活着。走到这里，已是奇迹。', avatar: 'fish_dragon', side: 'left' },
            { speaker: '驾驶员', text: '奇迹？我靠的是炮，不是运气。前面那是什么？', avatar: 'skin_heavy', side: 'right' },
            { speaker: '深度指挥部', text: '泰坦龙，机械鳞龙的祖先。它诞生于火山核心，身披熔岩装甲。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '鳞龙是铁的，这个是……岩浆做的？好，开炮前先给主炮降温。', avatar: 'skin_heavy', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: '泰坦龙', text: '每一万年，才有一个外来者胆敢踏入此地。', avatar: 'boss_titan_dragon', side: 'left' },
            { speaker: '驾驶员', text: '那我就当万年来第一个，把你从这里轰走！', avatar: 'skin_heavy', side: 'right' },
            { speaker: '泰坦龙', text: '熔岩之冠，永不熄灭！吞噬你——', avatar: 'boss_titan_dragon', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv8  泰坦海蛇
    // ─────────────────────────────────────────────
    {
        id: 8,
        layer: 1,
        area: 1,
        name: '虚空囚笼',
        subtitle: '余烬核心内层 · 海蛇迷宫',
        bossKey: 'titan_serpent',
        bossName: '泰坦海蛇',
        bossAvatar: 'boss_titan_serpent',
        unlockScore: 350000,
        bgKey: 'map_lunatic',
        hpMult: 35.0,
        spawnRate: 2.4,
        reward: 25.0,
        bossSpawnInterval: 480,
        borderColor: 0x00ff44,
        openingDialogue: [
            { speaker: '神秘信号', text: '……进来了……进来了……快逃……', avatar: 'boss_leviathan', side: 'left' },
            { speaker: '驾驶员', text: '这信号……是之前那些Boss发出来的？它们在警告我？', avatar: 'skin_heavy', side: 'right' },
            { speaker: '科研部', text: '传感器显示：一条长度超出量程的生物，正在以螺旋形包围你的坐标。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '……螺旋形包围。泰坦海蛇。我在它的食道里了对吗。', avatar: 'skin_heavy', side: 'right' },
            { speaker: '科研部', text: '还没有。但你需要在它完成包围前，先把它轰掉。', avatar: 'cannon_v4', side: 'left' },
        ],
        spawnDialogue: [
            { speaker: '泰坦海蛇', text: '来……来到我的迷宫中央……无论你多强，都只是我肚中之物……', avatar: 'boss_titan_serpent', side: 'left' },
            { speaker: '驾驶员', text: '你的肚子够大吗？因为我带的炮弹很多。', avatar: 'skin_heavy', side: 'right' },
            { speaker: '泰坦海蛇', text: '缠绕……缠绕……化为虚无！', avatar: 'boss_titan_serpent', side: 'left' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv9  泰坦鲸
    // ─────────────────────────────────────────────
    {
        id: 9,
        layer: 1,
        area: 1,
        name: '深渊巨兽',
        subtitle: '余烬核心深处 · 泰坦鲸领域',
        bossKey: 'titan_whale',
        bossName: '泰坦鲸',
        bossAvatar: 'boss_titan_whale',
        unlockScore: 600000,
        bgKey: 'map_lunatic',
        hpMult: 50.0,
        spawnRate: 2.8,
        reward: 35.0,
        bossSpawnInterval: 420,
        borderColor: 0x4400ff,
        openingDialogue: [
            { speaker: '深度指挥部', text: '驾驶员……我需要你冷静。核心内部的生命体信号……已经超出我们所有的预案。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '你是在告诉我，前面的东西比之前所有的加起来还要大？', avatar: 'skin_heavy', side: 'right' },
            { speaker: '深度指挥部', text: '泰坦鲸。它的每一次心跳，都会在海底制造海啸级压力波。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '……听起来……很好打啊，这么大的靶子。', avatar: 'skin_heavy', side: 'right' },
            { speaker: '深度指挥部', text: '你这个疯子……上！', avatar: 'cannon_v3', side: 'left' },
        ],
        spawnDialogue: [
            { speaker: '泰坦鲸', text: '……', avatar: 'boss_titan_whale', side: 'left' },
            { speaker: '驾驶员', text: '不说话？那我就让炮弹替我问候你。', avatar: 'skin_heavy', side: 'right' },
            { speaker: '泰坦鲸', text: '……渺小之物……你的存在……是宇宙的误差……', avatar: 'boss_titan_whale', side: 'left' },
            { speaker: '驾驶员', text: '那这个"误差"，今天就来纠正你！', avatar: 'skin_heavy', side: 'right' },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv10  GG终焉体
    // ─────────────────────────────────────────────
    {
        id: 10,
        layer: 1,
        area: 1,
        name: '绝对终焉',
        subtitle: '余烬核心·绝对禁区',
        bossKey: 'boss_gg',
        bossName: 'GG终焉体',
        bossAvatar: 'boss_gg',
        unlockScore: 1000000,
        bgKey: 'map_lunatic',
        hpMult: 80.0,
        spawnRate: 3.5,
        reward: 60.0,
        bossSpawnInterval: 360,
        borderColor: 0xff0000,
        openingDialogue: [
            { speaker: '深度指挥部', text: '所有频道静音。此次任务列为最高机密级别。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '……核心里面，到底是什么东西。', avatar: 'skin_heavy', side: 'right' },
            { speaker: '深度指挥部', text: '我们没有档案，没有记录，没有任何先例。我们称它为……GG。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: 'GG？就这个名字？', avatar: 'skin_heavy', side: 'right' },
            { speaker: '深度指挥部', text: '意思是：见到它的人，都说了声GG。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '……那我今天，要让它说GG。全炮装填，出发。', avatar: 'skin_heavy', side: 'right' },
        ],
        spawnDialogue: [
            { speaker: 'GG终焉体', text: '☆★☆……信号检测……外来碳基入侵……', avatar: 'boss_gg', side: 'left' },
            { speaker: '驾驶员', text: '你不是鱼，也不是机械……你是什么？', avatar: 'skin_heavy', side: 'right' },
            { speaker: 'GG终焉体', text: '我是……终点。你们每一个走进这里的人，都成为了我的一部分。', avatar: 'boss_gg', side: 'left' },
            { speaker: '驾驶员', text: '很遗憾——我不打算成为任何人的"一部分"。', avatar: 'skin_heavy', side: 'right' },
            { speaker: 'GG终焉体', text: '……审判·启动。', avatar: 'boss_gg', side: 'left' },
            { speaker: '深度指挥部', text: '全员收听！这是最后一战！为了所有在深渊中失踪的人，把它打回去！', avatar: 'cannon_v3', side: 'right' },
        ],
    },
];

/** 按ID查询关卡定义 */
export function getLevel(id: number): LevelDef | undefined {
    return LEVELS.find(l => l.id === id);
}

/** 层级配置定义（3层难度递增） */
export const LAYER_CONFIGS: LayerConfig[] = [
    {
        layer: 1,
        name: '深渊初临',
        subtitle: '标准难度 · 深海觉醒',
        difficultyMult: 1.0,
        hpMultBonus: 0,
        spawnRateBonus: 0,
        rewardBonus: 0,
        bossIntervalReduction: 0,
        unlockRequiredAvgScore: 0,
        borderColor: 0x00e5ff,
    },
    {
        layer: 2,
        name: '深渊试炼',
        subtitle: '困难难度 · 极限挑战',
        difficultyMult: 2.0,
        hpMultBonus: 0.5,
        spawnRateBonus: 0.5,
        rewardBonus: 0.5,
        bossIntervalReduction: 120,
        unlockRequiredAvgScore: 500000, // 第1层平均50万分解锁
        borderColor: 0xff6600,
    },
    {
        layer: 3,
        name: '深渊炼狱',
        subtitle: '地狱难度 · 绝对深渊',
        difficultyMult: 4.0,
        hpMultBonus: 1.0,
        spawnRateBonus: 1.0,
        rewardBonus: 1.0,
        bossIntervalReduction: 240,
        unlockRequiredAvgScore: 2000000, // 第2层平均200万分解锁
        borderColor: 0xff0000,
    },
];

/** 每区域关卡数 */
export const LEVELS_PER_AREA = 10;

/** 区域难度递增系数（每区域增加） */
export const AREA_DIFFICULTY_GROWTH = 0.5; // 每区域+50%难度

/** 生成指定层和区域的关卡数据（带难度缩放） */
export function getLayerAreaLevels(layer: number, area: number): LevelDef[] {
    const layerConfig = LAYER_CONFIGS.find(c => c.layer === layer);
    if (!layerConfig) return [];

    // 区域难度倍率 = 层基础 × (1 + (区域-1) × 区域递增)
    const areaMult = layerConfig.difficultyMult * (1 + (area - 1) * AREA_DIFFICULTY_GROWTH);

    return LEVELS.map((base, index) => ({
        ...base,
        layer: layerConfig.layer,
        area: area,
        id: (area - 1) * LEVELS_PER_AREA + base.id, // 全局唯一ID
        name: `${base.name} ${area > 1 ? `(区域${area})` : ''}`,
        subtitle: `${base.subtitle} [${layerConfig.name} · 区域${area}]`,
        hpMult: (base.hpMult + layerConfig.hpMultBonus) * areaMult,
        spawnRate: (base.spawnRate + layerConfig.spawnRateBonus) * areaMult,
        reward: (base.reward + layerConfig.rewardBonus) * areaMult,
        bossSpawnInterval: Math.max(180, base.bossSpawnInterval - layerConfig.bossIntervalReduction),
        borderColor: layerConfig.borderColor,
        unlockScore: base.unlockScore * areaMult,
    }));
}

/** 获取全局关卡ID对应的层和区域 */
export function getLevelLocation(globalId: number): { layer: number; area: number; levelInArea: number } {
    const levelInArea = ((globalId - 1) % LEVELS_PER_AREA) + 1;
    const area = Math.floor((globalId - 1) / LEVELS_PER_AREA) + 1;
    // 简化：所有关卡默认在第1层（可根据需要扩展）
    return { layer: 1, area, levelInArea };
}

/** 生成指定层的关卡数据（兼容旧接口，默认区域1） */
export function getLayerLevels(layer: number): LevelDef[] {
    return getLayerAreaLevels(layer, 1);
}

/** 获取所有可用关卡（所有层） */
export function getAllLayerLevels(): Map<number, LevelDef[]> {
    const map = new Map<number, LevelDef[]>();
    for (const config of LAYER_CONFIGS) {
        map.set(config.layer, getLayerLevels(config.layer));
    }
    return map;
}

/** 查询某层是否解锁（根据上一层平均分） */
export function isLayerUnlocked(layer: number, layerScores: { [layer: string]: { [level: string]: number } }): boolean {
    if (layer <= 1) return true;
    const prevLayer = layer - 1;
    const prevScores = layerScores[String(prevLayer)];
    if (!prevScores) return false;

    const scores = Object.values(prevScores);
    if (scores.length === 0) return false;

    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const config = LAYER_CONFIGS.find(c => c.layer === layer);
    if (!config) return false;

    return avgScore >= config.unlockRequiredAvgScore;
}

/** 获取层显示名称 */
export function getLayerName(layer: number): string {
    const config = LAYER_CONFIGS.find(c => c.layer === layer);
    return config ? config.name : `第${layer}层`;
}

/** 获取区域显示名称 */
export function getAreaName(area: number): string {
    const areaNames: string[] = [
        '起始之域',
        '幽暗深渊',
        '深蓝秘境',
        '黑暗深渊',
        '寂静海沟',
        '虚空裂隙',
        '混沌领域',
        '绝望深渊',
        '炼狱深渊',
        '无尽深渊',
        '永夜深渊',
        '终焉深渊',
    ];
    if (area <= areaNames.length) {
        return areaNames[area - 1];
    }
    return `深渊${area}`;
}

/** 计算指定区域的难度倍率 */
export function getAreaDifficultyMult(layer: number, area: number): number {
    const layerConfig = LAYER_CONFIGS.find(c => c.layer === layer);
    if (!layerConfig) return 1.0;
    return layerConfig.difficultyMult * (1 + (area - 1) * AREA_DIFFICULTY_GROWTH);
}
