// Passe d'émission : le motif à la résolution de la scène, pour le calcul de la lumière.
import { field_emitter } from "./field-shape.wgsl";

struct Field {
  size: vec2f,
  center: vec2f,
  pointer: vec2f,
  time: f32,
  spacing: f32,
  radius: f32,
  pointer_radius: f32,
  pointer_power: f32,
};

@group(0) @binding(0) var<uniform> field: Field;

@fragment
fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  return field_emitter(
    uv * field.size,
    field.center,
    field.spacing,
    field.radius,
    field.time,
    field.pointer,
    field.pointer_radius,
    field.pointer_power,
    0.8,
    // la lumière part de points nets ; seul l'affichage peut estomper leur bord
    0.0,
  );
}
