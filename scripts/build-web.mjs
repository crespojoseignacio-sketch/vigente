// Arma la app publicable en dist/: una hoja de estilos y un solo script con nombre por contenido
// (así el celular nunca se queda con una versión vieja), más íconos, manifiesto y service worker.
// Uso: node scripts/build-web.mjs          (lo corre Vercel)
//      node scripts/build-web.mjs --demo   (sin base: solo el ejemplo, todo en el navegador)
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const read = p => readFileSync(join(root, p), 'utf8');
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 10);

const demo = process.argv.includes('--demo');
const cfg = demo ? {} : {
  supabaseUrl: process.env.SUPABASE_URL || config.supabaseUrl,
  supabaseKey: process.env.SUPABASE_ANON_KEY || config.supabaseKey,
  publicOrigin: process.env.PUBLIC_ORIGIN || config.publicOrigin || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : ''),
};
const js = [
  `window.VIGENTE_CONFIG = ${JSON.stringify(cfg)};`,
  read('src/logic.js'),
  read('src/store.js'),
  read('src/app.js'),
].join('\n;\n');
const css = read('src/styles.css') + '\n' + read('src/temas.css');
const jsName = `assets/app.${hash(js)}.js`;
const cssName = `assets/app.${hash(css)}.css`;

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, jsName), js);
writeFileSync(join(out, cssName), css);
writeFileSync(join(out, 'index.html'), read('index.html').replace('%JS%', jsName).replace('%CSS%', cssName).replaceAll('%ORIGIN%', cfg.publicOrigin || ''));
if (existsSync(join(root, 'static'))) cpSync(join(root, 'static'), out, { recursive: true });
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, 'manifest.webmanifest'), JSON.stringify({
  name: 'Vigente', short_name: 'Vigente', lang: 'es-AR', start_url: '/', scope: '/', display: 'standalone',
  description: 'A quién escribirle hoy: consultas, ventas y cuotas de tus clientas.',
  background_color: '#2A1F2D', theme_color: '#2A1F2D',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Anotar una consulta', short_name: 'Consulta', url: '/?anotar=consulta' },
    { name: 'Anotar una venta', short_name: 'Venta', url: '/?anotar=venta' },
  ],
}, null, 2));
// Service worker mínimo: hace que la app se pueda instalar. No guarda datos en caché (siempre vienen de la base).
writeFileSync(join(out, 'sw.js'), "self.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', e => e.waitUntil(self.clients.claim()));\nself.addEventListener('fetch', () => {});\n");
console.log(`Vigente lista en dist/ (${jsName}, ${cssName})${cfg.supabaseUrl ? '' : ' en modo ejemplo'}`);
