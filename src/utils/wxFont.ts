import * as PIXI from 'pixi.js';

/** 微信真机可用的系统字体（勿用 Verdana/Arial 等 PC 字体名） */
export const WX_FONT_FAMILY = 'sans-serif';

export function wxTextStyle(style: Partial<PIXI.ITextStyle> = {}): Partial<PIXI.ITextStyle> {
    return { fontFamily: WX_FONT_FAMILY, fill: 0xffffff, ...style };
}

export function applyWxTextDefaults(): void {
    try {
        const TextStyle = (PIXI as any).TextStyle;
        if (TextStyle?.defaultStyle) {
            TextStyle.defaultStyle.fontFamily = WX_FONT_FAMILY;
        }
    } catch (_) { /* ignore */ }
}
