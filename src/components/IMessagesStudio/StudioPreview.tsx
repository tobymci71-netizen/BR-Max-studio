import React from "react";
import { Player } from "@remotion/player";
import { Card } from "../Card";
import { Main } from "../../remotion/MyComp/Main";
import { VIDEO_WIDTH, VIDEO_HEIGHT, VIDEO_FPS } from "../../types/constants";
import { Eye } from "lucide-react";
import { useStudioPreview } from "./StudioProvider";

export function StudioPreview() {
  const { previewProps, durationInFrames, previewGeneration } = useStudioPreview();

  const playerKey = React.useMemo(
    () =>
      `${previewGeneration}-${durationInFrames}-${JSON.stringify(previewProps)}`,
    [previewGeneration, durationInFrames, previewProps],
  );

  return (
    <Card
      className="studio-preview-card"
      style={{
        padding: 20,
        background: "rgba(0,0,0,0.4)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div
        className="studio-preview-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <Eye size={16} />
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Live Preview</h3>
      </div>
      <div className="studio-preview-player-wrapper" style={{ width: "100%" }}>
        <Player
          key={playerKey}
          component={Main}
          autoPlay
          doubleClickToFullscreen
          initiallyMuted
          moveToBeginningWhenEnded
          durationInFrames={durationInFrames}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          fps={VIDEO_FPS}
          inputProps={previewProps}
          loop
          controls
          style={{
            width: "100%",
            aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}`,
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        />
      </div>

      <p
        style={{
          marginTop: 12,
          fontSize: 11,
          opacity: 0.65,
          textAlign: "center",
          margin: "12px 0 0 0",
          lineHeight: 1.5,
        }}
      >
        Preview updates automatically as you make changes. Audio playback is muted here, but it will be included in the final render.
      </p>
    </Card>
  );
}
