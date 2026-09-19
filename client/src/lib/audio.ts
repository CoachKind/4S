/**
 * Browser audio for voice mode.
 *
 * Capture: microphone -> AudioWorklet -> 24kHz mono PCM16 chunks (base64),
 * the format the Realtime API expects. Playback: PCM16 chunks from the relay
 * are decoded and scheduled back to back on the same AudioContext.
 */

export const SAMPLE_RATE = 24_000;

/** Runs on the audio thread. Resamples to 24kHz if the context runs faster, converts to PCM16, posts ~100ms frames. */
const CAPTURE_WORKLET = `
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.target = ${SAMPLE_RATE};
    this.buffer = [];
    this.buffered = 0;
    this.frame = Math.round(this.target / 10);
    this.acc = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const channel = input[0];
    const ratio = sampleRate / this.target;
    const out = [];
    if (ratio <= 1.0001) {
      for (let i = 0; i < channel.length; i++) out.push(channel[i]);
    } else {
      // Simple decimation with fractional step; good enough for speech.
      let i = this.acc;
      while (i < channel.length) {
        out.push(channel[Math.floor(i)]);
        i += ratio;
      }
      this.acc = i - channel.length;
    }
    if (out.length) {
      this.buffer.push(Float32Array.from(out));
      this.buffered += out.length;
    }
    while (this.buffered >= this.frame) {
      const pcm = new Int16Array(this.frame);
      let filled = 0;
      while (filled < this.frame) {
        const head = this.buffer[0];
        const take = Math.min(head.length, this.frame - filled);
        for (let j = 0; j < take; j++) {
          const s = Math.max(-1, Math.min(1, head[j]));
          pcm[filled + j] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        filled += take;
        if (take === head.length) this.buffer.shift();
        else this.buffer[0] = head.subarray(take);
      }
      this.buffered -= this.frame;
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}
registerProcessor("capture-processor", CaptureProcessor);
`;

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface CaptureHandle {
  stop: () => void;
}

/** Starts microphone capture. Calls onChunk with base64 PCM16 frames until stopped. */
export async function startCapture(
  ctx: AudioContext,
  stream: MediaStream,
  onChunk: (base64: string) => void,
): Promise<CaptureHandle> {
  const blob = new Blob([CAPTURE_WORKLET], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  try {
    await ctx.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const source = ctx.createMediaStreamSource(stream);
  // The node must reach the destination to be processed at all, so it gets one
  // output routed through a muted gain. Nothing from the microphone is audible.
  const node = new AudioWorkletNode(ctx, "capture-processor", {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
    channelCount: 1,
  });
  const mute = ctx.createGain();
  mute.gain.value = 0;
  node.onprocessorerror = () => console.error("voice: capture processor failed");
  node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => onChunk(bytesToBase64(new Uint8Array(e.data)));
  source.connect(node);
  node.connect(mute);
  mute.connect(ctx.destination);
  return {
    stop: () => {
      node.port.onmessage = null;
      try {
        source.disconnect();
        node.disconnect();
        mute.disconnect();
      } catch {
        // already torn down
      }
      for (const track of stream.getTracks()) track.stop();
    },
  };
}

/** Schedules PCM16 chunks back to back. Call clear() when the user interrupts. */
export class PcmPlayer {
  private ctx: AudioContext;
  private nextTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private onIdle: () => void;
  private idleTimer: number | null = null;

  constructor(ctx: AudioContext, onIdle: () => void) {
    this.ctx = ctx;
    this.onIdle = onIdle;
  }

  get playing(): boolean {
    return this.sources.size > 0;
  }

  enqueue(base64: string) {
    const bytes = base64ToBytes(base64);
    const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    if (samples.length === 0) return;
    const buffer = this.ctx.createBuffer(1, samples.length, SAMPLE_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    const startAt = Math.max(this.ctx.currentTime + 0.02, this.nextTime);
    source.start(startAt);
    this.nextTime = startAt + buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (this.sources.size === 0) this.scheduleIdle();
    };
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdle() {
    if (this.idleTimer !== null) window.clearTimeout(this.idleTimer);
    this.idleTimer = window.setTimeout(() => {
      this.idleTimer = null;
      if (this.sources.size === 0) this.onIdle();
    }, 120);
  }

  /** Stops everything queued (the user started talking over the reply). */
  clear() {
    for (const s of this.sources) {
      try {
        s.onended = null;
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.sources.clear();
    this.nextTime = 0;
    if (this.idleTimer !== null) {
      window.clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
