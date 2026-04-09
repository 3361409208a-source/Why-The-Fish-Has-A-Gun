import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from './SceneManager';
import { AssetManager } from './AssetManager';

/**
 * 纯 Pixi 实现的 UI 系统
 */
export class UIManager {
    private static scoreText: PIXI.Text;
    private static app: PIXI.Application;
    public static Crystals: number = 0;
    private static shopContainer: PIXI.Container;
    private static weaponButtons: Map<string, PIXI.Container> = new Map();
    private static menuContainer: PIXI.Container;

    public static init(app: PIXI.Application): void {
        this.app = app;
        const uiLayer = SceneManager.getLayer(Layers.UI);
        
        this.menuContainer = new PIXI.Container();
        uiLayer.addChild(this.menuContainer);

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
        this.scoreText.visible = false; // 初始隐藏，选完图再显示
        uiLayer.addChild(this.scoreText);

        this.initShop();
    }

    /**
     * 显示地图选择主界面
     */
    public static showMapSelection(onSelected: (config: any) => void): void {
        this.menuContainer.removeChildren();
        this.shopContainer.visible = false;
        
        const maps = [
            { id: 'normal', name: '孢子温床', difficulty: '普通', tex: 'map_normal', hpMult: 1.0, spawnRate: 1.0, reward: 1.0 },
            { id: 'hard', name: '放射死区', difficulty: '困难', tex: 'map_hard', hpMult: 8.0, spawnRate: 2.0, reward: 5.0 },
            { id: 'lunatic', name: '余烬核心', difficulty: '疯狂', tex: 'map_lunatic', hpMult: 30.0, spawnRate: 4.0, reward: 25.0 }
        ];

        const title = new PIXI.Text("选择变异海域", { fontSize: 48, fill: 0x00f0ff, fontWeight: 'bold' });
        title.anchor.set(0.5);
        title.x = SceneManager.width / 2;
        title.y = 80;
        this.menuContainer.addChild(title);

        maps.forEach((m, i) => {
            const card = new PIXI.Container();
            card.x = 180 + i * 320;
            card.y = 150;

            const bg = new PIXI.Graphics();
            bg.beginFill(0x222222);
            bg.lineStyle(4, i===0?0x00ff00:(i===1?0xffcc00:0xff0000));
            bg.drawRoundedRect(0, 0, 280, 420, 15);
            bg.endFill();

            // 缩略图
            const thumb = new PIXI.Sprite(AssetManager.textures[m.tex] || AssetManager.textures['bg_ocean']);
            thumb.width = 260; thumb.height = 200;
            thumb.x = 10; thumb.y = 10;
            const mask = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(10, 10, 260, 200, 10).endFill();
            thumb.mask = mask;

            const name = new PIXI.Text(m.name, { fontSize: 28, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5);
            name.x = 140; name.y = 240;

            const diff = new PIXI.Text(`难度: ${m.difficulty}`, { fontSize: 20, fill: i===0?0x00ff00:(i===1?0xffcc00:0xff0000) });
            diff.anchor.set(0.5);
            diff.x = 140; diff.y = 280;

            const info = new PIXI.Text(`血量: x${m.hpMult}\n密度: x${m.spawnRate}\n奖励: x${m.reward}`, { fontSize: 16, fill: 0xaaaaaa, align: 'center' });
            info.anchor.set(0.5);
            info.x = 140; info.y = 330;

            const btn = new PIXI.Graphics().beginFill(0x0088ff).drawRoundedRect(40, 370, 200, 40, 8).endFill();
            const btnTxt = new PIXI.Text("开始猎杀", { fontSize: 20, fill: 0xffffff });
            btnTxt.anchor.set(0.5);
            btnTxt.x = 140; btnTxt.y = 390;

            card.addChild(bg, thumb, mask, name, diff, info, btn, btnTxt);
            card.eventMode = 'static';
            card.cursor = 'pointer';
            card.on('pointerdown', () => {
                this.menuContainer.removeChildren();
                this.scoreText.visible = true;
                this.shopContainer.visible = true;
                onSelected(m);
            });

            this.menuContainer.addChild(card);
        });
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
        // 向左移动一点以便塞下更宽的菜单
        this.shopContainer.x = SceneManager.width - 200;
        
        weapons.forEach((w, index) => {
            const btn = new PIXI.Container();
            btn.y = index * 110; 
            
            // 基础背景放大
            const bg = new PIXI.Graphics();
            bg.beginFill(w.unlocked ? 0x222222 : 0x111111, 0.9);
            bg.lineStyle(2, w.active ? 0x00f0ff : 0x444444);
            bg.drawRoundedRect(0, 0, 180, 95, 8);
            bg.endFill();
            
            const name = new PIXI.Text(w.name, { fontSize: 18, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5);
            name.x = 90;
            name.y = 20;
            
            const status = new PIXI.Text(w.unlocked ? `当前等级: LV.${w.level}` : `价格: ${w.cost} 晶体`, { 
                fontSize: 16, 
                fill: w.unlocked ? 0x00ff00 : 0xffcc00 
            });
            status.anchor.set(0.5);
            status.x = 90;
            status.y = 45;

            btn.addChild(bg, name, status);

            // 底部操作区
            if (w.unlocked) {
                // 升级按钮
                const upBtn = new PIXI.Container();
                upBtn.x = 10; upBtn.y = 65;
                const upBg = new PIXI.Graphics();
                upBg.beginFill(w.isMax ? 0x555555 : 0x008800);
                upBg.drawRoundedRect(0, 0, 80, 25, 4);
                upBg.endFill();
                
                const upTxtText = w.isMax ? "已满级" : `升级(${w.upgradeCost})`;
                const upTxt = new PIXI.Text(upTxtText, { fontSize: 12, fill: 0xffffff });
                upTxt.anchor.set(0.5);
                upTxt.x = 40; upTxt.y = 12.5;
                
                upBtn.addChild(upBg, upTxt);
                upBtn.eventMode = w.isMax ? 'none' : 'static';
                upBtn.cursor = 'pointer';
                // 热区放大，防止点不中
                upBtn.hitArea = new PIXI.Rectangle(-10, -10, 100, 45);
                upBtn.on('pointerdown', (e) => {
                    e.stopPropagation();
                    if(!w.isMax) onUpgrade(w.id);
                });

                // 切换按钮
                const useBtn = new PIXI.Container();
                useBtn.x = 100; useBtn.y = 65;
                const useBg = new PIXI.Graphics();
                useBg.beginFill(w.active ? 0x555555 : 0x0055ff);
                useBg.drawRoundedRect(0, 0, 70, 25, 4);
                useBg.endFill();
                
                const useTxt = new PIXI.Text(w.active ? "使用中" : "装备", { fontSize: 14, fill: 0xffffff });
                useTxt.anchor.set(0.5);
                useTxt.x = 35; useTxt.y = 12.5;
                
                useBtn.addChild(useBg, useTxt);
                useBtn.eventMode = w.active ? 'none' : 'static';
                useBtn.cursor = 'pointer';
                useBtn.hitArea = new PIXI.Rectangle(-10, -10, 90, 45);
                useBtn.on('pointerdown', (e) => {
                    e.stopPropagation();
                    if(!w.active) onSelect(w.id);
                });

                btn.addChild(upBtn, useBtn);
            } else {
                // 购买按钮 (全宽)
                const buyBtn = new PIXI.Container();
                buyBtn.x = 10; buyBtn.y = 65;
                const buyBg = new PIXI.Graphics();
                buyBg.beginFill(0xcc6600);
                buyBg.drawRoundedRect(0, 0, 160, 25, 4);
                buyBg.endFill();
                
                const buyTxt = new PIXI.Text(`解锁武器`, { fontSize: 14, fill: 0xffffff, fontWeight: 'bold' });
                buyTxt.anchor.set(0.5);
                buyTxt.x = 80; buyTxt.y = 12.5;

                buyBtn.addChild(buyBg, buyTxt);
                buyBtn.eventMode = 'static';
                buyBtn.cursor = 'pointer';
                buyBtn.hitArea = new PIXI.Rectangle(-10, -10, 180, 45);
                buyBtn.on('pointerdown', (e) => {
                    e.stopPropagation();
                    onSelect(w.id);
                });
                
                btn.addChild(buyBtn);
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
