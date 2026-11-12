/**
 * Estilo (arquitetura) separado da espécie (biologia).
 *
 * A espécie guarda folha, casca, cor, entrenó, tendência de ramificação,
 * dominância apical, floração e vigor. O estilo guarda a linha do tronco,
 * o ápice, a proporção, a silhueta e o desenho das almofadas.
 *
 * Estágio 2: regras clássicas de desenho (DESIGN_RULES, designOf, shapeDesign,
 * enforceDesignRadii, measureDesign). Cada regra é um número que o estilo
 * (rules) e a espécie (design) podem afinar. A mesma (seed, espécie, estilo)
 * continua determinística. Estágio 3 lê measureDesign e preenche scoreTree.
 */
const DEG = Math.PI / 180;
const n = (x) => +(+x).toFixed(3);

/** O observador está em +Z. A frente da árvore aponta para a câmera. */
export const FRONT = { x: 0, y: 0, z: 1 };
/** Câmera inicial: de frente, um pouco acima, com um fio de lado para a luz pegar o tronco. */
export const FRONT_VIEW = { x: 0.05, y: 0.36, z: 1 };

export const STYLE_ORDER = ['chokkan', 'moyogi', 'shakan', 'kengai', 'han_kengai', 'hokidachi'];

export const STYLES = {
  chokkan: {
    id: 'chokkan',
    name: 'Chokkan',
    jp: '直幹',
    pt: 'ereto formal',
    desc: 'Tronco reto e vertical, ápice sobre a base, silhueta triangular e galhos em andares que encurtam até o topo.',
    trunk: { incline: 2, curvature: 0.04, bends: 0, apexOverBase: 0.98, frontLean: 3.2 },
    ratio: 1.7,
    crown: 'triangle',
    pads: 'tiers',
    keepsLowTrunk: false,
    rules: { taperRatio: 7.6, crownRatio: 0.66, firstBranch: 0.3, droop: 12, lift: 8, branchThin: 0.55 },
  },
  moyogi: {
    id: 'moyogi',
    name: 'Moyogi',
    jp: '模様木',
    pt: 'ereto informal',
    desc: 'Tronco em S suave, ápice ligeiramente à frente da base, copa assimétrica e almofadas do lado de fora das curvas.',
    trunk: { incline: 8, curvature: 1, bends: 3, apexOverBase: 0.4, frontLean: 6 },
    ratio: 1.15,
    crown: 'irregular',
    pads: 'outside-bends',
    keepsLowTrunk: false,
    rules: { taperRatio: 8, crownRatio: 0.74, firstBranch: 0.27, droop: 18, lift: 12, branchThin: 0.56 },
  },
  shakan: {
    id: 'shakan',
    name: 'Shakan',
    jp: '斜幹',
    pt: 'inclinado',
    desc: 'O tronco pende cerca de 30–45° e o ápice fica fora da base. O galho mais longo faz de contrapeso.',
    trunk: { incline: 38, curvature: 0.35, bends: 1, apexOverBase: 0, frontLean: 5 },
    ratio: 1.2,
    crown: 'slant',
    pads: 'counterweight',
    keepsLowTrunk: false,
    rules: { taperRatio: 7.2, crownRatio: 0.8, firstBranch: 0.24, droop: 16, lift: 10, branchThin: 0.55 },
  },
  kengai: {
    id: 'kengai',
    name: 'Kengai',
    jp: '懸崖',
    pt: 'cascata',
    desc: 'O tronco sobe pouco, dobra na borda e desce abaixo da base do vaso. As almofadas acompanham a queda.',
    trunk: { incline: 12, curvature: 1, bends: 4, apexBelow: 1, frontLean: 4 },
    ratio: 0.7,
    crown: 'cascade',
    pads: 'cascade-outside',
    keepsLowTrunk: true,
    rules: { taperRatio: 9, crownRatio: 0.5, firstBranch: 0.16, droop: 20, lift: 10, cascade: true, branchThin: 0.5 },
  },
  han_kengai: {
    id: 'han_kengai',
    name: 'Han-kengai',
    jp: '半懸崖',
    pt: 'semi-cascata',
    desc: 'O tronco dobra e a ponta para junto da borda do vaso, sem descer até a base.',
    trunk: { incline: 18, curvature: 0.8, bends: 3, apexBelow: 0.15, frontLean: 5 },
    ratio: 0.9,
    crown: 'semi-cascade',
    pads: 'cascade-outside',
    keepsLowTrunk: true,
    rules: { taperRatio: 8.4, crownRatio: 0.58, firstBranch: 0.18, droop: 16, lift: 10, cascade: true, branchThin: 0.52 },
  },
  hokidachi: {
    id: 'hokidachi',
    name: 'Hokidachi',
    jp: '箒立ち',
    pt: 'vassoura',
    desc: 'Tronco reto até cerca de um terço da altura e muitos galhos finos que fecham um domo.',
    trunk: { incline: 1, curvature: 0, bends: 0, apexOverBase: 1, frontLean: 2.5 },
    ratio: 0.85,
    crown: 'broom',
    pads: 'dome-fan',
    keepsLowTrunk: false,
    rules: { taperRatio: 5.8, taperMin: 3.6, taperMax: 6.8, crownRatio: 1.08, firstBranch: 0.33, broom: true, alternate: false, splitAt: 0.33, branchThin: 0.66, flare: 1.55, collar: 0.22 },
  },
};

const RULE_BASE = {
  taperRatio: 8, taperMin: 6, taperMax: 10, flare: 1.42,
  firstBranch: 0.28, firstMin: 0.22, firstMax: 0.36,
  branchThin: 0.56, crownRatio: 0.72,
  droop: 16, lift: 12, alternate: true, broom: false, cascade: false,
  splitAt: 0.33, padScale: 1, collar: 0.52, visualBump: 1,
  barGap: 0.045, frontBan: 0.34,
};

/**
 * Parâmetros efetivos. O estilo traz a arquitetura; a espécie (design) afina
 * biologia (flare, queda dos galhos, escala das almofadas). Vassoura e cascata
 * não herdam a proporção de copa dos outros estilos.
 */
export function designOf(styleId, speciesId, speciesRules) {
  const style = (STYLES[styleId] && STYLES[styleId].rules) || {};
  const species = speciesRules || {};
  const d = { ...RULE_BASE, ...style, ...species, styleId, speciesId };
  if (style.broom) {
    d.broom = true;
    d.alternate = false;
    d.cascade = false;
    d.taperRatio = style.taperRatio;
    d.taperMin = style.taperMin ?? 3.6;
    d.taperMax = style.taperMax ?? 6.8;
    d.crownRatio = style.crownRatio;
    d.collar = style.collar ?? 0.22;
    d.splitAt = style.splitAt ?? 0.33;
    d.branchThin = style.branchThin ?? 0.66;
  }
  if (style.cascade) {
    d.cascade = true;
    d.broom = false;
    d.crownRatio = style.crownRatio;
    d.taperRatio = style.taperRatio ?? d.taperRatio;
  }
  d.conifer = speciesId === 'pinheiro_branco' || speciesId === 'pinheiro_negro' || speciesId === 'cipreste' || speciesId === 'junipero';
  return d;
}

/** Regras nomeadas. `axiom` é opcional; o desenho de verdade está em shapeDesign e enforceDesignRadii. */
export const DESIGN_RULES = [
  { id: 'taper', param: 'taperRatio' },
  { id: 'nebari', param: 'flare' },
  { id: 'firstBranch', param: 'firstBranch' },
  { id: 'branchOrder', param: 'branchThin' },
  { id: 'movement', param: 'droop' },
  { id: 'pads', param: 'padScale' },
  { id: 'proportion', param: 'crownRatio' },
  { id: 'broom', param: 'splitAt' },
];

export function applyDesignRules(axiom, ctx) {
  let out = axiom;
  for (const rule of DESIGN_RULES) {
    const fn = typeof rule === 'function' ? rule : rule.axiom;
    if (!fn) continue;
    const next = fn(out, ctx);
    if (typeof next === 'string' && next) out = next;
  }
  return out;
}

/** Nota estética do estágio 3. Hoje não julga: devolve null para o estágio seguinte preencher. */
export function scoreTree(_sk, _style) {
  return null;
}

export function resolveStyle(sp, requested) {
  if (!sp) return requested && STYLES[requested] ? requested : 'moyogi';
  const list = sp.styles || [];
  if (requested && list.includes(requested)) return requested;
  if (sp.defaultStyle && STYLES[sp.defaultStyle]) return sp.defaultStyle;
  return list[0] || 'moyogi';
}

function pad(P, sc = 1) {
  const r = P.padR || 0.3, h = P.padH || r * 0.4, leaves = P.padN || 16, s = P.leafS || 0.12;
  return `Z(${n(r * sc)},${n(h * Math.sqrt(sc))},${Math.max(3, Math.round(leaves * sc * sc))},${n(s)})`;
}

function nebariGeneric(r, k, len, w) {
  let o = '';
  const count = Math.max(3, k | 0);
  for (let i = 0; i < count; i++) {
    o += `[/(${n(i * 360 / count + r.jit(160 / count))})&(${n(90 + r.jit(3))})F(${n(len * (0.7 + r.f() * 0.5))})/(${n(r.jit(40))})+(${n(r.jit(25))})F(${n(len * (0.6 + r.f() * 0.4))})Q(${n(w * (0.5 + r.f()))})]`;
  }
  return o;
}

function nebariFor(id, P, r) {
  if (id === 'ficus') {
    let o = '';
    const gap = 26 + r.f() * 24;
    const span = 360 - gap;
    const base = r.f() * 360;
    const roots = P.roots || 6;
    for (let i = 0; i < roots; i++) {
      const heavy = r.f();
      const L = (P.rootLen || 0.9) * (0.78 + heavy * 0.28);
      const parts = 7;
      const ang = base + (i + 0.5) * span / roots + r.jit(9);
      let seg = `[/(${n(ang)})&(${n(87.5 + r.f() * 2)})`;
      for (let k = 0; k < parts; k++) {
        if (k) seg += `&(${n(k < 3 ? r.range(-0.15, 0.4) : r.range(1.7, 2.9))})+(${n((k % 2 ? 1 : -1) * r.range(7, 15))})/(${n(r.jit(5))})`;
        seg += `F(${n(L / parts * (1 - 0.06 * k))})`;
      }
      seg += `Q(${n((P.rootW || 6) * (0.42 + heavy * 0.95))})]`;
      o += seg;
    }
    return `F(0.04)${o}`;
  }
  if (id === 'azaleia') {
    let o = '';
    const roots = P.roots || 5;
    for (let i = 0; i < roots; i++) {
      o += `[/(${n(i * 360 / roots + r.jit(8))})&(${n(96 + r.f() * 4)})F(${n(0.045 * (0.7 + r.f() * 0.35))})Q(${n((P.rootW || 4) * (0.45 + r.f() * 0.3))})]`;
    }
    return o;
  }
  if (id === 'pinheiro_negro') {
    let o = '';
    const roots = P.roots || 6;
    for (let i = 0; i < roots; i++) {
      o += `[/(${n(i * 360 / roots + r.jit(8))})&(${n(84 + r.f() * 3)})F(${n(0.42 + r.f() * 0.1)})Q(${n((P.rootW || 4) * (0.75 + r.f() * 0.35))})]`;
    }
    return o;
  }
  if (id === 'olmo_chines') return nebariGeneric(r, P.roots || 6, 0.36, P.rootW || 12);
  if (id === 'pinheiro_branco') return nebariGeneric(r, P.roots || 6, 0.38, P.rootW || 12);
  if (id === 'cipreste') return nebariGeneric(r, 5, 0.25, 20);
  if (id === 'junipero') return nebariGeneric(r, 5, 0.3, 30);
  return nebariGeneric(r, P.roots || 5, 0.3, P.rootW || 8);
}

function bioOf(id, P) {
  const unit = P.segLen || (id === 'pinheiro_negro' ? (P.fall || 0.55) * 0.9 : 0.42);
  let segs = P.segs || P.trunkSegs || 7;
  if (id === 'pinheiro_negro') segs = 8;
  const branchLen = P.branchLen || P.Lmax || P.arm || unit * 2.4;
  const bAngle = P.bAngle || P.outerA || 68;
  const level = (id === 'pinheiro_branco' || id === 'pinheiro_negro' || id === 'cipreste') ? 0.84
    : id === 'junipero' ? 0.42
      : id === 'ficus' ? 0.14
        : id === 'azaleia' ? 0.08
          : 0.22;
  const conifer = id === 'pinheiro_branco' || id === 'pinheiro_negro' || id === 'cipreste' || id === 'junipero';
  return { unit, segs, branchLen, bAngle, level, conifer };
}

function reachFor(design, bio, u) {
  const H = Math.max(bio.unit * Math.max(6, bio.segs || 6), 0.7);
  const half = (design?.crownRatio || 0.72) * H * 0.52;
  const len = half * (0.42 + 0.75 * Math.pow(Math.max(0, 1 - u), 0.8));
  const cap = Math.max(bio.branchLen || 0, bio.unit * (design?.speciesId === 'azaleia' ? 3.4 : 2.6));
  return Math.max(bio.unit * 0.85, Math.min(len, cap * (0.55 + 0.5 * (1 - u))));
}

/** Nuvem baixa: domo em cima, mais rasa embaixo. Várias pequenas no ápice, nunca um bloco só. */
function cloudPad(P, sc, id) {
  const s = Math.max(0.2, sc);
  const cut = id === 'ficus' ? 0.4 : id === 'azaleia' ? 0.8 : id === 'bordo' ? 0.78 : 1;
  const pr = (P.padR || 0.28) * cut;
  const r = pr * s * 0.82;
  const h = Math.min((P.padH || r * 0.4) * Math.sqrt(s) * 0.8, r * 0.5);
  const k = Math.max(4, Math.round((P.padN || 14) * s * s * 0.5));
  let out = `Z(${n(r)},${n(Math.max(h, r * 0.22))},${k},${n(P.leafS || 0.12)})`;
  if (id === 'azaleia') {
    out += `E(${n((P.flR || 0.16) * s * 0.48)},${n((P.flH || 0.09) * Math.sqrt(s) * 0.7)},${Math.max(3, Math.round((P.flN || 8) * s * 0.5))},${n(P.flowerSize || 0.03)})`;
  }
  return out;
}

function apexCrown(P, id) {
  const yaws = [28, 150, 265, 205];
  let s = '';
  for (let i = 0; i < 4; i++) s += `[/(${n(yaws[i])})&(18)F(${n(0.045 + 0.01 * i)})${cloudPad(P, 0.36 - i * 0.045, id)}]`;
  return s;
}

/** Conífera: desce e levanta na ponta. Folhosa: sobe um pouco. Almofadas no plano do galho, com vão entre elas. */
function layeredBranch(id, P, yaw, len, sc, design, low) {
  const conifer = !!(design && design.conifer);
  const pitch = conifer ? (low ? 102 + (design.droop || 16) * 0.25 : 78) : (low ? 70 : 58);
  const level = conifer ? (low ? 0.28 : 0.5) : 0.22;
  const up = conifer ? (low ? (design.lift || 12) : (design.lift || 12) * 0.6) : (design.lift || 10) * 0.4;
  const gap = Math.max(0.09, len * 0.34);
  const p1 = cloudPad(P, sc, id);
  const p2 = cloudPad(P, sc * 0.62, id);
  const p3 = cloudPad(P, sc * 0.42, id);
  return `[/(${n(yaw)})&(${n(pitch)})_(${n(level)})F(${n(gap)})${p1}[+(31)_(0.92)F(${n(Math.max(0.08, len * 0.28))})${p2}][-(27)_(0.92)F(${n(Math.max(0.07, len * 0.24))})${p2}]F(${n(gap * 0.8)})^(${n(up)})${p3}]`;
}

function deciduousBranch(id, P, yaw, len, design, low, bag) {
  const pitch = low ? 78 : 64;
  let extra = '';
  if (id === 'ficus' && bag && bag.aerial > 0) {
    extra = `F(0.2)W(0.16,0.06,0.12)`;
    bag.aerial--;
  }
  const safe = Math.max(0.12, len);
  return `[/(${n(yaw)})&(${n(pitch)})_(0.32)F(${n(Math.min(0.1, safe * 0.22))})${extra}B(${n(safe)})]`;
}

function placeBranch(id, P, yaw, len, sc, design, low, bag) {
  if (design && (design.conifer || id === 'azaleia')) return layeredBranch(id, P, yaw, len, sc, design, low);
  return deciduousBranch(id, P, yaw, len, design, low, bag);
}

function emitJin(yaw) {
  // o primeiro F fica com casca viva (o colar); o J só marca o galho fino
  return `[J/(${n(yaw)})&(48)F(0.14)F(0.18)F(0.12)F(0.07)]`;
}

/** Almofada e dois tufos menores, para ler como nuvem e não como um ponto. */
function cloud(P, sc) {
  const s = Math.max(0.22, sc);
  const arm = n(Math.min(0.12, 0.04 + s * 0.03));
  return `${pad(P, s)}[+(32)&(14)F(${arm})${pad(P, s * 0.66)}][-(28)&(10)F(${arm})${pad(P, s * 0.48)}]`;
}

/** yaw 180 aponta para a câmera (+Z). No terço de baixo esse setor é proibido. */
function yawOffFront(yaw, low) {
  if (!low) return yaw;
  let y = ((yaw % 360) + 360) % 360;
  const d = Math.abs(y - 180);
  const dist = Math.min(d, 360 - d);
  if (dist < 26) y += y < 180 ? -32 : 32;
  return y;
}

function trunkChokkan(id, P, bio, r, bag, design) {
  const segs = Math.max(bio.conifer ? 8 : 6, Math.min(12, bio.segs < 6 ? 7 : bio.segs));
  const bare = Math.max(2, Math.round(segs * (design?.firstBranch || 0.3)));
  const yaws = [96, 270, 8, 118, 246, 350];
  let ax = `^(${n(1.6)})`;
  let placed = 0;
  for (let k = 0; k < segs; k++) {
    const len = bio.unit * (1 - 0.38 * k / segs);
    ax += `&(${n(r.jit(0.5))})/(${n(r.jit(0.8))})F(${n(len)})`;
    if (k < bare) continue;
    const u = (k - bare) / Math.max(1, segs - bare - 0.2);
    const low = u < 0.34;
    const yaw = yawOffFront(yaws[placed % yaws.length] + r.jit(6), low);
    const bl = reachFor(design, bio, u);
    ax += placeBranch(id, P, yaw, bl, 0.95 - u * 0.45, design, low, bag);
    if (id === 'junipero' && bag.jin > 0 && placed % 2 === 1) {
      bag.jin--;
      ax += emitJin(yaw + 42);
    }
    placed++;
  }
  ax += `^(${n(4)})F(${n(bio.unit * 0.22)})` + apexCrown(P, id);
  return ax;
}

function trunkMoyogi(id, P, bio, r, bag, design) {
  const seg = Math.max(bio.unit * (bio.conifer ? 0.78 : 0.95), id === 'azaleia' ? 0.11 : 0.2);
  const sign = r.chance(0.5) ? 1 : -1;
  const bends = [sign * (26 + r.f() * 5), -sign * (17 + r.f() * 4), sign * (8 + r.f() * 3)];
  // primeiro, costas (profundidade), lado oposto, mais curto perto do ápice. Fora da curva.
  const plan = [
    { u: 0, yaw: sign > 0 ? 98 : 262, low: true },
    { u: 0.34, yaw: 6, low: true },
    { u: 0.62, yaw: sign > 0 ? 252 : 108, low: false },
    { u: 0.84, yaw: sign > 0 ? 72 : 288, low: false },
  ];
  let ax = `^(${n(2.2)})`;
  let heading = 0;
  let pi = 0;
  const steps = 6;
  for (let s = 0; s < steps; s++) {
    const b = Math.min(bends.length - 1, Math.floor(s / 2));
    const target = bends[b];
    const aim = heading + (target - heading) * (s % 2 === 0 ? 0.48 : 1);
    const turn = aim - heading;
    heading = aim;
    ax += `+(${n(turn)})^(${n(0.5)})F(${n(seg * (1 - 0.07 * s))})`;
    const t = (s + 1) / steps;
    if (s < 1 || pi >= plan.length || t < 0.2 + plan[pi].u * 0.62) continue;
    const p = plan[pi++];
    const outside = heading >= 0 ? 96 : 264;
    const yaw = yawOffFront((p.u === 0 ? outside : p.yaw) + r.jit(5), p.low);
    const bl = reachFor(design, bio, p.u) * (p.u === 0 ? 1.05 : 0.9);
    ax += placeBranch(id, P, yaw, bl, 0.92 - p.u * 0.4, design, p.low, bag);
    if (id === 'junipero' && bag.jin > 0 && pi === 2) {
      bag.jin--;
      ax += emitJin(yaw + 38);
    }
  }
  ax += `^(${n(4)})+(${n(-heading * 0.35)})` + apexCrown(P, id);
  return ax;
}

function trunkShakan(id, P, bio, r, bag, design) {
  const dir = r.chance(0.5) ? 1 : -1;
  const slant = 34 + r.f() * 8;
  const segs = Math.max(5, Math.min(8, bio.segs > 11 ? 7 : Math.max(bio.segs, 5)));
  let ax = `+(${n(dir * slant * 0.7)})^(${n(3.2)})`;
  const bare = Math.max(1, Math.floor(segs * (design?.firstBranch || 0.26)));
  let placed = 0;
  for (let k = 0; k < segs; k++) {
    const straighten = k > segs * 0.7 ? -dir * slant * 0.12 : dir * r.range(-0.4, 0.8);
    ax += `+(${n(straighten)})^(${n(0.4)})F(${n(bio.unit * (1 - 0.28 * k / segs))})`;
    if (k < bare) continue;
    const u = (k - bare) / Math.max(1, segs - bare);
    const opposite = dir > 0 ? 92 : 268;
    const same = dir > 0 ? 268 : 92;
    const back = placed % 3 === 2;
    const yaw = yawOffFront(back ? 8 : (placed % 2 === 0 ? opposite : same) + r.jit(7), u < 0.4);
    const counter = !back && Math.abs(((((yaw % 360) + 360) % 360) - opposite)) < 28;
    const bl = reachFor(design, bio, u) * (counter && placed === 0 ? 1.25 : back ? 0.62 : 0.82);
    ax += placeBranch(id, P, yaw, bl, (counter ? 1 : 0.8) - u * 0.35, design, u < 0.4, bag);
    placed++;
  }
  ax += `^(${n(5)})` + apexCrown(P, id);
  return ax;
}

function trunkCascade(id, P, bio, r, bag, full, design) {
  // Sobe pouco, dobra na borda e desce. Cada passo leva uma almofada do lado de fora, menor na ponta.
  const s = Math.max(bio.unit / 0.55, (bag.base || 0.16) / 0.22);
  const u = 0.48 * s;
  const side = r.chance(0.5) ? 1 : -1;
  const az = (side > 0 ? 68 : 248) + r.f() * 18;
  let ax = `^(${n(2)})/(${n(az)})`;
  ax += `F(${n(u * (full ? 0.5 : 0.72))})`;
  ax += `[^(14)F(${n(u * 0.12)})${cloudPad(P, 0.38, id)}]`;
  ax += `&(${n(full ? 82 : 70)})F(${n(u * (full ? 0.42 : 0.5))})`;
  const steps = full ? 5 : 3;
  for (let j = 0; j < steps; j++) {
    const sign = (j % 2 ? -1 : 1) * side;
    const sc = Math.max(0.3, 0.95 - j * (full ? 0.12 : 0.18));
    const step = u * (full ? 0.62 : 0.42) * (1 - j * 0.03);
    const pitch = full ? 12 + r.f() * 3 : 8 + r.f() * 2;
    ax += `+(${n(sign * (12 + r.jit(2)))})&(${n(pitch)})F(${n(step)})`;
    ax += `[+(${n(sign * 60)})_(0.94)&(${n(j < 2 ? 16 : 8)})F(${n(0.1 + u * 0.16 * sc)})^(8)${cloudPad(P, sc, id)}]`;
    if (id === 'junipero' && bag.jin > 0 && j === 2) {
      bag.jin--;
      ax += emitJin(az + sign * 30);
    }
  }
  ax += `[+(${n(side * 48)})_(0.95)F(${n(u * 0.12)})${cloudPad(P, full ? 0.3 : 0.24, id)}]`;
  const phi = az * DEG;
  const reach = u * (full ? 2.05 : 1.35);
  const drop = u * (full ? 4.2 : 1.05);
  P.attractor = [Math.sin(phi) * reach, full ? -drop : -u * 0.3, -Math.cos(phi) * reach];
  return ax;
}

function trunkBroom(id, P, bio, r, bag) {
  const seg = bio.unit * (id === 'ficus' ? 0.7 : 0.86);
  const segs = 3;
  let ax = `^(${n(1.4)})`;
  for (let k = 0; k < segs; k++) ax += `&(${n(r.jit(0.3))})F(${n(seg * (1 - 0.04 * k))})`;
  const trunkH = seg * segs;
  const spokeLen = Math.max(bio.branchLen * (id === 'ficus' ? 2.1 : 0.95), trunkH * 0.95);
  const lift = (P.lift || 0.12) * 0.85;
  const spoke = (len) => {
    let o = `~(0)F(${n(Math.min(seg * 0.28, 0.07))})~(${n(-lift)})`;
    o += `[+(${n(24 + r.jit(4))})B(${n(len * 0.58)})]`;
    o += `[-(${n(24 + r.jit(4))})B(${n(len * 0.52)})]`;
    o += `^(${n(6)})B(${n(len * 0.44)})`;
    return o;
  };
  const rings = [[5, 58], [4, 36], [3, 16]];
  let yaw0 = r.f() * 20;
  for (const [count, elev] of rings) {
    for (let i = 0; i < count; i++) {
      ax += `F(${n(Math.max(seg * 0.32, 0.1))})`;
      let yaw = yaw0 + (i + 0.5) * (360 / count) + r.jit(3);
      yaw = yawOffFront(yaw, elev > 50);
      const len = spokeLen * (elev > 50 ? 1 : elev > 30 ? 0.82 : 0.66);
      ax += `[/(${n(yaw)})&(${n(elev + r.jit(1.5))})${spoke(len)}]`;
    }
    yaw0 += 180 / count;
  }
  ax += `F(${n(seg * 0.2)})` + spoke(spokeLen * 0.5);
  if (id === 'ficus' && bag.aerial > 0) {
    ax += `[/(70)&(58)F(0.18)W(0.18,0.08,0.12)B(${n(spokeLen * 0.36)})]`;
    bag.aerial--;
  }
  return ax;
}

function ensureBranchRules(P, rules, finalize, juvenile, level) {
  const outR = { ...rules };
  const outF = { ...finalize };
  const outJ = { ...juvenile };
  if (!outR.B) {
    const split = P.split || 32;
    outR.B = (p, rr) => {
      const s = p[0];
      if (s < 0.32) return `F(${n(Math.max(0.05, s * 0.65))})` + pad(P, 0.85);
      return `F(${n(s * 0.7)})_(${n(level)})[+(${n(split + rr.jit(6))})B(${n(s * 0.55)})][-(${n(split + rr.jit(6))})B(${n(s * 0.55)})]B(${n(s * 0.68)})`;
    };
  }
  if (!outF.B) outF.B = () => pad(P, 0.9);
  if (!outJ.B) outJ.B = () => pad(P, 0.5);
  return { rules: outR, finalize: outF, juvenile: outJ };
}

/**
 * Gramática de um estilo que não é o padrão da espécie.
 * As regras finas (B, flores, folhas) continuam as da espécie; o axioma é o estilo.
 */
export function composeStyled(id, sp, P, styleId, legacy, Rand) {
  const style = STYLES[styleId] || STYLES.moyogi;
  const prev = P._style;
  P._style = sp.defaultStyle || styleId;
  let base;
  try {
    base = legacy.call(sp, P);
  } finally {
    P._style = prev;
  }
  const seed = P._seed || 'seed';
  const Rnd = Rand || globalThis.Rand || RandStub;
  const r = new Rnd(`${seed}::${id}::estilo::${styleId}`);
  const bio = bioOf(id, P);
  const bag = { aerial: id === 'ficus' ? (P.aerials || 0) : 0, jin: id === 'junipero' ? (P.jins || 0) : 0, base: sp.baseWidth || 0.16 };
  const design = designOf(styleId, id, sp.design);
  let body = '';
  if (styleId === 'chokkan') body = trunkChokkan(id, P, bio, r, bag, design);
  else if (styleId === 'shakan') body = trunkShakan(id, P, bio, r, bag, design);
  else if (styleId === 'kengai') body = trunkCascade(id, P, bio, r, bag, true, design);
  else if (styleId === 'han_kengai') body = trunkCascade(id, P, bio, r, bag, false, design);
  else if (styleId === 'hokidachi') body = trunkBroom(id, P, bio, r, bag);
  else body = trunkMoyogi(id, P, bio, r, bag, design);
  const axiom = applyDesignRules(`!(1)${nebariFor(id, P, r)}${body}`, { id, styleId, P, style });
  const branched = ensureBranchRules(P, base.rules || {}, base.finalize || {}, base.juvenile || {}, bio.level);
  return {
    axiom,
    rules: branched.rules,
    finalize: branched.finalize,
    juvenile: branched.juvenile,
    juvenileLife: base.juvenileLife || 1.3,
    display: [
      `estilo ${style.jp} ${style.name} (${style.pt}): ${style.desc}`,
      `tronco: inclinação ${style.trunk.incline}°, curvatura ${style.trunk.curvature}, ${style.trunk.bends} dobras · ápice ${style.crown}`,
      `silhueta ${style.crown} · almofadas ${style.pads} · proporção alvo ${style.ratio}`,
      `biologia de ${id}: as regras finas (B e a folhagem) continuam as da espécie`,
      ...(base.display || []).slice(-1),
    ],
  };
}

function RandStub() {
  const f = () => 0.5;
  return { f, range: (a, b) => (a + b) / 2, int: (a, b) => (a + b) >> 1, jit: () => 0, chance: () => false, pick: (a) => a[0] };
}

function measureSk(sk) {
  const { N, X, Y, Z } = sk;
  let H = 0.2, minY = 0, neb = 0, arch = 0;
  for (let i = 0; i < N; i++) {
    if (Y[i] > H) H = Y[i];
    if (Y[i] < minY) minY = Y[i];
  }
  const radii = [];
  const crownY = Math.max(0.18, H * 0.22);
  const { PAR } = sk;
  const soilCut = Math.min(0.28, Math.max(0.03, H * 0.16));
  const onSoil = new Uint8Array(N);
  if (N) onSoil[0] = 1;
  for (let i = 1; i < N; i++) {
    const p = PAR[i];
    onSoil[i] = p >= 0 && onSoil[p] && Y[p] < soilCut && Y[i] < soilCut ? 1 : 0;
  }
  for (let i = 0; i < N; i++) {
    const d = Math.hypot(X[i], Z[i]);
    if (onSoil[i]) neb = Math.max(neb, d);
    if (Y[i] > crownY) radii.push(d);
    if (Y[i] < -0.06) arch = Math.max(arch, d);
  }
  radii.sort((a, b) => a - b);
  const p85 = radii.length ? radii[Math.min(radii.length - 1, Math.floor(radii.length * 0.85))] : 0;
  return { H: Math.max(H, 0.2), minY, spread: p85 * 2, nebari: Math.max(neb, 0.05), arch };
}

function shapeOf(styleId, family, rng) {
  if (styleId === 'kengai') {
    if (family === 'conifer') return rng.chance(0.55) ? 'hex' : 'square';
    return rng.pick(['round', 'hex', 'square']);
  }
  if (styleId === 'han_kengai') {
    if (family === 'conifer') return rng.pick(['hex', 'square', 'round']);
    return rng.chance(0.6) ? 'round' : 'hex';
  }
  if (styleId === 'hokidachi') return 'oval';
  if (styleId === 'chokkan') return rng.chance(0.7) ? 'rect' : 'oval-straight';
  return rng.chance(0.72) ? 'oval' : 'round';
}

function glazeColor(id, P, rng) {
  if (id === 'bordo') {
    return rng.pick([
      { h: 198, s: 0.38, l: 0.58 },
      { h: 168, s: 0.26, l: 0.64 },
      { h: 36, s: 0.22, l: 0.84 },
    ]);
  }
  if (id === 'olmo_chines') {
    return (P.glaze ?? rng.f()) < 0.62 ? { h: 36, s: 0.18, l: 0.84 } : { h: 206, s: 0.06, l: 0.74 };
  }
  if (id === 'ficus') return { h: P.potH ?? 186, s: P.potS ?? 0.55, l: P.potL ?? 0.42 };
  if (id === 'azaleia') {
    if (P.palette === 'branco') return { h: 150, s: 0.16, l: 0.78 };
    const fh = P.petalH || 340;
    return { h: (fh + 156) % 360, s: 0.26, l: 0.66 };
  }
  return { h: 32, s: 0.16, l: 0.74 };
}

function clayColor(rng) {
  if (rng.chance(0.42)) return { h: 28, s: 0.05, l: rng.range(0.3, 0.4) };
  return { h: rng.range(16, 26), s: rng.range(0.24, 0.42), l: rng.range(0.22, 0.32) };
}

/**
 * Vaso pela convenção: material pela família, forma pelo estilo,
 * comprimento ≈ 2/3 da altura (ou da envergadura, se for maior),
 * profundidade ≈ diâmetro da base do tronco. Cascata é funda; vassoura é rasa.
 */
export function potSpec({ id, styleId, sk, P, baseWidth, seed, family, Rand }) {
  const R = Rand || globalThis.Rand;
  const colorRng = new R(`${seed}::${id}::pot-color`);
  const shapeRng = new R(`${seed}::${id}::pot-shape::${styleId}`);
  const fam = family || (id === 'azaleia' ? 'flowering'
    : (id === 'pinheiro_branco' || id === 'pinheiro_negro' || id === 'junipero' || id === 'cipreste') ? 'conifer'
      : 'deciduous');
  const shape = shapeOf(styleId, fam, shapeRng);
  const m = measureSk(sk);
  const diam = Math.max((baseWidth || 0.12) * 2, 0.08);
  const cascade = styleId === 'kengai' || styleId === 'han_kengai';
  // Comprimento ≈ 2/3 da altura, ou da copa se ela for mais larga. A queda da cascata não entra nessa conta.
  const ref = Math.max(m.H, m.spread, diam * 3);
  const length = (2 / 3) * ref;
  let a = cascade
    ? Math.max(m.nebari * 1.9, diam * 2.35)
    : Math.max(length / 2, m.nebari * 1.22, diam * 1.45);
  if (cascade && m.arch > m.nebari * 1.3) {
    // O arco tem de passar a borda. O vaso fica mais estreito que a queda.
    a = Math.min(a, Math.max(m.arch * 0.62, m.nebari * 1.35, diam * 1.7));
  }
  let b = a;
  let nn = 2;
  let sides = 0;
  let taper = 0.05;
  let foot = 0.07;
  let bulge = 0.02;
  let lip = 0.05;
  if (shape === 'rect') {
    b = a * 0.68; nn = 7; taper = 0.02; foot = 0.08; bulge = 0; lip = 0.045;
  } else if (shape === 'oval-straight') {
    b = a * 0.72; nn = 3.4; taper = 0.015; foot = 0.07; bulge = 0.01; lip = 0.05;
  } else if (shape === 'oval') {
    b = a * 0.7; nn = 2.2; taper = 0.06; foot = 0.06; bulge = 0.02; lip = 0.055;
  } else if (shape === 'round') {
    b = a * 0.98; nn = 2; taper = 0.04; foot = 0.08; bulge = 0.03; lip = 0.05;
  } else if (shape === 'square') {
    b = a; nn = 7; sides = 4; taper = 0.04; foot = 0.06; bulge = 0; lip = 0.05;
  } else if (shape === 'hex') {
    b = a * 0.97; nn = 2; sides = 6; taper = 0.045; foot = 0.05; bulge = 0; lip = 0.06;
  }
  let h;
  let tall = false;
  let leg = 0;
  if (styleId === 'kengai') {
    const drop = Math.max(0, -m.minY);
    h = Math.max(diam * 1.4, Math.min(a * 1.05, Math.max(drop * 0.58, a * 0.72)));
    tall = true;
    leg = Math.max(a * 0.85, -m.minY - h + 1.15);
  } else if (styleId === 'han_kengai') {
    h = Math.max(diam * 1.15, a * 0.58);
    if (m.minY < -0.04) {
      tall = true;
      leg = Math.max(h * 0.35, Math.min(a * 0.7, -m.minY - h * 0.2 + 0.35));
    }
  } else if (styleId === 'hokidachi') {
    h = Math.min(Math.max(diam * 0.9, a * 0.14), a * 0.26);
  } else {
    h = Math.min(Math.max(diam * 1.05, a * 0.16), a * 0.42);
  }
  const centered = shape === 'round' || shape === 'square' || shape === 'hex';
  let ox = 0;
  let oz = 0;
  if (!centered) {
    const sign = shapeRng.chance(0.5) ? 1 : -1;
    ox = sign * a * shapeRng.range(0.07, 0.12);
    oz = b * shapeRng.range(-0.035, 0.04);
  }
  const glazed = fam !== 'conifer';
  const color = glazed ? glazeColor(id, P, colorRng) : clayColor(colorRng);
  const lowTable = id === 'junipero' && styleId !== 'kengai' && styleId !== 'han_kengai';
  const stand = tall || lowTable ? { h: 24, s: 0.38, l: tall ? 0.22 : 0.1 } : null;
  return {
    shape, a, b, h, n: nn, sides, lip, taper, foot, bulge,
    color, rough: glazed ? 0.16 : 0.9, metal: glazed ? 0.04 : 0,
    glaze: glazed, moss: colorRng.range(0.48, 0.78), mound: Math.min(a * 0.06, 0.08),
    ox, oz, rot: shape === 'hex' ? Math.PI / 6 : 0,
    stand, tall, leg, centered,
    family: fam,
  };
}

function rotY(x, z, c, s) {
  return [x * c - z * s, x * s + z * c];
}

function childrenOf(sk) {
  const ch = Array.from({ length: sk.N }, () => []);
  for (let i = 1; i < sk.N; i++) {
    const p = sk.PAR[i];
    if (p >= 0 && p < sk.N) ch[p].push(i);
  }
  return ch;
}

function trunkChain(sk, ch, drops) {
  const memo = new Float64Array(sk.N);
  const walk = (i) => {
    let v = sk.Y[i];
    for (const c of ch[i]) {
      const e = walk(c);
      v = drops ? Math.min(v, e) : Math.max(v, e);
    }
    memo[i] = v;
    return v;
  };
  walk(0);
  const trunk = [0];
  const set = new Set([0]);
  let i = 0;
  let guard = 0;
  while (ch[i].length && guard++ < sk.N) {
    let best = -1;
    let bv = drops ? Infinity : -Infinity;
    for (const c of ch[i]) {
      const better = drops ? memo[c] < bv - 1e-4 : memo[c] > bv + 1e-4;
      if (best < 0 || better) { best = c; bv = memo[c]; }
    }
    if (best < 0) break;
    const dy = sk.Y[best] - sk.Y[i];
    const horiz = Math.hypot(sk.X[best] - sk.X[i], sk.Z[best] - sk.Z[i]);
    if (!drops && ch[i].length >= 3 && horiz > Math.abs(dy) * 1.35 && trunk.length > 2) break;
    trunk.push(best);
    set.add(best);
    i = best;
  }
  return { trunk, set };
}

function rotateAll(sk, inst, ang) {
  if (Math.abs(ang) < 1e-4) return;
  const c = Math.cos(ang), s = Math.sin(ang);
  const { N, X, Z } = sk;
  for (let i = 0; i < N; i++) {
    const p = rotY(X[i], Z[i], c, s);
    X[i] = p[0]; Z[i] = p[1];
  }
  for (const k in inst) for (const it of inst[k]) {
    if (it.p) {
      const p = rotY(it.p.x, it.p.z, c, s);
      it.p.x = p[0]; it.p.z = p[1];
    }
    for (const v of [it.y, it.z]) if (v && v.x != null) {
      const p = rotY(v.x, v.z, c, s);
      v.x = p[0]; v.z = p[1];
    }
  }
}

function rotateSubtree(sk, inst, root, originX, originZ, ang, ch) {
  if (Math.abs(ang) < 1e-3) return;
  const c = Math.cos(ang), s = Math.sin(ang);
  const seen = new Uint8Array(sk.N);
  const nodes = [];
  const stack = [root];
  while (stack.length) {
    const i = stack.pop();
    if (i < 0 || i >= sk.N || seen[i]) continue;
    seen[i] = 1;
    nodes.push(i);
    for (const k of ch[i]) stack.push(k);
  }
  const set = new Set(nodes);
  for (const i of nodes) {
    const p = rotY(sk.X[i] - originX, sk.Z[i] - originZ, c, s);
    sk.X[i] = originX + p[0];
    sk.Z[i] = originZ + p[1];
  }
  for (const k in inst) for (const it of inst[k]) {
    if (!set.has(it.node | 0)) continue;
    if (it.p) {
      const p = rotY(it.p.x - originX, it.p.z - originZ, c, s);
      it.p.x = originX + p[0];
      it.p.z = originZ + p[1];
    }
    for (const v of [it.y, it.z]) if (v && v.x != null) {
      const p = rotY(v.x, v.z, c, s);
      v.x = p[0]; v.z = p[1];
    }
  }
}

function bendFront(sk, inst, trunkInfo, frontLean, apexLean) {
  const { trunk, set } = trunkInfo;
  let H = 0.2;
  for (const i of trunk) if (sk.Y[i] > H) H = sk.Y[i];
  const base = trunk[0];
  const apex = trunk[trunk.length - 1];
  const have = sk.Z[apex] - sk.Z[base];
  const want = Math.tan((frontLean || 4) * DEG) * H;
  const extra = Math.tan((apexLean || 3) * DEG) * H;
  const add = Math.max(0, want - Math.max(0, have));
  const dzAt = (y) => {
    const t = Math.min(1, Math.max(0, (y - 0.8 * H) / (0.2 * H)));
    const s = t * t * (3 - 2 * t);
    return add * Math.max(y, 0) / H + extra * s;
  };
  const dz = new Float64Array(sk.N);
  for (const i of trunk) dz[i] = dzAt(sk.Y[i]);
  for (let i = 1; i < sk.N; i++) {
    if (set.has(i)) continue;
    let j = sk.PAR[i];
    let guard = 0;
    while (j > 0 && !set.has(j) && guard++ < 80) j = sk.PAR[j];
    dz[i] = dz[set.has(j) ? j : 0] || 0;
  }
  for (let i = 0; i < sk.N; i++) sk.Z[i] += dz[i];
  for (const k in inst) for (const it of inst[k]) {
    if (it.p) it.p.z += dz[it.node | 0] || 0;
  }
}

function redirectLowerBranches(sk, inst, trunkInfo, ch) {
  const { trunk, set } = trunkInfo;
  let H = 0.2;
  for (let i = 0; i < sk.N; i++) if (sk.Y[i] > H) H = sk.Y[i];
  const yCut = H * 0.33;
  for (const i of trunk) {
    if (sk.Y[i] < 0.06 || sk.Y[i] > yCut) continue;
    for (const c of ch[i]) {
      if (set.has(c)) continue;
      if (sk.Y[c] < 0.14 && sk.Y[i] < 0.18) continue;
      const dx = sk.X[c] - sk.X[i];
      const dz = sk.Z[c] - sk.Z[i];
      const horiz = Math.hypot(dx, dz);
      if (horiz < 0.03) continue;
      const ang = Math.atan2(dz, dx);
      let diff = ang - Math.PI / 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > 0.4) continue;
      const dir = diff >= 0 ? 1 : -1;
      const target = Math.PI / 2 + dir * 0.7;
      rotateSubtree(sk, inst, c, sk.X[i], sk.Z[i], target - ang, ch);
    }
  }
}

function faceNebari(sk, inst, ch) {
  const roots = [];
  for (const c of ch[0] || []) {
    let maxY = sk.Y[c];
    const stack = [c];
    const seen = new Uint8Array(sk.N);
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      if (sk.Y[i] > maxY) maxY = sk.Y[i];
      for (const k of ch[i]) stack.push(k);
    }
    if (maxY < 0.42 && sk.Y[c] < 0.28) roots.push(c);
  }
  if (roots.length < 2) return;
  let front = 0;
  let best = roots[0];
  let bd = 0;
  for (const c of roots) {
    const ang = Math.atan2(sk.Z[c], sk.X[c]);
    let d = ang - Math.PI / 2;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 1.15) front++;
    const dist = Math.hypot(sk.X[c], sk.Z[c]);
    if (dist > bd) { bd = dist; best = c; }
  }
  if (front >= 1) return;
  const ang = Math.atan2(sk.Z[best], sk.X[best]);
  const delta = (Math.PI / 2 + 0.42) - ang;
  for (const c of roots) rotateSubtree(sk, inst, c, 0, 0, delta, ch);
}

/**
 * Orienta a planta para a frente: a curva fica na silhueta, o tronco e o ápice
 * vêm um pouco na direção da câmera, o nebari aparece e nenhum galho grosso
 * do terço de baixo aponta direto para o observador.
 */
export function applyFront(sk, inst, style) {
  if (!sk || sk.N < 3) return;
  const drops = !!(style && style.keepsLowTrunk);
  const ch = childrenOf(sk);
  const info = trunkChain(sk, ch, drops);
  if (drops) {
    let best = 0;
    let bestScore = -1e18;
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      let score = 0;
      let n = 0;
      for (let k = 1; k < sk.N; k++) {
        if (sk.Y[k] > 0.05) continue;
        const x = sk.X[k] * c - sk.Z[k] * s;
        const z = sk.X[k] * s + sk.Z[k] * c;
        score += z * 1.15 + Math.abs(x) * 0.35 - Math.max(0, 0.35 - Math.abs(x)) * 0.5;
        n++;
      }
      if (n && score > bestScore) { bestScore = score; best = th; }
    }
    rotateAll(sk, inst, best);
  } else {
    let best = 0;
    let bestScore = -1e18;
    let bestVar = 0;
    const pts = info.trunk.length > 2 ? info.trunk : null;
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const c = Math.cos(th), s = Math.sin(th);
      let mx = 0, mz = 0, x2 = 0, n = 0;
      const list = pts || info.trunk;
      for (const idx of list) {
        const x = sk.X[idx] * c - sk.Z[idx] * s;
        const z = sk.X[idx] * s + sk.Z[idx] * c;
        mx += x; mz += z; x2 += x * x; n++;
      }
      if (!n) continue;
      const meanX = mx / n;
      const varX = x2 / n - meanX * meanX;
      const score = varX + (mz / n) * 0.08;
      if (score > bestScore) { bestScore = score; best = th; bestVar = varX; }
    }
    if (bestVar > 1e-4) rotateAll(sk, inst, best);
  }
  const lean = style?.trunk?.frontLean ?? 4.5;
  bendFront(sk, inst, trunkChain(sk, childrenOf(sk), drops), lean, Math.min(4.5, lean * 0.7));
  const ch2 = childrenOf(sk);
  const info2 = trunkChain(sk, ch2, drops);
  redirectLowerBranches(sk, inst, info2, ch2);
  faceNebari(sk, inst, ch2);
}

/**
 * A folhagem que cairia em cima do tampo sai para o lado.
 * O tronco não é empurrado: atravessaria a parede do vaso. O tamanho do vaso é que o deixa passar por fora.
 */
export function keepTrunkOutOfPot(sk, inst, pot) {
  if (!pot || !sk?.below || !inst) return;
  const ox = pot.ox || 0;
  const oz = pot.oz || 0;
  const topA = pot.a * (pot.tall ? 1.08 : 1.02);
  const topB = pot.b * (pot.tall ? 1.08 : 1.02);
  const tableY = -pot.h;
  const yHi = pot.tall ? 0.16 : 0.05;
  const yLo = pot.tall ? 0.26 : 0.22;
  const margin = pot.tall ? Math.min(0.3, Math.max(pot.a, pot.b) * 0.2) : 0;
  for (const key in inst) for (const it of inst[key]) {
    if (!it.p || it.p.y > tableY + yHi || it.p.y < tableY - yLo) continue;
    const px = it.p.x - ox;
    const pz = it.p.z - oz;
    const e = (px / topA) ** 2 + (pz / topB) ** 2;
    if (e >= 1 || e < 1e-5) continue;
    const dist = Math.hypot(px, pz);
    const edge = dist / Math.sqrt(e);
    const s = (edge + margin) / dist;
    it.p.x = ox + px * s;
    it.p.z = oz + pz * s;
  }
}

function treeExtent(sk) {
  let H = 0.2, minY = 0;
  for (let i = 0; i < sk.N; i++) {
    if (sk.Y[i] > H) H = sk.Y[i];
    if (sk.Y[i] < minY) minY = sk.Y[i];
  }
  return { H, minY };
}

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function primariesOf(sk, info, ch) {
  const out = [];
  for (const ti of info.trunk) {
    for (const c of ch[ti]) {
      if (info.set.has(c)) continue;
      if (sk.Y[ti] < 0.05 && sk.Y[c] < 0.16) continue;
      let maxY = sk.Y[c], count = 0;
      const stack = [c];
      const seen = new Uint8Array(sk.N);
      while (stack.length) {
        const q = stack.pop();
        if (seen[q]) continue;
        seen[q] = 1;
        count++;
        if (sk.Y[q] > maxY) maxY = sk.Y[q];
        for (const k of ch[q]) stack.push(k);
      }
      if (count < 3 || (maxY < 0.08 && sk.Y[ti] < 0.12)) continue;
      out.push({
        c, ti, y: sk.Y[ti], n: count, maxY,
        yaw: Math.atan2(sk.Z[c] - sk.Z[ti], sk.X[c] - sk.X[ti]),
      });
    }
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

/** Afasta galhos em barra, galhos da frente no terço de baixo, galhos por dentro da curva e raízes apontadas para a câmera. */
export function shapeDesign(sk, inst, design) {
  if (!sk || sk.N < 4 || !design) return;
  const ch = childrenOf(sk);
  const info = trunkChain(sk, ch, !!design.cascade);
  const { H } = treeExtent(sk);
  if (!design.broom && !design.cascade) {
    const prim = primariesOf(sk, info, ch);
    const gap = Math.max(0.03, H * (design.barGap || 0.045));
    for (let a = 0; a < prim.length; a++) {
      for (let b = a + 1; b < prim.length; b++) {
        if (Math.abs(prim[a].y - prim[b].y) > gap) continue;
        if (Math.abs(angDiff(prim[a].yaw, prim[b].yaw)) < 2.35) continue;
        const dir = angDiff(prim[b].yaw, prim[a].yaw) >= 0 ? 1 : -1;
        rotateSubtree(sk, inst, prim[b].c, sk.X[prim[b].ti], sk.Z[prim[b].ti], dir * 1.05, ch);
        prim[b].yaw += dir * 1.05;
      }
    }
    const yCut = H * (design.frontBan || 0.34);
    for (const p of prim) {
      if (p.y > yCut || p.y < H * 0.08) continue;
      const d = angDiff(p.yaw, Math.PI / 2);
      if (Math.abs(d) > 0.4) continue;
      const dir = d >= 0 ? 1 : -1;
      const delta = dir * 0.7 - d;
      rotateSubtree(sk, inst, p.c, sk.X[p.ti], sk.Z[p.ti], delta, ch);
      p.yaw += delta;
    }
    const trunk = info.trunk;
    for (let k = 1; k < trunk.length - 1; k++) {
      const prev = trunk[k - 1], here = trunk[k], next = trunk[k + 1];
      const vx1 = sk.X[here] - sk.X[prev], vz1 = sk.Z[here] - sk.Z[prev];
      const vx2 = sk.X[next] - sk.X[here], vz2 = sk.Z[next] - sk.Z[here];
      const cross = vx1 * vz2 - vz1 * vx2;
      if (Math.abs(cross) < 1e-4) continue;
      const inx = -vz1 * Math.sign(cross), inz = vx1 * Math.sign(cross);
      const inL = Math.hypot(inx, inz) || 1;
      for (const c of ch[here]) {
        if (info.set.has(c)) continue;
        const dx = sk.X[c] - sk.X[here], dz = sk.Z[c] - sk.Z[here];
        const h = Math.hypot(dx, dz);
        if (h < 0.04) continue;
        if ((dx * inx + dz * inz) / (h * inL) < 0.55) continue;
        rotateSubtree(sk, inst, c, sk.X[here], sk.Z[here], -Math.sign(cross) * 1.15, ch);
      }
    }
  }
  for (const c of ch[0] || []) {
    let maxY = sk.Y[c];
    const stack = [c];
    const seen = new Uint8Array(sk.N);
    while (stack.length) {
      const i = stack.pop();
      if (seen[i]) continue;
      seen[i] = 1;
      if (sk.Y[i] > maxY) maxY = sk.Y[i];
      for (const k of ch[i]) stack.push(k);
    }
    if (maxY > 0.38) continue;
    const yaw = Math.atan2(sk.Z[c], sk.X[c]);
    const d = angDiff(yaw, Math.PI / 2);
    if (Math.abs(d) > 0.34) continue;
    const dir = d >= 0 ? 1 : -1;
    rotateSubtree(sk, inst, c, 0, 0, dir * 0.5 - d, ch);
  }
}

function chainLength(sk, trunk) {
  let L = 0;
  for (let k = 1; k < trunk.length; k++) {
    const a = trunk[k - 1], b = trunk[k];
    L += Math.hypot(sk.X[b] - sk.X[a], sk.Y[b] - sk.Y[a], sk.Z[b] - sk.Z[a]);
  }
  return L;
}

function blendBroom(sk, rFull, rTube, design, ch, info) {
  let best = info.trunk[0], bn = 0;
  for (const ti of info.trunk) {
    let nSide = 0;
    for (const c of ch[ti]) if (!info.set.has(c) && sk.Y[c] > 0.05) nSide++;
    if (nSide > bn) { bn = nSide; best = ti; }
  }
  if (bn < 3) return;
  const rT = rFull[best] || 0.05;
  const share = Math.min(design.branchThin || 0.66, Math.pow(1 / bn, 0.45));
  const r0 = rT * Math.max(0.4, share);
  for (const ti of info.trunk) {
    if (Math.abs(sk.Y[ti] - sk.Y[best]) > Math.max(0.22, rT * 2.4)) continue;
    for (const c of ch[ti]) {
      if (info.set.has(c)) continue;
      const chain = [c];
      let i = c, guard = 0;
      while (ch[i] && ch[i].length && guard++ < 6) {
        i = ch[i][0];
        chain.push(i);
      }
      const tip = rFull[chain[chain.length - 1]] || r0 * 0.35;
      for (let k = 0; k < chain.length; k++) {
        const t = chain.length === 1 ? 0 : k / (chain.length - 1);
        const parent = sk.PAR[chain[k]];
        const cap = (rFull[parent] || rT) * (design.branchThin || 0.66);
        const target = Math.min(cap, r0 * (1 - t) + Math.min(tip, r0 * 0.85) * t);
        if (target > rFull[chain[k]]) {
          rFull[chain[k]] = target;
          rTube[chain[k]] = Math.max(rTube[chain[k]], target);
        }
      }
    }
  }
}

/** Afunila o tronco sem taper invertido, abre o nebari e deixa o galho mais fino que o tronco. */
export function enforceDesignRadii(sk, rFull, rTube, design) {
  if (!sk || sk.N < 3 || !rFull || !rTube || !design) return;
  const ch = childrenOf(sk);
  const info = trunkChain(sk, ch, !!design.cascade);
  const trunk = info.trunk;
  if (trunk.length < 2) return;
  const { H } = treeExtent(sk);
  const height = design.cascade ? Math.max(chainLength(sk, trunk), H) : Math.max(H, 0.2);
  let rBase = 0;
  for (const i of trunk) {
    if (sk.Y[i] >= -0.02 && sk.Y[i] <= Math.max(0.06, H * 0.1)) rBase = Math.max(rBase, rFull[i]);
  }
  if (rBase < 1e-4) rBase = rFull[trunk[1]] || rFull[trunk[0]] || 0.04;
  const visual = rBase * (design.visualBump || 1);
  let k = (height / (2 * design.taperRatio)) / Math.max(visual, 1e-4);
  k = Math.min(2.8, Math.max(0.08, k));
  if (Math.abs(k - 1) > 0.035) {
    for (let i = 0; i < sk.N; i++) { rFull[i] *= k; rTube[i] *= k; }
  }
  const flareEnd = Math.min(trunk.length - 1, Math.max(1, Math.round(trunk.length * 0.08)));
  let prev = rFull[trunk[flareEnd]] || rFull[trunk[0]];
  for (let t = flareEnd; t < trunk.length; t++) {
    const i = trunk[t];
    if (rFull[i] > prev) {
      rFull[i] = prev;
      if (rTube[i] > prev) rTube[i] = prev;
    } else prev = rFull[i];
  }
  let above = trunk[flareEnd];
  for (const i of trunk) if (sk.Y[i] > H * 0.12) { above = i; break; }
  let baseNode = trunk[0];
  for (const i of trunk) if (sk.Y[i] >= 0 && sk.Y[i] < Math.max(0.05, H * 0.07)) { baseNode = i; break; }
  const want = rFull[above] * (design.flare || 1.4);
  if (rFull[baseNode] < want) {
    rFull[baseNode] = want;
    rTube[baseNode] = Math.max(rTube[baseNode], want);
  }
  const thin = design.branchThin || 0.56;
  const maxY = new Float32Array(sk.N);
  for (let i = 0; i < sk.N; i++) maxY[i] = sk.Y[i];
  for (let i = sk.N - 1; i >= 1; i--) {
    const p = sk.PAR[i];
    if (p >= 0 && maxY[i] > maxY[p]) maxY[p] = maxY[i];
  }
  const scaleSub = (i, s) => {
    const stack = [i];
    while (stack.length) {
      const q = stack.pop();
      rFull[q] *= s;
      rTube[q] *= s;
      for (const c of ch[q]) stack.push(c);
    }
  };
  for (const ti of trunk) {
    for (const c of ch[ti]) {
      if (info.set.has(c) || maxY[c] < 0.22) continue;
      const cap = rFull[ti] * thin;
      if (rFull[c] > cap && rFull[c] > 1e-6) scaleSub(c, cap / rFull[c]);
      let node = c;
      for (let step = 0; step < 4 && node >= 0; step++) {
        const parent = sk.PAR[node];
        const floor = (rFull[parent] || rFull[ti]) * Math.max(0.16, 0.4 - step * 0.07);
        if (rFull[node] < floor) {
          rFull[node] = floor;
          if (rTube[node] < floor) rTube[node] = floor;
        }
        const kids = ch[node];
        if (!kids || !kids.length) break;
        node = kids[0];
      }
    }
  }
  if (design.broom) blendBroom(sk, rFull, rTube, design, ch, info);
}

function clusterPads(pts, H) {
  if (!pts || pts.length < 8) return { padCount: 0, negativeSpace: 0 };
  const cell = Math.max(0.045, H / 26);
  const occ = new Set();
  for (const p of pts) occ.add(`${Math.floor(p.x / cell)},${Math.floor(p.y / cell)},${Math.floor(p.z / cell)}`);
  const seen = new Set();
  let pads = 0;
  const neigh = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (const key of occ) {
    if (seen.has(key)) continue;
    pads++;
    const stack = [key];
    seen.add(key);
    let guard = 0;
    while (stack.length && guard++ < 12000) {
      const cur = stack.pop();
      const [x, y, z] = cur.split(',').map(Number);
      for (const d of neigh) {
        const nk = `${x + d[0]},${y + d[1]},${z + d[2]}`;
        if (occ.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
      }
    }
  }
  const cols = new Map();
  for (const key of occ) {
    const [x, y, z] = key.split(',').map(Number);
    const ck = `${x},${z}`;
    let c = cols.get(ck);
    if (!c) cols.set(ck, c = { min: y, max: y, n: 0 });
    if (y < c.min) c.min = y;
    if (y > c.max) c.max = y;
    c.n++;
  }
  let span = 0, filled = 0;
  for (const c of cols.values()) { span += c.max - c.min + 1; filled += c.n; }
  return { padCount: pads, negativeSpace: span ? Math.max(0, 1 - filled / span) : 0 };
}

/** Medidas por regra, para o estágio 3 pontuar e para o modo ?debug=rules. */
export function measureDesign(sk, radii, inst, design) {
  const empty = {
    taperRatio: 0, reverseTaper: 0, firstBranchRatio: 0, crossings: 0, barBranches: 0,
    crownRatio: 0, padCount: 0, negativeSpace: 0,
  };
  if (!sk || sk.N < 3 || !radii) return empty;
  const ch = childrenOf(sk);
  const drops = !!(design && design.cascade);
  const info = trunkChain(sk, ch, drops);
  const { H } = treeExtent(sk);
  let rBase = 0;
  for (const i of info.trunk) {
    if (sk.Y[i] >= 0 && sk.Y[i] <= Math.max(0.06, H * 0.1) && radii[i] > rBase) rBase = radii[i];
  }
  if (!(rBase > 0)) rBase = radii[info.trunk[1]] || radii[1] || 0.02;
  const height = drops ? Math.max(chainLength(sk, info.trunk), H) : H;
  const taperRatio = height / Math.max(2 * rBase * (design?.visualBump || 1), 1e-4);
  let reverseTaper = 0, prev = -1;
  for (const i of info.trunk) {
    if (sk.Y[i] < 0.05) continue;
    if (prev >= 0 && radii[i] > prev * 1.08) reverseTaper++;
    prev = radii[i];
  }
  const prim = primariesOf(sk, info, ch);
  let firstY = prim.length ? prim[0].y : H;
  for (const p of prim) if (p.n > 8 && p.y < firstY) firstY = p.y;
  const gap = Math.max(0.03, H * 0.04);
  let barBranches = 0;
  if (!design?.broom) {
    for (let a = 0; a < prim.length; a++) for (let b = a + 1; b < prim.length; b++) {
      if (Math.abs(prim[a].y - prim[b].y) > gap) continue;
      if (Math.abs(angDiff(prim[a].yaw, prim[b].yaw)) > 2.5) barBranches++;
    }
  }
  const samples = prim.map((p) => {
    const pts = [];
    let i = p.c, guard = 0, prevI = p.ti;
    while (i >= 0 && guard++ < 10) {
      pts.push([sk.X[i], sk.Y[i], sk.Z[i]]);
      const kids = ch[i];
      if (!kids || !kids.length) break;
      let best = kids[0], bd = -1;
      for (const k of kids) {
        const d = Math.hypot(sk.X[k] - sk.X[prevI], sk.Z[k] - sk.Z[prevI]);
        if (d > bd) { bd = d; best = k; }
      }
      prevI = i;
      i = best;
    }
    return pts;
  });
  let crossings = 0;
  const lim = Math.max(0.045, H * 0.03);
  for (let a = 0; a < samples.length; a++) for (let b = a + 1; b < samples.length; b++) {
    let hit = false;
    for (let i = 1; i < samples[a].length && !hit; i++) for (let j = 1; j < samples[b].length && !hit; j++) {
      const A = samples[a][i], B = samples[b][j];
      if (Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]) < lim) hit = true;
    }
    if (hit) crossings++;
  }
  let fH = 0, fMin = Infinity, fR = 0;
  const pts = [];
  if (inst) for (const k of ['leaf', 'needles', 'petal']) for (const it of inst[k] || []) {
    if (!it.p || (it.p.y < H * 0.12 && !drops)) continue;
    if (it.p.y > fH) fH = it.p.y;
    if (it.p.y < fMin) fMin = it.p.y;
    fR = Math.max(fR, Math.hypot(it.p.x, it.p.z));
    pts.push(it.p);
  }
  const span = drops ? Math.max(0.2, fH - (Number.isFinite(fMin) ? fMin : 0)) : (fH > 0.05 ? fH : H);
  const href = span;
  const pads = clusterPads(pts, Math.max(href, 0.2));
  return {
    taperRatio: +taperRatio.toFixed(3),
    reverseTaper,
    firstBranchRatio: +(H > 0 ? firstY / H : 0).toFixed(3),
    crossings,
    barBranches,
    crownRatio: +(href > 0 ? (fR * 2) / href : 0).toFixed(3),
    padCount: pads.padCount,
    negativeSpace: +pads.negativeSpace.toFixed(3),
  };
}
