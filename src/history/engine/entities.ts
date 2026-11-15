import * as THREE from "three";
import type { CharSpec, Episode, ShipSpec, Vec3 } from "../types";
import { clamp, ease, lerp, rotY } from "./math";
import { waveHeight } from "../world/waves";

export const SHIP_DIMS = {
  sloop: { L: 15, B: 4.6 },
  galleon: { L: 30, B: 9 },
  qar: { L: 34, B: 9.6 },
};

export interface ShipState {
  x: number; y: number; z: number;
  heading: number; pitch: number; roll: number;
  scale: number;
  euler: THREE.Euler;
}

export const shipState = (s: ShipSpec, t: number, storm: number): ShipState => {
  const sc = s.scale ?? 1;
  const posAt = (tt: number): [number, number] => {
    if (!s.legs) return [s.at[0] + s.vel[0] * (tt - s.atT), s.at[1] + s.vel[1] * (tt - s.atT)];
    const L = s.legs;
    if (tt <= L[0].t) return L[0].at;
    for (let i = 0; i < L.length - 1; i++) if (tt <= L[i + 1].t) { const u = (tt - L[i].t) / (L[i + 1].t - L[i].t); return [lerp(L[i].at[0], L[i + 1].at[0], u), lerp(L[i].at[1], L[i + 1].at[1], u)]; }
    return L[L.length - 1].at;
  };
  const [x, z] = posAt(t);
  let heading = s.heading ?? Math.atan2(s.vel[0], s.vel[1]);
  if (s.legs && s.heading === undefined) { const a = posAt(t - 0.8), b = posAt(t + 0.8); heading = Math.atan2(b[0] - a[0], b[1] - a[1]); }
  const { L, B } = SHIP_DIMS[s.kind];
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const l = L * sc * 0.33;
  const b = B * sc * 0.5;
  const h0 = waveHeight(x, z, t, storm);
  const hBow = waveHeight(x + fx * l, z + fz * l, t, storm);
  const hSt = waveHeight(x - fx * l, z - fz * l, t, storm);
  const hR = waveHeight(x + rx * b, z + rz * b, t, storm);
  const hL = waveHeight(x - rx * b, z - rz * b, t, storm);
  const damp = s.kind === "sloop" ? 0.8 : 0.55;
  const pitch = -Math.atan2(hBow - hSt, l * 2) * damp;
  const roll = Math.atan2(hR - hL, b * 2) * damp + (s.roll ?? 0);
  return {
    x, z, y: h0 * 0.85 - 0.25 * sc, heading, pitch, roll, scale: sc,
    euler: new THREE.Euler(pitch, heading, roll, "YXZ"),
  };
};

export const shipLocalToWorld = (st: ShipState, local: Vec3): Vec3 => {
  const v = new THREE.Vector3(local[0] * st.scale, local[1] * st.scale, local[2] * st.scale);
  v.applyEuler(st.euler);
  return [st.x + v.x, st.y + v.y, st.z + v.z];
};

export interface Resolved { pos: Vec3; heading: number }

export const makeResolver = (ep: Episode) => {
  const ships = new Map(ep.ships.map((s) => [s.id, s]));
  const chars = new Map(ep.chars.map((c) => [c.id, c]));
  const stormAt = (t: number) => ep.atmo.length ? ep.atmo[Math.min(ep.atmo.length - 1, Math.max(0, ep.atmo.findIndex((a) => a.t > t) - 1))].storm : 0;
  const shipAt = (id: string, t: number) => {
    const s = ships.get(id);
    if (!s) throw new Error("unknown ship " + id);
    return shipState(s, t, stormAt(t));
  };
  const charWorld = (c: CharSpec, t: number): Vec3 => {
    let local: Vec3 = c.local;
    let shipId = c.ship;
    let lift = 0;
    for (const m of c.moves ?? []) {
      if (t >= m.t0 && t <= m.t1) {
        const u = ease("inOut", (t - m.t0) / (m.t1 - m.t0));
        const from = shipLocalToWorld(shipAt(shipId!, t), local);
        const to = shipLocalToWorld(shipAt(m.ship, t), m.local);
        lift = Math.sin(Math.PI * u) * m.arc;
        return [lerp(from[0], to[0], u), lerp(from[1], to[1], u) + lift, lerp(from[2], to[2], u)];
      }
      if (t > m.t1) { local = m.local; shipId = m.ship; }
    }
    if (!shipId) return local;
    return shipLocalToWorld(shipAt(shipId, t), local);
  };
  const resolve = (id: string, t: number): Resolved => {
    if (ships.has(id)) {
      const st = shipAt(id, t);
      return { pos: [st.x, 0, st.z], heading: st.heading };
    }
    const c = chars.get(id);
    if (c) {
      const p = charWorld(c, t);
      const h = c.ship ? shipAt(c.ship, t).heading : 0;
      return { pos: p, heading: h };
    }
    throw new Error("unknown entity " + id);
  };
  return { resolve, shipAt, charWorld, stormAt };
};
export type Resolver = ReturnType<typeof makeResolver>;
export const offsetRel = (o: Vec3, rel: boolean | undefined, heading: number): Vec3 => (rel ? rotY(o, heading) : o);
export { clamp };
