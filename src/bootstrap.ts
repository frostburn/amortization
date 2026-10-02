import { bugs } from '../package.json';

// The HTML/CSS loading screen paints before the game and renderer are fetched.
// It reports real stages, without a fake percentage or a minimum wait.
void import('./main')
  .then(async ({ boot }) => {
    const status = document.querySelector('#boot-status');
    if (status) status.textContent = 'Preparing the district…';
    await boot();
    document.querySelector('#boot-screen')?.remove();
  })
  .catch((error: unknown) => {
    console.error(error);
    document.querySelector('#app')?.replaceChildren();
    const loading = document.querySelector('#boot-screen');
    if (!loading) return;
    loading.setAttribute('role', 'alert');
    loading.innerHTML = `<div class="boot-content"><p class="boot-kicker">AMORTIZATION</p><h1>Could not open the operation.</h1><p>Check that hardware acceleration is enabled, then reload.</p><button id="boot-retry">Reload</button><p><a href="${bugs.url}" target="_blank" rel="noopener noreferrer">Bug reports &amp; feature requests ↗</a></p></div>`;
    loading.querySelector('button')!.addEventListener('click', () => location.reload());
  });
