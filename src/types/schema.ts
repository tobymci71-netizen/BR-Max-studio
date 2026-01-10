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

export type RenderStatus = "queued" | "processing" | "done" | "failed" | "cancelled";

export interface RenderJob {
  id: string; // uuid
  user_id: string;
  job_id: string;
  status: RenderStatus; // enum
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
  error_type: string;
  user_message: string;
  debug_message: string;
  context: Record<string, unknown>;
  created_at: string;
}