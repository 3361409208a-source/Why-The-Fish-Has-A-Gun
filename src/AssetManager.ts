import * as PIXI from 'pixi.js';
import { wxTimer } from './utils/wxTimer';

/**
 * 资产管理器
 */
export class AssetManager {
    public static textures: { [key: string]: PIXI.Texture } = {};
    private static audioCtx: AudioContext | null = null;
    private static soundBuffers: { [key: string]: AudioBuffer } = {};
    /** 微信端：InnerAudioContext 池（射击等高频音效需多实例） */
    private static wxSoundPools: { [key: string]: any[] } = {};
    private static soundEndTimes: { [key: string]: number } = {};
    private static soundNextAllowedAt: { [key: string]: number } = {};
    private static audioUnlocked: boolean = false;
    private static readonly IS_WECHAT = import.meta.env.MODE === 'wechat';
    /** 贴图最长边上限（微信真机防 OOM，H5 略宽松） */
    private static readonly MAX_TEX_EDGE = import.meta.env.MODE === 'wechat' ? 1024 : 2048;
    private static readonly loadingKeys = new Set<string>();

    /** 启动必载：大厅 + 基础战斗 */
    private static readonly CORE_ASSETS: Record<string, string> = {
        'bg_ocean': 'bg_v2.png',
        'cannon_v3': 'cannon_v3.png',
        'bullet_v2': 'bullet_v2.png',
        'map_normal': 'map_normal.png',
        'map_hard': 'map_hard.png',
        'map_lunatic': 'map_lunatic.png',
        'fish_tuna': 'fish_v2.png',
        'fish_angler': 'fish_angler.png',
        'fish_shark': 'fish_shark.png',
        'fish_jelly': 'fish_jelly.png',
        'fish_dragon': 'fish_dragon_serpentine.png',
        'fish_kraken': 'fish_kraken.png',
        'skin_gatling': 'skin_gatling.png',
        'skin_heavy': 'skin_heavy.png',
        'skin_tuna': 'skin_tuna.png',
        'skin_lightning': 'skin_lightning.png',
    };

    /** 按需加载：Boss / 特殊鱼 / 商城皮肤（微信不在首屏全载） */
    private static readonly LAZY_ASSETS: Record<string, string> = {
        'boss_leviathan': 'boss_leviathan.png',
        'boss_whale': 'boss_whale.png',
        'boss_crab': 'boss_crab.png',
        'boss_manta': 'boss_manta.png',
        'boss_titan_whale': 'boss_titan_whale.png',
        'boss_titan_serpent': 'boss_titan_serpent.png',
        'boss_titan_shark': 'boss_titan_shark.png',
        'boss_titan_dragon': 'boss_titan_dragon.png',
        'boss_gg': 'boss_gg.png',
        'fish_cyber_shark': 'fish_cyber_shark.png',
        'fish_bio_piranha': 'fish_bio_piranha.png',
        'fish_tech_angler': 'fish_tech_angler.png',
        'fish_railgun_swordfish': 'fish_railgun_swordfish.png',
        'fish_cyber_salmon': 'fish_cyber_salmon.png',
        'fish_bio_pufferfish': 'fish_bio_pufferfish.png',
        'fish_armored_barracuda': 'fish_armored_barracuda.png',
        'fish_cyber_tetra': 'fish_cyber_tetra.png',
        'fish_scifi_stingray': 'fish_scifi_stingray.png',
        'skin_railgun': 'skin_railgun.png',
        'skin_void': 'skin_void.png',
        'skin_acid': 'skin_acid.png',
    };

    /** COS 未上传时，用已存在的贴图键名替代（值须是 assetsToLoad 里能成功加载的 key） */
    private static readonly TEXTURE_FALLBACK: Record<string, string> = {
        'boss_leviathan': 'fish_kraken',
        'boss_whale': 'fish_shark',
        'boss_crab': 'fish_angler',
        'boss_manta': 'fish_jelly',
        'boss_titan_whale': 'fish_kraken',
        'boss_titan_serpent': 'fish_dragon',
        'boss_titan_shark': 'fish_shark',
        'boss_titan_dragon': 'fish_dragon',
        'boss_gg': 'fish_shark',
        'fish_cyber_shark': 'fish_shark',
        'fish_bio_piranha': 'fish_tuna',
        'fish_tech_angler': 'fish_angler',
        'fish_railgun_swordfish': 'fish_shark',
        'fish_cyber_salmon': 'fish_tuna',
        'fish_bio_pufferfish': 'fish_jelly',
        'fish_armored_barracuda': 'fish_shark',
        'fish_cyber_tetra': 'fish_tuna',
        'fish_scifi_stingray': 'fish_jelly',
    };

    public static async init(renderer: PIXI.Renderer, onProgress?: (p: number) => void): Promise<void> {
        console.log('Starting asset initialization...');

        try {
            this.generateTextures(renderer);
            this.initWebAudio();
            await Promise.all([
                this.loadExternalAssets(onProgress),
                this.loadSounds().catch((e) => console.warn('Sound init skipped:', e)),
            ]);
            this.logTextureMemory('init done');
            console.log('Asset Manager Initialized Successfully');
        } catch (error: any) {
            console.error('Critical Asset Loading Error:', error.message);
        }
    }

    /** 浏览器 Web Audio；微信小游戏无 AudioContext，走 wx.createInnerAudioContext */
    private static initWebAudio(): void {
        if (this.IS_WECHAT || this.audioCtx) return;
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (typeof AC !== 'function') return;
        try {
            this.audioCtx = new AC();
        } catch (e) {
            console.warn('Web Audio unavailable:', e);
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
            'shoot': 'https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/Boom.mp3',
            'lightning': 'https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/dianjijizhong.mp3',
        };

        if (this.IS_WECHAT) {
            const wx = (window as any).wx;
            if (typeof wx?.createInnerAudioContext !== 'function') return;
            for (const [key, url] of Object.entries(soundMap)) {
                const poolSize = key === 'shoot' ? 2 : 1;
                this.wxSoundPools[key] = [];
                for (let i = 0; i < poolSize; i++) {
                    const ctx = wx.createInnerAudioContext();
                    ctx.src = url;
                    ctx.autoplay = false;
                    this.wxSoundPools[key].push(ctx);
                }
            }
            return;
        }

        if (!this.audioCtx) return;
        await Promise.all(Object.entries(soundMap).map(async ([key, url]) => {
            try {
                const res = await fetch(url);
                const buf = await res.arrayBuffer();
                this.soundBuffers[key] = await this.audioCtx!.decodeAudioData(buf);
            } catch (e) {
                console.warn(`Sound load failed [${key}]:`, e);
            }
        }));
    }

    private static async loadExternalAssets(onProgress?: (p: number) => void): Promise<void> {
        // 编译时常量：微信模式用 COS，H5 模式用本地路径
        // 使用 import.meta.env.MODE 而非运行时 isWX，让 Rollup DCE 消除死代码
        const IS_WECHAT_BUILD = import.meta.env.MODE === 'wechat';
        const REMOTE_BASE = "https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/";

        const getPath = (p: string) => {
            if (IS_WECHAT_BUILD) {
                return REMOTE_BASE + p;
            }
            return "./assets/" + p;
        };

        const assetsToLoad = IS_WECHAT_BUILD
            ? { ...this.CORE_ASSETS }
            : { ...this.CORE_ASSETS, ...this.LAZY_ASSETS };

        await this.loadAssetMap(assetsToLoad, onProgress);
        this.applyTextureFallbacks();
    }

    /** 按需加载贴图（关卡页 / 商城等进入前调用） */
    public static async ensureTextures(keys: string[]): Promise<void> {
        const map: Record<string, string> = {};
        for (const key of keys) {
            if (this.textures[key]?.baseTexture?.valid && this.textures[key] !== PIXI.Texture.WHITE) continue;
            const path = this.LAZY_ASSETS[key] ?? this.CORE_ASSETS[key];
            if (path) map[key] = path;
        }
        if (Object.keys(map).length === 0) return;
        await this.loadAssetMap(map);
        this.applyTextureFallbacks();
    }

    private static logTextureMemory(tag: string): void {
        let px = 0;
        let n = 0;
        for (const t of Object.values(this.textures)) {
            if (!t?.baseTexture?.valid) continue;
            const w = t.width || 0;
            const h = t.height || 0;
            if (w <= 0 || h <= 0) continue;
            px += w * h;
            n++;
        }
        const mb = ((px * 4) / (1024 * 1024)).toFixed(1);
        console.log(`[Asset] ${tag}: ${n} textures, ~${mb}MB RGBA (估算)`);
    }

    private static downscaleImageSource(img: { width: number; height: number }): HTMLCanvasElement | typeof img {
        const maxEdge = this.MAX_TEX_EDGE;
        const iw = img.width;
        const ih = img.height;
        if (Math.max(iw, ih) <= maxEdge) return img as HTMLCanvasElement;

        const scale = maxEdge / Math.max(iw, ih);
        const tw = Math.max(1, Math.floor(iw * scale));
        const th = Math.max(1, Math.floor(ih * scale));

        let canvas: HTMLCanvasElement;
        const wx = (globalThis as any).wx;
        if (typeof wx?.createOffscreenCanvas === 'function') {
            canvas = wx.createOffscreenCanvas({ type: '2d', width: tw, height: th }) as HTMLCanvasElement;
        } else if (typeof document !== 'undefined') {
            canvas = document.createElement('canvas');
            canvas.width = tw;
            canvas.height = th;
        } else {
            return img as HTMLCanvasElement;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return img as HTMLCanvasElement;
        ctx.drawImage(img as CanvasImageSource, 0, 0, tw, th);
        return canvas;
    }

    private static textureFromImage(img: { width: number; height: number }, key: string): PIXI.Texture {
        const source = this.downscaleImageSource(img);
        const resource = new PIXI.ImageResource(source as any);
        const base = new PIXI.BaseTexture(resource, {
            alphaMode: PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA,
            resolution: 1,
        });
        const t = new PIXI.Texture(base);
        if (!PIXI.Cache.has(key)) PIXI.Texture.addToCache(t, key);
        return t;
    }

    private static async loadAssetMap(
        assetsToLoad: Record<string, string>,
        onProgress?: (p: number) => void
    ): Promise<void> {
        const IS_WECHAT_BUILD = import.meta.env.MODE === 'wechat';
        const REMOTE_BASE = 'https://yu-1330371299.cos.ap-guangzhou.myqcloud.com/';
        const getPath = (p: string) => (IS_WECHAT_BUILD ? REMOTE_BASE + p : './assets/' + p);

        const total = Object.keys(assetsToLoad).length;
        let loaded = 0;

        const loadPromises = Object.entries(assetsToLoad).map(async ([key, path]) => {
            if (this.loadingKeys.has(key)) return;
            this.loadingKeys.add(key);
            const finalPath = getPath(path);
            try {
                let tex: PIXI.Texture;

                if (IS_WECHAT_BUILD) {
                    // 微信环境下，最稳妥的是手动 wx.createImage
                    tex = await new Promise<PIXI.Texture>((resolve, reject) => {
                        const img = (window as any).wx.createImage();
                        const timeoutId = wxTimer.setTimeout(() => {
                            img.onload = null; img.onerror = null;
                            reject(new Error('Texture Load Timeout: ' + key));
                        }, 15000);

                        try {
                            Object.defineProperty(img, 'tagName', { value: 'IMG', writable: true, configurable: true });
                        } catch (e) { }

                        img.onload = () => {
                            wxTimer.clearTimeout(timeoutId);
                            resolve(this.textureFromImage(img, key));
                        };
                        img.onerror = reject;
                        img.src = finalPath;
                    });
                } else {
                    // 浏览器环境下：双层探测逻辑
                    let currentTex: PIXI.Texture;
                    try {
                        currentTex = PIXI.Texture.from(finalPath);
                        if (!currentTex.baseTexture.valid) {
                            await new Promise((resolve, reject) => {
                                currentTex.baseTexture.once('loaded', () => resolve(currentTex));
                                currentTex.baseTexture.once('error', async () => {
                                    // 容错：如果 ./assets/xxx 报错，尝试根目录找
                                    const fallbackPath = `./${path}`;
                                    console.warn(`[Asset] Retry loading "${key}" from fallback: ${fallbackPath}`);
                                    const fallbackTex = PIXI.Texture.from(fallbackPath);
                                    if (fallbackTex.baseTexture.valid) {
                                        resolve(fallbackTex);
                                    } else {
                                        fallbackTex.baseTexture.once('loaded', () => resolve(fallbackTex));
                                        fallbackTex.baseTexture.once('error', () => reject(new Error(`All paths failed for ${key}`)));
                                    }
                                });
                            });
                        }
                        tex = currentTex;
                    } catch (e) {
                        throw e;
                    }
                }

                this.textures[key] = tex;
                PIXI.Texture.addToCache(tex, key);
                loaded++;
                if (onProgress) onProgress(loaded / total);
            } catch (err: any) {
                const fb = this.TEXTURE_FALLBACK[key];
                console.warn(
                    `[Asset] "${key}" load failed, will try fallback${fb ? ` -> "${fb}"` : ''}: ${finalPath}`,
                    err.message
                );
                this.textures[key] = PIXI.Texture.WHITE;
                loaded++;
                if (onProgress) onProgress(loaded / total);
            }
        });

        await Promise.all(loadPromises);
    }

    /** 加载结束后，用已成功贴图替换 WHITE 占位 */
    private static applyTextureFallbacks(): void {
        for (const [key, fallbackKey] of Object.entries(this.TEXTURE_FALLBACK)) {
            const cur = this.textures[key];
            const needFallback = !cur || cur === PIXI.Texture.WHITE || !cur.baseTexture?.valid;
            const alt = this.textures[fallbackKey];
            if (needFallback && alt && alt !== PIXI.Texture.WHITE && alt.baseTexture?.valid) {
                this.textures[key] = alt;
                if (!PIXI.Cache.has(key)) PIXI.Texture.addToCache(alt, key);
                console.log(`[Asset] Fallback applied: ${key} <- ${fallbackKey}`);
            }
        }
    }

    private static playWxSound(type: string, rate: number, noOverlap: boolean): void {
        const pool = this.wxSoundPools[type];
        if (!pool?.length) return;

        const nowSec = Date.now() / 1000;
        const throttleSec =
            type === 'lightning' ? 0.20 :
                type === 'shoot' ? 0.03 :
                    0;
        if (throttleSec > 0) {
            const nextOk = this.soundNextAllowedAt[type] ?? 0;
            if (nowSec < nextOk) return;
            this.soundNextAllowedAt[type] = nowSec + throttleSec;
        }
        if (noOverlap && this.soundEndTimes[type] > nowSec) return;

        const ctx = pool.find((a) => !a.__playing) ?? pool[Math.floor(Math.random() * pool.length)];
        try {
            ctx.stop();
            ctx.playbackRate = rate;
            ctx.volume =
                type === 'lightning' ? 0.18 :
                    type === 'shoot' ? 0.60 :
                        0.40;
            ctx.__playing = true;
            const estDuration = type === 'lightning' ? 0.18 : 0.3;
            this.soundEndTimes[type] = nowSec + estDuration / rate;
            ctx.play();
            const clearPlaying = () => { ctx.__playing = false; };
            if (typeof ctx.offEnded === 'function') ctx.offEnded(clearPlaying);
            if (typeof ctx.onEnded === 'function') ctx.onEnded(clearPlaying);
            else wxTimer.setTimeout(clearPlaying, (estDuration / rate) * 1000 + 50);
        } catch (e) {
            console.warn(`WX sound play failed [${type}]`, e);
        }
    }

    public static playSound(type: string, rate: number = 1, duration?: number, noOverlap: boolean = false): void {
        if (this.IS_WECHAT) {
            this.playWxSound(type, rate, noOverlap);
            return;
        }
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        // 额外的限频节流（避免同一帧/短时间内被多处逻辑反复触发）
        const nowSec = this.audioCtx.currentTime;
        const throttleSec =
            type === 'lightning' ? 0.20 :
                type === 'shoot' ? 0.03 :
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
                    type === 'shoot' ? 0.60 :
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
        switch (type) {
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

    /** 必须在用户手势回调中调用，确保浏览器/微信允许播放声音 */
    public static unlockAudio(): void {
        if (this.audioUnlocked) return;
        this.audioUnlocked = true;
        if (this.IS_WECHAT) return;
        if (!this.audioCtx) return;
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
