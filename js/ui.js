/* ============================================================
 * UI — router, kerangka, lembar bawah, toast, komponen bersama
 * ============================================================ */
(function () {
  const UI = { pages: {}, acts: {}, cur: null, param: null, sub: null };
  const $ = (s, r) => (r || document).querySelector(s);
  UI.$ = $;

  // ---------- Ikon (subset Lucide di js/icons.js) ----------
  UI.icon = (n, cls) => {
    const b = (window.ICONS || {})[n] || (window.ICONS || {})['circle'] || '';
    return `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${b}</svg>`;
  };
  const I = UI.icon;

  // ---------- Privasi nominal ----------
  UI.hide = () => localStorage.getItem('sa:hide') === '1';
  UI.toggleHide = () => { localStorage.setItem('sa:hide', UI.hide() ? '0' : '1'); UI.render(); };
  UI.m = (v, opt) => U.rp(v, Object.assign({ hide: UI.hide() }, opt || {}));
  UI.ms = v => UI.hide() ? 'Rp •••' : U.rpShort(v);
  UI.amount = (v, jenis) => {
    const plus = jenis === 'masuk' || jenis === 'pinjam_kembali' || jenis === 'pinjam_terima' || jenis === 'tujuan_ambil';
    const neutral = jenis === 'transfer' || jenis === 'tujuan' || jenis === 'penyesuaian' || jenis === 'aset_beli' || jenis === 'aset_jual';
    return `<span class="amt ${plus ? 'in' : neutral ? 'neu' : 'out'}">${plus ? '+' : neutral ? '' : '−'}${UI.m(Math.abs(v))}</span>`;
  };

  // ---------- Router ----------
  UI.page = (name, def) => { UI.pages[name] = def; };
  UI.act = (name, fn) => { UI.acts[name] = fn; };
  UI.go = (path) => { const h = '#/' + path; if (location.hash === h) UI.route(); else location.hash = h; };
  UI.back = () => { const hd = UI.head(); UI.go(hd && hd.back != null ? hd.back : UI.cur); };
  UI.route = () => {
    if (!App.ready) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    let name = parts[0] || 'beranda';
    if (!UI.pages[name]) name = 'beranda';
    const prev = UI.cur;
    UI.cur = name; UI.param = parts[1] || ''; UI.sub = parts[2] || '';
    UI.render(true);
  };
  UI.render = (scrollTop) => {
    const def = UI.pages[UI.cur]; if (!def) return;
    const view = $('#view');
    const y = window.scrollY;
    try { view.innerHTML = def.render(UI.param, UI.sub); }
    catch (e) { console.error(e); view.innerHTML = UI.empty('triangle-alert', 'Halaman gagal dimuat', U.esc(e.message), '<button class="btn" data-act="reload">Muat ulang</button>'); }
    UI.bindRp(view);
    if (def.after) try { def.after(view, UI.param); } catch (e) { console.error(e); }
    UI.chrome(def);
    if (scrollTop === true && UI._lastRendered !== UI.cur + '/' + UI.param) window.scrollTo(0, 0); else window.scrollTo(0, y);
    UI._lastRendered = UI.cur + '/' + UI.param;
  };
  UI.head = () => { const def = UI.pages[UI.cur]; return def && def.head ? def.head(UI.param, UI.sub) : null; };
  UI.chrome = (def) => {
    const nav = typeof def.nav === 'function' ? def.nav(UI.param) : (def.nav || UI.cur);
    document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('on', a.closest('#sidebar') ? a.dataset.nav === UI.cur : a.dataset.nav === nav));
    const tb = $('#topbar');
    const fam = Store.setting('namaKeluarga', 'Keluarga');
    const hd = UI.head();
    if (hd) {
      tb.innerHTML = `<button class="icon-btn" data-act="back" aria-label="Kembali">${I('arrow-left')}</button>
        <div class="tb-title">${hd.crumb ? `<div class="tb-crumb">${U.esc(hd.crumb)}</div>` : ''}<h1>${U.esc(hd.title)}</h1></div>
        <div class="tb-actions">${authChip()}${hd.right || ''}</div>`;
    } else {
      tb.innerHTML = `<div class="brand" data-act="go" data-to="beranda"><img src="img/icon-192.png" alt="" width="34" height="34"><div><b>SatuAtap</b><span class="fam"><i class="dot ${Store.mode === 'demo' ? 'demo' : (UI.netOk ? 'ok' : 'off')}"></i>${U.esc(fam)}</span></div></div>
        <div class="tb-actions">${authChip()}<button class="icon-btn" data-act="toggle-hide" aria-label="Sembunyikan nominal">${I(UI.hide() ? 'eye-off' : 'eye')}</button>
        <button class="avatar sm${UI.foto(Store.me && Store.me.email) ? ' has-foto' : ''}" style="background:${(Store.me && Store.me.warna) || '#0F5E59'}${UI.foto(Store.me && Store.me.email) ? `;background-image:url('${UI.foto(Store.me.email)}')` : ''}" data-act="go" data-to="pengaturan" aria-label="Profil">${UI.foto(Store.me && Store.me.email) ? '' : U.esc(U.initials(Store.me && Store.me.nama))}</button></div>`;
    }
    $('#fab').hidden = !!def.noFab;
    $('#demo-banner').hidden = Store.mode !== 'demo';
    document.title = (hd ? hd.title + ' · ' : '') + 'SatuAtap';
  };
  const authChip = () => UI._auth ? `<button class="chip warn auth-chip" data-act="reauth" title="Sesi Google berakhir — ketuk untuk sinkron">${I('refresh-cw')} Sinkronkan</button>` : '';
  UI.authState = on => { if (!!UI._auth === !!on) return; UI._auth = !!on; if (App.ready && UI.pages[UI.cur]) UI.chrome(UI.pages[UI.cur]); };
  UI.netOk = true;
  UI.netState = ok => { if (UI.netOk !== ok) { UI.netOk = ok; const d = $('.brand .dot'); if (d) d.className = 'dot ' + (ok ? 'ok' : 'off'); } };

  // ---------- Kerangka aplikasi ----------
  const NAV = [['beranda', 'house', 'Beranda'], ['mutasi', 'arrow-left-right', 'Mutasi'], ['kalender', 'calendar-days', 'Kalender'],
               ['aset', 'wallet', 'Aset'], ['rapor', 'chart-column', 'Rapor'], ['lainnya', 'menu', 'Lainnya']];
  const SIDE = [['beranda', 'house', 'Beranda'], ['mutasi', 'arrow-left-right', 'Mutasi'], ['kalender', 'calendar-days', 'Kalender'], ['aset', 'wallet', 'Aset'],
    ['rapor', 'chart-column', 'Rapor'], null, ['tujuan', 'target', 'Tujuan'], ['anggaran', 'clipboard-list', 'Anggaran'], ['zakat', 'hand-heart', 'Zakat & Sedekah'], ['rapat', 'users', 'Rapat Keuangan'], null,
    ['ai', 'sparkles', 'Tanya AI'], ['simulasi', 'git-fork', 'Simulasi Keputusan'], null, ['pengaturan', 'settings', 'Pengaturan'], ['laporan', 'message-square-warning', 'Laporkan Masalah']];
  UI.shell = () => {
    document.body.innerHTML = `
      <div id="demo-banner" class="demo-banner" hidden>${I('flask-conical')} Mode demo — data contoh, perubahan tidak disimpan. <button class="link" data-act="exit-demo">Keluar demo</button></div>
      <div id="shell">
        <aside id="sidebar"><div class="side-brand"><img src="img/icon-192.png" alt="" width="36" height="36"><div><b>SatuAtap</b><small>Keuangan Keluarga</small></div></div>
          <div class="side-fam">${I('users')}<span>${U.esc(Store.setting('namaKeluarga', 'Keluarga'))}</span></div>
          <nav>${SIDE.map(s => s ? `<a href="#/${s[0]}" data-nav="${s[0].split('/')[0]}">${I(s[1])}<span>${s[2]}</span></a>` : '<hr>').join('')}</nav>
          <button class="side-fab" data-act="catat">${I('plus')} Catat Cepat</button>
          <div class="side-me">${U.esc(Store.me ? Store.me.nama : '')}<small>${U.esc(Store.me ? Store.me.email : '')}</small></div>
        </aside>
        <main id="main"><header id="topbar"></header><div id="view" class="view"></div></main>
      </div>
      <button id="fab" class="fab" data-act="catat" aria-label="Catat cepat (tahan untuk bicara)">${I('plus')}</button>
      <nav id="bottomnav">${NAV.map(n => `<a href="#/${n[0]}" data-nav="${n[0]}">${I(n[1])}<span>${n[2]}</span></a>`).join('')}</nav>
      <div id="sheet-root"></div><div id="toast-root" aria-live="polite"></div>`;
    UI.bindGlobal();
  };

  // ---------- Event delegation ----------
  UI.bindGlobal = () => {
    if (UI._bound) return; UI._bound = true;
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if (!el || el.disabled) return;
      const fn = UI.acts[el.dataset.act];
      if (fn) { e.preventDefault(); fn(el, e); }
    });
    document.addEventListener('change', e => {
      const el = e.target.closest('[data-change]');
      if (el && UI.acts[el.dataset.change]) UI.acts[el.dataset.change](el, e);
    });
    document.addEventListener('input', e => {
      const el = e.target.closest('[data-input]');
      if (el && UI.acts[el.dataset.input]) UI.acts[el.dataset.input](el, e);
    });
    window.addEventListener('hashchange', UI.route);
    // Tahan tombol + untuk bicara
    let holdT = null, held = false;
    document.addEventListener('pointerdown', e => {
      const f = e.target.closest('#fab'); if (!f) return;
      held = false; holdT = setTimeout(() => { held = true; UI.voiceCatat(); }, 550);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => document.addEventListener(t, () => { clearTimeout(holdT); }));
    document.addEventListener('click', e => { if (held && e.target.closest('#fab')) { e.stopImmediatePropagation(); e.preventDefault(); held = false; } }, true);
  };
  UI.act('go', el => UI.go(el.dataset.to));
  UI.act('back', () => UI.back());
  UI.act('toggle-hide', () => UI.toggleHide());
  UI.act('reload', () => location.reload());

  // ---------- Toast ----------
  UI.toast = (msg, type, opt) => {
    const root = $('#toast-root'); if (!root) { alert(msg); return; }
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.innerHTML = `${I(type === 'error' ? 'circle-alert' : type === 'warn' ? 'triangle-alert' : 'circle-check')}<span>${U.esc(msg)}</span>${opt && opt.undo ? '<button class="link">Urungkan</button>' : ''}`;
    if (opt && opt.undo) t.querySelector('button').onclick = () => { opt.undo(); t.remove(); };
    root.appendChild(t);
    setTimeout(() => t.classList.add('show'), 10);
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, (opt && opt.ms) || 3200);
  };

  // ---------- Lembar bawah (sheet) ----------
  UI.sheet = (opt) => {
    const root = $('#sheet-root');
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `<div class="sheet-bg"></div><div class="sheet ${opt.cls || ''}" role="dialog" aria-modal="true" aria-label="${U.esc(opt.title || '')}">
      <div class="sheet-grip"><div class="sheet-handle"></div><div class="sheet-head"><h2>${U.esc(opt.title || '')}</h2><button class="icon-btn" data-close aria-label="Tutup">${I('x')}</button></div></div>
      <div class="sheet-body">${opt.body || ''}</div>${opt.foot ? `<div class="sheet-foot">${opt.foot}</div>` : ''}</div>`;
    root.appendChild(wrap);
    document.body.classList.add('noscroll');
    requestAnimationFrame(() => wrap.classList.add('show'));
    const close = () => {
      wrap.classList.remove('show');
      setTimeout(() => { wrap.remove(); if (!root.children.length) document.body.classList.remove('noscroll'); }, 220);
      opt.onClose && opt.onClose();
    };
    wrap.querySelector('.sheet-bg').onclick = close;
    wrap.querySelector('[data-close]').onclick = close;
    const el = wrap.querySelector('.sheet');
    el.close = close;
    dragToClose(el, wrap, close);
    opt.mount && opt.mount(el, close);
    return { el, close };
  };
  /** Geser lembar ke bawah untuk menutup — dari pegangan/judul, atau dari isi saat sudah di posisi paling atas. */
  function dragToClose(el, wrap, close) {
    const body = el.querySelector('.sheet-body'), bg = wrap.querySelector('.sheet-bg');
    let y0 = 0, x0 = 0, dy = 0, t0 = 0, active = false, armed = false, fromBody = false;
    const desktop = () => window.matchMedia('(min-width: 720px)').matches;
    el.addEventListener('touchstart', e => {
      if (desktop() || e.touches.length !== 1) return;
      const tgt = e.target;
      if (tgt.closest('input, textarea, select, [data-rp], .keypad, input[type=range], .env-drag, .swipe')) return;
      fromBody = !tgt.closest('.sheet-grip');
      if (fromBody && body.scrollTop > 0) return;
      armed = true; active = false; y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; dy = 0; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!armed) return;
      const my = e.touches[0].clientY - y0, mx = e.touches[0].clientX - x0;
      if (!active) {
        if (my > 8 && my > Math.abs(mx) * 1.2 && (!fromBody || body.scrollTop <= 0)) { active = true; el.classList.add('dragging'); }
        else if (my < -4 || Math.abs(mx) > 12) { armed = false; return; }
        else return;
      }
      dy = Math.max(0, my);
      e.preventDefault();
      el.style.transform = `translateY(${dy}px)`;
      bg.style.opacity = String(Math.max(0.15, 1 - dy / (el.offsetHeight || 600)));
    }, { passive: false });
    const end = () => {
      if (!armed) return; armed = false;
      if (!active) return; active = false;
      el.classList.remove('dragging');
      const v = dy / Math.max(1, Date.now() - t0);
      if (dy > Math.min(140, el.offsetHeight * 0.25) || v > 0.6) { el.style.transition = 'transform .18s ease-in'; el.style.transform = 'translateY(100%)'; setTimeout(close, 120); }
      else { el.style.transform = ''; bg.style.opacity = ''; }
    };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  }
  UI.confirm = (title, text, okLabel, danger) => new Promise(res => {
    const s = UI.sheet({ title, body: `<p class="muted" style="white-space:pre-line">${U.esc(text)}</p>`, foot: `<button class="btn ghost" data-no>Batal</button><button class="btn ${danger ? 'danger' : ''}" data-yes>${U.esc(okLabel || 'Ya')}</button>`,
      onClose: () => res(false) });
    s.el.querySelector('[data-no]').onclick = () => { s.close(); };
    s.el.querySelector('[data-yes]').onclick = () => { res(true); s.close(); };
  });

  /** Baca nilai form di dalam elemen (name=...). */
  UI.formData = (el) => {
    const o = {};
    el.querySelectorAll('[name]').forEach(f => {
      if (f.type === 'checkbox') o[f.name] = f.checked;
      else if (f.type === 'radio') { if (f.checked) o[f.name] = f.value; }
      else if (f.dataset.rp !== undefined) o[f.name] = U.parseRp(f.value);
      else o[f.name] = f.value.trim();
    });
    return o;
  };
  /** Input rupiah dengan pemisah ribuan otomatis */
  UI.bindRp = (root) => root.querySelectorAll('[data-rp]').forEach(inp => {
    const fmt = () => { const n = U.parseRp(inp.value); inp.value = n ? U.fmtNum(n) : ''; };
    inp.addEventListener('input', () => { const pos = inp.value.length - inp.selectionStart; fmt(); const p = Math.max(0, inp.value.length - pos); try { inp.setSelectionRange(p, p); } catch (e) {} });
    fmt();
  });

  // ---------- Komponen ----------
  UI.empty = (ic, title, text, btn) => `<div class="empty">${I(ic, 'big')}<h3>${U.esc(title)}</h3>${text ? `<p>${text}</p>` : ''}${btn || ''}</div>`;
  UI.pill = (text, kind) => `<span class="pill ${kind || ''}">${U.esc(text)}</span>`;
  UI.bar = (pct, status) => `<div class="bar ${status || ''}"><i style="width:${U.clamp(pct * 100, 0, 100).toFixed(1)}%"></i></div>`;
  /** Avatar: foto profil bila ada, selain itu inisial berwarna. */
  UI.foto = email => { const m = email && Store.member && Store.member(email), f = (m && m.foto) || ''; return f.indexOf('ava:') === 0 ? UI.avatarSvg(f.slice(4)) : f; };
  // ---------- Template avatar (ilustrasi SVG buatan sendiri, ringan & tanpa unggah foto) ----------
  const KULIT = ['#F6D3B8', '#EBB894', '#D39A6C', '#A9714B', '#7E5236'];
  const RAMBUT = ['#2B2420', '#4A3123', '#7A4B2A', '#C9A27A', '#9A9A9A'];
  const LATAR = ['#CFEDE8', '#FCE7C2', '#DCE6FB', '#F6D8DE', '#E3DBF6', '#D9EFD3', '#F3E2D3', '#D6E9F2'];
  const BAJU = ['#0F5E59', '#E0A23A', '#3D7FC2', '#C2553D', '#7A5CC0', '#2E8C84', '#5B7A78', '#B04A7A'];
  // [gaya rambut, kulit, rambut, latar, baju, aksesori]
  UI.AVATAR = [['pendek', 1, 0, 0, 0, ''], ['hijab', 0, 0, 1, 1, ''], ['panjang', 0, 1, 3, 4, ''], ['botak', 2, 0, 2, 2, 'janggut'], ['keriting', 3, 0, 4, 3, ''], ['hijab', 2, 0, 5, 5, 'kacamata'],
    ['cepol', 1, 2, 6, 7, ''], ['pendek', 3, 0, 7, 6, 'kacamata'], ['peci', 2, 0, 0, 0, ''], ['panjang', 1, 3, 1, 3, ''], ['hijab', 4, 0, 2, 6, ''], ['pendek', 0, 4, 6, 2, 'kacamata'],
    ['anak', 0, 1, 3, 1, ''], ['kuncir', 1, 0, 5, 4, ''], ['keriting', 1, 1, 0, 7, 'kacamata'], ['botak', 4, 4, 1, 5, 'kumis']];
  const AVA_CACHE = {};
  UI.avatarSvg = (i) => {
    if (AVA_CACHE[i]) return AVA_CACHE[i];
    const a = UI.AVATAR[Number(i)] || UI.AVATAR[0], g = a[0], k = KULIT[a[1]], r = RAMBUT[a[2]], bg = LATAR[a[3]], b = BAJU[a[4]], x = a[5];
    const hijabWarna = ['#0F5E59', '#E0A23A', '#7A5CC0', '#C2553D', '#3D7FC2', '#2E8C84', '#B04A7A', '#5B7A78'][a[3]];
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${bg}"/>`;
    const kecil = g === 'anak';
    if (g === 'panjang' || g === 'kuncir') s += `<path d="M18 30c0-11 6-17 14-17s14 6 14 17v${g === 'panjang' ? 18 : 6}h-6V31H24v${g === 'panjang' ? 17 : 5}h-6z" fill="${r}"/>`;
    if (g === 'kuncir') s += `<circle cx="47" cy="22" r="5" fill="${r}"/>`;
    if (g === 'hijab') s += `<path d="M13 64V42c0-17 8-28 19-28s19 11 19 28v22z" fill="${hijabWarna}"/>`;
    s += `<path d="M10 64c1-11 10-17 22-17s21 6 22 17z" fill="${g === 'hijab' ? hijabWarna : b}"/>`;
    if (g !== 'hijab') s += `<rect x="27" y="38" width="10" height="10" rx="4" fill="${k}" opacity=".92"/>`;
    s += `<ellipse cx="32" cy="${kecil ? 31 : 29}" rx="${kecil ? 11 : 12}" ry="${kecil ? 12 : 13.5}" fill="${k}"/>`;
    if (g === 'hijab') s += `<path d="M18.5 30c0-10 6-16.5 13.5-16.5S45.5 20 45.5 30c-2-6-7-9.5-13.5-9.5S20.5 24 18.5 30z" fill="${hijabWarna}"/><path d="M19 33c1 8 6 13 13 13s12-5 13-13" fill="none" stroke="${hijabWarna}" stroke-width="2.5"/>`;
    if (g === 'pendek' || g === 'anak') s += `<path d="M20 ${kecil ? 29 : 27}c0-9 5-14 12-14s12 5 12 14c-3-5-7-7-12-7-4 0-6 2-8 4-1-1-3 0-4 3z" fill="${r}"/>`;
    if (g === 'panjang' || g === 'kuncir') s += `<path d="M20 28c0-9 5-14 12-14s12 5 12 14c-4-4-8-7-14-7-4 0-7 2-10 7z" fill="${r}"/>`;
    if (g === 'keriting') s += [[22, 20], [27, 16], [33, 15], [39, 17], [43, 22], [20, 26], [44, 27]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="5" fill="${r}"/>`).join('');
    if (g === 'cepol') s += `<circle cx="32" cy="12" r="6" fill="${r}"/><path d="M20 28c0-9 5-13.5 12-13.5S44 19 44 28c-3-5-7-7-12-7s-9 2-12 7z" fill="${r}"/>`;
    if (g === 'peci') s += `<path d="M20.5 22c0-5 5-8 11.5-8s11.5 3 11.5 8v3h-23z" fill="#22201E"/><rect x="20.5" y="23" width="23" height="2" fill="#3a3632"/>`;
    if (g === 'botak') s += `<path d="M21 24c2-6 6-9 11-9s9 3 11 9c-3-2-6-3-11-3s-8 1-11 3z" fill="${r}" opacity=".35"/>`;
    const ey = kecil ? 31 : 29;
    s += `<circle cx="27.5" cy="${ey}" r="1.7" fill="#2b2420"/><circle cx="36.5" cy="${ey}" r="1.7" fill="#2b2420"/>`;
    s += `<path d="M28.5 ${ey + 6}q3.5 3 7 0" fill="none" stroke="#7a3b2e" stroke-width="1.6" stroke-linecap="round"/>`;
    s += `<circle cx="24.5" cy="${ey + 4}" r="2" fill="#E88B7A" opacity=".35"/><circle cx="39.5" cy="${ey + 4}" r="2" fill="#E88B7A" opacity=".35"/>`;
    if (x === 'kacamata') s += `<g fill="none" stroke="#2b2420" stroke-width="1.3"><circle cx="27.5" cy="${ey}" r="4"/><circle cx="36.5" cy="${ey}" r="4"/><path d="M31.5 ${ey}h1"/></g>`;
    if (x === 'janggut') s += `<path d="M21 33c1 9 5 14 11 14s10-5 11-14c-2 4-5 6-11 6s-9-2-11-6z" fill="${r}"/><path d="M28.5 ${ey + 6}q3.5 2.5 7 0" fill="none" stroke="#f3e3d6" stroke-width="1.4" stroke-linecap="round"/>`;
    if (x === 'kumis') s += `<path d="M27 ${ey + 4.5}q5-2.5 10 0q-5 1.5-10 0z" fill="${r}"/>`;
    s += '</svg>';
    return (AVA_CACHE[i] = 'data:image/svg+xml;utf8,' + encodeURIComponent(s));
  };
  UI.avaHtml = (email, nama, warna, cls, extra) => { const f = UI.foto(email);
    return `<span class="avatar ${cls || ''}${f ? ' has-foto' : ''}" style="background:${warna || '#5b7a78'}${f ? `;background-image:url('${f}')` : ''}" ${extra || ''}>${f ? '' : U.esc(U.initials(nama))}</span>`; };
  UI.avatar = (email, sm) => { const m = Store.member(email); const n = m ? m.nama : Store.memberName(email); return UI.avaHtml(email, n, m && m.warna, sm ? 'xs' : ''); };
  UI.tiles = (items, active, cls) => `<div class="tiles ${cls || ''}">${items.map(t => `
    <button class="tile ${t.id === active ? 'on' : ''} ${t.gold ? 'gold' : ''} ${t.soon ? 'soon' : ''}" ${t.to ? `data-act="go" data-to="${t.to}"` : `data-act="${t.act || ''}" data-id="${t.id}"`}>
      <span class="tile-ic">${I(t.icon)}</span><span class="tile-lb">${U.esc(t.label)}</span>${t.sub ? `<span class="tile-sub">${U.esc(t.sub)}</span>` : ''}${t.soon ? '<span class="tile-badge">Segera</span>' : t.badge ? `<span class="tile-badge new">${U.esc(t.badge)}</span>` : ''}
    </button>`).join('')}</div>`;
  UI.sec = (title, right) => `<div class="sec-head"><h2>${title}</h2>${right || ''}</div>`;
  UI.katIcon = (k, cls) => `<span class="cat-ic ${cls || ''}">${I((k && k.ikon) || 'circle-dot')}</span>`;
  UI.walletOpts = (sel, all) => Store.wallets(all).map(w => `<option value="${w.id}" ${w.id === sel ? 'selected' : ''}>${U.esc(w.nama)}</option>`).join('');
  UI.katOpts = (jenis, sel) => Store.kategori(jenis).map(k => `<option value="${k.id}" ${k.id === sel ? 'selected' : ''}>${U.esc(k.nama)}</option>`).join('');
  UI.memberOpts = (sel) => Store.members().map(m => `<option value="${m.email}" ${m.email === sel ? 'selected' : ''}>${U.esc(m.nama)}</option>`).join('');
  UI.field = (label, input, hint) => `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ''}</label>`;
  UI.rpInput = (name, val, ph) => `<div class="rp-input"><b>Rp</b><input name="${name}" data-rp inputmode="numeric" autocomplete="off" value="${val ? U.fmtNum(val) : ''}" placeholder="${ph || '0'}"></div>`;
  UI.seg = (name, opts, val) => `<div class="seg" role="radiogroup">${opts.map(o => `<label><input type="radio" name="${name}" value="${o[0]}" ${o[0] === val ? 'checked' : ''}><span>${U.esc(o[1])}</span></label>`).join('')}</div>`;

  UI.ICON_PILIHAN = ['utensils', 'shopping-cart', 'car', 'zap', 'graduation-cap', 'heart-pulse', 'house', 'landmark', 'users', 'coffee', 'tv', 'shopping-bag', 'hand-heart', 'receipt',
    'circle-dot', 'banknote', 'gift', 'briefcase', 'circle-plus', 'lock', 'baby', 'plane', 'shirt', 'smartphone', 'wifi', 'fuel', 'dumbbell', 'paw-print', 'wrench', 'book-open', 'piggy-bank', 'shield', 'laptop', 'moon-star'];
  window.UI = UI;
})();

/* ---------- Kartu geser layar penuh (Kilas Balik, Mode presentasi Rapat) ---------- */
(function () {
  const I = UI.icon;
  /** cards: [{html, cls}] · opt: {mulai, onClose, akhir:'Selesai', onAkhir} */
  UI.slides = (cards, opt) => {
    opt = opt || {};
    const w = document.createElement('div');
    w.className = 'slides-wrap'; w.setAttribute('role', 'dialog'); w.setAttribute('aria-modal', 'true');
    w.innerHTML = `<div class="slides-top"><div class="slides-dots">${cards.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>
        <button class="icon-btn" data-x aria-label="Tutup">${I('x')}</button></div>
      <div class="slides" tabindex="0">${cards.map((c, i) => `<section class="slide ${c.cls || ''}" aria-label="Kartu ${i + 1} dari ${cards.length}"><div class="slide-in">${c.html}</div></section>`).join('')}</div>
      <div class="slides-nav"><button class="btn ghost" data-prev aria-label="Sebelumnya">${I('chevron-left')}</button><small></small><button class="btn" data-next></button></div>`;
    document.body.appendChild(w);
    document.body.classList.add('no-scroll');
    const sc = w.querySelector('.slides'), dots = [...w.querySelectorAll('.slides-dots i')], cnt = w.querySelector('.slides-nav small'), nx = w.querySelector('[data-next]'), pv = w.querySelector('[data-prev]');
    let cur = 0;
    const upd = () => {
      cur = Math.round(sc.scrollLeft / Math.max(1, sc.clientWidth));
      dots.forEach((d, i) => d.classList.toggle('on', i <= cur));
      cnt.textContent = (cur + 1) + ' / ' + cards.length;
      pv.disabled = cur === 0;
      nx.innerHTML = cur >= cards.length - 1 ? (opt.akhir || 'Selesai') + ' ' + I('check') : 'Lanjut ' + I('chevron-right');
    };
    const go = i => sc.scrollTo({ left: U.clamp(i, 0, cards.length - 1) * sc.clientWidth, behavior: 'smooth' });
    const close = () => { w.remove(); document.body.classList.remove('no-scroll'); document.removeEventListener('keydown', key); opt.onClose && opt.onClose(); };
    const key = e => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1); };
    let t; sc.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(upd, 60); }, { passive: true });
    nx.onclick = () => { if (cur >= cards.length - 1) { if (opt.onAkhir) opt.onAkhir(); close(); } else go(cur + 1); };
    pv.onclick = () => go(cur - 1);
    w.querySelector('[data-x]').onclick = close;
    dots.forEach((d, i) => d.onclick = () => go(i));
    document.addEventListener('keydown', key);
    w.addEventListener('click', e => { if (e.target.closest('[data-act]') && e.target.closest('[data-tutup]')) close(); });
    requestAnimationFrame(() => { if (opt.mulai) sc.scrollLeft = opt.mulai * sc.clientWidth; upd(); sc.focus({ preventScroll: true }); });
    return { el: w, close, go };
  };
})();
