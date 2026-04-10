import * as PIXI from 'pixi.js';

export class BattleHUD {
    private static scoreText: PIXI.Text;

    public static init(layer: PIXI.Container): void {
        this.scoreText = new PIXI.Text('晶体: 0', {
            fontSize: 28, fill: 0xffcc00, fontWeight: 'bold'
        });
        this.scoreText.x = 20; this.scoreText.y = 20;
        this.scoreText.visible = false;
        layer.addChild(this.scoreText);
    }

    public static update(crystals: number): void {
        if (this.scoreText) this.scoreText.text = `晶体: ${Math.floor(crystals)}`;
    }

    public static show(): void {
        if (this.scoreText) this.scoreText.visible = true;
    }

    public static hide(): void {
        if (this.scoreText) this.scoreText.visible = false;
    }
}
