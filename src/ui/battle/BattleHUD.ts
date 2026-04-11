import * as PIXI from 'pixi.js';

export class BattleHUD {
    private static scoreText: PIXI.Text;
    private static berserkBar: PIXI.Graphics;
    private static berserkText: PIXI.Text;

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
    }

    public static update(crystals: number): void {
        if (this.scoreText) this.scoreText.text = `晶体: ${Math.floor(crystals)}`;
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
    }
}
