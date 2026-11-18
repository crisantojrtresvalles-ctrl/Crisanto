#!/usr/bin/env node
// Pixel-level QC. Renders plain (overlay-free) stills of the actual 3D world and measures them with ffmpeg:
// blank / washed-out frames, flat lighting, missing surface detail. Needs Chromium + ffmpeg (both present in CI).
//   node scripts/qc-frames.mjs                    -> a still every 2 s
//   node scripts/qc-frames.mjs --every 1 --strict
//   node scripts/qc-frames.mjs --at 3.6,16.2      -> only these times (seconds)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";

const args = process.argv.slice(2);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const every = Number(val("--every", 2));
const fps = 30, dur = 60;
const times = val("--at", null) ? val("--at").split(",").map(Number) : Array.from({ length: Math.floor(dur / every) }, (_, i) => +(0.5 + i * every).toFixed(2)).filter((t) => t < dur - 0.4);
const GL = process.env.GL ?? "swangle";
const OUT = "out/qc/frames";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const chrome = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/usr/bin/google-chrome"].find((p) => p && fs.existsSync(p));
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
const browser = await openBrowser("chrome", { browserExecutable: chrome ?? undefined, chromiumOptions: { gl: GL } });
const inputProps = { durations: null, audio: false, plain: true };
const comp = await selectComposition({ serveUrl, id: "History", inputProps, puppeteerInstance: browser });

// ---- measurement: luma percentiles + edge density, via ffmpeg signalstats ----
const stats = (file) => {
  const run = (vf) => execFileSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=240:-1,${vf},signalstats,metadata=print:file=-`, "-f", "null", "-"], { encoding: "utf8" });
  const pick = (txt, k) => Number(new RegExp(`lavfi.signalstats.${k}=([0-9.]+)`).exec(txt)?.[1] ?? NaN);
  const a = run("format=yuv420p"), e = run("edgedetect=low=0.08:high=0.2,format=yuv420p");
  return { yavg: pick(a, "YAVG"), ylow: pick(a, "YLOW"), yhigh: pick(a, "YHIGH"), sat: pick(a, "SATAVG"), edge: pick(e, "YAVG") / 255 };
};

const TH = { lumaMin: 30, lumaMax: 225, contrastMin: 45, edgeMin: 0.012, satMin: 5 };
// frames that a scene-change wipe intentionally fills (white spray, smoke, hull) must not be judged
import { execFileSync as _x } from "node:child_process";
_x("node", ["scripts/qc.mjs"], { stdio: "ignore" });
const wipes = JSON.parse(fs.readFileSync("out/qc/ep001-pirate-ships.json", "utf8")).transitions;
const rows = [];
const bad = [];
for (const t of times) {
  const frame = Math.round(t * fps);
  if (wipes.some((w) => Math.abs(t - w.t) <= w.dur / 2 + 0.1)) { console.log(`t=${t.toFixed(2)}s  skipped (inside a scene-change wipe)`); continue; }
  const f = path.join(OUT, `t${t.toFixed(2)}.jpg`);
  await renderStill({ composition: comp, serveUrl, output: f, frame, inputProps, puppeteerInstance: browser, imageFormat: "jpeg", jpegQuality: 85, chromiumOptions: { gl: GL }, timeoutInMilliseconds: 120000 });
  const s = stats(f);
  const contrast = s.yhigh - s.ylow;
  const issues = [];
  if (s.yavg > TH.lumaMax) issues.push("washed out / blown highlights");
  if (s.yavg < TH.lumaMin) issues.push("crushed / too dark");
  if (contrast < TH.contrastMin) issues.push(`flat lighting (contrast ${contrast.toFixed(0)})`);
  if (s.edge < TH.edgeMin) issues.push(`no surface detail (edge density ${s.edge.toFixed(3)})`);
  if (s.sat < TH.satMin) issues.push(`colourless (sat ${s.sat.toFixed(1)})`);
  rows.push({ t, ...s, contrast, issues });
  if (issues.length) bad.push({ t, issues });
  console.log(`t=${t.toFixed(2)}s  luma=${s.yavg.toFixed(0)} contrast=${contrast.toFixed(0)} edge=${s.edge.toFixed(3)} sat=${s.sat.toFixed(0)}  ${issues.length ? "FLAG: " + issues.join("; ") : "ok"}`);
}
await browser.close(() => {}, true);
fs.writeFileSync(path.join("out/qc", "frames.json"), JSON.stringify({ thresholds: TH, rows, flagged: bad }, null, 1));
console.log(`\n${times.length} frames checked, ${bad.length} flagged. Stills + frames.json in ${OUT}/`);
if (args.includes("--strict") && bad.length) process.exit(1);
