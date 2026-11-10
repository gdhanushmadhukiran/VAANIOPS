/**
 * Audio Recording and PCM WAV conversion utility for VaaniOps.
 *
 * Implements:
 * 1. Browser MediaRecorder capture.
 * 2. Web Audio API OfflineAudioContext resampling to 16 kHz mono.
 * 3. 16-bit linear PCM WAV encoding.
 * 4. 30-second duration boundary enforcement.
 * 5. Clean resource teardown (tracks stopped).
 */

export interface RecordedAudioResult {
  blob: Blob;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  url: string;
}

export class AudioRecordingSession {
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private timerId: number | null = null;
  private startTime: number = 0;
  private maxDurationSeconds: number = 30;

  constructor(maxDurationSeconds: number = 30) {
    this.maxDurationSeconds = maxDurationSeconds;
  }

  async start(
    onTick?: (elapsedSeconds: number, remainingSeconds: number) => void,
    onMaxReached?: () => void
  ): Promise<void> {
    this.recordedChunks = [];

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        throw new Error('Microphone permission was denied. Please allow microphone access in browser settings.');
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No microphone device was detected on your system.');
      } else {
        throw new Error(`Microphone access error: ${error.message || 'Unknown error'}`);
      }
    }

    // Try standard mime types
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', ''];
    let chosenMime = '';
    for (const mime of mimeTypes) {
      if (!mime || MediaRecorder.isTypeSupported(mime)) {
        chosenMime = mime;
        break;
      }
    }

    this.mediaRecorder = chosenMime ? new MediaRecorder(this.mediaStream, { mimeType: chosenMime }) : new MediaRecorder(this.mediaStream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(200); // 200ms slice

    this.timerId = window.setInterval(() => {
      const elapsed = Math.min(this.maxDurationSeconds, Math.floor((Date.now() - this.startTime) / 1000));
      const remaining = Math.max(0, this.maxDurationSeconds - elapsed);
      if (onTick) {
        onTick(elapsed, remaining);
      }
      if (elapsed >= this.maxDurationSeconds) {
        this.stop();
        if (onMaxReached) {
          onMaxReached();
        }
      }
    }, 500);
  }

  async stop(): Promise<RecordedAudioResult> {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    const duration = Math.min(this.maxDurationSeconds, (Date.now() - this.startTime) / 1000);

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        this.teardownStream();
        reject(new Error('Recorder is not active.'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        try {
          this.teardownStream();
          const rawBlob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm',
          });

          // Convert recorded blob to 16kHz mono 16-bit PCM WAV
          const wavBlob = await convertBlobTo16kHzWav(rawBlob);
          const audioUrl = URL.createObjectURL(wavBlob);

          resolve({
            blob: wavBlob,
            durationSeconds: Math.max(0.5, duration),
            sampleRate: 16000,
            channels: 1,
            url: audioUrl,
          });
        } catch (err) {
          this.teardownStream();
          reject(err);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        this.teardownStream();
        reject(err);
      }
    });
  }

  cancel(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // ignore
      }
    }
    this.teardownStream();
  }

  private teardownStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      this.mediaStream = null;
    }
  }
}

/**
 * Decodes input audio using Web Audio API and resamples to 16,000 Hz 16-bit mono PCM WAV.
 */
export async function convertBlobTo16kHzWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  // Decode source audio with browser AudioContext
  const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const audioCtx = new AudioCtxClass();

  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    try {
      await audioCtx.close();
    } catch {
      // ignore
    }
  }

  const targetSampleRate = 16000;
  const targetLength = Math.ceil(decodedBuffer.duration * targetSampleRate);

  // Resample to 16kHz mono using OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const resampledBuffer = await offlineCtx.startRendering();
  const channelData = resampledBuffer.getChannelData(0); // Mono Float32Array

  // Encode to 16-bit Linear PCM WAV bytes
  const wavBytes = encodeWavPCM16(channelData, targetSampleRate);
  return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
}

function encodeWavPCM16(samples: Float32Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write ASCII strings
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  writeString(8, 'WAVE');

  /* "fmt " sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true); // NumChannels (1)
  view.setUint32(24, sampleRate, true); // SampleRate (16000)
  view.setUint32(28, byteRate, true); // ByteRate (32000)
  view.setUint16(32, blockAlign, true); // BlockAlign (2)
  view.setUint16(34, bitsPerSample, true); // BitsPerSample (16)

  /* "data" sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    // Clamp to [-1.0, 1.0]
    const s = Math.max(-1, Math.min(1, samples[i]));
    // Scale to 16-bit signed integer [-32768, 32767]
    const pcm = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, pcm, true);
  }

  return new Uint8Array(buffer);
}
