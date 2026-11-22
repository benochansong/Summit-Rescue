import { createGame, type Game, type Cost } from "./game";
import { adjacent, connection, point, regionFor } from "./regions";
import { decayHealth } from "./casualties";
import type { Equipment } from "./conditions";
import type { SkillLevels } from "./progression";
import type { Difficulty } from "./experience";
import {
  disasterCandidates,
  disasterProfiles,
  disasterSchedule,
  disasterTimes,
  landingSites,
  type Scene,
} from "./disasterData";
export type RescueActionKind = "signal" | "rope" | "carry";
export type ActionSession = {
  kind: RescueActionKind;
  round: number;
  mistakes: number;
  careful: number;
};
export type DisasterGame = Game & {
  difficulty: Difficulty;
  events: string[];
  scenes: Scene[];
  secured: boolean;
  carried: boolean;
  analyzed: boolean;
  cleared: string[];
  reopened: Record<string, number>;
  action: ActionSession | null;
  helicopter: { at: number; origin: string } | null;
  heliUses: number;
  evacuated: boolean;
  detours: number;
  crossings: number;
};
export type DisasterAction =
  | { type: "move"; to: string }
  | {
      type:
        | "search"
        | "rest"
        | "aid"
        | "kit"
        | "blanket"
        | "ack"
        | "abandon"
        | "helicopter";
    }
  | { type: "mitigate"; to: string; method: "rope" | "wait" }
  | { type: "start"; kind: RescueActionKind }
  | { type: "auto" }
  | { type: "signal"; angle: number }
  | { type: "rope"; value: number }
  | { type: "carry"; lane: number; speed: "careful" | "steady" };
export const edgeKey = (a: string, b: string) => [a, b].sort().join("~");
export function createDisaster(
  seed = Date.now(),
  difficulty: Difficulty = "normal",
  items: Equipment[] = ["rope", "kit", "blanket"],
  skills?: SkillLevels,
  practice = false,
): DisasterGame {
  const g = createGame(seed, 7, items, skills, practice);
  return {
    ...g,
    target: disasterCandidates[g.seed % 3],
    possible: [...disasterCandidates],
    health: 100,
    casualtyType: "injured",
    injury: 0.02,
    difficulty,
    events: [],
    scenes: ["dispatch"],
    secured: false,
    carried: false,
    analyzed: false,
    cleared: [],
    reopened: {},
    action: null,
    helicopter: null,
    heliUses: 0,
    evacuated: false,
    detours: 0,
    crossings: 0,
    log: [
      "이재하 · 34세 · 북쪽 암릉에서 다리 부상. 제2전망대에서 신호 방향을 분석하십시오.",
    ],
  };
}
export const disasterWeather = (g: DisasterGame, at = g.elapsed) =>
  disasterSchedule(g.difficulty, g.seed)
    .filter((p) => p.at <= at)
    .at(-1)!.weather;
export function edgeState(
  g: DisasterGame,
  a: string,
  b: string,
): "open" | "warning" | "blocked" | "restricted" {
  const k = edgeKey(a, b),
    t = disasterTimes(g.difficulty, g.seed);
  if (g.cleared.includes(k) || (g.reopened[k] ?? -1) > g.elapsed) return "open";
  if (k === edgeKey("fork", "cave"))
    return g.elapsed >= t.rock
      ? "blocked"
      : g.elapsed >= t.rockWarning
        ? "warning"
        : "open";
  if ([edgeKey("fork", "valley"), edgeKey("bridge", "valley")].includes(k))
    return g.elapsed >= t.flood
      ? g.elapsed < t.flood + 45
        ? "restricted"
        : "warning"
      : g.elapsed >= t.floodWarning
        ? "warning"
        : "open";
  return "open";
}
export const passable = (g: DisasterGame, a: string, b: string) =>
  !!connection(a, b, 7) &&
  !["blocked", "restricted"].includes(edgeState(g, a, b));
// Public, connected alternative only; never uses the hidden casualty position.
export function safeRoute(
  g: DisasterGame,
  from: string,
  to: string,
): string[] | null {
  const queue = [{ path: [from], cost: 0 }],
    seen = new Set<string>();
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const entry = queue.shift()!,
      p = entry.path,
      at = p.at(-1)!;
    if (seen.has(at)) continue;
    seen.add(at);
    if (at === to) return p.slice(1);
    for (const next of adjacent(at, 7))
      if (!seen.has(next) && passable(g, at, next)) {
        const cost = disasterCost(
          { ...g, position: at },
          { type: "move", to: next },
        );
        queue.push({
          path: [...p, next],
          cost: entry.cost + cost.time + cost.energy * 0.5,
        });
      }
  }
  return null;
}
export function disasterCost(g: DisasterGame, a: DisasterAction): Cost {
  const w = disasterWeather(g),
    p = disasterProfiles[g.difficulty];
  if (a.type === "move") {
    const e = connection(g.position, a.to, 7),
      steep = e?.steep,
      river =
        e?.risk === "river" ||
        edgeKey(g.position, a.to) === edgeKey("bridge", "valley");
    return {
      time: Math.ceil(
        (e?.time ?? (steep ? 20 : 10)) *
          (g.found ? 1.5 : 1) *
          (w === "snow" ? 1.3 : 1) +
          (river && w === "rain" ? 8 : 0) +
          (e?.risk === "ridge" && w === "wind" ? 5 : 0),
      ),
      energy: Math.ceil(
        Math.max(
          2,
          (e?.energy ?? (steep ? 12 : 5)) -
            (steep && g.equipment.includes("rope") ? 4 : 0) -
            (steep ? g.skills.mountain : 0),
        ) *
          (g.found ? 1.6 : 1) *
          p.energy *
          (w === "rain" ? 1.3 : w === "snow" ? 1.2 : 1) +
          (river && w === "rain" ? 3 : 0),
      ),
    };
  }
  if (a.type === "search")
    return {
      time:
        Math.max(6, 12 - g.skills.search * 2) +
        (w === "fog" ? 5 : 0) +
        (g.elapsed >= 190 && !g.equipment.includes("lantern") ? 10 : 0),
      energy: 6,
    };
  if (a.type === "rest") return { time: 15, energy: -25 };
  if (a.type === "aid" || a.type === "kit") return { time: 10, energy: 3 };
  if (a.type === "blanket") return { time: 5, energy: 1 };
  if (a.type === "mitigate")
    return a.method === "rope"
      ? { time: 8, energy: 5 }
      : {
          time: edgeState(g, g.position, a.to) === "blocked" ? 20 : 30,
          energy: -5,
        };
  if (a.type === "helicopter") return { time: 5, energy: 1 };
  if (a.type === "auto" && g.action) {
    const k = g.action.kind;
    return {
      time:
        k === "signal"
          ? 16
          : k === "rope"
            ? g.equipment.includes("rope")
              ? 24
              : 36
            : 24,
      energy: k === "signal" ? 3 : k === "rope" ? 10 : 8,
    };
  }
  return { time: 0, energy: 0 };
}
export function helicopterReason(g: DisasterGame) {
  if (g.helicopter)
    return "헬기가 접근 중입니다. 현장에서 대기하거나 취소 없이 지상 귀환할 수 있습니다.";
  if (g.heliUses >= 2) return "지원 횟수 2회를 사용했습니다.";
  if (!g.found || !g.secured || !g.treated || !g.carried)
    return "발견·로프 접근·처치·부상자 이송을 먼저 완료하세요.";
  if (!landingSites.includes(g.position))
    return "착륙 가능 지점: 제2전망대 · 백운 대피소 · 소나무 숲";
  if (!["clear", "cloudy"].includes(disasterWeather(g)))
    return "현재 기상으로 출동 불가. 맑음·흐림에서만 지원합니다.";
  return "";
}
export function disasterDisabled(g: DisasterGame, a: DisasterAction): string {
  if (g.status !== "active") return "종료된 임무입니다.";
  if (a.type === "ack") return g.scenes.length ? "" : "확인할 상황이 없습니다.";
  if (a.type === "abandon") return "";
  if (g.scenes.length)
    return "상황 화면을 확인하세요. 게임 시간은 멈춰 있습니다.";
  if (g.action && !["auto", "signal", "rope", "carry"].includes(a.type))
    return "현장 구조를 완료하거나 자동 구조로 전환하세요.";
  if (!g.action && ["auto", "signal", "rope", "carry"].includes(a.type))
    return "진행 중인 구조 액션이 없습니다.";
  if (a.type === "move") {
    if (!connection(g.position, a.to, 7))
      return "연결된 등산로만 이동할 수 있습니다.";
    if (!passable(g, g.position, a.to))
      return "통제 경로입니다. 우회하거나 로프 확보·안정 대기를 선택하세요.";
    if (g.found && (!g.secured || !g.treated || !g.carried))
      return "로프 접근 → 응급처치 → 부상자 이송 후 이동하세요.";
  }
  if (a.type === "search" && (g.found || g.searched.includes(g.position)))
    return "이미 확인한 구역입니다.";
  if (a.type === "rest" && g.stamina === 100) return "체력이 충분합니다.";
  if (a.type === "aid" && (!g.secured || g.treated))
    return "로프 접근 후 기본 처치를 한 번 할 수 있습니다.";
  if (
    a.type === "kit" &&
    (!g.secured || !g.equipment.includes("kit") || g.kitUses >= 2)
  )
    return "로프 접근 후 키트를 최대 2회 사용합니다.";
  if (
    a.type === "blanket" &&
    (!g.secured || !g.equipment.includes("blanket") || g.insulated)
  )
    return "로프 접근 후 방한포를 한 번 사용합니다.";
  if (a.type === "mitigate") {
    if (!connection(g.position, a.to, 7) || passable(g, g.position, a.to))
      return "현재 위치와 연결된 통제 경로를 선택하세요.";
    if (a.method === "rope" && !g.equipment.includes("rope"))
      return "구조 로프가 필요합니다. 우회 또는 안정 대기는 장비 없이 가능합니다.";
  }
  if (a.type === "start") {
    if (
      a.kind === "signal" &&
      (g.found || g.analyzed || !["lookout", "fork"].includes(g.position))
    )
      return "제2전망대 또는 삼거리에서 발견 전 한 번 분석하세요.";
    if (a.kind === "rope" && (!g.found || g.secured))
      return "조난자 발견 후 로프 접근을 진행하세요.";
    if (a.kind === "carry" && (!g.secured || !g.treated || g.carried))
      return "로프 접근과 처치 후 한 번 진행하세요.";
    if (g.stamina < (a.kind === "rope" ? 18 : a.kind === "carry" ? 14 : 3))
      return "현장 작업에 필요한 체력이 부족합니다. 먼저 휴식하세요.";
  }
  if (
    a.type === "signal" &&
    (g.action?.kind !== "signal" ||
      !Number.isFinite(a.angle) ||
      a.angle < 0 ||
      a.angle > 359)
  )
    return "유효한 신호 방향이 필요합니다.";
  if (
    a.type === "rope" &&
    (g.action?.kind !== "rope" ||
      !g.equipment.includes("rope") ||
      !Number.isFinite(a.value) ||
      a.value < 0 ||
      a.value > 100)
  )
    return "장력 0~100 및 구조 로프가 필요합니다. 자동 구조는 지원 장비를 사용합니다.";
  if (
    a.type === "carry" &&
    (g.action?.kind !== "carry" ||
      ![0, 1, 2].includes(a.lane) ||
      !["careful", "steady"].includes(a.speed))
  )
    return "이송 경로와 속도를 선택하세요.";
  if (a.type === "helicopter") {
    const reason = helicopterReason(g);
    if (reason) return reason;
  }
  if (g.stamina < disasterCost(g, a).energy)
    return "체력이 부족합니다. 휴식 후 진행하세요.";
  return "";
}
export function signalBearing(g: DisasterGame) {
  const a = point(g.position, 7),
    b = point(g.target, 7);
  return ((Math.atan2(b.x - a.x, a.y - b.y) * 180) / Math.PI + 360) % 360;
}
export function signalPower(g: DisasterGame, angle: number) {
  const d = Math.abs(((angle - signalBearing(g) + 540) % 360) - 180);
  return Math.max(0, Math.round(100 - d * 0.8));
}
export function carryTerrain(g: DisasterGame) {
  const round = g.action?.round ?? 0;
  return { blocked: (g.seed + round) % 3, narrow: (g.seed + round + 1) % 3 };
}
function spend(g: DisasterGame, c: Cost): DisasterGame {
  let health = g.health;
  for (let i = 0; i < c.time; i++)
    health = decayHealth(
      health,
      0.13 + g.injury,
      disasterWeather(g, g.elapsed + i),
      g.elapsed + i >= 190,
      g.insulated,
      false,
      1 - disasterProfiles[g.difficulty].decay,
    );
  return {
    ...g,
    elapsed: g.elapsed + c.time,
    stamina: Math.max(0, Math.min(100, g.stamina - c.energy)),
    health,
  };
}
function finishAction(g: DisasterGame, automatic: boolean): DisasterGame {
  const session = g.action!,
    k = session.kind;
  const cost = automatic
    ? disasterCost(g, { type: "auto" })
    : {
        time:
          (k === "signal" ? 8 : k === "rope" ? 14 : 12) +
          session.mistakes * 4 +
          session.careful * 2,
        energy:
          (k === "signal" ? 2 : k === "rope" ? 6 : 5) + session.mistakes * 3,
      };
  let n = spend(g, cost);
  n.action = null;
  const label =
    k === "signal" ? "신호 분석" : k === "rope" ? "로프 접근" : "부상자 이송";
  n.routeReport = [
    ...n.routeReport,
    `${label}: ${automatic ? "자동 지원" : "직접 조작"} · ${cost.time}분 / 체력 ${cost.energy} · 실수 ${session.mistakes}회`,
  ];
  if (k === "signal") {
    n.analyzed = true;
    n.possible = [n.target];
    n.clues = [
      ...n.clues,
      {
        location: n.position,
        text: `방향 신호를 교차 확인했습니다. ${point(n.target, 7).name}에서 현장 수색하세요.`,
      },
    ];
  }
  if (k === "rope") {
    n.secured = true;
    n.scenes = [...n.scenes, "secured"];
  }
  if (k === "carry") n.carried = true;
  return n;
}
function updateWorld(g: DisasterGame): DisasterGame {
  const t = disasterTimes(g.difficulty, g.seed),
    events = [...g.events],
    scenes = [...g.scenes],
    log = [...g.log];
  const thresholds: [string, number, string, Scene?][] = [
    [
      "rock-warning",
      t.rockWarning,
      `낙석 주의: +${t.rock}분에 삼거리–바위 그늘 통제 예정. 계곡 또는 서쪽 능선 우회 가능.`,
    ],
    [
      "rock",
      t.rock,
      "낙석 발생. 삼거리–바위 그늘 차단. 우회·로프 확보·안정 대기 중 선택하십시오.",
      "rock",
    ],
    [
      "flood-warning",
      t.floodWarning,
      `수위 상승: +${t.flood}분에 계곡 진입로 2곳 통제 예정. 서쪽 능선은 연결됩니다.`,
    ],
    [
      "flood",
      t.flood,
      "급류 발생. 삼거리–계곡 및 나무다리–계곡 일시 통제.",
      "flood",
    ],
    [
      "storm",
      disasterSchedule(g.difficulty, g.seed).find((s) => s.weather === "rain")!
        .at,
      "폭우 시작. 이동 부담 증가, 항공 지원 제한.",
      "storm",
    ],
  ];
  for (const [id, at, message, scene] of thresholds.sort((a, b) => a[1] - b[1]))
    if (g.elapsed >= at && !events.includes(id)) {
      events.push(id);
      log.unshift(message);
      if (scene) scenes.push(scene);
    }
  let n = { ...g, events, scenes, log: log.slice(0, 30) };
  if (n.helicopter && n.elapsed >= n.helicopter.at) {
    const h = n.helicopter;
    n = { ...n, helicopter: null };
    if (
      n.health > 0 &&
      n.position === h.origin &&
      ["clear", "cloudy"].includes(disasterWeather(n, h.at)) &&
      landingSites.includes(n.position)
    ) {
      n.evacuated = true;
      n.position = "base";
      n.trail = [...n.trail, "base"];
      n.scenes.push("helicopter");
      n.routeReport = [
        ...n.routeReport,
        "헬기 도착 기상 재확인 · 조난자와 대원 동시 본부 인계",
      ];
    } else
      n.routeReport = [
        ...n.routeReport,
        "헬기 회항: 도착 시 기상 또는 현장 대기 조건 불충족. 지상 귀환 가능.",
      ];
  }
  const ready =
    n.found && n.secured && n.treated && n.carried && n.position === "base";
  if (
    n.health <= 0 ||
    n.elapsed > disasterProfiles[n.difficulty].limit ||
    (n.elapsed === disasterProfiles[n.difficulty].limit && !ready)
  ) {
    n.status = "failed";
    n.reason =
      n.health <= 0
        ? "긴 수색과 노출로 조난자 상태가 소진됐습니다."
        : "귀환 전 구조 제한 시간을 초과했습니다.";
    n.scenes = [];
    n.action = null;
    n.helicopter = null;
  } else if (ready) {
    n.status = "success";
    n.reason = n.evacuated
      ? "항공 인계 완료. 조난자와 구조대 전원 안전."
      : "지상 귀환 완료. 조난자와 구조대 전원 안전.";
    n.scenes = [];
  }
  return n;
}
export function disasterTransition(
  g: DisasterGame,
  a: DisasterAction,
  revision = g.revision,
): DisasterGame {
  if (revision !== g.revision || disasterDisabled(g, a)) return g;
  let n: DisasterGame = {
    ...g,
    revision: g.revision + 1,
    scenes: [...g.scenes],
    events: [...g.events],
    cleared: [...g.cleared],
    reopened: { ...g.reopened },
    action: g.action ? { ...g.action } : null,
  };
  if (a.type === "ack") {
    n.scenes.shift();
    return n;
  }
  if (a.type === "abandon")
    return {
      ...n,
      status: "failed",
      reason: "구조대 안전을 위해 임무를 중단했습니다.",
      scenes: [],
      action: null,
      helicopter: null,
    };
  if (a.type === "start") {
    n.action = { kind: a.kind, round: 0, mistakes: 0, careful: 0 };
    return n;
  }
  if (a.type === "auto") n = finishAction(n, true);
  else if (a.type === "rope") {
    const ok =
      Math.abs(a.value - 50) <= disasterProfiles[g.difficulty].window / 2;
    n.action!.round++;
    if (!ok) n.action!.mistakes++;
    if (n.action!.round === 3) n = finishAction(n, false);
  } else if (a.type === "signal") {
    n.action!.round++;
    const ok =
      signalPower(g, a.angle) >=
      (g.difficulty === "hard" ? 85 : g.difficulty === "easy" ? 65 : 75);
    if (!ok) n.action!.mistakes++;
    if (ok || n.action!.round === 3) n = finishAction(n, false);
  } else if (a.type === "carry") {
    const terrain = carryTerrain(g),
      bad =
        a.lane === terrain.blocked ||
        (a.lane === terrain.narrow && a.speed === "steady");
    n.action!.round++;
    if (bad) n.action!.mistakes++;
    if (a.speed === "careful") n.action!.careful++;
    if (n.action!.round === 3) n = finishAction(n, false);
  } else {
    const c = disasterCost(g, a);
    n = spend(n, c);
    if (a.type === "move") {
      if (
        g.events.includes("rock") &&
        edgeKey(g.position, a.to) !== edgeKey("fork", "cave") &&
        ["hut", "spring", "summit", "east", "waterfall"].includes(a.to)
      )
        n.detours++;
      if (g.cleared.includes(edgeKey(g.position, a.to))) n.crossings++;
      n.position = a.to;
      n.trail = [...g.trail, a.to];
      n.visited = [...new Set([...g.visited, a.to])];
    }
    if (a.type === "search") {
      n.searched = [...g.searched, g.position];
      if (g.position === g.target) {
        n.found = true;
        n.scenes.push("found");
      } else if (["gate", "lookout"].includes(g.position))
        n.clues = [
          ...g.clues,
          {
            location: g.position,
            text: "암릉 아래 반사된 무전이 들립니다. 제2전망대 또는 삼거리에서 신호 탐지를 진행하세요.",
          },
        ];
      else n.possible = g.possible.filter((p) => p !== g.position);
    }
    if (a.type === "aid" && n.health > 0) {
      n.treated = true;
      n.injury = 0;
      n.health = Math.min(100, n.health + 22 + g.skills.response * 3);
    }
    if (a.type === "kit" && n.health > 0) {
      n.kitUses++;
      n.health = Math.min(100, n.health + 25);
    }
    if (a.type === "blanket") n.insulated = true;
    if (a.type === "mitigate") {
      const key = edgeKey(g.position, a.to),
        rock = edgeState(g, g.position, a.to) === "blocked";
      if (a.method === "rope" || rock) n.cleared.push(key);
      else n.reopened[key] = n.elapsed + 60;
      n.routeReport = [
        ...g.routeReport,
        `${point(g.position, 7).name} → ${point(a.to, 7).name}: ${a.method === "rope" ? "로프 확보" : "안정 대기"} ${c.time}분 · ${rock || a.method === "rope" ? "통행 확보" : "60분간 일시 개방"}`,
      ];
    }
    if (a.type === "helicopter") {
      n.heliUses++;
      n.helicopter = { at: n.elapsed + 25, origin: g.position };
      n.routeReport = [
        ...g.routeReport,
        `헬기 요청: ${point(g.position, 7).name} · 요청 시작에서 30분 후 도착, 도착 기상 재검사`,
      ];
    }
  }
  if (
    (a.type !== "rope" && a.type !== "carry" && a.type !== "signal") ||
    !n.action
  )
    n.log = [
      `${a.type === "move" ? point(n.position, 7).name + " 이동" : a.type === "search" ? "현장 수색" : a.type === "rest" ? "휴식" : a.type === "aid" ? "응급처치" : a.type === "blanket" ? "보온" : a.type === "kit" ? "키트 사용" : a.type === "mitigate" ? "경로 확보" : a.type === "helicopter" ? "헬기 출동 요청" : "현장 작업 완료"} · +${n.elapsed - g.elapsed}분 · 체력 ${n.stamina - g.stamina >= 0 ? "+" : ""}${n.stamina - g.stamina}`,
      ...n.log,
    ].slice(0, 30);
  return updateWorld(n);
}
export const disasterRating = (g: DisasterGame) =>
  g.status !== "success"
    ? 1
    : g.health >= 60 && g.elapsed <= disasterProfiles[g.difficulty].limit * 0.85
      ? 3
      : g.health >= 35
        ? 2
        : 1;
export const disasterXp = (g: DisasterGame) =>
  g.status === "success" && !g.practice ? 100 + disasterRating(g) * 25 : 0;
export function disasterGoal(g: DisasterGame) {
  if (!g.found)
    return g.possible.length === 1
      ? `${point(g.possible[0], 7).name}에서 현장 수색`
      : "제2전망대에서 신호 방향 분석";
  if (!g.secured) return "로프 구조로 조난자에게 접근";
  if (!g.treated) return "기본 응급처치로 상태 안정화";
  if (!g.carried) return "부상자 이송으로 안전 지형 확보";
  return "본부로 지상 귀환 또는 H 지점에서 항공 지원";
}
export function allRoutesSafe(g: DisasterGame) {
  return regionFor(7).points.every((p) => safeRoute(g, p.id, "base") !== null);
}
