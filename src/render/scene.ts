import { Application, Assets, Container, Graphics, Rectangle, Text, Texture } from 'pixi.js';
import { distance, inside, living, people, EXTRACTION_RADIUS } from '../sim/types';
import type { ObjectKind, Person, Rect, Solid, Vec, World } from '../sim/types';
import { available, landmark } from '../sim/orders';
import { lineClear } from '../sim/navigation';
import { depthOrder } from './depth';
import { PersonSprite } from './person';

const TILE_X = 26,
  TILE_Y = 14,
  HEIGHT = 25;
const COLORS = {
  ground: 0x263331,
  concrete: 0x43504a,
  road: 0x202b2b,
  mint: 0x8be8c4,
  amber: 0xefbd73,
  red: 0xf57869,
};
export const project = (p: Vec, z = 0) => ({
  x: (p.x - p.y) * TILE_X,
  y: (p.x + p.y) * TILE_Y - z * HEIGHT,
});
const polygon = (g: Graphics, points: Vec[], color: number, alpha = 1) =>
  g.poly(points.flatMap((p) => [p.x, p.y])).fill({ color, alpha });
const plane = (
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  z = 0,
  alpha = 1,
) =>
  polygon(
    g,
    [
      project({ x, y }, z),
      project({ x: x + w, y }, z),
      project({ x: x + w, y: y + h }, z),
      project({ x, y: y + h }, z),
    ],
    color,
    alpha,
  );
function box(
  g: Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  z: number,
  top: number,
  left: number,
  right: number,
) {
  const a = project({ x, y: y + h }),
    b = project({ x: x + w, y: y + h }),
    c = project({ x: x + w, y });
  const at = project({ x, y: y + h }, z),
    bt = project({ x: x + w, y: y + h }, z),
    ct = project({ x: x + w, y }, z);
  polygon(g, [a, b, bt, at], left);
  polygon(g, [b, c, ct, bt], right);
  plane(g, x, y, w, h, top, z);
}
// Details on vertical faces use the same world projection as the body beneath them.
function panel(g: Graphics, a: Vec, b: Vec, bottom: number, top: number, color: number) {
  polygon(g, [project(a, bottom), project(b, bottom), project(b, top), project(a, top)], color);
}
function text(label: string, size = 12, color = 0xd4ded6) {
  return new Text({
    text: label,
    style: {
      fontFamily: 'Arial, sans-serif',
      fontSize: size,
      fontWeight: '500',
      letterSpacing: 1.2,
      fill: color,
    },
  });
}

interface PersonView {
  root: Container;
  sprite: PersonSprite;
  ink: Graphics;
  label: Text;
}
export type Hit =
  | { kind: 'agent'; id: string }
  | { kind: 'guard'; id: string }
  | { kind: 'object'; id: ObjectKind }
  | { kind: 'ground'; point: Vec };
export class Scene {
  readonly app = new Application();
  readonly camera = new Container();
  private floor = new Graphics();
  private cones = new Graphics();
  private objects = new Container();
  private marks = new Container();
  private effects = new Graphics();
  private views = new Map<string, PersonView>();
  private scenery: { root: Container; footprint: Rect }[] = [];
  private icons = new Map<ObjectKind, Container>();
  private textures: Texture[] = [];
  private gate: Graphics | null = null;
  private shutter: Graphics | null = null;
  private world: World;
  private fit = 1;
  zoom = 1;
  private offset = { x: 0, y: 0 };
  private pan = { x: 0, y: 0 };
  private coneTime = -1;
  private resizeObserver: ResizeObserver;
  showVision = true;
  constructor(
    private host: HTMLElement,
    world: World,
  ) {
    this.world = world;
    this.resizeObserver = new ResizeObserver(() => this.resize());
  }
  async init() {
    await this.app.init({
      resizeTo: this.host,
      background: 0x1a2626,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(devicePixelRatio, 2),
      preference: 'webgl',
    });
    this.host.appendChild(this.app.canvas);
    this.app.canvas.setAttribute(
      'aria-label',
      'Tactical map. Select operatives with 1 to 4; right-click to order.',
    );
    this.app.canvas.setAttribute('role', 'img');
    const atlas = await Assets.load<Texture>(`${import.meta.env.BASE_URL}assets/people.webp`);
    const w = atlas.width / 2,
      h = atlas.height / 2;
    this.textures = Array.from(
      { length: 4 },
      (_, i) =>
        new Texture({
          source: atlas.source,
          frame: new Rectangle((i % 2) * w, Math.floor(i / 2) * h, w, h),
        }),
    );
    this.camera.addChild(this.floor, this.cones, this.objects, this.marks, this.effects);
    this.objects.sortableChildren = true;
    this.app.stage.addChild(this.camera);
    this.build();
    this.resizeObserver.observe(this.host);
    this.resize();
  }
  reset(world: World) {
    this.world = world;
    this.views.clear();
    this.scenery = [];
    this.shutter = null;
    this.coneTime = -1;
    this.icons.clear();
    this.objects.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.marks.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.build();
    this.resize();
    this.home();
  }
  private build() {
    const world = this.world,
      g = this.floor;
    g.clear();
    const mission = world.mission;
    plane(g, 0, 0, mission.width, mission.height, COLORS.ground);
    for (let x = 0; x < mission.width; x++)
      for (let y = 0; y < mission.height; y++) {
        const depot = inside({ x, y }, mission.restricted);
        const street =
          x < mission.restricted.x - 1 || y > mission.restricted.y + mission.restricted.h;
        const noise = (x * 17 + y * 23) % 5;
        plane(
          g,
          x,
          y,
          0.985,
          0.985,
          depot
            ? [0x4b5650, 0x49554f, 0x4d5952, 0x46534c, 0x4c5851][noise]
            : street
              ? COLORS.road
              : [0x303e37, 0x344039, 0x33413b, 0x35413b, 0x303d37][noise],
        );
      }
    // Each site's ground markings use the same coordinates as its collision map.
    if (mission.id === 'depot') {
      plane(g, 7, 0, 1.5, 21.2, 0x525c53);
      plane(g, 7, 20.6, 22, 0.65, 0x647060);
      plane(g, 0, 24.5, 32, 0.16, 0x74796a);
      plane(g, 2, 0, 0.13, 7.5, 0x74796a);
      for (let x = 8; x < 32; x += 3) plane(g, x, 23.4, 1.25, 0.1, 0xb4af8e);
      for (const x of [13.45, 15.05, 20.25, 21.9]) {
        plane(g, x, 5, 0.1, 15, 0x111c1c);
        plane(g, x + 0.07, 5, 0.045, 15, 0x8b9688);
      }
      for (let y = 5; y < 20; y += 0.65)
        for (const x of [13.2, 20]) plane(g, x, y, 2.2, 0.1, 0x343e38);
      // Mark the secure office visibly, including its accessible southern opening.
      plane(g, 24.4, 4.5, 3.3, 4.3, 0x70614b, 0, 0.55);
      for (let x = 24.4; x < 27.7; x += 0.5) plane(g, x, 8.85, 0.25, 0.12, COLORS.amber);
    } else {
      plane(g, 6.4, 0, 1.1, 22, 0x59645e);
      plane(g, 7.5, 21.65, 23.5, 0.6, 0x657168);
      plane(g, 30.7, 2, 0.65, 20, 0x657168);
      for (let x = 8; x < 34; x += 3) plane(g, x, 25, 1.25, 0.1, 0xb4af8e);
      for (let y = 4; y < 26; y += 3) plane(g, 32.6, y, 0.1, 1.25, 0xb4af8e);
      const s = mission.secure;
      plane(g, s.x, s.y, s.w, s.h, 0x746752, 0, 0.65);
      plane(g, 24.8, 11.8, 2.7, 0.8, 0x242e2b);
      for (let x = 24.8; x < 27.5; x += 0.4) plane(g, x, 12.45, 0.2, 0.2, COLORS.amber);
      // Loading bays, paper pallets, and fire-control wiring distinguish the annex.
      for (let x = 10; x < 26; x += 4) {
        plane(g, x, 18.4, 0.08, 2.2, 0x8d9785);
        plane(g, x, 20.6, 2.7, 0.08, 0x8d9785);
      }
      plane(g, 4.7, 8.9, 0.12, 1.3, 0xce9e60);
    }
    for (const solid of world.mission.solids) this.addSolid(solid);
    this.gate = new Graphics();
    const gate = world.mission.gate;
    box(this.gate, gate.x, gate.y, gate.w, gate.h, 1.1, 0x9eaa96, 0x627669, 0x394d43);
    this.addScenery(this.gate, gate);
    if (mission.archive) {
      this.shutter = new Graphics();
      const d = mission.archive.door;
      box(this.shutter, d.x, d.y, d.w, d.h, 1.6, 0x9b8e70, 0x695d47, 0x4e554b);
      this.addScenery(this.shutter, d);
    }
    const office = text(mission.archive ? 'SECURE ARCHIVE' : 'SECURE OFFICE', 10, 0xf0c68b);
    office.position.copyFrom(
      project({ x: mission.secure.x + mission.secure.w / 2, y: mission.secure.y + 0.5 }, 1.8),
    );
    office.anchor.set(0.5, 1);
    this.marks.addChild(office);
    const road = text(
      mission.id === 'depot' ? 'MUNICIPAL TRANSIT / 06' : 'CIVIC RECORDS / NO PUBLIC ACCESS',
      10,
      0x718277,
    );
    const rp = project({ x: 12, y: mission.height - 1.2 });
    road.position.copyFrom(rp);
    road.skew.y = Math.atan(TILE_Y / TILE_X);
    this.marks.addChild(road);
    for (const o of world.mission.landmarks) {
      const root = new Container();
      const mark = new Graphics();
      const color =
        o.id === 'extract'
          ? COLORS.mint
          : o.id === 'engineer' || o.id === 'evidence'
            ? COLORS.amber
            : 0xa8c2b3;
      mark
        .poly([0, -9, 7, 0, 0, 9, -7, 0])
        .fill({ color: 0x162722, alpha: 0.9 })
        .stroke({ color, width: 1.5 });
      const label = text(o.tag, 10, color);
      label.anchor.set(0.5, 1);
      label.y = -12;
      root.addChild(mark, label);
      this.icons.set(o.id, root);
      this.marks.addChild(root);
    }
  }
  private addScenery(root: Container, footprint: Rect) {
    this.scenery.push({ root, footprint });
    this.objects.addChild(root);
  }
  private addSolid(s: Solid) {
    const root = new Container(),
      g = new Graphics();
    root.addChild(g);
    if (s.kind === 'van') {
      box(g, s.x, s.y, s.w, s.h, s.height, 0x3b756d, 0x244e49, 0x32625b);
      plane(g, s.x + 0.15, s.y + 0.2, s.w - 0.3, 0.6, 0x173230, s.height + 0.01);
      const p = project({ x: s.x + s.w, y: s.y + s.h - 0.4 }, 0.4);
      g.circle(p.x, p.y, 4).fill(0xc5aa73);
    } else if (s.kind === 'shelves') {
      box(g, s.x, s.y, s.w, s.h, s.height, 0x637474, 0x465b5c, 0x34484c);
      for (let z = 0.3; z < s.height; z += 0.38) {
        const a = project({ x: s.x + 0.12, y: s.y + s.h + 0.01 }, z);
        const b = project({ x: s.x + s.w - 0.12, y: s.y + s.h + 0.01 }, z);
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: 0xadc0b2, width: 1.4 });
      }
    } else if (s.kind === 'tram') {
      box(g, s.x, s.y, s.w, s.h, s.height, 0x6b4b40, 0x8a4f40, 0x533e37);
      for (let y = s.y + 0.6; y < s.y + s.h - 0.5; y += 1.25) {
        panel(g, { x: s.x + s.w, y }, { x: s.x + s.w, y: y + 0.9 }, 0.7, 1.3, 0x223934);
      }
      plane(g, s.x + 0.35, s.y + 0.45, s.w - 0.7, s.h - 0.9, 0x34433d, s.height + 0.05);
      for (let y = s.y + 1; y < s.y + s.h - 0.5; y += 1.6)
        plane(g, s.x + 0.5, y, 1.2, 0.55, 0x65756b, s.height + 0.07);
      const front = s.y + s.h;
      const fascia = (x: number, width: number, bottom: number, top: number, color: number) =>
        panel(g, { x: s.x + x, y: front }, { x: s.x + x + width, y: front }, bottom, top, color);
      fascia(0.18, s.w - 0.36, 0.82, 1.45, 0x302f2b);
      for (const x of [0.25, s.w / 2 + 0.06]) {
        fascia(x, s.w / 2 - 0.31, 0.9, 1.37, 0x294a40);
        fascia(x, s.w / 2 - 0.31, 1.29, 1.33, 0x6e8a78);
      }
      fascia(0.1, s.w - 0.2, 0.2, 0.36, 0x343d36);
      for (const x of [0.38, s.w - 0.38]) {
        polygon(
          g,
          Array.from({ length: 16 }, (_, i) => {
            const angle = (i / 16) * Math.PI * 2;
            return project(
              { x: s.x + x + Math.cos(angle) * 0.11, y: front },
              0.56 + Math.sin(angle) * 0.11,
            );
          }),
          0xe2c08c,
        );
      }
      for (const z of [0.48, 0.58, 0.68]) fascia(0.78, s.w - 1.56, z, z + 0.025, 0x493e35);
    } else if (s.kind === 'crate') {
      box(g, s.x, s.y, s.w, s.h, s.height, 0x87836a, 0x5b6655, 0x65715e);
      plane(g, s.x + s.w * 0.4, s.y, 0.12, s.h, 0xa6a589, s.height + 0.01);
    } else {
      box(
        g,
        s.x,
        s.y,
        s.w,
        s.h,
        s.height,
        s.kind === 'building' ? 0x30423b : 0x818773,
        0x515e50,
        0x3d5046,
      );
      if (s.kind === 'building') {
        for (let x = s.x + 0.5; x < s.x + s.w - 0.3; x += 0.8) {
          const a = project({ x, y: s.y + s.h + 0.01 }, 1.3),
            b = project({ x: x + 0.4, y: s.y + s.h + 0.01 }, 1.3);
          polygon(g, [a, b, { x: b.x, y: b.y + 13 }, { x: a.x, y: a.y + 13 }], 0xb09d6c);
        }
        plane(g, s.x + 0.4, s.y + 0.4, s.w - 0.8, s.h - 0.8, 0x46544a, s.height + 0.03);
      }
    }
    // Wall-mounted details must inherit their wall's occlusion, too.
    if (s.id === 'north') {
      for (let x = 10.5; x < 27; x += 3) {
        const p = project({ x, y: 4.3 }, 1.3);
        g.ellipse(p.x, p.y + 16, 26, 9).fill({ color: 0xe8ba76, alpha: 0.08 });
        g.circle(p.x, p.y, 3).fill(0xf3c58a);
      }
    }
    if (s.id === 'south-a' || s.id === 'annex-front') {
      const label = text(s.id === 'south-a' ? 'DEPOT 06' : 'RECORDS / 02', 22, 0xc3c4a8);
      label.position.copyFrom(project({ x: s.x + 1, y: s.y + s.h + 0.1 }, 1.3));
      label.skew.y = Math.atan(TILE_Y / TILE_X);
      root.addChild(label);
    }
    this.addScenery(root, s);
  }
  private resize() {
    if (!this.app.renderer) return;
    this.app.renderer.resize(this.host.clientWidth, this.host.clientHeight);
    this.fit = Math.min(
      this.host.clientWidth /
        ((this.world.mission.width + this.world.mission.height) * TILE_X + 80),
      this.host.clientHeight /
        ((this.world.mission.width + this.world.mission.height) * TILE_Y + 110),
    );
    this.updateCamera();
  }
  private updateCamera() {
    const scale = this.fit * this.zoom;
    this.camera.scale.set(scale);
    this.offset = {
      x:
        this.host.clientWidth / 2 -
        ((this.world.mission.width - this.world.mission.height) / 2) * TILE_X * scale +
        this.pan.x,
      y:
        this.host.clientHeight / 2 -
        ((this.world.mission.width + this.world.mission.height) / 2) * TILE_Y * scale +
        this.pan.y +
        25 * scale,
    };
    this.camera.position.set(this.offset.x, this.offset.y);
  }
  home() {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.updateCamera();
  }
  zoomBy(delta: number) {
    this.zoom = Math.max(0.7, Math.min(2.8, this.zoom * delta));
    this.updateCamera();
  }
  panBy(x: number, y: number) {
    this.pan.x += x;
    this.pan.y += y;
    this.updateCamera();
  }
  toWorld(x: number, y: number): Vec {
    const scale = this.fit * this.zoom;
    const sx = (x - this.offset.x) / scale / TILE_X,
      sy = (y - this.offset.y) / scale / TILE_Y;
    return { x: (sx + sy) / 2, y: (sy - sx) / 2 };
  }
  screen(p: Vec, z = 0): Vec {
    const q = project(p, z),
      scale = this.fit * this.zoom;
    return { x: q.x * scale + this.offset.x, y: q.y * scale + this.offset.y };
  }
  hit(x: number, y: number, prioritizeObjects = false): Hit {
    const p = { x, y };
    const object = this.world.mission.landmarks.find(
      (o) =>
        available(this.world, o.id) &&
        distance(p, this.screen(landmark(this.world, o.id), 1.45)) < 19,
    );
    // An order aimed at a diamond must still reach it when the crew crowds it.
    // Ordinary left-click selection keeps operatives first.
    if (prioritizeObjects && object) return { kind: 'object', id: object.id };
    const agent = this.world.agents
      .filter(living)
      .map((a) => ({ a, distance: distance(p, this.screen(a, 0.5)) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (agent && agent.distance < 20) return { kind: 'agent', id: agent.a.id };
    if (object) return { kind: 'object', id: object.id };
    if (this.world.engineer && distance(p, this.screen(this.world.engineer, 0.5)) < 18)
      return { kind: 'object', id: 'engineer' };
    for (const g of this.world.guards.filter(living))
      if (distance(p, this.screen(g, 0.5)) < 18) return { kind: 'guard', id: g.id };
    return { kind: 'ground', point: this.toWorld(x, y) };
  }
  private person(p: Person, type: number, label: string): PersonView {
    let v = this.views.get(p.id);
    if (!v) {
      const root = new Container(),
        ink = new Graphics(),
        sprite = new PersonSprite(this.textures[type]);
      const name = text(label, 11);
      name.anchor.set(0.5, 1);
      name.y = -40;
      root.addChild(ink, sprite, name);
      this.objects.addChild(root);
      v = { root, ink, sprite, label: name };
      this.views.set(p.id, v);
    }
    if (v.sprite.texture !== this.textures[type]) v.sprite.texture = this.textures[type];
    return v;
  }
  render(selected: string[], alpha: number) {
    const w = this.world;
    if (this.gate) this.gate.visible = !w.gateOpen;
    if (this.shutter) this.shutter.visible = !w.shutterOpen;
    if (w.time - this.coneTime > 0.12 || w.time < this.coneTime) {
      this.drawVision();
      this.coneTime = w.time;
    }
    this.cones.visible = this.showVision;
    const depthItems = this.scenery.filter((item) => item.root.visible);
    for (const p of people(w)) {
      const a = w.agents.find((a) => a.id === p.id),
        guard = w.guards.find((g) => g.id === p.id);
      const type = a ? (a.disguised ? 1 : 0) : guard ? 2 : 3;
      const v = this.person(p, type, a ? String(a.index + 1) : '');
      const pos = {
        x: p.previous.x + (p.x - p.previous.x) * alpha,
        y: p.previous.y + (p.y - p.previous.y) * alpha,
      };
      v.root.position.copyFrom(project(pos));
      depthItems.push({ root: v.root, footprint: { ...pos, w: 0, h: 0 } });
      v.sprite.pose(p, alpha);
      const color = a
        ? a.exposed
          ? COLORS.red
          : COLORS.mint
        : guard
          ? guard.mode === 'combat'
            ? COLORS.red
            : COLORS.amber
          : COLORS.amber;
      v.ink.clear().ellipse(0, 1, 11, 5).fill({ color: 0x0d1915, alpha: 0.7 });
      v.label.visible = !!a && living(p);
      v.label.style.fill = color;
      if (a && selected.includes(a.id)) v.ink.ellipse(0, 0, 12, 6).stroke({ color, width: 2 });
      if (living(p) && p.hp < p.maxHp) {
        v.ink.rect(-12, -38, 24, 3).fill(0x182522);
        v.ink.rect(-12, -38, (24 * p.hp) / p.maxHp, 3).fill(color);
      }
      if (guard && guard.mode !== 'patrol' && living(p)) {
        const suspicion = Math.max(...Object.values(guard.suspicion), 0);
        v.ink
          .rect(-12, -44, 24, 3)
          .fill(0x182522)
          .rect(-12, -44, (24 * suspicion) / 100, 3)
          .fill(color);
        if (guard.radio > 0) v.ink.circle(14, -35, 4).stroke({ color: COLORS.red, width: 2 });
      }
      if (a?.carrying)
        v.ink.rect(8, -14, 10, 9).fill(COLORS.amber).stroke({ color: 0x2b352d, width: 1 });
    }
    depthOrder(depthItems).forEach((item, index) => {
      item.root.zIndex = index;
    });
    for (const [id, icon] of this.icons) {
      icon.visible = available(w, id);
      icon.alpha = id === 'override' && w.overrideBy ? 0.6 : 1;
      icon.position.copyFrom(project(landmark(w, id), 1.45));
    }
    this.effects.clear();
    const van = landmark(w, 'extract');
    const vp = project(van);
    this.effects
      .ellipse(
        vp.x,
        vp.y,
        EXTRACTION_RADIUS * Math.SQRT2 * TILE_X,
        EXTRACTION_RADIUS * Math.SQRT2 * TILE_Y,
      )
      .stroke({ color: COLORS.mint, width: 1, alpha: 0.3 });
    for (const a of w.agents.filter((a) => selected.includes(a.id) && living(a))) {
      if (a.path.length) {
        const points = [a, ...a.path].map((p) => project(p));
        this.effects
          .poly(
            points.flatMap((p) => [p.x, p.y]),
            false,
          )
          .stroke({ color: COLORS.mint, width: 1, alpha: 0.45 });
        const dest = points[points.length - 1];
        this.effects.ellipse(dest.x, dest.y, 7, 4).stroke({ color: COLORS.mint, width: 1.5 });
      }
    }
    for (const t of w.traces) {
      const a = project(t.from, 0.6),
        b = project(t.to, 0.6);
      this.effects
        .moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({
          color: t.hostile ? COLORS.red : 0xf9eac1,
          width: 2,
          alpha: Math.min(1, t.life * 10),
        });
    }
  }
  private drawVision() {
    const g = this.cones;
    g.clear();
    for (const guard of this.world.guards.filter(living)) {
      const points = [project(guard)];
      for (let i = 0; i <= 22; i++) {
        const angle = guard.angle - Math.PI * 0.36 + (i / 22) * Math.PI * 0.72;
        let low = 0,
          high = 7.5;
        for (let j = 0; j < 7; j++) {
          const mid = (low + high) / 2;
          const p = { x: guard.x + Math.cos(angle) * mid, y: guard.y + Math.sin(angle) * mid };
          if (lineClear(this.world, guard, p)) low = mid;
          else high = mid;
        }
        points.push(
          project({ x: guard.x + Math.cos(angle) * low, y: guard.y + Math.sin(angle) * low }),
        );
      }
      polygon(
        g,
        points,
        guard.mode === 'combat' ? COLORS.red : COLORS.amber,
        guard.mode === 'combat' ? 0.13 : 0.09,
      );
    }
  }
}
