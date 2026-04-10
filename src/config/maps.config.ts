/**
 * 地图配置数据层
 * 新增地图只需在此追加一条记录，无需改 UIManager 或 main.ts。
 */

export interface MapDef {
    id: string;
    name: string;
    difficulty: string;
    bgKey: string;          // AssetManager 中的背景贴图 key
    videoUrl?: string;      // 仅浏览器端使用的视频背景地址（可选）
    hpMult: number;
    spawnRate: number;
    reward: number;
    borderColor: number;    // 地图卡片边框色
}

export const MAPS: MapDef[] = [
    {
        id: 'normal',
        name: '孢子温床',
        difficulty: '普通',
        bgKey: 'map_normal',
        hpMult: 1.0,
        spawnRate: 1.0,
        reward: 1.0,
        borderColor: 0x00ff00,
    },
    {
        id: 'hard',
        name: '放射死区',
        difficulty: '困难',
        bgKey: 'map_hard',
        hpMult: 8.0,
        spawnRate: 2.0,
        reward: 5.0,
        borderColor: 0xffcc00,
    },
    {
        id: 'lunatic',
        name: '余烬核心',
        difficulty: '疯狂',
        bgKey: 'map_lunatic',
        videoUrl: 'assets/map_lunatic.mp4',
        hpMult: 30.0,
        spawnRate: 4.0,
        reward: 25.0,
        borderColor: 0xff0000,
    },
];

/** 按 id 快速查找地图定义 */
export function getMap(id: string): MapDef | undefined {
    return MAPS.find(m => m.id === id);
}
