#!/usr/bin/env node
// Staged, resumable renderer for history episodes.
//   node scripts/render-staged.mjs                      -> QC gate, then render in 15 s chunks, stitch to out/history.mp4
//   node scripts/render-staged.mjs --chunk-seconds 10   -> smaller stages (less memory, finer resume points)
//   node scripts/render-staged.mjs --range 0-89         -> only render frames 0..89 (a quick smoke test)
//   node scripts/render-staged.mjs --only 2             -> render just chunk #2 (0-based), no stitching
//   node scripts/render-staged.mjs --concat-only        -> stitch chunks that are already cached
//   node scripts/render-staged.mjs --ignore-qc          -> render even if the pre-render QC reports errors
// Each chunk is cached under out/chunks/ keyed by a hash of the source, audio and settings, so a re-run after a
// crash (or after changing only the last scene) re-renders only what changed. Needs Chromium + ffmpeg, no paid services.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : d; };
const COMP = val("--comp", "History");
const CHUNK_S = Number(val("--chunk-seconds", 15));
const OUTFILE = val("--out", "out/history.mp4");
const RETRIES = Number(val("--retries", 2));
const GL = val("--gl", process.env.GL ?? "swangle");
const CONC = Number(val("--concurrency", Math.max(1, Math.floor(os.cpus().length / 2))));
const CHUNK_DIR = "out/chunks";
fs.mkdirSync(CHUNK_DIR, { recursive: true });
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---------- stage 0: pre-render QC gate ----------
if (!has("--skip-qc") && !has("--concat-only")) {
  log("QC gate: node scripts/qc.mjs --strict");
  const r = spawnSync("node", ["scripts/qc.mjs", "--strict"], { encoding: "utf8" });
  const lines = (r.stdout ?? "").split("\n");
  console.log(lines.filter((l) => /^QC report|ERROR|^check|^script|^camera|^lighting|^scene|^characters|^audio/.test(l)).join("\n"));
  if (r.status !== 0) {
    if (has("--ignore-qc")) log("QC reported errors, continuing because --ignore-qc was given.");
    else { log("QC reported errors. Fix them (see out/qc/*.txt) or re-run with --ignore-qc. Nothing was rendered."); process.exit(3); }
  }
}

// ---------- cache key ----------
const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
const hashFiles = (files) => { const h = crypto.createHash("sha1"); for (const f of files.sort()) { h.update(f); h.update(fs.readFileSync(f)); } return h.digest("hex"); };
const srcHash = hashFiles([...walk("src"), "package-lock.json", "remotion.config.ts"].filter((f) => fs.existsSync(f)));
const audioHash = hashFiles(walk("public/audio"));
const keyFor = (from, to) => crypto.createHash("sha1").update([srcHash, audioHash, COMP, from, to, GL].join("|")).digest("hex").slice(0, 10);

// ---------- helpers ----------
const probe = (file) => {
  const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { encoding: "utf8" }));
  const v = j.streams.find((s) => s.codec_type === "video"), a = j.streams.find((s) => s.codec_type === "audio");
  return { dur: Number(j.format.duration), vdur: Number(v?.duration ?? j.format.duration), w: v?.width, h: v?.height, fps: v ? eval(v.r_frame_rate) : 0, audio: !!a };
};
// validity uses the VIDEO stream length: AAC padding makes the container longer than the video
const chunkValid = (file, frames, fps) => { try { return fs.existsSync(file) && Math.abs(probe(file).vdur - frames / fps) < 0.05; } catch { return false; } };

// ---------- bundle + composition ----------
log("bundling…");
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), onProgress: () => {} });
const chrome = [process.env.CHROME_PATH, "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome"].find((p) => p && fs.existsSync(p));
const launch = () => openBrowser("chrome", { browserExecutable: chrome ?? undefined, chromiumOptions: { gl: GL } });
let browser = await launch();
const comp = await selectComposition({ serveUrl, id: COMP, inputProps: {}, puppeteerInstance: browser });
const { fps, width, height } = comp;
const [r0, r1] = val("--range", null) ? val("--range").split("-").map(Number) : [0, comp.durationInFrames - 1];
const step = Math.round(CHUNK_S * fps);
const chunks = [];
for (let a = r0; a <= r1; a += step) chunks.push({ i: chunks.length, from: a, to: Math.min(r1, a + step - 1) });
log(`${COMP}: ${width}x${height} @ ${fps}fps, frames ${r0}-${r1}, ${chunks.length} chunk(s) of <= ${CHUNK_S}s, concurrency ${CONC}, gl ${GL}`);

// ---------- stage 1..n: render chunks ----------
const done = [], failed = [];
const wanted = has("--only") ? chunks.filter((c) => c.i === Number(val("--only"))) : chunks;
for (const ch of chunks) {
  ch.file = path.join(CHUNK_DIR, `${COMP}_${String(ch.from).padStart(5, "0")}-${String(ch.to).padStart(5, "0")}_${keyFor(ch.from, ch.to)}.mp4`);
  const frames = ch.to - ch.from + 1;
  if (has("--concat-only") || !wanted.includes(ch)) { if (chunkValid(ch.file, frames, fps)) done.push(ch); continue; }
  if (!has("--force") && chunkValid(ch.file, frames, fps)) { log(`chunk ${ch.i + 1}/${chunks.length} (${ch.from}-${ch.to}): cached, skipping`); done.push(ch); continue; }
  let ok = false;
  for (let attempt = 0; attempt <= RETRIES && !ok; attempt++) {
    const t0 = Date.now();
    try {
      log(`chunk ${ch.i + 1}/${chunks.length} (${ch.from}-${ch.to}) attempt ${attempt + 1}`);
      const tmp = ch.file + ".part.mp4";
      let lastPct = -1;
      await renderMedia({
        composition: comp, serveUrl, codec: "h264", audioCodec: "aac", forSeamlessAacConcatenation: true,
        outputLocation: tmp, overwrite: true, frameRange: [ch.from, ch.to], inputProps: {}, concurrency: CONC,
        imageFormat: "jpeg", puppeteerInstance: browser, browserExecutable: chrome ?? undefined, chromiumOptions: { gl: GL }, timeoutInMilliseconds: 180000,
        onProgress: ({ progress }) => { const p = Math.floor(progress * 10) * 10; if (p !== lastPct) { lastPct = p; log(`  ${p}%`); } },
      });
      fs.renameSync(tmp, ch.file);
      if (!chunkValid(ch.file, frames, fps)) throw new Error("chunk failed validation (wrong duration)");
      log(`  chunk ${ch.i + 1} done in ${((Date.now() - t0) / 1000).toFixed(0)}s (${(fs.statSync(ch.file).size / 1e6).toFixed(1)} MB)`);
      ok = true;
    } catch (e) {
      log(`  chunk ${ch.i + 1} failed: ${String(e.message).split("\n")[0]}`);
      try { await browser.close(() => {}, true); } catch { /* browser may already be gone */ }
      browser = await launch(); // recover from a crashed / out-of-memory browser
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
    }
  }
  (ok ? done : failed).push(ch);
}
try { await browser.close(() => {}, true); } catch { /* ignore */ }
if (failed.length) { log(`FAILED chunks: ${failed.map((c) => `#${c.i} (${c.from}-${c.to})`).join(", ")}. Completed chunks stay cached; re-run the same command to resume.`); process.exit(1); }
if (has("--only")) { log("--only given: skipping stitch."); process.exit(0); }

// ---------- final stage: stitch + verify ----------
// Plain `-c copy` of per-chunk MP4s leaves padded audio and shifted video timestamps at each seam (variable frame
// rate, drift). So: video goes through MPEG-TS (clean timestamps), audio is decoded to exact-length PCM per chunk,
// joined, and encoded to AAC once. Net result: no seam artefacts, no re-encode of the video.
const ordered = chunks.filter((c) => done.includes(c));
if (ordered.length !== chunks.length) { log(`Cannot stitch: ${chunks.length - ordered.length} chunk(s) missing. Run without --concat-only.`); process.exit(1); }
const ff = (...a) => execFileSync("ffmpeg", ["-y", "-v", "error", ...a]);
const TMP = path.join(CHUNK_DIR, "stitch");
fs.rmSync(TMP, { recursive: true, force: true });
fs.mkdirSync(TMP, { recursive: true });
const vlist = [], alist = [];
for (const c of ordered) {
  const base = path.join(TMP, String(c.i).padStart(3, "0"));
  const frames = c.to - c.from + 1;
  ff("-i", c.file, "-an", "-c:v", "copy", "-bsf:v", "h264_mp4toannexb", "-f", "mpegts", base + ".ts");
  vlist.push(`file '${path.resolve(base)}.ts'`);
  if (probe(c.file).audio) {
    ff("-i", c.file, "-vn", "-ar", "48000", "-ac", "2", "-t", (frames / fps).toFixed(6), "-c:a", "pcm_s16le", base + ".wav");
    alist.push(`file '${path.resolve(base)}.wav'`);
  }
}
fs.writeFileSync(path.join(TMP, "v.txt"), vlist.join("\n") + "\n");
fs.writeFileSync(path.join(TMP, "a.txt"), alist.join("\n") + "\n");
ff("-f", "concat", "-safe", "0", "-i", path.join(TMP, "v.txt"), "-c", "copy", "-bsf:a", "aac_adtstoasc", path.join(TMP, "video.mp4"));
fs.mkdirSync(path.dirname(OUTFILE), { recursive: true });
if (alist.length === ordered.length) {
  ff("-f", "concat", "-safe", "0", "-i", path.join(TMP, "a.txt"), "-c", "copy", path.join(TMP, "audio.wav"));
  ff("-i", path.join(TMP, "video.mp4"), "-i", path.join(TMP, "audio.wav"), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", OUTFILE);
} else ff("-i", path.join(TMP, "video.mp4"), "-c", "copy", "-movflags", "+faststart", OUTFILE);
fs.rmSync(TMP, { recursive: true, force: true }); // temp stitch files (also keeps tsc from scanning .ts transport streams)
const total = r1 - r0 + 1;
const info = probe(OUTFILE);
const problems = [];
if (info.w !== width || info.h !== height) problems.push(`size ${info.w}x${info.h}, expected ${width}x${height}`);
if (Math.abs(info.fps - fps) > 0.01) problems.push(`fps ${info.fps}, expected ${fps}`);
if (Math.abs(info.dur - total / fps) > 0.06) problems.push(`duration ${info.dur.toFixed(3)}s, expected ${(total / fps).toFixed(3)}s`);
if (fs.existsSync("public/audio/pirates/manifest.json") && !info.audio) problems.push("audio track missing although audio files exist");
fs.writeFileSync("out/render-manifest.json", JSON.stringify({ comp: COMP, frames: [r0, r1], fps, chunks: ordered.map((c) => ({ ...c })), output: OUTFILE, probe: info, problems, srcHash, audioHash }, null, 1));
if (problems.length) { log("VERIFY FAILED: " + problems.join("; ")); process.exit(1); }
log(`OK -> ${OUTFILE}  ${info.w}x${info.h} ${info.fps}fps ${info.dur.toFixed(2)}s audio=${info.audio}`);
