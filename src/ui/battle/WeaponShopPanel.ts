import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';

export class WeaponShopPanel {
    private static container: PIXI.Container;

    public static init(layer: PIXI.Container): void {
        this.container = new PIXI.Container();
        layer.addChild(this.container);
    }

    public static setup(
        weapons: any[],
        onSelect: (id: string) => void,
        onUpgrade: (id: string) => void
    ): void {
        this.container.removeChildren();
        this.container.x = SceneManager.width - 200;
        this.container.y = 100;

        weapons.forEach((w, index) => {
            const btn = new PIXI.Container();
            btn.y = index * 110;

            const bg = new PIXI.Graphics()
                .beginFill(w.unlocked ? 0x222222 : 0x111111, 0.9)
                .lineStyle(2, w.active ? 0x00f0ff : 0x444444)
                .drawRoundedRect(0, 0, 180, 95, 8)
                .endFill();

            const name = new PIXI.Text(w.name, { fontSize: 18, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5); name.x = 90; name.y = 20;

            const status = new PIXI.Text(
                w.unlocked ? `当前等级: LV.${w.level}` : `价格: ${w.cost} 晶体`,
                { fontSize: 16, fill: w.unlocked ? 0x00ff00 : 0xffcc00 }
            );
            status.anchor.set(0.5); status.x = 90; status.y = 50;

            const actionBtn = new PIXI.Graphics().beginFill(0x444444).drawRoundedRect(10, 65, 160, 25, 4).endFill();
            const actionTxt = new PIXI.Text(
                w.unlocked ? (w.active ? '当前选用' : '激活武器') : '解锁武器',
                { fontSize: 14, fill: 0xffffff }
            );
            actionTxt.anchor.set(0.5); actionTxt.x = 90; actionTxt.y = 77;

            btn.addChild(bg, name, status, actionBtn, actionTxt);
            btn.eventMode = 'static'; btn.cursor = 'pointer';
            btn.on('pointerdown', () => onSelect(w.id));
            this.container.addChild(btn);
        });
    }

    public static show(): void {
        if (this.container) this.container.visible = true;
    }

    public static hide(): void {
        if (this.container) this.container.visible = false;
    }
}
