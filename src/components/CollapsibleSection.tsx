import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface CollapsibleSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  subtitle,
  icon,
  defaultOpen = false,
  children,
  badge,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        border: isOpen ? "1px solid rgba(0,122,255,0.25)" : "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        background: isOpen
          ? "linear-gradient(180deg, rgba(0,122,255,0.08), rgba(0,122,255,0.04))"
          : "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
        overflow: "hidden",
        transition: "all 200ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: "transparent",
          border: "none",
          color: "white",
          cursor: "pointer",
          textAlign: "left",
          transition: "background 150ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          {icon && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(0,122,255,0.15), rgba(0,180,255,0.15))",
                border: "1px solid rgba(0,122,255,0.3)",
              }}
            >
              {icon}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h3>
              {badge && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #007aff, #00b4ff)",
                    color: "white",
                  }}
                >
                  {badge}
                </span>
              )}
            </div>
            {subtitle && (
              <p style={{ fontSize: 13, opacity: 0.7, margin: "4px 0 0 0" }}>{subtitle}</p>
            )}
          </div>
        </div>
        <ChevronDown
          size={20}
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: 0.7,
          }}
        />
      </button>

      {/* Content */}
      <div
        style={{
          maxHeight: isOpen ? "2000px" : "0",
          opacity: isOpen ? 1 : 0,
          transition: "max-height 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 250ms ease",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "0 20px 20px 20px",
            borderTop: isOpen ? "1px solid rgba(255,255,255,0.06)" : "none",
          }}
        >
          <div style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
