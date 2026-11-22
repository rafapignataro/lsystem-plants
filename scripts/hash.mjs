/** Hash leve do esqueleto, dos raios e das folhas (sem navegador). Rode antes e depois de mexer no motor e compare: node scripts/hash.mjs */
import { BONSAI, buildSkeletonPackage } from '../lsystem-core.mjs';
const h = (arr) => { let x = 2166136261; for (const v of arr) { x ^= Math.round(v * 1e4) | 0; x = Math.imul(x, 16777619); } return (x >>> 0).toString(16); };
const out = {};
for (const id of BONSAI) for (const sim of [true, false]) {
  const t = performance.now();
  const p = buildSkeletonPackage(id, 'lindenmayer', { sim }, {}, null);
  const leaves = Object.values(p.inst).flat();
  out[`${id}:${sim ? 's' : 'c'}`] = [h(p.sk.X), h(p.rFull), leaves.length, h(leaves.map(l => l.p.x)), Math.round(performance.now() - t) + 'ms'].join(' ');
}
console.log(JSON.stringify(out, null, 1));
