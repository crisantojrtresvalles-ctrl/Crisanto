import React, { useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { IslandSpec } from "../types";
import { hash, smoothstep } from "../engine/math";

export const hgt = (s: IslandSpec, x: number, z: number) => {
  const r = Math.hypot(x, z) / s.radius;
  const n = Math.sin(x * 0.21 + s.seed) * 0.5 + Math.sin(z * 0.27 + s.seed * 2) * 0.4 + Math.sin((x + z) * 0.11 + s.seed * 3) * 0.7;
  const f = Math.pow(Math.max(0, 1 - Math.pow(r, 1.7)), 1.25);
  return s.peak * f * (0.8 + 0.22 * n) - 1.4;
};
const paint = (g: THREE.BufferGeometry, c: string) => {
  const col = new THREE.Color(c); const n = g.attributes.position.count; const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3)); g.deleteAttribute("uv"); return g;
};

const build = (s: IslandSpec) => {
  const N = 56, R = s.radius * 1.15;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const sand = new THREE.Color("#dcc58a"), grass = new THREE.Color("#4f8f3c"), grass2 = new THREE.Color("#3a7332"), rock = new THREE.Color("#7a7468");
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = (i / N - 0.5) * 2 * R, z = (j / N - 0.5) * 2 * R;
    const y = hgt(s, x, z);
    pos.push(x, y, z);
    let c = sand.clone();
    if (!s.sandOnly) {
      const g = grass.clone().lerp(grass2, hash(i * 3 + j * 7 + s.seed));
      c = y < 0.45 ? sand.clone().lerp(g, smoothstep(0.1, 0.45, y)) : g.lerp(rock, smoothstep(s.peak * 0.55, s.peak * 0.95, y));
    }
    col.push(c.r, c.g, c.b);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const props: THREE.BufferGeometry[] = [];
  const palms: THREE.BufferGeometry[] = [];
  const rocks: THREE.BufferGeometry[] = [];
  const landAt = (k: number, lo: number, hi: number) => {
    for (let a = 0; a < 40; a++) {
      const ang = hash(k * 13 + a) * 6.283, rr = s.radius * (0.15 + 0.8 * hash(k * 7 + a * 3));
      const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr, y = hgt(s, x, z);
      if (y > lo && y < hi) return [x, y, z] as const;
    }
    return null;
  };
  for (let k = 0; k < s.palms; k++) {
    const p = landAt(k + s.seed * 5, 0.3, Math.max(1, s.peak * 0.45)); if (!p) continue;
    const parts: THREE.BufferGeometry[] = [];
    const lean = (hash(k) - 0.5) * 1.2, h = 4.5 + hash(k + 3) * 2.5;
    for (let q = 0; q < 3; q++) { const t0 = q / 3, t1 = (q + 1) / 3; const c = new THREE.CylinderGeometry(0.2 - t1 * 0.08, 0.2 - t0 * 0.08, h / 3, 5); c.translate(lean * (t0 + 0.17) * 1.2, h * (t0 + 0.17), 0); c.rotateZ(0); parts.push(paint(c, "#6d4a2a")); }
    for (let l = 0; l < 7; l++) {
      const ang = (l / 7) * 6.283 + k;
      const leaf = new THREE.PlaneGeometry(0.7, 3.6, 1, 3);
      const pa = leaf.attributes.position; for (let v = 0; v < pa.count; v++) pa.setZ(v, -Math.pow((pa.getY(v) + 1.8) / 3.6, 2) * 1.5);
      leaf.translate(0, 1.8, 0); leaf.rotateX(-1.15); leaf.rotateY(ang); leaf.translate(lean * 1.2, h, 0);
      parts.push(paint(leaf, hash(l + k) > 0.5 ? "#3f8f3a" : "#2f7a35"));
    }
    const m = mergeGeometries(parts)!; m.translate(p[0], p[1], p[2]); palms.push(m);
  }
  for (let k = 0; k < 8; k++) { const p = landAt(k + 99 + s.seed, -0.6, 0.5); if (!p) continue; const r = new THREE.IcosahedronGeometry(0.6 + hash(k) * 1.3, 0); r.scale(1, 0.7, 1); r.translate(p[0], p[1], p[2]); rocks.push(paint(r, "#6c6a64")); }
  const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string, ry = 0) => { const b = new THREE.BoxGeometry(w, h, d); b.rotateY(ry); b.translate(x, y, z); return paint(b, c); };
  for (let k = 0; k < (s.houses ?? 0); k++) {
    const p = landAt(k + 300 + s.seed, 0.5, 2.2); if (!p) continue;
    const w = 3.5 + hash(k) * 2, d = 3 + hash(k + 1) * 2, h = 2.6 + hash(k + 2) * 1.4, ry = hash(k + 4) * 1.2;
    const wall = ["#e8d9b8", "#c9a57a", "#d9c0a0", "#b9c8c2"][k % 4], roof = ["#a34a32", "#7d3a2a", "#4c6a78"][k % 3];
    props.push(box(p[0], p[1] + h / 2, p[2], w, h, d, wall, ry));
    const rf = new THREE.ConeGeometry(Math.max(w, d) * 0.78, 1.8, 4); rf.rotateY(Math.PI / 4 + ry); rf.translate(p[0], p[1] + h + 0.9, p[2]); props.push(paint(rf, roof));
    props.push(box(p[0] + Math.cos(ry) * w * 0.51, p[1] + h * 0.45, p[2] - Math.sin(ry) * w * 0.51, 0.1, 0.9, 0.7, "#ffc766", ry));
  }
  if (s.fort) {
    props.push(box(0, 2.2, 0, 14, 4.4, 10, "#9a9486"), box(0, 4.7, 0, 15, 0.7, 11, "#7d776b"));
    for (const [x, z] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) props.push(box(x, 3.4, z, 3.2, 6.8, 3.2, "#8b8578"), box(x, 7.2, z, 3.6, 0.8, 3.6, "#6f6a5f"));
    for (let k = 0; k < 5; k++) { const c = new THREE.CylinderGeometry(0.28, 0.34, 2, 7); c.rotateZ(Math.PI / 2); c.translate(-6 + k * 3, 5.4, 6); props.push(paint(c, "#25272b")); }
  }
  // pier
  if (s.houses) { for (let k = 0; k < 9; k++) props.push(box(s.radius * 0.55 + k * 1.6, 0.35, s.radius * 0.1, 1.5, 0.18, 2.4, "#7b5a38")); }
  return { land: g, props: props.length ? mergeGeometries(props) : null, palms: palms, rocks: rocks.length ? mergeGeometries(rocks) : null };
};
const cache = new Map<string, ReturnType<typeof build>>();
export const Island: React.FC<{ spec: IslandSpec; t: number }> = ({ spec, t }) => {
  const m = useMemo(() => { let b = cache.get(spec.id); if (!b) { b = build(spec); cache.set(spec.id, b); } return b; }, [spec]);
  return (
    <group position={[spec.at[0], 0, spec.at[1]]} rotation={[0, spec.rot ?? 0, 0]}>
      <mesh geometry={m.land}><meshLambertMaterial vertexColors flatShading /></mesh>
      {m.props && <mesh geometry={m.props}><meshLambertMaterial vertexColors flatShading /></mesh>}
      {m.rocks && <mesh geometry={m.rocks}><meshLambertMaterial vertexColors flatShading /></mesh>}
      {m.palms.map((g, i) => <mesh key={i} geometry={g} rotation={[0, 0, Math.sin(t * 1.3 + i) * 0.02]}><meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} /></mesh>)}
    </group>
  );
};
