import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createDisaster,
  disasterTransition,
  disasterDisabled,
  disasterCost,
  disasterWeather,
  disasterForecast,
  disasterLimit,
  safeRoute,
  rockEdge,
  worldTimes,
  edgeState,
  edgeKey,
  allRoutesSafe,
  signalPower,
  type DisasterGame,
  type DisasterAction,
} from "./disaster";
import { finalAct, finalPattern, finalClueCandidates } from "./finalMission";
import { airRequestReason } from "./helicopter";
import { airContext } from "./disaster";
import { adjacent } from "./regions";
import { cliffRules } from "./rescueActions";
import { readRecords, saveRecord } from "./storage";
import type { Difficulty } from "./experience";
const dismiss = (g: DisasterGame) => {
  while (g.scenes.length) g = disasterTransition(g, { type: "ack" });
  return g;
};
const fresh = (seed = 0, d: Difficulty = "normal", bare = false) =>
  dismiss(createDisaster(seed, d, bare ? [] : undefined, undefined, false, 10));
function act(g: DisasterGame, a: DisasterAction) {
  expect(
    disasterDisabled(g, a),
    JSON.stringify({
      a,
      t: g.elapsed,
      p: g.position,
      h: g.health,
      s: g.stamina,
    }),
  ).toBe("");
  return dismiss(disasterTransition(g, a));
}
function care(g: DisasterGame, energy = 0) {
  if (
    g.secured &&
    !g.air?.onboard &&
    g.health < 45 &&
    g.equipment.includes("kit") &&
    g.kitUses < 2
  )
    g = act(g, { type: "kit" });
  for (let i = 0; i < 6 && g.stamina < energy + 14; i++)
    g = act(g, { type: "rest" });
  return g;
}
function go(g: DisasterGame, to: string) {
  for (let i = 0; i < 80 && g.position !== to && g.status === "active"; i++) {
    const route = safeRoute(g, g.position, to)!;
    expect(route).not.toBeNull();
    for (const n of adjacent(g.position, 10))
      if (["blocked", "restricted"].includes(edgeState(g, g.position, n))) {
        const open = { ...g, cleared: [...g.cleared, edgeKey(g.position, n)] };
        if (safeRoute(open, g.position, to)!.length + 1 < route.length) {
          g = care(g, 5);
          g = act(g, {
            type: "mitigate",
            to: n,
            method: g.equipment.includes("rope") ? "rope" : "wait",
          });
          break;
        }
      }
    g = care(
      g,
      disasterCost(g, { type: "move", to: safeRoute(g, g.position, to)![0] })
        .energy,
    );
    g = act(g, { type: "move", to: safeRoute(g, g.position, to)![0] });
  }
  return g;
}
function find(g: DisasterGame, auto = false) {
  g = go(g, "gate");
  g = act(g, { type: "search" });
  expect(g.possible).toHaveLength(2);
  expect(g.possible).toContain(g.target);
  g = go(g, "lookout");
  g = act(g, { type: "start", kind: "signal" });
  if (auto) g = act(g, { type: "auto" });
  else {
    // Sweep the same public signal strength the player can read; never inspect target to navigate.
    const angle = Array.from({ length: 360 }, (_, i) => i).sort(
      (a, b) => signalPower(g, b) - signalPower(g, a),
    )[0];
    g = act(g, { type: "signal", angle });
    g = act(g, { type: "signal", angle });
  }
  while (!g.found && g.possible.length && g.status === "active") {
    const next = [...g.possible].sort(
      (a, b) =>
        safeRoute(g, g.position, a)!.length -
        safeRoute(g, g.position, b)!.length,
    )[0];
    g = go(g, next);
    g = care(g, 18);
    g = act(g, { type: "search" });
  }
  return g;
}
function rescue(g: DisasterGame, automatic = false, miss = false) {
  expect(g.cliff).toBeDefined();
  if (!automatic) {
    g = act(g, { type: "cliff", command: { type: "begin" } });
    if (miss) {
      for (
        let i = 0;
        i < cliffRules(g.difficulty, disasterWeather(g)).tolerance;
        i++
      )
        g = act(g, { type: "cliff", command: { type: "tension", value: 0 } });
      expect(g.cliff!.stage).toBe("recover");
      g = act(g, { type: "cliff", command: { type: "retry" } });
    }
    for (let i = 0; i < 3; i++)
      g = act(g, { type: "cliff", command: { type: "tension", value: 50 } });
    for (let i = 0; i < 3; i++)
      g = act(g, { type: "cliff", command: { type: "descend", speed: 50 } });
    g = act(g, { type: "cliff", command: { type: "approach" } });
  }
  g = act(g, {
    type: "cliff",
    command: { type: automatic ? "auto" : "finish" },
  });
  expect(disasterWeather(g)).toBe("rain");
  expect(g.stormAt).toBe(g.elapsed);
  g = act(g, { type: "aid" });
  if (g.equipment.includes("blanket")) g = act(g, { type: "blanket" });
  return g;
}
function complete(seed: number, d: Difficulty, mode: string) {
  let g = rescue(
    find(fresh(seed, d, mode === "bare"), mode === "shelter"),
    mode === "bare" || mode === "shelter",
  );
  if (mode === "shelter") {
    g = go(
      g,
      ["cave", "hut"].sort(
        (a, b) =>
          safeRoute(g, g.position, a)!.length -
          safeRoute(g, g.position, b)!.length,
      )[0],
    );
    g = act(g, { type: "shelter" });
  }
  if (mode === "air") {
    const h = ["lookout", "hut", "pine", "ridge"].sort(
      (a, b) =>
        safeRoute(g, g.position, a)!.length -
        safeRoute(g, g.position, b)!.length,
    )[0];
    g = go(g, h);
    for (let i = 0; i < 20 && airRequestReason(g.air!, airContext(g)); i++) {
      g = care(g);
      g = act(g, { type: "wait" });
    }
    g = act(g, { type: "air-request" });
    for (let i = 0; i < 20 && g.air!.status !== "complete"; i++) {
      g = care(g);
      g = act(g, { type: "wait" });
    }
    expect(g.air!.status).toBe("complete");
    expect(g.status).toBe("active");
  }
  g = go(g, "base");
  expect(
    g.status,
    JSON.stringify({
      seed,
      d,
      mode,
      t: g.elapsed,
      h: g.health,
      reason: g.reason,
      p: g.position,
    }),
  ).toBe("success");
  expect(g.elapsed).toBeLessThanOrEqual(disasterLimit(g));
  expect(g.air!.used).toBe(mode === "air" ? 1 : 0);
  return g;
}
const results: {
  seed: number;
  d: string;
  mode: string;
  time: number;
  health: number;
}[] = [];
const failures: unknown[] = [];
describe("대표 임무 108시드 × 3난이도 × 지상/항공/대피자동/무장비", () => {
  for (const d of ["easy", "normal", "hard"] as Difficulty[])
    for (const mode of ["ground", "air", "shelter", "bare"])
      for (let seed = 0; seed < 108; seed++)
        it(`${d}/${mode}/${seed}`, () => {
          try {
            const g = complete(seed, d, mode);
            results.push({
              seed,
              d,
              mode,
              time: g.elapsed,
              health: Math.round(g.health),
            });
          } catch (e) {
            failures.push({ seed, d, mode, error: String(e) });
            console.error(
              "Final Rescue failed seeds",
              JSON.stringify(failures),
            );
            throw e;
          }
        });
});
describe("통합 상태 불변식", () => {
  it("9개 검증 패턴, 동일 시드·판단 재현, 이전 임무 상태 초기화", () => {
    expect(
      new Set(
        Array.from(
          { length: 9 },
          (_, i) => fresh(i).target + finalPattern(i).index,
        ),
      ).size,
    ).toBe(9);
    const a = complete(3, "normal", "ground"),
      b = complete(3, "normal", "ground");
    for (const k of [
      "elapsed",
      "health",
      "events",
      "air",
      "cliffResult",
      "routeReport",
      "stormAt",
    ] as const)
      expect(a[k]).toEqual(b[k]);
    expect(fresh(3)).toMatchObject({
      secured: false,
      found: false,
      events: [],
      air: { status: "idle", used: 0 },
    });
    expect(fresh(3).stormAt).toBeUndefined();
  });
  it("모든 패턴의 단서가 진실이며 처음에는 정확한 위치를 누설하지 않음", () => {
    for (let seed = 0; seed < 108; seed++) {
      const g = fresh(seed);
      expect(finalClueCandidates(g)).toContain(g.target);
      expect(finalClueCandidates(g)).toHaveLength(2);
    }
  });
  it("모든 난이도·재난 경계에서 차단은 실제이며 모든 지점의 우회가 존재", () => {
    for (const d of ["easy", "normal", "hard"] as Difficulty[])
      for (let seed = 0; seed < 108; seed++) {
        const g = fresh(seed, d),
          t = worldTimes(g);
        for (const elapsed of [t.rock - 1, t.rock, t.flood, t.flood + 45]) {
          const n = { ...g, elapsed };
          expect(allRoutesSafe(n)).toBe(true);
          if (elapsed >= t.rock) {
            const [a, b] = rockEdge(n);
            expect(edgeState(n, a, b)).toBe("blocked");
            expect(
              disasterTransition(
                { ...n, position: a },
                { type: "move", to: b },
              ),
            ).toEqual({ ...n, position: a });
          }
        }
      }
  });
  it("신호 실패는 부분 정보와 비용, 정확한 수동 신호는 시간 절약", () => {
    let g = go(fresh(), "lookout");
    g = act(g, { type: "start", kind: "signal" });
    const start = g.elapsed;
    const weak = Array.from({ length: 360 }, (_, i) => i).sort(
      (a, b) => signalPower(g, a) - signalPower(g, b),
    )[0];
    for (let i = 0; i < 3; i++) g = act(g, { type: "signal", angle: weak });
    expect(g.possible).toHaveLength(2);
    expect(g.elapsed - start).toBe(20);
    expect(g.action).toBeNull();
  });
  it("로프 실패·재시도 후 완주, 미발견·미인양·미처치 성공 방지", () => {
    let g = rescue(find(fresh(2, "hard")), false, true);
    expect(g.cliffResult!.mistakes).toBe(2);
    g = go(g, "base");
    expect(g.status).toBe("success");
    expect(act(fresh(), { type: "wait" }).status).toBe("active");
    const n = find(fresh());
    expect(disasterDisabled(n, { type: "air-request" })).not.toBe("");
    expect(disasterDisabled(n, { type: "move", to: "fork" })).not.toBe("");
  });
  it("기상은 이동·로프·항공에 반영되고 대피는 노출을 줄임", () => {
    let g = rescue(find(fresh()));
    expect(disasterDisabled(g, { type: "air-request" })).not.toBe("");
    const rain = { ...g, position: "hut" };
    const shelter = act(rain, { type: "shelter" }),
      rest = act({ ...rain, stamina: 50 }, { type: "rest" });
    expect(shelter.health).toBeGreaterThan(rest.health);
    expect(shelter.health).toBeLessThan(rain.health);
    expect(shelter.elapsed - rain.elapsed).toBe(15);
    const clear = { ...g, stormAt: undefined, elapsed: 0 };
    expect(
      disasterCost(g, { type: "move", to: "fork" }).energy,
    ).toBeGreaterThan(disasterCost(clear, { type: "move", to: "fork" }).energy);
    expect(cliffRules("normal", "rain").width).toBeLessThan(
      cliffRules("normal", "clear").width,
    );
    expect(
      disasterForecast(g).some(
        (p) => p.at === g.stormAt && p.weather === "rain",
      ),
    ).toBe(true);
  });
  it("같은 행동 두 번·미니게임 재진입·연출 건너뛰기 보상 중복 방지", () => {
    let g = find(fresh());
    const revision = g.revision;
    const n = disasterTransition(
      g,
      { type: "cliff", command: { type: "auto" } },
      revision,
    );
    expect(
      disasterTransition(
        n,
        { type: "cliff", command: { type: "auto" } },
        revision,
      ),
    ).toBe(n);
    expect(
      disasterTransition(dismiss(n), {
        type: "cliff",
        command: { type: "auto" },
      }),
    ).toEqual(dismiss(n));
    const a = act(dismiss(n), { type: "aid" }),
      b = act({ ...n, scenes: [] }, { type: "aid" });
    expect(a.elapsed).toBe(b.elapsed);
    expect(a.health).toBe(b.health);
    expect(a.air).toEqual(b.air);
  });
  it("ACT는 실제 흔적·재난·발견·인양·귀환 상태를 반영", () => {
    expect(finalAct(fresh()).number).toBe(1);
    expect(finalAct({ ...fresh(), events: ["rock"] }).number).toBe(2);
    const g = find(fresh());
    expect(finalAct(g).number).toBe(4);
    expect(finalAct(rescue(g)).number).toBe(5);
    expect(finalAct(complete(0, "easy", "ground")).number).toBe(6);
  });
  afterEach(() => vi.unstubAllGlobals());
  it("기존 기록을 유지하며 신규 통합 작전 기록을 저장", () => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, v),
    });
    saveRecord({ ...createDisaster(), status: "success" }, 7, { rating: 3 });
    const g = complete(0, "normal", "air");
    saveRecord(g, 10, {
      rating: 3,
      air: { used: 1, status: g.air!.status, crewSafe: true, method: "air" },
    });
    expect(readRecords().map((x) => x.mission)).toEqual([10, 7]);
    expect(readRecords()[0].air!.crewSafe).toBe(true);
  });
  it("완주 검증 범위를 기록", () => {
    expect(results).toHaveLength(1296);
    console.log(
      "Final Rescue balance",
      ["easy", "normal", "hard"].map((d) => {
        const r = results.filter((x) => x.d === d);
        return {
          d,
          runs: r.length,
          min: Math.min(...r.map((x) => x.time)),
          max: Math.max(...r.map((x) => x.time)),
          minHealth: Math.min(...r.map((x) => x.health)),
        };
      }),
    );
  });
});
