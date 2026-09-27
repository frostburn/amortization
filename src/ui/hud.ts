import { distance, isCharge, isExtraction, living, EXTRACTION_RADIUS } from '../sim/types';
import type { Mission, Rect, World } from '../sim/types';
import { RESPONSE_TIMES, suspicionRate } from '../sim/awareness';
import { WEAPON_RANGE } from '../sim/combat';
import { lineClear } from '../sim/navigation';
import { clearedCargo } from '../sim/courier';
import { published } from '../sim/broadcast';
import {
  extractionRallyBlocker,
  extractionStatus,
  escortMedic,
  interactionDuration,
  landmark,
} from '../sim/orders';
import { missions, nextMission } from '../content/missions';
import { missionRecord } from './storage';
import type { Records, MissionRecord } from './storage';
import { missionGoals, transferFeedback } from './objectives';
import type { Goal, GoalId, GuideTarget } from './objectives';
import { extractionRequirement } from './extraction';
import { demolished, detonationStatus } from '../sim/demolition';

export type Action =
  | 'objectives'
  | `extract:${'extract' | 'alternate'}`
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
  | `heal:${number}`
  | 'locate-escort'
  | 'escort-wait'
  | 'escort-aid'
  | 'call-transfer'
  | 'work:mask'
  | 'work:upload'
  | 'plant:charge-west'
  | 'plant:charge-east'
  | 'detonate'
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
  fullCrewBest?: number | null;
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
const recordTimes = (best: number | null, fullCrewBest: number | null) =>
  `Full crew: ${fullCrewBest === null ? '—' : time(fullCrewBest)} · Any crew: ${best === null ? '—' : time(best)}`;
export class Hud {
  readonly stage: HTMLElement;
  readonly modal: HTMLDialogElement;
  private app: HTMLElement;
  private lastMessage = '';
  private endShown = false;
  private mission: Mission = missions[0];
  private fields = new Map<string, HTMLElement>();
  private goals: Goal[] = [];
  private hoveredGoal: GoalId | null = null;
  private pinnedGoal: GoalId | null = null;
  private guideTarget: GuideTarget | null = null;
  private guideKey = '';
  private escortHp: number | null = null;
  private escortHitUntil = 0;
  constructor(
    onAction: (action: Action) => void,
    onSelect: (index: number, add: boolean) => void,
    private onGuide: (targets: GuideTarget[], focus: boolean, panel: Rect) => void,
  ) {
    this.app = document.querySelector('#app')!;
    const escortControls = `<section id="escort-controls" class="objective-actions escort-panel" aria-label="Witness" hidden><button data-action="locate-escort" id="escort-focus" title="Locate the witness without changing squad orders"><strong id="escort-alert" role="status"></strong><span id="escort-status"></span></button><div class="escort-actions"><button data-action="escort-wait" id="escort-wait-button"></button><button data-action="escort-aid" id="escort-aid-button" hidden></button></div><p id="escort-aid-hint" hidden></p></section>`;
    const extractionControls = `<section id="extraction-controls" class="objective-actions extraction-controls" aria-label="Extraction" hidden>${(['extract', 'alternate'] as const).map((id) => `<div id="exit-${id}" class="exit-row"><button data-action="extract:${id}" id="exit-button-${id}" aria-describedby="exit-status-${id}"></button><p id="exit-status-${id}"></p></div>`).join('')}</section>`;
    const courierControls = `<section id="courier-controls" class="objective-actions" aria-label="Courier transfer" hidden><p id="courier-status" role="status"></p><button data-action="call-transfer" id="courier-call-button" hidden>Send selected to CALL</button></section>`;
    const demolitionControls = `<section id="demolition-controls" class="objective-actions" aria-label="Demolition" hidden><div id="plant-actions" class="broadcast-actions">${(['charge-west', 'charge-east'] as const).map((id) => `<div><button data-action="plant:${id}" id="${id}-button" aria-describedby="${id}-status"></button><p id="${id}-status"></p></div>`).join('')}</div><button data-action="detonate" id="detonate-button" aria-describedby="detonation-status">Detonate both cores</button><p id="detonation-status" role="status"></p></section>`;
    const broadcastControls = `<section id="broadcast-controls" class="objective-actions" aria-label="Audit transmission" hidden><p id="broadcast-progress-label"></p><progress id="broadcast-progress" value="0" max="1" aria-label="Audit upload progress"></progress><p id="broadcast-status" role="status"></p><div id="broadcast-actions" class="broadcast-actions"><button data-action="work:mask" id="mask-button" title="Send a selected operative with free hands to hold LOOP. Moving or Hold releases it.">Hold LOOP</button><button data-action="work:upload" id="upload-button" title="Send a selected operative with free hands to UPLINK. Moving or Hold pauses the upload; progress is saved.">Work UPLINK</button></div></section>`;
    this.app.innerHTML = `
      <header class="topbar"><h1>AMORTIZATION</h1><span class="operation" id="operation-title"></span><div class="top-actions"><button data-action="operations">Operations</button><button data-action="briefing" title="Mission briefing and controls">Briefing</button><button data-action="pause" id="pause-button">${icon('play')}<span id="pause-label">Resume</span></button><button data-action="sound" id="sound-button">Sound off</button></div></header>
      <main class="game-layout">
        <aside class="sidebar crew-sidebar" aria-label="Crew and orders">
          <section class="crew-section"><div class="crew-heading"><p class="section-label">CREW</p><button data-action="all">Select all <kbd>Q</kbd></button></div>
          <div class="squad" aria-label="Squad selection">${['Morrow', 'Vale', 'Rook', 'Sable'].map((name, i) => `<div class="crew-slot"><button class="agent-card" data-agent="${i}" aria-label="Select ${name}" aria-pressed="true"><span class="portrait portrait-${i}" aria-hidden="true"></span><span class="agent-copy"><span class="agent-heading"><b>${i + 1}</b> ${name}</span><span class="agent-condition" id="condition-${i}">Ready</span><span class="health-track"><span id="health-${i}"></span></span><span class="health-label" id="health-label-${i}"></span></span></button><button class="crew-aid" data-action="heal:${i}" id="aid-${i}" hidden></button></div>`).join('')}</div>
          </section>
          <section class="selection-section"><p class="section-label">SELECTED<span id="selected-count">4 / 4</span></p><div class="selected-info"><div><h3 id="selected-name">Full crew</h3><p id="selected-cover">Weapons concealed</p></div></div><p class="assessment" id="assessment">Move together. Split when it matters.</p><div id="work-status" hidden><p class="fine" id="work-label"></p><progress id="work-progress" value="0" max="1" aria-label="Interaction progress"></progress></div></section>
          <section class="orders-section"><p class="section-label">ORDERS</p><div class="orders">${(['regroup', 'hold', 'weapons', 'interact'] as const).map((id, i) => `<button data-action="${id}" title="${['Regroup at the lead selected operative (G)', 'Hold position (S)', 'Draw or conceal weapons (F)', 'Interact with nearest object (E)'][i]}">${icon(id)}<span id="${id}-label">${['Regroup', 'Hold', 'Draw weapons', 'Interact'][i]}</span><kbd>${['G', 'S', 'F', 'E'][i]}</kbd></button>`).join('')}</div><div class="utility"><button data-action="heal" id="heal-button"><span id="heal-label">Field dressing</span> <kbd>H</kbd></button><button data-action="drop" id="drop-button" disabled>Set unit down <kbd>X</kbd></button></div></section>
        </aside>
        <section class="map-column" aria-label="Operation map">
          <div class="stage" id="stage"><div class="map-top"><span id="time-mode">PLANNING / ORDERS ACTIVE</span><span id="clock">00:00</span></div><div class="map-controls"><button data-action="vision" id="vision-button" aria-pressed="true">Sight cones: on</button><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="home">Fit map</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div><div class="map-caption"><span id="map-location"></span><small>Municipal assets division</small></div><div class="selection-box" id="selection-box"></div><div id="objective-guide" class="objective-guide" role="region" aria-label="Objective guidance" hidden><div class="guide-heading"><span>MISSION GUIDE</span><button data-dismiss-guide aria-label="Close mission guide">×</button></div><h3 id="guide-title"></h3><p id="guide-detail"></p><div id="guide-locations" aria-label="Locate mission items"></div><p class="guide-instruction">Right-click a map diamond to act; on touch, tap it.</p></div></div>
          <footer class="controls-hint"><span><kbd>1–4</kbd> operative <kbd>Q</kbd> squad <kbd>RMB</kbd> order <kbd>Space</kbd> pause <kbd>Tab</kbd> slow</span><button data-action="restart" title="Restart operation (Shift+R)">Restart</button></footer>
        </section>
        <aside class="sidebar mission-sidebar" aria-label="Mission and status">
          <section class="mission-section"><h2 id="mission-title"></h2><div class="objectives">${(['primary', 'evidence', 'extract'] as const).map((id) => `<div class="objective-group" id="objective-group-${id}"><button id="objective-${id}" data-goal="${id}" aria-controls="objective-guide" aria-describedby="objective-help" title="Locate relevant mission items"></button>${id === 'primary' ? escortControls + courierControls + broadcastControls + demolitionControls : id === 'extract' ? extractionControls : ''}</div>`).join('')}</div><p id="objective-help">Hover or tap goals to locate · <kbd>?</kbd> help</p></section>
          <section class="alert-section" aria-label="Alert status"><p class="alert" id="alert">● Site quiet</p><p class="fine" id="radio-status">Radio network online</p><p class="fine" id="archive-status" hidden></p></section>
          <section class="dispatch" aria-label="Comms"><span>COMMS</span><p id="message" role="status">Preparing the operation…</p></section>
          <details class="intel-section"><summary>Field notes &amp; records</summary><div class="intel-content"><p class="description" id="mission-description"></p><p id="intel"></p><p class="best" id="best"></p></div></details>
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
    for (const button of this.app.querySelectorAll<HTMLElement>('[data-goal]')) {
      const id = button.dataset.goal as GoalId;
      button.addEventListener('pointerenter', (e) => {
        if (e.pointerType !== 'mouse') return;
        this.hoveredGoal = id;
        this.refreshGuide();
      });
      button.addEventListener('pointerleave', () => {
        if (!button.matches(':focus-visible')) this.hoveredGoal = null;
        this.refreshGuide();
      });
      button.addEventListener('focus', () => {
        if (button.matches(':focus-visible')) {
          this.hoveredGoal = id;
          this.refreshGuide();
        }
      });
      button.addEventListener('blur', () => {
        this.hoveredGoal = null;
        this.refreshGuide();
      });
      button.addEventListener('click', (e) => this.locateGoal(id, e.detail === 0));
    }
    this.field('objective-guide').addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>('button');
      if (button?.hasAttribute('data-dismiss-guide')) this.clearGuide(true);
      else if (button?.dataset.locateTarget) {
        this.pinnedGoal = this.hoveredGoal || this.pinnedGoal;
        this.hoveredGoal = null;
        this.guideTarget = button.dataset.locateTarget as GuideTarget;
        this.refreshGuide(true);
      }
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
  focusObjectives(id: GoalId = 'primary') {
    this.field(`objective-${id}`).focus({ preventScroll: true });
    this.locateGoal(id);
  }
  clearGuide(focusMap = false) {
    this.hoveredGoal = this.pinnedGoal = null;
    this.guideTarget = null;
    this.refreshGuide();
    if (focusMap) this.stage.querySelector('canvas')?.focus({ preventScroll: true });
  }
  get guideOpen() {
    return !this.field('objective-guide').hidden;
  }
  private locateGoal(id: GoalId, focusGuide = false) {
    this.pinnedGoal = id;
    this.hoveredGoal = null;
    this.guideTarget = null;
    this.refreshGuide(true);
    if (focusGuide)
      this.field('guide-locations').querySelector<HTMLButtonElement>('button')?.focus({
        preventScroll: true,
      });
    if (matchMedia('(max-width: 900px)').matches) this.stage.scrollIntoView({ block: 'start' });
  }
  private refreshGuide(focus = false) {
    const goal = this.goals.find((g) => g.id === (this.hoveredGoal || this.pinnedGoal));
    const panel = this.field('objective-guide');
    panel.hidden = !goal;
    for (const g of this.goals)
      this.field(`objective-${g.id}`).classList.toggle('is-active', g === goal);
    if (!goal) {
      if (this.guideKey) this.onGuide([], false, { x: 0, y: 0, w: 0, h: 0 });
      this.guideKey = '';
      return;
    }
    const key = `${goal.id}:${goal.targets.join(',')}`;
    if (!goal.targets.includes(this.guideTarget!)) this.guideTarget = null;
    this.set('guide-title', goal.label.replace(/^[○✓◇] /, ''));
    this.set('guide-detail', goal.detail);
    if (key !== this.guideKey) {
      this.guideTarget = null;
      this.field('guide-locations').innerHTML = goal.targets
        .map((id) => {
          const tag =
            id === 'inspection'
              ? 'INSPECTION'
              : this.mission.landmarks.find((o) => o.id === id)!.tag;
          return `<button data-locate-target="${id}" aria-label="Locate ${tag}">${tag}<span aria-hidden="true"> ↗</span></button>`;
        })
        .join('');
      this.guideKey = key;
    }
    for (const button of this.field('guide-locations').querySelectorAll<HTMLElement>('button'))
      button.classList.toggle('is-active', button.dataset.locateTarget === this.guideTarget);
    const bounds = panel.getBoundingClientRect(),
      stage = this.stage.getBoundingClientRect();
    this.onGuide(this.guideTarget ? [this.guideTarget] : goal.targets, focus, {
      x: bounds.left - stage.left,
      y: bounds.top - stage.top,
      w: bounds.width,
      h: bounds.height,
    });
  }
  private briefing() {
    const m = this.mission;
    return `<div class="dialog-number">${m.number} / ${m.location}</div><h2 id="dialog-title">${m.title}</h2><p class="dialog-lead">${m.briefing.lead}</p><p class="dialog-body">${m.briefing.body}</p><div class="briefing-routes">${m.briefing.routes.map((route) => `<div><b>${route.title}</b><p>${route.body}</p></div>`).join('')}</div><p class="dialog-body">Guards can return an opening volley. Gunfire can be reported through walls. Use cover and field dressings; disable RADIO to stop support.</p><p class="briefing-controls"><kbd>1–4</kbd> select one · <kbd>Q</kbd> select all<br><kbd>RMB</kbd> move / interact / attack · <kbd>Space</kbd> pause<br><kbd>F</kbd> draw / conceal · <kbd>S</kbd> hold / pause work<br>Drag to select · Wheel to zoom · Arrows / middle-drag to pan</p><button class="primary" data-action="begin">Begin operation <span>→</span></button><button class="dialog-secondary" data-action="operations">Choose operation</button><p class="dialog-foot">Orders remain active while paused. Selection changes preserve orders.</p>`;
  }
  showBriefing() {
    this.modal.innerHTML = this.briefing();
    if (!this.modal.open) this.modal.showModal();
  }
  showOperations(records: Records) {
    this.modal.innerHTML = `<div class="dialog-number">CONTRACT DESK</div><h2 id="dialog-title">Operations</h2><p class="dialog-body">Choose a contract. Starting an operation resets the current attempt. All contracts are available for replay.</p><div class="operation-list">${missions
      .map((m) => {
        const record = missionRecord(records, m.id);
        return `<button data-action="mission:${m.id}" class="operation-card"><span class="section-label">${m.number} / ${m.location}</span><strong>${m.title}</strong><span>${m.description}</span><small>${record.best === null ? 'No completed extraction' : `${recordTimes(record.best, record.fullCrewBest)} · ${record.completions} completed`}</small></button>`;
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
    this.escortHp = null;
    this.escortHitUntil = 0;
    this.hoveredGoal = this.pinnedGoal = null;
    this.guideTarget = null;
    this.guideKey = '';
    this.field('objective-guide').hidden = true;
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
    this.field('courier-controls').hidden = !mission.transfer;
    this.field('broadcast-controls').hidden = !mission.broadcast;
    this.field('demolition-controls').hidden = !mission.demolition;
    this.field('escort-controls').hidden = true;
    this.app.querySelector<HTMLDetailsElement>('.intel-section')!.open = false;
  }
  showEnd(world: World, record: MissionRecord, force = false) {
    if (this.endShown && !force) return;
    this.endShown = true;
    const won = world.status === 'won',
      alive = world.agents.filter(living).length;
    this.modal.innerHTML = `<div class="dialog-number">OPERATION ${won ? 'COMPLETE' : 'LOST'}</div><h2 id="dialog-title">${won ? 'Account settled.' : 'The balance is due.'}</h2><p class="dialog-lead">${won ? (world.mission.objective === 'demolition' ? 'The debt backups are gone.' : world.mission.objective === 'escort' ? `${world.escort!.name} is free.` : world.mission.objective === 'broadcast' ? 'The audit is public.' : world.mission.objective === 'case' ? 'The account keys are ours.' : 'The original is in our hands.') : world.escort && !living(world.escort) ? `${world.escort.name} was killed.` : 'The crew is down.'}</p><p class="dialog-body">${won ? 'The van crosses the district line before anyone agrees who should pay for this.' : 'The site still belongs to the company. You can try another approach.'}</p><dl class="results"><div><dt>Elapsed</dt><dd>${time(world.time)}</dd></div><div><dt>Crew extracted</dt><dd>${won ? alive : 0} / 4</dd></div>${world.demolition ? `<div><dt>Backups</dt><dd>${demolished(world) ? 'Destroyed' : `${world.demolition.armed.length}/2 armed`}</dd></div>` : ''}${world.broadcast ? `<div><dt>Audit</dt><dd>${published(world) ? 'Published' : 'Incomplete'}</dd></div>` : ''}<div><dt>${world.demolition ? 'Optional register' : world.broadcast ? 'Optional LOG' : 'Evidence'}</dt><dd>${world.evidence === 'extracted' ? 'Secured' : 'Left behind'}</dd></div><div><dt>Site alarm</dt><dd>${world.alarm ? 'Triggered' : 'Quiet'}</dd></div>${won && world.mission.landmarks.some((o) => o.id === 'alternate') && world.extractedAt ? `<div><dt>Extraction</dt><dd>${landmark(world, world.extractedAt).tag}</dd></div>` : ''}</dl>${record.best !== null ? `<p class="fine">${recordTimes(record.best, record.fullCrewBest)}</p>` : ''}<button class="primary" data-action="${won && nextMission(world.mission.id) ? 'next' : 'restart'}">${won && nextMission(world.mission.id) ? 'Next operation' : 'Run it again'} <span>→</span></button><button class="dialog-secondary" data-action="operations">Operations</button>`;
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
    this.goals = missionGoals(world);
    for (const goal of this.goals) {
      this.set(`objective-${goal.id}`, goal.label);
      this.field(`objective-${goal.id}`).classList.toggle('complete', goal.complete);
      this.field(`objective-${goal.id}`).classList.toggle('optional', !!goal.optional);
    }
    const exits = world.mission.landmarks.filter((o) => isExtraction(o.id));
    const extracting = world.agents.some(
      (p) => living(p) && p.order.kind === 'interact' && isExtraction(p.order.target),
    );
    this.field('extraction-controls').hidden =
      world.status !== 'playing' ||
      !(
        world.escort?.recruited ||
        world.evidence === 'carried' ||
        published(world) ||
        demolished(world) ||
        extracting
      );
    this.field('exit-alternate').hidden = !exits.some((o) => o.id === 'alternate');
    const requirement = extractionRequirement(world);
    const rallyBlocker = requirement?.detail || extractionRallyBlocker(world);
    for (const exit of exits) {
      if (!isExtraction(exit.id)) continue;
      const status = extractionStatus(world, exit.id);
      const ordered = world.agents
        .filter(living)
        .every((p) => p.order.kind === 'interact' && p.order.target === exit.id);
      this.set(
        `exit-button-${exit.id}`,
        requirement
          ? `${exit.tag} locked`
          : `${status.ready ? 'Extract at' : 'Rally crew to'} ${exit.tag}`,
      );
      this.set(
        `exit-status-${exit.id}`,
        rallyBlocker ||
          `${status.present}/${status.total} crew in ring. ${status.ready ? (ordered ? 'Boarding…' : 'Ready — order extraction to leave.') : status.waiting}`,
      );
      (this.field(`exit-button-${exit.id}`) as HTMLButtonElement).disabled = !!rallyBlocker;
      this.field(`exit-${exit.id}`).classList.toggle('ready', status.ready);
      this.field(`exit-button-${exit.id}`).title =
        rallyBlocker ||
        'Order every surviving operative to this exit. Other orders are replaced; a waiting witness stays in cover.';
    }
    if (world.status !== 'playing') this.clearGuide();
    else this.refreshGuide();
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
    const pendingCall = Math.min(
      ...world.guards.filter((g) => living(g) && !g.reported && g.radio > 0).map((g) => g.radio),
    );
    this.set(
      'radio-status',
      world.relayOff
        ? 'Radio relay disabled'
        : world.alarm
          ? world.waves < RESPONSE_TIMES.length
            ? `Response team in ${Math.max(0, Math.ceil(RESPONSE_TIMES[world.waves] - (world.time - world.alarmTime)))}s · RADIO stops support`
            : `${world.waves} / ${RESPONSE_TIMES.length} response teams arrived`
          : Number.isFinite(pendingCall)
            ? `Backup call in ${Math.ceil(pendingCall)}s · stop the caller or RADIO`
            : 'Radio network online',
    );
    this.set('selected-count', `${selected.length} / 4`);
    this.set('selected-name', all ? 'Crew selected' : a ? a.name : 'No selection');
    this.field('selected-name').title = all
      ? `${selected.length} operatives`
      : a?.role || 'Choose a portrait';
    this.set(
      'selected-cover',
      a
        ? all
          ? `${selected.filter((a) => a.weapon).length} weapons drawn`
          : a.disguised
            ? a.exposed
              ? 'Uniform · identity compromised'
              : 'Maintenance uniform'
            : 'Civilian cover'
        : '',
    );
    this.set(
      'assessment',
      !a
        ? 'Select an operative to issue orders.'
        : all
          ? 'Map clicks keep this group selected. Use a portrait or 1–4 to select one.'
          : a.order.kind === 'interact' && isCharge(a.order.target)
            ? 'Planting needs five uninterrupted seconds and free hands. Cannot fire while planting; moving or Hold cancels unfinished work.'
            : world.broadcast?.maskBy === a.id
              ? 'Holding LOOP. Select a teammate for UPLINK. Moving or Hold releases the loop.'
              : world.broadcast?.uploadBy === a.id
                ? 'Uploading; cannot fire while working. Moving or Hold pauses it and saves progress.'
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
    (this.field('drop-button') as HTMLButtonElement).disabled = !selected.some((a) => a.carrying);
    this.set('drop-button', `Set ${landmark(world, 'evidence').tag.toLowerCase()} down · X`);
    const worker = selected.find((p) => p.order.kind === 'interact' && p.interaction > 0);
    const work = worker?.order.kind === 'interact' ? worker.order.target : null;
    this.field('work-status').hidden = !worker;
    if (worker && work) {
      const uploading = work === 'upload' && world.broadcast?.uploadBy === worker.id;
      const duration = uploading
        ? world.mission.broadcast!.duration
        : interactionDuration(world, worker, work);
      const progress = uploading ? world.broadcast!.progress : worker.interaction;
      this.set(
        'work-label',
        world.broadcast?.maskBy === worker.id
          ? `${worker.name}: holding LOOP · S releases`
          : world.overrideBy === worker.id
            ? `${worker.name}: holding SHUNT · S releases`
            : `${worker.name}: ${landmark(world, work).tag} · ${Math.min(progress, duration).toFixed(1)} / ${duration}s`,
      );
      (this.field('work-progress') as HTMLProgressElement).value = Math.min(1, progress / duration);
    }
    if (world.demolition) {
      const done = demolished(world),
        status = detonationStatus(world);
      this.field('plant-actions').hidden = done || world.status !== 'playing';
      for (const id of ['charge-west', 'charge-east'] as const) {
        const armed = world.demolition.armed.includes(id),
          tag = landmark(world, id).tag;
        const worker = world.agents.find(
          (p) => living(p) && p.order.kind === 'interact' && p.order.target === id,
        );
        this.set(`${id}-button`, armed ? `${tag} armed` : `Plant ${tag}`);
        this.set(
          `${id}-status`,
          armed
            ? 'Charge planted'
            : worker
              ? `${worker.name} · ${worker.interaction > 0 ? `${Math.floor((100 * worker.interaction) / world.mission.demolition!.armTime)}%` : 'approaching'}`
              : selected.some((p) => !p.carrying)
                ? '5s · free hands'
                : 'Set cargo down first',
        );
        (this.field(`${id}-button`) as HTMLButtonElement).disabled =
          armed || !selected.some((p) => !p.carrying);
      }
      this.field('detonate-button').hidden = done || world.status !== 'playing';
      (this.field('detonate-button') as HTMLButtonElement).disabled = !status.ready;
      this.set(
        'detonation-status',
        status.reason || 'Crew clear. Detonate to destroy both backups and unlock VAN.',
      );
      this.field('detonation-status').classList.toggle(
        'danger',
        !done && world.demolition.armed.length === 2 && status.unsafe.length > 0,
      );
    }
    if (world.broadcast) {
      const b = world.broadcast,
        config = world.mission.broadcast!;
      const uploader = world.agents.find((p) => p.id === b.uploadBy);
      const operator = world.agents.find((p) => p.id === b.maskBy);
      const done = published(world);
      this.set(
        'broadcast-progress-label',
        done
          ? 'Audit published · 100%'
          : `${Math.floor((b.progress / config.duration) * 100)}% · ${uploader ? `${uploader.name} uploading` : b.progress > 0 ? 'Paused · progress saved' : 'Awaiting UPLINK'}`,
      );
      (this.field('broadcast-progress') as HTMLProgressElement).value =
        b.progress / config.duration;
      this.set(
        'broadcast-status',
        done
          ? 'Both stations released · rally crew'
          : b.traced
            ? 'Signal traced · defend UPLINK'
            : operator
              ? `LOOP held by ${operator.name}`
              : `LOOP open · trace in ${Math.ceil(config.traceTime - b.trace)}s of upload`,
      );
      this.field('broadcast-status').classList.toggle('danger', b.traced && !done);
      this.field('broadcast-actions').hidden = done || world.status !== 'playing';
      const freeHands = selected.some((p) => !p.carrying);
      (this.field('mask-button') as HTMLButtonElement).disabled = !freeHands || b.traced;
      (this.field('upload-button') as HTMLButtonElement).disabled = !freeHands;
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
      const feedback = transferFeedback(world)!;
      this.set('courier-status', feedback.status);
      this.field('courier-status').classList.toggle('danger', feedback.interrupted);
      const call = this.field('courier-call-button') as HTMLButtonElement;
      const caller = world.agents.find(
        (p) => living(p) && p.order.kind === 'interact' && p.order.target === 'dispatch',
      );
      call.hidden = !feedback.needsCall || world.status !== 'playing';
      call.disabled = !!caller || !selected.some((p) => !p.carrying);
      this.set(
        'courier-call-button',
        caller ? `${caller.name} heading to CALL` : 'Send selected to CALL',
      );
      call.title = caller
        ? 'The transfer starts after the operative reaches CALL and finishes the order.'
        : 'Order a selected operative with free hands to CALL. DIVERT sets the route; CALL starts the transfer.';
      this.set(
        'intel',
        world.evidence === 'carried'
          ? 'Bring CASE and every survivor to the west-street VAN. Signed clearance belongs to its disguised carrier and is lost if the case is set down.'
          : world.evidence === 'available'
            ? 'Recover CASE from its amber marker. It needs both hands and is conspicuous without signed clearance.'
            : 'Watch the west patrol before using DIVERT: tampering takes three seconds and is suspicious in uniform. CALL starts the transfer. At INSPECTION, right-click CASE with a concealed, disguised operative to sign. Right-click the courier’s body to attack.',
      );
    }
    for (const p of world.agents) {
      const card = this.app.querySelector<HTMLElement>(`[data-agent="${p.index}"]`)!;
      card.setAttribute('aria-pressed', String(state.selected.includes(p.id)));
      card.classList.toggle('down', !living(p));
      card.classList.toggle('wounded', living(p) && p.hp <= 32);
      this.set(`health-label-${p.index}`, `${Math.ceil(p.hp)} / ${p.maxHp} HP`);
      const aid = this.field(`aid-${p.index}`) as HTMLButtonElement;
      aid.hidden = world.status !== 'playing' || !living(p) || !p.medkit || p.hp === p.maxHp;
      this.set(`aid-${p.index}`, `+${Math.min(55, p.maxHp - p.hp)}`);
      aid.setAttribute('aria-label', `Treat ${p.name} +${Math.min(55, p.maxHp - p.hp)}`);
      aid.title = `Use ${p.name}'s one field dressing; selection and orders stay active.`;
      this.field(`health-${p.index}`).style.width = `${p.hp}%`;
      this.set(
        `condition-${p.index}`,
        !living(p)
          ? 'Down'
          : p.order.kind === 'interact' && isCharge(p.order.target) && p.interaction > 0
            ? `Planting ${landmark(world, p.order.target).tag}`
            : world.broadcast?.maskBy === p.id
              ? 'Holding loop'
              : world.broadcast?.uploadBy === p.id
                ? 'Uploading audit'
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
    const dressings = selected.filter((p) => p.medkit).length;
    this.set('heal-label', `Field dressing · ${dressings} left`);
    (this.field('heal-button') as HTMLButtonElement).disabled = !selected.some(
      (p) => p.medkit && p.hp < p.maxHp,
    );
    this.field('escort-controls').hidden = !escort?.recruited || world.status !== 'playing';
    if (escort?.recruited) {
      if (this.escortHp !== null && escort.hp < this.escortHp) this.escortHitUntil = world.time + 3;
      this.escortHp = escort.hp;
      const underFire =
        world.time < this.escortHitUntil ||
        world.guards.some(
          (g) =>
            living(g) &&
            g.mode === 'combat' &&
            g.target === escort.id &&
            distance(g, escort) <= WEAPON_RANGE &&
            lineClear(world, g, escort),
        );
      this.set(
        'escort-alert',
        underFire
          ? `${escort.name} under fire`
          : escort.hp <= 32
            ? `${escort.name} badly wounded`
            : `Locate ${escort.name}`,
      );
      this.field('escort-controls').classList.toggle('under-fire', underFire || escort.hp <= 32);
      const medic = escortMedic(
        world,
        world.agents.map((p) => p.id),
      );
      this.set(
        'escort-status',
        `${escort.name} · ${Math.ceil(escort.hp)} / ${escort.maxHp} health · ${escort.waiting ? 'waiting' : 'following'}`,
      );
      this.field('escort-status').classList.toggle('danger', escort.hp < 30);
      this.set(
        'escort-wait-button',
        `${escort.waiting ? 'Ask' : 'Tell'} ${escort.name} to ${escort.waiting ? 'follow' : 'wait'}`,
      );
      this.set(
        'escort-aid-button',
        `Treat ${escort.name}${medic ? ` · ${medic.name}'s dressing` : ''}`,
      );
      this.field('escort-aid-button').hidden =
        !world.mission.escort?.vulnerable || escort.hp >= escort.maxHp;
      (this.field('escort-wait-button') as HTMLButtonElement).disabled = !living(escort);
      (this.field('escort-aid-button') as HTMLButtonElement).disabled = !medic;
      this.field('escort-aid-hint').hidden =
        !world.mission.escort?.vulnerable || escort.hp >= escort.maxHp || !!medic;
      this.set(
        'escort-aid-hint',
        'Bring an operative with free hands and a dressing next to the witness.',
      );
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
        `${escort.name} ${escort.waiting ? 'waits in place' : `follows ${world.agents.find((a) => a.id === escort.leader)?.name || 'the crew'}`}. ${exits}. Use the extraction objective to rally the crew and leave.`,
      );
    }
    this.set(
      'best',
      state.best === null ? '' : recordTimes(state.best, state.fullCrewBest ?? null),
    );
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
