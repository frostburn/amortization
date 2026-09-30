import { storyButton } from './story';
import { CREW } from '../sim/crew';
import { missionCopy } from '../content/mission-copy';
import type { Mission, WeaponKind } from '../sim/types';
import { COIL_CHARGE, WEAPONS } from '../sim/weapons';
import { medalList } from './medal-display';
import type { MedalId } from './medals';

function equipment(m: Mission) {
  const kinds: readonly WeaponKind[] = m.loadout ?? [];
  const free = CREW.filter((_, i) => !m.detention?.cells.some((c) => c.agent === i)).map(
    ({ name }) => name,
  );
  return `<section aria-label="Starting equipment" data-loadout>
    <dl class="briefing-loadout">${CREW.map(({ name, flash }, i) => {
      const captive = m.detention?.cells.some((c) => c.agent === i);
      return `<div><dt>${name}</dt><dd>${captive ? 'Detained · unarmed' : m.loadout ? WEAPONS[m.loadout[i]].name : 'Sidearm'}${!captive && m.flashGrenades && flash ? ' · 1 flash' : ''}</dd></div>`;
    }).join('')}</dl>
    <p>${m.detention ? `${free.join(' and ')} each start with one field dressing. Detained operatives recover their dressings at GEAR.` : 'Each operative starts with one field dressing.'}</p>
    <p>${m.loadout ? 'Long guns stay visible when stowed. Reloads are automatic; reserve ammunition is unlimited.' : 'Sidearms have an eight-unit range and need no reloads.'}</p>
    ${kinds.includes('carbine') ? `<p>Carbines steady for ${WEAPONS.carbine.settle}s after moving.</p>` : ''}
    ${kinds.includes('support') ? `<p>Support guns steady for ${WEAPONS.support.settle}s. Fire pressure slows aiming and recovery in a narrow lane; movement and reloads remain responsive.</p>` : ''}
    ${kinds.includes('coil') ? `<p>Coil rifles charge for ${COIL_CHARGE}s while stationary with continuous sight.</p>` : ''}
  </section>`;
}

export function briefingObjective(m: Mission) {
  return (
    missionCopy[m.id].briefing.objective + (m.broadcast ? ` ${m.broadcast.duration}s of work.` : '')
  );
}

export function renderBriefing(m: Mission, medals: MedalId[] = []) {
  const summary = missionCopy[m.id].briefing;
  const optional = !['ledger', 'case', 'settlement', 'recall'].includes(m.objective);
  const cargo = m.landmarks.find((o) => o.id === 'evidence')!;
  return `<header class="briefing-header">
    <div class="dialog-number">${m.number} / ${m.location}</div>
    <div class="briefing-heading"><h2 id="dialog-title">${m.title}</h2>${medalList(m, medals)}</div>
  </header>
  <div class="briefing-scroll" tabindex="0" role="region" aria-label="Briefing details">
    <p class="dialog-lead">${m.briefing.lead}</p>
    <dl class="briefing-orders">
      <div><dt>Objective</dt><dd>${briefingObjective(m)}</dd></div>
      <div><dt>Extraction</dt><dd>${summary.extract}</dd></div>
      ${optional ? `<div class="briefing-optional"><dt>Optional</dt><dd>${m.evidenceName} · ${cargo.tag}</dd></div>` : ''}
    </dl>
    <p class="briefing-rules">${summary.rules}</p>
    <details class="briefing-disclosure">
      <summary>Equipment &amp; controls</summary>
      <div class="briefing-reference">
        ${equipment(m)}
        <h3>Orders</h3>
        <p>Right-click the map to move, interact or attack. On touch, tap a destination or target. Hover or tap mission goals to locate their items.</p>
        <dl class="briefing-keys">
          <div><dt><kbd>1–4</kbd> / portraits</dt><dd>Select one operative</dd></div>
          <div><dt><kbd>Q</kbd> / Select all</dt><dd>Select the crew</dd></div>
          <div><dt><kbd>Space</kbd> / Pause</dt><dd>Plan with orders still active</dd></div>
          <div><dt><kbd>F</kbd> / Draw weapons</dt><dd>Draw or stow</dd></div>
          <div><dt><kbd>S</kbd> / Hold</dt><dd>Stop moving or working</dd></div>
          ${m.flashGrenades ? '<div><dt><kbd>B</kbd> / Flash</dt><dd>Hover and click; on touch, drag and release. Out of range cancels.</dd></div>' : ''}
          <div><dt>Wheel / − +</dt><dd>Zoom</dd></div>
          <div><dt>Arrows / middle-drag</dt><dd>Pan; drag empty ground on touch</dd></div>
          <div><dt><kbd>Home</kbd> / Follow</dt><dd>Return to the selected crew</dd></div>
        </dl>
        <p>Changing selection preserves orders. Fit map shows the whole site.</p>
      </div>
    </details>
    <details class="briefing-disclosure briefing-advice">
      <summary>Tactical advice <span>· spoilers</span></summary>
      <div class="briefing-routes">${m.briefing.routes.map((route) => `<section><h3>${route.title}</h3><p>${route.body}</p></section>`).join('')}
        <section><h3>If fighting breaks out</h3><p>Guards can return an opening volley and report gunfire through walls. Use cover and field dressings. Disabling RADIO stops reinforcements, but local guards remain dangerous.</p></section>
      </div>
    </details>
  </div>
  <footer class="briefing-footer">
    ${m.id === 'depot' ? storyButton('opening') : ''}
    <button class="primary" autofocus data-action="begin">Begin operation <span>→</span></button>
    <div class="dialog-actions"><button class="dialog-secondary" data-action="operations">Choose operation</button><button class="dialog-secondary" data-action="restart">Restart mission</button></div>
    <div class="briefing-tools" data-dialog-tools></div>
  </footer>`;
}
