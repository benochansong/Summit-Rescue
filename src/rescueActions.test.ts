import { describe, it, expect, vi, afterEach } from "vitest";
import {
  beginCliff,
  cliffRules,
  cliffStep,
  cliffResult,
  tensionAt,
  type CliffCommand,
} from "./rescueActions";
import {
  createDisaster,
  disasterTransition,
  disasterDisabled,
  disasterCost,
  signalBearing,
  safeRoute,
  edgeKey,
  edgeState,
  type DisasterGame,
  type DisasterAction,
} from "./disaster";
import { adjacent } from "./regions";
import type { Difficulty } from "./experience";
import {
  saveRecord,
  readRecords,
  readCareer,
  readSettings,
  saveSettings,
} from "./storage";
const dismiss = (g: DisasterGame) => {
  while (g.scenes.length) g = disasterTransition(g, { type: "ack" });
  return g;
};
function act(g: DisasterGame, a: DisasterAction) {
  expect(
    disasterDisabled(g, a),
    JSON.stringify({ a, t: g.elapsed, p: g.position, st: g.stamina }),
  ).toBe("");
  return dismiss(disasterTransition(g, a));
}
const cmd = (g: DisasterGame, c: CliffCommand) =>
  act(g, { type: "cliff", command: c });
function care(g: DisasterGame, energy: number) {
  if (
    g.secured &&
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
  for (let i = 0; i < 80 && g.status === "active" && g.position !== to; i++) {
    const r = safeRoute(g, g.position, to)!;
    expect(r).not.toBeNull();
    for (const a of adjacent(g.position, 7)) {
      if (["blocked", "restricted"].includes(edgeState(g, g.position, a))) {
        const clean = { ...g, cleared: [...g.cleared, edgeKey(g.position, a)] },
          short = safeRoute(clean, g.position, to)!;
        if (short.length + 1 < r.length) {
          g = care(g, 5);
          g = act(g, {
            type: "mitigate",
            to: a,
            method: g.equipment.includes("rope") ? "rope" : "wait",
          });
          break;
        }
      }
    }
    const next = safeRoute(g, g.position, to)![0];
    g = care(g, disasterCost(g, { type: "move", to: next }).energy);
    g = act(g, { type: "move", to: safeRoute(g, g.position, to)![0] });
  }
  return g;
}
describe("절벽 액션 상태", () => {
  it("3고정→3하강→접근→인양, 상태는 불변이고 비용은 확정 전 0", () => {
    let s = beginCliff();
    const before = structuredClone(s);
    s = cliffStep(s, { type: "begin" }, "normal", "clear", true);
    expect(before).toEqual(beginCliff());
    for (let i = 0; i < 3; i++)
      s = cliffStep(s, { type: "tension", value: 50 }, "normal", "clear", true);
    expect(s.stage).toBe("descent");
    for (let i = 0; i < 3; i++)
      s = cliffStep(s, { type: "descend", speed: 50 }, "normal", "clear", true);
    expect(s.stage).toBe("approach");
    s = cliffStep(s, { type: "approach" }, "normal", "clear", true);
    expect(s.stage).toBe("hoist");
    expect(cliffResult(s, false, true)).toMatchObject({
      time: 10,
      energy: 5,
      bonus: 20,
    });
  });
  it("실수 복구·자동 지원·장비 부재의 정확한 비용", () => {
    let s = cliffStep(beginCliff(), { type: "begin" }, "hard", "wind", true);
    s = cliffStep(s, { type: "tension", value: 0 }, "hard", "wind", true);
    s = cliffStep(s, { type: "tension", value: 100 }, "hard", "wind", true);
    expect(s.stage).toBe("recover");
    expect(cliffResult(s, false, true)).toMatchObject({ time: 16, energy: 9 });
    s = cliffStep(s, { type: "retry" }, "hard", "wind", true);
    expect(s.stage).toBe("tension");
    expect(cliffResult(s, true, false)).toMatchObject({
      time: 42,
      energy: 12,
      bonus: 0,
    });
    expect(
      cliffStep(beginCliff(), { type: "begin" }, "normal", "clear", false)
        .stage,
    ).toBe("prepare");
  });
  it("하강 속도의 시간·체력 차이", () => {
    const s = { ...beginCliff(), stage: "descent" as const };
    const slow = cliffStep(
        s,
        { type: "descend", speed: 10 },
        "normal",
        "clear",
        true,
      ),
      fast = cliffStep(
        s,
        { type: "descend", speed: 90 },
        "normal",
        "clear",
        true,
      );
    expect(cliffResult(slow, false, true).time).toBe(12);
    expect(cliffResult(fast, false, true).energy).toBe(7);
    expect(fast.stability).toBe(85);
  });
  it("난이도·기상별 공정한 안전 구간과 게이지 속도", () => {
    expect(cliffRules("easy", "clear").width).toBeGreaterThan(
      cliffRules("hard", "wind").width,
    );
    expect(cliffRules("easy", "clear").period).toBeGreaterThan(
      cliffRules("hard", "wind").period,
    );
    for (const d of ["easy", "normal", "hard"] as Difficulty[]) {
      const values = Array.from({ length: 100 }, (_, i) =>
        tensionAt(i * 100, d, "wind"),
      );
      expect(values.every((v) => v >= 0 && v <= 100)).toBe(true);
      expect(
        values.some((v) => Math.abs(v - 50) < cliffRules(d, "wind").width / 2),
      ).toBe(true);
    }
  });
  it("중단·재개·잘못된 입력은 비용과 상태를 손상시키지 않음", () => {
    let g = dismiss(createDisaster(0, "normal", ["rope"], undefined, false, 8));
    g = { ...g, position: "cave", found: true, cliff: beginCliff() };
    const elapsed = g.elapsed;
    g = cmd(g, { type: "begin" });
    g = cmd(g, { type: "pause" });
    expect(
      disasterTransition(g, {
        type: "cliff",
        command: { type: "tension", value: 50 },
      }),
    ).toBe(g);
    g = cmd(g, { type: "suspend" });
    g = act({ ...g, stamina: 50 }, { type: "rest" });
    g = cmd(g, { type: "resume" });
    expect(g.cliff!.stage).toBe("tension");
    expect(g.elapsed).toBe(elapsed + 15);
    expect(
      disasterTransition(g, { type: "cliff", command: { type: "finish" } }),
    ).toBe(g);
    expect(
      disasterTransition(g, {
        type: "cliff",
        command: { type: "tension", value: NaN },
      }),
    ).toBe(g);
  });
  it("최종 비용·보상은 한 번, 발견과 인양만으로 귀환 성공 금지", () => {
    let g = {
      ...dismiss(createDisaster(0, "normal", ["rope"], undefined, false, 8)),
      found: true,
      position: "cave",
      cliff: beginCliff(),
    };
    const n = cmd(g, { type: "auto" });
    expect(n.elapsed).toBe(30);
    expect(n.stamina).toBe(88);
    expect(n.status).toBe("active");
    expect(n.secured && n.carried).toBe(true);
    expect(
      disasterTransition(
        n,
        { type: "cliff", command: { type: "auto" } },
        g.revision,
      ),
    ).toBe(n);
    expect(disasterTransition(n, { type: "move", to: "fork" })).toBe(n);
  });
  it("두 번 연속 실제 방향 포착, 틀린 방향은 초기화", () => {
    let g = {
      ...dismiss(createDisaster(2, "normal", undefined, undefined, false, 8)),
      position: "lookout",
    };
    g = act(g, { type: "start", kind: "signal" });
    g = act(g, { type: "signal", angle: signalBearing(g) });
    expect(g.analyzed).toBe(false);
    expect(g.action!.steady).toBe(1);
    g = act(g, { type: "signal", angle: (signalBearing(g) + 180) % 360 });
    expect(g.action!.steady).toBe(0);
    g = act(g, { type: "signal", angle: signalBearing(g) });
    g = act(g, { type: "signal", angle: signalBearing(g) });
    expect(g.possible).toEqual([g.target]);
  });
});
describe("절벽 임무 108시드 × 3난이도 × 수동/자동/무장비", () => {
  for (const difficulty of ["easy", "normal", "hard"] as Difficulty[])
    for (const mode of ["manual", "auto", "bare"])
      for (let seed = 0; seed < 108; seed++)
        it(`${difficulty}/${mode}/${seed}`, () => {
          let g = dismiss(
            createDisaster(
              seed,
              difficulty,
              mode === "bare" ? [] : ["rope", "kit", "blanket"],
              undefined,
              false,
              8,
            ),
          );
          g = go(g, "lookout");
          g = act(g, { type: "start", kind: "signal" });
          g = act(g, { type: "auto" });
          g = go(g, g.possible[0]);
          g = care(g, 18);
          g = act(g, { type: "search" });
          expect(g.cliff!.stage).toBe("prepare");
          const time = g.elapsed;
          if (mode === "manual") {
            g = cmd(g, { type: "begin" });
            for (let i = 0; i < 3; i++)
              g = cmd(g, { type: "tension", value: 50 });
            for (let i = 0; i < 3; i++)
              g = cmd(g, { type: "descend", speed: 50 });
            g = cmd(g, { type: "approach" });
            expect(g.elapsed).toBe(time);
            g = cmd(g, { type: "finish" });
          } else g = cmd(g, { type: "auto" });
          g = act(g, { type: "aid" });
          if (g.equipment.includes("blanket")) g = act(g, { type: "blanket" });
          g = go(g, "base");
          expect(
            g.status,
            JSON.stringify({
              t: g.elapsed,
              h: g.health,
              p: g.position,
              e: g.stamina,
            }),
          ).toBe("success");
          expect(g.cliffResult?.automatic).toBe(mode !== "manual");
        });
});
describe("절벽 기록 호환", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("기존 기록·설정 보존, 액션 보너스 중복 없음", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
    saveSettings({
      sound: false,
      volume: 0.2,
      motion: false,
      skipDialogue: true,
    });
    const legacy = { ...createDisaster(1), status: "success" as const };
    saveRecord(legacy, 7, { difficulty: "normal", rating: 3 });
    const g = {
      ...createDisaster(1, "normal", undefined, undefined, false, 8),
      status: "success" as const,
    };
    saveRecord(g, 8, { difficulty: "normal", rating: 3, bonus: 20 });
    saveRecord(g, 8, { difficulty: "normal", rating: 3, bonus: 20 });
    expect(readRecords()).toHaveLength(2);
    expect(readCareer().xp).toBe(370);
    expect(readSettings().motion).toBe(false);
  });
});
