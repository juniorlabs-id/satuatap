/* ============================================================
 * Reksa Dana — dicatat PER APLIKASI (Bibit, Bareksa, Ajaib, …).
 * Cukup 1 angka per aplikasi: total nilai portofolio. Setoran (autodebet)
 * dicatat di layar yang sama, sehingga grafik bisa memisahkan
 * "uang yang disetor" dan "hasil investasi".
 * riwayatNilai: [[tanggal, nilai, totalSetoran], …]
 * ============================================================ */
(function () {
  const I = UI.icon, me = () => Store.me.email;
  const APPS = ['Bibit', 'Bareksa', 'Ajaib', 'Pluang', 'Tanamduit', 'Makmur', 'IPOT', 'Bank'];
  const WARNA = ['#0F5E59', '#E0A23A', '#2E8C84', '#7A5CC0', '#C2553D', '#3D7FC2', '#5B7A78', '#9C6B1E'];
  const warna = nama => { let h = 0; String(nama).split('').forEach(c => h = (h * 31 + c.charCodeAt(0)) | 0); return WARNA[Math.abs(h) % WARNA.length]; };
  let PERIODE = '1t';
  /** Portofolio = kolom kode ('aplikasi' / kosong = tanpa nama portofolio). */
  const porto = x => (x.kode && x.kode !== 'aplikasi') ? x.kode : '';
  const lbl = x => { const t = x.tujuanId && Store.byId.Tujuan[x.tujuanId], n = porto(x) || (t ? t.nama : ''); return x.nama + (n ? ' · ' + n : ''); };
  const av = (x, cls) => `<span class="rd-av ${cls || ''}" style="background:${warna(x.nama)}">${U.esc(String(x.nama).slice(0, 1).toUpperCase())}</span>`;
  const tujuan = x => x.tujuanId && Store.byId.Tujuan[x.tujuanId];
  /** Pemilik portofolio: email bila dimiliki 1 orang, '' bila bersama. */
  const pemilik = x => { const kp = x.kepemilikan || {}, ks = Object.keys(kp).filter(k => Number(kp[k]) > 0); return ks.length === 1 ? ks[0] : ''; };
  const milikSaya = x => { const p = pemilik(x); return !p || p === me(); };
  const ownChip = x => { const p = pemilik(x); return p ? UI.avatar(p, true) : ''; };
  /** Kelompokkan per aplikasi: [{nama, items, nilai, modal}] urut nilai terbesar. */
  const grupApp = list => {
    const g = {}; list.forEach(i => { const k = String(i.x.nama).trim().toLowerCase(); (g[k] = g[k] || { nama: i.x.nama, x: i.x, items: [], nilai: 0, modal: 0 }).items.push(i); g[k].nilai += i.nilai; g[k].modal += i.modal; });
    return Object.values(g).sort((a, b) => b.nilai - a.nilai);
  };

  // ---------- Data ----------
  const apps = () => Calc.investasi('reksadana');
  /** Titik riwayat satu aplikasi: [{d, v, m}] urut tanggal, selalu diakhiri nilai terkini. */
  const titik = (x) => {
    const modalNow = Number(x.modal) || 0, nilaiNow = Number(x.nilai || x.modal) || 0;
    let pts = (Array.isArray(x.riwayatNilai) ? x.riwayatNilai : []).filter(r => r && r[0]).map(r => ({ d: String(r[0]).slice(0, 10), v: Number(r[1]) || 0, m: r[2] != null ? Number(r[2]) || 0 : null }));
    if (!pts.length || pts[0].d > (x.tanggal || pts[0].d)) pts.unshift({ d: x.tanggal || U.today(), v: pts.length && pts[0].m != null ? pts[0].m : modalNow, m: pts.length && pts[0].m != null ? pts[0].m : modalNow });
    pts.forEach(p => { if (p.m == null) p.m = modalNow; });
    const tgl = (x.tglNilai || U.today()).slice(0, 10), akhir = pts[pts.length - 1];
    if (akhir.d < tgl || akhir.v !== nilaiNow || akhir.m !== modalNow) pts.push({ d: tgl > akhir.d ? tgl : akhir.d, v: nilaiNow, m: modalNow });
    pts.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    const out = []; pts.forEach(p => { if (out.length && out[out.length - 1].d === p.d) out[out.length - 1] = p; else out.push(p); });
    return out;
  };
  const nilaiPada = (pts, d) => { let r = null; for (const p of pts) { if (p.d <= d) r = p; else break; } return r || { v: 0, m: 0 }; };
  /** Total semua aplikasi per tanggal: [{d, bal (nilai), m (setoran)}]. */
  const deretTotal = (list) => {
    const per = list.map(i => titik(i.x));
    const tg = Array.from(new Set([].concat(...per.map(p => p.map(t => t.d))).concat([U.today()]))).sort();
    return tg.map(d => { let v = 0, m = 0; per.forEach(p => { const t = nilaiPada(p, d); v += t.v; m += t.m; }); return { d, bal: v, m }; });
  };
  /** Hasil investasi per bulan = (perubahan nilai) − (setoran bersih bulan itu). */
  const hasilBulanan = (list, n) => {
    const per = list.map(i => titik(i.x)), out = [];
    const akhirBulan = ym => { const [y, mo] = ym.split('-').map(Number); const d = new Date(y, mo, 0); return y + '-' + String(mo).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const tot = d => { let v = 0, m = 0; per.forEach(p => { const t = nilaiPada(p, d); v += t.v; m += t.m; }); return { v, m }; };
    for (let k = n - 1; k >= 0; k--) {
      const ym = U.ym(U.addMonths(U.today(), -k)), ymPrev = U.ym(U.addMonths(U.today(), -k - 1));
      const e = tot(k === 0 ? U.today() : akhirBulan(ym)), s = tot(akhirBulan(ymPrev));
      out.push({ ym, hasil: (e.v - s.v) - (e.m - s.m), ada: e.v > 0 || s.v > 0 });
    }
    return out;
  };

  // ---------- Grafik kecil ----------
  const spark = (pts, col) => {
    if (pts.length < 2) return '';
    const W = 110, H = 32, vs = pts.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs);
    const x = i => (i / (pts.length - 1)) * W, y = v => H - 3 - ((v - lo) / ((hi - lo) || 1)) * (H - 6);
    return `<svg viewBox="0 0 ${W} ${H}" class="rd-spark" aria-hidden="true"><path d="${pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join(' ')}" stroke="${col}"/></svg>`;
  };
  const barHasil = (rows) => {
    const W = 340, H = 130, pad = { l: 6, r: 6, t: 14, b: 22 }, max = Math.max(1, ...rows.map(r => Math.abs(r.hasil)));
    const gw = (W - pad.l - pad.r) / rows.length, bw = Math.min(18, gw * 0.56), mid = pad.t + (H - pad.t - pad.b) / 2, sc = (H - pad.t - pad.b) / 2 / max;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart rd-bars" role="img" aria-label="Hasil investasi per bulan"><line x1="${pad.l}" x2="${W - pad.r}" y1="${mid}" y2="${mid}" class="grid"/>`;
    rows.forEach((r, i) => {
      const cx = pad.l + gw * i + gw / 2, h = Math.max(r.ada && r.hasil ? 2 : 0, Math.abs(r.hasil) * sc);
      s += `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(r.hasil >= 0 ? mid - h : mid).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="4" class="${r.hasil >= 0 ? 'naik' : 'turun'}"/>`;
      if (i % (rows.length > 6 ? 2 : 1) === (rows.length - 1) % (rows.length > 6 ? 2 : 1)) s += `<text x="${cx}" y="${H - 6}" text-anchor="middle" class="axis${i === rows.length - 1 ? ' strong' : ''}">${U.tgl(r.ym + '-01', 'mys').split(' ')[0]}</text>`;
    });
    return s + '</svg>';
  };

  // ---------- Tampilan halaman ----------
  UI.rdView = () => {
    const list = apps(), sold = Calc.investasi('reksadana', true).filter(i => i.x.status === 'terjual');
    if (!list.length) return `<div class="card rd-empty">${UI.empty('chart-pie', 'Catat reksa dana per aplikasi', 'Cukup satu angka per portofolio di tiap aplikasi (Bibit, Bareksa, Ajaib, …), masing-masing bisa ditautkan ke tujuan berbeda. Perbarui sebulan sekali — grafik pertumbuhan dibuat otomatis.', `<button class="btn" data-act="rd-add">${I('plus')} Tambah aplikasi</button>`)}</div>`;
    const nilai = U.sum(list, i => i.nilai), modal = U.sum(list, i => i.modal), hasil = nilai - modal, pct = modal ? hasil / modal : 0;
    const deret = deretTotal(list), bul = hasilBulanan(list, 12), ini = bul[bul.length - 1];
    const umur = x => x.tglNilai ? U.diffDays(x.tglNilai, U.today()) : 999;
    const terlama = list.filter(i => milikSaya(i.x)).reduce((a, i) => Math.max(a, umur(i.x)), 0);
    const basiSaya = list.filter(i => milikSaya(i.x) && umur(i.x) > 30).length;
    const batas = { '3b': U.addMonths(U.today(), -3), '6b': U.addMonths(U.today(), -6), '1t': U.addMonths(U.today(), -12), 'all': '0000' }[PERIODE];
    let pts = deret.filter(p => p.d >= batas); const sebelum = deret.filter(p => p.d < batas).pop();
    if (sebelum && PERIODE !== 'all') pts.unshift(Object.assign({}, sebelum, { d: batas }));
    if (pts.length === 1) pts = [Object.assign({}, pts[0], { d: U.addDays(pts[0].d, -1) }), pts[0]];
    const awal = pts[0], ubah = (pts[pts.length - 1].bal - awal.bal) - (pts[pts.length - 1].m - awal.m);
    const totHasil12 = U.sum(bul, r => r.hasil), naikBln = bul.filter(r => r.ada && r.hasil > 0).length, adaBln = bul.filter(r => r.ada).length;
    return `
      <div class="hero rd-hero">
        <div class="hero-top"><small>${I('chart-pie')} Total reksa dana · ${grupApp(list).length} aplikasi${list.length > grupApp(list).length ? ' · ' + list.length + ' portofolio' : ''}</small></div>
        <div class="rd-big">${UI.m(nilai)}</div>
        <div class="rd-pill ${hasil >= 0 ? 'naik' : 'turun'}">${I(hasil >= 0 ? 'arrow-up-right' : 'arrow-down-left')} ${hasil >= 0 ? '+' : '−'}${UI.ms(Math.abs(hasil))} (${hasil >= 0 ? '+' : '−'}${U.pct(Math.abs(pct), 1)}) <span>sejak awal</span></div>
        <div class="rd-split"><div><small>Total disetor</small><b>${UI.ms(modal)}</b></div><div><small>Hasil bulan ini</small><b class="${ini.hasil >= 0 ? 'naik' : 'turun'}">${ini.hasil >= 0 ? '+' : '−'}${UI.ms(Math.abs(ini.hasil))}</b></div></div>
        <button class="btn on-dark block" data-act="rd-update">${I('refresh-cw')} Perbarui nilai${terlama > 30 ? ' · terakhir ' + terlama + ' hari lalu' : ''}</button>
      </div>
      ${terlama > 30 ? `<div class="alert warn" data-act="rd-update">${I('bell-ring')}<div><b>Waktunya update bulanan</b><small>${basiSaya} portofolio milik Anda belum diperbarui. Buka aplikasinya, salin total nilainya ke sini — 1 menit selesai.</small></div>${I('chevron-right')}</div>` : ''}
      <div class="card rd-trend">
        <div class="row-sp"><b>Pertumbuhan nilai</b><span class="${ubah >= 0 ? 'ok' : 'bad'} small">${ubah >= 0 ? '+' : '−'}${UI.ms(Math.abs(ubah))} hasil</span></div>
        <div class="chips sm">${[['3b', '3 bln'], ['6b', '6 bln'], ['1t', '1 thn'], ['all', 'Semua']].map(p => `<button class="chip ${PERIODE === p[0] ? 'on' : ''}" data-act="rd-per" data-p="${p[0]}">${p[1]}</button>`).join('')}</div>
        ${Charts.line(pts, { fit: true, fmt: 'mys', aria: 'Nilai reksa dana dibanding total setoran', compare: pts.map(p => ({ d: p.d, bal: p.m })), h: 170 })}
        <div class="rd-legend"><span><i class="l1"></i>Nilai portofolio</span><span><i class="l2"></i>Total disetor</span></div>
        <small class="muted">Jarak antara dua garis = hasil investasi (keuntungan di luar uang yang Anda setor).</small>
      </div>
      <div class="card rd-trend">
        <div class="row-sp"><b>Hasil per bulan</b><span class="${totHasil12 >= 0 ? 'ok' : 'bad'} small">${totHasil12 >= 0 ? '+' : '−'}${UI.ms(Math.abs(totHasil12))} / 12 bln</span></div>
        ${barHasil(bul)}
        <small class="muted">${adaBln ? `${naikBln} dari ${adaBln} bulan untung. ` : ''}Setoran tidak dihitung sebagai hasil.</small>
      </div>
      ${(() => { const tj = {}; list.forEach(i => { const t = tujuan(i.x); if (t) (tj[t.id] = tj[t.id] || { t, v: 0 }).v += i.nilai; });
        const rows = Object.values(tj).sort((a, b) => b.v - a.v); if (!rows.length) return '';
        const gs = Calc.goals();
        return UI.sec('Per tujuan') + `<div class="rd-goals">${rows.map(r => { const g = gs.find(z => z.t.id === r.t.id), pc = g && g.target ? Math.min(1, g.pct) : 0;
          return `<div class="rd-goal" data-act="go" data-to="tujuan/${r.t.id}"><div class="rd-goal-ic">${I(r.t.ikon || 'target')}</div><div class="grow"><b>${U.esc(r.t.nama)}</b><small>${UI.ms(r.v)} di reksa dana${g && g.target ? ' · tujuan ' + U.pct(pc) + ' tercapai' : ''}</small>${g && g.target ? `<div class="bar"><i style="width:${(pc * 100).toFixed(1)}%"></i></div>` : ''}</div></div>`; }).join('')}</div>`; })()}
      ${UI.sec('Per aplikasi')}
      <div class="rd-apps">${grupApp(list).map(g => {
        const col = warna(g.nama), u = g.nilai - g.modal, pc = g.modal ? u / g.modal : 0;
        return `<div class="card rd-app">
          <div class="rd-app-top">${av(g.x)}<div class="grow"><b>${U.esc(g.nama)}</b><small class="muted">${g.items.length > 1 ? g.items.length + ' portofolio · ' : ''}${U.pct(nilai ? g.nilai / nilai : 0)} dari total</small></div>
            <div class="rd-app-sum"><b>${UI.ms(g.nilai)}</b><small class="${u >= 0 ? 'ok' : 'bad'}">${u >= 0 ? '+' : '−'}${U.pct(Math.abs(pc), 1)}</small></div></div>
          <div class="bar"><i style="width:${(nilai ? g.nilai / nilai * 100 : 0).toFixed(1)}%;background:${col}"></i></div>
          <div class="rd-portos">${g.items.map(i => { const x = i.x, t = tujuan(x), umur = x.tglNilai ? U.diffDays(x.tglNilai, U.today()) : 999;
            return `<div class="rd-porto" data-act="rd-open" data-id="${x.id}"><div class="grow"><b>${ownChip(x)}${U.esc(porto(x) || (t ? t.nama : 'Portofolio utama'))}</b>
              <small>${t ? `<span class="rd-tag">${I('target')} ${U.esc(t.nama)}</span>` : '<span class="muted">tanpa tujuan</span>'} <span class="${umur > 30 ? 'bad' : 'muted'}">· ${umur === 0 ? 'hari ini' : umur > 900 ? 'belum diperbarui' : umur + ' hr lalu'}</span></small></div>
              ${spark(titik(x), col)}<div class="rd-porto-v"><b>${UI.ms(i.nilai)}</b><small class="${i.untung >= 0 ? 'ok' : 'bad'}">${i.untung >= 0 ? '+' : '−'}${U.pct(Math.abs(i.pct), 1)}</small></div></div>`; }).join('')}</div>
          <button class="link small" data-act="rd-add" data-app="${U.esc(g.nama)}">${I('plus')} Portofolio ${U.esc(g.nama)}</button>
        </div>`; }).join('')}</div>
      <button class="btn block ghost" data-act="rd-add">${I('plus')} Tambah aplikasi</button>
      ${sold.length ? UI.sec('Sudah ditarik semua') + `<div class="card list">${sold.map(i => `<div class="row muted" data-act="inv-open" data-id="${i.x.id}"><span class="cat-ic">${I('archive')}</span><div class="tx-txt"><b>${U.esc(i.x.nama)}</b><small>${U.tgl(i.x.tglJual)}</small></div><small class="${i.untung >= 0 ? 'ok' : 'bad'}">${i.untung >= 0 ? '+' : '−'}${UI.ms(Math.abs(i.untung))}</small></div>`).join('')}</div>` : ''}
      <p class="muted small">Angka hanya catatan dari nilai yang Anda masukkan, bukan rekomendasi investasi.</p><div class="spacer"></div>`;
  };
  UI.act('rd-per', el => { PERIODE = el.dataset.p; UI.render(); });

  // ---------- Simpan titik riwayat ----------
  const rowBaru = (x, nilai, modal, tgl) => {
    const rw = (Array.isArray(x.riwayatNilai) ? x.riwayatNilai : []).filter(r => r && String(r[0]).slice(0, 10) !== tgl);
    rw.push([tgl, Math.round(nilai), Math.round(modal)]);
    rw.sort((a, b) => a[0] < b[0] ? -1 : 1);
    return { id: x.id, nilai: Math.round(nilai), modal: Math.round(modal), tglNilai: tgl >= (x.tglNilai || '') ? tgl : x.tglNilai, riwayatNilai: rw.slice(-120) };
  };

  /** Beli/setor ke portofolio (dipakai dari halaman Tujuan): saldo dompet turun, modal & nilai portofolio naik. */
  UI.rdSetor = (id, jumlah, tgl, walletId, oleh, catatan) => {
    const i = Calc.investasi('reksadana').find(z => z.x.id === id); if (!i || !jumlah) return;
    const now = new Date().toISOString();
    Store.commit([{ op: 'upsert', t: 'Investasi', row: rowBaru(i.x, i.nilai + jumlah, i.modal + jumlah, tgl) },
      { op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: tgl, jenis: 'aset_beli', jumlah, kategoriId: '', walletId, walletTujuan: '', biaya: 0, catatan: catatan || 'Beli reksa dana ' + lbl(i.x), dibayarOleh: oleh || me(), tag: '', sumber: 'aset', refId: id, periodeRef: tgl.slice(0, 7), dicatatOleh: me(), dibuat: now, riwayat: [] } }]);
  };

  // ---------- Perbarui semua (layar bulanan) ----------
  UI.act('rd-update', (el) => {
    const semua = apps(); if (!semua.length) return UI.rdForm();
    const adaPasangan = semua.some(i => !milikSaya(i.x)), mode = el && el.dataset && el.dataset.semua ? 'semua' : (adaPasangan && semua.some(i => milikSaya(i.x)) ? 'saya' : 'semua');
    const list = mode === 'saya' ? semua.filter(i => milikSaya(i.x)) : semua;
    const s = UI.sheet({ title: 'Perbarui reksa dana', body: `
      ${adaPasangan ? `<div class="chips sm"><button type="button" class="chip ${mode === 'saya' ? 'on' : ''}" data-mode="saya">Milik saya & bersama</button><button type="button" class="chip ${mode === 'semua' ? 'on' : ''}" data-mode="semua">Semua (${semua.length})</button></div>` : ''}
      <p class="muted small">Buka tiap aplikasi, salin <b>total nilai portofolio</b>. Bila ada setoran/autodebet sejak update terakhir, isi juga — agar setoran tidak terhitung sebagai keuntungan.${mode === 'saya' ? ' Portofolio milik pasangan diperbarui dari HP-nya sendiri.' : ''}</p>
      ${grupApp(list).map(g => `<div class="rd-upd-app">${av(g.x, 'sm')}<b>${U.esc(g.nama)}</b></div>` + g.items.map(i => `<div class="rd-upd" data-id="${i.x.id}">
        <div class="rd-upd-h"><b>${ownChip(i.x)}${U.esc(porto(i.x) || (tujuan(i.x) ? tujuan(i.x).nama : 'Portofolio utama'))}</b><small class="muted">lalu ${UI.ms(i.nilai)}${i.x.tglNilai ? ' · ' + U.tgl(i.x.tglNilai, 'dm') : ''}</small></div>
        <div class="grid2">${UI.field('Nilai sekarang', UI.rpInput('v_' + i.x.id, 0, U.fmtNum(Math.round(i.nilai))))}${UI.field('Setoran baru', UI.rpInput('s_' + i.x.id, 0))}</div>
        <small class="rd-upd-hint muted" data-hint="${i.x.id}"></small></div>`).join('')).join('')}
      <div class="grid2">${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}${UI.field('Setoran dibayar dari', `<select name="sumber">${UI.sumberDanaOpts(localStorage.getItem('sa:rdSumber') || '').replace('Sudah dimiliki sebelumnya (tidak memotong saldo)', 'Sudah tercatat / tidak memotong saldo')}</select>`)}</div>
      <small class="muted">Kotak nilai yang dikosongkan = tidak berubah.</small>`,
      foot: `<button class="btn" data-ok>Simpan semua</button>` });
    UI.bindRp(s.el);
    s.el.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { s.close(); setTimeout(() => UI.acts['rd-update'](b.dataset.mode === 'semua' ? { dataset: { semua: 1 } } : null), 220); });
    const hint = () => { const f = UI.formData(s.el); list.forEach(i => {
      const v = Number(f['v_' + i.x.id]) || 0, st = Number(f['s_' + i.x.id]) || 0, el = s.el.querySelector(`[data-hint="${i.x.id}"]`);
      if (!v && !st) { el.innerHTML = ''; return; }
      const nv = v || (i.nilai + st), h = (nv - i.nilai) - st;
      el.innerHTML = `Hasil periode ini: <b class="${h >= 0 ? 'ok' : 'bad'}">${h >= 0 ? '+' : '−'}${U.rp(Math.abs(h))}</b>${i.nilai ? ' (' + (h >= 0 ? '+' : '−') + U.pct(Math.abs(h) / i.nilai, 1) + ')' : ''}`;
    }); };
    s.el.addEventListener('input', hint);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el), tgl = f.tanggal || U.today(), ops = []; let n = 0;
      list.forEach(i => {
        const v = Number(f['v_' + i.x.id]) || 0, st = Number(f['s_' + i.x.id]) || 0;
        if (!v && !st) return;
        const nilai = v || (i.nilai + st), modal = i.modal + st;
        ops.push({ op: 'upsert', t: 'Investasi', row: rowBaru(i.x, nilai, modal, tgl) });
        if (st) ops.push(...UI.opsBeliAset(f.sumber, st, tgl, i.x.id, 'Setor reksa dana ' + lbl(i.x)));
        n++;
      });
      if (!n) return UI.toast('Belum ada angka yang diisi.', 'warn');
      try { localStorage.setItem('sa:rdSumber', f.sumber || ''); } catch (e) {}
      Store.commit(ops); s.close(); UI.toast(n + ' aplikasi diperbarui.');
    };
  });

  // ---------- Tambah / ubah aplikasi ----------
  UI.rdForm = (x, appAwal) => {
    const isNew = !x;
    const appAda = Array.from(new Set(apps().map(i => i.x.nama))), pilihan = appAda.concat(APPS.filter(a => appAda.indexOf(a) < 0));
    x = x || { id: U.uid('i'), kelas: 'reksadana', nama: appAwal || '', kode: '', unit: 0, modal: 0, nilai: 0, tglNilai: U.today(), tanggal: U.today(), walletId: '', tujuanId: '', kepemilikan: {}, jatuhTempo: '', imbal: 0, zakat: true, status: 'aktif', tglJual: '', hargaJual: 0, catatan: '', dibuat: new Date().toISOString(), riwayatNilai: [] };
    const s = UI.sheet({ title: isNew ? (appAwal ? 'Portofolio baru di ' + appAwal : 'Tambah reksa dana') : 'Ubah ' + lbl(x), body: `
      ${UI.field('Aplikasi', `<input name="nama" maxlength="40" value="${U.esc(x.nama)}" placeholder="mis. Bibit">`)}
      ${isNew && !appAwal ? `<div class="chips sm">${pilihan.slice(0, 9).map(a => `<button type="button" class="chip" data-app="${U.esc(a)}">${U.esc(a)}</button>`).join('')}</div>` : ''}
      <div class="grid2">${UI.field('Untuk tujuan', `<select name="tujuanId">${UI.tujuanOpts(x.tujuanId)}</select>`)}${UI.field('Nama portofolio', `<input name="kode" maxlength="40" value="${U.esc(porto(x))}" placeholder="ikut nama tujuan">`, 'Opsional')}</div>
      <div class="grid2">${UI.field('Total disetor', UI.rpInput('modal', x.modal), 'Total uang yang pernah Anda masukkan (bersih)')}${UI.field('Nilai sekarang', UI.rpInput('nilai', x.nilai), 'Total nilai portofolio di aplikasi')}</div>
      ${isNew ? `<div class="grid2">${UI.field('Mulai berinvestasi', `<input type="date" name="tanggal" value="${x.tanggal}">`)}${UI.field('Dana dari', `<select name="sumber">${UI.sumberDanaOpts('')}</select>`)}</div>` : ''}
      ${UI.kepemilikanField(x.kepemilikan)}
      <label class="check"><input type="checkbox" name="zakat" ${x.zakat ? 'checked' : ''}><span>Dihitung untuk zakat mal</span></label>
      ${UI.field('Catatan', `<input name="catatan" maxlength="120" value="${U.esc(x.catatan)}" placeholder="mis. RD pasar uang + saham, autodebet tgl 5">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelectorAll('[data-app]').forEach(b => b.onclick = () => { s.el.querySelector('[name=nama]').value = b.dataset.app; s.el.querySelectorAll('[data-app]').forEach(c => c.classList.toggle('on', c === b)); });
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), kp = UI.readKepemilikan(s.el); if (kp === null) return;
      if (!v.nama) return UI.toast('Nama aplikasi wajib diisi.', 'warn');
      if (!v.modal && !v.nilai) return UI.toast('Isi total disetor atau nilai sekarang.', 'warn');
      v.modal = v.modal || v.nilai; v.nilai = v.nilai || v.modal;
      const sumber = v.sumber; delete v.sumber;
      if (sumber && sumber.indexOf('g:') === 0 && !v.tujuanId) v.tujuanId = sumber.slice(2);
      v.nama = String(v.nama).trim(); const ada = appAda.find(a => a.toLowerCase() === v.nama.toLowerCase()); if (ada) v.nama = ada;   // satukan ejaan nama aplikasi
      v.kode = String(v.kode || '').trim();
      if (isNew && apps().some(i => i.x.nama === v.nama && porto(i.x) === v.kode && (i.x.tujuanId || '') === (v.tujuanId || ''))) return UI.toast('Portofolio ini sudah ada. Beri nama portofolio yang berbeda.', 'warn');
      let row = Object.assign({}, x, v, { kepemilikan: kp, unit: 0 });
      if (isNew) row.riwayatNilai = [[row.tanggal, row.modal, row.modal]].concat(row.nilai !== row.modal || row.tanggal !== U.today() ? [[U.today(), row.nilai, row.modal]] : []);
      if (isNew) row.tglNilai = U.today();
      else if (v.nilai !== Number(x.nilai) || v.modal !== Number(x.modal)) row = Object.assign(row, rowBaru(x, v.nilai, v.modal, U.today()));
      Store.commit([{ op: 'upsert', t: 'Investasi', row }].concat(isNew ? UI.opsBeliAset(sumber, row.modal, row.tanggal, row.id, 'Reksa dana ' + lbl(row)) : []));
      s.close(); UI.toast(isNew ? lbl(row) + ' ditambahkan.' : 'Tersimpan.');
    };
    const d = s.el.querySelector('[data-del]');
    if (d) d.onclick = async () => { if (await UI.confirm('Hapus ' + lbl(x) + '?', 'Riwayat nilainya ikut terhapus. Transaksi terkait tetap ada di Mutasi.', 'Hapus', true)) { Store.remove('Investasi', x.id); s.close(); } };
  };
  UI.act('rd-add', el => UI.rdForm(null, el && el.dataset && el.dataset.app));

  // ---------- Detail satu aplikasi ----------
  UI.act('rd-open', el => {
    const i = apps().find(z => z.x.id === el.dataset.id); if (!i) return;
    const x = i.x, p = titik(x), col = warna(x.nama);
    const riw = p.slice().reverse().slice(0, 8);
    const s = UI.sheet({ title: lbl(x), body: `
      <div class="detail-head">${av(x, 'lg')}<div><small class="muted">${U.esc(x.nama)}${tujuan(x) ? ' · untuk ' + U.esc(tujuan(x).nama) : ''} · ${U.esc(UI.ownLabel(x.kepemilikan))}</small><div class="big-amt">${UI.m(i.nilai)}</div>
        <small class="${i.untung >= 0 ? 'ok' : 'bad'}">${i.untung >= 0 ? '+' : '−'}${UI.m(Math.abs(i.untung))} (${U.pct(Math.abs(i.pct), 1)}) dari setoran ${UI.ms(i.modal)}</small></div></div>
      ${p.length > 1 ? Charts.line(p.map(t => ({ d: t.d, bal: t.v })), { fit: true, fmt: 'mys', aria: 'Riwayat nilai ' + x.nama, compare: p.map(t => ({ d: t.d, bal: t.m })) }) : ''}
      <h4 class="mini-h">Riwayat update</h4>
      <div class="kv-list">${riw.map((t, k) => { const prev = p[p.length - 2 - k]; const h = prev ? (t.v - prev.v) - (t.m - prev.m) : 0, st = prev ? t.m - prev.m : 0;
        return `<div class="kv"><span>${U.tgl(t.d)}${st ? ` <small class="muted">${st > 0 ? 'setor' : 'tarik'} ${UI.ms(Math.abs(st))}</small>` : ''}</span><b>${UI.ms(t.v)}${prev ? ` <small class="${h >= 0 ? 'ok' : 'bad'}">${h >= 0 ? '+' : '−'}${UI.ms(Math.abs(h))}</small>` : ''}</b></div>`; }).join('')}</div>
      ${x.catatan ? `<p class="muted small">${U.esc(x.catatan)}</p>` : ''}`,
      foot: `<button class="btn ghost" data-a="edit" aria-label="Ubah">${I('pencil')}</button><button class="btn ghost" data-a="tarik">${I('hand-coins')} Tarik</button><button class="btn" data-a="update">${I('refresh-cw')} Perbarui</button>` });
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { const a = b.dataset.a; s.close(); if (a === 'edit') UI.rdForm(x); else if (a === 'tarik') tarikForm(i); else UI.acts['rd-update'](); });
  });

  // ---------- Tarik dana (sebagian / semua) ----------
  function tarikForm(i) {
    const x = i.x;
    const s = UI.sheet({ title: 'Tarik dari ' + lbl(x), cls: 'small', body: `
      ${UI.field('Uang diterima', UI.rpInput('jumlah', 0), 'Nilai sekarang ' + U.rp(i.nilai))}
      <div class="grid2">${UI.field('Masuk ke', `<select name="walletId">${UI.walletOpts(localStorage.getItem('sa:lastWallet'))}</select>`)}${UI.field('Tanggal', `<input type="date" name="tanggal" value="${U.today()}">`)}</div>
      <div class="calc-hint small"></div>`, foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    const hint = s.el.querySelector('.calc-hint');
    const calc = () => { const j = UI.formData(s.el).jumlah || 0, frac = i.nilai ? U.clamp(j / i.nilai, 0, 1) : 1, modal = Math.round(i.modal * frac);
      hint.innerHTML = j ? (frac > 0.999 ? 'Semua dana ditarik — aplikasi dipindah ke "Sudah ditarik semua".' : `Sisa nilai ${U.rp(i.nilai - j)} · setoran yang ikut ditarik ${U.rp(modal)}`) : ''; return { j, frac, modal }; };
    s.el.addEventListener('input', calc);
    s.el.querySelector('[data-ok]').onclick = () => {
      const v = UI.formData(s.el), r = calc(); if (!r.j) return UI.toast('Isi jumlah yang ditarik.', 'warn');
      const now = new Date().toISOString(), ops = [];
      if (r.frac > 0.999) ops.push({ op: 'upsert', t: 'Investasi', row: Object.assign(rowBaru(x, 0, i.modal, v.tanggal), { nilai: i.nilai, status: 'terjual', tglJual: v.tanggal, hargaJual: r.j }) });
      else ops.push({ op: 'upsert', t: 'Investasi', row: rowBaru(x, i.nilai - r.j, i.modal - r.modal, v.tanggal) });
      ops.push({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: v.tanggal, jenis: 'aset_jual', jumlah: r.j, kategoriId: '', walletId: v.walletId, walletTujuan: '', biaya: 0, catatan: 'Tarik reksa dana ' + lbl(x), dibayarOleh: me(), tag: '', sumber: 'aset', refId: x.id, periodeRef: '', dicatatOleh: me(), dibuat: now, riwayat: [] } });
      Store.commit(ops); s.close(); UI.toast(U.rp(r.j) + ' masuk ke dompet.');
    };
  }
})();
