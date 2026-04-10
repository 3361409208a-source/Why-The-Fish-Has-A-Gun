/**
 * 关卡模式配置数据层
 * 10关累积Boss挑战：每关专属Boss永远最大，前关所有Boss全部回归。
 * 修改剧情/数值只改此文件，无需碰 SpawnSystem 或 GameController。
 */

import type { DialogueLine } from './dialogue.config';

export interface BossEntry {
    /** 与 Fish.ts 中 bossKey 一致 */
    bossKey: string;
    /** 显示名称 */
    name: string;
    /** 是否为本关专属（总是最大的那一个） */
    isExclusive: boolean;
    /** boss登场台词（可选） */
    spawnDialogue?: DialogueLine[];
}

export interface LevelDef {
    id: number;
    name: string;
    subtitle: string;
    /** 关卡内出现的所有Boss（专属在前，回归在后） */
    bosses: BossEntry[];
    /** 背景使用的地图bgKey */
    bgKey: string;
    /** 关卡HP倍率 */
    hpMult: number;
    /** 刷怪速率 */
    spawnRate: number;
    /** 奖励倍率 */
    reward: number;
    /** Boss刷新间隔(帧，60fps) */
    bossSpawnInterval: number;
    /** 开场白对话 */
    openingDialogue: DialogueLine[];
    /** 边框颜色 */
    borderColor: number;
}

export const LEVELS: LevelDef[] = [
    // ─────────────────────────────────────────────
    // Lv1  机械鳞龙
    // ─────────────────────────────────────────────
    {
        id: 1,
        name: '第一关：钢牙初醒',
        subtitle: '深海边缘 · 机械鳞龙领地',
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
        bosses: [
            {
                bossKey: 'dragon',
                name: '机械鳞龙',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '机械鳞龙', text: '……谁踏进了我的领域？', avatar: 'fish_dragon', side: 'left' },
                    { speaker: '驾驶员', text: '就是我。你那把锈钢骨架，今天全部拆了！', avatar: 'skin_tuna', side: 'right' },
                    { speaker: '机械鳞龙', text: '胆子不小。用血肉来偿还入侵的代价吧！', avatar: 'fish_dragon', side: 'left' },
                ],
            },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv2  深渊蝠鲼  +  机械鳞龙
    // ─────────────────────────────────────────────
    {
        id: 2,
        name: '第二关：暗翼扩散',
        subtitle: '中层暗礁带 · 蝠鲼迁徙路',
        bgKey: 'map_normal',
        hpMult: 2.0,
        spawnRate: 1.0,
        reward: 2.0,
        bossSpawnInterval: 840,
        borderColor: 0x7700ff,
        openingDialogue: [
            { speaker: '科研部', text: '探测器捕捉到大型翼展生物，正在进行集群迁徙——方向直指我们的阵地。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '还有上一次那条鳞龙的残余信号……它没死透？', avatar: 'skin_tuna', side: 'right' },
            { speaker: '科研部', text: '机械残体会自我修复。它已经归队了。', avatar: 'cannon_v4', side: 'left' },
            { speaker: '驾驶员', text: '好嘛。翅膀加尾巴，今天一起打包送回去。', avatar: 'skin_tuna', side: 'right' },
        ],
        bosses: [
            {
                bossKey: 'manta',
                name: '深渊蝠鲼',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '深渊蝠鲼', text: '翼下无光，万物皆阴影。你……亦是如此。', avatar: 'boss_manta', side: 'left' },
                    { speaker: '驾驶员', text: '哲学家？翅膀这么宽，用来挡我的炮弹刚好！', avatar: 'skin_tuna', side: 'right' },
                ],
            },
            {
                bossKey: 'dragon',
                name: '机械鳞龙（回归）',
                isExclusive: false,
            },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv3  深海蟹王  +  蝠鲼 + 鳞龙
    // ─────────────────────────────────────────────
    {
        id: 3,
        name: '第三关：铁钳帝国',
        subtitle: '海底峡谷 · 蟹王巢穴',
        bgKey: 'map_hard',
        hpMult: 4.0,
        spawnRate: 1.2,
        reward: 3.5,
        bossSpawnInterval: 780,
        borderColor: 0xff8800,
        openingDialogue: [
            { speaker: '驾驶员', text: '指挥部，热成像显示前方峡谷有……数百个大型甲壳反应。', avatar: 'skin_tuna', side: 'right' },
            { speaker: '深度指挥部', text: '那是蟹王领地。帝国蟹群，每只都比装甲车还重。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '还有之前打过的那两个……你们是组团来的？', avatar: 'skin_tuna', side: 'right' },
            { speaker: '深度指挥部', text: '海底生物会感知强者被击败——它们在试探你的极限。', avatar: 'cannon_v3', side: 'left' },
            { speaker: '驾驶员', text: '那就让它们看清楚，我的极限在哪里。', avatar: 'skin_tuna', side: 'right' },
        ],
        bosses: [
            {
                bossKey: 'crab',
                name: '深海蟹王',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '深海蟹王', text: '咔——咔——。这峡谷的每块岩石都属于本王。', avatar: 'boss_crab', side: 'left' },
                    { speaker: '驾驶员', text: '包括你的脑壳？那我就给你开个天窗。', avatar: 'skin_tuna', side: 'right' },
                    { speaker: '深海蟹王', text: '铁钳之下，粉身碎骨！', avatar: 'boss_crab', side: 'left' },
                ],
            },
            { bossKey: 'manta', name: '深渊蝠鲼（回归）', isExclusive: false },
            { bossKey: 'dragon', name: '机械鳞龙（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv4  利维坦  +  蟹王 + 蝠鲼 + 鳞龙
    // ─────────────────────────────────────────────
    {
        id: 4,
        name: '第四关：古神苏醒',
        subtitle: '深渊断层 · 利维坦沉眠地',
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
        bosses: [
            {
                bossKey: 'leviathan',
                name: '利维坦',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '利维坦', text: '千年沉眠……被你们这些碳基噪音所惊扰。', avatar: 'boss_leviathan', side: 'left' },
                    { speaker: '驾驶员', text: '你睡得太死了，不打醒你我不放心。', avatar: 'skin_tuna', side: 'right' },
                    { speaker: '利维坦', text: '渺小的存在……用你的消亡，偿还这份愚勇。', avatar: 'boss_leviathan', side: 'left' },
                ],
            },
            { bossKey: 'crab', name: '深海蟹王（回归）', isExclusive: false },
            { bossKey: 'manta', name: '深渊蝠鲼（回归）', isExclusive: false },
            { bossKey: 'dragon', name: '机械鳞龙（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv5  深渊鲸  +  利维坦 + 蟹王 + 蝠鲼 + 鳞龙
    // ─────────────────────────────────────────────
    {
        id: 5,
        name: '第五关：巨鲸挽歌',
        subtitle: '黑暗海沟 · 深渊鲸墓地',
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
        bosses: [
            {
                bossKey: 'whale',
                name: '深渊鲸',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '深渊鲸', text: '……哀鸣……哀鸣……是谁，打断了永恒的挽歌……', avatar: 'boss_whale', side: 'left' },
                    { speaker: '驾驶员', text: '是我。那首歌不好听，我帮你换个调。', avatar: 'skin_jelly', side: 'right' },
                    { speaker: '深渊鲸', text: '……那便用你的鲜血……谱写新的篇章……', avatar: 'boss_whale', side: 'left' },
                ],
            },
            { bossKey: 'leviathan', name: '利维坦（回归）', isExclusive: false },
            { bossKey: 'crab', name: '深海蟹王（回归）', isExclusive: false },
            { bossKey: 'manta', name: '深渊蝠鲼（回归）', isExclusive: false },
            { bossKey: 'dragon', name: '机械鳞龙（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv6  泰坦鲨  +  深渊鲸 + 利维坦 + 蟹王 + 蝠鲼
    // ─────────────────────────────────────────────
    {
        id: 6,
        name: '第六关：钢铁洪流',
        subtitle: '放射深渊 · 泰坦鲨狩猎场',
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
        bosses: [
            {
                bossKey: 'titan_shark',
                name: '泰坦鲨',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '泰坦鲨', text: '猎物。我已经嗅到了你的恐惧。', avatar: 'boss_titan_shark', side: 'left' },
                    { speaker: '驾驶员', text: '你嗅错了——那是火药味，不是恐惧。', avatar: 'skin_heavy', side: 'right' },
                    { speaker: '泰坦鲨', text: '无论如何……都会被我吞噬！', avatar: 'boss_titan_shark', side: 'left' },
                ],
            },
            { bossKey: 'whale', name: '深渊鲸（回归）', isExclusive: false },
            { bossKey: 'leviathan', name: '利维坦（回归）', isExclusive: false },
            { bossKey: 'crab', name: '深海蟹王（回归）', isExclusive: false },
            { bossKey: 'manta', name: '深渊蝠鲼（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv7  泰坦龙  +  泰坦鲨 + 深渊鲸 + 利维坦 + 蟹王
    // ─────────────────────────────────────────────
    {
        id: 7,
        name: '第七关：龙炎末日',
        subtitle: '余烬核心外围 · 泰坦龙巢穴',
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
        bosses: [
            {
                bossKey: 'titan_dragon',
                name: '泰坦龙',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '泰坦龙', text: '每一万年，才有一个外来者胆敢踏入此地。', avatar: 'boss_titan_dragon', side: 'left' },
                    { speaker: '驾驶员', text: '那我就当万年来第一个，把你从这里轰走！', avatar: 'skin_heavy', side: 'right' },
                    { speaker: '泰坦龙', text: '熔岩之冠，永不熄灭！吞噬你——', avatar: 'boss_titan_dragon', side: 'left' },
                ],
            },
            { bossKey: 'titan_shark', name: '泰坦鲨（回归）', isExclusive: false },
            { bossKey: 'whale', name: '深渊鲸（回归）', isExclusive: false },
            { bossKey: 'leviathan', name: '利维坦（回归）', isExclusive: false },
            { bossKey: 'crab', name: '深海蟹王（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv8  泰坦海蛇  +  泰坦龙 + 泰坦鲨 + 深渊鲸 + 利维坦
    // ─────────────────────────────────────────────
    {
        id: 8,
        name: '第八关：缠绕虚空',
        subtitle: '余烬核心内层 · 海蛇迷宫',
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
        bosses: [
            {
                bossKey: 'titan_serpent',
                name: '泰坦海蛇',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '泰坦海蛇', text: '来……来到我的迷宫中央……无论你多强，都只是我肚中之物……', avatar: 'boss_titan_serpent', side: 'left' },
                    { speaker: '驾驶员', text: '你的肚子够大吗？因为我带的炮弹很多。', avatar: 'skin_heavy', side: 'right' },
                    { speaker: '泰坦海蛇', text: '缠绕……缠绕……化为虚无！', avatar: 'boss_titan_serpent', side: 'left' },
                ],
            },
            { bossKey: 'titan_dragon', name: '泰坦龙（回归）', isExclusive: false },
            { bossKey: 'titan_shark', name: '泰坦鲨（回归）', isExclusive: false },
            { bossKey: 'whale', name: '深渊鲸（回归）', isExclusive: false },
            { bossKey: 'leviathan', name: '利维坦（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv9  泰坦鲸  +  泰坦海蛇 + 泰坦龙 + 泰坦鲨 + 深渊鲸
    // ─────────────────────────────────────────────
    {
        id: 9,
        name: '第九关：末日洪潮',
        subtitle: '余烬核心深处 · 泰坦鲸领域',
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
        bosses: [
            {
                bossKey: 'titan_whale',
                name: '泰坦鲸',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: '泰坦鲸', text: '……', avatar: 'boss_titan_whale', side: 'left' },
                    { speaker: '驾驶员', text: '不说话？那我就让炮弹替我问候你。', avatar: 'skin_heavy', side: 'right' },
                    { speaker: '泰坦鲸', text: '……渺小之物……你的存在……是宇宙的误差……', avatar: 'boss_titan_whale', side: 'left' },
                    { speaker: '驾驶员', text: '那这个"误差"，今天就来纠正你！', avatar: 'skin_heavy', side: 'right' },
                ],
            },
            { bossKey: 'titan_serpent', name: '泰坦海蛇（回归）', isExclusive: false },
            { bossKey: 'titan_dragon', name: '泰坦龙（回归）', isExclusive: false },
            { bossKey: 'titan_shark', name: '泰坦鲨（回归）', isExclusive: false },
            { bossKey: 'whale', name: '深渊鲸（回归）', isExclusive: false },
        ],
    },

    // ─────────────────────────────────────────────
    // Lv10  GG终焉体  +  泰坦鲸 + 泰坦海蛇 + 泰坦龙 + 泰坦鲨
    // ─────────────────────────────────────────────
    {
        id: 10,
        name: '第十关：终焉审判',
        subtitle: '余烬核心·绝对禁区',
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
        bosses: [
            {
                bossKey: 'boss_gg',
                name: 'GG终焉体',
                isExclusive: true,
                spawnDialogue: [
                    { speaker: 'GG终焉体', text: '☆★☆……信号检测……外来碳基入侵……', avatar: 'boss_gg', side: 'left' },
                    { speaker: '驾驶员', text: '你不是鱼，也不是机械……你是什么？', avatar: 'skin_heavy', side: 'right' },
                    { speaker: 'GG终焉体', text: '我是……终点。你们每一个走进这里的人，都成为了我的一部分。', avatar: 'boss_gg', side: 'left' },
                    { speaker: '驾驶员', text: '很遗憾——我不打算成为任何人的"一部分"。', avatar: 'skin_heavy', side: 'right' },
                    { speaker: 'GG终焉体', text: '……审判·启动。', avatar: 'boss_gg', side: 'left' },
                    { speaker: '深度指挥部', text: '全员收听！这是最后一战！为了所有在深渊中失踪的人，把它打回去！', avatar: 'cannon_v3', side: 'right' },
                ],
            },
            { bossKey: 'titan_whale', name: '泰坦鲸（回归）', isExclusive: false },
            { bossKey: 'titan_serpent', name: '泰坦海蛇（回归）', isExclusive: false },
            { bossKey: 'titan_dragon', name: '泰坦龙（回归）', isExclusive: false },
            { bossKey: 'titan_shark', name: '泰坦鲨（回归）', isExclusive: false },
        ],
    },
];

/** 按ID查询关卡定义 */
export function getLevel(id: number): LevelDef | undefined {
    return LEVELS.find(l => l.id === id);
}

/** 获取某关卡所有bossKey列表（专属在前） */
export function getLevelBossKeys(id: number): string[] {
    return getLevel(id)?.bosses.map(b => b.bossKey) ?? [];
}

/** 获取某关卡的专属Boss */
export function getLevelExclusiveBoss(id: number): BossEntry | undefined {
    return getLevel(id)?.bosses.find(b => b.isExclusive);
}
