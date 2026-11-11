/* Lainnya › Tanya AI · Foto struk · Insight mingguan · Bahan rapat */
(function () {
  const I = UI.icon;
  const A = { chat: [], sibuk: false };
  const kunciChat = () => 'sa:aichat:' + ((Store.me && Store.me.email) || '');
  const muatChat = () => { try { A.chat = JSON.parse(sessionStorage.getItem(kunciChat()) || '[]'); } catch (e) { A.chat = []; } };
  const simpanChat = () => { try { sessionStorage.setItem(kunciChat(), JSON.stringify(A.chat.slice(-30))); } catch (e) {} };
  /** Teks AI → HTML aman (butir "• " dan baris baru). */
  UI.aiTeks = t => U.esc(String(t || '')).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ').replace(/\n/g, '<br>');

  // ---------- Pengaturan kunci ----------
  UI.act('ai-sambung', async el => {
    const inp = document.getElementById('ai-key'); if (!inp) return;
    el.disabled = true; el.innerHTML = I('loader') + ' Memeriksa…';
    try { const m = await AI.sambung(inp.value); inp.value = ''; UI.toast('Tersambung · model ' + m); UI.render(); }
    catch (e) { UI.toast(e.message, 'warn'); el.disabled = false; el.innerHTML = I('plug') + ' Sambungkan'; }
  });
  UI.act('ai-putus', async () => { if (await UI.confirm('Hapus kunci Gemini dari HP ini?', 'Fitur AI berhenti di perangkat ini. Kunci di Google AI Studio tidak terhapus.', 'Hapus', true)) { AI.hapus(); UI.render(); } });
  UI.act('ai-model', () => {
    const c = AI.cfg(), list = (c.models || []).filter(n => /gemini/.test(n));
    const s = UI.sheet({ title: 'Model Gemini', body: UI.field('Model', `<select name="model">${list.map(n => `<option ${n === c.model ? 'selected' : ''}>${U.esc(n)}</option>`).join('')}</select>`, 'Bawaan: gemini-3.5-flash (cepat & stabil). Ganti hanya bila sering gagal atau kuota habis.'),
      foot: `<button class="btn" data-ok>Simpan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { AI.simpanCfg(Object.assign(c, { model: UI.formData(s.el).model, manual: true })); s.close(); UI.render(); };
  });

  // ---------- Tanya AI ----------
  const SARAN = ['Jajan bulan ini naik berapa?', 'Kategori apa yang paling boros bulan ini?', 'Kapan dana darurat kami tercapai?', 'Berapa sisa anggaran makan bulan ini?', 'Apa yang bisa kami hemat bulan depan?', 'Bagaimana kondisi utang kami?'];
  const tanya = async (q) => {
    q = String(q || '').trim(); if (!q || A.sibuk) return;
    A.chat.push({ dari: 'saya', teks: q }); A.sibuk = true; UI.render(); gulir();
    try { const t = await AI.jawab(q); A.chat.push({ dari: 'ai', teks: t }); }
    catch (e) { A.chat.push({ dari: 'ai', teks: '⚠️ ' + e.message, galat: true }); }
    A.sibuk = false; simpanChat(); UI.render(); gulir();
  };
  const gulir = () => setTimeout(() => { const b = document.querySelector('.ai-chat'); if (b) b.lastElementChild && b.lastElementChild.scrollIntoView({ block: 'end', behavior: 'smooth' }); }, 50);
  UI.act('ai-saran', el => tanya(el.dataset.q));
  UI.act('ai-kirim', () => { const i = document.getElementById('ai-q'); if (i) { const v = i.value; i.value = ''; tanya(v); } });
  UI.act('ai-bersih', () => { A.chat = []; simpanChat(); UI.render(); });

  // ---------- Foto struk (T-11) ----------
  UI.fotoStruk = () => {
    if (!AI.siap()) { UI.toast('Sambungkan kunci Gemini dulu di Lainnya › Tanya AI.', 'warn'); return UI.go('ai'); }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', 'environment');
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const s = UI.sheet({ title: 'Membaca struk', cls: 'small', body: `<div class="voice"><div class="mic-pulse">${I('scan-line', 'big')}</div><p class="muted">Gemini sedang membaca total, tanggal, dan nama toko…</p></div>` });
      try {
        const gb = await AI.kecilkan(f), r = await AI.bacaStruk(gb);
        s.close();
        if (!r.total) { UI.toast('Total belanja tidak terbaca. Isi manual ya.', 'warn'); return UI.catat({ preset: { jenis: 'keluar', sumber: 'struk' } }); }
        let lampiran = '';
        if (Store.mode === 'live' && Cloud.simpanStruk) { try { lampiran = await Cloud.simpanStruk(gb.blob, (r.toko || 'struk') + ' ' + r.tanggal + '.jpg'); } catch (e) { UI.toast('Foto tidak tersimpan ke Drive: ' + e.message, 'warn'); } }
        UI.catat({ preset: { jenis: 'keluar', jumlah: r.total, tanggal: r.tanggal, kategoriId: r.kategoriId, catatan: r.toko, sumber: 'struk', lampiran } });
        if (r.yakin && r.yakin < 0.6) UI.toast('Periksa lagi angkanya — fotonya agak sulit dibaca.', 'warn');
      } catch (e) { s.close(); UI.toast(e.message, 'warn'); }
    };
    inp.click();
  };
  UI.act('ai-struk', () => UI.fotoStruk());

  // ---------- Insight mingguan (kartu Beranda) ----------
  A.insight = null; A.insightJalan = false;
  UI.aiInsightCard = () => {
    if (!AI.siap()) return '';
    const o = A.insight || AI.insightTersimpan();
    const minggu = U.addDays(U.today(), -((U.parseDate(U.today()).getDay() + 6) % 7));
    if ((!o || o.minggu !== minggu) && !A.insightJalan && !A.insightGagal) {     // sekali per minggu, otomatis
      A.insightJalan = true;
      AI.insight().then(x => { A.insight = x; }).catch(e => { A.insightGagal = e.message; }).finally(() => { A.insightJalan = false; if (UI.cur === 'beranda') UI.render(); });
    }
    if (!o && A.insightJalan) return `<div class="card ai-card"><div class="row-sp"><b>${I('sparkles')} Insight minggu ini</b><small class="muted">menyusun…</small></div></div>`;
    if (!o) return A.insightGagal ? `<div class="card ai-card"><div class="row-sp"><b>${I('sparkles')} Insight minggu ini</b><button class="icon-btn sm" data-act="ai-insight" aria-label="Coba lagi">${I('refresh-cw')}</button></div><small class="muted">${U.esc(A.insightGagal)}</small></div>` : '';
    return `<div class="card ai-card"><div class="row-sp"><b>${I('sparkles')} Insight minggu ini</b><button class="icon-btn sm" data-act="ai-insight" aria-label="Perbarui">${I(A.insightJalan ? 'loader' : 'refresh-cw')}</button></div>
      <div class="ai-out">${UI.aiTeks(o.teks)}</div><small class="muted">Dirangkum Gemini dari angka minggu ini · ${U.timeAgo(o.at)}</small></div>`;
  };
  UI.act('ai-insight', async () => { if (A.insightJalan) return; A.insightJalan = true; A.insightGagal = ''; UI.render(); try { A.insight = await AI.insight(true); } catch (e) { UI.toast(e.message, 'warn'); } A.insightJalan = false; UI.render(); });

  // ---------- Bahan diskusi rapat (M-05) ----------
  UI.act('rp-ai', async el => {
    const box = document.getElementById('rp-ai'); if (!box) return;
    box.innerHTML = `<small class="muted">${I('loader')} Menyusun bahan diskusi…</small>`;
    try { box.innerHTML = UI.aiTeks(await AI.bahanRapat()) + `<small class="muted">Angka dari catatan keluarga; kalimat oleh Gemini.</small>`; }
    catch (e) { box.innerHTML = `<small class="bad">${U.esc(e.message)}</small>`; }
  });

  UI.page('ai', {
    head: () => ({ title: 'Tanya AI', crumb: 'Lainnya', back: 'lainnya', right: AI.siap() && !AI.demo() ? `<button class="icon-btn" data-act="ai-model" aria-label="Pengaturan AI">${I('settings')}</button>` : '' }),
    nav: () => 'lainnya',
    render() {
      if (!AI.siap()) return `<div class="card"><h3>${I('sparkles')} Sambungkan Gemini (gratis)</h3>
          <p class="muted">Fitur AI memakai kunci Gemini milik keluarga Anda sendiri — tanpa biaya untuk pemakaian wajar, dan data tidak lewat server JuniorLabs.</p>
          <ol class="steps"><li>Buka <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> dan masuk dengan akun Google.</li>
            <li>Ketuk <b>Create API key</b>, lalu salin kuncinya (diawali <code>AQ.</code>, atau <code>AIza</code> untuk kunci lama).</li><li>Tempel di bawah, lalu ketuk Sambungkan.</li></ol>
          ${UI.field('Kunci API Gemini', `<input id="ai-key" type="password" autocomplete="off" spellcheck="false" placeholder="AQ.… / AIza…">`)}
          <button class="btn block" data-act="ai-sambung">${I('plug')} Sambungkan</button></div>
        <div class="note">${I('shield-check')} Kunci disimpan hanya di HP ini (setiap anggota memasukkan sendiri bila ingin memakai AI). Yang dikirim ke Gemini hanya ringkasan angka — tanpa catatan transaksi dan tanpa kategori pribadi. Pada kunci gratis, Google dapat memakai isi permintaan untuk meningkatkan layanannya; aktifkan penagihan di AI Studio bila tidak ingin.</div>`;
      if (!A.chat.length) muatChat();
      const c = AI.cfg();
      return `<div class="tiles-row"><button class="btn ghost" data-act="ai-struk">${I('camera')} Foto struk</button><button class="btn ghost" data-act="go" data-to="rapat">${I('users')} Bahan rapat</button></div>
        <div class="ai-chat">${A.chat.length ? A.chat.map(m => `<div class="bubble ${m.dari} ${m.galat ? 'err' : ''}">${m.dari === 'ai' ? UI.aiTeks(m.teks) : U.esc(m.teks)}</div>`).join('')
          : `<div class="ai-kosong">${I('sparkles', 'big')}<p>Tanyakan apa saja tentang keuangan keluarga. Angka dihitung dari catatan Anda; Gemini merangkai jawabannya.</p></div>`}
          ${A.sibuk ? `<div class="bubble ai typing"><i></i><i></i><i></i></div>` : ''}</div>
        <div class="chips">${SARAN.map(q => `<button class="chip" data-act="ai-saran" data-q="${U.esc(q)}">${U.esc(q)}</button>`).join('')}</div>
        <div class="ai-input"><input id="ai-q" maxlength="300" placeholder="Tulis pertanyaan…" enterkeyhint="send"><button class="btn" data-act="ai-kirim" aria-label="Kirim">${I('send')}</button></div>
        <div class="row-sp"><small class="muted">${AI.demo() ? 'Mode demo: jawaban contoh' : 'Model: ' + U.esc(c.model || '-')}</small>${A.chat.length ? `<button class="link" data-act="ai-bersih">Bersihkan</button>` : ''}</div>
        ${!AI.demo() ? `<button class="btn block ghost danger" data-act="ai-putus">${I('unplug')} Hapus kunci dari HP ini</button>` : ''}<div class="spacer"></div>`;
    },
    after(el) { const i = el.querySelector('#ai-q'); if (i) i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); const v = i.value; i.value = ''; tanya(v); } }; }
  });
})();
