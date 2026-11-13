// Redonne de la matière aux modèles Meshy, directement dans leurs textures.
// --taches : un pixel très différent d'un voisinage homogène est une tache ; il prend la couleur de ce voisinage.
//            Le rouge des broderies est épargné, pour ne pas effacer le lettrage.
// --trame sergé|nylon : un grain de tissu ajouté à la carte de normales, et très légèrement à la couleur,
//            pour que la lumière accroche la surface au lieu de glisser dessus.
// node matiere.mjs entree.glb sortie.glb [--taches] [--trame sergé|nylon]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';

const [entree, sortie, ...options] = process.argv.slice(2);
const taches = options.includes('--taches');
const trame = options.includes('--trame') ? options[options.indexOf('--trame') + 1] : null;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(entree);
const materiau = doc.getRoot().listMaterials()[0];

const lire = async (texture) => {
  const { data, info } = await sharp(texture.getImage()).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { px: data, W: info.width, H: info.height };
};
const ecrire = async (texture, { px, W, H }) => {
  texture.setImage(await sharp(px, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 92 }).toBuffer()).setMimeType('image/webp');
};

const couleur = materiau.getBaseColorTexture();
const C = await lire(couleur);

if (taches) {
  const R = 11, SEUIL = 50 * 50;
  const { px, W, H } = C;
  const source = Uint8Array.from(px);
  let corriges = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 3;
    const r = source[i], g = source[i + 1], b = source[i + 2];
    if (r > g * 1.4 && r > b * 1.4) continue;
    // moyenne du voisinage, puis moyenne des seuls voisins proches d'elle : la couleur du panneau, sans la tache
    let s0 = 0, s1 = 0, s2 = 0, n = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      const j = (yy * W + xx) * 3;
      s0 += source[j]; s1 += source[j + 1]; s2 += source[j + 2]; n++;
    }
    const m0 = s0 / n, m1 = s1 / n, m2 = s2 / n;
    let t0 = 0, t1 = 0, t2 = 0, k = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      const j = (yy * W + xx) * 3;
      const e0 = source[j] - m0, e1 = source[j + 1] - m1, e2 = source[j + 2] - m2;
      if (e0 * e0 + e1 * e1 + e2 * e2 < SEUIL * 1.6) { t0 += source[j]; t1 += source[j + 1]; t2 += source[j + 2]; k++; }
    }
    // très homogène seulement : dans la texture, un morceau voisin n'est pas forcément voisin sur le vêtement
    if (k < n * .85) continue;
    t0 /= k; t1 /= k; t2 /= k;
    const d0 = r - t0, d1 = g - t1, d2 = b - t2;
    if (d0 * d0 + d1 * d1 + d2 * d2 < SEUIL) continue;
    // une tache est entourée de près par la couleur du panneau ; sinon c'est le bord d'un autre morceau
    let proches = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = Math.min(W - 1, Math.max(0, x + dx)), yy = Math.min(H - 1, Math.max(0, y + dy));
      const j = (yy * W + xx) * 3;
      const e0 = source[j] - t0, e1 = source[j + 1] - t1, e2 = source[j + 2] - t2;
      if (e0 * e0 + e1 * e1 + e2 * e2 < SEUIL) proches++;
    }
    if (proches < 49 * .35) continue;
    px[i] = t0; px[i + 1] = t1; px[i + 2] = t2;
    corriges++;
  }
  console.log('taches', corriges, 'pixels');
}

if (trame) {
  // relief h(x, y) en pixels de texture, et sa pente pour la normale
  const relief = trame === 'sergé'
    // côtes diagonales serrées, comme une toile de coton sergée
    ? (x, y) => Math.sin((x + y) * Math.PI * 2 / 7)
    // armure toile très fine, et la grille du ripstop tous les 28 pixels
    : (x, y) => .5 * Math.sin(x * Math.PI * 2 / 3) * Math.sin(y * Math.PI * 2 / 3)
      + 1.2 * Math.exp(-(((x % 28) - 1) ** 2) / 1.5) + 1.2 * Math.exp(-(((y % 28) - 1) ** 2) / 1.5);
  const force = trame === 'sergé' ? .16 : .12;
  const normales = materiau.getNormalTexture();
  const N = await lire(normales);
  const echelle = N.W / C.W;
  for (let y = 0; y < N.H; y++) for (let x = 0; x < N.W; x++) {
    const i = (y * N.W + x) * 3;
    const u = x / echelle, v = y / echelle;
    const gx = relief(u + .5, v) - relief(u - .5, v), gy = relief(u, v + .5) - relief(u, v - .5);
    let nx = N.px[i] / 127.5 - 1 - gx * force, ny = N.px[i + 1] / 127.5 - 1 + gy * force, nz = N.px[i + 2] / 127.5 - 1;
    const l = Math.hypot(nx, ny, nz);
    N.px[i] = (nx / l + 1) * 127.5; N.px[i + 1] = (ny / l + 1) * 127.5; N.px[i + 2] = (nz / l + 1) * 127.5;
  }
  await ecrire(normales, N);
  // le même grain, à peine, dans la couleur : il reste lisible quand la lumière est de face
  for (let y = 0; y < C.H; y++) for (let x = 0; x < C.W; x++) {
    const i = (y * C.W + x) * 3, k = 1 + relief(x, y) * .025;
    for (let c = 0; c < 3; c++) C.px[i + c] = Math.min(255, C.px[i + c] * k);
  }
}

if (taches || trame) await ecrire(couleur, C);
await io.write(sortie, doc);
