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
        const baseSize = isCrit ? 44 : (text.startsWith('+') ? 22 : 16 + Math.random() * 6);
        const t = new PIXI.Text(text, {
            fontFamily: 'Verdana, Geneva, sans-serif',
            fontSize: baseSize,
            fill: color,
            fontWeight: '900',
            stroke: isCrit ? '#ffffff' : '#000000',
            strokeThickness: isCrit ? 2 : 4,
            dropShadow: true,
            dropShadowColor: '#000000',
            dropShadowDistance: 2
        });
        t.anchor.set(0.5);
        t.x = x + (Math.random() - 0.5) * 40;
        t.y = y;
        this.renderLayer.addChild(t);

        let elapsed = 0;
        // 3秒持续展示时，避免文字“飞走”（太上/太下都不舒服）
        const vy = -1.2 - Math.random() * 0.8;
        const vx = (Math.random() - 0.5) * 1.2;
        t.scale.set(0.2);
        const totalFrames = 180; // ~3s @ 60fps
        const fadeStart = 120;   // start fading after ~2s
        const tick = () => {
            if (!t.parent) return;
            elapsed++;
            // 前半段轻微漂浮，后半段趋于静止（减少“飞走感”）
            const drift = elapsed < 45 ? 1 : Math.max(0, 1 - (elapsed - 45) / 45);
            t.x += vx * drift;
            t.y += vy * drift;
            if (elapsed < 10) t.scale.set(0.2 + (elapsed / 10) * (isCrit ? 1.2 : 0.8));
            if (isCrit) t.rotation = Math.sin(elapsed * 0.5) * 0.1;
            if (elapsed > fadeStart) t.alpha = 1 - (elapsed - fadeStart) / (totalFrames - fadeStart);
            if (elapsed < totalFrames) requestAnimationFrame(tick);
            else this.renderLayer.removeChild(t);
        };
        tick();
    }

    public static formatNumber(num: number): string {
        if (num >= 100000000) return (num / 100000000).toFixed(1) + '亿';
        if (num >= 10000) return (num / 10000).toFixed(1) + '万';
        return num.toString();
    }
}
