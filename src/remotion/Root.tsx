import { Composition } from "remotion";
import { Main } from "./MyComp/Main";
import {
  COMP_NAME,
  CompositionProps,
  defaultMyCompProps,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "../types/constants";
import "../index.css";
import { buildPreviewProps } from "../helpers/previewBuilder";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={COMP_NAME}
        component={Main}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={CompositionProps}
        defaultProps={defaultMyCompProps}
        calculateMetadata={async ({ props }) => {
          // Use pre-calculated durationInFrames if available (from render generation)
          // Otherwise calculate it dynamically (for preview/player)
          const totalFrames = props.durationInFrames
            ? props.durationInFrames
            : buildPreviewProps(props).totalFrames;

          return {
            durationInFrames: totalFrames,
          };
        }}
      />
    </>
  );
};
