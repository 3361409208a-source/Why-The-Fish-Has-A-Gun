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
    private originX: number = 0;
    private originY: number = 0;
    private fireAngle: number = 0;
    private arcGfx: PIXI.Graphics | null = null;
    public targetFish: Fish | null = null;  // 闪电武器：锁定主目标
    private orbitAngle: number = 0;
    public hasHit: boolean = false;

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
            this.orbitAngle = Math.random() * Math.PI * 2;
        } else {
            this.alpha = 1;
            this.texture = AssetManager.textures[bulletKey] || AssetManager.textures['bullet_v2'];
            this.blendMode = PIXI.BLEND_MODES.NORMAL;
            if (this.arcGfx) this.arcGfx.visible = false;
            let targetSize = BULLET_LEVEL.baseSize * (1 + (level - 1) * BULLET_LEVEL.sizePerLevel);
            if (type === 'void') targetSize *= 2.5;
            this.scale.set(targetSize / (this.texture.width || 1024) * 1.5); 
            this.blendMode = PIXI.BLEND_MODES.ADD; 
        }

        const bonus = level - 1;
        this.damage = (baseDmg * BULLET_LEVEL.damageBase + bonus * BULLET_LEVEL.damagePerLevel) * dmgMult;
        this.speed = baseSpeed * speedMult * (1 + bonus * BULLET_LEVEL.speedPerLevel);
    }

    public fire(x: number, y: number, angle: number, target?: Fish): void {
        this.originX = x;
        this.originY = y;
        this.fireAngle = angle;
        this.targetFish = target || null;

        if (this.weaponType === 'lightning') {
            // 环绕模式：停在炮台机身中心
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.rotation = 0;
        } else {
            // 从炮眼位置出发（调用方已传入炮眼坐标）
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
    }

    public update(delta: number): void {
        if (!this.isActive) {
            this.visible = false;
            return;
        }

        if (this.weaponType === 'lightning') {
            // 环绕模式：停在炮台中心，绘制旋转环绕电弧
            if (this.arcGfx) {
                this.drawLightningOrbit();
            }
            if (this.trailTimer > 26) {
                this.kill();
                return;
            }
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

    /** 环绕模式：围绕炮台中心绘制旋转多向电弧 */
    private drawLightningOrbit(): void {
        const g = this.arcGfx!;
        g.clear();
        this.orbitAngle += 0.10;

        const numArcs = 5;
        const outerR = 90 + Math.sin(this.orbitAngle * 2.3) * 18;

        for (let i = 0; i < numArcs; i++) {
            const angle = this.orbitAngle + (i * Math.PI * 2 / numArcs);
            const ex = Math.cos(angle) * outerR;
            const ey = Math.sin(angle) * outerR;
            this.drawOrbitSegment(g, ex, ey);
        }

        // 中心发光点
        g.beginFill(0x00ffff, 0.35);
        g.drawCircle(0, 0, 14);
        g.endFill();
        g.beginFill(0xffffff, 0.8);
        g.drawCircle(0, 0, 5);
        g.endFill();
    }

    private drawOrbitSegment(g: PIXI.Graphics, ex: number, ey: number): void {
        const dist = Math.sqrt(ex * ex + ey * ey);
        if (dist < 2) return;
        const pnX = -ey / dist;
        const pnY =  ex / dist;

        const segments = 5;
        const pts: [number, number][] = [[0, 0]];
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const off = (Math.random() - 0.5) * 22;
            pts.push([ex * t + pnX * off, ey * t + pnY * off]);
        }
        pts.push([ex, ey]);

        g.lineStyle(9, 0x00ffff, 0.18);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);

        g.lineStyle(3.5, 0x88eeff, 0.75);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);

        g.lineStyle(1.5, 0xffffff, 1.0);
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    }

    /** 特斯拉线圈模式：绘制从炮台到当前位置（目标）的电弧（保留备用） */
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
