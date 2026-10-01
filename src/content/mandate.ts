import type { Mission, Solid } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height: 1.6,
  kind: 'wall',
});

export const mandate: Mission = {
  id: 'mandate',
  number: '08',
  title: 'Adverse selection',
  location: 'Mutual Indemnity / authorisation works',
  objective: 'ledger',
  evidenceName: 'Restitution mandate',
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  trackingCamera: true,
  description: 'Take the restitution mandate from a site whose guns do not need a radio.',
  intro:
    'Quill: the keys unlock the escrow. The MANDATE makes the bank release it. Those amber and blue sentries are wired to separate feeds. RADIO will not stop them. Borrow a maintenance identity at KIT and use INSPECT to buy a shutdown window, or isolate the feeds from cover.',
  briefing: {
    lead: 'Security has stopped outsourcing its judgement.',
    body: 'Recover the MANDATE from the north records room and extract every survivor at the north-east VAN. Four armoured sentry turrets watch the cross-court and records approach. They scan, show a tracking line, then fire after 0.8 seconds of continuous sight. Solid cover breaks tracking. RADIO only stops human reinforcement calls. Follow the amber and blue cables to WEST and EAST: each feed powers two guns.',
    routes: [
      {
        title: 'Borrow their authority',
        body: 'KIT conceals a pistol carrier. INSPECT accepts that unexposed identity with free hands and weapon concealed, once: all turrets stop for 22 seconds. Stage the crew behind reception before authorising it. Isolating a feed takes four seconds and is permanent. Technicians may do this openly during inspection; outside that window, guards recognise sabotage. The west service walk and the passage north of the generator block reach both feeds. A uniform alone does not permit entry to the records room or carrying the MANDATE.',
      },
      {
        title: 'Dismantle the crossfire',
        body: 'Use the west service walk to reach WEST behind reception. Isolate it before crossing the yard, then approach EAST behind the generator block. Turrets have 180 health, a carbine, a visible reload and a vulnerable stationary mount. Sable can pick them off from beyond their nine-unit range; the crew can flank a scan from solid cover. They never chase a decoy into the open. A four-person rush draws overlapping fire and loses the advantage of your opening volley. Inspection is optional; the feeds and guns stay destructible after cover is blown.',
      },
    ],
  },
  width: 52,
  height: 38,
  restricted: { x: 9, y: 3, w: 37.35, h: 30.35 },
  secure: { x: 34.35, y: 5.35, w: 9.3, h: 10.65 },
  gate: { x: 46, y: 8, w: 0.35, h: 4 },
  gateOutside: { x: 47.5, y: 10 },
  response: {
    spawns: [
      { x: 49, y: 17 },
      { x: 49, y: 18 },
      { x: 49, y: 19 },
    ],
    patrol: [
      { x: 45, y: 10 },
      { x: 44.8, y: 21 },
      { x: 32, y: 26 },
    ],
    specialists: [
      {
        role: 'sentry',
        posts: [
          { x: 44.8, y: 21 },
          { x: 44.8, y: 27 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 32, y: 26 },
          { x: 30.5, y: 18 },
        ],
      },
    ],
  },
  security: {
    inspectionTime: 22,
    turrets: [
      {
        position: { x: 23, y: 27 },
        angle: Math.PI,
        circuit: 'power-west',
        cable: [
          { x: 15, y: 15.5 },
          { x: 19.5, y: 15.5 },
          { x: 19.5, y: 27 },
          { x: 23, y: 27 },
        ],
      },
      {
        position: { x: 26, y: 24 },
        angle: Math.PI,
        circuit: 'power-west',
        cable: [
          { x: 19.5, y: 19 },
          { x: 26, y: 19 },
          { x: 26, y: 24 },
        ],
      },
      {
        position: { x: 32, y: 22 },
        angle: Math.PI,
        circuit: 'power-east',
        cable: [
          { x: 32, y: 8 },
          { x: 32, y: 22 },
          { x: 32, y: 22 },
        ],
      },
      {
        position: { x: 40.5, y: 13 },
        angle: Math.PI * 0.6,
        circuit: 'power-east',
        cable: [
          { x: 32, y: 8 },
          { x: 33, y: 8 },
          { x: 33, y: 16.7 },
          { x: 40.5, y: 16.7 },
          { x: 40.5, y: 13 },
        ],
      },
    ],
  },
  solids: [
    wall('north-perimeter', 9, 3, 37.35, 0.35),
    wall('west-upper', 9, 3, 0.35, 21),
    wall('west-lower', 9, 28, 0.35, 5.35),
    wall('south-perimeter', 9, 33, 37.35, 0.35),
    wall('east-upper', 46, 3, 0.35, 5),
    wall('east-lower', 46, 12, 0.35, 21.35),
    wall('records-north', 34, 5, 10, 0.35),
    wall('records-west', 34, 5, 0.35, 11.35),
    wall('records-east', 44, 5, 0.35, 11.35),
    wall('records-front-west', 34, 16, 2, 0.35),
    wall('records-front-east', 39, 16, 5.35, 0.35),
    wall('records-screen', 34.5, 19, 10.2, 0.35),
    wall('records-return', 34, 16.35, 0.35, 1.35),
    wall('service-screen', 11.5, 18, 8, 0.35),
    { id: 'reception', x: 12, y: 20, w: 6, h: 4, height: 2.6, kind: 'building' },
    { id: 'generator-hall', x: 21, y: 9, w: 8, h: 6, height: 2.5, kind: 'building' },
    { id: 'loading-stack', x: 30, y: 27.5, w: 4, h: 3, height: 1.5, kind: 'container' },
    { id: 'yard-screen', x: 34, y: 20, w: 2, h: 2, height: 1.5, kind: 'crate' },
    { id: 'west-feed', x: 14, y: 13.2, w: 2, h: 1.2, height: 1.3, kind: 'server' },
    { id: 'east-feed', x: 30.5, y: 5.8, w: 2, h: 1.1, height: 1.3, kind: 'server' },
    { id: 'radio-cabinet', x: 10, y: 30.7, w: 1.2, h: 1, height: 1.2, kind: 'server' },
    { id: 'inspection-desk', x: 12, y: 25, w: 1.5, h: 1, height: 0.8, kind: 'crate' },
    { id: 'records-rack', x: 35.5, y: 10, w: 3, h: 1.3, height: 1.7, kind: 'server' },
    { id: 'street-kiosk', x: 2, y: 27, w: 3, h: 3, height: 2, kind: 'building' },
    { id: 'escape-van', x: 49.5, y: 3.5, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      x: 6,
      y: 31,
      label: 'Maintenance supervisor kit',
      detail:
        'Morrow or Vale can conceal a pistol and authorise INSPECT. The two long guns remain visible.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      x: 10.7,
      y: 29.4,
      label: 'Guard radio relay',
      detail:
        'Stops human reinforcement calls only. The four wired turrets keep scanning and firing.',
    },
    {
      id: 'authorise',
      tag: 'INSPECT',
      x: 12.7,
      y: 27,
      label: 'Authorise equipment inspection',
      detail:
        'One use. Unexposed maintenance identity, pistol concealed, free hands. Shuts all turrets down for 22 seconds; stage the crew first.',
    },
    {
      id: 'power-west',
      tag: 'WEST',
      x: 15,
      y: 15.5,
      label: 'Amber sentry feed',
      detail:
        'Four seconds with free hands permanently disables both amber guns. Reach it behind reception via the west service walk. Work is suspicious outside inspection.',
    },
    {
      id: 'power-east',
      tag: 'EAST',
      x: 32,
      y: 8,
      label: 'Blue sentry feed',
      detail:
        'Four seconds permanently disables both blue guns. Approach behind the generator hall. RADIO does not affect either feed.',
    },
    {
      id: 'evidence',
      tag: 'MANDATE',
      x: 37.5,
      y: 7.5,
      label: 'Restitution mandate',
      detail:
        'Required physical authorisation. Both hands occupied; the carrier is conspicuous even in uniform. Secure the return route first.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      x: 44.8,
      y: 10,
      label: 'North-east loading gate',
      detail: 'Open from inside, then bring the mandate and every survivor to VAN.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      x: 48.4,
      y: 7.5,
      label: 'North road extraction',
      detail: 'The MANDATE and every survivor are required. Order extraction to leave.',
    },
  ],
  spawns: [
    { x: 5, y: 34.5 },
    { x: 6, y: 34.5 },
    { x: 5, y: 35.5 },
    { x: 6, y: 35.5 },
  ],
  guards: [
    {
      position: { x: 13, y: 29 },
      patrol: [
        { x: 13, y: 29 },
        { x: 18, y: 29 },
      ],
      angle: 0,
    },
    {
      position: { x: 18, y: 11 },
      patrol: [
        { x: 18, y: 11 },
        { x: 18, y: 16 },
      ],
      angle: -Math.PI / 2,
    },
    {
      position: { x: 25, y: 17.2 },
      patrol: [
        { x: 25, y: 17.2 },
        { x: 30.5, y: 17.2 },
      ],
      angle: 0,
      tactic: {
        role: 'breacher',
        posts: [
          { x: 25, y: 17.2 },
          { x: 30.5, y: 17.2 },
          { x: 30.5, y: 23 },
        ],
      },
    },
    {
      position: { x: 42, y: 28 },
      patrol: [{ x: 42, y: 28 }],
      angle: Math.PI,
      tactic: {
        role: 'marksman',
        posts: [
          { x: 42, y: 28 },
          { x: 43, y: 22.5 },
        ],
      },
    },
    {
      position: { x: 43, y: 21 },
      patrol: [
        { x: 43, y: 21 },
        { x: 37, y: 21 },
      ],
      angle: 0,
    },
    {
      position: { x: 45, y: 28 },
      patrol: [
        { x: 45, y: 28 },
        { x: 45, y: 13 },
      ],
      angle: Math.PI / 2,
    },
  ],
};
