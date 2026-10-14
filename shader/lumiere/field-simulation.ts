import { effect, frame, sampler, storage, target, type Effect, type Gpu, type StorageBuffer, type Surface, type Target } from "vgpu";

import { fieldDots, fieldIrradiance, jfaInit, jfaPass, present, radianceCascade, sdfFinalize } from "./shaders.gen";

type Sortie = Surface | Target;
type Vec2 = readonly [number, number];
type Rect = readonly [number, number, number, number];

const HDR: GPUTextureFormat = "rgba16float";
// Les graines stockent des coordonnées absolues, qui demandent la précision f32.
const GRAINES: GPUTextureFormat = "rgba32float";
const INTERVALLE0 = 2;
// Albédo du vêtement et lumière ambiante qu'il garde hors du faisceau.
const ALBEDO_VETEMENT = 0.55;
const AMBIANCE_VETEMENT = 0.22;

export function tailleReduite(largeur: number, hauteur: number, echelle: number, bordMax: number): Vec2 {
  const s = Math.min(echelle, bordMax / Math.max(largeur, hauteur, 1));
  return [Math.max(1, Math.round(largeur * s)), Math.max(1, Math.round(hauteur * s))];
}

export function creerScene(gpu: Gpu, demande: Vec2, base = 2) {
  const largeur = Math.max(1, Math.floor(demande[0]));
  const hauteur = Math.max(1, Math.floor(demande[1]));
  const size: Vec2 = [largeur, hauteur];
  const cascades = Math.min(6, Math.max(5, Math.ceil(Math.log(1 + (3 * Math.hypot(largeur, hauteur)) / INTERVALLE0) / Math.log(4))));
  const grossiere = 2 ** (cascades - 1);
  const atlas: Vec2 = [Math.ceil(largeur / grossiere) * grossiere * base, Math.ceil(hauteur / grossiere) * grossiere * base];
  const nbSauts = Math.ceil(Math.log2(Math.max(largeur, hauteur, 2)));
  const sauts = [...Array.from({ length: nbSauts }, (_, i) => Math.max(1, 2 ** (nbSauts - i - 1))), 1, 1];

  return {
    gpu,
    size,
    base,
    cascades,
    sauts,
    emetteur: target(gpu, { size, format: HDR }),
    jfa: [target(gpu, { size, format: GRAINES }), target(gpu, { size, format: GRAINES })] as [Target, Target],
    sdf: target(gpu, { size, format: HDR }),
    // lumière du niveau 0, résolue une fois par pixel de scène
    irradiance: target(gpu, { size, format: HDR }),
    atlasRC: [target(gpu, { size: atlas, format: HDR }), target(gpu, { size: atlas, format: HDR })] as [Target, Target],
    // tant qu'aucune photo n'est chargée, le shader lit ce texel vide
    photoVide: storage(gpu, 4, "read"),
    effets: {
      points: effect(gpu, fieldDots),
      jfaInit: effect(gpu, jfaInit),
      // Les uniformes partent immédiatement : chaque passe encodée a besoin de son propre effet.
      jfaEtapes: sauts.map(() => effect(gpu, jfaPass)),
      distance: effect(gpu, sdfFinalize),
      cascade: Array.from({ length: cascades }, () => effect(gpu, radianceCascade)),
      irradiance: effect(gpu, fieldIrradiance),
      rendu: effect(gpu, present),
    },
    echantillon: sampler(gpu, {
      minFilter: "linear",
      magFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
    }),
  };
}

export type Scene = ReturnType<typeof creerScene>;

export async function preparer(scene: Scene, format: GPUTextureFormat): Promise<void> {
  await Promise.all([
    scene.effets.points.compile({ colors: [HDR] }),
    scene.effets.jfaInit.compile({ colors: [GRAINES] }),
    ...scene.effets.jfaEtapes.map((e) => e.compile({ colors: [GRAINES] })),
    scene.effets.distance.compile({ colors: [HDR] }),
    ...scene.effets.cascade.map((e) => e.compile({ colors: [HDR] })),
    scene.effets.irradiance.compile({ colors: [HDR] }),
    scene.effets.rendu.compile({ colors: [format] }),
  ]);
}

export function detruire(scene: Scene): void {
  for (const t of [scene.emetteur, ...scene.jfa, scene.sdf, scene.irradiance, ...scene.atlasRC]) {
    (t as Target & { destroy?: () => void }).destroy?.();
  }
}

export interface Motif {
  temps: number;
  centre: Vec2;
  curseur: Vec2;
  ecart: number;
  rayon: number;
  rayonCurseur: number;
  puissanceCurseur: number;
  /** Part du rayon sur laquelle le bord des points s'estompe à l'affichage ; 0 ou absent : bord net. */
  douceur?: number;
}

/** Photo d'un vêtement, en RGBA 8 bits, prête à être lue par le shader. */
export interface Photo {
  buffer: StorageBuffer;
  taille: Vec2;
  /** Couleur du fond de la photo, en sRGB de 0 à 1. */
  fond: readonly [number, number, number];
}

export interface PhotoPlacee {
  photo: Photo;
  rect: Rect;
  /** De 0 à 1 : le vêtement apparaît en fondu une fois la photo chargée. */
  apparition: number;
}

export interface Mise {
  centre: Vec2;
  ecart: number;
  rayon: number;
  rect: Rect;
  /** xy : centre de l'orbite de la lumière, zw : ses rayons. */
  orbite: Rect;
}

// Grand écran : le vêtement au centre droit, les neuf points à sa droite.
// Petit écran : le vêtement à gauche et les points à droite, dans le tiers haut, au-dessus du titre.
export function miseEnScene(size: Vec2, etroit: boolean, avecPhoto: boolean): Mise {
  const [l, h] = size;
  const m = Math.min(l, h);
  // Sans vêtement : le motif seul, à droite sur grand écran, dans le tiers haut sur petit écran.
  if (!avecPhoto) {
    const centre: Vec2 = etroit ? [l * 0.5, h * 0.3] : [l * 0.68, h * 0.5];
    return { centre, ecart: m * 0.13, rayon: m * 0.034, rect: [0, 0, 1, 1], orbite: [centre[0], centre[1], m * 0.34, m * 0.22] };
  }
  if (etroit) {
    const cote = Math.min(l * 0.62, h * 0.4);
    const cx = l * 0.36;
    const cy = h * 0.3;
    return { centre: [l * 0.82, cy], ecart: m * 0.08, rayon: m * 0.022, rect: [cx - cote / 2, cy - cote / 2, cote, cote], orbite: [cx, cy, cote * 0.45, cote * 0.35] };
  }
  const cote = Math.min(h * 0.92, l * 0.5);
  const cx = l * 0.57;
  const cy = h * 0.52;
  return { centre: [l * 0.88, h * 0.5], ecart: m * 0.1, rayon: m * 0.026, rect: [cx - cote / 2, cy - cote / 2, cote, cote], orbite: [cx, cy, cote * 0.42, cote * 0.3] };
}

// Couleur du fond de la photo : moyenne d'une bande de pixels le long des quatre bords.
export function couleurFond(data: Uint8Array | Uint8ClampedArray, largeur: number, hauteur: number): [number, number, number] {
  const bande = Math.max(4, Math.round(Math.min(largeur, hauteur) * 0.012));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let y = 0; y < hauteur; y += 2) {
    for (let x = 0; x < largeur; x += 2) {
      if (x >= bande && x < largeur - bande && y >= bande && y < hauteur - bande) continue;
      const i = (y * largeur + x) * 4;
      r += data[i]!;
      g += data[i + 1]!;
      b += data[i + 2]!;
      n++;
    }
  }
  return [r / n / 255, g / n / 255, b / n / 255];
}

export function eclairer(scene: Scene, m: Motif): void {
  const { size, effets } = scene;
  const passes: { target: Target; effect: Effect }[] = [];

  effets.points.set({
    field: {
      size: [size[0], size[1]],
      center: [m.centre[0], m.centre[1]],
      pointer: [m.curseur[0], m.curseur[1]],
      time: m.temps,
      spacing: m.ecart,
      radius: m.rayon,
      pointer_radius: m.rayonCurseur,
      pointer_power: m.puissanceCurseur,
    },
  });
  passes.push({ target: scene.emetteur, effect: effets.points });

  effets.jfaInit.set({ emitter: scene.emetteur });
  passes.push({ target: scene.jfa[0], effect: effets.jfaInit });
  let lecture = scene.jfa[0];
  let ecriture = scene.jfa[1];
  scene.sauts.forEach((saut, i) => {
    const e = effets.jfaEtapes[i]!;
    e.set({ jfa: { jump: [saut, 0, 0, 0] }, seeds: lecture });
    passes.push({ target: ecriture, effect: e });
    [lecture, ecriture] = [ecriture, lecture];
  });
  scene.jfa = [lecture, ecriture];

  effets.distance.set({ seeds: lecture });
  passes.push({ target: scene.sdf, effect: effets.distance });

  let aEcrire = scene.atlasRC[0];
  let aLire = scene.atlasRC[1];
  for (let c = scene.cascades - 1; c >= 0; c--) {
    const e = effets.cascade[c]!;
    e.set({
      rc: { state: [c, c < scene.cascades - 1 ? 1 : 0, scene.base, 0] },
      sdf_tex: scene.sdf,
      sdf_samp: scene.echantillon,
      emitter_tex: scene.emetteur,
      emitter_samp: scene.echantillon,
      upper_tex: aLire,
    });
    passes.push({ target: aEcrire, effect: e });
    [aLire, aEcrire] = [aEcrire, aLire];
  }
  scene.atlasRC = [aLire, aEcrire];

  // la lumière du niveau 0 est résolue ici une fois par pixel de scène, pas à chaque pixel d'écran
  effets.irradiance.set({ irradiance: { state: [0, 0, scene.base, 0], size: [size[0], size[1], 0, 0] }, cascade_tex: aLire });
  passes.push({ target: scene.irradiance, effect: effets.irradiance });

  frame(scene.gpu, (f) => {
    for (const p of passes) f.pass({ target: p.target, clear: [0, 0, 0, 0] }, (enc) => enc.draw(p.effect));
  });
}

// Les points sont redessinés ici à la résolution de la sortie : ils restent nets quelle que soit la taille de la scène.
export function afficher(scene: Scene, sortie: Sortie, m: Motif, placee?: PhotoPlacee, exposition = 0.92): void {
  const photo = placee?.photo;
  scene.effets.rendu.set({
    present: {
      display: [exposition, m.douceur ?? 0, 48, scene.base],
      lighting: [0.12, 0.006, AMBIANCE_VETEMENT, 0],
      scene: [scene.size[0], scene.size[1], m.temps, 0],
      shape: [m.centre[0], m.centre[1], m.ecart, m.rayon],
      pointer: [m.curseur[0], m.curseur[1], m.rayonCurseur, m.puissanceCurseur],
      photo_rect: placee ? [placee.rect[0], placee.rect[1], placee.rect[2], placee.rect[3]] : [0, 0, 1, 1],
      photo_info: photo ? [photo.taille[0], photo.taille[1], ALBEDO_VETEMENT, placee.apparition] : [1, 1, 0, 0],
      photo_fond: photo ? [photo.fond[0], photo.fond[1], photo.fond[2], 0] : [0, 0, 0, 0],
    },
    irradiance_tex: scene.irradiance,
    irradiance_samp: scene.echantillon,
    photo: photo?.buffer ?? scene.photoVide,
  });
  frame(scene.gpu, (f) => {
    f.pass({ target: sortie, clear: [0, 0, 0, 1] }, (enc) => enc.draw(scene.effets.rendu));
  });
}
