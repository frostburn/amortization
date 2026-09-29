import type { Scene } from '../render/scene';
import type { Command } from '../sim/commands';
import { flashPreview, flashReady } from '../sim/flash';
import type { Vec, World } from '../sim/types';
import type { Hud } from './hud';

/** Aiming is presentation state. Only confirmation enters the replay command stream. */
export class FlashAim {
  active = false;
  private point: Vec | null = null;
  private pinned = false;
  private thrower: string | null = null;
  private world: World | null = null;
  private selected = '';
  private panel: HTMLElement;
  private hint: HTMLElement;
  private confirmButton: HTMLButtonElement;
  constructor(
    private scene: Scene,
    private hud: Hud,
    private target: {
      world: () => World;
      selection: () => string[];
      command: (c: Command) => void;
    },
  ) {
    this.panel = document.createElement('section');
    this.panel.className = 'flash-aim';
    this.panel.hidden = true;
    this.panel.setAttribute('aria-label', 'Flash grenade targeting');
    this.panel.innerHTML =
      '<strong>FLASH GRENADE</strong><p class="flash-hint" role="status"></p><div><button class="flash-confirm" disabled>Throw one flash</button><button class="flash-cancel">Cancel · Esc</button></div>';
    this.hint = this.panel.querySelector('.flash-hint')!;
    this.confirmButton = this.panel.querySelector('.flash-confirm')!;
    this.confirmButton.addEventListener('click', () => this.confirm());
    this.panel.querySelector('.flash-cancel')!.addEventListener('click', () => this.cancel());
    hud.stage.appendChild(this.panel);
  }
  toggle() {
    if (this.active) return this.cancel();
    const w = this.target.world(),
      ids = this.target.selection();
    if (
      w.status !== 'playing' ||
      this.hud.modal.open ||
      !w.flashGrenades ||
      !w.agents.some((a) => ids.includes(a.id) && flashReady(a))
    )
      return;
    this.active = true;
    this.world = w;
    this.selected = ids.join(',');
    this.point = null;
    this.pinned = false;
    this.hud.clearGuide();
    this.hud.stage.dataset.aiming = 'flash';
    this.panel.hidden = false;
    if (matchMedia('(max-width: 900px)').matches) this.hud.stage.scrollIntoView({ block: 'start' });
    this.scene.app.canvas.focus({ preventScroll: true });
    this.update();
  }
  hover(point: Vec) {
    if (this.active && !this.pinned) this.point = point;
  }
  pick(point: Vec) {
    if (!this.active) return;
    this.point = point;
    this.pinned = true;
    this.thrower =
      flashPreview(this.target.world(), this.target.selection(), point).thrower?.id ?? null;
    this.update();
  }
  update() {
    if (!this.active) return;
    const w = this.target.world(),
      ids = this.target.selection();
    if (
      this.world !== w ||
      this.selected !== ids.join(',') ||
      w.status !== 'playing' ||
      this.hud.modal.open
    )
      return this.cancel();
    if (!this.point) {
      this.hint.textContent =
        'Choose a landing point on the map, then confirm. Existing orders continue while aiming.';
      this.confirmButton.disabled = true;
      return;
    }
    const preview = flashPreview(
      w,
      this.pinned ? (this.thrower ? [this.thrower] : []) : ids,
      this.point,
    );
    this.scene.flashAim = {
      point: this.point,
      from: preview.thrower,
      valid: !preview.reason,
      exposed: preview.exposed,
    };
    this.hint.textContent = `${preview.thrower?.name ?? 'No thrower'} · ${preview.reason || 'Range 7 · radius 3 · disorients for 1.5s.'} ${preview.exposed.length ? `Exposed crew: ${preview.exposed.map((a) => a.name).join(', ')}.` : 'Crew clear at current positions.'} ${this.pinned ? `Confirm to stop ${preview.thrower?.name ?? 'the thrower'} and throw once.` : 'Click a landing point to prepare the throw.'}`;
    this.confirmButton.disabled = !this.pinned || !!preview.reason;
  }
  confirm() {
    if (!this.active || !this.point || !this.pinned) return;
    this.update();
    if (!this.active || this.confirmButton.disabled) return;
    // Pin the named thrower too: no automatic substitution between preview and command.
    const preview = flashPreview(
      this.target.world(),
      this.thrower ? [this.thrower] : [],
      this.point,
    );
    if (preview.reason || !preview.thrower) return;
    this.target.command({ kind: 'flash', agents: [preview.thrower.id], point: { ...this.point } });
    this.cancel();
  }
  cancel() {
    this.active = false;
    this.point = null;
    this.pinned = false;
    this.thrower = null;
    this.scene.flashAim = null;
    this.panel.hidden = true;
    delete this.hud.stage.dataset.aiming;
  }
}
