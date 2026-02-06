"use client";

import { MessageSquare, Palette, Mic, DollarSign, Eye } from "lucide-react";
import { useStudioForm } from "./StudioProvider";
import { ScriptStep } from "./steps/ScriptStep";
import { AppearanceStep } from "./steps/AppearanceStep";
import { VoiceStep } from "./steps/VoiceStep";
import { MonetizationStep } from "./steps/MonetizationStep";
import { PreviewStep } from "./steps/PreviewStep";
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

const STEP_CONFIG = [
  { step: 0, label: "Script", icon: MessageSquare },
  { step: 1, label: "Monetization", icon: DollarSign },
  { step: 2, label: "Voice", icon: Mic },
  { step: 3, label: "Appearance", icon: Palette },
  { step: 4, label: "Preview", icon: Eye },
] as const;

export function StudioWizard(props: StudioWizardProps) {
  const { currentStep, setCurrentStep } = useStudioForm();

  return (
    <div className="studio-wizard-container" style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
      <div className="studio-tabs-container" style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 0 16px", borderBottom: "1px solid rgba(148,163,184,0.2)" }}>
        {STEP_CONFIG.map(({ step, label, icon: Icon }) => (
          <button
            key={step}
            type="button"
            onClick={() => setCurrentStep(step)}
            className="studio-tab-btn"
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid transparent",
              background: currentStep === step ? "rgba(0, 180, 255, 0.15)" : "rgba(148,163,184,0.08)",
              color: currentStep === step ? "#38bdf8" : "rgba(148,163,184,0.9)",
              fontWeight: currentStep === step ? 600 : 500,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon size={18} />
            <span className="studio-tab-title">{label}</span>
          </button>
        ))}
      </div>
      <div className="studio-tab-content" style={{ flex: 1, minHeight: 0 }}>
        {currentStep === 0 && <ScriptStep />}
        {currentStep === 1 && <MonetizationStep />}
        {currentStep === 2 && <VoiceStep />}
        {currentStep === 3 && <AppearanceStep />}
        {currentStep === 4 && (
          <PreviewStep
            finalGenerateDisabled={props.finalGenerateDisabled}
            finalGenerateLoading={props.finalGenerateLoading}
            finalGenerateLabel={props.finalGenerateLabel}
            finalGenerateNotice={props.finalGenerateNotice}
            onGenerateFinal={props.onGenerateFinal}
          />
        )}
      </div>
    </div>
  );
}
