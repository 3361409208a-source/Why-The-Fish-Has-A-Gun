import * as PIXI from 'pixi.js';
import { AssetManager } from '../AssetManager';

export class Cannon extends PIXI.Sprite {
    constructor() {
        super(AssetManager.textures['cannon_v3']);
        this.eventMode = 'static';
        this.switchTexture('cannon_base');
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

    public switchTexture(type: string): void {
        const skinMap: {[key: string]: string} = {
            'cannon_base': 'cannon_v3',
            'gatling': 'skin_gatling',
            'heavy': 'skin_heavy',
            'lightning': 'skin_lightning',
            'fish_tuna_mode': 'skin_tuna'
        };

        const textureKey = skinMap[type] || 'cannon_v3';
        const newTex = AssetManager.textures[textureKey];
        
        if (newTex) {
            this.texture = newTex;
            console.log(`Switching cannon skin to: ${textureKey}`);
        } else {
            console.warn(`Asset missing: ${textureKey}, defaulting to cannon_v3`);
            this.texture = AssetManager.textures['cannon_v3'];
        }
        
        const targetWidth = 120; 
        const originalWidth = this.texture.width || 1024;
        const s = targetWidth / originalWidth;
        
        this.scale.set(s);
        this.rotation = 0; 
        // 将重心调至更靠下的基座中心
        this.anchor.set(0.5, 0.75); 
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
        return this.rotation - Math.PI / 2;
    }
}
