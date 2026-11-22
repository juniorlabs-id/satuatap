# Panduan Instalasi SatuAtap 1.8.6 (arsitektur relay)

**SatuAtap — Keuangan keluarga, di bawah satu atap.**

## Gambaran singkat

| Bagian | Isi | Dipasang oleh | Berapa kali |
|---|---|---|---|
| **Aplikasi** (GitHub Pages) | `index.html`, `css/`, `js/`, `img/` | JuniorLabs | Sekali, dipakai semua pembeli |
| **Relay** (Apps Script JuniorLabs) | `Relay.gs` + `appsscript-relay.json` | JuniorLabs | Sekali |
| **Data keluarga** | 1 file Google Sheets "SatuAtap – Data …" | Dibuat otomatis oleh aplikasi | Per keluarga, di Drive Admin keluarga |
| **Fungsi Vercel** | `api/emas.js` (harga emas), `api/saham.js` (harga saham IDX), `api/tg.js` (jembatan Telegram), `vercel.json` | JuniorLabs | Sekali (ikut repo) |
| **Bot Telegram** @SatuAtapBot | Dibuat lewat @BotFather, token di Script Properties relay | JuniorLabs | Sekali (Bagian G) |
| **Skrip Pendamping** (opsional) | `Pendamping.gs` — pengingat Telegram/WA pukul 08.00, catat lewat WA, ringkasan WA pukul 20.00 | Admin keluarga yang menginginkannya | Opsional (Bagian C) |
| **Kunci Gemini JuniorLabs** | Untuk Tanya AI, scan struk per barang, kategori otomatis, insight mingguan — dipakai semua keluarga | JuniorLabs, sekali di relay (Script Property `GEMINI_API_KEY`) | Wajib bila fitur AI ingin aktif (A2 langkah 5b) |

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
5b. **Kunci AI (rahasia):** buat kunci di <https://aistudio.google.com/apikey> dengan akun JuniorLabs, lalu di **Script Properties** tambahkan `GEMINI_API_KEY` = kunci tersebut. Opsional: `AI_KUOTA_HARIAN` (jatah permintaan AI per keluarga per hari, bawaan 80) dan `GEMINI_MODEL` (bawaan `gemini-3.5-flash`). Setelah relay terpasang, jalankan fungsi **`cekAI`** — log harus menampilkan "✅ AI berfungsi". Disarankan mengaktifkan penagihan (billing) di AI Studio agar kuota tidak cepat habis dan isi permintaan pelanggan tidak dipakai Google untuk pelatihan.
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

**Harga emas otomatis.** Relay mengambil harga **emas batangan Antam 1 gram** tiap 2 jam, hanya dari situs resmi Logam Mulia: harga beli dari `logammulia.com/harga-hari-ini/emas?tab=beli` (kolom *Harga Dasar*, sebelum PPh 0,25%) dan buyback dari `…?tab=jual` (kolom *Harga Emas*, sebelum potongan PPh). Riwayat tersimpan di sheet **HargaEmas** pada spreadsheet relay. Relay tidak lagi berpindah ke situs lain. Kalau situs Logam Mulia tidak terbaca (diblokir, sedang gangguan, atau tata letaknya berubah), harga Antam terakhir tetap dipakai, ubin **Harga Emas** di Konsol diberi tanda **!**, dan Anda bisa mengisi harga manual di Konsol. Angka yang melompat lebih dari 12% dari harga terakhir dianggap salah baca dan tidak disimpan. Harga manual hari itu tidak ditimpa pengambilan otomatis.

**Jembatan Vercel (wajib).** Situs Logam Mulia menolak permintaan dari server Google (HTTP 403), jadi relay mengambil harga lewat fungsi kecil `api/emas.js` yang ikut di repo aplikasi dan berjalan gratis di Vercel (region Singapura, diatur `vercel.json`). Pastikan folder `api/` dan `vercel.json` ikut di-push. Cek di browser: `https://satuatap.vercel.app/api/emas` harus membalas `"success":true` dengan harga beli & buyback; tambahkan `?cek=1` untuk melihat diagnosis. Kalau alamat situs Anda berbeda, isi Script Property relay `EMAS_PROXY` dengan alamat lengkapnya.

**Cadangan bila Logam Mulia memblokir semua server.** Jembatan Vercel dan relay lalu membaca situs yang menyalin harga resmi Antam setiap hari (Pusat Data Kontan, lalu harga-emas.org). Hanya baris Antam yang dibaca, jadi angkanya tetap angka resmi Antam — hanya bisa terlambat beberapa jam setelah Antam memperbarui. Sumber di aplikasi tertulis "Logam Mulia (Antam) · via Kontan".

**Harga merek lain.** UBS, Galeri24, Lotus Archi, dan Emaskita diambil dari halaman resmi `galeri24.co.id/harga-emas` (harga 1 gram) lewat jembatan Vercel yang sama. Keping dengan merek itu dinilai memakai harganya sendiri; Antam tetap mengikuti logammulia.com, dan perhiasan atau merek lain memakai harga Antam × kadar.

**Opsional — layanan perantara.** Bila Logam Mulia dan situs penyalin sama-sama menolak server, daftar di layanan perantara pengambil halaman (mis. ScraperAPI atau Scrape.do), lalu di Vercel buka **Settings › Environment Variables**, tambahkan `EMAS_FETCH_VIA` berisi templat alamat dari layanan itu dengan `{url}` di posisi alamat halaman, contoh `https://api.scraperapi.com/?api_key=KUNCI_ANDA&country_code=id&url={url}`. Kunci hanya disimpan di Vercel, tidak di repo. Redeploy, lalu cek `?cek=1`.

**Memeriksa koneksi ke Logam Mulia:** di editor relay, pilih fungsi **`cekHargaEmas`** lalu ▶ Jalankan. Log menampilkan apakah kedua halaman terbuka, angka 1 gram yang terbaca, dan cuplikan teks halaman.

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

## Bagian C — Script pendamping (opsional): pengingat Telegram & WhatsApp

Skrip ini dipasang **Admin keluarga** di akun Google-nya sendiri, untuk hal yang harus berjalan walau aplikasi tidak dibuka. Setiap pagi sekitar pukul **08.00** skrip ini:

- mengirim pengingat tagihan & cicilan **H-7, H-3, H-1, dan hari H** ke Telegram setiap anggota yang sudah menghubungkan @SatuAtapBot, plus pengingat Rapat Keuangan;
- (opsional) mengirim pengingat yang sama ke **WhatsApp** lewat akun Fonnte milik keluarga.

Tanpa Pendamping, pengingat Telegram tetap terkirim **saat salah satu anggota membuka aplikasi** (tagihan ≤ 3 hari, amplop 80%/100%, insight mingguan, alert harga emas dari relay).

> **Satu pengingat, sekali tiap pagi.** Setelah Pendamping terpasang, buka **Lainnya › Notifikasi** lalu nyalakan **"Script sudah terpasang"**. Sejak itu pengingat tagihan, cicilan, acara dan rapat dikirim **hanya oleh script, sekitar pukul 08.00, dengan isi yang sama ke Telegram dan WhatsApp**; aplikasi tidak lagi mengirimnya saat dibuka (itu penyebab pesan ganda dan isi yang berbeda). Tanpa Pendamping, saklar dibiarkan mati agar pengingat Telegram tetap terkirim saat aplikasi dibuka. Alert amplop, harga emas, dan insight mingguan tetap dikirim aplikasi/relay karena sifatnya kejadian, bukan jadwal.

### C1. Pasang — ikuti panduan di aplikasi
Buka **Lainnya › Pengaturan › Notifikasi › Skrip Pendamping › Panduan pasang langkah demi langkah**. Panduan 7 langkah itu memandu dari membuat proyek di script.google.com sampai mengecek hasilnya, lengkap dengan tombol:
- **Salin appsscript.json**, dan
- **Salin kode Pendamping**: kodenya **sudah berisi** `FILE_ID` keluarga dan `RELAY_URL`, jadi tidak ada yang perlu diketik ulang (keduanya juga disimpan di Properti skrip saat `setupPendamping` jalan).

Ringkasnya: buat proyek `SatuAtap Pendamping` → tampilkan & isi `appsscript.json` → tempel kode ke `Kode.gs` → jalankan `setupPendamping` → izinkan (layar "Google belum memverifikasi" itu normal untuk skrip milik sendiri: **Lanjutan › Buka … (tidak aman) › Izinkan**) → log menampilkan "✅ Pendamping aktif".

Untuk berhenti, jalankan `hentikanPendamping`.

> **Memperbarui Pendamping (2 menit):** buka panduan yang sama › **Salin kode script** › di editor Pendamping pilih semua (Ctrl+A) › tempel › simpan 💾 › jalankan `setupPendamping` sekali lagi. Selesai. `FILE_ID` dan `RELAY_URL` otomatis tersimpan di **Properti skrip** saat `setupPendamping` dijalankan, jadi tidak ada yang perlu diketik ulang; token Fonnte, nomor WA, dan jadwal juga tidak hilang. Bila Anda memakai berkas `Pendamping.gs` mentah (bukan salinan dari aplikasi), kode itu berisi tulisan `TEMPEL_…` — itu aman asalkan `setupPendamping` pernah dijalankan dari salinan aplikasi (nilainya sudah tersimpan). Jika ragu, jalankan `cekWA`: baris pertamanya menyebut apakah `FILE_ID` dan `RELAY_URL` **terisi**. Pesan WA yang gagal dengan tulisan *"DNS error … TEMPEL_ALAMAT_RELAY…"* berarti keduanya kosong: salin kode dari aplikasi, tempel, jalankan `setupPendamping`.

### C2. WhatsApp lewat Fonnte (opsional)
Buka **Notifikasi › WhatsApp › Pasang WhatsApp** dan ikuti 9 langkahnya (ada ilustrasi letak tombol, semua nilai tinggal salin–tempel):
1. daftar Fonnte, sambungkan nomor pengirim, salin token;
2. isi nomor WA anggota di aplikasi;
3. buat 3 **Properti skrip** — `FONNTE_TOKEN`, `WA_ANGGOTA`, `WA_KUNCI` (dua terakhir disalin dari aplikasi);
4. jalankan `setupWA` (pesan uji masuk; pengingat pagi aktif);
5. **Terapkan › Deployment baru › Aplikasi web** (akses: Siapa saja) dan salin URL-nya;
6. tempel URL itu di aplikasi → aplikasi memberi **alamat webhook** (lewat jembatan `/api/wa` di Vercel) → tempel di fonnte.com › Device › Edit › **Webhook**, nyalakan **autoread**, **Update**.

WhatsApp hanya mengirim **2 pesan sehari**: pengingat pagi dan ringkasan catatan pukul 20.00. Catatan lewat chat tidak dibalas satu per satu; langsung muncul sebagai draf di aplikasi. Bila bermasalah, jalankan `cekWA` di editor. Token Fonnte **hanya** disimpan di Properti skrip keluarga.

### C3. Agar Telegram tidak putus saat update
- Sambungan Telegram setiap anggota tersimpan di relay; update aplikasi/relay **tidak** menghapusnya.
- **Update relay selalu lewat Kelola deployment › ✏️ › Versi baru** — jangan "Deployment baru", karena alamat `/exec` akan berubah.
- Vercel kini mencari alamat relay di dua tempat: Environment Variable `RELAY_URL` **atau** `RELAY_URL` di `js/config.js`. Bila salah satu usang, yang lain dipakai otomatis.
- Relay memeriksa bot setiap 3 jam: webhook yang hilang dipasang ulang otomatis; bila jalur Vercel → relay gagal, Admin JuniorLabs melihat peringatan di **Notifikasi**. Diagnosis manual: jalankan `cekTelegram` di editor relay.

---

## Bagian D — Memperbarui versi

- **Aplikasi:** ganti file, naikkan `VERSION` di `js/config.js` dan `VER` di `sw.js`, lalu jalankan `git add .`, `git commit -m "Versi …"`, dan `git push`. Semua pembeli otomatis mendapat versi baru.
- **Relay:** tempel kode baru, lalu buka **Deploy › Manage deployments** › ✏️ › **Version: New version** › Deploy. URL `/exec` tetap sama.
- **Data keluarga** tidak perlu migrasi. Format log tetap kompatibel.

**Khusus pembaruan ke 1.3 (Fase 2):**
1. Unggah semua file aplikasi baru (ada file baru: `js/calc2.js`, `js/pages/emas.js`, `js/pages/investasi.js`, `js/pages/zakat.js`, serta `api/emas.js` dan `vercel.json` untuk jembatan harga emas).
2. Relay: tempel `Relay.gs` baru, lalu **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**.
3. Jalankan sekali fungsi **`setupRelay`** dari editor relay. Ini memasang pemicu `perbaruiHargaEmas` (tiap 2 jam) dan mengambil harga pertama; rahasia yang sudah ada tidak ditimpa. Lalu jalankan **`cekHargaEmas`** untuk memastikan harga Antam terbaca.
4. Buka aplikasi dengan akun superadmin › **Lainnya › JuniorLabs › Harga Emas** dan pastikan harga sudah tampil.

**Yang baru di 1.3:** Brankas Emas (koleksi per keping & gramasi, multi-pemilik, tautan ke Tujuan, tren akumulasi, jual sebagian + PPh 22, gadai/tebus, peringatan harga, simulasi jual), Investasi & aset lain (saham, reksa dana, SBN, deposito, kripto, properti, kendaraan), Target Alokasi, Zakat & Sedekah (mal dengan nisab & haul, penghasilan, fitrah, qurban, sedekah/donasi), dan Ringkasan SPT per tahun (unduh CSV). Tombol Catat Cepat kini bulat, dan setiap panel yang muncul dari bawah bisa ditutup dengan menggesernya ke bawah.

**Khusus pembaruan ke 1.6:**
1. Unggah semua file aplikasi baru. Ada file baru: `js/pages/saham.js` dan `api/saham.js`, dan `vercel.json` ikut berubah. Jangan menimpa `js/config.js` milik Anda — cukup ubah `VERSION: '1.6.0'`.
2. Relay tidak berubah. Lembar baru **Jurnal Saham** dibuat otomatis di file keluarga saat pertama dipakai.
3. Harga saham dan riwayat penutupan harian (untuk grafik Portofolio vs IHSG & max drawdown) diambil lewat `/api/saham` (data Yahoo Finance, gratis, tanpa kunci). Bila sumber itu sedang tidak bisa diakses, harga bisa diisi manual dan grafik menunggu data tersedia.
4. Alert SL/TP saham dikirim lewat bot Telegram keluarga (Bagian G) saat harga diperbarui — tidak perlu pengaturan tambahan.

**Yang baru di 1.6:** jurnal saham (Overview, Aktivitas trade & arus kas, Analitik, Kalkulator harga rata-rata, bea meterai otomatis), reksa dana per aplikasi & portofolio dengan setoran dari Tujuan, emas beberapa gramasi sekali catat dengan harga per keping, urutan prioritas Tujuan dengan seret, foto profil, hapus dompet/tujuan salah input, serta menu Aset, Lainnya, Anggaran dan Mutasi yang disederhanakan.

**Khusus pembaruan ke 1.5 (Fase 3):**
1. Unggah semua file aplikasi baru. Ada file baru: `js/calc3.js`, `js/ai.js`, `js/i18n.js`, `js/i18n-en.js`, `js/pages/simulasi.js`, `kilas.js`, `rapat.js`, `impor.js`, `ai.js`, `notif.js`, serta `api/tg.js`. Jangan menimpa `js/config.js` milik Anda — cukup ubah `VERSION: '1.5.0'`.
2. Relay: tempel `Relay.gs` baru, lalu **Deploy › Manage deployments › ✏️ › Version: New version › Deploy**.
3. Siapkan bot Telegram (Bagian G).
4. Beri tahu keluarga yang memakai Pendamping untuk memperbarui skripnya (Bagian C, catatan di akhir C1).

**Yang baru di 1.5:** Simulasi Keputusan Besar (kredit, beli/jual aset, pemasukan/pengeluaran baru, dengan dampak ke skor, arus kas 12 bulan, dan Tujuan), Kilas Balik tahunan, Rapat Keuangan bulanan (agenda otomatis, notulen, keputusan, tugas dengan penanggung jawab & tenggat), Impor CSV mutasi bank (deteksi kolom & duplikat), fitur AI dengan kunci Gemini milik keluarga (Tanya AI, foto struk, insight mingguan, bahan diskusi rapat), pengingat & catat lewat Telegram dan WhatsApp, serta tampilan **English** (Pengaturan › Tampilan › Bahasa).

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
| "Bot Telegram belum diaktifkan oleh JuniorLabs" | Jalankan `setupTelegram` di relay (G3) dan pastikan relay sudah dideploy sebagai New version. |
| Bot tidak membalas /start | Di editor relay jalankan **`cekTelegram`** › baca log. Fungsi ini memeriksa token, webhook (termasuk galat terakhir dari Telegram), `api/tg.js` di Vercel, `RELAY_URL`, dan versi deployment relay, lalu menyebut langkah perbaikannya. Webhook yang belum/beda alamat didaftarkan ulang otomatis. |
| Pengingat Telegram pagi tidak datang | Pastikan Pendamping terpasang dengan `RELAY_URL` terisi (C1) dan anggota sudah menghubungkan Telegram di **Lainnya › Notifikasi**. |
| Catat lewat WA tidak masuk | Cek webhook Fonnte memakai URL web app Pendamping lengkap dengan `?k=…`, dan nomor pengirim ada di `WA_ANGGOTA` (format 62…). |
| "Fitur AI belum diaktifkan JuniorLabs" | Isi `GEMINI_API_KEY` di Script Properties relay, lalu jalankan `cekAI` (A2 langkah 5b). |
| "Jatah AI keluarga hari ini sudah habis" | Tunggu besok, atau naikkan `AI_KUOTA_HARIAN` di Script Properties relay. |
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


---

## Bagian G — Bot Telegram @SatuAtapBot (JuniorLabs, sekali saja)

Telegram mengirim pesan ke `https://satuatap.vercel.app/api/tg`, lalu fungsi Vercel itu meneruskannya ke relay. Token bot hanya disimpan di Script Properties relay.

1. **Buat bot.** Di Telegram, buka **@BotFather** › `/newbot` › isi nama `SatuAtap` dan username, misalnya `SatuAtapBot`. Salin token yang diberikan (bentuknya `123456:ABC…`).
   Opsional: `/setdescription` dan `/setuserpic` dengan logo SatuAtap.
2. **Simpan token di relay.** Editor relay › ⚙️ **Setelan Proyek › Script Properties** › tambahkan `TELEGRAM_TOKEN` = token tadi. Jangan menulisnya di kode.
3. **Daftarkan webhook.** Pilih fungsi **`setupTelegram`** › ▶ Jalankan. Fungsi ini membuat `TELEGRAM_SECRET` otomatis, menyimpan nama bot, dan mendaftarkan webhook. Log harus menampilkan "✅ Webhook https://satuatap.vercel.app/api/tg". Bila domain aplikasi berbeda, isi dulu Script Property `TELEGRAM_WEBHOOK` dengan alamat `…/api/tg` Anda.
4. **Sambungkan Vercel ke relay.** Vercel › proyek satuatap › **Settings › Environment Variables** › tambahkan `RELAY_URL` = URL `/exec` relay. Lalu **Deployments › ⋯ › Redeploy** agar variabel terbaca.
5. **Bila bot diam,** jalankan `cekTelegram` di editor relay dan ikuti petunjuk di log.
6. **Uji.** Di aplikasi: **Lainnya › Notifikasi › Hubungkan Telegram saya** › Buka Telegram › **Start**. Bot membalas "Terhubung". Lalu ketuk **Kirim pesan uji**. Kirim juga `makan siang 25rb gopay` ke bot; catatannya muncul di Beranda untuk dikonfirmasi.
   Pesan masuk sebagai **draf** di Beranda & Mutasi › *Menunggu konfirmasi*: geser kanan untuk menyimpan (bila nominal, kategori & dompet terbaca) atau ketuk untuk memeriksa. Setelah disimpan bot membalas "✅ Tercatat".

Batas: maksimal 60 pesan per jam per keluarga. Kode penghubung berlaku 15 menit dan sekali pakai. Ketik `/putus` di bot untuk memutus.

## Bagian I — Catat otomatis (email bank & screenshot)

**Dari email bank & e-wallet** (butuh script Pendamping): di aplikasi buka **Lainnya › Notifikasi › Catat otomatis › Pasang (± 5 menit)**. Ringkasnya: tempel `appsscript.json` dan kode Pendamping terbaru, jalankan `setupEmail` sekali (izin *membaca* Gmail), lalu nyalakan notifikasi email transaksi di aplikasi bank/e-wallet. Email transaksi masuk ke **Menunggu konfirmasi** dengan label *Email bank* paling lambat 15 menit setelah email tiba. Promo, OTP, e-statement, dan top up antar dompet diabaikan. Diagnosa: jalankan `cekEmailLog`. Bank lain: tambahkan domain pengirimnya di Properti skrip `EMAIL_PENGIRIM`. Mematikan sementara: tombol **Matikan** di kartu yang sama; berhenti total: jalankan `hentikanEmail`.

**Dari screenshot bukti bayar** (tanpa pemasangan): setelah membayar di m-banking/e-wallet/QRIS, screenshot halaman "Berhasil", lalu dari galeri **Bagikan › SatuAtap**. AI membaca nominal, tujuan, dan sumber dana, lalu membuka Catat cepat untuk dicek. Syaratnya aplikasi sudah dipasang di layar utama (Android/Chrome). Setelah pembaruan, ikon SatuAtap bisa butuh beberapa jam sebelum muncul di daftar Bagikan; bila tak kunjung muncul, hapus lalu pasang ulang aplikasi dari browser. Di iPhone, gunakan tombol **+ › Scan › Galeri**.

## Bagian H — Fitur AI (aktif otomatis)

Mulai 1.8.0 fitur AI memakai **AI milik JuniorLabs** lewat relay, jadi pelanggan **tidak perlu memasang apa pun**. Fitur yang memakainya: Tanya AI, scan struk per barang, pemilihan kategori otomatis di Catat cepat, insight mingguan, dan bahan rapat.

- Relay memeriksa lisensi (hanya anggota keluarga berlisensi aktif) dan membatasi jatah per keluarga per hari (`AI_KUOTA_HARIAN`, bawaan 80). Sisa jatah tampil di **Lainnya › Tanya AI**.
- Isi permintaan AI tidak disimpan relay. Yang dikirim hanya **ringkasan angka**; kategori dan catatan uang pribadi tidak dikirim. Foto struk dibaca lalu disimpan hanya di folder Drive keluarga "SatuAtap – Struk".
- Pelanggan yang ingin jatah tak terbatas tetap bisa memakai **kunci Gemini sendiri**: **Lainnya › Tanya AI › ⚙️ › Pakai kunci Gemini sendiri**. Kunci itu hanya disimpan di HP tersebut.

Butuh bantuan? WhatsApp dukungan JuniorLabs **0856-1254-689**, atau gunakan menu **Lainnya › Laporkan Masalah** di aplikasi.

## Bagian I — Penjualan, langganan & masa berlaku (JuniorLabs)

Sejak 1.7.3 lisensi punya **paket** dan **masa berlaku**. Lisensi lama (sebelum 1.7.3) otomatis dianggap **Lifetime**.

**Sekali saja setelah memperbarui relay:**
1. Tempel `Relay.gs` baru → **Deploy › Manage deployments › Edit › Version: New version › Deploy** (URL /exec tetap).
2. Opsional: jalankan `setupRelay()` sekali agar sheet **Pesanan** dan kolom baru Lisensi (`paket, masa, berlakuSampai, nama, wa, maksAkun`) langsung muncul. Tanpa langkah ini pun kolom dibuat otomatis saat pertama dipakai.
3. Buka aplikasi dengan akun superadmin › **Lainnya › Toko & Harga**: isi rekening/e-wallet tujuan transfer, nomor WhatsApp verifikasi, cek harga paket, lalu **Simpan**.

**Alur penjualan:**
1. Pembeli membuka `satuatap.vercel.app/beli/`, memilih paket, mengisi nama, email Google, dan nomor WhatsApp.
2. Halaman menampilkan nomor pesanan, total, dan rekening tujuan. Pembeli transfer, lalu menekan **Verifikasi pembayaran via WhatsApp** dan melampirkan bukti.
3. Di aplikasi: **Lainnya › Pesanan** › buka pesanan › cocokkan nominal › **Lunas & buat kode** (atau **Lunas & perpanjang** untuk pesanan perpanjangan).
4. Tekan **Kirim ke WA pembeli** — pesan berisi kode & langkah aktivasi sudah disiapkan.

**Masa berlaku:**
- Paket 6 bulan / 1 tahun dihitung sejak kode **diaktifkan** (bukan sejak dibeli).
- 14 hari sebelum berakhir, pengingat muncul di Beranda dan menu **Lainnya › Langganan**.
- Setelah berakhir, aplikasi menjadi **baca-saja**: data tetap bisa dilihat dan diunduh, catatan baru tidak bisa ditambah, dan fitur relay (Telegram, ringkasan) berhenti.
- Perpanjangan menambah masa dari tanggal berakhir (atau dari hari ini bila sudah lewat). Bisa lewat halaman beli (`/beli/?perpanjang=KODE`), kode perpanjangan yang dimasukkan di **Langganan**, atau langsung oleh superadmin (**Konsol › Lisensi › buka › +6 bln / +12 bln / Jadikan Lifetime**).

**Semua pengaturan pelanggan di Konsol:** nama & WhatsApp pelanggan, paket, tanggal berlaku (kosong = selamanya), batas akun keluarga (1–20), nama keluarga, catatan, cabut/pulihkan, lepas ikatan, serta tombol **Ingatkan perpanjang** via WhatsApp.

## Catatan 1.7.4 — landing page berbasis video demo
Halaman beli (`/beli/`) sekarang memakai 6 klip rekaman asli aplikasi di folder `beli/vid/` (mp4 + poster jpg, total ±2 MB). Klip dimuat malas dan diputar otomatis saat terlihat. Folder ini ikut ter-upload ke GitHub bersama frontend; tidak perlu perubahan Relay. Jangan menimpa `js/config.js` saat memperbarui.
