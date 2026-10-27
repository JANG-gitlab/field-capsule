// Les trois pièces vedettes en 3D. Dans la section « en vedette », floutées au-dessus de leurs cartes,
// éclairées par une lampe qui suit le curseur ; dans la fiche, elles tournent seules et on les fait pivoter à la main.
import {
  WebGLRenderer, Scene, PerspectiveCamera, HemisphereLight, DirectionalLight, PointLight, PMREMGenerator,
  Group, Box3, Vector3, SRGBColorSpace, NeutralToneMapping, MathUtils,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// dans la fiche, la pièce démarre de trois quarts : de face, on la prendrait pour une photo
const REPOS = -0.35;

// la lampe du bandeau : sa puissance, sa distance devant les pièces, et le peu de lumière ambiante autour
// le cadrage est serré sur la poitrine : on voit de la matière qui prend la lumière, pas une deuxième photo de la pièce
const LAMPE = { force: 8, recul: 2.2, ambiance: .1, ciel: .38, cadrage: 1.7 };

const chargeur = new GLTFLoader();
const modeles = new Map();
// un seul téléchargement par fichier, que la pièce soit vue dans le fond puis dans sa fiche
const charger = (url) => {
  if (!modeles.has(url)) modeles.set(url, chargeur.loadAsync(url).then(g => g.scene));
  return modeles.get(url).then(s => s.clone(true));
};

// centre la pièce une fois pour toutes et renvoie sa taille, mesurée de face
const centrer = (objet) => {
  const boite = new Box3().setFromObject(objet);
  objet.position.sub(boite.getCenter(new Vector3()));
  return boite.getSize(new Vector3());
};

// éclairage de photo produit : une lumière principale, un contre-jour qui décolle la silhouette du fond,
// une débouche légère, et juste assez d'environnement pour le modelé sans délaver les couleurs
const preparer = (canvas, marge) => {
  const rendu = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
  rendu.outputColorSpace = SRGBColorSpace;
  rendu.toneMapping = NeutralToneMapping;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();
  scene.environmentIntensity = .3;
  scene.add(new HemisphereLight(0xffffff, 0x6f6f6f, 1.1));
  for (const [couleur, force, x, y, z] of [[0xfff6ec, 2.4, -3, 4, 3], [0xffffff, 2.2, 3, 2, -4], [0xffffff, .5, 3, -1, 3]]) {
    const lumiere = new DirectionalLight(couleur, force);
    lumiere.position.set(x, y, z);
    scene.add(lumiere);
  }
  const anisotropie = rendu.capabilities.getMaxAnisotropy();
  const camera = new PerspectiveCamera(26, 1, .01, 50);
  const pivot = new Group();
  scene.add(pivot);
  let taille = new Vector3(1, 1, 1);

  // la caméra recule juste assez pour que la pièce tienne en largeur comme en hauteur
  const ajuster = () => {
    const l = canvas.clientWidth, h = canvas.clientHeight;
    if (!l || !h) return;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    const t = Math.tan(MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, Math.max(taille.y / 2 / t, taille.x / 2 / (t * camera.aspect)) * marge);
    camera.updateProjectionMatrix();
  };

  const montrer = (objet, mesure) => {
    pivot.clear();
    // un filtrage plus fin aux angles rasants : la texture reste nette quand la pièce est de biais
    objet.traverse(o => {
      if (!o.isMesh) return;
      for (const carte of ['map', 'normalMap']) if (o.material[carte]) o.material[carte].anisotropy = anisotropie;
    });
    pivot.add(objet);
    taille = mesure;
    ajuster();
  };

  return { rendu, scene, camera, pivot, ajuster, montrer };
};

// le bandeau de la section « en vedette » : les trois pièces, immobiles, chacune au-dessus de sa carte.
// Seule la lampe bouge : elle suit le curseur et fait apparaître les plis et le rembourrage au passage.
export const monterTrio = async ({ zone, canvas, urls, cartes }) => {
  const rendu = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  rendu.setPixelRatio(Math.min(devicePixelRatio, 2));
  rendu.outputColorSpace = SRGBColorSpace;
  rendu.toneMapping = NeutralToneMapping;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(rendu);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  pmrem.dispose();
  // très peu de lumière d'ambiance : sans ombre autour d'elle, on ne verrait pas la lampe se déplacer
  scene.environmentIntensity = LAMPE.ambiance;
  scene.add(new HemisphereLight(0xffffff, 0x8a8a8a, LAMPE.ciel));
  const lampe = new PointLight(0xfff2e4, LAMPE.force, 0, 2);
  scene.add(lampe);
  const camera = new PerspectiveCamera(24, 1, .1, 60);
  camera.position.set(0, 0, 9);

  // chaque pièce légèrement tournée vers le centre, pour que les trois se regardent
  const angles = [.38, 0, -.38];
  const pieces = await Promise.all(urls.map(async (url, i) => {
    const objet = await charger(url);
    const taille = centrer(objet);
    const groupe = new Group();
    groupe.add(objet);
    groupe.rotation.y = angles[i] ?? 0;
    scene.add(groupe);
    return { groupe, taille };
  }));

  let demi = { l: 1, h: 1 }, visee = { x: 0, y: 0 }, lisse = { x: 0, y: 0 }, image = 0;

  // les pièces s'alignent sur le centre de leur carte, quelle que soit la largeur de l'écran
  const placer = () => {
    const l = canvas.clientWidth, h = canvas.clientHeight;
    if (!l || !h) return;
    rendu.setSize(l, h, false);
    camera.aspect = l / h;
    camera.updateProjectionMatrix();
    const dh = Math.tan(MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    demi = { l: dh * camera.aspect, h: dh };
    const zoneCanvas = canvas.getBoundingClientRect();
    pieces.forEach(({ groupe, taille }, i) => {
      const r = cartes[i].getBoundingClientRect();
      const nx = (r.left + r.width / 2 - zoneCanvas.left) / zoneCanvas.width * 2 - 1;
      // sans déborder sur la colonne voisine
      const colonne = r.width / zoneCanvas.width * demi.l * 2;
      groupe.scale.setScalar(Math.min(dh * 2 * LAMPE.cadrage / taille.y, colonne * 1.05 / taille.x));
      groupe.position.set(nx * demi.l, -dh * .55, 0);
    });
  };

  const peindre = () => {
    image = 0;
    const r = zone.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    lisse.x += (visee.x - lisse.x) * .1;
    lisse.y += (visee.y - lisse.y) * .1;
    lampe.position.set(lisse.x * demi.l, lisse.y * demi.h, LAMPE.recul);
    // les pièces se tournent à peine vers le curseur, pour qu'on sente le volume sans perdre le cadrage
    pieces.forEach(({ groupe }, i) => {
      groupe.rotation.y = angles[i] + lisse.x * .14;
      groupe.rotation.x = -lisse.y * .05;
    });
    rendu.render(scene, camera);
    if (Math.abs(visee.x - lisse.x) > .0005 || Math.abs(visee.y - lisse.y) > .0005) image = requestAnimationFrame(peindre);
  };
  const relancer = () => { if (!image) image = requestAnimationFrame(peindre); };

  // la lampe part au-dessus de la dernière pièce, puis suit le curseur, rapporté au bandeau
  const viser = (x, y) => {
    const r = canvas.getBoundingClientRect();
    visee = {
      x: MathUtils.clamp((x - r.left) / r.width * 2 - 1, -1, 1),
      y: MathUtils.clamp(-((y - r.top) / r.height * 2 - 1), -.45, 1),
    };
    relancer();
  };
  placer();
  const derniere = cartes[cartes.length - 1].getBoundingClientRect();
  viser(derniere.left + derniere.width / 2, canvas.getBoundingClientRect().top + canvas.clientHeight * .35);
  lisse = { ...visee };

  addEventListener('pointermove', (e) => viser(e.clientX, e.clientY), { passive: true });
  addEventListener('scroll', relancer, { passive: true });
  new ResizeObserver(() => { placer(); relancer(); }).observe(canvas);
  canvas.classList.add('pret');
  relancer();
};

// renvoie la fonction qui arrête la vue et libère le contexte WebGL
export const monterVue = async (conteneur, url, reduit) => {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Modèle 3D de la pièce, faites glisser pour la faire tourner');
  conteneur.appendChild(canvas);
  const v = preparer(canvas, 1.12);
  const objet = await charger(url);
  v.montrer(objet, centrer(objet));

  // elle tourne seule, doucement ; un glisser lui donne de l'élan, qui retombe vers la rotation de veille
  const VEILLE = reduit ? 0 : .0035;
  let angle = REPOS, vitesse = VEILLE, glisse = false, dernierX = 0, image = 0, actif = true;

  const peindre = () => {
    image = 0;
    if (!actif) return;
    if (!glisse) vitesse += (VEILLE - vitesse) * .04;
    angle += vitesse;
    v.pivot.rotation.y = angle;
    v.rendu.render(v.scene, v.camera);
    if (glisse || Math.abs(vitesse) > 1e-4) image = requestAnimationFrame(peindre);
  };
  const relancer = () => { if (!image && actif) image = requestAnimationFrame(peindre); };

  canvas.addEventListener('pointerdown', (e) => {
    glisse = true;
    dernierX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    relancer();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!glisse) return;
    vitesse = (e.clientX - dernierX) * .012;
    dernierX = e.clientX;
    relancer();
  });
  const lacher = () => { glisse = false; relancer(); };
  canvas.addEventListener('pointerup', lacher);
  canvas.addEventListener('pointercancel', lacher);

  const suivi = new ResizeObserver(() => { v.ajuster(); relancer(); });
  suivi.observe(canvas);
  relancer();

  return () => {
    actif = false;
    cancelAnimationFrame(image);
    suivi.disconnect();
    v.rendu.dispose();
    v.rendu.forceContextLoss();
  };
};
