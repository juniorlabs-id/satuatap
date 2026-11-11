/* Zakat & sedekah (mal, penghasilan, fitrah, qurban, sedekah/donasi) + Ringkasan SPT */
(function () {
  const I = UI.icon;
  const katZakat = () => (Store.t.Kategori.find(k => k.jenis === 'keluar' && /zakat|sedekah/i.test(k.nama) && !k.arsip) || Store.kategori('keluar')[0] || {}).id || '';
  UI.bayarZakat = (tag, jumlah, catatan) => UI.catat({ preset: { jenis: 'keluar', jumlah: Math.round(jumlah || 0), kategoriId: katZakat(), catatan, tag } });
  UI.act('zk-bayar', el => UI.bayarZakat(el.dataset.tag, Number(el.dataset.v), el.dataset.cat));
  UI.act('zk-set', () => {
    const v = k => Store.setting(k, '');
    const s = UI.sheet({ title: 'Pengaturan zakat', body: `
      ${UI.field('Awal haul zakat mal', `<input type="date" name="zakatHaul" value="${v('zakatHaul')}">`, 'Tanggal harta pertama kali mencapai nisab, atau tanggal yang biasa dipakai keluarga (mis. 1 Ramadan). Haul = 1 tahun Hijriah (354 hari).')}
      <div class="grid2">${UI.field('Nisab (gram emas)', `<input type="number" name="nisabGram" value="${v('nisabGram') || 85}">`)}${UI.field('Harga emas untuk nisab', `<select name="nisabHarga"><option value="beli" ${v('nisabHarga') !== 'buyback' ? 'selected' : ''}>Harga beli</option><option value="buyback" ${v('nisabHarga') === 'buyback' ? 'selected' : ''}>Harga buyback</option></select>`)}</div>
      ${UI.field('Utang yang mengurangi harta', `<select name="zakatUtang"><option value="jatuhTempo" ${v('zakatUtang') !== 'semua' && v('zakatUtang') !== 'tidak' ? 'selected' : ''}>Yang jatuh tempo 30 hari ke depan</option><option value="semua" ${v('zakatUtang') === 'semua' ? 'selected' : ''}>Seluruh sisa utang</option><option value="tidak" ${v('zakatUtang') === 'tidak' ? 'selected' : ''}>Tidak dikurangi</option></select>`, 'Pendapat ulama berbeda — pilih yang diyakini keluarga.')}
      <label class="check"><input type="checkbox" name="zakatPiutang" ${v('zakatPiutang') !== 'false' ? 'checked' : ''}><span>Piutang yang lancar dihitung sebagai harta</span></label>
      <div class="grid2">${UI.field('Jumlah jiwa (fitrah)', `<input type="number" min="1" name="zakatJiwa" value="${v('zakatJiwa') || Store.members().length}">`)}${UI.field('Tarif fitrah / jiwa', UI.rpInput('zakatFitrahTarif', Number(v('zakatFitrahTarif')) || 50000), 'Ikuti ketetapan BAZNAS/daerah')}</div>
      ${UI.field('Target sedekah (% pemasukan / bulan)', `<input type="number" step="0.5" min="0" name="sedekahTarget" value="${v('sedekahTarget') || 2.5}">`)}`, foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      Store.commit(Object.keys(f).map(k => ({ op: 'upsert', t: 'Pengaturan', row: { id: k, nilai: typeof f[k] === 'boolean' ? String(f[k]) : String(f[k]) } })));
      s.close(); UI.toast('Pengaturan zakat disimpan.');
    };
  });

  const TILES = cur => UI.tiles([
    { id: '', icon: 'hand-heart', label: 'Zakat Mal', to: 'zakat', gold: true }, { id: 'penghasilan', icon: 'banknote', label: 'Zakat Penghasilan', to: 'zakat/penghasilan', gold: true },
    { id: 'fitrah', icon: 'moon-star', label: 'Zakat Fitrah', to: 'zakat/fitrah', gold: true }, { id: 'qurban', icon: 'beef', label: 'Qurban', to: 'zakat/qurban', gold: true },
    { id: 'sedekah', icon: 'heart-handshake', label: 'Sedekah & Donasi', to: 'zakat/sedekah', gold: true }, { id: 'riwayat', icon: 'history', label: 'Riwayat', to: 'zakat/riwayat', gold: true },
    { id: 'set', icon: 'settings', label: 'Pengaturan', act: 'zk-set', gold: true }, { id: 'emas', icon: 'gem', label: 'Brankas Emas', to: 'emas', gold: true }
  ], cur);
  const status = (wajib, kurang, dibayar) => !wajib ? UI.pill('Belum wajib', '') : kurang <= 0 ? UI.pill('Lunas', 'ok') : dibayar ? UI.pill('Kurang ' + U.rpShort(kurang), 'warn') : UI.pill('Wajib', 'bad');

  UI.page('zakat', {
    head: p => ({ title: { penghasilan: 'Zakat Penghasilan', fitrah: 'Zakat Fitrah', qurban: 'Qurban', sedekah: 'Sedekah & Donasi', riwayat: 'Riwayat Zakat & Sedekah' }[p] || 'Zakat & Sedekah', crumb: p ? 'Zakat' : 'Lainnya', back: p ? 'zakat' : 'lainnya',
      right: `<button class="icon-btn" data-act="zk-set" aria-label="Pengaturan">${I('settings')}</button>` }),
    nav: () => 'lainnya',
    render(p) {
      if (Store.mode === 'live') Harga.fetch();
      const h = Calc.hargaEmas();
      if (p === 'penghasilan') {
        const z = Calc.zakatPenghasilan(), prev = Calc.zakatPenghasilan(Calc.periodShift(Calc.period(), -1));
        const row = x => `<div class="card"><div class="row-sp"><b>${U.esc(x.p.label)}</b>${status(x.wajib, x.kurang, x.dibayar)}</div>
          <div class="kv-list"><div class="kv"><span>Pemasukan bruto</span><b>${UI.m(x.inc)}</b></div><div class="kv"><span>Nisab per bulan (nisab ÷ 12)</span><b>${UI.m(x.nisabBulan)}</b></div><div class="kv"><span>Zakat 2,5%</span><b>${UI.m(x.zakat)}</b></div><div class="kv"><span>Sudah dibayar</span><b>${UI.m(x.dibayar)}</b></div></div>
          ${x.kurang > 0 ? `<button class="btn block gold" data-act="zk-bayar" data-tag="zakat-penghasilan" data-v="${x.kurang}" data-cat="Zakat penghasilan ${U.esc(x.p.label)}">${I('hand-heart')} Bayar ${U.rp(x.kurang)}</button>` : ''}</div>`;
        return TILES('penghasilan') + row(z) + row(prev) + `<p class="muted small">Metode BAZNAS: 2,5% dari penghasilan bruto bila mencapai nisab bulanan (setara 85 g emas ÷ 12). Bila keluarga memilih zakat mal tahunan saja, abaikan bagian ini.</p><div class="spacer"></div>`;
      }
      if (p === 'fitrah') {
        const f = Calc.zakatFitrah();
        return TILES('fitrah') + `<div class="card"><div class="row-sp"><b>Zakat fitrah ${f.tahunH} H</b>${status(true, f.kurang, f.dibayar)}</div>
          <div class="kv-list"><div class="kv"><span>Jumlah jiwa</span><b>${f.jiwa} orang</b></div><div class="kv"><span>Tarif per jiwa</span><b>${U.rp(f.tarif)}</b></div><div class="kv"><span>Total</span><b>${U.rp(f.total)}</b></div><div class="kv"><span>Sudah dibayar</span><b>${U.rp(f.dibayar)}</b></div></div>
          ${f.kurang > 0 ? `<button class="btn block gold" data-act="zk-bayar" data-tag="zakat-fitrah-${f.tahunH}" data-v="${f.kurang}" data-cat="Zakat fitrah ${f.jiwa} jiwa ${f.tahunH} H">${I('moon-star')} Bayar ${U.rp(f.kurang)}</button>` : ''}</div>
          <p class="muted small">Ubah jumlah jiwa & tarif di Pengaturan zakat. Tarif mengikuti ketetapan BAZNAS daerah masing-masing (setara 2,5 kg / 3,5 liter beras).</p><div class="spacer"></div>`;
      }
      if (p === 'qurban') {
        const gq = Calc.goals().filter(x => /qurban|kurban/i.test(x.t.nama) && !x.t.arsip);
        return TILES('qurban') + (gq.length ? gq.map(x => `<div class="goal-card" data-act="go" data-to="tujuan/${x.t.id}">${Charts.jar(x.pct, true)}<div class="grow"><b>${U.esc(x.t.nama)}</b><div class="row-sp"><span>${UI.ms(x.saldo)} / ${UI.ms(x.target)}</span><b>${U.pct(Math.min(1, x.pct))}</b></div>${UI.bar(x.pct, 'aman')}<small class="muted">${x.t.tenggat ? 'Tenggat ' + U.tgl(x.t.tenggat) : ''}${x.aset ? ' · termasuk emas/aset ' + UI.ms(x.aset) : ''}</small></div></div>`).join('')
          : UI.empty('beef', 'Belum ada tabungan qurban', 'Buat Tujuan "Qurban" agar setoran bulanannya terpantau. Bisa juga ditautkan ke emas.', `<button class="btn" data-act="goal-new">${I('plus')} Buat tujuan</button>`)) +
          `<button class="btn block ghost" data-act="zk-bayar" data-tag="qurban" data-v="0" data-cat="Qurban">${I('check')} Catat pembayaran qurban</button><div class="spacer"></div>`;
      }
      if (p === 'sedekah') {
        const sd = Calc.sedekah(), per = {};
        Store.t.Transaksi.filter(t => t.jenis === 'keluar' && /^(sedekah|infak|donasi|wakaf)/.test(t.tag || '')).forEach(t => { const k = UI.note(t) || 'Tanpa keterangan'; per[k] = (per[k] || 0) + t.jumlah; });
        const top = Object.keys(per).sort((a, b) => per[b] - per[a]).slice(0, 10);
        return TILES('sedekah') + `<div class="card"><div class="row-sp"><b>${U.esc(sd.p.label)}</b><b>${UI.m(sd.total)}</b></div>${UI.bar(sd.targetRp ? sd.total / sd.targetRp : 0, 'aman')}
            <small class="muted">${U.pct(sd.pct, 1)} dari pemasukan · target ${sd.target}% = ${UI.m(sd.targetRp)}</small></div>
          <div class="chips">${[['sedekah', 'Sedekah'], ['infak', 'Infak'], ['donasi', 'Donasi'], ['wakaf', 'Wakaf']].map(x => `<button class="chip" data-act="zk-bayar" data-tag="${x[0]}" data-v="0" data-cat="">${I('plus')} ${x[1]}</button>`).join('')}</div>
          ${UI.sec('Penerima terbanyak', '<small class="muted">sepanjang waktu</small>')}<div class="card list">${top.map(k => `<div class="row"><span class="cat-ic">${I('heart-handshake')}</span><div class="tx-txt"><b>${U.esc(k)}</b></div><b>${UI.ms(per[k])}</b></div>`).join('') || '<div class="row muted">Belum ada catatan. Tulis nama penerima di kolom catatan.</div>'}</div>
          ${UI.sec('Periode ini')}<div class="card list">${sd.rows.map(t => UI.txRow(t, { date: true })).join('') || '<div class="row muted">Belum ada.</div>'}</div><div class="spacer"></div>`;
      }
      if (p === 'riwayat') {
        const rows = Calc.txSorted().filter(t => t.jenis === 'keluar' && /^(zakat|qurban|sedekah|infak|donasi|wakaf)/.test(t.tag || ''));
        const perTh = U.groupBy(rows, t => t.tanggal.slice(0, 4));
        return TILES('riwayat') + Object.keys(perTh).sort().reverse().map(y => `${UI.sec(y, '<b>' + UI.ms(U.sum(perTh[y], t => t.jumlah)) + '</b>')}<div class="card list">${perTh[y].map(t => UI.txRow(t, { date: true })).join('')}</div>`).join('') || UI.empty('history', 'Belum ada riwayat', 'Pembayaran zakat & sedekah dari halaman ini otomatis tercatat di sini dan di Mutasi.');
      }
      // ---- Zakat mal ----
      const z = Calc.zakatMal(), grp = U.groupBy(z.items, x => x.grup);
      return TILES('') + `
        ${!h ? `<div class="alert warn" data-act="go" data-to="emas/harga">${I('triangle-alert')}<div><b>Harga emas belum tersedia</b><small>Nisab dihitung dari harga emas. Ketuk untuk memperbarui / isi manual.</small></div></div>` : ''}
        <section class="hero card-gold compact"><div class="hero-top"><small>Zakat mal (2,5%)</small>${status(z.wajib, z.kurang, z.dibayar)}</div>
          <div class="hero-amt">${UI.m(z.zakat)}</div>
          <div class="hero-split"><div><small>Harta bersih</small><b>${UI.ms(z.bersih)}</b></div><div><small>Nisab ${z.nisabGram} g</small><b>${UI.ms(z.nisab)}</b></div></div>
          <small>${z.haul ? 'Haul berikutnya ' + U.tgl(z.haul.next) + ' (' + U.hijri(z.haul.next) + ') · ' + z.haul.sisa + ' hari lagi' : 'Atur tanggal awal haul di Pengaturan zakat'}</small></section>
        ${z.wajib && z.kurang > 0 ? `<button class="btn block gold" data-act="zk-bayar" data-tag="zakat-mal" data-v="${z.kurang}" data-cat="Zakat mal${z.haul ? ' haul ' + U.tgl(z.haul.next, 'mys') : ''}">${I('hand-heart')} Bayar zakat ${U.rp(z.kurang)}</button>` : ''}
        ${z.dibayar ? `<div class="note">${I('circle-check')} Sudah dibayar ${U.rp(z.dibayar)} pada haul ini.</div>` : ''}
        ${!z.wajib && z.nisab ? `<div class="note">${I('info')} Harta bersih masih ${U.pct(z.bersih / z.nisab)} dari nisab — belum wajib zakat mal. Tetap bisa bersedekah.</div>` : ''}
        ${UI.sec('Rincian harta')}<div class="card list">${Object.keys(grp).map(k => `<div class="day-h in-card"><b>${U.esc(k)}</b><span></span><em>${UI.ms(U.sum(grp[k], x => x.v))}</em></div>${grp[k].map(x => `<div class="row"><div class="tx-txt"><b>${U.esc(x.nama)}</b></div><span>${UI.ms(x.v)}</span></div>`).join('')}`).join('') || '<div class="row muted">Belum ada harta tercatat.</div>'}
          <div class="row"><div class="tx-txt"><b>Dikurangi utang</b><small>${{ jatuhTempo: 'jatuh tempo 30 hari', semua: 'seluruh sisa utang', tidak: 'tidak dikurangi' }[z.modeUtang]}</small></div><b class="bad">−${UI.ms(z.utang)}</b></div></div>
        <p class="muted small">Emas/aset yang tidak dicentang "dihitung zakat" (mis. perhiasan dipakai, rumah tinggal) tidak masuk. Perhitungan ini panduan umum; untuk kasus khusus konsultasikan ke BAZNAS/LAZ atau ustaz tepercaya.</p><div class="spacer"></div>`;
    }
  });

  // ---------- Ringkasan SPT ----------
  let tahunSpt = new Date().getFullYear() - 1;
  UI.act('spt-th', el => { tahunSpt = Number(el.dataset.v); UI.render(); });
  UI.act('spt-csv', () => {
    const d = Calc.spt(tahunSpt), rows = [['Bagian', 'Kode', 'Uraian', 'Tahun perolehan', 'Nilai (Rp)', 'Keterangan']];
    d.harta.forEach(x => rows.push(['Harta', x.kode, x.nama, x.tahun, Math.round(x.v), x.ket || '']));
    d.utang.forEach(x => rows.push(['Utang', x.kode, x.nama, x.tahun, Math.round(x.v), '']));
    d.penghasilan.forEach(x => rows.push(['Penghasilan', '', x.nama, tahunSpt, Math.round(x.v), '']));
    rows.push(['Zakat dibayar', '', 'Zakat (pengurang penghasilan bruto bila lewat BAZNAS/LAZ resmi)', tahunSpt, Math.round(d.zakat), '']);
    U.download('ringkasan-spt-' + tahunSpt + '.csv', '﻿' + U.csv(rows), 'text/csv');
  });
  UI.page('spt', {
    head: () => ({ title: 'Ringkasan SPT ' + tahunSpt, crumb: 'Rapor', back: 'rapor' }), nav: () => 'rapor',
    render() {
      const d = Calc.spt(tahunSpt), th = new Date().getFullYear();
      const tbl = (rows, utang) => `<table class="tbl"><thead><tr><th>Kode</th><th>Uraian</th><th>Thn</th><th>Nilai</th></tr></thead><tbody>${rows.map(x => `<tr><td>${x.kode}</td><td>${U.esc(x.nama)}</td><td>${x.tahun || ''}</td><td>${U.rpShort(x.v)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">Tidak ada ${utang ? 'utang' : 'harta'} tercatat.</td></tr>`}</tbody></table>`;
      return `<div class="chips">${[th - 2, th - 1, th].map(y => `<button class="chip ${y === tahunSpt ? 'on' : ''}" data-act="spt-th" data-v="${y}">${y}</button>`).join('')}</div>
        <div class="stat3"><div class="stat"><small>Harta</small><b>${UI.ms(d.totalHarta)}</b></div><div class="stat out"><small>Utang</small><b>${UI.ms(d.totalUtang)}</b></div><div class="stat in"><small>Penghasilan</small><b>${UI.ms(d.totalPenghasilan)}</b></div></div>
        ${UI.sec('Harta per 31 Desember ' + tahunSpt, '<small class="muted">nilai perolehan</small>')}<div class="card">${tbl(d.harta)}</div>
        ${UI.sec('Utang per 31 Desember ' + tahunSpt)}<div class="card">${tbl(d.utang, true)}</div>
        ${UI.sec('Penghasilan tercatat ' + tahunSpt)}<div class="card kv-list">${d.penghasilan.map(x => `<div class="kv"><span>${U.esc(x.nama)}</span><b>${U.rp(x.v)}</b></div>`).join('') || '<div class="kv"><span>Belum ada</span><b>—</b></div>'}
          ${d.zakat ? `<div class="kv"><span>Zakat dibayar</span><b>${U.rp(d.zakat)}</b></div>` : ''}</div>
        <button class="btn block ghost" data-act="spt-csv">${I('download')} Unduh (Excel/CSV)</button>
        <div class="note">${I('info')} Kode harta mengikuti daftar harta SPT Tahunan Orang Pribadi (011 kas, 012 tabungan, 032 saham, 036 reksa dana, 051 logam mulia, 061 tanah/bangunan, dst.) dengan nilai sebesar harga perolehan. Periksa kembali di Coretax sebelum melapor — ini bantuan menyusun, bukan konsultasi pajak.</div><div class="spacer"></div>`;
    }
  });
})();
