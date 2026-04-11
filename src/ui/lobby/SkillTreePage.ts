import * as PIXI from 'pixi.js';
import { SceneManager } from '../../SceneManager';
import { AssetManager } from '../../AssetManager';
import { SaveManager } from '../../SaveManager';
import { SKILL_TREE as SKILL_TREE_CFG, getSkill } from '../../config/skilltree.config';
import { SKILL_TREE as SKILL_TREE_BALANCE } from '../../config/balance.config';
import { FloatingText } from '../overlays/FloatingText';

/** 武器技能树页面：分支式升级，金币购买 */
export class SkillTreePage {
    public static draw(
        container: PIXI.Container,
        onRefresh: (pageId: string) => void
    ): void {
        const W = SceneManager.width;

        const pageTitle = new PIXI.Text('武器技能树', {
            fontSize: 32, fill: 0x00ff88, fontWeight: 'bold', letterSpacing: 3,
        });
        pageTitle.anchor.set(0.5); pageTitle.x = W / 2; pageTitle.y = 130;
        container.addChild(pageTitle);

        const goldTxt = new PIXI.Text(`金币: ${FloatingText.formatNumber(SaveManager.state.gold)}`, {
            fontSize: 22, fill: 0xffcc00, fontWeight: 'bold',
        });
        goldTxt.anchor.set(0.5); goldTxt.x = W / 2; goldTxt.y = 170;
        container.addChild(goldTxt);

        // 按分支分组
        const branches = [
            { key: 'offense' as const, name: '进攻分支', color: 0xff4400, y: 200 },
            { key: 'defense' as const, name: '防御分支', color: 0x0088ff, y: 440 },
            { key: 'utility' as const, name: '效用分支', color: 0x00ff88, y: 620 },
        ];

        for (const branch of branches) {
            const skills = SKILL_TREE_CFG.filter((s: typeof SKILL_TREE_CFG[number]) => s.branch === branch.key);
            this.drawBranch(container, branch, skills, onRefresh, goldTxt);
        }
    }

    private static drawBranch(
        container: PIXI.Container,
        branch: { key: string; name: string; color: number; y: number },
        skills: typeof SKILL_TREE_CFG,
        onRefresh: (pageId: string) => void,
        goldTxt: PIXI.Text
    ): void {
        const W = SceneManager.width;
        const startX = 80;

        // 分支标题
        const branchTitle = new PIXI.Text(branch.name, {
            fontSize: 20, fill: branch.color, fontWeight: 'bold',
        });
        branchTitle.x = startX; branchTitle.y = branch.y;
        container.addChild(branchTitle);

        // 分割线
        const line = new PIXI.Graphics()
            .lineStyle(1, branch.color, 0.3)
            .moveTo(startX, branch.y + 28).lineTo(W - 80, branch.y + 28);
        container.addChild(line);

        // 技能节点
        const nodeW = 260;
        const nodeH = 160;
        const gapX = 30;

        skills.forEach((skill: typeof SKILL_TREE_CFG[number], i: number) => {
            const x = startX + i * (nodeW + gapX);
            const y = branch.y + 40;
            const level = SaveManager.state.skillTree[skill.id] || 0;
            const isMaxed = level >= skill.maxLevel;

            // 前置技能检查
            let prereqMet = true;
            if (skill.prerequisite) {
                const prereqLevel = SaveManager.state.skillTree[skill.prerequisite] || 0;
                prereqMet = prereqLevel >= 1;
            }

            const upgradeCost = SKILL_TREE_BALANCE.getUpgradeCost(skill.costPerLevel, level);
            const canAfford = SaveManager.state.gold >= upgradeCost;
            const isActive = prereqMet && !isMaxed && canAfford;

            const node = this.createSkillNode(skill, level, prereqMet, canAfford, isActive, () => {
                // 购买升级
                if (prereqMet && !isMaxed && SaveManager.state.gold >= upgradeCost) {
                    SaveManager.state.gold -= upgradeCost;
                    SaveManager.state.skillTree[skill.id] = (SaveManager.state.skillTree[skill.id] || 0) + 1;
                    SaveManager.save();
                    onRefresh('skilltree');
                    FloatingText.show(W / 2, 300, `${skill.name} → Lv.${SaveManager.state.skillTree[skill.id]}`, 0x00ff88);
                    AssetManager.playSound('upgrade');
                } else if (!prereqMet) {
                    FloatingText.show(W / 2, 300, '前置技能未解锁', 0xff0000);
                } else if (isMaxed) {
                    FloatingText.show(W / 2, 300, '已满级', 0xffcc00);
                } else {
                    FloatingText.show(W / 2, 300, '金币不足', 0xff0000);
                }
            });
            node.x = x; node.y = y;
            container.addChild(node);

            // 连接线（前置技能→当前技能）
            if (skill.prerequisite && i > 0) {
                const prevX = startX + (i - 1) * (nodeW + gapX) + nodeW;
                const connLine = new PIXI.Graphics()
                    .lineStyle(2, prereqMet ? branch.color : 0x333333, 0.6)
                    .moveTo(prevX, y + nodeH / 2)
                    .lineTo(x, y + nodeH / 2);
                container.addChild(connLine);
            }
        });
    }

    private static createSkillNode(
        skill: typeof SKILL_TREE_CFG[number],
        level: number,
        prereqMet: boolean,
        canAfford: boolean,
        isActive: boolean,
        onUpgrade: () => void
    ): PIXI.Container {
        const node = new PIXI.Container();
        const nodeW = 260;
        const nodeH = 160;
        const isMaxed = level >= skill.maxLevel;
        const upgradeCost = SKILL_TREE_BALANCE.getUpgradeCost(skill.costPerLevel, level);
        const borderColor = !prereqMet ? 0x333333 : (isMaxed ? 0x00ff88 : (level > 0 ? skill.branch === 'offense' ? 0xff4400 : skill.branch === 'defense' ? 0x0088ff : 0x00ff88 : 0x3a4a5e));
        const bgAlpha = prereqMet ? 0.92 : 0.4;

        // 背景
        const bg = new PIXI.Graphics()
            .beginFill(0x0a0f1a, bgAlpha)
            .lineStyle(2, borderColor, 1)
            .drawRoundedRect(0, 0, nodeW, nodeH, 10)
            .endFill();
        node.addChild(bg);

        // 图标
        const iconTex = AssetManager.textures[skill.icon];
        if (iconTex) {
            const icon = new PIXI.Sprite(iconTex);
            icon.width = 40; icon.height = 40; icon.x = 10; icon.y = 10;
            node.addChild(icon);
        }

        // 名称
        const nameTxt = new PIXI.Text(skill.name, {
            fontSize: 16, fill: prereqMet ? 0xffffff : 0x555555, fontWeight: 'bold',
        });
        nameTxt.x = 56; nameTxt.y = 12;
        node.addChild(nameTxt);

        // 等级
        const lvlTxt = new PIXI.Text(`Lv.${level}/${skill.maxLevel}`, {
            fontSize: 14, fill: isMaxed ? 0x00ff88 : (level > 0 ? 0xffcc00 : 0x888888), fontWeight: 'bold',
        });
        lvlTxt.anchor.set(1, 0); lvlTxt.x = nodeW - 10; lvlTxt.y = 12;
        node.addChild(lvlTxt);

        // 描述
        const descTxt = new PIXI.Text(skill.desc, {
            fontSize: 11, fill: prereqMet ? 0xaaaaaa : 0x444444,
            wordWrap: true, wordWrapWidth: nodeW - 20,
        });
        descTxt.x = 10; descTxt.y = 56;
        node.addChild(descTxt);

        // 等级进度条
        const barY = 100;
        const barW = nodeW - 20;
        const barBg = new PIXI.Graphics().beginFill(0x222222).drawRoundedRect(10, barY, barW, 8, 4).endFill();
        node.addChild(barBg);
        if (level > 0) {
            const fillW = barW * (level / skill.maxLevel);
            const barFill = new PIXI.Graphics().beginFill(borderColor).drawRoundedRect(10, barY, fillW, 8, 4).endFill();
            node.addChild(barFill);
        }

        // 购买按钮
        if (isMaxed) {
            const maxTxt = new PIXI.Text('MAX', {
                fontSize: 16, fill: 0x00ff88, fontWeight: 'bold',
            });
            maxTxt.anchor.set(0.5); maxTxt.x = nodeW / 2; maxTxt.y = nodeH - 22;
            node.addChild(maxTxt);
        } else if (!prereqMet) {
            const lockTxt = new PIXI.Text(`需解锁: ${skill.prerequisite || ''}`, {
                fontSize: 12, fill: 0x555555,
            });
            lockTxt.anchor.set(0.5); lockTxt.x = nodeW / 2; lockTxt.y = nodeH - 22;
            node.addChild(lockTxt);
        } else {
            const btnColor = canAfford ? 0x005533 : 0x333333;
            const btnBorder = canAfford ? 0x00ff88 : 0x555555;
            const btnBg = new PIXI.Graphics()
                .beginFill(btnColor)
                .lineStyle(2, btnBorder)
                .drawRoundedRect(30, nodeH - 38, nodeW - 60, 28, 6)
                .endFill();
            const costTxt = new PIXI.Text(`升级: ${FloatingText.formatNumber(upgradeCost)} G`, {
                fontSize: 14, fill: canAfford ? 0xffffff : 0x888888, fontWeight: 'bold',
            });
            costTxt.anchor.set(0.5); costTxt.x = nodeW / 2; costTxt.y = nodeH - 24;
            node.addChild(btnBg, costTxt);

            if (isActive) {
                node.eventMode = 'static'; node.cursor = 'pointer';
                node.on('pointerover', () => { bg.tint = 0x223344; node.scale.set(1.03); });
                node.on('pointerout', () => { bg.tint = 0xffffff; node.scale.set(1); });
                node.on('pointerdown', onUpgrade);
            }
        }

        return node;
    }
}
