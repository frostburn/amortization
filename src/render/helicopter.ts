import { Container, Graphics } from 'pixi.js';
import type { Vec } from '../sim/types';
import { project, HEIGHT } from './isometric';
import { polygon } from './primitives';

/** Roof transport, authored in world units rather than stretching a ground vehicle. */
export class Helicopter extends Container {
  private shadow = new Graphics();
  private airframe = new Container();
  private rotor = new Graphics();
  constructor(anchor: Vec) {
    super();
    this.position.copyFrom(project(anchor));
    const hull = new Graphics();
    this.addChild(this.shadow, this.airframe);
    this.airframe.addChild(hull, this.rotor);
    const face = (points: number[][], color: number) =>
      polygon(
        hull,
        points.map(([x, y, z]) => project({ x, y }, z)),
        color,
      );
    const line = (points: number[][], color: number, width: number) => {
      points.forEach(([x, y, z], i) => {
        const p = project({ x, y }, z);
        if (i) hull.lineTo(p.x, p.y);
        else hull.moveTo(p.x, p.y);
      });
      hull.stroke({ color, width, cap: 'round', join: 'round' });
    };
    // Tail boom and vertical fin, behind the cabin. The nose points towards +Y.
    face(
      [
        [-0.38, -1.3, 1.3],
        [0.38, -1.3, 1.3],
        [0.12, -6.4, 1.8],
        [-0.12, -6.4, 1.8],
      ],
      0x65717b,
    );
    face(
      [
        [0.38, -1.3, 1.3],
        [0.22, -1.3, 0.8],
        [0.08, -6.4, 1.5],
        [0.12, -6.4, 1.8],
      ],
      0x333f4c,
    );
    face(
      [
        [0, -5.2, 1.6],
        [0, -6.6, 1.6],
        [0, -6.4, 3],
        [0, -5.85, 2.9],
      ],
      0xa75d46,
    );
    face(
      [
        [-1, -5.4, 1.6],
        [1, -5.4, 1.6],
        [0.7, -5.8, 1.6],
        [-0.7, -5.8, 1.6],
      ],
      0xc49b67,
    );
    // Both skids sit on the deck; struts carry the body above them.
    for (const x of [-1.48, 1.48]) {
      line(
        [
          [x, -1.7, 0.15],
          [x, 2.7, 0.15],
          [x, 3, 0.38],
        ],
        0xa3acae,
        3.3,
      );
      for (const y of [-0.85, 1.5])
        line(
          [
            [x, y, 0.17],
            [x * 0.63, y, 0.85],
          ],
          0x778992,
          3,
        );
    }
    face(
      [
        [-1.2, -1.45, 0.8],
        [1.2, -1.45, 0.8],
        [1.05, 1.8, 0.65],
        [0.5, 2.6, 0.75],
        [-0.5, 2.6, 0.75],
        [-1.05, 1.8, 0.65],
      ],
      0x242e3b,
    );
    face(
      [
        [-1.2, -1.45, 0.8],
        [-1.15, -1.4, 1.85],
        [-0.85, 0.9, 2.1],
        [-0.5, 2.6, 1.05],
        [-0.5, 2.6, 0.75],
        [-1.05, 1.8, 0.65],
      ],
      0x4d5a68,
    );
    face(
      [
        [1.2, -1.45, 0.8],
        [1.15, -1.4, 1.85],
        [0.85, 0.9, 2.1],
        [0.5, 2.6, 1.05],
        [0.5, 2.6, 0.75],
        [1.05, 1.8, 0.65],
      ],
      0x344452,
    );
    face(
      [
        [-1.15, -1.4, 1.85],
        [1.15, -1.4, 1.85],
        [0.85, 0.9, 2.1],
        [-0.85, 0.9, 2.1],
      ],
      0x9caaab,
    );
    // Faceted windshield and separate side glazing read even at default zoom.
    face(
      [
        [-0.85, 0.9, 2.1],
        [-0.04, 1.1, 2.12],
        [-0.035, 2.6, 1.1],
        [-0.5, 2.6, 1.05],
      ],
      0x7dafb9,
    );
    face(
      [
        [0.04, 1.1, 2.12],
        [0.85, 0.9, 2.1],
        [0.5, 2.6, 1.05],
        [0.035, 2.6, 1.1],
      ],
      0xbad3cc,
    );
    face(
      [
        [1.17, -1.05, 1.72],
        [1.08, 0.45, 1.83],
        [1.12, 0.45, 1.21],
        [1.21, -1.05, 1.18],
      ],
      0x263b4b,
    );
    line(
      [
        [1.22, -1.15, 0.86],
        [1.18, -1.15, 1.79],
        [1.07, 0.58, 1.92],
        [1.11, 0.58, 0.79],
      ],
      0xc2a572,
      1.2,
    );
    line(
      [
        [1.23, -0.45, 1.04],
        [1.23, -0.05, 1.04],
      ],
      0xd8b773,
      2.2,
    );
    line(
      [
        [-0.45, -0.4, 2],
        [0.45, -0.4, 2],
      ],
      0x2d3841,
      8,
    );
    line(
      [
        [0, -0.4, 2],
        [0, -0.4, 2.8],
      ],
      0xb8b4a0,
      3,
    );
    // Tail rotor turns in a vertical plane.
    line(
      [
        [0.18, -6.9, 1.6],
        [0.18, -5.8, 2.5],
      ],
      0xbcb6a1,
      2,
    );
    line(
      [
        [0.18, -6.9, 2.5],
        [0.18, -5.8, 1.6],
      ],
      0xbcb6a1,
      2,
    );
    this.update(0, 0);
  }
  update(time: number, flight: number) {
    const lift = Math.min(1, flight * 3) * 3.5;
    const travel = Math.max(0, (flight - 0.3) / 0.7) ** 2;
    const offset = project({ x: -travel * 14, y: -travel * 24 }, lift);
    this.airframe.position.copyFrom(offset);
    this.visible = flight < 1;
    this.shadow.clear();
    const center = project({ x: 0, y: 0.1 });
    this.shadow
      .ellipse(center.x, center.y, 57, 25)
      .fill({ color: 0x151c28, alpha: 0.38 * (1 - flight) });
    this.rotor.clear();
    const hub = { x: 0, y: -0.4 },
      z = 2.82;
    const ring = Array.from({ length: 40 }, (_, i) =>
      project(
        { x: Math.cos((i * Math.PI) / 20) * 5.2, y: hub.y + Math.sin((i * Math.PI) / 20) * 5.2 },
        z,
      ),
    );
    polygon(this.rotor, ring, 0xc6c9b6, 0.055);
    for (let i = 0; i < 4; i++) {
      const a = time * 15 + (i * Math.PI) / 2,
        c = Math.cos(a),
        s = Math.sin(a);
      polygon(
        this.rotor,
        [
          project({ x: c * 0.35 - s * 0.07, y: hub.y + s * 0.35 + c * 0.07 }, z),
          project({ x: c * 5.25 - s * 0.12, y: hub.y + s * 5.25 + c * 0.12 }, z),
          project({ x: c * 5.25 + s * 0.12, y: hub.y + s * 5.25 - c * 0.12 }, z),
          project({ x: c * 0.35 + s * 0.07, y: hub.y + s * 0.35 - c * 0.07 }, z),
        ],
        0x333d45,
        0.8,
      );
    }
    const p = project(hub, z);
    this.rotor.circle(p.x, p.y, 3.3).fill(0xd4c9a3);
    // The aircraft translates and rises; its proportions never change in flight.
    this.shadow.y = -Math.min(lift, 0.2) * HEIGHT;
  }
}
