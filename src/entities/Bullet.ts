import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager } from '../SceneManager';
import { getWeapon } from '../config/weapons.config';
import { BULLET_LEVEL } from '../config/balance.config';

export class Bullet extends PIXI.Sprite {
    public isActive: boolean = false;
    public damage: number = 1;
    public level: number = 1;
    private speed: number = 10;
    private vx: number = 0;
    private vy: number = 0;
    private trailTimer: number = 0;

    constructor() {
        super(AssetManager.textures['bullet_laser']);
        this.anchor.set(0.5);
    }

    public setType(type: string, level: number = 1, dmgMult: number = 1.0, speedMult: number = 1.0): void {
        this.level = level;
        
        const def = getWeapon(type);
        const baseSpeed = def?.baseSpeed ?? 12;
        const baseDmg = def?.baseDamage ?? 1;
        const bulletKey = def?.bulletKey ?? 'bullet_v2';
        
        this.texture = AssetManager.textures[bulletKey] || AssetManager.textures['bullet_v2'];
        this.blendMode = PIXI.BLEND_MODES.NORMAL;

        const bonus = level - 1;
        this.damage = (baseDmg * BULLET_LEVEL.damageBase + bonus * BULLET_LEVEL.damagePerLevel) * dmgMult;
        
        let targetSize = BULLET_LEVEL.baseSize * (1 + bonus * BULLET_LEVEL.sizePerLevel);
        if (type === 'void') targetSize *= 2.5;
        
        const originalWidth = (this.texture.width || 1024);
        this.scale.set(targetSize / originalWidth);
        this.speed = baseSpeed * speedMult * (1 + bonus * BULLET_LEVEL.speedPerLevel);
    }

    public fire(x: number, y: number, angle: number): void {
        const offset = 60; // 枪口偏移量，确保子弹从前端射出
        this.x = x + Math.cos(angle) * offset;
        this.y = y + Math.sin(angle) * offset;
        // 关键修复：由于美术素材子弹头朝上，旋转时需补偿 90 度以对齐飞行方向
        this.rotation = angle + Math.PI / 2;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.isActive = true;
        this.visible = true;
        this.trailTimer = 0;
    }

    public update(delta: number): void {
        if (!this.isActive) {
            this.visible = false;
            return;
        }

        this.x += this.vx * delta;
        this.y += this.vy * delta;

        // 增加生存计时器，防止子弹由于任何原因由于碰撞或边界逻辑失效而卡在屏幕上
        this.trailTimer += delta;
        if (this.trailTimer > 240) { // 缩短到 4 秒回收
            this.kill();
            return;
        }

        // 边界回收优化：大幅度增加边界留白 (从 100 增加到 400)，防止子弹在接近边缘时过早消失
        const margin = 400;
        const outOfBounds = (this.x < -margin || this.x > SceneManager.width + margin || 
                            this.y < -margin || this.y > SceneManager.height + margin);
        
        if (outOfBounds) {
            this.kill();
        }
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
        this.vx = 0;
        this.vy = 0;
        // 瞬间移出屏幕防止视觉残留
        this.x = -1000;
        this.y = -1000;
    }
}
