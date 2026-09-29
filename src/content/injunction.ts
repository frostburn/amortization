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

export const injunction: Mission = {
  id: 'injunction',
  number: '10',
  title: 'Stay of execution',
  location: 'Mutual Indemnity / enforcement registry',
  objective: 'broadcast',
  evidenceName: 'Raid authorisation log',
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  trackingCamera: true,
  flashGrenades: true,
  relayTime: 4,
  description: 'Serve the mandate. Shut down the collection orders before another safehouse raid.',
  intro:
    'Mara: all four of you are back. Now we make the mandate binding. Serve it at the registry UPLINK. Ivory inspectors check maintenance identities; break sight before their check completes. RADIO is in the north-east control office, beyond the inner checkpoint. Rook and Sable each brought one flash.',
  briefing: {
    lead: 'An order is only paper until someone has to obey it.',
    body: 'The mandate survived and the crew is together again. Upload it to the enforcement registry for 20 seconds, then extract every survivor at the north-east VAN. A partner holding LOOP masks the terminal trace; upload progress survives interruptions. The raid log is optional. RADIO is deep inside a secure office: the entrance offers no quick way to stop reinforcements.',
    routes: [
      {
        title: 'Past the credentials desk',
        body: 'Give Morrow or Vale KIT. Ivory inspectors with orange shoulder caps verify a disguise within four units over 2.5 seconds. Their visible checking line and countdown give time to leave range or break sight; walking behind them avoids the check. Reach LOOP through the screened west service walk. The north passage leads behind the registry racks to UPLINK. The north-street SHUNT must be held by a partner to open the RADIO office; keep them there until the infiltrator leaves. CUT forces the shutter in eight noisy seconds. RADIO then needs four seconds of work and the secure area still attracts suspicion in uniform. Watch the office patrol and use the racks.',
      },
      {
        title: 'Make a crossing',
        body: 'Rook and Sable carry one flash each. Select either or both, choose Flash / B, then choose a landing point and confirm one throw. The preview names its thrower and exposed teammates. Range seven; radius three. Solid cover blocks throws and exposure. After the visible throw and fuse, exposed people cannot fire or work for 1.5 seconds, but movement continues. Ongoing backup calls continue. Use this window to cross the checkpoint or retreat from the eastern firing lane. Grenades are optional and never replenish.',
      },
      {
        title: 'Keep the alarm expensive',
        body: 'The entrance, inner checkpoint, and control office are separate defensive positions. Advancing as one firing line can alert the office before anyone reaches RADIO. Use the service buildings, split firing angles, and cover Sable while the coil charges. Disabling RADIO stops further reports and response waves; it does not erase identities or silence local guards. A traced UPLINK remains usable, and the upload can be completed after both flashes are spent.',
      },
    ],
  },
  width: 56,
  height: 42,
  restricted: { x: 8, y: 4, w: 42.35, h: 32.35 },
  secure: { x: 36.35, y: 6.35, w: 11.65, h: 11.65 },
  gate: { x: 50, y: 9, w: 0.35, h: 4 },
  gateOutside: { x: 51.5, y: 11 },
  gateInsideOnly: true,
  archive: {
    door: { x: 40, y: 18, w: 3, h: 0.35 },
    inside: { x: 41.5, y: 16.8 },
    name: 'control office',
  },
  broadcast: {
    duration: 20,
    traceTime: 5,
    subject: 'the restitution mandate',
    completed: 'Mandate served',
    guidance:
      'Use the screened west service walk to staff LOOP, then send a partner to UPLINK behind the north registry racks. Uploading takes 20 seconds; progress is saved if work stops. Ivory inspectors check uniforms within four units: break sight before their 2.5-second check ends. RADIO is optional, in the secure north-east office beyond the checkpoint. Use a partner on the north-street SHUNT or force CUT for eight seconds, then work RADIO for four seconds. Keep SHUNT held until the infiltrator leaves. Flashes create a crossing but do not interrupt a backup call.',
  },
  response: {
    spawns: [
      { x: 53, y: 18 },
      { x: 53, y: 19 },
      { x: 53, y: 20 },
    ],
    patrol: [
      { x: 51.5, y: 11 },
      { x: 49, y: 11 },
      { x: 49, y: 22 },
      { x: 36, y: 23 },
    ],
    specialists: [
      {
        role: 'sentry',
        posts: [
          { x: 49, y: 22 },
          { x: 40, y: 22 },
        ],
      },
      {
        role: 'breacher',
        posts: [
          { x: 35, y: 24 },
          { x: 23, y: 22 },
        ],
      },
    ],
  },
  solids: [
    wall('north', 8, 4, 42.35, 0.35),
    wall('south', 8, 36, 42.35, 0.35),
    wall('west-north', 8, 4, 0.35, 25),
    wall('west-south', 8, 33, 0.35, 3.35),
    wall('east-north', 50, 4, 0.35, 5),
    wall('east-south', 50, 13, 0.35, 23.35),
    wall('checkpoint-north', 20, 4.35, 0.35, 15.65),
    wall('checkpoint-south', 20, 24, 0.35, 12),
    { id: 'reception', x: 13, y: 26, w: 4, h: 4, height: 2.5, kind: 'building' },
    { id: 'service-hall', x: 13, y: 7, w: 4.5, h: 10, height: 2.8, kind: 'building' },
    wall('loop-screen', 10, 21, 5, 0.35),
    wall('loop-return', 14.5, 17.3, 0.35, 3.7),
    { id: 'office-shunt', x: 33, y: 0.8, w: 2, h: 0.8, height: 1.2, kind: 'server' },
    { id: 'loop-cabinet', x: 10, y: 17.5, w: 2, h: 0.8, height: 1.2, kind: 'server' },
    wall('registry-north', 23, 5.5, 10, 0.35),
    wall('registry-west', 23, 5.5, 0.35, 9.5),
    wall('registry-east', 33, 5.5, 0.35, 9.85),
    wall('registry-front-west', 23, 15, 4, 0.35),
    wall('registry-front-east', 30, 15, 3.35, 0.35),
    { id: 'registry-racks', x: 24.5, y: 10.5, w: 6.5, h: 1, height: 1.7, kind: 'server' },
    { id: 'registry-terminal', x: 24.5, y: 6.5, w: 2, h: 0.7, height: 1.1, kind: 'server' },
    wall('office-north', 36, 6, 12.35, 0.35),
    wall('office-west', 36, 6, 0.35, 12.35),
    wall('office-east', 48, 6, 0.35, 12.35),
    wall('office-front-west', 36, 18, 4, 0.35),
    wall('office-front-east', 43, 18, 5.35, 0.35),
    { id: 'office-racks', x: 38, y: 11, w: 8, h: 1, height: 1.7, kind: 'server' },
    { id: 'radio-cabinet', x: 44, y: 6.8, w: 2, h: 0.8, height: 1.2, kind: 'server' },
    { id: 'sorting-hall', x: 25, y: 26.5, w: 7, h: 5, height: 2.6, kind: 'building' },
    { id: 'crossing-stack', x: 25, y: 20, w: 6, h: 2, height: 1.4, kind: 'container' },
    { id: 'east-stack', x: 38, y: 27, w: 6, h: 3, height: 1.5, kind: 'container' },
    wall('registry-screen', 23, 17.5, 10, 0.35),
    wall('office-screen', 39, 21, 7, 0.35),
    { id: 'street-kiosk', x: 2, y: 25, w: 3, h: 4, height: 2.3, kind: 'building' },
    { id: 'van', x: 52.2, y: 4, w: 1.6, h: 3, height: 1.55, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'override',
      tag: 'SHUNT',
      label: 'Control-office access shunt',
      x: 34,
      y: 2.5,
      detail:
        'Leave a partner holding this north-street control while another enters the RADIO office. Keep it held until they are outside. CUT is the noisy alternative.',
    },
    {
      id: 'breach',
      tag: 'CUT',
      label: 'Force the control-office shutter',
      x: 41.5,
      y: 19.5,
      detail:
        'Eight seconds of noisy work permanently opens the RADIO office. A partner holding SHUNT opens it quietly.',
    },
    {
      id: 'disguise',
      tag: 'KIT',
      label: 'Registry maintenance identity',
      x: 5.8,
      y: 32,
      detail:
        'One disguise for Morrow or Vale. Ivory inspectors can verify it: break sight or leave their four-unit checking range.',
    },
    {
      id: 'mask',
      tag: 'LOOP',
      label: 'Hold registry trace loop',
      x: 11,
      y: 19.2,
      detail:
        'Keep a partner working here while another serves the mandate at UPLINK. Movement, Hold or a flash interrupts work.',
    },
    {
      id: 'upload',
      tag: 'UPLINK',
      label: 'Serve the restitution mandate',
      x: 25.5,
      y: 8,
      detail:
        'Twenty seconds with free hands. Progress survives interruptions. Without LOOP, five seconds of uploading draws guards. Flashes interrupt the worker too.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      label: 'Enforcement control relay',
      x: 45,
      y: 8.8,
      detail:
        'Four seconds inside the guarded control office. A partner must hold SHUNT or force CUT to enter. Stops further reports and reinforcements. Use the racks to break sight.',
    },
    {
      id: 'evidence',
      tag: 'LOG',
      label: 'Safehouse raid authorisations',
      x: 38,
      y: 8.5,
      detail:
        'Optional physical evidence. It exposes a disguised carrier and occupies both hands. Serve the mandate before extracting.',
    },
    {
      id: 'gate',
      tag: 'GATE',
      label: 'North-east service exit',
      x: 49,
      y: 11,
      detail: 'Open from inside and bring every survivor to VAN after the mandate is served.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      label: 'Registry extraction',
      x: 52,
      y: 8,
      detail:
        'Serve the mandate, then order every survivor here. Bring the LOOP operator too. LOG is optional.',
    },
  ],
  spawns: [
    { x: 5, y: 37.5 },
    { x: 6, y: 37.5 },
    { x: 5, y: 38.5 },
    { x: 6, y: 38.5 },
  ],
  guards: [
    patrol(
      [
        { x: 11, y: 31 },
        { x: 18, y: 31 },
      ],
      0,
    ),
    patrol(
      [
        { x: 18, y: 25 },
        { x: 18, y: 21 },
        { x: 15.8, y: 21.8 },
        { x: 15.8, y: 24 },
      ],
      -Math.PI / 2,
      {
        role: 'inspector',
        posts: [
          { x: 18, y: 25 },
          { x: 21.5, y: 22 },
        ],
      },
    ),
    patrol([{ x: 34.5, y: 23 }], Math.PI, {
      role: 'marksman',
      posts: [
        { x: 34.5, y: 23 },
        { x: 35, y: 27 },
      ],
    }),
    patrol(
      [
        { x: 24, y: 24 },
        { x: 34, y: 24 },
      ],
      Math.PI,
      {
        role: 'sentry',
        posts: [
          { x: 24, y: 24 },
          { x: 32, y: 24 },
        ],
      },
    ),
    patrol(
      [
        { x: 28.5, y: 13 },
        { x: 31.7, y: 13 },
        { x: 31.7, y: 8 },
        { x: 31.7, y: 13 },
      ],
      0,
      {
        role: 'inspector',
        posts: [
          { x: 28.5, y: 13 },
          { x: 31.7, y: 8 },
        ],
      },
    ),
    patrol(
      [
        { x: 39, y: 15 },
        { x: 46, y: 15 },
      ],
      0,
      {
        role: 'inspector',
        posts: [
          { x: 39, y: 15 },
          { x: 46, y: 15 },
        ],
      },
    ),
    patrol(
      [
        { x: 46.5, y: 24 },
        { x: 46.5, y: 19.5 },
      ],
      -Math.PI / 2,
      {
        role: 'sentry',
        posts: [
          { x: 46.5, y: 24 },
          { x: 46.5, y: 19.5 },
        ],
      },
    ),
    patrol(
      [
        { x: 36, y: 32 },
        { x: 47, y: 32 },
      ],
      Math.PI,
      {
        role: 'breacher',
        posts: [
          { x: 36, y: 32 },
          { x: 35, y: 26 },
        ],
      },
    ),
  ],
};
