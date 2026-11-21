import { describe, expect, it } from "vitest";
import {
  actionCost,
  createGame,
  disabledReason,
  earnedXp,
  signalStrength,
  stars,
  transition,
} from "./game";
import type { Action, Game } from "./game";
import { adjacent, graphDistance, regionFor } from "./regions";
import { missionIds, recommendations, schedule, weatherAt } from "./conditions";
import type { MissionId } from "./conditions";
import { train, zeroSkills } from "./progression";

function path(g: Game, to: string, safe = false): string[] {
  const queue = [{ id: g.position, path: [] as string[] }],
    seen = new Set([g.position]);
  while (queue.length) {
    const n = queue.shift()!;
    if (n.id === to) return n.path;
    for (const id of adjacent(n.id, g.mission)) {
      const edge = regionFor(g.mission).edges.find(
        (e) => (e.a === n.id && e.b === id) || (e.a === id && e.b === n.id),
      )!;
      if (seen.has(id) || (safe && edge.risk)) continue;
      seen.add(id);
      queue.push({ id, path: [...n.path, id] });
    }
  }
  throw Error("Disconnected");
}
function act(g: Game, a: Action): Game {
  while (g.stamina < actionCost(g, a).energy && g.status === "active")
    g = transition(g, { type: "rest" });
  const reason = disabledReason(g, a);
  expect(reason, `${g.mission}/${g.seed} ${JSON.stringify(a)}`).toBe("");
  return transition(g, a);
}
function walk(g: Game, to: string, safe = false): Game {
  for (const id of path(g, to, safe)) g = act(g, { type: "move", to: id });
  return g;
}
export function operationRescue(
  mission: MissionId,
  seed: number,
  safe = true,
): Game {
  let g = createGame(seed, mission, [...recommendations[mission]]);
  if (mission === 3) {
    g = walk(g, "listening");
    g = act(g, { type: "search" });
    g = act(g, { type: "scan" });
    g = walk(g, "radioWest");
    g = act(g, { type: "scan" });
    if (g.possible.length > 1) {
      g = walk(g, "bridge");
      g = act(g, { type: "scan" });
    }
    expect(g.possible).toEqual([g.target]);
  }
  if (mission === 4) {
    g = walk(g, "lookout", safe);
    g = act(g, { type: "search" });
  }
  if (mission === 5) {
    g = walk(g, "hut");
    g = act(g, { type: "search" });
    g = walk(g, "lookout");
    while (disabledReason(g, { type: "scan" })) g = act(g, { type: "wait" });
    g = act(g, { type: "scan" });
    if (g.possible.length > 1) {
      g = walk(g, "creek");
      while (disabledReason(g, { type: "scan" })) g = act(g, { type: "wait" });
      g = act(g, { type: "scan" });
    }
    expect(g.possible).toEqual([g.target]);
  }
  g = walk(g, g.target, safe);
  g = act(g, { type: "search" });
  expect(g.found).toBe(true);
  g = act(g, { type: "aid" });
  if (mission === 5) g = act(g, { type: "blanket" });
  if (g.health < 65 && g.equipment.includes("kit")) g = act(g, { type: "kit" });
  if (mission === 5) {
    const shelter =
      graphDistance(g.position, "nighthut", 5) <
      graphDistance(g.position, "hut", 5)
        ? "nighthut"
        : "hut";
    g = walk(g, shelter);
    g = act(g, { type: "shelter" });
  }
  g = walk(g, "base", safe);
  return g;
}
describe("지역별 구조 작전", () => {
  for (const mission of [3, 4, 5] as const)
    for (let seed = 0; seed < 9; seed++)
      it(`임무 ${mission} · 후보/기상 조합 시드 ${seed} · 성장 없이 성공`, () => {
        const g = operationRescue(mission, seed);
        expect(
          g.status,
          JSON.stringify({
            mission,
            seed,
            time: g.elapsed,
            health: g.health,
            stamina: g.stamina,
            log: g.log,
          }),
        ).toBe("success");
        expect(g.health).toBeGreaterThan(0);
      });
  for (let seed = 0; seed < 9; seed++)
    it(`암릉의 로프 빠른 경로도 성공 ${seed}`, () =>
      expect(operationRescue(4, seed, false).status).toBe("success"));
  it("지역마다 독립된 15개 이상 지점, 고립 노드 없음", () => {
    for (const mission of missionIds) {
      const r = regionFor(mission);
      expect(r.points.length).toBeGreaterThanOrEqual(15);
      for (const p of r.points)
        expect(graphDistance("base", p.id, mission)).toBeLessThan(Infinity);
      for (const e of r.edges) {
        expect(r.points.some((p) => p.id === e.a)).toBe(true);
        expect(r.points.some((p) => p.id === e.b)).toBe(true);
      }
    }
    expect(regionFor(3).edges).not.toEqual(regionFor(4).edges);
    expect(regionFor(4).edges).not.toEqual(regionFor(5).edges);
  });
  it("동일한 시드는 후보와 예보를 재현하고 검증된 세 기상 패턴만 생성", () => {
    for (const m of [3, 4, 5] as const) {
      for (let seed = 0; seed < 9; seed++) {
        expect(createGame(seed, m).target).toBe(createGame(seed, m).target);
        expect(schedule(m, seed)).toEqual(schedule(m, seed + 9));
      }
      expect(schedule(m, 0)).not.toEqual(schedule(m, 3));
    }
  });
  it("신호는 경로 거리로 결정되며 분석 후에도 진짜 후보가 남음", () => {
    for (let seed = 0; seed < 9; seed++) {
      let g = createGame(seed, 3);
      for (const node of regionFor(3).points) {
        g = { ...g, position: node.id, elapsed: 0, stamina: 100 };
        g = transition(g, { type: "scan" });
        expect(g.possible).toContain(g.target);
        expect(g.readings.at(-1)!.strength).toBe(
          signalStrength(node.id, g.target, 3),
        );
      }
    }
  });
  it("오래된 발자국은 미확인으로 표시하고 현장에서 오류를 해소", () => {
    let g = { ...createGame(1, 3), position: "listening" };
    g = transition(g, { type: "search" });
    expect(g.clues.at(-1)!.text).toContain("미확인");
    g = { ...g, position: "echo" };
    g = transition(g, { type: "search" });
    expect(g.clues.at(-1)!.text).toContain("순찰 흔적");
  });
  it("강풍 통행 제한·우회·부상자 처치 제약", () => {
    let g = { ...createGame(0, 4, []), position: "gate" };
    expect(disabledReason(g, { type: "move", to: "lookout" })).toContain(
      "통행 제한",
    );
    expect(disabledReason(g, { type: "move", to: "shelter" })).toBe("");
    g = { ...g, equipment: ["rope"] };
    expect(disabledReason(g, { type: "move", to: "lookout" })).toBe("");
    g = { ...g, found: true };
    expect(disabledReason(g, { type: "move", to: "shelter" })).toContain(
      "응급처치",
    );
  });
  it("야간의 랜턴·간헐 신호·보온 후 귀환", () => {
    const g = { ...createGame(0, 5, []), elapsed: 31, position: "lookout" };
    expect(actionCost(g, { type: "search" }).time).toBe(
      actionCost({ ...g, equipment: ["lantern"] }, { type: "search" }).time +
        10,
    );
    expect(disabledReason({ ...g, elapsed: 46 }, { type: "scan" })).toContain(
      "불빛",
    );
    const home = transition(
      { ...g, position: "gate", found: true, treated: true, elapsed: 70 },
      { type: "move", to: "base" },
    );
    expect(home.status).toBe("active");
    expect(
      transition({ ...home, position: "hut" }, { type: "shelter" })
        .shelterSecured,
    ).toBe(true);
  });
  it("성장 효과는 실제 비용·치료량에 적용되고 3단계로 제한", () => {
    const g = { ...createGame(0, 4), position: "gate" };
    const skilled = { ...g, skills: { search: 3, mountain: 3, response: 3 } };
    expect(actionCost(skilled, { type: "search" }).time).toBe(
      actionCost(g, { type: "search" }).time - 3,
    );
    expect(
      actionCost(skilled, { type: "move", to: "lookout" }).energy,
    ).toBeLessThan(actionCost(g, { type: "move", to: "lookout" }).energy);
    const plainAid = transition(
      { ...g, found: true, health: 40 },
      { type: "aid" },
    );
    const skillAid = transition(
      { ...skilled, found: true, health: 40 },
      { type: "aid" },
    );
    expect(skillAid.health - plainAid.health).toBe(9);
    let career = { xp: 10000, skills: zeroSkills() };
    for (let i = 0; i < 4; i++) career = train(career, "search");
    expect(career.skills.search).toBe(3);
  });
  it("훈련 모드 경험치 제외·임무별 평가", () => {
    const g = operationRescue(3, 0);
    expect(stars(g)).toBe(3);
    expect(earnedXp(g)).toBe(175);
    expect(earnedXp({ ...g, practice: true })).toBe(0);
    expect(stars({ ...g, readings: [] })).toBe(1);
  });
  it("기상 경계가 시드 예보와 일치", () => {
    for (const m of [3, 4, 5] as const)
      for (let seed = 0; seed < 9; seed++)
        for (const p of schedule(m, seed))
          expect(weatherAt(m, p.at, seed)).toBe(p.weather);
  });
});
