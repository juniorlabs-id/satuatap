/* Telegram @SatuAtapBot, WhatsApp (Fonnte keluarga), Kotak catatan dari chat, pengingat dari aplikasi */
(function () {
  const I = UI.icon, App = window.App = window.App || {};
  const N = { info: null, infoAt: 0, kotakAt: 0 };
  const lsKotak = () => 'sa:kotak:' + ((Store.me && Store.me.email) || '');
  const bacaKotak = () => { try { return JSON.parse(localStorage.getItem(lsKotak()) || '[]'); } catch (e) { return []; } };
  const tulisKotak = a => { try { localStorage.setItem(lsKotak(), JSON.stringify(a.slice(-100))); } catch (e) {} };
  const relayOk = () => Store.mode === 'demo' || (Store.mode === 'live' && Relay.enabled() && Store.fileId);

  /** Jenis pengingat Telegram yang aktif untuk keluarga (pengaturan bersama). */
  UI.NOTIF_JENIS = [['tagihan', 'Tagihan & cicilan (H-7, H-3, H-1, hari H)'], ['amplop', 'Amplop anggaran terpakai 80% & 100%'], ['emas', 'Alert harga emas'], ['rapat', 'Rapat keuangan'], ['insight', 'Insight mingguan AI (untuk yang memakai AI)']];
  const notifSet = () => { let o = {}; try { o = JSON.parse(Store.setting('notifTelegram', '{}')) || {}; } catch (e) {} UI.NOTIF_JENIS.forEach(j => { if (o[j[0]] === undefined) o[j[0]] = true; }); return o; };

  // ---------- Status Telegram ----------
  N.muatInfo = async (force) => {
    if (!relayOk()) return null;
    if (!force && N.info && Date.now() - N.infoAt < 10 * 60e3) return N.info;
    const r = await Relay.call('tg.info', { fileId: Store.fileId });
    if (r.success) { N.info = r.data; N.infoAt = Date.now(); try { localStorage.setItem('sa:tginfo:' + Store.fileId, JSON.stringify(r.data)); } catch (e) {} }
    return N.info;
  };
  const infoCache = () => { if (N.info) return N.info; try { return JSON.parse(localStorage.getItem('sa:tginfo:' + Store.fileId) || 'null'); } catch (e) { return null; } };
  UI.act('tg-hubung', async el => {
    el.disabled = true;
    const r = await Relay.call('tg.kode', { fileId: Store.fileId, nama: Store.me.nama });
    el.disabled = false;
    if (!r.success) return UI.toast(r.message || 'Gagal membuat kode.', 'warn');
    const s = UI.sheet({ title: 'Hubungkan Telegram', body: `<ol class="steps"><li>Ketuk tombol di bawah — Telegram terbuka di chat <b>@${U.esc(r.data.bot)}</b>.</li><li>Ketuk <b>Mulai / Start</b>. Selesai — bot membalas "Terhubung".</li></ol>
        <p class="muted small">Kode sekali pakai, berlaku ${r.data.berlaku} menit: <code>${U.esc(r.data.kode)}</code>. Bila tombol tidak membuka Telegram, kirim <code>/start ${U.esc(r.data.kode)}</code> ke @${U.esc(r.data.bot)}.</p>`,
      foot: `<a class="btn" href="${U.esc(r.data.link)}" target="_blank" rel="noopener">${I('send')} Buka Telegram</a><button class="btn ghost" data-ok>Sudah</button>` });
    s.el.querySelector('[data-ok]').onclick = async () => { s.close(); await N.muatInfo(true); UI.render(); };
  });
  UI.act('tg-putus', async el => {
    if (!(await UI.confirm('Putuskan Telegram?', 'Pengingat & catat lewat chat berhenti untuk ' + (el.dataset.email ? Store.memberName(el.dataset.email) : 'akun Anda') + '.', 'Putuskan', true))) return;
    const r = await Relay.call('tg.putus', { fileId: Store.fileId, email: el.dataset.email || '' });
    UI.toast(r.success ? 'Telegram diputus.' : (r.message || 'Gagal.'), r.success ? '' : 'warn'); await N.muatInfo(true); UI.render();
  });
  UI.act('tg-uji', async () => {
    const r = await Relay.call('tg.kirim', { fileId: Store.fileId, pesan: [{ ke: Store.me.email, teks: '✅ Pesan uji dari SatuAtap. Pengingat keluarga ' + U.esc(Store.setting('namaKeluarga', '')) + ' akan masuk ke sini.', kunci: 'uji|' + Date.now() }] });
    UI.toast(r.success ? (r.data.demo ? 'Mode demo: pesan tidak benar-benar dikirim.' : r.data.terkirim ? 'Terkirim — cek Telegram.' : 'Belum ada Telegram terhubung untuk akun ini.') : r.message, r.success && r.data.terkirim ? '' : 'warn');
  });
  UI.act('tg-jenis', () => {
    const o = notifSet();
    const s = UI.sheet({ title: 'Isi pengingat Telegram', body: UI.NOTIF_JENIS.map(j => `<label class="check"><input type="checkbox" name="${j[0]}" ${o[j[0]] ? 'checked' : ''}><span>${j[1]}</span></label>`).join('') + '<p class="muted small">Berlaku untuk semua anggota yang menghubungkan Telegram.</p>',
      foot: `<button class="btn" data-ok>Simpan</button>` });
    s.el.querySelector('[data-ok]').onclick = () => { const f = UI.formData(s.el), v = {}; UI.NOTIF_JENIS.forEach(j => v[j[0]] = !!f[j[0]]); Store.commit([{ op: 'upsert', t: 'Pengaturan', row: { id: 'notifTelegram', nilai: JSON.stringify(v) } }]); s.close(); };
  });
  UI.act('pend-salin', async () => {
    const t = `const FILE_ID = '${Store.fileId}';\nconst RELAY_URL = '${APP_CONFIG.RELAY_URL || ''}';`;
    try { await navigator.clipboard.writeText(t); UI.toast('Pengaturan Pendamping disalin.'); } catch (e) { prompt('Salin dua baris ini ke Pendamping.gs:', t); }
  });

  /** Kartu-kartu untuk halaman Lainnya › Notifikasi. */
  UI.notifKartu = () => {
    const inf = infoCache(), on = inf && inf.aktif, me = Store.me.email, o = notifSet();
    if (relayOk() && Date.now() - N.infoAt > 60e3) N.muatInfo().then(x => { if (x && UI.cur === 'pengaturan') UI.render(); }).catch(() => {});
    const anggota = Store.members(), terh = inf ? inf.terhubung || [] : [];
    const tg = !relayOk() ? `<p class="muted small">Tersedia setelah masuk dengan akun Google.</p>`
      : inf && !on ? `<p class="muted small">Bot Telegram belum diaktifkan oleh JuniorLabs.</p>`
      : `<div class="list">${anggota.map(m => { const t = terh.find(x => x.email === m.email); return `<div class="row"><span class="cat-ic ${t ? 'ok' : ''}">${I(t ? 'circle-check' : 'circle')}</span><div class="tx-txt"><b>${U.esc(m.nama)}</b><small>${t ? 'Terhubung' + (t.username ? ' · @' + U.esc(t.username) : '') : 'Belum terhubung'}</small></div>
          ${t && (m.email === me || Store.isAdminLike()) ? `<button class="btn ghost xs" data-act="tg-putus" data-email="${m.email === me ? '' : U.esc(m.email)}">Putus</button>` : ''}</div>`; }).join('')}</div>
        <div class="row-btns">${terh.some(x => x.email === me) ? `<button class="btn ghost sm" data-act="tg-uji">${I('send')} Kirim pesan uji</button>` : `<button class="btn sm" data-act="tg-hubung">${I('send')} Hubungkan Telegram saya</button>`}
          ${Store.isAdminLike() ? `<button class="btn ghost sm" data-act="tg-jenis">${I('sliders-horizontal')} Isi pengingat</button>` : ''}</div>
        <small class="muted">Aktif: ${UI.NOTIF_JENIS.filter(j => o[j[0]]).map(j => j[1].split(' (')[0]).join(' · ') || 'tidak ada'}</small>`;
    return `<div class="card"><h4 class="mini-h">${I('send')} Telegram @${U.esc((inf && inf.bot) || 'SatuAtapBot')} <span class="pill ok">gratis</span></h4>
        <p class="small">Pengingat tagihan, alert emas, dan <b>catat lewat chat</b> — kirim "makan siang 45rb gopay", lalu konfirmasi kategorinya di aplikasi. Setiap anggota menghubungkan akunnya sendiri.</p>${tg}</div>
      <div class="card"><h4 class="mini-h">${I('message-circle')} WhatsApp <span class="pill">opsional</span></h4>
        <p class="small">Pakai akun <b>Fonnte milik keluarga</b> (paket gratis tersedia di fonnte.com) lewat Skrip Pendamping: pengingat yang sama ke WA dan catat lewat chat WA. Token Fonnte disimpan di Script Properties Pendamping Anda — tidak di aplikasi, tidak di JuniorLabs.</p>
        <p class="muted small">Cara pasang: Panduan Instalasi Bagian C, langkah WhatsApp.</p></div>`;
  };
  UI.pendampingKartu = () => Store.mode !== 'live' ? '' : `<div class="kv-list"><div class="kv"><span>ID file keluarga</span><b><code class="wrap">${U.esc(Store.fileId)}</code></b></div></div>
    <button class="btn ghost sm" data-act="pend-salin">${I('copy')} Salin pengaturan Pendamping</button>`;

  // ---------- Kotak: catatan dari Telegram / WA ----------
  // Relay menyimpan pesan sampai aplikasi menandainya selesai (tg.selesai), jadi catatan tidak hilang walau
  // diambil perangkat lain. Pesan yang lengkap (nominal + kategori + dompet terbaca) langsung dicatat ke Mutasi;
  // sisanya menunggu di Beranda & Mutasi untuk dipilih kategori/dompetnya.
  const W = id => (Store.byId.Wallet[id] || {}).nama || 'pilih dompet', K = id => (Store.byId.Kategori[id] || {}).nama || 'pilih kategori';
  const txId = x => 't_k' + String(x.id).replace(/[^A-Za-z0-9]/g, '');
  const lengkap = r => r.jumlah && r.kategoriId && r.walletId && !(Store.byId.Kategori[r.kategoriId] || {}).pribadi;
  const rowOf = (x, r) => ({ op: 'upsert', t: 'Transaksi', row: { id: txId(x), tanggal: String(x.waktu || '').slice(0, 10) || U.today(), jenis: r.jenis, jumlah: r.jumlah, kategoriId: r.kategoriId, walletId: r.walletId, walletTujuan: '', biaya: 0,
    catatan: r.catatan || x.teks, dibayarOleh: Store.me.email, tag: '', sumber: x.sumber || 'telegram', refId: '', periodeRef: '', dicatatOleh: Store.me.email, dibuat: new Date().toISOString(), riwayat: [] } });
  const ringkas = (r) => (r.catatan ? r.catatan + ' · ' : '') + U.rp(r.jumlah) + ' · ' + K(r.kategoriId) + ' · ' + W(r.walletId);
  const selesai = (ids, info) => { if (ids.length && relayOk()) Relay.call('tg.selesai', { fileId: Store.fileId, ids, info: info || {} }).catch(() => {}); };
  App.ambilKotak = async (force) => {
    if (!relayOk() || N.kotakJalan || (!force && Date.now() - N.kotakAt < 60e3)) return;
    N.kotakAt = Date.now(); N.kotakJalan = true;
    try {
      const r = await Relay.call('tg.ambil', { fileId: Store.fileId });
      if (!r.success || !r.data) return;
      const datang = r.data.item || [], lama = bacaKotak();
      // relay baru (ack) = sumber kebenaran; relay lama: gabungkan dengan yang tersimpan di perangkat
      let a = r.data.ack ? datang.slice() : lama.concat(datang.filter(x => !lama.some(y => y.id === x.id)));
      const simpan = [], info = {}, sudah = [];
      a = a.filter(x => {
        if (Store.byId.Transaksi[txId(x)]) { sudah.push(x.id); return false; }     // sudah dicatat perangkat lain
        const p = Voice.parse(x.teks); if (!lengkap(p)) return true;
        simpan.push(rowOf(x, p)); info[x.id] = ringkas(p); return false;
      });
      if (simpan.length) {
        Store.commit(simpan);
        UI.toast(simpan.length === 1 ? 'Dari Telegram tercatat: ' + Object.values(info)[0] : simpan.length + ' catatan dari Telegram masuk ke Mutasi.', 'ok', { ms: 5000 });
      }
      selesai(Object.keys(info).concat(sudah), info);
      const berubah = JSON.stringify(a.map(x => x.id)) !== JSON.stringify(lama.map(x => x.id));
      tulisKotak(a);
      if ((berubah || simpan.length) && (UI.cur === 'beranda' || UI.cur === 'mutasi')) UI.render();
    } catch (e) {} finally { N.kotakJalan = false; }
  };
  // Ambil juga saat aplikasi dibuka lagi dari latar belakang
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && window.App && App.ready) App.ambilKotak().catch(() => {}); });
  UI.kotakAlert = () => {
    const a = bacaKotak(); if (App.ready) setTimeout(() => App.ambilKotak().catch(() => {}), 300);
    if (!a.length) return '';
    return `<div class="alert" data-act="kotak-buka">${I('inbox')}<div><b>${a.length} catatan dari chat perlu dilengkapi</b><small>${U.esc(a.slice(0, 2).map(x => x.teks).join(' · ').slice(0, 70))}</small></div>${I('chevron-right')}</div>`;
  };
  UI.act('kotak-buka', () => {
    const a = bacaKotak(); if (!a.length) return;
    const p = a.map(x => Object.assign({}, x, { r: Voice.parse(x.teks) }));
    const s = UI.sheet({ title: 'Catatan dari chat', body: `<p class="muted small">Kategori atau dompetnya belum terbaca. Ketuk ${I('pencil')} untuk melengkapi, atau ${I('check')} bila sudah benar.</p>
      <div class="list">${p.map((x, i) => `<div class="row kotak-row"><span class="cat-ic">${I(x.sumber === 'wa' ? 'message-circle' : 'send')}</span><div class="tx-txt"><b>${U.esc(x.teks)}</b>
        <small>${x.r.jumlah ? UI.ms(x.r.jumlah) + ' · ' : ''}${U.esc(K(x.r.kategoriId))} · ${U.esc(W(x.r.walletId))} · ${U.timeAgo(x.waktu)}</small></div>
        <div class="row-btns"><button class="btn xs" data-i="${i}" data-a="ubah">${I('pencil')}</button>${x.r.jumlah && x.r.kategoriId && x.r.walletId ? `<button class="btn xs" data-i="${i}" data-a="simpan">${I('check')}</button>` : ''}<button class="btn ghost xs" data-i="${i}" data-a="buang" aria-label="Buang">${I('trash-2')}</button></div></div>`).join('')}</div>`,
      foot: p.some(x => x.r.jumlah && x.r.kategoriId && x.r.walletId) ? `<button class="btn" data-semua>${I('check-check')} Simpan yang lengkap</button>` : '' });
    const hapus = ids => tulisKotak(bacaKotak().filter(x => ids.indexOf(x.id) < 0));
    s.el.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const x = p[+b.dataset.i];
      if (b.dataset.a === 'buang') { hapus([x.id]); selesai([x.id]); b.closest('.row').remove(); if (!bacaKotak().length) s.close(); UI.render(); return; }
      if (b.dataset.a === 'simpan') { if (await UI.commitPriv([rowOf(x, x.r)])) { hapus([x.id]); selesai([x.id], { [x.id]: ringkas(x.r) }); b.closest('.row').remove(); UI.toast('Disimpan.'); if (!bacaKotak().length) s.close(); } return; }
      s.close();
      UI.catat({ preset: { jenis: x.r.jenis, jumlah: x.r.jumlah, kategoriId: x.r.kategoriId, walletId: x.r.walletId, catatan: x.r.catatan || x.teks, tanggal: String(x.waktu || '').slice(0, 10), sumber: x.sumber || 'telegram' },
        onSaved: () => { hapus([x.id]); selesai([x.id]); } });
    });
    const sm = s.el.querySelector('[data-semua]');
    if (sm) sm.onclick = async () => { const ok = p.filter(x => x.r.jumlah && x.r.kategoriId && x.r.walletId); if (await UI.commitPriv(ok.map(x => rowOf(x, x.r)))) { hapus(ok.map(x => x.id)); const inf = {}; ok.forEach(x => { inf[x.id] = ringkas(x.r); }); selesai(ok.map(x => x.id), inf); s.close(); UI.toast(ok.length + ' catatan disimpan.'); } };
  });

  // ---------- Pengingat yang dikirim dari aplikasi (melengkapi Skrip Pendamping) ----------
  const adaTelegram = () => { const inf = infoCache(); return inf && inf.aktif && (inf.terhubung || []).length; };
  const kirim = (pesan) => pesan.length && relayOk() && Store.mode === 'live' ? Relay.call('tg.kirim', { fileId: Store.fileId, pesan }).catch(() => {}) : null;
  /** Dipanggil setelah sinkron: tagihan H-7/H-3/H-1/H & rapat (kunci sama dengan Pendamping → tidak dobel). Sekali per jam per perangkat. */
  App.notifTagihan = () => {
    if (!adaTelegram()) return;
    const k = 'sa:tgNotif:' + Store.fileId, last = Number(localStorage.getItem(k) || 0);
    if (Date.now() - last < 3600e3 || new Date().getHours() < 7) return;
    localStorage.setItem(k, String(Date.now()));
    const o = notifSet(), pesan = [], today = U.today();
    if (o.tagihan) Calc.occurrences(today, U.addDays(today, 7)).forEach(x => {
      if (x.arah !== 'keluar' || x.lunas || x.kind === 'rapat' || x.kind === 'tujuan') return;
      const h = U.diffDays(today, x.tanggal); if ([7, 3, 1, 0].indexOf(h) < 0) return;
      const occ = x.kind === 'acara' ? 'a|' + x.ref.id : x.id;
      pesan.push({ ke: 'semua', kunci: 'occ|' + occ + '|H-' + h, teks: (h <= 1 ? '🔔 ' : '🗓️ ') + U.esc(x.nama) + ' · <b>' + U.rp(x.sisa) + '</b> jatuh tempo ' + (h === 0 ? '<b>hari ini</b>' : h === 1 ? '<b>besok</b>' : h + ' hari lagi (' + U.tgl(x.tanggal, 'dm') + ')') + '.' });
    });
    if (o.rapat) { const st = Calc.rapatStatus(); if (!st.sudahBulanIni && (st.sisa === 0 || st.sisa === 1)) pesan.push({ ke: 'semua', kunci: 'rapat|' + st.next.slice(0, 7) + '|H-' + st.sisa, teks: '👥 Rapat keuangan keluarga ' + (st.sisa === 0 ? '<b>hari ini</b>' : '<b>besok</b>') + '. Agendanya sudah disusun otomatis di aplikasi.' }); }
    kirim(pesan.slice(0, 20));
  };
  /** Amplop melewati 80% / 100% setelah transaksi dicatat di perangkat ini. */
  const tingkat = {};
  /** Dipakai modul lain (mis. alert SL/TP saham). */
  App.tgSiap = () => adaTelegram();
  App.tgKirim = (pesan) => kirim(pesan);
  App.notifAmplop = () => {
    if (!adaTelegram() || !notifSet().amplop) return;
    const p = Calc.period(), pesan = [];
    Calc.envelopes(p).forEach(e => {
      if (!e.efektif || e.k.pribadi) return;
      const lv = e.pct >= 1 ? 100 : e.pct >= 0.8 ? 80 : 0, key = e.k.id + '|' + p.key;
      if (tingkat[key] === undefined) { tingkat[key] = lv; return; }          // pertama kali: catat tingkat awal saja
      if (lv > tingkat[key]) pesan.push({ ke: 'semua', kunci: 'amp|' + key + '|' + lv, teks: (lv === 100 ? '🚨 Amplop <b>' : '⚠️ Amplop <b>') + U.esc(e.k.nama) + '</b> sudah terpakai ' + Math.round(e.pct * 100) + '% (' + U.rp(e.terpakai) + ' dari ' + U.rp(e.efektif) + ').' + (lv === 100 ? ' Sisa periode: ' + Calc.daysLeft(p) + ' hari.' : '') });
      tingkat[key] = lv;
    });
    kirim(pesan);
  };
  /** Kirim target alert emas ke relay bila berubah (relay yang memeriksa setiap harga baru). */
  App.syncAlertEmas = () => {
    if (!relayOk() || Store.mode !== 'live') return;
    const v = notifSet().emas ? Store.setting('hargaAlert', '{}') : '{}', k = 'sa:tgAlert:' + Store.fileId;
    if (localStorage.getItem(k) === v) return;
    let a = {}; try { a = JSON.parse(v) || {}; } catch (e) {}
    Relay.call('tg.alert', { fileId: Store.fileId, jual: a.jual || 0, beli: a.beli || 0 }).then(r => { if (r.success) localStorage.setItem(k, v); }).catch(() => {});
  };
  /** Insight mingguan AI → Telegram pemiliknya (kunci per minggu). */
  App.kirimInsight = (o) => { if (o && adaTelegram() && notifSet().insight) kirim([{ ke: Store.me.email, kunci: 'insight|' + o.minggu + '|' + Store.me.email, teks: '✨ <b>Insight minggu ini</b>\n' + U.esc(o.teks) }]); };
})();
