import './ui/style.css';
import { createWorld, notify } from './sim/world';
import { step, STEP } from './sim/step';
import { available, extractionRallyBlocker, landmark } from './sim/orders';
import { applyCommand } from './sim/commands';
import type { Command } from './sim/commands';
import { distance, isExtraction, living } from './sim/types';
import type { Mission, World } from './sim/types';
import { Scene } from './render/scene';
import type { Hit } from './render/scene';
import { Hud } from './ui/hud';
import type { Action } from './ui/hud';
import { bindControls } from './input/controls';
import { Sound } from './audio/sound';
import { missionRecord, readRecords, recordWin } from './ui/storage';
import { missions, nextMission } from './content/missions';
import { extractionRequirement } from './ui/extraction';

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
  const hud = new Hud(
    action,
    (index, add) => {
      const a = world.agents[index];
      if (!living(a)) return;
      select(
        add
          ? selected.includes(a.id)
            ? selected.filter((id) => id !== a.id)
            : [...selected, a.id]
          : [a.id],
      );
    },
    (targets, focus, panel) => {
      scene.showGuidance(targets, panel);
      if (focus) scene.focusGuidance();
    },
  );
  const scene = new Scene(hud.stage, world);
  await scene.init();
  // Vite removes the entire dev import (including its CSS and recorder) from production builds.
  const playtest = import.meta.env.DEV
    ? new (await import('./dev/playtest')).Playtest({
        world: () => world,
        showWorld(next) {
          world = next;
          selected = world.agents.filter(living).map((a) => a.id);
          accumulator = 0;
          scene.reset(world);
          hud.close();
          hud.reset(world.mission);
          hud.vision(scene.showVision);
          updateHud();
        },
        pause(value) {
          paused = value;
          accumulator = 0;
          updateHud();
        },
        isPaused: () => paused,
        modal: hud.modal,
      })
    : undefined;
  function select(ids: string[]) {
    const alive = ids.filter((id) => world.agents.some((a) => a.id === id && living(a)));
    if (alive.length) selected = [...new Set(alive)];
    hud.clearGuide();
    scene.follow(selected);
    updateHud();
  }
  function startMission(mission: Mission, briefing: boolean) {
    world = createWorld(mission);
    selected = world.agents.map((a) => a.id);
    paused = briefing;
    slow = false;
    saved = false;
    accumulator = 0;
    scene.reset(world);
    hud.close();
    hud.reset(mission);
    playtest?.newAttempt(world, briefing ? 'mission-change' : 'restart');
    hud.vision(scene.showVision);
    if (briefing) hud.showBriefing();
    updateHud();
  }
  function issue(command: Command) {
    if (world.status !== 'playing' || playtest?.isPlayback) return;
    const requirement =
      command.kind === 'interact' && isExtraction(command.target)
        ? extractionRequirement(world)
        : null;
    if (requirement) {
      notify(world, requirement.detail);
      updateHud();
      hud.focusObjectives('extract');
      return;
    }
    playtest?.command(command);
    applyCommand(world, command);
  }
  function order(hit: Hit) {
    if (world.status !== 'playing') return;
    if (hit.kind === 'ground') issue({ kind: 'move', agents: selected, point: hit.point });
    if (hit.kind === 'object') issue({ kind: 'interact', agents: selected, target: hit.id });
    if (hit.kind === 'guard') issue({ kind: 'attack', agents: selected, target: hit.id });
    if (hit.kind === 'agent') {
      const a = world.agents.find((a) => a.id === hit.id)!;
      issue({ kind: 'move', agents: selected, point: { x: a.x, y: a.y } });
    }
  }
  function action(type: Action) {
    if (
      playtest?.isPlayback &&
      (type === 'restart' ||
        type === 'operations' ||
        type === 'next' ||
        type.startsWith('mission:'))
    ) {
      notify(world, 'Return to the live attempt before starting or restarting an operation.');
      updateHud();
      return;
    }
    if (type.startsWith('mission:')) {
      const mission = missions.find((m) => type === `mission:${m.id}`);
      if (mission) startMission(mission, true);
      return;
    }
    if (type.startsWith('heal:')) {
      const medic = world.agents[Number(type.slice(5))];
      if (medic && living(medic)) issue({ kind: 'heal', agents: [medic.id] });
      updateHud();
      return;
    }
    if (type === 'work:mask' || type === 'work:upload') {
      issue({
        kind: 'interact',
        agents: selected,
        target: type === 'work:mask' ? 'mask' : 'upload',
      });
      updateHud();
      return;
    }
    if (type === 'plant:charge-west' || type === 'plant:charge-east') {
      issue({
        kind: 'interact',
        agents: selected,
        target: type === 'plant:charge-west' ? 'charge-west' : 'charge-east',
      });
      updateHud();
      return;
    }
    if (type === 'extract:extract' || type === 'extract:alternate') {
      const blocker = extractionRallyBlocker(world);
      if (blocker) {
        notify(world, blocker);
        updateHud();
        return;
      }
      issue({
        kind: 'interact',
        agents: world.agents.filter(living).map((a) => a.id),
        target: type === 'extract:extract' ? 'extract' : 'alternate',
      });
      updateHud();
      return;
    }
    switch (type) {
      case 'objectives':
        hud.focusObjectives();
        break;
      case 'operations':
        paused = true;
        hud.showOperations(records);
        break;
      case 'next': {
        const mission = nextMission(world.mission.id);
        if (world.status === 'won' && mission) startMission(mission, true);
        break;
      }
      case 'pause':
        if (world.status === 'playing') paused = !paused;
        break;
      case 'sound':
        sound.toggle();
        break;
      case 'begin':
        if (world.status !== 'playing') break;
        hud.close();
        paused = false;
        break;
      case 'briefing':
        paused = true;
        if (world.status === 'playing') hud.showBriefing();
        else hud.showEnd(world, missionRecord(records, world.mission.id), true);
        break;
      case 'restart': {
        startMission(world.mission, false);
        break;
      }
      case 'all':
        selected = world.agents.filter(living).map((a) => a.id);
        break;
      case 'regroup': {
        const lead = world.agents.find((a) => selected.includes(a.id) && living(a));
        if (lead) {
          selected = world.agents.filter(living).map((a) => a.id);
          issue({ kind: 'move', agents: selected, point: { x: lead.x, y: lead.y } });
        }
        break;
      }
      case 'hold':
      case 'weapons':
      case 'heal':
      case 'drop':
        issue({ kind: type, agents: selected });
        break;
      case 'call-transfer':
        issue({ kind: 'interact', agents: selected, target: 'dispatch' });
        break;
      case 'escort-aid':
        issue({ kind: 'escort-aid', agents: world.agents.filter(living).map((p) => p.id) });
        break;
      case 'locate-escort':
        hud.focusObjectives();
        break;
      case 'escort-wait':
        issue({ kind: 'escort-wait' });
        break;
      case 'detonate':
        issue({ kind: 'detonate' });
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
        if (objects[0]?.d < 3)
          issue({ kind: 'interact', agents: selected, target: objects[0].o.id });
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
      case 'follow':
        hud.clearGuide();
        scene.follow(selected, true);
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
    // Keep a surviving crew actionable if the last selected operative falls.
    selected = selected.filter((id) => world.agents.some((a) => a.id === id && living(a)));
    if (!selected.length) selected = world.agents.filter(living).map((a) => a.id);
    hud.update(world, {
      selected,
      paused,
      slow,
      sound: sound.enabled,
      following: scene.following,
      best: missionRecord(records, world.mission.id).best,
      fullCrewBest: missionRecord(records, world.mission.id).fullCrewBest,
    });
  }
  bindControls(scene, hud, {
    world: () => world,
    selection: () => selected,
    select,
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
      wallElapsed = (now - last) / 1000,
      elapsed = Math.min(wallElapsed, 0.15);
    last = now;
    if (!paused && !hud.modal.open) {
      accumulator += elapsed * (playtest?.isPlayback ? playtest.speed : slow ? 0.2 : 1);
      while (accumulator >= STEP) {
        accumulator -= STEP;
        if (playtest?.isPlayback) playtest.advance();
        else if (world.status === 'playing') {
          step(world);
          playtest?.afterStep();
        }
      }
    } else accumulator = 0;
    scene.render(selected, paused ? 1 : accumulator / STEP);
    for (const event of world.sounds.splice(0)) sound.play(event);
    if (world.status !== 'playing' && !playtest?.isPlayback) {
      paused = true;
      if (world.status === 'won' && !saved) {
        records = recordWin(world.mission.id, world.time, world.agents.filter(living).length);
        saved = true;
      }
      hud.showEnd(world, missionRecord(records, world.mission.id));
    }
    playtest?.update(now, wallElapsed, paused || hud.modal.open, slow);
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
