import React from "react";
import type { Callout, Narration } from "./types";
import { chunkWords, wordsFor } from "./engine/subtitles";
import { clamp, ease } from "./engine/math";

const FONT = '"DejaVu Sans Condensed", "DejaVu Sans", "Arial Black", Arial, sans-serif';

export const Vignette: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.5) 100%)" }} />
);

export const Subtitles: React.FC<{ t: number; lines: Narration[]; durations: Record<string, number> | null }> = ({ t, lines, durations }) => {
  let active: { chunk: ReturnType<typeof chunkWords>[number]; t0: number; t1: number } | null = null;
  for (const n of lines) {
    const chunks = chunkWords(wordsFor(n, durations?.[n.id]));
    for (const c of chunks) {
      const t0 = c[0].t0, t1 = c[c.length - 1].t1;
      if (t >= t0 - 0.02 && t < t1 + 0.12) active = { chunk: c, t0, t1 };
    }
  }
  if (!active) return null;
  const pop = ease("out", clamp((t - active.t0) / 0.12));
  return (
    <div style={{ position: "absolute", left: 30, right: 30, bottom: 330, textAlign: "center", transform: `scale(${0.88 + 0.12 * pop})`, opacity: Math.min(1, pop * 1.5) }}>
      {active.chunk.map((w, i) => {
        const on = t >= w.t0 && t < w.t1 + 0.02;
        return (
          <span key={i} style={{
            display: "inline-block", margin: "0 9px", fontFamily: FONT, fontWeight: 800, fontSize: 74, textTransform: "uppercase", letterSpacing: 1,
            color: "#ffffff", WebkitTextStroke: "12px #0a0e14", paintOrder: "stroke fill",
            textShadow: "0 6px 0 #0a0e14, 0 10px 22px rgba(0,0,0,0.55)", transform: on ? "scale(1.08)" : "scale(1)",
          }}>{w.text.replace(/[.,]$/, "")}</span>
        );
      })}
    </div>
  );
};

export const Callouts: React.FC<{ t: number; list: Callout[] }> = ({ t, list }) => (
  <>
    {list.filter((c) => t >= c.t && t <= c.t + c.dur).map((c, i) => {
      const inP = ease("out", clamp((t - c.t) / 0.35)), outP = ease("in", clamp((t - (c.t + c.dur - 0.3)) / 0.3));
      const k = (1 - inP) * 140 + outP * 140;
      const right = c.side === "right";
      return (
        <div key={i} style={{
          position: "absolute", top: 190 + (i % 2) * 0, [right ? "right" : "left"]: 28, transform: `translateX(${right ? k : -k}px)`, opacity: inP * (1 - outP),
          background: "rgba(8,14,24,0.78)", [right ? "borderRight" : "borderLeft"]: "10px solid #ffd23f", padding: "14px 28px", borderRadius: 8, maxWidth: 560,
          fontFamily: FONT, color: "#fff", boxShadow: "0 8px 24px rgba(0,0,0,0.45)", textAlign: right ? "right" : "left",
        }}>
          <div style={{ fontWeight: 800, fontSize: 44, letterSpacing: 1.5, textTransform: "uppercase", lineHeight: 1.05 }}>{c.text}</div>
          {c.sub && <div style={{ fontWeight: 700, fontSize: 27, color: "#ffd23f", marginTop: 6, letterSpacing: 1, textTransform: "uppercase" }}>{c.sub}</div>}
        </div>
      );
    })}
  </>
);

export const TitleCard: React.FC<{ t: number }> = ({ t }) => {
  const a = ease("out", clamp((t - 0.2) / 0.45)), b = ease("in", clamp((t - 3.5) / 0.5));
  if (t > 4.1) return null;
  return (
    <div style={{ position: "absolute", top: 110, left: 0, right: 0, textAlign: "center", opacity: a * (1 - b), transform: `translateY(${(1 - a) * -40 - b * 30}px) scale(${0.9 + 0.1 * a})`, fontFamily: FONT }}>
      <div style={{ display: "inline-block", background: "#ffd23f", color: "#0a0e14", fontWeight: 800, fontSize: 26, padding: "6px 20px", borderRadius: 6, letterSpacing: 3 }}>GOLDEN AGE OF PIRACY · EP. 001</div>
      <div style={{ marginTop: 18, fontWeight: 800, fontSize: 68, lineHeight: 1.02, color: "#fff", textTransform: "uppercase", WebkitTextStroke: "10px #0a0e14", paintOrder: "stroke fill", textShadow: "0 8px 0 #0a0e14" }}>What made<br />pirate ships<br /><span style={{ color: "#ffd23f" }}>so dangerous?</span></div>
    </div>
  );
};
