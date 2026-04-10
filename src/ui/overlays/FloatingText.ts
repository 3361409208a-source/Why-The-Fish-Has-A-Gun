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
        const vy = -4 - Math.random() * 4;
        const vx = (Math.random() - 0.5) * 3;
        t.scale.set(0.2);
        const tick = () => {
            if (!t.parent) return;
            elapsed++;
            t.x += vx;
            t.y += vy + elapsed * 0.15;
            if (elapsed < 10) t.scale.set(0.2 + (elapsed / 10) * (isCrit ? 1.2 : 0.8));
            if (isCrit) t.rotation = Math.sin(elapsed * 0.5) * 0.1;
            if (elapsed > 40) t.alpha = 1 - (elapsed - 40) / 20;
            if (elapsed < 60) requestAnimationFrame(tick);
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
