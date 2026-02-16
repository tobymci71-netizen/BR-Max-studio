"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, Video, Play, Pause, Search, X } from "lucide-react";
import { Modal } from "../Modal";
import { generateAudioFile } from "@/helpers/audioGeneration";
import { DEFAULT_VOICE_SETTINGS } from "@/types/constants";
import { removeSilenceFromMp3 } from "@/helpers/removeSilenceMp3";

export type AudioReviewItem = {
  id: string;
  index: number;
  text: string;
  url: string;
  audioType: string;
};

type AudioReviewModalProps = {
  jobId: string | null;
  onClose: () => void;
};

export function AudioReviewModal({ jobId, onClose }: AudioReviewModalProps) {
  const open = jobId != null;

  const [items, setItems] = useState<AudioReviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [autoPlay, setAutoPlay] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [isReplaceDropActive, setIsReplaceDropActive] = useState(false);
  const [editText, setEditText] = useState("");
  const [speed, setSpeed] = useState(DEFAULT_VOICE_SETTINGS.speed);
  const [stability, setStability] = useState(DEFAULT_VOICE_SETTINGS.stability);
  const [similarity, setSimilarity] = useState(
    DEFAULT_VOICE_SETTINGS.similarity_boost,
  );
  const [style, setStyle] = useState(DEFAULT_VOICE_SETTINGS.style);
  const [speakerBoost, setSpeakerBoost] = useState(
    DEFAULT_VOICE_SETTINGS.use_speaker_boost,
  );
  const [apiKey, setApiKey] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [voiceStyle, setVoiceStyle] = useState<"natural" | "snappy">("natural");
  const [silenceTrimmingType, setSilenceTrimmingType] = useState<
    "full_audio" | "start_and_end"
  >("full_audio");
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [updateMessageText, setUpdateMessageText] = useState(false);
  const [startingVideo, setStartingVideo] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Cache-bust playback after replace/regenerate so the new file is loaded (same URL, new content)
  const [urlVersion, setUrlVersion] = useState<Record<string, number>>({});

  // Load saved ElevenLabs settings from studio localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem("studio-settings");
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed.elevenLabsApiKey) {
        setApiKey(parsed.elevenLabsApiKey);
      }
      if (Array.isArray(parsed.voices) && parsed.voices.length > 0) {
        const voiceWithId = parsed.voices.find((v: { voiceId?: string }) => v.voiceId);
        if (voiceWithId?.voiceId) {
          setVoiceId(voiceWithId.voiceId);
        }
      }
    } catch (error) {
      console.error("Failed to load saved ElevenLabs settings:", error);
    }
  }, [open]);

  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio list when modal opens with a job
  useEffect(() => {
    if (!open || !jobId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setPlayingId(null);
    setEditText("");

    fetch(`/api/render/audio-list?jobId=${jobId}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.items) ? (data.items as AudioReviewItem[]) : [];
        setItems(list);
        if (list.length > 0) {
          const firstId = list[0].id;
          setSelectedId(firstId);
          setPlayingId(firstId);
          setEditText(list[0].text ?? "");
        }
        // Apply job composition voice settings (used at generation time) as defaults
        const vs = data.voiceSettings;
        if (vs && typeof vs === "object") {
          if (typeof vs.speed === "number") setSpeed(vs.speed);
          if (typeof vs.stability === "number") setStability(vs.stability);
          if (typeof vs.similarity_boost === "number")
            setSimilarity(vs.similarity_boost);
          if (typeof vs.style === "number") setStyle(vs.style);
          if (typeof vs.use_speaker_boost === "boolean")
            setSpeakerBoost(vs.use_speaker_boost);
        }
        if (typeof data.enableSilenceTrimming === "boolean") {
          setVoiceStyle(data.enableSilenceTrimming ? "snappy" : "natural");
        }
        if (
          data.silenceTrimmingType === "full_audio" ||
          data.silenceTrimmingType === "start_and_end"
        ) {
          setSilenceTrimmingType(data.silenceTrimmingType);
        }
        if (typeof data.voiceId === "string" && data.voiceId.trim()) {
          setVoiceId(data.voiceId.trim());
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading audio list:", err);
        setItems([]);
        setError(err instanceof Error ? err.message : "Failed to load audio list");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, jobId]);

  const handleClose = () => {
    setItems([]);
    setSelectedId(null);
    setPlayingId(null);
    setError(null);
    setAutoPlay(false);
    setEditText("");
    setApiKey("");
    setVoiceId("");
    setVoiceStyle("natural");
    setSpeed(DEFAULT_VOICE_SETTINGS.speed);
    setStability(DEFAULT_VOICE_SETTINGS.stability);
    setSimilarity(DEFAULT_VOICE_SETTINGS.similarity_boost);
    setStyle(DEFAULT_VOICE_SETTINGS.style);
    setSpeakerBoost(DEFAULT_VOICE_SETTINGS.use_speaker_boost);
    setRegenerating(false);
    setReplacingId(null);
    setShowRegenerateOptions(false);
    setUpdateMessageText(false);
    setStartingVideo(false);
    setSearchQuery("");
    setUrlVersion({});
    onClose();
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (!autoPlay || !playingId) return;
    const idx = items.findIndex((i) => i.id === playingId);
    if (idx === -1) return;
    const next = items[idx + 1];
    if (next) setPlayingId(next.id);
  };

  const effectivePlayingId = autoPlay ? playingId : selectedId;
  useEffect(() => {
    if (!effectivePlayingId || !audioRef.current) return;
    audioRef.current.play().catch(() => {});
  }, [effectivePlayingId, autoPlay]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, [effectivePlayingId]);

  const handleRegenerateAudio = async () => {
    if (
      !selectedId ||
      !jobId ||
      !editText.trim() ||
      !apiKey.trim() ||
      !voiceId.trim()
    ) {
      setError("Text, ElevenLabs API key, and voice ID are required to regenerate.");
      return;
    }

    try {
      setRegenerating(true);
      setError(null);

      const { base64Data, duration } = await generateAudioFile({
        text: editText,
        voiceId: voiceId.trim(),
        apiKey: apiKey.trim(),
        enableSilenceTrimming: voiceStyle === "snappy",
        silenceTrimmingType,
        voiceSettings: {
          speed,
          stability,
          similarity_boost: similarity,
          style,
          use_speaker_boost: speakerBoost,
        },
      });

      const res = await fetch("/api/render/replace-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          audioId: selectedId,
          base64Data,
          mimeType: "audio/mpeg",
          ...(updateMessageText && { updatedText: editText }),
          duration,
          audioType: "re-generated",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to replace audio");

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                ...(updateMessageText && { text: editText }),
                audioType: "re-generated",
              }
            : item,
        ),
      );
      setUrlVersion((prev) => ({ ...prev, [selectedId]: Date.now() }));

      if (audioRef.current) audioRef.current.load();
    } catch (err) {
      console.error("Error regenerating audio:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate audio");
    } finally {
      setRegenerating(false);
    }
  };

  const getAudioDurationFromFile = (f: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const a = new Audio();
      a.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        const d = a.duration;
        resolve(Number.isFinite(d) && d > 0 ? d : 0);
      };
      a.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load audio"));
      };
      a.src = url;
    });
  };

  const handleReplaceAudio = async (file: File | null) => {
    if (!file || !selectedId || !jobId) return;

    try {
      setReplacingId(selectedId);
      setError(null);

      let base64: string;
      let duration: number | undefined;

      // When Silence Remover / "Snappy" mode is enabled, trim silence from
      // manually uploaded audio before sending it to the server / S3.
      if (voiceStyle === "snappy") {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const trimmed = await removeSilenceFromMp3(bytes, {
            thresholdDb: DEFAULT_VOICE_SETTINGS.silenceThresholdDb,
            minSilenceMs: DEFAULT_VOICE_SETTINGS.silenceMinSilenceMs,
            trimMode: silenceTrimmingType,
          });
          base64 = trimmed.base64Data;
          duration = trimmed.duration;
        } catch (trimErr) {
          console.error("Silence trimming failed, falling back to raw upload:", trimErr);
          // Fallback to raw file if trimming fails for any reason
          const rawBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error);
            reader.onload = () => {
              const result = reader.result;
              if (typeof result === "string") {
                const i = result.indexOf(",");
                resolve(i >= 0 ? result.slice(i + 1) : result);
              } else reject(new Error("Unexpected file reader result"));
            };
            reader.readAsDataURL(file);
          });
          base64 = rawBase64;
          try {
            duration = await getAudioDurationFromFile(file);
          } catch {
            duration = undefined;
          }
        }
      } else {
        // Natural mode: keep the audio as-is (no trimming), but still compute duration
        base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === "string") {
              const i = result.indexOf(",");
              resolve(i >= 0 ? result.slice(i + 1) : result);
            } else reject(new Error("Unexpected file reader result"));
          };
          reader.readAsDataURL(file);
        });

        try {
          duration = await getAudioDurationFromFile(file);
        } catch {
          duration = undefined;
        }
      }

      const res = await fetch("/api/render/replace-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          audioId: selectedId,
          base64Data: base64,
          mimeType: file.type || "audio/mpeg",
          audioType: "replaced",
          ...(typeof duration === "number" && duration > 0 && { duration }),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to replace audio");

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? { ...item, audioType: "replaced" }
            : item,
        ),
      );
      setUrlVersion((prev) => ({ ...prev, [selectedId]: Date.now() }));

      if (audioRef.current) audioRef.current.load();
    } catch (err) {
      console.error("Error replacing audio:", err);
      setError(err instanceof Error ? err.message : "Failed to replace audio");
    } finally {
      setReplacingId(null);
    }
  };

  const handleStartVideoRendering = async () => {
    if (!jobId) return;

    try {
      setStartingVideo(true);
      setError(null);

      const res = await fetch("/api/render/start-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Failed to start video rendering");

      handleClose();
    } catch (err) {
      console.error("Error starting video rendering:", err);
      setError(err instanceof Error ? err.message : "Failed to start video rendering");
    } finally {
      setStartingVideo(false);
    }
  };

  // Filter items based on search query
  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.text?.toLowerCase().includes(query) ||
      `#${item.index + 1}`.includes(query)
    );
  });

  return (
    <Modal open={open} onClose={handleClose} title="Review Audio Clips" width={1200}>
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
          <p className="text-sm text-gray-400">Loading audio clips...</p>
        </div>
      )}

      {!loading && (
        <div className="flex gap-6 h-[calc(100vh-200px)] min-h-[600px]">
          {/* Left Panel - Audio List */}
          <div className="w-80 flex flex-col border-r border-white/10">
            {/* Search Bar */}
            <div className="p-4 border-b border-white/10">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search clips..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                <span>{filteredItems.length} of {items.length} clips</span>
                <label className="flex items-center gap-2 cursor-pointer text-gray-400">
                  <input
                    type="checkbox"
                    checked={autoPlay}
                    onChange={(e) => setAutoPlay(e.target.checked)}
                    className="w-4 h-4 text-blue-500 border-white/20 rounded focus:ring-2 focus:ring-blue-500/50 bg-white/5"
                  />
                  <span>Auto-play</span>
                </label>
              </div>
            </div>

            {/* Clip List */}
            <div className="flex-1 overflow-y-auto">
              {error && (
                <div className="m-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                  {error}
                </div>
              )}

              {filteredItems.length === 0 && !error && (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-3">
                    <Search className="w-6 h-6 text-gray-500" />
                  </div>
                  <p className="text-sm text-gray-400">
                    {searchQuery ? "No clips found" : "No audio clips available"}
                  </p>
                </div>
              )}

              <div className="p-2">
                {filteredItems.map((item) => {
                  const isSelected = item.id === selectedId;
                  const isCurrentlyPlaying = item.id === playingId;
                  const preview =
                    item.text && item.text.length > 60
                      ? `${item.text.slice(0, 60)}...`
                      : item.text || "(No text)";

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setPlayingId(item.id);
                        setEditText(item.text ?? "");
                        setShowRegenerateOptions(false);
                      }}
                      className={`w-full text-left p-3 mb-1 rounded-lg transition-colors border ${
                        isSelected
                          ? "bg-blue-500/20 border-blue-500/40"
                          : "border-transparent hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-semibold ${
                          isSelected ? "bg-blue-500 text-white" : "bg-white/15 text-gray-300"
                        }`}>
                          {isCurrentlyPlaying ? (
                            <Play className="w-4 h-4" />
                          ) : (
                            `${item.index + 1}`
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-200 line-clamp-2 mb-1">
                            {preview}
                          </p>
                          <span
                            className={`inline-block px-2 py-0.5 text-xs rounded ${
                              item.audioType === "re-generated"
                                ? "bg-purple-500/20 text-purple-300"
                                : item.audioType === "replaced"
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-emerald-500/20 text-emerald-300"
                            }`}
                          >
                            {item.audioType === "re-generated"
                              ? "Regenerated"
                              : item.audioType === "replaced"
                                ? "Replaced"
                                : "Original"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Panel - Details */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedId && items.length > 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-gray-500" />
                  </div>
                  <p className="text-gray-400">Select a clip to preview and edit</p>
                </div>
              </div>
            ) : selectedId && (() => {
              const selectedItem = items.find((i) => i.id === selectedId) || items[0];
              const playingItem = effectivePlayingId ? items.find((i) => i.id === effectivePlayingId) : null;
              const item = playingItem || selectedItem;
              const baseUrl = item?.url;
              const audioSrc = baseUrl
                ? `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}v=${urlVersion[item.id] ?? 0}`
                : undefined;
              if (!selectedItem) return null;

              return (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Audio Player */}
                  <div className="p-6 border-b border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-white">
                        Clip #{selectedItem.index + 1}
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => audioRef.current?.paused ? audioRef.current?.play() : audioRef.current?.pause()}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                        >
                          {isPlaying ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <audio
                      ref={audioRef}
                      controls
                      src={audioSrc}
                      key={effectivePlayingId ?? "none"}
                      className="w-full"
                      onEnded={handleAudioEnded}
                    />
                  </div>

                  {/* Content Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Text Editor */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Audio Text
                      </label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 bg-white/5 border border-white/15 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 resize-none"
                        placeholder="Enter the text for this audio clip..."
                      />
                    </div>

                    {/* Regenerate Section */}
                    {!showRegenerateOptions ? (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/25 rounded-lg">
                        <h4 className="text-sm font-semibold text-white mb-2">
                          Regenerate Audio
                        </h4>
                        <p className="text-sm text-gray-400 mb-3">
                          Customize voice settings and regenerate this clip with ElevenLabs
                        </p>
                        <button
                          onClick={() => setShowRegenerateOptions(true)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 transition-colors"
                        >
                          Show Settings
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4 p-4 border border-white/10 rounded-lg bg-white/5">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-white">
                            Voice Settings
                          </h4>
                          <button
                            onClick={() => setShowRegenerateOptions(false)}
                            className="text-sm text-gray-400 hover:text-white"
                          >
                            Hide
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="flex items-center justify-between text-xs font-medium text-gray-400 mb-2">
                              <span>Speed</span>
                              <span className="text-blue-400">{speed.toFixed(2)}x</span>
                            </label>
                            <input
                              type="range"
                              min={0.7}
                              max={1.2}
                              step={0.05}
                              value={speed}
                              onChange={(e) => setSpeed(parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>

                          <div>
                            <label className="flex items-center justify-between text-xs font-medium text-gray-400 mb-2">
                              <span>Stability</span>
                              <span className="text-blue-400">{stability.toFixed(2)}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={stability}
                              onChange={(e) => setStability(parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>

                          <div>
                            <label className="flex items-center justify-between text-xs font-medium text-gray-400 mb-2">
                              <span>Similarity</span>
                              <span className="text-blue-400">{similarity.toFixed(2)}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={similarity}
                              onChange={(e) => setSimilarity(parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>

                          <div>
                            <label className="flex items-center justify-between text-xs font-medium text-gray-400 mb-2">
                              <span>Style</span>
                              <span className="text-blue-400">{style.toFixed(2)}</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={style}
                              onChange={(e) => setStyle(parseFloat(e.target.value))}
                              className="w-full accent-blue-500"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer text-gray-400">
                          <input
                            type="checkbox"
                            checked={speakerBoost}
                            onChange={(e) => setSpeakerBoost(e.target.checked)}
                            className="w-4 h-4 text-blue-500 border-white/20 rounded focus:ring-2 focus:ring-blue-500/50 bg-white/5"
                          />
                          <span className="text-sm">Use speaker boost</span>
                        </label>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">
                              API Key
                            </label>
                            <input
                              type="password"
                              value={apiKey}
                              onChange={(e) => setApiKey(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                              placeholder="sk-..."
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">
                              Voice ID
                            </label>
                            <input
                              type="text"
                              value={voiceId}
                              onChange={(e) => setVoiceId(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                              placeholder="voice-id..."
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            Voice Style
                          </label>
                          <select
                            value={voiceStyle}
                            onChange={(e) => setVoiceStyle(e.target.value as "natural" | "snappy")}
                            className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                          >
                            <option value="natural">Natural</option>
                            <option value="snappy">Snappy (trims silence)</option>
                          </select>
                        </div>
                        {voiceStyle === "snappy" && (
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-2">
                              Trim silence
                            </label>
                            <select
                              value={silenceTrimmingType}
                              onChange={(e) =>
                                setSilenceTrimmingType(
                                  e.target.value as "full_audio" | "start_and_end"
                                )
                              }
                              className="w-full px-3 py-2 text-sm bg-white/5 border border-white/15 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                            >
                              <option value="full_audio">Entire audio</option>
                              <option value="start_and_end">Start & end only</option>
                            </select>
                          </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer text-gray-400">
                          <input
                            type="checkbox"
                            checked={updateMessageText}
                            onChange={(e) => setUpdateMessageText(e.target.checked)}
                            className="w-4 h-4 text-blue-500 border-white/20 rounded focus:ring-2 focus:ring-blue-500/50 bg-white/5"
                          />
                          <span className="text-sm">
                            Also update iMessage text to match the new audio content
                          </span>
                        </label>

                        <button
                          onClick={handleRegenerateAudio}
                          disabled={regenerating}
                          className="w-full py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                        >
                          {regenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            "Regenerate Audio"
                          )}
                        </button>
                      </div>
                    )}

                    {/* Replace Audio — drag and drop or click */}
                    <div
                      role="button"
                      tabIndex={0}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (replacingId !== selectedId) setIsReplaceDropActive(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsReplaceDropActive(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsReplaceDropActive(false);
                        if (replacingId === selectedId) return;
                        const file = e.dataTransfer.files?.[0];
                        if (!file) return;
                        const isAudio =
                          file.type.startsWith("audio/") ||
                          /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
                        if (isAudio) handleReplaceAudio(file);
                      }}
                      onClick={() => {
                        if (replacingId !== selectedId)
                          document.getElementById("audio-replace-input")?.click();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (replacingId !== selectedId)
                            document.getElementById("audio-replace-input")?.click();
                        }
                      }}
                      className={`inline-flex items-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed text-sm font-medium cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 ${
                        replacingId === selectedId
                          ? "border-white/10 bg-white/5 text-gray-500 cursor-not-allowed"
                          : isReplaceDropActive
                            ? "border-blue-500/70 bg-blue-500/20 text-white"
                            : "border-white/15 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/25"
                      }`}
                    >
                      {replacingId === selectedId ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          Replacing...
                        </>
                      ) : isReplaceDropActive ? (
                        <>
                          <Upload className="w-4 h-4 shrink-0" />
                          Drop audio file here
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 shrink-0" />
                          Replace with File — or drag and drop
                        </>
                      )}
                      <input
                        id="audio-replace-input"
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        disabled={replacingId === selectedId}
                        onChange={(e) => {
                          handleReplaceAudio(e.target.files?.[0] ?? null);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="p-6 border-t border-white/10 bg-white/5">
                    <button
                      onClick={handleStartVideoRendering}
                      disabled={startingVideo}
                      className="w-full py-3 bg-emerald-600 text-white text-base font-semibold rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {startingVideo ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Starting Video Rendering...
                        </>
                      ) : (
                        <>
                          <Video className="w-5 h-5" />
                          Start Video Rendering
                        </>
                      )}
                    </button>
                    <p className="text-center text-xs text-gray-500 mt-2">
                      Generate the final video with all audio changes
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </Modal>
  );
}