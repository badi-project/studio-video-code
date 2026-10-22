# 6. Avant de publier ton dépôt : l'audit de confidentialité

Si tu adaptes ce dépôt à ta propre chaîne puis que tu le publies, il est facile de laisser traîner une information personnelle : un chemin de fichier avec ton nom d'utilisateur, l'adresse e-mail de tes commits, le pseudo de ton compte dans un exemple, la position GPS d'une photo… L'outil `tools/privacy_audit.py` les cherche pour toi.

## 1. Liste tes termes privés

Crée un fichier **hors du dépôt** (ou `.audit-private.txt`, déjà ignoré par git) avec un terme par ligne :

```text
# identité
Prénom
Nom
prenom.nom
# comptes et chaîne
@mon_pseudo
nom_du_personnage
# lieux, école, employeur
Ma Ville
```

Mets-y tout ce qui pourrait relier le dépôt à toi ou à tes comptes : nom, pseudos, nom de ton personnage, ville, école, employeur, noms de proches. La comparaison ignore majuscules et accents.

## 2. Lance l'audit

```bash
python3 tools/privacy_audit.py . --private ~/termes-prives.txt --allow-email 12345+pseudo@users.noreply.github.com
```

- **BLOQUANT** : à corriger avant toute publication (termes privés, secrets, e-mails, chemins personnels, métadonnées d'images ou de vidéos, auteur de commit non anonyme).
- **À VÉRIFIER** : à relire à la main (pseudos, numéros, adresses IP, liste des sites cités).

Le script renvoie un code d'erreur s'il reste un point bloquant : tu peux l'ajouter à un crochet `pre-push`.

## 3. Les pièges classiques

| Piège | Parade |
|---|---|
| **Auteur des commits** : git écrit ton nom et ton e-mail dans chaque commit, pour toujours | Configure une adresse « noreply » de GitHub (*Settings → Emails → Keep my email addresses private*) **avant** le premier commit : `git config user.email "ID+pseudo@users.noreply.github.com"` |
| **Historique** : un fichier supprimé reste lisible dans les anciens commits | Commence le dépôt public avec un historique propre (nouveau dépôt, un seul commit) plutôt que de publier ton dépôt de travail |
| **Chemins absolus** dans la doc ou les journaux | Toujours des chemins relatifs au dépôt |
| **Métadonnées** des photos (GPS, appareil) et des vidéos (titre, auteur) | Exporte sans métadonnées : `ffmpeg … -map_metadata -1`, ou ré-enregistre les images |
| **Fichiers générés** (`build/`, `out/`, journaux de publication) | Ils sont dans `.gitignore` : ne force pas leur ajout |
| **Exemples trop proches de ta chaîne** (mêmes sujets, mêmes couleurs, même voix) | Un exemple neutre empêche de relier le dépôt à ton compte |
| **Ton nom d'utilisateur GitHub** | Il apparaît dans l'adresse du dépôt : vérifie qu'il te convient |
| **Clés et jetons** | Jamais dans le code : variables d'environnement, et un fichier `.env` ignoré par git |

## 4. Relis quand même

Aucun outil ne remplace une relecture : parcours chaque fichier une dernière fois en te demandant « est-ce que quelqu'un pourrait remonter jusqu'à moi avec ça ? ».
