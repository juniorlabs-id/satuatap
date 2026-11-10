/* ============================================================
 * App — mulai aplikasi, login, sesi, sinkron latar belakang
 * ============================================================ */
(function () {
  const I = (n, c) => UI.icon(n, c);
  const SESS = 'sa:sess';
  const App = { ready: false };
  window.App = App;

  App.applyTheme = () => {
    const t = localStorage.getItem('sa:theme') || 'system';
    const dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0b1716' : '#0F5E59';
  };
  if (window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', App.applyTheme);

  const getSess = () => { try { return JSON.parse(localStorage.getItem(SESS) || 'null'); } catch (e) { return null; } };
  const setSess = s => localStorage.setItem(SESS, JSON.stringify(s));

  // ---------- Render terjadwal (tidak mengganggu saat mengetik) ----------
  let rq = 0, pendingRender = false;
  function scheduleRender() {
    if (!App.ready) return;
    const a = document.activeElement;
    if (a && a.closest && a.closest('#view') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
      if (!pendingRender) { pendingRender = true; a.addEventListener('blur', () => { pendingRender = false; scheduleRender(); }, { once: true }); }
      return;
    }
    cancelAnimationFrame(rq);
    rq = requestAnimationFrame(() => UI.render());
  }

  App.start = () => {
    App.ready = true;
    UI.shell();
    if (!location.hash) location.replace('#/beranda');
    UI.route();
    Store.on(why => { if (why === 'sync' || why === 'local') scheduleRender(); });
    App.loop();
  };

  App.loop = () => {
    if (App._loop) return; App._loop = true;
    setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine !== false) Store.sync(); }, APP_CONFIG.SYNC_INTERVAL_MS || 60000);
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); Store.flush(); return; }
      if (Date.now() - hiddenAt > 120000) API.warm();
      if (Date.now() - Store.lastSync > 20000) Store.sync();
      if (Calc.period().key !== App._pkey) { App._pkey = Calc.period().key; Store.emit('day'); UI.render(); }
    });
    window.addEventListener('online', () => { UI.netState(true); Store.flush(); });
    window.addEventListener('offline', () => UI.netState(false));
    window.addEventListener('beforeunload', e => { if (Store.outbox.length && Store.mode === 'live') { Store.flush(); } });
    App._pkey = Calc.period().key;
  };

  App.sessionExpired = () => {
    if (App._expired) return; App._expired = true;
    const s = getSess(); if (s) { s.token = ''; setSess(s); }
    UI.toast('Sesi berakhir. Silakan masuk lagi.', 'warn');
    setTimeout(() => { App.ready = false; App.login(); App._expired = false; }, 800);
  };

  App.logout = async () => {
    const s = getSess();
    try { if (s && s.mode === 'live') { await Store.IDB.del(Store.ns() + 'snap'); await Store.IDB.del(Store.ns() + 'outbox'); } } catch (e) {}
    localStorage.removeItem(SESS);
    location.href = location.pathname;
  };

  // ---------- Masuk ----------
  async function enter(res, gasUrl) {
    Store.mode = 'live'; Store.gasUrl = gasUrl; Store.token = res.token; Store.me = res.me;
    Store.applySnapshot(res.boot); Store.lastSync = Date.now();
    setSess({ mode: 'live', gasUrl, token: res.token, me: res.me });
    Store.persist();
    location.hash = '#/beranda';
    App.start();
  }
  App.demo = (big) => {
    Store.mode = 'demo'; Store.gasUrl = ''; Store.token = 'demo';
    Store.persist = () => {};
    DemoServer.init(big || /big/.test(location.search));
    const r = DemoServer.handle('boot', {});
    Store.me = r.data.me; Store.applySnapshot(r.data.boot); Store.lastSync = Date.now();
    if (!location.hash || location.hash === '#') location.hash = '#/beranda';
    App.start();
  };

  UI.act('exit-demo', () => { location.href = location.pathname; });
  App.login = (msg) => {
    App.ready = false;
    const s = getSess() || {};
    const params = new URLSearchParams(location.search);
    const url = params.get('api') || s.gasUrl || APP_CONFIG.DEFAULT_GAS_URL || '';
    document.body.innerHTML = `
      <main class="login">
        <div class="login-card">
          <img src="img/logo-wide.png" alt="SatuAtap" class="login-logo" width="240" height="80">
          <p class="slogan">Keuangan keluarga, di bawah satu atap.</p>
          ${msg ? `<div class="note warn">${U.esc(msg)}</div>` : ''}
          <div id="step-url" ${url ? 'hidden' : ''}>
            <h2>Hubungkan keluarga Anda</h2>
            <p class="muted small">Tempel alamat backend (URL Web App <code>/exec</code>) yang didapat Admin saat instalasi.</p>
            <label class="field"><span>URL backend</span><input id="in-url" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="${U.esc(url)}"></label>
            <button class="btn block" id="btn-url">${I('link')} Hubungkan</button>
          </div>
          <div id="step-login" hidden>
            <div class="fam-chip">${I('heart-handshake')}<b id="fam-name">Keluarga</b><button class="link" id="btn-ganti">Ganti</button></div>
            <div id="gbtn" class="gbtn"></div>
            <p class="muted small" id="g-note"></p>
            <details class="darurat"><summary>${I('life-buoy')} Masuk dengan akses darurat (Admin)</summary>
              <label class="field"><span>Nama pengguna</span><input id="in-du" autocomplete="username" value="darurat"></label>
              <label class="field"><span>Kata sandi</span><input id="in-dp" type="password" autocomplete="current-password"></label>
              <button class="btn ghost block" id="btn-dar">Masuk</button></details>
          </div>
          <div class="login-msg" id="login-msg" aria-live="polite"></div>
          <div class="or"><span>atau</span></div>
          <button class="btn ghost block" id="btn-demo">${I('flask-conical')} Coba demo dengan data contoh</button>
          <p class="muted tiny center">Data keluarga tersimpan di Google Drive Anda sendiri · JuniorLabs</p>
        </div>
      </main><div id="toast-root"></div>`;
    const $ = id => document.getElementById(id), say = (t, bad) => { $('login-msg').innerHTML = t ? `<span class="${bad ? 'bad' : ''}">${t}</span>` : ''; };
    $('btn-demo').onclick = () => App.demo();
    $('btn-ganti').onclick = () => { $('step-login').hidden = true; $('step-url').hidden = false; };
    const connect = async (u) => {
      u = String(u || '').trim();
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec(\?.*)?$/.test(u)) { say('Alamat harus berupa URL Web App Apps Script yang berakhiran <b>/exec</b>.', true); $('step-url').hidden = false; return; }
      say('Menghubungkan… (pertama kali bisa 3–8 detik)');
      Store.mode = 'live';
      const r = await API.call('info', {}, { url: u });
      if (!r.success) { say(U.esc(r.message || 'Tidak bisa terhubung.'), true); $('step-url').hidden = false; return; }
      if (!r.data.siap) { say('Backend belum di-setup. Admin perlu menjalankan <b>setupAppEnvironment</b> di Apps Script.', true); $('step-url').hidden = false; return; }
      setSess(Object.assign(getSess() || {}, { gasUrl: u, mode: 'live' }));
      $('fam-name').textContent = r.data.namaKeluarga || 'Keluarga';
      $('step-url').hidden = true; $('step-login').hidden = false; say('');
      const c = await API.call('auth.config', {}, { url: u });
      const cid = c.success && c.data.googleClientId && !/GANTI/.test(c.data.googleClientId) ? c.data.googleClientId : '';
      if (!cid) { $('g-note').innerHTML = 'Login Google belum diaktifkan. Admin: masuk dengan <b>akses darurat</b>, lalu isi Client ID di Pengaturan › Keamanan.'; $('step-login').querySelector('details').open = true; }
      else loadGIS(cid, async cred => {
        say('Memeriksa akun…');
        const a = await API.call('auth.google', { idToken: cred }, { url: u });
        if (a.success) enter(a.data, u); else say(U.esc(a.message), true);
      });
      $('btn-dar').onclick = async () => {
        say('Memeriksa…');
        const a = await API.call('auth.darurat', { username: $('in-du').value.trim(), password: $('in-dp').value }, { url: u });
        $('in-dp').value = '';
        if (a.success) enter(a.data, u); else say(U.esc(a.message), true);
      };
    };
    $('btn-url').onclick = () => connect($('in-url').value);
    $('in-url').addEventListener('keydown', e => { if (e.key === 'Enter') connect($('in-url').value); });
    if (url) connect(url);
  };
  function loadGIS(cid, cb) {
    const go = () => {
      try {
        google.accounts.id.initialize({ client_id: cid, callback: r => cb(r.credential), ux_mode: 'popup', auto_select: false, itp_support: true });
        google.accounts.id.renderButton(document.getElementById('gbtn'), { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'signin_with', locale: 'id', width: 280 });
      } catch (e) { document.getElementById('g-note').textContent = 'Gagal memuat tombol Google: ' + e.message; }
    };
    if (window.google && google.accounts) return go();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = go;
    s.onerror = () => { document.getElementById('g-note').textContent = 'Tidak bisa memuat layanan Google. Periksa koneksi.'; };
    document.head.appendChild(s);
  }

  // ---------- Inisialisasi ----------
  App.init = async () => {
    App.applyTheme();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const params = new URLSearchParams(location.search);
    if (params.has('demo')) return App.demo(params.get('demo') === 'big');
    const s = getSess();
    if (!s || s.mode !== 'live' || !s.token || !s.gasUrl) return App.login();
    Store.mode = 'live'; Store.gasUrl = s.gasUrl; Store.token = s.token; Store.me = s.me;
    API.warm();
    const had = await Store.loadLocal();
    if (had) {
      App.start();                       // tampil instan dari data perangkat
      Store.sync().then(() => { const ss = getSess(); if (ss && Store.me) { ss.me = Store.me; setSess(ss); } });
      if (Store.outbox.length) Store.flush();
    } else {
      document.body.innerHTML = `<div class="splash"><img src="img/icon-192.png" width="72" height="72" alt=""><p>Memuat data keluarga…</p></div>`;
      await Store.sync(true);
      if (!Store.t.Anggota.length) return App.login('Tidak bisa memuat data. Periksa koneksi lalu coba lagi.');
      const ss = getSess(); ss.me = Store.me; setSess(ss);
      App.start();
    }
  };
  // Pastikan me dari server selalu terbaru (peran/izin bisa diubah Admin)
  Store.on(why => { if (why === 'sync' && Store.mode === 'live' && Store.me) { const m = Store.member(Store.me.email); if (m) { Store.me = Object.assign({}, Store.me, { nama: m.nama, peran: m.peran, warna: m.warna, izin: m.izin || {} }); } } });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init); else App.init();
})();
