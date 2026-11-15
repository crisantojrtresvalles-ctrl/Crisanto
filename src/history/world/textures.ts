import * as THREE from "three";
import { hash } from "../engine/math";
import type { FlagKind } from "../types";

const cache = new Map<string, THREE.CanvasTexture>();
const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  draw(cv.getContext("2d")!);
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 4;
  cache.set(key, tx);
  return tx;
};

export const sailTex = (patchy: boolean) => make("sail" + patchy, 256, 256, (c) => {
  const g = c.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, "#f1e6c9"); g.addColorStop(1, "#d9c9a0");
  c.fillStyle = g; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(120,95,50,${0.03 + hash(i) * 0.05})`; c.fillRect(hash(i + 7) * 256, hash(i + 3) * 256, 40 + hash(i + 9) * 60, 10 + hash(i + 11) * 30); }
  c.strokeStyle = "rgba(90,70,40,0.55)"; c.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 256); c.stroke(); }
  c.strokeStyle = "rgba(90,70,40,0.25)"; c.lineWidth = 1;
  for (let y = 24; y < 256; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(256, y); c.stroke(); }
  if (patchy) for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? "rgba(120,60,40,0.75)" : "rgba(70,80,95,0.7)"; const x = 20 + hash(i * 3) * 170, y = 20 + hash(i * 5 + 1) * 170; c.fillRect(x, y, 44, 36); c.strokeStyle = "#3b2a1c"; c.setLineDash([4, 3]); c.strokeRect(x, y, 44, 36); c.setLineDash([]); }
  c.strokeStyle = "#6b4b2a"; c.lineWidth = 8; c.strokeRect(0, 0, 256, 256);
});

export const flagTex = (kind: FlagKind) => make("flag" + kind, 256, 160, (c) => {
  if (kind === "black") {
    c.fillStyle = "#0c0c10"; c.fillRect(0, 0, 256, 160);
    c.fillStyle = "#f2efe6"; c.strokeStyle = "#f2efe6";
    c.beginPath(); c.arc(128, 66, 30, 0, Math.PI * 2); c.fill();
    c.fillRect(110, 88, 36, 20);
    c.fillStyle = "#0c0c10"; c.beginPath(); c.arc(116, 64, 8, 0, 7); c.arc(140, 64, 8, 0, 7); c.fill();
    c.beginPath(); c.moveTo(128, 72); c.lineTo(123, 82); c.lineTo(133, 82); c.fill();
    for (let i = 0; i < 4; i++) c.fillRect(114 + i * 9, 96, 3, 12);
    c.lineWidth = 9; c.lineCap = "round"; c.strokeStyle = "#f2efe6";
    c.beginPath(); c.moveTo(66, 112); c.lineTo(190, 136); c.moveTo(190, 112); c.lineTo(66, 136); c.stroke();
    c.fillStyle = "#f2efe6"; for (const x of [62, 194]) for (const y of [110, 138]) { c.beginPath(); c.arc(x, y, 7, 0, 7); c.fill(); }
  } else if (kind === "red") {
    c.fillStyle = "#b31217"; c.fillRect(0, 0, 256, 160);
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(0, 0, 256, 12); c.fillRect(0, 148, 256, 12);
    c.fillStyle = "#1a0a0a"; c.beginPath(); c.moveTo(106, 40); c.lineTo(150, 40); c.lineTo(128, 80); c.lineTo(150, 120); c.lineTo(106, 120); c.lineTo(128, 80); c.fill();
  } else if (kind === "white") {
    c.fillStyle = "#f4f4ef"; c.fillRect(0, 0, 256, 160);
  } else {
    const cols = ["#1f3f8a", "#f1f1ec", "#b3262b"];
    for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; c.fillRect(0, i * 54, 256, 54); }
    c.fillStyle = "#f1f1ec"; c.fillRect(0, 0, 90, 80); c.fillStyle = "#b3262b"; c.fillRect(38, 0, 14, 80); c.fillRect(0, 33, 90, 14);
  }
});

export const softTex = () => make("soft", 128, 128, (c) => {
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, 128, 128);
});
export const puffTex = () => make("puff", 128, 128, (c) => {
  c.fillStyle = "rgba(0,0,0,0)"; c.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 14; i++) {
    const x = 64 + (hash(i) - 0.5) * 50, y = 64 + (hash(i + 20) - 0.5) * 50, r = 20 + hash(i + 40) * 22;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,0.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
});
export const hullPanelTex = () => make("hullpanel", 256, 256, (c) => {
  c.fillStyle = "#4a2f1d"; c.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 20) { c.fillStyle = y % 40 ? "#3d2617" : "#56371f"; c.fillRect(0, y, 256, 18); c.fillStyle = "rgba(0,0,0,0.45)"; c.fillRect(0, y + 18, 256, 2); }
  for (let i = 0; i < 40; i++) { c.fillStyle = "rgba(0,0,0,0.2)"; c.fillRect(hash(i) * 256, hash(i + 4) * 256, 2, 14); }
});
export const sailPanelTex = () => sailTex(false);
