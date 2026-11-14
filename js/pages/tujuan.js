/* Tujuan — target tabungan, setor langsung dari dompet, checklist setoran, perayaan milestone */
(function () {
  const I = UI.icon;
  const T = { sim: 0 };
  const TPL = [
    ['Dana Darurat', 'shield', () => Math.round(Calc.emergency().avgOut * Calc.emergency().target / 100000) * 100000, 'Target = rata-rata pengeluaran × ' + Store.setting('danaDaruratBulan', 6) + ' bulan'],
    ['Dana Pendidikan', 'graduation-cap', () => 15000000, 'Uang pangkal/masuk sekolah'],
    ['DP Rumah', 'house', () => 100000000, '±20% dari harga rumah'],
    ['Umrah / Haji', 'moon-star', () => 70000000, 'Perkiraan untuk 2 orang — sesuaikan'],
    ['Mudik Lebaran', 'car', () => 8000000, 'Transport, oleh-oleh, THR keluarga'],
    ['Pernikahan', 'heart', () => 80000000, ''],
    ['Ganti Kendaraan', 'car-front', () => 60000000, ''],
    ['Dana Pensiun', 'armchair', () => 500000000, 'Jangka panjang'],
    ['Qurban', 'beef', () => 4000000, 'Kambing / patungan sapi'],
    ['Liburan Keluarga', 'plane', () => 12000000, ''],
    ['Gadget / Elektronik', 'laptop', () => 10000000, ''],
    ['Lainnya', 'target', () => 0, '']
  ];
  const canSee = g => g.t.jenis !== 'pribadi' || !g.t.pemilik || g.t.pemilik === Store.me.email;

  // ---------- Form tujuan ----------
  UI.goalForm = (g, pre) => {
    const isNew = !g;
    g = g || Object.assign({ id: U.uid('g'), nama: '', ikon: 'target', target: 0, tenggat: U.addMonths(U.today(), 12), prioritas: Store.t.Tujuan.length + 1, jenis: 'bersama', pemilik: '', setoranBulanan: 0, walletId: '', arsip: false, catatan: '', dibuat: new Date().toISOString() }, pre || {});
    const s = UI.sheet({ title: isNew ? 'Tujuan baru' : 'Ubah tujuan', body: `
      ${UI.field('Nama tujuan', `<input name="nama" maxlength="50" value="${U.esc(g.nama)}">`)}
      <div class="icon-pick">${['target', 'shield', 'graduation-cap', 'house', 'moon-star', 'plane', 'car', 'heart', 'laptop', 'beef', 'gift', 'baby', 'armchair', 'piggy-bank', 'calendar-clock', 'gem'].map(ic => `<label><input type="radio" name="ikon" value="${ic}" ${g.ikon === ic ? 'checked' : ''}><span>${I(ic)}</span></label>`).join('')}</div>
      <div class="grid2">${UI.field('Target', UI.rpInput('target', g.target))}${UI.field('Tenggat', `<input type="date" name="tenggat" value="${g.tenggat || ''}">`)}</div>
      <div class="calc-hint muted small"></div>
      <div class="grid2">${UI.field('Rencana setoran / bulan', UI.rpInput('setoranBulanan', g.setoranBulanan))}${UI.field('Prioritas', `<input type="number" name="prioritas" min="1" max="99" value="${g.prioritas || 1}">`)}</div>
      ${UI.field('Disimpan di', `<select name="walletId"><option value="">Disisihkan (tidak di dompet manapun)</option>${UI.walletOpts(g.walletId)}</select>`, 'Pilih rekening tabungan bila uangnya benar-benar dipindah ke sana. Setiap setoran mengurangi saldo dompet asal.')}
      <div class="grid2">${UI.field('Jenis', `<select name="jenis"><option value="bersama" ${g.jenis !== 'pribadi' ? 'selected' : ''}>Bersama</option><option value="pribadi" ${g.jenis === 'pribadi' ? 'selected' : ''}>Pribadi saya</option></select>`)}
        ${UI.field('Catatan', `<input name="catatan" maxlength="100" value="${U.esc(g.catatan)}">`)}</div>
      <p class="muted small">${I('info')} Emas & reksa dana bisa ditautkan ke tujuan ini dari Brankas Emas atau halaman Reksa Dana.</p>`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-hapus aria-label="Hapus">${I('trash-2')}</button><button class="btn ghost" data-arsip>${I('archive')} ${g.arsip ? 'Aktifkan' : 'Arsipkan'}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const hp = s.el.querySelector('[data-hapus]');
    if (hp) hp.onclick = async () => {
      const tx = Store.t.Transaksi.filter(t => (t.jenis === 'tujuan' || t.jenis === 'tujuan_ambil') && t.refId === g.id);
      const aset = [].concat((Store.t.Emas || []).filter(e => e.tujuanId === g.id).map(e => ['Emas', e.id]), (Store.t.Investasi || []).filter(e => e.tujuanId === g.id).map(e => ['Investasi', e.id]));
      const rutin = (Store.t.Rutin || []).filter(r => r.refId === g.id || r.tujuanId === g.id);
      const ket = [tx.length ? tx.length + ' setoran/penarikan dibatalkan (uangnya kembali ke dompet asal)' : '', aset.length ? aset.length + ' aset dilepas tautannya (asetnya tetap ada)' : '', rutin.length ? rutin.length + ' jadwal rutin terkait ikut dihapus' : ''].filter(Boolean);
      if (!(await UI.confirm('Hapus tujuan ' + g.nama + '?', ket.length ? ket.map(x => '• ' + x).join('\n') : 'Tujuan ini belum punya setoran. Dihapus permanen.', 'Hapus tujuan', true))) return;
      Store.commit(tx.map(t => ({ op: 'delete', t: 'Transaksi', id: t.id }))
        .concat(aset.map(a => ({ op: 'upsert', t: a[0], row: { id: a[1], tujuanId: '' } })))
        .concat(rutin.map(r => ({ op: 'delete', t: 'Rutin', id: r.id })))
        .concat([{ op: 'delete', t: 'Tujuan', id: g.id }]));
      s.close(); UI.toast('Tujuan dihapus.');
      if (UI.cur === 'tujuan' && UI.param === g.id) UI.go('tujuan');
    };
    const hint = s.el.querySelector('.calc-hint');
    const upd = () => {
      const f = UI.formData(s.el), cur = (Calc.goal(g.id) || { saldo: 0 }).saldo, sisa = Math.max(0, f.target - cur);
      const n = f.tenggat ? Math.max(1, Calc.monthsBetween(U.today(), f.tenggat)) : 0;
      hint.innerHTML = f.target ? (n ? `Perlu sekitar <b>${U.rp(Math.ceil(sisa / n / 1000) * 1000)}</b>/bulan selama ${n} bulan.` : '') + (f.setoranBulanan ? ` Dengan ${U.rp(f.setoranBulanan)}/bulan, tercapai ±<b>${U.tgl(U.addMonths(U.today(), Math.ceil(sisa / f.setoranBulanan)), 'my')}</b>.` : '') : '';
    };
    s.el.addEventListener('input', upd); s.el.addEventListener('change', upd); upd();
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (!f.nama || !f.target) return UI.toast('Nama dan target wajib.', 'warn');
      f.pemilik = f.jenis === 'pribadi' ? Store.me.email : '';
      f.prioritas = Number(f.prioritas) || 1;
      Store.upsert('Tujuan', Object.assign({}, g, f)); s.close(); UI.toast('Tujuan disimpan.');
      if (isNew) UI.go('tujuan/' + g.id);
    };
    const ar = s.el.querySelector('[data-arsip]'); if (ar) ar.onclick = () => { Store.upsert('Tujuan', { id: g.id, arsip: !g.arsip }); s.close(); };
  };
  UI.act('goal-new', () => {
    const s = UI.sheet({ title: 'Pilih template tujuan', body: `<div class="tpl-grid">${TPL.map((t, i) => `<button class="tpl" data-i="${i}">${I(t[1])}<b>${t[0]}</b>${t[3] ? `<small>${U.esc(t[3])}</small>` : ''}</button>`).join('')}</div>` });
    s.el.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const t = TPL[+b.dataset.i]; s.close(); UI.goalForm(null, { nama: t[0] === 'Lainnya' ? '' : t[0], ikon: t[1], target: t[2]() }); });
  });
  UI.act('goal-edit', el => UI.goalForm(Store.byId.Tujuan[el.dataset.id]));

  // ---------- Setor & ambil ----------
  UI.goalSetor = (id, ambil) => {
    const g = Calc.goal(id); if (!g) return;
    if (!Store.can('tujuan', 'ubah') && !(Store.me.peran === 'anggota')) return UI.toast('Hanya bisa melihat.', 'warn');
    const bal = Calc.balances(), wl = Store.wallets().filter(w => w.id !== g.t.walletId);
    if (!wl.length) return UI.toast('Tambahkan dompet lain dulu.', 'warn');
    const lastW = localStorage.getItem('sa:lastWallet');
    const def = wl.find(w => w.id === lastW) || wl[0];
    const sug = ambil ? 0 : Math.min(g.sisa, g.t.setoranBulanan || g.perluPerBulan || 0);

    const s = UI.sheet({ title: (ambil ? 'Ambil dari ' : 'Setor ke ') + g.t.nama, cls: 'small', body: `
      ${ambil ? `<p class="muted">Dana terkumpul ${U.rp(g.saldo)}. Uang yang diambil masuk ke dompet pilihan.</p>` : `<p class="muted">Sisa menuju target ${U.rp(g.sisa)}.</p>`}
      ${ambil ? '' : `<div class="setor-via" role="tablist" aria-label="Setor lewat"><button type="button" class="on" data-via="kas">${I('landmark')}Kas & bank<small>pindah dana</small></button><button type="button" data-via="emas">${I('gem')}Emas<small>beli emas</small></button><button type="button" data-via="rd">${I('chart-pie')}Reksa dana<small>beli unit</small></button></div>`}
      ${UI.field('Jumlah', UI.rpInput('jumlah', Math.round(sug)))}
      <div class="chips">${ambil ? '' : [g.t.setoranBulanan, 100000, 500000, 1000000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(v => `<button class="chip" data-q="${v}">${U.rpShort(v)}</button>`).join('')}</div>
      ${UI.field(ambil ? 'Masukkan ke dompet' : 'Ambil dari dompet', `<select name="walletId">${wl.map(w => `<option value="${w.id}" ${w.id === def.id ? 'selected' : ''}>${U.esc(w.nama)} — ${U.rpShort(bal[w.id] || 0)}</option>`).join('')}</select>`,
        ambil ? (g.t.walletId ? 'Saldo ' + U.esc((Store.byId.Wallet[g.t.walletId] || {}).nama) + ' ikut berkurang.' : '') : 'Saldo dompet ini otomatis berkurang' + (g.t.walletId ? ' dan masuk ke ' + U.esc((Store.byId.Wallet[g.t.walletId] || {}).nama) : '') + '.')}
      ${UI.biayaField(0, 'Opsional — mis. biaya transfer antarbank, biaya pembelian.')}
      <div class="warn-line"></div>
      <div class="grid2">${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}${Store.members().length > 1 ? UI.field(ambil ? 'Diambil oleh' : 'Disetor oleh', `<select name="dibayarOleh">${UI.memberOpts(Store.me.email)}</select>`) : ''}</div>
      ${UI.field('Catatan', `<input name="catatan" maxlength="80" placeholder="${ambil ? 'Alasan pengambilan' : 'mis. setoran Nov'}">`)}`,
      foot: `<button class="btn" data-ok>${I(ambil ? 'arrow-up-from-line' : 'piggy-bank')} ${ambil ? 'Ambil' : 'Setor'}</button>` });
    UI.bindRp(s.el);
    const inp = s.el.querySelector('[name=jumlah]'), sel = s.el.querySelector('[name=walletId]'), warn = s.el.querySelector('.warn-line');
    const chk = () => { const v = U.parseRp(inp.value), b = bal[sel.value] || 0; warn.innerHTML = !ambil && v > b ? `<span class="bad small">${I('triangle-alert')} Melebihi saldo dompet (${U.rp(b)}).</span>` : ambil && v > g.saldo ? `<span class="bad small">Melebihi dana terkumpul.</span>` : ''; };
    inp.addEventListener('input', chk); sel.addEventListener('change', chk); chk();
    s.el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { inp.value = U.fmtNum(b.dataset.q); chk(); });
    // Setor lewat emas / reksa dana → buka form pembeliannya dengan tujuan ini sudah terisi
    s.el.querySelectorAll('[data-via]').forEach(b => b.onclick = () => {
      const via = b.dataset.via; if (via === 'kas') return;
      const f = UI.formData(s.el); s.close();
      setTimeout(() => {
        if (via === 'emas') UI.emasForm(null, { tujuanId: g.t.id, sumber: f.walletId ? 'w:' + f.walletId : '' });
        else UI.rdBeli(null, { tujuanId: g.t.id, jumlah: f.jumlah || Math.round(sug) });
      }, 220);
    });
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (!f.jumlah) return UI.toast('Isi jumlah.', 'warn');
      if (ambil && f.jumlah > g.saldo) return UI.toast('Melebihi dana terkumpul ' + U.rp(g.saldo) + '.', 'warn');
      const before = g.pct, me = Store.me.email;
      localStorage.setItem('sa:lastWallet', f.walletId);
      Store.upsert('Transaksi', { id: U.uid('t'), tanggal: f.tanggal || U.today(), jenis: ambil ? 'tujuan_ambil' : 'tujuan', jumlah: f.jumlah, kategoriId: '', walletId: f.walletId, walletTujuan: g.t.walletId || '',
        biaya: f.biayaLain || 0, catatan: f.catatan || ((ambil ? 'Ambil dari ' : 'Setor ke ') + g.t.nama), dibayarOleh: f.dibayarOleh || me, tag: '', sumber: 'app', refId: g.t.id, periodeRef: (f.tanggal || U.today()).slice(0, 7), dicatatOleh: me, dibuat: new Date().toISOString(), riwayat: [] });
      s.close();
      const after = Calc.goal(id).pct;
      const ms = [1, 0.75, 0.5, 0.25].find(m => before < m && after >= m);
      if (!ambil && ms) UI.celebrate(ms, g.t.nama); else UI.toast((ambil ? 'Diambil ' : 'Disetor ') + U.rp(f.jumlah) + ' · ' + U.pct(Math.min(1, after)));
    };
  };
  UI.act('goal-setor', el => UI.goalSetor(el.dataset.id));
  UI.act('goal-ambil', el => UI.goalSetor(el.dataset.id, true));

  UI.celebrate = (m, nama) => {
    const wrap = document.createElement('div');
    wrap.className = 'celebrate';
    const colors = ['#F2B33D', '#0F5E59', '#90D5CE', '#FDBD46', '#ffffff'];
    wrap.innerHTML = `<div class="confetti">${Array.from({ length: 60 }, (_, i) => `<i style="left:${Math.random() * 100}%;background:${colors[i % 5]};animation-delay:${Math.random() * 0.6}s;transform:rotate(${Math.random() * 360}deg)"></i>`).join('')}</div>
      <div class="cel-card">${Charts.jar(m)}<h2>${m >= 1 ? 'Tujuan tercapai! 🎉' : U.pct(m) + ' tercapai!'}</h2><p>${U.esc(nama)}</p><button class="btn">Mantap!</button></div>`;
    document.body.appendChild(wrap);
    if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
    const close = () => { wrap.classList.add('out'); setTimeout(() => wrap.remove(), 300); };
    wrap.querySelector('button').onclick = close; setTimeout(close, 6000);
  };

  const simTampil = (id) => { const g = Calc.goal(id), o = document.getElementById('sim-out'); if (o && g) o.innerHTML = T.sim > 0 ? simText(g, T.sim) : '<span class="muted">Ketik nominal setoran per bulan.</span>'; };
  UI.act('goal-sim', U.debounce(el => { T.sim = Number(el.value); const n = document.getElementById('sim-n'); if (n) n.value = U.fmtNum(T.sim); simTampil(el.dataset.id); }, 30));
  UI.act('goal-sim-n', el => {
    const v = Number(String(el.value).replace(/\D/g, '')) || 0;
    el.value = v ? U.fmtNum(v) : '';
    T.sim = v;
    const r = document.getElementById('sim-r');
    if (r) { if (v > Number(r.max)) r.max = String(Math.ceil(v / 100000) * 100000); r.value = String(Math.max(Number(r.min), v)); }
    simTampil(el.dataset.id);
  });
  function simText(g, v) {
    if (g.sisa <= 0) return 'Target sudah tercapai 🎉';
    if (!v) return 'Geser untuk mencoba jumlah setoran.';
    const n = Math.ceil(g.sisa / v), d = U.addMonths(U.today(), n);
    const late = g.t.tenggat && d > g.t.tenggat;
    return `Tercapai <b>${U.tgl(d, 'my')}</b> (${n} bulan)${g.t.tenggat ? (late ? ` — <span class="bad">${Calc.monthsBetween(g.t.tenggat, d)} bulan lewat tenggat</span>` : ' — <span class="ok">sebelum tenggat ✓</span>') : ''}`;
  }

  UI.page('tujuan', {
    head: p => p ? { title: (Store.byId.Tujuan[p] || {}).nama || 'Tujuan', crumb: 'Tujuan', back: 'tujuan', right: Store.byId.Tujuan[p] ? `<button class="icon-btn" data-act="goal-edit" data-id="${p}" aria-label="Ubah">${I('pencil')}</button>` : '' }
      : { title: 'Tujuan', crumb: 'Lainnya', back: 'lainnya', right: `<button class="icon-btn" data-act="goal-new" aria-label="Tujuan baru">${I('plus')}</button>` },
    nav: () => 'lainnya',
    after(v, p) { if (!p) pasangUrut(); },
    render(p) {
      if (!Store.can('tujuan', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Tujuan.');
      if (p) return detail(p);
      const gs = Calc.goals(), act = gs.filter(g => !g.t.arsip), arsip = gs.filter(g => g.t.arsip);
      const vis = act.filter(canSee);
      const tot = U.sum(vis, g => g.saldo), tgt = U.sum(vis, g => g.target);
      const ym = U.today().slice(0, 7);
      return `
        <section class="hero card-primary compact"><div class="hero-top"><small>Total dana tujuan</small></div><div class="hero-amt">${UI.m(tot)}</div>
          <div class="bar light"><i style="width:${(tgt ? Math.min(1, tot / tgt) * 100 : 0).toFixed(0)}%"></i></div><small>${U.pct(tgt ? tot / tgt : 0)} dari total target ${UI.ms(tgt)}</small></section>
        <div class="goal-list">${act.map(g => {
          if (!canSee(g)) return `<div class="goal-card locked" data-id="${g.t.id}"><button class="grip" data-grip data-act="noop" aria-label="Seret untuk mengubah prioritas">${I('grip-vertical')}</button><span class="cat-ic">${I('lock')}</span><div class="grow"><b>Tujuan pribadi ${U.esc(Store.memberName(g.t.pemilik))}</b>${UI.bar(g.pct, 'aman')}<small class="muted">${U.pct(Math.min(1, g.pct))}</small></div></div>`;
          const bulanIni = U.sum(g.log.filter(t => (t.jenis === 'tujuan' || t.jenis === 'aset_beli') && t.tanggal.slice(0, 7) === ym), t => t.jumlah);
          const done = g.t.setoranBulanan && bulanIni >= g.t.setoranBulanan;
          return `<div class="goal-card" data-id="${g.t.id}" data-act="go" data-to="tujuan/${g.t.id}"><button class="grip" data-grip data-act="noop" aria-label="Seret untuk mengubah prioritas">${I('grip-vertical')}</button>${Charts.jar(g.pct, true)}
            <div class="grow"><div class="row-sp"><b>${U.esc(g.t.nama)}</b>${g.pct >= 1 ? UI.pill('Tercapai', 'ok') : g.t.jenis === 'pribadi' ? UI.pill('Pribadi', '') : ''}</div>
              <div class="row-sp"><span>${UI.ms(g.saldo)} <small class="muted">/ ${UI.ms(g.target)}</small></span><b>${U.pct(Math.min(1, g.pct))}</b></div>${UI.bar(g.pct, 'aman')}
              <small class="muted">${g.t.walletId ? I('landmark') + ' ' + U.esc((Store.byId.Wallet[g.t.walletId] || {}).nama) + ' · ' : ''}${g.estimasi ? 'Estimasi ' + U.tgl(g.estimasi, 'mys') : 'Atur rencana setoran'}${g.t.setoranBulanan ? ' · bulan ini ' + (done ? '✓' : UI.ms(bulanIni) + '/' + UI.ms(g.t.setoranBulanan)) : ''}</small></div>
            ${g.pct < 1 ? `<button class="btn xs" data-act="goal-setor" data-id="${g.t.id}">${I('plus')} Setor</button>` : ''}</div>`;
        }).join('') || UI.empty('target', 'Belum ada tujuan', 'Mulai dari Dana Darurat — fondasi keuangan keluarga.', `<button class="btn" data-act="goal-new">${I('plus')} Buat tujuan</button>`)}</div>
        ${act.length > 1 ? `<small class="muted center-note">${I('grip-vertical')} Seret untuk mengurutkan prioritas — paling atas didahulukan.</small>` : ''}
        ${act.length ? `<button class="btn block ghost" data-act="goal-new">${I('plus')} Tujuan baru</button>` : ''}
        ${arsip.length ? UI.sec('Arsip') + `<div class="card list">${arsip.map(g => `<div class="row muted" data-act="go" data-to="tujuan/${g.t.id}"><span class="cat-ic">${I(g.t.ikon || 'target')}</span><div class="tx-txt"><b>${U.esc(g.t.nama)}</b><small>${UI.ms(g.saldo)}</small></div></div>`).join('')}</div>` : ''}
        <div class="spacer"></div>`;
    }
  });

  UI.act('noop', () => {});
  /** Seret kartu tujuan (lewat pegangan) untuk mengubah urutan prioritas. */
  function pasangUrut() {
    const list = document.querySelector('#view .goal-list'); if (!list || list.dataset.urut) return; list.dataset.urut = '1';
    list.querySelectorAll('[data-grip]').forEach(h => h.addEventListener('pointerdown', e => {
      const card = h.closest('.goal-card'); if (!card) return;
      e.preventDefault(); e.stopPropagation();
      const rect = card.getBoundingClientRect(), y0 = e.clientY;
      const ph = document.createElement('div'); ph.className = 'goal-ph'; ph.style.height = rect.height + 'px';
      card.after(ph); card.classList.add('dragging');
      Object.assign(card.style, { position: 'fixed', left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', zIndex: 60 });
      try { h.setPointerCapture(e.pointerId); } catch (x) {}
      if (navigator.vibrate) try { navigator.vibrate(12); } catch (x) {}
      const move = ev => {
        card.style.top = (rect.top + ev.clientY - y0) + 'px';
        let taruh = false;
        for (const sb of list.querySelectorAll('.goal-card:not(.dragging)')) { const r = sb.getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { list.insertBefore(ph, sb); taruh = true; break; } }
        if (!taruh) list.appendChild(ph);
        if (ev.clientY < 90) window.scrollBy(0, -10); else if (ev.clientY > innerHeight - 140) window.scrollBy(0, 10);
      };
      const up = () => {
        h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
        card.classList.remove('dragging'); card.removeAttribute('style'); list.insertBefore(card, ph); ph.remove();
        const ops = [];
        list.querySelectorAll('.goal-card[data-id]').forEach((c, i) => { const g = Store.byId.Tujuan[c.dataset.id]; if (g && Number(g.prioritas) !== i + 1) ops.push({ op: 'upsert', t: 'Tujuan', row: { id: g.id, prioritas: i + 1 } }); });
        if (ops.length) { Store.commit(ops); UI.toast('Urutan prioritas disimpan.'); }
      };
      h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
    }));
  }

  function detail(id) {
    const g = Calc.goal(id);
    if (!g) return UI.empty('target', 'Tujuan tidak ditemukan', '', '<a class="btn" href="#/tujuan">Kembali</a>');
    if (!canSee(g)) return UI.empty('lock', 'Tujuan pribadi', 'Rincian hanya terlihat oleh pemiliknya.');
    const ck = Calc.goalChecklist(g, 6), sim = T.sim || g.t.setoranBulanan || Math.ceil((g.perluPerBulan || 500000) / 50000) * 50000;
    T.sim = sim;
    const maxSim = Math.max(1000000, Math.ceil(Math.max(g.sisa / 3, sim * 2) / 100000) * 100000);
    const ms = [0.25, 0.5, 0.75, 1];
    return `
      <div class="goal-hero"><div class="jar-wrap">${Charts.jar(g.pct)}</div>
        <div><small class="muted">Terkumpul</small><h2>${UI.m(g.saldo)}</h2><small class="muted">dari ${UI.m(g.target)} · ${U.pct(Math.min(1, g.pct))}</small>
          <div class="ms">${ms.map(m => `<span class="${g.pct >= m ? 'on' : ''}">${m * 100}%</span>`).join('')}</div></div></div>
      <div class="row-btns"><button class="btn" data-act="goal-setor" data-id="${id}">${I('piggy-bank')} Setor</button><button class="btn ghost" data-act="goal-ambil" data-id="${id}" ${g.saldo <= 0 ? 'disabled' : ''}>${I('arrow-up-from-line')} Ambil</button></div>
      <div class="stat3"><div class="stat"><small>Sisa</small><b>${UI.ms(g.sisa)}</b></div><div class="stat"><small>Perlu/bulan</small><b>${g.t.tenggat ? UI.ms(g.perluPerBulan) : '—'}</b><small>${g.t.tenggat ? 'tenggat ' + U.tgl(g.t.tenggat, 'mys') : 'tanpa tenggat'}</small></div><div class="stat"><small>Laju 3 bln</small><b>${UI.ms(g.laju)}</b><small>/bulan</small></div></div>
      ${g.t.walletId ? `<div class="note">${I('landmark')} Disimpan di <b>${U.esc((Store.byId.Wallet[g.t.walletId] || {}).nama || '-')}</b> — setiap setoran memindahkan uang dari dompet asal ke rekening ini.</div>` : `<div class="note">${I('info')} Setiap setoran mengurangi saldo dompet asal dan dicatat sebagai dana yang disisihkan.</div>`}
      ${UI.sec('Simulasi setoran')}
      <div class="card"><div class="row-sp sim-row"><span>Setoran per bulan</span><div class="rp-input sim-rp"><b>Rp</b><input id="sim-n" inputmode="numeric" autocomplete="off" value="${U.fmtNum(sim)}" data-input="goal-sim-n" data-id="${id}" aria-label="Ketik setoran per bulan"></div></div>
        <input type="range" id="sim-r" min="50000" max="${maxSim}" step="50000" value="${sim}" data-input="goal-sim" data-id="${id}" aria-label="Geser setoran per bulan">
        <p id="sim-out">${simText(g, sim)}</p></div>
      ${UI.sec('Checklist setoran', '<small class="muted">6 bulan terakhir</small>')}
      <div class="card"><table class="ck"><thead><tr><th>Bulan</th>${ck.members.map(m => `<th>${U.esc(m.nama)}</th>`).join('')}</tr></thead>
        <tbody>${ck.rows.map(r => `<tr><td>${r.label.slice(0, 3)}</td>${r.cells.map(c => `<td>${c.v ? `<span class="ck-ok">${I('check')}</span><small>${UI.ms(c.v)}</small>` : '<span class="ck-no">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${UI.sec('Riwayat setoran')}
      <div class="card list">${g.log.slice(0, 50).map(t => UI.txRow(t, { date: true })).join('') || '<div class="row muted">Belum ada setoran.</div>'}</div>
      <div class="spacer"></div>`;
  }
})();
