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
        <button class="avatar sm" style="background:${(Store.me && Store.me.warna) || '#0F5E59'}" data-act="go" data-to="pengaturan" aria-label="Profil">${U.esc(U.initials(Store.me && Store.me.nama))}</button></div>`;
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
    ['rapor', 'chart-column', 'Rapor'], null, ['anggaran', 'clipboard-list', 'Anggaran'], ['tujuan', 'target', 'Tujuan'], ['utang', 'scale', 'Utang & Piutang'],
    ['soon/zakat', 'hand-heart', 'Zakat'], ['soon/rapat', 'users', 'Rapat Keuangan'], null, ['pengaturan', 'settings', 'Pengaturan'], ['laporan', 'message-square-warning', 'Laporkan Masalah']];
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
    const s = UI.sheet({ title, body: `<p class="muted">${U.esc(text)}</p>`, foot: `<button class="btn ghost" data-no>Batal</button><button class="btn ${danger ? 'danger' : ''}" data-yes>${U.esc(okLabel || 'Ya')}</button>`,
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
  UI.avatar = (email, sm) => { const m = Store.member(email); const n = m ? m.nama : Store.memberName(email); return `<span class="avatar ${sm ? 'xs' : ''}" style="background:${m && m.warna || '#5b7a78'}">${U.esc(U.initials(n))}</span>`; };
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
