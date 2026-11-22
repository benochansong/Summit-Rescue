import type { Difficulty } from "./experience";
import type { Weather } from "./conditions";
export type CliffStage =
  "prepare" | "tension" | "recover" | "descent" | "approach" | "hoist";
export type CliffSession = {
  stage: CliffStage;
  hits: number;
  mistakes: number;
  stability: number;
  descent: number;
  slow: number;
  fast: number;
  retries: number;
  paused: boolean;
  visible: boolean;
  feedback: "ready" | "good" | "miss";
};
export type CliffCommand =
  | {
      type:
        | "begin"
        | "retry"
        | "pause"
        | "suspend"
        | "resume"
        | "approach"
        | "finish"
        | "auto";
    }
  | { type: "tension"; value: number }
  | { type: "descend"; speed: number };
export type CliffResult = {
  automatic: boolean;
  time: number;
  energy: number;
  bonus: number;
  grade: string;
  mistakes: number;
};
export const beginCliff = (): CliffSession => ({
  stage: "prepare",
  hits: 0,
  mistakes: 0,
  stability: 100,
  descent: 0,
  slow: 0,
  fast: 0,
  retries: 0,
  paused: false,
  visible: true,
  feedback: "ready",
});
export function cliffRules(difficulty: Difficulty, weather: Weather) {
  const p = {
    easy: { width: 44, period: 6000, tolerance: 4, wind: 3 },
    normal: { width: 32, period: 4600, tolerance: 3, wind: 6 },
    hard: { width: 24, period: 3400, tolerance: 2, wind: 9 },
  }[difficulty];
  const rough = weather === "wind" || weather === "rain" || weather === "snow";
  return {
    ...p,
    width: p.width - (rough ? 4 : 0),
    period: p.period - (rough ? 400 : 0),
    sway: weather === "wind" ? p.wind : weather === "rain" ? 2 : 0,
  };
}
// Pure visual sample; the UI owns elapsed real time, the engine only scores the submitted value.
export function tensionAt(
  ms: number,
  difficulty: Difficulty,
  weather: Weather,
) {
  const r = cliffRules(difficulty, weather),
    phase = (ms / r.period) * Math.PI * 2;
  return Math.max(
    0,
    Math.min(
      100,
      50 + 45 * Math.sin(phase - Math.PI / 2) + r.sway * Math.sin(phase * 3),
    ),
  );
}
export function cliffResult(
  s: CliffSession,
  automatic: boolean,
  rope: boolean,
): CliffResult {
  return {
    automatic,
    time: automatic
      ? rope
        ? 30
        : 42
      : 10 + s.mistakes * 3 + s.slow * 2 + s.fast * 2 + s.retries * 4,
    energy: automatic ? 12 : 5 + s.mistakes * 2 + s.fast * 2,
    bonus: automatic
      ? 0
      : s.mistakes === 0 && s.fast === 0
        ? 20
        : s.mistakes <= 2
          ? 10
          : 0,
    grade: automatic
      ? "안전 지원"
      : s.mistakes === 0 && s.fast === 0
        ? "정밀 구조"
        : s.mistakes <= 2
          ? "안정 구조"
          : "회복 구조",
    mistakes: s.mistakes,
  };
}
export function cliffStep(
  s: CliffSession,
  c: CliffCommand,
  d: Difficulty,
  w: Weather,
  rope: boolean,
): CliffSession {
  if (c.type === "resume") return { ...s, visible: true, paused: false };
  if (c.type === "suspend") return { ...s, visible: false, paused: true };
  if (!s.visible) return s;
  if (c.type === "pause") return { ...s, paused: !s.paused };
  if (s.paused) return s;
  if (c.type === "begin" && s.stage === "prepare" && rope)
    return { ...s, stage: "tension" };
  if (c.type === "retry" && s.stage === "recover" && s.retries < 2)
    return {
      ...s,
      stage: "tension",
      stability: 100,
      retries: s.retries + 1,
      feedback: "ready",
    };
  if (
    c.type === "tension" &&
    s.stage === "tension" &&
    rope &&
    Number.isFinite(c.value) &&
    c.value >= 0 &&
    c.value <= 100
  ) {
    const rules = cliffRules(d, w),
      good = Math.abs(c.value - 50) <= rules.width / 2;
    if (good) {
      const hits = s.hits + 1;
      return {
        ...s,
        hits,
        stage: hits === 3 ? "descent" : "tension",
        feedback: "good",
      };
    }
    const stability = Math.max(
      0,
      s.stability - Math.ceil(100 / rules.tolerance),
    );
    return {
      ...s,
      mistakes: s.mistakes + 1,
      stability,
      stage: stability === 0 ? "recover" : "tension",
      feedback: "miss",
    };
  }
  if (
    c.type === "descend" &&
    s.stage === "descent" &&
    Number.isFinite(c.speed) &&
    c.speed >= 0 &&
    c.speed <= 100
  ) {
    const fast = c.speed > 65,
      slow = c.speed < 35,
      descent = s.descent + 1;
    return {
      ...s,
      descent,
      fast: s.fast + Number(fast),
      slow: s.slow + Number(slow),
      stability: Math.max(15, s.stability - (fast ? 15 : 0)),
      stage: descent === 3 ? "approach" : "descent",
      feedback: fast ? "miss" : "good",
    };
  }
  if (c.type === "approach" && s.stage === "approach")
    return { ...s, stage: "hoist", feedback: "good" };
  return s;
}
export const cliffStageNames: Record<CliffStage, string> = {
  prepare: "1 · 장비와 현장 확인",
  tension: "2 · 로프 안정화",
  recover: "안전 지지점 · 다시 준비",
  descent: "3 · 절벽 하강",
  approach: "4 · 조난자 접근",
  hoist: "5 · 안전 지형으로 인양",
};
