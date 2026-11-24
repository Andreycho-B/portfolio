import { BufferGeometry, Float32BufferAttribute } from "three";

export const createCrtGlassDomeGeometry = (): BufferGeometry => {
  const segs = 16;
  const stride = segs + 1;
  const midY = 0.165;
  const halfH = 0.8557;
  const halfW = 1.026;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r <= segs; r++) {
    const vNorm = r / segs;
    const v = vNorm * 2 - 1;
    const y = midY + v * halfH;
    const cosV = Math.cos(v * 1.06);
    for (let c = 0; c <= segs; c++) {
      const uNorm = c / segs;
      const u = uNorm * 2 - 1;
      const x = u * halfW;
      const z = 0.8218 + 0.3024 * Math.cos(u * 1.22) * cosV;

      positions.push(x, y, z);
      uvs.push(uNorm, vNorm);
    }
  }

  for (let r = 0; r < segs; r++) {
    for (let c = 0; c < segs; c++) {
      const a = r * stride + c;
      const b = a + 1;
      const cIdx = (r + 1) * stride + c;
      const d = cIdx + 1;
      indices.push(a, b, cIdx, b, d, cIdx);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};
