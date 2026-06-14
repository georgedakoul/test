// Reference Drawer — extracted from app.js so non-character-sheet pages
// (e.g. the GM board) can reuse the exact same slide-out browser without
// pulling in the entire 6k-line character sheet bundle.
//
// Self-contained module. Looks for the standard drawer markup in the host
// page (#reference-drawer, #drawer-overlay, #drawer-tabs, #drawer-content,
// #ref-search, the spell filter rows, etc.) and wires everything up on
// DOMContentLoaded.
//
// Host pages can override these hooks (defined as window.* before this
// script loads):
//   window.RefDrawer = {
//     addAction(name, table) { ... },   // called by the + button
//     classContext()          { ... },   // return { name, alignment } or null
//     onClassFilter(active)   { ... }    // optional — re-render hook
//   };
// If RefDrawer.classContext returns null, the "Class only" button is hidden.
// If RefDrawer.addAction is missing, the + buttons are hidden too.

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const escAttr = (s) => String(s ?? '').replace(/'/g, "\\'").replace(/"/g, '&quot;');

  const state = {
    refTable: 'weapons',
    refData: {},                 // table → rows cache
    refSort: { col: null, asc: true },
    refClassFilter: false,
    refSpellCaster: 'all',
    refSpellAligns: new Set(),
  };

  // Column definitions per table — must match character-sheet app.js so the
  // drawer renders identically in both places.
  const TABLE_COLS = {
    weapons:        ['Weapon', 'Cost', 'Type', 'Range', 'Damage', 'Properties'],
    armor:          ['Armor', 'Cost', 'Gear Slots', 'AC', 'Properties'],
    spells:         ['Spell Name', 'Tier', 'Caster', 'Duration', 'Range'],
    gear:           ['Item', 'Gear Slots', 'Cost'],
    magic_items:    ['Name', 'Benefit'],
    gems:           ['Valuable', 'GP (each)', 'Found'],
    plants_poisons: ['Item', 'Rarity', 'Use', 'GP'],
    traps:          ['Item', 'Properties', 'Gear Slots', 'GP'],
    mounts:         ['Name', 'Cost', 'Rarity'],
    mount_gear:     ['Name', 'Cost', 'properties'],
    spell_catalysts:['Catalyst', 'Spell Name', 'Gear Slots', 'GP'],
  };
  const HIDE_ON_MOBILE = {
    weapons: ['Properties', 'Range'],
    armor:   ['Properties'],
    spells:  ['Duration'],
  };
  const CLASS_FILTER_TABLES = ['weapons', 'armor', 'spells'];

  // Description-like fields, in priority order, for the inline expanded detail
  const REF_DESC_KEYS = ['Description', 'Effect/Description', 'Effect', 'Benefit', 'Use', 'Properties'];

  function refDescField(row) {
    for (const k of REF_DESC_KEYS) {
      const v = row[k];
      if (v != null && String(v).trim() !== '' && String(v).toLowerCase() !== 'null') return String(v);
    }
    return '';
  }

  function refSortCompare(a, b) {
    if (a == null) a = '';
    if (b == null) b = '';
    const sa = String(a).trim(), sb = String(b).trim();
    const na = parseFloat(sa), nb = parseFloat(sb);
    if (!isNaN(na) && !isNaN(nb) && /^[\d.+-]/.test(sa) && /^[\d.+-]/.test(sb)) return na - nb;
    return sa.toLowerCase().localeCompare(sb.toLowerCase());
  }

  function rowPassesFilters(row, table) {
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
    // Host-provided class filter (character sheet only). Without a class
    // context, the toggle is hidden and this is a no-op.
    if (!state.refClassFilter || !CLASS_FILTER_TABLES.includes(table)) return true;
    const hook = window.RefDrawer && window.RefDrawer.rowPassesClassFilter;
    return hook ? hook(row, table) : true;
  }

  // ── Public API (also attached to window for inline onclick handlers) ────
  function openReference(table) {
    state.refTable = table || 'weapons';
    $('drawer-overlay')?.classList.add('open');
    $('reference-drawer')?.classList.add('open');
    document.body.style.overflow = 'hidden';
    document.querySelectorAll('.dtab').forEach(t =>
      t.classList.toggle('active', t.dataset.table === state.refTable)
    );
    loadRefTable(state.refTable);
  }

  function closeReference() {
    $('drawer-overlay')?.classList.remove('open');
    $('reference-drawer')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function loadRefTable(table) {
    state.refTable = table;
    updateClassFilterBtn(table);
    updateSpellFilters(table);
    if (state.refData[table]) { renderRefTable(state.refData[table], table); return; }
    $('drawer-content').innerHTML = '<p style="color:var(--text-muted);padding:1rem">Loading…</p>';
    fetch('/api/data/' + table)
      .then(r => r.json())
      .then(rows => { state.refData[table] = rows; renderRefTable(rows, table); })
      .catch(() => { $('drawer-content').innerHTML = '<p style="color:var(--text-muted);padding:1rem">Failed to load.</p>'; });
  }

  function filterReference() {
    const q = ($('ref-search').value || '').toLowerCase();
    document.querySelectorAll('#drawer-content .ref-table tbody tr').forEach(tr => {
      tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  }

  function toggleClassFilter() {
    state.refClassFilter = !state.refClassFilter;
    const rerender = () => {
      updateClassFilterBtn(state.refTable);
      renderRefTable(state.refData[state.refTable], state.refTable);
    };
    // Let the host load class data if needed
    if (state.refClassFilter && window.RefDrawer?.onClassFilter) {
      Promise.resolve(window.RefDrawer.onClassFilter(true)).then(rerender);
    } else {
      rerender();
    }
  }

  function updateSpellFilters(table) {
    const casterBar = $('ref-spell-filters');
    const alignBar  = $('ref-spell-align-filters');
    if (!casterBar || !alignBar) return;
    const showCaster = (table === 'spells');
    casterBar.hidden = !showCaster;
    alignBar.hidden = !showCaster || state.refSpellCaster === 'all';
    if (!showCaster) return;
    document.querySelectorAll('.ref-caster-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.caster === state.refSpellCaster);
    });
    document.querySelectorAll('.ref-align-btn').forEach(b => {
      b.classList.toggle('active', state.refSpellAligns.has(b.dataset.align));
    });
  }

  function updateClassFilterBtn(table) {
    const btn = $('ref-class-filter');
    if (!btn) return;
    const ctx = window.RefDrawer?.classContext?.();
    const applies = CLASS_FILTER_TABLES.includes(table) && !!ctx?.name;
    btn.hidden = !applies;
    if (applies) {
      btn.textContent = `${ctx.name} only`;
      btn.classList.toggle('active', !!state.refClassFilter);
    }
  }

  function renderRefTable(rows, table) {
    const content = $('drawer-content');
    if (!rows?.length) {
      content.innerHTML = '<p style="color:var(--text-muted);padding:1rem">No data.</p>';
      return;
    }
    const cols = TABLE_COLS[table] || Object.keys(rows[0]).slice(0, 5);
    const hideCols = HIDE_ON_MOBILE[table] || [];
    const nameKey = cols[0];

    let indexed = rows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => rowPassesFilters(row, table));

    const sortCol = state.refSort.col;
    if (sortCol && cols.includes(sortCol)) {
      const dir = state.refSort.asc ? 1 : -1;
      indexed.sort((A, B) => refSortCompare(A.row[sortCol], B.row[sortCol]) * dir);
    }

    const hasAddAction = typeof window.RefDrawer?.addAction === 'function';
    const trs = [];
    indexed.forEach(({ row, idx }) => {
      const itemName = String(row[nameKey] ?? '');
      const cells = cols.map(c => {
        const v = row[c] ?? '';
        const cls = hideCols.includes(c) ? ' class="ref-hide-mobile"' : '';
        return `<td${cls}>${escHtml(String(v ?? '').substring(0, 100))}</td>`;
      }).join('');
      const addCell = hasAddAction
        ? `<td class="ref-col-add"><button class="ref-add-btn" data-add-name="${escAttr(itemName)}" data-add-table="${escAttr(table)}">+</button></td>`
        : '<td class="ref-col-add"></td>';
      trs.push(
        `<tr class="ref-row" data-ref-table="${table}" data-ref-idx="${idx}" data-detail-id="d${idx}">
           ${cells}${addCell}
         </tr>`
      );

      const desc = refDescField(row);
      const metas = cols.slice(1).map(c => {
        const v = row[c];
        if (v == null || String(v).trim() === '' || String(v).toLowerCase() === 'null') return '';
        return `<span><span class="sc-label">${escHtml(c)}</span> ${escHtml(String(v))}</span>`;
      }).filter(Boolean).join('');
      trs.push(
        `<tr class="row-detail" data-detail="d${idx}">
           <td colspan="${cols.length + 1}">
             <div class="ref-detail-card">
               <div class="ref-detail-name">${escHtml(itemName)}</div>
               ${metas ? `<div class="ref-detail-meta">${metas}</div>` : ''}
               ${desc  ? `<div class="ref-detail-desc">${escHtml(desc)}</div>` : ''}
             </div>
           </td>
         </tr>`
      );
    });

    const headers = [...cols, ''].map((c, i) => {
      if (i === cols.length) return '<th class="ref-col-add"></th>';
      const cls = hideCols.includes(c) ? ' ref-hide-mobile' : '';
      const isActive = c === sortCol;
      const arrow = isActive ? (state.refSort.asc ? ' ▲' : ' ▼') : '';
      return `<th class="ref-sortable${cls}${isActive ? ' active' : ''}" data-sort="${escAttr(c)}">${escHtml(c)}<span class="ref-sort-arrow">${arrow}</span></th>`;
    }).join('');

    const body = trs.length
      ? trs.join('')
      : `<tr><td colspan="${cols.length + 1}" style="color:var(--text-muted);padding:1rem;text-align:center">No matches.</td></tr>`;

    content.innerHTML =
      `<table class="ref-table list-table" data-ref="${table}"><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;

    // Sort header clicks
    content.querySelectorAll('th.ref-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.refSort.col === col) {
          if (state.refSort.asc) state.refSort.asc = false;
          else                    state.refSort = { col: null, asc: true };
        } else {
          state.refSort = { col, asc: true };
        }
        renderRefTable(state.refData[table], table);
      });
    });

    // Row click → expand detail; + button stops propagation and fires host action
    content.querySelectorAll('tr.ref-row').forEach(tr => {
      tr.addEventListener('click', () => {
        const did = tr.dataset.detailId;
        content.querySelector(`tr.row-detail[data-detail="${did}"]`)?.classList.toggle('open');
      });
    });
    content.querySelectorAll('.ref-add-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const name  = btn.dataset.addName;
        const tbl   = btn.dataset.addTable;
        window.RefDrawer?.addAction?.(name, tbl);
      });
    });
  }

  // ── Wire up event listeners that don't live in inline onclick attrs ────
  function init() {
    // Dtab buttons — switch the active table
    document.querySelectorAll('.dtab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dtab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        loadRefTable(btn.dataset.table);
      });
    });
    // Spell caster filter chips
    document.querySelectorAll('.ref-caster-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.refSpellCaster = btn.dataset.caster;
        if (state.refSpellCaster === 'all') state.refSpellAligns.clear();
        updateSpellFilters('spells');
        if (state.refTable === 'spells' && state.refData.spells) {
          renderRefTable(state.refData.spells, 'spells');
        }
      });
    });
    // Spell alignment chips
    document.querySelectorAll('.ref-align-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = btn.dataset.align;
        if (state.refSpellAligns.has(a)) state.refSpellAligns.delete(a);
        else                              state.refSpellAligns.add(a);
        updateSpellFilters('spells');
        if (state.refTable === 'spells' && state.refData.spells) {
          renderRefTable(state.refData.spells, 'spells');
        }
      });
    });
  }

  // Expose the public API on window so inline onclick handlers in the
  // drawer markup (close button, search input, class-filter toggle) work.
  // The character sheet's app.js defines these functions itself and will
  // override these — that's fine, the markup uses whichever is set.
  if (typeof window.openReference   !== 'function') window.openReference   = openReference;
  if (typeof window.closeReference  !== 'function') window.closeReference  = closeReference;
  if (typeof window.filterReference !== 'function') window.filterReference = filterReference;
  if (typeof window.toggleClassFilter !== 'function') window.toggleClassFilter = toggleClassFilter;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
