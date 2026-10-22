/* extra.js — élément sur mesure pour cette vidéo : un rayon de Soleil qui traverse l'air.
   { type:'sky', top, at, atMolecules, atScatter, until }
   - le rayon blanc (rouge + vert + bleu) part du Soleil,
   - des molécules apparaissent sur son trajet,
   - le bleu est dévié dans toutes les directions, le rouge et le vert continuent tout droit.
   Modèle pour tes propres éléments : K.register(nom, (R, spec, X) => (t) => { ... }). */
(function () {
  const { mk, seg, eo3, eob, clamp } = ENG; const { T, put } = K;
  const INK = THEME.ink, BLUE = '#2b59ff', RED = '#e5484d', GREEN = '#30a46c';

  K.register('sky', (R, s, X) => {
    const A = [175, 165], B = [860, 520];                         // départ et arrivée du rayon
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const nx = -(B[1] - A[1]) / len, ny = (B[0] - A[0]) / len;   // normale au rayon (pour décaler les 3 couleurs)
    const at = (f) => [A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f];
    const beam = (col, off) => `<line class="b" x1="${A[0] + nx * off}" y1="${A[1] + ny * off}" x2="${B[0] + nx * off}" y2="${B[1] + ny * off}" stroke="${col}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}"/>`;
    const mols = [0.38, 0.55, 0.72].map(at);
    let molSvg = '', rays = '';
    mols.forEach(([x, y], i) => {
      molSvg += `<g class="m" transform="translate(${x} ${y})" style="opacity:0"><circle cx="-12" r="20" fill="#fff" stroke="${INK}" stroke-width="6"/><circle cx="14" r="20" fill="#fff" stroke="${INK}" stroke-width="6"/></g>`;
      for (let k = 0; k < 7; k++) {                                // rayons bleus déviés (angles fixes = rendu reproductible)
        const a = (k / 7) * Math.PI * 2 + i * 0.6, r0 = 34, r1 = 95 + (k % 3) * 22;
        rays += `<line class="r" data-i="${i}" x1="${x + Math.cos(a) * r0}" y1="${y + Math.sin(a) * r0}" x2="${x + Math.cos(a) * r1}" y2="${y + Math.sin(a) * r1}" stroke="${BLUE}" stroke-width="9" stroke-linecap="round" stroke-dasharray="6 16" style="opacity:0"/>`;
      }
    });
    const html = `<svg width="900" height="620" viewBox="0 0 900 620" style="overflow:visible">
      <rect x="0" y="0" width="900" height="620" rx="0" fill="#dfe9ff" stroke="${INK}" stroke-width="8"/>
      <g>${beam(RED, -16)}${beam(GREEN, 0)}<g class="blue">${beam(BLUE, 16)}</g></g>
      <g>${rays}</g><g>${molSvg}</g>
      <g transform="translate(120 112)"><circle r="78" fill="#ffd84a" stroke="${INK}" stroke-width="8"/>
        <g stroke="${INK}" stroke-width="8" stroke-linecap="round">${Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4; return `<line x1="${Math.cos(a) * 96}" y1="${Math.sin(a) * 96}" x2="${Math.cos(a) * 122}" y2="${Math.sin(a) * 122}"/>`; }).join('')}</g></g>
    </svg>`;
    const el = mk(R, '', html, { left: '82px', top: s.top + 'px', width: '900px', height: '620px', boxShadow: `14px 14px 0 ${INK}` });
    const beams = Array.from(el.querySelectorAll('.b')), ms = Array.from(el.querySelectorAll('.m')), rs = Array.from(el.querySelectorAll('.r'));
    const blue = el.querySelector('.blue');
    const tB = X.t0 + 0.25, tM = s.atMolecules != null ? T(s.atMolecules) : null, tS = s.atScatter != null ? T(s.atScatter) : null;
    return (t) => {
      if (!put(el, t, X.t0, X.t1, { r: -1, dy: 60 })) return;
      const kb = eo3(seg(t, tB, 0.8));
      beams.forEach((b) => b.setAttribute('stroke-dashoffset', len * (1 - kb)));
      if (tM != null) ms.forEach((m, i) => { const k = eob(seg(t, tM + i * 0.12, 0.3)); m.style.opacity = clamp(k); m.setAttribute('transform', `translate(${mols[i][0]} ${mols[i][1]}) scale(${0.3 + 0.7 * k})`); });
      if (tS != null) {
        rs.forEach((r) => { r.style.opacity = clamp((t - tS - (+r.dataset.i) * 0.15) / 0.25); });
        blue.style.opacity = 1 - 0.75 * clamp((t - tS) / 0.5);    // le bleu « quitte » le rayon
      }
    };
  });
})();
