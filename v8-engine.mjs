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
    let v = r.chance(0.5) ? va : vb;
    v = v * 0.62 + (r.chance(0.5) ? va : vb) * 0.38;
    if (r.chance(0.28)) v = r.chance(0.5) ? gene.min + (gene.max - gene.min) * 0.08 : gene.max - (gene.max - gene.min) * 0.08;
    else if (r.chance(0.18)) v += r.jit((gene.max - gene.min) * 0.12);
    child[gene.key] = Math.min(gene.max, Math.max(gene.min, v));
  }
  return child;
}

export function childSeed(a, b) {
  let h = 2166136261;
  const s = `${a}×${b}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `cruz-${(h >>> 0).toString(36)}`;
}

/**
 * Genes só mudam a planta quando `apply` é verdadeiro (edição, cruzamento ou hash &genoma=).
 * Sem isso a seed continua com o visual da v7 — o painel ainda mostra o DNA.
 */
export function applyGenomeToPlant(P, BK, W, genome, sp, apply = false) {
  if (P) P._genome = genome || null;
  if (!genome || !apply) {
    if (W) { W._lambdaMul = 1; W._windAsym = 0; }
    return;
  }
  const vig = genome.vigor ?? 1;
  const ram = genome.ramificacao ?? 1;
  if (P.angle != null) P.angle *= ram;
  if (P.bAngle != null) P.bAngle *= ram;
  if (P.twigAngle != null) P.twigAngle *= ram;
  if (P.elong != null) P.elong = 1 + (P.elong - 1) * (genome.alongamento ?? 1);
  if (P.leafH != null) P.leafH += genome.cor ?? 0;
  if (P.needleH != null) P.needleH += (genome.cor ?? 0) * 0.6;
  if (P.leafSize != null) P.leafSize *= 0.82 + 0.36 * vig;
  if (P.leafS != null) P.leafS = Math.min(1, P.leafS * (0.85 + 0.3 * (genome.densidade ?? 1)));
  if (P.gravity != null) P.gravity *= 0.75 + 0.5 * vig;
  if (BK) {
    BK.depth *= genome.casca ?? 1;
    if (BK.moss != null) BK.moss = Math.max(0, BK.moss * (genome.musgo ?? 1));
  }
  if (W) {
    W.G *= 0.85 + 0.3 * vig;
    W._lambdaMul = genome.dominancia ?? 1;
    W._windAsym = genome.vento ?? 0;
  }
}

export function genomeTableRows(genome) {
  return GENE_CATALOG.map(g => [g.label, fmtGene(genome[g.key], g.unit)]);
}
function fmtGene(v, unit) {
  if (v == null) return '—';
  return (+v).toFixed(unit === '°' ? 1 : 2) + unit;
}

/* —— gravidade: só galhos grossos e horizontais; pontas finas não caem —— */
export function applyGravitySag(sk, strength = 1) {
  if (!strength || strength < 0.02 || sk.N < 2) return;
  const { N, X, Y, Z, PAR } = sk;
  const load = new Float64Array(N);
  const horiz = new Float64Array(N);
  const kids = new Int32Array(N);
  for (let i = N - 1; i >= 1; i--) {
    const p = PAR[i];
    if (p < 0) continue;
    kids[p]++;
    const dx = X[i] - X[p], dy = Y[i] - Y[p], dz = Z[i] - Z[p];
    const L = Math.hypot(dx, dy, dz) || 1e-6;
    horiz[i] = Math.sqrt(dx * dx + dz * dz) / L;
    load[i] = L * (0.35 + horiz[i]);
    load[p] += load[i];
  }
  const maxL = load[0] || 1;
  for (let i = 1; i < N; i++) {
    if (horiz[i] < 0.55) continue;
    if (kids[i] < 2 && load[i] < maxL * 0.08) continue;
    const w = (load[i] / maxL) * strength * horiz[i];
    if (w < 0.04) continue;
    const p = PAR[i];
    const sag = Math.min(0.35, w * w * 0.12);
    Y[i] -= sag;
    const pull = sag * 0.04;
    X[i] -= pull * (X[i] - X[p]);
    Z[i] -= pull * (Z[i] - Z[p]);
  }
}

/** Raízes de superfície e nós rasteiros desviam de pedras e ficam dentro do vaso. */
export function deflectRoots(sk, stones = [], pot = null) {
  const { N, X, Y, Z, PAR } = sk;
  const isRoot = new Uint8Array(N);
  const mark = (i) => {
    let j = i, guard = 0;
    while (j > 0 && guard++ < 24) {
      isRoot[j] = 1;
      j = PAR[j];
      if (Y[j] > 0.42) break;
    }
  };
  if (sk.tipw) for (const pair of sk.tipw) mark(pair[0]);
  if (sk.boost) for (const b of sk.boost) if (b.i != null) mark(b.i);
  // kengai: o tronco passa de y = 0 de propósito. Sem esta trava, a cascata seria puxada para dentro da elipse do vaso.
  if (!sk.below) for (let i = 1; i < N; i++) if (Y[i] < 0.06 && Y[PAR[i]] < 0.2) isRoot[i] = 1;
  for (let i = 1; i < N; i++) {
    if (!isRoot[i] || i === 0) continue;
    for (const s of stones) {
      const dx = X[i] - s.x, dz = Z[i] - s.z;
      const d = Math.hypot(dx, dz) || 1e-4;
      const lim = s.r + 0.03;
      if (d < lim) {
        X[i] = s.x + (dx / d) * lim;
        Z[i] = s.z + (dz / d) * lim;
      }
    }
    if (pot) {
      const nx = X[i] / pot.a, nz = Z[i] / pot.b;
      const e = nx * nx + nz * nz;
      if (e > 0.9) {
        const k = Math.sqrt(0.86 / e);
        X[i] *= k;
        Z[i] *= k;
      }
    }
  }
}

/**
 * Cachos só no LOD distante: junta folhas do mesmo nó sem aumentar a área
 * (escala ≈ s, não √n). No close-up a folhagem original fica intacta.
 */
export function clusterFoliage(inst, kinds = ['leaf', 'needles']) {
  for (const kind of kinds) {
    const items = inst[kind];
    if (!items || items.length < 400) continue;
    const byNode = new Map();
    for (const it of items) {
      const k = it.node ?? -1;
      if (!byNode.has(k)) byNode.set(k, []);
      byNode.get(k).push(it);
    }
    const out = [];
    for (const [, group] of byNode) {
      if (group.length < 6) { out.push(...group); continue; }
      const step = 4;
      for (let b = 0; b < group.length; b += step) {
        const slice = group.slice(b, b + step);
        let px = 0, py = 0, pz = 0, sx = 0;
        const y = slice[0].y.clone ? slice[0].y.clone() : { ...slice[0].y };
        const z = slice[0].z.clone ? slice[0].z.clone() : { ...slice[0].z };
        for (const it of slice) { px += it.p.x; py += it.p.y; pz += it.p.z; sx += it.s; }
        const m = slice.length;
        out.push({
          p: { x: px / m, y: py / m, z: pz / m },
          y, z,
          s: (sx / m) * (1 + 0.08 * (m - 1)),
          life: slice[0].life, node: slice[0].node, cluster: m,
        });
      }
    }
    inst[kind] = out;
  }
  return inst;
}

/* —— Junções grossas (tronco e galhos de andaime) + lascas de jin —— */
function thickForks(sk, rFull, limit) {
  const { N, PAR } = sk;
  const kids = Array.from({ length: N }, () => 0);
  for (let i = 1; i < N; i++) kids[PAR[i]]++;
  let rMax = 0;
  for (let i = 0; i < N; i++) if (rFull[i] > rMax) rMax = rFull[i];
  const forks = [];
  for (let i = 0; i < N; i++) {
    if (kids[i] < 2) continue;
    if (rFull[i] < Math.max(0.04, rMax * 0.07)) continue;
    forks.push(i);
  }
  forks.sort((i, j) => rFull[j] - rFull[i]);
  return forks.slice(0, limit);
}

function pushSphere(pos, nor, idx, meta, cx, cy, cz, R, seg, node, ref) {
  const grid = [];
  for (let lat = 0; lat <= seg; lat++) {
    const v = (lat / seg) * Math.PI;
    for (let lon = 0; lon < seg; lon++) {
      const u = (lon / seg) * Math.PI * 2;
      const nx = Math.sin(v) * Math.cos(u), ny = Math.cos(v), nz = Math.sin(v) * Math.sin(u);
      grid.push([cx + nx * R, cy + ny * R, cz + nz * R, nx, ny, nz]);
    }
  }
  let base = pos.length / 3;
  const stride = seg;
  for (let lat = 0; lat < seg; lat++) for (let lon = 0; lon < seg; lon++) {
    const a = lat * stride + lon, b = lat * stride + (lon + 1) % seg;
    const c = (lat + 1) * stride + lon, d = (lat + 1) * stride + (lon + 1) % seg;
    for (const tri of [[a, c, b], [b, c, d]]) {
      idx.push(base, base + 1, base + 2);
      for (const q of tri) {
        pos.push(grid[q][0], grid[q][1], grid[q][2]);
        nor.push(grid[q][3], grid[q][4], grid[q][5]);
        meta.node.push(node);
        meta.cen.push(cx, cy, cz);
        meta.ref.push(ref);
      }
      base += 3;
    }
  }
}

/**
 * Esferas só nas forquilhas grossas (tronco e andaime). Jin: esferas lascadas, malha à parte.
 * Cada vértice guarda o nó e o raio aos 100% (opts.rRef; senão o raio usado no tamanho).
 * O shader da planta escala a esfera por raio_atual/raio_final: some até o galho existir
 * e em idade 1 volta ao tamanho em que foi construída.
 */
export function buildJointMeshes(sk, rFull, deadCfg, opts = {}) {
  const rRef = opts.rRef || rFull;
  const forks = thickForks(sk, rFull, opts.limit ?? 40).filter((i) => !(opts.skip && opts.skip(i, sk)));
  const pos = [], nor = [], idx = [], meta = { node: [], cen: [], ref: [] };
  for (const i of forks) pushSphere(pos, nor, idx, meta, sk.X[i], sk.Y[i], sk.Z[i], rFull[i] * 0.58, 5, i, rRef[i] || 0);
  const jpos = [], jnor = [], jidx = [], jmeta = { node: [], cen: [], ref: [] };
  if (sk.jin) {
    for (const i of sk.jin) {
      const p = sk.PAR[i];
      if (p < 0) continue;
      const dx = sk.X[i] - sk.X[p], dy = sk.Y[i] - sk.Y[p], dz = sk.Z[i] - sk.Z[p];
      const L = Math.hypot(dx, dy, dz) || 1;
      const len = Math.min(L * 0.85, Math.max(rFull[i] || 0.02, 0.02) * 7);
      const ux = dx / L, uy = dy / L, uz = dz / L;
      const r0 = Math.max(rFull[p] || 0.02, 0.015) * 0.42;
      const ref = rRef[i] || rRef[p] || 0;
      pushSphere(jpos, jnor, jidx, jmeta, sk.X[p] + ux * len * 0.35, sk.Y[p] + uy * len * 0.35, sk.Z[p] + uz * len * 0.35, r0, 4, i, ref);
      pushSphere(jpos, jnor, jidx, jmeta, sk.X[p] + ux * len * 0.75, sk.Y[p] + uy * len * 0.75, sk.Z[p] + uz * len * 0.75, r0 * 0.45, 4, i, ref);
    }
  }
  const pack = (P, N, I, M) => (P.length ? {
    pos: new Float32Array(P), nor: new Float32Array(N), idx: I,
    node: new Float32Array(M.node), cen: new Float32Array(M.cen), ref: new Float32Array(M.ref),
  } : null);
  const joints = pack(pos, nor, idx, meta);
  const jin = pack(jpos, jnor, jidx, jmeta);
  if (!joints && !jin) return null;
  return { joints, jin };
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

/** Direção do sol da v7: (0.8, 1.6, 0.6). Gravidade e fototropismo começam em 0 para o visual padrão coincidir com a v7. */
export const ENV_DEFAULT = {
  windAz: 55, windEl: 8, windStr: 1, sunAz: 53, sunEl: 58, gravity: 0, phototropism: 0, growPhysics: false,
};

export function envSunDir(env) {
  const az = env.sunAz * DEG, el = env.sunEl * DEG;
  return [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
}

export function envWindDir(env) {
  const az = env.windAz * DEG, el = env.windEl * DEG;
  return [Math.cos(el) * Math.sin(az), Math.sin(el) * 0.3, Math.cos(el) * Math.cos(az)];
}
