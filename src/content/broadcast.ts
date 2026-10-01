import type { Mission, Solid, Vec } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height: 1.6,
  kind: 'wall',
});
const patrol = (points: Vec[], angle = Math.PI) => ({ position: points[0], patrol: points, angle });

export const broadcast: Mission = {
  id: 'broadcast',
  number: '05',
  title: 'Public offering',
  location: 'Municipal exchange 11',
  objective: 'broadcast',
  loadout: ['pistol', 'pistol', 'carbine', 'carbine'],
  broadcast: { duration: 24, traceTime: 5 },
  description: "Publish Quill's audit. Hold the line, then get everyone out.",
  evidenceName: 'Suppression log',
  intro:
    'Quill: my audit is ready. Keep one operative on the street-side LOOP while another works UPLINK. Without the loop, they trace the signal in five seconds. Publish, then bring everyone to VAN.',
  briefing: {
    lead: 'An account they cannot quietly close.',
    body: "Quill's audit connects the ledger to the account keys. Publish it from the municipal exchange before the company buries the evidence. UPLINK needs 24 seconds of work with free hands. Progress survives interruptions and a change of operator. Bring every survivor to VAN once the audit is public.",
    routes: [
      {
        title: 'Keep the line quiet',
        body: 'Leave one operative holding LOOP on the west street. Give KIT to a second operative and infiltrate UPLINK. LOOP masks the signal, but does not fool guards who see you. A patrol checks the server room: withdraw behind the racks when challenged, then resume. The room is restricted even in uniform. Changing selection preserves held work.',
      },
      {
        title: 'Defend the transmission',
        body: 'Without LOOP, five seconds of uploading reveals the terminal and draws nearby security. RADIO stops reinforcements, not the trace. Defend the operator while the upload finishes; they cannot fire while working. Prepare GATE for the east escape and remember the LOOP operator. A carbine sentry covers the server-room approach. Break its lane at the racks or approach from the other side. Stop Rook and Sable to steady their carbines; cover their reloads. The suppression LOG is optional, suspicious cargo.',
      },
    ],
  },
  width: 40,
  height: 30,
  restricted: { x: 8, y: 3, w: 26.35, h: 21.35 },
  secure: { x: 25.35, y: 4.35, w: 8.3, h: 6.95 },
  gate: { x: 34, y: 19, w: 0.35, h: 3 },
  gateOutside: { x: 35.4, y: 20.5 },
  response: {
    spawns: [
      { x: 37, y: 19.5 },
      { x: 37, y: 20.5 },
      { x: 37, y: 21.5 },
    ],
    patrol: [
      { x: 32, y: 20.5 },
      { x: 32, y: 14 },
      { x: 29, y: 12.5 },
    ],
  },
  solids: [
    wall('exchange-north', 8, 3, 26.35, 0.35),
    wall('exchange-west-a', 8, 3, 0.35, 13.5),
    wall('exchange-west-b', 8, 19.5, 0.35, 4.85),
    wall('exchange-south', 8, 24, 26.35, 0.35),
    wall('exchange-east-a', 34, 3, 0.35, 16),
    wall('exchange-east-b', 34, 22, 0.35, 2.35),
    wall('server-north', 25, 4, 9, 0.35),
    wall('server-west', 25, 4, 0.35, 7.65),
    wall('server-front-a', 25, 11.3, 2.5, 0.35),
    wall('server-front-b', 30.8, 11.3, 3.2, 0.35),
    { id: 'uplink-racks', x: 27.3, y: 8.2, w: 3.4, h: 1.5, height: 1.7, kind: 'server' },
    { id: 'switch-racks', x: 32, y: 5.3, w: 1.1, h: 3.5, height: 1.7, kind: 'server' },
    { id: 'exchange-office', x: 10, y: 5, w: 7, h: 5.3, height: 2.6, kind: 'building' },
    { id: 'antenna-a', x: 19, y: 5.2, w: 2.2, h: 2.2, height: 4, kind: 'mast' },
    { id: 'antenna-b', x: 19, y: 10, w: 2.2, h: 2.2, height: 4, kind: 'mast' },
    { id: 'generator', x: 15, y: 15, w: 6, h: 3.5, height: 1.5, kind: 'container' },
    { id: 'south-transformer', x: 25, y: 18, w: 4, h: 3.5, height: 1.5, kind: 'container' },
    { id: 'delivery-crates', x: 10.5, y: 20.7, w: 2.7, h: 1.7, height: 1, kind: 'crate' },
    { id: 'street-cabinet', x: 2, y: 14.5, w: 3, h: 4, height: 2.4, kind: 'building' },
    { id: 'east-van', x: 35.3, y: 26.5, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 5.6,
      y: 22.5,
      label: 'Exchange maintenance kit',
      detail:
        'Maintenance cover for Morrow or Vale: pistols conceal, carbines remain visible. The server room is still restricted.',
    },
    {
      id: 'mask',
      tag: 'LOOP',
      x: 5.8,
      y: 12.3,
      label: 'Street line loop',
      detail:
        'Hold continuously to mask the upload. Free hands required. Move or Hold releases it.',
    },
    {
      id: 'upload',
      tag: 'UPLINK',
      x: 29.5,
      y: 6.2,
      label: 'Public audit uplink',
      detail:
        '24 seconds with free hands. Progress is saved if interrupted. Without LOOP, trace completes in five seconds.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 10.3,
      y: 14,
      label: 'Exchange radio relay',
      detail: 'Stops calls for reinforcements. A traced uplink still draws nearby guards.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 32.8,
      y: 20.5,
      label: 'East service gate',
      detail: 'Prepare the east escape. Open quietly from inside.',
    },
    {
      id: 'evidence',
      tag: 'LOG',
      x: 18,
      y: 5,
      label: 'Suppression log',
      detail:
        'Optional record of censored broadcasts. Occupies both hands and attracts suspicion, even in uniform.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 37.2,
      y: 25,
      label: 'East street extraction',
      detail:
        'Publish the audit, then bring every survivor here. Remember the LOOP operator on the west street.',
    },
  ],
  spawns: [
    { x: 4.5, y: 26 },
    { x: 5.5, y: 26 },
    { x: 4.5, y: 27 },
    { x: 5.5, y: 27 },
  ],
  guards: [
    patrol(
      [
        { x: 12, y: 14 },
        { x: 12, y: 19.2 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 18, y: 12.8 },
        { x: 24, y: 12.8 },
      ],
      0,
    ),
    patrol(
      [
        { x: 23, y: 5 },
        { x: 23, y: 13 },
        { x: 29, y: 12.5 },
        { x: 31.2, y: 10.5 },
        { x: 31.2, y: 6.2 },
        { x: 26.1, y: 6.2 },
        { x: 26.1, y: 10.5 },
        { x: 29, y: 12.5 },
        { x: 23, y: 13 },
      ],
      Math.PI / 2,
    ),
    {
      ...patrol(
        [
          { x: 27, y: 13.7 },
          { x: 32.5, y: 13.7 },
        ],
        0,
      ),
      tactic: {
        role: 'sentry',
        posts: [
          { x: 27, y: 13.7 },
          { x: 32.5, y: 13.7 },
          { x: 26.1, y: 10.5 },
          { x: 31.5, y: 10.5 },
        ],
      },
    },
    patrol(
      [
        { x: 23, y: 16 },
        { x: 23, y: 21.5 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 32, y: 17 },
        { x: 32, y: 22.5 },
      ],
      Math.PI / 2,
    ),
    patrol(
      [
        { x: 36.8, y: 9 },
        { x: 36.8, y: 22 },
      ],
      Math.PI / 2,
    ),
  ],
};
