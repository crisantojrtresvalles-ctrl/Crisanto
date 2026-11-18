import type { Episode } from "../types";
import type { CamState } from "../engine/camera";
import { sampleCamera } from "../engine/camera";
import type { Resolver } from "../engine/entities";
import { cross3, norm3, sub3, type Vec3 } from "../engine/math";
import type { Finding, Severity, Thresholds } from "./types";

export const DEFAULTS: Thresholds = {
  hookMaxStart: 1.0,
  settingMaxT: 15,
  paceMin: 1.5,
  paceMax: 3.6,
  firstFaceWarn: 8,
  firstFaceError: 15,
  faceFrac: 0.12,
  jumpSpeed: 120,
  jumpAngle: 12,
  hardCutWidths: 0.8,
  maskPad: 0.35,
  cutsPer10Warn: 1.5,
  fovRateMax: 60,
  sparseWarn: 1.5,
  sparseError: 3,
  minElements: 2,
  lightChange: 0.15,
  camClear: 0.6,
};

export interface Frame { i: number; t: number; cam: CamState }

export interface Ctx {
  ep: Episode;
  R: Resolver;
  aspect: number;
  th: Thresholds;
  frames: Frame[];
  dt: number;
  metrics: Record<string, number | string>;
  out: Finding[];
  add: (check: string, severity: Severity, msg: string, t?: number) => void;
}

export const sampleFrames = (ep: Episode, R: Resolver): Frame[] => {
  const n = Math.round(ep.durationSec * ep.fps);
  const out: Frame[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / ep.fps;
    out.push({ i, t, cam: sampleCamera(ep.cameras, t, R, ep.shakes) });
  }
  return out;
};

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Pinhole projection. Returns NDC x/y (-1..1 = inside the frame) and depth, or null if behind the camera. */
export const project = (cam: CamState, p: Vec3, aspect: number) => {
  const f = norm3(sub3(cam.look, cam.pos));
  const r = norm3(cross3(f, [0, 1, 0]));
  const u = cross3(r, f);
  const d = sub3(p, cam.pos);
  const z = dot(d, f);
  if (z <= 0.1) return null;
  const th = Math.tan((cam.fov * Math.PI) / 360);
  return { x: dot(d, r) / (z * th * aspect), y: dot(d, u) / (z * th), z, th };
};

export const inFrame = (pr: ReturnType<typeof project>, margin = 0) =>
  !!pr && Math.abs(pr.x) <= 1 + margin && Math.abs(pr.y) <= 1 + margin;

/** contiguous runs of `true` as [startIndex, endIndex] (inclusive) */
export const runs = (flags: boolean[]): [number, number][] => {
  const out: [number, number][] = [];
  let s = -1;
  flags.forEach((f, i) => {
    if (f && s < 0) s = i;
    if (!f && s >= 0) { out.push([s, i - 1]); s = -1; }
  });
  if (s >= 0) out.push([s, flags.length - 1]);
  return out;
};

export const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const fmt = (t: number) => t.toFixed(1) + "s";

export const parseHex = (h: string): [number, number, number] => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
export const luma = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** world height of a character billboard (matches Character.tsx: 2.55 * scale * 1.55) */
export const charHeight = (scale: number) => 2.55 * scale * 1.55;
