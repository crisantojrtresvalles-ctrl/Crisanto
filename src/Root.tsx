import { Composition, staticFile } from "remotion";
import { Scene, myCompSchema } from "./Scene";
import { HistoryScene } from "./history/HistoryScene";
import { getMediaMetadata } from "./helpers/get-media-metadata";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="History"
        component={HistoryScene}
        fps={30}
        durationInFrames={1800}
        width={720}
        height={1280}
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
