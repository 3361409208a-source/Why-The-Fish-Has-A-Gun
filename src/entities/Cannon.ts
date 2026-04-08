import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Cannon extends PIXI.Sprite {
    constructor() {
        super(AssetManager.textures['cannon_base']);
        this.eventMode = 'static';
        // 关键修复：初始默认使用激光武器图 jgwuqi.png
        this.switchTexture('cannon_base');
    }


    private applyChromaKey(): void {
        const shaderFrag = `
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            void main(void) {
                vec4 color = texture2D(uSampler, vTextureCoord);
                float brightness = max(max(color.r, color.g), color.b);
                if (brightness > 0.98) {
                    discard;
                }
                gl_FragColor = color;
            }
        `;
        this.filters = [new PIXI.Filter(undefined, shaderFrag)];
    }


    public switchTexture(key: string): void {
        this.texture = AssetManager.textures[key] || AssetManager.textures['cannon_base'];
        
        // 针对“竖版”激光武器图进行姿态校准
        if (key === 'cannon_base' || key === 'gatling' || key === 'heavy' || key === 'lightning') {
            const targetWidth = 80;
            const originalWidth = this.texture.width || 500;
            const s = targetWidth / originalWidth;
            
            this.scale.set(Math.min(s, 1.0));
            // 默认竖向头朝上，0 弧度即指向 12 点方向
            this.rotation = 0; 
            // 轴心设在底部中央
            this.anchor.set(0.5, 0.9); 
            this.applyChromaKey();
        } else {
            // 鱼模组等横版素材的特殊处理 (如果未来还有)
            this.anchor.set(0.5, 0.5); 
            this.scale.set(0.4); 
            this.rotation = -Math.PI / 2;
            this.filters = [];
        }
    }




    /**
     * 使炮管旋转并指向目标点
     */
    public lookAt(targetX: number, targetY: number): void {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        
        // 计算目标弧度
        const baseAngle = Math.atan2(dy, dx);
        
        // 因为原图头已经朝上（-90度），所以旋转量需要偏移 90 度同步逻辑
        this.rotation = baseAngle + Math.PI / 2;
    }

    /**
     * 获取子弹发射角度
     */
    public getFireAngle(): number {
        // 子弹发射角度仍需对应逻辑上的 baseAngle
        return this.rotation - Math.PI / 2;
    }

}
