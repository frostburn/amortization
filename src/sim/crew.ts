// Order is part of the save/replay contract: spawns, loadouts and detention
// cells refer to these four slots. Keep each operative's identity together.
export const CREW = [
  { id: 'morrow', name: 'Morrow', role: 'Field lead', flash: false },
  { id: 'vale', name: 'Vale', role: 'Systems', flash: false },
  { id: 'rook', name: 'Rook', role: 'Security', flash: true },
  { id: 'sable', name: 'Sable', role: 'Recon', flash: true },
] as const;

export type CrewId = (typeof CREW)[number]['id'];
