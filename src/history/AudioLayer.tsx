import React from "react";
import { Html5Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { Episode as Ep } from "./types";
import { clamp, smoothstep } from "./engine/math";

const BASE = "audio/pirates/";
export const AudioLayer: React.FC<{ ep: Ep; durations: Record<string, number> }> = ({ ep, durations }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const wins = ep.narration.map((n) => [n.start, n.start + (durations[n.id] ?? n.end - n.start)] as const);
  const duck = (t: number) => {
    let d = 0;
    for (const [a, b] of wins) d = Math.max(d, smoothstep(a - 0.25, a + 0.15, t) * (1 - smoothstep(b - 0.05, b + 0.45, t)));
    return 1 - 0.58 * d;
  };
  const fade = (f: number) => clamp(f / (fps * 0.8)) * clamp((durationInFrames - f) / (fps * 0.9));
  return (
    <>
      <Html5Audio src={staticFile(BASE + ep.music.file)} volume={(f) => ep.music.vol * duck(f / fps) * fade(f)} />
      <Html5Audio src={staticFile(BASE + ep.ambience.file)} volume={(f) => ep.ambience.vol * (0.55 + 0.45 * duck(f / fps)) * fade(f)} />
      {ep.sfx.map((c, i) => (
        <Sequence key={i} from={Math.round(c.t * fps)} layout="none">
          <Html5Audio src={staticFile(BASE + c.file)} volume={c.vol ?? 1} />
        </Sequence>
      ))}
      {ep.narration.map((n) => (
        <Sequence key={n.id} from={Math.round(n.start * fps)} layout="none">
          <Html5Audio src={staticFile(BASE + n.id + ".wav")} volume={1} />
        </Sequence>
      ))}
    </>
  );
};
