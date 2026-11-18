import { fmt, type Ctx } from "./util";

const SFX_FOR: Record<string, string[]> = {
  cannon: ["cannon.wav"], muzzle: ["musket.wav", "cannon.wav"], splash: ["splash.wav"],
  lightning: ["thunder.wav"], grapple: ["hook.wav"], debris: ["crack.wav", "thud.wav"],
};

export const checkAudio = (c: Ctx, durations: Record<string, number> | null | undefined, files: Set<string> | null | undefined) => {
  const { ep } = c;
  const K = "audio";

  // narration length vs. its slot (subtitle windows and ducking depend on it)
  if (!durations) c.add(K, "info", "Narration audio has not been generated (no manifest.json), so spoken length vs. slot could not be verified. Run `node scripts/generate-audio.mjs`.");
  else {
    ep.narration.forEach((n, i) => {
      const d = durations[n.id];
      if (d === undefined) return c.add(K, "error", `No generated audio duration for ${n.id}.`, n.start);
      const slot = n.end - n.start;
      const next = ep.narration[i + 1];
      if (next && n.start + d > next.start - 0.05) c.add(K, "error", `${n.id} audio (${d.toFixed(2)}s) runs into ${next.id}.`, n.start);
      else if (d > slot + 0.4) c.add(K, "warn", `${n.id} audio is ${d.toFixed(2)}s but its slot is ${slot.toFixed(2)}s; subtitles will lag the voice.`, n.start);
      if (n.start + d > ep.durationSec - 0.3) c.add(K, "error", `${n.id} audio runs past the end fade.`, n.start);
    });
  }

  // every sound-making event needs a cue near it
  for (const e of ep.fx) {
    const want = SFX_FOR[e.kind];
    if (!want) continue;
    const ok = ep.sfx.some((s) => want.includes(s.file) && Math.abs(s.t - e.t) <= 0.4);
    if (!ok) c.add(K, "warn", `${e.kind} event at ${fmt(e.t)} has no matching sound cue within 0.4s (${want.join(" / ")}).`, e.t);
  }
  // scene changes should be carried by a whoosh
  for (const tr of ep.transitions) {
    const ok = ep.sfx.some((s) => s.file.startsWith("whoosh") && Math.abs(s.t - (tr.t - tr.dur * 0.1)) <= 0.9);
    if (!ok) c.add(K, "warn", `Transition at ${fmt(tr.t)} has no whoosh cue.`, tr.t);
  }
  // cue files must exist
  if (files) {
    const used = new Set([ep.music.file, ep.ambience.file, ...ep.sfx.map((s) => s.file), ...ep.narration.map((n) => n.id + ".wav")]);
    for (const f of used) if (!files.has(f)) c.add(K, "error", `Audio file "${f}" is referenced but is not produced by the audio generator.`);
  } else c.add(K, "info", "Audio file list unknown; skipped file-existence check.");

  const cues = [...ep.sfx].sort((a, b) => a.t - b.t);
  let stack = 0;
  for (let i = 0; i < cues.length; i++) {
    let n = 0;
    for (let j = i; j < cues.length && cues[j].t - cues[i].t < 0.1; j++) n++;
    stack = Math.max(stack, n);
  }
  if (stack > 3) c.add(K, "warn", `Up to ${stack} sound cues fire within 100ms of each other; the mix will clip or smear.`);
  c.metrics.sfxCues = ep.sfx.length;
};
