import { distance, living } from './types';
import type { Operative, World } from './types';
import { findPath } from './navigation';
import { notify } from './world';

export const courierGuard = (world: World) =>
  world.guards.find((g) => g.id === world.courier?.guardId);

export function clearedCargo(world: World, agent: Operative) {
  return agent.disguised && world.courier?.clearance === agent.id;
}

export function routeCourier(world: World) {
  const c = world.courier,
    site = world.mission.transfer,
    guard = courierGuard(world);
  if (!c || !site || !guard || !living(guard) || guard.mode !== 'patrol') return;
  const destination =
    c.phase === 'returning' ? site.start : c.diverted ? site.inspection : site.checkpoint;
  // The junction keeps both transfer routes in the marked central lane.
  const via = findPath(world, guard, site.junction);
  guard.path = [...via, ...findPath(world, site.junction, destination)];
}

export function updateCourier(world: World, dt: number) {
  const c = world.courier,
    site = world.mission.transfer,
    guard = courierGuard(world);
  if (!c || !site || !guard) return;
  if (!living(guard) && world.evidence === 'courier') {
    world.evidence = 'available';
    world.evidencePosition = { x: guard.x, y: guard.y };
    c.phase = 'secured';
    notify(world, 'The courier is down. Recover CASE where they fell.', 'warning');
  }
  if (!living(guard) || guard.mode !== 'patrol') return;
  if (c.phase === 'inspection' && distance(guard, site.inspection) > 0.5) {
    c.phase = 'transit';
    routeCourier(world);
  }
  if (c.phase === 'transit' || c.phase === 'returning') {
    const destination =
      c.phase === 'returning' ? site.start : c.diverted ? site.inspection : site.checkpoint;
    if (distance(guard, destination) < 0.35) {
      guard.path = [];
      if (c.phase === 'returning') {
        c.phase = 'ready';
        notify(world, 'Courier returned. CALL can request another transfer.');
      } else if (c.diverted) {
        c.phase = 'inspection';
        guard.angle = Math.PI;
        notify(
          world,
          'Courier waiting at INSPECTION. A concealed, disguised operative can sign for CASE.',
        );
      } else {
        c.phase = 'checkpoint';
        c.wait = 12;
        notify(
          world,
          'Courier at the east checkpoint. DIVERT redirects them; otherwise they return in 12 seconds.',
        );
      }
    } else if (!guard.path.length) guard.path = findPath(world, guard, destination);
  } else if (c.phase === 'checkpoint') {
    c.wait = Math.max(0, c.wait - dt);
    if (c.wait === 0) {
      c.phase = 'returning';
      routeCourier(world);
    }
  }
}
