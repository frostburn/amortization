import type { GuardTactic, Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height: 1.6,
  kind: 'wall',
});
const patrol = (points: Vec[], angle: number, tactic?: GuardTactic) => ({
  position: points[0],
  patrol: points,
  angle,
  ...(tactic ? { tactic } : {}),
});

export const settlement: Mission = {
  id: 'settlement',
  disguise: 'office',
  number: '11',
  title: 'Value date',
  location: 'Mutual Indemnity / settlement court · 09:10',
  objective: 'settlement',
  daylight: true,
  evidenceName: 'Beneficiary register',
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  trackingCamera: true,
  flashGrenades: true,
  relayTime: 4,
  settlement: { reconcileTime: 6, duration: 12 },
  description: 'Reconcile the register. Countersign the repayments. Bring the receipt home.',
  intro:
    'Quill: the mandate is binding. Now we need the original beneficiary register reconciled at CHECK. Its carrier must work CLEAR while a different operative holds SIGN. The bank is open; the guards can see much farther in daylight.',
  briefing: {
    lead: 'The first payments are due this morning.',
    body: 'Recover REGISTER from the north records office, take its carrier to CHECK, then operate SIGN and CLEAR together to release the repayments. Extract the register and every survivor. Two operatives must survive until the payments clear.',
    routes: [
      {
        title: 'Prepare the records office',
        body: 'A partner can hold SHUNT from the north public street to open the records office. Keep them there until the carrier leaves; CUT forces a permanent opening with eight seconds of noisy work. RADIO is inside with REGISTER. The racks screen the terminals from the office patrol. A staff identity helps before the register is lifted, but carrying it is conspicuous.',
      },
      {
        title: 'Work through the court',
        body: 'The upper and lower checkpoint openings lead to different sides of the central hall. The west office screens CHECK; the eastern booth screens CLEAR. Use the hall and concrete screens to break the long daylight sight lines. The violet marksman covers the open east court. Flashes can buy a crossing, but exposed teammates are stunned too.',
      },
      {
        title: 'Two signatures',
        body: 'CHECK needs the REGISTER carrier for six seconds. Then leave a separate operative with free hands holding SIGN in the west booth, while the carrier works CLEAR in the east booth. Both operators are unable to shoot. The other two can cover the approaches. Twelve seconds of paired work releases the funds; progress survives interruption. Afterward, bring both workers, the register and every survivor to VAN. Nothing is on a countdown before you start.',
      },
    ],
  },
  width: 60,
  height: 44,
  restricted: { x: 8, y: 4, w: 46.35, h: 34.35 },
  secure: { x: 34.35, y: 6.35, w: 14.3, h: 10.65 },
  gate: { x: 54, y: 9, w: 0.35, h: 4 },
  gateOutside: { x: 55.5, y: 11 },
  gateInsideOnly: true,
  perimeterExtraction: true,
  archive: {
    door: { x: 40, y: 17, w: 3, h: 0.35 },
    inside: { x: 41.5, y: 15.8 },
    name: 'records office',
  },
  response: {
    spawns: [
      { x: 57, y: 18 },
      { x: 57, y: 19 },
      { x: 57, y: 20 },
    ],
    patrol: [
      { x: 55.5, y: 11 },
      { x: 52, y: 11 },
      { x: 53, y: 21 },
      { x: 42.5, y: 24 },
    ],
    specialists: [
      {
        role: 'sentry',
        posts: [
          { x: 53, y: 21 },
          { x: 42.5, y: 24 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 43, y: 32 },
          { x: 38.5, y: 28 },
        ],
      },
    ],
  },
  solids: [
    wall('north', 8, 4, 46.35, 0.35),
    wall('south', 8, 38, 46.35, 0.35),
    wall('west-north', 8, 4, 0.35, 27),
    wall('west-south', 8, 35, 0.35, 3.35),
    wall('east-north', 54, 4, 0.35, 5),
    wall('east-south', 54, 13, 0.35, 25.35),
    wall('checkpoint-north', 25, 4.35, 0.35, 3.65),
    wall('checkpoint-middle', 25, 12, 0.35, 10),
    wall('checkpoint-south', 25, 26, 0.35, 12),
    // CHECK has a walk-around counter; the original must travel into this office.
    wall('claims-north', 11, 9, 12.35, 0.35),
    wall('claims-west-north', 11, 9, 0.35, 2),
    wall('claims-west-south', 11, 14, 0.35, 7.35),
    wall('claims-east', 23, 9, 0.35, 12.35),
    wall('claims-front-west', 11, 21, 3, 0.35),
    wall('claims-front-east', 17, 21, 6.35, 0.35),
    { id: 'claims-counter', x: 12.5, y: 15.5, w: 7, h: 0.8, height: 1.4, kind: 'shelves' },
    { id: 'claims-screen', x: 17, y: 9.8, w: 0.6, h: 5.7, height: 1.7, kind: 'shelves' },
    { id: 'check-terminal', x: 12.5, y: 10, w: 2, h: 0.7, height: 1.1, kind: 'server' },
    // SIGN is sheltered, but its doorway is watched by the west court patrol.
    wall('sign-north', 11, 26, 7.35, 0.35),
    wall('sign-west', 11, 26, 0.35, 5.35),
    wall('sign-south', 11, 31, 7.35, 0.35),
    wall('sign-east-cap', 18, 26, 0.35, 1.5),
    { id: 'sign-terminal', x: 12, y: 27, w: 0.8, h: 2, height: 1.1, kind: 'server' },
    // The long central hall splits the two cross-court routes.
    { id: 'settlement-hall', x: 29, y: 19, w: 9, h: 7, height: 2.8, kind: 'building' },
    wall('north-court-screen', 28, 11.5, 5, 0.35),
    wall('east-service-screen', 52, 17.5, 0.35, 8),
    wall('records-screen', 37, 20, 11, 0.35),
    wall('south-court-screen', 31, 31, 8, 0.35),
    { id: 'court-planter', x: 40, y: 21, w: 1.5, h: 4, height: 1.3, kind: 'crate' },
    // REGISTER and RADIO share a shuttered records office, far from the entrance.
    wall('records-north', 34, 6, 15, 0.35),
    wall('records-west', 34, 6, 0.35, 11.35),
    wall('records-east', 48.65, 6, 0.35, 11.35),
    wall('records-front-west', 34, 17, 6, 0.35),
    wall('records-front-east', 43, 17, 6, 0.35),
    { id: 'records-racks', x: 36.5, y: 11.5, w: 10, h: 1, height: 1.7, kind: 'shelves' },
    { id: 'radio-cabinet', x: 45, y: 6.8, w: 2, h: 0.8, height: 1.2, kind: 'server' },
    { id: 'records-shunt', x: 29, y: 0.8, w: 2, h: 0.8, height: 1.2, kind: 'server' },
    // CLEAR's west doorway and east staff entrance lead around the screening counter.
    wall('clearing-north', 44, 26, 8.35, 0.35),
    wall('clearing-east-north', 52, 26, 0.35, 1.5),
    wall('clearing-east-south', 52, 30.5, 0.35, 2.85),
    wall('clearing-south', 44, 33, 8.35, 0.35),
    wall('clearing-west-cap', 44, 26, 0.35, 3),
    wall('clearing-west-foot', 44, 32, 0.35, 1.35),
    { id: 'clearing-counter', x: 46, y: 29.5, w: 4.5, h: 0.8, height: 1.4, kind: 'shelves' },
    { id: 'clear-terminal', x: 48, y: 26.8, w: 2, h: 0.7, height: 1.1, kind: 'server' },
    { id: 'street-kiosk', x: 2, y: 27, w: 3, h: 4, height: 2.4, kind: 'building' },
    { id: 'street-office-block', x: 1, y: 10, w: 4, h: 10, height: 3.1, kind: 'building' },
    { id: 'van', x: 56.4, y: 3.8, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      label: 'Bank staff identity',
      x: 5.5,
      y: 33,
      detail:
        'One office outfit for a pistol carrier. REGISTER remains conspicuous; inspectors still check credentials at close range.',
    },
    {
      id: 'override',
      tag: 'SHUNT',
      label: 'Records-office access shunt',
      x: 30,
      y: 2.5,
      detail:
        'Keep a partner holding this north-street control while another enters the records office. CUT is the noisy permanent alternative.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      label: 'Force the records shutter',
      x: 41.5,
      y: 18.5,
      detail:
        'Eight seconds of noisy work opens the records office permanently. SHUNT can hold it open quietly.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      label: 'Settlement security relay',
      x: 46,
      y: 9,
      detail:
        'Four seconds of work inside the records office. Stops new reinforcements, but the bank still needs the original register and two operators.',
    },
    {
      id: 'evidence',
      tag: 'REGISTER',
      label: 'Original beneficiary register',
      x: 36,
      y: 9,
      detail:
        'Required. Carry it to CHECK, then CLEAR, then VAN. Both hands are occupied. Drop it to fight or hand it to a partner; completed reconciliation is retained.',
    },
    {
      id: 'reconcile',
      tag: 'CHECK',
      label: 'Reconcile the original register',
      x: 13.5,
      y: 12,
      detail:
        'The REGISTER carrier must work here for six uninterrupted seconds. Completed reconciliation stays valid if the register changes hands.',
    },
    {
      id: 'countersign',
      tag: 'SIGN',
      label: 'Hold the countersignature terminal',
      x: 14,
      y: 28,
      detail:
        'After CHECK, leave a separate operative with free hands working here while the carrier works CLEAR. Movement, Hold, death or a flash interrupts the signature. This operator cannot fire.',
    },
    {
      id: 'settle',
      tag: 'CLEAR',
      label: 'Release the repayments',
      x: 49,
      y: 28.3,
      detail:
        'The reconciled REGISTER carrier works here while a separate operative holds SIGN. Twelve seconds of simultaneous work; progress survives interruptions. Both workers are unable to fire.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      label: 'North-east service exit',
      x: 53,
      y: 11,
      detail: 'Open from inside. Repayments must clear before the van can leave.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      label: 'Settlement extraction',
      x: 56,
      y: 8.5,
      detail:
        'Release the repayments, then bring REGISTER and every survivor here, including the SIGN operator.',
    },
  ],
  spawns: [
    { x: 5, y: 39.5 },
    { x: 6, y: 39.5 },
    { x: 5, y: 40.5 },
    { x: 6, y: 40.5 },
  ],
  guards: [
    patrol(
      [
        { x: 12, y: 34 },
        { x: 21, y: 34 },
      ],
      0,
    ),
    patrol(
      [
        { x: 22, y: 18 },
        { x: 22, y: 10 },
      ],
      -Math.PI / 2,
      {
        role: 'inspector',
        posts: [
          { x: 22, y: 18 },
          { x: 24, y: 10 },
        ],
      },
    ),
    patrol(
      [
        { x: 28, y: 29 },
        { x: 34, y: 29 },
      ],
      0,
      {
        role: 'sentry',
        posts: [
          { x: 28, y: 29 },
          { x: 32, y: 28 },
        ],
      },
    ),
    patrol([{ x: 51, y: 23 }], Math.PI, {
      role: 'marksman',
      posts: [
        { x: 51, y: 23 },
        { x: 51, y: 20 },
      ],
    }),
    patrol(
      [
        { x: 37, y: 15 },
        { x: 47, y: 15 },
      ],
      0,
      {
        role: 'sentry',
        posts: [
          { x: 37, y: 15 },
          { x: 47, y: 15 },
        ],
      },
    ),
    patrol(
      [
        { x: 43, y: 22 },
        { x: 48, y: 22 },
      ],
      0,
      {
        role: 'inspector',
        posts: [
          { x: 43, y: 22 },
          { x: 48, y: 22 },
        ],
      },
    ),
    patrol(
      [
        { x: 47, y: 35 },
        { x: 52, y: 35 },
      ],
      Math.PI,
      {
        role: 'breacher',
        posts: [
          { x: 43, y: 32 },
          { x: 48, y: 35 },
        ],
      },
    ),
    patrol(
      [
        { x: 12, y: 24 },
        { x: 21, y: 24 },
      ],
      0,
    ),
  ],
};
