/* Rapor — arus kas, rincian, perbandingan, rasio & skor, ekspor */
(function () {
  const I = UI.icon;
  const R = { off: 0, by: 'kategori', n: 6 };
  const per = () => Calc.periodShift(Calc.period(), R.off);
  const PAL = ['#0F5E59', '#F2B33D', '#476364', '#90D5CE', '#B76E00', '#6F7977', '#2E8C84', '#C7E5E6', '#8C5A00', '#BEC9C7'];

  UI.act('rap-shift', el => { R.off = Math.min(0, R.off + Number(el.dataset.d)); UI.render(); });
  UI.act('rap-bar', el => { const i = Number(el.dataset.i); R.off = i - (R.n - 1) - 0 + R.base; UI.render(); });
  UI.act('rap-by', el => { R.by = el.dataset.v; UI.render(); });
  UI.act('rap-n', el => { R.n = Number(el.dataset.v); UI.render(); });
  UI.act('rap-cat', el => { if (R.by === 'kategori') UI.mutasiFilter({ off: R.off, kat: el.dataset.k }); else if (R.by === 'wallet') UI.mutasiFilter({ off: R.off, wallet: el.dataset.k }); else if (R.by === 'anggota') UI.mutasiFilter({ off: R.off, who: el.dataset.k }); else UI.mutasiFilter({ off: R.off, q: el.dataset.k === '(tanpa tag)' ? '' : el.dataset.k }); });

  const nav = () => `<div class="period-nav"><button class="icon-btn" data-act="rap-shift" data-d="-1">${I('chevron-left')}</button><span class="period-lb">${U.esc(per().label)}</span><button class="icon-btn" data-act="rap-shift" data-d="1" ${R.off >= 0 ? 'disabled' : ''}>${I('chevron-right')}</button></div>`;
  function barsFor(n) {
    // jendela n periode yang berakhir di periode terpilih (atau periode ini)
    const end = Math.min(0, R.off + Math.floor(n / 2));
    R.base = end;
    const ser = C_series(n, end);
    const sel = ser.findIndex(x => x.p.key === per().key);
    return { ser, sel, html: Charts.bars(ser.map(x => ({ label: U.BLN[U.parseDate(x.p.start).getMonth()], a: x.masuk, b: x.keluar })), { selected: sel, act: 'rap-bar', aria: 'Pemasukan & pengeluaran per periode' }) };
  }
  function C_series(n, end) { const last = Calc.periodShift(Calc.period(), end); return Calc.lastPeriods(n, last.start).map(p => Object.assign({ p }, Calc.periodTotals(p))); }

  const TILES = cur => UI.tiles([
    { id: '', icon: 'chart-column', label: 'Ringkasan', to: 'rapor' },
    { id: 'rincian', icon: 'chart-pie', label: 'Rincian', to: 'rapor/rincian' },
    { id: 'banding', icon: 'git-compare', label: 'Perbandingan', to: 'rapor/banding' },
    { id: 'rasio', icon: 'heart-pulse', label: 'Rasio & Skor', to: 'rapor/rasio' },
    { id: 'tren', icon: 'trending-up', label: 'Tren 12 Bulan', to: 'rapor/tren' },
    { id: 'ekspor', icon: 'file-down', label: 'Ekspor PDF/Excel', to: 'rapor/ekspor' },
    { id: 'spt', icon: 'file-text', label: 'Ringkasan SPT', soon: true, act: 'soon' },
    { id: 'kilas', icon: 'sparkles', label: 'Kilas Balik', soon: true, act: 'soon' }
  ], cur);

  UI.page('rapor', {
    head: p => p ? { title: { rincian: 'Rincian Pengeluaran', banding: 'Perbandingan', rasio: 'Rasio & Skor Kesehatan', tren: 'Tren 12 Bulan', ekspor: 'Ekspor Laporan' }[p] || 'Rapor', crumb: 'Rapor', back: 'rapor' } : null,
    nav: () => 'rapor',
    render(p) {
      if (!Store.can('rapor', 'lihat')) return UI.empty('lock', 'Tidak ada akses', 'Minta Admin memberi izin menu Rapor.');
      if (p === 'rincian') return rincian();
      if (p === 'banding') return banding();
      if (p === 'rasio') return rasio();
      if (p === 'tren') return tren();
      if (p === 'ekspor') return ekspor();
      const pp = per(), t = Calc.periodTotals(pp), b = barsFor(6), bd = Calc.breakdown(pp, 'kategori').slice(0, 5), cmp = Calc.compare(pp), sc = Calc.score();
      return `${TILES('')}${nav()}
        <div class="stat3"><div class="stat in"><small>Masuk</small><b>${UI.ms(t.masuk)}</b></div><div class="stat out"><small>Keluar</small><b>${UI.ms(t.keluar)}</b></div><div class="stat ${t.net >= 0 ? 'in' : 'out'}"><small>Selisih</small><b>${t.net >= 0 ? '+' : '−'}${UI.ms(Math.abs(t.net))}</b></div></div>
        <div class="card"><div class="row-sp"><b>Arus kas 6 periode</b><span class="legend-inline"><i class="a"></i>Masuk <i class="b"></i>Keluar</span></div>${b.html}<small class="muted">Ketuk batang untuk melihat periode itu.</small></div>
        <div class="card score-mini" data-act="go" data-to="rapor/rasio">${Charts.ring(sc.total, 100, 'Skor kesehatan')}<div><b>Skor kesehatan keuangan</b><small class="muted">${sc.total >= 80 ? 'Sangat baik — pertahankan!' : sc.total >= 60 ? 'Cukup baik, ada ruang perbaikan.' : 'Perlu perhatian — lihat sarannya.'}</small><span class="link">Lihat rincian ${I('chevron-right')}</span></div></div>
        ${UI.sec('Pengeluaran terbesar', '<a class="link" href="#/rapor/rincian">Rincian</a>')}
        <div class="card list">${bd.map((x, i) => `<div class="row" data-act="rap-cat" data-k="${U.esc(x.k)}"><span class="dot-c" style="background:${PAL[i]}"></span><div class="grow"><div class="row-sp"><b>${U.esc(x.label)}</b><b>${UI.ms(x.v)}</b></div>${UI.bar(x.pct, 'aman')}</div><small>${U.pct(x.pct)}</small></div>`).join('') || '<div class="row muted">Belum ada pengeluaran.</div>'}</div>
        ${cmp.naik.length ? `<div class="alert warn">${I('trending-up')}<div><b>Naik dari rata-rata 3 periode</b><small>${cmp.naik.map(x => U.esc(x.label) + ' +' + U.pct(x.deltaPct)).join(' · ')}</small></div></div>` : ''}
        ${cmp.turun.length ? `<div class="alert ok">${I('trending-down')}<div><b>Lebih hemat</b><small>${cmp.turun.map(x => U.esc(x.label) + ' ' + U.pct(x.deltaPct)).join(' · ')}</small></div></div>` : ''}
        <div class="spacer"></div>`;
    }
  });

  function rincian() {
    const pp = per(), bd = Calc.breakdown(pp, R.by), tot = U.sum(bd, x => x.v);
    const top = bd.slice(0, 9), rest = U.sum(bd.slice(9), x => x.v);
    const parts = top.map((x, i) => ({ v: x.v, color: PAL[i] })).concat(rest ? [{ v: rest, color: PAL[9] }] : []);
    return `${TILES('rincian')}${nav()}
      <div class="chips">${[['kategori', 'Kategori'], ['anggota', 'Anggota'], ['wallet', 'Dompet'], ['tag', 'Tag']].map(x => `<button class="chip ${R.by === x[0] ? 'on' : ''}" data-act="rap-by" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>
      <div class="card donut-card">${Charts.donut(parts.length ? parts : [{ v: 1, color: 'var(--outline-variant)' }], ['Total keluar', UI.ms(tot)])}</div>
      <div class="card list">${bd.map((x, i) => `<div class="row" data-act="rap-cat" data-k="${U.esc(x.k)}"><span class="dot-c" style="background:${PAL[Math.min(i, 9)]}"></span><div class="tx-txt"><b>${U.esc(x.label)}</b><small>${U.pct(x.pct, 1)}</small></div><b>${UI.m(x.v)}</b>${I('chevron-right')}</div>`).join('') || '<div class="row muted">Belum ada pengeluaran.</div>'}</div>
      <p class="muted small">Ketuk baris untuk melihat transaksinya di Mutasi. Biaya admin transfer dihitung sebagai pengeluaran.</p><div class="spacer"></div>`;
  }
  function banding() {
    const pp = per(), c = Calc.compare(pp);
    const rows = c.rows.filter(r => r.cur || r.prev || r.avg).sort((a, b) => b.cur - a.cur);
    const d = (v, base) => { if (!base) return '<small class="muted">baru</small>'; const x = (v - base) / base; return `<small class="${x > 0.05 ? 'bad' : x < -0.05 ? 'ok' : 'muted'}">${x > 0 ? '▲' : x < 0 ? '▼' : '•'} ${U.pct(Math.abs(x))}</small>`; };
    return `${TILES('banding')}${nav()}
      <div class="stat3"><div class="stat"><small>Periode ini</small><b>${UI.ms(c.tot.keluar)}</b></div><div class="stat"><small>Periode lalu</small><b>${UI.ms(c.totPrev.keluar)}</b>${d(c.tot.keluar, c.totPrev.keluar)}</div><div class="stat"><small>Rata-rata 3 per.</small><b>${UI.ms(c.avgOut)}</b>${d(c.tot.keluar, c.avgOut)}</div></div>
      <div class="card"><table class="tbl"><thead><tr><th>Kategori</th><th>Ini</th><th>Lalu</th><th>Rata² 3</th></tr></thead><tbody>${rows.map(r => `<tr><td>${U.esc(r.label)}</td><td><b>${U.rpShort(r.cur)}</b></td><td>${U.rpShort(r.prev)}</td><td>${U.rpShort(r.avg)} ${d(r.cur, r.avg)}</td></tr>`).join('')}</tbody></table></div><div class="spacer"></div>`;
  }
  function rasio() {
    const sc = Calc.score(), r = Calc.ratios(Calc.periodShift(Calc.period(), -1)), ef = Calc.emergency();
    const saran = [];
    if (ef.bulan < ef.target) saran.push(['shield', 'Perkuat dana darurat', 'Baru ' + U.fmtNum(ef.bulan * 10 / 10) + ' dari ' + ef.target + ' bulan. Tambah setoran ke Tujuan Dana Darurat.', 'tujuan']);
    if (r.dsr > 0.3) saran.push(['scale', 'Turunkan beban cicilan', 'Cicilan ' + U.pct(r.dsr, 1) + ' dari pemasukan. Coba strategi Avalanche.', 'utang/strategi']);
    if (r.tabungan < 0.1) saran.push(['piggy-bank', 'Naikkan porsi tabungan', 'Targetkan minimal 10–20% pemasukan. Atur di Bagi Gaji.', 'anggaran/bagi']);
    if (r.ingin > 0.3) saran.push(['shopping-bag', 'Rem pengeluaran keinginan', U.pct(r.ingin) + ' pemasukan untuk keinginan (saran ≤30%).', 'anggaran']);
    return `${TILES('rasio')}
      <div class="card score-big">${Charts.ring(sc.total, 100, sc.total >= 80 ? 'Sangat baik' : sc.total >= 60 ? 'Cukup baik' : 'Perlu perhatian')}</div>
      <div class="card list">${sc.comp.map(c => `<div class="row"><div class="grow"><div class="row-sp"><b>${U.esc(c.nama)}</b><b>${Math.round(c.v)}/20</b></div>${UI.bar(c.v / 20, c.v >= 15 ? 'aman' : c.v >= 10 ? 'hampir' : 'lewat')}<small class="muted">${U.esc(c.info)}</small></div></div>`).join('')}</div>
      ${UI.sec('Rasio periode lalu')}
      <div class="ratio-grid">${[['Tabungan', r.tabungan, '≥ 20%', r.tabungan >= 0.2], ['Kebutuhan', r.butuh, '≤ 50–60%', r.butuh <= 0.6], ['Keinginan', r.ingin, '≤ 30%', r.ingin <= 0.3], ['Cicilan (DSR)', r.dsr, '≤ 30%', r.dsr <= 0.3]].map(x => `<div class="ratio ${x[3] ? 'ok' : 'bad'}"><small>${x[0]}</small><b>${U.pct(Math.max(0, x[1]), 1)}</b><small>sehat ${x[2]}</small></div>`).join('')}
        <div class="ratio ${r.likuidBulan >= ef.target ? 'ok' : 'bad'}"><small>Dana likuid</small><b>${U.fmtNum(r.likuidBulan * 10 / 10)} bln</b><small>target ${ef.target} bln</small></div></div>
      ${saran.length ? UI.sec('Saran') + `<div class="card list">${saran.map(s => `<div class="row" data-act="go" data-to="${s[3]}"><span class="cat-ic">${I(s[0])}</span><div class="tx-txt"><b>${s[1]}</b><small>${U.esc(s[2])}</small></div>${I('chevron-right')}</div>`).join('')}</div>` : ''}
      <p class="muted small">Skor dihitung dari 5 komponen × 20 poin berdasarkan periode lalu. Ini panduan umum, bukan nasihat keuangan profesional.</p><div class="spacer"></div>`;
  }
  function tren() {
    const ser = Calc.series(12);
    return `${TILES('tren')}<div class="card"><div class="row-sp"><b>12 periode terakhir</b><span class="legend-inline"><i class="a"></i>Masuk <i class="b"></i>Keluar</span></div>
      ${Charts.bars(ser.map(x => ({ label: U.BLN[U.parseDate(x.p.start).getMonth()].slice(0, 3), a: x.masuk, b: x.keluar })), { aria: 'Tren 12 periode' })}</div>
      <div class="card"><table class="tbl"><thead><tr><th>Periode</th><th>Masuk</th><th>Keluar</th><th>Ditabung</th><th>Selisih</th></tr></thead><tbody>${ser.slice().reverse().map(x => `<tr><td>${U.tgl(x.p.start, 'mys')}</td><td>${U.rpShort(x.masuk)}</td><td>${U.rpShort(x.keluar)}</td><td>${U.rpShort(x.tabung)}</td><td class="${x.net >= 0 ? 'ok' : 'bad'}">${x.net >= 0 ? '+' : '−'}${U.rpShort(Math.abs(x.net))}</td></tr>`).join('')}</tbody></table>
      <small class="muted">Total 12 periode: masuk ${UI.ms(U.sum(ser, x => x.masuk))}, keluar ${UI.ms(U.sum(ser, x => x.keluar))}.</small></div><div class="spacer"></div>`;
  }

  // ---------- Ekspor ----------
  UI.act('exp-csv', () => {
    const f = UI.formData(document.getElementById('exp-form'));
    const rows = [['Tanggal', 'Jenis', 'Kategori', 'Kelompok', 'Dompet', 'Ke Dompet', 'Jumlah', 'Biaya Admin', 'Catatan', 'Tag', 'Dibayar oleh', 'Dicatat oleh']];
    Calc.txSorted().filter(t => t.tanggal >= f.dari && t.tanggal <= f.sampai).slice().reverse().forEach(t => {
      const k = Store.byId.Kategori[t.kategoriId] || {}, pv = UI.isPrivate(t);
      rows.push([t.tanggal, Calc.JENIS_LABEL[t.jenis], k.nama || '', k.kelompok || '', (Store.byId.Wallet[t.walletId] || {}).nama || '', (Store.byId.Wallet[t.walletTujuan] || {}).nama || '', t.jenis === 'keluar' ? -t.jumlah : t.jumlah, t.biaya || 0, pv ? '' : t.catatan, pv ? '' : t.tag, Store.memberName(t.dibayarOleh || t.dicatatOleh), Store.memberName(t.dicatatOleh)]);
    });
    U.download('satuatap-transaksi-' + f.dari + '_' + f.sampai + '.csv', '﻿' + U.csv(rows), 'text/csv');
    UI.toast((rows.length - 1) + ' transaksi diekspor. Buka dengan Excel / Google Sheets.');
  });
  UI.act('exp-pdf', () => {
    const f = UI.formData(document.getElementById('exp-form'));
    const ps = Calc.lastPeriods(12).filter(p => p.end >= f.dari && p.start <= f.sampai);
    const fam = Store.setting('namaKeluarga', 'Keluarga');
    const w = window.open('', '_blank');
    if (!w) return UI.toast('Izinkan pop-up untuk mencetak PDF.', 'warn');
    const rowsP = ps.map(p => { const t = Calc.periodTotals(p); return `<tr><td>${U.esc(p.label)}</td><td>${U.rp(t.masuk)}</td><td>${U.rp(t.keluar)}</td><td>${U.rp(t.tabung)}</td><td>${U.rp(t.net)}</td></tr>`; }).join('');
    const last = ps[ps.length - 1] || Calc.period(), bd = Calc.breakdown(last, 'kategori');
    const nw = Calc.netWorth(), sc = Calc.score();
    w.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>Rapor Keuangan ${U.esc(fam)}</title><style>
      body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#151d1d;margin:32px;font-size:12px}h1{color:#0F5E59;margin:0}h2{color:#0F5E59;font-size:15px;margin-top:24px;border-bottom:2px solid #F2B33D;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:6px 8px;border-bottom:1px solid #dbe4e3;text-align:right}td:first-child,th:first-child{text-align:left}th{background:#ecf5f4}
      .kv{display:flex;gap:24px;flex-wrap:wrap}.kv div{background:#ecf5f4;padding:10px 14px;border-radius:10px}.kv b{display:block;font-size:15px}.foot{margin-top:32px;color:#6f7977;font-size:10px}</style></head><body>
      <h1>Rapor Keuangan</h1><div>${U.esc(fam)} · ${U.tgl(f.dari)} – ${U.tgl(f.sampai)}</div>
      <h2>Ringkasan</h2><div class="kv"><div>Kekayaan bersih<b>${U.rp(nw.bersih)}</b></div><div>Kas & bank<b>${U.rp(nw.kas)}</b></div><div>Total utang<b>${U.rp(nw.utang)}</b></div><div>Skor kesehatan<b>${sc.total}/100</b></div></div>
      <h2>Arus kas per periode</h2><table><tr><th>Periode</th><th>Masuk</th><th>Keluar</th><th>Ditabung</th><th>Selisih</th></tr>${rowsP}</table>
      <h2>Rincian pengeluaran · ${U.esc(last.label)}</h2><table><tr><th>Kategori</th><th>Jumlah</th><th>%</th></tr>${bd.map(x => `<tr><td>${U.esc(x.label)}</td><td>${U.rp(x.v)}</td><td>${U.pct(x.pct, 1)}</td></tr>`).join('')}</table>
      <h2>Tujuan</h2><table><tr><th>Tujuan</th><th>Terkumpul</th><th>Target</th><th>%</th></tr>${Calc.goals().filter(g => !g.t.arsip && (g.t.jenis !== 'pribadi' || g.t.pemilik === Store.me.email)).map(g => `<tr><td>${U.esc(g.t.nama)}</td><td>${U.rp(g.saldo)}</td><td>${U.rp(g.target)}</td><td>${U.pct(Math.min(1, g.pct))}</td></tr>`).join('')}</table>
      <div class="foot">Dibuat dengan SatuAtap — Keuangan keluarga, di bawah satu atap. · ${new Date().toLocaleString('id-ID')}</div>
      <script>setTimeout(function(){window.print()},400)<\/script></body></html>`);
    w.document.close();
  });
  function ekspor() {
    const p = Calc.period();
    return `${TILES('ekspor')}<div class="card" id="exp-form">
      <div class="grid2">${UI.field('Dari', `<input type="date" name="dari" value="${Calc.periodShift(p, -2).start}">`)}${UI.field('Sampai', `<input type="date" name="sampai" value="${U.today()}">`)}</div>
      <div class="row-btns"><button class="btn" data-act="exp-pdf">${I('file-text')} Rapor PDF</button><button class="btn ghost" data-act="exp-csv">${I('sheet')} Excel (CSV)</button></div>
      <p class="muted small">PDF dibuka di jendela cetak — pilih "Simpan sebagai PDF". File CSV bisa dibuka langsung di Excel atau Google Sheets.</p></div>
      <div class="alert info">${I('mail')}<div><b>Ringkasan bulanan otomatis</b><small>Setiap awal periode, ringkasan arus kas periode lalu dikirim ke email semua anggota (atur di Pengaturan › Notifikasi).</small></div></div>
      <div class="note">${I('database')} Seluruh data mentah juga tersimpan di Google Sheets milik keluarga Anda sendiri.</div><div class="spacer"></div>`;
  }
})();
