# 4. Écrire le texte et la légende

La technique ne sert à rien si le texte ne retient pas l'attention ou s'il raconte quelque chose de faux. Voici les règles qui servent de garde-fous à chaque vidéo.

## Le public et le ton

- Écris pour quelqu'un de **curieux mais pas spécialiste**. Si un mot technique est indispensable, explique-le dans la phrase suivante.
- **Phrases courtes** : 12 mots maximum, une idée par phrase. Ce qui est simple à dire est simple à sous-titrer.
- Choisis un registre (tutoiement ou vouvoiement) et garde-le dans toutes les vidéos et toutes les légendes.
- L'humour est le bienvenu, la moquerie non.

## La structure en 6 temps (≈ 60 s)

| Temps | Durée | Contenu |
|---|---|---|
| 1. **Accroche** | 0 à 4 s | Un chiffre ou un fait étonnant. C'est là que tout se joue : pas d'introduction, pas de « Salut ! ». |
| 2. **Qui / quoi** | 1 à 2 phrases | Le fait, simplement. |
| 3. **Pourquoi ça compte** | 3 ou 4 images | Une comparaison concrète, un ordre de grandeur, une conséquence. Une idée = un visuel. |
| 4. **La nuance** | 1 à 2 phrases | Ce qu'on ne sait pas encore, les limites, ce qui reste à confirmer. |
| 5. **La question** | 1 phrase | Une question facile à laquelle répondre en commentaire. |
| 6. **Appel à s'abonner** | 1 phrase | Le personnage en pied, fond de fin. |

Le squelette est prêt dans [`videos/_modele/story.json`](../videos/_modele/story.json).

## La vérité d'abord

- **Chaque fait est vérifié sur au moins deux sources indépendantes**, ou sur la source primaire (l'étude, le communiqué officiel, le comité qui décerne le prix…). Un chiffre qui ne vient que d'une seule source secondaire est retiré.
- **On attribue** : « selon l'agence spatiale », « d'après l'étude publiée dans… ». Ça protège autant que ça informe.
- **« Possible » n'est pas « prouvé »** : quand il y a un doute, la vidéo le dit à voix haute.
- **Âges, dates, durées : recalculés**, jamais recopiés.
- **Aucune citation inventée.** L'élément `quote` ne sert qu'à des phrases réellement prononcées ou écrites, avec leur auteur.
- **Fraîcheur** : « vient de » et « aujourd'hui » seulement si la vidéo sort dans les 24 h. Sinon, une formule neutre (« a annoncé », « cette semaine »).

## Les sujets

Un bon sujet tient en une phrase surprenante et se montre en 3 ou 4 images. À éviter pour une chaîne de vulgarisation : la politique partisane, la vie privée des gens, la santé « miracle » et les rumeurs.

## La légende (description du post)

Une légende qui ressemble à un communiqué ou à un texte généré à la chaîne fait fuir. Ce qui marche mieux : **2 à 4 phrases courtes, comme un message à un ami curieux.**

1. Le fait le plus surprenant, d'abord.
2. Un détail concret que la vidéo n'a pas eu le temps de dire.
3. La même question que dans la vidéo, précise.
4. Éventuellement une petite réserve honnête.
5. Une ligne `Sources : …` avec les noms des médias ou organismes.
6. 0 ou 1 émoji, 2 ou 3 hashtags en minuscules, à la fin.

**Les formules à bannir** : « Découvrez », « Plongeons dans… », « Dans cette vidéo », « N'hésitez pas à… », « Qu'en pensez-vous ? », les rangées d'émojis, les phrases en trois parties parfaitement symétriques, la morale de fin.

Modèle : [`videos/_modele/legende.txt`](../videos/_modele/legende.txt).

## Transparence

Les plateformes ont des règles sur les contenus produits avec des outils automatiques ou de synthèse (voix, images). Lis celles de chaque réseau où tu publies et utilise leurs étiquettes quand elles s'appliquent.
