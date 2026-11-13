// Derrière le récit, les pièces se succèdent comme des relevés au scanner.
// Un trait orange descend sur l'image ; juste derrière lui, la pièce suivante s'imprime en trame :
// d'abord la doublure (fond bleu, points blancs), puis les points grossissent et prennent ses couleurs
// jusqu'à rejoindre la photo. C'est le défilement qui pousse le trait.

// en pixels CSS : le pas de la trame dans la bande
const CELLULE = 11;
// la bande imprimée derrière le trait, en part de la hauteur
const BANDE = 0.32;
// en paysage, la pièce est vue un peu plus loin et son centre tombe à 40 % de la largeur
const RECUL = 1.22;
const DECALAGE = (0.5 - 0.4) * RECUL;

const VERTEX = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D avant;
uniform sampler2D apres;
// object-fit: cover, calculé côté JS : échelle en xy, décalage en zw
uniform vec4 cadreAvant;
uniform vec4 cadreApres;
uniform float balayage;
uniform float cellule;
uniform vec2 taille;
uniform vec2 regard;
uniform float souffle;
out vec4 couleur;

const vec3 BLEU = vec3(0.0, 0.443, 0.733);
const vec3 BLANC = vec3(0.957, 0.957, 0.949);
const vec3 ORANGE = vec3(1.0, 0.314, 0.0);
const float BANDE = ${BANDE.toFixed(3)};

vec3 lire(sampler2D image, vec4 cadre, vec2 uv) {
  uv = (uv - 0.5) * (1.0 - souffle) + 0.5 + regard;
  return texture(image, uv * cadre.xy + cadre.zw).rgb;
}

void main() {
  float trait = mix(-0.01, 1.0 + BANDE, balayage);
  // 0 sur le trait, 1 en haut de la bande ; négatif sous le trait
  float r = (trait - vUv.y) / BANDE;
  vec3 c;
  if (r < 0.0) {
    // la lampe du scanner éclaire l'image juste avant le passage
    c = lire(avant, cadreAvant, vUv) + 0.16 * exp(r * BANDE * 70.0);
  } else if (r >= 1.0) {
    c = lire(apres, cadreApres, vUv);
  } else {
    vec2 px = vUv * taille;
    vec2 centre = (floor(px / cellule) + 0.5) * cellule / taille;
    float d = length(fract(px / cellule) - 0.5);
    vec3 echantillon = lire(apres, cadreApres, centre);
    float rayon = mix(0.17, 0.44, smoothstep(0.08, 0.7, r));
    float point = 1.0 - smoothstep(rayon - 1.0 / cellule, rayon + 1.0 / cellule, d);
    vec3 photo = lire(apres, cadreApres, vUv);
    vec3 fond = mix(BLEU, photo, smoothstep(0.22, 0.8, r));
    vec3 encre = mix(BLANC, echantillon, smoothstep(0.1, 0.55, r));
    c = mix(fond, encre, point * (1.0 - smoothstep(0.7, 1.0, r)));
  }
  float epaisseur = 1.5 / taille.y;
  c = mix(c, ORANGE, 1.0 - smoothstep(epaisseur * 0.5, epaisseur, abs(vUv.y - trait)));
  couleur = vec4(c, 1.0);
}`;

const compiler = (gl, type, source) => {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
};

const charger = (src) => new Promise((ok, ko) => {
  const i = new Image();
  i.decoding = 'async';
  i.onload = () => ok(i);
  i.onerror = ko;
  i.src = src;
});

/**
 * Monte le relevé sur un canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLVideoElement} video l'image de départ, lue en direct : le premier passage part de la vidéo
 * @param {string[]} images les pièces, dans l'ordre du récit
 * @returns {{ placer(f: number): void, regarder(x: number, y: number): void }}
 *   placer : -1 sur la vidéo, 0 sur la première pièce, 1.5 à mi-chemin entre la deuxième et la troisième
 */
export async function monterReleve(canvas, video, images, { reduit = false } = {}) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
  const programme = gl.createProgram();
  gl.attachShader(programme, compiler(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(programme, compiler(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(programme);
  gl.useProgram(programme);
  const u = (nom) => gl.getUniformLocation(programme, nom);
  const U = Object.fromEntries(['avant', 'apres', 'cadreAvant', 'cadreApres', 'balayage', 'cellule', 'taille', 'regard', 'souffle'].map(n => [n, u(n)]));
  gl.uniform1i(U.avant, 0);
  gl.uniform1i(U.apres, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(programme, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const texture = (source) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    return t;
  };

  // la vidéo commence par son affiche, le temps qu'elle ait une image à donner
  const affiche = await charger(video.poster);
  const pieces = await Promise.all(images.map(charger));
  const sources = [
    { image: affiche, texture: texture(affiche), video: true },
    ...pieces.map(image => ({ image, texture: texture(image) })),
  ];

  let largeur = 0, hauteur = 0;
  const cadre = (s) => {
    const v = s.video && video.readyState >= 2;
    const aspect = v ? video.videoWidth / video.videoHeight : s.image.naturalWidth / s.image.naturalHeight;
    const boite = largeur / hauteur;
    let sx = 1, sy = 1;
    if (aspect > boite) sx = boite / aspect; else sy = aspect / boite;
    // mêmes object-position que la vidéo : 30 % 50 % en paysage, 50 % 30 % en portrait
    const paysage = boite >= 1;
    const fx = s.video && paysage ? .3 : .5;
    const fy = s.video && !paysage ? .3 : .5;
    // en paysage, les pièces reculent et se décalent vers la gauche, loin du texte
    const recul = !s.video && paysage ? RECUL : 1;
    const decalage = !s.video && paysage ? DECALAGE : 0;
    return [sx * recul, sy * recul, ((1 - sx) * fx - .5) * recul + .5 + decalage, ((1 - sy) * fy - .5) * recul + .5];
  };

  let f = -1, cible = { x: 0, y: 0 }, lisse = { x: 0, y: 0 }, image = 0, visible = false;
  const dimensionner = () => {
    const dpr = Math.min(devicePixelRatio, 1.5);
    largeur = Math.round(canvas.clientWidth * dpr);
    hauteur = Math.round(canvas.clientHeight * dpr);
    canvas.width = largeur;
    canvas.height = hauteur;
    gl.viewport(0, 0, largeur, hauteur);
    gl.uniform1f(U.cellule, CELLULE * dpr);
    gl.uniform2f(U.taille, largeur, hauteur);
  };

  const dessiner = (t) => {
    image = 0;
    const j = Math.min(sources.length - 2, Math.floor(f + 1));
    const k = Math.min(1, f + 1 - j);
    const a = sources[j], b = sources[j + 1];
    if (a.video && video.readyState >= 2) {
      gl.bindTexture(gl.TEXTURE_2D, a.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, a.texture);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform4f(U.cadreAvant, ...cadre(a));
    gl.uniform4f(U.cadreApres, ...cadre(b));
    gl.uniform1f(U.balayage, k);
    lisse.x += (cible.x - lisse.x) * .06;
    lisse.y += (cible.y - lisse.y) * .06;
    gl.uniform2f(U.regard, lisse.x * .012, lisse.y * .008);
    // la pièce respire à peine : elle n'est jamais tout à fait une photo figée
    gl.uniform1f(U.souffle, reduit ? 0 : .012 * (.5 + .5 * Math.sin(t / 1400)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (visible && !reduit) image = requestAnimationFrame(dessiner);
  };
  const relancer = () => { if (!image) image = requestAnimationFrame(dessiner); };

  dimensionner();
  new ResizeObserver(() => { dimensionner(); relancer(); }).observe(canvas);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) relancer(); }).observe(canvas);

  return {
    placer(valeur) { f = Math.max(-1, Math.min(sources.length - 2, valeur)); relancer(); },
    regarder(x, y) { cible = { x, y }; relancer(); },
  };
}
