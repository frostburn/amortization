import './playtest.css';
import build from 'virtual:playtest-build';
import { missions } from '../content/missions';
import type { Command } from '../sim/commands';
import type { World } from '../sim/types';
import { STEP } from '../sim/step';
import { compatibility, MAX_FILE_SIZE, parseReplay, Recorder, ReplayPlayer } from '../replay/core';
import type { ReplayBundle } from '../replay/core';

const STORAGE_KEY = 'amortization.playtests.v1';
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
interface Host {
  world: () => World;
  showWorld: (world: World) => void;
  pause: (paused: boolean) => void;
  isPaused: () => boolean;
  modal: HTMLDialogElement;
}

/** Dev-only UI and storage. The recorder/player themselves have no browser dependencies. */
export class Playtest {
  private recorder: Recorder;
  private history: ReplayBundle[] = [];
  private imported: ReplayBundle | null = null;
  private player: ReplayPlayer | null = null;
  private exportDialog = document.createElement('dialog');
  private replayDialog = document.createElement('dialog');
  private button: HTMLButtonElement;
  private transport = document.createElement('div');
  private storageWarning = '';
  private lastSave = 0;
  private lastPaint = 0;
  private savedEnd = false;
  constructor(private host: Host) {
    this.recorder = this.makeRecorder(host.world());
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(data))
        for (const value of data.slice(0, 4)) {
          try {
            this.history.push(parseReplay(JSON.stringify(value)));
          } catch {
            /* Skip obsolete/corrupt slots. */
          }
        }
    } catch {
      this.storageWarning = 'Browser storage is unavailable. Download attempts before leaving.';
    }
    this.button = this.entry('Export attempt', this.exportDialog, () => this.openExport());
    this.button.className = 'playtest-button';
    this.button.innerHTML =
      '<span class="playtest-recording-dot" aria-hidden="true"></span><span class="playtest-button-label"></span>';
    this.paintRecording();
    document.querySelector('#app')!.classList.add('playtest-enabled');
    document.querySelector('.top-actions')!.prepend(
      this.button,
      this.entry('Import replay', this.replayDialog, () => this.openReplay()),
    );
    this.exportDialog.innerHTML = `
      <div class="playtest-heading"><p class="section-label">DEVELOPMENT / RECORDING</p><button data-close aria-label="Close export">×</button></div>
      <h2 id="playtest-export-title">Export attempt</h2>
        <p>Every attempt records automatically. Add a note and download a win, failure, or unfinished run to share.</p>
        <label for="playtest-attempt">Attempt</label><select id="playtest-attempt"></select>
        <p id="playtest-summary"></p><p class="fine playtest-build" id="playtest-build"></p>
        <label for="playtest-note">Player note <span class="fine">optional</span></label>
        <textarea id="playtest-note" rows="3" maxlength="4000" placeholder="What felt easy, unfair, confusing, or satisfying?"></textarea>
        <div class="playtest-actions"><button id="playtest-download" class="playtest-primary">Download attempt</button></div>
        <p id="playtest-export-feedback" class="playtest-feedback" role="status"></p><p id="playtest-storage" class="fine"></p>
        <p class="fine">Up to four recent attempts are saved in this browser when storage allows. Download important runs to keep them.</p>
      <div class="playtest-footer"><button data-return hidden>Return to attempt</button><p class="fine">Close to return to the paused game.</p></div>`;
    this.replayDialog.innerHTML = `
      <div class="playtest-heading"><p class="section-label">DEVELOPMENT / PLAYBACK</p><button data-close aria-label="Close replay viewer">×</button></div>
      <h2 id="playtest-replay-title">Replay viewer</h2>
        <p>Watch a downloaded bundle or an attempt recorded in this browser. Playback preserves your live attempt.</p>
        <label for="playtest-import">Import a replay bundle</label><input id="playtest-import" type="file" accept=".json,application/json">
        <p id="playtest-viewer-feedback" class="playtest-feedback" role="status"></p>
        <label for="playtest-replay">Replay source</label><select id="playtest-replay"></select>
        <div id="playtest-replay-details" hidden>
          <p id="playtest-replay-summary"></p><p class="fine playtest-build" id="playtest-replay-build"></p>
          <blockquote id="playtest-replay-note"></blockquote>
          <p id="playtest-compatibility" class="fine"></p>
          <div class="playtest-actions"><button id="playtest-watch" class="playtest-primary">Watch replay</button><button id="playtest-current">Try current rules</button></div>
        </div>
      <div class="playtest-footer"><button data-return hidden>Return to attempt</button><p class="fine">Close to return to the paused game.</p></div>`;
    for (const [kind, dialog] of [
      ['export', this.exportDialog],
      ['replay', this.replayDialog],
    ] as const) {
      dialog.id = `playtest-${kind}-dialog`;
      dialog.className = 'playtest-dialog';
      dialog.dataset.playtest = '';
      dialog.setAttribute('aria-labelledby', `playtest-${kind}-title`);
      document.body.append(dialog);
      dialog.querySelector('[data-close]')!.addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => this.persist());
      dialog.querySelector('[data-return]')!.addEventListener('click', () => {
        dialog.close();
        this.returnToAttempt();
      });
    }
    this.field<HTMLSelectElement>('playtest-attempt').addEventListener('change', () =>
      this.details(),
    );
    this.field<HTMLTextAreaElement>('playtest-note').addEventListener('input', (event) => {
      const note = (event.target as HTMLTextAreaElement).value;
      const id = this.field<HTMLSelectElement>('playtest-attempt').value;
      if (id === 'live') this.recorder.note = note;
      else {
        const run = this.history.find((r) => r.id === id);
        if (run) run.note = note;
      }
    });
    this.field('playtest-download').addEventListener('click', () => this.download());
    this.field<HTMLSelectElement>('playtest-replay').addEventListener('change', () =>
      this.replayDetails(),
    );
    this.field('playtest-watch').addEventListener('click', () => this.watch(false));
    this.field('playtest-current').addEventListener('click', () => this.watch(true));
    this.field<HTMLInputElement>('playtest-import').addEventListener('change', (event) => {
      void this.importFile(event.target as HTMLInputElement);
    });
    this.transport.className = 'playtest-transport';
    this.transport.dataset.playtest = '';
    this.transport.hidden = true;
    this.transport.innerHTML = `<span id="replay-status" role="status"></span><button id="replay-pause">Play replay</button><label>Speed <select id="replay-speed" aria-label="Replay speed"><option value="1">1×</option><option value="4" selected>4×</option><option value="16">16×</option></select></label><button id="replay-return">Return to attempt</button>`;
    document.querySelector('.map-column')!.prepend(this.transport);
    this.transport
      .querySelector('#replay-pause')!
      .addEventListener('click', () => this.host.pause(!this.host.isPaused()));
    this.transport
      .querySelector('#replay-return')!
      .addEventListener('click', () => this.returnToAttempt());
    window.addEventListener('pagehide', () => this.persist());
    import.meta.hot?.on('vite:beforeFullReload', () => this.persist());
  }
  private field<T extends HTMLElement = HTMLElement>(id: string) {
    return (this.exportDialog.querySelector<T>(`#${id}`) ??
      this.replayDialog.querySelector<T>(`#${id}`))!;
  }
  private entry(label: string, dialog: HTMLDialogElement, open: () => void) {
    const button = document.createElement('button');
    button.dataset.playtest = '';
    button.textContent = label;
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', open);
    // IDs are assigned after the top-bar buttons are created.
    button.setAttribute(
      'aria-controls',
      dialog === this.exportDialog ? 'playtest-export-dialog' : 'playtest-replay-dialog',
    );
    return button;
  }
  private makeRecorder(world: World) {
    // randomUUID is unavailable on plain-HTTP LAN origins; this ID is metadata only.
    const id =
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return new Recorder(world, build, id, new Date().toISOString());
  }
  get isPlayback() {
    return this.player !== null;
  }
  get speed() {
    return this.player
      ? Number(this.transport.querySelector<HTMLSelectElement>('#replay-speed')!.value)
      : 1;
  }
  command(command: Command) {
    this.recorder.command(command);
  }
  afterStep() {
    this.recorder.afterStep();
  }
  newAttempt(world: World, reason: 'restart' | 'mission-change') {
    if (this.recorder.tick || this.recorder.commands.length)
      this.history = [this.recorder.finish(reason), ...this.history].slice(0, 3);
    this.player = null;
    this.transport.hidden = true;
    this.recorder = this.makeRecorder(world);
    this.savedEnd = false;
    this.paintRecording();
    this.persist();
  }
  advance() {
    this.player?.advance();
    if (this.player?.done) this.host.pause(true);
  }
  private returnToAttempt() {
    this.player = null;
    this.transport.hidden = true;
    this.host.showWorld(this.recorder.world);
    this.host.pause(true);
    this.paintRecording();
  }
  private selection() {
    const id = this.field<HTMLSelectElement>('playtest-attempt').value;
    return id === 'live' ? this.recorder.bundle() : this.history.find((r) => r.id === id)!;
  }
  private replaySelection() {
    const id = this.field<HTMLSelectElement>('playtest-replay').value;
    return id === 'imported'
      ? this.imported
      : id === 'live'
        ? this.recorder.bundle()
        : (this.history.find((r) => r.id === id) ?? null);
  }
  private label(run: ReplayBundle) {
    const mission = missions.find((m) => m.id === run.mission.id)!;
    const status =
      run.result.status === 'playing'
        ? run.endedBy === 'limit'
          ? 'recording limit'
          : 'unfinished'
        : run.result.status;
    return `${mission.number} · ${mission.title} · ${status} · ${clock(run.ticks * STEP)}`;
  }
  private list(selected = this.field<HTMLSelectElement>('playtest-attempt').value || 'live') {
    const select = this.field<HTMLSelectElement>('playtest-attempt');
    select.replaceChildren(
      new Option(`Current attempt — ${this.label(this.recorder.bundle())}`, 'live'),
    );
    for (const run of this.history) select.add(new Option(this.label(run), run.id));
    select.value = selected;
    if (!select.value) select.value = 'live';
    this.details();
  }
  private details() {
    const b = this.selection();
    this.describe(b, 'playtest');
    this.field<HTMLTextAreaElement>('playtest-note').value = b.note;
    this.field('playtest-storage').textContent = this.storageWarning;
  }
  private describe(b: ReplayBundle, prefix: string) {
    this.field(`${prefix}-summary`).textContent =
      `${b.commands.length} orders · ${clock(b.ticks * STEP)} mission · ${clock(b.timing.activeSeconds)} active · ${clock(b.timing.planningSeconds)} planning · ${clock(b.timing.slowSeconds)} using slow time · ${b.result.alive}/4 survived`;
    this.field(`${prefix}-build`).textContent =
      `Recorded ${b.startedAt} · revision ${b.build.revision.slice(0, 12)}${b.build.dirty ? ' + local changes' : ''} · simulation ${b.build.simulationHash.slice(0, 12)}`;
  }
  private listReplays(selected = this.field<HTMLSelectElement>('playtest-replay').value) {
    const select = this.field<HTMLSelectElement>('playtest-replay');
    select.replaceChildren(new Option('Choose a replay…', ''));
    if (this.imported)
      select.add(new Option(`Imported — ${this.label(this.imported)}`, 'imported'));
    select.add(new Option(`Current attempt — ${this.label(this.recorder.bundle())}`, 'live'));
    for (const run of this.history) select.add(new Option(this.label(run), run.id));
    select.value = selected;
    if (!select.value) select.value = '';
    this.replayDetails();
  }
  private replayDetails() {
    const b = this.replaySelection();
    this.field('playtest-replay-details').hidden = !b;
    if (!b) return;
    this.describe(b, 'playtest-replay');
    this.field('playtest-replay-note').textContent = b.note;
    this.field('playtest-replay-note').hidden = !b.note;
    const issues = compatibility(b, build);
    this.field<HTMLButtonElement>('playtest-watch').disabled = issues.length > 0;
    this.field('playtest-compatibility').textContent = issues.length
      ? `${issues.join(' ')} Try current rules reuses the orders without asserting the recorded state checks.`
      : 'Watch replay checks the recorded simulation state. Try current rules checks only whether the recorded outcome is reached.';
  }
  private openExport(selected?: string) {
    this.list(selected);
    this.field('playtest-export-feedback').textContent = '';
    this.open(this.exportDialog);
  }
  private openReplay() {
    this.listReplays();
    this.field('playtest-viewer-feedback').textContent = '';
    this.open(this.replayDialog);
  }
  private open(dialog: HTMLDialogElement) {
    this.host.pause(true);
    for (const other of [this.exportDialog, this.replayDialog])
      if (other !== dialog && other.open) other.close();
    dialog.querySelector<HTMLButtonElement>('[data-return]')!.hidden = !this.player;
    if (!dialog.open) dialog.showModal();
  }
  private download() {
    const bundle = this.selection();
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `amortization-${bundle.mission.id}-${bundle.result.status}-${bundle.id.slice(0, 8)}.replay.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.persist();
    this.field('playtest-export-feedback').textContent =
      'Replay bundle downloaded. You can attach it in the chat.';
  }
  private async importFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('Replay is larger than 4 MiB.');
      this.imported = parseReplay(await file.text());
      this.listReplays('imported');
      this.field('playtest-viewer-feedback').textContent =
        'Imported. Choose Watch replay or Try current rules.';
    } catch (error) {
      this.listReplays('');
      this.field('playtest-viewer-feedback').textContent = (error as Error).message;
    }
    input.value = '';
  }
  private watch(currentRules: boolean) {
    try {
      const selected = this.replaySelection();
      if (!selected) return;
      const bundle = parseReplay(JSON.stringify(selected));
      const player = new ReplayPlayer(bundle, build, currentRules);
      this.persist();
      this.player = player;
      this.replayDialog.close();
      this.host.showWorld(player.world);
      this.host.pause(true);
      this.transport.hidden = false;
      this.paintRecording();
      this.paintPlayback();
    } catch (error) {
      this.field('playtest-viewer-feedback').textContent = (error as Error).message;
    }
  }
  private paintRecording() {
    // Navigation must change with playback state, even while the renderer is
    // rebuilding the restored world and has not delivered another frame yet.
    for (const button of document.querySelectorAll<HTMLButtonElement>(
      '[data-action="restart"], [data-action="operations"], [data-action="next"], [data-action^="mission:"]',
    ))
      button.disabled = this.isPlayback;
    const recording = !this.player && !this.recorder.stopped;
    this.button.dataset.recording = String(recording);
    this.button.querySelector<HTMLElement>('.playtest-recording-dot')!.hidden = !recording;
    const status = this.player
      ? 'replay'
      : this.recorder.limited
        ? 'limit'
        : this.recorder.stopped
          ? 'saved'
          : 'REC';
    this.button.querySelector('.playtest-button-label')!.textContent = `Export attempt · ${status}`;
    this.button.title = recording
      ? 'Recording this attempt, including orders while paused. Export an attempt.'
      : 'Export an attempt.';
  }
  private paintPlayback() {
    const p = this.player;
    if (!p) return;
    const mode = p.currentRules ? 'Current rules' : 'Replay';
    this.transport.querySelector('#replay-status')!.textContent =
      p.error ||
      (p.done
        ? `${mode} ${p.currentRules ? 'finished' : 'verified'} · ${p.world.status} · tick ${p.tick}`
        : `${mode} · ${clock(p.tick * STEP)} / ${clock(p.bundle.ticks * STEP)} · tick ${p.tick}`);
    const button = this.transport.querySelector<HTMLButtonElement>('#replay-pause')!;
    button.disabled = p.done;
    button.textContent = this.host.isPaused() ? 'Play replay' : 'Pause replay';
  }
  private persist() {
    const latest = this.recorder.bundle();
    const runs = [latest, ...this.history]
      .filter((run) => run.ticks || run.commands.length)
      .slice(0, 4);
    const requested = runs.length;
    while (runs.length) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
        this.storageWarning =
          runs.length < requested
            ? `Storage is nearly full. Saved the latest ${runs.length} attempts; download older runs to keep them.`
            : '';
        this.field('playtest-storage').textContent = this.storageWarning;
        return;
      } catch {
        runs.pop();
      }
    }
    if (latest.ticks || latest.commands.length)
      this.storageWarning =
        'Browser storage could not save this attempt. Download it before leaving.';
    this.field('playtest-storage').textContent = this.storageWarning;
  }
  update(now: number, elapsed: number, paused: boolean, slow: boolean) {
    if (!this.player && document.visibilityState === 'visible' && document.hasFocus())
      this.recorder.account(Math.min(elapsed, 1), paused, slow);
    if (now - this.lastSave > 5000 || (this.recorder.stopped && !this.savedEnd)) {
      this.persist();
      this.lastSave = now;
      this.savedEnd = this.recorder.stopped;
    }
    if (now - this.lastPaint < 150) return;
    this.lastPaint = now;
    if (this.player) this.paintPlayback();
    this.paintRecording();
    if (this.host.modal.open && !this.host.modal.querySelector('[data-playtest]')) {
      const actions = document.createElement('div');
      actions.dataset.playtest = '';
      actions.className = 'playtest-actions';
      actions.append(
        this.entry('Export attempt', this.exportDialog, () => this.openExport('live')),
        this.entry('Import replay', this.replayDialog, () => this.openReplay()),
      );
      this.host.modal.append(actions);
    }
  }
}
