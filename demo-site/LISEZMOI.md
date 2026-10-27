# Démo du site capsule field.

## Lancer

La page va chercher les vidéos dans `../videos`, il faut donc la servir depuis la racine du dépôt :

```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

Puis ouvrir http://127.0.0.1:8765/demo-site/ dans Chrome, Edge, Arc ou Safari récent.

## Ce qu'il y a dans la page

| Section | Contenu | Vidéo ou effet |
|---|---|---|
| Hero | Le motif des neuf points éclairé en temps réel, la lumière suit le curseur. Si `videos/ouverture-hero.mp4` existe, elle se joue d'abord et l'effet s'allume sur les points brodés de sa dernière image | Effet WebGPU `js/lumiere.js`, secours `videos/lumiere.mp4`, intro facultative (voir `PROMPTS-VIDEO-HERO.md`) |
| L'intérieur | Le sweat porté « fantôme », calé à gauche, légèrement flou, qui tourne au rythme du défilement (un tour sur toute la scène), qui s'efface vers la droite jusqu'au texte (vers le bas sur écran vertical) ; texte qui apparaît ligne à ligne | `sweat-fantome-flou.mp4`, cadré et flouté à l'avance |
| La doublure | Même scène que « L'intérieur » : le sweat reste épinglé à gauche, le récit arrive à droite sans changer de fond. Trois étapes au défilement, titres mot à mot, grand numéro d'étape | la même vidéo |
| Bandeau | La trame de points en direct : les points gonflent sous le curseur et rétrécissent autour du texte pour lui faire de la place. Par-dessus, les deux pans d'un sweat ouvert, en molleton chiné, simulés comme un tissu épais qui ne s'étire pas et ne se traverse pas. Chaque pan est une plaque de 20 px d'épaisseur : jersey gris dessus, doublure dessous, et sur la tranche le molleton gratté écru. Leur bord est retourné en revers, qui montre la doublure à points : pas de bord à finir, donc pas de zip. On attrape un pan (à la souris, ou au doigt en glissant à l'horizontale), il se plie lourdement et montre son envers, puis retombe sans rebondir quand on le lâche. Au repos, chaque pan s'arrête juste avant le texte. À la première apparition, une main invisible ouvre le pan droit pour montrer le geste | Effet WebGPU `monterTrame`, secours `videos/trame-hero.mp4` ; tissu `js/tissu.js` (WebGL2, sans bibliothèque, 4 Ko compressé), source `shader/tissu/` (`npm install && npm run build` pour recompiler) |
| La tirette | Le zip du sweat en gros plan, pleine hauteur, les 9 points gravés | `img/detail-zip.jpg` |
| Collection | En tête, les trois pièces spéciales en vedette (FW-11, FW-12, FW-13), chacune renvoyant à la machine teenage engineering dont elle vient. Dessous, la grille des neuf basiques. Survol, ajout rapide, fiche produit, panier | `chute-tshirt.mp4`, `sweat-fantome.mp4` au survol du sweat, `img/FW-11-07.jpg`, `FW-12-08.jpg`, `FW-13-09/06.jpg` |
| Fiches produit | Défilement double : la galerie reste bloquée à gauche, la colonne de droite défile. Coloris à deux tons (extérieur et doublure), tailles, réassurance (paiement sécurisé, livraison, retrait, retour), récit de la pièce, construction numérotée, matière et entretien, guide des tailles chiffré, « portée dans ». Ouverte depuis la grille de la collection, la fiche commence par une photo portée ; ouverte depuis le lookbook ou un lien direct, elle commence à plat | `sweat-fantome.mp4` |
| Lookbook | Les 13 looks sur une piste qui glisse à l'horizontale pendant qu'on défile ; chaque pièce portée ouvre sa fiche | `img/portees/LOOK-01` à `09`, plus `LOOK-11` à `14` |
| La façade | Section sombre consacrée à la veste FW-13 : la veste détourée au centre, six repères numérotés reliés par des traits à leur point sur la veste (col, blocs de commande et d'identité, épaulette, doublure, poignet). Au survol, la lumière du fond et un réticule suivent le curseur, avec la position en millimètres, et le repère le plus proche s'allume en orange. Deux boutons changent le coloris (09 orange, 06 encre). Sur mobile, les repères passent sous la veste | `img/detoure-FW-13-09.webp`, `FW-13-06.webp` |
| teenage engineering | La marque en bref, quatre produits officiels avec lien (field system, pocket operator, OB–4, EP–133 K.O. II) | `img/marques/te/` |
| Rotation au curseur | Sur ordinateur, le sweat de la scène continue se tourne vers la souris en plus du défilement, jusqu'à un huitième de tour | `sweat-fantome-flou.mp4` |
| En vedette | Les cartes des trois pièces spéciales montrent la pièce détourée sur fond transparent. Au-dessus, un bandeau avec les trois pièces en 3D, cadrées serré sur la poitrine, floutées et immobiles, chacune alignée sur sa carte. Une lampe suit le curseur : la pièce survolée s'allume, les autres retombent dans l'ombre. Les réglages de la lampe (puissance, recul, ambiance, cadrage) sont regroupés dans la constante `LAMPE` de `vedettes.js`. Le bandeau n'apparaît qu'avec les trois cartes côte à côte (écran de 1 100 px et plus). Le module `js/vedettes3d.js` (Three.js réduit à ce qui sert, 154 Ko compressé) et les modèles ne sont téléchargés qu'à l'approche de la section, et seulement avec une souris. Dans la fiche, la vignette « en 3D » fait tourner la pièce, qu'on fait pivoter en glissant | `modeles/FW-11.glb`, `FW-12.glb`, `FW-13.glb`, `img/detoure-*.webp` |
| Labels décodés | Les labels en mono (titres de section, codes FW des cartes) partent en caractères aléatoires et se résolvent lettre par lettre quand ils arrivent à l'écran, une seule fois. Désactivé si le système demande de réduire les animations | aucun |
| La sortie | Inscription au lancement du 09.10 et contact : un champ d'adresse validé côté navigateur, quatre entrées de contact (question, presse, boutiques, retrait). L'adresse n'est envoyée nulle part, c'est une démonstration | aucun |
| Curseur | Le motif 3 × 3 en réduction. Sur un lien, la grille s'ouvre ; sur un bouton, un cadre de visée apparaît ; sur la photo d'une pièce, « voir la pièce ». Blanc sur les sections sombres. Au doigt, le curseur du système reste | aucun |

## L'orange

Second accent, tiré du K.O. II de teenage engineering (#FF5000). La règle : **le bleu appartient à la doublure et aux données, l'orange appartient à l'action**. Donc en orange : le survol des pastilles d'ajout et des pilules, le coloris et la vignette sélectionnés dans une fiche, les numéros des étapes de construction, le point qui apparaît au survol d'un produit teenage engineering, le repère du toast, l'intitulé « en vedette », un point de la bande défilante. Le reste du site ne bouge pas.

## Les coloris

Chaque coloris se lit en deux temps, l'extérieur puis la doublure. Les pastilles du site sont coupées en diagonale dans ce sens.

| Code | Extérieur | Doublure |
|---|---|---|
| 01 | blanc, ou gris chiné sur le molleton | bleu #0071BB |
| 02 | bleu | bleu |
| 03 | encre | bleu |
| 04 | blanc | orange #FF5000 |
| 05 | orange | bleu |
| 06 | encre | orange |
| 07 | orange et gris chiné (FW-11 seulement) | gris chiné |
| 08 | médiéval, vert, rouge, brun, noir (FW-12 seulement) | rouge |

Le sweat FW-03 et le jogging FW-04 n'existent plus en 03 (encre à doublure bleue) : leur seule version sombre est la 06.

## Logos et visuels de marque

| Fichier | Source |
|---|---|
| Logo UNIQLO (SVG dans la page) | en-tête de uniqlo.com/fr |
| `img/marques/uniqlo-32/64/180.png` (favicon) | asset.uniqlo.com/logotypes |
| `img/marques/te-256.png` (pictogramme) | teenage.engineering/android-chrome-256x256.png |
| `img/marques/te/*.webp` | assets.teenage.engineering, pages produits |
| `img/marques/logo-collab.svg` (pied de page) | logo de la collab dessiné par Jean, redessiné en formes construites (marteau et écrou du pictogramme TE dans le carré UNIQLO) |

Les descriptions des produits TE sont traduites de leurs pages officielles. Mention en bas de section : « visuels et descriptions © teenage engineering ».

## Photos portées

Les images portées vivent dans `img/portees/`, nommées `LOOK-01.jpg` et suivantes, et sont déclarées pièce par pièce dans le tableau `PIECES` de `index.html`.

## La grille selon l'écran

| Largeur | Colonnes | Disposition |
|---|---|---|
| moins de 520 px | 2 | chaque pièce en pleine largeur, chaussettes et bonnet côte à côte |
| 520 à 1099 px | 2 | sweat phare en pleine largeur, puis les pièces par deux, jogging en tuile large |
| 1100 à 1599 px | 4 | sweat phare en 2 × 2, jogging en tuile large sur la dernière rangée |
| 1600 px et plus | 6 | tout tient en deux rangées, sweat phare en 2 × 2 |

## Les modèles 3D

Les modèles 3D des vedettes viennent de Meshy, à partir des photos à plat détourées. Ils ont été allégés de 1,5 million à environ 60 000 triangles, leurs coutures de texture comblées et leur matière rendue mate. La source du module est dans `../shader/vedettes/` ; pour le recompiler :

```bash
cd shader/vedettes && npm install && npm run build
```

## L'effet du hero

C'est la technique Radiance Cascades de vgpu : une vraie simulation d'éclairage en 2D. Les neuf points sont à la fois des sources de lumière et des obstacles, donc la lumière du curseur projette leurs ombres. Les sources sont dans `../shader/lumiere/`. Pour modifier puis recompiler :

```bash
cd shader/lumiere && npm install && npm run build
```

La lumière est calculée sur une scène réduite (960 px maximum), mais les points sont redessinés à la résolution réelle de l'écran, Retina compris : c'est ce qui les garde nets.

Les réglages utiles : la forme, la couleur et l'intensité des points dans `arc/field-shape.wgsl`, la force de la lumière du curseur (`puissanceCurseur`) dans `lumiere.ts`, la clarté du sol (`lighting`) dans `field-simulation.ts`, la taille et la couleur de la trame du bandeau dans `trame.ts`.

## Navigateurs

WebGPU fonctionne dans Chrome, Edge et Arc, et dans Safari récent. Ailleurs, la page affiche automatiquement la vidéo de l'effet à la place : rien ne casse. Avec le réglage « réduire les animations » du système, les boucles s'arrêtent sur leur première image.
