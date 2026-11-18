import type { BeatKind } from "../types";
import { fmt, inFrame, project, type Ctx } from "./util";
import { charHeight } from "./util";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const YEAR = /\b(1[0-9]{3}|20[0-9]{2})\b/;

/** Scene boundaries = transition centres; scenes are the spans between them. */
export const scenesOf = (c: Ctx): { start: number; end: number }[] => {
  const cuts = [0, ...c.ep.transitions.map((x) => x.t).sort((a, b) => a - b), c.ep.durationSec];
  const out: { start: number; end: number }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) if (cuts[i + 1] - cuts[i] > 0.05) out.push({ start: cuts[i], end: cuts[i + 1] });
  return out;
};

export const checkScript = (c: Ctx) => {
  const { ep, th } = c;
  const N = ep.narration;
  const K = "script";

  if (!N.length) { c.add(K, "error", "Episode has no narration."); return; }
  if (Math.abs(ep.durationSec - 60) > 1.5) c.add(K, "warn", `Runtime is ${ep.durationSec}s; the target is 60s.`);

  // --- immediate hook ---
  const first = N[0];
  if (first.start > th.hookMaxStart) c.add(K, "warn", `Narration starts at ${fmt(first.start)}; the hook should start within ${th.hookMaxStart}s.`, first.start);
  const firstSentence = first.text.split(/(?<=[.?!])\s/)[0] ?? first.text;
  if (!/\?|\d|!/.test(firstSentence)) c.add(K, "warn", `Opening line is not an obvious hook (no question, number or exclamation): "${firstSentence}"`, first.start);

  // --- clear historical setting ---
  let yearAt: number | null = null;
  for (const n of N) if (YEAR.test(n.text)) { yearAt = n.start; break; }
  if (yearAt === null) c.add(K, "warn", "No year is ever spoken, so the historical setting is not anchored in time.");
  else if (yearAt > th.settingMaxT) c.add(K, "warn", `The historical setting (a year) is first spoken at ${fmt(yearAt)}; viewers should know when/where within ${th.settingMaxT}s.`, yearAt);
  c.metrics.settingSpokenAt = yearAt === null ? "never" : yearAt.toFixed(1);

  // --- narration timing and pace ---
  let spoken = 0;
  N.forEach((n, i) => {
    if (n.end <= n.start) c.add(K, "error", `Narration ${n.id} has end <= start.`, n.start);
    if (n.end > ep.durationSec - 0.3) c.add(K, "error", `Narration ${n.id} runs past the end fade (${fmt(n.end)}).`, n.end);
    const w = words(n.text);
    const wps = w / Math.max(0.01, n.end - n.start);
    spoken += n.end - n.start;
    if (wps > th.paceMax) c.add(K, "warn", `${n.id}: ${wps.toFixed(1)} words/s is too fast to read or follow (max ${th.paceMax}).`, n.start);
    if (wps < th.paceMin) c.add(K, "warn", `${n.id}: ${wps.toFixed(1)} words/s leaves dead air (min ${th.paceMin}).`, n.start);
    const next = N[i + 1];
    if (next && next.start < n.end) c.add(K, "error", `${n.id} overlaps ${next.id}.`, next.start);
  });
  c.metrics.narrationCoverage = +(spoken / ep.durationSec).toFixed(2);
  c.metrics.narrationWords = N.reduce((a, n) => a + words(n.text), 0);
  if (spoken / ep.durationSec < 0.55) c.add(K, "warn", `Narration covers only ${Math.round((100 * spoken) / ep.durationSec)}% of the runtime.`);

  // --- scenes must have a purpose (no filler) ---
  const scenes = scenesOf(c);
  c.metrics.scenes = scenes.length;
  scenes.forEach((s, i) => {
    const covered = N.reduce((a, n) => a + Math.max(0, Math.min(n.end, s.end) - Math.max(n.start, s.start)), 0);
    if (covered < 0.5 * (s.end - s.start)) c.add(K, "warn", `Scene ${i + 1} (${fmt(s.start)}-${fmt(s.end)}) is only ${Math.round((100 * covered) / (s.end - s.start))}% narrated; is it filler?`, s.start);
    if (ep.story) {
      const hasBeat = ep.story.beats.some((b) => b.t >= s.start - 1.5 && b.t < s.end);
      if (!hasBeat) c.add(K, "info", `Scene ${i + 1} (${fmt(s.start)}-${fmt(s.end)}) is not linked to a story beat.`, s.start);
    }
  });
  // scene changes mid-sentence are legal, but report them so they are a conscious choice
  for (const tr of ep.transitions) {
    const nearest = Math.min(...N.flatMap((n) => [Math.abs(n.start - tr.t), Math.abs(n.end - tr.t)]));
    if (nearest > 0.9) c.add(K, "info", `Scene change at ${fmt(tr.t)} falls mid-sentence (nearest narration boundary ${nearest.toFixed(1)}s away).`, tr.t);
  }

  // --- story plan ---
  const S = ep.story;
  if (!S) { c.add(K, "warn", "Episode has no `story` plan, so the arc (hook, setting, conflict, twist, resolution) cannot be verified."); return; }
  const need: BeatKind[] = ["hook", "setting", "conflict", "twist", "resolution"];
  for (const k of need) if (!S.beats.some((b) => b.kind === k)) c.add(K, "error", `Story plan has no "${k}" beat.`);
  const order: BeatKind[] = ["hook", "setting", "conflict", "escalation", "twist", "resolution"];
  const rank = (k: BeatKind) => order.indexOf(k);
  const bs = [...S.beats].sort((a, b) => a.t - b.t);
  for (let i = 1; i < bs.length; i++) if (rank(bs[i].kind) < rank(bs[i - 1].kind)) c.add(K, "warn", `Beat "${bs[i].kind}" (${fmt(bs[i].t)}) comes after "${bs[i - 1].kind}" (${fmt(bs[i - 1].t)}); the arc is out of order.`, bs[i].t);
  const at = (k: BeatKind) => S.beats.find((b) => b.kind === k)?.t;
  const hook = at("hook"), twist = at("twist"), res = at("resolution");
  if (hook !== undefined && hook > 2) c.add(K, "warn", `Hook beat is at ${fmt(hook)}; it should be in the first 2s.`, hook);
  if (twist !== undefined && (twist < ep.durationSec * 0.55 || twist > ep.durationSec * 0.92)) c.add(K, "warn", `Twist at ${fmt(twist)} is outside the 55-92% window (${fmt(ep.durationSec * 0.55)}-${fmt(ep.durationSec * 0.92)}); suspense will not land.`, twist);
  if (res !== undefined && res < ep.durationSec - 12) c.add(K, "warn", `Resolution starts at ${fmt(res)}, more than 12s before the end.`, res);

  // --- protagonist and supporting cast ---
  const ids = new Set(ep.chars.map((x) => x.id));
  if (!S.protagonist) c.add(K, "warn", "Story plan names no protagonist.");
  else if (!ids.has(S.protagonist)) c.add(K, "error", `Protagonist "${S.protagonist}" is not a character in this episode.`);
  for (const s of S.supporting ?? []) if (!ids.has(s)) c.add(K, "error", `Supporting character "${s}" does not exist.`);
  if ((S.supporting ?? []).length < 1) c.add(K, "warn", "Story plan lists no supporting characters.");

  if (S.protagonist && ids.has(S.protagonist)) {
    const ch = ep.chars.find((x) => x.id === S.protagonist)!;
    const H = charHeight(ch.scale);
    const perScene = scenes.map((s) => {
      let n = 0;
      for (const f of c.frames) {
        if (f.t < s.start || f.t >= s.end || f.i % 3) continue;
        const p = c.R.charWorld(ch, f.t);
        const pr = project(f.cam, [p[0], p[1] + H / 2, p[2]], c.aspect);
        if (inFrame(pr) && pr!.z < 120) n += 3 / ep.fps;
      }
      return n;
    });
    const present = perScene.filter((x) => x >= 1).length;
    c.metrics.protagonistScenes = `${present}/${scenes.length}`;
    if (present < Math.min(3, scenes.length)) c.add(K, "warn", `Protagonist "${S.protagonist}" is on screen in only ${present} of ${scenes.length} scenes; the audience cannot follow a character who barely appears.`);
  }
};
