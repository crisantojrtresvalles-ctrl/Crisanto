export type Severity = "error" | "warn" | "info";

export interface Finding {
  /** check group, e.g. "camera", "lighting" */
  check: string;
  severity: Severity;
  /** time in seconds the finding refers to (if any) */
  t?: number;
  msg: string;
}

/** Tunable limits. Every default is a heuristic, documented in docs/ENGINE.md. */
export interface Thresholds {
  /** first narration must start by this time (immediate hook) */
  hookMaxStart: number;
  /** a year / clear setting must be spoken by this time */
  settingMaxT: number;
  /** narration pace limits, words per second */
  paceMin: number;
  paceMax: number;
  /** first on-screen character face: warn / error (seconds) */
  firstFaceWarn: number;
  firstFaceError: number;
  /** character height as fraction of frame height to count as a visible face */
  faceFrac: number;
  /** camera world speed (m/s) above which a frame pair is a scene jump */
  jumpSpeed: number;
  /** camera turn per frame (degrees) above which a frame pair is a scene jump */
  jumpAngle: number;
  /** camera turn in frame widths per frame at/above which an unmasked move is a hard cut (below it: a violent whip-pan warning) */
  hardCutWidths: number;
  /** a jump must lie within a transition window padded by this many seconds */
  maskPad: number;
  /** scene jumps per 10 s above which the rhythm is flagged */
  cutsPer10Warn: number;
  /** FOV change speed (deg/s) above which a zoom is flagged as not smooth */
  fovRateMax: number;
  /** seconds of sparse frames (< minElements scene elements) that warn / error */
  sparseWarn: number;
  sparseError: number;
  minElements: number;
  /** relative light change (0..1) between atmosphere keys that counts as a lighting change */
  lightChange: number;
  /** minimum camera clearance (m) to a character before the billboard clips */
  camClear: number;
}

export interface QCOptions {
  /** frame aspect ratio (width / height) */
  aspect: number;
  /** narration durations from public/audio/<ep>/manifest.json, if generated */
  durations?: Record<string, number> | null;
  /** audio file names that exist (or are planned by the generator); null = unknown */
  audioFiles?: Set<string> | null;
  thresholds?: Partial<Thresholds>;
}

export interface Shot {
  start: number;
  end: number;
  type: "wide" | "medium" | "close-up" | "detail";
  /** how this shot ends: a masked jump (transition covers it), an unmasked hard cut, or the end of the film */
  exit: "masked" | "hard" | "end";
}

export interface CheckSummary { check: string; errors: number; warns: number; infos: number }

export interface QCReport {
  episode: string;
  ok: boolean;
  summary: CheckSummary[];
  metrics: Record<string, number | string>;
  shots: Shot[];
  /** scene-change wipes, so pixel QC can skip frames a wipe intentionally fills */
  transitions: { t: number; dur: number }[];
  findings: Finding[];
}
