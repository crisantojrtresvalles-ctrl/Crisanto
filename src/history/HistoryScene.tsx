import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

export const HistoryScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const seconds = frame / fps;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#071827",
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          color: "white",
          fontSize: 42,
          fontWeight: 800,
          textAlign: "center",
        }}
      >
        HISTORY ENGINE
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 80,
          color: "#9bb8cc",
          fontSize: 22,
        }}
      >
        {width} × {height} | {seconds.toFixed(1)}s
      </div>
    </AbsoluteFill>
  );
};
