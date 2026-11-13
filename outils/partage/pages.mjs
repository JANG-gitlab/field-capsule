// Une page par pièce, à partager : les réseaux et les messageries lisent son aperçu (titre, texte, photo),
// puis elle renvoie aussitôt sur la fiche du site. Les données viennent de PIECES, dans demo-site/index.html.
// node pages.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = 'https://jang-gitlab.github.io/field-capsule/demo-site/';
const racine = new URL('../../demo-site/', import.meta.url);
const html = readFileSync(new URL('index.html', racine), 'utf8');
const debut = html.indexOf('const VETEMENT');
const fin = html.indexOf('const teinte');
const PIECES = new Function(`${html.slice(debut, fin)}; return PIECES;`)();

const echapper = (t) => t.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const euros = (n) => n.toFixed(2).replace('.', ',') + ' €';

for (const [code, p] of Object.entries(PIECES)) {
  const dossier = `produit/${code.toLowerCase()}/`;
  const titre = `${code} · ${p.nom} · ${euros(p.prix)}`;
  const texte = `${p.texte} Projet pédagogique fictif, non commandité par UNIQLO.`;
  const fiche = `../../#${code}`;
  mkdirSync(new URL(dossier, racine), { recursive: true });
  writeFileSync(new URL(`${dossier}index.html`, racine), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)} · field.</title>
<meta name="description" content="${echapper(texte)}">
<link rel="canonical" href="${SITE}${dossier}">
<link rel="icon" type="image/png" sizes="32x32" href="../../img/marques/uniqlo-32.png">
<meta property="og:type" content="product">
<meta property="og:site_name" content="field. · UNIQLO and TEENAGE ENGINEERING">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${echapper(titre)}">
<meta property="og:description" content="${echapper(texte)}">
<meta property="og:url" content="${SITE}${dossier}">
<meta property="og:image" content="${SITE}img/${code}-${p.coloris[0]}.jpg">
<meta property="og:image:width" content="1080">
<meta property="og:image:height" content="1080">
<meta property="og:image:alt" content="${echapper(p.nom)}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${fiche}">
<script>location.replace('${fiche}')</script>
</head>
<body><a href="${fiche}">${echapper(titre)}</a></body>
</html>
`);
}
console.log(Object.keys(PIECES).length, 'pages');
