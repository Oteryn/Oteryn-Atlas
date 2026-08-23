const $ = (selector) => document.querySelector(selector);
const MOBILE_BREAKPOINT = 980;
let drawerReturnFocus = null;

function panelState() {
  return {
    controls: $('#mobile-controls-panel'),
    inspector: $('#mobile-inspector-panel'),
    backdrop: $('#mobile-drawer-backdrop'),
  };
}

function mobileLayout() { return innerWidth <= MOBILE_BREAKPOINT; }

function syncPanelAccessibility(panel, open) {
  if (!panel) return;
  if (!mobileLayout()) {
    panel.inert = false;
    panel.removeAttribute('aria-hidden');
    return;
  }
  panel.inert = !open;
  panel.setAttribute('aria-hidden', String(!open));
}

function restoreDrawerFocus() {
  const target = drawerReturnFocus;
  drawerReturnFocus = null;
  if (target instanceof HTMLElement && target.isConnected) target.focus({ preventScroll: true });
}

function focusDrawerClose(which) {
  const selector = which === 'controls' ? '#mobile-controls-close' : '#mobile-inspector-close';
  $(selector)?.focus({ preventScroll: true });
}

function setMobileDrawer(which = null, { restoreFocus = true, focusDrawer = true } = {}) {
  const { controls, inspector, backdrop } = panelState();
  const controlsOpen = which === 'controls';
  const inspectorOpen = which === 'inspector';
  const mobile = mobileLayout();
  if (mobile && !which && restoreFocus) restoreDrawerFocus();
  controls?.classList.toggle('mobile-open', controlsOpen);
  inspector?.classList.toggle('mobile-open', inspectorOpen);
  $('#mobile-controls-toggle')?.setAttribute('aria-expanded', String(controlsOpen));
  $('#mobile-inspector-toggle')?.setAttribute('aria-expanded', String(inspectorOpen));
  syncPanelAccessibility(controls, controlsOpen);
  syncPanelAccessibility(inspector, inspectorOpen);
  if (backdrop) backdrop.hidden = !(controlsOpen || inspectorOpen);
  if (mobile && which && focusDrawer) focusDrawerClose(which);
  if (!mobile) drawerReturnFocus = null;
}

function copySearchToMobile() {
  const desktop = $('#search-input');
  const mobile = $('#mobile-search-input');
  if (desktop && mobile) mobile.value = desktop.value;
}

function openDrawer(which) {
  if (which === 'controls') copySearchToMobile();
  if (which && document.activeElement instanceof HTMLElement) drawerReturnFocus = document.activeElement;
  setMobileDrawer(which);
}

$('#mobile-controls-toggle')?.addEventListener('click', () => {
  const controls = $('#mobile-controls-panel');
  openDrawer(controls?.classList.contains('mobile-open') ? null : 'controls');
});

$('#mobile-inspector-toggle')?.addEventListener('click', () => {
  const inspector = $('#mobile-inspector-panel');
  openDrawer(inspector?.classList.contains('mobile-open') ? null : 'inspector');
});

$('#mobile-controls-close')?.addEventListener('click', () => setMobileDrawer(null));
$('#mobile-inspector-close')?.addEventListener('click', () => setMobileDrawer(null));
$('#mobile-drawer-backdrop')?.addEventListener('click', () => setMobileDrawer(null));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMobileDrawer(null);
});

$('#mobile-search-form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const desktopInput = $('#search-input');
  const desktopForm = $('#search-form');
  const mobileInput = $('#mobile-search-input');
  if (!desktopInput || !desktopForm || !mobileInput) return;
  desktopInput.value = mobileInput.value;
  desktopForm.requestSubmit();
  setMobileDrawer(null);
});

window.addEventListener('resize', () => {
  setMobileDrawer(null, { restoreFocus: false, focusDrawer: false });
});

setMobileDrawer(null, { restoreFocus: false, focusDrawer: false });
document.documentElement.dataset.mobileUi = 'ready';