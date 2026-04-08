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
            'cannon_base': 'bullet_laser',
            'fish_tuna_mode': 'bullet_plasma',
            'gatling': 'bullet_gatling',
            'heavy': 'bullet_heavy',
            'lightning': 'bullet_lightning'
        };
        
        this.texture = AssetManager.textures[texMap[type] || 'bullet_laser'];
        
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
        this.damage = baseDmg * (1 + bonus * 0.4);
        this.scale.set(1 + bonus * 0.15);
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
