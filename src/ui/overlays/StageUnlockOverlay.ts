import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from '../../SceneManager';

export type UnlockChoice = 'next' | 'continue' | 'exit';

export class StageUnlockOverlay {
    public static show(currentScore: number, requiredScore: number, nextLevelName: string): Promise<UnlockChoice> {
        return new Promise((resolve) => {
            const uiLayer = SceneManager.getLayer(Layers.UI);
            const W = SceneManager.width;
            const H = SceneManager.height;

            const overlay = new PIXI.Graphics();
            overlay.beginFill(0x000000, 0.75);
            overlay.drawRect(0, 0, W, H);
            overlay.endFill();
            overlay.eventMode = 'static';
            uiLayer.addChild(overlay);

            const panelW = 520; const panelH = 280;
            const panelX = (W - panelW) / 2; const panelY = (H - panelH) / 2;

            const panel = new PIXI.Graphics();
            panel.beginFill(0x050e1a, 0.95);
            panel.lineStyle(3, 0x00e5ff, 0.9);
            panel.drawRoundedRect(0, 0, panelW, panelH, 16);
            panel.endFill();
            panel.beginFill(0x00e5ff, 0.2);
            panel.drawRoundedRect(0, 0, panelW, 56, 16);
            panel.endFill();
            panel.x = panelX; panel.y = panelY;
            uiLayer.addChild(panel);

            const titleText = new PIXI.Text('🎉 分数达标！下一关已解锁', {
                fontFamily: 'Verdana, sans-serif', fontSize: 24, fontWeight: 'bold',
                fill: 0x00e5ff, stroke: '#000000', strokeThickness: 3,
            });
            titleText.anchor.set(0.5, 0.5);
            titleText.x = panelX + panelW / 2; titleText.y = panelY + 32;
            uiLayer.addChild(titleText);

            const msgText = new PIXI.Text(
                `当前分数: ${Math.floor(currentScore).toLocaleString()} / ${Math.floor(requiredScore).toLocaleString()}\n下一关: ${nextLevelName}`,
                {
                    fontFamily: 'Verdana, sans-serif', fontSize: 18, fill: 0xffffff,
                    align: 'center', lineHeight: 26,
                }
            );
            msgText.anchor.set(0.5, 0.5);
            msgText.x = panelX + panelW / 2; msgText.y = panelY + 110;
            uiLayer.addChild(msgText);

            const close = (result: UnlockChoice) => {
                uiLayer.removeChild(overlay, panel, titleText, msgText, nextBtn, continueBtn, exitBtn);
                resolve(result);
            };

            const btnW = 140; const btnH = 48;
            const startX = panelX + (panelW - 3 * btnW - 40) / 2;
            const btnY = panelY + panelH - 90;

            // 下一关按钮
            const nextBtn = new PIXI.Container();
            const nextBg = new PIXI.Graphics();
            nextBg.beginFill(0x006600, 0.9).lineStyle(2, 0x00ff00).drawRoundedRect(0, 0, btnW, btnH, 10).endFill();
            const nextTxt = new PIXI.Text('下一关 ➜', { fontFamily: 'Verdana', fontSize: 16, fill: 0x00ff00, fontWeight: 'bold' });
            nextTxt.anchor.set(0.5); nextTxt.x = btnW / 2; nextTxt.y = btnH / 2;
            nextBtn.addChild(nextBg, nextTxt);
            nextBtn.x = startX; nextBtn.y = btnY;
            nextBtn.eventMode = 'static'; nextBtn.cursor = 'pointer';
            nextBtn.on('pointerdown', () => close('next'));
            nextBtn.on('pointerover', () => { nextBg.tint = 0x33ff33; });
            nextBtn.on('pointerout', () => { nextBg.tint = 0xffffff; });
            uiLayer.addChild(nextBtn);

            // 继续按钮
            const continueBtn = new PIXI.Container();
            const continueBg = new PIXI.Graphics();
            continueBg.beginFill(0x003344, 0.9).lineStyle(2, 0x00f0ff).drawRoundedRect(0, 0, btnW, btnH, 10).endFill();
            const continueTxt = new PIXI.Text('继续', { fontFamily: 'Verdana', fontSize: 16, fill: 0x00f0ff, fontWeight: 'bold' });
            continueTxt.anchor.set(0.5); continueTxt.x = btnW / 2; continueTxt.y = btnH / 2;
            continueBtn.addChild(continueBg, continueTxt);
            continueBtn.x = startX + btnW + 20; continueBtn.y = btnY;
            continueBtn.eventMode = 'static'; continueBtn.cursor = 'pointer';
            continueBtn.on('pointerdown', () => close('continue'));
            continueBtn.on('pointerover', () => { continueBg.tint = 0x66ffff; });
            continueBtn.on('pointerout', () => { continueBg.tint = 0xffffff; });
            uiLayer.addChild(continueBtn);

            // 退出按钮
            const exitBtn = new PIXI.Container();
            const exitBg = new PIXI.Graphics();
            exitBg.beginFill(0x440000, 0.9).lineStyle(2, 0xff4444).drawRoundedRect(0, 0, btnW, btnH, 10).endFill();
            const exitTxt = new PIXI.Text('退出', { fontFamily: 'Verdana', fontSize: 16, fill: 0xff4444, fontWeight: 'bold' });
            exitTxt.anchor.set(0.5); exitTxt.x = btnW / 2; exitTxt.y = btnH / 2;
            exitBtn.addChild(exitBg, exitTxt);
            exitBtn.x = startX + 2 * (btnW + 20); exitBtn.y = btnY;
            exitBtn.eventMode = 'static'; exitBtn.cursor = 'pointer';
            exitBtn.on('pointerdown', () => close('exit'));
            exitBtn.on('pointerover', () => { exitBg.tint = 0xff6666; });
            exitBtn.on('pointerout', () => { exitBg.tint = 0xffffff; });
            uiLayer.addChild(exitBtn);
        });
    }
}
