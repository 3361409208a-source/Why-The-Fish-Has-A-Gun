import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';

export class ComboDisplay {
    private static container: PIXI.Container;
    private static numText: PIXI.Text;
    private static label: PIXI.Text;
    private static value: number = 0;

    public static init(parent: PIXI.Container): void {
        this.container = new PIXI.Container();
        this.container.x = SceneManager.width * 0.75;
        this.container.y = 100;
        this.container.visible = false;

        this.label = new PIXI.Text('×', {
            fontFamily: 'Impact, Charcoal, sans-serif',
            fontSize: 48, fill: 0x00f0ff, fontWeight: 'bold',
            stroke: '#000000', strokeThickness: 4
        });
        this.label.anchor.set(1.0, 0.5);
        this.label.x = -6; this.label.y = 0;

        this.numText = new PIXI.Text('1', {
            fontFamily: 'Impact, Charcoal, sans-serif',
            fontSize: 80,
            fill: [0xffffff, 0x00f0ff],
            fillGradientType: PIXI.TEXT_GRADIENT.LINEAR_VERTICAL,
            fontWeight: 'bold',
            stroke: '#000000', strokeThickness: 10,
            dropShadow: true, dropShadowBlur: 6,
            dropShadowColor: '#000000', dropShadowDistance: 6
        });
        this.numText.anchor.set(0, 0.5);
        this.numText.x = 0;

        this.container.addChild(this.label, this.numText);
        parent.addChild(this.container);
    }

    public static update(count: number): void {
        if (count <= 0) {
            this.container.visible = false;
            this.value = 0;
            return;
        }

        const isNewCombo = count > this.value;
        this.value = count;
        this.container.visible = true;
        this.numText.text = `${count}`;

        if (count > 500) {
            this.numText.style.fill = [0xff0000, 0xffaa00];
        } else if (count > 100) {
            this.numText.style.fill = [0xffcc00, 0xff7700];
        } else {
            this.numText.style.fill = [0xffffff, 0x00f0ff];
        }

        if (isNewCombo) {
            this.label.scale.set(1.2);
            this.label.y = -50;
            const labelTick = () => {
                if (this.label.scale.x > 1.0) {
                    this.label.scale.set(this.label.scale.x - 0.02);
                    this.label.y += 0.5;
                    requestAnimationFrame(labelTick);
                }
            };
            labelTick();
        }

        this.numText.scale.set(2.4);
        const numTick = () => {
            if (this.numText.scale.x > 1.0) {
                this.numText.scale.set(this.numText.scale.x - 0.15);
                requestAnimationFrame(numTick);
            }
        };
        numTick();

        // if (count % 10 === 0) SceneManager.shake(3, 100);
    }

    public static hide(): void {
        if (this.container) this.container.visible = false;
    }
}
