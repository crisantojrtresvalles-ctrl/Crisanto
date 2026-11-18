import type { ActionName, CharAction, Expr } from "../types";
import { clamp, ease, hash, lerp } from "../engine/math";

/** foot = [dx from hip centre (units), lift above ground (units)] */
export interface Pose {
  lean: number; bob: number; armF: [number, number]; armB: [number, number];
  head: number; mouth: number; brow: number; eyeWide: number; smile: number;
  squash: number; fl: [number, number]; fr: [number, number]; gaze: number; shake: number; hatTilt: number; browTilt: number;
}
export const IDLE: Pose = { lean: 0, bob: 0, armF: [0.18, 0.3], armB: [-0.15, -0.1], head: 0, mouth: 0, brow: 0, eyeWide: 0, smile: 0, squash: 1, fl: [-6, 0], fr: [6, 0], gaze: 0.5, shake: 0, hatTilt: 0, browTilt: 0 };

export const EXPR: Record<Expr, Partial<Pose>> = {
  neutral: {}, grin: { smile: 1, brow: -0.2 }, happy: { smile: 1, brow: 0.2 }, sad: { smile: -1, brow: 0.8, browTilt: 1 },
  angry: { brow: -1, smile: -0.4, mouth: 0.15 }, scared: { brow: 1, eyeWide: 1, smile: -0.7, mouth: 0.55 },
  shock: { brow: 1.1, eyeWide: 1.3, mouth: 0.85 }, smug: { smile: 0.7, brow: -0.3, eyeWide: -0.5 }, shout: { mouth: 1, brow: -0.7, smile: 0.2 },
  confused: { brow: 0.6, browTilt: 1, smile: -0.3, mouth: 0.1 }, curious: { brow: 0.7, smile: 0.3, eyeWide: 0.4 },
};
export const DEFAULT_EXPR: Partial<Record<ActionName, Expr>> = {
  panic: "scared", cower: "scared", surrender: "shock", shout: "shout", menace: "angry", slash: "angry", haul: "angry",
  laugh: "grin", cheer: "grin", wave: "grin", leap: "shout", fire: "smug", point: "smug", aim: "angry", brace: "scared",
  dance1: "happy", dance2: "grin", dance3: "happy", confused: "confused", watch: "curious", argue: "angry", play: "happy",
};

export const actionPose = (a: ActionName, tau: number, t: number, seed: number): Pose => {
  const p: Pose = { ...IDLE, armF: [...IDLE.armF], armB: [...IDLE.armB], fl: [...IDLE.fl], fr: [...IDLE.fr] };
  const s = (f: number, o = 0) => Math.sin(t * f + o + seed);
  const step = (f: number, amp: number, o = 0) => { const k = s(f, o); return [k * amp, Math.max(0, Math.cos(t * f + o + seed)) * amp * 0.9] as [number, number]; };
  switch (a) {
    case "point": p.armF = [1.5 + 0.05 * s(3), 1.55]; p.armB = [0.3, 0.5]; p.lean = 0.1; p.head = 0.05; break;
    case "cheer": p.armF = [2.7 + 0.25 * s(9), 2.95 + 0.3 * s(9, 1)]; p.armB = [-2.7 - 0.25 * s(9, 2), -2.95]; p.bob = 3 * Math.abs(s(7)); p.mouth = 0.8; p.smile = 1; p.fl = [-6, 0]; p.fr = [6, 2 * Math.abs(s(7))]; break;
    case "panic": p.armF = [2.4 + 0.5 * s(14), 2.7 + 0.5 * s(15, 1)]; p.armB = [-2.5 - 0.4 * s(13), -2.9]; p.lean = -0.15 + 0.06 * s(11); p.shake = 1; p.fl = [-7 + 2 * s(12), 0]; p.bob = 1.5 * Math.abs(s(10)); break;
    case "shout": p.armF = [1.9, 2.2]; p.armB = [0.2, 0.3]; p.lean = 0.12; p.head = -0.12; p.mouth = 0.5 + 0.5 * Math.abs(s(16)); break;
    case "telescope": p.armF = [2.35, 1.3]; p.armB = [0.9, 1.4]; p.lean = 0.08; p.head = -0.1; break;
    case "steer": p.armF = [1.0 + 0.25 * s(1.2), 0.9 + 0.2 * s(1.2)]; p.armB = [0.95 + 0.25 * s(1.2), 0.85]; p.lean = 0.12 * s(1.1); break;
    case "haul": { const k = s(4.5); p.armF = [1.15 + 0.5 * k, 0.8 + 0.5 * k]; p.armB = [1.0 + 0.5 * k, 0.7 + 0.5 * k]; p.lean = -0.25 * k; p.fl = [-9, 0]; p.fr = [8, 0]; break; }
    case "laugh": p.head = -0.3; p.lean = -0.18 + 0.05 * s(14); p.armF = [0.7, 1.7]; p.armB = [-0.3, -1.4]; p.mouth = 0.7 + 0.3 * s(16); p.bob = 2 * Math.abs(s(8)); break;
    case "menace": p.armF = [1.3 + 0.08 * s(1.5), 1.1]; p.armB = [-1.3, -1.1]; p.lean = 0.12; p.head = 0.1; p.fl = [-10, 0]; p.fr = [10, 0]; break;
    case "cower": p.squash = 0.8; p.bob = -8; p.lean = 0.3; p.armF = [2.6, 3.0]; p.armB = [-2.5, -2.9]; p.shake = 0.8; break;
    case "slash": { const k = (s(7) + 1) / 2; p.armF = [lerp(0.5, 2.5, k), lerp(0.7, 2.7, k)]; p.armB = [-0.6, -0.5]; p.lean = lerp(-0.1, 0.25, k); p.fl = [-9, 0]; p.fr = [9, 0]; break; }
    case "aim": p.armF = [1.5, 1.55]; p.armB = [1.35, 1.45]; p.lean = 0.1; p.head = 0.15; p.fl = [-8, 0]; p.fr = [8, 0]; break;
    case "scrape": { const k = s(6); p.lean = 0.5; p.armF = [1.0 + 0.4 * k, 1.1 + 0.4 * k]; p.armB = [0.8 - 0.3 * k, 0.9]; p.bob = -5; break; }
    case "surrender": p.armF = [2.9 + 0.1 * s(6), 3.1]; p.armB = [-2.9, -3.1]; p.lean = -0.1; p.shake = 0.4; break;
    case "fire": { const k = Math.max(0, 1 - tau * 3); p.armF = [1.1 + 0.4 * k, 1.35]; p.armB = [0.3, 0.4]; p.lean = 0.2 + 0.15 * k; p.fl = [-9, 0]; p.fr = [9, 0]; break; }
    case "salute": p.armF = [2.5, 3.5]; p.armB = [-0.2, -0.1]; p.head = 0.05; break;
    case "wave": p.armF = [2.7 + 0.35 * s(8), 3.0 + 0.5 * s(8, 1)]; p.armB = [-0.2, -0.1]; p.bob = 1.2 * Math.abs(s(5)); break;
    case "leap": p.armF = [2.4, 2.6]; p.armB = [-2.2, -2.5]; p.lean = 0.15; p.fl = [-9, 5]; p.fr = [9, 7]; p.mouth = 0.9; p.bob = 4; break;
    case "brace": p.bob = -4; p.armF = [1.4, 1.5]; p.armB = [-1.4, -1.5]; p.lean = 0.05 * s(2); p.fl = [-10, 0]; p.fr = [10, 0]; break;
    // --- dancing / walking / social ---
    case "dance1": { const k = s(7); p.armF = [2.3 + 0.5 * k, 2.5 + 0.6 * k]; p.armB = [-2.3 + 0.5 * k, -2.4 - 0.6 * k]; p.lean = 0.14 * k; p.head = 0.18 * k; p.bob = 3.5 * Math.abs(s(7)); p.fl = step(7, 6); p.fr = step(7, 6, Math.PI); p.mouth = 0.3; break; }
    case "dance2": { const k = s(5.2); p.armF = [1.5 + 0.9 * k, 1.9 + 0.9 * k]; p.armB = [-1.5 - 0.9 * k, -1.9 - 0.9 * k]; p.lean = 0.22 * k; p.head = -0.2 * k; p.bob = 2.5 * Math.abs(s(10.4)); p.fl = [-6 + 5 * k, Math.max(0, s(10.4)) * 5]; p.fr = [6 + 5 * k, Math.max(0, -s(10.4)) * 5]; break; }
    case "dance3": { const k = s(8.5); p.armF = [2.9, 3.1 + 0.4 * k]; p.armB = [0.6 + 0.4 * k, 1.6]; p.lean = 0.1 * s(4.2); p.head = 0.25 * s(4.2); p.bob = 5 * Math.abs(s(8.5)); p.fl = [-8, 0]; p.fr = [8, 7 * Math.max(0, s(8.5))]; p.squash = 0.96 + 0.04 * s(17); break; }
    case "walk": { const k = s(6); p.armF = [0.5 * k, 0.4 * k + 0.3]; p.armB = [-0.5 * k, -0.4 * k - 0.2]; p.bob = 1.4 * Math.abs(s(6)); p.lean = 0.05; p.fl = [-8 * k, Math.max(0, Math.cos(t * 6 + seed)) * 6]; p.fr = [8 * k, Math.max(0, -Math.cos(t * 6 + seed)) * 6]; break; }
    case "watch": p.armF = [0.6, 1.2]; p.armB = [-0.2, -0.1]; p.head = 0.08 * s(0.8); p.lean = -0.04; p.bob = 0.3 * s(1.5); break;
    case "talk": p.armF = [1.0 + 0.4 * s(3.1), 1.4 + 0.5 * s(3.1, 1)]; p.armB = [-0.3, -0.2]; p.head = 0.06 * s(2.2); p.mouth = 0.3 + 0.5 * Math.abs(s(13)); break;
    case "argue": p.armF = [1.6 + 0.4 * s(5), 1.7 + 0.4 * s(5, 1)]; p.armB = [-1.5 - 0.3 * s(4.3), -1.2]; p.lean = 0.1 * s(4); p.head = 0.1; p.mouth = 0.4 + 0.5 * Math.abs(s(12)); break;
    case "confused": p.armF = [2.5, 2.1]; p.armB = [0.2, 0.3]; p.head = 0.2 + 0.05 * s(2); p.lean = -0.03; break;
    case "play": p.armF = [1.2 + 0.18 * s(9), 1.4 + 0.25 * s(9, 1)]; p.armB = [0.9, 1.3 + 0.3 * s(9)]; p.lean = 0.06 * s(3); p.bob = 0.8 * Math.abs(s(4.5)); p.mouth = 0.2; break;
    default: p.armF = [0.2 + 0.03 * s(1.6), 0.3]; p.armB = [-0.15, -0.1]; p.bob = 0.4 * s(1.8);
  }
  return p;
};

const m2 = (a: [number, number], b: [number, number], k: number): [number, number] => [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
const mixPose = (a: Pose, b: Pose, k: number): Pose => ({
  lean: lerp(a.lean, b.lean, k), bob: lerp(a.bob, b.bob, k), armF: m2(a.armF, b.armF, k), armB: m2(a.armB, b.armB, k),
  head: lerp(a.head, b.head, k), mouth: lerp(a.mouth, b.mouth, k), brow: lerp(a.brow, b.brow, k), eyeWide: lerp(a.eyeWide, b.eyeWide, k),
  smile: lerp(a.smile, b.smile, k), squash: lerp(a.squash, b.squash, k), fl: m2(a.fl, b.fl, k), fr: m2(a.fr, b.fr, k),
  gaze: lerp(a.gaze, b.gaze, k), shake: lerp(a.shake, b.shake, k), hatTilt: lerp(a.hatTilt, b.hatTilt, k), browTilt: lerp(a.browTilt, b.browTilt, k),
});

export const poseAt = (actions: CharAction[], talk: [number, number][] | undefined, t: number, seed: number, sway: number): { pose: Pose; blink: number } => {
  let k = -1;
  for (let i = 0; i < actions.length; i++) if (actions[i].t <= t) k = i;
  const cur = k >= 0 ? actions[k] : { t: 0, a: "idle" as ActionName };
  const prev = k > 0 ? actions[k - 1] : { t: 0, a: "idle" as ActionName };
  const withExpr = (act: CharAction | { t: number; a: ActionName }, p: Pose) => {
    const e = (act as CharAction).expr ?? DEFAULT_EXPR[act.a] ?? "neutral";
    return { ...p, ...EXPR[e] } as Pose;
  };
  const A = withExpr(prev, actionPose(prev.a, t - prev.t, t, seed));
  const B = withExpr(cur, actionPose(cur.a, t - cur.t, t, seed));
  const pose = mixPose(A, B, ease("out", clamp((t - cur.t) / 0.3)));
  if ((cur as CharAction).gaze !== undefined) pose.gaze = (cur as CharAction).gaze!;
  const speaking = (talk ?? []).some(([a, b]) => t >= a && t <= b);
  if (speaking) pose.mouth = Math.max(pose.mouth, 0.2 + 0.7 * Math.abs(Math.sin(t * 17 + seed)) * (0.6 + 0.4 * Math.sin(t * 5.3)));
  pose.lean += sway * 0.7;
  const ph = (t * 0.9 + hash(seed) * 3) % 3.3;
  // nobody blinks while talking (reference rule): hold the eyes open through speech plus a short margin
  const holdOpen = (talk ?? []).some(([a, b]) => t >= a - 0.15 && t <= b + 0.15);
  return { pose, blink: !holdOpen && ph < 0.13 ? 1 : 0 };
};
