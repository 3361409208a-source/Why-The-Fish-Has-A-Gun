/**
 * 全局存档与升级系统
 * 负责持久化存储玩家的金币(Gold)和永久天赋(Talents)。
 */
export class SaveManager {
    private static SAVE_KEY = 'DeepSeaEmbers_SaveV1';

    // 存档结构
    public static state: {
        gold: number;
        talents: { damage: number; fireRate: number; goldBonus: number; critChance: number; };
        unlockedMaps: string[];
        weaponLevels: { [id: string]: number };
        goldUnlockedWeapons: string[];
        /** 当前选择的层（默认1） */
        currentLayer: number;
        /** 每层当前选择的区域（默认1）{ layer: area } */
        currentArea: { [layer: string]: number };
        /** 每关历史最高分数（分层）{ layer: { levelId: bestScore } } */
        layerStageScores: { [layer: string]: { [id: string]: number } };
        /** 每层已解锁的关卡ID列表 { layer: [levelIds] } */
        unlockedLayerStages: { [layer: string]: number[] };
        /** 每层已解锁的区域列表 { layer: [areas] } */
        unlockedLayerAreas: { [layer: string]: number[] };
        /** 已解锁的层列表 */
        unlockedLayers: number[];
        /** 技能树解锁状态 { skillId: level } */
        skillTree: { [id: string]: number };
        /** 无尽模式各难度最高分 { difficulty: bestScore } */
        endlessScores: { [difficulty: string]: number };
    } = {
        gold: 1000,
        talents: {
            damage: 0,
            fireRate: 0,
            goldBonus: 0,
            critChance: 0
        },
        unlockedMaps: ['normal'],
        weaponLevels: {},
        goldUnlockedWeapons: [],
        currentLayer: 1,
        currentArea: { '1': 1, '2': 1, '3': 1 },
        layerStageScores: { '1': {}, '2': {}, '3': {} },
        unlockedLayerStages: { '1': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        unlockedLayerAreas: { '1': [1], '2': [1], '3': [1] },
        unlockedLayers: [1],
        skillTree: {},
        endlessScores: {},
    };

    /**
     * 加载存档
     */
    public static load(): void {
        let data: string | null = null;
        try {
            // 兼容微信小游戏环境
            if (typeof (window as any).wx !== 'undefined') {
                data = (window as any).wx.getStorageSync(this.SAVE_KEY);
            } else if (typeof localStorage !== 'undefined') {
                data = localStorage.getItem(this.SAVE_KEY);
            }
        } catch (err) {
            console.warn('Save data load failed, using defaults');
        }

        if (data) {
            try {
                const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                // 深合并：保护新字段（如 weaponLevels）不被旧存档数据覆盖掉
                this.state.gold = parsed.gold ?? this.state.gold;
                this.state.unlockedMaps = parsed.unlockedMaps ?? this.state.unlockedMaps;
                if (parsed.talents) {
                    Object.assign(this.state.talents, parsed.talents);
                }
                if (parsed.weaponLevels) {
                    Object.assign(this.state.weaponLevels, parsed.weaponLevels);
                }
                // 新分层数据加载
                this.state.currentLayer = parsed.currentLayer ?? this.state.currentLayer;
                if (parsed.currentArea && typeof parsed.currentArea === 'object') {
                    Object.assign(this.state.currentArea, parsed.currentArea);
                }
                if (parsed.layerStageScores && typeof parsed.layerStageScores === 'object') {
                    Object.assign(this.state.layerStageScores, parsed.layerStageScores);
                }
                if (parsed.unlockedLayerStages && typeof parsed.unlockedLayerStages === 'object') {
                    Object.assign(this.state.unlockedLayerStages, parsed.unlockedLayerStages);
                }
                if (parsed.unlockedLayerAreas && typeof parsed.unlockedLayerAreas === 'object') {
                    Object.assign(this.state.unlockedLayerAreas, parsed.unlockedLayerAreas);
                }
                if (Array.isArray(parsed.unlockedLayers)) {
                    this.state.unlockedLayers = parsed.unlockedLayers;
                }
                if (parsed.skillTree && typeof parsed.skillTree === 'object') {
                    Object.assign(this.state.skillTree, parsed.skillTree);
                }
                if (parsed.endlessScores && typeof parsed.endlessScores === 'object') {
                    Object.assign(this.state.endlessScores, parsed.endlessScores);
                }
                // 向后兼容：旧存档 stageScores / unlockedStages 迁移到分层结构
                if (parsed.stageScores && typeof parsed.stageScores === 'object') {
                    // 将旧数据迁移到第1层
                    Object.assign(this.state.layerStageScores['1'], parsed.stageScores);
                }
                if (Array.isArray(parsed.unlockedStages)) {
                    // 只保留区域1的关卡ID（1-10），过滤掉其他区域的数据
                    this.state.unlockedLayerStages['1'] = parsed.unlockedStages.filter((id: number) => id >= 1 && id <= 10);
                }
                if (Array.isArray(parsed.clearedStages)) {
                    for (const lvlId of parsed.clearedStages) {
                        const key = String(lvlId);
                        if (!this.state.layerStageScores['1'][key]) {
                            this.state.layerStageScores['1'][key] = 1;
                        }
                    }
                }
            } catch (e) {
                console.error('Failed to parse save data', e);
            }
        }

        // 清理无效的关卡ID - 只保留区域1的1-10，移除区域2+的关卡
        for (const layerKey in this.state.unlockedLayerStages) {
            const stages = this.state.unlockedLayerStages[layerKey];
            if (Array.isArray(stages)) {
                // 只保留区域1的关卡（ID 1-10）
                const filtered = stages.filter((id: number) => id >= 1 && id <= 10);
                if (filtered.length !== stages.length) {
                    this.state.unlockedLayerStages[layerKey] = filtered;
                    SaveManager.save(); // 立即保存清理后的存档
                }
            }
        }
    }

    /**
     * 保存存档
     */
    public static save(): void {
        try {
            const dataStr = JSON.stringify(this.state);
            if (typeof (window as any).wx !== 'undefined') {
                (window as any).wx.setStorageSync(this.SAVE_KEY, dataStr);
            } else if (typeof localStorage !== 'undefined') {
                localStorage.setItem(this.SAVE_KEY, dataStr);
            }
        } catch (err) {
            console.error('Failed to save data', err);
        }
    }

    /**
     * 获取天赋带来的属性加成倍率
     */
    public static getTalentMult(type: keyof typeof SaveManager.state.talents): number {
        const lvl = this.state.talents[type];
        switch(type) {
            case 'damage': return 1 + lvl * 0.1; // 每级 10% 伤害
            case 'fireRate': return 1 + lvl * 0.05; // 每级 5% 射速
            case 'goldBonus': return 1 + lvl * 0.2; // 每级 20% 金币加成
            case 'critChance': return 0.05 + lvl * 0.05; // 基础 5% + 每级 5% 暴击率
            default: return 1;
        }
    }

    /**
     * 升级天赋消耗
     */
    public static getUpgradeCost(type: keyof typeof SaveManager.state.talents): number {
        const lvl = this.state.talents[type];
        return Math.floor(500 * Math.pow(1.8, lvl));
    }
}
