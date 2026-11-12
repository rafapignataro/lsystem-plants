#!/usr/bin/env node
/** Fotos do gerador de flores: botão, grade, copa, árvores e o GIF. */
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'screenshots/flores');
await mkdir(out, { recursive: true });

function serve(dir, port) {
  const child = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {
    cwd: dir, stdio: 'ignore',
  });
  return child;
}

const port = 8791;
const mainPort = 8792;
const server = serve(root, port);
const mainDir = '/tmp/lsystem-plants-main';
let mainServer = null;
if (existsSync(join(mainDir, 'index.html'))) mainServer = serve(mainDir, mainPort);
await new Promise((r) => setTimeout(r, 600));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--disable-http-cache'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 960 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(180000);
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });

async function boot(base, hash) {
  await page.goto(`${base}?nogrow&norotate&shot&hi${hash}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => (window.__lsys?.plants?.length || 0) >= 1, null, { timeout: 180000 });
}

async function studio(seed, bloom, file, zoom = 0, side = false) {
  await page.evaluate(({ seed, bloom, zoom, side }) => {
    const L = window.__lsys;
    L.SHARED.uWind.value = 0;
    L.showFlowerStudio([{ seed }], bloom);
    const target = L.controls.target;
    const d = L.camera.position.clone().sub(target);
    const dist = (zoom > 0 ? d.length() * zoom : d.length());
    if (side) {
      const dir = d.set(0.85, 0.36, 1).normalize();
      L.camera.position.copy(target).addScaledVector(dir, dist);
      L.camera.lookAt(target);
    } else if (zoom > 0) {
      L.camera.position.copy(target).addScaledVector(d.normalize(), dist);
    }
    L.controls.update();
    L.renderStill();
  }, { seed, bloom, zoom, side });
  await page.screenshot({ path: join(out, file), animations: 'disabled', timeout: 120000 });
}

const base = `http://127.0.0.1:${port}/index.html`;
if (process.env.SKIP_STUDIO !== '1') {
await boot(base, '#especie=bordo&seed=lindenmayer');

const hero = 'realismo-10';
await studio(hero, 0, 'flor-bloom-0.png', 0.38, true);
await studio(hero, 0.3, 'flor-bloom-03.png', 0.58, true);
await studio(hero, 0.6, 'flor-bloom-06.png', 0.82, true);
await studio(hero, 1, 'flor-bloom-1.png', 1, true);

const gridSeeds = [
  'realismo-8', 'realismo-10', 'realismo-17', 'realismo-4',
  'realismo-1', 'realismo-3', 'realismo-0', 'realismo-7',
  'realismo-15', 'realismo-12', 'realismo-30', 'realismo-21',
];
for (let i = 0; i < gridSeeds.length; i++) {
  await studio(gridSeeds[i], 1, `grade-flor-${String(i).padStart(2, '0')}.png`);
}
execSync(`ffmpeg -y -framerate 1 -i ${join(out, 'grade-flor-%02d.png')} -frames:v 1 -update 1 -vf tile=4x3:padding=8:color=0xD0D0D0 ${join(out, 'grade-flores.png')}`, { stdio: 'inherit' });
}

if (process.env.SKIP_HEAVY === '1') {
  console.log(JSON.stringify({ skipped: true, errors: errors.slice(0, 8) }, null, 2));
  await browser.close();
  server.kill();
  if (mainServer) mainServer.kill();
  process.exit(errors.length ? 1 : 0);
}

if (process.env.FROM !== 'fps') {
await page.setViewportSize({ width: 1100, height: 820 });
await boot(base, '#especie=azaleia&seed=realismo-0');
await page.evaluate(() => {
  document.getElementById('panel').style.display = 'none';
  const cap = document.getElementById('caption');
  if (cap) cap.style.display = 'none';
  const t = document.getElementById('toggle');
  if (t) t.style.display = 'none';
  const L = window.__lsys;
  L.aimCanopy();
  const d = L.camera.position.clone().sub(L.controls.target);
  const dist = d.length() * 1.15;
  L.camera.position.copy(L.controls.target).addScaledVector(d.normalize(), dist);
  L.controls.update();
  L.setBloom(1);
  L.renderStill();
});
await page.screenshot({ path: join(out, 'copa-depois.png'), animations: 'disabled', timeout: 180000 });

const frames = [];
for (let i = 0; i <= 10; i++) {
  const b = i / 10;
  await page.evaluate((b) => { window.__lsys.setBloom(b); window.__lsys.renderStill(); }, b);
  const name = `floracao-${String(i).padStart(2, '0')}.png`;
  frames.push(name);
  await page.screenshot({ path: join(out, name), animations: 'disabled', timeout: 180000 });
}
execSync(`ffmpeg -y -framerate 6 -i ${join(out, 'floracao-%02d.png')} -vf "scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse" ${join(out, 'floracao.gif')}`, { stdio: 'inherit' });

if (process.env.FROM === 'bloom') {
  if (mainServer) {
    const mainBase = `http://127.0.0.1:${mainPort}/index.html`;
    await page.goto(`${mainBase}?nogrow&norotate&shot#especie=azaleia&seed=realismo-0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction(() => (window.__lsys?.plants?.length || 0) >= 1, null, { timeout: 180000 });
    await page.evaluate(() => {
      const L = window.__lsys;
      const box = L.plants[0].box;
      const size = box.getSize(new L.camera.position.constructor());
      const tx = (box.min.x + box.max.x) / 2;
      const ty = box.min.y + size.y * 0.7;
      const tz = (box.min.z + box.max.z) / 2;
      document.getElementById('panel').style.display = 'none';
      const cap = document.getElementById('caption');
      if (cap) cap.style.display = 'none';
      L.camera.fov = 30;
      L.camera.near = 0.02;
      L.controls.target.set(tx, ty, tz);
      L.camera.position.set(tx + size.x * 0.16, ty + size.y * 0.28, box.max.z + size.z * 0.85);
      const d = L.camera.position.clone().sub(L.controls.target);
      const dist = d.length() * 1.15;
      L.camera.position.copy(L.controls.target).addScaledVector(d.normalize(), dist);
      L.camera.lookAt(tx, ty, tz);
      L.camera.updateProjectionMatrix();
      L.controls.update();
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(out, 'copa-antes.png'), animations: 'disabled', timeout: 180000 });
  }
  console.log(JSON.stringify({ bloom: true, errors: errors.slice(0, 8) }, null, 2));
  await browser.close();
  server.kill();
  if (mainServer) mainServer.kill();
  process.exit(errors.length ? 1 : 0);
}

await page.setViewportSize({ width: 720, height: 900 });
for (let i = 0; i < 12; i++) {
  await boot(base, `#especie=azaleia&seed=realismo-${i}`);
  await page.evaluate(() => window.__lsys.frameFill());
  await page.screenshot({ path: join(out, `arvore-${String(i).padStart(2, '0')}.png`), animations: 'disabled', timeout: 180000 });
}
execSync(`ffmpeg -y -framerate 1 -i ${join(out, 'arvore-%02d.png')} -frames:v 1 -update 1 -vf tile=4x3:padding=6:color=0xE4E7DF ${join(out, 'grade-arvores.png')}`, { stdio: 'inherit' });
}

async function measureFps(url) {
  process.stderr.write(`fps ${url}\n`);
  const p = await browser.newPage({ viewport: { width: 1100, height: 820 }, deviceScaleFactor: 1 });
  p.setDefaultTimeout(180000);
  p.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));
  await p.route('**/index.html*', async (route) => {
    const res = await route.fetch();
    const body = (await res.text()).replace('sun.castShadow = true', 'sun.castShadow = false');
    await route.fulfill({ response: res, body });
  });
  try {
    await p.goto(url, { waitUntil: 'commit', timeout: 90000 });
    await p.waitForFunction((n) => (window.__lsys?.plants?.length || 0) >= n, url.includes('jardim') ? 8 : 1, { timeout: 420000 });
    await p.waitForTimeout(400);
    const fpsN = await p.evaluate(() => new Promise((resolve) => {
      let n = 0;
      const t0 = performance.now();
      const tick = () => {
        n++;
        if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
        else resolve(Math.round((n / ((performance.now() - t0) / 1000)) * 10) / 10);
      };
      requestAnimationFrame(tick);
    }));
    process.stderr.write(`fps-result ${url.includes('8792') ? 'antes' : 'depois'} ${url.includes('jardim') ? 'jardim' : 'azaleia'} ${fpsN}\n`);
    return fpsN;
  } finally {
    await p.close();
  }
}

const fps = {};
fps.azaleia = await measureFps(`${base}?nogrow&norotate&pass=azaleia#especie=azaleia&seed=realismo-0`);
fps.jardim = await measureFps(`${base}?nogrow&norotate&pass=jardim#especie=jardim&seed=realismo-0`);

let fpsMain = null;
if (mainServer) {
  const mainBase = `http://127.0.0.1:${mainPort}/index.html`;
  await page.setViewportSize({ width: 1100, height: 820 });
  await page.goto(`${mainBase}?nogrow&norotate#especie=azaleia&seed=realismo-0`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => (window.__lsys?.plants?.length || 0) >= 1, null, { timeout: 180000 });
  await page.evaluate(() => {
    const L = window.__lsys;
    const pl = L.plants[0];
    const box = pl.box;
    const size = box.getSize(new L.camera.position.constructor());
    const tx = (box.min.x + box.max.x) / 2;
    const ty = box.min.y + size.y * 0.7;
    const tz = (box.min.z + box.max.z) / 2;
    document.getElementById('panel').style.display = 'none';
    const cap = document.getElementById('caption');
    if (cap) cap.style.display = 'none';
    L.camera.fov = 30;
    L.camera.near = 0.02;
    L.camera.position.set(tx + size.x * 0.16, ty + size.y * 0.28, box.max.z + size.z * 0.85);
    L.controls.target.set(tx, ty, tz);
    const pull = L.camera.position.clone().sub(L.controls.target);
    const pullDist = pull.length() * 1.15;
    L.camera.position.copy(L.controls.target).addScaledVector(pull.normalize(), pullDist);
    L.camera.lookAt(tx, ty, tz);
    L.camera.updateProjectionMatrix();
    L.controls.update();
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, 'copa-antes.png'), animations: 'disabled', timeout: 180000 });
  fpsMain = {
    azaleia: await measureFps(`${mainBase}?nogrow&norotate&pass=azaleia#especie=azaleia&seed=realismo-0`),
    jardim: await measureFps(`${mainBase}?nogrow&norotate&pass=jardim#especie=jardim&seed=realismo-0`),
  };
}

const report = { fpsDepois: fps, fpsAntes: fpsMain, errors: errors.slice(0, 12), hero, gridSeeds };
await writeFile(join(out, 'fps.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
server.kill();
if (mainServer) mainServer.kill();
if (errors.length) process.exitCode = 1;
