/* kit.js — bibliothèque d'éléments de scène pilotée par un JSON (scenes.json).
   Une vidéo = story.json (ce qui est dit) + scenes.json (ce qu'on voit). Format : docs/02-ecrire-une-video.md
   Références de temps ("at" / "until") :
     "3"   = début de la phrase 3        "3.1"  = début du chunk 1 de la phrase 3
     "3>"  = fin de la phrase 3          "3.1>" = fin du chunk 1 de la phrase 3
     décalage possible : "3.1+0.25", "4-0.1"      nombre = secondes absolues */
(function (root) {
  const { sc, mk, mkc, tf, show, pop, seg, eo3, eio, clamp, lerp, fmtInt, ps, pe, tt, ce, PH } = ENG;
  const TH = root.THEME, ACC = TH.accent, INK = TH.ink, PAPER = TH.paper;
  const DEF = { subY: 1500, capY: 215 };   // zones sûres Reels / TikTok / Shorts : sous-titres au-dessus de l'interface du bas
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // texte riche : *mot* = couleur forte, ~mot~ = barré animé, \n = retour à la ligne
  const rich = (s) => esc(String(s).replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ')).replace(/\n/g, '<br>')
    .replace(/\*([^*]+)\*/g, `<span style="color:${ACC}">$1</span>`).replace(/~([^~]+)~/g, '<span class="strk">$1<span class="stkbar"></span></span>');

  const RE = /^(\d+)(?:\.(\d+))?(>)?\s*([+-]\s*\d*\.?\d+)?$/;
  function T(ref, lead) {
    if (ref == null) return null;
    if (typeof ref === 'number') return ref;
    const m = RE.exec(String(ref).trim());
    if (!m) throw new Error('référence de temps invalide : ' + ref);
    const p = +m[1]; if (p >= PH.length) throw new Error('phrase inexistante : ' + ref);
    const end = !!m[3]; let t;
    if (m[2] != null) { const k = Math.min(+m[2], PH[p].chunks.length - 1); t = end ? ce(p, k) : tt(p, k); }
    else t = end ? pe(p) : ps(p);
    if (m[4]) t += parseFloat(m[4].replace(/\s+/g, ''));
    return t + (end ? 0 : (lead == null ? -0.03 : lead));
  }

  // apparition avec rebond entre t0 et t1 ; renvoie true si l'élément est visible
  function put(el, t, t0, t1, o) {
    o = o || {};
    const on = t >= t0 && (t1 == null || t < t1);
    show(el, on);
    if (!on) return false;
    const k = pop(t, t0, o.d || 0.3);
    tf(el, {
      s: (0.55 + 0.45 * k) * (o.s || 1), x: (1 - k) * (o.dx || 0), y: (1 - k) * (o.dy != null ? o.dy : 36),
      r: (o.r || 0) + (1 - k) * (o.rr != null ? o.rr : -4), o: clamp((t - t0) / 0.05)
    });
    return true;
  }
  // réduit la police si le texte dépasse la largeur max (mesuré à la première apparition)
  function fit(el, maxW, measureEl) {
    if (el.__fit) return; el.__fit = 1;
    const w = measureEl ? measureEl.offsetWidth : Math.max(el.offsetWidth, el.scrollWidth);
    if (w > maxW) { const fs = parseFloat(getComputedStyle(el).fontSize); el.style.fontSize = (fs * maxW / w - 0.5) + 'px'; }
  }
  const fmtNum = (v, c) => (c.prefix || '') + (c.dec ? v.toFixed(c.dec).replace('.', ',') : fmtInt(v)) + (c.suffix || '');

  // code « tapé » avec coloration minimale
  function hl(line) {
    if (/^\s*(--|\/\/|#)/.test(line)) return [[line, 'c']];
    const out = []; const re = /("[^"]*"|'[^']*'|\b(?:def|function|const|let|return|if|else|for|while|import|from|class|async|await|type|fn|print)\b)/g; let last = 0, m;
    while ((m = re.exec(line))) { if (m.index > last) out.push([line.slice(last, m.index), '']); out.push([m[0], 'k']); last = m.index + m[0].length; }
    if (last < line.length) out.push([line.slice(last), '']);
    return out.length ? out : [['', '']];
  }
  function typed(lines, n, caret) {
    let left = n; const out = [];
    for (const line of lines) {
      if (left <= 0) break; let h = '';
      for (const [txt, cls] of line) { if (left <= 0) break; const s = txt.slice(0, left); left -= txt.length; h += cls ? `<span class="${cls}">${esc(s)}</span>` : esc(s); }
      out.push(h); left -= 1;
    }
    return out.join('\n') + (caret ? `<span style="color:${ACC}">▌</span>` : '');
  }
  const totalLen = (lines) => lines.reduce((a, l) => a + l.reduce((b, s) => b + s[0].length, 0) + 1, 0);

  const TYPES = {};
  const K = { T, put, fit, rich, esc, TYPES, DEF, register(name, fn) { TYPES[name] = fn; } };
  root.K = K;

  /* ───────── éléments ───────── */
  // cartouche de texte. variant : '' (papier) | 'accent' | 'ink'
  TYPES.box = (R, s, X) => {
    const el = mkc(R, 'box ' + (s.variant || ''), rich(s.text), { top: s.top + 'px', fontSize: (s.size || 64) + 'px', lineHeight: s.lh || '1.06' });
    if (s.pad) el.style.padding = s.pad;
    const bars = Array.from(el.querySelectorAll('.stkbar')); const tS = s.strikeAt != null ? T(s.strikeAt) : X.t0 + 0.6;
    return (t) => { if (put(el, t, X.t0, X.t1, X.o)) { fit(el, s.maxW || 960); bars.forEach((b) => { b.style.transform = `scaleX(${eo3(seg(t, tS, 0.28))})`; }); } };
  };
  // petite étiquette. variant : '' (accent) | 'w' (papier)
  TYPES.tag = (R, s, X) => {
    const el = mkc(R, 'tag ' + (s.variant || ''), esc(s.text), { top: s.top + 'px', fontSize: (s.size || 46) + 'px' });
    return (t) => { if (put(el, t, X.t0, X.t1, X.o)) fit(el, s.maxW || 960); };
  };
  // énorme mot ou compteur animé : text | count:{to, from, dec, prefix, suffix, at, dur}
  TYPES.big = (R, s, X) => {
    const size = s.size || 300, c = s.count;
    const el = mk(R, 'big', '<span class="bt"></span>', { top: s.top + 'px', fontSize: size + 'px', WebkitTextStroke: (size * 0.055) + 'px ' + INK, textShadow: `${size * 0.048}px ${size * 0.048}px 0 ${INK}` });
    if (s.color) el.style.color = s.color === 'ink' ? INK : s.color === 'paper' ? PAPER : s.color;
    const bt = el.querySelector('.bt'); const finalTxt = c ? fmtNum(c.to, c) : s.text;
    const tC = c && c.at != null ? T(c.at) : X.t0 + 0.02;
    return (t) => {
      if (!put(el, t, X.t0, X.t1, Object.assign({}, X.o, { d: 0.35, dy: s.dy != null ? s.dy : 50 }))) return;
      if (!el.__fit) { bt.textContent = finalTxt; fit(el, 1000, bt); }
      bt.textContent = c ? fmtNum(lerp(c.from || 0, c.to, eo3(seg(t, tC, c.dur || 0.9))), c) : s.text;
    };
  };
  // tampon incliné. style : 'outline' | 'solid'
  TYPES.stamp = (R, s, X) => {
    const sz = s.size || 62;
    const css = s.style === 'solid'
      ? { font: `900 ${sz}px Montserrat`, color: '#fff', background: ACC, border: `8px solid ${INK}`, boxShadow: `9px 9px 0 ${INK}`, padding: '8px 28px' }
      : { font: `900 ${sz}px Montserrat`, color: ACC, border: `9px solid ${ACC}`, padding: '8px 26px', background: PAPER };
    const el = mkc(R, '', esc(s.text), Object.assign({ top: s.top + 'px', whiteSpace: 'nowrap', marginLeft: (s.x || 0) + 'px' }, css));
    return (t) => { put(el, t, X.t0, X.t1, Object.assign({}, X.o, { r: s.rot != null ? s.rot : -7, rr: 12, d: 0.22 })); };
  };
  TYPES.arrow = (R, s, X) => {
    const el = mkc(R, '', `<div style="width:16px;height:90px;background:${INK};margin:0 auto"></div><div style="width:0;height:0;border-left:44px solid transparent;border-right:44px solid transparent;border-top:56px solid ${INK}"></div>`, { top: s.top + 'px' });
    return (t) => { put(el, t, X.t0, X.t1, Object.assign({}, X.o, { dy: -30 })); };
  };
  // fenêtre éditeur / navigateur : title | url (tapée), code:[lignes] (tapé) | rows:[lignes] | html
  TYPES.win = (R, s, X) => {
    const w = s.w || 900, size = s.size || 36;
    const head = s.url != null ? '<div class="url"></div>' : `<span style="margin-left:14px">${esc(s.title || '')}</span>`;
    const el = mk(R, 'win', `<div class="bar"><div class="sq a"></div><div class="sq"></div><div class="sq"></div>${head}</div><div class="body"></div>`, { left: (s.left != null ? s.left : (1080 - w) / 2 - 8) + 'px', top: s.top + 'px', width: w + 'px' });
    const body = el.querySelector('.body'); const urlEl = el.querySelector('.url');
    const ups = [];
    if (s.code) {
      body.className = 'body code'; body.style.fontSize = size + 'px';
      const lines = s.code.map(hl); const N = totalLen(lines); body.style.minHeight = (s.code.length * size * 1.5) + 'px';
      const a = s.typeFrom != null ? T(s.typeFrom) : X.t0 + 0.3, b = s.typeTo != null ? T(s.typeTo) : a + N * 0.035;
      ups.push((t) => { const k = seg(t, a, b - a); body.innerHTML = typed(lines, Math.floor(N * k), k < 1); });
    } else if (s.rows) {
      body.style.padding = '30px 34px 20px';
      body.innerHTML = s.rows.map((r) => `<div class="row"><span style="color:${ACC}">${/\/$/.test(r) ? '▸' : '·'}</span><span>${esc(r)}</span></div>`).join('');
      const rowEls = Array.from(body.querySelectorAll('.row')); const a = s.rowsAt != null ? T(s.rowsAt) : X.t0 + 0.4;
      ups.push((t) => rowEls.forEach((r, i) => { const k = seg(t, a + i * 0.11, 0.2); r.style.opacity = k; r.style.transform = `translateX(${(1 - eo3(k)) * -40}px)`; }));
    } else if (s.html) { body.innerHTML = s.html; body.style.padding = '28px 34px'; }
    if (urlEl) { const a = X.t0 + 0.25; ups.push((t) => { urlEl.textContent = s.url.slice(0, Math.floor(s.url.length * seg(t, a, Math.max(0.6, s.url.length * 0.045)))) + (Math.floor(t * 3) % 2 && t < a + 1.4 ? '|' : ''); }); }
    return (t) => { if (put(el, t, X.t0, X.t1, Object.assign({ r: -1, dy: 60 }, X.o, s.r != null ? { r: s.r } : {}))) ups.forEach((u) => u(t)); };
  };
  // pile de cartes : items [{glyph, title, sub, at, from:'left'|'right', color}]
  TYPES.cards = (R, s, X) => {
    const h = s.h || 210, gap = s.gap || 60, w = s.w || 900, left = s.left != null ? s.left : (1080 - w) / 2 - 8;
    const els = s.items.map((it, i) => {
      const gw = it.gw || (h - 10);
      const c = mk(R, 'abs', null, { left: left + 'px', top: (s.top + i * (h + gap)) + 'px', width: w + 'px', height: h + 'px', background: PAPER, border: `8px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, display: 'flex', overflow: 'hidden', boxSizing: 'border-box' });
      c.innerHTML = `<div style="width:${gw}px;flex:none;background:${it.color || ACC};border-right:8px solid ${INK};display:flex;align-items:center;justify-content:center;font:900 ${it.gsize || Math.round(h * 0.57)}px Montserrat;color:#fff">${esc(it.glyph || '')}</div><div style="padding:0 30px;display:flex;flex-direction:column;justify-content:center;gap:10px;white-space:nowrap"><div style="font:700 ${it.ssize || 27}px 'JetBrains Mono';color:${ACC}">${esc(it.sub || '')}</div><div class="tt" style="font:900 ${it.tsize || 44}px/1.08 Montserrat;text-transform:uppercase;display:inline-block">${rich(it.title || '')}</div></div>`;
      return { c, tt: c.querySelector('.tt'), t0: T(it.at), avail: w - 16 - gw - 8 - 60, side: it.from || (i % 2 ? 'right' : 'left') };
    });
    return (t) => els.forEach((e) => { if (put(e.c, t, e.t0, X.t1, { r: s.r != null ? s.r : (e.side === 'left' ? -1.2 : 1.2), dx: e.side === 'left' ? -80 : 80, dy: 0, rr: e.side === 'left' ? -2 : 2 })) fit(e.tt, e.avail, e.tt); });
  };
  // jauges : items [{label, pct, at, dur, value}]
  TYPES.bars = (R, s, X) => {
    const gap = s.gap || 230, w = s.w || 900, left = s.left != null ? s.left : (1080 - w) / 2 - 8;
    const els = s.items.map((it, i) => {
      const c = mk(R, 'abs', `<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px;white-space:nowrap"><div style="font:900 ${it.lsize || 38}px Montserrat;text-transform:uppercase">${esc(it.label)}</div><div class="vl" style="font:700 36px 'JetBrains Mono';color:${ACC}"></div></div><div style="height:64px;border:8px solid ${INK};background:${PAPER};box-sizing:border-box"><div class="f" style="height:100%;width:0;background:${it.color || ACC};border-right:8px solid ${INK};box-sizing:border-box"></div></div>`, { left: left + 'px', top: (s.top + i * gap) + 'px', width: w + 'px', background: PAPER, border: `8px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, padding: '26px 34px 30px', boxSizing: 'border-box' });
      return { c, f: c.querySelector('.f'), vl: c.querySelector('.vl'), it, t0: T(it.at), tF: it.fillAt != null ? T(it.fillAt) : T(it.at, 0.15) };
    });
    return (t) => els.forEach((e) => {
      if (!put(e.c, t, e.t0, X.t1, { r: s.r != null ? s.r : (e.it.pct > 50 ? -1 : 1), dx: 0, dy: 36 })) return;
      const k = eio(seg(t, e.tF, e.it.dur || 0.9)); e.f.style.width = (e.it.pct * k) + '%';
      e.vl.textContent = e.it.value != null ? (k > 0.99 ? e.it.value : '') : (e.it.noValue ? '' : Math.round(e.it.pct * k) + ' %');
    });
  };
  // bande hachurée + mot (ATTENTION…)
  TYPES.band = (R, s, X) => {
    const band = mk(R, 'abs hz', '', { left: '-40px', top: s.top + 'px', width: '1160px', height: '160px', border: `8px solid ${INK}`, boxSizing: 'border-box' });
    const el = mkc(R, 'box ink', esc(s.text), { top: (s.top + 25) + 'px', fontSize: (s.size || 96) + 'px', padding: '14px 50px' });
    return (t) => { put(band, t, X.t0, X.t1, { dx: -200, dy: 0, r: -3, rr: 0 }); if (put(el, t, X.t0 + 0.05, X.t1, { r: 0 })) fit(el, 900); };
  };
  // note encadrée avec étiquette : label, text
  TYPES.note = (R, s, X) => {
    const el = mkc(R, '', `<div style="font:700 28px 'JetBrains Mono';color:${ACC};margin-bottom:12px">${esc(s.label || '')}</div><div style="font:700 ${s.size || 44}px/1.18 Inter">${rich(s.text)}</div>`, { top: s.top + 'px', width: (s.w || 880) + 'px', background: PAPER, border: `8px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, padding: '24px 34px', boxSizing: 'border-box' });
    return (t) => { put(el, t, X.t0, X.t1, Object.assign({ r: -1 }, X.o)); };
  };
  // citation (toujours réelle et sourcée !) : text, who
  TYPES.quote = (R, s, X) => {
    const el = mkc(R, '', `<div style="position:absolute;left:22px;top:-14px;font:900 150px/1 Montserrat;color:${ACC}">“</div><div style="padding:56px 8px 8px 8px;font:700 ${s.size || 46}px/1.2 Inter">${rich(s.text)}</div>`, { top: s.top + 'px', width: (s.w || 880) + 'px', background: PAPER, border: `8px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, padding: '20px 34px 40px', boxSizing: 'border-box' });
    const who = s.who ? mkc(R, 'tag', esc(s.who), { top: (s.top + (s.h || 250)) + 'px', fontSize: '34px', marginLeft: '170px' }) : null;
    return (t) => { put(el, t, X.t0, X.t1, Object.assign({ r: -1 }, X.o)); if (who) put(who, t, X.t0 + 0.25, X.t1, { r: 2 }); };
  };
  // A VS B : a:{text, variant, at}, b:{…}, vsAt
  TYPES.versus = (R, s, X) => {
    const wrap = mk(R, '', '', { left: '0px', width: '1080px', top: s.top + 'px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: (s.gap || 26) + 'px' });
    const mkp = (spec) => ({ e: mk(wrap, 'box ' + (spec.variant || ''), rich(spec.text), { position: 'relative', fontSize: (s.size || 64) + 'px' }), t0: T(spec.at) });
    const a = mkp(s.a), b = mkp(s.b);
    const vs = mk(wrap, 'tag', esc(s.vs || 'VS'), { position: 'relative', fontSize: '52px' }); const tv = s.vsAt != null ? T(s.vsAt) : (a.t0 + b.t0) / 2;
    wrap.insertBefore(vs, b.e);
    return (t) => { show(wrap, true); put(a.e, t, a.t0, X.t1, { r: -2 }); put(vs, t, tv, X.t1, { r: 3, rr: 10 }); put(b.e, t, b.t0, X.t1, { r: 2 }); };
  };
  // liste : items [{text, mark:'✓'|'✗'|'→'|'•', at}]
  TYPES.list = (R, s, X) => {
    const W = s.w || 880;
    const wrap = mk(R, '', '', { left: ((1080 - W) / 2) + 'px', top: s.top + 'px', width: W + 'px', display: 'flex', flexDirection: 'column', gap: (s.gap || 26) + 'px' });
    const els = s.items.map((it) => {
      const bad = it.mark === '✗';
      const e = mk(wrap, '', `<div style="width:110px;flex:none;background:${bad ? ACC : INK};color:#fff;display:flex;align-items:center;justify-content:center;font:900 64px Montserrat;border-right:8px solid ${INK}">${esc(it.mark || '✓')}</div><div class="lt" style="padding:0 28px;font:800 ${s.size || 40}px/1.1 Montserrat;white-space:nowrap;display:flex;align-items:center"><span>${rich(it.text)}</span></div>`, { position: 'relative', display: 'flex', height: (s.h || 120) + 'px', background: PAPER, border: `8px solid ${INK}`, boxShadow: `12px 12px 0 ${INK}`, boxSizing: 'border-box', overflow: 'hidden' });
      return { e, lt: e.querySelector('.lt'), t0: T(it.at) };
    });
    return (t) => { show(wrap, true); els.forEach((x, i) => { if (put(x.e, t, x.t0, X.t1, { r: i % 2 ? 1 : -1, dx: -60, dy: 0, rr: 0 })) fit(x.lt, W - 16 - 110 - 8 - 56, x.lt); }); };
  };
  // grille de carrés qui s'allument : n, cols, size, gap, lit:{to, at, dur}
  TYPES.squares = (R, s, X) => {
    const n = s.n, cols = s.cols, size = s.size || 28, gap = s.gap || 4, rows = Math.ceil(n / cols);
    const W = cols * (size + gap) - gap, Hh = rows * (size + gap) - gap;
    const wrap = mk(R, 'abs', '', { left: ((1080 - W) / 2) + 'px', top: s.top + 'px', width: W + 'px', height: Hh + 'px' });
    const sq = []; for (let i = 0; i < n; i++) sq.push(mk(wrap, 'sqg', null, { width: size + 'px', height: size + 'px', left: (i % cols) * (size + gap) + 'px', top: Math.floor(i / cols) * (size + gap) + 'px', opacity: 0.55 }));
    const L = s.lit || { to: 0, at: '0', dur: 1 }; const tL = T(L.at);
    let last = -1;
    return (t) => { if (!put(wrap, t, X.t0, X.t1, Object.assign({ dy: 40 }, X.o))) return; const k = Math.floor(L.to * eo3(seg(t, tL, L.dur || 0.9))); if (k !== last) { last = k; sq.forEach((d, i) => { const on = i < k; d.style.background = on ? ACC : PAPER; d.style.opacity = on ? 1 : 0.55; }); } };
  };
  // zone de commentaire (texte tapé + curseur qui clique) : text, who (initiale), typeFrom, cursor, cursorAt, clickAt
  TYPES.chat = (R, s, X) => {
    const box = mk(R, 'abs', `<div style="width:92px;height:92px;border-radius:50%;background:${TH.accent2};border:6px solid ${INK};flex:none;display:flex;align-items:center;justify-content:center;font:900 52px Montserrat;color:#fff">${esc(s.who || '?')}</div><div class="tx" style="font:800 ${s.size || 54}px Montserrat;white-space:nowrap"></div>`, { left: '90px', top: s.top + 'px', width: '900px', height: '150px', background: PAPER, border: `8px solid ${ACC}`, boxShadow: `12px 12px 0 ${INK}`, display: 'flex', alignItems: 'center', gap: '24px', padding: '0 30px', boxSizing: 'border-box' });
    const tx = box.querySelector('.tx'); const a = s.typeFrom != null ? T(s.typeFrom) : X.t0 + 0.2;
    const cur = s.cursor ? mk(R, 'abs', `<svg width="70" height="86" viewBox="0 0 70 86"><path d="M6 4 L6 66 L22 52 L34 80 L46 74 L34 48 L56 48 Z" fill="#fff" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/></svg>`, { left: '0', top: '0' }) : null;
    const tM = s.cursorAt != null ? T(s.cursorAt) : X.t0 + 1.5, tC = s.clickAt != null ? T(s.clickAt) : tM + 1.0;
    return (t) => {
      if (put(box, t, X.t0, X.t1, Object.assign({ r: 1 }, X.o))) { const k = seg(t, a, Math.max(0.6, s.text.length * 0.07)); tx.textContent = s.text.slice(0, Math.floor(s.text.length * k)) + (Math.floor(t * 3) % 2 ? '|' : ''); }
      if (cur) { const m = eio(seg(t, tM, 0.9)), click = seg(t, tC, 0.15); show(cur, t >= tM - 0.3 && (X.t1 == null || t < X.t1)); tf(cur, { x: lerp(820, 760, m), y: lerp(s.top + 400, s.top + 70, m), s: 1 - 0.15 * Math.sin(click * Math.PI) }); }
    };
  };
  // fin de vidéo : cœur + bouton
  TYPES.cta = (R, s, X) => {
    const top = s.top || 380;
    const heart = mkc(R, '', `<svg width="240" height="240" viewBox="0 0 24 24"><path class="h" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.7 4.5 6.6 4.5c2 0 3.5 1 5.4 3 1.9-2 3.4-3 5.4-3 3.9 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" fill="#fff" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/></svg>`, { top: top + 'px', width: '300px', height: '300px', background: PAPER, border: `8px solid ${INK}`, boxShadow: `14px 14px 0 ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' });
    const hp = heart.querySelector('.h');
    const btn = mkc(R, 'box accent', esc(s.text || "S'ABONNER"), { top: (top + 360) + 'px', fontSize: '92px', padding: '18px 56px' });
    const tb = s.btnAt != null ? T(s.btnAt) : X.t0 + 0.4;
    return (t) => {
      put(heart, t, X.t0, X.t1, { r: -3 }); hp.setAttribute('fill', t > X.t0 + 0.4 ? ACC : '#fff');
      put(btn, t, tb, X.t1, { r: 2 }); if (t > tb + 0.35) tf(btn, { r: 2, s: 1 + 0.035 * Math.sin(t * 7) });
    };
  };
  // HTML libre : html, css (objet de styles, y compris left/top/width), center
  TYPES.html = (R, s, X) => {
    const el = s.center ? mkc(R, s.cls || '', s.html, s.css || {}) : mk(R, s.cls || '', s.html, s.css || {});
    return (t) => { put(el, t, X.t0, X.t1, Object.assign({ r: s.rot || 0 }, X.o)); };
  };
  // personnage : mode head|full, h, cx, cy|bottom, seq:[{at, pose, expr, props, mode, h, flip}]
  TYPES.char = (R, s, X) => {
    const seq = s.seq.map((q, i) => Object.assign({}, q, { t: i === 0 ? 0 : T(q.at, -0.02) }));
    const C = R.character({ cx: s.cx != null ? s.cx : 540, cy: s.cy, bottom: s.bottom, h: s.h || 420, mode: s.mode || 'head', seq });
    return (t) => { C.update(t, true); };
  };

  /* ───────── construction des scènes ───────── */
  K.build = function (spec) {
    spec.scenes.forEach((sd) => {
      sc(sd.from, sd.to, { bg: sd.bg || 'grid', cap: sd.cap === undefined ? true : sd.cap, capY: sd.capY != null ? sd.capY : DEF.capY, subY: sd.subY != null ? sd.subY : DEF.subY, sub: sd.sub }, (R, S) => {
        let morph = null;
        if (sd.morph) {   // changement de fond en cours de scène : morph:{to:'pattern', at:'5.1'}
          const ov = mk(R, 'bgl bg-' + sd.morph.to, '', { opacity: 0 }); R.insertBefore(ov, R.firstChild);
          const tm = T(sd.morph.at);
          morph = (t) => { const k = eo3(seg(t, tm, 0.4)); ov.style.opacity = k; ov.style.transform = `scale(${1.2 - 0.2 * k})`; };
        }
        const ups = sd.els.map((e) => {
          const fn = TYPES[e.type]; if (!fn) throw new Error("type d'élément inconnu : " + e.type);
          const o = {}; ['r', 'rr', 'dx', 'dy', 'd'].forEach((k) => { if (e[k] != null) o[k] = e[k]; }); if (e.scale != null) o.s = e.scale;
          const X = { S, t0: e.at != null ? T(e.at) : S.start, t1: e.until != null ? T(e.until, 0) : null, o };
          return fn(R, e, X);
        });
        return (t) => { if (morph) morph(t); ups.forEach((u) => u(t)); };
      });
    });
  };
})(window);
