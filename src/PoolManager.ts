/**
 * [优化] PoolManager
 * - 增加最大池容量限制，防止内存泄漏
 * - 增加 stats() 方法方便调试
 */
export class PoolManager {
    private static instance: PoolManager;
    private pools: Map<string, any[]> = new Map();
    private static readonly MAX_POOL_SIZE = 200;

    private constructor() {}

    public static getInstance(): PoolManager {
        if (!PoolManager.instance) {
            PoolManager.instance = new PoolManager();
        }
        return PoolManager.instance;
    }

    public get<T>(type: string, factory: () => T): T {
        const pool = this.pools.get(type);
        if (pool && pool.length > 0) {
            return pool.pop() as T;
        }
        return factory();
    }

    /**
     * [优化] 归还对象到池中，超过上限则丢弃
     */
    public put(type: string, instance: any): void {
        let pool = this.pools.get(type);
        if (!pool) {
            pool = [];
            this.pools.set(type, pool);
        }
        // [优化] 防止池无限增长
        if (pool.length < PoolManager.MAX_POOL_SIZE) {
            pool.push(instance);
        }
    }

    public clear(type: string): void {
        this.pools.delete(type);
    }

    /** [优化] 调试用：打印各池大小 */
    public stats(): Record<string, number> {
        const result: Record<string, number> = {};
        for (const [key, pool] of this.pools) {
            result[key] = pool.length;
        }
        return result;
    }
}
