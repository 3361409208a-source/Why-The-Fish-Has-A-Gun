import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';

export class BattleHUD {
    private static scoreText: PIXI.Text;
    private static berserkBar: PIXI.Graphics;
    private static berserkText: PIXI.Text;
    private static stageScoreText: PIXI.Text;
    private static stageProgressText: PIXI.Text;
    private static stageProgressBar: PIXI.Graphics;

    public static init(layer: PIXI.Container): void {
        this.scoreText = new PIXI.Text('晶体: 0', {
            fontSize: 28, fill: 0xffcc00, fontWeight: 'bold'
        });
        this.scoreText.x = 20; this.scoreText.y = 20;
        this.scoreText.visible = false;
        layer.addChild(this.scoreText);

        // 狂热能量条容器
        this.berserkBar = new PIXI.Graphics();
        this.berserkBar.x = 20; this.berserkBar.y = 60;
        this.berserkBar.visible = false;
        layer.addChild(this.berserkBar);

        this.berserkText = new PIXI.Text('BERSERK: 0%', {
            fontSize: 14, fill: 0x00f0ff, fontWeight: 'bold'
        });
        this.berserkText.x = 20; this.berserkText.y = 85;
        this.berserkText.visible = false;
        layer.addChild(this.berserkText);

        // 关卡分数显示（仅在关卡模式显示）
        this.stageScoreText = new PIXI.Text('关卡分数: 0', {
            fontSize: 18, fill: 0x00e5ff, fontWeight: 'bold'
        });
        this.stageScoreText.x = SceneManager.width / 2;
        this.stageScoreText.y = 20;
        this.stageScoreText.anchor.set(0.5, 0);
        this.stageScoreText.visible = false;
        layer.addChild(this.stageScoreText);

        // 解锁进度条
        this.stageProgressBar = new PIXI.Graphics();
        this.stageProgressBar.x = SceneManager.width / 2 - 150;
        this.stageProgressBar.y = 48;
        this.stageProgressBar.visible = false;
        layer.addChild(this.stageProgressBar);

        this.stageProgressText = new PIXI.Text('', {
            fontSize: 12, fill: 0xaaaaaa
        });
        this.stageProgressText.anchor.set(0.5);
        this.stageProgressText.x = SceneManager.width / 2;
        this.stageProgressText.y = 55;
        this.stageProgressText.visible = false;
        layer.addChild(this.stageProgressText);
    }

    public static update(crystals: number): void {
        if (this.scoreText) this.scoreText.text = `晶体: ${Math.floor(crystals)}`;
    }

    /** 更新关卡分数和解锁进度显示 */
    public static updateStageScore(currentScore: number, requiredScore: number, levelId: number): void {
        if (this.stageScoreText) {
            this.stageScoreText.text = `关卡分数: ${Math.floor(currentScore).toLocaleString()}`;
            this.stageScoreText.visible = true;
        }

        if (this.stageProgressBar) {
            this.stageProgressBar.clear();
            const width = 300;
            const height = 10;

            // 背景
            this.stageProgressBar.beginFill(0x000000, 0.5);
            this.stageProgressBar.lineStyle(2, 0x00e5ff, 0.3);
            this.stageProgressBar.drawRoundedRect(0, 0, width, height, 4);
            this.stageProgressBar.endFill();

            // 进度填充
            const progress = Math.min(1, currentScore / Math.max(1, requiredScore));
            const fillWidth = width * progress;
            if (fillWidth > 0) {
                this.stageProgressBar.beginFill(0x00e5ff, 0.8);
                this.stageProgressBar.lineStyle(0);
                this.stageProgressBar.drawRoundedRect(0, 0, fillWidth, height, 4);
                this.stageProgressBar.endFill();
            }

            this.stageProgressBar.visible = true;
        }

        if (this.stageProgressText) {
            if (requiredScore > 0) {
                this.stageProgressText.text = `${Math.floor(currentScore).toLocaleString()} / ${Math.floor(requiredScore).toLocaleString()} (解锁下一关)`;
            } else {
                this.stageProgressText.text = '已解锁全部关卡';
            }
            this.stageProgressText.visible = true;
        }
    }

    /** 隐藏关卡分数显示 */
    public static hideStageScore(): void {
        if (this.stageScoreText) this.stageScoreText.visible = false;
        if (this.stageProgressBar) this.stageProgressBar.visible = false;
        if (this.stageProgressText) this.stageProgressText.visible = false;
    }

    public static updateBerserk(charge: number, isActive: boolean): void {
        if (!this.berserkBar) return;

        const g = this.berserkBar;
        g.clear();

        const width = 200;
        const height = 12;

        // 背景
        g.beginFill(0x000000, 0.5);
        g.lineStyle(2, 0x00f0ff, 0.3);
        g.drawRoundedRect(0, 0, width, height, 4);
        g.endFill();

        // 进度条
        const fillWidth = Math.max(0, Math.min(width, width * charge));
        if (fillWidth > 0) {
            const color = isActive ? 0xff0000 : 0x00f0ff;
            g.lineStyle(0);
            g.beginFill(color, 0.8);
            g.drawRoundedRect(0, 0, fillWidth, height, 4);
            g.endFill();

            // 闪烁效果 (isActive 时)
            if (isActive) {
                g.lineStyle(2, 0xffffff, Math.sin(Date.now() / 100) * 0.5 + 0.5);
                g.drawRoundedRect(0, 0, width, height, 4);
            }
        }

        if (this.berserkText) {
            this.berserkText.text = isActive ? 'BERSERK ACTIVE [x5 SPEED]' : `BERSERK DISCHARGE: ${Math.floor(charge * 100)}%`;
            this.berserkText.style.fill = isActive ? 0xff4444 : 0x00f0ff;
        }
    }

    public static show(): void {
        if (this.scoreText) this.scoreText.visible = true;
        if (this.berserkBar) this.berserkBar.visible = true;
        if (this.berserkText) this.berserkText.visible = true;
    }

    public static hide(): void {
        if (this.scoreText) this.scoreText.visible = false;
        if (this.berserkBar) this.berserkBar.visible = false;
        if (this.berserkText) this.berserkText.visible = false;
        this.hideStageScore();
    }
}
