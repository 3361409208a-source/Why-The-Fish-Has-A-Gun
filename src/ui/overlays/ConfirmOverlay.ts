import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from '../../SceneManager';

export class ConfirmOverlay {
    public static show(message: string, title: string = '确认操作'): Promise<boolean> {
        return new Promise((resolve) => {
            const uiLayer = SceneManager.getLayer(Layers.UI);
            const W = SceneManager.width;
            const H = SceneManager.height;

            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.65);
            overlay.drawRect(0, 0, W, H);
            overlay.endFill();
            overlay.eventMode = 'static';
            uiLayer.addChild(overlay);

            const panelW = 480; const panelH = 220;
            const panelX = (W - panelW) / 2; const panelY = (H - panelH) / 2;

            const panel = new PIXI.Graphics();
            panel.beginFill(0x050e1a, 0.92);
            panel.lineStyle(2, 0x00f0ff, 0.9);
            panel.drawRoundedRect(0, 0, panelW, panelH, 16);
            panel.endFill();
            panel.beginFill(0x00f0ff, 0.15);
            panel.drawRoundedRect(0, 0, panelW, 52, 16);
            panel.endFill();
            panel.x = panelX; panel.y = panelY;
            uiLayer.addChild(panel);

            const titleText = new PIXI.Text(title, {
                fontFamily: 'Verdana, sans-serif', fontSize: 22, fontWeight: 'bold',
                fill: 0x00f0ff, stroke: '#000000', strokeThickness: 3,
            });
            titleText.anchor.set(0.5, 0.5);
            titleText.x = panelX + panelW / 2; titleText.y = panelY + 26;
            uiLayer.addChild(titleText);

            const msgText = new PIXI.Text(message, {
                fontFamily: 'Verdana, sans-serif', fontSize: 18, fill: 0xdddddd,
                align: 'center', wordWrap: true, wordWrapWidth: panelW - 60
            });
            msgText.anchor.set(0.5, 0.5);
            msgText.x = panelX + panelW / 2; msgText.y = panelY + 115;
            uiLayer.addChild(msgText);

            const close = (result: boolean) => {
                uiLayer.removeChild(overlay, panel, titleText, msgText, confirmBtn, cancelBtn);
                resolve(result);
            };

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
}
