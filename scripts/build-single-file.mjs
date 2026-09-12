/* Склейка основного приложения в один самодостаточный index.html.
   Запуск: node scripts/build-single-file.mjs
   Результат: variants/v2-single-file/index.html
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const src = path.join(root, 'index.html');
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const jsOrder = ['js/data.js', 'js/nutrition.js', 'js/menu.js', 'js/shopping.js', 'js/app.js'];
const js = jsOrder.map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n\n');

let html = fs.readFileSync(src, 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/, `<style>\n${css}\n</style>`);
for (const f of jsOrder) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  html = html.replace(new RegExp(`<script src="${f.replaceAll('/', '\\/')}"><\\/script>`), `<script>\n${code}\n</script>`);
}

const outDir = path.join(root, 'variants', 'v2-single-file');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
console.log('OK →', path.join('variants', 'v2-single-file', 'index.html'), `(${Math.round(html.length / 1024)} КБ)`);