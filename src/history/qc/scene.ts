import { SHIP_DIMS } from "../engine/entities";
import type { Vec3 } from "../engine/math";
import { charHeight, fmt, inFrame, project, runs, type Ctx } from "./util";

export const checkScene = (c: Ctx) => {
  const { ep, th, frames, R } = c;
  const K = "scene";

  // ---------- environment consistency (references, ordering, scale) ----------
  const shipIds = new Set(ep.ships.map((s) => s.id));
  const charIds = new Set(ep.chars.map((s) => s.id));
  const dup = (a: string[], what: string) => { const s = new Set<string>(); for (const x of a) { if (s.has(x)) c.add(K, "error", `Duplicate ${what} id "${x}".`); s.add(x); } };
  dup(ep.ships.map((s) => s.id), "ship"); dup(ep.chars.map((s) => s.id), "character"); dup(ep.islands.map((s) => s.id), "island");
  for (const id of charIds) if (shipIds.has(id)) c.add(K, "error", `"${id}" is both a ship and a character; camera targets would be ambiguous.`);
  const known = (id: string) => shipIds.has(id) || charIds.has(id);
  for (const k of ep.cameras) for (const id of [k.target, k.lookTarget]) if (id && !known(id)) c.add(K, "error", `Camera key at ${fmt(k.t)} targets unknown entity "${id}".`, k.t);
  for (const ch of ep.chars) {
    if (ch.ship && !shipIds.has(ch.ship)) c.add(K, "error", `Character "${ch.id}" stands on unknown ship "${ch.ship}".`);
    for (const m of ch.moves ?? []) if (!shipIds.has(m.ship)) c.add(K, "error", `Character "${ch.id}" moves to unknown ship "${m.ship}".`);
  }
  for (const e of ep.fx) for (const id of [e.ship, e.target]) if (id && !shipIds.has(id)) c.add(K, "error", `FX event at ${fmt(e.t)} references unknown ship "${id}".`, e.t);
  for (const tr of ep.transitions) if (tr.t - tr.dur / 2 < 0 || tr.t + tr.dur / 2 > ep.durationSec) c.add(K, "error", `Transition at ${fmt(tr.t)} runs outside the film.`, tr.t);
  for (const s of ep.ships) {
    const sc = s.scale ?? 1;
    if (sc < 0.5 || sc > 2) c.add(K, "warn", `Ship "${s.id}" scale ${sc} breaks realistic proportions against other ships and characters.`);
  }
  for (const i of ep.islands) if (i.radius < 15) c.add(K, "warn", `Island "${i.id}" radius ${i.radius} m is smaller than a ship's length.`);
  // known engine limitation, reported every time so it is never forgotten
  c.add(K, "info", "World catalog: ocean, sky, ships, islands (palms / houses / fort) and gulls only. Streets, buildings, interiors, furniture and props are not supported yet.");

  // ---------- character positioning ----------
  for (const ch of ep.chars) {
    if (ch.ship) {
      const ship = ep.ships.find((s) => s.id === ch.ship);
      if (!ship) continue;
      const { L, B } = SHIP_DIMS[ship.kind];
      const [x, y, z] = ch.local;
      if (Math.abs(x) > (B / 2) * 1.15 || Math.abs(z) > (L / 2) * 1.1) c.add(K, "error", `"${ch.id}" stands outside the ${ship.kind} hull footprint (local ${x}, ${z}).`);
      if (y < -0.5 || y > 12) c.add(K, "warn", `"${ch.id}" is at deck height ${y} m, which is implausible for a ${ship.kind}.`);
    } else if (ep.islands.length) {
      const near = ep.islands.some((i) => Math.hypot(ch.local[0] - i.at[0], ch.local[2] - i.at[1]) <= i.radius * 1.15);
      if (!near) c.add(K, "warn", `"${ch.id}" has no ship and is not on an island; it would float on the sea.`);
    }
  }
  for (let a = 0; a < ep.chars.length; a++) for (let b = a + 1; b < ep.chars.length; b++) {
    const A = ep.chars[a], B = ep.chars[b];
    if (A.ship && A.ship === B.ship && Math.hypot(A.local[0] - B.local[0], A.local[1] - B.local[1], A.local[2] - B.local[2]) < 0.35) c.add(K, "warn", `"${A.id}" and "${B.id}" stand on top of each other on ${A.ship}.`);
  }

  // ---------- scene density ----------
  const step = Math.max(1, Math.round(ep.fps / 4));
  const idx: number[] = [];
  for (let i = 0; i < frames.length; i += step) idx.push(i);
  const counts = idx.map((i) => {
    const f = frames[i];
    const seen = new Set<string>();
    for (const s of ep.ships) {
      const st = R.shipAt(s.id, f.t);
      const { L } = SHIP_DIMS[s.kind];
      const fx = Math.sin(st.heading), fz = Math.cos(st.heading);
      for (const k of [-0.4, 0, 0.4]) {
        const pr = project(f.cam, [st.x + fx * L * k, st.y + 3, st.z + fz * L * k] as Vec3, c.aspect);
        if (pr && pr.z < 450 && inFrame(pr, 0.15)) { seen.add("s:" + s.id); break; }
      }
    }
    for (const isl of ep.islands) {
      const pr = project(f.cam, [isl.at[0], isl.peak * 0.4, isl.at[1]], c.aspect);
      if (pr && pr.z < 700 && inFrame(pr, 0.6)) seen.add("i:" + isl.id);
    }
    for (const ch of ep.chars) {
      const p = R.charWorld(ch, f.t);
      const pr = project(f.cam, [p[0], p[1] + charHeight(ch.scale) / 2, p[2]], c.aspect);
      if (pr && pr.z < 90 && inFrame(pr)) { seen.add("c:" + ch.id); if (ch.ship) seen.add("s:" + ch.ship); }
    }
    for (const [gi, g] of ep.gulls.entries()) { const pr = project(f.cam, g.at, c.aspect); if (pr && pr.z < 150 && inFrame(pr)) seen.add("g:" + gi); }
    for (const e of ep.fx) if (Math.abs(e.t - f.t) < 1) seen.add("x:" + e.kind);
    return seen.size;
  });
  const dtc = step / ep.fps;
  const sparse = counts.map((n) => n < th.minElements);
  for (const [s, e] of runs(sparse)) {
    const dur = (e - s + 1) * dtc;
    if (dur >= th.sparseWarn) c.add(K, dur >= th.sparseError ? "error" : "warn", `Sparse frame for ${dur.toFixed(1)}s at ${fmt(frames[idx[s]].t)}: fewer than ${th.minElements} scene elements in view (looks like empty sea / sky).`, frames[idx[s]].t);
  }
  c.metrics.avgSceneElements = +(counts.reduce((a, b) => a + b, 0) / counts.length).toFixed(1);
  c.metrics.sparseSeconds = +(sparse.filter(Boolean).length * dtc).toFixed(1);
};
