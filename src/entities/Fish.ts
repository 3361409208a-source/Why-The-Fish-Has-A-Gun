import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Fish extends PIXI.Sprite {
    public hp: number = 2;
    public maxHp: number = 2;
    public speed: number = 2;
    public originalSpeed: number = 2;
    public isActive: boolean = false;
    private baseY: number = 0;
    private baseScaleY: number = 1;
    private swayTimer: number = 0;
    private side: 'left' | 'right' = 'right';
    private isBoss: boolean = false;

    private static _sharedFilter: PIXI.Filter;

    constructor() {
        super(AssetManager.textures['fish_tuna']);
        this.anchor.set(0.5);
        
        // 缩放到标准尺寸
        const targetWidth = 100;
        const scale = targetWidth / this.texture.width;
        this.scale.set(scale);

        // 利用 Pixi v7 的共享 Filter 机制优化性能
        if (!Fish._sharedFilter) {
            const shaderFrag = `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                void main(void) {
                    vec4 color = texture2D(uSampler, vTextureCoord);
                    if (color.r > 0.9 && color.g > 0.9 && color.b > 0.9) {
                        discard;
                    }
                    gl_FragColor = color;
                }
            `;
            Fish._sharedFilter = new PIXI.Filter(undefined, shaderFrag);
        }
        this.filters = [Fish._sharedFilter];
    }

    private hitTimer: number = 0;
    private behavior: 'swim' | 'circle' | 'exit' = 'swim';
    private orbitAngle: number = 0;
    private dashTimer: number = 0;

    public spawn(x: number, y: number, side: 'left' | 'right' = 'right', isBoss: boolean = false): void {
        this.x = x;
        this.y = y;
        this.baseY = y;
        this.side = side;
        this.isBoss = isBoss;
        this.swayTimer = Math.random() * Math.PI * 2;
        this.hitTimer = 0;
        this.dashTimer = 0;
        this.behavior = 'swim';
        this.orbitAngle = 0;
        this.rotation = 0;
        
        // 速度降低 70% (原速度约 1~3, 现在 0.3~0.9)
        this.originalSpeed = (Math.random() * 2 + 1) * 0.3;
        this.speed = this.originalSpeed;

        // 根据精英/BOSS 身份调整属性
        if (isBoss) {
            this.hp = 50;
            this.scale.set(4.0 * (100 / this.texture.width));
        } else {
            // 随机体型与血量
            const typeRand = Math.random();
            if (typeRand < 0.2) {
                this.hp = 8;
                this.scale.set(1.8 * (100 / this.texture.width));
            } else if (typeRand < 0.5) {
                this.hp = 3;
                this.scale.set(1.1 * (100 / this.texture.width));
            } else {
                this.hp = 1;
                this.scale.set(0.7 * (100 / this.texture.width));
            }
        }
        this.maxHp = this.hp;
        this.baseScaleY = Math.abs(this.scale.y);

        // 镜像翻转
        if (this.side === 'left') {
            this.scale.x = -Math.abs(this.scale.x);
        } else {
            this.scale.x = Math.abs(this.scale.x);
        }

        this.isActive = true;
        this.visible = true;
    }

    public get hitRadius(): number {
        // 基于缩放比例计算受击半径，基础宽度100，所以基础半径50
        return 50 * Math.abs(this.scale.x / (100 / (this.texture.width || 100)));
    }


    public update(delta: number): void {
        if (!this.isActive) return;

        // 1. 逃窜逻辑 (Panic Dash)
        if (this.dashTimer > 0) {
            this.dashTimer -= delta;
            this.speed = this.originalSpeed * 4; // 猛的一窜
            // 移除导致背景显现的 tint 逻辑
        } else {
            this.speed = this.originalSpeed;
        }

        // 2. 挣扎动画逻辑 (叠加在基础速度上)
        let moveSpeed = this.speed;
        if (this.hitTimer > 0) {
            this.hitTimer -= delta;
            this.x += (Math.random() - 0.5) * 12;
            this.y += (Math.random() - 0.5) * 12;
            const pulse = 1 + Math.sin(this.hitTimer * 0.8) * 0.2;
            this.scale.y = this.baseScaleY * pulse;
            
            // 修复：减速比由 0.1 提高到 0.5，防止完全卡住
            moveSpeed *= 0.5; 
            
            if (this.hitTimer <= 0) this.scale.y = this.baseScaleY;
        }

        // 3. AI 路径逻辑 (游动 -> 绕圈 -> 离开)
        const dir = this.side === 'right' ? -1 : 1;
        const screenEdgeStart = this.side === 'right' ? 300 : 980;
        
        switch (this.behavior) {
            case 'swim':
                this.x += dir * moveSpeed * delta;
                // 到达对侧边缘开始绕圈
                if ((this.side === 'right' && this.x < 300) || (this.side === 'left' && this.x > 980)) {
                    this.behavior = 'circle';
                    this.orbitAngle = 0;
                }
                break;
                
            case 'circle':
                this.orbitAngle += 0.05 * delta;
                const radius = 80;
                // 绕圈位移
                this.x += Math.cos(this.orbitAngle) * radius * 0.1 * delta;
                this.y += Math.sin(this.orbitAngle) * radius * 0.1 * delta;
                
                // 自动调整朝向 (绕圈时头朝前)
                this.rotation = this.orbitAngle + (this.side === 'right' ? Math.PI : 0);
                
                if (this.orbitAngle >= Math.PI * 2) {
                    this.behavior = 'exit';
                    this.rotation = 0;
                }
                break;
                
            case 'exit':
                this.x += dir * moveSpeed * delta;
                break;
        }

        // 摆动动画 (非绕圈状态下)
        if (this.behavior !== 'circle') {
            this.swayTimer += delta * 0.05;
            this.y = this.baseY + Math.sin(this.swayTimer) * 15;
            // 逃窜时不倾斜，表现冲刺感
            if (this.dashTimer <= 0) {
                this.rotation = Math.sin(this.swayTimer * 0.8) * 0.1;
            }
        }

        // 边界处理
        if (this.x < -400 || this.x > 1280 + 400) {
            this.kill();
        }
    }

    public takeDamage(dmg: number): boolean {
        this.hp -= dmg;
        this.hitTimer = 15;
        
        // 逃窜几率：血量上限越高越聪明
        if (this.maxHp >= 3 && Math.random() < 0.3) {
            this.dashTimer = 40; // 逃窜 40 帧
        }
        
        if (this.hp <= 0) return true; 
        return false;
    }



    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
