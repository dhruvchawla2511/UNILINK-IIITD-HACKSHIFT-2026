import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
for (const dir of ['server','scripts']) {
  const walk = (d) => { for (const ent of fs.readdirSync(d,{withFileTypes:true})) { const full=path.join(d,ent.name); if(ent.isDirectory()) walk(full); else if(full.endsWith('.js') || full.endsWith('.mjs')) files.push(full); } };
  walk(path.join(root,dir));
}
let failed=false;
for (const file of files) { const r=spawnSync(process.execPath,['--check',file],{stdio:'inherit'}); if(r.status!==0) failed=true; }
if(failed) process.exit(1);
console.log(`Syntax checks passed for ${files.length} server/script files.`);
// PWA safety checks: shell assets are installable, but private API responses must never be cached.
const manifestPath = path.join(root, 'public', 'manifest.webmanifest');
const workerPath = path.join(root, 'public', 'sw.js');
const htmlPath = path.join(root, 'index.html');
try {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const worker = fs.readFileSync(workerPath, 'utf8');
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!manifest.name || !manifest.start_url || !Array.isArray(manifest.icons) || manifest.icons.length < 1) throw new Error('PWA manifest is missing required install metadata.');
  if (!html.includes('rel=\"manifest\"')) throw new Error('index.html does not link the PWA manifest.');
  if (!worker.includes("url.pathname.startsWith('/api/')")) throw new Error('Service worker must explicitly bypass API responses.');
  if (!worker.includes("request.method !== 'GET'")) throw new Error('Service worker must bypass non-GET requests.');
  console.log('PWA checks passed: manifest, install metadata, and private API cache bypass.');
} catch (error) {
  console.error(`PWA check failed: ${error.message}`);
  process.exit(1);
}
