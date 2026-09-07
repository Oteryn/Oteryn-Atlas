// Presentation controller only. World/search/history/trust state stays with its owners.
const $ = selector => document.querySelector(selector);
const mobileQuery = matchMedia('(max-width: 980px)');
const workspace = $('.workspace');
const panels = { controls: $('#mobile-controls-panel'), inspector: $('#mobile-inspector-panel') };
const desktopOpen = { controls: true, inspector: true };
let drawer = null;
let returnFocus = null;

function focus(element) {
  if (element instanceof HTMLElement && element.isConnected && !element.closest('[inert]')) element.focus({ preventScroll: true });
}

function sync() {
  const mobile = mobileQuery.matches;
  // Release background inertness before a closing drawer restores focus.
  $('.topbar').inert = mobile && drawer !== null;
  $('.map-stage').inert = mobile && drawer !== null;
  $('#skip-to-map')?.toggleAttribute('inert', mobile && drawer !== null);
  $('#mobile-drawer-backdrop').hidden = !(mobile && drawer);
  for (const [name, panel] of Object.entries(panels)) {
    const visible = mobile ? drawer === name : desktopOpen[name];
    panel.classList.toggle('mobile-open', mobile && visible);
    workspace.classList.toggle(`${name}-collapsed`, !mobile && !visible);
    panel.inert = !visible;
    if (visible) panel.removeAttribute('aria-hidden');
    else panel.setAttribute('aria-hidden', 'true');
    if (mobile && visible) {
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
    } else {
      panel.removeAttribute('role');
      panel.removeAttribute('aria-modal');
    }
    for (const layout of ['mobile', 'desktop']) {
      const trigger = $(`#${layout}-${name}-toggle`);
      const expanded = layout === 'mobile' ? mobile && visible : !mobile && visible;
      trigger?.setAttribute('aria-expanded', String(expanded));
      const label = `${expanded ? 'Hide' : 'Open'} ${name === 'controls' ? 'Atlas controls' : 'inspector'}`;
      trigger?.setAttribute('aria-label', label);
      trigger?.setAttribute('title', label);
    }
  }
}

function closeDrawer({ restore = true } = {}) {
  const wasOpen = drawer !== null;
  const target = returnFocus;
  drawer = null;
  returnFocus = null;
  sync();
  if (wasOpen && restore) focus(target);
}

function openPanel(name, { moveFocus = true } = {}) {
  if (mobileQuery.matches) {
    if (!drawer) returnFocus = document.activeElement;
    if (name === 'controls') $('#mobile-search-input').value = $('#search-input').value;
    drawer = name;
  } else desktopOpen[name] = true;
  sync();
  if (moveFocus) focus($(`#mobile-${name}-close`));
}

function togglePanel(name) {
  if (mobileQuery.matches) {
    if (drawer === name) closeDrawer();
    else openPanel(name);
  } else {
    desktopOpen[name] = !desktopOpen[name];
    sync();
  }
}

for (const name of Object.keys(panels)) {
  for (const layout of ['mobile', 'desktop']) $(`#${layout}-${name}-toggle`)?.addEventListener('click', () => togglePanel(name));
  $(`#mobile-${name}-close`)?.addEventListener('click', () => {
    if (mobileQuery.matches) closeDrawer();
    else {
      desktopOpen[name] = false;
      sync();
      focus($(`#desktop-${name}-toggle`));
    }
  });
}
$('#mobile-drawer-backdrop')?.addEventListener('click', () => closeDrawer());

function tabbable(panel) {
  return [...panel.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]') && element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden');
}

document.addEventListener('keydown', event => {
  if (!mobileQuery.matches || !drawer) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDrawer();
  } else if (event.key === 'Tab') {
    const items = tabbable(panels[drawer]);
    const first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); focus($(`#mobile-${drawer}-close`)); return; }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !items.includes(active))) { event.preventDefault(); focus(last); }
    else if (!event.shiftKey && (active === last || !items.includes(active))) { event.preventDefault(); focus(first); }
  }
});

$('#mobile-search-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#search-input'), form = $('#search-form'), mobileInput = $('#mobile-search-input');
  if (!input || !form || !mobileInput) return;
  input.value = mobileInput.value;
  form.requestSubmit();
  closeDrawer();
});

window.addEventListener('oteryn-atlas-open-inspector', () => openPanel('inspector', { moveFocus: mobileQuery.matches }));
$('#skip-to-map')?.addEventListener('click', () => focus($('#map-frame')));

// Keyboard/visual-viewport resizes must not dismiss search. Only a layout crossing
// ends the modal; desktop panel choices survive a mobile round trip.
mobileQuery.addEventListener('change', () => {
  const active = document.activeElement;
  const owner = Object.entries(panels).find(([, panel]) => panel.contains(active))?.[0];
  const priorDrawer = drawer;
  closeDrawer({ restore: false });
  if (mobileQuery.matches && owner) focus($(`#mobile-${owner}-toggle`));
  else if (!mobileQuery.matches && (priorDrawer || owner)) {
    const name = priorDrawer || owner;
    if (!desktopOpen[name]) focus($(`#desktop-${name}-toggle`));
  }
});

// The existing map and minimap subscribe to window resize. Panel/disclosure
// changes resize their container without resizing the window; notify that same
// seam after layout, without touching camera coordinates or renderer state.
let size = '', pendingFrame = null;
const frame = $('#map-frame');
if (frame) new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  const next = `${width}:${height}`;
  if (next === size || width <= 0 || height <= 0) return;
  size = next;
  if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(() => {
    pendingFrame = null;
    window.dispatchEvent(new Event('resize'));
  });
}).observe(frame);

sync();
document.documentElement.dataset.mobileUi = 'ready';
