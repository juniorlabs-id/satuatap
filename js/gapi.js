/* ============================================================
 * GAPI — login Google (token OAuth di browser) + pemanggil REST
 * Drive / Sheets. Hanya izin "drive.file": aplikasi hanya bisa
 * membuka file yang dibuat/dipilih lewat SatuAtap — tidak memicu
 * layar "aplikasi belum diverifikasi".
 * Sinkron otomatis: saat login, relay menukar kode menjadi token +
 * kunci perpanjangan TERSEGEL yang disimpan di perangkat ini. Saat token
 * habis (±1 jam), aplikasi meminta token baru lewat relay tanpa pop-up.
 * ============================================================ */
(function () {
  const SCOPES = 'openid email profile https://www.googleapis.com/auth/drive.file';
  const TOK = 'sa:tok';
  const Auth = { token: '', exp: 0, email: '', rt: '', client: null, waiters: [], asking: false, lastAsk: 0 };

  function save() { try { localStorage.setItem(TOK, JSON.stringify({ t: Auth.token, e: Auth.exp, m: Auth.email, r: Auth.rt })); } catch (e) {} }
  (function load() { try { const o = JSON.parse(localStorage.getItem(TOK) || 'null'); if (o) { Auth.token = o.t; Auth.exp = o.e; Auth.email = o.m; Auth.rt = o.r || ''; } } catch (e) {} })();
  const relayOn = () => !!(window.Relay && Relay.enabled());
  /** Alamat kembali login — harus SAMA PERSIS dengan "Authorized redirect URIs" di Google Cloud. */
  Auth.redirect = () => {
    if (APP_CONFIG.REDIRECT_URI) return APP_CONFIG.REDIRECT_URI;
    let p = location.pathname;
    if (/\.html?$/i.test(p)) p = p.replace(/[^/]*$/, '');      // /satuatap/index.html → /satuatap/
    else if (!p.endsWith('/')) p += '/';                        // /satuatap → /satuatap/
    return location.origin + p + 'oauth.html';
  };

  Auth.valid = () => !!Auth.token && Auth.exp - Date.now() > 60000;
  Auth.clear = () => { Auth.token = ''; Auth.exp = 0; save(); };
  Auth.forget = () => {
    try { if (Auth.rt && relayOn()) Relay.call('auth.cabut', { rt: Auth.rt }); else if (Auth.token && window.google && google.accounts && google.accounts.oauth2) google.accounts.oauth2.revoke(Auth.token, () => {}); } catch (e) {}
    Auth.clear(); Auth.email = ''; Auth.rt = ''; localStorage.removeItem(TOK);
  };

  /** Muat Google Identity Services sekali. */
  let gisP = null;
  Auth.loadGIS = () => gisP || (gisP = new Promise((res, rej) => {
    if (window.google && google.accounts && google.accounts.oauth2) return res();
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => res(); s.onerror = () => { gisP = null; rej(new Error('Tidak bisa memuat layanan Google. Periksa koneksi.')); };
    document.head.appendChild(s);
  }));

  function ensureClient() {
    if (Auth.client) return Auth.client;
    Auth.client = google.accounts.oauth2.initTokenClient({
      client_id: APP_CONFIG.GOOGLE_CLIENT_ID, scope: SCOPES, prompt: '',
      callback: r => {
        Auth.asking = false;
        const ws = Auth.waiters.splice(0);
        if (r && r.access_token && (!google.accounts.oauth2.hasGrantedAllScopes || google.accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/drive.file'))) {
          Auth.token = r.access_token; Auth.exp = Date.now() + (Number(r.expires_in) || 3599) * 1000; save();
          ws.forEach(w => w.res(Auth.token));
        } else ws.forEach(w => w.rej(new Error(r && r.access_token ? 'Izin akses Google Drive wajib dicentang agar data keluarga bisa disimpan.' : (r && r.error_description) || 'Login Google dibatalkan.')));
      },
      error_callback: e => { Auth.asking = false; Auth.waiters.splice(0).forEach(w => w.rej(new Error(e && e.type === 'popup_closed' ? 'Jendela login ditutup.' : e && e.type === 'popup_failed_to_open' ? 'Pop-up diblokir. Izinkan pop-up untuk situs ini.' : 'Login Google gagal.'))); }
    });
    return Auth.client;
  }
  /** Mode tanpa relay (pengembangan): token langsung dari Google Identity Services. */
  const gisRequest = (consent) => new Promise((res, rej) => {
    if (!APP_CONFIG.GOOGLE_CLIENT_ID) return rej(new Error('GOOGLE_CLIENT_ID belum diisi di js/config.js.'));
    if (!(window.google && google.accounts && google.accounts.oauth2)) return rej(new Error('Layanan Google belum termuat. Coba lagi.'));
    Auth.waiters.push({ res, rej });
    if (Auth.asking) return;
    Auth.asking = true; Auth.lastAsk = Date.now();
    try { ensureClient().requestAccessToken({ prompt: consent ? 'consent' : '', hint: Auth.email || undefined }); }
    catch (e) { Auth.asking = false; Auth.waiters.splice(0).forEach(w => w.rej(e)); }
  });

  // ---------- Login dengan kunci perpanjangan (lewat relay) ----------
  function authUrl(state, consent) {
    const q = new URLSearchParams({ client_id: APP_CONFIG.GOOGLE_CLIENT_ID, redirect_uri: Auth.redirect(), response_type: 'code', scope: SCOPES,
      access_type: 'offline', include_granted_scopes: 'true', state, prompt: consent ? 'consent' : 'select_account' });
    if (Auth.email) q.set('login_hint', Auth.email);
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + q.toString();
  }
  /** Tukar kode → token + kunci tersegel. */
  Auth.exchange = async (code) => {
    const r = await Relay.call('auth.tukar', { code, redirect: Auth.redirect() });
    if (!r.success) throw new Error(r.message || 'Login Google gagal.');
    Auth.token = r.data.access_token; Auth.exp = Date.now() + (Number(r.data.expires_in) || 3599) * 1000; Auth.email = r.data.email;
    if (r.data.rt) Auth.rt = r.data.rt;
    save(); return Auth.token;
  };
  /** Minta login. HARUS dipanggil langsung dari klik pengguna (pop-up). */
  Auth.request = (consent) => {
    if (!relayOn()) return gisRequest(consent);
    if (!APP_CONFIG.GOOGLE_CLIENT_ID) return Promise.reject(new Error('GOOGLE_CLIENT_ID belum diisi di js/config.js.'));
    return new Promise((res, rej) => {
      const state = U.uid('s'), url = authUrl(state, consent || !Auth.rt);
      try { localStorage.setItem('sa:oauthState', state); localStorage.removeItem('sa:oauth'); } catch (e) {}
      const standalone = window.navigator.standalone === true;   // PWA iPhone: pop-up tidak andal → alihkan halaman
      const w = standalone ? null : window.open(url, 'satuatap-login', 'width=500,height=680');
      if (!w) { localStorage.setItem('sa:oauthBack', location.href); location.href = url; return; }
      Auth.asking = true; Auth.lastAsk = Date.now();
      let fin = false;
      const done = async (m) => {
        if (fin) return; fin = true; cleanup();
        if (m.error || !m.code) return rej(new Error(m.error === 'access_denied' ? 'Izin Google dibatalkan.' : 'Login Google gagal.'));
        if (m.state !== state) return rej(new Error('Sesi login tidak cocok. Coba lagi.'));
        try { res(await Auth.exchange(m.code)); } catch (e) { rej(e); }
      };
      const onMsg = e => { if (e.origin === location.origin && e.data && e.data.type === 'satuatap-oauth') done(e.data); };
      const onSt = e => { if (e.key === 'sa:oauth' && e.newValue) { try { done(JSON.parse(e.newValue)); } catch (x) {} } };
      const poll = setInterval(() => {
        let closed = false; try { closed = w.closed; } catch (e) {}
        if (!closed) return;
        const v = localStorage.getItem('sa:oauth');
        if (v) { try { done(JSON.parse(v)); } catch (x) {} } else if (!fin) { fin = true; cleanup(); rej(new Error('Jendela login ditutup.')); }
      }, 600);
      function cleanup() { Auth.asking = false; clearInterval(poll); removeEventListener('message', onMsg); removeEventListener('storage', onSt); localStorage.removeItem('sa:oauth'); }
      addEventListener('message', onMsg); addEventListener('storage', onSt);
    });
  };
  /** Kembali dari login mode alih-halaman (iPhone). true bila berhasil. */
  Auth.resume = async () => {
    let m = null; try { m = JSON.parse(localStorage.getItem('sa:oauth') || 'null'); } catch (e) {}
    if (!m) return false;
    localStorage.removeItem('sa:oauth');
    if (Date.now() - m.at > 300000 || !m.code || m.state !== localStorage.getItem('sa:oauthState')) return false;
    await Auth.exchange(m.code); return true;
  };
  /** Pastikan token aktif; perpanjang diam-diam lewat relay bila perlu. */
  let refreshing = null;
  Auth.ensure = () => {
    if (Auth.valid()) return Promise.resolve(true);
    if (!Auth.rt || !relayOn() || (window.Store && Store.mode === 'demo')) return Promise.resolve(false);
    if (!refreshing) refreshing = (async () => {
      const r = await Relay.call('auth.segarkan', { rt: Auth.rt });
      if (r.success) { Auth.token = r.data.access_token; Auth.exp = Date.now() + (Number(r.data.expires_in) || 3599) * 1000; save(); return true; }
      if (r.data && r.data.code === 'REAUTH') { Auth.rt = ''; save(); }
      return false;
    })().finally(() => { refreshing = null; });
    return refreshing;
  };

  Auth.userinfo = async () => {
    const r = await G.req('https://www.googleapis.com/oauth2/v3/userinfo');
    if (!r.ok) throw new Error(r.message || 'Gagal membaca profil Google.');
    Auth.email = String(r.data.email || '').toLowerCase(); save();
    return { email: Auth.email, nama: r.data.given_name || r.data.name || Auth.email.split('@')[0], foto: r.data.picture || '' };
  };

  // ---------- Pemanggil REST dengan retry ----------
  const G = {};
  /** return {ok, status, data, message, auth:true bila token perlu diperbarui, network:true bila offline} */
  G.req = async (url, opt) => {
    opt = opt || {};
    if (!Auth.valid() && !(await Auth.ensure())) return { ok: false, auth: true, message: 'Sesi Google perlu disambung ulang.' };
    let renewed = false;
    for (let i = 0; i < 4; i++) {
      if (i) await new Promise(r => setTimeout(r, 600 * Math.pow(2, i - 1) + Math.random() * 300));
      let res;
      const ctrl = new AbortController(), timer = setTimeout(() => ctrl.abort(), opt.timeout || 45000);
      try {
        res = await fetch(url, { method: opt.method || 'GET', signal: ctrl.signal, cache: 'no-store',
          headers: Object.assign({ Authorization: 'Bearer ' + Auth.token }, opt.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          body: opt.body !== undefined ? JSON.stringify(opt.body) : undefined });
      } catch (e) { clearTimeout(timer); if (i < 3 && navigator.onLine !== false) continue; return { ok: false, network: true, message: e.name === 'AbortError' ? 'Google terlalu lama merespons.' : 'Koneksi terputus.' }; }
      clearTimeout(timer);
      if (res.status === 401) {
        Auth.clear();
        if (!renewed && (await Auth.ensure())) { renewed = true; i--; continue; }
        return { ok: false, auth: true, status: 401, message: 'Sesi Google berakhir.' };
      }
      if ((res.status === 429 || res.status >= 500) && i < 3) continue;
      let data = null; const txt = await res.text();
      try { data = txt ? JSON.parse(txt) : {}; } catch (e) { data = { raw: txt }; }
      if (!res.ok) return { ok: false, status: res.status, data, message: (data && data.error && data.error.message) || ('HTTP ' + res.status) };
      return { ok: true, status: res.status, data };
    }
    return { ok: false, network: true, message: 'Layanan Google sibuk. Coba lagi sebentar.' };
  };
  G.DRIVE = 'https://www.googleapis.com/drive/v3';
  G.SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

  window.Auth = Auth; window.G = G;
})();
