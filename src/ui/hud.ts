import { distance, isExtraction, living, EXTRACTION_RADIUS } from '../sim/types';
import type { Mission, World } from '../sim/types';
import { suspicionRate } from '../sim/awareness';
import { clearedCargo, courierGuard } from '../sim/courier';
import { interactionDuration, landmark } from '../sim/orders';
import { missions, nextMission } from '../content/missions';
import { missionRecord } from './storage';
import type { Records } from './storage';

export type Action =
  | 'operations'
  | 'next'
  | `mission:${Mission['id']}`
  | 'pause'
  | 'sound'
  | 'briefing'
  | 'begin'
  | 'restart'
  | 'all'
  | 'regroup'
  | 'hold'
  | 'weapons'
  | 'interact'
  | 'heal'
  | 'escort-wait'
  | 'escort-aid'
  | 'drop'
  | 'vision'
  | 'home'
  | 'zoom-in'
  | 'zoom-out';
export interface HudState {
  selected: string[];
  paused: boolean;
  slow: boolean;
  sound: boolean;
  best: number | null;
}
const icons: Record<string, string> = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  regroup:
    '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M2 21v-4a6 6 0 0 1 12 0v4m2-7a4 4 0 0 1 6 4v3"/>',
  hold: '<path d="M5 4h14v7c0 5-7 10-7 10S5 16 5 11Z"/>',
  weapons: '<path d="M3 7h17v5h-7l-2 7H5l3-7H3Zm11 5v3h3v-3"/>',
  interact:
    '<path d="M8 13V6a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v8c0 4-3 7-7 7-3 0-5-2-7-4l-4-5a2 2 0 0 1 3-2l3 2Z"/>',
};
const icon = (id: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[id] || icons.interact}</svg>`;
const time = (seconds: number) =>
  `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
export class Hud {
  readonly stage: HTMLElement;
  readonly modal: HTMLDialogElement;
  private app: HTMLElement;
  private lastMessage = '';
  private endShown = false;
  private mission: Mission = missions[0];
  private fields = new Map<string, HTMLElement>();
  constructor(onAction: (action: Action) => void, onSelect: (index: number, add: boolean) => void) {
    this.app = document.querySelector('#app')!;
    this.app.innerHTML = `
      <header class="topbar"><h1>AMORTIZATION</h1><span class="operation" id="operation-title"></span><div class="top-actions"><button data-action="operations">Operations</button><button data-action="briefing" title="Mission briefing and controls">Briefing</button><button data-action="pause" id="pause-button">${icon('play')}<span id="pause-label">Resume</span></button><button data-action="sound" id="sound-button">Sound off</button></div></header>
      <main class="game-layout">
        <section class="map-column" aria-label="Operation map and crew">
          <div class="stage" id="stage"><div class="map-top"><span id="time-mode">PLANNING / ORDERS ACTIVE</span><span id="clock">00:00</span></div><div class="map-controls"><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="home">Fit map</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div><div class="map-caption"><span id="map-location"></span><small>Municipal assets division</small></div><div class="selection-box" id="selection-box"></div></div>
          <div class="dispatch"><span>COMMS</span><p id="message" role="status">Preparing the operation…</p></div>
          <div class="squad" aria-label="Squad selection">${['Morrow', 'Vale', 'Rook', 'Sable'].map((name, i) => `<button class="agent-card" data-agent="${i}" aria-label="Select ${name}" aria-pressed="true"><span class="portrait portrait-${i}" aria-hidden="true"></span><span class="agent-copy"><span class="agent-heading"><b>${i + 1}</b> ${name}</span><span class="agent-condition" id="condition-${i}">Ready</span><span class="health-track"><span id="health-${i}"></span></span></span></button>`).join('')}</div>
          <footer class="controls-hint"><span><kbd>1–4</kbd> operative <kbd>Q</kbd> squad <kbd>RMB</kbd> order <kbd>Space</kbd> pause <kbd>Tab</kbd> slow</span><button data-action="restart" title="Restart operation (Shift+R)">Restart</button></footer>
        </section>
        <aside class="sidebar">
          <section class="mission-section"><p class="section-label">MISSION</p><h2 id="mission-title"></h2><p class="description" id="mission-description"></p><div class="objectives"><p id="objective-primary">○ Locate Voss</p><p id="objective-extract">○ Extract at the van</p><p class="optional" id="objective-evidence">◇ Diagnostic unit <span>optional</span></p></div></section>
          <section class="alert-section"><p class="section-label">ALERT STATUS</p><p class="alert" id="alert">● Site quiet</p><p class="fine" id="radio-status">Radio network online</p><p class="fine" id="archive-status" hidden></p><p class="fine" id="courier-status" hidden></p></section>
          <section class="selection-section"><p class="section-label">SELECTED OPERATIVE<span id="selected-count">4 / 4</span></p><div class="selected-info"><span id="selected-portrait" class="portrait portrait-0" aria-hidden="true"></span><div><h3 id="selected-name">Full crew</h3><p id="selected-role">Four operatives</p><p id="selected-cover">Weapons concealed</p></div></div><p class="assessment" id="assessment">Move together. Split when it matters.</p><div id="work-status" hidden><p class="fine" id="work-label"></p><progress id="work-progress" value="0" max="1" aria-label="Interaction progress"></progress></div></section>
          <section id="escort-controls" hidden><p class="section-label">ESCORT</p><p id="escort-status" class="fine"></p><div class="utility"><button data-action="escort-wait" id="escort-wait-button"></button><button data-action="escort-aid" id="escort-aid-button" hidden></button></div></section><section class="orders-section"><p class="section-label">ORDERS</p><div class="orders">${(['regroup', 'hold', 'weapons', 'interact'] as const).map((id, i) => `<button data-action="${id}" title="${['Regroup at the lead selected operative (G)', 'Hold position (S)', 'Draw or conceal weapons (F)', 'Interact with nearest object (E)'][i]}">${icon(id)}<span id="${id}-label">${['Regroup', 'Hold', 'Draw weapons', 'Interact'][i]}</span><kbd>${['G', 'S', 'F', 'E'][i]}</kbd></button>`).join('')}</div><div class="utility"><button data-action="all">Select all <kbd>Q</kbd></button><button data-action="heal">Field dressing <kbd>H</kbd></button><button data-action="drop" id="drop-button" hidden>Set unit down <kbd>X</kbd></button></div></section>
          <section class="intel-section"><p class="section-label">FIELD NOTES</p><p id="intel">A maintenance kit was left outside the west entrance. One person can enter under cover.</p><button data-action="vision" id="vision-button" aria-pressed="true">Sight cones: on</button><p class="best" id="best"></p></section>
        </aside>
      </main>
      <dialog id="mission-dialog" aria-labelledby="dialog-title"></dialog>`;
    this.stage = this.app.querySelector('#stage')!;
    this.modal = this.app.querySelector('#mission-dialog')!;
    this.reset(this.mission);
    this.app.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-agent]');
      if (!el) return;
      if (el.dataset.agent !== undefined)
        onSelect(Number(el.dataset.agent), (e as MouseEvent).shiftKey);
      else onAction(el.dataset.action as Action);
    });
    this.modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      onAction('begin');
    });
  }
  private field(id: string) {
    let e = this.fields.get(id);
    if (!e) {
      e = this.app.querySelector<HTMLElement>(`#${id}`)!;
      this.fields.set(id, e);
    }
    return e;
  }
  private set(id: string, value: string) {
    const e = this.field(id);
    if (e.textContent !== value) e.textContent = value;
  }
  private briefing() {
    const m = this.mission;
    return `<div class="dialog-number">${m.number} / ${m.location}</div><h2 id="dialog-title">${m.title}</h2><p class="dialog-lead">${m.briefing.lead}</p><p class="dialog-body">${m.briefing.body}</p><div class="briefing-routes">${m.briefing.routes.map((route) => `<div><b>${route.title}</b><p>${route.body}</p></div>`).join('')}</div><p class="briefing-controls"><kbd>1–4</kbd> select one · <kbd>Q</kbd> select all<br><kbd>RMB</kbd> move / interact / attack · <kbd>Space</kbd> pause<br><kbd>F</kbd> draw / conceal · <kbd>S</kbd> hold / release shunt<br>Drag to select · Wheel to zoom · Arrows / middle-drag to pan</p><button class="primary" data-action="begin">Begin operation <span>→</span></button><button class="dialog-secondary" data-action="operations">Choose operation</button><p class="dialog-foot">Orders remain active while paused. Selection changes preserve orders.</p>`;
  }
  showBriefing() {
    this.modal.innerHTML = this.briefing();
    if (!this.modal.open) this.modal.showModal();
  }
  showOperations(records: Records) {
    this.modal.innerHTML = `<div class="dialog-number">CONTRACT DESK</div><h2 id="dialog-title">Operations</h2><p class="dialog-body">Choose a contract. Starting an operation resets the current attempt. All contracts are available for replay.</p><div class="operation-list">${missions
      .map((m) => {
        const record = missionRecord(records, m.id);
        return `<button data-action="mission:${m.id}" class="operation-card"><span class="section-label">${m.number} / ${m.location}</span><strong>${m.title}</strong><span>${m.description}</span><small>${record.best === null ? 'No completed extraction' : `Best ${time(record.best)} · ${record.completions} completed`}</small></button>`;
      })
      .join(
        '',
      )}</div><button class="dialog-secondary" data-action="briefing">Back to briefing</button>`;
    if (!this.modal.open) this.modal.showModal();
  }
  close() {
    this.modal.close();
  }
  reset(mission: Mission = this.mission) {
    this.mission = mission;
    this.endShown = false;
    this.lastMessage = '';
    this.modal.innerHTML = this.briefing();
    this.set('operation-title', `${mission.number} / ${mission.title}`);
    this.set('map-location', mission.location);
    this.set('mission-title', mission.title);
    this.set('mission-description', mission.description);
    this.set('intel', mission.intro);
    this.field('objective-evidence').classList.toggle('optional', mission.objective === 'escort');
    this.field('archive-status').hidden = !mission.archive;
    this.field('courier-status').hidden = !mission.transfer;
    this.field('escort-controls').hidden = true;
  }
  showEnd(world: World, best: number | null, force = false) {
    if (this.endShown && !force) return;
    this.endShown = true;
    const won = world.status === 'won',
      alive = world.agents.filter(living).length;
    this.modal.innerHTML = `<div class="dialog-number">OPERATION ${won ? 'COMPLETE' : 'LOST'}</div><h2 id="dialog-title">${won ? 'Account settled.' : 'The balance is due.'}</h2><p class="dialog-lead">${won ? (world.mission.objective === 'escort' ? `${world.escort!.name} is free.` : world.mission.objective === 'case' ? 'The account keys are ours.' : 'The original is in our hands.') : world.escort && !living(world.escort) ? `${world.escort.name} was killed.` : 'The crew is down.'}</p><p class="dialog-body">${won ? 'The van crosses the district line before anyone agrees who should pay for this.' : 'The site still belongs to the company. You can try another approach.'}</p><dl class="results"><div><dt>Elapsed</dt><dd>${time(world.time)}</dd></div><div><dt>Crew extracted</dt><dd>${won ? alive : 0} / 4</dd></div><div><dt>Evidence</dt><dd>${world.evidence === 'extracted' ? 'Secured' : 'Left behind'}</dd></div><div><dt>Site alarm</dt><dd>${world.alarm ? 'Triggered' : 'Quiet'}</dd></div>${won && world.mission.landmarks.some((o) => o.id === 'alternate') && world.extractedAt ? `<div><dt>Extraction</dt><dd>${landmark(world, world.extractedAt).tag}</dd></div>` : ''}</dl>${best !== null ? `<p class="fine">Best extraction: ${time(best)}</p>` : ''}<button class="primary" data-action="${won && nextMission(world.mission.id) ? 'next' : 'restart'}">${won && nextMission(world.mission.id) ? 'Next operation' : 'Run it again'} <span>→</span></button><button class="dialog-secondary" data-action="operations">Operations</button>`;
    if (!this.modal.open) this.modal.showModal();
  }
  update(world: World, state: HudState) {
    const selected = world.agents.filter((a) => state.selected.includes(a.id) && living(a));
    const all = selected.length > 1,
      a = selected[0];
    this.set('clock', time(world.time));
    this.set(
      'time-mode',
      state.paused ? 'PLANNING / ORDERS ACTIVE' : state.slow ? 'SLOW TIME / 20%' : 'OPERATION LIVE',
    );
    this.field('time-mode').classList.toggle('live', !state.paused);
    this.set('pause-label', state.paused ? 'Resume' : 'Pause');
    this.set('sound-button', state.sound ? 'Sound on' : 'Sound off');
    if (this.lastMessage !== world.message) {
      this.set('message', world.message);
      this.lastMessage = world.message;
    }
    this.set(
      'objective-primary',
      world.courier
        ? world.evidence !== 'courier'
          ? '✓ Courier intercepted'
          : world.courier.diverted
            ? '✓ Route set to inspection'
            : '○ Divert or ambush the courier'
        : world.mission.archive
          ? world.shutterBreached
            ? '✓ Archive shutter forced'
            : world.shutterOpen
              ? '✓ Archive shutter open'
              : '○ Open archive shutter'
          : world.escortLocked
            ? '○ Unlock the transport'
            : world.escort?.recruited
              ? `✓ ${world.escort.name} ${world.escort.waiting ? 'waiting for escort' : 'following escort'}`
              : `○ Locate ${world.escort?.name || 'the witness'}`,
    );
    this.set(
      'objective-extract',
      world.status === 'won'
        ? `✓ Extracted${world.extractedAt ? ` at ${landmark(world, world.extractedAt).tag}` : ''}`
        : world.mission.landmarks.some((o) => o.id === 'alternate')
          ? '○ Extract at STREET or SERVICE'
          : '○ Extract at the van',
    );
    this.field('objective-primary').classList.toggle(
      'complete',
      world.courier
        ? world.courier.diverted || world.evidence !== 'courier'
        : world.mission.archive
          ? world.shutterOpen
          : !!world.escort?.recruited,
    );
    this.set(
      'objective-evidence',
      world.evidence === 'courier'
        ? '○ Access case · with courier'
        : world.evidence === 'available'
          ? `${world.mission.objective === 'escort' ? '◇' : '○'} ${world.mission.evidenceName}${world.mission.objective === 'escort' ? ' · optional' : ' · required'}`
          : world.evidence === 'carried'
            ? `✓ ${world.mission.evidenceName} carried`
            : '✓ Evidence secured',
    );
    const local = world.guards.some((g) => living(g) && g.mode === 'combat');
    this.set(
      'alert',
      world.alarm
        ? '● Site alarm'
        : local
          ? '● Local contact'
          : world.guards.some((g) => living(g) && g.mode === 'challenge')
            ? '● Under scrutiny'
            : '● Site quiet',
    );
    this.field('alert').classList.toggle('danger', world.alarm || local);
    this.set(
      'radio-status',
      world.relayOff
        ? 'Radio relay disabled'
        : world.alarm
          ? `${world.waves} / 2 response teams arrived`
          : 'Radio network online',
    );
    this.set('selected-count', `${selected.length} / 4`);
    this.set('selected-name', all ? 'Crew selected' : a ? a.name : 'No selection');
    this.set(
      'selected-role',
      all ? `${selected.length} operatives` : a ? a.role : 'Choose a portrait',
    );
    this.field('selected-portrait').className = `portrait portrait-${a?.index || 0}`;
    this.set(
      'selected-cover',
      a
        ? all
          ? `${selected.filter((a) => a.weapon).length} weapons drawn`
          : a.disguised
            ? 'Maintenance uniform'
            : 'Civilian cover'
        : '',
    );
    this.set(
      'assessment',
      !a
        ? 'Select an operative to issue orders.'
        : all
          ? 'Map clicks keep this group selected. Use a portrait or 1–4 to select one.'
          : world.overrideBy === a.id
            ? 'Holding the shutter open. Select a teammate; moving or Hold releases the shunt.'
            : a.exposed
              ? 'Identity compromised. Break sight and prepare an exit.'
              : a.carrying
                ? clearedCargo(world, a)
                  ? 'Signed cargo clearance. Keep the uniform; dropping CASE voids clearance. Both hands occupied.'
                  : world.mission.objective !== 'escort'
                    ? 'This cargo attracts suspicion even in uniform. Both hands occupied; X sets it down.'
                    : 'Both hands occupied. Set the cargo down to fire.'
                : a.weapon
                  ? 'Visible weapon. Guards will challenge you.'
                  : suspicionRate(world, a) > 0
                    ? 'Restricted area. Stay out of sight.'
                    : a.disguised
                      ? 'Maintenance access. Keep your weapon concealed.'
                      : 'Civilian access. The compound is restricted.',
    );
    this.set(
      'weapons-label',
      selected.some((a) => !a.weapon && !a.carrying) ? 'Draw weapons' : 'Conceal weapons',
    );
    this.field('drop-button').hidden = !selected.some((a) => a.carrying);
    this.set('drop-button', `Set ${landmark(world, 'evidence').tag.toLowerCase()} down · X`);
    const worker = selected.find((p) => p.order.kind === 'interact' && p.interaction > 0);
    const work = worker?.order.kind === 'interact' ? worker.order.target : null;
    this.field('work-status').hidden = !worker;
    if (worker && work) {
      const duration = interactionDuration(world, worker, work);
      this.set(
        'work-label',
        world.overrideBy === worker.id
          ? `${worker.name}: holding SHUNT · S releases`
          : `${worker.name}: ${landmark(world, work).tag} · ${Math.min(worker.interaction, duration).toFixed(1)} / ${duration}s`,
      );
      (this.field('work-progress') as HTMLProgressElement).value = Math.min(
        1,
        worker.interaction / duration,
      );
    }
    if (world.mission.archive) {
      const operator = world.agents.find((p) => p.id === world.overrideBy);
      this.set(
        'archive-status',
        world.shutterBreached
          ? 'Shutter: lock cut'
          : operator
            ? `SHUNT held by ${operator.name}`
            : world.shutterOpen
              ? 'Shutter: doorway occupied'
              : 'Shutter: locked',
      );
      this.set(
        'intel',
        world.evidence === 'carried'
          ? 'The ledger is conspicuous. Clear a path to the east gate, release the shunt operator, and bring everyone to VAN.'
          : 'One operative holds SHUNT; another enters the archive. CUT is the noisy alternative. Prepare the east gate before lifting the ledger.',
      );
    }
    if (world.courier) {
      const c = world.courier;
      const status = {
        ready: `Courier: awaiting CALL · ${c.diverted ? 'inspection route' : 'east route'}`,
        transit: `Courier: moving to ${c.diverted ? 'inspection' : 'east checkpoint'}`,
        checkpoint: `Courier: checkpoint · returns in ${Math.ceil(c.wait)}s`,
        returning: 'Courier: returning · CALL available on arrival',
        inspection: 'Courier: awaiting signature at INSPECTION',
        secured:
          world.evidence === 'available'
            ? 'Courier: CASE on the ground'
            : 'Courier: CASE recovered',
      };
      this.set(
        'courier-status',
        world.evidence === 'courier' && courierGuard(world)?.mode === 'combat'
          ? 'Courier: in contact · transfer interrupted'
          : status[c.phase],
      );
      this.set(
        'intel',
        world.evidence === 'carried'
          ? 'Bring CASE and every survivor to the west-street VAN. Signed clearance belongs to its disguised carrier and is lost if the case is set down.'
          : world.evidence === 'available'
            ? 'Recover CASE from its amber marker. It needs both hands and is conspicuous without signed clearance.'
            : 'DIVERT changes the route. CALL starts the transfer. At INSPECTION, right-click CASE with a concealed, disguised operative to sign. Right-click the courier’s body to attack.',
      );
    }
    for (const p of world.agents) {
      const card = this.app.querySelector<HTMLElement>(`[data-agent="${p.index}"]`)!;
      card.setAttribute('aria-pressed', String(state.selected.includes(p.id)));
      card.classList.toggle('down', !living(p));
      this.field(`health-${p.index}`).style.width = `${p.hp}%`;
      this.set(
        `condition-${p.index}`,
        !living(p)
          ? 'Down'
          : world.overrideBy === p.id
            ? 'Holding shunt'
            : p.carrying
              ? `Carrying ${landmark(world, 'evidence').tag.toLowerCase()}`
              : p.exposed
                ? 'Compromised'
                : p.disguised
                  ? 'Maintenance'
                  : p.weapon
                    ? 'Weapon drawn'
                    : p.path.length
                      ? 'Moving'
                      : 'Concealed',
      );
    }
    const escort = world.escort;
    this.field('escort-controls').hidden = !escort?.recruited;
    if (escort?.recruited) {
      this.set(
        'escort-status',
        `${escort.name} · ${Math.ceil(escort.hp)} / ${escort.maxHp} health · ${escort.waiting ? 'waiting' : 'following'}`,
      );
      this.field('escort-status').classList.toggle('danger', escort.hp < 30);
      this.set(
        'escort-wait-button',
        `${escort.waiting ? 'Ask' : 'Tell'} ${escort.name} to ${escort.waiting ? 'follow' : 'wait'}`,
      );
      this.set('escort-aid-button', `Treat ${escort.name} · 1 dressing`);
      this.field('escort-aid-button').hidden =
        !world.mission.escort?.vulnerable || escort.hp >= escort.maxHp;
      (this.field('escort-wait-button') as HTMLButtonElement).disabled = !living(escort);
      (this.field('escort-aid-button') as HTMLButtonElement).disabled = !living(escort);
      const exits = world.mission.landmarks
        .filter((o) => isExtraction(o.id))
        .map((exit) => {
          const near = world.agents.filter(
            (p) => living(p) && distance(p, exit) <= EXTRACTION_RADIUS,
          ).length;
          return `${exit.tag}: ${near} crew${distance(escort, exit) <= EXTRACTION_RADIUS ? ` + ${escort.name}` : ''}`;
        })
        .join(' · ');
      this.set(
        'intel',
        `${escort.name} ${escort.waiting ? 'waits in place' : `follows ${world.agents.find((a) => a.id === escort.leader)?.name || 'the crew'}`}. ${exits}. Bring everyone to the same ring, then right-click its marker.`,
      );
    }
    this.set('best', state.best === null ? '' : `Best extraction ${time(state.best)}`);
  }
  vision(enabled: boolean) {
    this.set('vision-button', `Sight cones: ${enabled ? 'on' : 'off'}`);
    this.field('vision-button').setAttribute('aria-pressed', String(enabled));
  }
  selectionBox(start: { x: number; y: number } | null, end?: { x: number; y: number }) {
    const e = this.field('selection-box');
    e.style.display = start && end ? 'block' : 'none';
    if (start && end) {
      e.style.left = `${Math.min(start.x, end.x)}px`;
      e.style.top = `${Math.min(start.y, end.y)}px`;
      e.style.width = `${Math.abs(end.x - start.x)}px`;
      e.style.height = `${Math.abs(end.y - start.y)}px`;
    }
  }
}
