import * as PIXI from 'pixi.js';

/**
 * 资产管理器
 * 负责程序化生成游戏纹理及加载外部资源。
 */
export class AssetManager {
    public static textures: { [key: string]: PIXI.Texture } = {};

    /**
     * 初始化资产
     * 加载外部图片并生成程序化纹理
     */
    public static async init(renderer: PIXI.Renderer): Promise<void> {
        console.log('Starting asset initialization... (using Robust Loader)');

        try {
            // 1. 基础程序化纹理
            const bulletG = new PIXI.Graphics();
            bulletG.beginFill(0xffffff).drawRect(0, 0, 20, 4).endFill();
            bulletG.beginFill(0x00f0ff, 0.5).drawRect(-2, -1, 24, 6).endFill();
            this.textures['bullet_laser'] = renderer.generateTexture(bulletG);

            const plasmaG = new PIXI.Graphics();
            plasmaG.beginFill(0x00ff00).drawCircle(10, 5, 10).endFill();
            plasmaG.beginFill(0xffffff, 0.7).drawCircle(10, 5, 4).endFill();
            this.textures['bullet_plasma'] = renderer.generateTexture(plasmaG);

            const gatlingG = new PIXI.Graphics();
            gatlingG.beginFill(0xffff00).drawRect(0, 0, 15, 6).endFill();
            gatlingG.beginFill(0xffaa00, 0.8).drawRect(-2, -2, 19, 10).endFill();
            this.textures['bullet_gatling'] = renderer.generateTexture(gatlingG);

            const heavyG = new PIXI.Graphics();
            heavyG.beginFill(0xff6600).drawRoundedRect(0, 0, 30, 20, 10).endFill();
            heavyG.beginFill(0xffffff, 0.4).drawEllipse(15, 10, 12, 6).endFill();
            this.textures['bullet_heavy'] = renderer.generateTexture(heavyG);

            const lightningG = new PIXI.Graphics();
            lightningG.beginFill(0x00ffff).drawCircle(8, 8, 8).endFill();
            lightningG.lineStyle(2, 0xffffff).moveTo(0, 8).lineTo(16, 8).moveTo(8, 0).lineTo(8, 16);
            this.textures['bullet_lightning'] = renderer.generateTexture(lightningG);

            const coreG = new PIXI.Graphics();
            coreG.beginFill(0x00ff00).drawPolygon([0, -15, 10, 0, 0, 15, -10, 0]).endFill();
            this.textures['item_core'] = renderer.generateTexture(coreG);

            // 自定义加载器
            const loadImage = (src: string) => new Promise<PIXI.Texture>((resolve, reject) => {
                const img = (window as any).wx ? (window as any).wx.createImage() : new Image();
                img.onload = () => resolve(PIXI.Texture.from(img));
                img.onerror = (e: any) => reject(new Error(`Failed to load: ${src}`));
                img.src = src;
            });

            const getPath = (p: string) => (window as any).wx ? p : `/${p}`;

            // 批量加载外部素材
            const [
                bgTex, cannonTex, bulletTex,
                mapNormal, mapHard, mapLunatic,
                tunaTex, anglerTex, sharkTex, jellyTex,
                dragonTex, krakenTex,
                gatlingCannonTex, heavyCannonTex
            ] = await Promise.all([
                loadImage(getPath('assets/bg_v2.png')).catch(() => null),
                loadImage(getPath('assets/cannon_v3.png')).catch(() => null),
                loadImage(getPath('assets/bullet_v2.png')).catch(() => null),
                loadImage(getPath('assets/map_normal.png')).catch(() => null),
                loadImage(getPath('assets/map_hard.png')).catch(() => null),
                loadImage(getPath('assets/map_lunatic.png')).catch(() => null),
                loadImage(getPath('assets/fish_v2.png')).catch(() => null),
                loadImage(getPath('assets/fish_angler.png')).catch(() => null),
                loadImage(getPath('assets/fish_shark.png')).catch(() => null),
                loadImage(getPath('assets/fish_jelly.png')).catch(() => null),
                loadImage(getPath('assets/mechanical_dragon_leviathan_v4_1775701420100_1775702245374.png')).catch(() => null),
                loadImage(getPath('assets/mechanical_kraken_behemoth_v4_1775701420101_1775702270130.png')).catch(() => null),
                loadImage(getPath('assets/gatling_cannon_top_v4_1775701550100_1775702336331_1775702378432.png')).catch(() => null),
                loadImage(getPath('assets/heavy_railgun_top_v4_1775701550101_1775702336332_1775702401979.png')).catch(() => null)
            ]);

            if (bgTex) this.textures['bg_ocean'] = bgTex;
            if (mapNormal) this.textures['map_normal'] = mapNormal;
            if (mapHard) this.textures['map_hard'] = mapHard;
            if (mapLunatic) this.textures['map_lunatic'] = mapLunatic;
            if (cannonTex) this.textures['cannon_v3'] = cannonTex;
            if (bulletTex) this.textures['bullet_v2'] = bulletTex;
            if (tunaTex) this.textures['fish_tuna'] = tunaTex;
            if (anglerTex) this.textures['fish_angler'] = anglerTex;
            if (sharkTex) this.textures['fish_shark'] = sharkTex;
            if (jellyTex) this.textures['fish_jelly'] = jellyTex;
            if (dragonTex) this.textures['fish_dragon'] = dragonTex;
            if (krakenTex) this.textures['fish_kraken'] = krakenTex;
            
            // 武器专属皮肤
            if (gatlingCannonTex) this.textures['skin_gatling'] = gatlingCannonTex;
            if (heavyCannonTex) this.textures['skin_heavy'] = heavyCannonTex;

            // 兜底逻辑
            if (!this.textures['bg_ocean']) {
                const g = new PIXI.Graphics().beginFill(0x000033).drawRect(0, 0, 64, 64);
                this.textures['bg_ocean'] = renderer.generateTexture(g);
            }
            if (!this.textures['fish_tuna']) {
                const g = new PIXI.Graphics().beginFill(0xff0000).drawCircle(0, 0, 20);
                this.textures['fish_tuna'] = renderer.generateTexture(g);
            }

            console.log('Asset Manager Initialized Successfully');

        } catch (error: any) {
            console.error('Critical Asset Loading Error:', error.message);
        }
    }
}
