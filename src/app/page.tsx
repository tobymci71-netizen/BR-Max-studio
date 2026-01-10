"use client";

import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import JobsList from "../components/Job/JobsList";
import { useGenerateVideo } from "../hooks/useGenerateVideo";
import { NotificationPermissionPopup } from "../components/NotificationPermissionPopup";
import { ErrorNotification } from "../components/ErrorNotification";
import { VoiceSlotWarningPopup } from "../components/VoiceSlotWarningPopup";
import SubscriptionBanner from "../components/SubscriptionBanner";
import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

import { defaultMyCompProps } from "@/types/constants";
import type { MonetizationPreviewContext } from "@/helpers/previewBuilder";
import StudioPaywall from "./studio-paywall/page";
const generationOrder = [
  "processing",
  "holding_tokens",
  "generating_audio",
  "uploading_audio",
  "uploading_background",
  "starting_render",
  "refunding_tokens",
];

const IMessagesStudio = dynamic(
  () => import("../components/IMessagesStudio/page"),
  { ssr: false },
);

export default function DemoPage() {
  const { isSignedIn } = useUser();
  const studioHardPaywall =
    process.env.NEXT_PUBLIC_STUDIO_HARD_PAYWALL === "true";
  const [studioAccessState, setStudioAccessState] = useState<
    "pending" | "allowed" | "blocked"
  >(studioHardPaywall ? "pending" : "allowed");
  const {
    isGenerating,
    generateVideo,
    jobsListRef,
    jobsSectionRef,
    error,
    errorTitle,
    clearError,
    voiceWarning,
    voiceWarningTitle,
    clearVoiceWarning,
    audioGenerated,
    audioUploaded,
    audioTotal,
    backgroundUploadProgress,
    generationStage,
    startCancelConfirmation,
    confirmCancelGeneration,
    dismissCancelConfirmation,
    cancelPromptOpen,
    canCancelGeneration,
    isCancellingGeneration,
  } = useGenerateVideo();
  const [showPermissionPopup, setShowPermissionPopup] = useState(false);
  const [pendingGenerateAction, setPendingGenerateAction] = useState<
    (() => void) | null
  >(null);
  const [pendingGenerateData, setPendingGenerateData] = useState<{
    previewProps: typeof defaultMyCompProps;
    backgroundFile: File | null;
    backgroundMusicFile: File | string | null;
    monetizationContext: MonetizationPreviewContext | null;
  } | null>(null);

  const isAudioProgressVisible =
    (generationStage === "generating_audio" ||
      generationStage === "uploading_audio") &&
    audioTotal > 0;
  const currentAudioCount =
    generationStage === "uploading_audio" ? audioUploaded : audioGenerated;
  const audioProgressPercent = isAudioProgressVisible
    ? Math.min(
        100,
        Math.max(0, Math.round((currentAudioCount / audioTotal) * 100)),
      )
    : 0;

  const handleGenerateFinal = async (data: {
    previewProps: typeof defaultMyCompProps;
    backgroundFile: File | null;
    backgroundMusicFile: File | string | null;
    monetizationContext: MonetizationPreviewContext | null;
  }) => {
    console.log("backgroundFile: ", data.backgroundFile)
    // Store the data for potential voice warning confirmation
    setPendingGenerateData(data);

    // Check if we have notification permission
    const hasPermission =
      jobsListRef.current && "hasNotificationPermission" in jobsListRef.current
        ? (jobsListRef.current as { hasNotificationPermission: boolean })
            .hasNotificationPermission
        : false;
    console.log("props: ", data.previewProps);
    if (!hasPermission) {
      // Store the generate action and show permission popup
      setPendingGenerateAction(
        () => () =>
          generateVideo(
            data.previewProps,
            data.backgroundFile,
            data.backgroundMusicFile,
            data.monetizationContext,
          ),
      );
      setShowPermissionPopup(true);
    } else {
      // Permission already granted, proceed directly
      generateVideo(
        data.previewProps,
        data.backgroundFile,
        data.backgroundMusicFile,
        data.monetizationContext,
      );
    }
  };

  const handlePermissionGranted = async () => {
    // Request permission through the hook
    if (
      jobsListRef.current &&
      "requestNotificationPermission" in jobsListRef.current
    ) {
      await (
        jobsListRef.current as {
          requestNotificationPermission: () => Promise<boolean>;
        }
      ).requestNotificationPermission();
    }

    // Close the popup
    setShowPermissionPopup(false);

    // Execute pending action
    if (pendingGenerateAction) {
      pendingGenerateAction();
      setPendingGenerateAction(null);
    }
  };

  const handlePermissionSkipped = () => {
    // Close the popup
    setShowPermissionPopup(false);

    // Execute pending action without permission
    if (pendingGenerateAction) {
      pendingGenerateAction();
      setPendingGenerateAction(null);
    }
  };

  const handleVoiceWarningConfirm = () => {
    // User confirmed they want to continue despite the warning
    clearVoiceWarning();
    if (pendingGenerateData) {
      // Skip the voice check this time since user confirmed
      generateVideo(
        pendingGenerateData.previewProps,
        pendingGenerateData.backgroundFile,
        pendingGenerateData.backgroundMusicFile,
        pendingGenerateData.monetizationContext,
        true, // skipVoiceCheck = true
      );
      setPendingGenerateData(null);
    }
  };

  const handleVoiceWarningCancel = () => {
    // User cancelled, just close the popup
    clearVoiceWarning();
    setPendingGenerateData(null);
  };

  useEffect(() => {
    if (!studioHardPaywall) {
      setStudioAccessState("allowed");
      return;
    }

    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const checkAccess = async () => {
      setStudioAccessState("pending");

      // Set a 10-second timeout
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.error("Studio access check timed out after 10 seconds");
          setStudioAccessState("blocked");
        }
      }, 10000);

      try {
        const response = await fetch("/api/studio-access", {
          cache: "no-store",
        });
        const data = await response.json();

        // Clear timeout if we got a response
        clearTimeout(timeoutId);

        if (!mounted) return;
        if (response.ok && data?.hasPurchase) {
          setStudioAccessState("allowed");
        } else {
          setStudioAccessState("blocked");
        }
      } catch (error) {
        console.error("Studio access fetch failed", error);
        clearTimeout(timeoutId);
        if (mounted) setStudioAccessState("blocked");
      }
    };

    checkAccess();
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [studioHardPaywall]);

  if (studioHardPaywall && studioAccessState === "pending") {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm text-white/80">Checking your token history...</p>
        </div>
      </div>
    );
  }

  if (studioHardPaywall && studioAccessState === "blocked") {
    return <StudioPaywall />;
  }

  return (
    <>
      <IMessagesStudio
        title="Generate texting videos with ease"
        showFinalGenerate={isSignedIn}
        finalGenerateLabel="Generate video"
        finalGenerateLoading={isGenerating}
        finalGenerateDisabled={isGenerating}
        finalGenerateNotice="Please do not close this page until the video generation is started to process."
        onGenerateFinal={handleGenerateFinal}
      />
      {/* Compact top-right notifications */}
      <div className="fixed top-4 right-4 z-[60] w-80 max-w-[90vw] pointer-events-none space-y-2">
        {isGenerating && (
          <div className="pointer-events-auto rounded-lg bg-neutral-900/95 border border-neutral-700 shadow-xl px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              {/* Spinner */}
              <Loader2
                className={`h-4 w-4 animate-spin shrink-0 mt-0.5 ${isCancellingGeneration ? "text-rose-300" : "text-cyan-400"}`}
              />

              <div className="flex-1 min-w-0">
                {/* Current stage indicator */}
                <p className="text-xs font-medium text-neutral-200 mb-1.5">
                  {[
                    { key: "processing", label: "Processing" },
                    { key: "holding_tokens", label: "Reserving tokens" },
                    { key: "generating_audio", label: "Generating audio" },
                    { key: "uploading_audio", label: "Uploading" },
                    { key: "uploading_background", label: "Uploading background" },
                    { key: "starting_render", label: "Rendering" },
                    {
                      key: "refunding_tokens",
                      label: isCancellingGeneration
                        ? "Cancelling (refund)"
                        : "Finalizing",
                    },
                  ].find((s) => s.key === generationStage)?.label ||
                    "Processing"}
                </p>
                {isCancellingGeneration && (
                  <p className="text-[10px] text-rose-300 mb-1">
                    Cancellation requested. Wrapping up safely…
                  </p>
                )}

                {/* Compact progress dots */}
                <div className="flex gap-1 mb-2">
                  {generationOrder.map((stg) => {
                    const index = generationOrder.indexOf(stg);
                    const currentIndex =
                      generationOrder.indexOf(generationStage);
                    const done = currentIndex > index;
                    const current = generationStage === stg;

                    return (
                      <div
                        key={stg}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          done
                            ? "bg-cyan-400"
                            : current
                              ? "bg-cyan-400/50 animate-pulse"
                              : "bg-neutral-700"
                        }`}
                      />
                    );
                  })}
                </div>

                {/* Audio progress (only during audio phases) */}
                {(generationStage === "generating_audio" ||
                  generationStage === "uploading_audio") && (
                  <div className="space-y-1">
                    <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 transition-all duration-300"
                        style={{ width: `${audioProgressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-neutral-400 text-right tabular-nums">
                      {audioProgressPercent}%
                    </p>
                  </div>
                )}
                {generationStage === "uploading_background" &&
                  backgroundUploadProgress > 0 && (
                    <div className="space-y-1">
                      <div className="h-1 rounded-full bg-neutral-800 overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 transition-all duration-300"
                          style={{ width: `${backgroundUploadProgress}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-neutral-400 text-right tabular-nums">
                        {backgroundUploadProgress}%
                      </p>
                    </div>
                  )}
              </div>

              {/* Cancel button */}
              {(canCancelGeneration || isCancellingGeneration) && (
                <div className="shrink-0">
                  {isCancellingGeneration ? (
                    <span className="text-[10px] font-medium text-rose-400">
                      Cancelling...
                    </span>
                  ) : cancelPromptOpen ? (
                    <div className="flex gap-1">
                      <button
                        onClick={confirmCancelGeneration}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition"
                        title="Cancel generation"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={dismissCancelConfirmation}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700 transition"
                        title="Continue generation"
                      >
                        Keep
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={startCancelConfirmation}
                      disabled={!canCancelGeneration}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Cancel generation"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error notification */}
        <ErrorNotification
          isOpen={!!error}
          onClose={clearError}
          message={error || ""}
          title={errorTitle || undefined}
          inline
        />
      </div>
      {false && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-gradient-to-br from-card/95 to-card/80 border-2 border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 p-10 max-w-md w-full mx-4">
            <div className="text-center mb-8">
              <div className="mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                {generationStage === "processing" && (
                  <span className="text-3xl">⚙️</span>
                )}
                {generationStage === "holding_tokens" && (
                  <span className="text-3xl">⏳</span>
                )}
                {generationStage === "generating_audio" && (
                  <span className="text-3xl">🎵</span>
                )}
                {generationStage === "uploading_audio" && (
                  <span className="text-3xl">☁️</span>
                )}
                {generationStage === "starting_render" && (
                  <span className="text-3xl">🚀</span>
                )}
                {generationStage === "refunding_tokens" && (
                  <span className="text-3xl">💸</span>
                )}
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text">
                {generationStage === "processing" && "Processing your request"}
                {generationStage === "holding_tokens" && "Reserving tokens"}
                {generationStage === "generating_audio" && "Generating audio"}
                {generationStage === "uploading_audio" && "Uploading audio"}
                {generationStage === "starting_render" && "Starting render"}
                {generationStage === "refunding_tokens" &&
                  (isCancellingGeneration
                    ? "Cancelling and refunding"
                    : "Refunding tokens")}
              </h3>
              <p className="text-sm text-muted-foreground bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2 inline-block">
                ⚠️{" "}
                <strong className="text-yellow-500">
                  Don't close this tab!
                </strong>
              </p>
            </div>

            {isAudioProgressVisible && (
              <div className="mb-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-xl p-5 border border-cyan-500/20">
                <div className="text-center mb-4">
                  <div className="text-4xl font-bold text-cyan-400 mb-1">
                    {currentAudioCount}
                    <span className="text-2xl text-muted-foreground">
                      /{audioTotal}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    audio{audioTotal !== 1 ? "s" : ""}{" "}
                    {generationStage === "uploading_audio"
                      ? "uploaded"
                      : "generated"}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="w-full h-3 rounded-full bg-background/40 border border-cyan-500/20 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-all duration-300"
                      style={{ width: `${audioProgressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground uppercase tracking-[0.2em]">
                    {audioProgressPercent}% complete
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500/20 border-t-cyan-400" />
                <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-xl" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Banner */}
      {isSignedIn && <SubscriptionBanner />}

      {/* Build Progress temporarily disabled */}
      <div
        className="jobs-and-progress-container"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 32,
          width: "100%",
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 clamp(16px, 4vw, 32px)",
          alignItems: "start",
        }}
      >
        <div ref={jobsSectionRef}>
          <JobsList ref={jobsListRef} />
        </div>
        {/* <BuildProgress /> */}
      </div>

      <style jsx>{`
        @media (max-width: 1024px) {
          .jobs-and-progress-container {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Notification Permission Popup */}
      <NotificationPermissionPopup
        isOpen={showPermissionPopup}
        onClose={handlePermissionSkipped}
        onGrantPermission={handlePermissionGranted}
      />

      {/* Voice Slot Warning Popup */}
      <VoiceSlotWarningPopup
        isOpen={!!voiceWarning}
        onConfirm={handleVoiceWarningConfirm}
        onCancel={handleVoiceWarningCancel}
        title={voiceWarningTitle || undefined}
        message={voiceWarning || ""}
      />

      {/* Error Notification is rendered in the top-right stack above */}
    </>
  );
}
