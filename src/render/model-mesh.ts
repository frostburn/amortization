import { Geometry, GlProgram, Mesh, Shader } from 'pixi.js';
import { project } from './isometric';

export type Point3 = [number, number, number];
export interface ModelFace {
  vertices: Point3[];
  color: number;
}
// The viewing ray of project(): moving along this vector leaves screen X/Y unchanged.
export const MODEL_VIEW: Point3 = [1, 1, 1.12];

export function modelGeometry(faces: ModelFace[]) {
  const positions: number[] = [],
    depths: number[] = [],
    colors: number[] = [];
  for (const face of faces)
    for (let i = 1; i < face.vertices.length - 1; i++)
      for (const [x, y, z] of [face.vertices[0], face.vertices[i], face.vertices[i + 1]]) {
        const p = project({ x, y }, z);
        positions.push(p.x, p.y);
        // All character geometry fits inside one layer's (-0.5, 0.5) depth interval.
        depths.push(-(x + y + z * MODEL_VIEW[2]) / 8);
        colors.push(...[16, 8, 0].map((shift) => ((face.color >> shift) & 255) / 255));
      }
  return new Geometry({
    attributes: {
      aPosition: { buffer: new Float32Array(positions), format: 'float32x2' },
      aDepth: { buffer: new Float32Array(depths), format: 'float32' },
      aColor: { buffer: new Float32Array(colors), format: 'float32x3' },
    },
  });
}

/** Opaque character surfaces use GPU depth; each character keeps its scene painter layer. */
export class ModelMesh extends Mesh<Geometry, Shader> {
  constructor(geometry = modelGeometry([])) {
    super({
      geometry,
      shader: new Shader({
        glProgram: GlProgram.from({
          name: 'character-surfaces',
          vertex: `
            in vec2 aPosition;
            in float aDepth;
            in vec3 aColor;
            uniform mat3 uProjectionMatrix;
            uniform mat3 uWorldTransformMatrix;
            uniform mat3 uTransformMatrix;
            uniform vec4 uWorldColorAlpha;
            uniform vec4 uColor;
            uniform vec2 uDepthLayer;
            out vec4 vColor;
            void main() {
              vec3 position = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix * vec3(aPosition, 1.0);
              gl_Position = vec4(position.xy, uDepthLayer.x + aDepth * uDepthLayer.y, 1.0);
              vColor = vec4(aColor, 1.0) * uColor * uWorldColorAlpha;
            }`,
          fragment: `
            in vec4 vColor;
            out vec4 finalColor;
            void main() { finalColor = vColor; }`,
        }),
        resources: {
          depthUniforms: { uDepthLayer: { value: new Float32Array([0, 1]), type: 'vec2<f32>' } },
        },
      }),
    });
    this.state.depthTest = true;
    this.state.depthMask = true;
  }
  setDepthLayer(index: number, count: number) {
    const step = 2 / (count + 1);
    const uniforms = this.shader!.resources.depthUniforms;
    uniforms.uniforms.uDepthLayer.set([1 - (index + 1) * step, step]);
    uniforms.update();
  }
}
