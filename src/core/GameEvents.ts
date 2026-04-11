/**
 * GameEvents — 所有事件名常量 + 载荷类型定义
 * 系统只需 import GameEvents 和对应 Payload 类型，无需了解 UI 细节。
 */
export const GameEvents = {
    // 系统 → UI
    UI_HUD_UPDATE: 'ui:hud',
    UI_COMBO: 'ui:combo',
    UI_FLOATING_TEXT: 'ui:text',
    UI_BERSERK_UPDATE: 'ui:berserk',
    UI_SHOP_REFRESH: 'ui:shop',
    UI_STAGE_SCORE_UPDATE: 'ui:stageScore',
    // UI → 系统（玩家操作）
    WEAPON_SELECT: 'game:weaponSelect',
    WEAPON_UPGRADE: 'game:weaponUpgrade',
    // 关卡模式
    STAGE_BOSS_SPAWNED: 'stage:bossSpawned',
    STAGE_BOSS_KILLED: 'stage:bossKilled',
    STAGE_UNLOCK_REACHED: 'stage:unlockReached',
} as const;

export interface HudUpdatePayload { crystals: number; }
export interface ComboPayload { count: number; }
export interface FloatingTextPayload { x: number; y: number; text: string; color?: number; isCrit?: boolean; }
export interface ShopRefreshPayload {
    weapons: { id: string; name: string; level: number; maxLevel: number }[];
}
export interface StageScorePayload {
    currentScore: number;
    requiredScore: number;
    levelId: number;
}
export interface StageUnlockPayload {
    currentScore: number;
    requiredScore: number;
    nextLevelName: string;
}
export interface WeaponActionPayload { id: string; }
export interface StageBossPayload { bossKey: string; bossName: string; spawnDialogue?: import('../config/dialogue.config').DialogueLine[]; }
export interface StageBossKilledPayload { levelId: number; }
export interface BerserkUpdatePayload { charge: number; isActive: boolean; }
