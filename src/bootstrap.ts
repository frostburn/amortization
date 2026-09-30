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
    loading.innerHTML =
      '<div class="boot-content"><p class="boot-kicker">AMORTIZATION</p><h1>Could not open the operation.</h1><p>Check that hardware acceleration is enabled, then reload. If you host this build, serve the complete dist folder over HTTP.</p><button id="boot-retry">Reload</button></div>';
    loading.querySelector('button')!.addEventListener('click', () => location.reload());
  });
