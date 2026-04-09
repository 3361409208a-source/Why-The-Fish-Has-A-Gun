import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from './SceneManager';
import { AssetManager } from './AssetManager';
import { SaveManager } from './SaveManager';

/**
 * UIManager - 进阶非对称布局 (Hierarchy Layout)
 */
export class UIManager {
    private static scoreText: PIXI.Text;
    private static app: PIXI.Application;
    public static Crystals: number = 0;
    private static shopContainer: PIXI.Container;
    private static menuContainer: PIXI.Container;
    private static comboContainer: PIXI.Container;
    private static comboText: PIXI.Text;
    private static comboValue: number = 0;
    private static comboLabel: PIXI.Text; 
    private static ambientParticles: PIXI.Container;

    public static formatNumber(num: number): string {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        return num.toString();
    }

    public static init(app: PIXI.Application): void {
        this.app = app;
        const uiLayer = SceneManager.getLayer(Layers.UI);
        this.menuContainer = new PIXI.Container();
        uiLayer.addChild(this.menuContainer);

        this.scoreText = new PIXI.Text('CRYSTALS: 0', {
            fontFamily: 'Impact', fontSize: 28, fill: 0xffffff, stroke: '#000', strokeThickness: 4
        });
        uiLayer.addChild(this.scoreText); this.scoreText.visible = false;
        
        this.initComboUI(uiLayer);
        this.initShop();
        this.initAmbientFX();
    }

    private static initAmbientFX(): void {
        this.ambientParticles = new PIXI.Container();
        SceneManager.getLayer(Layers.UI).addChildAt(this.ambientParticles, 0);
        for(let i=0; i<40; i++) {
            const p = new PIXI.Graphics().beginFill(0x00f0ff, Math.random() * 0.4).drawCircle(0, 0, 1 + Math.random()*4).endFill();
            p.x = Math.random() * SceneManager.width; p.y = Math.random() * SceneManager.height;
            const s = 0.1 + Math.random() * 0.4;
            this.app.ticker.add((delta) => { p.y -= s * delta; if (p.y < -10) p.y = SceneManager.height + 10; });
            this.ambientParticles.addChild(p);
        }
    }

    private static initComboUI(parent: PIXI.Container): void {
        this.comboContainer = new PIXI.Container();
        this.comboContainer.x = SceneManager.width * 0.8; this.comboContainer.y = 120;
        this.comboContainer.visible = false;
        this.comboLabel = new PIXI.Text('×', { fontFamily: 'Impact', fontSize: 50, fill: 0x00f0ff });
        this.comboLabel.anchor.set(1, 0.5);
        this.comboText = new PIXI.Text('1', { fontFamily: 'Impact', fontSize: 100, fill: 0xffffff });
        this.comboText.anchor.set(0, 0.5);
        this.comboContainer.addChild(this.comboLabel, this.comboText);
        parent.addChild(this.comboContainer);
    }

    public static updateCombo(count: number): void {
        if(count<=0){this.comboContainer.visible=false; return;}
        this.comboContainer.visible=true; this.comboText.text=`${count}`;
        this.comboText.scale.set(1.5);
        const t = () => { if(this.comboText.scale.x > 1) { this.comboText.scale.set(this.comboText.scale.x-0.1); requestAnimationFrame(t); } }; t();
    }

    // --- 核心改动：非对称主城布局 (The Command Hub) ---
    public static showMainMenu(onStartGame: (mapConfig: any) => void): void {
        this.menuContainer.visible = true;
        this.menuContainer.removeChildren();
        this.shopContainer.visible = false; this.ambientParticles.visible = true;

        const centerX = SceneManager.width / 2;
        const centerY = SceneManager.height / 2;

        // 顶层全局 HUD
        this.menuContainer.addChild(this.createSciFiHUD());

        // 1. 中心巨型按钮：出征 (The Core Mission)
        const battleBtn = this.createMainFeatureCard({
            id: 'battle', name: '全域出征', en: 'DEPLOYMENT', icon: 'map_normal', col: 0x00ff88,
            desc: '进入异常海域清缴异形组织，获取原始资源。'
        }, 580, 500); // 巨大化
        battleBtn.x = centerX - 560; battleBtn.y = 220;
        this.menuContainer.addChild(battleBtn);
        battleBtn.on('pointertap', () => this.showMapSelection(onStartGame));

        // 2. 右侧垂直阵别：Mall, Research, Armory (卫星功能)
        const subNavs = [
            { id: 'mall', name: '全息研发', en: 'VOID FOUNDRY', icon: 'skin_railgun', col: 0xaa00ff, desc: '解锁上古英雄级武装' },
            { id: 'research', name: '生物研究', en: 'EVOLUTION', icon: 'talent_icon', col: 0x00d0ff, desc: '永久强化生理机能' },
            { id: 'armory', name: '军备维修', en: 'REFINERY', icon: 'cannon_v3', col: 0xffcc00, desc: '维护持有武器性能' }
        ];

        subNavs.forEach((n, i) => {
            const btn = this.createSubFeatureCard(n, 480, 153); // 扁平化小方块
            btn.x = centerX + 40; btn.y = 220 + i * 173;
            this.menuContainer.addChild(btn);
            btn.on('pointertap', () => {
                if (n.id === 'mall') this.showMallPage(onStartGame);
                else if (n.id === 'research') this.showTalentsPage(onStartGame);
                else if (n.id === 'armory') this.showArmoryPage(onStartGame);
            });
        });

        // 底部装饰性雷达/文本
        const footer = new PIXI.Text("DEEP SEA ANOMALY DETECTED // SECTOR-07 ACTIVE // SIGNAL STATUS: STABLE", {
            fontFamily: 'Verdana', fontSize: 12, fill: 0x00f0ff, alpha: 0.5, letterSpacing: 2
        });
        footer.anchor.set(0.5, 1); footer.x = centerX; footer.y = SceneManager.height - 20;
        this.menuContainer.addChild(footer);
    }

    private static createSciFiHUD(): PIXI.Container {
        const c = new PIXI.Container();
        const bg = new PIXI.Graphics().beginFill(0x000, 0.5).lineStyle(1, 0x00f0ff, 0.3).drawPolygon([0,0, SceneManager.width,0, SceneManager.width,60, SceneManager.width-40,80, 40,80, 0,60]).endFill();
        const title = new PIXI.Text("这鱼不对劲 // STRATEGIC HUD", { fontFamily: 'Impact', fontSize: 24, fill: 0x00f0ff, letterSpacing: 4 });
        title.anchor.set(0, 0.5); title.x = 60; title.y = 40;

        const goldVal = this.formatNumber(SaveManager.state.gold);
        const credits = new PIXI.Text(`CREDITS: ${goldVal}`, { fontFamily: 'Impact', fontSize: 28, fill: 0xffcc00 });
        credits.anchor.set(1, 0.5); credits.x = SceneManager.width - 60; credits.y = 40;

        const goldIcon = new PIXI.Sprite(AssetManager.textures['item_gold'] || PIXI.Texture.WHITE);
        goldIcon.anchor.set(1, 0.5); goldIcon.width = goldIcon.height = 38;
        goldIcon.x = credits.x - credits.width - 15; goldIcon.y = 40;

        c.addChild(bg, title, goldIcon, credits);
        return c;
    }

    // 巨大的主入口卡片
    private static createMainFeatureCard(e: any, w: number, h: number): PIXI.Container {
        const c = new PIXI.Container();
        const bg = new PIXI.Graphics().beginFill(0x05101a, 0.9).lineStyle(4, e.col).drawRect(0, 0, w, h).endFill();
        const scanline = new PIXI.Graphics().beginFill(e.col, 0.1).drawRect(0, 0, w, 2).endFill();
        this.app.ticker.add((d) => { scanline.y += d * 5; if(scanline.y > h) scanline.y = 0; });
        
        const title = new PIXI.Text(e.name, { fontFamily: 'Impact', fontSize: 64, fill: 0xffffff, stroke: e.col, strokeThickness: 4 });
        title.x = 30; title.y = 30;
        const sub = new PIXI.Text(e.en, { fontFamily: 'Impact', fontSize: 20, fill: e.col, letterSpacing: 10 });
        sub.x = 35; sub.y = 110;

        const icon = new PIXI.Sprite(AssetManager.textures[e.icon]);
        icon.anchor.set(0.5); icon.x = w/2; icon.y = h/2 + 20; icon.width = icon.height = 320;
        
        const desc = new PIXI.Text(e.desc, { fontSize: 16, fill: 0x88aabb, wordWrap: true, wordWrapWidth: w-60 });
        desc.x = 30; desc.y = h - 80;

        c.addChild(bg, scanline, title, sub, icon, desc);
        c.eventMode = 'static'; c.cursor = 'pointer';
        c.on('pointerover', () => { bg.tint = 0x555555; c.scale.set(1.02); });
        c.on('pointerout', () => { bg.tint = 0xffffff; c.scale.set(1.0); });
        return c;
    }

    // 扁平的小入口卡片
    private static createSubFeatureCard(e: any, w: number, h: number): PIXI.Container {
        const c = new PIXI.Container();
        const bg = new PIXI.Graphics().beginFill(0x05101a, 0.9).lineStyle(2, e.col, 0.6).drawRect(0, 0, w, h).endFill();
        const icon = new PIXI.Sprite(AssetManager.textures[e.icon]);
        icon.anchor.set(0.5); icon.x = 80; icon.y = h/2; icon.width = icon.height = 100;

        const title = new PIXI.Text(e.name, { fontSize: 28, fill: 0xffffff, fontWeight: 'bold' });
        title.x = 160; title.y = 30;
        const sub = new PIXI.Text(e.en, { fontFamily: 'Verdana', fontSize: 12, fill: e.col, letterSpacing: 4 });
        sub.x = 160; sub.y = 70;

        c.addChild(bg, icon, title, sub);
        c.eventMode = 'static'; c.cursor = 'pointer';
        c.on('pointerover', () => { bg.tint = 0x555555; c.x += 10; });
        c.on('pointerout', () => { bg.tint = 0xffffff; c.x -= 10; });
        return c;
    }

    // --- 商城页：非对称大小 (Elite Products Showcase) ---
    public static showMallPage(onStartGame: (mapConfig: any) => void): void {
        this.menuContainer.removeChildren();
        this.addSciFiHeader("VOID FOUNDRY - WEAPON SPECIFICATIONS", () => this.showMainMenu(onStartGame));

        const scroll = new PIXI.Container(); scroll.y = 180;
        this.menuContainer.addChild(scroll);

        // 核心亮点：英雄武器 (Huge Cards)
        const heroes = [
            { id: 'railgun', name: '热能轨道炮', cost: 100000, tex: 'skin_railgun', type: 'HEROIC', col: 0xaa00ff },
            { id: 'void', name: '虚空投影仪', cost: 250000, tex: 'skin_void', type: 'HEROIC', col: 0xcc00ff },
            { id: 'acid', name: '生化孢子炮', cost: 600000, tex: 'skin_acid', type: 'ANCIENT', col: 0x00f0ff }
        ];

        heroes.forEach((h, i) => {
            const card = this.createWeaponDetailCard(h, true); // True = Large
            card.x = 60 + i * 400; // 占据上方显著位置
            scroll.addChild(card);
        });

        // 常规武器：小方阵 (Small Cards)
        const regulars = [
            { id: 'fish_tuna_mode', name: '机械鱼', cost: 2000, tex: 'fish_tuna', col: 0x00ff88 },
            { id: 'gatling', name: '加特林', cost: 8000, tex: 'cannon_v3', col: 0x00ff88 },
            { id: 'heavy', name: '重爆炮', cost: 15000, tex: 'cannon_v3', col: 0x00ff88 },
            { id: 'lightning', name: '雷爆机', cost: 30000, tex: 'skin_lightning', col: 0xffcc00 }
        ];

        regulars.forEach((r, i) => {
            const card = this.createWeaponDetailCard(r, false); // False = Small
            card.x = 60 + i * 300; card.y = 480; // 放在下方
            scroll.addChild(card);
        });
    }

    private static createWeaponDetailCard(w: any, isLarge: boolean): PIXI.Container {
        const c = new PIXI.Container();
        const width = isLarge ? 380 : 280;
        const height = isLarge ? 450 : 250;
        
        const bg = new PIXI.Graphics().beginFill(0x0a101a).lineStyle(isLarge?3:1, w.col).drawRect(0, 0, width, height).endFill();
        const isOwned = SaveManager.state.goldUnlockedWeapons.includes(w.id);
        const canAfford = SaveManager.state.gold >= w.cost;

        const icon = new PIXI.Sprite(AssetManager.textures[w.tex] || AssetManager.textures['cannon_v3']);
        icon.anchor.set(0.5); icon.x = width/2; icon.y = isLarge ? 180 : 80;
        icon.width = icon.height = isLarge ? 240 : 120;

        const txt = new PIXI.Text(w.name, { fontSize: isLarge?32:20, fill: 0xffffff, fontWeight: 'bold' });
        txt.anchor.set(0.5); txt.x = width/2; txt.y = isLarge ? 330 : 160;

        const btn = new PIXI.Graphics().beginFill(isOwned?0x222:(canAfford?w.col:0x444)).drawRect(20, height-60, width-40, 50).endFill();
        const btnTxt = new PIXI.Text(isOwned?'ACTIVE':`${this.formatNumber(w.cost)} G`, { fontFamily: 'Impact', fontSize: isLarge?24:16, fill: isOwned?0x888:0x000 });
        btnTxt.anchor.set(0.5); btnTxt.x = width/2; btnTxt.y = height-35;

        c.addChild(bg, icon, txt, btn, btnTxt);
        if(!isOwned && canAfford) {
            c.eventMode = 'static'; c.cursor = 'pointer';
            c.on('pointertap', () => {
                SaveManager.state.gold -= w.cost; SaveManager.state.goldUnlockedWeapons.push(w.id);
                SaveManager.state.weaponLevels[w.id] = 1; SaveManager.save();
                this.showMallPage(() => {}); // 刷新
            });
        }
        return c;
    }

    // --- 地图、研究、军火页复用上一版本的优化基础，仅做结构微调 ---
    private static addSciFiHeader(title: string, onBack: () => void): void {
        const h = new PIXI.Container();
        const bg = new PIXI.Graphics().beginFill(0x000, 0.6).drawRect(0,0, SceneManager.width, 140).endFill();
        const t = new PIXI.Text(title, { fontFamily: 'Impact', fontSize: 42, fill: 0x00f0ff, letterSpacing: 4 });
        t.anchor.set(0.5, 0); t.x = SceneManager.width/2; t.y = 40;
        const back = new PIXI.Graphics().beginFill(0xff4444, 0.2).lineStyle(2, 0xff4444).drawRect(0,0, 160, 45).endFill();
        const bt = new PIXI.Text("<< BACK", { fontFamily: 'Impact', fontSize: 20, fill: 0xff4444 });
        bt.anchor.set(0.5); bt.x = 80; bt.y = 22;
        const backBtn = new PIXI.Container(); backBtn.addChild(back, bt);
        backBtn.x = 40; backBtn.y = 40; backBtn.eventMode = 'static'; backBtn.on('pointertap', onBack);
        h.addChild(bg, t, backBtn);
        this.menuContainer.addChild(h);
    }

    public static showMapSelection(onStartGame: (mapConfig: any) => void): void {
        this.menuContainer.removeChildren();
        this.addSciFiHeader("SECTOR SELECTION", () => this.showMainMenu(onStartGame));
        const maps = [
            { id: 'normal', name: '孢子温床', difficulty: 'LV-01', tex: 'map_normal', col: 0x00ff88 },
            { id: 'hard', name: '放射死区', difficulty: 'LV-02', tex: 'map_hard', col: 0xffcc00 },
            { id: 'lunatic', name: '余烬核心', difficulty: 'LV-03', tex: 'map_lunatic', col: 0xff4400 }
        ];
        maps.forEach((m, i) => {
            const card = this.createTacticalMapCard(m, i, onStartGame);
            card.x = (SceneManager.width - 960) / 2 + i * 340; card.y = 300;
            this.menuContainer.addChild(card);
        });
    }

    private static createTacticalMapCard(m: any, i: number, onSelect: any): PIXI.Container {
        const c = new PIXI.Container(); const w = 300; const h = 450;
        const bg = new PIXI.Graphics().beginFill(0x000, 0.8).lineStyle(3, m.col).drawRect(0,0,w,h).endFill();
        const thumb = new PIXI.Sprite(AssetManager.textures[m.tex]); thumb.width = w-20; thumb.height = 180; thumb.x = 10; thumb.y = 10;
        const title = new PIXI.Text(m.name, { fontSize: 28, fill: 0xffffff }); title.x = 20; title.y = 210;
        const start = new PIXI.Graphics().beginFill(m.col).drawRect(20, 360, w-40, 60).endFill();
        const st = new PIXI.Text("ENGAGE", { fontFamily: 'Impact', fontSize: 32, fill: 0x000 }); st.anchor.set(0.5); st.x = w/2; st.y = 390;
        c.addChild(bg, thumb, title, start, st); c.eventMode = 'static'; c.cursor = 'pointer';
        c.on('pointertap', () => {
            this.menuContainer.visible = false;
            this.ambientParticles.visible = false;
            onSelect(m);
        });
        return c;
    }

    public static showTalentsPage(onStartGame: (mapConfig: any) => void): void {
        this.menuContainer.removeChildren();
        this.addSciFiHeader("EVOLUTION LAB", () => this.showMainMenu(onStartGame));
        const grid = new PIXI.Container(); grid.x = (SceneManager.width - 800) / 2; grid.y = 220; this.menuContainer.addChild(grid);
        const talents: (keyof typeof SaveManager.state.talents)[] = ['damage', 'fireRate', 'goldBonus', 'critChance'];
        const names = { damage: '火力强化', fireRate: '反应速度', goldBonus: '收割增益', critChance: '致命打击' };
        talents.forEach((key, index) => {
            const card = new PIXI.Container(); const col = index % 2; const row = Math.floor(index / 2);
            card.x = col * 420; card.y = row * 240;
            const lvl = SaveManager.state.talents[key]; const cost = SaveManager.getUpgradeCost(key); const canAfford = SaveManager.state.gold >= cost;
            const bg = new PIXI.Graphics().beginFill(0x001525, 0.8).lineStyle(1, 0x00f0ff, 0.5).drawRoundedRect(0, 0, 380, 200, 10).endFill();
            const label = new PIXI.Text(names[key], { fontSize: 24, fill: 0xffffff, fontWeight: 'bold' }); label.x = 20; label.y = 20;
            const upBtn = new PIXI.Graphics().beginFill(canAfford ? 0x0088ff : 0x333333).drawRect(20, 130, 340, 50).endFill();
            const upTxt = new PIXI.Text(`EVOLVE (${this.formatNumber(cost)} G)`, { fontFamily: 'Impact', fontSize: 20, fill: 0xffffff });
            upTxt.anchor.set(0.5); upTxt.x = 190; upTxt.y = 155;
            card.addChild(bg, label, upBtn, upTxt); if(canAfford) { card.eventMode='static'; card.on('pointertap', () => { SaveManager.state.gold -= cost; (SaveManager.state.talents[key] as number)++; SaveManager.save(); this.showTalentsPage(onStartGame); }); }
            grid.addChild(card);
        });
    }

    public static showArmoryPage(onStartGame: (mapConfig: any) => void): void {
        this.menuContainer.removeChildren();
        this.addSciFiHeader("WEAPON REFINERY", () => this.showMainMenu(onStartGame));
        const list = new PIXI.Container(); list.x = (SceneManager.width - 1000) / 2; list.y = 200; this.menuContainer.addChild(list);
        const configs = [
            { id: 'cannon_base', name: '标准激光', icon: 'cannon_v3' }, { id: 'fish_tuna_mode', name: '机械鱼', icon: 'fish_tuna' },
            { id: 'gatling', name: '加特林', icon: 'cannon_v3' }, { id: 'heavy', name: '重爆炮', icon: 'cannon_v3' },
            { id: 'lightning', name: '连锁闪电', icon: 'skin_lightning' }, { id: 'railgun', name: '轨道炮', icon: 'skin_railgun' },
            { id: 'void', name: '虚空投影', icon: 'skin_void' }, { id: 'acid', name: '生化孢子', icon: 'skin_acid' }
        ];
        const owned = configs.filter(w=>SaveManager.state.goldUnlockedWeapons.includes(w.id));
        owned.forEach((w, index) => {
            const row = new PIXI.Container(); const col = index % 3; const line = Math.floor(index / 3);
            row.x = col * 340; row.y = line * 260;
            const lvl = SaveManager.state.weaponLevels[w.id] || 1; const cost = Math.floor(5000 * Math.pow(2.2, lvl - 1)); const isMax = lvl >= 5; const canAfford = !isMax && SaveManager.state.gold >= cost;
            const bg = new PIXI.Graphics().beginFill(0x0a1525, 0.9).lineStyle(1, 0xffcc00, 0.4).drawRect(0, 0, 310, 230).endFill();
            const icon = new PIXI.Sprite(AssetManager.textures[w.icon]); icon.anchor.set(0.5); icon.x = 155; icon.y = 70; icon.width = icon.height = 100;
            const name = new PIXI.Text(`${w.name} LV.${lvl}`, { fontSize: 22, fill: 0xffffff, fontWeight: 'bold' }); name.anchor.set(0.5); name.x = 155; name.y = 135;
            const upBtn = new PIXI.Graphics().beginFill(isMax?0x222:(canAfford?0xffaa00:0x333)).drawRect(10, 160, 290, 50).endFill();
            const upTxt = new PIXI.Text(isMax?'MAXED':`FIX (${this.formatNumber(cost)} G)`, { fontFamily: 'Impact', fontSize: 18, fill: isMax?0x888:0x000 });
            upTxt.anchor.set(0.5); upTxt.x = 155; upTxt.y = 185;
            row.addChild(bg, icon, name, upBtn, upTxt); if(canAfford){ row.eventMode='static'; row.on('pointertap', ()=>{ SaveManager.state.gold-=cost; SaveManager.state.weaponLevels[w.id]=lvl+1; SaveManager.save(); this.showArmoryPage(onStartGame); }); }
            list.addChild(row);
        });
    }

    private static initShop(): void { this.shopContainer = new PIXI.Container(); SceneManager.getLayer(Layers.UI).addChild(this.shopContainer); }
    private static get shopLayer(): PIXI.Container { return SceneManager.getLayer(Layers.UI); }
    public static updateHUD(crystals: number): void { this.Crystals = crystals; if (this.scoreText) this.scoreText.text = `CRYSTALS: ${Math.floor(crystals)}`; }
    public static setupShop(weapons: any[], onSelect: (id: string) => void, onUpgrade: (id: string) => void): void {
        this.shopContainer.removeChildren(); this.shopContainer.x = SceneManager.width - 200; this.shopContainer.y = 120;
        weapons.forEach((w, index) => {
            const btn = new PIXI.Container(); btn.y = index * 110; 
            const bg = new PIXI.Graphics().beginFill(w.unlocked ? 0x222222 : 0x111111, 0.95).lineStyle(2, w.active ? 0x00f0ff : 0x444444).drawRect(0, 0, 180, 95).endFill();
            const name = new PIXI.Text(w.name, { fontFamily: 'Impact', fontSize: 20, fill: 0xffffff }); name.anchor.set(0.5); name.x = 90; name.y = 25;
            btn.addChild(bg, name); btn.eventMode = 'static'; btn.on('pointertap', () => onSelect(w.id));
            this.shopContainer.addChild(btn);
        });
    }
    public static showFloatingText(x: number, y: number, text: string, color: number = 0xffffff, isCrit: boolean = false): void {
        const t = new PIXI.Text(text, { fontFamily: 'Impact', fontSize: isCrit?50:24, fill: color, stroke: '#000', strokeThickness: 4 });
        t.anchor.set(0.5); t.x = x; t.y = y; this.shopLayer.addChild(t); let e = 0; const tk = () => { if(!t.parent) return; e++; t.y -= 2; t.alpha = 1 - e/60; if(e<60) requestAnimationFrame(tk); else this.shopLayer.removeChild(t); }; tk();
    }
    public static showConfirm(m: string, t: string = 'CONFIRM'): Promise<boolean> { return new Promise((res) => { res(true); }); } // 简化占位
    public static showDialogue(lines: any[]): Promise<void> { return new Promise((res) => { res(); }); } // 简化占位
}
