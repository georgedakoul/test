/* Authentication: check session on load, show a sign-in / sign-up modal
   if the user isn't logged in, persist theme to the server, and surface a
   username chip + sign-out button in the nav. */
(function () {
  const root = document.documentElement;

  // ── API ───────────────────────────────────────────────────────────
  const API = {
    me:      () => fetch('/api/auth/me').then(r => r.json()),
    signin:  (u,p)   => fetch('/api/auth/signin', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u,password:p}) }),
    signup:  (u,p)   => fetch('/api/auth/signup', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:u,password:p}) }),
    signout: ()      => fetch('/api/auth/signout', { method:'POST' }),
    saveTheme: (theme, mode) => fetch('/api/auth/theme', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({theme,mode}) }),
  };

  // Exposed so theme.js can call back to persist on change
  window.__saveThemeToServer = function (theme, mode) {
    if (window.__SDUSER) API.saveTheme(theme, mode).catch(()=>{});
  };

  // ── DOM helpers ───────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  function show(el) { if (el) el.hidden = false; }
  function hide(el) { if (el) el.hidden = true; }

  // ── Modal control ─────────────────────────────────────────────────
  function openModal(mode /* 'signin' | 'signup' */) {
    const ov = $('auth-overlay');
    if (!ov) return;
    ov.hidden = false;
    setAuthMode(mode || 'signin');
    setTimeout(() => $('auth-username')?.focus(), 50);
  }
  function closeModal() {
    const ov = $('auth-overlay');
    if (ov) ov.hidden = true;
    clearError();
  }
  // Exposed so the account button (and anything else) can open the modal
  window.__openAuthModal = openModal;
  function setAuthMode(mode) {
    const isSignup = mode === 'signup';
    $('auth-title').textContent = isSignup ? 'Create your account' : 'Sign in';
    $('auth-verify-row').hidden = !isSignup;
    // Verify password is exclusive to sign-up — clear any leftover value when
    // switching to sign-in so it can't accidentally affect anything.
    if (!isSignup) { const v = $('auth-verify'); if (v) v.value = ''; }
    $('auth-submit').textContent = isSignup ? 'Create account' : 'Sign in';
    $('auth-switch').innerHTML = isSignup
      ? 'Already have an account? <a href="#" id="auth-switch-link">Sign in</a>'
      : 'No account yet? <a href="#" id="auth-switch-link">Create one</a>';
    $('auth-switch-link').onclick = e => {
      e.preventDefault();
      setAuthMode(isSignup ? 'signin' : 'signup');
    };
    clearError();
    document.documentElement.dataset.authMode = mode;
  }
  function showError(msg) { const e = $('auth-error'); if (e) { e.textContent = msg; e.hidden = false; } }
  function clearError() { const e = $('auth-error'); if (e) { e.textContent = ''; e.hidden = true; } }

  // ── Submit handler ────────────────────────────────────────────────
  async function submit(e) {
    e.preventDefault();
    clearError();
    const u  = $('auth-username').value.trim();
    const p  = $('auth-password').value;
    const isSignup = document.documentElement.dataset.authMode === 'signup';
    if (!u || !p) { showError('Username and password are required.'); return; }
    if (isSignup) {
      const v = $('auth-verify').value;
      if (p !== v) { showError('Passwords do not match.'); return; }
      if (p.length < 4) { showError('Password must be at least 4 characters.'); return; }
    }
    const fn = isSignup ? API.signup : API.signin;
    const resp = await fn(u, p);
    const data = await resp.json().catch(()=>({}));
    if (!resp.ok) { showError(data.error || 'Something went wrong.'); return; }
    // Success → reload to start a fresh session-loaded UI
    closeModal();
    location.reload();
  }

  // ── Sign out ──────────────────────────────────────────────────────
  async function signOut() {
    await API.signout().catch(()=>{});
    window.__SDUSER = null;
    location.reload();
  }
  window.__signOut = signOut;

  // ── Bootstrap on load ─────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', async () => {
    // Wire form + modal controls
    $('auth-form')?.addEventListener('submit', submit);
    $('auth-close')?.addEventListener('click', closeModal);
    $('user-chip-signout')?.addEventListener('click', signOut);
    // Close on backdrop click (clicking outside the card)
    $('auth-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'auth-overlay') closeModal();
    });
    // Account button opens the modal in sign-in mode
    $('account-btn')?.addEventListener('click', () => openModal('signin'));

    // Check session
    let user = null;
    try { user = (await API.me()).user; } catch (_) {}
    window.__SDUSER = user;

    const chip = $('user-chip');
    const acctBtn = $('account-btn');
    if (user) {
      // Apply user's saved theme over the localStorage default
      if (user.theme) root.setAttribute('data-theme', user.theme);
      if (user.mode)  root.setAttribute('data-mode',  user.mode);
      // Sync localStorage so theme.js's later reads match
      if (user.theme) localStorage.setItem('sdTheme', user.theme);
      if (user.mode)  localStorage.setItem('sdMode',  user.mode);
      // Show user chip, hide account button
      if (chip) {
        chip.hidden = false;
        const n = $('user-chip-name'); if (n) n.textContent = user.username;
      }
      if (acctBtn) acctBtn.hidden = true;
      // Reveal Game Master nav for GMs.
      if (user.is_gm) {
        const gmNav = $('nav-gm');
        if (gmNav) gmNav.hidden = false;
      }
    } else {
      // Not logged in → leave the modal closed; show the account button instead
      if (chip) chip.hidden = true;
      if (acctBtn) acctBtn.hidden = false;
    }
  });
})();
