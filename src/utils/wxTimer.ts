/**
 * 微信小游戏定时器：优先 wx / GameGlobal，避免依赖沙箱里可能缺失的全局 setTimeout。
 * 基础库 3.13+ 真机仍可能在 LifeCycle.load 报一次框架红字，但业务逻辑应走这里。
 */
type TimerFn = (...args: unknown[]) => void;

function root(): Record<string, unknown> {
    if (typeof GameGlobal !== 'undefined') return GameGlobal as Record<string, unknown>;
    if (typeof globalThis !== 'undefined') return globalThis as Record<string, unknown>;
    return {};
}

function pick<T extends TimerFn>(name: string): T | null {
    const g = root();
    const fn = g[name];
    if (typeof fn === 'function') return fn as T;
    const wxApi = (typeof wx !== 'undefined' ? wx : (g.wx as typeof wx | undefined)) as
        | { [k: string]: TimerFn }
        | undefined;
    if (wxApi && typeof wxApi[name] === 'function') {
        return wxApi[name].bind(wxApi) as T;
    }
    return null;
}

export const wxTimer = {
    setTimeout(fn: () => void, delay?: number): number {
        const st = pick<typeof setTimeout>('setTimeout');
        if (!st) throw new Error('[wxTimer] setTimeout unavailable');
        return st(fn, delay ?? 0) as unknown as number;
    },
    clearTimeout(id: number): void {
        const ct = pick<typeof clearTimeout>('clearTimeout');
        if (ct) ct(id);
    },
    setInterval(fn: () => void, delay?: number): number {
        const si = pick<typeof setInterval>('setInterval');
        if (!si) throw new Error('[wxTimer] setInterval unavailable');
        return si(fn, delay ?? 0) as unknown as number;
    },
    clearInterval(id: number): void {
        const ci = pick<typeof clearInterval>('clearInterval');
        if (ci) ci(id);
    },
};
