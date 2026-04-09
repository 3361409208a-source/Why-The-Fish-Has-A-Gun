import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

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
            case 'gatling': baseSpeed = 18; baseDmg = 0.6; break;
            case 'heavy': baseSpeed = 8; baseDmg = 12; break;
            case 'lightning': baseSpeed = 25; baseDmg = 3; break;
        }

        // 等级加成：每级增加 50% 伤害，20% 速度，15% 尺寸
        const bonus = (level - 1);
        this.speed = baseSpeed * (1 + bonus * 0.2);
        // 整体伤害增加 100% (即伤害 x1)
        this.damage = baseDmg * (1 + bonus * 0.4) * 2;
        
        // 关键修复：由于生成图分辨率极高(1024)，必须强制缩放到合理的像素尺寸(30px)
        const targetSize = 30 * (1 + bonus * 0.15);
        const s = targetSize / (this.texture.width || 1024);
        this.scale.set(s);
    }

    public fire(x: number, y: number, angle: number): void {
        this.x = x;
        this.y = y;
        this.rotation = angle;
        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
        this.isActive = true;
        this.visible = true;
        this.trailTimer = 0;
    }

    public update(delta: number): void {
        if (!this.isActive) return;
        this.x += this.vx * delta;
        this.y += this.vy * delta;

        // 边界回收 (按虚拟分辨率 1280x720 计算)
        if (this.x < -100 || this.x > 1280 + 100 || 
            this.y < -100 || this.y > 720 + 100) {
            this.kill();
        }

    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
