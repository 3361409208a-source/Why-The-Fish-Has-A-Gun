import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { SaveManager } from '../../SaveManager';
import { LEVELS, getLayerLevels, getLayerAreaLevels, LAYER_CONFIGS, getLayerName, isLayerUnlocked, getAreaName, LEVELS_PER_AREA } from '../../config/levels.config';
import { AssetManager } from '../../AssetManager';
import { FloatingText } from '../overlays/FloatingText';

/** 关卡选择页：每关一个Boss，分数解锁 */
export class StagePage {
    public static draw(
        container: PIXI.Container,
        onLevelSelected: (levelId: number, config: any) => void
    ): void {
        const W = SceneManager.width;
        const currentLayer = SaveManager.state.currentLayer || 1;
        const layerKey = String(currentLayer);
        const currentArea = SaveManager.state.currentArea[layerKey] || 1;
        const areaLevels = getLayerAreaLevels(currentLayer, currentArea);

        // 返回按钮
        const backBtn = new PIXI.Container();
        const backBg = new PIXI.Graphics()
            .beginFill(0x003344, 1)
            .lineStyle(2, 0x0088ff, 1)
            .drawRoundedRect(0, 0, 120, 40, 8)
            .endFill();
        const backTxt = new PIXI.Text('← 返回大厅', {
            fontSize: 16, fill: 0xffffff, fontWeight: 'bold',
        });
        backTxt.anchor.set(0.5); backTxt.x = 60; backTxt.y = 22;
        backBtn.addChild(backBg, backTxt);
        backBtn.x = 40; backBtn.y = 30;
        backBtn.eventMode = 'static'; backBtn.cursor = 'pointer';
        backBtn.on('pointerover', () => { backBg.tint = 0x006688; });
        backBtn.on('pointerout', () => { backBg.tint = 0xffffff; });
        backBtn.on('pointerdown', () => {
            container.removeChildren();
            // 返回大厅逻辑由UIManager处理
            import('../../UIManager').then(({ UIManager }) => {
                UIManager.showMapSelection(() => {});
            });
        });
        container.addChild(backBtn);

        const pageTitle = new PIXI.Text(`${getLayerName(currentLayer)} · ${getAreaName(currentArea)}`, {
            fontSize: 32, fill: 0xff6600, fontWeight: 'bold', letterSpacing: 3,
        });
        pageTitle.anchor.set(0.5); pageTitle.x = W / 2; pageTitle.y = 100;
        container.addChild(pageTitle);

        const sub = new PIXI.Text(`难度×${(1 + (currentArea - 1) * 0.5).toFixed(1)} · 每关对应一个Boss · 击杀Boss累积分数`, {
            fontSize: 15, fill: 0x888888,
        });
        sub.anchor.set(0.5); sub.x = W / 2; sub.y = 140;
        container.addChild(sub);

        // 5列2行网格
        const cols = 5;
        const cardW = 220;
        const cardH = 320;
        const gapX = 30;
        const gapY = 20;
        const gridW = cols * cardW + (cols - 1) * gapX;
        const startX = (W - gridW) / 2;
        const startY = 180;

        const unlockedStages = SaveManager.state.unlockedLayerStages[layerKey] || [1];
        const stageScores = SaveManager.state.layerStageScores[layerKey] || {};

        areaLevels.forEach((lvl, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);

            // lvl.id 已从 getLayerAreaLevels 返回为全局唯一ID，直接使用
            const globalLevelId = lvl.id;
            // 第一关（unlockScore为0）或已在解锁列表中的关卡视为已解锁
            const isUnlocked = lvl.unlockScore === 0 || unlockedStages.includes(globalLevelId);
            const bestScore = stageScores[String(globalLevelId)] || 0;

            const card = this.createLevelCard(lvl, isUnlocked, bestScore, () => {
                if (!isUnlocked) {
                    FloatingText.show(W / 2, 200, '该关卡尚未解锁！', 0xff0000);
                    return;
                }
                onLevelSelected(globalLevelId, {
                    hpMult: lvl.hpMult,
                    spawnRate: lvl.spawnRate,
                    reward: lvl.reward,
                    layer: currentLayer,
                    area: currentArea,
                });
            });
            card.x = x; card.y = y;
            container.addChild(card);
        });
    }

    private static createLevelCard(
        lvl: (typeof LEVELS)[number],
        isUnlocked: boolean,
        bestScore: number,
        onEnter: () => void
    ): PIXI.Container {
        const card = new PIXI.Container();
        const borderColor = isUnlocked ? lvl.borderColor : 0x333333;
        const alpha = isUnlocked ? 1.0 : 0.45;

        // 背景 - 渐变效果
        const bg = new PIXI.Graphics();
        bg.beginFill(0x0a0f1a, isUnlocked ? 0.98 : 0.85);
        bg.lineStyle(4, borderColor, 1);
        bg.drawRoundedRect(0, 0, 220, 320, 12);
        bg.endFill();
        card.addChild(bg);

        // 渐变层
        const gradientTop = new PIXI.Graphics();
        gradientTop.beginFill(0x1a2a3a, 0.3);
        gradientTop.drawRoundedRect(0, 0, 220, 160, 12);
        gradientTop.endFill();
        card.addChild(gradientTop);

        // 内阴影
        const innerShadow = new PIXI.Graphics();
        innerShadow.lineStyle(2, 0x000000, 0.4);
        innerShadow.drawRoundedRect(3, 3, 214, 314, 10);
        innerShadow.endFill();
        card.addChild(innerShadow);

        // 发光效果（已解锁时）
        if (isUnlocked) {
            const glow = new PIXI.Graphics();
            glow.lineStyle(3, borderColor, 0.2);
            glow.drawRoundedRect(-2, -2, 224, 324, 14);
            glow.endFill();
            card.addChildAt(glow, 0);
        }

        // Boss头像
        const avatarTex = AssetManager.textures[lvl.bossAvatar];
        if (avatarTex) {
            const avatar = new PIXI.Sprite(avatarTex);
            avatar.width = 200; avatar.height = 100; avatar.x = 10; avatar.y = 10;
            const maskGfx = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(10, 10, 200, 100, 8).endFill();
            avatar.mask = maskGfx;
            card.addChild(avatar, maskGfx);
        }

        // Level number badge
        const numBadge = new PIXI.Graphics()
            .beginFill(borderColor, isUnlocked ? 0.3 : 0.15)
            .drawRoundedRect(8, 8, 48, 48, 8)
            .endFill();
        card.addChild(numBadge);

        // 关卡编号 - 增大字体，添加描边效果
        const numTxt = new PIXI.Text(`${lvl.id}`, {
            fontSize: 32, fill: isUnlocked ? 0xffffff : 0x888888, fontWeight: 'bold',
            stroke: isUnlocked ? 0x000000 : 0x333333, strokeThickness: 3,
        });
        numTxt.anchor.set(0.5); numTxt.x = 32; numTxt.y = 32;
        card.addChild(numTxt);

        // 锁定/分数状态 - 提高对比度
        if (!isUnlocked) {
            const lockedBadge = new PIXI.Text('🔒 锁定', { fontSize: 14, fill: 0xff4444, fontWeight: 'bold', stroke: 0x000000, strokeThickness: 2 });
            lockedBadge.anchor.set(1, 0); lockedBadge.x = 212; lockedBadge.y = 12;
            card.addChild(lockedBadge);
        } else if (bestScore > 0) {
            const scoreBadge = new PIXI.Text(`✓ ${FloatingText.formatNumber(bestScore)}分`, { fontSize: 14, fill: 0x00ff88, fontWeight: 'bold', stroke: 0x003300, strokeThickness: 2 });
            scoreBadge.anchor.set(1, 0); scoreBadge.x = 212; scoreBadge.y = 12;
            card.addChild(scoreBadge);
        }

        // Boss名称 - 增大字体，添加描边
        const nameTxt = new PIXI.Text(lvl.bossName, {
            fontSize: 18, fill: isUnlocked ? 0xffdd00 : 0x999999, fontWeight: 'bold',
            wordWrap: true, wordWrapWidth: 200,
            stroke: 0x000000, strokeThickness: 3,
        });
        nameTxt.x = 10; nameTxt.y = 118;
        card.addChild(nameTxt);

        // 副标题 - 提高对比度
        const subTxt = new PIXI.Text(lvl.subtitle, {
            fontSize: 12, fill: isUnlocked ? 0xaaccdd : 0x666666,
            wordWrap: true, wordWrapWidth: 200,
            stroke: 0x000000, strokeThickness: 2,
        });
        subTxt.x = 10; subTxt.y = 144;
        card.addChild(subTxt);

        // 分割线
        const line = new PIXI.Graphics()
            .lineStyle(1, isUnlocked ? 0x1a2a3a : 0x222222)
            .moveTo(10, 168).lineTo(210, 168);
        card.addChild(line);

        // 难度数值 - 提高对比度
        const diffTxt = new PIXI.Text(
            `HP ×${lvl.hpMult}  密度 ×${lvl.spawnRate}  奖励 ×${lvl.reward}`,
            { fontSize: 13, fill: isUnlocked ? 0xcceeff : 0x555555, fontWeight: 'bold' },
        );
        diffTxt.x = 10; diffTxt.y = 176;
        card.addChild(diffTxt);

        // 解锁进度 - 提高文字清晰度
        if (isUnlocked && lvl.id < LEVELS.length) {
            const nextLvl = LEVELS.find(l => l.id === lvl.id + 1);
            if (nextLvl) {
                const prog = Math.min(1, bestScore / nextLvl.unlockScore);
                const barY = 200;
                const barBg = new PIXI.Graphics().beginFill(0x333333).drawRoundedRect(10, barY, 200, 10, 5).endFill();
                const barFill = new PIXI.Graphics().beginFill(lvl.borderColor).drawRoundedRect(10, barY, 200 * prog, 10, 5).endFill();
                card.addChild(barBg, barFill);
                const progTxt = new PIXI.Text(`下关解锁: ${Math.floor(prog * 100)}% (${FloatingText.formatNumber(bestScore)}/${FloatingText.formatNumber(nextLvl.unlockScore)})`, {
                    fontSize: 11, fill: 0xcccccc, fontWeight: 'bold',
                });
                progTxt.x = 10; progTxt.y = barY + 14;
                card.addChild(progTxt);
            }
        }

        // 进入按钮
        if (isUnlocked) {
            const btnColor = bestScore > 0 ? 0x005533 : 0x003377;
            const btnBorderColor = bestScore > 0 ? 0x00ff88 : 0x0088ff;
            // 按钮渐变背景
            const btnBg = new PIXI.Graphics();
            btnBg.beginFill(btnColor, 1);
            btnBg.lineStyle(3, btnBorderColor, 1);
            btnBg.drawRoundedRect(15, 265, 190, 42, 8);
            btnBg.endFill();
            // 按钮高光
            const btnHighlight = new PIXI.Graphics();
            btnHighlight.beginFill(0xffffff, 0.15);
            btnHighlight.drawRoundedRect(17, 267, 186, 20, 6);
            btnHighlight.endFill();
            // 按钮发光
            const btnGlow = new PIXI.Graphics();
            btnGlow.lineStyle(2, btnBorderColor, 0.3);
            btnGlow.drawRoundedRect(13, 263, 194, 46, 10);
            btnGlow.endFill();
            const btnTxt = new PIXI.Text(bestScore > 0 ? '再次挑战' : '开始挑战', {
                fontSize: 18, fill: 0xffffff, fontWeight: 'bold',
                stroke: 0x000000, strokeThickness: 2,
            });
            btnTxt.anchor.set(0.5); btnTxt.x = 110; btnTxt.y = 286;
            card.addChild(btnGlow, btnBg, btnHighlight, btnTxt);
            card.eventMode = 'static'; card.cursor = 'pointer';
            card.on('pointerover', () => {
                bg.tint = 0x1a2a3a;
                btnGlow.alpha = 0.6;
                card.scale.set(1.02);
            });
            card.on('pointerout', () => {
                bg.tint = 0xffffff;
                btnGlow.alpha = 1;
                card.scale.set(1);
            });
            card.on('pointerdown', onEnter);
        } else {
            const lockTxt = new PIXI.Text(`需 ${FloatingText.formatNumber(lvl.unlockScore)} 分解锁`, {
                fontSize: 14, fill: 0xff6666, fontWeight: 'bold', stroke: 0x330000, strokeThickness: 2,
            });
            lockTxt.anchor.set(0.5); lockTxt.x = 110; lockTxt.y = 284;
            card.addChild(lockTxt);
        }

        return card;
    }
}
