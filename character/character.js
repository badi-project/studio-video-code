/* =====================================================================
   PROTO — personnage d'exemple, 100 % dessiné en code (SVG paramétrique)

   Remplace ce fichier par ton propre personnage : le moteur n'a besoin
   que de l'API ci-dessous. Voir docs/01-personnage.md pour la méthode.

   API :  CHARACTER.render({ expr, pose, open, gaze, tilt, headOnly, props })
          -> chaîne SVG
   - expr     : nom d'expression (clés de EXPR)
   - pose     : nom de pose du corps (clés de POSE), ignoré si headOnly
   - open     : bouche ouverte (synchro labiale pilotée par la voix)
   - gaze     : [gx, gy] pour forcer la direction du regard
   - tilt     : inclinaison de la tête en degrés
   - headOnly : ne dessine que la tête (plans rapprochés)
   - props    : accessoires ajoutés (clés de PROPS)
   ASPECT     : rapport largeur/hauteur des deux cadrages (utilisé par le moteur)
   ===================================================================== */
(function (root) {
  const C = {
    ink: '#151821',      // contours
    shell: '#e7ecf3',    // coque
    shellD: '#b9c4d4',   // coque ombrée
    screen: '#1d2540',   // écran du visage
    glow: '#7fe7ff',     // yeux / bouche lumineux
    mouthIn: '#0b1022',  // intérieur de bouche
    accent: '#ff6b3d',   // antenne, joues, détails
    led2: '#ffd84a',
    white: '#ffffff'
  };
  let _id = 0;
  const uid = (p) => p + (++_id);
  const S = (w = 5, col = C.ink) => `stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
  const G = (w = 9) => S(w, C.glow);

  /* ------------------------------ VISAGE ------------------------------ */
  // œil = ellipse lumineuse + pupille sombre qui suit le regard
  function eye(cx, cy, o) {
    o = o || {};
    const rx = o.rx || 24, ry = o.ry || 31, pr = o.pr || 11;
    const gx = Math.max(-10, Math.min(10, o.gx || 0)), gy = Math.max(-12, Math.min(12, o.gy || 0));
    if (o.happy) return `<path d="M${cx - 24} ${cy + 8} Q${cx} ${cy - 30} ${cx + 24} ${cy + 8}" fill="none" ${G(10)}/>`;
    if (o.closed) return `<path d="M${cx - 24} ${cy} Q${cx} ${cy + 18} ${cx + 24} ${cy}" fill="none" ${G(9)}/>`;
    const id = uid('ce');
    let s = `<clipPath id="${id}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/></clipPath>`;
    s += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.glow}"/>`;
    s += `<g clip-path="url(#${id})">`;
    s += `<circle cx="${cx + gx}" cy="${cy + gy}" r="${pr}" fill="${C.screen}"/>`;
    s += `<circle cx="${cx + gx + pr * 0.4}" cy="${cy + gy - pr * 0.45}" r="${Math.max(3, pr * 0.32)}" fill="${C.white}"/>`;
    if (o.lid) {
      const h = o.lid * 2 * ry;
      s += `<rect x="${cx - rx - 2}" y="${cy - ry - 2}" width="${2 * rx + 4}" height="${h + 2}" fill="${C.screen}"/>`;
      s += `<line x1="${cx - rx - 2}" y1="${cy - ry + h}" x2="${cx + rx + 2}" y2="${cy - ry + h}" ${G(6)}/>`;
    }
    return s + `</g>`;
  }

  // sourcil : [décalage intérieur, décalage extérieur] (négatif = vers le haut)
  function brow(side, inner, outer) {
    const xi = 300 + side * 22, xo = 300 + side * 74, y0 = 150;
    const ym = Math.min(inner, outer) - 6;
    return `<path d="M${xi} ${y0 + inner} Q${(xi + xo) / 2} ${y0 + ym} ${xo} ${y0 + outer}" fill="none" ${G(10)}/>`;
  }

  const openMouth = (d, teeth) => {
    const id = uid('cm');
    return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${C.mouthIn}"/>` +
      (teeth ? `<g clip-path="url(#${id})"><rect x="230" y="250" width="140" height="${teeth}" fill="${C.glow}" opacity=".9"/></g>` : '') +
      `<path d="${d}" fill="none" ${G(6)}/>`;
  };

  const MOUTH = {
    smileclosed: () => `<path d="M264 266 Q300 292 336 266" fill="none" ${G(9)}/>`,
    smile: () => openMouth('M256 262 C268 304 332 304 344 262 C320 270 280 270 256 262 Z', 10),
    laugh: () => openMouth('M246 258 C260 318 340 318 354 258 C324 268 276 268 246 258 Z', 12),
    talk: () => openMouth('M276 268 C280 292 320 292 324 268 C312 273 288 273 276 268 Z', 0),
    talkwide: () => openMouth('M262 264 C270 302 330 302 338 264 C318 272 282 272 262 264 Z', 8),
    o: () => `<ellipse cx="300" cy="280" rx="17" ry="22" fill="${C.mouthIn}" ${G(6)}/>`,
    gasp: () => `<ellipse cx="300" cy="284" rx="23" ry="30" fill="${C.mouthIn}" ${G(6)}/>`,
    flat: () => `<path d="M272 278 L328 278" fill="none" ${G(9)}/>`,
    smirk: () => `<path d="M270 282 Q312 290 338 262" fill="none" ${G(9)}/>`,
    frown: () => `<path d="M268 290 Q300 262 332 290" fill="none" ${G(9)}/>`,
    zigzag: () => `<path d="M260 280 l13 -10 l13 10 l14 -10 l14 10 l13 -10 l13 10" fill="none" ${G(8)}/>`,
    grit: () => `<rect x="262" y="266" width="76" height="26" rx="8" fill="${C.mouthIn}" ${G(6)}/><path d="M281 266 V292 M300 266 V292 M319 266 V292" ${G(4)}/>`
  };

  /* expression = { e: options des yeux, bl/br: sourcils, mouth: bouche fermée, talk: bouche quand il parle,
                    tilt: inclinaison, blush: joues, props: accessoires automatiques } */
  const EXPR = {
    smile:   { e: {}, bl: [0, -4], br: [0, -4], mouth: 'smileclosed', talk: 'smile' },
    explain: { e: { gy: -2 }, bl: [-4, -8], br: [-4, -8], mouth: 'smileclosed', talk: 'talkwide' },
    grin:    { e: { lid: 0.15 }, bl: [-6, -10], br: [-6, -10], mouth: 'laugh', talk: 'laugh' },
    joy:     { e: { happy: true }, bl: [-8, -10], br: [-8, -10], mouth: 'laugh', talk: 'laugh', blush: 1 },
    proud:   { e: { happy: true }, bl: [-6, -8], br: [-6, -8], mouth: 'smileclosed', talk: 'smile', blush: 1 },
    smirk:   { e: { lid: 0.22, gx: 8 }, bl: [2, 4], br: [-8, -14], mouth: 'smirk', talk: 'smirk', tilt: -4 },
    sideeye: { e: { lid: 0.34, gx: 10 }, bl: [4, 2], br: [-2, -4], mouth: 'flat', talk: 'talk' },
    skeptic: { e: { lid: 0.45 }, bl: [6, -2], br: [-6, -12], mouth: 'flat', talk: 'talk', tilt: 3 },
    worried: { e: { gx: 5, gy: -3, pr: 9 }, bl: [-12, 2], br: [-12, 2], mouth: 'zigzag', talk: 'talk', props: ['drop'] },
    shock:   { e: { rx: 27, ry: 35, pr: 6 }, bl: [-18, -18], br: [-18, -18], mouth: 'gasp', talk: 'gasp' },
    wow:     { e: { rx: 26, ry: 34, pr: 9 }, bl: [-16, -18], br: [-16, -18], mouth: 'o', talk: 'talkwide' },
    angry:   { e: { lid: 0.12, pr: 10 }, bl: [8, -6], br: [8, -6], mouth: 'grit', talk: 'grit' },
    think:   { e: { gx: 9, gy: -10 }, bl: [-6, -12], br: [2, 4], mouth: 'flat', talk: 'talk', tilt: -5 },
    deadpan: { e: { lid: 0.3 }, bl: [0, 0], br: [0, 0], mouth: 'flat', talk: 'talk' },
    sad:     { e: { gy: 5 }, bl: [-10, 4], br: [-10, 4], mouth: 'frown', talk: 'frown' }
  };

  function headSvg(ex, open, gaze) {
    const e = Object.assign({}, ex.e);
    if (gaze) { e.gx = gaze[0]; e.gy = gaze[1]; }
    const mouth = (MOUTH[open ? ex.talk : ex.mouth] || MOUTH.flat)();
    let s = '';
    // antenne
    s += `<line x1="300" y1="78" x2="300" y2="22" ${S(16)}/><line x1="300" y1="78" x2="300" y2="22" stroke="${C.shellD}" stroke-width="7" stroke-linecap="round"/>`;
    s += `<circle cx="300" cy="10" r="20" fill="${C.accent}" ${S(5)}/><circle cx="294" cy="4" r="6" fill="${C.white}" opacity=".8"/>`;
    // boulons latéraux
    for (const x of [130, 446]) s += `<rect x="${x}" y="188" width="24" height="84" rx="12" fill="${C.shellD}" ${S(5)}/>`;
    // coque de la tête
    s += `<rect x="150" y="70" width="300" height="290" rx="82" fill="${C.shell}" ${S(6)}/>`;
    s += `<path d="M196 96 Q240 80 290 82" fill="none" stroke="${C.white}" stroke-width="10" stroke-linecap="round" opacity=".9"/>`;
    // écran
    s += `<rect x="182" y="110" width="236" height="210" rx="58" fill="${C.screen}" ${S(5)}/>`;
    s += `<ellipse cx="216" cy="268" rx="20" ry="11" fill="${C.accent}" opacity="${ex.blush ? 0.55 : 0.18}"/>`;
    s += `<ellipse cx="384" cy="268" rx="20" ry="11" fill="${C.accent}" opacity="${ex.blush ? 0.55 : 0.18}"/>`;
    s += eye(254, 200, e) + eye(346, 200, e);
    s += brow(-1, ex.bl[0], ex.bl[1]) + brow(1, ex.br[0], ex.br[1]);
    s += mouth;
    return s;
  }

  /* ------------------------------ MAINS ------------------------------ */
  // dessinées doigts vers le haut (−y), puis tournées/miroitées par hand()
  const finger = (x1, y1, x2, y2, w) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.ink}" stroke-width="${w + 9}" stroke-linecap="round"/>` +
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.shell}" stroke-width="${w}" stroke-linecap="round"/>`;
  const palm = () => `<rect x="-30" y="-58" width="60" height="66" rx="24" fill="${C.shell}" ${S(5)}/>`;
  const HAND = {
    open: () => finger(-22, -20, -48, -48, 16) + finger(-14, -50, -16, -96, 16) + finger(4, -52, 4, -100, 16) + finger(20, -48, 24, -90, 16) + palm(),
    point: () => finger(16, -50, 16, -116, 16) + palm() + `<path d="M-20 -54 h26" ${S(4)}/>` + finger(-22, -16, 2, -34, 15),
    thumb: () => finger(-10, -48, -10, -100, 24) + palm() + `<path d="M-2 -40 h24 M-2 -24 h24" ${S(4)}/>`,
    fist: () => palm() + `<path d="M-20 -54 h40 M-20 -38 h40" ${S(4)}/>`,
    peace: () => finger(4, -50, -8, -112, 15) + finger(20, -48, 32, -108, 15) + palm() + finger(-22, -16, 2, -34, 15)
  };
  const hand = (g, x, y, rot, flip) => `<g transform="translate(${x} ${y}) rotate(${rot || 0}) scale(${flip ? -1 : 1} 1)">${(HAND[g] || HAND.fist)()}</g>`;

  /* ------------------------------ POSES ------------------------------ */
  // L = bras côté gauche de l'image, R = côté droit.
  // e = coude [x,y], h = poignet [x,y], g = geste de la main, r = rotation de la main, f = bras devant le visage
  const REST_L = { e: [104, 640], h: [128, 770], g: 'fist', r: 180 };
  const REST_R = { e: [496, 640], h: [472, 770], g: 'fist', r: 180, m: 1 };
  const POSE = {
    neutral:   { L: REST_L, R: REST_R },
    wave:      { L: REST_L, R: { e: [540, 520], h: [560, 360], g: 'open', r: 12, m: 1 } },
    explain:   { L: REST_L, R: { e: [520, 610], h: [548, 520], g: 'open', r: 28, m: 1 } },
    explain2:  { L: { e: [80, 600], h: [52, 510], g: 'open', r: -28 }, R: { e: [520, 610], h: [548, 520], g: 'open', r: 28, m: 1 } },
    shrug:     { L: { e: [70, 600], h: [40, 500], g: 'open', r: -34 }, R: { e: [530, 600], h: [560, 500], g: 'open', r: 34, m: 1 } },
    pointup:   { L: REST_L, R: { e: [532, 560], h: [522, 420], g: 'point', r: 4, m: 1 } },
    pointside: { L: REST_L, R: { e: [540, 560], h: [640, 500], g: 'point', r: 70, m: 1 } },
    thumbup:   { L: REST_L, R: { e: [520, 620], h: [510, 500], g: 'thumb', r: 6, m: 1 } },
    peace:     { L: REST_L, R: { e: [520, 600], h: [520, 470], g: 'peace', r: 6, m: 1 } },
    think:     { L: { e: [130, 720], h: [320, 700], g: 'fist', r: 90 }, R: { e: [470, 650], h: [350, 392], g: 'fist', r: -24, m: 1, f: 1 } },
    victory:   { L: { e: [66, 420], h: [48, 270], g: 'fist', r: -8 }, R: { e: [534, 420], h: [552, 270], g: 'fist', r: 8, m: 1 } },
    present:   { L: { e: [60, 640], h: [30, 560], g: 'open', r: -20 }, R: REST_R }
  };

  function armSvg(side, p) {
    const sh = side < 0 ? [158, 478] : [442, 478];
    const pts = `${sh[0]},${sh[1]} ${p.e[0]},${p.e[1]} ${p.h[0]},${p.h[1]}`;
    const tube = `<polyline points="${pts}" fill="none" ${S(50)}/>` +
      `<polyline points="${pts}" fill="none" stroke="${C.shellD}" stroke-width="38" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<circle cx="${p.e[0]}" cy="${p.e[1]}" r="24" fill="${C.shell}" ${S(5)}/>`;
    return { svg: tube + hand(p.g, p.h[0], p.h[1], p.r, !p.m), front: !!p.f };
  }

  /* ------------------------------ ACCESSOIRES ------------------------------ */
  const star = (x, y, r, col) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z" fill="${col}" ${S(4.5)}/>`;
  const PROPS = {
    drop: () => `<path d="M462 150 C444 186 452 212 472 212 C492 212 498 184 462 150 Z" fill="${C.glow}" ${S(4.5)}/>`,
    sparkle: () => [[100, 150, 26], [500, 110, 34], [530, 250, 20], [72, 300, 18]].map(([x, y, r]) => star(x, y, r, C.led2)).join(''),
    bulb: () => `<g transform="translate(300 -60)"><circle r="44" fill="${C.led2}" ${S(6)}/><rect x="-18" y="38" width="36" height="24" rx="6" fill="${C.shellD}" ${S(5)}/><g ${S(6)} fill="none"><path d="M-78 -26 l-24 -12 M78 -26 l24 -12 M0 -66 v-24"/></g></g>`,
    qmark: () => `<text x="468" y="140" font-family="Montserrat, sans-serif" font-weight="900" font-size="120" fill="${C.accent}" stroke="${C.ink}" stroke-width="6" paint-order="stroke">?</text>`,
    alert: () => `<text x="470" y="140" font-family="Montserrat, sans-serif" font-weight="900" font-size="130" fill="${C.led2}" stroke="${C.ink}" stroke-width="6" paint-order="stroke">!</text>`
  };

  /* ------------------------------ RENDU ------------------------------ */
  // contour « sticker » : halo blanc épais + fin trait sombre, calculés à partir de la silhouette
  function defs() {
    return `<defs><filter id="stk" x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">` +
      `<feMorphology in="SourceAlpha" operator="dilate" radius="11" result="m1"/>` +
      `<feGaussianBlur in="m1" stdDeviation="3.5" result="b1"/>` +
      `<feComponentTransfer in="b1" result="a1"><feFuncA type="linear" slope="14" intercept="-5"/></feComponentTransfer>` +
      `<feFlood flood-color="#ffffff" result="wf"/><feComposite in="wf" in2="a1" operator="in" result="white"/>` +
      `<feMorphology in="a1" operator="dilate" radius="3.5" result="m2"/>` +
      `<feFlood flood-color="${C.ink}" result="kf"/><feComposite in="kf" in2="m2" operator="in" result="dark"/>` +
      `<feMerge><feMergeNode in="dark"/><feMergeNode in="white"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  }

  function render(o) {
    o = o || {};
    const ex = EXPR[o.expr || 'smile'] || EXPR.smile;
    const pose = POSE[o.pose || 'neutral'] || POSE.neutral;
    const tilt = o.tilt != null ? o.tilt : (ex.tilt || 0);
    const head = `<g transform="rotate(${tilt} 300 380)">${headSvg(ex, !!o.open, o.gaze)}</g>`;
    const props = (o.props || []).concat(ex.props || []).map((p) => (PROPS[p] ? PROPS[p]() : '')).join('');
    let body = '';
    if (!o.headOnly) {
      body += `<rect x="270" y="350" width="60" height="64" fill="${C.shellD}" ${S(5)}/>`;                       // cou
      body += `<path d="M160 470 C160 426 198 406 246 406 L354 406 C402 406 440 426 440 470 L452 900 L148 900 Z" fill="${C.shell}" ${S(6)}/>`;
      body += `<path d="M170 800 Q300 770 430 800 L442 900 L158 900 Z" fill="${C.shellD}" ${S(5)}/>`;
      body += `<rect x="236" y="560" width="128" height="116" rx="24" fill="${C.screen}" ${S(5)}/>`;              // panneau
      body += `<circle cx="270" cy="604" r="12" fill="${C.accent}"/><circle cx="300" cy="604" r="12" fill="${C.glow}"/><circle cx="330" cy="604" r="12" fill="${C.led2}"/>`;
      body += `<rect x="256" y="636" width="88" height="14" rx="7" fill="${C.glow}" opacity=".7"/>`;
      for (const x of [158, 442]) body += `<circle cx="${x}" cy="478" r="34" fill="${C.shellD}" ${S(5)}/>`; // épaules
      const arms = [armSvg(-1, pose.L), armSvg(1, pose.R)];
      arms.filter((a) => !a.front).forEach((a) => { body += a.svg; });
      body += head;
      arms.filter((a) => a.front).forEach((a) => { body += a.svg; });
    } else {
      body += `<rect x="270" y="350" width="60" height="44" fill="${C.shellD}" ${S(5)}/>`;
      body += head;
    }
    body += props;
    const vb = o.headOnly ? '100 -40 400 470' : '-110 -170 820 1070';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${o.w || ''}" height="${o.h || ''}">${defs()}<g filter="url(#stk)">${body}</g></svg>`;
  }

  const api = { name: 'Proto', render, EXPR, POSE, PROPS, COLORS: C, ASPECT: { full: 820 / 1070, head: 400 / 470 } };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CHARACTER = api;
})(typeof window !== 'undefined' ? window : globalThis);
