import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager } from '../SceneManager';

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

    public setType(type: string, level: number = 1): void {
        this.level = level;
        
        // 映射纹理
        const texMap: {[key: string]: string} = {
            'cannon_base': 'bullet_v2',
            'fish_tuna_mode': 'bullet_v2',
            'gatling': 'bullet_v2',
            'heavy': 'bullet_v2',
            'lightning': 'bullet_v2'
        };
        
        this.texture = AssetManager.textures[texMap[type] || 'bullet_v2'];
        
        // 针对带黑底的生成图应用滤色混合模式，去除黑边，保留发光
        this.blendMode = PIXI.BLEND_MODES.SCREEN;
        
        // 基础数值
        let baseSpeed = 12;
        let baseDmg = 1;
        
        switch(type) {
            case 'fish_tuna_mode': baseSpeed = 10; baseDmg = 1.5; break;
            case 'gatling': baseSpeed = 18; baseDmg = 1.2; break; // 恢复加特林的基础威力
            case 'heavy': baseSpeed = 8; baseDmg = 12; break;
            case 'lightning': baseSpeed = 25; baseDmg = 0.8; break; // 降低基础威力至 0.8
        }

        const dmgTalent = (window as any).TalentDmgMult || 1.0;
        const speedTalent = (window as any).TalentSpeedMult || 1.0;

        // 等级加成：每级增加 50% 伤害，20% 速度，15% 尺寸
        const bonus = (level - 1);
        this.speed = baseSpeed * (1 + bonus * 0.2) * speedTalent;
        // 整体伤害
        this.damage = baseDmg * (1 + bonus * 0.4) * 2 * dmgTalent;
        
        // 关键修复：由于生成图分辨率极高(1024)，必须强制缩放到合理的像素尺寸(30px)
        const targetSize = 30 * (1 + bonus * 0.15);
        const s = targetSize / (this.texture.width || 1024);
        this.scale.set(s);
    }

    public fire(x: number, y: number, angle: number): void {
        const offset = 60; // 枪口偏移量，确保子弹从前端射出
        this.x = x + Math.cos(angle) * offset;
        this.y = y + Math.sin(angle) * offset;
        this.rotation = angle;
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
