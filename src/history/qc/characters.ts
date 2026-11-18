import { DEFAULT_EXPR, poseAt, type Pose } from "../characters/pose";
import { charHeight, fmt, inFrame, project, type Ctx } from "./util";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const checkCharacters = (c: Ctx) => {
  const { ep } = c;
  const K = "characters";

  // ---------- consistency of the look (single source of truth per id) ----------
  for (const ch of ep.chars) {
    const L = ch.look;
    for (const f of ["skin", "coat", "shirt", "pants", "hatColor", "hair"] as const) if (!HEX.test(L[f])) c.add(K, "error", `"${ch.id}": look.${f} "${L[f]}" is not a #rrggbb colour.`);
    for (const f of ["sash", "apron"] as const) { const v = L[f]; if (v && !HEX.test(v)) c.add(K, "error", `"${ch.id}": look.${f} "${v}" is not a #rrggbb colour.`); }
    if (L.build < 0.85 || L.build > 1.3) c.add(K, "warn", `"${ch.id}": build ${L.build} is outside the shared proportion range 0.85-1.3.`);
    if (ch.scale < 0.5 || ch.scale > 1.3) c.add(K, "warn", `"${ch.id}": scale ${ch.scale} is outside the shared range 0.5-1.3.`);
  }
  const named = [ep.story?.protagonist, ...(ep.story?.supporting ?? [])].filter((x): x is string => !!x);
  for (let a = 0; a < named.length; a++) for (let b = a + 1; b < named.length; b++) {
    const A = ep.chars.find((x) => x.id === named[a]), B = ep.chars.find((x) => x.id === named[b]);
    if (A && B && A.look.coat === B.look.coat && A.look.hat === B.look.hat && A.look.hatColor === B.look.hatColor) c.add(K, "warn", `Named characters "${A.id}" and "${B.id}" look identical; viewers cannot tell them apart.`);
  }

  // ---------- action timelines ----------
  for (const ch of ep.chars) {
    if (!ch.actions.length) { c.add(K, "info", `"${ch.id}" has no actions (stands idle all film).`); continue; }
    for (let i = 1; i < ch.actions.length; i++) {
      const d = ch.actions[i].t - ch.actions[i - 1].t;
      if (d < 0) c.add(K, "error", `"${ch.id}": actions are out of order at ${fmt(ch.actions[i].t)}.`, ch.actions[i].t);
      else if (d < 0.35) c.add(K, "warn", `"${ch.id}": action "${ch.actions[i - 1].a}" lasts only ${d.toFixed(2)}s before "${ch.actions[i].a}"; the pose will flicker.`, ch.actions[i].t);
    }
    for (const w of ch.talk ?? []) if (w[1] - w[0] < 0.25) c.add(K, "warn", `"${ch.id}": talk window ${fmt(w[0])}-${fmt(w[1])} is shorter than 0.25s.`, w[0]);
  }
  // expression range for the named cast
  for (const id of named) {
    const ch = ep.chars.find((x) => x.id === id);
    if (!ch) continue;
    const ex = new Set(ch.actions.map((a) => a.expr ?? DEFAULT_EXPR[a.a] ?? "neutral"));
    if (ex.size < 2) c.add(K, "warn", `Named character "${id}" shows only ${ex.size} facial expression(s); the audience cannot read their feelings.`);
  }

  // ---------- performance rules from the reference films ----------
  let blinkFrames = 0, bounceFrames = 0, talkFrames = 0;
  for (const ch of ep.chars) for (const [a, b] of ch.talk ?? []) {
    for (let t = a; t <= b; t += 1 / ep.fps) {
      talkFrames++;
      const { pose, blink } = poseAt(ch.actions, ch.talk, t, 1, 0);
      if (blink) blinkFrames++;
      if (pose.bob > 1.5) bounceFrames++;
    }
  }
  c.metrics.talkFrames = talkFrames;
  if (blinkFrames) c.add(K, "warn", `Characters blink during ${blinkFrames} speaking frames; nobody blinks while talking in the reference films.`);
  if (bounceFrames) c.add(K, "warn", `Characters bounce during ${bounceFrames} speaking frames; reference films hold dead still once a character lands.`);

  // pose pops: a limb teleporting between frames, only while the character is on screen
  let pops = 0, last: { id: string; p: Pose } | null = null;
  for (const ch of ep.chars) {
    last = null;
    for (const f of c.frames) {
      const pos = c.R.charWorld(ch, f.t);
      const pr = project(f.cam, [pos[0], pos[1] + charHeight(ch.scale) / 2, pos[2]], c.aspect);
      if (!pr || pr.z > 90 || !inFrame(pr)) { last = null; continue; }
      const { pose } = poseAt(ch.actions, ch.talk, f.t, 1, 0);
      if (last && (Math.abs(pose.armF[0] - last.p.armF[0]) > 0.6 || Math.abs(pose.armB[0] - last.p.armB[0]) > 0.6 || Math.abs(pose.lean - last.p.lean) > 0.25)) {
        pops++;
        if (pops <= 5) c.add(K, "warn", `"${ch.id}" pops between poses at ${fmt(f.t)}.`, f.t);
      }
      last = { id: ch.id, p: pose };
    }
  }
  c.metrics.posePops = pops;
  c.add(K, "info", "Known gap: mouth movement is a procedural sine wave in poseAt(), not driven by the narration audio, so true lip-sync is not implemented yet.");
};
