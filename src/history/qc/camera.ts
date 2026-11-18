import { waveHeight } from "../world/waves";
import { hgt } from "../world/Island";
import { len3, norm3, sub3 } from "../engine/math";
import type { Shot } from "./types";
import { charHeight, fmt, inFrame, median, project, runs, type Ctx } from "./util";

/** Largest character-height fraction of the frame among characters in view at frame i. */
export const faceFraction = (c: Ctx, i: number) => {
  const f = c.frames[i];
  let best = 0;
  for (const ch of c.ep.chars) {
    const p = c.R.charWorld(ch, f.t);
    const H = charHeight(ch.scale);
    const pr = project(f.cam, [p[0], p[1] + H * 0.5, p[2]], c.aspect);
    if (!pr || pr.z > 120 || !inFrame(pr, 0.05)) continue;
    best = Math.max(best, H / (2 * pr.z * pr.th));
  }
  return best;
};

export const checkCamera = (c: Ctx): Shot[] => {
  const { ep, frames, th } = c;
  const K = "camera";
  const fps = ep.fps;

  // ---- keyframe structure ----
  const ks = ep.cameras;
  if (ks.length < 2) { c.add(K, "error", "Fewer than 2 camera keys."); return []; }
  for (let i = 1; i < ks.length; i++) if (ks[i].t <= ks[i - 1].t) c.add(K, "error", `Camera keys are not strictly increasing at ${fmt(ks[i].t)}.`, ks[i].t);
  if (ks[0].t > 0.01) c.add(K, "error", `First camera key is at ${fmt(ks[0].t)}, not 0.`);
  if (ks[ks.length - 1].t < ep.durationSec - 0.01) c.add(K, "error", `Last camera key (${fmt(ks[ks.length - 1].t)}) is before the end of the film.`);
  for (const k of ks) {
    if (k.fov < 15 || k.fov > 100) c.add(K, "warn", `FOV ${k.fov}° at ${fmt(k.t)} is outside the natural 15-100° lens range${k.fov > 100 ? " (fisheye distortion)" : ""}.`, k.t);
  }

  // ---- per-frame motion: scene jumps, zoom smoothness, framing safety ----
  const jumpFlag: boolean[] = [];
  const jumpMag: { m: number; deg: number }[] = [];
  const fovFlag: boolean[] = [];
  for (let i = 0; i < frames.length; i++) {
    if (i === 0) { jumpFlag.push(false); jumpMag.push({ m: 0, deg: 0 }); fovFlag.push(false); continue; }
    const a = frames[i - 1].cam, b = frames[i].cam;
    const speed = len3(sub3(b.pos, a.pos)) * fps;
    const fa = norm3(sub3(a.look, a.pos)), fb = norm3(sub3(b.look, b.pos));
    const deg = (Math.acos(Math.max(-1, Math.min(1, fa[0] * fb[0] + fa[1] * fb[1] + fa[2] * fb[2]))) * 180) / Math.PI;
    jumpFlag.push(speed > th.jumpSpeed || deg > th.jumpAngle);
    jumpMag.push({ m: speed / fps, deg });
    fovFlag.push(Math.abs(b.fov - a.fov) * fps > th.fovRateMax);
  }

  // group jump frames into events (merge frames < 0.4s apart)
  const events: { t0: number; t1: number; m: number; deg: number }[] = [];
  for (const [s, e] of runs(jumpFlag)) {
    const last = events[events.length - 1];
    const ev = { t0: frames[s].t, t1: frames[e].t, m: Math.max(...jumpMag.slice(s, e + 1).map((x) => x.m)), deg: Math.max(...jumpMag.slice(s, e + 1).map((x) => x.deg)) };
    if (last && ev.t0 - last.t1 < 0.4) { last.t1 = ev.t1; last.m = Math.max(last.m, ev.m); last.deg = Math.max(last.deg, ev.deg); } else events.push(ev);
  }

  let masked = 0, hard = 0;
  const exits: ("masked" | "hard")[] = [];
  for (const ev of events) {
    const cover = ep.transitions.find((tr) => ev.t1 >= tr.t - tr.dur / 2 - th.maskPad && ev.t0 <= tr.t + tr.dur / 2 + th.maskPad);
    if (cover) { masked++; exits.push("masked"); }
    else {
      const hFov = 2 * Math.atan(Math.tan((frames[Math.round(ev.t0 * fps)].cam.fov * Math.PI) / 360) * c.aspect) * (180 / Math.PI);
      const widths = ev.deg / hFov;
      const what = `in one frame the camera moves ${ev.m.toFixed(1)} m and turns ${ev.deg.toFixed(0)}° (${widths.toFixed(1)} frame widths) with no transition covering it`;
      if (widths >= th.hardCutWidths || ev.m > 20) {
        hard++; exits.push("hard");
        c.add(K, "error", `Hard cut at ${fmt(ev.t0)}: ${what}. Slow the move, extend the segment, or add an object wipe.`, ev.t0);
      } else {
        masked++; exits.push("masked");
        c.add(K, "warn", `Violent whip-pan at ${fmt(ev.t0)}: ${what}. The content smears and reads close to a cut; lengthen the move.`, ev.t0);
      }
    }
  }
  for (const [s, e] of runs(fovFlag)) {
    const t = frames[s].t;
    if (events.some((ev) => t >= ev.t0 - 0.3 && t <= ev.t1 + 0.3)) continue;
    c.add(K, "warn", `Zoom at ${fmt(t)}-${fmt(frames[e].t)} changes faster than ${th.fovRateMax}°/s; it will look like a pop, not a smooth zoom.`, t);
  }

  // ---- shots ----
  const bounds = [0, ...events.map((e) => (e.t0 + e.t1) / 2), ep.durationSec];
  const shots: Shot[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const i0 = Math.round(bounds[i] * fps), i1 = Math.min(frames.length - 1, Math.round(bounds[i + 1] * fps) - 1);
    const fr: number[] = [];
    for (let j = i0; j <= i1; j += 3) fr.push(faceFraction(c, j));
    fr.sort((a, b) => a - b);
    const p75 = fr.length ? fr[Math.floor(fr.length * 0.75)] : 0;
    const midCam = frames[Math.min(frames.length - 1, Math.round((i0 + i1) / 2))].cam;
    const dist = len3(sub3(midCam.look, midCam.pos));
    const type: Shot["type"] = p75 >= 0.45 ? "close-up" : p75 >= 0.15 ? "medium" : dist < 22 ? "detail" : "wide";
    shots.push({ start: bounds[i], end: bounds[i + 1], type, exit: i < events.length ? exits[i] : "end" });
  }
  const lens = shots.map((s) => s.end - s.start);
  c.metrics.shots = shots.length;
  c.metrics.medianShotSec = +median(lens).toFixed(1);
  c.metrics.sceneJumps = events.length;
  c.metrics.hardCuts = hard;
  c.metrics.maskedJumps = masked;
  const rate = (events.length / ep.durationSec) * 10;
  c.metrics.cutsPer10s = +rate.toFixed(2);
  for (const t of ["wide", "medium", "close-up", "detail"] as const) c.metrics["shots_" + t] = shots.filter((s) => s.type === t).length;
  if (rate > th.cutsPer10Warn) c.add(K, "warn", `${rate.toFixed(1)} scene changes per 10s (limit ${th.cutsPer10Warn}); the reference films average 0.4 with ~13s shots. Merge scenes or link them with continuous camera moves.`);
  for (const t of ["wide", "medium", "close-up"] as const) if (!shots.some((s) => s.type === t)) c.add(K, "warn", `No ${t} shot in the whole film; shot variety is missing.`);

  // ---- movement vocabulary (info) ----
  const tracking = ks.filter((k) => k.target && k.rel).length;
  const whips = ks.filter((k) => k.whip).length;
  let zooms = 0;
  for (let i = 1; i < ks.length; i++) if (Math.abs(ks[i].fov - ks[i - 1].fov) >= 8) zooms++;
  c.metrics.cam_tracking = tracking; c.metrics.cam_whipPans = whips; c.metrics.cam_zooms = zooms;
  if (!tracking) c.add(K, "warn", "No tracking (entity-relative) camera keys; the camera never follows a subject.");

  // ---- first face on screen ----
  let firstFace = -1;
  for (let i = 0; i < frames.length; i += 2) if (faceFraction(c, i) >= th.faceFrac) { firstFace = frames[i].t; break; }
  c.metrics.firstFaceSec = firstFace < 0 ? "never" : +firstFace.toFixed(1);
  if (firstFace < 0) c.add(K, "error", "No character face is ever on screen.");
  else if (firstFace > th.firstFaceError) c.add(K, "error", `First character face appears at ${fmt(firstFace)}; viewers need a face within ${th.firstFaceWarn}s.`, firstFace);
  else if (firstFace > th.firstFaceWarn) c.add(K, "warn", `First character face appears at ${fmt(firstFace)} (aim for under ${th.firstFaceWarn}s).`, firstFace);

  // ---- camera safety: clipping, underwater, inside terrain ----
  // frames fully covered by a wipe hide any camera hazard
  const covered = frames.map((f) => ep.transitions.some((tr) => Math.abs(f.t - tr.t) <= tr.dur / 2));
  const hit = { water: [] as boolean[], skim: [] as boolean[], island: [] as boolean[], terrainSkim: [] as boolean[], clip: [] as boolean[] };
  for (const f of frames) {
    const [x, y, z] = f.cam.pos;
    const w = waveHeight(x, z, f.t, c.R.stormAt(f.t));
    const cv = covered[f.i];
    hit.water.push(!cv && y < w - 0.05);
    hit.skim.push(!cv && y >= w - 0.05 && y < w + 0.15);
    let inside = false, skim = false;
    for (const s of ep.islands) {
      const dx = x - s.at[0], dz = z - s.at[1];
      if (Math.hypot(dx, dz) >= s.radius) continue;
      const h = hgt(s, dx, dz);
      if (y < h - 0.05) inside = true; else if (y < h + 0.3) skim = true;
    }
    hit.island.push(!cv && inside); hit.terrainSkim.push(!cv && skim && !inside);
    hit.clip.push(!cv && ep.chars.some((ch) => { const p = c.R.charWorld(ch, f.t); return Math.hypot(p[0] - x, p[2] - z) < th.camClear && y > p[1] && y < p[1] + charHeight(ch.scale); }));
  }
  for (const [s, e] of runs(hit.water)) c.add(K, e - s + 1 >= 6 ? "error" : "warn", `Camera is below the water surface at ${fmt(frames[s].t)} for ${((e - s + 1) / fps).toFixed(2)}s${e - s + 1 >= 6 ? "" : " (brief flicker)"}.`, frames[s].t);
  for (const [s, e] of runs(hit.island)) c.add(K, e - s + 1 >= 6 ? "error" : "warn", `Camera is inside island terrain at ${fmt(frames[s].t)} for ${((e - s + 1) / fps).toFixed(2)}s; the frame will be a blank wash.`, frames[s].t);
  for (const [s] of runs(hit.skim)) c.add(K, "warn", `Camera skims the water surface at ${fmt(frames[s].t)} (< 0.15 m above a wave crest); it may clip into the swell.`, frames[s].t);
  for (const [s] of runs(hit.terrainSkim)) c.add(K, "warn", `Camera skims island terrain at ${fmt(frames[s].t)} (< 0.3 m clearance).`, frames[s].t);
  for (const [s] of runs(hit.clip)) c.add(K, "warn", `Camera passes within ${th.camClear} m of a character at ${fmt(frames[s].t)} (the billboard will fill or clip the frame).`, frames[s].t);

  return shots;
};
