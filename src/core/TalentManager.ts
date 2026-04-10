/**
 * 天赋管理器
 * 替代通过 window.TalentXxx 传递天赋数据的方式，提供类型安全的访问接口。
 * 在 main.ts 初始化一次后，通过 GameController 注入到需要的地方。
 */
import { SaveManager } from '../SaveManager';
import { TALENT } from '../config/balance.config';

export class TalentManager {
    /** 伤害倍率 */
    public get dmgMult(): number {
        const lvl = SaveManager.state.talents.damage;
        return 1 + lvl * TALENT.damagePerLevel;
    }

    /** 射速倍率 */
    public get fireRateMult(): number {
        const lvl = SaveManager.state.talents.fireRate;
        return 1 + lvl * TALENT.fireRatePerLevel;
    }

    /** 金币倍率 */
    public get goldMult(): number {
        const lvl = SaveManager.state.talents.goldBonus;
        return 1 + lvl * TALENT.goldBonusPerLevel;
    }

    /** 暴击率（0~1） */
    public get critChance(): number {
        const lvl = SaveManager.state.talents.critChance;
        return TALENT.critChanceBase + lvl * TALENT.critChancePerLevel;
    }

    /** 子弹速度倍率（基于射速天赋） */
    public get speedMult(): number {
        const lvl = SaveManager.state.talents.fireRate;
        return 1 + lvl * 0.02;
    }

    /** 将当前天赋值同步写入 window（向后兼容，过渡期使用） */
    public syncToWindow(): void {
        (window as any).TalentDmgMult = this.dmgMult;
        (window as any).TalentFireRateMult = this.fireRateMult;
        (window as any).TalentGoldMult = this.goldMult;
        (window as any).TalentCritChance = this.critChance;
        (window as any).TalentSpeedMult = this.speedMult;
    }
}

/** 全局单例，直接引用即可 */
export const talentManager = new TalentManager();
