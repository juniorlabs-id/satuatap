/* Anggaran — amplop per kategori, bagi gaji, geser dana, tagihan tahunan, uang pribadi */
(function () {
  const I = UI.icon;
  const A = { off: 0 };
  const per = () => Calc.periodShift(Calc.period(), A.off);
  const KEL = { kebutuhan: 'Kebutuhan', keinginan: 'Keinginan', tabungan: 'Tabungan' };

  // ---------- Ubah amplop ----------
  UI.envForm = (k) => {
    const s = UI.sheet({ title: 'Amplop · ' + k.nama, cls: 'small', body: `
      ${UI.field('Batas per periode', UI.rpInput('batas', k.batas), '0 = tanpa batas (tidak dianggarkan)')}
      ${UI.field('Kelompok', `<select name="kelompok">${Object.keys(KEL).filter(x => x !== 'tabungan').map(x => `<option value="${x}" ${k.kelompok === x ? 'selected' : ''}>${KEL[x]}</option>`).join('')}</select>`)}
      <label class="check"><input type="checkbox" name="bawaSisa" ${k.bawaSisa ? 'checked' : ''}><span>Sisa bulan ini dibawa ke periode berikutnya</span></label>
      <label class="check"><input type="checkbox" name="tetap" ${k.tetap ? 'checked' : ''}><span>Pengeluaran tetap (tagihan) — tidak dihitung di "aman dibelanjakan"</span></label>`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => { Store.upsert('Kategori', Object.assign({ id: k.id }, UI.formData(s.el))); s.close(); UI.toast('Amplop diperbarui.'); };
  };
  UI.act('env-edit', el => { const k = Store.byId.Kategori[el.dataset.id]; if (!k) return; if (!Store.can('anggaran', 'ubah')) return UI.toast('Hanya bisa melihat.', 'warn'); UI.envForm(k); });

  UI.geserForm = (dari, ke) => {
    if (!Store.can('anggaran', 'ubah')) return UI.toast('Hanya bisa melihat.', 'warn');
    const p = per(), env = Calc.envelopes(p).filter(e => e.efektif > 0 || e.batas > 0);
    const opts = (sel, ex) => Calc.envelopes(p).filter(e => e.k.id !== ex).map(e => `<option value="${e.k.id}" ${e.k.id === sel ? 'selected' : ''}>${U.esc(e.k.nama)} — sisa ${U.rpShort(e.sisa)}</option>`).join('');
    const src = env.find(e => e.k.id === dari);
    const s = UI.sheet({ title: 'Geser dana antar amplop', cls: 'small', body: `
      <p class="muted">Periode ${U.esc(p.label)}. Batas awal tidak berubah — hanya dipindah untuk periode ini.</p>
      ${UI.field('Dari amplop', `<select name="dari">${opts(dari)}</select>`)}
      ${UI.field('Ke amplop', `<select name="ke">${opts(ke || '', '')}</select>`)}
      ${UI.field('Jumlah', UI.rpInput('jumlah', src ? Math.max(0, Math.min(src.sisa, 100000)) : 0))}
      ${UI.field('Alasan (opsional)', `<input name="catatan" maxlength="80" placeholder="mis. jajan lebih untuk ultah">`)}`,
      foot: `<button class="btn" data-ok>${I('move-right')} Geser</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (!f.jumlah || f.dari === f.ke) return UI.toast('Pilih dua amplop berbeda dan isi jumlah.', 'warn');
      const e = Calc.envelopes(p).find(x => x.k.id === f.dari);
      if (e && f.jumlah > Math.max(0, e.sisa)) return UI.toast('Sisa amplop asal hanya ' + U.rp(Math.max(0, e.sisa)) + '.', 'warn');
      Store.upsert('GeserDana', { id: U.uid('g'), tanggal: U.today(), periode: p.key, dari: f.dari, ke: f.ke, jumlah: f.jumlah, catatan: f.catatan });
      s.close(); UI.toast('Dana digeser ' + U.rp(f.jumlah) + '.');
    };
  };
  UI.act('geser', () => UI.geserForm());
  UI.act('ang-shift', el => { A.off += Number(el.dataset.d); UI.render(); });

  // ---------- Seret amplop ke amplop lain ----------
  (function drag() {
    let src = null, ghost = null, over = null, t = null, sx = 0, sy = 0, live = false;
    document.addEventListener('pointerdown', e => {
      const h = e.target.closest('.env-drag'); if (!h) return;
      src = h.closest('.env'); sx = e.clientX; sy = e.clientY; live = false;
      t = setTimeout(() => start(e), 180);
    });
    function start(e) {
      if (!src) return; live = true;
      ghost = src.cloneNode(true); ghost.classList.add('env-ghost');
      ghost.style.width = src.offsetWidth + 'px';
      document.body.appendChild(ghost); move(e);
      src.classList.add('dragging');
      if (navigator.vibrate) navigator.vibrate(15);
    }
    function move(e) {
      if (!ghost) return;
      ghost.style.transform = `translate(${e.clientX - 40}px, ${e.clientY - 30}px)`;
      if (e.clientY < 110) window.scrollBy(0, -14); else if (e.clientY > innerHeight - 140) window.scrollBy(0, 14);
      ghost.style.display = 'none';
      const el = document.elementFromPoint(e.clientX, e.clientY);
      ghost.style.display = '';
      const tgt = el && el.closest('.env');
      if (over && over !== tgt) over.classList.remove('drop');
      over = tgt && tgt !== src ? tgt : null;
      if (over) over.classList.add('drop');
    }
    document.addEventListener('pointermove', e => {
      if (!src) return;
      if (!live) { if (Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { clearTimeout(t); start(e); } return; }
      e.preventDefault(); move(e);
    }, { passive: false });
    const end = () => {
      clearTimeout(t);
      if (!src) return;
      const a = src.dataset.id, b = over && over.dataset.id, wasLive = live;
      src.classList.remove('dragging'); if (over) over.classList.remove('drop');
      if (ghost) ghost.remove();
      src = ghost = over = null; live = false;
      if (wasLive) { UI._swiped = Date.now(); if (b) UI.geserForm(a, b); else UI.toast('Lepaskan di atas amplop lain untuk menggeser dana.', 'warn'); }
    };
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  })();

  const envCard = (e, priv) => `<div class="env ${e.status}" data-id="${e.k.id}">
      <button class="env-drag" aria-label="Seret ke amplop lain">${I('grip-vertical')}</button>
      <div class="env-main" data-act="env-edit" data-id="${e.k.id}">
        <div class="row-sp"><span class="env-t"><span class="cat-ic sm">${I(e.k.ikon || 'circle-dot')}</span><b>${U.esc(e.k.nama)}</b>${e.k.bawaSisa ? `<i title="Sisa dibawa">${I('redo-2')}</i>` : ''}</span>
          <span class="env-s ${e.status}">${e.sisa < 0 ? 'Lewat ' + UI.ms(-e.sisa) : 'Sisa ' + UI.ms(e.sisa)}</span></div>
        ${UI.bar(e.pct, e.status)}
        <small class="muted">${UI.ms(e.terpakai)} dari ${UI.ms(e.efektif)}${e.carry ? ' (termasuk sisa lalu ' + UI.ms(e.carry) + ')' : ''}${e.efektif !== e.batas + e.carry ? ' · digeser ' + (e.efektif - e.batas - e.carry > 0 ? '+' : '−') + UI.ms(Math.abs(e.efektif - e.batas - e.carry)) : ''}${priv ? ' · detail pribadi' : ''}</small>
      </div></div>`;

  const TILES = (cur) => UI.tiles([
    { id: '', icon: 'mail', label: 'Amplop', to: 'anggaran' },
    { id: 'bagi', icon: 'split', label: 'Bagi Gaji', to: 'anggaran/bagi' },
    { id: 'geser', icon: 'move-horizontal', label: 'Geser Dana', to: 'anggaran/geser' },
    { id: 'sinking', icon: 'calendar-clock', label: 'Tagihan Tahunan', to: 'anggaran/sinking' },
    { id: 'pribadi', icon: 'lock', label: 'Uang Pribadi', to: 'anggaran/pribadi' },
    { id: 'kat', icon: 'tags', label: 'Kategori', to: 'pengaturan/kategori' },
    { id: 'tujuan', icon: 'target', label: 'Tujuan', to: 'tujuan' },
    { id: 'periode', icon: 'calendar-cog', label: 'Atur Periode', to: 'pengaturan/keluarga' }
  ], cur);

  UI.page('anggaran', {
    head: p => ({ title: { bagi: 'Bagi Gaji', geser: 'Riwayat Geser Dana', sinking: 'Tagihan Tahunan Dicicil', pribadi: 'Uang Pribadi' }[p] || 'Anggaran', crumb: p ? 'Anggaran' : 'Lainnya', back: p ? 'anggaran' : 'lainnya' }),
    nav: () => 'lainnya',
    render(p) {
      if (!Store.can('anggaran', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Anggaran.');
      if (p === 'bagi') return bagi();
      if (p === 'geser') return geserList();
      if (p === 'sinking') return sinking();
      if (p === 'pribadi') return pribadi();
      const pp = per(), env = Calc.envelopes(pp), safe = Calc.safeDaily(), un = Calc.unallocated(pp);
      const me = Store.me.email;
      const vis = env.filter(e => e.efektif > 0 || e.terpakai > 0);
      const budgeted = vis.filter(e => e.efektif > 0), none = vis.filter(e => !e.efektif);
      const g = U.groupBy(budgeted, e => e.k.pribadi ? 'pribadi' : (e.k.kelompok || 'kebutuhan'));
      const totB = U.sum(budgeted, e => e.efektif), totU = U.sum(budgeted, e => e.terpakai);
      return `${TILES('')}
        <div class="period-nav"><button class="icon-btn" data-act="ang-shift" data-d="-1">${I('chevron-left')}</button><span class="period-lb">${U.esc(pp.label)}</span><button class="icon-btn" data-act="ang-shift" data-d="1">${I('chevron-right')}</button></div>
        ${A.off === 0 ? `<section class="hero card-primary compact"><div class="hero-safe"><div><small>Aman dibelanjakan / hari</small><b class="xl">${UI.m(safe.perHari)}</b><small>${safe.hari} hari tersisa · dari sisa amplop ${UI.ms(safe.sisa)}</small></div></div></section>` : ''}
        ${un.income > 0 ? `<div class="alert ${un.sisa > 0 ? 'info' : un.sisa < 0 ? 'warn' : 'ok'}" data-act="go" data-to="anggaran/bagi">${I(un.sisa === 0 ? 'circle-check' : 'coins')}<div><b>${un.sisa > 0 ? UI.m(un.sisa) + ' belum punya tugas' : un.sisa < 0 ? 'Alokasi melebihi pemasukan ' + UI.m(-un.sisa) : 'Setiap rupiah sudah punya tugas 👏'}</b>
          <small>Pemasukan ${UI.ms(un.income)} · dialokasikan ${UI.ms(un.alloc)} (amplop + tujuan + cicilan tagihan tahunan)</small></div>${I('chevron-right')}</div>` : ''}
        <div class="card"><div class="row-sp"><b>Total amplop</b><span>${UI.ms(totU)} / ${UI.ms(totB)}</span></div>${UI.bar(totB ? totU / totB : 0, totU > totB ? 'lewat' : totU > totB * 0.8 ? 'hampir' : 'aman')}
          <small class="muted">Tahan ${I('grip-vertical')} lalu seret ke amplop lain untuk menggeser dana.</small></div>
        ${['kebutuhan', 'keinginan', 'pribadi'].filter(k => g[k]).map(k => `${UI.sec(k === 'pribadi' ? 'Uang pribadi' : KEL[k], `<small class="muted">${UI.ms(U.sum(g[k], e => e.terpakai))} / ${UI.ms(U.sum(g[k], e => e.efektif))}</small>`)}
          <div class="env-list">${g[k].map(e => envCard(e, e.k.pribadi && e.k.pribadi !== me)).join('')}</div>`).join('')}
        ${none.length ? `${UI.sec('Belum dianggarkan', '<small class="muted">tap untuk beri batas</small>')}<div class="card list">${none.map(e => `<div class="row" data-act="env-edit" data-id="${e.k.id}"><span class="cat-ic sm">${I(e.k.ikon || 'circle-dot')}</span><div class="tx-txt"><b>${U.esc(e.k.nama)}</b></div><span>${UI.ms(e.terpakai)}</span></div>`).join('')}</div>` : ''}
        <div class="row-btns"><button class="btn ghost" data-act="geser">${I('move-horizontal')} Geser dana</button><a class="btn ghost" href="#/anggaran/bagi">${I('split')} Bagi gaji</a></div>
        <div class="spacer"></div>`;
    }
  });

  // ---------- Bagi gaji ----------
  function tpl() { try { const v = JSON.parse(Store.setting('bagiGaji', '[]')); return Array.isArray(v) && v.length ? v : null; } catch (e) { return null; } }
  const DEF_TPL = [{ pos: 'Kebutuhan', persen: 50, kelompok: 'kebutuhan' }, { pos: 'Keinginan', persen: 30, kelompok: 'keinginan' }, { pos: 'Tabungan & Tujuan', persen: 20, kelompok: 'tabungan' }];
  UI.act('bagi-amt', U.debounce(el => { UI.bagiJumlah = U.parseRp(el.value); const box = document.getElementById('bagi-res'); if (box) box.innerHTML = bagiRes(); }, 200));
  UI.act('bagi-preset', el => {
    const P = { '50/30/20': [50, 30, 20], '60/20/20': [60, 20, 20], '70/20/10': [70, 20, 10] }[el.dataset.v];
    const t = (tpl() || DEF_TPL).map((x, i) => Object.assign({}, x, { persen: P[i] != null ? P[i] : x.persen }));
    Store.setSetting('bagiGaji', JSON.stringify(t));
  });
  UI.act('bagi-pct', U.debounce(el => {
    const t = (tpl() || DEF_TPL).slice(); t[+el.dataset.i] = Object.assign({}, t[+el.dataset.i], { persen: U.clamp(Number(el.value) || 0, 0, 100) });
    Store.setSetting('bagiGaji', JSON.stringify(t));
  }, 500));
  function bagiBase() {
    if (UI.bagiJumlah) return UI.bagiJumlah;
    const p = Calc.period(), g = Calc.txIn(p).filter(t => t.jenis === 'masuk');
    return U.sum(g, t => t.jumlah) || Calc.incomeAvg();
  }
  function bagiRes() {
    const j = bagiBase(), t = tpl() || DEF_TPL, env = Calc.envelopes(Calc.period());
    const cur = { kebutuhan: U.sum(env.filter(e => !e.k.pribadi && (e.k.kelompok || 'kebutuhan') === 'kebutuhan'), e => e.batas), keinginan: U.sum(env.filter(e => e.k.pribadi || e.k.kelompok === 'keinginan'), e => e.batas),
      tabungan: U.sum(Calc.goals().filter(g => !g.t.arsip), g => g.t.setoranBulanan || 0) + U.sum(Calc.sinking(), s => s.perBulan) };
    const tot = U.sum(t, x => x.persen);
    return `${tot !== 100 ? `<div class="note warn">${I('triangle-alert')} Total persen ${tot}% — sebaiknya 100%.</div>` : ''}
      ${t.map(x => { const v = j * x.persen / 100, c = cur[x.kelompok] || 0, d = c - v; return `<div class="split-card ${x.kelompok}"><div class="row-sp"><b>${U.esc(x.pos)} · ${x.persen}%</b><b>${UI.m(v)}</b></div>
        <small class="muted">Saat ini teralokasi ${UI.ms(c)} ${Math.abs(d) > j * 0.02 ? (d > 0 ? '· lebih ' + UI.ms(d) : '· kurang ' + UI.ms(-d)) : '· pas ✓'}</small>${UI.bar(v ? c / v : 0, c > v * 1.02 ? 'lewat' : 'aman')}</div>`; }).join('')}
      <div class="row-btns"><button class="btn" data-act="bagi-apply">${I('wand-sparkles')} Sesuaikan batas amplop</button><button class="btn ghost" data-act="bagi-setor">${I('piggy-bank')} Setor rencana tujuan</button></div>`;
  }
  UI.act('bagi-apply', async () => {
    if (!Store.can('anggaran', 'ubah')) return UI.toast('Hanya bisa melihat.', 'warn');
    const j = bagiBase(), t = tpl() || DEF_TPL, env = Calc.envelopes(Calc.period()).filter(e => e.batas > 0 && !e.k.pribadi && !e.k.tetap);
    if (!(await UI.confirm('Sesuaikan batas amplop?', 'Batas amplop non-tetap di tiap kelompok diskalakan proporsional agar sesuai porsi bagi gaji. Amplop tagihan tetap & uang pribadi tidak diubah.', 'Sesuaikan'))) return;
    const ops = [];
    ['kebutuhan', 'keinginan'].forEach(kel => {
      const x = t.find(y => y.kelompok === kel); if (!x) return;
      const all = Calc.envelopes(Calc.period()).filter(e => e.batas > 0 && (e.k.pribadi ? kel === 'keinginan' : (e.k.kelompok || 'kebutuhan') === kel));
      const fixed = U.sum(all.filter(e => e.k.pribadi || e.k.tetap), e => e.batas);
      const flex = env.filter(e => (e.k.kelompok || 'kebutuhan') === kel), sum = U.sum(flex, e => e.batas);
      const target = Math.max(0, j * x.persen / 100 - fixed);
      if (!sum) return;
      flex.forEach(e => ops.push({ op: 'upsert', t: 'Kategori', row: { id: e.k.id, batas: Math.round(e.batas / sum * target / 5000) * 5000 } }));
    });
    Store.commit(ops); UI.toast(ops.length + ' amplop disesuaikan.');
  });
  UI.act('bagi-setor', () => {
    const gs = Calc.goals().filter(g => !g.t.arsip && g.t.setoranBulanan > 0 && g.sisa > 0 && (g.t.jenis !== 'pribadi' || g.t.pemilik === Store.me.email));
    const ym = U.today().slice(0, 7);
    const todo = gs.map(g => ({ g, sudah: U.sum(g.log.filter(t => t.jenis === 'tujuan' && t.tanggal.slice(0, 7) === ym), t => t.jumlah) })).filter(x => x.sudah < x.g.t.setoranBulanan);
    if (!todo.length) return UI.toast('Semua rencana setoran bulan ini sudah terpenuhi 👏');
    const s = UI.sheet({ title: 'Setor rencana tujuan bulan ini', body: `
      ${UI.field('Ambil dari dompet', `<select name="walletId">${UI.walletOpts(localStorage.getItem('sa:lastWallet'))}</select>`, 'Saldo dompet ini otomatis berkurang.')}
      <div class="list">${todo.map((x, i) => `<label class="check row"><input type="checkbox" name="g${i}" checked><span class="grow"><b>${U.esc(x.g.t.nama)}</b><small class="muted"> sisa rencana ${U.rp(x.g.t.setoranBulanan - x.sudah)}</small></span></label>`).join('')}</div>`,
      foot: `<button class="btn" data-ok>${I('piggy-bank')} Setor</button>` });
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el), me = Store.me.email, now = new Date().toISOString(), ops = [];
      todo.forEach((x, i) => { if (!f['g' + i]) return; if (x.g.t.walletId === f.walletId) return; ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: U.today(), jenis: 'tujuan', jumlah: Math.min(x.g.sisa, x.g.t.setoranBulanan - x.sudah), kategoriId: '', walletId: f.walletId, walletTujuan: x.g.t.walletId || '', biaya: 0, catatan: 'Setoran rutin ' + x.g.t.nama, dibayarOleh: me, tag: '', sumber: 'bagi-gaji', refId: x.g.t.id, periodeRef: U.today().slice(0, 7), dicatatOleh: me, dibuat: now, riwayat: [] } }); });
      if (!ops.length) return UI.toast('Tidak ada yang dipilih (atau dompet sama dengan dompet tujuan).', 'warn');
      Store.commit(ops); s.close(); UI.toast(ops.length + ' setoran tercatat · ' + U.rp(U.sum(ops, o => o.row.jumlah)));
    };
  });
  function bagi() {
    const t = tpl() || DEF_TPL, j = bagiBase();
    return `${TILES('bagi')}
      <div class="card">${UI.field('Jumlah gaji / pemasukan yang dibagi', `<div class="rp-input big"><b>Rp</b><input data-rp inputmode="numeric" value="${U.fmtNum(j)}" data-input="bagi-amt"></div>`)}
        <div class="chips">${['50/30/20', '60/20/20', '70/20/10'].map(v => `<button class="chip" data-act="bagi-preset" data-v="${v}">${v}</button>`).join('')}</div>
        <div class="pct-edit">${t.map((x, i) => `<label><span>${U.esc(x.pos)}</span><input type="number" min="0" max="100" value="${x.persen}" data-input="bagi-pct" data-i="${i}">%</label>`).join('')}</div></div>
      <div id="bagi-res">${bagiRes()}</div>
      <p class="muted small">Tabungan dihitung dari rencana setoran bulanan semua Tujuan + cicilan tagihan tahunan.</p><div class="spacer"></div>`;
  }
  function geserList() {
    const p = per(), list = Store.t.GeserDana.slice().sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    const nm = id => (Store.byId.Kategori[id] || {}).nama || '-';
    return `${TILES('geser')}<button class="btn block" data-act="geser">${I('move-horizontal')} Geser dana sekarang (${U.esc(p.label)})</button>
      ${UI.sec('Riwayat')}<div class="card list">${list.slice(0, 100).map(g => `<div class="row"><span class="cat-ic sm">${I('move-right')}</span><div class="tx-txt"><b>${U.esc(nm(g.dari))} → ${U.esc(nm(g.ke))}</b><small>${U.tgl(g.tanggal)}${g.catatan ? ' · ' + U.esc(g.catatan) : ''}</small></div><b>${UI.ms(g.jumlah)}</b>${Store.can('anggaran', 'ubah') ? `<button class="kebab" data-act="geser-del" data-id="${g.id}">${I('x')}</button>` : ''}</div>`).join('') || '<div class="row muted">Belum ada pergeseran dana.</div>'}</div><div class="spacer"></div>`;
  }
  UI.act('geser-del', async el => { if (await UI.confirm('Batalkan pergeseran?', 'Dana kembali ke amplop asal.', 'Batalkan', true)) Store.remove('GeserDana', el.dataset.id); });
  function sinking() {
    const s = Calc.sinking(), tot = U.sum(s, x => x.perBulan);
    return `${TILES('sinking')}
      <div class="card"><small class="muted">Sisihkan per bulan agar tagihan tahunan tidak mengagetkan</small><h2>${UI.m(tot)}<small>/bulan</small></h2>
        ${!Store.t.Tujuan.find(g => /tagihan tahunan/i.test(g.nama)) && s.length ? `<button class="btn sm" data-act="sinking-goal">${I('target')} Buat Tujuan "Dana Tagihan Tahunan"</button>` : ''}</div>
      <div class="card list">${s.map(x => `<div class="row" data-act="rutin-edit" data-id="${x.r.id}"><span class="cat-ic">${I((Store.byId.Kategori[x.r.kategoriId] || {}).ikon || 'calendar-clock')}</span><div class="tx-txt"><b>${U.esc(x.r.nama)}</b><small>${U.tgl(x.next)} · ${x.bulanLagi} bulan lagi · ${UI.ms(x.r.jumlah)}</small></div><div class="r"><b>${UI.ms(x.perBulan)}</b><small>perlu ${UI.ms(x.perluPerBulan)}/bln</small></div></div>`).join('') || `<div class="row muted">Belum ada tagihan tahunan. <button class="link" data-act="rutin-add">Tambah</button></div>`}</div>
      <p class="muted small">"Perlu/bln" = jumlah yang harus disisihkan mulai sekarang bila belum ada tabungan untuk tagihan itu.</p><div class="spacer"></div>`;
  }
  UI.act('sinking-goal', () => {
    const s = Calc.sinking();
    Store.upsert('Tujuan', { id: U.uid('g'), nama: 'Dana Tagihan Tahunan', ikon: 'calendar-clock', target: Math.round(U.sum(s, x => x.r.jumlah)), tenggat: '', prioritas: 2, jenis: 'bersama', pemilik: '', setoranBulanan: Math.round(U.sum(s, x => x.perBulan) / 1000) * 1000, walletId: '', arsip: false, catatan: 'Dana untuk pajak, premi, PBB, dll.', dibuat: new Date().toISOString() });
    UI.toast('Tujuan dibuat.'); UI.go('tujuan');
  });
  function pribadi() {
    const p = per(), env = Calc.envelopes(p).filter(e => e.k.pribadi), me = Store.me.email;
    const without = Store.members().filter(m => !env.find(e => e.k.pribadi === m.email));
    return `${TILES('pribadi')}
      <div class="note">${I('lock')} Uang pribadi setiap pasangan tetap dihitung di total keluarga, tetapi catatan & rincian belanjanya hanya terlihat oleh pemiliknya.</div>
      <div class="env-list">${env.map(e => envCard(e, e.k.pribadi !== me)).join('')}</div>
      ${without.length && Store.isAdminLike() ? `${UI.sec('Belum punya uang pribadi')}<div class="card list">${without.map(m => `<div class="row"><span class="avatar xs" style="background:${m.warna || '#5b7a78'}">${U.esc(U.initials(m.nama))}</span><div class="tx-txt"><b>${U.esc(m.nama)}</b></div><button class="btn xs" data-act="pribadi-add" data-email="${U.esc(m.email)}">Buat</button></div>`).join('')}</div>` : ''}
      <div class="spacer"></div>`;
  }
  UI.act('pribadi-add', el => {
    const m = Store.member(el.dataset.email); if (!m) return;
    Store.upsert('Kategori', { id: U.uid('k'), nama: 'Uang Pribadi ' + m.nama, jenis: 'keluar', kelompok: 'keinginan', ikon: 'lock', batas: 1000000, bawaSisa: true, tetap: false, pribadi: m.email, urutan: 90, arsip: false });
    UI.toast('Amplop uang pribadi dibuat (batas Rp1 jt, bisa diubah).');
  });
})();
