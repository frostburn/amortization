import type { Mission } from '../sim/types';
import { medalsFor } from './medals';
import type { MedalId } from './medals';

const escape = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

export function medalList(
  mission: Mission,
  earned: MedalId[],
  fresh: MedalId[] = [],
  earnedOnly = false,
) {
  return `<div class="medal-list" aria-label="${escape(mission.title)} medals">${medalsFor(mission)
    .filter((m) => !earnedOnly || earned.includes(m.id))
    .map((m) => {
      const has = earned.includes(m.id),
        isNew = fresh.includes(m.id);
      const status = isNew ? 'New medal' : has ? 'Earned' : 'Unearned';
      return `<button type="button" class="medal" data-medal="${m.id}" data-earned="${has}" data-new="${isNew}" data-rule="${escape(m.rule)}" data-name="${escape(m.name)}" data-status="${status}" aria-label="${escape(`${m.name}. ${status}. ${m.rule}`)}"><span class="medal-emblem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m.symbol}</svg><span class="medal-mark" aria-hidden="true">${isNew ? '+' : has ? '✓' : '·'}</span></span><span class="medal-name">${m.name}</span></button>`;
    })
    .join('')}</div>`;
}

/** A top-layer tooltip stays readable at the edges of the scrolling dialog.
 * Buttons are separate from mission launch controls, including on touch. */
export function bindMedalTips(dialog: HTMLDialogElement) {
  const tip = document.createElement('div');
  tip.className = 'medal-tooltip';
  tip.id = 'medal-tooltip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('popover', 'manual');
  let active: HTMLElement | null = null,
    pinned = false;
  const close = () => {
    if (tip.isConnected && tip.matches(':popover-open')) tip.hidePopover();
    active?.removeAttribute('aria-describedby');
    active = null;
    pinned = false;
  };
  const position = () => {
    if (!active) return;
    const anchor = active.getBoundingClientRect(),
      bounds = dialog.getBoundingClientRect(),
      box = tip.getBoundingClientRect();
    if (anchor.bottom < bounds.top || anchor.top > bounds.bottom) {
      close();
      return;
    }
    tip.style.left = `${Math.max(12, Math.min(innerWidth - box.width - 12, anchor.x + anchor.width / 2 - box.width / 2))}px`;
    const below = anchor.bottom + 8;
    tip.style.top = `${Math.max(12, below + box.height <= innerHeight - 12 ? below : anchor.top - box.height - 8)}px`;
  };
  const show = (button: HTMLElement) => {
    if (active === button) return;
    close();
    active = button;
    if (!tip.isConnected) dialog.append(tip);
    tip.innerHTML = `<span class="medal-tip-status">${button.dataset.status}</span><b>${escape(button.dataset.name!)}</b><p>${escape(button.dataset.rule!)}</p>`;
    button.setAttribute('aria-describedby', tip.id);
    tip.showPopover();
    position();
  };
  const buttonAt = (target: EventTarget | null) =>
    target instanceof Element ? target.closest<HTMLElement>('[data-medal]') : null;
  dialog.addEventListener('pointerover', (e) => {
    const button = buttonAt(e.target);
    if (button && e.pointerType === 'mouse' && !pinned) show(button);
  });
  dialog.addEventListener('pointerout', (e) => {
    if (
      pinned ||
      active?.matches(':focus-visible') ||
      (e.relatedTarget instanceof Node &&
        (active?.contains(e.relatedTarget) || tip.contains(e.relatedTarget)))
    )
      return;
    if (!(e.relatedTarget instanceof Element && e.relatedTarget.closest('[data-medal]'))) close();
  });
  dialog.addEventListener('focusin', (e) => {
    const button = buttonAt(e.target);
    if (button) show(button);
    else close();
  });
  dialog.addEventListener('click', (e) => {
    const button = buttonAt(e.target);
    if (!button) {
      close();
      return;
    }
    if (active === button && pinned) close();
    else {
      show(button);
      pinned = true;
    }
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && active) {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  });
  // Focusing a medal may scroll it into view after focusin. Keep its tooltip
  // anchored through keyboard navigation; ordinary scrolling dismisses hover.
  dialog.addEventListener('scroll', () =>
    active?.matches(':focus-visible') ? position() : close(),
  );
  dialog.addEventListener('close', close);
  window.addEventListener('resize', close);
  return close;
}
