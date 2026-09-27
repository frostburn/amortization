import type { Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number, height = 1.5): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height,
  kind: 'wall',
});
const patrol = (points: Vec[], angle = Math.PI) => ({ position: points[0], patrol: points, angle });

export const custody: Mission = {
  id: 'custody',
  number: '04',
  title: 'Protective custody',
  location: 'Remand transfer station 04',
  objective: 'escort',
  escort: { id: 'quill', name: 'Mara', hp: 75, speed: 2.15, locked: true, vulnerable: true },
  description: 'Free auditor Mara Quill. Bring her out alive.',
  evidenceName: 'Detention register',
  intro:
    'Voss: the account keys led to Mara Quill. She is held in a remand transport. Forge a release at WARRANT, or CUT its lock. Choose STREET for speed or SERVICE for cover.',
  briefing: {
    lead: 'Their protection has a lock on the outside.',
    body: 'Mara Quill audited the escrow account. Now she is waiting for transfer in a locked security van. Free her and bring every survivor to either extraction van. Mara is unarmed, moves slowly, and can be killed once she leaves the transport.',
    routes: [
      {
        title: 'Release on borrowed authority',
        body: 'Take KIT and file a forged release at WARRANT with a concealed weapon and an unexposed identity. The transport unlocks; right-click MARA when you are ready to escort her. CUT takes eight seconds and draws guards, even with RADIO disabled.',
      },
      {
        title: 'Two ways out',
        body: 'STREET is close, beyond the east GATE and road patrol. SERVICE is farther away on the west street; the walled service corridor screens the escape. Mara has no disguise. Tell her to wait in cover while the crew clears a route; a nearby operative can spend their field dressing to treat her. Right-click MARA to transfer her escort.',
      },
    ],
  },
  width: 38,
  height: 30,
  restricted: { x: 8, y: 3, w: 24.35, h: 21.35 },
  secure: { x: 10.35, y: 4.35, w: 5.3, h: 5.15 },
  gate: { x: 32, y: 19, w: 0.35, h: 3 },
  gateOutside: { x: 33.3, y: 20.5 },
  response: {
    spawns: [
      { x: 35, y: 20 },
      { x: 35, y: 21 },
      { x: 35, y: 22 },
    ],
    patrol: [
      { x: 30, y: 20.5 },
      { x: 24.3, y: 19 },
      { x: 24.3, y: 15 },
    ],
  },
  solids: [
    wall('remand-north', 8, 3, 24.35, 0.35),
    wall('remand-west-a', 8, 3, 0.35, 6.5),
    wall('remand-west-b', 8, 12, 0.35, 12.35),
    wall('remand-south', 8, 24, 24.35, 0.35),
    wall('remand-east-a', 32, 3, 0.35, 16),
    wall('remand-east-b', 32, 22, 0.35, 2.35),
    wall('records-north', 10, 4, 6, 0.35),
    wall('records-west', 10, 4, 0.35, 5.5),
    wall('records-east', 15.65, 4, 0.35, 5.5),
    wall('records-front', 10, 9.5, 3, 0.35),
    wall('corridor-north', 17.8, 13.2, 12, 0.35, 1.7),
    wall('corridor-south', 11, 16.5, 12.5, 0.35, 1.7),
    { id: 'remand-office', x: 22, y: 4.5, w: 6.5, h: 3.5, height: 2.6, kind: 'building' },
    { id: 'service-container', x: 18, y: 9, w: 6.3, h: 3.5, height: 1.5, kind: 'container' },
    { id: 'bay-container', x: 18, y: 18, w: 5.2, h: 3.7, height: 1.5, kind: 'container' },
    { id: 'records-files', x: 10.8, y: 5.3, w: 1.5, h: 2.6, height: 1.3, kind: 'shelves' },
    { id: 'remand-transport', x: 26, y: 17, w: 1.8, h: 3.2, height: 1.65, kind: 'transport' },
    { id: 'bay-pallet', x: 11, y: 19, w: 3.4, h: 2.2, height: 1, kind: 'crate' },
    { id: 'street-block', x: 1, y: 12.5, w: 4, h: 5, height: 2.5, kind: 'building' },
    { id: 'service-van', x: 2, y: 4.5, w: 1.6, h: 3, height: 1.55, kind: 'van' },
    { id: 'street-van', x: 33, y: 26.5, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 5.5,
      y: 21,
      label: 'Maintenance kit',
      detail: 'One unexposed staff identity can file a release. Mara cannot wear the uniform.',
    },
    {
      id: 'release',
      tag: 'WARRANT',
      x: 14.3,
      y: 6.2,
      label: 'Transfer authorization',
      detail: 'Three seconds. Requires a concealed weapon and an unexposed maintenance identity.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 10.5,
      y: 11.4,
      label: 'Station radio relay',
      detail: 'Disable further calls and reinforcements. Guards still recognize Mara.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 30.8,
      y: 20.5,
      label: 'East delivery gate',
      detail: 'Open from inside before attempting the short street extraction.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      x: 28.7,
      y: 18.7,
      label: 'Transport lock',
      detail: 'Force it in eight seconds. Nearby guards investigate the noise.',
    },
    {
      id: 'escort',
      tag: 'MARA',
      x: 25,
      y: 18.4,
      label: 'Mara Quill',
      detail: 'Unlock the transport, then collect Mara. Right-click again to transfer her escort.',
    },
    {
      id: 'evidence',
      tag: 'REGISTER',
      x: 30.2,
      y: 6,
      label: 'Detention register',
      detail: 'Optional evidence of the illegal detention. Both hands occupied.',
    },
    {
      id: 'extract',
      tag: 'STREET',
      x: 35,
      y: 25.3,
      label: 'East street extraction',
      detail: 'Short but exposed. Bring Mara and every survivor to this ring.',
    },
    {
      id: 'alternate',
      tag: 'SERVICE',
      x: 4.8,
      y: 6.3,
      label: 'West service extraction',
      detail: 'Longer escape through the screened corridor. Bring Mara and every survivor here.',
    },
  ],
  spawns: [
    { x: 4.5, y: 25 },
    { x: 5.5, y: 25 },
    { x: 4.5, y: 26 },
    { x: 5.5, y: 26 },
  ],
  guards: [
    patrol(
      [
        { x: 17, y: 6.5 },
        { x: 17, y: 11.5 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 25.7, y: 10 },
        { x: 30, y: 10 },
      ],
      0,
    ),
    patrol(
      [
        { x: 30.3, y: 15 },
        { x: 30.3, y: 19 },
      ],
      Math.PI / 2,
    ),
    patrol([
      { x: 29.4, y: 22.8 },
      { x: 24.5, y: 22.8 },
    ]),
    patrol(
      [
        { x: 34, y: 10 },
        { x: 34, y: 22 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 13, y: 22.8 },
        { x: 17, y: 22.8 },
      ],
      0,
    ),
  ],
};
