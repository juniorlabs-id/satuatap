/* Catat pakai suara — Web Speech API + pembaca kalimat bahasa Indonesia.
 * Contoh: "makan siang empat puluh lima ribu gopay", "bensin 50rb tunai", "gaji masuk 13,5 juta mandiri" */
(function () {
  const ANGKA = { nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10, sebelas: 11, seratus: 100, seribu: 1000, sejuta: 1e6, setengah: 0.5 };
  const KATA_KAT = [
    [/makan|soto|bakso|nasi|warteg|padang|ayam|mie|sate|siang|malam|sarapan|resto|gofood|grabfood|gudeg|pecel|rawon|gado|seblak|lontong|ketoprak|bakmi|pempek|geprek|kfc|mcd|burger|pizza|warung|lauk|nasgor|bubur|siomay|batagor|dimsum|sushi|ramen|lalapan|penyetan|shopeefood/, /makan/i],
    [/sayur|dapur|superindo|alfamart|indomaret|pasar|beras|minyak|telur|groceries|belanja bulanan/, /dapur/i],
    [/bensin|pertamax|pertalite|parkir|tol|gojek|grab|ojek|transport|taksi|kereta|krl|busway/, /transport/i],
    [/kopi|kafe|cafe|jajan|martabak|boba|snack|es teh|cemilan/, /jajan/i],
    [/listrik|pln|air|pdam|internet|wifi|indihome|pulsa|kuota/, /listrik|internet/i],
    [/spp|sekolah|les|kursus|buku|seragam/, /pendidikan/i],
    [/obat|apotek|dokter|klinik|vitamin|rumah sakit/, /kesehatan/i],
    [/netflix|spotify|youtube|bioskop|nonton|game|langganan/, /hiburan/i],
    [/sedekah|infaq|infak|zakat|donasi/, /sedekah/i],
    [/baju|sepatu|shopee|tokopedia|lazada|skincare/, /belanja/i],
    [/iuran|arisan|kondangan|rt/, /iuran/i],
    [/cicilan|kpr|kredit|paylater/, /cicilan/i],
    [/gaji|salary/, /^gaji/i], [/bonus|thr/, /bonus/i]
  ];
  const MASUK = /\b(gaji|terima|diterima|dapat|masuk|pemasukan|bonus|thr|transferan masuk)\b/;

  function wordsToNumber(words) {
    // gabungan seperti "empat puluh lima ribu", "satu koma lima juta", "dua ratus lima puluh ribu"
    let total = 0, cur = 0, found = false, dec = null;
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === 'koma') { dec = ''; continue; }
      let v = ANGKA[w];
      if (dec !== null && v !== undefined && v < 10) { dec += String(v); found = true; continue; }
      if (w === 'belas') { cur += 10; found = true; continue; }
      if (w === 'puluh') { cur = (cur % 10 || 1) * 10 + Math.floor(cur / 10) * 10 - (cur % 10 ? 0 : 0); found = true; continue; }
      if (w === 'ratus') { cur = (cur || 1) * 100; found = true; continue; }
      if (w === 'ribu' || w === 'rb' || w === 'k') { cur = (cur || 1) + (dec ? Number('0.' + dec) : 0); dec = null; total += cur * 1000; cur = 0; found = true; continue; }
      if (w === 'juta' || w === 'jt') { cur = (cur || 1) + (dec ? Number('0.' + dec) : 0); dec = null; total += cur * 1e6; cur = 0; found = true; continue; }
      if (v !== undefined) {
        if (v === 1000 || v === 1e6) { total += v; cur = 0; found = true; continue; }
        if (v === 100) { cur += 100; found = true; continue; }
        cur += v; found = true; continue;
      }
      if (found) break;
    }
    return found ? Math.round(total + cur) : 0;
  }

  /** Ubah kalimat menjadi {jenis, jumlah, kategoriId, walletId, catatan}. */
  function parse(text) {
    const raw = String(text || '').toLowerCase().trim();
    let s = raw.replace(/rp\.?/g, ' ').replace(/(\d)\.(?=\d{3}\b)/g, '$1').replace(/,/g, '.').replace(/\s+/g, ' ');
    let jumlah = 0;
    // angka digit + satuan: 45rb, 45 ribu, 1.5jt, 1.5 juta, 45k, 45000
    const m = s.match(/(\d+(?:\.\d+)?)\s*(rb|ribu|k|jt|juta)?\b/);
    if (m) {
      const v = Number(m[1]), u = m[2];
      jumlah = u === 'jt' || u === 'juta' ? v * 1e6 : u ? v * 1000 : v;
    }
    if (!jumlah) {
      const words = s.replace(/[^a-z\s]/g, ' ').split(' ').filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        if (ANGKA[words[i]] !== undefined) { jumlah = wordsToNumber(words.slice(i)); if (jumlah) break; }
      }
    }
    const jenis = MASUK.test(s) ? 'masuk' : 'keluar';
    // kategori
    let kategoriId = '';
    const kats = Store.kategori(jenis);
    // kata yang pernah dipilihkan kategorinya oleh pengguna (belajar dari koreksi)
    const ajar = V.ajaran(); s.split(/[^a-z]+/).some(w => { const id = w.length >= 3 && ajar[w]; if (id && kats.some(k => k.id === id)) { kategoriId = id; return true; } return false; });
    if (!kategoriId)
    for (const [re, katRe] of KATA_KAT) { if (kategoriId) break; if (re.test(s)) { const k = kats.find(x => katRe.test(x.nama)); if (k) { kategoriId = k.id; break; } } }
    if (!kategoriId) { const k = kats.find(x => s.includes(x.nama.toLowerCase().split(' ')[0])); if (k) kategoriId = k.id; }
    // wallet: cocokkan kata unik nama wallet
    let walletId = '';
    const alias = { tunai: /tunai|cash|kontan|dompet/, ovo: /ovo/, gopay: /gopay|go pay/, dana: /\bdana\b/, shopeepay: /shopee ?pay/ };
    for (const w of Store.wallets()) {
      const nm = w.nama.toLowerCase(), tokens = nm.split(/\s+/).filter(t => t.length >= 3 && !/^(bank|rekening|bersama|tabungan|gaji|rumah)$/.test(t));
      if (tokens.some(t => s.includes(t))) { walletId = w.id; break; }
      for (const k in alias) if (nm.includes(k) && alias[k].test(s)) { walletId = w.id; break; }
      if (!walletId && w.jenis === 'tunai' && alias.tunai.test(s)) walletId = w.id;
      if (walletId) break;
    }
    // catatan: kalimat tanpa angka & nama wallet
    let catatan = raw.replace(/(\d+(?:[.,]\d+)?)\s*(rb|ribu|k|jt|juta)?/g, '').replace(/\b(nol|satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|seratus|seribu|sejuta|belas|puluh|ratus|ribu|juta|rupiah|koma)\b/g, '');
    if (walletId) { const wn = Store.byId.Wallet[walletId].nama.toLowerCase().split(/\s+/); wn.forEach(t => { if (t.length >= 3) catatan = catatan.replace(new RegExp('\\b' + t + '\\b', 'g'), ''); }); catatan = catatan.replace(/\b(pakai|pake|dari|via|lewat)\b/g, ''); }
    catatan = catatan.replace(/\s+/g, ' ').trim();
    catatan = catatan ? catatan[0].toUpperCase() + catatan.slice(1) : '';
    return { jenis, jumlah: Math.round(jumlah), kategoriId, walletId, catatan, raw: text };
  }

  /** Pecah satu kalimat berisi beberapa catatan: "gudeg 45 ribu tunai dan bensin 50 ribu gopay". */
  function parseBanyak(text) {
    const bag = String(text || '').split(/\s*(?:,|;|\bdan\b|\bterus\b|\blalu\b|\bsama\b|\bkemudian\b)\s*/i).map(x => x.trim()).filter(Boolean);
    const hasil = bag.map(parse).filter(r => r.jumlah);
    return hasil.length > 1 ? hasil : [parse(text)];
  }
  const V = {
    parse, parseBanyak,
    ajaran() { try { return JSON.parse(localStorage.getItem('sa:vkat') || '{}') || {}; } catch (e) { return {}; } },
    /** Ingat: kata-kata di catatan → kategori yang dipilih pengguna. */
    ajari(teks, kategoriId) {
      if (!kategoriId) return; const a = V.ajaran(), stop = /^(dan|yang|untuk|beli|bayar|pakai|pake|dari|via|lewat|tunai|cash|ribu|juta|rupiah|siang|malam|pagi|sore|tadi|buat)$/;
      String(teks || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 4 && !stop.test(w)).slice(0, 3).forEach(w => { a[w] = kategoriId; });
      const k = Object.keys(a); if (k.length > 300) k.slice(0, k.length - 300).forEach(x => delete a[x]);
      try { localStorage.setItem('sa:vkat', JSON.stringify(a)); } catch (e) {}
    },
    supported: () => !!(window.SpeechRecognition || window.webkitSpeechRecognition),
    rec: null,
    start(onPartial, onFinal, onError) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { onError && onError('Browser ini belum mendukung input suara. Coba Chrome di Android.'); return null; }
      const r = new SR();
      r.lang = 'id-ID'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
      let finalText = '';
      r.onresult = e => {
        let t = '';
        for (let i = 0; i < e.results.length; i++) { t += e.results[i][0].transcript; if (e.results[i].isFinal) finalText = t; }
        onPartial && onPartial(t);
      };
      r.onerror = e => { onError && onError(e.error === 'not-allowed' ? 'Izin mikrofon ditolak. Aktifkan di pengaturan browser.' : e.error === 'no-speech' ? 'Tidak terdengar suara. Coba lagi.' : 'Input suara gagal (' + e.error + ').'); };
      r.onend = () => { V.rec = null; onFinal && onFinal(finalText); };
      try { r.start(); V.rec = r; } catch (e) { onError && onError('Tidak bisa memulai mikrofon.'); }
      return r;
    },
    stop() { if (V.rec) try { V.rec.stop(); } catch (e) {} }
  };
  window.Voice = V;
})();
