/* Mobile "you" chip: a single button on the right of the nav that opens a
   floating card with light/dark, theme palette dots, and sign in/out. The
   chip itself reflects current state (swatch color + mode icon + username).
   Desktop keeps the existing inline controls; this only takes over on phone. */
(function () {
  const VALID_THEMES = ['charcoal','blue','green','crimson'];
  const root = document.documentElement;
  const $ = id => document.getElementById(id);

  // ── Sync popover contents from current state ───────────────────
  function refresh() {
    const theme = root.getAttribute('data-theme') || 'charcoal';
    const mode  = root.getAttribute('data-mode')  || 'light';
    const user  = window.__SDUSER || null;

    const mIcon  = $('np-mode-icon');  if (mIcon)  mIcon.textContent  = (mode === 'dark') ? '☀' : '🌙';
    const mLabel = $('np-mode-label'); if (mLabel) mLabel.textContent = (mode === 'dark') ? 'Switch to light' : 'Switch to dark';
    const aLabel = $('np-acct-label'); if (aLabel) aLabel.textContent = user ? `Sign out (${user.username})` : 'Sign in';

    document.querySelectorAll('.np-dot').forEach(d => {
      d.classList.toggle('active', d.dataset.theme === theme);
    });
  }
  window.__refreshNavChip = refresh;

  // ── Popover open / close ────────────────────────────────────────
  function openPop() {
    const pop = $('nav-popover'); const chip = $('nav-chip');
    if (!pop) return;
    refresh();
    pop.hidden = false;
    chip?.setAttribute('aria-expanded', 'true');
    setTimeout(() => document.addEventListener('click', outsideClose, { capture: true }), 0);
  }
  function closePop() {
    const pop = $('nav-popover'); const chip = $('nav-chip');
    if (pop) pop.hidden = true;
    chip?.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', outsideClose, { capture: true });
  }
  function outsideClose(e) {
    if (e.target.closest('#nav-popover') || e.target.closest('#nav-chip')) return;
    closePop();
  }

  // ── Apply theme/mode and persist ────────────────────────────────
  function setMode(mode) {
    root.setAttribute('data-mode', mode);
    localStorage.setItem('sdMode', mode);
    if (typeof window.__saveThemeToServer === 'function') {
      window.__saveThemeToServer(root.getAttribute('data-theme'), mode);
    }
    // Sync the desktop theme-mode-btn icon too
    const dBtn = $('theme-mode-btn');
    if (dBtn) {
      dBtn.textContent = mode === 'dark' ? '☀' : '🌙';
      dBtn.title = mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
    }
    refresh();
  }
  function setTheme(theme) {
    if (!VALID_THEMES.includes(theme)) return;
    root.setAttribute('data-theme', theme);
    localStorage.setItem('sdTheme', theme);
    if (typeof window.__saveThemeToServer === 'function') {
      window.__saveThemeToServer(theme, root.getAttribute('data-mode'));
    }
    // Sync the desktop theme-select too
    const sel = $('theme-select'); if (sel) sel.value = theme;
    refresh();
  }

  // ── Wire up ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    refresh();

    $('nav-chip')?.addEventListener('click', e => {
      e.stopPropagation();
      const pop = $('nav-popover');
      if (pop && !pop.hidden) closePop(); else openPop();
    });

    $('np-mode-btn')?.addEventListener('click', () => {
      setMode(root.getAttribute('data-mode') === 'dark' ? 'light' : 'dark');
    });

    document.querySelectorAll('.np-dot').forEach(d => {
      d.addEventListener('click', () => setTheme(d.dataset.theme));
    });

    $('np-acct-btn')?.addEventListener('click', () => {
      closePop();
      if (window.__SDUSER && typeof window.__signOut === 'function') {
        window.__signOut();
      } else if (typeof window.__openAuthModal === 'function') {
        window.__openAuthModal('signin');
      }
    });
  });
})();
