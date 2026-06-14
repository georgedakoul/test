/* Theme controller — applies saved palette + light/dark mode and wires the
   site-nav controls. The data-theme/data-mode attributes are also set by a
   tiny inline snippet in <head> so there's no flash before this loads. */
(function () {
  const VALID_THEMES = ['charcoal', 'blue', 'green', 'crimson'];
  const root = document.documentElement;

  function getTheme() {
    const t = localStorage.getItem('sdTheme');
    return VALID_THEMES.includes(t) ? t : 'charcoal';
  }
  function getMode() {
    return localStorage.getItem('sdMode') === 'dark' ? 'dark' : 'light';
  }
  function apply(theme, mode) {
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-mode', mode);
  }

  // Ensure attributes are set (inline snippet usually did this already)
  apply(getTheme(), getMode());

  document.addEventListener('DOMContentLoaded', () => {
    const modeBtn = document.getElementById('theme-mode-btn');
    const select  = document.getElementById('theme-select');

    function refreshUI() {
      const dark = root.getAttribute('data-mode') === 'dark';
      if (modeBtn) {
        modeBtn.textContent = dark ? '☀' : '🌙';
        modeBtn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      }
      if (select) select.value = root.getAttribute('data-theme');
    }
    refreshUI();

    modeBtn?.addEventListener('click', () => {
      const mode = root.getAttribute('data-mode') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('sdMode', mode);
      apply(root.getAttribute('data-theme'), mode);
      refreshUI();
      // Persist to the user's account if signed in
      if (typeof window.__saveThemeToServer === 'function') {
        window.__saveThemeToServer(root.getAttribute('data-theme'), mode);
      }
    });

    select?.addEventListener('change', () => {
      const theme = VALID_THEMES.includes(select.value) ? select.value : 'charcoal';
      localStorage.setItem('sdTheme', theme);
      apply(theme, root.getAttribute('data-mode'));
      refreshUI();
      if (typeof window.__saveThemeToServer === 'function') {
        window.__saveThemeToServer(theme, root.getAttribute('data-mode'));
      }
    });
  });
})();
