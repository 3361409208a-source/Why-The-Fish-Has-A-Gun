import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { SaveManager } from '../../SaveManager';
import { STANDARD_WEAPONS } from '../../config/weapons.config';
import { UPGRADE } from '../../config/balance.config';
import { FloatingText } from '../overlays/FloatingText';

export class ResearchPage {
    public static draw(
        container: PIXI.Container,
        onRefresh: (pageId: string) => void
    ): void {
        const panel = new PIXI.Container();
        panel.x = (SceneManager.width - 700) / 2; panel.y = 150;
        container.addChild(panel);

        const bg = new PIXI.Graphics()
            .beginFill(0x111822, 0.95)
            .lineStyle(2, 0x00f0ff)
            .drawRoundedRect(0, 0, 700, 650, 15)
            .endFill();
        const title = new PIXI.Text('升级与研究中心', { fontSize: 32, fill: 0x00f0ff, fontWeight: 'bold' });
        title.anchor.set(0.5); title.x = 350; title.y = 40;
        panel.addChild(bg, title);

        const leftCol = new PIXI.Container(); leftCol.x = 30; leftCol.y = 80;
        const rightCol = new PIXI.Container(); rightCol.x = 370; rightCol.y = 80;
        panel.addChild(leftCol, rightCol);

        const talents: (keyof typeof SaveManager.state.talents)[] = ['damage', 'fireRate', 'goldBonus', 'critChance'];
        const names = { damage: '基础火力', fireRate: '射击频率', goldBonus: '收益加成', critChance: '暴击终端' };

        talents.forEach((key, index) => {
            const row = new PIXI.Container(); row.y = index * 130;
            const lvl = SaveManager.state.talents[key];
            const cost = SaveManager.getUpgradeCost(key);
            const canAfford = SaveManager.state.gold >= cost;

            const rbg = new PIXI.Graphics().beginFill(0x1a212e).drawRoundedRect(0, 0, 310, 110, 8).endFill();
            const label = new PIXI.Text(`${names[key]}`, { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
            label.x = 15; label.y = 15;
            const level = new PIXI.Text(`等级: ${lvl}`, { fontSize: 16, fill: 0x00f0ff });
            level.x = 15; level.y = 45;
            const btn = new PIXI.Graphics()
                .beginFill(canAfford ? 0x0088ff : 0x333333)
                .drawRoundedRect(15, 70, 280, 30, 5)
                .endFill();
            const btnTxt = new PIXI.Text(`升级 (${FloatingText.formatNumber(cost)} G)`, { fontSize: 16, fill: 0xffffff });
            btnTxt.anchor.set(0.5); btnTxt.x = 155; btnTxt.y = 85;

            row.addChild(rbg, label, level, btn, btnTxt);
            row.eventMode = 'static'; row.cursor = canAfford ? 'pointer' : 'default';
            row.on('pointerdown', () => {
                if (SaveManager.state.gold >= cost) {
                    SaveManager.state.gold -= cost;
                    (SaveManager.state.talents[key] as number)++;
                    SaveManager.save();
                    onRefresh('research');
                    FloatingText.show(SceneManager.width / 2, SceneManager.height / 2, '研究完成!', 0x00ff00);
                }
            });
            leftCol.addChild(row);
        });

        STANDARD_WEAPONS.forEach((w, index) => {
            const row = new PIXI.Container(); row.y = index * 105;
            const lvl = SaveManager.state.weaponLevels[w.id] || 1;
            const cost = UPGRADE.getCost(lvl);
            const isMax = lvl >= w.maxLevel;
            const canAfford = !isMax && SaveManager.state.gold >= cost;

            const rbg = new PIXI.Graphics().beginFill(0x1a212e).drawRoundedRect(0, 0, 310, 90, 8).endFill();
            const label = new PIXI.Text(w.name, { fontSize: 18, fill: 0xffffff }); label.x = 15; label.y = 15;
            const level = new PIXI.Text(`LV.${lvl}`, { fontSize: 16, fill: 0xffcc00 }); level.x = 15; level.y = 40;
            const btn = new PIXI.Graphics()
                .beginFill(isMax ? 0x222222 : (canAfford ? 0xaa6600 : 0x333333))
                .drawRoundedRect(160, 20, 130, 50, 5)
                .endFill();
            const btnTxt = new PIXI.Text(isMax ? 'MAX' : `${FloatingText.formatNumber(cost)}G`, { fontSize: 16, fill: 0xffffff });
            btnTxt.anchor.set(0.5); btnTxt.x = 225; btnTxt.y = 45;

            row.addChild(rbg, label, level, btn, btnTxt);
            if (!isMax) {
                row.eventMode = 'static'; row.cursor = 'pointer';
                row.on('pointerdown', () => {
                    if (SaveManager.state.gold >= cost) {
                        SaveManager.state.gold -= cost;
                        SaveManager.state.weaponLevels[w.id] = lvl + 1;
                        SaveManager.save();
                        onRefresh('research');
                        FloatingText.show(SceneManager.width / 2, SceneManager.height / 2, '属性提升!', 0xffcc00);
                    }
                });
            }
            rightCol.addChild(row);
        });
    }
}
