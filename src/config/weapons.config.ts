/**
 * 武器配置数据层
 * 所有武器相关的静态数据集中在此，新增/修改武器只需改这个文件。
 */

export interface WeaponDef {
    id: string;
    name: string;
    desc: string;
    skinKey: string;       // AssetManager 中的贴图 key
    bulletKey: string;     // 子弹贴图 key
    unlockCost: number;    // 晶体解锁费（0=初始拥有）
    goldCost: number;      // 金币永久解锁费（0=非商城武器）
    fireInterval: number;  // 自动射击帧间隔（越小越快）
    baseSpeed: number;     // 子弹基础速度
    baseDamage: number;    // 子弹基础伤害倍率
    maxLevel: number;      // 最大等级
    isHero: boolean;       // 是否为英雄商城武器（金币购买）
    multiShot?: number;    // 一次发射子弹数（默认1）
    isAOE?: boolean;       // 是否触发爆炸AOE
    isChain?: boolean;     // 是否触发连锁闪电
}

export const WEAPONS: WeaponDef[] = [
    {
        id: 'cannon_base',
        name: '标准激光',
        desc: '联盟制式武器，均衡的射速与威力。',
        skinKey: 'cannon_v3',
        bulletKey: 'bullet_v2',
        unlockCost: 0,
        goldCost: 0,
        fireInterval: 6,
        baseSpeed: 12,
        baseDamage: 1,
        maxLevel: 5,
        isHero: false,
    },
    {
        id: 'fish_tuna_mode',
        name: '机械鱼模组',
        desc: '发射仿生机械金枪鱼，造成多次穿透。',
        skinKey: 'skin_tuna',
        bulletKey: 'bullet_v2',
        unlockCost: 1000,
        goldCost: 0,
        fireInterval: 6,
        baseSpeed: 10,
        baseDamage: 1.5,
        maxLevel: 5,
        isHero: false,
        multiShot: 3,
    },
    {
        id: 'gatling',
        name: '等离子加特林',
        desc: '极致的射速压制，让深海异种寸步难行。',
        skinKey: 'skin_gatling',
        bulletKey: 'bullet_v2',
        unlockCost: 3000,
        goldCost: 0,
        fireInterval: 2,
        baseSpeed: 18,
        baseDamage: 1.2,
        maxLevel: 5,
        isHero: false,
    },
    {
        id: 'heavy',
        name: '重爆核能炮',
        desc: '毁灭性的范围爆破，核心区域伤害翻倍。',
        skinKey: 'skin_heavy',
        bulletKey: 'bullet_v2',
        unlockCost: 8000,
        goldCost: 0,
        fireInterval: 18,
        baseSpeed: 8,
        baseDamage: 12,
        maxLevel: 5,
        isHero: false,
        isAOE: true,
    },
    {
        id: 'lightning',
        name: '连锁闪电',
        desc: '电弧跃迁打击，对群体目标效果拔群。',
        skinKey: 'skin_lightning',
        bulletKey: 'bullet_v2',
        unlockCost: 15000,
        goldCost: 0,
        // 频率降低：避免环绕电弧与音效过于密集
        fireInterval: 48,
        baseSpeed: 25,
        baseDamage: 0.8,
        maxLevel: 5,
        isHero: false,
        isChain: true,
    },
    {
        id: 'railgun',
        name: '热能轨道炮',
        desc: '毁灭性双轨打击，具备极高的贯穿伤害。',
        skinKey: 'skin_railgun',
        bulletKey: 'bullet_railgun',
        unlockCost: 50000,
        goldCost: 50000,
        fireInterval: 36,
        baseSpeed: 35,
        baseDamage: 50,
        maxLevel: 5,
        isHero: true,
    },
    {
        id: 'void',
        name: '虚空投影仪',
        desc: '制造微型黑洞，吸引范围内的所有异种。',
        skinKey: 'skin_void',
        bulletKey: 'bullet_void',
        unlockCost: 120000,
        goldCost: 150000,
        fireInterval: 60,
        baseSpeed: 5,
        baseDamage: 80,
        maxLevel: 5,
        isHero: true,
    },
    {
        id: 'acid',
        name: '生化孢子炮',
        desc: '覆盖生化酸液，造成大面积持续腐蚀。',
        skinKey: 'skin_acid',
        bulletKey: 'bullet_acid',
        unlockCost: 300000,
        goldCost: 300000,
        fireInterval: 28,
        baseSpeed: 15,
        baseDamage: 40,
        maxLevel: 5,
        isHero: true,
    },
];

/** 按 id 快速查找武器定义 */
export function getWeapon(id: string): WeaponDef | undefined {
    return WEAPONS.find(w => w.id === id);
}

/** 非英雄武器（大厅商店可购买的） */
export const STANDARD_WEAPONS = WEAPONS.filter(w => !w.isHero);

/** 英雄武器（金币商城专属） */
export const HERO_WEAPONS = WEAPONS.filter(w => w.isHero);
