# Panduan Instalasi SatuAtap 1.3 (arsitektur relay)

**SatuAtap — Keuangan keluarga, di bawah satu atap.**

## Gambaran singkat

| Bagian | Isi | Dipasang oleh | Berapa kali |
|---|---|---|---|
| **Aplikasi** (GitHub Pages) | `index.html`, `css/`, `js/`, `img/` | JuniorLabs | Sekali, dipakai semua pembeli |
| **Relay** (Apps Script JuniorLabs) | `Relay.gs` + `appsscript-relay.json` | JuniorLabs | Sekali |
| **Data keluarga** | 1 file Google Sheets "SatuAtap – Data …" | Dibuat otomatis oleh aplikasi | Per keluarga, di Drive Admin keluarga |
| **Skrip Pendamping** (opsional) | `Pendamping.gs` — jadwal tagihan ke Google Calendar | Admin keluarga yang menginginkannya | Opsional |

Pembeli **tidak perlu** membuka Apps Script, men-deploy, atau menyalin URL. Mereka cukup membuka aplikasi, menekan **Masuk dengan Google**, lalu memasukkan kode lisensi.

**Mengapa tidak ada layar "Google belum memverifikasi aplikasi ini"?** Aplikasi hanya meminta izin `drive.file`, yaitu akses ke file yang dibuat atau dipilih lewat SatuAtap saja. Google menggolongkan izin ini sebagai *non-sensitive* sehingga tidak perlu verifikasi. Layar peringatan hanya muncul untuk Skrip Pendamping yang sifatnya opsional (Bagian C).

---

## Bagian A — Untuk JuniorLabs (sekali saja)

Sebaiknya semua langkah dilakukan memakai akun **juniorlabs.id@gmail.com**.

### A1. Siapkan proyek Google Cloud

1. Buka <https://console.cloud.google.com>, lalu buat proyek baru bernama `SatuAtap`.
2. Buka **APIs & Services › Library**, lalu aktifkan tiga API: **Google Drive API**, **Google Sheets API**, dan **Google Picker API**.
3. Buka **Google Auth Platform** (dulu bernama *OAuth consent screen*):
   - **Branding**: isi nama aplikasi `SatuAtap` dan email dukungan. **Jangan unggah logo**, karena logo memicu proses verifikasi merek.
   - **Audience**: pilih **External**, lalu tekan **Publish app** sampai statusnya **In production**. Selama masih berstatus *Testing*, hanya 100 akun uji yang bisa masuk dan sesi kedaluwarsa setiap 7 hari.
   - **Data access**: tambahkan scope `.../auth/drive.file`, `openid`, `email`, dan `profile`. Semuanya non-sensitive.
   - **Clients › Create client**: pilih jenis **Web application**.
     - **Authorized JavaScript origins**: `https://USERNAME.github.io` (tanpa garis miring di akhir).
     - **Authorized redirect URIs**: `https://USERNAME.github.io/satuatap/oauth.html` (halaman kembali setelah login; sesuaikan nama repository).
     - Simpan, lalu salin **Client ID** dan **Client secret**.
4. Buka **APIs & Services › Credentials › Create credentials › API key**, lalu edit kuncinya:
   - **Application restrictions**: pilih *Websites*, isi `https://USERNAME.github.io/*`.
   - **API restrictions**: pilih **Google Picker API** saja.
5. Buka **Project settings** (ikon ⋮ di kanan atas), lalu catat **Project number** (berupa angka).

### A2. Pasang relay JuniorLabs

1. Buka <https://script.google.com> dengan akun JuniorLabs, lalu buat **Proyek baru** bernama `SatuAtap Relay`.
2. Buka ⚙️ **Setelan Proyek**, lalu centang **Tampilkan file manifes appsscript.json**.
3. Tempel isi `appsscript-relay.json` ke `appsscript.json`, lalu tempel isi `Relay.gs` ke `Kode.gs`.
4. Di baris atas `Relay.gs`, isi `const CLIENT_ID = '…apps.googleusercontent.com'` dengan Client ID dari A1. Simpan.
5. **Client secret (rahasia):** buka ⚙️ **Setelan Proyek › Script Properties › Tambahkan properti**. Isi nama `GOOGLE_CLIENT_SECRET` dan nilainya Client secret dari A1. **Jangan** menulisnya di kode atau di file lain.
6. Pilih fungsi **`setupRelay`** lalu tekan **▶ Jalankan**. Izinkan akses. Layar peringatan Google wajar muncul di sini karena ini skrip milik JuniorLabs sendiri.
   Log akan menampilkan "Client secret: tersimpan ✓". Kunci enkripsi sesi (`TOKEN_KEY`, `TOKEN_MAC`) dibuat otomatis.
7. Buka **Deploy › New deployment › Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
8. Salin URL yang berakhiran `/exec`.

### A3. Isi `js/config.js`

```js
GOOGLE_CLIENT_ID: '1234-xxxx.apps.googleusercontent.com',   // A1 langkah 3
GOOGLE_API_KEY:   'AIza…',                                   // A1 langkah 4
GOOGLE_APP_ID:    '123456789012',                            // A1 langkah 5 (Project number)
RELAY_URL:        'https://script.google.com/macros/s/…/exec' // A2
```

Keempat nilai ini memang publik karena dipakai oleh browser. Pengamannya adalah batasan domain dan API yang sudah diatur di A1.

### A4. Unggah aplikasi ke GitHub Pages

> Jalankan `git init` di folder hasil ekstrak ZIP yang **langsung berisi `index.html`**.

1. Ekstrak `satuatap-frontend.zip`, isi `js/config.js` (A3), lalu buka PowerShell di folder tersebut.
2. Jalankan `dir` dan pastikan terlihat `index.html`, `sw.js`, serta folder `css`, `js`, dan `img`.
3. Di github.com, buat repository **Public** bernama `satuatap` tanpa README.
4. Jalankan:
   ```powershell
   git init
   git add .
   git commit -m "SatuAtap 1.1.0"
   git branch -M main
   git remote add origin https://github.com/USERNAME/satuatap.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (dibuat di github.com/settings/tokens, jenis classic, centang `repo`). Layar memang tidak menampilkan apa pun saat token ditempel.
5. Buka **Settings › Pages**, pilih **Deploy from a branch**, lalu **main / (root)** → Save, dan centang **Enforce HTTPS**.
6. Tunggu 1–2 menit, lalu buka `https://USERNAME.github.io/satuatap/`. Coba **Masuk dengan Google** dengan akun Anda sendiri.

### A5. Membuat & mengelola lisensi

**Cara utama — Konsol di aplikasi (superadmin).** Akun `juniorlabs.id@gmail.com` adalah superadmin. Setelah masuk ke aplikasi, buka **Lainnya › JuniorLabs**. Di sana tersedia:
- **Konsol Lisensi:** daftar semua kode beserta statusnya, keluarga, email Admin, dan anggota. Ketuk sebuah kode untuk menyalin, mengirim lewat WA, memberi catatan, mencabut, memulihkan, atau melepas ikatan.
- **Buat Kode:** membuat 1–50 kode sekaligus dengan catatan (misalnya nomor pesanan). Tersedia tombol WA berisi pesan aktivasi siap kirim.
- **Laporan Masuk:** laporan masalah dan usul fitur dari pengguna.
- **Statistik:** jumlah keluarga aktif, akun pengguna, aktivasi per bulan, dan kuota email.

- **Harga Emas:** status harga hari ini, sumbernya, pesan galat bila pengambilan terakhir gagal, tombol **Ambil harga sekarang**, dan isian manual harga beli/buyback per gram yang langsung dipakai semua keluarga.

**Harga emas otomatis.** Relay mengambil harga tiap 2 jam berurutan dari: halaman harga Logam Mulia (Antam) → harga-emas.org → harga spot dunia (dikonversi ke Rupiah dengan rasio hari sebelumnya). Riwayat tersimpan di sheet **HargaEmas** pada spreadsheet relay. Kalau situs sumber berubah tampilan dan semua cara gagal, harga terakhir tetap dipakai, ubin **Harga Emas** di Konsol diberi tanda **!**, dan Anda cukup mengisi harga manual di Konsol sampai relay diperbaiki. Harga manual hari itu tidak ditimpa pengambilan otomatis.

Superadmin juga bisa **membuat data keluarga tanpa kode lisensi**; lisensi internal dibuat otomatis. Untuk menambah superadmin lain, isi Script Property relay `SUPERADMIN` dengan email (pisahkan dengan koma).

**Cara cadangan — dari editor relay:**

Semua fungsi di bawah dijalankan dari editor relay:

| Fungsi | Kegunaan |
|---|---|
| `buatLisensi` | Membuat 10 kode (`SA-XXXX-XXXX-XXXX`). Kodenya muncul di **Log eksekusi** dan tercatat di sheet **Lisensi**. Untuk jumlah lain, ubah sementara angkanya di baris `jumlah = …`. |
| `cabutLisensi('SA-…')` | Menonaktifkan lisensi (misalnya ada refund). |
| `pulihkanLisensi('SA-…')` | Mengaktifkan kembali lisensi yang dicabut. |
| `lepasLisensi('SA-…')` | Melepas ikatan lisensi agar bisa diaktifkan ulang, misalnya pembeli pindah akun Google. |

Pemanggilan dengan parameter: buat fungsi kecil, misal `function x(){ cabutLisensi('SA-ABCD-EFGH-JKLM') }`, lalu jalankan.

Sheet **Lisensi** menampilkan siapa Admin-nya, nama keluarga, daftar email anggota (maks. 5), dan waktu cek terakhir.

**Kuota email:** akun Gmail biasa dapat mengirim email ke sekitar 100 penerima per hari. Kalau banyak keluarga membuka aplikasi di awal bulan, ringkasan otomatis masuk antrean dan dikirim bertahap setiap jam. Dengan Google Workspace kuotanya sekitar 1.500 per hari.

---

## Bagian B — Untuk pembeli (Admin keluarga)

### B1. Masuk & buat data keluarga

1. Buka `https://USERNAME.github.io/satuatap/` di HP, lalu tekan **Masuk dengan Google**.
2. Google akan meminta izin agar SatuAtap bisa *melihat, mengedit, membuat, dan menghapus file Google Drive tertentu yang Anda gunakan dengan aplikasi ini*. Tekan **Izinkan**.
3. Pilih **Buat data keluarga baru**, lalu isi nama keluarga, nama panggilan, dan **kode lisensi**.
4. Selesai. File **"SatuAtap – Data …"** otomatis dibuat di Google Drive Anda.
5. Pasang ke layar utama lewat menu browser › **Tambahkan ke layar utama**.

### B2. Isi data awal (5 menit)

1. **Aset › Kas & Bank**: tambahkan rekening, e-wallet, dan uang tunai beserta saldonya hari ini.
2. **Kalender › Tambah Rutin**: masukkan gaji, listrik, internet, SPP, langganan, dan tagihan tahunan.
3. **Lainnya › Anggaran**: beri batas untuk tiap amplop, atau gunakan **Bagi Gaji**.
4. **Lainnya › Tujuan**: mulai dari **Dana Darurat**.
5. **Pengaturan › Keluarga**: kalau gajian tanggal 25, ubah periode anggaran agar dimulai tanggal 25.

### B3. Undang pasangan & anggota (maks. 5 akun)

1. Buka **Lainnya › Anggota & Izin › Undang anggota**, lalu isi nama, email Google, dan peran:
   - **Pasangan**: akses penuh.
   - **Anggota**: izin diatur per menu.
2. File keluarga otomatis dibagikan, dan Google mengirim email undangan ke anggota tersebut.
3. Anggota lalu membuka aplikasi, menekan **Masuk dengan Google**, memilih **Saya diundang**, dan memilih file **"SatuAtap – Data …"**.
4. Menonaktifkan anggota akan otomatis mencabut aksesnya ke file. Data di HP anggota itu juga ikut dibersihkan.

### B4. Uang pribadi suami/istri

Buat kategori uang pribadi di **Lainnya › Anggaran › Uang Pribadi**. Saat pertama mencatat di kategori ini, Anda diminta membuat **PIN 6–12 angka**.

Catatan dan tag dienkripsi di HP Anda, sehingga anggota lain hanya melihat nominalnya, termasuk saat membuka spreadsheet. **PIN tidak bisa dipulihkan.** Kalau lupa, catatan lama tidak bisa dibaca lagi, tetapi nominalnya tetap aman.

### B5. Hal yang perlu diketahui

- **Sinkron otomatis:** cukup login sekali per HP. Setelah itu aplikasi menyambung ke Google sendiri tanpa perlu diketuk. Tombol kuning **Sinkronkan** hanya muncul bila Google mencabut izin, misalnya akses SatuAtap dihapus di akun Google atau tidak dipakai lebih dari 6 bulan. Ketuk sekali untuk login ulang.
- **Pengingat tagihan** hanya tampil di dalam aplikasi: Beranda (≤ 3 hari lagi) dan Kalender. Tidak ada email pengingat. Pengingat lewat Telegram/WhatsApp menyusul.
- **Email ringkasan bulanan** dikirim ke Admin & Pasangan saat aplikasi pertama kali dibuka di periode baru. Bisa dimatikan di **Lainnya › Notifikasi**.
- **Spreadsheet:** tab Transaksi, Dompet, dan lainnya diperbarui otomatis sekali sehari. Jangan mengubah sheet tersembunyi `_log` karena itu sumber data aplikasi.

---

## Bagian C — Skrip Pendamping (opsional): jadwal di Google Calendar

Untuk keluarga yang ingin tagihan, cicilan, dan acara muncul otomatis di **Google Calendar**. Skrip ini tidak mengirim email. Kalendernya bisa dibagikan ke pasangan, dan Google Calendar memberi notifikasi pukul 15.00 sehari sebelum jatuh tempo.

1. Di aplikasi, buka **Lainnya › Notifikasi › Salin ID file**.
2. Buka <https://script.google.com> dengan akun **Admin keluarga** (pemilik file), lalu buat **Proyek baru** bernama `SatuAtap Pendamping`.
3. Buka **Setelan Proyek**, centang **Tampilkan appsscript.json**, lalu tempel isi `appsscript-pendamping.json`.
4. Tempel isi `Pendamping.gs` ke `Kode.gs`, lalu ganti `TEMPEL_ID_FILE_DI_SINI` dengan ID file dari langkah 1. Simpan.
5. Pilih fungsi **`setupPendamping`** lalu tekan **▶ Jalankan**.
   - Akan muncul layar **"Google belum memverifikasi aplikasi ini"**. Ini normal untuk skrip yang Anda pasang sendiri di akun Anda. Klik **Lanjutan** → **Buka SatuAtap Pendamping (tidak aman)** → **Izinkan**.
   - Skrip hanya *membaca* file keluarga dan menulis ke kalender "Keuangan …" milik Anda.
6. Selesai. Setiap pagi sekitar pukul 06.00, kalender diperbarui untuk 60 hari ke depan. Jadwal yang sudah lunas diberi tanda ✓.
7. Agar pasangan melihat kalender yang sama: buka Google Calendar, lalu pilih **Keuangan …** › **Setelan & berbagi** › tambahkan email pasangan.

Untuk berhenti, jalankan fungsi `hentikanPendamping`.

---

## Bagian D — Memperbarui versi

- **Aplikasi:** ganti file, naikkan `VERSION` di `js/config.js` dan `VER` di `sw.js`, lalu jalankan `git add .`, `git commit -m "Versi …"`, dan `git push`. Semua pembeli otomatis mendapat versi baru.
- **Relay:** tempel kode baru, lalu buka **Deploy › Manage deployments** › ✏️ › **Version: New version** › Deploy. URL `/exec` tetap sama.
- **Data keluarga** tidak perlu migrasi. Format log tetap kompatibel.

**Khusus pembaruan ke 1.3 (Fase 2):**
1. Unggah semua file aplikasi baru (ada file baru: `js/calc2.js`, `js/pages/emas.js`, `js/pages/investasi.js`, `js/pages/zakat.js`).
2. Relay: tempel `Relay.gs` baru, lalu **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**.
3. Jalankan sekali fungsi **`setupRelay`** dari editor relay. Ini memasang pemicu `perbaruiHargaEmas` (tiap 2 jam) dan mengambil harga pertama. Rahasia yang sudah ada tidak ditimpa.
4. Buka aplikasi dengan akun superadmin › **Lainnya › JuniorLabs › Harga Emas** dan pastikan harga sudah tampil.

**Yang baru di 1.3:** Brankas Emas (koleksi per keping & gramasi, multi-pemilik, tautan ke Tujuan, tren akumulasi, jual sebagian + PPh 22, gadai/tebus, peringatan harga, simulasi jual), Investasi & aset lain (saham, reksa dana, SBN, deposito, kripto, properti, kendaraan), Target Alokasi, Zakat & Sedekah (mal dengan nisab & haul, penghasilan, fitrah, qurban, sedekah/donasi), dan Ringkasan SPT per tahun (unduh CSV). Tombol Catat Cepat kini bulat, dan setiap panel yang muncul dari bawah bisa ditutup dengan menggesernya ke bawah.

---

## Bagian E — Masalah umum

| Gejala | Solusi |
|---|---|
| "GOOGLE_CLIENT_ID … masih kosong" | Isi `js/config.js` (A3) lalu push ulang. |
| Pop-up login tidak muncul | Izinkan pop-up untuk situs ini. Di iPhone yang memasang aplikasi ke layar utama, login otomatis memakai mode pindah halaman dan langsung kembali ke aplikasi. |
| "Error 400: redirect_uri_mismatch" | `https://USERNAME.github.io/satuatap/oauth.html` belum ada di **Authorized redirect URIs** (A1 langkah 3). |
| "GOOGLE_CLIENT_SECRET belum diisi" | Isi Script Properties relay (A2 langkah 5). |
| Anggota tidak menemukan file saat "Saya diundang" | Pastikan Admin sudah mengundang email yang sama persis, lalu cari di tab "Dibagikan kepada saya" pada pemilih file. |
| "Akun … belum tercatat di lisensi" | Admin cukup membuka aplikasi sekali agar daftar anggota diperbarui ke server lisensi. |
| "Kode lisensi sudah dipakai akun Google lain" | Jalankan `lepasLisensi('SA-…')` di relay (A5), lalu minta pembeli mengaktifkan ulang. |
| Tombol **Sinkronkan** muncul | Izin Google dicabut atau server lisensi sedang tidak bisa dihubungi. Ketuk tombolnya untuk login ulang. |
| Data pasangan belum muncul | Sinkron otomatis berjalan tiap 1 menit dan saat aplikasi dibuka. Bisa juga dipaksa lewat **Pengaturan › Data & Sinkron › Sinkron sekarang**. |
| Harga emas tidak muncul / bertanda "perlu diperbarui" | Superadmin: buka Konsol › Harga Emas › Ambil sekarang, atau isi manual. Keluarga juga bisa memakai harga sendiri di **Brankas Emas › Harga & Alert › Isi manual**. |
| Pemicu harga emas belum jalan | Jalankan `setupRelay` sekali lagi di editor relay (D, langkah 3). |
| Saldo tidak cocok dengan bank | Buka **Aset › Kas & Bank › (dompet) › Cocokkan saldo**. |

---

## Bagian F — Catatan teknis & privasi

- **Data keuangan** hanya ada di Google Drive keluarga dan di HP anggotanya. Relay JuniorLabs **tidak** menerima transaksi.
- **Yang diketahui relay:** kode lisensi, email Admin & anggota (maks. 5), nama keluarga, dan ID file. Angka ringkasan bulanan hanya lewat sebentar di antrean email, lalu isinya dihapus setelah terkirim.
- **Sinkron otomatis:** saat login, relay menukar kode login Google menjadi *kunci perpanjangan*. Kunci ini **disegel** (dienkripsi dan diberi tanda tangan, terikat ke email pemiliknya) lalu **disimpan di HP pengguna**, bukan di relay. Kunci di HP tidak berguna tanpa relay, dan relay tidak bisa membuka data tanpa kunci dari HP. Keluar dari aplikasi otomatis mencabut kunci tersebut di Google.
- **Kuota email relay** dipakai hanya untuk ringkasan bulanan dan laporan masalah. Akun juniorlabs.id@gmail.com (Gmail biasa) bisa mengirim ke sekitar 100 penerima per hari; bila lebih, email masuk antrean dan dikirim bertahap.
- **Kecepatan:** data disimpan di HP sehingga aplikasi langsung tampil. Sinkron hanya mengecek versi file di Drive, dan baru membaca baris log baru bila ada perubahan. Dalam uji dengan sekitar 19.000 transaksi, setiap halaman tampil di bawah 30 ms (laptop).
- **Kuota Google Sheets API:** 300 baca per menit untuk seluruh proyek. Karena aplikasi cukup mengecek versi file di Drive dulu, kuota ini cukup untuk ratusan keluarga. Bila suatu saat kurang, kenaikan kuota bisa diajukan gratis di Cloud Console.
- **Beberapa HP bersamaan:** setiap perubahan ditambahkan sebagai baris baru di `_log`, sehingga pencatatan suami dan istri di waktu yang sama tidak saling menimpa.
- **Izin per menu** untuk peran Anggota dijaga oleh aplikasi. Anggota yang diberi akses file secara teknis tetap bisa membuka spreadsheet. Catatan uang pribadi tetap terenkripsi.

Butuh bantuan? WhatsApp dukungan JuniorLabs **0856-1254-689**, atau gunakan menu **Lainnya › Laporkan Masalah** di aplikasi.
