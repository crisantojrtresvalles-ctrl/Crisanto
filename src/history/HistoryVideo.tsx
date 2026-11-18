import React from "react";
import { EpisodeView } from "./Episode";
import { pirates } from "./episodes/pirates";

/** plain = render the 3D world only (no title / subtitles / callouts / fades); used by the pixel QC */
export type HistoryProps = { durations: Record<string, number> | null; audio: boolean; plain?: boolean };
export const HistoryVideo: React.FC<HistoryProps> = ({ durations, audio, plain }) => <EpisodeView episode={pirates} durations={durations} audio={audio} plain={plain} />;
