import type { DisasterGame } from "./disaster";
import type { Difficulty } from "./experience";
import type { Weather } from "./conditions";
// Three curated patterns crossed with three casualty locations; no arbitrary graph mutation.
export function finalPattern(seed: number) {
  const index = Math.floor((seed >>> 0) / 3) % 3;
  return {
    index,
    name: ["동쪽 낙석", "서쪽 능선 통제", "늦은 비구름"][index],
    rockEdge: (index === 1 ? ["cedar", "ridge"] : ["fork", "cave"]) as [
      string,
      string,
    ],
    offset: index * 5,
    stormLength: [35, 40, 30][index],
  };
}
export const finalLimit = (d: Difficulty) =>
  ({ easy: 480, normal: 460, hard: 440 })[d];
export function finalSchedule(
  d: Difficulty,
  seed: number,
  stormAt?: number,
): { at: number; weather: Weather }[] {
  const p = finalPattern(seed),
    shift = d === "easy" ? 10 : d === "hard" ? -10 : 0;
  const initial: { at: number; weather: Weather }[] = [
    { at: 0, weather: "clear" },
    { at: 25, weather: "cloudy" },
    { at: 60 + shift + p.offset, weather: "drizzle" },
    { at: 90 + shift + p.offset, weather: "rain" },
    { at: 125 + shift + p.offset, weather: "wind" },
    { at: 160 + shift + p.offset, weather: "cloudy" },
  ];
  if (stormAt === undefined) return initial;
  const duration = p.stormLength + shift;
  return [
    ...initial.filter((x) => x.at < stormAt),
    { at: stormAt, weather: "rain" },
    { at: stormAt + Math.floor(duration / 2), weather: "wind" },
    { at: stormAt + duration, weather: "cloudy" },
    { at: stormAt + duration + 160, weather: "drizzle" },
  ];
}
export function finalClueCandidates(g: DisasterGame) {
  const options = ["cave", "ridge", "east"],
    idx = options.indexOf(g.target);
  const other = options[(idx + 1 + (finalPattern(g.seed).index % 2)) % 3];
  return options.filter((x) => x === g.target || x === other);
}
export const finalClueSites = (seed: number) => [
  "gate",
  ["lookout", "spring", "fork"][finalPattern(seed).index],
];
export const finalShelters = ["hut", "cave"];
export function finalAct(g: DisasterGame) {
  if (g.status !== "active")
    return {
      number: 6,
      title: "구조 작전 종료",
      hint: "이번 판단을 확인하고 같은 시드에 다시 도전하세요.",
    };
  if (g.secured)
    return {
      number: 5,
      title: "폭풍 속 마지막 선택",
      hint: g.treated
        ? "지상 귀환, H 지점 항공 지원, 대피소 대기를 비교하세요."
        : "기본 응급처치로 상태를 안정시킨 뒤 귀환 방법을 고르세요.",
    };
  if (g.found)
    return {
      number: 4,
      title: "절벽 구조",
      hint: "직접 장력·하강을 조작하거나 시간이 더 드는 자동 구조를 선택하세요.",
    };
  if (g.analyzed || g.possible.length === 1)
    return {
      number: 3,
      title: "희미한 구조 신호",
      hint: "확인된 후보에서 현장 수색하세요. 자동 신호는 두 후보까지만 좁힙니다.",
    };
  if (g.events.includes("rock"))
    return {
      number: 2,
      title: "산이 무너진다",
      hint: "통제 구간은 이동할 수 없습니다. 우회 또는 경로 확보 비용을 비교하세요.",
    };
  return {
    number: 1,
    title: "흔적을 찾아서",
    hint: g.clues.length
      ? "전망대에서 방향 분석 또는 후보 직접 수색을 선택하세요."
      : "입구에서 현장 수색으로 장갑과 발자국을 조사하세요.",
  };
}
