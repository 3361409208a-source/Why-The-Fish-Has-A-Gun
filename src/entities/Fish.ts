import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';
import { SceneManager, Layers } from '../SceneManager';

export class Fish extends PIXI.Sprite {
    public hp: number = 10;
    public maxHp: number = 10;
    public speed: number = 2;
    public isActive: boolean = false;
    private side: 'left' | 'right' = 'left';
    private swayTimer: number = 0;
    private hitTimer: number = 0;
    private originalSpeed: number = 2;

    // HP bar display (rendered in global UI layer for visibility)
    private hpBarBg: PIXI.Graphics | null = null;
    private hpBarFill: PIXI.Graphics | null = null;
    private hpBarText: PIXI.Text | null = null;
    private static readonly HP_BAR_WIDTH = 120;
    private static readonly HP_BAR_HEIGHT = 16;
    private static hpBarLayer: PIXI.Container | null = null;

    private behaviorTimer: number = 0;
    private isDashing: boolean = false;
    private dashTargetSpeed: number = 0;

    // 垂直游动与漂浮策略
    private verticalVelocity: number = 0;
    private targetY: number = 0;
    private driftTimer: number = 0;

    public isBoss: boolean = false;
    public isMinion: boolean = false; // 是否为死后爆出的小崽
    private vx: number = 0;
    private vy: number = 0;
    public bossKey: string = '';
    public hitRadius: number = 40; // 核心：真实的物理碰撞半径
    private fishType: 'jelly' | 'normal' = 'normal';

    private mesh: PIXI.SimpleRope | null = null;
    private meshPoints: PIXI.Point[] = [];

    public get width(): number { return this.mesh ? Math.abs(this.mesh.width * this.scale.x) : 0; }
    public get height(): number { return this.mesh ? Math.abs(this.mesh.height * this.scale.y) : 0; }

    constructor() {
        super();
        this.anchor.set(0.5);
    }

    public spawn(x: number, y: number, side: 'left' | 'right', isBoss: boolean = false, isMinion: boolean = false, forceBossKey?: string): void {
        this.x = x;
        this.y = y;
        // 目标高度：如果是上下边缘出生的，强制给一个屏幕内的目标点使其游入画面
        this.targetY = (y < 0 || y > SceneManager.height) ? (200 + Math.random() * (SceneManager.height - 400)) : y;
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
        let tex: PIXI.Texture | undefined;
        let baseScale = 1.0;

        if (isBoss) {
            const hpRoll = 0.5 + Math.random() * 0.5;
            // 关卡模式强制指定 bossKey → 映射到对应的 bossType 区间中点
            const bossKeyToType: Record<string, number> = {
                'boss_gg': 0.05, 'titan_whale': 0.15, 'titan_serpent': 0.25,
                'titan_shark': 0.35, 'titan_dragon': 0.45, 'leviathan': 0.55,
                'whale': 0.65, 'crab': 0.75, 'manta': 0.85, 'dragon': 0.95,
            };
            const bossType = (forceBossKey && bossKeyToType[forceBossKey] !== undefined)
                ? bossKeyToType[forceBossKey]
                : Math.random();
            if (bossType < 0.10) {
                this.bossKey = 'boss_gg';
                tex = AssetManager.textures['boss_gg'];
                const w = tex ? (tex.width || 1024) : 1024;
                const h = tex ? (tex.height || 1024) : 1024;
                this.hp = Math.floor(250000 * hpRoll); this.originalSpeed = 0.3; baseScale = 5.0 * (400 / w);
                // GG 修正：根据图片视觉比例，它的身体约占宽度的 65%，高度的 35%
                this.hitRadius = Math.min(w * 0.65, h * 0.35) * baseScale / 2;
            } else if (bossType < 0.20) {
                this.bossKey = 'titan_whale';
                tex = AssetManager.textures['boss_titan_whale'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(200000 * hpRoll); this.originalSpeed = 0.15; baseScale = 4.5 * (400 / w);
                this.hitRadius = (w * 0.45) * baseScale / 2; // 抹掉鲸鱼巨大的透明头部留白
            } else if (bossType < 0.30) {
                this.bossKey = 'titan_serpent';
                tex = AssetManager.textures['boss_titan_serpent'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(180000 * hpRoll); this.originalSpeed = 0.4; baseScale = 4.2 * (400 / w);
                this.hitRadius = (w * 0.35) * baseScale / 2;
            } else if (bossType < 0.40) {
                this.bossKey = 'titan_shark';
                tex = AssetManager.textures['boss_titan_shark'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(150000 * hpRoll); this.originalSpeed = 0.25; baseScale = 3.8 * (400 / w);
                this.hitRadius = (w * 0.5) * baseScale / 2;
            } else if (bossType < 0.50) {
                this.bossKey = 'titan_dragon';
                tex = AssetManager.textures['boss_titan_dragon'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(160000 * hpRoll); this.originalSpeed = 0.35; baseScale = 4.0 * (400 / w);
                this.hitRadius = (w * 0.4) * baseScale / 2;
            } else if (bossType < 0.60) {
                this.bossKey = 'leviathan';
                tex = AssetManager.textures['boss_leviathan'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(50000 * hpRoll); this.originalSpeed = 0.3; baseScale = 3.5 * (250 / w);
                this.hitRadius = (w * 0.6) * baseScale / 2;
            } else if (bossType < 0.70) {
                this.bossKey = 'whale';
                tex = AssetManager.textures['boss_whale'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(80000 * hpRoll); this.originalSpeed = 0.2; baseScale = 4.2 * (250 / w);
                this.hitRadius = (w * 0.5) * baseScale / 2;
            } else if (bossType < 0.80) {
                this.bossKey = 'crab';
                tex = AssetManager.textures['boss_crab'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(40000 * hpRoll); this.originalSpeed = 0.5; baseScale = 3.2 * (200 / w);
                this.hitRadius = (w * 0.7) * baseScale / 2;
            } else if (bossType < 0.90) {
                this.bossKey = 'manta';
                tex = AssetManager.textures['boss_manta'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(35000 * hpRoll); this.originalSpeed = 1.2; baseScale = 3.0 * (220 / w);
                this.hitRadius = (w * 0.8) * baseScale / 2;
            } else {
                this.bossKey = 'dragon';
                tex = AssetManager.textures['fish_dragon'] || AssetManager.textures['fish_shark'];
                const w = tex ? (tex.width || 1024) : 1024;
                this.hp = Math.floor(15000 * hpRoll); this.originalSpeed = 1.1; baseScale = 2.0 * (200 / w);
                this.hitRadius = (w * 0.4) * baseScale / 2;
            }
            this.originalSpeed *= (1.0 + (1.0 - hpRoll) * 0.4);
        } else if (isMinion) {
            this.bossKey = 'minion';
            tex = AssetManager.textures['fish_tuna'];
            this.hp = 1; this.originalSpeed = 4.0 + Math.random() * 3.0;
            const w = tex ? (tex.width || 1024) : 1024;
            baseScale = 0.3 * (100 / w);
            this.targetY += (Math.random() - 0.5) * 400;
        } else {
            this.bossKey = '';
            const speciesRand = Math.random();
            if (speciesRand < 0.09) {
                // 原有金枪鱼
                tex = AssetManager.textures['fish_tuna']; this.hp = 100;
                this.originalSpeed = 0.8;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 1.4 * (100 / w);
                this.hitRadius = (w * 0.6) * baseScale / 2;
            } else if (speciesRand < 0.18) {
                // 科技狙击灯笼鱼
                tex = AssetManager.textures['fish_tech_angler'] || AssetManager.textures['fish_angler'];
                this.hp = 200;
                this.originalSpeed = 1.3;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 0.7 * (120 / w);
            } else if (speciesRand < 0.27) {
                // 水母
                this.fishType = 'jelly'; tex = AssetManager.textures['fish_jelly'];
                this.hp = 50; this.originalSpeed = 0.4;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 1.0 * (100 / w);
            } else if (speciesRand < 0.36) {
                // 科技食人鱼
                tex = AssetManager.textures['fish_bio_piranha'];
                this.hp = 120; this.originalSpeed = 2.0;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 0.6 * (100 / w);
            } else if (speciesRand < 0.45) {
                // 科技武装鲨鱼 (精英)
                tex = AssetManager.textures['fish_cyber_shark'];
                this.hp = 500; this.originalSpeed = 0.7;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 1.2 * (180 / w);
            } else if (speciesRand < 0.54) {
                // 电磁炮剑鱼 (精英)
                tex = AssetManager.textures['fish_railgun_swordfish'];
                this.hp = 400; this.originalSpeed = 2.5;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 0.9 * (200 / w);
            } else if (speciesRand < 0.63) {
                // 生化毒河豚 (新)
                tex = AssetManager.textures['fish_bio_pufferfish'];
                this.hp = 280; this.originalSpeed = 0.5;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 1.0 * (120 / w);
            } else if (speciesRand < 0.72) {
                // 装甲梭鱼 (新)
                tex = AssetManager.textures['fish_armored_barracuda'];
                this.hp = 180; this.originalSpeed = 3.2; // 极快
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 0.6 * (110 / w);
            } else if (speciesRand < 0.81) {
                // 赛博三文鱼 (新)
                tex = AssetManager.textures['fish_cyber_salmon'];
                this.hp = 250; this.originalSpeed = 1.2;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 0.8 * (130 / w);
            } else if (speciesRand < 0.90) {
                // 霓虹赛博脂鲤 (新)
                tex = AssetManager.textures['fish_cyber_tetra'];
                this.hp = 80; this.originalSpeed = 1.8;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 0.9 * (90 / w);
            } else {
                // 科幻刺鳐 (新，精英级)
                tex = AssetManager.textures['fish_scifi_stingray'];
                this.hp = 600; this.originalSpeed = 1.0;
                const w = tex ? (tex.width || 1024) : 1024;
                baseScale = 1.2 * (170 / w);
            }
        }

        // 最终兜底，确保 tex 一定存在
        if (!tex) tex = PIXI.Texture.WHITE;

        const isTitan = this.bossKey && this.bossKey.startsWith('titan');
        const segmentCount = isTitan ? 35 : ((isBoss || isMinion) ? 15 : 8);
        this.meshPoints = [];
        const texW = tex.width || 1024;
        const segmentWidth = texW / (segmentCount - 1);
        for (let i = 0; i < segmentCount; i++) {
            this.meshPoints.push(new PIXI.Point(i * segmentWidth, 0));
        }

        this.mesh = new PIXI.SimpleRope(tex, this.meshPoints);
        this.mesh.scale.set(baseScale);
        this.mesh.x = - (texW * baseScale) / 2;
        this.addChild(this.mesh);

        // 真正的全方位对向游走逻辑：游向出生点的正对面
        let tx: number, ty: number;
        if (y < -100) { // 顶部出生 -> 游向底部
            tx = x + (Math.random() - 0.5) * 600; ty = SceneManager.height + 300;
        } else if (y > SceneManager.height + 100) { // 底部出生 -> 游向顶部
            tx = x + (Math.random() - 0.5) * 600; ty = -300;
        } else if (x < 0) { // 左侧出生 -> 游向右侧
            tx = SceneManager.width + 300; ty = y + (Math.random() - 0.5) * 400;
        } else { // 右侧出生 -> 游向左侧
            tx = -300; ty = y + (Math.random() - 0.5) * 400;
        }

        const angle = Math.atan2(ty - y, tx - x);
        this.vx = Math.cos(angle) * this.originalSpeed;
        this.vy = Math.sin(angle) * this.originalSpeed;
        this.targetY = ty; // 让追踪逻辑辅助对穿游走，而不是拉回原位

        this.hp *= mapMult;
        this.maxHp = this.hp;
        this.originalSpeed *= 1.8;
        this.vx *= 1.8;
        this.vy *= 1.8;
        this.speed = this.originalSpeed;
        this.verticalVelocity = 0;
        this.scale.x = (this.vx > 0) ? -1 : 1;
        this.isActive = true;
        // 立即创建HP条
        this.createHpBar();
        console.log(`[Fish] HP bar created for ${this.isBoss ? 'Boss' : 'Fish'} at (${this.x.toFixed(0)}, ${this.y.toFixed(0)}), HP: ${this.hp}/${this.maxHp}`);
    }

    public update(delta: number, nearbyFishes: Fish[] = []): void {
        if (!this.isActive) return;

        // 同步HP条位置到世界坐标（HP条不在鱼内部，需要手动跟随）
        this.syncHpBarPosition();

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

        const vAccel = (this.targetY - this.y) * 0.01;
        this.verticalVelocity = this.verticalVelocity * 0.95 + vAccel * 0.05;
        // 移除此处 redundant y += verticalVelocity 逻辑，统一在下方位移段落处理
        // 限制在画面内 (适配 1920x1080)
        this.y = Math.max(-300, Math.min(SceneManager.height + 300, this.y));

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
                const isTitan = this.bossKey && this.bossKey.startsWith('titan');
                const baseAmp = (this.bossKey === 'dragon' || isTitan ? 35 : 12) * (1 + hitFactor * 0.2 + dashFactor * 0.5);
                const baseFreq = (this.bossKey === 'dragon' || isTitan ? 0.25 : 0.6) * (1 + dashFactor * 0.4);
                for (let i = 0; i < this.meshPoints.length; i++) {
                    this.meshPoints[i].y = Math.sin(t + i * baseFreq) * baseAmp * (0.4 + (i / this.meshPoints.length));
                }
            }
        }

        let hitShakeX = 0; let hitShakeY = 0;
        if (this.hitTimer > 0) {
            this.hitTimer -= delta;
            hitShakeX = (Math.random() - 0.5) * 12; hitShakeY = (Math.random() - 0.5) * 12;
            if (this.mesh) {
                // Reddish tint for hit effect
                this.mesh.tint = 0xff8888;
            }
        } else {
            if (this.mesh && this.mesh.tint !== 0xffffff) {
                this.mesh.tint = 0xffffff;
            }
        }

        // 真正的 2D 对向位移
        const speedRatio = this.speed / this.originalSpeed;
        // 如果垂直速度分量 vy 已经很大，则大幅减弱追踪逻辑 verticalVelocity，防止速度叠加速率过快
        const vTrackComp = Math.abs(this.vy) > 0.2 ? this.verticalVelocity * 0.1 : this.verticalVelocity;

        this.x += this.vx * speedRatio * delta + hitShakeX;
        this.y += (this.vy * speedRatio + vTrackComp) * delta + hitShakeY;

        // 旋转朝向逻辑：让鱼头指向游动方向
        const totalVy = this.vy * speedRatio + vTrackComp;
        const totalVx = this.vx * speedRatio;
        const rotationAngle = Math.atan2(totalVy, totalVx);

        if (totalVx > 0) {
            // 向右游：资产默认向左，需 scale.x = -1，旋转直接使用 angle
            this.scale.x = -1;
            this.rotation = rotationAngle;
        } else {
            // 向左游：scale.x = 1，旋转需要补偿 PI (180度)
            this.scale.x = 1;
            this.rotation = rotationAngle + Math.PI;
        }

        const margin = 800;
        if (this.x < -margin || this.x > SceneManager.width + margin ||
            this.y < -margin || this.y > SceneManager.height + margin) this.kill();
    }

    public takeDamage(dmg: number): boolean {
        this.hp -= dmg;
        this.hitTimer = 15;
        this.updateHpBar();
        if (this.hp <= 0) { this.kill(); return true; }
        return false;
    }

    /** Create HP bar in global UI layer */
    private createHpBar(): void {
        this.removeHpBar();

        // 获取或创建全局HP条层（优先使用Game层如果UI层不可用）
        if (!Fish.hpBarLayer) {
            Fish.hpBarLayer = new PIXI.Container();
            const uiLayer = SceneManager.getLayer(Layers.UI);
            if (uiLayer) {
                uiLayer.addChild(Fish.hpBarLayer);
            } else {
                // Fallback: 添加到游戏层最上方
                const gameLayer = SceneManager.getLayer(Layers.Game);
                if (gameLayer) gameLayer.addChild(Fish.hpBarLayer);
            }
        }

        const barW = this.isBoss ? 160 : Fish.HP_BAR_WIDTH;
        const barH = this.isBoss ? 20 : Fish.HP_BAR_HEIGHT;

        // 背景条（高对比度）
        this.hpBarBg = new PIXI.Graphics();
        this.hpBarBg.lineStyle(3, 0xffff00, 1.0); // 亮黄边框
        this.hpBarBg.beginFill(0x111111, 0.95).drawRoundedRect(0, 0, barW, barH, 4).endFill();
        this.hpBarBg.pivot.set(barW/2, barH/2);
        this.hpBarBg.visible = true;

        // 填充条
        this.hpBarFill = new PIXI.Graphics();
        this.hpBarFill.beginFill(this.getHpColor(), 1.0).drawRoundedRect(0, 0, barW, barH, 4).endFill();
        this.hpBarFill.pivot.set(barW/2, barH/2);
        this.hpBarFill.visible = true;

        // HP数值文字
        this.hpBarText = new PIXI.Text(`${Math.ceil(this.hp)}/${this.maxHp}`, {
            fontSize: this.isBoss ? 14 : 10,
            fill: 0xffffff,
            fontWeight: 'bold',
            dropShadow: true,
            dropShadowColor: 0x000000,
            dropShadowDistance: 2,
        });
        this.hpBarText.anchor.set(0.5);
        this.hpBarText.visible = true;

        if (Fish.hpBarLayer) {
            Fish.hpBarLayer.addChild(this.hpBarBg);
            Fish.hpBarLayer.addChild(this.hpBarFill);
            Fish.hpBarLayer.addChild(this.hpBarText);
            console.log(`[Fish] HP bar added to layer, barW=${barW}, visible=${this.hpBarBg.visible}`);
        } else {
            console.warn('[Fish] HP bar layer not available!');
        }

        this.syncHpBarPosition();
    }

    /** Sync HP bar position to follow fish in world space */
    private syncHpBarPosition(): void {
        if (!this.hpBarBg || !this.hpBarFill || !this.parent) return;
        // 计算鱼头顶的世界坐标（在鱼上方明显位置）
        const yOffset = this.isBoss ? -this.hitRadius - 50 : -60;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        const localX = 0;
        const localY = yOffset;
        const worldX = this.x + localX * cos - localY * sin;
        const worldY = this.y + localX * sin + localY * cos;

        this.hpBarBg.x = worldX;
        this.hpBarBg.y = worldY;
        this.hpBarFill.x = worldX;
        this.hpBarFill.y = worldY;

        if (this.hpBarText) {
            this.hpBarText.x = worldX;
            this.hpBarText.y = worldY;
            this.hpBarText.text = `${Math.ceil(this.hp)}/${this.maxHp}`;
        }
    }

    /** Update HP bar fill based on current HP */
    private updateHpBar(): void {
        if (!this.hpBarFill || !this.hpBarBg) return;
        const barW = this.isBoss ? 160 : Fish.HP_BAR_WIDTH;
        const barH = this.isBoss ? 20 : Fish.HP_BAR_HEIGHT;
        const hpPercent = Math.max(0, this.hp / this.maxHp);

        // 重绘填充条（从左上角0,0绘制，pivot居中）
        this.hpBarFill.clear();
        this.hpBarFill.beginFill(this.getHpColor(), 1.0).drawRoundedRect(0, 0, barW * hpPercent, barH, 4).endFill();
        this.hpBarFill.pivot.set(barW/2, barH/2);
    }

    /** Get HP bar color based on HP percentage */
    private getHpColor(): number {
        const percent = this.hp / this.maxHp;
        if (percent > 0.6) return 0x00ff00; // Green
        if (percent > 0.3) return 0xffcc00; // Yellow
        return 0xff0000; // Red
    }

    /** Remove HP bar from global layer */
    private removeHpBar(): void {
        if (this.hpBarBg) {
            if (this.hpBarBg.parent) this.hpBarBg.parent.removeChild(this.hpBarBg);
            this.hpBarBg.destroy();
            this.hpBarBg = null;
        }
        if (this.hpBarFill) {
            if (this.hpBarFill.parent) this.hpBarFill.parent.removeChild(this.hpBarFill);
            this.hpBarFill.destroy();
            this.hpBarFill = null;
        }
        if (this.hpBarText) {
            if (this.hpBarText.parent) this.hpBarText.parent.removeChild(this.hpBarText);
            this.hpBarText.destroy();
            this.hpBarText = null;
        }
    }

    public kill(): void {
        this.isActive = false; this.visible = false;
        this.removeHpBar();
        if (this.mesh) { this.removeChild(this.mesh); this.mesh = null; }
    }
}
