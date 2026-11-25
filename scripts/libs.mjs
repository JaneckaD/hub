// Připraví knihovny Konvertoru do složky lib/ (spouští se jednou, výsledek je v repozitáři).
// Spuštění: npm i --no-save esbuild @ffmpeg/core@0.12.10 @ffmpeg/ffmpeg@0.12.15 pdfjs-dist@4.10.38 mammoth@1.13.0 marked@15 fflate@0.8.3 heic-to@1.6.7 pdf-lib@1.17.1 xlsx@0.18.5
//           node scripts/libs.mjs <cílová složka lib>
import { build } from 'esbuild';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
const out = process.argv[2] || 'lib';
mkdirSync(out + '/ffmpeg', { recursive: true }); mkdirSync(out + '/ffmpeg-core', { recursive: true });
for (const f of readdirSync('node_modules/@ffmpeg/ffmpeg/dist/esm')) if (/\.m?js$/.test(f)) cpSync('node_modules/@ffmpeg/ffmpeg/dist/esm/' + f, `${out}/ffmpeg/${f}`);
for (const f of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) cpSync('node_modules/@ffmpeg/core/dist/esm/' + f, `${out}/ffmpeg-core/${f}`);
// heic-to má zvláštní sestavení, které funguje i s přísnými bezpečnostními pravidly stránky (CSP)
cpSync('node_modules/heic-to/dist/csp/heic-to.min.js', `${out}/heic.js`);
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) cpSync('node_modules/pdfjs-dist/build/' + f, `${out}/${f}`);
const entries = {
  pdflib: `export { PDFDocument } from 'pdf-lib';`,
  mammoth: `import m from 'mammoth/mammoth.browser.js'; export default m;`,
  marked: `export { marked } from 'marked';`,
  fflate: `export { zipSync } from 'fflate';`,
  xlsx: `export * from 'xlsx';`,
};
for (const [name, contents] of Object.entries(entries)) {
  await build({ stdin: { contents, resolveDir: process.cwd() }, bundle: true, format: 'esm', minify: true, target: 'es2020',
    legalComments: 'none', outfile: `${out}/${name}.js`, define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' }, logLevel: 'warning' });
}
