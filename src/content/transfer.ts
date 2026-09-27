import type { Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  kind: 'wall',
  height: 1.5,
});
const patrol = (points: Vec[], angle = Math.PI) => ({ position: points[0], patrol: points, angle });

export const transfer: Mission = {
  id: 'transfer',
  number: '03',
  title: 'Adverse possession',
  location: 'Bonded transfer yard 09',
  objective: 'case',
  description: 'Intercept the courier. Extract their access case.',
  evidenceName: 'Access case',
  intro:
    'Voss: the access keys travel by courier. Watch the patrol before changing DIVERT: a uniform will not hide tampering. CALL brings the courier to inspection.',
  briefing: {
    lead: 'Possession is nine tenths of the contract.',
    body: 'The ledger points to an escrow account used to buy the district. A security courier carries its physical access keys. Bring CASE and every surviving operative to the west-street van. The transfer starts only when you request it.',
    routes: [
      {
        title: 'A signature in someone else’s name',
        body: 'Take KIT and enter through the west opening. The west patrol watches DIVERT: wait until their back is turned before changing it. Tampering takes three seconds and is suspicious even in uniform. A teammate can use CALL from the public street to bring the courier to INSPECTION. Sign for CASE there with a concealed weapon and an unrecognized identity.',
      },
      {
        title: 'Choose the ground',
        body: 'The courier patrols the secure holding yard until CALL. The amber route shows the transfer lane. DIVERT brings them behind the inspection screen, away from the east checkpoint guards. Set an ambush, or sign quietly. Signed clearance protects the disguised carrier; dropping the case voids it. An armed interception leaves CASE where the courier falls. RADIO stops reinforcements. A missed transfer returns and can be called again.',
      },
    ],
  },
  width: 36,
  height: 28,
  restricted: { x: 8, y: 3, w: 24.35, h: 18.35 },
  secure: { x: 24, y: 4, w: 7, h: 5 },
  gate: { x: 32, y: 16, w: 0.35, h: 3 },
  gateOutside: { x: 33.2, y: 17.5 },
  transfer: {
    start: { x: 27, y: 6 },
    patrol: [
      { x: 27, y: 6 },
      { x: 30.5, y: 6 },
      { x: 30.5, y: 8.5 },
      { x: 27, y: 8.5 },
    ],
    junction: { x: 23, y: 13 },
    checkpoint: { x: 28.5, y: 18.5 },
    inspection: { x: 13, y: 18.5 },
  },
  response: {
    spawns: [
      { x: 34, y: 19.5 },
      { x: 34, y: 20.3 },
      { x: 34, y: 21.1 },
    ],
    patrol: [
      { x: 28.5, y: 17.5 },
      { x: 23, y: 13 },
      { x: 13, y: 18.5 },
    ],
  },
  solids: [
    wall('yard-north', 8, 3, 24.35, 0.35),
    wall('yard-west-a', 8, 3, 0.35, 12),
    wall('yard-west-b', 8, 18, 0.35, 3.35),
    wall('yard-south', 8, 21, 24.35, 0.35),
    wall('yard-east-a', 32, 3, 0.35, 13),
    wall('yard-east-b', 32, 19, 0.35, 2.35),
    { id: 'dispatch-office', x: 15, y: 5, w: 6, h: 4.5, height: 2.6, kind: 'building' },
    { id: 'customs-block', x: 24, y: 3.7, w: 2, h: 5.3, height: 2.1, kind: 'building' },
    { id: 'bonded-stack-a', x: 17, y: 15.6, w: 5.2, h: 3.7, height: 1.55, kind: 'container' },
    { id: 'bonded-stack-b', x: 10, y: 5.2, w: 2.6, h: 3, height: 1.4, kind: 'crate' },
    { id: 'customs-pallet', x: 28.2, y: 10, w: 2.1, h: 3, height: 1.1, kind: 'crate' },
    { ...wall('inspection-screen', 15.7, 16, 0.35, 4.2), height: 1.3 },
    { id: 'signal-cabinet', x: 9.5, y: 13.4, w: 1.4, h: 0.8, height: 1.1, kind: 'shelves' },
    { id: 'call-box', x: 4.3, y: 14.1, w: 1, h: 0.6, height: 0.8, kind: 'shelves' },
    { id: 'street-workshop', x: 0.8, y: 5, w: 4.5, h: 5, height: 2.6, kind: 'building' },
    { id: 'transfer-van', x: 1.6, y: 23, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 4.8,
      y: 19.5,
      label: 'Maintenance kit',
      detail: 'One borrowed identity. Sign for the case with weapons concealed.',
    },
    {
      id: 'dispatch',
      tag: 'CALL',
      x: 4.8,
      y: 16,
      label: 'Transfer request terminal',
      detail: 'Start the courier transfer. Public access; choose when to begin.',
    },
    {
      id: 'divert',
      tag: 'DIVERT',
      x: 10.5,
      y: 15.3,
      label: 'Inspection routing signal',
      detail:
        'Redirect to the screened inspection bay. Three seconds of tampering: wait for the west patrol to look away, even in disguise.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 11,
      y: 10,
      label: 'Yard radio relay',
      detail: 'Disable reinforcement calls. Guards still respond to local contact.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 30.8,
      y: 17.5,
      label: 'East checkpoint gate',
      detail: 'Open from inside, or cut the lock from the east road.',
    },
    {
      id: 'evidence',
      tag: 'CASE',
      x: 27,
      y: 6,
      label: 'Courier access case',
      detail:
        'Sign for it in disguise at INSPECTION, or recover it from the fallen courier. Required.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 4.8,
      y: 24.5,
      label: 'West street extraction',
      detail: 'Bring the access case and every surviving operative.',
    },
  ],
  spawns: [
    { x: 4.5, y: 23 },
    { x: 5.5, y: 23 },
    { x: 4.5, y: 24 },
    { x: 5.5, y: 24 },
  ],
  guards: [
    patrol(
      [
        { x: 12.8, y: 17.8 },
        { x: 13.5, y: 5 },
      ],
      -Math.PI / 2,
    ),
    patrol([
      { x: 20.5, y: 12 },
      { x: 14, y: 12 },
    ]),
    patrol(
      [
        { x: 23.6, y: 18.8 },
        { x: 23.6, y: 12.8 },
      ],
      -Math.PI / 2,
    ),
    patrol([
      { x: 30.4, y: 15 },
      { x: 27, y: 15 },
    ]),
    patrol(
      [
        { x: 30, y: 5.5 },
        { x: 27, y: 9.5 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 34, y: 8 },
        { x: 34, y: 17.5 },
      ],
      Math.PI / 2,
    ),
  ],
};
