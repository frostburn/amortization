import type { Geometry, DestroyOptions } from 'pixi.js';
import type { GuardTactic, Person, WeaponKind } from '../sim/types';
import type { CrewId } from '../sim/crew';
import { facingAngle } from '../sim/shield';
import { living } from '../sim/types';
import { footfall, hipHeight, kneePosition, walkPhase } from './gait';
import { coatRings, shoulderPadTransform } from './clothing';
import { project } from './isometric';
import { modelGeometry, ModelMesh, MODEL_VIEW, type ModelFace, type Point3 } from './model-mesh';

export type Appearance = CrewId | 'guard' | 'voss' | 'mara';
export interface Outfit {
  appearance: Appearance;
  uniform?: boolean;
  weapon?: WeaponKind;
  stowed?: boolean;
  specialist?: GuardTactic['role'];
  carrying?: boolean;
  flash?: boolean;
  shielding?: boolean;
  throwing?: boolean;
}
interface Profile {
  skin: number;
  hair: number;
  coat: number;
  shirt: number;
  shoulders: number;
  waist: number;
  hips: number;
  head: Point3;
  jaw: number;
  neck: number;
  hairStyle: 'crop' | 'sweep' | 'bob' | 'bun' | 'bald';
  beard?: boolean;
  glasses?: boolean;
  helmet?: number;
  pads?: number;
}
const PROFILES: Record<Appearance, Profile> = {
  morrow: {
    skin: 0xc69d82,
    hair: 0x292b28,
    coat: 0x364943,
    shirt: 0x80b8a4,
    shoulders: 0.165,
    waist: 0.125,
    hips: 0.165,
    head: [0.105, 0.094, 0.145],
    jaw: 0.87,
    neck: 0.057,
    hairStyle: 'sweep',
  },
  vale: {
    skin: 0xba9679,
    hair: 0x3b342a,
    coat: 0x414641,
    shirt: 0x8b9883,
    shoulders: 0.195,
    waist: 0.165,
    hips: 0.17,
    head: [0.109, 0.101, 0.153],
    jaw: 0.97,
    neck: 0.067,
    hairStyle: 'crop',
    beard: true,
    glasses: true,
  },
  rook: {
    skin: 0x865c43,
    hair: 0x292520,
    coat: 0x3b4948,
    shirt: 0x8aa49c,
    shoulders: 0.235,
    waist: 0.19,
    hips: 0.18,
    head: [0.113, 0.111, 0.143],
    jaw: 1.08,
    neck: 0.081,
    hairStyle: 'bald',
  },
  sable: {
    skin: 0xc49d84,
    hair: 0xbec4b9,
    coat: 0x35434c,
    shirt: 0x8fb4bd,
    shoulders: 0.16,
    waist: 0.12,
    hips: 0.16,
    head: [0.103, 0.092, 0.148],
    jaw: 0.86,
    neck: 0.055,
    hairStyle: 'bob',
  },
  guard: {
    skin: 0xb39271,
    hair: 0x4a4638,
    coat: 0x796b51,
    shirt: 0xd29d62,
    shoulders: 0.195,
    waist: 0.17,
    hips: 0.175,
    head: [0.108, 0.103, 0.15],
    jaw: 1,
    neck: 0.067,
    hairStyle: 'crop',
    helmet: 0x686b56,
    pads: 0xc38d50,
  },
  voss: {
    skin: 0xc5a58d,
    hair: 0xb2b4a8,
    coat: 0xb9af95,
    shirt: 0x596462,
    shoulders: 0.16,
    waist: 0.13,
    hips: 0.17,
    head: [0.105, 0.096, 0.153],
    jaw: 0.9,
    neck: 0.056,
    hairStyle: 'bob',
  },
  mara: {
    skin: 0xad7958,
    hair: 0x45362b,
    coat: 0x62615a,
    shirt: 0x63968a,
    shoulders: 0.16,
    waist: 0.135,
    hips: 0.17,
    head: [0.11, 0.1, 0.148],
    jaw: 0.93,
    neck: 0.06,
    hairStyle: 'bun',
    glasses: true,
  },
};

// Read the role from either side of the coat, not just a tiny chest badge.
const SPECIALISTS: Record<NonNullable<Outfit['specialist']>, Profile> = {
  shield: {
    ...PROFILES.guard,
    coat: 0x783b56,
    shirt: 0xcda3b7,
    helmet: 0x68364d,
    pads: 0xd0cfb7,
  },
  support: {
    ...PROFILES.guard,
    coat: 0x778544,
    shirt: 0xc4d28a,
    helmet: 0x566631,
    pads: 0xb4c56d,
  },
  inspector: {
    ...PROFILES.guard,
    coat: 0xc5c6b1,
    shirt: 0x434f49,
    helmet: 0xb9bba6,
    pads: 0xdf8948,
    glasses: true,
  },
  sentry: {
    ...PROFILES.guard,
    coat: 0x3e79a6,
    shirt: 0x96c2d7,
    helmet: 0x396d98,
    pads: 0x91bdd5,
  },
  breacher: {
    ...PROFILES.guard,
    coat: 0xad4946,
    shirt: 0xe2aa8a,
    helmet: 0x9b3d3c,
    pads: 0xe3937c,
  },
  marksman: {
    ...PROFILES.guard,
    coat: 0x8059aa,
    shirt: 0xd7b8ef,
    helmet: 0x67448c,
    pads: 0xc298e2,
  },
};

type Point = Point3; // forward, right, height in character space
const add = (a: Point, b: Point): Point => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: Point, n: number): Point => [a[0] * n, a[1] * n, a[2] * n];
const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Point, b: Point): Point => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (p: Point) => mul(p, 1 / (Math.hypot(...p) || 1));
function shade(color: number, amount: number) {
  return [16, 8, 0].reduce(
    (c, shift) => c | (Math.min(255, Math.round(((color >> shift) & 255) * amount)) << shift),
    0,
  );
}

type Mount = (p: Point) => Point;
function mount(origin: Point, forward: Point, right: Point): Mount {
  const up = cross(forward, right);
  return (p) => add(origin, add(mul(forward, p[0]), add(mul(right, p[1]), mul(up, p[2]))));
}

/** The same rigid weapon is attached to the hands or slung across the back. */
function weaponMount(
  outfit: Outfit,
  aiming: boolean,
  bob: number,
  shoulder: number,
  swing: number,
) {
  if (!outfit.weapon) return null;
  const long = outfit.weapon !== 'pistol';
  if (outfit.stowed || outfit.carrying) {
    if (!long) return null; // A concealed pistol must remain concealed.
    return mount([-0.195, 0.055, 0.96 + bob], [0, -0.44, Math.sqrt(1 - 0.44 ** 2)], [-1, 0, 0]);
  }
  if (aiming)
    return mount(
      [
        (long ? 0.27 : 0.42) - (outfit.flash ? 0.025 : 0),
        shoulder * (outfit.specialist === 'shield' ? 1.85 : 0.78),
        1.015 + bob,
      ],
      [1, 0, 0],
      [0, 1, 0],
    );
  if (long) {
    // Low ready: stock by the right shoulder, muzzle below the left hand.
    const forward = unit([0.7, -0.45, -0.55]);
    return mount([0.18, 0.14, 0.88 + bob], forward, unit([0.45, 0.7, 0]));
  }
  return mount(
    [swing + 0.055, shoulder + 0.01, 0.67 + bob],
    [Math.cos(1.15), 0, -Math.sin(1.15)],
    [0, 1, 0],
  );
}

/** Models share the map's projection and turn in world space, including their normals. */
class Figure {
  faces: ModelFace[] = [];
  transform: ((p: Point) => Point) | null = null;
  constructor(private angle: number) {}
  world(p: Point): Point {
    const c = Math.cos(this.angle),
      s = Math.sin(this.angle);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  }
  screen(p: Point) {
    const [x, y, z] = this.world(p);
    return project({ x, y }, z);
  }
  face(points: Point[], color: number) {
    this.surface(
      points.map((p) => this.world(this.transform ? this.transform(p) : p)),
      color,
    );
  }
  private surface(v: Point[], color: number, normals?: Point[]) {
    // Lofted rings can produce twisted quads. Triangulate for correct lighting and culling.
    const normal = unit(cross(sub(v[1], v[0]), sub(v[2], v[0])));
    if (v.some((p) => Math.abs(dot(normal, sub(p, v[0]))) > 1e-7)) {
      for (let i = 1; i < v.length - 1; i++)
        this.planarFace(
          [v[0], v[i], v[i + 1]],
          color,
          normals && [normals[0], normals[i], normals[i + 1]],
        );
    } else this.planarFace(v, color, normals);
  }
  private planarFace(vertices: Point[], color: number, normals?: Point[]) {
    const normal = unit(cross(sub(vertices[1], vertices[0]), sub(vertices[2], vertices[0])));
    if (dot(normal, MODEL_VIEW) <= 1e-7) return;
    this.faces.push({ vertices, color, normals: normals ?? vertices.map(() => normal) });
  }
  rings(points: Point[][], color: number, smoothing: 'flat' | 'sides' | 'round' = 'flat') {
    const rings = points.map((ring) =>
      ring.map((p) => this.world(this.transform ? this.transform(p) : p)),
    );
    const n = rings[0].length;
    // Use the complete loft before culling so turning never changes a shared
    // normal at the silhouette. Ring tangents also avoid a triangulation bias
    // across the coat's deforming quads. Each part owns its smoothing boundary.
    const normals =
      smoothing === 'flat'
        ? undefined
        : rings.map((ring, r) =>
            ring.map((p, i) => {
              const around = sub(ring[(i + 1) % n], ring[(i + n - 1) % n]);
              const along = add(
                unit(sub(p, rings[Math.max(0, r - 1)][i])),
                unit(sub(rings[Math.min(rings.length - 1, r + 1)][i], p)),
              );
              let normal = unit(cross(around, along));
              if (smoothing === 'round' && (r === 0 || r === rings.length - 1)) {
                const cap = unit(cross(sub(ring[1], ring[0]), sub(ring[2], ring[0])));
                normal = unit(add(normal, mul(cap, r === 0 ? -1 : 1)));
              }
              return normal;
            }),
          );
    this.surface(
      [...rings[0]].reverse(),
      color,
      smoothing === 'round' ? normals![0].slice().reverse() : undefined,
    );
    for (let r = 1; r < rings.length; r++)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        this.surface(
          [rings[r - 1][i], rings[r - 1][j], rings[r][j], rings[r][i]],
          color,
          normals && [normals[r - 1][i], normals[r - 1][j], normals[r][j], normals[r][i]],
        );
      }
    this.surface(rings.at(-1)!, color, smoothing === 'round' ? normals!.at(-1) : undefined);
  }
  oval(
    center: Point,
    forward: number,
    right: number,
    height: number,
    color: number,
    smooth = true,
  ) {
    this.rings(
      [-1, -0.6, 0.45, 1].map((z) => {
        const r = Math.abs(z) === 1 ? 0.55 : 1;
        return Array.from({ length: 8 }, (_, i): Point => {
          const t = (i * Math.PI) / 4;
          return add(center, [Math.cos(t) * forward * r, Math.sin(t) * right * r, z * height]);
        });
      }),
      color,
      smooth ? 'round' : 'flat',
    );
  }
  tube(a: Point, b: Point, radius: number, color: number, tip = radius) {
    const axis = unit(sub(b, a));
    const right = unit(cross(Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1], axis));
    const up = cross(axis, right);
    this.rings(
      [a, b].map((p, j) =>
        Array.from({ length: 6 }, (_, i) => {
          const t = (i * Math.PI) / 3,
            r = j ? tip : radius;
          return add(p, add(mul(right, Math.cos(t) * r), mul(up, Math.sin(t) * r)));
        }),
      ),
      color,
      'sides',
    );
  }
  block(center: Point, size: Point, color: number) {
    this.rings(
      [-1, 1].map((z) =>
        [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([x, y]): Point =>
          add(center, [(x * size[0]) / 2, (y * size[1]) / 2, (z * size[2]) / 2]),
        ),
      ),
      color,
    );
  }
}

export const FACING_COUNT = 32;
const facing = (angle: number) => Math.round((angle * FACING_COUNT) / (Math.PI * 2));

interface PoseFrame {
  geometry: Geometry;
  contacts: Float32Array;
  users: number;
}
// Reuse tessellated poses across strides and guards. Never evict a visible frame.
const frames = new Map<string, PoseFrame>();
const FRAME_LIMIT = 192;
function trimFrames() {
  for (const [key, frame] of frames) {
    if (frames.size <= FRAME_LIMIT) break;
    if (!frame.users) {
      frames.delete(key);
      frame.geometry.destroy(true);
    }
  }
}

export class PersonSprite extends ModelMesh {
  readonly contacts = new Float32Array(4);
  private lastPose = '';
  private current: PoseFrame | null = null;
  private placeholder: Geometry | null;
  constructor() {
    super();
    this.placeholder = this.geometry;
  }
  private useFrame(key: string, frame: PoseFrame) {
    if (this.current) this.current.users--;
    this.current = frame;
    frame.users++;
    this.geometry = frame.geometry;
    this.contacts.set(frame.contacts);
    this.placeholder?.destroy(true);
    this.placeholder = null;
    frames.delete(key);
    frames.set(key, frame);
    trimFrames();
  }
  pose(p: Person, alpha: number, outfit: Outfit = { appearance: 'morrow' }) {
    const direction = facing(facingAngle(p)),
      alive = living(p);
    const phase = walkPhase(p, alpha);
    const frame = phase === null ? -1 : Math.round((((phase % 1) + 1) % 1) * 24) % 24;
    const aiming =
      alive &&
      !outfit.shielding &&
      !outfit.throwing &&
      !!outfit.weapon &&
      !outfit.stowed &&
      (!!outfit.flash ||
        (!p.armament?.reload &&
          (p.cooldown > 0 || !!p.armament?.charging || (!!p.armament?.settle && !p.path.length))));
    const key = [
      direction,
      alive,
      frame,
      aiming,
      outfit.appearance,
      outfit.uniform,
      outfit.weapon,
      outfit.stowed,
      outfit.specialist,
      outfit.carrying,
      outfit.flash,
      outfit.shielding,
      outfit.throwing,
    ].join(':');
    if (key === this.lastPose) return;
    this.lastPose = key;
    const cached = frames.get(key);
    if (cached) {
      this.useFrame(key, cached);
      return;
    }
    const f = new Figure((direction * Math.PI * 2) / FACING_COUNT);
    const profile =
      outfit.appearance === 'guard' && outfit.specialist
        ? SPECIALISTS[outfit.specialist]
        : PROFILES[outfit.appearance];
    const coat = outfit.uniform ? 0x788574 : profile.coat;
    if (!alive) {
      this.fallen(f, profile, coat, outfit);
      this.contacts.fill(0);
    } else {
      const stride = frame < 0 ? null : frame / 24;
      const feet = [-1, 1].map((side, i): Point => {
        const step = stride === null ? { forward: 0, lift: 0 } : footfall(stride + i / 2);
        const foot: Point = [step.forward, side * 0.115, step.lift];
        const ground = f.screen([foot[0], foot[1], 0]);
        this.contacts.set([ground.x, ground.y], i * 2);
        return foot;
      });
      const hip = hipHeight(stride),
        bob = hip - 0.66;
      const knees: Point[] = [];
      for (let i = 0; i < 2; i++) {
        const foot = feet[i],
          side = i ? 1 : -1;
        const ankle = add(foot, [0, 0, 0.09]);
        const bend = kneePosition(hip, ankle[0], ankle[2]);
        const knee: Point = [bend.forward, foot[1], bend.height];
        knees.push(knee);
        f.tube([0, side * 0.115, hip], knee, 0.068, 0x35413e, 0.058);
        f.tube(knee, ankle, 0.054, 0x303a38, 0.046);
        f.oval(knee, 0.067, 0.06, 0.06, 0x43534b);
        f.oval(add(knee, [0.038, 0, 0]), 0.038, 0.055, 0.051, 0x506057, false);
        f.block(add(foot, [0.025, 0, 0.047]), [0.22, 0.115, 0.094], 0x242d2b);
      }
      this.torso(f, profile, coat, bob, knees);
      if (outfit.specialist === 'breacher') {
        f.block([0.135, 0, 0.97 + bob], [0.05, 0.27, 0.2], 0x333e3c);
        f.block([0.125, 0, 1.36 + bob], [0.04, 0.21, 0.065], 0x333e3c);
      }
      this.head(f, profile, [0, 0, 1.31 + bob], !!outfit.uniform, outfit.appearance === 'guard');
      if (outfit.specialist === 'marksman') {
        // A single bright optical lens reinforces the coat palette at close zoom.
        f.block([0.132, 0.05, 1.345 + bob], [0.065, 0.08, 0.07], 0x293c43);
        f.block([0.168, 0.05, 1.345 + bob], [0.01, 0.056, 0.048], 0xa8e5ed);
      }
      const gun = weaponMount(outfit, aiming, bob, profile.shoulders, -feet[1][0] * 0.45);
      const drawn = gun && !outfit.stowed && !outfit.carrying;
      const long = outfit.weapon !== 'pistol';
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        const shoulder: Point = [0, side * profile.shoulders, 1.055 + bob];
        let elbow: Point, hand: Point;
        if (outfit.specialist === 'shield' && outfit.shielding && i === 0) {
          elbow = [0.04, -0.25, 0.83 + bob];
          hand = [0.02, -0.36, 0.65 + bob];
        } else if (outfit.shielding) {
          elbow = [0.13, side * 0.22, 1.12 + bob];
          hand = [0.16, side * 0.07, 1.36 + bob];
        } else if (outfit.specialist === 'shield' && i === 0) {
          elbow = [0.06, -0.25, 0.86 + bob];
          hand = [0.25, -0.12, 0.98 + bob];
        } else if (outfit.throwing && i === 1) {
          elbow = [0.14, 0.23, 1.32 + bob];
          hand = [0.38, 0.12, 1.46 + bob];
        } else if (drawn && aiming) {
          elbow = [0.19, side * 0.18, 0.91 + bob];
          hand = gun(i ? [0, 0, 0] : long ? [0.26, 0, -0.025] : [-0.005, -0.045, 0]);
        } else if (outfit.carrying) {
          elbow = [0.16, side * 0.19, 0.81 + bob];
          hand = [0.26, side * 0.14, 0.83 + bob];
        } else if (drawn && long) {
          elbow = [i ? 0.04 : 0.15, side * (profile.shoulders + 0.04), (i ? 0.86 : 0.79) + bob];
          hand = gun(i ? [0, 0, 0] : [0.26, 0, -0.025]);
        } else {
          const swing = -feet[i][0] * 0.45;
          elbow = [swing - 0.015, side * (profile.shoulders + 0.015), 0.85 + bob];
          hand = [swing + 0.055, side * (profile.shoulders + 0.01), 0.67 + bob];
        }
        f.tube(shoulder, elbow, 0.055, coat, 0.05);
        f.tube(elbow, hand, 0.047, coat, 0.038);
        f.oval(shoulder, 0.061, 0.062, 0.06, coat);
        f.oval(elbow, 0.049, 0.049, 0.048, coat);
        f.oval(hand, 0.049, 0.039, 0.045, profile.skin);
        if (outfit.appearance === 'guard') {
          f.transform = shoulderPadTransform(shoulder, elbow);
          f.oval([0, side * 0.01, 0.036], 0.078, 0.078, 0.043, profile.pads!, false);
          f.transform = null;
        }
      }
      if (outfit.specialist === 'shield') this.shield(f, !!outfit.shielding, bob);
      if (outfit.carrying) f.block([0.26, 0, 0.79 + bob], [0.17, 0.37, 0.23], 0xbfa476);
      if (gun && outfit.weapon) {
        f.transform = gun;
        this.gun(f, outfit.weapon, !!drawn && aiming && !!outfit.flash);
        f.transform = null;
      }
    }
    const geometry = modelGeometry(f.faces);
    this.useFrame(key, { geometry, contacts: this.contacts.slice(), users: 0 });
  }
  override destroy(options?: DestroyOptions) {
    if (this.destroyed) return;
    if (this.current) this.current.users--;
    this.current = null;
    this.placeholder?.destroy(true);
    this.placeholder = null;
    this.shader?.destroy();
    super.destroy({
      ...(typeof options === 'object' ? options : { children: !!options }),
      texture: false,
      textureSource: false,
    });
    // Mission resets release all cached GPU geometry once its last viewer is gone.
    if (![...frames.values()].some((frame) => frame.users)) {
      for (const frame of frames.values()) frame.geometry.destroy(true);
      frames.clear();
    }
  }
  private torso(f: Figure, p: Profile, coat: number, bob: number, knees: Point[]) {
    const rings = coatRings(0.66 + bob, knees, p);
    // Shoulder slopes lead into the collar instead of ending in a flat shelf.
    rings.push(
      rings.at(-1)!.map((_, i, ring): Point => {
        const angle = (i * Math.PI * 2) / ring.length;
        return [Math.cos(angle) * 0.07, Math.sin(angle) * (p.neck + 0.012), 1.14 + bob];
      }),
    );
    f.rings(rings, coat, 'sides');
    f.face(
      [
        [0.117, -0.06, 0.82 + bob],
        [0.117, 0.06, 0.82 + bob],
        [0.117, 0.07, 1.08 + bob],
        [0.117, -0.07, 1.08 + bob],
      ],
      p.shirt,
    );
    for (const side of [-1, 1]) {
      const points: Point[] = [
        [0.123, 0, 0.87 + bob],
        [0.125, side * 0.11, 1.09 + bob],
        [0.13, side * 0.048, 1.1 + bob],
      ];
      f.face(side < 0 ? points.reverse() : points, shade(coat, 1.3));
    }
    f.block([0, 0, 0.72 + bob], [0.245, p.waist * 1.9, 0.045], 0x2a3330);
    f.block([0.135, 0, 0.72 + bob], [0.02, 0.065, 0.043], 0x96a095);
    // The neck ends inside the skull so its top cap cannot show across the nape.
    f.tube([-0.015, 0, 1.08 + bob], [-0.015, 0, 1.27 + bob], p.neck, p.skin, p.neck * 0.9);
  }
  private head(f: Figure, p: Profile, c: Point, helmet: boolean, guard: boolean) {
    const [depth, width, height] = p.head;
    const ring = (z: number, front: number, back: number, breadth: number) =>
      Array.from({ length: 12 }, (_, i): Point => {
        const angle = (i * Math.PI) / 6,
          x = Math.cos(angle);
        return add(c, [
          x * depth * (x > 0 ? front : back),
          Math.sin(angle) * width * breadth,
          z * height,
        ]);
      });
    // Chin, jaw, cheeks, temples and a rounded crown. Separate front/back
    // radii give the skull an occiput rather than a straight-sided oval prism.
    f.rings(
      [
        ring(-1, 0.54, 0.3, 0.58 * p.jaw),
        ring(-0.74, 0.78, 0.62, 0.83 * p.jaw),
        ring(-0.28, 0.97, 1, 0.98),
        ring(0.22, 1, 1.08, 1),
        ring(0.64, 0.88, 1, 0.94),
        ring(0.9, 0.58, 0.8, 0.73),
        ring(1.04, 0.2, 0.4, 0.33),
      ],
      p.skin,
      'round',
    );
    for (const side of [-1, 1])
      f.oval(add(c, [-0.018, side * width, -0.025]), 0.025, 0.019, 0.036, p.skin);
    if (p.hairStyle !== 'bald') {
      // The hairline and cap wrap the skull continuously, including the back.
      f.rings(
        [
          Array.from({ length: 12 }, (_, i): Point => {
            const angle = (i * Math.PI) / 6,
              x = Math.cos(angle);
            return add(c, [
              x * depth * (x > 0 ? 0.94 : 1.13),
              Math.sin(angle) * width * 1.08,
              0.012 + Math.max(0, x) * 0.074,
            ]);
          }),
          ring(0.64, 0.94, 1.06, 1.02),
          ring(0.92, 0.64, 0.83, 0.77),
          ring(1.09, 0.24, 0.4, 0.34),
        ],
        p.hair,
        'round',
      );
      if (p.hairStyle === 'bob') {
        f.oval(add(c, [-0.075, 0, -0.015]), 0.09, 0.116, 0.155, p.hair);
        for (const side of [-1, 1])
          f.oval(add(c, [-0.02, side * 0.095, -0.01]), 0.067, 0.035, 0.13, p.hair);
      } else if (p.hairStyle === 'sweep') {
        f.oval(add(c, [-0.035, -0.09, -0.025]), 0.072, 0.037, 0.12, p.hair);
        f.oval(add(c, [0.067, -0.055, 0.075]), 0.055, 0.065, 0.05, p.hair);
        f.oval(add(c, [-0.08, 0, -0.005]), 0.047, 0.1, 0.11, p.hair);
      } else if (p.hairStyle === 'bun') {
        f.oval(add(c, [-0.13, 0, -0.035]), 0.064, 0.073, 0.07, p.hair);
      } else {
        f.oval(add(c, [-0.085, 0, 0.02]), 0.035, 0.105, 0.105, p.hair);
        f.oval(add(c, [0.065, -0.055, 0.1]), 0.055, 0.061, 0.035, p.hair);
      }
    }
    if (p.beard) f.oval(add(c, [0.067, 0, -0.1]), 0.048, 0.078, 0.065, p.hair);
    f.oval(add(c, [depth * 0.99, 0, -0.015]), 0.026, 0.021, 0.035, p.skin);
    if (!p.beard)
      f.block(add(c, [depth * 0.91, 0, -0.078]), [0.009, 0.041, 0.007], shade(p.skin, 0.72));
    for (const side of [-1, 1]) {
      const eye: Point = [depth * 0.94, side * width * 0.46, 0.024];
      f.block(
        add(c, eye),
        [0.014, p.glasses ? 0.067 : 0.025, p.glasses ? 0.047 : 0.012],
        p.glasses ? 0x514c3e : 0x353931,
      );
      if (p.glasses) f.block(add(add(c, eye), [0.009, 0, 0.003]), [0.004, 0.048, 0.027], 0x9faca0);
      else f.block(add(add(c, eye), [0, 0, 0.02]), [0.012, 0.033, 0.01], shade(p.hair, 0.6));
    }
    if (helmet || guard) {
      const color = helmet ? 0xcbad68 : p.helmet!;
      f.oval(add(c, [0, 0, 0.145]), 0.145, 0.137, 0.074, color, false);
      f.block(add(c, [0.075, 0, 0.106]), [0.22, 0.27, 0.025], color);
    }
  }
  private shield(f: Figure, lowered: boolean, bob = 0) {
    if (lowered)
      f.transform = mount([0.03, -0.36, 0.55 + bob], [0.4, 0, -Math.sqrt(0.84)], [0, 1, 0]);
    else f.transform = mount([0.29, -0.08, 0.75 + bob], [1, 0, 0], [0, 1, 0]);
    // Bevelled full-height plate, dark viewport and burgundy unit stripe.
    f.block([0, 0, 0], [0.085, 0.62, 0.91], 0xd0cfb7);
    f.block([0, 0, 0.47], [0.085, 0.5, 0.08], 0xd0cfb7);
    f.block([0, 0, -0.47], [0.085, 0.5, 0.08], 0x879182);
    f.block([0.045, 0, 0.33], [0.012, 0.36, 0.095], 0x283d42);
    f.block([0.051, 0, 0.33], [0.008, 0.29, 0.046], 0x91b5bb);
    f.block([0.048, 0, -0.12], [0.012, 0.57, 0.1], 0x783b56);
    f.block([-0.065, 0, 0.1], [0.05, 0.22, 0.04], 0x313f3b);
    f.transform = null;
  }
  private gun(f: Figure, kind: NonNullable<Outfit['weapon']>, flash = false) {
    // Local origin is the firing hand, so the receiver, stock, magazine and barrel
    // keep their silhouette in every pose (including carried cargo and casualties).
    const steel = 0x778d96,
      dark = 0x27343c,
      wood = 0xb08350;
    let muzzle: number;
    if (kind === 'pistol') {
      f.block([0.065, 0, 0.075], [0.25, 0.07, 0.075], steel);
      f.block([-0.02, 0, -0.015], [0.07, 0.065, 0.14], dark);
      f.block([0.06, 0, -0.013], [0.085, 0.046, 0.018], dark);
      f.block([0.095, 0, 0.02], [0.016, 0.046, 0.065], dark);
      f.block([0.14, 0, 0.12], [0.024, 0.023, 0.02], dark);
      muzzle = 0.192;
      f.tube([muzzle, 0, 0.075], [muzzle + 0.003, 0, 0.075], 0.018, 0x172323);
    } else if (kind === 'automatic') {
      // Short receiver, folding wire stock and a conspicuous vertical magazine.
      f.block([0.105, 0, 0.068], [0.32, 0.11, 0.125], 0xb59f6b);
      f.block([0, 0, -0.025], [0.075, 0.074, 0.15], dark);
      f.block([0.17, 0, -0.105], [0.085, 0.08, 0.245], dark);
      for (const side of [-1, 1])
        f.tube([-0.27, side * 0.055, 0.02], [-0.04, side * 0.055, 0.07], 0.013, steel);
      f.block([-0.27, 0, -0.005], [0.025, 0.13, 0.12], steel);
      f.block([0.275, 0, 0.03], [0.09, 0.09, 0.08], dark);
      f.tube([0.25, 0, 0.09], [0.37, 0, 0.09], 0.032, steel);
      f.block([0.12, 0, 0.15], [0.09, 0.04, 0.033], dark);
      muzzle = 0.37;
    } else if (kind === 'support') {
      // Broad box magazine, cooling jacket and folded bipod distinguish this from a rifle.
      f.block([-0.2, 0, 0.02], [0.3, 0.11, 0.16], 0x778544);
      f.block([0.12, 0, 0.075], [0.4, 0.14, 0.15], dark);
      f.block([0, 0, -0.04], [0.07, 0.075, 0.16], dark);
      f.block([0.17, -0.055, -0.14], [0.21, 0.23, 0.27], 0x9eac66);
      f.tube([0.28, 0, 0.09], [0.73, 0, 0.09], 0.045, steel);
      for (const x of [0.34, 0.42, 0.5, 0.58]) f.block([x, 0, 0.09], [0.035, 0.11, 0.11], dark);
      for (const side of [-1, 1])
        f.tube([0.59, side * 0.065, 0.065], [0.33, side * 0.065, -0.045], 0.017, steel);
      f.tube([0.73, 0, 0.09], [0.85, 0, 0.09], 0.028, dark);
      f.block([0.12, 0, 0.19], [0.14, 0.03, 0.04], steel);
      muzzle = 0.85;
    } else if (kind === 'coil') {
      // Pale rail housing, three cyan coils, long muzzle and raised scope.
      f.block([-0.2, 0, 0.015], [0.3, 0.085, 0.14], 0xc0cbd0);
      f.block([-0.34, 0, 0.015], [0.025, 0.105, 0.16], dark);
      f.block([0.065, 0, 0.055], [0.27, 0.1, 0.14], dark);
      f.block([0, 0, -0.055], [0.07, 0.07, 0.14], dark);
      f.block([0.2, 0, -0.04], [0.13, 0.105, 0.095], 0x96b4c1);
      f.block([0.42, 0, 0.065], [0.5, 0.075, 0.095], 0xc0cbd0);
      for (const x of [0.32, 0.46, 0.6]) f.block([x, 0, 0.065], [0.046, 0.13, 0.15], 0x65ccd5);
      f.tube([0.63, 0, 0.075], [0.88, 0, 0.075], 0.021, steel);
      f.tube([-0.07, 0, 0.205], [0.2, 0, 0.205], 0.041, dark);
      f.block([0.06, 0, 0.145], [0.09, 0.04, 0.06], steel);
      muzzle = 0.88;
    } else if (kind === 'shotgun') {
      f.block([-0.18, 0, 0.005], [0.23, 0.085, 0.13], wood);
      f.block([-0.292, 0, 0.005], [0.028, 0.095, 0.145], dark);
      f.tube([-0.09, 0, 0.022], [0.025, 0, 0.067], 0.037, wood);
      f.block([0.11, 0, 0.07], [0.24, 0.085, 0.1], dark);
      f.tube([0.2, 0, 0.085], [0.71, 0, 0.085], 0.034, steel);
      f.tube([0.19, 0, 0.02], [0.58, 0, 0.02], 0.027, dark);
      f.block([0.315, 0, 0.02], [0.19, 0.11, 0.085], wood);
      for (const x of [0.25, 0.295, 0.34, 0.385])
        f.block([x, 0, 0.02], [0.013, 0.116, 0.092], 0x725439);
      f.block([0.68, 0, 0.127], [0.025, 0.02, 0.026], dark);
      muzzle = 0.714;
      f.tube([muzzle, 0, 0.085], [muzzle + 0.004, 0, 0.085], 0.025, 0x172323);
    } else {
      f.block([-0.17, 0, 0.048], [0.25, 0.075, 0.065], steel);
      f.block([-0.28, 0, 0.027], [0.055, 0.09, 0.155], dark);
      f.block([0.1, 0, 0.075], [0.29, 0.085, 0.1], dark);
      f.block([0, 0, -0.018], [0.065, 0.063, 0.145], dark);
      f.block([0.14, 0, -0.075], [0.09, 0.07, 0.2], steel);
      f.block([0.3, 0, 0.067], [0.18, 0.09, 0.09], 0x4c6067);
      f.block([0.05, 0, 0.153], [0.12, 0.055, 0.048], steel);
      f.tube([0.35, 0, 0.085], [0.53, 0, 0.085], 0.021, steel);
      f.tube([0.51, 0, 0.085], [0.55, 0, 0.085], 0.029, dark);
      f.block([0.41, 0, 0.12], [0.022, 0.025, 0.047], dark);
      muzzle = 0.55;
    }
    if (flash) f.oval([muzzle + 0.055, 0, 0.08], 0.09, 0.043, 0.045, 0xffd796);
  }
  private fallen(f: Figure, p: Profile, coat: number, outfit: Outfit) {
    // A ground-level body with its own bent limbs, never a rotated standing sprite.
    for (const side of [-1, 1]) {
      const hip: Point = [-0.08, side * 0.1, 0.15];
      const knee: Point = [-0.43, side * 0.19, 0.095];
      const foot: Point = [-0.77, side === 1 ? 0.24 : -0.035, 0.06];
      f.tube(hip, knee, 0.07, 0x35413e, 0.055);
      f.tube(knee, foot, 0.052, 0x303a38, 0.043);
      f.oval(knee, 0.067, 0.06, 0.055, 0x35413e);
      f.block(add(foot, [-0.035, 0.03, -0.01]), [0.13, 0.18, 0.09], 0x242d2b);
    }
    f.oval([0.17, 0, 0.16], 0.34, p.shoulders, 0.12, coat);
    for (const side of [-1, 1]) {
      const shoulder: Point = [0.4, side * p.shoulders, 0.15];
      const elbow: Point = [side < 0 ? 0.18 : 0.6, side * 0.29, 0.08];
      const hand: Point = [side < 0 ? 0.0 : 0.78, side * 0.13, 0.07];
      f.tube(shoulder, elbow, 0.055, coat, 0.047);
      f.tube(elbow, hand, 0.047, coat, 0.033);
      f.oval(hand, 0.048, 0.038, 0.038, p.skin);
    }
    if (outfit.specialist === 'shield') {
      // Separate fallen shield, lying beside the body rather than still upright.
      f.block([0.15, -0.55, 0.07], [0.9, 0.6, 0.1], 0xd0cfb7);
      f.block([0.15, -0.55, 0.125], [0.12, 0.55, 0.01], 0x783b56);
      f.block([0.45, -0.55, 0.125], [0.08, 0.34, 0.01], 0x283d42);
    }
    const center: Point = [0.62, 0, 0.14];
    f.transform = (point) => {
      const q = sub(point, center);
      return add(center, [q[2], q[1], -q[0]]);
    };
    this.head(f, p, center, !!outfit.uniform, outfit.appearance === 'guard');
    f.transform = null;
    if (outfit.weapon) {
      f.transform = mount([0.27, 0.4, 0.06], [1, 0, 0], [0, 0, -1]);
      this.gun(f, outfit.weapon);
      f.transform = null;
    }
  }
}
