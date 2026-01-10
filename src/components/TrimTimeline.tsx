import React from "react";

interface TrimTimelineProps {
  /** Media duration in seconds */
  durationSec: number | null;
  /** Current playback time (in seconds) */
  currentTime?: number | null;
  /** Current selection (sec). If null, defaults to [0, duration] */
  value?: { start: number; end: number } | null;
  /** Called on every drag */
  onChange?: (v: { start: number; end: number }) => void;
  /** Called on mouseup (commit) */
  onCommit?: (v: { start: number; end: number }) => void;
  /** Optional: label (e.g., "Audio" / "Video") */
  label?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function TrimTimeline({
  durationSec,
  value,
  onChange,
  onCommit,
  currentTime = 0,
  label = "Media",
}: TrimTimelineProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = React.useState<null | "start" | "end">(null);
  const [local, setLocal] = React.useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // initialize local when duration/value changes
  React.useEffect(() => {
    if (!durationSec || durationSec <= 0) return;
    const start = clamp(value?.start ?? 0, 0, durationSec);
    const end = clamp(value?.end ?? durationSec, 0, durationSec);
    setLocal({ start: Math.min(start, end), end: Math.max(start, end) });
  }, [durationSec, value?.start, value?.end]);

  const pxToTime = React.useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el || !durationSec || durationSec <= 0) return 0;
      const rect = el.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const ratio = rect.width === 0 ? 0 : x / rect.width;
      return clamp(ratio * durationSec, 0, durationSec);
    },
    [durationSec],
  );

  const handleDown = (which: "start" | "end") => (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(which);
  };

  React.useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      if (!durationSec || durationSec <= 0) return;
      const t = pxToTime(e.clientX);
      const next = { ...local };
      if (dragging === "start") next.start = clamp(t, 0, next.end);
      if (dragging === "end") next.end = clamp(t, next.start, durationSec);
      setLocal(next);
      onChange?.(next);
    };

    const onUp = () => {
      setDragging(null);
      onCommit?.(local);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, local, durationSec, pxToTime, onChange, onCommit]);

  const format = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  const percent = (t: number) =>
    !durationSec || durationSec <= 0 ? 0 : (t / durationSec) * 100;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, opacity: 0.8 }}>
        <span>{label} trim</span>
        <span>
          Start: <b>{format(local.start || 0)}</b> • End: <b>{format(local.end || 0)}</b>{" "}
          • Len: <b>{format(Math.max(0, (local.end || 0) - (local.start || 0)))}</b>
        </span>
      </div>

      {/* Track */}
      <div
        ref={containerRef}
        style={{
          position: "relative",
          height: 36,
          borderRadius: 8,
          background: "rgba(255,255,255,0.06)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
          cursor: dragging ? "grabbing" : "default",
          userSelect: "none",
        }}
        onMouseDown={(e) => {
          if (!durationSec || durationSec <= 0) return;
          const t = pxToTime(e.clientX);
          const distStart = Math.abs(t - local.start);
          const distEnd = Math.abs(t - local.end);
          setDragging(distStart <= distEnd ? "start" : "end");
        }}
      >
        {/* Selected range */}
        <div
          style={{
            position: "absolute",
            left: `${percent(local.start)}%`,
            width: `${Math.max(0, percent(local.end) - percent(local.start))}%`,
            top: 0,
            bottom: 0,
            background: "rgba(0,122,255,0.35)",
            outline: "1px solid rgba(0,122,255,0.8)",
            borderRadius: 8,
          }}
        />

        {/* Playhead line */}
        {durationSec && (
          <div
            style={{
              position: "absolute",
              left: `${percent(clamp(currentTime || 0, 0, durationSec))}%`,
              top: 0,
              bottom: 0,
              width: 2,
              background: "rgba(255,255,255,0.9)",
              boxShadow: "0 0 4px rgba(255,255,255,0.6)",
              transition: dragging ? "none" : "left 0.05s linear",
            }}
          />
        )}

        {/* Start handle */}
        <div
          onMouseDown={handleDown("start")}
          style={{
            position: "absolute",
            left: `calc(${percent(local.start)}% - 6px)`,
            top: -2,
            width: 12,
            height: 40,
            borderRadius: 6,
            background: "white",
            opacity: 0.9,
            boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
            cursor: "ew-resize",
          }}
          title="Drag start"
        />

        {/* End handle */}
        <div
          onMouseDown={handleDown("end")}
          style={{
            position: "absolute",
            left: `calc(${percent(local.end)}% - 6px)`,
            top: -2,
            width: 12,
            height: 40,
            borderRadius: 6,
            background: "white",
            opacity: 0.9,
            boxShadow: "0 0 0 2px rgba(0,0,0,0.35)",
            cursor: "ew-resize",
          }}
          title="Drag end"
        />
      </div>
    </div>
  );
}