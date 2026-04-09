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
    private orbitAngle: number = 0;
    private baseScaleY: number = 1;

    public isBoss: boolean = false;

    private static _sharedFilter: PIXI.Filter;

    constructor() {
        super();
        this.anchor.set(0.5);
        
        if (!Fish._sharedFilter) {
            Fish._sharedFilter = new PIXI.Filter(undefined, `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform float uHitEffect;
                uniform float uIsBoss;

                void main() {
                    vec4 color = texture2D(uSampler, vTextureCoord);
                    // Luminance-based Discard (抠掉深色背景)
                    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    if(luma < 0.1) discard; 
                    
                    // BOSS 红色发光滤镜
                    if(uIsBoss > 0.5) {
                        color.rgb += vec3(0.5, 0.0, 0.0) * (1.0 - color.a);
                        color.r = mix(color.r, 1.0, 0.3);
                    }

                    // 受击白光
                    color.rgb = mix(color.rgb, vec4(1.0).rgb, uHitEffect);
                    gl_FragColor = color;
                }
            `, {
                uHitEffect: 0,
                uIsBoss: 0
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
        this.orbitAngle = 0;
        this.rotation = 0;
        this.isBoss = isBoss;
        
        // 注入地图难度倍率 (从 GameController 动态注入)
        const mapMult = (window as any).DmgMultCurrent || 1.0;

        // 基础速度
        this.originalSpeed = (Math.random() * 2 + 1) * 0.6;

        if (isBoss) {
            this.texture = AssetManager.textures['fish_shark'] || AssetManager.textures['fish_tuna'];
            this.hp = 100 * 40; // 这里的 40 是 BOSS 倍率
            this.scale.set(5.0 * (150 / this.texture.width));
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

        // 应用地图难度倍率
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

        // AI 行为逻辑
        this.swayTimer += delta * 0.05;
        const sway = Math.sin(this.swayTimer) * 2;

        if (this.behavior === 'swim') {
            this.x += (this.side === 'left' ? 1 : -1) * this.speed * delta;
            this.y += sway * 0.5;
            
            if (Math.random() < 0.005) {
                this.behavior = 'dash';
                this.dashTimer = 30;
            }
        } else if (this.behavior === 'dash') {
            this.x += (this.side === 'left' ? 3 : -3) * this.speed * delta;
            this.dashTimer -= delta;
            if (this.dashTimer <= 0) this.behavior = 'swim';
        }

        // 呼吸感缩放
        this.scale.y = this.baseScaleY + Math.sin(this.swayTimer) * 0.05;

        // 受击闪烁恢复
        if (this.hitTimer > 0) {
            this.hitTimer -= delta;
            if (this.hitTimer <= 0) {
                this.filters = [Fish._sharedFilter];
                Fish._sharedFilter.uniforms.uHitEffect = 0;
            }
        }

        // 边界检查
        if (this.x < -300 || this.x > 1580 || this.y < -300 || this.y > 1020) {
            this.kill();
        }
    }

    public takeDamage(dmg: number): boolean {
        this.hp -= dmg;
        this.hitTimer = 5;
        Fish._sharedFilter.uniforms.uHitEffect = 0.8;
        Fish._sharedFilter.uniforms.uIsBoss = this.isBoss ? 1.0 : 0.0;
        
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
