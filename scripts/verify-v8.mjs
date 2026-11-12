#!/usr/bin/env node
/** Verificação v8: console limpo, build, determinismo, FPS aproximado */
import { spawn } from 'child_process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, writeFile } from 'fs/promises';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = 8770 + Math.floor(Math.random() * 200);
const base = `http://127.0.0.1:${port}/index.html`;

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 900));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const species = ['bordo', 'pinheiro_branco', 'cipreste', 'junipero', 'olmo_chines', 'ficus'];
const shots = join(root, 'screenshots/v8');
await mkdir(shots, { recursive: true });

const results = { builds: {}, determinism: {}, fps: {} };

async function waitPlant(n = 1) {
  await page.waitForFunction((k) => (window.__lsys?.plants?.length || 0) >= k, n, { timeout: 180000 });
  await page.waitForTimeout(400);
}

for (const sp of species) {
  await page.goto(`${base}?nogrow&norotate#especie=${sp}&seed=lindenmayer`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitPlant();
  const stats = await page.evaluate(() => window.__lsys?.plants?.[0]?.stats);
  results.builds[sp] = stats?.ms;
  await page.screenshot({ path: join(shots, `${sp}.png`) });
  const h1 = await page.evaluate(() => {
    const sk = window.__lsys.plants[0].sk;
    return window.__lsys.hex(JSON.stringify([...sk.X.slice(0, 20), ...sk.Y.slice(0, 20)]));
  });
  await page.goto(`${base}?nogrow&norotate#especie=${sp}&seed=lindenmayer`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await waitPlant();
  const h2 = await page.evaluate(() => {
    const sk = window.__lsys.plants[0].sk;
    return window.__lsys.hex(JSON.stringify([...sk.X.slice(0, 20), ...sk.Y.slice(0, 20)]));
  });
  results.determinism[sp] = h1 === h2;
}

await page.goto(`${base}?nogrow&norotate#especie=carvalho&seed=rafael`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await waitPlant();
const fallback = await page.evaluate(() => ({
  id: window.__lsys?.plants?.[0]?.id,
  title: document.title,
  h1: document.querySelector('h1')?.textContent || '',
}));
if (fallback.id !== 'bordo') errors.push('fallback esperado bordo, veio ' + fallback.id);
if (!/Bonsai Garden/.test(fallback.title) || !/Bonsai Garden/.test(fallback.h1)) errors.push('título sem Bonsai Garden: ' + fallback.title + ' / ' + fallback.h1);

await page.goto(`${base}?nogrow&norotate#especie=jardim&seed=rafael`, { waitUntil: 'domcontentloaded', timeout: 300000 });
await waitPlant(species.length);
const garden = await page.evaluate(() => ({
  n: window.__lsys?.plants?.length || 0,
  cap: document.getElementById('capT')?.textContent || '',
}));
if (garden.n !== species.length) errors.push('jardim com ' + garden.n + ' plantas');
if (!/Bonsai Garden/.test(garden.cap)) errors.push('legenda do jardim: ' + garden.cap);
await page.screenshot({ path: join(shots, 'jardim.png'), fullPage: false });
const t0 = performance.now();
for (let i = 0; i < 30; i++) await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
results.fps.garden = 30 / ((performance.now() - t0) / 1000);

server.kill();
await browser.close();

const report = { errors, results, ok: errors.length === 0 && Object.values(results.determinism).every(Boolean) };
await writeFile(join(shots, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
