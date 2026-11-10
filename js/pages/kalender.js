/* Kalender — arus kas, tagihan & langganan, musim mahal, acara */
(function () {
  const I = UI.icon;
  const K = { ym: U.today().slice(0, 7), day: U.today(), proj: 30 };

  // ---------- Hari libur (tetap + Paskah + Hijriah perkiraan) ----------
  const LIBUR_TETAP = { '01-01': 'Tahun Baru Masehi', '05-01': 'Hari Buruh', '06-01': 'Hari Lahir Pancasila', '08-17': 'HUT Kemerdekaan RI', '12-25': 'Hari Natal' };
  const HIJRI = { '9-1': 'Awal Ramadan (perkiraan)', '10-1': 'Idul Fitri (perkiraan)', '10-2': 'Idul Fitri (perkiraan)', '12-10': 'Idul Adha (perkiraan)', '1-1': 'Tahun Baru Islam (perkiraan)', '3-12': 'Maulid Nabi (perkiraan)', '7-27': 'Isra Mikraj (perkiraan)' };
  const easterCache = {};
  function easter(y) {
    if (easterCache[y]) return easterCache[y];
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
    const s = y + '-' + U.pad(mo) + '-' + U.pad(da);
    return (easterCache[y] = { [U.addDays(s, -2)]: 'Wafat Isa Almasih', [s]: 'Hari Paskah', [U.addDays(s, 39)]: 'Kenaikan Isa Almasih' });
  }
  UI.libur = d => {
    const f = LIBUR_TETAP[d.slice(5)]; if (f) return f;
    const e = easter(Number(d.slice(0, 4)))[d]; if (e) return e;
    const h = U.hijriParts(d); if (h) return HIJRI[h.m + '-' + h.d] || '';
    return '';
  };

  // ---------- Form rutin ----------
  UI.rutinForm = (r, preset) => {
    const isNew = !r; r = r || Object.assign({ id: U.uid('r'), nama: '', jenis: 'keluar', jumlah: 0, kategoriId: '', walletId: Store.wallets()[0] && Store.wallets()[0].id, frekuensi: 'bulanan', tanggal: U.parseDate(U.today()).getDate(), bulan: U.parseDate(U.today()).getMonth() + 1, mulai: '', selesai: '', langganan: false, ditinjau: '', aktif: true, catatan: '' }, preset || {});
    const s = UI.sheet({ title: isNew ? 'Tambah tagihan / pemasukan rutin' : 'Ubah rutin', body: `
      ${UI.seg('jenis', [['keluar', 'Tagihan / pengeluaran'], ['masuk', 'Pemasukan (gaji dll)']], r.jenis)}
      ${UI.field('Nama', `<input name="nama" required maxlength="60" value="${U.esc(r.nama)}" placeholder="mis. Listrik PLN, Gaji Dimas">`)}
      <div class="grid2">${UI.field('Jumlah', UI.rpInput('jumlah', r.jumlah))}${UI.field('Kategori', `<select name="kategoriId" data-kat-for="jenis">${UI.katOpts(r.jenis, r.kategoriId)}</select>`)}</div>
      <div class="grid2">${UI.field('Frekuensi', `<select name="frekuensi"><option value="bulanan" ${r.frekuensi === 'bulanan' ? 'selected' : ''}>Setiap bulan</option><option value="tahunan" ${r.frekuensi === 'tahunan' ? 'selected' : ''}>Setiap tahun</option></select>`)}
        ${UI.field('Dompet', `<select name="walletId">${UI.walletOpts(r.walletId)}</select>`)}</div>
      <div class="grid2">${UI.field('Tanggal', `<input type="number" name="tanggal" min="1" max="31" value="${r.tanggal || 1}">`, '31 = akhir bulan')}
        <label class="field" data-bulan ${r.frekuensi !== 'tahunan' ? 'hidden' : ''}><span>Bulan</span><select name="bulan">${U.BLN_L.map((b, i) => `<option value="${i + 1}" ${(r.bulan || 1) === i + 1 ? 'selected' : ''}>${b}</option>`).join('')}</select></label></div>
      <div class="grid2">${UI.field('Mulai (opsional)', `<input type="date" name="mulai" value="${r.mulai || ''}">`)}${UI.field('Selesai (opsional)', `<input type="date" name="selesai" value="${r.selesai || ''}">`)}</div>
      <label class="check"><input type="checkbox" name="langganan" ${r.langganan ? 'checked' : ''}><span>Ini langganan (Netflix, cloud, dll) — ingatkan saya meninjau tiap 3 bulan</span></label>
      <label class="check"><input type="checkbox" name="aktif" ${r.aktif !== false ? 'checked' : ''}><span>Aktif</span></label>
      ${UI.field('Catatan', `<input name="catatan" maxlength="120" value="${U.esc(r.catatan)}">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>${I('check')} Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelectorAll('[name=jenis]').forEach(x => x.onchange = () => { s.el.querySelector('[name=kategoriId]').innerHTML = UI.katOpts(x.value, ''); });
    s.el.querySelector('[name=frekuensi]').onchange = e => { s.el.querySelector('[data-bulan]').hidden = e.target.value !== 'tahunan'; };
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (!f.nama || !f.jumlah) return UI.toast('Nama dan jumlah wajib diisi.', 'warn');
      Store.upsert('Rutin', Object.assign({}, r, f, { tanggal: U.clamp(Number(f.tanggal) || 1, 1, 31), bulan: Number(f.bulan) || 1, ditinjau: r.ditinjau || (f.langganan ? U.today() : '') }));
      s.close(); UI.toast('Tersimpan.');
    };
    const del = s.el.querySelector('[data-del]');
    if (del) del.onclick = async () => { if (await UI.confirm('Hapus rutin?', 'Riwayat pembayaran tetap tersimpan di Mutasi.', 'Hapus', true)) { Store.remove('Rutin', r.id); s.close(); } };
  };
  UI.act('rutin-add', el => UI.rutinForm(null, el.dataset.jenis ? { jenis: el.dataset.jenis } : null));
  UI.act('rutin-edit', el => UI.rutinForm(Store.byId.Rutin[el.dataset.id]));
  UI.act('rutin-review', el => {
    const r = Store.byId.Rutin[el.dataset.id]; if (!r) return;
    const s = UI.sheet({ title: 'Tinjau langganan', cls: 'small', body: `<p><b>${U.esc(r.nama)}</b> · ${U.rp(r.jumlah)}/${r.frekuensi === 'tahunan' ? 'tahun' : 'bulan'} (${U.rp(r.frekuensi === 'tahunan' ? r.jumlah : r.jumlah * 12)} setahun).</p><p class="muted">Masih dipakai keluarga?</p>`,
      foot: `<button class="btn ghost danger" data-stop>Berhenti langganan</button><button class="btn" data-keep>Masih dipakai</button>` });
    s.el.querySelector('[data-keep]').onclick = () => { Store.upsert('Rutin', { id: r.id, ditinjau: U.today() }); s.close(); UI.toast('Ditandai masih dipakai — diingatkan lagi 3 bulan.'); };
    s.el.querySelector('[data-stop]').onclick = () => { Store.upsert('Rutin', { id: r.id, aktif: false, ditinjau: U.today(), selesai: U.today() }); s.close(); UI.toast('Langganan dinonaktifkan. Hemat ' + U.rp(r.frekuensi === 'tahunan' ? r.jumlah : r.jumlah * 12) + ' setahun 🎉'); };
  });

  // ---------- Acara ----------
  UI.acaraForm = (a) => {
    const isNew = !a; a = a || { id: U.uid('a'), nama: '', tanggal: U.addDays(U.today(), 30), estimasi: 0, besar: false, catatan: '' };
    const s = UI.sheet({ title: isNew ? 'Tambah acara / rencana' : 'Ubah acara', cls: 'small', body: `
      ${UI.field('Nama acara', `<input name="nama" maxlength="60" value="${U.esc(a.nama)}" placeholder="mis. Mudik Lebaran, Ultah Aisha">`)}
      <div class="grid2">${UI.field('Tanggal', `<input type="date" name="tanggal" value="${a.tanggal}">`)}${UI.field('Perkiraan biaya', UI.rpInput('estimasi', a.estimasi))}</div>
      <label class="check"><input type="checkbox" name="besar" ${a.besar ? 'checked' : ''}><span>Pengeluaran besar (tampil di Musim Mahal)</span></label>
      ${UI.field('Catatan', `<input name="catatan" maxlength="120" value="${U.esc(a.catatan)}">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => { const f = UI.formData(s.el); if (!f.nama || !f.tanggal) return UI.toast('Nama & tanggal wajib.', 'warn'); Store.upsert('Acara', Object.assign({}, a, f)); s.close(); };
    const del = s.el.querySelector('[data-del]'); if (del) del.onclick = () => { Store.remove('Acara', a.id); s.close(); };
  };
  UI.act('acara-add', () => UI.acaraForm());
  UI.act('acara-edit', el => UI.acaraForm(Store.byId.Acara[el.dataset.id]));

  // ---------- Navigasi kalender ----------
  UI.act('kal-month', el => { K.ym = U.addMonths(K.ym + '-01', Number(el.dataset.d)).slice(0, 7); K.day = K.ym === U.today().slice(0, 7) ? U.today() : K.ym + '-01'; UI.render(); });
  UI.act('kal-day', el => { K.day = el.dataset.d; UI.render(); });
  UI.act('kal-today', () => { K.ym = U.today().slice(0, 7); K.day = U.today(); UI.render(); });
  UI.act('proj-days', el => { K.proj = Number(el.dataset.v); UI.render(); });

  const occRow = (o) => `<div class="row" data-act="occ-pay" data-occ="${U.esc(o.id)}">
    <span class="cat-ic ${o.lunas ? 'ok' : o.tanggal < U.today() && o.arah !== 'info' ? 'bad' : ''}">${I(o.kind === 'acara' ? 'party-popper' : o.kind === 'tujuan' ? 'target' : o.kind === 'pinjaman' ? 'landmark' : o.arah === 'masuk' ? 'banknote' : 'receipt')}</span>
    <div class="tx-txt"><b>${U.esc(o.nama)}</b><small>${o.lunas ? 'Lunas ' + (o.tglBayar ? U.tgl(o.tglBayar, 'dm') : '') : o.kind === 'acara' ? 'Rencana' : o.dibayar ? 'Dibayar ' + UI.ms(o.dibayar) : U.relDay(o.tanggal)}${UI.isTunda(o) ? ' · ditunda' : ''}</small></div>
    ${o.arah === 'info' ? '' : UI.amount(o.lunas ? o.jumlah : o.sisa, o.arah === 'masuk' ? 'masuk' : 'keluar')}</div>`;

  function monthGrid() {
    const first = K.ym + '-01', dt = U.parseDate(first), dim = U.daysInMonth(dt.getFullYear(), dt.getMonth() + 1);
    const occ = Calc.occurrences(first, K.ym + '-' + U.pad(dim));
    const by = U.groupBy(occ, o => o.tanggal);
    const lead = (dt.getDay() + 6) % 7;
    let h = '<div class="cal-grid">' + ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(d => `<div class="cal-dow">${d}</div>`).join('');
    for (let i = 0; i < lead; i++) h += '<div></div>';
    for (let d = 1; d <= dim; d++) {
      const s = K.ym + '-' + U.pad(d), it = by[s] || [], lib = UI.libur(s), hp = U.hijriParts(s);
      const dots = [it.some(o => o.arah === 'masuk') ? 'in' : '', it.some(o => o.arah === 'keluar' && o.kind !== 'acara') ? (it.some(o => o.arah === 'keluar' && !o.lunas && s < U.today()) ? 'bad' : 'out') : '', it.some(o => o.kind === 'acara' || o.kind === 'tujuan') ? 'gold' : ''].filter(Boolean);
      h += `<button class="cal-d ${s === U.today() ? 'today' : ''} ${s === K.day ? 'sel' : ''} ${lib ? 'hol' : ''} ${(lead + d) % 7 === 0 ? 'sun' : ''}" data-act="kal-day" data-d="${s}" aria-label="${U.tgl(s, 'long')}">
        <b>${d}</b>${hp ? `<small>${hp.d}</small>` : ''}<span class="dots">${dots.map(c => `<i class="${c}"></i>`).join('')}</span></button>`;
    }
    return h + '</div>';
  }

  UI.page('kalender', {
    head(p) { const t = { arus: 'Arus Kas & Proyeksi', tagihan: 'Tagihan & Langganan', musim: 'Musim Mahal', acara: 'Acara & Rencana' }[p]; return t ? { title: t, crumb: 'Kalender', back: 'kalender' } : null; },
    nav: () => 'kalender',
    render(p) {
      if (p === 'arus') return arus();
      if (p === 'tagihan') return tagihan();
      if (p === 'musim') return musim();
      if (p === 'acara') return acara();
      const gaj = UI.gajian(), ot = Calc.onTimeRate();
      const dayOcc = Calc.occurrences(K.day, K.day), lib = UI.libur(K.day);
      const up = Calc.occurrences(U.today(), U.addDays(U.today(), 14)).filter(o => !o.lunas && o.arah !== 'info');
      return `
        ${UI.tiles([
          { id: 'arus', icon: 'trending-up', label: 'Arus Kas', to: 'kalender/arus' },
          { id: 'tagihan', icon: 'receipt', label: 'Tagihan & Langganan', to: 'kalender/tagihan' },
          { id: 'musim', icon: 'flame', label: 'Musim Mahal', to: 'kalender/musim' },
          { id: 'acara', icon: 'party-popper', label: 'Acara & Rencana', to: 'kalender/acara' },
          { id: 'kk', icon: 'credit-card', label: 'Kartu Kredit', soon: true, act: 'soon' },
          { id: 'gcal', icon: 'refresh-ccw', label: 'Sinkron Google', to: 'pengaturan/notif' },
          { id: 'add', icon: 'calendar-plus', label: 'Tambah Rutin', act: 'rutin-add' },
          { id: 'adda', icon: 'plus', label: 'Tambah Acara', act: 'acara-add' }
        ])}
        <div class="stat3">
          <div class="stat"><small>${I('banknote')} Gajian</small><b>${gaj ? U.diffDays(U.today(), gaj.tanggal) + ' hari' : '—'}</b><small>${gaj ? U.tgl(gaj.tanggal, 'dm') : 'atur di rutin'}</small></div>
          <div class="stat"><small>${I('badge-check')} Tepat waktu</small><b>${ot ? U.pct(ot.rate) : '—'}</b><small>${ot ? ot.ok + '/' + ot.total + ' tagihan' : '6 bulan'}</small></div>
          <div class="stat"><small>${I('moon-star')} Hijriah</small><b class="sm">${U.esc(U.hijri(U.today()).replace(/ \d+ H$/, ''))}</b><small>${U.esc((U.hijri(U.today()).match(/\d+ H$/) || [''])[0])}</small></div>
        </div>
        <div class="card cal">
          <div class="cal-head"><button class="icon-btn" data-act="kal-month" data-d="-1">${I('chevron-left')}</button><button class="link" data-act="kal-today"><b>${U.tgl(K.ym + '-01', 'my')}</b></button><button class="icon-btn" data-act="kal-month" data-d="1">${I('chevron-right')}</button></div>
          ${monthGrid()}
          <div class="cal-legend"><span><i class="in"></i>Masuk</span><span><i class="out"></i>Tagihan</span><span><i class="bad"></i>Terlambat</span><span><i class="gold"></i>Acara/Tujuan</span></div>
        </div>
        ${UI.sec(U.esc(U.tgl(K.day, 'long')), `<small class="muted">${U.esc(U.hijri(K.day))}</small>`)}
        ${lib ? `<div class="note">${I('flag')} ${U.esc(lib)}</div>` : ''}
        <div class="card list">${dayOcc.length ? dayOcc.map(occRow).join('') : `<div class="row muted">${I('calendar-check')} Tidak ada jadwal di tanggal ini.</div>`}</div>
        ${UI.sec('2 minggu ke depan', `<button class="link" data-act="rutin-add">${I('plus')} Rutin</button>`)}
        <div class="card list">${up.length ? up.map(occRow).join('') : `<div class="row muted">Tidak ada tagihan dalam 14 hari.</div>`}</div>
        <div class="spacer"></div>`;
    }
  });

  function arus() {
    const pr = Calc.projection(K.proj);
    const mi = pr.pts.indexOf(pr.min);
    const ticks = [0, Math.floor(pr.pts.length / 2), pr.pts.length - 1];
    const flows = pr.pts.filter(p => p.items.length);
    return `
      <div class="chips">${[30, 60, 90].map(d => `<button class="chip ${K.proj === d ? 'on' : ''}" data-act="proj-days" data-v="${d}">${d} hari</button>`).join('')}</div>
      <div class="card"><div class="row-sp"><div><small class="muted">Saldo kas likuid sekarang</small><h3>${UI.m(pr.pts[0].bal)}</h3></div><div class="r"><small class="muted">Terendah</small><h3 class="${pr.min.bal < pr.batas ? 'bad' : ''}">${UI.m(pr.min.bal)}</h3><small>${U.tgl(pr.min.d, 'dm')}</small></div></div>
        ${Charts.line(pr.pts, { mark: mi, ticks, aria: 'Proyeksi saldo' })}
        <small class="muted">Proyeksi = saldo sekarang + pemasukan rutin − tagihan/cicilan terjadwal − rata-rata belanja harian ${UI.m(pr.vd)} (90 hari terakhir).</small></div>
      ${pr.kritis ? `<div class="alert warn">${I('siren')}<div><b>Siaga Dana — ${U.tgl(pr.kritis.d, 'long')}</b><small>Perkiraan saldo ${UI.m(pr.kritis.bal)} di bawah batas aman ${UI.m(pr.batas)}. Pertimbangkan menunda belanja non-pokok, memindah dana dari tabungan, atau mengatur ulang tanggal bayar.</small></div></div>`
        : `<div class="alert ok">${I('shield-check')}<div><b>Arus kas aman</b><small>Saldo diperkirakan tetap di atas ${UI.m(pr.batas)} selama ${K.proj} hari.</small></div></div>`}
      ${UI.sec('Rincian arus terjadwal')}
      <div class="card list">${flows.map(p => `<div class="day-h in-card"><b>${U.tgl(p.d, 'dm')}</b><span>${U.relDay(p.d)}</span><em>${UI.ms(p.bal)}</em></div>${p.items.map(occRow).join('')}`).join('') || '<div class="row muted">Tidak ada arus terjadwal.</div>'}</div>
      <div class="spacer"></div>`;
  }

  function tagihan() {
    const subs = Calc.subscriptions(), inc = Store.t.Rutin.filter(r => r.jenis === 'masuk');
    const review = subs.filter(x => x.perluTinjau);
    const bul = subs.filter(x => x.r.frekuensi !== 'tahunan' && !x.r.langganan), thn = subs.filter(x => x.r.frekuensi === 'tahunan'), lg = subs.filter(x => x.r.langganan && x.r.frekuensi !== 'tahunan');
    const tot = U.sum(subs.filter(x => x.r.aktif !== false), x => x.perBulan), totLg = U.sum(subs.filter(x => x.r.langganan && x.r.aktif !== false), x => x.perBulan);
    const st = x => x.r.aktif === false ? UI.pill('Nonaktif', '') : x.status === 'lunas' ? UI.pill('Lunas', 'ok') : x.status === 'terlambat' ? UI.pill('Terlambat', 'bad') : UI.pill(x.cur ? U.tgl(x.cur.tanggal, 'dm') : 'Belum', 'warn');
    const rows = arr => arr.map(x => `<div class="row"><span class="cat-ic">${I((Store.byId.Kategori[x.r.kategoriId] || {}).ikon || 'receipt')}</span>
      <div class="tx-txt" data-act="rutin-edit" data-id="${x.r.id}"><b>${U.esc(x.r.nama)}</b><small>${x.r.frekuensi === 'tahunan' ? 'Tiap ' + x.r.tanggal + ' ' + U.BLN_L[(x.r.bulan || 1) - 1] : 'Tiap tgl ' + x.r.tanggal} · ${UI.ms(x.r.jumlah)}</small></div>
      <div class="r">${st(x)}${x.cur && !x.cur.lunas && x.r.aktif !== false ? `<button class="btn xs" data-act="occ-pay" data-occ="${U.esc(x.cur.id)}">Bayar</button>` : ''}</div></div>`).join('');
    return `
      <div class="stat3"><div class="stat"><small>Tagihan / bulan</small><b>${UI.ms(tot)}</b></div><div class="stat"><small>Langganan / bulan</small><b>${UI.ms(totLg)}</b></div><div class="stat"><small>Setahun</small><b>${UI.ms(tot * 12)}</b></div></div>
      ${review.length ? `<div class="alert info">${I('search-check')}<div><b>${review.length} langganan perlu ditinjau</b><small>Sudah 3 bulan — masih dipakai?</small></div></div><div class="card list">${review.map(x => `<div class="row" data-act="rutin-review" data-id="${x.r.id}"><span class="cat-ic">${I('tv')}</span><div class="tx-txt"><b>${U.esc(x.r.nama)}</b><small>${U.rp(x.r.jumlah * 12)} setahun</small></div><span class="link">Tinjau</span></div>`).join('')}</div>` : ''}
      ${UI.sec('Tagihan bulanan', `<button class="link" data-act="rutin-add">${I('plus')} Tambah</button>`)}<div class="card list">${rows(bul) || '<div class="row muted">Belum ada.</div>'}</div>
      ${UI.sec('Langganan')}<div class="card list">${rows(lg) || '<div class="row muted">Belum ada langganan.</div>'}</div>
      ${UI.sec('Tagihan tahunan', '<a class="link" href="#/anggaran/sinking">Dicicil per bulan</a>')}<div class="card list">${rows(thn) || '<div class="row muted">Belum ada.</div>'}</div>
      ${UI.sec('Pemasukan rutin', `<button class="link" data-act="rutin-add" data-jenis="masuk">${I('plus')} Tambah</button>`)}<div class="card list">${inc.map(r => `<div class="row" data-act="rutin-edit" data-id="${r.id}"><span class="cat-ic in">${I('banknote')}</span><div class="tx-txt"><b>${U.esc(r.nama)}</b><small>Tiap tgl ${r.tanggal}${r.aktif === false ? ' · nonaktif' : ''}</small></div>${UI.amount(r.jumlah, 'masuk')}</div>`).join('') || '<div class="row muted">Belum ada.</div>'}</div>
      <p class="muted small">Tagihan yang jatuh tempo ≤ 3 hari juga tampil di Beranda. Ingin jadwal ini di Google Calendar? Lihat Lainnya › Notifikasi.</p><div class="spacer"></div>`;
  }

  function musim() {
    const h = Calc.heavyMonths();
    const max = Math.max(...h.months.map(m => m.total), 1);
    return `<div class="card"><p class="muted">Perkiraan pengeluaran 12 bulan ke depan dibanding rata-rata pemasukan ${UI.m(h.incAvg)}/bulan. Bulan merah = siapkan dana sejak sekarang.</p>
      <div class="heat">${h.months.map(m => `<div class="heat-row ${m.level}"><b>${m.label}</b><div class="heat-bar"><i style="width:${(m.total / max * 100).toFixed(0)}%"></i></div><span>${UI.ms(m.total)}</span><small>${U.esc(m.items.slice(0, 3).join(', '))}</small></div>`).join('')}</div>
      <div class="cal-legend"><span><i class="in"></i>Aman</span><span><i class="gold"></i>Sedang (≥85%)</span><span><i class="bad"></i>Puncak (≥100%)</span></div></div>
      <div class="alert info">${I('lightbulb')}<div><b>Tips</b><small>Ubah tagihan tahunan jadi cicilan bulanan di Anggaran › Tagihan Tahunan, dan buat Tujuan untuk acara besar.</small></div></div>
      <div class="chips"><button class="btn sm" data-act="acara-add">${I('plus')} Tambah acara besar</button><a class="btn sm ghost" href="#/anggaran/sinking">Tagihan tahunan</a></div><div class="spacer"></div>`;
  }

  function acara() {
    const list = Store.t.Acara.slice().sort((a, b) => a.tanggal.localeCompare(b.tanggal));
    const up = list.filter(a => a.tanggal >= U.today()), past = list.filter(a => a.tanggal < U.today()).reverse();
    const row = a => `<div class="row" data-act="acara-edit" data-id="${a.id}"><div class="date-chip"><b>${U.parseDate(a.tanggal).getDate()}</b><small>${U.BLN[U.parseDate(a.tanggal).getMonth()]}</small></div><div class="tx-txt"><b>${U.esc(a.nama)} ${a.besar ? UI.pill('Besar', 'gold') : ''}</b><small>${U.relDay(a.tanggal)}${a.catatan ? ' · ' + U.esc(a.catatan) : ''}</small></div>${UI.amount(a.estimasi, 'keluar')}</div>`;
    return `${UI.sec('Akan datang', `<button class="link" data-act="acara-add">${I('plus')} Tambah</button>`)}<div class="card list">${up.map(row).join('') || '<div class="row muted">Belum ada rencana.</div>'}</div>
      ${past.length ? UI.sec('Sudah lewat') + '<div class="card list">' + past.slice(0, 20).map(row).join('') + '</div>' : ''}<div class="spacer"></div>`;
  }
})();
