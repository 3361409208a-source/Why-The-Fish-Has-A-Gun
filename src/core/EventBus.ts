type EventHandler<T = any> = (data: T) => void;

/**
 * EventBus — 全局静态事件总线
 * on() 返回取消订阅函数，方便 destroy() 时统一清理。
 */
export class EventBus {
    private static handlers: Map<string, EventHandler[]> = new Map();

    static on<T = any>(event: string, handler: EventHandler<T>): () => void {
        const list = this.handlers.get(event) ?? [];
        list.push(handler as EventHandler);
        this.handlers.set(event, list);
        return () => this.off(event, handler);
    }

    static off<T = any>(event: string, handler: EventHandler<T>): void {
        const list = this.handlers.get(event);
        if (!list) return;
        const i = list.indexOf(handler as EventHandler);
        if (i >= 0) list.splice(i, 1);
    }

    static emit<T = void>(event: string, data?: T): void {
        this.handlers.get(event)?.slice().forEach(h => h(data));
    }

    /** 清除指定事件或所有订阅（销毁会话时调用） */
    static clear(event?: string): void {
        if (event) this.handlers.delete(event);
        else this.handlers.clear();
    }
}
