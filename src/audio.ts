import type { Feedback } from "./experience";
import type { Weather } from "./conditions";
type SoundSettings = { sound: boolean; volume: number };
type AudioCue =
  | Feedback["kind"]
  | "rock"
  | "flood"
  | "storm"
  | "helicopter"
  | "rope"
  | "carry";
// Synthesized locally: no recordings, downloads or third-party audio licenses.
export class RescueAudio {
  private ctx: AudioContext | null = null;
  private settings: SoundSettings = { sound: false, volume: 0.3 };
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  configure(settings: SoundSettings) {
    this.settings = settings;
    try {
      if (this.ctx && this.master)
        this.master.gain.setValueAtTime(
          settings.sound ? settings.volume : 0,
          this.ctx.currentTime,
        );
      if (!settings.sound) this.suspend();
    } catch {
      /* A failed audio device must not interrupt settings or play. */
    }
  }
  private start() {
    if (!this.settings.sound) return null;
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        this.ctx = ctx;
        const master = ctx.createGain();
        master.gain.value = this.settings.volume;
        master.connect(ctx.destination);
        this.master = master;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate),
          data = buffer.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + Math.random() * 0.04 - 0.02) / 1.02;
          data[i] = brown;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 650;
        this.filter = filter;
        const ambient = ctx.createGain();
        ambient.gain.value = 0;
        this.ambient = ambient;
        noise.connect(filter);
        filter.connect(ambient);
        ambient.connect(master);
        noise.start();
      }
      void this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      return null;
    }
  }
  scene(weather: Weather, stage: number, active: boolean, duck = false) {
    const ctx = this.ctx;
    if (!ctx || !this.ambient || !this.filter) return;
    try {
      this.filter.frequency.setTargetAtTime(
        weather === "rain"
          ? 2100
          : weather === "drizzle"
            ? 1400
            : weather === "wind"
              ? 1000
              : 550,
        ctx.currentTime,
        0.2,
      );
      this.ambient.gain.setTargetAtTime(
        active && this.settings.sound
          ? duck
            ? 0.015
            : stage === 3
              ? 0.15
              : 0.07
          : 0,
        ctx.currentTime,
        0.3,
      );
    } catch {
      /* Keep the visual game running if the device is lost. */
    }
  }
  play(kind: AudioCue = "radio") {
    const ctx = this.start();
    if (!ctx || !this.master) return;
    const notes: Record<AudioCue, number[]> = {
      rock: [90, 65, 45],
      flood: [120, 150, 100],
      storm: [60, 40, 55],
      helicopter: [80, 100, 80, 100, 80, 100],
      rope: [210, 250],
      carry: [170, 140],
      move: [140, 110],
      clue: [540, 720],
      found: [440, 660, 880],
      aid: [520, 650],
      risk: [290, 290],
      success: [440, 554, 659, 880],
      failure: [280, 220],
      radio: [620],
    };
    try {
      notes[kind].forEach((hz, i) => {
        const o = ctx.createOscillator(),
          gain = ctx.createGain(),
          t = ctx.currentTime + i * 0.13;
        o.type = kind === "move" ? "triangle" : "sine";
        o.frequency.value = hz;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(
          kind === "move" ? 0.08 : 0.12,
          t + 0.015,
        );
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o.connect(gain);
        gain.connect(this.master!);
        o.start(t);
        o.stop(t + 0.22);
        o.onended = () => {
          o.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      /* Audio failure never changes game state. */
    }
  }
  suspend() {
    try {
      void this.ctx?.suspend().catch(() => {});
    } catch {
      /* The context may already have been released. */
    }
  }
  close() {
    try {
      void this.ctx?.close().catch(() => {});
    } catch {
      /* Cleanup must not throw. */
    }
    this.ctx = null;
  }
}
