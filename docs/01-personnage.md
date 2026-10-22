# 1. Créer son personnage

Le personnage est ce qui rend une chaîne reconnaissable d'une vidéo à l'autre. Ici, il n'est ni dessiné à la main ni généré image par image par une IA : il est **décrit en code** (SVG paramétrique). On obtient ainsi un personnage parfaitement identique dans chaque vidéo, des dizaines d'expressions et de poses à partir de quelques fonctions, un rendu net à toutes les tailles, et un fichier texte léger que l'on peut versionner et faire évoluer.

Le dépôt fournit un personnage d'exemple, **Proto** (un petit robot), dans [`character/character.js`](../character/character.js). Il sert de modèle : remplace-le par le tien en gardant la même API.

![Planche du personnage d'exemple](../media/planche-personnage.png)

---

## Étape 1 — Le concept (sur papier, 15 minutes)

Réponds à ces questions avant d'écrire la moindre ligne :

| Question | Pourquoi |
|---|---|
| **Nom** : court, facile à prononcer par une voix de synthèse, lié au thème de la chaîne | Il sera dit à voix haute et tapé dans la recherche |
| **Rôle** : guide, élève curieux, sceptique, reporter… | Détermine ses expressions et ses poses utiles |
| **Ton** : tutoiement ou vouvoiement, sérieux ou taquin | Doit coller au texte des vidéos |
| **3 signes distinctifs** : une silhouette, une couleur dominante, un symbole ou accessoire | Ce qui le rend reconnaissable en vignette |

**Test de la vignette** : réduit à 100 px de haut, ton personnage doit rester identifiable. Si ce n'est pas le cas, simplifie la silhouette ou renforce la couleur dominante.

**Originalité** : ne pars pas d'un personnage existant (mascotte, dessin animé, logo). Même modifié, il resterait reconnaissable et poserait un problème de droits. Invente ta propre combinaison de formes et de couleurs.

## Étape 2 — Le brief de design

Quelques règles qui marchent bien en vidéo verticale :

- **Une forme de tête simple** (cercle, rectangle arrondi, goutte) : elle sera souvent en gros plan.
- **De grands yeux** : c'est là que passe l'émotion. Une pupille qui bouge suffit à « regarder » quelque chose.
- **Des sourcils épais** : ils portent à eux seuls la moitié des expressions (surprise, doute, colère).
- **Une palette de 3 à 4 couleurs** plus un contour sombre, qui contraste avec le fond de tes vidéos (le personnage ne doit jamais se fondre dans le décor).
- **Un rendu « sticker »** : un contour blanc épais puis un fin trait sombre autour de la silhouette. Il détache le personnage de n'importe quel fond.

Écris ces choix dans une **fiche personnage** (modèle en bas de page). Elle sera ta référence pour toutes les vidéos.

## Étape 3 — Dessiner en SVG paramétrique

Tout le personnage tient dans une fonction `render(options)` qui renvoie une chaîne SVG. On travaille dans un repère fixe (ici `viewBox` 600 × 900 environ, tête centrée sur x = 300) et on découpe le dessin en petites fonctions.

### 3.1 Les parties du visage

```js
function eye(cx, cy, o)          // œil : taille (rx, ry), pupille (pr), regard (gx, gy), paupière (lid), œil fermé / heureux
function brow(side, inner, outer) // sourcil : deux décalages verticaux (intérieur, extérieur)
const MOUTH = { smile, laugh, talk, o, flat, frown, grit, … }  // bouches nommées
```

Le regard est un simple décalage de la pupille, découpée par l'ellipse de l'œil (`clipPath`). Une paupière est un rectangle de la couleur de la peau (ou de l'écran) qui recouvre le haut de l'œil.

### 3.2 Les expressions sont des données

Une expression n'est pas un dessin : c'est une **combinaison de réglages**. Ajouter une expression = ajouter une ligne.

```js
const EXPR = {
  smile:   { e: {},                    bl: [0, -4],   br: [0, -4],   mouth: 'smileclosed', talk: 'smile' },
  shock:   { e: { rx: 27, ry: 35, pr: 6 }, bl: [-18, -18], br: [-18, -18], mouth: 'gasp', talk: 'gasp' },
  skeptic: { e: { lid: 0.45 },         bl: [6, -2],   br: [-6, -12], mouth: 'flat', talk: 'talk', tilt: 3 },
};
```

- `e` : réglages des yeux (taille, pupille, paupière, regard)
- `bl` / `br` : sourcils gauche / droit
- `mouth` : bouche au repos, `talk` : bouche quand le personnage parle
- `tilt` : inclinaison de la tête, `blush` : joues, `props` : accessoires automatiques (goutte de stress…)

Une quinzaine d'expressions couvre tous les besoins : `smile, explain, grin, joy, proud, smirk, sideeye, skeptic, worried, shock, wow, angry, think, deadpan, sad`.

### 3.3 Les poses sont des coordonnées

Chaque bras est une ligne brisée épaule → coude → poignet, dessinée comme un trait très épais (une manche, un tube) avec une main au bout. Une pose se résume donc à quelques nombres :

```js
const POSE = {
  explain:  { L: REST_L, R: { e: [520, 610], h: [548, 520], g: 'open',  r: 28, m: 1 } },
  pointup:  { L: REST_L, R: { e: [532, 560], h: [522, 420], g: 'point', r: 4,  m: 1 } },
  think:    { L: …,      R: { e: [470, 650], h: [350, 392], g: 'fist',  r: -24, m: 1, f: 1 } },
};
```

`e` = coude, `h` = poignet, `g` = geste de la main (`open`, `point`, `thumb`, `fist`, `peace`), `r` = rotation de la main, `m` = côté miroir, `f` = bras **devant** la tête (main au menton, mains sur les joues…). L'ordre de dessin compte : bras de derrière, puis tête, puis bras de devant.

Les mains sont dessinées une fois, doigts vers le haut, puis tournées et retournées par une transformation SVG.

### 3.4 Le contour sticker

Un seul filtre SVG appliqué à tout le personnage, calculé à partir de sa silhouette :

1. `feMorphology dilate` : on épaissit la silhouette → futur halo blanc ;
2. un léger flou puis un seuil (`feComponentTransfer`) pour arrondir ce halo ;
3. on l'épaissit encore un peu et on le remplit de la couleur sombre → fin trait extérieur ;
4. `feMerge` : trait sombre, puis halo blanc, puis le dessin.

Voir `defs()` dans `character.js`.

### 3.5 La bouche qui parle

Chaque variante est rendue deux fois : bouche fermée (`mouth`) et bouche ouverte (`talk`). Pendant la vidéo, le moteur choisit l'une ou l'autre image par image selon le **volume de la voix** à cet instant. C'est une synchro labiale simple mais très convaincante à 30 images par seconde.

## Étape 4 — Pré-rendre en PNG

Le filtre « sticker » est coûteux à calculer. Plutôt que de dessiner le SVG à chaque image de la vidéo, `make_video.py assets` rend **une fois** chaque combinaison utilisée (`cadrage__pose__expression__bouche__accessoires`) en PNG transparent, et les garde en cache dans `assets/character/`. La vidéo n'affiche ensuite que des images.

## Étape 5 — La planche de personnage

```bash
python3 tools/character_sheet.py media/planche-personnage.png
```

Elle affiche toutes les poses et toutes les expressions sur une page. Vérifie à chaque modification :

- [ ] les mains ne traversent pas le corps ou la tête de façon bizarre ;
- [ ] chaque expression se lit sans légende (cache le nom et devine) ;
- [ ] les couleurs restent les mêmes partout ;
- [ ] le contour sticker est continu (pas de trou entre bras et corps).

## Étape 6 — La voix

Choisis une voix de synthèse et une vitesse, et ne les change plus : la voix fait partie du personnage autant que son dessin. Les voix disponibles sont listées dans `tools/voice.py` (`VOICES`). Teste-les sur la même phrase, à des vitesses de 1,0 à 1,15, avant de choisir.

Les mots que la voix prononce mal se corrigent dans `pron.json` (écriture phonétique, appliquée seulement au texte dit, jamais au texte affiché). Voir [03-pipeline.md](03-pipeline.md).

---

## Modèle de fiche personnage

Copie ce bloc dans un fichier privé (il peut contenir des informations sur ta chaîne : ne le publie pas si tu ne le souhaites pas).

```markdown
# Fiche : <NOM>
- Rôle :
- Ton : (tutoiement / vouvoiement, humour, limites)
- Signes distinctifs : 1) … 2) … 3) …
- Palette : contour #…, couleur dominante #…, secondaire #…, détails #…
- Polices : titres …, sous-titres …, code …
- Expressions : …
- Poses : …
- Accessoires : …
- Voix : <modèle>, vitesse …
- Mots à réécrire phonétiquement : …
```
