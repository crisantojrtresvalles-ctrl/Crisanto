#!/usr/bin/env node
// Self-test for the QC system: inject known defects into a copy of the episode and assert the QC catches each one.
//   node scripts/qc-selftest.mjs
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

fs.mkdirSync("out/qc", { recursive: true });
const entry = path.resolve("out/qc/.selftest-entry.ts");
fs.writeFileSync(entry, `export { runQC } from "../../src/history/qc/index";\nexport { pirates } from "../../src/history/episodes/pirates";\n`);
const outfile = path.resolve("out/qc/.selftest-bundle.mjs");
await build({ entryPoints: [entry], outfile, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", logLevel: "error" });
const { runQC, pirates } = await import(pathToFileURL(outfile).href + "?v=" + Date.now());

const clone = () => structuredClone(pirates);
const qc = (ep) => runQC(ep, { aspect: 720 / 1280, durations: null, audioFiles: null });
const has = (r, check, sev, re) => r.findings.some((f) => f.check === check && f.severity === sev && re.test(f.msg));
const base = qc(pirates);
let n = 0;
const test = (name, fn) => { try { fn(); n++; console.log("  ok   " + name); } catch (e) { console.error("  FAIL " + name + "\n       " + e.message); process.exitCode = 1; } };

test("baseline episode is analysed (shots, metrics present)", () => {
  assert.ok(base.shots.length >= 8); assert.equal(typeof base.metrics.cutsPer10s, "number");
});
test("removing a transition exposes a hard cut", () => {
  const ep = clone(); ep.transitions = ep.transitions.filter((t) => t.t !== 34.2);
  const r = qc(ep); assert.ok(r.findings.filter((f) => f.severity === "error" && /Hard cut/.test(f.msg)).length > base.findings.filter((f) => f.severity === "error" && /Hard cut/.test(f.msg)).length);
});
test("camera key pointing at an unknown entity is an error", () => {
  const ep = clone(); ep.cameras[3].target = "nope"; ep.cameras[3].rel = true;
  assert.ok(!qc(ep).ok);
});
test("camera sunk under the sea is an error", () => {
  const ep = clone(); ep.cameras = ep.cameras.map((k) => (k.t >= 8 && k.t <= 9 ? { ...k, target: undefined, pos: [400, -5, 0], look: [400, 3, 20] } : k));
  assert.ok(has(qc(ep), "camera", "error", /below the water/));
});
test("overlapping narration is an error", () => {
  const ep = clone(); ep.narration[1].start = ep.narration[0].end - 1;
  assert.ok(has(qc(ep), "script", "error", /overlaps/));
});
test("narration read too fast is flagged", () => {
  const ep = clone(); ep.narration[2].end = ep.narration[2].start + 2;
  assert.ok(has(qc(ep), "script", "warn", /too fast/));
});
test("missing story beat is an error", () => {
  const ep = clone(); ep.story.beats = ep.story.beats.filter((b) => b.kind !== "twist");
  assert.ok(has(qc(ep), "script", "error", /no "twist" beat/));
});
test("no story plan is flagged", () => {
  const ep = clone(); delete ep.story;
  assert.ok(has(qc(ep), "script", "warn", /no `story` plan/));
});
test("unknown protagonist is an error", () => {
  const ep = clone(); ep.story.protagonist = "ghost";
  assert.ok(has(qc(ep), "script", "error", /not a character/));
});
test("sudden unmasked light pop is flagged", () => {
  const ep = clone(); ep.atmo = ep.atmo.map((a) => (a.t >= 41.8 && a.t < 54 ? { ...a, sunI: 0.05, ambI: 0.1 } : a));
  assert.ok(qc(ep).findings.some((f) => f.check === "lighting" && f.severity !== "info"));
});
test("character outside the hull is an error", () => {
  const ep = clone(); ep.chars[0].local = [9, 1.5, 0];
  assert.ok(has(qc(ep), "scene", "error", /outside the .* hull/));
});
test("cannon event without sound cue is flagged", () => {
  const ep = clone(); ep.sfx = ep.sfx.filter((s) => s.file !== "cannon.wav");
  assert.ok(has(qc(ep), "audio", "warn", /cannon event/));
});
test("audio duration longer than its slot is caught when the manifest exists", () => {
  const ep = clone(); const d = Object.fromEntries(ep.narration.map((n) => [n.id, n.end - n.start])); d.n02 = 12;
  const r = runQC(ep, { aspect: 720 / 1280, durations: d, audioFiles: null });
  assert.ok(has(r, "audio", "error", /runs into/));
});
test("blink is suppressed while talking (engine fix)", () => {
  const ep = clone(); const ch = ep.chars.find((c) => c.talk && c.talk.length);
  if (!ch) return; // nothing to check in this episode
  assert.equal(qc(ep).findings.some((f) => /blink during/.test(f.msg)), false);
});
console.log(`\n${n} tests passed${process.exitCode ? ", SOME FAILED" : ""}`);
