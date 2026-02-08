"use client";

import React, { useState } from "react";
import { Check, XCircle } from "lucide-react";
import { useStudioForm, useStudioPreview } from "./StudioProvider";
import { ScriptStep } from "./steps/ScriptStep";
import { AppearanceStep } from "./steps/AppearanceStep";
import { VoiceStep } from "./steps/VoiceStep";
import { MonetizationStep } from "./steps/MonetizationStep";
import { PreviewStep } from "./steps/PreviewStep";
import { Card } from "../Card";
import { Button } from "../Button";
import { Modal } from "../Modal";
import type { CompositionPropsType } from "@/types/constants";
import type { MonetizationPreviewContext } from "@/helpers/previewBuilder";

type StudioWizardProps = {
  title: string;
  onGeneratePreview?: (payload: CompositionPropsType) => void;
  showFinalGenerate?: boolean;
  finalGenerateLabel?: string;
  finalGenerateLoading?: boolean;
  finalGenerateDisabled?: boolean;
  finalGenerateNotice?: string | null;
  onGenerateFinal?: (payload: {
    previewProps: CompositionPropsType;
    durationInFrames?: number;
    backgroundFile: File | null;
    backgroundMusicFile: File | string | null;
    monetizationContext: MonetizationPreviewContext | null;
  }) => void;
  isSubscribed?: boolean;
};

const STEPS = [
  { id: "script", title: "Script", component: ScriptStep },
  { id: "monetization", title: "Monetization", component: MonetizationStep },
  { id: "voice", title: "Voice", component: VoiceStep },
  { id: "appearance", title: "Appearance", component: AppearanceStep },
  { id: "preview", title: "Preview", component: PreviewStep },
] as const;

export function StudioWizard(props: StudioWizardProps) {
  const { currentStep, setCurrentStep, validateStep, getStepErrors, resetForm } = useStudioForm();
  useStudioPreview();
  const CurrentStepComponent = STEPS[currentStep].component;
  const [askConfirmationForResetSettings, setAskConfirmationForResetSettings] = useState(false);
  /** Steps that have been validated (user clicked Next or switched tab). Errors only show for these. */
  const [validatedSteps, setValidatedSteps] = useState<Set<number>>(() => new Set());

  const stepValidation = React.useMemo(
    () =>
      STEPS.map((_, idx) => {
        const errors = getStepErrors(idx);
        const hasBeenValidated = validatedSteps.has(idx);
        return {
          hasErrors: hasBeenValidated && Object.keys(errors).length > 0,
          errors,
        };
      }),
    [getStepErrors, validatedSteps],
  );

  /** Only show errors for the current step if it has been validated (Next or tab switch). */
  const stepErrors = React.useMemo(
    () => (validatedSteps.has(currentStep) ? getStepErrors(currentStep) : {}),
    [currentStep, validatedSteps, getStepErrors],
  );

  const errorBannerRef = React.useRef<HTMLDivElement>(null);
  const hasStepErrors = Object.keys(stepErrors).length > 0;
  /** Offset so the error banner is not hidden behind a fixed/sticky nav (px). */
  const SCROLL_TOP_OFFSET = 120;
  React.useEffect(() => {
    if (hasStepErrors && errorBannerRef.current) {
      errorBannerRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [hasStepErrors]);

  const handleStepTabClick = (idx: number) => {
    if (idx !== currentStep) {
      setValidatedSteps((prev) => new Set(prev).add(currentStep));
      validateStep(currentStep);
    }
    setCurrentStep(idx);
  };

  return (
    <Card style={{ overflow: "hidden" }}>
      {/* Progress Indicator */}
      <div className="studio-tabs-container" style={{ padding: "24px 24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="studio-tabs" style={{ display: "flex", gap: 8 }}>
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => handleStepTabClick(idx)}
              className="studio-tab-btn"
              style={{
                flex: 1,
                minWidth: 60,
                padding: "12px 8px",
                background:
                  idx === currentStep
                    ? "linear-gradient(135deg, #007aff, #00b4ff)"
                    : idx < currentStep && stepValidation[idx]?.hasErrors
                      ? "rgba(255,80,80,0.12)"
                      : idx < currentStep
                        ? "rgba(0,180,255,0.2)"
                        : "rgba(255,255,255,0.05)",
                border: "none",
                borderRadius: 12,
                color: "white",
                fontSize: 13,
                fontWeight: idx <= currentStep ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.3s ease",
                position: "relative",
                opacity: idx <= currentStep ? 1 : 0.5,
                outline: idx < currentStep && stepValidation[idx]?.hasErrors ? "1px solid rgba(255,80,80,0.3)" : "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {idx < currentStep && (
                stepValidation[idx]?.hasErrors ? (
                  <XCircle
                    size={14}
                    color="#ff8c8c"
                    className="studio-tab-icon"
                    style={{ position: "absolute", top: 8, right: 8 }}
                    aria-label="Step has validation errors"
                  />
                ) : (
                  <Check
                    size={14}
                    className="studio-tab-icon"
                    style={{ position: "absolute", top: 8, right: 8 }}
                    aria-label="Step completed"
                  />
                )
              )}
              <div className="studio-tab-step-label" style={{ fontSize: 10, opacity: 0.8, marginBottom: 4 }}>
                Step {idx + 1}
              </div>
              <span className="studio-tab-title">{step.title}</span>
            </button>
          ))}
        </div>
        <div className="flex w-full justify-end underline cursor-pointer text-red-300 my-4" onClick={() => { setAskConfirmationForResetSettings(true); }}>
          Reset settings
        </div>
        <Modal
          open={askConfirmationForResetSettings}
          onClose={() => setAskConfirmationForResetSettings(false)}
          title="Reset studio settings?"
          width={560}
          actionButton={
            <Button
              onClick={() => {
                resetForm();
                setValidatedSteps(new Set());
                setAskConfirmationForResetSettings(false);
              }}
              style={{
                background: "linear-gradient(135deg, #ff4444, #cc0000)",
                fontWeight: 600,
              }}
            >
              Reset All Settings
            </Button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div
              style={{
                padding: 16,
                background: "rgba(255, 80, 80, 0.1)",
                border: "1px solid rgba(255, 80, 80, 0.3)",
                borderRadius: 12,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <XCircle size={20} color="#ff8c8c" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: "#ff9999", fontWeight: 600, marginBottom: 6 }}>
                  Warning: This action cannot be undone
                </div>
                <div style={{ fontSize: 13, color: "#ffb3b3", lineHeight: 1.5 }}>
                  All your studio settings will be permanently deleted and reset to their default values.
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "white", marginBottom: 12 }}>
                The following will be reset:
              </div>
              <ul style={{
                margin: 0,
                paddingLeft: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                color: "rgba(255, 255, 255, 0.7)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
              >
                <li>All script messages and conversations</li>
                <li>Monetization settings and campaigns</li>
                <li>Voice assignments and ElevenLabs API key</li>
                <li>Appearance customizations (colors, backgrounds, layouts)</li>
                <li>Progress in the current wizard step</li>
              </ul>
            </div>
          </div>
        </Modal>
      </div>

      {/* Step Content */}
      <div style={{ padding: 24, minHeight: 400 }}>
        {hasStepErrors && (
          <div
            ref={errorBannerRef}
            style={{
              padding: 12,
              marginBottom: 20,
              background: "rgba(255,50,50,0.1)",
              border: "1px solid rgba(255,50,50,0.3)",
              borderRadius: 8,
              fontSize: 13,
              color: "#ff8080",
              scrollMarginTop: SCROLL_TOP_OFFSET,
            }}
          >
            {Object.entries(stepErrors).map(([key, msg]) => (
              <div key={key}>{msg}</div>
            ))}
          </div>
        )}
        {currentStep === 4 ? (
          <PreviewStep
            finalGenerateDisabled={props.finalGenerateDisabled}
            finalGenerateLoading={props.finalGenerateLoading}
            finalGenerateLabel={props.finalGenerateLabel}
            finalGenerateNotice={props.finalGenerateNotice}
            onGenerateFinal={props.onGenerateFinal}
          />
        ) : (
          <CurrentStepComponent />
        )}
      </div>
    </Card>
  );
}
