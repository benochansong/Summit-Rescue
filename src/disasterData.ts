import type { Weather } from "./conditions";
import type { Difficulty } from "./experience";
export const disasterCandidates = ["cave", "ridge", "east"];
export const landingSites = ["lookout", "hut", "pine"];
export const disasterProfiles = {
  easy: {
    name: "신입 구조대장",
    limit: 440,
    energy: 0.85,
    decay: 0.7,
    window: 44,
    rock: 65,
    rain: 110,
    flood: 140,
    wind: 180,
    clear: 240,
    snow: 350,
  },
  normal: {
    name: "정규 구조 작전",
    limit: 400,
    energy: 1,
    decay: 0.85,
    window: 32,
    rock: 60,
    rain: 100,
    flood: 125,
    wind: 155,
    clear: 220,
    snow: 315,
  },
  hard: {
    name: "극한 구조 작전",
    limit: 380,
    energy: 1.1,
    decay: 1,
    window: 24,
    rock: 50,
    rain: 80,
    flood: 105,
    wind: 135,
    clear: 200,
    snow: 285,
  },
} satisfies Record<Difficulty, object>;
export type Scene =
  "dispatch" | "rock" | "flood" | "storm" | "found" | "secured" | "helicopter";
export const scenes: Record<
  Scene,
  { eyebrow: string; title: string; text: string }
> = {
  dispatch: {
    eyebrow: "14:10 · 백운산 구조본부",
    title: "마지막 무전이 끊겼습니다",
    text: "“능선 아래입니다. 다리를 움직이기 어렵습니다.” 이재하 씨의 마지막 목소리입니다. 제2전망대의 신고 방향을 확인하고, 낙석 예보를 살펴 출동하세요.",
  },
  rock: {
    eyebrow: "긴급 경고 · 낙석과 산사태",
    title: "등산로가 달라졌습니다",
    text: "삼거리와 바위 그늘 사이가 낙석으로 차단됐습니다. 이동 중이었다면 도착 후 통제됩니다. 계곡·폭포 또는 서쪽 능선으로 우회하거나 로프 확보·안정 대기를 선택하세요.",
  },
  flood: {
    eyebrow: "긴급 경고 · 계곡 수위 상승",
    title: "물이 길을 덮었습니다",
    text: "삼거리–계곡, 나무다리–계곡이 45분간 통제됩니다. 이후 주의 통행으로 전환됩니다. 서쪽 숲과 능선으로 우회하거나 로프 확보·안정 대기를 선택하세요.",
  },
  storm: {
    eyebrow: "기상 관측 · 폭풍 진입",
    title: "귀환할 시간을 남겨 두세요",
    text: "폭우가 이동 부담을 높입니다. 헬기는 지금 출동할 수 없습니다. 예보와 남은 체력, 지상 귀환 경로를 함께 판단하세요.",
  },
  found: {
    eyebrow: "구조 신호 · 생존 확인",
    title: "“여기 있습니다!”",
    text: "바위 아래에서 재하 씨의 대답이 들립니다. 발견만으로 구조가 끝나지 않습니다. 로프로 접근한 뒤 처치하고, 안전 지형까지 이송해야 합니다.",
  },
  secured: {
    eyebrow: "로프 확보 · 현장 구조",
    title: "이제 손을 잡았습니다",
    text: "조난자를 안전 지지점까지 끌어올렸습니다. 기본 응급처치 후 부상자 이송을 완료하세요. 자동 구조도 동일하게 안전 인계로 인정됩니다.",
  },
  helicopter: {
    eyebrow: "항공 지원 · 인계 완료",
    title: "구조대와 함께 이송합니다",
    text: "도착 시 기상과 착륙 지점을 다시 확인했습니다. 재하 씨와 구조대원이 함께 탑승해 본부로 이동합니다.",
  },
};
export function disasterTimes(difficulty: Difficulty, seed: number) {
  const p = disasterProfiles[difficulty],
    offset = (Math.floor((seed >>> 0) / 3) % 3) * 5;
  return {
    rock: p.rock + offset,
    rockWarning: p.rock + offset - (difficulty === "hard" ? 20 : 35),
    flood: p.flood + offset,
    floodWarning: p.flood + offset - 25,
  };
}
export function disasterSchedule(
  difficulty: Difficulty,
  seed: number,
): { at: number; weather: Weather }[] {
  const p = disasterProfiles[difficulty],
    offset = (Math.floor((seed >>> 0) / 3) % 3) * 5;
  return [
    { at: 0, weather: "clear" },
    { at: 30, weather: "cloudy" },
    { at: p.rain + offset, weather: "rain" },
    { at: p.wind + offset, weather: "wind" },
    { at: p.clear + offset, weather: "clear" },
    { at: p.snow + offset, weather: "snow" },
  ];
}
