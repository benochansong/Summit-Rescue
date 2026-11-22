export type Weather =
  "clear" | "cloudy" | "fog" | "drizzle" | "rain" | "wind" | "snow";
export type Equipment = "kit" | "blanket" | "rope" | "lantern" | "drone";
export type MissionId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const missionIds: MissionId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
export type CasualtyType = "lost" | "injured" | "cold";
export const casualtyInfo = {
  lost: { name: "길을 잃은 등산객", detail: "기본 동행 비용 · 정보 수색 중심" },
  injured: {
    name: "다친 등산객",
    detail: "기본 처치 필수 · 동행 시간 ×1.5, 체력 ×1.6",
  },
  cold: {
    name: "저체온 위험 등산객",
    detail: "추가 추위 악화 · 보온과 대피소 활용",
  },
};
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
  drizzle: { name: "비", icon: "☂", detail: "7°C · 이동 체력 ×1.1" },
  rain: { name: "폭우", icon: "☂", detail: "5°C · 이동 체력 ×1.3" },
  wind: { name: "강풍", icon: "彡", detail: "2°C · 드론 비행 불가" },
  snow: { name: "폭설", icon: "❄", detail: "−4°C · 이동 시간 ×1.3" },
};
export const missions = {
  9: {
    name: "하늘에서 온 구조 요청",
    subtitle: "하늘이 열리는 순간, 구조의 희망이 시작된다.",
    limit: 400,
    start: 16 * 60 + 20,
    sunset: 90,
    difficulty: "항공 구조",
    description:
      "16:20, 고산 능선에서 박도현 씨가 부상을 입었습니다. 전망대에서 신호를 확인하고 조난자를 찾아 처치하세요. +60분 강풍, +125분 비, +145분 흐림이 예보됩니다. 지상 귀환 또는 H 지점 항공 지원을 선택하십시오. 헬기는 조난자만 이송하며 구조팀은 별도로 본부에 복귀해야 합니다.",
  },
  8: {
    name: "절벽 아래의 구조 신호",
    subtitle: "산은 위험하다. 하지만 구조는 멈추지 않는다.",
    limit: 400,
    start: 15 * 60 + 30,
    sunset: 110,
    difficulty: "절벽 구조",
    description:
      "오후 3시 30분, 백운산 동쪽 암릉에서 한서윤 씨가 절벽 아래 고립됐습니다. 제2전망대에서 흔적과 무전 방향을 조사하고 현장을 수색하세요. 로프 안정화·하강·인양 후 처치하고 본부까지 함께 귀환하십시오.",
  },
  7: {
    name: "폭풍 속 마지막 구조",
    subtitle: "산이 변하면, 구조 작전도 변해야 한다",
    limit: 400,
    start: 14 * 60 + 10,
    sunset: 190,
    difficulty: "재난 · 액션",
    description:
      "백운산 북쪽 암릉에서 이재하 씨의 연락이 끊겼습니다. 제2전망대에서 방향 신호를 분석하십시오. 낙석과 계곡 수위 상승이 예보됐습니다. 현장 로프 구조와 부상자 이송 후, 지상 귀환 또는 기상이 허용하는 헬기 이송을 결정하십시오.",
  },
  6: {
    name: "두 개의 구조 신호",
    subtitle: "세 사람의 판단, 하나의 구조 작전",
    limit: 360,
    start: 15 * 60 + 20,
    sunset: 100,
    difficulty: "지휘",
    description:
      "오후 3시 20분, 북쪽 능선의 실종자와 계곡의 부상자 신고가 연달아 접수됐습니다. 북쪽 대상은 제2전망대, 계곡 대상은 나무다리의 흔적을 조사하십시오. 약 90분 뒤 비구름이 접근합니다. 대원과 장비를 나누고 두 조난자 및 전 대원의 안전한 귀환을 지휘하십시오.",
  },
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
  3: {
    name: "안개가 삼킨 능선",
    subtitle: "정보를 읽는 구조",
    limit: 300,
    start: 10 * 60 + 40,
    sunset: 440,
    difficulty: "보통",
    description:
      "오전 10시 40분, 홀로 등산하던 사람이 짙은 안개 속에서 길을 잃었습니다. 마지막 무전에서는 계곡 물소리만 확인되었습니다. 청음 전망대의 흔적과 서로 다른 지점의 무전 신호를 비교하십시오.",
  },
  4: {
    name: "위험한 암릉",
    subtitle: "귀환을 위한 선택",
    limit: 360,
    start: 13 * 60 + 20,
    sunset: 280,
    difficulty: "어려움",
    description:
      "오후 1시 20분, 고산 암릉에서 등산객이 넘어져 다쳤습니다. 암릉 관측소에서 신고 기록을 확인하십시오. 강풍 중 노출 경로는 로프가 필요합니다. 긴 우회로는 체력 소모가 작고 부상자에게 안전합니다.",
  },
  5: {
    name: "마지막 불빛",
    subtitle: "어둠 속의 길잡이",
    limit: 330,
    start: 18 * 60 + 10,
    sunset: 30,
    difficulty: "어려움",
    description:
      "오후 6시 10분, 대피소에 도착하지 않은 등산객의 실종 신고가 들어왔습니다. 첫빛 대피소에서 기록을 확인하고 간헐적인 불빛을 추적하십시오. 조난자와 귀환할 때 대피소에서 보온 정비를 해야 합니다.",
  },
} as const;
export const missionType = (id: MissionId): CasualtyType =>
  id === 4 ? "injured" : id === 5 ? "cold" : "lost";
export const recommendations: Record<MissionId, Equipment[]> = {
  9: ["rope", "kit", "blanket"],
  8: ["rope", "kit", "blanket"],
  7: ["rope", "kit", "blanket"],
  6: ["drone", "kit", "rope"],
  1: ["kit", "blanket", "rope"],
  2: ["kit", "blanket", "rope"],
  3: ["drone", "lantern", "kit"],
  4: ["rope", "kit", "blanket"],
  5: ["lantern", "blanket", "kit"],
};
export const evaluationRules: Record<MissionId, string> = {
  9: "지상·항공 동일 평가: 생존 60 이상·제한 시간85% 이내 3별, 생존35 이상2별. 조난자와 구조팀 모두 안전해야 성공.",
  8: "안전 귀환·생존·시간으로 별 평가. 정밀 수동 구조는 성공 귀환 시 경험치 +20, 안정 구조 +10. 자동 구조도 정상 완료.",
  7: "3별: 안전 인계·생존 60 이상·제한 시간 85% 이내 / 2별: 생존 35 이상 · 자동 구조도 같은 평가",
  6: "S: 2명 구조·대원 전원 안전·230분 이내·생존 50 이상 / A: 2명 구조·전원 안전 / B: 1명 구조 / C: 미달성",
  1: "3별: 생존 65 이상·162분 이내 / 2별: 생존 40 이상",
  2: "3별: 생존 65 이상·252분 이내 / 2별: 생존 40 이상",
  3: "3별: 두 지점 이상 신호 분석·후보 1곳 확정·생존 55 이상 / 2별: 분석 1회 이상·생존 35 이상",
  4: "3별: 기본 처치·안전 귀환·강행 없음·생존 60 이상 / 2별: 생존 35 이상",
  5: "3별: 구조 신호 확인·귀환 중 대피소 보온·생존 55 이상 / 2별: 생존 35 이상",
};
export const schedule = (
  mission: MissionId,
  seed = 0,
): { at: number; weather: Weather }[] =>
  mission >= 7
    ? [
        { at: 0, weather: "clear" },
        { at: 30, weather: "cloudy" },
        { at: 100, weather: "rain" },
        { at: 155, weather: "wind" },
        { at: 220, weather: "clear" },
        { at: 315, weather: "snow" },
      ]
    : mission === 6
      ? [
          { at: 0, weather: "clear" },
          { at: 90 + (Math.floor(seed / 9) % 3) * 5, weather: "rain" },
          { at: 150 + (Math.floor(seed / 9) % 3) * 5, weather: "wind" },
          { at: 210 + (Math.floor(seed / 9) % 3) * 5, weather: "clear" },
          { at: 290 + (Math.floor(seed / 9) % 3) * 5, weather: "fog" },
        ]
      : mission === 1
        ? [{ at: 0, weather: "clear" }]
        : mission === 2
          ? [
              { at: 0, weather: "cloudy" },
              { at: 35, weather: "fog" },
              { at: 70, weather: "rain" },
              { at: 130, weather: "wind" },
              { at: 190, weather: "snow" },
            ]
          : mission === 3
            ? [
                { at: 0, weather: "fog" },
                {
                  at: 120 + (Math.floor(seed / 3) % 3) * 10,
                  weather: "cloudy",
                },
                { at: 200 + (Math.floor(seed / 3) % 3) * 10, weather: "fog" },
              ]
            : mission === 4
              ? [
                  { at: 0, weather: "wind" },
                  {
                    at: 90 + (Math.floor(seed / 3) % 3) * 10,
                    weather: "cloudy",
                  },
                  {
                    at: 160 + (Math.floor(seed / 3) % 3) * 10,
                    weather: "wind",
                  },
                  {
                    at: 240 + (Math.floor(seed / 3) % 3) * 10,
                    weather: "cloudy",
                  },
                ]
              : [
                  { at: 0, weather: "cloudy" },
                  { at: 65 + (Math.floor(seed / 3) % 3) * 10, weather: "fog" },
                  {
                    at: 150 + (Math.floor(seed / 3) % 3) * 10,
                    weather: "clear",
                  },
                ];
export const weatherAt = (
  mission: MissionId,
  elapsed: number,
  seed = 0,
): Weather =>
  schedule(mission, seed)
    .filter((p) => p.at <= elapsed)
    .at(-1)!.weather;
export function forecast(mission: MissionId, elapsed: number, seed = 0) {
  const next = schedule(mission, seed).find((p) => p.at > elapsed);
  return next
    ? `${next.at - elapsed}분 후 ${weatherInfo[next.weather].name} · ${weatherInfo[next.weather].detail}`
    : "추가 기상 변화 없음";
}
export function normalizeEquipment(items: Equipment[]): Equipment[] {
  return [
    ...new Set(items.filter((id) => equipment.some((e) => e.id === id))),
  ].slice(0, 3);
}
