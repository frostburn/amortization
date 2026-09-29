import type { Scene } from '../render/scene';
import type { Command } from '../sim/commands';
import { flashPreview, flashReady } from '../sim/flash';
import type { Vec, World } from '../sim/types';
import { notify } from '../sim/world';
import type { Hud } from './hud';

/** Hovering/dragging is presentation state. Only a valid throw is recorded. */
export class FlashAim {
  active = false;
  private point: Vec | null = null;
  private world: World | null = null;
  private selected = '';
  private panel: HTMLElement;
  private hint: HTMLElement;
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
      '<div><strong>FLASH GRENADE</strong><button class="flash-cancel">Cancel · Esc</button></div><p class="flash-gesture"></p><p class="flash-hint" role="status"></p>';
    this.hint = this.panel.querySelector('.flash-hint')!;
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
    this.hud.clearGuide();
    this.hud.stage.dataset.aiming = 'flash';
    this.panel.hidden = false;
    this.panel.querySelector('.flash-gesture')!.textContent = matchMedia('(pointer: coarse)')
      .matches
      ? 'Drag to aim · release to throw'
      : 'Hover to aim · click to throw';
    if (matchMedia('(max-width: 900px)').matches) this.hud.stage.scrollIntoView({ block: 'start' });
    this.scene.app.canvas.focus({ preventScroll: true });
    this.update();
  }
  hover(point: Vec | null) {
    if (this.active) this.point = point;
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
    this.scene.flashAim = null;
    if (!this.point) {
      this.hint.textContent =
        'Range 7 · radius 3. An invalid throw cancels. Existing orders continue while aiming.';
      return;
    }
    const preview = flashPreview(w, ids, this.point);
    this.scene.flashAim = {
      point: this.point,
      from: preview.thrower,
      valid: !preview.reason,
      exposed: preview.exposed,
    };
    this.hint.textContent = `${preview.thrower?.name ?? 'No thrower'} · ${preview.reason || 'Range 7 · radius 3.'} ${preview.exposed.length ? `Exposed crew: ${preview.exposed.map((a) => a.name).join(', ')}.` : 'Crew clear.'}`;
  }
  throwAt(point: Vec) {
    if (!this.active) return;
    this.point = point;
    this.confirm();
  }
  // Enter also throws at the current preview, without a separate confirmation mode.
  confirm() {
    if (!this.active || !this.point) return;
    this.update();
    if (!this.active) return;
    const preview = flashPreview(this.target.world(), this.target.selection(), this.point);
    if (preview.reason || !preview.thrower) {
      notify(this.target.world(), `Flash cancelled. ${preview.reason}`, 'warning');
    } else {
      this.target.command({
        kind: 'flash',
        agents: [preview.thrower.id],
        point: { ...this.point },
      });
    }
    this.cancel();
  }
  cancel() {
    this.active = false;
    this.point = null;
    this.scene.flashAim = null;
    this.panel.hidden = true;
    delete this.hud.stage.dataset.aiming;
  }
}
