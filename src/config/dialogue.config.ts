/**
 * 剧情对话配置数据层
 * 修改/翻译/新增对话只需改此文件，无需碰 main.ts。
 */

export interface DialogueLine {
    speaker: string;
    text: string;
    avatar?: string;
    side?: 'left' | 'right';
}

export const DIALOGUES: Record<string, DialogueLine[]> = {
    normal: [
        { speaker: '深度指挥部', text: '已到达外围海域"孢子温床"，开始环境扫描。', avatar: 'cannon_v3', side: 'left' },
        { speaker: '驾驶员', text: '收到。这里的异常波动还算稳定。', avatar: 'skin_tuna', side: 'right' },
        { speaker: '深海安康鱼', text: '……闪烁的光……是食物吗？', avatar: 'fish_angler', side: 'left' },
        { speaker: '驾驶员', text: '那可不是什么好吃的。那是等离子光束！', avatar: 'skin_tuna', side: 'right' },
        { speaker: '深度指挥部', text: '准备战斗，清理该区域。', avatar: 'cannon_v3', side: 'left' },
    ],
    hard: [
        { speaker: '科研部', text: '这里是"辐射深渊"，辐射值已超出表盘阈值。', avatar: 'cannon_v4', side: 'left' },
        { speaker: '驾驶员', text: '我感觉到这里的海水在沸腾...那些鱼的外壳看起来像是装甲。', avatar: 'skin_jelly', side: 'right' },
        { speaker: '科研部', text: '那是变异结晶。战胜它们，带回科研样本。', avatar: 'cannon_v4', side: 'left' },
    ],
    lunatic: [
        { speaker: '神秘信号', text: '警告：核心温度超过临界值。这里不适合任何生命形式。', avatar: 'skin_heavy', side: 'right' },
        { speaker: '机械鳞龙', text: '……谁在唤醒核心的沉眠？', avatar: 'fish_dragon', side: 'left' },
        { speaker: '驾驶员', text: '这声音……比传闻中还要让人不舒服。', avatar: 'skin_heavy', side: 'right' },
        { speaker: '机械鳞龙', text: '你身上的金属……闻起来有英雄的腐臭味。', avatar: 'fish_dragon', side: 'left' },
        { speaker: '驾驶员', text: '少废话。既然你还没死透，那我就再送你一程！', avatar: 'skin_heavy', side: 'right' },
        { speaker: '机械鳞龙', text: '毁灭是永恒的恩赐！在余烬中化为虚无吧！', avatar: 'fish_dragon', side: 'left' },
        { speaker: '深度指挥部', text: '各单位注意：主炮进入超负荷模式，全面开火！', avatar: 'cannon_v3', side: 'right' },
    ],
};

/** 获取指定地图的剧情台词，不存在则返回空数组 */
export function getDialogue(mapId: string): DialogueLine[] {
    return DIALOGUES[mapId] ?? [];
}
