import type { CamKey, ShakeEvent, Vec3 } from "../types";
import { add3, clamp, ease, lerp, noise1, rotY, sub3 } from "./math";
import { offsetRel, type Resolver } from "./entities";

export interface CamState { pos: Vec3; look: Vec3; fov: number; roll: number }

const resolveKey = (k: CamKey, t: number, R: Resolver) => {
  let pos = k.pos;
  let look = k.look;
  if (k.target) {
    const e = R.resolve(k.target, t);
    pos = add3(e.pos, offsetRel(k.pos, k.rel, e.heading));
    if (!k.lookTarget) look = add3(e.pos, offsetRel(k.look, k.rel, e.heading));
  }
  if (k.lookTarget) {
    const e = R.resolve(k.lookTarget, t);
    look = add3(e.pos, offsetRel(k.look, k.rel, e.heading));
  }
  return { pos, look, fov: k.fov, roll: k.roll ?? 0 };
};

const herm = (p0: number, p1: number, m0: number, m1: number, u: number) => {
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
};

export const sampleCamera = (keys: CamKey[], t: number, R: Resolver, shakes: ShakeEvent[] = []): CamState => {
  let i = 0;
  while (i < keys.length - 2 && keys[i + 1].t <= t) i++;
  const k0 = keys[i];
  const k1 = keys[Math.min(i + 1, keys.length - 1)];
  const km = keys[Math.max(i - 1, 0)];
  const kn = keys[Math.min(i + 2, keys.length - 1)];
  const span = Math.max(1e-4, k1.t - k0.t);
  const u = clamp((t - k0.t) / span);
  const a = resolveKey(k0, t, R);
  const b = resolveKey(k1, t, R);
  const name = k0.ease ?? "spline";
  let pos: Vec3;
  let look: Vec3;
  let fov: number;
  let roll: number;
  if (name === "spline" && km !== k0 && kn !== k1 && km.ease !== "snap" && k1.ease !== "snap") {
    const pm = resolveKey(km, t, R);
    const pn = resolveKey(kn, t, R);
    const s0 = span / Math.max(1e-4, k1.t - km.t);
    const s1 = span / Math.max(1e-4, kn.t - k0.t);
    const h = (f: (c: typeof a) => number) => herm(f(a), f(b), (f(b) - f(pm)) * s0, (f(pn) - f(a)) * s1, u);
    pos = [h((c) => c.pos[0]), h((c) => c.pos[1]), h((c) => c.pos[2])];
    look = [h((c) => c.look[0]), h((c) => c.look[1]), h((c) => c.look[2])];
    fov = h((c) => c.fov);
    roll = h((c) => c.roll);
  } else {
    const e = ease(name === "spline" ? "inOut" : name, u);
    pos = [lerp(a.pos[0], b.pos[0], e), lerp(a.pos[1], b.pos[1], e), lerp(a.pos[2], b.pos[2], e)];
    look = [lerp(a.look[0], b.look[0], e), lerp(a.look[1], b.look[1], e), lerp(a.look[2], b.look[2], e)];
    fov = lerp(a.fov, b.fov, e);
    roll = lerp(a.roll, b.roll, e);
  }
  if (k0.whip) {
    const e = ease(name === "spline" ? "inOut" : name, u);
    const d = sub3(look, pos);
    const r = rotY(d, k0.whip * Math.sin(Math.PI * e));
    look = add3(pos, r);
  }
  let amp = lerp(k0.shake ?? 0.25, k1.shake ?? 0.25, u);
  for (const s of shakes) if (t >= s.t && t <= s.t + s.dur) amp += s.amp * (1 - (t - s.t) / s.dur);
  const n = (o: number, f: number) => noise1(t * f + o);
  pos = [pos[0] + n(1, 6.3) * amp * 0.06, pos[1] + n(7, 7.1) * amp * 0.06, pos[2] + n(13, 5.7) * amp * 0.06];
  look = [look[0] + n(3, 4.1) * amp * 0.05, look[1] + n(9, 4.7) * amp * 0.05, look[2]];
  roll += n(21, 3.3) * amp * 0.012;
  return { pos, look, fov, roll };
};

/** screen-space blur (px) from camera motion between two instants */
export const cameraBlur = (keys: CamKey[], t: number, R: Resolver, H: number, shakes: ShakeEvent[]) => {
  const dt = 1 / 60;
  const c1 = sampleCamera(keys, t, R, shakes);
  const c0 = sampleCamera(keys, t - dt, R, shakes);
  const f1 = sub3(c1.look, c1.pos);
  const f0 = sub3(c0.look, c0.pos);
  const yaw = (f: Vec3) => Math.atan2(f[0], f[2]);
  const pitch = (f: Vec3) => Math.atan2(f[1], Math.hypot(f[0], f[2]));
  let dy = yaw(f1) - yaw(f0);
  if (dy > Math.PI) dy -= 2 * Math.PI;
  if (dy < -Math.PI) dy += 2 * Math.PI;
  const dp = pitch(f1) - pitch(f0);
  const pxPerRad = H / (2 * Math.tan((c1.fov * Math.PI) / 360));
  const D = Math.max(10, Math.hypot(f1[0], f1[1], f1[2]));
  const cy = Math.cos(yaw(f1));
  const sy = Math.sin(yaw(f1));
  const mv = sub3(c1.pos, c0.pos);
  const lat = mv[0] * cy - mv[2] * sy;
  const bx = Math.abs(dy * pxPerRad) + Math.abs((lat / D) * pxPerRad);
  const by = Math.abs(dp * pxPerRad) + Math.abs((mv[1] / D) * pxPerRad);
  const shutter = 0.5 * 0.5;
  return { x: Math.min(48, Math.max(0, bx * shutter - 1.2)), y: Math.min(30, Math.max(0, by * shutter - 1.2)) };
};
