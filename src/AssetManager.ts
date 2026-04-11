import * as PIXI from 'pixi.js';

/**
 * 资产管理器
 */
export class AssetManager {
    public static textures: { [key: string]: PIXI.Texture } = {};
    private static audioCtx: AudioContext;
    private static soundBuffers: { [key: string]: AudioBuffer } = {};
    private static soundEndTimes: { [key: string]: number } = {};
    private static soundNextAllowedAt: { [key: string]: number } = {};
    private static audioUnlocked: boolean = false;

    public static async init(renderer: PIXI.Renderer, onProgress?: (p: number) => void): Promise<void> {
        console.log('Starting asset initialization...');

        try {
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            this.generateTextures(renderer);
            await Promise.all([
                this.loadExternalAssets(onProgress),
                this.loadSounds(),
            ]);

            console.log('Asset Manager Initialized Successfully');
        } catch (error: any) {
            console.error('Critical Asset Loading Error:', error.message);
        }
    }

    private static generateTextures(renderer: PIXI.Renderer): void {
        const coreG = new PIXI.Graphics();
        coreG.beginFill(0x00ff00).drawPolygon([0, -15, 10, 0, 0, 15, -10, 0]).endFill();
        this.textures['item_core'] = renderer.generateTexture(coreG);
        
        const whiteG = new PIXI.Graphics();
        whiteG.beginFill(0xffffff).drawRect(0, 0, 32, 32).endFill();
        this.textures['white'] = renderer.generateTexture(whiteG);

        // --- 核心：将所有生成的纹理加入 PIXI 全局缓存 ---
        Object.entries(this.textures).forEach(([name, tex]) => {
            if (!PIXI.Cache.has(name)) PIXI.Texture.addToCache(tex, name);
        });
    }

    private static async loadSounds(): Promise<void> {
        const soundMap: { [key: string]: string } = {
            'shoot':     'https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/Boom.mp3',
            'lightning': 'https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/dianjijizhong.mp3',
        };
        await Promise.all(Object.entries(soundMap).map(async ([key, url]) => {
            try {
                const res = await fetch(url);
                const buf = await res.arrayBuffer();
                this.soundBuffers[key] = await this.audioCtx.decodeAudioData(buf);
            } catch (e) {
                console.warn(`Sound load failed [${key}]:`, e);
            }
        }));
    }

    private static async loadExternalAssets(onProgress?: (p: number) => void): Promise<void> {
        const isWX = !!(window as any).wx || typeof (window as any).GameGlobal !== 'undefined' || (typeof global !== 'undefined' && (global as any).wx !== 'undefined');
        // 腾讯云 COS 对象存储基地址
        const REMOTE_BASE = "https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/";
        
        // 关键：将 assets/xxx.png 映射到 COS 根目录下的 xxx.png (剥离 assets/ 路径)
        const getPath = (p: string) => {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            // 本地开发环境直接读取 public/assets（Vite: public 下资源以 / 开头访问最稳）
            if (isLocal) return p.startsWith('/') ? p : `/${p}`;

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
            'boss_leviathan': 'assets/boss_leviathan.png',
            'boss_whale': 'assets/boss_whale.png',
            'boss_crab': 'assets/boss_crab.png',
            'boss_manta': 'assets/boss_manta.png',
            'boss_titan_whale': 'assets/boss_titan_whale.png',
            'boss_titan_serpent': 'assets/boss_titan_serpent.png',
            'boss_titan_shark': 'assets/boss_titan_shark.png',
            'boss_titan_dragon': 'assets/boss_titan_dragon.png',
            'boss_gg': 'assets/boss_gg.png',
            'fish_cyber_shark': 'assets/fish_cyber_shark.png',
            'fish_bio_piranha': 'assets/fish_bio_piranha.png',
            'fish_tech_angler': 'assets/fish_tech_angler.png',
            'fish_railgun_swordfish': 'assets/fish_railgun_swordfish.png',
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

    public static playSound(type: string, rate: number = 1, duration?: number, noOverlap: boolean = false): void {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        // 额外的限频节流（避免同一帧/短时间内被多处逻辑反复触发）
        const nowSec = this.audioCtx.currentTime;
        const throttleSec =
            type === 'lightning' ? 0.20 :
            type === 'shoot'     ? 0.03 :
            0;
        if (throttleSec > 0) {
            const nextOk = this.soundNextAllowedAt[type] ?? 0;
            if (nowSec < nextOk) return;
            this.soundNextAllowedAt[type] = nowSec + throttleSec;
        }

        // 优先播放真实音频 buffer
        if (this.soundBuffers[type]) {
            const now = this.audioCtx.currentTime;
            // noOverlap: 若上次仍在播放则跳过，实现持续电流效果
            if (noOverlap && this.soundEndTimes[type] > now) return;
            const src = this.audioCtx.createBufferSource();
            src.buffer = this.soundBuffers[type];
            src.playbackRate.value = rate;
            const gain = this.audioCtx.createGain();
            // 闪电音效更刺耳，默认压低音量
            gain.gain.value =
                type === 'lightning' ? 0.18 :
                type === 'shoot'     ? 0.60 :
                0.40;
            src.connect(gain);
            gain.connect(this.audioCtx.destination);
            const playDuration = duration ?? src.buffer.duration;
            this.soundEndTimes[type] = now + playDuration / rate;
            try {
                // 某些环境下传入 undefined 作为 duration 会抛错，导致后续音效都失效
                if (duration === undefined) src.start(now);
                else src.start(now, 0, duration);
            } catch (e) {
                console.warn(`Sound start failed [${type}]`, e);
            }
            return;
        }

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain); gain.connect(this.audioCtx.destination);
        const now = this.audioCtx.currentTime;
        switch(type) {
            case 'shoot':
                osc.type = 'triangle'; osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.1);
                gain.gain.setValueAtTime(0.14, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
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

    /** 必须在用户手势回调中调用，确保浏览器允许播放声音 */
    public static unlockAudio(): void {
        if (!this.audioCtx || this.audioUnlocked) return;
        this.audioUnlocked = true;
        try {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            gain.gain.value = 0; // 静音解锁
            osc.connect(gain);
            gain.connect(this.audioCtx.destination);
            const now = this.audioCtx.currentTime;
            osc.start(now);
            osc.stop(now + 0.01);
        } catch (e) {
            // 解锁失败不影响后续逻辑，只是仍可能静音
        }
    }
}
