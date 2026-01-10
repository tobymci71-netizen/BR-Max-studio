import React from "react";
import { Button } from "../../components/Button";
import { Upload, Music, Link2, Play, Pause, Volume2 } from "lucide-react";
import { Row } from "../../components/Row";
import { Modal } from "../../components/Modal";
import { defaultMyCompProps } from "../../types/constants";
import TrimTimeline from "../../components/TrimTimeline";

type CompProps = typeof defaultMyCompProps;

interface ImportBackendMusicProps {
  setFormValues: React.Dispatch<React.SetStateAction<CompProps>>;
  setSelectedAudio: (f: File | null) => void;
  selectedAudio: File | null;
}

const isValidHttpUrl = (val: string) => {
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const DEFAULT_VOLUME = 0.6; // 60%

const ImportBackendMusic = ({
  setFormValues,
  setSelectedAudio,
  selectedAudio,
}: ImportBackendMusicProps) => {
  const [open, setOpen] = React.useState(false);
  const [audioUrl, setAudioUrl] = React.useState("");
  const [urlError, setUrlError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<"file" | "url">("file");

  // preview + volume + duration/clip
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [previewSrc, setPreviewSrc] = React.useState<string | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [volume, setVolume] = React.useState<number>(DEFAULT_VOLUME); // 0..1
  const [durationSec, setDurationSec] = React.useState<number | null>(null);
  const [clip, setClip] = React.useState<{ start: number; end: number } | null>(null);

  // Clean up object URLs when they change
  const objectUrlRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  const applyPreviewSrc = (src: string, isObjectUrl: boolean) => {
    // Stop playback when switching
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // Revoke previous blob URL if needed
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (isObjectUrl) {
      objectUrlRef.current = src;
    }
    setPreviewSrc(src);
    setIsPlaying(false);
    setDurationSec(null);
    setClip(null); // re-init after metadata
  };

  const onPickFile = (file: File) => {
    setSelectedAudio(file);
    const url = URL.createObjectURL(file);
    applyPreviewSrc(url, true);
    // Persist basic fields; clip will be saved on "Save"
    setFormValues((p) => ({
      ...p,
      backgroundAudioUrl: url,
      backgroundAudioName: file.name,
      backgroundAudioSource: "file",
      backgroundMusicVolume: volume,
    }));
  };

  const onApplyUrl = () => {
    const trimmed = audioUrl.trim();
    const ok = isValidHttpUrl(trimmed);
    setUrlError(ok ? null : "Please enter a valid http(s) URL.");
    if (!ok) return;

    setSelectedAudio(null);
    applyPreviewSrc(trimmed, false);

    setFormValues((p) => ({
      ...p,
      backgroundAudioUrl: trimmed,
      backgroundAudioName: undefined,
      backgroundAudioSource: "url",
      backgroundMusicVolume: volume,
    }));
    // keep modal open so user can trim
  };

  // When metadata loads, initialize duration and default clip
  const onLoadedMetadata = () => {
    const el = audioRef.current;
    if (!el || !Number.isFinite(el.duration)) return;
    const d = Math.max(0, el.duration || 0);
    setDurationSec(d);
    // init clip only if not already set
    setClip((prev) => prev ?? { start: 0, end: d });
  };

  // Keep the HTMLAudioElement volume in sync with slider and persist to form
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setFormValues((p) => ({
      ...p,
      backgroundMusicVolume: volume,
    }));
  }, [volume, setFormValues]);

  // Loop playback within selected clip
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el || !clip) return;
    const onTimeUpdate = () => {
      if (el.currentTime > clip.end) {
        el.currentTime = clip.start;
        if (!el.paused) el.play().catch(() => {});
      }
    };
    el.addEventListener("timeupdate", onTimeUpdate);
    return () => el.removeEventListener("timeupdate", onTimeUpdate);
  }, [clip?.start, clip?.end]);

  const togglePlayback = async () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (e) {
        console.warn("Audio play failed:", e);
      }
    }
  };

  const handleSave = () => {
    if (!previewSrc || !clip) return;
    // Persist trim into form
    setFormValues((p) => ({
      ...p,
      backgroundClipStart: clip.start,
      backgroundClipEnd: clip.end,
      backgroundMusicVolume: volume,
    }));
    setOpen(false);
  };

  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const interval = setInterval(() => setTick((n) => n + 1), 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        <Music size={16} /> Add background music
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add background music (MP3/WAV/M4A/OGG)"
      >
        <div style={{ display: "grid", gap: 18, fontSize: 14, color: "white" }}>
          {/* Tips */}
          <div
            style={{
              background: "rgba(255,255,255,0.04)",
              padding: "14px 16px",
              borderRadius: 10,
              lineHeight: 1.6,
            }}
          >
            <p style={{ margin: 0, opacity: 0.85 }}>
              🎵 <b>Recommended:</b> high-quality, non-copyright-restricted audio.
            </p>
            <p style={{ marginTop: 4, opacity: 0.7 }}>
              Upload a local audio file or paste a direct audio URL.
            </p>
          </div>

          {/* Mode toggle */}
          <div
            style={{
              display: "flex",
              gap: 8,
              background: "rgba(255,255,255,0.03)",
              padding: 6,
              borderRadius: 10,
            }}
          >
            <Button
              variant={mode === "file" ? "primary" : "ghost"}
              onClick={() => setMode("file")}
            >
              <Upload size={16} /> Upload file
            </Button>
            <Button
              variant={mode === "url" ? "primary" : "ghost"}
              onClick={() => setMode("url")}
            >
              <Link2 size={16} /> Use URL
            </Button>
          </div>

          {/* File mode */}
          {mode === "file" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "28px 0",
                border: "1px dashed rgba(255,255,255,0.15)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <Upload size={36} style={{ opacity: 0.7, marginBottom: 8 }} />
              <span style={{ fontSize: 14, opacity: 0.85 }}>
                Drag & drop your audio here
              </span>
              <span style={{ fontSize: 12, opacity: 0.6 }}>
                (mp3, wav, m4a, ogg)
              </span>

              <label
                htmlFor="audioUpload"
                style={{
                  marginTop: 14,
                  cursor: "pointer",
                  background:
                    "linear-gradient(90deg, rgba(0,122,255,0.8), rgba(88,86,214,0.8))",
                  padding: "8px 16px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Choose Audio
              </label>

              <input
                id="audioUpload"
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.ogg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 100 * 1024 * 1024) {
                    alert("Please choose an audio file under 100 MB.");
                    return;
                  }
                  onPickFile(file);
                }}
                style={{ display: "none" }}
              />

              {selectedAudio ? (
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 13,
                    opacity: 0.85,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255,255,255,0.06)",
                    padding: "6px 12px",
                    borderRadius: 8,
                    maxWidth: "90%",
                    wordBreak: "break-all",
                  }}
                >
                  <Music size={16} style={{ opacity: 0.7 }} />
                  <span>Selected: {selectedAudio.name}</span>
                </div>
              ) : null}
            </div>
          )}

          {/* URL mode */}
          {mode === "url" && (
            <div
              style={{
                display: "grid",
                gap: 10,
                background: "rgba(255,255,255,0.03)",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <label htmlFor="audioUrl" style={{ opacity: 0.8 }}>
                Paste a direct audio URL (http/https)
              </label>
              <input
                id="audioUrl"
                value={audioUrl}
                onChange={(e) => {
                  setAudioUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="https://example.com/music.mp3"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.02)",
                  color: "white",
                  outline: "none",
                }}
              />
              {urlError && (
                <div
                  style={{
                    color: "#ff7b7b",
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {urlError}
                </div>
              )}
              <div style={{ fontSize: 12, opacity: 0.65, lineHeight: 1.5 }}>
                Tip: Link should point directly to an audio file (e.g., ends with
                .mp3, .wav, .m4a, .ogg) and be publicly accessible.
              </div>
              <Row style={{ justifyContent: "flex-end" }}>
                <Button onClick={onApplyUrl}>
                  <Link2 size={16} /> Load URL
                </Button>
              </Row>
            </div>
          )}

          {/* Live Preview + Volume */}
          <div
            style={{
              display: "grid",
              gap: 10,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Button
                  variant="ghost"
                  onClick={togglePlayback}
                  disabled={!previewSrc}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </Button>
                <span style={{ opacity: previewSrc ? 0.85 : 0.45 }}>
                  {previewSrc ? "Preview ready" : "No audio selected"}
                </span>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 220,
                }}
              >
                <Volume2 size={16} style={{ opacity: 0.8 }} />
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(volume * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setVolume(v);
                  }}
                  style={{ width: 160, cursor: "pointer" }}
                />
                <span style={{ width: 34, textAlign: "right", opacity: 0.8 }}>
                  {Math.round(volume * 100)}%
                </span>
              </div>
            </div>

            {/* Hidden actual <audio> element */}
            <audio
              ref={audioRef}
              src={previewSrc ?? undefined}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              onLoadedMetadata={onLoadedMetadata}
              preload="metadata"
            />
          </div>

          {/* Timeline */}
          <TrimTimeline
            label="Audio"
            durationSec={durationSec}
            currentTime={audioRef.current?.currentTime ?? 0}
            value={clip}
            onChange={(v) => setClip(v)}
            onCommit={(v) => setClip(v)}
          />

          {/* Footer */}
          <Row style={{ justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!previewSrc || !clip || !durationSec}
              title={!previewSrc ? "Select audio first" : undefined}
            >
              Save
            </Button>
          </Row>
        </div>
      </Modal>
    </>
  );
};

export default ImportBackendMusic;
