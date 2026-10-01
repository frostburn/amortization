import './story.css';
import { benchScene, missionCopy } from '../content/mission-copy';
import { CREW } from '../sim/crew';
import { openingScene, storySettings, storySpeakers } from '../content/story';
import type { StoryId, StoryScene } from '../content/story';
import { bindBackdropDismiss } from './dialog';
import { missionRecord } from './storage';
import type { Records } from './storage';
import { typingSound, typingVoices } from '../audio/typing';
import type { TypingSound } from '../audio/typing';
import { revealSchedule } from './story-reveal';

export interface StoryAudio {
  key: (id: TypingSound) => void;
  stop: () => void;
}

const SEEN_KEY = 'amortization.story.v1';
export const sceneFor = (id: StoryId, records?: Records): StoryScene => {
  if (id === 'opening') return openingScene;
  if (id === 'bench' && records) {
    const record = missionRecord(records, id);
    // Older full-crew records establish a valid four-person ending, but do not
    // establish Holt's fate. Other old records use the neutral homecoming.
    return benchScene(
      record.ending ??
        (record.fullCrewBest !== null ? { survivors: CREW.map((a) => a.id) } : undefined),
    );
  }
  return missionCopy[id]?.scene;
};
export const storyUnlocked = (id: StoryId, records: Records) =>
  !!sceneFor(id) && (id === 'opening' || missionRecord(records, id).completions > 0);

function readSeen(): Set<StoryId> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '[]');
    return new Set(
      Array.isArray(value)
        ? value.filter(
            (id): id is StoryId =>
              typeof id === 'string' && (id === 'opening' || Object.hasOwn(missionCopy, id)),
          )
        : [],
    );
  } catch {
    return new Set();
  }
}

const buttonText = (id: StoryId, seen: boolean) =>
  `${seen ? 'Replay' : 'Watch'} ${id === 'opening' ? 'opening' : 'scene'}`;

export function storyButton(id: StoryId) {
  const seen = readSeen().has(id);
  return `<button class="story-entry" data-action="story:${id}" data-story-entry="${id}" aria-haspopup="dialog"><span>${buttonText(id, seen)}</span><small>${sceneFor(id).title}</small></button>`;
}

/** A separate modal keeps the briefing/results intact underneath. The mission
 * dialog remains open, so neither simulation nor replay time advances. */
export class StoryPlayer {
  readonly dialog = document.createElement('dialog');
  private id: StoryId = 'opening';
  private scene: StoryScene = openingScene;
  private index = 0;
  private seen = readSeen();
  private sound = false;
  private text = '';
  private schedule: ReturnType<typeof revealSchedule> = [];
  private revealed = 0;
  private elapsed = 0;
  private lastFrame: number | null = null;
  private lastKey = -Infinity;
  private frame = 0;
  private key: TypingSound = 'key-voss';
  private keyGap = 60;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  constructor(
    private toggleSound: () => void,
    private audio?: StoryAudio,
  ) {
    this.dialog.id = 'story-dialog';
    this.dialog.setAttribute('aria-labelledby', 'story-title');
    this.dialog.className = 'story-dialog';
    document.body.append(this.dialog);
    bindBackdropDismiss(this.dialog);
    this.dialog.addEventListener('keydown', (event) => {
      // Keep Shift+R and tactical keys out of the mission controls underneath.
      event.stopPropagation();
      const arrow = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
      const activate = event.key === ' ' || event.key === 'Enter';
      if ((arrow || activate) && event.repeat) {
        event.preventDefault();
        return;
      }
      if (arrow) {
        event.preventDefault();
        if (event.key === 'ArrowLeft') this.move(-1);
        else this.advance(false);
      } else if (activate && !(event.target as Element).closest('button')) {
        event.preventDefault();
        this.advance(false);
      }
    });
    this.dialog.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!this.dialog.open) return;
      if (!button) {
        this.revealAll();
        return;
      }
      if (button.disabled) return;
      switch (button.dataset.storyControl) {
        case 'close':
          this.pauseReveal();
          this.dialog.close();
          break;
        case 'sound':
          this.toggleSound();
          break;
        case 'previous':
          this.move(-1);
          break;
        case 'restart':
          this.index = 0;
          this.renderBeat();
          break;
        case 'next':
          this.advance(true);
          break;
      }
    });
    this.dialog.addEventListener('close', () => {
      this.pauseReveal();
      this.schedule = [];
      this.dialog.replaceChildren();
    });
    const visibility = () => {
      if (document.hidden || !document.hasFocus()) this.pauseReveal();
      else this.resumeReveal();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', () => this.pauseReveal());
    window.addEventListener('focus', visibility);
    this.reducedMotion.addEventListener('change', () => {
      if (this.reducedMotion.matches) this.revealAll();
    });
  }

  open(id: StoryId, records: Records) {
    if (!storyUnlocked(id, records)) return;
    this.id = id;
    this.scene = sceneFor(id, records);
    this.dialog.dataset.tone = this.scene.tone ?? '';
    this.index = 0;
    this.dialog.innerHTML = `<header class="story-header"><div><p class="story-eyebrow">${id === 'opening' ? 'Prologue' : 'After the operation'} · Optional story</p><h2 id="story-title"></h2></div><div class="story-tools"><button data-story-control="sound" data-story-sound aria-pressed="false"></button><button data-story-control="close" aria-label="Close scene">×</button></div></header>
      <div class="story-stage"><div class="story-background" aria-hidden="true"></div><p class="story-setting"></p><div class="story-portrait" aria-hidden="true"></div></div>
      <section class="story-dialogue" aria-live="polite" aria-atomic="true"><p class="story-speaker"></p><p class="story-role"></p><p class="story-line"><span class="story-readable"></span><span aria-hidden="true"><span data-story-revealed></span><span data-story-pending></span></span></p></section>
      <footer class="story-footer"><div class="story-navigation"><button data-story-control="restart" aria-label="Restart scene">↶</button><button data-story-control="previous">Previous</button></div><span class="story-page"></span><button data-story-control="next" autofocus>Next →</button></footer>`;
    this.dialog.querySelector('#story-title')!.textContent = this.scene.title;
    this.renderBeat();
    this.setSound(this.sound);
    if (!this.dialog.open) this.dialog.showModal();
    this.resumeReveal();
    this.dialog.querySelector<HTMLButtonElement>('[data-story-control="next"]')!.focus();
  }

  setSound(enabled: boolean) {
    if (this.sound && !enabled) this.audio?.stop();
    this.sound = enabled;
    const button = this.dialog.querySelector<HTMLButtonElement>('[data-story-sound]');
    if (!button) return;
    const label = enabled ? 'Sound on' : 'Sound off';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-pressed', String(enabled));
    button.title = 'Game sound and character typing';
  }

  private get revealing() {
    return this.revealed < this.schedule.length;
  }

  private advance(finish: boolean) {
    if (this.revealing) this.revealAll();
    else if (this.index < this.scene.beats.length - 1) this.move(1);
    else if (finish) this.finish();
  }

  private pauseReveal() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.lastFrame = null;
    this.audio?.stop();
  }

  private resumeReveal() {
    if (
      !this.frame &&
      this.dialog.open &&
      this.revealing &&
      !document.hidden &&
      document.hasFocus()
    )
      this.frame = requestAnimationFrame(this.tick);
  }

  private tick = (now: number) => {
    this.frame = 0;
    if (!this.dialog.open || document.hidden || !document.hasFocus()) {
      this.pauseReveal();
      return;
    }
    // Never catch up with a burst of keys after a suspended tab or a long frame.
    if (this.lastFrame !== null) this.elapsed += Math.min(80, now - this.lastFrame);
    this.lastFrame = now;
    const before = this.revealed;
    let key = false;
    while (this.revealing && this.schedule[this.revealed].at <= this.elapsed) {
      key ||= this.schedule[this.revealed].key;
      this.revealed++;
    }
    if (this.revealed !== before) {
      this.renderText();
      if (key && now - this.lastKey >= this.keyGap) {
        this.lastKey = now;
        if (this.sound) this.audio?.key(this.key);
      }
    }
    this.resumeReveal();
  };

  private revealAll() {
    if (!this.revealing) return;
    this.pauseReveal();
    this.revealed = this.schedule.length;
    this.renderText();
  }

  private renderText() {
    const end = this.revealed ? this.schedule[this.revealed - 1].end : 0;
    this.dialog.querySelector('[data-story-revealed]')!.textContent = this.text.slice(0, end);
    this.dialog.querySelector('[data-story-pending]')!.textContent = this.text.slice(end);
    this.dialog.dataset.revealing = String(this.revealing);
    const next = this.dialog.querySelector<HTMLButtonElement>('[data-story-control="next"]')!;
    next.textContent = this.revealing
      ? 'Reveal line'
      : this.index === this.scene.beats.length - 1
        ? 'Finish scene'
        : 'Next →';
    next.title = this.revealing
      ? 'Click or tap the picture or dialogue to reveal the full line'
      : '';
  }

  private move(delta: number) {
    const next = Math.max(0, Math.min(this.scene.beats.length - 1, this.index + delta));
    if (next === this.index) return;
    this.index = next;
    this.renderBeat();
  }

  private renderBeat() {
    this.pauseReveal();
    const beat = this.scene.beats[this.index],
      speaker = storySpeakers[beat.speaker];
    let setting = this.scene.setting;
    for (let i = 0; i <= this.index; i++) setting = this.scene.beats[i].setting ?? setting;
    const place = storySettings[setting];
    const asset = (path: string) => `url("${import.meta.env.BASE_URL}${path}")`;
    const background = this.dialog.querySelector<HTMLElement>('.story-background')!;
    background.style.backgroundImage = asset(place.image);
    const portrait = this.dialog.querySelector<HTMLElement>('.story-portrait')!;
    portrait.style.backgroundImage = asset(speaker.image);
    portrait.style.backgroundSize = speaker.size;
    portrait.style.backgroundPosition = speaker.position;
    this.dialog.querySelector('.story-setting')!.textContent = place.name;
    this.dialog.querySelector('.story-speaker')!.textContent = speaker.name;
    this.dialog.querySelector('.story-role')!.textContent = speaker.role;
    // Announce each complete line once to assistive technology. The visual
    // reveal is aria-hidden, and its invisible suffix reserves the final wrap.
    this.text = beat.text;
    this.dialog.querySelector('.story-readable')!.textContent = this.text;
    this.schedule = revealSchedule(this.text, beat.speaker);
    this.key = typingSound(beat.speaker);
    this.keyGap = typingVoices[beat.speaker].keyGap;
    this.revealed = 0;
    this.elapsed = 0;
    this.lastKey = -Infinity;
    this.dialog.querySelector('.story-page')!.textContent =
      `${this.index + 1} / ${this.scene.beats.length}`;
    this.dialog.querySelector<HTMLButtonElement>('[data-story-control="previous"]')!.disabled =
      this.index === 0;
    this.renderText();
    if (this.reducedMotion.matches) this.revealAll();
    else this.resumeReveal();
    this.dialog.querySelector('.story-dialogue')!.scrollTop = 0;
  }

  private finish() {
    this.pauseReveal();
    this.seen.add(this.id);
    try {
      // Merge another tab's view history; never write completion/medal records.
      this.seen = new Set([...readSeen(), ...this.seen]);
      localStorage.setItem(SEEN_KEY, JSON.stringify([...this.seen]));
    } catch {
      /* The scene stays available if browser storage is disabled. */
    }
    for (const button of document.querySelectorAll<HTMLElement>(`[data-story-entry="${this.id}"]`))
      button.querySelector('span')!.textContent = buttonText(this.id, true);
    this.dialog.close();
  }
}
