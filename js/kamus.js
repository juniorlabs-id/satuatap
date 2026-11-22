/* ============================================================
 * Kamus kategori — kata kunci barang/aktivitas → kategori keluarga.
 * Dipakai oleh catat cepat (teks & suara), scan struk per barang, dan
 * sebagai petunjuk untuk AI. Urutan penting: frasa yang lebih spesifik
 * di atas (mis. "cuci motor" sebelum "cuci", "sabun mandi" sebelum "sabun").
 * Setiap jenis punya daftar pola NAMA KATEGORI keluarga (prioritas kiri→kanan),
 * jadi tetap bekerja walau keluarga memakai nama kategori sendiri.
 * ============================================================ */
(function () {
  const J = [
    // ---------- kendaraan & transportasi ----------
    { id: 'kendaraan', ket: 'servis & perawatan kendaraan', kat: [/kendaraan|otomotif|servis/i, /transport/i],
      kata: 'cuci motor|cuci mobil|salon mobil|servis motor|servis mobil|service motor|service mobil|ganti oli|oli mesin|oli|tambal ban|ban dalam|ban luar|ganti ban|aki|spare ?part|sparepart|bengkel|kampas rem|busi|stnk|pajak motor|pajak mobil|samsat|sim |perpanjang sim|helm|jas hujan|kunci motor|rantai motor|spion|wiper|ac mobil|tune ?up|spooring|balancing|parkir bulanan' },
    { id: 'transport', ket: 'bensin, parkir, tol, ojek', kat: [/transport/i, /kendaraan|bensin/i],
      kata: 'bensin|bbm|pertalite|pertamax|pertamina|solar|dexlite|shell|vivo|bp akr|spbu|isi bensin|parkir|tol|e-?toll|flazz|kartu tol|gojek|goride|gocar|grab|grabbike|grabcar|maxim|indriver|in ?drive|ojek|ojol|taksi|taxi|bluebird|blue bird|angkot|bus|busway|transjakarta|tije|krl|commuter|mrt|lrt|kereta|kai|whoosh|tiket kereta|travel|damri|ongkos|transport|uber|becak|bajaj|kapal|ferry|penyeberangan|pesawat|tiket pesawat' },
    // ---------- makan ----------
    { id: 'bayi', ket: 'kebutuhan bayi & balita', kat: [/bayi|balita|si kecil|kebutuhan anak|perlengkapan anak/i, /dapur|rumah/i],
      kata: 'popok|pampers|diapers|mamy ?poko|merries|sweety|susu formula|sgm|bebelac|dancow 1|lactogen|morinaga|chil|nutrilon|bebelove|bubur bayi|mpasi|biskuit bayi|tisu basah bayi|minyak telon|bedak bayi|sabun bayi|baby|botol susu|dot bayi' },
    { id: 'makan', ket: 'makan di luar / pesan antar', kat: [/makan/i, /kuliner|resto|konsumsi/i],
      kata: 'makan|makan siang|makan malam|sarapan|lunch|dinner|breakfast|soto|bakso|mie ayam|mi ayam|nasi goreng|nasgor|nasi padang|padang|warteg|warung makan|rumah makan|resto|restoran|ayam goreng|ayam geprek|geprek|ayam bakar|pecel|pecel lele|lalapan|penyetan|sate|gule|gulai|rawon|rendang|gado ?gado|ketoprak|lontong|ketupat|bubur ayam|bubur|siomay|batagor|pempek|seblak|mie|bakmi|kwetiau|capcay|nasi uduk|nasi kuning|nasi campur|nasi kotak|nasi bungkus|tumpeng|katering|catering|gudeg|kfc|mcd|mcdonald|burger king|hokben|yoshinoya|richeese|solaria|pizza|pizza hut|domino|sushi|ramen|dimsum|steak|shabu|yakiniku|bebek|iga|sop|sup|tongseng|coto|konro|gofood|grabfood|shopeefood|go-?food|lauk|nasi' },
    { id: 'jajan', ket: 'jajan, kopi, camilan', kat: [/jajan|kafe|cafe|kopi|camilan|snack/i, /makan/i],
      kata: 'kopi|coffee|kafe|cafe|starbucks|janji jiwa|kopi kenangan|fore|tomoro|point coffee|es teh|teh manis|boba|chatime|mixue|es krim|ice cream|martabak|terang bulan|gorengan|cilok|cireng|batagor|roti bakar|donat|dunkin|jco|kue|cake|bolu|camilan|cemilan|snack|keripik|kripik|chiki|cokelat|coklat|permen|wafer|biskuit|minuman|air mineral|aqua|le minerale|minum|jus|juice|es buah|es campur|thai tea|milo|kopi susu|jajan|dessert|pudding|puding|cimol|seblak kering|makaroni' },
    { id: 'dapur', ket: 'bahan masak & belanja dapur', kat: [/dapur|bahan masak|groceries|sembako|belanja bulanan|belanja rumah/i, /makan/i],
      kata: 'sayur|sayuran|bayam|kangkung|sawi|wortel|kentang|tomat|cabai|cabe|bawang|bawang merah|bawang putih|jahe|kunyit|lengkuas|serai|daun|buah|apel|jeruk|pisang|mangga|semangka|melon|pepaya|anggur|alpukat|beras|minyak goreng|minyak|gula|garam|tepung|terigu|telur|telor|daging|daging sapi|dag\\.? sapi|ayam potong|ikan|udang|cumi|tahu|tempe|kecap|saos|saus|sambal|bumbu|royco|masako|penyedap|mie instan|indomie|sarimi|mi instan|susu|susu uht|uht|keju|mentega|margarin|blue band|roti|roti tawar|sereal|oat|kopi bubuk|kopi arabika|teh celup|sirup|santan|kornet|sarden|nugget|sosis|frozen|galon|isi ulang galon|elpiji|gas 3 ?kg|gas melon|pasar|superindo|hypermart|indomaret|alfamart|alfamidi|lawson|family ?mart|circle ?k|7-eleven|minimarket|swalayan|supermarket|toko kelontong|kelontong|grosir|transmart|lotte mart|giant|hero|ranch market|farmers market|sayurbox|segari|tukang sayur|belanja dapur|groceries|sembako' },
    // ---------- rumah ----------
    { id: 'perawatanDiri', ket: 'sabun mandi, sampo, pasta gigi, skincare', kat: [/perawatan diri|perawatan tubuh|toiletries|kecantikan|personal care/i, /rumah ?& ?perawatan|perawatan/i, /belanja pribadi|pribadi/i, /rumah/i],
      kata: 'sabun mandi|sabun cair mandi|body wash|sampo|shampo|shampoo|kondisioner|conditioner|pasta gigi|odol|pepsodent|sikat gigi|obat kumur|listerine|deodoran|deodorant|parfum|minyak wangi|cologne|skincare|skin care|serum|toner|moisturizer|pelembab|sunscreen|sunblock|facial wash|sabun muka|cuci muka|masker wajah|lotion|handbody|body lotion|bedak|lipstik|lip balm|makeup|make up|maskara|cushion|foundation|kosmetik|pembalut|softex|laurier|charm|cukur|silet|gillette|pisau cukur|kapas|cotton bud|tisu wajah|tissue wajah|sisir|potong rambut|pangkas rambut|barbershop|barber|salon|creambath|sabun' },
    { id: 'rumah', ket: 'kebutuhan & perawatan rumah', kat: [/kebutuhan rumah|rumah tangga|rumah ?& ?perawatan|perlengkapan rumah/i, /rumah/i, /dapur/i],
      kata: 'kntg belanja|ktg belanja|kresek|plastik belanja|sabun cuci piring|sunlight|mama lemon|deterjen|detergen|rinso|attack|so klin|daia|pewangi|molto|downy|pelembut pakaian|softener|pemutih|bayclin|pembersih lantai|super pel|wipol|karbol|vixal|harpic|pembersih kaca|sabun cuci|cuci piring|spons|sponge|kain lap|lap|sapu|pel|alat pel|ember|tempat sampah|kantong sampah|plastik sampah|kantong plastik|kantong belanja|kantong|tas belanja|tisu|tissue|tisu gulung|tisu toilet|baterai|batre|lampu|bohlam|led|stop kontak|kabel|colokan|obat nyamuk|baygon|hit|autan|kapur barus|pengharum ruangan|stella|glade|korek|lilin|sikat|gantungan|hanger|jemuran|setrika|laundry|binatu|tukang|servis ac|cuci ac|sedot wc|ledeng|pipa|cat tembok|semen|paku|renovasi|perabot|furnitur|kasur|bantal|seprai|sprei|gorden|keset|piring|gelas|panci|wajan|alat masak|rice cooker|kompor|galon kosong|air isi ulang' },
    // ---------- tagihan ----------
    { id: 'pulsa', ket: 'pulsa & paket data', kat: [/pulsa|kuota|komunikasi|telepon/i, /internet|listrik/i],
      kata: 'pulsa|paket data|kuota|token pulsa|telkomsel|tsel|indosat|im3|xl|axis|tri|smartfren|by\\.u|byu|isat' },
    { id: 'tagihan', ket: 'listrik, air, internet, gas', kat: [/listrik|internet|utilitas|tagihan|air/i],
      kata: 'listrik|pln|token listrik|token pln|pdam|tagihan air|air pam|internet|wifi|wi-fi|indihome|biznet|first ?media|myrepublic|iconnet|xl home|cbn|tv kabel|pgn|gas pgn|ipl|iuran pengelolaan' },
    // ---------- keluarga ----------
    { id: 'pendidikan', ket: 'sekolah, les, buku', kat: [/pendidikan|sekolah|anak/i],
      kata: 'spp|uang sekolah|sekolah|daftar ulang|uang gedung|les|bimbel|kursus|privat|tpq|tpa|mengaji|ngaji|buku tulis|buku pelajaran|lks|seragam|alat tulis|atk|pensil|pulpen|pena|penghapus|penggaris|crayon|krayon|tas sekolah|sepatu sekolah|study tour|wisuda|uang kegiatan|kuliah|ukt|semester|skripsi|fotokopi|print|jilid|buku' },
    { id: 'kesehatan', ket: 'obat, dokter, vitamin', kat: [/kesehatan|medis|obat/i],
      kata: 'obat|apotek|apotik|kimia farma|k-?24|guardian|century|watson|dokter|klinik|puskesmas|rumah sakit|rs |bidan|praktek|periksa|cek darah|lab|laboratorium|vitamin|suplemen|paracetamol|panadol|bodrex|promag|tolak angin|antangin|minyak kayu putih|betadine|hansaplast|plester|masker|hand sanitizer|imunisasi|vaksin|gigi|dokter gigi|kacamata|optik|lensa kontak|bpjs kesehatan|terapi|fisioterapi|pijat|urut|halodoc|alodokter' },
    { id: 'pakaian', ket: 'pakaian & belanja pribadi', kat: [/pakaian|busana|fashion|baju/i, /belanja pribadi|pribadi/i, /belanja/i],
      kata: 'pakaian|busana|fashion|alas kaki|baju|kaos|kemeja|celana|rok|gamis|jilbab|hijab|kerudung|mukena|sarung|jaket|sweater|hoodie|dress|daster|piyama|pakaian dalam|kaus kaki|sepatu|sandal|sendal|tas|dompet|ikat pinggang|jam tangan|aksesoris|perhiasan imitasi|uniqlo|h&m|zara|matahari|shopee|tokopedia|lazada|tiktok shop|blibli|zalora|online shop|olshop|gadget|hp baru|casing|charger|earphone|headset|powerbank' },
    { id: 'hiburan', ket: 'hiburan, langganan, rekreasi', kat: [/hiburan|langganan|rekreasi|hobi/i, /jajan/i],
      kata: 'gym|membership gym|fitness|netflix|spotify|youtube premium|disney|hotstar|vidio|viu|wetv|iqiyi|prime video|apple music|icloud|google one|canva|chatgpt|langganan|bioskop|xxi|cgv|cinepolis|nonton|tiket konser|konser|karaoke|game|top up game|voucher game|steam|playstation|diamond|mobile legends|free fire|rekreasi|wisata|kebun binatang|taman|dufan|ancol|kolam renang|renang|gym|fitness|futsal|badminton|bulu tangkis|sewa lapangan|hobi|mainan|lego|buku novel|komik|liburan|hotel|villa|penginapan|airbnb|traveloka|tiket\\.com|agoda' },
    { id: 'sosial', ket: 'iuran, arisan, kondangan, hadiah', kat: [/iuran|sosial|arisan|kondangan|hadiah|kado/i, /sedekah/i],
      kata: 'iuran|iuran rt|iuran rw|uang keamanan|satpam|kebersihan|sampah bulanan|arisan|kondangan|nikahan|amplop nikah|sumbangan|takziah|melayat|hajatan|kado|hadiah|ulang tahun|ultah|traktir|oleh-?oleh|bingkisan|parsel|hampers|lebaran|thr anak|angpao|angpau|kurban|qurban' },
    { id: 'sedekah', ket: 'sedekah, infak, zakat', kat: [/sedekah|zakat|infak|amal|donasi/i, /sosial/i],
      kata: 'sedekah|infak|infaq|zakat|fidyah|wakaf|donasi|amal|kotak amal|masjid|musala|mushola|gereja|kolekte|perpuluhan|persembahan|panti asuhan|yatim|kitabisa|dompet dhuafa|baznas|laziz' },
    { id: 'hewan', ket: 'hewan peliharaan', kat: [/hewan|peliharaan|kucing|anjing|pet/i, /lainnya/i],
      kata: 'makanan kucing|whiskas|me-?o|royal canin|pasir kucing|cat food|dog food|grooming|vet|dokter hewan|petshop|pet shop|kandang|pakan ikan|pakan burung' },
    { id: 'cicilan', ket: 'cicilan & utang', kat: [/cicilan|utang|kredit|pinjaman/i],
      kata: 'cicilan|angsuran|kpr|kredit|kartu kredit|paylater|spaylater|kredivo|akulaku|home credit|leasing|adira|fif|bayar utang|pinjol|pinjaman' },
    { id: 'admin', ket: 'biaya admin & bank', kat: [/biaya admin|admin|bank/i],
      kata: 'biaya admin|admin bank|biaya transfer|transfer fee|bunga kartu|materai|meterai|denda' },
    { id: 'asuransi', ket: 'asuransi & pajak', kat: [/asuransi|proteksi/i, /pajak/i, /lainnya/i],
      kata: 'asuransi|premi|prudential|allianz|manulife|axa|bpjs ketenagakerjaan|pajak|pbb|pph|e-?filing' }
  ];
  const MASUK = [
    { id: 'gaji', kat: [/^gaji|penghasilan tetap|gaji/i], kata: 'gaji|gajian|salary|tunjangan|tukin|tunjangan kinerja|honor|honorarium|upah|insentif' },
    { id: 'bonus', kat: [/bonus|thr/i, /pemasukan lain|lain/i], kata: 'bonus|thr|komisi|jasa medis|jaspel|rapel' },
    { id: 'usaha', kat: [/usaha|sampingan|bisnis|dagang|jualan/i, /pemasukan lain|lain/i], kata: 'jualan|dagangan|penjualan|omzet|untung|laba|usaha|freelance|proyek|project|endorse|affiliate|komisi shopee' },
    { id: 'lain', kat: [/pemasukan lain|lain/i], kata: 'refund|cashback|kembalian|hadiah|transfer masuk|kiriman|dikasih|dikirimi|bunga tabungan|bagi hasil|dividen|jual barang' }
  ];
  // pola kata → RegExp (batas kata di kiri & kanan, frasa diizinkan)
  const rx = s => new RegExp('(^|[^a-z0-9])(' + s + ')(?=$|[^a-z0-9])', 'i');
  J.concat(MASUK).forEach(j => { j.re = rx(j.kata); });

  const bersih = t => String(t || '').toLowerCase().replace(/[_]/g, ' ').replace(/\s+/g, ' ');
  /** Jenis barang/aktivitas dari teks → id jenis (mis. 'rumah'), atau ''. */
  function jenisDari(teks, arah) {
    const s = ' ' + bersih(teks) + ' ', list = arah === 'masuk' ? MASUK : J;
    // ambil kecocokan TERPANJANG (frasa spesifik menang), bila sama panjang yang lebih dulu di daftar
    let best = null, len = 0;
    list.forEach(j => { const m = j.re.exec(s); if (m && m[2].length > len) { best = j; len = m[2].length; } });
    return best;
  }
  /** Cari kategori keluarga untuk satu jenis (mengikuti nama kategori yang dipakai keluarga). */
  function kategoriUntuk(j, arah) {
    if (!j || !window.Store) return null;
    const kats = Store.kategori(arah === 'masuk' ? 'masuk' : 'keluar').filter(k => !k.arsip);
    for (const re of j.kat) { const k = kats.find(x => re.test(x.nama)); if (k) return k; }
    return null;
  }
  const K = {
    JENIS: J, MASUK,
    /** Teks bebas ("cuci motor", "SAMPO ANTI KETOMBE 340ML") → kategoriId keluarga, atau ''. */
    tebak(teks, arah) { const k = kategoriUntuk(jenisDari(teks, arah), arah); return k ? k.id : ''; },
    jenis: jenisDari,
    /** Petunjuk untuk AI: kategori keluarga → contoh barang yang masuk ke sana. */
    petunjuk(arah) {
      const peta = {};
      (arah === 'masuk' ? MASUK : J).forEach(j => { const k = kategoriUntuk(j, arah); if (!k) return; (peta[k.nama] = peta[k.nama] || []).push(j.kata.split('|').filter(w => !/[\\?]/.test(w)).slice(0, 9).join(', ')); });
      return Object.keys(peta).map(n => '- ' + n + ': ' + peta[n].join(', ')).join('\n');
    }
  };
  window.Kamus = K;
})();
