import type { AtmoKey } from "../types";
import { fmt, luma, parseHex, runs, type Ctx } from "./util";

const keyLight = (k: AtmoKey) => k.sunI * luma(parseHex(k.sunCol)) + k.ambI * luma(parseHex(k.ambSky));
const warmth = (k: AtmoKey) => { const [r, , b] = parseHex(k.sunCol); return r - b; };

export const checkLighting = (c: Ctx) => {
  const { ep, th } = c;
  const K = "lighting";
  const keys = ep.atmo;
  if (keys.length < 2) { c.add(K, "error", "Fewer than 2 atmosphere keys; lighting never changes."); return; }
  for (let i = 1; i < keys.length; i++) if (keys[i].t < keys[i - 1].t) c.add(K, "error", `Atmosphere keys out of order at ${fmt(keys[i].t)}.`, keys[i].t);
  if (keys[0].t > 0.01) c.add(K, "error", "First atmosphere key is not at t=0.");
  if (keys[keys.length - 1].t < ep.durationSec - 1.5) c.add(K, "warn", `Last atmosphere key is at ${fmt(keys[keys.length - 1].t)}; lighting is held flat to the end.`);

  // intentional light in every second: a directional source with a readable angle
  const flat = keys.map((k) => k.sunI < 0.3);
  runs(flat).forEach(([s, e]) => c.add(K, "warn", `Very weak directional light around ${fmt(keys[s].t)}-${fmt(keys[e].t)} (sunI < 0.3). Night scenes need environmental light sources, which the engine does not have yet.`, keys[s].t));
  for (const k of keys) if (k.sunElev < 0.02 && k.sunI > 0.3) c.add(K, "warn", `Sun is on the horizon (elev ${k.sunElev}) at ${fmt(k.t)}: shadows will be unreadably long.`, k.t);

  // light changes: crossfades between keys that differ strongly
  const changes: { t: number; mag: number; gradual: boolean }[] = [];
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (b.t - a.t < 1e-3) continue;
    const la = keyLight(a), lb = keyLight(b);
    const rel = Math.abs(lb - la) / Math.max(la, lb, 1e-3);
    const col = Math.abs(warmth(a) - warmth(b)) * 0.8;
    const mag = Math.max(rel, col);
    if (mag >= th.lightChange) changes.push({ t: (a.t + b.t) / 2, mag, gradual: b.t - a.t > 2.5 });
  }
  c.metrics.lightChanges = changes.length;
  // a light change with no scene change under it is a continuity error (the sky would visibly "pop")
  for (const ch of changes) {
    if (ch.gradual) continue; // a slow drift over > 2.5 s reads as time passing, not as a pop
    const covered = ep.transitions.some((tr) => Math.abs(tr.t - ch.t) <= tr.dur / 2 + 1.0);
    if (!covered) c.add(K, ch.mag > 0.4 ? "error" : "warn", `Lighting shifts by ${(ch.mag * 100).toFixed(0)}% at ${fmt(ch.t)} with no scene change to hide it.`, ch.t);
  }
  // light should change when the story turns
  for (const b of ep.story?.beats ?? []) {
    if (b.kind !== "conflict" && b.kind !== "twist" && b.kind !== "escalation") continue;
    if (!changes.some((x) => Math.abs(x.t - b.t) <= 2.5)) c.add(K, "warn", `The "${b.kind}" beat at ${fmt(b.t)} (${b.note}) has no lighting change within 2.5s; the light should turn with the story.`, b.t);
  }
  // colour mood variety
  const warm = keys.filter((k) => warmth(k) > 0.25).length;
  const cool = keys.filter((k) => warmth(k) <= 0.25).length;
  c.metrics.lightWarmKeys = warm; c.metrics.lightCoolKeys = cool;
  if (!warm || !cool) c.add(K, "warn", `Only ${warm ? "warm" : "cool"} sun colours are used; mix warm and cool light for contrast.`);
  const lows = keys.filter((k) => k.sunElev < 0.35 && k.sunI > 0.3).length;
  c.metrics.lowSunKeys = lows;
  if (!lows) c.add(K, "warn", "No low-sun key: shadows are never long and dramatic.");
};
