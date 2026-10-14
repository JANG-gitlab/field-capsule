import { effect, frame, init, surface } from "vgpu";

// La doublure agrandie : une trame de points qui respire, et qui gonfle sous le curseur.
const SHADER = /* wgsl */ `
struct Trame {
  /** xy : centre de la zone réservée au texte, zw : demi-taille (en uv). */
  zone: vec4f,
  pointeur: vec2f,
  temps: f32,
  ratio: f32,
  pas: f32,
  force: f32,
  fond: vec3f,
  point: vec3f,
};
@group(0) @binding(0) var<uniform> trame: Trame;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var q = vec2f(uv.x * trame.ratio, uv.y);
  let onde = sin(q.x * 2.4 + trame.temps) * cos(q.y * 2.1 - trame.temps);
  q += vec2f(onde * 0.012, onde * 0.009);

  let centre = (floor(q * trame.pas) + 0.5) / trame.pas;
  let local = fract(q * trame.pas) - 0.5;
  let pointeur = vec2f(trame.pointeur.x * trame.ratio, trame.pointeur.y);
  let proche = 1.0 - smoothstep(0.0, 0.3, distance(centre, pointeur));

  // les points rétrécissent puis s'effacent en approchant du texte : la trame lui fait de la place
  let zone_centre = vec2f(trame.zone.x * trame.ratio, trame.zone.y);
  let zone_taille = vec2f(trame.zone.z * trame.ratio, trame.zone.w);
  let ecart = abs(centre - zone_centre) - zone_taille;
  let hors_zone = length(max(ecart, vec2f(0.0))) + min(max(ecart.x, ecart.y), 0.0);
  let place = smoothstep(-0.02, 0.32, hors_zone);

  let rayon = (0.17 + onde * 0.045 + proche * proche * trame.force * 0.17) * place;
  let d = length(local);
  let bord = fwidth(d) * 1.2;
  let point = (1.0 - smoothstep(rayon - bord, rayon + bord, d)) * smoothstep(0.0, 0.03, rayon);
  let vignette = 1.0 - length(uv - vec2f(0.5)) * 0.22;
  return vec4f(mix(trame.fond * vignette, trame.point, point), 1.0);
}`;

const FOND = [0 / 255, 113 / 255, 187 / 255];
const POINT = [244 / 255, 244 / 255, 242 / 255];

export interface OptionsTrame {
  /** Élément autour duquel la trame s'efface (le texte posé dessus). */
  reserve?: HTMLElement;
}

// marge laissée entre le texte et les premiers points, en pixels CSS
const MARGE_TEXTE = 8;

export async function monterTrame(canvas: HTMLCanvasElement, options: OptionsTrame = {}) {
  if (!("gpu" in navigator)) throw new Error("webgpu-absent");

  const gpu = await init();
  const sortie = surface(gpu, canvas, { autoResize: false, dpr: 1 });
  const rendu = effect(gpu, SHADER);
  await rendu.compile({ colors: [sortie.format] });
  const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let visible = false;
  let image = 0;
  let temps = 0;
  let precedent = 0;
  let dernierDessin = -Infinity;
  const cible = { x: 0.5, y: 0.5, force: 0 };
  const pointeur = { x: 0.5, y: 0.5, force: 0 };
  // sans texte à protéger, la zone est vide
  let fenetre = [0.5, 0.5, 0, 0];

  const mesurer = () => {
    const c = canvas.getBoundingClientRect();
    if (c.width <= 0 || c.height <= 0) return;
    // la trame est faite de points ronds et flous sur les bords : 1,5 fois la densité suffit
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    sortie.resize([Math.round(c.width * dpr), Math.round(c.height * dpr)]);
    if (options.reserve) {
      const r = options.reserve.getBoundingClientRect();
      fenetre = [
        (r.left + r.width / 2 - c.left) / c.width,
        (r.top + r.height / 2 - c.top) / c.height,
        (r.width / 2 + MARGE_TEXTE) / c.width,
        (r.height / 2 + MARGE_TEXTE) / c.height,
      ];
    }
  };

  const dessiner = () => {
    const [l, h] = sortie.size;
    rendu.set({
      trame: {
        zone: fenetre,
        pointeur: [pointeur.x, pointeur.y],
        temps,
        ratio: l / h,
        // un point tous les 44 px environ, quelle que soit la hauteur
        pas: Math.max(8, canvas.getBoundingClientRect().height / 44),
        force: pointeur.force,
        fond: FOND,
        point: POINT,
      },
    });
    frame(gpu, (f) => f.pass({ target: sortie, clear: [0, 0, 0, 1] }, (enc) => enc.draw(rendu)));
  };

  const tick = (t: number) => {
    image = 0;
    if (!visible) return;
    const dt = precedent ? Math.min((t - precedent) / 1000, 0.1) : 0;
    precedent = t;
    if (!reduit) temps += dt * 0.9;
    pointeur.x += (cible.x - pointeur.x) * 0.12;
    pointeur.y += (cible.y - pointeur.y) * 0.12;
    pointeur.force += (cible.force - pointeur.force) * 0.08;
    // la trame respire lentement : trente images par seconde suffisent
    if (t - dernierDessin >= 1000 / 30) {
      dessiner();
      dernierDessin = t;
    }
    image = requestAnimationFrame(tick);
  };
  const lancer = () => {
    if (!image) {
      precedent = 0;
      image = requestAnimationFrame(tick);
    }
  };

  const zone = canvas.parentElement ?? canvas;
  zone.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    cible.x = (e.clientX - r.left) / r.width;
    cible.y = (e.clientY - r.top) / r.height;
    cible.force = 1;
  });
  zone.addEventListener("pointerleave", () => {
    cible.force = 0;
  });

  new ResizeObserver(() => {
    mesurer();
    dessiner();
  }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = !!e && e.isIntersecting;
    if (visible) lancer();
  }).observe(canvas);

  // le texte change de taille une fois la police chargée
  void document.fonts?.ready.then(() => {
    mesurer();
    dessiner();
  });

  mesurer();
  dessiner();
}
