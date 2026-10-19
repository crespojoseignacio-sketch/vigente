// Genera los íconos y la vista previa para WhatsApp (og.png) con Chromium (Playwright).
// Uso: NODE_PATH=$(npm root -g) node scripts/brand/render.mjs   (una vez; los PNG quedan en static/)
// La marca: la perilla de las cuotas. Doce segmentos, seis en azafrán: «va por la cuota 6 de 12».
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = createRequire(import.meta.url)('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const icons = join(root, 'static', 'icons');
mkdirSync(icons, { recursive: true });

const C = { ink: '#2A1F2D', track: '#5A4A5E', saffron: '#E9A23B', cream: '#F6F1EA', tile: '#E9EFEC', basil: '#2E6A4F' };
// Anillo de n segmentos con k pintados, centrado en (cx, cy).
function anillo(cx, cy, r, w, n, k) {
  const L = 2 * Math.PI * r, gap = r * 0.11, seg = L / n - gap;
  const pint = Array.from({ length: k }, () => `${seg.toFixed(2)} ${gap.toFixed(2)}`).join(' ') + ` 0 ${L.toFixed(2)}`;
  return `<g transform="rotate(-90 ${cx} ${cy})"><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.track}" stroke-width="${w}" stroke-dasharray="${seg.toFixed(2)} ${gap.toFixed(2)}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.saffron}" stroke-width="${w}" stroke-dasharray="${pint}"/></g>`;
}
const icon = ({ rx = 112, pad = 0 } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${rx}" fill="${C.ink}"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">${anillo(256, 256, 152, 56, 12, 6)}<circle cx="256" cy="256" r="62" fill="${C.cream}"/></g></svg>`;

const og = `<!doctype html><html><head>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@600;700&family=Young+Serif&display=swap" rel="stylesheet">
<style>
  *{margin:0;box-sizing:border-box} body{width:1200px;height:630px;overflow:hidden;background:${C.tile};color:${C.ink};font-family:'Atkinson Hyperlegible Next',sans-serif;position:relative}
  .brand{position:absolute;left:80px;top:64px;display:flex;align-items:center;gap:18px;font:400 44px/1 'Young Serif'}
  h1{position:absolute;left:80px;top:160px;width:620px;font:400 86px/1.02 'Young Serif';letter-spacing:-2px}
  p{position:absolute;left:84px;top:470px;width:600px;font:600 30px/1.3 'Atkinson Hyperlegible Next';color:#4e4452}
  .card{position:absolute;right:70px;top:120px;width:400px;padding:30px;border-radius:30px;background:#fff;border:2px solid #d3dcd8;transform:rotate(-2.5deg)}
  .row{display:flex;gap:20px;align-items:center}
  .row b{display:block;font:400 34px/1.15 'Young Serif'}
  .row span{display:block;font:700 22px/1.3 'Atkinson Hyperlegible Next'}
  .msg{margin-top:22px;padding:18px 20px;border-radius:6px 22px 22px 22px;background:#f1f5f3;font:600 21px/1.4 'Atkinson Hyperlegible Next'}
  .btn{margin-top:22px;height:70px;border-radius:18px;background:${C.basil};color:#fff;display:grid;place-items:center;font:700 26px/1 'Atkinson Hyperlegible Next'}
</style></head><body>
  <div class="brand"><svg width="64" height="64" viewBox="0 0 512 512">${icon().replace(/<\/?svg[^>]*>/g, '')}</svg>Vigente</div>
  <h1>A quién escribirle hoy.</h1>
  <p>Consultas, ventas y cuotas de tus clientas, con el mensaje listo para WhatsApp.</p>
  <div class="card"><div class="row"><svg width="92" height="92" viewBox="0 0 56 56"><circle cx="28" cy="28" r="27" fill="#f1f5f3"/>${anillo(28, 28, 23, 5.5, 12, 6).replace(new RegExp(C.track, 'g'), '#d8e1dd').replace(new RegExp(C.saffron, 'g'), '#E09A2F')}<text x="28" y="34" text-anchor="middle" font-family="Young Serif" font-size="19" fill="${C.ink}">6</text></svg>
    <div><b>Marta Gómez</b><span>Va por la cuota 6 de 12</span></div></div>
    <div class="msg">¡Hola Marta! ¿Qué tal la cacerola? Te cuento que hay promos nuevas…</div><div class="btn">Escribirle</div></div>
</body></html>`;

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch({ proxy });
const page = await browser.newPage();
async function png(svg, size, file) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: join(icons, file), omitBackground: true });
}
await png(icon(), 512, 'icon-512.png');
await png(icon(), 192, 'icon-192.png');
await png(icon({ rx: 0, pad: 72 }), 512, 'icon-maskable-512.png');
await png(icon({ rx: 0 }), 180, 'apple-touch-icon.png');
await png(icon({ rx: 120 }), 64, 'favicon.png');
writeFileSync(join(icons, 'favicon.svg'), icon({ rx: 120 }));
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: join(root, 'static', 'og.png') });
await browser.close();
console.log('Íconos y og.png listos en static/');
