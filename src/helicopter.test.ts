import { describe, it, expect, vi, afterEach } from "vitest";
import {
  newAir,
  requestAir,
  airMinute,
  airRequestReason,
  airDuration,
  cancelAir,
  retargetAir,
  airEta,
  airNames,
  type AirState,
  type AirContext,
} from "./helicopter";
import {
  createDisaster,
  disasterTransition,
  disasterDisabled,
  disasterCost,
  disasterWeather,
  airContext,
  safeRoute,
  edgeState,
  edgeKey,
  type DisasterGame,
  type DisasterAction,
} from "./disaster";
import { adjacent } from "./regions";
import type { Difficulty } from "./experience";
import { readRecords, saveRecord } from "./storage";
const context = (at = 0): AirContext => ({
  at,
  weather: "clear",
  position: "lookout",
  ready: true,
  health: 90,
});
const tick = (a: AirState, n: number, c = context()) => {
  for (let i = 1; i <= n; i++) a = airMinute(a, { ...c, at: c.at + i });
  return a;
};
function dismiss(g: DisasterGame) {
  while (g.scenes.length) g = disasterTransition(g, { type: "ack" });
  return g;
}
function act(g: DisasterGame, a: DisasterAction) {
  expect(
    disasterDisabled(g, a),
    JSON.stringify({
      a,
      t: g.elapsed,
      p: g.position,
      e: g.stamina,
      h: g.health,
    }),
  ).toBe("");
  return dismiss(disasterTransition(g, a));
}
const ready = (elapsed = 150): DisasterGame => ({
  ...dismiss(createDisaster(0, "normal", undefined, undefined, false, 9)),
  elapsed,
  position: "lookout",
  found: true,
  secured: true,
  treated: true,
  carried: true,
});
describe("항공 상태와 자원", () => {
  it("10단계 상태, 1회 지원과 실제 분 단위 비용", () => {
    let a = requestAir(newAir(), context());
    expect(a.status).toBe("requested");
    expect(requestAir(a, context())).toBe(a);
    expect(airEta(a)).toBe(40);
    a = tick(a, 1);
    expect(a.status).toBe("preparing");
    a = tick(a, 4);
    expect(a.status).toBe("enroute");
    a = tick(a, 15);
    expect(a.status).toBe("approach");
    a = tick(a, 5);
    expect(a.status).toBe("hoisting");
    a = tick(a, 5);
    expect(a.onboard).toBe(true);
    expect(a.status).toBe("transporting");
    a = tick(a, 10);
    expect(a.status).toBe("complete");
    expect(a.used).toBe(1);
    expect(airNames.delayed).toBeDefined();
  });
  it("발견·처치·H 지점·기상·생존이 모두 필요", () => {
    for (const c of [
      { ...context(), ready: false },
      { ...context(), health: 0 },
      { ...context(), position: "cave" },
      ...(["wind", "rain", "fog", "snow"] as const).map((weather) => ({
        ...context(),
        weather,
      })),
      { ...context(), position: "ridge", weather: "drizzle" as const },
    ])
      expect(airRequestReason(newAir(), c)).not.toBe("");
    const rain = requestAir(newAir(), { ...context(), weather: "drizzle" });
    expect(airDuration(rain, "enroute")).toBe(20);
  });
  it("기상 악화 지연→회복, 30분 초과 시 복귀", () => {
    let a = tick(requestAir(newAir(), context()), 5);
    a = tick(a, 10, { ...context(), weather: "wind" });
    expect(a.status).toBe("delayed");
    a = tick(a, 1);
    expect(a.status).toBe("enroute");
    a = tick(a, 30, { ...context(), weather: "rain" });
    expect(a.status).toBe("returning");
    a = tick(a, 10);
    expect(a.status).toBe("cancelled");
    expect(airRequestReason(a, context())).not.toBe("");
  });
  it("지상 전환과 새 지점 변경은 자원을 복원하지 않음", () => {
    const a = requestAir(newAir(), context());
    const moved = retargetAir(a, { ...context(), position: "hut" });
    expect(moved.target).toBe("hut");
    expect(moved.status).toBe("enroute");
    expect(moved.used).toBe(1);
    expect(cancelAir(moved, 10).status).toBe("returning");
    const onboard = {
      ...moved,
      onboard: true,
      status: "transporting" as const,
    };
    expect(cancelAir(onboard, 10)).toBe(onboard);
  });
  it("사망 및 현장 부재는 인양하지 않음", () => {
    let a = tick(requestAir(newAir(), context()), 25);
    expect(a.status).toBe("hoisting");
    expect(tick(a, 5, { ...context(), position: "gate" }).onboard).toBe(false);
    expect(tick(a, 1, { ...context(), health: 0 }).status).toBe("cancelled");
  });
});
describe("항공과 중앙 게임 시계", () => {
  it("조난자 이송 완료만으로 성공 금지, 본부 복귀 후 성공", () => {
    let g = act(ready(), { type: "air-request" });
    expect(g.elapsed).toBe(152);
    for (let i = 0; i < 4; i++) g = act(g, { type: "wait" });
    expect(g.air!.status).toBe("complete");
    expect(g.status).toBe("active");
    expect(g.position).toBe("lookout");
    const h = g.health,
      c = disasterCost(g, { type: "move", to: "gate" });
    expect(c.time).toBe(10);
    g = act(g, { type: "move", to: "gate" });
    g = act(g, { type: "move", to: "base" });
    expect(g.health).toBe(h);
    expect(g.status).toBe("success");
    expect(disasterTransition(g, { type: "air-request" })).toBe(g);
  });
  it("기상 경계를 행동 도중에도 재검사, 진행 중 이동은 현장 대기 아님", () => {
    let g = act(ready(40), { type: "air-request" });
    g = act(g, { type: "wait" });
    g = act(g, { type: "wait" });
    expect(disasterWeather(g)).toBe("wind");
    expect(g.air!.status).toBe("delayed");
    g = act(g, { type: "air-cancel" });
    expect(g.air!.status).toBe("returning");
    g = act(g, { type: "wait" });
    expect(g.air!.status).toBe("cancelled");
    const moving = {
      ...ready(),
      air: {
        ...requestAir(newAir(), context()),
        status: "hoisting" as const,
        phase: 4,
      },
    };
    expect(act(moving, { type: "move", to: "gate" }).air!.onboard).toBe(false);
  });
  it("연출 확인·건너뛰기는 시간·비용·이송 결과 불변", () => {
    const g = disasterTransition(ready(), { type: "air-request" });
    expect(g.scenes).toContain("air-request");
    expect(disasterTransition(g, { type: "wait" })).toBe(g);
    const n = dismiss(g),
      skipped = { ...g, scenes: [] };
    expect(n.elapsed).toBe(g.elapsed);
    expect(n.air).toEqual(skipped.air);
    const a = act(n, { type: "wait" }),
      b = act(skipped, { type: "wait" });
    expect(a.air).toEqual(b.air);
    expect(a.health).toBe(b.health);
    expect(a.stamina).toBe(b.stamina);
    expect(disasterTransition(a, { type: "air-request" }, g.revision)).toBe(a);
  });
  it("도착 전 상태 0과 제한 시간 종료는 성공 불가", () => {
    let g = act(ready(), { type: "air-request" });
    g = act({ ...g, health: 0.01 }, { type: "wait" });
    expect(g.status).toBe("failed");
    expect(g.air!.onboard).toBe(false);
    expect(disasterTransition(g, { type: "wait" })).toBe(g);
  });
});
function care(g: DisasterGame, cost = 0) {
  if (
    g.secured &&
    !g.air?.onboard &&
    g.health < 45 &&
    g.equipment.includes("kit") &&
    g.kitUses < 2
  )
    g = act(g, { type: "kit" });
  for (let i = 0; i < 6 && g.stamina < cost + 14; i++)
    g = act(g, { type: "rest" });
  return g;
}
function go(g: DisasterGame, to: string) {
  for (let i = 0; i < 70 && g.position !== to && g.status === "active"; i++) {
    const r = safeRoute(g, g.position, to)!;
    for (const neighbor of adjacent(g.position, 9)) {
      if (
        ["blocked", "restricted"].includes(edgeState(g, g.position, neighbor))
      ) {
        const clean = {
          ...g,
          cleared: [...g.cleared, edgeKey(g.position, neighbor)],
        };
        if (safeRoute(clean, g.position, to)!.length + 1 < r.length) {
          g = care(g, 5);
          g = act(g, {
            type: "mitigate",
            to: neighbor,
            method: g.equipment.includes("rope") ? "rope" : "wait",
          });
          break;
        }
      }
    }
    let next = safeRoute(g, g.position, to)![0];
    g = care(g, disasterCost(g, { type: "move", to: next }).energy);
    next = safeRoute(g, g.position, to)![0];
    g = act(g, { type: "move", to: next });
  }
  return g;
}
describe("항공 임무 108시드 × 3난이도 × 지상/항공/무장비항공", () => {
  for (const d of ["easy", "normal", "hard"] as Difficulty[])
    for (const mode of ["ground", "air", "bare"])
      for (let seed = 0; seed < 108; seed++)
        it(`${d}/${mode}/${seed}`, () => {
          let g = dismiss(
            createDisaster(
              seed,
              d,
              mode === "bare" ? [] : ["rope", "kit", "blanket"],
              undefined,
              false,
              9,
            ),
          );
          g = go(g, "lookout");
          g = act(g, { type: "start", kind: "signal" });
          g = act(g, { type: "auto" });
          g = go(g, g.possible[0]);
          g = care(g, 10);
          g = act(g, { type: "search" });
          g = act(g, { type: "aid" });
          if (g.equipment.includes("blanket")) g = act(g, { type: "blanket" });
          if (mode !== "ground") {
            const target = ["lookout", "hut", "pine"].sort(
              (a, b) =>
                safeRoute(g, g.position, a)!.length -
                safeRoute(g, g.position, b)!.length,
            )[0];
            g = go(g, target);
            for (
              let i = 0;
              i < 30 && airRequestReason(g.air!, airContext(g));
              i++
            ) {
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
              t: g.elapsed,
              h: g.health,
              p: g.position,
              a: g.air!.status,
            }),
          ).toBe("success");
          expect(g.air!.used).toBe(mode === "ground" ? 0 : 1);
        });
});
describe("항공 기록", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("기존 임무와 항공 방식·팀 귀환 기록 보존", () => {
    const m = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => m.set(k, v),
    });
    saveRecord({ ...createDisaster(0), status: "success" }, 7, { rating: 3 });
    saveRecord({ ...ready(), position: "base", status: "success" }, 9, {
      rating: 3,
      air: { used: 1, status: "complete", crewSafe: true, method: "air" },
    });
    expect(readRecords()).toHaveLength(2);
    expect(readRecords()[0].air).toEqual({
      used: 1,
      status: "complete",
      crewSafe: true,
      method: "air",
    });
  });
});
