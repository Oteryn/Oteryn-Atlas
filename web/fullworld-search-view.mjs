/** Presentation only: the owner supplies verified records, ranking and navigation. */
const SVG = 'http://www.w3.org/2000/svg';
const ICONS = new Set(['search', 'pin', 'npc', 'monster', 'town', 'waypoint']);

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function entityIcon(kind) {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'atlas-icon');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG, 'use');
  use.setAttribute('href', `#atlas-icon-${ICONS.has(kind) ? kind : 'pin'}`);
  svg.append(use);
  return svg;
}

/** A single editable combobox; active option is view state, never world state. */
export function createSearchView({ form, input, id, describe, onQuery, onChoose, onClose = () => {} }) {
  const host = element('div', 'semantic-search-results');
  host.id = `semantic-search-results-${id}`;
  host.hidden = true;
  const status = element('div', 'search-status');
  status.id = `${host.id}-status`;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const list = element('div', 'search-options');
  list.id = `${host.id}-list`;
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Published world search results');
  const message = element('div', 'search-message');
  const hint = element('div', 'search-keyboard-hint', 'Arrow keys to browse · Enter to choose · Esc to close');
  hint.setAttribute('aria-hidden', 'true');
  host.append(status, list, message, hint);
  form.append(host);
  input.placeholder = id === 'mobile' ? 'Search Atlas' : 'Search places, creatures or coordinates';
  input.setAttribute('aria-label', 'Global semantic Atlas search');
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', list.id);
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-describedby', status.id);
  let records = [], query = '', active = -1, composing = false;

  function setActive(index, scroll = false) {
    active = index;
    for (const [i, option] of [...list.children].entries()) option.setAttribute('aria-selected', String(i === active));
    const option = list.children[active];
    if (option) {
      input.setAttribute('aria-activedescendant', option.id);
      if (scroll) option.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function close() {
    const wasOpen = !host.hidden;
    host.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-busy');
    records = [];
    list.replaceChildren();
    setActive(-1);
    if (wasOpen) onClose();
  }

  function choose(index) {
    const record = records[index];
    if (!record) return;
    const selectedQuery = query;
    close();
    onChoose(record, selectedQuery);
  }

  function show({ phase, query: nextQuery = '', results = [], detail = '' }) {
    query = nextQuery;
    records = phase === 'results' ? results : [];
    list.replaceChildren();
    message.replaceChildren();
    host.dataset.state = phase;
    input.setAttribute('aria-busy', String(phase === 'loading'));
    setActive(-1);
    const messages = {
      idle: ['Find your next destination', 'Search a place, NPC, monster, public ID or coordinates.'],
      loading: ['Loading search', 'Checking published world information…'],
      empty: ['No published semantic result.', 'No matching published places or creatures. Try a different name or a public ID. Missing world data is never guessed.'],
      invalid: ['Check your search', detail],
      unavailable: ['Search unavailable', 'Verified search data could not be loaded. Map controls remain available.'],
    };
    if (phase === 'results') {
      status.textContent = `${records.length} ${records.length === 1 ? 'result' : 'results'} shown`;
      for (const [index, record] of records.entries()) {
        const { type, position } = describe(record);
        const option = element('button', 'semantic-search-result');
        option.type = 'button';
        option.tabIndex = -1;
        option.id = `${list.id}-${index}`;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        const identity = element('span', 'search-result-icon');
        identity.append(entityIcon(record.kind));
        const copy = element('span', 'search-result-copy');
        copy.append(element('strong', '', record.label), element('small', '', position));
        option.append(identity, copy, element('span', 'kind', type));
        // Keep the editable input focused on mouse selection; touch remains native.
        option.addEventListener('mousedown', event => event.preventDefault());
        option.addEventListener('click', () => choose(index));
        list.append(option);
      }
    } else {
      const [title, body] = messages[phase] || messages.unavailable;
      status.textContent = title;
      message.append(element('p', '', body));
      if (phase === 'idle') message.append(element('p', 'search-coordinate-hint', 'Coordinates: X, Y, floor'));
      if (phase === 'unavailable' && detail) {
        const details = element('details', 'search-error-details');
        details.append(element('summary', '', 'Technical reason'), element('p', '', detail));
        message.append(details);
      }
    }
    message.hidden = phase === 'results';
    hint.hidden = phase !== 'results';
    host.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  const request = () => { if (!composing) onQuery(input.value); };
  input.addEventListener('input', request);
  input.addEventListener('focus', request);
  input.addEventListener('compositionstart', () => { composing = true; });
  input.addEventListener('compositionend', () => { composing = false; request(); });
  form.addEventListener('submit', event => {
    if (composing) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  form.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || host.hidden || composing || event.isComposing) return;
    const restoreInputFocus = host.contains(document.activeElement);
    event.preventDefault();
    event.stopPropagation(); // First Escape dismisses results, not the containing drawer/panels.
    close();
    if (restoreInputFocus) input.focus({ preventScroll: true });
  });
  input.addEventListener('keydown', event => {
    if (composing || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { setActive(-1); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (host.hidden) request();
      if (host.hidden || !records.length) return;
      event.preventDefault();
      const next = event.key === 'ArrowDown'
        ? Math.min(active + 1, records.length - 1)
        : active < 0 ? records.length - 1 : Math.max(0, active - 1);
      setActive(next, true);
    } else if (event.key === 'Enter' && active >= 0 && !host.hidden) {
      event.preventDefault();
      event.stopImmediatePropagation();
      choose(active);
    }
  });
  const outside = event => { if (!form.contains(event.target)) close(); };
  document.addEventListener('pointerdown', outside);
  form.addEventListener('focusout', () => queueMicrotask(() => {
    if (!form.contains(document.activeElement)) close();
  }));

  return {
    show, close,
    refresh() { if (!host.hidden && !form.closest('[inert]')) request(); },
  };
}


// Responsive view bridge: both search inputs represent one query. On a breakpoint
// crossing, copy from the input that was visible before the crossing. Fatal
// Inspector details are re-exposed through the existing presentation event.
const responsiveQuery = matchMedia('(max-width: 980px)');
function syncResponsiveQuery(mobile) {
  const source = document.querySelector(mobile ? '#search-input' : '#mobile-search-input');
  const target = document.querySelector(mobile ? '#mobile-search-input' : '#search-input');
  if (source && target) target.value = source.value;
  return target;
}
responsiveQuery.addEventListener('change', () => {
  const target = syncResponsiveQuery(responsiveQuery.matches);
  if (!responsiveQuery.matches && target) {
    const desktopHost = document.querySelector('#semantic-search-results-desktop');
    if (document.activeElement === target || (desktopHost && !desktopHost.hidden)) {
      target.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  if (!responsiveQuery.matches && document.querySelector('#inspector-content .error-box')) {
    window.dispatchEvent(new CustomEvent('oteryn-atlas-open-inspector'));
  }
});

/** The same identity hierarchy as a search result, with provenance disclosed on demand. */
export function renderEntitySummary({ host, record, type, position, source }) {
  const key = record.record_id || record.id || '';
  const previous = host.querySelector('.entity-details');
  // Repeated view notifications must not reset an open disclosure or keyboard focus.
  if (previous?.dataset.recordId === key && previous.dataset.source === source) return;
  const article = element('article', 'entity-details');
  article.dataset.recordId = key;
  article.dataset.source = source;
  const header = element('header', 'entity-heading');
  const identity = element('span', 'entity-emblem');
  identity.append(entityIcon(record.kind));
  const copy = element('div', 'entity-heading-copy');
  copy.append(element('span', 'entity-kind', type), element('h3', '', record.label));
  header.append(identity, copy);
  const location = element('section', 'entity-location');
  location.append(element('h4', '', 'Map position'), element('p', 'entity-coordinates', position));
  const provenance = element('details', 'entity-provenance');
  provenance.append(element('summary', '', 'Source & technical details'));
  const facts = element('dl', 'entity-facts');
  const entries = [
    ['Source', source],
    ['Stable public id', record.id || 'Not published'],
    ...(record.record_id && record.record_id !== record.id ? [['Placement ID', record.record_id]] : []),
    ['Native floor', String(record.position.floor)],
    ['Public capabilities', record.capabilities?.length ? record.capabilities.join(', ') : 'None published'],
    ['Bounds', record.bounds ? 'Published by Oteryn-Game' : 'Not published by Oteryn-Game'],
  ];
  for (const [name, value] of entries) facts.append(element('dt', '', name), element('dd', '', value));
  provenance.append(facts);
  article.append(header, location, provenance);
  host.replaceChildren(article);
}
