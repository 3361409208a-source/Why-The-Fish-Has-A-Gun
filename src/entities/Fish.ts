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
    private originalSpeed: number = 2;

    private behaviorTimer: number = 0;
    private isDashing: boolean = false;
    private dashTargetSpeed: number = 0;
    
    // 垂直游动与漂浮策略
    private verticalVelocity: number = 0;
    private targetY: number = 0;
    private driftTimer: number = 0;

    public isBoss: boolean = false;
    public isMinion: boolean = false; // 是否为死后爆出的小崽
    public bossKey: string = '';
    private fishType: 'jelly' | 'normal' = 'normal';

    private mesh: PIXI.SimpleRope | null = null;
    private meshPoints: PIXI.Point[] = [];
    private static _sharedFilter: PIXI.Filter;

    public get width(): number { return this.mesh ? Math.abs(this.mesh.width * this.scale.x) : 0; }
    public get height(): number { return this.mesh ? Math.abs(this.mesh.height * this.scale.y) : 0; }

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
                    float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    if (luma < 0.12 || (color.r > 0.96 && color.g > 0.96 && color.b > 0.96)) discard;
                    if(uHitEffect > 0.05) {
                        color.rgb *= (1.0 + uHitEffect * 1.5);
                        color.r += uHitEffect * 0.4;
                    }
                    gl_FragColor = color;
                }
            `;
            Fish._sharedFilter = new PIXI.Filter(undefined, shaderFrag, { uHitEffect: 0 });
        }
    }

    public spawn(x: number, y: number, side: 'left' | 'right', isBoss: boolean = false, isMinion: boolean = false): void {
        this.x = x;
        this.y = y;
        this.targetY = y;
        this.side = side;
        this.swayTimer = Math.random() * Math.PI * 2;
        this.hitTimer = 0;
        this.isBoss = isBoss;
        this.isMinion = isMinion;
        this.visible = true;
        this.isDashing = isMinion; // 小崽子出生即冲刺
        this.fishType = 'normal';
        this.behaviorTimer = Math.random() * 100;
        this.verticalVelocity = 0;
        this.driftTimer = Math.random() * 100;

        if (this.mesh) {
            this.removeChild(this.mesh);
            this.mesh = null;
        }

        const mapMult = (window as any).DmgMultCurrent || 1.0;
        let tex: PIXI.Texture;
        let baseScale = 1.0;

        if (isBoss) {
            const bossType = Math.random();
            if (bossType < 0.4) {
                this.bossKey = 'dragon';
                tex = AssetManager.textures['fish_dragon'] || AssetManager.textures['fish_shark'];
                this.hp = 120 * 40; this.originalSpeed = 1.1; baseScale = 1.5 * (500 / (tex.width || 1024));
            } else if (bossType < 0.7) {
                this.bossKey = 'kraken';
                tex = AssetManager.textures['fish_kraken'] || AssetManager.textures['fish_shark'];
                this.hp = 200 * 40; this.originalSpeed = 0.4; baseScale = 3.8 * (150 / tex.width);
            } else {
                this.bossKey = 'shark';
                tex = AssetManager.textures['fish_shark'];
                this.hp = 100 * 40; this.originalSpeed = 0.6; baseScale = 3.2 * (150 / tex.width);
            }
        } else if (isMinion) {
            // 小崽子：体积只有原来的 1/4，血量极低
            this.bossKey = 'minion';
            tex = AssetManager.textures['fish_tuna']; 
            this.hp = 1;
            this.originalSpeed = 4.0 + Math.random() * 3.0; // 极速到处乱跑
            baseScale = 0.3 * (100 / tex.width);
            // 给一个小崽子随机散开的垂直目标
            this.targetY += (Math.random() - 0.5) * 400;
        } else {
            this.bossKey = '';
            const speciesRand = Math.random();
            if (speciesRand < 0.3) {
                tex = AssetManager.textures['fish_angler']; this.hp = 2;
                this.originalSpeed = 1.2; baseScale = 0.6 * (100 / tex.width);
            } else if (speciesRand < 0.6) {
                this.fishType = 'jelly'; tex = AssetManager.textures['fish_jelly']; 
                this.hp = 5; this.originalSpeed = 0.4; baseScale = 1.0 * (100 / tex.width);
            } else {
                tex = AssetManager.textures['fish_tuna']; this.hp = 10;
                this.originalSpeed = 0.8; baseScale = 1.4 * (100 / tex.width);
            }
        }

        const segmentCount = (isBoss || isMinion) ? 15 : 8;
        this.meshPoints = [];
        const segmentWidth = tex.width / (segmentCount - 1);
        for (let i = 0; i < segmentCount; i++) {
            this.meshPoints.push(new PIXI.Point(i * segmentWidth, 0));
        }
        
        this.mesh = new PIXI.SimpleRope(tex, this.meshPoints);
        this.mesh.filters = [Fish._sharedFilter];
        this.mesh.scale.set(baseScale);
        this.mesh.x = - (tex.width * baseScale) / 2;
        this.addChild(this.mesh);
        
        this.texture = PIXI.Texture.EMPTY;
        this.hp *= mapMult;
        this.maxHp = this.hp;
        this.speed = this.originalSpeed;
        this.scale.x = (this.side === 'left') ? -1 : 1;
        this.isActive = true;
    }

    public update(delta: number, nearbyFishes: Fish[] = []): void {
        if (!this.isActive) return;

        this.behaviorTimer += delta;
        this.driftTimer += delta * 0.05;

        // 集群算法 (小崽子不参加集群，它们是散兵)
        if (!this.isBoss && !this.isMinion && this.fishType !== 'jelly' && nearbyFishes.length > 0) {
            let avgY = 0; let count = 0;
            for (const other of nearbyFishes) {
                if (other === this || !other.isActive) continue;
                const d = Math.abs(other.x - this.x);
                if (d < 150) { avgY += other.y; count++; }
            }
            if (count > 0) this.targetY += ((avgY / count) - this.y) * 0.02 * delta;
        }

        // 水母逻辑
        if (this.fishType === 'jelly') {
            const pulse = (Math.sin(this.swayTimer * 2.0) + 1) / 2;
            this.speed = this.originalSpeed * (0.5 + pulse * 2.0);
            this.targetY += Math.sin(this.driftTimer * 0.5) * 1.5;
        }

        // 冲刺行为
        if (!this.isBoss && !this.isMinion && this.fishType !== 'jelly' && this.behaviorTimer > 150) {
            if (Math.random() < 0.2) {
                this.isDashing = true; 
                this.dashTargetSpeed = this.originalSpeed * (2.2 + Math.random() * 1.2);
                this.behaviorTimer = 0; this.targetY += (Math.random() - 0.5) * 200;
            } else this.behaviorTimer = 80;
        }

        if (this.isDashing) {
            const accel = this.isMinion ? 0.2 : 0.08;
            this.speed += (this.dashTargetSpeed - this.speed) * accel * delta;
            if (!this.isMinion && this.behaviorTimer > 45) this.isDashing = false;
        } else if (this.fishType !== 'jelly') {
            this.speed += (this.originalSpeed - this.speed) * 0.05 * delta;
        }

        const vAccel = (this.targetY - this.y) * 0.05;
        this.verticalVelocity = this.verticalVelocity * 0.9 + vAccel * 0.1;
        this.y += this.verticalVelocity * delta;
        this.y = Math.max(50, Math.min(670, this.y));

        let swimTickRate = (this.isDashing || this.isMinion) ? 0.25 : 0.1; 
        if (this.fishType === 'jelly') swimTickRate = 0.05;
        this.swayTimer += delta * swimTickRate;
        const t = this.swayTimer; 

        if (this.mesh) {
            const isHit = this.hitTimer > 0;
            const hitFactor = isHit ? (this.hitTimer / 15) : 0;
            
            if (this.fishType === 'jelly') {
                const pulse = (Math.sin(this.swayTimer * 3.0) + 1) / 2; 
                this.mesh.scale.x = (1.0 * (100 / this.mesh.texture.width)) * (0.8 + pulse * 0.4);
                for (let i = 0; i < this.meshPoints.length; i++) {
                    const bodyFactor = (i / this.meshPoints.length);
                    this.meshPoints[i].y = Math.sin(t * 1.5 + i * 0.8) * 15 * bodyFactor + hitFactor * 10;
                }
            } else {
                const dashFactor = (this.isDashing || this.isMinion) ? 0.8 : 0;
                const baseAmp = (this.bossKey === 'dragon' ? 40 : 12) * (1 + hitFactor * 0.2 + dashFactor * 0.5); 
                const baseFreq = (this.bossKey === 'dragon' ? 0.35 : 0.6) * (1 + dashFactor * 0.4);
                for (let i = 0; i < this.meshPoints.length; i++) {
                    this.meshPoints[i].y = Math.sin(t + i * baseFreq) * baseAmp * (0.4 + (i / this.meshPoints.length));
                }
            }
        }

        let hitShakeX = 0; let hitShakeY = 0;
        if (this.hitTimer > 0) {
            this.hitTimer -= delta;
            hitShakeX = (Math.random() - 0.5) * 12; hitShakeY = (Math.random() - 0.5) * 12;
            Fish._sharedFilter.uniforms.uHitEffect = this.hitTimer / 15;
            if (this.hitTimer <= 0) Fish._sharedFilter.uniforms.uHitEffect = 0;
        }

        this.x += (this.side === 'left' ? 1 : -1) * this.speed * delta + hitShakeX;
        this.y += hitShakeY;

        const margin = 800;
        if (this.x < -margin || this.x > 1280 + margin) this.kill();
    }

    public takeDamage(dmg: number): boolean {
        this.hp -= dmg;
        this.hitTimer = 15; 
        if (this.hp <= 0) { this.kill(); return true; }
        return false;
    }

    public kill(): void {
        this.isActive = false; this.visible = false;
        if (this.mesh) { this.removeChild(this.mesh); this.mesh = null; }
    }
}
