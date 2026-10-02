import { ORDER_BUTTONS } from '../input/actions';
import type { Action } from '../input/actions';
import { CREW } from '../sim/crew';
import {
  controllable,
  disoriented,
  distance,
  isCharge,
  isExtraction,
  living,
  inside,
  sameFloor,
  EXTRACTION_RADIUS,
} from '../sim/types';
import type { Mission, ObjectKind, Rect, World } from '../sim/types';
import { RESPONSE_TIMES, suspicionRate } from '../sim/awareness';
import { WEAPONS, longGun, visibleWeapon, weaponRange, weaponStatus } from '../sim/weapons';
import { guardDescription, guardRole } from '../sim/tactics';
import { lineClear } from '../sim/navigation';
import { clearedCargo } from '../sim/courier';
import { published } from '../sim/broadcast';
import {
  available,
  extractionRallyBlocker,
  extractionStatus,
  escortMedic,
  interactionDuration,
  landmark,
} from '../sim/orders';
import { missions, nextMission } from '../content/missions';
import { missionRecord } from './storage';
import { earnedMedals, medalsFor } from './medals';
import type { MedalId } from './medals';
import { bindMedalTips, medalList } from './medal-display';
import { bindBackdropDismiss } from './dialog';
import { briefingObjective, renderBriefing } from './briefing';
import { StoryPlayer, storyButton } from './story';
import type { StoryAudio } from './story';
import type { StoryId } from '../content/story';
import { dacre, dacreDefeated, finaleResolved } from '../sim/finale';
import { liftReady, liftRemaining } from '../sim/threshold';
import { activeCircuit, captureReady, kestrelRemoved } from '../sim/floors';
import { missionCopy } from '../content/mission-copy';
import type { Records, MissionRecord } from './storage';
import { missionGoals, transferFeedback } from './objectives';
import type { Goal, GoalId, GuideTarget } from './objectives';
import { extractionRequirement } from './extraction';
import { attackPreview, movementHint, objectPresentation, objectRequirement } from './interactions';
import { recognitionDetail } from './recognition';
import { demolished, detonationStatus } from '../sim/demolition';
import { activeTurrets, canAuthorise, inspectionRemaining, turretPowered } from '../sim/security';
import { flashReady } from '../sim/flash';
import { CREDENTIAL_TIME } from '../sim/inspection';
import { settled, settlementStatus } from '../sim/settlement';

export interface HudState {
  selected: string[];
  paused: boolean;
  slow: boolean;
  sound: boolean;
  volume?: number;
  best: number | null;
  fullCrewBest?: number | null;
  following?: boolean;
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
  private story: StoryPlayer;
  private app: HTMLElement;
  private lastMessage = '';
  private endShown = false;
  private closeMedalTip: () => void;
  private mission: Mission = missions[0];
  private world?: World;
  private fields = new Map<string, HTMLElement>();
  private goals: Goal[] = [];
  private hoveredGoal: GoalId | null = null;
  private pinnedGoal: GoalId | null = null;
  private guideTarget: GuideTarget | null = null;
  private guideKey = '';
  private escortHp: number | null = null;
  private escortHitUntil = 0;
  private inspectedGuard: string | null = null;
  private inspectedObject: ObjectKind | null = null;
  constructor(
    onAction: (action: Action) => void,
    onSelect: (index: number, add: boolean) => void,
    private onGuide: (targets: GuideTarget[], focus: boolean, panel: Rect) => void,
    storyAudio?: StoryAudio,
  ) {
    this.app = document.querySelector('#app')!;
    const floorControls = `<section id="floor-controls" class="objective-actions" aria-label="Building floors" hidden><p id="floor-status"></p><div class="broadcast-actions"><button data-action="stairs:up" id="stairs-up-button">Use UP ↑</button><button data-action="stairs:down" id="stairs-down-button">Use DOWN ↓</button></div><p id="principal-status" role="status"></p><div class="broadcast-actions" id="principal-actions"><button data-action="arrest-principal" id="arrest-principal">Cuff Kestrel · 3s</button><button data-action="attack-principal" id="attack-principal">Attack Kestrel</button></div></section>`;
    const finaleControls = `<section id="finale-controls" class="objective-actions" aria-label="The Bench" hidden><p id="dacre-status" role="status"></p><button data-action="attack-dacre" id="attack-dacre">Engage Dacre</button><p id="bench-status"></p><div id="seal-actions"><div class="broadcast-actions"><button data-action="work:seal-west">Hold SEAL A</button><button data-action="work:seal-east">Hold SEAL B</button></div><button data-action="work:breach">Force CUT · 8s</button></div></section>`;
    const escortControls = `<section id="escort-controls" class="objective-actions escort-panel" aria-label="Witness" hidden><button data-action="locate-escort" id="escort-focus" title="Locate the witness without changing squad orders"><strong id="escort-alert" role="status"></strong><span id="escort-status"></span></button><div class="escort-actions"><button data-action="escort-wait" id="escort-wait-button"><span class="witness-portrait" aria-hidden="true"></span><span id="escort-wait-label"></span></button><button data-action="escort-aid" id="escort-aid-button" hidden></button></div><p id="escort-aid-hint" hidden></p></section>`;
    const extractionControls = `<section id="extraction-controls" class="objective-actions extraction-controls" aria-label="Extraction" hidden>${(['extract', 'alternate'] as const).map((id) => `<div id="exit-${id}" class="exit-row"><button data-action="extract:${id}" id="exit-button-${id}" aria-describedby="exit-status-${id}"></button><p id="exit-status-${id}"></p></div>`).join('')}</section>`;
    const courierControls = `<section id="courier-controls" class="objective-actions" aria-label="Courier transfer" hidden><p id="courier-status" role="status"></p><button data-action="call-transfer" id="courier-call-button" hidden>Send selected to CALL</button></section>`;
    const detentionControls = `<section id="detention-controls" class="objective-actions" aria-label="Detention gates" hidden><p id="detention-status" role="status"></p><div class="broadcast-actions" id="detention-switches"><button data-action="detention:access-intake" id="intake-button">Hold INTAKE</button><button data-action="detention:access-cells" id="cells-button">Hold CELLS</button></div><button data-action="detention:escape-release" id="release-exit-button" hidden>Release EXIT</button></section>`;
    const securityControls = `<section id="security-controls" class="objective-actions" aria-label="Wired security" hidden><p id="security-status" role="status"></p><div class="broadcast-actions"><button data-action="security:power-west" id="power-west-button" title="Amber circuit · four seconds with free hands">Isolate WEST · 4s</button><button data-action="security:power-east" id="power-east-button" title="Blue circuit · four seconds with free hands">Isolate EAST · 4s</button></div><button data-action="security:authorise" id="authorise-button" aria-describedby="authorise-status">Authorise INSPECT · 22s</button><p id="authorise-status"></p></section>`;
    const demolitionControls = `<section id="demolition-controls" class="objective-actions" aria-label="Demolition" hidden><div id="plant-actions" class="broadcast-actions">${(['charge-west', 'charge-east'] as const).map((id) => `<div><button data-action="plant:${id}" id="${id}-button" aria-describedby="${id}-status"></button><p id="${id}-status"></p></div>`).join('')}</div><button data-action="detonate" id="detonate-button" aria-describedby="detonation-status">Detonate both cores</button><p id="detonation-status" role="status"></p></section>`;
    const liftControls = `<section id="lift-controls" class="objective-actions" aria-label="Tower lift" hidden><p id="lift-status" role="status"></p><progress id="lift-progress" value="0" max="1" aria-label="Lift arrival"></progress><button data-action="work:key-lift" id="lift-button">KEY carrier to LINK · 5s</button></section>`;
    const recallControls = `<section id="recall-controls" class="objective-actions" aria-label="Seizure recall" hidden><p id="recall-status" role="status"></p><progress id="recall-progress" value="0" max="1" aria-label="Recall filing"></progress><button data-action="work:file-recall" id="recall-button">Carrier to FILE · 9s</button></section>`;
    const settlementControls = `<section id="settlement-controls" class="objective-actions" aria-label="Repayments" hidden><p id="settlement-status" role="status"></p><progress id="settlement-progress" value="0" max="1" aria-label="Repayments released"></progress><button data-action="settlement:reconcile" id="reconcile-button">Carrier to CHECK · 6s</button><div class="broadcast-actions" id="settlement-actions"><button data-action="settlement:countersign" id="countersign-button">Hold SIGN</button><button data-action="settlement:settle" id="settle-button">Carrier to CLEAR</button></div></section>`;
    const broadcastControls = `<section id="broadcast-controls" class="objective-actions" aria-label="Transmission" hidden><p id="broadcast-progress-label"></p><progress id="broadcast-progress" value="0" max="1" aria-label="Upload progress"></progress><p id="broadcast-status" role="status"></p><div id="broadcast-actions" class="broadcast-actions"><button data-action="work:mask" id="mask-button" title="Send a selected operative with free hands to hold LOOP. Moving or Hold releases it.">Hold LOOP</button><button data-action="work:upload" id="upload-button" title="Send a selected operative with free hands to UPLINK. Moving or Hold pauses the upload; progress is saved.">Work UPLINK</button></div></section>`;
    this.app.innerHTML = `
      <header class="topbar"><h1>AMORTIZATION</h1><span class="operation" id="operation-title"></span><div class="top-actions"><button data-action="operations">Operations</button><button id="briefing-button" data-action="briefing" title="Mission briefing and controls">Briefing</button><button data-action="pause" id="pause-button">${icon('play')}<span id="pause-label">Resume</span></button><div class="audio-controls"><button data-action="sound" id="sound-button" aria-pressed="false">Sound off</button><label class="volume-control" title="Master volume"><span>Vol</span><input id="sound-volume" aria-label="Sound volume" type="range" min="0" max="100" value="65" step="1"></label></div></div></header>
      <main class="game-layout">
        <aside class="sidebar crew-sidebar" aria-label="Crew and orders">
          <section class="crew-section"><div class="crew-heading"><p class="section-label">CREW</p><button data-action="all">Select all <kbd>Q</kbd></button></div>
          <div class="squad" aria-label="Squad selection">${CREW.map(({ name }, i) => `<div class="crew-slot"><button class="agent-card" data-agent="${i}" aria-label="Select ${name}" aria-pressed="true"><span class="portrait portrait-${i}" aria-hidden="true"></span><span class="agent-copy"><span class="agent-heading"><b>${i + 1}</b> ${name}</span><span class="agent-condition" id="condition-${i}">Ready</span><span class="health-track"><span id="health-${i}"></span></span><span class="health-label" id="health-label-${i}"></span></span></button><button class="crew-aid" data-action="heal:${i}" id="aid-${i}" hidden></button></div>`).join('')}</div>
          </section>
          <section class="selection-section"><p class="section-label">SELECTED<span id="selected-count">4 / 4</span></p><div class="selected-info"><div><h3 id="selected-name">Full crew</h3><p id="selected-cover">Weapons concealed</p></div></div><p id="selected-equipment" class="fine" hidden></p><p class="assessment" id="assessment">Move together. Split when it matters.</p><div id="work-status" hidden><p class="fine" id="work-label"></p><progress id="work-progress" value="0" max="1" aria-label="Interaction progress"></progress></div></section>
          <section class="orders-section"><p class="section-label">ORDERS</p><div class="orders">${ORDER_BUTTONS.map(({ id, hint, label, key }) => `<button data-action="${id}" title="${hint} (${key.toUpperCase()})">${icon(id)}<span id="${id}-label">${label}</span><kbd>${key.toUpperCase()}</kbd></button>`).join('')}</div><div class="utility"><button data-action="flash" id="flash-button" hidden>Flash · B</button><button data-action="heal" id="heal-button"><span id="heal-label">Field dressing</span> <kbd>H</kbd></button><button data-action="drop" id="drop-button" disabled>Set unit down <kbd>X</kbd></button></div></section>
        </aside>
        <section class="map-column" aria-label="Operation map">
          <div class="stage" id="stage"><div id="mission-outcome" class="mission-outcome" hidden role="region" aria-labelledby="outcome-title"><p id="outcome-detail"></p><h2 id="outcome-title"></h2><div class="outcome-actions"><button data-action="briefing" id="outcome-results">View results</button><button data-action="restart">Restart mission</button><button data-action="next" id="outcome-next" hidden>Next operation →</button></div></div><div class="map-top"><span id="time-mode">PLANNING / ORDERS ACTIVE</span><span id="clock">00:00</span></div><div class="map-controls"><button data-action="vision" id="vision-button" title="Red cones: someone selected is identified. Amber: no selected operative identified yet. Turrets use their circuit colour until recognition." aria-pressed="true">Sight cones: on</button><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="home" title="Overview of the whole site">Fit map</button><button data-action="follow" id="follow-button" aria-label="Follow selected operatives" title="Follow selection · Home. Select a portrait to resume after panning." aria-pressed="true">Follow</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div><div class="map-caption"><span id="map-location"></span><small id="map-detail">Municipal assets division</small><small id="enemy-behavior" hidden></small></div><div class="selection-box" id="selection-box"></div><div id="objective-guide" class="objective-guide" role="region" aria-label="Objective guidance" hidden><div class="guide-heading"><span>MISSION GUIDE</span><button data-dismiss-guide aria-label="Close mission guide">×</button></div><h3 id="guide-title"></h3><p id="guide-detail"></p><div id="guide-locations" aria-label="Locate mission items"></div><p class="guide-instruction">Right-click a map diamond to act; on touch, tap it.</p></div></div>
          <footer class="controls-hint"><span><kbd>1–4</kbd> operative <kbd>Q</kbd> squad <kbd>RMB</kbd> order <kbd>Space</kbd> pause <kbd>Tab</kbd> slow</span><button data-action="restart" title="Restart operation (Shift+R)">Restart</button></footer>
        </section>
        <aside class="sidebar mission-sidebar" aria-label="Mission and status">
          <section class="mission-section"><h2 id="mission-title"></h2><div class="objectives">${(['primary', 'evidence', 'extract'] as const).map((id) => `<div class="objective-group" id="objective-group-${id}"><button id="objective-${id}" data-goal="${id}" aria-controls="objective-guide" aria-describedby="objective-help" title="Locate relevant mission items"></button>${id === 'primary' ? `<section id="archive-escape" class="objective-actions" hidden><p id="archive-escape-hint"></p><button id="archive-cut-button" data-action="work:breach">Send selected to CUT · 8s</button></section>` + finaleControls + floorControls + escortControls + courierControls + broadcastControls + demolitionControls + securityControls + detentionControls + settlementControls + recallControls + liftControls : id === 'extract' ? extractionControls : ''}</div>`).join('')}</div><p id="objective-help">Hover or tap goals to locate · <kbd>?</kbd> help</p></section>
          <section class="alert-section" aria-label="Alert status"><p class="alert" id="alert">● Site quiet</p><p class="fine" id="radio-status">Radio network online</p><p class="fine" id="archive-status" hidden></p></section>
          <section class="dispatch" aria-label="Comms"><span>COMMS</span><p id="message" role="status">Preparing the operation…</p></section>
          <details class="intel-section"><summary>Field notes &amp; records</summary><div class="intel-content"><p class="description" id="mission-description"></p><p id="intel"></p><p class="best" id="best"></p></div></details>
        </aside>
      </main>
      <dialog id="mission-dialog" aria-labelledby="dialog-title"></dialog>`;
    this.stage = this.app.querySelector('#stage')!;
    this.modal = this.app.querySelector('#mission-dialog')!;
    bindBackdropDismiss(this.modal);
    this.story = new StoryPlayer(() => onAction('sound'), storyAudio);
    this.modal.addEventListener('close', () => this.story.dialog.close());
    this.closeMedalTip = bindMedalTips(this.modal);
    this.app
      .querySelector<HTMLInputElement>('#sound-volume')!
      .addEventListener('input', (event) => {
        onAction(`volume:${Number((event.target as HTMLInputElement).value)}`);
      });
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
  inspectGuard(id: string | null) {
    this.inspectedGuard = id;
  }
  inspectObject(id: ObjectKind | null) {
    this.inspectedObject = id;
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
    const key = `${goal.id}:${goal.targets.join(',')}:${!!this.world?.escort?.recruited}`;
    if (!goal.targets.includes(this.guideTarget!)) this.guideTarget = null;
    this.set('guide-title', goal.label.replace(/^[○✓◇] /, ''));
    this.set('guide-detail', goal.detail);
    if (key !== this.guideKey) {
      this.guideTarget = null;
      this.field('guide-locations').innerHTML = goal.targets
        .map((id) => {
          const tag =
            id === 'dacre'
              ? 'DACRE'
              : id === 'inspection'
                ? 'INSPECTION'
                : this.world
                  ? objectPresentation(this.world, id).tag
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
  showBriefing(records: Records) {
    this.closeMedalTip();
    this.modal.classList.remove('operations-dialog');
    this.modal.classList.add('briefing-dialog');
    this.modal.innerHTML = renderBriefing(
      this.mission,
      missionRecord(records, this.mission.id).medals,
    );
    if (!this.modal.open) this.modal.showModal();
    this.modal
      .querySelector<HTMLButtonElement>('[data-action="begin"]')!
      .focus({ preventScroll: true });
  }
  showStory(id: StoryId, records: Records) {
    this.closeMedalTip();
    this.story.open(id, records);
  }
  get storyOpen() {
    return this.story.dialog.open;
  }
  showOperations(records: Records) {
    this.closeMedalTip();
    this.modal.classList.remove('briefing-dialog');
    this.modal.classList.add('operations-dialog');
    const total = missions.reduce((sum, m) => sum + medalsFor(m).length, 0),
      earned = missions.reduce((sum, m) => sum + missionRecord(records, m.id).medals.length, 0);
    this.modal.innerHTML = `<div class="dialog-number">CONTRACT DESK</div><div class="operations-heading"><h2 id="dialog-title">Operations</h2><span class="medal-total">${earned} / ${total} medals</span></div><p class="dialog-body">Choose a contract. Starting an operation resets the current attempt. Earn medals across separate runs; hover, focus or tap one for its conditions.</p>${storyButton('opening')}<div class="operation-list">${missions
      .map((m) => {
        const record = missionRecord(records, m.id);
        return `<article class="operation-card" data-operation="${m.id}"><button data-action="mission:${m.id}" class="operation-launch"><span class="section-label">${m.number} / ${m.location}</span><strong>${m.title}</strong><span>${m.description}</span><small>${record.best === null ? 'No completed extraction' : `${recordTimes(record.best, record.fullCrewBest)} · ${record.completions} completed`}</small></button><div class="operation-medals"><p class="medal-summary">Medals <span>${record.medals.length} / ${medalsFor(m).length}</span></p>${medalList(m, record.medals)}</div>${record.completions > 0 ? storyButton(m.id) : '<p class="story-locked">Story scene unlocks on completion</p>'}</article>`;
      })
      .join(
        '',
      )}</div><div class="dialog-actions"><button class="dialog-secondary" data-action="briefing">Back to mission</button><button class="dialog-secondary" data-action="restart">Restart mission</button></div>`;
    if (!this.modal.open) this.modal.showModal();
  }
  close() {
    this.closeMedalTip();
    this.story.dialog.close();
    this.modal.close();
  }
  reset(mission: Mission = this.mission) {
    this.world = undefined;
    this.app.classList.remove('mission-ended');
    this.closeMedalTip();
    this.modal.classList.remove('operations-dialog');
    this.modal.classList.add('briefing-dialog');
    this.inspectedGuard = null;
    this.inspectedObject = null;
    this.escortHp = null;
    this.escortHitUntil = 0;
    this.hoveredGoal = this.pinnedGoal = null;
    this.guideTarget = null;
    this.guideKey = '';
    this.field('objective-guide').hidden = true;
    this.mission = mission;
    this.field('mission-outcome').hidden = true;
    this.field('archive-escape').hidden = true;
    this.endShown = false;
    this.lastMessage = '';
    this.modal.innerHTML = renderBriefing(this.mission);
    this.set('operation-title', `${mission.number} / ${mission.title}`);
    this.set('map-location', mission.location);
    this.set('mission-title', mission.title);
    this.set('mission-description', mission.description);
    this.set('intel', mission.intro);
    this.field('objective-evidence').classList.toggle('optional', mission.objective === 'escort');
    this.field('archive-status').hidden = !mission.archive;
    this.field('courier-controls').hidden = !mission.transfer;
    this.field('broadcast-controls').hidden = !mission.broadcast;
    this.field('recall-controls').hidden = !mission.recall;
    this.field('settlement-controls').hidden = !mission.settlement;
    this.field('demolition-controls').hidden = !mission.demolition;
    this.field('security-controls').hidden = !mission.security;
    this.field('detention-controls').hidden = !mission.detention;
    this.field('escort-controls').hidden = true;
    this.field('escort-controls').dataset.witness = mission.escort?.id || '';
    this.app.querySelector<HTMLDetailsElement>('.intel-section')!.open = false;
  }
  showEnd(world: World, record: MissionRecord, force = false, fresh: MedalId[] = []) {
    if (this.endShown && !force) return;
    this.endShown = true;
    this.closeMedalTip();
    this.modal.classList.remove('operations-dialog', 'briefing-dialog');
    const won = world.status === 'won',
      alive = world.agents.filter(living).length;
    this.modal.innerHTML = `<div class="dialog-number">OPERATION ${won ? 'COMPLETE' : 'LOST'}</div><h2 id="dialog-title">${won ? (world.mission.finale ? 'No higher office.' : 'Account settled.') : 'The balance is due.'}</h2><p class="dialog-lead">${won ? missionCopy[world.mission.id].epilogue.lead : world.escort && !living(world.escort) && !world.mission.continuity && !world.mission.finale ? `${world.escort.name} was killed.` : world.detention || world.settlement ? world.message : 'The crew is down.'}</p><p class="dialog-body">${won ? missionCopy[world.mission.id].epilogue.body : 'The site still belongs to the company. You can try another approach.'}</p><dl class="results">${world.mission.finale ? `<div><dt>Dacre</dt><dd>${dacreDefeated(world) ? 'Defeated' : 'At large'}</dd></div>` : ''}${world.mission.continuity || world.mission.finale ? `<div><dt>${world.mission.finale ? 'Holt' : 'Kestrel'}</dt><dd>${world.escort && !living(world.escort) ? 'Eliminated' : won ? 'In custody' : 'Not extracted'}</dd></div>` : ''}${world.settlement ? `<div><dt>Repayments</dt><dd>${settled(world) ? 'Released' : 'Incomplete'}</dd></div>` : ''}<div><dt>Elapsed</dt><dd>${time(world.time)}</dd></div><div><dt>Crew extracted</dt><dd>${won ? alive : 0} / 4</dd></div>${world.demolition ? `<div><dt>Backups</dt><dd>${demolished(world) ? 'Destroyed' : `${world.demolition.armed.length}/2 armed`}</dd></div>` : ''}${world.broadcast ? `<div><dt>${world.mission.broadcast?.subject ? 'Mandate' : 'Audit'}</dt><dd>${published(world) ? (world.mission.broadcast?.completed ?? 'Published') : 'Incomplete'}</dd></div>` : ''}<div><dt>${world.demolition ? 'Optional register' : world.broadcast ? 'Optional LOG' : 'Evidence'}</dt><dd>${world.evidence === 'extracted' ? 'Secured' : 'Left behind'}</dd></div><div><dt>Site alarm</dt><dd>${world.alarm ? 'Triggered' : 'Quiet'}</dd></div>${won && world.mission.landmarks.some((o) => o.id === 'alternate') && world.extractedAt ? `<div><dt>Extraction</dt><dd>${landmark(world, world.extractedAt).tag}</dd></div>` : ''}</dl>${record.best !== null ? `<p class="fine">${recordTimes(record.best, record.fullCrewBest)}</p>` : ''}${won ? `<section class="debrief-medals" aria-label="Medals this run"><p class="medal-summary">Medals this run <span>${fresh.length ? `${fresh.length} new` : 'Already earned'}</span></p>${medalList(world.mission, earnedMedals(world), fresh, true)}</section>` : ''}${won && record.completions > 0 ? `<div class="debrief-story">${storyButton(world.mission.id)}</div>` : ''}<button class="primary" autofocus data-action="${won && nextMission(world.mission.id) ? 'next' : 'restart'}">${won && nextMission(world.mission.id) ? 'Next operation' : 'Restart mission'} <span>→</span></button><div class="dialog-actions">${won && nextMission(world.mission.id) ? '<button class="dialog-secondary" data-action="restart">Restart mission</button>' : ''}<button class="dialog-secondary" data-action="operations">Operations</button></div>`;
    if (!this.modal.open) this.modal.showModal();
  }
  update(world: World, state: HudState) {
    this.world = world;
    const ended = world.status !== 'playing';
    this.app.classList.toggle('mission-ended', ended);
    this.field('mission-outcome').hidden = !ended;
    this.field('mission-outcome').dataset.result = world.status;
    this.set('outcome-title', world.status === 'won' ? 'MISSION COMPLETE' : 'MISSION FAILED');
    this.set('outcome-detail', `${world.mission.number} / ${world.mission.title}`);
    this.field('outcome-next').hidden = world.status !== 'won' || !nextMission(world.mission.id);
    this.field('pause-button').hidden = ended;
    this.set('briefing-button', ended ? 'Results' : 'Briefing');
    this.field('briefing-button').title = ended
      ? 'View mission results and medals'
      : 'Mission briefing and controls';
    const selected = world.agents.filter((a) => state.selected.includes(a.id) && controllable(a));
    const all = selected.length > 1,
      a = selected[0];
    const inspected = world.guards.find(
      (g) => g.id === this.inspectedGuard && living(g) && g.armament,
    );
    const targetPrincipal =
      !!(world.mission.continuity || world.mission.finale) &&
      this.inspectedGuard === world.escort?.id;
    const objectId = world.mission.landmarks.find(
      (o) =>
        o.id === this.inspectedObject &&
        (available(world, o.id) ||
          isCharge(o.id) ||
          (o.id === 'escort' && world.escortLocked) ||
          (o.id === 'evidence' && world.evidence === 'courier')),
    )?.id;
    const object = objectId ? objectPresentation(world, objectId) : undefined;
    const objectBlock = object ? objectRequirement(world, object.id, state.selected) : null;
    const routeHint = movementHint(world, state.selected);
    const chargeStatus =
      object && isCharge(object.id) && world.demolition?.armed.includes(object.id)
        ? demolished(world)
          ? 'DESTROYED'
          : 'ARMED'
        : null;
    this.set(
      'map-location',
      targetPrincipal
        ? `${world.escort!.name} · lethal target`
        : object
          ? `${object.tag} · ${chargeStatus ?? (objectBlock ? 'LOCKED' : 'READY')}`
          : inspected
            ? guardRole(inspected)
            : routeHint
              ? 'Movement · detour'
              : world.mission.location,
    );
    this.set(
      'map-detail',
      targetPrincipal
        ? world.mission.finale
          ? 'Attack Holt’s body to kill. For custody, defeat Dacre, open the Bench and use CUFF.'
          : 'Attack her body to kill. For an arrest, isolate WEST and EAST then use CUFF above her.'
        : object
          ? (objectBlock ??
            (chargeStatus
              ? demolished(world)
                ? 'Both backups are destroyed. Bring the crew to VAN.'
                : (detonationStatus(world).reason ??
                  'Crew clear. Use Detonate to destroy both backups.')
              : object.detail))
          : inspected
            ? `${inspected.turret && !turretPowered(world, inspected) ? 'Offline · ' : ''}${WEAPONS[inspected.armament!.kind].name} · ${weaponStatus(inspected)} · range ${weaponRange(inspected)}`
            : (routeHint ?? 'Municipal assets division'),
    );
    this.field('map-location').parentElement!.classList.toggle(
      'inspecting',
      !!inspected || !!object || !!routeHint,
    );
    this.field('enemy-behavior').hidden = !inspected || !!object;
    this.set(
      'enemy-behavior',
      inspected
        ? `${recognitionDetail(world, inspected, state.selected)} ${inspected.inspection ? `Checking ${world.agents.find((a) => a.id === inspected.inspection!.target)?.name}: ${(CREDENTIAL_TIME - inspected.inspection.progress).toFixed(1)}s. Break sight or leave range. ` : ''}${attackPreview(world, state.selected, inspected).detail} ${guardDescription(inspected)}`
        : '',
    );
    this.field('follow-button').setAttribute('aria-pressed', String(state.following ?? false));
    this.field('selected-equipment').hidden = !a?.armament;
    this.set(
      'selected-equipment',
      a?.disarmed
        ? 'Unarmed · recover GEAR or escape'
        : a?.armament
          ? all
            ? Object.entries(WEAPONS)
                .flatMap(([kind, spec]) => {
                  const n = selected.filter((p) => !p.disarmed && p.armament?.kind === kind).length;
                  return n ? [`${n} ${spec.name.toLowerCase()}${n === 1 ? '' : 's'}`] : [];
                })
                .join(' · ')
            : `${WEAPONS[a.armament.kind].name} · ${weaponStatus(a)} · range ${weaponRange(a)}`
          : '',
    );
    this.set('clock', time(world.time));
    this.set(
      'time-mode',
      ended
        ? 'OPERATION ENDED'
        : state.paused
          ? 'PLANNING / ORDERS ACTIVE'
          : state.slow
            ? 'SLOW TIME / 20%'
            : 'OPERATION LIVE',
    );
    this.field('time-mode').classList.toggle('live', !state.paused);
    this.set('pause-label', state.paused ? 'Resume' : 'Pause');
    this.set('sound-button', state.sound ? 'Sound on' : 'Sound off');
    this.story.setSound(state.sound);
    this.field('sound-button').setAttribute('aria-pressed', String(state.sound));
    const volume = this.field('sound-volume') as HTMLInputElement;
    volume.value = String(Math.round((state.volume ?? 0.65) * 100));
    volume.setAttribute('aria-valuetext', `${volume.value}%`);
    if (this.lastMessage !== world.message) {
      // Opening comms should not immediately reveal the advice the player
      // declined in the briefing. Live reports and feedback remain unchanged.
      this.set(
        'message',
        world.message === world.mission.intro ? briefingObjective(world.mission) : world.message,
      );
      this.lastMessage = world.message;
    }
    this.goals = missionGoals(world);
    for (const goal of this.goals) {
      this.set(
        `objective-${goal.id}`,
        world.status === 'won' &&
          goal.id === 'primary' &&
          world.escort &&
          living(world.escort) &&
          world.escort.recruited
          ? `✓ ${world.escort.name} extracted`
          : goal.label,
      );
      (this.field(`objective-${goal.id}`) as HTMLButtonElement).disabled = ended;
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
        (world.mission.finale && finaleResolved(world)) ||
        world.detention?.released ||
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
              : world.mission.disguise === 'office'
                ? 'Office staff outfit'
                : 'Maintenance uniform'
            : longGun(a)
              ? 'Long gun visible'
              : 'Civilian cover'
        : '',
    );
    this.set(
      'assessment',
      !a
        ? 'Select an operative to issue orders.'
        : all
          ? world.mission.loadout
            ? 'Hover guards to inspect; tapping a guard attacks.'
            : 'Map clicks keep this group selected. Use a portrait or 1–4 to select one.'
          : disoriented(a)
            ? `Disoriented for ${a.disoriented!.toFixed(1)}s. Movement continues; firing and work resume after recovery.`
            : world.guards.some((g) => living(g) && g.inspection?.target === a.id)
              ? 'Credentials being checked! Break sight or leave the ivory inspector’s range.'
              : world.settlement?.signer === a.id
                ? 'Holding SIGN; cannot fire. Keep this operative here while the REGISTER carrier works CLEAR.'
                : world.settlement?.clerk === a.id
                  ? 'Working CLEAR with REGISTER. A separate operative must hold SIGN; progress survives interruptions.'
                  : world.detention?.operator === a.id
                    ? 'Holding remote power; cannot fire. Select a partner to advance. Moving or Hold releases the circuit.'
                    : a.disarmed
                      ? 'No weapon or dressing. Recover your equipment at GEAR, or follow the prepared escape route.'
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
                                  : visibleWeapon(a)
                                    ? longGun(a)
                                      ? a.armament?.kind === 'coil'
                                        ? 'Stop to charge a shot. Breaking sight cancels the charge. Stowing keeps it visible.'
                                        : a.armament?.kind === 'support'
                                          ? 'Stop to steady. Fire pressure slows enemies while a partner moves. Stowing keeps it visible.'
                                          : a.armament?.kind === 'carbine'
                                            ? 'Stop to aim. Stowing keeps it visible.'
                                            : 'Close range. Stowing keeps it visible.'
                                      : 'Visible weapon. Guards will challenge you.'
                                    : suspicionRate(world, a) > 0
                                      ? 'Restricted area. Stay out of sight.'
                                      : a.disguised
                                        ? 'Staff access. Keep your weapon concealed.'
                                        : 'Civilian access. The compound is restricted.',
    );
    const weaponsButton = this.app.querySelector<HTMLButtonElement>('[data-action="weapons"]')!;
    const flashButton = this.field('flash-button') as HTMLButtonElement;
    flashButton.hidden = !world.flashGrenades;
    flashButton.disabled = !selected.some(flashReady);
    flashButton.textContent = `Flash · ${selected.reduce((n, p) => n + (p.flashes ?? 0), 0)} left · B`;
    flashButton.title =
      'Select Rook or Sable with a flash. Mouse: hover and click. Touch: drag and release. Invalid throws cancel without spending a grenade.';
    weaponsButton.disabled = !selected.some((p) => !p.disarmed && !p.carrying);
    weaponsButton.title = selected.some((p) => p.disarmed)
      ? 'Freed prisoners recover their own weapon at GEAR.'
      : 'Draw or stow weapons (F)';
    this.set(
      'weapons-label',
      selected.some((a) => !a.weapon && !a.carrying)
        ? 'Draw weapons'
        : selected.some(longGun)
          ? 'Stow weapons'
          : 'Conceal weapons',
    );
    (this.field('drop-button') as HTMLButtonElement).disabled = !selected.some((a) => a.carrying);
    this.set('drop-button', `Set ${landmark(world, 'evidence').tag.toLowerCase()} down · X`);
    const worker = selected.find((p) => p.order.kind === 'interact' && p.interaction > 0);
    const work = worker?.order.kind === 'interact' ? worker.order.target : null;
    this.field('work-status').hidden = !worker;
    if (worker && work) {
      const clearing = work === 'settle' && world.settlement?.clerk === worker.id;
      const uploading = work === 'upload' && world.broadcast?.uploadBy === worker.id;
      const duration = clearing
        ? world.mission.settlement!.duration
        : uploading
          ? world.mission.broadcast!.duration
          : interactionDuration(world, worker, work);
      const progress = clearing
        ? world.settlement!.progress
        : uploading
          ? world.broadcast!.progress
          : worker.interaction;
      this.set(
        'work-label',
        world.settlement?.signer === worker.id
          ? `${worker.name}: holding SIGN · S releases`
          : world.detention?.operator === worker.id
            ? `${worker.name}: holding ${world.detention.circuit === 'access-intake' ? 'INTAKE' : 'CELLS'} · S releases`
            : world.broadcast?.maskBy === worker.id
              ? `${worker.name}: holding LOOP · S releases`
              : world.overrideBy === worker.id
                ? `${worker.name}: holding SHUNT · S releases`
                : `${worker.name}: ${objectPresentation(world, work).tag} · ${Math.min(progress, duration).toFixed(1)} / ${duration}s`,
      );
      (this.field('work-progress') as HTMLProgressElement).value = Math.min(1, progress / duration);
    }
    this.field('lift-controls').hidden = !world.threshold;
    if (world.threshold) {
      const remaining = liftRemaining(world),
        carrier = world.agents.find((a) => living(a) && a.carrying);
      this.set(
        'lift-status',
        remaining === null
          ? carrier
            ? `${carrier.name} has KEY. Calling the lift draws the lobby reserve.`
            : 'Recover KEY from dispatch, then call at LINK.'
          : liftReady(world)
            ? 'LIFT ready. Bring KEY and every survivor aboard.'
            : `Car arriving in ${Math.ceil(remaining)}s · wired lobby bell active`,
      );
      const button = this.field('lift-button') as HTMLButtonElement;
      button.hidden = remaining !== null;
      button.disabled = !!objectRequirement(world, 'key-lift', state.selected);
      button.title =
        objectRequirement(world, 'key-lift', state.selected) ??
        'Send the carrier to LINK. Stage the crew first; the local reserve investigates the call.';
      const progress = this.field('lift-progress') as HTMLProgressElement;
      progress.hidden = remaining === null || remaining === 0;
      progress.value =
        remaining === null ? 0 : 1 - remaining / world.mission.threshold!.arrivalTime;
    }
    if (world.recall) {
      const carrier = world.agents.find((p) => living(p) && p.carrying);
      const working = carrier?.order.kind === 'interact' && carrier.order.target === 'file-recall';
      const button = this.field('recall-button') as HTMLButtonElement;
      button.hidden = world.recall.filed;
      button.disabled = !!objectRequirement(world, 'file-recall', state.selected);
      button.title =
        objectRequirement(world, 'file-recall', state.selected) ??
        'Send the selected carrier to FILE. Moving or Hold cancels unfinished work.';
      this.set(
        'recall-status',
        world.recall.filed
          ? 'Filed. Bring RECALL and every survivor to VAN.'
          : working
            ? `${carrier.name} filing · ${Math.max(0, world.mission.recall!.filingTime - carrier.interaction).toFixed(1)}s remaining`
            : carrier
              ? `${carrier.name} carries RECALL. Select the carrier to work FILE.`
              : 'Collect RECALL before filing.',
      );
      const bar = this.field('recall-progress') as HTMLProgressElement;
      bar.value = world.recall.filed
        ? 1
        : working
          ? carrier.interaction / world.mission.recall!.filingTime
          : 0;
    }
    if (world.settlement) {
      const s = world.settlement,
        done = settled(world);
      this.set('settlement-status', settlementStatus(world));
      const bar = this.field('settlement-progress') as HTMLProgressElement;
      bar.hidden = !s.reconciled;
      bar.value = s.progress / world.mission.settlement!.duration;
      const check = this.field('reconcile-button') as HTMLButtonElement;
      check.hidden = s.reconciled || ended;
      check.disabled = !selected.some((a) => a.carrying);
      check.title = check.disabled
        ? 'Select the REGISTER carrier.'
        : 'Carry the original to CHECK; six seconds of work.';
      this.field('settlement-actions').hidden = !s.reconciled || done || ended;
      const sign = this.field('countersign-button') as HTMLButtonElement;
      sign.disabled = !selected.some((a) => !a.carrying);
      sign.title = sign.disabled
        ? 'Select a separate operative with free hands.'
        : 'Leave this operative holding SIGN while a partner works CLEAR.';
      const clear = this.field('settle-button') as HTMLButtonElement;
      clear.disabled = !selected.some((a) => a.carrying);
      clear.title = clear.disabled
        ? 'Select the REGISTER carrier.'
        : 'Work CLEAR with a separate operative holding SIGN.';
    }
    if (world.detention) {
      const d = world.detention,
        operator = world.agents.find((p) => p.id === d.operator);
      const free = !world.agents.some((p) => p.captive);
      this.set(
        'detention-status',
        d.released
          ? 'Both gates released · bring all four to VAN'
          : operator
            ? `${operator.name} holds ${d.circuit === 'access-intake' ? 'INTAKE' : 'CELLS'} · buttons switch their circuit`
            : 'Assign one partner to the remote console',
      );
      this.field('detention-switches').hidden = d.released;
      for (const [id, circuit] of [
        ['intake-button', 'access-intake'],
        ['cells-button', 'access-cells'],
      ] as const) {
        const button = this.field(id) as HTMLButtonElement;
        button.disabled =
          world.status !== 'playing' || (!operator && !selected.some((p) => !p.carrying));
        button.setAttribute('aria-pressed', String(d.circuit === circuit));
        button.textContent = `${operator ? 'Switch' : 'Hold'} ${circuit === 'access-intake' ? 'INTAKE' : 'CELLS'}`;
      }
      this.field('release-exit-button').hidden = !free || d.released;
    }
    if (world.security) {
      const remaining = inspectionRemaining(world);
      this.set(
        'security-status',
        remaining > 0
          ? `Inspection: ${Math.ceil(remaining)}s · guns stopped`
          : `${activeTurrets(world).length} / 4 turrets live · RADIO has no effect`,
      );
      const neutralised = !world.guards.some(
        (g) => living(g) && g.turret && !world.security!.isolated.includes(g.turret.circuit),
      );
      const authorised = selected.some((p) => canAuthorise(world, p));
      this.set(
        'authorise-button',
        world.security.inspectionUsed
          ? 'Inspection used'
          : `Authorise INSPECT · ${world.mission.security!.inspectionTime}s`,
      );
      (this.field('authorise-button') as HTMLButtonElement).disabled =
        world.security.inspectionUsed || !authorised || neutralised;
      this.set(
        'authorise-status',
        neutralised
          ? 'No sentries can restart.'
          : world.security.inspectionUsed
            ? 'Remaining feeds can still be isolated.'
            : authorised
              ? 'One use · stage the crew first'
              : 'Select an unexposed KIT wearer; conceal pistol.',
      );
      for (const id of ['power-west', 'power-east'] as const) {
        const off = world.security.isolated.includes(id);
        const guns = world.guards.filter((g) => g.turret?.circuit === id && living(g)).length;
        this.set(
          `${id}-button`,
          `${off || !guns ? '✓' : 'Isolate'} ${landmark(world, id).tag}${off || !guns ? ' · offline' : ' · 4s'}`,
        );
        (this.field(`${id}-button`) as HTMLButtonElement).disabled =
          off || !guns || !selected.some((p) => !p.carrying);
      }
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
          ? `${config.completed ?? 'Audit published'} · 100%`
          : `${Math.floor((b.progress / config.duration) * 100)}% · ${uploader ? `${uploader.name} uploading` : b.progress > 0 ? 'Paused · progress saved' : 'Awaiting UPLINK'}`,
      );
      (this.field('broadcast-progress') as HTMLProgressElement).value =
        b.progress / config.duration;
      this.set(
        'broadcast-status',
        done
          ? 'Both stations released · rally crew'
          : b.traced
            ? config.dispatchOnTrace && !world.relayOff
              ? 'Traced · radio response to UPLINK'
              : 'Signal traced · defend UPLINK'
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
      const trapped =
        !ended &&
        !world.shutterOpen &&
        world.agents.some((p) => controllable(p) && inside(p, world.mission.secure));
      this.field('archive-escape').hidden = !trapped;
      this.set(
        'archive-escape-hint',
        'Shutter closed. CUT works from inside too: eight seconds, noisy. Select an operative with free hands, or set the cargo down first.',
      );
      (this.field('archive-cut-button') as HTMLButtonElement).disabled = !selected.some(
        (p) => !p.carrying,
      );
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
        world.threshold
          ? world.evidence === 'carried'
            ? 'Release SHUNT once its partner is outside dispatch. Bring KEY to LINK, then take the crew to LIFT.'
            : 'Hold SHUNT with a partner to open dispatch, or use CUT. The crew leaves through LIFT, not the arrival van or the east gate.'
          : world.evidence === 'carried'
            ? `${landmark(world, 'evidence').tag} is conspicuous. Clear a path to the east gate, release the shunt operator once the carrier is outside, and bring everyone to VAN.`
            : `One operative holds SHUNT; another enters the ${world.mission.archive.name ?? 'archive'}. CUT is the noisy alternative. Prepare the east gate before lifting ${landmark(world, 'evidence').tag}.`,
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
      card.setAttribute('aria-pressed', String(!ended && state.selected.includes(p.id)));
      card.classList.toggle('down', !living(p));
      (card as HTMLButtonElement).disabled = ended || !!p.captive;
      card.classList.toggle('captive', !!p.captive);
      card.classList.toggle('wounded', living(p) && p.hp <= 32);
      const gun = p.disarmed ? undefined : p.armament;
      card.title = gun
        ? `${p.name} · ${WEAPONS[gun.kind].name} · ${weaponStatus(p)} · range ${weaponRange(p)}${longGun(p) ? ' · always visible' : ' · concealable'}`
        : p.role;
      this.set(
        `health-label-${p.index}`,
        gun
          ? `${Math.ceil(p.hp)} HP · ${gun.reload > 0 ? `↻ ${gun.reload.toFixed(1)}s` : `${gun.rounds}/${WEAPONS[gun.kind].magazine}`}`
          : `${Math.ceil(p.hp)} / ${p.maxHp} HP`,
      );
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
          : world.status === 'won'
            ? 'Extracted'
            : ended && !p.captive
              ? 'Survived'
              : p.captive
                ? 'Captive · awaiting rescue'
                : disoriented(p)
                  ? `Disoriented ${p.disoriented!.toFixed(1)}s`
                  : (p.pressure ?? 0) > 0.1
                    ? 'Suppressed'
                    : world.guards.some((g) => living(g) && g.inspection?.target === p.id)
                      ? 'Credentials check! Break sight'
                      : p.disarmed
                        ? 'Unarmed · recover GEAR'
                        : world.settlement?.signer === p.id
                          ? 'Holding SIGN'
                          : world.settlement?.clerk === p.id
                            ? 'Working CLEAR'
                            : world.detention?.operator === p.id
                              ? `Holding ${world.detention.circuit === 'access-intake' ? 'INTAKE' : 'CELLS'}`
                              : p.order.kind === 'interact' &&
                                  isCharge(p.order.target) &&
                                  p.interaction > 0
                                ? `Planting ${landmark(world, p.order.target).tag}`
                                : world.broadcast?.maskBy === p.id
                                  ? 'Holding loop'
                                  : world.broadcast?.uploadBy === p.id
                                    ? 'Uploading'
                                    : world.overrideBy === p.id
                                      ? 'Holding shunt'
                                      : p.carrying
                                        ? `Carrying ${landmark(world, 'evidence').tag.toLowerCase()}`
                                        : p.exposed
                                          ? 'Compromised'
                                          : p.disguised
                                            ? world.mission.disguise === 'office'
                                              ? 'Office staff'
                                              : 'Maintenance'
                                            : p.weapon
                                              ? gun
                                                ? WEAPONS[gun.kind].name
                                                : 'Weapon drawn'
                                              : p.path.length
                                                ? 'Moving'
                                                : longGun(p)
                                                  ? `${WEAPONS[gun!.kind].name} visible`
                                                  : gun
                                                    ? 'Pistol concealed'
                                                    : 'Concealed',
      );
      if (world.mission.building)
        this.field(`condition-${p.index}`).textContent =
          `${world.mission.finale ? (p.floor ? 'ROOF' : 'PENTHOUSE') : p.floor ? 'UPPER' : 'GROUND'} · ${this.field(`condition-${p.index}`).textContent}`;
    }
    this.field('floor-controls').hidden = !world.mission.building || world.status !== 'playing';
    if (world.mission.building) {
      this.set(
        'floor-status',
        `${selected.filter((p) => !p.floor).length} selected ${world.mission.finale ? 'in penthouse' : 'downstairs'} · ${selected.filter((p) => p.floor).length} ${world.mission.finale ? 'on roof' : 'upstairs'}`,
      );
      (this.field('stairs-up-button') as HTMLButtonElement).disabled = !selected.some(
        (p) => !p.floor,
      );
      (this.field('stairs-down-button') as HTMLButtonElement).disabled = !selected.some(
        (p) => p.floor,
      );
      this.set('arrest-principal', `Cuff ${world.mission.finale ? 'Holt' : 'Kestrel'} · 3s`);
      this.set('attack-principal', `Attack ${world.mission.finale ? 'Holt' : 'Kestrel'}`);
      this.field('principal-actions').hidden = kestrelRemoved(world);
      (this.field('arrest-principal') as HTMLButtonElement).disabled =
        kestrelRemoved(world) ||
        !captureReady(world) ||
        !selected.some((p) => world.escort && sameFloor(p, world.escort) && !p.carrying);
      (this.field('attack-principal') as HTMLButtonElement).disabled =
        (!!world.finale && !world.finale.open) ||
        !selected.some((p) => world.escort && sameFloor(p, world.escort) && !p.carrying);
      this.set(
        'principal-status',
        world.mission.finale
          ? world.escort?.recruited
            ? 'Holt in custody. Escort him UP to HELI.'
            : world.escort && !living(world.escort)
              ? 'Holt eliminated. Defeat Dacre, then leave at HELI.'
              : captureReady(world)
                ? 'Holt will surrender at CUFF.'
                : 'Defeat Dacre and open the Bench to arrest Holt.'
          : kestrelRemoved(world)
            ? world.escort?.recruited
              ? 'Kestrel in custody. Escort her to VAN.'
              : 'Kestrel eliminated. Return to VAN.'
            : captureReady(world)
              ? 'Controls isolated. Kestrel will surrender at CUFF.'
              : `Kestrel routing ${activeCircuit(world) === 'power-west' ? 'WEST' : 'EAST'} · switch in ${Math.ceil(world.mission.continuity!.cycle - (world.time % world.mission.continuity!.cycle))}s. Isolate both feeds for arrest.`,
      );
    }
    this.field('finale-controls').hidden = !world.finale || world.status !== 'playing';
    if (world.finale) {
      const boss = dacre(world)!;
      this.set(
        'dacre-status',
        dacreDefeated(world)
          ? 'Dacre defeated.'
          : `Dacre · ${Math.ceil(boss.hp)}/${boss.maxHp}${boss.marshal?.target ? ' · signalling crossfire' : ''}`,
      );
      this.field('attack-dacre').hidden = !living(boss);
      (this.field('attack-dacre') as HTMLButtonElement).disabled = !selected.some(
        (p) => sameFloor(p, boss) && !p.carrying,
      );
      this.set(
        'bench-status',
        world.finale.open
          ? 'The Bench is open.'
          : `Bench sealed · ${world.finale.progress.toFixed(1)}/${world.mission.finale!.sealTime}s together. Hold both seals or force CUT.`,
      );
      this.field('seal-actions').hidden = world.finale.open;
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
            distance(g, escort) <= weaponRange(g) &&
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
        'escort-wait-label',
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
