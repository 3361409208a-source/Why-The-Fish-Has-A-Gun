import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { AssetManager } from '../../AssetManager';
import { SaveManager } from '../../SaveManager';
import { HERO_WEAPONS } from '../../config/weapons.config';
import { FloatingText } from '../overlays/FloatingText';

export class MallPage {
    public static draw(
        container: PIXI.Container,
        onRefresh: (pageId: string) => void
    ): void {
        const panel = new PIXI.Container();
        panel.x = (SceneManager.width - 960) / 2; panel.y = 150;
        container.addChild(panel);

        const bg = new PIXI.Graphics()
            .beginFill(0x111822, 0.95)
            .lineStyle(2, 0xff00ff)
            .drawRoundedRect(0, 0, 960, 650, 15)
            .endFill();
        const mainTitle = new PIXI.Text('英雄机甲商城', { fontSize: 32, fill: 0xff00ff, fontWeight: 'bold' });
        mainTitle.anchor.set(0.5); mainTitle.x = 480; mainTitle.y = 40;
        panel.addChild(bg, mainTitle);

        HERO_WEAPONS.forEach((w, index) => {
            const card = new PIXI.Container();
            card.x = 20 + index * 310; card.y = 100;

            const cbg = new PIXI.Graphics()
                .beginFill(0x1a212e)
                .lineStyle(1, 0x3a4a5e)
                .drawRoundedRect(0, 0, 300, 500, 12)
                .endFill();

            const isUnlocked = SaveManager.state.goldUnlockedWeapons.includes(w.id);
            const icon = new PIXI.Sprite(AssetManager.textures[w.skinKey]);
            icon.width = 180; icon.height = 180; icon.anchor.set(0.5); icon.x = 150; icon.y = 120;

            const name = new PIXI.Text(w.name, { fontSize: 24, fill: 0xffffff, fontWeight: 'bold' });
            name.anchor.set(0.5); name.x = 150; name.y = 230;

            const desc = new PIXI.Text(w.desc, { fontSize: 16, fill: 0xaaaaaa, wordWrap: true, wordWrapWidth: 260, align: 'center' });
            desc.anchor.set(0.5); desc.x = 150; desc.y = 310;

            const canAfford = SaveManager.state.gold >= w.goldCost;
            const buyBtn = new PIXI.Graphics()
                .beginFill(isUnlocked ? 0x004488 : (canAfford ? 0x880088 : 0x333333))
                .drawRoundedRect(30, 420, 240, 50, 10)
                .endFill();
            const buyTxt = new PIXI.Text(
                isUnlocked ? '已入库' : `解锁: ${FloatingText.formatNumber(w.goldCost)} G`,
                { fontSize: 18, fill: 0xffffff }
            );
            buyTxt.anchor.set(0.5); buyTxt.x = 150; buyTxt.y = 445;

            card.addChild(cbg, icon, name, desc, buyBtn, buyTxt);

            if (!isUnlocked) {
                card.eventMode = 'static'; card.cursor = canAfford ? 'pointer' : 'default';
                card.on('pointerdown', () => {
                    if (SaveManager.state.gold >= w.goldCost) {
                        SaveManager.state.gold -= w.goldCost;
                        SaveManager.state.goldUnlockedWeapons.push(w.id);
                        SaveManager.state.weaponLevels[w.id] = 1;
                        SaveManager.save();
                        onRefresh('mall');
                        FloatingText.show(SceneManager.width / 2, SceneManager.height / 2, `获得神兵: ${w.name}`, 0xff00ff);
                    }
                });
            }
            panel.addChild(card);
        });
    }
}
