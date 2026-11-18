import type { EaseName, Vec3 } from "./engine/math";
export type { Vec3, EaseName };

export type ShipKind = "sloop" | "galleon" | "qar";
export type FlagKind = "black" | "red" | "merchant" | "white" | "none";

export interface ShipSpec {
  id: string;
  kind: ShipKind;
  /** position [x,z] at time atT, then moves with vel [x,z] m/s */
  at: [number, number];
  atT: number;
  vel: [number, number];
  /** optional piecewise-linear path (overrides at/vel position) */
  legs?: { t: number; at: [number, number] }[];
  scale?: number;
  billow?: number;
  flag?: FlagKind;
  /** flag hoist [startSec, endSec] (flag climbs from deck to masthead) */
  flagRise?: [number, number];
  /** swap flag at time t: old one is lowered, new one is hoisted */
  flagSwap?: { t: number; kind: FlagKind };
  roll?: number;
  hullColor?: string;
  trim?: string;
  mastBreak?: { t: number; mast: number };
  portsOpen?: [number, number];
  /** override heading (radians) instead of deriving from velocity */
  heading?: number;
  seed?: number;
}

export type ActionName =
  | "idle" | "point" | "cheer" | "panic" | "shout" | "telescope" | "steer"
  | "haul" | "laugh" | "menace" | "cower" | "slash" | "aim" | "scrape"
  | "surrender" | "fire" | "salute" | "wave" | "leap" | "brace"
  | "dance1" | "dance2" | "dance3" | "walk" | "watch" | "talk" | "confused" | "play" | "argue";

export type Expr = "neutral" | "grin" | "angry" | "scared" | "shock" | "smug" | "shout" | "confused" | "curious" | "happy" | "sad";

export interface CharLook {
  skin: string; coat: string; shirt: string; pants: string;
  hat: "tricorn" | "bandana" | "cap" | "wig" | "captain" | "coif" | "hood" | "official" | "feather" | "none";
  hatColor: string;
  beard: "none" | "stubble" | "black" | "goatee" | "grey" | "mustache";
  hair: string;
  prop: "none" | "sword" | "spyglass" | "pistol" | "musket" | "torch" | "brush" | "lute" | "drum" | "pipe" | "scroll" | "staff";
  build: number;
  sash?: string;
  patch?: boolean;
  fuses?: boolean;
  /** long dress / robe covering the legs */
  dress?: boolean;
  /** apron / vest detail color */
  apron?: string;
}

export interface CharAction { t: number; a: ActionName; expr?: Expr; gaze?: number }
export interface CharMove { t0: number; t1: number; ship: string; local: Vec3; arc: number }

export interface CharSpec {
  id: string;
  look: CharLook;
  ship?: string;
  local: Vec3;
  facing: 1 | -1;
  scale: number;
  actions: CharAction[];
  talk?: [number, number][];
  moves?: CharMove[];
}

export interface CamKey {
  t: number;
  pos: Vec3;
  look: Vec3;
  fov: number;
  roll?: number;
  /** positions/looks are offsets from this entity (ship or character id) */
  target?: string;
  lookTarget?: string;
  /** rotate offsets with the entity heading (tracking shots) */
  rel?: boolean;
  /** interpolation of the segment starting at this key */
  ease?: EaseName;
  /** handheld shake amplitude */
  shake?: number;
  /** extra yaw swing (radians) peaking mid-segment: whip-pan */
  whip?: number;
}

export interface AtmoKey {
  t: number;
  zenith: string; horizon: string; fog: string; fogD: number;
  sunCol: string; sunElev: number; sunAz: number; sunI: number;
  ambSky: string; ambGround: string; ambI: number;
  cloud: number; storm: number;
  deep: string; shallow: string; foam: number;
}

export interface Narration { id: string; text: string; start: number; end: number }
export interface Callout { t: number; dur: number; text: string; sub?: string; side?: "left" | "right" }
export interface SfxCue { t: number; file: string; vol?: number }
export interface FxEvent {
  t: number;
  kind: "cannon" | "splash" | "muzzle" | "lightning" | "grapple" | "debris";
  ship?: string;
  local?: Vec3;
  world?: Vec3;
  dir?: Vec3;
  target?: string;
}
export interface Transition { t: number; dur: number; kind: "sail" | "hull" | "spray" | "smoke" | "gulls"; dir: 1 | -1 }
export interface ShakeEvent { t: number; amp: number; dur: number }
export interface IslandSpec { id: string; at: [number, number]; radius: number; peak: number; seed: number; palms: number; houses?: number; fort?: boolean; rot?: number; sandOnly?: boolean }
export interface GullFlock { at: Vec3; n: number; seed: number; r: number; speed: number }

/** Story structure of a 60 s episode. Used by the QC script checks (src/history/qc/script.ts). */
export type BeatKind = "hook" | "setting" | "conflict" | "escalation" | "twist" | "resolution";
export interface StoryBeat { t: number; kind: BeatKind; note: string }
export interface StoryPlan {
  logline: string;
  setting: { place: string; year?: number };
  /** CharSpec id of the protagonist (should appear in several scenes) */
  protagonist?: string;
  /** CharSpec ids of supporting characters */
  supporting?: string[];
  beats: StoryBeat[];
}

export interface Episode {
  id: string;
  title: string;
  /** optional story plan; when present the script QC checks the structure against it */
  story?: StoryPlan;
  fps: number;
  durationSec: number;
  ships: ShipSpec[];
  chars: CharSpec[];
  islands: IslandSpec[];
  gulls: GullFlock[];
  cameras: CamKey[];
  atmo: AtmoKey[];
  narration: Narration[];
  callouts: Callout[];
  sfx: SfxCue[];
  fx: FxEvent[];
  transitions: Transition[];
  shakes: ShakeEvent[];
  music: { file: string; vol: number };
  ambience: { file: string; vol: number };
}
