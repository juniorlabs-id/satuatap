/* ============================================================
 * AI — Gemini dengan kunci API milik keluarga (R-06, R-07, T-11, M-05)
 *  - Kunci disimpan HANYA di perangkat ini (localStorage per akun),
 *    tidak di spreadsheet, tidak lewat server JuniorLabs.
 *  - Angka dihitung aplikasi; Gemini hanya merangkai kalimat.
 *  - Yang dikirim: ringkasan angka (tanpa catatan transaksi, tanpa kategori pribadi).
 * ============================================================ */
(function () {
  const API = 'https://generativelanguage.googleapis.com/v1beta';
  const CADANGAN = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest'];
  const kunciLS = () => 'sa:ai:' + ((Store.me && Store.me.email) || 'anon');
  const AI = {};
  AI.cfg = () => { try { return JSON.parse(localStorage.getItem(kunciLS()) || 'null') || {}; } catch (e) { return {}; } };
  AI.simpanCfg = c => { try { localStorage.setItem(kunciLS(), JSON.stringify(c)); } catch (e) {} };
  AI.hapus = () => { try { localStorage.removeItem(kunciLS()); localStorage.removeItem(kunciLS() + ':insight'); } catch (e) {} };
  AI.demo = () => Store.mode === 'demo';
  AI.siap = () => AI.demo() || !!AI.cfg().key;

  /** Daftar model yang bisa dipakai kunci ini → pilih Flash stabil terbaru (bukan lite/preview/live/tts/image). */
  const UTAMA = 'gemini-3.5-flash';   // terbukti cepat & stabil di kunci gratis (Nov 2026)
  AI.pilihModel = (names) => {
    if ((names || []).indexOf(UTAMA) >= 0) return UTAMA;
    const ok = names.filter(n => /gemini/.test(n) && !/(tts|image|live|audio|embedding|vision|thinking|exp|learnlm|robotics|computer)/.test(n));
    const ver = n => { const m = /gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? parseFloat(m[1]) : 0; };
    const rank = n => (/flash/.test(n) ? 100 : /pro/.test(n) ? 10 : 0) + (/lite/.test(n) ? -40 : 0) + (/preview/.test(n) ? -25 : 0) + (/latest/.test(n) ? -5 : 0) + ver(n);
    return ok.sort((a, b) => rank(b) - rank(a))[0] || CADANGAN[0];
  };
  /** Model cadangan saat model utama sibuk: flash lain dulu, lalu flash-lite (urut versi terbaru). */
  AI.cadangan = (names, utama) => {
    const ok = (names || []).filter(n => n !== utama && /gemini/.test(n) && /flash/.test(n) && !/(tts|image|live|audio|embedding|vision|thinking|exp|learnlm|robotics|computer|preview|latest)/.test(n));
    const ver = n => { const m = /gemini-(\d+(?:\.\d+)?)/.exec(n); return m ? parseFloat(m[1]) : 0; };
    const r = ok.sort((a, b) => ((/lite/.test(a) ? 0 : 100) + ver(a) > (/lite/.test(b) ? 0 : 100) + ver(b) ? -1 : 1));
    return r.concat(CADANGAN.filter(n => n !== utama && r.indexOf(n) < 0)).slice(0, 3);
  };
  AI.models = async (key) => {
    const r = await fetch(API + '/models?pageSize=200&key=' + encodeURIComponent(key));
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(pesanGalat(r.status, j));
    return (j.models || []).filter(m => (m.supportedGenerationMethods || []).indexOf('generateContent') >= 0).map(m => m.name.replace(/^models\//, ''));
  };
  const pesanGalat = (st, j) => {
    const m = (j && j.error && j.error.message) || '';
    if (st === 400 && /API key not valid|API_KEY_INVALID/i.test(m)) return 'Kunci API tidak valid. Salin ulang dari Google AI Studio.';
    if (st === 403) return 'Kunci ditolak (403). Pastikan Gemini API aktif untuk kunci ini.';
    if (st === 429) return 'Kuota gratis Gemini sedang habis. Coba lagi beberapa menit lagi atau besok.';
    if (st === 404) return 'Model tidak tersedia untuk kunci ini.';
    if (st === 503 || st === 500 || st === 502 || st === 504) return 'Server Gemini sedang sibuk. Coba lagi beberapa menit lagi.';
    return 'Gemini galat ' + st + (m ? ': ' + m.slice(0, 140) : '');
  };
  /** Sambungkan kunci baru: cek kunci + pilih model otomatis. */
  AI.sambung = async (key) => {
    key = String(key || '').trim();
    if (!/^[A-Za-z0-9._\-]{30,300}$/.test(key)) throw new Error('Format kunci tidak dikenali. Kunci Gemini diawali "AQ." (format baru) atau "AIza" (format lama).');
    const list = await AI.models(key);
    const model = AI.pilihModel(list);
    AI.simpanCfg({ key, model, models: list.slice(0, 60), at: new Date().toISOString() });
    return model;
  };

  /** Panggil Gemini. opt: {sistem, gambar:{mime,data}, json:true, maks} */
  AI.minta = async (prompt, opt) => {
    opt = opt || {};
    if (AI.demo()) return AI.contohDemo(prompt, opt);
    const c = AI.cfg(); if (!c.key) throw new Error('Kunci Gemini belum diisi. Buka Lainnya › Tanya AI.');
    const parts = [{ text: prompt }];
    if (opt.gambar) parts.push({ inline_data: { mime_type: opt.gambar.mime, data: opt.gambar.data } });
    const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: opt.json ? 0.1 : 0.4, maxOutputTokens: Math.max(2048, opt.maks || 0) } };
    if (opt.sistem) body.systemInstruction = { parts: [{ text: opt.sistem }] };
    if (opt.json) body.generationConfig.responseMimeType = 'application/json';
    // Mode "berpikir" dibuat seminim mungkin: lebih cepat & token tidak habis untuk berpikir (jawaban terpotong).
    const pikir = (model) => {
      const v = /gemini-(\d+(?:\.\d+)?)/.exec(model), n = v ? parseFloat(v[1]) : 0;
      if (n >= 3) return { thinkingLevel: 'low' };
      if (n >= 2.5 && /flash/.test(model)) return { thinkingBudget: 0 };
      return null;
    };
    const tanpaPikir = {};
    const coba = async (model) => {
      const b = JSON.parse(JSON.stringify(body)), tk = !tanpaPikir[model] && pikir(model);
      if (tk) b.generationConfig.thinkingConfig = tk;
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null, batas = setTimeout(() => ac && ac.abort(), opt.gambar ? 45000 : 30000);
      let r;
      try { r = await fetch(`${API}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(c.key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: ac ? ac.signal : undefined }); }
      catch (x) { const e = new Error(x && x.name === 'AbortError' ? 'Gemini terlalu lama menjawab. Coba lagi.' : 'Tidak bisa menghubungi Gemini. Periksa internet.'); e.status = 504; throw e; }
      finally { clearTimeout(batas); }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 400 && tk && /thinking/i.test((j.error && j.error.message) || '')) { tanpaPikir[model] = 1; return coba(model); }   // model tidak mengenal pengaturan ini
        const e = new Error(pesanGalat(r.status, j)); e.status = r.status; throw e;
      }
      const cand = (j.candidates || [])[0];
      let t = cand && cand.content && (cand.content.parts || []).filter(p => !p.thought).map(p => p.text || '').join('').trim();
      if (!t) throw new Error(cand && cand.finishReason === 'SAFETY' ? 'Gemini menolak menjawab pertanyaan ini.' : 'Gemini tidak memberi jawaban.');
      if (cand.finishReason === 'MAX_TOKENS' && !opt.json) t += '… (jawaban terpotong — coba tanyakan lebih spesifik)';
      return t;
    };
    const tunggu = ms => new Promise(r => setTimeout(r, ms));
    const sibuk = e => [429, 500, 502, 503, 504].indexOf(e.status) >= 0 || e instanceof TypeError;
    let utama = c.model || CADANGAN[0];
    if (!c.manual && c.models && c.models.length) { const p = AI.pilihModel(c.models); if (p !== utama) { utama = p; AI.simpanCfg(Object.assign(c, { model: p })); } }
    AI.terakhirModel = utama;
    try { return await coba(utama); }
    catch (e) {
      if (e.status === 404 || e.status === 400) {
        // model sudah dihentikan Google → pilih ulang dari daftar terbaru
        const list = await AI.models(c.key).catch(() => CADANGAN), m2 = AI.pilihModel(list.filter(n => n !== c.model));
        AI.simpanCfg(Object.assign(c, { model: m2, models: list.slice(0, 60) }));
        return coba(m2);
      }
      if (!sibuk(e)) throw e;
      // sibuk / kuota model ini habis → tunggu sebentar, coba sekali lagi, lalu model cadangan
      let akhir = e;
      if ([500, 502, 503].indexOf(e.status) >= 0) { await tunggu(1500); try { return await coba(utama); } catch (e2) { akhir = e2; if (!sibuk(e2)) throw e2; } }
      for (const m of AI.cadangan(c.models, utama)) {
        try { const t = await coba(m); AI.terakhirModel = m; return t; }
        catch (e3) { if (e3.status === 404) continue; akhir = e3; if (!sibuk(e3)) throw e3; }
      }
      throw akhir;
    }
  };

  // ---------- Ringkasan data untuk AI (angka saja) ----------
  const bulat = v => Math.round(v || 0);
  const katNama = id => { const k = Store.byId.Kategori[id]; return k && !k.pribadi ? k.nama : null; };
  AI.konteks = () => {
    const p = Calc.period(), per = Calc.lastPeriods(6);
    const ringkasPeriode = q => {
      const t = Calc.periodTotals(q), top = Calc.breakdown(q, 'kategori').filter(x => katNama(x.k)).slice(0, 10).map(x => [katNama(x.k), bulat(x.v)]);
      return { periode: q.label, mulai: q.start, akhir: q.end, pemasukan: bulat(t.masuk), pengeluaran: bulat(t.keluar), ditabung: bulat(t.tabung), kategori: top };
    };
    const env = Calc.envelopes(p).filter(e => e.efektif > 0 && !e.k.pribadi).map(e => [e.k.nama, bulat(e.efektif), bulat(e.terpakai)]);
    const nw = Calc.netWorth(), emas = Calc.emasSummary ? Calc.emasSummary() : null, sd = Calc.safeDaily(), sk = Calc.score();
    return {
      hariIni: U.today(), periodeSekarang: ringkasPeriode(p), periodeSebelumnya: per.filter(q => q.key !== p.key).slice(-5).reverse().map(ringkasPeriode),
      amplopPeriodeIni: { kolom: ['kategori', 'batas', 'terpakai'], data: env }, uangAmanPerHari: bulat(sd.perHari), sisaHariPeriode: sd.hari,
      tujuan: Calc.goals().filter(g => !g.t.arsip).map(g => ({ nama: g.t.nama, target: bulat(g.target), terkumpul: bulat(g.saldo), tenggat: g.t.tenggat || '', perkiraanTercapai: g.estimasi || '' })),
      utang: Calc.loans().filter(l => !l.lunas && l.p.arah !== 'piutang').map(l => ({ nama: l.p.pihak, sisa: bulat(l.sisa), cicilan: bulat(l.cicilan), bungaPersen: l.p.bunga || 0 })),
      tagihan30Hari: Calc.occurrences(U.today(), U.addDays(U.today(), 30)).filter(o => o.arah === 'keluar' && !o.lunas && o.kind !== 'rapat').slice(0, 15).map(o => [o.tanggal, o.nama, bulat(o.sisa)]),
      aset: { kekayaanBersih: bulat(nw.bersih), kasDanBank: bulat(nw.kas), utang: bulat(nw.utang), emasGram: emas ? Math.round(emas.gram * 100) / 100 : 0, nilaiEmas: emas ? bulat(emas.nilai) : 0 },
      skorKesehatan: { total: sk.total, komponen: sk.comp.map(c => [c.nama, Math.round(c.v), c.info]) },
      danaDarurat: { bulan: Math.round(Calc.emergency().bulan * 10) / 10, target: Calc.emergency().target }
    };
  };
  const SISTEM = 'Kamu asisten keuangan keluarga di aplikasi SatuAtap. Jawab dalam bahasa Indonesia yang hangat, singkat (maks 5 kalimat atau 5 butir), dan konkret. ' +
    'Gunakan HANYA angka dari data JSON yang diberikan; jangan menebak angka lain. Tulis rupiah seperti "Rp 1,2 jt" atau "Rp 450 rb". ' +
    'Bila data tidak cukup untuk menjawab, katakan apa yang perlu dicatat. Jangan memberi saran investasi spesifik (saham/produk tertentu). Hindari menghakimi.';
  const sistem = () => (window.I18N && I18N.lang === 'en') ? SISTEM.replace('Jawab dalam bahasa Indonesia', 'Jawab dalam bahasa Inggris (English)') : SISTEM;
  AI.jawab = (pertanyaan) => AI.minta('DATA KEUANGAN KELUARGA (JSON):\n' + JSON.stringify(AI.konteks()) + '\n\nPERTANYAAN: ' + pertanyaan, { sistem: sistem() });

  /** Insight mingguan: 7 hari terakhir vs 7 hari sebelumnya. Disimpan per minggu agar hemat kuota. */
  const kunciMinggu = () => { const d = U.parseDate(U.today()), s = U.addDays(U.today(), -((d.getDay() + 6) % 7)); return s; };   // Senin minggu ini
  AI.dataMinggu = () => {
    const a = U.addDays(U.today(), -6), b = U.addDays(U.today(), -13), c = U.addDays(U.today(), -7), per = (f, t) => {
      const m = {}; let tot = 0;
      Store.t.Transaksi.forEach(x => { if (x.tanggal >= f && x.tanggal <= t) { const e = Calc.expAmount(x); const n = katNama(x.kategoriId); if (e && n) { m[n] = (m[n] || 0) + e; tot += e; } } });
      return { total: bulat(tot), kategori: Object.keys(m).sort((p, q) => m[q] - m[p]).slice(0, 8).map(k => [k, bulat(m[k])]) };
    };
    return { mingguIni: Object.assign({ dari: a, sampai: U.today() }, per(a, U.today())), mingguLalu: Object.assign({ dari: b, sampai: c }, per(b, c)),
      amplop: Calc.envelopes(Calc.period()).filter(e => e.efektif > 0 && !e.k.pribadi && e.pct >= 0.8).map(e => [e.k.nama, Math.round(e.pct * 100) + '%']),
      tagihan7Hari: Calc.occurrences(U.today(), U.addDays(U.today(), 7)).filter(o => o.arah === 'keluar' && !o.lunas && o.kind !== 'rapat').map(o => [o.tanggal, o.nama, bulat(o.sisa)]),
      uangAmanPerHari: bulat(Calc.safeDaily().perHari) };
  };
  AI.insightTersimpan = () => { try { return JSON.parse(localStorage.getItem(kunciLS() + ':insight') || 'null'); } catch (e) { return null; } };
  AI.insight = async (force) => {
    const mg = kunciMinggu(), lama = AI.insightTersimpan();
    if (!force && lama && lama.minggu === mg) return lama;
    const teks = await AI.minta('DATA MINGGUAN (JSON):\n' + JSON.stringify(AI.dataMinggu()) + '\n\nTulis insight mingguan: 1 kalimat pembuka, lalu 3 butir (pakai "• ") tentang perubahan pengeluaran, amplop yang hampir habis, dan tagihan 7 hari ke depan. Tutup dengan 1 saran kecil yang bisa dilakukan minggu ini.', { sistem: sistem(), maks: 500 });
    const o = { minggu: mg, teks, at: new Date().toISOString() };
    try { localStorage.setItem(kunciLS() + ':insight', JSON.stringify(o)); } catch (e) {}
    if (!lama || lama.minggu !== mg) { try { window.App && App.kirimInsight && App.kirimInsight(o); } catch (e) {} }
    return o;
  };
  /** Bahan diskusi Rapat Keuangan (M-05). */
  AI.bahanRapat = () => {
    const a = Calc.rapatAgenda();
    const data = { periodeLalu: { pemasukan: bulat(a.tot.masuk), pengeluaran: bulat(a.tot.keluar), ditabung: bulat(a.tot.tabung) }, periodeSebelumnya: { pengeluaran: bulat(a.totPrev.keluar) },
      skor: [a.skorPrev, a.skor], amplopMeleset: a.meleset.filter(e => !e.k.pribadi).map(e => [e.k.nama, bulat(e.efektif), bulat(e.terpakai)]),
      perbandinganKategori: Calc.compare(a.p).rows.filter(r => katNama(r.k) && r.avg > 0).sort((x, y) => Math.abs(y.deltaPct) - Math.abs(x.deltaPct)).slice(0, 6).map(r => [r.label, bulat(r.cur), bulat(r.avg), Math.round(r.deltaPct * 100) + '%']),
      musimMahal: a.heavy.map(m => [m.label, Math.round(m.ratio * 100) + '%', m.items.slice(0, 3)]), tugasTerbuka: a.tugas.length };
    return AI.minta('DATA RAPAT (JSON):\n' + JSON.stringify(data) + '\n\nBuat 3–4 bahan diskusi untuk rapat keuangan suami-istri, masing-masing berupa pertanyaan terbuka diawali "• ", contoh "Makan di luar naik 40%, mau dikurangi?". Sertakan angka dari data.', { sistem: sistem(), maks: 500 });
  };

  /** Foto struk → {total, tanggal, toko, kategori}. Gambar diperkecil dulu di HP (maks 1280 px). */
  AI.kecilkan = (file) => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1280 / Math.max(img.width, img.height)), cv = document.createElement('canvas');
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      cv.toBlob(b => { if (!b) return rej(new Error('Gagal membaca foto.')); const fr = new FileReader(); fr.onload = () => res({ blob: b, mime: 'image/jpeg', data: String(fr.result).split(',')[1] }); fr.readAsDataURL(b); }, 'image/jpeg', 0.8);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('File bukan gambar.')); };
    img.src = url;
  });
  AI.bacaStruk = async (gb) => {
    const kats = Store.kategori('keluar').filter(k => !k.pribadi).map(k => k.nama);
    const t = await AI.minta('Baca foto struk/nota belanja ini. Balas JSON saja: {"total": angka rupiah tanpa titik (total yang dibayar), "tanggal": "YYYY-MM-DD" atau "", "toko": "nama toko/merchant", "kategori": salah satu dari ' + JSON.stringify(kats) + ', "yakin": 0-1}. Hari ini ' + U.today() + '. Jika bukan struk, total 0.',
      { gambar: gb, json: true, maks: 300 });
    let o; try { o = JSON.parse(t.replace(/^```json|```$/g, '').trim()); } catch (e) { throw new Error('Struk tidak terbaca. Coba foto lebih terang dan lurus.'); }
    const total = Math.round(Number(String(o.total || 0).replace(/[^\d.]/g, '')) || 0);
    const k = Store.kategori('keluar').find(x => x.nama === o.kategori);
    const tgl = /^\d{4}-\d{2}-\d{2}$/.test(o.tanggal || '') && o.tanggal <= U.today() && o.tanggal >= U.addDays(U.today(), -400) ? o.tanggal : U.today();
    return { total, tanggal: tgl, toko: String(o.toko || '').slice(0, 60), kategoriId: k ? k.id : '', yakin: Number(o.yakin) || 0 };
  };

  // ---------- Mode demo: jawaban contoh tanpa kunci ----------
  AI.contohDemo = async (prompt, opt) => {
    await new Promise(r => setTimeout(r, 600));
    if (opt.gambar) return JSON.stringify({ total: 187500, tanggal: U.today(), toko: 'Superindo Ciputat', kategori: (Store.kategori('keluar').find(k => /belanja|dapur/i.test(k.nama)) || {}).nama || '', yakin: 0.9 });
    if (/DATA RAPAT/.test(prompt)) return '• Makan di luar naik cukup tajam dibanding rata-rata 3 bulan — mau dibatasi 2× seminggu?\n• Amplop Belanja Dapur melewati batas; apakah batasnya memang perlu dinaikkan?\n• Bulan depan ada tagihan tahunan; sudah disisihkan dari mana?\n• Dana darurat baru sebagian tercapai — setoran bisa ditambah Rp 250 rb?';
    if (/DATA MINGGUAN/.test(prompt)) return 'Minggu ini pengeluaran keluarga relatif terkendali.\n• Belanja dapur sedikit naik dibanding minggu lalu.\n• Amplop Makan & Minum sudah terpakai lebih dari 80%.\n• Ada tagihan listrik & internet dalam 7 hari ke depan.\nSaran kecil: masak di rumah 2 hari ekstra minggu ini.';
    return '(Contoh jawaban mode demo) Pengeluaran jajan bulan ini sekitar Rp 1,1 jt, naik ±18% dibanding rata-rata 3 bulan terakhir. Kenaikan terbesar dari makan di luar akhir pekan. Coba tetapkan batas Rp 250 rb per minggu di amplop Makan & Minum.';
  };
  window.AI = AI;
})();
