/* ============================================================
 * Cloud — file data keluarga di Google Drive milik keluarga.
 *  - Satu Google Sheets "SatuAtap – Data Keluarga".
 *  - Sumber kebenaran: sheet tersembunyi "_log" (hanya tambah baris).
 *    Setiap perubahan = 1 baris: [waktu, oleh, tabel, id, op, data, req, perangkat]
 *    → aman dipakai beberapa HP bersamaan, tanpa server perantara.
 *  - Sheet tabel yang mudah dibaca (Transaksi, Dompet, …) diperbarui
 *    otomatis sekali sehari dari perangkat Admin.
 * ============================================================ */
(function () {
  const LOG = '_log', COLS = 8, CHUNK = 5000;
  const HEAD = ['waktu', 'oleh', 'tabel', 'id', 'op', 'data', 'req', 'perangkat'];
  const MIME = 'application/vnd.google-apps.spreadsheet';
  const C = { fileId: '', version: '' };
  const dev = (() => { let d = localStorage.getItem('sa:dev'); if (!d) { d = U.uid('d'); localStorage.setItem('sa:dev', d); } return d; })();
  C.device = dev;
  const enc = encodeURIComponent;

  /** File keluarga yang bisa diakses akun ini (dibuat sendiri atau pernah dipilih). */
  C.find = async () => {
    const q = "appProperties has { key='satuatap' and value='keluarga' } and trashed = false";
    const r = await G.req(`${G.DRIVE}/files?q=${enc(q)}&fields=${enc('files(id,name,modifiedTime,owners(emailAddress,displayName),capabilities(canEdit))')}&orderBy=modifiedTime desc&pageSize=10&spaces=drive`);
    if (!r.ok) throw Object.assign(new Error(r.message), r);
    return r.data.files || [];
  };
  C.meta = async (id) => {
    const r = await G.req(`${G.DRIVE}/files/${enc(id)}?fields=${enc('id,name,appProperties,owners(emailAddress),capabilities(canEdit,canShare),webViewLink')}`);
    if (!r.ok) throw Object.assign(new Error(r.status === 404 ? 'File tidak ditemukan atau belum dibagikan ke akun ini.' : r.message), r);
    return r.data;
  };
  C.checkVersion = async () => {
    const r = await G.req(`${G.DRIVE}/files/${enc(C.fileId)}?fields=version`, { timeout: 15000 });
    if (!r.ok) return r;
    return { ok: true, version: String(r.data.version || '') };
  };

  /** Buat file keluarga baru + isi awal. */
  C.create = async (namaKeluarga, seedOps, me) => {
    const r = await G.req(`${G.DRIVE}/files?fields=id`, { method: 'POST', body: {
      name: 'SatuAtap – Data ' + namaKeluarga, mimeType: MIME, appProperties: { satuatap: 'keluarga', v: '1' },
      description: 'Data keuangan keluarga untuk aplikasi SatuAtap. Jangan ubah sheet tersembunyi "_log".' } });
    if (!r.ok) throw new Error('Gagal membuat file di Google Drive: ' + r.message);
    const id = r.data.id;
    const b = await G.req(`${G.SHEETS}/${id}:batchUpdate`, { method: 'POST', body: { requests: [
      { addSheet: { properties: { title: 'Info', index: 0, gridProperties: { columnCount: 2, rowCount: 20 } } } },
      { updateSheetProperties: { properties: { sheetId: 0, title: LOG, hidden: true, gridProperties: { frozenRowCount: 1, columnCount: COLS } }, fields: 'title,hidden,gridProperties.frozenRowCount,gridProperties.columnCount' } },
      { addProtectedRange: { protectedRange: { range: { sheetId: 0 }, description: 'Log data SatuAtap — jangan diubah manual', warningOnly: true } } }
    ] } });
    if (!b.ok) throw new Error('Gagal menyiapkan spreadsheet: ' + b.message);
    await G.req(`${G.SHEETS}/${id}/values:batchUpdate`, { method: 'POST', body: { valueInputOption: 'RAW', data: [
      { range: LOG + '!A1:H1', values: [HEAD] },
      { range: 'Info!A1:B8', values: [['SatuAtap — Data Keluarga', namaKeluarga], ['Dibuat', new Date().toLocaleString('id-ID')], ['Admin', me.email],
        ['Catatan', 'File ini milik keluarga Anda. Aplikasi SatuAtap membaca & menulis ke sini.'], ['Penting', 'Jangan menghapus/mengubah sheet tersembunyi "_log" (sumber data).'],
        ['Tabel', 'Tab Transaksi, Dompet, dll. adalah salinan yang mudah dibaca (diperbarui otomatis tiap hari).'], ['Bagikan', 'Undang anggota dari aplikasi: Lainnya › Anggota & Izin.'], ['Aplikasi', location.origin + location.pathname]] }
    ] } });
    C.fileId = id;
    const p = await C.push(seedOps, me.email);
    if (!p.ok) throw new Error('Gagal menulis data awal: ' + p.message);
    return id;
  };

  /** Ubah op aplikasi → baris log. */
  C.toRows = (ops, oleh, req) => ops.map(o => [new Date().toISOString(), oleh || '', o.t, o.op === 'delete' ? o.id : o.row.id, o.op === 'delete' ? 'd' : 'u', o.op === 'delete' ? '' : JSON.stringify(o.row), req || '', dev]);

  /** Tambah baris ke log (atomik per permintaan; aman dari tabrakan antarperangkat). */
  C.push = async (ops, oleh, req) => {
    const rows = C.toRows(ops, oleh, req);
    const r = await G.req(`${G.SHEETS}/${enc(C.fileId)}/values/${enc(LOG + '!A:H')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=false`,
      { method: 'POST', body: { majorDimension: 'ROWS', values: rows } });
    return r;
  };

  /** Ambil baris log setelah kursor (kursor = jumlah baris data yang sudah dibaca). */
  C.pull = async (cursor) => {
    let out = [], cur = cursor;
    for (;;) {
      const from = cur + 2, to = from + CHUNK - 1;
      const r = await G.req(`${G.SHEETS}/${enc(C.fileId)}/values/${enc(LOG + '!A' + from + ':H' + to)}?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE`, { timeout: 60000 });
      if (!r.ok) return r;
      const rows = r.data.values || [];
      out = out.concat(rows); cur += rows.length;
      if (rows.length < CHUNK) break;
    }
    return { ok: true, rows: out, cursor: cur };
  };

  // ---------- Salinan tabel yang mudah dibaca ----------
  const TITLE = { Anggota: 'Anggota', Pengaturan: 'Pengaturan', Wallet: 'Dompet', Kategori: 'Kategori', Transaksi: 'Transaksi', Template: 'Template', Rutin: 'Rutin',
    Acara: 'Acara', GeserDana: 'Geser Dana', Tujuan: 'Tujuan', Pinjaman: 'Utang Piutang', Laporan: 'Laporan' };
  C.mirror = async (tables) => {
    const s = await G.req(`${G.SHEETS}/${enc(C.fileId)}?fields=${enc('sheets.properties(sheetId,title)')}`);
    if (!s.ok) return s;
    const have = {}; (s.data.sheets || []).forEach(x => have[x.properties.title] = 1);
    const add = Object.keys(TITLE).filter(t => !have[TITLE[t]]).map(t => ({ addSheet: { properties: { title: TITLE[t], gridProperties: { frozenRowCount: 1 } } } }));
    if (add.length) { const a = await G.req(`${G.SHEETS}/${enc(C.fileId)}:batchUpdate`, { method: 'POST', body: { requests: add } }); if (!a.ok) return a; }
    const ranges = Object.keys(TITLE).map(t => TITLE[t] + '!A:Z');
    const c = await G.req(`${G.SHEETS}/${enc(C.fileId)}/values:batchClear`, { method: 'POST', body: { ranges } });
    if (!c.ok) return c;
    const data = Object.keys(TITLE).map(t => ({ range: TITLE[t] + '!A1', values: [tables[t].c].concat(tables[t].r) }));
    return G.req(`${G.SHEETS}/${enc(C.fileId)}/values:batchUpdate`, { method: 'POST', body: { valueInputOption: 'RAW', data }, timeout: 90000 });
  };

  // ---------- Berbagi ke anggota ----------
  C.share = async (email, nama) => {
    const msg = `${nama || 'Admin'} mengundang Anda ke SatuAtap — catatan keuangan keluarga. Buka ${location.origin + location.pathname}, masuk dengan Google, lalu pilih "Saya diundang".`;
    return G.req(`${G.DRIVE}/files/${enc(C.fileId)}/permissions?sendNotificationEmail=true&emailMessage=${enc(msg)}&fields=id`, { method: 'POST', body: { role: 'writer', type: 'user', emailAddress: email } });
  };
  C.unshare = async (email) => {
    const l = await G.req(`${G.DRIVE}/files/${enc(C.fileId)}/permissions?fields=${enc('permissions(id,emailAddress,role)')}`);
    if (!l.ok) return l;
    const p = (l.data.permissions || []).find(x => String(x.emailAddress || '').toLowerCase() === email && x.role !== 'owner');
    if (!p) return { ok: true };
    return G.req(`${G.DRIVE}/files/${enc(C.fileId)}/permissions/${enc(p.id)}`, { method: 'DELETE' });
  };
  C.link = () => 'https://docs.google.com/spreadsheets/d/' + C.fileId + '/edit';

  // ---------- Google Picker (anggota memilih file yang dibagikan) ----------
  let pickP = null;
  const loadPicker = () => pickP || (pickP = new Promise((res, rej) => {
    const go = () => gapi.load('picker', { callback: res, onerror: () => rej(new Error('Gagal memuat pemilih file.')) });
    if (window.gapi && gapi.load) return go();
    const s = document.createElement('script'); s.src = 'https://apis.google.com/js/api.js'; s.async = true; s.onload = go;
    s.onerror = () => { pickP = null; rej(new Error('Gagal memuat pemilih file Google.')); };
    document.head.appendChild(s);
  }));
  C.pick = async () => {
    await loadPicker();
    return new Promise((res) => {
      const P = google.picker;
      const shared = new P.DocsView(P.ViewId.SPREADSHEETS).setOwnedByMe(false).setQuery('SatuAtap').setMode(P.DocsViewMode.LIST);
      const mine = new P.DocsView(P.ViewId.SPREADSHEETS).setQuery('SatuAtap').setMode(P.DocsViewMode.LIST);
      const b = new P.PickerBuilder().addView(shared).addView(mine).setOAuthToken(Auth.token).setTitle('Pilih file "SatuAtap – Data …" yang dibagikan ke Anda')
        .setLocale('id').setCallback(d => { if (d.action === P.Action.PICKED) res(d.docs[0].id); else if (d.action === P.Action.CANCEL) res(''); });
      if (APP_CONFIG.GOOGLE_API_KEY) b.setDeveloperKey(APP_CONFIG.GOOGLE_API_KEY);
      if (APP_CONFIG.GOOGLE_APP_ID) b.setAppId(APP_CONFIG.GOOGLE_APP_ID);
      b.build().setVisible(true);
    });
  };

  // ---------- Isi awal keluarga baru ----------
  const KATEGORI_AWAL = [
    ['Makan & Minum', 'keluar', 'kebutuhan', 'utensils', 0], ['Belanja Dapur', 'keluar', 'kebutuhan', 'shopping-cart', 0], ['Transportasi', 'keluar', 'kebutuhan', 'car', 0],
    ['Listrik, Air & Internet', 'keluar', 'kebutuhan', 'zap', 1], ['Pendidikan Anak', 'keluar', 'kebutuhan', 'graduation-cap', 1], ['Kesehatan', 'keluar', 'kebutuhan', 'heart-pulse', 0],
    ['Rumah & Perawatan', 'keluar', 'kebutuhan', 'house', 0], ['Cicilan & Utang', 'keluar', 'kebutuhan', 'landmark', 1], ['Iuran & Sosial', 'keluar', 'kebutuhan', 'users', 1],
    ['Jajan & Kafe', 'keluar', 'keinginan', 'coffee', 0], ['Hiburan & Langganan', 'keluar', 'keinginan', 'tv', 1], ['Belanja Pribadi', 'keluar', 'keinginan', 'shopping-bag', 0],
    ['Sedekah & Zakat', 'keluar', 'kebutuhan', 'hand-heart', 0], ['Biaya Admin', 'keluar', 'kebutuhan', 'receipt', 0], ['Lainnya', 'keluar', 'keinginan', 'circle-dot', 0],
    ['Gaji', 'masuk', 'pemasukan', 'banknote', 0], ['Bonus & THR', 'masuk', 'pemasukan', 'gift', 0], ['Usaha & Sampingan', 'masuk', 'pemasukan', 'briefcase', 0], ['Pemasukan Lain', 'masuk', 'pemasukan', 'circle-plus', 0]];
  C.seed = (namaKeluarga, me) => {
    const now = new Date().toISOString(), ops = [];
    ops.push({ op: 'upsert', t: 'Anggota', row: { id: 'm_admin', nama: me.nama, email: me.email, peran: 'admin', warna: '#0F5E59', izin: '{}', aktif: 'true', dibuat: now } });
    [['namaKeluarga', namaKeluarga], ['periodeMulai', '1'], ['danaDaruratBulan', '6'], ['notifEmail', 'true'],
     ['bagiGaji', JSON.stringify([{ pos: 'Kebutuhan', persen: 50, kelompok: 'kebutuhan' }, { pos: 'Keinginan', persen: 30, kelompok: 'keinginan' }, { pos: 'Tabungan & Tujuan', persen: 20, kelompok: 'tabungan' }])]]
      .forEach(p => ops.push({ op: 'upsert', t: 'Pengaturan', row: { id: p[0], nilai: p[1] } }));
    KATEGORI_AWAL.forEach((k, i) => ops.push({ op: 'upsert', t: 'Kategori', row: { id: 'k_' + i, nama: k[0], jenis: k[1], kelompok: k[2], ikon: k[3], batas: '0', bawaSisa: 'false', tetap: k[4] ? 'true' : 'false', pribadi: '', urutan: String(i), arsip: 'false' } }));
    ops.push({ op: 'upsert', t: 'Wallet', row: { id: 'w_tunai', nama: 'Tunai', jenis: 'tunai', pemilik: 'bersama', saldoAwal: '0', ikon: '', likuid: 'true', urutan: '0', arsip: 'false', catatan: '' } });
    return ops;
  };

  window.Cloud = C;
})();
