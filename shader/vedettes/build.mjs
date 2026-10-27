// Compile vedettes.js pour le navigateur : Three.js est inclus, réduit à ce qui sert.
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const ici = fileURLToPath(new URL('.', import.meta.url));
const site = process.argv[2];
if (!site) throw new Error('usage : node build.mjs <dossier du site>');

await build({
  entryPoints: [ici + 'vedettes.js'],
  bundle: true,
  format: 'esm',
  minify: true,
  target: 'es2020',
  outfile: site + '/js/vedettes3d.js',
  logLevel: 'warning',
});
console.log('vedettes3d.js compilé');
