import {
  forecast,
  missions,
  normalizeEquipment,
  weatherAt,
  weatherInfo,
} from "./conditions";
import type { Equipment, MissionId } from "./conditions";
export type Point = {
  id: string;
  name: string;
  x: number;
  y: number;
  elevation: number;
  kind?: "base" | "shelter" | "lookout" | "cliff";
};
export const points: Point[] = [
  {
    id: "base",
    name: "구조본부",
    x: 175,
    y: 665,
    elevation: 320,
    kind: "base",
  },
  { id: "gate", name: "북쪽 등산로", x: 290, y: 575, elevation: 410 },
  {
    id: "lookout",
    name: "제2전망대",
    x: 420,
    y: 475,
    elevation: 580,
    kind: "lookout",
  },
  { id: "fork", name: "삼거리 이정표", x: 535, y: 370, elevation: 650 },
  {
    id: "cedar",
    name: "전나무 쉼터",
    x: 375,
    y: 290,
    elevation: 690,
    kind: "shelter",
  },
  { id: "valley", name: "물소리 계곡", x: 670, y: 465, elevation: 520 },
  {
    id: "cave",
    name: "바위 그늘",
    x: 710,
    y: 265,
    elevation: 740,
    kind: "cliff",
  },
  { id: "west", name: "서쪽 숲길", x: 150, y: 465, elevation: 460 },
  { id: "spring", name: "옹달샘", x: 235, y: 345, elevation: 530 },
  {
    id: "hut",
    name: "백운 대피소",
    x: 210,
    y: 225,
    elevation: 640,
    kind: "shelter",
  },
  {
    id: "ridge",
    name: "칼바람 능선",
    x: 525,
    y: 190,
    elevation: 890,
    kind: "cliff",
  },
  {
    id: "summit",
    name: "백운산 정상",
    x: 650,
    y: 95,
    elevation: 1087,
    kind: "lookout",
  },
  {
    id: "east",
    name: "동쪽 암릉",
    x: 835,
    y: 170,
    elevation: 920,
    kind: "cliff",
  },
  { id: "bridge", name: "계곡 나무다리", x: 770, y: 590, elevation: 400 },
  { id: "pine", name: "소나무 숲", x: 525, y: 620, elevation: 400 },
  { id: "lower", name: "하부 탐방로", x: 375, y: 705, elevation: 340 },
  { id: "waterfall", name: "작은 폭포", x: 855, y: 405, elevation: 500 },
];
export type Edge = {
  a: string;
  b: string;
  steep?: boolean;
  risk?: "river" | "ridge";
};
export const edges: Edge[] = [
  { a: "base", b: "gate" },
  { a: "gate", b: "lookout" },
  { a: "lookout", b: "fork" },
  { a: "fork", b: "cedar" },
  { a: "fork", b: "valley", risk: "river" },
  { a: "fork", b: "cave", risk: "ridge" },
  { a: "base", b: "west" },
  { a: "west", b: "spring" },
  { a: "spring", b: "hut" },
  { a: "hut", b: "cedar" },
  { a: "spring", b: "lookout" },
  { a: "cedar", b: "ridge", steep: true, risk: "ridge" },
  { a: "ridge", b: "summit", steep: true, risk: "ridge" },
  { a: "summit", b: "east", steep: true, risk: "ridge" },
  { a: "east", b: "cave", steep: true },
  { a: "base", b: "lower" },
  { a: "lower", b: "pine" },
  { a: "pine", b: "lookout" },
  { a: "pine", b: "bridge" },
  { a: "bridge", b: "valley" },
  { a: "valley", b: "waterfall" },
  { a: "waterfall", b: "cave" },
];
export const candidates = ["cedar", "valley", "cave"];
export const point = (id: string) => points.find((p) => p.id === id)!;
export const connection = (a: string, b: string) =>
  edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
export const adjacent = (id: string) =>
  edges
    .filter((e) => e.a === id || e.b === id)
    .map((e) => (e.a === id ? e.b : e.a));
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
};
export type Action =
  | { type: "move"; to: string }
  | { type: "search" }
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
): Game {
  seed = seed >>> 0;
  return {
    seed,
    target: candidates[(seed >>> 0) % 3],
    position: "base",
    elapsed: 0,
    stamina: 100,
    health: 85,
    found: false,
    treated: false,
    visited: ["base"],
    searched: [],
    trail: ["base"],
    clues: [],
    log: [
      `본부 기상 예보: ${forecast(mission, 0)}`,
      "본부: 제2전망대가 마지막 목격 장소입니다. 북쪽 등산로를 따라 이동하십시오.",
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
    injury: mission === 2 ? 0.03 : 0,
    runId: crypto.randomUUID(),
  };
}
export function actionCost(g: Game, a: Action): Cost {
  const weather = weatherAt(g.mission, g.elapsed);
  if (a.type === "move") {
    const steep = connection(g.position, a.to)?.steep;
    return {
      time: Math.ceil(
        (steep ? 20 : 10) *
          (g.found ? 1.2 : 1) *
          (weather === "snow" ? 1.3 : 1),
      ),
      energy: Math.ceil(
        ((steep ? 12 : 5) - (steep && g.equipment.includes("rope") ? 4 : 0)) *
          (g.found ? 1.4 : 1) *
          (weather === "rain" ? 1.3 : 1),
      ),
    };
  }
  if (a.type === "search")
    return {
      time:
        15 +
        (weather === "fog" ? 5 : 0) +
        (g.elapsed >= missions[g.mission].sunset &&
        !g.equipment.includes("lantern")
          ? 10
          : 0),
      energy: 7,
    };
  if (a.type === "rest") return { time: 20, energy: -15 };
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
function safePath(from: string, to: string): string[] | undefined {
  const queue = [{ at: from, path: [] as string[] }],
    seen = new Set([from]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.at === to) return current.path;
    for (const next of adjacent(current.at)) {
      if (seen.has(next) || connection(current.at, next)?.risk) continue;
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
    path = safePath(g.position, e.to!);
  const detour: Choice[] = path
    ? [
        {
          id: "detour",
          label: "안전한 숲길 우회",
          detail: path.map((id) => point(id).name).join(" · "),
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
    (g.droneUses >= 2 || weatherAt(g.mission, g.elapsed) === "wind")
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
  if (a.type === "move" && !connection(g.position, a.to))
    return "연결된 등산로로만 이동할 수 있습니다.";
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
      weatherAt(g.mission, g.elapsed) === "wind" ||
      g.found)
  )
    return "발견 전 2회 사용 가능하며 강풍에서는 비행할 수 없습니다.";
  if (g.stamina < actionCost(g, a).energy)
    return "체력이 부족합니다. 휴식 후 이동하거나 임무를 중단하세요.";
  return "";
}
// Every timed action uses this single integration point, including weather boundaries.
export function advance(g: Game, cost: Cost): Game {
  let loss = 0;
  for (let i = 0; i < cost.time; i++) {
    const weather = weatherAt(g.mission, g.elapsed + i);
    const exposure =
      (weather === "snow"
        ? 0.18
        : weather === "rain"
          ? 0.1
          : weather === "wind"
            ? 0.06
            : 0) + (g.elapsed + i >= missions[g.mission].sunset ? 0.06 : 0);
    loss += 0.18 + g.injury + exposure * (g.insulated ? 0.45 : 1);
  }
  return {
    ...g,
    elapsed: g.elapsed + cost.time,
    stamina: Math.min(100, Math.max(0, g.stamina - cost.energy)),
    health: Math.max(0, g.health - loss),
    revision: g.revision + 1,
  };
}
function droneClue(g: Game): string {
  const nearby = new Set([
    g.position,
    ...adjacent(g.position),
    ...adjacent(g.position).flatMap(adjacent),
  ]);
  return nearby.has(g.target)
    ? `드론 열원 탐지: ${point(g.target).name}에서 사람의 흔적을 확인했습니다. 현장 수색이 필요합니다.`
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
    const risk = connection(g.position, a.to)?.risk,
      weather = weatherAt(g.mission, g.elapsed);
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
    message = `${point(a.to).name} 도착. ${cost.time}분 경과, 체력 ${cost.energy} 소모.`;
  }
  if (a.type === "search") {
    n.searched = [...g.searched, g.position];
    if (g.position === g.target) {
      n.found = true;
      message =
        "본부, 여기는 구조 1팀. 실종자 발견! 생존 확인, 응급처치를 시작하겠습니다.";
    } else {
      const text =
        g.position === "lookout"
          ? `떨어진 물병과 이동 기록 발견. 삼거리 이정표에서 ${point(g.target).name} 방향으로 향했습니다.`
          : g.position === "fork"
            ? `등산화 발자국과 배낭을 확인했습니다. ${point(g.target).name}에서 수색하십시오.`
            : g.position === "gate"
              ? "마지막 목격 정보: 제2전망대로 향하는 등산객을 봤습니다."
              : adjacent(g.position).includes(g.target)
                ? `가까운 ${point(g.target).name} 쪽에서 희미한 구조 신호가 들립니다.`
                : "주변 수색 완료. 새로운 흔적이 없습니다. 마지막 목격 장소의 단서를 확인하세요.";
      if (!text.startsWith("주변"))
        n.clues = [...g.clues, { location: g.position, text }];
      message = text;
    }
  }
  if (a.type === "rest")
    message = `20분 휴식. 체력 ${n.stamina - g.stamina} 회복.`;
  if (a.type === "aid") {
    n.treated = true;
    n.injury = 0;
    if (n.health > 0) n.health = Math.min(100, n.health + 22);
    message =
      "기본 응급처치 완료. 상태 최대 22 회복, 부상 악화 완화. 구조본부로 귀환하십시오.";
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
          : `구조 신호 방향 확인: ${point(g.target).name}에서 호루라기 소리가 납니다.`;
      n.clues = [...n.clues, { location: g.position, text }];
    }
    message = `${c.label}. ${cost.time}분 경과, 체력 ${cost.energy} 소모.${c.health ? ` 생존 상태 ${c.health > 0 ? "+" : ""}${c.health}.` : ""}${c.clue ? " 새 단서를 확인하세요." : ""}`;
  }
  if (
    n.elapsed > missions[n.mission].limit ||
    n.health <= 0 ||
    (n.elapsed === missions[n.mission].limit &&
      !(n.position === "base" && n.found))
  ) {
    n.status = "failed";
    n.reason =
      n.health <= 0
        ? "조난자의 생존 상태가 0에 도달했습니다."
        : "구조 제한 시간이 지났습니다.";
  } else if (n.position === "base" && n.found) {
    n.status = "success";
    n.reason = "전원 무사 귀환. 오늘, 한 사람의 내일을 지켰습니다.";
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
  const beforeWeather = weatherAt(g.mission, g.elapsed),
    afterWeather = weatherAt(n.mission, n.elapsed);
  const weatherLog =
    beforeWeather !== afterWeather
      ? [
          `본부: ${weatherInfo[afterWeather].name} 관측. ${forecast(n.mission, n.elapsed)}`,
        ]
      : [];
  n.log = [message, ...weatherLog, ...g.log].slice(0, 30);
  return n;
}
export const stars = (g: Game) =>
  g.status !== "success"
    ? 1
    : g.health >= 65 && g.elapsed <= missions[g.mission].limit * 0.9
      ? 3
      : g.health >= 40
        ? 2
        : 1;
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
export const objective = (g: Game) =>
  g.found
    ? g.treated
      ? "조난자와 함께 구조본부로 귀환하세요."
      : "응급처치로 조난자를 안정시키세요."
    : g.clues.some((c) => c.text.includes(point(g.target).name))
      ? `${point(g.target).name}에 도착해 주변을 수색하세요.`
      : "북쪽 등산로를 따라 제2전망대에서 수색하세요.";
