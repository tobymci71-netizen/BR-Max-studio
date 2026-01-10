"use client";
import React from "react";
import { ToastProvider } from "../../hooks/useToast";
import { TOK } from "../../../styles/TOK";
import { StudioProvider } from "./StudioProvider";
import { StudioPreview } from "./StudioPreview";
import { StudioWizard } from "./StudioWizard";
import type { CompositionPropsType } from "@/types/constants";
import type { MonetizationPreviewContext } from "@/helpers/previewBuilder";

export type IMessagesStudioProps = {
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
};

export default function IMessagesStudio(props: IMessagesStudioProps) {
  return (
    <ToastProvider>
      <StudioProvider>
        <div
          style={{
            fontFamily: TOK.font,
            width: "100%",
            minHeight: "100vh",
            color: "inherit",
            padding: "48px clamp(16px, 4vw, 32px)",
          }}
        >
          {/* Header */}
          <header style={{ maxWidth: 1400, margin: "0 auto 32px" }}>
            <h1
              style={{
                fontSize: "clamp(28px, 5vw, 36px)",
                fontWeight: 800,
                margin: 0,
                background: "linear-gradient(90deg,#ffffff,#c8e1ff)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                lineHeight: 1.2,
              }}
            >
              {props.title}
            </h1>
            <p style={{ marginTop: 12, opacity: 0.75, fontSize: 15, maxWidth: 600 }}>
              Create your iMessage video in 5 simple steps. Your progress is automatically saved.
            </p>
          </header>

          {/* Main Layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 400px) minmax(0, 1fr)",
              gap: 32,
              maxWidth: 1400,
              margin: "0 auto",
              alignItems: "start",
            }}
            className="studio-layout"
          >
            {/* Preview - Left Side (Sticky) */}
            <div style={{ position: "sticky", top: 24 }}>
              <StudioPreview />
            </div>

            {/* Wizard - Right Side */}
            <StudioWizard {...props} />
          </div>
        </div>

        <style>{`
          @media (max-width: 1024px) {
            .studio-layout {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </StudioProvider>
    </ToastProvider>
  );
}

