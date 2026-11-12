/**
 * Flores paramétricas. Um preset de espécie limita o que é botânico;
 * a seed sorteia o genoma dentro dessa faixa. A malha (pétalas, estames,
 * pistilo, cálice) nasce uma vez por variante. Cor e padrão são por instância.
 * Não importa Three: o navegador chama addFlowerMeshes quando vai desenhar.
 *
 * Abertura: cada vértice tem pose de botão (aBud) e pose aberta (position).
 * O shader mistura as duas com o parâmetro de floração, atrasando a base
 * da pétala e os estames para a ponta rachar primeiro.
 */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export const PATTERN_IDS = ['solid', 'stripe', 'flake', 'fukurin', 'blotch', 'speckle'];

/** Uma flor antiga era 5 pétalas e um centro. O compare-mass conta esse equivalente. */
export const FLOWER_EQ = 6;

export const FLOWER_PRESETS = {
  satsuki: {
    id: 'satsuki',
    label: 'Azaleia Satsuki',
    petals: [5, 5],
    forms: { single: 0.78, semi: 0.09, double: 0.06, hose: 0.07 },
    width: [0.74, 0.98],
    tip: [{ id: 'round', w: 0.62 }, { id: 'notched', w: 0.24 }, { id: 'pointed', w: 0.14 }],
    frill: [0, 0.045],
    cupAlong: [1.05, 1.45],
    cupAcross: [0.12, 0.28],
    twist: [-0.08, 0.08],
    overlap: [0.16, 0.34],
    openDeg: [64, 76],
    reflex: [0.02, 0.1],
    fuse: [0.16, 0.24],
    tube: [0.055, 0.078],
    stamens: [5, 10],
    stamenLen: [0.88, 1.14],
    pistilRatio: [1.14, 1.4],
    sepal: [0.22, 0.32],
    patterns: PATTERN_IDS,
  },
};

const RES = {
  hi: { nu: 22, nv: 8, stSeg: 8, stSides: 6, anth: 2, sepNu: 7, sepNv: 3, pedSeg: 3, pedSides: 7, organs: true },
  mid: { nu: 10, nv: 3, stSeg: 4, stSides: 4, anth: 1, sepNu: 4, sepNv: 1, pedSeg: 1, pedSides: 5, organs: true },
  lod: { nu: 2, nv: 1, stSeg: 1, stSides: 3, anth: 0, sepNu: 2, sepNv: 1, pedSeg: 1, pedSides: 4, organs: false },
};

function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / Math.max(e1 - e0, 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
}
function rngOf(str) {
  let h = 2166136261;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function mixHash(seed, node, k) {
  let h = 2166136261;
  const s = `${seed}:${node}:${k}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function pickWeighted(rng, list) {
  let sum = 0;
  for (const it of list) sum += it.w;
  let x = rng() * sum;
  for (const it of list) {
    x -= it.w;
    if (x <= 0) return it.id;
  }
  return list[list.length - 1].id;
}
function cleanColor(h, s, l) {
  h = ((h % 360) + 360) % 360;
  if (h > 28 && h < 78 && l < 0.86) h = h < 52 ? 14 : 346;
  if (l >= 0.9) {
    s = Math.min(s, 0.055);
    l = Math.max(l, 0.95);
  } else {
    s = Math.max(s, 0.64);
    l = clamp(l, 0.46, 0.7);
  }
  return { h, s, l };
}
function inkOf(tone, u) {
  const base = tone.palette === 'branco' || tone.palette === 'mescla'
    ? (tone.sportH ?? 338)
    : (tone.petalH ?? 340);
  const h = base + (u - 0.5) * 10;
  const s = tone.palette === 'magenta' ? 0.82 : 0.76;
  const l = tone.palette === 'magenta' ? 0.52 : 0.6;
  return cleanColor(h, s, l);
}
function bodyOf(tone, u, pattern) {
  if (pattern === 1 || pattern === 2) return cleanColor(8, 0.02, 0.98);
  if (tone.palette === 'mescla') {
    if (u < 0.34) return cleanColor(342, 0.78, 0.62);
    if (u < 0.58) return cleanColor(322, 0.84, 0.52);
    if (u < 0.78) return cleanColor(12, 0.76, 0.6);
    return cleanColor(350, 0.03, 0.98);
  }
  if (tone.palette === 'branco') {
    if (pattern === 3 || pattern === 4) return inkOf(tone, u);
    if (pattern === 5) return cleanColor(350, 0.04, 0.97);
    return cleanColor(350, 0.03, 0.98);
  }
  if (tone.palette === 'magenta') return cleanColor(tone.petalH ?? 320, Math.max(0.76, tone.petalS || 0), clamp(tone.petalL || 0.52, 0.46, 0.58));
  return cleanColor(tone.petalH ?? 342, Math.max(0.72, tone.petalS || 0), clamp(tone.petalL || 0.58, 0.52, 0.66));
}
function throatOf(body, pattern, tone, u) {
  if (pattern === 1 || pattern === 2) return inkOf(tone, u);
  if (pattern === 4) return cleanColor(0, 0.02, 0.98);
  if (pattern === 5) return cleanColor(body.h, Math.min(0.92, body.s + 0.06), clamp(body.l * 0.72, 0.4, 0.55));
  if (body.l >= 0.9) return cleanColor(348, 0.62, 0.74);
  return cleanColor(body.h, Math.min(0.94, body.s + 0.08), clamp(body.l * 0.74, 0.4, 0.58));
}

function sampleGenome(rng, preset, form, P, i) {
  const openU = P && P.open != null ? clamp((P.open - 36) / 10, 0, 1) : rng();
  const open = lerp(preset.openDeg[0], preset.openDeg[1], openU) + (i - 1.5) * 1.4;
  const stamenLen = lerp(preset.stamenLen[0], preset.stamenLen[1], rng());
  const g = {
    preset: preset.id,
    form,
    petals: preset.petals[0],
    length: 1,
    width: lerp(preset.width[0], preset.width[1], rng()),
    tip: pickWeighted(rng, preset.tip),
    frill: lerp(preset.frill[0], preset.frill[1], rng()),
    frillN: rng() < 0.5 ? 2 : 3,
    cupAlong: lerp(preset.cupAlong[0], preset.cupAlong[1], rng()),
    cupAcross: lerp(preset.cupAcross[0], preset.cupAcross[1], rng()),
    twist: lerp(preset.twist[0], preset.twist[1], rng()),
    overlap: lerp(preset.overlap[0], preset.overlap[1], rng()),
    reflex: lerp(preset.reflex[0], preset.reflex[1], rng()),
    open: clamp(open, preset.openDeg[0] - 2, preset.openDeg[1] + 2) * DEG,
    fuse: lerp(preset.fuse[0], preset.fuse[1], rng()),
    tube: lerp(preset.tube[0], preset.tube[1], rng()),
    stamens: Math.round(lerp(preset.stamens[0], preset.stamens[1], rng())),
    stamenLen,
    pistilLen: stamenLen * lerp(preset.pistilRatio[0], preset.pistilRatio[1], rng()),
    sepal: lerp(preset.sepal[0], preset.sepal[1], rng()),
    spin: rng() * TAU,
    innerScale: lerp(0.58, 0.7, rng()),
    outerScale: lerp(1.04, 1.14, rng()),
    petaloids: form === 'semi' ? 2 + Math.floor(rng() * 3) : 0,
  };
  g.stamens = clamp(g.stamens, preset.stamens[0], preset.stamens[1]);
  return g;
}

export function flowerBook(presetId, seed, P = {}) {
  const preset = FLOWER_PRESETS[presetId];
  if (!preset) throw new Error('preset de flor desconhecido: ' + presetId);
  const rng = rngOf(`${seed}::${presetId}::flor`);
  const u = rng();
  let form = 'single';
  if (u < preset.forms.hose) form = 'hose';
  else if (u < preset.forms.hose + preset.forms.double) form = 'double';
  else if (u < preset.forms.hose + preset.forms.double + preset.forms.semi) form = 'semi';
  const variants = [];
  for (let i = 0; i < 4; i++) variants.push(sampleGenome(rng, preset, form, P, i));
  const primary = preset.patterns[Math.floor(rng() * preset.patterns.length)];
  const mix = P && P.sport ? 0.22 + rng() * 0.26 : 0.06 + rng() * 0.06;
  return {
    preset: presetId,
    form,
    variants,
    primary,
    mix,
    seed: String(seed),
    tone: {
      petalH: P.petalH ?? 340,
      petalS: P.petalS ?? 0.7,
      petalL: P.petalL ?? 0.58,
      sportH: P.sportH ?? 318,
      palette: P.palette || 'rosa',
      sport: !!P.sport,
      stripe: !!P.stripe,
    },
  };
}

function patternId(name) {
  const i = PATTERN_IDS.indexOf(name);
  return i < 0 ? 0 : i;
}

export function pickFlower(book, node, k, pos, center) {
  const h = mixHash(book.seed, node | 0, k | 0);
  const u = (h & 65535) / 65535;
  const u2 = ((h >>> 8) & 65535) / 65535;
  const u3 = ((h >>> 16) & 65535) / 65535;
  let name = book.primary;
  if (book.tone.stripe && u < 0.55) name = (h & 1) ? 'stripe' : 'flake';
  else if (u < book.mix) name = PATTERN_IDS[h % PATTERN_IDS.length];
  const pattern = patternId(name);
  const body = bodyOf(book.tone, u2, pattern);
  const throat = throatOf(body, pattern, book.tone, u3);
  let phase = ((h >>> 3) & 255) / 255 * 0.06 + (k % 3) * 0.012;
  if (pos && center) {
    const ang = Math.atan2(pos.x - center.x, pos.z - center.z);
    const around = (ang / TAU + 1) % 1;
    const up = center.span > 1e-4 ? clamp((pos.y - center.low) / center.span, 0, 1) : 0.5;
    phase = (around * 0.62 + up * 0.38) * 0.32 + (k % 3) * 0.012;
  }
  return {
    variant: (h >>> 4) % book.variants.length,
    pattern,
    patSeed: u3,
    phase,
    baseH: body.h, baseS: body.s, baseL: body.l,
    throatH: throat.h, throatS: throat.s, throatL: throat.l,
  };
}

/** A flor que representa a seed na grade: a variante 0, no padrão principal. */
export function representFlower(book, index = 0) {
  const pattern = patternId(book.primary);
  const body = bodyOf(book.tone, 0.31 + (index % 5) * 0.07, pattern);
  const throat = throatOf(body, pattern, book.tone, 0.42);
  return {
    variant: index % book.variants.length,
    pattern,
    patSeed: (index * 0.173) % 1,
    phase: 0,
    baseH: body.h, baseS: body.s, baseL: body.l,
    throatH: throat.h, throatS: throat.s, throatL: throat.l,
  };
}

function halfWidth(g, whorl, t, len, radial) {
  const tubeR = g.tube * len;
  const sector = Math.tan(Math.PI / g.petals);
  const base = tubeR * sector * (1.28 + g.overlap * 0.5);
  const overlapAng = 1.22 + g.overlap * 0.4 + (g.width - 0.7) * 0.18;
  const cover = Math.max(base, radial * sector * overlapAng);
  let round = 1;
  if (g.tip === 'pointed') round = Math.max(0.045, Math.pow(1 - smoothstep(0.46, 1, t), 0.75));
  else if (g.tip === 'notched') round = Math.max(0.68, Math.cos(smoothstep(0.8, 1, t) * 0.85));
  else round = Math.max(0.1, Math.pow(Math.cos(smoothstep(0.6, 1, t) * Math.PI * 0.5), 0.6));
  return cover * round * (whorl.widthMul || 1);
}

function petalPoint(g, index, whorl, t, s, pose) {
  const theta = g.spin + (whorl.rot || 0) + (index / g.petals) * TAU;
  const len = g.length * (whorl.scale || 1);
  const open = Math.min(g.open * (whorl.openMul || 1), 82 * DEG);
  const y0 = whorl.y0 || 0.045;
  if (pose === 'bud') {
    const imb = (index % 2 === 0 ? 1.06 : 0.9) * (whorl.inner ? 0.78 : 1);
    const belly = Math.sin(Math.PI * Math.min(1, t * 0.82 + 0.06));
    const pinch = 1 - smoothstep(0.62, 1, t);
    const y = y0 + t * len * (whorl.inner ? 0.24 : 0.42) * (0.72 + 0.28 * pinch);
    const rad = (0.01 + 0.05 * belly) * len * imb * (0.06 + 0.94 * pinch);
    const across = s * rad * 1.2;
    const ang = theta + t * 0.42 + index * 0.03;
    return [
      Math.cos(ang) * rad - Math.sin(ang) * across,
      Math.max(0, y),
      Math.sin(ang) * rad + Math.cos(ang) * across,
    ];
  }
  const exp = 0.55 + Math.max(0, g.cupAlong - 1.05) * 0.25;
  let angAxis = 50 * DEG + (open - 50 * DEG) * Math.pow(Math.max(t, 0.001), exp);
  const reflex = smoothstep(0.8, 1, t) * (g.reflex || 0);
  angAxis = Math.min(86 * DEG, angAxis + reflex);
  const along = len * t;
  let y = y0 + along * Math.cos(angAxis) - reflex * len * 0.08;
  const tubeR = g.tube * len;
  let radial = Math.max(along * Math.sin(angAxis), tubeR * (1 - 0.35 * smoothstep(0.04, 0.4, t)));
  if (g.tip === 'notched' && t > 0.78) {
    const notch = smoothstep(0.78, 1, t) * Math.exp(-s * s * 14);
    y -= notch * len * 0.05;
    radial -= notch * len * 0.018;
  }
  const ridge = Math.exp(-s * s * 6.5) * len * 0.01 * smoothstep(0.22, 0.48, t) * (1 - smoothstep(0.86, 1, t));
  y += ridge;
  const half = halfWidth(g, whorl, t, len, radial);
  const cup = g.cupAcross * half * s * s * smoothstep(0.25, 0.6, t);
  const across = s * half;
  const mid = theta + g.twist * t * t;
  const edge = Math.pow(Math.abs(s), 3.2) * smoothstep(0.66, 0.92, t);
  const frill = g.frill * edge * Math.sin((s * 0.5 + 0.5) * g.frillN * TAU + index) * half;
  const rx = Math.cos(mid);
  const rz = Math.sin(mid);
  const r = Math.max(tubeR * 0.42, radial - cup);
  return [
    rx * r - rz * across + rx * frill * 0.08,
    Math.max(0, y + frill * 0.28 + index * 0.007 + (whorl.inner ? 0.012 : 0)),
    rz * r + rx * across + rz * frill * 0.08,
  ];
}

function whorlsOf(g) {
  if (g.form === 'double') {
    return [
      { scale: 1, openMul: 1, y0: 0.048, rot: 0, widthMul: 1, delay: 0 },
      { scale: g.innerScale, openMul: 0.7, y0: 0.055, rot: Math.PI / g.petals, widthMul: 0.82, delay: 0.08, inner: true },
    ];
  }
  if (g.form === 'hose') {
    return [
      { scale: g.outerScale, openMul: 1.05, y0: 0.03, rot: Math.PI / g.petals, widthMul: 0.94, delay: 0 },
      { scale: 0.72, openMul: 0.9, y0: 0.08, rot: 0, widthMul: 0.86, delay: 0.07, inner: true },
    ];
  }
  return [{ scale: 1, openMul: 1, y0: 0.048, rot: 0, widthMul: 1, delay: 0 }];
}

function filamentPoint(g, i, count, t, pose, lenMul, spread) {
  const theta = g.spin + 0.35 + (i / count) * TAU;
  const len = g.length * lenMul;
  if (pose === 'bud') {
    const y = 0.055 + t * len * 0.2;
    const r = 0.01 + t * 0.02;
    return [Math.cos(theta) * r, y, Math.sin(theta) * r];
  }
  const rise = 1 - Math.pow(1 - t, 1.35);
  const bow = Math.sin(t * Math.PI * 0.92) * 0.045 + Math.pow(t, 1.75) * spread;
  const y = 0.055 + len * rise * 0.94;
  const r = 0.006 + bow * len;
  return [Math.cos(theta) * r, Math.max(0, y), Math.sin(theta) * r];
}

function sepalPoint(g, i, t, s, pose) {
  const theta = g.spin + 0.25 + (i / 5) * TAU;
  const len = g.sepal * g.length * (pose === 'bud' ? 0.7 : 0.48);
  const spread = pose === 'bud' ? 0.42 : 1.2;
  const ang = spread * Math.pow(t, 0.75);
  const y = 0.012 + len * t * Math.cos(ang);
  const radial = 0.012 + len * t * Math.sin(ang);
  const w = len * 0.28 * Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.04));
  const across = s * w;
  return [
    Math.cos(theta) * radial - Math.sin(theta) * across,
    Math.max(0, y),
    Math.sin(theta) * radial + Math.cos(theta) * across,
  ];
}

function triNormal(pos, a, b, c) {
  const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
  const bx = pos[b * 3] - ax, by = pos[b * 3 + 1] - ay, bz = pos[b * 3 + 2] - az;
  const cx = pos[c * 3] - ax, cy = pos[c * 3 + 1] - ay, cz = pos[c * 3 + 2] - az;
  return [by * cz - bz * cy, bz * cx - bx * cz, bx * cy - by * cx];
}

function createMeshBuilder() {
  const pos = [];
  const bud = [];
  const meta = [];
  const uv = [];
  const index = [];
  function add(open, closed, delay, part, u, v) {
    const i = pos.length / 3;
    pos.push(open[0], open[1], open[2]);
    bud.push(closed[0], Math.max(0, closed[1]), closed[2]);
    meta.push(delay, part);
    uv.push(u, v);
    return i;
  }
  function addGrid(nu, nv, sample, part, delayAt) {
    const base = pos.length / 3;
    const cols = nv * 2 + 1;
    for (let i = 0; i <= nu; i++) {
      const t = i / nu;
      for (let j = -nv; j <= nv; j++) {
        const s = nv === 0 ? 0 : j / nv;
        const o = sample(t, s, 'open');
        const b = sample(t, s, 'bud');
        add(o, b, delayAt(t), part, s * 0.5 + 0.5, t);
      }
    }
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = base + i * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        const n = triNormal(pos, a, c, b);
        let ex = 0, ey = 0, ez = 0;
        for (const id of [a, b, c, d]) { ex += pos[id * 3]; ey += pos[id * 3 + 1]; ez += pos[id * 3 + 2]; }
        const rl = Math.hypot(ex, ez) || 1;
        const dot = n[0] * ex / rl + n[1] * 0.55 + n[2] * ez / rl;
        if (dot < 0) index.push(a, b, c, b, d, c);
        else index.push(a, c, b, b, c, d);
      }
    }
  }
  function addCurve(openAt, budAt, radAt, segs, sides, part, delay) {
    const frames = (at, t) => {
      const p = at(t);
      const q = at(Math.min(1, t + 1 / Math.max(segs, 1)));
      let tx = q[0] - p[0], ty = q[1] - p[1], tz = q[2] - p[2];
      let L = Math.hypot(tx, ty, tz) || 1;
      tx /= L; ty /= L; tz /= L;
      let hx = -ty, hy = tx, hz = 0;
      if (hx * hx + hy * hy < 1e-4) { hx = 0; hy = -tz; hz = ty; }
      L = Math.hypot(hx, hy, hz) || 1;
      hx /= L; hy /= L; hz /= L;
      const bx = ty * hz - tz * hy, by = tz * hx - tx * hz, bz = tx * hy - ty * hx;
      return { p, hx, hy, hz, bx, by, bz };
    };
    const base = pos.length / 3;
    for (let k = 0; k <= segs; k++) {
      const t = k / segs;
      const fo = frames(openAt, t);
      const fb = frames(budAt, t);
      const rad = radAt(t);
      for (let s = 0; s <= sides; s++) {
        const a = (s % sides) / sides * TAU;
        const c = Math.cos(a), sn = Math.sin(a);
        const open = [
          fo.p[0] + (fo.hx * c + fo.bx * sn) * rad,
          Math.max(0, fo.p[1] + (fo.hy * c + fo.by * sn) * rad),
          fo.p[2] + (fo.hz * c + fo.bz * sn) * rad,
        ];
        const closed = [
          fb.p[0] + (fb.hx * c + fb.bx * sn) * rad * 0.7,
          Math.max(0, fb.p[1] + (fb.hy * c + fb.by * sn) * rad * 0.7),
          fb.p[2] + (fb.hz * c + fb.bz * sn) * rad * 0.7,
        ];
        add(open, closed, delay, part, s / sides, t);
      }
    }
    const cols = sides + 1;
    for (let k = 0; k < segs; k++) {
      for (let s = 0; s < sides; s++) {
        const a = base + k * cols + s;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        const n = triNormal(pos, a, b, d);
        const ex = pos[a * 3] + pos[b * 3];
        const ez = pos[a * 3 + 2] + pos[b * 3 + 2];
        if (n[0] * ex + n[2] * ez < 0) index.push(a, c, b, b, c, d);
        else index.push(a, b, c, b, d, c);
      }
    }
  }
  return { pos, bud, meta, uv, index, add, addGrid, addCurve };
}

function normalsOf(src, index) {
  const n = new Float32Array(src.length);
  const pos = src instanceof Float32Array ? src : Float32Array.from(src);
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
    const bx = pos[b] - pos[a], by = pos[b + 1] - pos[a + 1], bz = pos[b + 2] - pos[a + 2];
    const cx = pos[c] - pos[a], cy = pos[c + 1] - pos[a + 1], cz = pos[c + 2] - pos[a + 2];
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    n[a] += nx; n[a + 1] += ny; n[a + 2] += nz;
    n[b] += nx; n[b + 1] += ny; n[b + 2] += nz;
    n[c] += nx; n[c + 1] += ny; n[c + 2] += nz;
  }
  for (let i = 0; i < n.length; i += 3) {
    const L = Math.hypot(n[i], n[i + 1], n[i + 2]);
    if (L < 1e-8) { n[i] = 0; n[i + 1] = 1; n[i + 2] = 0; }
    else { n[i] /= L; n[i + 1] /= L; n[i + 2] /= L; }
  }
  return n;
}

function liftPetalNormals(normal, meta) {
  for (let i = 0; i < normal.length / 3; i++) {
    if (meta[i * 2 + 1] > 0.5) continue;
    if (normal[i * 3 + 1] < 0) {
      normal[i * 3] *= -1;
      normal[i * 3 + 1] *= -1;
      normal[i * 3 + 2] *= -1;
    }
  }
  return normal;
}

export function buildFlowerGeometry(genome, detail = 'hi') {
  const R = RES[detail] || RES.hi;
  const g = genome;
  const m = createMeshBuilder();
  for (const whorl of whorlsOf(g)) {
    for (let p = 0; p < g.petals; p++) {
      m.addGrid(R.nu, R.nv, (t, s, pose) => petalPoint(g, p, whorl, t, s, pose), 0, (t) => (1 - t) * 0.38 + (whorl.delay || 0));
    }
  }
  if (g.petaloids) {
    for (let p = 0; p < g.petaloids; p++) {
      const whorl = {
        scale: 0.48 + (p % 3) * 0.05,
        openMul: 0.86,
        y0: 0.07,
        rot: (p + 0.5) / g.petaloids * TAU,
        widthMul: 0.72,
        delay: 0.12,
        inner: true,
      };
      m.addGrid(Math.max(4, R.nu >> 1), Math.max(2, R.nv >> 1), (t, s, pose) => petalPoint(g, p, whorl, t, s, pose), 0, (t) => 0.16 + (1 - t) * 0.3);
    }
  }
  for (let i = 0; i < 5; i++) {
    m.addGrid(R.sepNu, R.sepNv, (t, s, pose) => sepalPoint(g, i, t, s, pose), 5, () => 0.04);
  }
  const pedH = 0.042 * g.length;
  const pedR = 0.02 * g.length;
  m.add([0, 0, 0], [0, 0, 0], 0, 6, 0.5, 0);
  const hub = m.pos.length / 3 - 1;
  const ring = [];
  for (let s = 0; s < R.pedSides; s++) {
    const a = s / R.pedSides * TAU;
    const p = [Math.cos(a) * pedR, 0.004, Math.sin(a) * pedR];
    ring.push(m.add(p, p, 0, 6, s / R.pedSides, 0));
  }
  for (let s = 0; s < R.pedSides; s++) {
    const a = ring[s], b = ring[(s + 1) % R.pedSides];
    m.index.push(hub, b, a);
  }
  m.addCurve(
    (t) => [0, pedH * t, 0],
    (t) => [0, pedH * t, 0],
    () => pedR * 0.92,
    R.pedSeg, R.pedSides, 6, 0,
  );
  const discY = 0.13;
  const discR = 0.22 * g.length;
  const discC = m.add([0, discY, 0], [0, 0.035, 0], 0.2, 0, 0.5, 0.16);
  const discRing = [];
  for (let s = 0; s < 8; s++) {
    const a = s / 8 * TAU;
    discRing.push(m.add(
      [Math.cos(a) * discR, discY, Math.sin(a) * discR],
      [Math.cos(a) * discR * 0.12, 0.035, Math.sin(a) * discR * 0.12],
      0.2, 0, s / 8, 0.16,
    ));
  }
  for (let s = 0; s < 8; s++) m.index.push(discC, discRing[s], discRing[(s + 1) % 8]);
  if (R.organs !== false) {
  for (let i = 0; i < g.stamens; i++) {
    const openAt = (t) => filamentPoint(g, i, g.stamens, t, 'open', g.stamenLen, 0.2);
    const budAt = (t) => filamentPoint(g, i, g.stamens, t, 'bud', g.stamenLen, 0.2);
    m.addCurve(openAt, budAt, (t) => g.length * (0.0062 - 0.0024 * t), R.stSeg, R.stSides, 1, 0.5);
    const tipO = openAt(1);
    const tipB = budAt(1);
    const prevO = openAt(0.82);
    let dx = tipO[0] - prevO[0], dy = tipO[1] - prevO[1], dz = tipO[2] - prevO[2];
    const L = Math.hypot(dx, dy, dz) || 1;
    dx /= L; dy /= L; dz /= L;
    for (let lobe = 0; lobe < R.anth; lobe++) {
      const side = lobe === 0 ? 1 : -1;
      const ox = -dz * side, oz = dx * side;
      const shift = 0.007 * g.length * side * (R.anth > 1 ? 1 : 0);
      m.addCurve(
        (t) => [
          tipO[0] + dx * t * 0.042 + ox * shift,
          tipO[1] + dy * t * 0.042,
          tipO[2] + dz * t * 0.042 + oz * shift,
        ],
        (t) => [
          tipB[0] + t * 0.02,
          tipB[1] + t * 0.02,
          tipB[2],
        ],
        (t) => g.length * 0.02 * Math.sin(Math.PI * Math.min(1, t * 0.7 + 0.2)),
        2, R.stSides, 2, 0.52,
      );
    }
  }
  const pOpen = (t) => filamentPoint(g, 0, 1, t, 'open', g.pistilLen, 0.06);
  const pBud = (t) => filamentPoint(g, 0, 1, t, 'bud', g.pistilLen, 0.16);
  m.addCurve(pOpen, pBud, (t) => g.length * (0.007 - 0.002 * t), R.stSeg, R.stSides, 3, 0.46);
  const endO = pOpen(1);
  const endB = pBud(1);
  m.addCurve(
    (t) => [endO[0], endO[1] + t * 0.03, endO[2]],
    (t) => [endB[0], endB[1] + t * 0.016, endB[2]],
    (t) => g.length * (0.012 + 0.02 * Math.sin(Math.PI * t)),
    2, R.stSides, 4, 0.48,
  );
  }
  const position = Float32Array.from(m.pos);
  const budArr = Float32Array.from(m.bud);
  const indexArr = position.length / 3 > 65535 ? Uint32Array.from(m.index) : Uint16Array.from(m.index);
  return {
    position,
    normal: liftPetalNormals(normalsOf(position, m.index), m.meta),
    bud: budArr,
    budN: liftPetalNormals(normalsOf(budArr, m.index), m.meta),
    meta: Float32Array.from(m.meta),
    uv: Float32Array.from(m.uv),
    index: indexArr,
  };
}

function smoothOpen(delay, bloom) {
  return smoothstep(delay * 0.22, 0.92, bloom);
}

export function auditFlower(genome) {
  const issues = [];
  const preset = FLOWER_PRESETS[genome.preset];
  if (!preset) issues.push('preset ausente');
  if (genome.petals !== 5) issues.push(`pétalas ${genome.petals}`);
  if (genome.stamens < 5 || genome.stamens > 10) issues.push(`estames ${genome.stamens}`);
  if (!(genome.pistilLen > genome.stamenLen)) issues.push('pistilo mais curto que os estames');
  if (!['single', 'semi', 'double', 'hose'].includes(genome.form)) issues.push('verticilo ' + genome.form);
  const openDeg = genome.open / DEG;
  if (preset && (openDeg < preset.openDeg[0] - 3 || openDeg > preset.openDeg[1] + 3)) issues.push(`abertura ${openDeg.toFixed(1)}°`);
  for (const detail of ['hi', 'lod']) {
    const geo = buildFlowerGeometry(genome, detail);
    const n = geo.position.length / 3;
    let anchor = -1;
    for (let i = 0; i < n; i++) {
      if (Math.abs(geo.meta[i * 2 + 1] - 6) > 0.1) continue;
      const d = Math.hypot(geo.position[i * 3], geo.position[i * 3 + 1], geo.position[i * 3 + 2]);
      if (d < 1e-4) anchor = i;
    }
    if (anchor < 0) {
      issues.push(`${detail}: sem âncora do pedicelo`);
      continue;
    }
    const radii = [];
    for (const bloom of [0, 0.3, 0.6, 1]) {
      let maxR = 0;
      let low = false;
      let bad = false;
      for (let i = 0; i < n; i++) {
        const k = smoothOpen(geo.meta[i * 2], bloom);
        const x = geo.bud[i * 3] + (geo.position[i * 3] - geo.bud[i * 3]) * k;
        const y = geo.bud[i * 3 + 1] + (geo.position[i * 3 + 1] - geo.bud[i * 3 + 1]) * k;
        const z = geo.bud[i * 3 + 2] + (geo.position[i * 3 + 2] - geo.bud[i * 3 + 2]) * k;
        if (!Number.isFinite(x + y + z)) bad = true;
        if (y < -0.004) low = true;
        const r = Math.hypot(x, y, z);
        if (r > maxR) maxR = r;
      }
      const ax = geo.bud[anchor * 3] + (geo.position[anchor * 3] - geo.bud[anchor * 3]) * smoothOpen(geo.meta[anchor * 2], bloom);
      const ay = geo.bud[anchor * 3 + 1] + (geo.position[anchor * 3 + 1] - geo.bud[anchor * 3 + 1]) * smoothOpen(geo.meta[anchor * 2], bloom);
      const az = geo.bud[anchor * 3 + 2] + (geo.position[anchor * 3 + 2] - geo.bud[anchor * 3 + 2]) * smoothOpen(geo.meta[anchor * 2], bloom);
      if (Math.hypot(ax, ay, az) > 0.008) issues.push(`${detail}: âncora solta em ${bloom}`);
      if (bad) issues.push(`${detail}: vértice inválido em ${bloom}`);
      if (low) issues.push(`${detail}: malha entra no galho em ${bloom}`);
      radii.push(maxR);
    }
    if (radii[0] > 0.62) issues.push(`${detail}: botão grande (${radii[0].toFixed(2)})`);
    if (radii[3] < 0.72) issues.push(`${detail}: flor não abre (${radii[3].toFixed(2)})`);
    for (let i = 1; i < radii.length; i++) {
      if (radii[i] < radii[i - 1] - 0.02) issues.push(`${detail}: abertura não cresce`);
    }
  }
  return issues;
}

const FLOWER_VS = /* glsl */`
attribute vec2 aLife;
attribute vec3 aFlower;
attribute vec3 aThroat;
attribute vec3 aBud;
attribute vec3 aBudN;
attribute vec2 aMeta;
attribute vec2 aUv;
uniform float uForceBloom;
uniform float uGrowth;
uniform float uTend;
uniform float uTime;
uniform float uWind;
uniform float uWindStr;
uniform float uH;
uniform vec3 uWindDir;
varying float vPart;
varying vec2 vFlowerUv;
varying vec3 vThroat;
varying float vPat;
varying float vSeed;
varying vec3 vColBase;
vec3 lsSway(vec3 p){
  float h = clamp(p.y / max(uH, 1e-3), 0.0, 1.2);
  float k = h * h * uWind * uWindStr * uH * 0.016;
  vec3 w = normalize(uWindDir + vec3(0.001));
  vec3 side = normalize(cross(vec3(0.0, 1.0, 0.0), w));
  float ph = dot(p, w) * 0.35 + dot(p, side) * 0.2;
  return side * (sin(uTime * 1.3 + ph) * k + sin(uTime * 2.9 + p.y * 0.9) * k * 0.25)
       + w * (cos(uTime * 1.07 + ph) * k * 0.35);
}
float lsBloom(){
  float T = pow(uGrowth, 0.8) * uTend;
  float drive = uForceBloom >= 0.0
    ? clamp(uForceBloom, 0.0, 1.0)
    : clamp((T - aLife.x) / max(uTend * 0.30, 0.8), 0.0, 1.0);
  return drive;
}
float lsAlive(){
  float T = pow(uGrowth, 0.8) * uTend;
  float wilt = uForceBloom > 1.0 ? clamp((uForceBloom - 1.0) / 0.45, 0.0, 1.0) : 0.0;
  return smoothstep(aLife.x, aLife.x + 0.12, T) * (1.0 - smoothstep(aLife.y, aLife.y + 0.45, T)) * (1.0 - wilt);
}
float lsK(){
  float start = aFlower.x * 0.42 + aMeta.x * 0.22;
  return smoothstep(start, 0.92, lsBloom());
}
`;

const FLOWER_FS = /* glsl */`
uniform vec3 uSunDir;
uniform float uForceBloom;
uniform float uCheap;
varying float vPart;
varying vec2 vFlowerUv;
varying vec3 vThroat;
varying float vPat;
varying float vSeed;
vec3 lsCol;
vec3 lsPetal(vec3 base, vec3 throat, float pattern, float seed, vec2 uv){
  float s = uv.x * 2.0 - 1.0;
  float t = uv.y;
  vec3 white = vec3(0.985, 0.975, 0.968);
  if (uCheap > 0.5) {
    vec3 col = mix(throat, base, smoothstep(0.05, 0.7, t));
    if (pattern > 0.5 && pattern < 2.5) col = mix(white, throat, 1.0 - smoothstep(0.08, 0.22, abs(s)));
    else if (pattern > 2.5 && pattern < 3.5) col = mix(col, white, smoothstep(0.86, 0.98, max(abs(s), t)));
    else if (pattern > 3.5 && pattern < 4.5) col = mix(base, white, 1.0 - smoothstep(0.0, 0.5, t));
    return col;
  }
  vec3 col = base;
  if (pattern < 0.5) {
    col = mix(throat, base, smoothstep(0.02, 0.7, t));
  } else if (pattern < 1.5) {
    float shift = fract(seed * 5.17);
    float w = 0.075 + 0.05 * fract(seed * 3.9);
    float band = 1.0 - smoothstep(w, w + 0.04, abs(s - mix(-0.4, 0.4, shift)));
    float band2 = (1.0 - smoothstep(w * 0.75, w * 0.75 + 0.045, abs(s - mix(0.2, -0.45, fract(seed * 2.2))))) * step(0.42, fract(seed * 8.1));
    float sector = step(0.8, fract(seed * 4.4)) * (0.5 + 0.5 * sign(s) * sign(fract(seed * 9.0) - 0.5));
    col = mix(white, throat, clamp(max(band, max(band2, sector)), 0.0, 1.0));
  } else if (pattern < 2.5) {
    vec2 gv = vec2(s * 7.0 + seed * 3.0, t * 5.5);
    vec2 cell = floor(gv);
    vec2 f = fract(gv) - 0.5;
    float n = fract(sin(dot(cell, vec2(127.1, 311.7)) + seed * 19.0) * 43758.5);
    float fl = (1.0 - smoothstep(0.08, 0.28, length(f))) * step(0.62, n);
    fl *= 1.0 - smoothstep(0.15, 0.95, t);
    col = mix(white, throat, fl);
  } else if (pattern < 3.5) {
    vec3 body = mix(throat, base, smoothstep(0.02, 0.42, t));
    float pic = max(smoothstep(0.9, 0.995, abs(s)), smoothstep(0.93, 0.995, t));
    col = mix(body, white, clamp(pic, 0.0, 1.0));
  } else if (pattern < 4.5) {
    float blot = (1.0 - smoothstep(0.0, 0.58, t)) * (1.0 - smoothstep(0.25, 0.98, abs(s)));
    col = mix(base, white, blot);
  } else {
    vec3 body = mix(throat, base, smoothstep(0.06, 0.5, t));
    vec2 gv = vec2(s * 16.0 + seed * 3.0, t * 14.0);
    vec2 cell = floor(gv);
    vec2 f = fract(gv) - 0.5;
    float n = fract(sin(dot(cell, vec2(19.1, 47.7)) + seed * 13.0) * 23421.6);
    float dotp = (1.0 - smoothstep(0.08, 0.22, length(f))) * step(0.7, n);
    dotp *= (1.0 - smoothstep(0.08, 0.48, t)) * (1.0 - smoothstep(0.45, 0.95, abs(s)));
    vec3 dotCol = vec3(throat.r * 0.55, throat.g * 0.18, throat.b * 0.32);
    col = mix(body, dotCol, dotp);
  }
  float vein = exp(-pow(s * 16.0, 2.0));
  vein += exp(-pow((s - 0.38) * 20.0, 2.0)) * 0.55;
  vein += exp(-pow((s + 0.38) * 20.0, 2.0)) * 0.55;
  vein *= smoothstep(0.16, 0.38, t) * (1.0 - smoothstep(0.82, 1.0, t));
  col *= 1.0 - 0.07 * vein;
  return max(col, vec3(0.0));
}
vec3 lsOrgan(float part, vec3 base, vec3 throat, float pattern, float seed, vec2 uv){
  if (part > 5.5) return vec3(0.16, 0.34, 0.1);
  if (part > 4.5) return vec3(0.2, 0.42, 0.12) * (0.86 + 0.2 * uv.y);
  if (part > 3.5) return vec3(0.62, 0.66, 0.16);
  if (part > 2.5) return vec3(0.9, 0.84, 0.55);
  if (part > 1.5) return vec3(0.62, 0.4, 0.08);
  if (part > 0.5) return mix(vec3(0.98, 0.94, 0.92), base, 0.12);
  return lsPetal(base, throat, pattern, seed, uv);
}
`;

export function addFlowerMeshes(THREE, group, items, book, detail, uniforms) {
  if (!items || !items.length || !book) return 0;
  const buckets = new Map();
  for (const it of items) {
    const v = it.variant | 0;
    const arr = buckets.get(v);
    if (arr) arr.push(it);
    else buckets.set(v, [it]);
  }
  const cache = new Map();
  const geoOf = (v) => {
    if (cache.has(v)) return cache.get(v);
    const raw = buildFlowerGeometry(book.variants[v] || book.variants[0], detail);
    cache.set(v, raw);
    return raw;
  };
  let made = 0;
  for (const [v, arr] of buckets) {
    const raw = geoOf(v);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(raw.position, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(raw.normal, 3));
    geo.setAttribute('aBud', new THREE.BufferAttribute(raw.bud, 3));
    geo.setAttribute('aBudN', new THREE.BufferAttribute(raw.budN, 3));
    geo.setAttribute('aMeta', new THREE.BufferAttribute(raw.meta, 2));
    geo.setAttribute('aUv', new THREE.BufferAttribute(raw.uv, 2));
    geo.setIndex(new THREE.BufferAttribute(raw.index, 1));
    const count = arr.length;
    const mats = new Float32Array(count * 16);
    const cols = new Float32Array(count * 3);
    const lives = new Float32Array(count * 2);
    const flower = new Float32Array(count * 3);
    const throat = new Float32Array(count * 3);
    const m4 = new THREE.Matrix4();
    const x = new THREE.Vector3();
    const y = new THREE.Vector3();
    const z = new THREE.Vector3();
    const c = new THREE.Color();
    arr.forEach((it, i) => {
      y.set(it.y.x, it.y.y, it.y.z).normalize();
      z.set(it.z.x, it.z.y, it.z.z);
      x.crossVectors(y, z);
      if (x.lengthSq() < 1e-8) x.set(1, 0, 0);
      x.normalize();
      z.crossVectors(x, y).normalize();
      const s = it.s || 0.05;
      m4.makeBasis(x.multiplyScalar(s), y.multiplyScalar(s), z.multiplyScalar(s));
      m4.setPosition(it.p.x, it.p.y, it.p.z);
      m4.toArray(mats, i * 16);
      c.setHSL(((it.baseH % 360) + 360) % 360 / 360, THREE.MathUtils.clamp(it.baseS, 0, 1), THREE.MathUtils.clamp(it.baseL, 0, 1));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      c.setHSL(((it.throatH % 360) + 360) % 360 / 360, THREE.MathUtils.clamp(it.throatS, 0, 1), THREE.MathUtils.clamp(it.throatL, 0, 1));
      throat[i * 3] = c.r; throat[i * 3 + 1] = c.g; throat[i * 3 + 2] = c.b;
      const life = it.life || [0, 1e9];
      lives[i * 2] = life[0];
      lives[i * 2 + 1] = life[1];
      flower[i * 3] = it.phase || 0;
      flower[i * 3 + 1] = it.pattern || 0;
      flower[i * 3 + 2] = it.patSeed || 0;
    });
    geo.setAttribute('aLife', new THREE.InstancedBufferAttribute(lives, 2));
    geo.setAttribute('aFlower', new THREE.InstancedBufferAttribute(flower, 3));
    geo.setAttribute('aThroat', new THREE.InstancedBufferAttribute(throat, 3));
    const cheap = detail === 'lod';
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.52,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
      metalness: 0,
      side: cheap ? THREE.FrontSide : THREE.DoubleSide,
    });
    mat.emissive = new THREE.Color(0x000000);
    const U = uniforms.plant;
    const S = uniforms.shared;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uGrowth = S.uGrowth;
      sh.uniforms.uTime = S.uTime;
      sh.uniforms.uWind = S.uWind;
      sh.uniforms.uWindDir = S.uWindDir;
      sh.uniforms.uWindStr = S.uWindStr;
      sh.uniforms.uForceBloom = S.uForceBloom;
      sh.uniforms.uSunDir = S.uSunDir;
      sh.uniforms.uTend = U.uTend;
      sh.uniforms.uH = U.uH;
      sh.uniforms.uCheap = { value: cheap ? 1 : 0 };
      sh.vertexShader = FLOWER_VS + sh.vertexShader
        .replace('#include <beginnormal_vertex>', `vec3 objectNormal = normalize(mix(aBudN, vec3(normal), lsK()));
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`)
        .replace('#include <begin_vertex>', `vec3 transformed = mix(aBud, vec3(position), lsK()) * lsAlive();
vPart = aMeta.y;
vFlowerUv = aUv;
vThroat = aThroat;
vPat = aFlower.y;
vSeed = aFlower.z;`)
        .replace('#include <project_vertex>', `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
	mvPosition.xyz += lsSway(instanceMatrix[3].xyz);
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`);
      sh.fragmentShader = FLOWER_FS + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
lsCol = lsOrgan(vPart, diffuseColor.rgb, vThroat, vPat, vSeed, vFlowerUv);
if (uForceBloom > 1.0) {
  float wilt = clamp((uForceBloom - 1.0) / 0.45, 0.0, 1.0);
  lsCol = mix(lsCol, vec3(0.93, 0.91, 0.9), wilt * 0.85);
}
diffuseColor.rgb = lsCol;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += lsCol * 0.08;`)
        .replace('#include <opaque_fragment>', `{
  vec3 sunV = normalize(mat3(viewMatrix) * uSunDir);
  float ndl = dot(normalize(normal), sunV);
  if (uCheap > 0.5) {
    outgoingLight = max(outgoingLight, lsCol * 0.75);
  } else {
    float transmit = pow(saturate(0.35 - ndl * 0.7), 1.15);
    float wrap = saturate(ndl * 0.32 + 0.78);
    float fres = pow(1.0 - saturate(abs(dot(normalize(normal), normalize(vViewPosition)))), 2.0);
    outgoingLight = mix(lsCol * (0.62 + 0.38 * wrap), outgoingLight, 0.42);
    float cup = vPart < 0.5 ? exp(-vFlowerUv.y * vFlowerUv.y * 5.0) : 0.0;
    outgoingLight += lsCol * (transmit * 0.32 + fres * 0.06 + cup * 0.22);
    outgoingLight = max(outgoingLight, lsCol * 0.62);
  }
}
#include <opaque_fragment>`);
    };
    mat.customProgramCacheKey = () => cheap ? 'lsys-flower-7-lod' : 'lsys-flower-7';
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix = new THREE.InstancedBufferAttribute(mats, 16);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(cols, 3);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData.kind = 'flower';
    mesh.userData.fullCount = count;
    group.add(mesh);
    made += count;
  }
  return made;
}
