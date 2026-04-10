import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { SaveManager } from '../../SaveManager';
import { STANDARD_WEAPONS } from '../../config/weapons.config';

export class WeaponryPage {
    public static draw(container: PIXI.Container): void {
        const title = new PIXI.Text('— 武器库档案馆 —', { fontSize: 28, fill: 0xffcc00, fontWeight: 'bold' });
        title.anchor.set(0.5); title.x = SceneManager.width / 2; title.y = 160;
        container.addChild(title);

        const listContainer = new PIXI.Container();
        listContainer.x = 100; listContainer.y = 220;
        container.addChild(listContainer);

        STANDARD_WEAPONS.forEach((w, i) => {
            const item = new PIXI.Graphics()
                .beginFill(0x111822, 0.8)
                .lineStyle(2, 0x444444)
                .drawRoundedRect(0, i * 85, SceneManager.width - 200, 75, 10)
                .endFill();
            const lvl = SaveManager.state.weaponLevels[w.id] || 1;
            const name = new PIXI.Text(`${w.name} (LV.${lvl})`, { fontSize: 20, fill: 0x00f0ff, fontWeight: 'bold' });
            name.x = 20; name.y = i * 85 + 15;
            const desc = new PIXI.Text(w.desc, { fontSize: 16, fill: 0xaaaaaa });
            desc.x = 20; desc.y = i * 85 + 42;
            listContainer.addChild(item, name, desc);
        });
    }
}
