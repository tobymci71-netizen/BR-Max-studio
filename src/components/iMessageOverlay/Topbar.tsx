import React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, WifiOff } from "lucide-react";
import {
  ChatSettings,
  THEME_MAP,
  IMESSAGE_FONT_SIZE_PERCENT,
} from "../../types/constants";

type Props = ChatSettings;

export const Topbar: React.FC<Props> = (CHAT_SETTINGS) => {
  const {
    deviceTime,
    wifi,
    recipientName,
    theme,
    showStatusBar,
    recipientAvatars,
    recipientNameSizePx = 32,
  } = CHAT_SETTINGS;

  const colors = THEME_MAP[theme];
  const fontScale = IMESSAGE_FONT_SIZE_PERCENT / 100;

  // Single control for video icon (container + SVG)
  const videoIconSize = 30 * fontScale;
  // Single control for back (chevron) icon
  const backIconSize = 32 * fontScale;

  const normalizedRecipientName = (recipientName ?? "").trim();
  const avatarConfig =
    normalizedRecipientName && recipientAvatars
      ? recipientAvatars[normalizedRecipientName]
      : undefined;

  const shouldShowImageAvatar =
    !!avatarConfig &&
    avatarConfig.mode === "image" &&
    !!avatarConfig.imageUrl &&
    avatarConfig.imageUrl.trim().length > 0;

  const initials =
    recipientName
      ?.replace(/[^a-zA-Z\s]/g, "") // remove emojis, numbers, symbols
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "U";

  return (
    <div
      style={{
        backgroundColor: colors.topBar,
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        paddingBottom: 10,
        flexDirection: "column",
        justifyContent: "start",
        height: showStatusBar ? 120 * fontScale : 100 * fontScale,
      }}
    >
      {/* Optional iOS-style status bar */}
      {showStatusBar && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: colors.textPrimary,
            fontSize: "0.7em",
            padding: "10px 50px 0 50px",
            opacity: 0.85,
            letterSpacing: 0.5,
          }}
        >
          <span>{deviceTime || "9:41"}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Signal bars */}
            <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: 5 + i * 2,
                    borderRadius: 1,
                    backgroundColor: colors.textPrimary,
                  }}
                />
              ))}
            </div>
            {wifi ? (
              <WifiOff
                size={10 * fontScale}
                strokeWidth={2}
                color={colors.textPrimary}
              />
            ) : null}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {/* Create battery */}
              <svg
                width={26 * fontScale}
                height={10.5 * fontScale}
                viewBox="0 0 28 10.5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ display: "block" }}
              >
                {/* === Outline === */}
                <rect
                  x="1"
                  y="1"
                  width="22"
                  height="8.5"
                  rx="2"
                  stroke={"rgb(184,184,184)"}
                  strokeWidth="1"
                  fill="none"
                />

                {/* === Notch (tiny right connector) === */}
                <path
                  d="M23.5 3.75a1 1 0 0 1 2 0v3a1 1 0 0 1-2 0v-3Z"
                  fill={"rgb(184,184,184)"}
                />

                {/* === Fill (battery level) === */}
                <rect
                  x="2.5"
                  y="2.25"
                  width={Math.max(
                    0.5,
                    19 * ((CHAT_SETTINGS.battery ?? 100) / 100),
                  )}
                  height="6"
                  rx="1.2"
                  fill={
                    (CHAT_SETTINGS.battery ?? 100) < 20
                      ? "rgb(255,80,60)"
                      : colors.textThem
                  }
                  style={{
                    transformOrigin: "left center",
                    transition: "width 0.4s ease, fill 0.4s ease",
                  }}
                />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Main Topbar */}
      <div
        style={{
          position: "relative",
          height: "100%", // adjust height as needed
          width: "100%",
        }}
      >
        {/* Left */}
        <div
          style={{
            position: "absolute",
            left: 32,
            top: "40%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 0,
              color: colors.icon,
            }}
          >
            <ChevronLeft size={backIconSize} />
          </div>
          <span
            style={{
              display:
                CHAT_SETTINGS.unreadMessages > 0 ? "inline-block" : "none",
              background: colors.icon,
              fontSize: 9 * fontScale,
              color: colors.textMe,
              marginLeft: -20,
              padding: "6px 12px",
              borderRadius: "30px",
            }}
          >
            {CHAT_SETTINGS.unreadMessages}
          </span>
        </div>

        {/* Middle */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "min(70%, 520px)",
            gap: 6,
            pointerEvents: "none",
          }}
        >
          {/* Profile Circle */}
          <div
            style={{
              width: 50 * fontScale,
              height: 50 * fontScale,
              borderRadius: "50%",
              backgroundColor: "rgb(137,141,152)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 21 * fontScale,
              userSelect: "none",
            }}
          >
            {shouldShowImageAvatar && avatarConfig?.imageUrl ? (
              <Image
                src={avatarConfig.imageUrl}
                alt={recipientName || "Recipient avatar"}
                width={50 * fontScale}
                height={50 * fontScale}
                unoptimized
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  objectFit: "cover",
                }}
              />
            ) : (
              initials
            )}
          </div>
        </div>

        {/* Right */}
        <div
          style={{
            position: "absolute",
            right: 32,
            top: "40%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: videoIconSize,
            height: videoIconSize,
            color: colors.icon,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={videoIconSize}
            height={videoIconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="lucide lucide-video"
          >
            <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
            <rect x="2" y="6" width="14" height="12" rx="2" />
          </svg>
        </div>
      </div>
      
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "center",
          marginTop: -10 * fontScale,
        }}
      >
        <div
          style={{
            marginLeft: -5,
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: `${recipientNameSizePx}px`,
              color: colors.textPrimary,
              fontWeight: 500,
              textAlign: "center",
            }}
          >
            {recipientName || "Unknown"}
          </span>
          <ChevronRight
            style={{
              position: "absolute",
              left: "100%",
              marginLeft: 0,
              top: "50%",
              transform: "translateY(-50%)",
              opacity: 0.6,
            }}
            size={recipientNameSizePx}
            color={colors.textSecondary}
          />
        </div>
      </div>
    </div>
  );
};
