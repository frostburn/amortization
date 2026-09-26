import { MeshPlane, type Texture, type PlaneGeometry, type DestroyOptions } from 'pixi.js';
import type { Person } from '../sim/types';
import { living } from '../sim/types';
import { PERSON_SIZE, poseWalker } from './gait';

/** A small skinned grid keeps the shared atlas intact and adds no per-frame textures. */
export class PersonSprite extends MeshPlane {
  private readonly rest: Float32Array;

  constructor(texture: Texture) {
    // 99 vertices also fit Pixi's shared-atlas mesh batch.
    super({ texture, verticesX: 9, verticesY: 11 });
    this.autoResize = false;
    const geometry = this.geometry as PlaneGeometry;
    geometry.width = PERSON_SIZE;
    geometry.height = PERSON_SIZE;
    geometry.build({});
    this.rest = this.geometry.positions.slice();
    this.pivot.set(PERSON_SIZE / 2, PERSON_SIZE * 0.94);
  }

  pose(p: Person, alpha: number) {
    poseWalker(this.rest, this.geometry.positions, p, alpha);
    this.geometry.getBuffer('aPosition').update();
    this.alpha = living(p) ? 1 : 0.3;
    this.rotation = living(p) ? 0 : Math.PI / 2;
    this.scale.x = Math.cos(p.angle) - Math.sin(p.angle) > 0 ? -1 : 1;
  }

  override destroy(options?: DestroyOptions) {
    const geometry = this.geometry;
    super.destroy(options);
    geometry.destroy();
  }
}
