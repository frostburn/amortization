import { MeshPlane, type Texture, type PlaneGeometry, type DestroyOptions } from 'pixi.js';
import type { Person } from '../sim/types';
import { living } from '../sim/types';
import { PERSON_SIZE, poseWalker } from './gait';

// Sole contact points in each atlas quadrant: operative, worker, guard, engineer.
// The image margins and stance differ; the midpoint of the soles is the ground origin.
const SOLES = [
  [0.428, 0.887, 0.607, 0.971],
  [0.405, 0.882, 0.573, 0.971],
  [0.444, 0.833, 0.631, 0.927],
  [0.421, 0.853, 0.598, 0.93],
] as const;

/** A small skinned grid keeps the shared atlas intact and adds no per-frame textures. */
export class PersonSprite extends MeshPlane {
  private readonly rest: Float32Array;
  private readonly soles = new Float32Array(4);
  readonly contacts = new Float32Array(4);
  private art = -1;

  constructor(texture: Texture, art = 0) {
    // 99 vertices also fit Pixi's shared-atlas mesh batch.
    super({ texture, verticesX: 9, verticesY: 11 });
    this.autoResize = false;
    const geometry = this.geometry as PlaneGeometry;
    geometry.width = PERSON_SIZE;
    geometry.height = PERSON_SIZE;
    geometry.build({});
    this.rest = this.geometry.positions.slice();
    this.setArt(texture, art);
  }

  setArt(texture: Texture, art: number) {
    if (this.texture !== texture) this.texture = texture;
    if (this.art === art) return;
    this.art = art;
    this.soles.set(SOLES[art].map((value) => value * PERSON_SIZE));
    this.pivot.set((this.soles[0] + this.soles[2]) / 2, (this.soles[1] + this.soles[3]) / 2);
  }

  pose(p: Person, alpha: number) {
    poseWalker(this.rest, this.geometry.positions, p, alpha);
    this.geometry.getBuffer('aPosition').update();
    this.alpha = living(p) ? 1 : 0.3;
    this.rotation = living(p) ? 0 : Math.PI / 2;
    this.scale.x = Math.cos(p.angle) - Math.sin(p.angle) > 0 ? -1 : 1;
    // Project each foot's shadow onto the ground, without following the lifted boot upward.
    poseWalker(this.soles, this.contacts, p, alpha, true);
    for (let i = 0; i < this.contacts.length; i += 2) {
      this.contacts[i] = (this.contacts[i] - this.pivot.x) * this.scale.x;
      this.contacts[i + 1] -= this.pivot.y;
    }
  }

  override destroy(options?: DestroyOptions) {
    const geometry = this.geometry;
    super.destroy(options);
    geometry.destroy();
  }
}
