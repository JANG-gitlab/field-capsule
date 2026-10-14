// Résout la lumière du niveau 0 des cascades une fois par pixel de scène.
// L'image finale n'a plus qu'à relire cette texture, au lieu de refaire le calcul à chaque pixel d'écran.
import { rc_atlas_texel, rc_block_size, rc_ray_count } from "./rc-directions.wgsl";

struct Irradiance {
  /** z : base des directions. */
  state: vec4f,
  /** xy : taille de la scène. */
  size: vec4f,
};

@group(0) @binding(0) var<uniform> irradiance: Irradiance;
@group(0) @binding(1) var cascade_tex: texture_2d<f32>;

fn resolve_probe(probe: vec2f) -> vec3f {
  let block = rc_block_size(0.0, irradiance.state.z);
  let rays = rc_ray_count(0.0, irradiance.state.z);
  let atlas_size = vec2f(textureDimensions(cascade_tex));
  let clamped_probe = clamp(probe, vec2f(0.0), atlas_size / block - 1.0);
  var total = vec3f(0.0);
  for (var i = 0.0; i < rays; i = i + 1.0) {
    total += textureLoad(cascade_tex, vec2i(rc_atlas_texel(clamped_probe, i, block)), 0).rgb;
  }
  return total / rays;
}

// Interpole les quatre sondes voisines pour garder un champ de lumière continu.
fn resolve_cascade0(pixel: vec2f) -> vec3f {
  let position = pixel - 0.5;
  let base = floor(position);
  let blend = fract(position);
  let top = mix(resolve_probe(base), resolve_probe(base + vec2f(1.0, 0.0)), blend.x);
  let bottom = mix(resolve_probe(base + vec2f(0.0, 1.0)), resolve_probe(base + vec2f(1.0)), blend.x);
  return mix(top, bottom, blend.y);
}

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return vec4f(resolve_cascade0(uv * irradiance.size.xy), 1.0);
}
