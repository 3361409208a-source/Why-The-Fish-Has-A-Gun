import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { AssetManager } from '../../AssetManager';
import { LEVELS, getLayerLevels, getLayerAreaLevels, LAYER_CONFIGS, getLayerName, isLayerUnlocked, getAreaName, LEVELS_PER_AREA } from '../../config/levels.config';
import { SaveManager } from '../../SaveManager';
import { FloatingText } from '../overlays/FloatingText';

export class LobbyPage {
    public static draw(
        container: PIXI.Container,
        sideNav: PIXI.Container,
        onMapSelected: (config: any) => void,
        onMenuHide: () => void,
        onSwitchPage: (id: string) => void
    ): void {
        const currentLayer = SaveManager.state.currentLayer || 1;
        const layerKey = String(currentLayer);
        const currentArea = SaveManager.state.currentArea[layerKey] || 1;
        const unlockedAreas = SaveManager.state.unlockedLayerAreas[layerKey] || [1];
        const maxArea = Math.max(...unlockedAreas, 1); // 确保至少为1

        // 显示3个区域卡片
        this.drawAreaCards(container, currentLayer, currentArea, unlockedAreas, maxArea, onMapSelected, onMenuHide, onSwitchPage);

        this.drawSideHUD(sideNav, onSwitchPage);
    }

    /** 绘制3个区域卡片 */
    private static drawAreaCards(
        container: PIXI.Container,
        currentLayer: number,
        currentArea: number,
        unlockedAreas: number[],
        maxArea: number,
        onMapSelected: (config: any) => void,
        onMenuHide: () => void,
        onSwitchPage: (id: string) => void
    ): void {
        const W = SceneManager.width;
        const cardW = 320;
        const cardH = 400;
        const gap = 30;
        const totalW = 3 * cardW + 2 * gap;
        const startX = (W - totalW - 300) / 2; // 右侧留给nav
        const startY = 120;

        // 确定3个显示的区域：始终包含区域1，然后是当前、下一区域
        const areasToShow: number[] = [1]; // 始终显示第一区域
        // 添加当前区域（如果不是区域1）
        if (currentArea !== 1 && !areasToShow.includes(currentArea)) {
            areasToShow.push(currentArea);
        }
        // 添加下一区域
        if (currentArea + 1 <= maxArea + 1 && !areasToShow.includes(currentArea + 1)) {
            areasToShow.push(currentArea + 1);
        }
        // 如果不足3个，添加下一个未显示的区域
        let nextArea = 2;
        while (areasToShow.length < 3 && nextArea <= maxArea + 1) {
            if (!areasToShow.includes(nextArea)) {
                areasToShow.push(nextArea);
            }
            nextArea++;
        }
        // 排序并只取前3个
        areasToShow.sort((a, b) => a - b);
        while (areasToShow.length > 3) {
            areasToShow.pop();
        }

        areasToShow.forEach((areaNum, i) => {
            const isUnlocked = areaNum <= maxArea;
            const isCurrent = areaNum === currentArea;
            const areaLevels = getLayerAreaLevels(currentLayer, areaNum);
            const unlockedStages = SaveManager.state.unlockedLayerStages[String(currentLayer)] || [];
            const stageScores = SaveManager.state.layerStageScores[String(currentLayer)] || {};

            // 计算该区域的进度 - lvl.id 已经是全局ID
            let areaProgress = 0;
            let totalLevels = areaLevels.length;
            areaLevels.forEach((lvl) => {
                // 检查该关卡是否已解锁（unlockScore为0表示第一关自动解锁）
                const isLevelUnlocked = lvl.unlockScore === 0 || unlockedStages.includes(lvl.id);
                if (isLevelUnlocked) {
                    areaProgress++;
                }
            });

            const x = startX + i * (cardW + gap);
            const card = this.createAreaCard(areaNum, isUnlocked, isCurrent, areaProgress, totalLevels, () => {
                if (!isUnlocked) {
                    FloatingText.show(SceneManager.width / 2, 200, '该区域尚未解锁！', 0xff0000);
                    return;
                }
                SaveManager.state.currentArea[String(currentLayer)] = areaNum;
                SaveManager.save();
                // 进入关卡选择页面
                onSwitchPage('stage');
            });
            card.x = x;
            card.y = startY;
            container.addChild(card);
        });
    }

    /** 创建区域卡片 */
    private static createAreaCard(
        areaNum: number,
        isUnlocked: boolean,
        isCurrent: boolean,
        progress: number,
        total: number,
        onEnter: () => void
    ): PIXI.Container {
        const card = new PIXI.Container();
        const cardW = 320;
        const cardH = 400;
        const borderColor = isCurrent ? 0x00e5ff : (isUnlocked ? 0x4a6fa5 : 0x333333);
        const alpha = isUnlocked ? 1.0 : 0.5;

        // 背景 - 多层矩形模拟渐变
        const bg = new PIXI.Graphics();
        bg.beginFill(0x1a2a3a, 0.95);
        bg.lineStyle(4, borderColor, 1);
        bg.drawRoundedRect(0, 0, cardW, cardH, 16);
        bg.endFill();
        bg.alpha = alpha;
        card.addChild(bg);

        // 渐变层
        const gradientTop = new PIXI.Graphics();
        gradientTop.beginFill(0x0f1a25, 0.4);
        gradientTop.drawRoundedRect(0, 0, cardW, cardH / 2, 16);
        gradientTop.endFill();
        card.addChild(gradientTop);

        const gradientBottom = new PIXI.Graphics();
        gradientBottom.beginFill(0x050810, 0.6);
        gradientBottom.drawRoundedRect(0, cardH / 2, cardW, cardH / 2, 0);
        gradientBottom.endFill();
        card.addChild(gradientBottom);

        // 添加内阴影效果
        const innerShadow = new PIXI.Graphics();
        innerShadow.lineStyle(2, 0x000000, 0.5);
        innerShadow.drawRoundedRect(4, 4, cardW - 8, cardH - 8, 12);
        innerShadow.endFill();
        card.addChild(innerShadow);

        // 添加发光效果（当前选中时）
        if (isCurrent) {
            const glow = new PIXI.Graphics();
            glow.lineStyle(6, 0x00e5ff, 0.3);
            glow.drawRoundedRect(-3, -3, cardW + 6, cardH + 6, 18);
            glow.endFill();
            card.addChildAt(glow, 0);
        }

        // 当前标记
        if (isCurrent) {
            const currentBadge = new PIXI.Graphics()
                .beginFill(0x00e5ff, 0.3)
                .drawRoundedRect(0, 0, cardW, 60, 16)
                .endFill();
            card.addChild(currentBadge);
            const currentTxt = new PIXI.Text('当前区域', {
                fontSize: 18, fill: 0x00e5ff, fontWeight: 'bold',
            });
            currentTxt.anchor.set(0.5); currentTxt.x = cardW / 2; currentTxt.y = 32;
            card.addChild(currentTxt);
        }

        // 区域名称
        const areaName = getAreaName(areaNum);
        const nameTxt = new PIXI.Text(areaName, {
            fontSize: 28, fill: isUnlocked ? 0xffffff : 0x555555, fontWeight: 'bold',
        });
        nameTxt.anchor.set(0.5); nameTxt.x = cardW / 2; nameTxt.y = isCurrent ? 100 : 70;
        card.addChild(nameTxt);

        // 难度倍率
        const diffMult = 1 + (areaNum - 1) * 0.5;
        const diffTxt = new PIXI.Text(`难度 ×${diffMult.toFixed(1)}`, {
            fontSize: 16, fill: isUnlocked ? 0xffaa00 : 0x555555, fontWeight: 'bold',
        });
        diffTxt.anchor.set(0.5); diffTxt.x = cardW / 2; diffTxt.y = isCurrent ? 135 : 105;
        card.addChild(diffTxt);

        // 分割线
        const line = new PIXI.Graphics()
            .lineStyle(2, isUnlocked ? 0x1a2a3a : 0x222222)
            .moveTo(20, isCurrent ? 170 : 140).lineTo(cardW - 20, isCurrent ? 170 : 140);
        card.addChild(line);

        // 进度信息
        const progressTxt = new PIXI.Text(`进度: ${progress}/${total}`, {
            fontSize: 18, fill: isUnlocked ? 0x00ff88 : 0x555555, fontWeight: 'bold',
        });
        progressTxt.anchor.set(0.5); progressTxt.x = cardW / 2; progressTxt.y = isCurrent ? 200 : 170;
        card.addChild(progressTxt);

        // 进度条
        const barY = isCurrent ? 230 : 200;
        const barW = cardW - 60;
        const barBg = new PIXI.Graphics()
            .beginFill(0x222222)
            .drawRoundedRect(30, barY, barW, 20, 8)
            .endFill();
        const barFill = new PIXI.Graphics()
            .beginFill(isUnlocked ? 0x00e5ff : 0x333333)
            .drawRoundedRect(30, barY, barW * (progress / total), 20, 8)
            .endFill();
        card.addChild(barBg, barFill);

        // 锁定标记
        if (!isUnlocked) {
            const lockOverlay = new PIXI.Graphics()
                .beginFill(0x000000, 0.6)
                .drawRoundedRect(0, 0, cardW, cardH, 16)
                .endFill();
            card.addChild(lockOverlay);
            const lockIcon = new PIXI.Text('🔒', { fontSize: 64 });
            lockIcon.anchor.set(0.5); lockIcon.x = cardW / 2; lockIcon.y = cardH / 2;
            card.addChild(lockIcon);
            const lockTxt = new PIXI.Text('需通关上一区域解锁', {
                fontSize: 16, fill: 0xaaaaaa, fontWeight: 'bold',
            });
            lockTxt.anchor.set(0.5); lockTxt.x = cardW / 2; lockTxt.y = cardH / 2 + 50;
            card.addChild(lockTxt);
        }

        // 进入按钮
        if (isUnlocked) {
            const btnY = cardH - 80;
            const btnBg = new PIXI.Graphics()
                .beginFill(isCurrent ? 0x006688 : 0x003344, 1)
                .lineStyle(2, isCurrent ? 0x00e5ff : 0x0088ff, 1)
                .drawRoundedRect(40, btnY, cardW - 80, 50, 12)
                .endFill();
            const btnTxt = new PIXI.Text(isCurrent ? '进入关卡' : '前往该区域', {
                fontSize: 18, fill: 0xffffff, fontWeight: 'bold',
            });
            btnTxt.anchor.set(0.5); btnTxt.x = cardW / 2; btnTxt.y = btnY + 27;
            card.addChild(btnBg, btnTxt);
            card.eventMode = 'static'; card.cursor = 'pointer';
            card.on('pointerover', () => { bg.tint = 0x223344; card.scale.set(1.02); });
            card.on('pointerout', () => { bg.tint = 0xffffff; card.scale.set(1); });
            card.on('pointerdown', onEnter);
        }

        return card;
    }

    /** 绘制层选择器 */
    private static drawLayerSelector(
        container: PIXI.Container,
        currentLayer: number,
        onLayerChange: (layer: number) => void
    ): void {
        const W = SceneManager.width;
        const selectorY = 100;
        const btnW = 180;
        const btnH = 50;
        const gap = 20;

        const layerScores = SaveManager.state.layerStageScores;

        LAYER_CONFIGS.forEach((config, i) => {
            const isUnlocked = isLayerUnlocked(config.layer, layerScores);
            const isActive = currentLayer === config.layer;
            const x = (W - (LAYER_CONFIGS.length * btnW + (LAYER_CONFIGS.length - 1) * gap)) / 2 + i * (btnW + gap);

            const btn = new PIXI.Container();
            btn.x = x;
            btn.y = selectorY;

            // 背景
            const bg = new PIXI.Graphics();
            const color = isUnlocked ? config.borderColor : 0x333333;
            bg.lineStyle(3, color, 1);
            bg.beginFill(isActive ? color : 0x0a0f1a, isActive ? 0.3 : 0.9);
            bg.drawRoundedRect(0, 0, btnW, btnH, 8);
            bg.endFill();
            btn.addChild(bg);

            // 文字
            const nameTxt = new PIXI.Text(config.name, {
                fontSize: 16, fill: isUnlocked ? 0xffffff : 0x666666, fontWeight: 'bold',
            });
            nameTxt.anchor.set(0.5); nameTxt.x = btnW / 2; nameTxt.y = btnH / 2 - 8;
            btn.addChild(nameTxt);

            const diffTxt = new PIXI.Text(`难度×${config.difficultyMult.toFixed(1)}`, {
                fontSize: 11, fill: isUnlocked ? 0xaaaaaa : 0x444444,
            });
            diffTxt.anchor.set(0.5); diffTxt.x = btnW / 2; diffTxt.y = btnH / 2 + 10;
            btn.addChild(diffTxt);

            if (isUnlocked) {
                btn.eventMode = 'static';
                btn.cursor = isActive ? 'default' : 'pointer';
                if (!isActive) {
                    btn.on('pointerover', () => { bg.tint = 0x333333; });
                    btn.on('pointerout', () => { bg.tint = 0xffffff; });
                    btn.on('pointerdown', () => { onLayerChange(config.layer); });
                }
            } else {
                // 锁定图标
                const lock = new PIXI.Text('', { fontSize: 20 });
                lock.anchor.set(0.5); lock.x = btnW - 20; lock.y = 20;
                btn.addChild(lock);
            }

            container.addChild(btn);
        });

        // 当前层标题
        const config = LAYER_CONFIGS.find(c => c.layer === currentLayer);
        if (config) {
            const title = new PIXI.Text(`${config.name} - ${config.subtitle}`, {
                fontSize: 18, fill: config.borderColor, fontWeight: 'bold',
            });
            title.anchor.set(0.5); title.x = W / 2; title.y = selectorY - 30;
            container.addChild(title);
        }
    }

    /** 绘制区域选择器 */
    private static drawAreaSelector(
        container: PIXI.Container,
        currentLayer: number,
        currentArea: number,
        onAreaChange: (area: number) => void
    ): void {
        const W = SceneManager.width;
        const selectorY = 160;
        const btnW = 120;
        const btnH = 36;
        const gap = 10;

        const layerKey = String(currentLayer);
        const unlockedAreas = SaveManager.state.unlockedLayerAreas[layerKey] || [1];
        const maxVisibleArea = Math.max(...unlockedAreas, 1);

        // 显示当前区域及前后各2个区域（共5个）
        const startArea = Math.max(1, currentArea - 2);
        const endArea = Math.min(maxVisibleArea + 1, startArea + 4);
        const visibleAreas = [];
        for (let a = startArea; a <= endArea; a++) {
            visibleAreas.push(a);
        }

        const totalWidth = visibleAreas.length * btnW + (visibleAreas.length - 1) * gap;
        const startX = (W - totalWidth) / 2;

        visibleAreas.forEach((areaNum, i) => {
            const isUnlocked = unlockedAreas.includes(areaNum);
            const isActive = currentArea === areaNum;
            const x = startX + i * (btnW + gap);

            const btn = new PIXI.Container();
            btn.x = x;
            btn.y = selectorY;

            const bg = new PIXI.Graphics();
            const color = isActive ? 0x00e5ff : (isUnlocked ? 0x666666 : 0x333333);
            bg.lineStyle(2, color, 1);
            bg.beginFill(isActive ? color : 0x0a0f1a, isActive ? 0.3 : 0.9);
            bg.drawRoundedRect(0, 0, btnW, btnH, 6);
            bg.endFill();
            btn.addChild(bg);

            const nameTxt = new PIXI.Text(getAreaName(areaNum), {
                fontSize: 13, fill: isUnlocked ? 0xffffff : 0x666666, fontWeight: 'bold',
            });
            nameTxt.anchor.set(0.5); nameTxt.x = btnW / 2; nameTxt.y = btnH / 2;
            btn.addChild(nameTxt);

            if (isUnlocked) {
                btn.eventMode = 'static';
                btn.cursor = isActive ? 'default' : 'pointer';
                if (!isActive) {
                    btn.on('pointerover', () => { bg.tint = 0x333333; });
                    btn.on('pointerout', () => { bg.tint = 0xffffff; });
                    btn.on('pointerdown', () => { onAreaChange(areaNum); });
                }
            }

            container.addChild(btn);
        });

        // 区域标题
        const areaTitle = new PIXI.Text(`当前区域: ${getAreaName(currentArea)} (难度×${(1 + (currentArea - 1) * 0.5).toFixed(1)})`, {
            fontSize: 14, fill: 0xaaaaaa,
        });
        areaTitle.anchor.set(0.5); areaTitle.x = W / 2; areaTitle.y = selectorY - 25;
        container.addChild(areaTitle);
    }

    private static createBossCard(
        lvl: (typeof LEVELS)[number],
        isUnlocked: boolean,
        bestScore: number,
        unlockProgress: number,
        onEnter: () => void
    ): PIXI.Container {
        const card = new PIXI.Container();
        const cardW = 210;
        const cardH = 300;
        const borderColor = isUnlocked ? lvl.borderColor : 0x333333;
        const alpha = isUnlocked ? 1.0 : 0.5;

        // 背景
        const bg = new PIXI.Graphics()
            .beginFill(0x0a0f1a, 0.92)
            .lineStyle(2, borderColor, 1)
            .drawRoundedRect(0, 0, cardW, cardH, 12)
            .endFill();
        bg.alpha = alpha;
        card.addChild(bg);

        // Boss头像区域
        const avatarBg = new PIXI.Graphics()
            .beginFill(0x111822, 1)
            .drawRoundedRect(8, 8, cardW - 16, 120, 8)
            .endFill();
        avatarBg.alpha = alpha;
        card.addChild(avatarBg);

        // Boss贴图
        const avatarTex = AssetManager.textures[lvl.bossAvatar];
        if (avatarTex) {
            const avatar = new PIXI.Sprite(avatarTex);
            avatar.width = cardW - 24;
            avatar.height = 112;
            avatar.x = 12; avatar.y = 12;
            const maskGfx = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(12, 12, cardW - 24, 112, 6).endFill();
            avatar.mask = maskGfx;
            card.addChild(avatar, maskGfx);
        }

        // 关卡编号徽章
        const numBadge = new PIXI.Graphics()
            .beginFill(lvl.borderColor, isUnlocked ? 0.4 : 0.15)
            .drawRoundedRect(8, 8, 40, 32, 6)
            .endFill();
        card.addChild(numBadge);
        const numTxt = new PIXI.Text(`${lvl.id}`, {
            fontSize: 20, fill: isUnlocked ? 0xffffff : 0x555555, fontWeight: 'bold',
        });
        numTxt.anchor.set(0.5); numTxt.x = 28; numTxt.y = 24;
        card.addChild(numTxt);

        // 锁定标记
        if (!isUnlocked) {
            const lockOverlay = new PIXI.Graphics()
                .beginFill(0x000000, 0.5)
                .drawRoundedRect(8, 8, cardW - 16, 120, 8)
                .endFill();
            card.addChild(lockOverlay);
            const lockIcon = new PIXI.Text('🔒', { fontSize: 32 });
            lockIcon.anchor.set(0.5); lockIcon.x = cardW / 2; lockIcon.y = 68;
            card.addChild(lockIcon);
        }

        // Boss名称
        const bossName = new PIXI.Text(lvl.bossName, {
            fontSize: 16, fill: isUnlocked ? 0xffdd00 : 0x555555, fontWeight: 'bold',
            wordWrap: true, wordWrapWidth: cardW - 20,
        });
        bossName.x = 10; bossName.y = 136;
        card.addChild(bossName);

        // 副标题
        const subTxt = new PIXI.Text(lvl.subtitle, {
            fontSize: 10, fill: isUnlocked ? 0x7a8a9a : 0x444444,
            wordWrap: true, wordWrapWidth: cardW - 20,
        });
        subTxt.x = 10; subTxt.y = 158;
        card.addChild(subTxt);

        // 分割线
        const line = new PIXI.Graphics()
            .lineStyle(1, isUnlocked ? 0x1a2a3a : 0x222222)
            .moveTo(10, 180).lineTo(cardW - 10, 180);
        card.addChild(line);

        // 难度信息
        const diffTxt = new PIXI.Text(
            `HP ×${lvl.hpMult}  密度 ×${lvl.spawnRate}  奖励 ×${lvl.reward}`,
            { fontSize: 10, fill: isUnlocked ? 0x99aacc : 0x444444 },
        );
        diffTxt.x = 10; diffTxt.y = 186;
        card.addChild(diffTxt);

        // 最高分
        if (bestScore > 0) {
            const scoreTxt = new PIXI.Text(`最高分: ${FloatingText.formatNumber(bestScore)}`, {
                fontSize: 12, fill: 0x00ff88, fontWeight: 'bold',
            });
            scoreTxt.x = 10; scoreTxt.y = 206;
            card.addChild(scoreTxt);
        }

        // 下一关解锁进度条
        if (unlockProgress < 1 && isUnlocked) {
            const nextLvl = LEVELS.find(l => l.id === lvl.id + 1);
            const barY = 226;
            const barW = cardW - 20;
            // 进度条背景
            const barBg = new PIXI.Graphics()
                .beginFill(0x222222)
                .drawRoundedRect(10, barY, barW, 10, 4)
                .endFill();
            // 进度条填充
            const barFill = new PIXI.Graphics()
                .beginFill(lvl.borderColor)
                .drawRoundedRect(10, barY, barW * unlockProgress, 10, 4)
                .endFill();
            card.addChild(barBg, barFill);
            const progTxt = new PIXI.Text(`下关: ${Math.floor(unlockProgress * 100)}%`, {
                fontSize: 9, fill: 0xaaaaaa,
            });
            progTxt.x = 10; progTxt.y = barY + 12;
            card.addChild(progTxt);
        } else if (unlockProgress >= 1 && lvl.id < LEVELS.length) {
            const unlockedTxt = new PIXI.Text('✓ 已解锁下关', {
                fontSize: 10, fill: 0x00ff88,
            });
            unlockedTxt.x = 10; unlockedTxt.y = 226;
            card.addChild(unlockedTxt);
        }

        // 进入按钮
        if (isUnlocked) {
            const btnBg = new PIXI.Graphics()
                .beginFill(0x003377, 1)
                .lineStyle(2, 0x0088ff, 1)
                .drawRoundedRect(10, cardH - 48, cardW - 20, 38, 8)
                .endFill();
            const btnTxt = new PIXI.Text(bestScore > 0 ? '再次挑战' : '开始挑战', {
                fontSize: 16, fill: 0xffffff, fontWeight: 'bold',
            });
            btnTxt.anchor.set(0.5); btnTxt.x = cardW / 2; btnTxt.y = cardH - 29;
            card.addChild(btnBg, btnTxt);
            card.eventMode = 'static'; card.cursor = 'pointer';
            card.on('pointerover', () => { bg.tint = 0x223344; card.scale.set(1.03); });
            card.on('pointerout', () => { bg.tint = 0xffffff; card.scale.set(1); });
            card.on('pointerdown', onEnter);
        } else {
            // 解锁条件提示
            const prevLvl = LEVELS.find(l => l.id === lvl.id - 1);
            const needed = prevLvl ? FloatingText.formatNumber(lvl.unlockScore) : '';
            const lockTxt = new PIXI.Text(prevLvl ? `需${needed}分解锁` : '完成上关解锁', {
                fontSize: 11, fill: 0x555555,
            });
            lockTxt.anchor.set(0.5); lockTxt.x = cardW / 2; lockTxt.y = cardH - 29;
            card.addChild(lockTxt);
        }

        return card;
    }

    private static drawSideHUD(nav: PIXI.Container, onSwitchPage: (id: string) => void): void {
        const tabs = [
            { id: 'weaponry', name: 'ARSENAL', icon: 'cannon_v3', desc: '武器库档案馆' },
            { id: 'research', name: 'CORE TECH', icon: 'skin_lightning', desc: '升级研究中心' },
            { id: 'skilltree', name: 'SKILL TREE', icon: 'bullet_v2', desc: '武器技能树' },
            { id: 'mall', name: 'HERO MALL', icon: 'skin_railgun', desc: '英雄武器商店' },
            { id: 'endless', name: '∞ ENDLESS', icon: 'cannon_v3', desc: '无尽模式挑战' },
        ];

        const W = SceneManager.width;
        nav.x = W - 310; nav.y = 120;

        tabs.forEach((tab, i) => {
            const tabBtn = new PIXI.Container();
            tabBtn.y = i * 110;

            const bg = new PIXI.Graphics();
            const bw = 260; const bh = 90; const slant = 25;
            // 渐变背景
            bg.beginFill(0x050e1a, 0.85);
            bg.lineStyle(3, 0x3a4a5e, 1);
            bg.drawPolygon([slant, 0, bw, 0, bw - slant, bh, 0, bh]);
            bg.endFill();

            // 顶部高光
            const highlight = new PIXI.Graphics();
            highlight.beginFill(0x1a2a3a, 0.4);
            highlight.drawPolygon([slant, 0, bw, 0, bw - slant, 30, slant, 30]);
            highlight.endFill();
            tabBtn.addChild(highlight);

            // 内阴影
            const innerShadow = new PIXI.Graphics();
            innerShadow.lineStyle(1, 0x000000, 0.5);
            innerShadow.drawPolygon([slant + 2, 2, bw - 2, 2, bw - slant - 2, bh - 2, 2, bh - 2]);
            innerShadow.endFill();
            tabBtn.addChild(innerShadow);

            const iconTex = AssetManager.textures[tab.icon];
            if (iconTex) {
                const icon = new PIXI.Sprite(iconTex);
                icon.width = 70; icon.height = 70; icon.x = slant + 10; icon.y = 10;
                tabBtn.addChild(icon);
            }

            const txt = new PIXI.Text(tab.name, { fontSize: 20, fill: 0x00f0ff, fontWeight: 'bold' });
            txt.x = slant + 95; txt.y = 18;
            const desc = new PIXI.Text(tab.desc, { fontSize: 12, fill: 0x888888 });
            desc.x = slant + 95; desc.y = 46;

            tabBtn.addChild(bg, txt, desc);
            tabBtn.eventMode = 'static'; tabBtn.cursor = 'pointer';
            tabBtn.on('pointerover', () => {
                bg.tint = 0x1a3a5a;
                highlight.tint = 0x2a4a6a;
                tabBtn.scale.set(1.03);
            });
            tabBtn.on('pointerout', () => {
                bg.tint = 0xffffff;
                highlight.tint = 0xffffff;
                tabBtn.scale.set(1);
            });
            tabBtn.on('pointerdown', () => onSwitchPage(tab.id));
            nav.addChild(tabBtn);
        });
    }
}
