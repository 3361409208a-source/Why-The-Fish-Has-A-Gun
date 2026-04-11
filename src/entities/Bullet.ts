import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager } from '../SceneManager';
import { getWeapon } from '../config/weapons.config';
import { BULLET_LEVEL } from '../config/balance.config';
import type { Fish } from './Fish';

export class Bullet extends PIXI.Sprite {
    public isActive: boolean = false;
    public damage: number = 1;
    public level: number = 1;
    private speed: number = 10;
    private vx: number = 0;
    private vy: number = 0;
    private trailTimer: number = 0;
    public weaponType: string = '';
    public targetFish: Fish | null = null;
    public hitDistance: number = Infinity;
    public hasHit: boolean = false;
    /** 穿透技能：已命中的鱼列表，避免重复命中 */
    public hitFishList: Fish[] = [];
    /** 是否为分裂弹产生的小子弹 */
    public isSplitBullet: boolean = false;
    /** 分裂弹追踪目标（自动追击最近的鱼） */
    public homingTarget: Fish | null = null;
    /** 追踪转向速率（弧度/帧） */
    private static readonly HOMING_TURN_RATE = 0.08;
    private fireAngle: number = 0;
    private arcGfx: PIXI.Graphics | null = null;

    constructor() {
        super(AssetManager.textures['bullet_v2']);
        this.anchor.set(0.5);
    }

    public setType(type: string, level: number = 1, dmgMult: number = 1.0, speedMult: number = 1.0): void {
        this.weaponType = type;
        this.level = level;

        const def = getWeapon(type);
        const baseSpeed = def?.baseSpeed ?? 12;
        const baseDmg = def?.baseDamage ?? 1;
        const bulletKey = def?.bulletKey ?? 'bullet_v2';

        if (type === 'lightning') {
            this.texture = PIXI.Texture.EMPTY;
            this.alpha = 1;
            if (!this.arcGfx) {
                this.arcGfx = new PIXI.Graphics();
                this.arcGfx.blendMode = PIXI.BLEND_MODES.ADD;
                this.addChild(this.arcGfx);
            }
            this.arcGfx.visible = true;
            this.arcGfx.alpha = 1;
            this.arcGfx.clear();
            this.scale.set(1);
            this.alpha = 1;
        } else {
            this.alpha = 1;
            this.texture = AssetManager.textures[bulletKey] || AssetManager.textures['bullet_v2'];
            this.blendMode = PIXI.BLEND_MODES.NORMAL;
            if (this.arcGfx) this.arcGfx.visible = false;
            let targetSize = BULLET_LEVEL.baseSize * (1 + (level - 1) * BULLET_LEVEL.sizePerLevel);
            if (type === 'void') targetSize *= 2.5;
            if (type === 'heavy') {
                targetSize *= 2.2; // 核能弹头体积巨大
                this.tint = 0xffdf00;
            } else {
                this.tint = 0xffffff;
            }
            this.scale.set(targetSize / (this.texture.width || 1024) * 1.5);
            this.blendMode = PIXI.BLEND_MODES.ADD;
        }

        const bonus = level - 1;
        // 修复严重Bug：原来的写法导致等级增加的固定伤害(10)不吃武器的 baseDmg 乘区
        // 从而导致所有低射速、高单发伤害的武器（如重型火炮、闪电、轨道炮）升级时收益极低（跟没升级一样）
        const rawBulletDmg = BULLET_LEVEL.damageBase + bonus * BULLET_LEVEL.damagePerLevel;
        this.damage = baseDmg * rawBulletDmg * dmgMult;
        this.speed = baseSpeed * speedMult * (1 + bonus * BULLET_LEVEL.speedPerLevel);
    }

    public fire(x: number, y: number, angle: number, target?: Fish, hitDistance?: number): void {
        this.fireAngle = angle;
        this.targetFish = target || null;
        this.hitDistance = hitDistance ?? Infinity;

        if (this.weaponType === 'lightning') {
            // 闪电子弹即刻实例化在发射源（一般为炮管口），像真正的纯直线射线，不再强行绑定和追踪炮身动画
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.rotation = 0;

            if (this.arcGfx) {
                this.drawStraightLightningZap();
                this.arcGfx.alpha = 1;
            }
        } else {
            // 普通子弹：子弹本体直接从炮眼出发
            this.x = x;
            this.y = y;
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
            this.rotation = angle + Math.PI / 2;
        }
        this.isActive = true;
        this.visible = true;
        this.trailTimer = 0;
        this.hasHit = false;
        this.hitFishList = [];
        this.isSplitBullet = false;
        this.homingTarget = null;
    }

    public update(delta: number): void {
        if (!this.isActive) {
            this.visible = false;
            return;
        }

        if (this.weaponType === 'lightning') {
            // 极短暂的视觉残留，表现为瞬发电击！没有任何拖泥带水，不再偏移
            const life = 4; // 只存活4帧
            if (this.arcGfx) {
                this.arcGfx.alpha = Math.max(0, 1 - this.trailTimer / life);
            }
            if (this.trailTimer > life) {
                this.kill();
                return;
            }
        } else if (this.isSplitBullet && this.homingTarget && this.homingTarget.isActive) {
            // 分裂弹自动追击模式：朝目标转向
            const dx = this.homingTarget.x - this.x;
            const dy = this.homingTarget.y - this.y;
            const targetAngle = Math.atan2(dy, dx);
            const currentAngle = Math.atan2(this.vy, this.vx);
            // 计算最短转角
            let angleDiff = targetAngle - currentAngle;
            while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
            while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
            const turn = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), Bullet.HOMING_TURN_RATE * delta);
            const newAngle = currentAngle + turn;
            this.vx = Math.cos(newAngle) * this.speed;
            this.vy = Math.sin(newAngle) * this.speed;
            this.rotation = newAngle + Math.PI / 2;
            this.x += this.vx * delta;
            this.y += this.vy * delta;
        } else {
            // 普通子弹飞行
            this.x += this.vx * delta;
            this.y += this.vy * delta;
        }

        this.trailTimer += delta;
        if (this.weaponType !== 'lightning' && this.trailTimer > 240) {
            this.kill();
            return;
        }

        const margin = 400;
        const outOfBounds = (this.x < -margin || this.x > SceneManager.width + margin ||
            this.y < -margin || this.y > SceneManager.height + margin);
        if (outOfBounds) {
            this.kill();
        }
    }

    /** 真正笔直的瞬发闪电电弧 */
    private drawStraightLightningZap(): void {
        const g = this.arcGfx!;
        g.clear();

        // 打空穿过屏幕对角线，击中则截断在击中点
        const maxDist = Math.hypot(SceneManager.width, SceneManager.height) * 2;
        const actualDist = Math.min(this.hitDistance, maxDist);

        const cosA = Math.cos(this.fireAngle);
        const sinA = Math.sin(this.fireAngle);

        const sx = 0;
        const sy = 0;
        const ex = sx + cosA * actualDist;
        const ey = sy + sinA * actualDist;

        // 借用原版混沌随机折线的经典美感！
        const jitter = 35;
        g.lineStyle(8, 0x00ffff, 0.4);
        g.moveTo(sx, sy);
        const segments = 6;
        for (let i = 1; i <= segments; i++) {
            const tx = sx + (ex - sx) * (i / segments) + (Math.random() - 0.5) * jitter;
            const ty = sy + (ey - sy) * (i / segments) + (Math.random() - 0.5) * jitter;
            g.lineTo(tx, ty);
        }
        g.lineTo(ex, ey);

        g.lineStyle(3, 0x88eeff, 0.8);
        g.moveTo(sx, sy);
        for (let i = 1; i <= segments; i++) {
            const tx = sx + (ex - sx) * (i / segments) + (Math.random() - 0.5) * jitter;
            const ty = sy + (ey - sy) * (i / segments) + (Math.random() - 0.5) * jitter;
            g.lineTo(tx, ty);
        }
        g.lineTo(ex, ey);

        g.lineStyle(1.5, 0xffffff, 1.0);
        g.moveTo(sx, sy);
        for (let i = 1; i <= segments; i++) {
            const tx = sx + (ex - sx) * (i / segments) + (Math.random() - 0.5) * jitter;
            const ty = sy + (ey - sy) * (i / segments) + (Math.random() - 0.5) * jitter;
            g.lineTo(tx, ty);
        }
        g.lineTo(ex, ey);
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
        this.vx = 0;
        this.vy = 0;
        if (this.arcGfx) {
            this.arcGfx.clear();
            this.arcGfx.visible = false;
        }
        this.x = -1000;
        this.y = -1000;
    }
}
