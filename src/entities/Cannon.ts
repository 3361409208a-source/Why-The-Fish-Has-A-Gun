import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Cannon extends PIXI.Sprite {
    private baseScale: number = 1;
    private fireTimer: number = 999;
    private fireDuration: number = 12;
    private fireType: string = '';
    private muzzleFlash: PIXI.Graphics;

    constructor() {
        super(AssetManager.textures['cannon_v3']);
        this.eventMode = 'static';
        this.muzzleFlash = new PIXI.Graphics();
        this.addChild(this.muzzleFlash);
        this.switchTexture('cannon_base');
    }

    public switchTexture(type: string): void {
        const skinMap: {[key: string]: string} = {
            'cannon_base': 'cannon_v3',
            'gatling': 'skin_gatling',
            'heavy': 'skin_heavy',
            'lightning': 'skin_lightning',
            'fish_tuna_mode': 'skin_tuna',
            'railgun': 'skin_railgun',
            'void': 'skin_void',
            'acid': 'skin_acid'
        };

        const textureKey = skinMap[type] || 'cannon_v3';
        const newTex = AssetManager.textures[textureKey];

        if (newTex) {
            this.texture = newTex;
        } else {
            console.warn(`Asset missing: ${textureKey}, defaulting to cannon_v3`);
            this.texture = AssetManager.textures['cannon_v3'];
        }

        const targetWidth = 180;
        const originalWidth = this.texture.width || 1024;
        this.baseScale = targetWidth / originalWidth;
        this.scale.set(this.baseScale);
        this.rotation = 0;
        this.anchor.set(0.5, 0.75);
        // 贴图已预抠图（透明 PNG），无需再做“智能抠图/去底色”滤镜处理
        this.filters = null;
    }

    /** 触发发射动效，由 WeaponSystem.fire() 调用 */
    public triggerFire(weaponType: string): void {
        this.fireType = weaponType;
        this.fireTimer = 0;
        const durations: Record<string, number> = {
            'cannon_base':    10,
            'fish_tuna_mode':  8,
            'gatling':         4,
            'heavy':          28,
            // 和闪电环绕电弧持续时间更贴合
            'lightning':      22,
            'railgun':        32,
            'void':           22,
            'acid':           14,
        };
        this.fireDuration = durations[weaponType] ?? 10;
    }

    /** 每帧调用，驱动动效 */
    public update(delta: number): void {
        if (this.fireTimer >= this.fireDuration) {
            this.scale.set(this.baseScale);
            this.muzzleFlash.clear();
            this.muzzleFlash.alpha = 0;
            return;
        }
        this.fireTimer += delta;
        const t = Math.min(1, this.fireTimer / this.fireDuration);
        this.applyFireAnim(t);
    }

    private applyFireAnim(t: number): void {
        const s = this.baseScale;
        // 弹簧函数：t=0时peak，t=1时归1
        const spring = (t: number, peak: number) =>
            1 + (peak - 1) * Math.sin(t * Math.PI);

        this.muzzleFlash.alpha = 0;

        switch (this.fireType) {
            case 'cannon_base': {
                // X轴压缩 + Y轴拉伸 → 快速回弹（后坐力感）
                this.scale.set(s * spring(t, 0.82), s * spring(t, 1.18));
                if (t < 0.35) this.drawFlash(0xffffff, 0x00aaff, 18 * (1 - t / 0.35), 1 - t / 0.35);
                break;
            }
            case 'fish_tuna_mode': {
                // 左右轻微摆动
                const wiggle = Math.sin(t * Math.PI * 3) * (1 - t) * 0.06;
                this.scale.set(s * (1 + wiggle), s * (1 - wiggle * 0.5));
                break;
            }
            case 'gatling': {
                // 极快脉冲放大
                const p = t < 0.5 ? 1 + t / 0.5 * 0.1 : 1.1 - (t - 0.5) / 0.5 * 0.1;
                this.scale.set(s * p);
                if (t < 0.4) this.drawFlash(0xffff00, 0xff8800, 12 * (1 - t / 0.4), 0.7 * (1 - t / 0.4));
                break;
            }
            case 'heavy': {
                // 强力后坐：X猛压 Y猛拉，缓慢回弹
                const recoil = t < 0.2 ? 1 - (t / 0.2) * 0.35 : 0.65 + (t - 0.2) / 0.8 * 0.35;
                const stretch = t < 0.2 ? 1 + (t / 0.2) * 0.5 : 1.5 - (t - 0.2) / 0.8 * 0.5;
                this.scale.set(s * recoil, s * stretch);
                if (t < 0.3) this.drawFlash(0xff4400, 0xff8800, 30 * (1 - t / 0.3), 1 - t / 0.3);
                break;
            }
            case 'lightning': {
                // 电弧脉冲放大 + 闪光
                const pulse = t < 0.35 ? 1 + t / 0.35 * 0.18 : 1.18 - (t - 0.35) / 0.65 * 0.18;
                this.scale.set(s * pulse);
                if (t < 0.45) this.drawFlash(0x00ffff, 0x88eeff, 28 * (1 - t / 0.45), 1 - t / 0.45);
                break;
            }
            case 'railgun': {
                // 极强后坐力 + 慢回弹 + 橙色闪光
                const recoil = t < 0.15 ? 1 - (t / 0.15) * 0.45 : 0.55 + (t - 0.15) / 0.85 * 0.45;
                const stretch = t < 0.15 ? 1 + (t / 0.15) * 0.65 : 1.65 - (t - 0.15) / 0.85 * 0.65;
                this.scale.set(s * recoil, s * stretch);
                if (t < 0.25) this.drawFlash(0xffaa00, 0xffff00, 40 * (1 - t / 0.25), 1 - t / 0.25);
                break;
            }
            case 'void': {
                // 漩涡波动 — 多次震荡衰减
                const wobble = 1 + Math.sin(t * Math.PI * 4) * 0.1 * (1 - t);
                this.scale.set(s * wobble);
                if (t < 0.3) this.drawFlash(0xcc00ff, 0xff00ff, 22 * (1 - t / 0.3), 0.9 * (1 - t / 0.3));
                break;
            }
            case 'acid': {
                // 轻微后坐 + 绿色喷射闪光
                const recoil = t < 0.3 ? 1 - (t / 0.3) * 0.12 : 0.88 + (t - 0.3) / 0.7 * 0.12;
                this.scale.set(s * recoil, s * (2 - recoil));
                if (t < 0.35) this.drawFlash(0x00ff44, 0x88ff00, 20 * (1 - t / 0.35), 0.85 * (1 - t / 0.35));
                break;
            }
        }
    }

    /** 在炮口绘制圆形发光闪光（子节点，随炮台旋转） */
    private drawFlash(inner: number, outer: number, radius: number, alpha: number): void {
        const g = this.muzzleFlash;
        g.clear();
        // 炮口位置：相对锚点向上（-Y方向，因为 anchor.y=0.75）
        const muzzleY = -this.texture.height * 0.62;
        g.beginFill(outer, 0.35).drawCircle(0, muzzleY, radius * 1.8).endFill();
        g.beginFill(inner, 0.9).drawCircle(0, muzzleY, radius).endFill();
        g.beginFill(0xffffff, 0.95).drawCircle(0, muzzleY, radius * 0.3).endFill();
        g.alpha = alpha;
    }

    public lookAt(targetX: number, targetY: number): void {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const baseAngle = Math.atan2(dy, dx);
        this.rotation = baseAngle + Math.PI / 2;
    }

    public getFireAngle(): number {
        return this.rotation - Math.PI / 2;
    }

    /** 返回炮台机身视觉中心的世界坐标（锚点 anchor.y=0.75，中心偏上 0.25*高度） */
    public getBodyCenter(): { x: number; y: number } {
        const offset = 0.25 * this.texture.height * this.scale.y;
        return {
            x: this.x + offset * Math.sin(this.rotation),
            y: this.y - offset * Math.cos(this.rotation),
        };
    }

    /** 返回炮眼（炮管顶端）的世界坐标，与 drawFlash 的 muzzleY=-height*0.62 对齐 */
    public getMuzzlePosition(): { x: number; y: number } {
        const d = this.texture.height * 0.62 * this.scale.y;
        return {
            x: this.x + d * Math.sin(this.rotation),
            y: this.y - d * Math.cos(this.rotation),
        };
    }
}
