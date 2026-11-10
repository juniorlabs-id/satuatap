# Panduan Instalasi SatuAtap 1.0

**SatuAtap — Keuangan keluarga, di bawah satu atap.**

SatuAtap terdiri dari dua bagian:

| Bagian | Isi | Dipasang oleh | Berapa kali |
|---|---|---|---|
| **Frontend** (tampilan aplikasi) | `index.html`, `css/`, `js/`, `img/` | JuniorLabs | Sekali, di GitHub Pages, dipakai semua pembeli |
| **Backend** (server + database) | `Kode.gs`, `appsscript.json` | Admin tiap keluarga | Sekali per keluarga, di akun Google keluarga itu |

Data setiap keluarga tersimpan di Google Drive & Google Sheets milik keluarga itu sendiri. JuniorLabs tidak menyimpan atau bisa melihat data keuangan pembeli.

---

## Bagian A — Untuk JuniorLabs (sekali saja)

### A1. Buat OAuth Client ID untuk "Masuk dengan Google"

Client ID bukan rahasia (memang dipakai di browser). Satu Client ID dipakai bersama oleh semua keluarga.

1. Buka <https://console.cloud.google.com> → buat proyek baru, misal `SatuAtap`.
2. **APIs & Services › OAuth consent screen**
   - User type: **External** → isi nama aplikasi `SatuAtap`, email dukungan, email developer.
   - Scopes: cukup bawaan (`openid`, `email`, `profile`). Jangan tambah scope lain.
   - Selesai, lalu tekan **Publish app** agar status menjadi **In production**. Dengan hanya scope dasar ini, biasanya tidak perlu proses verifikasi Google. Sebaiknya tidak mengunggah logo, karena logo memicu verifikasi merek.
3. **APIs & Services › Credentials › Create credentials › OAuth client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins**: `https://USERNAME.github.io` (alamat GitHub Pages Anda, tanpa garis miring di akhir). Untuk uji lokal boleh tambahkan `http://localhost:8000`.
   - Redirect URI tidak perlu diisi.
4. Salin **Client ID** (berakhiran `.apps.googleusercontent.com`).

### A2. Tanam Client ID ke `Kode.gs` sebelum dibagikan

Buka `Kode.gs`, cari baris ini di bagian atas:

```js
const CLIENT_ID_AWAL = 'GANTI_DENGAN_CLIENT_ID.apps.googleusercontent.com';
```

Ganti dengan Client ID dari A1, lalu simpan. Dengan begitu pembeli tidak perlu mengatur apa pun soal login Google. Kalau lupa, Admin keluarga masih bisa mengisinya nanti dari **Pengaturan › Keamanan** setelah masuk dengan akses darurat.

### A3. Deploy frontend ke GitHub Pages

> **Penting:** folder tempat Anda menjalankan `git init` adalah folder hasil ekstrak ZIP yang **langsung berisi `index.html`**. Jangan menjalankannya di folder di atasnya.

1. Ekstrak `satuatap-frontend.zip`, misal ke `C:\Proyek\satuatap-frontend\`.
2. Buka PowerShell di folder itu: klik address bar File Explorer, ketik `powershell`, tekan Enter.
3. Pastikan isinya benar:
   ```powershell
   dir
   ```
   Harus terlihat `index.html`, `manifest.webmanifest`, `sw.js`, serta folder `css`, `js`, dan `img`. Kalau yang terlihat justru folder lain, Anda berada di folder yang salah. Jangan lanjut sebelum ini benar.
4. Di github.com buat repository baru, misal `satuatap`, dengan pilihan **Public** dan **tanpa** README/.gitignore/license.
5. Jalankan perintah berikut satu per satu:
   ```powershell
   git init
   git add .
   git commit -m "SatuAtap 1.0.0"
   git branch -M main
   git remote add origin https://github.com/USERNAME/satuatap.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (buat di <https://github.com/settings/tokens> → classic → centang `repo`). Saat token ditempel, layar memang tidak menampilkan apa-apa. Itu normal.
6. Di repository: **Settings › Pages** → Source **Deploy from a branch**, Branch **main / (root)** → Save. Centang **Enforce HTTPS**.
7. Tunggu 1–2 menit. Aplikasi bisa dibuka di `https://USERNAME.github.io/satuatap/`. Coba dulu dengan tombol **Coba demo**.

**Memperbarui frontend:** ganti file yang berubah, lalu jalankan:

```powershell
git add .
git commit -m "Versi 1.0.1"
git push
```

Naikkan juga `VER` di `sw.js` dan `VERSION` di `js/config.js` agar HP pengguna mengambil versi baru.

---

## Bagian B — Untuk Admin setiap keluarga

Yang dibutuhkan: satu akun Google (Gmail) yang akan menjadi pemilik data keluarga, plus berkas `Kode.gs` dan `appsscript.json` dari JuniorLabs. Waktu yang dibutuhkan sekitar 10 menit.

### B1. Buat proyek Apps Script

1. Masuk ke akun Google keluarga, lalu buka <https://script.google.com> → **Proyek baru**.
2. Ganti nama proyek (klik "Proyek tanpa judul") menjadi `SatuAtap Keluarga`.
3. Klik ⚙️ **Setelan Proyek** → centang **Tampilkan file manifes "appsscript.json" di editor**.
4. Kembali ke **Editor** (ikon `< >`):
   - Buka `appsscript.json` → hapus semua isinya → tempel isi berkas `appsscript.json` dari JuniorLabs.
   - Buka `Kode.gs` → hapus semua isinya → tempel isi berkas `Kode.gs`.
   - Tekan 💾 **Simpan** (Ctrl+S).

### B2. Jalankan setup (sekali)

1. Di toolbar atas, pilih fungsi **`setupAppEnvironment`** lalu tekan **▶ Jalankan**.
2. Google akan meminta izin:
   - **Tinjau izin** → pilih akun Anda.
   - Akan muncul layar **"Google belum memverifikasi aplikasi ini"**. Layar ini selalu muncul untuk skrip pribadi yang Anda pasang sendiri di akun Anda. Skripnya hanya berjalan di akun Anda dan datanya tetap di Drive Anda. Klik **Lanjutan** → **Buka SatuAtap Keluarga (tidak aman)** → **Izinkan**.
   - Izin yang diminta: Spreadsheet & Drive (database), Email (pengingat tagihan), Kalender (sinkron jadwal), dan pemicu harian.
3. Buka **Log eksekusi** di bawah editor dan **catat**:
   - `Nama pengguna : darurat`
   - `Kata sandi : …` ← **hanya tampil sekali.** Simpan di tempat aman. Sandi ini dipakai bila login Google bermasalah.
4. Setup otomatis membuat folder **"SatuAtap – Data Keluarga"** di Drive (berisi spreadsheet database), mendaftarkan email Anda sebagai **Admin**, dan memasang pengingat harian pukul 07.00.

> Setup aman dijalankan ulang. Kunci rahasia dan data yang sudah ada tidak akan ditimpa.

### B3. Deploy sebagai Web App

1. Klik **Terapkan (Deploy) › Deployment baru**.
2. ⚙️ Jenis: **Aplikasi web**.
   - Deskripsi: `SatuAtap 1.0`
   - Jalankan sebagai: **Saya (email Anda)**
   - Yang memiliki akses: **Siapa saja (Anyone)**
3. **Terapkan** → salin **URL aplikasi web** yang berakhiran **`/exec`**.

URL `/exec` ini bukan kata sandi. Semua permintaan tetap harus membawa sesi login yang sah. Meski begitu, bagikan hanya ke anggota keluarga.

### B4. Buka aplikasi & masuk

1. Buka alamat aplikasi dari JuniorLabs (misal `https://juniorlabs.github.io/satuatap/`) di HP.
2. Tempel URL `/exec` → **Hubungkan**. Pertama kali bisa memakan waktu 3–8 detik.
3. Tekan **Masuk dengan Google** memakai email yang sama dengan pemilik Apps Script.
   - Kalau tombol Google belum muncul (Client ID belum diisi): buka **Masuk dengan akses darurat**, masukkan `darurat` dan sandi dari log, lalu isi Client ID di **Lainnya › Keamanan**.
4. Pasang ke layar utama: menu browser › **Tambahkan ke layar utama** / **Instal aplikasi**.

### B5. Lengkapi data awal (5 menit)

1. **Aset › Kas & Bank** → tambahkan rekening, e-wallet, dan tunai beserta saldo hari ini.
2. **Kalender › Tambah Rutin** → gaji (pemasukan), listrik, internet, SPP, langganan, dan tagihan tahunan (pajak kendaraan, PBB, premi).
3. **Lainnya › Anggaran** → tap tiap amplop untuk memberi batas, atau gunakan **Bagi Gaji**.
4. **Lainnya › Tujuan** → mulai dari **Dana Darurat**. Tentukan rekening penyimpanannya bila ada.
5. **Lainnya › Pengaturan › Keluarga** → bila gajian tanggal 25, ubah "periode dimulai" menjadi 25.

### B6. Undang pasangan & anggota (maks. 5 akun)

1. **Lainnya › Anggota & Izin › Undang anggota** → isi nama, email Google, dan peran:
   - **Pasangan**: akses penuh, kecuali mengelola anggota.
   - **Anggota**: izin per menu (Tidak/Lihat/Ubah), dan selalu bisa mencatat transaksinya sendiri.
2. Tekan **Salin tautan** / **Kirim via WA**. Anggota cukup membuka tautan itu lalu **Masuk dengan Google**.
3. Agar pasangan juga melihat jadwal di Google Calendar: aktifkan **Pengaturan › Notifikasi › Sinkron ke Google Calendar**, lalu di Google Calendar Admin bagikan kalender **"Keuangan …"** ke email pasangan.

### B7. Amankan akses darurat

Masuk ke **Lainnya › Keamanan › Ganti sandi darurat**, lalu buat sandi baru (minimal 12 karakter, berisi huruf dan angka). Sandi awal di log eksekusi otomatis tidak berlaku lagi.

Lupa sandi darurat? Di editor Apps Script jalankan fungsi `resetAksesDarurat`, lalu lihat sandi baru di log.

---

## Bagian C — Memperbarui backend ke versi baru

1. Tempel `Kode.gs` versi baru (ganti semua isi) → Simpan.
2. **Terapkan › Kelola deployment** → ikon ✏️ pada deployment yang ada → **Versi: Versi baru** → **Terapkan**.

Dengan cara ini **URL `/exec` tetap sama**, jadi anggota tidak perlu mengatur ulang. Jangan memakai "Deployment baru" karena itu menghasilkan URL berbeda.

---

## Bagian D — Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| "Server membalas tidak terduga" saat Hubungkan | URL salah atau akses deployment bukan **Anyone**. Pastikan URL berakhiran `/exec` dan akses = Siapa saja. |
| "Backend belum di-setup" | `setupAppEnvironment` belum dijalankan sampai selesai. Jalankan ulang (B2). |
| "Email … belum terdaftar di keluarga ini" | Email Google belum diundang. Admin perlu menambahkannya di Anggota & Izin. |
| "Token Google bukan untuk aplikasi ini" | Client ID di backend berbeda dengan yang diizinkan untuk alamat GitHub Pages. Periksa A1 & A2. |
| Tombol Google tidak muncul | Client ID belum diisi. Masuk dengan akses darurat → Keamanan → isi Client ID. |
| Perubahan dari HP pasangan belum muncul | Sinkron otomatis berjalan tiap 1 menit dan setiap aplikasi dibuka. Paksa lewat **Pengaturan › Data & Sinkron › Sinkron sekarang**. |
| Email pengingat tidak datang | Pastikan **Notifikasi email** aktif. Cek folder Spam. Kuota Gmail gratis ±100 email/hari. Uji lewat tombol **Kirim/sinkron sekarang**. |
| Tampilan masih versi lama | Tutup lalu buka ulang aplikasi dua kali, atau tekan Ctrl+Shift+R di laptop. |
| Saldo tidak cocok dengan bank | **Aset › Kas & Bank › (dompet) › Cocokkan saldo**. Selisihnya dicatat sebagai penyesuaian. |

---

## Bagian E — Catatan teknis & keamanan

- **Cepat walau data banyak:** aplikasi menyimpan salinan data di perangkat (IndexedDB) sehingga langsung tampil. Perubahan diterapkan seketika lalu dikirim ke server di latar belakang. Sinkron hanya mengambil baris yang berubah. Daftar mutasi dimuat bertahap. Dalam uji dengan ±19.000 transaksi, setiap halaman tampil di bawah 100 ms.
- **Offline:** pencatatan tetap bisa dilakukan saat sinyal hilang. Antrean dikirim otomatis saat online, dan permintaan yang terulang tidak akan tercatat ganda.
- **Rahasia** (kunci sesi, sandi darurat dalam bentuk hash, Client ID, kunci AI) hanya disimpan di **Script Properties**. Tidak ada di kode frontend, spreadsheet, maupun log.
- Jangan menambahkan editor lain ke proyek Apps Script. Editor proyek bisa melihat Script Properties.
- Rumus yang diawali `=`, `+`, `-`, `@` dinetralkan sebelum masuk ke Sheets.
- **Uang pribadi:** catatan transaksi di kategori pribadi disamarkan oleh server untuk anggota lain. Totalnya tetap terhitung di ringkasan keluarga.

Butuh bantuan? WhatsApp dukungan JuniorLabs: **0856-1254-689**, atau gunakan menu **Lainnya › Laporkan Masalah** di aplikasi.
