'use strict';

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  chars: [],
  char: null,          // currently loaded character
  view: 'list',
  layout: 'landscape', // 'landscape' | 'portrait'
  refTable: 'weapons',
  refData: {},
  refClassFilter: false,     // reference drawer: show only class-available items
  refSpellCaster: 'all',     // reference drawer: spell caster chip (All/Wizard/Priest/Witch)
  refSpellAligns: new Set(), // reference drawer: alignment chips (multi-select)
  refSort: { col: null, asc: true }, // reference drawer: column sort state
  binMode: false,            // character list: delete-management mode
  chars: [],                 // cached character list
  saveTimer: null,
  saving: false,
  sortable: null,
  panelLocks: {},           // panelId -> bool (true = locked / view-only)
  spellcastingAbility: null, // 'int' | 'wis' | 'cha' | null
  pendingMishap: false,      // true while a wizard/witch fumble awaits a d12 roll
  finesseWeapons: {},       // weaponName -> 'str' | 'dex' (populated by autoComputeAttacks)
  _statBases:  {},          // field -> base score (before bonuses)
  _hpMaxBase:  0,           // base hp_max (before bonuses)
};

// ── API ────────────────────────────────────────────────────────────────────
// Helper: fetch + parse JSON, returning a sentinel for 401 (not signed in)
async function _apiFetch(url, opts) {
  const r = await fetch(url, opts);
  if (r.status === 401) return { __auth: false };
  return r.json();
}

const API = {
  list:   ()      => _apiFetch('/api/characters').then(r => Array.isArray(r) ? r : []),
  create: ()      => _apiFetch('/api/characters', {method:'POST'}),
  get:    id      => _apiFetch(`/api/characters/${id}`),
  save:   (id, d) => fetch(`/api/characters/${id}`, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(d)
  }).then(r => r.json()),
  del:    id      => fetch(`/api/characters/${id}`, {method:'DELETE'}).then(r => r.json()),
  listDeleted: () => fetch('/api/characters/deleted').then(r => r.json()),
  restore: id    => fetch(`/api/characters/${id}/restore`, {method:'POST'}).then(r => r.json()),
  permDel: id    => fetch(`/api/characters/${id}/permanent`, {method:'DELETE'}).then(r => r.json()),
  data:   tbl     => fetch(`/api/data/${tbl}`).then(r => r.json()),
};

// ── Utilities ──────────────────────────────────────────────────────────────
const mod = s => Math.floor((s - 10) / 2);
const modStr = m => m >= 0 ? `+${m}` : `${m}`;
const $ = id => document.getElementById(id);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ── View switching ─────────────────────────────────────────────────────────
function showList() {
  state.view = 'list';
  $('view-list').classList.add('active');
  $('view-sheet').classList.remove('active');
  $('btn-reference').hidden = true;
  $('btn-stable').hidden    = true;
  // On the list, the trash button acts as the bin (delete-management) toggle
  $('btn-delete-char').hidden = false;
  $('btn-delete-char').title  = 'Delete characters';
  closeStable();
  $('save-indicator').textContent = '';
  state.char = null;
  // Reset delete-management mode whenever we return to the list
  state.binMode = false;
  $('btn-delete-char')?.classList.remove('active');
  if ($('btn-recently-deleted')) $('btn-recently-deleted').hidden = true;
  loadList();
}

function showSheet(id) {
  API.get(id).then(char => {
    // Not signed in (or character not owned by current user) → bail to list + prompt sign-in
    if (!char || char.__auth === false || char.error) {
      showList();
      if (char?.__auth === false) window.__openAuthModal?.('signin');
      return;
    }
    state.char = char;
    state.view = 'sheet';
    $('view-list').classList.remove('active');
    $('view-sheet').classList.add('active');
    $('btn-reference').hidden = false;
    $('btn-stable').hidden    = false;
    $('btn-delete-char').hidden = false;
    // On the sheet the trash button deletes the open character (not bin-toggle)
    $('btn-delete-char').title = 'Delete character';
    $('btn-delete-char').classList.remove('active');
    state.binMode = false;
    if ($('btn-recently-deleted')) $('btn-recently-deleted').hidden = true;
    renderSheet(char);
    autoLayout();
    initSortable();
    refreshAbilityButtons();
    if (dice.activeAbility) setAbilityMod(dice.activeAbility);
  });
}

// ── List view ──────────────────────────────────────────────────────────────
function loadList() {
  API.list().then(chars => {
    state.chars = chars;
    renderList(chars);
  });
}

function renderList(chars) {
  const container = $('character-cards');
  container.innerHTML = '';
  container.classList.toggle('bin-mode', !!state.binMode);
  if (!chars.length) {
    container.innerHTML = '<div class="no-chars">No characters yet.<br>Click <strong>+ New Character</strong> to begin.</div>';
    return;
  }
  chars.forEach(c => {
    const card = el('div', 'char-card');
    card.innerHTML = `
      <div class="char-card-name">${escHtml(c.name)}</div>
      <div class="char-card-sub">
        ${escHtml(c.class_name || '—')} · ${escHtml(c.ancestry || '—')} · Level ${c.level}
      </div>
      <div class="char-card-hp">HP <span>${c.hp_current}/${c.hp_max}</span></div>`;
    if (state.binMode) {
      card.classList.add('char-card-binmode');
      const x = el('button', 'char-card-del', '✕');
      x.type = 'button';
      x.title = 'Delete character';
      x.onclick = e => { e.stopPropagation(); softDeleteChar(c.id, c.name); };
      card.appendChild(x);
      // In bin mode the card itself doesn't open the sheet
    } else {
      card.onclick = () => showSheet(c.id);
    }
    container.appendChild(card);
  });
}

// ── Delete-management (bin) mode + recovery ─────────────────────────────────
function toggleBinMode(on) {
  state.binMode = (on === undefined) ? !state.binMode : !!on;
  $('btn-delete-char')?.classList.toggle('active', state.binMode);
  const rd = $('btn-recently-deleted');
  if (rd) rd.hidden = !state.binMode;
  renderList(state.chars || []);
}

function softDeleteChar(id, name) {
  API.del(id).then(() => {
    state.chars = (state.chars || []).filter(c => c.id !== id);
    renderList(state.chars);
    toast(`"${name || 'Character'}" moved to Recently Deleted — recoverable for 7 days.`);
  });
}

function openRecover() {
  $('recover-overlay').hidden = false;
  renderRecoverList();
}
function closeRecover() { $('recover-overlay').hidden = true; }

function renderRecoverList() {
  const list = $('recover-list');
  if (!list) return;
  list.innerHTML = '<div class="recover-empty">Loading…</div>';
  API.listDeleted().then(rows => {
    if (!rows.length) {
      list.innerHTML = '<div class="recover-empty">No recently deleted characters.</div>';
      return;
    }
    list.innerHTML = '';
    rows.forEach(c => {
      const daysLeft = c.seconds_left != null ? Math.max(0, Math.ceil(c.seconds_left / 86400)) : null;
      const row = el('div', 'recover-item');
      const info = el('div', 'recover-info');
      info.innerHTML = `
        <div class="recover-name">${escHtml(c.name)}</div>
        <div class="recover-meta">${escHtml(c.class_name || '—')} · ${escHtml(c.ancestry || '—')} · Lvl ${c.level}${
          daysLeft != null ? ` · <span class="recover-days">${daysLeft} day${daysLeft === 1 ? '' : 's'} left</span>` : ''
        }</div>`;
      const actions = el('div', 'recover-actions');
      const restore = el('button', 'recover-restore', 'Restore');
      restore.type = 'button';
      restore.onclick = () => restoreChar(c.id);
      const perm = el('button', 'recover-perm', 'Delete now');
      perm.type = 'button';
      perm.onclick = () => permDeleteChar(c.id, c.name);
      actions.append(restore, perm);
      row.append(info, actions);
      list.appendChild(row);
    });
  });
}

function restoreChar(id) {
  API.restore(id).then(() => {
    toast('Character restored.');
    renderRecoverList();
    API.list().then(chars => { state.chars = chars; renderList(chars); });
  });
}

function permDeleteChar(id, name) {
  if (!confirm(`Permanently delete "${name || 'this character'}"?\n\nThis cannot be undone.`)) return;
  API.permDel(id).then(() => { toast('Permanently deleted.'); renderRecoverList(); });
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Expanded header (existing characters) ─────────────────────────────────

/** Toggle between default (new char) and expanded (existing char) header. */
function activateExpandedHeader(expanded, char) {
  const dflt = $('sf-default');
  const exp  = $('sf-expanded');
  const idPanel = document.querySelector('[data-panel="identity"]');
  const pc = $('panels-container');
  if (!dflt || !exp) return;

  if (expanded) {
    /* Existing character: hide identity panel, use classic abilities+combat layout */
    dflt.hidden = true;
    exp.hidden  = false;
    if (idPanel) idPanel.hidden = true;
    if (pc) pc.classList.add('layout-classic');
    syncExpandedHeader(char);
  } else {
    /* New character: show identity panel in the creation layout */
    dflt.hidden = false;
    exp.hidden  = true;
    if (idPanel) idPanel.hidden = false;
    if (pc) pc.classList.remove('layout-classic');
  }
}

/** Sync expanded header fields from DOM inputs (live) or char data (fallback). */
function syncExpandedHeader(charOrNull) {
  const c = charOrNull || state.char;
  if (!c) return;

  // Name — prefer DOM (user may have typed a new name)
  const nameInp = document.querySelector('[data-field="name"]');
  const nameEl = $('sfx-name');
  if (nameEl) nameEl.textContent = nameInp?.value || c.name || 'Unnamed';

  // Portrait — use identity panel portrait as source of truth
  const srcImg = $('portrait-img');
  const pImg   = $('sfx-portrait-img');
  const pPH    = document.querySelector('.sfx-portrait-placeholder');
  const portrait = (srcImg && !srcImg.hidden) ? srcImg.src : (c.portrait || '');
  if (pImg && portrait) {
    pImg.src = portrait;
    pImg.hidden = false;
    if (pPH) pPH.hidden = true;
  } else if (pImg) {
    pImg.hidden = true;
    if (pPH) pPH.hidden = false;
  }

  // Race + Class — DOM dropdowns are live
  const race = $('race-select')?.value  || c.ancestry   || '';
  const cls  = $('class-select')?.value || c.class_name || '';
  if ($('sfx-race'))  $('sfx-race').textContent  = race;
  if ($('sfx-class')) $('sfx-class').textContent = cls;

  // Alignment shorthand — (L) Lawful, (C) Chaotic, (N) Neutral
  const align = document.querySelector('.align-btn.active')?.dataset?.align || c.alignment || 'Neutral';
  const alignTag = $('sfx-align-tag');
  if (alignTag) {
    const shortMap = { 'Lawful': '(L)', 'Chaotic': '(C)', 'Neutral': '(N)' };
    alignTag.textContent = shortMap[align] || `(${align.charAt(0).toUpperCase()})`;
  }

  // Level + Title — on same row
  const lvl = parseInt(document.querySelector('[data-field="level"]')?.value) || c.level || 1;
  if ($('sfx-level')) $('sfx-level').textContent = `Level ${lvl}`;

  const title = document.querySelector('[data-field="title"]')?.value || c.title || '';
  if ($('sfx-title')) $('sfx-title').textContent = title ? `(${title})` : '';

  // Background + Deity tags
  const bg = document.querySelector('[data-field="background"]')?.value || c.background || '';
  const deity = document.querySelector('[data-field="deity"]')?.value || c.deity || '';
  if ($('sfx-bg-tag'))    $('sfx-bg-tag').textContent    = bg ? `📜 ${bg}` : '';
  if ($('sfx-deity-tag')) $('sfx-deity-tag').textContent  = deity ? `⛩ ${deity}` : '';
}

/** Toggle the identity slide panel below the expanded header.
 *  For new characters the identity is always visible, so just scroll to it.
 *  For existing characters, slide it open/closed from the header manage button. */
function toggleIdentitySlide() {
  const slide    = $('sfx-identity-slide');
  const backdrop = $('sfx-slide-backdrop');
  const idPanel  = document.querySelector('[data-panel="identity"]');
  if (!slide) return;

  /* New character — identity lives in the main layout (no classic mode),
     so there's no slide to toggle; just scroll to it.
     (Don't test idPanel.hidden — when the slide is open it's false, which
      would wrongly skip the close path and leave the slide stuck open.) */
  const pc = $('panels-container');
  const isClassic = pc && pc.classList.contains('layout-classic');
  if (!isClassic) {
    idPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const isOpen = slide.classList.contains('open');
  if (backdrop) backdrop.classList.toggle('active', !isOpen);
  if (isOpen) {
    /* ── Close ─────────────────────────────────────────────────────── */
    slide.style.maxHeight = slide.scrollHeight + 'px';
    void slide.offsetHeight;
    slide.style.transition = 'max-height .3s ease, padding .3s ease';
    slide.style.maxHeight  = '0';
    slide.style.padding    = '0 1.2rem';
    slide.classList.remove('open');
    const onEnd = () => {
      slide.removeEventListener('transitionend', onEnd);
      slide.style.transition = '';
      slide.style.maxHeight  = '';
      slide.style.padding    = '';
      if (idPanel && slide.contains(idPanel)) {
        const container = $('panels-container');
        if (container) container.prepend(idPanel);
        idPanel.hidden = true;
      }
    };
    slide.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 400);
  } else {
    /* ── Open ──────────────────────────────────────────────────────── */
    if (idPanel) {
      slide.appendChild(idPanel);
      idPanel.hidden = false;
    }
    slide.style.maxHeight  = '0';
    slide.style.padding    = '0 1.2rem';
    slide.style.overflow   = 'hidden';
    void slide.offsetHeight;
    const targetH = slide.scrollHeight;
    slide.style.transition = 'max-height .3s ease, padding .3s ease';
    slide.style.maxHeight  = targetH + 'px';
    slide.style.padding    = '.8rem 1.2rem';
    slide.classList.add('open');
    const onEnd = () => {
      slide.removeEventListener('transitionend', onEnd);
      slide.style.transition = '';
      slide.style.maxHeight  = '';
      slide.style.padding    = '';
      slide.style.overflow   = '';
    };
    slide.addEventListener('transitionend', onEnd);
    setTimeout(onEnd, 400);
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  // Show all panes momentarily to measure the tallest one
  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(p => { p.style.display = 'block'; p.style.visibility = 'hidden'; p.style.position = 'absolute'; });
  let maxH = 0;
  panes.forEach(p => { if (p.scrollHeight > maxH) maxH = p.scrollHeight; });
  // Reset and apply uniform min-height
  panes.forEach(p => { p.style.display = ''; p.style.visibility = ''; p.style.position = ''; p.hidden = true; p.style.minHeight = maxH + 'px'; });

  const pane = $('tab-' + tabName);
  if (pane) pane.hidden = false;
}

// ── Header hover cards (background, deity) ────────────────────────────────
function initDetailTagHovers() {
  const bgTag    = $('sfx-bg-tag');
  const deityTag = $('sfx-deity-tag');
  const card     = $('sfx-hover-card');
  if (!card) return;

  [bgTag, deityTag].forEach(tag => {
    if (!tag) return;
    // Desktop: hover
    tag.addEventListener('mouseenter', e => showDetailHoverCard(e.currentTarget));
    tag.addEventListener('mouseleave', () => { card.hidden = true; });

    // Mobile: long-press to peek
    let lpTimer = null;
    tag.addEventListener('touchstart', e => {
      lpTimer = setTimeout(() => {
        e.preventDefault();
        showDetailHoverCard(tag);
      }, 350);
    }, { passive: false });
    tag.addEventListener('touchend',    () => { clearTimeout(lpTimer); card.hidden = true; });
    tag.addEventListener('touchcancel', () => { clearTimeout(lpTimer); card.hidden = true; });
    tag.addEventListener('touchmove',   () => { clearTimeout(lpTimer); });
  });
}

function showDetailHoverCard(tag) {
  const card = $('sfx-hover-card');
  if (!card) return;
  const which = tag.dataset.hover;
  let title = '', desc = '';

  if (which === 'bg') {
    const bgName = document.querySelector('[data-field="background"]')?.value || '';
    const bgData = (state.refData.backgrounds || []).find(b => b.background === bgName);
    title = bgName;
    desc  = bgData?.description || '';
  } else if (which === 'deity') {
    title = document.querySelector('[data-field="deity"]')?.value || '';
    const godData = (state.refData.gods || []).find(g => g.name === title);
    desc  = godData ? (godData.title || '') : '';
  }

  if (!title) { card.hidden = true; return; }
  card.innerHTML = `<div class="hc-title">${escHtml(title)}</div>` +
                   (desc ? `<div class="hc-desc">${escHtml(desc)}</div>` : '');
  const rect = tag.getBoundingClientRect();
  card.style.left = rect.left + 'px';
  card.style.top  = (rect.bottom + 4) + 'px';
  card.hidden = false;
}

// ── Languages (Features tab) ──────────────────────────────────────────────

/** Parse class features for language grants. Returns { common: N, rare: N } */
function _parseClassLanguageGrants() {
  if (!state.refData.classes) return { common: 0, rare: 0 };
  const className = $('class-select')?.value || '';
  const cls = (state.refData.classes || []).find(c => c.class === className);
  if (!cls?.features) return { common: 0, rare: 0 };

  let common = 0, rare = 0;
  for (const feat of cls.features) {
    const d = (feat.description || '').toLowerCase();
    // "two additional common languages and two rare languages"
    const numWord = { one:1, two:2, three:3, four:4, five:5, six:6 };
    const mCommon = d.match(/(\w+)\s+(?:additional\s+)?common\s+language/i);
    const mRare   = d.match(/(\w+)\s+(?:additional\s+)?rare\s+language/i);
    if (mCommon) common += numWord[mCommon[1].toLowerCase()] || parseInt(mCommon[1]) || 0;
    if (mRare)   rare   += numWord[mRare[1].toLowerCase()]   || parseInt(mRare[1])   || 0;
  }
  return { common, rare };
}

async function renderLanguages() {
  const ul = $('lang-list');
  if (!ul) return;
  ul.innerHTML = '';

  // Ensure reference data is loaded
  if (!state.refData.races) state.refData.races = await API.data('races');
  if (!state.refData.classes) state.refData.classes = await API.data('classes');
  const raceName = $('race-select')?.value || '';
  const raceData = (state.refData.races || []).find(r => r.race === raceName);
  const autoLangs = [];
  if (raceData?.languages) {
    const langs = Array.isArray(raceData.languages) ? raceData.languages : String(raceData.languages).split(/,\s*/);
    langs.forEach(l => {
      if (typeof l === 'string' && l.trim()) autoLangs.push({ name: l.trim(), source: raceName });
    });
  }
  // Common is always known
  if (!autoLangs.find(l => l.name === 'Common')) {
    autoLangs.unshift({ name: 'Common', source: 'All' });
  }

  // Render auto languages (not removable)
  autoLangs.forEach(l => {
    const li = document.createElement('li');
    li.innerHTML = `<span class="lang-name">${escHtml(l.name)}</span>` +
                   `<span class="lang-source">(${escHtml(l.source)})</span>`;
    ul.appendChild(li);
  });

  // Class-granted language slots
  const grants = _parseClassLanguageGrants();
  const totalSlots = grants.common + grants.rare;
  const manual = (state.char?.languages_manual || '').split('|').filter(Boolean);

  // Render filled manual languages (removable)
  manual.forEach((l, i) => {
    const li = document.createElement('li');
    const slotLabel = i < grants.common ? 'common' : (i < totalSlots ? 'rare' : 'manual');
    li.innerHTML = `<span class="lang-name">${escHtml(l)}</span>` +
                   `<span class="lang-source">(${escHtml(slotLabel)})</span>` +
                   `<button class="lang-remove" onclick="removeLanguage(${i})">✕</button>`;
    ul.appendChild(li);
  });

  // Render empty slots that still need filling — click to open picker
  const remaining = totalSlots - manual.length;
  for (let i = 0; i < remaining; i++) {
    const slotIdx = manual.length + i;
    const slotType = slotIdx < grants.common ? 'common' : 'rare';
    const li = document.createElement('li');
    li.className = 'lang-slot-empty';
    li.innerHTML = `<button class="lang-pick-btn" onclick="openLanguagePicker('${slotType}')">` +
                   `Choose ${slotType} language…</button>` +
                   `<span class="lang-source">(${slotType})</span>`;
    ul.appendChild(li);
  }

  // Show a notice if there are unfilled class slots
  if (remaining > 0) {
    const notice = document.createElement('li');
    notice.className = 'lang-notice';
    notice.innerHTML = `<em>⚠ ${remaining} language${remaining > 1 ? 's' : ''} to choose from class features</em>`;
    ul.prepend(notice);
  }
}

// ── Language picker (modal like talents) ──────────────────────────────────

let _langPickerSlotType = null; // 'common', 'rare', or null (any)

async function openLanguagePicker(slotType) {
  _langPickerSlotType = slotType || null;
  if (!state.refData.languages) state.refData.languages = await API.data('languages');

  const title = $('lang-modal-title');
  const body  = $('lang-modal-body');
  title.textContent = slotType
    ? `🗣 Choose ${slotType.charAt(0).toUpperCase() + slotType.slice(1)} Language`
    : '🗣 Languages';
  body.innerHTML = '';

  const langs = state.refData.languages || [];
  const already = _knownLanguageNames();

  // Common section
  const commonLangs = langs.filter(l => l.type === 'common');
  if (commonLangs.length && (!slotType || slotType === 'common')) {
    body.appendChild(el('div', 'talent-section-label', 'Common Languages'));
    const ul = el('ul', 'talent-table-list');
    commonLangs.forEach(l => {
      const li = el('li', 'talent-table-row' + (already.has(l.language.toLowerCase()) ? ' lang-already-known' : ''));
      const name = el('span', 'talent-table-effect', l.language);
      const speaker = el('span', 'lang-speaker', l.speakers);
      const btn = el('button', 'talent-pick-btn', already.has(l.language.toLowerCase()) ? '✓' : 'Add');
      if (already.has(l.language.toLowerCase())) btn.disabled = true;
      else btn.onclick = () => pickLanguage(l.language);
      li.append(name, speaker, btn);
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  // Rare section
  const rareLangs = langs.filter(l => l.type === 'rare');
  if (rareLangs.length && (!slotType || slotType === 'rare')) {
    body.appendChild(el('div', 'talent-section-label', 'Rare Languages'));
    const ul = el('ul', 'talent-table-list');
    rareLangs.forEach(l => {
      const li = el('li', 'talent-table-row' + (already.has(l.language.toLowerCase()) ? ' lang-already-known' : ''));
      const name = el('span', 'talent-table-effect', l.language);
      const speaker = el('span', 'lang-speaker', l.speakers);
      const btn = el('button', 'talent-pick-btn', already.has(l.language.toLowerCase()) ? '✓' : 'Add');
      if (already.has(l.language.toLowerCase())) btn.disabled = true;
      else btn.onclick = () => pickLanguage(l.language);
      li.append(name, speaker, btn);
      ul.appendChild(li);
    });
    body.appendChild(ul);
  }

  // Custom language field
  const customRow = el('div', 'lang-custom-row');
  const customInput = document.createElement('input');
  customInput.type = 'text';
  customInput.placeholder = 'Custom language…';
  customInput.className = 'lang-custom-input';
  const customBtn = el('button', 'talent-pick-btn', 'Add');
  customBtn.onclick = () => {
    const v = customInput.value.trim();
    if (v) pickLanguage(v);
  };
  customInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { customBtn.click(); e.preventDefault(); }
  });
  customRow.append(customInput, customBtn);
  body.appendChild(el('div', 'talent-section-label', 'Custom'));
  body.appendChild(customRow);

  $('lang-overlay').hidden = false;
  $('lang-modal').hidden   = false;
}

function closeLanguagePicker() {
  $('lang-overlay').hidden = true;
  $('lang-modal').hidden   = true;
}

function _knownLanguageNames() {
  const names = new Set();
  // Auto langs from race
  const raceName = $('race-select')?.value || '';
  const raceData = (state.refData.races || []).find(r => r.race === raceName);
  if (raceData?.languages) {
    const arr = Array.isArray(raceData.languages) ? raceData.languages : String(raceData.languages).split(/,\s*/);
    arr.forEach(l => { if (l.trim()) names.add(l.trim().toLowerCase()); });
  }
  names.add('common');
  // Manual langs
  (state.char?.languages_manual || '').split('|').filter(Boolean).forEach(l => names.add(l.toLowerCase()));
  return names;
}

function pickLanguage(name) {
  const manual = (state.char?.languages_manual || '').split('|').filter(Boolean);
  manual.push(name);
  if (state.char) state.char.languages_manual = manual.join('|');
  scheduleAutoSave();
  renderLanguages();
  closeLanguagePicker();
}

function addLanguageRow() {
  openLanguagePicker();
}

function removeLanguage(idx) {
  const manual = (state.char?.languages_manual || '').split('|').filter(Boolean);
  manual.splice(idx, 1);
  if (state.char) state.char.languages_manual = manual.join('|');
  scheduleAutoSave();
  renderLanguages();
}

// ── Sheet render ───────────────────────────────────────────────────────────
async function populateClassSelect(selectedClass) {
  if (!state.refData.classes) state.refData.classes = await API.data('classes');
  const sel = $('class-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Choose class…</option>';
  (state.refData.classes || []).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.class;
    opt.textContent = c.class;
    opt.selected = c.class === selectedClass;
    sel.appendChild(opt);
  });
}

async function populateRaceSelect(selectedRace) {
  if (!state.refData.races) state.refData.races = await API.data('races');
  const sel = $('race-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Choose race…</option>';
  // Group by source
  const sources = [];
  const bySource = {};
  (state.refData.races || []).forEach(r => {
    if (!bySource[r.source]) { bySource[r.source] = []; sources.push(r.source); }
    bySource[r.source].push(r);
  });
  sources.forEach(src => {
    const grp = document.createElement('optgroup');
    grp.label = src;
    bySource[src].forEach(r => {
      const opt = document.createElement('option');
      opt.value = r.race;
      opt.textContent = r.race;
      opt.selected = r.race === selectedRace;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

async function populateBackgroundSelect(selectedBg) {
  if (!state.refData.backgrounds) state.refData.backgrounds = await API.data('backgrounds');
  const list   = $('bg-dropdown');
  const label  = $('bg-trigger-label');
  const hidden = $('bg-value');
  if (!list) return;

  // Update trigger + hidden input
  if (label)  label.textContent = selectedBg || 'Choose background…';
  if (hidden) hidden.value = selectedBg || '';

  // Build grouped list
  list.innerHTML = '';
  const sources = [];
  const bySource = {};
  (state.refData.backgrounds || []).forEach(b => {
    if (!bySource[b.source]) { bySource[b.source] = []; sources.push(b.source); }
    bySource[b.source].push(b);
  });
  sources.forEach(src => {
    list.appendChild(el('div', 'picker-group-hdr', src));
    bySource[src].forEach(b => {
      const item = el('div', 'picker-item' + (b.background === selectedBg ? ' picker-item-selected' : ''));
      item.textContent    = b.background;
      item.dataset.value  = b.background;
      item.dataset.desc   = b.description || '';
      item.dataset.source = b.source || '';
      item.addEventListener('mouseenter', e => _showBgDesc(b, e.currentTarget));
      item.addEventListener('mouseleave', _hideBgDesc);
      // Mobile: long-press to peek background description
      let _bgLp = null;
      item.addEventListener('touchstart', e => {
        _bgLp = setTimeout(() => { _showBgDesc(b, e.target.closest('.picker-item')); }, 350);
      }, { passive: true });
      item.addEventListener('touchend',    () => { clearTimeout(_bgLp); _hideBgDesc(); });
      item.addEventListener('touchmove',   () => { clearTimeout(_bgLp); });
      item.addEventListener('touchcancel', () => { clearTimeout(_bgLp); _hideBgDesc(); });
      item.addEventListener('click', e => {
        e.stopPropagation();
        _selectBackground(b.background);
        _closeBgDropdown();
      });
      list.appendChild(item);
    });
  });
}

function _openBgDropdown() {
  const list    = $('bg-dropdown');
  const trigger = $('bg-trigger');
  if (!list) return;
  list.hidden = false;
  trigger?.classList.add('open');
  setTimeout(() => document.addEventListener('click', _closeBgDropdown, { once: true }), 0);
}

function _closeBgDropdown() {
  const list    = $('bg-dropdown');
  const trigger = $('bg-trigger');
  if (list)    list.hidden = true;
  trigger?.classList.remove('open');
  _hideBgDesc();
}

function _selectBackground(name) {
  const label  = $('bg-trigger-label');
  const hidden = $('bg-value');
  if (label)  label.textContent = name || 'Choose background…';
  if (hidden) hidden.value = name || '';
  document.querySelectorAll('#bg-dropdown .picker-item').forEach(item =>
    item.classList.toggle('picker-item-selected', item.dataset.value === name)
  );
  scheduleAutoSave();
  syncExpandedHeader();
  renderBackgroundFeature();
}

function _showBgDesc(bg, anchor) {
  const card = $('bg-desc-card');
  if (!card) return;
  card.innerHTML = `
    <div class="bgdc-name">${escHtml(bg.background)}</div>
    <div class="bgdc-source">${escHtml(bg.source)}</div>
    <div class="bgdc-desc">${escHtml(bg.description || '')}</div>`;
  const rect  = anchor.getBoundingClientRect();
  const cardW = 234;
  const left  = rect.right + 8;
  const adjLeft = (left + cardW > window.innerWidth) ? rect.left - cardW - 8 : left;
  card.style.left = Math.max(4, adjLeft) + 'px';
  card.style.top  = Math.max(4, Math.min(rect.top, window.innerHeight - 140)) + 'px';
  card.classList.add('visible');
}

function _hideBgDesc() {
  $('bg-desc-card')?.classList.remove('visible');
}

// ── Deity custom picker (mirrors background picker) ──────────────────────
const SOURCE_ORDER = ['Shadowdark RPG Core', 'Death Timer Issue 1', 'Cursed Scroll 1', 'Cursed Scroll 2', 'GM Companion'];

async function populateDeitySelect(selectedDeity) {
  if (!state.refData.gods) state.refData.gods = await API.data('gods');
  const list   = $('deity-dropdown');
  const label  = $('deity-trigger-label');
  const hidden = $('deity-value');
  if (!list) return;

  if (label)  label.textContent = selectedDeity || 'Choose deity…';
  if (hidden) hidden.value = selectedDeity || '';

  list.innerHTML = '';
  const bySource = {};
  const sourceSet = [];
  (state.refData.gods || []).forEach(g => {
    if (!bySource[g.source]) { bySource[g.source] = []; sourceSet.push(g.source); }
    bySource[g.source].push(g);
  });
  // Sort sources: known order first, then any unknown at the end
  sourceSet.sort((a, b) => {
    const ia = SOURCE_ORDER.indexOf(a), ib = SOURCE_ORDER.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  // Sort gods within each source alphabetically
  for (const src of sourceSet) bySource[src].sort((a, b) => a.name.localeCompare(b.name));

  sourceSet.forEach(src => {
    list.appendChild(el('div', 'picker-group-hdr', src));
    bySource[src].forEach(g => {
      const item = el('div', 'picker-item' + (g.name === selectedDeity ? ' picker-item-selected' : ''));
      item.textContent    = g.name;
      item.dataset.value  = g.name;
      item.addEventListener('mouseenter', e => _showDeityDesc(g, e.currentTarget));
      item.addEventListener('mouseleave', _hideDeityDesc);
      // Mobile: long-press to peek
      let _dLp = null;
      item.addEventListener('touchstart', e => {
        _dLp = setTimeout(() => { _showDeityDesc(g, e.target.closest('.picker-item')); }, 350);
      }, { passive: true });
      item.addEventListener('touchend',    () => { clearTimeout(_dLp); _hideDeityDesc(); });
      item.addEventListener('touchmove',   () => { clearTimeout(_dLp); });
      item.addEventListener('touchcancel', () => { clearTimeout(_dLp); _hideDeityDesc(); });
      item.addEventListener('click', e => {
        e.stopPropagation();
        _selectDeity(g.name);
        _closeDeityDropdown();
      });
      list.appendChild(item);
    });
  });
}

function _openDeityDropdown() {
  const list    = $('deity-dropdown');
  const trigger = $('deity-trigger');
  if (!list) return;
  list.hidden = false;
  trigger?.classList.add('open');
  setTimeout(() => document.addEventListener('click', _closeDeityDropdown, { once: true }), 0);
}

function _closeDeityDropdown() {
  const list    = $('deity-dropdown');
  const trigger = $('deity-trigger');
  if (list)    list.hidden = true;
  trigger?.classList.remove('open');
  _hideDeityDesc();
}

function _selectDeity(name) {
  const label  = $('deity-trigger-label');
  const hidden = $('deity-value');
  if (label)  label.textContent = name || 'Choose deity…';
  if (hidden) hidden.value = name || '';
  document.querySelectorAll('#deity-dropdown .picker-item').forEach(item =>
    item.classList.toggle('picker-item-selected', item.dataset.value === name)
  );
  scheduleAutoSave();
  syncExpandedHeader();
}

function _showDeityDesc(god, anchor) {
  const card = $('deity-desc-card');
  if (!card) return;
  let imgHtml = '';
  if (god.image) {
    imgHtml = `<img class="ddc-img" src="/static/images/gods/${escHtml(god.image)}" alt="${escHtml(god.name)}">`;
  }
  const metaParts = [god.alignment, god.type, god.domain].filter(Boolean);
  card.innerHTML = `
    <div class="ddc-top">
      <div class="ddc-info">
        <div class="ddc-name">${escHtml(god.name)}</div>
        ${god.title ? `<div class="ddc-title">${escHtml(god.title)}</div>` : ''}
        ${metaParts.length ? `<div class="ddc-meta">${escHtml(metaParts.join(' · '))}</div>` : ''}
      </div>
      ${imgHtml}
    </div>
    ${god.description ? `<div class="ddc-desc">${escHtml(god.description)}</div>` : ''}`;
  const rect  = anchor.getBoundingClientRect();
  const cardW = 270;
  const left  = rect.right + 8;
  const adjLeft = (left + cardW > window.innerWidth) ? rect.left - cardW - 8 : left;
  card.style.left = Math.max(4, adjLeft) + 'px';
  card.style.top  = Math.max(4, Math.min(rect.top, window.innerHeight - 200)) + 'px';
  card.classList.add('visible');
}

function _hideDeityDesc() {
  $('deity-desc-card')?.classList.remove('visible');
}

async function renderRaceFeature() {
  if (!state.refData.races) state.refData.races = await API.data('races');
  const raceName = $('race-select')?.value || '';
  const section  = $('race-feature-section');
  const ul       = $('race-feature-list');
  if (!section || !ul) return;
  const raceData = (state.refData.races || []).find(r => r.race === raceName);
  if (!raceData?.benefit_name && !raceData?.benefit) { section.hidden = true; ul.innerHTML = ''; return; }
  section.hidden = false;
  ul.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'class-feature-item';
  const name = document.createElement('strong');
  name.className = 'class-feature-name';
  name.textContent = raceData.benefit_name || 'Racial Benefit';
  const desc = document.createElement('span');
  desc.className = 'class-feature-desc';
  desc.textContent = ' — ' + (raceData.benefit || '');
  li.append(name, desc);
  ul.appendChild(li);
}

async function renderBackgroundFeature() {
  if (!state.refData.backgrounds) state.refData.backgrounds = await API.data('backgrounds');
  const bgName  = document.querySelector('[data-field="background"]')?.value || '';
  const section = $('bg-feature-section');
  const ul      = $('bg-feature-list');
  if (!section || !ul) return;
  const bgData  = (state.refData.backgrounds || []).find(b => b.background === bgName);
  if (!bgData?.description) { section.hidden = true; ul.innerHTML = ''; return; }
  section.hidden = false;
  ul.innerHTML = '';
  const li = document.createElement('li');
  li.className = 'class-feature-item';
  const name = document.createElement('strong');
  name.className = 'class-feature-name';
  name.textContent = bgData.background;
  const desc = document.createElement('span');
  desc.className = 'class-feature-desc';
  desc.textContent = ' — ' + bgData.description;
  li.append(name, desc);
  ul.appendChild(li);
}

async function renderClassFeatures() {
  if (!state.refData.classes) state.refData.classes = await API.data('classes');
  const className  = $('class-select')?.value || '';
  const section    = $('class-features-section');
  const ul         = $('class-features-list');
  if (!section || !ul) return;
  const classData  = (state.refData.classes || []).find(c => c.class === className);
  const features   = classData?.features || [];
  if (!features.length) { section.hidden = true; ul.innerHTML = ''; return; }
  section.hidden = false;
  ul.innerHTML = '';
  const spellsTable = classData?.spells_known_table || null;
  // Find the last feature index that mentions spellcasting
  const lastSpellIdx = spellsTable
    ? features.reduce((last, f, i) =>
        (/spell|cast|conjur/i.test(f.name) || /spell|cast|conjur/i.test(f.description)) ? i : last, -1)
    : -1;
  features.forEach((f, idx) => {
    const li   = document.createElement('li');
    li.className = 'class-feature-item';
    const hasSpells = idx === lastSpellIdx;
    if (hasSpells) {
      li.dataset.spellsTable = JSON.stringify(spellsTable);
      li.classList.add('class-feature-has-spells');
      li.title = 'Hover to see Spells Known table';
    }
    const name = document.createElement('strong');
    name.className = 'class-feature-name';
    name.textContent = f.name;
    const desc = document.createElement('span');
    desc.className = 'class-feature-desc';
    desc.textContent = ' — ' + f.description;
    li.append(name, desc);
    if (hasSpells) {
      const hint = document.createElement('span');
      hint.className = 'class-feature-spell-hint';
      hint.textContent = '📖';
      hint.title = 'Spells Known table';
      li.appendChild(hint);
    }
    // Show weapon mastery choice inline
    const isWM = /weapon\s+mastery/i.test(f.name) ||
      /gain\s+\+\d+\s+to\s+attack\s+and\s+damage\s+with\s+that\s+weapon/i.test(f.description);
    if (isWM && state.char) {
      const wmTag = document.createElement('span');
      wmTag.className = 'wm-tag';
      const chosen = state.char.weapon_mastery;
      if (chosen) {
        wmTag.innerHTML = ` <strong class="wm-chosen">${escHtml(chosen)}</strong> `;
        const changeBtn = document.createElement('button');
        changeBtn.className = 'wm-change-btn';
        changeBtn.textContent = '✎';
        changeBtn.title = 'Change mastered weapon';
        changeBtn.onclick = (e) => { e.stopPropagation(); changeWeaponMastery(); };
        wmTag.appendChild(changeBtn);
      } else {
        const pickBtn = document.createElement('button');
        pickBtn.className = 'wm-change-btn';
        pickBtn.textContent = 'Choose weapon';
        pickBtn.title = 'Pick your mastered weapon';
        pickBtn.onclick = (e) => { e.stopPropagation(); promptWeaponMasteryPicker(); };
        wmTag.appendChild(pickBtn);
      }
      li.appendChild(wmTag);
    }
    ul.appendChild(li);
  });
}

function autoComputeXpTarget() {
  const level = parseInt(document.querySelector('[data-field="level"]')?.value) || 1;
  const field = document.getElementById('xp-target-field');
  if (!field) return;
  const target = level * 10;
  field.value = target;
  // Keep state in sync so collectSheetData picks it up
  if (state.char) state.char.xp_target = target;
  updateXPBar(parseInt(document.querySelector('[data-field="xp"]')?.value) || 0, target);
}

async function autoComputeTitle() {
  if (!state.refData.class_titles) state.refData.class_titles = await API.data('class_titles');
  const titleField = document.querySelector('[data-field="title"]');
  if (!titleField) return;
  const className  = $('class-select')?.value || '';
  const level      = parseInt(document.querySelector('[data-field="level"]')?.value) || 1;
  const alignment  = document.querySelector('.align-btn.active')?.dataset.align || 'Neutral';
  const classData  = (state.refData.class_titles || []).find(c => c.class === className);
  if (!classData) { titleField.value = ''; return; }
  const alignKey   = alignment.toLowerCase();
  const row        = (classData.titles || []).find(t => level >= t.level_min && level <= t.level_max);
  titleField.value = row ? (row[alignKey] || row.neutral || '') : '';
  syncExpandedHeader();
}

function renderSheet(char) {
  $('sheet-char-name-header').textContent = char.name;

  // Text / number inputs & textareas
  document.querySelectorAll('[data-field]').forEach(inp => {
    const f = inp.dataset.field;
    if (f in char) inp.value = char[f] ?? '';
  });

  // Determine if this is a "new" character or an existing one
  const isNew = char.name === 'New Character' && !char.class_name && !char.ancestry;
  activateExpandedHeader(!isNew, char);

  // Auto-compute XP target from level
  autoComputeXpTarget();

  // Populate class dropdown then compute title + features + class bonuses
  populateClassSelect(char.class_name || '').then(async () => {
    autoComputeTitle();
    renderClassFeatures();
    refreshStatBonusDisplay(); // re-run with class data now available
    scheduleAutoCompute();     // recompute attacks/AC with class bonuses
    await checkWeaponMastery();
  });
  // Populate race dropdown then show race benefit
  populateRaceSelect(char.ancestry || '').then(() => {
    renderRaceFeature();
  });
  // Populate background dropdown then show background benefit
  populateBackgroundSelect(char.background || '');
  renderBackgroundFeature();
  // Populate deity dropdown
  populateDeitySelect(char.deity || '');
  // Render attack cards from stored attacks text
  renderAttackCards(char.attacks || '');

  // Alignment buttons
  document.querySelectorAll('.align-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.align === char.alignment);
  });

  // Restore bonus arrays into state.char (they arrive as parsed arrays from the API)
  if (!Array.isArray(char.talent_bonuses)) char.talent_bonuses = [];
  if (!Array.isArray(char.race_bonuses))   char.race_bonuses   = [];

  // Snapshot base values (DB stores bases WITHOUT bonuses)
  state._statBases = {};
  ALL_STATS.forEach(f => { state._statBases[f] = char[f] ?? 10; });
  state._hpMaxBase = char.hp_max ?? 8;

  // HP bar
  updateHPBar(char.hp_current, char.hp_max);

  // XP bar
  updateXPBar(char.xp, char.xp_target);

  // Gear slots count
  updateSlotsInfo(char.str_score, char.gear);

  // Gear grid (render BEFORE refreshStatBonusDisplay so DOM gear data exists)
  const gearTypes = Array.isArray(char.gear_types) ? char.gear_types : new Array(20).fill('');
  renderGearGrid(
    Array.isArray(char.gear)       ? char.gear       : [],
    Array.isArray(char.gear_tags)  ? char.gear_tags  : [],
    Array.isArray(char.gear_spans) ? char.gear_spans : new Array(20).fill(1),
    gearTypes
  );

  // Write effective values into the DOM and update modifiers + badges + gear grid
  refreshStatBonusDisplay();
  // Free-carry — migrate old string/array, render to DOM (DOM is the source of truth)
  let fcRaw = Array.isArray(char.free_carry_items) ? char.free_carry_items : [];
  if (!fcRaw.length && char.free_carry) {
    fcRaw = String(char.free_carry).split(',').map(s => s.trim()).filter(Boolean);
  }
  renderFreeCarryList(fcRaw);   // _normFC pads to FC_SLOTS inside renderFreeCarryList

  // Talents
  renderItemList('list-talents', Array.isArray(char.talents) ? char.talents : [], 'talents');

  // Spells
  renderSpellList(Array.isArray(char.spells) ? char.spells : []);

  // Coin total
  updateCoinTotal(char.gp, char.sp, char.cp, char.eth);

  // Mount cards
  updateMountSection();

  // Portrait
  renderPortrait(char.portrait || '');

  // Spellcasting ability
  state.spellcastingAbility = char.spellcasting_ability ?? null;
  document.querySelectorAll('.spell-ab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.ab === state.spellcastingAbility));

  // Default to Inventory tab
  switchTab('inventory');

  // Show/hide mounts tab based on stable
  _syncMountsTabVisibility();

  // Header hover cards for background/deity
  initDetailTagHovers();

  // Languages in Features tab
  renderLanguages();
}

function renderPortrait(url) {
  const img  = $('portrait-img');
  const ph   = document.querySelector('.portrait-placeholder');
  if (url) {
    img.src = url;
    img.hidden = false;
    if (ph) ph.style.display = 'none';
  } else {
    img.hidden = true;
    img.src = '';
    if (ph) ph.style.display = '';
  }
}

function promptPortrait() {
  if (document.querySelector('.panel[data-panel="identity"]')?.classList.contains('panel-locked')) return;
  const current = $('portrait-img')?.src || '';
  const url = window.prompt('Portrait image URL (leave blank to clear):', current === location.href ? '' : current);
  if (url === null) return; // cancelled
  renderPortrait(url.trim());
  scheduleAutoSave();
  syncExpandedHeader();
}

// ── Gear grid ──────────────────────────────────────────────────────────────

/** Build a map of continuation slot → primary slot index */
function buildContMap(spans) {
  const cont = {};
  for (let i = 0; i < 20; i++) {
    const s = spans?.[i] ?? 1;
    for (let j = 1; j < s; j++) {
      if (i + j < 20) cont[i + j] = i;
    }
  }
  return cont;
}

/** Read the full 20-slot gear array from slot-idx containers */
function readGearArray() {
  const gear = new Array(20).fill('');
  document.querySelectorAll('[data-gear-slot]').forEach(btn => {
    const idx = parseInt(btn.dataset.gearSlot);
    if (idx >= 0 && idx < 20) gear[idx] = btn.dataset.gearValue ?? '';
  });
  return gear;
}

function getGearSpans() {
  const s = state.char?.gear_spans;
  if (Array.isArray(s) && s.length === 20) return [...s];
  return new Array(20).fill(1);
}

function getGearTags() {
  const tags = new Array(20).fill('');
  document.querySelectorAll('[data-slot-idx]').forEach(slot => {
    const idx = parseInt(slot.dataset.slotIdx);
    if (idx >= 0 && idx < 20) tags[idx] = slot.dataset.slotTag || '';
  });
  return tags;
}

function getGearTypes() {
  const types = new Array(20).fill('');
  document.querySelectorAll('[data-slot-idx]').forEach(slot => {
    const idx = parseInt(slot.dataset.slotIdx);
    if (idx >= 0 && idx < 20) types[idx] = slot.dataset.slotType || '';
  });
  return types;
}

// ── Stackable item quantities ──────────────────────────────────────────────
// Items whose name ends with a trailing "(N)" are stackable. We encode the
// live count inside the name string as "Base (current/max)" so the quantity
// travels automatically through save/load, drag-and-drop, and mount transfers.
// A bare "(N)" (legacy / freshly-bought) is read as a full stack: current=max=N.

/** Parse a trailing "(c/m)" or "(m)" quantity. Returns {base,cur,max} or null. */
function parseQty(name) {
  if (!name) return null;
  const m = String(name).match(/^(.*?)\s*\((\d+)(?:\s*\/\s*(\d+))?\)\s*$/);
  if (!m) return null;
  const base = m[1].trim();
  const a = parseInt(m[2], 10);
  if (m[3] !== undefined) return { base, cur: a, max: parseInt(m[3], 10) };
  return { base, cur: a, max: a };           // bare "(N)" → full stack
}

/** Canonical data name for lookups: "Arrows (19/20)" → "Arrows (20)". */
function canonicalItemName(name) {
  const q = parseQty(name);
  return q ? `${q.base} (${q.max})` : name;
}

/** Build the editable "(‹cur›/max)" widget. onCommit(newFullName) persists.
 *  dragHost (optional) is the draggable slot — its drag is suspended while editing. */
function buildQtyWidget(name, onCommit, dragHost) {
  const q = parseQty(name);
  if (!q) return null;
  const wrap = el('span', 'gear-qty');
  wrap.appendChild(document.createTextNode('('));
  const digits = String(q.max).length;
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.className = 'gear-qty-input';
  inp.min = '0';
  inp.max = String(q.max);
  inp.value = String(q.cur);
  inp.maxLength = digits;                       // cap typed digits to max's width
  inp.style.width = `${digits + 3}ch`;          // extra room → bigger click/select target
  inp.title = `Quantity (max ${q.max})`;
  // Hard-stop extra digits on a number input (maxLength alone is ignored by type=number)
  inp.addEventListener('input', () => {
    if (inp.value.length > digits) inp.value = inp.value.slice(0, digits);
  });
  // Keep clicks/drags inside the field from triggering slot drag or hover card
  ['pointerdown', 'mousedown', 'click', 'dragstart'].forEach(ev =>
    inp.addEventListener(ev, e => e.stopPropagation()));
  inp.addEventListener('focus', () => { if (dragHost) dragHost.draggable = false; });
  const commit = () => {
    let v = parseInt(inp.value, 10);
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(q.max, v));
    inp.value = String(v);
    if (dragHost) dragHost.draggable = true;
    onCommit(`${q.base} (${v}/${q.max})`);
  };
  inp.addEventListener('change', commit);
  inp.addEventListener('blur', commit);
  wrap.appendChild(inp);
  wrap.appendChild(document.createTextNode(`/${q.max})`));
  return wrap;
}

function renderGearGrid(gear, tags, spans, types) {
  const col1 = $('gear-col-1');
  const col2 = $('gear-col-2');
  [col1, col2].forEach(col => col.querySelectorAll('.gear-slot, .gear-slot-cont').forEach(s => s.remove()));

  const cont     = buildContMap(spans);
  const maxSlots = maxGearSlots(document.querySelector('[data-field="str_score"]')?.value ?? 10) + (state._gearSlotBonus || 0);
  for (let i = 0; i < 20; i++) {
    const col  = i < 10 ? col1 : col2;
    const slot = _buildGearSlot(i, gear, tags, spans, types, cont, maxSlots);
    col.appendChild(slot);
  }
}

function _buildGearSlot(i, gear, tags, spans, types, cont, maxSlots) {
  // Over-limit slot (no item) — greyed out, non-interactive
  const overLimit = i >= (maxSlots ?? 20);
  if (overLimit && !gear[i]?.trim() && cont[i] === undefined) {
    const slot = el('div', 'gear-slot gear-slot-overlimit');
    slot.appendChild(el('span', 'gear-num', `${i + 1}`));
    return slot;
  }

  if (cont[i] !== undefined) {
    // Greyed-out continuation slot
    const primaryName = gear[cont[i]] ?? '';
    const slot = el('div', 'gear-slot-cont');
    slot.append(
      el('span', 'gear-num gear-num-cont', `${i+1}`),
      el('span', 'gear-cont-link', '└'),
      el('span', 'gear-cont-label', primaryName)
    );
    return slot;
  }

  const tag   = tags?.[i]  ?? '';
  const type  = types?.[i] ?? '';
  const value = gear[i]    ?? '';

  const slot = el('div', 'gear-slot' + (tag ? ' gear-tagged-' + tag : ''));
  slot.dataset.slotIdx  = i;
  slot.dataset.slotTag  = tag;
  slot.dataset.slotType = type;

  // Drag-and-drop
  slot.draggable = !!value;
  slot.addEventListener('dragstart', e => _invDragStart(e, 'gear', i));
  slot.addEventListener('dragend',   e => _invDragEnd(e));
  slot.addEventListener('dragover',  _invDragOver);
  slot.addEventListener('dragenter', _invDragEnter);
  slot.addEventListener('dragleave', _invDragLeave);
  slot.addEventListener('drop',      e => _invDrop(e, 'gear', i));

  slot.appendChild(el('span', 'gear-num', `${i+1}`));

  if (value) {
    const q = parseQty(value);
    const itemBtn = el('button', 'gear-item-btn', q ? q.base : value);
    itemBtn.type = 'button';
    itemBtn.dataset.gearSlot  = i;
    itemBtn.dataset.gearValue = value;
    itemBtn.title = value;
    slot.appendChild(itemBtn);

    if (q) {
      itemBtn.classList.add('has-qty');
      const widget = buildQtyWidget(value, newName => {
        itemBtn.dataset.gearValue = newName;
        itemBtn.title = newName;
        scheduleGearSave();
      }, slot);
      if (widget) slot.appendChild(widget);
    }

    if (type === 'weapon') {
      const wb = el('button', 'gear-action-btn gear-wield-btn' + (tag === 'wielding' ? ' active' : ''), '⚔');
      wb.type = 'button'; wb.title = tag === 'wielding' ? 'Un-wield' : 'Wield';
      wb.onclick = () => toggleWield(i);
      slot.appendChild(wb);
    }
    if (type === 'armor') {
      const ab = el('button', 'gear-action-btn gear-wear-btn' + (tag === 'wearing' ? ' active' : ''), '🛡');
      ab.type = 'button'; ab.title = tag === 'wearing' ? 'Un-wear' : 'Wear';
      ab.onclick = () => toggleWear(i);
      slot.appendChild(ab);
    }

    const mb = el('button', 'gear-action-btn gear-mount-btn', '🐴');
    mb.type = 'button'; mb.title = 'Move to mount carry';
    mb.onclick = e => { e.stopPropagation(); _showMountMoveMenu(e, 'gear', i); };
    slot.appendChild(mb);

    const fcBtn = el('button', 'gear-action-btn gear-fc-btn', '🎒');
    fcBtn.type = 'button'; fcBtn.title = 'Move to Free Carry';
    fcBtn.onclick = e => { e.stopPropagation(); moveGearToFreeCarry(i); };
    slot.appendChild(fcBtn);

    const clearBtn = el('button', 'gear-clear-btn', '×');
    clearBtn.type = 'button'; clearBtn.title = 'Remove item';
    clearBtn.onclick = e => { e.stopPropagation(); onGearClear(i); };
    slot.appendChild(clearBtn);
  }
  return slot;
}

/** Move a gear-slot item into the first empty Free Carry slot. */
function moveGearToFreeCarry(i) {
  const gear  = readGearArray();
  const spans = getGearSpans();
  const tags  = getGearTags();
  const types = getGearTypes();
  const name  = gear[i];
  if (!name) return;
  const fc = getFCItems();
  const slot = fc.findIndex(it => !it.name);
  if (slot === -1) { toast('No empty free carry slots!'); return; }
  fc[slot] = { name, type: types[i] || '', tag: '' };
  // Clear gear (including any spanned continuation slots)
  const span = spans[i] || 1;
  for (let j = 0; j < span; j++) {
    gear[i + j] = ''; tags[i + j] = ''; types[i + j] = ''; spans[i + j] = 1;
  }
  if (state.char) {
    state.char.gear = gear; state.char.gear_spans = spans; state.char.gear_types = types;
  }
  renderGearGrid(gear, tags, spans, types);
  renderFreeCarryList(fc);
  updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value ?? 10, gear);
  updateMountSection();
  scheduleAutoSave();
  scheduleAutoCompute();
  toast(`${name.replace(/\s*\(.*\)$/,'')} → Free Carry`);
}

function toggleWield(i) {
  const slot = document.querySelector(`[data-slot-idx="${i}"]`);
  if (!slot) return;
  const cur  = slot.dataset.slotTag || '';
  const next = cur === 'wielding' ? '' : 'wielding';
  _applySlotTag(slot, i, next);
}

function toggleWear(i) {
  const slot = document.querySelector(`[data-slot-idx="${i}"]`);
  if (!slot) return;
  const cur  = slot.dataset.slotTag || '';
  const next = cur === 'wearing' ? '' : 'wearing';
  _applySlotTag(slot, i, next);
}

function _applySlotTag(slot, i, tag) {
  slot.dataset.slotTag = tag;
  slot.className = 'gear-slot' + (tag ? ' gear-tagged-' + tag : '');
  const wb = slot.querySelector('.gear-wield-btn');
  const ab = slot.querySelector('.gear-wear-btn');
  if (wb) { wb.classList.toggle('active', tag === 'wielding'); wb.title = tag === 'wielding' ? 'Un-wield' : 'Wield'; }
  if (ab) { ab.classList.toggle('active', tag === 'wearing');  ab.title = tag === 'wearing'  ? 'Un-wear'  : 'Wear'; }
  scheduleGearSave();
  refreshStatBonusDisplay(); // class features may be conditional on gear
  scheduleAutoCompute();
}

function onGearClear(i) {
  const gear  = readGearArray();
  const spans = getGearSpans();
  const tags  = getGearTags();
  const types = getGearTypes();
  gear[i]  = ''; spans[i] = 1; tags[i] = ''; types[i] = '';
  if (state.char) { state.char.gear = gear; state.char.gear_spans = spans; state.char.gear_types = types; }
  renderGearGrid(gear, tags, spans, types);
  updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value ?? 10, gear);
  updateMountSection();
  scheduleAutoSave();
  scheduleAutoCompute();
}

// ── Free-carry ─────────────────────────────────────────────────────────────
// DOM-driven, same pattern as gear[]. Truth lives in the DOM, not state.char.
// Each row stores data-fc-name / data-fc-type / data-fc-tag as attributes.
const FC_SLOTS = 10;

/** Read current free-carry state from the DOM (always up-to-date). */
function getFCItems() {
  const items = [];
  for (let i = 0; i < FC_SLOTS; i++) {
    const row = document.querySelector(`.free-carry-item[data-fc-idx="${i}"]`);
    items.push(row
      ? { name: row.dataset.fcName || '', type: row.dataset.fcType || '', tag: row.dataset.fcTag || '' }
      : { name: '', type: '', tag: '' });
  }
  return items;
}

/** Normalise a saved array (handles legacy strings, pads to FC_SLOTS). */
function _normFC(items) {
  const raw = Array.isArray(items) ? items : [];
  const out = [];
  for (let i = 0; i < FC_SLOTS; i++) {
    const it = raw[i];
    if (!it)                     out.push({ name: '', type: '', tag: '' });
    else if (typeof it === 'string') out.push({ name: it, type: '', tag: '' });
    else                         out.push({ name: it.name ?? '', type: it.type ?? '', tag: it.tag ?? '' });
  }
  return out;
}

/** Render all FC_SLOTS rows from an array of {name,type,tag} objects. */
function renderFreeCarryList(items) {
  const col = $('free-carry-col');
  if (!col) return;
  col.querySelectorAll('.free-carry-item').forEach(e => e.remove());
  const slots = _normFC(items);
  slots.forEach((item, i) => {
    const { name, type, tag } = item;
    const row = el('div', 'gear-slot free-carry-item' + (tag ? ' gear-tagged-' + tag : ''));
    // Store truth as DOM attributes — immune to state.char overwrites
    row.dataset.fcIdx  = i;
    row.dataset.fcName = name;
    row.dataset.fcType = type;
    row.dataset.fcTag  = tag;

    // Drag-and-drop
    row.draggable = !!name;
    row.addEventListener('dragstart', e => _invDragStart(e, 'fc', i));
    row.addEventListener('dragend',   e => _invDragEnd(e));
    row.addEventListener('dragover',  _invDragOver);
    row.addEventListener('dragenter', _invDragEnter);
    row.addEventListener('dragleave', _invDragLeave);
    row.addEventListener('drop',      e => _invDrop(e, 'fc', i));

    row.appendChild(el('span', 'gear-num', `${i + 1}`));

    if (name) {
      const q = parseQty(name);
      const btn = el('button', 'gear-item-btn', q ? q.base : name);
      btn.type = 'button'; btn.dataset.gearValue = name; btn.title = name;
      row.appendChild(btn);

      if (q) {
        btn.classList.add('has-qty');
        const widget = buildQtyWidget(name, newName => {
          row.dataset.fcName = newName;
          btn.dataset.gearValue = newName;
          btn.title = newName;
          scheduleAutoSave();
        }, row);
        if (widget) row.appendChild(widget);
      }

      if (type === 'weapon') {
        const wb = el('button', 'gear-action-btn gear-wield-btn' + (tag === 'wielding' ? ' active' : ''), '⚔');
        wb.type = 'button'; wb.title = tag === 'wielding' ? 'Un-wield' : 'Wield';
        wb.onclick = () => toggleFreeCarryWield(i);
        row.appendChild(wb);
      }
      if (type === 'armor') {
        const ab = el('button', 'gear-action-btn gear-wear-btn' + (tag === 'wearing' ? ' active' : ''), '🛡');
        ab.type = 'button'; ab.title = tag === 'wearing' ? 'Un-wear' : 'Wear';
        ab.onclick = () => toggleFreeCarryWear(i);
        row.appendChild(ab);
      }

      const mb = el('button', 'gear-action-btn gear-mount-btn', '🐴');
      mb.type = 'button'; mb.title = 'Move to mount carry';
      mb.onclick = e => { e.stopPropagation(); _showMountMoveMenu(e, 'fc', i); };
      row.appendChild(mb);

      // Move back into the main gear inventory (reverse of the 🎒 button on gear slots)
      const gearBtn = el('button', 'gear-action-btn gear-fc-return-btn', '📥');
      gearBtn.type = 'button'; gearBtn.title = 'Move to main inventory';
      gearBtn.onclick = e => { e.stopPropagation(); moveFreeCarryToGear(i); };
      row.appendChild(gearBtn);

      const x = el('button', 'gear-clear-btn', '×');
      x.type = 'button'; x.title = 'Remove';
      x.onclick = e => { e.stopPropagation(); removeFreeCarryItem(i); };
      row.appendChild(x);
    }

    col.appendChild(row);
  });
}

/** Move a Free Carry item back into the main gear grid (first slot that fits). */
function moveFreeCarryToGear(i) {
  const fc = getFCItems();
  const item = fc[i];
  if (!item?.name) return;
  // Look up the item's gear-slot footprint (1 by default)
  buildItemLookup().then(() => {
    const found = findItem(item.name);
    const rawSlots = found?.item?.['Gear Slots'];
    const needed = (rawSlots !== undefined && !isNaN(parseInt(rawSlots))) ? Math.max(1, parseInt(rawSlots)) : 1;

    const gear  = readGearArray();
    const spans = getGearSpans();
    const tags  = getGearTags();
    const types = getGearTypes();
    const cont  = buildContMap(spans);
    const maxSlots = maxGearSlots(document.querySelector('[data-field="str_score"]')?.value ?? 10)
                     + (state._gearSlotBonus || 0);

    // Find first run of `needed` empty slots within the limit
    let target = -1;
    for (let p = 0; p < maxSlots; p++) {
      if (cont[p] !== undefined || gear[p]?.trim()) continue;
      let fits = true;
      for (let j = 1; j < needed; j++) {
        const ni = p + j;
        if (ni >= maxSlots) { fits = false; break; }
        if ((cont[ni] !== undefined && cont[ni] !== p) || gear[ni]?.trim()) { fits = false; break; }
      }
      if (fits) { target = p; break; }
    }
    if (target === -1) { toast('No empty gear slots!'); return; }

    // Place into gear, mark continuation slots
    gear[target]  = item.name;
    types[target] = item.type || '';
    tags[target]  = '';                     // wielding/wearing state doesn't survive the move
    spans[target] = needed;
    for (let j = 1; j < needed; j++) {
      const ni = target + j;
      gear[ni] = ''; types[ni] = ''; tags[ni] = ''; spans[ni] = 1;
    }
    // Clear the free-carry slot
    fc[i] = { name: '', type: '', tag: '' };
    if (state.char) {
      state.char.gear = gear; state.char.gear_spans = spans; state.char.gear_types = types;
    }
    renderGearGrid(gear, tags, spans, types);
    renderFreeCarryList(fc);
    updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value ?? 10, gear);
    updateMountSection();
    scheduleAutoSave();
    scheduleAutoCompute();
    toast(`${String(item.name).replace(/\s*\(.*\)$/,'')} → Inventory`);
  });
}

function toggleFreeCarryWield(i) {
  const items = getFCItems();
  const item  = items[i]; if (!item?.name) return;
  item.tag = item.tag === 'wielding' ? '' : 'wielding';
  renderFreeCarryList(items);
  scheduleAutoSave(); scheduleAutoCompute();
}

function toggleFreeCarryWear(i) {
  const items = getFCItems();
  const item  = items[i]; if (!item?.name) return;
  item.tag = item.tag === 'wearing' ? '' : 'wearing';
  renderFreeCarryList(items);
  scheduleAutoSave(); scheduleAutoCompute();
}

function removeFreeCarryItem(i) {
  const items = getFCItems();
  items[i] = { name: '', type: '', tag: '' };
  renderFreeCarryList(items);
  updateMountSection();
  scheduleAutoSave(); scheduleAutoCompute();
}

function scheduleGearSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, 600);
  setSaving();
}

// ── Inventory drag-and-drop ─────────────────────────────────────────────────
let dragSrc = null; // { kind, idx, name, type, tag, span, mountId? }

function _invDragStart(e, kind, idx, mountId) {
  if (kind === 'gear') {
    const gear = readGearArray();
    const name = gear[idx] ?? '';
    if (!name) return;
    dragSrc = { kind, idx, name, type: getGearTypes()[idx]??'', tag: getGearTags()[idx]??'', span: getGearSpans()[idx]??1 };
  } else if (kind === 'fc') {
    const item = getFCItems()[idx];
    if (!item?.name) return;
    dragSrc = { kind, idx, name: item.name, type: item.type??'', tag: item.tag??'', span: 1 };
  } else if (kind === 'mount-gear' || kind === 'mount-fc') {
    const saved = getMountsSaved();
    const mount = saved.find(m => m.id === mountId);
    if (!mount) return;
    const arr  = kind === 'mount-gear' ? (mount.gear ?? []) : (mount.freeCarry ?? []);
    const name = arr[idx] ?? '';
    if (!name) return;
    dragSrc = { kind, idx, name, type: '', tag: '', span: 1, mountId };
  }
  if (!dragSrc) return;
  e.dataTransfer.effectAllowed = 'move';
  requestAnimationFrame(() => e.currentTarget?.classList.add('dragging'));
}

function _invDragEnd(e) {
  e.currentTarget?.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragSrc = null;
}

function _invDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }

function _invDragEnter(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }

function _invDragLeave(e) {
  // Only remove if leaving to a non-child element
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

function _invDrop(e, kind, idx, mountId) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragSrc) return;
  if (dragSrc.kind === kind && dragSrc.idx === idx && dragSrc.mountId === mountId) { dragSrc = null; return; }

  // ── Any → mount-gear or mount-fc ──────────────────────────────────────
  if (kind === 'mount-gear' || kind === 'mount-fc') {
    const saved = getMountsSaved();
    const mount = saved.find(m => m.id === mountId);
    if (!mount) { dragSrc = null; return; }

    const mkind = kind === 'mount-gear' ? 'gear' : 'fc';
    if (!Array.isArray(mount.gear))      mount.gear      = [];
    if (!Array.isArray(mount.freeCarry)) mount.freeCarry = [];
    const data      = getMountAnimalData(mount.animalName);
    const gearCap   = data?.['Carry Slots'] ?? 10;
    while (mount.gear.length      < gearCap) mount.gear.push('');
    while (mount.freeCarry.length < 5)       mount.freeCarry.push('');
    const targetArr = mkind === 'gear' ? mount.gear : mount.freeCarry;
    const prevName  = targetArr[idx] ?? '';
    const srcName   = dragSrc.name;

    if (dragSrc.kind === 'mount-gear' || dragSrc.kind === 'mount-fc') {
      // Within same mount — swap
      if (dragSrc.mountId !== mountId) { dragSrc = null; return; }
      const srcArr = dragSrc.kind === 'mount-gear' ? mount.gear : mount.freeCarry;
      srcArr[dragSrc.idx] = prevName;
      targetArr[idx]      = srcName;
    } else if (dragSrc.kind === 'gear') {
      // Main gear → mount slot (swap if occupied)
      targetArr[idx] = srcName;
      const gear = readGearArray(); const tags = getGearTags(); const spans = getGearSpans(); const types = getGearTypes();
      for (let j = 0; j < (dragSrc.span??1); j++) { gear[dragSrc.idx+j]=''; spans[dragSrc.idx+j]=1; tags[dragSrc.idx+j]=''; types[dragSrc.idx+j]=''; }
      if (prevName) { gear[dragSrc.idx]=prevName; tags[dragSrc.idx]=''; types[dragSrc.idx]=''; spans[dragSrc.idx]=1; }
      if (state.char) { state.char.gear=gear; state.char.gear_spans=spans; state.char.gear_types=types; }
      renderGearGrid(gear, tags, spans, types);
      updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value??10, gear);
    } else if (dragSrc.kind === 'fc') {
      // Main fc → mount slot (swap if occupied)
      targetArr[idx] = srcName;
      const fcItems = getFCItems();
      fcItems[dragSrc.idx] = prevName ? { name:prevName, type:'', tag:'' } : { name:'', type:'', tag:'' };
      renderFreeCarryList(fcItems);
    }

    state.char.mounts_saved = saved;
    updateMountSection();
    scheduleAutoSave();
    dragSrc = null;
    return;
  }

  // ── mount-gear/fc → main gear or fc ───────────────────────────────────
  if (dragSrc.kind === 'mount-gear' || dragSrc.kind === 'mount-fc') {
    const saved = getMountsSaved();
    const mount = saved.find(m => m.id === dragSrc.mountId);
    if (!mount) { dragSrc = null; return; }
    const srcArr  = dragSrc.kind === 'mount-gear' ? mount.gear : mount.freeCarry;
    const srcName = dragSrc.name;

    if (kind === 'gear') {
      const gear=readGearArray(); const tags=getGearTags(); const spans=getGearSpans(); const types=getGearTypes();
      const cont = buildContMap(spans);
      if (cont[idx] !== undefined) { dragSrc = null; return; }
      const prevG = gear[idx]??'';
      gear[idx]=srcName; tags[idx]=''; types[idx]=''; spans[idx]=1;
      if (Array.isArray(srcArr)) srcArr[dragSrc.idx] = prevG; // swap
      if (state.char) { state.char.gear=gear; state.char.gear_spans=spans; state.char.gear_types=types; }
      renderGearGrid(gear, tags, spans, types);
      updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value??10, gear);
    } else if (kind === 'fc') {
      const fcItems=getFCItems();
      const prevFC = {...fcItems[idx]};
      fcItems[idx] = { name:srcName, type:'', tag:'' };
      if (Array.isArray(srcArr)) srcArr[dragSrc.idx] = prevFC.name??'';
      renderFreeCarryList(fcItems);
    }

    state.char.mounts_saved = saved;
    updateMountSection();
    scheduleAutoSave();
    dragSrc = null;
    return;
  }

  const gear    = readGearArray();
  const spans   = getGearSpans();
  const tags    = getGearTags();
  const types   = getGearTypes();
  const fcItems = getFCItems();
  const cont    = buildContMap(spans);
  const strVal  = document.querySelector('[data-field="str_score"]')?.value ?? 10;

  const _rerender = () => {
    if (state.char) { state.char.gear = gear; state.char.gear_spans = spans; state.char.gear_types = types; }
    renderGearGrid(gear, tags, spans, types);
    updateSlotsInfo(strVal, gear);
    renderFreeCarryList(fcItems);
    updateMountSection();
    scheduleAutoSave();
    scheduleAutoCompute();
  };

  // ── gear → gear ──
  if (dragSrc.kind === 'gear' && kind === 'gear') {
    const si   = dragSrc.idx;
    const span = dragSrc.span;
    const ti   = idx;
    if (cont[ti] !== undefined && cont[ti] !== si) { dragSrc = null; return; }

    const srcSlots = new Set(Array.from({ length: span }, (_, j) => si + j));

    // Check span fits at target (ignoring source slots)
    let canPlace = true;
    for (let j = 0; j < span; j++) {
      const t = ti + j;
      if (t >= 20) { canPlace = false; break; }
      if ((gear[t]?.trim() || cont[t] !== undefined) && !srcSlots.has(t)) { canPlace = false; break; }
    }
    if (!canPlace) { toast('Not enough space to drop here!'); dragSrc = null; return; }

    // Capture what's at target before clearing (single-slot swap)
    const swapName = gear[ti] ?? '';
    const swapTag  = tags[ti]  ?? '';
    const swapType = types[ti] ?? '';

    // Clear source
    for (let j = 0; j < span; j++) {
      gear[si + j] = ''; tags[si + j] = ''; types[si + j] = ''; spans[si + j] = 1;
    }
    // Swap: put old target item at source (only if single slot and not part of source)
    if (swapName && !srcSlots.has(ti)) {
      gear[si] = swapName; tags[si] = swapTag; types[si] = swapType; spans[si] = 1;
    }
    // Place dragged item at target
    gear[ti] = dragSrc.name; tags[ti] = dragSrc.tag; types[ti] = dragSrc.type; spans[ti] = span;
    for (let j = 1; j < span; j++) {
      gear[ti + j] = ''; tags[ti + j] = ''; types[ti + j] = ''; spans[ti + j] = 1;
    }
    _rerender();

  // ── gear → fc ──
  } else if (dragSrc.kind === 'gear' && kind === 'fc') {
    const si   = dragSrc.idx;
    const span = dragSrc.span;
    const fi   = idx;
    const prevFC = { ...fcItems[fi] };

    // Place dragged item in FC slot
    fcItems[fi] = { name: dragSrc.name, type: dragSrc.type, tag: '' };
    // Clear source gear span
    for (let j = 0; j < span; j++) {
      gear[si + j] = ''; tags[si + j] = ''; types[si + j] = ''; spans[si + j] = 1;
    }
    // If FC slot had an item and span=1, swap it to source
    if (prevFC.name && span === 1) {
      gear[si] = prevFC.name; tags[si] = prevFC.tag ?? ''; types[si] = prevFC.type ?? ''; spans[si] = 1;
    }
    _rerender();

  // ── fc → gear ──
  } else if (dragSrc.kind === 'fc' && kind === 'gear') {
    const fi = dragSrc.idx;
    const ti = idx;
    if (cont[ti] !== undefined) { dragSrc = null; return; }

    const prevGear = { name: gear[ti] ?? '', tag: tags[ti] ?? '', type: types[ti] ?? '' };
    gear[ti] = dragSrc.name; tags[ti] = dragSrc.tag; types[ti] = dragSrc.type; spans[ti] = 1;
    fcItems[fi] = prevGear.name
      ? { name: prevGear.name, type: prevGear.type, tag: prevGear.tag }
      : { name: '', type: '', tag: '' };
    _rerender();

  // ── fc → fc ──
  } else if (dragSrc.kind === 'fc' && kind === 'fc') {
    const fi = dragSrc.idx;
    const ti = idx;
    const temp = { ...fcItems[ti] };
    fcItems[ti] = { name: dragSrc.name, type: dragSrc.type, tag: dragSrc.tag };
    fcItems[fi] = temp;
    renderFreeCarryList(fcItems);
    scheduleAutoSave();
  }

  dragSrc = null;
}



// ═══════════════════════════════════════════════════════════════════════════
// MOUNT STABLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function getMountsSaved() {
  let s = state.char?.mounts_saved;
  if (typeof s === 'string') { try { s = JSON.parse(s); } catch(e) { s = []; } }
  if (!Array.isArray(s)) s = [];
  // keep state.char in sync so future calls see the array
  if (state.char) state.char.mounts_saved = s;
  return s;
}

function getMountAnimalData(animalName) {
  if (!animalName) return null;
  const key  = animalName.toLowerCase().trim();
  const list = state.refData.mounts ?? [];
  return list.find(m => m.Name?.toLowerCase().trim() === key)
      || list.find(m => { const k = (m.Name||'').toLowerCase().trim(); return k.startsWith(key) || key.startsWith(k); })
      || null;
}

function _invNameSet() {
  const g = readGearArray().filter(n => n?.trim()).map(n => n.toLowerCase().trim());
  const f = getFCItems().map(i => i.name).filter(n => n?.trim()).map(n => n.toLowerCase().trim());
  return new Set([...g, ...f]);
}

function _mountIsInPack(animalName, invSet) {
  if (!animalName) return false;
  const key = animalName.toLowerCase().trim();
  for (const n of invSet) {
    if (n === key || n.startsWith(key) || key.startsWith(n)) return true;
  }
  return false;
}

function _syncMountsTabVisibility() {
  const saved = getMountsSaved();
  const hasMounts = saved.length > 0;
  const mountTabBtn = document.querySelector('.tab-btn[data-tab="mounts"]');
  if (mountTabBtn) mountTabBtn.hidden = !hasMounts;
  // Toggle mount-move buttons in inventory
  const invPane = $('tab-inventory');
  if (invPane) invPane.classList.toggle('has-mounts', hasMounts);
  // If mounts tab was active but now hidden, switch to inventory
  if (!hasMounts && mountTabBtn?.classList.contains('active')) switchTab('inventory');
}

async function updateMountSection() {
  await buildItemLookup();

  const saved        = getMountsSaved();
  const inPackMounts = saved.filter(m => m.inPack);

  _syncMountsTabVisibility();

  const sec = $('mount-section');
  if (!sec) return;
  sec.hidden = inPackMounts.length === 0;

  const container = $('mount-cards');
  if (!container) return;
  container.innerHTML = '';
  inPackMounts.forEach(mount => {
    const data = getMountAnimalData(mount.animalName);
    container.appendChild(_buildMountCard(mount, data));
  });

  if ($('stable-drawer')?.classList.contains('open')) renderStableContent();
}

function _setMountInPack(id, inPackVal) {
  const s = getMountsSaved();
  const m = s.find(x => x.id === id);
  if (!m) return;
  m.inPack = inPackVal;
  state.char.mounts_saved = s;
  updateMountSection();          // immediate UI update from local state
  API.save(state.char.id, { mounts_saved: s }).then(updated => {
    state.char = updated;
    updateMountSection();        // re-render once DB confirms
  });
}

// ── Stabled (compact) row ──────────────────────────────────────────────────
function _buildMountStabledRow(mount, data) {
  const row = el('div', 'mount-stabled-row');
  row.dataset.mountId = mount.id;
  const display = mount.customName || mount.animalName;
  row.innerHTML = `
    <span class="mount-stabled-icon">🐴</span>
    <span class="mount-stabled-name">${escHtml(display)}</span>
    <span class="mount-stabled-type">${escHtml(mount.animalName)}</span>
    <span class="mount-status-badge stabled">Stabled</span>`;
  const del = el('button', 'mount-delete-btn', '🗑');
  del.title = 'Remove from stable';
  del.type  = 'button';
  del.onclick = () => _deleteSavedMount(mount.id);
  row.appendChild(del);
  return row;
}

// ── Full mount card (in-pack) ──────────────────────────────────────────────
function _buildMountCard(mount, data) {
  const carrySlots = data?.['Carry Slots'] ?? 10;
  const gear  = Array.isArray(mount.gear)      ? [...mount.gear]      : [];
  const fc    = Array.isArray(mount.freeCarry) ? [...mount.freeCarry] : [];
  while (gear.length < carrySlots) gear.push('');
  while (fc.length  < 5)          fc.push('');

  const card = el('div', 'mount-card');
  card.dataset.mountId = mount.id;

  // ── Header ──
  const hdr = el('div', 'mount-card-hdr');
  hdr.appendChild(el('span', 'mount-icon', '🐴'));

  const inp = document.createElement('input');
  inp.type         = 'text';
  inp.className    = 'mount-name-input input-name';
  inp.placeholder  = 'Name your mount…';
  inp.autocomplete = 'off';
  inp.value        = mount.customName ?? '';
  inp.dataset.mountId = mount.id;
  inp.addEventListener('input', () => {
    const s = getMountsSaved();
    const m = s.find(x => x.id === mount.id);
    if (!m) return;
    m.customName = inp.value;
    state.char.mounts_saved = s;
    scheduleAutoSave();
  });
  hdr.appendChild(inp);

  hdr.appendChild(el('span', 'mount-animal', escHtml(mount.animalName)));
  hdr.appendChild(el('span', 'mount-status-badge in-pack', '🎒 In Pack'));

  const removeBtn = el('button', 'mount-remove-pack-btn', '📤');
  removeBtn.type  = 'button';
  removeBtn.title = 'Remove from pack (returns to stable)';
  removeBtn.onclick = () => _setMountInPack(mount.id, false);
  hdr.appendChild(removeBtn);

  card.appendChild(hdr);

  // ── Stats ──
  if (data) {
    const monster = data['Monster sheet'] || '';
    const stats = el('div', 'mount-stats');
    stats.innerHTML = `
      <div class="mount-stat"><span class="mount-stat-lbl">Price</span>${escHtml(data.Cost||'—')}</div>
      <div class="mount-stat"><span class="mount-stat-lbl">Rarity</span>${escHtml(data.Rarity||'—')}</div>
      ${monster ? `<div class="mount-stat mount-monster-box"><span class="mount-stat-lbl">Monster</span><span class="mount-monster-text">${escHtml(monster)}</span></div>` : ''}
      <div class="mount-stat"><span class="mount-stat-lbl">Spooks</span>${escHtml(data['Spooks?']||'—')}</div>
      <div class="mount-stat"><span class="mount-stat-lbl">Carry</span>${carrySlots} slots</div>`;
    card.appendChild(stats);
  }
  const props = data?.properties || data?.Properties || '';
  if (props) card.appendChild(el('div', 'mount-props', escHtml(props)));

  // ── Carry inventory ──
  const carryWrap = el('div', 'mount-carry-wrap');

  // Gear slots column
  const gearCol = el('div', 'mount-carry-col');
  gearCol.appendChild(el('div', 'mount-carry-hdr', `🎒 Carry (${carrySlots})`));
  const gearGrid = el('div', 'mount-slots-grid');
  for (let i = 0; i < carrySlots; i++) gearGrid.appendChild(_buildMountSlot('gear', mount.id, i, gear[i]));
  gearCol.appendChild(gearGrid);
  carryWrap.appendChild(gearCol);

  // Free carry column
  const fcCol = el('div', 'mount-carry-col mount-fc-col');
  fcCol.appendChild(el('div', 'mount-carry-hdr', 'Free Carry'));
  const fcGrid = el('div', 'mount-slots-grid');
  for (let i = 0; i < 5; i++) fcGrid.appendChild(_buildMountSlot('fc', mount.id, i, fc[i]));
  fcCol.appendChild(fcGrid);
  carryWrap.appendChild(fcCol);

  card.appendChild(carryWrap);
  return card;
}

// ── Mount slot builder (gear or fc) ───────────────────────────────────────
function _buildMountSlot(kind, mountId, idx, value) {
  const slot = el('div', 'gear-slot mount-slot');
  slot.dataset.mountId   = mountId;
  slot.dataset.mountKind = kind;
  slot.dataset.mountIdx  = idx;
  slot.appendChild(el('span', 'gear-num', `${idx + 1}`));

  if (value) {
    const q = parseQty(value);
    const btn = el('button', 'gear-item-btn', q ? q.base : value);
    btn.type = 'button'; btn.dataset.gearValue = value; btn.title = value;
    slot.appendChild(btn);

    if (q) {
      btn.classList.add('has-qty');
      const widget = buildQtyWidget(value, newName => {
        const saved = getMountsSaved();
        const mount = saved.find(m => m.id === mountId);
        if (mount) {
          const arr = kind === 'gear' ? mount.gear : mount.freeCarry;
          if (Array.isArray(arr)) arr[idx] = newName;
          state.char.mounts_saved = saved;
          scheduleAutoSave();
        }
        btn.dataset.gearValue = newName;
        btn.title = newName;
      }, slot);
      if (widget) slot.appendChild(widget);
    }
    // Return to main inventory button
    const retBtn = el('button', 'gear-action-btn mount-return-btn', '↩');
    retBtn.type  = 'button';
    retBtn.title = 'Return to main inventory';
    retBtn.onclick = e => { e.stopPropagation(); _returnMountItemToInv(mountId, kind, idx); };
    slot.appendChild(retBtn);
    const clr = el('button', 'gear-clear-btn', '×');
    clr.type = 'button'; clr.title = 'Remove';
    clr.onclick = e => { e.stopPropagation(); _clearMountSlot(mountId, kind, idx); };
    slot.appendChild(clr);
  }

  slot.draggable = !!value;
  slot.addEventListener('dragstart', e => _invDragStart(e, 'mount-' + kind, idx, mountId));
  slot.addEventListener('dragend',   _invDragEnd);
  slot.addEventListener('dragover',  _invDragOver);
  slot.addEventListener('dragenter', _invDragEnter);
  slot.addEventListener('dragleave', _invDragLeave);
  slot.addEventListener('drop',      e => _invDrop(e, 'mount-' + kind, idx, mountId));
  return slot;
}

function _returnMountItemToInv(mountId, kind, idx) {
  const saved = getMountsSaved();
  const mount = saved.find(m => m.id === mountId);
  if (!mount) return;

  const arr  = kind === 'gear' ? mount.gear : mount.freeCarry;
  const name = Array.isArray(arr) ? (arr[idx] ?? '').trim() : '';
  if (!name) return;

  // Try to place in first empty main gear slot
  const gear   = readGearArray();
  const spans  = getGearSpans();
  const tags   = getGearTags();
  const types  = getGearTypes();
  const emptyG = gear.findIndex(g => !g);

  if (emptyG !== -1) {
    gear[emptyG] = name;
    if (state.char) state.char.gear = gear;
    renderGearGrid(gear, tags, spans, types);
    updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value ?? 10, gear);
  } else {
    // Gear full — add to free carry
    const fcItems = getFCItems();
    const emptyF  = fcItems.findIndex(f => !f.name);
    if (emptyF !== -1) {
      fcItems[emptyF] = { name, type: '', tag: '' };
    } else {
      fcItems.push({ name, type: '', tag: '' });
    }
    renderFreeCarryList(fcItems);
  }

  // Clear the mount slot
  if (Array.isArray(arr)) arr[idx] = '';
  state.char.mounts_saved = saved;
  scheduleAutoSave();

  // Patch the single mount DOM slot
  const sel    = `.mount-slot[data-mount-id="${CSS.escape(mountId)}"][data-mount-kind="${kind}"][data-mount-idx="${idx}"]`;
  const oldSlot = document.querySelector(sel);
  if (oldSlot) oldSlot.replaceWith(_buildMountSlot(kind, mountId, idx, ''));
}

function _clearMountSlot(mountId, kind, idx) {
  const saved = getMountsSaved();
  const mount = saved.find(m => m.id === mountId);
  if (!mount) return;
  const arr = kind === 'gear' ? mount.gear : mount.freeCarry;
  if (Array.isArray(arr)) arr[idx] = '';
  state.char.mounts_saved = saved;
  scheduleAutoSave();
  // Patch the single slot in DOM
  const selector = `.mount-slot[data-mount-id="${CSS.escape(mountId)}"][data-mount-kind="${kind}"][data-mount-idx="${idx}"]`;
  const oldSlot  = document.querySelector(selector);
  if (oldSlot) oldSlot.replaceWith(_buildMountSlot(kind, mountId, idx, ''));
}

function _deleteSavedMount(id) {
  const saved = getMountsSaved();
  const m     = saved.find(x => x.id === id);
  const label = m?.customName || m?.animalName || 'this mount';
  if (!confirm(`Remove "${label}" from your stable?\n\nThis cannot be undone.`)) return;
  state.char.mounts_saved = saved.filter(x => x.id !== id);
  scheduleAutoSave();
  updateMountSection();
  if ($('stable-drawer')?.classList.contains('open')) renderStableContent();
}

// ── Stable drawer ─────────────────────────────────────────────────────────

function toggleStable() {
  const d = $('stable-drawer');
  if (d?.classList.contains('open')) closeStable(); else openStable();
}

// ── Long Rest ──────────────────────────────────────────────────────────────
function openLongRest() {
  const failed = getSpellsFailed();
  // Eligible: 'rest' source, OR 'penance' source where paid:true. Penance-owed is hidden.
  const eligible = failed.filter(e => e.source === 'rest' || (e.source === 'penance' && e.paid));
  const pending  = failed.filter(e => e.source === 'penance' && !e.paid);
  const list   = $('lr-spells-list');
  const section = $('lr-spells-section');
  list.innerHTML = '';
  if (eligible.length || pending.length) {
    section.hidden = false;
    eligible.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'lr-spell-row';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = true; cb.value = entry.name;
      cb.id = 'lr-cb-' + CSS.escape(entry.name);
      const lbl = document.createElement('label');
      lbl.htmlFor = cb.id;
      lbl.textContent = entry.name + (entry.source === 'penance' ? ' (penance paid)' : '');
      li.appendChild(cb);
      li.appendChild(lbl);
      list.appendChild(li);
    });
    pending.forEach(entry => {
      const li = document.createElement('li');
      li.className = 'lr-spell-row lr-penance-owed';
      li.innerHTML = `<span class="lr-lock">🔒</span><span class="muted">${entry.name} — penance owed (${entry.cost} gp)</span>`;
      list.appendChild(li);
    });
  } else {
    section.hidden = true;
  }
  $('long-rest-overlay').hidden = false;
  $('long-rest-modal').hidden   = false;
}

function closeLongRest() {
  $('long-rest-overlay').hidden = true;
  $('long-rest-modal').hidden   = true;
}

function confirmLongRest() {
  if (!state.char) return;

  // Restore HP
  const hpMax = parseInt(document.querySelector('[data-field="hp_max"]')?.value) || 0;
  const hpField = document.querySelector('[data-field="hp_current"]');
  if (hpField) { hpField.value = hpMax; hpField.dispatchEvent(new Event('change')); }
  state.char.hp_current = hpMax;
  updateHPBar(hpMax, hpMax);

  // Restore selected spells
  const checked = Array.from($('lr-spells-list').querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
  const failed  = getSpellsFailed();
  state.char.spells_failed = failed.filter(e => !checked.includes(e.name));

  // Ungray restored spell buttons (and clear badge + penance classes).
  checked.forEach(name => {
    document.querySelectorAll('.spell-item').forEach(li => {
      const b = li.querySelector('.spell-btn');
      if (b?.dataset.spell?.trim() === name) applyFailureState(li, name);
    });
  });

  scheduleAutoSave();
  closeLongRest();
  toast('Long rest taken ☽');
}

function openStable() {
  renderStableContent();
  $('stable-drawer')?.classList.add('open');
  $('stable-overlay')?.classList.add('open');
}

function closeStable() {
  $('stable-drawer')?.classList.remove('open');
  $('stable-overlay')?.classList.remove('open');
}

function renderStableContent() {
  const content = $('stable-content');
  if (!content) return;
  const saved = getMountsSaved();

  if (!saved.length) {
    content.innerHTML = '<div class="stable-empty">No mounts yet.<br>Buy a mount from the catalog to add it here.</div>';
    return;
  }

  content.innerHTML = '';
  saved.forEach(mount => {
    const data = getMountAnimalData(mount.animalName);
    content.appendChild(_buildStableMountCard(mount, data));
  });
}

function _buildStableMountCard(mount, data) {
  const inPack = !!(mount.inPack);
  const card = el('div', 'stable-mount-card');
  card.dataset.mountId = mount.id;

  // ── Header ──
  const hdr = el('div', 'stable-mount-hdr');
  hdr.appendChild(el('span', 'mount-icon', '🐴'));

  const inp = document.createElement('input');
  inp.type         = 'text';
  inp.className    = 'mount-name-input input-name';
  inp.placeholder  = 'Name your mount…';
  inp.autocomplete = 'off';
  inp.value        = mount.customName ?? '';
  inp.dataset.mountId = mount.id;
  inp.addEventListener('input', () => {
    const s = getMountsSaved();
    const m = s.find(x => x.id === mount.id);
    if (!m) return;
    m.customName = inp.value; state.char.mounts_saved = s; scheduleAutoSave();
  });
  hdr.appendChild(inp);

  hdr.appendChild(el('span', 'mount-animal', mount.animalName));

  const packBtn = el('button', 'mount-pack-btn ' + (inPack ? 'in-pack' : ''), inPack ? '🎒 In Pack' : '➕ Add to Pack');
  packBtn.type  = 'button';
  packBtn.title = inPack ? 'Remove from pack' : 'Add to pack';
  packBtn.onclick = () => _setMountInPack(mount.id, !inPack);
  hdr.appendChild(packBtn);

  const del = el('button', 'mount-delete-btn', '🗑');
  del.type = 'button'; del.title = 'Remove from stable';
  del.onclick = () => _deleteSavedMount(mount.id);
  hdr.appendChild(del);
  card.appendChild(hdr);

  // ── Stats ──
  if (data) {
    const monster = data['Monster sheet'] || '';
    const stats = el('div', 'mount-stats');
    stats.innerHTML = `
      <div class="mount-stat"><span class="mount-stat-lbl">Price</span>${escHtml(data.Cost||'—')}</div>
      <div class="mount-stat"><span class="mount-stat-lbl">Rarity</span>${escHtml(data.Rarity||'—')}</div>
      ${monster ? `<div class="mount-stat mount-monster-box"><span class="mount-stat-lbl">Monster</span><span class="mount-monster-text">${escHtml(monster)}</span></div>` : ''}
      <div class="mount-stat"><span class="mount-stat-lbl">Spooks</span>${escHtml(data['Spooks?']||'—')}</div>
      <div class="mount-stat"><span class="mount-stat-lbl">Carry</span>${data['Carry Slots']??10} slots</div>`;
    card.appendChild(stats);
  }

  // ── Gear list ──
  const gear = Array.isArray(mount.gear)      ? mount.gear      : [];
  const fc   = Array.isArray(mount.freeCarry) ? mount.freeCarry : [];
  const hasGear = gear.some(g => g) || fc.some(f => f);

  const gearSec = el('div', 'stable-gear-section');
  gearSec.appendChild(el('div', 'stable-gear-hdr', hasGear ? '📦 Carried Items' : '📦 Carried Items'));

  if (hasGear) {
    gear.forEach((item, i) => {
      if (!item) return;
      const row = el('div', 'stable-gear-item');
      row.append(el('span', 'stable-slot-num', `${i+1}`), el('span', 'stable-item-name', item));
      const rm = el('button', 'gear-clear-btn', '×');
      rm.type = 'button'; rm.title = 'Remove item';
      rm.onclick = () => { _clearMountSlot(mount.id, 'gear', i); renderStableContent(); };
      row.appendChild(rm);
      gearSec.appendChild(row);
    });
    fc.forEach((item, i) => {
      if (!item) return;
      const row = el('div', 'stable-gear-item');
      row.append(el('span', 'stable-slot-num stable-fc-tag', 'FC'), el('span', 'stable-item-name', item));
      const rm = el('button', 'gear-clear-btn', '×');
      rm.type = 'button'; rm.title = 'Remove item';
      rm.onclick = () => { _clearMountSlot(mount.id, 'fc', i); renderStableContent(); };
      row.appendChild(rm);
      gearSec.appendChild(row);
    });
  } else {
    gearSec.appendChild(el('div', 'stable-no-gear', 'Nothing carried'));
  }
  card.appendChild(gearSec);
  return card;
}

// ── Inventory right-click context menu ────────────────────────────────────
function _closeCtxMenu() {
  const m = $('inv-ctx-menu');
  if (m) { m.hidden = true; m.innerHTML = ''; }
}

function _showMountMoveMenu(e, kind, idx) {
  _closeCtxMenu();

  const name = kind === 'gear'
    ? (readGearArray()[idx] ?? '').trim()
    : (getFCItems()[idx]?.name ?? '').trim();
  if (!name) return;

  const saved  = getMountsSaved();
  const inPack = saved.filter(m => m.inPack);

  if (!inPack.length) { toast('No mounts in your pack'); return; }

  // Only one mount — move directly without a menu
  if (inPack.length === 1) { _moveItemToMount(kind, idx, inPack[0].id); return; }

  // Multiple mounts — show dropdown anchored to the button
  const menu  = $('inv-ctx-menu');
  const label = el('div', 'inv-ctx-label', `Move "${escHtml(name)}" to:`);
  menu.appendChild(label);
  inPack.forEach(mount => {
    const btn = el('button', 'inv-ctx-item');
    btn.textContent = `🐴 ${mount.customName || mount.animalName}`;
    btn.onclick = () => { _moveItemToMount(kind, idx, mount.id); _closeCtxMenu(); };
    menu.appendChild(btn);
  });

  const rect = e.currentTarget.getBoundingClientRect();
  menu.style.left = Math.min(rect.left, window.innerWidth  - 210) + 'px';
  menu.style.top  = Math.min(rect.bottom + 4, window.innerHeight - 160) + 'px';
  menu.hidden     = false;
  setTimeout(() => document.addEventListener('click', _closeCtxMenu, { once: true }), 0);
}

function _moveItemToMount(kind, idx, mountId) {
  const saved = getMountsSaved();
  const mount = saved.find(m => m.id === mountId);
  if (!mount) return;

  const name = kind === 'gear'
    ? (readGearArray()[idx] ?? '').trim()
    : (getFCItems()[idx]?.name ?? '').trim();
  if (!name) return;

  // Find first empty slot in mount gear, then fc
  const data   = getMountAnimalData(mount.animalName);
  const slots  = data?.['Carry Slots'] ?? 10;
  const gear   = Array.isArray(mount.gear)      ? mount.gear      : [];
  const fc     = Array.isArray(mount.freeCarry) ? mount.freeCarry : [];
  while (gear.length < slots) gear.push('');
  while (fc.length   < 5)    fc.push('');

  const gi = gear.findIndex(g => !g);
  if (gi !== -1) {
    gear[gi] = name;
  } else {
    const fi = fc.findIndex(g => !g);
    if (fi === -1) { toast(`${mount.customName || mount.animalName}'s carry is full!`); return; }
    fc[fi] = name;
  }
  mount.gear      = gear;
  mount.freeCarry = fc;
  state.char.mounts_saved = saved;

  // Remove from main inventory
  if (kind === 'gear') onGearClear(idx);
  else removeFreeCarryItem(idx);

  updateMountSection();
  scheduleAutoSave();
}

function initInvContextMenu() {
  // Right-click transfer to mount removed — use the 🐴 button on each slot instead
}

// ── Auto-compute (attacks & AC from tagged items) ──────────────────────────
let autoComputeTimer = null;

function scheduleAutoCompute() {
  clearTimeout(autoComputeTimer);
  autoComputeTimer = setTimeout(runAutoCompute, 350);
}

async function runAutoCompute() {
  await Promise.all([autoComputeAttacks(), autoComputeAC()]);
}

function parseACString(acStr, dexMod) {
  const s = String(acStr || '').trim();
  if (!s) return null;
  // Shield / additive: "+1", "+2"
  if (s.startsWith('+')) return { type: 'additive', value: parseInt(s) || 1 };
  // "11 + DEX Mod" / "11 + DEX mod"
  if (/dex/i.test(s)) {
    const base = parseInt(s) || 10;
    return { type: 'base', value: base + dexMod };
  }
  // Plain number "13"
  const n = parseInt(s);
  if (!isNaN(n) && n > 0) return { type: 'base', value: n };
  return null;
}

async function autoComputeAttacks() {
  const tags    = getGearTags();
  const gear    = readGearArray();
  const wielded = gear.filter((name, i) => tags[i] === 'wielding' && name?.trim()).map(n => n.trim());

  const fcWielded = getFCItems()
    .filter(it => it.tag === 'wielding' && it.name?.trim())
    .map(it => it.name.trim());
  const allWielded = [...wielded, ...fcWielded];

  if (!allWielded.length) return;

  if (!state.refData.weapons) state.refData.weapons = await API.data('weapons');

  const strMod = mod(getEffectiveStat('str_score'));
  const dexMod = mod(getEffectiveStat('dex_score'));
  const finessePrefs = (state.char?.finesse_pref && typeof state.char.finesse_pref === 'object')
    ? state.char.finesse_pref : {};

  // Rebuild finesse state for renderAttackCards
  state.finesseWeapons = {};

  const lines = allWielded.map(name => {

    const w = state.refData.weapons.find(x => x.Weapon?.toLowerCase() === name.toLowerCase())
           || state.refData.weapons.find(x => name.toLowerCase().includes((x.Weapon||'').toLowerCase()) && x.Weapon);

    if (!w) return name; // unknown item — just show the name

    const isFinesse = (w.Properties || '').split(',').map(p => p.trim().toUpperCase()).includes('F');

    // Use the Type column to classify: M = melee, R = ranged, M/R = both
    const wType = (w.Type || 'M').toUpperCase().trim();
    const isMelee  = wType.includes('M');
    const isRanged = wType.includes('R');
    const isBoth   = isMelee && isRanged; // throwable M/R weapons

    function buildLine(rangedMode) {
      const displayName = isBoth ? `${w.Weapon} (${rangedMode ? 'ranged' : 'melee'})` : w.Weapon;
      let useMod = rangedMode ? dexMod : strMod;
      if (isFinesse && !rangedMode) {
        // Finesse: choose STR or DEX for melee; thrown ranged always uses DEX
        const defaultPref = dexMod > strMod ? 'dex' : 'str';
        const pref = finessePrefs[w.Weapon] || defaultPref;
        useMod = pref === 'dex' ? dexMod : strMod;
        state.finesseWeapons[displayName] = pref === 'dex' ? 'dex' : 'str';
      } else if (isFinesse && rangedMode && !isBoth) {
        // Pure ranged finesse weapon (e.g. special): allow STR/DEX choice
        const defaultPref = dexMod > strMod ? 'dex' : 'str';
        const pref = finessePrefs[w.Weapon] || defaultPref;
        useMod = pref === 'dex' ? dexMod : strMod;
        state.finesseWeapons[displayName] = pref === 'dex' ? 'dex' : 'str';
      }
      const atkBonus = calcBonusByType(rangedMode ? 'ranged_attack' : 'melee_attack', w.Weapon);
      const dmgBonus = calcBonusByType(rangedMode ? 'ranged_damage' : 'melee_damage', w.Weapon);
      const totalAtk = useMod + atkBonus;
      const totalDmg = useMod + dmgBonus;
      const atkSign  = totalAtk >= 0 ? `+${totalAtk}` : `${totalAtk}`;
      const dmgSign  = totalDmg > 0 ? `+${totalDmg}` : totalDmg < 0 ? `${totalDmg}` : '';
      const dmg      = (w.Damage || '—') + dmgSign;
      const rangePart = w.Range ? ` | ${w.Range}` : '';
      const props    = w.Properties ? ` [${w.Properties}]` : '';
      return `${displayName}  ${atkSign} to hit  /  ${dmg} dmg${rangePart}${props}`;
    }

    // M/R weapons get two lines: one melee, one ranged
    if (isBoth) return buildLine(false) + '\n' + buildLine(true);
    return buildLine(isRanged);
  });

  const attacksText = lines.join('\n');
  const attacksField = $('attacks-textarea');
  if (attacksField) attacksField.value = attacksText;
  if (!attacksEditMode) renderAttackCards(attacksText);
  scheduleAutoSave();
}

async function toggleFinesseWeapon(weaponName) {
  if (!state.char) return;
  if (!state.char.finesse_pref || typeof state.char.finesse_pref !== 'object') {
    state.char.finesse_pref = {};
  }
  const current = state.finesseWeapons?.[weaponName] || 'str';
  state.char.finesse_pref[weaponName] = current === 'str' ? 'dex' : 'str';
  await autoComputeAttacks();
}

async function autoComputeAC() {
  const tags = getGearTags();
  const gear = readGearArray();
  const worn = gear.filter((name, i) => tags[i] === 'wearing' && name?.trim()).map(n => n.trim());

  const fcWorn = getFCItems()
    .filter(it => it.tag === 'wearing' && it.name?.trim())
    .map(it => it.name.trim());
  const allWorn = [...worn, ...fcWorn];

  const acAutoTag = $('ac-auto-tag');

  if (!allWorn.length) {
    if (acAutoTag) acAutoTag.hidden = true;
    return;
  }

  if (!state.refData.armor) state.refData.armor = await API.data('armor');

  const dexMod = mod(getEffectiveStat('dex_score'));

  let baseAC = 10 + dexMod; // fallback: unarmored
  let bonus  = 0;
  let found  = false;

  allWorn.forEach(name => {
    const a = state.refData.armor.find(x => x.Armor?.toLowerCase() === name.toLowerCase())
           || state.refData.armor.find(x => name.toLowerCase().includes((x.Armor||'').toLowerCase()) && x.Armor);
    if (!a) return;
    const parsed = parseACString(a.AC, dexMod);
    if (!parsed) return;
    if (parsed.type === 'additive') {
      bonus += parsed.value;
      found = true;
    } else {
      if (!found || parsed.value > baseAC) baseAC = parsed.value;
      found = true;
    }
  });

  if (!found) return;

  // Add any flat AC bonuses from race/talents
  const raceTalentACBonus = [...getRaceBonuses(), ...getTalentBonuses()]
    .reduce((s, b) => b?.type === 'ac' ? s + (b.value || 0) : s, 0);

  const finalAC = baseAC + bonus + raceTalentACBonus;
  const acInput = document.querySelector('[data-field="armor_class"]');
  if (acInput) acInput.value = finalAC;
  if (acAutoTag) acAutoTag.hidden = false;
  scheduleAutoSave();
}

// ── Item list (talents / spells) ───────────────────────────────────────────
function renderItemList(listId, items, field) {
  const ul = $(listId);
  ul.innerHTML = '';
  const readonly = (field === 'talents');
  items.forEach((text, i) => {
    const li = el('li');
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = text ?? '';
    inp.placeholder = 'Talent description';
    if (readonly) {
      inp.readOnly = true;
      inp.style.pointerEvents = 'none';
      inp.style.background = 'transparent';
      inp.style.borderColor = 'transparent';
    } else {
      inp.addEventListener('input', () => scheduleAutoSave());
    }
    const btn = el('button', 'item-remove', '✕');
    btn.title = 'Remove';
    btn.onclick = () => removeListItem(listId, field, i);
    li.append(inp, btn);
    ul.appendChild(li);
  });
}

// ── Spell list (buttons with DC + hover card + dice roller) ────────────────
// Failure entry shape:
//   { name, source: 'rest' | 'penance', cost?: number, tier?: number, paid?: boolean }
// Migrates legacy string[] form on read.
function getSpellsFailed() {
  let f = state.char?.spells_failed;
  if (typeof f === 'string') { try { f = JSON.parse(f); } catch(e) { f = []; } }
  if (!Array.isArray(f)) return [];
  // Migrate legacy entries (strings → { name, source:'rest' }) AND drop garbage.
  let mutated = false;
  const out = f
    .map(e => {
      if (typeof e === 'string') { mutated = true; return { name: e, source: 'rest' }; }
      if (e && typeof e === 'object' && typeof e.name === 'string') return e;
      mutated = true;
      return null;
    })
    .filter(Boolean);
  if (mutated && state.char) state.char.spells_failed = out;
  return out;
}
function getSpellsFailedNames() { return getSpellsFailed().map(e => e.name); }
function findSpellFailure(name) {
  return getSpellsFailed().find(e => e.name === name) || null;
}
function setSpellFailure(entry) {
  if (!state.char) return;
  const failed = getSpellsFailed();
  const idx = failed.findIndex(e => e.name === entry.name);
  if (idx >= 0) failed[idx] = { ...failed[idx], ...entry };
  else failed.push(entry);
  state.char.spells_failed = failed;
  scheduleAutoSave();
}
function removeSpellFailure(name) {
  if (!state.char) return;
  state.char.spells_failed = getSpellsFailed().filter(e => e.name !== name);
  scheduleAutoSave();
}
// Mishap data — fetched lazily on first nat-1. Always an Array or null
// (never an error object — that crashes downstream `.find()` calls).
let _mishapData = null;
function loadMishapData() {
  if (Array.isArray(_mishapData)) return Promise.resolve(_mishapData);
  return API.data('spell_mishape_table')
    .then(d => { _mishapData = Array.isArray(d) ? d : null; return _mishapData; })
    .catch(() => { _mishapData = null; return null; });
}
function abilityToMishapClass(ab) {
  if (ab === 'int') return 'wizard';
  if (ab === 'wis') return 'priest';
  if (ab === 'cha') return 'witch';
  return null;
}
function findMishapBand(tableEntry, tier) {
  if (!tableEntry || tier == null) return null;
  for (const band of (tableEntry.table || [])) {
    const parts = String(band.tier).split('-').map(s => parseInt(s.trim()));
    const lo = parts[0];
    const hi = parts.length > 1 ? parts[1] : lo;
    if (!isNaN(lo) && tier >= lo && tier <= hi) return band;
  }
  return null;
}

function renderSpellList(items) {
  const ul = $('list-spells');
  ul.innerHTML = '';
  items.forEach((text, i) => {
    const li = makeSpellItem(text, i);
    if (text?.trim()) applyFailureState(li, text.trim());
    ul.appendChild(li);
  });
}

// Apply the failure visuals (gray + mishap badge) to a single spell <li>.
function applyFailureState(li, name) {
  const btn = li.querySelector('.spell-btn');
  if (!btn) return;
  const f = findSpellFailure(name);
  // Reset
  btn.classList.remove('spell-failed','penance-owed','penance-paid');
  btn.title = '';
  const oldBadge = btn.querySelector('.mishap-badge');
  if (oldBadge) oldBadge.remove();
  if (!f) return;
  btn.classList.add('spell-failed');
  // Build mishap badge — placed AFTER the DC badge.
  const dcBadge = btn.querySelector('.spell-dc-badge');
  const badge = document.createElement('span');
  badge.className = 'mishap-badge';
  if (f.source === 'penance') {
    btn.classList.add(f.paid ? 'penance-paid' : 'penance-owed');
    if (f.paid) {
      badge.textContent = '✓';
      badge.classList.add('penance-paid');
      badge.dataset.tooltip = 'Penance paid — recover at Long Rest';
    } else {
      badge.textContent = `${f.cost} gp`;
      badge.classList.add('penance-owed');
      badge.dataset.tooltip = `Penance owed · tap to pay · ${getPenanceText()}`;
    }
  } else if (f.mishap?.roll) {
    badge.textContent = f.mishap.roll;
    badge.classList.add('mishap-rolled');
    badge.dataset.tooltip = `${f.mishap.title} — ${f.mishap.description}`;
  } else if (f.mishap?.pending) {
    badge.textContent = 'Roll';
    badge.classList.add('mishap-pending');
    badge.dataset.tooltip = 'Tap to roll the d12 mishap';
  } else {
    // Normal rest-failure — no badge, just grayed.
    return;
  }
  badge.addEventListener('click', (e) => {
    e.stopPropagation();
    handleMishapBadgeClick(name, badge, btn);
  });
  if (dcBadge && dcBadge.nextSibling) dcBadge.parentNode.insertBefore(badge, dcBadge.nextSibling);
  else if (dcBadge) dcBadge.parentNode.appendChild(badge);
  else btn.appendChild(badge);
}

function getPenanceText() {
  return _mishapData?.find(e => e.class === 'priest')?.Penance
    || 'Penance requires a holy quest, ritualistic atonement, or a material sacrifice.';
}

// Mishap badge click — branches on failure source / state.
async function handleMishapBadgeClick(name, badge, btn) {
  const f = findSpellFailure(name);
  if (!f) return;
  if (f.source === 'penance' && !f.paid) {
    openPenancePopover(f.name, f.cost, f.tier, badge);
    return;
  }
  if (f.source === 'penance' && f.paid) return; // tooltip only
  if (f.source === 'rest' && f.mishap?.pending) {
    await loadMishapData();
    const cls = f.mishap.class;
    const tier = f.mishap.tier;
    const tableEntry = _mishapData?.find(e => e.class === cls);
    const band = findMishapBand(tableEntry, tier);
    if (!tableEntry || !band) { showInlineMishapPicker(name, cls, tier, badge, btn); return; }
    rollMishapInline(name, cls, tier, band, btn);
    return;
  }
  if (f.source === 'rest' && f.mishap?.roll) {
    // Re-roll (per Q8 b:2)
    await loadMishapData();
    const tableEntry = _mishapData?.find(e => e.class === f.mishap.class);
    const band = findMishapBand(tableEntry, f.mishap.tier);
    if (band) rollMishapInline(name, f.mishap.class, f.mishap.tier, band, btn);
  }
}

function rollMishapInline(name, mishapClass, tier, band, btn) {
  const roll = Math.floor(Math.random() * 12) + 1;
  const effect = (band.effects || []).find(e => parseInt(e.die) === roll)
              || (band.effects || [])[roll - 1]
              || { title: '—', description: '' };
  setSpellFailure({ name, source: 'rest', mishap: {
    pending: false, class: mishapClass, tier,
    roll, title: effect.title, description: effect.description
  }});
  // Re-render this spell row's badge.
  const li = btn.closest('.spell-item');
  if (li) applyFailureState(li, name);
  addDiceHistory(1, 12, 0, [roll], roll, `Mishap: ${effect.title}`);
  // Centered on-screen notification with Next button.
  showMishapNotification(name, roll, effect.title, effect.description);
}

function showMishapNotification(spellName, roll, title, description) {
  document.getElementById('mishap-notification')?.remove();
  const ov = document.createElement('div');
  ov.id = 'mishap-notification-overlay';
  ov.className = 'mishap-notification-overlay';
  const box = document.createElement('div');
  box.id = 'mishap-notification';
  box.className = 'mishap-notification';
  box.innerHTML = `
    <div class="mn-header">
      <span class="mn-die">${roll}</span>
      <div class="mn-meta">
        <div class="mn-spell">${escapeAttr(spellName)}</div>
        <div class="mn-label">Mishap rolled</div>
      </div>
    </div>
    <div class="mn-title">${escapeAttr(title)}</div>
    <div class="mn-desc">${escapeAttr(description)}</div>
    <div class="mn-actions">
      <button type="button" class="mn-next" id="mn-next">Next</button>
    </div>`;
  ov.appendChild(box);
  document.body.appendChild(ov);
  const close = () => ov.remove();
  document.getElementById('mn-next').onclick = close;
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

// Inline picker popover anchored to the badge (for ambiguous fumble cases).
function showInlineMishapPicker(name, mishapClass, tier, anchor, btn) {
  document.querySelector('.mishap-picker-popover')?.remove();
  const pop = document.createElement('div');
  pop.className = 'mishap-picker-popover';
  const classes = ['wizard', 'priest', 'witch'];
  let pickClass = mishapClass || null;
  let pickBand  = null;
  const render = () => {
    const te = _mishapData?.find(e => e.class === pickClass);
    const bands = (te?.table || []).map(b => b.tier);
    pop.innerHTML = `
      <div class="mpp-title">Pick mishap table</div>
      <div class="mpp-row">${classes.map(c => `<button type="button" class="chip ${c===pickClass?'active':''}" data-class="${c}">${c[0].toUpperCase()+c.slice(1)}</button>`).join('')}</div>
      <div class="mpp-row">${bands.length ? bands.map(b => `<button type="button" class="chip ${b===pickBand?'active':''}" data-tier="${escapeAttr(b)}">${b}</button>`).join('') : '<span class="muted">pick a table first</span>'}</div>
      <div class="mpp-actions">
        <button type="button" class="chip primary" data-act="roll" ${pickClass && pickBand ? '' : 'disabled'}>Roll</button>
        <button type="button" class="chip" data-act="skip">Skip</button>
      </div>`;
    pop.querySelectorAll('[data-class]').forEach(b => b.onclick = () => { pickClass = b.dataset.class; pickBand = null; render(); });
    pop.querySelectorAll('[data-tier]').forEach(b => b.onclick = () => { pickBand = b.dataset.tier; render(); });
    pop.querySelector('[data-act="roll"]').onclick = () => {
      const te = _mishapData?.find(e => e.class === pickClass);
      const band = te?.table?.find(b => b.tier === pickBand);
      if (te && band) {
        rollMishapInline(name, pickClass, parseInt(String(pickBand).split('-')[0]), band, btn);
        pop.remove();
      }
    };
    pop.querySelector('[data-act="skip"]').onclick = () => {
      setSpellFailure({ name, source: 'rest', mishap: null });
      const li = btn.closest('.spell-item');
      if (li) applyFailureState(li, name);
      pop.remove();
      addDiceHistory(0, 0, 0, [], 0, 'Mishap skipped');
    };
  };
  document.body.appendChild(pop);
  render();
  const r = anchor.getBoundingClientRect();
  pop.style.top  = (window.scrollY + r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8,
                                        window.scrollX + r.left)) + 'px';
  setTimeout(() => {
    const off = (e) => {
      if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener('mousedown', off); }
    };
    document.addEventListener('mousedown', off);
  }, 0);
}

function makeSpellItem(text, index) {
  const li = document.createElement('li');
  li.className = 'spell-item';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'spell-btn';
  btn.dataset.spell = text ?? '';

  const nameSpan = document.createElement('span');
  nameSpan.className = 'spell-btn-name';
  nameSpan.textContent = text || '—';
  btn.appendChild(nameSpan);

  const dcBadge = document.createElement('span');
  dcBadge.className = 'spell-dc-badge';
  dcBadge.textContent = 'DC —';
  btn.appendChild(dcBadge);

  if (text?.trim()) {
    buildItemLookup().then(() => {
      const found = findItem(text.trim());
      dcBadge.textContent = found?.item?.Tier != null
        ? `DC ${10 + parseInt(found.item.Tier)}`
        : 'DC —';
    });
  }

  btn.addEventListener('click', (e) => {
    // Badge handles its own click via stopPropagation; nothing else to do for failed spells.
    if (btn.classList.contains('spell-failed')) return;
    onSpellClick(text, btn);
  });

  const editBtn = document.createElement('button');
  editBtn.className = 'item-edit';
  editBtn.title = 'Rename';
  editBtn.textContent = '✎';
  editBtn.onclick = e => { e.stopPropagation(); startSpellEdit(li, index, text); };

  const removeBtn = document.createElement('button');
  removeBtn.className = 'item-remove';
  removeBtn.title = 'Remove';
  removeBtn.textContent = '✕';
  removeBtn.onclick = () => removeListItem('list-spells', 'spells', index);

  li.append(btn, editBtn, removeBtn);
  return li;
}

function startSpellEdit(li, index, currentValue) {
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = currentValue ?? '';
  inp.placeholder = 'Spell name…';
  inp.className = 'spell-edit-active';

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'item-edit';
  confirmBtn.title = 'Confirm';
  confirmBtn.textContent = '✓';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'item-remove';
  removeBtn.title = 'Remove';
  removeBtn.textContent = '✕';
  removeBtn.onclick = () => removeListItem('list-spells', 'spells', index);

  const save = () => {
    const items = getListItems('list-spells');
    items[index] = inp.value.trim();
    renderSpellList(items);
    scheduleAutoSave();
  };

  confirmBtn.onclick = save;
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') renderSpellList(getListItems('list-spells')); });
  inp.addEventListener('blur', () => setTimeout(save, 160));

  li.innerHTML = '';
  li.append(inp, confirmBtn, removeBtn);
  inp.focus(); inp.select();
}

async function onSpellClick(spellName, sourceBtn = null) {
  if (!spellName?.trim() || dice.rolling) return;
  dice.rolling = true;
  await loadMishapData();

  await buildItemLookup();
  const found = findItem(spellName.trim());

  const wRow = $('weapon-dmg-row');
  if (wRow) wRow.hidden = true;

  const sRow = $('spell-dc-row');
  if (!sRow) { dice.rolling = false; openDice(true); return; }

  const tier = found?.item?.Tier != null ? parseInt(found.item.Tier) : null;
  const dc   = tier != null ? 10 + tier : null;
  const displayName = spellName.length > 28 ? spellName.slice(0, 26) + '…' : spellName;

  $('spell-dc-name').textContent = displayName;
  $('spell-dc-val').textContent  = dc != null ? dc : '—';

  // Cast roll (ability mod + talent/race/class spellcast bonus)
  const ab         = state.spellcastingAbility;
  const abMod      = ab ? (getSheetMods()[ab] ?? 0) : 0;
  const spellBonus = calcBonusByType('spellcast');
  const castMod    = abMod + spellBonus;
  const castRoll   = Math.floor(Math.random() * 20) + 1;
  const castTotal  = castRoll + castMod;
  const isCrit   = castRoll === 20;
  const isFumble = castRoll === 1;

  const castEl = $('spell-cast-roll');
  castEl.className   = 'sdr-val';
  castEl.textContent = '…';

  setDieSides(20);
  openDice(true);           // openDice may call setAbilityMod which hides rows — show spell row AFTER
  wRow.hidden  = true;      // ensure weapon row stays hidden
  sRow.hidden  = false;     // show spell row last so nothing can undo it

  const face  = $('die-face');
  const numEl = $('die-num');
  face.style.setProperty('--dc', DIE_COLORS[20]);
  face.classList.remove('landing');
  face.classList.add('rolling');
  const fl = setInterval(() => { numEl.textContent = Math.floor(Math.random() * 20) + 1; }, 60);

  setTimeout(() => {
   try {
    clearInterval(fl);
    face.classList.remove('rolling');
    numEl.textContent = castRoll;
    face.classList.add('landing');

    $('roll-total').textContent = castTotal;
    void $('roll-total').offsetWidth;
    $('roll-total').classList.add('popped');

    const bonusStr = castMod >= 0 ? `+${castMod}` : `${castMod}`;
    const abLabel  = ab ? ` (${ab.toUpperCase()})` : '';
    $('roll-breakdown').textContent =
      `${displayName} — d20(${castRoll})${castMod !== 0 ? bonusStr : ''} = ${castTotal}${abLabel}${isCrit ? ' ★ CRIT' : isFumble ? ' ☠ FUMBLE' : ''}`;

    castEl.textContent = castTotal;
    void castEl.offsetWidth;
    castEl.className = 'sdr-val popped' + (isCrit ? ' crit' : isFumble ? ' fumble' : '');

    // Failure tree:
    //   nat 20 → success (already counted as crit, no lock)
    //   total < DC and not nat 1 → spell locks, source: 'rest' (any class)
    //   nat 1 (wizard/witch) → spell locks, source: 'rest', + mishap d12 button shown
    //   nat 1 (priest)       → spell locks, source: 'penance', + penance slot shown
    const name = spellName.trim();
    const mishapClass = abilityToMishapClass(ab);  // 'wizard'|'priest'|'witch'|null
    const normalFail = !isCrit && castTotal < (dc ?? -Infinity) && !isFumble;
    const restLock   = normalFail || (isFumble && mishapClass !== 'priest');
    const penanceLock = isFumble && mishapClass === 'priest';

    // Write failure entry into character data.
    if (penanceLock) {
      const cost = priestPenanceCost(tier);
      setSpellFailure({ name, source: 'penance', cost, tier, paid: false });
    } else if (isFumble && mishapClass && mishapClass !== 'priest') {
      // Wizard/Witch fumble — pending mishap roll (rolled inline via badge).
      setSpellFailure({ name, source: 'rest',
        mishap: { pending: true, class: mishapClass, tier } });
    } else if (restLock) {
      setSpellFailure({ name, source: 'rest' });
    }

    // Re-render the spell row so the badge appears immediately.
    if ((restLock || penanceLock) && sourceBtn) {
      const li = sourceBtn.closest('.spell-item');
      if (li) applyFailureState(li, name);
    }

    setTimeout(() => face.classList.remove('landing'), 450);
   } catch (err) {
    console.error('[onSpellClick] post-roll error:', err);
   } finally {
    dice.rolling = false;
   }
  }, 680);

  addDiceHistory(1, 20, castMod, [castRoll], castTotal);
}

// Clear any mishap / penance display in the dice-roller slot.
function clearMishapSlot() {
  const slot = $('sdr-mishap-col');
  if (!slot) return;
  slot.hidden = true;
  slot.innerHTML = '';
  slot.className = 'sdr-col sdr-mishap-col';
  state.pendingMishap = false;
}

// ── Wizard / Witch: Roll Mishap button ─────────────────────────────────────
function showMishapButton(spellName, mishapClass, tier) {
  const slot = $('sdr-mishap-col');
  if (!slot) return;
  slot.hidden = false;
  slot.innerHTML = `
    <div class="sdr-label">Mishap</div>
    <button type="button" class="sdr-mishap-btn" id="sdr-mishap-btn">Roll</button>`;
  slot.className = 'sdr-col sdr-mishap-col mishap-pending';
  state.pendingMishap = true;
  const btn = $('sdr-mishap-btn');
  btn.onclick = () => doMishapRoll(spellName, mishapClass, tier);
}

async function doMishapRoll(spellName, mishapClass, tier) {
  await loadMishapData();
  const tableEntry = _mishapData.find(e => e.class === mishapClass);
  const band = findMishapBand(tableEntry, tier);
  if (!tableEntry || !band) {
    showMishapPicker(spellName, mishapClass, tier);
    return;
  }
  rollMishapD12(spellName, mishapClass, tier, band);
}

function rollMishapD12(spellName, mishapClass, tier, band) {
  const slot = $('sdr-mishap-col');
  if (!slot) return;
  // d12 roll
  const roll = Math.floor(Math.random() * 12) + 1;
  const effect = (band.effects || []).find(e => parseInt(e.die) === roll)
              || (band.effects || [])[roll - 1]
              || { title: '—', description: '' };
  // Replace slot content with the result number.
  slot.innerHTML = `
    <div class="sdr-label">Mishap</div>
    <button type="button" class="sdr-mishap-btn rolled" id="sdr-mishap-btn"
      title="${escapeAttr(effect.title)} — ${escapeAttr(effect.description)}">${roll}</button>`;
  slot.className = 'sdr-col sdr-mishap-col mishap-rolled';
  const btn = $('sdr-mishap-btn');
  // Re-roll on tap (Q8 b:2).
  btn.onclick = () => rollMishapD12(spellName, mishapClass, tier, band);
  state.pendingMishap = false;  // allow new casts now
  // History entry with note (Q7 A).
  addDiceHistory(1, 12, 0, [roll], roll, `Mishap: ${effect.title}`);
}

// Lightweight HTML attribute escape for tooltip content.
function escapeAttr(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ── Ambiguity picker (Q3 C / Q6 C): smart pre-filled inline chips ──────────
function showMishapPicker(spellName, mishapClass, tier) {
  const slot = $('sdr-mishap-col');
  if (!slot) return;
  const classes = ['wizard', 'priest', 'witch'];
  const chosenClass = mishapClass || null;
  const tableEntry  = _mishapData?.find(e => e.class === chosenClass);
  const bands       = (tableEntry?.table || []).map(b => b.tier);
  const chosenBand  = (tier != null && findMishapBand(tableEntry, tier)?.tier) || null;

  slot.hidden = false;
  slot.className = 'sdr-col sdr-mishap-col mishap-picker';
  slot.innerHTML = `
    <div class="sdr-label">Pick Mishap</div>
    <div class="mishap-picker-row" id="mishap-pick-class">
      ${classes.map(c => `<button type="button" class="chip ${c===chosenClass?'active':''}" data-class="${c}">${c[0].toUpperCase()+c.slice(1)}</button>`).join('')}
    </div>
    <div class="mishap-picker-row" id="mishap-pick-tier">
      ${bands.length ? bands.map(b => `<button type="button" class="chip ${b===chosenBand?'active':''}" data-tier="${escapeAttr(b)}">${b}</button>`).join('') : '<span class="muted">pick a table first</span>'}
    </div>
    <div class="mishap-picker-actions">
      <button type="button" class="chip primary" id="mishap-pick-go">Roll</button>
      <button type="button" class="chip" id="mishap-pick-cancel">Skip</button>
    </div>`;

  let pickClass = chosenClass, pickBand = chosenBand;
  const rerender = () => showMishapPicker(spellName, pickClass, pickBand
    ? parseInt(String(pickBand).split('-')[0]) : null);

  slot.querySelectorAll('[data-class]').forEach(b => b.onclick = () => { pickClass = b.dataset.class; pickBand = null; rerender(); });
  slot.querySelectorAll('[data-tier]').forEach(b => b.onclick = () => { pickBand = b.dataset.tier; b.parentElement.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === b)); });
  $('mishap-pick-cancel').onclick = () => {
    clearMishapSlot();
    appendBreakdown(' · Mishap skipped');
    addDiceHistory(0, 0, 0, [], 0, 'Mishap skipped'); // no roll, just a marker
  };
  $('mishap-pick-go').onclick = () => {
    const te = _mishapData?.find(e => e.class === pickClass);
    const band = te?.table?.find(b => b.tier === pickBand);
    if (te && band) rollMishapD12(spellName, pickClass, parseInt(String(pickBand).split('-')[0]), band);
  };
}

function appendBreakdown(suffix) {
  const el = $('roll-breakdown');
  if (el) el.textContent = (el.textContent || '') + suffix;
}

// ── Priest: penance slot + popover ─────────────────────────────────────────
function showPenanceSlot(spellName, tier) {
  const slot = $('sdr-mishap-col');
  if (!slot) return;
  const cost = priestPenanceCost(tier);
  const penanceText = _mishapData?.find(e => e.class === 'priest')?.Penance
    || 'Penance requires a holy quest, ritualistic atonement, or a material sacrifice that you donate or destroy.';
  slot.hidden = false;
  slot.className = 'sdr-col sdr-mishap-col penance-pending';
  slot.innerHTML = `
    <div class="sdr-label">Penance</div>
    <button type="button" class="sdr-mishap-btn penance" id="sdr-mishap-btn"
      title="${escapeAttr(penanceText)}">${cost} gp</button>`;
  state.pendingMishap = true;
  const btn = $('sdr-mishap-btn');
  btn.onclick = () => openPenancePopover(spellName, cost, tier, btn);
}

// Single popover; anchored to a button (red slot or grayed spell button).
function openPenancePopover(spellName, cost, tier, anchor) {
  closePenancePopover();
  const pop = document.createElement('div');
  pop.id = 'penance-popover';
  pop.className = 'penance-popover';
  const curGP = parseInt(document.querySelector('[data-field="gp"]')?.value) || 0;
  const canPay = curGP >= cost;
  const penanceText = _mishapData?.find(e => e.class === 'priest')?.Penance || '';
  pop.innerHTML = `
    <div class="pp-title">${escapeAttr(spellName)} — Penance</div>
    <div class="pp-cost">Tier ${tier} · ${cost} gp · you have ${curGP} gp</div>
    <div class="pp-note">${escapeAttr(penanceText)}</div>
    <div class="pp-actions">
      <button type="button" class="chip primary" id="pp-pay" ${canPay ? '' : 'disabled title="Not enough gold"'}>Pay ${cost} gp</button>
      <button type="button" class="chip" id="pp-mark">Mark done</button>
      <button type="button" class="chip" id="pp-cancel">Cancel</button>
    </div>`;
  document.body.appendChild(pop);
  // Position near anchor.
  const r = anchor.getBoundingClientRect();
  pop.style.top  = (window.scrollY + r.bottom + 6) + 'px';
  pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8,
                                        window.scrollX + r.left)) + 'px';
  // Dismiss on outside click.
  setTimeout(() => {
    const off = (e) => {
      if (!pop.contains(e.target) && e.target !== anchor) { closePenancePopover(); document.removeEventListener('mousedown', off); }
    };
    document.addEventListener('mousedown', off);
  }, 0);
  $('pp-cancel').onclick = closePenancePopover;
  $('pp-pay').onclick = () => {
    if (!canPay) return;
    const gpField = document.querySelector('[data-field="gp"]');
    if (gpField) {
      gpField.value = String(curGP - cost);
      gpField.dispatchEvent(new Event('change'));
      gpField.dispatchEvent(new Event('input'));
    }
    markPenancePaid(spellName);
    closePenancePopover();
    toast(`Paid ${cost} gp — ${spellName} recoverable at Long Rest`);
  };
  $('pp-mark').onclick = () => {
    markPenancePaid(spellName);
    closePenancePopover();
    toast(`Penance marked done — ${spellName} recoverable at Long Rest`);
  };
}
function closePenancePopover() {
  const p = $('penance-popover');
  if (p) p.remove();
}
function markPenancePaid(spellName) {
  setSpellFailure({ name: spellName, source: 'penance', paid: true });
  // Re-render the spell row so badge updates.
  document.querySelectorAll('.spell-item').forEach(li => {
    const b = li.querySelector('.spell-btn');
    if (b?.dataset.spell?.trim() === spellName) applyFailureState(li, spellName);
  });
}

// Priest penance cost per tier — falls back to RAW values if json absent.
function priestPenanceCost(tier) {
  const RAW = { 1: 5, 2: 20, 3: 40, 4: 90, 5: 150 };
  if (_mishapData) {
    const pri = _mishapData.find(e => e.class === 'priest');
    const band = (pri?.table || []).find(b => String(b.tier) === String(tier));
    if (band?.value) {
      const m = String(band.value).match(/(\d+)/);
      if (m) return parseInt(m[1]);
    }
  }
  return RAW[tier] ?? 0;
}

function addListItem(field) {
  if (field === 'spells') {
    const items = getListItems('list-spells');
    const newIndex = items.length;
    items.push('');
    renderSpellList(items);
    const lastLi = $('list-spells').lastElementChild;
    if (lastLi) startSpellEdit(lastLi, newIndex, '');
    scheduleAutoSave();
    return;
  }
  const listId = `list-${field}`;
  const items = getListItems(listId);
  items.push('');
  renderItemList(listId, items, field);
  const inputs = $(listId).querySelectorAll('input');
  if (inputs.length) inputs[inputs.length-1].focus();
  scheduleAutoSave();
}

// ── Talent Picker ─────────────────────────────────────────────────────────
async function openTalentPicker() {
  if (!state.refData.class_talents) state.refData.class_talents = await API.data('class_talents');

  const className   = $('class-select')?.value || '';
  const talentData  = (state.refData.class_talents || []).find(c => c.class === className);

  const title  = $('talent-modal-title');
  const body   = $('talent-modal-body');
  title.textContent = className ? `🎲 ${className} Talents` : '🎲 Talents';
  body.innerHTML = '';

  if (!className) {
    body.innerHTML = '<p class="talent-no-class">Select a class in the Identity section first.</p>';
  } else {
    // ── Talent table ─────────────────────────────────────────────────────
    if (talentData?.table?.length) {
      const tLabel = el('div', 'talent-section-label', `Talent Table (${talentData.die || '2d6'})`);
      body.appendChild(tLabel);

      // Roll button
      const rollRow = el('div', 'talent-roll-row');
      const rollBtn = el('button', 'talent-roll-btn', `🎲 Roll ${talentData.die || '2d6'}`);
      rollBtn.onclick = () => rollTalentDice(talentData);
      rollRow.appendChild(rollBtn);
      body.appendChild(rollRow);

      const tList = el('ul', 'talent-table-list');
      tList.id = 'talent-table-rows';
      talentData.table.forEach(entry => {
        const li = el('li', 'talent-table-row');
        li.dataset.roll = entry.roll;
        const badge = el('span', 'talent-roll-badge', entry.roll);
        const effect = el('span', 'talent-table-effect', entry.effect);
        const pickBtn = el('button', 'talent-pick-btn', 'Add');
        pickBtn.title = 'Add to talents list';
        pickBtn.onclick = () => addTalentEntry(entry.effect);
        li.append(badge, effect, pickBtn);
        tList.appendChild(li);
      });
      body.appendChild(tList);

      // Subtable (Ras-Godai Black Lotus, Wyrdling Corruption)
      if (talentData.subtable) {
        const sub = talentData.subtable;
        const subSep   = el('div', 'talent-sep');
        const subLabel = el('div', 'talent-section-label', `${sub.name} (${sub.die})`);
        body.appendChild(subSep);
        body.appendChild(subLabel);

        const rollRow2 = el('div', 'talent-roll-row');
        const rollBtn2 = el('button', 'talent-roll-btn talent-roll-btn--sub', `🎲 Roll ${sub.die}`);
        rollBtn2.onclick = () => rollSubtableDice(sub);
        rollRow2.appendChild(rollBtn2);
        body.appendChild(rollRow2);

        const subList = el('ul', 'talent-table-list');
        subList.id = 'talent-subtable-rows';
        sub.entries.forEach(entry => {
          const li = el('li', 'talent-table-row');
          li.dataset.roll = entry.roll;
          const badge  = el('span', 'talent-roll-badge', entry.roll);
          const effect = el('span', 'talent-table-effect', entry.effect);
          const pickBtn = el('button', 'talent-pick-btn', 'Add');
          pickBtn.title = 'Add to talents list';
          pickBtn.onclick = () => addTalentEntry(entry.effect);
          li.append(badge, effect, pickBtn);
          subList.appendChild(li);
        });
        body.appendChild(subList);
      }

      // Note
      if (talentData.note) {
        const note = el('p', 'talent-note', '📝 ' + talentData.note);
        body.appendChild(note);
      }
    }
  }

  $('talent-overlay').hidden = false;
  $('talent-modal').hidden   = false;
}

function closeTalentPicker() {
  $('talent-overlay').hidden = true;
  $('talent-modal').hidden   = true;
}

function rollTalentDice(talentData) {
  const die = talentData.die || '2d6';
  const [count, sides] = die.toLowerCase().split('d').map(Number);
  let total = 0;
  for (let i = 0; i < count; i++) total += Math.floor(Math.random() * sides) + 1;

  // Highlight matching row
  document.querySelectorAll('#talent-table-rows .talent-table-row').forEach(li => {
    li.classList.remove('talent-row-hit');
    const range = li.dataset.roll;
    if (rollInRange(total, range)) li.classList.add('talent-row-hit');
  });

  toast(`Rolled ${total} on ${die}`);
}

function rollSubtableDice(sub) {
  const die = sub.die || 'd6';
  const [count, sides] = die.toLowerCase().replace(/^(\d*)d/, (_, c) => (c || '1') + 'd').split('d').map(Number);
  const cnt = isNaN(count) ? 1 : count;
  let total = 0;
  for (let i = 0; i < cnt; i++) total += Math.floor(Math.random() * sides) + 1;

  document.querySelectorAll('#talent-subtable-rows .talent-table-row').forEach(li => {
    li.classList.remove('talent-row-hit');
    if (rollInRange(total, li.dataset.roll)) li.classList.add('talent-row-hit');
  });

  toast(`Rolled ${total} on ${sub.die}`);
}

function rollInRange(total, rangeStr) {
  const str = String(rangeStr).trim();
  if (str.includes('-')) {
    const [lo, hi] = str.split('-').map(Number);
    return total >= lo && total <= hi;
  }
  return total === parseInt(str);
}

function addTalentEntry(text) {
  const items    = getListItems('list-talents');
  const newIndex = items.length;
  items.push(text);
  renderItemList('list-talents', items, 'talents');
  closeTalentPicker();
  toast('Talent added ✓');
  // Apply the mechanical bonus (may open stat-choice modal)
  applyTalentEffect(text, newIndex);
}

function removeListItem(listId, field, index) {
  // Remove the associated bonus before splicing the list
  if (field === 'talents') removeTalentEffect(index);
  const items = getListItems(listId);
  items.splice(index, 1);
  if (field === 'spells') renderSpellList(items);
  else renderItemList(listId, items, field);
  scheduleAutoSave();
}

function getListItems(listId) {
  const ul = $(listId);
  if (!ul) return [];
  if (listId === 'list-spells') {
    return Array.from(ul.querySelectorAll('li')).map(li => {
      const inp = li.querySelector('.spell-edit-active');
      if (inp) return inp.value;
      return li.querySelector('.spell-btn')?.dataset.spell ?? '';
    });
  }
  return Array.from(ul.querySelectorAll('input')).map(i => i.value);
}

// ── Auto-save ──────────────────────────────────────────────────────────────
function scheduleAutoSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, 700);
  setSaving();
}

function setSaving() {
  const ind = $('save-indicator');
  ind.textContent = 'Saving…';
  ind.className = 'save-indicator saving';
}

function saveNow() {
  if (!state.char) return;
  const data = collectSheetData();
  API.save(state.char.id, data).then(updated => {
    state.char = updated;
    // Re-sync base values from DB response so they don't drift
    ALL_STATS.forEach(f => { state._statBases[f] = updated[f] ?? 10; });
    state._hpMaxBase = updated.hp_max ?? 8;
    const ind = $('save-indicator');
    ind.textContent = 'Saved ✓';
    ind.className = 'save-indicator saved';
    setTimeout(() => { ind.textContent = ''; ind.className = 'save-indicator'; }, 2000);
    $('sheet-char-name-header').textContent = updated.name;
    updateHPBar(updated.hp_current, updated.hp_max);
    updateXPBar(updated.xp, updated.xp_target);
    updateCoinTotal(updated.gp, updated.sp, updated.cp, updated.eth);
    refreshStatBonusDisplay(); // updates modifiers + badges + slots
    syncExpandedHeader();
  });
}

function collectSheetData() {
  const data = {};
  document.querySelectorAll('[data-field]').forEach(inp => {
    const f = inp.dataset.field;
    const v = inp.value;
    if (['str_score','dex_score','con_score','int_score','wis_score','cha_score',
         'level','xp','xp_target','hp_max','hp_current','armor_class','gp','sp','cp','eth'].includes(f)) {
      data[f] = parseInt(v) || 0;
    } else {
      data[f] = v;
    }
  });
  // Save BASE ability scores (not effective / displayed values)
  ALL_STATS.forEach(f => { data[f] = state._statBases?.[f] ?? (parseInt(document.querySelector(`[data-field="${f}"]`)?.value)||10); });
  // Save BASE hp_max (without HP bonuses)
  data.hp_max = state._hpMaxBase ?? (parseInt(document.querySelector('[data-field="hp_max"]')?.value)||0);
  // Attacks always read from the hidden textarea
  data.attacks = $('attacks-textarea')?.value ?? data.attacks ?? '';
  // Alignment
  const activeAlign = document.querySelector('.align-btn.active');
  if (activeAlign) data.alignment = activeAlign.dataset.align;
  // Gear array + tags + spans + types + free carry
  data.gear             = readGearArray();
  data.gear_tags        = getGearTags();
  data.gear_spans       = getGearSpans();
  data.gear_types       = getGearTypes();
  data.free_carry_items = getFCItems();
  // Talents
  data.talents = getListItems('list-talents');
  // Spells
  data.spells = getListItems('list-spells');
  // Portrait
  const portraitImg = $('portrait-img');
  data.portrait = (portraitImg && !portraitImg.hidden) ? portraitImg.src : '';
  // Spellcasting ability
  data.spellcasting_ability = state.spellcastingAbility ?? null;
  // Mounts: read custom names from DOM into state before saving
  document.querySelectorAll('.mount-name-input[data-mount-id]').forEach(inp => {
    const saved = getMountsSaved();
    const m = saved.find(x => x.id === inp.dataset.mountId);
    if (m) m.customName = inp.value;
  });
  data.mounts_saved    = getMountsSaved();
  data.spells_failed   = state.char?.spells_failed   ?? [];
  data.finesse_pref    = state.char?.finesse_pref    ?? {};
  data.talent_bonuses  = state.char?.talent_bonuses  ?? [];
  data.race_bonuses    = state.char?.race_bonuses    ?? [];
  data.weapon_mastery    = state.char?.weapon_mastery    ?? '';
  data.languages_manual  = state.char?.languages_manual  ?? '';
  return data;
}

// ── Visual updates ─────────────────────────────────────────────────────────
function updateHPBar(current, max) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (current/max)*100)) : 0;
  const bar = $('hp-bar');
  bar.style.width = pct + '%';
  bar.style.background = pct > 60 ? 'var(--hp-full)' : pct > 25 ? 'var(--hp-med)' : 'var(--hp-low)';
  const status = $('hp-status');
  if (current <= 0) {
    status.textContent = 'Unconscious'; status.style.color = 'var(--text-danger)';
  } else if (pct <= 25) {
    status.textContent = 'Critical!'; status.style.color = 'var(--hp-low)';
  } else if (pct <= 60) {
    status.textContent = 'Wounded'; status.style.color = 'var(--hp-med)';
  } else {
    status.textContent = 'Full'; status.style.color = 'var(--accent-green)';
  }
}

function updateXPBar(xp, target) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (xp/target)*100)) : 0;
  $('xp-bar').style.width = pct + '%';
}

function maxGearSlots(strScore) {
  const s = parseInt(strScore) || 10;
  return s < 10 ? 10 : s;
}

function updateSlotsInfo(strScore, gear) {
  _updateSlotsDisplay(strScore, gear);
}

function _updateSlotsDisplay(strScore, gear) {
  const bonus = state._gearSlotBonus || 0;
  const max   = maxGearSlots(strScore) + bonus;
  const used  = (Array.isArray(gear) ? gear : []).filter(g => g && g.trim()).length;
  $('slots-used').textContent = used;
  $('slots-max').textContent  = max;
  $('slots-used').style.color = used > max ? '#f87171' : '';
  const note = $('slots-note') ?? document.querySelector('.slots-note');
  if (note) note.textContent = bonus > 0 ? `(STR ${parseInt(strScore)||10} + ${bonus} bonus)` : '(= STR score)';
}

// ── Currency helpers ────────────────────────────────────────────────────────
function parseCostToCp(costStr) {
  if (costStr == null) return null;
  const s = String(costStr).toLowerCase().replace(/\s+/g, '');
  if (!s || s === '-' || s === '—') return null;
  if (s.startsWith('x') || s === 'half') return null;            // modifier costs
  const m = s.match(/^(\d+(?:\.\d+)?)(gp|sp|cp)?$/);
  if (!m) return null;
  const val  = parseFloat(m[1]);
  const unit = m[2] || 'gp';
  if (unit === 'gp') return Math.round(val * 100);
  if (unit === 'sp') return Math.round(val * 10);
  return Math.round(val);                                         // cp
}

function getTotalCp() {
  const v = f => parseInt(document.querySelector(`[data-field="${f}"]`)?.value) || 0;
  return (v('gp') + v('eth')) * 100 + v('sp') * 10 + v('cp');
}

function deductCurrency(cpCost) {
  const inp = f => document.querySelector(`[data-field="${f}"]`);
  let gp  = parseInt(inp('gp')?.value)  || 0;
  let sp  = parseInt(inp('sp')?.value)  || 0;
  let cp  = parseInt(inp('cp')?.value)  || 0;
  let eth = parseInt(inp('eth')?.value) || 0;

  const total = (gp + eth) * 100 + sp * 10 + cp;
  if (total < cpCost) return false;

  let remain = total - cpCost;
  // Keep ETH intact if possible, fill GP then SP then CP from remainder
  const newEth = Math.min(eth, Math.floor(remain / 100));
  remain -= newEth * 100;
  const newGp = Math.floor(remain / 100);
  remain     -= newGp * 100;
  const newSp = Math.floor(remain / 10);
  const newCp = remain % 10;

  if (inp('gp'))  inp('gp').value  = newGp;
  if (inp('sp'))  inp('sp').value  = newSp;
  if (inp('cp'))  inp('cp').value  = newCp;
  if (inp('eth')) inp('eth').value = newEth;
  scheduleAutoSave();
  return true;
}

// ── Manual currency add modal ───────────────────────────────────────────────
function openAddCurrency() {
  const existing = $('add-currency-modal');
  if (existing) { existing.remove(); return; }

  const modal = el('div', 'add-currency-modal');
  modal.id = 'add-currency-modal';
  modal.dataset.acmMode = 'add';
  modal.innerHTML = `
    <div class="acm-toggle">
      <button class="acm-tab acm-add acm-tab-active" id="acm-tab-add" onclick="acmSetMode('add')">＋ Add</button>
      <button class="acm-tab acm-sub" id="acm-tab-sub" onclick="acmSetMode('sub')">− Subtract</button>
    </div>
    <div class="acm-row">
      <div class="acm-field">
        <div class="acm-field-top"><span class="acm-coin acm-coin-gp"></span><span class="acm-lbl">Gold (GP)</span></div>
        <input class="acm-inp" id="acm-gp" type="number" min="0" value="0" placeholder="0">
      </div>
      <div class="acm-field">
        <div class="acm-field-top"><span class="acm-coin acm-coin-sp"></span><span class="acm-lbl">Silver (SP)</span></div>
        <input class="acm-inp" id="acm-sp" type="number" min="0" value="0" placeholder="0">
      </div>
      <div class="acm-field">
        <div class="acm-field-top"><span class="acm-coin acm-coin-cp"></span><span class="acm-lbl">Copper (CP)</span></div>
        <input class="acm-inp" id="acm-cp" type="number" min="0" value="0" placeholder="0">
      </div>
      <div class="acm-field">
        <div class="acm-field-top"><span class="acm-coin acm-coin-eth"></span><span class="acm-lbl">Electrum (ETH)</span></div>
        <input class="acm-inp" id="acm-eth" type="number" min="0" value="0" placeholder="0">
      </div>
    </div>
    <div class="acm-btns">
      <button class="acm-btn acm-confirm" id="acm-confirm-btn" onclick="confirmAddCurrency()">Add</button>
      <button class="acm-btn acm-cancel"  onclick="$('add-currency-modal')?.remove()">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
  $('acm-gp').focus();
  setTimeout(() => {
    document.addEventListener('click', function _acmOutside(e) {
      if (!$('add-currency-modal')?.contains(e.target)) {
        $('add-currency-modal')?.remove();
        document.removeEventListener('click', _acmOutside);
      }
    });
  }, 0);
}

function acmSetMode(mode) {
  const modal = $('add-currency-modal');
  if (!modal) return;
  modal.dataset.acmMode = mode;
  const tabAdd = $('acm-tab-add'), tabSub = $('acm-tab-sub');
  const btn    = $('acm-confirm-btn');
  if (mode === 'add') {
    tabAdd.classList.add('acm-tab-active');    tabSub.classList.remove('acm-tab-active');
    btn.textContent = 'Add';
    btn.style.background = '';  btn.style.color = '';
  } else {
    tabSub.classList.add('acm-tab-active');    tabAdd.classList.remove('acm-tab-active');
    btn.textContent = 'Subtract';
    btn.style.background = '#5a1010'; btn.style.color = '#f5e8d0';
  }
}

function confirmAddCurrency() {
  const modal  = $('add-currency-modal');
  const mode   = modal?.dataset.acmMode ?? 'add';
  const delta  = id => parseInt($(`acm-${id}`)?.value) || 0;
  const inp    = f  => document.querySelector(`[data-field="${f}"]`);
  const cur    = f  => parseInt(inp(f)?.value) || 0;

  if (mode === 'add') {
    if (inp('gp'))  inp('gp').value  = cur('gp')  + delta('gp');
    if (inp('sp'))  inp('sp').value  = cur('sp')  + delta('sp');
    if (inp('cp'))  inp('cp').value  = cur('cp')  + delta('cp');
    if (inp('eth')) inp('eth').value = cur('eth') + delta('eth');
    toast('Currency added!');
  } else {
    // Convert everything to CP, subtract, then redistribute
    const removeCp = (delta('gp') + delta('eth')) * 100 + delta('sp') * 10 + delta('cp');
    const haveCp   = getTotalCp();
    if (removeCp > haveCp) {
      toast("Not enough currency to subtract that amount.");
      return;
    }
    let remain = haveCp - removeCp;
    const ethCur = cur('eth');
    const newEth = Math.min(ethCur, Math.floor(remain / 100));
    remain -= newEth * 100;
    const newGp  = Math.floor(remain / 100); remain -= newGp  * 100;
    const newSp  = Math.floor(remain / 10);  remain -= newSp  * 10;
    const newCp  = remain;
    if (inp('gp'))  inp('gp').value  = newGp;
    if (inp('sp'))  inp('sp').value  = newSp;
    if (inp('cp'))  inp('cp').value  = newCp;
    if (inp('eth')) inp('eth').value = newEth;
    toast('Currency subtracted!');
  }
  $('add-currency-modal')?.remove();
  scheduleAutoSave();
}

function updateCoinTotal(gp, sp, cp, eth) {
  const el = $('coin-total');
  if (!el) return;
  const total = (parseInt(gp)||0) + ((parseInt(sp)||0)/10) + ((parseInt(cp)||0)/100);
  el.textContent = `≈ ${total.toFixed(2)} gp equivalent`;
}

// ── Layout toggle ──────────────────────────────────────────────────────────
function applyLayout(layout) {
  const pc = $('panels-container');
  pc.classList.toggle('layout-landscape', layout === 'landscape');
  pc.classList.toggle('layout-portrait',  layout === 'portrait');
}

function autoLayout() {
  const layout = window.innerWidth >= 768 ? 'landscape' : 'portrait';
  if (state.layout === layout) return;
  state.layout = layout;
  applyLayout(layout);
  if (state.sortable) { state.sortable.destroy(); state.sortable = null; }
  initSortable();
}

// ── Sortable (drag-and-drop panels) ───────────────────────────────────────
function initSortable() {
  if (!window.Sortable) return;
  const container = $('panels-container');
  state.sortable = Sortable.create(container, {
    handle: '.drag-handle',
    animation: 180,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onEnd: () => {
      if (!state.char) return;
      const order = Array.from(container.querySelectorAll('.panel')).map(p => p.dataset.panel);
      API.save(state.char.id, {panel_order: order});
    }
  });
  // Restore saved order
  if (state.char?.panel_order?.length) {
    const panels = {};
    container.querySelectorAll('.panel').forEach(p => panels[p.dataset.panel] = p);
    state.char.panel_order.forEach(key => {
      if (panels[key]) container.appendChild(panels[key]);
    });
  }
}

// ── Reference drawer ───────────────────────────────────────────────────────
function openReference(table) {
  state.refTable = table || 'weapons';
  $('drawer-overlay').classList.add('open');
  $('reference-drawer').classList.add('open');
  document.body.style.overflow = 'hidden';
  document.querySelectorAll('.dtab').forEach(t => t.classList.toggle('active', t.dataset.table === state.refTable));
  loadRefTable(state.refTable);
}

function closeReference() {
  $('drawer-overlay').classList.remove('open');
  $('reference-drawer').classList.remove('open');
  document.body.style.overflow = '';
}

function loadRefTable(table) {
  state.refTable = table;
  _updateClassFilterBtn(table);
  _updateSpellFilters(table);
  if (state.refData[table]) { renderRefTable(state.refData[table], table); return; }
  $('drawer-content').innerHTML = '<p style="color:var(--text-muted);padding:1rem">Loading…</p>';
  API.data(table).then(rows => {
    state.refData[table] = rows;
    renderRefTable(rows, table);
  });
}

function filterReference() {
  const q = $('ref-search').value.toLowerCase();
  document.querySelectorAll('#drawer-content .ref-table tbody tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// Column definitions per table
const TABLE_COLS = {
  weapons:       ['Weapon','Cost','Type','Range','Damage','Properties'],
  armor:         ['Armor','Cost','Gear Slots','AC','Properties'],
  spells:        ['Spell Name','Tier','Caster','Duration','Range'],
  gear:          ['Item','Gear Slots','Cost'],
  magic_items:   ['Name','Benefit'],
  gems:          ['Valuable','GP (each)','Found'],
  plants_poisons:['Item','Rarity','Use','GP'],
  traps:         ['Item','Properties','Gear Slots','GP'],
  mounts:        ['Name','Cost','Rarity'],
  mount_gear:    ['Name','Cost','properties'],
  spell_catalysts:['Catalyst','Spell Name','Gear Slots','GP'],
};

// Map display column -> JSON key
function colKey(col) {
  return col; // raw key as-is from xlsx (they match the JSON keys)
}

// Columns to hide on small screens per table
const HIDE_ON_MOBILE = {
  weapons: ['Properties', 'Range'],
  armor:   ['Properties'],
  spells:  ['Duration'],
};

function renderRefTable(rows, table) {
  if (!rows?.length) {
    $('drawer-content').innerHTML = '<p style="color:var(--text-muted);padding:1rem">No data.</p>';
    return;
  }
  const cols = TABLE_COLS[table] || Object.keys(rows[0]).slice(0,5);
  const hideCols = HIDE_ON_MOBILE[table] || [];
  const tbody = rows.map(row => {
    const cells = cols.map(c => {
      const v = row[c] ?? row[c.toLowerCase().replace(/ /g,'_')] ?? '';
      const cls = hideCols.includes(c) ? ' class="ref-hide-mobile"' : '';
      return `<td${cls}>${escHtml(String(v ?? '').substring(0,120))}</td>`;
    }).join('');
    return `<tr>${cells}<td class="ref-col-add"><button class="ref-add-btn" onclick="addFromRef('${escAttr(String(row[cols[0]] ?? ''))}','${table}')">+</button></td></tr>`;
  }).join('');
  const headers = [...cols, ''].map((c, i) => {
    const cls = hideCols.includes(c) ? ' class="ref-hide-mobile"' : (i === cols.length ? ' class="ref-col-add"' : '');
    return `<th${cls}>${escHtml(c)}</th>`;
  }).join('');
  $('drawer-content').innerHTML = `<table class="ref-table" data-ref="${table}"><thead><tr>${headers}</tr></thead><tbody>${tbody}</tbody></table>`;
}

function escAttr(s) { return s.replace(/'/g, "\\'").replace(/"/g, '&quot;'); }

async function addFromRef(name, table) {
  if (!state.char) return;

  if (table === 'spells') {
    const items = getListItems('list-spells');
    items.push(name);
    renderSpellList(items);
    scheduleAutoSave();
    toast(`Added spell: ${name}`);
    return;
  }

  // Mounts go straight to the stable, not gear slots
  if (table === 'mounts') {
    await buildItemLookup();
    const found = findItem(name);
    const mountItem = found?.item ?? {};
    const costRaw = mountItem.Cost ?? null;
    const costCp  = parseCostToCp(costRaw);
    if (costCp != null && costCp > 0) {
      const have = getTotalCp();
      if (have < costCp) {
        const gpNeeded = (costCp / 100).toFixed(2);
        const gpHave   = (have   / 100).toFixed(2);
        toast(`Not enough gold! Need ${gpNeeded} gp, have ${gpHave} gp.`);
        return;
      }
    }
    const saved      = getMountsSaved();
    const carrySlots = mountItem['Carry Slots'] ?? 10;
    saved.push({
      id:         'M' + Date.now() + Math.random().toString(36).slice(2, 7),
      animalName: name,
      customName: name,
      inPack:     false,
      gear:       new Array(carrySlots).fill(''),
      freeCarry:  new Array(5).fill(''),
    });
    state.char.mounts_saved = saved;
    if (costCp) deductCurrency(costCp);
    clearTimeout(state.saveTimer); // cancel any timer deductCurrency queued
    saveNow();
    openStable();
    toast(`${name} added to stable!`);
    return;
  }

  // Determine gear slots and type from item data
  await buildItemLookup();
  const found      = findItem(name);
  const rawSlots   = found?.item?.['Gear Slots'];
  const gearSlots  = rawSlots !== undefined ? parseInt(rawSlots) : 1;
  const type       = table === 'weapons' ? 'weapon' : table === 'armor' ? 'armor' : '';

  // Currency check — parse cost and verify funds
  const costRaw = found?.item?.Cost ?? found?.item?.['GP (each)'] ?? null;
  const costCp  = parseCostToCp(costRaw);
  if (costCp != null && costCp > 0) {
    const have = getTotalCp();
    if (have < costCp) {
      const gpNeeded = (costCp / 100).toFixed(2);
      const gpHave   = (have   / 100).toFixed(2);
      toast(`Not enough gold! Need ${gpNeeded} gp, have ${gpHave} gp.`);
      return;
    }
  }

  // Zero-slot → free carry (fixed 10 slots, DOM-driven)
  if (!isNaN(gearSlots) && gearSlots === 0) {
    const fcItems = getFCItems();
    const slot = fcItems.findIndex(it => !it.name);
    if (slot === -1) { toast('No empty free carry slots!'); return; }
    fcItems[slot] = { name, type, tag: '' };
    renderFreeCarryList(fcItems);
    updateMountSection();
    if (costCp) deductCurrency(costCp);
    scheduleAutoSave();
    toast(`Free carry: ${name}`);
    return;
  }

  const maxSlots = maxGearSlots(document.querySelector('[data-field="str_score"]')?.value ?? 10);
  const needed   = (isNaN(gearSlots) || gearSlots < 1) ? 1 : gearSlots;
  const gear     = readGearArray();
  const spans    = getGearSpans();
  const tags     = getGearTags();
  const types    = getGearTypes();
  const cont     = buildContMap(spans);

  // Find first slot within the STR-based limit where the full span fits
  let target = -1;
  for (let i = 0; i < maxSlots; i++) {
    if (cont[i] !== undefined || gear[i]?.trim()) continue;
    let fits = true;
    for (let j = 1; j < needed; j++) {
      const ni = i + j;
      if (ni >= maxSlots) { fits = false; break; }
      if ((cont[ni] !== undefined && cont[ni] !== i) || gear[ni]?.trim()) { fits = false; break; }
    }
    if (fits) { target = i; break; }
  }

  if (target === -1) { toast(`No empty gear slots! (Max: ${maxSlots})`); return; }

  gear[target]  = name;
  types[target] = type;
  spans[target] = needed;
  for (let j = 1; j < needed; j++) {
    const ni = target + j;
    gear[ni] = ''; types[ni] = ''; tags[ni] = ''; spans[ni] = 1;
  }

  if (costCp) deductCurrency(costCp);
  if (state.char) { state.char.gear = gear; state.char.gear_spans = spans; state.char.gear_types = types; }
  renderGearGrid(gear, tags, spans, types);
  updateSlotsInfo(document.querySelector('[data-field="str_score"]')?.value ?? 10, gear);
  updateMountSection();
  scheduleAutoSave();
  toast(`Added: ${name}`);
}

// ── HP +/- buttons ─────────────────────────────────────────────────────────
function initHPButtons() {
  $('hp-minus').onclick = () => {
    const inp = document.querySelector('[data-field="hp_current"]');
    const v = Math.max(0, parseInt(inp.value||0) - 1);
    inp.value = v;
    updateHPBar(v, parseInt(document.querySelector('[data-field="hp_max"]').value||0));
    scheduleAutoSave();
  };
  $('hp-plus').onclick = () => {
    const maxInp = document.querySelector('[data-field="hp_max"]');
    const inp    = document.querySelector('[data-field="hp_current"]');
    const max = parseInt(maxInp.value||0);
    const v   = Math.min(max || 999, parseInt(inp.value||0) + 1);
    inp.value = v;
    updateHPBar(v, max);
    scheduleAutoSave();
  };
}

// ── Bonus system ──────────────────────────────────────────────────────────
const STAT_MAP = {
  'strength':'str_score','str':'str_score',
  'dexterity':'dex_score','dex':'dex_score',
  'constitution':'con_score','con':'con_score',
  'intelligence':'int_score','int':'int_score',
  'wisdom':'wis_score','wis':'wis_score',
  'charisma':'cha_score','cha':'cha_score',
};
const STAT_LABEL = {
  str_score:'STR',dex_score:'DEX',con_score:'CON',
  int_score:'INT',wis_score:'WIS',cha_score:'CHA',
};
const ALL_STATS = ['str_score','dex_score','con_score','int_score','wis_score','cha_score'];

/*  Bonus object types:
 *   stat              {type:'stat', stat:'str_score', value:2}
 *   hp                {type:'hp', value:2}
 *   ac                {type:'ac', value:1}
 *   gear_slots        {type:'gear_slots', value:3}
 *   gear_slots_mod    {type:'gear_slots_mod', stat:'con_score'}   ← add modifier of stat
 *   melee_attack_damage  {type:'melee_attack_damage', value:1}
 *   ranged_attack_damage {type:'ranged_attack_damage', value:1}
 *   weapon_attack_damage {type:'weapon_attack_damage', value:1}
 *   melee_damage      {type:'melee_damage', value:1}
 *   spellcast         {type:'spellcast', value:1}
 *   compound_choice   {type:'compound_choice', choices:[{label,bonus},...]}
 */

/**
 * Parse a talent text → a single bonus descriptor (or compound_choice).
 */
function parseTalentEffect(text) {
  if (!text) return { type: 'none' };
  const t = text.trim();

  // ─ compound: "+2 to X stat, or +1 to [attacks/spellcasting]" ───────────
  let cm = t.match(/\+(\d+)\s+to\s+([\w,\s]+?)(?:\s+stat)?,?\s+or\s+\+(\d+)\s+to\s+(melee\s+attacks?|ranged\s+attacks?|attack\s+rolls?|weapon\s+attacks?|spellcasting\s+checks?)/i);
  if (cm) {
    const statVal  = parseInt(cm[1]);
    const statPart = cm[2];
    const atkVal   = parseInt(cm[3]);
    const atkKind  = cm[4].toLowerCase();
    const statKeys = statPart.split(/,\s*|\s+or\s+/i).map(s => STAT_MAP[s.trim().replace(/^or\s+/i,'').toLowerCase()]).filter(Boolean);
    const choices  = statKeys.map(s => ({ label: `${STAT_LABEL[s]} +${statVal}`, bonus: { type:'stat', stat:s, value:statVal } }));
    // Determine attack bonus type
    let atkType = 'melee_attack_damage';
    if (/ranged/i.test(atkKind))      atkType = 'ranged_attack_damage';
    else if (/weapon/i.test(atkKind)) atkType = 'weapon_attack_damage';
    else if (/spell/i.test(atkKind))  atkType = 'spellcast';
    else if (/attack roll/i.test(atkKind)) atkType = 'melee_attack_damage';
    choices.push({ label: `+${atkVal} ${atkKind}`, bonus: { type: atkType, value: atkVal } });
    if (choices.length > 1) return { type: 'compound_choice', choices };
  }

  // compound: "+2 to Charisma or +1 on [class] spellcasting checks"
  cm = t.match(/\+(\d+)\s+to\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+\+(\d+)\s+(?:on|to)\s+\w+\s+spellcasting/i);
  if (cm) {
    const sVal  = parseInt(cm[1]);
    const sStat = STAT_MAP[cm[2].toLowerCase()];
    const spVal = parseInt(cm[3]);
    if (sStat) return { type: 'compound_choice', choices: [
      { label: `${STAT_LABEL[sStat]} +${sVal}`, bonus: { type:'stat', stat:sStat, value:sVal } },
      { label: `+${spVal} spellcasting`, bonus: { type:'spellcast', value:spVal } },
    ]};
  }

  // compound: "Permanently gain +N HP or +N AC"
  cm = t.match(/gain\s+\+?(\d+)\s+HP\s+or\s+\+(\d+)\s+AC/i);
  if (cm) return { type: 'compound_choice', choices: [
    { label: `+${cm[1]} HP`, bonus: { type:'hp', value: parseInt(cm[1]) } },
    { label: `+${cm[2]} AC`, bonus: { type:'ac', value: parseInt(cm[2]) } },
  ]};

  // ─ +N HP / +N max HP ───────────────────────────────────────────────────
  let m = t.match(/\+(\d+)\s+(?:max\s+)?HP\b/i);
  if (m) return { type: 'hp', value: parseInt(m[1]) };

  // ─ gear slots ──────────────────────────────────────────────────────────
  m = t.match(/(?:extra|additional)\s+(\d+)\s+gear\s+slot/i);
  if (m) return { type: 'gear_slots', value: parseInt(m[1]) };
  m = t.match(/carry\s+an?\s+extra\s+(\d+)\s+gear\s+slot/i);
  if (m) return { type: 'gear_slots', value: parseInt(m[1]) };
  m = t.match(/(?:gain|get)\s+(\d+)\s+gear\s+slot/i);
  if (m) return { type: 'gear_slots', value: parseInt(m[1]) };

  // ─ +N to melee/ranged/weapon attacks and damage ────────────────────────
  m = t.match(/\+(\d+)\s+to\s+melee\s+attacks?\s+and\s+damage/i);
  if (m) return { type: 'melee_attack_damage', value: parseInt(m[1]) };
  m = t.match(/\+(\d+)\s+to\s+melee\s+attack\s+rolls?/i);
  if (m) return { type: 'melee_attack_damage', value: parseInt(m[1]) };
  m = t.match(/\+(\d+)\s+to\s+melee\s+attacks?\b/i);
  if (m) return { type: 'melee_attack_damage', value: parseInt(m[1]) };
  m = t.match(/\+(\d+)\s+to\s+melee\s+attacks?\s+with\s+weapons/i);
  if (m) return { type: 'melee_attack_damage', value: parseInt(m[1]) };
  m = t.match(/\+(\d+)\s+to\s+ranged\s+attack\s+rolls?/i);
  if (m) return { type: 'ranged_attack_damage', value: parseInt(m[1]) };
  m = t.match(/\+(\d+)\s+to\s+weapon\s+attacks?\s+and\s+damage/i);
  if (m) return { type: 'weapon_attack_damage', value: parseInt(m[1]) };

  // +N damage with melee weapons (damage only, no attack bonus)
  m = t.match(/\+(\d+)\s+damage\s+with\s+melee/i);
  if (m) return { type: 'melee_damage', value: parseInt(m[1]) };
  m = t.match(/\+(\d+)\s+(?:bonus\s+)?(?:to\s+)?melee\s+damage/i);
  if (m) return { type: 'melee_damage', value: parseInt(m[1]) };

  // +N to spellcasting checks
  m = t.match(/\+(\d+)\s+(?:to|on)\s+(?:\w+\s+)?spellcasting\s+checks?/i);
  if (m) return { type: 'spellcast', value: parseInt(m[1]) };

  // ─ +N points to distribute to stats / +N to any stat  (choice of all 6)
  m = t.match(/\+(\d+)\s+(?:points?\s+to\s+distribute\s+to\s+|to\s+any\s+(?:one\s+)?)stats?/i);
  if (m) {
    const v = parseInt(m[1]);
    return { type: 'compound_choice', choices: ALL_STATS.map(s =>
      ({ label: `${STAT_LABEL[s]} +${v}`, bonus: { type:'stat', stat:s, value:v } })
    )};
  }

  // ─ +N to [Stat1], [Stat2], or [Stat3] stat  (choice of listed) ────────
  m = t.match(/\+(\d+)\s+to\s+([\w]+(?:,\s*[\w]+)*(?:,?\s+or\s+[\w]+)?)\s+stat/i);
  if (m) {
    const value = parseInt(m[1]);
    const parts = m[2].split(/,\s*|\s+or\s+/i).map(s => STAT_MAP[s.trim().replace(/^or\s+/i,'').toLowerCase()]).filter(Boolean);
    if (parts.length > 1) return { type: 'compound_choice', choices: parts.map(s =>
      ({ label: `${STAT_LABEL[s]} +${value}`, bonus: { type:'stat', stat:s, value } })
    )};
    if (parts.length === 1) return { type: 'stat', stat: parts[0], value };
  }

  // ─ +N to [StatName] (direct) ──────────────────────────────────────────
  m = t.match(/\+(\d+)\s+to\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/i);
  if (m) {
    const stat = STAT_MAP[m[2].toLowerCase()];
    if (stat) return { type: 'stat', stat, value: parseInt(m[1]) };
  }

  // ─ +N to AC ───────────────────────────────────────────────────────────
  m = t.match(/\+(\d+)\s+(?:bonus\s+)?(?:to\s+)?AC\b/i);
  if (m) return { type: 'ac', value: parseInt(m[1]) };

  return { type: 'none' };
}

/** Parse a race benefit text → array of bonus objects. */
function parseRaceBenefit(text) {
  if (!text) return [];
  const effects = [];
  const t = text.trim();

  // ── Compound "X or Y" race benefits (e.g. Elf Farsight) ──────────────
  // "+1 bonus to attack rolls with ranged weapons or a +1 bonus to spellcasting checks"
  const orMatch = t.match(/\+(\d+)\s+(?:bonus\s+)?to\s+attack\s+rolls?\s+with\s+ranged\s+weapons?\s+or\s+(?:a\s+)?\+(\d+)\s+(?:bonus\s+)?(?:to|on)\s+spellcasting\s+checks?/i);
  if (orMatch) {
    effects.push({
      type: 'compound_choice',
      choices: [
        { label: `+${orMatch[1]} ranged attacks`, bonus: { type: 'ranged_attack_damage', value: parseInt(orMatch[1]) } },
        { label: `+${orMatch[2]} spellcasting`,   bonus: { type: 'spellcast', value: parseInt(orMatch[2]) } },
      ]
    });
    return effects;
  }

  let m = t.match(/\+(\d+)\s+(?:max\s+)?HP\b/i);
  if (m) effects.push({ type: 'hp', value: parseInt(m[1]) });

  m = t.match(/carry\s+an?\s+extra\s+(\d+)\s+gear\s+slot/i);
  if (!m) m = t.match(/(?:extra|additional)\s+(\d+)\s+gear\s+slot/i);
  if (m) effects.push({ type: 'gear_slots', value: parseInt(m[1]) });

  const statRe = /\+(\d+)\s+(?:bonus\s+)?to\s+(?:your\s+)?(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\b/gi;
  let sm;
  while ((sm = statRe.exec(t)) !== null) {
    const stat = STAT_MAP[sm[2].toLowerCase()];
    if (stat) effects.push({ type: 'stat', stat, value: parseInt(sm[1]) });
  }

  // +N bonus to attack and damage with melee weapons (Half-Orc)
  m = t.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:attack\s+and\s+)?damage\s+(?:rolls?\s+)?with\s+melee/i);
  if (m) effects.push({ type: 'melee_attack_damage', value: parseInt(m[1]) });

  // +N to ranged attacks / attack rolls with ranged weapons
  m = t.match(/\+(\d+)\s+(?:bonus\s+)?(?:to|on)\s+(?:ranged\s+attacks?|attack\s+rolls?\s+with\s+ranged)/i);
  if (m) effects.push({ type: 'ranged_attack_damage', value: parseInt(m[1]) });

  // +N to spellcasting checks
  m = t.match(/\+(\d+)\s+(?:bonus\s+)?(?:to|on)\s+(?:\w+\s+)?spellcasting\s+checks?/i);
  if (m) effects.push({ type: 'spellcast', value: parseInt(m[1]) });

  m = t.match(/\+(\d+)\s+(?:bonus\s+)?(?:to\s+)?AC\b/i);
  if (m) effects.push({ type: 'ac', value: parseInt(m[1]) });

  return effects;
}

/** Parse a class feature → array of bonus objects. Checks conditions. */
function parseClassFeature(name, desc) {
  if (!desc) return [];
  const effects = [];
  const low = desc.toLowerCase();

  // Hauler: Add CON modifier to gear slots
  if (/add\s+(?:your\s+)?(?:con|constitution)\s+modifier.*gear\s+slot/i.test(desc))
    effects.push({ type: 'gear_slots_mod', stat: 'con_score' });

  // Shield Mastery: +1 AC when using a shield
  if (/\+(\d+)\s+AC\s+when\s+using\s+a\s+shield/i.test(desc) && _hasShieldEquipped())
    effects.push({ type: 'ac', value: parseInt(desc.match(/\+(\d+)\s+AC\s+when\s+using\s+a\s+shield/i)[1]) });

  // Brawl / general: +N AC when wearing clothes or leather armor
  if (/\+(\d+)\s+AC\s+when\s+wearing\s+(?:clothes|leather)/i.test(desc) && _isWearingLightArmor())
    effects.push({ type: 'ac', value: parseInt(desc.match(/\+(\d+)\s+AC\s+when\s+wearing/i)[1]) });

  // +N AC while wearing no armor
  if (/\+(\d+)\s+(?:to\s+)?AC\s+(?:while|when)\s+wearing\s+no\s+armou?r/i.test(desc) && !_isWearingAnyArmor())
    effects.push({ type: 'ac', value: parseInt(desc.match(/\+(\d+)\s+(?:to\s+)?AC/i)[1]) });

  // Draw: +1 to attack and damage with a longbow or shortbow
  if (/\+(\d+)\s+to\s+attack\s+and\s+damage\s+with\s+a?\s*(?:long|short)bow/i.test(desc))
    effects.push({ type: 'ranged_attack_damage', value: parseInt(desc.match(/\+(\d+)/)[1]), _weaponFilter: 'bow' });

  // Brawl attack bonus: +1 to attack with bare fists
  if (/\+(\d+)\s+to\s+attack\s+with\s+bare\s+fists/i.test(desc))
    effects.push({ type: 'melee_attack_damage', value: parseInt(desc.match(/\+(\d+)/)[1]), _weaponFilter: 'unarmed' });

  // Weapon Mastery: +N to attack and damage with a weapon type, plus half level
  if (/gain\s+\+(\d+)\s+to\s+attack\s+and\s+damage\s+with\s+that\s+weapon/i.test(desc)) {
    const base = parseInt(desc.match(/\+(\d+)\s+to\s+attack\s+and\s+damage/)[1]);
    const halfLvl = /add\s+half\s+your\s+level/i.test(desc) ? Math.floor((state.char?.level || 1) / 2) : 0;
    const chosen = state.char?.weapon_mastery || '';
    const bonus = { type: 'weapon_attack_damage', value: base + halfLvl };
    if (chosen) bonus._weaponFilter = chosen.toLowerCase();
    effects.push(bonus);
  }

  // Generic: +N to attack and damage (any weapon, no specific filter)
  if (!effects.some(e => e.type === 'weapon_attack_damage') &&
      /\+(\d+)\s+to\s+(?:all\s+)?attack\s+and\s+damage/i.test(desc)) {
    effects.push({ type: 'weapon_attack_damage', value: parseInt(desc.match(/\+(\d+)\s+to\s+(?:all\s+)?attack\s+and\s+damage/i)[1]) });
  }

  return effects;
}

/** Check if any equipped (worn/wielded) item is a shield. */
function _hasShieldEquipped() {
  const tags = getGearTags();
  const gear = readGearArray();
  for (let i = 0; i < 20; i++) {
    if (tags[i] === 'wearing' && /shield/i.test(gear[i])) return true;
  }
  const fcItems = getFCItems();
  for (const it of fcItems) {
    if (it.tag === 'wearing' && /shield/i.test(it.name)) return true;
  }
  return false;
}

/** Check if wearing leather armor or clothes (light armor). */
function _isWearingLightArmor() {
  const tags = getGearTags();
  const gear = readGearArray();
  for (let i = 0; i < 20; i++) {
    if (tags[i] === 'wearing' && /leather|cloth|hide/i.test(gear[i])) return true;
  }
  const fcItems = getFCItems();
  for (const it of fcItems) {
    if (it.tag === 'wearing' && /leather|cloth|hide/i.test(it.name)) return true;
  }
  return false;
}

/** Check if wearing any armor at all. */
function _isWearingAnyArmor() {
  const tags  = getGearTags();
  const types = getGearTypes();
  for (let i = 0; i < 20; i++) {
    if (tags[i] === 'wearing' && types[i] === 'armor') return true;
  }
  const fcItems = getFCItems();
  for (const it of fcItems) {
    if (it.tag === 'wearing' && it.type === 'armor') return true;
  }
  return false;
}

/** Compute class feature bonuses for current class (not stored in DB). */
function getClassBonuses() {
  const className = $('class-select')?.value || '';
  if (!className || !state.refData.classes) return [];
  const cd = (state.refData.classes || []).find(c => c.class === className);
  if (!cd?.features) return [];
  const out = [];
  cd.features.forEach(f => out.push(...parseClassFeature(f.name, f.description)));
  return out;
}

function getTalentBonuses() {
  const b = state.char?.talent_bonuses;
  return Array.isArray(b) ? b : [];
}

function getRaceBonuses() {
  const b = state.char?.race_bonuses;
  return Array.isArray(b) ? b : [];
}

function getAllBonuses() {
  return [...getTalentBonuses(), ...getRaceBonuses(), ...getClassBonuses()];
}

/** Sum stat bonuses for a given ability field (e.g. 'str_score'). */
function calcStatBonus(field) {
  let total = 0;
  getAllBonuses().forEach(b => {
    if (b?.type === 'stat' && b.stat === field) total += (b.value || 0);
  });
  return total;
}

/** Sum HP bonuses. */
function calcHpBonus() {
  return getAllBonuses().reduce((s, b) => b?.type === 'hp' ? s + (b.value||0) : s, 0);
}

/** Sum a generic bonus type, including compound types that imply it.
 *  weaponName (optional) — when provided, bonuses with _weaponFilter
 *  are only counted if the weapon name matches the filter. */
function calcBonusByType(type, weaponName) {
  let total = 0;
  const wn = weaponName ? weaponName.toLowerCase() : '';
  getAllBonuses().forEach(b => {
    if (!b) return;
    // If bonus has a weapon filter, skip unless weapon matches
    if (b._weaponFilter && wn && !wn.includes(b._weaponFilter) && !b._weaponFilter.includes(wn)) return;
    if (b._weaponFilter && !wn) return; // has filter but no weapon context — skip
    if (b.type === type) { total += (b.value||0); return; }
    // melee_attack_damage counts for both melee_attack and melee_damage
    if (type === 'melee_attack'  && b.type === 'melee_attack_damage')  total += (b.value||0);
    if (type === 'melee_damage'  && b.type === 'melee_attack_damage')  total += (b.value||0);
    if (type === 'ranged_attack' && b.type === 'ranged_attack_damage') total += (b.value||0);
    if (type === 'ranged_damage' && b.type === 'ranged_attack_damage') total += (b.value||0);
    // weapon_attack_damage counts for everything
    if (type === 'melee_attack'  && b.type === 'weapon_attack_damage') total += (b.value||0);
    if (type === 'melee_damage'  && b.type === 'weapon_attack_damage') total += (b.value||0);
    if (type === 'ranged_attack' && b.type === 'weapon_attack_damage') total += (b.value||0);
    if (type === 'ranged_damage' && b.type === 'weapon_attack_damage') total += (b.value||0);
  });
  return total;
}

/** Effective stat = base + bonus (used by autoComputeAttacks/AC). */
function getEffectiveStat(field) {
  return (state._statBases?.[field] ?? 10) + calcStatBonus(field);
}

/**
 * Master refresh: writes effective values into the DOM inputs, updates modifiers,
 * badges, gear slots, and HP max.
 */
function refreshStatBonusDisplay() {
  // ── Ability scores ────────────────────────────────────────────────────
  ['str','dex','con','int','wis','cha'].forEach(a => {
    const field     = `${a}_score`;
    const base      = state._statBases?.[field] ?? 10;
    const bonus     = calcStatBonus(field);
    const effective = base + bonus;
    const inp       = document.querySelector(`[data-field="${field}"]`);
    if (inp) inp.value = effective;
    const modEl = $(`mod-${a}`);
    if (modEl) modEl.textContent = modStr(mod(effective));
    const badge = $(`bonus-badge-${a}`);
    if (badge) {
      if (bonus !== 0) {
        badge.textContent = bonus > 0 ? `+${bonus}` : `${bonus}`;
        badge.className   = 'stat-bonus-badge ' + (bonus > 0 ? 'pos' : 'neg');
        badge.hidden      = false;
      } else {
        badge.hidden = true;
      }
    }
  });

  // ── HP max ────────────────────────────────────────────────────────────
  const hpBonus = calcHpBonus();
  const hpInp   = document.querySelector('[data-field="hp_max"]');
  if (hpInp) {
    const effectiveHp = (state._hpMaxBase || 0) + hpBonus;
    hpInp.value = effectiveHp;
    // Keep current HP capped at new max
    const curInp = document.querySelector('[data-field="hp_current"]');
    if (curInp && parseInt(curInp.value) > effectiveHp) curInp.value = effectiveHp;
    updateHPBar(parseInt(curInp?.value)||0, effectiveHp);
  }

  // ── Gear slots (includes gear_slots_mod from CON etc.) ────────────────
  const allB = getAllBonuses();
  let gearBonus = allB.reduce((s, b) => b?.type === 'gear_slots' ? s + (b.value||0) : s, 0);
  allB.forEach(b => {
    if (b?.type === 'gear_slots_mod') {
      const base = state._statBases?.[b.stat] ?? 10;
      const eff  = base + calcStatBonus(b.stat);
      const m    = mod(eff);
      if (m > 0) gearBonus += m;
    }
  });
  state._gearSlotBonus = gearBonus;

  const strEff = getEffectiveStat('str_score');
  const gear = readGearArray();
  _updateSlotsDisplay(strEff, gear);
  // Re-render gear grid so slot count matches the bonus-adjusted max
  renderGearGrid(gear, getGearTags(), getGearSpans(), getGearTypes());
}

// ── Bonus choice modal (generalised) ──────────────────────────────────────
let _bonusChoiceResolve = null;

function showBonusChoiceModal(choices, title, descText) {
  return new Promise(resolve => {
    _bonusChoiceResolve = resolve;
    $('stat-choice-title').textContent = title || 'Choose your bonus';
    $('stat-choice-desc').textContent  = descText || '';
    const container = $('stat-choice-buttons');
    container.innerHTML = '';
    choices.forEach(c => {
      const btn = el('button', 'stat-choice-btn');
      btn.textContent = c.label;
      btn.onclick = () => closeStatChoice(c.bonus);
      container.appendChild(btn);
    });
    $('stat-choice-overlay').hidden = false;
    $('stat-choice-modal').hidden   = false;
  });
}

function closeStatChoice(chosen) {
  $('stat-choice-overlay').hidden = true;
  $('stat-choice-modal').hidden   = true;
  if (_bonusChoiceResolve) {
    _bonusChoiceResolve(chosen ?? null);
    _bonusChoiceResolve = null;
  }
}

/** Check if current class has Weapon Mastery and prompt user to choose a weapon.
 *  Called on class change and on sheet load for Fighters without a stored choice. */
async function checkWeaponMastery() {
  if (!state.char) return;
  if (!state.refData.classes) state.refData.classes = await API.data('classes');
  const className = $('class-select')?.value || '';
  const classData = (state.refData.classes || []).find(c => c.class === className);
  const features  = classData?.features || [];
  const wmFeature = features.find(f =>
    /weapon\s+mastery/i.test(f.name) ||
    /gain\s+\+\d+\s+to\s+attack\s+and\s+damage\s+with\s+that\s+weapon/i.test(f.description)
  );
  if (!wmFeature) {
    // Class has no weapon mastery — clear stored choice
    if (state.char.weapon_mastery) {
      state.char.weapon_mastery = '';
      scheduleAutoSave();
      scheduleAutoCompute();
    }
    return;
  }
  // Already has a valid choice? Don't re-prompt
  if (state.char.weapon_mastery) return;
  // Prompt the user to pick a weapon
  await promptWeaponMasteryPicker();
}

async function promptWeaponMasteryPicker() {
  if (!state.refData.weapons) state.refData.weapons = await API.data('weapons');
  const weapons = state.refData.weapons.filter(w => w.Weapon);
  const choices = weapons.map(w => ({
    label: `${w.Weapon}  (${w.Type || '?'})`,
    bonus: w.Weapon  // we store the weapon name as the "bonus" value
  }));
  const chosen = await showBonusChoiceModal(
    choices,
    'Weapon Mastery',
    'Choose your mastered weapon type. You gain +1 to attack and damage with it, plus half your level.'
  );
  if (chosen) {
    state.char.weapon_mastery = chosen; // chosen is the weapon name string
    scheduleAutoSave();
    renderClassFeatures();             // refresh to show chosen weapon tag
    refreshStatBonusDisplay();
    scheduleAutoCompute();
  }
}

/** Re-prompt weapon mastery — called from the UI if the user wants to change it. */
async function changeWeaponMastery() {
  if (!state.char) return;
  state.char.weapon_mastery = ''; // clear so prompt runs
  await promptWeaponMasteryPicker();
}

/** Apply (or re-apply) the bonus for a single talent slot. Async — may show modal. */
async function applyTalentEffect(text, index) {
  if (!state.char) return;
  const effect  = parseTalentEffect(text);
  const bonuses = getTalentBonuses().slice();
  while (bonuses.length <= index) bonuses.push(null);

  if (effect.type === 'none') {
    bonuses[index] = null;
  } else if (effect.type === 'compound_choice') {
    const short  = text.length > 60 ? text.slice(0, 58) + '…' : text;
    const chosen = await showBonusChoiceModal(effect.choices, 'Choose your bonus', short);
    bonuses[index] = chosen || null;
  } else {
    bonuses[index] = { type: effect.type, stat: effect.stat ?? null, value: effect.value };
  }

  state.char.talent_bonuses = bonuses;
  refreshStatBonusDisplay();
  scheduleAutoSave();
  scheduleAutoCompute();
}

/** Remove the bonus for a talent at `index` and compact the array. */
function removeTalentEffect(index) {
  if (!state.char) return;
  const bonuses = getTalentBonuses().slice();
  bonuses.splice(index, 1);
  state.char.talent_bonuses = bonuses;
  refreshStatBonusDisplay();
  scheduleAutoCompute();
}

/** Parse a race's benefit text and store in state.char.race_bonuses.
 *  Compound choices trigger the bonus-choice modal. */
async function applyRaceBenefit(raceName) {
  if (!state.char) return;
  if (!state.refData.races) state.refData.races = await API.data('races');
  const raceData = (state.refData.races || []).find(r => r.race === raceName);
  const parsed = parseRaceBenefit(raceData?.benefit || '');
  const resolved = [];
  for (const eff of parsed) {
    if (eff.type === 'compound_choice') {
      const chosen = await showBonusChoiceModal(
        eff.choices,
        `${raceData?.benefit_name || raceName}`,
        raceData?.benefit || ''
      );
      if (chosen) resolved.push(chosen);
    } else {
      resolved.push(eff);
    }
  }
  state.char.race_bonuses = resolved;
  refreshStatBonusDisplay();
  scheduleAutoSave();
  scheduleAutoCompute();
}

// ── Event wiring ───────────────────────────────────────────────────────────
function wireEvents() {
  $('btn-new-char').onclick = () => API.create().then(c => {
    if (!c || c.__auth === false || c.error) {
      if (c?.__auth === false) window.__openAuthModal?.('signin');
      return;
    }
    showSheet(c.id);
  });

  // Delete-management (bin) mode + recovery
  $('btn-recently-deleted')?.addEventListener('click', openRecover);
  $('recover-close')?.addEventListener('click', closeRecover);
  $('recover-overlay')?.addEventListener('click', e => { if (e.target.id === 'recover-overlay') closeRecover(); });
  $('btn-back').onclick = () => showList();
  $('btn-reference').onclick = () => openReference(state.refTable);
  $('btn-stable').onclick    = () => toggleStable();
  window.addEventListener('resize', autoLayout);

  // Mobile (no-hover): tap a gear slot to reveal its action buttons.
  // Desktop reveals on :hover via CSS, so this only acts on touch/coarse pointers.
  document.addEventListener('click', e => {
    if (window.matchMedia('(hover: hover)').matches) return;        // desktop → CSS hover
    // Buttons / qty input do their own thing — don't flip slot-active there.
    if (e.target.closest('.gear-action-btn, .gear-clear-btn, .gear-qty-input')) return;
    const slot = e.target.closest('.gear-slot');
    document.querySelectorAll('.gear-slot.slot-active').forEach(s => {
      if (s !== slot) s.classList.remove('slot-active');
    });
    if (slot && slot.querySelector('.gear-item-btn')) slot.classList.toggle('slot-active');
  });

  $('btn-delete-char').onclick = () => {
    // On the list view this button toggles bin (delete-management) mode
    if (state.view === 'list') { toggleBinMode(); return; }
    // On the sheet view it soft-deletes the open character (recoverable 7 days)
    if (!state.char) return;
    if (!confirm(`Delete "${state.char.name}"?\n\nIt can be recovered from Recently Deleted for 7 days.`)) return;
    API.del(state.char.id).then(() => {
      toast(`"${state.char.name}" moved to Recently Deleted.`);
      showList();
    });
  };

  // Drawer tabs
  document.querySelectorAll('.dtab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.dtab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      loadRefTable(btn.dataset.table);
    };
  });

  // Live ability modifier update + re-compute attacks/AC + refresh dice buttons
  document.querySelectorAll('.ability-score').forEach(inp => {
    inp.addEventListener('input', () => {
      const field   = inp.dataset.field; // e.g. 'str_score'
      const displayed = parseInt(inp.value) || 10;
      // The user typed the *effective* value; derive the new base
      if (field) state._statBases[field] = displayed - calcStatBonus(field);
      const ability = inp.closest('[data-ability]')?.dataset.ability;
      if (ability) $(`mod-${ability}`).textContent = modStr(mod(displayed));
      scheduleAutoSave();
      scheduleAutoCompute();
      if ($('dice-panel').classList.contains('open')) {
        refreshAbilityButtons();
        if (dice.activeAbility) setAbilityMod(dice.activeAbility);
      }
    });
  });

  // Alignment buttons
  document.querySelectorAll('.align-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.align-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      autoComputeTitle();
      scheduleAutoSave();
      syncExpandedHeader();
    };
  });

  // Class select — recompute title + features + class bonuses on change
  $('class-select')?.addEventListener('change', async () => {
    // Clear weapon mastery when switching class so the new class can prompt
    if (state.char) state.char.weapon_mastery = '';
    autoComputeTitle();
    renderClassFeatures();
    renderLanguages();
    refreshStatBonusDisplay(); // class bonuses may change
    scheduleAutoSave();
    scheduleAutoCompute();
    syncExpandedHeader();
    await checkWeaponMastery();
  });

  // Race select — recompute race benefit + bonuses on change
  $('race-select')?.addEventListener('change', () => {
    renderRaceFeature();
    renderLanguages();
    applyRaceBenefit($('race-select').value);
    syncExpandedHeader();
  });

  // Background custom picker — toggle dropdown on trigger click
  $('bg-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    const list = $('bg-dropdown');
    if (list && !list.hidden) _closeBgDropdown();
    else _openBgDropdown();
  });

  // Deity custom picker — toggle dropdown on trigger click
  $('deity-trigger')?.addEventListener('click', e => {
    e.stopPropagation();
    const list = $('deity-dropdown');
    if (list && !list.hidden) _closeDeityDropdown();
    else _openDeityDropdown();
  });

  // Level change — recompute title and XP target
  document.querySelector('[data-field="level"]')?.addEventListener('input', () => {
    autoComputeTitle();
    autoComputeXpTarget();
    syncExpandedHeader();
    // Several class features scale with level (e.g. Fighter Weapon Mastery
    // adds half-level to attack/damage). Recompute so the bonus updates.
    refreshStatBonusDisplay();
    scheduleAutoCompute();
  });

  // All other inputs auto-save + sync expanded header for identity fields
  const hdrFields = new Set(['name','deity','description']);
  document.querySelectorAll('[data-field]').forEach(inp => {
    if (!inp.closest('.ability-grid')) {
      inp.addEventListener('input', () => {
        scheduleAutoSave();
        if (hdrFields.has(inp.dataset.field)) syncExpandedHeader();
      });
    }
  });

  // HP / XP live updates
  document.querySelector('[data-field="hp_current"]')?.addEventListener('input', e => {
    updateHPBar(parseInt(e.target.value)||0, parseInt(document.querySelector('[data-field="hp_max"]').value)||0);
    scheduleAutoSave();
  });
  document.querySelector('[data-field="hp_max"]')?.addEventListener('input', e => {
    const displayed = parseInt(e.target.value) || 0;
    state._hpMaxBase = displayed - calcHpBonus();
    updateHPBar(parseInt(document.querySelector('[data-field="hp_current"]').value)||0, displayed);
    scheduleAutoSave();
  });
  document.querySelector('[data-field="xp"]')?.addEventListener('input', e => {
    updateXPBar(parseInt(e.target.value)||0, parseInt(document.querySelector('[data-field="xp_target"]').value)||1);
    scheduleAutoSave();
  });
  document.querySelector('[data-field="xp_target"]')?.addEventListener('input', e => {
    updateXPBar(parseInt(document.querySelector('[data-field="xp"]').value)||0, parseInt(e.target.value)||1);
    scheduleAutoSave();
  });
  document.querySelector('[data-field="str_score"]')?.addEventListener('input', e => {
    updateSlotsInfo(parseInt(e.target.value)||10, readGearArray());
  });

  initHPButtons();

  // ── Reference drawer: spell filter chips (caster + alignment) ────────
  document.querySelectorAll('.ref-caster-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.refSpellCaster = btn.dataset.caster;
      // Switching caster clears alignment selection (matches /spells page UX)
      if (state.refSpellCaster === 'all') state.refSpellAligns.clear();
      _updateSpellFilters('spells');
      if (state.refTable === 'spells' && state.refData.spells) {
        renderRefTable(state.refData.spells, 'spells');
      }
    });
  });
  document.querySelectorAll('.ref-align-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.dataset.align;
      // Same behavior as the /spells rules page: every chip (including "All")
      // is an independent multi-select toggle. "All" matches spells whose
      // Aligment value is literally "all" (the universally-available ones).
      if (state.refSpellAligns.has(a)) state.refSpellAligns.delete(a);
      else state.refSpellAligns.add(a);
      _updateSpellFilters('spells');
      if (state.refTable === 'spells' && state.refData.spells) {
        renderRefTable(state.refData.spells, 'spells');
      }
    });
  });

  // ── Back-gesture (phone swipe-back / Android back / browser Back) ────
  // While on the character sheet view, close any open drawer/modal/card
  // first; only when nothing is open does back return to the character list.
  // Implemented by pushing a sacrificial history entry that popstate consumes.
  history.pushState({ sd_back_guard: true }, '', location.href);

  function _closeTopOpenSlide() {
    if ($('item-card')?.classList.contains('visible')) { hideCard(); return true; }
    if ($('auth-overlay') && !$('auth-overlay').hidden) {
      $('auth-overlay').hidden = true; return true;
    }
    if ($('recover-overlay') && !$('recover-overlay').hidden) {
      closeRecover(); return true;
    }
    if ($('reference-drawer')?.classList.contains('open')) {
      closeReference(); return true;
    }
    if ($('stable-drawer')?.classList.contains('open')) {
      closeStable(); return true;
    }
    if ($('sfx-identity-slide')?.classList.contains('open')) {
      toggleIdentitySlide(); return true;
    }
    // Dynamically-built modals — present in the DOM only while open.
    const dyn = document.querySelector(
      '#long-rest-modal, #long-rest-overlay, #add-currency-modal, ' +
      '#talent-picker-modal, #language-picker-modal, #weapon-mastery-picker'
    );
    if (dyn) {
      // These overlays typically have a wrapper + body — remove the whole
      // outermost element if we can find a known one.
      const outer = dyn.closest('.modal-overlay, .lr-overlay, .acm-overlay') || dyn;
      outer.remove();
      return true;
    }
    // Open custom-picker dropdowns (background / deity)
    const openPicker = document.querySelector(
      '#bg-dropdown:not([hidden]), #deity-dropdown:not([hidden])'
    );
    if (openPicker) {
      if (openPicker.id === 'bg-dropdown') _closeBgDropdown();
      else _closeDeityDropdown();
      return true;
    }
    return false;
  }

  window.addEventListener('popstate', () => {
    // 1. Slide open? Close the topmost, re-arm the guard, and stay put.
    if (_closeTopOpenSlide()) {
      history.pushState({ sd_back_guard: true }, '', location.href);
      return;
    }
    // 2. On the character sheet with no slides → go to the list view.
    if (state && state.view === 'sheet') {
      showList();
      history.pushState({ sd_back_guard: true }, '', location.href);
      return;
    }
    // 3. Otherwise (already on the list) let the browser back naturally.
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// DICE ROLLER
// ═══════════════════════════════════════════════════════════════════════════

const dice = {
  sides:   20,
  count:   1,
  mod:     0,
  rolling: false,
  lastSides: 20,
};

const DIE_COLORS = {
  4:'#4ade80', 6:'#60a5fa', 8:'#34d399', 10:'#fb923c',
  12:'#a78bfa', 20:'#f87171', 100:'#94a3b8'
};

function openDice(keepContext) {
  $('dice-panel').classList.add('open');
  $('btn-dice-nav').classList.add('active');
  refreshAbilityButtons();
  if (dice.activeAbility) setAbilityMod(dice.activeAbility);
  // Hide context rows unless a spell/attack opened us
  if (!keepContext) {
    const sr = $('spell-dc-row');   if (sr)  sr.hidden  = true;
    const wr = $('weapon-dmg-row'); if (wr)  wr.hidden  = true;
  }
}
function closeDice() {
  $('dice-panel').classList.remove('open');
  $('btn-dice-nav').classList.remove('active');
  const sr = $('spell-dc-row');   if (sr)  sr.hidden  = true;
  const wr = $('weapon-dmg-row'); if (wr)  wr.hidden  = true;
}
function toggleDice() {
  $('dice-panel').classList.contains('open') ? closeDice() : openDice();
}

function setDieSides(sides) {
  dice.sides = sides;
  const face = $('die-face');
  face.dataset.sides = sides;
  $('die-sides-label').textContent = sides === 100 ? 'd%' : `d${sides}`;
  const col = DIE_COLORS[sides] || '#c9a84c';
  face.style.setProperty('--dc', col);
  document.querySelectorAll('.die-type').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.sides) === sides);
  });
  // Reset display
  $('die-num').textContent = '?';
  $('roll-total').textContent = '—';
  $('roll-breakdown').textContent = '';
  $('roll-total').classList.remove('popped');
}

// Ability modifier buttons
dice.activeAbility = null;

function getSheetMods() {
  const out = {};
  ['str','dex','con','int','wis','cha'].forEach(a => {
    const inp = document.querySelector(`[data-field="${a}_score"]`);
    out[a] = mod(parseInt(inp?.value) || 10);
  });
  return out;
}

function refreshAbilityButtons() {
  const mods = getSheetMods();
  ['str','dex','con','int','wis','cha'].forEach(a => {
    const valEl = $(`amb-${a}`);
    if (!valEl) return;
    const m = mods[a];
    valEl.textContent = m >= 0 ? `+${m}` : `${m}`;
    valEl.className = 'amb-val' + (m > 0 ? ' positive' : m < 0 ? ' negative' : '');
  });
}

function setAbilityMod(ability) {
  dice.activeAbility = ability;
  const mods = getSheetMods();
  dice.mod = mods[ability] ?? 0;
  // Highlight active button, clear others
  document.querySelectorAll('.amb').forEach(b =>
    b.classList.toggle('active', b.dataset.ability === ability));
  $('amb-clear').classList.remove('active');
  // Ability check — always hide both context rows
  const sr = $('spell-dc-row');   if (sr) sr.hidden = true;
  const wr = $('weapon-dmg-row'); if (wr) wr.hidden = true;
}

function clearAbilityMod() {
  dice.mod = 0;
  dice.activeAbility = null;
  document.querySelectorAll('.amb').forEach(b => b.classList.remove('active'));
  $('amb-clear').classList.add('active');
  const sr = $('spell-dc-row');   if (sr) sr.hidden = true;
  const wr = $('weapon-dmg-row'); if (wr) wr.hidden = true;
}

function setSpellcastingAbility(ab) {
  state.spellcastingAbility = (state.spellcastingAbility === ab) ? null : ab;
  document.querySelectorAll('.spell-ab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.ab === state.spellcastingAbility));
  scheduleAutoSave();
}

function getCount() {
  return Math.max(1, Math.min(20, parseInt($('dice-count-input')?.value) || 1));
}

function rollNow() {
  if (dice.rolling) return;
  dice.rolling = true;
  // Generic roll — hide both context rows (only attack/spell rolls show them)
  const sr = $('spell-dc-row');   if (sr) sr.hidden = true;
  const wr = $('weapon-dmg-row'); if (wr) wr.hidden = true;

  const sides  = dice.sides;
  const count  = getCount();
  const dmod   = dice.mod;
  const col    = DIE_COLORS[sides] || '#c9a84c';

  // Generate actual rolls
  const rolls = Array.from({length: count}, () => Math.floor(Math.random() * sides) + 1);
  const sum   = rolls.reduce((a, b) => a + b, 0) + dmod;

  const face = $('die-face');
  const numEl = $('die-num');

  // Start shake
  face.classList.remove('landing');
  face.classList.add('rolling');
  face.style.setProperty('--dc', col);

  let flashInterval = setInterval(() => {
    numEl.textContent = Math.floor(Math.random() * sides) + 1;
  }, 60);

  setTimeout(() => {
    clearInterval(flashInterval);
    face.classList.remove('rolling');

    // Show primary result (first die or total if 1 die)
    numEl.textContent = count === 1 ? rolls[0] : sum;
    face.classList.add('landing');

    // Total display
    const totalEl = $('roll-total');
    totalEl.classList.remove('popped');
    totalEl.textContent = sum;
    // Force reflow for animation restart
    void totalEl.offsetWidth;
    totalEl.classList.add('popped');

    // Breakdown
    const bdEl = $('roll-breakdown');
    if (count > 1 || dmod !== 0) {
      let parts = count > 1 ? `[${rolls.join(', ')}]` : `${rolls[0]}`;
      if (dmod !== 0) parts += dmod > 0 ? ` + ${dmod}` : ` − ${Math.abs(dmod)}`;
      bdEl.textContent = parts + ` = ${sum}`;
    } else {
      bdEl.textContent = '';
    }

    // History
    addDiceHistory(count, sides, dmod, rolls, sum);

    setTimeout(() => {
      face.classList.remove('landing');
      dice.rolling = false;
    }, 450);

  }, 680);
}

function addDiceHistory(count, sides, dmod, rolls, total, note) {
  const hist     = $('dice-history');
  if (!hist) return;
  const dLabel   = sides === 100 ? '%' : sides;
  const modPart  = dmod !== 0 ? (dmod > 0 ? `+${dmod}` : `${dmod}`) : '';
  const abilPart = dice.activeAbility ? ` (${dice.activeAbility.toUpperCase()})` : '';
  const notation = sides === 0 ? '—' : `${count > 1 ? count : ''}d${dLabel}${modPart}${abilPart}`;

  const isCrit = sides === 20 && rolls[0] === 20 && count === 1;
  const isMin  = sides === 20 && rolls[0] === 1  && count === 1;
  const badge  = isCrit ? ' ★' : isMin ? ' ☠' : '';
  const noteHtml = note ? ` <span class="h-note">— ${escapeAttr(note)}</span>` : '';

  const li = el('li', isCrit ? 'h-critical' : isMin ? 'h-min' : '');
  const totalHtml = sides === 0 ? '' : `<span class="h-total">${total}${badge}</span>`;
  li.innerHTML = `<span class="h-notation">${notation}</span>${totalHtml}${noteHtml}`;
  hist.insertBefore(li, hist.firstChild);
  if (hist.children.length > 12) hist.removeChild(hist.lastChild);
}

// ═══════════════════════════════════════════════════════════════════════════
// PANEL LOCK SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

function initPanelLocks() {
  document.querySelectorAll('.panel[data-panel]').forEach(panel => {
    const id = panel.dataset.panel;
    if (id === 'inventory') return; // inventory is always interactive — no lock
    if (id === 'identity')  return; // identity slide is only for editing — always unlocked, no lock button

    // Add lock button if not already present, or attach handler to existing one
    let lockBtn = panel.querySelector('.panel-lock-btn');
    if (!lockBtn) {
      lockBtn = document.createElement('button');
      lockBtn.className = 'panel-lock-btn locked';
      lockBtn.type = 'button';
      lockBtn.dataset.panelLock = id;
      const header = panel.querySelector('.panel-header');
      const action = header.querySelector('.panel-header-action');
      if (action) header.insertBefore(lockBtn, action);
      else header.appendChild(lockBtn);
    }
    lockBtn.addEventListener('click', e => {
      e.stopPropagation();
      togglePanelLock(id);
    });

    // Default to locked if not yet set
    if (state.panelLocks[id] === undefined) state.panelLocks[id] = true;
    _applyPanelLock(panel, state.panelLocks[id]);
  });

  // Ability block dice shortcut — active only when abilities panel is locked
  document.querySelectorAll('.ability-block').forEach(block => {
    block.addEventListener('click', () => {
      const panel = block.closest('.panel');
      if (!panel?.classList.contains('panel-locked')) return;
      const ability = block.dataset.ability;
      setDieSides(20);
      setAbilityMod(ability);
      // Always hide both context rows — ability rolls show neither
      const sr = $('spell-dc-row');   if (sr) sr.hidden = true;
      const wr = $('weapon-dmg-row'); if (wr) wr.hidden = true;
      openDice(true); // keepContext=true so openDice doesn't toggle them again
      setTimeout(rollNow, 80);
    });
  });
}

function togglePanelLock(panelId) {
  const panel = document.querySelector(`.panel[data-panel="${panelId}"]`);
  if (!panel) return;
  const nowLocked = !panel.classList.contains('panel-locked');
  state.panelLocks[panelId] = nowLocked;
  _applyPanelLock(panel, nowLocked);
}

function _applyPanelLock(panel, locked) {
  panel.classList.toggle('panel-locked', locked);
  const btn = panel.querySelector('.panel-lock-btn');
  if (!btn) return;
  btn.textContent = locked ? '🔒' : '🔓';
  btn.title = locked ? 'Unlock to edit' : 'Lock panel';
  btn.classList.toggle('locked', locked);
  btn.classList.toggle('unlocked', !locked);
}

function initDiceRoller() {
  // Die type buttons
  document.querySelectorAll('.die-type').forEach(btn => {
    btn.onclick = () => setDieSides(parseInt(btn.dataset.sides));
  });
  // Count input — roll on Enter
  $('dice-count-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') rollNow(); });
  // Nav toggle
  $('btn-dice-nav').onclick = toggleDice;
  // Keyboard: D to toggle, R to roll while open
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea')) return;
    if (e.key === 'd' || e.key === 'D') toggleDice();
    if ((e.key === 'r' || e.key === 'R') && $('dice-panel').classList.contains('open')) rollNow();
    if (e.key === 'Escape') closeDice();
  });
  // Click outside dice panel closes it
  document.addEventListener('mousedown', e => {
    if (!$('dice-panel').classList.contains('open')) return;
    if (!e.target.closest('#dice-panel') && !e.target.closest('#btn-dice-nav')) {
      closeDice();
    }
  });
  // Click outside an unlocked panel re-locks it
  document.addEventListener('mousedown', e => {
    document.querySelectorAll('.panel:not(.panel-locked)').forEach(panel => {
      if (panel.dataset.panel === 'identity') return; // identity is never locked
      // Ignore clicks on the lock button itself (togglePanelLock handles that)
      if (e.target.closest('.panel-lock-btn')) return;
      // If click landed outside this panel, re-lock it
      if (!panel.contains(e.target)) {
        const panelId = panel.dataset.panel;
        state.panelLocks[panelId] = true;
        _applyPanelLock(panel, true);
        scheduleAutoSave();
      }
    });
  });
  // Init die display and default state
  setDieSides(20);
  $('amb-clear').classList.add('active');
  refreshAbilityButtons();
}

// ═══════════════════════════════════════════════════════════════════════════
// ITEM HOVER CARDS
// ═══════════════════════════════════════════════════════════════════════════

const CARD_CFG = {
  weapons: {
    label:'Weapon',       icon:'⚔', color:'#c0392b',
    nameKey:'Weapon',
    stats:[
      {l:'Damage',  k:'Damage'},
      {l:'Range',   k:'Range'},
      {l:'Type',    k:'Type'},
      {l:'Cost',    k:'Cost'},
      {l:'Slots',   k:'Gear Slots'},
      {l:'Properties', k:'Properties'},
    ], desc:'Effect'
  },
  armor: {
    label:'Armor',        icon:'🛡', color:'#2980b9',
    nameKey:'Armor',
    stats:[
      {l:'AC',      k:'AC'},
      {l:'Slots',   k:'Gear Slots'},
      {l:'Cost',    k:'Cost'},
      {l:'Properties', k:'Properties'},
    ], desc:'Effect/Description'
  },
  spells: {
    label:'Spell',        icon:'✨', color:'#8e44ad',
    nameKey:'Spell Name',
    stats:[
      {l:'Tier',     k:'Tier'},
      {l:'Caster',   k:'Caster'},
      {l:'Duration', k:'Duration'},
      {l:'Range',    k:'Range'},
      {l:'For',      k:'Aligment'},
    ], desc:'Description'
  },
  gear: {
    label:'Gear',         icon:'🎒', color:'#d35400',
    nameKey:'Item',
    stats:[
      {l:'Slots', k:'Gear Slots'},
      {l:'Cost',  k:'Cost'},
      {l:'Properties', k:'Properties'},
    ], desc:'Effect'
  },
  magic_items: {
    label:'Magic Item',   icon:'⭐', color:'#f39c12',
    nameKey:'Name',
    stats:[
      {l:'Type',  k:'Type'},
      {l:'Bonus', k:'Bonus'},
    ],
    desc:'Benefit',
    extra:[
      {l:'Description', k:'Description'},
      {l:'Curse',       k:'Curse'},
      {l:'Personality', k:'Personality'},
    ]
  },
  gems: {
    label:'Gem',          icon:'💎', color:'#00bcd4',
    nameKey:'Valuable',
    stats:[
      {l:'Value', k:'GP (each)', sfx:' gp'},
      {l:'Found', k:'Found'},
      {l:'Slots', k:'Gear Slots'},
    ], desc:'Description'
  },
  plants_poisons: {
    label:'Plant / Poison', icon:'🌿', color:'#27ae60',
    nameKey:'Item',
    stats:[
      {l:'Rarity', k:'Rarity'},
      {l:'Use',    k:'Use'},
      {l:'Slots',  k:'Gear Slots'},
      {l:'Cost',   k:'GP'},
    ], desc:'Effects'
  },
  traps: {
    label:'Trap',         icon:'⚙', color:'#7f8c8d',
    nameKey:'Item',
    stats:[
      {l:'Slots', k:'Gear Slots'},
      {l:'Cost',  k:'GP'},
      {l:'Properties', k:'Properties'},
    ], desc:'Description'
  },
  mounts: {
    label:'Mount',        icon:'🐴', color:'#795548',
    nameKey:'Name',
    stats:[
      {l:'Cost',   k:'Cost'},
      {l:'Rarity', k:'Rarity'},
      {l:'Spooks', k:'Spooks?'},
    ], desc:'properties'
  },
  mount_gear: {
    label:'Mount Gear',   icon:'🎠', color:'#795548',
    nameKey:'Name',
    stats:[{l:'Cost', k:'Cost'}], desc:'properties'
  },
  spell_catalysts: {
    label:'Catalyst',     icon:'⚗', color:'#009688',
    nameKey:'Catalyst',
    stats:[
      {l:'For Spell', k:'Spell Name'},
      {l:'Slots',     k:'Gear Slots'},
      {l:'Cost',      k:'GP'},
    ], desc:'Description'
  },
};

// Flat lookup: lowercased name → { item, table }
let itemLookup = null;
let itemLookupPromise = null;

/** Language-neutral slug — strips diacritics, lowercases, replaces non-alphanum
 *  with '_'. Used to derive an id from a stored display name. */
function _slugId(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function buildItemLookup() {
  if (itemLookupPromise) return itemLookupPromise;
  itemLookupPromise = (async () => {
    itemLookup = {};
    const tables = Object.keys(CARD_CFG);
    await Promise.all(tables.map(async t => {
      if (!state.refData[t]) state.refData[t] = await API.data(t);
      const cfg = CARD_CFG[t];
      (state.refData[t] || []).forEach(item => {
        const name = item[cfg.nameKey];
        if (name) itemLookup[String(name).toLowerCase()] = { item, table: t };
        if (item.id) itemLookup['__id__:' + String(item.id).toLowerCase()] = { item, table: t };
      });
    }));
  })();
  return itemLookupPromise;
}

function findItem(name) {
  if (!itemLookup) return null;
  const canon = canonicalItemName(name);
  const key = canon.toLowerCase().trim();
  // 1) Direct name match (covers EN or current-language names)
  if (itemLookup[key]) return itemLookup[key];
  // 2) Id match — slugify the base name and look up by id (language-neutral)
  const base = canon.replace(/\s*\(\d+(?:\/\d+)?\)\s*$/, '').trim();
  const idKey = '__id__:' + _slugId(base);
  if (itemLookup[idKey]) return itemLookup[idKey];
  // 3) Partial match fallback (legacy behavior)
  for (const k in itemLookup) {
    if (k.startsWith('__id__:')) continue;
    if (k.startsWith(key) || key.startsWith(k)) return itemLookup[k];
  }
  return null;
}

function buildCardHTML(item, table) {
  const cfg = CARD_CFG[table];
  if (!cfg) return '';

  const name  = item[cfg.nameKey] || 'Unknown';
  const color = cfg.color;

  const statsHtml = (cfg.stats || [])
    .filter(s => item[s.k] != null && String(item[s.k]).trim() !== '' && String(item[s.k]) !== 'null')
    .map(s => `<div class="icard-stat">
      <span class="icard-stat-label">${s.l}</span>
      <span class="icard-stat-val">${escHtml(String(item[s.k]))+(s.sfx||'')}</span>
    </div>`).join('');

  const desc = item[cfg.desc];
  const descRaw = desc && String(desc) !== 'null' ? String(desc).trim() : '';
  const descHtml = descRaw
    ? `<div class="icard-desc">${escHtml(descRaw.slice(0, 480))}${descRaw.length > 480 ? '…' : ''}</div>`
    : '';

  const extraHtml = (cfg.extra || [])
    .filter(e => item[e.k] != null && String(item[e.k]).trim() !== '' && String(item[e.k]) !== 'null')
    .map(e => `<div class="icard-extra"><span class="icard-extra-label">${e.l}:</span> ${escHtml(String(item[e.k]).slice(0,200))}</div>`)
    .join('');

  return `
    <div class="icard-header" style="border-left-color:${color}">
      <span class="icard-icon">${cfg.icon}</span>
      <span class="icard-name">${escHtml(name)}</span>
      <span class="icard-type" style="color:${color};border-color:${color}">${cfg.label}</span>
    </div>
    ${statsHtml ? `<div class="icard-stats">${statsHtml}</div>` : ''}
    ${descHtml}
    ${extraHtml}`;
}

let hoverTimer = null;
let cardTarget = null;

function showCard(item, table, cx, cy) {
  const card = $('item-card');
  card.innerHTML = buildCardHTML(item, table);
  placeCard(cx, cy);
  card.classList.add('visible');
  cardTarget = { item, table };
}

function hideCard() {
  $('item-card').classList.remove('visible');
  cardTarget = null;
}

function showSpellsKnownCard(table, className, cx, cy) {
  const card = $('item-card');

  // Determine which tiers actually have any spells
  const tiers = [1,2,3,4,5].filter(t => table.some(row => (row[`tier${t}`] || 0) > 0));

  let html = `<div class="spells-known-card">`;
  html += `<div class="spells-known-title">${className} — Spells Known</div>`;
  html += `<table class="spells-known-table">`;
  html += `<thead><tr><th>Lvl</th>${tiers.map(t => `<th>T${t}</th>`).join('')}</tr></thead>`;
  html += `<tbody>`;
  table.forEach(row => {
    html += `<tr><td class="sk-level">${row.level}</td>`;
    tiers.forEach(t => {
      const val = row[`tier${t}`] || 0;
      html += `<td class="${val > 0 ? 'sk-val' : 'sk-zero'}">${val > 0 ? val : '—'}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody></table></div>`;

  card.innerHTML = html;
  placeCard(cx, cy);
  card.classList.add('visible');
  cardTarget = null;
}

function placeCard(cx, cy) {
  const card = $('item-card');
  const vw   = window.innerWidth;
  const vh   = window.innerHeight;
  // card is always in DOM (just transparent), so offsetHeight is the real rendered height
  const cw   = card.offsetWidth  || 288;
  const ch   = card.offsetHeight || 100;
  let left   = cx + 16;
  let top    = cy + 10;
  if (left + cw > vw - 8) left = cx - cw - 10;
  if (top  + ch > vh - 8) top  = vh - ch - 8;
  card.style.left = Math.max(8, left) + 'px';
  card.style.top  = Math.max(8, top)  + 'px';
}

function _resolveHoverTarget(el) {
  // Returns { showFn, name } or null for a hoverable element
  const atkCard = el.closest('.attack-card');
  if (atkCard) {
    const name = atkCard.querySelector('.atk-name')?.textContent?.trim();
    if (name) return { type: 'item', name };
  }
  const gearEl = el.closest('[data-gear-slot], .free-carry-item .gear-item-btn');
  if (gearEl) {
    const name = (gearEl.dataset.gearValue ?? gearEl.textContent ?? '').trim();
    if (name) return { type: 'item', name };
  }
  const refRow = el.closest('tr[data-ref-idx]');
  if (refRow) {
    return { type: 'ref', table: refRow.dataset.refTable, idx: parseInt(refRow.dataset.refIdx) };
  }
  const featEl = el.closest('.class-feature-has-spells');
  if (featEl) {
    return { type: 'spells', el: featEl };
  }
  const listInp = el.closest('.item-list input');
  if (listInp) {
    const name = listInp.value.trim();
    if (name) return { type: 'item', name };
  }
  const spellBtn = el.closest('.spell-btn');
  if (spellBtn) {
    const name = spellBtn.dataset.spell?.trim();
    if (name) return { type: 'item', name };
  }
  // Mount gear slots
  const mountSlot = el.closest('.mount-slot .gear-item-btn');
  if (mountSlot) {
    const name = (mountSlot.textContent ?? '').trim();
    if (name) return { type: 'item', name };
  }
  return null;
}

async function _showHoverCard(target, cx, cy) {
  if (target.type === 'item') {
    await buildItemLookup();
    const found = findItem(target.name);
    if (found) showCard(found.item, found.table, cx, cy);
  } else if (target.type === 'ref') {
    const item = state.refData[target.table]?.[target.idx];
    if (item) showCard(item, target.table, cx, cy);
  } else if (target.type === 'spells') {
    try {
      const table = JSON.parse(target.el.dataset.spellsTable);
      const className = $('class-select')?.value || 'Class';
      showSpellsKnownCard(table, className, cx, cy);
    } catch(_) {}
  }
}

function initItemCards() {
  // True hover devices only — touch synthesizes mouseover/move/leave from
  // touchstart/end, which would otherwise pop the card the instant you tap.
  const hoverCapable = window.matchMedia('(hover: hover)');

  // ── Desktop: mouseover delegation ──────────────────────────────────────
  document.addEventListener('mouseover', async e => {
    if (!hoverCapable.matches) return;
    const target = _resolveHoverTarget(e.target);
    if (target) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => _showHoverCard(target, e.clientX, e.clientY), 200);
      return;
    }
    if (!e.target.closest('#item-card') && !e.target.closest('#reference-drawer')) {
      clearTimeout(hoverTimer);
      hideCard();
    }
  });

  // ── Double-tap (touch) / double-click (desktop) → show description card ──
  // The native `dblclick` event fires on both — touch-action: manipulation
  // (in CSS) tells mobile browsers to fire it immediately without the usual
  // ~300ms double-tap-zoom delay.
  document.addEventListener('dblclick', e => {
    if (e.target.closest(
      '.ref-add-btn, .gear-action-btn, .gear-clear-btn, .gear-qty-input'
    )) return;
    // Reference rows use click-to-expand inline detail (rules-pages style),
    // so the popup card is no longer shown on dblclick for them.
    if (e.target.closest('tr[data-ref-idx]')) return;
    const target = _resolveHoverTarget(e.target);
    if (!target) return;
    document.querySelectorAll('.gear-slot.slot-active').forEach(s => s.classList.remove('slot-active'));
    _showHoverCard(target, e.clientX, e.clientY);
  });

  // ── Outside-click → hide card (touch + desktop) ─────────────────────
  // Click anywhere outside the card itself dismisses it. On desktop we used to
  // spare the reference drawer (so hover could keep working while moving the
  // mouse around), but explicit "click outside card to hide" is more reliable
  // for both touch and desktop UX.
  document.addEventListener('mousedown', e => {
    if (e.target.closest('#item-card')) return;        // clicking the card itself keeps it
    // On touch, tapping a ref row re-opens via the click handler above, so
    // letting mousedown hide first would cause a flash. Skip the hide there.
    if (!hoverCapable.matches && e.target.closest('tr[data-ref-idx]')) return;
    clearTimeout(hoverTimer);
    hideCard();
  });

  document.addEventListener('mousemove', e => {
    if (!hoverCapable.matches) return;
    if ($('item-card').classList.contains('visible')) placeCard(e.clientX, e.clientY);
  });

  document.addEventListener('mouseleave', () => {
    if (!hoverCapable.matches) return;
    clearTimeout(hoverTimer); hideCard();
  });

  const HOVER_TRIGGERS = ['.attack-card', '[data-gear-slot]', '.free-carry-item .gear-item-btn', 'tr[data-ref-idx]', '.item-list input', '.spell-btn', '.mount-slot .gear-item-btn'];
  document.addEventListener('mouseout', e => {
    if (!hoverCapable.matches) return;
    const fromTrigger = HOVER_TRIGGERS.some(sel => e.target.closest(sel));
    if (!fromTrigger) return;
    const toTrigger = HOVER_TRIGGERS.some(sel => e.relatedTarget?.closest(sel));
    if (!toTrigger) { clearTimeout(hoverTimer); hideCard(); }
  });

  // Long-press has been replaced by double-tap (see the dblclick handler
  // above). No touchstart/touchmove/touchend listeners needed for cards.
}

// ═══════════════════════════════════════════════════════════════════════════
// ATTACK CARDS
// ═══════════════════════════════════════════════════════════════════════════

let attacksEditMode = false;

function parseAttackLine(line) {
  const s = line.trim();
  if (!s) return null;
  // Matches: "Longsword  +2 to hit  /  1d8+2 dmg | C [V, 2 slots]"
  const atkM  = s.match(/([+-]\d+)\s+to\s+hit/i);
  const dmgM  = s.match(/(\d+)d(\d+)([+-]\d+)?\s*dmg/i);
  const rangeM = s.match(/\|\s*([A-Z]+)/);
  // Name = everything before first +/- or slash
  const cutAt = atkM ? s.indexOf(atkM[0]) : (dmgM ? s.indexOf(dmgM[0]) : s.length);
  const name  = s.slice(0, cutAt).replace(/\s*\/\s*$/, '').trim() || s;
  return {
    name,
    line:     s,
    atkBonus: atkM  ? parseInt(atkM[1])   : null,
    dmgCount: dmgM  ? parseInt(dmgM[1])   : 1,
    dmgSides: dmgM  ? parseInt(dmgM[2])   : null,
    dmgMod:   dmgM?.[3] ? parseInt(dmgM[3]) : 0,
    range:    rangeM ? rangeM[1]           : null,
  };
}

function renderAttackCards(text) {
  const container = $('attacks-cards');
  if (!container) return;
  const lines = (text || '').split('\n').filter(l => l.trim());
  if (!lines.length) {
    container.innerHTML = '<div class="attacks-empty">Tag ⚔ weapons in inventory to auto-fill, or click ✎ to type manually.</div>';
    return;
  }
  container.innerHTML = '';
  lines.forEach(line => {
    const p = parseAttackLine(line);
    if (!p) return;
    const atkStr = p.atkBonus !== null ? (p.atkBonus >= 0 ? `+${p.atkBonus}` : `${p.atkBonus}`) : '';
    const dmgStr = p.dmgSides
      ? `${p.dmgCount}d${p.dmgSides}${p.dmgMod > 0 ? '+'+p.dmgMod : p.dmgMod < 0 ? p.dmgMod : ''}`
      : '';
    const isFinesse = state.finesseWeapons && p.name in state.finesseWeapons;
    const finessePref = isFinesse ? state.finesseWeapons[p.name] : null;

    const wrapper = el('div', 'attack-card-row');

    const card = el('button', 'attack-card');
    card.type  = 'button';
    card.title = 'Click to roll attack + damage';
    card.innerHTML = `
      <span class="atk-name">${escHtml(p.name)}</span>
      <div class="atk-badges">
        ${atkStr ? `<span class="atk-hit-badge">${atkStr} hit</span>` : ''}
        ${dmgStr ? `<span class="atk-dmg-badge">${dmgStr}</span>`    : ''}
        ${p.range ? `<span class="atk-range-badge">${p.range}</span>` : ''}
      </div>
      <span class="atk-roll-icon">⚄</span>`;
    card.onclick = () => rollWeaponAttack(p);
    wrapper.appendChild(card);

    if (isFinesse) {
      const tog = el('button', `finesse-toggle finesse-toggle--${finessePref}`);
      tog.type  = 'button';
      tog.title = `Finesse — click to use ${finessePref === 'str' ? 'DEX' : 'STR'} instead`;
      tog.textContent = finessePref === 'str' ? 'STR' : 'DEX';
      tog.onclick = e => { e.stopPropagation(); toggleFinesseWeapon(p.name); };
      wrapper.appendChild(tog);
    }

    container.appendChild(wrapper);
  });
}

function toggleAttacksEdit() {
  attacksEditMode = !attacksEditMode;
  const ta  = $('attacks-textarea');
  const cards = $('attacks-cards');
  const btn = $('btn-atk-edit');
  if (attacksEditMode) {
    ta.style.display    = '';
    cards.style.display = 'none';
    btn.classList.add('editing');
    btn.title = 'Back to card view';
    ta.focus();
  } else {
    ta.style.display    = 'none';
    cards.style.display = '';
    btn.classList.remove('editing');
    btn.title = 'Edit manually';
    renderAttackCards(ta.value);
  }
}

// ── Weapon attack roll ─────────────────────────────────────────────────────
function rollWeaponAttack(weapon) {
  openDice(true);

  // Roll attack d20
  const atkBonus = weapon.atkBonus ?? 0;
  const atkRoll  = Math.floor(Math.random() * 20) + 1;
  const atkTotal = atkRoll + atkBonus;
  const isCrit   = atkRoll === 20;
  const isFumble = atkRoll === 1;

  // Roll damage
  let dmgTotal = 0, dmgRolls = [];
  if (weapon.dmgSides) {
    for (let i = 0; i < (weapon.dmgCount || 1); i++) {
      const r = Math.floor(Math.random() * weapon.dmgSides) + 1;
      dmgRolls.push(r);
      dmgTotal += r;
    }
    dmgTotal += weapon.dmgMod || 0;
    if (isCrit) dmgTotal += dmgRolls.reduce((a,b)=>a+b,0); // Shadowdark crit = double dice
  }

  // Show weapon dmg row, hide spell row
  const spellDcRow = $('spell-dc-row');
  if (spellDcRow) spellDcRow.hidden = true;
  const dmgRow = $('weapon-dmg-row');
  const wdrNameEl = $('wdr-name');
  if (wdrNameEl) {
    const displayName = (weapon.name||'').length > 28 ? (weapon.name||'').slice(0,26)+'…' : (weapon.name||'');
    wdrNameEl.textContent = displayName;
  }
  dmgRow.hidden = false;

  const atkEl = $('wdr-atk');
  const dmgEl = $('wdr-dmg');
  atkEl.className = 'wdr-val';
  dmgEl.className = 'wdr-val';
  atkEl.textContent = '…';
  dmgEl.textContent = weapon.dmgSides ? '…' : '—';

  // Animate attack die in main display
  setDieSides(20);
  const face  = $('die-face');
  const numEl = $('die-num');
  face.style.setProperty('--dc', DIE_COLORS[20]);
  face.classList.remove('landing');
  face.classList.add('rolling');
  let fl = setInterval(() => { numEl.textContent = Math.floor(Math.random()*20)+1; }, 60);

  setTimeout(() => {
    clearInterval(fl);
    face.classList.remove('rolling');
    numEl.textContent = atkRoll;
    face.classList.add('landing');

    // Show attack total
    $('roll-total').textContent = atkTotal;
    void $('roll-total').offsetWidth;
    $('roll-total').classList.add('popped');
    const bonus = atkBonus >= 0 ? `+${atkBonus}` : `${atkBonus}`;
    $('roll-breakdown').textContent =
      `${weapon.name} — d20(${atkRoll})${atkBonus!==0?bonus:''} = ${atkTotal}${isCrit?' ★ CRIT':isFumble?' ☠ FUMBLE':''}`;

    // Animate attack value in weapon row
    atkEl.textContent = atkTotal;
    atkEl.className   = 'wdr-val popped' + (isCrit?' crit':isFumble?' fumble':'');

    setTimeout(() => face.classList.remove('landing'), 450);

    // Damage animation after attack settles
    if (weapon.dmgSides) {
      setTimeout(() => {
        const dmgSides = weapon.dmgSides;
        face.classList.remove('landing');
        face.style.setProperty('--dc', DIE_COLORS[dmgSides] || '#fb923c');
        setDieSides(dmgSides);
        face.classList.add('rolling');
        let fl2 = setInterval(() => { numEl.textContent = Math.floor(Math.random()*dmgSides)+1; }, 60);
        setTimeout(() => {
          clearInterval(fl2);
          face.classList.remove('rolling');
          numEl.textContent = dmgRolls[0] || dmgTotal;
          face.classList.add('landing');
          dmgEl.textContent = dmgTotal;
          void dmgEl.offsetWidth;
          dmgEl.className = 'wdr-val popped' + (isCrit?' crit':'');

          const dNotation = `${weapon.dmgCount||1}d${dmgSides}${weapon.dmgMod?((weapon.dmgMod>0?'+':'')+weapon.dmgMod):''}`;
          addDiceHistory(weapon.dmgCount||1, dmgSides, weapon.dmgMod||0, dmgRolls, dmgTotal);
          setTimeout(() => face.classList.remove('landing'), 450);
          dice.rolling = false;
        }, 580);
      }, 550);
    } else {
      dice.rolling = false;
    }
  }, 680);

  // History entry for attack
  const atkRolls = [atkRoll];
  addDiceHistory(1, 20, atkBonus, atkRolls, atkTotal);
}

// ── Update renderRefTable to embed data-ref-idx on rows ───────────────────
// (override the existing function defined earlier in this file)
const _origRenderRefTable = renderRefTable;
// ── Class-availability filter (weapons / armor / spells) ───────────────────
const CLASS_FILTER_TABLES = ['weapons', 'armor', 'spells'];

function _getCharClassData() {
  const cn = state.char?.class_name;
  if (!cn) return null;
  return (state.refData.classes || []).find(c => c.class === cn) || null;
}

/** Does a class's free-text weapon proficiency allow this weapon row?
 *  ID-based: matches each proficiency token against the weapon's stable `id`
 *  (a language-neutral English slug). Category words (all/melee/ranged/swords/
 *  bows) keep using the English proficiency text + the weapon's Type field. */
function _profAllowsWeapon(prof, row) {
  const p = String(prof || '').toLowerCase().trim();
  if (!p || p.startsWith('none')) return false;
  const id = String(row.id || '').toLowerCase();
  const type = String(row.Type || '').toLowerCase();        // 'm' / 'r' / 'm/r' (language-neutral)
  const isMelee  = type.includes('m');
  const isRanged = type.includes('r');

  // Parse "… except A, B and C" exclusions → ids
  const exMatch = p.match(/except\s+(.+)$/);
  const exclusionIds = exMatch
    ? exMatch[1].split(/,|\band\b|\bor\b/).map(s => _slugId(s)).filter(Boolean)
    : [];
  const isExcluded = exclusionIds.some(e => id === e || id.includes(e));

  const clauses = p.split(',').map(s => s.trim()).filter(Boolean);
  for (const cl of clauses) {
    if (/all weapons/.test(cl)) return !isExcluded;
    if (/all melee/.test(cl) && isMelee)  return !isExcluded;
    if (/all ranged/.test(cl) && isRanged) return !isExcluded;
    if (/all swords?/.test(cl) && id.includes('sword')) return true;
    if (/\bbows?\b/.test(cl) && id.includes('bow'))   return true;
    // Specific named weapon → slugify and match the id
    const token = cl.replace(/except.*$/, '').replace(/^all\s+/, '')
                    .replace(/\s+weapons?$/, '').trim();
    const tokId = _slugId(token);
    if (tokId && (id === tokId || id.includes(tokId))) return true;
  }
  return false;
}

/** Does a class's free-text armor proficiency allow this armor row?
 *  ID-based: splits the proficiency into clauses and matches each clause's
 *  slugified id against the armor's stable `id`. */
function _profAllowsArmor(prof, row) {
  const p = String(prof || '').toLowerCase().trim();
  if (!p || p.startsWith('none') || p.startsWith('special')) return false;
  const id = String(row.id || '').toLowerCase();
  const isShield = id.startsWith('shield');
  if (/all armor|any armor|all armors/.test(p)) return true;   // covers shields too
  if (isShield) return /shield/.test(p);
  // Split proficiency into clauses; each clause must equal or be contained in
  // the armor id (after slugifying the clause). "mithral chainmail" → slug
  // "mithral_chainmail" → won't match plain "chainmail" id (correct).
  const clauses = p.split(/,|\band\b/).map(s => s.trim()).filter(Boolean);
  for (const cl of clauses) {
    // Strip a trailing "armor" so "leather armor" → material "leather"
    let slug = _slugId(cl.replace(/^all\s+/, '').replace(/\s+armor[s]?$/, ''));
    if (!slug) continue;
    // Direct id equality
    if (id === slug) return true;
    // Single-token clause: allow substring (e.g., "leather" matches "studded_leather")
    if (!slug.includes('_') && id.includes(slug)) return true;
    // "Mithral chainmail" specifically refers to the Mithril armor entry
    if (slug === 'mithral_chainmail' && id === 'mithril') return true;
  }
  return false;
}

/** Spell caster keys for the class (from its spellcasting list). */
function _classCasterKeys(classData) {
  const sc = String(classData?.spellcasting || '').toLowerCase();
  const keys = [];
  if (sc.includes('wizard')) keys.push('wizard');
  if (sc.includes('priest')) keys.push('priest');
  if (sc.includes('witch'))  keys.push('witch');
  return keys;
}

function _spellAllowed(row, casterKeys, alignment) {
  if (!casterKeys.length) return false;
  const caster = String(row.Caster || '').toLowerCase();
  if (!casterKeys.some(k => caster.includes(k))) return false;
  const al = String(row.Aligment || '').toLowerCase().trim();
  if (al === 'all' || al === '') return true;
  return al === String(alignment || '').toLowerCase().trim();
}

/** Returns true if the given row passes the active class filter. */
function _rowPassesClassFilter(row, table) {
  // 1. Spells tab also honors the caster / alignment chip filters
  if (table === 'spells') {
    if (state.refSpellCaster && state.refSpellCaster !== 'all') {
      const c = String(row.Caster || '').toLowerCase();
      if (!c.includes(state.refSpellCaster.toLowerCase())) return false;
    }
    if (state.refSpellAligns && state.refSpellAligns.size > 0) {
      const al = String(row.Aligment || '').toLowerCase().trim();
      let match = false;
      state.refSpellAligns.forEach(a => { if (al === a.toLowerCase()) match = true; });
      if (!match) return false;
    }
  }
  // 2. Then the global "Class only" toggle
  if (!state.refClassFilter || !CLASS_FILTER_TABLES.includes(table)) return true;
  const cd = _getCharClassData();
  if (!cd) return true;
  if (table === 'weapons') return _profAllowsWeapon(cd.weapons, row);
  if (table === 'armor')   return _profAllowsArmor(cd.armor, row);
  if (table === 'spells')  return _spellAllowed(row, _classCasterKeys(cd), state.char?.alignment);
  return true;
}

/** Show/hide the per-tab filter rows (currently the Spells tab uses them). */
function _updateSpellFilters(table) {
  const casterBar = $('ref-spell-filters');
  const alignBar  = $('ref-spell-align-filters');
  if (!casterBar || !alignBar) return;
  const showCaster = (table === 'spells');
  casterBar.hidden = !showCaster;
  // Alignment row only appears once a specific caster is picked
  alignBar.hidden = !showCaster || state.refSpellCaster === 'all';
  if (!showCaster) return;
  // Reflect current state in the chips
  document.querySelectorAll('.ref-caster-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.caster === state.refSpellCaster);
  });
  document.querySelectorAll('.ref-align-btn').forEach(b => {
    b.classList.toggle('active', state.refSpellAligns.has(b.dataset.align));
  });
}

/** Show/hide + label the class-filter toggle button for the current tab. */
function _updateClassFilterBtn(table) {
  const btn = $('ref-class-filter');
  if (!btn) return;
  const applies = CLASS_FILTER_TABLES.includes(table) && !!state.char?.class_name;
  btn.hidden = !applies;
  if (applies) {
    btn.textContent = `${state.char.class_name} only`;
    btn.classList.toggle('active', !!state.refClassFilter);
  }
}

function toggleClassFilter() {
  state.refClassFilter = !state.refClassFilter;
  const rerender = () => {
    _updateClassFilterBtn(state.refTable);
    renderRefTable(state.refData[state.refTable], state.refTable);
  };
  // Class data is needed to filter — load it if missing
  if (state.refClassFilter && !state.refData.classes) {
    API.data('classes').then(d => { state.refData.classes = d; rerender(); });
  } else {
    rerender();
  }
}

// Description-like fields, in priority order, for the inline expanded detail
const REF_DESC_KEYS = [
  'Description', 'Effect/Description', 'Effect', 'Benefit', 'Use', 'Properties'
];

function _refDescField(row) {
  for (const k of REF_DESC_KEYS) {
    const v = row[k];
    if (v != null && String(v).trim() !== '' && String(v).toLowerCase() !== 'null') {
      return String(v);
    }
  }
  return '';
}

/** Sort comparator: numeric if both parse to numbers (handles "10 gp"
 *  → 10), else case-insensitive string compare. */
function _refSortCompare(a, b) {
  if (a == null) a = '';
  if (b == null) b = '';
  const sa = String(a).trim(), sb = String(b).trim();
  // Try leading-number numeric compare (works for "10", "10 gp", "5 sp")
  const na = parseFloat(sa), nb = parseFloat(sb);
  if (!isNaN(na) && !isNaN(nb) && /^[\d.+-]/.test(sa) && /^[\d.+-]/.test(sb)) {
    return na - nb;
  }
  return sa.toLowerCase().localeCompare(sb.toLowerCase());
}

function renderRefTable(rows, table) {
  if (!rows?.length) {
    $('drawer-content').innerHTML = '<p style="color:var(--text-muted);padding:1rem">No data.</p>';
    return;
  }
  const cols = TABLE_COLS[table] || Object.keys(rows[0]).slice(0,5);
  const hideCols = HIDE_ON_MOBILE[table] || [];
  const nameKey = cols[0];

  // Keep ORIGINAL indices alongside rows so data-ref-idx stays correct after sort
  let indexed = rows.map((row, idx) => ({ row, idx }))
                   .filter(({ row }) => _rowPassesClassFilter(row, table));

  // Apply column sort if one is active for the current table
  const sortCol = state.refSort?.col;
  if (sortCol && cols.includes(sortCol)) {
    const dir = state.refSort.asc ? 1 : -1;
    indexed.sort((A, B) => _refSortCompare(A.row[sortCol], B.row[sortCol]) * dir);
  }

  const trs = [];
  indexed.forEach(({ row, idx }) => {
    const itemName = String(row[nameKey] ?? '');
    // Summary row
    const cells = cols.map(c => {
      const v = row[c] ?? '';
      const cls = hideCols.includes(c) ? ' class="ref-hide-mobile"' : '';
      return `<td${cls}>${escHtml(String(v ?? '').substring(0,100))}</td>`;
    }).join('');
    trs.push(`<tr class="ref-row" data-ref-table="${table}" data-ref-idx="${idx}" data-detail-id="d${idx}">
      ${cells}
      <td class="ref-col-add"><button class="ref-add-btn" onclick="event.stopPropagation();addFromRef('${escAttr(itemName)}','${table}')">+</button></td>
    </tr>`);
    // Expandable detail row (rules-pages style)
    const desc = _refDescField(row);
    const metas = cols.slice(1).map(c => {
      const v = row[c];
      if (v == null || String(v).trim() === '' || String(v).toLowerCase() === 'null') return '';
      return `<span><span class="sc-label">${escHtml(c)}</span> ${escHtml(String(v))}</span>`;
    }).filter(Boolean).join('');
    trs.push(`<tr class="row-detail" data-detail="d${idx}">
      <td colspan="${cols.length + 1}">
        <div class="ref-detail-card">
          <div class="ref-detail-name">${escHtml(itemName)}</div>
          ${metas ? `<div class="ref-detail-meta">${metas}</div>` : ''}
          ${desc  ? `<div class="ref-detail-desc">${escHtml(desc)}</div>` : ''}
        </div>
      </td>
    </tr>`);
  });

  // Headers: each column is data-sort clickable, with ▲/▼ on the active sort
  const headers = [...cols,''].map((c, i) => {
    if (i === cols.length) {                                    // trailing "+ add" column
      return '<th class="ref-col-add"></th>';
    }
    const cls = hideCols.includes(c) ? ' ref-hide-mobile' : '';
    const isActive = c === sortCol;
    const arrow = isActive ? (state.refSort.asc ? ' ▲' : ' ▼') : '';
    return `<th class="ref-sortable${cls}${isActive ? ' active' : ''}" data-sort="${escAttr(c)}">${escHtml(c)}<span class="ref-sort-arrow">${arrow}</span></th>`;
  }).join('');
  const body = trs.length
    ? trs.join('')
    : `<tr><td colspan="${cols.length+1}" style="color:var(--text-muted);padding:1rem;text-align:center">None available for this class.</td></tr>`;
  $('drawer-content').innerHTML =
    `<table class="ref-table list-table" data-ref="${table}"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;

  // Click header → toggle sort (asc → desc → off-cycle reverts to default order)
  document.querySelectorAll('#drawer-content th.ref-sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (state.refSort.col === col) {
        if (state.refSort.asc)      state.refSort.asc = false;  // asc → desc
        else                         state.refSort = { col: null, asc: true };  // desc → unsorted
      } else {
        state.refSort = { col, asc: true };
      }
      renderRefTable(state.refData[table], table);
    });
  });

  // Click row → toggle the inline detail; the + button stops propagation.
  document.querySelectorAll('#drawer-content tr.ref-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const did = tr.dataset.detailId;
      document.querySelector(`#drawer-content tr.row-detail[data-detail="${did}"]`)
        ?.classList.toggle('open');
    });
  });
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  wireEvents();
  initDiceRoller();
  initItemCards();
  initPanelLocks();
  initInvContextMenu();

  // URL param handling: ?id=N opens character, ?new=1 creates new
  const params = new URLSearchParams(window.location.search);
  const paramId  = params.get('id');
  const paramNew = params.get('new');
  if (paramId) {
    showSheet(parseInt(paramId, 10));
  } else if (paramNew) {
    API.create().then(c => {
      if (!c || c.__auth === false || c.error) {
        if (c?.__auth === false) window.__openAuthModal?.('signin');
        showList();
        return;
      }
      showSheet(c.id);
    });
  } else {
    showList();   // sets list-view chrome (trash button = bin toggle) + loads list
  }
});
