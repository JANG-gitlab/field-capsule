// Assemble les shaders (ils s'importent entre eux), puis compile l'effet pour le navigateur
// et le script de rendu vidéo pour Node.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { build } from "esbuild";

const ici = fileURLToPath(new URL(".", import.meta.url));
const site = process.argv[2];
if (!site) throw new Error("usage : node build.mjs <dossier du site>");

const entrees = {
  fieldDots: "arc/field-dots.wgsl",
  jfaInit: "arc/jfa-init.wgsl",
  jfaPass: "arc/jfa-pass.wgsl",
  sdfFinalize: "arc/sdf-finalize.wgsl",
  radianceCascade: "arc/radiance-cascade.wgsl",
  fieldIrradiance: "arc/field-irradiance.wgsl",
  present: "arc/field-present.wgsl",
};

let module = "";
for (const [nom, fichier] of Object.entries(entrees)) {
  const resolu = await resolveShader({ entry: ici + fichier });
  module += `export const ${nom} = ${JSON.stringify(resolu.wgsl)};\n`;
}
writeFileSync(ici + "shaders.gen.ts", module);

mkdirSync(site + "/js", { recursive: true });
await build({
  entryPoints: [ici + "lumiere.ts"],
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2020",
  outfile: site + "/js/lumiere.js",
  logLevel: "warning",
});
await build({
  entryPoints: [ici + "fixe.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: ici + "fixe.mjs",
  // seul le nom exact « vgpu » bascule sur la version Node, pas ses sous-chemins
  plugins: [{ name: "vgpu-node", setup(b) { b.onResolve({ filter: /^vgpu$/ }, () => ({ path: "vgpu/node", external: true })); } }],
  external: ["pngjs", "vgpu/node", "webgpu"],
  logLevel: "warning",
});
console.log("shaders assemblés, lumiere.js et fixe.mjs compilés");
