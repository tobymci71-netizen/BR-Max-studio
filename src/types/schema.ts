import { z } from "zod";
import { CompositionPropsWithValidation, defaultMyCompProps } from "./constants";

export const RenderRequest = z.object({
  id: z.string(),
  inputProps: CompositionPropsWithValidation,
});

export const ProgressRequest = z.object({
  bucketName: z.string(),
  id: z.string(),
});

export type ProgressResponse =
  | {
      type: "error";
      message: string;
    }
  | {
      type: "progress";
      progress: number;
    }
  | {
      type: "done";
      url: string;
      size: number;
    };

/** Lifecycle status for render_jobs. Matches DB enum. Includes legacy values for backward compat. */
export type RenderStatus =
  | "queued" // legacy: pre-video stage
  | "processing"
  | "audio_generation"
  | "audio_uploaded"
  | "awaiting_to_start_render"
  | "video_generation"
  | "video_generated"
  | "done"
  | "failed"
  | "cancelled";

export const RENDER_STATUS_VALUES: readonly RenderStatus[] = [
  "queued",
  "processing",
  "audio_generation",
  "audio_uploaded",
  "awaiting_to_start_render",
  "video_generation",
  "video_generated",
  "done",
  "failed",
  "cancelled",
] as const;

/** Statuses that mean the job is still in progress (not terminal). Includes legacy queued. */
export const RENDER_STATUS_IN_PROGRESS: RenderStatus[] = [
  "queued",
  "processing",
  "audio_generation",
  "audio_uploaded",
  "awaiting_to_start_render",
  "video_generation",
];

/** Statuses that allow cancelling the job. Includes legacy queued. */
export const RENDER_STATUS_CANCELLABLE: RenderStatus[] = [
  "queued",
  "processing",
  "audio_generation",
  "audio_uploaded",
  "awaiting_to_start_render",
  "video_generation",
];

/** Statuses that count as completed (success). */
export const RENDER_STATUS_COMPLETED: RenderStatus[] = ["done", "video_generated"];

/** Generation phase: audio (preview/confirm) then video (final render). Matches DB enum render_job_stage. */
export type RenderJobStage = "audio" | "video";

export const RENDER_JOB_STAGES: readonly RenderJobStage[] = ["audio", "video"];

export interface RenderJob {
  id: string; // uuid
  user_id: string;
  job_id: string;
  status: RenderStatus; // enum
  stage: RenderJobStage;
  json_path: string | null;
  s3_url: string | null;
  composition_props: Record<string, typeof defaultMyCompProps> | null;
  utc_start: string | null;
  utc_end: string | null;
  lambda_render_id: string | null;
  lambda_bucket_name: string | null;
  duration_sec: number | null;
  error_message: string | null;
  created_at: string;
  is_flagged_for_issue: boolean;
  reason_for_flag: string | null;
}

export interface RenderError {
  id: string; // uuid
  user_id: string;
  job_id: string | null; // dedicated column for easier querying
  error_type: string;
  error_source: "client" | "server" | "lambda"; // where the error originated
  stage: string | null; // generation stage when error occurred
  error_message: string; // message shown to user
  error_title: string | null; // title shown to user (if any)
  debug_message: string;
  error_stack: string | null; // stack trace
  browser_info: string | null; // user agent
  props_snapshot: Record<string, unknown> | null; // composition props at failure
  audio_progress: number | null; // 0-100
  audio_generated: number | null;
  audio_total: number | null;
  background_upload_progress: number | null; // 0-100
  eleven_labs_key_prefix: string | null; // first 8 chars of API key for debugging
  voice_ids_used: string[] | null;
  monetization_enabled: boolean | null;
  custom_background_used: boolean | null;
  message_count: number | null;
  context: Record<string, unknown>; // catch-all for other data
  created_at: string;
}