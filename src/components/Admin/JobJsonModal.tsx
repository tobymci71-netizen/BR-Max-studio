import { useState, useMemo } from "react";
import { X, Copy } from "lucide-react";
import type { GenericSupabaseRow } from "@/types/admin";

const isPrimitive = (value: unknown) =>
  value === null || ["string", "number", "boolean"].includes(typeof value);

const formatLabel = (label: string | number) => (typeof label === "number" ? `[${label}]` : label);

function JsonNode({ data, label }: { data: unknown; label?: string | number }) {
  const isLeaf = isPrimitive(data);
  const [collapsed, setCollapsed] = useState(label !== undefined);

  if (isLeaf) {
    return (
      <div className="pl-4 text-sm text-white/80">
        {label !== undefined && (
          <span className="font-medium text-white">{formatLabel(label)}: </span>
        )}
        <span className="font-mono text-xs text-emerald-200">
          {typeof data === "string" ? `"${data}"` : String(data)}
        </span>
      </div>
    );
  }

  const entries = useMemo(() => {
    if (Array.isArray(data)) {
      return data.map((item, idx) => ({ key: idx, value: item }));
    }
    if (data && typeof data === "object") {
      return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
        key,
        value,
      }));
    }
    return [];
  }, [data]);

  const typeLabel = Array.isArray(data) ? "array" : "object";
  const size = Array.isArray(data) ? data.length : Object.keys(data as object).length;

  return (
    <div className="pl-4">
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-medium text-white transition hover:text-emerald-200"
        onClick={() => setCollapsed((prev) => !prev)}
      >
        <span
          className={`inline-block h-4 w-4 rounded border border-white/20 bg-white/5 text-center leading-4 text-[10px] transition ${
            collapsed ? "" : "rotate-90"
          }`}
        >
          ▶
        </span>
        {label !== undefined && <span>{formatLabel(label)}</span>}
        <span className="text-xs uppercase tracking-wide text-white/50">
          {typeLabel} ({size})
        </span>
      </button>
      {!collapsed && (
        <div className="mt-1 flex flex-col gap-1 border-l border-white/10 pl-4">
          {entries.map((entry) => (
            <JsonNode key={entry.key} label={entry.key} data={entry.value} />
          ))}
          {entries.length === 0 && (
            <div className="text-xs text-white/50">Empty {typeLabel}</div>
          )}
        </div>
      )}
    </div>
  );
}

interface JobJsonModalProps {
  job: GenericSupabaseRow;
  onClose: () => void;
}

export default function JobJsonModal({ job, onClose }: JobJsonModalProps) {
  const rawJson = useMemo(() => JSON.stringify(job, null, 2), [job]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawJson);
    } catch (error) {
      console.error("Failed to copy job JSON", error);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-5 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-white/50">Render Job</p>
            <p className="text-lg font-semibold text-white">JSON payload</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Copy className="h-4 w-4" />
              Copy JSON
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 bg-white/5 p-2 text-white transition hover:bg-white/15"
              aria-label="Close JSON modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <JsonNode data={job} />
        </div>

        <div className="border-t border-white/10 bg-white/[0.02] px-5 py-3 text-right">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
