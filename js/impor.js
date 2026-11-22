/* ============================================================
 * Impor — membaca catatan keuangan lama dari Excel (.xlsx) / CSV.
 * Semua pembacaan berjalan di perangkat. AI (opsional) hanya menerima judul kolom,
 * beberapa baris contoh, dan daftar nama kategori unik — bukan seluruh data.
 *
 *  Impor.baca(file)          → { nama, sheets: [{ nama, rows: [[...]] }] }
 *  Impor.deteksi(sheets)     → { si, header, kol: { tanggal, catatan, jenis, jumlah, masuk, keluar, kategori, sub, dompet }, skor }
 *  Impor.terapkan(sheet, d)  → [{ baris, tanggal, jenis, jumlah, catatan, katAsal, subAsal, dompetAsal }]
 * ============================================================ */
(function (root) {
  const I = {};
  // ---------- pembaca berkas ----------
  const muatFflate = () => root.fflate ? Promise.resolve(root.fflate) : new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'js/vendor/fflate.min.js'; s.onload = () => res(root.fflate); s.onerror = () => rej(new Error('Pembaca Excel gagal dimuat. Periksa internet lalu coba lagi.')); document.head.appendChild(s);
  });
  const xml = t => new DOMParser().parseFromString(t, 'application/xml');
  const tagAll = (el, n) => Array.from(el.getElementsByTagName(n));
  const kolomKe = ref => { let n = 0; const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; for (const c of m[1]) n = n * 26 + c.charCodeAt(0) - 64; return n - 1; };
  const BUILTIN_TGL = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  /** Nomor seri tanggal Excel → 'YYYY-MM-DD'. */
  I.seriKeTanggal = v => { const d = new Date(Math.round((Number(v) - 25569) * 864e5)); return isNaN(d) ? '' : d.toISOString().slice(0, 10); };

  I.bacaXlsx = (buf, fflate) => {
    const files = fflate.unzipSync(new Uint8Array(buf)), dec = new TextDecoder('utf-8');
    const f = p => files[p] ? dec.decode(files[p]) : '';
    if (!f('xl/workbook.xml')) throw new Error('Berkas bukan Excel .xlsx yang valid. Simpan ulang sebagai .xlsx atau .csv.');
    const ss = f('xl/sharedStrings.xml') ? tagAll(xml(f('xl/sharedStrings.xml')), 'si').map(si => tagAll(si, 't').map(t => t.textContent).join('')) : [];
    // gaya tanggal
    const tglXf = [];
    if (f('xl/styles.xml')) {
      const st = xml(f('xl/styles.xml')), fmt = {};
      tagAll(st, 'numFmt').forEach(n => { fmt[n.getAttribute('numFmtId')] = n.getAttribute('formatCode') || ''; });
      const xfs = st.getElementsByTagName('cellXfs')[0];
      if (xfs) tagAll(xfs, 'xf').forEach((x, i) => { const id = Number(x.getAttribute('numFmtId')) || 0, code = String(fmt[id] || '').replace(/"[^"]*"|\[[^\]]*\]/g, '');
        tglXf[i] = BUILTIN_TGL.has(id) || (/[dy]/i.test(code) && /m/i.test(code)) || /^(d|m|y)/i.test(code) && /[dmy]{1,4}[\/\-. ][dmy]/i.test(code); });
    }
    const wb = xml(f('xl/workbook.xml')), rels = {};
    tagAll(xml(f('xl/_rels/workbook.xml.rels')), 'Relationship').forEach(r => { rels[r.getAttribute('Id')] = r.getAttribute('Target'); });
    const sheets = tagAll(wb, 'sheet').map(s => {
      const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let p = String(rels[rid] || '').replace(/^\//, ''); if (p && p.indexOf('xl/') !== 0) p = 'xl/' + p;
      const doc = f(p) ? xml(f(p)) : null, rows = [];
      if (doc) tagAll(doc, 'row').slice(0, 20000).forEach(r => {
        const ri = (Number(r.getAttribute('r')) || rows.length + 1) - 1, row = [];
        tagAll(r, 'c').forEach((c, ci) => {
          const ki = c.getAttribute('r') ? kolomKe(c.getAttribute('r')) : ci; if (ki < 0 || ki > 60) return;
          const t = c.getAttribute('t'), vEl = c.getElementsByTagName('v')[0], v = vEl ? vEl.textContent : '';
          let val = '';
          if (t === 's') val = ss[Number(v)] || '';
          else if (t === 'inlineStr') val = tagAll(c, 't').map(x => x.textContent).join('');
          else if (t === 'str' || t === 'e') val = v;
          else if (t === 'b') val = v === '1';
          else if (v !== '') { const n = Number(v); val = tglXf[Number(c.getAttribute('s')) || 0] && n > 1000 && n < 80000 ? { tgl: I.seriKeTanggal(n) } : n; }
          row[ki] = val;
        });
        rows[ri] = row;
      });
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      return { nama: s.getAttribute('name'), rows };
    });
    return sheets;
  };
  I.bacaCsv = teks => {
    teks = teks.replace(/^﻿/, '');
    const baris1 = teks.split(/\r?\n/).slice(0, 5).join('\n');
    const pemisah = [';', '\t', ','].map(p => [p, (baris1.match(new RegExp(p === '\t' ? '\t' : '\\' + p, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < teks.length; i++) {
      const ch = teks[i];
      if (q) { if (ch === '"') { if (teks[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true; else if (ch === pemisah) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && teks[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; if (rows.length > 20000) break; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return [{ nama: 'CSV', rows }];
  };
  I.baca = async file => {
    const nama = file.name || 'berkas';
    if (/\.xls$/i.test(nama)) throw new Error('Format .xls lama belum didukung. Buka di Excel / Google Sheets lalu simpan sebagai .xlsx atau .csv.');
    if (/\.(csv|txt|tsv)$/i.test(nama) || /csv|text\/plain/.test(file.type || '')) return { nama, sheets: I.bacaCsv(await file.text()) };
    const ff = await muatFflate();
    return { nama, sheets: I.bacaXlsx(await file.arrayBuffer(), ff) };
  };

  // ---------- nilai sel ----------
  const BLN = { jan: 1, januari: 1, feb: 2, februari: 2, peb: 2, mar: 3, maret: 3, march: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, agu: 8, agt: 8, agustus: 8, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, october: 10, nov: 11, nopember: 11, november: 11, des: 12, desember: 12, dec: 12, december: 12 };
  const pad = n => String(n).padStart(2, '0');
  const ymd = (y, m, d) => { y = Number(y); m = Number(m); d = Number(d); if (y < 100) y += 2000; if (!(y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return ''; return y + '-' + pad(m) + '-' + pad(d); };
  /** Sel → 'YYYY-MM-DD' atau ''. urut: 'DMY' (bawaan Indonesia) | 'MDY' | 'YMD'. */
  I.tanggal = (v, urut) => {
    if (v == null || v === '') return '';
    if (typeof v === 'object' && v.tgl) return v.tgl;
    if (typeof v === 'number') return v > 20000 && v < 80000 ? I.seriKeTanggal(v) : '';
    const s = String(v).trim().toLowerCase();
    let m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/.exec(s); if (m) return ymd(m[1], m[2], m[3]);
    m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s); if (m) return urut === 'MDY' ? ymd(m[3], m[1], m[2]) : ymd(m[3], m[2], m[1]);
    m = /^(?:[a-z]+,?\s+)?(\d{1,2})[\s\-]+([a-z]+)\.?[\s\-,]+(\d{2,4})/.exec(s); if (m && BLN[m[2]]) return ymd(m[3], BLN[m[2]], m[1]);
    m = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s); if (m && BLN[m[1]]) return ymd(m[3], BLN[m[1]], m[2]);
    if (/^\d{5}(\.\d+)?$/.test(s)) return I.seriKeTanggal(Number(s));
    return '';
  };
  /** Sel → angka rupiah (bisa negatif) atau NaN. */
  I.angka = v => {
    if (typeof v === 'number') return v;
    if (v == null || typeof v === 'object') return NaN;
    let s = String(v).trim(); if (!s) return NaN;
    const neg = /^\(.*\)$/.test(s) || /^-|-\s*$|\bdb\b|\bdr\b/i.test(s);
    s = s.replace(/rp\.?|idr|[()\s]/gi, '').replace(/[^0-9.,]/g, '');
    if (!s) return NaN;
    if (/,\d{1,2}$/.test(s) && /\./.test(s)) s = s.replace(/\./g, '').replace(',', '.');          // 1.234,56
    else if (/\.\d{1,2}$/.test(s) && /,/.test(s)) s = s.replace(/,/g, '');                         // 1,234.56
    else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');                           // 25.000 / 25,000
    else s = s.replace(',', '.');
    const n = Number(s); return isNaN(n) ? NaN : (neg ? -Math.abs(n) : n);
  };
  const teks = v => v == null ? '' : typeof v === 'object' ? (v.tgl || '') : String(v).replace(/\s+/g, ' ').trim();
  const bersih = s => teks(s).toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim();
  I.teks = teks;
  /** Nilai kolom jenis → 'masuk' | 'keluar' | 'transfer' | ''. */
  I.jenisDari = v => {
    const s = bersih(v); if (!s) return '';
    if (/transfer|pindah|mutasi antar/.test(s)) return 'transfer';
    if (/^(masuk|pemasukan|pendapatan|penerimaan|income|in|kredit|credit|cr|terima|debet masuk)\b|pemasukan|income|uang masuk/.test(s)) return 'masuk';
    if (/^(keluar|pengeluaran|biaya|belanja|expense|out|debit|debet|db|bayar)\b|pengeluaran|expense|uang keluar/.test(s)) return 'keluar';
    return '';
  };

  // ---------- deteksi tata letak ----------
  const POLA = {
    tanggal: /^(tgl|tanggal|date|waktu|tanggal transaksi|hari\/tanggal|hari tanggal|time|tgl transaksi)$|tanggal|^tgl|date/,
    catatan: /deskripsi|keterangan|uraian|catatan|description|memo|note|nama transaksi|transaksi|item|nama barang|detail|rincian/,
    jenis: /^(tipe|jenis|type|kind)$|tipe transaksi|jenis transaksi|transaction type|tipe|jenis|masuk\/keluar|in\/out/,
    jumlah: /^(jumlah|nominal|amount|total|nilai|harga|biaya|rp|idr|uang)$|jumlah|nominal|amount|nilai transaksi|total/,
    masuk: /pemasukan|uang masuk|income|kredit|credit|debet masuk|penerimaan|^masuk$|^in$/,
    keluar: /pengeluaran|uang keluar|expense|debit|debet|^keluar$|^out$|pembayaran/,
    sub: /sub ?kategori|subkategori|sub category|subcategory|sub-kategori|rincian kategori/,
    kategori: /kategori|category|pos|golongan|kelompok|akun biaya/,
    dompet: /dompet|akun|rekening|wallet|bank|metode|sumber dana|account|payment|bayar pakai|kas/
  };
  /** Cari baris judul & peran tiap kolom dari judul + isi kolom. */
  I.deteksiSheet = rows => {
    let terbaik = null;
    for (let h = 0; h < Math.min(rows.length, 40); h++) {
      const hdr = (rows[h] || []).map(bersih); if (hdr.filter(Boolean).length < 2) continue;
      const data = rows.slice(h + 1, h + 41).filter(r => r && r.some(x => teks(x)));
      if (data.length < 1) continue;
      const kol = {}, pakai = new Set();
      const isi = (ki, uji) => data.filter(r => uji(r[ki])).length / data.length;
      const ambil = (peran, uji) => { if (kol[peran] != null) return; let best = -1, bs = 0;
        hdr.forEach((t, ki) => { if (!t || pakai.has(ki) || !POLA[peran].test(t)) return; const sc = uji ? isi(ki, uji) : 1; if (sc > bs) { bs = sc; best = ki; } });
        if (best > -1 && (!uji || bs >= 0.5)) { kol[peran] = best; pakai.add(best); } };
      ambil('tanggal', v => !!I.tanggal(v));
      ambil('sub'); ambil('jenis', v => !!I.jenisDari(v));
      ambil('masuk', v => v == null || teks(v) === '' || !isNaN(I.angka(v)));
      ambil('keluar', v => v == null || teks(v) === '' || !isNaN(I.angka(v)));
      if (kol.masuk == null || kol.keluar == null) { if (kol.masuk != null) { pakai.delete(kol.masuk); delete kol.masuk; } if (kol.keluar != null) { pakai.delete(kol.keluar); delete kol.keluar; } }
      ambil('jumlah', v => !isNaN(I.angka(v)) && I.angka(v) !== 0);
      ambil('kategori'); ambil('dompet'); ambil('catatan', v => teks(v).length > 1 && isNaN(I.angka(v)));
      // tanpa judul jelas: tebak kolom tanggal & angka dari isinya
      if (kol.tanggal == null) { const n = Math.max(...data.map(r => r.length), 0); for (let ki = 0; ki < n; ki++) if (!pakai.has(ki) && isi(ki, v => !!I.tanggal(v)) >= 0.7) { kol.tanggal = ki; pakai.add(ki); break; } }
      const skor = (kol.tanggal != null ? 4 : 0) + (kol.jumlah != null || kol.masuk != null ? 4 : 0) + (kol.catatan != null ? 1 : 0) + (kol.kategori != null ? 1 : 0) + (kol.jenis != null ? 1 : 0) + Math.min(2, data.length / 20);
      if (!terbaik || skor > terbaik.skor) terbaik = { header: h, kol, skor };
    }
    return terbaik;
  };
  I.deteksi = sheets => {
    let best = null;
    sheets.forEach((s, si) => { const d = I.deteksiSheet(s.rows); if (d && (!best || d.skor > best.skor)) best = Object.assign({ si }, d); });
    return best && best.skor >= 8 ? best : (best ? Object.assign(best, { ragu: true }) : null);
  };
  /** Ubah baris sheet menjadi calon transaksi. */
  I.terapkan = (sheet, d) => {
    const k = d.kol, out = [], rows = sheet.rows; let kosong = 0;
    for (let i = d.header + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      if (!r.some(x => teks(x))) { if (++kosong > 30 && out.length) break; continue; } kosong = 0;
      const tanggal = I.tanggal(r[k.tanggal], d.urut);
      let jumlah = NaN, jenis = '';
      if (k.masuk != null && k.keluar != null) { const a = I.angka(r[k.masuk]), b = I.angka(r[k.keluar]); if (a > 0) { jumlah = a; jenis = 'masuk'; } else if (b > 0 || b < 0) { jumlah = Math.abs(b); jenis = 'keluar'; } }
      else if (k.jumlah != null) { const n = I.angka(r[k.jumlah]); if (!isNaN(n) && n !== 0) { jumlah = Math.abs(n); jenis = n < 0 ? 'keluar' : ''; } }
      if (k.jenis != null) { const j = I.jenisDari(r[k.jenis]); if (j) jenis = j; else if (d.petaJenis && d.petaJenis[bersih(r[k.jenis])]) jenis = d.petaJenis[bersih(r[k.jenis])]; }
      if (!tanggal || !(jumlah > 0)) continue;   // baris ringkasan/kosong
      if (!jenis) jenis = d.jenisBawaan || 'keluar';
      const sub = teks(r[k.sub]), kat = teks(r[k.kategori]);
      out.push({ baris: i + 1, tanggal, jenis, jumlah: Math.round(jumlah), catatan: (teks(r[k.catatan]) || sub || kat).slice(0, 140), katAsal: kat, subAsal: sub, dompetAsal: teks(r[k.dompet]) });
    }
    return out;
  };
  /** Kunci kategori asal untuk pemetaan: sub-kategori bila ada (lebih spesifik), kalau tidak kategori. */
  I.kunciKat = x => x.jenis + '|' + (x.subAsal || x.katAsal || '').trim().toLowerCase();
  /** Sidik jari untuk mendeteksi duplikat (impor ulang berkas yang sama / catatan yang sudah ada). */
  I.sidik = (tanggal, jenis, jumlah, catatan) => [tanggal, jenis, Math.round(jumlah), String(catatan || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24)].join('|');
  root.Impor = I;
  if (typeof module !== 'undefined') module.exports = I;
})(typeof window !== 'undefined' ? window : globalThis);
