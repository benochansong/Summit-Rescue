import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  allRoutesSafe,
  carryTerrain,
  createDisaster,
  disasterCost,
  disasterDisabled,
  disasterRating,
  disasterTransition,
  disasterWeather,
  edgeKey,
  edgeState,
  helicopterReason,
  safeRoute,
  signalBearing,
  type DisasterAction,
  type DisasterGame,
} from "./disaster";
import {
  disasterCandidates,
  disasterProfiles,
  disasterSchedule,
  disasterTimes,
} from "./disasterData";
import type { Difficulty } from "./experience";
import { adjacent } from "./regions";
import {
  personalHighlights,
  readCareer,
  readCommandCareer,
  readRecords,
  saveRecord,
} from "./storage";
function act(g: DisasterGame, a: DisasterAction) {
  expect(
    disasterDisabled(g, a),
    JSON.stringify({
      a,
      time: g.elapsed,
      health: g.health,
      energy: g.stamina,
      pos: g.position,
      scene: g.scenes,
      action: g.action,
    }),
  ).toBe("");
  return disasterTransition(g, a);
}
function dismiss(g: DisasterGame) {
  while (g.scenes.length) g = act(g, { type: "ack" });
  return g;
}
function care(g: DisasterGame, cost = 0) {
  if (
    g.secured &&
    g.health < 40 &&
    g.equipment.includes("kit") &&
    g.kitUses < 2
  )
    g = dismiss(act(g, { type: "kit" }));
  for (let i = 0; g.stamina < cost + 18 && i < 5; i++)
    g = dismiss(act(g, { type: "rest" }));
  return g;
}
function go(g: DisasterGame, to: string) {
  for (let i = 0; g.position !== to && i < 60 && g.status === "active"; i++) {
    const route = safeRoute(g, g.position, to);
    expect(route).not.toBeNull();
    const estimate = (state: DisasterGame, path: string[]) => {
      let cost = 0;
      for (const next of path) {
        const c = disasterCost(state, { type: "move", to: next });
        cost += c.time + c.energy * 0.5;
        state = { ...state, position: next, elapsed: state.elapsed + c.time };
      }
      return cost;
    };
    let mitigation: DisasterAction | null = null;
    for (const neighbor of adjacent(g.position, 7))
      if (!["open", "warning"].includes(edgeState(g, g.position, neighbor))) {
        const candidate = {
          type: "mitigate",
          to: neighbor,
          method: g.equipment.includes("rope") ? "rope" : "wait",
        } as const;
        const c = disasterCost(g, candidate),
          cleared = {
            ...g,
            cleared: [...g.cleared, edgeKey(g.position, neighbor)],
          },
          short = safeRoute(cleared, g.position, to)!;
        if (
          c.time + c.energy * 0.5 + estimate(cleared, short) <
          estimate(g, route!)
        )
          mitigation = candidate;
      }
    if (mitigation) {
      g = care(g, 5);
      g = dismiss(act(g, mitigation));
      continue;
    }
    const next = route![0];
    g = care(g, disasterCost(g, { type: "move", to: next }).energy);
    const changed = safeRoute(g, g.position, to)!;
    g = dismiss(act(g, { type: "move", to: changed[0] }));
  }
  return g;
}
type Strategy = "auto" | "no-equipment" | "mistakes";
const balance: { difficulty: Difficulty; strategy: Strategy; time: number }[] =
  [];
afterAll(() => {
  console.log(
    "Disaster balance:",
    JSON.stringify(
      Object.keys(disasterProfiles).map((difficulty) => {
        const times = balance
          .filter((r) => r.difficulty === difficulty)
          .map((r) => r.time);
        return {
          difficulty,
          runs: times.length,
          min: Math.min(...times),
          max: Math.max(...times),
          over210: times.filter((t) => t > 210).length,
          over240: times.filter((t) => t > 240).length,
        };
      }),
    ),
  );
});
function rescue(seed: number, difficulty: Difficulty, strategy: Strategy) {
  let g = dismiss(
    createDisaster(
      seed,
      difficulty,
      strategy === "no-equipment" ? [] : ["rope", "kit", "blanket"],
    ),
  );
  g = go(g, "lookout");
  g = act(g, { type: "start", kind: "signal" });
  g = dismiss(
    strategy === "mistakes"
      ? act(g, { type: "signal", angle: signalBearing(g) })
      : act(g, { type: "auto" }),
  );
  g = go(g, g.possible[0]);
  g = care(g, 6);
  g = dismiss(act(g, { type: "search" }));
  g = care(g, 18);
  g = act(g, { type: "start", kind: "rope" });
  if (strategy === "mistakes")
    for (let i = 0; i < 3; i++) g = dismiss(act(g, { type: "rope", value: 0 }));
  else g = dismiss(act(g, { type: "auto" }));
  g = dismiss(act(g, { type: "aid" }));
  if (g.equipment.includes("blanket")) g = dismiss(act(g, { type: "blanket" }));
  g = care(g, 14);
  g = act(g, { type: "start", kind: "carry" });
  if (strategy === "mistakes")
    for (let i = 0; i < 3; i++)
      g = dismiss(
        act(g, {
          type: "carry",
          lane: carryTerrain(g).blocked,
          speed: "steady",
        }),
      );
  else g = dismiss(act(g, { type: "auto" }));
  return go(g, "base");
}
describe("재난 통합 작전: 108시드 × 3난이도 × 자동/장비없음/실수", () => {
  for (const difficulty of Object.keys(disasterProfiles) as Difficulty[])
    for (const strategy of ["auto", "no-equipment", "mistakes"] as Strategy[])
      for (let seed = 0; seed < 108; seed++)
        it(`${difficulty}/${strategy}/${seed}`, () => {
          const g = rescue(seed, difficulty, strategy);
          balance.push({ difficulty, strategy, time: g.elapsed });
          expect(
            g.status,
            JSON.stringify({
              t: g.elapsed,
              h: g.health,
              e: g.stamina,
              p: g.position,
              events: g.events,
            }),
          ).toBe("success");
          expect(g.position).toBe("base");
          expect(g.events).toContain("rock");
          expect(g.health).toBeGreaterThan(0);
          expect(g.carried && g.treated && g.secured).toBe(true);
        });
});
describe("재난 규칙과 원자적 전이", () => {
  it("경고 전후와 두 재난 이후 모든 구역은 본부와 연결", () => {
    for (const difficulty of Object.keys(disasterProfiles) as Difficulty[])
      for (let seed = 0; seed < 9; seed++) {
        const g = dismiss(createDisaster(seed, difficulty)),
          t = disasterTimes(difficulty, seed);
        for (const elapsed of [
          0,
          t.rockWarning,
          t.rock,
          t.floodWarning,
          t.flood,
          350,
        ])
          expect(allRoutesSafe({ ...g, elapsed })).toBe(true);
      }
  });
  it("양방향 키와 실제 이동 차단, 시작 상태 불변", () => {
    const g = { ...dismiss(createDisaster()), position: "fork", elapsed: 80 };
    const copy = JSON.stringify(g);
    expect(edgeKey("fork", "cave")).toBe(edgeKey("cave", "fork"));
    expect(edgeState(g, "cave", "fork")).toBe("blocked");
    expect(disasterTransition(g, { type: "move", to: "cave" })).toBe(g);
    expect(JSON.stringify(g)).toBe(copy);
    expect(safeRoute(g, "fork", "cave")).not.toEqual(["cave"]);
  });
  it("경계를 넘는 이동은 원자적으로 완료하고 이후 경로 통제", () => {
    const g = { ...dismiss(createDisaster(0)), position: "fork", elapsed: 55 },
      n = act(g, { type: "move", to: "cave" });
    expect(n.position).toBe("cave");
    expect(n.events).toContain("rock");
    expect(edgeState(n, "cave", "fork")).toBe("blocked");
  });
  it("상황 확인에는 시간 소비 없고 연출 중 다른 명령과 중복 revision 거부", () => {
    let g = { ...dismiss(createDisaster(0)), elapsed: 55, stamina: 80 };
    g = act(g, { type: "rest" });
    const time = g.elapsed;
    expect(g.scenes).toContain("rock");
    expect(disasterTransition(g, { type: "search" })).toBe(g);
    const n = act(g, { type: "ack" });
    expect(n.elapsed).toBe(time);
    expect(disasterTransition(n, { type: "ack" }, g.revision)).toBe(n);
  });
  it("같은 시드·행동으로 사건 재현 및 한 번만 표시", () => {
    const run = () => {
      let g = dismiss(createDisaster(7));
      for (let i = 0; i < 12; i++) {
        g = { ...g, stamina: 80 };
        g = dismiss(act(g, { type: "rest" }));
      }
      return g;
    };
    const a = run(),
      b = run();
    expect(a.events).toEqual(b.events);
    expect(new Set(a.events).size).toBe(a.events.length);
    expect(a.log).toEqual(b.log);
  });
  it("날씨와 계곡·능선 비용이 동일 경계 사용", () => {
    const g = { ...dismiss(createDisaster(0)), position: "fork" };
    for (const p of disasterSchedule(g.difficulty, g.seed))
      expect(disasterWeather(g, p.at)).toBe(p.weather);
    const dry = disasterCost(g, { type: "move", to: "valley" }),
      wet = disasterCost(
        { ...g, elapsed: 105 },
        { type: "move", to: "valley" },
      );
    expect(wet.time).toBeGreaterThan(dry.time);
    expect(wet.energy).toBeGreaterThan(dry.energy);
  });
  it("로프 확보와 안정 대기는 실제 통행을 복원", () => {
    let g = { ...dismiss(createDisaster(0)), position: "fork", elapsed: 70 };
    g = dismiss(act(g, { type: "mitigate", to: "cave", method: "rope" }));
    expect(edgeState(g, "fork", "cave")).toBe("open");
    const noRope = {
      ...dismiss(createDisaster(0, "normal", [])),
      position: "fork",
      elapsed: 70,
    };
    const n = dismiss(
      act(noRope, { type: "mitigate", to: "cave", method: "wait" }),
    );
    expect(edgeState(n, "cave", "fork")).toBe("open");
  });
  it("급류 대기 후 60분간만 양방향 개방", () => {
    let g = { ...dismiss(createDisaster(0)), position: "bridge", elapsed: 130 };
    g = dismiss(act(g, { type: "mitigate", to: "valley", method: "wait" }));
    expect(edgeState(g, "valley", "bridge")).toBe("open");
    expect(
      edgeState({ ...g, elapsed: g.elapsed + 60 }, "valley", "bridge"),
    ).toBe("warning");
  });
  it("세 후보의 신호가 실제 좌표 방향에 따라 달라짐", () => {
    for (let seed = 0; seed < 3; seed++) {
      const g = { ...dismiss(createDisaster(seed)), position: "lookout" };
      const n = act(act(g, { type: "start", kind: "signal" }), {
        type: "signal",
        angle: signalBearing(g),
      });
      expect(n.possible).toEqual([disasterCandidates[seed]]);
      expect(n.found).toBe(false);
    }
  });
  it("구조 액션 3회, 실수는 비용 차이·상태 고착 없음", () => {
    const setup = () =>
      act(
        { ...dismiss(createDisaster(0)), position: "cave", found: true },
        { type: "start", kind: "rope" },
      );
    let a = setup(),
      b = setup();
    for (let i = 0; i < 3; i++) {
      a = act(a, { type: "rope", value: 50 });
      b = act(b, { type: "rope", value: 0 });
    }
    expect(a.secured && b.secured).toBe(true);
    expect(b.elapsed - a.elapsed).toBe(12);
    expect(a.stamina - b.stamina).toBe(9);
    expect(b.status).toBe("active");
  });
  it("다른 액션 명령·잘못된 장력·중복 결과와 발견만으로 성공 거부", () => {
    let g = act(
      { ...dismiss(createDisaster()), found: true },
      { type: "start", kind: "rope" },
    );
    expect(disasterTransition(g, { type: "rope", value: NaN })).toBe(g);
    expect(disasterTransition(g, { type: "signal", angle: 0 })).toBe(g);
    const n = act(g, { type: "rope", value: 50 });
    expect(disasterTransition(n, { type: "rope", value: 50 }, g.revision)).toBe(
      n,
    );
    expect(n.status).toBe("active");
    g = dismiss(act(n, { type: "auto" }));
    expect(disasterTransition(g, { type: "move", to: "gate" })).toBe(g);
  });
  it("이송 좁은 발판은 속도에 따라 비용이 달라짐", () => {
    const g = act(
        {
          ...dismiss(createDisaster()),
          found: true,
          secured: true,
          treated: true,
        },
        { type: "start", kind: "carry" },
      ),
      lane = carryTerrain(g).narrow;
    expect(
      act(g, { type: "carry", lane, speed: "careful" }).action!.mistakes,
    ).toBe(0);
    expect(
      act(g, { type: "carry", lane, speed: "steady" }).action!.mistakes,
    ).toBe(1);
  });
  it("기본 처치는 한 번, 제한 시간과 상태 소진은 실패", () => {
    const g = {
      ...dismiss(createDisaster()),
      found: true,
      secured: true,
      health: 70,
    };
    const n = dismiss(act(g, { type: "aid" }));
    expect(disasterTransition(n, { type: "aid" })).toBe(n);
    expect(act({ ...g, elapsed: 399 }, { type: "aid" }).status).toBe("failed");
    expect(act({ ...g, health: 0.01 }, { type: "aid" }).status).toBe("failed");
  });
  it("실패 후 새 출동은 사건·액션·항공·체력을 초기화", () => {
    const g = createDisaster(3, "hard");
    const n = createDisaster(g.seed, g.difficulty);
    expect(n.runId).not.toBe(g.runId);
    expect(n.elapsed).toBe(0);
    expect(n.events).toEqual([]);
    expect(n.stamina).toBe(100);
    expect(n.heliUses).toBe(0);
  });
});
describe("헬기 요청과 도착 재검사", () => {
  const ready = (elapsed = 220) =>
    ({
      ...dismiss(createDisaster(0)),
      elapsed,
      position: "lookout",
      found: true,
      secured: true,
      treated: true,
      carried: true,
      health: 95,
    }) as DisasterGame;
  it("발견·접근·처치·이송·착륙지·날씨·횟수 필요", () => {
    for (const g of [
      { ...ready(), found: false },
      { ...ready(), secured: false },
      { ...ready(), treated: false },
      { ...ready(), carried: false },
      { ...ready(), position: "cave" },
      ready(110),
      { ...ready(), heliUses: 2 },
    ])
      expect(helicopterReason(g)).not.toBe("");
    expect(helicopterReason(ready())).toBe("");
  });
  it("요청 직후 성공 아님, 도착 뒤 조난자와 대원 함께 인계", () => {
    let g = dismiss(act(ready(), { type: "helicopter" }));
    expect(g.status).toBe("active");
    expect(g.helicopter?.at).toBe(250);
    g = dismiss(act({ ...g, stamina: 75 }, { type: "rest" }));
    expect(g.status).toBe("active");
    g = act({ ...g, stamina: 75 }, { type: "rest" });
    expect(g.status).toBe("success");
    expect(g.evacuated).toBe(true);
    expect(g.position).toBe("base");
  });
  it("도착 시 악천후면 회항하고 지상 귀환 가능", () => {
    let g = dismiss(act(ready(25), { type: "helicopter" }));
    for (let i = 0; i < 2; i++)
      g = dismiss(act({ ...g, stamina: 70 }, { type: "rest" }));
    expect(g.helicopter).toBeNull();
    expect(g.evacuated).toBe(false);
    expect(g.heliUses).toBe(1);
    expect(g.status).toBe("active");
    expect(g.routeReport.at(-1)).toContain("회항");
    expect(safeRoute(g, g.position, "base")).not.toBeNull();
  });
  it("현장을 떠나면 이송되지 않음", () => {
    let g = dismiss(act(ready(), { type: "helicopter" }));
    g = dismiss(act(g, { type: "move", to: "gate" }));
    g = dismiss(act({ ...g, stamina: 70 }, { type: "rest" }));
    expect(g.evacuated).toBe(false);
    expect(g.helicopter).toBeNull();
  });
});
describe("기존 저장과 재난 개인 기록", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("v5 공용·대원 성장과 설정 보존, 신규 기록 중복 보상 방지", () => {
    data.set(
      "summit-rescue.records.v1",
      JSON.stringify({
        version: 5,
        records: [],
        career: { xp: 345, skills: { search: 1, mountain: 2, response: 0 } },
        command: { xp: { dohyun: 200, seojin: 100, minho: 50 }, rescued: 4 },
      }),
    );
    const g = rescue(0, "normal", "auto");
    expect(personalHighlights(g, disasterRating(g), g.difficulty)).toEqual([
      "이 조건의 첫 구조 기록",
    ]);
    expect(
      saveRecord(g, 7, { difficulty: g.difficulty, rating: disasterRating(g) }),
    ).toBe(true);
    const xp = readCareer().xp;
    expect(xp).toBeGreaterThan(345);
    expect(readCareer().skills.mountain).toBe(2);
    expect(readCommandCareer().rescued).toBe(4);
    expect(readRecords()[0].mission).toBe(7);
    saveRecord(g, 7, { difficulty: g.difficulty, rating: disasterRating(g) });
    expect(readCareer().xp).toBe(xp);
    expect(personalHighlights(g, disasterRating(g), g.difficulty)).toEqual([]);
    expect(personalHighlights(g, disasterRating(g), "hard")).toEqual([
      "이 조건의 첫 구조 기록",
    ]);
  });
  it("훈련은 완료돼도 기록·보상 미저장", () => {
    const g = { ...rescue(2, "easy", "auto"), practice: true };
    saveRecord(g, 7, { difficulty: g.difficulty, rating: disasterRating(g) });
    expect(readRecords()).toEqual([]);
  });
});

describe("Phase 6-A 기상과 대응 기록", () => {
  it("7종 기상의 경계·예보·시드가 일치", () => {
    for (const difficulty of Object.keys(disasterProfiles) as Difficulty[])
      for (let seed = 0; seed < 9; seed++) {
        const g = dismiss(createDisaster(seed, difficulty)),
          steps = disasterSchedule(difficulty, seed);
        expect(new Set(steps.map((s) => s.weather)).size).toBe(7);
        for (let i = 1; i < steps.length; i++) {
          expect(disasterWeather(g, steps[i].at - 1)).toBe(
            steps[i - 1].weather,
          );
          expect(disasterWeather(g, steps[i].at)).toBe(steps[i].weather);
          const n = act({ ...g, elapsed: steps[i].at - 10 }, { type: "wait" });
          expect(n.events).toContain(`weather-${steps[i].at}`);
          expect(n.events).toContain(`forecast-${steps[i].at}`);
        }
      }
  });
  it("비는 체력 증가, 안개는 수색 증가, 눈과 강풍은 이동 부담 증가", () => {
    const g = { ...dismiss(createDisaster(0)), position: "cedar" };
    const move = { type: "move", to: "ridge" } as const,
      dry = disasterCost(g, move);
    expect(disasterCost({ ...g, elapsed: 75 }, move).energy).toBeGreaterThan(
      dry.energy,
    );
    expect(disasterCost({ ...g, elapsed: 45 }, { type: "search" }).time).toBe(
      disasterCost(g, { type: "search" }).time + 5,
    );
    expect(disasterCost({ ...g, elapsed: 155 }, move).time).toBeGreaterThan(
      dry.time,
    );
    const snow = disasterCost({ ...g, elapsed: 315 }, move);
    expect(snow.time).toBeGreaterThan(dry.time);
    expect(snow.energy).toBeGreaterThan(dry.energy);
  });
  it("실제로 통제 때문에 경로를 바꾼 이동만 우회 평가", () => {
    const g = {
      ...dismiss(createDisaster(0)),
      position: "cave",
      elapsed: 100,
      found: true,
      secured: true,
      treated: true,
      carried: true,
    };
    const n = act(g, { type: "move", to: "waterfall" });
    expect(n.detours).toBe(1);
    expect(n.routeReport.join()).toContain("통제 우회 선택");
    expect(n.routeReport.join()).toContain("폭우 이동");
    const early = act({ ...g, elapsed: 10 }, { type: "move", to: "waterfall" });
    expect(early.detours).toBe(0);
    const west = act(
      { ...g, position: "west" },
      { type: "move", to: "spring" },
    );
    expect(west.detours).toBe(0);
  });
  it("주의·일시 개방 통과도 실제 출발 경로 상태로 평가", () => {
    const g = { ...dismiss(createDisaster(0)), position: "fork", elapsed: 30 };
    expect(act(g, { type: "move", to: "cave" }).crossings).toBe(1);
    expect(
      act({ ...g, elapsed: 0 }, { type: "move", to: "cave" }).crossings,
    ).toBe(0);
  });
  it("체력이 가득 차도 헬기 도착까지 현장 대기 가능", () => {
    let g = {
      ...dismiss(createDisaster(0)),
      position: "lookout",
      elapsed: 220,
      found: true,
      secured: true,
      treated: true,
      carried: true,
    };
    g = dismiss(act(g, { type: "helicopter" }));
    g = dismiss(act(g, { type: "rest" }));
    expect(g.stamina).toBe(100);
    g = act(g, { type: "wait" });
    expect(g.status).toBe("success");
    expect(g.evacuated).toBe(true);
  });
});
