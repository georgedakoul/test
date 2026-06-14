// GM Board — free-positioned card canvas with auto-save, modal editing,
// typed cards, image upload (file / URL / clipboard paste).
(function(){
'use strict';
const $ = id => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const BOARD_ID = window.__BOARD_ID;
const TYPE_COLORS = {
  note:    { border:'#c08418', accent:'#fde0a0' },
  image:   { border:'#888888', accent:'#dddddd' },
  monster: { border:'#c03838', accent:'#ffb0b0' },
  spell:   { border:'#5a8acb', accent:'#a8c8ec' },
  rule:    { border:'#bca070', accent:'#e0d0a0' },
  custom:  { border:'#7a4ec0', accent:'#c8a8ec' },
};

let state = {
  board: null,
  cards: [],
  // reference data caches for typed cards
  refData: { monsters: null, spells: null, glossary: null },
};

// ─────────────── Save coalescer (debounced per card) ──────────────────────
const _pending = new Map();      // cardId -> setTimeout handle
function scheduleCardSave(card, patch) {
  Object.assign(card, patch);
  const existing = _pending.get(card.id);
  if (existing) clearTimeout(existing);
  const h = setTimeout(async () => {
    _pending.delete(card.id);
    try {
      await fetch(`/api/gm/cards/${card.id}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ x: card.x, y: card.y, w: card.w, h: card.h,
                               color: card.color, data: card.data, type: card.type })
      });
    } catch (e) { /* swallow, will retry on next change */ }
  }, 400);
  _pending.set(card.id, h);
}
async function saveBoardField(patch) {
  await fetch(`/api/gm/boards/${BOARD_ID}`, {
    method: 'PUT', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(patch)
  });
}

// ─────────────── Card render ──────────────────────────────────────────────
function renderCard(card) {
  const node = el('div', 'gm-card');
  node.dataset.id = card.id;
  node.style.left = card.x + 'px';
  node.style.top  = card.y + 'px';
  node.style.width  = card.w + 'px';
  node.style.height = card.h + 'px';
  const color = card.color || TYPE_COLORS[card.type]?.border || '#bca070';
  node.style.borderColor = color;
  node.style.setProperty('--card-accent', color);

  const head = el('div', 'gm-card-head');
  head.innerHTML = `<span class="gm-card-type">${card.type}</span>`;
  const headActions = el('div', 'gm-card-head-actions');
  const editBtn = el('button', 'gm-card-btn'); editBtn.type = 'button'; editBtn.textContent = '✎'; editBtn.title = 'Edit';
  const delBtn  = el('button', 'gm-card-btn danger'); delBtn.type = 'button'; delBtn.textContent = '×'; delBtn.title = 'Delete';
  // Stop pointerdown from reaching the drag handler on the head — otherwise
  // the drag start can swallow the subsequent click.
  for (const b of [editBtn, delBtn]) {
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.addEventListener('mousedown',   (e) => e.stopPropagation());
  }
  editBtn.addEventListener('click', (e) => { e.stopPropagation(); openCardModal(card); });
  delBtn .addEventListener('click', (e) => { e.stopPropagation(); deleteCard(card); });
  headActions.append(editBtn, delBtn);
  head.appendChild(headActions);
  node.appendChild(head);

  const body = el('div', 'gm-card-body');
  renderCardBody(card, body);
  node.appendChild(body);

  const resize = el('div', 'gm-card-resize');
  node.appendChild(resize);

  // Drag (header)
  attachDrag(node, head, card);
  // Resize handle
  attachResize(node, resize, card);

  // Stacking: clicked card moves to top.
  node.addEventListener('mousedown', () => bringToFront(node));

  return node;
}

function renderCardBody(card, body) {
  body.innerHTML = '';
  if (card.type === 'note' || card.type === 'custom') {
    const t = el('div', 'gm-card-title'); t.textContent = card.data?.title || '(untitled)';
    body.appendChild(t);
    const b = el('div', 'gm-card-md'); b.innerHTML = renderMarkdown(card.data?.body_md || '');
    body.appendChild(b);
  } else if (card.type === 'image') {
    if (card.data?.src) {
      const img = el('img', 'gm-card-img'); img.src = card.data.src; img.alt = card.data?.caption || '';
      body.appendChild(img);
      if (card.data?.caption) {
        const cap = el('div', 'gm-card-caption'); cap.textContent = card.data.caption;
        body.appendChild(cap);
      }
    } else {
      body.innerHTML = '<div class="gm-card-empty">No image — click ✎ to add</div>';
    }
  } else if (card.type === 'monster' || card.type === 'spell' || card.type === 'rule') {
    renderReferenceCard(card, body);
  }
}

async function renderReferenceCard(card, body) {
  // Multi-select reference cards (rules and spells) hold an array of ids
  // in card.data.{rule,spell}_ids. Legacy single-id form is still accepted.
  if (card.type === 'rule' || card.type === 'spell') {
    const ids = refIdsOf(card);
    if (!ids.length) {
      const what = card.type === 'rule' ? 'rules' : 'spells';
      body.innerHTML = `<div class="gm-card-empty">Pick ${what} — click ✎</div>`;
      return;
    }
    const refData = await loadRefData(card.type);
    const k = refKey(card.type);
    const entries = ids.map(id => {
      const rid = String(id);
      return (refData || []).find(e =>
        String(e.id ?? '') === rid ||
        String(e.name ?? '') === rid ||
        String(e[k] ?? '') === rid
      ) || { _missing: true, _id: id };
    });

    let html;
    if (card.type === 'rule') {
      html = entries.map(entry => entry._missing
        ? `<div class="gm-card-rule gm-card-rule-missing">Missing: <code>${esc(entry._id)}</code></div>`
        : `<div class="gm-card-rule">
             <div class="gm-card-rule-term">${esc(entry.term || entry.name || '')}</div>
             <div class="gm-card-rule-def">${esc(entry.definition || entry.description || '')}</div>
           </div>`
      ).join('');
    } else {
      html = entries.map(entry => {
        if (entry._missing) {
          return `<div class="gm-card-rule gm-card-rule-missing">Missing: <code>${esc(entry._id)}</code></div>`;
        }
        const name = entry['Spell Name'] || entry.name || '';
        const meta = [
          entry.Tier || entry.tier ? `Tier ${entry.Tier || entry.tier}` : '',
          entry.Caster || entry.caster || '',
          entry.Range  || entry.range  || '',
          entry.Duration || entry.duration || '',
        ].filter(Boolean).join(' · ');
        const desc = entry.Description || entry.description || '';
        return `<div class="gm-card-rule">
                  <div class="gm-card-rule-term">${esc(name)}</div>
                  ${meta ? `<div class="gm-card-meta">${esc(meta)}</div>` : ''}
                  ${desc ? `<div class="gm-card-rule-def">${esc(desc)}</div>` : ''}
                </div>`;
      }).join('');
    }

    const noun = card.type === 'rule' ? 'Rule' : 'Spell';
    const label = ids.length > 1 ? `${noun}s (${ids.length})` : noun;
    body.innerHTML = `<div class="gm-card-title">${label}</div>${html}`;
    return;
  }

  // Monsters — single reference per card.
  const refId = card.data?.[card.type + '_id'];
  if (!refId) { body.innerHTML = '<div class="gm-card-empty">Pick a ' + card.type + ' — click ✎</div>'; return; }
  const refData = await loadRefData(card.type);
  const rid = String(refId);
  const k = refKey(card.type);
  const entry = (refData || []).find(e =>
    String(e.id ?? '') === rid ||
    String(e.name ?? '') === rid ||
    String(e[k] ?? '') === rid
  );
  if (!entry) {
    body.innerHTML = `<div class="gm-card-missing">Missing reference:<br><code>${esc(refId)}</code></div>`;
    return;
  }
  body.innerHTML = `
    <div class="gm-card-title">${esc(entry.name)}</div>
    <div class="gm-card-meta">${esc(entry.description || '')}</div>
    <div class="gm-card-stats">
      <span><b>AC</b> ${esc(entry.ac || '')}</span>
      <span><b>HP</b> ${esc(entry.hp || '')}</span>
      <span><b>Lv</b> ${esc(entry.level || '')}</span>
    </div>
    <div class="gm-card-atk">${esc(entry.atk || '')}</div>
    ${(entry.abilities||[]).map(a => `<div class="gm-card-ability"><b>${esc(a.name)}.</b> ${esc(a.description||'')}</div>`).join('')}
  `;
}

// Normalize a multi-select card's id field — supports both the new array
// form ({rule,spell}_ids) and the legacy single-id form ({rule,spell}_id)
// for cards saved before multi support landed.
function refIdsOf(card) {
  const d = card.data || {};
  const arrKey = card.type + '_ids';
  const oneKey = card.type + '_id';
  if (Array.isArray(d[arrKey])) return d[arrKey].map(String).filter(Boolean);
  if (d[oneKey]) return [String(d[oneKey])];
  return [];
}
// Legacy alias — older callers still reference ruleIdsOf.
const ruleIdsOf = refIdsOf;

function refKey(type) {
  if (type === 'spell') return 'Spell Name';
  if (type === 'rule')  return 'term';
  return 'name';
}

async function loadRefData(type) {
  const map = { monster: 'monsters', spell: 'spells', rule: 'glossary' };
  const table = map[type];
  if (!table) return [];
  if (state.refData[table]) return state.refData[table];
  try {
    const r = await fetch('/api/data/' + table);
    state.refData[table] = await r.json();
  } catch (e) { state.refData[table] = []; }
  return state.refData[table];
}

// Markdown rendering for note/custom card bodies. Uses marked for parsing
// and DOMPurify to strip XSS vectors (script tags, on* handlers, javascript:
// URLs, etc.) — body_md is user input, so we never trust it raw. Falls back
// to a minimal regex pass if the vendor libs failed to load.
let _markedConfigured = false;
function renderMarkdown(md) {
  const src = String(md || '');
  if (window.marked && window.DOMPurify) {
    if (!_markedConfigured) {
      // breaks: single newlines render as <br>, matching the "paste a note
      // and see it line by line" expectation. gfm: tables, strikethrough,
      // task lists. headerIds off — no need for anchor noise inside cards.
      window.marked.setOptions({ breaks: true, gfm: true, headerIds: false, mangle: false });
      _markedConfigured = true;
    }
    const dirty = window.marked.parse(src);
    return window.DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
  }
  // Fallback — marked/purify failed to load. Keep the old tiny renderer so
  // bold/italic/inline-code/headings/linebreaks still work.
  let h = esc(src);
  return h.replace(/^### (.+)$/gm, '<h3>$1</h3>')
          .replace(/^## (.+)$/gm,  '<h2>$1</h2>')
          .replace(/^# (.+)$/gm,   '<h1>$1</h1>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g,     '<em>$1</em>')
          .replace(/`([^`]+)`/g,       '<code>$1</code>')
          .replace(/\n/g, '<br>');
}

// ─────────────── Drag / resize ─────────────────────────────────────────────
function attachDrag(node, handle, card) {
  handle.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.gm-card-btn')) return;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX, startY = e.clientY;
    const baseX = card.x, baseY = card.y;
    const onMove = (ev) => {
      let nx = baseX + (ev.clientX - startX);
      let ny = baseY + (ev.clientY - startY);
      if (state.board?.snap_to_grid) {
        nx = Math.round(nx / 20) * 20;
        ny = Math.round(ny / 20) * 20;
      }
      node.style.left = nx + 'px'; node.style.top = ny + 'px';
      card.x = nx; card.y = ny;
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      scheduleCardSave(card, {});
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

function attachResize(node, handle, card) {
  handle.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX, startY = e.clientY;
    const baseW = card.w, baseH = card.h;
    const onMove = (ev) => {
      let nw = Math.max(160, baseW + (ev.clientX - startX));
      let nh = Math.max(100, baseH + (ev.clientY - startY));
      if (state.board?.snap_to_grid) {
        nw = Math.round(nw / 20) * 20;
        nh = Math.round(nh / 20) * 20;
      }
      node.style.width = nw + 'px'; node.style.height = nh + 'px';
      card.w = nw; card.h = nh;
    };
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      scheduleCardSave(card, {});
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
  });
}

let _zTop = 100;
function bringToFront(node) { node.style.zIndex = ++_zTop; }

// Background pan — drag the empty canvas to scroll the board. Uses
// scrollLeft/scrollTop so it composes with the native scrollbars and
// trackpad scroll. Left-button only on empty background; middle-button
// anywhere so you can pan even while hovering a card.
function attachBackgroundPan(canvas) {
  canvas.addEventListener('pointerdown', (e) => {
    const onBackground = (e.target === canvas);
    const leftOnBg    = (e.button === 0 && onBackground);
    const middleAnywhere = (e.button === 1);
    if (!leftOnBg && !middleAnywhere) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('panning');
    const startX = e.clientX, startY = e.clientY;
    const baseLeft = canvas.scrollLeft, baseTop = canvas.scrollTop;
    const onMove = (ev) => {
      canvas.scrollLeft = baseLeft - (ev.clientX - startX);
      canvas.scrollTop  = baseTop  - (ev.clientY - startY);
    };
    const onUp = () => {
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.classList.remove('panning');
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  });
  // Suppress the middle-click autoscroll bubble that some browsers show.
  canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
}

// ─────────────── Modals ───────────────────────────────────────────────────
// Guards against double-fire (touchend+click on mobile, accidental rapid taps).
let _typePickerOpen = false;
let _createInFlight = false;
function openTypePicker() {
  if (_typePickerOpen) return;
  _typePickerOpen = true;
  $('gm-type-picker').hidden = false;
  $('gm-type-picker').querySelectorAll('[data-type]').forEach(b => {
    b.onclick = async () => {
      if (_createInFlight) return;
      _createInFlight = true;
      $('gm-type-picker').hidden = true;
      _typePickerOpen = false;
      try {
        const t = b.dataset.type;
        const newCard = await createCardOnServer({ type: t, x: 80, y: 80, w: 260, h: 180, data: {} });
        if (newCard) {
          _pendingNewCards.add(newCard.id);
          openCardModal(newCard);
        }
      } finally { _createInFlight = false; }
    };
  });
}

async function createCardOnServer(payload) {
  try {
    const r = await fetch(`/api/gm/boards/${BOARD_ID}/cards`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    if (!r.ok) return null;
    const c = await r.json();
    state.cards.push(c);
    const node = renderCard(c);
    $('gm-canvas').appendChild(node);
    bringToFront(node);
    return c;
  } catch (e) { return null; }
}

async function deleteCard(card) {
  if (!confirm('Delete this card?')) return;
  await deleteCardSilent(card, { showErrors: true });
}

// Same as deleteCard, but skips the confirm prompt — used when the user
// cancels a freshly-created card from the edit modal.
async function deleteCardSilent(card, opts = {}) {
  try {
    const r = await fetch(`/api/gm/cards/${card.id}`, { method:'DELETE' });
    if (!r.ok) {
      if (opts.showErrors) alert(`Delete failed (HTTP ${r.status}).`);
      return false;
    }
  } catch (e) {
    if (opts.showErrors) alert('Delete failed (network).');
    return false;
  }
  state.cards = state.cards.filter(c => c.id !== card.id);
  document.querySelector(`.gm-card[data-id="${card.id}"]`)?.remove();
  _pendingNewCards.delete(card.id);
  return true;
}

// Cards that were created via the type picker but not yet saved/confirmed
// via the edit modal. Cancelling the edit deletes them; saving promotes them.
const _pendingNewCards = new Set();

function openCardModal(card) {
  const modal = $('gm-card-modal');
  const inner = $('gm-card-modal-inner');
  inner.innerHTML = '';
  const title = el('h3', 'gm-modal-title'); title.textContent = `Edit ${card.type} card`;
  inner.appendChild(title);

  // Type-specific fields
  if (card.type === 'note' || card.type === 'custom') {
    inner.appendChild(makeField('Title', 'input', card.data?.title || '', 'title'));
    inner.appendChild(makeField('Body (Markdown)', 'textarea', card.data?.body_md || '', 'body_md', 8));
  } else if (card.type === 'image') {
    inner.appendChild(imageInput(card));
    inner.appendChild(makeField('Caption', 'input', card.data?.caption || '', 'caption'));
  } else if (card.type === 'monster' || card.type === 'spell' || card.type === 'rule') {
    inner.appendChild(referencePicker(card));
  }

  // Color override
  const colorWrap = el('div', 'gm-field');
  const lbl = el('label', 'gm-field-label'); lbl.textContent = 'Color (override)';
  colorWrap.appendChild(lbl);
  const colorIn = el('input'); colorIn.type = 'color'; colorIn.dataset.field = 'color';
  colorIn.value = card.color || TYPE_COLORS[card.type]?.border || '#bca070';
  colorWrap.appendChild(colorIn);
  const resetBtn = el('button', 'gm-btn small');
  resetBtn.type = 'button'; resetBtn.textContent = 'Reset to default';
  resetBtn.onclick = () => { colorIn.value = TYPE_COLORS[card.type]?.border || '#bca070'; colorIn.dataset.reset = '1'; };
  colorWrap.appendChild(resetBtn);
  inner.appendChild(colorWrap);

  // Actions
  const actions = el('div', 'gm-modal-actions');
  const saveBtn = el('button', 'gm-btn primary'); saveBtn.textContent = 'Save';
  saveBtn.onclick = () => {
    const newData = { ...card.data };
    inner.querySelectorAll('[data-field]').forEach(input => {
      if (input.dataset.field === 'color') {
        card.color = (input.dataset.reset === '1') ? null : input.value;
      } else if (input.dataset.multi === '1') {
        // Multi-select field — value is JSON-encoded array of ids.
        try { newData[input.dataset.field] = JSON.parse(input.value || '[]'); }
        catch (e) { newData[input.dataset.field] = []; }
      } else {
        newData[input.dataset.field] = input.value;
      }
    });
    // When upgrading a rule/spell card to the multi form, drop the legacy
    // single-id field so it doesn't shadow {type}_ids on re-render.
    if ((card.type === 'rule'  && Array.isArray(newData.rule_ids))  ) delete newData.rule_id;
    if ((card.type === 'spell' && Array.isArray(newData.spell_ids)) ) delete newData.spell_id;
    card.data = newData;
    scheduleCardSave(card, {});
    const node = document.querySelector(`.gm-card[data-id="${card.id}"]`);
    if (node) {
      const color = card.color || TYPE_COLORS[card.type]?.border;
      node.style.borderColor = color;
      node.style.setProperty('--card-accent', color);
      renderCardBody(card, node.querySelector('.gm-card-body'));
    }
    _pendingNewCards.delete(card.id);  // saved — no longer pending
    _editingCard = null;
    modal.hidden = true;
  };
  const cancelBtn = el('button', 'gm-btn'); cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => cancelCardModal(card);
  actions.append(saveBtn, cancelBtn);
  inner.appendChild(actions);
  _editingCard = card;
  modal.hidden = false;
}

// Tracks the card currently being edited so backdrop-click dismissal
// can apply the same "discard new card" rule as the Cancel button.
let _editingCard = null;
function cancelCardModal(card) {
  $('gm-card-modal').hidden = true;
  _editingCard = null;
  if (card && _pendingNewCards.has(card.id)) deleteCardSilent(card);
}

function makeField(label, kind, value, fieldKey, rows) {
  const wrap = el('div', 'gm-field');
  const lbl = el('label', 'gm-field-label'); lbl.textContent = label;
  wrap.appendChild(lbl);
  let input;
  if (kind === 'textarea') {
    input = el('textarea', 'gm-input'); input.rows = rows || 4; input.value = value;
  } else {
    input = el('input', 'gm-input'); input.type = 'text'; input.value = value;
  }
  input.dataset.field = fieldKey;
  wrap.appendChild(input);
  return wrap;
}

// Image input: file picker, URL paste, clipboard paste hint.
function imageInput(card) {
  const wrap = el('div', 'gm-field');
  const lbl = el('label', 'gm-field-label'); lbl.textContent = 'Image';
  wrap.appendChild(lbl);
  const row = el('div', 'gm-img-input-row');
  const file = el('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp,image/gif';
  file.addEventListener('change', async () => {
    if (!file.files?.[0]) return;
    const url = await uploadImage(file.files[0]);
    if (url) { srcInput.value = url; preview.src = url; }
  });
  row.appendChild(file);
  wrap.appendChild(row);
  const srcInput = el('input', 'gm-input');
  srcInput.type = 'text'; srcInput.placeholder = 'or paste an image URL';
  srcInput.value = card.data?.src || '';
  srcInput.dataset.field = 'src';
  wrap.appendChild(srcInput);
  const preview = el('img', 'gm-img-preview'); preview.src = card.data?.src || '';
  if (!card.data?.src) preview.style.display = 'none';
  srcInput.addEventListener('input', () => { preview.src = srcInput.value; preview.style.display = srcInput.value ? '' : 'none'; });
  wrap.appendChild(preview);
  const hint = el('div', 'gm-field-hint');
  hint.textContent = 'Tip: Ctrl-V here to paste from the clipboard.';
  wrap.appendChild(hint);
  // Paste-from-clipboard handler scoped to this modal.
  const onPaste = async (e) => {
    if (!e.clipboardData) return;
    for (const it of e.clipboardData.items) {
      if (it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        const url = await uploadImage(blob);
        if (url) { srcInput.value = url; preview.src = url; preview.style.display = ''; }
        e.preventDefault();
        return;
      }
    }
  };
  wrap.addEventListener('paste', onPaste);
  return wrap;
}

async function uploadImage(blob) {
  if (!blob) return null;
  const fd = new FormData();
  fd.append('file', blob);
  try {
    const r = await fetch('/api/gm/upload-image', { method:'POST', body: fd });
    if (!r.ok) {
      let why = `HTTP ${r.status}`;
      try {
        const j = await r.json();
        if (j?.error === 'bad_type')   why = 'unsupported image type (PNG/JPEG/WEBP/GIF only)';
        else if (j?.error === 'too_large') why = `image too large (max ${Math.floor((j.max_bytes||0)/1024/1024)} MB)`;
        else if (j?.error === 'empty_file') why = 'empty file';
        else if (j?.error) why = j.error;
      } catch (e) { /* non-JSON response, keep status fallback */ }
      alert('Upload failed: ' + why);
      return null;
    }
    const j = await r.json();
    return j.url;
  } catch (e) {
    alert('Upload failed (network): ' + (e?.message || e));
    return null;
  }
}

// Reference picker: searchable list of monsters / spells / glossary.
// Monsters are single-select. Rules and spells are multi-select so a single
// card can collect several entries (e.g. all the combat rules, or a
// caster's full spell list).
function referencePicker(card) {
  const wrap = el('div', 'gm-field');
  const type = card.type;
  const isMulti = (type === 'rule' || type === 'spell');

  const lbl = el('label', 'gm-field-label');
  if (isMulti) {
    const noun = type === 'rule' ? 'rules' : 'spells';
    lbl.textContent = `Pick ${noun} (multi-select)`;
  } else {
    lbl.textContent = `Pick a ${type}`;
  }
  wrap.appendChild(lbl);

  // Chips row: currently-selected entries, each with a × to remove.
  const chips = isMulti ? el('div', 'gm-ref-chips') : null;
  if (chips) wrap.appendChild(chips);

  const search = el('input', 'gm-input');
  search.type = 'search'; search.placeholder = 'Search…';
  wrap.appendChild(search);

  const list = el('div', 'gm-ref-list');
  wrap.appendChild(list);

  // Hidden form input. Single-select uses a plain string id; multi-select
  // uses JSON-encoded array of ids with data-multi="1" so the save path
  // in openCardModal parses it back into a real array.
  const hidden = el('input'); hidden.type = 'hidden';
  if (isMulti) {
    hidden.dataset.field = type + '_ids';
    hidden.dataset.multi = '1';
    hidden.value = JSON.stringify(refIdsOf(card));
  } else {
    hidden.dataset.field = type + '_id';
    hidden.value = card.data?.[type + '_id'] || '';
  }
  wrap.appendChild(hidden);

  loadRefData(type).then(items => {
    const k = refKey(type);
    const nameOf = (e) => e[k] || e.name || e.id;
    const idOf   = (e) => e.id || nameOf(e);
    const byId   = (id) => (items || []).find(e => String(idOf(e)) === String(id));

    function getSelected() {
      if (!isMulti) return hidden.value ? [hidden.value] : [];
      try { return JSON.parse(hidden.value || '[]'); } catch (e) { return []; }
    }
    function setSelected(ids) {
      if (isMulti) hidden.value = JSON.stringify(ids);
      else         hidden.value = ids[0] || '';
      renderChips();
      refreshList();
    }
    function toggle(id) {
      if (!isMulti) { setSelected([id]); return; }
      const cur = getSelected().map(String);
      const sid = String(id);
      const i = cur.indexOf(sid);
      if (i >= 0) cur.splice(i, 1); else cur.push(sid);
      setSelected(cur);
    }

    function renderChips() {
      if (!chips) return;
      const sel = getSelected();
      if (!sel.length) { chips.innerHTML = '<span class="gm-ref-chips-empty">Nothing picked yet.</span>'; return; }
      chips.innerHTML = sel.map(id => {
        const e = byId(id);
        const label = e ? nameOf(e) : id;
        return `<span class="gm-ref-chip" data-id="${esc(id)}">${esc(label)}<button type="button" class="gm-ref-chip-x" title="Remove">×</button></span>`;
      }).join('');
      chips.querySelectorAll('.gm-ref-chip-x').forEach(btn => {
        btn.onclick = (ev) => {
          ev.preventDefault();
          const chip = btn.closest('.gm-ref-chip');
          toggle(chip.dataset.id);
        };
      });
    }

    function refreshList() {
      const q = (search.value || '').toLowerCase().trim();
      const sel = new Set(getSelected().map(String));
      const matches = (items || []).filter(e => {
        const n = (nameOf(e) || '').toLowerCase();
        return !q || n.includes(q);
      }).slice(0, 50);
      list.innerHTML = matches.map(e => {
        const id = idOf(e);
        const active = sel.has(String(id)) ? ' active' : '';
        return `<button type="button" class="gm-ref-item${active}" data-id="${esc(id)}">${esc(nameOf(e))}</button>`;
      }).join('');
      list.querySelectorAll('.gm-ref-item').forEach(b => {
        b.onclick = () => toggle(b.dataset.id);
      });
    }

    search.addEventListener('input', refreshList);
    renderChips();
    refreshList();
  });
  return wrap;
}

// ─────────────── Boot ─────────────────────────────────────────────────────
async function init() {
  // Load board metadata
  try {
    const list = await (await fetch('/api/gm/boards')).json();
    state.board = list.find(b => b.id === BOARD_ID);
  } catch (e) { state.board = null; }
  if (!state.board) { document.body.innerHTML = '<p style="padding:2rem;">Board not found.</p>'; return; }
  $('gm-board-name').value = state.board.name;
  $('gm-snap-toggle').checked = !!state.board.snap_to_grid;
  // Bump last_opened_at
  saveBoardField({ last_opened_at: true });

  // Wire top bar
  let nameTimer = null;
  $('gm-board-name').addEventListener('input', () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => saveBoardField({ name: $('gm-board-name').value }), 400);
  });
  $('gm-snap-toggle').addEventListener('change', () => {
    state.board.snap_to_grid = $('gm-snap-toggle').checked ? 1 : 0;
    saveBoardField({ snap_to_grid: state.board.snap_to_grid });
    $('gm-canvas').classList.toggle('snap-on', !!state.board.snap_to_grid);
  });
  $('gm-canvas').classList.toggle('snap-on', !!state.board.snap_to_grid);
  $('gm-card-add').addEventListener('click', openTypePicker);
  $('gm-type-picker').querySelector('[data-act="cancel"]').onclick = () => { $('gm-type-picker').hidden = true; _typePickerOpen = false; };

  // Background pan — click+drag the empty canvas to scroll the board around.
  // Only activates when the pointer goes down on the canvas itself, not on a
  // card or any other child. Also supports middle-click anywhere.
  attachBackgroundPan($('gm-canvas'));

  // Click backdrop to dismiss modals. For the card edit modal, treat backdrop
  // dismissal the same as Cancel — i.e. discard a freshly-created card.
  $('gm-card-modal').addEventListener('click', (e) => {
    if (e.target.id === 'gm-card-modal') cancelCardModal(_editingCard);
  });
  $('gm-type-picker').addEventListener('click', (e) => { if (e.target.id === 'gm-type-picker') { $('gm-type-picker').hidden = true; _typePickerOpen = false; } });

  // Canvas-wide paste → quick "image card from clipboard"
  $('gm-canvas').addEventListener('paste', async (e) => {
    if (!e.clipboardData) return;
    for (const it of e.clipboardData.items) {
      if (it.type.startsWith('image/')) {
        const blob = it.getAsFile();
        const url = await uploadImage(blob);
        if (url) {
          await createCardOnServer({ type: 'image', x: 60, y: 60, w: 280, h: 220, data: { src: url } });
        }
        e.preventDefault();
        return;
      }
    }
  });

  // Load cards
  try {
    const r = await fetch(`/api/gm/boards/${BOARD_ID}/cards`);
    state.cards = await r.json();
  } catch (e) { state.cards = []; }
  const canvas = $('gm-canvas');
  state.cards.forEach(c => canvas.appendChild(renderCard(c)));
}

document.addEventListener('DOMContentLoaded', init);
})();
