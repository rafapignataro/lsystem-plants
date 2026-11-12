#!/usr/bin/env node
/**
 * Realismo físico e botânico. Cada folha, agulha, flor e fruto tem de
 * nascer na casca do segmento a que pertence; o filho não é mais grosso
 * que o pai; a carga de folhagem não pode pender de um galho capilar;
 * tronco e raízes tocam o solo; nada atravessa o vaso, o suporte ou a mesa.
 *
 * Uso: node scripts/check-realism.mjs [--seeds 50] [--species azaleia] [--baseline]
 * --baseline mede também o origin/main (relatório "antes") e não o usa como falha.
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { BONSAI, SPECIES, buildSkeletonPackage } from '../lsystem-core.mjs';
import { auditFlower } from '../flower-engine.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SURFACE_TOL = 0.01;
const PIPE_SLACK = 1.002;
const LOAD_MAX = 9000;
const FOLIAGE = ['leaf', 'needles', 'petal', 'center', 'fruit', 'flower'];

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const seedsN = Math.max(1, parseInt(opt('--seeds', '50'), 10) || 50);
const only = opt('--species', '');
const wantBaseline = argv.includes('--baseline');

function seedsOf(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(`realismo-${i}`);
  return out;
}

function alive(it) {
  return !(it.life && it.life[1] < 1e6);
}

function jobsOf(speciesTable) {
  const jobs = [];
  for (const id of BONSAI) {
    if (only && id !== only) continue;
    const sp = speciesTable[id];
    if (!sp) continue;
    for (const style of sp.styles || [sp.defaultStyle]) jobs.push([id, style]);
  }
  return jobs;
}

function potLocal(pot, x, z) {
  const rot = pot.rot || 0;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const dx = x - (pot.ox || 0);
  const dz = z - (pot.oz || 0);
  return [dx * c - dz * s, dx * s + dz * c];
}

function ellipseE(pot, x, z) {
  const [lx, lz] = potLocal(pot, x, z);
  const a = Math.max(pot.a || 0.2, 1e-4);
  const b = Math.max(pot.b || 0.2, 1e-4);
  return (lx / a) ** 2 + (lz / b) ** 2;
}

function inSlab(pot, x, y, z) {
  if (!pot?.stand) return false;
  const sh = pot.tall ? Math.min(pot.h * 0.08, 0.1) : pot.h * 0.22;
  const top = -pot.h;
  const bot = top - sh;
  if (y > top + 0.012 || y < bot - 0.012) return false;
  const hx = pot.a * (pot.tall ? 1.08 : 1.3);
  const hz = pot.b * (pot.tall ? 1.08 : 1.35);
  const dx = x - (pot.ox || 0);
  const dz = z - (pot.oz || 0);
  return Math.abs(dx) < hx - 0.01 && Math.abs(dz) < hz - 0.01;
}

function inLeg(pot, x, y, z) {
  if (!pot?.stand) return false;
  const ox = pot.ox || 0;
  const oz = pot.oz || 0;
  const boxes = [];
  if (pot.tall) {
    const sh = Math.min(pot.h * 0.08, 0.1);
    const legH = pot.leg ?? pot.h * 1.7;
    const legT = Math.max(pot.a * 0.1, 0.055);
    const cy = -pot.h - sh - legH / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      boxes.push([ox + sx * pot.a * 0.56, cy, oz + sz * pot.b * 0.56, legT / 2, legH / 2, legT / 2]);
    }
  } else {
    const sh = pot.h * 0.22;
    const legH = pot.h * 0.55;
    const cy = -pot.h - sh - legH / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      boxes.push([ox + sx * pot.a * 1.12, cy, oz + sz * pot.b * 1.15, pot.a * 0.09, legH / 2, pot.b * 0.1]);
    }
  }
  for (const [cx, cy, cz, hx, hy, hz] of boxes) {
    if (Math.abs(x - cx) < hx - 0.008 && Math.abs(y - cy) < hy - 0.008 && Math.abs(z - cz) < hz - 0.008) return true;
  }
  return false;
}

function inPotCavity(pot, x, y, z) {
  if (!pot) return false;
  if (y >= -0.03 || y < -pot.h - 0.02) return false;
  return ellipseE(pot, x, z) < 0.9;
}

function childrenOf(sk) {
  const kids = Array.from({ length: sk.N }, () => []);
  for (let i = 1; i < sk.N; i++) {
    const p = sk.PAR[i];
    if (p >= 0 && p < sk.N) kids[p].push(i);
  }
  return kids;
}

function trunkSet(sk, kids) {
  const maxY = new Float64Array(sk.N);
  for (let i = 0; i < sk.N; i++) maxY[i] = sk.Y[i];
  for (let i = sk.N - 1; i >= 1; i--) {
    const p = sk.PAR[i];
    if (p >= 0 && maxY[i] > maxY[p]) maxY[p] = maxY[i];
  }
  const set = new Set([0]);
  let i = 0;
  let guard = 0;
  while (kids[i].length && guard++ < sk.N) {
    let best = kids[i][0];
    for (const c of kids[i]) if (maxY[c] > maxY[best]) best = c;
    set.add(best);
    i = best;
  }
  return set;
}

function surfaceGap(sk, r, it) {
  const i = it.node | 0;
  if (!(i > 0 && i < sk.N)) return Infinity;
  const p = sk.PAR[i];
  if (!(p >= 0 && p < sk.N)) return Infinity;
  if (!(r[i] > 0) || !(r[p] > 0)) return Infinity;
  const ax = sk.X[i] - sk.X[p];
  const ay = sk.Y[i] - sk.Y[p];
  const az = sk.Z[i] - sk.Z[p];
  const L2 = ax * ax + ay * ay + az * az;
  if (!(L2 > 1e-12)) {
    const radial = Math.hypot(it.p.x - sk.X[i], it.p.y - sk.Y[i], it.p.z - sk.Z[i]);
    return Math.abs(radial - r[i]);
  }
  const vx = it.p.x - sk.X[p];
  const vy = it.p.y - sk.Y[p];
  const vz = it.p.z - sk.Z[p];
  let t = (vx * ax + vy * ay + vz * az) / L2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = sk.X[p] + ax * t;
  const cy = sk.Y[p] + ay * t;
  const cz = sk.Z[p] + az * t;
  const radial = Math.hypot(it.p.x - cx, it.p.y - cy, it.p.z - cz);
  const rad = r[p] * (1 - t) + r[i] * t;
  return Math.abs(radial - rad);
}

/** Devolve contagens e até `limit` exemplos. */
export function assess(pkg, limit = 6) {
  const sk = pkg.sk;
  const r = pkg.rFull;
  const pot = pkg.pot;
  const id = pkg.id;
  const kids = childrenOf(sk);
  const trunk = trunkSet(sk, kids);
  const counts = { orphans: 0, botany: 0, pipe: 0, load: 0, clip: 0, joints: 0, soil: 0 };
  const examples = [];
  const note = (key, el, detail) => {
    counts[key]++;
    if (examples.length < limit) examples.push({ key, el, detail });
  };

  for (let i = 1; i < sk.N; i++) {
    const p = sk.PAR[i];
    if (!(r[i] > 0)) continue;
    if (!(p >= 0 && p < sk.N) || !Number.isFinite(sk.X[i])) {
      note('joints', `nó ${i}`, 'sem pai');
      continue;
    }
    if (!(r[p] > 0)) {
      note('joints', `nó ${i}`, 'pai sem madeira viva');
      continue;
    }
    if (r[i] > r[p] * PIPE_SLACK) {
      note('pipe', `nó ${i}`, `r ${r[i].toFixed(4)} > pai ${r[p].toFixed(4)}`);
    }
  }

  const direct = new Float64Array(sk.N);
  const leafNodes = new Set();
  for (const k of FOLIAGE) {
    for (const it of pkg.inst[k] || []) {
      if (!it?.p || !alive(it)) continue;
      const gap = surfaceGap(sk, r, it);
      if (!(gap <= SURFACE_TOL)) {
        note('orphans', k, `nó ${it.node | 0} afastado ${Number.isFinite(gap) ? gap.toFixed(3) : '∞'}`);
      }
      if (k === 'leaf' || k === 'needles') {
        const i = it.node | 0;
        if (i > 0) leafNodes.add(i);
      }
      if (k === 'leaf' || k === 'needles' || k === 'fruit' || k === 'center') {
        const i = it.node | 0;
        if (i > 0 && i < sk.N) direct[i] += (it.s || 0.02) ** 2;
      }
    }
  }
  const sub = Float64Array.from(direct);
  for (let i = sk.N - 1; i >= 1; i--) {
    const p = sk.PAR[i];
    if (p >= 0) sub[p] += sub[i];
  }
  for (let i = 1; i < sk.N; i++) {
    if (!(r[i] > 0) || !(sub[i] > 0)) continue;
    const load = sub[i] / (r[i] * r[i]);
    if (load > LOAD_MAX) note('load', `nó ${i}`, `carga ${load.toFixed(0)} r ${r[i].toFixed(4)}`);
  }

  if (id === 'azaleia') {
    const leafNear = (i) => {
      if (leafNodes.has(i)) return true;
      const p = sk.PAR[i];
      if (p > 0 && leafNodes.has(p)) return true;
      for (const c of kids[i] || []) if (leafNodes.has(c)) return true;
      return false;
    };
    for (const k of ['petal', 'center', 'flower']) {
      for (const it of pkg.inst[k] || []) {
        if (!it?.p || !alive(it)) continue;
        const i = it.node | 0;
        if (!(i > 0 && i < sk.N)) {
          note('botany', k, 'flor sem galho');
          continue;
        }
        if (trunk.has(i) && kids[i].length > 0) note('botany', k, `flor no tronco nó ${i}`);
        if (!leafNear(i)) note('botany', k, `flor longe das folhas nó ${i}`);
        if (kids[i].length > 0) note('botany', k, `flor fora da ponta nó ${i}`);
        if (k === 'flower' && it.y) {
          const p = sk.PAR[i];
          const tx = sk.X[i] - sk.X[p], ty = sk.Y[i] - sk.Y[p], tz = sk.Z[i] - sk.Z[p];
          const L = Math.hypot(tx, ty, tz) || 1;
          const dx = (tx / L) * 0.4, dy = 0.84, dz = (tz / L) * 0.4;
          const dn = Math.hypot(dx, dy, dz) || 1;
          const dot = (it.y.x * dx + it.y.y * dy + it.y.z * dz) / dn;
          if (it.y.y < 0.55 || dot < 0.9) note('botany', k, `flor não segue o raminho nó ${i}`);
        }
      }
    }
    for (const g of pkg.P?._flowerBook?.variants || []) {
      for (const msg of auditFlower(g)) note('botany', 'flower', msg);
    }
  } else {
    for (const k of ['petal', 'center', 'fruit', 'flower']) {
      const n = (pkg.inst[k] || []).filter((it) => it?.p && alive(it)).length;
      if (n) note('botany', k, `${n} peças numa espécie sem essa estrutura`);
    }
  }

  if (Math.abs(sk.Y[0]) > 0.03) note('soil', 'tronco', `base em y ${sk.Y[0].toFixed(3)}`);
  let touch = Math.abs(sk.Y[0]) <= 0.03 ? 1 : 0;
  for (let i = 1; i < sk.N; i++) {
    if (!(r[i] > 0)) continue;
    if (sk.Y[i] <= 0.02 && sk.Y[i] >= -0.03) touch++;
  }
  if (touch < 2) note('soil', 'raízes', 'não tocam o solo');

  const sample = (x, y, z, el) => {
    if (!pot) return;
    if (inPotCavity(pot, x, y, z)) note('clip', el, `dentro do vaso y ${y.toFixed(3)}`);
    else if (inSlab(pot, x, y, z)) note('clip', el, `dentro da mesa y ${y.toFixed(3)}`);
    else if (inLeg(pot, x, y, z)) note('clip', el, `dentro da perna y ${y.toFixed(3)}`);
  };
  for (let i = 0; i < sk.N; i++) {
    if (!(r[i] > 0)) continue;
    sample(sk.X[i], sk.Y[i], sk.Z[i], `nó ${i}`);
    const p = sk.PAR[i];
    if (!(p >= 0)) continue;
    for (const t of [0.35, 0.65]) {
      sample(
        sk.X[p] + (sk.X[i] - sk.X[p]) * t,
        sk.Y[p] + (sk.Y[i] - sk.Y[p]) * t,
        sk.Z[p] + (sk.Z[i] - sk.Z[p]) * t,
        `segmento ${p}-${i}`,
      );
    }
  }
  for (const k of FOLIAGE) {
    for (const it of pkg.inst[k] || []) {
      if (!it?.p || !alive(it)) continue;
      sample(it.p.x, it.p.y, it.p.z, k);
    }
  }
  return { counts, examples };
}

function tally(build, speciesTable, label) {
  const jobs = jobsOf(speciesTable);
  const seeds = seedsOf(seedsN);
  const rows = [];
  let failed = 0;
  const reports = [];
  for (const [id, style] of jobs) {
    const acc = { orphans: 0, botany: 0, pipe: 0, load: 0, clip: 0, joints: 0, soil: 0, seeds: 0 };
    for (const seed of seeds) {
      let pkg;
      try {
        pkg = build(id, seed, { sim: true, style }, {}, null);
      } catch (err) {
        acc.soil += 1;
        failed++;
        reports.push(`${label} ${id} ${style} seed ${seed}: exceção ${err.message}`);
        continue;
      }
      const { counts, examples } = assess(pkg);
      acc.seeds++;
      for (const k of Object.keys(acc)) if (k !== 'seeds') acc[k] += counts[k];
      const bad = Object.values(counts).some((n) => n > 0);
      if (bad) {
        failed++;
        for (const ex of examples.slice(0, 3)) {
          reports.push(`${label} ${id} / ${style} / seed ${seed}: ${ex.key} ${ex.el} — ${ex.detail}`);
        }
      }
    }
    rows.push({ id, style, ...acc });
  }
  return { rows, failed, reports };
}

function printTable(title, rows) {
  console.log(`\n${title}`);
  console.log('espécie           estilo        seeds   órfãos  botânica     cano    carga     vaso   juntas     solo');
  for (const r of rows) {
    const cell = (n) => String(n).padStart(8);
    console.log(
      `${r.id.padEnd(17)} ${String(r.style).padEnd(12)} ${String(r.seeds).padStart(5)} `
      + `${cell(r.orphans)} ${cell(r.botany)} ${cell(r.pipe)} ${cell(r.load)} ${cell(r.clip)} ${cell(r.joints)} ${cell(r.soil)}`,
    );
  }
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirect) {
const current = tally(buildSkeletonPackage, SPECIES, 'atual');
printTable(`atual (${seedsN} seeds)`, current.rows);

let baselineFail = 0;
if (wantBaseline) {
  const mainDir = '/tmp/lsystem-plants-main';
  if (!existsSync(join(mainDir, 'lsystem-core.mjs'))) {
    execSync(`git worktree add --detach ${mainDir} origin/main`, { cwd: root, stdio: 'inherit' });
  }
  const mainMod = await import(pathToFileURL(join(mainDir, 'lsystem-core.mjs')).href + `?v=${Date.now()}`);
  const base = tally(mainMod.buildSkeletonPackage, mainMod.SPECIES, 'main');
  printTable(`main (${seedsN} seeds)`, base.rows);
  baselineFail = base.failed;
  if (base.reports.length) {
    console.log('\nexemplos no main (não reprovam esta branch):');
    for (const line of base.reports.slice(0, 24)) console.log('  ' + line);
  }
}

if (current.reports.length) {
  console.log('\nfalhas:');
  for (const line of current.reports.slice(0, 40)) console.log('  ' + line);
  if (current.reports.length > 40) console.log(`  … ${current.reports.length - 40} linhas omitidas`);
}

const sum = (key) => current.rows.reduce((s, r) => s + r[key], 0);
console.log(
  `\ntotais atuais: órfãos ${sum('orphans')} · botânica ${sum('botany')} · cano ${sum('pipe')} · carga ${sum('load')} · vaso ${sum('clip')} · juntas ${sum('joints')} · solo ${sum('soil')}`,
);
if (current.failed) {
  console.error(`\n${current.failed} combinação(ões) de espécie, estilo e seed fora do realismo.`);
  process.exit(1);
}
console.log('\ntodas as combinações passaram.');
if (wantBaseline) console.log(`(o main, só como referência, teve ${baselineFail} combinações com violação)`);
}
