import { decayHealth, singleSubject } from "./casualties";
import {
  forecast,
  missions,
  normalizeEquipment,
  weatherAt,
  weatherInfo,
  missionType,
} from "./conditions";
import type { CasualtyType, Equipment, MissionId } from "./conditions";
import {
  regionFor,
  point,
  connection,
  adjacent,
  graphDistance,
} from "./regions";
export { point, connection, adjacent } from "./regions";
export const points = regionFor(1).points;
export const edges = regionFor(1).edges;
export const candidates = regionFor(1).candidates;
import { normalizeSkills, zeroSkills } from "./progression";
import type { SkillLevels } from "./progression";
export type SignalReading = { location: string; strength: number };
export type Clue = { location: string; text: string };
export type Game = {
  seed: number;
  target: string;
  position: string;
  elapsed: number;
  stamina: number;
  health: number;
  found: boolean;
  treated: boolean;
  visited: string[];
  searched: string[];
  trail: string[];
  clues: Clue[];
  log: string[];
  status: "active" | "success" | "failed";
  reason: string;
  revision: number;
  mission: MissionId;
  equipment: Equipment[];
  kitUses: number;
  droneUses: number;
  insulated: boolean;
  runId: string;
  pending: Encounter | null;
  resolved: string[];
  injury: number;
  casualtyType: CasualtyType;
  skills: SkillLevels;
  practice: boolean;
  readings: SignalReading[];
  possible: string[];
  shelterSecured: boolean;
  lightSeen: boolean;
  routeReport: string[];
};
export type Action =
  | { type: "move"; to: string }
  | { type: "search" }
  | { type: "scan" }
  | { type: "shelter" }
  | { type: "wait" }
  | { type: "rest" }
  | { type: "aid" }
  | { type: "abandon" }
  | { type: "kit" }
  | { type: "blanket" }
  | { type: "drone" }
  | { type: "choose"; choice: string };
export type Cost = { time: number; energy: number };
export type Encounter = {
  kind: "river" | "ridge" | "signal" | "cold";
  key: string;
  to?: string;
};
export type Choice = {
  id: string;
  label: string;
  detail: string;
  cost: Cost;
  health?: number;
  requires?: Equipment;
  path?: string[];
  clue?: boolean;
  insulate?: boolean;
};
export const encounterInfo = {
  river: {
    title: "계곡의 급류",
    text: "불어난 물이 등산로를 가로막습니다. 로프로 확보하거나 실제 숲길과 나무다리를 거쳐 우회할 수 있습니다.",
  },
  ridge: {
    title: "위험한 능선",
    text: "강풍이 능선을 때리고 있습니다. 잠시 바람을 살핀 뒤 통과하거나, 숲길로 우회하거나, 빠르게 진행할 수 있습니다.",
  },
  signal: {
    title: "구조 신호 발견",
    text: "이정표 너머로 희미한 호루라기 소리가 들립니다. 소리의 방향을 확인할지 결정하십시오.",
  },
  cold: {
    title: "저체온 위험",
    text: "조난자가 추위에 떨고 있습니다. 방한포를 덮거나, 응급키트를 쓰거나, 간이 보온을 실시하십시오.",
  },
};
export function createGame(
  seed = Date.now(),
  mission: MissionId = 1,
  items: Equipment[] = ["kit", "blanket", "rope"],
  skills: SkillLevels = zeroSkills(),
  practice = false,
): Game {
  seed = seed >>> 0;
  return {
    seed,
    target: regionFor(mission).candidates[seed % 3],
    position: "base",
    elapsed: 0,
    stamina: 100,
    health: mission === 4 ? 80 : mission === 5 ? 90 : 85,
    found: false,
    treated: false,
    visited: ["base"],
    searched: [],
    trail: ["base"],
    clues: [],
    log: [
      `본부 기상 예보: ${forecast(mission, 0, seed)}`,
      `본부: ${regionFor(mission).briefing}`,
    ],
    status: "active",
    reason: "",
    revision: 0,
    mission,
    equipment: normalizeEquipment(items),
    kitUses: 0,
    droneUses: 0,
    insulated: false,
    pending: null,
    resolved: [],
    injury: mission === 2 || mission === 4 ? 0.03 : 0,
    casualtyType: missionType(mission),
    skills: normalizeSkills(skills),
    practice,
    readings: [],
    possible: [...regionFor(mission).candidates],
    shelterSecured: false,
    lightSeen: false,
    routeReport: [],
    runId: crypto.randomUUID(),
  };
}
export function actionCost(g: Game, a: Action): Cost {
  const weather = weatherAt(g.mission, g.elapsed, g.seed);
  if (a.type === "move") {
    const edge = connection(g.position, a.to, g.mission);
    const steep = edge?.steep;
    return {
      time: Math.ceil(
        Math.max(
          4,
          (edge?.time ?? (steep ? 20 : 10)) -
            (steep ? g.skills.mountain * 2 : 0),
        ) *
          (g.found ? (g.casualtyType === "injured" ? 1.5 : 1.2) : 1) *
          (weather === "snow" ? 1.3 : 1),
      ),
      energy: Math.ceil(
        Math.max(
          1,
          (edge?.energy ?? (steep ? 12 : 5)) -
            (steep && g.equipment.includes("rope") ? 4 : 0) -
            (steep ? g.skills.mountain : 0),
        ) *
          (g.found ? (g.casualtyType === "injured" ? 1.6 : 1.4) : 1) *
          (weather === "rain" ? 1.3 : 1),
      ),
    };
  }
  if (a.type === "search")
    return {
      time:
        15 -
        g.skills.search +
        (weather === "fog" ? 5 : 0) +
        (g.elapsed >= missions[g.mission].sunset &&
        !g.equipment.includes("lantern")
          ? 10
          : 0),
      energy: 7 - g.skills.search,
    };
  if (a.type === "rest") return { time: 20, energy: -15 };
  if (a.type === "scan") return { time: g.mission === 3 ? 8 : 6, energy: 2 };
  if (a.type === "shelter") return { time: 15, energy: -10 };
  if (a.type === "wait") return { time: 10, energy: 0 };
  if (a.type === "aid" || a.type === "kit") return { time: 10, energy: 3 };
  if (a.type === "blanket") return { time: 5, energy: 1 };
  if (a.type === "drone") return { time: 8, energy: 2 };
  if (a.type === "choose")
    return (
      choicesFor(g).find((c) => c.id === a.choice)?.cost ?? {
        time: 0,
        energy: 0,
      }
    );
  return { time: 0, energy: 0 };
}
function safePath(
  from: string,
  to: string,
  mission: MissionId,
): string[] | undefined {
  const queue = [{ at: from, path: [] as string[] }],
    seen = new Set([from]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.at === to) return current.path;
    for (const next of adjacent(current.at, mission)) {
      if (seen.has(next) || connection(current.at, next, mission)?.risk)
        continue;
      seen.add(next);
      queue.push({ at: next, path: [...current.path, next] });
    }
  }
}
function pathCost(g: Game, path: string[]): Cost {
  let temp = g;
  const cost = { time: 0, energy: 0 };
  for (const to of path) {
    const leg = actionCost(temp, { type: "move", to });
    cost.time += leg.time;
    cost.energy += leg.energy;
    temp = { ...temp, position: to, elapsed: temp.elapsed + leg.time };
  }
  return cost;
}
export function choicesFor(g: Game): Choice[] {
  const e = g.pending;
  if (!e) return [];
  if (e.kind === "signal")
    return [
      {
        id: "focus",
        label: "소리 방향 집중 수색",
        detail: "목적지를 가리키는 단서 확보",
        cost: { time: 10, energy: 4 },
        clue: true,
      },
      {
        id: "continue",
        label: "기존 수색 계획 유지",
        detail: "추가 시간 없이 이동 기록을 따라 진행",
        cost: { time: 0, energy: 0 },
      },
      {
        id: "drone",
        label: "드론으로 인근 조사",
        detail: "드론 1회 사용 · 2구간 이내 단서",
        cost: { time: 8, energy: 2 },
        requires: "drone",
        clue: true,
      },
    ];
  if (e.kind === "cold")
    return [
      {
        id: "blanket",
        label: "방한포로 보온",
        detail: "이후 추위·야간 악화 55% 감소",
        cost: { time: 5, energy: 1 },
        requires: "blanket",
        insulate: true,
      },
      {
        id: "kit",
        label: "응급키트 사용",
        detail: "생존 상태 +25 · 키트 1회 사용",
        cost: { time: 10, energy: 3 },
        requires: "kit",
        health: 25,
      },
      {
        id: "warm",
        label: "바람을 막고 간이 보온",
        detail: "생존 상태 +8 · 장비 없이 대응",
        cost: { time: 12, energy: 5 },
        health: 8,
      },
    ];
  const base = actionCost(g, { type: "move", to: e.to! }),
    path = safePath(g.position, e.to!, g.mission);
  const detour: Choice[] = path
    ? [
        {
          id: "detour",
          label: "안전한 숲길 우회",
          detail: path.map((id) => point(id, g.mission).name).join(" · "),
          cost: pathCost(g, path),
          path,
        },
      ]
    : [];
  if (e.kind === "river")
    return [
      ...detour,
      {
        id: "rope",
        label: "로프로 급류 통과",
        detail: "확보 후 통과 · 이동 비용 포함",
        cost: { time: base.time + 5, energy: base.energy + 3 },
        requires: "rope",
        path: [e.to!],
      },
    ];
  return [
    {
      id: "wait",
      label: "풍향을 살피며 대기 후 통과",
      detail: "추가 20분을 써서 직접적인 부상을 피합니다.",
      cost: { time: base.time + 20, energy: base.energy },
      path: [e.to!],
    },
    ...detour,
    {
      id: "risk",
      label: "위험을 감수하고 진행",
      detail: g.found
        ? "동행 조난자 상태 −8 · 이동 비용 포함"
        : "구조대원 추가 체력 −10 · 이동 비용 포함",
      cost: { time: base.time, energy: base.energy + 10 },
      health: g.found ? -8 : 0,
      path: [e.to!],
    },
  ];
}
export function choiceDisabled(g: Game, c: Choice): string {
  if (c.requires && !g.equipment.includes(c.requires)) return "필요 장비 없음";
  if (c.id === "kit" && g.kitUses >= 2) return "응급키트 소진";
  if (
    c.id === "drone" &&
    (g.droneUses >= 2 || weatherAt(g.mission, g.elapsed, g.seed) === "wind")
  )
    return "드론 소진 또는 강풍으로 비행 불가";
  if (g.stamina < c.cost.energy)
    return "체력이 부족합니다. 경로 선택을 취소하고 휴식하세요.";
  return "";
}
export function disabledReason(g: Game, a: Action): string {
  if (g.status !== "active") return "종료된 임무입니다.";
  if (g.pending && a.type !== "choose" && a.type !== "abandon")
    return "먼저 상황에 대응하세요.";
  if (a.type === "choose") {
    if (a.choice === "cancel" && g.pending?.to) return "";
    const c = choicesFor(g).find((c) => c.id === a.choice);
    return c ? choiceDisabled(g, c) : "선택할 수 없는 대응입니다.";
  }
  if (a.type === "move" && !connection(g.position, a.to, g.mission))
    return "연결된 등산로로만 이동할 수 있습니다.";
  if (
    a.type === "move" &&
    g.casualtyType === "injured" &&
    g.found &&
    !g.treated
  )
    return "다친 조난자를 기본 응급처치한 뒤 이동하세요.";
  if (
    a.type === "move" &&
    connection(g.position, a.to, g.mission)?.ropeOnlyInWind &&
    weatherAt(g.mission, g.elapsed, g.seed) === "wind" &&
    !g.equipment.includes("rope")
  )
    return "강풍으로 통행 제한: 구조 로프를 준비하거나 안전한 우회로를 선택하세요.";
  if (a.type === "scan") {
    if (g.mission !== 3 && g.mission !== 5)
      return "이 임무에는 신호 분석이 없습니다.";
    if (g.found) return "이미 조난자를 발견했습니다.";
    if (g.readings.some((r) => r.location === g.position))
      return "이 지점은 분석했습니다. 다른 위치의 신호와 비교하세요.";
    if (g.mission === 5 && !lightActive(g))
      return "지금은 불빛이 보이지 않습니다. 일몰 이후 15분씩 점멸합니다. 10분 대기하거나 이동하세요.";
  }
  if (
    a.type === "shelter" &&
    (g.mission !== 5 ||
      !g.found ||
      point(g.position, g.mission).kind !== "shelter" ||
      g.shelterSecured)
  )
    return "조난자와 대피소에 도착하면 한 번 보온 정비할 수 있습니다.";
  if (a.type === "search" && g.searched.includes(g.position))
    return "이미 수색을 마쳤습니다.";
  if (a.type === "aid" && (!g.found || g.treated))
    return "조난자 발견 후 한 번 응급처치할 수 있습니다.";
  if (a.type === "rest" && g.stamina === 100) return "체력이 충분합니다.";
  if (
    a.type === "kit" &&
    (!g.found || !g.equipment.includes("kit") || g.kitUses >= 2)
  )
    return "발견 후 응급키트를 최대 2회 사용할 수 있습니다.";
  if (
    a.type === "blanket" &&
    (!g.found || !g.equipment.includes("blanket") || g.insulated)
  )
    return "발견 후 방한포를 한 번 사용할 수 있습니다.";
  if (
    a.type === "drone" &&
    (!g.equipment.includes("drone") ||
      g.droneUses >= 2 ||
      weatherAt(g.mission, g.elapsed, g.seed) === "wind" ||
      g.found)
  )
    return "발견 전 2회 사용 가능하며 강풍에서는 비행할 수 없습니다.";
  if (g.stamina < actionCost(g, a).energy)
    return "체력이 부족합니다. 휴식 후 이동하거나 임무를 중단하세요.";
  return "";
}
// Every timed action uses this single integration point, including weather boundaries.
export function advance(g: Game, cost: Cost): Game {
  const subject = singleSubject(g);
  let health = subject.health;
  for (let i = 0; i < cost.time; i++) {
    health = decayHealth(
      health,
      0.18 + g.injury,
      weatherAt(g.mission, g.elapsed + i, g.seed),
      g.elapsed + i >= missions[g.mission].sunset,
      subject.insulated,
      subject.type === "cold",
    );
  }
  return {
    ...g,
    elapsed: g.elapsed + cost.time,
    stamina: Math.min(100, Math.max(0, g.stamina - cost.energy)),
    health,
    revision: g.revision + 1,
  };
}
export const lightActive = (g: Game) =>
  g.mission === 5 &&
  g.elapsed >= missions[5].sunset &&
  Math.floor(g.elapsed / 15) % 2 === 0;
export const signalStrength = (
  from: string,
  target: string,
  mission: MissionId,
) => Math.max(0, 100 - graphDistance(from, target, mission) * 15);
export function signalDirection(g: Game): string {
  if (!lightActive(g) || g.found) return "";
  const from = point(g.position, g.mission),
    target = point(g.target, g.mission);
  return (
    `${Math.abs(target.y - from.y) > 40 ? (target.y < from.y ? "북" : "남") : ""}${Math.abs(target.x - from.x) > 40 ? (target.x < from.x ? "서" : "동") : ""}` ||
    "현재 위치"
  );
}
export const moveHealthCost = (g: Game, to: string) =>
  g.found && g.mission === 4 && connection(g.position, to, g.mission)?.risk
    ? g.equipment.includes("rope")
      ? 0
      : 6
    : 0;
const rescueReady = (g: Game) =>
  g.position === "base" && g.found && (g.mission !== 5 || g.shelterSecured);
function droneClue(g: Game): string {
  const nearby = new Set([
    g.position,
    ...adjacent(g.position, g.mission),
    ...adjacent(g.position, g.mission).flatMap((id) => adjacent(id, g.mission)),
  ]);
  return nearby.has(g.target)
    ? `드론 열원 탐지: ${point(g.target, g.mission).name}에서 사람의 흔적을 확인했습니다. 현장 수색이 필요합니다.`
    : "드론 수색 범위(2구간) 내 열원이 없습니다. 제2전망대의 이동 기록을 확인하세요.";
}
export function transition(
  g: Game,
  a: Action,
  expectedRevision = g.revision,
): Game {
  if (expectedRevision !== g.revision || disabledReason(g, a)) return g;
  if (a.type === "abandon")
    return {
      ...g,
      status: "failed",
      reason: "구조대 안전을 위해 임무를 중단했습니다.",
      revision: g.revision + 1,
    };
  if (a.type === "choose" && a.choice === "cancel")
    return { ...g, pending: null, revision: g.revision + 1 };
  if (a.type === "move" && g.mission === 2) {
    const risk = connection(g.position, a.to, g.mission)?.risk,
      weather = weatherAt(g.mission, g.elapsed, g.seed);
    const key = `${g.position}>${a.to}:${risk}`;
    if (
      ((risk === "river" && weather === "rain") ||
        (risk === "ridge" && weather === "wind")) &&
      !g.resolved.includes(key)
    )
      return {
        ...g,
        pending: { kind: risk!, key, to: a.to },
        revision: g.revision + 1,
      };
  }
  const cost = actionCost(g, a);
  const n = advance(g, cost);
  let message = "";
  if (a.type === "move") {
    n.position = a.to;
    n.visited = [...new Set([...g.visited, a.to])];
    n.trail = [...g.trail, a.to];
    message = `${point(a.to, g.mission).name} 도착. ${cost.time}분 경과, 체력 ${cost.energy} 소모.`;
    const damage = moveHealthCost(g, a.to);
    n.health = Math.max(0, n.health - damage);
    if (g.mission === 4) {
      const risky = !!connection(g.position, a.to, g.mission)?.risk;
      n.routeReport = [
        ...g.routeReport,
        `${risky ? "노출 암릉" : "안전 경로"}: ${point(g.position, g.mission).name} → ${point(a.to, g.mission).name}${damage ? ` · 조난자 상태 −${damage}` : ""}`,
      ];
      if (damage) message += ` 부상자 상태 ${damage} 감소.`;
    }
  }
  if (a.type === "search") {
    n.searched = [...g.searched, g.position];
    if (g.position === g.target) {
      n.found = true;
      message =
        "본부, 여기는 구조 1팀. 실종자 발견! 생존 확인, 응급처치를 시작하겠습니다.";
    } else if (g.mission >= 3) {
      let text = "새로운 흔적은 없습니다. 수신 기록과 후보 구역을 비교하세요.";
      if (g.mission === 3) {
        if (g.position === regionFor(g.mission).initialHint)
          text =
            "서쪽 메아리 바위 방향에 오래된 발자국. 신고 시각과 일치하지 않아 조난자의 흔적인지는 미확인입니다. 무전 신호를 두 지점 이상 비교하세요.";
        else if (g.position === "echo")
          text =
            "발자국은 오래된 순찰 흔적으로 확인되었습니다. 이 흔적만으로 수색 방향을 정하지 말고 무전 신호를 비교하세요.";
        else if (g.position === "fork") {
          const terrain =
            g.target === "stream"
              ? "흐르는 물"
              : g.target === "grove"
                ? "넓은 이끼 암반"
                : "움푹한 북쪽 골짜기";
          text = `재수신된 무전: 주변에 ${terrain}이 보인다고 합니다. 지형과 신호를 함께 비교하세요.`;
        }
      } else if (g.mission === 4 && g.position === "lookout")
        text = `신고 좌표 확인: ${point(g.target, g.mission).name}. 부상으로 이동이 어렵습니다. 응급처치와 안전한 귀환 경로를 준비하세요.`;
      else if (g.mission === 5 && g.position === "hut") {
        const excluded = regionFor(5).candidates[((g.seed % 3) + 1) % 3];
        n.possible = g.possible.filter((id) => id !== excluded);
        text = `숙박 기록 확인: ${point(excluded, 5).name}은 순찰을 마쳤습니다. 남은 두 후보에서 간헐적인 불빛을 확인하세요. 대피소 불빛이 귀환의 기준점입니다.`;
      }
      n.clues = [...g.clues, { location: g.position, text }];
      message = text;
    } else {
      const text =
        g.position === "lookout"
          ? `떨어진 물병과 이동 기록 발견. 삼거리 이정표에서 ${point(g.target, g.mission).name} 방향으로 향했습니다.`
          : g.position === "fork"
            ? `등산화 발자국과 배낭을 확인했습니다. ${point(g.target, g.mission).name}에서 수색하십시오.`
            : g.position === "gate"
              ? "마지막 목격 정보: 제2전망대로 향하는 등산객을 봤습니다."
              : adjacent(g.position, g.mission).includes(g.target)
                ? `가까운 ${point(g.target, g.mission).name} 쪽에서 희미한 구조 신호가 들립니다.`
                : "주변 수색 완료. 새로운 흔적이 없습니다. 마지막 목격 장소의 단서를 확인하세요.";
      if (!text.startsWith("주변"))
        n.clues = [...g.clues, { location: g.position, text }];
      message = text;
    }
  }
  if (a.type === "rest")
    message = `20분 휴식. 체력 ${n.stamina - g.stamina} 회복.`;
  if (a.type === "wait")
    message = "10분 대기. 기상과 구조 신호의 변화를 확인하십시오.";
  if (a.type === "scan") {
    const strength = signalStrength(g.position, g.target, g.mission);
    n.readings = [...g.readings, { location: g.position, strength }];
    n.possible = g.possible.filter(
      (id) => signalStrength(g.position, id, g.mission) === strength,
    );
    n.lightSeen = g.mission === 5 || g.lightSeen;
    const text = `${g.mission === 3 ? "무전" : "불빛"} 신호 ${strength}/100. ${n.readings.length}개 지점 비교: 후보 ${n.possible.length}곳. ${n.possible.map((id) => point(id, g.mission).name).join(" · ")}`;
    n.clues = [...g.clues, { location: g.position, text }];
    message = text;
  }
  if (a.type === "shelter") {
    n.shelterSecured = true;
    n.insulated = true;
    if (n.health > 0) n.health = Math.min(100, n.health + 12);
    message =
      "대피소 보온 정비 완료. 상태 최대 12·체력 최대 10 회복. 귀환 경로를 확보했습니다.";
    n.routeReport = [
      ...n.routeReport,
      `${point(g.position, g.mission).name} 보온 후 본부 귀환`,
    ];
  }
  if (a.type === "aid") {
    n.treated = true;
    n.injury = 0;
    if (n.health > 0)
      n.health = Math.min(100, n.health + 22 + g.skills.response * 3);
    message = `기본 응급처치 완료. 상태 최대 ${22 + g.skills.response * 3} 회복, 부상 악화 완화. 귀환 목표를 확인하십시오.`;
  }
  if (a.type === "kit") {
    n.kitUses++;
    if (n.health > 0) n.health = Math.min(100, n.health + 25);
    message = "응급키트 사용. 조난자 상태 최대 25 회복.";
  }
  if (a.type === "blanket") {
    n.insulated = true;
    message = "방한포를 덮었습니다. 이후 추위·야간 악화 55% 감소.";
  }
  if (a.type === "drone") {
    n.droneUses++;
    const text = droneClue(g);
    n.clues = [...n.clues, { location: g.position, text }];
    message = text;
  }
  if (a.type === "choose") {
    const c = choicesFor(g).find((c) => c.id === a.choice)!;
    n.pending = null;
    n.resolved = [...g.resolved, g.pending!.key];
    n.routeReport = [...g.routeReport, c.label];
    if (c.path) {
      n.position = c.path.at(-1)!;
      n.visited = [...new Set([...g.visited, ...c.path])];
      n.trail = [...g.trail, ...c.path];
    }
    if (c.health && n.health > 0)
      n.health = Math.max(0, Math.min(100, n.health + c.health));
    if (c.insulate) n.insulated = true;
    if (c.id === "kit") n.kitUses++;
    if (c.id === "drone") n.droneUses++;
    if (c.clue) {
      const text =
        c.id === "drone"
          ? droneClue(g)
          : `구조 신호 방향 확인: ${point(g.target, g.mission).name}에서 호루라기 소리가 납니다.`;
      n.clues = [...n.clues, { location: g.position, text }];
    }
    message = `${c.label}. ${cost.time}분 경과, 체력 ${cost.energy} 소모.${c.health ? ` 생존 상태 ${c.health > 0 ? "+" : ""}${c.health}.` : ""}${c.clue ? " 새 단서를 확인하세요." : ""}`;
  }
  if (
    n.elapsed > missions[n.mission].limit ||
    n.health <= 0 ||
    (n.elapsed === missions[n.mission].limit && !rescueReady(n))
  ) {
    n.status = "failed";
    n.reason =
      n.health <= 0
        ? "조난자의 생존 상태가 0에 도달했습니다."
        : "구조 제한 시간이 지났습니다.";
  } else if (rescueReady(n)) {
    n.status = "success";
    n.reason =
      n.mission === 3
        ? "안개 속 신호가 한 사람의 귀환으로 이어졌습니다."
        : n.mission === 4
          ? "험한 암릉을 넘어, 부상자와 전원 무사 귀환."
          : n.mission === 5
            ? "마지막 불빛을 놓치지 않았습니다. 따뜻한 본부로 귀환 완료."
            : "전원 무사 귀환. 오늘, 한 사람의 내일을 지켰습니다.";
  }
  if (n.status === "active" && n.mission === 2 && !n.pending) {
    if (
      n.found &&
      !n.insulated &&
      n.elapsed >= 70 &&
      !n.resolved.includes("cold")
    )
      n.pending = { kind: "cold", key: "cold" };
    else if (
      n.position === "fork" &&
      !n.found &&
      !n.resolved.includes("signal")
    )
      n.pending = { kind: "signal", key: "signal" };
  }
  const beforeWeather = weatherAt(g.mission, g.elapsed, g.seed),
    afterWeather = weatherAt(n.mission, n.elapsed, n.seed);
  const weatherLog =
    beforeWeather !== afterWeather
      ? [
          `본부: ${weatherInfo[afterWeather].name} 관측. ${forecast(n.mission, n.elapsed, n.seed)}`,
        ]
      : [];
  n.log = [message, ...weatherLog, ...g.log].slice(0, 30);
  return n;
}
export const stars = (g: Game): number => {
  if (g.status !== "success") return 1;
  if (g.mission === 3)
    return g.readings.length >= 2 && g.possible.length === 1 && g.health >= 55
      ? 3
      : g.readings.length >= 1 && g.health >= 35
        ? 2
        : 1;
  if (g.mission === 4)
    return g.treated &&
      !g.routeReport.some((r) => r.includes("감수") || r.includes("상태 −")) &&
      g.health >= 60
      ? 3
      : g.health >= 35
        ? 2
        : 1;
  if (g.mission === 5)
    return g.lightSeen && g.shelterSecured && g.health >= 55
      ? 3
      : g.health >= 35
        ? 2
        : 1;
  return g.health >= 65 && g.elapsed <= missions[g.mission].limit * 0.9
    ? 3
    : g.health >= 40
      ? 2
      : 1;
};
export const earnedXp = (g: Game) =>
  g.status === "success" && !g.practice ? 100 + stars(g) * 25 : 0;
export const healthLabel = (health: number) =>
  health >= 80
    ? "안정"
    : health >= 50
      ? "주의"
      : health >= 20
        ? "위험"
        : health > 0
          ? "위급"
          : "구조 실패";
export const objective = (g: Game): string => {
  if (g.found) {
    if (!g.treated) return "응급처치로 조난자를 안정시키세요.";
    if (g.mission === 5 && !g.shelterSecured)
      return "대피소에서 보온 정비 후 구조본부로 귀환하세요.";
    return "조난자와 함께 구조본부로 귀환하세요.";
  }
  if ((g.mission === 3 || g.mission === 5) && g.possible.length === 1)
    return point(g.possible[0], g.mission).name + "에서 주변을 수색하세요.";
  if (g.mission === 3)
    return g.readings.length < 2
      ? "서로 다른 두 지점에서 무전 신호를 분석하세요."
      : "다른 방향에서 신호를 비교해 남은 후보를 좁히세요.";
  if (g.mission === 5)
    return g.searched.includes("hut")
      ? "불빛이 켜질 때 신호를 관측해 후보를 좁히세요."
      : "첫빛 대피소에서 기록을 수색하세요.";
  if (g.clues.some((c) => c.text.includes(point(g.target, g.mission).name)))
    return point(g.target, g.mission).name + "에 도착해 주변을 수색하세요.";
  return regionFor(g.mission).briefing;
};
