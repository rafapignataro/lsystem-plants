#!/usr/bin/env node
/** Compara a massa desta branch com a de origin/main. Falha se o tronco
 *  ficar mais fino ou se a folhagem / os galhos caírem de 90% do main. */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { BONSAI, SPECIES, buildSkeletonPackage } from '../lsystem-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mainDir = '/tmp/lsystem-plants-main';
const seed = 'lindenmayer';

if (!existsSync(join(mainDir, 'lsystem-core.mjs'))) {
  execSync(`git worktree add --detach ${mainDir} origin/main`, { cwd: root, stdio: 'inherit' });
} else {
  execSync('git fetch origin main', { cwd: mainDir, stdio: 'ignore' });
  execSync('git checkout --detach origin/main', { cwd: mainDir, stdio: 'ignore' });
}

const mainMod = await import(pathToFileURL(join(mainDir, 'lsystem-core.mjs')).href);
const mainBuild = mainMod.buildSkeletonPackage;
const mainSpecies = mainMod.SPECIES;

function axis(sk) {
  const kids = Array.from({ length: sk.N }, () => []);
  for (let i = 1; i < sk.N; i++) if (sk.PAR[i] >= 0) kids[sk.PAR[i]].push(i);
  const sub = new Int32Array(sk.N);
  for (let i = sk.N - 1; i >= 0; i--) {
    sub[i] = 1;
    for (const c of kids[i]) sub[i] += sub[c];
  }
  const trunk = [0];
  const on = new Uint8Array(sk.N);
  on[0] = 1;
  let i = 0, guard = 0;
  while (kids[i].length && guard++ < sk.N) {
    let best = kids[i][0];
    for (const c of kids[i]) if (sub[c] > sub[best]) best = c;
    trunk.push(best);
    on[best] = 1;
    i = best;
  }
  let branches = 0;
  let primaries = 0;
  let depth = 0;
  const stack = [[0, 0]];
  while (stack.length) {
    const [q, d] = stack.pop();
    if (d > depth) depth = d;
    for (const c of kids[q]) {
      stack.push([c, d + 1]);
      if (!on[c]) branches++;
    }
  }
  for (const ti of trunk) for (const c of kids[ti]) if (!on[c] && sub[c] >= 4) primaries++;
  return { trunk, branches, primaries, depth };
}

function measure(pkg) {
  const sk = pkg.sk;
  const r = pkg.rFull;
  const { trunk, branches, primaries, depth } = axis(sk);
  let H = 0;
  for (let i = 0; i < sk.N; i++) if (sk.Y[i] > H) H = sk.Y[i];
  let base = 0;
  for (const i of trunk) {
    if (sk.Y[i] >= 0 && sk.Y[i] <= Math.max(0.06, H * 0.1) && r[i] > base) base = r[i];
  }
  if (!(base > 0)) base = r[trunk[1]] || r[trunk[0]] || 0;
  let volume = 0;
  for (let t = 1; t < trunk.length; t++) {
    const a = trunk[t - 1], b = trunk[t];
    const len = Math.hypot(sk.X[b] - sk.X[a], sk.Y[b] - sk.Y[a], sk.Z[b] - sk.Z[a]);
    const rr = (r[a] + r[b]) * 0.5;
    volume += rr * rr * len;
  }
  let foliage = 0;
  for (const k of ['leaf', 'needles', 'petal', 'center']) foliage += (pkg.inst[k] || []).length;
  const pts = [];
  for (const k of ['leaf', 'needles', 'petal']) for (const it of pkg.inst[k] || []) if (it.p) pts.push(it.p);
  const cell = Math.max(0.05, H / 18);
  const occ = new Set(pts.map((p) => `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`));
  const seen = new Set();
  let pads = 0;
  const neigh = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const key of occ) {
    if (seen.has(key)) continue;
    pads++;
    const st = [key];
    seen.add(key);
    while (st.length) {
      const cur = st.pop();
      const [x, y, z] = cur.split(',').map(Number);
      for (const d of neigh) {
        const nk = `${x + d[0]},${y + d[1]},${z + d[2]}`;
        if (occ.has(nk) && !seen.has(nk)) { seen.add(nk); st.push(nk); }
      }
    }
  }
  return {
    base: base * 2,
    volume,
    foliage,
    branches,
    primaries,
    depth,
    pads,
    nodes: sk.N,
  };
}

const jobs = [];
for (const id of BONSAI) jobs.push([id, null]);
for (const st of SPECIES.junipero.styles) if (st !== SPECIES.junipero.defaultStyle) jobs.push(['junipero', st]);
for (const st of SPECIES.olmo_chines.styles) if (st !== SPECIES.olmo_chines.defaultStyle) jobs.push(['olmo_chines', st]);

const num = (x) => (x >= 100 ? x.toFixed(1) : x.toFixed(3));
const pct = (a, b) => (b ? (100 * a / b).toFixed(0) + '%' : '—');
let failed = 0;
console.log('espécie          estilo       base cmpr   vol cmpr    folhas cmpr   galhos cmpr  prof  pads');
for (const [id, style] of jobs) {
  const opts = { sim: true, style };
  const cur = measure(buildSkeletonPackage(id, seed, opts, {}, null));
  const old = measure(mainBuild(id, seed, opts, {}, null));
  const styleName = style || (SPECIES[id] || mainSpecies[id]).defaultStyle;
  const baseOk = cur.base >= old.base * 0.995;
  const volOk = cur.volume >= old.volume * 0.995;
  const folOk = cur.foliage >= old.foliage * 0.9;
  const brOk = cur.branches >= old.branches * 0.9;
  const ok = baseOk && volOk && folOk && brOk;
  if (!ok) failed++;
  const flag = ok ? 'ok' : 'FALHA';
  console.log(
    `${id.padEnd(16)} ${styleName.padEnd(12)} ${num(cur.base)}/${num(old.base)} ${pct(cur.base, old.base).padStart(4)}  `
    + `${num(cur.volume)}/${num(old.volume)} ${pct(cur.volume, old.volume).padStart(4)}  `
    + `${String(cur.foliage).padStart(6)}/${String(old.foliage).padStart(6)} ${pct(cur.foliage, old.foliage).padStart(4)}  `
    + `${String(cur.branches).padStart(5)}/${String(old.branches).padStart(5)} ${pct(cur.branches, old.branches).padStart(4)}  `
    + `${cur.depth}/${old.depth}  ${cur.pads}/${old.pads}  ${flag}`,
  );
}
if (failed) {
  console.error(`\n${failed} combinação(ões) abaixo do main (tronco) ou de 90% (folhagem, galhos).`);
  process.exit(1);
}
console.log('\ntodas as combinações mantêm o tronco e pelo menos 90% da folhagem e dos galhos do main.');
