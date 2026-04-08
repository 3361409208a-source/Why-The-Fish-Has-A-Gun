import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from './SceneManager';

/**
 * 纯 Pixi 实现的 UI 系统
 */
export class UIManager {
    private static scoreText: PIXI.Text;
    private static app: PIXI.Application;
    public static Crystals: number = 0;
    private static shopContainer: PIXI.Container;
    private static weaponButtons: Map<string, PIXI.Container> = new Map();

    public static init(app: PIXI.Application): void {
        this.app = app;
        const uiLayer = SceneManager.getLayer(Layers.UI);

        // 晶体显示 (货币)
        this.scoreText = new PIXI.Text('晶体: 0', {
            fontFamily: 'Arial',
            fontSize: 28,
            fill: 0xffffff,
            stroke: '#000000',
            strokeThickness: 4
        });
        this.scoreText.x = 20;
        this.scoreText.y = 20;
        uiLayer.addChild(this.scoreText);

        this.initShop();
    }

    private static initShop(): void {
        this.shopContainer = new PIXI.Container();
        this.shopContainer.x = SceneManager.width - 120;
        this.shopContainer.y = 100;
        SceneManager.getLayer(Layers.UI).addChild(this.shopContainer);
    }

    public static updateHUD(crystals: number): void {
        this.Crystals = crystals;
        if (this.scoreText) {
            this.scoreText.text = `晶体: ${Math.floor(crystals)}`;
        }
    }

    /**
     * 构建或更新商店面板，包含升级按钮
     */
    public static setupShop(weapons: any[], onSelect: (id: string) => void, onUpgrade: (id: string) => void): void {
        this.shopContainer.removeChildren();
        
        weapons.forEach((w, index) => {
            const btn = new PIXI.Container();
            btn.y = index * 100; // 稍微拉开间距以容纳升级按钮
            
            // 基础背景
            const bg = new PIXI.Graphics();
            bg.beginFill(w.unlocked ? 0x333333 : 0x111111, 0.9);
            bg.lineStyle(2, w.active ? 0x00f0ff : 0x444444);
            bg.drawRoundedRect(0, 0, 110, 80, 8);
            bg.endFill();
            
            const name = new PIXI.Text(w.name, { fontSize: 16, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5);
            name.x = 55;
            name.y = 15;
            
            const status = new PIXI.Text(w.unlocked ? `LV.${w.level}` : `${w.cost} 晶`, { 
                fontSize: 14, 
                fill: w.unlocked ? 0x00ff00 : 0xffcc00 
            });
            status.anchor.set(0.5);
            status.x = 55;
            status.y = 35;

            btn.addChild(bg, name, status);

            // 底部操作区
            if (w.unlocked) {
                // 升级按钮
                const upBtn = new PIXI.Graphics();
                upBtn.beginFill(0x008800);
                upBtn.drawRoundedRect(5, 50, 45, 25, 4);
                upBtn.endFill();
                const upTxt = new PIXI.Text("升级", { fontSize: 12, fill: 0xffffff });
                upTxt.anchor.set(0.5);
                upTxt.x = 27;
                upTxt.y = 62;
                
                upBtn.eventMode = 'static';
                upBtn.cursor = 'pointer';
                upBtn.on('pointerdown', (e) => {
                    e.stopPropagation();
                    onUpgrade(w.id);
                });

                // 切换按钮
                const useBtn = new PIXI.Graphics();
                useBtn.beginFill(w.active ? 0x555555 : 0x0055ff);
                useBtn.drawRoundedRect(55, 50, 45, 25, 4);
                useBtn.endFill();
                const useTxt = new PIXI.Text(w.active ? "就绪" : "切换", { fontSize: 12, fill: 0xffffff });
                useTxt.anchor.set(0.5);
                useTxt.x = 77;
                useTxt.y = 62;

                useBtn.eventMode = 'static';
                useBtn.cursor = 'pointer';
                useBtn.on('pointerdown', () => onSelect(w.id));

                btn.addChild(upBtn, upTxt, useBtn, useTxt);
            } else {
                // 购买按钮 (全宽)
                const buyBtn = new PIXI.Graphics();
                buyBtn.beginFill(0xcc6600);
                buyBtn.drawRoundedRect(5, 50, 100, 25, 4);
                buyBtn.endFill();
                const buyTxt = new PIXI.Text("解锁武器", { fontSize: 12, fill: 0xffffff });
                buyTxt.anchor.set(0.5);
                buyTxt.x = 55;
                buyTxt.y = 62;

                buyBtn.eventMode = 'static';
                buyBtn.cursor = 'pointer';
                buyBtn.on('pointerdown', () => onSelect(w.id));
                btn.addChild(buyBtn, buyTxt);
            }
            
            this.shopContainer.addChild(btn);
        });
    }

    public static addScore(value: number): void {
        this.Crystals += value;
        this.scoreText.text = `晶体: ${this.Crystals}`;
    }

    public static subtractScore(value: number): boolean {
        if (this.Crystals >= value) {
            this.Crystals -= value;
            this.scoreText.text = `晶体: ${this.Crystals}`;
            return true;
        }
        return false;
    }

    /**
     * 在指定位置显示漂浮文字特效
     */
    public static showFloatingText(x: number, y: number, text: string, color: number = 0x00ff00): void {
        const style = new PIXI.TextStyle({
            fontFamily: 'Arial',
            fontSize: 24,
            fontWeight: 'bold',
            fill: color,
            stroke: '#000000',
            strokeThickness: 3
        });
        
        const floatText = new PIXI.Text(text, style);
        floatText.x = x;
        floatText.y = y;
        floatText.anchor.set(0.5);
        
        SceneManager.getLayer(Layers.UI).addChild(floatText);
        
        // 简单的动画逻辑
        let timer = 0;
        const ticker = (delta: number) => {
            floatText.y -= delta * 1;
            floatText.alpha -= 0.02 * delta;
            
            if (floatText.alpha <= 0) {
                floatText.destroy();
                PIXI.Ticker.shared.remove(ticker);
            }
        };
        PIXI.Ticker.shared.add(ticker);
    }

    public static getScore(): number {
        return this.Crystals;
    }
}
