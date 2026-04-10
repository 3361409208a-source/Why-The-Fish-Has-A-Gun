import * as PIXI from 'pixi.js';
import { SceneManager, Layers } from '../../SceneManager';
import { AssetManager } from '../../AssetManager';
import type { DialogueLine } from '../../config/dialogue.config';

export class DialogueOverlay {
    /**
     * 显示剧情对话。
     * @param app PIXI应用实例（用于ticker）
     * @param lines 对话行数组
     * @param onBefore 对话开始前的回调（用于隐藏战斗HUD）
     * @param onAfter 对话全部结束后的回调（用于恢复战斗HUD）
     */
    public static show(
        app: PIXI.Application,
        lines: DialogueLine[],
        onBefore?: () => void,
        onAfter?: () => void,
    ): Promise<void> {
        return new Promise((resolve) => {
            if (!lines || lines.length === 0) {
                onAfter?.();
                resolve();
                return;
            }

            const uiLayer = SceneManager.getLayer(Layers.UI);
            const storyLayer = SceneManager.getLayer(Layers.Story);
            const W = SceneManager.width;
            const H = SceneManager.height;

            onBefore?.();
            uiLayer.visible = false;

            const container = new PIXI.Container();
            storyLayer.addChild(container);

            const rippleFilter = new PIXI.Filter(undefined, `
                varying vec2 vTextureCoord;
                uniform sampler2D uSampler;
                uniform float uTime;
                void main(void) {
                    vec2 uv = vTextureCoord;
                    float wave = sin(uv.y * 10.0 + uTime * 2.0) * 0.003;
                    gl_FragColor = texture2D(uSampler, uv + vec2(wave, 0.0));
                }
            `, { uTime: 0 });

            const boxH = 200;
            const bg = new PIXI.Graphics()
                .beginFill(0x050e1a, 0.95)
                .lineStyle(2, 0x00f0ff, 0.8)
                .drawRect(0, H - boxH - 20, W, boxH)
                .endFill();
            container.addChild(bg);

            const leftAvatar = new PIXI.Sprite();
            leftAvatar.anchor.set(0.5, 1); leftAvatar.x = 280; leftAvatar.y = H - 20;
            leftAvatar.filters = [rippleFilter];
            const rightAvatar = new PIXI.Sprite();
            rightAvatar.anchor.set(0.5, 1); rightAvatar.x = W - 280; rightAvatar.y = H - 20;
            rightAvatar.filters = [rippleFilter];
            container.addChild(leftAvatar, rightAvatar);

            let totalTime = 0;
            const ticker = (delta: number) => {
                totalTime += delta * 0.02;
                rippleFilter.uniforms.uTime = totalTime;
            };
            app.ticker.add(ticker);

            const nameBg = new PIXI.Graphics().beginFill(0x00f0ff, 0.3).drawRect(0, 0, 240, 45).endFill();
            const nameText = new PIXI.Text('', { fontFamily: 'Verdana', fontSize: 26, fill: 0xffffff, fontWeight: 'bold' });
            nameText.anchor.set(0.5); nameText.y = 22;
            const nameGroup = new PIXI.Container();
            nameGroup.addChild(nameBg, nameText);
            nameGroup.y = H - boxH - 65;
            container.addChild(nameGroup);

            const contentText = new PIXI.Text('', {
                fontFamily: 'Verdana', fontSize: 24, fill: 0xffffff,
                wordWrap: true, wordWrapWidth: W - 600, lineHeight: 36
            });
            contentText.y = H - boxH + 20;
            container.addChild(contentText);

            const skipHint = new PIXI.Text('点击屏幕继续 »', { fontFamily: 'Verdana', fontSize: 16, fill: 0x00f0ff });
            skipHint.alpha = 0.6; skipHint.anchor.set(1, 1); skipHint.x = W - 40; skipHint.y = H - 40;
            container.addChild(skipHint);

            let currentLine = 0; let currentChar = 0; let isTyping = false; let timer: any = null;

            const updateAvatar = () => {
                const line = lines[currentLine];
                const tex = AssetManager.textures[line.avatar || ''];
                const activeAvatar = line.side === 'right' ? rightAvatar : leftAvatar;
                const inactiveAvatar = line.side === 'right' ? leftAvatar : rightAvatar;

                if (tex) {
                    activeAvatar.texture = tex;
                    activeAvatar.visible = true;
                    if (line.avatar === 'fish_dragon') {
                        activeAvatar.height = 450;
                    } else {
                        activeAvatar.height = 600;
                    }
                    const baseScale = Math.abs(activeAvatar.scale.y);
                    activeAvatar.scale.x = line.side === 'right' ? baseScale : -baseScale;
                    activeAvatar.alpha = 1;
                    activeAvatar.tint = 0xffffff;
                } else {
                    activeAvatar.visible = false;
                }
                if (inactiveAvatar.texture) {
                    inactiveAvatar.alpha = 0.5;
                    inactiveAvatar.tint = 0x888888;
                }
            };

            const showNextChar = () => {
                const line = lines[currentLine];
                if (currentChar < line.text.length) {
                    contentText.text += line.text[currentChar];
                    currentChar++;
                    timer = setTimeout(showNextChar, 25);
                } else {
                    isTyping = false;
                }
            };

            const next = () => {
                if (isTyping) {
                    clearTimeout(timer);
                    contentText.text = lines[currentLine].text;
                    isTyping = false;
                    return;
                }
                currentLine++;
                if (currentLine >= lines.length) {
                    container.eventMode = 'none';
                    app.ticker.remove(ticker);
                    app.ticker.add((delta: number) => {
                        container.alpha -= 0.1 * delta;
                        if (container.alpha <= 0) {
                            storyLayer.removeChild(container);
                            uiLayer.visible = true;
                            onAfter?.();
                            resolve();
                        }
                    });
                } else {
                    const line = lines[currentLine];
                    nameText.text = line.speaker;
                    nameGroup.x = line.side === 'right' ? W - 280 : 40;
                    nameText.x = 120;
                    contentText.x = line.side === 'right' ? 100 : 350;
                    contentText.text = ''; currentChar = 0; isTyping = true;
                    updateAvatar();
                    showNextChar();
                }
            };

            container.eventMode = 'static'; container.cursor = 'pointer'; container.on('pointerdown', next);

            nameText.text = lines[0].speaker;
            nameGroup.x = lines[0].side === 'right' ? W - 280 : 40;
            nameText.x = 120;
            contentText.x = lines[0].side === 'right' ? 100 : 350;
            updateAvatar();
            isTyping = true;
            showNextChar();
        });
    }
}
