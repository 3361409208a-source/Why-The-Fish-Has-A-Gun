import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from './SceneManager';
import { SaveManager } from './SaveManager';
import { FloatingText } from './ui/overlays/FloatingText';
import { ConfirmOverlay } from './ui/overlays/ConfirmOverlay';
import { DialogueOverlay } from './ui/overlays/DialogueOverlay';
import { StageUnlockOverlay, UnlockChoice } from './ui/overlays/StageUnlockOverlay';
import { BattleHUD } from './ui/battle/BattleHUD';
import { ComboDisplay } from './ui/battle/ComboDisplay';
import { WeaponShopPanel } from './ui/battle/WeaponShopPanel';
import { LobbyPage } from './ui/lobby/LobbyPage';
import { WeaponryPage } from './ui/lobby/WeaponryPage';
import { ResearchPage } from './ui/lobby/ResearchPage';
import { MallPage } from './ui/lobby/MallPage';
import { StagePage } from './ui/lobby/StagePage';
import { SkillTreePage } from './ui/lobby/SkillTreePage';
import { EndlessPage } from './ui/lobby/EndlessPage';
import type { DialogueLine } from './config/dialogue.config';

/**
 * UIManager — 路由协调层
 * 负责容器初始化、页面切换路由、以及对外暴露兼容接口。
 * 渲染逻辑全部委托给 ui/ 子模块。
 */
export class UIManager {
    private static app: PIXI.Application;
    public static Crystals: number = 0;

    private static menuContainer: PIXI.Container;
    private static mainPageContainer: PIXI.Container;
    private static navContainer: PIXI.Container;
    private static currentOnMapSelected: (config: any) => void;
    private static currentOnStageSelected: ((levelId: number, config: any) => void) | null = null;
    private static activeTab: string = 'lobby';

    // 格式化工具（向后兼容，委托给FloatingText）
    public static formatNumber(num: number): string {
        return FloatingText.formatNumber(num);
    }

    public static setOnStageSelected(cb: (levelId: number, config: any) => void): void {
        this.currentOnStageSelected = cb;
    }

    public static init(app: PIXI.Application, onMapSelected: (config: any) => void): void {
        this.app = app;
        this.currentOnMapSelected = onMapSelected;

        const uiLayer = SceneManager.getLayer(Layers.UI);

        this.menuContainer = new PIXI.Container();
        uiLayer.addChild(this.menuContainer);

        this.mainPageContainer = new PIXI.Container();
        this.menuContainer.addChild(this.mainPageContainer);

        this.navContainer = new PIXI.Container();
        this.menuContainer.addChild(this.navContainer);

        BattleHUD.init(uiLayer);
        ComboDisplay.init(uiLayer);
        WeaponShopPanel.init(uiLayer);
        FloatingText.init(uiLayer);

        this.showMapSelection(onMapSelected);
    }

    public static hideAll(): void {
        if (this.menuContainer) this.menuContainer.visible = false;
        WeaponShopPanel.hide();
        BattleHUD.hide();
        ComboDisplay.hide();
    }

    public static hideHUD(): void {
        BattleHUD.hide();
        ComboDisplay.hide();
        WeaponShopPanel.hide();
    }

    public static updateHUD(crystals: number): void {
        this.Crystals = crystals;
        BattleHUD.update(crystals);
    }

    public static updateCombo(count: number): void {
        ComboDisplay.update(count);
    }

    public static updateBerserk(charge: number, isActive: boolean): void {
        BattleHUD.updateBerserk(charge, isActive);
    }

    public static updateStageScore(currentScore: number, requiredScore: number, levelId: number): void {
        BattleHUD.updateStageScore(currentScore, requiredScore, levelId);
    }

    public static setupShop(weapons: any[], onSelect: (id: string) => void, onUpgrade: (id: string) => void): void {
        WeaponShopPanel.setup(weapons, onSelect, onUpgrade);
    }

    public static showFloatingText(x: number, y: number, text: string, color: number = 0xffffff, isCrit: boolean = false): void {
        FloatingText.show(x, y, text, color, isCrit);
    }

    public static showConfirm(message: string, title: string = '确认操作'): Promise<boolean> {
        return ConfirmOverlay.show(message, title);
    }

    public static showStageUnlockPrompt(currentScore: number, requiredScore: number, nextLevelName: string): Promise<UnlockChoice> {
        return StageUnlockOverlay.show(currentScore, requiredScore, nextLevelName);
    }

    public static showDialogue(lines: DialogueLine[]): Promise<void> {
        return DialogueOverlay.show(
            this.app,
            lines,
            () => {
                WeaponShopPanel.hide();
                BattleHUD.hide();
            },
            () => {
                BattleHUD.show();
                WeaponShopPanel.show();
            }
        );
    }

    public static showMapSelection(onSelected: (config: any) => void): void {
        this.currentOnMapSelected = onSelected;
        this.menuContainer.visible = true;
        WeaponShopPanel.hide();
        this.switchPage('lobby');
    }

    private static switchPage(pageId: string): void {
        this.activeTab = pageId;
        this.mainPageContainer.removeChildren();
        this.navContainer.removeChildren();

        this.drawHeader();

        switch (pageId) {
            case 'lobby':
                LobbyPage.draw(
                    this.mainPageContainer,
                    this.navContainer,
                    this.currentOnMapSelected,
                    () => { this.menuContainer.visible = false; },
                    (id) => this.switchPage(id)
                );
                break;
            case 'weaponry':
                WeaponryPage.draw(this.mainPageContainer);
                this.drawBackButton();
                break;
            case 'research':
                ResearchPage.draw(this.mainPageContainer, (id) => this.switchPage(id));
                this.drawBackButton();
                break;
            case 'mall':
                MallPage.draw(this.mainPageContainer, (id) => this.switchPage(id));
                this.drawBackButton();
                break;
            case 'skilltree':
                SkillTreePage.draw(this.mainPageContainer, (id) => this.switchPage(id));
                this.drawBackButton();
                break;
            case 'stage':
                if (this.currentOnStageSelected) {
                    StagePage.draw(this.mainPageContainer, this.currentOnStageSelected);
                }
                this.drawBackButton();
                break;
            case 'endless':
                EndlessPage.draw(this.mainPageContainer, this.currentOnMapSelected);
                this.drawBackButton();
                break;
        }
    }

    private static drawHeader(): void {
        const W = SceneManager.width;
        const decorator = new PIXI.Text(
            'DEPTH: 4,096m | COORD: [72.1, 19.4] | STATUS: COMMAND CENTERER ONLINE',
            { fontSize: 14, fill: 0x00f0ff, letterSpacing: 2 }
        );
        decorator.alpha = 0.5; decorator.x = 40; decorator.y = 15;
        this.mainPageContainer.addChild(decorator);

        const goldText = new PIXI.Text(`CREDITS: ${FloatingText.formatNumber(SaveManager.state.gold)}`, {
            fontSize: 32, fill: 0xffcc00, fontWeight: 'bold', stroke: '#000', strokeThickness: 4
        });
        goldText.x = 40; goldText.y = 40;
        this.mainPageContainer.addChild(goldText);

        const title = new PIXI.Text('DEEP SEA EMBERS', { fontSize: 48, fill: 0x00f0ff, fontWeight: 'bold', letterSpacing: 4 });
        title.anchor.set(0.5); title.x = W / 2; title.y = 60;
        this.mainPageContainer.addChild(title);

        const line = new PIXI.Graphics().lineStyle(2, 0x00f0ff, 0.3).moveTo(40, 95).lineTo(W - 40, 95);
        this.mainPageContainer.addChild(line);
    }

    private static drawBackButton(): void {
        const btn = new PIXI.Container();
        btn.x = 40; btn.y = 120;
        const bg = new PIXI.Graphics();
        bg.beginFill(0x8b0000, 0.4).lineStyle(2, 0xff4444, 0.8).drawPolygon([0, 0, 180, 0, 160, 50, -20, 50]).endFill();
        const txt = new PIXI.Text('« BACK TO HUB', { fontSize: 18, fill: 0xff4444, fontWeight: 'bold' });
        txt.anchor.set(0.5); txt.x = 80; txt.y = 25;
        btn.addChild(bg, txt);
        btn.eventMode = 'static'; btn.cursor = 'pointer';
        btn.on('pointerover', () => { bg.alpha = 0.8; btn.scale.set(1.05); });
        btn.on('pointerout', () => { bg.alpha = 0.4; btn.scale.set(1); });
        btn.on('pointerdown', () => this.switchPage('lobby'));
        this.navContainer.addChild(btn);
    }
}
