import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Cannon extends PIXI.Sprite {
    constructor() {
        super(AssetManager.textures['cannon_v3']);
        this.eventMode = 'static';
        // 升级至正顶视角 V3
        this.switchTexture('cannon_v3');
    }


    private applyChromaKey(): void {
        const shaderFrag = `
            varying vec2 vTextureCoord;
            uniform sampler2D uSampler;
            void main(void) {
                vec4 color = texture2D(uSampler, vTextureCoord);
                
                // 剔除底色 (由于生成的炮台底色比较深，我们剔除亮度低于 0.12 的像素)
                float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                if (luma < 0.12) discard;
                
                gl_FragColor = color;
            }
        `;
        this.filters = [new PIXI.Filter(undefined, shaderFrag)];
    }


    public switchTexture(key: string): void {
        this.texture = AssetManager.textures['cannon_v3'] || AssetManager.textures['cannon_base'];
        
        // V3 炮台采用正顶视角，旋转表现更稳定
        const targetWidth = 160; 
        const originalWidth = this.texture.width || 1024;
        const s = targetWidth / originalWidth;
        
        this.scale.set(s);
        this.rotation = 0; 
        // V3 生成图的重心位于偏下的位置
        this.anchor.set(0.5, 0.7); 
        this.applyChromaKey();
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
