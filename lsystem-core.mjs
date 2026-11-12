/** L-System core — worker-safe (no THREE.js) */
import {
  ENV_DEFAULT, genomeFromSeed, mergeGenome, applyGenomeToPlant, applyGravitySag, clusterFoliage, deflectRoots,
  envSunDir, envWindDir, makeSunShade, phototropismBias, lightGradientAt,
} from './v8-engine.mjs';

export const DEG = Math.PI / 180;
export const ORDER = ['carvalho', 'pinheiro', 'samambaia', 'arbusto', 'salgueiro'];
export const RARE = ['dragoeiro', 'baoba', 'eucalipto', 'figueira', 'sequoia'];
export const BONSAI = ['bordo', 'pinheiro_branco', 'cipreste', 'junipero'];
export let ALL = [...ORDER, ...RARE, ...BONSAI];

/** Minimal Vec3 for turtle + instances (worker-safe). */
export class Vec3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vec3(this.x, this.y, this.z); }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  setFromColor(c) { this.x = c.r; this.y = c.g; this.z = c.b; return this; }
  toArray(array = [], offset = 0) { array[offset] = this.x; array[offset + 1] = this.y; array[offset + 2] = this.z; return array; }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const L = this.length() || 1; this.x /= L; this.y /= L; this.z /= L; return this; }
  negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  crossVectors(a, b) { const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x; this.x = x; this.y = y; this.z = z; return this; }
  cross(v) { return new Vec3(this.y * v.z - this.z * v.y, this.z * v.x - this.x * v.z, this.x * v.y - this.y * v.x); }
  applyAxisAngle(axis, ang) {
    const x = axis.x, y = axis.y, z = axis.z, c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
    const vx = this.x, vy = this.y, vz = this.z;
    this.x = (t * x * x + c) * vx + (t * x * y - s * z) * vy + (t * x * z + s * y) * vz;
    this.y = (t * x * y + s * z) * vx + (t * y * y + c) * vy + (t * y * z - s * x) * vz;
    this.z = (t * x * z - s * y) * vx + (t * y * z + s * x) * vy + (t * z * z + c) * vz;
    return this;
  }
}

function clamp01(x) { return Math.min(1, Math.max(0, x)); }
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360; s = clamp01(s); l = clamp01(l);
  let r, g, b;
  if (s === 0) r = g = b = l;
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
  }
  const c = { r, g, b };
  c.clone = () => hsl(h * 360, s, l);
  c.multiplyScalar = (m) => { c.r *= m; c.g *= m; c.b *= m; return c; };
  c.offsetHSL = (dh, ds, dl) => hsl(h * 360 + dh, clamp01(s + ds), clamp01(l + dl));
  return c;
}

const V3 = Vec3;

const MAX_MODULES = 140000;  // teto de tamanho da palavra
const MAX_NODES = 30000;     // teto de nós do esqueleto
const MAX_INST = 45000;      // teto de instâncias por tipo
const MIN_R = 0.004;

/* =====================================================================
   1. PRNG determinística: cyrb128 (hash da string) -> sfc32
   ===================================================================== */
export function cyrb128(str) {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= (h2 ^ h3 ^ h4); h2 ^= h1; h3 ^= h1; h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}
function sfc32(a, b, c, d) {
  return function () {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0; a = b ^ b >>> 9; b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11); c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
export class Rand {
  constructor(str) { this.next = sfc32(...cyrb128(str)); for (let i = 0; i < 15; i++) this.next(); }
  f() { return this.next(); }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  jit(x) { return (this.next() * 2 - 1) * x; }
}
export const hex = (str) => cyrb128(str).map(x => x.toString(16).padStart(8, '0')).join('');
export const n = (x) => +(+x).toFixed(3);

/* =====================================================================
   2. Motor L-System genérico (paramétrico + estocástico + tempo de nascimento)
   Módulo = { c: símbolo, p: [parâmetros] | null, t0, t1: nascimento, die: morte }
   Regra  = string | (params, rng) => string | [{w, s}] (estocástica)
   Tempo de desenvolvimento: a iteração i ocupa a janela [i, i+1]; os F de um
   sucessor crescem em sequência dentro dessa janela. Regras identidade (F→F')
   herdam o tempo (o mesmo entrenó, só alongado).
   ===================================================================== */
const TOKEN = /([^\s(),])(?:\(([^)]*)\))?/g;
function parseWord(str) {
  const out = [];
  TOKEN.lastIndex = 0; let m;
  while ((m = TOKEN.exec(str))) out.push({ c: m[1], p: m[2] !== undefined ? m[2].split(',').map(Number) : null });
  return out;
}
function applyRule(rule, m, rng) {
  if (typeof rule === 'function') return rule(m.p || [], rng);
  if (Array.isArray(rule)) { // estocástica com pesos
    const tot = rule.reduce((a, r) => a + r.w, 0); let x = rng.f() * tot;
    for (const r of rule) { if ((x -= r.w) <= 0) return typeof r.s === 'function' ? r.s(m.p || [], rng) : r.s; }
    return rule[rule.length - 1].s;
  }
  return rule;
}
function stamp(mods, i) {
  let nF = 0; for (const m of mods) if (m.c === 'F') nF++;
  const d = Math.max(nF, 1); let k = 0;
  for (const m of mods) { if (m.c === 'F') { m.t0 = i + k / d; k++; m.t1 = i + k / d; } else { m.t0 = m.t1 = i + k / d; } }
}
function rewrite(word, rules, rng, i, juvenile, jrng, def_jlife) {
  const out = [];
  for (const m of word) {
    const rule = rules[m.c];
    if (rule === undefined) { out.push(m); continue; }
    const succ = applyRule(rule, m, rng);
    if (succ == null) { out.push(m); continue; }
    const S = parseWord(succ);
    if (S.length === 1 && S[0].c === m.c) { S[0].t0 = m.t0; S[0].t1 = m.t1; S[0].die = m.die; out.push(S[0]); continue; }
    if (juvenile && juvenile[m.c]) { // folhas juvenis do ápice: vivem até o novo crescimento assumir
      const J = parseWord(applyRule(juvenile[m.c], m, jrng) || '');
      out.push({ c: '[', p: null, t0: m.t1, t1: m.t1 });
      for (const x of J) { if (x.c === 'F' || x.c === 'f') continue; x.t0 = x.t1 = m.t1; x.die = i + (def_jlife ?? 1.15); out.push(x); }
      out.push({ c: ']', p: null, t0: m.t1, t1: m.t1 });
    }
    stamp(S, i);
    for (let k = 0; k < S.length; k++) out.push(S[k]);
  }
  return out;
}
export function runLSystem(def, iterations, rng, jrng) {
  let word = parseWord(def.axiom), done = 0;
  stamp(word, 0);
  for (; done < iterations; done++) {
    const next = rewrite(word, def.rules, rng, done + 1, def.juvenile, jrng, def.juvenileLife);
    if (next.length > MAX_MODULES) break;
    word = next;
  }
  if (def.finalize) word = rewrite(word, def.finalize, rng, done + 1, null, null); // pontas -> folhas/flores
  return { word, done, tEnd: done + 3.0 };
}
const wordToString = (w, max = 600) => {
  let s = ''; for (const m of w) { s += m.c + (m.p ? '(' + m.p.map(v => +v.toFixed(2)).join(',') + ')' : ''); if (s.length > max) return s.slice(0, max) + ' …'; }
  return s;
};

/* =====================================================================
   3. Tartaruga 3D (H = heading, L = left, U = up) -> esqueleto de nós
   F f + - & ^ \ / | [ ] ~  +  L (folha)  K (flor)  O (orbe)  N (tufo de agulhas)
   v4: $ (tropismo para um ponto atrator P.attractor)
   v5: W(seg) (raiz aérea: desce na vertical até o chão e vira tronco secundário)  Y(s) (fruto pendente)
   v6: Z(rx, ry, n, s) (almofada de folhagem do bonsai)  Q(w) (peso extra na ponta: raízes do nebari)  J (galho morto: jin)  _(k) (nivela a direção)
   Cada F cria um nó {posição, pai, t0, t1}. Os raios saem depois do esqueleto.
   ===================================================================== */
const GRAV = new Vec3(0, -1, 0);
const UPV = new Vec3(0, 1, 0);
export function interpret(word, sp, P, rng, cap) {
  const X = [0], Y = [0], Z = [0], PAR = [-1], T0 = [0], T1 = [0], BOOST = [], TIPW = [], JIN = [];
  const inst = {};
  const add = (k, it) => { const a = inst[k] || (inst[k] = []); if (a.length < MAX_INST) { it.node = st.node; it.arc = st.arc; a.push(it); } };
  let st = { pos: new V3(), H: new V3(0, 1, 0), L: new V3(-1, 0, 0), U: new V3(0, 0, 1), trop: 0, node: 0, att: 0, arc: 0 };
  const stack = [];
  const ax = new V3(), tv = new V3();
  const clone = (s) => ({ pos: s.pos.clone(), H: s.H.clone(), L: s.L.clone(), U: s.U.clone(), trop: s.trop, node: s.node, att: s.att, arc: s.arc, jin: s.jin });
  const defA = (P.angle || 25) * DEG;
  const roll = (sp.leafRoll ?? 35) * DEG;
  const life = (m) => [Math.max(m.t1 ?? 0, T1[st.node]), m.die ?? 1e9];
  for (const m of word) {
    const p = m.p, a = p ? p[0] * DEG : defA;
    switch (m.c) {
      case 'F': case 'f': {
        const len = p ? p[0] : 1;
        st.pos.addScaledVector(st.H, len); st.arc += len;
        if (m.c === 'F' && len > 1e-5 && X.length < MAX_NODES) {
          const par = st.node; let t0 = m.t0 ?? 0, t1 = m.t1 ?? t0;
          if (t0 < T1[par]) { const dd = Math.max(t1 - t0, 0.02); t0 = T1[par]; t1 = t0 + dd; }
          X.push(st.pos.x); Y.push(st.pos.y); Z.push(st.pos.z); PAR.push(par); T0.push(t0); T1.push(t1);
          st.node = X.length - 1;
          if (st.jin) JIN.push(st.node); // v6: nó de galho morto
        }
        if (st.trop !== 0) { // tropismo (gravidade / fototropismo)
          ax.crossVectors(st.H, GRAV); const mag = ax.length();
          if (mag > 1e-6) { ax.multiplyScalar(1 / mag); const ang = st.trop * mag; st.H.applyAxisAngle(ax, ang); st.L.applyAxisAngle(ax, ang); st.U.applyAxisAngle(ax, ang); }
        }
        if (st.att !== 0 && P.attractor) { // v4: tropismo para um ponto (P.attractor; o junípero usa para inclinar a copa)
          const A = P.attractor; tv.set(A[0] - st.pos.x, A[1] - st.pos.y, A[2] - st.pos.z).normalize();
          ax.crossVectors(st.H, tv); const mag = ax.length();
          if (mag > 1e-6) { ax.multiplyScalar(1 / mag); const ang = st.att * mag; st.H.applyAxisAngle(ax, ang); st.L.applyAxisAngle(ax, ang); st.U.applyAxisAngle(ax, ang); }
        }
        st.H.normalize(); st.L.crossVectors(st.U, st.H).normalize(); st.U.crossVectors(st.H, st.L);
        break;
      }
      case '+': st.H.applyAxisAngle(st.U, a); st.L.applyAxisAngle(st.U, a); break;
      case '-': st.H.applyAxisAngle(st.U, -a); st.L.applyAxisAngle(st.U, -a); break;
      case '&': st.H.applyAxisAngle(st.L, a); st.U.applyAxisAngle(st.L, a); break;
      case '^': st.H.applyAxisAngle(st.L, -a); st.U.applyAxisAngle(st.L, -a); break;
      case '\\': st.L.applyAxisAngle(st.H, a); st.U.applyAxisAngle(st.H, a); break;
      case '/': st.L.applyAxisAngle(st.H, -a); st.U.applyAxisAngle(st.H, -a); break;
      case '|': st.H.applyAxisAngle(st.U, Math.PI); st.L.applyAxisAngle(st.U, Math.PI); break;
      case '~': st.trop = p ? p[0] : 0; break;
      case '[': stack.push(clone(st)); break;
      case ']': if (stack.length) st = stack.pop(); break;
      case 'L': {
        const z = st.U.clone().applyAxisAngle(st.H, rng.jit(roll));
        add('leaf', { p: st.pos.clone(), y: st.H.clone(), z, s: p ? p[0] : 1, life: life(m) });
        break;
      }
      case 'K': {
        const s = p ? p[0] : 1, np = P.petals || 5, open = (P.open || 60) * DEG, off = rng.f() * Math.PI * 2;
        const layers = P.double ? 2 : 1, lf = life(m);
        for (let l = 0; l < layers; l++) {
          for (let i = 0; i < np; i++) {
            const ang = off + (i + l * 0.5) / np * Math.PI * 2 + rng.jit(0.12);
            const r = st.L.clone().multiplyScalar(Math.cos(ang)).addScaledVector(st.U, Math.sin(ang));
            const t = st.L.clone().multiplyScalar(-Math.sin(ang)).addScaledVector(st.U, Math.cos(ang));
            const o = open * (l ? 0.55 : 1) + rng.jit(0.1);
            const dir = st.H.clone().multiplyScalar(Math.cos(o)).addScaledVector(r, Math.sin(o)).normalize();
            const nrm = new V3().crossVectors(dir, t).normalize();
            add('petal', { p: st.pos.clone(), y: dir, z: nrm, s: s * (l ? 0.72 : 1), life: lf, layer: l });
          }
        }
        add('center', { p: st.pos.clone().addScaledVector(st.H, s * 0.06), y: st.H.clone(), z: st.U.clone(), s: s * 0.17, life: lf });
        break;
      }
      case 'O': add('orb', { p: st.pos.clone(), y: st.H.clone(), z: st.U.clone(), s: p ? p[0] : 0.1, life: life(m) }); break;
      case '$': st.att = p ? p[0] : 0; break;
      case 'W': { // v5: raiz aérea da figueira: cadeia de nós até y = 0, nasce depois do módulo e desce em sp.rootDrop iterações
        if (st.pos.y < 0.8 || X.length + 40 >= MAX_NODES) break;
        const seg = p ? p[0] : 0.5, k = Math.max(2, Math.ceil(st.pos.y / seg)), drop = sp.rootDrop ?? 1.5;
        const tb = Math.max(m.t1 ?? 0, T1[st.node]) + (p && p[1] != null ? p[1] : 0.2);
        let par = st.node, x = st.pos.x, z = st.pos.z; const y0 = st.pos.y, a0 = X.length;
        for (let j = 1; j <= k; j++) {
          x += rng.jit(0.04); z += rng.jit(0.04);
          X.push(x); Y.push(y0 * (1 - j / k)); Z.push(z); PAR.push(par); T0.push(tb + drop * (j - 1) / k); T1.push(tb + drop * j / k);
          par = X.length - 1;
        }
        BOOST.push({ a: a0, i: par, t: tb + drop, f: rng.f() < 0.45 ? rng.range(0.25, 0.42) : rng.range(0.06, 0.16) });
        break;
      }
      case 'Y': add('fruit', { p: st.pos.clone(), y: UPV.clone(), z: new V3(1, 0, 0).applyAxisAngle(UPV, rng.f() * 6.28), s: p ? p[0] : 0.3, life: life(m) }); break;
      case 'Z': { // v6: almofada de folhagem (nuvem achatada em forma de domo, folhas viradas para cima)
        const rx = p ? p[0] : 0.5, ry = p && p[1] != null ? p[1] : rx * 0.35, k = p && p[2] != null ? p[2] : 30, s = p && p[3] != null ? p[3] : 0.2;
        if (cap && cap.syms.Z) { cap.out.push({ node: st.node, c: 'Z', p: m.p, d: [st.H.x, st.H.y, st.H.z] }); break; } // v7: no andaime a almofada vira gema
        const kind = sp.padKind || 'leaf', lf = life(m), up = sp.padUp ?? 0.55;
        for (let i = 0; i < k; i++) {
          const a = rng.f() * 6.2832, r = Math.sqrt(rng.f()), top = Math.sqrt(Math.max(1 - r * r, 0));
          const yy = ry * (top * (0.35 + 0.65 * rng.f()) - 0.25);
          const pos = new V3(st.pos.x + Math.cos(a) * r * rx, st.pos.y + ry * 0.35 + yy, st.pos.z + Math.sin(a) * r * rx);
          const out = new V3(Math.cos(a) * (0.3 + r), 0, Math.sin(a) * (0.3 + r)).normalize();
          const y = kind === 'needles' ? out.clone().multiplyScalar(1 - up).add(new V3(rng.jit(0.3), up + 0.4 * top, rng.jit(0.3))).normalize()
            : out.clone().applyAxisAngle(UPV, rng.jit(1.2)).add(new V3(0, up * (0.3 + 0.6 * rng.f()), 0)).normalize();
          const side = new V3(-y.z, 0, y.x); if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
          const z = new V3().crossVectors(y, side.normalize()).normalize(); if (z.y < 0) z.negate();
          const d = rng.f() * 0.7;
          const a0 = inst[kind] || (inst[kind] = []);
          if (a0.length < MAX_INST) a0.push({ p: pos, y, z, s: s * (0.75 + 0.5 * rng.f()), life: [lf[0] + d, lf[1]], node: st.node, arc: st.arc });
        }
        break;
      }
      case 'Q': TIPW.push([st.node, p ? p[0] : 1]); break; // v6
      case 'J': st.jin = true; break; // v6
      case '_': { // v6: nivela a direção (k = 1: horizontal) e põe U para cima, para galhos e almofadas planas
        const k = p ? p[0] : 1; st.H.addScaledVector(UPV, -k * st.H.dot(UPV));
        if (st.H.lengthSq() < 1e-6) st.H.set(1, 0, 0);
        st.H.normalize(); st.L.crossVectors(UPV, st.H).normalize(); st.U.crossVectors(st.H, st.L); break;
      }
      case 'N': add('needles', { p: st.pos.clone(), y: st.H.clone(), z: st.U.clone().applyAxisAngle(st.H, rng.f() * 6.28), s: p ? p[0] : 0.3, life: life(m) }); break;
      default: if (cap && cap.syms[m.c]) cap.out.push({ node: st.node, c: m.c, p: m.p, d: [st.H.x, st.H.y, st.H.z] }); // v7: gemas do andaime da simulação
    }
  }
  const N = X.length;
  const sk = { N, X: Float32Array.from(X), Y: Float32Array.from(Y), Z: Float32Array.from(Z), PAR: Int32Array.from(PAR), T0: Float32Array.from(T0), T1: Float32Array.from(T1) };
  if (BOOST.length) sk.boost = BOOST;
  if (TIPW.length) sk.tipw = TIPW;
  if (JIN.length) sk.jin = JIN;
  return { sk, inst };
}
/* =====================================================================
   6. As 5 espécies
   ===================================================================== */
// hsl imported above
const leafStr = (r, size, pitch = 50) => `[/(${n(r.f() * 360)})&(${n(pitch + r.jit(15))})L(${n(size * (0.8 + r.f() * 0.4))})]`;

export const SPECIES = {
  carvalho: {
    name: 'Carvalho Ancestral', emoji: '🌳', height: 10, theme: 'day', leafKind: 'oak',
    desc: 'Árvore simpodial: cada ápice se divide em 2 ou 3 ramos (regra estocástica), com alongamento dos entrenós ao longo do tempo.',
    baseWidth: 0.7, leafRoll: 50, bump: 0.06, wood: { leo: [2.2, 2.6], G: 0.8, tip: 0.012, ring: 0.55 },
    params(r) {
      const autumn = r.chance(0.3);
      return {
        iterations: r.int(6, 7), angle: r.range(24, 38), div: r.range(95, 140), lenRatio: r.range(0.74, 0.86),
        widthRatio: r.range(0.6, 0.7), trunk: r.range(2.4, 3.6), internode: r.range(1.5, 2.1), p3: r.range(0.35, 0.8),
        gravity: r.range(0.03, 0.16), leafSize: r.range(0.38, 0.56), elong: r.range(1.03, 1.08), lean: r.jit(7),
        autumn, leafH: autumn ? r.range(14, 44) : r.range(80, 125), leafS: autumn ? r.range(0.7, 0.9) : r.range(0.45, 0.75), leafL: autumn ? r.range(0.42, 0.52) : r.range(0.27, 0.38),
        barkH: r.range(18, 32), barkL: r.range(0.17, 0.27),
      };
    },
    show: [['iterations', 'Iterações'], ['angle', 'Ângulo de ramificação', '°'], ['div', 'Divergência (filotaxia)', '°'], ['lenRatio', 'Razão de comprimento'], ['p3', 'Prob. de tricotomia'], ['gravity', 'Gravitropismo'], ['elong', 'Alongamento/iteração'], ['leafSize', 'Tamanho da folha'], ['autumn', 'Outono']],
    build(P) {
      return {
        axiom: `!(1)F(${n(P.trunk)})/(${n(P.lean * 9)})+(${n(P.lean)})A(1)`,
        rules: {
          A: (p, r) => {
            const s = p[0], k = r.chance(P.p3) ? 3 : 2;
            let o = `~(${n(P.gravity)})F(${n(s * P.internode)})`;
            if (s < 0.5) o += leafStr(r, P.leafSize, 60) + leafStr(r, P.leafSize, 60);
            for (let i = 0; i < k; i++) o += `[!(${n(P.widthRatio)})&(${n(P.angle + r.jit(7))})F(${n(s * P.internode * 0.4)})A(${n(s * P.lenRatio * (0.88 + r.f() * 0.24))})]/(${n(k === 2 ? 180 + r.jit(30) : P.div + r.jit(15))})`;
            return o;
          },
          F: (p) => `F(${n(p[0] * P.elong)})`,
        },
        finalize: { A: (p, r) => { let o = ''; for (let i = 0; i < 5; i++) o += leafStr(r, P.leafSize, 30 + r.f() * 50); return o + `F(0.15)L(${n(P.leafSize)})`; } },
        juvenile: { A: (p, r) => { let o = ''; for (let i = 0; i < 5; i++) o += leafStr(r, P.leafSize * 0.9, 35 + r.f() * 40); return o; } }, juvenileLife: 2.6,
        display: [
          `ω : !(1) F(${n(P.trunk)}) A(1)`,
          `A(s) → ~(${n(P.gravity)}) F(s·${n(P.internode)}) { [ !(${n(P.widthRatio)}) &(${n(P.angle)}°±7) F A(s·${n(P.lenRatio)}) ] /(${n(P.div)}°) } × k`,
          `        k = 3 com p=${n(P.p3)} | k = 2 com p=${n(1 - P.p3)}   (estocástica)`,
          `        se s < 0.5: + folhas laterais L`,
          `F(l) → F(l·${n(P.elong)})   (paramétrica: entrenós alongam)`,
          `final: A → 6×[ &(30–80°) L ]  (tufos de folhas nas pontas)`,
        ],
      };
    },
    bark: (P) => [hsl(P.barkH, 0.35, P.barkL), hsl(P.barkH + 10, 0.3, P.barkL + 0.12)],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(P.autumn ? 18 : 8), P.leafS + r.jit(0.1), P.leafL + r.jit(0.07)); },
  },

  pinheiro: {
    name: 'Pinheiro Boreal', emoji: '🌲', height: 12, theme: 'day', leafKind: 'needles',
    desc: 'Crescimento monopodial: o ápice gera um verticilo de galhos por iteração; galhos mais velhos ficam mais longos e formam o cone.',
    baseWidth: 0.5, bump: 0.035, wood: { leo: [2.0, 2.3], G: 0.6, tip: 0.02, ring: 0.5 },
    params(r) {
      const blue = r.chance(0.25);
      return {
        iterations: r.int(11, 13), whorl: r.int(4, 6), angle: r.range(62, 82), rot: r.range(128, 146), internode: r.range(0.7, 0.95),
        branchSeg: r.range(0.42, 0.55), twig: r.range(0.42, 0.6), twigAngle: r.range(45, 65), droop: r.range(0.08, 0.24), apical: r.range(0.9, 0.93),
        skip: r.range(0, 0.18), trunk0: r.range(0.5, 1.0), needleLen: r.range(0.5, 0.72),
        blue, needleH: blue ? r.range(170, 195) : r.range(100, 145), needleS: blue ? r.range(0.15, 0.3) : r.range(0.35, 0.6), needleL: r.range(0.18, 0.27),
        barkH: r.range(12, 24),
      };
    },
    show: [['iterations', 'Iterações (verticilos)'], ['whorl', 'Galhos por verticilo'], ['angle', 'Ângulo dos galhos', '°'], ['rot', 'Rotação entre verticilos', '°'], ['internode', 'Entrenó do tronco'], ['twigAngle', 'Ângulo dos raminhos', '°'], ['droop', 'Caimento (gravidade)'], ['skip', 'Prob. de galho abortado'], ['needleLen', 'Comprimento da agulha'], ['blue', 'Variante azulada']],
    build(P) {
      return {
        axiom: `!(1)F(${n(P.trunk0)})A(1)`,
        rules: {
          A: (p, r) => {
            let o = `F(${n(P.internode * (0.9 + r.f() * 0.2))})`;
            for (let i = 0; i < P.whorl; i++) {
              if (!r.chance(P.skip)) o += `[&(${n(P.angle + r.jit(6))})!(0.3)~(${n(P.droop)})B(${n(P.branchSeg)})]`;
              o += `/(${n(360 / P.whorl + r.jit(10))})`;
            }
            return o + `/(${n(P.rot)})!(${n(P.apical)})A(1)`;
          },
          B: (p, r) => { const l = p[0]; return `N(${n(l)})F(${n(l)})[+(${n(P.twigAngle + r.jit(8))})!(0.6)C(${n(l * P.twig)})][-(${n(P.twigAngle + r.jit(8))})!(0.6)C(${n(l * P.twig)})]B(${n(l * 0.98)})`; },
          C: (p) => p[0] < 0.11 ? `N(${n(p[0])})` : `N(${n(p[0])})F(${n(p[0])})C(${n(p[0] * 0.78)})`,
        },
        juvenile: { A: () => `N(0.45)` },
        finalize: { A: () => `N(0.5)F(0.5)N(0.4)F(0.4)`, B: (p) => `N(${n(p[0])})F(${n(p[0])})`, C: (p) => `N(${n(p[0])})F(${n(p[0])})` },
        display: [
          `ω : !(1) F(${n(P.trunk0)}) A(1)`,
          `A → F(${n(P.internode)}) { [ &(${n(P.angle)}°) !(0.3) ~(${n(P.droop)}) B(${n(P.branchSeg)}) ] /(360/${P.whorl}) } ×${P.whorl}  /(${n(P.rot)}°) !(${n(P.apical)}) A`,
          `        cada galho é abortado com p=${n(P.skip)} (estocástica)`,
          `B(l) → N F(l) [ +(${n(P.twigAngle)}°) C(l·${n(P.twig)}) ] [ -(${n(P.twigAngle)}°) C(l·${n(P.twig)}) ] B(l·0.98)`,
          `C(l) : l ≥ 0.11 → N F(l) C(l·0.78)   |   l < 0.11 → N`,
          `N = tufo de agulhas instanciado`,
        ],
      };
    },
    bark: (P) => [hsl(P.barkH, 0.35, 0.15), hsl(P.needleH - 40, 0.25, 0.17)],
    color(kind, it, P, r) { return hsl(P.needleH + r.jit(7), P.needleS + r.jit(0.08), P.needleL + r.jit(0.05)); },
  },

  samambaia: {
    name: 'Samambaia Espiral', emoji: '🌿', height: 4.5, theme: 'day', leafKind: 'fern',
    desc: 'Roseta de frondes com atraso de brotação; cada fronde se curva (circinação) e gera pinas com folíolos. Frondes jovens ainda enroladas.',
    baseWidth: 0.04, leafRoll: 10, bump: 0, wood: { leo: [2.5, 2.8], G: 0.3, tip: 0.18, ring: 0.15 },
    params(r) {
      const fronds = r.int(8, 13);
      const list = [];
      for (let i = 0; i < fronds; i++) { const t = i / fronds; list.push({ yaw: i * 137.508 + r.jit(12), pitch: 62 - t * 38 + r.jit(6), delay: Math.floor(t * r.range(3, 6)) }); }
      return {
        iterations: r.int(16, 18), fronds, list, curl: r.range(3.5, 7.5), twist: r.jit(3), angle: r.range(58, 78), pinnaLen: r.range(0.36, 0.52),
        seg: r.range(0.3, 0.38), decay: r.range(0.91, 0.935), leafletAngle: r.range(50, 72), leafletSize: r.range(0.13, 0.19),
        leafH: r.range(85, 140), leafS: r.range(0.45, 0.75), leafL: r.range(0.26, 0.4),
      };
    },
    show: [['iterations', 'Iterações'], ['fronds', 'Número de frondes'], ['curl', 'Curvatura por segmento', '°'], ['twist', 'Torção', '°'], ['angle', 'Ângulo das pinas', '°'], ['pinnaLen', 'Comprimento das pinas'], ['decay', 'Decaimento da fronde'], ['leafletAngle', 'Ângulo dos folíolos', '°'], ['leafletSize', 'Tamanho do folíolo']],
    build(P) {
      return {
        axiom: P.list.map(f => `[/(${n(f.yaw)})&(${n(f.pitch)})!(0.22)D(${f.delay})]`).join(''),
        rules: {
          D: (p) => p[0] > 0 ? `D(${p[0] - 1})` : `R(1)`,
          R: (p) => {
            const s = p[0];
            if (s < 0.22) return `F(${n(s * P.seg)})L(${n(P.leafletSize)})`;
            const pl = s * P.pinnaLen;
            return `&(${n(P.curl)})/(${n(P.twist)})F(${n(s * P.seg)})[+(${n(P.angle)})!(0.45)Q(${n(pl)})][-(${n(P.angle)})!(0.45)Q(${n(pl)})]!(0.97)R(${n(s * P.decay)})`;
          },
          Q: (p) => {
            const l = p[0];
            if (l < 0.045) return `L(${n(P.leafletSize * 0.7)})`;
            const ls = n(P.leafletSize * Math.min(1, l * 3 + 0.35));
            return `F(${n(l * 0.26)})[+(${n(P.leafletAngle)})L(${ls})][-(${n(P.leafletAngle)})L(${ls})]Q(${n(l * 0.86)})`;
          },
        },
        finalize: {
          D: () => `F(0.12)&(55)F(0.07)&(60)F(0.06)&(65)F(0.05)&(70)F(0.04)&(75)F(0.03)`,
          R: (p) => { const s = n(p[0] * P.seg * 0.5); return `&(25)F(${s})&(40)F(${s})&(55)F(${n(s * 0.8)})&(65)F(${n(s * 0.6)})&(75)F(${n(s * 0.4)})`; },
          Q: () => `L(${n(P.leafletSize * 0.7)})`,
        },
        display: [
          `ω : { [ /(137.5°·i) &(pitch_i) !(0.22) D(atraso_i) ] } × ${P.fronds}`,
          `D(t) : t > 0 → D(t−1)   |   t = 0 → R(1)      (brotação atrasada)`,
          `R(s) → &(${n(P.curl)}°) /(${n(P.twist)}°) F(s·${n(P.seg)}) [ +(${n(P.angle)}°) Q(s·${n(P.pinnaLen)}) ] [ −(${n(P.angle)}°) Q(s·${n(P.pinnaLen)}) ] R(s·${n(P.decay)})`,
          `Q(l) : l ≥ 0.045 → F(l·0.26) [ +(${n(P.leafletAngle)}°) L ] [ −(${n(P.leafletAngle)}°) L ] Q(l·0.86)`,
          `final: R → báculo enrolado (&25° … &75°),  D → broto em espiral`,
        ],
      };
    },
    bark: (P) => [hsl(P.leafH - 25, 0.45, 0.18), hsl(P.leafH - 5, 0.5, 0.3)],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(6), P.leafS + r.jit(0.06), P.leafL + r.jit(0.05)); },
  },

  arbusto: {
    name: 'Arbusto Florido', emoji: '🌺', height: 5, theme: 'day', leafKind: 'bush',
    desc: 'Arbusto multicaule com regras estocásticas (3 ramos, 2 ramos ou flor precoce). Paleta, nº de pétalas e abertura vêm da seed.',
    baseWidth: 0.17, leafRoll: 40, bump: 0.03, wood: { leo: [2.2, 2.5], G: 0.6, tip: 0.03, ring: 0.4 },
    params(r) {
      const pal = r.pick([
        { name: 'rosa', h: 335, s: 0.75, l: 0.72 }, { name: 'magenta', h: 305, s: 0.7, l: 0.6 }, { name: 'vermelho', h: 355, s: 0.8, l: 0.52 },
        { name: 'coral', h: 12, s: 0.85, l: 0.64 }, { name: 'amarelo', h: 46, s: 0.92, l: 0.6 }, { name: 'lilás', h: 272, s: 0.55, l: 0.72 },
        { name: 'azul', h: 222, s: 0.7, l: 0.66 }, { name: 'branco', h: 40, s: 0.25, l: 0.93 }]);
      return {
        iterations: 5, stems: r.int(4, 6), angle: r.range(18, 32), div: r.range(100, 140), internode: r.range(0.55, 0.8), lenRatio: r.range(0.8, 0.9),
        pBranch3: r.range(0.5, 0.7), pFlower: r.range(0.05, 0.15), petals: r.int(5, 8), open: r.range(48, 78), double: r.chance(0.35),
        flowerSize: r.range(0.15, 0.22), palette: pal.name, petalH: pal.h + r.jit(10), petalS: pal.s, petalL: pal.l, hueSpread: r.range(4, 22),
        leafSize: r.range(0.22, 0.32), leafH: r.range(95, 135), photo: r.range(0.03, 0.09),
      };
    },
    show: [['iterations', 'Iterações'], ['stems', 'Caules na base'], ['angle', 'Ângulo de ramificação', '°'], ['div', 'Divergência', '°'], ['pBranch3', 'Prob. 3 ramos'], ['pFlower', 'Prob. flor precoce'], ['petals', 'Pétalas por flor'], ['open', 'Abertura da flor', '°'], ['double', 'Flor dobrada'], ['palette', 'Paleta'], ['hueSpread', 'Variação de matiz', '°'], ['photo', 'Fototropismo']],
    build(P) {
      const Ar = (s, r) => `&(${n(P.angle + r.jit(6))})F(${n(s * P.internode * 0.5)})${leafStr(r, P.leafSize)}A(${n(s * P.lenRatio)})`;
      const axiom = (() => { const r = new Rand('axiom' + P.petalH); let o = ''; for (let i = 0; i < P.stems; i++) o += `[/(${n(i * 360 / P.stems + r.jit(20))})&(${n(12 + r.f() * 26)})~(${n(-P.photo)})A(1)]`; return o; })();
      return {
        axiom: `!(1)F(0.25)` + axiom,
        rules: {
          A: [
            { w: P.pBranch3, s: (p, r) => { const s = p[0]; return `!(0.72)F(${n(s * P.internode)})${leafStr(r, P.leafSize)}[${Ar(s, r)}]/(${n(P.div)})[${Ar(s, r)}]/(${n(P.div)})[${Ar(s, r)}]`; } },
            { w: 1 - P.pBranch3 - P.pFlower, s: (p, r) => { const s = p[0]; return `!(0.78)F(${n(s * P.internode)})${leafStr(r, P.leafSize)}/(${n(P.div)})[${Ar(s, r)}]${leafStr(r, P.leafSize)}A(${n(s * 0.9)})`; } },
            { w: P.pFlower, s: (p, r) => `F(${n(p[0] * P.internode * 0.6)})${leafStr(r, P.leafSize)}K(${n(P.flowerSize * 0.9)})` },
          ],
        },
        juvenile: { A: (p, r) => leafStr(r, P.leafSize, 40) + leafStr(r, P.leafSize, 40) + leafStr(r, P.leafSize, 40) }, juvenileLife: 2.2,
        finalize: { A: (p, r) => `F(0.12)${leafStr(r, P.leafSize, 70)}K(${n(P.flowerSize * (0.8 + r.f() * 0.35))})` },
        display: [
          `ω : !(1) F(0.25) { [ /(360/${P.stems}·i) &(12–38°) ~(${n(-P.photo)}) A(1) ] } × ${P.stems}`,
          `A(s) →  p=${n(P.pBranch3)} : !(0.72) F(s·${n(P.internode)}) L [B] /(${n(P.div)}°) [B] /(${n(P.div)}°) [B]`,
          `        p=${n(1 - P.pBranch3 - P.pFlower)} : !(0.78) F L /(${n(P.div)}°) [B] L A(s·0.9)`,
          `        p=${n(P.pFlower)} : F K   (flor precoce)`,
          `B(s) ≡ &(${n(P.angle)}°) F L A(s·${n(P.lenRatio)})`,
          `final: A → F L K(flor ${P.petals} pétalas${P.double ? ', dobrada' : ''})`,
        ],
      };
    },
    bark: (P) => [hsl(28, 0.3, 0.2), hsl(P.leafH - 20, 0.4, 0.32)],
    color(kind, it, P, r) {
      if (kind === 'petal') return hsl(P.petalH + r.jit(P.hueSpread), P.petalS + r.jit(0.05), P.petalL + (it.layer ? 0.06 : 0) + r.jit(0.04));
      if (kind === 'center') return hsl(48, 0.9, 0.5);
      return hsl(P.leafH + r.jit(8), 0.55 + r.jit(0.08), 0.32 + r.jit(0.05));
    },
  },

  salgueiro: {
    name: 'Salgueiro Lumínico', emoji: '✨', height: 10, theme: 'night', leafKind: 'willow',
    desc: 'Espécie fantástica: ramos superiores soltam gavinhas pendentes com gravitropismo forte, folhas e orbes bioluminescentes.',
    baseWidth: 0.5, leafRoll: 60, bump: 0.05, wood: { leo: [2.3, 2.6], G: 0.8, tip: 0.015, ring: 0.4, share: 0.75 },
    params(r) {
      const glow = r.pick([{ name: 'ciano', h: 182 }, { name: 'violeta', h: 280 }, { name: 'magenta', h: 318 }, { name: 'esmeralda', h: 150 }, { name: 'âmbar', h: 42 }, { name: 'azul elétrico', h: 212 }]);
      return {
        iterations: r.int(13, 14), trunk: r.range(2.6, 3.6), angle: r.range(26, 40), div: r.range(110, 150), internode: r.range(1.6, 2.1), lenRatio: r.range(0.68, 0.76),
        tendrils: r.int(4, 6), tendrilSeg: r.range(0.38, 0.5), gravity: r.range(0.26, 0.42), orbChance: r.range(0.05, 0.12), orbSize: r.range(0.07, 0.11),
        splitChance: r.range(0.03, 0.09), glow: glow.name, glowH: glow.h + r.jit(8), glow2: r.range(25, 70) * (r.chance(0.5) ? 1 : -1), barkH: r.range(250, 290),
      };
    },
    show: [['iterations', 'Iterações'], ['angle', 'Ângulo de ramificação', '°'], ['div', 'Divergência', '°'], ['lenRatio', 'Razão de comprimento'], ['tendrils', 'Gavinhas por nó'], ['gravity', 'Gravitropismo das gavinhas'], ['orbChance', 'Prob. de orbe'], ['splitChance', 'Prob. de bifurcar gavinha'], ['glow', 'Cor da luz'], ['glow2', 'Desvio de matiz secundário', '°']],
    build(P) {
      return {
        axiom: `!(1)F(${n(P.trunk)})/(30)A(1)`,
        rules: {
          A: (p, r) => {
            const s = p[0];
            if (s > 0.4) {
              const k = r.chance(0.6) ? 3 : 2; let o = `F(${n(s * P.internode)})`;
              for (let i = 0; i < k; i++) o += `[!(0.62)&(${n(P.angle + r.jit(6))})A(${n(s * P.lenRatio * (0.9 + r.f() * 0.2))})]/(${n(P.div + r.jit(15))})`;
              return o;
            }
            let o = `!(0.7)F(${n(s * P.internode)})`;
            for (let i = 0; i < P.tendrils; i++) o += `[!(0.3)/(${n(i * 360 / P.tendrils + r.jit(25))})&(${n(25 + r.f() * 55)})~(${n(P.gravity * (0.8 + r.f() * 0.4))})T(${n(P.tendrilSeg)})]`;
            return o;
          },
          T: (p, r) => {
            const l = p[0]; let o = `F(${n(l)})`;
            if (r.chance(0.7)) o += leafStr(r, 0.42, 40);
            if (r.chance(P.orbChance)) o += `O(${n(P.orbSize * (0.5 + r.f() * 0.6))})`;
            if (r.chance(P.splitChance)) o += `[+(${n(20 + r.f() * 20)})T(${n(l * 0.9)})]`;
            return o + `T(${n(l * 0.97)})`;
          },
        },
        juvenile: { A: (p, r) => leafStr(r, 0.5, 40) + leafStr(r, 0.5, 40) + leafStr(r, 0.5, 40) },
        finalize: { T: () => `O(${n(P.orbSize * 1.3)})`, A: () => `O(${n(P.orbSize)})` },
        display: [
          `ω : !(1) F(${n(P.trunk)}) /(30°) A(1)`,
          `A(s) : s > 0.4 → F(s·${n(P.internode)}) { [ !(0.62) &(${n(P.angle)}°) A(s·${n(P.lenRatio)}) ] /(${n(P.div)}°) } × (2|3)`,
          `       s ≤ 0.4 → !(0.7) F { [ &(25–80°) ~(${n(P.gravity)}) T(${n(P.tendrilSeg)}) ] } × ${P.tendrils}`,
          `T(l) → F(l) [L]? O? [ +T ]? T(l·0.97)   (p_folha=0.7, p_orbe=${n(P.orbChance)}, p_bifurca=${n(P.splitChance)})`,
          `final: T → O (orbe na ponta)`,
        ],
      };
    },
    bark: (P) => [hsl(P.barkH, 0.22, 0.26), hsl(P.barkH, 0.35, 0.36)],
    color(kind, it, P, r) {
      if (kind === 'orb') { const c = hsl(P.glowH + (r.chance(0.35) ? P.glow2 : 0) + r.jit(10), 0.9, 0.62); return c.multiplyScalar(1.3 + r.f() * 1.1); }
      return hsl(P.glowH + P.glow2 * 0.5 + r.jit(14), 0.75, 0.42 + r.jit(0.08));
    },
  },
};

/* Casca procedural (v3): tipo, variante, escala, profundidade, paleta e musgo por espécie + seed (fluxo próprio 'bark').
   type: 0 lisa (lenticelas) · 1 sulcada · 2 placas · 3 raque estriada.  freq = células por unidade de mundo.
   hi/lo = multiplicadores da cor da casca nas cristas/placas e nas fendas. */
const tintV = (r, base, j) => base.map(x => x * (1 + r.jit(j)));
export const BARK = {
  carvalho: (P, r) => {
    const variant = r.pick(['sulcada', 'reticulada', 'escamosa']);
    const v = { sulcada: { type: 1, stretch: r.range(0.12, 0.18), crack: r.range(0.16, 0.24), freq: r.range(8, 11) },
      reticulada: { type: 1, stretch: r.range(0.28, 0.38), crack: r.range(0.2, 0.3), freq: r.range(7, 9) },
      escamosa: { type: 2, stretch: r.range(0.28, 0.38), crack: r.range(0.12, 0.18), freq: r.range(7, 9) } }[variant];
    return { variant, ...v, depth: r.range(0.12, 0.2), fbm: r.range(0.6, 1), lent: 0, hi: tintV(r, [1.45, 1.38, 1.3], 0.08), lo: tintV(r, [0.3, 0.28, 0.28], 0.1),
      moss: r.chance(0.6) ? r.range(0.5, 1) : 0, mossH: r.range(70, 105), mat: 0.4 };
  },
  pinheiro: (P, r) => {
    const variant = r.pick(['placas largas', 'escamas']);
    const v = variant === 'escamas' ? { stretch: r.range(0.6, 0.8), crack: r.range(0.12, 0.18), freq: r.range(7, 10) } : { stretch: r.range(0.35, 0.5), crack: r.range(0.1, 0.15), freq: r.range(3.5, 5) };
    const red = r.range(1.6, 2.4);
    return { variant, type: 2, ...v, depth: r.range(0.12, 0.2), fbm: 0.8, lent: 0, hi: tintV(r, [red, red * 0.72, red * 0.55], 0.06), lo: [0.35, 0.32, 0.32],
      moss: r.chance(0.3) ? r.range(0.3, 0.7) : 0, mossH: r.range(60, 90), mat: 0.35 };
  },
  samambaia: (P, r) => ({ variant: 'raque estriada', type: 3, stretch: 1, crack: 0.1, freq: r.range(18, 26), depth: 0.05, fbm: 0.5, lent: 0,
    hi: [1.1, 1.1, 1.05], lo: [0.85, 0.85, 0.8], moss: 0, mossH: 90, mat: 0.6 }),
  arbusto: (P, r) => {
    const variant = r.pick(['lisa', 'lenticelada']);
    return { variant, type: 0, stretch: 1, crack: 0.1, freq: r.range(10, 14), depth: r.range(0.06, 0.1), fbm: r.range(0.5, 1), lent: variant === 'lisa' ? 0.35 : 1,
      hi: tintV(r, [1.15, 1.12, 1.1], 0.06), lo: [0.6, 0.55, 0.5], moss: 0, mossH: 90, mat: 0.45 };
  },
  salgueiro: (P, r) => {
    const variant = r.pick(['lisa', 'lenticelas luminosas', 'fissurada']);
    const fiss = variant === 'fissurada';
    return { variant, type: fiss ? 1 : 0, stretch: fiss ? r.range(0.15, 0.25) : 1, crack: r.range(0.1, 0.16), freq: fiss ? r.range(5, 7) : r.range(6, 9),
      depth: fiss ? r.range(0.08, 0.12) : 0.06, fbm: 0.7, lent: fiss ? 0 : variant === 'lisa' ? 0.4 : 1, glow: variant === 'lenticelas luminosas' ? 2.2 : 0,
      hi: tintV(r, [1.2, 1.15, 1.25], 0.06), lo: [0.45, 0.42, 0.5], moss: r.chance(0.35) ? r.range(0.3, 0.6) : 0, mossH: P.glowH, mat: 0.4 };
  },
};

/* =====================================================================
   6c. v5: as 5 espécies raras (árvores reais e incomuns)
   Mesmos ganchos da v4, mais: tube.bump (perfil do tronco), wood.boost (raízes aéreas), símbolos W e Y.
   ===================================================================== */
const rosette = (r, k, len, p0, p1) => { let o = ''; for (let i = 0; i < k; i++) { const t = i / Math.max(k - 1, 1); o += `[/(${n(i * 137.508 + r.jit(8))})&(${n(p0 + (p1 - p0) * t + r.jit(6))})L(${n(len * (0.75 + 0.35 * (1 - t)) * (0.9 + r.f() * 0.2))})]`; } return o; };

Object.assign(SPECIES, {
  dragoeiro: {
    name: 'Dragoeiro de Socotra', emoji: '🐉', height: 8, theme: 'arido', leafKind: 'strap', fx: 'dragoeiro',
    desc: 'Dracaena cinnabari: ramificação dicotômica repetida (cada ponta se divide em duas, em planos alternados) formando uma copa de guarda-chuva densa, com rosetas de folhas rígidas só nas pontas. A seed decide se há escorridos de resina vermelha (sangue de dragão).',
    baseWidth: 0.42, leafRoll: 15, bump: 0.03, wood: { leo: [2.1, 2.4], G: 0.6, tip: 0.035, ring: 0.35 },
    params(r) {
      const sap = r.chance(0.55);
      return {
        iterations: r.int(7, 8), trunk: r.range(2.6, 3.6), angle: r.range(30, 40), ratio: r.range(0.8, 0.86), internode: r.range(0.75, 0.95), up: r.range(0.08, 0.14),
        leafLen: r.range(0.75, 1.0), leaves: r.int(16, 24), sap, sapAmt: sap ? r.range(0.6, 1) : 0, leafH: r.range(95, 135), leafS: r.range(0.25, 0.45), leafL: r.range(0.3, 0.38), barkH: r.range(25, 45),
      };
    },
    show: [['iterations', 'Iterações (dicotomias)'], ['trunk', 'Tronco'], ['angle', 'Ângulo da dicotomia', '°'], ['ratio', 'Razão de comprimento'], ['up', 'Tropismo para cima'], ['leaves', 'Folhas por roseta'], ['leafLen', 'Comprimento da folha'], ['sap', 'Sangue de dragão']],
    build(P) {
      return {
        axiom: `!(1)F(${n(P.trunk)})A(1)`,
        rules: {
          A: (p, r) => { const s = p[0], a = n(P.angle + r.jit(5)); return `/(${n(90 + r.jit(12))})~(${n(-P.up)})F(${n(s * P.internode)})[&(${a})A(${n(s * P.ratio * (0.94 + r.f() * 0.12))})][^(${a})A(${n(s * P.ratio * (0.94 + r.f() * 0.12))})]`; },
        },
        finalize: { A: (p, r) => `F(0.12)` + rosette(r, P.leaves, P.leafLen, 8, 78) },
        juvenile: { A: (p, r) => rosette(r, Math.round(P.leaves * 0.8), P.leafLen * 0.9, 8, 70) }, juvenileLife: 1.3,
        display: [
          `ω : !(1) F(${n(P.trunk)}) A(1)`,
          `A(s) → /(90°±12) ~(${n(-P.up)}) F(s·${n(P.internode)}) [ &(${n(P.angle)}°) A(s·${n(P.ratio)}) ] [ ^(${n(P.angle)}°) A(s·${n(P.ratio)}) ]   (dicotomia em planos alternados)`,
          `final: A → roseta de ${P.leaves} folhas em espiral áurea (137,5°), &(8–78°)`,
          `juvenil: A → roseta (a muda é um caule único com uma roseta, como na natureza)`,
          P.sap ? `casca: escorridos de resina vermelha (intensidade ${n(P.sapAmt)})` : `casca: lisa, sem resina exposta`,
        ],
      };
    },
    bark: (P) => [hsl(P.barkH, 0.08, 0.56), hsl(P.leafH - 20, 0.2, 0.42)],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(6), P.leafS + r.jit(0.05), P.leafL + r.jit(0.04)); },
    extra({ P, fxU, sk }) { fxU.uFx.value.set(P.sapAmt, 0, 0, 0); let H = 0; for (let i = 0; i < sk.N; i++) H = Math.max(H, sk.Y[i]); return { points: [new V3(0, H + P.leafLen * 0.8, 0)] }; },
  },

  baoba: {
    name: 'Baobá', emoji: '🪵', height: 8, theme: 'savana', leafKind: 'bush',
    desc: 'Adansonia: tronco maciço em forma de garrafa (expoente de Leonardo exagerado e engrossamento concentrado no tronco) e copa curta e retorcida, que parece um sistema de raízes virado para cima. Casca lisa acinzentada, poucas folhas e, pela seed, frutos pendurados.',
    baseWidth: 1.05, leafRoll: 40, bump: 0.05, wood: { leo: [1.2, 1.32], G: 1.5, tip: 0.07, ring: 0.3, share: 1.6 },
    tube: { bump: (th, arc, g, root, P) => { // perfil de garrafa: base alargada, barriga, ombro arredondado que fecha no topo
      if (!root) return 1; const f = Math.min(arc / P.trunkH, 1);
      const prof = (1 + 0.15 * Math.exp(-f / 0.05) + P.bulge * Math.sin(Math.PI * Math.min(f / 0.9, 1))) * (1 - 0.5 * Math.pow(Math.max(f - 0.72, 0) / 0.28, 1.3));
      return prof * (1 + 0.035 * Math.sin(5 * th + 2 * f) + 0.025 * Math.sin(9 * th - 3 * f)); } },
    params(r) {
      const fruits = r.chance(0.7);
      return {
        iterations: r.int(4, 5), trunkH: r.range(4.2, 5.4), segs: 6, bulge: r.range(0.2, 0.4), limbs: r.int(4, 7), angle: r.range(50, 72), gnarl: r.range(20, 34), ratio: r.range(0.6, 0.68), len: r.range(0.75, 0.95),
        leafP: r.range(0.35, 0.7), leafSize: r.range(0.22, 0.3), fruits, fruitP: fruits ? r.range(0.25, 0.45) : 0, fruitSize: r.range(0.45, 0.6), barkH: r.range(15, 35), leafH: r.range(85, 115),
      };
    },
    show: [['iterations', 'Iterações da copa'], ['trunkH', 'Altura do tronco'], ['bulge', 'Barriga da garrafa'], ['limbs', 'Galhos principais'], ['angle', 'Ângulo dos galhos', '°'], ['gnarl', 'Retorcimento', '°'], ['ratio', 'Razão de comprimento'], ['leafP', 'Densidade de folhas'], ['fruits', 'Frutos pendurados']],
    build(P) {
      const seg = n(P.trunkH / P.segs);
      return {
        axiom: `!(1)${`F(${seg})`.repeat(P.segs)}C`,
        rules: {
          C: (p, r) => { let o = ''; for (let i = 0; i < P.limbs; i++) o += `[/(${n(i * 360 / P.limbs + r.jit(20))})&(${n(P.angle + r.jit(10))})~(-0.04)B(1)]`; return o; },
          B: (p, r) => {
            const s = p[0], g = P.gnarl;
            if (s < 0.3) { let o = `F(${n(s * P.len * 0.8)})`; if (r.chance(P.leafP)) o += leafStr(r, P.leafSize, 50) + leafStr(r, P.leafSize, 50) + leafStr(r, P.leafSize, 50); if (r.chance(P.fruitP)) o += `Y(${n(P.fruitSize * (0.8 + r.f() * 0.4))})`; return o; }
            return `F(${n(s * P.len)})/(${n(r.jit(70))})&(${n(r.jit(g))})F(${n(s * P.len * 0.5)})[&(${n(35 + r.jit(12))})B(${n(s * P.ratio)})][^(${n(25 + r.jit(12))})B(${n(s * P.ratio)})]`;
          },
        },
        finalize: { B: (p, r) => { let o = `F(${n(p[0] * 0.4)})`; if (r.chance(P.leafP)) o += leafStr(r, P.leafSize, 50) + leafStr(r, P.leafSize, 60); if (r.chance(P.fruitP)) o += `Y(${n(P.fruitSize)})`; return o; } },
        juvenile: { C: (p, r) => leafStr(r, P.leafSize * 1.2, 30) + leafStr(r, P.leafSize * 1.2, 45) + leafStr(r, P.leafSize * 1.2, 60) + leafStr(r, P.leafSize * 1.2, 40), B: (p, r) => leafStr(r, P.leafSize, 40) + leafStr(r, P.leafSize, 55) }, juvenileLife: 1.6,
        display: [
          `ω : !(1) F(${seg})×${P.segs} C          (tronco: perfil de garrafa no tubo, barriga ${n(P.bulge)})`,
          `C → { [ /(360/${P.limbs}·i) &(${n(P.angle)}°) ~(−0.04) B(1) ] } × ${P.limbs}`,
          `B(s) → F(s·${n(P.len)}) /(±70°) &(±${n(P.gnarl)}°) F [ &(35°) B(s·${n(P.ratio)}) ] [ ^(25°) B(s·${n(P.ratio)}) ]   (galhos retorcidos)`,
          `       s < 0.3 → F L? ${P.fruits ? 'Y? (fruto pendurado)' : ''}`,
          `madeira: Leonardo e ≈ 1,5 (pais muito mais grossos que os filhos), anéis concentrados no tronco (share 2,5)`,
        ],
      };
    },
    bark: (P) => [hsl(P.barkH, 0.035, 0.56), hsl(P.barkH, 0.06, 0.52)],
    geom: (kind) => kind === 'fruit' ? fruitGeo() : null,
    color(kind, it, P, r) {
      if (kind === 'fruit') return hsl(60 + r.jit(10), 0.22, 0.42 + r.jit(0.05));
      return hsl(P.leafH + r.jit(8), 0.5, 0.3 + r.jit(0.05));
    },
  },

  eucalipto: {
    name: 'Eucalipto Arco-Íris', emoji: '🌈', height: 13, theme: 'day', leafKind: 'euca', fx: 'eucalipto',
    desc: 'Eucalyptus deglupta: tronco alto, reto e liso cuja casca descasca em faixas verticais. Cada placa nasce verde e amadurece para laranja, roxo, azul e vinho; a seed escolhe a paleta e o padrão das faixas. Copa alta e rala, de folhas lanceoladas pendentes.',
    baseWidth: 0.5, leafRoll: 30, bump: 0.015, wood: { leo: [2.3, 2.6], G: 0.6, tip: 0.02, ring: 0.45 },
    params(r) {
      const pal = r.pick([
        { name: 'clássica', c: [[95, 0.6, 0.45], [28, 0.85, 0.52], [285, 0.4, 0.38], [205, 0.35, 0.45], [345, 0.45, 0.3]] },
        { name: 'tropical', c: [[85, 0.65, 0.5], [35, 0.9, 0.55], [12, 0.8, 0.45], [300, 0.35, 0.38], [350, 0.5, 0.28]] },
        { name: 'fria', c: [[110, 0.5, 0.45], [45, 0.7, 0.55], [265, 0.4, 0.42], [215, 0.45, 0.48], [330, 0.3, 0.3]] },
        { name: 'outono', c: [[75, 0.55, 0.45], [32, 0.9, 0.5], [20, 0.75, 0.4], [270, 0.3, 0.35], [0, 0.45, 0.25]] }]);
      const pattern = r.pick(['faixas longas', 'faixas', 'placas']);
      return {
        iterations: r.int(19, 20), n: r.int(13, 15), bare: r.range(0.5, 0.62), internode: r.range(0.9, 1.1), pB: r.range(0.6, 0.85), angle: r.range(55, 72),
        bLen: r.range(1.1, 1.4), leafSize: r.range(0.45, 0.6), palette: pal.name, pal: pal.c, pattern,
        stretch: { 'faixas longas': r.range(0.06, 0.1), faixas: r.range(0.12, 0.18), placas: r.range(0.22, 0.32) }[pattern], cell: r.range(1.1, 1.6), warp: r.range(0.5, 1.1), speed: r.range(3.5, 5), spread: r.range(0.8, 1.6),
        leafH: r.range(100, 130),
      };
    },
    show: [['iterations', 'Iterações'], ['n', 'Entrenós do tronco'], ['bare', 'Fração sem galhos'], ['pB', 'Prob. de galho'], ['angle', 'Ângulo dos galhos', '°'], ['palette', 'Paleta da casca'], ['pattern', 'Padrão das faixas'], ['stretch', 'Alongamento vertical'], ['speed', 'Velocidade de maturação']],
    build(P) {
      const bk = Math.floor(P.n * P.bare);
      return {
        axiom: `!(1)A(0)`,
        rules: {
          A: (p, r) => {
            const k = p[0]; if (k >= P.n) return `B(0.85)`;
            let o = `F(${n(P.internode * (1 - 0.25 * k / P.n))})`;
            if (k >= bk && r.chance(P.pB)) o += `[&(${n(P.angle + r.jit(8))})~(-0.03)B(${n(1 - 0.5 * (k - bk) / (P.n - bk))})]`;
            return o + `/(137.5)A(${k + 1})`;
          },
          B: (p, r) => {
            const s = p[0]; if (s < 0.14) return `F(${n(s * P.bLen)})` + leafStr(r, P.leafSize, 120) + leafStr(r, P.leafSize, 135) + leafStr(r, P.leafSize, 110);
            return `F(${n(s * P.bLen)})${s < 0.4 ? leafStr(r, P.leafSize, 120) + leafStr(r, P.leafSize, 140) + leafStr(r, P.leafSize, 100) : ''}[+(${n(35 + r.jit(10))})B(${n(s * 0.6)})]${r.chance(0.6) ? `[-(${n(30 + r.jit(10))})B(${n(s * 0.55)})]` : ''}/(${n(90 + r.jit(30))})^(${n(6 + r.jit(5))})B(${n(s * 0.8)})`;
          },
        },
        finalize: { B: (p, r) => leafStr(r, P.leafSize, 120) + leafStr(r, P.leafSize, 140) + leafStr(r, P.leafSize, 100), A: () => `` },
        juvenile: { A: (p, r) => leafStr(r, P.leafSize * 1.3, 35) + leafStr(r, P.leafSize * 1.3, 55) + leafStr(r, P.leafSize * 1.3, 75) + leafStr(r, P.leafSize * 1.3, 50) }, juvenileLife: 3,
        display: [
          `ω : !(1) A(0)`,
          `A(k) → F(${n(P.internode)}·(1 − k/4n)) [ &(${n(P.angle)}°) ~(−0.03) B(1 − 0.5·u) ]? /(137.5°) A(k+1)   (galho só se k ≥ ${bk}, p=${n(P.pB)})`,
          `A(${P.n}) → B(0.85)   (topo)`,
          `B(s) → F(s·${n(P.bLen)}) L? [ +(35°) B(s·0.6) ] [ −(30°) B(s·0.55) ]? /(90°±30°) ^(6°) B(s·0.8)    (s < 0.14 → folhas pendentes)`,
          `casca: Voronoi esticado (${P.pattern}), cada placa passa por 5 cores (${P.palette}) conforme a idade do nó`,
        ],
      };
    },
    bark: (P) => [hsl(...P.pal[0]), hsl(...P.pal[0])],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(8), 0.45 + r.jit(0.08), 0.3 + r.jit(0.05)); },
    extra({ P, fxU }) {
      fxU.uFx.value.set(P.speed, P.cell, P.stretch, P.warp); fxU.uFx2.value.set(P.spread, 0, 0, 0);
      fxU.uPal = { value: P.pal.map((c) => { const col = hsl(...c); return new Vec3(col.r, col.g, col.b); }) };
      return null;
    },
  },

  figueira: {
    name: 'Figueira-de-Bengala', emoji: '🌳', height: 9, theme: 'day', leafKind: 'banyan',
    desc: 'Ficus benghalensis: galhos horizontais longos soltam raízes aéreas que descem até o chão; ao tocar o solo elas engrossam com a idade e viram troncos secundários, e uma árvore vira um pequeno bosque. Copa densa de folhas coriáceas.',
    baseWidth: 0.55, leafRoll: 35, bump: 0.06, rootDrop: 1.4, wood: { leo: [2.2, 2.5], G: 0.7, tip: 0.012, ring: 0.4 },
    tube: { bump: (th, arc, g) => 1 + 0.9 * Math.exp(-g.y / 0.3) * (0.75 + 0.25 * Math.cos(5 * th)) },
    params(r) {
      return {
        iterations: r.int(7, 8), trunk: r.range(2.4, 3.0), limbs: r.int(5, 7), limbAngle: r.range(72, 84), seg: r.range(0.85, 1.1), pRoot: r.range(0.25, 0.4), pSide: r.range(0.2, 0.35),
        leafSize: r.range(0.42, 0.55), leafH: r.range(100, 125), leafL: r.range(0.2, 0.27), crown: r.int(3, 4),
      };
    },
    show: [['iterations', 'Iterações'], ['trunk', 'Tronco'], ['limbs', 'Galhos horizontais'], ['limbAngle', 'Ângulo dos galhos', '°'], ['seg', 'Segmento do galho'], ['pRoot', 'Prob. de raiz aérea'], ['pSide', 'Prob. de ramo lateral'], ['leafSize', 'Tamanho da folha']],
    build(P) {
      let axiom = `!(1)`;
      for (let i = 0; i < P.limbs; i++) axiom += `/(137.5)F(${n(P.trunk / P.limbs)})[&(${n(P.limbAngle - i * 2)})~(0.005)B(${n(1 - i * 0.06)})]`;
      axiom += `F(0.3)` + Array.from({ length: P.crown }, (_, i) => `[/(${i * 360 / P.crown})&(40)C(0.9)]`).join('');
      return {
        axiom,
        rules: {
          B: (p, r) => {
            const s = p[0]; if (s < 0.35) return `C(0.45)`;
            let o = `F(${n(P.seg * (0.9 + r.f() * 0.2))})`;
            if (r.chance(P.pRoot)) o += `W(0.5)`;
            o += `[^(${n(60 + r.jit(15))})C(${n(0.35 + 0.3 * s)})]`;
            if (r.chance(P.pSide)) o += `[${r.chance(0.5) ? '+' : '-'}(${n(45 + r.jit(10))})B(${n(s * 0.7)})]`;
            return o + `/(${n(r.jit(30))})B(${n(s * 0.9)})`;
          },
          C: (p, r) => { const s = p[0]; if (s < 0.18) return `F(${n(s)})` + leafStr(r, P.leafSize, 50) + leafStr(r, P.leafSize, 60) + leafStr(r, P.leafSize, 40);
            return `F(${n(s * 0.8)})${leafStr(r, P.leafSize, 55)}[+(${n(35 + r.jit(10))})C(${n(s * 0.68)})][-(${n(35 + r.jit(10))})C(${n(s * 0.68)})]/(90)C(${n(s * 0.6)})`; },
        },
        finalize: { B: (p, r) => leafStr(r, P.leafSize, 50) + leafStr(r, P.leafSize, 60), C: (p, r) => leafStr(r, P.leafSize, 45) + leafStr(r, P.leafSize, 65) + leafStr(r, P.leafSize, 30) },
        juvenile: { C: (p, r) => leafStr(r, P.leafSize, 50) + leafStr(r, P.leafSize, 50) }, juvenileLife: 2,
        display: [
          `ω : { /(137.5°) F [ &(${n(P.limbAngle)}°) B(1) ] } × ${P.limbs}  F { [ &(40°) C(0.9) ] } × ${P.crown}`,
          `B(s) → F(${n(P.seg)}) W? [ ^(60°) C(0.35+0.3s) ] [ ±45° B(s·0.7) ]? B(s·0.9)     (W com p=${n(P.pRoot)}, ramo com p=${n(P.pSide)})`,
          `C(s) → F(s·0.8) L [ +(35°) C(s·0.68) ] [ −(35°) C(s·0.68) ] /(90°) C(s·0.6)   (copa, s < 0.18 → folhas)`,
          `W = raiz aérea: desce na vertical até o chão em 1,4 iteração; depois de tocar o chão, a ponta ganha peso`,
          `    e engrossa com a idade (45% delas até 25–42% do tronco, o resto fica fino) como tronco secundário; a carga não passa pelo galho (fora de Leonardo)`,
        ],
      };
    },
    bark: () => [hsl(35, 0.12, 0.48), hsl(40, 0.18, 0.5)],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(8), 0.55 + r.jit(0.08), P.leafL + r.jit(0.05)); },
  },

  sequoia: {
    name: 'Sequoia Gigante', emoji: '🌲', height: 16, theme: 'day', leafKind: 'oak',
    desc: 'Sequoiadendron giganteum: tronco altíssimo com base em sapopemas, nu até bem alto (os galhos de baixo caem com a idade), casca fibrosa avermelhada e sulcada e copa estreita, de cônica a arredondada. A silhueta humana de 1,8 m ao pé do tronco dá a escala.',
    baseWidth: 0.95, bump: 0.04, wood: { leo: [2.0, 2.2], G: 0.8, tip: 0.02, ring: 0.6, share: 0.8 },
    tube: { bump: (th, arc, g, root, P) => root ? 1 + P.butt * Math.exp(-arc / P.buttH) * Math.pow(0.5 + 0.5 * Math.cos(P.lobes * th + 0.3 * Math.sin(2 * th)), 1.5) + 0.025 * Math.sin(17 * th + arc) : 1 },
    params(r) {
      return {
        iterations: r.int(27, 29), n: r.int(24, 26), bare: r.range(0.42, 0.55), internode: r.range(0.85, 1.0), per: r.int(3, 4), angle: r.range(72, 92), seg: r.range(0.4, 0.5), droop: r.range(0.06, 0.14), upturn: r.range(0.05, 0.12),
        round: r.range(0.4, 1.0), needleLen: r.range(0.28, 0.4), butt: r.range(0.45, 0.8), buttH: r.range(1.2, 2.0), lobes: r.int(5, 8), realH: r.int(70, 95), needleH: r.range(120, 150),
      };
    },
    show: [['iterations', 'Iterações'], ['n', 'Entrenós do tronco'], ['bare', 'Fração sem galhos'], ['per', 'Galhos por nó'], ['angle', 'Ângulo dos galhos', '°'], ['droop', 'Caimento'], ['upturn', 'Ponta virada para cima'], ['round', 'Arredondamento da copa'], ['butt', 'Sapopemas'], ['lobes', 'Lobos da base'], ['realH', 'Altura real (m)']],
    build(P) {
      const bk = Math.floor(P.n * P.bare);
      return {
        axiom: `!(1)A(0)`,
        rules: {
          A: (p, r) => {
            const k = p[0]; if (k >= P.n) return `[&(25)B(0.5,0)]/(120)[&(25)B(0.5,0)]/(120)[&(25)B(0.5,0)]N(0.5)`;
            let o = `F(${n(P.internode * (1 - 0.3 * k / P.n))})`;
            if (k >= bk) {
              const u = (k - bk) / (P.n - bk), L = Math.pow(Math.max(1 - Math.pow(u, 1 + P.round * 2), 0), 0.5) * Math.min(1, 0.55 + 3 * u);
              for (let i = 0; i < P.per; i++) if (r.chance(0.85)) o += `[/(${n(i * 360 / P.per + r.jit(30))})&(${n(P.angle + r.jit(8))})B(${n(0.25 + 0.75 * L)},0)]`;
            }
            return o + `/(137.5)A(${k + 1})`;
          },
          B: (p, r) => {
            const l = p[0], j = p[1]; if (l < 0.18) return `N(${n(P.needleLen)})`;
            const tr = j < 2 ? P.droop : -P.upturn;
            const side = (sg) => `[${sg}(${n(50 + r.jit(12))})&(${n(r.jit(25))})N(${n(P.needleLen)})F(${n(l * P.seg * 0.5)})N(${n(P.needleLen)})[^(40)N(${n(P.needleLen * 0.8)})][&(40)N(${n(P.needleLen * 0.8)})]F(${n(l * P.seg * 0.3)})N(${n(P.needleLen)})]`;
            return `~(${n(tr)})N(${n(P.needleLen)})F(${n(l * P.seg)})${side('+')}${side('-')}[^(60)N(${n(P.needleLen)})]B(${n(l * 0.86)},${j + 1})`;
          },
        },
        finalize: { B: () => `N(${n(P.needleLen)})`, A: () => `N(0.5)` },
        juvenile: { A: (p, r) => { let o = `N(0.5)`; for (let i = 0; i < 9; i++) o += `[/(${n(i * 137.5)})&(${n(30 + i * 7)})N(${n(P.needleLen * (1 + i * 0.12))})]`; return o; } }, juvenileLife: 3,
        display: [
          `ω : !(1) A(0)`,
          `A(k) → F(${n(P.internode)}·(1 − 0.3k/n)) { [ &(${n(P.angle)}°) B(L(u), 0) ] } × ${P.per}? /(137.5°) A(k+1)     (galhos só para k ≥ ${bk}: tronco nu embaixo)`,
          `L(u) = √(1 − u^${n(1 + P.round * 2)}) · min(1, 0,55 + 3u)    (copa estreita, de cônica a arredondada)`,
          `B(l, j) → ~(j < 2 ? ${n(P.droop)} : −${n(P.upturn)}) N F(l·${n(P.seg)}) [ +50° N F N ] [ −50° N F N ] B(l·0.86, j+1)   (cai e depois sobe)`,
          `tubo: sapopemas na base (${P.lobes} lobos, ${n(P.butt)}×), casca sulcada fibrosa`,
          `escala: árvore de ${P.realH} m · silhueta humana de 1,8 m`,
        ],
      };
    },
    bark: (P) => [hsl(14, 0.5, 0.33), hsl(P.needleH - 30, 0.25, 0.3)],
    color(kind, it, P, r) { return hsl(P.needleH + r.jit(6), 0.32 + r.jit(0.06), 0.2 + r.jit(0.04)); },
    extra({ group, P, sk, rFull, W }) {
      // altura do tronco em unidades da planta ≈ maior Y; humano proporcional à altura real
      let H = 0; for (let i = 0; i < sk.N; i++) if (sk.Y[i] > H) H = sk.Y[i];
      const hm = H * 1.8 / P.realH, fig = humanFigure(hm);
      fig.position.set(W.rMaxFull * (1.6 + P.butt * 1.4), 0, W.rMaxFull * 1.2); fig.rotation.y = -0.6; group.add(fig);
      return { points: [new V3(W.rMaxFull * (1.8 + P.butt * 1.4), hm, W.rMaxFull * 1.4)] };
    },
  },
});
Object.assign(BARK, {
  dragoeiro: (P, r) => ({ variant: P.sap ? 'lisa com sangue de dragão' : 'lisa', type: 0, stretch: 1, crack: 0.1, freq: r.range(7, 10), depth: 0.07, fbm: 0.8, lent: 0.08, hi: [1.15, 1.12, 1.1], lo: [0.6, 0.58, 0.56], moss: 0, mossH: 90, mat: 0.35 }),
  baoba: (P, r) => ({ variant: 'lisa com dobras', type: 0, stretch: 1, crack: 0.1, freq: r.range(3, 4.5), depth: 0.12, fbm: 1, lent: 0.25, hi: [1.12, 1.1, 1.08], lo: [0.62, 0.6, 0.6], moss: 0, mossH: 90, mat: 0.3 }),
  eucalipto: (P, r) => ({ variant: 'arco-íris (' + P.pattern + ')', type: 0, stretch: 1, crack: 0.1, freq: r.range(3.5, 5), depth: 0.05, fbm: 0.5, lent: 0, hi: [1, 1, 1], lo: [1, 1, 1], moss: 0, mossH: 90, mat: 0.45 }),
  figueira: (P, r) => ({ variant: 'lisa', type: 0, stretch: 1, crack: 0.1, freq: r.range(8, 11), depth: 0.08, fbm: 0.8, lent: 0.6, hi: [1.12, 1.1, 1.05], lo: [0.6, 0.55, 0.5], moss: r.chance(0.5) ? r.range(0.3, 0.6) : 0, mossH: r.range(75, 100), mat: 0.4 }),
  sequoia: (P, r) => ({ variant: 'fibrosa sulcada', type: 1, stretch: r.range(0.06, 0.1), crack: r.range(0.2, 0.28), freq: r.range(5, 7), depth: r.range(0.18, 0.26), fbm: 0.9, lent: 0, hi: tintV(r, [1.55, 1.25, 1.05], 0.06), lo: [0.3, 0.2, 0.18], moss: 0, mossH: 90, mat: 0.3 }),
});

/* =====================================================================
   6d. v6: bonsais (bordo, pinheiro-branco, cipreste hinoki, junípero)
   Ganchos novos: Z (almofada de folhagem), Q (peso do nebari), J (jin), vaso procedural (makePot) e madeira morta (LS_DEAD).
   A idade do slider = anos de formação (P.years).
   ===================================================================== */
const nebari = (r, k, len, w) => { let o = ''; for (let i = 0; i < k; i++) o += `[/(${n(i * 360 / k + r.jit(160 / k))})&(${n(90 + r.jit(3))})F(${n(len * (0.7 + r.f() * 0.5))})/(${n(r.jit(40))})+(${n(r.jit(25))})F(${n(len * (0.6 + r.f() * 0.4))})Q(${n(w * (0.5 + r.f()))})]`; return o; };
const pad = (P, sc = 1) => `Z(${n(P.padR * sc)},${n(P.padH * Math.sqrt(sc))},${Math.max(3, Math.round(P.padN * sc * sc))},${n(P.leafS)})`;
const skExtent = (sk) => { let H = 0, R = 0; for (let i = 0; i < sk.N; i++) { if (sk.Y[i] > H) H = sk.Y[i]; const d = Math.max(Math.abs(sk.X[i]), Math.abs(sk.Z[i])); if (sk.Y[i] > 0.2 && d > R) R = d; } return { H, R }; };
const yearsTxt = (P) => `idade = anos de formação: o slider vai de 0 a ${P.years} anos`;
Object.assign(SPECIES, {
  bordo: {
    name: 'Bonsai de Bordo Japonês', emoji: '🍁', height: 5.2, theme: 'preto', leafKind: 'palm', padUp: 0.35, years: true, float: 0,
    desc: 'Acer palmatum em estilo moyogi (ereto informal): tronco liso cinza-claro em curva de S, base levemente alargada, galhos longos e abertos com ramos finos e nuvens densas de folhas palmadas vermelhas, mais larga que alta.',
    baseWidth: 0.3, leafRoll: 0, bump: 0.02, wood: { leo: [2.2, 2.4], G: 1.0, tip: 0.035, ring: 0.45, share: 0.8 },
    params(r) {
      return {
        iterations: 5, years: r.int(15, 40), segs: r.int(6, 7), segLen: r.range(0.7, 0.85), curve: r.range(22, 32), cycles: r.range(0.9, 1.2), phase: r.range(0, 6.28), lean: r.range(-10, 10),
        roots: r.int(4, 6), rootW: r.range(6, 12), branchLen: r.range(1.45, 1.8), bAngle: r.range(72, 86), split: r.range(30, 42), ratio: r.range(0.62, 0.7), cont: r.range(0.72, 0.8), droop: r.range(0.0, 0.04),
        padR: r.range(0.44, 0.54), padH: r.range(0.24, 0.3), padN: r.int(22, 28), leafS: r.range(0.16, 0.2), lobes: r.chance(0.35) ? 7 : 5,
        leafH: r.range(-8, 4), leafSat: r.range(0.75, 0.9), leafL: r.range(0.36, 0.44), barkL: r.range(0.5, 0.6),
      };
    },
    show: [['years', 'Anos de formação'], ['iterations', 'Iterações'], ['segs', 'Segmentos do tronco'], ['curve', 'Curva do tronco (S)', '°'], ['cycles', 'Ondas da curva'], ['roots', 'Raízes do nebari'], ['branchLen', 'Comprimento dos galhos'], ['bAngle', 'Abertura dos galhos', '°'], ['split', 'Ângulo dos ramos', '°'], ['padN', 'Folhas por almofada'], ['lobes', 'Lobos da folha']],
    build(P) {
      const r = new Rand('bordo-axioma::' + P.phase);
      let ax = `!(1)${nebari(r, P.roots, 0.3, P.rootW)}/(${n(P.lean * 7)})&(${n(P.lean)})`, yaw = r.f() * 360;
      for (let k = 0; k < P.segs; k++) {
        const bend = P.curve * Math.cos(6.2832 * P.cycles * k / P.segs + P.phase);
        ax += `&(${n(bend)})F(${n(P.segLen * (1 - 0.3 * k / P.segs))})`;
        if (k >= 1) { yaw += (k % 3 === 2 ? 90 : 180) + r.jit(28); ax += `[/(${n(yaw)})&(${n(P.bAngle + r.jit(6))})~(${n(P.droop)})B(${n(P.branchLen * (1 - 0.5 * (k - 1) / P.segs))})]`; }
      }
      ax += `^(${n(P.curve * 0.5)})B(${n(P.branchLen * 0.45)})`;
      return {
        axiom: ax,
        rules: {
          B: (p, r) => { const s = p[0]; if (s < 0.24) return `F(${n(s * 0.8)})` + pad(P, 0.9);
            return `F(${n(s * 0.8)})[+(${n(P.split + r.jit(8))})B(${n(s * P.ratio)})][-(${n(P.split + r.jit(8))})B(${n(s * P.ratio)})]/(${n(r.jit(30))})^(${n(4 + r.jit(5))})B(${n(s * P.cont)})`; },
        },
        finalize: { B: () => pad(P) },
        juvenile: { B: () => pad(P, 0.55) }, juvenileLife: 1.4,
        display: [
          `ω : nebari { [ /(360/${P.roots}·i) &(90°) F F Q(peso) ] } × ${P.roots}   tronco { &(${n(P.curve)}°·cos(2π·${n(P.cycles)}·k/${P.segs} + φ)) F [ /(180°|90° ± 28°) &(${n(P.bAngle)}°) B(L·(1 − k/2n)) ] } × ${P.segs}   ápice B`,
          `B(s) → F(0.8s) [ +(${n(P.split)}°) B(${n(P.ratio)}s) ] [ −(${n(P.split)}°) B(${n(P.ratio)}s) ] /(±30°) ^(4°) B(${n(P.cont)}s)      (s < 0.24 → almofada)`,
          `final: B → Z(${n(P.padR)}, ${n(P.padH)}, ${P.padN} folhas)   ·   juvenil: B → almofada pequena (os brotos novos já têm folhas)`,
          `Z = nuvem achatada em domo: folhas palmadas de ${P.lobes} lobos, viradas para cima`,
          yearsTxt(P),
        ],
      };
    },
    geom: (kind, P) => kind === 'leaf' ? GEOMS[P.lobes === 7 ? 'palm7' : 'palm']() : null,
    bark: (P) => [hsl(35, 0.05, P.barkL), hsl(90, 0.25, 0.4)],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(8) + (r.chance(0.12) ? 14 : 0), P.leafSat + r.jit(0.06), P.leafL + r.jit(0.06)); },
    extra({ group, sk, P, rng }) {
      const { R } = skExtent(sk), a = Math.max(R * 0.42, 0.8);
      const pot = makePot(group, { a, b: a * 0.68, h: a * 0.26, n: 2.4, lip: 0.05, taper: 0.1, color: hsl(0, 0, 0.07), rough: 0.35, moss: 0.55 }, rng);
      return { floor: pot.floor, points: pot.points };
    },
  },

  pinheiro_branco: {
    name: 'Bonsai de Pinheiro-Branco', emoji: '🌲', height: 5, theme: 'estudio', padKind: 'needles', padUp: 0.75, years: true, float: 0,
    desc: 'Pinus parviflora: tronco maciço, torcido e nodoso, cinza, com raízes expostas na superfície (nebari); almofadas horizontais de tufos de agulhas verde-vivo formando uma copa em domo larga, e um galho comprido que cai em cascata para fora da borda do vaso, oval, raso e marrom-acinzentado, com terra e musgo.',
    baseWidth: 0.5, bump: 0.05, wood: { leo: [1.9, 2.1], G: 1.4, tip: 0.04, ring: 0.6, share: 1.2 },
    tube: { bump: (th, arc, g, root, P) => root ? 1 + P.gnarl * (0.55 * Math.sin(3 * th + 2.1 * arc + P.phase) + 0.45 * Math.sin(5 * th - 1.4 * arc)) * (0.45 + 0.55 * Math.exp(-arc / 1.6)) : 1 },
    params(r) {
      return {
        iterations: 4, years: r.int(30, 80), segs: r.int(5, 6), segLen: r.range(0.5, 0.62), bend: r.range(18, 30), phase: r.range(0, 6.28), gnarl: r.range(0.1, 0.18),
        roots: r.int(6, 8), rootW: r.range(10, 20), branchLen: r.range(1.25, 1.6), bAngle: r.range(80, 94), split: r.range(34, 46),
        cascade: r.range(3, 5) | 0, cascDroop: r.range(0.18, 0.26),
        padR: r.range(0.42, 0.52), padH: r.range(0.08, 0.11), padN: r.int(30, 38), leafS: r.range(0.09, 0.12), needleLen: r.range(0.13, 0.16), needleH: r.range(92, 108),
      };
    },
    show: [['years', 'Anos de formação'], ['segs', 'Segmentos do tronco'], ['bend', 'Torção do tronco', '°'], ['gnarl', 'Nós e sulcos'], ['roots', 'Raízes do nebari'], ['branchLen', 'Comprimento dos galhos'], ['bAngle', 'Ângulo dos galhos', '°'], ['cascade', 'Segmentos da cascata'], ['padN', 'Tufos por almofada']],
    build(P) {
      const r = new Rand('pinho-axioma::' + P.phase);
      let ax = `!(1)${nebari(r, P.roots, 0.38, P.rootW)}`, yaw = r.f() * 360;
      for (let k = 0; k < P.segs; k++) {
        ax += `/(${n(60 + r.f() * 70)})&(${n(P.bend * (0.6 + 0.6 * r.f()))})F(${n(P.segLen * (1 - 0.25 * k / P.segs))})`;
        if (k === 1) ax += `[/(${n(yaw + 90)})&(${n(80)})_(0.9)F(0.5)~(${n(P.cascDroop)})C(0)]`;
        if (k >= 1) { yaw += 180 + r.jit(40) + (k % 2 ? 60 : 0); ax += `[/(${n(yaw)})&(${n(P.bAngle + r.jit(6))})_(0.8)^(${n(4 + r.jit(4))})B(${n(P.branchLen * (1 - 0.45 * (k - 1) / P.segs))})]`; }
      }
      ax += `^(${n(P.bend * 0.8)})F(0.25)[&(30)B(0.55)][^(30)B(0.5)]` + pad(P, 1.3);
      return {
        axiom: ax,
        rules: {
          B: (p, r) => { const s = p[0]; if (s < 0.36) return `F(${n(s * 0.7)})` + pad(P);
            return `F(${n(s * 0.75)})_(0.5)[+(${n(P.split + r.jit(8))})B(${n(s * 0.55)})][-(${n(P.split + r.jit(8))})B(${n(s * 0.55)})]B(${n(s * 0.72)})`; },
          C: (p, r) => { const j = p[0]; if (j >= P.cascade) return pad(P, 1.1);
            return `F(0.55)` + (j % 2 ? `[+(50)_(1)D(0.45)]` : `[-(50)_(1)D(0.45)]`) + `C(${j + 1})`; },
          D: () => `F(0.25)` + pad(P, 0.7),
        },
        finalize: { B: () => pad(P), C: () => pad(P), D: () => pad(P, 0.8) },
        juvenile: { B: () => pad(P, 0.5), C: () => pad(P, 0.5) }, juvenileLife: 1.3,
        display: [
          `ω : nebari × ${P.roots} (raízes de superfície, peso Q)   tronco { /(60–130°) &(${n(P.bend)}°±) F } × ${P.segs}   (planos de curva aleatórios = tronco torcido)`,
          `     em cada segmento: [ /(180° ± 40°) &(${n(P.bAngle)}°) _(0.8) ^(4° ± 4°) B(L) ]   no 2º: [ /(+90°) &(80°) _(0.9) F(0.5) ~(${n(P.cascDroop)}) C(0) ]  (cascata)   ápice: domo + almofada grande`,
          `B(s) → F(0.75s) [ +(${n(P.split)}°) B(0.55s) ] [ −(${n(P.split)}°) B(0.55s) ] B(0.72s)      (s < 0.36 → almofada horizontal)`,
          `C(j) → F(0.55) [ ±50° _(1) D(0.45) ] C(j+1)   (gravitropismo ${n(P.cascDroop)}: cai para fora da borda; j = ${P.cascade} → almofada)   ·   _(k) = nivela o galho na horizontal`,
          `tubo: sulcos torcidos no tronco (${n(P.gnarl)}), casca em placas cinza`,
          yearsTxt(P),
        ],
      };
    },
    bark: () => [hsl(30, 0.05, 0.45), hsl(80, 0.2, 0.38)],
    color(kind, it, P, r) { return hsl(P.needleH + r.jit(8), 0.55 + r.jit(0.08), 0.33 + r.jit(0.06)); },
    extra({ group, sk, P, rng }) {
      const { R } = skExtent(sk), a = Math.max(R * 0.56, 1);
      const pot = makePot(group, { a, b: a * 0.66, h: a * 0.2, n: 2.2, lip: 0.06, taper: 0.08, foot: 0.12, color: hsl(25, 0.1, 0.2), rough: 0.8, moss: 0.7, mound: a * 0.07 }, rng);
      return { floor: pot.floor, points: pot.points };
    },
  },

  cipreste: {
    name: 'Bonsai de Cipreste Hinoki', emoji: '🎋', height: 7, theme: 'terracota', leafKind: 'hinoki', padUp: 0.9, years: true, float: 0, fx: 'cipreste',
    desc: 'Chamaecyparis obtusa em estilo chokkan (ereto formal): tronco reto e escuro com uma faixa de madeira morta branca (shari) na frente da parte baixa, andares de almofadas densas que alternam de lado e diminuem até o topo, e vaso redondo de terracota com musgo.',
    baseWidth: 0.26, leafRoll: 20, bump: 0.02, wood: { leo: [2.0, 2.2], G: 0.9, tip: 0.03, ring: 0.5, share: 0.8 },
    params(r) {
      return {
        iterations: 4, years: r.int(20, 50), segs: r.int(13, 16), segLen: r.range(0.42, 0.5), bare: r.range(0.16, 0.24), Lmax: r.range(1.3, 1.7), bAngle: r.range(86, 98), split: r.range(32, 42),
        padR: r.range(0.44, 0.54), padH: r.range(0.3, 0.38), padN: r.int(40, 48), leafS: r.range(0.26, 0.32), leafH: r.range(105, 125),
        shari: r.range(0.1, 0.16), shariTwist: r.range(0, 0.12), shariH: r.range(0.3, 0.45), phase: r.range(0, 6.28),
      };
    },
    show: [['years', 'Anos de formação'], ['segs', 'Andares possíveis'], ['bare', 'Fração sem galhos'], ['Lmax', 'Galho mais longo'], ['bAngle', 'Ângulo dos galhos', '°'], ['shari', 'Largura do shari'], ['shariH', 'Altura do shari'], ['padN', 'Ramos por almofada']],
    build(P) {
      const r = new Rand('cipreste-axioma::' + P.phase), bk = Math.floor(P.segs * P.bare);
      let ax = `!(1)${nebari(r, 5, 0.25, 20)}`, side = 0;
      for (let k = 0; k < P.segs; k++) {
        ax += `/(${n(r.jit(4))})&(${n(r.jit(1.5))})F(${n(P.segLen * (1 - 0.3 * k / P.segs))})`;
        if (k >= bk) { const u = (k - bk) / (P.segs - bk); side += 180 + r.jit(22) + (k % 4 === 3 ? 70 : 0); ax += `[/(${n(side)})&(${n(P.bAngle + r.jit(5))})_(0.85)B(${n(0.3 + P.Lmax * Math.pow(1 - u, 0.9))})]`; }
      }
      ax += `F(0.25)` + pad(P, 0.9);
      return {
        axiom: ax,
        rules: {
          B: (p, r) => { const s = p[0]; if (s < 0.34) return `F(${n(s * 0.6)})` + pad(P, 0.75 + s);
            return `F(${n(s * 0.6)})_(0.6)[+(${n(P.split + r.jit(6))})B(${n(s * 0.5)})][-(${n(P.split + r.jit(6))})B(${n(s * 0.5)})]B(${n(s * 0.68)})`; },
        },
        finalize: { B: (p) => pad(P, 0.8 + 0.5 * p[0]) },
        juvenile: { B: () => pad(P, 0.5) }, juvenileLife: 1.3,
        display: [
          `ω : tronco reto { F(${n(P.segLen)}·(1 − 0.3k/n)) [ /(180° ± 22°) &(${n(P.bAngle)}°) B(0.3 + ${n(P.Lmax)}·(1 − u)^0.9) ] } × ${P.segs}   (galhos só para k ≥ ${bk}; u = altura relativa)`,
          `B(s) → F(0.6s) [ +(${n(P.split)}°) B(0.5s) ] [ −(${n(P.split)}°) B(0.5s) ] B(0.68s)      (s < 0.34 → almofada achatada)`,
          `andares alternam de lado e encurtam até o topo: silhueta triangular`,
          `casca: fibrosa escura · shari: ${n(P.shari * 100)}% da volta, até ${n(P.shariH * 100)}% da altura do tronco`,
          yearsTxt(P),
        ],
      };
    },
    bark: () => [hsl(14, 0.3, 0.2), hsl(70, 0.2, 0.32)],
    color(kind, it, P, r) { return hsl(P.leafH + r.jit(8), 0.55 + r.jit(0.08), 0.31 + r.jit(0.05)); },
    extra({ group, sk, P, rng, fxU }) {
      const { H, R } = skExtent(sk), a = Math.max(H * 0.15, R * 0.3, 0.6);
      fxU.uFx.value.set(P.shari, P.shariTwist, H * P.shariH, P.phase); fxU.uFx2.value.set(0.3, 0, 7, 0.18);
      const pot = makePot(group, { a, b: a, h: a * 0.85, n: 2, lip: 0.07, taper: -0.02, bulge: 0.08, foot: 0.06, color: hsl(17, 0.55, 0.42), rough: 0.9, moss: 0.65, mound: a * 0.08 }, rng);
      return { floor: pot.floor, points: pot.points };
    },
  },

  junipero: {
    name: 'Bonsai de Junípero', emoji: '🌀', height: 6, theme: 'zen', padKind: 'needles', padUp: 0.7, years: true, float: 0, fx: 'junipero',
    desc: 'Juniperus: tronco que torce de forma dramática, com grandes faixas de madeira morta branca/prateada em espiral e uma veia viva fina marrom-avermelhada; copa densa verde-escura inclinada para um lado, alguns galhos mortos (jin), vaso retangular marrom sobre uma mesinha de madeira escura.',
    baseWidth: 0.42, bump: 0.03, wood: { leo: [1.9, 2.1], G: 1.3, tip: 0.035, ring: 0.6, share: 1.0 },
    tube: { bump: (th, arc, g, root, P) => root ? 1 + 0.16 * Math.sin(3 * (th - P.twist * arc - P.phase)) * Math.exp(-arc / 4) + 0.05 * Math.sin(7 * th - 2 * arc) : 1 },
    params(r) {
      const sideA = r.range(0, 6.28);
      return {
        iterations: 4, years: r.int(40, 120), segs: r.int(8, 10), segLen: r.range(0.5, 0.6), roll: r.range(45, 70), bend: r.range(18, 28), phase: r.range(0, 6.28),
        dead: r.range(0.58, 0.72), twist: r.range(0.9, 1.6), jins: r.int(2, 3), sideA, lean: r.range(0.6, 1.0),
        attractor: [Math.cos(sideA) * 3.2, 2.6, Math.sin(sideA) * 3.2],
        branchLen: r.range(0.75, 0.95), split: r.range(34, 46),
        padR: r.range(0.3, 0.38), padH: r.range(0.2, 0.26), padN: r.int(16, 20), leafS: r.range(0.2, 0.24), needleLen: r.range(0.16, 0.2), needleH: r.range(125, 145),
      };
    },
    show: [['years', 'Anos de formação'], ['segs', 'Segmentos do tronco'], ['roll', 'Torção por segmento', '°'], ['bend', 'Curva por segmento', '°'], ['dead', 'Madeira morta (fração da volta)'], ['twist', 'Espiral da madeira morta'], ['jins', 'Galhos mortos (jin)'], ['lean', 'Inclinação da copa']],
    build(P) {
      const r = new Rand('junipero-axioma::' + P.phase);
      let ax = `!(1)${nebari(r, 5, 0.3, 30)}`, yaw = 0, jin = 0;
      for (let k = 0; k < P.segs; k++) {
        ax += `/(${n(P.roll + r.jit(10))})&(${n(P.bend * (k < 2 ? 0.6 : 1) + r.jit(6))})F(${n(P.segLen * (1 - 0.3 * k / P.segs))})`;
        if (k === 2) ax += `$(${n(0.05 * P.lean)})`;
        if (k >= Math.floor(P.segs * 0.45)) {
          yaw += 120 + r.jit(50);
          if (jin < P.jins && (k % 2 === 0)) { jin++; ax += `[J/(${n(yaw + 60)})&(${n(55 + r.jit(15))})F(${n(0.45 + r.f() * 0.3)})F(${n(0.3 + r.f() * 0.2)})F(0.15)]`; }
          ax += `[/(${n(yaw)})&(${n(55 + r.jit(15))})$(${n(0.12 * P.lean)})B(${n(P.branchLen * (1 - 0.4 * (k - 2) / P.segs))})]`;
        }
      }
      ax += `$(${n(0.1 * P.lean)})F(0.3)B(0.6)` + pad(P, 1.2);
      return {
        axiom: ax,
        rules: {
          B: (p, r) => { const s = p[0]; if (s < 0.3) return `F(${n(s * 0.7)})` + pad(P);
            return `F(${n(s * 0.7)})[+(${n(P.split + r.jit(8))})B(${n(s * 0.58)})][-(${n(P.split + r.jit(8))})B(${n(s * 0.58)})]/(${n(r.jit(40))})B(${n(s * 0.72)})`; },
        },
        finalize: { B: () => pad(P) },
        juvenile: { B: () => pad(P, 0.55) }, juvenileLife: 1.3,
        display: [
          `ω : nebari   tronco { /(${n(P.roll)}°) &(${n(P.bend)}°) F } × ${P.segs}   (giro constante + curva = hélice: tronco torcido)`,
          `     galhos [ /(120° ± 50°) &(55°) $(${n(0.12 * P.lean)}) B ]  com tropismo para um ponto ao lado (copa inclinada)   jin × ${P.jins}: [ J F F F ] (morto, sem folhas)`,
          `B(s) → F(0.7s) [ +(${n(P.split)}°) B(0.58s) ] [ −(${n(P.split)}°) B(0.58s) ] B(0.72s)      (s < 0.3 → almofada densa)`,
          `madeira morta: faixa de ${n(P.dead * 100)}% da volta girando ${n(P.twist)} rad por unidade de tronco; o resto é a veia viva`,
          yearsTxt(P),
        ],
      };
    },
    tags(sk) { const t = new Float32Array(sk.N); if (sk.jin) for (const i of sk.jin) t[i] = 1; return t; },
    bark: () => [hsl(14, 0.45, 0.27), hsl(60, 0.2, 0.32)],
    color(kind, it, P, r) { return hsl(P.needleH + r.jit(8), 0.42 + r.jit(0.08), 0.2 + r.jit(0.05)); },
    extra({ group, sk, P, rng, fxU }) {
      const { R } = skExtent(sk), a = Math.max(R * 0.45, 0.9);
      fxU.uFx.value.set(P.dead, P.twist, 1e4, P.phase); fxU.uFx2.value.set(0.22, 0, 6, 0.12);
      const pot = makePot(group, { a, b: a * 0.62, h: a * 0.32, n: 7, lip: 0.04, taper: 0.05, foot: 0.1, color: hsl(22, 0.4, 0.27), rough: 0.85, moss: 0.5, stand: hsl(20, 0.3, 0.09) }, rng);
      return { floor: pot.floor, points: pot.points };
    },
  },
});
Object.assign(BARK, {
  bordo: (P, r) => ({ variant: 'lisa (bordo)', type: 0, stretch: 1, crack: 0.1, freq: r.range(6, 8), depth: 0.04, fbm: 0.6, lent: 0.05, hi: [1.08, 1.08, 1.08], lo: [0.7, 0.7, 0.7], moss: 0, mossH: 90, mat: 0.4 }),
  pinheiro_branco: (P, r) => ({ variant: 'placas cinza', type: 2, stretch: r.range(0.5, 0.7), crack: r.range(0.05, 0.08), freq: r.range(9, 11), depth: r.range(0.12, 0.16), fbm: 0.9, lent: 0, hi: [1.25, 1.22, 1.2], lo: [0.4, 0.38, 0.36], moss: r.range(0.2, 0.4), mossH: 95, mat: 0.3 }),
  cipreste: (P, r) => ({ variant: 'fibrosa escura + shari', type: 1, stretch: r.range(0.08, 0.12), crack: 0.24, freq: r.range(6, 8), depth: 0.16, fbm: 0.8, lent: 0, hi: [1.4, 1.2, 1.1], lo: [0.35, 0.28, 0.26], moss: 0, mossH: 90, mat: 0.35 }),
  junipero: (P, r) => ({ variant: 'veia viva fibrosa + madeira morta', type: 1, stretch: r.range(0.05, 0.08), crack: 0.22, freq: r.range(6, 8), depth: 0.14, fbm: 0.8, lent: 0, hi: [1.4, 1.15, 1.05], lo: [0.4, 0.3, 0.28], moss: 0, mossH: 90, mat: 0.3 }),
});

/* SIM-BEGIN */
/* =====================================================================
   7b. v7: crescimento simulado ano a ano
   Colonização do espaço (Runions et al. 2007) + luz por propagação de sombra numa grade de voxels
   e alocação de recursos de Borchert-Honda com dominância apical (Palubicki et al. 2009).
   Cada ano: pontos de atração livres -> gemas (destino: cresce / dorme / flor / morre) -> fluxo de recurso
   da base para as gemas -> brotos novos (filotaxia e ângulos da espécie) -> folhas só perto das pontas
   -> galhos sombreados caem (autopoda) -> (bonsai) poda periódica fora das almofadas.
   Saída: esqueleto com nascimento (T0/T1) e morte (TD) por nó, em anos; o slider só escolhe o ano.
   ===================================================================== */
// cada ponto de atração vai para a gema mais próxima (dentro do raio e do cone de percepção dela)
function simAssign(MX, MY, MZ, MT, yr, L, near, nn, BP, BC, rp2, c2) {
  for (let q = 0; q < L.length; q++) {
    const j = L[q]; if (MT[j] > yr) continue; // o envelope cresce com a idade: ponto ainda não disponível
    const mx = MX[j], my = MY[j], mz = MZ[j];
    let best = -1, bd = rp2, bx = 0, by = 0, bz = 0;
    for (let t = 0; t < nn; t++) {
      const o = near[t] * 6, dx = mx - BP[o], dy = my - BP[o + 1], dz = mz - BP[o + 2], d2 = dx * dx + dy * dy + dz * dz;
      if (d2 >= bd) continue;
      const pr = dx * BP[o + 3] + dy * BP[o + 4] + dz * BP[o + 5];
      if (pr < 0 || pr * pr < c2 * d2) continue;
      bd = d2; best = near[t]; bx = dx; by = dy; bz = dz;
    }
    if (best >= 0) { const D = Math.sqrt(bd) || 1, o = best * 4; BC[o] += 1; BC[o + 1] += bx / D; BC[o + 2] += by / D; BC[o + 3] += bz / D; }
  }
}
export function growSim(C, rng, env = ENV_DEFAULT) {
  const NY = C.years, MAXN = C.maxNodes || 24000;
  const X = [], Y = [], Z = [], PAR = [], T0 = [], T1 = [], TD = [], ORD = [], AXI = [], SCAF = [];
  const DX = [], DY = [], DZ = [], kids = [], budsAt = [], leafOf = [];
  const leaves = [], flowers = [], buds = [], axes = [], roots = [];
  const UP = [0, 1, 0];
  const norm = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; v[0] /= L; v[1] /= L; v[2] /= L; return v; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const rot = (v, k, ang) => { const c = Math.cos(ang), s = Math.sin(ang), d = dot(k, v), cr = cross(k, v); return [v[0] * c + cr[0] * s + k[0] * d * (1 - c), v[1] * c + cr[1] * s + k[1] * d * (1 - c), v[2] * c + cr[2] * s + k[2] * d * (1 - c)]; };
  const perp = (d) => norm(cross(d, Math.abs(d[1]) < 0.95 ? UP : [1, 0, 0]));
  const newAxis = (ord) => { axes.push({ nodes: [], ptr: 0, ord, side: null, k: 0 }); return axes.length - 1; };
  function addNode(par, x, y, z, t0, t1, ord, ax, scaf) {
    const i = X.length; X.push(x); Y.push(y); Z.push(z); PAR.push(par); T0.push(t0); T1.push(t1); TD.push(1e9); ORD.push(ord); AXI.push(ax); SCAF.push(scaf ? 1 : 0);
    let d = par >= 0 ? norm([x - X[par], y - Y[par], z - Z[par]]) : [0, 1, 0]; DX.push(d[0]); DY.push(d[1]); DZ.push(d[2]);
    kids.push([]); budsAt.push([]); leafOf.push(null); if (par >= 0) kids[par].push(i);
    if (ax >= 0) axes[ax].nodes.push(i);
    return i;
  }
  // ---------- pontos de atração (envelope da copa, pela seed) ----------
  const rp = C.rp, rp2 = rp * rp, dk2 = C.dk * C.dk, cosP = Math.cos(C.cone ?? 1.0), cell = rp;
  let MX = [], MY = [], MZ = [], MA = [], MT = [];
  const key = (ix, iy, iz) => ((ix + 1024) * 2048 + (iy + 1024)) * 2048 + (iz + 1024);
  const mgrid = new Map();
  let bmin = [1e9, 1e9, 1e9], bmax = [-1e9, -1e9, -1e9];
  for (let k = 0, tries = 0; k < C.markers && tries < C.markers * 30; tries++) {
    const p = C.sample(rng); if (!p) continue;
    const j = MX.length; MX.push(p[0]); MY.push(p[1]); MZ.push(p[2]); MA.push(1); MT.push(C.markerYear ? C.markerYear(p) : 0); k++;
    const kk = key(Math.floor(p[0] / cell), Math.floor(p[1] / cell), Math.floor(p[2] / cell));
    let a = mgrid.get(kk); if (!a) mgrid.set(kk, a = []); a.push(j);
    for (let q = 0; q < 3; q++) { bmin[q] = Math.min(bmin[q], p[q]); bmax[q] = Math.max(bmax[q], p[q]); }
  }
  MX = Float64Array.from(MX); MY = Float64Array.from(MY); MZ = Float64Array.from(MZ); MA = Uint8Array.from(MA); MT = Float32Array.from(MT);
  let mAlive = MX.length;
  const kill = (x, y, z) => {
    const ix = Math.floor(x / cell), iy = Math.floor(y / cell), iz = Math.floor(z / cell);
    const R = Math.ceil(C.dk / cell);
    for (let a = -R; a <= R; a++) for (let b = -R; b <= R; b++) for (let c = -R; c <= R; c++) {
      const L = mgrid.get(key(ix + a, iy + b, iz + c)); if (!L) continue;
      for (const j of L) if (MA[j]) { const dx = MX[j] - x, dy = MY[j] - y, dz = MZ[j] - z; if (dx * dx + dy * dy + dz * dz < dk2) { MA[j] = 0; mAlive--; } }
    }
  };
  // ---------- luz: grade de sombra (cada nó com folhas sombreia uma pirâmide abaixo dele) ----------
  const S = C.shadow, vs = S.vox, sb = S.b, sq = S.q, sa = S.a ?? 1, sC = S.C;
  const g0 = [Math.min(bmin[0], -2) - 2 * vs, -vs, Math.min(bmin[2], -2) - 2 * vs];
  const gn = [Math.ceil((Math.max(bmax[0], 2) + 2 * vs - g0[0]) / vs) + 1, Math.ceil((Math.max(bmax[1], 2) + 3 * vs - g0[1]) / vs) + 1, Math.ceil((Math.max(bmax[2], 2) + 2 * vs - g0[2]) / vs) + 1];
  const grid = new Float32Array(gn[0] * gn[1] * gn[2]);
  // peso por voxel: o "bloqueio" de cada nível (b^-q) é espalhado pela base da pirâmide ((2q+1)² voxels): s ≈ área foliar acima
  const pw = []; for (let q = 0; q <= sq; q++) pw.push(sa * Math.pow(sb, -q) / ((2 * q + 1) * (2 * q + 1)));
  const vox = (x, y, z) => [Math.floor((x - g0[0]) / vs), Math.floor((y - g0[1]) / vs), Math.floor((z - g0[2]) / vs)];
  const sunD = envSunDir(env);
  const [sux, suy, suz] = sunD;
  const shade = makeSunShade(null, sunD, vs, gn, grid, pw);
  const shadeVoxel = (xi, yi, iz, sign) => shade(xi, yi, iz, sign);
  function shadeNode(i, sign) {
    const [ix, iy, iz] = vox(X[i], Y[i], Z[i]);
    if (!env.growPhysics) {
      for (let q = 1; q <= sq; q++) {
        const yy = iy - q; if (yy < 0) break; if (yy >= gn[1]) continue;
        const w = sign * pw[q];
        for (let a = -q; a <= q; a++) { const xx = ix + a; if (xx < 0 || xx >= gn[0]) continue;
          for (let c = -q; c <= q; c++) { const zz = iz + c; if (zz < 0 || zz >= gn[2]) continue; grid[(xx * gn[1] + yy) * gn[2] + zz] += w; } }
      }
      return;
    }
    shadeVoxel(ix, iy, iz, sign);
    for (let q = 1; q <= sq; q++) {
      const sx = ix + Math.round(sux * q), sy = iy + Math.round(suy * q), sz = iz + Math.round(suz * q);
      if (sx >= 0 && sy >= 0 && sz >= 0 && sx < gn[0] && sy < gn[1] && sz < gn[2]) grid[(sx * gn[1] + sy) * gn[2] + sz] += sign * pw[Math.min(q, pw.length - 1)];
    }
  }
  const light = (x, y, z) => { const [ix, iy, iz] = vox(x, y, z); let s = 0; if (ix >= 0 && iy >= 0 && iz >= 0 && ix < gn[0] && iy < gn[1] && iz < gn[2]) s = grid[(ix * gn[1] + iy) * gn[2] + iz]; return Math.exp(-Math.max(0, s) / sC); }; // Beer-Lambert simples
  // ---------- folhas ----------
  const LF = C.leaf;
  function addLeaves(i, t) {
    if (!LF || !LF.per) return;
    const d = [DX[i], DY[i], DZ[i]], list = [];
    const k = LF.per(ORD[i], rng);
    for (let j = 0; j < k; j++) {
      const f = LF.along ? rng.f() : 1, px = X[PAR[i]] + (X[i] - X[PAR[i]]) * f, py = Y[PAR[i]] + (Y[i] - Y[PAR[i]]) * f, pz = Z[PAR[i]] + (Z[i] - Z[PAR[i]]) * f;
      const sd = rot(perp(d), d, rng.f() * 6.2832);
      let ly = LF.needle ? d.slice() : norm(rot(d, norm(cross(d, sd)), (LF.pitch + rng.jit(LF.pitchJ ?? 15)) * Math.PI / 180));
      if (LF.droop) { ly = norm([ly[0], ly[1] - LF.droop, ly[2]]); }
      let lz = norm(cross(ly, cross(UP, ly))); if (!isFinite(lz[0]) || Math.hypot(...lz) < 0.5) lz = perp(ly);
      lz = norm(rot(lz, ly, rng.jit(LF.roll ?? 0.6)));
      list.push(leaves.length);
      leaves.push({ x: px, y: py, z: pz, ly, lz, s: LF.size * (0.8 + 0.4 * rng.f()) * (LF.sizeOrd ? LF.sizeOrd(ORD[i]) : 1), t0: t, t1: 1e9, node: i, kind: LF.kind });
    }
    if (list.length) { leafOf[i] = list; shadeNode(i, 1); }
  }
  function dropLeaves(i, t) { const L = leafOf[i]; if (!L) return; for (const j of L) if (leaves[j].t1 > t) leaves[j].t1 = t; leafOf[i] = null; shadeNode(i, -1); }
  // ---------- gemas ----------
  const mkBud = (node, d, ord, ax, born, term) => { const b = { node, d, ord, ax, born, idle: 0, alive: true, Q: 0, cnt: 0, ex: 0, ey: 0, ez: 0, v: 0, term }; buds.push(b); budsAt[node].push(b); return b; };
  function lateralBuds(i, d, ax, ord, y, last) {
    if (ord + 1 > C.maxOrder) return;
    const ph = C.phyllo(ord, y), A = axes[ax]; if (!ph) return;
    if (ph.type === 'whorl' && !last) return;
    if (!A.side) A.side = perp(d);
    let side = norm(A.side.map((v, q) => v - dot(A.side, d) * d[q])); if (!isFinite(side[0])) side = perp(d);
    const beta = ph.angle * Math.PI / 180, dirs = [];
    if (ph.type === 'alt') { side = rot(side, d, ph.div * Math.PI / 180); dirs.push(side); }
    else if (ph.type === 'opp') { side = rot(side, d, Math.PI / 2); dirs.push(side, side.map(v => -v)); }
    else if (ph.type === 'whorl') { side = rot(side, d, rng.f() * 6.2832); for (let k = 0; k < ph.n; k++) dirs.push(rot(side, d, k * 6.2832 / ph.n)); }
    else if (ph.type === 'plag') { let h = norm(cross(d, UP)); if (!isFinite(h[0]) || Math.abs(dot(d, UP)) > 0.97) h = side; A.k++; dirs.push(A.k % 2 ? h : h.map(v => -v)); if (ph.both) dirs.push(A.k % 2 ? h.map(v => -v) : h); side = h; }
    A.side = side;
    for (const s of dirs) {
      if (rng.f() > ph.p) continue;
      const sj = rot(s, d, rng.jit(ph.jit ?? 0.25)), bj = beta + rng.jit(0.12);
      mkBud(i, norm([d[0] * Math.cos(bj) + sj[0] * Math.sin(bj), d[1] * Math.cos(bj) + sj[1] * Math.sin(bj), d[2] * Math.cos(bj) + sj[2] * Math.sin(bj)]), ord + 1, -1, y, false);
    }
  }
  // ---------- andaime da gramática (tronco/estilo vindo do L-System) ----------
  const SC = C.scaffold, scN = SC ? SC.N : 0, scOn = new Uint8Array(scN);
  if (SC) {
    newAxis(0);
    for (let i = 0; i < scN; i++) addNode(i ? SC.PAR[i] : -1, SC.X[i], SC.Y[i], SC.Z[i], SC.T0[i], SC.T1[i], SC.ORD ? SC.ORD[i] : 0, SC.axis ? (SC.axis[i] === 0 ? 0 : -1) : 0, true);
  } else { newAxis(0); addNode(-1, 0, 0, 0, 0, 0, 0, 0, true); }
  const scBuds = SC && SC.buds ? SC.buds.slice() : [];
  if (!SC) mkBud(0, [0, 1, 0], 0, 0, 0, true); else scOn[0] = 1;
  const exists = (i) => i < scN ? T0[i] < curY + 1 : true;
  let curY = 0, grown = 0;
  const stats = { years: NY, shed: 0, pruned: 0, flowers: 0 };
  // ---------- laço anual ----------
  for (let y = 0; y < NY; y++) {
    curY = y;
    // andaime que nasce neste ano: gemas axilares (filotaxia) e as gemas das pontas da gramática
    for (let i = 1; i < scN; i++) if (!scOn[i] && T0[i] < y + 1) {
      scOn[i] = 1; kill(X[i], Y[i], Z[i]);
      if (SC.budsOn && SC.budsOn(i)) lateralBuds(i, [DX[i], DY[i], DZ[i]], 0, SC.ORD ? SC.ORD[i] : 0, y, true);
      if (SC.leafOn && SC.leafOn(i)) addLeaves(i, T1[i]);
    }
    for (let k = scBuds.length - 1; k >= 0; k--) { const b = scBuds[k]; if (T1[b.node] < y + 1) { mkBud(b.node, b.d, b.ord, -1, y, true); scBuds.splice(k, 1); } }
    // 1) espaço: cada ponto livre vai para a gema mais próxima que o "enxerga" (cone de percepção)
    const bgrid = new Map(), live = [], comp = [];
    let w0 = 0; for (const b of buds) if (b.alive) buds[w0++] = b; buds.length = w0;
    for (const b of buds) { b.cnt = 0; b.ex = b.ey = b.ez = 0; b.Q = 0; b.v = 0; live.push(b);
      const n0 = b.node; b.L = light(X[n0] + b.d[0] * 0.3, Y[n0] + b.d[1] * 0.3, Z[n0] + b.d[2] * 0.3);
      if (env.growPhysics) {
        const wd = envWindDir(env); const windDot = b.d[0] * wd[0] + b.d[1] * wd[1] + b.d[2] * wd[2];
        b.L *= 1 - Math.max(0, windDot) * (env.windStr ?? 1) * (C._windAsym ?? 0) * 0.45;
      }
      if (b.L < 0.04) continue; // gema no escuro não compete por espaço (não cresceria)
      const kk = key(Math.floor(X[n0] / cell), Math.floor(Y[n0] / cell), Math.floor(Z[n0] / cell)); let a = bgrid.get(kk); if (!a) bgrid.set(kk, a = []); a.push(comp.length); comp.push(b); }
    const nb = comp.length, BP = new Float64Array(nb * 6), BC = new Float64Array(nb * 4);
    for (let q = 0; q < nb; q++) { const b = comp[q], n0 = b.node; BP[q * 6] = X[n0]; BP[q * 6 + 1] = Y[n0]; BP[q * 6 + 2] = Z[n0]; BP[q * 6 + 3] = b.d[0]; BP[q * 6 + 4] = b.d[1]; BP[q * 6 + 5] = b.d[2]; }
    const near = new Int32Array(Math.max(nb, 1));
    if (mAlive > 0 && nb) for (const [kk, L] of mgrid) { // por célula: junta as gemas das 27 vizinhas uma vez e testa todos os pontos da célula
      let w = 0; for (let q = 0; q < L.length; q++) if (MA[L[q]]) L[w++] = L[q]; L.length = w; if (!w) continue;
      const j0 = L[0], ix = Math.floor(MX[j0] / cell), iy = Math.floor(MY[j0] / cell), iz = Math.floor(MZ[j0] / cell);
      let nn = 0;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) { const B = bgrid.get(key(ix + a, iy + b, iz + c)); if (B) for (const u of B) near[nn++] = u; }
      if (!nn) continue;
      simAssign(MX, MY, MZ, MT, y, L, near, nn, BP, BC, rp2, cosP * cosP);
    }
    for (let q = 0; q < nb; q++) { const b = comp[q]; b.cnt = BC[q * 4]; b.ex = BC[q * 4 + 1]; b.ey = BC[q * 4 + 2]; b.ez = BC[q * 4 + 3]; }
    // 2) recurso da gema = espaço livre × luz
    for (const b of live) b.Q = (b.cnt > 0 || C.noSpace ? 1 : 0) * b.L;
    stats.budMax = Math.max(stats.budMax || 0, live.length);
    // 3) Borchert-Honda: soma da ponta para a base, divide da base para as pontas (λ = dominância apical)
    const N = X.length, Qn = new Float64Array(N), V = new Float64Array(N);
    for (let i = N - 1; i >= 0; i--) {
      if (TD[i] < 1e8 || !exists(i)) continue;
      for (const b of budsAt[i]) if (b.alive) Qn[i] += b.Q;
      if (i > 0) Qn[PAR[i]] += Qn[i];
    }
    V[0] = C.alpha * Qn[0];
    for (let i = 0; i < N; i++) {
      if (V[i] <= 0) continue;
      const cand = [];
      for (const k of kids[i]) if (TD[k] > 1e8 && exists(k) && Qn[k] > 0) cand.push([k, Qn[k], DX[k], DY[k], DZ[k], 0]);
      for (const b of budsAt[i]) if (b.alive && b.Q > 0) cand.push([b, b.Q, b.d[0], b.d[1], b.d[2], 1]);
      if (!cand.length) continue;
      let mi = 0, md = -9; const di = i ? [DX[i], DY[i], DZ[i]] : UP;
      for (let c = 0; c < cand.length; c++) { const q = cand[c], al = q[2] * di[0] + q[3] * di[1] + q[4] * di[2]; if (al > md) { md = al; mi = c; } }
      let lam = C.lambda(y, ORD[i]) * (C._lambdaMul ?? 1); let W = 0;
      for (let c = 0; c < cand.length; c++) W += (c === mi ? lam : 1 - lam) * cand[c][1];
      for (let c = 0; c < cand.length; c++) { const q = cand[c], v = V[i] * (c === mi ? lam : 1 - lam) * q[1] / W; if (q[5]) q[0].v = v; else V[q[0]] = v; }
    }
    // 4) brotos do ano
    for (const b of live) {
      if (!b.alive) continue;
      let n = Math.min(Math.floor(b.v * (C.vScale ?? 1)), C.nMax(b.ord, y));
      if (b.term === false && b.ord > (C.maxOrder ?? 9)) n = 0;
      if (C.flower && b.ord >= 1 && y >= C.flower.from && n <= 1 && b.Q > 0 && rng.f() < C.flower.p) { // destino: flor (a gema vira flor e termina o eixo)
        flowers.push({ node: b.node, d: b.d.slice(), t0: y + 0.35, t1: y >= NY - 1 ? 1e9 : y + 1.25 }); b.alive = false; stats.flowers++; continue;
      }
      if (n < 1 || X.length >= MAXN) { b.idle++; if (b.idle > C.maxIdle) b.alive = false; continue; }
      const E = b.cnt > 0 ? norm([b.ex, b.ey, b.ez]) : null, xi = C.xi(b.ord), tr = C.trop(b.ord, y);
      if (b.ax < 0) b.ax = newAxis(b.ord);
      let d = b.d.slice(), par = b.node; const prev = b.d.slice();
      for (let k = 0; k < n && X.length < MAXN; k++) {
        if (E) { d[0] += xi * E[0]; d[1] += xi * E[1]; d[2] += xi * E[2]; norm(d); }
        if (env.growPhysics) {
          const grad = lightGradientAt(grid, gn, g0, vs, X[par] + d[0], Y[par] + d[1], Z[par] + d[2], sunD);
          phototropismBias(d, grad, (env.phototropism ?? 0) * 0.2);
          const wd2 = envWindDir(env);
          const wk = (env.windStr ?? 1) * (C._windAsym ?? 0) * 0.08;
          d[0] += wd2[0] * wk; d[2] += wd2[2] * wk; norm(d);
        }
        if (tr) { d[1] += tr; norm(d); }
        if (C.bend) C.bend(d, b.ord, rng);
        if (k > 0 || !b.term) { const pd = prev, c = d[0] * pd[0] + d[1] * pd[1] + d[2] * pd[2], mt = C.maxTurn ?? 0.45; // curvatura máxima por entrenó
          if (c < Math.cos(mt)) { const ax = cross(pd, d), al = Math.hypot(...ax); if (al > 1e-6) { const nd = rot(pd, [ax[0] / al, ax[1] / al, ax[2] / al], mt); d[0] = nd[0]; d[1] = nd[1]; d[2] = nd[2]; } } }
        prev[0] = d[0]; prev[1] = d[1]; prev[2] = d[2];
        const L = C.len(b.ord, y) * (0.85 + 0.3 * rng.f());
        const t0 = y + 0.1 + 0.8 * k / n, t1 = y + 0.1 + 0.8 * (k + 1) / n;
        const i = addNode(par, X[par] + d[0] * L, Y[par] + d[1] * L, Z[par] + d[2] * L, t0, t1, b.ord, b.ax, false);
        kill(X[i], Y[i], Z[i]);
        lateralBuds(i, d, b.ax, b.ord, y, k === n - 1);
        addLeaves(i, t1);
        par = i;
      }
      budsAt[b.node].splice(budsAt[b.node].indexOf(b), 1); b.node = par; budsAt[par].push(b); b.d = d; b.idle = 0; grown++;
      if (C.fork && C.fork(b.ord, y)) b.alive = false; // dicotomia: a ponta para e as duas gemas do fim do broto assumem
    }
    // 5) folhas só perto da ponta de cada eixo (as de trás caem quando o eixo cresce)
    for (const A of axes) { const keep = LF ? LF.keep(A.ord) : 0; while (A.nodes.length - A.ptr > keep) { const i = A.nodes[A.ptr++]; if (!SCAF[i] || (SC && SC.dropLeaf)) dropLeaves(i, y + 1); } }
    // 6) autopoda: galho com pouca luz para o tamanho cai (os canos continuam no tronco: o raio não diminui)
    const N2 = X.length, size = new Float64Array(N2), QL = new Float64Array(N2);
    for (let i = N2 - 1; i >= 0; i--) {
      if (TD[i] < 1e8 || !exists(i)) continue;
      if (leafOf[i]) { size[i] += 1; QL[i] += light(X[i], Y[i], Z[i]); }
      if (i > 0) { size[PAR[i]] += size[i]; QL[PAR[i]] += QL[i]; }
    }
    if (C.debug) { let c = 0, sl = 0, lo = 0; for (let i = 0; i < N2; i++) if (leafOf[i] && TD[i] > 1e8) { const L = light(X[i], Y[i], Z[i]); c++; sl += L; if (L < 0.3) lo++; } (stats.dbg || (stats.dbg = [])).push(y + ':' + c + '/' + (sl / Math.max(c, 1)).toFixed(2) + '/' + lo); }
    const shed = (i, t) => { const st = [i]; while (st.length) { const j = st.pop(); if (TD[j] < 1e8) continue; TD[j] = t; dropLeaves(j, t); for (const b of budsAt[j]) b.alive = false; for (const k of kids[j]) st.push(k); } };
    let ytop = 0; for (let i = 0; i < N2; i++) if (TD[i] > 1e8 && exists(i) && Y[i] > ytop) ytop = Y[i];
    for (let i = 1; i < N2; i++) {
      if (SCAF[i] || TD[i] < 1e8 || !exists(i) || AXI[i] === AXI[PAR[i]]) continue;
      if (y - T0[i] < C.shedAge) continue;
      // cai se não tem mais folhas ou se a luz média das folhas dele ficou abaixo do limiar
      if (size[i] === 0 || QL[i] / size[i] < C.shedT(ORD[i], y, Y[i] / Math.max(ytop, 1e-3))) { shed(i, y + 1 + 0.6 * rng.f()); stats.shed++; }
    }
    // 7) bonsai: poda de formação a cada `every` anos (corta o que saiu das almofadas)
    if (C.prune && y > 0 && y % C.prune.every === 0) {
      for (let i = scN; i < N2; i++) { if (TD[i] < 1e8 || SCAF[PAR[i]] && !C.prune.base) continue; if (!C.prune.inside(X[i], Y[i], Z[i], ORD[i])) { shed(i, y + 0.95); stats.pruned++; } }
    }
    if (C.yearHook) C.yearHook(y, { X, Y, Z, PAR, T0, T1, TD, ORD, kids, leafOf, addNode, roots, rng });
  }
  stats.nodes = X.length; stats.markersLeft = mAlive; stats.markers = MX.length; stats.grown = grown;
  stats.leaves = leaves.length; stats.liveLeaves = leaves.filter(l => l.t1 > 1e8).length;
  return { N: X.length, X: Float32Array.from(X), Y: Float32Array.from(Y), Z: Float32Array.from(Z), PAR: Int32Array.from(PAR), T0: Float32Array.from(T0), T1: Float32Array.from(T1), TD: Float32Array.from(TD), ORD: Int16Array.from(ORD), SCAF: Uint8Array.from(SCAF), leaves, flowers, roots, stats, tEnd: NY + 1.5 };
}
// ---------- andaime: a gramática da espécie (axioma + regras de tronco) desenha o tronco/estilo e onde ficam as gemas ----------
const norm3 = (d) => { const L = Math.hypot(d[0], d[1], d[2]) || 1; d[0] /= L; d[1] /= L; d[2] /= L; return d; };
const smooth01 = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function simScaffold(sp, P, seed, id, G) {
  const iters = G.iters ?? 0;
  const { word } = runLSystem({ axiom: G.axiom, rules: G.rules || {} }, iters, new Rand(`${seed}::${id}::sim-rules`), null);
  const cap = { syms: G.syms || {}, out: [] };
  const { sk } = interpret(word, sp, P, new Rand(`${seed}::${id}::sim-turtle`), cap);
  const tY = G.time || ((t) => t * G.years / (iters + 1));
  const X = [sk.X[0]], Y = [sk.Y[0]], Z = [sk.Z[0]], PAR = [-1], T0 = [0], T1 = [0];
  const map = new Int32Array(sk.N), first = new Int32Array(sk.N), seg = G.seg || 0.5;
  for (let i = 1; i < sk.N; i++) { // entrenós longos viram vários (uma gema axilar a cada `seg`)
    const q = sk.PAR[i], p = map[q], L = Math.hypot(sk.X[i] - sk.X[q], sk.Y[i] - sk.Y[q], sk.Z[i] - sk.Z[q]), k = Math.max(1, Math.ceil(L / seg - 0.2));
    let par = p; first[i] = X.length;
    for (let j = 1; j <= k; j++) {
      const f = j / k; X.push(sk.X[q] + (sk.X[i] - sk.X[q]) * f); Y.push(sk.Y[q] + (sk.Y[i] - sk.Y[q]) * f); Z.push(sk.Z[q] + (sk.Z[i] - sk.Z[q]) * f);
      PAR.push(par); T0.push(tY(sk.T0[i] + (sk.T1[i] - sk.T0[i]) * (j - 1) / k)); T1.push(tY(sk.T0[i] + (sk.T1[i] - sk.T0[i]) * j / k)); par = X.length - 1;
    }
    map[i] = par;
  }
  const N = X.length, flag = new Uint8Array(N), out = { N, X, Y, Z, PAR, T0, T1, flag };
  if (sk.tipw) { out.tipw = sk.tipw.map(([i, w]) => [map[i], w]); for (const [i] of out.tipw) for (let j = i; j > 0; j = PAR[j]) flag[j] = 1; } // nebari: sem gemas
  if (sk.boost) out.boost = sk.boost.map(b => ({ a: first[b.a], i: map[b.i], t: tY(b.t), f: b.f })); // raízes aéreas da gramática
  if (sk.jin) { out.jin = []; for (const i of sk.jin) for (let j = first[i]; j <= map[i]; j++) { out.jin.push(j); flag[j] = 2; } }
  out.buds = [];
  for (const c of cap.out) { const o = G.syms[c.c](c.p || [], c); if (o) out.buds.push({ node: map[c.node], d: c.d, ord: o.ord ?? 1 }); }
  out.budsOn = G.budsOn ? (i) => !flag[i] && G.budsOn(i, out) : null;
  return out;
}
// ---------- simulação -> esqueleto + instâncias (o resto da montagem é o mesmo das versões anteriores) ----------
export function buildSimSkeleton(id, seed, sp, P, env = ENV_DEFAULT) {
  const S = SIMS[id](P, new Rand(`${seed}::${id}::sim`), sp, { seed, id });
  const sc = simScaffold(sp, P, seed, id, S.scaffold);
  S.cfg.scaffold = sc;
  S.cfg._lambdaMul = env.growPhysics ? (P._genome?.dominancia ?? 1) : 1;
  S.cfg._windAsym = env.growPhysics ? (P._genome?.vento ?? 0) : 0;
  const R = growSim(S.cfg, new Rand(`${seed}::${id}::grow`), env);
  const sk = { N: R.N, X: R.X, Y: R.Y, Z: R.Z, PAR: R.PAR, T0: R.T0, T1: R.T1, TD: R.TD };
  if (sc.tipw) sk.tipw = sc.tipw; if (sc.jin) sk.jin = sc.jin;
  const bo = (sc.boost || []).concat(R.roots); if (bo.length) sk.boost = bo;
  const inst = {}, rng = new Rand(`${seed}::${id}::sim-inst`);
  const push = (k, it) => { const a = inst[k] || (inst[k] = []); if (a.length < MAX_INST) a.push(it); };
  for (const l of R.leaves) push(l.kind, { p: new V3(l.x, l.y, l.z), y: new V3(...l.ly), z: new V3(...l.lz), s: l.s, life: [l.t0, l.t1], node: l.node, arc: 0 });
  if (S.flower) for (const f of R.flowers) S.flower(f, push, R, rng);
  return { word: [], done: S.cfg.years, tEnd: R.tEnd, sk, inst, deadK: S.deadK, ring: S.ring, sim: { years: S.cfg.years, stats: R.stats, about: S.about } };
}
// flor no fim de um eixo (mesma construção do símbolo K da tartaruga)
function simFlower(push, P, rng, pos, H, s, life) {
  const Hn = H.clone().normalize(), Ln = new V3().crossVectors(UPV, Hn); if (Ln.lengthSq() < 1e-6) Ln.set(1, 0, 0); Ln.normalize();
  const Un = new V3().crossVectors(Hn, Ln);
  const np = P.petals || 5, open = (P.open || 60) * DEG, off = rng.f() * Math.PI * 2, layers = P.double ? 2 : 1;
  for (let l = 0; l < layers; l++) for (let i = 0; i < np; i++) {
    const ang = off + (i + l * 0.5) / np * Math.PI * 2 + rng.jit(0.12);
    const r = Ln.clone().multiplyScalar(Math.cos(ang)).addScaledVector(Un, Math.sin(ang)), t = Ln.clone().multiplyScalar(-Math.sin(ang)).addScaledVector(Un, Math.cos(ang));
    const o = open * (l ? 0.55 : 1) + rng.jit(0.1), dir = Hn.clone().multiplyScalar(Math.cos(o)).addScaledVector(r, Math.sin(o)).normalize();
    push('petal', { p: pos.clone(), y: dir, z: new V3().crossVectors(dir, t).normalize(), s: s * (l ? 0.72 : 1), life, layer: l, node: 0, arc: 0 });
  }
  push('center', { p: pos.clone().addScaledVector(Hn, s * 0.06), y: Hn.clone(), z: Un.clone(), s: s * 0.17, life, node: 0, arc: 0 });
}
// ---------- configuração por espécie: a gramática define o caráter, a simulação enche a copa ----------
// unidades = as da gramática clássica (o tamanho final é normalizado por sp.height de qualquer forma)
export const SIMS = {
  carvalho(P, r) {
    const hb = P.trunk * r.range(0.95, 1.15), rx = r.range(6.5, 8), ry = r.range(4.6, 5.6), cy = hb + ry * 0.92, l0 = 0.34;
    const lob = [r.range(0, 6.28), r.range(0, 6.28), r.range(0.1, 0.18)];
    return {
      ring: 0.75,
      about: 'decurrente: dominância apical cai com a idade (λ 0,60 → 0,50), copa larga',
      scaffold: { axiom: `!(1)F(${n(hb)})/(${n(P.lean * 9)})+(${n(P.lean)})A`, years: 5, seg: 0.4, syms: { A: () => ({ ord: 0 }) }, budsOn: (i, s) => s.Y[i] > hb * 0.35 },
      cfg: {
        years: 40, maxNodes: 22000, markers: 7000, rp: 2.2, dk: 0.62, cone: 0.95, maxTurn: 0.35,
        // a copa disponível cresce com a idade: estreita e alta quando jovem, larga e baixa quando velha
        markerYear: (p) => 40 * Math.max(Math.pow(Math.hypot(p[0], p[2]) / (rx * 1.05), 1 / 0.85), Math.pow(p[1] / (cy + ry), 1 / 0.55)),
        sample: (r) => { const x = r.range(-1, 1), y = r.range(-1, 1), z = r.range(-1, 1), a = Math.atan2(z, x);
          const k = 1 + lob[2] * Math.sin(3 * a + lob[0]) + 0.08 * Math.sin(5 * a + lob[1]);
          if (x * x + y * y + z * z > k * k) return null; const py = cy + y * ry; if (py < hb + 0.6) return null; return [x * rx, py, z * rx]; },
        shadow: { vox: 0.6, q: 8, b: 1.1, a: 1, C: 1.5 },
        alpha: 2.2, nMax: (o) => o === 0 ? 5 : 4, lambda: (y) => 0.6 - 0.1 * smooth01(5, 25, y),
        xi: () => 0.4, trop: (o) => o === 0 ? 0.08 : -P.gravity * 0.1, len: () => l0,
        phyllo: (o) => ({ type: 'alt', div: P.div, angle: o === 0 ? 50 : P.angle + 12, p: 0.85 }), maxOrder: 6, maxIdle: 4,
        leaf: { kind: 'leaf', per: () => 3, size: P.leafSize, pitch: 50, keep: () => 5 },
        shedAge: 3, shedT: () => 0.3,
      },
    };
  },
  sequoia(P, r) {
    const per = P.per, n0 = P.n, H = P.internode * n0 * 0.85, R = r.range(3.2, 4.0) * (0.8 + 0.2 * P.round), NY = 70;
    return {
      ring: 0.88,
      about: 'excurrente: tronco da gramática, verticilos de galhos, copa cônica; os galhos de baixo ficam na sombra e caem (autopoda)',
      scaffold: {
        axiom: `!(1)A(0)`, iters: n0, seg: 0.6, years: NY * 0.92,
        rules: { A: (p, r) => { const k = p[0]; if (k >= n0) return `B`;
          // dois verticilos por entrenó da gramática (um por ano de crescimento, aprox.)
          const l = P.internode * (1 - 0.3 * k / n0) / 2; let o = '';
          for (let h = 0; h < 2; h++) { o += `F(${n(l)})`;
            if (k >= 1) for (let i = 0; i < per; i++) if (r.chance(0.8)) o += `[/(${n(i * 360 / per + r.jit(30))})&(${n(P.angle + r.jit(8))})B]`;
            o += `/(${n(137.5 + r.jit(10))})`; }
          return o + `A(${k + 1})`; } },
        syms: { B: () => ({ ord: 1 }) },
      },
      cfg: {
        years: NY, maxNodes: 22000, markers: 6500, rp: 1.8, dk: 0.5, cone: 1.0, maxTurn: 0.3,
        markerYear: (p) => Math.max(p[1] / H * NY * 0.92 - 1, Math.hypot(p[0], p[2]) / 0.12),
        bend: (d, o) => { if (o >= 1) { d[1] = Math.min(0.1, Math.max(-0.3, d[1])); const L = Math.hypot(d[0], d[1], d[2]); d[0] /= L; d[1] /= L; d[2] /= L; } }, // galhos plagiotrópicos: ficam quase na horizontal
        sample: (r) => { const y = r.range(0.3, H + 0.6), u = y / (H + 0.6), rr = R * Math.pow(Math.max(1 - u, 0), 0.8) * (0.88 + 0.12 * Math.sin(y * 2.7));
          const a = r.f() * 6.2832, d = Math.sqrt(r.f()) * rr; return [Math.cos(a) * d, y, Math.sin(a) * d]; },
        shadow: { vox: 0.7, q: 10, b: 1.15, a: 1, C: 1.5 },
        alpha: 2.0, nMax: (o) => o === 1 ? 5 : 3, lambda: () => 0.54,
        xi: () => 0.3, trop: (o) => o === 1 ? -P.droop * 0.15 : P.upturn * 0.2, len: () => 0.3,
        phyllo: () => ({ type: 'plag', angle: 50, p: 0.75 }), maxOrder: 3, maxIdle: 3,
        leaf: { kind: 'needles', per: () => 4, along: true, size: P.needleLen * 0.75, needle: true, keep: () => 9 },
        shedAge: 4, shedT: (o, y, h) => 0.04 + 0.08 * smooth01(18, 45, y) + (h < 0.5 * smooth01(25, 60, y) ? 1 : 0), // jovem: tolera sombra (cone cheio); velha: autopoda forte
      },
    };
  },
};
// ---------- fábrica genérica: o envelope da copa sai da própria planta clássica da mesma seed ----------
// (nuvem de folhas/agulhas do L-System clássico, com a idade em que cada uma nasce): os pontos de atração
// ficam em volta dessa nuvem e só "acendem" no ano em que a planta clássica chegaria ali. Assim a forma
// característica (chorão, guarda-chuva, garrafa...) continua; a simulação decide como os galhos a ocupam.
function classicCloud(sp, P, seed, id, kinds) {
  const def = sp.build(P);
  const { word } = runLSystem(def, P.iterations, new Rand(`${seed}::${id}::rules`), new Rand(`${seed}::${id}::juvenile`));
  const { sk, inst } = interpret(word, sp, P, new Rand(`${seed}::${id}::turtle`));
  const pts = [], sz = [];
  for (const k of kinds) for (const it of inst[k] || []) if (it.life[1] > 1e8) { // idade do ponto = nascimento de um ancestral do nó (a copa chega ali antes da folha final)
    let a = it.node; for (let q = 0; q < 4 && a > 0; q++) a = sk.PAR[a];
    pts.push([it.p.x, it.p.y, it.p.z, sk.T0[a]]); sz.push(it.s); }
  sz.sort((a, b) => a - b);
  let H = 0; for (let i = 0; i < sk.N; i++) H = Math.max(H, sk.Y[i]);
  return { def, pts, size: sz.length ? sz[sz.length >> 1] : 0.3, H };
}
function crownSim(o) {
  return (P, r, sp, ctx) => {
    const NY = o.years, yr = (t) => t * NY / (P.iterations + 1); // tempo do L-System (iterações) -> anos
    const kind = sp.padKind || 'leaf', cl = classicCloud(sp, P, ctx.seed, ctx.id, o.kinds || [kind]), pts = cl.pts, dil = o.dil ?? 0.6; cl.kind = kind;
    const occ = new Set(), oc = o.pruneCell ?? 0.5, ok = (x, y, z) => `${Math.floor(x / oc)},${Math.floor(y / oc)},${Math.floor(z / oc)}`;
    if (o.prune) for (const p of pts) occ.add(ok(p[0], p[1], p[2]));
    const near = (x, y, z) => { const ix = Math.floor(x / oc), iy = Math.floor(y / oc), iz = Math.floor(z / oc);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) if (occ.has(`${ix + a},${iy + b},${iz + c}`)) return true; return false; };
    const G = o.scaffold(P, cl.def, r);
    G.time = G.time || yr; G.iters = G.iters ?? 0;
    const cfg = Object.assign({
      years: NY, maxNodes: 20000, markers: o.markers ?? 5000, rp: 1.6, dk: 0.45, cone: 1.0, maxTurn: 0.4,
      sample: (rr) => { if (!pts.length) return null; const q = pts[Math.floor(rr.f() * pts.length)];
        const u = rr.f() * 6.2832, v = Math.acos(2 * rr.f() - 1), d = dil * Math.cbrt(rr.f());
        const x = q[0] + d * Math.sin(v) * Math.cos(u), y = q[1] + d * Math.cos(v), z = q[2] + d * Math.sin(v) * Math.sin(u);
        return y < 0.15 ? null : [x, y, z, yr(q[3]) * (o.ahead ?? 1)]; },
      markerYear: (p) => p[3],
      shadow: { vox: 0.55, q: 8, b: 1.1, a: 1, C: 1.5 },
      alpha: 2, nMax: () => 3, lambda: () => 0.55, xi: () => 0.4, trop: () => 0, len: () => 0.3,
      phyllo: () => ({ type: 'alt', div: 137.5, angle: 45, p: 0.85 }), maxOrder: 5, maxIdle: 6,
      shedAge: 3, shedT: () => 0.12,
    }, o.cfg(P, cl, r));
    if (cfg.leaf && cfg.leaf.size == null) cfg.leaf.size = cl.size;
    if (o.prune) cfg.prune = { every: o.prune.every, base: false, inside: (x, y, z) => near(x, y, z) };
    return { ring: o.ring, deadK: o.deadK, about: o.about, scaffold: G, cfg, flower: o.flower ? (f, push, R, rng) => o.flower(f, push, R, rng, P) : null };
  };
}
const only = (rules, keys) => Object.fromEntries(keys.map(k => [k, rules[k]])); // andaime: só as regras estruturais (as outras viram gemas)
const hang = (f, push, R, rng, kind, s, P) => { const i = f.node; push(kind, { p: new V3(R.X[i], R.Y[i], R.Z[i]), y: UPV.clone(), z: new V3(1, 0, 0).applyAxisAngle(UPV, rng.f() * 6.28), s, life: [f.t0, 1e9], node: i, arc: 0 }); };
Object.assign(SIMS, {
  pinheiro: crownSim({
    years: 45, ring: 0.8, kinds: ['needles'], dil: 0.55,
    about: 'excurrente: tronco e verticilos da gramática; galhos e raminhos crescem pelo espaço e pela luz; os verticilos de baixo secam e caem',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: only(def.rules, ['A']), iters: P.iterations, seg: 0.45, syms: { B: () => ({ ord: 1 }) } }),
    cfg: (P) => ({ rp: 1.5, dk: 0.42, nMax: (o) => o === 1 ? 4 : 2, lambda: () => 0.56, len: () => 0.3, xi: () => 0.3,
      trop: (o) => -P.droop * 0.12, bend: (d, o) => { if (o >= 1) { d[1] = Math.min(0.15, Math.max(-0.45, d[1])); norm3(d); } },
      phyllo: () => ({ type: 'plag', angle: P.twigAngle, p: 0.8 }), maxOrder: 3,
      leaf: { kind: 'needles', per: () => 2, along: true, needle: true, keep: () => 7, size: P.needleLen * 0.6 },
      shedT: (o, y, h) => 0.06 + 0.1 * smooth01(15, 40, y) + (h < 0.3 * smooth01(25, 45, y) ? 1 : 0) }),
  }),
  arbusto: crownSim({
    years: 14, ring: 0.6, kinds: ['leaf'], dil: 0.4, markers: 4000,
    about: 'vários caules da base; brotos disputam espaço e luz; gemas na ponta viram flor (destino da gema)',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: def.rules, iters: 1, seg: 0.3, syms: { A: () => ({ ord: 1 }) } }),
    cfg: (P) => ({ rp: 1.1, dk: 0.3, nMax: () => 2, lambda: () => 0.48, len: () => 0.2, xi: () => 0.45, trop: () => 0.03, maxTurn: 0.3,
      phyllo: () => ({ type: 'alt', div: P.div, angle: P.angle + 15, p: 0.85 }), maxOrder: 6,
      leaf: { kind: 'leaf', per: () => 3, pitch: 50, keep: () => 6 },
      flower: { from: 4, p: 0.18 }, shedT: () => 0.08 }),
    flower: (f, push, R, rng, P) => { const i = f.node; simFlower(push, P, rng, new V3(R.X[i], R.Y[i], R.Z[i]), new V3(...f.d), P.flowerSize * (0.8 + 0.35 * rng.f()), [f.t0, 1e9]); },
  }),
  salgueiro: crownSim({
    years: 30, ring: 0.7, kinds: ['leaf'], dil: 0.5,
    about: 'pernadas da gramática; os ramos finos crescem para o espaço e caem com a gravidade (cortinas); orbes nascem como destino de gema',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: only(def.rules, ['A']), iters: 2, seg: 0.6, syms: { A: () => ({ ord: 1 }), T: () => ({ ord: 2 }) } }),
    cfg: (P) => ({ rp: 1.6, dk: 0.4, nMax: () => 4, lambda: () => 0.52, len: () => 0.32, xi: () => 0.35,
      trop: (o) => o >= 2 ? -P.gravity * 1.4 : 0, maxTurn: 0.6, nMax: (o) => o >= 2 ? 6 : 3, lambda: (y, o) => o >= 2 ? 0.75 : 0.52,
      phyllo: (o) => ({ type: 'alt', div: P.div, angle: o >= 1 ? 40 : P.angle, p: 0.85 }), maxOrder: 4,
      leaf: { kind: 'leaf', per: () => 2, pitch: 35, keep: () => 14, droop: 0.4 },
      flower: { from: 6, p: 0.05 }, shedT: () => 0.08 }),
    flower: (f, push, R, rng, P) => hang(f, push, R, rng, 'orb', P.orbSize * (0.6 + 0.6 * rng.f()), P),
  }),
  dragoeiro: crownSim({
    years: 30, ring: 0.6, kinds: ['leaf'], dil: 0.7, markers: 3500,
    about: 'dicotomia: cada broto termina em duas gemas e a ponta para; rosetas de folhas só nas pontas; o guarda-chuva enche pelo espaço livre',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: def.rules, iters: Math.max(1, P.iterations - 4), seg: 0.5, syms: { A: () => ({ ord: 1 }) } }),
    cfg: (P) => ({ rp: 1.8, dk: 0.6, nMax: () => 3, lambda: () => 0.5, len: () => 0.32, xi: () => 0.25, trop: () => P.up * 0.8, maxTurn: 0.25,
      phyllo: () => ({ type: 'whorl', n: 2, angle: P.angle, p: 1, jit: 0.2 }), fork: () => true, maxOrder: 9,
      leaf: { kind: 'leaf', per: () => Math.round(P.leaves * 0.6), pitch: 62, pitchJ: 20, keep: () => 1 },
      shedT: () => 0.06 }),
  }),
  baoba: crownSim({
    years: 30, ring: 0.85, kinds: ['leaf'], dil: 0.6, markers: 3000,
    about: 'tronco-garrafa da gramática; a copa curta e retorcida cresce pelo espaço; frutos pendentes como destino de gema',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: only(def.rules, ['C', 'B']), iters: 2, seg: 0.6, syms: { B: () => ({ ord: 1 }) } }),
    cfg: (P) => ({ rp: 2.5, dk: 0.45, nMax: () => 3, lambda: () => 0.5, len: () => 0.3, xi: () => 0.45, maxTurn: 0.6,
      bend: (d, o, rng) => { d[0] += rng.jit(0.35); d[2] += rng.jit(0.35); norm3(d); },
      phyllo: () => ({ type: 'alt', div: 140, angle: 40, p: 0.6 }), maxOrder: 5,
      leaf: { kind: 'leaf', per: () => 3, pitch: 50, keep: () => 3 },
      flower: P.fruits ? { from: 10, p: 0.06 } : null, shedT: () => 0.08 }),
    flower: (f, push, R, rng, P) => hang(f, push, R, rng, 'fruit', P.fruitSize * (0.8 + 0.4 * rng.f()), P),
  }),
  eucalipto: crownSim({
    years: 40, ring: 0.8, kinds: ['leaf'], dil: 0.6,
    about: 'tronco alto e reto da gramática; galhos altos crescem pela luz, os de baixo caem (fuste limpo); folhas pendentes',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: only(def.rules, ['A']), iters: P.n + 1, seg: 0.5, time: (t) => t * 40 / (P.n + 2) * 0.9, syms: { B: () => ({ ord: 1 }) } }),
    cfg: (P) => ({ markers: 6500, rp: 2.0, dk: 0.4, nMax: () => 5, lambda: () => 0.53, len: () => 0.36, xi: () => 0.35, trop: (o) => 0.03,
      phyllo: () => ({ type: 'alt', div: 137.5, angle: 38, p: 0.8 }), maxOrder: 5,
      leaf: { kind: 'leaf', per: () => 4, pitch: 120, pitchJ: 15, keep: () => 6 },
      shedT: (o, y, h) => 0.08 + (h < 0.45 * smooth01(15, 35, y) ? 1 : 0) }),
  }),
  figueira: crownSim({
    years: 35, ring: 0.7, kinds: ['leaf'], dil: 0.6,
    about: 'galhos horizontais e raízes aéreas da gramática; a copa larga cresce pelo espaço e pela luz',
    scaffold: (P, def) => ({ axiom: def.axiom, rules: only(def.rules, ['B']), iters: Math.max(2, P.iterations - 2), seg: 0.5, syms: { B: () => ({ ord: 1 }), C: () => ({ ord: 1 }) } }),
    cfg: (P) => ({ rp: 1.7, dk: 0.5, nMax: () => 3, lambda: () => 0.52, len: () => 0.32, xi: () => 0.4, trop: () => 0.02,
      phyllo: () => ({ type: 'alt', div: 137.5, angle: 42, p: 0.85 }), maxOrder: 5,
      leaf: { kind: 'leaf', per: () => 2, pitch: 55, keep: () => 4 }, shedT: () => 0.1 }),
  }),
});
// bonsais: o andaime é o estilo inteiro (nebari, tronco, jin, galhos); cada almofada vira uma gema que brota raminhos
// para dentro do volume da almofada clássica; a cada `every` anos a "tesoura" corta o que saiu dele (poda de formação)
const bonsaiSim = (every) => crownSim({
  years: 24, ring: 0.85, dil: 0.22, markers: 3500, prune: { every }, pruneCell: 0.25, ahead: 0.6,
  about: `estilo da gramática; os raminhos das almofadas crescem pelo espaço e pela luz e levam poda de formação a cada ${every} anos`,
  scaffold: (P, def) => ({ axiom: def.axiom, rules: def.rules, iters: P.iterations, seg: 0.35, time: (t) => t * 24 * 0.6 / (P.iterations + 1), syms: { Z: () => ({ ord: 2 }), B: () => ({ ord: 2 }), C: () => ({ ord: 2 }), D: () => ({ ord: 2 }) } }),
  cfg: (P, cl) => ({ shadow: { vox: 0.4, q: 4, b: 1.3, a: 1, C: 4 }, rp: 0.7, dk: 0.16, cone: 1.2, nMax: () => 2, lambda: () => 0.5, len: () => 0.1, xi: () => 0.5, trop: () => 0.04, maxTurn: 0.6,
    phyllo: () => ({ type: 'alt', div: 137.5, angle: 50, p: 0.9 }), maxOrder: 7, maxIdle: 8,
    leaf: { kind: cl.kind, per: () => 3, pitch: 30, pitchJ: 25, keep: () => 4, needle: cl.kind === 'needles' }, shedT: () => 0.06 }),
});
for (const id of ['bordo', 'pinheiro_branco', 'cipreste', 'junipero']) SIMS[id] = (P, r, sp, ctx) => bonsaiSim(id === 'bordo' ? 2 : 3)(P, r, sp, ctx);
/* SIM-END */
/* =====================================================================
   7. Montagem: esqueleto -> raios (Leonardo + idade) -> tubos contínuos
   ===================================================================== */
// Regra de Leonardo: r^e = Σ r_filho^e (pontas = 1), só com os nós que já existem na idade T,
// vezes o crescimento secundário (1 + G·idade_do_nó). Barato: O(N) por quadro.
export function computeRadii(sk, T, W, s, out) {
  if (W.TD) return computeRadiiSim(sk, T, W, s, out); // v7: crescimento simulado (nós com morte)
  const { N, PAR, T0, T1 } = sk; s.fill(0);
  for (let i = N - 1; i >= 1; i--) {
    if (T0[i] > T) continue;
    if (s[i] === 0) {
      s[i] = Math.min(1, (T - T0[i]) / Math.max(T1[i] - T0[i], 1e-4)) + 1e-6; // ponta (crescendo)
      if (W.TW && W.TW[i]) s[i] *= W.TW[i]; // v6: raiz do nebari pesa como vários galhos (engrossa a base)
    }
    s[PAR[i]] += s[i];
  }
  let smax = 1e-6; for (let i = 1; i < N; i++) if (s[i] > smax) smax = s[i];
  // r = parte de Leonardo (cano: Σ r^e dos filhos) × (1 + G·idade) + anéis de crescimento (∝ idade, ponderado pela "carga" do nó)
  const invE = 1 / W.leo, G = W.G / W.tEnd, sc = W.scale, rmin = W.rMin, ring = W.ring, sh = W.share;
  let mx = 0;
  for (let i = 0; i < N; i++) {
    if (s[i] === 0) { out[i] = 0; continue; }
    const age = Math.max(0, T - T1[i]);
    const r = Math.max(Math.pow(s[i], invE) * (1 + G * age) * sc + ring * age * Math.pow(s[i] / smax, sh), rmin * Math.min(1, s[i]));
    out[i] = r; if (i > 0 && r > mx) mx = r;
  }
  if (W.roots) { // v5: raiz aérea que tocou o chão engrossa como um tronco próprio (não passa a carga pelo galho: fora da regra de Leonardo)
    const rT = out[1] || out[0];
    for (const b of W.roots) {
      const g = Math.min(1, Math.max(0, (T - b.t) / b.d)); if (g <= 0) continue;
      const rr = rT * b.f * Math.pow(g, 0.8), k = Math.max(b.i - b.a, 1);
      for (let j = b.a; j <= b.i; j++) if (out[j] > 0) { const v = Math.max(out[j], rr * (0.8 + 0.2 * (j - b.a) / k)); out[j] = v; if (v > mx) mx = v; }
    }
  }
  return mx;
}

// v7: mesma regra, mas um galho que caiu (TD ≤ T) some (raio 0) e continua contando no pai com a carga que tinha:
// os canos dele viram cerne do tronco, que não afina quando a árvore se poda sozinha.
export function computeRadiiSim(sk, T, W, s, out) {
  const { N, PAR, T0, T1 } = sk, TD = W.TD; s.fill(0);
  for (let i = N - 1; i >= 1; i--) {
    if (T0[i] > T) continue;
    if (s[i] === 0) { s[i] = Math.min(1, (T - T0[i]) / Math.max(T1[i] - T0[i], 1e-4)) + 1e-6; if (W.TW && W.TW[i]) s[i] *= W.TW[i]; }
    s[PAR[i]] += TD[i] <= T && TD[PAR[i]] > T ? s[i] * W.deadK : s[i]; // galho que caiu: os canos ficam no pai, com peso deadK
  }
  let smax = 1e-6; for (let i = 1; i < N; i++) if (s[i] > smax) smax = s[i];
  const invE = 1 / W.leo, G = W.G / W.tEnd, sc = W.scale, rmin = W.rMin, ring = W.ring, sh = W.share;
  let mx = 0;
  for (let i = 0; i < N; i++) {
    if (s[i] === 0 || TD[i] <= T) { out[i] = 0; continue; }
    const age = Math.max(0, T - T1[i]);
    const r = Math.max(Math.pow(s[i], invE) * (1 + G * age) * sc + ring * age * Math.pow(s[i] / smax, sh), rmin * Math.min(1, s[i]));
    out[i] = r; if (i > 0 && r > mx) mx = r;
  }
  if (W.roots) { const rT = out[1] || out[0];
    for (const b of W.roots) { const g = Math.min(1, Math.max(0, (T - b.t) / b.d)); if (g <= 0) continue;
      const rr = rT * b.f * Math.pow(g, 0.8), k = Math.max(b.i - b.a, 1);
      for (let j = b.a; j <= b.i; j++) if (out[j] > 0) { const v = Math.max(out[j], rr * (0.8 + 0.2 * (j - b.a) / k)); out[j] = v; if (v > mx) mx = v; } } }
  return mx;
}
export { wordToString };

function plainVec(v) {
  if (v == null) return null;
  if (typeof v.x === 'number') return { x: v.x, y: v.y, z: v.z };
  return v;
}
function vecFromPlain(p) {
  if (!p) return null;
  if (p.isVector3 || p instanceof Vec3) return p;
  return new Vec3(p.x, p.y, p.z);
}

export function serializeInst(inst) {
  const out = {};
  for (const k in inst) {
    out[k] = inst[k].map((it) => {
      const o = { ...it, p: plainVec(it.p), y: plainVec(it.y), z: plainVec(it.z) };
      if (o.life) o.life = o.life.slice();
      return o;
    });
  }
  return out;
}

export function reviveTyped(f) {
  if (f && f.kind === 'typed') return new globalThis[f.ctor](f.buffer, f.byteOffset, f.length);
  return f;
}

export function unpackWorkerPayload(payload) {
  const sk = { ...payload.sk };
  for (const k of ['X', 'Y', 'Z', 'PAR', 'T0', 'T1', 'TD']) if (sk[k]) sk[k] = reviveTyped(sk[k]);
  payload.sk = sk;
  payload.rFull = reviveTyped(payload.rFull);
  payload.rTube = reviveTyped(payload.rTube);
  if (payload.tags) payload.tags = reviveTyped(payload.tags);
  if (payload.W?.TW) payload.W.TW = reviveTyped(payload.W.TW);
  if (payload.W && payload.sk.TD) payload.W.TD = payload.sk.TD;
  return payload;
}

export function deserializeInst(inst) {
  const out = {};
  for (const k in inst) {
    out[k] = inst[k].map((it) => ({
      ...it,
      p: vecFromPlain(it.p),
      y: vecFromPlain(it.y),
      z: vecFromPlain(it.z),
    }));
  }
  return out;
}

/** Skeleton + params for assemblePlant (main thread adds THREE meshes). */
export function buildSkeletonPackage(id, seed, opts = {}, env = ENV_DEFAULT, genomeState = null) {
  const ENV = { ...ENV_DEFAULT, ...env };
  const genomeOverlay = genomeState?.overlay ?? null;
  const t0 = performance.now();
  const sp = SPECIES[id];
  const P = sp.params(new Rand(`${seed}::${id}::params`));
  const applyGenes = !!(genomeState && genomeState.apply);
  const genome = mergeGenome(genomeFromSeed(seed, id, Rand), genomeOverlay);
  applyGenomeToPlant(P, null, null, genome, sp, applyGenes);
  const def = sp.build(P);
  const SIM = opts.sim && SIMS[id] ? buildSimSkeleton(id, seed, sp, P, ENV) : null;
  const { word, done, tEnd } = SIM || runLSystem(def, P.iterations, new Rand(`${seed}::${id}::rules`), new Rand(`${seed}::${id}::juvenile`));
  const tLs = performance.now();
  const rng = new Rand(`${seed}::${id}::turtle`);
  let { sk, inst } = SIM || interpret(word, sp, P, rng);
  const tSk = performance.now();
  if (opts.lod) clusterFoliage(inst);
  applyGravitySag(sk, ENV.gravity || 0);
  const stones = [];
  const rs = new Rand(`${seed}::${id}::stones`);
  for (let i = 0; i < 3; i++) {
    const ang = rs.f() * Math.PI * 2, rad = rs.range(0.85, 1.7);
    stones.push({ x: Math.cos(ang) * rad, z: Math.sin(ang) * rad, r: rs.range(0.1, 0.26) });
  }
  const pot = BONSAI.includes(id) ? { a: 0.7, b: 0.52 } : null;
  deflectRoots(sk, stones, pot);
  const wr = new Rand(`${seed}::${id}::wood`);
  const lam = SIM && SIM.ring != null ? SIM.ring : sp.wood.ring ?? 0.5;
  const W = { leo: sp.wood.leo[0] + wr.f() * (sp.wood.leo[1] - sp.wood.leo[0]), G: sp.wood.G * (0.8 + wr.f() * 0.4), tEnd, scale: 1, rMin: 0, ring: 0, share: sp.wood.share ?? 0.4 };
  if (opts.lod) W.lod = true;
  applyGenomeToPlant(P, null, W, genome, sp, applyGenes);
  if (SIM) { W.TD = sk.TD; W.deadK = SIM.deadK ?? 0.45; }
  if (sk.tipw) { W.TW = new Float32Array(sk.N); for (const [i, w] of sk.tipw) W.TW[i] = w; }
  if (sk.boost) W.roots = sk.boost.map((b) => ({ a: b.a, i: b.i, t: b.t, d: Math.max(tEnd - b.t, 0.5) * 0.9, f: b.f }));
  const sbuf = new Float32Array(sk.N);
  const rFull = new Float32Array(sk.N);
  const unitMax = computeRadii(sk, tEnd, W, sbuf, rFull) || 1;
  W.scale = (1 - lam) * sp.baseWidth / unitMax;
  W.ring = lam * sp.baseWidth / tEnd;
  W.rMin = sp.baseWidth * (sp.wood.tip ?? 0.012);
  const rMaxFull = computeRadii(sk, tEnd, W, sbuf, rFull);
  W.rMaxFull = rMaxFull;
  let rTube = rFull;
  if (SIM) {
    rTube = rFull.slice();
    const tmp = new Float32Array(sk.N);
    for (let y = 1; y < SIM.sim.years; y += 1) {
      computeRadii(sk, y + 0.95, W, sbuf, tmp);
      for (let i = 0; i < sk.N; i++) if (tmp[i] > rTube[i]) rTube[i] = tmp[i];
    }
  }
  const tags = sp.tags ? sp.tags(sk) : null;
  const BK = BARK[id](P, new Rand(`${seed}::${id}::bark`));
  applyGenomeToPlant(P, BK, W, genome, sp, applyGenes);
  const instPlain = serializeInst(inst);
  const display = def.display || [];
  return {
    id,
    seed,
    opts,
    sp: { id, name: sp.name, emoji: sp.emoji, height: sp.height, theme: typeof sp.theme === 'function' ? sp.theme(P) : sp.theme, desc: sp.desc, baseWidth: sp.baseWidth, bump: sp.bump, leafKind: sp.leafKind, fx: sp.fx, float: sp.float, years: sp.years },
    P,
    defDisplay: display,
    word,
    done,
    tEnd,
    W,
    genome,
    rFull: Float32Array.from(rFull),
    rTube: Float32Array.from(rTube),
    tags: tags ? Float32Array.from(tags) : null,
    sim: SIM && SIM.sim,
    deadK: SIM?.deadK,
    sk,
    inst: instPlain,
    stones,
    pot,
    BK,
    night: sp.theme === 'night',
    timing: { ms: performance.now() - t0, lsMs: tLs - t0, skMs: tSk - tLs },
  };
}

export { genomeFromSeed, mergeGenome, applyGenomeToPlant, clusterFoliage, applyGravitySag };
export { sfc32, wordToString as wordToStr };
