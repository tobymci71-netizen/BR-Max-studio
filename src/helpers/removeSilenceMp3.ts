export type SilenceTrimMode = "full_audio" | "start_and_end";

export async function removeSilenceFromMp3(
  mp3Bytes: Uint8Array,
  {
    thresholdDb = -40,
    minSilenceMs = 300,
    trimMode = "full_audio",
  }: {
    thresholdDb?: number;
    minSilenceMs?: number;
    trimMode?: SilenceTrimMode;
  } = {},
) {
  const audioCtx = new AudioContext();

  // Convert Uint8Array → ArrayBuffer
  const arrayBuf = new Uint8Array(mp3Bytes).buffer;

  // Decode MP3 to PCM
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuf);

  const sampleRate = audioBuffer.sampleRate;
  const channelData = audioBuffer.getChannelData(0); // Use left channel

  // Convert db → amplitude
  const threshold = Math.pow(10, thresholdDb / 20);
  const minSilenceSamples = Math.floor((minSilenceMs / 1000) * sampleRate);

  let out: number[];

  if (trimMode === "start_and_end") {
    // Only trim leading and trailing silence; keep everything in between
    let firstNonSilent = channelData.length;
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) >= threshold) {
        firstNonSilent = i;
        break;
      }
    }
    let lastNonSilent = -1;
    for (let i = channelData.length - 1; i >= 0; i--) {
      if (Math.abs(channelData[i]) >= threshold) {
        lastNonSilent = i;
        break;
      }
    }
    const startIdx = Math.min(firstNonSilent, channelData.length - 1);
    const endIdx = lastNonSilent < 0 ? 0 : lastNonSilent;
    const sliceStart = Math.min(startIdx, endIdx);
    const sliceEnd = Math.max(startIdx, endIdx) + 1;
    out = Array.from(channelData.subarray(sliceStart, sliceEnd));
  } else {
    // full_audio: remove all silence runs >= minSilenceMs
    const fullOut: number[] = [];
    let silent = 0;

    for (let i = 0; i < channelData.length; i++) {
      const v = Math.abs(channelData[i]);

      if (v < threshold) {
        silent++;
      } else {
        if (silent > 0 && silent < minSilenceSamples) {
          const start = i - silent;
          for (let j = start; j < i; j++) fullOut.push(channelData[j]);
        }
        silent = 0;
        fullOut.push(channelData[i]);
      }
    }
    out = fullOut;
  }

  // Encode output to WAV
  const wavBlob = encodeWav(out, sampleRate);
  const wavArrayBuf = await wavBlob.arrayBuffer();

  // Convert WAV → base64
  const base64 = bufferToBase64(wavArrayBuf);

  return {
    base64Data: base64,
    duration: out.length / sampleRate,
  };
}

function encodeWav(samples: number[], sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const write = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };

  write(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function bufferToBase64(buf: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buf);

  const CHUNK = 0x8000; // 32 KB
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.subarray(i, i + CHUNK);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}
