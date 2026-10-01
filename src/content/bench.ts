import type { GuardTactic, Mission, Solid, Vec } from '../sim/types';

const roof = (x: number, y: number): Vec => ({ x, y, floor: 1 });
const wall = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  floor = 0,
  height = 1.65,
): Solid => ({ id, x, y, w, h, floor, height, kind: 'wall' });
// Walking routes and combat posts are separate: every defender has a beat to
// patrol, while Dacre can redirect his detail to nearby authored fighting positions.
const detail = (role: GuardTactic['role'], patrol: Vec[], posts = patrol) => ({
  position: patrol[0],
  patrol,
  angle: Math.PI,
  tactic: { role, posts },
});

export const bench: Mission = {
  id: 'bench',
  disguise: 'office',
  number: '15',
  title: 'The Bench',
  location: 'Crown Tower / executive floors · 19:52',
  objective: 'capture',
  palette: 'sunset',
  trackingCamera: true,
  flashGrenades: true,
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  relayTime: 5,
  finale: {
    dacre: 3,
    retinue: [4, 5, 6],
    door: { x: 32, y: 13, w: 0.4, h: 4.5 },
    inside: { x: 33.6, y: 15.2 },
    chamber: { x: 32.4, y: 4.4, w: 13.6, h: 13.6 },
    sealTime: 4,
    helicopter: roof(35, 13),
    boarding: roof(37.1, 15),
  },
  building: {
    footprint: { x: 4, y: 4, w: 42.4, h: 30.4 },
    upper: { x: 4.4, y: 4.4, w: 41.6, h: 29.6 },
    stairs: [{ x: 8, y: 10 }, roof(8, 10)],
  },
  escort: {
    id: 'holt',
    name: 'Severin Holt',
    hp: 90,
    speed: 2.5,
    locked: false,
    vulnerable: false,
  },
  evidenceName: 'Board minutes',
  description: 'End the company’s command and leave from the roof.',
  intro:
    'Voss: the helicopter is on the roof. Dacre commands the last security detail below it. Remove him; bring Holt out in handcuffs, or leave him there. The money stays returned.',
  briefing: {
    lead: 'No higher office.',
    body: 'Defeat Dacre in the penthouse. Open the Bench with two operatives at SEAL A and SEAL B, or force CUT. Eliminate Holt or cuff him after Dacre falls. Take UP to the helipad and board HELI with every survivor—and Holt if arrested.',
    routes: [
      {
        title: 'The command marshal',
        body: 'Dacre wears charcoal armour with gold shoulders and carries a carbine. His 160-health armour is visible on his bar. His two-second hand signal orders surviving nearby defenders to crossfire posts. A hit or flash interrupts it; he cannot shoot while signalling. His retinue can relay a sighting while in view of him. These are observed positions, never knowledge through walls. The detail patrols both approaches and takes cover under fire. RADIO stops arriving patrols, not his local commands.',
      },
      {
        title: 'Open the Bench',
        body: 'Separate operatives with free hands must hold SEAL A and SEAL B for four seconds. Neither can fire while working. Progress is saved if interrupted, and the chamber stays open once released. CUT at the chamber door is an eight-second, noisy alternative, including from inside. A lone survivor can still finish.',
      },
      {
        title: 'Holt’s answer',
        body: 'Holt has ordinary health. After Dacre falls, use CUFF with free hands for three seconds to arrest him; attacking his body is the deliberate lethal option. Automatic fire never chooses him. The signed MINUTES are optional and occupy both hands. Guards will not shoot their chairman, including in custody.',
      },
      {
        title: 'Above the city',
        body: 'UP connects the penthouse to the roof; DOWN returns. The active operative determines which level is visible. Bring a cuffed Holt’s escort upstairs and he follows through the stairs. A waiting prisoner stays behind until asked to follow. HELI waits indefinitely, but two rooftop guards patrol across the approach and helipad. No bullets, vision or flashes pass between levels.',
      },
    ],
  },
  width: 50,
  height: 38,
  restricted: { x: 4, y: 4, w: 42.4, h: 30.4 },
  secure: { x: 24, y: 4, w: 22.4, h: 30.4 },
  // The closed lift is scenery, not a return exit. Arrival patrols use its north service passage.
  gate: { x: 0, y: 0, w: 0, h: 0 },
  gateOutside: { x: 0, y: 0 },
  response: {
    spawns: [
      { x: 6, y: 6 },
      { x: 7, y: 6 },
    ],
    patrol: [
      { x: 12, y: 6.5 },
      { x: 22, y: 6.5 },
      { x: 27, y: 16 },
    ],
    specialists: [
      {
        role: 'sentry',
        posts: [
          { x: 23, y: 8 },
          { x: 26, y: 13 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 23, y: 18 },
          { x: 26, y: 26 },
        ],
      },
    ],
  },
  solids: [
    wall('penthouse-north', 4, 4, 42.4, 0.4),
    wall('penthouse-west', 4, 4, 0.4, 30.4),
    wall('penthouse-east', 46, 4, 0.4, 30.4),
    wall('penthouse-south', 4, 34, 42.4, 0.4),
    wall('lift-screen', 10, 27, 7, 0.5),
    wall('west-gallery-south', 14, 19, 0.5, 7),
    wall('west-gallery-north', 14, 8, 0.5, 7),
    wall('gallery-divider', 21, 11, 0.5, 12),
    wall('bench-west-north', 32, 4.4, 0.4, 8.6),
    wall('bench-west-foot', 32, 17.5, 0.4, 0.9),
    wall('bench-south', 32, 18, 14, 0.4),
    { id: 'board-table', x: 28, y: 21, w: 6, h: 1.4, height: 1.05, kind: 'shelves' },
    { id: 'north-planter', x: 25, y: 13, w: 2.5, h: 1, height: 1.25, kind: 'crate' },
    { id: 'south-planter', x: 24, y: 27, w: 3, h: 1, height: 1.25, kind: 'crate' },
    wall('marshal-screen', 33, 28, 0.5, 3),
    { id: 'retinue-cover', x: 37, y: 26, w: 4, h: 0.8, height: 1.3, kind: 'shelves' },
    { id: 'radio-cabinet', x: 17, y: 5.5, w: 2, h: 0.8, height: 1.4, kind: 'server' },
    { id: 'seal-a-cabinet', x: 29, y: 5.5, w: 1.2, h: 1, height: 1.3, kind: 'server' },
    { id: 'seal-b-cabinet', x: 36.5, y: 23, w: 1.2, h: 1, height: 1.3, kind: 'server' },
    { id: 'chairman-desk', x: 39, y: 8, w: 4, h: 1, height: 1.1, kind: 'shelves' },
    wall('roof-north', 4, 4, 42.4, 0.4, 1, 0.85),
    wall('roof-west', 4, 4, 0.4, 30.4, 1, 0.85),
    wall('roof-east', 46, 4, 0.4, 30.4, 1, 0.85),
    wall('roof-south', 4, 34, 42.4, 0.4, 1, 0.85),
    wall('stair-head-north', 5, 7, 6, 0.4, 1),
    wall('stair-head-east', 11, 7, 0.4, 6, 1),
    { id: 'roof-air-handling', ...roof(16, 13), w: 6, h: 3, height: 1.5, kind: 'server' },
    { id: 'roof-duct-south', ...roof(24, 24), w: 5, h: 2, height: 1.2, kind: 'shelves' },
    { id: 'roof-screen', ...roof(28, 18), w: 0.6, h: 5, height: 1.4, kind: 'shelves' },
    { id: 'helicopter', ...roof(33.8, 11), w: 2.4, h: 4.5, height: 2.2, kind: 'transport' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 8,
      y: 25,
      label: 'Executive staff identity',
      detail: 'One concealed-pistol disguise. The boardroom remains a secure area.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 18,
      y: 7.5,
      label: 'Executive security relay',
      detail: 'Five seconds. Stops lift-borne reinforcement patrols, not Dacre’s local orders.',
    },
    {
      id: 'seal-west',
      tag: 'SEAL A',
      x: 29.5,
      y: 8,
      label: 'North authority seal',
      detail:
        'Hold with free hands while a separate operative holds SEAL B. Four seconds together opens the Bench permanently.',
    },
    {
      id: 'seal-east',
      tag: 'SEAL B',
      x: 36,
      y: 25.5,
      label: 'South authority seal',
      detail:
        'Hold with free hands while a separate operative holds SEAL A. Saved progress survives interruptions.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      x: 30.5,
      y: 15.2,
      label: 'Force the Bench door',
      detail: 'Eight noisy seconds with free hands. Works from either side; the door stays open.',
    },
    {
      id: 'escort',
      tag: 'CUFF',
      x: 41,
      y: 11,
      label: 'Arrest Severin Holt',
      detail:
        'Defeat Dacre, then apply handcuffs for three seconds with free hands. Holt’s body is a separate lethal target.',
    },
    {
      id: 'evidence',
      tag: 'MINUTES',
      x: 38,
      y: 7,
      label: 'Signed board minutes',
      detail:
        'Optional evidence for the hearing. Both hands occupied; set it down to work or cuff Holt.',
    },
    {
      id: 'stairs-up',
      tag: 'UP',
      x: 8,
      y: 10,
      label: 'Roof stairs',
      detail:
        'Send selected penthouse operatives to the roof. A following Holt uses these stairs too.',
    },
    {
      id: 'stairs-down',
      tag: 'DOWN',
      ...roof(8, 10),
      label: 'Penthouse stairs',
      detail: 'Return selected roof operatives to the penthouse.',
    },
    {
      id: 'extract',
      tag: 'HELI',
      ...roof(37.5, 18),
      label: 'Helipad extraction',
      detail:
        'Defeat Dacre and remove Holt. Bring all survivors to the helicopter, plus Holt if cuffed. The helicopter waits.',
    },
  ],
  spawns: [
    { x: 7, y: 30 },
    { x: 8, y: 30 },
    { x: 7, y: 31 },
    { x: 8, y: 31 },
  ],
  guards: [
    detail(
      'inspector',
      [
        { x: 18, y: 18 },
        { x: 18, y: 9 },
        { x: 23, y: 9 },
        { x: 23, y: 25 },
        { x: 18, y: 25 },
      ],
      [
        { x: 18, y: 18 },
        { x: 18, y: 10 },
        { x: 23, y: 25 },
      ],
    ),
    detail(
      'sentry',
      [
        { x: 19, y: 28 },
        { x: 23, y: 31 },
        { x: 29, y: 30 },
        { x: 23, y: 25 },
        { x: 18, y: 25 },
      ],
      [
        { x: 19, y: 28 },
        { x: 23, y: 25 },
        { x: 28, y: 29 },
      ],
    ),
    detail(
      'sentry',
      [
        { x: 24, y: 8 },
        { x: 29, y: 8 },
        { x: 29, y: 16 },
        { x: 23, y: 16 },
        { x: 23, y: 10 },
      ],
      [
        { x: 24, y: 8 },
        { x: 28, y: 11 },
        { x: 29, y: 16 },
      ],
    ),
    detail(
      'marshal',
      [
        { x: 31, y: 25 },
        { x: 34.5, y: 25 },
        { x: 34.5, y: 31.5 },
        { x: 29, y: 30.5 },
      ],
      [
        { x: 31, y: 25 },
        { x: 34.5, y: 29 },
        { x: 32, y: 31.5 },
        { x: 35, y: 20 },
        { x: 30, y: 19 },
      ],
    ),
    detail(
      'shield',
      [
        { x: 27.5, y: 23.5 },
        { x: 23.5, y: 24 },
        { x: 23, y: 18 },
        { x: 28, y: 18 },
      ],
      [
        { x: 27.5, y: 23.5 },
        { x: 23.5, y: 24 },
        { x: 27, y: 18 },
      ],
    ),
    detail(
      'support',
      [
        { x: 36, y: 29 },
        { x: 42, y: 29 },
        { x: 42, y: 23.5 },
        { x: 38.5, y: 20 },
        { x: 35, y: 24.5 },
      ],
      [
        { x: 36, y: 29 },
        { x: 35, y: 25 },
        { x: 29, y: 26 },
        { x: 42, y: 24 },
      ],
    ),
    detail(
      'breacher',
      [
        { x: 39, y: 23.5 },
        { x: 44, y: 20 },
        { x: 44, y: 31 },
        { x: 30, y: 32 },
        { x: 30, y: 26 },
      ],
      [
        { x: 39, y: 23.5 },
        { x: 29, y: 29 },
        { x: 25, y: 20 },
        { x: 35, y: 31.5 },
      ],
    ),
    detail(
      'marksman',
      [roof(26, 10), roof(30, 8), roof(32, 18), roof(24, 18), roof(24, 10)],
      [roof(26, 10), roof(30, 8), roof(31, 18), roof(24, 18)],
    ),
    detail(
      'sentry',
      [roof(32, 29), roof(40, 27), roof(40, 18), roof(30, 17), roof(30, 23)],
      [roof(32, 29), roof(33, 23), roof(40, 18), roof(30, 17)],
    ),
  ],
};
