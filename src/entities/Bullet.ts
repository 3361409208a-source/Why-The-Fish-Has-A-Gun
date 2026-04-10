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
    private weaponType: string = '';
    private originX: number = 0;
    private originY: number = 0;
    private fireAngle: number = 0;
    private arcGfx: PIXI.Graphics | null = null;
    private targetFish: Fish | null = null; // 特斯拉线圈模式：锁定目标

    constructor() {
        super(AssetManager.textures['bullet_laser']);
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
            // 用 PIXI.Texture.EMPTY 隐藏精灵贴图，不能用 alpha=0（会连子节点 arcGfx 一起隐藏）
            this.texture = PIXI.Texture.EMPTY;
            this.alpha = 1;
            if (!this.arcGfx) {
                this.arcGfx = new PIXI.Graphics();
                this.addChild(this.arcGfx);
            }
            this.arcGfx.visible = true;
            this.arcGfx.clear();
            this.scale.set(1);
        } else {
            this.alpha = 1;
            this.texture = AssetManager.textures[bulletKey] || AssetManager.textures['bullet_v2'];
            this.blendMode = PIXI.BLEND_MODES.NORMAL;
            if (this.arcGfx) this.arcGfx.visible = false;
            let targetSize = BULLET_LEVEL.baseSize * (1 + (level - 1) * BULLET_LEVEL.sizePerLevel);
            if (type === 'void') targetSize *= 2.5;
            this.scale.set(targetSize / (this.texture.width || 1024));
        }

        const bonus = level - 1;
        this.damage = (baseDmg * BULLET_LEVEL.damageBase + bonus * BULLET_LEVEL.damagePerLevel) * dmgMult;
        this.speed = baseSpeed * speedMult * (1 + bonus * BULLET_LEVEL.speedPerLevel);
    }

    public fire(x: number, y: number, angle: number, target?: Fish): void {
        const offset = 60;
        this.originX = x;
        this.originY = y;
        this.fireAngle = angle;
        this.targetFish = target || null;

        if (this.weaponType === 'lightning' && this.targetFish) {
            // 特斯拉线圈模式：瞬移到目标位置，不移动，持续连接
            this.x = this.targetFish.x;
            this.y = this.targetFish.y;
            this.vx = 0;
            this.vy = 0;
            this.rotation = 0; // 电弧方向由坐标计算决定，无需旋转
        } else {
            this.x = x + Math.cos(angle) * offset;
            this.y = y + Math.sin(angle) * offset;
            this.vx = Math.cos(angle) * this.speed;
            this.vy = Math.sin(angle) * this.speed;
            this.rotation = angle + Math.PI / 2;
        }
        this.isActive = true;
        this.visible = true;
        this.trailTimer = 0;
    }

    public update(delta: number): void {
        if (!this.isActive) {
            this.visible = false;
            return;
        }

        if (this.weaponType === 'lightning') {
            // 特斯拉线圈模式：跟随目标，持续电弧连接
            if (!this.targetFish || !this.targetFish.isActive) {
                this.kill();
                return;
            }
            // 跟随目标位置
            this.x = this.targetFish.x;
            this.y = this.targetFish.y;
            // 重绘从炮台到目标的电弧
            if (this.arcGfx) {
                this.drawLightningBeam();
            }
        } else {
            // 普通子弹飞行
            this.x += this.vx * delta;
            this.y += this.vy * delta;
        }

        this.trailTimer += delta;
        if (this.trailTimer > 240) {
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

    /** 特斯拉线圈模式：绘制从炮台到当前位置（目标）的电弧 */
    private drawLightningBeam(): void {
        const g = this.arcGfx!;
        g.clear();

        // 起点：炮口位置（本地坐标系）
        const sx = this.originX - this.x;
        const sy = this.originY - this.y;
        const ex = 0;
        const ey = 0;

        const dist = Math.sqrt(sx * sx + sy * sy);
        if (dist < 2) return;

        // 垂直方向单位向量（锯齿偏移用）
        const pnX = -sy / dist;
        const pnY =  sx / dist;

        // 电弧持续期间保持全亮，最后快速淡出
        const fade = this.trailTimer > 200 ? Math.max(0, 1 - (this.trailTimer - 200) / 40) : 1;
        if (fade <= 0) return;

        const segments = 10;
        const pts: [number, number][] = [[sx, sy]];
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const mx = sx * (1 - t);
            const my = sy * (1 - t);
            // 锯齿幅度与距离成正比，每帧随机变化实现电流颤动
            const off = (Math.random() - 0.5) * Math.min(50, dist * 0.25);
            pts.push([mx + pnX * off, my + pnY * off]);
        }
        pts.push([ex, ey]);

        // 外发光
        g.lineStyle(10, 0x00ffff, 0.2 * fade);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);

        // 中层蓝白电弧
        g.lineStyle(4, 0x88eeff, 0.8 * fade);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);

        // 高亮白芯
        g.lineStyle(2, 0xffffff, fade);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    }

    private drawLightningArc(): void {
        const g = this.arcGfx!;
        g.clear();

        // 电弧立即全长射出：从炮口(origin)沿发射方向延伸固定距离
        const maxDist = 750;
        const cosA = Math.cos(this.fireAngle);
        const sinA = Math.sin(this.fireAngle);

        // 起点（炮口）在本地坐标（本地原点 = 子弹当前位置）
        const sx = this.originX - this.x;
        const sy = this.originY - this.y;
        // 终点：从炮口延伸 maxDist
        const ex = sx + cosA * maxDist;
        const ey = sy + sinA * maxDist;

        // 垂直方向（锯齿偏移）
        const pnX = -sinA;
        const pnY =  cosA;

        // 透明度随时间淡出（trailTimer 60帧内全亮，之后快速衰减）
        const fade = Math.max(0, 1 - this.trailTimer / 80);
        if (fade <= 0) return;

        const segments = 9;
        const pts: [number, number][] = [[sx, sy]];
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const mx = sx + (ex - sx) * t;
            const my = sy + (ey - sy) * t;
            const off = (Math.random() - 0.5) * 40;
            pts.push([mx + pnX * off, my + pnY * off]);
        }
        pts.push([ex, ey]);

        // 外发光
        g.lineStyle(8, 0x00ffff, 0.18 * fade);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);

        // 中层蓝白
        g.lineStyle(3, 0x88eeff, 0.75 * fade);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);

        // 白芯
        g.lineStyle(1.5, 0xffffff, fade);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
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
