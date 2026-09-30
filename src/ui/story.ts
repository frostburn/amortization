import './story.css';
import { missionCopy } from '../content/mission-copy';
import { openingScene, storySettings, storySpeakers } from '../content/story';
import type { StoryId, StoryScene } from '../content/story';
import { bindBackdropDismiss } from './dialog';
import { missionRecord } from './storage';
import type { Records } from './storage';

const SEEN_KEY = 'amortization.story.v1';
const sceneFor = (id: StoryId) => (id === 'opening' ? openingScene : missionCopy[id]?.scene);
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

  constructor(private toggleSound: () => void) {
    this.dialog.id = 'story-dialog';
    this.dialog.setAttribute('aria-labelledby', 'story-title');
    this.dialog.className = 'story-dialog';
    document.body.append(this.dialog);
    bindBackdropDismiss(this.dialog);
    this.dialog.addEventListener('keydown', (event) => {
      // Keep Shift+R and tactical keys out of the mission controls underneath.
      event.stopPropagation();
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
      event.preventDefault();
      if (event.repeat) return;
      this.move(event.key === 'ArrowRight' ? 1 : -1);
    });
    this.dialog.addEventListener('click', (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || button.disabled) return;
      switch (button.dataset.storyControl) {
        case 'close':
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
          if (this.index < this.scene.beats.length - 1) this.move(1);
          else this.finish();
          break;
      }
    });
    this.dialog.addEventListener('close', () => this.dialog.replaceChildren());
  }

  open(id: StoryId, records: Records) {
    if (!storyUnlocked(id, records)) return;
    this.id = id;
    this.scene = sceneFor(id);
    this.index = 0;
    this.dialog.innerHTML = `<header class="story-header"><div><p class="story-eyebrow">${id === 'opening' ? 'Prologue' : 'After the operation'} · Optional story</p><h2 id="story-title"></h2></div><div class="story-tools"><button data-story-control="sound" data-story-sound aria-pressed="false"></button><button data-story-control="close" aria-label="Close scene">×</button></div></header>
      <div class="story-stage"><div class="story-background" aria-hidden="true"></div><p class="story-setting"></p><div class="story-portrait" aria-hidden="true"></div></div>
      <section class="story-dialogue" aria-live="polite" aria-atomic="true"><p class="story-speaker"></p><p class="story-role"></p><p class="story-line"></p></section>
      <footer class="story-footer"><div class="story-navigation"><button data-story-control="restart" aria-label="Restart scene">↶</button><button data-story-control="previous">Previous</button></div><span class="story-page"></span><button data-story-control="next" autofocus>Next →</button></footer>`;
    this.dialog.querySelector('#story-title')!.textContent = this.scene.title;
    this.renderBeat();
    this.setSound(this.sound);
    if (!this.dialog.open) this.dialog.showModal();
    this.dialog.querySelector<HTMLButtonElement>('[data-story-control="next"]')!.focus();
  }

  setSound(enabled: boolean) {
    this.sound = enabled;
    const button = this.dialog.querySelector<HTMLButtonElement>('[data-story-sound]');
    if (!button) return;
    const label = enabled ? 'Sound on' : 'Sound off';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-pressed', String(enabled));
    button.title = 'Game sound · scenes use text dialogue';
  }

  private move(delta: number) {
    const next = Math.max(0, Math.min(this.scene.beats.length - 1, this.index + delta));
    if (next === this.index) return;
    this.index = next;
    this.renderBeat();
  }

  private renderBeat() {
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
    this.dialog.querySelector('.story-line')!.textContent = beat.text;
    this.dialog.querySelector('.story-page')!.textContent =
      `${this.index + 1} / ${this.scene.beats.length}`;
    this.dialog.querySelector<HTMLButtonElement>('[data-story-control="previous"]')!.disabled =
      this.index === 0;
    this.dialog.querySelector('[data-story-control="next"]')!.textContent =
      this.index === this.scene.beats.length - 1 ? 'Finish scene' : 'Next →';
    this.dialog.querySelector('.story-dialogue')!.scrollTop = 0;
  }

  private finish() {
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
