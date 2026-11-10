/* Grafik SVG ringan tanpa pustaka luar */
(function () {
  const Ch = {};
  const css = v => 'var(' + v + ')';

  /** Batang berkelompok: data [{label, a, b}], legend [labelA, labelB] */
  Ch.bars = (data, opt) => {
    opt = opt || {};
    const W = 340, H = opt.h || 180, pad = { l: 8, r: 8, t: 14, b: 26 };
    const max = Math.max(1, ...data.map(d => Math.max(d.a || 0, d.b || 0)));
    const gw = (W - pad.l - pad.r) / data.length, bw = Math.min(16, gw / 3);
    const y = v => H - pad.b - (v / max) * (H - pad.t - pad.b);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${U.esc(opt.aria || 'Grafik batang')}">`;
    [0.25, 0.5, 0.75, 1].forEach(f => { const yy = y(max * f); s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${yy}" y2="${yy}" class="grid"/>`; });
    data.forEach((d, i) => {
      const x = pad.l + gw * i + gw / 2, sel = opt.selected === i;
      if (sel) s += `<rect x="${x - gw / 2 + 2}" y="${pad.t - 8}" width="${gw - 4}" height="${H - pad.t - pad.b + 8}" rx="10" class="sel-bg"/>`;
      s += `<rect x="${x - bw - 1}" y="${y(d.a || 0)}" width="${bw}" height="${H - pad.b - y(d.a || 0)}" rx="4" class="bar-a"/>`;
      s += `<rect x="${x + 1}" y="${y(d.b || 0)}" width="${bw}" height="${H - pad.b - y(d.b || 0)}" rx="4" class="bar-b"/>`;
      s += `<text x="${x}" y="${H - 8}" text-anchor="middle" class="axis${sel ? ' strong' : ''}">${U.esc(d.label)}</text>`;
      s += `<rect x="${x - gw / 2}" y="0" width="${gw}" height="${H}" fill="transparent" data-act="${opt.act || ''}" data-i="${i}" style="cursor:pointer"/>`;
    });
    return s + '</svg>';
  };

  /** Garis proyeksi saldo: pts [{d, bal}] */
  Ch.line = (pts, opt) => {
    opt = opt || {};
    const W = 340, H = opt.h || 150, pad = { l: 6, r: 6, t: 16, b: 22 };
    if (!pts.length) return '';
    const vals = pts.map(p => p.bal), min = Math.min(0, ...vals), max = Math.max(1, ...vals);
    const x = i => pad.l + (i / Math.max(1, pts.length - 1)) * (W - pad.l - pad.r);
    const y = v => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.bal).toFixed(1)).join(' ');
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${U.esc(opt.aria || 'Grafik garis')}">`;
    if (min < 0) s += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(0)}" y2="${y(0)}" class="zero"/>`;
    s += `<path d="${path} L${x(pts.length - 1)} ${H - pad.b} L${x(0)} ${H - pad.b} Z" class="area"/>`;
    s += `<path d="${path}" class="line"/>`;
    if (opt.mark != null && pts[opt.mark]) s += `<circle cx="${x(opt.mark)}" cy="${y(pts[opt.mark].bal)}" r="5" class="dot-bad"/>`;
    const ticks = opt.ticks || [0, Math.floor(pts.length / 2), pts.length - 1];
    ticks.forEach(i => { if (pts[i]) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}" class="axis">${U.tgl(pts[i].d, 'dm')}</text>`; });
    return s + '</svg>';
  };

  /** Donat: parts [{v, color, label}] */
  Ch.donut = (parts, center, opt) => {
    opt = opt || {};
    const R = 60, r = 42, C = 2 * Math.PI * ((R + r) / 2), tot = parts.reduce((s, p) => s + p.v, 0) || 1;
    let off = 0, s = `<svg viewBox="0 0 150 150" class="chart donut" role="img" aria-label="${U.esc(opt.aria || 'Diagram donat')}">`;
    parts.forEach(p => {
      const len = p.v / tot * C;
      s += `<circle cx="75" cy="75" r="${(R + r) / 2}" fill="none" stroke="${p.color}" stroke-width="${R - r}" stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}" transform="rotate(-90 75 75)"/>`;
      off += len;
    });
    return s + `<text x="75" y="70" text-anchor="middle" class="d-sub">${U.esc(center[0] || '')}</text><text x="75" y="90" text-anchor="middle" class="d-main">${U.esc(center[1] || '')}</text></svg>`;
  };

  /** Gauge setengah lingkaran: ratio 0..1, zona aman/waspada */
  Ch.gauge = (ratio, label, sub) => {
    const a = U.clamp(ratio, 0, 1) * Math.PI, cx = 100, cy = 100, R = 80;
    const px = cx - R * Math.cos(a), py = cy - R * Math.sin(a);
    const arc = (f0, f1, cls) => { const a0 = f0 * Math.PI, a1 = f1 * Math.PI; return `<path d="M${cx - R * Math.cos(a0)} ${cy - R * Math.sin(a0)} A${R} ${R} 0 0 1 ${cx - R * Math.cos(a1)} ${cy - R * Math.sin(a1)}" class="${cls}"/>`; };
    return `<svg viewBox="0 0 200 118" class="chart gauge" role="img" aria-label="${U.esc(label)}">${arc(0, 0.6, 'g-ok')}${arc(0.6, 0.8, 'g-warn')}${arc(0.8, 1, 'g-bad')}
      <circle cx="${px}" cy="${py}" r="8" class="g-dot"/><text x="100" y="92" text-anchor="middle" class="g-main">${U.esc(label)}</text><text x="100" y="112" text-anchor="middle" class="g-sub">${U.esc(sub || '')}</text></svg>`;
  };

  /** Cincin skor 0..100 */
  Ch.ring = (v, max, label) => {
    const R = 64, C = 2 * Math.PI * R, f = U.clamp(v / max, 0, 1);
    return `<svg viewBox="0 0 160 160" class="chart ring" role="img" aria-label="Skor ${v}"><circle cx="80" cy="80" r="${R}" class="ring-bg"/>
      <circle cx="80" cy="80" r="${R}" class="ring-fg" stroke-dasharray="${f * C} ${C}" transform="rotate(-90 80 80)"/>
      <text x="80" y="82" text-anchor="middle" class="r-main">${v}<tspan class="r-max">/${max}</tspan></text><text x="80" y="104" text-anchor="middle" class="r-sub">${U.esc(label || '')}</text></svg>`;
  };

  /** Toples tabungan (celengan) dengan isi sesuai persen */
  Ch.jar = (pct, small) => {
    const f = U.clamp(pct, 0, 1), top = 30, bot = 150, h = (bot - top) * f, y = bot - h;
    const coins = f > 0.15 ? `<circle cx="55" cy="${bot - 14}" r="9" class="coin"/><circle cx="76" cy="${bot - 22}" r="9" class="coin"/>${f > 0.4 ? `<circle cx="62" cy="${bot - 38}" r="9" class="coin"/>` : ''}` : '';
    return `<svg viewBox="0 0 130 160" class="jar${small ? ' sm' : ''}" aria-hidden="true">
      <defs><clipPath id="jc${small ? 's' : ''}"><rect x="20" y="${top}" width="90" height="${bot - top}" rx="18"/></clipPath></defs>
      <rect x="38" y="10" width="54" height="16" rx="5" class="jar-lid"/>
      <rect x="20" y="${top}" width="90" height="${bot - top}" rx="18" class="jar-glass"/>
      <g clip-path="url(#jc${small ? 's' : ''})"><rect x="20" y="${y}" width="90" height="${h}" class="jar-fill"/><path d="M20 ${y} q22 -7 45 0 t45 0 v6 h-90z" class="jar-wave"/>${coins}</g>
      ${[0.25, 0.5, 0.75].map(m => `<line x1="98" x2="108" y1="${bot - (bot - top) * m}" y2="${bot - (bot - top) * m}" class="jar-tick"/>`).join('')}</svg>`;
  };

  window.Charts = Ch;
})();
