#!/usr/bin/env node
// Pre-render quality control for a history episode. Pure data analysis: no GPU, no browser, no rendering.
//   node scripts/qc.mjs                 -> QC the default episode, print the report
//   node scripts/qc.mjs --strict        -> exit 1 on errors (use in CI / before rendering)
//   node scripts/qc.mjs --warn-as-error -> exit 1 on warnings too
//   node scripts/qc.mjs --json          -> also print the JSON report
// Reports are written to out/qc/<episode>.json and out/qc/<episode>.txt
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const episodeKey = val("--episode", "pirates");
const W = Number(val("--width", 720)), H = Number(val("--height", 1280));

const registry = { pirates: { module: "src/history/episodes/pirates.ts", export: "pirates", audioDir: "public/audio/pirates" } };
const reg = registry[episodeKey];
if (!reg) { console.error(`Unknown episode "${episodeKey}". Known: ${Object.keys(registry).join(", ")}`); process.exit(2); }

// bundle the TS (no tsx / ts-node dependency: esbuild already ships with Remotion)
fs.mkdirSync("out/qc", { recursive: true });
const entry = path.resolve("out/qc/.entry.ts");
fs.writeFileSync(entry, `export { runQC, formatReport } from "../../src/history/qc/index";\nexport { ${reg.export} as episode } from "../../${reg.module.replace(/\.ts$/, "")}";\n`);
const outfile = path.resolve("out/qc/.bundle.mjs");
await build({ entryPoints: [entry], outfile, bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", logLevel: "error", loader: { ".json": "json" } });
const { runQC, formatReport, episode } = await import(pathToFileURL(outfile).href + "?v=" + Date.now());

// audio inputs, if the generator has run
let durations = null;
const manifest = path.join(reg.audioDir, "manifest.json");
if (fs.existsSync(manifest)) durations = JSON.parse(fs.readFileSync(manifest, "utf8")).durations ?? null;
let audioFiles = null;
if (fs.existsSync(reg.audioDir)) audioFiles = new Set(fs.readdirSync(reg.audioDir));
else if (fs.existsSync("scripts/generate-audio.mjs")) {
  // not generated yet: derive the file list the generator WILL produce
  const g = fs.readFileSync("scripts/generate-audio.mjs", "utf8");
  const sfxBlock = g.slice(g.indexOf("const sfx = {"), g.indexOf("for (const [name, fn] of Object.entries(sfx))"));
  audioFiles = new Set([...sfxBlock.matchAll(/^ {2}(\w+): /gm)].map((m) => m[1] + ".wav"));
  audioFiles.add("music.wav"); audioFiles.add("ambience.wav");
  for (const n of episode.narration) audioFiles.add(n.id + ".wav");
}

const t0 = Date.now();
const report = runQC(episode, { aspect: W / H, durations, audioFiles });
const text = formatReport(report);
fs.writeFileSync(`out/qc/${episode.id}.json`, JSON.stringify(report, null, 1));
fs.writeFileSync(`out/qc/${episode.id}.txt`, text + "\n");
console.log(text);
console.log(`\n(${((Date.now() - t0) / 1000).toFixed(1)}s, reports in out/qc/)`);
if (has("--json")) console.log(JSON.stringify(report, null, 1));
const errors = report.findings.filter((f) => f.severity === "error").length;
const warns = report.findings.filter((f) => f.severity === "warn").length;
if ((has("--strict") && errors) || (has("--warn-as-error") && (errors || warns))) process.exit(1);
