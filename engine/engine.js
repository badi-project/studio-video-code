/* engine.js — moteur d'animation déterministe.
   window.renderAt(t) met la page dans l'état exact de l'instant t (en secondes) : aucune animation CSS ni minuterie,
   donc chaque image peut être capturée dans n'importe quel ordre (rendu parallèle possible).
   Les scènes (scenes.json via kit.js, ou scenes.js à la main) décrivent quoi afficher, synchronisé sur la voix (timeline.js). */
(function (root) {
  const W = 1080, H = 1920, FPS = 30;
  const TL = root.TL, PH = TL.phrases, ENV = TL.env;
  const NEEDED = new Set(); root.NEEDED = NEEDED;   // images du personnage à pré-rendre (lues par make_video.py assets)

  /* ---------- maths / easing ---------- */
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const eo3 = (x) => 1 - Math.pow(1 - clamp(x), 3);
  const eob = (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const eio = (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const pop = (t, t0, d = 0.3) => (t < t0 ? 0 : eob((t - t0) / d));   // 0 -> 1 avec rebond
  const seg = (t, t0, d) => clamp((t - t0) / d);                        // 0 -> 1 linéaire
  const fmtInt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  /* ---------- timeline ---------- */
  const ps = (p) => PH[p].start;
  const pe = (p) => PH[p].end;
  const tt = (p, k = 0, off = 0) => PH[p].chunks[k].start + off;
  const ce = (p, k = 0) => PH[p].chunks[k].end;

  /* ---------- DOM ---------- */
  function mk(parent, cls, html, css) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    if (html != null) d.innerHTML = html;
    d.style.position = 'absolute';
    if (css) Object.assign(d.style, css);
    parent.appendChild(d);
    d.__tf = '';
    return d;
  }
  function mkc(parent, cls, html, css) {          // élément centré horizontalement
    const d = mk(parent, cls, html, Object.assign({ left: '50%' }, css || {}));
    d.__c = true;
    return d;
  }
  function tf(el, o) {                              // transform + opacité, écrits seulement s'ils changent
    o = o || {};
    const sx = o.sx != null ? o.sx : (o.s != null ? o.s : 1), sy = o.sy != null ? o.sy : (o.s != null ? o.s : 1);
    const s = `${el.__c ? 'translateX(-50%) ' : ''}translate(${(o.x || 0).toFixed(2)}px,${(o.y || 0).toFixed(2)}px) rotate(${(o.r || 0).toFixed(2)}deg) scale(${sx.toFixed(4)},${sy.toFixed(4)})`;
    if (el.__tf !== s) { el.style.transform = s; el.__tf = s; }
    if (o.o != null) { const v = String(o.o); if (el.__o !== v) { el.style.opacity = v; el.__o = v; } }
  }
  function show(el, on) {
    if (el.__disp === undefined) el.__disp = (el.style.display && el.style.display !== 'none') ? el.style.display : 'block';
    const v = on ? el.__disp : 'none';
    if (el.__d !== v) { el.style.display = v; el.__d = v; }
  }
  // typographie française : espace insécable avant ? ! : ; » et après «
  const nb = (s) => String(s).replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
  const fmtCap = (s) => nb(s).replace(/\*([^*]+)\*/g, '<span class="r">$1</span>');
  const plain = (s) => nb(s).replace(/\*/g, '').replace(/~/g, '');

  /* ---------- personnage (images PNG pré-rendues, bouche ouverte/fermée selon le volume de la voix) ---------- */
  const keyOf = (mode, pose, expr, open, props) => [mode, pose, expr, open ? 'o' : 'c', props && props.length ? props.join('+') : '-'].join('__');
  const ASP = (root.CHARACTER && root.CHARACTER.ASPECT) || { full: 820 / 1070, head: 400 / 470 };
  function openAt(t) {
    const i = Math.max(0, Math.min(ENV.length - 1, Math.round(t * FPS)));
    const v = ENV[i] || 0, pv = ENV[i - 1] || 0;
    return v > 0.2 || pv > 0.38;                    // seuils avec un peu d'hystérésis pour éviter le clignotement
  }
  function makeChar(R, spec) {
    const entries = spec.seq.map((s, idx) => {
      const mode = s.mode || spec.mode || 'full';
      const h = s.h || spec.h, w = h * ASP[mode];
      const cx = s.cx != null ? s.cx : spec.cx, left = cx - w / 2;
      const bottom = s.bottom != null ? s.bottom : spec.bottom;
      const top = bottom != null ? bottom - h : ((s.cy != null ? s.cy : spec.cy) - h / 2);
      const wrap = mk(R, 'charwrap', null, { left: left + 'px', top: top + 'px', width: w + 'px', height: h + 'px', transformOrigin: mode === 'head' ? '50% 85%' : '50% 100%' });
      const props = s.props || [];
      const ic = document.createElement('img'), io = document.createElement('img');
      const kc = keyOf(mode, s.pose, s.expr, false, props), ko = keyOf(mode, s.pose, s.expr, true, props);
      NEEDED.add(kc); NEEDED.add(ko);
      const AB = root.ASSET_BASE || 'assets/character/';
      ic.src = `${AB}${kc}.png`; io.src = `${AB}${ko}.png`;
      wrap.appendChild(ic); wrap.appendChild(io);
      return { t: s.t, wrap, ic, io, flip: !!s.flip, mode };
    });
    return {
      update(t, active) {
        let idx = 0;
        for (let i = 0; i < entries.length; i++) if (entries[i].t <= t + 1e-6) idx = i;
        const open = openAt(t);
        entries.forEach((e, i) => {
          const on = active && i === idx;
          show(e.wrap, on);
          if (!on) return;
          show(e.ic, !open); show(e.io, open);
          const k = eob((t - Math.max(e.t, 0)) / 0.22);          // petit « pop » à chaque changement d'expression
          const bob = Math.sin(t * 2.6) * (e.mode === 'head' ? 9 : 6);      // respiration
          const rock = Math.sin(t * 1.9 + i) * (e.mode === 'head' ? 1.6 : 0.7);
          const s = (0.88 + 0.12 * k) * (1 + Math.sin(t * 2.6 + 1) * 0.008);
          tf(e.wrap, { y: bob + (1 - k) * 30, r: rock + (1 - k) * (e.flip ? -4 : 4), sx: (e.flip ? -1 : 1) * s, sy: s, o: 1 });
        });
      }
    };
  }

  /* ---------- scènes ---------- */
  const SCENES = [];
  function sc(from, to, opts, build) { SCENES.push({ from, to, opts: opts || {}, build }); }

  function boot() {
    const stage = document.getElementById('stage');
    SCENES.forEach((s) => {
      // une scène commence/finit au milieu du silence entre deux phrases
      s.start = s.from === 0 ? 0 : (pe(s.from - 1) + ps(s.from)) / 2;
      s.end = s.to === PH.length - 1 ? TL.total + 5 : (pe(s.to) + ps(s.to + 1)) / 2;
      const rootEl = mk(stage, 'scene bg-' + (s.opts.bg || 'grid'));
      s.root = rootEl;
      rootEl.character = (spec) => makeChar(rootEl, spec);
      s.update = s.build(rootEl, s) || (() => {});
    });
    // légendes animées (un « chunk » à la fois) et sous-titres (phrase entière)
    const caps = [];
    PH.forEach((p) => p.chunks.forEach((c, k) => {
      const nxt = p.chunks[k + 1];
      caps.push({ el: mk(stage, 'cap', fmtCap(c.show)), start: c.start, end: nxt ? nxt.start : p.end + 0.3 });
    }));
    const subs = PH.map((p) => ({
      el: mk(stage, 'sub', p.chunks.map((c) => plain(c.show)).join(' ').replace(/[ \t\n]+/g, ' ')),
      start: p.start - 0.05, end: p.end + 0.3
    }));

    root.renderAt = function (t) {
      let active = null;
      for (const s of SCENES) { const on = t >= s.start && t < s.end; show(s.root, on); if (on) active = s; }
      if (!active) active = SCENES[SCENES.length - 1];
      active.update(t);
      const o = active.opts;
      let capOn = null;
      if (o.cap !== false) for (const c of caps) if (t >= c.start && t < c.end) { capOn = c; break; }
      for (const c of caps) {
        const on = c === capOn; show(c.el, on);
        if (!on) continue;
        const k = pop(t, c.start - 0.02, 0.22);
        c.el.classList.toggle('boxed', o.cap === 'box');
        c.el.style.top = (o.capY || 190) + 'px';
        tf(c.el, { s: 0.82 + 0.18 * k, y: (1 - k) * 18, o: clamp((t - c.start + 0.02) / 0.07) });
      }
      for (const s of subs) {
        const on = o.sub !== false && t >= s.start && t < s.end; show(s.el, on);
        if (on) s.el.style.top = (o.subY || 1560) + 'px';
      }
      return true;
    };
    // on attend images + polices avant de signaler READY au script de rendu
    const imgs = Array.from(document.images);
    Promise.all(imgs.map((i) => (i.decode ? i.decode().catch(() => {}) : Promise.resolve()))).then(() => document.fonts.ready).then(() => { root.READY = true; });
    if (location.search.indexOf('t=') >= 0) { const t = parseFloat(location.search.split('t=')[1]); setTimeout(() => root.renderAt(t), 400); }
  }

  root.ENG = { boot, sc, mk, mkc, tf, show, pop, seg, eo3, eob, eio, clamp, lerp, fmtInt, ps, pe, tt, ce, PH, TL, W, H, FPS };
})(window);
