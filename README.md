# field. · site capsule

Site de démonstration d'une collection capsule fictive **UNIQLO and teenage engineering**, automne hiver 2027.

> Projet pédagogique fictif, non commandité par UNIQLO. Réalisé dans le cadre du module R5071 Design d'expérience et d'interface, BUT MMI 3, IUT de Blois, 2026-2027.

## L'idée

Les deux marques cachent la même chose : UNIQLO enterre ses caractéristiques techniques dans des accordéons, teenage engineering met ses specs au dos de la boîte. La collection fait l'inverse. Neuf basiques muets à l'extérieur partagent à l'intérieur une doublure imprimée d'une grille de points, et le site est construit pour montrer ce qui ne se voit pas.

Trois pièces spéciales hors gamme prennent le contrepied : chacune est dessinée d'après une machine de teenage engineering dont elle reprend les couleurs, le lettrage et le nom.

## Lancer le site

WebGPU et les vidéos ne fonctionnent pas en `file://`, il faut un serveur local.

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Puis <http://127.0.0.1:8765/demo-site/> dans Chrome, Brave ou Edge à jour.

Le site appelle `../videos/`, donc `demo-site/` et `videos/` doivent rester côte à côte.

## Ce qu'il y a dedans

| Dossier | Contenu |
|---|---|
| `demo-site/` | Le site : un seul `index.html` (styles, markup et script), `img/`, `modeles/` (les trois vedettes en glTF) et `js/`, les modules compilés |
| `videos/` | Les huit vidéos utilisées par le site |
| `shader/lumiere/` | Les sources TypeScript et WGSL de l'effet du hero et de la trame |
| `shader/vedettes/` | La source du module 3D des vedettes (Three.js) |
| `shader/tissu/` | La source de la simulation de tissu de la section trame |

Le détail section par section est dans [`demo-site/LISEZMOI.md`](demo-site/LISEZMOI.md).

## Parti pris techniques

**Le hero est une vraie simulation d'éclairage.** Les neuf points brodés sont à la fois des sources de lumière et des obstacles, donc la lumière qui suit le curseur projette leurs ombres sur le tissu. C'est la technique des Radiance Cascades, en WebGPU. Repli automatique sur une vidéo si le navigateur ne suit pas.

**Les vidéos sont pilotées au défilement.** Le sweat tourne sur lui-même au rythme du scroll. Pour que le déplacement dans la vidéo soit instantané, les fichiers sont encodés en tout-intra (`-g 1 -keyint_min 1`) et préchargés entièrement en blob, parce qu'un serveur statique simple ne gère pas les requêtes partielles.

**La fiche produit défile en deux temps.** La galerie reste bloquée à gauche pendant que la colonne de droite défile sur près de trois écrans. La première image change selon d'où on vient : portée depuis la collection, à plat depuis le lookbook.

**Deux accents, une règle.** Le bleu `#0071BB` appartient à la doublure et aux données, l'orange `#FF5000` appartient à l'action. Les deux valeurs sont relevées sur le CSS de teenage engineering.

**Les pièces vedettes existent en 3D.** Au-dessus de leurs cartes, les trois modèles floutés sont éclairés par une lampe qui suit le curseur. Dans la fiche, on les fait tourner à la main. Le module et les modèles ne sont téléchargés qu'à l'approche de la section, et jamais sur téléphone.

**La trame se touche.** Les deux pans d'un sweat ouvert encadrent la doublure. Ce sont de vraies plaques de tissu épais simulées en Verlet, qui ne s'étirent pas et ne se traversent pas : on en attrape un, il se plie, montre son envers et retombe. Rendu en WebGL2 sans bibliothèque, 4 Ko compressé, et le calcul s'arrête dès que le tissu est immobile.

**La veste FW-13 se lit comme une façade.** Une section sombre relie six repères à leur point sur la veste, avec un réticule qui donne la position en millimètres sous le curseur.

**Pas de framework.** HTML, CSS et JavaScript natifs, un seul fichier pour le site. Three.js seulement pour les modèles 3D, réduit à ce qui sert.

## Les images

Les photos de vêtements et les mannequins sont générés par IA et dirigés pièce par pièce à partir des photos produit de la collection. Il n'y a ni atelier ni séance photo derrière ce projet fictif.

Les logos et les visuels de produits teenage engineering appartiennent à leurs propriétaires et sont utilisés ici dans un cadre scolaire, avec la mention de leur source dans le site.

## Auteur

Jean Fontaine, BUT MMI, IUT de Blois.
