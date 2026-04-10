import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { AssetManager } from '../../AssetManager';
import { MAPS, MapDef } from '../../config/maps.config';

export class LobbyPage {
    public static draw(
        container: PIXI.Container,
        sideNav: PIXI.Container,
        onMapSelected: (config: any) => void,
        onMenuHide: () => void,
        onSwitchPage: (id: string) => void
    ): void {
        const mapContainer = new PIXI.Container();
        mapContainer.x = (SceneManager.width - (MAPS.length * 280 - 20)) / 2;
        mapContainer.y = 180;
        container.addChild(mapContainer);

        MAPS.forEach((m, i) => {
            const card = this.createMapCard(m, i, onMapSelected, onMenuHide);
            card.x = i * 280; card.y = 0;
            mapContainer.addChild(card);
        });

        this.drawSideHUD(sideNav, onSwitchPage);
    }

    private static drawSideHUD(nav: PIXI.Container, onSwitchPage: (id: string) => void): void {
        const tabs = [
            { id: 'weaponry', name: 'ARSENAL', icon: 'cannon_v3', desc: '武器库档案馆' },
            { id: 'research', name: 'CORE TECH', icon: 'skin_lightning', desc: '升级研究中心' },
            { id: 'mall', name: 'HERO MALL', icon: 'skin_railgun', desc: '英雄武器商店' }
        ];

        const W = SceneManager.width;
        nav.x = W - 320; nav.y = 180;

        tabs.forEach((tab, i) => {
            const tabBtn = new PIXI.Container();
            tabBtn.y = i * 130;

            const bg = new PIXI.Graphics();
            const bw = 280; const bh = 100; const slant = 30;
            bg.beginFill(0x050e1a, 0.7);
            bg.lineStyle(2, 0x3a4a5e, 1);
            bg.drawPolygon([slant, 0, bw, 0, bw - slant, bh, 0, bh]);
            bg.endFill();

            const iconTex = AssetManager.textures[tab.icon];
            if (iconTex) {
                const icon = new PIXI.Sprite(iconTex);
                icon.width = 60; icon.height = 60; icon.x = slant + 10; icon.y = 20;
                tabBtn.addChild(icon);
            }

            const txt = new PIXI.Text(tab.name, { fontSize: 22, fill: 0x00f0ff, fontWeight: 'bold' });
            txt.x = slant + 80; txt.y = 25;
            const desc = new PIXI.Text(tab.desc, { fontSize: 14, fill: 0x888888 });
            desc.x = slant + 80; desc.y = 55;

            tabBtn.addChild(bg, txt, desc);
            tabBtn.eventMode = 'static'; tabBtn.cursor = 'pointer';
            tabBtn.on('pointerover', () => { bg.tint = 0x00f0ff; tabBtn.scale.set(1.05); });
            tabBtn.on('pointerout', () => { bg.tint = 0xffffff; tabBtn.scale.set(1); });
            tabBtn.on('pointerdown', () => onSwitchPage(tab.id));
            nav.addChild(tabBtn);
        });
    }

    private static createMapCard(
        m: MapDef,
        i: number,
        onSelected: (config: any) => void,
        onMenuHide: () => void
    ): PIXI.Container {
        const card = new PIXI.Container();
        const bg = new PIXI.Graphics()
            .beginFill(0x111111, 0.85)
            .lineStyle(3, m.borderColor)
            .drawRoundedRect(0, 0, 240, 380, 15)
            .endFill();
        const thumb = new PIXI.Sprite(AssetManager.textures[m.bgKey] || AssetManager.textures['bg_ocean']);
        thumb.width = 220; thumb.height = 150; thumb.x = 10; thumb.y = 10;
        const mask = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(10, 10, 220, 150, 10).endFill();
        thumb.mask = mask;
        const name = new PIXI.Text(m.name, { fontSize: 24, fill: 0xffffff, fontWeight: 'bold' });
        name.anchor.set(0.5); name.x = 120; name.y = 190;
        const info = new PIXI.Text(
            `血量: x${m.hpMult}\n密度: x${m.spawnRate}\n奖励: x${m.reward}`,
            { fontSize: 16, fill: 0xaaaaaa, align: 'center' }
        );
        info.anchor.set(0.5); info.x = 120; info.y = 250;
        const btn = new PIXI.Graphics().beginFill(0x0088ff).drawRoundedRect(30, 310, 180, 45, 8).endFill();
        const btnTxt = new PIXI.Text('进入海域', { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' });
        btnTxt.anchor.set(0.5); btnTxt.x = 120; btnTxt.y = 332;
        card.addChild(bg, thumb, mask, name, info, btn, btnTxt);
        card.eventMode = 'static'; card.cursor = 'pointer';
        card.on('pointerdown', () => {
            onMenuHide();
            onSelected(m);
        });
        return card;
    }
}
