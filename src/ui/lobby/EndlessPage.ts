import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { SaveManager } from '../../SaveManager';
import { FloatingText } from '../overlays/FloatingText';
import { getEndlessDifficultyList, getEndlessDifficulty, EndlessDifficulty } from '../../config/endless.config';

/** 无尽模式难度选择页面 */
export class EndlessPage {
    private static scrollOffset: number = 0;
    private static CARD_W = 260;
    private static CARD_H = 340;
    private static COLS = 4;
    private static GAP = 20;

    public static draw(
        container: PIXI.Container,
        onSelect: (config: any) => void
    ): void {
        const W = SceneManager.width;
        const H = SceneManager.height;

        // 标题
        const title = new PIXI.Text('∞  无尽模式', {
            fontSize: 38, fill: 0xff8800, fontWeight: 'bold', letterSpacing: 4,
            stroke: '#000', strokeThickness: 4,
        });
        title.anchor.set(0.5, 0); title.x = W / 2; title.y = 110;
        container.addChild(title);

        const subtitle = new PIXI.Text('选择难度等级，挑战无穷无尽的深海猎场', {
            fontSize: 16, fill: 0xaaaaaa,
        });
        subtitle.anchor.set(0.5, 0); subtitle.x = W / 2; subtitle.y = 162;
        container.addChild(subtitle);

        // 分割线
        const line = new PIXI.Graphics().lineStyle(2, 0xff8800, 0.4)
            .moveTo(40, 190).lineTo(W - 40, 190);
        container.addChild(line);

        // 难度列表（固定显示20个，可纵向滚动）
        this.drawDifficultyGrid(container, W, H, onSelect);
    }

    private static drawDifficultyGrid(
        container: PIXI.Container,
        W: number,
        H: number,
        onSelect: (config: any) => void
    ): void {
        const difficulties = getEndlessDifficultyList(20);
        const endlessScores = SaveManager.state.endlessScores ?? {};

        const totalCols = this.COLS;
        const totalW = totalCols * this.CARD_W + (totalCols - 1) * this.GAP;
        const startX = (W - totalW) / 2;
        const startY = 210;

        // 滚动区域容器
        const scrollContainer = new PIXI.Container();
        scrollContainer.x = 0; scrollContainer.y = 0;
        container.addChild(scrollContainer);

        // 遮罩（限制显示区域）
        const maskGfx = new PIXI.Graphics().beginFill(0xffffff)
            .drawRect(0, startY, W, H - startY - 40).endFill();
        container.addChild(maskGfx);
        scrollContainer.mask = maskGfx;

        // 卡片内容容器（跟随滚动偏移）
        const cardsContainer = new PIXI.Container();
        cardsContainer.y = this.scrollOffset;
        scrollContainer.addChild(cardsContainer);

        difficulties.forEach((diff, idx) => {
            const col = idx % totalCols;
            const row = Math.floor(idx / totalCols);
            const x = startX + col * (this.CARD_W + this.GAP);
            const y = startY + row * (this.CARD_H + this.GAP);

            const bestScore = endlessScores[String(diff.level)] ?? 0;
            const isUnlocked = this.isDifficultyUnlocked(diff, endlessScores);
            const prevBest = diff.level > 1 ? (endlessScores[String(diff.level - 1)] ?? 0) : Infinity;

            const card = this.createDifficultyCard(diff, isUnlocked, bestScore, prevBest, () => {
                if (!isUnlocked) {
                    const needed = FloatingText.formatNumber(diff.unlockScore);
                    FloatingText.show(W / 2, H / 2, `需在上一难度达到 ${needed} 分解锁！`, 0xff4444);
                    return;
                }
                onSelect({
                    id: diff.bgKey,
                    bgKey: diff.bgKey,
                    hpMult: diff.hpMult,
                    spawnRate: diff.spawnRate,
                    reward: diff.reward,
                    stageLevel: 0,
                    isEndless: true,
                    endlessLevel: diff.level,
                    endlessName: diff.name,
                });
            });
            card.x = x; card.y = y;
            cardsContainer.addChild(card);
        });

        // 计算总内容高度
        const rows = Math.ceil(difficulties.length / totalCols);
        const totalContentH = rows * (this.CARD_H + this.GAP) + startY;
        const maxScroll = Math.max(0, totalContentH - H + 60);

        // 滚轮事件
        const onWheel = (e: WheelEvent) => {
            this.scrollOffset = Math.max(-maxScroll, Math.min(0, this.scrollOffset - e.deltaY * 0.6));
            cardsContainer.y = this.scrollOffset;
        };
        window.addEventListener('wheel', onWheel);

        // 触摸滑动
        let touchStartY = 0;
        let touchLastOffset = 0;
        const onTouchStart = (e: TouchEvent) => {
            touchStartY = e.touches[0].clientY;
            touchLastOffset = this.scrollOffset;
        };
        const onTouchMove = (e: TouchEvent) => {
            const dy = e.touches[0].clientY - touchStartY;
            this.scrollOffset = Math.max(-maxScroll, Math.min(0, touchLastOffset + dy));
            cardsContainer.y = this.scrollOffset;
        };
        window.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('touchmove', onTouchMove, { passive: true });

        // 页面销毁时清理事件（容器被移除时触发）
        container.on('removed', () => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('touchmove', onTouchMove);
        });

        // 滚动提示
        if (maxScroll > 0) {
            const hint = new PIXI.Text('▼ 滚动查看更多难度', {
                fontSize: 13, fill: 0x666666,
            });
            hint.anchor.set(0.5); hint.x = W / 2; hint.y = H - 28;
            container.addChild(hint);
        }
    }

    private static isDifficultyUnlocked(
        diff: EndlessDifficulty,
        endlessScores: Record<string, number>
    ): boolean {
        if (diff.level <= 3) return true;
        const prevScore = endlessScores[String(diff.level - 1)] ?? 0;
        return prevScore >= diff.unlockScore;
    }

    private static createDifficultyCard(
        diff: EndlessDifficulty,
        isUnlocked: boolean,
        bestScore: number,
        prevBest: number,
        onClick: () => void
    ): PIXI.Container {
        const card = new PIXI.Container();
        const W = this.CARD_W;
        const H = this.CARD_H;
        const color = isUnlocked ? diff.borderColor : 0x333333;

        // 背景
        const bg = new PIXI.Graphics();
        bg.beginFill(0x05101a, 0.97);
        bg.lineStyle(3, color, isUnlocked ? 1 : 0.4);
        bg.drawRoundedRect(0, 0, W, H, 14);
        bg.endFill();
        card.addChild(bg);

        // 顶部色带
        const topBar = new PIXI.Graphics();
        topBar.beginFill(color, isUnlocked ? 0.25 : 0.08);
        topBar.drawRoundedRect(0, 0, W, 56, 14);
        topBar.endFill();
        card.addChild(topBar);

        // 难度等级徽章
        const badge = new PIXI.Graphics();
        badge.beginFill(color, isUnlocked ? 0.4 : 0.15);
        badge.drawCircle(32, 28, 22);
        badge.endFill();
        card.addChild(badge);

        const levelTxt = new PIXI.Text(`${diff.level}`, {
            fontSize: diff.level < 10 ? 22 : 18,
            fill: isUnlocked ? 0xffffff : 0x555555,
            fontWeight: 'bold',
        });
        levelTxt.anchor.set(0.5); levelTxt.x = 32; levelTxt.y = 28;
        card.addChild(levelTxt);

        // 难度名称
        const nameTxt = new PIXI.Text(diff.name, {
            fontSize: 18, fill: isUnlocked ? 0xffffff : 0x555555, fontWeight: 'bold',
        });
        nameTxt.anchor.set(0, 0.5); nameTxt.x = 64; nameTxt.y = 28;
        card.addChild(nameTxt);

        // 描述
        const descTxt = new PIXI.Text(diff.desc, {
            fontSize: 12, fill: isUnlocked ? 0x8899aa : 0x444444,
            wordWrap: true, wordWrapWidth: W - 20,
        });
        descTxt.x = 10; descTxt.y = 66;
        card.addChild(descTxt);

        // 分割线
        const divider = new PIXI.Graphics().lineStyle(1, color, 0.3)
            .moveTo(10, 100).lineTo(W - 10, 100);
        card.addChild(divider);

        // 属性区
        const attrs: Array<{ label: string; value: string; col: number }> = [
            { label: '生命', value: `×${diff.hpMult}`, col: 0 },
            { label: '密度', value: `×${diff.spawnRate}`, col: 1 },
            { label: '奖励', value: `×${diff.reward}`, col: 2 },
        ];

        attrs.forEach(attr => {
            const ax = 14 + attr.col * 80;
            const ay = 110;
            const attrLabel = new PIXI.Text(attr.label, {
                fontSize: 11, fill: isUnlocked ? 0x6688aa : 0x444444,
            });
            attrLabel.x = ax; attrLabel.y = ay;
            card.addChild(attrLabel);

            const attrVal = new PIXI.Text(attr.value, {
                fontSize: 15, fill: isUnlocked ? color : 0x444444, fontWeight: 'bold',
            });
            attrVal.x = ax; attrVal.y = ay + 16;
            card.addChild(attrVal);
        });

        // 最高分
        const scoreY = 160;
        const scoreLbl = new PIXI.Text('最高分', { fontSize: 11, fill: 0x556677 });
        scoreLbl.x = 14; scoreLbl.y = scoreY;
        card.addChild(scoreLbl);

        const scoreVal = new PIXI.Text(bestScore > 0 ? FloatingText.formatNumber(bestScore) : '未挑战', {
            fontSize: 16, fill: bestScore > 0 ? 0x00ff88 : 0x445566, fontWeight: 'bold',
        });
        scoreVal.x = 14; scoreVal.y = scoreY + 16;
        card.addChild(scoreVal);

        // 锁定状态
        if (!isUnlocked) {
            const lockOverlay = new PIXI.Graphics()
                .beginFill(0x000000, 0.65)
                .drawRoundedRect(0, 0, W, H, 14)
                .endFill();
            card.addChild(lockOverlay);

            const lockIcon = new PIXI.Text('🔒', { fontSize: 36 });
            lockIcon.anchor.set(0.5); lockIcon.x = W / 2; lockIcon.y = H / 2 - 20;
            card.addChild(lockIcon);

            const needed = FloatingText.formatNumber(diff.unlockScore);
            const prevActual = typeof prevBest === 'number' && isFinite(prevBest) ? prevBest : 0;
            const progress = diff.unlockScore > 0 ? Math.min(prevActual / diff.unlockScore, 1) : 0;

            const lockInfo = new PIXI.Text(`上一难度需 ${needed} 分`, {
                fontSize: 12, fill: 0x888888, align: 'center',
            });
            lockInfo.anchor.set(0.5); lockInfo.x = W / 2; lockInfo.y = H / 2 + 20;
            card.addChild(lockInfo);

            // 解锁进度条
            const barW = W - 40;
            const barBg = new PIXI.Graphics().beginFill(0x222222)
                .drawRoundedRect(20, H / 2 + 40, barW, 10, 4).endFill();
            const barFill = new PIXI.Graphics().beginFill(0xff8800)
                .drawRoundedRect(20, H / 2 + 40, barW * progress, 10, 4).endFill();
            card.addChild(barBg, barFill);

            const progTxt = new PIXI.Text(`${Math.floor(progress * 100)}%`, {
                fontSize: 11, fill: 0xaaaaaa,
            });
            progTxt.anchor.set(0.5); progTxt.x = W / 2; progTxt.y = H / 2 + 56;
            card.addChild(progTxt);
        } else {
            // 进入按钮
            const btnY = H - 58;
            const btnBg = new PIXI.Graphics();
            btnBg.beginFill(0x001a2a, 1);
            btnBg.lineStyle(2, color, 1);
            btnBg.drawRoundedRect(14, btnY, W - 28, 44, 10);
            btnBg.endFill();
            const btnTxt = new PIXI.Text('开始挑战 ▶', {
                fontSize: 16, fill: color, fontWeight: 'bold',
            });
            btnTxt.anchor.set(0.5); btnTxt.x = W / 2; btnTxt.y = btnY + 22;
            card.addChild(btnBg, btnTxt);

            card.eventMode = 'static'; card.cursor = 'pointer';
            card.on('pointerover', () => {
                bg.tint = 0x182838;
                card.scale.set(1.03);
            });
            card.on('pointerout', () => {
                bg.tint = 0xffffff;
                card.scale.set(1);
            });
            card.on('pointerdown', onClick);
        }

        return card;
    }
}
