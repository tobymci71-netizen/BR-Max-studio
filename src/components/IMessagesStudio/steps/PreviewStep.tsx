import React from "react";
import { useRouter } from "next/navigation";
import { useStudioForm, useStudioPreview } from "../StudioProvider";
import { Button } from "../../Button";
import { Card } from "../../Card";
import { AlertCircle, Clock, Wand2, ArrowUpRight, Lock } from "lucide-react";
import {
  DEFAULT_BACKGROUND_VIDEO,
  type CompositionPropsType,
} from "@/types/constants";
import type { MonetizationPreviewContext } from "@/helpers/previewBuilder";

type SummaryItem = {
  label: string;
  value: string;
  step: number;
};

type PreviewStepProps = {
  finalGenerateDisabled?: boolean;
  finalGenerateLoading?: boolean;
  finalGenerateLabel?: string;
  finalGenerateNotice?: string | null;
  durationInFrames?: number;
  onGenerateFinal?: (payload: {
    previewProps: CompositionPropsType;
    durationInFrames?: number;
    backgroundFile: File | null;
    backgroundMusicFile: File | string | null;
    monetizationContext: MonetizationPreviewContext | null;
  }) => void;
};

export function PreviewStep(props: PreviewStepProps) {
  const router = useRouter();
  const { formValues, errors, setCurrentStep, validateAllSteps, backgroundFile, isSubscribed } =
    useStudioForm();
  const { generatePreview, buildPreviewFromValues } = useStudioPreview();

  React.useEffect(() => {
    validateAllSteps();
    generatePreview();
  }, [validateAllSteps, generatePreview]);

  const hasErrors = Object.keys(errors).length > 0;
  const isReadyToGenerate =
    formValues.elevenLabsApiKey &&
    formValues.voices.every((v) => v.voiceId) &&
    formValues.messages.length > 0;

  const generateVideo = async () => {
    if (!isReadyToGenerate || props.finalGenerateDisabled) return;

    // Check subscription status before generating
    if (!isSubscribed) {
      // Double-check with the API to ensure subscription status is current
      try {
        const response = await fetch("/api/studio-access", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data?.allow) {
          // Redirect to subscription page
          router.push("/studio-paywall");
          return;
        }
      } catch (error) {
        console.error("Failed to verify subscription:", error);
        router.push("/studio-paywall");
        return;
      }
    }

    // Build preview directly from current formValues to ensure API key is up to date
    const { previewProps: freshPreviewProps, totalFrames, monetizationContext } =
      buildPreviewFromValues(formValues);

    props.onGenerateFinal?.({
      previewProps: freshPreviewProps,
      durationInFrames: totalFrames,
      backgroundFile,
      backgroundMusicFile: null,
      monetizationContext,
    });
  };

  const summaryItems = React.useMemo<SummaryItem[]>(() => {
    const items: SummaryItem[] = [
      {
        label: "Messages",
        value: `${formValues.messages.length} message${formValues.messages.length === 1 ? "" : "s"}`,
        step: 0,
      },
      {
        label: "Monetization",
        value: formValues.monetization?.enabled
          ? `${formValues.monetization?.messages.length ?? 0} exchange${
              (formValues.monetization?.messages.length ?? 0) === 1 ? "" : "s"
            } | ${formValues.monetization?.category || "Not set"}`
          : "Off",
        step: 1,
      },
      {
        label: "Theme",
        value: formValues.CHAT_SETTINGS.theme,
        step: 3,
      },
      {
        label: "Recipient",
        value: formValues.CHAT_SETTINGS.recipientName || "Not set",
        step: 0,
      },
      {
        label: "Background",
        value: formValues.greenScreen
          ? "Green screen"
          : formValues.backgroundVideo &&
              formValues.backgroundVideo !== DEFAULT_BACKGROUND_VIDEO
            ? "Custom background"
            : "Default background",
        step: 3,
      },
    ];

    items.push({
      label: "Audio Style",
      value: formValues.enableSilenceTrimming ? "Snappy" : "Natural",
      step: 2,
    });

    return items;
  }, [formValues]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Review & Generate</h3>
        <p style={{ fontSize: 13, opacity: 0.7, margin: 0 }}>
          Validate each setting, make final tweaks, and generate the finished video.
        </p>
      </div>

      <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Configuration Summary</h4>
          <span style={{ fontSize: 12, opacity: 0.6 }}>Tap any row to edit</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {summaryItems.map((item) => (
            <SummaryRow
              key={item.label}
              label={item.label}
              value={item.value}
              onEdit={() => setCurrentStep(item.step)}
            />
          ))}
        </div>
      </Card>

      {!isSubscribed && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 14px",
            background: "linear-gradient(135deg, rgba(251,191,36,0.12) 0%, rgba(245,158,11,0.08) 100%)",
            border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 10,
          }}
        >
          <Lock size={18} style={{ color: "#fbbf24", marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            <strong style={{ display: "block", marginBottom: 4, color: "#fef3c7" }}>
              Watermark Active
            </strong>
            <p style={{ margin: 0, color: "#fde68a", opacity: 0.9 }}>
              Your video preview includes a watermark. Subscribe to remove the watermark and generate videos without branding.
            </p>
            <button
              type="button"
              onClick={() => router.push("/studio-paywall")}
              style={{
                marginTop: 8,
                padding: "8px 16px",
                background: "rgba(251,191,36,0.2)",
                border: "1px solid rgba(251,191,36,0.5)",
                borderRadius: 8,
                color: "#fef3c7",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              View Subscription Plans
            </button>
          </div>
        </div>
      )}

      {hasErrors && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "12px 14px",
            background: "rgba(255,77,77,0.08)",
            border: "1px solid rgba(255,77,77,0.25)",
            borderRadius: 10,
          }}
        >
          <AlertCircle size={18} style={{ color: "#ff8080", marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            <strong style={{ display: "block", marginBottom: 4 }}>Resolve these items before generating:</strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {Object.entries(errors).map(([key, message]) => (
                <li key={key} style={{ marginBottom: 4 }}>
                  {message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}


      <div
        style={{
          marginTop: 8,
          padding: "12px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <h4 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Generate Final Video</h4>
        <Button
          variant="primary"
          onClick={generateVideo}
          disabled={!isReadyToGenerate || props.finalGenerateLoading}
          style={{
            width: "100%",
            padding: "14px 20px",
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          {props.finalGenerateLoading ? (
            <>
              <Clock size={18} className="animate-spin" /> Generating...
            </>
          ) : (
            <>
              <Wand2 size={18} /> {props.finalGenerateLabel || "Generate Video"}
            </>
          )}
        </Button>

        {props.finalGenerateNotice && (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              textAlign: "center",
              opacity: 0.8,
            }}
          >
            {props.finalGenerateNotice}
          </p>
        )}

        <p style={{ margin: 0, fontSize: 11, opacity: 0.6, textAlign: "center" }}>
          Generation may take a few minutes depending on video length.
        </p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        border: "none",
        background: "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        color: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{value}</div>
      </div>
      <ArrowUpRight size={16} style={{ opacity: 0.6 }} />
    </button>
  );
}
