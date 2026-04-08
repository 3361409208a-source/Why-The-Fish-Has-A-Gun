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

    /**
     * 构建或更新商店面板
     */
    public static setupShop(weapons: any[], onSelect: (id: string) => void): void {
        this.shopContainer.removeChildren();
        
        weapons.forEach((w, index) => {
            const btn = new PIXI.Container();
            btn.y = index * 80;
            
            const bg = new PIXI.Graphics();
            bg.beginFill(w.unlocked ? 0x444444 : 0x222222, 0.8);
            bg.lineStyle(2, w.active ? 0x00f0ff : 0x666666);
            bg.drawRoundedRect(0, 0, 100, 60, 10);
            bg.endFill();
            
            const name = new PIXI.Text(w.name, { fontSize: 16, fill: 0xffffff });
            name.anchor.set(0.5);
            name.x = 50;
            name.y = 20;
            
            const info = new PIXI.Text(w.unlocked ? "使用" : `${w.cost} 晶`, { fontSize: 12, fill: w.unlocked ? 0x00ff00 : 0xffcc00 });
            info.anchor.set(0.5);
            info.x = 50;
            info.y = 45;
            
            btn.addChild(bg, name, info);
            btn.eventMode = 'static';
            btn.cursor = 'pointer';
            btn.on('pointerdown', () => onSelect(w.id));
            
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
