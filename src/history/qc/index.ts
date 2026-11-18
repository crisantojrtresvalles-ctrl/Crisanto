import type { Episode } from "../types";
import { makeResolver } from "../engine/entities";
import { checkAudio } from "./audio";
import { checkCamera } from "./camera";
import { checkCharacters } from "./characters";
import { checkLighting } from "./light";
import { checkScene } from "./scene";
import { checkScript } from "./script";
import type { CheckSummary, Finding, QCOptions, QCReport, Severity, Shot } from "./types";
import { DEFAULTS, sampleFrames, type Ctx } from "./util";

export type { QCOptions, QCReport, Finding } from "./types";

const ORDER = ["script", "camera", "lighting", "scene", "characters", "audio"];

/** Runs every automated pre-render check on an episode. Pure data: no GPU, no DOM, no rendering. */
export const runQC = (ep: Episode, opts: QCOptions): QCReport => {
  const R = makeResolver(ep);
  const out: Finding[] = [];
  const metrics: Record<string, number | string> = {};
  const ctx: Ctx = {
    ep, R, aspect: opts.aspect, th: { ...DEFAULTS, ...opts.thresholds }, frames: [], dt: 1 / ep.fps, metrics, out,
    add: (check, severity: Severity, msg, t) => { out.push({ check, severity, msg, t }); },
  };
  let shots: Shot[] = [];

  const guard = (name: string, fn: () => void) => {
    try { fn(); } catch (e) { ctx.add(name, "error", `Check crashed: ${(e as Error).message}. The episode data is probably malformed.`); }
  };

  // The sampled frames need every camera target to resolve; report that clearly instead of throwing.
  try { ctx.frames = sampleFrames(ep, R); } catch (e) {
    ctx.add("camera", "error", `Cannot sample the camera: ${(e as Error).message}`);
  }
  guard("script", () => checkScript(ctx));
  if (ctx.frames.length) {
    guard("camera", () => { shots = checkCamera(ctx); });
    guard("scene", () => checkScene(ctx));
    guard("characters", () => checkCharacters(ctx));
  }
  guard("lighting", () => checkLighting(ctx));
  guard("audio", () => checkAudio(ctx, opts.durations, opts.audioFiles));

  const summary: CheckSummary[] = ORDER.map((check) => ({
    check,
    errors: out.filter((f) => f.check === check && f.severity === "error").length,
    warns: out.filter((f) => f.check === check && f.severity === "warn").length,
    infos: out.filter((f) => f.check === check && f.severity === "info").length,
  }));
  const rank = { error: 0, warn: 1, info: 2 } as const;
  out.sort((a, b) => ORDER.indexOf(a.check) - ORDER.indexOf(b.check) || rank[a.severity] - rank[b.severity] || (a.t ?? 0) - (b.t ?? 0));
  return { episode: ep.id, ok: !out.some((f) => f.severity === "error"), summary, metrics, shots, transitions: ep.transitions.map((x) => ({ t: x.t, dur: x.dur })), findings: out };
};

const ICON = { error: "ERROR", warn: "warn ", info: "info " } as const;
export const formatReport = (r: QCReport): string => {
  const L: string[] = [];
  L.push(`QC report: ${r.episode}   ->   ${r.ok ? "PASS (no errors)" : "FAIL"}`);
  L.push("");
  L.push("check       errors  warns  infos");
  for (const s of r.summary) L.push(`${s.check.padEnd(11)} ${String(s.errors).padStart(6)} ${String(s.warns).padStart(6)} ${String(s.infos).padStart(6)}`);
  L.push("");
  L.push("metrics: " + Object.entries(r.metrics).map(([k, v]) => `${k}=${v}`).join("  "));
  L.push("");
  L.push("shots: " + r.shots.map((s) => `${s.start.toFixed(1)}-${s.end.toFixed(1)} ${s.type}${s.exit === "hard" ? " [HARD CUT]" : ""}`).join(" | "));
  L.push("");
  let cur = "";
  for (const f of r.findings) {
    if (f.check !== cur) { cur = f.check; L.push(`[${cur}]`); }
    L.push(`  ${ICON[f.severity]} ${f.t !== undefined ? `@${f.t.toFixed(1)}s ` : ""}${f.msg}`);
  }
  return L.join("\n");
};
