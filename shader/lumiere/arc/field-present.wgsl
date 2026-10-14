// Image finale : la lumière, calculée en basse résolution (douce par nature), est relue dans une texture ;
// les points sont redessinés à la résolution de l'écran pour rester nets.
// Le sol peut porter la photo d'un vêtement : la lumière du motif et du curseur l'éclaire.
import { field_emitter } from "./field-shape.wgsl";

fn tonemap_aces(color: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((color * (a * color + b)) / (color * (c * color + d) + e), vec3f(0.0), vec3f(1.0));
}

fn linear_to_srgb(color: vec3f) -> vec3f {
  let low = color * 12.92;
  let high = 1.055 * pow(max(color, vec3f(0.0)), vec3f(1.0 / 2.4)) - 0.055;
  return select(high, low, color <= vec3f(0.0031308));
}

fn srgb_to_linear(color: vec3f) -> vec3f {
  return pow(max(color, vec3f(0.0)), vec3f(2.2));
}

struct Present {
  /** x : exposition, y : bord des points estompé, en part du rayon (0 : net). */
  display: vec4f,
  /** x : albédo du sol, y : ambiance, z : ambiance propre au vêtement. */
  lighting: vec4f,
  /** xy : taille de la scène, z : temps. */
  scene: vec4f,
  /** xy : centre du motif, z : écart entre les points, w : rayon. */
  shape: vec4f,
  /** xy : curseur, z : rayon, w : puissance. */
  pointer: vec4f,
  /** xy : coin haut gauche de la photo, zw : sa taille, en pixels de scène. */
  photo_rect: vec4f,
  /** xy : taille de la photo en texels, z : albédo du vêtement, w : apparition (0 sans photo). */
  photo_info: vec4f,
  /** rgb : couleur du fond de la photo, en sRGB. */
  photo_fond: vec4f,
};

@group(0) @binding(0) var<uniform> present: Present;
@group(0) @binding(1) var irradiance_tex: texture_2d<f32>;
@group(0) @binding(2) var irradiance_samp: sampler;
@group(0) @binding(3) var<storage, read> photo: array<u32>;

// Un texel de la photo, rangé en RGBA 8 bits dans un u32.
fn photo_texel(p: vec2i) -> vec3f {
  let size = vec2i(present.photo_info.xy);
  let q = clamp(p, vec2i(0), size - 1);
  return unpack4x8unorm(photo[u32(q.y * size.x + q.x)]).rgb;
}

// Écart entre la composante la plus forte et la plus faible : zéro pour un gris.
fn chroma(color: vec3f) -> f32 {
  return max(color.r, max(color.g, color.b)) - min(color.r, min(color.g, color.b));
}

// Albédo au point donné. Le fond de la photo se confond avec le sol ; le vêtement,
// reconnu à sa différence de couleur avec ce fond, garde ses couleurs.
// rgb : albédo linéaire, a : part du vêtement.
fn surface_at(pixel: vec2f) -> vec4f {
  let floor_albedo = vec3f(present.lighting.x);
  if (present.photo_info.w <= 0.0) {
    return vec4f(floor_albedo, 0.0);
  }
  let uv = (pixel - present.photo_rect.xy) / present.photo_rect.zw;
  let edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
  if (edge <= 0.0) {
    return vec4f(floor_albedo, 0.0);
  }
  // lissage bilinéaire fait à la main : la photo reste nette même agrandie
  let t = uv * present.photo_info.xy - 0.5;
  let base = floor(t);
  let f = t - base;
  let i = vec2i(base);
  let top = mix(photo_texel(i), photo_texel(i + vec2i(1, 0)), f.x);
  let bottom = mix(photo_texel(i + vec2i(0, 1)), photo_texel(i + vec2i(1, 1)), f.x);
  let color = mix(top, bottom, f.y);
  // Le vêtement est reconnu sur une version floutée de la photo : le grain chiné du molleton
  // ne doit pas faire basculer des pixels voisins entre vêtement et fond.
  var blur = vec3f(0.0);
  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      blur += photo_texel(i + vec2i(dx, dy) * 5);
    }
  }
  blur /= 9.0;
  let luma = vec3f(0.299, 0.587, 0.114);
  let background = present.photo_fond.rgb;
  let background_luma = dot(background, luma);
  let background_chroma = chroma(background);
  // plus sombre que le fond (le molleton) ou plus coloré que lui (la doublure bleue),
  // sur la version floutée comme sur le pixel net : pas de liseré sur l'ombre portée
  let darker = smoothstep(0.06, 0.13, background_luma - dot(blur, luma))
    * smoothstep(0.01, 0.05, background_luma - dot(color, luma));
  let colored = smoothstep(0.1, 0.2, chroma(blur) - background_chroma)
    * smoothstep(0.05, 0.12, chroma(color) - background_chroma);
  let key = max(darker, colored);
  let garment = key * smoothstep(0.0, 0.03, edge) * present.photo_info.w;
  return vec4f(mix(floor_albedo, srgb_to_linear(color) * present.photo_info.z, garment), garment);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let pixel = uv * present.scene.xy;
  // taille d'un pixel d'écran mesurée en pixels de scène : l'anticrénelage suit la résolution réelle
  let aa = max(fwidth(pixel.x), 0.02) * 0.9;
  // la lumière a déjà été résolue une fois par pixel de scène : ici, une seule lecture filtrée
  let irradiance = textureSampleLevel(irradiance_tex, irradiance_samp, uv, 0.0).rgb;
  let emitter = field_emitter(
    pixel,
    present.shape.xy,
    present.shape.z,
    present.shape.w,
    present.scene.z,
    present.pointer.xy,
    present.pointer.z,
    present.pointer.w,
    aa,
    present.display.y,
  );
  let vignette = 1.0 - 0.42 * smoothstep(0.16, 0.72, distance(uv, vec2f(0.5)));
  let ground = surface_at(pixel);
  let surface = ground.rgb * vignette;
  let ambient = present.lighting.y + ground.a * present.lighting.z;
  let lit = mix(surface * (irradiance + ambient), emitter.rgb, clamp(emitter.a, 0.0, 1.0));
  return vec4f(linear_to_srgb(tonemap_aces(lit * present.display.x)), 1.0);
}
