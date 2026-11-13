/* Lainnya › Impor CSV mutasi rekening (T-13) */
(function () {
  const I = UI.icon;
  const P = { raw: null, nama: '', rows: [], head: 0, map: {}, walletId: '', items: [], tahun: new Date().getFullYear() };

  // ---------- Pembaca CSV ----------
  const pisah = (text) => {
    const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim()).slice(0, 8);
    const cand = [',', ';', '\t', '|'], score = d => lines.reduce((s, l) => s + (l.split(d).length - 1), 0);
    return cand.sort((a, b) => score(b) - score(a))[0];
  };
  const csv = (text, d) => {
    const out = []; let row = [], cell = '', q = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === d) { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); if (row.some(x => x !== '')) out.push(row); row = []; cell = ''; }
      else cell += c;
    }
    row.push(cell.trim()); if (row.some(x => x !== '')) out.push(row);
    return out;
  };
  const KUNCI = {
    tanggal: /^(tgl|tanggal|date|tanggal transaksi|transaction date|posting date|tgl\.? ?transaksi|waktu)/i,
    ket: /(keterangan|deskripsi|description|uraian|remark|berita|detail|transaksi$)/i,
    debit: /^(debit|debet|db|mutasi keluar|keluar|withdrawal|pengeluaran)$/i,
    kredit: /^(kredit|credit|cr|mutasi masuk|masuk|deposit|pemasukan)$/i,
    jumlah: /^(jumlah|amount|nominal|mutasi|nilai)/i,
    tipe: /^(tipe|type|jenis|d\/k|db\/cr|dk)$/i
  };
  const tebakHeader = rows => {
    let best = 0, bi = 0;
    rows.slice(0, 25).forEach((r, i) => { const n = r.filter(c => Object.values(KUNCI).some(k => k.test(c))).length; if (n > best) { best = n; bi = i; } });
    return bi;
  };
  const tebakMap = (head, data) => {
    const m = {};
    Object.keys(KUNCI).forEach(k => { const i = head.findIndex((h, j) => KUNCI[k].test(h) && !Object.values(m).includes(j)); if (i >= 0) m[k] = i; });
    // kolom tanpa judul berisi DB/CR (format BCA) → kolom jenis
    if (m.tipe === undefined && data && data.length) {
      for (let j = 0; j < head.length; j++) {
        if (Object.values(m).includes(j)) continue;
        const v = data.slice(0, 30).map(r => String(r[j] || '').trim()).filter(Boolean);
        if (v.length >= 2 && v.filter(x => /^(db|cr|d|k|dr|debit|kredit|credit)$/i.test(x)).length >= v.length * 0.8) { m.tipe = j; break; }
      }
    }
    if (m.ket === undefined) { const i = head.findIndex((h, j) => !Object.values(m).includes(j) && h); if (i >= 0) m.ket = i; }
    return m;
  };
  /** "50,000.00 DB" · "1.234.567,89" · "(50.000)" · "-50000" → angka bertanda (negatif = keluar) */
  const angka = (s) => {
    s = String(s || '').replace(/^['"`]+/, '').trim(); if (!s) return null;
    let neg = /^-|^\(.*\)$|\b(db|d|dr|debit|debet)\.?$/i.test(s.replace(/\s+/g, ' ').trim());
    if (/\b(cr|k|kredit|credit)\.?$/i.test(s)) neg = false;
    let t = s.replace(/[^\d.,]/g, '');
    if (!t) return null;
    const lc = t.lastIndexOf(','), ld = t.lastIndexOf('.');
    if (lc > -1 && ld > -1) t = lc > ld ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
    else if (lc > -1) t = /,\d{1,2}$/.test(t) && (t.match(/,/g) || []).length === 1 ? t.replace(',', '.') : t.replace(/,/g, '');
    else if (ld > -1) t = /\.\d{1,2}$/.test(t) && (t.match(/\./g) || []).length === 1 ? t : t.replace(/\./g, '');
    const v = Number(t); if (!isFinite(v)) return null;
    return neg ? -v : v;
  };
  const BLN = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7, agu: 8, agt: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12 };
  /** Tanggal bank → yyyy-mm-dd. Mendukung dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, dd MMM yyyy, dd/mm (tanpa tahun). */
  const tanggal = (s, urut) => {
    s = String(s || '').replace(/^['"`]+/, '').trim(); if (!s || /pend/i.test(s)) return '';
    let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
    if (m) return m[1] + '-' + U.pad(+m[2]) + '-' + U.pad(+m[3]);
    m = /^(\d{1,2})[-/. ]([A-Za-z]{3})[A-Za-z]*[-/. ]?(\d{2,4})?/.exec(s);
    if (m && BLN[m[2].toLowerCase()]) { const y = m[3] ? (m[3].length === 2 ? '20' + m[3] : m[3]) : String(P.tahun); return y + '-' + U.pad(BLN[m[2].toLowerCase()]) + '-' + U.pad(+m[1]); }
    m = /^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?/.exec(s);
    if (m) {
      let d = +m[1], mo = +m[2];
      if (urut === 'mdy' || mo > 12) { const x = d; d = mo; mo = x; }
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
      let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : P.tahun;
      if (!m[3] && y === new Date().getFullYear() && mo > new Date().getMonth() + 1) y--;   // dd/mm tanpa tahun dari bulan "depan" = tahun lalu
      return y + '-' + U.pad(mo) + '-' + U.pad(d);
    }
    return '';
  };

  // ---------- Tebak kategori dari riwayat ----------
  const kataKunci = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length >= 4 && !/^\d+$/.test(w) && !/^(trsf|transfer|trf|e-banking|ebanking|debit|kredit|switching|biaya|pembayaran|bayar|dari|untuk|kepada)$/.test(w));
  let indeksKat = null;
  const bangunIndeks = () => {
    const idx = {};
    Store.t.Transaksi.slice(-4000).forEach(t => {
      const kk = Store.byId.Kategori[t.kategoriId];
      if (!kk || kk.pribadi || kk.arsip || UI.isPrivate(t)) return;
      kataKunci(UI.note(t)).forEach(w => { const o = idx[w] = idx[w] || {}; const k = t.jenis + '|' + t.kategoriId; o[k] = (o[k] || 0) + 1; });
    });
    return idx;
  };
  const ATURAN = [[/gaji|salary|payroll/i, 'masuk', /gaji/i], [/biaya adm|adm\.? ?bulanan|admin fee|biaya kartu|pajak bunga/i, 'keluar', /biaya admin|admin/i], [/bunga|interest/i, 'masuk', /bunga|lain/i],
    [/pln|token listrik/i, 'keluar', /listrik|tagihan/i], [/pdam/i, 'keluar', /air|tagihan/i], [/indomaret|alfamart|superindo|hypermart|transmart/i, 'keluar', /belanja|dapur|harian/i],
    [/gopay|ovo|dana|shopeepay|linkaja/i, 'keluar', /dompet|top ?up|lain/i], [/grab|gojek|maxim/i, 'keluar', /transport|makan/i], [/pertamina|spbu|shell/i, 'keluar', /bensin|bbm|transport/i]];
  const tebakKat = (ket, jenis) => {
    const skor = {};
    kataKunci(ket).forEach(w => { const o = indeksKat[w]; if (o) Object.keys(o).forEach(k => { if (k.indexOf(jenis + '|') === 0) skor[k] = (skor[k] || 0) + o[k]; }); });
    const best = Object.keys(skor).sort((a, b) => skor[b] - skor[a])[0];
    if (best) return best.split('|')[1];
    const kats = Store.kategori(jenis);
    for (const a of ATURAN) if (a[0].test(ket) && a[1] === jenis) { const k = kats.find(x => a[2].test(x.nama)); if (k) return k.id; }
    return (kats.find(k => /lain/i.test(k.nama)) || kats[kats.length - 1] || {}).id || '';
  };

  // ---------- Pratinjau ----------
  const susun = () => {
    const m = P.map, out = [];
    indeksKat = indeksKat || bangunIndeks();
    const ada = Store.t.Transaksi.filter(t => t.walletId === P.walletId && (t.jenis === 'masuk' || t.jenis === 'keluar' || t.jenis === 'transfer'));
    const dipakai = new Set();
    P.rows.slice(P.head + 1).forEach((r, i) => {
      const tg = tanggal(r[m.tanggal]); if (!tg) return;
      let v = null;
      if (m.debit !== undefined || m.kredit !== undefined) {
        const d = angka(r[m.debit]), k = angka(r[m.kredit]);
        if (d) v = -Math.abs(d); else if (k) v = Math.abs(k);
      }
      if (v === null && m.jumlah !== undefined) {
        v = angka(r[m.jumlah]);
        if (v !== null && m.tipe !== undefined) { const tp = String(r[m.tipe] || ''); if (/^(d|db|dr|debit|debet|keluar)/i.test(tp)) v = -Math.abs(v); else if (/^(k|cr|kredit|credit|masuk)/i.test(tp)) v = Math.abs(v); }
      }
      if (!v) return;
      const jenis = v < 0 ? 'keluar' : 'masuk', jumlah = Math.round(Math.abs(v)), ket = String(r[m.ket] || '').replace(/\s+/g, ' ').trim();
      // dobel: dompet sama, jumlah sama, arah sama, selisih tanggal ≤ 2 hari
      const dup = ada.find(t => !dipakai.has(t.id) && Math.round(t.jenis === 'transfer' ? t.jumlah + (t.biaya || 0) : t.jumlah) === jumlah && (t.jenis === 'transfer' ? jenis === 'keluar' : t.jenis === jenis) && Math.abs(U.diffDays(t.tanggal, tg)) <= 2);
      if (dup) dipakai.add(dup.id);
      out.push({ i, tanggal: tg, jenis, jumlah, ket, dup: dup || null, pilih: !dup, kategoriId: tebakKat(ket, jenis) });
    });
    P.items = out;
  };
  const muat = (text, nama) => {
    const d = pisah(text); P.raw = text; P.nama = nama; P.rows = csv(text, d);
    P.head = tebakHeader(P.rows); P.map = tebakMap(P.rows[P.head] || [], P.rows.slice(P.head + 1));
    if (!P.walletId) P.walletId = (Store.wallets().find(w => w.jenis === 'bank') || Store.wallets()[0] || {}).id || '';
    indeksKat = null; susun(); UI.render();
  };
  UI.act('imp-file', () => document.getElementById('imp-input').click());
  UI.act('imp-reset', () => { P.raw = null; P.rows = []; P.items = []; UI.render(); });
  UI.act('imp-pilih', el => { const it = P.items[+el.dataset.i]; if (it) { it.pilih = !it.pilih; UI.render(); } });
  UI.act('imp-semua', el => { const v = el.dataset.v === '1'; P.items.forEach(x => { if (!x.dup || !v) x.pilih = v; }); UI.render(); });
  UI.act('imp-simpan', async () => {
    const pilih = P.items.filter(x => x.pilih);
    if (!pilih.length) return UI.toast('Belum ada baris yang dipilih.', 'warn');
    if (!P.walletId) return UI.toast('Pilih dompet/rekening tujuan impor.', 'warn');
    const me = Store.me.email, now = new Date().toISOString();
    const ops = pilih.map(x => ({ op: 'upsert', t: 'Transaksi', row: { id: U.uid('t'), tanggal: x.tanggal, jenis: x.jenis, jumlah: x.jumlah, kategoriId: x.kategoriId, walletId: P.walletId, walletTujuan: '', biaya: 0,
      catatan: x.ket.slice(0, 200), dibayarOleh: me, tag: '', sumber: 'impor', refId: '', periodeRef: '', dicatatOleh: me, dibuat: now, riwayat: [] } }));
    const ok = await UI.confirm('Impor ' + pilih.length + ' transaksi?', 'Masuk ke ' + ((Store.byId.Wallet[P.walletId] || {}).nama || 'dompet') + '. Bisa diubah atau dihapus satu per satu di Mutasi.', 'Impor');
    if (!ok) return;
    for (let i = 0; i < ops.length; i += 200) Store.commit(ops.slice(i, i + 200));
    UI.toast(pilih.length + ' transaksi diimpor.'); P.raw = null; P.items = []; UI.go('mutasi');
  });

  UI.page('impor', {
    head: () => ({ title: 'Impor CSV', crumb: 'Mutasi', back: 'mutasi' }), nav: () => 'mutasi',
    render() {
      const input = `<input type="file" id="imp-input" accept=".csv,.txt,text/csv" hidden>`;
      if (!P.raw) return input + `<div class="card"><h3>${I('file-up')} Impor mutasi rekening</h3>
          <p class="muted">Unduh mutasi dari internet/mobile banking dalam format <b>CSV</b>, lalu pilih filenya di sini. Kolom dicocokkan otomatis dan transaksi yang sudah tercatat ditandai agar tidak dobel.</p>
          <button class="btn block" data-act="imp-file">${I('upload')} Pilih file CSV</button></div>
        <div class="note">${I('info')} Bank yang memberi PDF saja: buka PDF di Excel/Google Sheets lalu simpan sebagai CSV. Data tidak dikirim ke mana pun — dibaca langsung di HP ini.</div>`;
      const head = P.rows[P.head] || [], cols = head.map((h, i) => `<option value="${i}">${U.esc(h || 'Kolom ' + (i + 1))}</option>`).join('');
      const sel = (k, lbl) => UI.field(lbl, `<select data-map="${k}"><option value="">—</option>${cols}</select>`);
      const n = P.items.length, pilih = P.items.filter(x => x.pilih), dup = P.items.filter(x => x.dup).length;
      const kats = j => Store.kategori(j);
      return input + `<div class="card"><div class="row-sp"><b>${I('file-text')} ${U.esc(P.nama)}</b><button class="btn ghost sm" data-act="imp-reset">Ganti</button></div>
          <div class="grid2">${UI.field('Masuk ke dompet', `<select id="imp-wallet">${Store.wallets().map(w => `<option value="${w.id}" ${w.id === P.walletId ? 'selected' : ''}>${U.esc(w.nama)}</option>`).join('')}</select>`)}
            ${UI.field('Baris judul kolom', `<select id="imp-head">${P.rows.slice(0, 25).map((r, i) => `<option value="${i}" ${i === P.head ? 'selected' : ''}>${i + 1}: ${U.esc(r.slice(0, 3).join(' | ').slice(0, 40))}</option>`).join('')}</select>`)}</div>
          <details ${n ? '' : 'open'}><summary>Pencocokan kolom</summary><div class="grid2" id="imp-map">${sel('tanggal', 'Tanggal')}${sel('ket', 'Keterangan')}${sel('debit', 'Debit (keluar)')}${sel('kredit', 'Kredit (masuk)')}${sel('jumlah', 'Jumlah (bila satu kolom)')}${sel('tipe', 'Jenis D/K (opsional)')}</div>
            ${UI.field('Tahun (bila tanggal tanpa tahun)', `<input type="number" id="imp-tahun" value="${P.tahun}">`)}</details></div>
        ${n ? `<div class="row-sp"><small class="muted">${n} baris terbaca · ${dup} sudah tercatat · ${pilih.length} dipilih</small><span><button class="btn ghost sm" data-act="imp-semua" data-v="1">Pilih semua</button> <button class="btn ghost sm" data-act="imp-semua" data-v="0">Kosongkan</button></span></div>
          <div class="card list imp-list">${P.items.slice(0, 400).map((x, k) => `<div class="row ${x.pilih ? '' : 'off'}">
              <button class="cek ${x.pilih ? 'on' : ''}" data-act="imp-pilih" data-i="${k}" aria-label="Pilih">${I(x.pilih ? 'square-check' : 'square')}</button>
              <div class="tx-txt"><b>${U.esc(x.ket || '(tanpa keterangan)')}</b><small>${U.tgl(x.tanggal)}${x.dup ? ' · <span class="bad">sudah tercatat</span>' : ''}</small>
                <select class="imp-kat" data-i="${k}">${kats(x.jenis).map(c => `<option value="${c.id}" ${c.id === x.kategoriId ? 'selected' : ''}>${U.esc(c.nama)}</option>`).join('')}</select></div>
              ${UI.amount(x.jumlah, x.jenis)}</div>`).join('')}${n > 400 ? `<div class="row muted">+${n - 400} baris lagi ikut diimpor sesuai pilihan.</div>` : ''}</div>
          <button class="btn block" data-act="imp-simpan">${I('download')} Impor ${pilih.length} transaksi</button>`
        : `<div class="alert warn">${I('triangle-alert')}<div><b>Belum ada transaksi terbaca</b><small>Periksa baris judul dan pencocokan kolom (Tanggal + Debit/Kredit atau Jumlah).</small></div></div>`}
        <div class="spacer"></div>`;
    },
    after(el) {
      const inp = el.querySelector('#imp-input');
      if (inp) inp.onchange = () => { const f = inp.files[0]; if (!f) return; if (f.size > 5e6) return UI.toast('File terlalu besar (maks 5 MB).', 'warn'); const r = new FileReader(); r.onload = () => muat(String(r.result), f.name); r.readAsText(f); };
      el.querySelectorAll('[data-map]').forEach(s => { const v = P.map[s.dataset.map]; s.value = v === undefined ? '' : String(v); s.onchange = () => { if (s.value === '') delete P.map[s.dataset.map]; else P.map[s.dataset.map] = Number(s.value); susun(); UI.render(); }; });
      const w = el.querySelector('#imp-wallet'); if (w) w.onchange = () => { P.walletId = w.value; susun(); UI.render(); };
      const h = el.querySelector('#imp-head'); if (h) h.onchange = () => { P.head = Number(h.value); P.map = tebakMap(P.rows[P.head] || [], P.rows.slice(P.head + 1)); susun(); UI.render(); };
      const t = el.querySelector('#imp-tahun'); if (t) t.onchange = () => { P.tahun = Number(t.value) || P.tahun; susun(); UI.render(); };
      el.querySelectorAll('.imp-kat').forEach(s => s.onchange = () => { const it = P.items[+s.dataset.i]; if (it) it.kategoriId = s.value; });
    }
  });
  UI._imporTest = { angka, tanggal, csv, pisah, tebakHeader, tebakMap, muat, P };
})();
