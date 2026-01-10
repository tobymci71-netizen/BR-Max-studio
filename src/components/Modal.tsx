"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TOK } from "../../styles/TOK";
import { Button } from "./Button";
import { Row } from "./Row";

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actionButton?: React.ReactNode;
  width?: number;
}> = ({ open, onClose, title, children, actionButton, width = 680 }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll while modal is open
  useEffect(() => {
    if (!mounted || !open) {
      return;
    }

    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose, open]);

  if (!mounted || !open) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: `min(94vw, ${width}px)`,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: TOK.card.bg,
          border: TOK.card.bd,
          boxShadow: TOK.card.sh,
          backdropFilter: TOK.card.blur,
          borderRadius: 16,
        }}
      >
        <div
          style={{
            padding: 18,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0, fontSize: 18, color: "white" }}>{title}</h3>
            <div className="flex flex-end gap-3">
              <Button
                variant="ghost"
                onClick={onClose}
                style={{ fontWeight: 600 }}
              >
                Close
              </Button>
              {actionButton}
            </div>
          </Row>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 18 }}>{children}</div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
};
