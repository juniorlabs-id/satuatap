/* ============================================================
 * Halaman "Impor dari Excel / CSV" (Lainnya › Pengaturan › Impor dari Excel)
 * 1 Pilih berkas → 2 Cek kolom → 3 Cocokkan kategori & dompet → 4 Ringkasan & impor.
 * Setiap impor bisa dibatalkan seluruhnya dari riwayat.
 * ============================================================ */
(function () {
  const I = UI.icon;
  const PERAN = [['tanggal', 'Tanggal', true], ['catatan', 'Keterangan'], ['jumlah', 'Jumlah / nominal'], ['jenis', 'Jenis (masuk/keluar)'], ['masuk', 'Kolom pemasukan (kredit)'], ['keluar', 'Kolom pengeluaran (debit)'],
    ['kategori', 'Kategori'], ['sub', 'Sub-kategori'], ['dompet', 'Dompet / rekening']];
  const LEWATI = '__lewati';
  let S = null;   // state wizard
  const baru = () => { S = { langkah: 'pilih', berkas: null, sheets: null, d: null, items: [], peta: {}, petaW: {}, walletId: UI.defWallet(), jaga: true, sibuk: '', ai: {}, hasil: null }; };

  // ---------- riwayat & pembelajaran ----------
  const riwayat = () => { try { const r = JSON.parse(Store.setting('imporRiwayat', '[]') || '[]'); return Array.isArray(r) ? r : []; } catch (e) { return []; } };
  const petaBelajar = () => { try { return JSON.parse(Store.setting('imporPeta', '{}') || '{}') || {}; } catch (e) { return {}; } };

  // ---------- langkah 1: baca berkas ----------
  async function bacaBerkas(f) {
    S.sibuk = 'Membaca ' + f.name + '…'; UI.render();
    try {
      const x = await Impor.baca(f);
      S.berkas = x.nama; S.sheets = x.sheets.filter(s => s.rows.some(r => r && r.length));
      if (!S.sheets.length) throw new Error('Berkas kosong.');
      S.d = Impor.deteksi(S.sheets);
      if ((!S.d || S.d.ragu) && AI.siap() && !AI.demo()) { S.sibuk = 'Susunan kolom tidak biasa — AI sedang membacanya…'; UI.render(); await kolomAI(); }
      if (!S.d) S.d = { si: 0, header: 0, kol: {}, skor: 0, ragu: true };
      hitung(); S.langkah = 'kolom';
    } catch (e) { UI.toast(e.message, 'warn'); }
    S.sibuk = ''; UI.render();
  }
  /** AI membaca susunan kolom dari ±15 baris teratas (bukan seluruh data). */
  async function kolomAI() {
    const kand = S.sheets.map((s, si) => ({ si, n: s.rows.filter(r => r && r.some(c => Impor.teks(c))).length })).sort((a, b) => b.n - a.n).slice(0, 3);
    const contoh = kand.map(k => ({ sheet: k.si, nama: S.sheets[k.si].nama, baris: S.sheets[k.si].rows.slice(0, 15).map((r, i) => i + ': ' + (r || []).slice(0, 14).map(c => Impor.teks(c).slice(0, 28)).join(' | ')) }));
    try {
      const t = await AI.minta('Ini potongan atas dari file Excel/CSV catatan keuangan keluarga (format sel: "nomorBaris: kolom0 | kolom1 | ..."). Tentukan sheet & susunan tabel transaksinya.\n' + JSON.stringify(contoh) +
        '\nBalas JSON saja: {"sheet": nomor sheet, "header": nomor baris judul, "kolom": {"tanggal": i, "catatan": i, "jumlah": i, "jenis": i, "masuk": i, "keluar": i, "kategori": i, "sub": i, "dompet": i}, "urut": "DMY"|"MDY"|"YMD", "jenisMasuk": ["nilai di kolom jenis yang berarti pemasukan"]}\n' +
        'Pakai -1 untuk kolom yang tidak ada. Isi "masuk" & "keluar" hanya bila pemasukan & pengeluaran ada di dua kolom terpisah (mis. Kredit/Debit); jika satu kolom nominal, isi "jumlah".', { json: true, maks: 1024, jenis: 'impor' });
      const o = JSON.parse(t.replace(/^```json|```$/g, '').trim()), kol = {};
      Object.keys(o.kolom || {}).forEach(k => { const v = Number(o.kolom[k]); if (v >= 0) kol[k] = v; });
      if (o.sheet == null || !S.sheets[o.sheet] || kol.tanggal == null) return;
      const petaJenis = {}; (o.jenisMasuk || []).forEach(v => { petaJenis[String(v).toLowerCase().replace(/[^a-z0-9/ ]/g, ' ').replace(/\s+/g, ' ').trim()] = 'masuk'; });
      S.d = { si: Number(o.sheet), header: Math.max(0, Number(o.header) || 0), kol, urut: /^(DMY|MDY|YMD)$/.test(o.urut) ? o.urut : 'DMY', petaJenis, skor: 10, dariAI: true };
    } catch (e) { /* tetap pakai deteksi otomatis; pengguna bisa atur manual */ }
  }
  function hitung() {
    const sh = S.sheets[S.d.si]; S.items = sh ? Impor.terapkan(sh, S.d) : [];
    S.ai = {};
  }

  // ---------- langkah 3: kategori & dompet ----------
  function kelompok() {
    const g = {};
    S.items.forEach(x => { if (x.jenis === 'transfer') return; const k = Impor.kunciKat(x);
      const o = g[k] || (g[k] = { kunci: k, jenis: x.jenis, nama: x.subAsal || x.katAsal || '', induk: x.subAsal ? x.katAsal : '', n: 0, total: 0, contoh: [] });
      o.n++; o.total += x.jumlah; if (o.contoh.length < 3 && x.catatan && o.contoh.indexOf(x.catatan) < 0) o.contoh.push(x.catatan); });
    return Object.values(g).sort((a, b) => (a.jenis > b.jenis ? -1 : 1) || b.total - a.total);
  }
  function sarankan() {
    const belajar = petaBelajar(), kats = j => Store.kategori(j).filter(k => !k.arsip);
    kelompok().forEach(g => {
      if (S.peta[g.kunci] !== undefined) return;
      const nm = g.nama.toLowerCase().trim(), ks = kats(g.jenis);
      let id = belajar[g.kunci] && Store.byId.Kategori[belajar[g.kunci]] ? belajar[g.kunci] : '';
      if (!id) { const k = ks.find(x => x.nama.toLowerCase() === nm) || (g.induk && ks.find(x => x.nama.toLowerCase() === g.induk.toLowerCase())); if (k) id = k.id; }
      if (!id && window.Kamus) id = Kamus.tebak(g.nama, g.jenis) || g.contoh.map(c => Kamus.tebak(c, g.jenis)).find(Boolean) || (g.induk && Kamus.tebak(g.induk, g.jenis)) || '';
      S.peta[g.kunci] = id;
    });
    const dw = {}; S.items.forEach(x => { if (x.dompetAsal) dw[x.dompetAsal] = 1; });
    Object.keys(dw).forEach(n => { if (S.petaW[n] !== undefined) return; const s = n.toLowerCase(), w = Store.wallets().find(w => w.nama.toLowerCase() === s || s.indexOf(w.nama.toLowerCase()) > -1 || w.nama.toLowerCase().indexOf(s) > -1); S.petaW[n] = w ? w.id : S.walletId; });
  }
  async function kategoriAI() {
    const kosong = kelompok().filter(g => !S.peta[g.kunci]); if (!kosong.length) return;
    S.sibuk = 'AI mencocokkan ' + kosong.length + ' kategori…'; UI.render();
    try {
      for (const j of ['keluar', 'masuk']) {
        const grp = kosong.filter(g => g.jenis === j); if (!grp.length) continue;
        const opsi = Store.kategori(j).filter(k => !k.arsip).map(k => k.nama);
        const t = await AI.minta('Cocokkan kategori dari catatan keuangan lama ke kategori aplikasi. Pilihan kategori ' + (j === 'masuk' ? 'pemasukan' : 'pengeluaran') + ': ' + JSON.stringify(opsi) +
          '\nKategori lama (dengan induk & contoh catatan): ' + JSON.stringify(grp.map((g, i) => ({ i, nama: g.nama, induk: g.induk, contoh: g.contoh }))) +
          '\nBalas JSON saja: {"peta": [nama kategori aplikasi untuk tiap i, urut sama; "" bila tidak ada yang cocok]}', { json: true, maks: 2048, jenis: 'impor' });
        const o = JSON.parse(t.replace(/^```json|```$/g, '').trim()), ks = Store.kategori(j);
        (o.peta || []).forEach((n, i) => { const k = ks.find(x => x.nama.toLowerCase() === String(n || '').toLowerCase()); if (k && grp[i]) { S.peta[grp[i].kunci] = k.id; S.ai[grp[i].kunci] = 1; } });
      }
    } catch (e) { UI.toast('AI belum bisa membantu (' + e.message + '). Pilih manual ya.', 'warn'); }
    S.sibuk = ''; UI.render();
  }

  // ---------- langkah 4: simpan ----------
  function rencana() {
    const ada = new Set(Store.t.Transaksi.map(t => Impor.sidik(t.tanggal, t.jenis, t.jumlah, t.catatan)));
    const out = [], dup = [], lewat = [];
    S.items.forEach(x => {
      if (x.jenis === 'transfer') return lewat.push(x);
      const kat = S.peta[Impor.kunciKat(x)];
      if (kat === LEWATI) return lewat.push(x);
      if (ada.has(Impor.sidik(x.tanggal, x.jenis, x.jumlah, x.catatan))) return dup.push(x);
      out.push(Object.assign({}, x, { kategoriId: kat || '', walletId: (x.dompetAsal && S.petaW[x.dompetAsal]) || S.walletId }));
    });
    return { out, dup, lewat, kurang: out.filter(x => !x.kategoriId).length };
  }
  async function simpan() {
    const r = rencana(); if (!r.out.length) return UI.toast('Tidak ada baris baru untuk diimpor.', 'warn');
    if (r.kurang) return UI.toast(r.kurang + ' baris belum berkategori — pilih kategorinya di langkah 3.', 'warn');
    const id = U.uid('imp'), me = Store.me.email, now = new Date().toISOString(), ops = r.out.map(x => ({ op: 'upsert', t: 'Transaksi', row: {
      id: U.uid('t'), tanggal: x.tanggal, jenis: x.jenis, jumlah: x.jumlah, kategoriId: x.kategoriId, walletId: x.walletId, walletTujuan: '', biaya: 0, catatan: x.catatan,
      dibayarOleh: me, tag: '', sumber: 'impor', refId: '', periodeRef: 'impor:' + id, dicatatOleh: me, dibuat: now, riwayat: [] } }));
    // Jaga saldo dompet sekarang: transaksi lama hanya riwayat → saldo awal digeser sebesar selisihnya
    const adj = {};
    if (S.jaga) r.out.forEach(x => { adj[x.walletId] = (adj[x.walletId] || 0) + (x.jenis === 'masuk' ? -x.jumlah : x.jumlah); });
    Object.keys(adj).forEach(w => { const wl = Store.byId.Wallet[w]; if (wl && adj[w]) ops.push({ op: 'upsert', t: 'Wallet', row: { id: w, saldoAwal: (Number(wl.saldoAwal) || 0) + adj[w] } }); else delete adj[w]; });
    const belajar = petaBelajar(); kelompok().forEach(g => { const v = S.peta[g.kunci]; if (v && v !== LEWATI) belajar[g.kunci] = v; });
    const rw = riwayat(); rw.unshift({ id, berkas: S.berkas, n: r.out.length, tgl: U.today(), dari: r.out.reduce((m, x) => x.tanggal < m ? x.tanggal : m, '9999'), sampai: r.out.reduce((m, x) => x.tanggal > m ? x.tanggal : m, ''), adj });
    ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: 'imporPeta', nilai: JSON.stringify(belajar) } }, { op: 'upsert', t: 'Pengaturan', row: { id: 'imporRiwayat', nilai: JSON.stringify(rw.slice(0, 20)) } });
    S.langkah = 'proses';
    for (let i = 0; i < ops.length; i += 300) { S.sibuk = 'Menyimpan ' + Math.min(r.out.length, i + 300) + ' dari ' + r.out.length + ' transaksi…'; UI.render(); await Store.commit(ops.slice(i, i + 300)); }
    S.sibuk = ''; S.hasil = { n: r.out.length, dup: r.dup.length, lewat: r.lewat.length, id }; S.langkah = 'selesai'; UI.render();
  }
  async function batalkan(id) {
    const rw = riwayat(), h = rw.find(x => x.id === id); if (!h) return;
    const tx = Store.t.Transaksi.filter(t => t.periodeRef === 'impor:' + id);
    if (!(await UI.confirm('Batalkan impor "' + h.berkas + '"?', tx.length + ' transaksi hasil impor ini akan dihapus' + (Object.keys(h.adj || {}).length ? ' dan saldo awal dompet dikembalikan' : '') + '.', 'Ya, batalkan', true))) return;
    const ops = tx.map(t => ({ op: 'delete', t: 'Transaksi', id: t.id }));
    Object.keys(h.adj || {}).forEach(w => { const wl = Store.byId.Wallet[w]; if (wl) ops.push({ op: 'upsert', t: 'Wallet', row: { id: w, saldoAwal: (Number(wl.saldoAwal) || 0) - h.adj[w] } }); });
    ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: 'imporRiwayat', nilai: JSON.stringify(rw.filter(x => x.id !== id)) } });
    for (let i = 0; i < ops.length; i += 300) await Store.commit(ops.slice(i, i + 300));
    UI.toast('Impor dibatalkan · ' + tx.length + ' transaksi dihapus.'); UI.render();
  }

  // ---------- tampilan ----------
  const langkahBar = () => { const L = [['pilih', 'Berkas'], ['kolom', 'Kolom'], ['kategori', 'Kategori'], ['ringkas', 'Impor']], i = L.findIndex(x => x[0] === S.langkah);
    return `<div class="mw-steps imp-steps">${L.map((l, j) => `<span class="${j < i || S.langkah === 'selesai' ? 'done' : j === i ? 'on' : ''}" title="${l[1]}">${j < i || S.langkah === 'selesai' ? I('check') : j + 1}</span>`).join('<i></i>')}</div>`; };
  const kolNama = ki => { const h = ((S.sheets[S.d.si] || {}).rows || [])[S.d.header] || []; const t = Impor.teks(h[ki]); return String.fromCharCode(65 + (ki % 26)) + (t ? ' · ' + t.slice(0, 24) : ''); };
  function vPilih() {
    const rw = riwayat();
    return `<div class="card imp-drop"><div class="mw-hero">${I('sheet', 'big')}<h3>Pindahkan catatan lama ke SatuAtap</h3>
        <p class="muted small">Excel (.xlsx) atau CSV — dari template apa pun: Duit Tracker, catatan buatan sendiri, mutasi rekening bank, dll. AI membantu membaca susunan kolom & mencocokkan kategori.</p></div>
        <label class="btn block">${I('upload')} Pilih berkas<input type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" data-imp-file hidden></label>
        <ul class="ul small muted imp-tips"><li>Cukup kolom <b>tanggal</b> dan <b>jumlah</b>; keterangan, jenis (masuk/keluar), kategori, dan dompet dibaca bila ada.</li>
          <li>Berkas dibaca di HP ini. Ke AI hanya dikirim judul kolom, beberapa baris contoh, dan nama-nama kategori.</li><li>Format .xls lama? Simpan ulang sebagai .xlsx atau .csv dulu.</li></ul></div>
      ${rw.length ? `<h4 class="mini-h">${I('history')} Riwayat impor</h4><div class="card list">${rw.map(h => `<div class="row"><span class="cat-ic">${I('sheet')}</span><div class="tx-txt"><b>${U.esc(h.berkas)}</b><small>${h.n} transaksi · ${U.tgl(h.dari)} – ${U.tgl(h.sampai)} · diimpor ${U.tgl(h.tgl)}</small></div>
        ${Store.isAdminLike() ? `<button class="btn ghost xs danger" data-act="imp-batal" data-id="${h.id}">Batalkan</button>` : ''}</div>`).join('')}</div>` : ''}`;
  }
  function vKolom() {
    const sh = S.sheets[S.d.si], hdr = (sh.rows[S.d.header] || []), nk = Math.max(hdr.length, ...sh.rows.slice(S.d.header, S.d.header + 30).map(r => (r || []).length));
    const opsiKol = sel => `<option value="">—</option>` + Array.from({ length: nk }, (_, ki) => `<option value="${ki}" ${sel === ki ? 'selected' : ''}>${U.esc(kolNama(ki))}</option>`).join('');
    const teksTgl = S.items.length === 0 || sh.rows.slice(S.d.header + 1, S.d.header + 30).some(r => r && typeof r[S.d.kol.tanggal] === 'string');
    const masuk = S.items.filter(x => x.jenis === 'masuk'), keluar = S.items.filter(x => x.jenis === 'keluar');
    return `<h3 class="mw-h">Cek susunan kolom</h3><p class="muted small">${S.d.dariAI ? I('sparkles') + ' Dibaca AI' : 'Terbaca otomatis'} dari <b>${U.esc(S.berkas)}</b>. Ubah bila ada yang keliru.</p>
      ${S.sheets.length > 1 ? UI.field('Sheet', `<select data-imp="sheet">${S.sheets.map((s, i) => `<option value="${i}" ${i === S.d.si ? 'selected' : ''}>${U.esc(s.nama)}</option>`).join('')}</select>`) : ''}
      <div class="card imp-kol">${UI.field('Baris judul', `<select data-imp="header">${Array.from({ length: Math.min(40, sh.rows.length) }, (_, i) => `<option value="${i}" ${i === S.d.header ? 'selected' : ''}>Baris ${i + 1}: ${U.esc((sh.rows[i] || []).map(Impor.teks).filter(Boolean).slice(0, 3).join(' · ').slice(0, 40))}</option>`).join('')}</select>`)}
        <div class="grid2">${PERAN.map(p => UI.field(p[1], `<select data-imp-kol="${p[0]}">${opsiKol(S.d.kol[p[0]])}</select>`)).join('')}</div>
        ${teksTgl ? UI.field('Urutan tanggal', `<select data-imp="urut">${[['DMY', 'Hari/Bulan/Tahun (31/12/2025)'], ['MDY', 'Bulan/Hari/Tahun (12/31/2025)'], ['YMD', 'Tahun-Bulan-Hari']].map(o => `<option value="${o[0]}" ${(S.d.urut || 'DMY') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select>`) : ''}
        ${S.d.kol.jenis == null && S.d.kol.masuk == null ? UI.field('Tanpa kolom jenis — anggap semua', `<select data-imp="jenisBawaan"><option value="keluar">Pengeluaran (angka minus = pengeluaran)</option><option value="masuk" ${S.d.jenisBawaan === 'masuk' ? 'selected' : ''}>Pemasukan</option></select>`) : ''}
        ${AI.siap() && !AI.demo() ? `<button class="btn ghost sm" data-act="imp-ai-kolom">${I('sparkles')} Minta AI membaca ulang</button>` : ''}</div>
      <div class="card imp-hasil">${S.items.length ? `<div class="imp-angka"><div><b>${U.fmtNum(S.items.length)}</b><small>transaksi terbaca</small></div><div><b class="bad">${U.rpShort(U.sum(keluar, x => x.jumlah))}</b><small>${keluar.length} pengeluaran</small></div><div><b class="ok">${U.rpShort(U.sum(masuk, x => x.jumlah))}</b><small>${masuk.length} pemasukan</small></div></div>
        <div class="imp-prev">${S.items.slice(0, 5).map(x => `<div class="row"><div class="tx-txt"><b>${U.esc(x.catatan || '-')}</b><small>${U.tgl(x.tanggal)} · ${U.esc(x.subAsal || x.katAsal || 'tanpa kategori')}</small></div><b class="${x.jenis === 'masuk' ? 'ok' : 'bad'}">${x.jenis === 'masuk' ? '+' : '−'}${U.rp(x.jumlah)}</b></div>`).join('')}</div>`
        : `<p class="muted">${I('circle-alert')} Belum ada transaksi terbaca. Pastikan kolom <b>Tanggal</b> dan <b>Jumlah</b> (atau Pemasukan & Pengeluaran) sudah benar.</p>`}</div>
      <div class="mw-foot"><button class="btn ghost" data-act="imp-ulang">${I('chevron-left')}</button><button class="btn grow" data-act="imp-ke" data-l="kategori" ${S.items.length ? '' : 'disabled'}>Lanjut ${I('chevron-right')}</button></div>`;
  }
  function vKategori() {
    sarankan();
    const gs = kelompok(), kosong = gs.filter(g => !S.peta[g.kunci]).length, dw = Object.keys(S.petaW);
    const baris = g => `<div class="row imp-k ${S.peta[g.kunci] ? '' : 'kurang'}"><div class="tx-txt"><b>${U.esc(g.nama || '(tanpa kategori)')}${S.ai[g.kunci] ? ` <span class="pill">${I('sparkles')} AI</span>` : ''}</b><small>${g.induk ? U.esc(g.induk) + ' · ' : ''}${g.n} baris · ${U.rpShort(g.total)}${g.contoh.length ? ' · mis. ' + U.esc(g.contoh[0]) : ''}</small></div>
      <label class="vq-pill ${S.peta[g.kunci] ? '' : 'kosong'}"><select data-imp-kat="${U.esc(g.kunci)}"><option value="">Pilih…</option>${UI.katOpts(g.jenis, S.peta[g.kunci] === LEWATI ? '' : S.peta[g.kunci])}<option value="${LEWATI}" ${S.peta[g.kunci] === LEWATI ? 'selected' : ''}>— Jangan impor —</option></select>${I('chevron-down')}</label></div>`;
    const kel = gs.filter(g => g.jenis === 'keluar'), mas = gs.filter(g => g.jenis === 'masuk');
    return `<h3 class="mw-h">Cocokkan kategori</h3><p class="muted small">${gs.length} kategori dari berkas sudah dipasangkan ke kategori SatuAtap. Periksa yang belum pas.</p>
      ${kosong ? `<div class="note warn small">${I('tag')} <span>${kosong} kategori belum ada pasangannya.${AI.siap() && !AI.demo() ? '' : ' Pilih manual ya.'}</span>${AI.siap() && !AI.demo() ? `<button class="btn xs" data-act="imp-ai-kat">${I('sparkles')} Cocokkan dengan AI</button>` : ''}</div>` : ''}
      ${kel.length ? `<h4 class="mini-h">Pengeluaran</h4><div class="card list">${kel.map(baris).join('')}</div>` : ''}
      ${mas.length ? `<h4 class="mini-h">Pemasukan</h4><div class="card list">${mas.map(baris).join('')}</div>` : ''}
      <h4 class="mini-h">Dompet</h4><div class="card imp-kol">${dw.length ? dw.map(n => UI.field(U.esc(n), `<select data-imp-w="${U.esc(n)}">${UI.walletOpts(S.petaW[n])}</select>`)).join('') + UI.field('Baris tanpa dompet', `<select data-imp="walletId">${UI.walletOpts(S.walletId)}</select>`)
        : UI.field('Semua transaksi masuk ke dompet', `<select data-imp="walletId">${UI.walletOpts(S.walletId)}</select>`, 'Berkas tidak punya kolom dompet/rekening.')}</div>
      <div class="mw-foot"><button class="btn ghost" data-act="imp-ke" data-l="kolom">${I('chevron-left')}</button><button class="btn grow" data-act="imp-ke" data-l="ringkas">Lanjut ${I('chevron-right')}</button></div>`;
  }
  function vRingkas() {
    const r = rencana(), kel = r.out.filter(x => x.jenis === 'keluar'), mas = r.out.filter(x => x.jenis === 'masuk');
    const dari = r.out.reduce((m, x) => x.tanggal < m ? x.tanggal : m, '9999'), sampai = r.out.reduce((m, x) => x.tanggal > m ? x.tanggal : m, '');
    return `<h3 class="mw-h">Siap diimpor</h3>
      <div class="card kv-list"><div class="kv"><span>Transaksi baru</span><b>${U.fmtNum(r.out.length)}</b></div>${r.out.length ? `<div class="kv"><span>Periode</span><b>${U.tgl(dari)} – ${U.tgl(sampai)}</b></div>` : ''}
        <div class="kv"><span>Pengeluaran</span><b class="bad">${U.rp(U.sum(kel, x => x.jumlah))}</b></div><div class="kv"><span>Pemasukan</span><b class="ok">${U.rp(U.sum(mas, x => x.jumlah))}</b></div>
        ${r.dup.length ? `<div class="kv"><span>Sudah ada (dilewati)</span><b>${r.dup.length}</b></div>` : ''}${r.lewat.length ? `<div class="kv"><span>Tidak diimpor</span><b>${r.lewat.length}</b></div>` : ''}</div>
      ${r.kurang ? `<div class="note warn small">${I('tag')} <span>${r.kurang} baris belum berkategori — kembali ke langkah sebelumnya.</span></div>` : ''}
      <label class="check imp-jaga"><input type="checkbox" data-imp="jaga" ${S.jaga ? 'checked' : ''}><span><b>Jangan ubah saldo dompet saat ini</b><small class="muted">Disarankan. Saldo dompet di SatuAtap sudah sesuai kenyataan — catatan lama hanya jadi riwayat untuk laporan & rapor.</small></span></label>
      <div class="note small">${I('rotate-ccw')} <span>Bisa dibatalkan seluruhnya kapan saja dari <b>Riwayat impor</b>.</span></div>
      <div class="mw-foot"><button class="btn ghost" data-act="imp-ke" data-l="kategori">${I('chevron-left')}</button><button class="btn grow" data-act="imp-simpan" ${r.out.length && !r.kurang ? '' : 'disabled'}>${I('download')} Impor ${U.fmtNum(r.out.length)} transaksi</button></div>`;
  }
  function vSelesai() {
    const h = S.hasil;
    return `<div class="mw-hero">${I('party-popper', 'big')}<h2>Impor selesai</h2><p class="muted">${U.fmtNum(h.n)} transaksi masuk${h.dup ? ' · ' + h.dup + ' sudah ada (dilewati)' : ''}${h.lewat ? ' · ' + h.lewat + ' tidak diimpor' : ''}.</p></div>
      <div class="card list">${[['arrow-left-right', 'Lihat di Mutasi', 'mutasi'], ['chart-column', 'Lihat Rapor', 'rapor']].map(x => `<div class="row" data-act="go" data-to="${x[2]}"><span class="cat-ic">${I(x[0])}</span><div class="tx-txt"><b>${x[1]}</b></div>${I('chevron-right')}</div>`).join('')}</div>
      <button class="btn ghost block" data-act="imp-ulang">${I('upload')} Impor berkas lain</button>`;
  }

  UI.page('impor', {
    noFab: true,
    head: () => ({ title: 'Impor dari Excel', crumb: 'Lainnya', back: 'lainnya' }),
    nav: () => 'lainnya',
    render() {
      if (!S) baru();
      if (!Store.isAdminLike()) return UI.empty('lock', 'Khusus Admin / Pasangan', 'Minta Admin keluarga untuk mengimpor catatan lama.');
      if (S.sibuk) return `${langkahBar()}<div class="voice"><div class="mic-pulse">${I('sheet', 'big')}</div><p class="muted">${U.esc(S.sibuk)}</p></div>`;
      const v = { pilih: vPilih, kolom: vKolom, kategori: vKategori, ringkas: vRingkas, selesai: vSelesai }[S.langkah] || vPilih;
      return `<div class="mw imp">${S.langkah === 'pilih' ? '' : langkahBar()}${v()}<div class="spacer"></div></div>`;
    },
    after(el) {
      const f = el.querySelector('[data-imp-file]'); if (f) f.onchange = () => { if (f.files[0]) bacaBerkas(f.files[0]); };
      if (el._imp) return; el._imp = true;
      el.addEventListener('change', e => {
        if (UI.cur !== 'impor' || !S) return; const t = e.target, y = window.scrollY;
        if (t.dataset.impKol) { const v = t.value === '' ? null : Number(t.value); if (v == null) delete S.d.kol[t.dataset.impKol]; else S.d.kol[t.dataset.impKol] = v; hitung(); }
        else if (t.dataset.impKat !== undefined) { S.peta[t.dataset.impKat] = t.value; delete S.ai[t.dataset.impKat]; }
        else if (t.dataset.impW !== undefined) S.petaW[t.dataset.impW] = t.value;
        else if (t.dataset.imp === 'sheet') { const d = Impor.deteksiSheet(S.sheets[+t.value].rows); S.d = Object.assign({ si: +t.value }, d || { header: 0, kol: {} }); hitung(); }
        else if (t.dataset.imp === 'header') { S.d.header = +t.value; const d = Impor.deteksiSheet(S.sheets[S.d.si].rows.slice(0)); if (d && d.header === S.d.header) S.d.kol = d.kol; hitung(); }
        else if (t.dataset.imp === 'urut' || t.dataset.imp === 'jenisBawaan') { S.d[t.dataset.imp] = t.value; hitung(); }
        else if (t.dataset.imp === 'walletId') { S.walletId = t.value; Object.keys(S.petaW).forEach(n => { if (!S.petaW[n]) S.petaW[n] = t.value; }); }
        else if (t.dataset.imp === 'jaga') S.jaga = t.checked;
        else return;
        UI.render(); window.scrollTo(0, y);
      });
    }
  });
  UI.act('imp-ke', el => { S.langkah = el.dataset.l; UI.render(); window.scrollTo(0, 0); if (S.langkah === 'kategori' && AI.siap() && !AI.demo() && !S.aiKatSudah) { S.aiKatSudah = true; sarankan(); if (kelompok().some(g => !S.peta[g.kunci])) kategoriAI(); } });
  UI.act('imp-ulang', () => { baru(); UI.render(); });
  UI.act('imp-ai-kolom', async () => { S.sibuk = 'AI sedang membaca susunan kolom…'; UI.render(); await kolomAI(); hitung(); S.sibuk = ''; UI.render(); });
  UI.act('imp-ai-kat', () => kategoriAI());
  UI.act('imp-simpan', () => simpan().catch(e => { S.sibuk = ''; S.langkah = 'ringkas'; UI.toast('Gagal menyimpan: ' + e.message, 'warn'); UI.render(); }));
  UI.act('imp-batal', el => batalkan(el.dataset.id));
})();
