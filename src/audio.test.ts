import { afterEach, describe, expect, it, vi } from "vitest";
import { RescueAudio } from "./audio";
afterEach(() => vi.unstubAllGlobals());
describe("오디오 실패 격리와 음소거", () => {
  it("음소거 상태에서는 AudioContext 생성·재생 없음", () => {
    const constructor = vi.fn();
    vi.stubGlobal("AudioContext", constructor);
    const sound = new RescueAudio();
    sound.configure({ sound: false, volume: 1 });
    sound.play("found");
    sound.scene("wind", 3, true);
    sound.rotor(1);
    expect(constructor).not.toHaveBeenCalled();
  });
  it("지원되지 않는 오디오 API도 예외를 전파하지 않음", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw Error("unavailable");
        }
      },
    );
    const sound = new RescueAudio();
    sound.configure({ sound: true, volume: 0.3 });
    expect(() => sound.play("success")).not.toThrow();
    sound.close();
  });
  it("볼륨·음소거 적용, 장면 전환, 오실레이터 정리", () => {
    const gain = () => ({
      value: 0,
      setValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    });
    const gains: {
      gain: ReturnType<typeof gain>;
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }[] = [];
    const oscillators: {
      frequency: { value: number };
      type: string;
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      onended: (() => void) | null;
    }[] = [];
    const suspend = vi.fn(() => Promise.resolve()),
      close = vi.fn(() => Promise.resolve());
    vi.stubGlobal(
      "AudioContext",
      class {
        sampleRate = 10;
        currentTime = 0;
        destination = {};
        resume = () => Promise.resolve();
        suspend = suspend;
        close = close;
        createGain() {
          const n = { gain: gain(), connect: vi.fn(), disconnect: vi.fn() };
          gains.push(n);
          return n;
        }
        createBuffer() {
          return { getChannelData: () => new Float32Array(20) };
        }
        createBufferSource() {
          return {
            connect: vi.fn(),
            start: vi.fn(),
            loop: false,
            buffer: null,
          };
        }
        createBiquadFilter() {
          return { frequency: gain(), type: "", connect: vi.fn() };
        }
        createOscillator() {
          const n = {
            frequency: { value: 0 },
            type: "",
            connect: vi.fn(),
            disconnect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
            onended: null as (() => void) | null,
          };
          oscillators.push(n);
          return n;
        }
      },
    );
    const sound = new RescueAudio();
    sound.configure({ sound: true, volume: 0.4 });
    sound.play("clue");
    expect(oscillators.map((o) => o.frequency.value)).toEqual([540, 720]);
    expect(gains[0].gain.value).toBe(0.4);
    sound.scene("rain", 3, true, true);
    expect(gains[1].gain.setTargetAtTime).toHaveBeenCalledWith(0.015, 0, 0.3);
    sound.rotor(1);
    expect(oscillators).toHaveLength(4);
    const rotorNodes = gains.slice(-2);
    expect(rotorNodes[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.08,
      0,
      0.7,
    );
    sound.rotor(0);
    expect(rotorNodes[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      0,
      0.7,
    );
    expect(rotorNodes[1].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0,
      0,
      0.7,
    );
    sound.configure({ sound: false, volume: 0.4 });
    expect(gains[0].gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
    expect(suspend).toHaveBeenCalled();
    sound.play("found");
    expect(oscillators).toHaveLength(4);
    oscillators[0].onended!();
    expect(oscillators[0].disconnect).toHaveBeenCalled();
    sound.close();
    expect(close).toHaveBeenCalled();
  });
});
