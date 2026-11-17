import React from "react";
import { Composition, staticFile } from "remotion";
import { HistoryScene } from "./HistoryScene";
import { Scene, myCompSchema } from "./Scene";
import { HistoryVideo, type HistoryProps } from "./history/HistoryVideo";
import { getMediaMetadata } from "./helpers/get-media-metadata";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="History"
        component={HistoryVideo}
        fps={30}
        durationInFrames={1800}
        width={720}
        height={1280}
        defaultProps={{ durations: null, audio: false } as HistoryProps}
        calculateMetadata={async ({ props }) => {
          try {
            const res = await fetch(staticFile("audio/pirates/manifest.json"));
            if (!res.ok) throw new Error("no manifest");
            const m = (await res.json()) as {
              durations: Record<string, number>;
            };
            return { props: { ...props, durations: m.durations, audio: true } };
          } catch {
            return { props: { ...props, durations: null, audio: false } };
          }
        }}
      />

      <Composition
        id="HistoryPrototype"
        component={HistoryScene}
        fps={30}
        durationInFrames={1800}
        width={1080}
        height={1920}
        defaultProps={{}}
      />

      <Composition
        id="Scene"
        component={Scene}
        fps={30}
        durationInFrames={300}
        width={1280}
        height={720}
        schema={myCompSchema}
        defaultProps={{
          deviceType: "phone",
          phoneColor: "rgb(110, 152, 191)" as const,
          baseScale: 1,
          mediaMetadata: null,
          videoSrc: null,
        }}
        calculateMetadata={async ({ props }) => {
          const videoSrc =
            props.deviceType === "phone"
              ? staticFile("phone.mp4")
              : staticFile("tablet.mp4");

          const mediaMetadata = await getMediaMetadata(videoSrc);

          return {
            props: {
              ...props,
              mediaMetadata,
              videoSrc,
            },
          };
        }}
      />
    </>
  );
};