// Calcule la version vidéo de l'effet : 150 images, 5 secondes, boucle exacte.
// Sert de secours pour les navigateurs sans WebGPU, et d'images pour le cahier.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";
import { init, storage, target } from "vgpu/node";

import { afficher, couleurFond, creerScene, eclairer, miseEnScene, preparer, type Motif, type Photo } from "./field-simulation";

const L = 1920;
const H = 1080;
// IMAGES=3 pour un essai rapide des réglages
const N = Number(process.env.IMAGES ?? 150);
const dossier = process.argv[2] ?? "./images-lumiere";
// photo d'un vêtement à poser dans la scène, facultative
const source = process.argv[3];

const gpu = await init();
const ecran = target(gpu, { size: [L, H], format: "rgba8unorm" });
const taille: [number, number] = [960, 540];
const scene = creerScene(gpu, taille, 2);
await preparer(scene, "rgba8unorm");
mkdirSync(dossier, { recursive: true });

let photo: Photo | undefined;
if (source) {
  const png = PNG.sync.read(readFileSync(source));
  const tampon = storage(gpu, png.data.byteLength, "read");
  tampon.write(png.data);
  photo = { buffer: tampon, taille: [png.width, png.height], fond: couleurFond(png.data, png.width, png.height) };
}

const m = Math.min(...taille);
const mise = miseEnScene(taille, false, !!photo);
const [ox, oy, rx, ry] = mise.orbite;
for (let i = 0; i < N; i++) {
  // la vague dure 2,5 s et l'orbite 5 s : sur 5 s, les deux reviennent au départ
  const temps = (i / 150) * 5;
  const angle = temps * ((Math.PI * 2) / 5);
  const motif: Motif = {
    temps,
    centre: mise.centre,
    curseur: [ox + Math.cos(angle) * rx, oy + Math.sin(angle) * ry],
    ecart: mise.ecart,
    rayon: mise.rayon,
    rayonCurseur: m * 0.022,
    puissanceCurseur: 11,
  };
  eclairer(scene, motif);
  afficher(scene, ecran, motif, photo ? { photo, rect: mise.rect, apparition: 1 } : undefined);
  const pixels = await ecran.read();
  const image = new PNG({ width: L, height: H });
  image.data.set(pixels);
  writeFileSync(`${dossier}/f${String(i).padStart(3, "0")}.png`, PNG.sync.write(image));
}
gpu.dispose();
console.log(`${N} images dans ${dossier}`);
