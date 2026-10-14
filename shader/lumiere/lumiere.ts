import { init, storage, surface, type Gpu, type Surface } from "vgpu";

import { afficher, couleurFond, creerScene, detruire, eclairer, miseEnScene, preparer, tailleReduite, type Motif, type Photo, type Scene } from "./field-simulation";

export { monterTrame } from "./trame";

/** Position imposée au motif, en fractions du canvas ; l'écart et le rayon sont rapportés à sa hauteur. */
export interface Ancre {
  x: number;
  y: number;
  ecart: number;
  rayon: number;
  /** Bord des points estompé, en part du rayon (0 ou absent : net). */
  douceur?: number;
}

export interface OptionsLumiere {
  /** Photo du vêtement posée dans la scène et éclairée par le motif. */
  photo?: string;
  /** Aligne le motif sur un élément de la page, par exemple les points brodés d'une vidéo. */
  ancre?: () => Ancre | null;
  /** Tant qu'elle renvoie vrai, rien n'est calculé : l'effet est caché, par une vidéo par exemple. */
  enPause?: () => boolean;
}

// La lumière est douce par nature : on la calcule sur une scène réduite.
// Les points, eux, sont dessinés à la résolution de l'écran, jusqu'à 1,5 fois sa densité :
// au-delà, la différence ne se voit plus mais le coût double.
const BORD_SCENE = 768;
const BORD_SORTIE = 2400;
const DENSITE_MAX = 1.5;

// Décode l'image et range ses pixels dans un buffer que le shader lit directement.
async function chargerPhoto(gpu: Gpu, adresse: string): Promise<Photo> {
  const image = new Image();
  image.src = adresse;
  await image.decode();
  const largeur = image.naturalWidth;
  const hauteur = image.naturalHeight;
  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const contexte = toile.getContext("2d", { willReadFrequently: true });
  if (!contexte) throw new Error("canvas-2d-absent");
  contexte.drawImage(image, 0, 0);
  const pixels = contexte.getImageData(0, 0, largeur, hauteur).data;
  const tampon = storage(gpu, pixels.byteLength, "read");
  tampon.write(pixels);
  return { buffer: tampon, taille: [largeur, hauteur], fond: couleurFond(pixels, largeur, hauteur) };
}

export async function monterLumiere(canvas: HTMLCanvasElement, options: OptionsLumiere = {}) {
  if (!("gpu" in navigator)) throw new Error("webgpu-absent");

  const gpu = await init();
  const sortie: Surface = surface(gpu, canvas, { autoResize: false, dpr: 1 });
  const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let scene: Scene | undefined;
  let prete = false;
  let generation = 0;
  let visible = true;
  let arret = false;
  let image = 0;
  let precedent = 0;
  let dernierCalcul = -Infinity;
  // En mouvement réduit, l'onde reste figée au moment où le motif est allumé.
  let temps = reduit ? 1.1 : 0;
  let photo: Photo | undefined;
  let apparition = 0;
  const cible = { x: 0.5, y: 0.5, actif: false };
  const curseur = { x: 0, y: 0, place: false };

  if (options.photo) {
    void chargerPhoto(gpu, options.photo)
      .then((p) => {
        if (!arret) photo = p;
      })
      .catch(() => {});
  }

  const reconstruire = () => {
    const taille = tailleReduite(sortie.size[0], sortie.size[1], 1, BORD_SCENE);
    if (scene && scene.size[0] === taille[0] && scene.size[1] === taille[1]) return;
    const suivante = creerScene(gpu, taille, 2);
    const ancienne = scene;
    scene = suivante;
    prete = false;
    curseur.place = false;
    const g = ++generation;
    if (ancienne) detruire(ancienne);
    void preparer(suivante, sortie.format).then(() => {
      if (g === generation) prete = true;
    });
  };

  const mesurer = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    const dpr = Math.min(devicePixelRatio || 1, DENSITE_MAX);
    sortie.resize(tailleReduite(width * dpr, height * dpr, 1, BORD_SORTIE));
    reconstruire();
  };

  const tick = (t: number) => {
    image = 0;
    if (arret) return;
    if (visible && !document.hidden && prete && scene && !options.enPause?.()) {
      const dt = precedent ? Math.min((t - precedent) / 1000, 0.1) : 0;
      if (!reduit) temps += dt;
      const s = scene.size;
      const m = Math.min(s[0], s[1]);
      const ancre = options.ancre?.();
      const mise = miseEnScene(s, innerWidth < 900, !!options.photo);
      if (ancre) {
        // le motif se pose sur l'ancre, et la lumière tourne autour de lui
        const ecart = ancre.ecart * s[1];
        mise.centre = [ancre.x * s[0], ancre.y * s[1]];
        mise.ecart = ecart;
        mise.rayon = ancre.rayon * s[1];
        mise.orbite = [mise.centre[0], mise.centre[1], ecart * 2.6, ecart * 1.7];
      }
      // Sans pointeur, la lumière tourne seule autour du vêtement.
      const angle = temps * ((Math.PI * 2) / 5);
      const [ox, oy, rx, ry] = mise.orbite;
      const orbite = [ox + Math.cos(angle) * rx, oy + Math.sin(angle) * ry];
      const but = cible.actif ? [cible.x * s[0], cible.y * s[1]] : orbite;
      if (!curseur.place) {
        curseur.x = but[0]!;
        curseur.y = but[1]!;
        curseur.place = true;
      }
      const lissage = cible.actif ? 0.2 : 0.08;
      curseur.x += (but[0]! - curseur.x) * lissage;
      curseur.y += (but[1]! - curseur.y) * lissage;
      if (photo) apparition = reduit ? 1 : Math.min(1, apparition + dt * 1.2);
      const motif: Motif = {
        temps,
        centre: mise.centre,
        curseur: [curseur.x, curseur.y],
        ecart: mise.ecart,
        rayon: mise.rayon,
        rayonCurseur: m * 0.022,
        puissanceCurseur: 11,
        douceur: ancre?.douceur ?? 0,
      };
      if (t - dernierCalcul >= 1000 / 30) {
        eclairer(scene, motif);
        dernierCalcul = t;
      }
      afficher(scene, sortie, motif, photo ? { photo, rect: mise.rect, apparition } : undefined);
    }
    precedent = t;
    image = requestAnimationFrame(tick);
  };

  const zone = canvas.parentElement ?? canvas;
  const suivre = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    cible.x = (e.clientX - r.left) / r.width;
    cible.y = (e.clientY - r.top) / r.height;
    cible.actif = true;
  };
  const lacher = () => {
    cible.actif = false;
  };
  zone.addEventListener("pointermove", suivre);
  zone.addEventListener("pointerleave", lacher);

  const obsTaille = new ResizeObserver(mesurer);
  obsTaille.observe(canvas);
  const obsVue = new IntersectionObserver(([e]) => {
    visible = !!e && e.isIntersecting;
  });
  obsVue.observe(canvas);

  mesurer();
  image = requestAnimationFrame(tick);

  return {
    detruire() {
      arret = true;
      if (image) cancelAnimationFrame(image);
      zone.removeEventListener("pointermove", suivre);
      zone.removeEventListener("pointerleave", lacher);
      obsTaille.disconnect();
      obsVue.disconnect();
      if (scene) detruire(scene);
      gpu.dispose();
    },
  };
}
