import {
  missions,
  schedule,
  weatherInfo,
  type CasualtyType,
  type Weather,
} from "./conditions";
import { adjacent, point, graphDistance } from "./regions";
import type { Action, Game } from "./game";
export type Difficulty = "easy" | "normal" | "hard";
export type StoryId = "alone" | "injured" | "cold";
export type ExperienceOptions = { difficulty: Difficulty; story: StoryId };
export type Experience = ExperienceOptions & {
  clueStage: number;
  frontAnnounced: boolean;
  prepared: boolean;
};
export const difficulties: Record<
  Difficulty,
  {
    name: string;
    limit: number;
    energy: number;
    decay: number;
    rain: number;
    description: string;
  }
> = {
  easy: {
    name: "신입 구조대장",
    limit: 330,
    energy: 0.8,
    decay: 0.75,
    rain: 145,
    description: "첫 단서부터 후보 2곳 · 위험 선택 축소 · 이동 체력 완화",
  },
  normal: {
    name: "정규 구조 작전",
    limit: 300,
    energy: 1,
    decay: 1,
    rain: 95,
    description: "방향 → 환경 → 결정적 흔적 · 예고된 귀환 경로 선택",
  },
  hard: {
    name: "극한 구조 작전",
    limit: 270,
    energy: 1,
    decay: 1.1,
    rain: 75,
    description: "구조 신호 확인에 14분 · 빠른 비구름 · 장비와 귀환 계획 필수",
  },
};
export const stories: Record<
  StoryId,
  {
    name: string;
    person: string;
    type: CasualtyType;
    intro: string;
    found: string;
    ending: string;
    health: number;
    tip: string;
  }
> = {
  alone: {
    name: "마지막 안부",
    person: "윤서연 · 홀로 산에 오른 등산객",
    type: "lost",
    intro:
      "“전망대에서 사진을 보내고 내려갈게.” 서연 씨가 가족에게 남긴 마지막 메시지입니다. 약속한 시간이 지나도 연락이 없습니다.",
    found:
      "“제 목소리가 들렸군요… 가족에게 무사하다고 전해 주세요.” 이제 함께 내려갈 길을 정해야 합니다.",
    ending:
      "구조본부에서 서연 씨가 가족에게 전화를 겁니다. “나 내려왔어. 이제 괜찮아.”",
    health: 92,
    tip: "발자국과 사진을 비교해 후보를 좁히세요. 발견 후에도 귀환 체력을 남겨 두세요.",
  },
  injured: {
    name: "함께 내려가는 길",
    person: "정우진 · 다리를 다친 등산객",
    type: "injured",
    intro:
      "우진 씨는 하산 중 넘어져 다리를 다쳤습니다. “움직이기 어렵지만, 길에서 벗어나지 않고 기다리겠습니다.” 마지막 신고가 끊겼습니다.",
    found:
      "“혼자서는 내려갈 수 없었어요.” 우진 씨의 다리를 안정시키고 체력이 덜 드는 귀환 경로를 확보하세요.",
    ending:
      "우진 씨가 본부 의자에 앉아 짧게 인사합니다. “기다려 줘서 고맙습니다.”",
    health: 88,
    tip: "발견 후 기본 처치가 필수입니다. 부상자 동행은 시간 ×1.5, 체력 ×1.6이므로 로프와 우회로를 비교하세요.",
  },
  cold: {
    name: "꺼지지 않은 약속",
    person: "박하린 · 추위에 고립된 등산객",
    type: "cold",
    intro:
      "기온이 떨어지는 산에서 하린 씨의 연락이 끊겼습니다. “바람을 피할 곳을 찾았어요. 휴대전화 배터리가 얼마 없어요.”",
    found:
      "“따뜻한 곳으로 갈 수 있죠?” 하린 씨가 떨리는 손을 내밉니다. 보온 후 귀환을 서두르세요.",
    ending:
      "따뜻한 담요를 두른 하린 씨가 창밖의 산을 바라봅니다. 오늘의 약속은 무사 귀환이었습니다.",
    health: 96,
    tip: "방한포는 발견 후 추위와 야간 악화를 줄입니다. 긴 수색과 불필요한 휴식을 피하세요.",
  },
};
export const heartCandidates = [
  "cedar",
  "ridge",
  "hut",
  "valley",
  "cave",
  "waterfall",
];
const evidencePairs: Record<string, string[]> = {
  cedar: ["cedar", "hut"],
  hut: ["cedar", "hut"],
  ridge: ["cedar", "ridge"],
  valley: ["valley", "waterfall"],
  waterfall: ["valley", "waterfall"],
  cave: ["cave", "waterfall"],
};
export function evidence(g: Game, air = false) {
  const h = g.experience!;
  if (air && graphDistance(g.position, g.target, g.mission) > 2)
    return {
      stage: h.clueStage,
      possible: g.possible.filter(
        (id) => graphDistance(g.position, id, g.mission) > 2,
      ),
      text: "드론 2구간 이내에 신고자 신호가 없습니다. 해당 후보를 제외하고 지상 단서를 확인하세요.",
    };
  const stage = Math.min(
    3,
    h.clueStage + (h.difficulty === "easy" && h.clueStage === 0 ? 2 : 1),
  );
  const group =
    heartCandidates.indexOf(g.target) < 3
      ? heartCandidates.slice(0, 3)
      : heartCandidates.slice(3);
  const possible = (
    stage === 1 ? group : stage === 2 ? evidencePairs[g.target] : [g.target]
  ).filter((id) => g.possible.includes(id));
  const north = heartCandidates.indexOf(g.target) < 3;
  const pairText = north
    ? g.target === "ridge"
      ? "높은 능선과 침엽수 그늘"
      : "숲속 쉼터나 대피소 처마"
    : g.target === "cave"
      ? "젖은 바위와 반사되는 물소리"
      : "계곡 물길과 떨어지는 물소리";
  const text =
    stage === 1
      ? `방향 단서: ${Math.floor(g.seed / 6) % 2 ? "남겨진 사진" : "등산화 흔적"}은 ${north ? "서쪽 숲·북쪽 능선" : "동쪽 바위·계곡"} 권역으로 이어집니다. 정확한 지점은 미확인. 제2전망대에서 환경 기록을 비교하세요.`
      : stage === 2
        ? `환경 단서: 마지막 ${Math.floor(g.seed / 6) % 2 ? "무전" : "사진"}의 환경은 ${pairText}입니다. 후보 ${possible.length}곳. 삼거리에서 구조 신호를 확인하세요.`
        : `결정적 단서: ${point(g.target, 1).name} 부근에서 신고 내용과 일치하는 배낭과 신호를 확인했습니다. 현장 수색이 필요합니다.`;
  return { stage, possible, text };
}
export const gameLimit = (g: Game) =>
  g.experience
    ? difficulties[g.experience.difficulty].limit
    : missions[g.mission].limit;
export function gameSchedule(
  g: Pick<Game, "experience" | "mission" | "seed">,
): { at: number; weather: Weather }[] {
  if (!g.experience) return schedule(g.mission, g.seed);
  const rain =
    difficulties[g.experience.difficulty].rain +
    (Math.floor(g.seed / 12) % 3) * 5 -
    (g.experience.frontAnnounced ? 15 : 0);
  return [
    { at: 0, weather: "cloudy" },
    { at: rain, weather: "rain" },
    { at: rain + 65, weather: "wind" },
    { at: rain + 115, weather: "cloudy" },
  ];
}
export const gameWeather = (g: Game, elapsed = g.elapsed): Weather =>
  gameSchedule(g)
    .filter((s) => s.at <= elapsed)
    .at(-1)!.weather;
export function gameForecast(g: Game) {
  const next = gameSchedule(g).find((p) => p.at > g.elapsed);
  return next
    ? `${next.at - g.elapsed}분 후 ${weatherInfo[next.weather].name} · ${weatherInfo[next.weather].detail}`
    : "추가 기상 변화 없음";
}
export const tension = (g: Game) =>
  g.found
    ? {
        stage: 4,
        title: "함께 돌아갈 시간",
        text: "발견은 시작입니다. 처치와 안전한 귀환을 완료하세요.",
      }
    : g.pending ||
        ["rain", "wind", "snow"].includes(gameWeather(g)) ||
        gameLimit(g) - g.elapsed < 60
      ? {
          stage: 3,
          title: "현장 판단의 순간",
          text: "남은 시간과 귀환 비용을 먼저 비교하세요.",
        }
      : g.clues.length
        ? {
            stage: 2,
            title: "흔적이 길이 됩니다",
            text: "새로운 단서를 지도 후보와 비교하세요.",
          }
        : {
            stage: 1,
            title: "한 사람의 안부",
            text: "첫 이동과 수색으로 마지막 흔적을 확인하세요.",
          };
export function nextStep(g: Game): { text: string; action: Action | null } {
  if (g.pending)
    return {
      text: "각 선택의 시간·체력 비용을 비교하고 현장 판단을 내려 주세요.",
      action: null,
    };
  if (g.found) {
    if (!g.treated)
      return {
        text: "기본 응급처치로 상태를 안정시키세요.",
        action: { type: "aid" },
      };
    if (
      g.casualtyType === "cold" &&
      !g.insulated &&
      g.equipment.includes("blanket")
    )
      return {
        text: "방한포를 덮어 귀환 중 추위를 줄이세요.",
        action: { type: "blanket" },
      };
    return {
      text: "본부까지의 길을 선택하세요. 부상자와 함께라면 이동 비용이 증가합니다.",
      action: null,
    };
  }
  if (g.experience) {
    const destination =
      g.possible.length === 1
        ? g.possible[0]
        : g.experience.clueStage === 0
          ? "gate"
          : g.experience.clueStage === 1
            ? "lookout"
            : "fork";
    if (g.position === destination && !g.searched.includes(destination))
      return {
        text: "이곳에서 주변 수색을 눌러 새 단서를 찾으세요.",
        action: { type: "search" },
      };
    if (adjacent(g.position, g.mission).includes(destination))
      return {
        text: `${point(destination, g.mission).name}로 이동해 흔적을 확인하세요.`,
        action: { type: "move", to: destination },
      };
    return {
      text: `${point(destination, g.mission).name}까지 연결된 등산로를 따라가세요.`,
      action: null,
    };
  }
  return {
    text: g.searched.includes(g.position)
      ? "단서와 연결된 길을 비교해 다음 구역을 선택하세요."
      : "이동 후 주변 수색으로 단서를 확인하세요.",
    action: g.searched.includes(g.position) ? null : { type: "search" },
  };
}
export function failureTip(g: Game) {
  if (g.reason.includes("중단"))
    return "철수도 판단입니다. 다음 출동에서는 장비를 바꾸고 안전한 길부터 확인해 보세요.";
  if (g.health <= 0)
    return g.casualtyType === "cold"
      ? "긴 수색 중 추위가 누적됐습니다. 방한포를 준비하고 발견 즉시 보온하세요."
      : "대상의 상태가 악화됐습니다. 단서로 수색을 줄이고 발견 후 처치·키트를 활용하세요.";
  if (g.found)
    return "대상 발견 뒤 귀환 시간이 부족했습니다. 동행 이동 배율을 계산하고 귀환 전 휴식·우회 비용을 비교하세요.";
  return g.experience
    ? "수색 시간이 길어졌습니다. 북쪽 등산로 → 전망대 → 삼거리의 단서 순서로 후보를 줄여 보세요."
    : "수색 시간이 길어졌습니다. 이미 얻은 단서와 신호를 비교해 후보를 좁히고, 예보를 보며 귀환 시간을 남겨 두세요.";
}
export type Feedback = {
  kind:
    | "move"
    | "clue"
    | "found"
    | "aid"
    | "risk"
    | "success"
    | "failure"
    | "radio";
  title: string;
  detail: string;
};
export function actionFeedback(before: Game, after: Game, a: Action): Feedback {
  const kind =
    after.status === "success"
      ? "success"
      : after.status === "failed"
        ? "failure"
        : !before.found && after.found
          ? "found"
          : after.pending && !before.pending
            ? "risk"
            : after.clues.length > before.clues.length
              ? "clue"
              : a.type === "aid" || a.type === "kit"
                ? "aid"
                : a.type === "move"
                  ? "move"
                  : "radio";
  const title = {
    move: "이동 완료",
    clue: "새로운 단서",
    found: "구조 신호 · 생존 확인",
    aid: "상태 안정화",
    risk: "현장 판단 필요",
    success: "구조 임무 완료",
    failure: "작전 종료",
    radio: "본부 무전",
  }[kind];
  return {
    kind,
    title,
    detail: `경과 +${after.elapsed - before.elapsed}분 · 체력 ${Math.round(after.stamina - before.stamina) >= 0 ? "+" : ""}${Math.round(after.stamina - before.stamina)}${after.found ? ` · 생존 ${Math.round(after.health - before.health) >= 0 ? "+" : ""}${Math.round(after.health - before.health)}` : ""}`,
  };
}
