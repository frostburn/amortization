import { GlProgram, Mesh, MeshGeometry, Shader } from 'pixi.js';
import type { Container } from 'pixi.js';
import { controllable, living } from '../sim/types';
import type { World } from '../sim/types';
import type { Aftermath } from './aftermath';
import { project, TILE_X, TILE_Y } from './isometric';

const RADIUS = 7;
const MAX_LIGHTS = 5; // Four operatives and their recruited witness.

/** One translucent GPU pass; never hides map objects or changes perception. */
export class OperativeLighting extends Mesh<MeshGeometry, Shader> {
  constructor() {
    super({
      // refresh() scales a unit square to the viewport. Keep its positions and
      // UVs explicit instead of depending on the library's default dimensions.
      geometry: new MeshGeometry({
        positions: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
      }),
      shader: new Shader({
        glProgram: GlProgram.from({
          name: 'operative-light-pools',
          vertex: `
            in vec2 aPosition;
            in vec2 aUV;
            uniform mat3 uProjectionMatrix;
            uniform mat3 uWorldTransformMatrix;
            uniform mat3 uTransformMatrix;
            uniform vec2 uViewport;
            out vec2 vScreen;
            void main() {
              vec3 p = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0);
              gl_Position = vec4(p.xy, 0.0, 1.0);
              vScreen = aUV * uViewport;
            }`,
          fragment: `
            in vec2 vScreen;
            uniform vec4 uLights[${MAX_LIGHTS}];
            out vec4 finalColor;
            void main() {
              float light = 0.0;
              for (int i = 0; i < ${MAX_LIGHTS}; i++) {
                vec2 d = (vScreen - uLights[i].xy) * uLights[i].zw;
                light = max(light, 1.0 - smoothstep(0.055, 1.0, dot(d, d)));
              }
              // A readable ambient floor remains even with no surviving crew.
              // Max blending keeps a clustered squad from washing out the map.
              float shade = 0.40 * (1.0 - light);
              finalColor = vec4(vec3(0.025, 0.038, 0.06) * shade, shade);
            }`,
        }),
        resources: {
          lightUniforms: {
            uViewport: { value: new Float32Array(2), type: 'vec2<f32>' },
            uLights: {
              value: new Float32Array(MAX_LIGHTS * 4),
              type: 'vec4<f32>',
              size: MAX_LIGHTS,
            },
          },
        },
      }),
    });
    this.eventMode = 'none';
    this.state.depthTest = false;
    this.state.depthMask = false;
  }

  refresh(
    world: World,
    alpha: number,
    camera: Container,
    viewport: { width: number; height: number },
    ending: Aftermath | null,
  ) {
    this.visible = !world.mission.daylight;
    if (!this.visible) return;
    const scale = camera.scale.x,
      group = this.shader!.resources.lightUniforms,
      lights: Float32Array = group.uniforms.uLights;
    // A unit quad follows the visible viewport; no offscreen render texture,
    // CPU pixel buffer, texture upload, or per-frame geometry rebuild is needed.
    this.position.set(-camera.x / scale, -camera.y / scale);
    this.scale.set(viewport.width / scale, viewport.height / scale);
    group.uniforms.uViewport.set([viewport.width, viewport.height]);
    for (let i = 0; i < MAX_LIGHTS; i++) lights.set([-100000, -100000, 1, 1], i * 4);
    let count = 0;
    const pool = (x: number, y: number) => {
      const p = project({ x, y }, 0.55);
      lights.set(
        [
          camera.x + p.x * scale,
          camera.y + p.y * scale,
          1 / (TILE_X * Math.SQRT2 * RADIUS * scale),
          1 / (TILE_Y * Math.SQRT2 * RADIUS * scale),
        ],
        count++ * 4,
      );
    };
    for (const p of world.agents) {
      if (!controllable(p) || ending?.boarded.has(p.id)) continue;
      pool(
        p.previous.x + (p.x - p.previous.x) * alpha,
        p.previous.y + (p.y - p.previous.y) * alpha,
      );
    }
    const witness = world.escort;
    if (witness?.recruited && living(witness) && !ending?.boarded.has(witness.id))
      pool(
        witness.previous.x + (witness.x - witness.previous.x) * alpha,
        witness.previous.y + (witness.y - witness.previous.y) * alpha,
      );
    if (!count && ending?.van && ending.phase === 'departing')
      pool(
        ending.van.x + ending.van.w / 2 + ending.offset.x,
        ending.van.y + ending.van.h / 2 + ending.offset.y,
      );
    group.update();
  }
}
