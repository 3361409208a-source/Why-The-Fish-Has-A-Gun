import { SceneManager, Layers } from '../SceneManager';
import { Fish } from '../entities/Fish';
import { NanoCore } from '../entities/NanoCore';
import { ECONOMY } from '../config/balance.config';
import { LEVELS } from '../config/levels.config';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';

export class SpawnSystem {
    private spawnTimer: number = 0;
    private currentStageBoss: Fish | null = null; // 当前存活的关卡Boss

    constructor(private ctx: GameContext, private effects: EffectSystem) {}

    preWarm(): void {
        const count = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < count; i++) {
            this.spawnFish(undefined, 200 + Math.random() * (SceneManager.width - 400));
        }
    }

    update(delta: number): void {
        // 常规鱼群刷新
        this.spawnTimer += delta;
        const baseInterval = 180 / this.ctx.spawnRate;
        if (this.spawnTimer > baseInterval + Math.random() * baseInterval) {
            const maxSwarm = Math.min(6, Math.floor(1 + this.ctx.spawnRate * 1.5));
            const swarmCount = Math.floor(Math.random() * maxSwarm) + 1;
            const baseSpawnY = 100 + Math.random() * (SceneManager.height - 300);
            for (let i = 0; i < swarmCount; i++) {
                setTimeout(() => {
                    if (this.ctx.fishes.length < 150) {
                        this.spawnFish(baseSpawnY + (Math.random() - 0.5) * 80);
                    }
                }, i * (Math.random() * 300 + 150));
            }
            this.spawnTimer = 0;
        }

        // 关卡模式：Boss重生逻辑
        if (this.ctx.stageLevel > 0) {
            this.updateStageMode(delta);
        }
    }

    private updateStageMode(delta: number): void {
        // Boss被击杀后冷却计时，到时重新生成
        if (!this.ctx.stageBossAlive) {
            this.ctx.stageBossSpawnTimer -= delta;
            if (this.ctx.stageBossSpawnTimer <= 0) {
                const lvl = LEVELS.find(l => l.id === this.ctx.stageLevel);
                if (lvl) {
                    const fish = this.spawnStageBoss(lvl.bossKey);
                    if (fish) {
                        this.currentStageBoss = fish;
                        this.ctx.stageBossAlive = true;
                        EventBus.emit(GameEvents.STAGE_BOSS_SPAWNED, { bossKey: lvl.bossKey, bossName: lvl.bossName });
                    }
                }
            }
        }

        // 检测当前Boss是否被击杀
        if (this.ctx.stageBossAlive && this.currentStageBoss && !this.currentStageBoss.isActive) {
            this.ctx.stageBossAlive = false;
            this.ctx.stageBossSpawnTimer = this.ctx.stageBossSpawnInterval;
            this.currentStageBoss = null;
            EventBus.emit(GameEvents.STAGE_BOSS_KILLED, { levelId: this.ctx.stageLevel });
        }
    }

    private spawnStageBoss(bossKey: string): Fish | null {
        const side: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
        const x = side === 'left' ? -300 : SceneManager.width + 300;
        const y = 150 + Math.random() * (SceneManager.height - 400);
        const fish = this.ctx.pool.get('fish', () => new Fish());
        if (!fish) return null;
        (window as any).DmgMultCurrent = this.ctx.hpMultiplier;
        fish.spawn(x, y, side, true, false, bossKey);
        SceneManager.getLayer(Layers.Game).addChild(fish);
        this.ctx.fishes.push(fish);
        return fish;
    }

    checkCorePickup(): void {
        for (const core of this.ctx.cores) {
            if (!core.isActive) continue;
            const dx = core.x - this.ctx.cannon.x;
            const dy = core.y - this.ctx.cannon.y;
            if (Math.sqrt(dx * dx + dy * dy) < 80) {
                this.ctx.crystals += ECONOMY.nanoCoreBonus;
                EventBus.emit(GameEvents.UI_HUD_UPDATE, { crystals: this.ctx.crystals });
                this.effects.spawnParticles(core.x, core.y, 30, 0x00ffbb, 15);
                core.kill();
                EventBus.emit(GameEvents.UI_FLOATING_TEXT, { x: core.x, y: core.y, text: `+${ECONOMY.nanoCoreBonus} 核心奖励`, color: 0x00ffbb });
            }
        }
    }

    spawnFish(preferredY?: number, preferredX?: number): void {
        // 关卡模式禁止随机 Boss 刷新，Boss 由 updateStageMode 专属管理
        const isBoss = this.ctx.stageLevel > 0 ? false : Math.random() < 0.005 * this.ctx.spawnRate;
        const sideRoll = Math.random();
        let side: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
        let x: number, y: number;

        if (preferredX !== undefined && preferredY !== undefined) {
            x = preferredX; y = preferredY;
        } else {
            // 如果是 Boss，强制只能在左右两侧出生 (sideRoll 只有在 < 0.7 时才会进入左右逻辑)
            const roll = isBoss ? (sideRoll * 0.7) : sideRoll;
            if (roll < 0.35) { side = 'left'; x = -300; y = 100 + Math.random() * (SceneManager.height - 300); }
            else if (roll < 0.7) { side = 'right'; x = SceneManager.width + 300; y = 100 + Math.random() * (SceneManager.height - 300); }
            else if (roll < 0.85) { x = 100 + Math.random() * (SceneManager.width - 200); y = -300; }
            else { x = 100 + Math.random() * (SceneManager.width - 200); y = SceneManager.height + 300; }
        }

        // Boss 不加入鱼群，鱼群仅限普通鱼类
        const isSchool = !isBoss && Math.random() < 0.15 && preferredX === undefined;
        const schoolSize = isSchool ? 8 + Math.floor(Math.random() * 8) : 1;
        const groupTargetX = SceneManager.width / 2 + (Math.random() - 0.5) * 600;
        const groupTargetY = SceneManager.height / 2 + (Math.random() - 0.5) * 400;

        for (let i = 0; i < schoolSize; i++) {
            const fish = this.ctx.pool.get('fish', () => new Fish());
            if (fish) {
                (window as any).DmgMultCurrent = this.ctx.hpMultiplier;
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 150;
                fish.spawn(x + offsetX, y + offsetY, side, isBoss);
                if (isSchool) {
                    const angle = Math.atan2(groupTargetY - (y + offsetY), groupTargetX - (x + offsetX));
                    (fish as any).vx = Math.cos(angle) * (fish as any).originalSpeed;
                    (fish as any).vy = Math.sin(angle) * (fish as any).originalSpeed;
                }
                SceneManager.getLayer(Layers.Game).addChild(fish);
                this.ctx.fishes.push(fish);
            }
        }
    }

    spawnNanoCore(x: number, y: number): void {
        const core = this.ctx.pool.get('core', () => new NanoCore());
        if (core) {
            core.spawn(x, y);
            SceneManager.getLayer(Layers.Game).addChild(core);
            this.ctx.cores.push(core);
        }
    }
}
