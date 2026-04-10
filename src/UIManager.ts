import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from './SceneManager';
import { AssetManager } from './AssetManager';
import { SaveManager } from './SaveManager';

export class UIManager {
    private static scoreText: PIXI.Text;
    private static app: PIXI.Application;
    public static Crystals: number = 0;
    private static shopContainer: PIXI.Container;
    private static mallContainer: PIXI.Container;
    private static weaponryContainer: PIXI.Container;
    private static menuContainer: PIXI.Container; // 主界面容器
    private static mainPageContainer: PIXI.Container; // 用于切换主页面内容的容器
    private static navContainer: PIXI.Container; // 底部导航栏容器
    private static currentOnMapSelected: (config: any) => void;

    private static comboContainer: PIXI.Container;
    private static comboText: PIXI.Text;
    private static comboValue: number = 0;
    private static comboLabel: PIXI.Text; // 将 label 提升为静态属性以便动画
    private static activeTab: string = 'lobby';
    private static container: PIXI.Container;
    private static sideHUDContainer: PIXI.Container;
    
    // 格式化数字：10000 -> 1万, 100000000 -> 1亿
    public static formatNumber(num: number): string {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        return num.toString();
    }

    public static init(app: PIXI.Application, onMapSelected: (config: any) => void): void {
        this.app = app;
        this.currentOnMapSelected = onMapSelected;
        
        // UI 总图层
        const uiLayer = SceneManager.getLayer(Layers.UI);
        this.container = new PIXI.Container();
        uiLayer.addChild(this.container);

        // 各级功能容器
        this.menuContainer = new PIXI.Container();
        this.container.addChild(this.menuContainer);

        this.mainPageContainer = new PIXI.Container();
        this.menuContainer.addChild(this.mainPageContainer);

        this.sideHUDContainer = new PIXI.Container();
        this.menuContainer.addChild(this.sideHUDContainer);

        this.navContainer = new PIXI.Container();
        this.menuContainer.addChild(this.navContainer);

        this.shopContainer = new PIXI.Container();
        this.container.addChild(this.shopContainer);

        // 基础 UI 初始化
        this.scoreText = new PIXI.Text('CREDITS: 0', {
            fontSize: 28, fill: 0xffcc00, fontWeight: 'bold'
        });
        this.scoreText.x = 20; this.scoreText.y = 20; this.scoreText.visible = false; 
        uiLayer.addChild(this.scoreText);

        this.initComboUI(uiLayer);
        this.initShop(); // 如果有商城初始化代码
    }
    
    public static hideAll(): void {
        if (this.menuContainer) this.menuContainer.visible = false;
        if (this.shopContainer) this.shopContainer.visible = false;
        if (this.scoreText) this.scoreText.visible = false;
        if (this.comboContainer) this.comboContainer.visible = false;
    }

    private static initComboUI(parent: PIXI.Container): void {
        this.comboContainer = new PIXI.Container();
        this.comboContainer.x = SceneManager.width * 0.75; // 屏幕右侧四分之三处
        this.comboContainer.y = 100; // 稍微下移一点避开顶部HUD
        this.comboContainer.visible = false;

        // × 符号（静止，放在数字左侧）
        this.comboLabel = new PIXI.Text('×', {
            fontFamily: 'Impact, Charcoal, sans-serif',
            fontSize: 48,
            fill: 0x00f0ff,
            fontWeight: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.comboLabel.anchor.set(1.0, 0.5); // 右对齐，紧贴数字左侧
        this.comboLabel.x = -6;
        this.comboLabel.y = 0;

        this.comboText = new PIXI.Text('1', {
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
        this.comboText.anchor.set(0, 0.5); // 左对齐，紧贴×右侧
        this.comboText.x = 0;
        this.comboContainer.addChild(this.comboLabel, this.comboText);
        parent.addChild(this.comboContainer);
    }

    public static hideHUD(): void {
        if (this.scoreText) this.scoreText.visible = false;
        if (this.comboContainer) this.comboContainer.visible = false;
        if (this.shopContainer) this.shopContainer.visible = false;
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
        this.currentOnMapSelected = onSelected;
        this.menuContainer.visible = true;
        this.shopContainer.visible = false;
        this.switchPage('lobby');
    }

    private static switchPage(pageId: string): void {
        this.activeTab = pageId;
        this.mainPageContainer.removeChildren();
        this.navContainer.removeChildren();
        
        // 1. 绘制顶部状态栏
        this.drawHeader();

        // 2. 绘制具体页面内容
        switch(pageId) {
            case 'lobby': 
                this.drawLobbyPage(); 
                this.drawSideHUD(); // 大厅显示侧边入口
                break;
            case 'weaponry': 
                this.drawWeaponryPage(); 
                this.drawBackButton(); // 子页面显示返回按钮
                break;
            case 'research': 
                this.drawResearchPage(); 
                this.drawBackButton();
                break;
            case 'mall': 
                this.drawMallPage(); 
                this.drawBackButton();
                break;
        }
    }

    private static drawHeader(): void {
        const W = SceneManager.width;
        // 顶部 HUD 装饰：深海深度与坐标模拟
        const decorator = new PIXI.Text(`DEPTH: 4,096m | COORD: [72.1, 19.4] | STATUS: COMMAND CENTERER ONLINE`, {
            fontSize: 14, fill: 0x00f0ff, alpha: 0.5, letterSpacing: 2
        });
        decorator.x = 40; decorator.y = 15;
        this.mainPageContainer.addChild(decorator);

        const goldValue = this.formatNumber(SaveManager.state.gold);
        const goldText = new PIXI.Text(`CREDITS: ${goldValue}`, { 
            fontSize: 32, fill: 0xffcc00, fontWeight: 'bold', stroke: '#000', strokeThickness: 4 
        });
        goldText.x = 40; goldText.y = 40;
        this.mainPageContainer.addChild(goldText);

        const title = new PIXI.Text("DEEP SEA EMBERS", { fontSize: 48, fill: 0x00f0ff, fontWeight: 'bold', letterSpacing: 4 });
        title.anchor.set(0.5); title.x = W / 2; title.y = 60;
        this.mainPageContainer.addChild(title);
        
        // 分割线
        const line = new PIXI.Graphics().lineStyle(2, 0x00f0ff, 0.3).moveTo(40, 95).lineTo(W - 40, 95);
        this.mainPageContainer.addChild(line);
    }

    private static drawSideHUD(): void {
        const tabs = [
            { id: 'weaponry', name: 'ARSENAL', icon: 'cannon_v3', desc: '武器库档案馆' },
            { id: 'research', name: 'CORE TECH', icon: 'skin_lightning', desc: '升级研究中心' },
            { id: 'mall', name: 'HERO MALL', icon: 'skin_railgun', desc: '英雄武器商店' }
        ];
        
        const W = SceneManager.width;
        this.navContainer.x = W - 320;
        this.navContainer.y = 180;

        tabs.forEach((tab, i) => {
            const tabBtn = new PIXI.Container();
            tabBtn.y = i * 130;
            
            const bg = new PIXI.Graphics();
            const bw = 280; const bh = 100; const slant = 30;
            
            bg.beginFill(0x050e1a, 0.7);
            bg.lineStyle(2, 0x3a4a5e, 1);
            bg.drawPolygon([slant, 0, bw, 0, bw - slant, bh, 0, bh]);
            bg.endFill();
            
            const iconTex = AssetManager.textures[tab.icon];
            if (iconTex) {
                const icon = new PIXI.Sprite(iconTex);
                icon.width = 60; icon.height = 60; icon.x = slant + 10; icon.y = 20;
                tabBtn.addChild(icon);
            }

            const txt = new PIXI.Text(tab.name, { fontSize: 22, fill: 0x00f0ff, fontWeight: 'bold' });
            txt.x = slant + 80; txt.y = 25;
            const desc = new PIXI.Text(tab.desc, { fontSize: 14, fill: 0x888888 });
            desc.x = slant + 80; desc.y = 55;
            
            tabBtn.addChild(bg, txt, desc);
            tabBtn.eventMode = 'static'; tabBtn.cursor = 'pointer';
            
            tabBtn.on('pointerover', () => { bg.tint = 0x00f0ff; tabBtn.scale.set(1.05); });
            tabBtn.on('pointerout', () => { bg.tint = 0xffffff; tabBtn.scale.set(1); });
            tabBtn.on('pointerdown', () => this.switchPage(tab.id));
            this.navContainer.addChild(tabBtn);
        });
    }

    private static drawBackButton(): void {
        const btn = new PIXI.Container();
        btn.x = 40; btn.y = 120;
        
        const bg = new PIXI.Graphics();
        bg.beginFill(0x8b0000, 0.4).lineStyle(2, 0xff4444, 0.8).drawPolygon([0, 0, 180, 0, 160, 50, -20, 50]).endFill();
        
        const txt = new PIXI.Text("« BACK TO HUB", { fontSize: 18, fill: 0xff4444, fontWeight: 'bold' });
        txt.anchor.set(0.5); txt.x = 80; txt.y = 25;
        
        btn.addChild(bg, txt);
        btn.eventMode = 'static'; btn.cursor = 'pointer';
        btn.on('pointerover', () => { bg.alpha = 0.8; btn.scale.set(1.05); });
        btn.on('pointerout', () => { bg.alpha = 0.4; btn.scale.set(1); });
        btn.on('pointerdown', () => this.switchPage('lobby'));
        
        this.navContainer.addChild(btn);
    }

    private static drawLobbyPage(): void {
        const maps = [
            { id: 'normal', name: '孢子温床', difficulty: '普通', tex: 'map_normal', hpMult: 1.0, spawnRate: 1.0, reward: 1.0 },
            { id: 'hard', name: '放射死区', difficulty: '困难', tex: 'map_hard', hpMult: 8.0, spawnRate: 2.0, reward: 5.0 },
            { id: 'lunatic', name: '余烬核心', difficulty: '疯狂', tex: 'map_lunatic', hpMult: 30.0, spawnRate: 4.0, reward: 25.0 }
        ];
        
        const mapContainer = new PIXI.Container();
        mapContainer.x = (SceneManager.width - (maps.length * 280 - 20)) / 2;
        mapContainer.y = 180;
        this.mainPageContainer.addChild(mapContainer);

        maps.forEach((m, i) => {
            const card = this.createMapCard(m, i, this.currentOnMapSelected);
            card.x = i * 280; card.y = 0;
            mapContainer.addChild(card);
        });
    }

    private static drawWeaponryPage(): void {
        const title = new PIXI.Text("— 武器库档案馆 —", { fontSize: 28, fill: 0xffcc00, fontWeight: 'bold' });
        title.anchor.set(0.5); title.x = SceneManager.width / 2; title.y = 160;
        this.mainPageContainer.addChild(title);

        const weapons = [
            { id: 'cannon_base', name: '标准激光', desc: '联盟制式武器，均衡的射速与威力。' },
            { id: 'fish_tuna_mode', name: '机械鱼模组', desc: '发射仿生机械金枪鱼，造成多次穿透。' },
            { id: 'gatling', name: '等离子加特林', desc: '极致的射速压制，让深海异种寸步难行。' },
            { id: 'heavy', name: '重爆核能炮', desc: '毁灭性的范围爆破，核心区域伤害翻倍。' },
            { id: 'lightning', name: '连锁闪电', desc: '电弧跃迁打击，对群体目标效果拔群。' }
        ];

        const listContainer = new PIXI.Container();
        listContainer.x = 100; listContainer.y = 220;
        this.mainPageContainer.addChild(listContainer);

        weapons.forEach((w, i) => {
            const item = new PIXI.Graphics().beginFill(0x111822, 0.8).lineStyle(2, 0x444444).drawRoundedRect(0, i * 85, SceneManager.width - 200, 75, 10).endFill();
            const lvl = SaveManager.state.weaponLevels[w.id] || 1;
            const name = new PIXI.Text(`${w.name} (LV.${lvl})`, { fontSize: 20, fill: 0x00f0ff, fontWeight: 'bold' });
            name.x = 20; name.y = i * 85 + 15;
            const desc = new PIXI.Text(w.desc, { fontSize: 16, fill: 0xaaaaaa });
            desc.x = 20; desc.y = i * 85 + 42;
            listContainer.addChild(item, name, desc);
        });
    }

    private static drawResearchPage(): void {
        const container = new PIXI.Container();
        container.x = (SceneManager.width - 700) / 2; container.y = 150;
        this.mainPageContainer.addChild(container);
        
        const bg = new PIXI.Graphics().beginFill(0x111822, 0.95).lineStyle(2, 0x00f0ff).drawRoundedRect(0, 0, 700, 650, 15).endFill();
        const title = new PIXI.Text("升级与研究中心", { fontSize: 32, fill: 0x00f0ff, fontWeight: 'bold' });
        title.anchor.set(0.5); title.x = 350; title.y = 40;
        container.addChild(bg, title);

        const leftCol = new PIXI.Container(); leftCol.x = 30; leftCol.y = 80;
        const rightCol = new PIXI.Container(); rightCol.x = 370; rightCol.y = 80;
        container.addChild(leftCol, rightCol);

        const talents: (keyof typeof SaveManager.state.talents)[] = ['damage', 'fireRate', 'goldBonus', 'critChance'];
        const names = { damage: '基础火力', fireRate: '射击频率', goldBonus: '收益加成', critChance: '暴击终端' };
        talents.forEach((key, index) => {
            const row = new PIXI.Container(); row.y = index * 130;
            const lvl = SaveManager.state.talents[key]; const cost = SaveManager.getUpgradeCost(key);
            const canAfford = SaveManager.state.gold >= cost;
            const rbg = new PIXI.Graphics().beginFill(0x1a212e).drawRoundedRect(0, 0, 310, 110, 8).endFill();
            const label = new PIXI.Text(`${names[key]}`, { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' }); label.x = 15; label.y = 15;
            const level = new PIXI.Text(`等级: ${lvl}`, { fontSize: 16, fill: 0x00f0ff }); level.x = 15; level.y = 45;
            const btn = new PIXI.Graphics().beginFill(canAfford ? 0x0088ff : 0x333333).drawRoundedRect(15, 70, 280, 30, 5).endFill();
            const btnTxt = new PIXI.Text(`升级 (${this.formatNumber(cost)} G)`, { fontSize: 16, fill: 0xffffff });
            btnTxt.anchor.set(0.5); btnTxt.x = 155; btnTxt.y = 85;
            row.addChild(rbg, label, level, btn, btnTxt);
            row.eventMode = 'static'; row.cursor = canAfford ? 'pointer' : 'default';
            row.on('pointerdown', () => {
                if (SaveManager.state.gold >= cost) {
                    SaveManager.state.gold -= cost; (SaveManager.state.talents[key] as number)++; SaveManager.save();
                    this.switchPage('research'); // 刷新整页
                    this.showFloatingText(SceneManager.width/2, SceneManager.height/2, "研究完成!", 0x00ff00);
                }
            });
            leftCol.addChild(row);
        });

        const wps = [
            { id: 'cannon_base', name: '标准激光' }, { id: 'fish_tuna_mode', name: '机械鱼' },
            { id: 'gatling', name: '加特林' }, { id: 'heavy', name: '重爆炮' }, { id: 'lightning', name: '连锁闪电' }
        ];
        wps.forEach((w, index) => {
            const row = new PIXI.Container(); row.y = index * 105;
            const lvl = SaveManager.state.weaponLevels[w.id] || 1;
            const cost = Math.floor(1000 * Math.pow(2, lvl - 1));
            const isMax = lvl >= 5; const canAfford = !isMax && SaveManager.state.gold >= cost;
            const rbg = new PIXI.Graphics().beginFill(0x1a212e).drawRoundedRect(0, 0, 310, 90, 8).endFill();
            const label = new PIXI.Text(w.name, { fontSize: 18, fill: 0xffffff }); label.x = 15; label.y = 15;
            const level = new PIXI.Text(`LV.${lvl}`, { fontSize: 16, fill: 0xffcc00 }); level.x = 15; level.y = 40;
            const btn = new PIXI.Graphics().beginFill(isMax?0x222222:(canAfford?0xaa6600:0x333333)).drawRoundedRect(160, 20, 130, 50, 5).endFill();
            const btnTxt = new PIXI.Text(isMax?'MAX':`${this.formatNumber(cost)}G`, { fontSize: 16, fill: 0xffffff });
            btnTxt.anchor.set(0.5); btnTxt.x = 225; btnTxt.y = 45;
            row.addChild(rbg, label, level, btn, btnTxt);
            if(!isMax) { row.eventMode='static'; row.cursor='pointer'; row.on('pointerdown', () => {
                if(SaveManager.state.gold >= cost){
                    SaveManager.state.gold -= cost; SaveManager.state.weaponLevels[w.id] = lvl+1; SaveManager.save();
                    this.switchPage('research'); // 刷新整页
                    this.showFloatingText(SceneManager.width/2, SceneManager.height/2, "属性提升!", 0xffcc00);
                }
            });}
            rightCol.addChild(row);
        });
    }

    private static drawMallPage(): void {
        const container = new PIXI.Container();
        container.x = (SceneManager.width - 960) / 2; container.y = 150;
        this.mainPageContainer.addChild(container);

        const bg = new PIXI.Graphics().beginFill(0x111822, 0.95).lineStyle(2, 0xff00ff).drawRoundedRect(0, 0, 960, 650, 15).endFill();
        const mainTitle = new PIXI.Text("英雄机甲商城", { fontSize: 32, fill: 0xff00ff, fontWeight: 'bold' });
        mainTitle.anchor.set(0.5); mainTitle.x = 480; mainTitle.y = 40;
        container.addChild(bg, mainTitle);

        const mallWeapons = [
            { id: 'railgun', name: '热能轨道炮', cost: 50000, tex: 'skin_railgun', desc: '毁灭性双轨打击，具备极高的贯穿伤害。' },
            { id: 'void', name: '虚空投影仪', cost: 150000, tex: 'skin_void', desc: '制造微型黑洞，吸引范围内的所有异种。' },
            { id: 'acid', name: '生化孢子炮', cost: 300000, tex: 'skin_acid', desc: '覆盖生化酸液，造成大面积持续腐蚀。' }
        ];

        mallWeapons.forEach((w, index) => {
            const card = new PIXI.Container(); card.x = 20 + index * 310; card.y = 100;
            const cbg = new PIXI.Graphics().beginFill(0x1a212e).lineStyle(1, 0x3a4a5e).drawRoundedRect(0, 0, 300, 500, 12).endFill();
            const isUnlocked = SaveManager.state.goldUnlockedWeapons.includes(w.id);
            const icon = new PIXI.Sprite(AssetManager.textures[w.tex]);
            icon.width = 180; icon.height = 180; icon.anchor.set(0.5); icon.x = 150; icon.y = 120;
            const name = new PIXI.Text(w.name, { fontSize: 24, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5); name.x = 150; name.y = 230;
            const desc = new PIXI.Text(w.desc, { fontSize: 16, fill: 0xaaaaaa, wordWrap: true, wordWrapWidth: 260, align: 'center' });
            desc.anchor.set(0.5); desc.x = 150; desc.y = 310;
            const canAfford = SaveManager.state.gold >= w.cost;
            const buyBtn = new PIXI.Graphics().beginFill(isUnlocked?0x004488:(canAfford?0x880088:0x333333)).drawRoundedRect(30, 420, 240, 50, 10).endFill();
            const buyTxt = new PIXI.Text(isUnlocked?"已入库":`解锁: ${this.formatNumber(w.cost)} G`, { fontSize: 18, fill: 0xffffff });
            buyTxt.anchor.set(0.5); buyTxt.x = 150; buyTxt.y = 445;
            card.addChild(cbg, icon, name, desc, buyBtn, buyTxt);
            if(!isUnlocked){
                card.eventMode = 'static'; card.cursor = canAfford ? 'pointer' : 'default';
                card.on('pointerdown', () => {
                    if (SaveManager.state.gold >= w.cost) {
                        SaveManager.state.gold -= w.cost; SaveManager.state.goldUnlockedWeapons.push(w.id);
                        SaveManager.state.weaponLevels[w.id] = 1; SaveManager.save();
                        this.switchPage('mall'); // 刷新整页
                        this.showFloatingText(SceneManager.width/2, SceneManager.height/2, `获得神兵: ${w.name}`, 0xff00ff);
                    }
                });
            }
            container.addChild(card);
        });
    }

    private static createMapCard(m: any, i: number, onSelected: (config: any) => void): PIXI.Container {
        const card = new PIXI.Container();
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
            this.menuContainer.visible = false;
            onSelected(m);
        });
        return card;
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

    public static showFloatingText(x: number, y: number, text: string, color: number = 0xffffff, isCrit: boolean = false): void {
        // [优化]：文字大小不再一致，增加随机性使其更有动感
        const baseSize = isCrit ? 44 : (text.startsWith("+") ? 22 : 16 + Math.random() * 6);
        
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

    /**
     * 统一风格的确认弹窗（替代原生 confirm()）
     * 返回 Promise<boolean>，true = 确认，false = 取消
     */
    public static showConfirm(message: string, title: string = '确认操作'): Promise<boolean> {
        return new Promise((resolve) => {
            const uiLayer = SceneManager.getLayer(Layers.UI);
            const W = SceneManager.width;
            const H = SceneManager.height;

            // 全屏半透明遮罩
            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.65);
            overlay.drawRect(0, 0, W, H);
            overlay.endFill();
            overlay.eventMode = 'static'; // 阻止点击穿透
            uiLayer.addChild(overlay);

            // 弹窗主体
            const panelW = 480; const panelH = 220;
            const panelX = (W - panelW) / 2; const panelY = (H - panelH) / 2;

            const panel = new PIXI.Graphics();
            // 深色半透明背景
            panel.beginFill(0x050e1a, 0.92);
            panel.lineStyle(2, 0x00f0ff, 0.9);
            panel.drawRoundedRect(0, 0, panelW, panelH, 16);
            panel.endFill();
            // 顶部青色高光条
            panel.beginFill(0x00f0ff, 0.15);
            panel.drawRoundedRect(0, 0, panelW, 52, 16);
            panel.endFill();
            panel.x = panelX; panel.y = panelY;
            uiLayer.addChild(panel);

            // 标题
            const titleText = new PIXI.Text(title, {
                fontFamily: 'Verdana, sans-serif',
                fontSize: 22, fontWeight: 'bold',
                fill: 0x00f0ff,
                stroke: '#000000', strokeThickness: 3,
            });
            titleText.anchor.set(0.5, 0.5);
            titleText.x = panelX + panelW / 2; titleText.y = panelY + 26;
            uiLayer.addChild(titleText);

            // 消息文本
            const msgText = new PIXI.Text(message, {
                fontFamily: 'Verdana, sans-serif',
                fontSize: 18, fill: 0xdddddd,
                align: 'center', wordWrap: true, wordWrapWidth: panelW - 60
            });
            msgText.anchor.set(0.5, 0.5);
            msgText.x = panelX + panelW / 2; msgText.y = panelY + 115;
            uiLayer.addChild(msgText);

            const close = (result: boolean) => {
                uiLayer.removeChild(overlay, panel, titleText, msgText, confirmBtn, cancelBtn);
                resolve(result);
            };

            // 确认按钮（红色警示）
            const confirmBtn = new PIXI.Container();
            const confirmBg = new PIXI.Graphics();
            confirmBg.beginFill(0x8b0000, 0.9).lineStyle(2, 0xff4444).drawRoundedRect(0, 0, 140, 44, 10).endFill();
            const confirmTxt = new PIXI.Text('放弃猎杀', { fontFamily: 'Verdana', fontSize: 16, fill: 0xffffff, fontWeight: 'bold' });
            confirmTxt.anchor.set(0.5); confirmTxt.x = 70; confirmTxt.y = 22;
            confirmBtn.addChild(confirmBg, confirmTxt);
            confirmBtn.x = panelX + panelW / 2 - 155; confirmBtn.y = panelY + panelH - 66;
            confirmBtn.eventMode = 'static'; confirmBtn.cursor = 'pointer';
            confirmBtn.on('pointerdown', () => close(true));
            confirmBtn.on('pointerover', () => { confirmBg.tint = 0xff6666; });
            confirmBtn.on('pointerout', () => { confirmBg.tint = 0xffffff; });
            uiLayer.addChild(confirmBtn);

            // 取消按钮（青色）
            const cancelBtn = new PIXI.Container();
            const cancelBg = new PIXI.Graphics();
            cancelBg.beginFill(0x003344, 0.9).lineStyle(2, 0x00f0ff).drawRoundedRect(0, 0, 140, 44, 10).endFill();
            const cancelTxt = new PIXI.Text('继续战斗', { fontFamily: 'Verdana', fontSize: 16, fill: 0x00f0ff, fontWeight: 'bold' });
            cancelTxt.anchor.set(0.5); cancelTxt.x = 70; cancelTxt.y = 22;
            cancelBtn.addChild(cancelBg, cancelTxt);
            cancelBtn.x = panelX + panelW / 2 + 15; cancelBtn.y = panelY + panelH - 66;
            cancelBtn.eventMode = 'static'; cancelBtn.cursor = 'pointer';
            cancelBtn.on('pointerdown', () => close(false));
            cancelBtn.on('pointerover', () => { cancelBg.tint = 0x66ffff; });
            cancelBtn.on('pointerout', () => { cancelBg.tint = 0xffffff; });
            uiLayer.addChild(cancelBtn);
        });
    }
    /**
     * 显示开场/剧情对话
     * @param lines 对话内容数组，包含头像
     * @returns Promise 当对话全部完成时 resolve
     */
    public static showDialogue(lines: { speaker: string, text: string, avatar?: string, side?: 'left' | 'right' }[]): Promise<void> {
        return new Promise((resolve) => {
            const uiLayer = SceneManager.getLayer(Layers.UI);
            const storyLayer = SceneManager.getLayer(Layers.Story);
            const W = SceneManager.width;
            const H = SceneManager.height;

            const container = new PIXI.Container();
            storyLayer.addChild(container);

            // 剧情开始，隐藏乱七八糟的UI层
            uiLayer.visible = false;

            // 扭曲滤镜 (用于给人物立绘增加水动感/全息感)
            const rippleFilter = new PIXI.Filter(undefined, `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform float uTime;
                void main(void) {
                    vec2 uv = vTextureCoord;
                    float wave = sin(uv.y * 10.0 + uTime * 2.0) * 0.003;
                    gl_FragColor = texture2D(uSampler, uv + vec2(wave, 0.0));
                }
            `, { uTime: 0 });

            // 2. 底部话框背景 (赛博深蓝色渐变)
            const boxH = 200;
            const bg = new PIXI.Graphics()
                .beginFill(0x050e1a, 0.95)
                .lineStyle(2, 0x00f0ff, 0.8)
                .drawRect(0, H - boxH - 20, W, boxH)
                .endFill();
            container.addChild(bg);

            // 立绘显示 (加大尺寸至 600px)
            const leftAvatar = new PIXI.Sprite();
            leftAvatar.anchor.set(0.5, 1); leftAvatar.x = 280; leftAvatar.y = H - 20;
            leftAvatar.filters = [rippleFilter];
            const rightAvatar = new PIXI.Sprite();
            rightAvatar.anchor.set(0.5, 1); rightAvatar.x = W - 280; rightAvatar.y = H - 20;
            rightAvatar.filters = [rippleFilter];
            container.addChild(leftAvatar, rightAvatar);

            // 动画循环
            let totalTime = 0;
            const ticker = (delta: number) => {
                totalTime += delta * 0.02;
                rippleFilter.uniforms.uTime = totalTime;
            };
            this.app.ticker.add(ticker);

            const nameBg = new PIXI.Graphics().beginFill(0x00f0ff, 0.3).drawRect(0, 0, 240, 45).endFill();
            const nameText = new PIXI.Text('', { fontFamily: 'Verdana', fontSize: 26, fill: 0xffffff, fontWeight: 'bold' });
            nameText.anchor.set(0.5); nameText.y = 22;
            const nameGroup = new PIXI.Container();
            nameGroup.addChild(nameBg, nameText);
            nameGroup.y = H - boxH - 65;
            container.addChild(nameGroup);

            const contentText = new PIXI.Text('', { 
                fontFamily: 'Verdana', fontSize: 24, fill: 0xffffff, 
                wordWrap: true, wordWrapWidth: W - 600, lineHeight: 36 
            });
            contentText.y = H - boxH + 20;
            container.addChild(contentText);

            const skipHint = new PIXI.Text('点击屏幕继续 »', { fontFamily: 'Verdana', fontSize: 16, fill: 0x00f0ff });
            skipHint.alpha = 0.6; skipHint.anchor.set(1, 1); skipHint.x = W - 40; skipHint.y = H - 40;
            container.addChild(skipHint);

            let currentLine = 0; let currentChar = 0; let isTyping = false; let timer: any = null;

            const updateAvatar = () => {
                const line = lines[currentLine];
                const tex = AssetManager.textures[line.avatar || ''];
                
                // 设置活跃立绘并显示
                const activeAvatar = line.side === 'right' ? rightAvatar : leftAvatar;
                const inactiveAvatar = line.side === 'right' ? leftAvatar : rightAvatar;
                
                if (tex) {
                    activeAvatar.texture = tex;
                    activeAvatar.visible = true;
                    
                    // 关键修复：蛟龙（fish_dragon）属于超长资产，如果设置 600 高度会超出屏幕
                    // 针对它进行特殊缩放限制
                    if (line.avatar === 'fish_dragon') {
                        activeAvatar.height = 450;
                    } else {
                        activeAvatar.height = 600;
                    }
                    
                    const baseScale = Math.abs(activeAvatar.scale.y);

                    // 关键修复：素材通常朝左，左侧 Boss 需要镜像反转以面向玩家（右侧）
                    if (line.side === 'right') {
                        activeAvatar.scale.x = baseScale; // 右侧面向左
                    } else {
                        activeAvatar.scale.x = -baseScale; // 左侧反转面向右
                    }
                    
                    activeAvatar.alpha = 1; 
                    activeAvatar.tint = 0xffffff;
                } else {
                    activeAvatar.visible = false;
                }

                // 压暗非活跃方
                if (inactiveAvatar.texture) {
                    inactiveAvatar.alpha = 0.5;
                    inactiveAvatar.tint = 0x888888;
                }
            };

            const showNextChar = () => {
                const line = lines[currentLine];
                if (currentChar < line.text.length) {
                    contentText.text += line.text[currentChar];
                    currentChar++;
                    timer = setTimeout(showNextChar, 25);
                } else {
                    isTyping = false;
                }
            };

            const next = () => {
                if (isTyping) {
                    clearTimeout(timer); contentText.text = lines[currentLine].text; isTyping = false; return;
                }

                currentLine++;
                if (currentLine >= lines.length) {
                    container.eventMode = 'none';
                    this.app.ticker.remove(ticker); // 清理动画循环
                    this.app.ticker.add((delta: number) => {
                        container.alpha -= 0.1 * delta;
                        if (container.alpha <= 0) { 
                            storyLayer.removeChild(container); 
                            // 恢复界面层
                            uiLayer.visible = true;
                            this.shopContainer.visible = true;
                            this.scoreText.visible = true;
                            resolve(); 
                        }
                    });
                } else {
                    const line = lines[currentLine];
                    nameText.text = line.speaker;
                    nameGroup.x = line.side === 'right' ? W - 280 : 40;
                    nameText.x = 120;
                    contentText.x = line.side === 'right' ? 100 : 350;
                    contentText.text = ''; currentChar = 0; isTyping = true;
                    updateAvatar();
                    showNextChar();
                }
            };

            container.eventMode = 'static'; container.cursor = 'pointer'; container.on('pointerdown', next);
            
            // 剧情开始，隐藏乱七八糟的UI
            this.shopContainer.visible = false;
            this.scoreText.visible = false;

            // 初始化
            nameText.text = lines[0].speaker;
            nameGroup.x = lines[0].side === 'right' ? W - 280 : 40;
            nameText.x = 120;
            contentText.x = lines[0].side === 'right' ? 100 : 350;
            updateAvatar();
            isTyping = true;
            showNextChar();
        });
    }
}
