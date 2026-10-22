/* shapes.js — éléments dessinés réutilisables, ajoutés au kit avec K.register(nom, fabrique).
   Modèle pour créer les tiens : une fabrique reçoit (R = racine de la scène, s = spec JSON, X = {t0, t1, o})
   et renvoie une fonction (t) => {…} appelée à chaque image.

   ring   jauge circulaire animée      { top, pct, at, dur, label }
   steps  étapes numérotées 1-2-3      { top, items:[{text, at}] } */
(function () {
  const { mk, mkc, seg, eio } = ENG; const { T, put, esc, rich } = K;
  const TH = window.THEME, INK = TH.ink, ACC = TH.accent, PAPER = TH.paper;

  K.register('ring', (R, s, X) => {
    const r = 210, c = 2 * Math.PI * r;
    const el = mkc(R, '', `<svg width="560" height="560" viewBox="0 0 560 560">
        <circle cx="280" cy="280" r="${r}" fill="${PAPER}" stroke="${INK}" stroke-width="16"/>
        <circle class="arc" cx="280" cy="280" r="${r}" fill="none" stroke="${ACC}" stroke-width="56" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 280 280)"/>
        <circle cx="280" cy="280" r="${r - 34}" fill="none" stroke="${INK}" stroke-width="8"/>
        <circle cx="280" cy="280" r="${r + 30}" fill="none" stroke="${INK}" stroke-width="8"/>
        <text class="v" x="280" y="300" text-anchor="middle" font-family="Montserrat" font-weight="900" font-size="120" fill="${INK}"></text>
        <text x="280" y="360" text-anchor="middle" font-family="JetBrains Mono" font-weight="700" font-size="30" fill="${ACC}">${esc(s.label || '')}</text>
      </svg>`, { top: s.top + 'px', width: '560px', height: '560px' });
    const arc = el.querySelector('.arc'), v = el.querySelector('.v');
    const tA = s.at != null ? T(s.at, 0.15) : X.t0 + 0.15;
    return (t) => {
      if (!put(el, t, X.t0, X.t1, Object.assign({ r: -2 }, X.o))) return;
      const k = eio(seg(t, tA, s.dur || 1.0));
      arc.setAttribute('stroke-dashoffset', c * (1 - (s.pct / 100) * k));
      v.textContent = Math.round(s.pct * k) + '%';
    };
  });

  K.register('steps', (R, s, X) => {
    const els = s.items.map((it, i) => {
      const e = mk(R, 'abs', `<div style="width:120px;height:120px;flex:none;border-radius:50%;background:${i % 2 ? INK : ACC};color:#fff;border:8px solid ${INK};display:flex;align-items:center;justify-content:center;font:900 70px Montserrat;box-sizing:border-box">${i + 1}</div><div style="font:800 ${s.size || 46}px/1.1 Montserrat;padding-left:30px">${rich(it.text)}</div>`,
        { left: '110px', top: (s.top + i * (s.gap || 170)) + 'px', width: '860px', display: 'flex', alignItems: 'center' });
      return { e, t0: T(it.at) };
    });
    return (t) => els.forEach((x, i) => put(x.e, t, x.t0, X.t1, { r: 0, dx: -80, dy: 0, rr: i % 2 ? 3 : -3 }));
  });
})();
