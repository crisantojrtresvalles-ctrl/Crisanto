import type { Narration } from "../types";
export interface Word { text: string; t0: number; t1: number }
export const wordsFor = (n: Narration, dur?: number): Word[] => {
  const d = Math.min(dur ?? n.end - n.start, n.end - n.start + 0.4);
  const toks = n.text.split(/\s+/).filter(Boolean);
  const w = toks.map((x) => x.length + (/[.,:;?!]$/.test(x) ? 3.5 : 0) + 1.5);
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return toks.map((text, i) => { const t0 = n.start + (acc / sum) * d; acc += w[i]; return { text, t0, t1: n.start + (acc / sum) * d }; });
};
export const chunkWords = (ws: Word[]): Word[][] => {
  const out: Word[][] = []; let cur: Word[] = [];
  ws.forEach((w) => {
    cur.push(w);
    const end = /[.?!:]$/.test(w.text);
    const soft = /,$/.test(w.text) && cur.length >= 2;
    if (cur.length >= 2 || end || soft) { out.push(cur); cur = []; }
  });
  if (cur.length) out.push(cur);
  return out;
};
