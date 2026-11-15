import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { ShipKind, Vec3 } from "../types";
import { lerp, smoothstep } from "../engine/math";

export interface SailDef { mast: number; corners: [Vec3, Vec3, Vec3, Vec3]; n: number; m: number; bulge: number; dir: Vec3; phase: number; patch: boolean }
export interface PortDef { pos: Vec3; rotY: number; idx: number; row: number }
export interface ShipParts {
  hull: THREE.BufferGeometry; props: THREE.BufferGeometry; glow: THREE.BufferGeometry;
  masts: { geo: THREE.BufferGeometry; z: number; top: number }[];
  sails: SailDef[]; lines: Float32Array; ports: PortDef[];
  flagTop: Vec3; flagBase: Vec3; flagLen: number; flagH: number;
  L: number; B: number;
}
interface HullDef { L: number; B: number; D: number; H: number; stern: number; bow: number; color: string; trim: string; deck: string }
const HULLS: Record<ShipKind, HullDef> = {
  sloop: { L: 15, B: 4.6, D: 1.2, H: 1.6, stern: 0.45, bow: 0.9, color: "#6b4a2e", trim: "#c9a24a", deck: "#a07c4f" },
  galleon: { L: 30, B: 9, D: 2.5, H: 3.4, stern: 3.6, bow: 2.0, color: "#4b2f22", trim: "#d3a640", deck: "#9a7648" },
  qar: { L: 34, B: 9.6, D: 2.6, H: 3.2, stern: 2.8, bow: 1.5, color: "#2b2724", trim: "#c8963a", deck: "#8d6a43" },
};
export const halfBeam = (d: HullDef, u: number) => {
  const w = d.B / 2;
  if (u < 0.16) return w * (0.74 + 0.26 * (u / 0.16));
  if (u < 0.55) return w;
  return w * Math.pow(Math.max(0, 1 - (u - 0.55) / 0.45), 0.62);
};
export const deckTop = (d: HullDef, u: number) => d.H + d.stern * smoothstep(0.5, 0.0, u) + d.bow * Math.pow(smoothstep(0.68, 1, u), 1.4);
const keelY = (d: HullDef, u: number) => -d.D * (1 - 0.55 * Math.pow(Math.abs(2 * u - 1), 3));
const sec = (s: number) => Math.cos(s * 1.25);

const colorize = (g: THREE.BufferGeometry, c: string) => {
  const col = new THREE.Color(c);
  const n = g.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  g.deleteAttribute("uv");
  return g;
};
const cyl = (a: Vec3, b: Vec3, r0: number, r1: number, c: string, seg = 6) => {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const d = B.clone().sub(A); const L = d.length();
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1);
  g.applyMatrix4(new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1)));
  return colorize(g, c);
};
const box = (p: Vec3, s: Vec3, c: string, ry = 0) => {
  const g = new THREE.BoxGeometry(s[0], s[1], s[2]);
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)));
  return colorize(g, c);
};
const barrel = (p: Vec3, r: number, h: number) => {
  const g = new THREE.CylinderGeometry(r, r * 0.88, h, 8);
  g.translate(p[0], p[1] + h / 2, p[2]);
  return colorize(g, "#7a5230");
};

const buildHull = (d: HullDef) => {
  const N = 28, M = 7;
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const base = new THREE.Color(d.color), trim = new THREE.Color(d.trim), tar = new THREE.Color("#1c1612"), deck = new THREE.Color(d.deck);
  const rows = (u: number) => {
    const w = halfBeam(d, u), top = deckTop(d, u), bot = keelY(d, u);
    const r: { x: number; y: number }[] = [];
    for (let j = 0; j < M; j++) { const s = j / (M - 1); r.push({ x: w * sec(s), y: lerp(top, bot, s) }); }
    r.push({ x: 0, y: bot });
    return r;
  };
  const R = M + 1;
  for (let i = 0; i <= N; i++) {
    const u = i / N, z = (u - 0.5) * d.L, rr = rows(u);
    for (let side = 0; side < 2; side++) {
      const sg = side === 0 ? 1 : -1;
      for (let j = 0; j < R; j++) {
        pos.push(rr[j].x * sg, rr[j].y, z);
        let c = base.clone().multiplyScalar(j % 2 ? 0.86 : 1.06);
        if (j <= 1) c = trim.clone().multiplyScalar(j === 0 ? 1 : 0.75);
        else if (rr[j].y < 0.25) c = tar.clone();
        col.push(c.r, c.g, c.b);
      }
    }
  }
  const vi = (i: number, side: number, j: number) => (i * 2 + side) * R + j;
  for (let i = 0; i < N; i++)
    for (let side = 0; side < 2; side++)
      for (let j = 0; j < R - 1; j++) {
        const a = vi(i, side, j), b = vi(i + 1, side, j), c = vi(i, side, j + 1), e = vi(i + 1, side, j + 1);
        if (side === 0) idx.push(a, b, c, b, e, c); else idx.push(a, c, b, b, c, e);
      }
  // deck surface + transom
  const dStart = pos.length / 3;
  for (let i = 0; i <= N; i++) {
    const u = i / N, z = (u - 0.5) * d.L, w = halfBeam(d, u) * 0.97, y = deckTop(d, u) - 0.6;
    pos.push(-w, y, z, w, y, z);
    col.push(deck.r, deck.g, deck.b, deck.r * 0.93, deck.g * 0.93, deck.b * 0.93);
  }
  for (let i = 0; i < N; i++) { const a = dStart + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const rr0 = rows(0);
  const tStart = pos.length / 3;
  for (let j = 0; j < R; j++) { pos.push(rr0[j].x, rr0[j].y, -d.L / 2, -rr0[j].x, rr0[j].y, -d.L / 2); const c = base.clone().multiplyScalar(j % 2 ? 0.8 : 0.95); col.push(c.r, c.g, c.b, c.r, c.g, c.b); }
  for (let j = 0; j < R - 1; j++) { const a = tStart + j * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

export const buildShip = (kind: ShipKind): ShipParts => {
  const d = HULLS[kind];
  const hull = buildHull(d);
  const props: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const masts: ShipParts["masts"] = [];
  const sails: SailDef[] = [];
  const L: number[] = [];
  const seg = (a: Vec3, b: Vec3) => L.push(...a, ...b);
  const deckY = (u: number) => deckTop(d, u) - 0.6;
  const wood = "#5b3e25", darkWood = "#3a2818", iron = "#26282b";
  const addMast = (z: number, h: number, r: number, yards: [number, number][], u: number) => {
    const y0 = deckY(u);
    const parts = [cyl([0, y0, z], [0, y0 + h, z], r, r * 0.45, wood, 7), cyl([0, y0 + h * 0.62, z], [0, y0 + h * 0.62 + 0.4, z], r * 1.3, r * 1.3, darkWood, 7)];
    for (const [y, w] of yards) parts.push(cyl([-w / 2, y0 + y, z + 0.1], [w / 2, y0 + y, z + 0.1], 0.1, 0.1, wood, 5));
    masts.push({ geo: mergeGeometries(parts)!, z, top: y0 + h });
    return y0;
  };
  const square = (mi: number, z: number, y0: number, tiers: [number, number, number][], bulge: number) => {
    tiers.forEach(([yy, w, hh], k) => sails.push({
      mast: mi, corners: [[-w / 2, y0 + yy, z + 0.18], [w / 2, y0 + yy, z + 0.18], [-w * 0.44, y0 + yy - hh, z + 0.18], [w * 0.44, y0 + yy - hh, z + 0.18]],
      n: 8, m: 6, bulge, dir: [0, 0, 1], phase: k * 1.3 + mi, patch: kind === "sloop",
    }));
  };
  let flagTop: Vec3 = [0, 14, 0], flagBase: Vec3 = [0, 4, 0], flagLen = 2.4, flagH = 1.5;

  if (kind === "sloop") {
    const y0 = addMast(1.2, 13.2, 0.19, [], 0.55);
    const yb = y0 + 1.2;
    props.push(cyl([0, yb, 1.1], [0, yb - 0.1, -6.6], 0.09, 0.07, wood), cyl([0, y0 + 10, 1.1], [0, y0 + 8.6, -4.6], 0.07, 0.06, wood));
    props.push(cyl([0, y0 + 0.3, 5.2], [0, y0 + 1.7, 11.2], 0.14, 0.08, wood), box([0, y0 - 0.2, 6.2], [0.6, 0.3, 1.4], darkWood));
    sails.push({ mast: 0, corners: [[0, yb + 0.1, 1.0], [0, yb, -6.5], [0, y0 + 10.3, 1.0], [0, y0 + 8.7, -4.5]], n: 10, m: 8, bulge: 1.5, dir: [1, 0, 0], phase: 0, patch: true });
    sails.push({ mast: 0, corners: [[0, y0 + 10.3, 1.0], [0, y0 + 8.7, -4.5], [0, y0 + 14.4, 1.0], [0, y0 + 14.4, 1.0]], n: 6, m: 5, bulge: 0.8, dir: [1, 0, 0], phase: 1.1, patch: true });
    sails.push({ mast: 0, corners: [[0, y0 + 1.7, 11.0], [0, y0 + 1.5, 5.4], [0, y0 + 12.8, 1.35], [0, y0 + 12.8, 1.35]], n: 8, m: 6, bulge: 1.0, dir: [1, 0, 0], phase: 2.2, patch: true });
    sails.push({ mast: 0, corners: [[0, y0 + 1.5, 5.3], [0, y0 + 1.4, 1.5], [0, y0 + 8.5, 1.3], [0, y0 + 8.5, 1.3]], n: 6, m: 5, bulge: 0.8, dir: [1, 0, 0], phase: 3.3, patch: true });
    seg([0, y0 + 13, 1.2], [0, y0 + 1.7, 11.2]); seg([0, y0 + 13, 1.2], [0, y0 + 1.2, -7.2]);
    for (const s of [-1, 1]) for (const zz of [0.2, 1.2, 2.2]) { seg([0, y0 + 9, 1.2], [s * 1.95, y0 - 0.2, zz]); seg([0, y0 + 5.5, 1.2], [s * 1.95, y0 - 0.2, zz]); }
    for (const s of [-1, 1]) props.push(cyl([s * 1.5, y0 - 0.6, 3.5], [s * 1.5, y0 - 0.2, 4.6], 0.1, 0.07, iron), box([s * 1.5, y0 - 0.9, 3.8], [0.35, 0.35, 0.8], darkWood));
    props.push(barrel([-1.0, y0 - 0.5, 2.8], 0.4, 0.8), barrel([0.9, y0 - 0.5, -2.0], 0.4, 0.8), box([0, y0 - 0.3, -3.2], [1.4, 0.7, 1.0], darkWood), cyl([0, y0 - 0.5, -5.6], [0, y0 + 0.8, -5.6], 0.06, 0.06, darkWood));
    flagTop = [0, y0 + 14.4, 1.2]; flagBase = [0, y0 + 3, 1.2]; flagLen = 2.6; flagH = 1.7;
  } else {
    const big = kind === "qar";
    const spec = big
      ? [{ z: 11, h: 24, r: 0.3, u: 0.8, yards: [[9, 15], [16.5, 11.5], [22, 7.5]] as [number, number][], tiers: [[9, 15, 8], [16.5, 11.5, 6.8], [22, 7.5, 5.2]] as [number, number, number][] },
         { z: 0.5, h: 30, r: 0.36, u: 0.5, yards: [[10.5, 17], [19, 13], [25.5, 8.5]] as [number, number][], tiers: [[10.5, 17, 9], [19, 13, 7.5], [25.5, 8.5, 6]] as [number, number, number][] },
         { z: -10, h: 21, r: 0.27, u: 0.2, yards: [[8, 12], [14.5, 9]] as [number, number][], tiers: [[8, 12, 6.5], [14.5, 9, 5.5]] as [number, number, number][] }]
      : [{ z: 8.5, h: 21, r: 0.28, u: 0.78, yards: [[8, 13], [15, 9.5]] as [number, number][], tiers: [[8, 13, 7], [15, 9.5, 6]] as [number, number, number][] },
         { z: 0.5, h: 26, r: 0.33, u: 0.5, yards: [[9, 15], [16.5, 11], [22, 7]] as [number, number][], tiers: [[9, 15, 7.5], [16.5, 11, 6.2], [22, 7, 4.6]] as [number, number, number][] },
         { z: -9.5, h: 18, r: 0.25, u: 0.2, yards: [[7, 10]] as [number, number][], tiers: [[7, 10, 6]] as [number, number, number][] }];
    spec.forEach((s, i) => {
      const y0 = addMast(s.z, s.h, s.r, s.yards, s.u);
      square(i, s.z, y0, s.tiers, big ? 2.2 : 1.8);
      for (const sgn of [-1, 1]) for (const zz of [-1.2, 0, 1.2]) { seg([0, y0 + s.h * 0.62, s.z], [sgn * (d.B / 2 - 0.2), y0 - 0.4, s.z + zz]); seg([0, y0 + s.h * 0.35, s.z], [sgn * (d.B / 2 - 0.2), y0 - 0.4, s.z + zz]); }
      for (const [yy, w] of s.yards) { seg([-w / 2, y0 + yy, s.z + 0.1], [-w * 0.44, y0 + yy - 4, s.z + 0.2]); seg([w / 2, y0 + yy, s.z + 0.1], [w * 0.44, y0 + yy - 4, s.z + 0.2]); }
    });
    const fm = spec[0], mm = spec[1];
    const yf = deckY(fm.u), ym = deckY(mm.u);
    seg([0, ym + mm.h, mm.z], [0, yf + fm.h, fm.z]); seg([0, yf + fm.h, fm.z], [0, d.H + d.bow + 1.5, d.L / 2 + 4]); seg([0, ym + mm.h, mm.z], [0, deckY(0.1) + 2, -d.L / 2]);
    seg([0, yf + fm.h * 0.7, fm.z], [0, deckY(1) + 1.5, d.L / 2 + 4]);
    props.push(cyl([0, deckY(0.93), d.L / 2 - 2], [0, deckY(0.93) + 2.2, d.L / 2 + 5], 0.2, 0.12, wood));
    sails.push({ mast: 0, corners: [[0, deckY(0.95) + 2.6, d.L / 2 + 4.6], [0, deckY(0.9) + 1, d.L / 2 - 1], [0, yf + fm.h * 0.7, fm.z + 0.3], [0, yf + fm.h * 0.7, fm.z + 0.3]], n: 8, m: 6, bulge: 1.3, dir: [1, 0, 0], phase: 4.1, patch: false });
    // sterncastle + forecastle blocks
    const sh = d.H + d.stern;
    props.push(box([0, sh - 0.2 + 1.1, -d.L * 0.38], [d.B * 0.78, 2.2, d.L * 0.22], d.color), box([0, sh + 2.2 + 0.1, -d.L * 0.38], [d.B * 0.84, 0.25, d.L * 0.24], d.trim));
    props.push(box([0, d.H + d.bow + 0.55, d.L * 0.36], [d.B * 0.5, 1.2, d.L * 0.12], d.color));
    props.push(cyl([0, sh + 1, -d.L / 2 + 0.6], [0, sh + 4.4, -d.L / 2 + 0.6], 0.07, 0.07, darkWood));
    for (let k = 0; k < 6; k++) { const x = -d.B * 0.3 + k * d.B * 0.12; glow.push(box([x, sh + 0.6, -d.L / 2 - 0.02], [0.55, 0.7, 0.1], "#ffcf70")); }
    for (const sgn of [-1, 1]) glow.push(box([sgn * d.B * 0.36, sh + 2.9, -d.L / 2 + 0.2], [0.45, 0.65, 0.45], "#ffb84a"));
    const wy = deckY(0.28);
    props.push(cyl([0, wy + 0.1, -d.L * 0.32], [0, wy + 1.6, -d.L * 0.32], 0.08, 0.08, darkWood, 5));
    for (let k = 0; k < 5; k++) props.push(barrel([-1.3 + (k % 3) * 1.2, deckY(0.55), -2 + Math.floor(k / 3) * 1.1], 0.45, 0.9));
    for (let k = 0; k < 5; k++) props.push(box([(k % 2 ? 1 : -1) * 1.0, deckY(0.62 + k * 0.03) + 0.35, 4 + k * 1.4], [0.8, 0.7, 0.8], "#6e5236"));
    // gun ports (2 rows) + deck cannons
    const ports: PortDef[] = [];
    const rowsY = big ? [1.3, 2.55] : [1.5, 2.7];
    const count = big ? 10 : 6;
    rowsY.forEach((ry, row) => {
      for (let k = 0; k < count; k++) {
        const u = 0.3 + (k / (count - 1)) * 0.38;
        const top = deckTop(d, u), bot = keelY(d, u);
        const s = Math.min(1, Math.max(0, (top - ry) / (top - bot)));
        const x = halfBeam(d, u) * sec(s) + 0.05;
        for (const sgn of [-1, 1]) ports.push({ pos: [sgn * x, ry, (u - 0.5) * d.L], rotY: sgn * Math.PI / 2, idx: k + row * count, row });
      }
    });
    (hull as THREE.BufferGeometry & { ports?: PortDef[] }).ports = ports;
    for (const sgn of [-1, 1]) for (let k = 0; k < 4; k++) props.push(cyl([sgn * (d.B / 2 - 1.1), deckY(0.35 + k * 0.1) + 0.2, (0.35 + k * 0.1 - 0.5) * d.L], [sgn * (d.B / 2 - 0.4), deckY(0.35 + k * 0.1) + 0.3, (0.35 + k * 0.1 - 0.5) * d.L], 0.14, 0.1, iron));
    flagTop = [0, deckY(spec[1].u) + spec[1].h + 2.4, spec[1].z]; flagBase = [0, deckY(spec[1].u) + 10, spec[1].z]; flagLen = big ? 5 : 4.2; flagH = big ? 3.2 : 2.6;
    return { hull, props: mergeGeometries(props)!, glow: mergeGeometries(glow)!, masts, sails, lines: new Float32Array(L), ports, flagTop, flagBase, flagLen, flagH, L: d.L, B: d.B };
  }
  const ports: PortDef[] = [];
  return { hull, props: mergeGeometries(props)!, glow: mergeGeometries([box([0, -50, 0], [0.01, 0.01, 0.01], "#000")]), masts, sails, lines: new Float32Array(L), ports, flagTop, flagBase, flagLen, flagH, L: d.L, B: d.B };
};
export const HULL_DEFS = HULLS;
