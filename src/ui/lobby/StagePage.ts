import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { SaveManager } from '../../SaveManager';
import { LEVELS } from '../../config/levels.config';

/** 关卡选择页：10关累积Boss挑战 */
export class StagePage {
    public static draw(
        container: PIXI.Container,
        onLevelSelected: (levelId: number, config: any) => void
    ): void {
        const W = SceneManager.width;
        const cleared = SaveManager.state.clearedStages;

        const pageTitle = new PIXI.Text('关卡挑战模式', {
            fontSize: 32, fill: 0xff6600, fontWeight: 'bold', letterSpacing: 3,
        });
        pageTitle.anchor.set(0.5); pageTitle.x = W / 2; pageTitle.y = 140;
        container.addChild(pageTitle);

        const sub = new PIXI.Text('每关专属Boss永远最大 · 前关Boss全部回归 · 击杀所有Boss即为通关', {
            fontSize: 15, fill: 0x888888,
        });
        sub.anchor.set(0.5); sub.x = W / 2; sub.y = 180;
        container.addChild(sub);

        // 5列2行网格
        const cols = 5;
        const cardW = 220;
        const cardH = 320;
        const gapX = 30;
        const gapY = 20;
        const gridW = cols * cardW + (cols - 1) * gapX;
        const startX = (W - gridW) / 2;
        const startY = 210;

        LEVELS.forEach((lvl, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (cardW + gapX);
            const y = startY + row * (cardH + gapY);

            const isCleared = cleared.includes(lvl.id);
            const prevCleared = lvl.id === 1 || cleared.includes(lvl.id - 1);
            const isLocked = !prevCleared;

            const card = this.createLevelCard(lvl, isCleared, isLocked, () => {
                onLevelSelected(lvl.id, {
                    hpMult: lvl.hpMult,
                    spawnRate: lvl.spawnRate,
                    reward: lvl.reward,
                });
            });
            card.x = x; card.y = y;
            container.addChild(card);
        });
    }

    private static createLevelCard(
        lvl: (typeof LEVELS)[number],
        isCleared: boolean,
        isLocked: boolean,
        onEnter: () => void
    ): PIXI.Container {
        const card = new PIXI.Container();
        const borderColor = isLocked ? 0x333333 : (isCleared ? 0x00ff88 : lvl.borderColor);
        const alpha = isLocked ? 0.45 : 1.0;

        const bg = new PIXI.Graphics()
            .beginFill(0x0a0f1a, 0.92)
            .lineStyle(3, borderColor, 1)
            .drawRoundedRect(0, 0, 220, 320, 12)
            .endFill();
        bg.alpha = alpha;
        card.addChild(bg);

        // Level number badge
        const numBadge = new PIXI.Graphics()
            .beginFill(borderColor, isLocked ? 0.2 : 0.3)
            .drawRoundedRect(8, 8, 48, 48, 8)
            .endFill();
        card.addChild(numBadge);

        const numTxt = new PIXI.Text(`${lvl.id}`, {
            fontSize: 28, fill: isLocked ? 0x555555 : 0xffffff, fontWeight: 'bold',
        });
        numTxt.anchor.set(0.5); numTxt.x = 32; numTxt.y = 32;
        card.addChild(numTxt);

        // 通关/锁定状态标记
        if (isCleared) {
            const clearedBadge = new PIXI.Text('✓ 已通关', { fontSize: 13, fill: 0x00ff88, fontWeight: 'bold' });
            clearedBadge.anchor.set(1, 0); clearedBadge.x = 214; clearedBadge.y = 12;
            card.addChild(clearedBadge);
        } else if (isLocked) {
            const lockedBadge = new PIXI.Text('🔒 锁定', { fontSize: 13, fill: 0x666666 });
            lockedBadge.anchor.set(1, 0); lockedBadge.x = 214; lockedBadge.y = 12;
            card.addChild(lockedBadge);
        }

        // 关卡名
        const nameStyle: Partial<PIXI.ITextStyle> = {
            fontSize: 16, fill: isLocked ? 0x555555 : 0xffffff, fontWeight: 'bold',
            wordWrap: true, wordWrapWidth: 130,
        };
        const nameTxt = new PIXI.Text(lvl.name.replace(/^第.+关：/, ''), nameStyle);
        nameTxt.x = 64; nameTxt.y = 14;
        card.addChild(nameTxt);

        const subTxt = new PIXI.Text(lvl.subtitle, {
            fontSize: 11, fill: isLocked ? 0x444444 : 0x7a8a9a,
            wordWrap: true, wordWrapWidth: 200,
        });
        subTxt.x = 10; subTxt.y = 66;
        card.addChild(subTxt);

        // 分割线
        const line = new PIXI.Graphics()
            .lineStyle(1, isLocked ? 0x222222 : 0x1a2a3a)
            .moveTo(10, 90).lineTo(210, 90);
        card.addChild(line);

        // Boss列表
        const exclusive = lvl.bosses.find(b => b.isExclusive);
        const others = lvl.bosses.filter(b => !b.isExclusive);

        const bossLabel = new PIXI.Text('专属BOSS:', {
            fontSize: 12, fill: isLocked ? 0x444444 : 0xff8800, fontWeight: 'bold',
        });
        bossLabel.x = 10; bossLabel.y = 98;
        card.addChild(bossLabel);

        if (exclusive) {
            const exName = new PIXI.Text(exclusive.name.replace('（回归）', ''), {
                fontSize: 13, fill: isLocked ? 0x444444 : 0xffdd00, fontWeight: 'bold',
            });
            exName.x = 10; exName.y = 116;
            card.addChild(exName);
        }

        if (others.length > 0) {
            const retLabel = new PIXI.Text('回归:', {
                fontSize: 11, fill: isLocked ? 0x333333 : 0x5a8aaa,
            });
            retLabel.x = 10; retLabel.y = 140;
            card.addChild(retLabel);

            const retNames = others.map(b => b.name.replace('（回归）', '')).join(' / ');
            const retTxt = new PIXI.Text(retNames, {
                fontSize: 10, fill: isLocked ? 0x333333 : 0x667788,
                wordWrap: true, wordWrapWidth: 200,
            });
            retTxt.x = 10; retTxt.y = 155;
            card.addChild(retTxt);
        }

        // 难度数值
        const line2 = new PIXI.Graphics()
            .lineStyle(1, isLocked ? 0x222222 : 0x1a2a3a)
            .moveTo(10, 210).lineTo(210, 210);
        card.addChild(line2);

        const diffTxt = new PIXI.Text(
            `HP ×${lvl.hpMult}  奖励 ×${lvl.reward}`,
            { fontSize: 12, fill: isLocked ? 0x333333 : 0x99aacc },
        );
        diffTxt.x = 10; diffTxt.y = 218;
        card.addChild(diffTxt);

        // 进入按钮
        if (!isLocked) {
            const btnColor = isCleared ? 0x005533 : 0x003377;
            const btnBorderColor = isCleared ? 0x00ff88 : 0x0088ff;
            const btnBg = new PIXI.Graphics()
                .beginFill(btnColor, 1)
                .lineStyle(2, btnBorderColor, 1)
                .drawRoundedRect(15, 265, 190, 42, 8)
                .endFill();
            const btnTxt = new PIXI.Text(isCleared ? '再次挑战' : '开始挑战', {
                fontSize: 18, fill: 0xffffff, fontWeight: 'bold',
            });
            btnTxt.anchor.set(0.5); btnTxt.x = 110; btnTxt.y = 286;
            card.addChild(btnBg, btnTxt);
            card.eventMode = 'static'; card.cursor = 'pointer';
            card.on('pointerover', () => { bg.tint = 0x223344; card.scale.set(1.03); });
            card.on('pointerout', () => { bg.tint = 0xffffff; card.scale.set(1); });
            card.on('pointerdown', onEnter);
        } else {
            const lockTxt = new PIXI.Text('完成上一关解锁', {
                fontSize: 13, fill: 0x444444,
            });
            lockTxt.anchor.set(0.5); lockTxt.x = 110; lockTxt.y = 284;
            card.addChild(lockTxt);
        }

        return card;
    }
}
