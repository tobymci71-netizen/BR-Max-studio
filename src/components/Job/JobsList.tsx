"use client";
import {
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import type React from "react";

import { useUser } from "@clerk/nextjs";
import type { RenderJob } from "@/types/schema";
import { usePageNotifications } from "../../hooks/usePageNotifications";
import {
  CheckCircle2,
  Clock,
  Loader2,
  XCircle,
  Download,
  AlertCircle,
  Zap,
  Copy,
  X,
  RefreshCw,
  Flag,
  Filter,
} from "lucide-react";
import { useSupabase } from "@/hooks/useSupabaseClient";
import { Button } from "../Button";
import { formatMinutes } from "@/lib/utils";

type TimeFilter = "all" | "1h" | "6h" | "today" | "yesterday";

/* Updated status map with modern color scheme */
const STATUS_MAP = {
  queued: {
    label: "Queued",
    icon: Clock,
    color: "text-amber-400",
    bg: "bg-amber-500/15 border-amber-500/40",
    dot: "bg-amber-400",
  },
  processing: {
    label: "Processing",
    icon: Loader2,
    color: "text-cyan-400",
    bg: "bg-cyan-500/15 border-cyan-500/40",
    dot: "bg-cyan-400",
  },
  done: {
    label: "Complete",
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 border-emerald-500/40",
    dot: "bg-emerald-400",
  },
  failed: {
    label: "Failed",
    icon: XCircle,
    color: "text-rose-400",
    bg: "bg-rose-500/15 border-rose-500/40",
    dot: "bg-rose-400",
  },
  cancelled: {
    label: "Cancelled",
    icon: XCircle,
    color: "text-orange-400",
    bg: "bg-orange-500/15 border-orange-500/40",
    dot: "bg-orange-400",
  },
} as const;

/* --------------------------------- HELPERS -------------------------------- */
function isToday(d: Date) {
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
function isYesterday(d: Date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return (
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate()
  );
}
function formatHumanDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";

  const timeStr = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday(d)) {
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `Today at ${timeStr}`;
  }
  if (isYesterday(d)) return `Yesterday at ${timeStr}`;
  return d.toLocaleDateString();
}
function formatFullDateTime(iso?: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";

  const dateStr = d.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const relativeTime = formatHumanDateTime(iso);

  return `${dateStr} at ${timeStr} (${relativeTime})`;
}
function formatDuration(seconds?: number | null) {
  if (seconds == null || Number.isNaN(seconds)) return "-";
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r}s`;
  if (r === 0) return `${m}m`;
  return `${m}m ${r}s`;
}
function ceilMinutes(ms: number) {
  return Math.max(0, Math.ceil(ms / 60000));
}

// Filter helper functions
function filterJobsByTime(jobs: RenderJob[], filter: TimeFilter): RenderJob[] {
  if (filter === "all") return jobs;

  const now = new Date();
  const nowTime = now.getTime();

  return jobs.filter((job) => {
    const createdAt = new Date(job.created_at);
    const createdTime = createdAt.getTime();
    const diffMs = nowTime - createdTime;
    const diffHours = diffMs / (1000 * 60 * 60);

    switch (filter) {
      case "1h":
        return diffHours <= 1;
      case "6h":
        return diffHours <= 6;
      case "today":
        return isToday(createdAt);
      case "yesterday":
        return isYesterday(createdAt);
      default:
        return true;
    }
  });
}

/* Completely redesigned component with modern styling */
const JobsList = forwardRef((_, ref) => {
  const { user, isLoaded } = useUser();
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetchedJobs, setHasFetchedJobs] = useState(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("1h");
  const { supabase } = useSupabase();

  const {
    hasNewCompletedJobs,
    resetNotifications,
    hasNotificationPermission,
    requestNotificationPermission,
  } = usePageNotifications(jobs, isLoaded, hasFetchedJobs);

  // NEW: inline/global error states
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [now, setNow] = useState<number>(Date.now());

  // Flag modal state
  const [flagModalOpen, setFlagModalOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagSuccess, setFlagSuccess] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const openFlagModal = (jobId: string) => {
    setSelectedJobId(jobId);
    setFlagModalOpen(true);
    setFlagReason("");
    setFlagSuccess(false);
  };

  const closeFlagModal = () => {
    setFlagModalOpen(false);
    setSelectedJobId(null);
    setFlagReason("");
    setFlagSuccess(false);
  };

  const submitFlag = async () => {
    if (!selectedJobId || !flagReason.trim()) {
      setInlineError("Please provide a reason for flagging");
      return;
    }

    setFlagSubmitting(true);
    try {
      const response = await fetch("/api/render/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: selectedJobId,
          reason: flagReason.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to flag job");
      }

      setFlagSuccess(true);
      await refreshJobs();
    } catch (error) {
      console.error("Error flagging job:", error);
      setInlineError(
        error instanceof Error ? error.message : "Failed to flag job",
      );
    } finally {
      setFlagSubmitting(false);
    }
  };

  const refreshJobs = async () => {
    if (!isLoaded || !user?.id) return;

    const { data: jobsData, error: jobsError } = await supabase
      .from("render_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (jobsError) {
      console.error("Error fetching jobs:", jobsError);
      setInlineError(
        "Could not load your jobs. Please retry or check your connection.",
      );
    } else {
      setJobs(jobsData ?? []);
    }

    setLoading(false);
    setHasFetchedJobs(true);
  };

  useImperativeHandle(ref, () => ({
    refreshJobs,
    hasNotificationPermission,
    requestNotificationPermission,
  }));

  // Initial fetch
  useEffect(() => {
    refreshJobs();
  }, [supabase, user?.id, isLoaded]);

  // Simple: just refresh on any database update
  useEffect(() => {
    if (!isLoaded || !user?.id) return;

    const channel = supabase
      .channel("job-updates")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "render_jobs",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log("New update")
          // Just refresh the entire list
          refreshJobs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user?.id, isLoaded]);

  // Update clock every second
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Filter jobs based on selected time filter
  const filteredJobs = filterJobsByTime(jobs, timeFilter);

  const filterOptions: { label: string; value: TimeFilter; count: number }[] = [
    { label: "All", value: "all", count: jobs.length },
    {
      label: "Last 1 Hour",
      value: "1h",
      count: filterJobsByTime(jobs, "1h").length,
    },
    {
      label: "Last 6 Hours",
      value: "6h",
      count: filterJobsByTime(jobs, "6h").length,
    },
    {
      label: "Today",
      value: "today",
      count: filterJobsByTime(jobs, "today").length,
    },
    {
      label: "Yesterday",
      value: "yesterday",
      count: filterJobsByTime(jobs, "yesterday").length,
    },
  ];

  return (
    <>
      <div className="w-full bg- py-6">
          {/* Header Section */}
          <div className="px-6 py-6 border-b border-gray-700">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent-primary/10 rounded-lg">
                  <Zap className="w-4 h-4 text-accent-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">
                    Render Jobs
                  </h1>
                  <p className="text-gray-400 text-sm mt-1">
                    Track and manage your video rendering tasks
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setInlineError(null);
                  refreshJobs();
                }}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white text-black hover:opacity-90 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Filter className="w-4 h-4" />
                <span>Filter:</span>
              </div>
              {filterOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeFilter(option.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200 border ${
                    timeFilter === option.value
                      ? "bg-accent-primary text-white border-accent-primary"
                      : "bg-white text-black border-white hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                  <span
                    className={`ml-2 text-xs ${
                      timeFilter === option.value
                        ? "text-white/80"
                        : "text-gray-600"
                    }`}
                  >
                    ({option.count})
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Notifications & Errors */}
          {(inlineError || hasNewCompletedJobs) && (
            <div className="px-6 py-3 border-b border-gray-700 space-y-3">
              {inlineError && (
                <div
                  className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start justify-between gap-3"
                  role="alert"
                  aria-live="polite"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 bg-rose-500/20 rounded-md border border-rose-500/30">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                    </div>
                    <div className="text-sm text-rose-300">{inlineError}</div>
                  </div>
                  <button
                    onClick={() => setInlineError(null)}
                    className="text-rose-300/80 hover:text-rose-200 transition-colors"
                    aria-label="Dismiss error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {hasNewCompletedJobs && (
                <div
                  className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center justify-between"
                  aria-live="polite"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium text-emerald-300">
                      New video ready for download!
                    </span>
                  </div>
                  <button
                    onClick={resetNotifications}
                    className="text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Loading & Empty States */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-accent-primary animate-spin" />
                <p className="text-muted-foreground">Loading your jobs...</p>
              </div>
            </div>
          )}

          {!loading && jobs.length === 0 && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Clock className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-lg font-medium text-white mb-1">
                  No render jobs yet
                </p>
                <p className="text-sm text-gray-400">
                  Start creating your first video!
                </p>
              </div>
            </div>
          )}

          {!loading && filteredJobs.length === 0 && jobs.length > 0 && (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="w-16 h-16 bg-gray-800 rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <Filter className="w-8 h-8 text-gray-500" />
                </div>
                <p className="text-lg font-medium text-white mb-1">
                  {timeFilter === "all" && "No jobs available"}
                  {timeFilter === "1h" && "No jobs available since last 1 hour"}
                  {timeFilter === "6h" && "No jobs available since last 6 hours"}
                  {timeFilter === "today" && "No jobs available today"}
                  {timeFilter === "yesterday" && "No jobs available yesterday"}
                </p>
                <p className="text-sm text-gray-400">
                  Try selecting a different time filter
                </p>
              </div>
            </div>
          )}

          {/* Jobs List */}
          {!loading && filteredJobs.length > 0 && (
            <div className="border-t border-b border-gray-700 grid grid-cols-1 md:grid-cols-2">
              {filteredJobs.map((job) => {
                const s = STATUS_MAP[
                  job.status as keyof typeof STATUS_MAP
                ] ?? {
                  label: "Unknown",
                  icon: AlertCircle,
                  color: "text-muted-foreground",
                  bg: "bg-muted/50 border-muted",
                  dot: "bg-muted-foreground",
                };
                const Icon = s.icon;

                const createdLabel = formatHumanDateTime(job.created_at);

                let durationSec: number | undefined;
                if (typeof job.duration_sec === "number") {
                  durationSec = job.duration_sec;
                } else if (job.utc_start && job.utc_end) {
                  const d =
                    (new Date(job.utc_end).getTime() -
                      new Date(job.utc_start).getTime()) /
                    1000;
                  durationSec = d > 0 ? d : undefined;
                }

                const hasEnded = !!job.utc_end;
                const expiryMs = hasEnded
                  ? new Date(job.utc_end!).getTime() + 60 * 60 * 1000
                  : null;
                const remainingMin = expiryMs
                  ? ceilMinutes(expiryMs - now)
                  : null;
                const expired = expiryMs ? now > expiryMs : false;

                return (
                  <div
                    key={job.id}
                    className="group relative px-4 py-4 border-b md:border-r md:last:border-r-0 md:odd:border-r border-gray-700 hover:bg-gray-900 transition-all duration-200"
                  >
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-1">
                        <div
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border ${s.bg}`}
                        >
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${s.dot} ${job.status === "processing" ? "animate-pulse" : ""}`}
                          ></div>
                          <Icon
                            className={`w-3.5 h-3.5 ${s.color} ${job.status === "processing" ? "animate-spin" : ""}`}
                          />
                          <span className={`text-xs font-semibold ${s.color}`}>
                            {s.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400">
                          <span>{job.job_id.slice(0, 6)}</span>
                          <button
                            onClick={() => copyToClipboard(job.job_id)}
                            className="p-0.5 hover:bg-gray-800 rounded transition-colors"
                            title="Copy job ID"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400 whitespace-nowrap">
                        {createdLabel}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 gap-2 mb-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">
                          Timing
                        </div>
                        <div className="space-y-0.5 text-white">
                          <div className="relative group/tooltip inline-block">
                            <div className="cursor-help">
                              <span className="text-gray-400">Duration:</span>{" "}
                              <span className="font-medium">
                                {formatDuration(durationSec)}
                              </span>
                            </div>
                            {/* Tooltip */}
                            <div className="absolute left-0 bottom-full mb-2 hidden group-hover/tooltip:block z-10 w-max max-w-xs">
                              <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
                                <div className="space-y-1">
                                  <div>
                                    <span className="text-gray-400">Started:</span>{" "}
                                    <span className="text-white">
                                      {formatFullDateTime(job.utc_start)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-gray-400">Ended:</span>{" "}
                                    <span className="text-white">
                                      {formatFullDateTime(job.utc_end)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <div className="text-[10px] uppercase tracking-wide text-gray-500">
                          Status Details
                        </div>
                        <div className="space-y-0.5 text-white">
                          <div>
                            <span className="text-gray-400">
                              Status:
                            </span>{" "}
                            <span className={`font-medium ${s.color}`}>
                              {s.label}
                            </span>
                          </div>
                          {hasEnded &&
                            !expired &&
                            remainingMin !== null &&
                            job.status === "done" && (
                              <div>
                                <span className="text-gray-400">
                                  Expires in:
                                </span>{" "}
                                <span className="text-amber-400 font-medium">
                                  {formatMinutes(remainingMin)}
                                </span>
                              </div>
                            )}
                          {job.status === "failed" && (
                            <div>
                              <span className="text-rose-400 font-medium">
                                Render failed
                              </span>
                            </div>
                          )}
                          {job.status === "cancelled" && (
                            <div>
                              <span className="text-orange-400 font-medium">
                                Job cancelled
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {job.error_message && (
                        <div className="space-y-0.5">
                          <div className="text-[10px] uppercase tracking-wide text-rose-400">
                            Error Details
                          </div>
                          <p className="text-rose-300 text-xs flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                            <span className="flex-1">{job.error_message}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Progress Bar - Only for processing/queued */}
                    {(job.status === "processing" || job.status === "queued") && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-white">
                            {job.status === "queued"
                              ? "Generating audio..."
                              : "Rendering video..."}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-accent-primary animate-pulse"
                            style={{ width: "50%" }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Download Actions */}
                    {job.status === "failed" && !job.s3_url && (
                      <div className="pt-3 border-t border-gray-700">
                        <div className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg mb-2">
                          <div className="flex items-start gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-rose-400 mb-0.5">
                                Render Failed - No Download Available
                              </p>
                              <p className="text-[10px] text-rose-300/80">
                                {job.error_message ||
                                  "The video rendering process encountered an error. Please try creating a new job."}
                              </p>
                            </div>
                          </div>
                        </div>
                        {!job.is_flagged_for_issue && (
                          <button
                            onClick={() => openFlagModal(job.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all duration-200"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            Report Issue
                          </button>
                        )}
                        {job.is_flagged_for_issue && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-orange-500/30 bg-orange-500/10 text-orange-400">
                            <Flag className="w-3.5 h-3.5" />
                            <span>Issue Reported</span>
                          </div>
                        )}
                      </div>
                    )}

                    {job.status === "cancelled" && !job.s3_url && (
                      <div className="pt-3 border-t border-gray-700">
                        <div className="p-2 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                          <div className="flex items-start gap-1.5">
                            <XCircle className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-orange-400 mb-0.5">
                                Job Cancelled - No Download Available
                              </p>
                              <p className="text-[10px] text-orange-300/80">
                                This render job was cancelled before completion.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {job.status === "done" && !job.s3_url && (
                      <div className="pt-3 border-t border-gray-700">
                        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-2">
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-amber-400 mb-0.5">
                                Download Link Not Available
                              </p>
                              <p className="text-[10px] text-amber-300/80">
                                The video file is not available. This may be due
                                to a processing issue.
                              </p>
                            </div>
                          </div>
                        </div>
                        {!job.is_flagged_for_issue && (
                          <button
                            onClick={() => openFlagModal(job.id)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-orange-500/40 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-all duration-200"
                          >
                            <Flag className="w-3.5 h-3.5" />
                            Report Issue
                          </button>
                        )}
                        {job.is_flagged_for_issue && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-orange-500/30 bg-orange-500/10 text-orange-400">
                            <Flag className="w-3.5 h-3.5" />
                            <span>Issue Reported</span>
                          </div>
                        )}
                      </div>
                    )}

                    {job.s3_url && job.status === "done" && (
                      <div className="pt-3 border-t border-gray-700">
                        {expired && (
                          <div className="mb-2 p-2 bg-rose-500/10 border border-rose-500/30 rounded-lg">
                            <div className="flex items-start gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <p className="text-xs font-medium text-rose-400 mb-0.5">
                                  Download Link Expired
                                </p>
                                <p className="text-[10px] text-rose-300/80">
                                  The download link expired after{" "}
                                  {job.is_flagged_for_issue
                                    ? "24 hours"
                                    : "1 hour"}
                                  . Please create a new render if you still need
                                  this video.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => {
                                if (!expired)
                                  window.open(
                                    job.s3_url as string,
                                    "_blank",
                                    "noopener,noreferrer",
                                  );
                              }}
                              disabled={expired}
                              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                                expired
                                  ? "cursor-not-allowed opacity-50 bg-gray-800 text-gray-500"
                                  : "bg-accent-primary text-white hover:opacity-90"
                              }`}
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download Video
                            </button>

                            {!job.is_flagged_for_issue && !expired && (
                              <button
                                onClick={() => openFlagModal(job.id)}
                                className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-gray-600 text-white hover:bg-gray-800 transition-all duration-200"
                                title="Flag an issue"
                              >
                                <Flag className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">
                                  Flag Issue
                                </span>
                              </button>
                            )}

                            {job.is_flagged_for_issue && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-orange-500/30 bg-orange-500/10 text-orange-400">
                                <Flag className="w-3.5 h-3.5" />
                                <span>Flagged</span>
                              </div>
                            )}
                          </div>

                          {hasEnded && !expired && (
                            <div className="flex items-center gap-1.5 text-xs">
                              <Clock className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-gray-400">
                                Expires in:{" "}
                              </span>
                              <span
                                className={`font-medium ${
                                  remainingMin && remainingMin <= 10
                                    ? "text-rose-400"
                                    : remainingMin && remainingMin <= 30
                                      ? "text-amber-400"
                                      : "text-emerald-400"
                                }`}
                              >
                                {job.is_flagged_for_issue
                                  ? formatMinutes(
                                      Math.ceil(
                                        24 * 60 -
                                          (now -
                                            new Date(job.utc_end!).getTime()) /
                                            60000,
                                      ),
                                    )
                                  : formatMinutes(remainingMin || 0)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {flagModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeFlagModal}
        >
          <div
            className="bg-card border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {!flagSuccess ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg border border-orange-500/30">
                      <Flag className="w-5 h-5 text-orange-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      Flag an Issue
                    </h3>
                  </div>
                  <button
                    onClick={closeFlagModal}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    disabled={flagSubmitting}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground mb-4">
                  Please describe the issue with this video. Our team will
                  review it and refund your tokens if the video wasn't rendered
                  properly.
                </p>

                <div className="mb-4 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <p className="text-xs text-cyan-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    <span>
                      Flagging extends video lifetime from 1 hour to 24 hours
                    </span>
                  </p>
                </div>

                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Describe the issue (e.g., video not playing, incorrect audio, visual glitches)..."
                  className="w-full h-32 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-4"
                  disabled={flagSubmitting}
                />

                <div className="flex items-center gap-3">
                  <Button
                    onClick={submitFlag}
                    disabled={flagSubmitting || !flagReason.trim()}
                  >
                    {flagSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Flag className="w-4 h-4" />
                        Submit Flag
                      </>
                    )}
                  </Button>
                  <button
                    onClick={closeFlagModal}
                    disabled={flagSubmitting}
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted text-foreground transition-all duration-200 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Issue Flagged Successfully
                </h3>
                <p className="text-sm text-muted-foreground">
                  Video lifetime extended to 24 hours. Our team will review and
                  respond soon.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes shimmer {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 200% 50%;
          }
        }
        .animate-shimmer {
          background-size: 200% 100%;
          animation: shimmer 2.2s linear infinite;
        }
      `}</style>
    </>
  );
});

JobsList.displayName = "JobsList";
export default JobsList;