import { distance, living, people } from './types';
import type { World } from './types';
import { BODY_RADIUS } from './navigation';

export function updateShutter(world: World) {
  const archive = world.mission.archive;
  if (!archive) return;
  const panel = world.mission.landmarks.find((o) => o.id === 'override')!;
  const operator = world.agents.find(
    (a) =>
      a.id === world.overrideBy &&
      living(a) &&
      !a.carrying &&
      a.order.kind === 'interact' &&
      a.order.target === 'override' &&
      distance(a, panel) < 1.15,
  );
  if (!operator) world.overrideBy = null;
  const d = archive.door;
  // A safety edge holds the shutter while someone is crossing. Never close a
  // collision solid around a body; the next step closes it once the doorway clears.
  const crossing = people(world).some(
    (p) =>
      living(p) &&
      p.x >= d.x - BODY_RADIUS &&
      p.x <= d.x + d.w + BODY_RADIUS &&
      p.y >= d.y - BODY_RADIUS &&
      p.y <= d.y + d.h + BODY_RADIUS,
  );
  world.shutterOpen = world.shutterBreached || !!operator || (world.shutterOpen && crossing);
}
