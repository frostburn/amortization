import './ui/style.css';
import { createWorld, notify } from './sim/world';
import { step, STEP } from './sim/step';
import {
  attack,
  available,
  dropEvidence,
  heal,
  hold,
  interact,
  landmark,
  moveAgents,
  toggleWeapons,
} from './sim/orders';
import { distance, living } from './sim/types';
import type { World } from './sim/types';
import { Scene } from './render/scene';
import type { Hit } from './render/scene';
import { Hud } from './ui/hud';
import type { Action } from './ui/hud';
import { bindControls } from './input/controls';
import { Sound } from './audio/sound';
import { readRecords, recordWin } from './ui/storage';

async function boot() {
  let world: World = createWorld(),
    selected = world.agents.map((a) => a.id),
    paused = true,
    slow = false,
    records = readRecords(),
    saved = false;
  let accumulator = 0,
    last = performance.now(),
    lastHud = 0;
  const sound = new Sound();
  const hud = new Hud(action, (index, add) => {
    const a = world.agents[index];
    if (!living(a)) return;
    selected = add
      ? selected.includes(a.id)
        ? selected.filter((id) => id !== a.id)
        : [...selected, a.id]
      : [a.id];
  });
  const scene = new Scene(hud.stage, world);
  await scene.init();
  function order(hit: Hit) {
    if (world.status !== 'playing') return;
    if (hit.kind === 'ground') moveAgents(world, selected, hit.point);
    if (hit.kind === 'object') interact(world, selected, hit.id);
    if (hit.kind === 'guard') attack(world, selected, hit.id);
    if (hit.kind === 'agent') {
      const a = world.agents.find((a) => a.id === hit.id)!;
      moveAgents(world, selected, a);
    }
  }
  function action(type: Action) {
    switch (type) {
      case 'pause':
        if (world.status === 'playing') paused = !paused;
        break;
      case 'sound':
        sound.toggle();
        break;
      case 'begin':
        hud.close();
        paused = false;
        break;
      case 'briefing':
        paused = true;
        if (world.status === 'playing') hud.showBriefing();
        break;
      case 'restart': {
        world = createWorld();
        selected = world.agents.map((a) => a.id);
        paused = false;
        slow = false;
        saved = false;
        accumulator = 0;
        scene.reset(world);
        hud.close();
        hud.reset();
        break;
      }
      case 'all':
        selected = world.agents.filter(living).map((a) => a.id);
        break;
      case 'regroup': {
        const lead = world.agents.find((a) => selected.includes(a.id) && living(a));
        if (lead) {
          selected = world.agents.filter(living).map((a) => a.id);
          moveAgents(world, selected, lead);
        }
        break;
      }
      case 'hold':
        hold(world, selected);
        break;
      case 'weapons':
        toggleWeapons(world, selected);
        break;
      case 'heal':
        heal(world, selected);
        break;
      case 'drop':
        dropEvidence(world, selected);
        break;
      case 'interact': {
        const agents = world.agents.filter((a) => selected.includes(a.id) && living(a));
        const objects = world.mission.landmarks
          .filter((o) => available(world, o.id))
          .map((o) => ({
            o,
            d: Math.min(...agents.map((a) => distance(a, landmark(world, o.id)))),
          }))
          .sort((a, b) => a.d - b.d);
        if (objects[0]?.d < 3) interact(world, selected, objects[0].o.id);
        else
          notify(
            world,
            'Right-click a labelled diamond to approach and interact. On touch screens, tap it.',
          );
        break;
      }
      case 'vision':
        scene.showVision = !scene.showVision;
        hud.vision(scene.showVision);
        break;
      case 'home':
        scene.home();
        break;
      case 'zoom-in':
        scene.zoomBy(1.18);
        break;
      case 'zoom-out':
        scene.zoomBy(1 / 1.18);
        break;
    }
    updateHud();
  }
  function updateHud() {
    hud.update(world, { selected, paused, slow, sound: sound.enabled, best: records.best });
  }
  bindControls(scene, hud, {
    world: () => world,
    selection: () => selected,
    select: (ids) => {
      selected = ids;
      updateHud();
    },
    order,
    action,
    slow: (enabled) => {
      slow = enabled;
    },
  });
  const autoPause = () => {
    if (world.status === 'playing') {
      paused = true;
      slow = false;
      accumulator = 0;
      updateHud();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) autoPause();
  });
  window.addEventListener('blur', autoPause);
  scene.app.ticker.add(() => {
    const now = performance.now(),
      elapsed = Math.min((now - last) / 1000, 0.15);
    last = now;
    if (!paused && !hud.modal.open) {
      accumulator += elapsed * (slow ? 0.2 : 1);
      while (accumulator >= STEP) {
        step(world);
        accumulator -= STEP;
      }
    } else accumulator = 0;
    scene.render(selected, paused ? 1 : accumulator / STEP);
    for (const event of world.sounds.splice(0)) sound.play(event);
    if (world.status !== 'playing') {
      paused = true;
      if (world.status === 'won' && !saved) {
        records = recordWin(world.time);
        saved = true;
      }
      hud.showEnd(world, records.best);
    }
    if (now - lastHud > 90) {
      updateHud();
      lastHud = now;
    }
  });
  updateHud();
  scene.render(selected, 1);
  hud.showBriefing();
}
void boot().catch((error: unknown) => {
  console.error(error);
  const root = document.querySelector('#app')!;
  root.innerHTML =
    '<main class="error"><h1>Could not open the operation.</h1><p>Check that hardware acceleration is enabled and reload the page. If you are hosting this build, serve the complete dist folder over HTTP.</p><button onclick="location.reload()">Reload</button></main>';
});
