type EventHandler<T = any> = (data: T) => void;

/**
 * [优化 P2] EventBus — 类型化全局静态事件总线
 * 通过 EventMap 将事件名映射到载荷类型，编译期校验发布/订阅的载荷结构。
 * on() 返回取消订阅函数，方便 destroy() 时统一清理。
 */

// 事件载荷类型映射表（与 GameEvents 常量对应）
export interface EventMap {
    'ui:hud': { crystals: number };
    'ui:combo': { count: number };
    'ui:text': { x: number; y: number; text: string; color?: number; isCrit?: boolean };
    'ui:berserk': { charge: number; isActive: boolean };
    'ui:shop': { weapons: { id: string; name: string; level: number; maxLevel: number }[] };
    'ui:stageScore': { currentScore: number; requiredScore: number; levelId: number };
    'game:weaponSelect': { id: string };
    'game:weaponUpgrade': { id: string };
    'stage:bossSpawned': { bossKey: string; bossName: string };
    'stage:bossKilled': { levelId: number };
    'stage:unlockReached': { currentScore: number; requiredScore: number; nextLevelName: string };
}

export class EventBus {
    private static handlers: Map<string, EventHandler[]> = new Map();

    static on<K extends keyof EventMap>(
        event: K,
        handler: EventHandler<EventMap[K]>
    ): () => void;
    static on<T = any>(event: string, handler: EventHandler<T>): () => void;
    static on(event: string, handler: EventHandler): () => void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler);
        this.handlers.set(event, list);
        return () => this.off(event, handler);
    }

    static off(event: string, handler: EventHandler): void {
        const list = this.handlers.get(event);
        if (!list) return;
        const i = list.indexOf(handler);
        if (i >= 0) list.splice(i, 1);
    }

    static emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void;
    static emit<T = void>(event: string, data?: T): void;
    static emit(event: string, data?: any): void {
        this.handlers.get(event)?.slice().forEach(h => h(data));
    }

    /** 清除指定事件或所有订阅（销毁会话时调用） */
    static clear(event?: string): void {
        if (event) this.handlers.delete(event);
        else this.handlers.clear();
    }
}
