/* Lainnya › Rapat Keuangan (M-01 … M-07) */
(function () {
  const I = UI.icon;
  const R = { draft: null, filter: 'buka' };

  // ---------- Tugas ----------
  UI.tugasForm = (t, preset) => {
    t = t || {}; preset = preset || {};
    const v = Object.assign({ judul: '', pj: Store.me.email, tenggat: U.addDays(U.today(), 14), catatan: '' }, preset, t);
    const s = UI.sheet({ title: t.id ? 'Ubah tugas' : 'Tugas baru', body: `
      ${UI.field('Tugas', `<input name="judul" value="${U.esc(v.judul)}" maxlength="120" placeholder="mis. Bandingkan asuransi kendaraan">`)}
      <div class="grid2">${UI.field('Penanggung jawab', `<select name="pj">${Store.members().map(m => `<option value="${U.esc(m.email)}" ${m.email === v.pj ? 'selected' : ''}>${U.esc(m.nama)}</option>`).join('')}</select>`)}
        ${UI.field('Tenggat', `<input type="date" name="tenggat" value="${v.tenggat || ''}">`)}</div>
      ${UI.field('Catatan', `<textarea name="catatan" rows="2">${U.esc(v.catatan || '')}</textarea>`)}`,
      foot: `${t.id ? `<button class="btn ghost danger" data-del>${I('trash-2')}</button>` : ''}<button class="btn" data-ok>${I('check')} Simpan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(s.el);
      if (!String(f.judul || '').trim()) return UI.toast('Tulis tugasnya dulu.', 'warn');
      const row = Object.assign({}, t, { id: t.id || U.uid('tg'), judul: f.judul.trim(), pj: f.pj, tenggat: f.tenggat || '', catatan: f.catatan || '',
        rapatId: t.rapatId || preset.rapatId || (R.draft ? R.draft.id : ''), sumber: t.sumber || preset.sumber || '', dibuat: t.dibuat || new Date().toISOString(), selesai: !!t.selesai });
      Store.commit([{ op: 'upsert', t: 'Tugas', row }]);
      if (R.draft && !t.id) R.draft.keputusan.push({ teks: 'Tugas: ' + row.judul + ' — ' + Store.memberName(row.pj), tugasId: row.id });
      s.close(); UI.toast('Tugas disimpan.');
    };
    const del = s.el.querySelector('[data-del]');
    if (del) del.onclick = async () => { if (await UI.confirm('Hapus tugas ini?', '', 'Hapus', true)) { Store.remove('Tugas', t.id); s.close(); } };
  };
  UI.act('tugas-new', el => UI.tugasForm(null, { judul: el.dataset.judul || '', sumber: el.dataset.sumber || '' }));
  UI.act('tugas-edit', el => { const t = Store.byId.Tugas[el.dataset.id]; if (t) UI.tugasForm(t); });
  UI.act('tugas-cek', el => {
    const t = Store.byId.Tugas[el.dataset.id]; if (!t) return;
    Store.commit([{ op: 'upsert', t: 'Tugas', row: Object.assign({}, t, { selesai: !t.selesai, tglSelesai: t.selesai ? '' : U.today() }) }]);
    const r = el.closest('.row'); if (r && el.closest('.slides-wrap')) { r.classList.toggle('done', !t.selesai); el.classList.toggle('on', !t.selesai); el.innerHTML = I(!t.selesai ? 'circle-check' : 'circle'); }
    if (!t.selesai) UI.toast('Tugas selesai 👍');
  });
  const tugasRow = t => `<div class="row tugas ${t.selesai ? 'done' : ''}"><button class="cek ${t.selesai ? 'on' : ''}" data-act="tugas-cek" data-id="${t.id}" aria-label="${t.selesai ? 'Tandai belum' : 'Tandai selesai'}">${I(t.selesai ? 'circle-check' : 'circle')}</button>
    <div class="tx-txt" data-act="tugas-edit" data-id="${t.id}"><b>${U.esc(t.judul)}</b><small>${U.esc(Store.memberName(t.pj))}${t.tenggat ? ' · ' + (t.selesai ? 'tenggat ' + U.tgl(t.tenggat, 'dm') : U.relDay(t.tenggat)) : ''}</small></div>
    ${!t.selesai && t.tenggat && t.tenggat < U.today() ? UI.pill('Lewat', 'bad') : ''}</div>`;
  UI.tugasRow = tugasRow;

  // ---------- Keputusan (catatan singkat per kartu) ----------
  UI.act('rp-keputusan', el => {
    if (!R.draft) return;
    const s = UI.sheet({ title: 'Catat keputusan', body: UI.field(el.dataset.topik ? 'Topik: ' + el.dataset.topik : 'Keputusan', `<textarea name="teks" rows="3" placeholder="mis. Anggaran makan di luar diturunkan jadi 1 jt"></textarea>`),
      foot: `<button class="btn" data-ok>${I('check')} Catat</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { const v = String(UI.formData(s.el).teks || '').trim(); if (v) { R.draft.keputusan.push({ teks: v, topik: el.dataset.topik || '' }); UI.toast('Keputusan dicatat.'); } s.close(); };
  });

  // ---------- Kartu agenda (M-02/M-03/M-04) ----------
  const acts = (topik, extra) => `<div class="acts">${extra || ''}<button class="btn ghost" data-act="rp-keputusan" data-topik="${U.esc(topik)}">${I('pencil')} Catat keputusan</button><button class="btn ghost" data-act="tugas-new" data-sumber="${U.esc(topik)}">${I('list-plus')} Buat tugas</button></div>`;
  const agendaCards = (tahunan) => {
    const a = Calc.rapatAgenda(), cards = [], ds = a.skor - a.skorPrev;
    const anggota = Store.members();
    cards.push({ cls: 'hero-slide', html: `<p class="kicker">${I('users')} ${tahunan ? 'Rapat keuangan tahunan' : 'Rapat keuangan keluarga'}</p><h2>${U.tgl(U.today(), 'long')}</h2>
      <p>Agenda disusun otomatis dari catatan keluarga. Geser untuk berpindah topik; catat keputusan di tiap kartu.</p>
      ${UI.field('Yang hadir', `<div class="chips" id="rp-hadir">${anggota.map(m => `<label class="chip ${R.draft.hadir.indexOf(m.email) >= 0 ? 'on' : ''}"><input type="checkbox" value="${U.esc(m.email)}" ${R.draft.hadir.indexOf(m.email) >= 0 ? 'checked' : ''} hidden>${U.esc(m.nama)}</label>`).join('')}</div>`)}
      ${a.status.streak ? `<small>${I('flame')} Rapat rutin terjaga ${a.status.streak} bulan berturut-turut</small>` : ''}` });
    if (tahunan && UI.kilasCards) UI.kilasCards(new Date().getFullYear()).slice(1, -1).forEach(c => cards.push(c));
    // 1. ringkasan periode lalu + skor
    cards.push({ html: `<p class="kicker">${I('chart-column')} Periode lalu · ${U.esc(a.p.label)}</p>
      <div class="stat3"><div class="stat in"><small>Masuk</small><b>${UI.ms(a.tot.masuk)}</b></div><div class="stat out"><small>Keluar</small><b>${UI.ms(a.tot.keluar)}</b></div><div class="stat"><small>Ditabung</small><b>${UI.ms(a.tot.tabung)}</b></div></div>
      <div class="kv-list"><div class="kv"><span>Skor kesehatan</span><b>${a.skor} <em class="${ds >= 0 ? 'ok' : 'bad'}">${ds >= 0 ? '▲' : '▼'} ${Math.abs(ds)}</em></b></div>
      <div class="kv"><span>Pengeluaran vs periode sebelumnya</span><b class="${a.tot.keluar <= a.totPrev.keluar ? 'ok' : 'bad'}">${a.totPrev.keluar ? (a.tot.keluar >= a.totPrev.keluar ? '+' : '−') + U.pct(Math.abs(a.tot.keluar - a.totPrev.keluar) / a.totPrev.keluar) : '—'}</b></div></div>
      ${acts('Ringkasan periode', `<button class="btn ghost" data-act="go" data-to="rapor" data-tutup>${I('chart-pie')} Rapor</button>`)}` });
    // 2. amplop meleset
    cards.push({ html: `<p class="kicker">${I('wallet-cards')} Amplop yang meleset</p>
      ${a.meleset.length ? `<div class="list">${a.meleset.slice(0, 6).map(e => `<div class="row"><span class="cat-ic bad">${I(e.k.ikon || 'circle')}</span><div class="tx-txt"><b>${U.esc(e.k.nama)}</b><small>batas ${UI.ms(e.efektif)} · terpakai ${UI.ms(e.terpakai)}</small></div><b class="bad">+${UI.ms(e.terpakai - e.efektif)}</b></div>`).join('')}</div>
        <p class="muted small">Naikkan batasnya (memang perlu) atau sepakati cara menghemat.</p>`
        : `<h2>${I('circle-check')} Semua amplop aman</h2><p class="muted">Tidak ada kategori yang melewati batas di periode lalu.</p>`}
      ${acts('Amplop', `<button class="btn ghost" data-act="go" data-to="anggaran" data-tutup>${I('sliders-horizontal')} Ubah anggaran</button>`)}` });
    // 3. tagihan besar & musim mahal 3 bulan
    cards.push({ html: `<p class="kicker">${I('calendar-clock')} 3 bulan ke depan</p>
      <div class="list">${a.heavy.map(m => `<div class="row"><span class="cat-ic ${m.level === 'puncak' ? 'bad' : m.level === 'sedang' ? 'warn' : 'ok'}">${I(m.level === 'aman' ? 'sun' : 'flame')}</span><div class="tx-txt"><b>${U.esc(m.label)}</b><small>${m.items.length ? U.esc(m.items.slice(0, 3).join(', ')) : 'tanpa tagihan khusus'}</small></div><b>${U.pct(m.ratio)}</b></div>`).join('')}</div>
      ${a.occ3.length ? `<small class="muted">Perlu disiapkan: ${a.occ3.slice(0, 4).map(o => U.esc(o.nama) + ' (' + UI.ms(o.sisa) + ', ' + U.tgl(o.tanggal, 'dm') + ')').join(' · ')}</small>` : ''}
      ${acts('Tagihan & musim mahal', `<button class="btn ghost" data-act="go" data-to="kalender/musim" data-tutup>${I('calendar')} Kalender</button>`)}` });
    // 4. Tujuan & siapa sudah setor
    if (a.goals.length) cards.push({ html: `<p class="kicker">${I('target')} Progres Tujuan</p>
      <div class="list">${a.goals.slice(0, 5).map(x => `<div class="row"><span class="cat-ic">${I(x.g.t.ikon || 'target')}</span><div class="tx-txt"><b>${U.esc(x.g.t.nama)}</b>${UI.bar(x.g.pct, 'aman')}
        <small>${U.pct(Math.min(1, x.g.pct))} · setor periode lalu: ${anggota.map(m => U.esc(m.nama.split(' ')[0]) + ' ' + (x.setor[m.email] ? '✓' : '—')).join(' · ')}</small></div></div>`).join('')}</div>
      ${acts('Tujuan', `<button class="btn ghost" data-act="goal-new">${I('plus')} Tujuan baru</button>`)}` });
    // 5. bebas utang
    cards.push({ html: `<p class="kicker">${I('landmark')} Utang</p>
      ${a.pay.order && a.pay.order.length ? `<h2>Bebas utang ${U.tgl(a.pay.end, 'my')}</h2><p class="muted">${a.pay.months} bulan lagi dengan cicilan sekarang (urutan bunga tertinggi dulu).</p>
        <div class="list">${a.pay.order.slice(0, 4).map(d => `<div class="row"><div class="tx-txt"><b>${U.esc(d.nama)}</b><small>lunas ${d.selesai ? U.tgl(d.selesai, 'my') : '-'}</small></div></div>`).join('')}</div>`
        : `<h2>${I('circle-check')} Tidak ada utang berjalan</h2>`}
      ${acts('Utang', `<button class="btn ghost" data-act="go" data-to="utang" data-tutup>${I('landmark')} Utang</button>`)}` });
    // 6. aset & emas
    cards.push({ cls: a.emas && a.emas.gram ? 'gold-slide' : '', html: `<p class="kicker">${I('gem')} Aset & emas</p><div class="big">${UI.ms(a.nw.bersih)}</div><p>kekayaan bersih saat ini</p>
      ${a.emas && a.emas.gram ? `<div class="kv-list"><div class="kv"><span>Emas</span><b>${U.gram(a.emas.gram)} g · ${UI.ms(a.emas.nilai)}</b></div><div class="kv"><span>Untung/rugi emas</span><b>${a.emas.untung >= 0 ? '+' : '−'}${UI.ms(Math.abs(a.emas.untung))}</b></div></div>` : ''}
      ${acts('Aset & emas', `<button class="btn ghost" data-act="emas-alert">${I('bell')} Alert emas</button>`)}` });
    // 7. tugas berjalan
    cards.push({ html: `<p class="kicker">${I('list-checks')} Tugas dari rapat sebelumnya</p>
      ${a.tugas.length ? `<div class="list">${a.tugas.map(tugasRow).join('')}</div>` : `<h2>${I('circle-check')} Tidak ada tugas tertunda</h2>`}
      ${acts('Tugas')}` });
    // 8. skenario tersimpan
    if (a.skenario.length) cards.push({ html: `<p class="kicker">${I('git-fork')} Rencana yang sedang ditimbang</p>
      <div class="list">${a.skenario.map(x => `<div class="row" data-act="sim-buka" data-id="${x.id}" data-tutup><span class="cat-ic">${I((Calc.SIM_JENIS[x.jenis] || {}).icon || 'git-fork')}</span><div class="tx-txt"><b>${U.esc(x.nama)}</b><small>${x.data && x.data.ringkas ? 'rasio cicilan ' + U.pct(x.data.ringkas.dsr, 1) + ' · skor ' + x.data.ringkas.skor + (x.data.ringkas.mundur ? ' · ' + x.data.ringkas.mundur + ' Tujuan mundur' : '') : ''}</small></div>${I('chevron-right')}</div>`).join('')}</div>
      ${acts('Rencana besar')}` });
    if (tahunan) cards.push({ cls: 'hero-slide', html: `<p class="kicker">${I('flag')} Target ${new Date().getFullYear() + 1}</p><h2>Tetapkan target tahun depan</h2>
      <p>Buat Tujuan baru, tetapkan anggaran, lalu catat targetnya sebagai keputusan.</p><div class="acts"><button class="btn on-dark" data-act="goal-new">${I('plus')} Tujuan baru</button><button class="btn on-dark" data-act="rp-keputusan" data-topik="Target tahun depan">${I('pencil')} Catat target</button></div>` });
    if (window.AI && AI.siap && AI.siap()) cards.push({ html: `<p class="kicker">${I('sparkles')} Bahan diskusi dari AI</p><div id="rp-ai" class="ai-out"><button class="btn ghost" data-act="rp-ai">${I('sparkles')} Minta bahan diskusi</button></div>` });
    cards.push({ cls: 'hero-slide', html: `<p class="kicker">${I('notebook-pen')} Penutup</p><h2>Notulen</h2>
      <textarea id="rp-catatan" rows="5" placeholder="Catatan rapat…" class="on-dark-input">${U.esc(R.draft.catatan || '')}</textarea>
      <small id="rp-kep-n">${R.draft.keputusan.length} keputusan dicatat</small>
      <p class="muted small">Ketuk “Selesai” untuk menyimpan rapat ini. Tugas yang belum selesai muncul lagi di rapat berikutnya.</p>` });
    return cards;
  };
  const simpanDraft = () => {
    const d = R.draft; if (!d) return;
    const ta = document.getElementById('rp-catatan'); if (ta) d.catatan = ta.value;
    const h = document.getElementById('rp-hadir'); if (h) d.hadir = [...h.querySelectorAll('input:checked')].map(x => x.value);
    Store.commit([{ op: 'upsert', t: 'Rapat', row: { id: d.id, tanggal: d.tanggal, jenis: d.jenis, judul: d.judul, catatan: d.catatan, keputusan: d.keputusan, hadir: d.hadir, skor: String(Calc.score().total), dibuat: d.dibuat, oleh: Store.me.email } }]);
    R.draft = null; UI.toast('Rapat tersimpan. Sampai jumpa di rapat berikutnya!'); UI.go('rapat/' + d.id);
  };
  UI.act('rp-mulai', () => {
    const st = Calc.rapatStatus(), tahunan = new Date().getMonth() === 11;
    R.draft = { id: U.uid('rp'), tanggal: U.today(), jenis: tahunan ? 'tahunan' : 'rutin', judul: (tahunan ? 'Rapat tahunan ' : 'Rapat ') + U.tgl(U.today(), 'my'), catatan: '', keputusan: [], hadir: Store.members().map(m => m.email), dibuat: new Date().toISOString() };
    const v = UI.slides(agendaCards(tahunan), { akhir: 'Simpan rapat', onAkhir: simpanDraft, onClose: () => { if (R.draft) UI.toast('Rapat belum disimpan. Ketuk “Mulai rapat” untuk mengulang.', 'warn'); } });
    v.el.addEventListener('change', e => { const l = e.target.closest('#rp-hadir label'); if (l) l.classList.toggle('on', e.target.checked); });
    v.el.addEventListener('input', e => { if (e.target.id === 'rp-catatan' && R.draft) R.draft.catatan = e.target.value; });
    const obs = setInterval(() => { const n = v.el.querySelector('#rp-kep-n'); if (!document.body.contains(v.el)) return clearInterval(obs); if (n && R.draft) n.textContent = R.draft.keputusan.length + ' keputusan dicatat'; }, 700);
    if (st.terakhir && st.terakhir.tanggal === U.today()) UI.toast('Sudah ada rapat hari ini — ini akan dicatat sebagai rapat tambahan.');
  });
  UI.act('rp-set', () => {
    const s = UI.sheet({ title: 'Jadwal rapat rutin', body: UI.field('Tanggal rapat setiap bulan', `<input type="number" min="1" max="28" name="rapatTanggal" value="${Calc.rapatHari()}">`, 'Muncul di Kalender. Desember otomatis menjadi rapat tahunan dengan Kilas Balik.'),
      foot: `<button class="btn" data-ok>Simpan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { const v = U.clamp(Number(UI.formData(s.el).rapatTanggal) || 1, 1, 28); Store.commit([{ op: 'upsert', t: 'Pengaturan', row: { id: 'rapatTanggal', nilai: String(v) } }]); s.close(); };
  });
  UI.act('rp-hapus', async el => { if (await UI.confirm('Hapus catatan rapat ini?', 'Tugas yang dibuat di rapat ini tidak ikut terhapus.', 'Hapus', true)) { Store.remove('Rapat', el.dataset.id); UI.go('rapat'); } });
  UI.act('tugas-filter', el => { R.filter = el.dataset.v; UI.render(); });

  UI.page('rapat', {
    head: p => ({ title: p ? 'Notulen rapat' : 'Rapat Keuangan', crumb: p ? 'Rapat Keuangan' : 'Lainnya', back: p ? 'rapat' : 'lainnya',
      right: p ? '' : `<button class="icon-btn" data-act="rp-set" aria-label="Jadwal">${I('settings')}</button>` }),
    nav: () => 'lainnya',
    render(p) {
      if (p) {
        const r = Store.byId.Rapat[p];
        if (!r) return UI.empty('users', 'Rapat tidak ditemukan', '');
        const tg = Store.t.Tugas.filter(t => t.rapatId === r.id);
        return `<section class="hero compact"><div class="hero-top"><small>${r.jenis === 'tahunan' ? 'Rapat tahunan' : 'Rapat rutin'}</small>${r.skor ? UI.pill('Skor ' + r.skor, '') : ''}</div>
            <h2 class="hero-amt" style="font-size:22px">${U.tgl(r.tanggal, 'long')}</h2><small>Hadir: ${(r.hadir || []).map(e => U.esc(Store.memberName(e))).join(', ') || '-'} · dicatat ${U.esc(Store.memberName(r.oleh))}</small></section>
          ${UI.sec('Keputusan')}<div class="card list">${(r.keputusan || []).map(k => `<div class="row"><span class="cat-ic">${I(k.tugasId ? 'list-checks' : 'check')}</span><div class="tx-txt"><b>${U.esc(k.teks)}</b>${k.topik ? `<small>${U.esc(k.topik)}</small>` : ''}</div></div>`).join('') || '<div class="row muted">Tidak ada keputusan dicatat.</div>'}</div>
          ${tg.length ? UI.sec('Tugas dari rapat ini') + `<div class="card list">${tg.map(tugasRow).join('')}</div>` : ''}
          ${r.catatan ? UI.sec('Catatan') + `<div class="card"><p style="white-space:pre-wrap">${U.esc(r.catatan)}</p></div>` : ''}
          <button class="btn block ghost danger" data-act="rp-hapus" data-id="${r.id}">${I('trash-2')} Hapus catatan rapat</button><div class="spacer"></div>`;
      }
      const st = Calc.rapatStatus(), list = Calc.rapatList(), tugas = Calc.tugasList(R.filter === 'semua');
      return `<section class="hero compact"><div class="hero-top"><small>${st.sudahBulanIni ? 'Rapat bulan ini sudah dilaksanakan' : 'Rapat berikutnya'}</small>${st.streak ? UI.pill('🔥 ' + st.streak + ' bulan berturut-turut', '') : ''}</div>
          <h2 class="hero-amt" style="font-size:22px">${st.sudahBulanIni ? U.tgl(st.next, 'long') : st.sisa <= 0 ? 'Hari ini' : U.tgl(st.next, 'long')}</h2>
          <small>${st.tahunan ? 'Rapat tahunan — dilengkapi Kilas Balik & target tahun depan' : 'Agenda disusun otomatis dari data keluarga'}</small>
          <button class="btn block on-dark" data-act="rp-mulai">${I('play')} Mulai rapat</button></section>
        ${UI.sec('Tugas', `<div class="chips mini"><button class="chip ${R.filter !== 'semua' ? 'on' : ''}" data-act="tugas-filter" data-v="buka">Berjalan</button><button class="chip ${R.filter === 'semua' ? 'on' : ''}" data-act="tugas-filter" data-v="semua">Semua</button></div>`)}
        <div class="card list">${tugas.map(tugasRow).join('') || '<div class="row muted">Belum ada tugas.</div>'}<div class="row add" data-act="tugas-new">${I('plus')} <span>Tambah tugas</span></div></div>
        ${UI.sec('Riwayat rapat')}<div class="card list">${list.map(r => `<div class="row" data-act="go" data-to="rapat/${r.id}"><span class="cat-ic">${I(r.jenis === 'tahunan' ? 'sparkles' : 'users')}</span><div class="tx-txt"><b>${U.esc(r.judul || 'Rapat')}</b><small>${U.tgl(r.tanggal)} · ${(r.keputusan || []).length} keputusan</small></div>${I('chevron-right')}</div>`).join('') || '<div class="row muted">Belum ada rapat. Mulai yang pertama — 20 menit cukup.</div>'}</div>
        <p class="muted small">Tips: rapat singkat tiap awal bulan, berdua dengan pasangan. Fokus pada keputusan, bukan menyalahkan.</p><div class="spacer"></div>`;
    }
  });
})();
