import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  actionCost,
  choicesFor,
  createGame,
  disabledReason,
  objective,
  transition,
  type Action,
  type Game,
} from "./game";
import {
  difficulties,
  evidence,
  gameLimit,
  gameWeather,
  heartCandidates,
  stories,
  tension,
  nextStep,
  type Difficulty,
  type StoryId,
} from "./experience";
import { adjacent } from "./regions";
import {
  personalHighlights,
  readCareer,
  readCommandCareer,
  readRecords,
  saveRecord,
} from "./storage";
function path(from: string, to: string) {
  const q = [[from]],
    seen = new Set([from]);
  while (q.length) {
    const p = q.shift()!;
    if (p.at(-1) === to) return p.slice(1);
    for (const n of adjacent(p.at(-1)!, 1))
      if (!seen.has(n)) {
        seen.add(n);
        q.push([...p, n]);
      }
  }
  throw Error("Unreachable");
}
function act(g: Game, a: Action) {
  expect(disabledReason(g, a)).toBe("");
  return transition(g, a);
}
function resolve(g: Game) {
  for (let i = 0; g.pending && i < 4; i++) {
    const choice =
      g.pending.kind === "front"
        ? "continue"
        : g.pending.kind === "signal"
          ? "focus"
          : "secure";
    g = act(g, { type: "choose", choice });
  }
  return g;
}
function move(g: Game, to: string) {
  if (g.stamina < actionCost(g, { type: "move", to }).energy + 5)
    g = resolve(act(g, { type: "rest" }));
  return resolve(act(g, { type: "move", to }));
}
// The planner only reads public clue candidates; it never reads the hidden target to choose a route.
function rescue(seed: number, story: StoryId, difficulty: Difficulty): Game {
  let g = createGame(seed, 1, ["kit", "blanket", "rope"], undefined, false, {
    story,
    difficulty,
  });
  for (const to of ["gate", "lookout", "fork"]) {
    g = move(g, to);
    if (g.status !== "active") return g;
    if (g.experience!.clueStage < 3) g = resolve(act(g, { type: "search" }));
  }
  expect(g.possible.length).toBe(1);
  const destination = g.possible[0];
  for (const to of path(g.position, destination)) g = move(g, to);
  g = resolve(act(g, { type: "search" }));
  expect(g.found).toBe(true);
  if (g.status !== "active") return g;
  g = resolve(act(g, { type: "aid" }));
  if (story === "cold") g = resolve(act(g, { type: "blanket" }));
  for (const to of path(g.position, "base")) {
    if (g.found && g.health < 35 && g.kitUses < 2)
      g = resolve(act(g, { type: "kit" }));
    g = move(g, to);
    if (g.status !== "active") break;
  }
  return g;
}
describe("정답을 모르는 구조 계획: 108개 시드 × 이야기 3 × 난이도 3", () => {
  for (const difficulty of Object.keys(difficulties) as Difficulty[])
    for (const story of Object.keys(stories) as StoryId[])
      for (let seed = 0; seed < 108; seed++)
        it(`${difficulty}/${story}/seed-${seed}`, () => {
          const g = rescue(seed, story, difficulty);
          expect(
            g.status,
            JSON.stringify({
              time: g.elapsed,
              health: g.health,
              stamina: g.stamina,
              log: g.log,
            }),
          ).toBe("success");
          expect(g.health).toBeGreaterThan(0);
          expect(g.stamina).toBeGreaterThanOrEqual(0);
          expect(g.elapsed).toBeLessThanOrEqual(gameLimit(g));
        });
});
describe("일관된 정보와 의미 있는 선택", () => {
  it("단계마다 후보가 6→3→2→1, 첫 단서에서 정답명을 노출하지 않음", () => {
    for (let seed = 0; seed < 36; seed++) {
      let g = createGame(seed, 1, undefined, undefined, false, {
        story: "alone",
        difficulty: "normal",
      });
      for (const count of [3, 2, 1]) {
        const result = evidence(g);
        expect(result.possible).toContain(g.target);
        expect(result.possible).toHaveLength(count);
        g = {
          ...g,
          experience: { ...g.experience!, clueStage: result.stage },
          possible: result.possible,
        };
      }
      expect(g.possible).toEqual([g.target]);
    }
  });
  it("첫 목표는 숨겨진 정답을 참조하지 않음", () => {
    for (let seed = 0; seed < 6; seed++) {
      const g = createGame(seed, 1, undefined, undefined, false, {
        story: "alone",
        difficulty: "normal",
      });
      expect(objective(g)).toBe("북쪽 등산로에서 첫 흔적을 확인하세요.");
      expect(nextStep(g).action).toEqual({ type: "move", to: "gate" });
    }
  });
  it("같은 시드의 단서·대상·기상 재현 및 다양한 후보", () => {
    const targets = new Set<string>();
    for (let seed = 0; seed < 36; seed++) {
      const a = createGame(seed, 1, undefined, undefined, false, {
          story: "cold",
          difficulty: "hard",
        }),
        b = createGame(seed, 1, undefined, undefined, false, {
          story: "cold",
          difficulty: "hard",
        });
      targets.add(a.target);
      expect(evidence(a)).toEqual(evidence(b));
      expect(gameWeather(a, 90)).toBe(gameWeather(b, 90));
      expect(a.runId).not.toBe(b.runId);
    }
    expect([...targets].sort()).toEqual([...heartCandidates].sort());
  });
  it("난이도 차이가 초기 정보와 선택 비용에도 적용", () => {
    const easy = createGame(0, 1, undefined, undefined, false, {
        story: "alone",
        difficulty: "easy",
      }),
      hard = createGame(0, 1, undefined, undefined, false, {
        story: "alone",
        difficulty: "hard",
      });
    expect(evidence(easy).possible).toHaveLength(2);
    expect(evidence(hard).possible).toHaveLength(3);
    easy.pending = { kind: "front", key: "front" };
    expect(choicesFor(easy).map((c) => c.id)).toEqual(["continue", "shelter"]);
    hard.pending = { kind: "signal", key: "signal" };
    expect(choicesFor(hard).find((c) => c.id === "focus")!.cost.time).toBe(14);
  });
  it("기상 예고는 한 번, 기다려도 대상 상태는 악화", () => {
    let g = createGame(0, 1, undefined, undefined, false, {
      story: "alone",
      difficulty: "easy",
    });
    g = act(g, { type: "move", to: "gate" });
    g = act(g, { type: "search" });
    expect(g.pending?.kind).toBe("front");
    expect(tension(g).stage).toBe(3);
    const before = g.health;
    g = act(g, { type: "choose", choice: "shelter" });
    expect(g.health).toBeLessThan(before);
    g = act(g, { type: "move", to: "lookout" });
    expect(g.pending).toBeNull();
    expect(g.resolved.filter((s) => s === "front")).toHaveLength(1);
  });
  it("원본 상태 불변과 이벤트 revision 중복 차단", () => {
    const g = createGame(0, 1, undefined, undefined, false, {
      story: "alone",
      difficulty: "easy",
    });
    const n = act(g, { type: "move", to: "gate" }),
      after = act(n, { type: "search" });
    expect(g.experience!.clueStage).toBe(0);
    expect(n.experience!.clueStage).toBe(0);
    expect(after.experience!.clueStage).toBe(2);
    expect(transition(after, { type: "search" }, n.revision)).toBe(after);
  });
  it("범위 밖 드론은 정답을 찾거나 단계를 뛰어넘지 않음", () => {
    let g = createGame(0, 1, ["drone"], undefined, false, {
      story: "alone",
      difficulty: "normal",
    });
    g = act(g, { type: "drone" });
    expect(g.experience!.clueStage).toBe(0);
    expect(g.possible).toContain(g.target);
    expect(g.found).toBe(false);
  });
  it("귀환 선택은 비용과 손실이 다르고 모든 길을 막지 않음", () => {
    let g = createGame(0, 1, undefined, undefined, false, {
      story: "injured",
      difficulty: "hard",
    });
    g = { ...g, position: "cedar", found: true, treated: true };
    g = act(g, { type: "move", to: "fork" });
    expect(g.pending?.kind).toBe("home");
    const choices = choicesFor(g);
    expect(choices.find((c) => c.id === "secure")!.health).toBeUndefined();
    expect(choices.find((c) => c.id === "risk")!.health).toBe(-6);
    expect(
      choicesFor({
        ...g,
        experience: { ...g.experience!, prepared: true },
      }).find((c) => c.id === "risk")!.health,
    ).toBe(-2);
    const n = act(g, { type: "choose", choice: "secure" });
    expect(n.position).toBe("fork");
    expect(n.resolved).toContain("home");
    expect(act(n, { type: "move", to: "lookout" }).pending).toBeNull();
  });
  it("부상자 처치 중복 불가·보온 상태는 독립 유지", () => {
    let g = createGame(1, 1, undefined, undefined, false, {
      story: "injured",
      difficulty: "normal",
    });
    g = { ...g, position: g.target, found: true, health: 60 };
    expect(
      disabledReason(g, { type: "move", to: adjacent(g.position, 1)[0] }),
    ).toContain("응급처치");
    g = act(g, { type: "aid" });
    expect(transition(g, { type: "aid" })).toBe(g);
    expect(g.insulated).toBe(false);
  });
  it("제한 시간 실패 및 발견 단계와 귀환 단계 구분", () => {
    let g = createGame(0, 1, undefined, undefined, false, {
      story: "cold",
      difficulty: "hard",
    });
    g = { ...g, elapsed: gameLimit(g) - 1 };
    g = act(g, { type: "search" });
    expect(g.status).toBe("failed");
    const h = createGame(0, 1, undefined, undefined, false, {
      story: "alone",
      difficulty: "normal",
    });
    expect(tension({ ...h, found: true }).stage).toBe(4);
    expect({ ...h, found: true }.status).toBe("active");
  });
});
describe("조건별 개인 기록과 기존 저장 이전", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("v4 성장·지휘 데이터 유지, v5로 기록 저장", () => {
    data.set(
      "summit-rescue.records.v1",
      JSON.stringify({
        version: 4,
        records: [],
        career: { xp: 300, skills: { search: 1, mountain: 2, response: 0 } },
        command: {
          xp: { dohyun: 200, seojin: 100, minho: 50 },
          bestGrade: "A",
          rescued: 8,
          droneUses: 5,
          heliUses: 4,
        },
      }),
    );
    const g = rescue(0, "alone", "easy");
    expect(saveRecord(g)).toBe(true);
    expect(readCareer().skills.mountain).toBe(2);
    expect(readCommandCareer().rescued).toBe(8);
    expect(readCommandCareer().xp.dohyun).toBe(200);
    expect(readRecords()[0].difficulty).toBe("easy");
    expect(JSON.parse(data.get("summit-rescue.records.v1")!).version).toBe(5);
  });
  it("같은 조건에서만 최고 기록 비교, 저장 두 번으로 보상 증가 없음", () => {
    const g = rescue(0, "alone", "normal");
    expect(personalHighlights(g, 3)).toEqual(["이 조건의 첫 구조 기록"]);
    saveRecord(g);
    const xp = readCareer().xp;
    saveRecord(g);
    expect(readCareer().xp).toBe(xp);
    expect(personalHighlights(g, 3)).toEqual([]);
    expect(personalHighlights({ ...g, elapsed: g.elapsed - 1 }, 3)).toContain(
      "최단 구조 시간 갱신",
    );
    expect(
      personalHighlights(
        { ...g, experience: { ...g.experience!, difficulty: "hard" } },
        3,
      ),
    ).toEqual(["이 조건의 첫 구조 기록"]);
  });
  it("100개 기록 이후에도 개인 최고 기록 유지", () => {
    const g = rescue(0, "alone", "normal");
    saveRecord(g);
    for (let i = 0; i < 105; i++)
      saveRecord({ ...g, runId: "slower-" + i, elapsed: g.elapsed + 10 });
    expect(readRecords()).toHaveLength(100);
    expect(
      personalHighlights({ ...g, elapsed: g.elapsed + 5 }, 3),
    ).not.toContain("최단 구조 시간 갱신");
  });
  it("훈련은 기록 갱신으로 표시하거나 저장하지 않음", () => {
    const g = { ...rescue(0, "alone", "easy"), practice: true };
    expect(personalHighlights(g, 3)).toEqual([]);
    expect(saveRecord(g)).toBe(true);
    expect(readRecords()).toHaveLength(0);
  });
});
