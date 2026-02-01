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
  isSubscribed?: boolean;
};

export default function IMessagesStudio(props: IMessagesStudioProps) {
  return (
    <ToastProvider>
      <StudioProvider isSubscribed={props.isSubscribed ?? false}>
        <div
          className="studio-root"
          style={{
            fontFamily: TOK.font,
            width: "100%",
            maxWidth: "100vw",
            minHeight: "100vh",
            color: "inherit",
            padding: "48px clamp(16px, 4vw, 32px)",
            boxSizing: "border-box",
            overflowX: "hidden",
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
            {/* Preview - Left on desktop, first on mobile so it's visible without scrolling */}
            <div className="studio-preview-container" style={{ position: "sticky", top: 24 }}>
              <StudioPreview />
            </div>

            {/* Wizard - Right on desktop, below preview on mobile */}
            <div className="studio-wizard-container">
              <StudioWizard {...props} />
            </div>
          </div>
        </div>

        <style>{`
          .studio-root {
            max-width: 100vw;
            box-sizing: border-box;
          }
          .studio-root *,
          .studio-root *::before,
          .studio-root *::after {
            box-sizing: border-box;
          }
          @media (max-width: 1024px) {
            .studio-layout {
              grid-template-columns: 1fr !important;
              max-width: 100% !important;
              min-width: 0 !important;
            }
            .studio-preview-container {
              order: 1 !important;
              position: relative !important;
              top: 0 !important;
              min-height: 0 !important;
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              overflow: hidden !important;
            }
            .studio-wizard-container {
              order: 2 !important;
              min-width: 0 !important;
              max-width: 100% !important;
              overflow: hidden !important;
            }
            .studio-preview-card {
              padding: 12px !important;
              min-height: 200px !important;
              display: block !important;
              visibility: visible !important;
              max-width: 100% !important;
              overflow: hidden !important;
            }
            .studio-preview-header {
              margin-bottom: 8px !important;
            }
            .studio-preview-player-wrapper {
              max-height: 65vh;
              min-height: 200px !important;
              width: 100% !important;
              max-width: 100% !important;
              min-width: 0 !important;
              display: flex !important;
              justify-content: center;
              align-items: center;
              overflow: hidden !important;
            }
            .studio-preview-player-wrapper > div {
              max-height: 65vh !important;
              max-width: 100% !important;
              min-width: 0 !important;
              min-height: 180px !important;
              width: 100% !important;
              height: auto !important;
              overflow: hidden !important;
            }
          }
          @media (max-width: 768px) {
            .studio-tabs-container {
              padding: 16px 12px 0 !important;
            }
            .studio-tabs {
              gap: 4px !important;
            }
            .studio-tab-btn {
              padding: 8px 4px !important;
              font-size: 10px !important;
              border-radius: 8px !important;
              min-width: 50px !important;
            }
            .studio-tab-step-label {
              font-size: 8px !important;
              margin-bottom: 2px !important;
            }
            .studio-tab-title {
              font-size: 10px !important;
            }
            .studio-tab-icon {
              top: 4px !important;
              right: 4px !important;
              width: 10px !important;
              height: 10px !important;
            }
          }
        `}</style>
      </StudioProvider>
    </ToastProvider>
  );
}

