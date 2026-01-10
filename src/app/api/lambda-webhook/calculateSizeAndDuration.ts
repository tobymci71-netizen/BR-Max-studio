import * as MP4Box from "mp4box";

/**
 * MP4Box extends ArrayBuffer with a "fileStart" property.
 * We define a strict interface for that.
 */
interface MP4ArrayBuffer extends ArrayBuffer {
  fileStart: number;
}

/** MP4Box track metadata */
interface MP4Track {
  track_width?: number;
  track_height?: number;
}

/** MP4Box metadata returned in onReady */
interface MP4Metadata {
  duration: number;
  timescale: number;
  videoTracks?: MP4Track[];
}

/** Final return type */
export interface VideoMetadata {
  duration: number;
  durationFormatted: string;
  size: number;
  sizeFormatted: string;
  width: number;
  height: number;
  bitrate: number;
}

/**
 * Retrieve MP4 metadata using partial range requests.
 * Fully strict TypeScript — no "any".
 */
export async function getVideoMetadata(url: string): Promise<VideoMetadata> {
  try {
    // 1. Fetch file size
    const head = await fetch(url, { method: "HEAD" });
    const totalSize = parseInt(head.headers.get("content-length") || "0", 10);

    // 2. Fetch first 2MB for moov atom
    const res = await fetch(url, {
      headers: { Range: "bytes=0-2097151" },
    });

    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }

    // Convert ArrayBuffer → MP4ArrayBuffer
    const buf = (await res.arrayBuffer()) as MP4ArrayBuffer;
    buf.fileStart = 0;

    // 3. Parse with MP4Box
    const metadata = await new Promise<MP4Metadata>((resolve, reject) => {
      const mp4 = MP4Box.createFile();
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved)
          reject(new Error("Timeout: moov atom not found within 2MB"));
      }, 10_000);

      mp4.onError = (msg: string) => {
        clearTimeout(timeout);
        if (!resolved) reject(new Error(`MP4Box error: ${msg}`));
      };

      mp4.onReady = (info: MP4Metadata) => {
        clearTimeout(timeout);
        resolved = true;
        resolve(info);
      };

      mp4.appendBuffer(buf);
      mp4.flush();
    });

    // 4. Extract clean fields
    const durationSec = metadata.duration / metadata.timescale;
    const width = metadata.videoTracks?.[0]?.track_width ?? 0;
    const height = metadata.videoTracks?.[0]?.track_height ?? 0;

    const bitrate = Math.round((totalSize * 8) / durationSec);

    return {
      duration: Number(durationSec.toFixed(2)),
      durationFormatted: formatDuration(durationSec),
      size: totalSize,
      sizeFormatted: formatBytes(totalSize),
      width,
      height,
      bitrate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to extract MP4 metadata: ${message}`);
  }
}
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = (bytes / Math.pow(1024, i)).toFixed(2);
  return `${val} ${units[i]}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
