// Generates all audio for Episode 001 into public/audio/pirates:
//  - music.wav, ambience.wav, sfx *.wav (pure-JS synthesis, deterministic)
//  - n01..n09.wav narration (ElevenLabs if ELEVENLABS_API_KEY is set, otherwise espeak-ng)
//  - manifest.json with narration durations (used for subtitle timing + ducking)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SR = 44100;
const OUT = path.resolve("public/audio/pirates");
fs.mkdirSync(OUT, { recursive: true });
const narration = JSON.parse(fs.readFileSync("src/history/episodes/pirates.narration.json", "utf8"));

// ---------- helpers ----------
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const buf = (sec, ch = 2) => Array.from({ length: ch }, () => new Float32Array(Math.ceil(sec * SR)));
const lpCoef = (fc) => 1 - Math.exp((-2 * Math.PI * fc) / SR);
class LP { constructor(fc) { this.a = lpCoef(fc); this.y = 0; } p(x) { this.y += this.a * (x - this.y); return this.y; } }
class HP { constructor(fc) { this.l = new LP(fc); } p(x) { return x - this.l.p(x); } }
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));
const writeWav = (file, chans) => {
  const n = chans[0].length, ch = chans.length;
  let peak = 0; for (const c of chans) for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(c[i]));
  const g = peak > 0.98 ? 0.98 / peak : 1;
  const b = Buffer.alloc(44 + n * ch * 2);
  b.write("RIFF", 0); b.writeUInt32LE(36 + n * ch * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * ch * 2, 40);
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, chans[c][i] * g)) * 32767), 44 + (i * ch + c) * 2);
  fs.writeFileSync(path.join(OUT, file), b);
};
const mono2 = (fn, sec) => { const o = buf(sec); const n = o[0].length; for (let i = 0; i < n; i++) { const [l, r] = fn(i / SR, i); o[0][i] = l; o[1][i] = r ?? l; } return o; };

// ---------- SFX ----------
const sfx = {
  whoosh: () => { const r = rng(1); const bp = new LP(300), bp2 = new LP(300); const h = new HP(200); return mono2((t, i) => { const x = r() * 2 - 1; const f = 250 + 3200 * Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 2; bp.a = lpCoef(f); bp2.a = lpCoef(f * 1.3); const y = h.p(bp.p(x) - bp2.p(x) * 0.2) * 5 * Math.sin(Math.PI * Math.min(1, t / 0.95)) ** 1.5; const pan = Math.sin(Math.PI * t / 0.95) * 0.5; return [y * (1 - pan * 0.5), y * (1 + pan * 0.5 - 0.5)]; }, 1.0); },
  whoosh2: () => { const r = rng(2); const bp = new LP(300), h = new HP(120); return mono2((t) => { const x = r() * 2 - 1; bp.a = lpCoef(160 + 2200 * Math.sin(Math.PI * Math.min(1, t / 1.15)) ** 2); const y = h.p(bp.p(x)) * 7 * Math.sin(Math.PI * Math.min(1, t / 1.15)) ** 2; return [y, y]; }, 1.2); },
  cannon: () => { const r = rng(3); const l1 = new LP(900), l2 = new LP(180); let ph = 0; return mono2((t) => { const x = r() * 2 - 1; ph += (2 * Math.PI * (38 + 70 * Math.exp(-t * 9))) / SR; const y = Math.sin(ph) * Math.exp(-t * 2.4) * 1.2 + l1.p(x) * Math.exp(-t * 7) * 1.6 + l2.p(x) * Math.exp(-t * 1.6) * 1.1 + x * Math.exp(-t * 60) * 1.2; return [y, y]; }, 2.2); },
  thunder: () => { const r = rng(4); const l1 = new LP(130), l2 = new LP(60); return mono2((t) => { const x = r() * 2 - 1; const e = (0.35 + 0.65 * Math.abs(Math.sin(t * 2.3 + Math.sin(t * 5.1)))) * Math.exp(-t * 0.8) * Math.min(1, t * 8); const y = (l1.p(x) * 5 + l2.p(x) * 7) * e; return [y, y * 0.9]; }, 3.6); },
  splash: () => { const r = rng(5); const h = new HP(900), l = new LP(7000); return mono2((t) => { const y = l.p(h.p(r() * 2 - 1)) * 2.2 * env(t, 0.02, 0.22); return [y, y]; }, 0.9); },
  creak: () => { const r = rng(6); let ph = 0, f = 150; const l = new LP(900); return mono2((t) => { f += (r() - 0.5) * 9; f = Math.max(90, Math.min(330, f)); ph += (2 * Math.PI * f) / SR; const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1; const y = l.p(saw) * 0.9 * Math.sin(Math.PI * Math.min(1, t / 1.3)) ** 1.2 * (0.6 + 0.4 * Math.sin(t * 40)); return [y, y]; }, 1.4); },
  gull: () => mono2((t) => { let y = 0; for (let k = 0; k < 3; k++) { const tt = t - k * 0.38; if (tt > 0 && tt < 0.34) { const f = 1700 + 900 * Math.sin(tt * 9) + 400 * (1 - tt * 3); y += Math.sin(2 * Math.PI * f * tt + 2 * Math.sin(2 * Math.PI * 7 * tt)) * Math.sin(Math.PI * tt / 0.34) * 0.5; } } return [y, y]; }, 1.4),
  flap: () => { const r = rng(7); const l = new LP(1100); return mono2((t) => { const y = l.p(r() * 2 - 1) * 2.4 * (0.5 + 0.5 * Math.abs(Math.sin(t * 38))) * Math.sin(Math.PI * Math.min(1, t / 0.7)); return [y, y]; }, 0.8); },
  clash: () => mono2((t) => { let y = 0; for (const f of [2310, 3170, 4380, 5920, 7240]) y += Math.sin(2 * Math.PI * f * t) * Math.exp(-t * (14 + f / 700)); y *= 0.35; const r = (Math.sin(t * 12345.6) * 43758.5) % 1; return [y + r * Math.exp(-t * 90) * 0.5, y]; }, 0.7),
  thud: () => { const r = rng(8); const l = new LP(260); let ph = 0; return mono2((t) => { ph += (2 * Math.PI * (60 + 60 * Math.exp(-t * 20))) / SR; return [Math.sin(ph) * Math.exp(-t * 11) * 1.3 + l.p(r() * 2 - 1) * Math.exp(-t * 18), 0].map((v, i, a) => (i ? a[0] : v)); }, 0.5); },
  musket: () => { const r = rng(9); const l = new LP(2400), l2 = new LP(200); return mono2((t) => { const x = r() * 2 - 1; const y = x * Math.exp(-t * 55) * 1.5 + l.p(x) * Math.exp(-t * 9) * 0.9 + l2.p(x) * Math.exp(-t * 5) * 1.2; return [y, y]; }, 1.1); },
  crack: () => { const r = rng(10); const l = new LP(3000), l2 = new LP(120); return mono2((t) => { const x = r() * 2 - 1; let y = l.p(x) * Math.exp(-t * 12) * (Math.sin(t * 190) > 0.3 ? 1.5 : 0.4) + l2.p(x) * Math.exp(-t * 3) * 1.6; if (t > 0.18 && t < 0.4) y += l.p(x) * 0.9 * (Math.sin(t * 310) > 0.5 ? 1 : 0.2); return [y, y]; }, 1.4); },
  gasp: () => { const r = rng(11); const a = new LP(900), b = new LP(1500); return mono2((t) => { const x = r() * 2 - 1; a.a = lpCoef(600 + 700 * t); const y = (a.p(x) - b.p(x) * 0.6) * 4 * Math.sin(Math.PI * Math.min(1, t / 0.9)); return [y, y]; }, 1.0); },
  hook: () => { const r = rng(12); const h = new HP(1500); return mono2((t) => { const y = Math.sin(2 * Math.PI * 3400 * t) * Math.exp(-t * 28) * 0.5 + Math.sin(2 * Math.PI * 5100 * t) * Math.exp(-t * 36) * 0.3 + h.p(r() * 2 - 1) * Math.exp(-t * 8) * 0.25 * Math.min(1, t * 20); return [y, y]; }, 0.8); },
  hiss: () => { const r = rng(13); const h = new HP(3000); return mono2((t) => { const c = r() > 0.995 ? 1.5 : 0; const y = h.p(r() * 2 - 1) * 0.7 * Math.min(1, t * 6) * Math.exp(-(t - 0.3) * 0.5) + c * 0.2; return [y, y]; }, 1.6); },
};
for (const [name, fn] of Object.entries(sfx)) writeWav(name + ".wav", fn());

// ---------- AMBIENCE (waves + wind, continuous, 61s) ----------
{
  const D = 61, o = buf(D); const r1 = rng(21), r2 = rng(22), r3 = rng(23);
  const w1 = [new LP(380), new LP(380)], w2 = [new LP(1600), new LP(1600)], wind = [new LP(500), new LP(500)], windb = [new LP(160), new LP(160)];
  for (let i = 0; i < o[0].length; i++) {
    const t = i / SR; const storm = Math.max(0.2, 1 - Math.max(0, t - 5) / 2.2) * (t < 7 ? 1 : 0.25) + (t > 41 && t < 55 ? 0.08 : 0);
    for (let c = 0; c < 2; c++) {
      const x = (c ? r2() : r1()) * 2 - 1;
      const swell = 0.55 + 0.45 * Math.sin(t * 0.9 + c * 1.7 + Math.sin(t * 0.37) * 2);
      const slosh = 0.4 + 0.6 * Math.max(0, Math.sin(t * 0.62 + c));
      const wave = w1[c].p(x) * 3.0 * swell + w2[c].p(x) * 1.4 * slosh * slosh;
      const wd = (wind[c].p(r3() * 2 - 1) - windb[c].p(r3() * 2 - 1) * 0.3) * 4 * storm * (0.7 + 0.3 * Math.sin(t * 0.8 + c));
      o[c][i] = (wave * 0.5 + wd) * 0.7;
    }
  }
  writeWav("ambience.wav", o);
}

// ---------- MUSIC (D dorian pirate cinema, 6/8, 40 bars x 1.5s) ----------
{
  const D = 61, o = buf(D); const BAR = 1.5, E = BAR / 6; const r = rng(77);
  const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const NOTE = { D2: 38, Bb1: 34, C2: 36, G1: 31, A1: 33, F2: 41 };
  const prog = [[38, "m"], [38, "m"], [34, "M"], [36, "M"], [38, "m"], [38, "m"], [31, "m"], [33, "M"], [38, "m"], [34, "M"], [36, "M"], [38, "m"], [31, "m"], [33, "M"], [38, "m"], [38, "m"]];
  const mel = [[62, 65, 69, 69, 67, 65], [64, 67, 71, 71, 69, 67], [65, 69, 72, 74, 72, 69], [69, 67, 65, 64, 62, 62]];
  const melFor = (rootN) => (rootN === 38 ? mel[0] : rootN === 34 ? mel[2] : rootN === 36 ? mel[1] : rootN === 31 ? mel[3] : mel[1]);
  const I = (t) => (t < 6 ? 0.35 : t < 20 ? 0.55 : t < 27 ? 0.9 : t < 34 ? 0.65 : t < 41 ? 0.85 : t < 55 ? 1.0 : 0.7);
  const send = new Float32Array(o[0].length);
  const add = (c, i, v) => { if (i >= 0 && i < o[0].length) o[c][i] += v; };
  const voice = (t0, dur, f, amp, kind, pan = 0) => {
    const n = Math.floor((dur + 0.6) * SR), i0 = Math.floor(t0 * SR); let ph1 = r(), ph2 = r(), ph3 = r(); const l = new LP(kind === "pad" ? 900 : kind === "brass" ? 1800 : 2600);
    for (let k = 0; k < n; k++) {
      const t = k / SR; ph1 += f / SR; ph2 += (f * 1.0045) / SR; ph3 += (f * 0.9956) / SR;
      const saw = (p) => (p % 1) * 2 - 1;
      let s = (saw(ph1) + saw(ph2) + saw(ph3)) / 3;
      if (kind === "pluck") { s = (saw(ph1) * 0.7 + Math.sign(Math.sin(2 * Math.PI * ph1)) * 0.3); l.a = lpCoef(600 + 4000 * Math.exp(-t * 9)); }
      if (kind === "brass") l.a = lpCoef(500 + 1800 * Math.min(1, t / 0.18));
      const e = kind === "pluck" ? Math.exp(-t * 7) : kind === "brass" ? Math.min(1, t / 0.07) * (t < dur ? 1 : Math.exp(-(t - dur) * 9)) : Math.min(1, t / 0.5) * (t < dur ? 1 : Math.exp(-(t - dur) * 5));
      const vib = kind === "pluck" ? 1 : 1 + 0.004 * Math.sin(t * 5.5);
      const y = l.p(s * vib) * e * amp;
      add(0, i0 + k, y * (0.5 - pan * 0.5 + 0.5)); add(1, i0 + k, y * (0.5 + pan * 0.5 + 0.5)); send[i0 + k] += y * 0.35;
    }
  };
  const drum = (t0, f, amp, noise = 0.0) => { const i0 = Math.floor(t0 * SR), n = Math.floor(1.3 * SR); let ph = 0; const l = new LP(500); for (let k = 0; k < n; k++) { const t = k / SR; ph += (2 * Math.PI * (f + f * 0.9 * Math.exp(-t * 14))) / SR; const y = (Math.sin(ph) * Math.exp(-t * 3.2) + l.p(r() * 2 - 1) * noise * Math.exp(-t * 22)) * amp; add(0, i0 + k, y); add(1, i0 + k, y); send[i0 + k] += y * 0.3; } };
  const snare = (t0, amp) => { const i0 = Math.floor(t0 * SR), n = Math.floor(0.35 * SR); const h = new HP(1800); for (let k = 0; k < n; k++) { const t = k / SR; const y = h.p(r() * 2 - 1) * Math.exp(-t * 16) * amp; add(0, i0 + k, y); add(1, i0 + k, y); } };
  for (let b = 0; b < 40; b++) {
    const t0 = b * BAR, [root, q] = prog[b % 16], inten = I(t0);
    voice(t0, BAR, hz(root), 0.16 * (0.5 + inten * 0.5), "pad", -0.2);
    voice(t0, BAR, hz(root + 12), 0.1 * inten, "pad", 0.2);
    for (const iv of q === "m" ? [15, 19] : [16, 19]) voice(t0, BAR, hz(root + 12 + iv - 12 + 12), 0.05 * inten, "pad", iv % 2 ? 0.4 : -0.4);
    if (t0 >= 6) { const m = melFor(root); m.forEach((n, i) => { if (t0 >= 41 || i % 3 !== 1 || t0 > 20) voice(t0 + i * E, E * 1.1, hz(n), (t0 >= 41 ? 0.1 : 0.14) * (0.6 + inten * 0.4), "pluck", 0.1); if (t0 >= 41 && (i === 0 || i === 3)) voice(t0 + i * E, E * 2.6, hz(n - 12), 0.11, "brass", -0.1); }); }
    if (t0 < 6) { if (b % 2 === 0) drum(t0, 52, 0.7); }
    else { drum(t0, 58, 0.75 * inten, 0.5); if (t0 >= 20) { drum(t0 + 3 * E, 64, 0.6 * inten, 0.4); snare(t0 + 4.5 * E, 0.18 * inten); snare(t0 + 2.5 * E, 0.09 * inten); } if (t0 >= 41 && t0 < 55 && b % 4 === 3) for (let k = 0; k < 6; k++) drum(t0 + k * E, 70, 0.28 + 0.05 * k, 0.2); }
  }
  // reverb send (Schroeder)
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ d, b: new Float32Array(d), i: 0 }));
  for (let i = 0; i < send.length; i++) { let y = 0; for (const c of combs) { const v = c.b[c.i]; y += v; c.b[c.i] = send[i] + v * 0.78; c.i = (c.i + 1) % c.d; } o[0][i] += y * 0.12; o[1][i] += y * 0.12 * (i % 2 ? 0.9 : 1.05); }
  writeWav("music.wav", o);
}

// ---------- NARRATION ----------
const probe = (f) => parseFloat(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const durations = {};
let source = "espeak-ng";
for (const n of narration) {
  const win = n.end - n.start, raw = path.join(OUT, n.id + ".raw"), out = path.join(OUT, n.id + ".wav");
  let ok = false;
  if (key) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ text: n.text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }) });
      if (!res.ok) throw new Error("HTTP " + res.status);
      fs.writeFileSync(raw + ".mp3", Buffer.from(await res.arrayBuffer()));
      execFileSync("ffmpeg", ["-y", "-i", raw + ".mp3", "-ar", String(SR), "-ac", "1", raw + ".wav"], { stdio: "ignore" });
      ok = true; source = "elevenlabs";
    } catch (e) { console.warn("ElevenLabs failed for", n.id, String(e.message), "- falling back to espeak-ng"); }
  }
  if (!ok) {
    let speed = 165;
    for (let k = 0; k < 3; k++) {
      execFileSync("espeak-ng", ["-v", "en-us+m3", "-p", "34", "-s", String(Math.round(speed)), "-g", "2", "-w", raw + ".wav", n.text]);
      const d = probe(raw + ".wav"); speed = Math.max(120, Math.min(215, speed * (d / (win * 0.96))));
    }
  }
  const d0 = probe(raw + ".wav");
  const tempo = Math.max(0.85, Math.min(1.3, d0 / (win * 0.97)));
  execFileSync("ffmpeg", ["-y", "-i", raw + ".wav", "-af", `atempo=${tempo.toFixed(4)},highpass=f=90,loudnorm=I=-15:LRA=9:TP=-1.5,aecho=0.8:0.5:35:0.12`, "-ar", String(SR), "-ac", "1", out], { stdio: "ignore" });
  durations[n.id] = Math.round(probe(out) * 1000) / 1000;
  for (const e of [".raw.wav", ".raw.mp3"]) fs.rmSync(path.join(OUT, n.id + e), { force: true });
  fs.rmSync(raw + ".wav", { force: true }); fs.rmSync(raw + ".mp3", { force: true });
  console.log(n.id, "window", win.toFixed(2), "audio", durations[n.id], source);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify({ source, durations }, null, 2));
console.log("audio ready:", fs.readdirSync(OUT).length, "files");
