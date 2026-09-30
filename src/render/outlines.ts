import { Container, Filter, GlProgram, Graphics } from 'pixi.js';
import { ModelMesh } from './model-mesh';
import { drawTurret } from './turret';
import type { Geometry } from 'pixi.js';
import type { Guard, Vec, World } from '../sim/types';

/** One shared contour pass for obscured people, reusing their posed geometry. */
export class CharacterOutlines extends Container {
  private models = new Map<string, ModelMesh>();
  private turrets = new Map<string, { ink: Graphics; angle: number }>();
  constructor() {
    super();
    this.eventMode = 'none';
    this.filters = [
      new Filter({
        resolution: 'inherit',
        antialias: 'inherit',
        padding: 3,
        glProgram: GlProgram.from({
          name: 'occluded-character-contours',
          preferredFragmentPrecision: 'highp',
          vertex: `
          in vec2 aPosition;
          uniform vec4 uInputSize;
          uniform vec4 uOutputFrame;
          uniform vec4 uOutputTexture;
          out vec2 vTextureCoord;
          void main() {
            vec2 p = aPosition * uOutputFrame.zw + uOutputFrame.xy;
            p.x = p.x * (2.0 / uOutputTexture.x) - 1.0;
            p.y = p.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
            gl_Position = vec4(p, 0.0, 1.0);
            vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
          }`,
          fragment: `
          in vec2 vTextureCoord;
          uniform sampler2D uTexture;
          uniform vec4 uInputSize;
          uniform vec4 uInputClamp;
          out vec4 finalColor;
          void main() {
            vec4 center = texture(uTexture, vTextureCoord);
            float low = center.a, high = center.a;
            // Width is in CSS pixels, independent of map zoom and device DPI.
            vec2 radius = uInputSize.zw * 1.35;
            for (int i = 0; i < 8; i++) {
              float angle = float(i) * 0.7853981634;
              vec2 uv = clamp(vTextureCoord + vec2(cos(angle), sin(angle)) * radius, uInputClamp.xy, uInputClamp.zw);
              float a = texture(uTexture, uv).a;
              low = min(low, a);
              high = max(high, a);
            }
            float inner = center.a - low;
            float outer = (high - center.a) * 0.8;
            // Hollow faction-coloured contour, with a dark outer edge for pale walls.
            finalColor = vec4(center.rgb * inner, inner + outer);
          }`,
        }),
      }),
    ];
    this.visible = false;
  }
  begin() {
    this.visible = false;
    for (const mesh of this.models.values()) mesh.visible = false;
    for (const { ink } of this.turrets.values()) ink.visible = false;
  }
  show(id: string, geometry: Geometry, position: Vec, color: number) {
    let mesh = this.models.get(id);
    if (!mesh) {
      mesh = new ModelMesh(geometry, true);
      mesh.state.depthTest = false;
      mesh.state.depthMask = false;
      this.addChild(mesh);
      this.models.set(id, mesh);
    }
    mesh.geometry = geometry;
    mesh.position.copyFrom(position);
    mesh.tint = color;
    mesh.visible = this.visible = true;
  }
  showTurret(guard: Guard, world: World, position: Vec, color: number) {
    let view = this.turrets.get(guard.id);
    if (!view) {
      view = { ink: new Graphics(), angle: NaN };
      this.turrets.set(guard.id, view);
      this.addChild(view.ink);
    }
    if (view.angle !== guard.angle) {
      drawTurret(view.ink.clear(), guard, world, color);
      view.angle = guard.angle;
    }
    view.ink.position.copyFrom(position);
    view.ink.visible = this.visible = true;
  }
  reset() {
    // Geometry belongs to PersonSprite's pose cache, not these lightweight views.
    for (const mesh of this.models.values()) mesh.shader?.destroy();
    this.removeChildren().forEach((mesh) => mesh.destroy());
    this.models.clear();
    this.turrets.clear();
    this.visible = false;
  }
}
