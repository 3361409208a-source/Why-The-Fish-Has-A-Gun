import { SceneManager, Layers } from '../SceneManager';
import { Fish } from '../entities/Fish';
import { NanoCore } from '../entities/NanoCore';
import { ECONOMY } from '../config/balance.config';
import { EventBus } from '../core/EventBus';
import { GameEvents } from '../core/GameEvents';
import type { GameContext } from './GameContext';
import type { EffectSystem } from './EffectSystem';

export class SpawnSystem {
    private spawnTimer: number = 0;

    constructor(private ctx: GameContext, private effects: EffectSystem) {}

    preWarm(): void {
        const count = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < count; i++) {
            this.spawnFish(undefined, 200 + Math.random() * (SceneManager.width - 400));
        }
    }

    update(delta: number): void {
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
        const sideRoll = Math.random();
        let side: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
        let x: number, y: number;

        if (preferredX !== undefined && preferredY !== undefined) {
            x = preferredX; y = preferredY;
        } else {
            if (sideRoll < 0.35) { side = 'left'; x = -300; y = 100 + Math.random() * (SceneManager.height - 300); }
            else if (sideRoll < 0.7) { side = 'right'; x = SceneManager.width + 300; y = 100 + Math.random() * (SceneManager.height - 300); }
            else if (sideRoll < 0.85) { x = 100 + Math.random() * (SceneManager.width - 200); y = -300; }
            else { x = 100 + Math.random() * (SceneManager.width - 200); y = SceneManager.height + 300; }
        }

        const isSchool = Math.random() < 0.15 && preferredX === undefined;
        const schoolSize = isSchool ? 8 + Math.floor(Math.random() * 8) : 1;
        const groupTargetX = SceneManager.width / 2 + (Math.random() - 0.5) * 600;
        const groupTargetY = SceneManager.height / 2 + (Math.random() - 0.5) * 400;

        for (let i = 0; i < schoolSize; i++) {
            const isBoss = Math.random() < 0.005 * this.ctx.spawnRate;
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
