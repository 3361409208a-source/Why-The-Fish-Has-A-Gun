import * as PIXI from 'pixi.js';

/**
 * 资产管理器
 */
export class AssetManager {
    public static textures: { [key: string]: PIXI.Texture } = {};
    private static audioCtx: AudioContext;

    public static async init(renderer: PIXI.Renderer, onProgress?: (p: number) => void): Promise<void> {
        console.log('Starting asset initialization...');

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            this.generateTextures(renderer);
            await this.loadExternalAssets(onProgress);

            console.log('Asset Manager Initialized Successfully');
        } catch (error: any) {
            console.error('Critical Asset Loading Error:', error.message);
        }
    }

    private static generateTextures(renderer: PIXI.Renderer): void {
        // 程序化生成子弹
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
        
        // 5. [核心优化] 程序化雷电炮台外观 (Lightning Inductor Cannon)
        const lgtG = new PIXI.Graphics();
        // 炮塔基座 (深灰色多边形金属感)
        lgtG.beginFill(0x2c3e50).drawPolygon([-25, 40, 25, 40, 15, -10, -15, -10]).endFill();
        // 电能量核心 (青色发光球体)
        lgtG.beginFill(0x00ffff, 0.3).drawCircle(0, 5, 25).endFill(); // 外发光
        lgtG.beginFill(0x00ffff).drawCircle(0, 5, 12).endFill();    // 核心
        lgtG.beginFill(0xffffff, 0.8).drawCircle(0, 5, 5).endFill(); // 极高亮
        // 磁悬浮支架 (细节增强)
        lgtG.lineStyle(3, 0x95a5a6).moveTo(-15, -10).lineTo(-25, -25);
        lgtG.lineStyle(3, 0x95a5a6).moveTo(15, -10).lineTo(25, -25);
        lgtG.lineStyle(2, 0x00ffff).moveTo(-20, -20).lineTo(20, -20);
        
        this.textures['gen_lightning_skin'] = renderer.generateTexture(lgtG);

        // --- 英雄武器子弹 ---
        const railG = new PIXI.Graphics();
        railG.beginFill(0xffaa00).drawRect(0, 0, 40, 8).endFill();
        railG.beginFill(0xffffff, 0.8).drawRect(5, 2, 30, 4).endFill();
        this.textures['bullet_railgun'] = renderer.generateTexture(railG);

        const voidG = new PIXI.Graphics();
        voidG.beginFill(0xcc00ff, 0.4).drawCircle(15, 15, 15).endFill();
        voidG.beginFill(0xff00ff).drawCircle(15, 15, 8).endFill();
        voidG.beginFill(0xffffff, 0.8).drawCircle(15, 15, 4).endFill();
        this.textures['bullet_void'] = renderer.generateTexture(voidG);

        const acidG = new PIXI.Graphics();
        acidG.beginFill(0x00ff00).drawPolygon([0, 0, 10, -5, 20, 0, 10, 5]).endFill();
        acidG.beginFill(0x00ff00, 0.5).drawCircle(10, 0, 12).endFill();
        const acidTex = renderer.generateTexture(acidG);
        this.textures['bullet_acid'] = acidTex;
        
        // --- 核心：将所有生成的纹理加入 PIXI 全局缓存，防止 Texture.from 报错 ---
        Object.entries(this.textures).forEach(([name, tex]) => {
            if (!PIXI.Cache.has(name)) PIXI.Texture.addToCache(tex, name);
        });
    }

    private static async loadExternalAssets(onProgress?: (p: number) => void): Promise<void> {
        const isWX = !!(window as any).wx || typeof (global as any).GameGlobal !== 'undefined' || typeof (global as any).wx !== 'undefined';
        // 腾讯云 COS 对象存储基地址
        const REMOTE_BASE = "https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/";
        
        // 关键：将 assets/xxx.png 映射到 COS 根目录下的 xxx.png (剥离 assets/ 路径)
        const getPath = (p: string) => {
            const fileName = p.split('/').pop() || p;
            return REMOTE_BASE + fileName;
        };

        const assetsToLoad = {
            'bg_ocean': 'assets/bg_v2.png',
            'cannon_v3': 'assets/cannon_v3.png',
            'bullet_v2': 'assets/bullet_v2.png',
            'map_normal': 'assets/map_normal.png',
            'map_hard': 'assets/map_hard.png',
            'map_lunatic': 'assets/map_lunatic.png',
            'fish_tuna': 'assets/fish_v2.png',
            'fish_angler': 'assets/fish_angler.png',
            'fish_shark': 'assets/fish_shark.png',
            'fish_jelly': 'assets/fish_jelly.png',
            'fish_dragon': 'assets/fish_dragon_serpentine.png',
            'fish_kraken': 'assets/fish_kraken.png',
            'skin_gatling': 'assets/skin_gatling.png',
            'skin_heavy': 'assets/skin_heavy.png',
            'skin_tuna': 'assets/skin_tuna.png',
            'skin_lightning': 'assets/skin_lightning.png',
            // --- 永久商城武器 (金币购买) ---
            'skin_railgun': 'assets/skin_railgun.png',
            'skin_void': 'assets/skin_void.png',
            'skin_acid': 'assets/skin_acid.png'
        };

        const total = Object.keys(assetsToLoad).length;
        let loaded = 0;

        const loadPromises = Object.entries(assetsToLoad).map(async ([key, path]) => {
            const finalPath = getPath(path);
            try {
                let tex: PIXI.Texture;
                
                if (isWX) {
                    // 微信环境下，最稳妥的是手动 wx.createImage
                    tex = await new Promise<PIXI.Texture>((resolve, reject) => {
                        const img = (window as any).wx.createImage();
                        // 超时保护：15秒加载失败则跳过
                        const timeoutId = (window as any).setTimeout(() => {
                             img.onload = null; img.onerror = null;
                             reject(new Error('Texture Load Timeout: ' + key));
                        }, 15000);

                        // 兼容性修复：部分环境 tagName 只读，使用 defineProperty 强制注入
                        try {
                            Object.defineProperty(img, 'tagName', {
                                value: 'IMG',
                                writable: true,
                                configurable: true
                            });
                        } catch (e) {
                            console.warn('AssetManager: Failed to inject tagName to WX image');
                        }
                        
                        img.onload = () => {
                            (window as any).clearTimeout(timeoutId);
                            // 使用刚在 main.ts 注册的全球探测器辅助，但也保持显式包装以防万一
                            const resource = new PIXI.ImageResource(img);
                            const base = new PIXI.BaseTexture(resource, {
                                alphaMode: PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA,
                                resolution: 1
                            });
                            const tex = new PIXI.Texture(base);
                            
                            // 双重注入缓存，显式设置名，解决 Texture.from 找不到的问题
                            if (!PIXI.Cache.has(key)) {
                                PIXI.Texture.addToCache(tex, key);
                            }
                            resolve(tex);
                        };
                        img.onerror = reject;
                        img.src = finalPath;
                    });
                } else {
                    // 浏览器环境下使用 Texture.from
                    tex = PIXI.Texture.from(finalPath);
                    if (!tex.baseTexture.valid) {
                        await new Promise((resolve) => {
                            tex.baseTexture.once('loaded', resolve);
                            tex.baseTexture.once('error', resolve);
                        });
                    }
                }

                this.textures[key] = tex;
                PIXI.Texture.addToCache(tex, key);
                loaded++;
                if (onProgress) onProgress(loaded / total);
            } catch (err) {
                console.error(`AssetManager Error [${key}]:`, err);
                this.textures[key] = PIXI.Texture.WHITE;
                loaded++;
                if (onProgress) onProgress(loaded / total);
            }
        });

        await Promise.all(loadPromises);
    }

    public static playSound(type: string): void {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain); gain.connect(this.audioCtx.destination);
        const now = this.audioCtx.currentTime;
        switch(type) {
            case 'shoot':
                osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now); osc.stop(now + 0.1); break;
            case 'hit':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now);
                osc.frequency.linearRampToValueAtTime(50, now + 0.05);
                gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.05);
                osc.start(now); osc.stop(now + 0.05); break;
            case 'explosion':
                osc.type = 'square'; osc.frequency.setValueAtTime(80, now);
                osc.frequency.exponentialRampToValueAtTime(20, now + 0.3);
                gain.gain.setValueAtTime(0.2, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3); break;
            case 'lightning':
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
                gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                osc.start(now); osc.stop(now + 0.15); break;
            case 'upgrade':
                osc.type = 'sine'; osc.frequency.setValueAtTime(330, now);
                osc.frequency.exponentialRampToValueAtTime(660, now + 0.2);
                gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                osc.start(now); osc.stop(now + 0.3); break;
        }
    }
}
