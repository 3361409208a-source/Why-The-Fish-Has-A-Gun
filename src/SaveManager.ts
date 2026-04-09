/**
 * 全局存档与升级系统
 * 负责持久化存储玩家的金币(Gold)和永久天赋(Talents)。
 */
export class SaveManager {
    private static SAVE_KEY = 'DeepSeaEmbers_SaveV1';

    // 存档结构
    public static state = {
        gold: 1000, // 永久金币 (只有在主页用于升级)
        talents: {
            damage: 0,      // 伤害加成层数
            fireRate: 0,    // 射速加成层数
            goldBonus: 0,   // 金币获取加成
            critChance: 0   // 暴击几率
        },
        unlockedMaps: ['normal'] // 已解锁的海域
    };

    /**
     * 加载存档
     */
    public static load(): void {
        const data = localStorage.getItem(this.SAVE_KEY);
        if (data) {
            try {
                this.state = JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse save data', e);
            }
        }
    }

    /**
     * 保存存档
     */
    public static save(): void {
        localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.state));
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
