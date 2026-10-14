// Le motif field. dessiné mathématiquement : neuf points en carré et la lumière du curseur.
// Renvoie la lumière émise (HDR linéaire) et un masque d'obstacle.
// aa : demi-largeur de l'anticrénelage, en pixels de scène.

fn smootherstep01(value: f32) -> f32 {
  let x = clamp(value, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// La vague part du centre, gagne les milieux des côtés, puis les coins.
fn wave(row: i32, column: i32, time: f32) -> f32 {
  let ring = f32(abs(row - 1) + abs(column - 1));
  let phase = fract(time / 2.5);
  let reached = smootherstep01((phase - 0.06 - ring * 0.13) / 0.2);
  let fade = 1.0 - smootherstep01((phase - 0.7) / 0.2);
  return reached * fade;
}

export fn field_emitter(
  pixel: vec2f,
  center: vec2f,
  spacing: f32,
  radius: f32,
  time: f32,
  pointer: vec2f,
  pointer_radius: f32,
  pointer_power: f32,
  aa: f32,
  // part du rayon sur laquelle le bord des points s'estompe ; 0 : bord net
  softness: f32,
) -> vec4f {
  var result = vec4f(0.0);
  // #0071BB, en lumière linéaire
  let blue = vec3f(0.0, 0.12, 0.5);

  for (var row = 0; row < 3; row = row + 1) {
    for (var column = 0; column < 3; column = column + 1) {
      let dot_center = center + vec2f(f32(column - 1), f32(row - 1)) * spacing;
      let signed_distance = distance(pixel, dot_center) - radius;
      let mask = 1.0 - smoothstep(-max(aa, radius * softness), aa, signed_distance);
      let emission = mix(0.3, 4.2, wave(row, column, time));
      result = max(result, vec4f(blue * emission * mask, mask));
    }
  }

  let pointer_distance = distance(pixel, pointer) - pointer_radius;
  let pointer_mask = 1.0 - smoothstep(-aa, aa, pointer_distance);
  let white = vec3f(0.95, 0.97, 1.0) * pointer_power;
  return max(result, vec4f(white * pointer_mask, pointer_mask));
}
