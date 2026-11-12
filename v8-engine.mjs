/** v8: genoma, junções SDF, folhagem em cachos, gravidade/sombra direcional */

const DEG = Math.PI / 180;

export const GENE_CATALOG = [
  { key: 'vigor', label: 'Vigor', unit: '', min: 0.55, max: 1.45, def: 1 },
  { key: 'ramificacao', label: 'Ângulo de ramificação', unit: '×', min: 0.72, max: 1.28, def: 1 },
  { key: 'densidade', label: 'Densidade da copa', unit: '×', min: 0.6, max: 1.4, def: 1 },
  { key: 'alongamento', label: 'Alongamento', unit: '×', min: 0.85, max: 1.15, def: 1 },
  { key: 'casca', label: 'Profundidade da casca', unit: '×', min: 0.5, max: 1.5, def: 1 },
  { key: 'musgo', label: 'Musgo', unit: '×', min: 0, max: 1.5, def: 1 },
  { key: 'cor', label: 'Matiz da folhagem', unit: '°', min: -35, max: 35, def: 0 },
  { key: 'dominancia', label: 'Dominância apical', unit: '×', min: 0.85, max: 1.15, def: 1 },
  { key: 'vento', label: 'Assimetria ao vento', unit: '×', min: 0, max: 1.2, def: 0.35 },
];

export function genomeFromSeed(seed, id, Rand) {
  const r = new Rand(`${seed}::${id}::genome-v8`);
  const g = {};
  for (const gene of GENE_CATALOG) {
    g[gene.key] = gene.min + (gene.max - gene.min) * r.f();
  }
  return g;
}

export function parseGenomeHash(str) {
  if (!str) return null;
  try {
    if (str.startsWith('b64:')) {
      const j = JSON.parse(atob(str.slice(4)));
      return typeof j === 'object' ? j : null;
    }
    const g = {};
    for (const part of str.split(',')) {
      const [k, v] = part.split(':'); if (!k || v == null) continue;
      g[k.trim()] = +v;
    }
    return Object.keys(g).length ? g : null;
  } catch { return null; }
}

export function genomeToHash(g) {
  if (!g) return '';
  const pairs = GENE_CATALOG.map(({ key }) => `${key}:${(+g[key]).toFixed(3)}`);
  return pairs.join(',');
}

export function mergeGenome(base, overlay) {
  return overlay ? { ...base, ...overlay } : { ...base };
}

export function crossGenomes(a, b, mutation, Rand) {
  const r = new Rand(mutation);
  const child = {};
  for (const gene of GENE_CATALOG) {
    const va = a[gene.key] ?? gene.def, vb = b[gene.key] ?? gene.def;
    let v = va + (vb - va) * (0.35 + 0.3 * r.f());
    if (r.chance(0.12)) v += r.jit((gene.max - gene.min) * 0.08);
    child[gene.key] = Math.min(gene.max, Math.max(gene.min, v));
  }
  return child;
}

/** Aplica genes ao objeto P (antes de build) e a BK / wood */
export function applyGenomeToPlant(P, BK, W, genome, sp) {
  if (!genome) return;
  if (P.angle != null) P.angle *= genome.ramificacao ?? 1;
  if (P.elong != null) P.elong = 1 + (P.elong - 1) * (genome.alongamento ?? 1);
  if (P.elong == null && genome.alongamento) P._elongMul = genome.alongamento;
  if (P.iterations != null) P.iterations = Math.round(P.iterations * (genome.densidade ?? 1));
  if (P.gravity != null) P.gravity *= (genome.vigor ?? 1) * 0.5;
  if (P.leafH != null) P.leafH += genome.cor ?? 0;
  if (P.leafSize != null) P.leafSize *= genome.vigor ?? 1;
  if (BK) {
    BK.depth *= genome.casca ?? 1;
    if (BK.moss != null) BK.moss *= genome.musgo ?? 1;
  }
  if (W) {
    W.G *= genome.vigor ?? 1;
    W._lambdaMul = genome.dominancia ?? 1;
    W._windAsym = genome.vento ?? 0.35;
  }
  P._genome = genome;
  if (sp && sp.simLambdaMul) sp.simLambdaMul = genome.dominancia ?? 1;
}

export function genomeTableRows(genome) {
  return GENE_CATALOG.map(g => [g.label, fmtGene(genome[g.key], g.unit)]);
}
function fmtGene(v, unit) {
  if (v == null) return '—';
  return (+v).toFixed(unit === '°' ? 1 : 2) + unit;
}

/* —— gravidade: curvatura de galhos longos —— */
export function applyGravitySag(sk, strength = 1) {
  if (!strength || sk.N < 2) return;
  const { N, X, Y, Z, PAR } = sk;
  const load = new Float64Array(N);
  const horiz = new Float64Array(N);
  for (let i = N - 1; i >= 0; i--) {
    const p = PAR[i];
    if (p < 0) continue;
    const dx = X[i] - X[p], dy = Y[i] - Y[p], dz = Z[i] - Z[p], L = Math.hypot(dx, dy, dz) || 1e-6;
    horiz[i] = Math.sqrt(dx * dx + dz * dz) / L;
    load[i] = L * (0.4 + horiz[i]);
    if (p >= 0) load[p] += load[i];
  }
  const maxL = load[0] || 1;
  for (let i = 1; i < N; i++) {
    const w = (load[i] / maxL) * strength * horiz[i];
    if (w < 0.02) continue;
    const p = PAR[i];
    const sag = w * w * 0.35 * Math.min(load[i], 3);
    X[i] -= sag * 0.15 * (X[i] - X[p]);
    Y[i] -= sag;
    Z[i] -= sag * 0.15 * (Z[i] - Z[p]);
  }
}

/* —— folhagem: agrupa folhas/agulhas do mesmo nó em cachos —— */
export function clusterFoliage(inst, kinds = ['leaf', 'needles']) {
  for (const kind of kinds) {
    const items = inst[kind];
    if (!items || items.length < 80) continue;
    const byNode = new Map();
    for (const it of items) {
      const k = it.node ?? -1;
      if (!byNode.has(k)) byNode.set(k, []);
      byNode.get(k).push(it);
    }
    const out = [];
    for (const [, group] of byNode) {
      if (group.length < 3) { out.push(...group); continue; }
      const n = Math.ceil(group.length / 4);
      for (let b = 0; b < group.length; b += n) {
        const slice = group.slice(b, b + n);
        let px = 0, py = 0, pz = 0, sx = 0;
        const y = slice[0].y.clone(), z = slice[0].z.clone();
        for (const it of slice) { px += it.p.x; py += it.p.y; pz += it.p.z; sx += it.s; }
        const m = slice.length;
        out.push({
          p: { x: px / m, y: py / m, z: pz / m, isVector3: false },
          y, z, s: (sx / m) * Math.sqrt(m) * 0.85,
          life: slice[0].life, node: slice[0].node, cluster: m,
        });
      }
    }
    inst[kind] = out;
  }
  return inst;
}

/* —— Junções: esfera de blend + capuzes cilíndricos curtos (malha explícita) —— */

function forkJointSpecs(sk, rFull) {
  const { N, X, Y, Z, PAR } = sk;
  const kids = Array.from({ length: N }, () => []);
  for (let i = 1; i < N; i++) kids[PAR[i]].push(i);
  const main = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) {
    const k = kids[i]; if (!k.length) continue;
    const dx = X[i] - X[PAR[i]], dy = Y[i] - Y[PAR[i]], dz = Z[i] - Z[PAR[i]];
    const L = Math.hypot(dx, dy, dz) || 1; const d0 = [dx / L, dy / L, dz / L];
    let best = -9, bi = -1;
    for (const c of k) {
      const cx = X[c] - X[i], cy = Y[c] - Y[i], cz = Z[c] - Z[i];
      const Lc = Math.hypot(cx, cy, cz) || 1;
      const sc = (cx * d0[0] + cy * d0[1] + cz * d0[2]) / Lc + 0.2 * (rFull[c] / (rFull[i] || 1)) ** 2;
      if (sc > best) { best = sc; bi = c; }
    }
    main[i] = bi;
  }
  const specs = [];
  for (let i = 0; i < N; i++) {
    const br = kids[i].filter(c => c !== main[i]);
    if (!br.length || rFull[i] < 0.008) continue;
    const arms = [];
    const addArm = (c) => {
      if (c < 0) return;
      const dx = X[c] - X[i], dy = Y[c] - Y[i], dz = Z[c] - Z[i];
      const len = Math.hypot(dx, dy, dz) || 1;
      arms.push({ dir: [dx / len, dy / len, dz / len], len: Math.min(len, rFull[i] * 4), r: rFull[c] });
    };
    addArm(main[i]); for (const c of br) addArm(c);
  const pi = PAR[i];
  if (pi >= 0) {
    const dx = X[i] - X[pi], dy = Y[i] - Y[pi], dz = Z[i] - Z[pi];
    const len = Math.hypot(dx, dy, dz) || 1;
    arms.unshift({ dir: [dx / len, dy / len, dz / len], len: Math.min(len, rFull[i] * 3), r: rFull[pi], parent: true });
  }
    specs.push({ center: [X[i], Y[i], Z[i]], r: rFull[i] * 1.02, arms, node: i, y: Y[i] });
  }
  return specs.sort((a, b) => b.r - a.r).slice(0, Math.min(100, specs.length));
}

/** Malha união suave: esfera + capuzes; shari escavado como fenda no perfil angular */
export function buildJointMeshes(sk, rFull, deadCfg, opts = {}) {
  const specs = forkJointSpecs(sk, rFull);
  const seg = opts.seg ?? 10, pos = [], nor = [], idx = [];
  let base = 0;
  const pushTri = (a, b, c) => { idx.push(base, base + 1, base + 2); base += 3; pos.push(...a, ...b, ...c); };
  const normal = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[1] - a[1];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    for (let k = pos.length - 9; k < pos.length; k += 3) nor.push(nx / L, ny / L, nz / L);
  };
  const carve = (px, py, pz, spec) => {
    if (!deadCfg || py > spec.center[1] + deadCfg.trunkH * deadCfg.shariH) return true;
    const th = Math.atan2(pz - spec.center[2], px - spec.center[0]) - deadCfg.twist * (py - spec.center[1]) - (deadCfg.phase ?? 0);
    const inBand = Math.cos(th) > Math.cos(Math.PI * deadCfg.shari);
    return !inBand;
  };
  for (const spec of specs) {
    const [cx, cy, cz] = spec.center, R = spec.r;
    for (let lat = 0; lat < seg; lat++) for (let lon = 0; lon < seg; lon++) {
      const u0 = lon / seg * Math.PI * 2, u1 = (lon + 1) / seg * Math.PI * 2;
      const v0 = (lat / seg - 0.5) * Math.PI, v1 = ((lat + 1) / seg - 0.5) * Math.PI;
      const sph = (u, v) => {
        const cr = Math.cos(v) * R * 1.08, y = Math.sin(v) * R * 1.05 + cy;
        return [cx + Math.cos(u) * cr, y, cz + Math.sin(u) * cr];
      };
      const p00 = sph(u0, v0), p10 = sph(u1, v0), p01 = sph(u0, v1), p11 = sph(u1, v1);
      if (carve(p00[0], p00[1], p00[2], spec) && carve(p10[0], p10[1], p10[2], spec) && carve(p01[0], p01[1], p01[2], spec))
        { pushTri(p00, p10, p01); pushTri(p10, p11, p01); normal(p00, p10, p01); normal(p10, p11, p01); }
    }
    for (const arm of spec.arms) {
      const len = arm.len * 0.55, r0 = arm.parent ? spec.r * 0.95 : spec.r * 0.92, r1 = arm.r * 0.9;
      const [dx, dy, dz] = arm.dir;
      const ux = Math.abs(dx) < 0.9 ? 0 : 1, uy = Math.abs(dx) < 0.9 ? 1 : 0, uz = 0;
      let px = dy * uz - dz * uy, py = dz * ux - dx * uz, pz = dx * uy - dy * ux;
      let Lp = Math.hypot(px, py, pz) || 1; px /= Lp; py /= Lp; pz /= Lp;
      const qx = dy * pz - dz * py, qy = dz * px - dx * pz, qz = dx * py - dy * px;
      for (let ri = 0; ri < seg; ri++) for (let si = 0; si < 6; si++) {
        const t0 = ri / seg, t1 = (ri + 1) / seg;
        const rad0 = r0 * (1 - t0) + r1 * t0, rad1 = r0 * (1 - t1) + r1 * t1;
        const o0 = t0 * len, o1 = t1 * len;
        const ring = (t, rad, off) => {
          const pts = [];
          for (let k = 0; k < 6; k++) {
            const ang = k / 6 * Math.PI * 2;
            const lx = Math.cos(ang) * rad, ly = Math.sin(ang) * rad;
            pts.push([
              cx + dx * off + px * lx + qx * ly,
              cy + dy * off + py * lx + qy * ly,
              cz + dz * off + pz * lx + qz * ly,
            ]);
          }
          return pts;
        };
        const a = ring(t0, rad0, o0), b = ring(t1, rad1, o1);
        for (let k = 0; k < 6; k++) {
          const k1 = (k + 1) % 6;
          pushTri(a[k], b[k], a[k1]); pushTri(b[k], b[k1], a[k1]);
          normal(a[k], b[k], a[k1]); normal(b[k], b[k1], a[k1]);
        }
      }
    }
  }
  if (!pos.length) return null;
  while (nor.length < pos.length) nor.push(0, 1, 0);
  return { pos: new Float32Array(pos), nor: new Float32Array(nor), idx };
}

/** Sombra ao longo do sol (não só para baixo) */
export function makeSunShade(shadeFn, sunDir, vs, gn, grid, pw) {
  const [sx, sy, sz] = sunDir;
  const len = Math.hypot(sx, sy, sz) || 1;
  const ux = sx / len, uy = sy / len, uz = sz / len;
  return (xi, yi, iz, sign) => {
    for (let q = 1; q < pw.length; q++) {
      const fx = xi - ux * q, fy = yi - uy * q, fz = iz - uz * q;
      const xx = Math.floor(fx), yy = Math.floor(fy), zz = Math.floor(fz);
      if (xx < 0 || yy < 0 || zz < 0 || xx >= gn[0] || yy >= gn[1] || zz >= gn[2]) break;
      grid[(xx * gn[1] + yy) * gn[2] + zz] += sign * pw[q];
    }
  };
}

export function phototropismBias(d, grad, amount) {
  if (!amount || !grad) return;
  d[0] += grad[0] * amount;
  d[1] += grad[1] * amount * 0.6;
  d[2] += grad[2] * amount;
  const L = Math.hypot(d[0], d[1], d[2]) || 1;
  d[0] /= L; d[1] /= L; d[2] /= L;
}

export function lightGradientAt(grid, gn, g0, vs, x, y, z, sunDir) {
  const ix = Math.floor((x - g0[0]) / vs), iy = Math.floor((y - g0[1]) / vs), iz = Math.floor((z - g0[2]) / vs);
  const sample = (dx, dy, dz) => {
    const xx = ix + dx, yy = iy + dy, zz = iz + dz;
    if (xx < 0 || yy < 0 || zz < 0 || xx >= gn[0] || yy >= gn[1] || zz >= gn[2]) return 1;
    const s = grid[(xx * gn[1] + yy) * gn[2] + zz];
    return Math.exp(-Math.max(0, s) / 1.5);
  };
  return [
    sample(1, 0, 0) - sample(-1, 0, 0),
    sample(0, 1, 0) - sample(0, -1, 0),
    sample(0, 0, 1) - sample(0, 0, -1),
  ];
}

export const ENV_DEFAULT = {
  windAz: 55, windEl: 8, windStr: 1, sunAz: 130, sunEl: 42, gravity: 1, phototropism: 0.35,
};

export function envSunDir(env) {
  const az = env.sunAz * DEG, el = env.sunEl * DEG;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

export function envWindDir(env) {
  const az = env.windAz * DEG, el = env.windEl * DEG;
  return [Math.cos(el) * Math.sin(az), Math.sin(el) * 0.3, Math.cos(el) * Math.cos(az)];
}
