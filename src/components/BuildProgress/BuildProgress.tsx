"use client";

import React, { useMemo } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { Card } from "../Card";
import { Row } from "../Row";
import milestones from "../IMessagesStudio/milestones.json";

const completedMilestones = milestones.completedMilestones;
const upcomingMilestones = milestones.upcomingMilestones;

export default function BuildProgress() {
  const overallProgress = useMemo(() => {
    const total = completedMilestones.length + upcomingMilestones.length;
    return total ? completedMilestones.length / total : 0;
  }, []);

  const overallPercent = Math.round(overallProgress * 100);
  const overallDegree = overallPercent > 0 ? Math.max(6, overallPercent) * 3.6 : 0;

  return (
    <Card
      style={{
        padding: "24px",
        display: "grid",
        gap: 20,
        width: "100%",
        background: "linear-gradient(135deg, rgba(12,18,28,0.92), rgba(18,31,44,0.8))",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 20px 45px rgba(15,23,42,0.45)",
      }}
    >
      <Row style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
        <Row style={{ gap: 12, alignItems: "center", flex: "1 1 200px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={20} color="#8be9fd" />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: 0.2 }}>Build progress</h2>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.72 }}>
              A quick snapshot of what&apos;s live and what&apos;s landing soon.
            </p>
          </div>
        </Row>
        <div
          style={{
            position: "relative",
            width: 74,
            height: 74,
            borderRadius: "50%",
            background: `conic-gradient(#00b4ff ${overallDegree}deg, rgba(148,163,184,0.18) ${overallDegree}deg)`,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 58,
              height: 58,
              borderRadius: "50%",
              background: "rgba(13,19,33,0.95)",
              display: "grid",
              placeItems: "center",
              fontSize: 16,
              fontWeight: 600,
              color: "white",
            }}
          >
            {overallPercent}%
          </div>
        </div>
      </Row>

      <div className="build-progress-lists" style={{ display: "grid", gap: 14, }}>
        <div
          style={{
            display: "grid",
            gap: 12,
            padding: "14px",
            borderRadius: 16,
            background: "rgba(15,23,42,0.55)",
            border: "1px solid rgba(59,130,246,0.12)",
          }}
        >
          <Row style={{ gap: 10, alignItems: "center" }}>
            <CheckCircle2 size={18} color="#34d399" />
            <strong style={{ fontSize: 14, letterSpacing: 0.2 }}>Shipped</strong>
          </Row>
          <div style={{ display: "grid", gap: 8 }}>
            {completedMilestones.map((item) => (
              <Row key={item} style={{ gap: 8, alignItems: "center" }}>
                <span style={{ opacity: 0.4, fontSize: 16 }}>•</span>
                <span style={{ fontSize: 13, opacity: 0.85 }}>{item}</span>
              </Row>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            padding: "14px",
            borderRadius: 16,
            background: "rgba(12,74,110,0.45)",
            border: "1px solid rgba(56,189,248,0.2)",
          }}
        >
          <Row style={{ gap: 10, alignItems: "center" }}>
            <Sparkles size={18} color="#f9d66d" />
            <strong style={{ fontSize: 14, letterSpacing: 0.2 }}>Coming up</strong>
          </Row>
          <div style={{ display: "grid", gap: 8 }}>
            {upcomingMilestones.map((item) => (
              <Row key={item} style={{ gap: 8, alignItems: "flex-start" }}>
                <span style={{ opacity: 0.4, fontSize: 16 }}>•</span>
                <span style={{ fontSize: 13, opacity: 0.85 }}>{item}</span>
              </Row>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 980px) {
          .build-progress-lists {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Card>
  );
}
