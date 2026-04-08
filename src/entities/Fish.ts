import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Fish extends PIXI.Sprite {
    public hp: number = 2;
    public speed: number = 2;
    public isActive: boolean = false;
    private baseY: number = 0;
    private swayTimer: number = 0;
    private side: 'left' | 'right' = 'right';
    private isBoss: boolean = false;

    constructor() {
        super(AssetManager.textures['fish_tuna']);
        this.anchor.set(0.5);
        
        // 缩放到标准尺寸
        const targetWidth = 100;
        const scale = targetWidth / this.texture.width;
        this.scale.set(scale);

        // 实时扣除纯白背景 (Chroma Key 滤镜 - 升级版)
        const shaderFrag = `
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            void main(void) {
                vec4 color = texture2D(uSampler, vTextureCoord);
                // 阈值放宽到 0.9，解决边缘发白的问题
                if (color.r > 0.9 && color.g > 0.9 && color.b > 0.9) {
                    discard;
                }
                gl_FragColor = color;
            }
        `;
        const whiteFilter = new PIXI.Filter(undefined, shaderFrag);
        this.filters = [whiteFilter];
    }

    public spawn(x: number, y: number, side: 'left' | 'right' = 'right', isBoss: boolean = false): void {
        this.x = x;
        this.y = y;
        this.baseY = y;
        this.side = side;
        this.isBoss = isBoss;
        this.swayTimer = Math.random() * Math.PI * 2;
        
        // 速度降低 70% (原速度约 1~3, 现在 0.3~0.9)
        this.speed = (Math.random() * 2 + 1) * 0.3;

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

        // 根据出生方向决定游动方向
        if (this.side === 'right') {
            this.x -= this.speed * delta;
        } else {
            this.x += this.speed * delta;
        }

        // 摆动动画：上下浮动 + 轻微旋转
        this.swayTimer += delta * 0.05;
        this.y = this.baseY + Math.sin(this.swayTimer) * 15;
        this.rotation = Math.sin(this.swayTimer * 0.8) * 0.1;

        // 边界处理 (按虚拟分辨率 1280 判定)
        if (this.side === 'right' && this.x < -200) {
            this.kill();
        } else if (this.side === 'left' && this.x > 1280 + 200) {
            this.kill();
        }
    }



    public takeDamage(dmg: number): boolean {
        this.hp -= dmg;
        if (this.hp <= 0) {
            this.kill();
            return true; // 死亡
        }
        return false;
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
