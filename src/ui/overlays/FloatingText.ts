import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from '../../SceneManager';

export class FloatingText {
    private static layer: PIXI.Container;

    public static init(layer?: PIXI.Container): void {
        this.layer = layer ?? SceneManager.getLayer(Layers.UI);
    }

    private static get renderLayer(): PIXI.Container {
        return this.layer ?? SceneManager.getLayer(Layers.UI);
    }

    public static show(x: number, y: number, text: string, color: number = 0xffffff, isCrit: boolean = false): void {
        const displayText = isCrit ? `暴击！${text}` : text;
        const baseSize = isCrit ? 46 : (text.startsWith('+') ? 22 : 16 + Math.random() * 6);
        const t = new PIXI.Text(displayText, {
            fontFamily: 'Verdana, Geneva, sans-serif',
            fontSize: baseSize,
            fill: isCrit ? 0xff2200 : color,
            fontWeight: '900',
            stroke: isCrit ? '#ffff00' : '#000000',
            strokeThickness: isCrit ? 3 : 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2
        });
        t.anchor.set(0.5);
        t.x = x + (Math.random() - 0.5) * 40;
        t.y = y;
        this.renderLayer.addChild(t);

        let elapsed = 0;
        const vy = -1.8 - Math.random() * 1.0;
        const vx = (Math.random() - 0.5) * 1.0;
        t.scale.set(isCrit ? 0.5 : 0.2);
        const totalFrames = isCrit ? 70 : 90; // 暴击~1.2s，普通~1.5s
        const fadeStart = isCrit ? 35 : 50;
        const tick = () => {
            if (!t.parent) return;
            elapsed++;
            const drift = elapsed < 20 ? 1 : Math.max(0, 1 - (elapsed - 20) / 20);
            t.x += vx * drift;
            t.y += vy * drift;
            if (elapsed < 8) t.scale.set((isCrit ? 0.5 : 0.2) + (elapsed / 8) * (isCrit ? 0.8 : 0.8));
            if (elapsed > fadeStart) t.alpha = 1 - (elapsed - fadeStart) / (totalFrames - fadeStart);
            if (elapsed < totalFrames) requestAnimationFrame(tick);
            else { if (t.parent) this.renderLayer.removeChild(t); }
        };
        tick();
    }

    public static formatNumber(num: number): string {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        return num.toString();
    }
}
