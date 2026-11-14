/* ============================================================
 * App — masuk dengan Google, buat/gabung keluarga, lisensi,
 *       sinkron latar belakang, ringkasan bulanan, cermin tabel.
 * ============================================================ */
(function () {
  const I = (n, c) => UI.icon(n, c);
  const SESS = 'sa:sess';
  const App = Object.assign(window.App || {}, { ready: false });   // modul halaman bisa menambah fungsi lebih dulu
  window.App = App;

  App.applyTheme = () => {
    const t = localStorage.getItem('sa:theme') || 'system';
    const dark = t === 'dark' || (t === 'system' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#0b1716' : '#0F5E59';
  };
  if (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').addEventListener) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', App.applyTheme);

  const getSess = () => { try { return JSON.parse(localStorage.getItem(SESS) || 'null'); } catch (e) { return null; } };
  const setSess = s => localStorage.setItem(SESS, JSON.stringify(s));
  const fileFor = email => localStorage.getItem('sa:file:' + email) || '';

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
    if (!location.hash || location.hash === '#') location.replace('#/beranda');
    UI.route();
    App.loop();
    // Pintasan ikon aplikasi "Catat suara" (manifest) → buka perekam suara
    if (/[?&]aksi=suara\b/.test(location.search)) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} setTimeout(() => UI.voiceCatat && UI.voiceCatat(), 600); }
    Priv.decryptAll();
    if (Store.needAuth) UI.authState(true);
  };

  Store.on(why => {
    if (why === 'sync' || why === 'local') { scheduleRender(); Priv.decryptAll(); }
    if (why === 'local' && App.notifAmplop) { clearTimeout(App._amp); App._amp = setTimeout(() => { try { App.notifAmplop(); } catch (e) {} }, 1500); }
    if ((why === 'sync' || why === 'synced') && Store.mode === 'live') App.afterSync();
    if (why === 'denied' && Store.mode === 'live' && App.ready) {
      Store.IDB.del(Store.ns() + 'snap'); Store.IDB.del(Store.ns() + 'outbox'); localStorage.removeItem('sa:file:' + Auth.email);
      App.blocked('Akun ini tidak lagi punya akses ke file data keluarga (dicabut Admin atau file dihapus). Data di perangkat ini sudah dibersihkan.');
    }
  });

  App.loop = () => {
    if (App._loop) return; App._loop = true;
    setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine !== false) Store.sync(); }, APP_CONFIG.SYNC_INTERVAL_MS || 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { Store.flush(); return; }
      if (Date.now() - (Store.lastSync || 0) > 15000) Store.sync();
      if (Calc.period().key !== App._pkey) { App._pkey = Calc.period().key; UI.render(); }
    });
    window.addEventListener('online', () => { UI.netState(true); Store.sync(); });
    window.addEventListener('offline', () => UI.netState(false));
    App._pkey = Calc.period().key;
    // Token Google habis (±1 jam): sambung ulang pada ketukan berikutnya (butuh gestur pengguna untuk pop-up)
    document.addEventListener('click', e => {
      if (Store.mode !== 'live' || !Store.needAuth || Auth.asking || Date.now() - Auth.lastAsk < 15000) return;
      if (!e.target.closest('button, a, [data-act]')) return;
      App.reauth();
    }, true);
  };
  App.reauth = () => {
    if (!Relay.enabled() && !(window.google && google.accounts && google.accounts.oauth2)) { Auth.loadGIS().catch(() => {}); return; }
    Auth.request(false).then(() => { Store.needAuth = false; UI.authState(false); Store.sync(); })
      .catch(e => UI.toast(e.message, 'warn'));
  };
  UI.act('reauth', () => App.reauth());

  /** Pekerjaan ringan setelah sinkron: identitas, lisensi, ringkasan bulanan, cermin tabel. */
  App.afterSync = U.debounce(() => {
    const m = Store.member(Auth.email);
    if (!m || m.aktif === false) { if (Store.t.Anggota.length) App.blocked('Akses Anda ke data keluarga ini sudah dicabut oleh Admin.'); return; }
    Store.me = Object.assign({}, Store.me, { id: m.id, nama: m.nama, email: m.email, peran: m.peran, warna: m.warna, izin: m.izin || {} });
    App.license(); App.monthly(); App.syncMembers(); App.mirror();
    if (window.Harga) Harga.fetch().catch(() => {});
    if (App.ambilKotak) { App.ambilKotak().catch(() => {}); }
    if (App.syncAlertEmas) App.syncAlertEmas();
    if (App.notifTagihan) setTimeout(() => { try { App.notifTagihan(); } catch (e) {} }, 4000);
    App.checkSuper().then(v => { if (v && UI.cur === 'lainnya' && !document.querySelector('[data-to="konsol"]')) UI.render(); }).catch(() => {});
  }, 1500);

  App.blocked = (msg, opt) => {
    App.ready = false;
    document.body.innerHTML = `<main class="login"><div class="login-card"><img src="img/logo-wide.png" alt="SatuAtap" class="login-logo" width="240" height="80">
      <div class="empty">${I('lock', 'big')}<h3>Akses dibatasi</h3><p>${U.esc(msg)}</p></div>
      ${opt && opt.backup ? `<button class="btn block ghost" id="bk">${I('download')} Unduh cadangan data</button>` : ''}
      <button class="btn block ghost" id="wa">${I('message-circle')} Hubungi dukungan</button><button class="btn block ghost danger" id="out">${I('log-out')} Keluar</button></div></main><div id="toast-root"></div>`;
    document.getElementById('out').onclick = () => App.logout();
    document.getElementById('wa').onclick = () => window.open('https://wa.me/' + APP_CONFIG.SUPPORT_WA, '_blank', 'noopener');
    const bk = document.getElementById('bk'); if (bk) bk.onclick = () => UI.acts.backup();
  };

  // ---------- Lisensi (relay) ----------
  App.license = async () => {
    if (!Relay.enabled() || Store.mode !== 'live' || !Auth.valid()) return;
    const k = 'sa:lic:' + Store.fileId, c = JSON.parse(localStorage.getItem(k) || 'null');
    if (c && c.ok && Date.now() - c.at < 3 * 864e5) return;
    const r = await Relay.call('lisensi.cek', { fileId: Store.fileId });
    if (!r.success && (r.network || (r.data && r.data.code === 'AUTH'))) return;   // relay/sesi bermasalah sementara → tetap jalan
    if (r.success && r.data.aktif) { localStorage.setItem(k, JSON.stringify({ ok: true, at: Date.now() })); return; }
    localStorage.setItem(k, JSON.stringify({ ok: false, at: Date.now() }));
    App.blocked((r.data && r.data.alasan) || r.message || 'Lisensi keluarga ini tidak aktif.', { backup: true });
  };
  App.syncMembers = async () => {
    if (!Relay.enabled() || !Auth.valid() || Store.setting('lisensiAdmin', '') !== Auth.email) return;
    const emails = Store.members().map(m => m.email).sort(), h = U.hash(emails.join(','));
    const k = 'sa:licm:' + Store.fileId; if (localStorage.getItem(k) === h) return;
    const r = await Relay.call('lisensi.anggota', { fileId: Store.fileId, emails });
    if (r.success) localStorage.setItem(k, h);
  };

  // ---------- Ringkasan bulanan via relay ----------
  App.monthly = async () => {
    if (!Relay.enabled() || !Auth.valid() || !Store.isAdminLike() || Store.setting('notifEmail', 'true') === 'false') return;
    const p = Calc.periodShift(Calc.period(), -1), key = 'ringkasan_' + p.key;
    if (Store.setting(key, '') || !Calc.txIn(p).length || App._sendingMonthly) return;
    App._sendingMonthly = true;
    try {
      const t = Calc.periodTotals(p), cmp = Calc.compare(p);
      const data = { keluarga: Store.setting('namaKeluarga', 'Keluarga'), periode: p.label, masuk: t.masuk, keluar: t.keluar, tabung: t.tabung, net: t.net,
        top: Calc.breakdown(p, 'kategori').slice(0, 5).map(x => ({ nama: x.label, v: Math.round(x.v) })),
        naik: cmp.naik.map(x => ({ nama: x.label, pct: Math.round(x.deltaPct * 100) })),
        tujuan: Calc.goals().filter(g => !g.t.arsip && g.t.jenis !== 'pribadi').slice(0, 5).map(g => ({ nama: g.t.nama, saldo: Math.round(g.saldo), target: Math.round(g.target) })),
        tagihan: Calc.occurrences(U.today(), U.addDays(U.today(), 30)).filter(o => !o.lunas && o.arah === 'keluar' && o.kind !== 'tujuan').slice(0, 10).map(o => ({ nama: o.nama, tanggal: o.tanggal, v: Math.round(o.sisa) })),
        skor: Calc.score().total, link: location.origin + location.pathname };
      const penerima = Store.members().filter(m => m.peran !== 'anggota').map(m => m.email);
      const r = await Relay.call('ringkasan.kirim', { fileId: Store.fileId, periodeKey: p.key, data, penerima });
      if (r.success) Store.setSetting(key, U.today());
    } finally { App._sendingMonthly = false; }
  };

  // ---------- Cermin tabel yang mudah dibaca (sekali sehari, perangkat Admin) ----------
  App.mirror = () => {
    if (!Store.isAdminLike() || Store.outbox.length || !Auth.valid()) return;
    const k = 'sa:mir:' + Store.fileId; if (Date.now() - Number(localStorage.getItem(k) || 0) < 864e5) return;
    localStorage.setItem(k, String(Date.now()));
    setTimeout(() => (window.requestIdleCallback || (f => f()))(() => Cloud.mirror(Store.tablesWire()).then(r => { if (!r.ok) localStorage.removeItem(k); })), 4000);
  };

  App.logout = async () => {
    try { if (Store.mode === 'live' && Store.fileId) { await Store.IDB.del(Store.ns() + 'snap'); await Store.IDB.del(Store.ns() + 'outbox'); await Priv.lock(); } } catch (e) {}
    const s = getSess(); if (s && s.email) localStorage.removeItem('sa:file:' + s.email);
    Auth.forget(); localStorage.removeItem(SESS);
    location.href = location.pathname;
  };

  // ---------- Membuka file keluarga ----------
  async function openFamily(fileId, user, opt) {
    opt = opt || {};
    Store.mode = 'live'; Store.fileId = fileId; Cloud.fileId = fileId; Store.backend = Cloud;
    Store.me = { email: user.email, nama: user.nama, peran: 'anggota', izin: {} };
    const had = await Store.loadLocal();
    if (!had || opt.fresh) {
      say('Memuat data keluarga…');
      const r = await Store.sync(true);
      if (!r || !r.ok) throw new Error((r && r.message) || 'Gagal membaca file keluarga.');
    }
    const m = Store.member(user.email);
    if (!m || m.aktif === false) throw Object.assign(new Error(`Email ${user.email} belum terdaftar sebagai anggota keluarga di file ini. Minta Admin menambahkan email Anda di Lainnya › Anggota & Izin.`), { notMember: true });
    Store.me = { id: m.id, nama: m.nama, email: m.email, peran: m.peran, warna: m.warna, izin: m.izin || {} };
    localStorage.setItem('sa:file:' + user.email, fileId);
    setSess({ email: user.email, fileId });
    await Priv.loadKey();
    location.hash = '#/beranda';
    App.start();
    if (had) Store.sync();
    App.afterSync();
  }

  // ---------- Layar masuk ----------
  let say = () => {};
  function shell(inner) {
    document.body.innerHTML = `<main class="login"><div class="login-card"><img src="img/logo-wide.png" alt="SatuAtap" class="login-logo" width="240" height="80">
      <p class="slogan">Keuangan keluarga, di bawah satu atap.</p><div id="lg-body">${inner}</div><div class="login-msg" id="login-msg" aria-live="polite"></div>
      <p class="muted tiny center">Data tersimpan di Google Drive keluarga Anda sendiri · JuniorLabs</p></div></main><div id="toast-root"></div>`;
    say = (t, bad) => { const m = document.getElementById('login-msg'); if (m) m.innerHTML = t ? `<span class="${bad ? 'bad' : ''}">${t}</span>` : ''; };
  }
  App.login = (msg) => {
    App.ready = false;
    const s = getSess();
    shell(`${msg ? `<div class="note warn">${U.esc(msg)}</div>` : ''}
      <button class="btn block gbtn-own" id="btn-g"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        ${s && s.email ? 'Lanjutkan sebagai ' + U.esc(s.email) : 'Masuk dengan Google'}</button>
      <p class="muted small center">Anda akan diminta mengizinkan SatuAtap menyimpan file di Google Drive. SatuAtap <b>hanya</b> bisa membuka file yang ia buat sendiri.</p>
      <div class="or"><span>atau</span></div>
      <button class="btn ghost block" id="btn-demo">${I('flask-conical')} Coba demo dengan data contoh</button>
      <details class="darurat"><summary>${I('info')} Info teknis login (untuk Admin JuniorLabs)</summary>
        <p class="small">Daftarkan nilai berikut di Google Cloud › Google Auth Platform › Clients › (client Web):</p>
        <div class="kv-list small"><div class="kv"><span>Authorized JavaScript origins</span><b><code class="wrap">${U.esc(location.origin)}</code></b></div>
        <div class="kv"><span>Authorized redirect URIs</span><b><code class="wrap">${U.esc(Auth.redirect())}</code></b></div>
        <div class="kv"><span>Client ID terpakai</span><b><code class="wrap">${U.esc(APP_CONFIG.GOOGLE_CLIENT_ID || '(kosong)')}</code></b></div>
        <div class="kv"><span>Mode</span><b>${Relay.enabled() ? 'Relay (sinkron otomatis)' : 'Tanpa relay — RELAY_URL kosong'}</b></div></div></details>`);
    if (!Relay.enabled()) Auth.loadGIS().catch(e => say(U.esc(e.message), true));
    document.getElementById('btn-demo').onclick = () => App.demo();
    document.getElementById('btn-g').onclick = async () => {
      say('Membuka jendela Google…');
      try {
        await Auth.request(!(s && s.email));
        const user = await Auth.userinfo();
        await App.afterLogin(user);
      } catch (e) { say(U.esc(e.message), true); }
    };
  };

  /** Cek apakah akun ini superadmin JuniorLabs (disimpan lokal 1 hari). */
  App.checkSuper = async (force) => {
    if (!Relay.enabled() || Store.mode === 'demo') return false;
    const k = 'sa:super:' + Auth.email, c = JSON.parse(localStorage.getItem(k) || 'null');
    if (c && !force && Date.now() - c.at < 864e5) return (App.isSuper = c.v);
    const r = await Relay.call('akun.info', {});
    if (r.success) { localStorage.setItem(k, JSON.stringify({ v: !!r.data.superadmin, at: Date.now() })); App.isSuper = !!r.data.superadmin; }
    return !!App.isSuper;
  };
  App.afterLogin = async (user) => {
    say('Mencari data keluarga…');
    App.checkSuper(true).catch(() => {});
    const remembered = fileFor(user.email);
    try {
      if (remembered) return await openFamily(remembered, user);
    } catch (e) { if (e.notMember) return say(U.esc(e.message), true); localStorage.removeItem('sa:file:' + user.email); }
    let files = [];
    try { files = await Cloud.find(); } catch (e) { return say(U.esc(e.message), true); }
    if (files.length === 1) { try { return await openFamily(files[0].id, user, { fresh: true }); } catch (e) { if (e.notMember) return App.choose(user, [], e.message); return say(U.esc(e.message), true); } }
    App.choose(user, files);
  };

  /** Pilih: file yang ada / buat keluarga baru / saya diundang. */
  App.choose = (user, files, msg) => {
    shell(`<div class="fam-chip">${I('user')}<b>${U.esc(user.email)}</b><button class="link" id="ganti">Ganti akun</button></div>
      ${msg ? `<div class="note warn">${U.esc(msg)}</div>` : ''}
      ${files.length ? `<h2>Pilih data keluarga</h2><div class="card list">${files.map(f => `<button class="row" data-f="${U.esc(f.id)}"><span class="cat-ic">${I('heart-handshake')}</span><div class="tx-txt"><b>${U.esc(f.name.replace(/^SatuAtap – Data /, ''))}</b><small>${U.esc((f.owners && f.owners[0] && f.owners[0].emailAddress) || '')}</small></div>${I('chevron-right')}</button>`).join('')}</div>` : ''}
      <h2>${files.length ? 'Atau' : 'Selamat datang!'}</h2>
      <button class="btn block" id="baru">${I('house')} Buat data keluarga baru <small>(Admin)</small></button>
      <button class="btn block ghost" id="undang">${I('mail-open')} Saya diundang pasangan / keluarga</button>`);
    document.getElementById('ganti').onclick = () => { Auth.forget(); localStorage.removeItem(SESS); App.login(); };
    document.querySelectorAll('[data-f]').forEach(b => b.onclick = async () => { try { await openFamily(b.dataset.f, user, { fresh: true }); } catch (e) { say(U.esc(e.message), true); } });
    document.getElementById('baru').onclick = () => App.create(user);
    document.getElementById('undang').onclick = async () => {
      say('Membuka pemilih file Google…');
      try {
        const id = await Cloud.pick(); if (!id) return say('');
        const meta = await Cloud.meta(id);
        if (!meta.appProperties || meta.appProperties.satuatap !== 'keluarga') return say('File itu bukan data SatuAtap. Pilih file bernama "SatuAtap – Data …" yang dibagikan Admin.', true);
        await openFamily(id, user, { fresh: true });
      } catch (e) { say(U.esc(e.message), true); }
    };
  };

  App.create = async (user) => {
    const sup = await App.checkSuper().catch(() => false);
    shell(`<h2>Buat data keluarga</h2><p class="muted small">File "SatuAtap – Data …" akan dibuat di Google Drive Anda. Anda menjadi Admin dan bisa mengundang hingga 4 anggota.</p>
      <label class="field"><span>Nama keluarga</span><input id="c-fam" maxlength="40" placeholder="mis. Keluarga Dimas & Rini"></label>
      <label class="field"><span>Nama panggilan Anda</span><input id="c-nama" maxlength="30" value="${U.esc(user.nama)}"></label>
      ${Relay.enabled() ? `<label class="field"><span>Kode lisensi${sup ? ' <span class="pill gold">Superadmin</span>' : ''}</span><input id="c-kode" maxlength="24" autocomplete="off" placeholder="${sup ? 'Kosongkan — lisensi internal dibuat otomatis' : 'SA-XXXX-XXXX-XXXX'}" style="text-transform:uppercase"><small>${sup ? 'Akun superadmin JuniorLabs tidak wajib memasukkan kode.' : 'Didapat saat pembelian dari JuniorLabs.'}</small></label>` : ''}
      <button class="btn block" id="c-go">${I('check')} Buat & mulai</button><button class="btn block ghost" id="c-back">Kembali</button>`);
    document.getElementById('c-back').onclick = () => App.afterLogin(user);
    document.getElementById('c-go').onclick = async (ev) => {
      const fam = document.getElementById('c-fam').value.trim(), nama = document.getElementById('c-nama').value.trim() || user.nama;
      const kodeEl = document.getElementById('c-kode'), kode = kodeEl ? kodeEl.value.trim().toUpperCase() : '';
      if (!fam) return say('Isi nama keluarga.', true);
      const internal = !!(kodeEl && sup && !kode);
      if (kodeEl && !internal && !/^SA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(kode)) return say('Format kode lisensi: SA-XXXX-XXXX-XXXX', true);
      ev.target.disabled = true;
      try {
        if (kode) { say('Memeriksa lisensi…'); const c = await Relay.call('lisensi.periksa', { kode }); if (!c.success) throw new Error(c.message || 'Lisensi tidak valid.'); }
        say('Membuat file di Google Drive…');
        const me = { email: user.email, nama };
        const ops = Cloud.seed(fam, me);
        if (kode || internal) ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: 'lisensiAdmin', nilai: user.email } });
        if (kode) ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: 'lisensiKode', nilai: kode.slice(0, 8) + '-••••-••••' } });
        const id = await Cloud.create(fam, ops, me);
        if (kode || internal) {
          say('Mengaktifkan lisensi…');
          const a = await Relay.call('lisensi.aktifkan', { kode, fileId: id, keluarga: fam });
          if (!a.success) throw new Error(a.message || 'Aktivasi gagal.');
          localStorage.setItem('sa:lic:' + id, JSON.stringify({ ok: true, at: Date.now() }));
          if (internal && a.data && a.data.kode) await Cloud.push([{ op: 'upsert', t: 'Pengaturan', row: { id: 'lisensiKode', nilai: a.data.kode.slice(0, 8) + '-••••-••••' } }], user.email);
        }
        await openFamily(id, { email: user.email, nama }, { fresh: true });
        setTimeout(() => UI.toast('Selamat datang! Mulai dengan menambah dompet di Aset › Kas & Bank.', 'ok', { ms: 6000 }), 600);
      } catch (e) { ev.target.disabled = false; say(U.esc(e.message), true); }
    };
  };

  // ---------- Demo ----------
  App.demo = (big) => {
    Store.mode = 'demo'; Store.fileId = 'demo'; Store.backend = DemoServer;
    Store.persist = () => {};
    DemoServer.init(big || /big/.test(location.search));
    Store.me = DemoServer.me(); Auth.email = Store.me.email;
    Store.sync(true).then(() => {
      if (!location.hash || location.hash === '#') location.hash = '#/beranda';
      App.start();
    });
  };
  UI.act('exit-demo', () => { location.href = location.pathname; });

  // ---------- Inisialisasi ----------
  App.init = async () => {
    App.applyTheme();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    const params = new URLSearchParams(location.search);
    if (params.has('demo')) return App.demo(params.get('demo') === 'big');
    if (!APP_CONFIG.GOOGLE_CLIENT_ID) return App.login('Konfigurasi belum lengkap: GOOGLE_CLIENT_ID di js/config.js masih kosong. Mode demo tetap bisa dicoba.');
    if (localStorage.getItem('sa:oauth')) {                     // kembali dari login mode alih-halaman
      shell('<div class="splash-in"><p>Menyambungkan ke Google…</p></div>');
      try { if (await Auth.resume()) { const user = await Auth.userinfo(); const ss = getSess(); if (!(ss && ss.fileId && ss.email === user.email)) return await App.afterLogin(user); } }
      catch (e) { return App.login(e.message); }
    }
    const s = getSess();
    if (!s || !s.fileId || !s.email) return App.login();
    Auth.email = s.email;
    Store.mode = 'live'; Store.fileId = s.fileId; Cloud.fileId = s.fileId; Store.backend = Cloud;
    const had = await Store.loadLocal();
    const m = had && Store.member(s.email);
    if (had && m && m.aktif !== false) {
      Store.me = { id: m.id, nama: m.nama, email: m.email, peran: m.peran, warna: m.warna, izin: m.izin || {} };
      await Priv.loadKey();
      App.start();                                  // tampil instan dari data perangkat
      if (!Relay.enabled()) Auth.loadGIS().catch(() => {});
      Store.sync().then(r => { if (r && r.ok) App.afterSync(); });   // token diperpanjang otomatis bila perlu
      Relay.warm();
      return;
    }
    if (await Auth.ensure()) {
      shell('<div class="splash-in"><p>Memuat data keluarga…</p></div>');
      try { return await openFamily(s.fileId, { email: s.email, nama: s.email.split('@')[0] }, { fresh: true }); }
      catch (e) { return App.login(e.message); }
    }
    App.login();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', App.init); else App.init();
})();
