export type Weather = "clear" | "cloudy" | "fog" | "rain" | "wind" | "snow";
export type Equipment = "kit" | "blanket" | "rope" | "lantern" | "drone";
export type MissionId = 1 | 2;
export const equipment: {
  id: Equipment;
  name: string;
  icon: string;
  effect: string;
  tip: string;
}[] = [
  {
    id: "kit",
    name: "응급키트",
    icon: "✚",
    effect: "생존 상태 +25 · 임무당 2회",
    tip: "부상자 안정화에 유리. 기본 응급처치와 별도로 사용합니다.",
  },
  {
    id: "blanket",
    name: "방한포",
    icon: "▱",
    effect: "보온 후 추위·야간 악화 55% 감소",
    tip: "폭설·야간 귀환에 유리. 발견 후 덮어 주세요.",
  },
  {
    id: "rope",
    name: "구조 로프",
    icon: "♧",
    effect: "가파른 길 체력 −4 · 급류 통과",
    tip: "위험 지형의 빠른 길에 유리. 사용 횟수 제한 없음.",
  },
  {
    id: "lantern",
    name: "랜턴",
    icon: "◈",
    effect: "야간 수색 추가 시간 10분 제거",
    tip: "일몰 이후 수색에 유리. 자동 적용.",
  },
  {
    id: "drone",
    name: "수색 드론",
    icon: "⌘",
    effect: "2구간 이내 단서 탐지 · 2회",
    tip: "수색 범위를 좁힙니다. 강풍에서는 사용 불가.",
  },
];
export const weatherInfo: Record<
  Weather,
  { name: string; icon: string; detail: string }
> = {
  clear: { name: "맑음", icon: "☀", detail: "14°C · 시야 양호" },
  cloudy: { name: "흐림", icon: "☁", detail: "10°C · 비구름 접근" },
  fog: { name: "안개", icon: "≋", detail: "8°C · 수색 +5분" },
  rain: { name: "폭우", icon: "☂", detail: "5°C · 이동 체력 ×1.3" },
  wind: { name: "강풍", icon: "彡", detail: "2°C · 드론 비행 불가" },
  snow: { name: "폭설", icon: "❄", detail: "−4°C · 이동 시간 ×1.3" },
};
export const missions = {
  1: {
    name: "사라진 등산객",
    subtitle: "첫 번째 출동",
    limit: 180,
    start: 14 * 60,
    sunset: 180,
    difficulty: "쉬움",
    description:
      "백운산 북쪽 등산로에서 등산객 한 명이 실종되었습니다. 마지막 목격 장소는 제2전망대입니다. 일몰까지 시간이 얼마 남지 않았습니다. 신속한 수색과 구조가 필요합니다.",
  },
  2: {
    name: "폭풍 전야",
    subtitle: "폭풍 속의 구조 작전",
    limit: 280,
    start: 15 * 60,
    sunset: 120,
    difficulty: "보통",
    description:
      "오후 늦게 등산객 한 명이 계곡 방향으로 향한 뒤 연락이 끊겼습니다. 제2전망대의 이동 기록을 확인하십시오. 70분 뒤 폭우가 예보되어 있습니다. 계곡의 빠른 길과 숲길 우회로를 신중하게 선택하십시오.",
  },
} as const;
export const schedule = (
  mission: MissionId,
): { at: number; weather: Weather }[] =>
  mission === 1
    ? [{ at: 0, weather: "clear" }]
    : [
        { at: 0, weather: "cloudy" },
        { at: 35, weather: "fog" },
        { at: 70, weather: "rain" },
        { at: 130, weather: "wind" },
        { at: 190, weather: "snow" },
      ];
export const weatherAt = (mission: MissionId, elapsed: number): Weather =>
  schedule(mission)
    .filter((p) => p.at <= elapsed)
    .at(-1)!.weather;
export function forecast(mission: MissionId, elapsed: number) {
  const next = schedule(mission).find((p) => p.at > elapsed);
  return next
    ? `${next.at - elapsed}분 후 ${weatherInfo[next.weather].name} · ${weatherInfo[next.weather].detail}`
    : "추가 기상 변화 없음";
}
export function normalizeEquipment(items: Equipment[]): Equipment[] {
  return [
    ...new Set(items.filter((id) => equipment.some((e) => e.id === id))),
  ].slice(0, 3);
}
