/**
 * 武器技能树配置数据层
 * 每个技能有唯一ID、名称、描述、费用、最大等级、前置技能。
 * 技能效果由 CombatSystem / WeaponSystem / Bullet 在运行时读取。
 */

export interface SkillNode {
    /** 唯一技能ID */
    id: string;
    /** 显示名称 */
    name: string;
    /** 描述 */
    desc: string;
    /** 图标key（AssetManager贴图） */
    icon: string;
    /** 每级解锁费用（金币） */
    costPerLevel: number;
    /** 最大等级 */
    maxLevel: number;
    /** 前置技能ID（需达到1级才能解锁本技能） */
    prerequisite?: string;
    /** 技能分支（用于UI分组显示） */
    branch: 'offense' | 'defense' | 'utility';
    /** 技能效果参数（每级增量），由系统层读取 */
    effectPerLevel: number;
    /** 效果类型标识，系统层据此分发逻辑 */
    effectType: 'pierce' | 'split' | 'critBoost' | 'aoeBoost' | 'chainBoost' | 'goldBoost' | 'fireRateBoost' | 'damageBoost' | 'berserkBoost' | 'multiCannon';
}

export const SKILL_TREE: SkillNode[] = [
    // ── 进攻分支 ──
    {
        id: 'pierce',
        name: '穿甲弹',
        desc: '子弹穿透敌人后继续飞行，每级穿透+1个敌人',
        icon: 'bullet_v2',
        costPerLevel: 2000,
        maxLevel: 5,
        branch: 'offense',
        effectPerLevel: 1,
        effectType: 'pierce',
    },
    {
        id: 'split',
        name: '分裂弹',
        desc: '子弹命中敌人后分裂出2枚小子弹，每级分裂伤害+15%',
        icon: 'bullet_v2',
        costPerLevel: 3000,
        maxLevel: 3,
        prerequisite: 'pierce',
        branch: 'offense',
        effectPerLevel: 0.15,
        effectType: 'split',
    },
    {
        id: 'critBoost',
        name: '暴击强化',
        desc: '暴击伤害倍率额外+0.5/级',
        icon: 'skin_lightning',
        costPerLevel: 1500,
        maxLevel: 5,
        branch: 'offense',
        effectPerLevel: 0.5,
        effectType: 'critBoost',
    },
    {
        id: 'aoeBoost',
        name: '爆燃扩展',
        desc: 'AOE爆炸范围每级+20%',
        icon: 'skin_heavy',
        costPerLevel: 2500,
        maxLevel: 4,
        prerequisite: 'critBoost',
        branch: 'offense',
        effectPerLevel: 0.2,
        effectType: 'aoeBoost',
    },
    {
        id: 'chainBoost',
        name: '电弧增辐',
        desc: '连锁闪电跳跃次数每级+2',
        icon: 'skin_lightning',
        costPerLevel: 2500,
        maxLevel: 4,
        branch: 'offense',
        effectPerLevel: 2,
        effectType: 'chainBoost',
    },

    // ── 防御分支 ──
    {
        id: 'multiCannon',
        name: '多管联装',
        desc: '每级增加1个炮管，同时发射多发子弹（扇形散射）',
        icon: 'cannon_v3',
        costPerLevel: 5000,
        maxLevel: 3,
        branch: 'defense',
        effectPerLevel: 1,
        effectType: 'multiCannon',
    },
    {
        id: 'damageBoost',
        name: '火力增幅',
        desc: '全武器基础伤害每级+8%',
        icon: 'cannon_v3',
        costPerLevel: 1000,
        maxLevel: 8,
        branch: 'defense',
        effectPerLevel: 0.08,
        effectType: 'damageBoost',
    },
    {
        id: 'fireRateBoost',
        name: '射速超频',
        desc: '全武器射速每级+5%',
        icon: 'skin_gatling',
        costPerLevel: 1200,
        maxLevel: 6,
        prerequisite: 'damageBoost',
        branch: 'defense',
        effectPerLevel: 0.05,
        effectType: 'fireRateBoost',
    },
    {
        id: 'berserkBoost',
        name: '狂热延长',
        desc: '狂热爆发持续时间每级+1秒',
        icon: 'skin_heavy',
        costPerLevel: 3000,
        maxLevel: 3,
        prerequisite: 'fireRateBoost',
        branch: 'defense',
        effectPerLevel: 60, // 帧数（60fps下1秒=60帧）
        effectType: 'berserkBoost',
    },

    // ── 效用分支 ──
    {
        id: 'goldBoost',
        name: '收益增幅',
        desc: '击杀金币收益每级+10%',
        icon: 'fish_tuna',
        costPerLevel: 800,
        maxLevel: 8,
        branch: 'utility',
        effectPerLevel: 0.1,
        effectType: 'goldBoost',
    },
];

/** 按ID查询技能定义 */
export function getSkill(id: string): SkillNode | undefined {
    return SKILL_TREE.find(s => s.id === id);
}

/** 获取技能当前等级（同步读取存档） */
export function getSkillLevel(id: string): number {
    // 直接从 localStorage 同步读取，避免 require/import 异步问题
    try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('DeepSeaEmbers_SaveV1') : null;
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed.skillTree?.[id] || 0;
        }
    } catch (_) { /* fallback */ }
    return 0;
}

/** 获取技能效果总值 */
export function getSkillEffect(id: string): number {
    const skill = getSkill(id);
    if (!skill) return 0;
    const level = getSkillLevel(id);
    return level * skill.effectPerLevel;
}
