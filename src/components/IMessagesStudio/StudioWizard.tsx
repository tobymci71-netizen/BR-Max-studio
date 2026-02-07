import React, { useState } from "react";
import { Card } from "../Card";
import { Button } from "../Button";
import { ChevronLeft, ChevronRight, Check, Eye, XCircle } from "lucide-react";
import { ScriptStep } from "./steps/ScriptStep";
import { MonetizationStep } from "./steps/MonetizationStep";
import { VoiceStep } from "./steps/VoiceStep";
import { AppearanceStep } from "./steps/AppearanceStep";
import { PreviewStep } from "./steps/PreviewStep";
import { useStudioForm, useStudioPreview } from "./StudioProvider";
import { IMessagesStudioProps } from "./page";
import { Modal } from "../Modal";

const STEPS = [
  { id: 0, title: "Script", component: ScriptStep },
  { id: 1, title: "Monetization", component: MonetizationStep },
  { id: 2, title: "Text-to-Speech", component: VoiceStep },
  { id: 3, title: "Appearance", component: AppearanceStep },
  { id: 4, title: "Review & Generate", component: PreviewStep },
];

export function StudioWizard(props: IMessagesStudioProps) {
  const { currentStep, setCurrentStep, validateStep, getStepErrors, resetForm } = useStudioForm();
  const { generatePreview } = useStudioPreview();
  const CurrentStepComponent = STEPS[currentStep].component;
  const [askConfirmationForResetSettings, setAskConfirmationForResetSettings] = useState(false);

  const stepValidation = React.useMemo(
    () =>
      STEPS.map((_, idx) => {
        const errors = getStepErrors(idx);
        return {
          hasErrors: Object.keys(errors).length > 0,
          errors,
        };
      }),
    [getStepErrors],
  );

  const stepErrors = React.useMemo(
    () => getStepErrors(currentStep),
    [currentStep, getStepErrors],
  );

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  return (
    <Card style={{ overflow: "hidden" }}>
      {/* Progress Indicator */}
      <div className="studio-tabs-container" style={{ padding: "24px 24px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="studio-tabs" style={{ display: "flex", gap: 8 }}>
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(idx)}
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
        <div className="flex w-full justify-end underline cursor-pointer text-red-300 my-4" onClick={() => {setAskConfirmationForResetSettings(true)}}>
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
              }}>
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
        {Object.keys(stepErrors).length > 0 && (
          <div
            style={{
              padding: 12,
              marginBottom: 20,
              background: "rgba(255,50,50,0.1)",
              border: "1px solid rgba(255,50,50,0.3)",
              borderRadius: 8,
              fontSize: 13,
              color: "#ff8080",
            }}
          >
            {Object.values(stepErrors)[0]}
          </div>
        )}

        <CurrentStepComponent {...props} />
      </div>

      {/* Navigation Footer */}
      <div
        style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "rgba(20,20,20,0.5)",
        }}
      >
        <Button
          onClick={handleBack}
          disabled={currentStep === 0}
          variant="ghost"
        >
          <ChevronLeft size={18} /> Back
        </Button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Step {currentStep + 1} of {STEPS.length}
          </div>
          <Button
            onClick={generatePreview}
            variant="ghost"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}
          >
            <Eye size={16} />
            Generate Preview
          </Button>
        </div>

        {currentStep < STEPS.length - 1 ? (
          <Button onClick={handleNext}>
            Next <ChevronRight size={18} />
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
