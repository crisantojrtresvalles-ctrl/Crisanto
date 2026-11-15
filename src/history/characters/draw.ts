import type { CharLook } from "../types";
import type { Pose } from "./pose";

/**
 * Illustrated 2.5D stick-figure rig (see character_recipe.mp4):
 * big round white head + thick outline, pear torso (no neck), long thin legs with tiny dash feet,
 * thin bent arms with black blob hands, dot eyes + arched brows, costume detail in thinner lines,
 * soft shading, head-thickness crescent. Design space: 100 x 150 units, feet at y=144.
 */
const INK = "#15100d";
export interface DrawOpts { t: number; seed: number; blink: number; rimCol: string; rimSide: number; tint: string; tintA: number; shadeA: number }

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

export const drawCharacter = (ctx: CanvasRenderingContext2D, W: number, H: number, L: CharLook, P: Pose, o: DrawOpts) => {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.scale(W / 100, W / 100);
  ctx.translate(10, 26); ctx.scale(0.8, 0.8); // headroom for tall hats and props
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  const OUT = 1.9, THIN = 0.9;
  const GROUND = 144;
  const jit = P.shake ? Math.sin(o.t * 55 + o.seed) * 0.8 * P.shake : 0;
  const cx = 50 + jit;
  const hipY = 88 - P.bob;
  const bw = L.build;
  const stroke = (fill: string | CanvasGradient | null, w = OUT) => { if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.strokeStyle = INK; ctx.lineWidth = w; ctx.stroke(); };
  const line = (pts: [number, number][], w: number, col = INK) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...pts[0]); for (const p of pts.slice(1)) ctx.lineTo(...p); ctx.stroke(); };

  // ---- legs (2-bone IK so planted feet stay on the ground) ----
  const seg = 30;
  const leg = (hipX: number, foot: [number, number]) => {
    const fx = cx + foot[0], fy = GROUND - foot[1];
    const dx = fx - hipX, dy = fy - hipY; let d = Math.hypot(dx, dy); d = Math.min(d, seg * 2 - 0.05);
    const a = Math.atan2(dy, dx), h = Math.acos(Math.min(1, d / (2 * seg)));
    const kx = hipX + Math.cos(a - h * 1) * seg, ky = hipY + Math.sin(a - h * 1) * seg;
    const kx2 = hipX + Math.cos(a + h) * seg, ky2 = hipY + Math.sin(a + h) * seg;
    const [ax, ay] = kx > kx2 ? [kx, ky] : [kx2, ky2];
    line([[hipX, hipY], [ax, ay], [fx, fy]], 1.8);
    line([[fx - 1.5, fy], [fx + 6.5, fy]], 2.6);
  };
  leg(cx - 5, P.fl); leg(cx + 5, P.fr);

  ctx.save();
  ctx.translate(cx, hipY); ctx.rotate(P.lean); ctx.translate(-cx, -hipY);
  const ty = hipY - 40, by = hipY + 2;
  const tw = 11 * bw, bwid = 17.5 * bw;
  const lightL = o.rimSide < 0;
  const grad = (c: string, x0: number, x1: number, y0 = 0, y1 = 0) => { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, lightL ? c : shade(c, 0.8)); g.addColorStop(0.55, c); g.addColorStop(1, lightL ? shade(c, 0.8) : c); return g; };
  const robe = L.dress ? L.coat : L.coat;

  // dress / skirt (behind torso, over legs)
  if (L.dress) {
    ctx.beginPath(); ctx.moveTo(cx - 14 * bw, ty + 22); ctx.quadraticCurveTo(cx - 26 * bw, hipY + 18, cx - 27 * bw, hipY + 34); ctx.quadraticCurveTo(cx, hipY + 40, cx + 27 * bw, hipY + 34); ctx.quadraticCurveTo(cx + 26 * bw, hipY + 18, cx + 14 * bw, ty + 22); ctx.closePath();
    stroke(grad(robe, cx - 26, cx + 26), OUT);
    line([[cx - 22 * bw, hipY + 30], [cx + 22 * bw, hipY + 32]], THIN);
  }
  // back arm
  const arm = (side: number, a: [number, number]) => {
    const sx = cx + side * 10.5 * bw, sy = ty + 9;
    const e1: [number, number] = [sx + Math.sin(a[0]) * 17, sy + Math.cos(a[0]) * 17];
    const e2: [number, number] = [e1[0] + Math.sin(a[1]) * 16, e1[1] + Math.cos(a[1]) * 16];
    line([[sx, sy], e1, e2], 1.8);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(e2[0], e2[1], 3.2, 0, 7); ctx.fill();
    return e2;
  };
  arm(-1, P.armB);

  // torso (pear)
  ctx.beginPath();
  ctx.moveTo(cx - tw, ty); ctx.bezierCurveTo(cx - tw - 4, ty + 14, cx - bwid - 2, by - 14, cx - bwid + 1, by - 3);
  ctx.quadraticCurveTo(cx, by + 6, cx + bwid - 1, by - 3); ctx.bezierCurveTo(cx + bwid + 2, by - 14, cx + tw + 4, ty + 14, cx + tw, ty); ctx.closePath();
  const torsoFill = L.dress ? L.shirt : L.coat;
  stroke(grad(torsoFill, cx - bwid, cx + bwid), OUT);
  if (!L.dress) { // costume details (thinner lines)
    if (L.apron) { ctx.beginPath(); ctx.moveTo(cx - 8, ty + 12); ctx.lineTo(cx + 8, ty + 12); ctx.lineTo(cx + 12 * bw, by - 4); ctx.quadraticCurveTo(cx, by + 2, cx - 12 * bw, by - 4); ctx.closePath(); stroke(L.apron, THIN + 0.2); line([[cx - 8, ty + 12], [cx - 9.5, ty + 5]], THIN); line([[cx + 8, ty + 12], [cx + 9.5, ty + 5]], THIN); }
    else { line([[cx - 4, ty + 3], [cx, ty + 12], [cx + 4, ty + 3]], THIN); ctx.fillStyle = INK; for (const k of [0, 1, 2]) { ctx.beginPath(); ctx.arc(cx, ty + 17 + k * 7, 0.9, 0, 7); ctx.fill(); } }
    line([[cx - bwid + 2, by - 17], [cx + bwid - 2, by - 17]], THIN + 0.3, shade(L.pants, 0.9));
    if (L.sash) { ctx.beginPath(); ctx.moveTo(cx - bwid + 1, by - 18); ctx.lineTo(cx + bwid - 1, by - 18); ctx.lineTo(cx + bwid, by - 9); ctx.lineTo(cx - bwid, by - 9); ctx.closePath(); stroke(L.sash, THIN + 0.3); }
    if (L.beard === "black") { line([[cx - tw + 1, ty + 3], [cx + bwid - 3, by - 10]], 3.4, "#15100d"); line([[cx - tw + 1, ty + 3], [cx + bwid - 3, by - 10]], 2, "#7a5230"); for (let k = 0; k < 3; k++) { ctx.fillStyle = "#222428"; ctx.fillRect(cx - 7 + k * 6, ty + 10 + k * 7, 2.6, 6); } }
  } else { ctx.beginPath(); ctx.moveTo(cx - 5, ty + 2); ctx.quadraticCurveTo(cx, ty + 10, cx + 5, ty + 2); stroke(shade(L.coat, 1.05), THIN); line([[cx - bwid + 2, ty + 26], [cx + bwid - 2, ty + 26]], THIN + 0.4, shade(L.coat, 0.7)); }

  // ---- head ----
  const hx = cx + P.head * 7, hy = 28 + P.head * 1.5 + (P.squash < 1 ? 0 : 0);
  ctx.save(); ctx.translate(hx, hy + 22); ctx.rotate(P.head * 0.9); ctx.translate(-hx, -(hy + 22));
  const RX = 24.5, RY = 23.6;
  if (L.hat === "hood") { ctx.beginPath(); ctx.ellipse(hx, hy + 2, RX + 5, RY + 6, 0, 0, 7); stroke(L.hatColor, OUT); ctx.beginPath(); ctx.moveTo(hx - RX - 2, hy + 8); ctx.quadraticCurveTo(hx - RX - 14, hy + 40, hx - RX + 6, hy + 52); ctx.lineTo(hx - 4, hy + 40); ctx.closePath(); stroke(shade(L.hatColor, 0.85), OUT); }
  // thickness crescent
  const th = lightL ? 2.8 : -2.8;
  ctx.beginPath(); ctx.ellipse(hx + th, hy + 1.6, RX, RY, 0, 0, 7); ctx.fillStyle = INK; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = OUT; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(hx, hy, RX, RY, 0, 0, 7);
  const hg = ctx.createRadialGradient(hx + (lightL ? -8 : 8), hy - 8, 4, hx, hy, RX + 4); hg.addColorStop(0, "#ffffff"); hg.addColorStop(0.75, "#f6f3ee"); hg.addColorStop(1, "#d9d3c8");
  stroke(hg, OUT);
  // face
  const fx = hx + 3 + (P.gaze - 0.5) * 5, ey = hy + 1.5;
  const er = 2.15 * (1 + 0.3 * Math.max(0, P.eyeWide)) * (1 - 0.35 * Math.max(0, -P.eyeWide));
  for (const [i, ex] of [[0, fx - 8.5], [1, fx + 8.5]] as [number, number][]) {
    ctx.fillStyle = INK;
    if (o.blink) { line([[ex - 2.4, ey], [ex + 2.4, ey]], 1.4); }
    else { ctx.beginPath(); ctx.ellipse(ex, ey, er, er * (P.eyeWide < -0.3 ? 0.62 : 1), 0, 0, 7); ctx.fill(); if (P.eyeWide < -0.3) line([[ex - 3.4, ey - 1.1], [ex + 3.4, ey - 1.1]], 1.1); }
    const yb = ey - 7.5, raise = Math.max(0, P.brow), frown = Math.max(0, -P.brow), dir = i === 0 ? 1 : -1;
    const inner: [number, number] = [ex + dir * 4.4, yb - raise * (1.2 + P.browTilt) + frown * 2.2];
    const outer: [number, number] = [ex - dir * 4.6, yb - raise * (1 - 0.5 * P.browTilt) - frown * 0.9 + 0.6];
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(...inner); ctx.quadraticCurveTo(ex, yb - 3.4 - raise * 1.6 + frown * 0.4, ...outer); ctx.stroke();
  }
  const my = hy + 12.5, mo = Math.max(0, P.mouth);
  if (L.beard === "mustache" || L.beard === "black" || L.beard === "goatee" || L.beard === "grey") {
    const bc = L.beard === "grey" ? "#cfcfcf" : "#15100d";
    ctx.beginPath(); ctx.moveTo(fx - 9, my - 3.5); ctx.quadraticCurveTo(fx - 3, my - 7, fx, my - 3); ctx.quadraticCurveTo(fx + 3, my - 7, fx + 9, my - 3.5); ctx.quadraticCurveTo(fx + 3, my - 1.2, fx, my - 2.2); ctx.quadraticCurveTo(fx - 3, my - 1.2, fx - 9, my - 3.5); ctx.closePath(); stroke(bc, THIN);
    if (L.beard !== "mustache") { const ext = L.beard === "black" ? 17 : L.beard === "goatee" ? 7 : 12; ctx.beginPath(); ctx.moveTo(hx - 21, hy + 6); ctx.quadraticCurveTo(hx - 22, my + ext, hx - 6, my + ext + 5); ctx.quadraticCurveTo(hx + 1, my + ext + 8 + Math.sin(o.t * 2) * 0.8, hx + 8, my + ext + 5); ctx.quadraticCurveTo(hx + 22, my + ext, hx + 21, hy + 6); ctx.quadraticCurveTo(hx + 12, my + 5, hx, my + 3); ctx.quadraticCurveTo(hx - 12, my + 5, hx - 21, hy + 6); ctx.closePath(); if (L.beard === "goatee") { ctx.beginPath(); ctx.moveTo(fx - 6, my + 5); ctx.quadraticCurveTo(fx, my + 18, fx + 6, my + 5); ctx.closePath(); } stroke(bc, THIN + 0.2); }
  }
  if (mo > 0.12) { ctx.beginPath(); ctx.ellipse(fx, my + 1 + mo * 2, 4.6 + mo * 1.6, 1.4 + mo * 4.6, 0, 0, 7); ctx.fillStyle = "#2a0e0e"; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(); ctx.fillStyle = "#d9606a"; ctx.beginPath(); ctx.ellipse(fx, my + 2 + mo * 3.4, 2.6, mo * 1.7, 0, 0, 7); ctx.fill(); }
  else if (P.brow < -0.6 && P.smile < 0.4) { ctx.beginPath(); ctx.rect(fx - 6, my - 1.5, 12, 4.5); stroke("#fbfaf6", 1.2); for (let k = 1; k < 4; k++) line([[fx - 6 + k * 3, my - 1.5], [fx - 6 + k * 3, my + 3]], 0.7); }
  else { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(fx - 7, my - P.smile * 0.6); ctx.quadraticCurveTo(fx, my + P.smile * 5.2 + (P.smile === 0 ? 0 : 0), fx + 7, my - P.smile * 0.6); ctx.stroke(); if (P.smile > 0.8) for (let k = -2; k <= 2; k++) line([[fx + k * 2.6, my + 1.5 + (2 - Math.abs(k)) * 0.15], [fx + k * 2.6, my + 3.6]], 0.7); }
  if (L.patch) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(fx + 8.5, ey, 5.2, 5.4, 0, 0, 7); ctx.fill(); line([[hx - 22, hy - 8], [hx + 22, hy - 2]], 1.2); }
  if (L.beard === "stubble") { ctx.fillStyle = "rgba(20,14,10,0.55)"; for (let k = 0; k < 26; k++) { const a = 0.2 + (k / 26) * 2.7, r = 17 + (k % 3); ctx.fillRect(hx + Math.cos(a) * r * 0.95, hy + 4 + Math.sin(a) * r * 0.78, 0.9, 0.9); } }
  // hats / headwear
  const hc = L.hatColor, ht = hy - 19;
  if (L.hat === "tricorn" || L.hat === "captain") {
    const big = L.hat === "captain" ? 1.1 : 1;
    ctx.beginPath(); ctx.moveTo(hx - 30 * big, hy - 8); ctx.lineTo(hx - 17, ht - 7 * big); ctx.lineTo(hx - 5, ht - 15 * big); ctx.lineTo(hx + 8, ht - 15 * big); ctx.lineTo(hx + 19, ht - 6 * big); ctx.lineTo(hx + 31 * big, hy - 9); ctx.quadraticCurveTo(hx + 2, hy - 15, hx - 30 * big, hy - 8); ctx.closePath(); stroke(hc, OUT);
    line([[hx - 29 * big, hy - 9], [hx + 2, hy - 15], [hx + 30 * big, hy - 10]], THIN + 0.3, "#d9b04a");
    if (L.hat === "captain") { ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(hx + 14, ht - 8); ctx.quadraticCurveTo(hx + 36, ht - 22 + Math.sin(o.t * 3) * 2, hx + 38, hy - 6); ctx.stroke(); ctx.strokeStyle = "#f4efe2"; ctx.lineWidth = 2; ctx.stroke(); }
    if (L.fuses) for (let i = 0; i < 4; i++) {
      const fxx = hx - 14 + i * 9, fyy = ht - 15 * big - 1, lean = (i - 1.5) * 1.8;
      line([[fxx, fyy + 3], [fxx + lean, fyy - 8]], 1.2, "#3a2a1a");
      const fl = 0.6 + 0.4 * Math.sin(o.t * 20 + i * 2.1);
      ctx.fillStyle = `rgba(255,${150 + fl * 80},40,0.95)`; ctx.beginPath(); ctx.arc(fxx + lean, fyy - 8.5, 1.8 + fl, 0, 7); ctx.fill();
      for (let k = 0; k < 5; k++) { const ph = (o.t * 0.7 + k * 0.2 + i * 0.13) % 1; ctx.fillStyle = `rgba(215,215,220,${0.5 * (1 - ph)})`; ctx.beginPath(); ctx.arc(fxx + lean + Math.sin(ph * 6 + i) * 3 + ph * 5, fyy - 10 - ph * 30, 2.2 + ph * 6, 0, 7); ctx.fill(); }
    }
  } else if (L.hat === "bandana") {
    ctx.beginPath(); ctx.moveTo(hx - 24, hy - 6); ctx.quadraticCurveTo(hx - 24, hy - 27, hx, hy - 26); ctx.quadraticCurveTo(hx + 24, hy - 27, hx + 24, hy - 6); ctx.quadraticCurveTo(hx, hy - 13, hx - 24, hy - 6); ctx.closePath(); stroke(hc, OUT);
    const w1 = Math.sin(o.t * 6 + o.seed) * 3; ctx.beginPath(); ctx.moveTo(hx - 23, hy - 8); ctx.quadraticCurveTo(hx - 33, hy - 10 + w1, hx - 41, hy - 2 + w1 * 1.4); ctx.lineTo(hx - 35, hy + 3 + w1); ctx.quadraticCurveTo(hx - 29, hy - 4, hx - 22, hy - 3); ctx.closePath(); stroke(shade(hc, 0.85), THIN + 0.4);
    ctx.fillStyle = "rgba(255,255,255,0.8)"; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(hx - 14 + i * 7, hy - 18 + (i % 2) * 3, 1.1, 0, 7); ctx.fill(); }
  } else if (L.hat === "cap") {
    ctx.beginPath(); ctx.moveTo(hx - 24, hy - 5); ctx.quadraticCurveTo(hx - 26, hy - 32, hx + 2, hy - 31); ctx.quadraticCurveTo(hx + 28, hy - 29, hx + 24, hy - 5); ctx.quadraticCurveTo(hx, hy - 12, hx - 24, hy - 5); ctx.closePath(); stroke(hc, OUT);
    ctx.beginPath(); ctx.arc(hx + 2, hy - 31, 2.6, 0, 7); stroke("#e9d8a4", THIN);
  } else if (L.hat === "wig") {
    for (const [dx, dy] of [[-24, 4], [-25, 15], [-21, 25], [24, 6], [25, 17]] as [number, number][]) { ctx.beginPath(); ctx.arc(hx + dx, hy + dy, 7.5, 0, 7); stroke("#f4f2ec", THIN + 0.5); }
    ctx.beginPath(); ctx.ellipse(hx, hy - 15, 25, 13, 0, Math.PI, 0); stroke("#f4f2ec", OUT);
    for (let k = -2; k <= 2; k++) line([[hx + k * 8, hy - 26], [hx + k * 8 + 2, hy - 17]], 0.7, "#b9b4a8");
  } else if (L.hat === "coif") {
    ctx.beginPath(); ctx.moveTo(hx - 23, hy + 12); ctx.quadraticCurveTo(hx - 29, hy - 22, hx, hy - 28); ctx.quadraticCurveTo(hx + 29, hy - 22, hx + 23, hy + 12); ctx.quadraticCurveTo(hx + 20, hy - 14, hx, hy - 16); ctx.quadraticCurveTo(hx - 20, hy - 14, hx - 23, hy + 12); ctx.closePath(); stroke(hc, OUT);
    ctx.beginPath(); ctx.moveTo(hx + 20, hy + 2); ctx.lineTo(hx + 31, hy - 4); ctx.lineTo(hx + 31, hy + 8); ctx.closePath(); stroke(shade(hc, 0.85), THIN + 0.4);
  } else if (L.hat === "official") {
    ctx.beginPath(); ctx.ellipse(hx, hy - 14, 29, 7, 0, 0, 7); stroke(hc, OUT);
    ctx.beginPath(); ctx.moveTo(hx - 17, hy - 15); ctx.lineTo(hx - 15, hy - 52); ctx.lineTo(hx + 15, hy - 52); ctx.lineTo(hx + 17, hy - 15); ctx.closePath(); stroke(hc, OUT);
    ctx.fillStyle = "#d9b04a"; ctx.fillRect(hx - 16.5, hy - 24, 33, 4.5); ctx.strokeStyle = INK; ctx.lineWidth = THIN; ctx.strokeRect(hx - 16.5, hy - 24, 33, 4.5);
  } else if (L.hat === "feather") {
    ctx.beginPath(); ctx.moveTo(hx - 25, hy - 4); ctx.quadraticCurveTo(hx - 26, hy - 28, hx, hy - 26); ctx.quadraticCurveTo(hx + 27, hy - 26, hx + 26, hy - 3); ctx.quadraticCurveTo(hx, hy - 12, hx - 25, hy - 4); ctx.closePath(); stroke(hc, OUT);
    ctx.beginPath(); ctx.moveTo(hx + 8, hy - 22); ctx.quadraticCurveTo(hx + 34, hy - 46, hx + 38, hy - 20); ctx.quadraticCurveTo(hx + 26, hy - 32, hx + 8, hy - 22); ctx.closePath(); stroke("#e8e1cf", THIN + 0.4);
  }
  ctx.restore();

  // front arm + props (drawn last so it passes over the head/torso)
  const hand = arm(1, P.armF);
  const e1x = cx + 10.5 * bw + Math.sin(P.armF[0]) * 17, e1y = ty + 9 + Math.cos(P.armF[0]) * 17;
  const dir = Math.atan2(hand[0] - e1x, hand[1] - e1y);
  const along = (a: number, d: number): [number, number] => [hand[0] + Math.sin(a) * d, hand[1] + Math.cos(a) * d];
  const stick = (a: number, d0: number, d1: number, w: number, col: string) => { const p0 = along(a, d0), p1 = along(a, d1); line([p0, p1], w + 1.4); line([p0, p1], w, col); };
  const pr = L.prop;
  if (pr === "sword") { const a = dir + 0.35; stick(a, -2, 7, 2.4, "#c8a24a"); stick(a, 7, 40, 2.2, "#dfe5ea"); const g = along(a, 7); line([[g[0] - Math.cos(a) * 5, g[1] + Math.sin(a) * 5], [g[0] + Math.cos(a) * 5, g[1] - Math.sin(a) * 5]], 2, "#c8a24a"); }
  if (pr === "spyglass") { stick(dir - 0.1, -3, 6, 4.4, "#7b4a22"); stick(dir - 0.1, 6, 22, 3.6, "#c99a3c"); stick(dir - 0.1, 22, 29, 4.8, "#7b4a22"); }
  if (pr === "pistol") { stick(dir + 0.2, -2, 11, 2.4, "#2b2b30"); stick(dir + 1.6, -2, 4, 3.4, "#6a4a2c"); }
  if (pr === "musket") { stick(dir, -14, 38, 2.6, "#3a2a1c"); stick(dir, 6, 38, 1.6, "#4b4f55"); }
  if (pr === "torch") { stick(dir, -4, 14, 2.4, "#5a3a1c"); const tp = along(dir, 16); const fl = 0.6 + 0.4 * Math.sin(o.t * 22 + o.seed); ctx.fillStyle = "#ff8a1e"; ctx.beginPath(); ctx.ellipse(tp[0], tp[1] - 3, 4 + fl, 7 + fl * 2, 0, 0, 7); ctx.fill(); ctx.fillStyle = "#ffe08a"; ctx.beginPath(); ctx.ellipse(tp[0], tp[1] - 2, 2, 4 + fl, 0, 0, 7); ctx.fill(); }
  if (pr === "brush") { stick(dir, -3, 10, 2.2, "#6a4a2c"); const bp = along(dir, 12); ctx.beginPath(); ctx.rect(bp[0] - 5, bp[1] - 3, 10, 6); stroke("#b99560", THIN + 0.3); }
  if (pr === "lute") { const a = dir + 0.5, c = along(a, 9); ctx.beginPath(); ctx.ellipse(c[0], c[1], 9, 12, a, 0, 7); stroke("#b9763a", OUT * 0.8); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(c[0], c[1], 2.6, 0, 7); ctx.fill(); stick(a + Math.PI, -8, -34, 2.2, "#6a4a2c"); }
  if (pr === "drum") { const c = along(dir, 5); ctx.beginPath(); ctx.ellipse(c[0], c[1], 9, 8, 0, 0, 7); stroke("#d9c08a", OUT * 0.8); line([[c[0] - 9, c[1]], [c[0] + 9, c[1]]], 0.7); for (let k = -1; k <= 1; k++) line([[c[0] + k * 4, c[1] - 7], [c[0] + k * 5 - 2, c[1] + 7]], 0.6, "#a33"); }
  if (pr === "pipe") { stick(dir + 0.4, -2, 26, 2.2, "#8a5a2c"); }
  if (pr === "scroll") { const c = along(dir, 5); ctx.beginPath(); ctx.rect(c[0] - 4, c[1] - 9, 8, 18); stroke("#efe2bf", THIN + 0.4); line([[c[0] - 2, c[1] - 4], [c[0] + 2, c[1] - 4]], 0.6); line([[c[0] - 2, c[1]], [c[0] + 2, c[1]]], 0.6); }
  if (pr === "staff") { stick(dir, -30, 40, 2.4, "#6a4a2c"); }
  ctx.restore();
  ctx.restore();

  // scene lighting integration (rim light, shade, ambient tint)
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-atop";
  const g = ctx.createLinearGradient(o.rimSide > 0 ? W : 0, 0, o.rimSide > 0 ? W * 0.4 : W * 0.6, 0);
  g.addColorStop(0, o.rimCol); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 0.28; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const s2 = ctx.createLinearGradient(o.rimSide > 0 ? 0 : W, 0, o.rimSide > 0 ? W * 0.7 : W * 0.3, 0);
  s2.addColorStop(0, `rgba(30,30,60,${o.shadeA * 0.7})`); s2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = 1; ctx.fillStyle = s2; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = o.tintA * 0.8; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, W, H);
  ctx.restore();
};
