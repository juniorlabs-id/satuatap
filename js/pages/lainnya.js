/* Lainnya, Pengaturan (keluarga, anggota & izin, kategori, template, tampilan, notifikasi, keamanan, data), Laporkan Masalah */
(function () {
  const I = UI.icon;
  const MENU_IZIN = [['mutasi', 'Mutasi'], ['kalender', 'Kalender'], ['anggaran', 'Anggaran'], ['tujuan', 'Tujuan'], ['utang', 'Utang & Piutang'], ['aset', 'Aset'], ['rapor', 'Rapor']];
  const PERAN = { admin: 'Admin', pasangan: 'Pasangan (akses penuh)', anggota: 'Anggota (izin per menu)' };
  const WARNA = ['#0F5E59', '#F2B33D', '#476364', '#B3261E', '#6750A4', '#2E7D32', '#0061A4', '#8C5A00'];

  UI.page('lainnya', {
    render() {
      const adm = Store.isAdminLike();
      return `
        <div class="me-card"><span class="avatar lg" style="background:${Store.me.warna || '#0F5E59'}">${U.esc(U.initials(Store.me.nama))}</span><div><b>${U.esc(Store.me.nama)}</b><small>${U.esc(Store.me.email)} · ${U.esc(PERAN[Store.me.peran] || Store.me.peran)}</small></div></div>
        ${App.isSuper ? `${UI.sec('JuniorLabs')}${UI.tiles([
          { id: 'konsol', icon: 'shield-check', label: 'Konsol Lisensi', to: 'konsol', gold: true },
          { id: 'kbuat', icon: 'key-round', label: 'Buat Kode', to: 'konsol/buat', gold: true },
          { id: 'klap', icon: 'inbox', label: 'Laporan Masuk', to: 'konsol/laporan', gold: true },
          { id: 'kstat', icon: 'chart-column', label: 'Statistik', to: 'konsol/statistik', gold: true }
        ])}` : ''}
        ${UI.sec('Keuangan')}${UI.tiles([
          { id: 'ang', icon: 'clipboard-list', label: 'Anggaran', to: 'anggaran' },
          { id: 'tuj', icon: 'target', label: 'Tujuan', to: 'tujuan' },
          { id: 'utg', icon: 'scale', label: 'Utang & Piutang', to: 'utang' },
          { id: 'tag', icon: 'receipt', label: 'Tagihan', to: 'kalender/tagihan' },
          { id: 'zak', icon: 'hand-heart', label: 'Zakat & Sedekah', to: 'zakat', gold: true },
          { id: 'emas', icon: 'gem', label: 'Brankas Emas', to: 'emas', gold: true },
          { id: 'kpr', icon: 'house', label: 'Simulasi KPR', to: 'utang/kpr' },
          { id: 'sim', icon: 'git-fork', label: 'Simulasi Keputusan', to: 'simulasi' }
        ])}
        ${UI.sec('Keluarga & cerdas')}${UI.tiles([
          { id: 'rapat', icon: 'users', label: 'Rapat Keuangan', to: 'rapat' },
          { id: 'ai', icon: 'sparkles', label: 'Tanya AI', to: 'ai' },
          { id: 'kilas', icon: 'history', label: 'Kilas Balik', to: 'kilas' },
          { id: 'impor', icon: 'file-up', label: 'Impor CSV', to: 'impor' }
        ])}
        ${UI.sec('Pengaturan')}${UI.tiles([
          { id: 'kel', icon: 'heart-handshake', label: 'Keluarga', to: 'pengaturan/keluarga' },
          { id: 'agt', icon: 'user-cog', label: 'Anggota & Izin', to: 'pengaturan/anggota' },
          { id: 'kat', icon: 'tags', label: 'Kategori', to: 'pengaturan/kategori' },
          { id: 'tpl', icon: 'zap', label: 'Template Cepat', to: 'pengaturan/template' },
          { id: 'tam', icon: 'palette', label: 'Tampilan', to: 'pengaturan/tampilan' },
          { id: 'not', icon: 'bell', label: 'Notifikasi', to: 'pengaturan/notif' },
          { id: 'kea', icon: 'shield-check', label: 'Keamanan', to: 'pengaturan/keamanan' },
          { id: 'dat', icon: 'database', label: 'Data & Sinkron', to: 'pengaturan/data' }
        ])}
        ${UI.sec('Bantuan')}${UI.tiles([
          { id: 'lap', icon: 'message-square-warning', label: 'Laporkan Masalah', to: 'laporan' },
          { id: 'ide', icon: 'lightbulb', label: 'Usul Fitur', to: 'laporan/ide' },
          { id: 'wa', icon: 'message-circle', label: 'Chat Dukungan', act: 'wa-support' },
          { id: 'ttg', icon: 'info', label: 'Tentang', to: 'pengaturan/tentang' }
        ])}
        <button class="btn block ghost danger" data-act="logout">${I('log-out')} Keluar dari perangkat ini</button>
        ${!adm ? '<p class="muted small center">Beberapa pengaturan hanya bisa diubah Admin / Pasangan.</p>' : ''}
        <div class="spacer"></div>`;
    }
  });
  UI.act('wa-support', () => window.open('https://wa.me/' + APP_CONFIG.SUPPORT_WA + '?text=' + encodeURIComponent('Halo JuniorLabs, saya pengguna SatuAtap (' + Store.setting('namaKeluarga', '') + '). '), '_blank', 'noopener'));
  UI.act('logout', async () => { if (await UI.confirm('Keluar?', 'Data di perangkat ini dihapus. Data keluarga tetap aman di Google Sheets.', 'Keluar', true)) App.logout(); });

  // ---------- Pengaturan ----------
  const SUB = { keluarga: 'Keluarga', anggota: 'Anggota & Izin', kategori: 'Kategori', template: 'Template Cepat', tampilan: 'Tampilan', notif: 'Notifikasi', keamanan: 'Keamanan', data: 'Data & Sinkron', tentang: 'Tentang SatuAtap' };
  UI.page('pengaturan', {
    head: p => ({ title: SUB[p] || 'Pengaturan', crumb: p ? 'Pengaturan' : 'Lainnya', back: 'lainnya' }),
    nav: () => 'lainnya',
    render(p) {
      const fn = { keluarga, anggota, kategori, template, tampilan, notif, keamanan, data, tentang }[p];
      if (fn) return fn();
      return `<div class="me-card"><span class="avatar lg" style="background:${Store.me.warna || '#0F5E59'}">${U.esc(U.initials(Store.me.nama))}</span><div><b>${U.esc(Store.me.nama)}</b><small>${U.esc(Store.me.email)}</small></div></div>
        <div class="card list">${Object.keys(SUB).map(k => `<a class="row" href="#/pengaturan/${k}"><div class="tx-txt"><b>${SUB[k]}</b></div>${I('chevron-right')}</a>`).join('')}</div>
        <button class="btn block ghost danger" data-act="logout">${I('log-out')} Keluar</button><div class="spacer"></div>`;
    }
  });
  const needAdmin = () => Store.isAdminLike() ? '' : `<div class="note warn">${I('lock')} Hanya Admin / Pasangan yang bisa mengubah bagian ini.</div>`;

  function keluarga() {
    const dis = Store.isAdminLike() ? '' : 'disabled';
    return `${needAdmin()}<div class="card" id="f-kel">
      ${UI.field('Nama keluarga', `<input name="namaKeluarga" maxlength="40" value="${U.esc(Store.setting('namaKeluarga', ''))}" ${dis}>`)}
      ${UI.field('Periode anggaran dimulai tanggal', `<select name="periodeMulai" ${dis}>${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}" ${Number(Store.setting('periodeMulai', 1)) === i + 1 ? 'selected' : ''}>${i + 1}${i === 0 ? ' (awal bulan)' : ''}</option>`).join('')}</select>`, 'Contoh: gajian tanggal 25 → pilih 25 agar periode 25–24.')}
      ${UI.field('Target dana darurat', `<select name="danaDaruratBulan" ${dis}>${[3, 6, 9, 12].map(n => `<option value="${n}" ${Number(Store.setting('danaDaruratBulan', 6)) === n ? 'selected' : ''}>${n} bulan pengeluaran</option>`).join('')}</select>`, 'Saran: 6 bulan untuk keluarga dengan anak; 9–12 bila pemasukan tidak tetap.')}
      ${Store.isAdminLike() ? `<button class="btn" data-act="save-kel">Simpan</button>` : ''}</div>`;
  }
  UI.act('save-kel', () => {
    const f = UI.formData(document.getElementById('f-kel'));
    Store.commit(Object.keys(f).map(k => ({ op: 'upsert', t: 'Pengaturan', row: { id: k, nilai: f[k] } })));
    UI.toast('Pengaturan keluarga disimpan.');
  });

  // ---------- Anggota & izin ----------
  function anggota() {
    const ms = Store.t.Anggota.slice().sort((a, b) => (a.peran === 'admin' ? -1 : 0) - (b.peran === 'admin' ? -1 : 0));
    return `${needAdmin()}
      <div class="note">${I('info')} Maksimal 5 akun per keluarga. Anggota masuk memakai akun Google dengan email yang didaftarkan di sini.</div>
      <div class="card list">${ms.map(m => `<div class="row" ${Store.me.peran === 'admin' ? `data-act="member-edit" data-id="${m.id}"` : ''}><span class="avatar xs" style="background:${m.warna || '#5b7a78'}">${U.esc(U.initials(m.nama))}</span>
        <div class="tx-txt"><b>${U.esc(m.nama)} ${m.aktif === false ? UI.pill('Nonaktif', '') : ''}</b><small>${U.esc(m.email)} · ${U.esc(PERAN[m.peran] || m.peran)}</small></div>${I('chevron-right')}</div>`).join('')}</div>
      ${Store.me.peran === 'admin' && Store.t.Anggota.filter(m => m.aktif !== false).length < 5 ? `<button class="btn block" data-act="member-add">${I('user-plus')} Undang anggota</button>` : ''}
      <div class="card"><b>Cara anggota bergabung</b><ol class="steps small"><li>Admin menambahkan email di sini — Google Drive otomatis membagikan file keluarga & mengirim email undangan.</li><li>Anggota membuka aplikasi, <b>Masuk dengan Google</b>, lalu pilih <b>Saya diundang</b> dan pilih file "SatuAtap – Data …".</li></ol>
        <div class="row-btns"><button class="btn ghost" data-act="wa-invite">${I('message-circle')} Kirim petunjuk via WA</button></div></div>`;
  }
  UI.memberForm = (m) => {
    const isNew = !m;
    m = m || { id: U.uid('m'), nama: '', email: '', peran: 'anggota', warna: WARNA[Store.t.Anggota.length % WARNA.length], izin: { mutasi: 'ubah', kalender: 'lihat', anggaran: 'lihat', tujuan: 'ubah', utang: 'tidak', aset: 'tidak', rapor: 'lihat' }, aktif: true, dibuat: new Date().toISOString() };
    const iz = m.izin || {};
    const s = UI.sheet({ title: isNew ? 'Undang anggota' : 'Ubah anggota', body: `
      ${UI.field('Nama panggilan', `<input name="nama" maxlength="30" value="${U.esc(m.nama)}">`)}
      ${UI.field('Email Google', `<input name="email" type="email" maxlength="80" value="${U.esc(m.email)}" ${isNew ? '' : 'readonly'} placeholder="nama@gmail.com">`)}
      ${UI.field('Peran', `<select name="peran">${Object.keys(PERAN).map(k => `<option value="${k}" ${m.peran === k ? 'selected' : ''}>${PERAN[k]}</option>`).join('')}</select>`)}
      <div class="icon-pick colors">${WARNA.map(c => `<label><input type="radio" name="warna" value="${c}" ${m.warna === c ? 'checked' : ''}><span style="background:${c}"></span></label>`).join('')}</div>
      <div class="izin" ${m.peran !== 'anggota' ? 'hidden' : ''}><h4 class="mini-h">Izin per menu</h4>${MENU_IZIN.map(x => `<div class="izin-row"><span>${x[1]}</span>${UI.seg('iz_' + x[0], [['tidak', 'Tidak'], ['lihat', 'Lihat'], ['ubah', 'Ubah']], iz[x[0]] || 'tidak')}</div>`).join('')}
        <small class="muted">Anggota selalu bisa mencatat transaksinya sendiri lewat Catat Cepat.</small></div>
      <label class="check"><input type="checkbox" name="aktif" ${m.aktif !== false ? 'checked' : ''}><span>Aktif (bisa masuk)</span></label>`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    s.el.querySelector('[name=peran]').onchange = e => { s.el.querySelector('.izin').hidden = e.target.value !== 'anggota'; };
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el), izin = {};
      MENU_IZIN.forEach(x => { izin[x[0]] = f['iz_' + x[0]] || 'tidak'; delete f['iz_' + x[0]]; });
      f.email = String(f.email || '').toLowerCase().trim();
      if (!f.nama || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return UI.toast('Nama dan email valid wajib diisi.', 'warn');
      if (isNew && Store.t.Anggota.some(x => x.email === f.email)) return UI.toast('Email sudah terdaftar.', 'warn');
      if (!isNew && m.email === Store.me.email && f.peran !== 'admin' && m.peran === 'admin') return UI.toast('Anda tidak bisa menurunkan peran Anda sendiri.', 'warn');
      if (f.aktif && (isNew || m.aktif === false) && Store.members().length >= 5) return UI.toast('Maksimal 5 akun aktif per keluarga.', 'warn');
      Store.upsert('Anggota', Object.assign({}, m, f, { izin }));
      s.close();
      if (Store.mode !== 'live') return UI.toast(isNew ? 'Mode demo: undangan tidak benar-benar dikirim.' : 'Tersimpan.');
      const wasOn = !isNew && m.aktif !== false;
      if (f.aktif && !wasOn) Cloud.share(f.email, Store.me.nama).then(r => UI.toast(r.ok ? 'Undangan terkirim ke ' + f.email + '. Minta ia masuk & pilih "Saya diundang".' : 'Anggota tersimpan, tapi gagal membagikan file: ' + r.message, r.ok ? 'ok' : 'warn', { ms: 6000 }));
      else if (!f.aktif && wasOn) Cloud.unshare(f.email).then(r => UI.toast(r.ok ? 'Akses ' + f.email + ' ke file keluarga dicabut.' : 'Gagal mencabut akses file: ' + r.message, r.ok ? 'ok' : 'warn'));
      else UI.toast('Tersimpan.');
      App.syncMembers && App.syncMembers();
    };
  };
  UI.act('wa-invite', () => window.open('https://wa.me/?text=' + encodeURIComponent('Yuk catat keuangan keluarga bareng di SatuAtap 🏠\n1) Buka ' + location.origin + location.pathname + '\n2) Masuk dengan akun Google kamu\n3) Pilih "Saya diundang" lalu pilih file "SatuAtap – Data ' + Store.setting('namaKeluarga', '') + '"'), '_blank', 'noopener'));
  UI.act('member-add', () => UI.memberForm());
  UI.act('member-edit', el => UI.memberForm(Store.byId.Anggota[el.dataset.id]));

  // ---------- Kategori ----------
  function kategori() {
    const g = { keluar: Store.kategori('keluar', true), masuk: Store.kategori('masuk', true) };
    return `${needAdmin()}${['keluar', 'masuk'].map(j => `${UI.sec(j === 'keluar' ? 'Pengeluaran' : 'Pemasukan', Store.isAdminLike() ? `<button class="link" data-act="kat-add" data-jenis="${j}">${I('plus')} Tambah</button>` : '')}
      <div class="card list">${g[j].map(k => `<div class="row ${k.arsip ? 'muted' : ''}" ${Store.isAdminLike() ? `data-act="kat-edit" data-id="${k.id}"` : ''}><span class="cat-ic sm">${I(k.ikon || 'circle-dot')}</span><div class="tx-txt"><b>${U.esc(k.nama)}</b><small>${k.jenis === 'keluar' ? U.esc(k.kelompok || 'kebutuhan') + (k.batas ? ' · batas ' + U.rpShort(k.batas) : '') + (k.tetap ? ' · tetap' : '') + (k.pribadi ? ' · pribadi ' + U.esc(Store.memberName(k.pribadi)) : '') : 'pemasukan'}${k.arsip ? ' · diarsipkan' : ''}</small></div>${I('chevron-right')}</div>`).join('')}</div>`).join('')}<div class="spacer"></div>`;
  }
  UI.katForm = (k, jenis) => {
    const isNew = !k;
    k = k || { id: U.uid('k'), nama: '', jenis: jenis || 'keluar', kelompok: jenis === 'masuk' ? 'pemasukan' : 'kebutuhan', ikon: 'circle-dot', batas: 0, bawaSisa: false, tetap: false, pribadi: '', urutan: Store.t.Kategori.length, arsip: false };
    const s = UI.sheet({ title: isNew ? 'Kategori baru' : 'Ubah kategori', body: `
      ${UI.field('Nama', `<input name="nama" maxlength="40" value="${U.esc(k.nama)}">`)}
      <div class="icon-pick">${UI.ICON_PILIHAN.map(ic => `<label><input type="radio" name="ikon" value="${ic}" ${k.ikon === ic ? 'checked' : ''}><span>${I(ic)}</span></label>`).join('')}</div>
      ${k.jenis === 'keluar' ? `<div class="grid2">${UI.field('Kelompok', `<select name="kelompok"><option value="kebutuhan" ${k.kelompok !== 'keinginan' ? 'selected' : ''}>Kebutuhan</option><option value="keinginan" ${k.kelompok === 'keinginan' ? 'selected' : ''}>Keinginan</option></select>`)}${UI.field('Batas amplop', UI.rpInput('batas', k.batas))}</div>
        ${UI.field('Uang pribadi milik', `<select name="pribadi"><option value="">— bukan uang pribadi —</option>${Store.members().map(m => `<option value="${m.email}" ${k.pribadi === m.email ? 'selected' : ''}>${U.esc(m.nama)}</option>`).join('')}</select>`, 'Rincian transaksi kategori pribadi hanya terlihat oleh pemiliknya.')}
        <label class="check"><input type="checkbox" name="tetap" ${k.tetap ? 'checked' : ''}><span>Pengeluaran tetap / tagihan</span></label>
        <label class="check"><input type="checkbox" name="bawaSisa" ${k.bawaSisa ? 'checked' : ''}><span>Sisa amplop dibawa ke periode berikutnya</span></label>` : ''}
      <label class="check"><input type="checkbox" name="arsip" ${k.arsip ? 'checked' : ''}><span>Arsipkan (sembunyikan dari pilihan)</span></label>`,
      foot: `<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelector('[data-ok]').onclick = () => { const f = UI.formData(s.el); if (!f.nama) return UI.toast('Nama wajib.', 'warn'); Store.upsert('Kategori', Object.assign({}, k, f)); s.close(); };
  };
  UI.act('kat-add', el => UI.katForm(null, el.dataset.jenis));
  UI.act('kat-edit', el => UI.katForm(Store.byId.Kategori[el.dataset.id]));

  // ---------- Template ----------
  function template() {
    const ts = Store.t.Template.slice().sort((a, b) => a.urutan - b.urutan);
    return `<p class="muted">Template muncul di atas Catat Cepat — sekali ketuk untuk transaksi yang sering berulang (bensin, galon, parkir).</p>
      <div class="card list">${ts.map(t => `<div class="row" data-act="tpl-edit" data-id="${t.id}"><span class="cat-ic sm">${I('zap')}</span><div class="tx-txt"><b>${U.esc(t.nama)}</b><small>${U.esc((Store.byId.Kategori[t.kategoriId] || {}).nama || '')} · ${U.esc((Store.byId.Wallet[t.walletId] || {}).nama || '')}</small></div>${t.jumlah ? UI.amount(t.jumlah, t.jenis) : ''}</div>`).join('') || '<div class="row muted">Belum ada template.</div>'}</div>
      <button class="btn block" data-act="tpl-add">${I('plus')} Template baru</button><div class="spacer"></div>`;
  }
  UI.tplForm = (t) => {
    const isNew = !t;
    t = t || { id: U.uid('tp'), nama: '', jenis: 'keluar', jumlah: 0, kategoriId: '', walletId: '', catatan: '', urutan: Store.t.Template.length };
    const s = UI.sheet({ title: isNew ? 'Template baru' : 'Ubah template', cls: 'small', body: `
      ${UI.field('Nama tombol', `<input name="nama" maxlength="24" value="${U.esc(t.nama)}" placeholder="mis. Bensin motor">`)}
      ${UI.seg('jenis', [['keluar', 'Pengeluaran'], ['masuk', 'Pemasukan']], t.jenis)}
      <div class="grid2">${UI.field('Jumlah (opsional)', UI.rpInput('jumlah', t.jumlah))}${UI.field('Kategori', `<select name="kategoriId">${UI.katOpts(t.jenis, t.kategoriId)}</select>`)}</div>
      ${UI.field('Dompet', `<select name="walletId"><option value="">— terakhir dipakai —</option>${UI.walletOpts(t.walletId)}</select>`)}
      ${UI.field('Catatan', `<input name="catatan" maxlength="80" value="${U.esc(t.catatan)}">`)}`,
      foot: `${isNew ? '' : `<button class="btn ghost danger" data-del>${I('trash-2')}</button>`}<button class="btn" data-ok>Simpan</button>` });
    UI.bindRp(s.el);
    s.el.querySelectorAll('[name=jenis]').forEach(x => x.onchange = () => { s.el.querySelector('[name=kategoriId]').innerHTML = UI.katOpts(x.value, ''); });
    s.el.querySelector('[data-ok]').onclick = () => { const f = UI.formData(s.el); if (!f.nama) return UI.toast('Nama wajib.', 'warn'); Store.upsert('Template', Object.assign({}, t, f)); s.close(); };
    const d = s.el.querySelector('[data-del]'); if (d) d.onclick = () => { Store.remove('Template', t.id); s.close(); };
  };
  UI.act('tpl-add', () => UI.tplForm());
  UI.act('tpl-edit', el => UI.tplForm(Store.byId.Template[el.dataset.id]));

  // ---------- Tampilan ----------
  function tampilan() {
    const th = localStorage.getItem('sa:theme') || 'system';
    return `<div class="card">${UI.field('Tema', UI.seg('theme', [['system', 'Ikuti sistem'], ['light', 'Terang'], ['dark', 'Gelap']], th).replace(/<input /g, '<input data-change="theme" '))}
      <label class="check"><input type="checkbox" data-change="hide-pref" ${UI.hide() ? 'checked' : ''}><span>Sembunyikan nominal saat aplikasi dibuka (mode privasi di tempat umum)</span></label>
      ${UI.field('Bahasa / Language', `<select data-noi18n data-change="lang-set"><option value="id"${(window.I18N && I18N.lang) === 'en' ? '' : ' selected'}>Bahasa Indonesia</option><option value="en"${(window.I18N && I18N.lang) === 'en' ? ' selected' : ''}>English</option></select>`)}</div>
      <div class="note">${I('smartphone')} Pasang ke layar utama: buka menu browser › <b>Tambahkan ke layar utama</b> / <b>Instal aplikasi</b>.</div>`;
  }
  UI.act('theme', el => { localStorage.setItem('sa:theme', el.value); App.applyTheme(); });
  UI.act('hide-pref', el => { localStorage.setItem('sa:hide', el.checked ? '1' : '0'); UI.render(); });

  // ---------- Notifikasi ----------
  function notif() {
    const on = Store.setting('notifEmail', 'true') !== 'false';
    return `<div class="card"><h4 class="mini-h">${I('bell-ring')} Pengingat tagihan</h4>
        <p class="small">Tagihan, cicilan & acara yang jatuh tempo ≤ 3 hari tampil di <b>Beranda</b>, lengkap dengan tombol bayar; jadwal lengkapnya ada di <b>Kalender</b>. Tagihan yang sudah lunas atau ditunda tidak ditampilkan.</p>
</div>
      ${UI.notifKartu ? UI.notifKartu() : ''}
      ${needAdmin()}<div class="card" id="f-not">
      <label class="check"><input type="checkbox" name="notifEmail" ${on ? 'checked' : ''} ${Store.isAdminLike() ? '' : 'disabled'}><span><b>Email ringkasan bulanan</b><br><small class="muted">Laporan (bukan pengingat): pemasukan, pengeluaran, kategori terbesar & tujuan periode lalu untuk Admin & Pasangan — terkirim saat aplikasi pertama kali dibuka di periode baru.</small></span></label>
      ${Store.isAdminLike() ? `<button class="btn" data-act="save-not">Simpan</button>` : ''}</div>
      <div class="card"><h4 class="mini-h">${I('calendar-plus')} Skrip Pendamping <span class="pill">opsional</span></h4>
        <p class="small">Agar pengingat tetap jalan walau aplikasi tidak dibuka: jadwal tagihan di <b>Google Calendar</b>, pengingat <b>Telegram</b> setiap pagi, dan (bila memakai Fonnte) <b>WhatsApp</b>. Dipasang sekali di akun Google Admin — sekitar 5 menit, ikuti Panduan Instalasi Bagian C.</p>
        <p class="muted small">Saat memasang, Google menampilkan layar "aplikasi belum diverifikasi" satu kali karena skrip berjalan di akun Anda sendiri.</p>
        ${UI.pendampingKartu ? UI.pendampingKartu() : ''}</div>`;
  }
  UI.act('save-not', () => { const f = UI.formData(document.getElementById('f-not')); Store.commit(Object.keys(f).map(k => ({ op: 'upsert', t: 'Pengaturan', row: { id: k, nilai: f[k] ? 'true' : 'false' } }))); UI.toast('Disimpan.'); });
  UI.act('copy-fileid', async () => { try { await navigator.clipboard.writeText(Store.fileId); UI.toast('ID file disalin.'); } catch (e) { prompt('Salin ID file:', Store.fileId); } });

  // ---------- Keamanan ----------
  function keamanan() {
    const has = Priv.has(), un = Priv.unlocked();
    return `<div class="card"><h4 class="mini-h">${I('lock')} PIN uang pribadi</h4>
        <p class="muted small">Catatan & tag transaksi di kategori uang pribadi Anda dienkripsi di perangkat. Anggota lain — juga lewat spreadsheet — hanya melihat nominalnya.</p>
        <p class="small">${!has ? 'Belum diatur.' : un ? I('lock-open') + ' Terbuka di perangkat ini.' : I('lock') + ' Terkunci di perangkat ini.'}</p>
        <div class="row-btns">${!has ? `<button class="btn" data-act="pin-set">Atur PIN</button>` : `${un ? `<button class="btn ghost" data-act="pin-lock">Kunci di perangkat ini</button>` : `<button class="btn" data-act="pin-unlock">Buka kunci</button>`}<button class="btn ghost" data-act="pin-change">Ganti PIN</button>`}</div>
        <p class="muted tiny">PIN tidak bisa dipulihkan. Jika lupa, catatan lama tidak dapat dibaca (nominal tetap aman).</p></div>
      <div class="card"><h4 class="mini-h">${I('shield-check')} Akses Google</h4>
        <p class="muted small">SatuAtap hanya memakai izin <b>drive.file</b>: aplikasi hanya bisa membuka file yang ia buat atau yang Anda pilih — tidak bisa melihat file Drive lain.</p>
        ${Store.mode === 'live' ? `<p class="small">Masuk sebagai <b>${U.esc(Auth.email)}</b></p>` : ''}
        <button class="btn ghost danger" data-act="logout">${I('log-out')} Keluar & hapus data dari perangkat ini</button></div>
      <div class="note">${I('info')} Untuk menghentikan akses SatuAtap sepenuhnya: buka myaccount.google.com › Keamanan › Aplikasi pihak ketiga › SatuAtap › Hapus akses.</div>`;
  }
  UI.act('pin-set', async () => { if (await UI.privGuard() === 'enc') { UI.toast('PIN diatur. Catatan uang pribadi baru akan dienkripsi.'); UI.render(); } });
  UI.act('pin-unlock', async () => { if (await UI.privGuard() === 'enc') { UI.toast('Terbuka.'); UI.render(); } });
  UI.act('pin-lock', async () => { await Priv.lock(); UI.toast('Dikunci di perangkat ini.'); UI.render(); });
  UI.act('pin-change', () => {
    const s = UI.sheet({ title: 'Ganti PIN uang pribadi', cls: 'small', body: `${UI.field('PIN lama', '<input type="password" inputmode="numeric" name="a" autocomplete="off">')}${UI.field('PIN baru (6–12 angka)', '<input type="password" inputmode="numeric" name="b" autocomplete="off">')}${UI.field('Ulangi PIN baru', '<input type="password" inputmode="numeric" name="c" autocomplete="off">')}<div class="bad small e"></div>`,
      foot: `<button class="btn" data-ok>Ganti</button>` });
    s.el.querySelector('[data-ok]').onclick = async () => {
      const f = UI.formData(s.el), e = s.el.querySelector('.e');
      if (!/^\d{6,12}$/.test(f.b) || f.b !== f.c) { e.textContent = 'PIN baru 6–12 angka dan harus sama.'; return; }
      e.textContent = 'Memproses…';
      if (!(await Priv.change(f.a, f.b))) { e.textContent = 'PIN lama salah.'; return; }
      s.close(); UI.toast('PIN diganti & catatan dienkripsi ulang.'); UI.render();
    };
  });

  // ---------- Data ----------
  function data() {
    const n = U.sum(Object.keys(Store.SCHEMA), t => Store.t[t].length);
    const pend = U.sum(Store.outbox, b => b.ops.length);
    return `<div class="card kv-list">
        <div class="kv"><span>Mode</span><b>${Store.mode === 'demo' ? 'Demo (data contoh)' : 'Google Drive keluarga'}</b></div>
        <div class="kv"><span>Total baris data</span><b>${U.fmtNum(n)}</b></div><div class="kv"><span>Transaksi</span><b>${U.fmtNum(Store.t.Transaksi.length)}</b></div>
        <div class="kv"><span>Menunggu dikirim</span><b>${pend ? pend + ' perubahan' : 'Tidak ada ✓'}</b></div>
        <div class="kv"><span>Sinkron terakhir</span><b>${Store.lastSync ? U.timeAgo(new Date(Store.lastSync).toISOString()) : '-'}</b></div>
        <div class="kv"><span>Baris log dibaca</span><b>${U.fmtNum(Store.cursor)}</b></div></div>
      <div class="row-btns"><button class="btn" data-act="sync-now">${I('refresh-cw')} Sinkron sekarang</button><button class="btn ghost" data-act="sync-full">${I('database-zap')} Muat ulang penuh</button></div>
      ${Store.mode === 'live' ? `<div class="row-btns"><a class="btn ghost" href="${Cloud.link()}" target="_blank" rel="noopener">${I('sheet')} Buka spreadsheet</a>${Store.isAdminLike() ? `<button class="btn ghost" data-act="mirror-now">${I('table')} Perbarui tabel</button>` : ''}</div>` : ''}
      <button class="btn block ghost" data-act="backup">${I('download')} Unduh cadangan (JSON)</button>
      <p class="muted small">Aplikasi menyimpan salinan data di perangkat agar terbuka instan & tetap bisa dipakai saat sinyal lemah; perubahan dikirim otomatis saat online. Tab tabel di spreadsheet diperbarui otomatis sekali sehari dari perangkat Admin.</p>`;
  }
  UI.act('sync-now', async () => { await Store.flush(); const r = await Store.sync(); UI.toast(r && r.ok ? 'Sinkron selesai.' : (r && r.message) || 'Belum bisa sinkron.', r && r.ok ? 'ok' : 'warn'); UI.render(); });
  UI.act('lang-set', el => window.I18N && I18N.set(el.value));
  UI.act('sync-full', async () => { await Store.flush(); const r = await Store.sync(true); UI.toast(r && r.ok ? 'Data dimuat ulang dari Google Drive.' : (r && r.message) || 'Gagal.', r && r.ok ? 'ok' : 'warn'); UI.render(); });
  UI.act('mirror-now', async el => { el.disabled = true; const r = await Cloud.mirror(Store.tablesWire()); el.disabled = false; UI.toast(r.ok ? 'Tab tabel di spreadsheet diperbarui.' : 'Gagal: ' + r.message, r.ok ? 'ok' : 'error'); if (r.ok) localStorage.setItem('sa:mir:' + Store.fileId, String(Date.now())); });
  UI.act('backup', () => {
    const out = { app: 'SatuAtap', versi: APP_CONFIG.VERSION, dibuat: new Date().toISOString(), keluarga: Store.setting('namaKeluarga', ''), tables: {} };
    Object.keys(Store.SCHEMA).forEach(t => out.tables[t] = Store.t[t]);
    U.download('cadangan-satuatap-' + U.today() + '.json', JSON.stringify(out), 'application/json');
  });

  function tentang() {
    return `<div class="about"><img src="img/logo-wide.png" alt="SatuAtap" width="220"><p><b>SatuAtap — Keuangan Keluarga</b><br><i>Keuangan keluarga, di bawah satu atap.</i></p>
      <div class="card kv-list"><div class="kv"><span>Versi aplikasi</span><b>${APP_CONFIG.VERSION}</b></div><div class="kv"><span>Dibuat oleh</span><b>JuniorLabs</b></div><div class="kv"><span>Data</span><b>Google Drive keluarga Anda</b></div>${Store.setting('lisensiKode', '') ? `<div class="kv"><span>Lisensi</span><b>${U.esc(Store.setting('lisensiKode', ''))}</b></div>` : ''}</div>
      <p class="muted small">SatuAtap membantu mencatat & merencanakan keuangan. Angka simulasi bersifat perkiraan dan bukan nasihat keuangan, pajak, atau hukum.</p></div>`;
  }

  // ---------- Laporkan masalah / usul fitur ----------
  UI.page('laporan', {
    head: p => ({ title: p === 'ide' ? 'Usul Fitur' : 'Laporkan Masalah', crumb: 'Lainnya', back: 'lainnya' }),
    nav: () => 'lainnya', noFab: true,
    render(p) {
      const ide = p === 'ide';
      return `<div class="card" id="f-lap">
        ${UI.seg('jenis', [['masalah', 'Masalah / bug'], ['ide', 'Usul fitur']], ide ? 'ide' : 'masalah')}
        ${UI.field('Bagian aplikasi', `<select name="modul">${['Beranda', 'Mutasi / Catat', 'Kalender', 'Anggaran', 'Tujuan', 'Utang', 'Aset', 'Rapor', 'Login / Sinkron', 'Lainnya'].map(x => `<option>${x}</option>`).join('')}</select>`)}
        ${UI.field('Judul singkat', `<input name="judul" maxlength="80" placeholder="${ide ? 'mis. Ingin ada fitur arisan' : 'mis. Saldo GoPay tidak sesuai'}">`)}
        ${UI.field('Ceritakan detailnya', `<textarea name="deskripsi" rows="5" maxlength="3000" placeholder="${ide ? 'Apa yang ingin dilakukan & kenapa?' : 'Langkah yang dilakukan, apa yang terjadi, apa yang diharapkan.'}"></textarea>`, 'Jangan tulis kata sandi, PIN, atau nomor rekening lengkap.')}
        ${UI.field('Seberapa mengganggu?', UI.seg('prioritas', [['rendah', 'Ringan'], ['sedang', 'Sedang'], ['tinggi', 'Berat']], 'sedang'))}
        <button class="btn block" data-act="lap-send">${I('send')} Kirim</button></div>
        <p class="muted small center">Atau chat langsung: <button class="link" data-act="wa-support">WhatsApp dukungan</button></p>`;
    }
  });
  UI.act('lap-send', async el => {
    const f = UI.formData(document.getElementById('f-lap'));
    if (!f.judul || f.deskripsi.length < 10) return UI.toast('Isi judul & deskripsi (min. 10 karakter).', 'warn');
    f.diagnostik = 'v' + APP_CONFIG.VERSION + ' · ' + navigator.userAgent + ' · ' + innerWidth + 'x' + innerHeight + ' · mode ' + Store.mode + ' · rev ' + Store.rev + ' · antrean ' + Store.outbox.length;
    el.disabled = true; const r = await API.call('laporan.kirim', f); el.disabled = false;
    if (r.success) { UI.toast(r.message || 'Terkirim. Terima kasih!'); UI.go('lainnya'); } else UI.toast(r.message || 'Gagal mengirim — coba lagi.', 'error');
  });
})();
