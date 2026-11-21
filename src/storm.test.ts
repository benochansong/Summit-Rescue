import { describe, expect, it } from "vitest";
import {
  actionCost,
  advance,
  candidates,
  choicesFor,
  connection,
  createGame,
  disabledReason,
  transition,
} from "./game";
import type { Action, Game } from "./game";
import {
  equipment,
  forecast,
  missions,
  normalizeEquipment,
  schedule,
  weatherAt,
} from "./conditions";
import type { Equipment } from "./conditions";

function resolve(g: Game): Game {
  if (!g.pending) return g;
  const choices = choicesFor(g);
  const choice =
    g.pending.kind === "signal"
      ? "continue"
      : g.pending.kind === "cold"
        ? g.equipment.includes("blanket")
          ? "blanket"
          : "warm"
        : g.pending.kind === "river"
          ? g.equipment.includes("rope")
            ? "rope"
            : "detour"
          : "wait";
  const selected = choices.find((c) => c.id === choice)!;
  if (g.stamina < selected.cost.energy && g.pending.to) {
    g = transition(g, { type: "choose", choice: "cancel" });
    g = transition(g, { type: "rest" });
    return g;
  }
  return transition(g, { type: "choose", choice });
}
function act(g: Game, a: Action): Game {
  if (g.pending) g = resolve(g);
  if (g.stamina < actionCost(g, a).energy) g = transition(g, { type: "rest" });
  let n = transition(g, a);
  if (n.pending) n = resolve(n);
  if (a.type === "move" && n.position !== a.to && n.status === "active") {
    n = transition(n, a);
    if (n.pending) n = resolve(n);
  }
  return n;
}
function rescue(seed: number, items: Equipment[], safe = false): Game {
  let g = createGame(seed, 2, items);
  for (const to of ["gate", "lookout"]) g = act(g, { type: "move", to });
  g = act(g, { type: "search" });
  const route =
    safe && g.target !== "cedar"
      ? [
          "pine",
          "bridge",
          "valley",
          ...(g.target === "cave" ? ["waterfall", "cave"] : []),
        ]
      : ["fork", g.target];
  for (const to of route) g = act(g, { type: "move", to });
  g = act(g, { type: "search" });
  expect(g.found).toBe(true);
  g = act(g, { type: "aid" });
  const back =
    safe && g.target !== "cedar"
      ? [
          ...(g.target === "cave" ? ["waterfall", "valley"] : []),
          "bridge",
          "pine",
          "lower",
          "base",
        ]
      : ["fork", "lookout", "gate", "base"];
  for (const to of back) g = act(g, { type: "move", to });
  return g;
}
describe("폭풍 전야 실제 구조 경로", () => {
  const loadouts: Equipment[][] = [
    ["kit", "blanket", "rope"],
    ["lantern", "drone", "blanket"],
    ["kit", "lantern", "drone"],
    [],
  ];
  for (let seed = 0; seed < 3; seed++)
    for (const safe of [false, true])
      for (const items of loadouts)
        it(`${candidates[seed]} / ${safe ? "숲길" : "직접 경로"} / ${items.join(",") || "장비 없음"}`, () => {
          const g = rescue(seed, items, safe);
          expect(
            g.status,
            JSON.stringify({
              time: g.elapsed,
              stamina: g.stamina,
              health: g.health,
              position: g.position,
              log: g.log,
            }),
          ).toBe("success");
          expect(g.elapsed).toBeLessThanOrEqual(missions[2].limit);
          expect(g.health).toBeGreaterThan(0);
          for (let i = 1; i < g.trail.length; i++)
            expect(connection(g.trail[i - 1], g.trail[i])).toBeDefined();
        });
});
describe("날씨와 장비", () => {
  it("예보와 실제 기상이 같은 타임라인을 사용", () => {
    for (const p of schedule(2)) {
      expect(weatherAt(2, p.at)).toBe(p.weather);
      if (p.at > 0) expect(forecast(2, p.at - 1)).toContain("1분 후");
    }
    expect(weatherAt(1, 179)).toBe("clear");
  });
  it("날씨 경계를 넘는 상태 감소를 구간별로 적분", () => {
    const g = { ...createGame(0, 2), elapsed: 65 };
    const n = advance(g, { time: 10, energy: 0 });
    expect(n.health).toBeCloseTo(85 - 5 * 0.21 - 5 * 0.31);
    expect(
      advance(advance(g, { time: 5, energy: 0 }), { time: 5, energy: 0 })
        .health,
    ).toBeCloseTo(n.health);
  });
  it("안개·야간·랜턴 수색 비용", () => {
    const g = { ...createGame(0, 2, []), elapsed: 40 };
    expect(actionCost(g, { type: "search" }).time).toBe(20);
    expect(actionCost({ ...g, elapsed: 140 }, { type: "search" }).time).toBe(
      25,
    );
    expect(
      actionCost(
        { ...g, elapsed: 140, equipment: ["lantern"] },
        { type: "search" },
      ).time,
    ).toBe(15);
  });
  it("폭우 체력과 폭설 이동 비용", () => {
    const g = { ...createGame(0, 2), elapsed: 70 };
    expect(actionCost(g, { type: "move", to: "gate" })).toEqual({
      time: 10,
      energy: 7,
    });
    expect(
      actionCost({ ...g, elapsed: 190 }, { type: "move", to: "gate" }),
    ).toEqual({ time: 13, energy: 5 });
  });
  it("로프가 가파른 길의 체력 소모를 감소", () => {
    const g = { ...createGame(0, 2, []), position: "cedar" };
    expect(
      actionCost(g, { type: "move", to: "ridge" }).energy -
        actionCost({ ...g, equipment: ["rope"] }, { type: "move", to: "ridge" })
          .energy,
    ).toBe(4);
  });
  it("방한포가 추위 악화만 감소", () => {
    const g = { ...createGame(0, 2, ["blanket"]), elapsed: 190, found: true };
    const n = transition(g, { type: "blanket" });
    expect(n.insulated).toBe(true);
    expect(advance(n, { time: 20, energy: 0 }).health).toBeGreaterThan(
      advance({ ...n, insulated: false }, { time: 20, energy: 0 }).health,
    );
    expect(disabledReason(n, { type: "blanket" })).not.toBe("");
  });
  it("응급키트는 2회로 제한되고 기본 처치와 분리", () => {
    let g = {
      ...createGame(0, 2, ["kit"]),
      found: true,
      position: "gate",
      health: 40,
    };
    g = transition(g, { type: "kit" });
    expect(g.health).toBeGreaterThan(60);
    g = transition(g, { type: "kit" });
    expect(g.kitUses).toBe(2);
    expect(transition(g, { type: "kit" })).toBe(g);
    expect(disabledReason(g, { type: "aid" })).toBe("");
  });
  it("드론은 인근 단서 탐지, 2회 제한, 강풍 차단", () => {
    let g = { ...createGame(1, 2, ["drone"]), position: "lookout" };
    g = transition(g, { type: "drone" });
    expect(g.clues[0].text).toContain("물소리 계곡");
    g = transition(g, { type: "drone" });
    expect(g.droneUses).toBe(2);
    expect(transition(g, { type: "drone" })).toBe(g);
    const windy = { ...createGame(1, 2, ["drone"]), elapsed: 130 };
    expect(transition(windy, { type: "drone" })).toBe(windy);
  });
  it("멀리 있는 드론은 조난자 위치를 공개하지 않음", () => {
    const g = transition(createGame(1, 2, ["drone"]), { type: "drone" });
    expect(g.clues[0].text).not.toContain("물소리 계곡");
  });
  it("3슬롯 및 중복·잘못된 장비 정규화", () => {
    expect(
      normalizeEquipment([...equipment.map((e) => e.id), "kit"]),
    ).toHaveLength(3);
    expect(normalizeEquipment(["kit", "kit"])).toEqual(["kit"]);
  });
  it("같은 시드는 동일한 임무를 재현하지만 기록 ID는 다름", () => {
    const a = createGame(123, 2),
      b = createGame(123, 2);
    expect(a.target).toBe(b.target);
    expect(a.runId).not.toBe(b.runId);
  });
});
describe("상황 이벤트와 안정성", () => {
  it("급류 선택 전에는 비용을 적용하지 않고 선택 후 한 번만 적용", () => {
    const g = { ...createGame(1, 2), position: "fork", elapsed: 80 };
    const pending = transition(g, { type: "move", to: "valley" });
    expect(pending.pending?.kind).toBe("river");
    expect(pending.elapsed).toBe(80);
    const c = choicesFor(pending).find((c) => c.id === "rope")!;
    const n = transition(pending, { type: "choose", choice: "rope" });
    expect(n.elapsed).toBe(80 + c.cost.time);
    expect(n.stamina).toBe(100 - c.cost.energy);
    expect(n.position).toBe("valley");
    expect(
      transition(n, { type: "choose", choice: "rope" }, pending.revision),
    ).toBe(n);
  });
  it("장비 없는 우회도 실제 연결된 경로를 따라 이동", () => {
    const g = transition(
      { ...createGame(1, 2, []), position: "fork", elapsed: 80 },
      { type: "move", to: "valley" },
    );
    expect(disabledReason(g, { type: "choose", choice: "rope" })).not.toBe("");
    const n = transition(g, { type: "choose", choice: "detour" });
    expect(n.position).toBe("valley");
    expect(n.trail).toContain("bridge");
    expect(n.elapsed).toBe(120);
  });
  it("강풍에서 대기·우회·위험 통과의 결과가 다름", () => {
    const g = transition(
      { ...createGame(2, 2), position: "fork", elapsed: 130, found: true },
      { type: "move", to: "cave" },
    );
    expect(g.pending?.kind).toBe("ridge");
    const wait = transition(g, { type: "choose", choice: "wait" }),
      risk = transition(g, { type: "choose", choice: "risk" }),
      detour = transition(g, { type: "choose", choice: "detour" });
    expect(wait.elapsed).toBeGreaterThan(risk.elapsed);
    expect(wait.stamina).toBeGreaterThan(risk.stamina);
    expect(wait.health).toBeGreaterThan(risk.health);
    expect(detour.trail).toContain("waterfall");
  });
  it("장비 없는 저체온에도 대응 가능", () => {
    const g = {
      ...createGame(0, 2, []),
      found: true,
      pending: { kind: "cold" as const, key: "cold" },
      elapsed: 90,
    };
    const n = transition(g, { type: "choose", choice: "warm" });
    expect(n.pending).toBeNull();
    expect(n.resolved).toContain("cold");
    expect(n.elapsed).toBe(102);
  });
  it("호루라기 조사와 기존 계획은 서로 다른 결과", () => {
    const g = {
      ...createGame(2, 2),
      position: "fork",
      pending: { kind: "signal" as const, key: "signal" },
    };
    const search = transition(g, { type: "choose", choice: "focus" }),
      skip = transition(g, { type: "choose", choice: "continue" });
    expect(search.clues[0].text).toContain("바위 그늘");
    expect(skip.clues).toHaveLength(0);
    expect(search.elapsed).toBe(skip.elapsed + 10);
  });
  it("체력 부족 행동과 순간이동 차단, 취소 후 휴식 가능", () => {
    const g = { ...createGame(1, 2), stamina: 1 };
    expect(transition(g, { type: "move", to: "gate" })).toBe(g);
    expect(transition(g, { type: "move", to: "cave" })).toBe(g);
    expect(transition(g, { type: "rest" }).stamina).toBe(16);
  });
  it("사망 후 같은 행동의 치료로 부활하지 않음", () => {
    const g = { ...createGame(1, 2), health: 1, found: true };
    expect(transition(g, { type: "kit" }).status).toBe("failed");
  });
  it("응급처치 후에도 귀환 중 생존 상태 감소", () => {
    const g = {
      ...createGame(1, 2),
      found: true,
      treated: true,
      health: 70,
      position: "gate",
    };
    const n = transition(g, { type: "move", to: "base" });
    expect(n.status).toBe("success");
    expect(n.health).toBeLessThan(70);
    expect(transition(n, { type: "rest" })).toBe(n);
  });
  it("다양한 명령에서 체력·생존 상태·시간 불변식 유지", () => {
    let g = createGame(52, 2);
    for (let i = 0; i < 200; i++) {
      const a: Action =
        i % 4 === 0
          ? { type: "rest" }
          : i % 4 === 1
            ? { type: "search" }
            : i % 4 === 2
              ? { type: "move", to: "gate" }
              : { type: "move", to: "base" };
      const old = g;
      g = transition(g, a);
      expect(g.elapsed).toBeGreaterThanOrEqual(old.elapsed);
      expect(g.stamina).toBeGreaterThanOrEqual(0);
      expect(g.stamina).toBeLessThanOrEqual(100);
      expect(g.health).toBeGreaterThanOrEqual(0);
      expect(g.health).toBeLessThanOrEqual(100);
      if (old.status !== "active") expect(g).toBe(old);
    }
  });
});
