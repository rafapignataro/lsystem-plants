/**
 * Estilo (arquitetura) separado da espécie (biologia).
 *
 * A espécie guarda folha, casca, cor, entrenó, tendência de ramificação,
 * dominância apical, floração e vigor. O estilo guarda a linha do tronco,
 * o ápice, a proporção, a silhueta e o desenho das almofadas.
 *
 * Estágio 2 encaixa regras de desenho em DESIGN_RULES (applyDesignRules).
 * Estágio 3 encaixa a nota estética em scoreTree. Os dois hoje são identidade.
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
  },
};

/** Regras de desenho do estágio 2. Cada função recebe o axioma e o contexto e pode devolver outra string. */
export const DESIGN_RULES = [];

export function applyDesignRules(axiom, ctx) {
  let out = axiom;
  for (const rule of DESIGN_RULES) {
    const next = rule(out, ctx);
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

function emitBranch(id, P, yaw, ang, len, level, bag) {
  let extra = '';
  if (id === 'ficus' && bag.aerial > 0) {
    const drops = bag.aerial >= 2 && len > (P.branchLen || 0.5) * 0.7 ? 2 : 1;
    for (let d = 0; d < drops && bag.aerial > 0; d++) {
      extra += `F(${n(0.26 + d * 0.04)})W(${n(0.2)},${n(0.05 + d * 0.12)},${n(d === 0 ? 0.17 : 0.1)})`;
      bag.aerial--;
    }
  }
  const safe = Math.max(0.04, len);
  return `[/(${n(yaw)})&(${n(ang)})_(${n(level)})${extra}B(${n(safe)})]`;
}

function emitJin(yaw) {
  return `[J/(${n(yaw)})&(56)F(0.4)F(0.26)F(0.12)]`;
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

function trunkChokkan(id, P, bio, r, bag) {
  const segs = Math.max(bio.conifer ? 9 : 6, Math.min(14, bio.segs < 6 ? 7 : bio.segs));
  const bare = Math.max(1, Math.floor(segs * 0.33));
  const yaws = [92, 268, 8, 112, 248, 348];
  let ax = `^(${n(2.4)})`;
  for (let k = 0; k < segs; k++) {
    const len = bio.unit * (1 - 0.34 * k / segs);
    ax += `&(${n(r.jit(0.8))})/(${n(r.jit(1.2))})F(${n(len)})`;
    if (k < bare) continue;
    const u = (k - bare) / Math.max(1, segs - bare - 0.2);
    const low = k / segs < 0.34;
    const yaw = yawOffFront(yaws[(k - bare) % yaws.length] + r.jit(8), low);
    const bl = bio.branchLen * (0.22 + 0.78 * Math.pow(Math.max(0, 1 - u), 0.85));
    const ang = bio.bAngle * (0.96 - 0.18 * u);
    ax += emitBranch(id, P, yaw, ang, bl, bio.level, bag);
    if (id === 'junipero' && bag.jin > 0 && (k - bare) % 2 === 0 && k > bare) {
      bag.jin--;
      ax += emitJin(yaw + 46);
    }
  }
  ax += `^(${n(3.5)})F(${n(bio.unit * 0.32)})B(${n(bio.branchLen * 0.2)})`;
  return ax;
}

function trunkMoyogi(id, P, bio, r, bag) {
  const segs = Math.max(5, Math.min(bio.conifer ? 8 : 7, bio.segs > 11 ? 8 : Math.max(bio.segs, 5)));
  const phase = r.f() * 6.28;
  const amp = Math.min(26, Math.max(16, (P.curve || P.bend || 34) * 0.62));
  let ax = `^(${n(3.2)})`;
  const bare = Math.max(1, Math.floor(segs * 0.28));
  let heading = 0;
  for (let k = 0; k < segs; k++) {
    const sCurve = Math.sin(6.2832 * (k / Math.max(segs - 1, 1)) * 1.05 + phase);
    const target = amp * sCurve;
    const turn = target - heading;
    heading = target;
    const depth = 1.1 + 1.4 * Math.cos(6.2832 * k / segs * 0.5 + phase);
    ax += `+(${n(turn)})^(${n(Math.max(0.15, depth * 0.22))})F(${n(bio.unit * (1 - 0.26 * k / segs))})`;
    if (k < bare) continue;
    const u = k / segs;
    const low = u < 0.34;
    const outside = sCurve >= 0 ? 268 : 92;
    const back = (k - bare) % 3 === 2;
    const yaw = yawOffFront((back ? 6 : outside) + r.jit(12), low);
    const bl = bio.branchLen * (1.02 - 0.5 * u) * (back ? 0.7 : 1);
    ax += emitBranch(id, P, yaw, bio.bAngle * (back ? 0.78 : 0.94), bl, bio.level, bag);
    if (id === 'junipero' && bag.jin > 0 && k % 3 === 1) {
      bag.jin--;
      ax += emitJin(yaw + 38);
    }
  }
  ax += `^(${n(6.5)})+(${n(r.jit(5))})B(${n(bio.branchLen * 0.38)})`;
  return ax;
}

function trunkShakan(id, P, bio, r, bag) {
  const dir = r.chance(0.5) ? 1 : -1;
  const slant = 33 + r.f() * 10;
  const segs = Math.max(5, Math.min(8, bio.segs > 11 ? 7 : Math.max(bio.segs, 5)));
  let ax = `+(${n(dir * slant * 0.72)})^(${n(4.5)})`;
  const bare = Math.max(1, Math.floor(segs * 0.2));
  for (let k = 0; k < segs; k++) {
    const straighten = k > segs * 0.65 ? -dir * slant * 0.1 : dir * r.range(-0.6, 1.4);
    ax += `+(${n(straighten)})^(${n(0.55)})F(${n(bio.unit * (1 - 0.2 * k / segs))})`;
    if (k < bare) continue;
    const u = k / segs;
    const opposite = dir > 0 ? 90 : 270;
    const same = dir > 0 ? 270 : 90;
    const back = (k - bare) % 3 === 2;
    const yaw = yawOffFront(back ? 8 : ((k - bare) % 2 === 0 ? opposite : same) + r.jit(10), u < 0.34);
    const lenMul = (!back && yawOffFront(opposite, false) === yaw) || Math.abs((((yaw % 360) + 360) % 360) - opposite) < 24 ? 1.18 : 0.74;
    const bl = bio.branchLen * lenMul * (1.02 - 0.55 * u);
    ax += emitBranch(id, P, yaw, bio.bAngle * (back ? 0.8 : 0.96), bl, bio.level, bag);
  }
  ax += `^(${n(5)})B(${n(bio.branchLen * 0.3)})`;
  return ax;
}

function trunkCascade(id, P, bio, r, bag, full) {
  // Mesma receita do pinheiro-negro: sobe pouco, dobra na borda e só então desce.
  // A escala acompanha o tronco grosso (junípero, pinheiro-branco) sem esticar a queda para o lado.
  const s = Math.max(bio.unit / 0.55, (bag.base || 0.16) / 0.22);
  const u = 0.55 * s;
  const side = r.chance(0.5) ? 1 : -1;
  const az = (side > 0 ? 62 : 242) + r.f() * 28;
  const padLen = Math.min(bio.branchLen * 0.16, u * 0.34, 0.2);
  let ax = `^(${n(2.2)})/(${n(az)})`;
  ax += `F(${n(u * (full ? 0.86 : 1.05))})`;
  ax += `[^(${n(22 + r.jit(4))})F(${n(u * 0.26)})B(${n(padLen)})]`;
  if (full) {
    ax += `&(55)F(${n(u * 0.68)})`;
    ax += `&(50)F(${n(u * 1.15)})`;
  } else {
    // semi: corre na horizontal para fora da borda e a ponta desce até meio vaso
    ax += `&(70)F(${n(u * 0.95)})`;
    ax += `&(28)F(${n(u * 1.35)})`;
    ax += `&(58)F(${n(u * 1.55)})`;
  }
  ax += `[^(7)_(0.94)F(${n(u * 0.2)})B(${n(padLen)})]`;
  const steps = full ? 5 : 0;
  if (full) ax += `~(${n(0.04)})$(${n(0.035)})&(24)F(${n(u * 0.42)})`;
  for (let j = 0; j < steps; j++) {
    const sign = (j % 2 ? -1 : 1) * side;
    const open = j % 2 === 0;
    const pitch = open ? -(14 + r.f() * 4) : (28 + r.f() * 5);
    const step = u * 0.82 * (open ? 0.72 : 1);
    ax += `_(0)+(${n(sign * (14 + r.jit(2)))})&(${n(pitch)})F(${n(step)})`;
    ax += `[+(${n(sign * 46)})_(0.95)F(${n(u * 0.16)})B(${n(padLen)})]`;
    if (id === 'junipero' && bag.jin > 0 && j === 1) {
      bag.jin--;
      ax += emitJin(az + sign * 36);
    }
  }
  ax += `B(${n(padLen)})`;
  const phi = az * DEG;
  const reach = u * (full ? 2.15 : 1.45);
  const drop = u * (full ? 4.4 : 1.15);
  P.attractor = [Math.sin(phi) * reach, full ? -drop : -u * 0.35, -Math.cos(phi) * reach];
  return ax;
}

function trunkBroom(id, P, bio, r, bag) {
  const seg = bio.unit * (id === 'ficus' ? 0.72 : 0.9);
  const segs = 4;
  let ax = `^(${n(2)})`;
  for (let k = 0; k < segs; k++) ax += `&(${n(r.jit(0.45))})F(${n(seg * (1 - 0.03 * k))})`;
  const trunkH = seg * segs;
  const spokeLen = Math.max(bio.branchLen * (id === 'ficus' ? 2.4 : 1.05), trunkH * 1.05);
  const lift = P.lift || 0.13;
  const spoke = (len) => {
    let o = `~(0)F(${n(Math.min(seg * 0.35, 0.08))})~(${n(-lift)})`;
    o += `[+(${n(26 + r.jit(5))})B(${n(len * 0.62)})]`;
    o += `[-(${n(26 + r.jit(5))})B(${n(len * 0.56)})]`;
    o += `^(${n(7)})B(${n(len * 0.48)})`;
    return o;
  };
  const rings = [[5, 60], [4, 38], [3, 18]];
  let yaw0 = r.f() * 24;
  for (const [count, elev] of rings) {
    for (let i = 0; i < count; i++) {
      ax += `F(${n(seg * 0.18)})`;
      let yaw = yaw0 + (i + 0.5) * (360 / count) + r.jit(4);
      yaw = yawOffFront(yaw, elev > 50);
      const len = spokeLen * (elev > 50 ? 1 : elev > 30 ? 0.84 : 0.7);
      ax += `[/(${n(yaw)})&(${n(elev + r.jit(2))})${spoke(len)}]`;
    }
    yaw0 += 180 / count;
  }
  ax += spoke(spokeLen * 0.58);
  if (id === 'ficus' && bag.aerial > 0) {
    ax += `[/(70)&(58)F(0.2)W(0.2,0.08,0.14)B(${n(spokeLen * 0.4)})]`;
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
  let body = '';
  if (styleId === 'chokkan') body = trunkChokkan(id, P, bio, r, bag);
  else if (styleId === 'shakan') body = trunkShakan(id, P, bio, r, bag);
  else if (styleId === 'kengai') body = trunkCascade(id, P, bio, r, bag, true);
  else if (styleId === 'han_kengai') body = trunkCascade(id, P, bio, r, bag, false);
  else if (styleId === 'hokidachi') body = trunkBroom(id, P, bio, r, bag);
  else body = trunkMoyogi(id, P, bio, r, bag);
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
    leg = Math.max(a * 0.85, -m.minY - h + 0.62);
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
  for (const key in inst) for (const it of inst[key]) {
    if (!it.p || it.p.y > tableY + 0.05 || it.p.y < tableY - 0.22) continue;
    const px = it.p.x - ox;
    const pz = it.p.z - oz;
    const e = (px / topA) ** 2 + (pz / topB) ** 2;
    if (e >= 1 || e < 1e-5) continue;
    const s = Math.sqrt(1.06 / e);
    it.p.x = ox + px * s;
    it.p.z = oz + pz * s;
  }
}
