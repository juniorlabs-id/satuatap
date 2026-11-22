/* ============================================================
 * Panduan Penggunaan (Lainnya › Bantuan) — cara cepat memakai SatuAtap.
 * Tiap topik bisa dibuka langsung: #/panduan/<id> (mis. #/panduan/bukti).
 * ============================================================ */
(function () {
  const I = UI.icon;
  const coba = (act, label, ikon) => `<button class="btn sm" data-act="${act}">${I(ikon || 'play')} ${label}</button>`;
  const ke = (to, label) => `<button class="btn ghost sm" data-act="go" data-to="${to}">${label} ${I('chevron-right')}</button>`;
  const contoh = t => `<code class="pg-ex">${t}</code>`;
  const TOPIK = [
    ['mulai', 'wand-sparkles', 'Memulai & pasang di layar utama', () => `
      <ol class="steps"><li><b>Panduan Mulai</b> menyiapkan dompet, gaji, tagihan rutin, dan goals dalam ± 3 menit.</li>
        <li><b>Pasang di layar utama</b> agar terbuka seperti aplikasi biasa dan bisa menerima <i>Bagikan</i>:<br>
          Android (Chrome): ⋮ › <b>Instal aplikasi</b> / <b>Tambahkan ke layar utama</b>.<br>iPhone (Safari): ikon Bagikan › <b>Tambah ke Layar Utama</b>.</li></ol>
      <div class="row-btns">${ke('mulai', 'Buka Panduan Mulai')}</div>`],
    ['cepat', 'zap', 'Catat cepat dengan mengetik', () => `
      <p>Tekan tombol <b>+</b> lalu ketik seperti chat. Bisa beberapa sekaligus, pisahkan dengan koma.</p>
      <div class="pg-exs">${contoh('makan siang 25rb')}${contoh('bensin 50rb gopay, parkir 2rb tunai')}${contoh('kemarin sayur 30rb')}${contoh('gaji 7,5jt bca')}</div>
      <ul class="ul"><li>Sebut <b>dompet</b> (tunai, gopay, bca…) — bila tidak, dipakai dompet terakhir.</li><li>Tulis <b>kemarin</b> untuk mencatat tanggal kemarin.</li>
        <li>Kategori dipilih otomatis; bila Anda mengubahnya, SatuAtap <b>mengingat</b> pilihan itu untuk catatan berikutnya.</li>
        <li>Catatan yang sering diulang? Buat <b>Template Cepat</b> — muncul sebagai tombol sekali ketuk.</li><li>Transfer antar dompet & isian lengkap: <b>+ › Manual</b>.</li></ul>
      <div class="row-btns">${coba('catat', 'Coba catat cepat', 'zap')}${ke('pengaturan/template', 'Template Cepat')}</div>`],
    ['suara', 'mic', 'Catat dengan suara', () => `
      <ul class="ul"><li><b>Tahan tombol +</b> ± ½ detik → langsung mendengarkan.</li>
        <li>Dari layar utama HP: <b>tekan lama ikon SatuAtap</b> › pilih <b>Catat suara</b> (bisa diseret ke layar utama sebagai pintasan sendiri).</li>
        <li>Ucapkan wajar, beberapa sekaligus pakai kata <b>"dan"</b>:</li></ul>
      <div class="pg-exs">${contoh('gudeg empat puluh lima ribu tunai')}${contoh('bensin lima puluh ribu gopay dan parkir dua ribu')}</div>
      <p class="muted small">Hasilnya tampil sebagai kartu yang bisa diperiksa dulu sebelum disimpan.</p>
      <div class="row-btns">${coba('voice-catat', 'Coba catat suara', 'mic')}</div>`],
    ['bukti', 'share-2', 'Dari screenshot bukti bayar (bank / e-wallet)', () => `
      <p>Setelah membayar di m-banking, e-wallet, atau QRIS, screenshot halaman <b>"Berhasil"</b>. AI membaca nominal, tujuan, dan sumber dananya.</p>
      <ol class="steps"><li><b>Cara tercepat (Android):</b> buka screenshot di galeri › <b>Bagikan</b> › <b>SatuAtap</b>. Aplikasi terbuka dengan catatan yang sudah terisi.</li>
        <li><b>Semua HP (termasuk iPhone):</b> tombol <b>+</b> › <b>Scan</b> › <b>Galeri</b> › pilih screenshot.</li>
        <li>Periksa nominal, kategori, dan dompet › <b>Simpan</b>.</li></ol>
      <div class="note small">${I('info')} <span>Ikon SatuAtap muncul di daftar Bagikan bila aplikasi sudah <b>dipasang di layar utama</b>. Setelah pembaruan, bisa butuh beberapa jam; bila tidak muncul, pasang ulang dari Chrome.</span></div>
      <div class="note small">${I('lightbulb')} <span>Pastikan nominal dan nama penerima/merchant terlihat di screenshot. Top up dan tarik tunai sebaiknya dicatat sebagai <b>Transfer</b> (+ › Manual).</span></div>
      <div class="row-btns">${coba('ai-struk', 'Coba dari galeri', 'image')}</div>`],
    ['struk', 'scan-line', 'Scan struk belanja per barang & split bill', () => `
      <ol class="steps"><li>Tombol <b>+</b> › <b>Scan</b> › foto struk (lurus & terang).</li><li>Di <b>Cek hasil scan</b>: setiap barang sudah berkategori — ketuk untuk mengubah nama, nominal, atau kategori. Barang bertanda kuning perlu dicek (biasanya ada diskon).</li>
        <li>Belanja bareng teman? Ketuk <b>Split bill dengan teman</b>, isi nama teman, lalu pilih <b>milik</b> tiap barang. Bagian teman tercatat sebagai <b>piutang</b>.</li>
        <li><b>Simpan</b> → satu struk = satu mutasi; rinciannya ada di <b>Detail transaksi</b>, dan anggaran dihitung per kategori barang.</li></ol>
      <div class="row-btns">${coba('ai-struk', 'Coba scan struk', 'scan-line')}</div>`],
    ['impor', 'sheet', 'Pindahkan catatan lama dari Excel', () => `
      <p>Pernah mencatat di Excel atau Google Sheets? Unduh sebagai <b>.xlsx</b> atau <b>.csv</b>, lalu buka <b>Lainnya › Impor dari Excel</b>.</p>
      <ol class="steps"><li><b>Pilih berkas</b> — template apa pun, termasuk mutasi rekening bank. Cukup ada kolom tanggal & jumlah.</li><li><b>Cek kolom</b> — terbaca otomatis (dibantu AI bila susunannya tidak biasa); ubah bila keliru.</li>
        <li><b>Cocokkan kategori</b> — kategori lama dipasangkan ke kategori SatuAtap; pilihan Anda diingat untuk impor berikutnya.</li><li><b>Impor</b> — saldo dompet saat ini tidak berubah. Catatan yang sudah ada dilewati, dan impor bisa dibatalkan seluruhnya.</li></ol>
      <div class="row-btns">${ke('impor', 'Buka Impor dari Excel')}</div>`],
    ['chat', 'message-circle', 'Catat lewat Telegram & WhatsApp', () => `
      <p>Kirim pesan seperti ${contoh('makan siang 45rb gopay')} ke bot Telegram SatuAtap (atau nomor WA keluarga bila dipasang). Catatan masuk ke <b>Menunggu konfirmasi</b> di aplikasi.</p>
      <div class="row-btns">${ke('pengaturan/notif', 'Hubungkan Telegram / WA')}</div>`],
    ['konfirmasi', 'circle-check', 'Menunggu konfirmasi & geser baris', () => `
      <ul class="ul"><li>Draf dari chat dan tagihan rutin yang jatuh tempo tampil di <b>Menunggu konfirmasi</b> (Beranda & Mutasi).</li>
        <li><b>Geser ke kanan</b> = simpan. <b>Geser ke kiri</b> = ubah / hapus. <b>Ketuk</b> = lihat detail.</li><li>Draf yang belum lengkap (mis. kategori kosong) dibuka untuk dilengkapi dulu.</li></ul>`],
    ['beranda', 'layout-grid', 'Atur tampilan Beranda', () => `
      <ul class="ul"><li>Di bawah Beranda ketuk <b>Atur urutan Beranda</b> › tahan ikon ⠿ dan geser untuk mengubah urutan, ketuk 👁 untuk menyembunyikan kartu.</li>
        <li>Ikon <b>mata</b> di atas menyembunyikan semua nominal — berguna saat membuka aplikasi di depan orang lain.</li><li>Susunan disimpan per anggota keluarga.</li></ul>`],
    ['pengingat', 'bell', 'Pengingat tagihan', () => `
      <ul class="ul"><li>Tagihan & cicilan <b>Rp 1 juta ke atas</b>: diingatkan H-7, H-3, H-1, dan hari H.</li><li>Di bawah Rp 1 juta: H-1 dan hari H saja.</li>
        <li>Dikirim ke Telegram (dan WA bila dipasang) sekitar pukul 08.00 setelah <b>script Pendamping</b> terpasang.</li></ul>
      <div class="row-btns">${ke('pengaturan/notif', 'Pengaturan notifikasi')}</div>`],
    ['goals', 'target', 'Goals & aset yang ditautkan', () => `
      <ul class="ul"><li>Setoran ke goals tercatat dari dompet mana pun.</li><li>Emas, reksa dana, dan saham bisa ditautkan ke satu goals (pilih <b>Untuk goals</b> di aset tersebut) — nilainya ikut dihitung sebagai progres.</li></ul>
      <div class="row-btns">${ke('tujuan', 'Buka Goals')}</div>`],
    ['ai', 'sparkles', 'Tanya AI', () => `
      <p>Tanyakan apa saja tentang keuangan keluarga, mis. ${contoh('kategori apa yang paling boros bulan ini?')}. Angka dihitung dari catatan Anda; AI hanya merangkai jawabannya. Sudah termasuk langganan — tanpa pemasangan.</p>
      <div class="row-btns">${ke('ai', 'Buka Tanya AI')}</div>`]
  ];

  UI.page('panduan', {
    head: () => ({ title: 'Panduan Penggunaan', crumb: 'Lainnya', back: 'lainnya' }),
    nav: () => 'lainnya',
    render(p) {
      return `<p class="muted small pg-intro">Cara cepat memakai SatuAtap. Ketuk topik untuk membuka.</p>
        <div class="card list pg-list">${TOPIK.map(t => `<details class="pg-item" id="pg-${t[0]}" ${p === t[0] ? 'open' : ''}>
          <summary class="row"><span class="cat-ic">${I(t[1])}</span><div class="tx-txt"><b>${t[2]}</b></div>${I('chevron-down')}</summary>
          <div class="pg-isi">${t[3]()}</div></details>`).join('')}</div>
        <div class="card pg-help"><b>Masih bingung?</b><p class="muted small">Tim JuniorLabs siap membantu lewat WhatsApp.</p><div class="row-btns"><button class="btn ghost sm" data-act="wa-support">${I('message-circle')} Chat dukungan</button></div></div>
        <div class="spacer"></div>`;
    },
    after(el, p) { if (p) { const d = el.querySelector('#pg-' + p); if (d) setTimeout(() => d.scrollIntoView({ block: 'start', behavior: 'smooth' }), 80); } }
  });
})();
