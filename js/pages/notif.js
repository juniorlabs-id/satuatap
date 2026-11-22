/* Telegram @SatuAtapBot, WhatsApp (Fonnte keluarga), Kotak catatan dari chat, pengingat dari aplikasi */
(function () {
  const I = UI.icon, App = window.App = window.App || {};
  const N = { info: null, infoAt: 0, kotakAt: 0 };
  const lsKotak = () => 'sa:kotak:' + ((Store.me && Store.me.email) || '');
  const bacaKotak = () => { try { return JSON.parse(localStorage.getItem(lsKotak()) || '[]'); } catch (e) { return []; } };
  const tulisKotak = a => { try { localStorage.setItem(lsKotak(), JSON.stringify(a.slice(-100))); } catch (e) {} };
  const relayOk = () => Store.mode === 'demo' || (Store.mode === 'live' && Relay.enabled() && Store.fileId);

  /** Jenis pengingat Telegram yang aktif untuk keluarga (pengaturan bersama). */
  UI.NOTIF_JENIS = [['tagihan', 'Tagihan & cicilan (H-7, H-3, H-1, hari H · di bawah Rp 1 juta: H-1 & hari H)'], ['amplop', 'Amplop anggaran terpakai 80% & 100%'], ['emas', 'Alert harga emas'], ['rapat', 'Rapat keuangan'], ['insight', 'Insight mingguan AI (untuk yang memakai AI)']];
  const notifSet = () => { let o = {}; try { o = JSON.parse(Store.setting('notifTelegram', '{}')) || {}; } catch (e) {} UI.NOTIF_JENIS.forEach(j => { if (o[j[0]] === undefined) o[j[0]] = true; }); return o; };

  // ---------- Status Telegram ----------
  N.muatInfo = async (force) => {
    if (!relayOk()) return null;
    if (!force && N.info && Date.now() - N.infoAt < 10 * 60e3) return N.info;
    const r = await Relay.call('tg.info', { fileId: Store.fileId });
    if (r.success) { N.info = r.data; N.infoAt = Date.now(); try { localStorage.setItem('sa:tginfo:' + Store.fileId, JSON.stringify(r.data)); } catch (e) {} }
    return N.info;
  };
  const infoCache = () => { if (N.info) return N.info; try { return JSON.parse(localStorage.getItem('sa:tginfo:' + Store.fileId) || 'null'); } catch (e) { return null; } };
  UI.act('tg-hubung', async el => {
    el.disabled = true;
    const r = await Relay.call('tg.kode', { fileId: Store.fileId, nama: Store.me.nama });
    el.disabled = false;
    if (!r.success) return UI.toast(r.message || 'Gagal membuat kode.', 'warn');
    const s = UI.sheet({ title: 'Hubungkan Telegram', body: `<ol class="steps"><li>Ketuk tombol di bawah — Telegram terbuka di chat <b>@${U.esc(r.data.bot)}</b>.</li><li>Ketuk <b>Mulai / Start</b>. Selesai — bot membalas "Terhubung".</li></ol>
        <p class="muted small">Kode sekali pakai, berlaku ${r.data.berlaku} menit: <code>${U.esc(r.data.kode)}</code>. Bila tombol tidak membuka Telegram, kirim <code>/start ${U.esc(r.data.kode)}</code> ke @${U.esc(r.data.bot)}.</p>`,
      foot: `<a class="btn" href="${U.esc(r.data.link)}" target="_blank" rel="noopener">${I('send')} Buka Telegram</a><button class="btn ghost" data-ok>Sudah</button>` });
    s.el.querySelector('[data-ok]').onclick = async () => { s.close(); await N.muatInfo(true); UI.render(); };
  });
  UI.act('tg-putus', async el => {
    if (!(await UI.confirm('Putuskan Telegram?', 'Pengingat & catat lewat chat berhenti untuk ' + (el.dataset.email ? Store.memberName(el.dataset.email) : 'akun Anda') + '.', 'Putuskan', true))) return;
    const r = await Relay.call('tg.putus', { fileId: Store.fileId, email: el.dataset.email || '' });
    UI.toast(r.success ? 'Telegram diputus.' : (r.message || 'Gagal.'), r.success ? '' : 'warn'); await N.muatInfo(true); UI.render();
  });
  UI.act('tg-uji', async () => {
    const r = await Relay.call('tg.kirim', { fileId: Store.fileId, pesan: [{ ke: Store.me.email, teks: '✅ Pesan uji dari SatuAtap. Pengingat keluarga ' + U.esc(Store.setting('namaKeluarga', '')) + ' akan masuk ke sini.', kunci: 'uji|' + Date.now() }] });
    UI.toast(r.success ? (r.data.demo ? 'Mode demo: pesan tidak benar-benar dikirim.' : r.data.terkirim ? 'Terkirim — cek Telegram.' : 'Belum ada Telegram terhubung untuk akun ini.') : r.message, r.success && r.data.terkirim ? '' : 'warn');
  });
  UI.act('tg-jenis', () => {
    const o = notifSet();
    const s = UI.sheet({ title: 'Isi pengingat Telegram', body: UI.NOTIF_JENIS.map(j => `<label class="check"><input type="checkbox" name="${j[0]}" ${o[j[0]] ? 'checked' : ''}><span>${j[1]}</span></label>`).join('') + '<p class="muted small">Berlaku untuk semua anggota yang menghubungkan Telegram.</p>',
      foot: `<button class="btn" data-ok>Simpan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { const f = UI.formData(s.el), v = {}; UI.NOTIF_JENIS.forEach(j => v[j[0]] = !!f[j[0]]); Store.commit([{ op: 'upsert', t: 'Pengaturan', row: { id: 'notifTelegram', nilai: JSON.stringify(v) } }]); s.close(); };
  });
  UI.act('pend-aktif', () => { Store.commit([{ op: 'upsert', t: 'Pengaturan', row: { id: 'pendampingAktif', nilai: pendAktif() ? '' : '1' } }]); UI.toast(pendAktif() ? 'Pengingat dikirim script tiap pagi saja.' : 'Pengingat dari aplikasi aktif lagi.'); UI.render(); });
  UI.act('pend-salin', async () => {
    const t = `const FILE_ID = '${Store.fileId}';\nconst RELAY_URL = '${APP_CONFIG.RELAY_URL || ''}';`;
    try { await navigator.clipboard.writeText(t); UI.toast('Pengaturan Pendamping disalin.'); } catch (e) { prompt('Salin dua baris ini ke Pendamping.gs:', t); }
  });

  /** Kartu-kartu untuk halaman Lainnya › Notifikasi. */
  UI.notifKartu = () => {
    const inf = infoCache(), on = inf && inf.aktif, me = Store.me.email, o = notifSet();
    if (relayOk() && Date.now() - N.infoAt > 60e3) N.muatInfo().then(x => { if (x && UI.cur === 'pengaturan') UI.render(); }).catch(() => {});
    const anggota = Store.members(), terh = inf ? inf.terhubung || [] : [];
    const tg = !relayOk() ? `<p class="muted small">Tersedia setelah masuk dengan akun Google.</p>`
      : inf && !on ? `<p class="muted small">Bot Telegram belum diaktifkan oleh JuniorLabs.</p>`
      : `${inf && inf.gangguan ? `<div class="note warn small">${I('triangle-alert')} <span>${U.esc(inf.gangguan)}</span></div>` : ''}<div class="list">${anggota.map(m => { const t = terh.find(x => x.email === m.email); return `<div class="row"><span class="cat-ic ${t ? 'ok' : ''}">${I(t ? 'circle-check' : 'circle')}</span><div class="tx-txt"><b>${U.esc(m.nama)}</b><small>${t ? 'Terhubung' + (t.username ? ' · @' + U.esc(t.username) : '') : 'Belum terhubung'}</small></div>
          ${t && (m.email === me || Store.isAdminLike()) ? `<button class="btn ghost xs" data-act="tg-putus" data-email="${m.email === me ? '' : U.esc(m.email)}">Putus</button>` : ''}</div>`; }).join('')}</div>
        <div class="row-btns">${terh.some(x => x.email === me) ? `<button class="btn ghost sm" data-act="tg-uji">${I('send')} Kirim pesan uji</button>` : `<button class="btn sm" data-act="tg-hubung">${I('send')} Hubungkan Telegram saya</button>`}
          ${Store.isAdminLike() ? `<button class="btn ghost sm" data-act="tg-jenis">${I('sliders-horizontal')} Isi pengingat</button>` : ''}</div>
        <small class="muted">Aktif: ${UI.NOTIF_JENIS.filter(j => o[j[0]]).map(j => j[1].split(' (')[0]).join(' · ') || 'tidak ada'}</small>`;
    return `<div class="card"><h4 class="mini-h">${I('send')} Telegram @${U.esc((inf && inf.bot) || 'SatuAtapBot')} <span class="pill ok">gratis</span></h4>
        <p class="small">Pengingat tagihan, alert emas, dan <b>catat lewat chat</b> — kirim "makan siang 45rb gopay", lalu konfirmasi kategorinya di aplikasi. Setiap anggota menghubungkan akunnya sendiri.</p>${tg}</div>
      <div class="card"><h4 class="mini-h">${I('message-circle')} WhatsApp <span class="pill">opsional</span></h4>
        <p class="small">Lewat akun <b>Fonnte milik keluarga</b> dan sebuah script di akun Google Anda: <b>pengingat tagihan tiap pagi</b>, <b>catat lewat chat WA</b>, dan <b>ringkasan catatan pukul 20.00</b>. Script yang sama juga mengirim pengingat Telegram walau aplikasi tidak dibuka.</p>
        <p class="muted small">Dipasang sekali (± 10–20 menit) dengan panduan langkah demi langkah — semua tinggal salin–tempel. Token Fonnte hanya disimpan di script Anda.</p>
        <div class="row-btns"><button class="btn sm" data-act="panduan" data-k="pend">${I('book-open')} Pasang script</button><button class="btn ghost sm" data-act="panduan" data-k="wa">${I('message-circle')} Pasang WhatsApp</button></div>
        ${Store.isAdminLike() ? `<div class="row" style="margin-top:10px"><span class="cat-ic ${pendAktif() ? 'ok' : ''}">${I(pendAktif() ? 'circle-check' : 'circle')}</span><div class="tx-txt"><b>Script sudah terpasang</b><small>${pendAktif() ? 'Pengingat tagihan & rapat dikirim script sekali tiap pagi (±08.00) ke Telegram dan WhatsApp — aplikasi tidak mengirim lagi saat dibuka.' : 'Nyalakan setelah script terpasang agar pengingat tidak ganda.'}</small></div><button class="btn ${pendAktif() ? 'ghost ' : ''}xs" data-act="pend-aktif">${pendAktif() ? 'Matikan' : 'Nyalakan'}</button></div>` : ''}</div>`;
  };
  UI.pendampingKartu = () => '';

  // ---------- Panduan pasang Skrip Pendamping & WhatsApp (wizard langkah demi langkah) ----------
  const PEND = { teks: '', json: '' };
  const muatPend = async () => {
    if (PEND.teks) return;
    try { const [a, b] = await Promise.all([fetch('pendamping/Pendamping.gs.txt', { cache: 'no-cache' }).then(r => r.ok ? r.text() : ''), fetch('pendamping/appsscript.json', { cache: 'no-cache' }).then(r => r.ok ? r.text() : '')]); PEND.teks = a; PEND.json = b; } catch (e) {}
  };
  const kodeTerisi = () => PEND.teks
    .replace(/const FILE_ID = '[^']*';/, "const FILE_ID = '" + (Store.mode === 'live' ? Store.fileId : 'ID_FILE_KELUARGA') + "';")
    .replace(/const RELAY_URL = '[^']*';/, "const RELAY_URL = '" + (APP_CONFIG.RELAY_URL || '') + "';");
  const salin = async (teks, nama) => {
    if (!teks) return UI.toast('Berkas belum termuat — periksa internet lalu coba lagi.', 'warn');
    try { await navigator.clipboard.writeText(teks); UI.toast(nama + ' disalin ✓ — tempel di editor.'); }
    catch (e) { const t = UI.sheet({ title: 'Salin ' + nama, body: `<p class="muted small">Tekan lama di kotak › Pilih semua › Salin.</p><textarea class="kode-box" readonly>${U.esc(teks)}</textarea>` }); const ta = t.el.querySelector('textarea'); ta.focus(); ta.select(); }
  };
  const noWA = v => { let d = String(v || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '62' + d.slice(1); else if (d.startsWith('8')) d = '62' + d; return d.length >= 10 ? d : ''; };
  const simpanNo = o => { try { localStorage.setItem('sa:waNo:' + Store.fileId, JSON.stringify(o)); } catch (e) {} };
  const bacaNo = () => { try { return JSON.parse(localStorage.getItem('sa:waNo:' + Store.fileId) || '{}') || {}; } catch (e) { return {}; } };
  const waAnggota = () => { const o = bacaNo(); return Store.members().map(m => noWA(o[m.email]) ? noWA(o[m.email]) + '=' + m.email : '').filter(Boolean).join(','); };
  const admin = () => (Store.members().find(m => m.peran === 'admin') || Store.me || {}).email || '';
  const T = (judul, isi) => ({ judul, isi });
  const btn = (act, ikon, label, cls) => `<button type="button" class="btn ${cls || 'ghost'} sm" data-pa="${act}">${I(ikon)} ${label}</button>`;
  const link = (url, label) => `<a class="btn ghost sm" href="${url}" target="_blank" rel="noopener">${I('external-link')} ${label}</a>`;
  // Ilustrasi skematis (bukan tangkapan layar asli) — menunjukkan letak tombol yang harus diklik.
  const hl = (isi, n) => `<span class="mk-hl">${isi}${n ? `<i>${n}</i>` : ''}</span>`;
  const mock = (judul, isi) => `<figure class="mk"><figcaption>${I('image')} Ilustrasi · ${judul}</figcaption><div class="mk-body">${isi}</div></figure>`;
  const ILUS = {
    nama: () => mock('script.google.com', `<div class="mk-bar"><b class="mk-logo">Apps Script</b>${hl('Proyek tanpa judul', 1)}<span class="mk-sp"></span><span class="mk-btn biru">Terapkan ▾</span></div><div class="mk-note">Klik judul › ketik <b>SatuAtap Pendamping</b> › Ganti nama</div>`),
    manifes: () => mock('Setelan Proyek', `<div class="mk-cols"><div class="mk-side"><span>ⓘ</span><span>&lt;&gt;</span><span>⏱</span>${hl('⚙️', 1)}</div><div class="mk-main"><b>Setelan Proyek</b><div class="mk-row">☑ Aktifkan runtime Chrome V8</div><div class="mk-row">${hl('☑ Tampilkan file manifes "appsscript.json" di editor', 2)}</div></div></div>`),
    file: (f) => mock('Editor', `<div class="mk-cols"><div class="mk-files"><small>File</small><div class="${f === 'json' ? 'on' : ''}">${f === 'json' ? hl('appsscript.json', 1) : 'appsscript.json'}</div><div class="${f === 'kode' ? 'on' : ''}">${f === 'kode' ? hl('Kode.gs', 1) : 'Kode.gs'}</div></div><div class="mk-main mk-code">${hl('Ctrl+A › hapus › tempel (Ctrl+V)', 2)}<br><span class="mk-dim">…isi lama diganti seluruhnya…</span><div class="mk-row">Lalu simpan: 💾 atau Ctrl+S</div></div></div>`),
    jalankan: (fn) => mock('Toolbar editor', `<div class="mk-bar">↶ ↷ 💾 ${hl('▶ Jalankan', 2)}<span class="mk-btn">Debug</span>${hl(fn + ' ▾', 1)}<span class="mk-btn">Log eksekusi</span></div><div class="mk-note">1 pilih fungsi <b>${fn}</b> · 2 klik <b>Jalankan</b> · hasil muncul di <b>Log eksekusi</b> (bawah)</div>`),
    izin: () => mock('Izin Google', `<div class="mk-dialog"><b>Google belum memverifikasi aplikasi ini</b><p class="mk-dim">Aplikasi meminta akses ke info sensitif di Akun Google Anda…</p><div class="mk-row">${hl('Lanjutan', 1)}<span class="mk-sp"></span><span class="mk-btn biru">Kembali ke keamanan</span></div><div class="mk-row">${hl('Buka SatuAtap Pendamping (tidak aman)', 2)}</div><div class="mk-row"><span class="mk-sp"></span>${hl('Izinkan', 3)}</div></div>`),
    api: () => mock('Google Cloud · Google Sheets API', `<div class="mk-dialog"><b>Google Sheets API</b><p class="mk-dim">Reads and writes Google Sheets.</p><div class="mk-row">${hl('<span class="mk-btn biru">AKTIFKAN</span>', 1)}<span class="mk-btn">Coba API ini</span></div></div><div class="mk-note">Tunggu 1–2 menit, lalu kembali ke editor dan Jalankan lagi.</div>`),
    prop: (rows) => mock('Setelan Proyek › Properti skrip', `<div class="mk-main"><b>Properti skrip</b><div class="mk-tbl"><div><small>Properti</small><small>Nilai</small></div>${rows.map(r => `<div><code>${r[0]}</code><span class="mk-dim">${r[1]}</span></div>`).join('')}</div><div class="mk-row">${hl('+ Tambahkan properti skrip', 1)}<span class="mk-sp"></span>${hl('<span class="mk-btn biru">Simpan properti skrip</span>', 2)}</div></div>`),
    deploy: () => mock('Terapkan › Deployment baru', `<div class="mk-dialog"><b>Deployment baru</b><div class="mk-row">Pilih jenis ${hl('⚙️', 1)} → <b>Aplikasi web</b></div><div class="mk-row">Jalankan sebagai: <b>Saya</b></div><div class="mk-row">Yang memiliki akses: ${hl('Siapa saja', 2)}</div><div class="mk-row"><span class="mk-sp"></span>${hl('<span class="mk-btn biru">Terapkan</span>', 3)}</div></div><div class="mk-dialog"><small>Aplikasi web · URL</small><div class="mk-row"><code>https://script.google.com/macros/s/AKfy…/exec</code>${hl('Salin', 4)}</div></div>`),
    fonnte: () => mock('fonnte.com › Device › Edit', `<div class="mk-main"><small>Webhook</small><div class="mk-row">${hl('<code>https://…/api/wa?id=…&amp;k=…</code>', 1)}</div><small>autoread</small><div class="mk-row">${hl('● On', 2)}</div><small>Response Source</small><div class="mk-row mk-dim">Autoreply (biarkan)</div><div class="mk-row">${hl('<span class="mk-btn gelap">Update</span>', 3)}</div></div>`),
    token: () => mock('fonnte.com › Device', `<div class="mk-tbl tiga"><div><small>Device</small><small>Status</small><small>Aksi</small></div><div><span>SatuAtap<br><span class="mk-dim">62812…</span></span><span class="mk-ok">connect</span><span>${hl('Token', 1)} · Edit</span></div></div>`)
  };
  const kunciWA = () => { const id = 'sa:waKunci:' + Store.fileId; try { let k = localStorage.getItem(id); if (!k) { const a = new Uint8Array(16); crypto.getRandomValues(a); k = Array.from(a).map(x => x.toString(16).padStart(2, '0')).join(''); localStorage.setItem(id, k); } return k; } catch (e) { return 'buatkuncisendiri1234'; } };
  const salinBaris = (nama, nilai, ket) => `<div class="pv-row"><div><code>${nama}</code><small class="muted">${ket}</small></div><div class="row-btns"><button type="button" class="btn ghost xs" data-salin="${U.esc(nama)}" data-nm="Nama properti">${I('copy')} Nama</button>${nilai ? `<button type="button" class="btn xs" data-salin="${U.esc(nilai)}" data-nm="Nilai ${U.esc(nama)}">${I('copy')} Nilai</button>` : ''}</div></div>`;
  const PANDUAN = {
    pend: { judul: 'Pasang script', langkah: () => [
      T('Apa ini & siapkan', `<p>Script ini berjalan di akun Google <b>Anda sendiri</b> setiap pagi ± pukul 08.00, walau aplikasi tidak dibuka. Tugasnya:</p>
        <ul class="ul"><li>mengirim pengingat tagihan & cicilan (H-7, H-3, H-1, hari H; di bawah Rp 1 juta cukup H-1 & hari H) ke <b>Telegram</b>,</li><li>dan ke <b>WhatsApp</b> bila Anda memasangnya di panduan berikutnya.</li></ul>
        <div class="note small">${I('clock')} <span>± 10 menit, sekali saja. Semua kode tinggal <b>salin–tempel</b> dari panduan ini.</span></div>
        <div class="note small">${I('monitor')} <span>Paling mudah di <b>laptop/komputer</b>. Di HP: Chrome › ⋮ › centang <b>Situs desktop</b>.</span></div>
        <div class="note small">${I('user')} <span>Masuk Google dengan akun <b>${U.esc(admin())}</b> (Admin keluarga).</span></div>`),
      T('Buat proyek baru', `<ol class="steps"><li>Ketuk tombol di bawah — terbuka <b>script.google.com</b> dengan proyek kosong.</li><li>Klik judul <b>"Proyek tanpa judul"</b> di kiri atas.</li><li>Ketik <code>SatuAtap Pendamping</code> › <b>Ganti nama</b>.</li></ol>
        <div class="row-btns">${link('https://script.google.com/home/projects/create', 'Buka script.google.com')}<button type="button" class="btn ghost sm" data-salin="SatuAtap Pendamping" data-nm="Nama proyek">${I('copy')} Salin nama</button></div>${ILUS.nama()}`),
      T('Tampilkan file manifes', `<ol class="steps"><li>Di sisi kiri, klik ikon <b>⚙️ Setelan Proyek</b> (gerigi).</li><li>Centang <b>"Tampilkan file manifes 'appsscript.json' di editor"</b>.</li><li>Klik ikon <b>&lt;&gt; Editor</b> untuk kembali. Sekarang ada dua file: <code>appsscript.json</code> dan <code>Kode.gs</code>.</li></ol>${ILUS.manifes()}`),
      T('Tempel appsscript.json', `<ol class="steps"><li>Ketuk <b>Salin appsscript.json</b>.</li><li>Di editor klik file <b>appsscript.json</b>.</li><li>Tekan <kbd>Ctrl</kbd>+<kbd>A</kbd> › hapus › tempel <kbd>Ctrl</kbd>+<kbd>V</kbd>.</li><li>Simpan: ikon 💾 atau <kbd>Ctrl</kbd>+<kbd>S</kbd>.</li></ol>
        <div class="row-btns">${btn('json', 'copy', 'Salin appsscript.json', '')}</div>${ILUS.file('json')}<p class="muted small">Isinya daftar izin script: membaca file data (baca-saja) dan mengirim pengingat.</p>`),
      T('Tempel kode script', `<ol class="steps"><li>Ketuk <b>Salin kode script</b>. Kode <b>sudah berisi</b> ID file keluarga & alamat server — tidak perlu diubah.</li><li>Klik file <b>Kode.gs</b>.</li><li><kbd>Ctrl</kbd>+<kbd>A</kbd> › hapus › tempel › simpan 💾.</li></ol>
        <div class="note small">${I('refresh-cw')} <span><b>Memperbarui script lama?</b> Cukup langkah ini dan <b>setupPendamping</b> lagi — pengaturan (token WA, nomor, jadwal) tidak hilang, dan ID file & alamat server kini disimpan otomatis di Properti skrip.</span></div>
        ${Store.mode !== 'live' ? '<div class="note warn small">Mode demo: ID file belum terisi. Lakukan dari akun keluarga sungguhan.</div>' : ''}<div class="row-btns">${btn('kode', 'copy', 'Salin kode script', '')}</div>${ILUS.file('kode')}`),
      T('Jalankan setupPendamping', `<ol class="steps"><li>Di toolbar atas, pada kotak pilihan fungsi pilih <b>setupPendamping</b>.</li><li>Klik <b>▶ Jalankan</b>.</li><li>Muncul <b>"Otorisasi diperlukan"</b> › klik <b>Tinjau izin</b> › pilih akun ${U.esc(admin())}.</li></ol>${ILUS.jalankan('setupPendamping')}`),
      T('Beri izin', `<ol class="steps"><li>Muncul <b>"Google belum memverifikasi aplikasi ini"</b> › klik <b>Lanjutan</b> (tulisan kecil di kiri bawah).</li><li>Klik <b>Buka SatuAtap Pendamping (tidak aman)</b>.</li><li>Klik <b>Izinkan</b>.</li></ol>${ILUS.izin()}
        <div class="note small">${I('shield-check')} <span>Peringatan ini wajar: script Anda pasang sendiri di akun Anda, jadi Google tidak memeriksanya. Script hanya <b>membaca</b> file data SatuAtap.</span></div>
        <div class="note warn small">${I('triangle-alert')} <span>Log menulis <b>"Google Sheets API belum aktif"</b>? Klik tautan di log itu › <b>AKTIFKAN</b> › tunggu 1–2 menit › <b>▶ Jalankan</b> lagi. Hanya sekali.</span></div>${ILUS.api()}`),
      T('Selesai', `<p>Lihat <b>Log eksekusi</b> di bawah editor. Berhasil bila ada baris:</p><div class="kode-mini">✅ Pendamping aktif untuk "…" — … transaksi terbaca.</div>
        <ul class="ul"><li>Pengingat Telegram terkirim tiap pagi ke anggota yang sudah <b>Hubungkan Telegram</b>.</li><li>Tidak ada yang perlu dijalankan lagi — script bekerja sendiri.</li><li>Ada kode versi baru nanti? Salin ulang dari panduan ini, tempel menimpa, jalankan <b>setupPendamping</b> sekali lagi. Selesai.</li><li>Berhenti kapan saja: pilih fungsi <b>hentikanPendamping</b> › Jalankan.</li></ul>
        <div class="note small">${I('triangle-alert')} <span>Ada tulisan merah? Foto layar log-nya dan kirim ke JuniorLabs.</span></div>
        <div class="note small">${I('info')} <span>Terakhir: di <b>Lainnya › Notifikasi</b> nyalakan <b>"Script sudah terpasang"</b> agar pengingat hanya datang sekali tiap pagi (dari script), tidak ganda.</span></div>
        <div class="row-btns"><button type="button" class="btn sm" data-pa="ke-wa">${I('message-circle')} Lanjut pasang WhatsApp</button></div>`)
    ] },
    wa: { judul: 'Pasang WhatsApp (Fonnte)', langkah: () => [
      T('Sebelum mulai', `<p>Dengan WhatsApp, keluarga mendapat <b>2 pesan sehari</b> dari nomor pengirim:</p>
        <ul class="ul"><li><b>Pagi ± 08.00</b> — pengingat tagihan & cicilan.</li><li><b>Malam 20.00</b> — ringkasan catatan yang dikirim lewat WA hari itu.</li></ul>
        <p>Anggota mencatat dengan mengirim chat, mis. <code>makan siang 45rb gopay</code>. Chat <b>tidak dibalas satu per satu</b> (hemat kuota); catatannya langsung muncul sebagai draf di aplikasi.</p>
        <p><b>Siapkan:</b></p><ul class="ul"><li><b>Script sudah terpasang</b> (panduan "Pasang script").</li><li><b>Satu nomor WhatsApp pengirim</b> — sebaiknya nomor kedua/khusus, bukan nomor anggota yang mencatat.</li><li>Akun <b>Fonnte</b> (ada paket gratis).</li></ul>
        <div class="row-btns"><button type="button" class="btn ghost sm" data-pa="ke-pend">${I('book-open')} Belum pasang script</button></div>`),
      T('Daftar & sambungkan Fonnte', `<ol class="steps"><li>Buka <b>fonnte.com</b> › <b>Register</b> › verifikasi › <b>Login</b>.</li><li>Menu <b>Device</b> › <b>Add device</b>: nama <code>SatuAtap</code>, nomor = <b>nomor WA pengirim</b> › Save.</li>
          <li>Pada baris device klik <b>Connect</b> › muncul QR.</li><li>Di HP nomor pengirim: WhatsApp › ⋮ › <b>Perangkat tertaut</b> › <b>Tautkan perangkat</b> › scan QR.</li><li>Status device menjadi <b>connect</b>.</li></ol>
        <div class="row-btns">${link('https://md.fonnte.com/new/register.php', 'Buka fonnte.com')}</div>`),
      T('Salin token Fonnte', `<ol class="steps"><li>fonnte.com › menu <b>Device</b>.</li><li>Pada baris device klik <b>Token</b> › token tersalin / tampil.</li><li>Simpan sebentar (dipakai di langkah 5).</li></ol>${ILUS.token()}
        <div class="note small">${I('lock')} <span><b>Jangan bagikan token</b> — siapa pun yang memilikinya bisa mengirim WA atas nomor Anda. Token hanya disimpan di script Anda, tidak di aplikasi & tidak di JuniorLabs.</span></div>`),
      T('Nomor WA anggota', `<p>Isi nomor WhatsApp <b>tiap anggota</b> — nomor yang menerima pengingat & mengirim catatan. Boleh diawali 08…</p>
        <div class="wa-no">${Store.members().map(m => `<label class="field"><span>${U.esc(m.nama)} <small class="muted">${U.esc(m.email)}</small></span><input inputmode="tel" data-wa="${U.esc(m.email)}" value="${U.esc(bacaNo()[m.email] || '')}" placeholder="08xxxxxxxxxx"></label>`).join('')}</div>
        <p class="muted small">Nomor hanya disimpan di HP ini untuk menyusun nilai di langkah berikutnya.</p>`),
      T('Isi 3 Properti skrip', `<p>Di editor <b>SatuAtap Pendamping</b>: klik <b>⚙️ Setelan Proyek</b> › gulir ke <b>Properti skrip</b> › <b>Tambahkan properti skrip</b>. Buat 3 baris — salin nama & nilainya dari sini:</p>
        <div class="pv">${salinBaris('FONNTE_TOKEN', '', 'Nilai: tempel token Fonnte dari langkah 3')}
          <div data-pv-anggota>${salinBaris('WA_ANGGOTA', waAnggota(), waAnggota() ? 'Nomor anggota dari langkah 4' : 'Isi nomor di langkah 4 dulu')}</div>
          ${salinBaris('WA_KUNCI', kunciWA(), 'Kunci rahasia webhook (dibuat otomatis)')}</div>
        <p>Terakhir klik <b>Simpan properti skrip</b>.</p>${ILUS.prop([['FONNTE_TOKEN', 'token Fonnte…'], ['WA_ANGGOTA', '62812…=email,…'], ['WA_KUNCI', kunciWA().slice(0, 8) + '…']])}`),
      T('Jalankan setupWA', `<ol class="steps"><li>Klik <b>&lt;&gt; Editor</b>.</li><li>Pilih fungsi <b>setupWA</b> › <b>▶ Jalankan</b> (izinkan bila diminta).</li><li>Setiap anggota menerima WA: <b>"✅ SatuAtap tersambung ke WhatsApp keluarga ini."</b></li></ol>${ILUS.jalankan('setupWA')}
        <p class="muted small">Sampai di sini <b>pengingat pagi sudah aktif</b>. Tiga langkah berikutnya untuk <b>mencatat lewat chat WA</b>.</p>`),
      T('Terapkan sebagai Aplikasi web', `<ol class="steps"><li>Kanan atas klik <b>Terapkan</b> › <b>Deployment baru</b>.</li><li>Klik ⚙️ di samping "Pilih jenis" › <b>Aplikasi web</b>.</li><li>Jalankan sebagai: <b>Saya</b>. Yang memiliki akses: <b>Siapa saja</b> — <u>bukan</u> "Siapa saja yang memiliki Akun Google".</li><li>Klik <b>Terapkan</b> (izinkan bila diminta).</li><li>Pada <b>URL Aplikasi web</b> klik <b>Salin</b>, lalu <b>Selesai</b>.</li></ol>${ILUS.deploy()}
        <div class="note small">${I('info')} <span>Setiap kali kode script diganti: <b>Terapkan › Kelola deployment › ✏️ › Versi baru › Terapkan</b>. Jangan "Deployment baru" lagi, agar alamat tidak berubah.</span></div>`),
      T('Pasang webhook di Fonnte', `<ol class="steps"><li>Tempel <b>URL Aplikasi web</b> (dari langkah 7) di kotak ini:</li></ol>
        <label class="field"><span>URL Aplikasi web <small class="muted">(berakhiran /exec)</small></span><input data-wh-in placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" value="${U.esc((() => { try { return localStorage.getItem('sa:waUrl:' + Store.fileId) || ''; } catch (e) { return ''; } })())}"></label>
        <div class="kv-list"><div class="kv"><span>Alamat webhook</span><b><code class="wrap" data-wh-out>—</code></b></div></div>
        <div class="row-btns">${btn('wh-salin', 'copy', 'Salin alamat webhook', '')}${btn('wh-buka', 'external-link', 'Cek di browser')}</div>
        <ol class="steps" start="2"><li>Ketuk <b>Cek di browser</b> — harus muncul <b>"✅ Jembatan WhatsApp aktif & tersambung ke Pendamping"</b>.</li><li>Di fonnte.com › <b>Device</b> › <b>Edit</b>: tempel alamat webhook di kolom <b>Webhook</b>.</li><li>Nyalakan <b>autoread</b> (On). <b>Response Source</b> biarkan apa adanya.</li><li>Klik <b>Update</b>.</li></ol>${ILUS.fonnte()}`),
      T('Uji & cara pakai', `<ol class="steps"><li>Dari WA salah satu anggota, kirim ke <b>nomor pengirim</b>: <code>makan siang 45rb gopay</code>.</li><li>Tidak ada balasan langsung — itu normal.</li><li>Buka aplikasi › <b>Mutasi › Menunggu konfirmasi</b>: catatan muncul sebagai draf. Geser kanan untuk menyimpan.</li><li>Pukul <b>20.00</b> nomor pengirim mengirim ringkasan catatan hari itu.</li></ol>
        <div class="note small">${I('info')} <span>Pesan yang sama persis dalam 30 menit hanya dicatat sekali. Memang dua transaksi? Awali dengan <b>lagi</b>: <code>lagi parkir 5rb tunai</code>.</span></div>
        <div class="note small">${I('circle-help')} <span>Draf tidak muncul setelah beberapa menit? Di editor jalankan fungsi <b>cekWA</b> — bagian "Kiriman webhook terakhir" menunjukkan apakah pesan sampai dan mengapa ditolak. Fonnte kadang meneruskan pesan terlambat; untuk catat cepat, Telegram lebih bisa diandalkan.</span></div>`)
    ] }
  };
  UI.act('panduan', el => UI.panduan(el.dataset.k));
  UI.panduan = (k) => {
    const P = PANDUAN[k]; if (!P) return; muatPend();
    let L = P.langkah(); const kunci = 'sa:pand:' + k; let i = Math.min(L.length - 1, Number(localStorage.getItem(kunci) || 0) || 0);
    const s = UI.sheet({ title: P.judul, body: '<div class="pand"></div>', foot: `<button class="btn ghost" data-n="-1">${I('chevron-left')} Kembali</button><button class="btn" data-n="1">Lanjut ${I('chevron-right')}</button>` });
    const box = s.el.querySelector('.pand'), bK = s.el.querySelector('[data-n="-1"]'), bL = s.el.querySelector('[data-n="1"]');
    let gambar = () => {
      try { localStorage.setItem(kunci, String(i)); } catch (e) {}
      L = P.langkah();      // isi langkah mengikuti data terbaru (nomor WA, kunci)
      box.innerHTML = `<div class="pand-dots">${L.map((_, j) => `<button type="button" class="${j === i ? 'on' : j < i ? 'ok' : ''}" data-ke="${j}" aria-label="Langkah ${j + 1}">${j < i ? I('check') : j + 1}</button>`).join('')}</div>
        <div class="pand-step"><small class="muted">Langkah ${i + 1} dari ${L.length}</small><h3>${L[i].judul}</h3>${L[i].isi}</div>`;
      bK.disabled = i === 0; bL.innerHTML = i === L.length - 1 ? I('check') + ' Selesai' : 'Lanjut ' + I('chevron-right');
      const sc = s.el.querySelector('.sheet-body') || box.parentElement; if (sc) sc.scrollTop = 0;
    };
    s.el.addEventListener('click', e => {
      const d = e.target.closest('[data-ke]'); if (d) { i = +d.dataset.ke; return gambar(); }
      const n = e.target.closest('[data-n]'); if (n) { if (+n.dataset.n > 0 && i === L.length - 1) { try { localStorage.removeItem(kunci); } catch (x) {} s.close(); return UI.toast('Mantap! Panduan bisa dibuka lagi kapan saja.'); } i = Math.max(0, Math.min(L.length - 1, i + +n.dataset.n)); return gambar(); }
      const sl = e.target.closest('[data-salin]'); if (sl) return salin(sl.dataset.salin, sl.dataset.nm || 'Teks');
      const a = e.target.closest('[data-pa]'); if (!a) return;
      const act = a.dataset.pa;
      if (act === 'kode') salin(kodeTerisi(), 'Kode Pendamping');
      else if (act === 'json') salin(PEND.json, 'appsscript.json');
      else if (act === 'wa-anggota') { const v = waAnggota(); if (!v) return UI.toast('Isi minimal satu nomor yang benar.', 'warn'); salin(v, 'WA_ANGGOTA'); }
      else if (act === 'wh-salin' || act === 'wh-buka') { const o = s.el.querySelector('[data-wh-out]'), v = o && o.textContent; if (!v || !/^https/.test(v)) return UI.toast('Tempel dulu URL Aplikasi web (berakhiran /exec).', 'warn'); if (act === 'wh-buka') window.open(v, '_blank', 'noopener'); else salin(v, 'Alamat webhook'); }
      else if (act === 'ke-wa' || act === 'ke-pend') { s.close(); setTimeout(() => UI.panduan(act === 'ke-wa' ? 'wa' : 'pend'), 250); }
    });
    s.el.addEventListener('input', e => {
      if (e.target.dataset && e.target.dataset.whIn !== undefined) { whHitung(e.target.value); return; }
      const w = e.target.dataset && e.target.dataset.wa; if (!w) return; const o = bacaNo(); o[w] = e.target.value; simpanNo(o); const out = s.el.querySelector('[data-wa-out]'); if (out) out.textContent = waAnggota() || '—'; e.target.classList.toggle('bad', !!e.target.value && !noWA(e.target.value)); });
    const whHitung = (v) => { v = String(v || '').trim(); const m = /script\.google\.com\/macros\/s\/([A-Za-z0-9_-]{20,})\/exec(?:\?k=([A-Za-z0-9]+))?/.exec(v), o = s.el.querySelector('[data-wh-out]'); if (!o) return;
      if (m) try { localStorage.setItem('sa:waUrl:' + Store.fileId, v); } catch (e) {}
      o.textContent = m ? location.origin + '/api/wa?id=' + m[1] + '&k=' + (m[2] || kunciWA()) : (v ? 'URL belum lengkap — harus berakhiran /exec' : '—'); };
    const asli = gambar; gambar = () => { asli(); const inp = s.el.querySelector('[data-wh-in]'); if (inp && inp.value) whHitung(inp.value); };
    gambar();
  };

  // ---------- Kotak: catatan dari Telegram / WA → DRAF ----------
  // Pesan chat masuk sebagai draf di "Menunggu konfirmasi" (Beranda & Mutasi). Geser kanan = simpan bila
  // nominal, kategori & dompet sudah terbaca; ketuk = periksa/ubah dulu. Relay menyimpan pesan sampai
  // ditandai selesai (tg.selesai), jadi draf tampil di semua perangkat dan tidak hilang.
  const W = id => (Store.byId.Wallet[id] || {}).nama || '', K = id => (Store.byId.Kategori[id] || {}).nama || '';
  const txId = x => 't_k' + String(x.id).replace(/[^A-Za-z0-9]/g, '');
  const lengkap = r => !!(r.jumlah && r.kategoriId && r.walletId);
  const rowOf = (x, r) => ({ op: 'upsert', t: 'Transaksi', row: { id: txId(x), tanggal: String(x.waktu || '').slice(0, 10) || U.today(), jenis: r.jenis, jumlah: r.jumlah, kategoriId: r.kategoriId, walletId: r.walletId, walletTujuan: '', biaya: 0,
    catatan: r.catatan || x.teks, dibayarOleh: x.email || Store.me.email, tag: '', sumber: x.sumber || 'telegram', refId: '', periodeRef: '', dicatatOleh: x.email || Store.me.email, dibuat: new Date().toISOString(), riwayat: [] } });
  const ringkas = r => [r.catatan, U.rp(r.jumlah), K(r.kategoriId), W(r.walletId)].filter(Boolean).join(' · ');
  const selesai = (ids, info) => { if (ids.length && relayOk()) Relay.call('tg.selesai', { fileId: Store.fileId, ids, info: info || {} }).catch(() => {}); };
  const hapus = ids => tulisKotak(bacaKotak().filter(x => ids.indexOf(x.id) < 0));
  /** Draf yang tampil: milik sendiri; Admin & Pasangan juga melihat draf satu sama lain (anak hanya miliknya). */
  const terlihat = x => { if (!x.email || x.email === Store.me.email) return true; if (!Store.isAdminLike()) return false; const m = Store.members().find(z => z.email === x.email); return !!m && (m.peran === 'admin' || m.peran === 'pasangan'); };
  UI.kotakList = () => bacaKotak().filter(x => terlihat(x) && !Store.byId.Transaksi[txId(x)]);
  App.ambilKotak = async (force) => {
    if (!relayOk() || N.kotakJalan || (!force && Date.now() - N.kotakAt < 60e3)) return;
    N.kotakAt = Date.now(); N.kotakJalan = true;
    try {
      const r = await Relay.call('tg.ambil', { fileId: Store.fileId });
      if (!r.success || !r.data) return;
      const datang = r.data.item || [], lama = bacaKotak();
      let a = r.data.ack ? datang.slice() : lama.concat(datang.filter(x => !lama.some(y => y.id === x.id)));
      const sudah = a.filter(x => Store.byId.Transaksi[txId(x)]).map(x => x.id);     // sudah dikonfirmasi di perangkat lain
      a = a.filter(x => sudah.indexOf(x.id) < 0);
      if (sudah.length) selesai(sudah);
      let baru = a.filter(x => !lama.some(y => y.id === x.id));
      tulisKotak(a);
      baru = baru.filter(terlihat);
      if (baru.length) UI.toast(baru.length === 1 ? 'Draf dari chat: ' + baru[0].teks.slice(0, 40) + ' — konfirmasi di Mutasi.' : baru.length + ' draf dari chat menunggu konfirmasi.', 'ok', { ms: 4500 });
      if (JSON.stringify(a.map(x => x.id)) !== JSON.stringify(lama.map(x => x.id)) && (UI.cur === 'beranda' || UI.cur === 'mutasi')) UI.render();
    } catch (e) {} finally { N.kotakJalan = false; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && window.App && App.ready) App.ambilKotak().catch(() => {}); });
  /** Dipanggil saat Beranda/Mutasi digambar: ambil draf baru di latar (dibatasi 1×/menit). */
  UI.kotakAlert = () => { if (App.ready) setTimeout(() => App.ambilKotak().catch(() => {}), 300); return ''; };
  /** Baris draf chat — tampil bersama draf tagihan rutin di "Menunggu konfirmasi". */
  /** Draf chat/email → isian transaksi. Draf email berformat kolom "nama | nominal | dompet | arah". */
  UI.parseKotak = x => {
    const p = String(x.teks || '').split(' | ');
    if (x.sumber !== 'email' || p.length < 3) return Voice.parse(x.teks);
    const jenis = p[3] === 'masuk' ? 'masuk' : 'keluar', nama = p[0].trim(), r = Voice.parse((p[2] || '') + ' ' + p[1]);
    const kat = jenis === 'keluar' && window.AI && AI.kategoriBarang ? AI.kategoriBarang(nama, '') : (window.Kamus ? Kamus.tebak(nama, jenis) : '');
    return Object.assign(r, { jenis, jumlah: Number(String(p[1]).replace(/\D/g, '')) || r.jumlah, catatan: nama.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, w => w.toLowerCase()), kategoriId: kat || '', raw: nama });
  };
  UI.kotakRow = x => { const r = UI.parseKotak(x), ok = lengkap(r), k = Store.byId.Kategori[r.kategoriId];
    return `<div class="swipe" data-kotak="${U.esc(x.id)}" ${ok ? 'data-draft="1"' : ''}>
      <div class="sw-l">${I('check')} Simpan</div><div class="sw-r"><button class="danger" data-act="kotak-buang" data-id="${U.esc(x.id)}">${I('trash-2')}<span>Buang</span></button></div>
      <div class="sw-main tx draft" data-act="kotak-ubah" data-id="${U.esc(x.id)}">
        <span class="cat-ic chat">${I(k ? k.ikon || 'tag' : (x.sumber === 'wa' ? 'message-circle' : x.sumber === 'email' ? 'mail' : 'send'))}</span>
        <div class="tx-txt"><b>${U.esc(r.catatan || x.teks)}</b><small>${x.email && x.email !== Store.me.email ? U.esc(Store.memberName(x.email)) + ' · ' : ''}${x.sumber === 'wa' ? 'WhatsApp' : x.sumber === 'email' ? 'Email bank' : 'Telegram'} · ${U.timeAgo(x.waktu)} · ${ok ? U.esc(K(r.kategoriId) + ' · ' + W(r.walletId)) : `<span class="vq-need">${!r.jumlah ? 'isi nominal' : !r.kategoriId ? 'pilih kategori' : 'pilih dompet'}</span>`}</small></div>
        <div class="tx-amt">${r.jumlah ? UI.amount(r.jumlah, r.jenis) : '<b class="muted">Rp ?</b>'}<small>draf</small></div>
        <button class="kebab" data-act="kotak-ubah" data-id="${U.esc(x.id)}" aria-label="Periksa">${I('ellipsis-vertical')}</button>
      </div></div>`; };
  UI.kotakSimpan = async (id) => {
    const x = bacaKotak().find(z => z.id === id); if (!x) return;
    const r = UI.parseKotak(x); if (!lengkap(r)) return UI.acts['kotak-ubah']({ dataset: { id } });
    if (!(await UI.commitPriv([rowOf(x, r)]))) return;
    hapus([id]); selesai([id], { [id]: ringkas(r) });
    UI.toast('Tersimpan · ' + ringkas(r), 'ok', { undo: () => Store.commit([{ op: 'delete', t: 'Transaksi', id: txId(x) }]), ms: 4500 });
  };
  UI.act('kotak-ubah', el => {
    const x = bacaKotak().find(z => z.id === el.dataset.id); if (!x) return; const r = UI.parseKotak(x);
    UI.catat({ preset: { jenis: r.jenis, jumlah: r.jumlah, kategoriId: r.kategoriId, walletId: r.walletId, catatan: r.catatan || x.teks, tanggal: String(x.waktu || '').slice(0, 10), sumber: x.sumber || 'telegram' },
      onSaved: (ops) => { const t = (ops || []).map(o => o.row).find(Boolean) || r; if (t.kategoriId && t.kategoriId !== r.kategoriId) Voice.ajari(r.raw || x.teks, t.kategoriId); hapus([x.id]); selesai([x.id], { [x.id]: ringkas(Object.assign({}, r, t)) }); } });
  });
  UI.act('kotak-buang', async el => {
    const x = bacaKotak().find(z => z.id === el.dataset.id); if (!x) return;
    if (!(await UI.confirm('Buang draf ini?', '“' + x.teks + '” tidak akan dicatat.', 'Buang', true))) return;
    hapus([x.id]); selesai([x.id]); UI.render();
  });

  // ---------- Pengingat yang dikirim dari aplikasi (melengkapi Skrip Pendamping) ----------
  const pendAktif = () => Store.setting('pendampingAktif', '') === '1';
  const adaTelegram = () => { const inf = infoCache(); return inf && inf.aktif && (inf.terhubung || []).length; };
  const kirim = (pesan) => pesan.length && relayOk() && Store.mode === 'live' ? Relay.call('tg.kirim', { fileId: Store.fileId, pesan }).catch(() => {}) : null;
  /** Dipanggil setelah sinkron: tagihan H-7/H-3/H-1/H & rapat (kunci sama dengan Pendamping → tidak dobel). Sekali per jam per perangkat. */
  App.notifTagihan = () => {
    if (!adaTelegram()) return;
    const k = 'sa:tgNotif:' + Store.fileId, last = Number(localStorage.getItem(k) || 0);
    if (Date.now() - last < 3600e3 || new Date().getHours() < 7) return;
    localStorage.setItem(k, String(Date.now()));
    const o = notifSet(), pesan = [], today = U.today(), pend = pendAktif();   // Pendamping terpasang → pengingat tagihan & rapat hanya dari script (sekali tiap pagi)
    if (o.tagihan && !pend) Calc.occurrences(today, U.addDays(today, 7)).forEach(x => {
      if (x.arah !== 'keluar' || x.lunas || x.kind === 'rapat' || x.kind === 'tujuan') return;
      const h = U.diffDays(today, x.tanggal); if (((Number(x.sisa) || 0) < 1000000 ? [1, 0] : [7, 3, 1, 0]).indexOf(h) < 0) return;   // < Rp 1 juta: H-1 & hari H saja
      const occ = x.kind === 'acara' ? 'a|' + x.ref.id : x.id;
      pesan.push({ ke: 'semua', kunci: 'occ|' + occ + '|H-' + h, teks: (h <= 1 ? '🔔 ' : '🗓️ ') + U.esc(x.nama) + ' · <b>' + U.rp(x.sisa) + '</b> jatuh tempo ' + (h === 0 ? '<b>hari ini</b>' : h === 1 ? '<b>besok</b>' : h + ' hari lagi (' + U.tgl(x.tanggal, 'dm') + ')') + '.' });
    });
    // Rapat: hanya bila jadwal rutin sudah diatur, dan hanya pada H-1 & hari-H jadwalnya (bukan tiap hari setelah terlewat).
    if (o.rapat && !pend && Store.setting('rapatTanggal', '') !== '') Calc.rapatJadwal(today, U.addDays(today, 1)).forEach(x => {
      if (x.lunas) return; const h = U.diffDays(today, x.tanggal), tahunan = x.tanggal.slice(5, 7) === '12';
      pesan.push({ ke: 'semua', kunci: 'rapat|' + x.tanggal.slice(0, 7) + '|H-' + h, teks: '👥 Rapat keuangan keluarga ' + (h === 0 ? '<b>hari ini</b>' : '<b>besok</b>') + (tahunan ? ' — rapat tahunan dengan Kilas Balik.' : '.') + '\nAgendanya sudah disusun otomatis di aplikasi.' });
    });
    kirim(pesan.slice(0, 20));
  };
  /** Amplop melewati 80% / 100% setelah transaksi dicatat di perangkat ini. */
  const tingkat = {};
  /** Dipakai modul lain (mis. alert SL/TP saham). */
  App.tgSiap = () => adaTelegram();
  App.tgKirim = (pesan) => kirim(pesan);
  App.notifAmplop = () => {
    if (!adaTelegram() || !notifSet().amplop) return;
    const p = Calc.period(), pesan = [];
    Calc.envelopes(p).forEach(e => {
      if (!e.efektif || e.k.pribadi) return;
      const lv = e.pct >= 1 ? 100 : e.pct >= 0.8 ? 80 : 0, key = e.k.id + '|' + p.key;
      if (tingkat[key] === undefined) { tingkat[key] = lv; return; }          // pertama kali: catat tingkat awal saja
      if (lv > tingkat[key]) pesan.push({ ke: 'semua', kunci: 'amp|' + key + '|' + lv, teks: (lv === 100 ? '🚨 Amplop <b>' : '⚠️ Amplop <b>') + U.esc(e.k.nama) + '</b> sudah terpakai ' + Math.round(e.pct * 100) + '% (' + U.rp(e.terpakai) + ' dari ' + U.rp(e.efektif) + ').' + (lv === 100 ? ' Sisa periode: ' + Calc.daysLeft(p) + ' hari.' : '') });
      tingkat[key] = lv;
    });
    kirim(pesan);
  };
  /** Kirim target alert emas ke relay bila berubah (relay yang memeriksa setiap harga baru). */
  App.syncAlertEmas = () => {
    if (!relayOk() || Store.mode !== 'live') return;
    const v = notifSet().emas ? Store.setting('hargaAlert', '{}') : '{}', k = 'sa:tgAlert:' + Store.fileId;
    if (localStorage.getItem(k) === v) return;
    let a = {}; try { a = JSON.parse(v) || {}; } catch (e) {}
    Relay.call('tg.alert', { fileId: Store.fileId, jual: a.jual || 0, beli: a.beli || 0 }).then(r => { if (r.success) localStorage.setItem(k, v); }).catch(() => {});
  };
  /** Insight mingguan AI → Telegram pemiliknya (kunci per minggu). */
  App.kirimInsight = (o) => { if (o && adaTelegram() && notifSet().insight) kirim([{ ke: Store.me.email, kunci: 'insight|' + o.minggu + '|' + Store.me.email, teks: '✨ <b>Insight minggu ini</b>\n' + U.esc(o.teks) }]); };
})();
