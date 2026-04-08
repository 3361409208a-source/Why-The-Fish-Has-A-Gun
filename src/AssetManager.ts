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
            // 1. 程序化生成
            const bulletG = new PIXI.Graphics();
            bulletG.beginFill(0xffffff).drawRect(0, 0, 20, 4).endFill();
            this.textures['bullet_laser'] = renderer.generateTexture(bulletG);

            const plasmaG = new PIXI.Graphics();
            plasmaG.beginFill(0xff33ff).drawRoundedRect(0, 0, 30, 8, 4).endFill();
            this.textures['bullet_plasma'] = renderer.generateTexture(plasmaG);

            const coreG = new PIXI.Graphics();
            coreG.beginFill(0x00ff00).drawPolygon([0, -15, 10, 0, 0, 15, -10, 0]).endFill();
            this.textures['item_core'] = renderer.generateTexture(coreG);

            // 2. 外部资源加载 (使用绝对路径确保 Vite 正确分发)
            PIXI.Assets.add({ alias: 'bg', src: '/assets/bg.png' });
            PIXI.Assets.add({ alias: 'tuna', src: '/assets/jqy.png' });
            PIXI.Assets.add({ alias: 'base', src: '/assets/jgwuqi.png' });


            const assets = await PIXI.Assets.load(['bg', 'tuna', 'base']);

            this.textures['bg_ocean'] = assets.bg;
            this.textures['fish_tuna'] = assets.tuna;
            this.textures['cannon_base'] = assets.base;

            console.log('Assets loaded successfully:', Object.keys(this.textures));
        } catch (e) {
            console.error('Asset loading/generation error:', e);
            
            // 降级处理：如果图片加载失败，创建占位符以防止崩溃
            if (!this.textures['bg_ocean']) {
                const g = new PIXI.Graphics();
                g.beginFill(0x000033);
                g.drawRect(0, 0, 64, 64);
                this.textures['bg_ocean'] = renderer.generateTexture(g);
            }
            if (!this.textures['fish_tuna']) {
                const g = new PIXI.Graphics();
                g.beginFill(0xff0000);
                g.drawCircle(0, 0, 20);
                this.textures['fish_tuna'] = renderer.generateTexture(g);
            }
        }
    }
}
