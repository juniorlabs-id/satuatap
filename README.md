# SatuAtap — Keuangan Keluarga · v1.2.0

*Keuangan keluarga, di bawah satu atap.* Dibuat oleh **JuniorLabs**.

Aplikasi web (PWA) untuk keuangan keluarga. Aplikasi berjalan di GitHub Pages dan menyimpan data langsung ke Google Sheets di Drive keluarga lewat izin `drive.file`. Pembeli tidak perlu memasang Apps Script dan tidak melihat layar "aplikasi belum diverifikasi". Relay JuniorLabs hanya mengurus lisensi, penukaran token (agar sinkron otomatis), email ringkasan bulanan, dan laporan masalah. Cara pemasangan ada di **PANDUAN-INSTALASI.md**.

## Isi folder

```
index.html            kerangka aplikasi
oauth.html            halaman kembali setelah login Google
manifest.webmanifest  PWA (bisa dipasang ke layar utama)
sw.js                 service worker (buka instan, bisa offline)
css/style.css         sistem desain (terang & gelap)
img/                  ikon & logo
js/config.js          konfigurasi publik: Client ID, API key Picker, nomor proyek, URL relay
js/util.js            format rupiah, tanggal, Hijriah
js/store.js           data lokal (IndexedDB), antrean offline, sinkron log
js/gapi.js            login Google (token drive.file) + pemanggil REST Drive/Sheets
js/cloud.js           file keluarga: log tambah-baris, cek versi, berbagi, Picker, tabel cermin
js/priv.js            enkripsi catatan uang pribadi dengan PIN (AES-GCM)
js/api.js             klien relay JuniorLabs (lisensi, ringkasan, laporan)
js/calc.js            semua hitungan keuangan (dimemo per versi data)
js/charts.js          grafik SVG ringan
js/voice.js           catat pakai suara (Bahasa Indonesia)
js/demo.js            mode demo + data contoh (?demo, ?demo=big)
js/ui.js              router, kerangka, lembar bawah, komponen
js/pages/*.js         halaman: beranda, mutasi/catat, kalender, aset, anggaran, tujuan, utang, rapor, lainnya
js/app.js             login, sesi, sinkron latar belakang
```

Berkas Apps Script (`Relay.gs`, `Pendamping.gs`, serta manifesnya) **sengaja tidak disertakan** di sini dan diberikan terpisah.

## Fitur versi 1.0 (Fase 1)

- **Beranda:** total kas, uang aman dibelanjakan per hari, hitung mundur gajian, Siaga Dana, draf tagihan, amplop kritis, dan tujuan.
- **Mutasi & Catat Cepat:** keypad kalkulator, template, kategori pintar, transfer + biaya admin, pecah struk, patungan → piutang, input suara (tahan tombol +), geser baris (kanan = konfirmasi tagihan rutin, kiri = ubah/hapus, tombol ⋮ sebagai cadangan), riwayat edit, ekspor CSV.
- **Kalender:** kalender bulanan + Hijriah + libur, arus kas & proyeksi saldo 30/60/90 hari, musim mahal 12 bulan, tagihan & langganan (tinjau tiap 3 bulan), rekor tepat waktu, acara, bayar/sebagian/tunda, email pengingat H-7/H-3/H-1/H, sinkron Google Calendar satu arah.
- **Anggaran:** amplop per kategori, peringatan 80/100%, sisa dibawa, seret dana antar amplop, bagi gaji (50/30/20), "setiap rupiah punya tugas", tagihan tahunan dicicil, uang pribadi suami/istri.
- **Tujuan:** template, kalkulator, **setor langsung dari dompet sehingga saldo dompet otomatis berkurang** (bisa disimpan di rekening tabungan tertentu), ambil dana, checklist setoran per anggota, simulasi, dan perayaan 25/50/75/100%.
- **Utang & Piutang:** cicilan flat/anuitas, rasio cicilan, strategi Avalanche/Snowball, simulasi cicilan & KPR, tagih via WhatsApp.
- **Aset:** kekayaan bersih, kas & bank, cocokkan saldo.
- **Rapor:** ringkasan, rincian, perbandingan, rasio & skor kesehatan, tren 12 bulan, rapor PDF, dan Excel (CSV).
- **Arsitektur relay:** masuk dengan Google, buat atau gabung keluarga lewat Google Picker, aktivasi lisensi, sinkron beberapa HP bersamaan, PIN uang pribadi, email ringkasan bulanan, sinkron otomatis tanpa ketuk (kunci perpanjangan tersegel disimpan di HP), dan Skrip Pendamping opsional untuk Google Calendar. Pengingat tagihan hanya tampil di dalam aplikasi.
- **Lainnya:** anggota & izin per menu (maks. 5), kategori, template, tema gelap, notifikasi, keamanan, cadangan JSON, laporkan masalah/usul fitur.

## Belum termasuk (ditandai "Segera" di aplikasi)

- Fase 2: Brankas Emas, saham/reksa dana/SBN/properti, Zakat, target alokasi, ringkasan SPT.
- Fase 3: AI Gemini, Rapat Keuangan, Simulasi Keputusan Besar, Kilas Balik, impor CSV.
- Input via bot Telegram/WhatsApp dan Bahasa Inggris.

## Uji cepat

Buka `index.html?demo` untuk data contoh, atau `?demo=big` untuk ±19.000 transaksi (uji kecepatan).
