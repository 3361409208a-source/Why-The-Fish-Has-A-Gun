import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from './SceneManager';
import { AssetManager } from './AssetManager';
import { SaveManager } from './SaveManager';

export class UIManager {
    private static scoreText: PIXI.Text;
    private static app: PIXI.Application;
    public static Crystals: number = 0;
    private static shopContainer: PIXI.Container;
    private static menuContainer: PIXI.Container;
    private static talentContainer: PIXI.Container;

    private static comboContainer: PIXI.Container;
    private static comboText: PIXI.Text;
    private static comboValue: number = 0;
    private static comboLabel: PIXI.Text; // 将 label 提升为静态属性以便动画

    public static init(app: PIXI.Application): void {
        this.app = app;
        const uiLayer = SceneManager.getLayer(Layers.UI);
        this.menuContainer = new PIXI.Container();
        uiLayer.addChild(this.menuContainer);

        this.scoreText = new PIXI.Text('晶体: 0', {
            fontFamily: 'Verdana', fontSize: 28, fill: 0xffffff, stroke: '#000000', strokeThickness: 4
        });
        this.scoreText.x = 20; this.scoreText.y = 20; this.scoreText.visible = false; 
        uiLayer.addChild(this.scoreText);

        this.initComboUI(uiLayer);
        this.initShop();
    }

    private static initComboUI(parent: PIXI.Container): void {
        this.comboContainer = new PIXI.Container();
        this.comboContainer.x = SceneManager.width * 0.75; // 屏幕右侧四分之三处
        this.comboContainer.y = 100; // 稍微下移一点避开顶部HUD
        this.comboContainer.visible = false;

        // 英文部分 (带有优雅的小幅动画)
        this.comboLabel = new PIXI.Text('COMBO', {
            fontFamily: 'Arial Black, Gadget, sans-serif',
            fontSize: 22,
            fill: 0x00f0ff,
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        });
        this.comboLabel.anchor.set(0.5, 0.5);
        this.comboLabel.y = -45; 

        this.comboText = new PIXI.Text('0', {
            fontFamily: 'Impact, Charcoal, sans-serif',
            fontSize: 80,
            fill: [0xffffff, 0x00f0ff],
            fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 10,
            dropShadow: true,
            dropShadowBlur: 6,
            dropShadowColor: '#000000',
            dropShadowDistance: 6
        });
        this.comboText.anchor.set(0.5);
        this.comboContainer.addChild(this.comboLabel, this.comboText);
        parent.addChild(this.comboContainer);
    }

    public static updateCombo(count: number): void {
        if (count <= 0) {
            this.comboContainer.visible = false;
            this.comboValue = 0;
            return;
        }

        const isNewCombo = count > this.comboValue;
        this.comboValue = count;
        this.comboContainer.visible = true;
        this.comboText.text = `${count}`; 

        if (count > 500) {
            this.comboText.style.fill = [0xff0000, 0xffaa00];
        } else if (count > 100) {
            this.comboText.style.fill = [0xffcc00, 0xff7700];
        } else {
            this.comboText.style.fill = [0xffffff, 0x00f0ff];
        }

        // --- 核心改动：异步动画 ---
        
        // 1. 英文部分：进行优雅的“小幅度上浮+微缩放” (不跟数字同步乱跳)
        if (isNewCombo) {
            this.comboLabel.scale.set(1.2);
            this.comboLabel.y = -50;
            const labelTick = () => {
                if (this.comboLabel.scale.x > 1.0) {
                    this.comboLabel.scale.set(this.comboLabel.scale.x - 0.02);
                    this.comboLabel.y += 0.5;
                    requestAnimationFrame(labelTick);
                }
            };
            labelTick();
        }

        // 2. 数字部分：保持那种暴力的爆裂缩放
        this.comboText.scale.set(2.4);
        const numTick = () => {
            if (this.comboText.scale.x > 1.0) {
                this.comboText.scale.set(this.comboText.scale.x - 0.15);
                requestAnimationFrame(numTick);
            }
        };
        numTick();

        if (count % 10 === 0) {
            SceneManager.shake(3, 100);
        }
    }

    public static showMapSelection(onSelected: (config: any) => void): void {
        this.menuContainer.removeChildren();
        this.shopContainer.visible = false;
        const goldText = new PIXI.Text(`永久金币: ${SaveManager.state.gold}`, { 
            fontSize: 32, fill: 0xffcc00, fontWeight: 'bold', stroke: '#000', strokeThickness: 4 
        });
        goldText.x = 40; goldText.y = 40;
        this.menuContainer.addChild(goldText);
        const title = new PIXI.Text("深海余烬 - 捕鱼总部", { fontSize: 56, fill: 0x00f0ff, fontWeight: 'bold' });
        title.anchor.set(0.5); title.x = SceneManager.width / 2; title.y = 70;
        this.menuContainer.addChild(title);
        const maps = [
            { id: 'normal', name: '孢子温床', difficulty: '普通', tex: 'map_normal', hpMult: 1.0, spawnRate: 1.0, reward: 1.0 },
            { id: 'hard', name: '放射死区', difficulty: '困难', tex: 'map_hard', hpMult: 8.0, spawnRate: 2.0, reward: 5.0 },
            { id: 'lunatic', name: '余烬核心', difficulty: '疯狂', tex: 'map_lunatic', hpMult: 30.0, spawnRate: 4.0, reward: 25.0 }
        ];
        maps.forEach((m, i) => {
            const card = this.createMapCard(m, i, onSelected);
            this.menuContainer.addChild(card);
        });
        this.talentContainer = new PIXI.Container();
        this.talentContainer.x = SceneManager.width - 340;
        this.talentContainer.y = 150;
        this.menuContainer.addChild(this.talentContainer);
        this.drawTalents(goldText);
    }

    private static createMapCard(m: any, i: number, onSelected: (config: any) => void): PIXI.Container {
        const card = new PIXI.Container();
        card.x = 100 + i * 260; card.y = 150;
        const bg = new PIXI.Graphics().beginFill(0x111111, 0.85).lineStyle(3, i===0?0x00ff00:(i===1?0xffcc00:0xff0000)).drawRoundedRect(0, 0, 240, 380, 15).endFill();
        const thumb = new PIXI.Sprite(AssetManager.textures[m.tex] || AssetManager.textures['bg_ocean']);
        thumb.width = 220; thumb.height = 150; thumb.x = 10; thumb.y = 10;
        const mask = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(10, 10, 220, 150, 10).endFill();
        thumb.mask = mask;
        const name = new PIXI.Text(m.name, { fontSize: 24, fill: 0xffffff, fontWeight: 'bold' });
        name.anchor.set(0.5); name.x = 120; name.y = 190;
        const info = new PIXI.Text(`血量: x${m.hpMult}\n密度: x${m.spawnRate}\n奖励: x${m.reward}`, { fontSize: 16, fill: 0xaaaaaa, align: 'center' });
        info.anchor.set(0.5); info.x = 120; info.y = 250;
        const btn = new PIXI.Graphics().beginFill(0x0088ff).drawRoundedRect(30, 310, 180, 45, 8).endFill();
        const btnTxt = new PIXI.Text("进入海域", { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
        btnTxt.anchor.set(0.5); btnTxt.x = 120; btnTxt.y = 332;
        card.addChild(bg, thumb, mask, name, info, btn, btnTxt);
        card.eventMode = 'static'; card.cursor = 'pointer';
        card.on('pointerdown', () => {
            this.menuContainer.removeChildren(); this.scoreText.visible = true; this.shopContainer.visible = true; onSelected(m);
        });
        return card;
    }

    private static drawTalents(goldLabel: PIXI.Text): void {
        this.talentContainer.removeChildren();
        const bg = new PIXI.Graphics().beginFill(0x222222, 0.9).lineStyle(2, 0x00f0ff).drawRoundedRect(0, 0, 300, 380, 15).endFill();
        const title = new PIXI.Text("永久天赋升级", { fontSize: 24, fill: 0x00f0ff, fontWeight: 'bold' });
        title.anchor.set(0.5); title.x = 150; title.y = 30;
        this.talentContainer.addChild(bg, title);
        const talents: (keyof typeof SaveManager.state.talents)[] = ['damage', 'fireRate', 'goldBonus', 'critChance'];
        const names = { damage: '基础火力', fireRate: '射击频率', goldBonus: '收益加成', critChance: '暴击终端' };
        talents.forEach((key, index) => {
            const row = new PIXI.Container(); row.y = 60 + index * 75;
            const lvl = SaveManager.state.talents[key]; const cost = SaveManager.getUpgradeCost(key);
            const label = new PIXI.Text(`${names[key]} LV.${lvl}`, { fontSize: 18, fill: 0xffffff });
            label.x = 20; label.y = 0;
            const upgradeBtn = new PIXI.Graphics(); const canAfford = SaveManager.state.gold >= cost;
            upgradeBtn.beginFill(canAfford ? 0x00aa00 : 0x444444).drawRoundedRect(180, 0, 100, 40, 5).endFill();
            const costTxt = new PIXI.Text(`${cost} G`, { fontSize: 16, fill: 0xffffff });
            costTxt.anchor.set(0.5); costTxt.x = 230; costTxt.y = 20;
            row.addChild(label, upgradeBtn, costTxt); row.eventMode = 'static'; row.cursor = canAfford ? 'pointer' : 'default';
            row.on('pointerdown', () => {
                if (SaveManager.state.gold >= cost) {
                    SaveManager.state.gold -= cost; (SaveManager.state.talents[key] as number)++; SaveManager.save();
                    goldLabel.text = `永久金币: ${SaveManager.state.gold}`; this.drawTalents(goldLabel);
                    this.showFloatingText(SceneManager.width/2, SceneManager.height/2, "升级成功!", 0x00ff00);
                } else this.showFloatingText(SceneManager.width/2, SceneManager.height/2, "金币不足!", 0xff0000);
            });
            this.talentContainer.addChild(row);
        });
    }

    private static initShop(): void {
        this.shopContainer = new PIXI.Container();
        this.shopLayer.addChild(this.shopContainer);
    }

    private static get shopLayer(): PIXI.Container { return SceneManager.getLayer(Layers.UI); }

    public static updateHUD(crystals: number): void {
        this.Crystals = crystals;
        if (this.scoreText) this.scoreText.text = `晶体: ${Math.floor(crystals)}`;
    }

    public static setupShop(weapons: any[], onSelect: (id: string) => void, onUpgrade: (id: string) => void): void {
        this.shopContainer.removeChildren(); this.shopContainer.x = SceneManager.width - 200; this.shopContainer.y = 100;
        weapons.forEach((w, index) => {
            const btn = new PIXI.Container(); btn.y = index * 110; 
            const bg = new PIXI.Graphics().beginFill(w.unlocked ? 0x222222 : 0x111111, 0.9).lineStyle(2, w.active ? 0x00f0ff : 0x444444).drawRoundedRect(0, 0, 180, 95, 8).endFill();
            const name = new PIXI.Text(w.name, { fontSize: 18, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5); name.x = 90; name.y = 20;
            const status = new PIXI.Text(w.unlocked ? `当前等级: LV.${w.level}` : `价格: ${w.cost} 晶体`, { fontSize: 16, fill: w.unlocked ? 0x00ff00 : 0xffcc00 });
            status.anchor.set(0.5); status.x = 90; status.y = 50;
            const actionBtn = new PIXI.Graphics().beginFill(0x444444).drawRoundedRect(10, 65, 160, 25, 4).endFill();
            const actionTxt = new PIXI.Text(w.unlocked ? (w.active ? "当前选用" : "激活武器") : "解锁武器", { fontSize: 14, fill: 0xffffff });
            actionTxt.anchor.set(0.5); actionTxt.x = 90; actionTxt.y = 77;
            btn.addChild(bg, name, status, actionBtn, actionTxt);
            btn.eventMode = 'static'; btn.cursor = 'pointer'; btn.on('pointerdown', () => onSelect(w.id));
            this.shopContainer.addChild(btn);
        });
    }

    public static showFloatingText(x: number, y: number, text: string, color: number = 0xffffff): void {
        const isCrit = text.includes("CRIT");
        // [优化]：文字大小不再一致，增加随机性使其更有动感
        const baseSize = isCrit ? 42 : (text.startsWith("+") ? 32 : 24 + Math.random() * 10);
        
        const t = new PIXI.Text(text, { 
            fontFamily: 'Verdana, Geneva, sans-serif',
            fontSize: baseSize, 
            fill: color, 
            fontWeight: '900', 
            stroke: isCrit ? '#ffffff' : '#000000', 
            strokeThickness: isCrit ? 2 : 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2
        });
        t.anchor.set(0.5); t.x = x + (Math.random() - 0.5) * 40; t.y = y;
        this.shopLayer.addChild(t);
        let elapsed = 0; const vy = -4 - Math.random() * 4; const vx = (Math.random() - 0.5) * 3;
        t.scale.set(0.2); 
        const tick = () => {
            if (!t.parent) return; elapsed++; t.x += vx; t.y += vy + (elapsed * 0.15);
            if (elapsed < 10) t.scale.set(0.2 + (elapsed / 10) * (isCrit ? 1.2 : 0.8));
            if (isCrit) t.rotation = Math.sin(elapsed * 0.5) * 0.1;
            if (elapsed > 40) t.alpha = 1 - (elapsed - 40) / 20;
            if (elapsed < 60) requestAnimationFrame(tick);
            else this.shopLayer.removeChild(t);
        };
        tick();
    }
}
