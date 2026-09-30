import { Container, Filter, GlProgram, Graphics } from 'pixi.js';
import { ModelMesh } from './model-mesh';
import { drawTurret } from './turret';
import type { Geometry, Polygon } from 'pixi.js';
import type { Guard, Vec, World } from '../sim/types';

interface OutlineView<T extends ModelMesh | Graphics> {
  root: Container;
  ink: T;
  mask: Graphics;
  occluders: readonly Polygon[];
}

/** Pose contours clipped to each character's foreground scenery. */
export class CharacterOutlines extends Container {
  private models = new Map<string, OutlineView<ModelMesh>>();
  private turrets = new Map<string, OutlineView<Graphics> & { angle: number }>();
  private contour: Filter;
  constructor() {
    super();
    this.eventMode = 'none';
    this.contour = new Filter({
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
    });
    this.visible = false;
  }
  private createView<T extends ModelMesh | Graphics>(ink: T): OutlineView<T> {
    const root = new Container(),
      mask = new Graphics();
    // Filter the complete pose, then clip the result on its parent. Clipping
    // the input instead would invent a contour across the wall's top edge.
    // Each filter target is only character-sized; all share the same shader.
    ink.filters = [this.contour];
    root.addChild(ink, mask);
    root.mask = mask;
    this.addChild(root);
    return { root, ink, mask, occluders: [] };
  }
  private reveal(
    view: OutlineView<ModelMesh | Graphics>,
    position: Vec,
    color: number,
    occluders: readonly Polygon[],
  ) {
    if (
      occluders.length !== view.occluders.length ||
      occluders.some((p, i) => p !== view.occluders[i])
    ) {
      view.mask.clear();
      for (const p of occluders) view.mask.poly(p.points).fill(0xffffff);
      view.occluders = occluders;
    }
    view.ink.position.copyFrom(position);
    view.root.tint = color;
    view.root.visible = this.visible = true;
  }
  begin() {
    this.visible = false;
    for (const { root } of this.models.values()) root.visible = false;
    for (const { root } of this.turrets.values()) root.visible = false;
  }
  show(
    id: string,
    geometry: Geometry,
    position: Vec,
    color: number,
    occluders: readonly Polygon[],
  ) {
    let view = this.models.get(id);
    if (!view) {
      const mesh = new ModelMesh(geometry, true);
      mesh.state.depthTest = false;
      mesh.state.depthMask = false;
      view = this.createView(mesh);
      this.models.set(id, view);
    }
    view.ink.geometry = geometry;
    this.reveal(view, position, color, occluders);
  }
  showTurret(
    guard: Guard,
    world: World,
    position: Vec,
    color: number,
    occluders: readonly Polygon[],
  ) {
    let view = this.turrets.get(guard.id);
    if (!view) {
      view = { ...this.createView(new Graphics()), angle: NaN };
      this.turrets.set(guard.id, view);
    }
    if (view.angle !== guard.angle) {
      drawTurret(view.ink.clear(), guard, world, 0xffffff);
      view.angle = guard.angle;
    }
    this.reveal(view, position, color, occluders);
  }
  reset() {
    // Geometry belongs to PersonSprite's pose cache, not these lightweight views.
    for (const { ink } of this.models.values()) ink.shader?.destroy();
    this.removeChildren().forEach((root) => root.destroy({ children: true }));
    this.models.clear();
    this.turrets.clear();
    this.visible = false;
  }
}
