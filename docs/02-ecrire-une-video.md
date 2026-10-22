# 2. Écrire une vidéo : `story.json` + `scenes.json`

Une vidéo est un dossier `videos/<nom>/` qui contient deux fichiers écrits à la main :

- **`story.json`** : ce qui est **dit** (et sous-titré) ;
- **`scenes.json`** : ce que l'on **voit**, calé sur le texte.

Optionnels : `extra.js` (tes propres éléments animés), `theme.js` (couleurs propres à cette vidéo), `legende.txt` (la description à publier).

```bash
python3 tools/make_video.py videos/ma-video new   # copie le modèle videos/_modele
```

L'exemple complet : [`videos/demo-ciel-bleu`](../videos/demo-ciel-bleu).

---

## `story.json`

```json
{"phrases": [
  ["Pourquoi le ciel", "est *bleu* ?"],
  ["La lumière du Soleil", "contient *toutes les couleurs*."],
  ["Le bleu est dispersé", "environ *5 fois plus*", "que le rouge."]
]}
```

- **Une phrase** = une liste de **chunks**. La voix marque une pause après chaque phrase.
- **Un chunk** = un morceau de texte de 25 à 45 caractères, affiché en grand en haut de l'écran pendant qu'il est prononcé. C'est le rythme visuel de la vidéo.
- `*mot*` : mot mis dans la couleur forte (légende, sous-titres, cartouches).
- Les nombres sont dits en lettres automatiquement (`5 fois` → « cinq fois », `1er` → « premier », `3,5` → « trois virgule cinq »).
- Pour forcer une prononciation sur un seul passage : `{"show": "texte affiché", "say": "texte dit"}`.
- Durée visée : **55 à 70 s**, soit 14 à 19 phrases.

## `scenes.json`

```json
{"scenes": [
  {"from": 0, "to": 1, "bg": "grid", "els": [
    {"type": "box", "variant": "accent", "text": "TITRE\n*EN COULEUR*", "top": 420, "size": 80, "at": "0.1", "r": -2},
    {"type": "big", "count": {"to": 82, "suffix": " %"}, "size": 230, "top": 720, "at": "1"},
    {"type": "char", "mode": "head", "h": 420, "cx": 540, "cy": 1300,
     "seq": [{"pose": "neutral", "expr": "wow"}, {"at": "1", "pose": "neutral", "expr": "grin"}]}
  ]}
]}
```

- Une **scène** est visible de la phrase `from` à la phrase `to` (incluses). Les changements de scène tombent dans les silences entre phrases.
- `bg` : `grid` (quadrillage, par défaut), `pattern` (motif losanges, pour les moments forts et la fin), `dots`, `plain`. `morph: {"to": "pattern", "at": "5.1"}` change de fond en cours de scène.
- `cap: false` masque les légendes du haut, `cap: "box"` les encadre. `sub: false` masque les sous-titres. `capY` / `subY` les déplacent.

### Références de temps (`at`, `until`)

| Écriture | Instant |
|---|---|
| `"3"` | début de la phrase 3 (on compte à partir de 0) |
| `"3.1"` | début du 2ᵉ chunk de la phrase 3 |
| `"3>"` | fin de la phrase 3 |
| `"3.1>"` | fin du 2ᵉ chunk de la phrase 3 |
| `"3.1+0.4"`, `"4-0.2"` | avec un décalage en secondes |
| `12.5` (nombre) | 12,5 s depuis le début |

Sans `at`, l'élément apparaît au début de la scène ; sans `until`, il reste jusqu'à la fin de la scène.

### Propriétés communes

`top` (position verticale en px sur 1920), `r` (rotation en degrés), `dx` / `dy` (direction d'arrivée), `scale`, `d` (durée de l'apparition).

### Éléments disponibles

| `type` | Usage | Propriétés principales |
|---|---|---|
| `box` | cartouche titre | `text`, `variant` (`""`, `accent`, `ink`), `size`, `lh`, `maxW`, `strikeAt` (avec `~mot~` barré) |
| `tag` | petite étiquette | `text`, `variant` (`""`, `w`), `size` |
| `big` | énorme mot ou compteur animé | `text` ou `count: {to, from, dec, prefix, suffix, at, dur}`, `size`, `color` |
| `stamp` | tampon incliné | `text`, `style` (`outline`, `solid`), `rot` |
| `band` | bande hachurée « ATTENTION » | `text`, `size` |
| `note` | encadré avec étiquette | `label`, `text`, `w`, `size` |
| `quote` | citation (réelle et sourcée !) | `text`, `who` |
| `cards` | cartes empilées | `items: [{glyph, title, sub, at, color}]`, `h`, `gap` |
| `list` | lignes cochées | `items: [{text, mark: "✓" / "✗" / "→", at}]` |
| `bars` | jauges horizontales | `items: [{label, pct, value, at, color}]` |
| `versus` | A contre B | `a: {text, variant, at}`, `b: {…}`, `vsAt` |
| `squares` | grille de carrés qui s'allument | `n`, `cols`, `lit: {to, at, dur}` |
| `win` | fenêtre de code ou de navigateur | `title` ou `url`, `code: [lignes]` (tapé), `rows`, `typeFrom`, `typeTo` |
| `chat` | champ de commentaire tapé + curseur | `text`, `who`, `cursor`, `cursorAt`, `clickAt` |
| `cta` | cœur + bouton « S'abonner » | `text`, `btnAt` |
| `arrow` | flèche vers le bas | — |
| `ring` | jauge circulaire (`engine/shapes.js`) | `pct`, `label`, `dur` |
| `steps` | étapes numérotées (`engine/shapes.js`) | `items: [{text, at}]` |
| `html` | HTML libre | `html`, `css`, `center` |
| `char` | le personnage | voir ci-dessous |

Le texte des éléments accepte `*mot*` (couleur forte), `~mot~` (barré animé) et `\n` (retour à la ligne). Il est rétréci automatiquement s'il dépasse la largeur disponible.

### Le personnage (`char`)

- `mode: "head"` : gros plan sur la tête, `h` 400 à 420, `cx` 540, `cy` 1300 à 1330. C'est le cadrage par défaut, sous le contenu.
- `mode: "full"` : en pied, `bottom` 1945, `h` 900 à 1000. Pour l'intro et la fin.
- `seq` : la suite des attitudes, `[{at, pose, expr, props, flip}]`. La première n'a pas besoin de `at`.
- La bouche s'anime toute seule avec la voix.

## Zones sûres (Reels, TikTok, Shorts)

L'interface des applications recouvre une partie de l'image. Règles qui évitent les mauvaises surprises :

- **Sous-titres** à y = 1500 (par défaut), jamais sous y ≈ 1630 (boutons et description en bas).
- **Légendes** du haut à y = 215.
- **Rien d'important dans les ~120 px de droite** entre y = 900 et y = 1650 (boutons j'aime, commentaires, partage).
- **Contenu principal entre y = 380 et y = 1060** quand la tête du personnage est affichée (elle occupe 1090 à 1510) : aucun élément ne doit toucher sa tête.

`make_video.py preview` signale automatiquement les éléments qui sortent de l'écran ou dont le texte déborde ; les chevauchements, eux, se voient sur la planche.

## Tes propres éléments : `extra.js`

Quand aucun élément ne convient (un schéma, une machine, une carte…), dessine-le en SVG et enregistre-le :

```js
K.register('monschema', (R, s, X) => {
  const el = ENG.mk(R, '', '<svg …>…</svg>', { left: '90px', top: s.top + 'px' });
  const tA = K.T(s.atAnim);                        // instant lu dans le JSON
  return (t) => {                                  // appelé à chaque image
    if (!K.put(el, t, X.t0, X.t1)) return;         // apparition avec rebond
    const k = ENG.eo3(ENG.seg(t, tA, 0.6));        // progression 0 → 1
    // … modifier les attributs SVG selon k
  };
});
```

Puis dans `scenes.json` : `{"type": "monschema", "top": 420, "atAnim": "3.1"}`. Exemple complet : l'élément `sky` de la démo.

**Règle d'or** : la fonction `(t) => …` doit donner exactement le même résultat pour le même `t`, quel que soit l'ordre des appels. Pas de `Math.random()` sans graine, pas de `setTimeout`, pas d'animation CSS : c'est ce qui permet le rendu image par image et en parallèle.

## Couleurs : `theme.js`

Les couleurs par défaut sont dans `engine/theme.js`. Pour une vidéo particulière, crée `videos/<nom>/theme.js` :

```js
window.THEME = { accent: '#e5484d', bg: '#fff7ec' };
```

## Liberté totale : `scenes.js`

Si un dossier contient `scenes.js`, il remplace `scenes.json` : tu écris directement les scènes en JavaScript avec `ENG.sc(from, to, options, (racine, scène) => (t) => {…})`. Utile pour une vidéo très spéciale ; pour tout le reste, le JSON va plus vite.
