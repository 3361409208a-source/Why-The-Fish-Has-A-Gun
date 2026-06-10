import * as PIXI from 'pixi.js';

type WxTouchRes = { touches?: any[]; changedTouches?: any[] };

let patchedContainsPoint = false;

/** 微信真机：Container 仅有 Graphics 子节点时默认 hitTest 失败，用 bounds 兜底 */
function patchContainerHitTest(): void {
    if (patchedContainsPoint) return;
    patchedContainsPoint = true;

    const proto = PIXI.Container.prototype as any;
    const prev = proto.containsPoint;

    proto.containsPoint = function (point: PIXI.Point): boolean {
        if (this.hitArea) {
            return this.hitArea.contains(point.x, point.y);
        }
        if (this.eventMode === 'static' || this.eventMode === 'dynamic') {
            const b = this.getLocalBounds();
            if (b.width > 0 && b.height > 0) {
                return (
                    point.x >= b.x &&
                    point.x <= b.x + b.width &&
                    point.y >= b.y &&
                    point.y <= b.y + b.height
                );
            }
        }
        return prev ? prev.call(this, point) : false;
    };
}

/** 将微信触摸坐标统一为 renderer 逻辑像素（真机常为物理像素或含 safeArea 偏移） */
function resolveScreenPoint(app: PIXI.Application, t: any): PIXI.Point {
    const renderer = app.renderer;
    const view = renderer.view as HTMLCanvasElement & { width?: number; height?: number };
    const rw = renderer.width;
    const rh = renderer.height;
    const vw = view.width || rw * renderer.resolution;
    const vh = view.height || rh * renderer.resolution;

    const rawCandidates: Array<{ x: number; y: number }> = [];
    if (t.x != null && t.y != null) rawCandidates.push({ x: t.x, y: t.y });
    if (t.clientX != null && t.clientY != null) {
        rawCandidates.push({ x: t.clientX, y: t.clientY });
    }
    if (t.pageX != null && t.pageY != null) {
        rawCandidates.push({ x: t.pageX, y: t.pageY });
    }

    const toLogical = (x: number, y: number) => {
        let lx = x;
        let ly = y;
        if (lx > rw * 1.15 || ly > rh * 1.15) {
            lx = (lx / vw) * rw;
            ly = (ly / vh) * rh;
        }
        return { x: lx, y: ly };
    };

    for (const c of rawCandidates) {
        const { x, y } = toLogical(c.x, c.y);
        if (x >= -40 && x <= rw + 40 && y >= -40 && y <= rh + 40) {
            const pt = new PIXI.Point();
            pt.x = x;
            pt.y = y;
            return pt;
        }
    }

    const fallback = toLogical(t.x ?? t.clientX ?? 0, t.y ?? t.clientY ?? 0);
    return new PIXI.Point(fallback.x, fallback.y);
}

/**
 * [优化] 微信真机触摸桥：直接向 PIXI EventBoundary 注入 Federated 事件。
 * P0 优化：预分配事件对象池（容量 5），避免每次触摸事件都 new FederatedPointerEvent
 * 并对 touchmove 做节流（坐标变化 < 2px 时不转发）
 */
export function bindWxPixiTouch(app: PIXI.Application, stage: PIXI.Container): void {
    patchContainerHitTest();

    const bus = (globalThis as any).GameGlobal?.__wxTouchBus;
    if (!bus) {
        console.warn('[WxPixiTouch] __wxTouchBus not found');
        return;
    }

    const events = (app.renderer as any).events;
    if (!events?.rootBoundary) {
        console.warn('[WxPixiTouch] renderer.events.rootBoundary not found');
        return;
    }

    const boundary = events.rootBoundary;
    boundary.rootTarget = stage;

    stage.eventMode = 'passive';
    stage.interactiveChildren = true;

    events.mapPositionToPoint = (point: PIXI.IPointData, x: number, y: number) => {
        point.x = x;
        point.y = y;
    };

    const readTouch = (res: WxTouchRes) => {
        const t = res.changedTouches?.[0] ?? res.touches?.[0];
        return t ? resolveScreenPoint(app, t) : null;
    };

    // [优化] 事件对象池 - 预分配 5 个 FederatedPointerEvent 复用
    const EVENT_POOL_SIZE = 5;
    const eventPool: PIXI.FederatedPointerEvent[] = [];
    for (let i = 0; i < EVENT_POOL_SIZE; i++) {
        eventPool.push(new PIXI.FederatedPointerEvent(boundary));
    }
    let poolIdx = 0;

    const getEvent = (): PIXI.FederatedPointerEvent => {
        const e = eventPool[poolIdx];
        poolIdx = (poolIdx + 1) % EVENT_POOL_SIZE;
        return e;
    };

    // [优化] touchmove 节流 - 坐标变化 < 2px 时不转发
    let lastMoveX = -Infinity;
    let lastMoveY = -Infinity;

    const emit = (type: string, res: WxTouchRes) => {
        const screen = readTouch(res);
        if (!screen) return;

        // touchmove 节流
        if (type === 'pointermove') {
            const dx = screen.x - lastMoveX;
            const dy = screen.y - lastMoveY;
            if (dx * dx + dy * dy < 4) return; // < 2px 跳过
            lastMoveX = screen.x;
            lastMoveY = screen.y;
        }

        boundary.rootTarget = stage;

        const e = getEvent();
        e.type = type;
        e.screen.copyFrom(screen);
        e.global.copyFrom(screen);
        e.offset.copyFrom(screen);
        e.pointerId = 0;
        e.pointerType = 'touch';
        e.isPrimary = true;
        e.pressure = 0.5;
        e.width = 1;
        e.height = 1;
        e.button = 0;
        e.buttons = type === 'pointerup' || type === 'pointerupoutside' || type === 'pointercancel' ? 0 : 1;

        boundary.mapEvent(e);
    };

    bus.start.push((res: WxTouchRes) => emit('pointerdown', res));
    bus.move.push((res: WxTouchRes) => emit('pointermove', res));
    bus.end.push((res: WxTouchRes) => emit('pointerup', res));
    bus.cancel.push((res: WxTouchRes) => emit('pointercancel', res));

    console.log('[WxPixiTouch] bridge active (bounds hitTest + coord normalize + event pool)');
}
