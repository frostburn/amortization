/** Dismiss only a complete primary-button/touch click on the native backdrop.
 * Dialog padding, popovers and drags starting inside the dialog remain safe. */
export function bindBackdropDismiss(dialog: HTMLDialogElement) {
  let startedOutside = false;
  const isBackdrop = (event: MouseEvent) => {
    if (event.target !== dialog) return false;
    const bounds = dialog.getBoundingClientRect();
    return (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    );
  };
  dialog.addEventListener('pointerdown', (event) => {
    startedOutside = event.isPrimary && event.button === 0 && isBackdrop(event);
  });
  dialog.addEventListener('pointercancel', () => (startedOutside = false));
  dialog.addEventListener('close', () => (startedOutside = false));
  dialog.addEventListener('click', (event) => {
    const dismiss = startedOutside && event.button === 0 && isBackdrop(event);
    startedOutside = false;
    if (!dismiss) return;
    // Close after the click finishes targeting the dialog, so it cannot issue
    // an order or activate a control behind the backdrop (or another modal).
    event.preventDefault();
    event.stopPropagation();
    dialog.close();
  });
}
