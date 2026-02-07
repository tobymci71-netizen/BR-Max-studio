"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Zap, Upload, Play, Video } from "lucide-react";
import { Modal } from "../Modal";
import { generateAudioFile } from "@/helpers/audioGeneration";
import { DEFAULT_VOICE_SETTINGS } from "@/types/constants";

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
  const [autoPlay, setAutoPlay] = useState(false);
  const [replacingId, setReplacingId] = useState<string | null>(null);
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
  const [regenerating, setRegenerating] = useState(false);
  const [showRegenerateOptions, setShowRegenerateOptions] = useState(false);
  const [startingVideo, setStartingVideo] = useState(false);

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
        // Use the first voice with a voiceId
        const voiceWithId = parsed.voices.find((v: { voiceId?: string }) => v.voiceId);
        if (voiceWithId?.voiceId) {
          setVoiceId(voiceWithId.voiceId);
        }
      }
    } catch (error) {
      console.error("Failed to load saved ElevenLabs settings:", error);
    }
  }, [open]);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load audio list when modal opens with a job
  useEffect(() => {
    if (!open || !jobId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedId(null);
    setEditText("");

    fetch(`/api/render/audio-list?jobId=${jobId}`)
      .then((res) => res.json().catch(() => ({})))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data.items) ? (data.items as AudioReviewItem[]) : [];
        setItems(list);
        if (list.length > 0) {
          setSelectedId(list[0].id);
          setEditText(list[0].text ?? "");
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
    setStartingVideo(false);
    onClose();
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    if (!autoPlay || !selectedId) return;
    const idx = items.findIndex((i) => i.id === selectedId);
    if (idx === -1) return;
    const next = items[idx + 1];
    if (next) setSelectedId(next.id);
  };

  useEffect(() => {
    if (!autoPlay || !selectedId || !audioRef.current) return;
    audioRef.current.play().catch(() => {});
  }, [selectedId, autoPlay]);

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
  }, [selectedId]);

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
          updatedText: editText,
          duration,
          audioType: "re-generated",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to replace audio");

      setItems((prev) =>
        prev.map((item) =>
          item.id === selectedId
            ? { ...item, text: editText, audioType: "re-generated" }
            : item,
        ),
      );

      if (audioRef.current) audioRef.current.load();
    } catch (err) {
      console.error("Error regenerating audio:", err);
      setError(err instanceof Error ? err.message : "Failed to regenerate audio");
    } finally {
      setRegenerating(false);
    }
  };

  const handleReplaceAudio = async (file: File | null) => {
    if (!file || !selectedId || !jobId) return;

    try {
      setReplacingId(selectedId);
      setError(null);

      const base64 = await new Promise<string>((resolve, reject) => {
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

      const res = await fetch("/api/render/replace-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          audioId: selectedId,
          base64Data: base64,
          mimeType: file.type || "audio/mpeg",
          audioType: "replaced",
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

      // Close the modal after successfully starting video rendering
      handleClose();
    } catch (err) {
      console.error("Error starting video rendering:", err);
      setError(err instanceof Error ? err.message : "Failed to start video rendering");
    } finally {
      setStartingVideo(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Review Audio" width={900}>
      <style jsx>{`
        @keyframes waveform {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        @keyframes pulse-ring {
          0% {
            transform: scale(0.95);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.05);
            opacity: 0.3;
          }
          100% {
            transform: scale(0.95);
            opacity: 0.7;
          }
        }
        @keyframes shimmer {
          0% {
            background-position: -1000px 0;
          }
          100% {
            background-position: 1000px 0;
          }
        }
        .waveform-bar {
          animation: waveform 1.2s ease-in-out infinite;
        }
        .shimmer {
          background: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>

      {/* Full-width loading: one big section */}
      {loading && (
        <div className="flex flex-col items-center justify-center min-h-[50vh] py-12 px-6 text-sm text-white">
          <div className="flex items-end justify-center gap-2 h-20 mb-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div
                key={i}
                className="w-2.5 bg-gradient-to-t from-violet-500 to-purple-400 rounded-full waveform-bar"
                style={{ animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
          <p className="text-violet-200/90 font-medium">Loading audio clips...</p>
          <p className="text-gray-400 text-xs mt-1">Preparing your clips for review</p>
        </div>
      )}

      {!loading && (
      <>
      <div className="flex flex-col lg:flex-row gap-6 text-sm text-white">
        {/* Left: list of clips */}
        <div className="lg:w-2/5 w-full flex flex-col gap-4 max-h-[70vh] overflow-hidden">
          {items.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20 backdrop-blur-sm shrink-0">
              <input
                id="audio-autoplay-left"
                type="checkbox"
                checked={autoPlay}
                onChange={(e) => setAutoPlay(e.target.checked)}
                className="h-4 w-4 rounded border-violet-400/50 bg-gray-900/80 text-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-0 cursor-pointer transition-all"
              />
              <label htmlFor="audio-autoplay-left" className="cursor-pointer text-sm font-medium text-violet-200 select-none">
                Auto-play next clip
              </label>
            </div>
          )}
          
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-violet-500/30 scrollbar-track-transparent">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 backdrop-blur-sm">
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            )}
            
            {!loading && !error && items.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center mb-4">
                  <Play className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-400 text-sm">
                  No audio clips found for this job.
                </p>
              </div>
            )}
            
            {items.map((item) => {
              const isSelected = item.id === selectedId;
              const preview =
                item.text && item.text.length > 50
                  ? `${item.text.slice(0, 50)}...`
                  : item.text || "(No text)";
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setEditText(item.text ?? "");
                    setShowRegenerateOptions(false);
                  }}
                  className={`group w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 ${
                    isSelected
                      ? "border-violet-500/60 bg-gradient-to-br from-violet-500/20 to-purple-500/20 shadow-lg shadow-violet-500/20 scale-[1.02]"
                      : "border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 hover:border-gray-600/50 hover:scale-[1.01]"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-colors ${
                      isSelected
                        ? "bg-violet-500/30 text-violet-200"
                        : "bg-gray-700/50 text-gray-400 group-hover:bg-gray-700/70"
                    }`}>
                      #{item.index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm line-clamp-2 transition-colors ${
                        isSelected ? "text-white font-medium" : "text-gray-300 group-hover:text-gray-200"
                      }`}>
                        {preview}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            item.audioType === "re-generated"
                              ? "bg-violet-500/20 text-violet-300 border-violet-500/40"
                              : item.audioType === "replaced"
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          }`}
                        >
                          {item.audioType === "re-generated"
                            ? "Re-generated"
                            : item.audioType === "replaced"
                              ? "Replaced"
                              : "Original"}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: selected clip details */}
        <div className="lg:w-3/5 w-full space-y-4">
          {!selectedId && items.length > 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-xl border border-gray-700/50 bg-gray-800/20">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center mb-4 border border-violet-500/30">
                <Play className="w-10 h-10 text-violet-400" />
              </div>
              <p className="text-gray-300 text-sm">
                Select an audio clip to preview and edit
              </p>
            </div>
          )}
          
          {selectedId && (() => {
            const item = items.find((i) => i.id === selectedId) || items[0];
            if (!item) return null;
            
            return (
              <div className="space-y-4">
                {!showRegenerateOptions ? (
                  <div className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 to-purple-500/10 p-6 backdrop-blur-sm">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-white mb-2">
                          Regenerate with Custom Settings
                        </h3>
                        <p className="text-sm text-gray-300 mb-4">
                          Fine-tune the voice parameters and regenerate this audio clip with ElevenLabs
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowRegenerateOptions(true)}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:from-violet-500 hover:to-purple-500 transition-all duration-200 transform hover:scale-105"
                        >
                          <Zap className="w-4 h-4" />
                          Show Settings
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border border-gray-700/50 bg-gradient-to-br from-gray-800/50 to-gray-900/50 p-6 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-base font-semibold text-white">Regeneration Settings</h3>
                      <button
                        type="button"
                        onClick={() => setShowRegenerateOptions(false)}
                        className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                      >
                        Hide settings
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        Audio Content
                      </label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-600/50 bg-gray-900/60 text-sm text-gray-100 resize-vertical focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                        placeholder="Enter the text to generate audio from..."
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="flex items-center justify-between text-xs font-medium text-gray-400">
                          <span>Speed</span>
                          <span className="text-violet-400 font-semibold">{speed.toFixed(2)}x</span>
                        </label>
                        <input
                          type="range"
                          min={0.7}
                          max={1.5}
                          step={0.05}
                          value={speed}
                          onChange={(e) => setSpeed(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center justify-between text-xs font-medium text-gray-400">
                          <span>Stability</span>
                          <span className="text-violet-400 font-semibold">{stability.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={stability}
                          onChange={(e) => setStability(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center justify-between text-xs font-medium text-gray-400">
                          <span>Similarity</span>
                          <span className="text-violet-400 font-semibold">{similarity.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={similarity}
                          onChange={(e) => setSimilarity(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="flex items-center justify-between text-xs font-medium text-gray-400">
                          <span>Style</span>
                          <span className="text-violet-400 font-semibold">{style.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={style}
                          onChange={(e) => setStyle(parseFloat(e.target.value))}
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-900/60 border border-gray-700/50">
                      <input
                        id="audio-speaker-boost"
                        type="checkbox"
                        checked={speakerBoost}
                        onChange={(e) => setSpeakerBoost(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-2 focus:ring-violet-500/50 cursor-pointer"
                      />
                      <label htmlFor="audio-speaker-boost" className="text-sm text-gray-300 cursor-pointer select-none">
                        Use speaker boost
                      </label>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-400">
                          ElevenLabs API Key
                        </label>
                        <input
                          type="password"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-600/50 bg-gray-900/60 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                          placeholder="sk-..."
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-400">
                          Voice ID
                        </label>
                        <input
                          type="text"
                          value={voiceId}
                          onChange={(e) => setVoiceId(e.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-600/50 bg-gray-900/60 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                          placeholder="voice-id..."
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-400">
                        Voice Style
                      </label>
                      <select
                        value={voiceStyle}
                        onChange={(e) => setVoiceStyle(e.target.value as "natural" | "snappy")}
                        className="w-full px-3 py-2.5 rounded-lg border border-gray-600/50 bg-gray-900/60 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all cursor-pointer"
                      >
                        <option value="natural">Natural</option>
                        <option value="snappy">Snappy (trims silence)</option>
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleRegenerateAudio}
                      disabled={regenerating}
                      className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:from-violet-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] disabled:transform-none"
                    >
                      {regenerating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Regenerating Audio...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5" />
                          Regenerate & Replace
                        </>
                      )}
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3">
                  <label
                    htmlFor="audio-replace-input"
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium cursor-pointer transition-all duration-200 ${
                      replacingId === selectedId
                        ? "border-gray-600/50 bg-gray-800/50 text-gray-400 cursor-not-allowed"
                        : "border-violet-500/50 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:border-violet-500/70 hover:scale-105"
                    }`}
                  >
                    {replacingId === selectedId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Replacing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Replace Audio
                      </>
                    )}
                  </label>
                  <input
                    id="audio-replace-input"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    disabled={replacingId === selectedId}
                    onChange={(e) => handleReplaceAudio(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="relative rounded-xl overflow-hidden border border-gray-700/50 bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur-sm">
                  {audioLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/95 z-10 min-h-[120px]">
                      <div className="flex items-end gap-2 h-16 mb-4">
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div
                            key={i}
                            className="w-2 bg-gradient-to-t from-violet-600 via-violet-500 to-purple-400 rounded-full shadow-lg shadow-violet-500/50 waveform-bar"
                            style={{
                              animationDelay: `${i * 0.1}s`,
                            }}
                          />
                        ))}
                      </div>
                      <p className="text-sm text-violet-300 font-medium animate-pulse">
                        Loading audio...
                      </p>
                    </div>
                  )}
                  
                  {isPlaying && !audioLoading && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-violet-500 animate-pulse" />
                  )}
                  
                  <audio
                    ref={audioRef}
                    controls
                    src={item.url}
                    className="w-full relative bg-transparent"
                    onLoadStart={() => setAudioLoading(true)}
                    onCanPlay={() => setAudioLoading(false)}
                    onLoadedData={() => setAudioLoading(false)}
                    onError={() => setAudioLoading(false)}
                    onEnded={handleAudioEnded}
                  />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Start Video Rendering Button */}
      {items.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-700/50">
          <button
            type="button"
            onClick={handleStartVideoRendering}
            disabled={startingVideo}
            className="w-full inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 text-white text-lg font-bold shadow-xl hover:shadow-2xl hover:from-emerald-500 hover:via-green-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] disabled:transform-none"
          >
            {startingVideo ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Starting Video Rendering...
              </>
            ) : (
              <>
                <Video className="w-6 h-6" />
                Start Video Rendering
              </>
            )}
          </button>
          <p className="text-center text-xs text-gray-500 mt-2">
            This will generate the final video with all your audio changes
          </p>
        </div>
      )}
      </>
    )}
    </Modal>
  );
}