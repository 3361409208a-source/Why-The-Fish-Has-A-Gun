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
    } = {
        gold: 1000,
        talents: {
            damage: 0,
            fireRate: 0,
            goldBonus: 0,
            critChance: 0
        },
        unlockedMaps: ['normal'],
        weaponLevels: { 'cannon_base': 1 }, // 基础武器初始1级
        goldUnlockedWeapons: ['cannon_base'] // 初始仅解锁基础激光
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
                if (parsed.goldUnlockedWeapons) {
                    this.state.goldUnlockedWeapons = parsed.goldUnlockedWeapons;
                }
            } catch (e) {
                console.error('Failed to parse save data', e);
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
