import { EventBus } from './EventBus';
import {
    GameEvents,
    HudUpdatePayload,
    ComboPayload,
    FloatingTextPayload,
    ShopRefreshPayload,
    StageScorePayload,
} from './GameEvents';
import { UIManager } from '../UIManager';

/**
 * UIBridge — UI 侧事件适配器
 * 订阅游戏系统发出的事件，转发给 UIManager。
 * 由 GameController 创建/销毁，生命周期与游戏会话一致。
 */
export class UIBridge {
    private unsubs: Array<() => void> = [];

    init(): void {
        this.unsubs = [
            EventBus.on<HudUpdatePayload>(GameEvents.UI_HUD_UPDATE, ({ crystals }) => {
                UIManager.updateHUD(crystals);
            }),

            EventBus.on<ComboPayload>(GameEvents.UI_COMBO, ({ count }) => {
                UIManager.updateCombo(count);
            }),

            EventBus.on<FloatingTextPayload>(GameEvents.UI_FLOATING_TEXT, ({ x, y, text, color, isCrit }) => {
                UIManager.showFloatingText(x, y, text, color, isCrit);
            }),

            EventBus.on<ShopRefreshPayload>(GameEvents.UI_SHOP_REFRESH, ({ weapons }) => {
                UIManager.setupShop(
                    weapons,
                    (id) => EventBus.emit(GameEvents.WEAPON_SELECT, { id }),
                    (id) => EventBus.emit(GameEvents.WEAPON_UPGRADE, { id }),
                );
            }),

            EventBus.on<StageScorePayload>(GameEvents.UI_STAGE_SCORE_UPDATE, ({ currentScore, requiredScore, levelId }) => {
                UIManager.updateStageScore(currentScore, requiredScore, levelId);
            }),
        ];
    }

    destroy(): void {
        this.unsubs.forEach(u => u());
        this.unsubs = [];
    }
}
