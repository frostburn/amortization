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
const post = (points: Vec[], angle: number, role?: GuardTactic['role'], posts = points) => ({
  position: points[0],
  patrol: points,
  angle,
  ...(role ? { tactic: { role, posts } } : {}),
});

export const countermand: Mission = {
  id: 'countermand',
  number: '12',
  title: 'Countermand',
  location: 'Municipal Recovery / dispatch yard · 11:40',
  objective: 'recall',
  daylight: true,
  trackingCamera: true,
  flashGrenades: true,
  loadout: ['pistol', 'pistol', 'support', 'coil'],
  evidenceName: 'Seizure recall',
  recall: { filingTime: 9 },
  relayTime: 5,
  description: 'Withdraw the outstanding seizure orders at the company’s dispatch yard.',
  intro:
    'Mara: the repayments cleared, but the dispatch office still holds seizure orders issued before the injunction. Recover the signed RECALL, file it at FILE, and bring the original home.',
  briefing: {
    lead: 'The money is moving. The seizure crews have not been recalled.',
    body: 'Recover the signed RECALL from the north records office. Its carrier must work FILE for nine uninterrupted seconds to cancel outstanding dispatches. Bring the original and every survivor to VAN.',
    routes: [
      {
        title: 'Two approaches',
        body: 'The wide loading entrance meets a shield officer and an olive support gunner. The north staff entrance leads behind the long warehouse. KIT helps a pistol carrier scout this route; the original RECALL is conspicuous even in uniform. RADIO is at the rear of the records office, five seconds of work beyond the yard patrols.',
      },
      {
        title: 'Cover a partner',
        body: 'Rook’s support gun needs a stationary firing position. Its narrow lane of fire slows enemy aiming and recovery, giving another operative time to move. Pressure never stops movement or reloads and cannot pin a target forever. Olive gunners use the same weapon. Break sight behind freight stacks, or attack while they reload.',
      },
      {
        title: 'Turn the shield',
        body: 'Burgundy officers carry pale shields that absorb 88% of frontal damage. They turn slowly; hold their attention while a partner takes a side or rear shot. A flash makes them lower the shield briefly. Their body has ordinary guard health. Disabling RADIO does not remove shields or the local gunners.',
      },
      {
        title: 'File and withdraw',
        body: 'FILE is in the south-east dispatch booth, across the yard from RECALL. The carrier cannot shoot. Move or Hold cancels unfinished filing; a flash restarts it too. Completed filing survives dropping the original or handing it to a partner. Open the north-east GATE from inside and bring every survivor and RECALL to VAN.',
      },
    ],
  },
  width: 64,
  height: 46,
  restricted: { x: 8, y: 4, w: 49.35, h: 36.35 },
  secure: { x: 41.35, y: 6.35, w: 13.65, h: 9 },
  gate: { x: 57, y: 10, w: 0.35, h: 4 },
  gateOutside: { x: 58.5, y: 12 },
  gateInsideOnly: true,
  perimeterExtraction: true,
  response: {
    spawns: [
      { x: 60, y: 23 },
      { x: 60, y: 24 },
      { x: 60, y: 25 },
    ],
    patrol: [
      { x: 59, y: 12 },
      { x: 56, y: 12 },
      { x: 55.5, y: 20 },
      { x: 47, y: 21 },
    ],
    specialists: [
      {
        role: 'shield',
        posts: [
          { x: 47, y: 21 },
          { x: 48, y: 29 },
        ],
      },
      {
        role: 'support',
        posts: [
          { x: 52, y: 21 },
          { x: 55.5, y: 17 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 43, y: 29 },
          { x: 43, y: 35 },
        ],
      },
    ],
  },
  solids: [
    wall('north', 8, 4, 49.35, 0.35),
    wall('south', 8, 40, 49.35, 0.35),
    wall('west-cap', 8, 4, 0.35, 5),
    wall('west-middle', 8, 12, 0.35, 19),
    wall('west-foot', 8, 35, 0.35, 5.35),
    wall('east-cap', 57, 4, 0.35, 6),
    wall('east-foot', 57, 14, 0.35, 26.35),
    // Long warehouse: the north staff route and south loading apron are separate approaches.
    { id: 'warehouse', x: 12, y: 13, w: 17, h: 8, height: 2.9, kind: 'building' },
    { id: 'loading-store', x: 23, y: 24, w: 8, h: 4, height: 2.3, kind: 'container' },
    { id: 'west-stack', x: 12, y: 25, w: 4, h: 3, height: 1.7, kind: 'crate' },
    { id: 'south-stack', x: 20, y: 36, w: 8, h: 1.7, height: 1.7, kind: 'container' },
    { id: 'central-stack', x: 35, y: 22, w: 3, h: 7, height: 1.7, kind: 'container' },
    { id: 'north-stack', x: 32, y: 10, w: 5, h: 2, height: 1.7, kind: 'container' },
    { id: 'dispatch-stack', x: 39, y: 33, w: 3, h: 4, height: 1.7, kind: 'crate' },
    wall('east-screen', 53, 18, 0.35, 11),
    // Two wide records doors, and racks screening the original and the deep radio cabinet.
    wall('records-north', 41, 6, 14, 0.35),
    wall('records-west-cap', 41, 6, 0.35, 3),
    wall('records-west-foot', 41, 12, 0.35, 3.35),
    wall('records-east', 55, 6, 0.35, 9.35),
    wall('records-front-west', 41, 15, 3, 0.35),
    wall('records-front-east', 47, 15, 8.35, 0.35),
    { id: 'records-rack', x: 44, y: 11, w: 8, h: 0.8, height: 1.7, kind: 'shelves' },
    { id: 'radio-cabinet', x: 52, y: 6.8, w: 2, h: 0.7, height: 1.2, kind: 'server' },
    // A booth, not a maze: two open doors and a counter to shelter the filing position.
    wall('dispatch-north', 45, 30, 10.35, 0.35),
    wall('dispatch-south', 45, 38, 10.35, 0.35),
    wall('dispatch-west-cap', 45, 30, 0.35, 2),
    wall('dispatch-west-foot', 45, 35, 0.35, 3.35),
    wall('dispatch-east-cap', 55, 30, 0.35, 2),
    wall('dispatch-east-foot', 55, 35, 0.35, 3.35),
    { id: 'dispatch-counter', x: 47, y: 34.8, w: 5.8, h: 0.8, height: 1.4, kind: 'shelves' },
    { id: 'filing-desk', x: 48.5, y: 31, w: 2, h: 0.7, height: 1.1, kind: 'server' },
    { id: 'street-office', x: 1, y: 22, w: 3, h: 7, height: 2.6, kind: 'building' },
    { id: 'van', x: 60, y: 4.2, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      label: 'Dispatch maintenance identity',
      x: 5.5,
      y: 32,
      detail:
        'One uniform for a pistol carrier. Long guns stay visible; carrying RECALL attracts suspicion even in uniform.',
    },
    {
      id: 'evidence',
      tag: 'RECALL',
      label: 'Signed seizure recall',
      x: 43,
      y: 8,
      detail:
        'Required original. Carry to FILE, then VAN. Occupies both hands and attracts suspicion. X sets it down for another operative.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      label: 'Dispatch security relay',
      x: 53,
      y: 8.5,
      detail:
        'Five seconds at the rear of the records office. Stops new reinforcements. Local shield officers and support gunners remain active.',
    },
    {
      id: 'file-recall',
      tag: 'FILE',
      label: 'Cancel outstanding seizure dispatches',
      x: 49.5,
      y: 33,
      detail:
        'The RECALL carrier needs nine uninterrupted seconds. Cannot fire while carrying. Moving, Hold or a flash cancels unfinished work. Once filed, bring the original and every survivor to VAN.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      label: 'North-east service exit',
      x: 56,
      y: 12,
      detail: 'Open from inside. File the recall before the van can depart.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      label: 'Dispatch extraction',
      x: 60,
      y: 9,
      detail: 'File RECALL, then bring its carrier and every surviving operative here.',
    },
  ],
  spawns: [
    { x: 5, y: 41.5 },
    { x: 6, y: 41.5 },
    { x: 5, y: 42.5 },
    { x: 6, y: 42.5 },
  ],
  guards: [
    post([{ x: 20, y: 32 }], Math.PI, 'shield', [
      { x: 20, y: 32 },
      { x: 22, y: 29 },
    ]),
    post([{ x: 28, y: 30 }], Math.PI, 'support', [
      { x: 28, y: 30 },
      { x: 30, y: 23 },
    ]),
    post(
      [
        { x: 16, y: 10 },
        { x: 27, y: 10 },
      ],
      0,
    ),
    post(
      [
        { x: 35, y: 16 },
        { x: 40, y: 16 },
      ],
      0,
      'inspector',
    ),
    post(
      [
        { x: 43, y: 13.3 },
        { x: 53.5, y: 13.3 },
      ],
      0,
      'sentry',
    ),
    post([{ x: 47, y: 27 }], Math.PI / 2, 'shield', [
      { x: 47, y: 27 },
      { x: 44, y: 29 },
    ]),
    post([{ x: 50, y: 22 }], Math.PI / 2, 'support', [
      { x: 50, y: 22 },
      { x: 54.5, y: 21 },
    ]),
    post(
      [
        { x: 33, y: 35 },
        { x: 37, y: 35 },
      ],
      Math.PI,
      'breacher',
    ),
    post(
      [
        { x: 54, y: 36.7 },
        { x: 46.5, y: 36.7 },
      ],
      Math.PI,
    ),
  ],
};
