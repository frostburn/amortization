import type { Mission, Solid } from '../sim/types';

const wall = (id: string, x: number, y: number, w: number, h: number): Solid => ({
  id,
  x,
  y,
  w,
  h,
  height: 1.5,
  kind: 'wall',
});
const patrol = (points: { x: number; y: number }[], angle = Math.PI) => ({
  position: points[0],
  patrol: points,
  angle,
});

export const personnel: Mission = {
  id: 'personnel',
  number: '09',
  title: 'Key personnel',
  location: 'Mutual Indemnity / personnel retention',
  objective: 'rescue',
  description: 'Two outside. Two detained. Bring all four home.',
  evidenceName: 'Detention register',
  loadout: ['pistol', 'pistol', 'automatic', 'coil'],
  trackingCamera: true,
  intro:
    'Voss: the mandate is safe with Mara. They raided the safehouse while Morrow and Sable were scouting the handover. Now they want the mandate for Vale and Rook. We are collecting our people instead. I traced a remote gate console on the west service street.',
  briefing: {
    lead: 'They have mistaken our people for negotiable assets.',
    body: 'The extraction from the authorisation works succeeded. Hours later, a safehouse raid took Vale and Rook alive. Morrow and Sable must free them from separate cells and extract all four at VAN. Losing any operative fails this rescue. The mandate stays with Mara.',
    routes: [
      {
        title: 'One console, two partners',
        body: 'Give Morrow the maintenance KIT. Send Sable to the west remote console and hold INTAKE while Morrow passes the amber gate. Stop inside, select Sable and switch to CELLS: the amber gate closes and the blue gate opens. Select Morrow again to enter holding. Selection never releases a held circuit. The operator cannot shoot while working. RADIO does not power these locks.',
      },
      {
        title: 'Free them, then release the route',
        body: 'Keep a partner holding CELLS while another works the local VALE and ROOK locks for two continuously powered seconds each. A power interruption restarts the release. Door safety cannot replace remote power. A guard patrols between the cells: keep freed teammates inside until they can slip out behind him. Each can recover their own weapon and dressing at GEAR, or leave unarmed. Once both are free, use EXIT to latch both gates open and bring the console operator. The register is optional. Blown cover still permits a coordinated armed rescue.',
      },
    ],
  },
  width: 48,
  height: 36,
  restricted: { x: 16, y: 6, w: 28.35, h: 25.35 },
  secure: { x: 34, y: 6, w: 10.35, h: 25.35 },
  // The ordinary road barrier is outside detention; reinforcements cannot open a back door.
  gate: { x: 45, y: 31, w: 2.5, h: 0.35 },
  gateOutside: { x: 46, y: 32.5 },
  detention: {
    gates: [
      { id: 'access-intake', door: { x: 16, y: 25, w: 0.35, h: 3 } },
      { id: 'access-cells', door: { x: 30, y: 15, w: 0.35, h: 3 } },
    ],
    cells: [
      { id: 'rescue-vale', agent: 1, door: { x: 34, y: 9, w: 0.35, h: 3 } },
      { id: 'rescue-rook', agent: 2, door: { x: 34, y: 24, w: 0.35, h: 3 } },
    ],
  },
  response: {
    spawns: [
      { x: 46, y: 28 },
      { x: 46, y: 29 },
    ],
    patrol: [
      { x: 46, y: 33 },
      { x: 12, y: 33 },
      { x: 12, y: 23 },
    ],
  },
  solids: [
    wall('north', 16, 6, 28.35, 0.35),
    wall('south', 16, 31, 28.35, 0.35),
    wall('east', 44, 6, 0.35, 25.35),
    wall('west-upper', 16, 6, 0.35, 19),
    wall('west-lower', 16, 28, 0.35, 3.35),
    wall('divider-north', 30, 6, 0.35, 9),
    wall('divider-south', 30, 18, 0.35, 13.35),
    wall('vale-front-north', 34, 6, 0.35, 3),
    wall('vale-front-south', 34, 12, 0.35, 2.35),
    wall('vale-south', 34, 14, 10, 0.35),
    wall('rook-front-north', 34, 22, 0.35, 2),
    wall('rook-front-south', 34, 27, 0.35, 4.35),
    wall('rook-north', 34, 22, 10, 0.35),
    { id: 'console', x: 11.5, y: 20.5, w: 2, h: 0.6, height: 1.1, kind: 'server' },
    wall('console-cover', 10, 18, 4, 0.35),
    { id: 'intake-office', x: 20, y: 19, w: 3, h: 5, height: 2.6, kind: 'building' },
    { id: 'screen', x: 26, y: 11, w: 0.5, h: 9, height: 1.6, kind: 'wall' },
    { id: 'lockers', x: 38, y: 19, w: 3, h: 0.65, height: 1.3, kind: 'shelves' },
    { id: 'holding-screen', x: 35, y: 16.3, w: 4.5, h: 0.5, height: 1.6, kind: 'wall' },
    { id: 'intake-crates', x: 18, y: 28.5, w: 3, h: 1, height: 0.9, kind: 'crate' },
    { id: 'vale-bunk', x: 40, y: 7, w: 2.5, h: 1, height: 0.5, kind: 'crate' },
    { id: 'rook-bunk', x: 40, y: 29, w: 2.5, h: 1, height: 0.5, kind: 'crate' },
    { id: 'van', x: 3, y: 28, w: 3.6, h: 1.5, height: 1.6, kind: 'van' },
  ],
  landmarks: [
    {
      id: 'disguise',
      tag: 'KIT',
      label: 'Maintenance identity',
      x: 8,
      y: 29,
      detail: 'Morrow can conceal a pistol. Take the uniform before entering intake.',
    },
    {
      id: 'access-intake',
      tag: 'INTAKE',
      label: 'Hold intake circuit',
      x: 12,
      y: 22,
      detail:
        'Hold the amber gate open. One operative must stay here. Switching to CELLS closes INTAKE.',
    },
    {
      id: 'access-cells',
      tag: 'CELLS',
      label: 'Hold cell circuit',
      x: 13.5,
      y: 22,
      detail:
        'Same console: power the blue gate and local cell locks. The operator must stay here while a partner frees the prisoners.',
    },
    {
      id: 'relay',
      tag: 'RADIO',
      label: 'Human dispatch relay',
      x: 19,
      y: 26,
      detail: 'Stops reinforcement calls. It has no effect on the wired detention gates.',
    },
    {
      id: 'rescue-vale',
      tag: 'VALE',
      label: 'Free Vale',
      x: 32.8,
      y: 10.5,
      detail:
        'Local release: two seconds while a different operative holds CELLS. Vale joins unarmed.',
    },
    {
      id: 'rescue-rook',
      tag: 'ROOK',
      label: 'Free Rook',
      x: 32.8,
      y: 25.5,
      detail:
        'Local release: two seconds while a different operative holds CELLS. Rook joins unarmed.',
    },
    {
      id: 'equipment',
      tag: 'GEAR',
      label: 'Confiscated equipment',
      x: 39,
      y: 20.5,
      detail:
        'Each freed prisoner can recover their own weapon and field dressing. Optional for extraction.',
    },
    {
      id: 'escape-release',
      tag: 'EXIT',
      label: 'Emergency gate release',
      x: 32,
      y: 28.5,
      detail:
        'After freeing both prisoners, latch both gates open so the remote operator can leave.',
    },
    {
      id: 'evidence',
      tag: 'REGISTER',
      label: 'Detention register',
      x: 24,
      y: 8,
      detail: 'Optional evidence. Rescue the crew first; carrying it occupies both hands.',
    },
    {
      id: 'extract',
      tag: 'VAN',
      label: 'Bring everyone home',
      x: 7,
      y: 27,
      detail:
        'Free both prisoners, use EXIT, then bring all four operatives here. Confiscated equipment and the register are optional.',
    },
  ],
  guards: [
    patrol(
      [
        { x: 24, y: 28 },
        { x: 24, y: 18 },
        { x: 28, y: 18 },
        { x: 28, y: 28 },
      ],
      -Math.PI / 2,
    ),
    patrol(
      [
        { x: 21, y: 9 },
        { x: 24, y: 9 },
        { x: 24, y: 14 },
        { x: 21, y: 14 },
      ],
      0,
    ),
    patrol(
      [
        { x: 41, y: 18 },
        { x: 41, y: 20 },
        { x: 35, y: 20 },
        { x: 35, y: 18 },
      ],
      Math.PI / 2,
    ),
    {
      ...patrol([{ x: 41.5, y: 20.5 }], Math.PI),
      tactic: {
        role: 'breacher',
        posts: [
          { x: 41.5, y: 20.5 },
          { x: 36, y: 18.5 },
        ],
      },
    },
    patrol(
      [
        { x: 10, y: 8 },
        { x: 14, y: 8 },
        { x: 14, y: 13 },
        { x: 10, y: 13 },
      ],
      0,
    ),
    // The cell corridor is a moving crossing, not a permanently safe exit.
    // Both cells provide cover while the warden passes their doors.
    patrol(
      [
        { x: 32, y: 8 },
        { x: 32, y: 28.5 },
        { x: 33, y: 28.5 },
        { x: 33, y: 8 },
      ],
      Math.PI / 2,
    ),
  ],
  spawns: [
    { x: 9, y: 28 },
    { x: 38, y: 10.5 },
    { x: 38, y: 25.5 },
    { x: 10, y: 26 },
  ],
};
