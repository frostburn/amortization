import { Graphics, GraphicsContext, type DestroyOptions } from 'pixi.js';
import type { Person, Vec } from '../sim/types';
import { living } from '../sim/types';
import { footfall, walkPhase } from './gait';
import { project } from './isometric';

export type Appearance = 'morrow' | 'vale' | 'rook' | 'sable' | 'guard' | 'voss' | 'mara';
export interface Outfit {
  appearance: Appearance;
  uniform?: boolean;
  weapon?: 'pistol' | 'rifle';
  carrying?: boolean;
  flash?: boolean;
}
interface Profile {
  skin: number;
  hair: number;
  coat: number;
  shirt: number;
  shoulders: number;
  waist: number;
  hips: number;
  hairStyle: 'crop' | 'sweep' | 'bob' | 'bun' | 'bald';
  beard?: boolean;
  glasses?: boolean;
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
    hairStyle: 'crop',
  },
  voss: {
    skin: 0xc5a58d,
    hair: 0xb2b4a8,
    coat: 0xb9af95,
    shirt: 0x596462,
    shoulders: 0.16,
    waist: 0.13,
    hips: 0.17,
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
    hairStyle: 'bun',
    glasses: true,
  },
};

type Point = [number, number, number]; // forward, right, height in character space
type Face = { points: Vec[]; color: number; depth: number };
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

/** Faceted models share the map's projection and turn in world space, including their faces. */
class Figure {
  faces: Face[] = [];
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
    const v = points.map((p) => this.world(this.transform ? this.transform(p) : p));
    const normal = unit(cross(sub(v[1], v[0]), sub(v[2], v[0])));
    if (dot(normal, [1, 1, 1.12]) <= 0) return;
    const light = 0.72 + Math.max(0, dot(normal, [-0.35, -0.45, 0.82])) * 0.48;
    this.faces.push({
      points: v.map(([x, y, z]) => project({ x, y }, z)),
      color: shade(color, light),
      depth: v.reduce((sum, p) => sum + dot(p, [1, 1, 1.12]), 0) / v.length,
    });
  }
  rings(rings: Point[][], color: number) {
    const n = rings[0].length;
    this.face([...rings[0]].reverse(), color);
    for (let r = 1; r < rings.length; r++)
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        this.face([rings[r - 1][i], rings[r - 1][j], rings[r][j], rings[r][i]], color);
      }
    this.face(rings.at(-1)!, color);
  }
  oval(center: Point, forward: number, right: number, height: number, color: number) {
    this.rings(
      [-1, -0.6, 0.45, 1].map((z) => {
        const r = Math.abs(z) === 1 ? 0.55 : 1;
        return Array.from({ length: 8 }, (_, i): Point => {
          const t = (i * Math.PI) / 4;
          return add(center, [Math.cos(t) * forward * r, Math.sin(t) * right * r, z * height]);
        });
      }),
      color,
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
  draw(g: GraphicsContext) {
    this.faces.sort((a, b) => a.depth - b.depth);
    for (const face of this.faces) g.poly(face.points.flatMap((p) => [p.x, p.y])).fill(face.color);
  }
}

export const FACING_COUNT = 32;
const facing = (angle: number) => Math.round((angle * FACING_COUNT) / (Math.PI * 2));

interface PoseFrame {
  context: GraphicsContext;
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
      frame.context.destroy();
    }
  }
}

export class PersonSprite extends Graphics {
  readonly contacts = new Float32Array(4);
  private lastPose = '';
  private current: PoseFrame | null = null;
  private placeholder: GraphicsContext | null;
  constructor() {
    super({ context: new GraphicsContext() });
    this.placeholder = this.context;
  }
  private useFrame(key: string, frame: PoseFrame) {
    if (this.current) this.current.users--;
    this.current = frame;
    frame.users++;
    this.context = frame.context;
    this.contacts.set(frame.contacts);
    this.placeholder?.destroy();
    this.placeholder = null;
    frames.delete(key);
    frames.set(key, frame);
    trimFrames();
  }
  pose(p: Person, alpha: number, outfit: Outfit = { appearance: 'morrow' }) {
    const direction = facing(p.angle),
      alive = living(p);
    const phase = walkPhase(p, alpha);
    const frame = phase === null ? -1 : Math.round((((phase % 1) + 1) % 1) * 24) % 24;
    const aiming = alive && !!outfit.weapon && p.cooldown > 0;
    const key = [
      direction,
      alive,
      frame,
      aiming,
      outfit.appearance,
      outfit.uniform,
      outfit.weapon,
      outfit.carrying,
      outfit.flash,
    ].join(':');
    if (key === this.lastPose) return;
    this.lastPose = key;
    const cached = frames.get(key);
    if (cached) {
      this.useFrame(key, cached);
      return;
    }
    const f = new Figure((direction * Math.PI * 2) / FACING_COUNT);
    const profile = PROFILES[outfit.appearance];
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
      const bob = stride === null ? 0 : Math.sin(stride * Math.PI * 4) * 0.013;
      for (let i = 0; i < 2; i++) {
        const foot = feet[i],
          side = i ? 1 : -1;
        const knee: Point = [foot[0] * 0.45 + foot[2] * 0.55, side * 0.1, 0.34 + foot[2] * 0.4];
        f.tube([0, side * 0.1, 0.66 + bob], knee, 0.066, 0x35413e, 0.056);
        f.tube(knee, add(foot, [0, 0, 0.09]), 0.053, 0x303a38, 0.046);
        f.block(add(foot, [0.025, 0, 0.047]), [0.22, 0.115, 0.094], 0x242d2b);
      }
      this.torso(f, profile, coat, bob);
      this.head(f, profile, [0, 0, 1.31 + bob], !!outfit.uniform, outfit.appearance === 'guard');
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        const shoulder: Point = [0, side * profile.shoulders, 1.055 + bob];
        let elbow: Point, hand: Point;
        if (aiming) {
          elbow = [0.19, side * 0.18, 0.91 + bob];
          hand = [i ? 0.42 : 0.47, i ? 0.05 : 0.015, 1.015 + bob];
        } else if (outfit.carrying) {
          elbow = [0.16, side * 0.19, 0.81 + bob];
          hand = [0.26, side * 0.14, 0.83 + bob];
        } else {
          const swing = -feet[i][0] * 0.45;
          elbow = [swing - 0.015, side * (profile.shoulders + 0.015), 0.85 + bob];
          hand = [swing + 0.055, side * (profile.shoulders + 0.01), 0.67 + bob];
        }
        f.tube(shoulder, elbow, 0.055, coat, 0.05);
        f.tube(elbow, hand, 0.047, coat, 0.038);
        f.oval(hand, 0.049, 0.039, 0.045, profile.skin);
        if (outfit.appearance === 'guard')
          f.tube(add(shoulder, [0, 0, -0.04]), add(shoulder, [0, 0, -0.1]), 0.057, 0xc38d50);
      }
      if (outfit.carrying) f.block([0.26, 0, 0.79 + bob], [0.17, 0.37, 0.23], 0xbfa476);
      if (outfit.weapon) this.gun(f, aiming, !!outfit.flash, outfit.weapon === 'rifle', bob);
    }
    const context = new GraphicsContext();
    f.draw(context);
    this.useFrame(key, { context, contacts: this.contacts.slice(), users: 0 });
  }
  override destroy(options?: DestroyOptions) {
    if (this.destroyed) return;
    if (this.current) this.current.users--;
    this.current = null;
    this.placeholder?.destroy();
    this.placeholder = null;
    super.destroy({
      ...(typeof options === 'object' ? options : { children: !!options }),
      context: false,
    });
    // Mission resets release all cached GPU geometry once its last viewer is gone.
    if (![...frames.values()].some((frame) => frame.users)) {
      for (const frame of frames.values()) frame.context.destroy();
      frames.clear();
    }
  }
  private torso(f: Figure, p: Profile, coat: number, bob: number) {
    f.rings(
      [
        [0.46, p.hips * 1.16],
        [0.68, p.hips],
        [0.84, p.waist],
        [1.09, p.shoulders],
      ].map(([z, width]) =>
        Array.from({ length: 8 }, (_, i): Point => [
          Math.cos((i * Math.PI) / 4) * 0.115,
          Math.sin((i * Math.PI) / 4) * width,
          z + bob,
        ]),
      ),
      coat,
    );
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
    f.tube([0, 0, 1.06 + bob], [0, 0, 1.18 + bob], 0.066, p.skin);
  }
  private head(f: Figure, p: Profile, c: Point, helmet: boolean, guard: boolean) {
    f.oval(c, 0.108, p.shoulders < 0.18 ? 0.094 : 0.104, 0.165, p.skin);
    if (p.hairStyle !== 'bald') {
      // A continuous cap covers the crown; overlapping ellipsoids left scalp-colored holes.
      f.rings(
        [0, 1, 2].map((ring) =>
          Array.from({ length: 8 }, (_, i): Point => {
            const t = (i * Math.PI) / 4,
              radius = ring === 2 ? 0.058 : 0.12;
            const z =
              ring === 0 ? 0.025 + Math.max(0, Math.cos(t)) * 0.065 : ring === 1 ? 0.145 : 0.19;
            return add(c, [Math.cos(t) * radius - 0.008, Math.sin(t) * radius, z]);
          }),
        ),
        p.hair,
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
    f.oval(add(c, [0.109, 0, -0.012]), 0.025, 0.024, 0.038, p.skin);
    for (const side of [-1, 1]) {
      f.block(
        add(c, [0.105, side * 0.048, 0.028]),
        [0.014, p.glasses ? 0.067 : 0.025, p.glasses ? 0.047 : 0.016],
        p.glasses ? 0x514c3e : 0x353931,
      );
      if (p.glasses) f.block(add(c, [0.114, side * 0.048, 0.031]), [0.004, 0.048, 0.027], 0x9faca0);
    }
    if (helmet || guard) {
      const color = helmet ? 0xcbad68 : 0x686b56;
      f.oval(add(c, [0, 0, 0.145]), 0.145, 0.137, 0.074, color);
      f.block(add(c, [0.075, 0, 0.106]), [0.22, 0.27, 0.025], color);
    }
  }
  private gun(f: Figure, aiming: boolean, flash: boolean, rifle: boolean, bob: number) {
    const recoil = flash ? -0.035 : 0;
    if (aiming) {
      f.block([0.49 + recoil, 0.05, 1.05 + bob], [rifle ? 0.39 : 0.22, 0.055, 0.07], 0x25302e);
      f.block([0.43 + recoil, 0.05, 0.99 + bob], [0.065, 0.055, 0.12], 0x202826);
      f.tube(
        [0.55 + recoil, 0.05, 1.063 + bob],
        [0.73 + recoil, 0.05, 1.063 + bob],
        rifle ? 0.023 : 0.014,
        0x7a8780,
      );
      if (flash) f.oval([0.81, 0.05, 1.063 + bob], 0.105, 0.045, 0.055, 0xffd796);
    } else {
      f.tube(
        [0.1, 0.205, 0.75],
        [0.24, 0.205, rifle ? 0.42 : 0.55],
        rifle ? 0.038 : 0.027,
        0x26312e,
      );
    }
  }
  private fallen(f: Figure, p: Profile, coat: number, outfit: Outfit) {
    // A ground-level body with its own bent limbs, never a rotated standing sprite.
    for (const side of [-1, 1]) {
      const hip: Point = [-0.08, side * 0.1, 0.15];
      const knee: Point = [-0.43, side * 0.19, 0.095];
      const foot: Point = [-0.77, side === 1 ? 0.24 : -0.035, 0.06];
      f.tube(hip, knee, 0.07, 0x35413e, 0.055);
      f.tube(knee, foot, 0.052, 0x303a38, 0.043);
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
    const center: Point = [0.62, 0, 0.14];
    f.transform = (point) => {
      const q = sub(point, center);
      return add(center, [q[2], q[1], -q[0]]);
    };
    this.head(f, p, center, !!outfit.uniform, outfit.appearance === 'guard');
    f.transform = null;
    if (outfit.weapon) f.block([0.48, 0.36, 0.035], [0.3, 0.06, 0.065], 0x25302e);
  }
}
