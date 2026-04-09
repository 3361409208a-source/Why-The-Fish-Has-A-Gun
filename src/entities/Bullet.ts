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
            'lightning': 'bullet_v2',
            'railgun': 'bullet_railgun',
            'void': 'bullet_void',
            'acid': 'bullet_acid'
        };
        
        this.texture = AssetManager.textures[texMap[type] || 'bullet_v2'];
        
        // 恢复正常混合模式
        this.blendMode = PIXI.BLEND_MODES.NORMAL;
        
        // 基础数值
        let baseSpeed = 12;
        let baseDmg = 1;
        
        switch(type) {
            case 'fish_tuna_mode': baseSpeed = 10; baseDmg = 1.5; break;
            case 'gatling': baseSpeed = 18; baseDmg = 1.2; break;
            case 'heavy': baseSpeed = 8; baseDmg = 12; break;
            case 'lightning': baseSpeed = 25; baseDmg = 0.8; break;
            case 'railgun': baseSpeed = 35; baseDmg = 50; break; // 极速，极大威力
            case 'void': baseSpeed = 5; baseDmg = 80; break;    // 慢，毁天灭地威力
            case 'acid': baseSpeed = 15; baseDmg = 40; break;   // 稳步推进
        }

        const dmgTalent = (window as any).TalentDmgMult || 1.0;
        const speedTalent = (window as any).TalentSpeedMult || 1.0;

        // 等级加成：每级增加 80% 伤害，20% 速度，15% 尺寸
        const bonus = (level - 1);
        // 核心伤害公式调整：强化初始威力至 20 左右，每级固定成长 10 点，而非整体倍率翻倍
        // 这样可以确保“初始伤害增加”的同时，后期数值不会过于崩坏
        this.damage = (baseDmg * 20 + bonus * 10) * dmgTalent;
        
        // 关键修复：子弹尺寸增加 2 倍
        let targetSize = 60 * (1 + bonus * 0.15);
        if (type === 'void') targetSize *= 2.5; // 黑洞球特别大
        
        const originalWidth = (this.texture.width || 1024);
        const s = targetSize / originalWidth;
        this.scale.set(s);
        this.speed = baseSpeed * speedTalent * (1 + bonus * 0.2);
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
