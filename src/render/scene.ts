import { Application, Container, Graphics, Polygon, Text } from 'pixi.js';
import {
  controllable,
  distance,
  inside,
  isCharge,
  isExtraction,
  living,
  people,
  EXTRACTION_RADIUS,
} from '../sim/types';
import type { ObjectKind, Person, Rect, Solid, Vec, World } from '../sim/types';
import { available, landmark } from '../sim/orders';
import { COIL_CHARGE, longGun, WEAPONS } from '../sim/weapons';
import { followOffset, selectionFocus } from './camera';
import { sightRange } from '../sim/awareness';
import { findPath, lineClear } from '../sim/navigation';
import { depthOrder } from './depth';
import { PersonSprite } from './person';
import type { Appearance } from './person';
import { project, TILE_X, TILE_Y } from './isometric';
import { drawVan } from './van';
import { courierGuard } from '../sim/courier';
import { guideLocation } from '../ui/objectives';
import type { GuideTarget } from '../ui/objectives';
import { extractionRequirement } from '../ui/extraction';
import { objectRequirement } from '../ui/interactions';
import { demolished } from '../sim/demolition';
import { turretPowered, TURRET_ARC } from '../sim/security';
import { circuitColor, drawTurret } from './turret';

const COLORS = {
  ground: 0x263331,
  concrete: 0x43504a,
  road: 0x202b2b,
  mint: 0x8be8c4,
  amber: 0xefbd73,
  red: 0xf57869,
};
const markerColor = (id: ObjectKind) =>
  isExtraction(id)
    ? COLORS.mint
    : id === 'escort' ||
        id === 'evidence' ||
        id === 'upload' ||
        isCharge(id) ||
        id === 'access-intake'
      ? COLORS.amber
      : id === 'access-cells'
        ? 0x78becd
        : id === 'power-west' || id === 'power-east'
          ? circuitColor(id)
          : 0xa8c2b3;
function drawMarker(mark: Graphics, id: ObjectKind, locked: boolean) {
  mark.clear();
  if (locked) {
    // A padlock replaces the diamond: state is readable without relying on color.
    mark.roundRect(-4, -9, 8, 10, 4).stroke({ color: 0xa5aba8, width: 1.5 });
    mark.roundRect(-6, -3, 12, 11, 2).fill(0x25312d).stroke({ color: 0xa5aba8, width: 1.5 });
    mark.circle(0, 1, 1.3).fill(0xa5aba8).rect(-0.6, 1, 1.2, 3).fill(0xa5aba8);
  } else {
    mark
      .poly([0, -9, 7, 0, 0, 9, -7, 0])
      .fill({ color: 0x162722, alpha: 0.9 })
      .stroke({ color: markerColor(id), width: 1.5 });
  }
}
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
  private cores: { intact: Graphics; wreck: Graphics }[] = [];
  private icons = new Map<ObjectKind, Container>();
  private markerLocks = new Map<ObjectKind, boolean>();
  private transferRoutes: Graphics[] = [];
  private labels = new Set<Text>();
  private labelResolution = 2;
  private gate: Graphics | null = null;
  private shutter: Graphics | null = null;
  private detentionGates: { root: Graphics; id: ObjectKind }[] = [];
  private world: World;
  private fit = 1;
  zoom = 1;
  private offset = { x: 0, y: 0 };
  private pan = { x: 0, y: 0 };
  private coneTime = -1;
  private resizeObserver: ResizeObserver;
  private resizePending = true;
  private homePending = true;
  following = true;
  private followScale = 0.95;
  private followLead: Vec | null = null;
  private pointerActive = false;
  private followDelay = 0;
  private selectionSnap = false;
  private selectionKey = '';
  private guideLayer = document.createElement('div');
  private guideMarkers = new Map<GuideTarget, HTMLElement>();
  private guidePanel: Rect = { x: 0, y: 0, w: 0, h: 0 };
  showVision = true;
  constructor(
    private host: HTMLElement,
    world: World,
  ) {
    this.world = world;
    this.resizeObserver = new ResizeObserver(() => {
      this.resizePending = true;
    });
  }
  async init() {
    await this.app.init({
      background: 0x1a2626,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(devicePixelRatio, 2),
      preference: 'webgl',
    });
    // Browser tests share a software GPU. Cap presentation work there while the
    // fixed-step simulation and real input handling continue at their usual rates.
    if (import.meta.env.DEV && import.meta.env.VITE_BROWSER_TEST === 'true')
      this.app.ticker.maxFPS = 15;
    this.host.appendChild(this.app.canvas);
    this.app.canvas.tabIndex = 0;
    this.guideLayer.className = 'objective-locators';
    this.guideLayer.setAttribute('aria-hidden', 'true');
    this.host.appendChild(this.guideLayer);
    this.app.canvas.setAttribute(
      'aria-label',
      'Tactical map. Select operatives with 1 to 4; right-click to order.',
    );
    this.app.canvas.setAttribute('role', 'img');
    this.camera.addChild(this.floor, this.cones, this.objects, this.marks, this.effects);
    this.objects.sortableChildren = true;
    this.app.stage.addChild(this.camera);
    this.build();
    this.resizeObserver.observe(this.host);
  }
  reset(world: World) {
    this.world = world;
    this.showGuidance([], { x: 0, y: 0, w: 0, h: 0 });
    this.views.clear();
    this.labels.clear();
    this.scenery = [];
    this.cores = [];
    this.shutter = null;
    this.detentionGates = [];
    this.coneTime = -1;
    this.icons.clear();
    this.markerLocks.clear();
    this.transferRoutes = [];
    this.objects.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.marks.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.build();
    // Fit once the new mission's HUD has replaced the previous layout.
    this.resizePending = true;
    this.homePending = true;
    this.selectionKey = '';
    this.followScale = 0.95;
    this.followLead = null;
    this.pointerActive = false;
    this.followDelay = 0;
    this.selectionSnap = false;
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
    } else if (mission.id === 'archive') {
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
    } else if (mission.transfer) {
      plane(g, 6.5, 0, 1, 22, 0x59645e);
      plane(g, 7.5, 21.6, 25.5, 0.55, 0x657168);
      plane(g, 8.5, 11.4, 22.7, 3.7, 0x35423e);
      plane(g, 26.3, 3.4, 1.9, 17.1, 0x35423e);
      const s = mission.secure;
      plane(g, s.x, s.y, s.w, s.h, 0x746752, 0, 0.55);
      for (let x = 9; x < 31; x += 2) plane(g, x, 13, 0.8, 0.09, 0x89907a);
      for (let y = 4; y < 21; y += 2.5) plane(g, 33.8, y, 0.1, 1.15, 0xb4af8e);
      for (const bay of [mission.transfer.inspection, mission.transfer.checkpoint]) {
        plane(g, bay.x - 1.5, bay.y - 1.6, 3, 3.2, 0x766746, 0, 0.3);
        for (let x = bay.x - 1.5; x < bay.x + 1.5; x += 0.5)
          plane(g, x, bay.y + 1.5, 0.25, 0.16, COLORS.amber);
        const label = this.label(
          bay === mission.transfer.inspection ? 'INSPECTION' : 'CHECKPOINT',
          9,
          COLORS.amber,
        );
        label.position.copyFrom(project({ x: bay.x - 1.5, y: bay.y - 1.5 }));
        label.skew.y = Math.atan(TILE_Y / TILE_X);
        this.addScenery(label, { ...bay, w: 0, h: 0 });
      }
      for (const end of [mission.transfer.checkpoint, mission.transfer.inspection]) {
        const route = new Graphics();
        const { start, junction } = mission.transfer;
        const points = [
          start,
          ...findPath(world, start, junction),
          ...findPath(world, junction, end),
        ].map((p) => project(p, 0.02));
        route
          .poly(
            points.flatMap((p) => [p.x, p.y]),
            false,
          )
          .stroke({ color: COLORS.amber, width: 2, alpha: 0.7 });
        const tip = points.at(-1)!;
        route.circle(tip.x, tip.y, 6).stroke({ color: COLORS.amber, width: 2 });
        this.transferRoutes.push(route);
        this.addScenery(route, { x: 0, y: 0, w: 0, h: 0 });
      }
    }
    if (mission.id === 'clearing') {
      // Two freight lanes with a continuous, screened maintenance walk to the vault.
      plane(g, 5.1, 3, 1.8, 37, 0x53615b);
      plane(g, 10, 29.8, 43, 3.7, 0x35423e);
      plane(g, 35.5, 20, 18, 4, 0x35423e);
      plane(g, 10, 16.5, 43, 2.8, 0x566459);
      plane(g, 10, 19.3, 25, 0.15, 0xa6ad8b);
      for (let x = 12; x < 53; x += 3) plane(g, x, 31.6, 1.2, 0.12, 0xb4af8e);
      for (let y = 6; y < 38; y += 3) plane(g, 56.6, y, 0.12, 1.2, 0xb4af8e);
      const s = mission.secure;
      plane(g, s.x, s.y, s.w, s.h, 0x746752, 0, 0.65);
      for (let x = 44; x < 47; x += 0.5) plane(g, x, 16.5, 0.25, 0.18, COLORS.amber);
    }
    if (mission.security) {
      plane(g, 9.5, 24.5, 36, 3.5, 0x35443e);
      plane(g, 9.5, 4, 1.7, 28, 0x5c6a5e);
      plane(g, 19.5, 15.6, 14, 2, 0x526257);
      plane(g, 34.4, 5.4, 9.2, 10.5, 0x665a45, 0, 0.6);
      for (const turret of mission.security.turrets) {
        for (const [i, point] of turret.cable.entries()) {
          const p = project(point, 0.015);
          if (!i) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.stroke({ color: circuitColor(turret.circuit), width: 2.5, alpha: 0.8 });
        const ring = project(turret.position);
        g.ellipse(ring.x, ring.y, 27, 14).stroke({ color: circuitColor(turret.circuit), width: 2 });
      }
    }
    if (mission.broadcast) {
      plane(g, 5.3, 2, 1.7, 25, 0x53615b);
      plane(g, 35, 3, 3.5, 24, 0x35423e);
      const s = mission.secure;
      plane(g, s.x, s.y, s.w, s.h, 0x6b604c, 0, 0.65);
      // Cable trays connect the aerial bases to the server room.
      for (const y of [6.2, 11]) {
        plane(g, 20, y, 4.9, 0.2, 0x23322e);
        plane(g, 20, y + 0.07, 4.9, 0.04, 0x9ca98d);
      }
      for (let x = 27.5; x < 30.8; x += 0.5) plane(g, x, 11.7, 0.25, 0.15, COLORS.amber);
      for (let y = 4; y < 27; y += 2.5) plane(g, 37.6, y, 0.12, 1.2, 0xb4af8e);
      plane(g, 9, 13, 15.5, 1.3, 0x53625a, 0, 0.4);
      const label = this.label('EXCHANGE / 11', 10, 0x9bb5ab);
      label.position.copyFrom(project({ x: 15, y: 22.7 }));
      label.skew.y = Math.atan(TILE_Y / TILE_X);
      this.addScenery(label, { x: 15, y: 22.7, w: 0, h: 0 });
    }
    if (mission.demolition) {
      plane(g, 10.35, 3.35, 9.65, 8.3, 0x53655f, 0, 0.5);
      plane(g, 20.35, 3.35, 13.65, 8.3, 0x53655f, 0, 0.5);
      plane(g, 8.35, 12.1, 25.65, 0.4, 0xb8a06d, 0, 0.6);
      for (let y = 7; y < 28; y += 2.5) plane(g, 37, y, 0.12, 1.2, 0xb4af8e);
    }
    if (mission.escort?.locked) {
      plane(g, 6.5, 0, 1, 29, 0x59645e);
      plane(g, 33, 3, 3.5, 23, 0x35423e);
      plane(g, 8.5, 13.55, 20.8, 2.9, 0x344b48);
      plane(g, 24, 16, 6.8, 6.8, 0x605b4a, 0, 0.45);
      plane(g, 10.35, 4.35, 5.3, 5.15, 0x746752, 0, 0.6);
      for (let y = 4; y < 27; y += 2.5) plane(g, 35.7, y, 0.12, 1.2, 0xb4af8e);
      for (let x = 24; x < 30.8; x += 0.5) plane(g, x, 21.6, 0.25, 0.15, COLORS.amber);
      for (let x = 10; x < 23; x += 3) {
        const label = this.label('‹', 16, 0x8fa89a);
        label.position.copyFrom(project({ x, y: 14.6 }));
        label.skew.y = Math.atan(TILE_Y / TILE_X);
        this.addScenery(label, { x, y: 14.6, w: 0, h: 0 });
      }
      const label = this.label('SERVICE CORRIDOR', 9, 0x9db5a6);
      label.position.copyFrom(project({ x: 12, y: 14 }));
      label.skew.y = Math.atan(TILE_Y / TILE_X);
      this.addScenery(label, { x: 12, y: 14, w: 0, h: 0 });
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
    if (mission.detention) {
      for (const { id, door: d } of [...mission.detention.gates, ...mission.detention.cells]) {
        const root = new Graphics();
        const color =
          id === 'access-intake' ? 0xe2b369 : id === 'access-cells' ? 0x78becd : 0x9faaa1;
        box(root, d.x, d.y, d.w, d.h, 1.4, color, 0x485e55, 0x344a42);
        this.addScenery(root, d);
        this.detentionGates.push({ root, id });
        plane(g, d.x - 0.7, d.y, 1.7, d.h, color, 0, 0.22);
        if (id === 'access-intake' || id === 'access-cells') {
          const label = this.label(id === 'access-intake' ? 'INTAKE' : 'CELLS', 10, color);
          label.position.copyFrom(project({ x: d.x, y: d.y + d.h / 2 }, 1.65));
          label.anchor.set(0.5, 1);
          this.marks.addChild(label);
        }
      }
    }
    const office = this.label(
      mission.detention
        ? 'PERSONNEL RETENTION / 09'
        : mission.security
          ? 'RECORDS / 08'
          : mission.demolition
            ? 'RECOVERY CORES / RESTRICTED'
            : mission.broadcast
              ? 'RESTRICTED / UPLINK'
              : mission.escort?.locked
                ? 'TRANSFER RECORDS'
                : mission.transfer
                  ? 'CUSTOMS'
                  : mission.archive
                    ? 'SECURE ARCHIVE'
                    : 'SECURE OFFICE',
      10,
      0xf0c68b,
    );
    office.position.copyFrom(
      mission.transfer
        ? project({ x: 25, y: 6.5 }, 2.4)
        : project({ x: mission.secure.x + mission.secure.w / 2, y: mission.secure.y + 0.5 }, 1.8),
    );
    office.anchor.set(0.5, 1);
    this.marks.addChild(office);
    const road = this.label(
      mission.detention
        ? 'VISITORS / WEST SERVICE STREET'
        : mission.demolition
          ? 'DEBT RECOVERY / 12'
          : mission.broadcast
            ? 'MUNICIPAL COMMUNICATIONS / 11'
            : mission.escort?.locked
              ? 'REMAND TRANSFERS / 04'
              : mission.transfer
                ? 'BONDED TRANSFER / 09'
                : mission.id === 'depot'
                  ? 'MUNICIPAL TRANSIT / 06'
                  : mission.id === 'clearing'
                    ? 'BONDED FREIGHT / NO PUBLIC ACCESS'
                    : 'CIVIC RECORDS / NO PUBLIC ACCESS',
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
      drawMarker(mark, o.id, false);
      this.markerLocks.set(o.id, false);
      const label = this.label(o.tag, 10, markerColor(o.id));
      label.anchor.set(0.5, 1);
      label.y = -12;
      root.addChild(mark, label, new Graphics());
      this.icons.set(o.id, root);
      this.marks.addChild(root);
    }
  }
  private label(value: string, size = 12, color = 0xd4ded6) {
    const label = text(value, size, color);
    label.resolution = this.labelResolution;
    this.labels.add(label);
    return label;
  }
  private addScenery(root: Container, footprint: Rect) {
    this.scenery.push({ root, footprint });
    this.objects.addChild(root);
  }
  private addSolid(s: Solid) {
    const root = new Container(),
      g = new Graphics();
    root.addChild(g);
    if (s.kind === 'van' || s.kind === 'transport') {
      drawVan(g, s);
    } else if (s.kind === 'mast') {
      box(g, s.x, s.y, s.w, s.h, 0.3, 0x77867b, 0x52645d, 0x3a4d47);
      const center = { x: s.x + s.w / 2, y: s.y + s.h / 2 };
      const peak = project(center, s.height);
      const line = (a: Vec, b: Vec, color = 0x9baea1, width = 2) =>
        g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color, width });
      for (const dx of [-0.75, 0.75]) {
        for (const dy of [-0.75, 0.75]) {
          const foot = { x: center.x + dx, y: center.y + dy };
          line(project(foot, 0.3), peak);
          line(
            project(foot, 0.3),
            project({ x: center.x - dx * 0.5, y: center.y - dy * 0.5 }, 2.1),
            0x5d786c,
            1.3,
          );
        }
      }
      for (const z of [2.5, 3.2]) {
        line(
          project({ x: center.x - 0.8, y: center.y }, z),
          project({ x: center.x + 0.8, y: center.y }, z),
          0xb4c3b7,
          3,
        );
        line(
          project({ x: center.x, y: center.y - 0.8 }, z),
          project({ x: center.x, y: center.y + 0.8 }, z),
          0x7d9d90,
          3,
        );
      }
      g.circle(peak.x, peak.y, 2.5).fill(COLORS.amber);
    } else if (s.kind === 'server') {
      box(g, s.x, s.y, s.w, s.h, s.height, 0x4a6260, 0x294343, 0x1e3639);
      for (let x = s.x + 0.15; x < s.x + s.w - 0.1; x += 0.55) {
        for (let z = 0.35; z < s.height - 0.1; z += 0.27) {
          panel(
            g,
            { x, y: s.y + s.h },
            { x: Math.min(x + 0.35, s.x + s.w - 0.1), y: s.y + s.h },
            z,
            z + 0.06,
            0x58736d,
          );
          const light = project({ x, y: s.y + s.h + 0.01 }, z + 0.03);
          g.circle(light.x, light.y, 1).fill(COLORS.mint);
        }
      }
      if (this.world.mission.demolition) {
        const wreck = new Graphics();
        box(wreck, s.x, s.y, s.w, s.h, 0.45, 0x39332d, 0x272523, 0x1d2220);
        for (let i = 0; i < 5; i++) {
          const x = s.x + 0.15 + i * 0.75;
          box(wreck, x, s.y + 0.2, 0.3, s.h - 0.4, i % 2 ? 0.7 : 1.1, 0x64594c, 0x413d37, 0x292e2b);
          plane(wreck, x + 0.32, s.y + 0.3, 0.3, s.h - 0.6, 0x6c6251, 0.5);
        }
        wreck.visible = false;
        root.addChild(wreck);
        this.cores.push({ intact: g, wreck });
      }
    } else if (s.kind === 'container') {
      // Paired sealed cargo containers share one collision footprint.
      for (let i = 0; i < 2; i++) {
        const y = s.y + (i * s.h) / 2,
          h = s.h / 2 - 0.04;
        box(g, s.x, y, s.w, h, s.height, 0x526d70, 0x3d5b60, 0x2e484e);
        for (let x = s.x + 0.3; x < s.x + s.w - 0.2; x += 0.4) {
          panel(g, { x, y: y + h }, { x: x + 0.07, y: y + h }, 0.16, s.height - 0.12, 0x698186);
          plane(g, x, y + 0.12, 0.07, h - 0.24, 0x718586, s.height + 0.01);
        }
        for (const dy of [0.2, h / 2, h - 0.2])
          panel(
            g,
            { x: s.x + s.w, y: y + dy },
            { x: s.x + s.w, y: y + dy + 0.04 },
            0.15,
            s.height - 0.15,
            0x8b9890,
          );
        panel(
          g,
          { x: s.x + s.w, y: y + h / 2 - 0.18 },
          { x: s.x + s.w, y: y + h / 2 + 0.18 },
          0.45,
          0.65,
          COLORS.amber,
        );
      }
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
      for (let x = s.x + 1.5; x < s.x + s.w - 0.75; x += 3) {
        const y = s.y + s.h + 0.012;
        // Downward spill lies on the vertical wall face, with nested pools of light.
        for (const [width, bottom, opacity] of [
          [0.64, 0.12, 0.05],
          [0.47, 0.3, 0.07],
          [0.26, 0.64, 0.09],
        ]) {
          polygon(
            g,
            [
              project({ x: x - 0.07, y }, 1.28),
              project({ x: x + 0.07, y }, 1.28),
              project({ x: x + width, y }, bottom),
              project({ x: x - width, y }, bottom),
            ],
            0xe8ba76,
            opacity,
          );
        }
        panel(g, { x: x - 0.12, y }, { x: x + 0.12, y }, 1.26, 1.43, 0x353f37);
        panel(
          g,
          { x: x - 0.085, y: y + 0.005 },
          { x: x + 0.085, y: y + 0.005 },
          1.28,
          1.34,
          0xf3c58a,
        );
      }
    }
    if (s.id === 'south-a' || s.id === 'annex-front') {
      const label = this.label(s.id === 'south-a' ? 'DEPOT 06' : 'RECORDS / 02', 22, 0xc3c4a8);
      label.position.copyFrom(project({ x: s.x + 1, y: s.y + s.h + 0.1 }, 1.3));
      label.skew.y = Math.atan(TILE_Y / TILE_X);
      root.addChild(label);
    }
    this.addScenery(root, s);
  }
  private resize() {
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    if (!width || !height) return;
    const previous = this.app.screen;
    if (width === previous.width && height === previous.height) return;
    // HUD panels and wrapped COMMS text change the viewport, not the player's camera.
    this.pan.x += (previous.width - width) / 2;
    this.pan.y += (previous.height - height) / 2;
    this.app.renderer.resize(width, height);
    this.updateCamera();
  }
  private updateCamera() {
    const scale = this.fit * this.zoom;
    this.camera.scale.set(scale);
    // Text is rasterized for the current physical pixel scale, including high-DPI zoom.
    // Half-step buckets avoid rebuilding glyph textures on every small wheel event.
    const resolution = Math.max(2, Math.ceil(scale * this.app.renderer.resolution * 2) / 2);
    if (resolution !== this.labelResolution) {
      this.labelResolution = resolution;
      for (const label of this.labels) label.resolution = resolution;
    }
    this.offset = {
      x:
        this.app.screen.width / 2 -
        ((this.world.mission.width - this.world.mission.height) / 2) * TILE_X * scale +
        this.pan.x,
      y:
        this.app.screen.height / 2 -
        ((this.world.mission.width + this.world.mission.height) / 2) * TILE_Y * scale +
        this.pan.y +
        25 * scale,
    };
    this.camera.position.set(this.offset.x, this.offset.y);
  }
  private overviewScale() {
    return Math.min(
      this.app.screen.width /
        ((this.world.mission.width + this.world.mission.height) * TILE_X + 80),
      this.app.screen.height /
        ((this.world.mission.width + this.world.mission.height) * TILE_Y + 110),
    );
  }
  home() {
    if (this.following) this.followScale = this.camera.scale.x;
    this.following = false;
    this.selectionSnap = false;
    this.fit = this.overviewScale();
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.updateCamera();
  }
  zoomBy(delta: number) {
    const center = { x: this.app.screen.width / 2, y: this.app.screen.height / 2 };
    const anchor = this.toWorld(center.x, center.y);
    this.zoom = Math.max(0.4, Math.min(3 / this.fit, this.zoom * delta));
    this.updateCamera();
    const after = this.screen(anchor);
    this.pan.x += center.x - after.x;
    this.pan.y += center.y - after.y;
    this.updateCamera();
    this.followScale = this.camera.scale.x;
  }
  panBy(x: number, y: number) {
    this.following = false;
    this.selectionSnap = false;
    this.pan.x += x;
    this.pan.y += y;
    this.updateCamera();
  }
  follow(selected: string[], restoreScale = false) {
    this.following = true;
    // Consume explicit selection now. A later Fit map/pan before the next
    // frame must not be mistaken for an unseen selection change during render.
    const key = selected.join(',');
    if (key !== this.selectionKey) {
      this.followLead = null;
      this.selectionSnap = selected.length === 1;
    }
    this.selectionKey = key;
    // A portrait/key selection is a new navigation intent, not part of the previous map gesture.
    if (!this.pointerActive) this.followDelay = 0;
    if (restoreScale) {
      this.zoom = Math.max(this.fit, this.followScale) / this.fit;
      this.updateCamera();
      this.selectionSnap = true;
    }
    if (this.selectionSnap && !this.pointerActive) {
      this.trackSelection(selected, 1, true);
      this.selectionSnap = false;
    }
  }
  setPointerActive(active: boolean) {
    if (this.pointerActive && !active) this.followDelay = this.selectionSnap ? 0 : 0.25;
    this.pointerActive = active;
  }
  private trackSelection(
    selected: string[],
    alpha: number,
    center = false,
    seconds = this.app.ticker.deltaMS / 1000,
  ) {
    // A fully visible map needs no translation. Zoom and selection never auto-fit the crew.
    if (
      !this.following ||
      this.pointerActive ||
      this.followDelay > 0 ||
      this.camera.scale.x <= this.overviewScale() * 1.02
    )
      return;
    const target = selectionFocus(this.world, selected, alpha);
    if (!target) return;
    const lead = project(target.lookAhead),
      scale = this.camera.scale.x;
    const desired = { x: lead.x * scale, y: lead.y * scale };
    if (!this.followLead || center) this.followLead = desired;
    else {
      // Turns in a tiled path and automatic aim changes should not whip the view around.
      const blend = 1 - Math.exp(-2 * Math.max(0, Math.min(seconds, 0.1)));
      this.followLead.x += (desired.x - this.followLead.x) * blend;
      this.followLead.y += (desired.y - this.followLead.y) * blend;
    }
    const spread = target.members.map((p) => project({ x: p.x - target.x, y: p.y - target.y }));
    const offset = followOffset(
      this.screen(target),
      this.followLead,
      {
        width: this.app.screen.width,
        height: this.app.screen.height,
        scale,
        inset: {
          x: Math.max(...spread.map((p) => Math.abs(p.x))) * scale + 22,
          y: Math.max(...spread.map((p) => Math.abs(p.y))) * scale + 50,
        },
      },
      seconds,
      center,
    );
    if (Math.abs(offset.x) + Math.abs(offset.y) < 0.01) return;
    this.pan.x += offset.x;
    this.pan.y += offset.y;
    this.updateCamera();
  }
  showGuidance(ids: GuideTarget[], panel: Rect) {
    this.guidePanel = panel;
    for (const [id, marker] of this.guideMarkers) {
      if (!ids.includes(id)) {
        marker.remove();
        this.guideMarkers.delete(id);
      }
    }
    for (const id of ids) {
      const location = guideLocation(this.world, id);
      if (!location || this.guideMarkers.has(id)) continue;
      const marker = document.createElement('div');
      marker.className = 'objective-locator';
      marker.dataset.target = id;
      marker.innerHTML = '<i class="locator-ring"></i><i class="locator-arrow"></i><span></span>';
      marker.querySelector('span')!.textContent = location.tag;
      this.guideLayer.appendChild(marker);
      this.guideMarkers.set(id, marker);
    }
    const description = ids.length
      ? `Highlighted mission items: ${ids
          .map((id) => guideLocation(this.world, id)?.tag)
          .filter(Boolean)
          .join(', ')}.`
      : '';
    if (this.app.canvas.getAttribute('aria-description') !== description)
      this.app.canvas.setAttribute('aria-description', description);
    this.drawGuidance();
  }
  focusGuidance() {
    const points = [...this.guideMarkers.keys()].flatMap((id) => {
      const p = guideLocation(this.world, id);
      return p ? [project(p, p.z)] : [];
    });
    if (!points.length) return;
    this.following = false;
    const wide = this.host.clientWidth > 800;
    const left = wide ? this.guidePanel.x + this.guidePanel.w + 45 : 45;
    const right = this.host.clientWidth - 45,
      bottom = this.host.clientHeight - 60;
    const top = Math.min(wide ? 80 : this.guidePanel.y + this.guidePanel.h + 50, bottom);
    const minX = Math.min(...points.map((p) => p.x)),
      maxX = Math.max(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y)),
      maxY = Math.max(...points.map((p) => p.y));
    this.zoom = Math.max(
      0.4,
      Math.min(
        3 / this.fit,
        Math.max(50, right - left) / Math.max(240, maxX - minX) / this.fit,
        Math.max(50, bottom - top) / Math.max(140, maxY - minY) / this.fit,
      ),
    );
    this.updateCamera();
    const screenPoints = [...this.guideMarkers.keys()]
      .map((id) => this.markerScreen(id)!)
      .filter(Boolean);
    this.panBy(
      (left + right) / 2 -
        (Math.min(...screenPoints.map((p) => p.x)) + Math.max(...screenPoints.map((p) => p.x))) / 2,
      // Even a narrow strip must be centered below the guide. Reserving a
      // minimum height here used to push a single focused marker behind it.
      (top + bottom) / 2 -
        (Math.min(...screenPoints.map((p) => p.y)) + Math.max(...screenPoints.map((p) => p.y))) / 2,
    );
    this.drawGuidance();
  }
  private drawGuidance() {
    if (!this.guideMarkers.size) return;
    const positions: Vec[] = [];
    const width = this.host.clientWidth,
      height = this.host.clientHeight;
    for (const [id, marker] of this.guideMarkers) {
      const p = guideLocation(this.world, id);
      if (!p) continue;
      const locked = id !== 'inspection' && this.markerLocks.get(id);
      marker.classList.toggle('is-locked', !!locked);
      const label = `${p.tag}${locked ? ' · LOCKED' : ''}`;
      const caption = marker.querySelector('span')!;
      if (caption.textContent !== label) caption.textContent = label;
      const actual = this.markerScreen(id)!;
      let x = Math.max(45, Math.min(width - 45, actual.x));
      let y = Math.max(80, Math.min(height - 60, actual.y));
      // Keep a locator visible when its subject is off screen or underneath the help panel.
      if (
        x < this.guidePanel.x + this.guidePanel.w + 35 &&
        y < this.guidePanel.y + this.guidePanel.h + 45
      )
        y = Math.min(height - 60, this.guidePanel.y + this.guidePanel.h + 45);
      const offscreen = Math.abs(x - actual.x) > 1 || Math.abs(y - actual.y) > 1;
      if (offscreen) {
        const candidates = [{ x, y }];
        for (let i = 1; i <= 8; i++) {
          const offset = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
          candidates.push(
            x === 45 || x === width - 45 ? { x, y: y + offset * 58 } : { x: x + offset * 90, y },
          );
        }
        for (let px = 45; px <= width - 45; px += 90) candidates.push({ x: px, y: height - 60 });
        const free = candidates.find(
          (p) =>
            p.x >= 45 &&
            p.x <= width - 45 &&
            p.y >= 80 &&
            p.y <= height - 60 &&
            !(
              p.x < this.guidePanel.x + this.guidePanel.w + 35 &&
              p.y < this.guidePanel.y + this.guidePanel.h + 45
            ) &&
            !positions.some((q) => Math.abs(q.x - p.x) < 85 && Math.abs(q.y - p.y) < 55),
        );
        if (free) {
          x = free.x;
          y = free.y;
        }
      }
      marker.classList.toggle('is-offscreen', offscreen);
      marker.classList.toggle(
        'label-below',
        !offscreen && positions.some((q) => Math.abs(q.x - x) < 90 && Math.abs(q.y - y) < 55),
      );
      marker.style.transform = `translate(${x}px, ${y}px)`;
      marker.style.setProperty('--bearing', `${Math.atan2(actual.y - y, actual.x - x)}rad`);
      positions.push({ x, y });
    }
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
  markerScreen(id: GuideTarget): Vec | null {
    const p = guideLocation(this.world, id);
    if (!p) return null;
    if (
      id === 'escort' ||
      (id === 'evidence' && ['courier', 'carried'].includes(this.world.evidence))
    ) {
      const head = this.screen(p, 1.6);
      // A screen-space gap also clears the pulsing guide ring at minimum zoom.
      return { x: head.x, y: head.y - Math.max(32, 14 * this.camera.scale.x) };
    }
    return this.screen(p, p.z);
  }
  agentBounds(p: Vec): Rect {
    const foot = this.screen(p),
      scale = this.fit * this.zoom;
    // Select the visible body, including a little tolerance at low zoom.
    const halfWidth = Math.max(4, 9 * scale),
      height = Math.max(12, 36 * scale);
    return { x: foot.x - halfWidth, y: foot.y - height, w: halfWidth * 2, h: height + 2 };
  }
  hit(x: number, y: number, prioritizeObjects = false): Hit {
    const p = { x, y };
    const object = this.world.mission.landmarks
      .filter(
        (o) =>
          (available(this.world, o.id) ||
            isCharge(o.id) ||
            (o.id === 'escort' && this.world.escortLocked) ||
            (o.id === 'evidence' && this.world.evidence === 'courier')) &&
          distance(p, this.markerScreen(o.id)!) < 19,
      )
      .sort(
        (a, b) => distance(p, this.markerScreen(a.id)!) - distance(p, this.markerScreen(b.id)!),
      )[0];
    // Use the projected vehicle silhouette, not just the tiny floating marker.
    const van = this.world.mission.solids.find(
      (s) =>
        s.kind === 'van' &&
        new Polygon([
          this.screen(s, s.height),
          this.screen({ x: s.x + s.w, y: s.y }, s.height),
          this.screen({ x: s.x + s.w, y: s.y }),
          this.screen({ x: s.x + s.w, y: s.y + s.h }),
          this.screen({ x: s.x, y: s.y + s.h }),
          this.screen({ x: s.x, y: s.y + s.h }, s.height),
        ]).contains(x, y),
    );
    const exit =
      van &&
      this.world.mission.landmarks
        .filter((o) => isExtraction(o.id))
        .sort((a, b) => distance(a, van) - distance(b, van))[0];
    const courier = this.world.evidence === 'courier' ? courierGuard(this.world) : null;
    if (prioritizeObjects && object?.id === 'evidence' && courier && living(courier)) {
      const bodyDistance = distance(p, this.screen(courier, 0.5));
      if (bodyDistance < 18 && bodyDistance < distance(p, this.markerScreen('evidence')!))
        return { kind: 'guard', id: courier.id };
    }
    // An order aimed at a diamond must still reach it when the crew crowds it.
    // Ordinary left-click selection keeps operatives first.
    if (prioritizeObjects && exit) return { kind: 'object', id: exit.id };
    if (prioritizeObjects && object) return { kind: 'object', id: object.id };
    const prisoner = this.world.agents.find(
      (a) => a.captive && distance(p, this.screen(a, 0.5)) < 20,
    );
    if (prisoner)
      return {
        kind: 'object',
        id: this.world.mission.detention!.cells.find((c) => c.agent === prisoner.index)!.id,
      };
    const agent = this.world.agents
      .filter(controllable)
      .map((a) => ({ a, distance: distance(p, this.screen(a, 0.5)) }))
      .sort((a, b) => a.distance - b.distance)[0];
    if (agent && agent.distance < 20) return { kind: 'agent', id: agent.a.id };
    if (exit) return { kind: 'object', id: exit.id };
    if (object) return { kind: 'object', id: object.id };
    if (this.world.escort && distance(p, this.screen(this.world.escort, 0.5)) < 18)
      return { kind: 'object', id: 'escort' };
    for (const g of this.world.guards.filter(living))
      if (distance(p, this.screen(g, 0.5)) < 18) return { kind: 'guard', id: g.id };
    return { kind: 'ground', point: this.toWorld(x, y) };
  }
  private person(p: Person, label: string): PersonView {
    let v = this.views.get(p.id);
    if (!v) {
      const root = new Container(),
        ink = new Graphics(),
        sprite = new PersonSprite();
      const name = this.label(label, 11);
      name.anchor.set(0.5, 1);
      name.y = -40;
      root.addChild(ink, sprite, name);
      this.objects.addChild(root);
      v = { root, ink, sprite, label: name };
      this.views.set(p.id, v);
    }
    return v;
  }
  render(selected: string[], alpha: number, seconds = this.app.ticker.deltaMS / 1000) {
    this.followDelay = Math.max(0, this.followDelay - Math.max(0, Math.min(seconds, 0.1)));
    // Resize only immediately before drawing, so a ResizeObserver cannot clear
    // the WebGL canvas between frames (e.g. when picking up the mission item).
    if (this.resizePending) {
      this.resizePending = false;
      this.resize();
    }
    if (this.homePending) {
      this.homePending = false;
      this.home();
      this.following = true;
      this.followScale = 0.95;
      if (this.world.mission.trackingCamera) {
        this.zoom = Math.max(this.fit, this.followScale) / this.fit;
        this.updateCamera();
        this.trackSelection(selected, alpha, true);
      }
    }
    const selectionKey = selected.join(',');
    if (this.selectionKey && selectionKey !== this.selectionKey) {
      this.following = true;
      this.followLead = null;
      // Automatic survivor selection retains smooth tracking. Explicit switches
      // enter through follow(), which consumes the selection before this frame.
      this.selectionSnap = false;
    }
    this.trackSelection(selected, alpha, this.selectionSnap, seconds);
    if (!this.pointerActive && this.followDelay <= 0) this.selectionSnap = false;
    this.selectionKey = selectionKey;
    const w = this.world;
    this.drawGuidance();
    this.transferRoutes.forEach((route, i) => {
      route.visible = w.evidence === 'courier' && i === Number(w.courier?.diverted);
    });
    if (this.gate) this.gate.visible = !w.gateOpen;
    if (this.shutter) this.shutter.visible = !w.shutterOpen;
    for (const gate of this.detentionGates)
      gate.root.visible =
        gate.id === 'access-intake' || gate.id === 'access-cells'
          ? !w.detention!.open.includes(gate.id)
          : !!w.agents[w.mission.detention!.cells.find((c) => c.id === gate.id)!.agent].captive;
    if (w.time - this.coneTime > 0.12 || w.time < this.coneTime) {
      this.drawVision();
      this.coneTime = w.time;
    }
    this.cones.visible = this.showVision;
    const depthItems = this.scenery.filter((item) => item.root.visible);
    for (const p of people(w)) {
      if (p === w.escort && w.escortLocked && !w.escort.recruited) continue;
      const a = w.agents.find((a) => a.id === p.id),
        guard = w.guards.find((g) => g.id === p.id);
      const appearance: Appearance = a
        ? (['morrow', 'vale', 'rook', 'sable'] as const)[a.index]
        : guard
          ? 'guard'
          : w.mission.escort?.id === 'voss'
            ? 'voss'
            : 'mara';
      const v = this.person(p, a ? String(a.index + 1) : '');
      const pos = {
        x: p.previous.x + (p.x - p.previous.x) * alpha,
        y: p.previous.y + (p.y - p.previous.y) * alpha,
      };
      v.root.position.copyFrom(project(pos));
      depthItems.push({ root: v.root, footprint: { ...pos, w: 0, h: 0 } });
      const cargo = !!a?.carrying || (p.id === w.courier?.guardId && w.evidence === 'courier');
      v.sprite.visible = !guard?.turret;
      if (!guard?.turret)
        v.sprite.pose(p, alpha, {
          appearance,
          uniform: a?.disguised,
          weapon: a?.disarmed
            ? undefined
            : longGun(p)
              ? p.armament!.kind
              : cargo
                ? undefined
                : guard
                  ? p.armament?.kind || 'pistol'
                  : a?.weapon
                    ? 'pistol'
                    : undefined,
          stowed: !!a && !a.weapon,
          specialist: guard?.tactics?.role,
          carrying: cargo,
          flash: living(p) && w.traces.some((t) => distance(t.from, p) < 0.2),
        });
      const color = a
        ? a.exposed
          ? COLORS.red
          : COLORS.mint
        : guard
          ? guard.mode === 'combat'
            ? COLORS.red
            : COLORS.amber
          : COLORS.amber;
      v.ink.clear().ellipse(0, 0, 8, 3.5).fill({ color: 0x0d1915, alpha: 0.25 });
      if (guard?.turret) drawTurret(v.ink, guard, w);
      if (living(p) && !guard?.turret) {
        const feet = v.sprite.contacts;
        for (let i = 0; i < feet.length; i += 2)
          v.ink
            .ellipse(feet[i], feet[i + 1] + 0.2, 3.4, 1.65)
            .fill({ color: 0x0d1915, alpha: 0.65 });
      }
      v.label.visible = !!a && living(p);
      v.label.style.fill = color;
      if (a && living(a) && selected.includes(a.id))
        v.ink.ellipse(0, 0, 12, 6).stroke({ color, width: 2 });
      if (living(p) && p.hp < p.maxHp) {
        v.ink.rect(-12, -38, 24, 3).fill(0x182522);
        v.ink.rect(-12, -38, (24 * p.hp) / p.maxHp, 3).fill(color);
      }
      if (guard && !guard.turret && guard.mode !== 'patrol' && living(p)) {
        const suspicion = Math.max(...Object.values(guard.suspicion), 0);
        v.ink
          .rect(-12, -44, 24, 3)
          .fill(0x182522)
          .rect(-12, -44, (24 * suspicion) / 100, 3)
          .fill(color);
        if (guard.radio > 0) v.ink.circle(14, -35, 4).stroke({ color: COLORS.red, width: 2 });
      }
      const gun = a?.disarmed ? undefined : p.armament;
      if (gun && living(p) && (guard || (a && selected.includes(a.id)))) {
        const spec = WEAPONS[gun.kind];
        const progress = gun.charging
          ? 1 - gun.charging.remaining / COIL_CHARGE
          : gun.reload > 0
            ? 1 - gun.reload / spec.reload
            : gun.settle > 0 && !p.path.length
              ? 1 - gun.settle / spec.settle
              : null;
        if (progress !== null)
          v.ink
            .rect(-9, 7, 18, 2)
            .fill(0x182522)
            .rect(-9, 7, 18 * progress, 2)
            .fill(gun.reload > 0 ? COLORS.amber : COLORS.mint);
      }
    }
    depthOrder(depthItems).forEach((item, index) => {
      item.root.zIndex = index;
    });
    for (const view of this.views.values())
      view.sprite.setDepthLayer(view.root.zIndex, depthItems.length);
    const exitLocked = !!extractionRequirement(w);
    for (const [id, icon] of this.icons) {
      icon.visible =
        available(w, id) ||
        isCharge(id) ||
        (id === 'escort' && w.escortLocked) ||
        (id === 'evidence' && w.evidence === 'courier');
      icon.alpha = id === 'override' && w.overrideBy ? 0.6 : 1;
      const locked = !!objectRequirement(w, id, selected);
      if (locked !== this.markerLocks.get(id)) {
        drawMarker(icon.children[0] as Graphics, id, locked);
        this.markerLocks.set(id, locked);
      }
      const label = icon.children[1] as Text;
      const armed = isCharge(id) && w.demolition?.armed.includes(id);
      label.text = `${landmark(w, id).tag}${armed ? (demolished(w) ? ' · DESTROYED' : ' · ARMED') : locked ? ' · LOCKED' : ''}`;
      label.style.fill = locked ? 0xa5aba8 : markerColor(id);
      if (armed) icon.alpha = demolished(w) ? 0.55 : 1;
      icon.children[1].visible = !this.guideMarkers.has(id);
      const marker = this.markerScreen(id)!,
        scale = this.camera.scale.x;
      icon.position.set((marker.x - this.offset.x) / scale, (marker.y - this.offset.y) / scale);
      const leader = icon.children[2] as Graphics;
      leader.clear();
      if (id === 'escort' || (id === 'evidence' && w.evidence === 'courier')) {
        const head = this.screen(landmark(w, id), 1.6);
        leader
          .moveTo(0, 10)
          .lineTo(0, (head.y - marker.y - 5) / scale)
          .stroke({ color: COLORS.amber, width: 1, alpha: 0.4 });
      }
    }
    this.effects.clear();
    // Telegraph charged shots independently of optional sight cones, without hiding bodies.
    for (const shooter of people(w).filter(living)) {
      const charge = shooter.armament?.charging;
      if (!charge) continue;
      const target = people(w).find((p) => p.id === charge.target && living(p));
      if (!target || !lineClear(w, shooter, target)) continue;
      const from = project(shooter),
        to = project(target);
      const progress = 1 - charge.remaining / COIL_CHARGE;
      const color = w.guards.some((g) => g.id === shooter.id) ? 0xe599ff : 0x7be1e6;
      this.effects
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ color, width: 1.5 + progress, alpha: 0.5 + progress * 0.4 });
      this.effects
        .ellipse(to.x, to.y, 16 - progress * 6, 8 - progress * 3)
        .stroke({ color, width: 2, alpha: 0.9 });
    }
    for (const core of this.cores) {
      core.intact.visible = !demolished(w);
      core.wreck.visible = demolished(w);
    }
    if (w.demolition) {
      const done = demolished(w),
        radius = w.mission.demolition!.blastRadius;
      const age = w.time - (w.demolition.detonatedAt ?? -10);
      for (const site of w.mission.landmarks.filter((o) => isCharge(o.id))) {
        const p = project(site);
        this.effects
          .ellipse(p.x, p.y, radius * Math.SQRT2 * TILE_X, radius * Math.SQRT2 * TILE_Y)
          .fill({ color: done ? 0x100f0d : COLORS.amber, alpha: done ? 0.2 : 0.035 });
        if (!done) this.effects.stroke({ color: COLORS.amber, width: 1.5, alpha: 0.55 });
        if (done && age < 0.7)
          this.effects
            .ellipse(p.x, p.y, radius * Math.SQRT2 * TILE_X, radius * Math.SQRT2 * TILE_Y)
            .fill({ color: 0xffd7a0, alpha: 0.7 * (1 - age / 0.7) });
      }
    }
    for (const exit of w.mission.landmarks.filter((o) => isExtraction(o.id))) {
      const vp = project(exit);
      this.effects
        .ellipse(
          vp.x,
          vp.y,
          EXTRACTION_RADIUS * Math.SQRT2 * TILE_X,
          EXTRACTION_RADIUS * Math.SQRT2 * TILE_Y,
        )
        .stroke({ color: exitLocked ? 0x9aa69f : COLORS.mint, width: 1, alpha: 0.3 });
    }
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
    for (const turret of w.guards.filter((g) => turretPowered(w, g) && g.target)) {
      const target = w.agents.find((a) => a.id === turret.target && living(a));
      if (!target || !lineClear(w, turret, target)) continue;
      const from = project(turret, 0.9),
        to = project(target, 0.8);
      this.effects
        .moveTo(from.x, from.y)
        .lineTo(to.x, to.y)
        .stroke({ color: COLORS.red, width: 1.5, alpha: 0.7 });
    }
    for (const t of w.traces) {
      const angle = Math.atan2(t.to.y - t.from.y, t.to.x - t.from.x);
      const a = project(
          { x: t.from.x + Math.cos(angle) * 0.73, y: t.from.y + Math.sin(angle) * 0.73 },
          1.05,
        ),
        b = project(t.to, 1.0);
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
      if (guard.turret && !turretPowered(this.world, guard)) continue;
      const points = [project(guard)];
      const arc = guard.turret ? TURRET_ARC : Math.PI * 0.36;
      for (let i = 0; i <= 22; i++) {
        const angle = guard.angle - arc + (i / 22) * arc * 2;
        let low = 0,
          high = sightRange(guard);
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
        guard.mode === 'combat'
          ? COLORS.red
          : guard.turret
            ? circuitColor(guard.turret.circuit)
            : COLORS.amber,
        guard.mode === 'combat' ? 0.13 : 0.09,
      );
    }
  }
}
