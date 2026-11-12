import { buildSkeletonPackage } from './lsystem-core.mjs';
import { ENV_DEFAULT } from './v8-engine.mjs';

/** Copy typed-array fields so buffers can be transferred to the main thread. */
function packBuffers(pkg) {
  const xfers = [];
  const tag = (buf) => {
    if (buf && buf.buffer) {
      xfers.push(buf.buffer);
      return { kind: 'typed', ctor: buf.constructor.name, buffer: buf.buffer, byteOffset: buf.byteOffset, length: buf.length };
    }
    return buf;
  };
  const sk = {
    N: pkg.sk.N,
    X: tag(pkg.sk.X),
    Y: tag(pkg.sk.Y),
    Z: tag(pkg.sk.Z),
    PAR: tag(pkg.sk.PAR),
    T0: tag(pkg.sk.T0),
    T1: tag(pkg.sk.T1),
  };
  if (pkg.sk.TD) sk.TD = tag(pkg.sk.TD);
  if (pkg.sk.boost) sk.boost = pkg.sk.boost;
  if (pkg.sk.tipw) sk.tipw = pkg.sk.tipw;
  if (pkg.sk.jin) sk.jin = pkg.sk.jin;
  const out = { ...pkg, sk, rFull: tag(pkg.rFull), rTube: tag(pkg.rTube), tags: pkg.tags ? tag(pkg.tags) : null };
  if (out.W) {
    out.W = { ...out.W };
    delete out.W.TD;
    if (out.W.TW) out.W.TW = tag(out.W.TW);
  }
  return { payload: out, transfer: xfers };
}

self.onmessage = (ev) => {
  const { id, seed, opts, env, genomeState, taskId } = ev.data;
  try {
    const pkg = buildSkeletonPackage(id, seed, opts, env ?? ENV_DEFAULT, genomeState);
    delete pkg.def;
    delete pkg.sp;
    const { payload, transfer } = packBuffers(pkg);
    self.postMessage({ ok: true, taskId, pkg: payload }, transfer);
  } catch (err) {
    self.postMessage({ ok: false, taskId, error: String(err && err.stack || err) });
  }
};
