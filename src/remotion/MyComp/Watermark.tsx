import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";

export const Watermark: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle pulse animation for the watermark
  const opacity = interpolate(
    Math.sin(frame / 30),
    [-1, 1],
    [0.15, 0.25]
  );

  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      {/* Diagonal watermark pattern */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          transform: "rotate(-25deg)",
          gap: 180,
        }}
      >
        {/* Multiple rows of watermarks for coverage */}
        {[-2, -1, 0, 1, 2].map((row) => (
          <div
            key={row}
            style={{
              display: "flex",
              gap: 120,
              opacity,
            }}
          >
            {[-1, 0, 1].map((col) => (
              <div
                key={col}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 800,
                    color: "white",
                    textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    letterSpacing: "-2px",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  BR-MAX
                </div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.9)",
                    textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  STUDIO
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom banner */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(10px)",
            padding: "16px 40px",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: "white",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            Subscribe to remove watermark
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 500,
              color: "rgba(255,255,255,0.8)",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            br-max.com
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
