import type { SoundId } from './palette';

// Authored faders after synthesis, before spatial/context gain and compression.
// Compare weapons at their firing cadence and warnings over their whole lock;
// matching sample peaks would make the automatic and sustained tones dominate.
const decibels: Record<SoundId, number> = {
  pistol: 0,
  carbine: -1.5,
  shotgun: -1.5,
  automatic: 0,
  coil: 0.5,
  support: -2,
  step: 0,
  body: 0,
  metal: 0,
  fall: -2,
  wreck: -3.5,
  reload: 9,
  ready: 10,
  relay: -9,
  breaker: -11,
  door: -9,
  pickup: 1,
  cloth: 0,
  heal: -1.5,
  terminal: 2,
  radio: 2.5,
  alarm: -5,
  blast: -3,
  flash: -6,
  confirm: 0,
  complete: -2,
  failed: -6.5,
  charge: -7,
  tracking: 8,
  objective: 8,
};

const gains = Object.fromEntries(
  Object.entries(decibels).map(([id, db]) => [id, 10 ** (db / 20)]),
) as Record<SoundId, number>;

export const mixGain = (id: SoundId) => gains[id];
