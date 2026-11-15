import { drawCharacter } from "../../src/history/characters/draw";
import { poseAt } from "../../src/history/characters/pose";
import type { CharLook, CharAction } from "../../src/history/types";
const base: CharLook = { skin: "#fff", coat: "#c9b48a", shirt: "#efe6d0", pants: "#4a4036", hat: "none", hatColor: "#8a4a2a", beard: "none", hair: "#222", prop: "none", build: 1 };
const list: { look: Partial<CharLook>; act: CharAction["a"]; expr?: CharAction["expr"]; t: number }[] = [
  { look: { coat: "#b3262b", hat: "tricorn", hatColor: "#17171c", beard: "black", sash: "#d9b04a", fuses: true, prop: "pistol", build: 1.15 }, act: "menace", expr: "angry", t: 2.1 },
  { look: { coat: "#3d5a80", hat: "official", hatColor: "#2a2a33", beard: "mustache", apron: "" as never }, act: "confused", t: 2.3 },
  { look: { dress: true, coat: "#c9462f", shirt: "#efe6d0", hat: "coif", hatColor: "#f1e8d2" }, act: "dance1", t: 1.3 },
  { look: { coat: "#6a8f4a", hat: "feather", hatColor: "#8a4a2a", prop: "lute" }, act: "play", t: 1.7 },
  { look: { coat: "#d9a441", hat: "hood", hatColor: "#7a3a5a", apron: "#efe6d0" }, act: "dance2", t: 0.9 },
  { look: { coat: "#2b6a8f", hat: "bandana", hatColor: "#b3262b", beard: "stubble", prop: "sword" }, act: "slash", t: 3.0 },
  { look: { coat: "#7a7a82", hat: "wig", hatColor: "#2a3f6a", prop: "scroll" }, act: "talk", t: 2.4 },
  { look: { dress: true, coat: "#4a7a5a", hat: "none", prop: "none" }, act: "panic", expr: "scared", t: 1.1 },
];
const W = 288, H = 432;
const cv = document.createElement("canvas"); cv.width = W * 4; cv.height = H * 2; document.body.appendChild(cv);
const c = cv.getContext("2d")!; c.fillStyle = "#e9e3d6"; c.fillRect(0, 0, cv.width, cv.height);
list.forEach((e, i) => {
  const tmp = document.createElement("canvas"); tmp.width = W; tmp.height = H;
  const look = { ...base, ...e.look } as CharLook; if (!look.apron) delete look.apron;
  const { pose, blink } = poseAt([{ t: 0, a: e.act, expr: e.expr }], undefined, e.t, i * 3, 0);
  drawCharacter(tmp.getContext("2d")!, W, H, look, pose, { t: e.t, seed: i, blink, rimCol: "rgba(255,230,180,1)", rimSide: 1, tint: "rgb(120,120,140)", tintA: 0.0, shadeA: 0.2 });
  c.fillStyle = "rgba(60,50,30,0.25)"; c.beginPath(); c.ellipse((i % 4) * W + W / 2, Math.floor(i / 4) * H + H * 0.97, 55, 9, 0, 0, 7); c.fill();
  c.drawImage(tmp, (i % 4) * W, Math.floor(i / 4) * H);
});
(window as unknown as { done: boolean }).done = true;
