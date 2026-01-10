import React from "react";
import {
  Img,
  Html5Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";

export type RizzMonetizationProps = {
  image: string;
  replyText: string;
  replyStartFrame?: number;
  introMessageAudioPath?: string;
  replyAudioPath?: string;
};

export const RizzMonetization: React.FC<RizzMonetizationProps> = ({
  image,
  replyText,
  replyStartFrame = 45,
  introMessageAudioPath,
  replyAudioPath,
}) => {
  const replyVisibleFrame = replyStartFrame;
  const sharedWidth = 600;
  const frame = useCurrentFrame();
  const blurAmount = frame < replyVisibleFrame ? 8 : 0;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Audio */}
      {introMessageAudioPath && (
        <Sequence from={0}>
          <Html5Audio src={introMessageAudioPath} />
        </Sequence>
      )}
      {replyAudioPath && (
        <Sequence from={replyVisibleFrame}>
          <Html5Audio src={replyAudioPath} />
        </Sequence>
      )}

      {/* 🔥 AUTO HEIGHT container (centered) */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 900,
          margin: "0 auto",
          padding: "50px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* 🔥 Background image (auto-height, no flicker) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            borderRadius: 22,
            overflow: "hidden",
          }}
        >
          <Img
            src={staticFile("/RizzAppImages/RIZZ_BACKGROUND.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* 🔥 Foreground content */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            color: "white",
            borderRadius: 22,
          }}
        >
          {/* Header */}
          <div style={{ maxWidth: "100%" }}>
            <Img
              src={staticFile("/RizzAppImages/RIZZ_HEADER.png")}
              alt="Rizz Header"
              style={{
                width: "100%",
                objectFit: "contain",
              }}
            />
          </div>

          {/* Main content */}
          <div
            style={{
              display: "flex",
              marginTop: 30,
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              gap: 24,
            }}
          >
            {/* Center image */}
            <div
              style={{
                width: "80%",
                maxWidth: 600,
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              <Img
                src={
                  image.startsWith("http") ||
                  image.startsWith("data:") ||
                  image.startsWith("blob:")
                    ? image
                    : staticFile(image)
                }
                style={{
                  width: "100%",
                  objectFit: "contain",
                }}
              />
            </div>

            {/* AI Generated Rizz */}
            <div
              style={{
                width: sharedWidth,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
                marginTop: "auto",
              }}
            >
              <Img
                src={staticFile("/RizzAppImages/AI_GENERATED_RIZZ.png")}
                alt="AI Generated Rizz"
                style={{
                  width: "100%",
                  borderRadius: 20,
                  border: "1px solid rgba(255,255,255,0.15)",
                }}
              />

              {/* Bubble */}
              <div style={{ width: "100%", position: "relative" }}>
                <div
                  style={{
                    background: "#EDEDF2",
                    borderRadius: 22,
                    padding: "25px 26px",
                    width: "100%",
                    boxShadow: "0 0px 6px rgba(0,0,0,0.08)",
                    position: "relative",
                    filter: `blur(${blurAmount}px)`,
                    minHeight: "80px",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      color: "#000",
                      fontFamily:
                        "'TT Fors Trial DemiBold', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
                      fontSize: 32,
                      lineHeight: 1.5,
                      fontWeight: 600,
                      letterSpacing: -1,
                      paddingRight: 52,
                      whiteSpace: "pre-wrap",
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                      wordBreak: "break-word",
                    }}
                  >
                    {replyText || "Type or paste your RIZZ here..."}
                  </div>

                  {/* Copy Icon */}
                  <Img
                    src={staticFile("/RizzAppImages/Copy.png")}
                    alt="Copy"
                    style={{
                      position: "absolute",
                      right: 22,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 28,
                      opacity: 0.95,
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
