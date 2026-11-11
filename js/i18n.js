/* ============================================================
 * Bahasa (U-05): Indonesia (bawaan) / English
 *  - Teks antarmuka ditulis dalam bahasa Indonesia di kode; saat English
 *    dipilih, lapisan ini menerjemahkan teks yang tampil (DOM) memakai kamus
 *    js/i18n-en.js. Data milik keluarga (nama kategori, catatan) tidak diubah.
 *  - Angka & nominal diganti token ({n}, {rp}, {p}, {m}) sebelum dicari di kamus,
 *    sehingga "3 hari lagi" dan "12 hari lagi" memakai satu entri.
 *  - Disimpan per akun di perangkat (sa:lang:<email>), bawaan mengikuti bahasa HP.
 * ============================================================ */
(function () {
  const BLN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BLN_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BLNL_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const HARI_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = 'Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|January|February|March|May|June|July|August|October|December|Jan|Feb|Mar|Apr|Jun|Jul|Agu|Aug|Sep|Okt|Oct|Nov|Des|Dec';
  const DAYS = 'Minggu|Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday';
  const RE_TOK = new RegExp('(-?Rp\\s?[\\d.,]+(?:\\s?(?:jt|rb|M|K|B))?|Rp\\s?•+)|(-?\\d+(?:[.,]\\d+)*\\s?%)|\\b(' + MONTHS + '|' + DAYS + ')\\b|(\\d+(?:[.,]\\d+)*)', 'g');
  const I18N = { lang: 'id', dict: {}, cache: new Map(), frasa: [] };

  /** Teks → {key, vals}: nominal {rp}, persen {p}, bulan/hari {m}, angka {n}. */
  I18N.kunci = (s) => {
    const vals = [];
    const key = s.replace(RE_TOK, (all, rp, p, m, n) => { vals.push(all); return rp ? '{rp}' : p ? '{p}' : m ? '{m}' : '{n}'; });
    return { key, vals };
  };
  const pasang = (tpl, vals) => { let i = 0; return tpl.replace(/\{(rp|p|m|n)\}/g, () => vals[i++] == null ? '' : vals[i - 1]); };

  /** Terjemahkan satu teks (null bila tidak ada di kamus). */
  I18N.t = (raw) => {
    if (I18N.lang === 'id' || !raw) return null;
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], s = raw.trim();
    if (!s || !/[A-Za-z]/.test(s)) return null;
    if (I18N.cache.has(s)) { const c = I18N.cache.get(s); return c == null ? null : lead + c + trail; }
    let out = null;
    const d = I18N.dict;
    if (d[s] != null) out = d[s];
    else {
      const k = I18N.kunci(s);
      if (k.vals.length && d[k.key] != null) out = pasang(d[k.key], k.vals);
      else if (/ · /.test(s)) {                                   // "A · B · C" → terjemahkan per bagian
        const parts = s.split(' · '), tr = parts.map(p => { const x = I18N.t(p); return x == null ? p : x.trim(); });
        if (tr.some((x, i) => x !== parts[i])) out = tr.join(' · ');
      } else if (/^[^:]{2,40}: /.test(s)) {                          // "Label: nilai"
        const i = s.indexOf(': '), lab = I18N.t(s.slice(0, i));
        if (lab != null) out = lab.trim() + ': ' + (I18N.t(s.slice(i + 2)) || s.slice(i + 2)).trim();
      }
      if (out == null && s.length > 12) {                           // frasa panjang yang dikenal di dalam teks
        let x = ' ' + s + ' ', ganti = false;
        for (const f of I18N.frasa) { if (x.indexOf(f[0]) > -1) { x = x.split(f[0]).join(f[1]); ganti = true; } }
        if (ganti) out = x.slice(1, -1);
      }
    }
    if (I18N.cache.size > 5000) I18N.cache.clear();
    I18N.cache.set(s, out);
    return out == null ? null : lead + out + trail;
  };

  const ATTR = ['placeholder', 'aria-label', 'title'];
  const lewati = el => el && (el.closest('[data-noi18n],script,style,code,textarea') != null);
  I18N.apply = (root) => {
    if (I18N.lang === 'id' || !root) return;
    if (root.nodeType === 3) { if (!lewati(root.parentElement)) { const t = I18N.t(root.nodeValue); if (t != null && t !== root.nodeValue) root.nodeValue = t; } return; }
    if (root.nodeType !== 1 || lewati(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => n.nodeValue.trim() && !lewati(n.parentElement) ? 1 : 2 });
    const nodes = []; let n; while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(x => { const t = I18N.t(x.nodeValue); if (t != null && t !== x.nodeValue) x.nodeValue = t; });
    const els = root.querySelectorAll ? [root].concat([...root.querySelectorAll('[placeholder],[aria-label],[title],option')]) : [];
    els.forEach(el => ATTR.forEach(a => { const v = el.getAttribute && el.getAttribute(a); if (v) { const t = I18N.t(v); if (t != null) el.setAttribute(a, t); } }));
  };

  I18N.key = () => 'sa:lang:' + ((window.Store && Store.me && Store.me.email) || (window.Auth && Auth.email) || '');
  I18N.pilihan = () => localStorage.getItem(I18N.key()) || localStorage.getItem('sa:lang') || 'id';
  I18N.set = (lang) => { try { localStorage.setItem(I18N.key(), lang); localStorage.setItem('sa:lang', lang); } catch (e) {} if (lang === (I18N.lang || 'id')) return; location.reload(); };

  /** Dipanggil sekali saat aplikasi dimuat. */
  I18N.init = () => {
    I18N.lang = I18N.pilihan() === 'en' && window.I18N_EN ? 'en' : 'id';
    document.documentElement.lang = I18N.lang;
    if (I18N.lang !== 'en') return;
    I18N.dict = window.I18N_EN;
    I18N.frasa = Object.keys(I18N.dict).filter(k => k.length >= 8 && / /.test(k) && !/[{]/.test(k)).sort((a, b) => b.length - a.length).slice(0, 400).map(k => [' ' + k + ' ', ' ' + I18N.dict[k] + ' ']);
    // tanggal, nominal & waktu relatif
    BLN_EN.forEach((b, i) => { U.BLN[i] = b; U.BLN_L[i] = BLNL_EN[i]; });
    HARI_EN.forEach((h, i) => { U.HARI[i] = h; });
    const rpS = U.rpShort;
    U.rpShort = v => rpS(v).replace(/(\d),(\d)/, '$1.$2').replace(/ jt$/, 'M').replace(/ rb$/, 'K').replace(/ M$/, 'B');
    const pct = U.pct; U.pct = (v, d) => pct(v, d).replace(',', '.');
    U.relDay = s => { const n = U.diffDays(U.today(), s); if (n === 0) return 'Today'; if (n === 1) return 'Tomorrow'; if (n === -1) return 'Yesterday'; return n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago'; };
    const ta = U.timeAgo;
    U.timeAgo = iso => { const x = ta(iso); return x.replace(/^baru saja$/, 'just now').replace(/(\d+) mnt lalu/, '$1 min ago').replace(/(\d+) jam lalu/, '$1 h ago').replace(/(\d+) hari lalu/, '$1 days ago'); };
    // terjemahkan semua yang tampil / ditambahkan
    const mo = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') { I18N.apply(m.target); continue; }
        if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName), t = v && I18N.t(v); if (t != null && t !== v) m.target.setAttribute(m.attributeName, t); continue; }
        m.addedNodes.forEach(n => I18N.apply(n));
      }
    });
    const start = () => { I18N.apply(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR }); };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
    // toast/konfirmasi yang memakai alert()/confirm()/prompt() bawaan
    const wrap = f => function (m, d) { return f.call(window, I18N.t(String(m || '')) || m, d); };
    window.alert = wrap(window.alert); window.confirm = wrap(window.confirm); window.prompt = wrap(window.prompt);
  };
  window.I18N = I18N;
  I18N.init();
})();
