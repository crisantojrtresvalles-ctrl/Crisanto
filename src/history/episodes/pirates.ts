import type { Narration, AtmoKey, CamKey, CharAction, CharLook, CharSpec, Episode, FxEvent, ShipSpec, SfxCue, Vec3 } from "../types";
import { hgt } from "../world/Island";
import narrationData from "./pirates.narration.json";

const skin = { a: "#e2b08a", b: "#b9794f", c: "#8c5a3c", d: "#f0c9a2" };
const L = (o: Partial<CharLook>): CharLook => ({ skin: skin.a, coat: "#6e2f2a", shirt: "#ebe4d0", pants: "#3b3f4f", hat: "bandana", hatColor: "#b3262b", beard: "stubble", hair: "#3a2a1c", prop: "none", build: 1, ...o });
const A = (t: number, a: CharAction["a"], extra: Partial<CharAction> = {}): CharAction => ({ t, a, ...extra });

// ---------- ATMOSPHERE ----------
const base = { ambGround: "#4a5a48", foam: 0.6 };
const atmo: AtmoKey[] = [
  { t: 0, zenith: "#16222f", horizon: "#52666f", fog: "#4a5c66", fogD: 0.0082, sunCol: "#ffc98f", sunElev: 0.16, sunAz: 2.6, sunI: 0.55, ambSky: "#6a8296", ambGround: "#1b2630", ambI: 0.7, cloud: 0.95, storm: 0.9, deep: "#0a2230", shallow: "#1c4b5c", foam: 0.95 },
  { t: 5.8, zenith: "#16222f", horizon: "#52666f", fog: "#4a5c66", fogD: 0.0082, sunCol: "#ffc98f", sunElev: 0.16, sunAz: 2.6, sunI: 0.55, ambSky: "#6a8296", ambGround: "#1b2630", ambI: 0.7, cloud: 0.95, storm: 0.9, deep: "#0a2230", shallow: "#1c4b5c", foam: 0.95 },
  { t: 6.9, zenith: "#2f7fc8", horizon: "#bfe4f4", fog: "#c9e6f1", fogD: 0.0032, sunCol: "#fff0c4", sunElev: 0.82, sunAz: 1.3, sunI: 1.5, ambSky: "#bfe0ff", ambGround: "#5d7a55", ambI: 0.95, cloud: 0.42, storm: 0, deep: "#0b6286", shallow: "#35b7c0", foam: 0.5 },
  { t: 19.6, zenith: "#2f7fc8", horizon: "#bfe4f4", fog: "#c9e6f1", fogD: 0.0032, sunCol: "#fff0c4", sunElev: 0.72, sunAz: 1.2, sunI: 1.5, ambSky: "#bfe0ff", ambGround: "#5d7a55", ambI: 0.95, cloud: 0.45, storm: 0.05, deep: "#0b6286", shallow: "#35b7c0", foam: 0.55 },
  { t: 20.9, zenith: "#3a68a0", horizon: "#f4c48a", fog: "#e4bb8d", fogD: 0.0042, sunCol: "#ffb468", sunElev: 0.34, sunAz: 1.1, sunI: 1.55, ambSky: "#9bb4d6", ambGround: base.ambGround, ambI: 0.8, cloud: 0.55, storm: 0.18, deep: "#0f4560", shallow: "#2b8a92", foam: 0.7 },
  { t: 26.7, zenith: "#3a68a0", horizon: "#f4c48a", fog: "#e4bb8d", fogD: 0.0042, sunCol: "#ffb468", sunElev: 0.34, sunAz: 1.1, sunI: 1.55, ambSky: "#9bb4d6", ambGround: base.ambGround, ambI: 0.8, cloud: 0.55, storm: 0.18, deep: "#0f4560", shallow: "#2b8a92", foam: 0.7 },
  { t: 27.7, zenith: "#2b2f6a", horizon: "#ff9a58", fog: "#dc8a62", fogD: 0.0046, sunCol: "#ff8a3c", sunElev: 0.13, sunAz: 2.3, sunI: 1.5, ambSky: "#8c78aa", ambGround: "#3a2f3a", ambI: 0.75, cloud: 0.62, storm: 0.1, deep: "#13304d", shallow: "#3b6f8c", foam: 0.6 },
  { t: 33.7, zenith: "#2b2f6a", horizon: "#ff9a58", fog: "#dc8a62", fogD: 0.0046, sunCol: "#ff8a3c", sunElev: 0.13, sunAz: 2.3, sunI: 1.5, ambSky: "#8c78aa", ambGround: "#3a2f3a", ambI: 0.75, cloud: 0.62, storm: 0.1, deep: "#13304d", shallow: "#3b6f8c", foam: 0.6 },
  { t: 34.7, zenith: "#3a76b8", horizon: "#f6d7a0", fog: "#e8cfa4", fogD: 0.0038, sunCol: "#ffd9a0", sunElev: 0.5, sunAz: 1.4, sunI: 1.5, ambSky: "#b4cbe6", ambGround: base.ambGround, ambI: 0.9, cloud: 0.5, storm: 0.05, deep: "#0d5878", shallow: "#2fa6b0", foam: 0.55 },
  { t: 40.8, zenith: "#3a76b8", horizon: "#f6d7a0", fog: "#e8cfa4", fogD: 0.0038, sunCol: "#ffd9a0", sunElev: 0.5, sunAz: 1.4, sunI: 1.5, ambSky: "#b4cbe6", ambGround: base.ambGround, ambI: 0.9, cloud: 0.5, storm: 0.05, deep: "#0d5878", shallow: "#2fa6b0", foam: 0.55 },
  { t: 41.8, zenith: "#141a3c", horizon: "#e8703c", fog: "#74495a", fogD: 0.0047, sunCol: "#ff7a2c", sunElev: 0.07, sunAz: 0.4, sunI: 1.35, ambSky: "#7a6a98", ambGround: "#2a2230", ambI: 0.8, cloud: 0.7, storm: 0.25, deep: "#081c2e", shallow: "#1d4c5e", foam: 0.8 },
  { t: 54.5, zenith: "#141a3c", horizon: "#e8703c", fog: "#74495a", fogD: 0.0047, sunCol: "#ff7a2c", sunElev: 0.07, sunAz: 0.4, sunI: 1.35, ambSky: "#7a6a98", ambGround: "#2a2230", ambI: 0.8, cloud: 0.7, storm: 0.25, deep: "#081c2e", shallow: "#1d4c5e", foam: 0.8 },
  { t: 59, zenith: "#2a3a78", horizon: "#ffa05a", fog: "#e8905e", fogD: 0.0036, sunCol: "#ffb060", sunElev: 0.1, sunAz: 0.3, sunI: 1.6, ambSky: "#9a86b4", ambGround: "#3a3038", ambI: 0.85, cloud: 0.55, storm: 0.1, deep: "#102f4e", shallow: "#3f7592", foam: 0.6 },
];

// ---------- SHIPS ----------
const gallGround: [number, number] = [2400, -10];
const gGz = (t: number) => gallGround[1] + 5.2 * (t - 34.2);
const ships: ShipSpec[] = [
  { id: "sA", kind: "sloop", at: [3, 60], atT: 0, vel: [0, -8.5], flag: "black", billow: 0.95, seed: 1 },
  { id: "gM", kind: "galleon", at: [-22, 105], atT: 0, vel: [0, 1.4], flag: "merchant", seed: 2 },
  { id: "sB", kind: "sloop", at: [400, -35], atT: 6.3, vel: [0, 7], flag: "black", seed: 3 },
  { id: "sC", kind: "sloop", at: [766, 0], atT: 0, vel: [0, 0], heading: 0, roll: 0.62, billow: 0.05, seed: 4 },
  { id: "sD", kind: "sloop", at: [1200, 0], atT: 16.3, vel: [0, 11], flag: "black", billow: 1, seed: 5 },
  { id: "gN", kind: "galleon", at: [1196, 62], atT: 16.3, vel: [0, 5.5], flag: "merchant", seed: 6 },
  { id: "sE", kind: "galleon", at: [1600, -10], atT: 20.2, vel: [0, 6], flag: "black", hullColor: "#1b1a1e", portsOpen: [21.2, 22.0], seed: 7 },
  { id: "gT", kind: "galleon", at: [1646, 25], atT: 20.2, vel: [0, 5.5], flag: "merchant", mastBreak: { t: 23.5, mast: 1 }, seed: 8 },
  { id: "sF", kind: "sloop", at: [2000, -30], atT: 27.2, vel: [0, 5], flag: "black", flagRise: [27.7, 28.9], flagSwap: { t: 32.0, kind: "red" }, seed: 9 },
  { id: "gF", kind: "galleon", at: [2034, -2], atT: 27.2, vel: [0, 4.5], flag: "merchant", seed: 10 },
  { id: "sG", kind: "sloop", at: [2414, -32], atT: 34.2, vel: [0, 6], legs: [{ t: 34.2, at: [2414, gGz(34.2) - 22] }, { t: 36.4, at: [2407.4, gGz(36.4) + 0.5] }, { t: 41.6, at: [2407.4, gGz(41.6) + 0.5] }], flag: "black", seed: 11 },
  { id: "gG", kind: "galleon", at: gallGround, atT: 34.2, vel: [0, 5.2], flag: "merchant", seed: 12 },
  { id: "qar", kind: "qar", at: [2800, 0], atT: 41.2, vel: [0, 3.5], flag: "black", portsOpen: [45.6, 48.2], seed: 13 },
  { id: "gS", kind: "galleon", at: [2822, 27.3], atT: 49, vel: [0, 3.5], flag: "merchant", flagSwap: { t: 53.3, kind: "white" }, seed: 14 },
  { id: "sH1", kind: "sloop", at: [2764, -34], atT: 41, vel: [0, 3.8], flag: "black", seed: 15 },
  { id: "sH2", kind: "sloop", at: [2748, -52], atT: 41, vel: [0, 3.8], flag: "black", seed: 16 },
];

// ---------- CHARACTERS ----------
const sloopDeck = 1.15, galDeck = 2.85;
const beachY = (x: number, z: number) => hgt({ id: "isl3", at: [800, 0], radius: 34, peak: 8, seed: 5, palms: 0 }, x - 800, z) + 0.05;
const chars: CharSpec[] = [
  // S1 hook
  { id: "helm1", look: L({ skin: skin.b, hat: "bandana" }), ship: "sA", local: [0, 1.5, -5.2], facing: 1, scale: 0.8, actions: [A(0, "steer", { expr: "angry" }), A(4.4, "shout")] },
  { id: "look1", look: L({ skin: skin.d, hat: "cap", hatColor: "#2c4a7a", prop: "spyglass", coat: "#4a5a3a", beard: "none" }), ship: "sA", local: [0, sloopDeck + 0.2, 4.2], facing: 1, scale: 0.8, actions: [A(0, "telescope"), A(3.4, "point", { expr: "grin" })] },
  // S2 sloop
  { id: "capt2", look: L({ hat: "captain", hatColor: "#1d1d26", coat: "#8e1f2b", beard: "goatee", prop: "sword", skin: skin.a, hair: "#2a1d14" }), ship: "sB", local: [0, 1.5, -5], facing: 1, scale: 0.8, actions: [A(6.3, "steer"), A(9.4, "point", { expr: "grin" }), A(11.6, "steer", { expr: "smug" })], talk: [[6.8, 12.9]] },
  { id: "hand2", look: L({ skin: skin.c, hat: "bandana", hatColor: "#2e6a8f", beard: "none" }), ship: "sB", local: [1.1, sloopDeck, 2.2], facing: -1, scale: 0.8, actions: [A(6.3, "haul"), A(10.6, "cheer")] },
  { id: "top2", look: L({ skin: skin.d, hat: "cap", hatColor: "#8a2a2a", beard: "none", prop: "none" }), ship: "sB", local: [0.6, 8.4, 1.5], facing: 1, scale: 0.7, actions: [A(6.3, "wave", { expr: "grin" })] },
  // S3a careen
  { id: "scr1", look: L({ skin: skin.c, hat: "bandana", hatColor: "#a34a32", prop: "brush", beard: "stubble" }), local: [773.2, beachY(773.2, -3), -3], facing: 1, scale: 0.85, actions: [A(13.2, "scrape")] },
  { id: "scr2", look: L({ skin: skin.b, hat: "cap", hatColor: "#2c4a7a", prop: "brush", beard: "goatee" }), local: [773.6, beachY(773.6, 2.4), 2.4], facing: 1, scale: 0.85, actions: [A(13.2, "scrape"), A(15.6, "laugh")] },
  // S3b chase
  { id: "helm3", look: L({ skin: skin.a, hat: "tricorn", hatColor: "#17171c", coat: "#2a3f6a", beard: "stubble" }), ship: "sD", local: [0, 1.5, -5], facing: 1, scale: 0.8, actions: [A(16.3, "steer", { expr: "smug" }), A(18.6, "shout")] },
  { id: "bow3", look: L({ skin: skin.c, hat: "bandana", hatColor: "#b3262b", prop: "sword" }), ship: "sD", local: [0, sloopDeck + 0.3, 4.6], facing: 1, scale: 0.8, actions: [A(16.3, "point"), A(18.8, "cheer")] },
  { id: "sail3a", look: L({ skin: skin.d, hat: "cap", hatColor: "#cfc7ae", coat: "#7a6a4a", beard: "none" }), ship: "gN", local: [1.5, galDeck, -7], facing: -1, scale: 0.85, actions: [A(16.3, "idle"), A(17.4, "panic")] },
  { id: "sail3b", look: L({ skin: skin.b, hat: "wig", hatColor: "#2a3f6a", coat: "#2a3f6a", beard: "none" }), ship: "gN", local: [-1.2, galDeck + 5.8, -12.5], facing: -1, scale: 0.85, actions: [A(16.3, "telescope", { gaze: 0.9 }), A(17.8, "panic")] },
  // S4 battle
  { id: "gun1", look: L({ skin: skin.c, hat: "bandana", hatColor: "#1d1d26", prop: "torch", coat: "#3d2a22", beard: "black" }), ship: "sE", local: [3.0, galDeck, 2.4], facing: 1, scale: 0.85, actions: [A(20.2, "brace"), A(22.1, "fire", { expr: "grin" }), A(23.2, "cheer")] },
  { id: "gun2", look: L({ skin: skin.b, hat: "cap", hatColor: "#b3262b", prop: "torch", coat: "#2b3a4a" }), ship: "sE", local: [3.0, galDeck, -2.8], facing: 1, scale: 0.85, actions: [A(20.2, "brace"), A(22.5, "fire", { expr: "shout" }), A(23.4, "laugh")] },
  { id: "musk", look: L({ skin: skin.a, hat: "tricorn", hatColor: "#17171c", prop: "musket", coat: "#6e2f2a", beard: "stubble" }), ship: "sE", local: [2.7, galDeck + 0.15, 6.2], facing: 1, scale: 0.85, actions: [A(20.2, "brace"), A(24.2, "aim"), A(25.4, "cheer")] },
  { id: "cut", look: L({ skin: skin.d, hat: "bandana", hatColor: "#2e6a8f", prop: "sword", coat: "#7a2a2a", beard: "goatee" }), ship: "sE", local: [2.2, galDeck, -6.3], facing: 1, scale: 0.85, actions: [A(20.2, "brace"), A(24.8, "slash", { expr: "shout" })] },
  { id: "capt4", look: L({ hat: "captain", hatColor: "#1d1d26", coat: "#8e1f2b", prop: "sword", beard: "goatee" }), ship: "sE", local: [0, galDeck + 2.9, -9.5], facing: 1, scale: 0.85, actions: [A(20.2, "menace"), A(23.0, "point", { expr: "grin" })] },
  { id: "tsail", look: L({ skin: skin.b, hat: "cap", hatColor: "#cfc7ae", coat: "#7a6a4a", beard: "none" }), ship: "gT", local: [1.4, galDeck, 4], facing: -1, scale: 0.85, actions: [A(20.2, "idle"), A(22.4, "panic")] },
  // S5 flags
  { id: "capt5", look: L({ hat: "captain", hatColor: "#17171c", coat: "#8e1f2b", prop: "sword", beard: "goatee", hair: "#241a12" }), ship: "sF", local: [0, 1.55, -4.8], facing: 1, scale: 0.85, actions: [A(27.2, "menace"), A(29.6, "point", { expr: "smug" }), A(31.9, "laugh")] },
  { id: "crew5", look: L({ skin: skin.c, hat: "bandana", hatColor: "#2e6a8f", prop: "pistol", beard: "stubble" }), ship: "sF", local: [0.2, sloopDeck, 2.6], facing: 1, scale: 0.85, actions: [A(27.2, "brace"), A(32.0, "shout")] },
  { id: "mcap", look: L({ skin: skin.d, hat: "wig", hatColor: "#2a3f6a", coat: "#3d5a80", beard: "none", build: 1.05 }), ship: "gF", local: [0, galDeck, -1.5], facing: -1, scale: 0.95, actions: [A(27.2, "idle", { expr: "scared" }), A(29.8, "surrender", { expr: "shock" }), A(31.2, "idle", { expr: "scared" }), A(32.4, "cower")], talk: [[29.6, 30.6]] },
  { id: "msail", look: L({ skin: skin.b, hat: "cap", hatColor: "#cfc7ae", coat: "#7a6a4a", beard: "none" }), ship: "gF", local: [-1.8, galDeck, 3.2], facing: -1, scale: 0.85, actions: [A(27.2, "panic"), A(30.0, "surrender"), A(32.5, "cower")] },
  { id: "msail2", look: L({ skin: skin.a, hat: "bandana", hatColor: "#cfc7ae", coat: "#5a6a7a", beard: "stubble" }), ship: "gF", local: [1.8, galDeck, 6], facing: -1, scale: 0.85, actions: [A(27.2, "brace"), A(30.2, "surrender"), A(32.6, "cower")] },
  // S6 boarding
  { id: "bd1", look: L({ skin: skin.c, hat: "bandana", hatColor: "#b3262b", prop: "sword", beard: "stubble" }), ship: "sG", local: [-1.1, sloopDeck + 0.5, 0.5], facing: -1, scale: 0.85, actions: [A(34.2, "brace"), A(36.0, "slash", { expr: "shout" }), A(37.9, "leap")], moves: [{ t0: 37.8, t1: 38.7, ship: "gG", local: [1.2, galDeck + 0.9, 1], arc: 2.2 }] },
  { id: "bd2", look: L({ skin: skin.a, hat: "cap", hatColor: "#2c4a7a", prop: "pistol", beard: "goatee" }), ship: "sG", local: [1.0, sloopDeck + 0.5, -2.2], facing: -1, scale: 0.85, actions: [A(34.2, "haul"), A(37.6, "shout"), A(38.1, "leap")], moves: [{ t0: 38.1, t1: 39.0, ship: "gG", local: [-1.2, galDeck + 0.9, -3.5], arc: 2.6 }] },
  { id: "bd3", look: L({ skin: skin.b, hat: "tricorn", hatColor: "#17171c", prop: "sword", coat: "#2a3f6a", beard: "stubble" }), ship: "sG", local: [0, sloopDeck + 1.0, 4.4], facing: -1, scale: 0.85, actions: [A(34.2, "point"), A(36.2, "haul"), A(38.3, "leap", { expr: "shout" })], moves: [{ t0: 38.3, t1: 39.2, ship: "gG", local: [1.4, galDeck + 0.9, 5], arc: 2.0 }] },
  { id: "gcrew1", look: L({ skin: skin.d, hat: "cap", hatColor: "#cfc7ae", coat: "#7a6a4a", beard: "none" }), ship: "gG", local: [-1.0, galDeck, 0.5], facing: 1, scale: 0.85, actions: [A(34.2, "idle"), A(35.6, "panic"), A(39.0, "surrender")] },
  { id: "gcrew2", look: L({ skin: skin.c, hat: "wig", hatColor: "#2a3f6a", coat: "#4a6a4a", beard: "none" }), ship: "gG", local: [0.6, galDeck, -4], facing: 1, scale: 0.85, actions: [A(34.2, "idle"), A(36.4, "panic"), A(39.4, "surrender")] },
  // S7/8 Queen Anne's Revenge
  { id: "bb", look: L({ skin: skin.c, hat: "tricorn", hatColor: "#0d0d12", coat: "#1b1b24", sash: "#9b1d1d", beard: "black", hair: "#0d0d12", prop: "pistol", build: 1.2, fuses: true }), ship: "qar", local: [0, 8.45, -12.9], facing: 1, scale: 1.0, actions: [A(41.2, "menace", { expr: "angry" }), A(46.0, "laugh"), A(48.6, "shout"), A(49.5, "menace", { expr: "smug" }), A(51.2, "laugh"), A(53.0, "point", { expr: "grin" })], talk: [[48.6, 49.2]] },
  { id: "qc1", look: L({ skin: skin.b, hat: "bandana", hatColor: "#b3262b", prop: "sword" }), ship: "qar", local: [-2.4, 2.75, 3.5], facing: 1, scale: 0.85, actions: [A(41.2, "cheer"), A(47.0, "slash")] },
  { id: "qc2", look: L({ skin: skin.a, hat: "cap", hatColor: "#2c4a7a", prop: "musket" }), ship: "qar", local: [2.6, 2.75, -2.6], facing: 1, scale: 0.85, actions: [A(41.2, "aim"), A(46.0, "cheer")] },
  { id: "qc3", look: L({ skin: skin.c, hat: "bandana", hatColor: "#2e6a8f", prop: "torch" }), ship: "qar", local: [1.2, 3.35, 10.4], facing: 1, scale: 0.85, actions: [A(41.2, "point"), A(45.6, "fire")] },
  { id: "gsc1", look: L({ skin: skin.d, hat: "cap", hatColor: "#cfc7ae", coat: "#7a6a4a", beard: "none" }), ship: "gS", local: [-1.2, galDeck, 2], facing: 1, scale: 0.85, actions: [A(49, "brace"), A(52.6, "surrender")] },
  { id: "gsc2", look: L({ skin: skin.b, hat: "wig", hatColor: "#2a3f6a", coat: "#3d5a80", beard: "none" }), ship: "gS", local: [1.0, galDeck, -3], facing: 1, scale: 0.9, actions: [A(49, "brace", { expr: "scared" }), A(52.8, "surrender", { expr: "shock" })] },
  { id: "gsc3", look: L({ skin: skin.a, hat: "bandana", hatColor: "#cfc7ae", coat: "#5a6a7a" }), ship: "gS", local: [-0.6, galDeck, 7], facing: 1, scale: 0.85, actions: [A(49, "brace"), A(52.9, "surrender")] },
];

// ---------- CAMERA ----------
const K = (t: number, pos: Vec3, look: Vec3, fov: number, o: Partial<CamKey> = {}): CamKey => ({ t, pos, look, fov, ...o });
const O = (t: number, target: string, az: number, el: number, d: number, look: Vec3, fov: number, o: Partial<CamKey> = {}): CamKey =>
  K(t, [Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d], look, fov, { target, rel: true, ...o });
/** camera positioned relative to a character (world-aligned offsets), looking at them */
const C = (t: number, id: string, off: Vec3, lookOff: Vec3, fov: number, o: Partial<CamKey> = {}): CamKey => K(t, off, lookOff, fov, { target: id, ...o });
const cameras: CamKey[] = [
  // S1 hook: low wide -> rise & follow the sloop
  K(0, [0, 0.9, 0], [1, 3.2, 60], 64, { shake: 0.8 }),
  K(2.6, [-1, 1.7, 1.5], [0.5, 5.2, 36], 54, { shake: 0.6 }),
  K(4.5, [-2.2, 2.5, 3], [2, 5, 18], 48, { shake: 0.9 }),
  K(5.8, [-3, 3.1, 4], [2.5, 4.5, 3], 44, { shake: 1.0, ease: "snap", whip: 0.9 }),
  // S2 sloop design: full ship -> mast -> sail -> waterline -> wide cove
  O(6.8, "sB", 2.2, 0.12, 31, [0, 5.5, 0], 55, { shake: 0.5 }),
  O(8.3, "sB", 1.8, 0.22, 21, [0, 8.5, 1], 58),
  O(9.8, "sB", 1.2, 0.36, 19, [0, 7.0, -1.5], 60),
  O(11.2, "sB", 1.55, 0.08, 13, [0, 1.6, 0.5], 62),
  O(12.6, "sB", 0.9, 0.3, 50, [-6, 3, 6], 58, { shake: 0.3 }),
  O(13.0, "sB", 0.8, 0.32, 54, [-7, 3, 7], 58, { ease: "snap", whip: -0.8 }),
  // S3a careening on the beach
  K(13.7, [790, 3.4, -15], [770, 2.4, -1], 56, { shake: 0.3 }),
  K(15.2, [782, 2.4, -8], [772.5, 2.4, -1.5], 48, { shake: 0.3 }),
  K(16.0, [777, 2.0, -6], [773.6, 2.0, -3], 40, { ease: "snap", whip: 0.7 }),
  // S3b chase
  O(16.7, "sD", 1.25, 0.1, 24, [0, 4, 2], 58, { shake: 0.6 }),
  O(18.2, "sD", 3.1, 0.2, 14, [0, 5.5, 22], 56, { shake: 0.8 }),
  O(19.3, "sD", 3.14, 0.5, 62, [0, 0, 26], 62, { shake: 0.4 }),
  O(19.8, "sD", 3.14, 0.52, 66, [0, 0, 28], 64, { ease: "snap", whip: 0.9 }),
  // S4 battle: wide broadside -> cannons -> whip to the target mast -> deck close-ups
  O(20.7, "sE", 1.35, 0.1, 52, [0, 5, 0], 55, { shake: 0.7 }),
  O(22.0, "sE", 1.2, 0.1, 26, [0, 4.2, 0.5], 52, { shake: 1.2 }),
  K(23.1, [30, 4.5, 4], [0, 9, 0], 58, { target: "sE", lookTarget: "gT", rel: false, shake: 1.0 }),
  K(23.9, [30, 4.5, 4], [0, 10, 0], 56, { target: "sE", lookTarget: "gT", rel: false, shake: 1.0 }),
  C(24.5, "musk", [6.6, 1.3, -2.4], [0, 1.2, 0], 44, { shake: 1.2 }),
  C(25.6, "cut", [6.2, 1.0, -2.0], [0, 1.4, 0], 42, { shake: 1.2 }),
  C(26.6, "capt4", [6.4, 0.2, -2.0], [0, 1.2, 0], 46, { ease: "snap", whip: -0.9 }),
  // S5 flags: low angle up the mast, merchant captain surrenders, red flag
  O(27.6, "sF", 1.3, 0.05, 13, [0, 9, 1.2], 70, { shake: 0.5 }),
  O(29.3, "sF", 0.8, 0.1, 15, [0, 11, 1.2], 56, { shake: 0.4 }),
  C(29.9, "mcap", [-5.2, 1.6, 2.6], [0, 1.6, 0], 40, { shake: 0.5 }),
  C(31.3, "mcap", [-3.4, 1.3, 1.7], [0, 1.7, 0], 34, { shake: 0.6 }),
  O(31.9, "sF", 1.3, 0.05, 13, [0, 12, 1.2], 70, { shake: 0.4, ease: "snap" }),
  O(33.5, "sF", 1.0, 0.25, 36, [0, 7, 3], 56),
  O(33.9, "sF", 0.9, 0.28, 38, [0, 7, 4], 56, { ease: "snap", whip: 0.8 }),
  // S6 boarding: close in, between the hulls, over the deck
  O(34.8, "sG", 0.9, 0.12, 28, [0, 3, 2], 55, { shake: 0.7 }),
  K(36.3, [3.7, 2.6, 16], [3.7, 3.6, 0], 50, { target: "gG", shake: 0.9 }),
  K(37.7, [3.7, 3.5, 9], [3.7, 4.2, 1], 46, { target: "gG", shake: 1.0 }),
  K(39.2, [3.7, 9, 7], [0, 3.2, -1], 56, { target: "gG", shake: 0.8 }),
  K(40.7, [3, 13, -2], [0, 3, 3], 70, { target: "gG", shake: 0.5, ease: "snap", whip: 0.7 }),
  // S7 Queen Anne's Revenge reveal: stern -> orbit -> broadside ports -> bow quarter
  O(41.8, "qar", 3.3, 0.12, 30, [0, 8, -15], 52, { shake: 0.4 }),
  O(43.8, "qar", 2.4, 0.25, 56, [0, 9, -4], 52),
  O(46.2, "qar", 1.57, 0.08, 72, [0, 7, 0], 50),
  O(48.2, "qar", 0.6, 0.12, 58, [0, 10, 2], 55),
  // S8 push-in on Blackbeard (smoking fuses), then whip-pan to the surrendering ship
  K(49.6, [3, 10.2, -4], [0, 10, -12.9], 40, { target: "qar", rel: true }),
  K(51.6, [1.3, 10.1, -9.4], [0, 10.0, -12.9], 32, { target: "qar", rel: true, shake: 0.2 }),
  K(52.6, [1.1, 10.1, -9.6], [0, 10.0, -12.9], 32, { target: "qar", rel: true, shake: 0.2 }),
  K(53.8, [-3, 10.5, -9], [0, 4.6, 0], 50, { target: "qar", lookTarget: "gS", rel: false, ease: "snap", whip: -0.5 }),
  K(55.0, [-4, 10.5, -9], [0, 4.6, 0], 52, { target: "qar", lookTarget: "gS", rel: false }),
  // S9 outro pull-out
  O(57.2, "qar", 2.6, 0.35, 70, [0, 6, 5], 52),
  O(60, "qar", 2.4, 0.55, 150, [0, 4, 10], 58),
];

// ---------- FX ----------
const gunPorts = [5.2, 3.6, 2.0, 0.4, -1.2, -2.8, -4.4];
const fx: FxEvent[] = [
  { t: 2.9, kind: "lightning", world: [-30, 0, 170] },
  { t: 4.9, kind: "lightning", world: [40, 0, 120] },
  ...gunPorts.map((z, i): FxEvent => ({ t: 22.3 + i * 0.14, kind: "cannon", ship: "sE", local: [5.0, i % 2 ? 2.2 : 3.0, z], dir: [1, 0.1, 0] })),
  ...[0, 2, 4, 6].map((i): FxEvent => ({ t: 22.95 + i * 0.16, kind: "splash", world: [1640 + (i % 3) * 3, 0.5, 14 + i * 2 + 5.5 * (22.95 + i * 0.16 - 20.2)] })),
  { t: 23.5, kind: "debris", ship: "gT", local: [0, 10, 0.5] },
  { t: 23.9, kind: "splash", ship: "gT", local: [-6, 0.5, 0.5] },
  { t: 24.6, kind: "muzzle", ship: "sE", local: [4.5, 3.6, 6.4], dir: [1, 0.05, 0.2] },
  { t: 25.1, kind: "muzzle", ship: "sE", local: [4.5, 3.6, 6.4], dir: [1, 0.05, 0.2] },
  { t: 36.0, kind: "grapple", ship: "sG", local: [-1.6, 3.6, 1.5], dir: [1.6, 4, 1.5], target: "gG" },
  { t: 36.18, kind: "grapple", ship: "sG", local: [-1.6, 3.2, -1.5], dir: [1.6, 4, -2], target: "gG" },
  { t: 36.36, kind: "grapple", ship: "sG", local: [-1.6, 3.4, 4.5], dir: [1.6, 4, 5], target: "gG" },
  { t: 52.0, kind: "muzzle", ship: "qar", local: [0, 8.5, -12.9], dir: [0, 1, 0] },
];
const cannonSfx: SfxCue[] = gunPorts.slice(0, 6).map((_, i) => ({ t: 22.3 + i * 0.14, file: "cannon.wav", vol: i % 2 ? 0.8 : 1 }));
const sfx: SfxCue[] = [
  { t: 2.8, file: "thunder.wav", vol: 0.9 }, { t: 4.85, file: "thunder.wav", vol: 0.6 },
  { t: 5.65, file: "whoosh.wav", vol: 0.9 },
  { t: 7.4, file: "gull.wav", vol: 0.5 }, { t: 8.4, file: "creak.wav", vol: 0.5 }, { t: 10.6, file: "gull.wav", vol: 0.4 }, { t: 11.0, file: "splash.wav", vol: 0.4 },
  { t: 12.75, file: "whoosh2.wav", vol: 0.9 },
  { t: 14.3, file: "thud.wav", vol: 0.5 }, { t: 14.9, file: "thud.wav", vol: 0.5 }, { t: 15.6, file: "gull.wav", vol: 0.35 },
  { t: 15.85, file: "whoosh.wav", vol: 0.85 }, { t: 17.6, file: "splash.wav", vol: 0.5 }, { t: 18.4, file: "flap.wav", vol: 0.5 },
  { t: 19.65, file: "whoosh2.wav", vol: 0.9 },
  ...cannonSfx,
  { t: 23.0, file: "splash.wav", vol: 0.7 }, { t: 23.5, file: "crack.wav", vol: 1 }, { t: 23.95, file: "splash.wav", vol: 0.9 },
  { t: 24.6, file: "musket.wav", vol: 0.8 }, { t: 25.1, file: "musket.wav", vol: 0.8 }, { t: 25.7, file: "clash.wav", vol: 0.7 }, { t: 26.1, file: "clash.wav", vol: 0.6 },
  { t: 26.95, file: "whoosh.wav", vol: 0.9 },
  { t: 27.9, file: "flap.wav", vol: 0.8 }, { t: 29.9, file: "gasp.wav", vol: 0.6 }, { t: 31.2, file: "flap.wav", vol: 0.7 }, { t: 32.3, file: "gasp.wav", vol: 0.7 },
  { t: 33.65, file: "whoosh2.wav", vol: 0.9 },
  { t: 36.0, file: "hook.wav", vol: 0.8 }, { t: 36.18, file: "hook.wav", vol: 0.8 }, { t: 36.36, file: "hook.wav", vol: 0.8 },
  { t: 36.9, file: "thud.wav", vol: 0.9 }, { t: 38.3, file: "thud.wav", vol: 0.8 }, { t: 38.8, file: "thud.wav", vol: 0.7 }, { t: 39.2, file: "gasp.wav", vol: 0.6 },
  { t: 40.75, file: "whoosh.wav", vol: 0.9 },
  { t: 42.5, file: "creak.wav", vol: 0.6 }, { t: 45.8, file: "thud.wav", vol: 0.8 }, { t: 46.4, file: "thud.wav", vol: 0.8 }, { t: 47.0, file: "thud.wav", vol: 0.8 }, { t: 47.6, file: "thud.wav", vol: 0.8 },
  { t: 49.9, file: "hiss.wav", vol: 0.7 }, { t: 52.0, file: "musket.wav", vol: 0.5 }, { t: 53.4, file: "whoosh2.wav", vol: 0.6 }, { t: 53.8, file: "flap.wav", vol: 0.6 },
  { t: 55.2, file: "whoosh.wav", vol: 0.7 }, { t: 57.0, file: "gull.wav", vol: 0.5 }, { t: 58.4, file: "gull.wav", vol: 0.4 },
];

const narration: Narration[] = narrationData;
export const pirates: Episode = {
  id: "ep001-pirate-ships",
  title: "What Made Pirate Ships So Dangerous?",
  fps: 30,
  durationSec: 60,
  ships, chars,
  islands: [
    { id: "isl2", at: [358, 16], radius: 32, peak: 9, seed: 3, palms: 16, rot: 0.4 },
    { id: "isl2b", at: [436, 62], radius: 24, peak: 6, seed: 8, palms: 9 },
    { id: "isl3", at: [800, 0], radius: 34, peak: 8, seed: 5, palms: 12 },
    { id: "isl5", at: [2090, 60], radius: 30, peak: 10, seed: 11, palms: 8, fort: true },
    { id: "isl6", at: [2490, 70], radius: 26, peak: 7, seed: 4, palms: 10, houses: 5 },
  ],
  gulls: [
    { at: [395, 22, 0], n: 6, seed: 1, r: 40, speed: 0.35 },
    { at: [1200, 22, 40], n: 4, seed: 4, r: 36, speed: 0.3 },
    { at: [2800, 30, 20], n: 7, seed: 9, r: 70, speed: 0.25 },
  ],
  cameras,
  atmo,
  narration,
  callouts: [
    { t: 7.7, dur: 1.9, text: "One mast", sub: "Sloop" },
    { t: 9.5, dur: 1.9, text: "Giant sail", sub: "Speed under wind", side: "right" },
    { t: 11.0, dur: 1.9, text: "Shallow hull", sub: "Hides in coves" },
    { t: 16.6, dur: 2.6, text: "Outruns warships", sub: "Clean hull = speed", side: "right" },
    { t: 20.9, dur: 1.9, text: "Broadside" },
    { t: 24.3, dur: 2.2, text: "Muskets & cutlasses", sub: "Close combat", side: "right" },
    { t: 29.5, dur: 2.0, text: "Black flag", sub: "Surrender = mercy" },
    { t: 32.1, dur: 1.9, text: "Red flag", sub: "No quarter", side: "right" },
    { t: 35.7, dur: 2.0, text: "Grappling hooks" },
    { t: 44.8, dur: 3.4, text: "About 40 guns", sub: "Queen Anne's Revenge", side: "right" },
    { t: 50.2, dur: 2.2, text: "Smoking fuses", sub: "Pure theater" },
  ],
  sfx,
  fx,
  transitions: [
    { t: 6.3, dur: 1.0, kind: "sail", dir: 1 },
    { t: 13.2, dur: 0.9, kind: "spray", dir: -1 },
    { t: 16.35, dur: 0.8, kind: "spray", dir: 1 },
    { t: 20.2, dur: 0.9, kind: "hull", dir: -1 },
    { t: 27.2, dur: 1.0, kind: "smoke", dir: 1 },
    { t: 34.2, dur: 0.9, kind: "sail", dir: -1 },
    { t: 41.2, dur: 1.0, kind: "hull", dir: 1 },
  ],
  shakes: [
    ...gunPorts.map((_, i) => ({ t: 22.3 + i * 0.14, amp: 3, dur: 0.35 })),
    { t: 23.5, amp: 4, dur: 0.6 }, { t: 24.6, amp: 2, dur: 0.3 }, { t: 25.1, amp: 2, dur: 0.3 },
    { t: 36.9, amp: 4, dur: 0.5 }, { t: 38.3, amp: 2, dur: 0.3 },
  ],
  music: { file: "music.wav", vol: 0.5 },
  ambience: { file: "ambience.wav", vol: 0.7 },
};
