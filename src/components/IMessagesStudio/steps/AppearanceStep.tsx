import React, { useEffect, useRef, useState } from "react";
import { Input } from "../../Input";
import { Switch } from "../../Switch";
import { Select } from "../../Select";
import { Sun, Moon, Smartphone, Palette, Upload, Layout } from "lucide-react";
import { useStudioForm } from "../StudioProvider";
import {
  CHAT_INTRO_ANIMATION_OPTIONS,
  CHAT_INTRO_ANIMATIONS,
  CHAT_SHADOW_PRESETS,
  DEFAULT_BACKGROUND_VIDEO,
} from "@/types/constants";
import type { ChatIntroAnimation, ChatShadowPreset } from "@/types/constants";

export function AppearanceStep() {
  const { formValues, updateChatSettings, updateFormValues, setBackgroundFile } =
    useStudioForm();
  const isDark = formValues.CHAT_SETTINGS.theme === "dark";
  const [backgroundFileName, setBackgroundFileName] = useState<string | null>(
    null,
  );
  const uploadedVideoUrl = useRef<string | null>(null);
  const backgroundInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounterRef = useRef(0);
  const [isDraggingBackground, setIsDraggingBackground] = useState(false);
  const [videoQualityWarning, setVideoQualityWarning] = useState<string | null>(
    null,
  );
  const videoQualityCheckIdRef = useRef(0);
  const isCustomBackground =
    !!formValues.backgroundVideo &&
    formValues.backgroundVideo !== DEFAULT_BACKGROUND_VIDEO;
  // const backgroundMode: "video" | "green" = formValues.greenScreen ? "green" : "video";
  const backgroundMode: "video" | "green" = "green";
  const [cornerRadiusDraft, setCornerRadiusDraft] = useState(
    String(formValues.CHAT_SETTINGS.roundedCornersRadius ?? 0),
  );
  const [marginTopDraft, setMarginTopDraft] = useState(
    String(formValues.CHAT_SETTINGS.marginTop ?? 0),
  );
  const [marginBottomDraft, setMarginBottomDraft] = useState(
    String(formValues.CHAT_SETTINGS.marginBottom ?? 0),
  );
  const [conversationStartTimeDraft, setConversationStartTimeDraft] = useState(
    formValues.CHAT_SETTINGS.conversationStartTime ?? "",
  );
  const [deviceTimeDraft, setDeviceTimeDraft] = useState(
    formValues.CHAT_SETTINGS.deviceTime ?? "",
  );
  const [batteryDraft, setBatteryDraft] = useState(
    String(formValues.CHAT_SETTINGS.battery ?? 0),
  );
  const [unreadDraft, setUnreadDraft] = useState(
    String(formValues.CHAT_SETTINGS.unreadMessages ?? 0),
  );
  const [introDurationDraft, setIntroDurationDraft] = useState(
    String(formValues.CHAT_SETTINGS.chatIntroAnimationDurationMs ?? 600),
  );
  const [recipientNameSizeDraft, setRecipientNameSizeDraft] = useState(
    String(formValues.CHAT_SETTINGS.recipientNameSizePx ?? 32),
  );
  const [messageTextSizeDraft, setMessageTextSizeDraft] = useState(
    String(formValues.CHAT_SETTINGS.messageTextSizePx ?? 39),
  );
  const [overlayWidthDraft, setOverlayWidthDraft] = useState(
    String(formValues.CHAT_SETTINGS.overlayWidthPercent ?? 70),
  );
  // const [outroDurationDraft, setOutroDurationDraft] = useState(
  //   String(formValues.CHAT_SETTINGS.chatOutroAnimationDurationMs ?? 600),
  // );
  const shadowPresetValue = formValues.CHAT_SETTINGS.chatShadowPreset ?? "none";
  const introAnimationValue =
    formValues.CHAT_SETTINGS.chatIntroAnimation ?? CHAT_INTRO_ANIMATIONS.NONE;
  // const outroAnimationValue =
  //   formValues.CHAT_SETTINGS.chatOutroAnimation ?? CHAT_INTRO_ANIMATIONS.NONE;

  useEffect(() => {
    const current = formValues.backgroundVideo;
    if (!current || current === DEFAULT_BACKGROUND_VIDEO) {
      setBackgroundFileName(null);
      return;
    }
    if (!current.startsWith("blob:")) {
      const label = current.split("/").pop() || current;
      setBackgroundFileName(label);
    }
  }, [formValues.backgroundVideo]);

  const handleBackgroundUpload = (file: File) => {
    if (uploadedVideoUrl.current) {
      URL.revokeObjectURL(uploadedVideoUrl.current);
    }
    const objectUrl = URL.createObjectURL(file);
    uploadedVideoUrl.current = objectUrl;
    updateFormValues({ backgroundVideo: objectUrl });
    setBackgroundFile(file);
    setBackgroundFileName(file.name);
    setVideoQualityWarning(null);
    const video = document.createElement("video");
    const checkId = ++videoQualityCheckIdRef.current;
    video.preload = "metadata";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      if (videoQualityCheckIdRef.current !== checkId) {
        cleanup();
        return;
      }
      const minWidth = 1080;
      const minHeight = 1920;
      if (video.videoWidth < minWidth || video.videoHeight < minHeight) {
        setVideoQualityWarning(
          `Video is ${video.videoWidth}x${video.videoHeight}. Recommend 1080x1920 for best results.`,
        );
      } else {
        setVideoQualityWarning(null);
      }
      cleanup();
    };
    video.onerror = () => {
      if (videoQualityCheckIdRef.current !== checkId) {
        cleanup();
        return;
      }
      setVideoQualityWarning(
        "Couldn't read video quality. Check it's at least 1080x1920.",
      );
      cleanup();
    };

    video.src = objectUrl;
    video.load();
  };

  const resetBackgroundVideo = () => {
    if (uploadedVideoUrl.current) {
      URL.revokeObjectURL(uploadedVideoUrl.current);
      uploadedVideoUrl.current = null;
    }
    updateFormValues({ backgroundVideo: DEFAULT_BACKGROUND_VIDEO });
    setBackgroundFile(null);
    setBackgroundFileName(null);
    setVideoQualityWarning(null);
  };

  const currentBackgroundLabel =
    backgroundFileName ??
    (formValues.backgroundVideo &&
    formValues.backgroundVideo !== DEFAULT_BACKGROUND_VIDEO
      ? formValues.backgroundVideo
      : "Default background video");
  const canResetBackground =
    !!formValues.backgroundVideo &&
    formValues.backgroundVideo !== DEFAULT_BACKGROUND_VIDEO;
  const showGreenScreenConflict = formValues.greenScreen && isCustomBackground;

  const handleBackgroundModeChange = (mode: "video" | "green") => {
    if (mode === "green") {
      updateFormValues({ greenScreen: true });
    } else {
      updateFormValues({ greenScreen: false });
    }
  };

  useEffect(() => {
    setCornerRadiusDraft(
      String(formValues.CHAT_SETTINGS.roundedCornersRadius ?? 0),
    );
    setMarginTopDraft(String(formValues.CHAT_SETTINGS.marginTop ?? 0));
    setMarginBottomDraft(String(formValues.CHAT_SETTINGS.marginBottom ?? 0));
    setConversationStartTimeDraft(
      formValues.CHAT_SETTINGS.conversationStartTime ?? "",
    );
    setDeviceTimeDraft(formValues.CHAT_SETTINGS.deviceTime ?? "");
    setBatteryDraft(String(formValues.CHAT_SETTINGS.battery ?? 0));
    setUnreadDraft(String(formValues.CHAT_SETTINGS.unreadMessages ?? 0));
    setIntroDurationDraft(
      String(formValues.CHAT_SETTINGS.chatIntroAnimationDurationMs ?? 600),
    );
    setRecipientNameSizeDraft(
      String(formValues.CHAT_SETTINGS.recipientNameSizePx ?? 32),
    );
    setMessageTextSizeDraft(
      String(formValues.CHAT_SETTINGS.messageTextSizePx ?? 39),
    );
    setOverlayWidthDraft(
      String(formValues.CHAT_SETTINGS.overlayWidthPercent ?? 70),
    );
    // setOutroDurationDraft(
    //   String(formValues.CHAT_SETTINGS.chatOutroAnimationDurationMs ?? 600),
    // );
  }, [
    formValues.CHAT_SETTINGS.roundedCornersRadius,
    formValues.CHAT_SETTINGS.marginTop,
    formValues.CHAT_SETTINGS.marginBottom,
    formValues.CHAT_SETTINGS.conversationStartTime,
    formValues.CHAT_SETTINGS.deviceTime,
    formValues.CHAT_SETTINGS.battery,
    formValues.CHAT_SETTINGS.unreadMessages,
    formValues.CHAT_SETTINGS.chatIntroAnimationDurationMs,
    formValues.CHAT_SETTINGS.recipientNameSizePx,
    formValues.CHAT_SETTINGS.messageTextSizePx,
    formValues.CHAT_SETTINGS.overlayWidthPercent,
    formValues.CHAT_SETTINGS.chatOutroAnimationDurationMs,
  ]);

  const commitCornerRadius = () => {
    const parsed = Number(cornerRadiusDraft);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    updateChatSettings("roundedCornersRadius", safeValue);
    setCornerRadiusDraft(String(safeValue));
  };

  const commitMarginTop = () => {
    const parsed = Number(marginTopDraft);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    updateChatSettings("marginTop", safeValue);
    setMarginTopDraft(String(safeValue));
  };

  const commitMarginBottom = () => {
    const parsed = Number(marginBottomDraft);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
    updateChatSettings("marginBottom", safeValue);
    setMarginBottomDraft(String(safeValue));
  };

  const commitConversationStartTime = () => {
    const trimmed = conversationStartTimeDraft.trim();
    updateChatSettings("conversationStartTime", trimmed);
    setConversationStartTimeDraft(trimmed);
  };

  const commitDeviceTime = () => {
    const trimmed = deviceTimeDraft.trim();
    updateChatSettings("deviceTime", trimmed);
    setDeviceTimeDraft(trimmed);
  };

  const commitBattery = () => {
    const parsed = Number(batteryDraft);
    const normalized = Number.isNaN(parsed) ? 0 : parsed;
    const clamped = Math.min(100, Math.max(0, normalized));
    updateChatSettings("battery", clamped);
    setBatteryDraft(String(clamped));
  };

  const commitUnread = () => {
    const parsed = Number(unreadDraft);
    const normalized = Number.isNaN(parsed) ? 0 : parsed;
    const clamped = Math.max(0, normalized);
    updateChatSettings("unreadMessages", clamped);
    setUnreadDraft(String(clamped));
  };

  const commitRecipientNameSize = () => {
    const parsed = Number(recipientNameSizeDraft);
    const normalized = Number.isNaN(parsed) ? 32 : parsed;
    const clamped = Math.min(80, Math.max(10, normalized));
    updateChatSettings("recipientNameSizePx", clamped);
    setRecipientNameSizeDraft(String(clamped));
  };

  const commitMessageTextSize = () => {
    const parsed = Number(messageTextSizeDraft);
    const normalized = Number.isNaN(parsed) ? 39 : parsed;
    const clamped = Math.min(80, Math.max(10, normalized));
    updateChatSettings("messageTextSizePx", clamped);
    setMessageTextSizeDraft(String(clamped));
  };

  const commitOverlayWidth = () => {
    const parsed = Number(overlayWidthDraft);
    const normalized = Number.isNaN(parsed) ? 70 : parsed;
    const clamped = Math.min(100, Math.max(40, normalized));
    updateChatSettings("overlayWidthPercent", clamped);
    setOverlayWidthDraft(String(clamped));
  };

  const commitIntroDuration = () => {
    const parsed = Number(introDurationDraft);
    const normalized = Number.isNaN(parsed) ? 0 : parsed;
    const clamped = Math.max(0, normalized);
    updateChatSettings("chatIntroAnimationDurationMs", clamped);
    setIntroDurationDraft(String(clamped));
  };

  // const commitOutroDuration = () => {
  //   const parsed = Number(outroDurationDraft);
  //   const normalized = Number.isNaN(parsed) ? 0 : parsed;
  //   const clamped = Math.max(0, normalized);
  //   updateChatSettings("chatOutroAnimationDurationMs", clamped);
  //   setOutroDurationDraft(String(clamped));
  // };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>
          <Palette
            size={16}
            style={{
              display: "inline",
              marginRight: 6,
              verticalAlign: "middle",
            }}
          />
          Visual Customization
        </h3>
        <p style={{ fontSize: 11, opacity: 0.65, margin: 0 }}>
          Customize the look and feel of your iMessage video
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 12,
          alignItems: "start",
        }}
      >
        {/* Theme & Animations */}
        <div
          style={{
            padding: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            display: "grid",
            gap: 12,
            gridTemplateRows: "auto auto",
            height: "100%",
          }}
        >
          <h4
            style={{
              fontSize: 11,
              fontWeight: 600,
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              opacity: 0.85,
            }}
          >
            <Palette size={12} /> Theme & Animations
          </h4>

          <div
            style={{ display: "grid", gap: 10, gridTemplateRows: "auto auto" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Switch
                  checked={isDark}
                  onChange={(v) =>
                    updateChatSettings("theme", v ? "dark" : "light")
                  }
                  label={
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12,
                      }}
                    >
                      {isDark ? <Moon size={13} /> : <Sun size={13} />} Dark
                      Mode
                    </span>
                  }
                  hint="Toggle iOS theme"
                />

                <Switch
                  checked={!!formValues.CHAT_SETTINGS.roundedCorners}
                  onChange={(v) => updateChatSettings("roundedCorners", v)}
                  label={<span style={{ fontSize: 12 }}>Rounded Corners</span>}
                  hint="Modern device bezel"
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Select
                  label="Intro Animation"
                  value={introAnimationValue}
                  onChange={(e) =>
                    updateChatSettings(
                      "chatIntroAnimation",
                      e.target.value as ChatIntroAnimation,
                    )
                  }
                  // @ts-expect-error Will fix later
                  options={CHAT_INTRO_ANIMATION_OPTIONS}
                />

                {introAnimationValue !== CHAT_INTRO_ANIMATIONS.NONE && (
                  <Input
                    label="Duration (ms)"
                    type="number"
                    min={0}
                    value={introDurationDraft}
                    onChange={(e) => setIntroDurationDraft(e.target.value)}
                    onBlur={commitIntroDuration}
                    placeholder="600"
                    hint="Length"
                  />
                )}
              </div>

              {/* <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <Select
                  label="Outro Animation"
                  value={outroAnimationValue}
                  onChange={(e) =>
                    updateChatSettings(
                      "chatOutroAnimation",
                      e.target.value as ChatIntroAnimation,
                    )
                  }
                  // @ts-expect-error Will fix later
                  options={CHAT_OUTRO_ANIMATION_OPTIONS}
                />

                {outroAnimationValue !== CHAT_INTRO_ANIMATIONS.NONE && (
                  <Input
                    label="Duration (ms)"
                    type="number"
                    min={0}
                    value={outroDurationDraft}
                    onChange={(e) => setOutroDurationDraft(e.target.value)}
                    onBlur={commitOutroDuration}
                    placeholder="600"
                    hint="Length"
                  />
                )}
              </div> */}

              <Select
                label="Text Animation"
                value={formValues.CHAT_SETTINGS.textAnimation ? "on" : "off"}
                onChange={(e) =>
                  updateChatSettings("textAnimation", e.target.value === "on")
                }
                options={[
                  { value: "off", label: "Off" },
                  { value: "on", label: "On" },
                ]}
              />

              <Select
                label="Shadow Effect"
                value={shadowPresetValue}
                onChange={(e) =>
                  updateChatSettings(
                    "chatShadowPreset",
                    e.target.value as ChatShadowPreset,
                  )
                }
                options={CHAT_SHADOW_PRESETS.map((preset) => ({
                  value: preset.value,
                  label: preset.label,
                }))}
              />
            </div>
          </div>
        </div>

        {/* Layout & Spacing */}
        <div
          style={{
            padding: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            height: "100%",
          }}
        >
          <h4
            style={{
              fontSize: 11,
              fontWeight: 600,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.8px",
              opacity: 0.85,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Layout size={12} /> Layout & Spacing
          </h4>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
              alignItems: "start",
            }}
          >
            <Input
              label="Overlay width (%)"
              type="number"
              min={40}
              max={100}
              value={overlayWidthDraft}
              onChange={(e) => setOverlayWidthDraft(e.target.value)}
              onBlur={commitOverlayWidth}
              placeholder="70"
              hint="iMessage panel width as % of video"
            />

            <Input
              label="Top Gap (px)"
              type="number"
              min={0}
              value={marginTopDraft}
              onChange={(e) => setMarginTopDraft(e.target.value)}
              onBlur={commitMarginTop}
              placeholder="0"
              hint="Space above the chat"
            />

            <Input
              label="Bottom Gap (px)"
              type="number"
              min={0}
              value={marginBottomDraft}
              onChange={(e) => setMarginBottomDraft(e.target.value)}
              onBlur={commitMarginBottom}
              placeholder="0"
              hint="Space below the chat"
            />

            {formValues.CHAT_SETTINGS.roundedCorners && (
              <Input
                label="Corner Radius (px)"
                type="number"
                min={0}
                max={100}
                value={cornerRadiusDraft}
                onChange={(e) => setCornerRadiusDraft(e.target.value)}
                onBlur={commitCornerRadius}
                placeholder="40"
                hint="Device bezel rounding"
                errorMessage={
                  formValues.CHAT_SETTINGS.roundedCornersRadius > 100
                    ? "Keep under 100"
                    : undefined
                }
              />
            )}

            <Input
              label="Unread Messages"
              type="number"
              min={0}
              value={unreadDraft}
              onChange={(e) => setUnreadDraft(e.target.value)}
              onBlur={commitUnread}
              placeholder="999"
              hint="Badge count on chat header"
            />

            <Input
              label="Recipient name size (px)"
              type="number"
              min={10}
              max={80}
              value={recipientNameSizeDraft}
              onChange={(e) => setRecipientNameSizeDraft(e.target.value)}
              onBlur={commitRecipientNameSize}
              placeholder="32"
              hint="Header name text size in pixels"
              errorMessage={
                (() => {
                  const n = Number(recipientNameSizeDraft);
                  return !Number.isNaN(n) && n > 80
                    ? "Must be 80 or less"
                    : undefined;
                })()
              }
            />

            <Input
              label="Message text size (px)"
              type="number"
              min={10}
              max={80}
              value={messageTextSizeDraft}
              onChange={(e) => setMessageTextSizeDraft(e.target.value)}
              onBlur={commitMessageTextSize}
              placeholder="39"
              hint="Text inside iMessage bubbles"
              errorMessage={
                (() => {
                  const n = Number(messageTextSizeDraft);
                  return !Number.isNaN(n) && n > 80
                    ? "Must be 80 or less"
                    : undefined;
                })()
              }
            />
          </div>
        </div>
      </div>
      {/* Device Settings - Two Column Layout - Two Column Layout */}
      <div
        style={{
          padding: 14,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
        }}
      >
        <h4
          style={{
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 12,
            display: "flex",
            alignItems: "center",
            gap: 6,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            opacity: 0.85,
          }}
        >
          <Smartphone size={12} /> Device Settings
        </h4>

        <div style={{ display: "flex", gap: 14 }}>
          {/* Left: Status Bar Toggles */}
          <div
            style={{
              flex: "0 0 36%",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <Switch
              checked={!!formValues.CHAT_SETTINGS.showStatusBar}
              onChange={(v) => updateChatSettings("showStatusBar", v)}
              label={<span style={{ fontSize: 12 }}>Show Status Bar</span>}
              hint="Display iOS status bar"
            />

            {formValues.CHAT_SETTINGS.showStatusBar && (
              <>
                <Switch
                  checked={!!formValues.CHAT_SETTINGS.wifi}
                  onChange={(v) => updateChatSettings("wifi", v)}
                  label={<span style={{ fontSize: 12 }}>Wi-Fi Icon</span>}
                  hint="Show signal indicator"
                />

                <Switch
                  checked={!!formValues.CHAT_SETTINGS.showTopBarFirstOnly}
                  onChange={(v) => updateChatSettings("showTopBarFirstOnly", v)}
                  label={
                    <span style={{ fontSize: 12 }}>First Screen Only</span>
                  }
                  hint="Hide on other screens"
                />
              </>
            )}
          </div>

          {/* Right: Status Bar Details */}
          {formValues.CHAT_SETTINGS.showStatusBar && (
            <div
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 10,
              }}
            >
              <Input
                label="Device Time"
                value={deviceTimeDraft}
                onChange={(e) => setDeviceTimeDraft(e.target.value)}
                onBlur={commitDeviceTime}
                placeholder="9:41"
                hint="Status bar time"
              />

              <Input
                label="Battery (%)"
                type="number"
                min={0}
                max={100}
                value={batteryDraft}
                onChange={(e) => setBatteryDraft(e.target.value)}
                onBlur={commitBattery}
                placeholder="82"
                hint="Battery level"
              />

              <Input
                label="Chat Start Time"
                value={conversationStartTimeDraft}
                onChange={(e) => setConversationStartTimeDraft(e.target.value)}
                onBlur={commitConversationStartTime}
                placeholder="9:14"
                hint="First bubble timestamp"
              />
            </div>
          )}
        </div>
      </div>

      {/* Background - Full Width */}
      <div
        style={{
          display: "none",
          padding: 14,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
        }}
      >
        <h4
          style={{
            fontSize: 11,
            fontWeight: 600,
            marginBottom: 12,
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            opacity: 0.85,
          }}
        >
          Background
        </h4>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          {[
            { value: "video" as const, label: "Video" },
            { value: "green" as const, label: "Green Screen" },
          ].map((option) => {
            const isActive = backgroundMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleBackgroundModeChange(option.value)}
                style={{
                  flex: 1,
                  borderRadius: 6,
                  padding: "7px 12px",
                  border: isActive
                    ? "1px solid rgba(96,165,250,0.8)"
                    : "1px solid rgba(255,255,255,0.15)",
                  background: isActive
                    ? "rgba(96,165,250,0.08)"
                    : "rgba(0,0,0,0.15)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* @ts-expect-error asd */}
        {backgroundMode === "video" ? (
          <>
            <label
              style={{
                border: isDraggingBackground
                  ? "1px solid rgba(96,165,250,0.6)"
                  : "1px dashed rgba(255,255,255,0.2)",
                borderRadius: 6,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
                gap: 10,
                background: isDraggingBackground
                  ? "rgba(96,165,250,0.08)"
                  : "transparent",
                transition: "all 0.15s ease",
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                dragCounterRef.current += 1;
                setIsDraggingBackground(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                dragCounterRef.current = Math.max(
                  0,
                  dragCounterRef.current - 1,
                );
                if (dragCounterRef.current === 0) {
                  setIsDraggingBackground(false);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                dragCounterRef.current = 0;
                setIsDraggingBackground(false);
                const file = e.dataTransfer?.files?.[0];
                if (file && file.type === "video/mp4") {
                  handleBackgroundUpload(file);
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "rgba(96,165,250,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Upload size={14} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 11 }}>
                    Upload .mp4 background
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.6 }}>
                    1080x1920 recommended aspect ratio. Drag & drop or click
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#93c5fd" }}>
                Browse
              </div>
              <input
                type="file"
                accept=".aac,.flac,.mkv,.mov,.mp3,.mp4,.ogg,.wav,.webm"
                style={{ display: "none" }}
                ref={backgroundInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleBackgroundUpload(file);
                    e.target.value = "";
                  }
                }}
              />
            </label>

            {videoQualityWarning && (
              <div
                style={{
                  fontSize: 10,
                  color: "#fbbf24",
                  display: "flex",
                  gap: 5,
                  alignItems: "center",
                  marginTop: 7,
                }}
              >
                <span style={{ fontWeight: 700 }}>âš </span>
                <span>{videoQualityWarning}</span>
              </div>
            )}

            <div
              style={{
                fontSize: 10,
                opacity: 0.65,
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>
                Current:{" "}
                <span style={{ fontWeight: 600 }}>
                  {currentBackgroundLabel}
                </span>
              </span>
              {canResetBackground && (
                <button
                  type="button"
                  onClick={resetBackgroundVideo}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 5,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "transparent",
                    color: "#f3f4f6",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  Reset to default
                </button>
              )}
            </div>
          </>
        ) : showGreenScreenConflict ? (
          <div
            style={{
              borderRadius: 6,
              border: "1px solid rgba(251,191,36,0.6)",
              background: "rgba(15,23,42,0.35)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <div style={{ fontSize: 10, color: "#fbbf24" }}>
              Custom background video cannot be used with green screen enabled.
            </div>
            {isCustomBackground && (
              <button
                type="button"
                onClick={resetBackgroundVideo}
                style={{
                  alignSelf: "flex-start",
                  padding: "4px 10px",
                  borderRadius: 5,
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#f3f4f6",
                  cursor: "pointer",
                  fontSize: 10,
                  fontWeight: 500,
                }}
              >
                Remove uploaded background
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
