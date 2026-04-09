import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Fish extends PIXI.Sprite {
    public hp: number = 10;
    public maxHp: number = 10;
    public speed: number = 2;
    public isActive: boolean = false;
    private side: 'left' | 'right' = 'left';
    private swayTimer: number = 0;
    private hitTimer: number = 0;
    private dashTimer: number = 0;
    private originalSpeed: number = 2;
    private behavior: 'swim' | 'dash' | 'orbit' = 'swim';
    private baseScaleY: number = 1;

    public isBoss: boolean = false;

    private static _sharedFilter: PIXI.Filter;

    constructor() {
        super();
        this.anchor.set(0.5);
        
        if (!Fish._sharedFilter) {
            const shaderFrag = `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform float uHitEffect;

                void main(void) {
                    vec4 color = texture2D(uSampler, vTextureCoord);
                    
                    // 1. 动态背景剔除 (黑白两用)
                    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    if (luma < 0.12 || (color.r > 0.96 && color.g > 0.96 && color.b > 0.96)) {
                        discard;
                    }

                    // 2. 真实受击表现：不再是简单的变白，而是曝光增强 (Overexposure) + 红色高热 (Red Tint)
                    if(uHitEffect > 0.05) {
                        // 增加曝光，使本体发亮但保留轮廓
                        color.rgb *= (1.0 + uHitEffect * 1.5);
                        // 混入红色，模拟机械受损、电路短路的红光
                        color.r += uHitEffect * 0.4;
                        color.g -= uHitEffect * 0.2;
                        color.b -= uHitEffect * 0.2;
                    }
                    
                    gl_FragColor = color;
                }
            `;
            Fish._sharedFilter = new PIXI.Filter(undefined, shaderFrag, {
                uHitEffect: 0
            });
        }
        this.filters = [Fish._sharedFilter];
    }

    public spawn(x: number, y: number, side: 'left' | 'right', isBoss: boolean = false): void {
        this.x = x;
        this.y = y;
        this.side = side;
        this.swayTimer = Math.random() * Math.PI * 2;
        this.hitTimer = 0;
        this.dashTimer = 0;
        this.behavior = 'swim';
        this.isBoss = isBoss;
        
        this.filters = [Fish._sharedFilter];

        const mapMult = (window as any).DmgMultCurrent || 1.0;
        this.originalSpeed = (Math.random() * 2 + 1) * 0.6;

        if (isBoss) {
            const bossType = Math.random();
            if (bossType < 0.4) {
                this.texture = AssetManager.textures['fish_dragon'] || AssetManager.textures['fish_shark'];
                this.hp = 120 * 40;
                this.originalSpeed *= 1.4;
                this.scale.set(6.0 * (150 / this.texture.width));
            } else if (bossType < 0.7) {
                this.texture = AssetManager.textures['fish_kraken'] || AssetManager.textures['fish_shark'];
                this.hp = 200 * 40;
                this.originalSpeed *= 0.5;
                this.scale.set(8.0 * (150 / this.texture.width));
            } else {
                this.texture = AssetManager.textures['fish_shark'];
                this.hp = 100 * 40;
                this.scale.set(5.0 * (150 / this.texture.width));
            }
        } else {
            const speciesRand = Math.random();
            if (speciesRand < 0.3) {
                this.texture = AssetManager.textures['fish_angler']; 
                this.hp = 2;
                this.originalSpeed *= 1.8;
                this.scale.set(0.6 * (100 / this.texture.width));
            } else if (speciesRand < 0.6) {
                this.texture = AssetManager.textures['fish_jelly'];
                this.hp = 5;
                this.originalSpeed *= 0.8;
                this.scale.set(1.0 * (100 / this.texture.width));
            } else if (speciesRand < 0.85) {
                this.texture = AssetManager.textures['fish_tuna'];
                this.hp = 10;
                this.scale.set(1.4 * (100 / this.texture.width));
            } else {
                this.texture = AssetManager.textures['fish_shark'];
                this.hp = 30;
                this.originalSpeed *= 0.6;
                this.scale.set(2.2 * (100 / this.texture.width));
            }
        }

        this.hp *= mapMult;
        this.maxHp = this.hp;
        this.speed = this.originalSpeed;
        this.baseScaleY = Math.abs(this.scale.y);

        if (this.side === 'left') {
            this.scale.x = -Math.abs(this.scale.x);
        } else {
            this.scale.x = Math.abs(this.scale.x);
        }

        this.isActive = true;
        this.visible = true;
    }

    public update(delta: number): void {
        if (!this.isActive) return;

        this.swayTimer += delta * 0.05;
        const sway = Math.sin(this.swayTimer) * 2;

        let hitShakeX = 0;
        let hitShakeY = 0;
        if (this.hitTimer > 0) {
            this.hitTimer -= delta;
            
            // 物理上的抖动（真实的受击振幅）
            hitShakeX = (Math.random() - 0.5) * 12;
            hitShakeY = (Math.random() - 0.5) * 12;
            
            const pulse = 1 + Math.sin(this.hitTimer * 0.8) * 0.2;
            this.scale.y = this.baseScaleY * pulse;

            // 注意：更新 uniform 以表现渐变的着色器效果
            Fish._sharedFilter.uniforms.uHitEffect = this.hitTimer / 15;
            
            if (this.hitTimer <= 0) {
                this.scale.y = this.baseScaleY;
                Fish._sharedFilter.uniforms.uHitEffect = 0;
            }
        }

        if (this.behavior === 'swim') {
            this.x += (this.side === 'left' ? 1 : -1) * this.speed * delta + hitShakeX;
            this.y += sway * 0.5 + hitShakeY;
        }

        if (this.hitTimer <= 0) {
            this.scale.y = this.baseScaleY + Math.sin(this.swayTimer) * 0.05;
        }

        if (this.x < -300 || this.x > 1580 || this.y < -300 || this.y > 1020) {
            this.kill();
        }
    }

    public takeDamage(dmg: number): boolean {
        this.hp -= dmg;
        this.hitTimer = 15; 
        if (this.hp <= 0) {
            this.kill();
            return true;
        }
        return false;
    }

    public kill(): void {
        this.isActive = false;
        this.visible = false;
    }
}
