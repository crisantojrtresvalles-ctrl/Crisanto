import React from "react";
import { EpisodeView } from "./Episode";
import { pirates } from "./episodes/pirates";

export type HistoryProps = { durations: Record<string, number> | null; audio: boolean };
export const HistoryVideo: React.FC<HistoryProps> = ({ durations, audio }) => <EpisodeView episode={pirates} durations={durations} audio={audio} />;
