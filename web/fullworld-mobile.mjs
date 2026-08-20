const $ = (selector) => document.querySelector(selector);
const MOBILE_BREAKPOINT = 760;

function panelState() {
  return {
    controls: $('#mobile-controls-panel'),
    inspector: $('#mobile-inspector-panel'),
    backdrop: $('#mobile-drawer-backdrop'),
  };
}

function setMobileDrawer(which = null) {
  const { controls, inspector, backdrop } = panelState();
  const controlsOpen = which === 'controls';
  const inspectorOpen = which === 'inspector';
  controls?.classList.toggle('mobile-open', controlsOpen);
  inspector?.classList.toggle('mobile-open', inspectorOpen);
  $('#mobile-controls-toggle')?.setAttribute('aria-expanded', String(controlsOpen));
  $('#mobile-inspector-toggle')?.setAttribute('aria-expanded', String(inspectorOpen));
  if (backdrop) backdrop.hidden = !(controlsOpen || inspectorOpen);
}

function copySearchToMobile() {
  const desktop = $('#search-input');
  const mobile = $('#mobile-search-input');
  if (desktop && mobile) mobile.value = desktop.value;
}

function openDrawer(which) {
  if (window.innerWidth > MOBILE_BREAKPOINT) return;
  if (which === 'controls') copySearchToMobile();
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
  if (window.innerWidth > MOBILE_BREAKPOINT) setMobileDrawer(null);
});
