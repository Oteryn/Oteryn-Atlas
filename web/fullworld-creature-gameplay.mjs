import { createCreatureGameplayView } from '../src/browser/creature-gameplay-model.mjs';
import { GAMEPLAY_EXPECTATIONS } from '../src/browser/creature-gameplay-profiles.mjs';

const SECTION_IDS = Object.freeze({
  sells: 'gameplay-section-sells',
  buys: 'gameplay-section-buys',
  services: 'gameplay-section-services',
  travel: 'gameplay-section-travel',
  locations: 'gameplay-section-locations',
  loot: 'gameplay-section-loot',
  stats: 'gameplay-section-stats',
  resistances: 'gameplay-section-resistances',
  spawns: 'gameplay-section-spawns',
});
const INITIAL_ROWS = 50;
const MAX_RENDERED_ROWS = 100;

function element(tag, className = null, text = null) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
}

function sectionNode(name, title) {
  const section = element('section', 'creature-gameplay-section');
  section.id = SECTION_IDS[name];
  section.dataset.gameplaySection = name;
  section.append(element('h4', null, title));
  return section;
}

function notice(section, text, kind = 'notice') {
  if (!text) return;
  section.append(element('p', `creature-gameplay-${kind}`, text));
}

function countLabel(value, singular, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`;
}

function appendLocationRows(section, rows, totalRows, noun) {
  if (totalRows === 0) {
    notice(section, `No ${noun} are currently loaded in the visible verified map region. This is not a global absence claim.`);
    return;
  }
  const list = element('div', 'creature-gameplay-list');
  for (const row of rows) {
    const position = row.position;
    list.append(element('div', 'creature-gameplay-row', `X ${position.x} · Y ${position.y} · F ${position.floor}`));
  }
  section.append(list);
  notice(section, `${countLabel(totalRows, noun)} currently loaded for this exact entity_id.`, 'meta');
}

function appendTradeRows(section, model) {
  if (model.notice) notice(section, model.notice);
  if (model.emptyCopy) { notice(section, model.emptyCopy, 'empty'); return; }
  const list = element('div', 'creature-gameplay-list');
  for (const row of model.rows) {
    const line = element('div', 'creature-gameplay-row creature-gameplay-trade-row');
    const label = row.clickable ? element('button', 'creature-gameplay-item-action', row.itemName) : element('span', 'creature-gameplay-item-name', row.itemName);
    if (row.clickable) {
      label.type = 'button';
      label.dataset.itemRef = row.itemRef;
      label.addEventListener('click', () => window.dispatchEvent(new CustomEvent('oteryn-atlas-item-select', { detail: { itemRef: row.itemRef } })));
    }
    const price = element('span', 'creature-gameplay-value', `${row.unitPrice.toLocaleString()} ${row.currency}`);
    line.append(label, price);
    if (row.amount != null) line.append(element('span', 'creature-gameplay-meta', `×${row.amount}`));
    list.append(line);
  }
  section.append(list);
  if (model.filteredRows > model.rows.length) notice(section, `${model.rows.length} of ${model.filteredRows.toLocaleString()} matching rows shown.`, 'meta');
}

function appendLootRows(section, model) {
  if (model.notice) notice(section, model.notice);
  if (model.emptyCopy) { notice(section, model.emptyCopy, 'empty'); return; }
  const list = element('div', 'creature-gameplay-list');
  for (const row of model.rows) {
    const line = element('div', 'creature-gameplay-row creature-gameplay-loot-row');
    const label = row.clickable ? element('button', 'creature-gameplay-item-action', row.itemName) : element('span', 'creature-gameplay-item-name', row.itemName);
    if (row.clickable) {
      label.type = 'button';
      label.dataset.itemRef = row.itemRef;
      label.addEventListener('click', () => window.dispatchEvent(new CustomEvent('oteryn-atlas-item-select', { detail: { itemRef: row.itemRef } })));
    }
    const count = row.minCount === row.maxCount ? `×${row.maxCount}` : `×${row.minCount}–${row.maxCount}`;
    line.append(label, element('span', 'creature-gameplay-value', row.chanceLabel), element('span', 'creature-gameplay-meta', count));
    list.append(line);
  }
  section.append(list);
  if (model.totalRows > model.rows.length) notice(section, `${model.rows.length} of ${model.totalRows.toLocaleString()} loot rows shown.`, 'meta');
}

function showMoreButton(controller, section, total, rendered) {
  if (total <= rendered) return;
  if (controller.rowLimit >= MAX_RENDERED_ROWS) {
    notice(section, 'Refine the search or sort to inspect additional rows without rendering the full list at once.', 'meta');
    return;
  }
  const button = element('button', 'creature-gameplay-more', 'Show more');
  button.type = 'button';
  button.addEventListener('click', () => {
    controller.rowLimit = Math.min(MAX_RENDERED_ROWS, controller.rowLimit + INITIAL_ROWS);
    controller.renderCurrent();
  });
  section.append(button);
}

function renderNpc(controller, view) {
  const controls = element('div', 'creature-gameplay-controls');
  if (view.sections.sells.totalRows > INITIAL_ROWS || view.sections.buys.totalRows > INITIAL_ROWS) {
    const search = element('input', 'creature-gameplay-search');
    search.type = 'search';
    search.placeholder = 'Filter shop items';
    search.setAttribute('aria-label', 'Filter NPC shop items');
    search.value = controller.shopQuery;
    search.addEventListener('input', (event) => { controller.shopQuery = event.target.value; controller.rowLimit = INITIAL_ROWS; controller.renderCurrent(); });
    controls.append(search);
  }
  if (controls.childNodes.length) controller.panel.append(controls);

  const sells = sectionNode('sells', 'Sells');
  appendTradeRows(sells, view.sections.sells);
  showMoreButton(controller, sells, view.sections.sells.filteredRows, view.sections.sells.rows.length);
  controller.panel.append(sells);

  const buys = sectionNode('buys', 'Buys');
  appendTradeRows(buys, view.sections.buys);
  showMoreButton(controller, buys, view.sections.buys.filteredRows, view.sections.buys.rows.length);
  controller.panel.append(buys);

  const services = sectionNode('services', 'Services');
  if (view.sections.services.notice) notice(services, view.sections.services.notice);
  if (view.sections.services.emptyCopy) notice(services, view.sections.services.emptyCopy, 'empty');
  if (view.sections.services.values.length) {
    const values = element('div', 'creature-gameplay-tags');
    for (const value of view.sections.services.values) values.append(element('span', 'creature-gameplay-tag', value));
    services.append(values);
  }
  controller.panel.append(services);

  const travel = sectionNode('travel', 'Travel');
  if (view.sections.travel.notice) notice(travel, view.sections.travel.notice);
  if (view.sections.travel.emptyCopy) notice(travel, view.sections.travel.emptyCopy, 'empty');
  for (const row of view.sections.travel.rows) {
    const position = row.position ? ` · X ${row.position.x} Y ${row.position.y} F ${row.position.floor}` : '';
    const price = row.price != null ? ` · ${row.price.toLocaleString()} ${row.currency ?? 'gold'}` : '';
    travel.append(element('div', 'creature-gameplay-row', `${row.label}${position}${price}`));
  }
  controller.panel.append(travel);

  const locations = sectionNode('locations', 'Locations');
  appendLocationRows(locations, view.sections.locations.rows, view.sections.locations.totalRows, 'visible verified location');
  controller.panel.append(locations);
}

function renderMonster(controller, view) {
  const controls = element('div', 'creature-gameplay-controls');
  const label = element('label', 'creature-gameplay-sort-label', 'Loot order ');
  const select = element('select', 'creature-gameplay-sort');
  select.setAttribute('aria-label', 'Sort monster loot');
  for (const [value, text] of [['source', 'Game source order'], ['chance', 'Chance'], ['name', 'Name']]) {
    const option = element('option', null, text); option.value = value; option.selected = controller.lootSort === value; select.append(option);
  }
  select.addEventListener('change', (event) => { controller.lootSort = event.target.value; controller.rowLimit = INITIAL_ROWS; controller.renderCurrent(); });
  label.append(select); controls.append(label); controller.panel.append(controls);

  const loot = sectionNode('loot', 'Loot');
  appendLootRows(loot, view.sections.loot);
  showMoreButton(controller, loot, view.sections.loot.totalRows, view.sections.loot.rows.length);
  controller.panel.append(loot);

  const stats = sectionNode('stats', 'Stats');
  if (view.sections.stats.notice) notice(stats, view.sections.stats.notice);
  const facts = element('dl', 'creature-gameplay-facts');
  const labels = { health: 'Health', experience: 'Experience', armor: 'Armor', defense: 'Defense', speed: 'Speed' };
  for (const key of Object.keys(labels)) {
    const dt = element('dt', null, labels[key]);
    const value = view.sections.stats.values[key];
    const dd = element('dd', null, value == null ? 'Not published' : value.toLocaleString());
    facts.append(dt, dd);
  }
  stats.append(facts); controller.panel.append(stats);

  const resistances = sectionNode('resistances', 'Resistances / Immunities');
  if (view.sections.resistances.notice) notice(resistances, view.sections.resistances.notice);
  if (view.sections.resistances.elements.length) {
    const list = element('div', 'creature-gameplay-list');
    for (const row of view.sections.resistances.elements) {
      const sign = row.percent >= 0 ? '+' : '';
      list.append(element('div', 'creature-gameplay-row', `${row.type} · ${sign}${row.percent}%`));
    }
    resistances.append(list);
  }
  if (view.sections.resistances.immunities.length) notice(resistances, `Immunities: ${view.sections.resistances.immunities.join(', ')}`, 'meta');
  controller.panel.append(resistances);

  const spawns = sectionNode('spawns', 'Spawns');
  appendLocationRows(spawns, view.sections.spawns.rows, view.sections.spawns.totalRows, 'visible verified spawn');
  controller.panel.append(spawns);
}

function renderProfileHeader(controller, record, manifestDigest) {
  const header = element('div', 'creature-gameplay-header');
  const title = element('h3', null, record.name);
  const kind = element('p', 'creature-gameplay-kind', record.kind === 'npc' ? 'NPC Gameplay' : 'Monster Gameplay');
  const provenance = element('p', 'creature-gameplay-provenance', `Game ${GAMEPLAY_EXPECTATIONS.gameSha.slice(0, 12)} · ${manifestDigest.slice(0, 19)}…`);
  header.append(title, kind, provenance);
  controller.panel.append(header);
}

export function createCreatureGameplayInspectorController({ panel, baseInspector, tabs, profileService, getPlacements, onSelectTab, renderSemantic }) {
  if (!panel || !baseInspector || !tabs?.gameplay || !tabs?.semantic || !tabs?.live || !profileService) throw new TypeError('creature gameplay inspector dependencies missing');
  const controller = {
    panel, baseInspector, tabs, profileService, getPlacements, onSelectTab, renderSemantic,
    record: null, profile: null, tab: 'gameplay', renderToken: 0,
    rowLimit: INITIAL_ROWS, shopQuery: '', lootSort: 'source', profileStatus: 'idle', manifestDigest: null,
    bind() {
      for (const [tab, button] of Object.entries(this.tabs)) {
        button.addEventListener('click', () => {
          if (button.disabled) return;
          this.onSelectTab?.(tab);
        });
      }
    },
    updateTabs(tab, hasCreature) {
      for (const [name, button] of Object.entries(this.tabs)) {
        const active = hasCreature ? name === tab : name === 'semantic';
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        button.classList.toggle('active', active);
        if (name === 'gameplay') button.disabled = !hasCreature;
        if (name === 'live') button.disabled = true;
      }
    },
    async render(record, tab = 'gameplay') {
      const token = ++this.renderToken;
      this.record = record ?? null;
      this.tab = record ? (tab === 'semantic' ? 'semantic' : 'gameplay') : 'semantic';
      this.updateTabs(this.tab, Boolean(record));
      if (!record) {
        this.panel.hidden = true;
        this.panel.textContent = '';
        this.baseInspector.hidden = false;
        this.profileStatus = 'idle';
        return;
      }
      this.baseInspector.hidden = true;
      this.panel.hidden = false;
      this.panel.textContent = '';
      if (this.tab === 'semantic') {
        this.profileStatus = 'semantic';
        this.renderSemantic?.(this.panel, record);
        return;
      }
      if (!record.entity_id) {
        this.profileStatus = 'unavailable';
        this.panel.append(element('h3', null, record.name));
        notice(this.panel, 'Gameplay profile not published by Game for this unresolved creature identity.');
        return;
      }
      this.profileStatus = 'loading';
      this.panel.append(element('h3', null, record.name), element('p', 'creature-gameplay-loading', 'Loading verified Game gameplay profile…'));
      const result = await this.profileService.get(record.entity_id);
      if (token !== this.renderToken || this.record?.record_id !== record.record_id || this.tab !== 'gameplay') return;
      this.panel.textContent = '';
      if (result.status !== 'ready') {
        this.profileStatus = result.status;
        this.panel.append(element('h3', null, record.name));
        const message = result.status === 'unavailable' || result.reason === 'profile-not-published'
          ? 'Gameplay profile not published by Game for this creature.'
          : `Gameplay profile unavailable: ${result.reason}`;
        notice(this.panel, message);
        return;
      }
      this.profile = result.profile;
      this.manifestDigest = result.manifestDigest;
      this.profileStatus = 'ready';
      this.renderCurrent();
    },
    renderCurrent() {
      if (!this.record || !this.profile || this.tab !== 'gameplay') return;
      this.panel.textContent = '';
      renderProfileHeader(this, this.record, this.manifestDigest);
      const placements = this.getPlacements?.(this.record.entity_id) ?? [];
      const view = createCreatureGameplayView(this.profile, placements, { rowLimit: this.rowLimit, shopQuery: this.shopQuery, lootSort: this.lootSort });
      if (view.kind === 'npc') renderNpc(this, view);
      else renderMonster(this, view);
    },
    async gameplaySummary(record) {
      if (!record?.entity_id) return null;
      const result = await this.profileService.get(record.entity_id);
      if (result.status !== 'ready') return null;
      const profile = result.profile;
      if (profile.kind === 'npc') {
        const sells = profile.shop?.sells?.length ?? 0;
        const buys = profile.shop?.buys?.length ?? 0;
        if (!sells && !buys && profile.shop?.state !== 'COMPLETE') return null;
        return `Shop · ${sells.toLocaleString()} sells · ${buys.toLocaleString()} buys`;
      }
      const loot = profile.loot?.entries?.length ?? 0;
      if (!loot && profile.loot?.state !== 'COMPLETE') return null;
      return `Loot · ${loot.toLocaleString()} entries`;
    },
    stats() {
      return Object.freeze({ tab: this.tab, profileStatus: this.profileStatus, manifestDigest: this.manifestDigest, cache: this.profileService.stats() });
    },
  };
  controller.bind();
  return controller;
}