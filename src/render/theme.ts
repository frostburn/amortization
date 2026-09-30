import type { Mission } from '../sim/types';

export type VisualTheme = 'night' | 'day' | 'sunset';
/** Palette is presentation only. Human sight ranges still use mission.daylight. */
export const visualTheme = (m: Mission): VisualTheme => m.palette ?? (m.daylight ? 'day' : 'night');
export const skyColor = { night: 0x111c29, day: 0x9baeb5, sunset: 0x6b3947 };
