// Les deux pans d'un sweat ouvert, de part et d'autre de la trame : on les attrape, on les tire, ils retombent.
// Simulation de Verlet sur le processeur, rendu en WebGL2. Chaque pan est une plaque épaisse :
// molleton gris chiné dessus, doublure bleue à points dessous, et la tranche entre les deux.
// Le bord de chaque pan est retourné en revers : le pli montre la doublure, et il n'y a pas de bord à finir.

// colonnes du pan à plat, du pli, puis du revers rabattu
const PLAT = 24;
const PLI = 6;
const REVERS = 8;
const COLONNES = PLAT + PLI + REVERS;
const RANGEES = 52;
const POINTS = COLONNES * RANGEES;
const PASSES = 8;
const FOV = Math.PI / 6;
// à cette distance, le plan z = 0 couvre exactement la hauteur du canvas, qui fait 2 unités
const RECUL = 1 / Math.tan(FOV / 2);
// les pans dépassent en haut et en bas, pour qu'on n'en voie jamais les bords au repos
const HAUTEUR = 2.3;
// en pixels : l'épaisseur du molleton, le rayon du pli qui en découle, la largeur du revers
const EPAISSEUR = 20;
const RAYON_PLI = EPAISSEUR * 0.6;
const LARGEUR_REVERS = 84;
// un point de trame tous les 44 px, comme la trame du fond
const PAS_TRAME = 44;

const VERTEX = `#version 300 es
in vec3 position;
in vec3 normale;
in vec3 bord;
in vec2 couche;
in vec2 uv;
uniform mat4 projection;
uniform float epaisseur;
out vec3 vNormale;
out vec2 vUv;
out vec2 vCouche;
void main() {
  // couche.x : 1 pour la face du molleton, 0 pour celle de la doublure ; couche.y : 1 sur la tranche
  vec3 n = normalize(normale);
  vec3 p = position + n * (couche.x - 0.5) * epaisseur;
  vNormale = couche.y > 0.5 ? bord : n * (couche.x * 2.0 - 1.0);
  vUv = uv;
  vCouche = couche;
  gl_Position = projection * vec4(p.xy, p.z - ${RECUL.toFixed(6)}, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vNormale;
in vec2 vUv;
in vec2 vCouche;
uniform vec2 taille;
uniform float bordRevers;
out vec4 couleur;

const vec3 BLEU = vec3(0.0, 0.443, 0.733);
const vec3 BLANC = vec3(0.957, 0.957, 0.949);

float hasard(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hasard(i), hasard(i + vec2(1, 0)), f.x), mix(hasard(i + vec2(0, 1)), hasard(i + 1.0), f.x), f.y);
}
vec3 coeur(vec2 px, float t) {
  return vec3(0.91, 0.89, 0.84) + (bruit(vec2(px.y * 0.9, t * 9.0)) - 0.5) * 0.1;
}
vec3 molleton(vec2 px) {
  float chine = bruit(px * vec2(0.5, 0.16)) * 0.6 + bruit(px * vec2(1.3, 0.4)) * 0.4;
  return vec3(0.6, 0.6, 0.59) + (chine - 0.5) * 0.14;
}

void main() {
  vec3 n = normalize(vNormale);
  // la caméra est presque de face : on éclaire toujours le côté qui nous regarde
  if (n.z < 0.0) n = -n;
  float lumiere = 0.42 + 0.62 * max(dot(n, normalize(vec3(-0.35, 0.55, 1.0))), 0.0);
  vec2 px = vUv * taille;
  vec3 c;
  if (vCouche.y > 0.5) {
    // la tranche : la doublure, le molleton gratté écru au cœur, puis le jersey gris de l'endroit
    float t = vCouche.x;
    c = t < 0.14 ? BLEU : t > 0.86 ? molleton(px) : coeur(px, t);
    lumiere *= 0.92;
  } else if (vCouche.x > 0.5) {
    c = molleton(px);
    // le revers rabattu porte son ombre sur le molleton, juste avant son bord
    float avant = bordRevers - px.x;
    c *= 1.0 - 0.5 * step(0.0, avant) * exp(-avant / 10.0);
  } else {
    vec2 q = px / ${PAS_TRAME.toFixed(1)};
    float d = length(fract(q) - 0.5);
    float b = fwidth(d) * 1.2;
    c = mix(BLEU, BLANC, 1.0 - smoothstep(0.17 - b, 0.17 + b, d));
    // au bord coupé du revers, on devine la tranche : le molleton écru, plus sombre vers le bas de l'épaisseur
    float coupe = (1.0 - vUv.x) * taille.x;
    if (coupe < 6.0) c = coeur(px, coupe / 6.0) * mix(0.7, 1.0, coupe / 6.0);
  }
  couleur = vec4(c * lumiere, 1.0);
}`;

const compiler = (gl, type, source) => {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
};

const perspective = (aspect) => {
  const f = RECUL, proche = 0.1, loin = 20;
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (loin + proche) / (proche - loin), -1,
    0, 0, (2 * loin * proche) / (proche - loin), 0,
  ]);
};

// longueur de tissu entre la couture et chaque colonne : à plat, autour du pli, puis le revers qui revient
const abscisses = (plat, rayon, revers) => Float32Array.from({ length: COLONNES }, (_, i) =>
  i < PLAT ? (plat * i) / (PLAT - 1)
    : i < PLAT + PLI ? plat + (Math.PI * rayon * (i - PLAT + 1)) / PLI
      : plat + Math.PI * rayon + (revers * (i - PLAT - PLI + 1)) / REVERS);

// un pan : cote vaut -1 à gauche, 1 à droite ; la colonne 0 est cousue au bord de l'écran.
// Ses tableaux sont des vues sur ceux des deux pans réunis, que la détection des collisions parcourt d'un bloc.
const creerPan = (cote, debut, tableaux) => {
  const vue = (t) => t.subarray(debut * 3, (debut + POINTS) * 3);
  const pan = { cote, debut, pos: vue(tableaux.pos), prec: vue(tableaux.prec), repos: vue(tableaux.repos), normales: vue(tableaux.normales) };
  const liens = [];
  const id = (i, j) => j * COLONNES + i;
  for (let j = 0; j < RANGEES; j++) for (let i = 0; i < COLONNES; i++) {
    if (i + 1 < COLONNES) liens.push(id(i, j), id(i + 1, j));
    if (j + 1 < RANGEES) liens.push(id(i, j), id(i, j + 1));
    if (i + 1 < COLONNES && j + 1 < RANGEES) liens.push(id(i, j), id(i + 1, j + 1), id(i + 1, j), id(i, j + 1));
    // les liens qui sautent des points donnent sa tenue au molleton : sans eux, il tomberait comme une soie
    if (i + 2 < COLONNES) liens.push(id(i, j), id(i + 2, j));
    if (j + 2 < RANGEES) liens.push(id(i, j), id(i, j + 2));
    if (i + 3 < COLONNES) liens.push(id(i, j), id(i + 3, j));
  }
  pan.liens = new Uint16Array(liens);
  pan.longueurs = new Float32Array(liens.length / 2);
  return pan;
};

const poser = (pan, aspect, plat, rayon) => {
  const bord = pan.cote * (aspect + 0.03);
  for (let j = 0; j < RANGEES; j++) for (let i = 0; i < COLONNES; i++) {
    const k = (j * COLONNES + i) * 3;
    const s = pan.abscisses[i];
    let x = s, z = 0;
    if (s > plat) {
      const a = Math.min(Math.PI, (s - plat) / rayon);
      x = plat + rayon * Math.sin(a) - Math.max(0, s - plat - Math.PI * rayon);
      z = rayon * (1 - Math.cos(a));
    }
    pan.repos[k] = bord - pan.cote * x;
    pan.repos[k + 1] = HAUTEUR / 2 - (j / (RANGEES - 1)) * HAUTEUR;
    pan.repos[k + 2] = z;
  }
  pan.pos.set(pan.repos);
  pan.prec.set(pan.repos);
  const r = pan.repos;
  for (let l = 0; l < pan.longueurs.length; l++) {
    const a = pan.liens[l * 2] * 3, b = pan.liens[l * 2 + 1] * 3;
    pan.longueurs[l] = Math.hypot(r[a] - r[b], r[a + 1] - r[b + 1], r[a + 2] - r[b + 2]);
  }
};

const avancer = (pan) => {
  const { pos, prec, repos } = pan;
  for (let j = 0; j < RANGEES; j++) for (let i = 1; i < COLONNES; i++) {
    const k = (j * COLONNES + i) * 3;
    const u = i / (COLONNES - 1);
    // un rappel lent vers sa place et un amorti fort : le molleton est lourd, il retombe sans rebondir
    const rappel = 0.006 * (1 - 0.4 * u);
    for (let c = 0; c < 3; c++) {
      const v = (pos[k + c] - prec[k + c]) * 0.93;
      prec[k + c] = pos[k + c];
      pos[k + c] += v + (repos[k + c] - pos[k + c]) * rappel + (c === 1 ? -0.00015 : 0);
    }
  }
};

const contraindre = (pan) => {
  const { pos, repos, liens, longueurs, abscisses } = pan;
  for (let l = 0; l < longueurs.length; l++) {
    const a = liens[l * 2] * 3, b = liens[l * 2 + 1] * 3;
    const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    const k = ((d - longueurs[l]) / d) * 0.5;
    pos[a] += dx * k; pos[a + 1] += dy * k; pos[a + 2] += dz * k;
    pos[b] -= dx * k; pos[b + 1] -= dy * k; pos[b + 2] -= dz * k;
  }
  for (let j = 0; j < RANGEES; j++) {
    const k0 = j * COLONNES * 3;
    pos[k0] = repos[k0]; pos[k0 + 1] = repos[k0 + 1]; pos[k0 + 2] = repos[k0 + 2];
    // le molleton ne s'étire pas : aucun point ne s'éloigne de sa couture plus que la longueur de tissu qui l'y relie
    for (let i = 1; i < COLONNES; i++) {
      const k = k0 + i * 3;
      const dx = pos[k] - pos[k0], dy = pos[k + 1] - pos[k0 + 1], dz = pos[k + 2] - pos[k0 + 2];
      const d2 = dx * dx + dy * dy + dz * dz, max = abscisses[i];
      if (d2 > max * max) { const f = max / Math.sqrt(d2); pos[k] = pos[k0] + dx * f; pos[k + 1] = pos[k0 + 1] + dy * f; pos[k + 2] = pos[k0 + 2] + dz * f; }
    }
  }
};

// normales unitaires, tournées vers le molleton : la plaque s'épaissit de part et d'autre selon elles
const calculerNormales = (pan) => {
  const { pos, normales, cote } = pan;
  const p = (i, j) => (Math.min(RANGEES - 1, Math.max(0, j)) * COLONNES + Math.min(COLONNES - 1, Math.max(0, i))) * 3;
  for (let j = 0; j < RANGEES; j++) for (let i = 0; i < COLONNES; i++) {
    const a1 = p(i + 1, j), a0 = p(i - 1, j), b1 = p(i, j - 1), b0 = p(i, j + 1);
    const ax = pos[a1] - pos[a0], ay = pos[a1 + 1] - pos[a0 + 1], az = pos[a1 + 2] - pos[a0 + 2];
    const bx = pos[b1] - pos[b0], by = pos[b1 + 1] - pos[b0 + 1], bz = pos[b1 + 2] - pos[b0 + 2];
    const nx = (ay * bz - az * by) * -cote, ny = (az * bx - ax * bz) * -cote, nz = (ax * by - ay * bx) * -cote;
    const l = Math.hypot(nx, ny, nz) || 1;
    const k = (j * COLONNES + i) * 3;
    normales[k] = nx / l; normales[k + 1] = ny / l; normales[k + 2] = nz / l;
  }
};

/**
 * Monte les deux pans sur le canvas, posé par-dessus la trame.
 * @param {HTMLCanvasElement} canvas
 * @param {{ reserve?: HTMLElement, demo?: boolean }} options reserve : le texte que les pans laissent dégagé au repos
 */
export const monterTissu = (canvas, { reserve, demo = true } = {}) => {
  const gl = canvas.getContext('webgl2', { antialias: true, premultipliedAlpha: true });
  if (!gl) throw new Error('webgl2-absent');
  const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const programme = gl.createProgram();
  gl.attachShader(programme, compiler(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(programme, compiler(gl, gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(programme);
  gl.useProgram(programme);

  const TOTAL = POINTS * 2;
  const tableaux = { pos: new Float32Array(TOTAL * 3), prec: new Float32Array(TOTAL * 3), repos: new Float32Array(TOTAL * 3), normales: new Float32Array(TOTAL * 3) };
  const pans = [creerPan(-1, 0, tableaux), creerPan(1, POINTS, tableaux)];

  // les sommets : les deux faces de chaque pan, puis ses tranches (le bord du revers, le haut et le bas).
  // Chaque sommet suit un point du tissu ; sur la tranche, il garde aussi le point voisin vers l'intérieur.
  const sources = [], voisins = [], couches = [], indices = [];
  const sommet = (k, voisin, face, tranche) => { sources.push(k); voisins.push(voisin); couches.push(face, tranche); };
  pans.forEach(({ debut }) => {
    const id = (i, j) => debut + j * COLONNES + i;
    for (const face of [1, 0]) {
      const base = sources.length;
      for (let j = 0; j < RANGEES; j++) for (let i = 0; i < COLONNES; i++) sommet(id(i, j), -1, face, 0);
      for (let j = 0; j + 1 < RANGEES; j++) for (let i = 0; i + 1 < COLONNES; i++) {
        const a = base + j * COLONNES + i, b = a + COLONNES;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const tranche = (bord) => {
      const base = sources.length;
      bord.forEach(([k, v]) => { sommet(k, v, 1, 1); sommet(k, v, 0, 1); });
      for (let e = 0; e + 1 < bord.length; e++) {
        const a = base + e * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
      }
    };
    tranche(Array.from({ length: RANGEES }, (_, j) => [id(COLONNES - 1, j), id(COLONNES - 2, j)]));
    tranche(Array.from({ length: COLONNES }, (_, i) => [id(i, 0), id(i, 1)]));
    tranche(Array.from({ length: COLONNES }, (_, i) => [id(i, RANGEES - 1), id(i, RANGEES - 2)]));
  });
  const SOMMETS = sources.length;
  const vPos = new Float32Array(SOMMETS * 3), vNormales = new Float32Array(SOMMETS * 3), vBords = new Float32Array(SOMMETS * 3);
  const uvs = new Float32Array(SOMMETS * 2);

  const tampon = (donnees, nom, taille, usage) => {
    const t = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, t);
    gl.bufferData(gl.ARRAY_BUFFER, donnees, usage);
    const lieu = gl.getAttribLocation(programme, nom);
    gl.enableVertexAttribArray(lieu);
    gl.vertexAttribPointer(lieu, taille, gl.FLOAT, false, 0, 0);
    return t;
  };
  gl.bindVertexArray(gl.createVertexArray());
  const tamponPos = tampon(vPos, 'position', 3, gl.DYNAMIC_DRAW);
  const tamponNormales = tampon(vNormales, 'normale', 3, gl.DYNAMIC_DRAW);
  const tamponBords = tampon(vBords, 'bord', 3, gl.DYNAMIC_DRAW);
  const tamponUvs = tampon(uvs, 'uv', 2, gl.DYNAMIC_DRAW);
  tampon(new Float32Array(couches), 'couche', 2, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  gl.enable(gl.DEPTH_TEST);
  const lieux = Object.fromEntries(['projection', 'taille', 'bordRevers', 'epaisseur'].map(u => [u, gl.getUniformLocation(programme, u)]));

  // pour les collisions : la place de chaque point dans le tissu déplié, et la distance minimale entre deux couches
  const deplie = new Float32Array(TOTAL * 2);
  let distance = 0.03;

  let aspect = 1, hauteurPx = 1;
  const placer = () => {
    const l = canvas.clientWidth, h = canvas.clientHeight;
    if (!l || !h) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(l * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    aspect = l / h;
    hauteurPx = h;
    // au repos, chaque pan s'arrête à quelques pixels du texte ; une unité vaut une demi-hauteur de canvas
    const libre = reserve ? (l - reserve.getBoundingClientRect().width) / 2 - 28 : l * 0.25;
    const etendue = Math.min(0.3, Math.max(0.08, libre / l)) * 2 * aspect;
    const unite = h / 2;
    const rayon = RAYON_PLI / unite;
    const plat = etendue - rayon;
    const revers = Math.min(LARGEUR_REVERS / unite, plat * 0.4);
    const s = abscisses(plat, rayon, revers);
    const longueur = s[COLONNES - 1];
    distance = EPAISSEUR / unite;
    pans.forEach(pan => {
      pan.abscisses = s;
      poser(pan, aspect, plat, rayon);
    });
    for (let p = 0; p < TOTAL; p++) {
      const local = p % POINTS, i = local % COLONNES, j = (local - i) / COLONNES;
      deplie[p * 2] = s[i];
      deplie[p * 2 + 1] = (j / (RANGEES - 1)) * HAUTEUR;
    }
    sources.forEach((k, v) => {
      uvs[v * 2] = deplie[k * 2] / longueur;
      uvs[v * 2 + 1] = deplie[k * 2 + 1] / HAUTEUR;
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, tamponUvs);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, uvs);
    gl.uniformMatrix4fv(lieux.projection, false, perspective(aspect));
    gl.uniform2f(lieux.taille, longueur * unite, HAUTEUR * unite);
    gl.uniform1f(lieux.bordRevers, (plat - revers) * unite);
    gl.uniform1f(lieux.epaisseur, distance);
  };

  // le tissu ne se traverse pas : deux points qui ne sont pas voisins dans le tissu restent à une épaisseur
  // l'un de l'autre. Une grille de hachage ne compare chaque point qu'à ceux de ses cases voisines.
  const CASES = 16384;
  const debutCase = new Int32Array(CASES + 1);
  const rangement = new Int32Array(TOTAL);
  const cle = (x, y, z) => (Math.imul(x, 92837111) ^ Math.imul(y, 689287499) ^ Math.imul(z, 283923481)) & (CASES - 1);
  const repousser = () => {
    const { pos } = tableaux;
    const c = (v) => Math.floor(v / distance);
    debutCase.fill(0);
    for (let p = 0; p < TOTAL; p++) debutCase[cle(c(pos[p * 3]), c(pos[p * 3 + 1]), c(pos[p * 3 + 2]))]++;
    for (let i = 1; i <= CASES; i++) debutCase[i] += debutCase[i - 1];
    for (let p = 0; p < TOTAL; p++) rangement[--debutCase[cle(c(pos[p * 3]), c(pos[p * 3 + 1]), c(pos[p * 3 + 2]))]] = p;
    const voisinage = (distance * 1.5) ** 2, limite = distance * distance;
    for (let p = 0; p < TOTAL; p++) {
      if (p % COLONNES === 0) continue;
      const px = c(pos[p * 3]), py = c(pos[p * 3 + 1]), pz = c(pos[p * 3 + 2]);
      for (let x = px - 1; x <= px + 1; x++) for (let y = py - 1; y <= py + 1; y++) for (let z = pz - 1; z <= pz + 1; z++) {
        const h = cle(x, y, z);
        for (let e = debutCase[h]; e < debutCase[h + 1]; e++) {
          const q = rangement[e];
          if (q <= p || q % COLONNES === 0) continue;
          // deux points proches dans le tissu déplié appartiennent à la même couche : on les laisse aux liens
          const dx = pos[q * 3] - pos[p * 3], dy = pos[q * 3 + 1] - pos[p * 3 + 1], dz = pos[q * 3 + 2] - pos[p * 3 + 2];
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= limite || d2 < 1e-18) continue;
          const su = deplie[p * 2] - deplie[q * 2], sv = deplie[p * 2 + 1] - deplie[q * 2 + 1];
          if ((p < POINTS) === (q < POINTS) && su * su + sv * sv < voisinage) continue;
          const d = Math.sqrt(d2), k = ((distance - d) / d) * 0.5;
          pos[p * 3] -= dx * k; pos[p * 3 + 1] -= dy * k; pos[p * 3 + 2] -= dz * k;
          pos[q * 3] += dx * k; pos[q * 3 + 1] += dy * k; pos[q * 3 + 2] += dz * k;
        }
      }
    }
  };

  // pointeur en coordonnées normalisées de l'écran ; une prise retient un point et la profondeur où on le tient
  const pointeur = { x: 0, y: 0, dedans: false };
  let prise = null;
  const versEcran = (pos, k) => {
    const w = RECUL - pos[k + 2];
    return [(RECUL * pos[k]) / (w * aspect), (RECUL * pos[k + 1]) / w];
  };
  const lire = (e) => {
    const r = canvas.getBoundingClientRect();
    pointeur.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointeur.y = 1 - ((e.clientY - r.top) / r.height) * 2;
  };
  // la main prend une poignée de tissu, pas un seul point : sinon le pan s'étire en pointe
  const zone = ({ repos }, k) => {
    const points = [];
    for (let q = 0; q < repos.length; q += 3) {
      if (q % (COLONNES * 3) === 0) continue;
      const poids = 1 - Math.hypot(repos[q] - repos[k], repos[q + 1] - repos[k + 1]) / 0.24;
      if (poids > 0) points.push(q, poids);
    }
    return points;
  };
  const attraper = () => {
    let meilleur = null, mini = (48 / hauteurPx) * 2;
    pans.forEach(pan => {
      for (let k = 0; k < pan.pos.length; k += 3) {
        if (k % (COLONNES * 3) === 0) continue;
        const [x, y] = versEcran(pan.pos, k);
        const d = Math.hypot((x - pointeur.x) * aspect, y - pointeur.y);
        if (d < mini) { mini = d; meilleur = { pan, k }; }
      }
    });
    if (meilleur) {
      meilleur.z = meilleur.pan.pos[meilleur.k + 2] + 0.12;
      meilleur.zone = zone(meilleur.pan, meilleur.k);
    }
    return meilleur;
  };
  // la main qui tient le tissu : la poignée suit le pointeur, à la profondeur où on l'a prise
  const tenir = () => {
    const { pan: { pos, abscisses }, k, z } = prise;
    const w = RECUL - z;
    let x = (pointeur.x * aspect * w) / RECUL, y = (pointeur.y * w) / RECUL;
    // la main ne peut pas tirer le tissu plus loin que sa longueur : elle s'arrête quand il est tendu
    const k0 = k - (k % (COLONNES * 3)), portee = abscisses[(k - k0) / 3];
    const ex = x - pos[k0], ey = y - pos[k0 + 1], ez = z - pos[k0 + 2], d = Math.hypot(ex, ey, ez);
    if (d > portee) { x = pos[k0] + (ex * portee) / d; y = pos[k0 + 1] + (ey * portee) / d; }
    const dx = x - pos[k], dy = y - pos[k + 1], dz = z - pos[k + 2];
    for (let p = 0; p < prise.zone.length; p += 2) {
      const q = prise.zone[p], poids = prise.zone[p + 1];
      pos[q] += dx * poids; pos[q + 1] += dy * poids; pos[q + 2] += dz * poids;
    }
  };
  // sans rien tenir, le tissu se soulève un peu sous le curseur
  const effleurer = () => {
    pans.forEach(pan => {
      for (let k = 0; k < pan.pos.length; k += 3) {
        const [x, y] = versEcran(pan.pos, k);
        const d = Math.hypot((x - pointeur.x) * aspect, y - pointeur.y);
        if (d < 0.22) pan.pos[k + 2] += (1 - d / 0.22) * 0.0018;
      }
    });
  };

  canvas.addEventListener('pointerdown', (e) => {
    lire(e);
    prise = attraper();
    if (prise) canvas.setPointerCapture(e.pointerId);
    relancer();
  });
  canvas.addEventListener('pointermove', (e) => { lire(e); pointeur.dedans = true; relancer(); });
  canvas.addEventListener('pointerleave', () => { pointeur.dedans = false; });
  const lacher = () => { prise = null; };
  canvas.addEventListener('pointerup', lacher);
  canvas.addEventListener('pointercancel', lacher);

  let visible = false, image = 0, calme = 0, demoFaite = !demo || reduit;

  // à la première apparition, une main invisible ouvre le pan droit par son pli puis le lâche : on comprend le geste
  const montrer = () => {
    demoFaite = true;
    const pan = pans[1];
    const k = (Math.round(RANGEES * 0.55) * COLONNES + PLAT + PLI / 2) * 3;
    const [x0, y0] = versEcran(pan.pos, k);
    const debut = performance.now();
    const pas = (t) => {
      const a = Math.min(1, (t - debut) / 1100);
      const e = a < 0.5 ? 2 * a * a : 1 - (-2 * a + 2) ** 2 / 2;
      if (prise && prise.demo === undefined) return;
      pointeur.x = x0 + (0.92 - x0) * e;
      pointeur.y = y0 + 0.12 * Math.sin(a * Math.PI);
      prise = { pan, k, zone: zone(pan, k), z: 0.2 * Math.sin(a * Math.PI) + 0.04, demo: true };
      if (a < 1) requestAnimationFrame(pas);
      else prise = null;
    };
    requestAnimationFrame(pas);
  };

  const dessiner = () => {
    pans.forEach(calculerNormales);
    const { pos, normales } = tableaux;
    for (let v = 0; v < SOMMETS; v++) {
      const k = sources[v] * 3, o = v * 3;
      vPos[o] = pos[k]; vPos[o + 1] = pos[k + 1]; vPos[o + 2] = pos[k + 2];
      vNormales[o] = normales[k]; vNormales[o + 1] = normales[k + 1]; vNormales[o + 2] = normales[k + 2];
      if (voisins[v] >= 0) {
        // sur la tranche, la lumière vient du côté où le tissu s'arrête
        const q = voisins[v] * 3;
        const bx = pos[k] - pos[q], by = pos[k + 1] - pos[q + 1], bz = pos[k + 2] - pos[q + 2];
        const l = Math.hypot(bx, by, bz) || 1;
        vBords[o] = bx / l; vBords[o + 1] = by / l; vBords[o + 2] = bz / l;
      }
    }
    for (const [t, d] of [[tamponPos, vPos], [tamponNormales, vNormales], [tamponBords, vBords]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, t);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, d);
    }
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
  };

  const tick = () => {
    image = 0;
    if (!visible) return;
    pans.forEach(avancer);
    if (prise) tenir();
    else if (pointeur.dedans) effleurer();
    for (let i = 0; i < PASSES; i++) {
      pans.forEach(contraindre);
      if (prise) tenir();
      if (i === PASSES / 2) repousser();
    }
    let mouvement = 0;
    const { pos, prec } = tableaux;
    for (let k = 0; k < pos.length; k++) mouvement = Math.max(mouvement, Math.abs(pos[k] - prec[k]));
    dessiner();
    // le molleton ne flotte pas : dès qu'il est immobile et que personne ne le tient, on arrête de calculer
    calme = mouvement < 1e-5 && !prise ? calme + 1 : 0;
    if (calme < 30) image = requestAnimationFrame(tick);
  };
  const relancer = () => { calme = 0; if (visible && !image) image = requestAnimationFrame(tick); };

  new ResizeObserver(() => { placer(); dessiner(); }).observe(canvas);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) relancer();
    if (visible && e.intersectionRatio > 0.5 && !demoFaite) setTimeout(montrer, 500);
  }, { threshold: [0, 0.55] }).observe(canvas);
  void document.fonts?.ready.then(() => { placer(); dessiner(); });
  placer();
  dessiner();
};
