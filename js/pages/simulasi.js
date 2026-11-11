/* Lainnya › Simulasi Keputusan Besar (I-11) */
(function () {
  const I = UI.icon;
  const S = { arah: 1, s: { jenis: 'cicilan', jumlah: 0, tenor: 12, mulai: U.addMonths(U.today(), 1).slice(0, 7) + '-01', sumber: 'kas', dp: 0, nama: '' } };

  const form = () => {
    const s = S.s, J = Calc.SIM_JENIS, gl = Calc.goals().filter(g => !g.t.arsip && g.dana > 0);
    return `<div class="chips seg">${Object.keys(J).map(k => `<button class="chip ${s.jenis === k ? 'on' : ''}" data-act="sim-jenis" data-v="${k}">${I(J[k].icon)} ${J[k].label}</button>`).join('')}</div>
      <div class="card" id="sim-form">
        <small class="muted">Contoh: ${J[s.jenis].contoh}</small>
        ${UI.field(s.jenis === 'cicilan' ? 'Cicilan per bulan' : s.jenis === 'sekali' ? 'Jumlah dibayar' : 'Perubahan pemasukan per bulan',
          UI.rpInput('jumlah', Math.abs(s.jumlah) || '') + (s.jenis === 'pemasukan' ? `<div class="chips"><button class="chip ${S.arah > 0 ? 'on' : ''}" data-act="sim-arah" data-v="1">${I('trending-up')} Bertambah</button><button class="chip ${S.arah < 0 ? 'on' : ''}" data-act="sim-arah" data-v="-1">${I('trending-down')} Berkurang</button></div>` : ''))}
        <div class="grid2">
          ${UI.field(s.jenis === 'sekali' ? 'Kapan' : 'Mulai', `<input type="month" name="mulai" value="${s.mulai.slice(0, 7)}">`)}
          ${s.jenis === 'cicilan' ? UI.field('Tenor (bulan)', `<input type="number" min="1" max="360" name="tenor" value="${s.tenor || ''}" placeholder="12">`) : ''}
          ${s.jenis === 'sekali' ? UI.field('Dibayar dari', `<select name="sumber"><option value="kas">Kas & tabungan di dompet</option>${gl.map(g => `<option value="g:${g.t.id}" ${s.sumber === 'g:' + g.t.id ? 'selected' : ''}>Tujuan: ${U.esc(g.t.nama)} (${UI.ms(g.dana)})</option>`).join('')}</select>`) : ''}
        </div>
        ${s.jenis === 'cicilan' ? UI.field('Uang muka (opsional)', UI.rpInput('dp', s.dp || ''), 'Dibayar sekali dari kas saat mulai') : ''}
      </div>`;
  };
  const pctChip = (a, b, lebihBaik) => { const d = b - a; if (Math.abs(d) < 0.0005) return ''; const naik = d > 0, baik = lebihBaik === 'naik' ? naik : !naik; return `<em class="${baik ? 'ok' : 'bad'}">${naik ? '▲' : '▼'}</em>`; };
  const hasil = () => {
    const s = S.s;
    if (!s.jumlah) return `<div class="note">${I('info')} Isi angkanya — hasilnya langsung muncul di sini.</div>`;
    const r = Calc.simulasi(s), b = r.b;
    if (!b.inc) return `<div class="alert warn">${I('triangle-alert')}<div><b>Belum ada data pemasukan</b><small>Catat pemasukan rutin (gaji) dulu agar simulasi bisa menghitung.</small></div></div>`;
    const row = (lbl, a, c, fmt, arah) => `<div class="kv"><span>${lbl}</span><b>${fmt(a)} → ${fmt(c)} ${pctChip(a, c, arah)}</b></div>`;
    return `${r.peringatan.length ? `<div class="alert bad">${I('triangle-alert')}<div><b>Perlu dipertimbangkan</b>${r.peringatan.map(x => `<small>• ${U.esc(x)}</small>`).join('')}</div></div>` : `<div class="alert ok">${I('circle-check')}<div><b>Masih dalam batas aman</b><small>Rasio cicilan, saldo kas, dan dana darurat tetap sehat.</small></div></div>`}
      <div class="card kv-list sim-res">
        ${row('Uang aman per hari', r.perHari0, r.perHari, v => U.rp(Math.round(v)), 'naik')}
        ${row('Rasio cicilan', r.dsr0, r.dsr, v => U.pct(v, 1), 'turun')}
        ${row('Skor kesehatan (perkiraan)', r.score0, r.score, v => String(v), 'naik')}
        ${row('Dana darurat', r.efBulan0, r.efBulan, v => U.fmtNum(Math.round(v * 10) / 10) + ' bln', 'naik')}
        ${row('Sisa uang per bulan', r.surplus0, r.surplus1, v => UI.ms(v), 'naik')}
      </div>
      ${UI.sec('Proyeksi saldo kas 12 bulan', '<small class="muted">garis putus = tanpa keputusan ini</small>')}
      <div class="card">${Charts.line(r.sim.map(p => ({ d: p.d, bal: p.bal })), { compare: r.base, fit: true, fmt: 'mys', ticks: [0, 6, 12], aria: 'Proyeksi saldo kas 12 bulan' })}
        <div class="row-sp small"><span class="muted">Akhir 12 bulan</span><b>${UI.ms(r.sim[12].bal)} <small class="muted">(tanpa: ${UI.ms(r.base[12].bal)})</small></b></div></div>
      ${UI.sec('Tujuan yang terpengaruh')}
      ${r.surplus1 < b.setoran && b.setoran > 0 ? `<div class="note">${I('info')} Sisa uang ${UI.ms(Math.max(0, r.surplus1))}/bln hanya cukup untuk ${U.pct(U.clamp(r.surplus1 / b.setoran, 0, 1))} setoran Tujuan (${UI.ms(b.setoran)}/bln). Tujuan di bawah melambat bila setoran dikurangi merata.</div>` : ''}
      <div class="card list">${r.goals.length ? r.goals.map(x => `<div class="row"><span class="cat-ic">${I(x.g.t.ikon || 'target')}</span><div class="tx-txt"><b>${U.esc(x.g.t.nama)}</b><small>${x.est0 ? U.tgl(x.est0, 'my') : '—'} → ${x.est1 && x.m1 <= 120 ? U.tgl(x.est1, 'my') : 'lebih dari 10 tahun'}</small></div><b class="bad">${x.mundur === Infinity || x.m1 > 120 ? 'tertunda' : '+' + (x.mundur >= 24 ? Math.round(x.mundur / 12) + ' thn' : x.mundur + ' bln')}</b></div>`).join('')
        : `<div class="row muted">${I('circle-check')} Tidak ada Tujuan yang mundur.</div>`}</div>
      <p class="muted small">Dasar hitungan: pemasukan rata-rata ${UI.ms(b.inc)}/bln, pengeluaran rata-rata 3 bulan ${UI.ms(b.out)}/bln, setoran Tujuan ${UI.ms(b.setoran)}/bln, kas likuid ${UI.ms(b.kas)}. Ini perkiraan, bukan kepastian.</p>
      <div class="grid2"><button class="btn ghost" data-act="sim-simpan">${I('save')} Simpan skenario</button><button class="btn ghost" data-act="go" data-to="rapat">${I('users')} Bahas di rapat</button></div>`;
  };
  const baca = () => {
    const f = document.getElementById('sim-form'); if (!f) return;
    const v = UI.formData(f), s = S.s;
    s.jumlah = (Number(v.jumlah) || 0) * (s.jenis === 'pemasukan' ? S.arah : 1);
    if (v.mulai) s.mulai = v.mulai + '-01';
    if (v.tenor !== undefined) s.tenor = Number(v.tenor) || 0;
    if (v.sumber !== undefined) s.sumber = v.sumber;
    if (v.dp !== undefined) s.dp = Number(v.dp) || 0;
  };
  const segarkan = () => { const h = document.getElementById('sim-hasil'); if (h) h.innerHTML = hasil(); };
  UI.act('sim-jenis', el => { baca(); S.s.jenis = el.dataset.v; if (S.s.jenis !== 'pemasukan') S.s.jumlah = Math.abs(S.s.jumlah); UI.render(); });
  UI.act('sim-arah', el => { S.arah = Number(el.dataset.v); baca(); S.s.jumlah = Math.abs(S.s.jumlah) * S.arah; UI.render(); });
  UI.act('sim-buka', el => { const x = Store.byId.Skenario[el.dataset.id]; if (!x) return; S.s = Object.assign({}, S.s, x.data || {}, { nama: x.nama }); S.arah = S.s.jumlah < 0 ? -1 : 1; UI.go('simulasi'); UI.render(); });
  UI.act('sim-hapus', async el => { if (await UI.confirm('Hapus skenario ini?', 'Skenario hanya catatan simulasi; data keuangan tidak berubah.', 'Hapus', true)) Store.remove('Skenario', el.dataset.id); });
  UI.act('sim-simpan', () => {
    baca();
    const s = S.s, J = Calc.SIM_JENIS[s.jenis];
    const def = s.nama || (J.label + ' ' + UI.ms(Math.abs(s.jumlah)) + (s.jenis === 'cicilan' && s.tenor ? ' × ' + s.tenor + ' bln' : ''));
    const sh = UI.sheet({ title: 'Simpan skenario', body: UI.field('Nama skenario', `<input name="nama" value="${U.esc(def)}" maxlength="60">`) + UI.field('Catatan', `<textarea name="catatan" rows="2" placeholder="mis. ganti mobil tahun depan"></textarea>`),
      foot: `<button class="btn" data-ok>${I('save')} Simpan</button>` });
    sh.el.querySelector('[data-ok]').onclick = () => {
      const f = UI.formData(sh.el), r = Calc.simulasi(s);
      Store.commit([{ op: 'upsert', t: 'Skenario', row: { id: U.uid('sk'), nama: f.nama || def, jenis: s.jenis, data: { jenis: s.jenis, jumlah: s.jumlah, tenor: s.tenor, mulai: s.mulai, sumber: s.sumber, dp: s.dp, ringkas: { dsr: r.dsr, skor: r.score, perHari: Math.round(r.perHari), mundur: r.goals.length } }, catatan: f.catatan || '', dibuat: new Date().toISOString(), oleh: Store.me.email } }]);
      sh.close(); UI.toast('Skenario disimpan — bisa dibahas di Rapat Keuangan.');
    };
  });

  UI.page('simulasi', {
    head: () => ({ title: 'Simulasi Keputusan', crumb: 'Lainnya', back: 'lainnya' }), nav: () => 'lainnya',
    render() {
      const sk = Calc.skenario();
      return `<p class="muted small">Coba dulu dampaknya sebelum memutuskan: cicilan baru, pengeluaran besar, atau perubahan pemasukan.</p>
        ${form()}<div id="sim-hasil">${hasil()}</div>
        ${sk.length ? UI.sec('Skenario tersimpan') + `<div class="card list">${sk.map(x => `<div class="row" data-act="sim-buka" data-id="${x.id}"><span class="cat-ic">${I((Calc.SIM_JENIS[x.jenis] || {}).icon || 'git-fork')}</span><div class="tx-txt"><b>${U.esc(x.nama)}</b><small>${U.tgl(String(x.dibuat).slice(0, 10))} · ${Store.memberName(x.oleh)}${x.data && x.data.ringkas ? ' · rasio cicilan ' + U.pct(x.data.ringkas.dsr, 1) + ' · skor ' + x.data.ringkas.skor : ''}</small></div><button class="icon-btn" data-act="sim-hapus" data-id="${x.id}" aria-label="Hapus">${I('trash-2')}</button></div>`).join('')}</div>` : ''}
        <div class="spacer"></div>`;
    },
    after(el) {
      const f = el.querySelector('#sim-form'); if (!f) return;
      let t; f.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { baca(); segarkan(); }, 200); });
      f.addEventListener('change', () => { baca(); segarkan(); });
    }
  });
})();
