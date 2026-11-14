/* Telegram @SatuAtapBot, WhatsApp (Fonnte keluarga), Kotak catatan dari chat, pengingat dari aplikasi */
(function () {
  const I = UI.icon, App = window.App = window.App || {};
  const N = { info: null, infoAt: 0, kotakAt: 0 };
  const lsKotak = () => 'sa:kotak:' + ((Store.me && Store.me.email) || '');
  const bacaKotak = () => { try { return JSON.parse(localStorage.getItem(lsKotak()) || '[]'); } catch (e) { return []; } };
  const tulisKotak = a => { try { localStorage.setItem(lsKotak(), JSON.stringify(a.slice(-100))); } catch (e) {} };
  const relayOk = () => Store.mode === 'demo' || (Store.mode === 'live' && Relay.enabled() && Store.fileId);

  /** Jenis pengingat Telegram yang aktif untuk keluarga (pengaturan bersama). */
  UI.NOTIF_JENIS = [['tagihan', 'Tagihan & cicilan (H-7, H-3, H-1, hari H)'], ['amplop', 'Amplop anggaran terpakai 80% & 100%'], ['emas', 'Alert harga emas'], ['rapat', 'Rapat keuangan'], ['insight', 'Insight mingguan AI (untuk yang memakai AI)']];
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
        <p class="small">Pakai akun <b>Fonnte milik keluarga</b> (paket gratis tersedia di fonnte.com) lewat Skrip Pendamping: pengingat yang sama ke WA dan catat lewat chat WA. Token Fonnte disimpan di Script Properties Pendamping Anda — tidak di aplikasi, tidak di JuniorLabs.</p>
        <p class="muted small">Butuh Skrip Pendamping terpasang dulu (± 10 menit, sekali saja).</p>
        <div class="row-btns"><button class="btn sm" data-act="panduan" data-k="pend">${I('book-open')} Pasang Pendamping</button><button class="btn ghost sm" data-act="panduan" data-k="wa">${I('message-circle')} Pasang WhatsApp</button></div></div>`;
  };
  UI.pendampingKartu = () => `<div class="row-btns"><button class="btn sm" data-act="panduan" data-k="pend">${I('book-open')} Panduan pasang langkah demi langkah</button></div>
    ${Store.mode === 'live' ? `<div class="kv-list"><div class="kv"><span>ID file keluarga</span><b><code class="wrap">${U.esc(Store.fileId)}</code></b></div></div>` : ''}`;

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
  const PANDUAN = {
    pend: { judul: 'Pasang Skrip Pendamping', langkah: () => [
      T('Apa ini & siapkan', `<p>Skrip Pendamping berjalan di akun Google <b>Anda sendiri</b>, setiap pagi ± pukul 08.00, walau aplikasi tidak dibuka:</p>
        <ul class="ul"><li>mengisi Google Calendar <b>"Keuangan …"</b> dengan jadwal tagihan & cicilan,</li><li>mengirim pengingat H-7, H-3, H-1, hari H ke Telegram (dan WhatsApp bila dipasang).</li></ul>
        <div class="note small">${I('monitor')} <span>Paling mudah di <b>laptop/komputer</b>. Di HP bisa, buka Chrome › ⋮ › centang <b>Situs desktop</b>.</span></div>
        <div class="note small">${I('user')} <span>Masuk Google dengan akun <b>${U.esc(admin())}</b> (Admin keluarga / pemilik file data).</span></div>`),
      T('Buat proyek baru', `<ol class="steps"><li>Ketuk tombol di bawah — terbuka <b>script.google.com</b> dengan proyek kosong.</li><li>Klik judul <b>"Proyek tanpa judul"</b> di kiri atas › ganti menjadi <code>SatuAtap Pendamping</code> › <b>Ganti nama</b>.</li></ol>
        <div class="row-btns">${link('https://script.google.com/home/projects/create', 'Buka script.google.com')}</div>`),
      T('Tampilkan file manifes', `<ol class="steps"><li>Di kiri, klik ikon <b>⚙️ Setelan Proyek</b> (gerigi, paling bawah).</li><li>Centang <b>"Tampilkan file manifes 'appsscript.json' di editor"</b>.</li><li>Klik ikon <b>&lt;&gt; Editor</b> di kiri untuk kembali. Sekarang ada dua file: <code>appsscript.json</code> dan <code>Kode.gs</code>.</li></ol>`),
      T('Tempel appsscript.json', `<ol class="steps"><li>Ketuk <b>Salin appsscript.json</b> di bawah.</li><li>Di editor, klik file <b>appsscript.json</b> › tekan <kbd>Ctrl</kbd>+<kbd>A</kbd> (pilih semua) › hapus › <b>tempel</b> (<kbd>Ctrl</kbd>+<kbd>V</kbd>).</li><li>Simpan: ikon 💾 atau <kbd>Ctrl</kbd>+<kbd>S</kbd>.</li></ol>
        <p class="muted small">File ini berisi daftar izin yang dibutuhkan skrip (baca file data, kalender, kirim pengingat).</p><div class="row-btns">${btn('json', 'copy', 'Salin appsscript.json', '')}</div>`),
      T('Tempel kode Pendamping', `<ol class="steps"><li>Ketuk <b>Salin kode Pendamping</b>. Kode ini <b>sudah berisi</b> ID file keluarga & alamat relay Anda — tidak perlu diubah apa pun.</li><li>Klik file <b>Kode.gs</b> › <kbd>Ctrl</kbd>+<kbd>A</kbd> › hapus › tempel › simpan 💾.</li></ol>
        ${Store.mode !== 'live' ? '<div class="note warn small">Mode demo: ID file belum terisi. Lakukan dari akun keluarga sungguhan.</div>' : ''}<div class="row-btns">${btn('kode', 'copy', 'Salin kode Pendamping', '')}</div>`),
      T('Jalankan & beri izin', `<ol class="steps"><li>Di toolbar atas, pada kotak pilihan fungsi pilih <b>setupPendamping</b> › klik <b>▶ Jalankan</b>.</li><li>Muncul <b>"Otorisasi diperlukan"</b> › <b>Tinjau izin</b> › pilih akun ${U.esc(admin())}.</li>
          <li>Muncul <b>"Google belum memverifikasi aplikasi ini"</b> › klik <b>Lanjutan</b> (kecil, kiri bawah) › <b>Buka SatuAtap Pendamping (tidak aman)</b> › <b>Izinkan</b>.</li></ol>
        <div class="note small">${I('shield-check')} <span>Peringatan itu wajar: skrip ini Anda pasang sendiri di akun Anda, jadi Google tidak memeriksanya. Skrip hanya <b>membaca</b> file data SatuAtap dan menulis ke kalender Anda.</span></div>`),
      T('Selesai — cek hasilnya', `<p>Di bawah editor muncul <b>Log eksekusi</b>. Berhasil bila ada baris <b>"✅ Pendamping aktif untuk …"</b>.</p>
        <ul class="ul"><li>Buka Google Calendar — ada kalender <b>Keuangan …</b> berisi jadwal tagihan.</li><li>Pengingat Telegram terkirim tiap pagi ke anggota yang sudah <b>Hubungkan Telegram</b>.</li><li>Agar pasangan melihat kalender yang sama: Google Calendar › kalender <b>Keuangan …</b> › ⋮ › <b>Setelan & berbagi</b> › › tambahkan email pasangan.</li></ul>
        <div class="note small">${I('triangle-alert')} <span>Ada tulisan merah? Foto layar log-nya dan kirim ke JuniorLabs. Untuk berhenti: pilih fungsi <b>hentikanPendamping</b> › Jalankan.</span></div>
        <div class="row-btns"><button type="button" class="btn sm" data-pa="ke-wa">${I('message-circle')} Lanjut pasang WhatsApp</button></div>`)
    ] },
    wa: { judul: 'Pasang WhatsApp (Fonnte)', langkah: () => [
      T('Sebelum mulai', `<p>Dengan WhatsApp, pengingat tagihan juga masuk WA, dan anggota bisa <b>mencatat lewat chat WA</b> ("makan siang 45rb gopay").</p>
        <ul class="ul"><li><b>Skrip Pendamping sudah terpasang</b> (panduan sebelumnya).</li><li><b>Satu nomor WhatsApp pengirim</b> — nomor inilah yang mengirim pengingat & menerima catatan. Sebaiknya nomor kedua/khusus (WA Business boleh), bukan nomor yang dipakai mencatat.</li><li>Akun <b>Fonnte</b> (gratis) — layanan pengirim WA. Token Fonnte hanya disimpan di skrip Anda, tidak di aplikasi & tidak di JuniorLabs.</li></ul>
        <div class="row-btns"><button type="button" class="btn ghost sm" data-pa="ke-pend">${I('book-open')} Belum pasang Pendamping</button></div>`),
      T('Daftar & sambungkan Fonnte', `<ol class="steps"><li>Buka <b>fonnte.com</b> › <b>Register</b> › isi data & verifikasi › <b>Login</b>.</li><li>Menu <b>Device</b> › <b>Add device</b>: nama <code>SatuAtap</code>, nomor = <b>nomor WA pengirim</b> › Save.</li>
          <li>Di baris device itu klik <b>Connect</b> › muncul QR. Di HP pemilik nomor pengirim: WhatsApp › ⋮ › <b>Perangkat tertaut</b> › › <b>Tautkan perangkat</b> › › scan QR.</li><li>Status device berubah menjadi <b>connect</b>.</li></ol>
        <div class="row-btns">${link('https://md.fonnte.com/new/register.php', 'Buka fonnte.com')}</div>`),
      T('Salin token Fonnte', `<ol class="steps"><li>Di fonnte.com › menu <b>Device</b> › pada baris device klik <b>Token</b> (atau ikon kunci).</li><li>Salin token itu, simpan sebentar (mis. di catatan HP). <b>Jangan bagikan ke siapa pun</b> — siapa pun yang punya token bisa mengirim WA atas nomor Anda.</li></ol>`),
      T('Nomor WA anggota', `<p>Isi nomor WhatsApp <b>tiap anggota</b> (nomor yang akan menerima pengingat & mengirim catatan). Boleh diawali 08…</p>
        <div class="wa-no">${Store.members().map(m => `<label class="field"><span>${U.esc(m.nama)} <small class="muted">${U.esc(m.email)}</small></span><input inputmode="tel" data-wa="${U.esc(m.email)}" value="${U.esc(bacaNo()[m.email] || '')}" placeholder="08xxxxxxxxxx"></label>`).join('')}</div>
        <div class="kv-list"><div class="kv"><span>Nilai WA_ANGGOTA</span><b><code class="wrap" data-wa-out>${U.esc(waAnggota() || '—')}</code></b></div></div>
        <div class="row-btns">${btn('wa-anggota', 'copy', 'Salin nilai WA_ANGGOTA', '')}</div>`),
      T('Isi Properti skrip', `<p>Kembali ke editor <b>SatuAtap Pendamping</b> di script.google.com.</p>
        <ol class="steps"><li>Klik <b>⚙️ Setelan Proyek</b> › gulir ke bawah ke <b>Properti skrip</b> › <b>Tambahkan properti skrip</b>.</li>
          <li>Baris 1 — Properti: <code>FONNTE_TOKEN</code> · Nilai: <b>token Fonnte</b> (langkah 3).</li><li>Klik <b>Tambahkan properti skrip</b> lagi. Baris 2 — Properti: <code>WA_ANGGOTA</code> · Nilai: <b>tempel</b> nilai dari langkah 4.</li><li>Klik <b>Simpan properti skrip</b>.</li></ol>
        <div class="note small">${I('lock')} <span>Ketik nama properti persis huruf besar seperti di atas. Token disimpan di sini — bukan di kode — agar aman.</span></div>`),
      T('Jalankan setupWA', `<ol class="steps"><li>Klik <b>&lt;&gt; Editor</b> › kotak pilihan fungsi pilih <b>setupWA</b> › <b>▶ Jalankan</b>.</li><li>Bila diminta izin, ulangi seperti sebelumnya (Tinjau izin › Lanjutan › Izinkan).</li><li>Setiap anggota menerima WA: <b>"✅ SatuAtap tersambung ke WhatsApp keluarga ini."</b></li></ol>
        <p class="muted small">Sampai di sini <b>pengingat WA sudah aktif</b>. Langkah berikutnya hanya untuk <b>mencatat lewat chat WA</b>.</p>`),
      T('Terapkan sebagai Aplikasi web', `<ol class="steps"><li>Kanan atas klik <b>Terapkan</b> › <b>Deployment baru</b>.</li><li>Klik ikon ⚙️ di samping "Pilih jenis" › <b>Aplikasi web</b>.</li><li>Jalankan sebagai: <b>Saya</b> · Yang memiliki akses: <b>Siapa saja</b> › <b>Terapkan</b> (izinkan bila diminta).</li><li>Klik <b>Selesai</b>.</li></ol>
        <div class="note small">${I('info')} <span>"Siapa saja" diperlukan agar Fonnte bisa meneruskan pesan WA. Skrip menolak pesan yang tidak membawa kunci rahasia Anda.</span></div>`),
      T('Pasang webhook di Fonnte', `<ol class="steps"><li>Di editor pilih fungsi <b>cekWA</b> › <b>▶ Jalankan</b>.</li><li>Log menampilkan status token & perangkat, lalu <b>alamat webhook</b> (berakhiran <code>?k=…</code>). Salin seluruh baris alamat itu.</li>
          <li>Di fonnte.com › <b>Device</b> › <b>Edit</b> pada device › kolom <b>Webhook</b> › tempel › <b>Update</b>.</li></ol>
        <div class="note small">${I('triangle-alert')} <span>Bila kolom Webhook tidak tersedia di paket Fonnte Anda, catat lewat WA belum bisa — pengingat WA tetap berjalan.</span></div>`),
      T('Uji coba', `<ol class="steps"><li>Dari nomor salah satu anggota, kirim WA ke <b>nomor pengirim</b>: <code>makan siang 45rb gopay</code>.</li><li>Balasan: <b>"📝 Diterima: Rp 45.000 …"</b>.</li><li>Buka aplikasi › <b>Mutasi</b> › <b>Menunggu konfirmasi</b> › geser kanan untuk menyimpan.</li></ol>
        <div class="note small">${I('circle-help')} <span>Tidak ada balasan? Jalankan <b>cekWA</b> lagi dan pastikan semua baris ✅, nomor pengirim berstatus <b>connect</b> di Fonnte, dan nomor anggota di WA_ANGGOTA benar.</span></div>`)
    ] }
  };
  UI.act('panduan', el => UI.panduan(el.dataset.k));
  UI.panduan = (k) => {
    const P = PANDUAN[k]; if (!P) return; muatPend();
    const L = P.langkah(), kunci = 'sa:pand:' + k; let i = Math.min(L.length - 1, Number(localStorage.getItem(kunci) || 0) || 0);
    const s = UI.sheet({ title: P.judul, body: '<div class="pand"></div>', foot: `<button class="btn ghost" data-n="-1">${I('chevron-left')} Kembali</button><button class="btn" data-n="1">Lanjut ${I('chevron-right')}</button>` });
    const box = s.el.querySelector('.pand'), bK = s.el.querySelector('[data-n="-1"]'), bL = s.el.querySelector('[data-n="1"]');
    const gambar = () => {
      try { localStorage.setItem(kunci, String(i)); } catch (e) {}
      box.innerHTML = `<div class="pand-dots">${L.map((_, j) => `<button type="button" class="${j === i ? 'on' : j < i ? 'ok' : ''}" data-ke="${j}" aria-label="Langkah ${j + 1}">${j < i ? I('check') : j + 1}</button>`).join('')}</div>
        <div class="pand-step"><small class="muted">Langkah ${i + 1} dari ${L.length}</small><h3>${L[i].judul}</h3>${L[i].isi}</div>`;
      bK.disabled = i === 0; bL.innerHTML = i === L.length - 1 ? I('check') + ' Selesai' : 'Lanjut ' + I('chevron-right');
      const sc = s.el.querySelector('.sheet-body') || box.parentElement; if (sc) sc.scrollTop = 0;
    };
    s.el.addEventListener('click', e => {
      const d = e.target.closest('[data-ke]'); if (d) { i = +d.dataset.ke; return gambar(); }
      const n = e.target.closest('[data-n]'); if (n) { if (+n.dataset.n > 0 && i === L.length - 1) { try { localStorage.removeItem(kunci); } catch (x) {} s.close(); return UI.toast('Mantap! Panduan bisa dibuka lagi kapan saja.'); } i = Math.max(0, Math.min(L.length - 1, i + +n.dataset.n)); return gambar(); }
      const a = e.target.closest('[data-pa]'); if (!a) return;
      const act = a.dataset.pa;
      if (act === 'kode') salin(kodeTerisi(), 'Kode Pendamping');
      else if (act === 'json') salin(PEND.json, 'appsscript.json');
      else if (act === 'wa-anggota') { const v = waAnggota(); if (!v) return UI.toast('Isi minimal satu nomor yang benar.', 'warn'); salin(v, 'WA_ANGGOTA'); }
      else if (act === 'ke-wa' || act === 'ke-pend') { s.close(); setTimeout(() => UI.panduan(act === 'ke-wa' ? 'wa' : 'pend'), 250); }
    });
    s.el.addEventListener('input', e => { const w = e.target.dataset && e.target.dataset.wa; if (!w) return; const o = bacaNo(); o[w] = e.target.value; simpanNo(o); const out = s.el.querySelector('[data-wa-out]'); if (out) out.textContent = waAnggota() || '—'; e.target.classList.toggle('bad', !!e.target.value && !noWA(e.target.value)); });
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
    catatan: r.catatan || x.teks, dibayarOleh: Store.me.email, tag: '', sumber: x.sumber || 'telegram', refId: '', periodeRef: '', dicatatOleh: Store.me.email, dibuat: new Date().toISOString(), riwayat: [] } });
  const ringkas = r => [r.catatan, U.rp(r.jumlah), K(r.kategoriId), W(r.walletId)].filter(Boolean).join(' · ');
  const selesai = (ids, info) => { if (ids.length && relayOk()) Relay.call('tg.selesai', { fileId: Store.fileId, ids, info: info || {} }).catch(() => {}); };
  const hapus = ids => tulisKotak(bacaKotak().filter(x => ids.indexOf(x.id) < 0));
  UI.kotakList = () => bacaKotak().filter(x => !Store.byId.Transaksi[txId(x)]);
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
      const baru = a.filter(x => !lama.some(y => y.id === x.id));
      tulisKotak(a);
      if (baru.length) UI.toast(baru.length === 1 ? 'Draf dari chat: ' + baru[0].teks.slice(0, 40) + ' — konfirmasi di Mutasi.' : baru.length + ' draf dari chat menunggu konfirmasi.', 'ok', { ms: 4500 });
      if (JSON.stringify(a.map(x => x.id)) !== JSON.stringify(lama.map(x => x.id)) && (UI.cur === 'beranda' || UI.cur === 'mutasi')) UI.render();
    } catch (e) {} finally { N.kotakJalan = false; }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && window.App && App.ready) App.ambilKotak().catch(() => {}); });
  /** Dipanggil saat Beranda/Mutasi digambar: ambil draf baru di latar (dibatasi 1×/menit). */
  UI.kotakAlert = () => { if (App.ready) setTimeout(() => App.ambilKotak().catch(() => {}), 300); return ''; };
  /** Baris draf chat — tampil bersama draf tagihan rutin di "Menunggu konfirmasi". */
  UI.kotakRow = x => { const r = Voice.parse(x.teks), ok = lengkap(r), k = Store.byId.Kategori[r.kategoriId];
    return `<div class="swipe" data-kotak="${U.esc(x.id)}" ${ok ? 'data-draft="1"' : ''}>
      <div class="sw-l">${I('check')} Simpan</div><div class="sw-r"><button class="danger" data-act="kotak-buang" data-id="${U.esc(x.id)}">${I('trash-2')}<span>Buang</span></button></div>
      <div class="sw-main tx draft" data-act="kotak-ubah" data-id="${U.esc(x.id)}">
        <span class="cat-ic chat">${I(k ? k.ikon || 'tag' : (x.sumber === 'wa' ? 'message-circle' : 'send'))}</span>
        <div class="tx-txt"><b>${U.esc(r.catatan || x.teks)}</b><small>${x.sumber === 'wa' ? 'WhatsApp' : 'Telegram'} · ${U.timeAgo(x.waktu)} · ${ok ? U.esc(K(r.kategoriId) + ' · ' + W(r.walletId)) : `<span class="vq-need">${!r.jumlah ? 'isi nominal' : !r.kategoriId ? 'pilih kategori' : 'pilih dompet'}</span>`}</small></div>
        <div class="tx-amt">${r.jumlah ? UI.amount(r.jumlah, r.jenis) : '<b class="muted">Rp ?</b>'}<small>draf</small></div>
        <button class="kebab" data-act="kotak-ubah" data-id="${U.esc(x.id)}" aria-label="Periksa">${I('ellipsis-vertical')}</button>
      </div></div>`; };
  UI.kotakSimpan = async (id) => {
    const x = bacaKotak().find(z => z.id === id); if (!x) return;
    const r = Voice.parse(x.teks); if (!lengkap(r)) return UI.acts['kotak-ubah']({ dataset: { id } });
    if (!(await UI.commitPriv([rowOf(x, r)]))) return;
    hapus([id]); selesai([id], { [id]: ringkas(r) });
    UI.toast('Tersimpan · ' + ringkas(r), 'ok', { undo: () => Store.commit([{ op: 'delete', t: 'Transaksi', id: txId(x) }]), ms: 4500 });
  };
  UI.act('kotak-ubah', el => {
    const x = bacaKotak().find(z => z.id === el.dataset.id); if (!x) return; const r = Voice.parse(x.teks);
    UI.catat({ preset: { jenis: r.jenis, jumlah: r.jumlah, kategoriId: r.kategoriId, walletId: r.walletId, catatan: r.catatan || x.teks, tanggal: String(x.waktu || '').slice(0, 10), sumber: x.sumber || 'telegram' },
      onSaved: (ops) => { const t = (ops || []).map(o => o.row).find(Boolean) || r; if (t.kategoriId && t.kategoriId !== r.kategoriId) Voice.ajari(x.teks, t.kategoriId); hapus([x.id]); selesai([x.id], { [x.id]: ringkas(Object.assign({}, r, t)) }); } });
  });
  UI.act('kotak-buang', async el => {
    const x = bacaKotak().find(z => z.id === el.dataset.id); if (!x) return;
    if (!(await UI.confirm('Buang draf ini?', '“' + x.teks + '” tidak akan dicatat.', 'Buang', true))) return;
    hapus([x.id]); selesai([x.id]); UI.render();
  });

  // ---------- Pengingat yang dikirim dari aplikasi (melengkapi Skrip Pendamping) ----------
  const adaTelegram = () => { const inf = infoCache(); return inf && inf.aktif && (inf.terhubung || []).length; };
  const kirim = (pesan) => pesan.length && relayOk() && Store.mode === 'live' ? Relay.call('tg.kirim', { fileId: Store.fileId, pesan }).catch(() => {}) : null;
  /** Dipanggil setelah sinkron: tagihan H-7/H-3/H-1/H & rapat (kunci sama dengan Pendamping → tidak dobel). Sekali per jam per perangkat. */
  App.notifTagihan = () => {
    if (!adaTelegram()) return;
    const k = 'sa:tgNotif:' + Store.fileId, last = Number(localStorage.getItem(k) || 0);
    if (Date.now() - last < 3600e3 || new Date().getHours() < 7) return;
    localStorage.setItem(k, String(Date.now()));
    const o = notifSet(), pesan = [], today = U.today();
    if (o.tagihan) Calc.occurrences(today, U.addDays(today, 7)).forEach(x => {
      if (x.arah !== 'keluar' || x.lunas || x.kind === 'rapat' || x.kind === 'tujuan') return;
      const h = U.diffDays(today, x.tanggal); if ([7, 3, 1, 0].indexOf(h) < 0) return;
      const occ = x.kind === 'acara' ? 'a|' + x.ref.id : x.id;
      pesan.push({ ke: 'semua', kunci: 'occ|' + occ + '|H-' + h, teks: (h <= 1 ? '🔔 ' : '🗓️ ') + U.esc(x.nama) + ' · <b>' + U.rp(x.sisa) + '</b> jatuh tempo ' + (h === 0 ? '<b>hari ini</b>' : h === 1 ? '<b>besok</b>' : h + ' hari lagi (' + U.tgl(x.tanggal, 'dm') + ')') + '.' });
    });
    if (o.rapat) { const st = Calc.rapatStatus(); if (!st.sudahBulanIni && (st.sisa === 0 || st.sisa === 1)) pesan.push({ ke: 'semua', kunci: 'rapat|' + st.next.slice(0, 7) + '|H-' + st.sisa, teks: '👥 Rapat keuangan keluarga ' + (st.sisa === 0 ? '<b>hari ini</b>' : '<b>besok</b>') + '. Agendanya sudah disusun otomatis di aplikasi.' }); }
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
