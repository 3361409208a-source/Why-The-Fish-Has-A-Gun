/**
 * GameEvents — 所有事件名常量 + 载荷类型定义
 * 系统只需 import GameEvents 和对应 Payload 类型，无需了解 UI 细节。
 */
export const GameEvents = {
    // 系统 → UI
    UI_HUD_UPDATE:    'ui:hud',
    UI_COMBO:         'ui:combo',
    UI_FLOATING_TEXT: 'ui:text',
    UI_SHOP_REFRESH:  'ui:shop',
    // UI → 系统（玩家操作）
    WEAPON_SELECT:    'game:weaponSelect',
    WEAPON_UPGRADE:   'game:weaponUpgrade',
} as const;

export interface HudUpdatePayload    { crystals: number; }
export interface ComboPayload        { count: number; }
export interface FloatingTextPayload { x: number; y: number; text: string; color?: number; isCrit?: boolean; }
export interface ShopRefreshPayload  { weapons: any[]; }
export interface WeaponActionPayload { id: string; }
