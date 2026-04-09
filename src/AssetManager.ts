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
            // 2. 激光子弹 (标准)
            const bulletG = new PIXI.Graphics();
            bulletG.beginFill(0xffffff).drawRect(0, 0, 20, 4).endFill();
            bulletG.beginFill(0x00f0ff, 0.5).drawRect(-2, -1, 24, 6).endFill();
            this.textures['bullet_laser'] = renderer.generateTexture(bulletG);

            // 3. 等离子 (机械鱼)
            const plasmaG = new PIXI.Graphics();
            plasmaG.beginFill(0x00ff00).drawCircle(10, 5, 10).endFill();
            plasmaG.beginFill(0xffffff, 0.7).drawCircle(10, 5, 4).endFill();
            this.textures['bullet_plasma'] = renderer.generateTexture(plasmaG);

            // 4. 加特林 (黄色火花)
            const gatlingG = new PIXI.Graphics();
            gatlingG.beginFill(0xffff00).drawRect(0, 0, 15, 6).endFill();
            gatlingG.beginFill(0xffaa00, 0.8).drawRect(-2, -2, 19, 10).endFill();
            this.textures['bullet_gatling'] = renderer.generateTexture(gatlingG);

            // 5. 重炮 (大橙色弹药)
            const heavyG = new PIXI.Graphics();
            heavyG.beginFill(0xff6600).drawRoundedRect(0, 0, 30, 20, 10).endFill();
            heavyG.beginFill(0xffffff, 0.4).drawEllipse(15, 10, 12, 6).endFill();
            this.textures['bullet_heavy'] = renderer.generateTexture(heavyG);

            // 6. 闪电 (青色电磁脉冲)
            const lightningG = new PIXI.Graphics();
            lightningG.beginFill(0x00ffff).drawCircle(8, 8, 8).endFill();
            lightningG.lineStyle(2, 0xffffff).moveTo(0, 8).lineTo(16, 8).moveTo(8, 0).lineTo(8, 16);
            this.textures['bullet_lightning'] = renderer.generateTexture(lightningG);

            const coreG = new PIXI.Graphics();
            coreG.beginFill(0x00ff00).drawPolygon([0, -15, 10, 0, 0, 15, -10, 0]).endFill();
            this.textures['item_core'] = renderer.generateTexture(coreG);

            // 自定义加载器，兼容浏览器和微信小游戏 (避开 PIXI.Assets 的 DOM 类型猜测和 fetch)
            const loadImage = (src: string) => new Promise<PIXI.Texture>((resolve, reject) => {
                const img = (window as any).wx ? (window as any).wx.createImage() : new Image();
                img.onload = () => resolve(PIXI.Texture.from(img));
                img.onerror = (e: any) => reject(new Error(`Failed to load: ${src}`));
                img.src = src;
            });

            // 动态路径适配：微信小游戏使用相对路径，H5 必须使用绝对路径(/)才能映射到 public 目录
            const getPath = (p: string) => (window as any).wx ? p : `/${p}`;

            const bgTex = await loadImage(getPath('assets/bg.png')).catch(() => null);
            const tunaTex = await loadImage(getPath('assets/jqy.png')).catch(() => null);
            const baseTex = await loadImage(getPath('assets/jgwuqi.png')).catch(() => null);

            if (bgTex) this.textures['bg_ocean'] = bgTex;
            if (tunaTex) this.textures['fish_tuna'] = tunaTex;
            if (baseTex) this.textures['cannon_base'] = baseTex;

            // 补充兜底逻辑 (如果文件缺失)
            if (!this.textures['bg_ocean']) {
                const g = new PIXI.Graphics().beginFill(0x000033).drawRect(0, 0, 64, 64);
                this.textures['bg_ocean'] = renderer.generateTexture(g);
            }
            if (!this.textures['fish_tuna']) {
                const g = new PIXI.Graphics().beginFill(0xff0000).drawCircle(0, 0, 20);
                this.textures['fish_tuna'] = renderer.generateTexture(g);
            }
            if (!this.textures['cannon_base']) {
                const g = new PIXI.Graphics().beginFill(0x888888).drawRect(0, 0, 30, 30);
                this.textures['cannon_base'] = renderer.generateTexture(g);
            }

            // 6. 粒子基准纹理 (用于 ParticleContainer 渲染)
            const dot = new PIXI.Graphics();
            dot.beginFill(0xffffff);
            dot.drawCircle(4, 4, 4);
            dot.endFill();
            this.textures['white_dot'] = renderer.generateTexture(dot);

            console.log('Textures Baked:', Object.keys(this.textures));
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
