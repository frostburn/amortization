import type { Mission, WeaponKind } from '../sim/types';
import { COIL_CHARGE, WEAPONS } from '../sim/weapons';
import { medalList } from './medal-display';
import type { MedalId } from './medals';

// Presentation copy stays outside the recorded mission definition. Editing a
// briefing must not make an otherwise compatible human replay look outdated.
const summaries: Record<Mission['id'], { objective: string; extract: string; rules: string }> = {
  settlement: {
    objective:
      'Recover REGISTER, reconcile it at CHECK, then operate SIGN and CLEAR together to release repayments.',
    extract: 'Bring REGISTER and every survivor to VAN after the funds clear.',
    rules:
      'Daylight extends human sight by 50%. Two operatives must survive until the transfer is complete. Its progress survives interruptions.',
  },
  depot: {
    objective: 'Recruit engineer Iona Voss from the secure office.',
    extract: 'Bring Voss and every surviving operative to VAN.',
    rules: 'One maintenance disguise is available for the four-person crew.',
  },
  archive: {
    objective: 'Recover the original LEDGER from the records annex.',
    extract: 'Bring the ledger and every survivor to the east-road VAN.',
    rules: 'The ledger occupies both hands and is conspicuous even in uniform.',
  },
  transfer: {
    objective: 'Recover the security courier’s CASE of account keys.',
    extract: 'Bring CASE and every survivor to the west-street VAN.',
    rules: 'The courier waits for CALL. There is no transfer countdown before you request it.',
  },
  custody: {
    objective: 'Free auditor Mara Quill from the locked security transport.',
    extract: 'Bring Mara and every survivor to STREET or SERVICE.',
    rules: 'Mara is unarmed, slow and vulnerable once she leaves the transport.',
  },
  broadcast: {
    objective: 'Publish Mara’s audit at UPLINK.',
    extract: 'Once the audit is public, bring every survivor to VAN.',
    rules:
      'The operator needs free hands and cannot fire while working. Upload progress survives interruptions.',
  },
  severance: {
    objective: 'Plant charges at WEST and EAST, then detonate both backups.',
    extract: 'After destroying both cores, bring every survivor to VAN.',
    rules:
      'Completed charges stay armed without a timer. Everyone must leave both marked blast areas before detonation.',
  },
  clearing: {
    objective: 'Recover the settlement KEYS from the north vault.',
    extract: 'Bring KEYS and every survivor to the north-east VAN.',
    rules: 'The case occupies both hands and is conspicuous even in uniform.',
  },
  mandate: {
    objective: 'Recover the restitution MANDATE from the north records room.',
    extract: 'Bring MANDATE and every survivor to the north-east VAN.',
    rules:
      'Four wired turrets guard the site. RADIO does not disable them. The mandate occupies both hands.',
  },
  personnel: {
    objective: 'Morrow and Sable must free Vale and Rook. The mandate stays with Mara.',
    extract: 'Free both prisoners, release EXIT, then bring all four to VAN.',
    rules:
      'Any operative’s death fails the rescue. Cell releases require a separate operative maintaining remote power.',
  },
  injunction: {
    objective: 'Serve the restitution mandate by uploading it at UPLINK.',
    extract: 'Once the mandate is served, bring every survivor to VAN.',
    rules:
      'Upload progress survives interruptions. Ivory inspectors verify uniforms. RADIO is deep inside a secure office.',
  },
};

function equipment(m: Mission) {
  const kinds: readonly WeaponKind[] = m.loadout ?? [];
  const names = ['Morrow', 'Vale', 'Rook', 'Sable'];
  const free = names.filter((_, i) => !m.detention?.cells.some((c) => c.agent === i));
  return `<section aria-label="Starting equipment" data-loadout>
    <dl class="briefing-loadout">${names
      .map((name, i) => {
        const captive = m.detention?.cells.some((c) => c.agent === i);
        return `<div><dt>${name}</dt><dd>${captive ? 'Detained · unarmed' : m.loadout ? WEAPONS[m.loadout[i]].name : 'Sidearm'}${!captive && m.flashGrenades && i >= 2 ? ' · 1 flash' : ''}</dd></div>`;
      })
      .join('')}</dl>
    <p>${m.detention ? `${free.join(' and ')} each start with one field dressing. Detained operatives recover their dressings at GEAR.` : 'Each operative starts with one field dressing.'}</p>
    <p>${m.loadout ? 'Long guns stay visible when stowed. Reloads are automatic; reserve ammunition is unlimited.' : 'Sidearms have an eight-unit range and need no reloads.'}</p>
    ${kinds.includes('carbine') ? `<p>Carbines steady for ${WEAPONS.carbine.settle}s after moving.</p>` : ''}
    ${kinds.includes('coil') ? `<p>Coil rifles charge for ${COIL_CHARGE}s while stationary with continuous sight.</p>` : ''}
  </section>`;
}

export function briefingObjective(m: Mission) {
  return summaries[m.id].objective + (m.broadcast ? ` ${m.broadcast.duration}s of work.` : '');
}

export function renderBriefing(m: Mission, medals: MedalId[] = []) {
  const summary = summaries[m.id];
  const optional = !['ledger', 'case', 'settlement'].includes(m.objective);
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
          ${m.flashGrenades ? '<div><dt><kbd>B</kbd> / Flash</dt><dd>Choose a landing point, then confirm</dd></div>' : ''}
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
    <button class="primary" autofocus data-action="begin">Begin operation <span>→</span></button>
    <div class="dialog-actions"><button class="dialog-secondary" data-action="operations">Choose operation</button><button class="dialog-secondary" data-action="restart">Restart mission</button></div>
    <div class="briefing-tools" data-dialog-tools></div>
  </footer>`;
}
