// GM · Add — homebrew reference data editor.
//
// Architecture: one tab per table; per-tab schema describes fields; renderForm
// reads that schema and builds inputs. Nested arrays (monster abilities, class
// features) use a shared row-builder widget.

(function(){
'use strict';

const $ = id => document.getElementById(id);
const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
const esc = s => String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let state = {
  table: 'monsters',
  entries: [],     // all (core + custom merged) from /api/data/<table>
  selectedId: null,
  meUser: null,
};

// ── Schemas ─────────────────────────────────────────────────────────────────
// Field types: 'text', 'textarea', 'number', 'select(opts)', 'abilities' (row builder),
//              'features' (row builder), 'tags' (comma-separated list).
const SCHEMAS = {
  monsters: {
    title: 'Monster',
    fields: [
      { key:'name',         label:'Name',          type:'text', required:true },
      { key:'family',       label:'Family',        type:'text' },
      { key:'description',  label:'Description',   type:'textarea' },
      { key:'type',         label:'Type',          type:'select', opts:['Beast','Humanoid','Fiend','Celestial','Fey','Elemental','Giant','Construct','Dragon','Undead','Outsider'] },
      { key:'ac',           label:'AC',            type:'number' },
      { key:'ac_note',      label:'AC note',       type:'text',  hint:'e.g. leather, plate mail + shield' },
      { key:'hp',           label:'HP',            type:'number' },
      { key:'atk',          label:'Attack(s)',     type:'text',  hint:'1 spear (close/near) +0 (1d6)' },
      { key:'mv',           label:'Movement',     type:'text',   hint:'near, double near (fly), etc.' },
      { key:'str',          label:'STR',           type:'text', short:true },
      { key:'dex',          label:'DEX',           type:'text', short:true },
      { key:'con',          label:'CON',           type:'text', short:true },
      { key:'int',          label:'INT',           type:'text', short:true },
      { key:'wis',          label:'WIS',           type:'text', short:true },
      { key:'cha',          label:'CHA',           type:'text', short:true },
      { key:'alignment',    label:'Alignment',     type:'select', opts:['Lawful','Neutral','Chaotic'] },
      { key:'level',        label:'Level',         type:'number' },
      { key:'abilities',    label:'Abilities',     type:'abilities' },
    ],
  },
  spells: {
    title: 'Spell',
    nameKey: 'Spell Name',
    fields: [
      { key:'Spell Name',   label:'Name',          type:'text', required:true },
      { key:'Tier',         label:'Tier',          type:'select', opts:['1','2','3','4','5'] },
      { key:'Caster',       label:'Caster',        type:'text', hint:'Wizard, Priest, Witch, …' },
      { key:'Aligment',     label:'Alignment',     type:'select', opts:['all','Lawful','Neutral','Chaotic'] },
      { key:'Range',        label:'Range',         type:'text' },
      { key:'Duration',     label:'Duration',      type:'text' },
      { key:'Gear Slots',   label:'Gear Slots',    type:'text' },
      { key:'Description',  label:'Description',   type:'textarea' },
    ],
  },
  weapons: {
    title: 'Weapon',
    nameKey: 'Weapon',
    fields: [
      { key:'Weapon',       label:'Name',          type:'text', required:true },
      { key:'Type',         label:'Type',          type:'select', opts:['Melee','Ranged','Both'] },
      { key:'Hands',        label:'Hands',         type:'select', opts:['1','2','1 or 2'] },
      { key:'Damage',       label:'Damage',        type:'text', hint:'1d6, 1d8, …' },
      { key:'Properties',   label:'Properties',    type:'text', hint:'Finesse, Thrown (near), …' },
      { key:'Range',        label:'Range',         type:'text' },
      { key:'Cost',         label:'Cost',          type:'text' },
      { key:'Description',  label:'Description',   type:'textarea' },
    ],
  },
  armor: {
    title: 'Armor',
    nameKey: 'Armor',
    fields: [
      { key:'Armor',        label:'Name',          type:'text', required:true },
      { key:'AC',           label:'AC',            type:'text', hint:'11, 13, 14+DEX, etc.' },
      { key:'Properties',   label:'Properties',    type:'text', hint:'Mithral, Stealth disadvantage, …' },
      { key:'Cost',         label:'Cost',          type:'text' },
      { key:'Description',  label:'Description',   type:'textarea' },
    ],
  },
  gear: {
    title: 'Gear',
    nameKey: 'Item',
    fields: [
      { key:'Item',         label:'Name',          type:'text', required:true },
      { key:'Cost',         label:'Cost',          type:'text' },
      { key:'Slots',        label:'Slots',         type:'text', hint:'1, 1/2, etc.' },
      { key:'Description',  label:'Description',   type:'textarea' },
    ],
  },
  magic_items: {
    title: 'Magic Item',
    fields: [
      { key:'name',         label:'Name',          type:'text', required:true },
      { key:'category',     label:'Category',      type:'text', hint:'Armor, Weapon, Wondrous, …' },
      { key:'rarity',       label:'Rarity',        type:'select', opts:['Common','Uncommon','Rare','Legendary'] },
      { key:'attunement',   label:'Attunement',    type:'select', opts:['Yes','No'] },
      { key:'benefit',      label:'Benefit',       type:'textarea' },
      { key:'curse',        label:'Curse',         type:'textarea' },
      { key:'description',  label:'Description',   type:'textarea' },
    ],
  },
  gems: {
    title: 'Gem',
    fields: [
      { key:'name',         label:'Name',          type:'text', required:true },
      { key:'value',        label:'Value',         type:'text', hint:'25 gp, 100 gp, …' },
      { key:'description',  label:'Description',   type:'textarea' },
    ],
  },
  plants_poisons: {
    title: 'Plant / Poison',
    fields: [
      { key:'name',         label:'Name',          type:'text', required:true },
      { key:'type',         label:'Type',          type:'select', opts:['Plant','Poison','Mushroom','Herb'] },
      { key:'cost',         label:'Cost',          type:'text' },
      { key:'effect',       label:'Effect',        type:'textarea' },
      { key:'description',  label:'Description',   type:'textarea' },
    ],
  },
  gods: {
    title: 'God',
    fields: [
      { key:'name',         label:'Name',          type:'text', required:true },
      { key:'alignment',    label:'Alignment',     type:'select', opts:['Lawful','Neutral','Chaotic'] },
      { key:'symbol',       label:'Symbol',        type:'text' },
      { key:'domain',       label:'Domain',        type:'text' },
      { key:'holy_days',    label:'Holy Days',     type:'text' },
      { key:'description',  label:'Description',   type:'textarea' },
    ],
  },
  races: {
    title: 'Race / Species',
    fields: [
      { key:'name',         label:'Name',          type:'text', required:true },
      { key:'description',  label:'Description',   type:'textarea' },
      { key:'traits',       label:'Traits',        type:'features' },
      { key:'languages',    label:'Languages',     type:'text' },
    ],
  },
  classes: {
    title: 'Class',
    nameKey: 'class',
    fields: [
      { key:'class',        label:'Name',          type:'text', required:true },
      { key:'source',       label:'Source',        type:'text', hint:'Core, Cursed Scrolls 1, …' },
      { key:'description',  label:'Description',   type:'textarea' },
      { key:'hit_points',   label:'Hit Points',    type:'text', hint:'1d6 per level, etc.' },
      { key:'weapons',      label:'Weapons',       type:'text' },
      { key:'armor',        label:'Armor',         type:'text' },
      { key:'spellcasting', label:'Spellcasting',  type:'text', hint:'wizard, priest, witch, priest/wizard, …' },
      { key:'features',     label:'Features',      type:'features' },
    ],
  },
};

// ── Field renderers ─────────────────────────────────────────────────────────
function buildField(field, value) {
  const wrap = el('div', 'gm-field' + (field.short ? ' short' : ''));
  const lbl = el('label', 'gm-field-label');
  lbl.textContent = field.label + (field.required ? ' *' : '');
  wrap.appendChild(lbl);
  let input;
  switch (field.type) {
    case 'textarea':
      input = el('textarea', 'gm-input');
      input.rows = 4; input.value = value ?? '';
      break;
    case 'number':
      input = el('input', 'gm-input');
      input.type = 'number'; input.value = (value ?? '');
      break;
    case 'select':
      input = el('select', 'gm-input');
      input.appendChild(new Option('—', ''));
      (field.opts || []).forEach(o => input.appendChild(new Option(o, o)));
      input.value = value ?? '';
      break;
    case 'abilities':
      input = buildRowBuilder(value || [], 'ability', ['name', 'description']);
      break;
    case 'features':
      input = buildRowBuilder(value || [], 'feature', ['name', 'description']);
      break;
    default:
      input = el('input', 'gm-input');
      input.type = 'text'; input.value = value ?? '';
  }
  input.dataset.field = field.key;
  input.dataset.ftype = field.type;
  wrap.appendChild(input);
  if (field.hint) {
    const h = el('div', 'gm-field-hint'); h.textContent = field.hint; wrap.appendChild(h);
  }
  return wrap;
}

// Row builder: array of { name, description } objects.
function buildRowBuilder(initial, kind, keys) {
  const wrap = el('div', 'gm-rows');
  wrap.dataset.kind = kind;
  const list = el('div', 'gm-rows-list');
  wrap.appendChild(list);
  function addRow(obj) {
    const row = el('div', 'gm-row');
    keys.forEach((k, i) => {
      const input = el(i === keys.length - 1 ? 'textarea' : 'input', 'gm-input');
      if (input.tagName === 'INPUT') input.type = 'text';
      else { input.rows = 2; }
      input.placeholder = k.charAt(0).toUpperCase() + k.slice(1);
      input.value = (obj && obj[k]) || '';
      input.dataset.rowkey = k;
      row.appendChild(input);
    });
    const rm = el('button', 'gm-row-rm');
    rm.type = 'button'; rm.textContent = '×';
    rm.onclick = () => row.remove();
    row.appendChild(rm);
    list.appendChild(row);
  }
  (initial || []).forEach(addRow);
  const add = el('button', 'gm-row-add');
  add.type = 'button'; add.textContent = `+ Add ${kind}`;
  add.onclick = () => addRow(null);
  wrap.appendChild(add);
  return wrap;
}

function readRowBuilder(wrap, keys) {
  const out = [];
  wrap.querySelectorAll('.gm-row').forEach(row => {
    const obj = {};
    keys.forEach(k => {
      const inp = row.querySelector(`[data-rowkey="${k}"]`);
      obj[k] = (inp?.value || '').trim();
    });
    // Drop fully-empty rows.
    if (Object.values(obj).some(v => v)) out.push(obj);
  });
  return out;
}

// ── Form render / read ───────────────────────────────────────────────────────
function renderForm(entry, isCreating) {
  const schema = SCHEMAS[state.table];
  const form = $('gm-editor-form');
  form.hidden = false;
  $('gm-editor-empty').hidden = true;
  form.innerHTML = '';

  const header = el('div', 'gm-form-header');
  const title = el('h2', 'gm-form-title');
  title.textContent = isCreating ? `New ${schema.title}` : (entry[schema.nameKey || 'name'] || entry.name || '(unnamed)');
  header.appendChild(title);
  if (entry && entry.id) {
    const idChip = el('span', 'gm-id-chip'); idChip.textContent = entry.id;
    header.appendChild(idChip);
  }
  form.appendChild(header);

  // All fields
  const grid = el('div', 'gm-form-grid');
  schema.fields.forEach(f => {
    grid.appendChild(buildField(f, entry?.[f.key]));
  });
  form.appendChild(grid);

  // Action buttons
  const actions = el('div', 'gm-form-actions');
  const saveBtn = el('button', 'gm-btn primary'); saveBtn.type = 'submit';
  saveBtn.textContent = isCreating ? 'Create' : 'Save';
  actions.appendChild(saveBtn);
  if (!isCreating && entry._owner_id === state.meUser?.id) {
    const delBtn = el('button', 'gm-btn danger'); delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => onDelete(entry.id);
    actions.appendChild(delBtn);
  }
  if (!isCreating && entry._owner_id !== state.meUser?.id) {
    const copyBtn = el('button', 'gm-btn'); copyBtn.type = 'button';
    copyBtn.textContent = 'Copy to my homebrew';
    copyBtn.onclick = () => onCopy(entry);
    actions.appendChild(copyBtn);
  }
  const cancelBtn = el('button', 'gm-btn'); cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => { form.hidden = true; $('gm-editor-empty').hidden = false; state.selectedId = null; renderEntriesList(); };
  actions.appendChild(cancelBtn);
  form.appendChild(actions);

  // Read-only flag for entries the user doesn't own
  if (!isCreating && entry._custom && entry._owner_id !== state.meUser?.id) {
    form.querySelectorAll('input, textarea, select, button.gm-row-add, button.gm-row-rm')
        .forEach(el => { if (el.type !== 'button' && !el.closest('.gm-form-actions')) el.disabled = true; });
  }
  if (!isCreating && !entry._custom) {
    // Core entries — fully read-only
    form.querySelectorAll('input, textarea, select, button.gm-row-add, button.gm-row-rm')
        .forEach(el => { if (!el.closest('.gm-form-actions')) el.disabled = true; });
    saveBtn.style.display = 'none';
  }

  form.onsubmit = (e) => { e.preventDefault(); onSave(isCreating, entry?.id); };
}

function readForm() {
  const schema = SCHEMAS[state.table];
  const form = $('gm-editor-form');
  const out = {};
  schema.fields.forEach(f => {
    const node = form.querySelector(`[data-field="${CSS.escape(f.key)}"]`);
    if (!node) return;
    if (f.type === 'abilities' || f.type === 'features') {
      out[f.key] = readRowBuilder(node, ['name','description']);
    } else if (f.type === 'number') {
      const v = node.value.trim();
      out[f.key] = v === '' ? null : Number(v);
    } else {
      const v = (node.value || '').trim();
      if (v !== '') out[f.key] = v;
    }
  });
  return out;
}

// ── List rendering ──────────────────────────────────────────────────────────
function entryName(e) {
  const schema = SCHEMAS[state.table];
  return e[schema.nameKey || 'name'] || e.name || e.Item || e.Armor || e.Weapon || '(unnamed)';
}

function renderEntriesList() {
  const me = state.meUser?.id;
  const q = ($('gm-entry-search').value || '').toLowerCase().trim();
  const matches = state.entries.filter(e => {
    if (!q) return true;
    return entryName(e).toLowerCase().includes(q);
  });
  const mine   = matches.filter(e => e._custom && e._owner_id === me);
  const others = matches.filter(e => e._custom && e._owner_id !== me);
  const core   = matches.filter(e => !e._custom);
  fillList($('gm-list-mine'),   mine,   true);
  fillList($('gm-list-others'), others, true);
  fillList($('gm-list-core'),   core,   false);
}

function fillList(ul, items, showOwner) {
  ul.innerHTML = '';
  if (!items.length) {
    const li = el('li', 'gm-list-empty');
    li.textContent = '—';
    ul.appendChild(li);
    return;
  }
  items.forEach(e => {
    const li = el('li', 'gm-list-item' + (state.selectedId === e.id ? ' active' : ''));
    li.dataset.id = e.id;
    const name = el('span', 'gm-list-name'); name.textContent = entryName(e);
    li.appendChild(name);
    if (showOwner && e._owner) {
      const owner = el('span', 'gm-list-owner'); owner.textContent = e._owner;
      li.appendChild(owner);
    }
    li.onclick = () => selectEntry(e);
    ul.appendChild(li);
  });
}

function selectEntry(e) {
  state.selectedId = e.id;
  renderForm(e, false);
  renderEntriesList();
}

// ── Table switching + load ──────────────────────────────────────────────────
async function loadTable(table) {
  state.table = table;
  state.selectedId = null;
  $('gm-editor-form').hidden = true;
  $('gm-editor-empty').hidden = false;
  document.querySelectorAll('.gm-tab').forEach(b => b.classList.toggle('active', b.dataset.table === table));
  try {
    const r = await fetch(`/api/data/${table}`);
    state.entries = await r.json();
  } catch (e) {
    state.entries = [];
  }
  renderEntriesList();
}

// ── CRUD ───────────────────────────────────────────────────────────────────
async function onSave(isCreating, existingId) {
  const payload = readForm();
  try {
    if (isCreating) {
      const r = await fetch(`/api/custom_data/${state.table}`, {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('save failed');
      await loadTable(state.table);
    } else {
      const r = await fetch(`/api/custom_data/${state.table}/${encodeURIComponent(existingId)}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error('save failed');
      await loadTable(state.table);
    }
  } catch (e) {
    alert('Save failed. ' + e.message);
  }
}

async function onDelete(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;
  try {
    const r = await fetch(`/api/custom_data/${state.table}/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!r.ok) throw new Error('delete failed');
    state.selectedId = null;
    await loadTable(state.table);
    $('gm-editor-form').hidden = true;
    $('gm-editor-empty').hidden = false;
  } catch (e) {
    alert('Delete failed.');
  }
}

function onCopy(entry) {
  // Strip server-managed fields, open as a new entry pre-filled.
  const copy = { ...entry };
  delete copy.id; delete copy._owner; delete copy._owner_id; delete copy._custom;
  const schema = SCHEMAS[state.table];
  const nameKey = schema.nameKey || 'name';
  if (copy[nameKey]) copy[nameKey] = copy[nameKey] + ' (copy)';
  state.selectedId = null;
  renderForm(copy, true);
}

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  // Get current user
  try { state.meUser = (await (await fetch('/api/auth/me')).json()).user; } catch (e) {}
  document.querySelectorAll('.gm-tab').forEach(b => {
    b.addEventListener('click', () => loadTable(b.dataset.table));
  });
  $('gm-add-new').addEventListener('click', () => {
    state.selectedId = null;
    renderEntriesList();
    renderForm({}, true);
  });
  $('gm-entry-search').addEventListener('input', renderEntriesList);
  await loadTable('monsters');
}

document.addEventListener('DOMContentLoaded', init);
})();
