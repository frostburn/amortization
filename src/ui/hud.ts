import { distance, living, EXTRACTION_RADIUS } from '../sim/types';
import type { World } from '../sim/types';
import { suspicionRate } from '../sim/awareness';
import { landmark } from '../sim/orders';

export type Action =
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
  private briefingHtml = '';
  private fields = new Map<string, HTMLElement>();
  constructor(onAction: (action: Action) => void, onSelect: (index: number, add: boolean) => void) {
    this.app = document.querySelector('#app')!;
    this.app.innerHTML = `
      <header class="topbar"><h1>AMORTIZATION</h1><span class="operation">01 / THE RELEASE CLAUSE</span><div class="top-actions"><button data-action="briefing" title="Mission briefing and controls">Briefing</button><button data-action="pause" id="pause-button">${icon('play')}<span id="pause-label">Resume</span></button><button data-action="sound" id="sound-button">Sound off</button></div></header>
      <main class="game-layout">
        <section class="map-column" aria-label="Operation map and crew">
          <div class="stage" id="stage"><div class="map-top"><span id="time-mode">PLANNING / ORDERS ACTIVE</span><span id="clock">00:00</span></div><div class="map-controls"><button data-action="zoom-out" aria-label="Zoom out">−</button><button data-action="home">Fit map</button><button data-action="zoom-in" aria-label="Zoom in">+</button></div><div class="map-caption"><span>TRAM DEPOT 06</span><small>Municipal assets division</small></div><div class="selection-box" id="selection-box"></div></div>
          <div class="dispatch"><span>COMMS</span><p id="message" role="status">Preparing the operation…</p></div>
          <div class="squad" aria-label="Squad selection">${['Morrow', 'Vale', 'Rook', 'Sable'].map((name, i) => `<button class="agent-card" data-agent="${i}" aria-label="Select ${name}" aria-pressed="true"><span class="portrait portrait-${i}" aria-hidden="true"></span><span class="agent-copy"><span class="agent-heading"><b>${i + 1}</b> ${name}</span><span class="agent-condition" id="condition-${i}">Ready</span><span class="health-track"><span id="health-${i}"></span></span></span></button>`).join('')}</div>
          <footer class="controls-hint"><span><kbd>1–4</kbd> operative <kbd>Q</kbd> squad <kbd>RMB</kbd> order <kbd>Space</kbd> pause <kbd>Tab</kbd> slow</span><button data-action="restart" title="Restart operation (Shift+R)">Restart</button></footer>
        </section>
        <aside class="sidebar">
          <section class="mission-section"><p class="section-label">MISSION</p><h2>The release clause</h2><p class="description">Retrieve engineer Iona Voss.</p><div class="objectives"><p id="objective-voss">○ Locate Voss</p><p id="objective-extract">○ Extract at the van</p><p class="optional" id="objective-evidence">◇ Diagnostic unit <span>optional</span></p></div></section>
          <section class="alert-section"><p class="section-label">ALERT STATUS</p><p class="alert" id="alert">● Site quiet</p><p class="fine" id="radio-status">Radio network online</p></section>
          <section class="selection-section"><p class="section-label">SELECTED OPERATIVE<span id="selected-count">4 / 4</span></p><div class="selected-info"><span id="selected-portrait" class="portrait portrait-0" aria-hidden="true"></span><div><h3 id="selected-name">Full crew</h3><p id="selected-role">Four operatives</p><p id="selected-cover">Weapons concealed</p></div></div><p class="assessment" id="assessment">Move together. Split when it matters.</p></section>
          <section class="orders-section"><p class="section-label">ORDERS</p><div class="orders">${(['regroup', 'hold', 'weapons', 'interact'] as const).map((id, i) => `<button data-action="${id}" title="${['Regroup at the lead selected operative (G)', 'Hold position (S)', 'Draw or conceal weapons (F)', 'Interact with nearest object (E)'][i]}">${icon(id)}<span id="${id}-label">${['Regroup', 'Hold', 'Draw weapons', 'Interact'][i]}</span><kbd>${['G', 'S', 'F', 'E'][i]}</kbd></button>`).join('')}</div><div class="utility"><button data-action="all">Select all <kbd>Q</kbd></button><button data-action="heal">Field dressing <kbd>H</kbd></button><button data-action="drop" id="drop-button" hidden>Set unit down <kbd>X</kbd></button></div></section>
          <section class="intel-section"><p class="section-label">FIELD NOTES</p><p id="intel">A maintenance kit was left outside the west entrance. One person can enter under cover.</p><button data-action="vision" id="vision-button" aria-pressed="true">Sight cones: on</button><p class="best" id="best"></p></section>
        </aside>
      </main>
      <dialog id="mission-dialog" aria-labelledby="dialog-title"><div class="dialog-number">01 / DEPOT 06</div><h2 id="dialog-title">The release clause</h2><p class="dialog-lead">Voss wants out.<br>The company disagrees.</p><p class="dialog-body">Enter the tram depot, find engineer Iona Voss in the secure office, and bring her back to your van. Taking the diagnostic unit earns a cleaner exit from her contract.</p><div class="briefing-routes"><div><b>A borrowed identity</b><p>The kit by the west entrance holds one maintenance uniform. Conceal your weapon. The workshop is permitted; the office is not.</p></div><div><b>A prepared escape</b><p>Open the loading gate from inside for your crew. Disable the radio relay to stop reinforcements. A blown disguise need not end the job.</p></div></div><p class="briefing-controls"><kbd>1–4</kbd> select one · <kbd>Q</kbd> select all<br><kbd>RMB</kbd> move / interact / attack · <kbd>Space</kbd> pause<br><kbd>F</kbd> draw / conceal weapons · <kbd>H</kbd> heal<br>Drag to select · Wheel to zoom · Arrows / middle-drag to pan</p><button class="primary" data-action="begin">Begin operation <span>→</span></button><p class="dialog-foot">Orders remain active while paused. Your crew starts with weapons concealed.</p></dialog>`;
    this.stage = this.app.querySelector('#stage')!;
    this.modal = this.app.querySelector('#mission-dialog')!;
    this.briefingHtml = this.modal.innerHTML;
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
  showBriefing() {
    this.modal.showModal();
  }
  close() {
    this.modal.close();
  }
  reset() {
    this.endShown = false;
    this.lastMessage = '';
    this.modal.innerHTML = this.briefingHtml;
  }
  showEnd(world: World, best: number | null) {
    if (this.endShown) return;
    this.endShown = true;
    const won = world.status === 'won',
      alive = world.agents.filter(living).length;
    this.modal.innerHTML = `<div class="dialog-number">OPERATION ${won ? 'COMPLETE' : 'LOST'}</div><h2 id="dialog-title">${won ? 'Account settled.' : 'The balance is due.'}</h2><p class="dialog-lead">${won ? 'Voss is free.' : 'The crew is down.'}</p><p class="dialog-body">${won ? 'The van crosses the district line before anyone agrees who should pay for this.' : 'The depot still belongs to the company. You can try another approach.'}</p><dl class="results"><div><dt>Elapsed</dt><dd>${time(world.time)}</dd></div><div><dt>Crew extracted</dt><dd>${won ? alive : 0} / 4</dd></div><div><dt>Evidence</dt><dd>${world.evidence === 'extracted' ? 'Secured' : 'Left behind'}</dd></div><div><dt>Site alarm</dt><dd>${world.alarm ? 'Triggered' : 'Quiet'}</dd></div></dl>${best !== null ? `<p class="fine">Best extraction: ${time(best)}</p>` : ''}<button class="primary" data-action="restart">Run it again <span>→</span></button>`;
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
      'objective-voss',
      world.engineer.recruited ? '✓ Voss following escort' : '○ Locate Voss',
    );
    this.set(
      'objective-extract',
      world.status === 'won' ? '✓ Extracted at the van' : '○ Extract at the van',
    );
    this.field('objective-voss').classList.toggle('complete', world.engineer.recruited);
    this.set(
      'objective-evidence',
      world.evidence === 'available'
        ? '◇ Diagnostic unit · optional'
        : world.evidence === 'carried'
          ? '✓ Diagnostic unit carried'
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
          ? 'Selection changes never cancel existing orders.'
          : a.exposed
            ? 'Identity compromised. Break sight and prepare an exit.'
            : a.carrying
              ? 'Both hands occupied. Set the unit down to fire.'
              : a.weapon
                ? 'Visible weapon. Guards will challenge you.'
                : suspicionRate(world, a) > 0
                  ? 'Restricted area. Stay out of sight.'
                  : a.disguised
                    ? 'Maintenance access. Keep your weapon concealed.'
                    : 'Civilian access. The depot is restricted.',
    );
    this.set(
      'weapons-label',
      selected.some((a) => !a.weapon && !a.carrying) ? 'Draw weapons' : 'Conceal weapons',
    );
    this.field('drop-button').hidden = !selected.some((a) => a.carrying);
    for (const p of world.agents) {
      const card = this.app.querySelector<HTMLElement>(`[data-agent="${p.index}"]`)!;
      card.setAttribute('aria-pressed', String(state.selected.includes(p.id)));
      card.classList.toggle('down', !living(p));
      this.field(`health-${p.index}`).style.width = `${p.hp}%`;
      this.set(
        `condition-${p.index}`,
        !living(p)
          ? 'Down'
          : p.carrying
            ? 'Carrying unit'
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
    if (world.engineer.recruited) {
      const near = world.agents.filter(
        (p) => living(p) && distance(p, landmark(world, 'extract')) <= EXTRACTION_RADIUS,
      ).length;
      this.set(
        'intel',
        `Voss follows ${world.agents.find((a) => a.id === world.engineer.leader)?.name || 'the crew'}. ${near} operatives at the van. Right-click VAN to extract.`,
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
