/**
 * 高性能对象池管理器
 * 用于管理鱼、子弹、掉落物等海量实体的复用，避免产生 GC。
 */
export class PoolManager {
    private static instance: PoolManager;
    private pools: Map<string, any[]> = new Map();

    private constructor() {}

    public static getInstance(): PoolManager {
        if (!PoolManager.instance) {
            PoolManager.instance = new PoolManager();
        }
        return PoolManager.instance;
    }

    /**
     * 从池中获取一个实例
     * @param type 类型标识符
     * @param factory 如果池为空，用于创建新实例的工厂函数
     */
    public get<T>(type: string, factory: () => T): T {
        const pool = this.pools.get(type);
        if (pool && pool.length > 0) {
            return pool.pop() as T;
        }
        return factory();
    }

    /**
     * 将实例归还到池中
     * @param type 类型标识符
     * @param instance 要归还的实例
     */
    public put(type: string, instance: any): void {
        let pool = this.pools.get(type);
        if (!pool) {
            pool = [];
            this.pools.set(type, pool);
        }
        pool.push(instance);
    }

    /**
     * 清空特定类型的池
     */
    public clear(type: string): void {
        this.pools.delete(type);
    }
}
