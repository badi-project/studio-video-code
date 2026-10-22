/* theme.js — couleurs de la chaîne. Change-les ici (ou dans videos/<v>/theme.js) pour donner ton identité visuelle.
   Les valeurs sont injectées en variables CSS (--bg, --ink, --accent…) et utilisées par kit.js / shapes.js. */
(function (root) {
  const T = Object.assign({
    bg: '#eef2f7',        // fond
    ink: '#10131a',       // texte, contours, ombres portées
    accent: '#2b59ff',    // couleur forte : mots clés, gros chiffres, boutons
    accent2: '#ff6b3d',   // couleur secondaire : motifs, détails
    paper: '#ffffff',     // fond des cartouches
    gridAlpha: 0.075      // opacité du quadrillage
  }, root.THEME || {});
  root.THEME = T;
  const enc = (s) => encodeURIComponent(s);
  const pattern = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><rect width='180' height='180' fill='${T.bg}'/>` +
    `<polygon points='90,10 170,90 90,170 10,90' fill='${T.ink}' transform='translate(9 9)'/><polygon points='90,10 170,90 90,170 10,90' fill='${T.accent}'/></svg>`;
  const dots = `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><rect width='180' height='180' fill='${T.accent2}'/>` +
    `<circle cx='90' cy='90' r='50' fill='${T.ink}' transform='translate(9 9)'/><circle cx='90' cy='90' r='50' fill='${T.paper}'/></svg>`;
  const css = document.documentElement.style;
  css.setProperty('--bg', T.bg); css.setProperty('--ink', T.ink); css.setProperty('--accent', T.accent);
  css.setProperty('--accent2', T.accent2); css.setProperty('--paper', T.paper);
  css.setProperty('--grid', `rgba(0,0,0,${T.gridAlpha})`);
  css.setProperty('--pattern', `url("data:image/svg+xml;utf8,${enc(pattern)}")`);
  css.setProperty('--dots', `url("data:image/svg+xml;utf8,${enc(dots)}")`);
})(window);
