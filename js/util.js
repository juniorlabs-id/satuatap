/* Util umum — format angka, tanggal, id, escape HTML */
(function () {
  const U = {};
  const nf = new Intl.NumberFormat('id-ID');
  U.num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  U.rp = (v, opt) => {
    const n = Math.round(U.num(v));
    if (opt && opt.hide) return 'Rp •••••';
    if (opt && opt.short) return U.rpShort(n);
    return (n < 0 ? '-Rp ' : 'Rp ') + nf.format(Math.abs(n));
  };
  U.rpShort = v => {
    const n = U.num(v), a = Math.abs(n), s = n < 0 ? '-' : '';
    if (a >= 1e9) return s + 'Rp ' + (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace('.', ',') + ' M';
    if (a >= 1e6) return s + 'Rp ' + (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' jt';
    if (a >= 1e3) return s + 'Rp ' + Math.round(a / 1e3) + ' rb';
    return s + 'Rp ' + a;
  };
  U.fmtNum = v => nf.format(Math.round(U.num(v)));
  U.pct = (v, d) => (U.num(v) * 100).toFixed(d == null ? 0 : d).replace('.', ',') + '%';
  U.parseRp = s => { s = String(s || '').replace(/[^\d,-]/g, '').replace(',', '.'); return Math.round(Number(s) || 0); };
  U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.uid = (p) => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---- Tanggal (string YYYY-MM-DD, zona lokal) ----
  U.pad = n => String(n).padStart(2, '0');
  U.ymd = d => d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate());
  U.today = () => U.ymd(new Date());
  U.parseDate = s => { const p = String(s || '').split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
  U.addDays = (s, n) => { const d = U.parseDate(s); d.setDate(d.getDate() + n); return U.ymd(d); };
  U.addMonths = (s, n) => {
    const d = U.parseDate(s), day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, U.daysInMonth(d.getFullYear(), d.getMonth() + 1)));
    return U.ymd(d);
  };
  U.daysInMonth = (y, m) => new Date(y, m, 0).getDate();
  U.diffDays = (a, b) => Math.round((U.parseDate(b) - U.parseDate(a)) / 864e5);
  U.ym = s => String(s).slice(0, 7);
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BLN_L = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  U.BLN = BLN; U.BLN_L = BLN_L; U.HARI = HARI;
  U.tgl = (s, opt) => {
    if (!s) return '-';
    const d = U.parseDate(s);
    if (opt === 'long') return HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BLN_L[d.getMonth()] + ' ' + d.getFullYear();
    if (opt === 'dm') return d.getDate() + ' ' + BLN[d.getMonth()];
    if (opt === 'my') return BLN_L[d.getMonth()] + ' ' + d.getFullYear();
    if (opt === 'mys') return BLN[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
    return d.getDate() + ' ' + BLN[d.getMonth()] + ' ' + d.getFullYear();
  };
  U.relDay = s => {
    const n = U.diffDays(U.today(), s);
    if (n === 0) return 'Hari ini'; if (n === 1) return 'Besok'; if (n === -1) return 'Kemarin';
    return n > 0 ? n + ' hari lagi' : Math.abs(n) + ' hari lalu';
  };
  U.timeAgo = iso => {
    if (!iso) return '';
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'baru saja'; if (s < 3600) return Math.floor(s / 60) + ' mnt lalu';
    if (s < 86400) return Math.floor(s / 3600) + ' jam lalu';
    if (s < 172800) return 'kemarin'; return Math.floor(s / 86400) + ' hari lalu';
  };
  // Hijriah (Umm al-Qura via Intl; perkiraan — penetapan resmi bisa berbeda 1 hari)
  let hijriFmt = null;
  try { hijriFmt = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) {}
  U.hijri = s => { try { return hijriFmt ? hijriFmt.format(U.parseDate(s)).replace(/ H$/, '') + ' H' : ''; } catch (e) { return ''; } };
  let hpFmt = null; const hpMemo = {};
  U.hijriParts = s => {
    if (s in hpMemo) return hpMemo[s];
    try {
      hpFmt = hpFmt || new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' });
      const o = {}; hpFmt.formatToParts(U.parseDate(s)).forEach(x => o[x.type] = Number(x.value) || x.value);
      return (hpMemo[s] = { d: o.day, m: o.month, y: parseInt(o.year, 10) });
    } catch (e) { return (hpMemo[s] = null); }
  };


  U.debounce = (fn, ms) => { let t; return function () { const a = arguments, th = this; clearTimeout(t); t = setTimeout(() => fn.apply(th, a), ms); }; };
  U.sum = (arr, f) => arr.reduce((s, x) => s + U.num(f ? f(x) : x), 0);
  U.groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  U.hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h + ':' + s.length; };
  U.download = (name, text, mime) => {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  U.csv = rows => rows.map(r => r.map(v => { const s = String(v == null ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');
  window.U = U;
})();
