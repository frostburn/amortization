import type { Mission, Solid } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  kind: 'wall',
  height: 1.5,
});

export const depot: Mission = {
  id: 'depot',
  number: '01',
  title: 'The release clause',
  location: 'Tram depot 06',
  objective: 'escort',
  description: 'Retrieve engineer Iona Voss.',
  evidenceName: 'Diagnostic unit',
  intro:
    'The maintenance kit is outside the west entrance. One disguise, four operatives. Choose your approach.',
  briefing: {
    lead: 'Voss wants out. The company disagrees.',
    body: 'Enter the tram depot, find engineer Iona Voss in the secure office, and bring her back to your van. Taking the diagnostic unit earns a cleaner exit from her contract.',
    routes: [
      {
        title: 'A borrowed identity',
        body: 'The kit by the west entrance holds one maintenance uniform. Conceal your weapon. The workshop is permitted; the office is not.',
      },
      {
        title: 'A prepared escape',
        body: 'Open the loading gate from inside for your crew. Disable the radio relay to stop reinforcements. A blown disguise need not end the job.',
      },
    ],
  },
  gateOutside: { x: 23, y: 21.25 },
  response: {
    spawns: Array.from({ length: 3 }, (_, i) => ({ x: 29.5 + i * 0.65, y: 21.8 })),
    patrol: [
      { x: 23, y: 18 },
      { x: 11, y: 12 },
    ],
  },
  width: 32,
  height: 26,
  restricted: { x: 9, y: 4, w: 19, h: 16 },
  secure: { x: 24, y: 4, w: 4, h: 5 },
  gate: { x: 21, y: 20, w: 4, h: 0.35 },
  solids: [
    wall('north', 9, 4, 19.3, 0.35),
    wall('east', 28, 4, 0.35, 16.35),
    wall('west-a', 9, 4, 0.35, 7),
    wall('west-b', 9, 13, 0.35, 7.35),
    wall('south-a', 9, 20, 12, 0.35),
    wall('south-b', 25, 20, 3.3, 0.35),
    wall('office-divider', 24, 4.35, 0.25, 3),
    { id: 'tram-a', x: 13.2, y: 8.2, w: 2.2, h: 8.3, height: 1.65, kind: 'tram' },
    { id: 'tram-b', x: 20, y: 7.5, w: 2.2, h: 8.5, height: 1.65, kind: 'tram' },
    { id: 'crate-a', x: 17, y: 17.5, w: 1.4, h: 1.1, height: 0.6, kind: 'crate' },
    { id: 'crate-b', x: 25, y: 12, w: 1.5, h: 2, height: 0.8, kind: 'crate' },
    { id: 'crate-c', x: 10.5, y: 6, w: 1.3, h: 1.5, height: 0.8, kind: 'crate' },
    { id: 'kiosk', x: 2.5, y: 8, w: 3.5, h: 5, height: 2.4, kind: 'building' },
    { id: 'substation', x: 11, y: 0.7, w: 9, h: 2, height: 2, kind: 'building' },
    { id: 'office-block', x: 0.5, y: 0.5, w: 6, h: 5, height: 3.5, kind: 'building' },
    { id: 'extraction-van', x: 2.2, y: 21, w: 1.6, h: 3, height: 1.2, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 5,
      y: 16,
      label: 'Maintenance kit',
      detail: 'One uniform and staff pass. Weapons are concealed automatically.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 23.6,
      y: 18.4,
      label: 'Loading gate',
      detail: 'Open from inside. Outside, cut the lock: 3 seconds, noisy.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 11,
      y: 8.5,
      label: 'Radio relay',
      detail: 'Disable to prevent calls for reinforcements. Guards can still fight.',
    },
    {
      id: 'engineer',
      tag: 'VOSS',
      x: 26.4,
      y: 6.4,
      label: 'Iona Voss',
      detail: 'Recruit the engineer. She follows her escort to the extraction van.',
    },
    {
      id: 'evidence',
      tag: 'UNIT',
      x: 26,
      y: 8.1,
      label: 'Diagnostic unit',
      detail: 'Optional evidence. Occupies both hands and slows its carrier.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 4.5,
      y: 22.5,
      label: 'Extraction van',
      detail: 'Bring Voss and every surviving operative here, then extract.',
    },
  ],
  spawns: [
    { x: 5.4, y: 21.2 },
    { x: 6.3, y: 21.8 },
    { x: 5.4, y: 22.5 },
    { x: 6.4, y: 23 },
  ],
  guards: [
    {
      position: { x: 11, y: 12 },
      angle: Math.PI,
      patrol: [
        { x: 11, y: 12 },
        { x: 11, y: 15.8 },
      ],
    },
    {
      position: { x: 17.5, y: 6 },
      angle: 1.57,
      patrol: [
        { x: 17.5, y: 6 },
        { x: 17.5, y: 15.5 },
      ],
    },
    {
      position: { x: 25.8, y: 16.5 },
      angle: Math.PI,
      patrol: [
        { x: 25.8, y: 16.5 },
        { x: 23.5, y: 10.5 },
      ],
    },
    {
      position: { x: 25.8, y: 10 },
      angle: 1.57,
      patrol: [
        { x: 25.8, y: 10 },
        { x: 26.8, y: 10 },
      ],
    },
    {
      position: { x: 19, y: 18.5 },
      angle: Math.PI,
      patrol: [
        { x: 19, y: 18.5 },
        { x: 11, y: 18.5 },
      ],
    },
  ],
};
