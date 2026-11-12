import { buildJointMeshes } from './v8-engine.mjs';

self.onmessage = ({ data }) => {
  const sk = {
    N: data.X.length,
    X: data.X, Y: data.Y, Z: data.Z, PAR: data.PAR,
  };
  const mesh = buildJointMeshes(sk, data.rFull, data.deadCfg, data.opts);
  self.postMessage({ mesh, id: data.jobId });
};
