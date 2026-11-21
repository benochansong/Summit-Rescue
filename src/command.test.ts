import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  activeOrder,
  commandReason,
  commandTransition as step,
  createCommand,
  droneCost,
  grade,
  member,
  rescuedCount,
  safeCrew,
  travelCost,
  type CommandGame,
  type Request,
} from "./command";
import { defaultFormation, validFormation, type MemberId } from "./commandData";
import { adjacent } from "./regions";
import {
  readCareer,
  readCommandCareer,
  readRecords,
  saveCommandRecord,
  missionStats,
  isUnlocked,
} from "./storage";
import { createGame, transition } from "./game";

function queue(g: CommandGame, r: Request) {
  expect(commandReason(g, r)).toBe("");
  return step(g, { type: "queue", request: r });
}
function progress(g: CommandGame) {
  if (g.paused) g = step(g, { type: "pause" });
  return step(g, { type: "advance" });
}
function complete(g: CommandGame) {
  for (let i = 0; g.orders.length && i < 100; i++) g = progress(g);
  expect(g.orders).toHaveLength(0);
  return g;
}
function run(g: CommandGame, r: Request) {
  return complete(queue(g, r));
}
function place(g: CommandGame, id: MemberId, position: string) {
  member(g, id).position = position;
}
function path(from: string, to: string): string[] {
  const q = [[from]],
    seen = new Set([from]);
  while (q.length) {
    const p = q.shift()!;
    if (p.at(-1) === to) return p.slice(1);
    for (const n of adjacent(p.at(-1)!, 6))
      if (!seen.has(n)) {
        seen.add(n);
        q.push([...p, n]);
      }
  }
  throw Error("unreachable");
}
function evacReady() {
  const g = createCommand(0);
  g.subjects[0].found = true;
  place(g, "dohyun", "cedar");
  return g;
}

describe("공통 시계와 현장 명령", () => {
  it("UI의 비관련 대상·구역 선택이 다른 팀의 처치를 잠그지 않음", () => {
    let g = evacReady();
    g = queue(g, {
      kind: "search",
      members: ["minho"],
      to: "bridge",
      subject: "north",
    });
    expect(g.orders[0].to).toBeUndefined();
    expect(g.orders[0].subject).toBeUndefined();
    expect(
      commandReason(g, { kind: "aid", members: ["dohyun"], subject: "north" }),
    ).toBe("");
  });
  it("세 대원 다른 경로, 공통 10분, 동일 완료 시각을 중복 차감하지 않음", () => {
    let g = createCommand(0);
    for (const [id, to] of [
      ["dohyun", "gate"],
      ["seojin", "west"],
      ["minho", "lower"],
    ] as const)
      g = queue(g, { kind: "move", members: [id], to });
    g = progress(g);
    expect(g.elapsed).toBe(10);
    expect(g.members.map((m) => m.position)).toEqual(["gate", "west", "lower"]);
    expect(g.orders).toHaveLength(0);
    expect(g.revision).toBe(4);
  });
  it("먼저 끝나는 명령에서 정지하고 나머지 잔여 시간 유지", () => {
    let g = createCommand(0);
    g = queue(g, { kind: "search", members: ["dohyun"] });
    g = queue(g, { kind: "rest", members: ["seojin"] });
    g = progress(g);
    expect(g.elapsed).toBe(8);
    expect(g.orders[0].remaining).toBe(12);
    g = progress(g);
    expect(g.elapsed).toBe(20);
  });
  it("중복 예약·잘못된 경로·다른 위치 팀·낮은 체력 차단", () => {
    let g = queue(createCommand(0), {
      kind: "move",
      members: ["dohyun"],
      to: "gate",
    });
    expect(commandReason(g, { kind: "search", members: ["dohyun"] })).toMatch(
      "이미",
    );
    expect(
      commandReason(g, { kind: "move", members: ["seojin"], to: "unknown" }),
    ).toMatch("존재");
    expect(
      commandReason(g, { kind: "move", members: ["seojin"], to: "ridge" }),
    ).toMatch("연결");
    place(g, "minho", "ridge");
    expect(
      commandReason(g, { kind: "rest", members: ["seojin", "minho"] }),
    ).toMatch("같은 위치");
    member(g, "seojin").stamina = 1;
    expect(
      commandReason(g, { kind: "move", members: ["seojin"], to: "west" }),
    ).toMatch("체력");
  });
  it("일시정지와 stale revision이 시간을 진행시키지 않음", () => {
    let g = queue(createCommand(0), { kind: "wait", members: ["dohyun"] });
    g = step(g, { type: "pause" });
    expect(step(g, { type: "advance" })).toBe(g);
    g = step(g, { type: "pause" });
    const rev = g.revision;
    g = step(g, { type: "advance" }, rev);
    expect(step(g, { type: "advance" }, rev)).toBe(g);
    expect(g.elapsed).toBe(10);
  });
  it("미시작 취소만 허용하고 중간 이동 위치를 순간이동시키지 않음", () => {
    let g = queue(createCommand(0), {
      kind: "move",
      members: ["dohyun"],
      to: "gate",
    });
    const cancelled = step(g, { type: "cancel", id: 1 });
    expect(cancelled.orders.length).toBe(0);
    expect(cancelled.elapsed).toBe(0);
    g = queue(g, { kind: "search", members: ["minho"] });
    g = progress(g);
    expect(member(g, "dohyun").position).toBe("gate");
    const pending = g.orders[0];
    expect(step(g, { type: "cancel", id: pending.id })).toBe(g);
  });
  it("팀의 가장 느린 이동과 개별 체력 비용", () => {
    let g = createCommand(0);
    place(g, "dohyun", "cedar");
    place(g, "minho", "cedar");
    const cost = travelCost(g, ["dohyun", "minho"], "ridge");
    g = run(g, { kind: "move", members: ["dohyun", "minho"], to: "ridge" });
    expect(g.elapsed).toBe(cost.time);
    expect(member(g, "minho").stamina).toBeGreaterThan(
      member(g, "dohyun").stamina,
    );
  });
  it("날씨 경계를 만나 자동 정지하고 남은 이동에 우천 비용 적용", () => {
    let g = createCommand(0);
    g.elapsed = 85;
    g = queue(g, { kind: "move", members: ["dohyun"], to: "gate" });
    g = progress(g);
    expect(g.elapsed).toBe(90);
    expect(g.paused).toBe(true);
    expect(g.orders[0].remaining).toBe(5);
    g = progress(g);
    expect(g.elapsed).toBe(95);
    expect(member(g, "dohyun").stamina).toBeCloseTo(94.25);
  });
  it("원격 처치·원격 전문가 보너스 금지, 조난자 생존 독립", () => {
    let g = createCommand(0);
    g.subjects[0].found = true;
    expect(
      commandReason(g, { kind: "aid", members: ["seojin"], subject: "north" }),
    ).toMatch("현장");
    place(g, "dohyun", "cedar");
    g.subjects[0].health = 50;
    const before = g.subjects[1].health;
    g = run(g, { kind: "aid", members: ["dohyun"], subject: "north" });
    expect(g.subjects[0].health).toBeCloseTo(70.6);
    expect(g.subjects[1].health).toBeLessThan(before);
    expect(g.subjects[1].treated).toBe(false);
  });
  it("의료 역할은 현장에 있을 때만 처치 효율 향상", () => {
    let g = evacReady();
    place(g, "seojin", "cedar");
    g.subjects[0].health = 50;
    g = run(g, { kind: "aid", members: ["seojin"], subject: "north" });
    expect(g.elapsed).toBe(8);
    expect(g.subjects[0].health).toBeCloseTo(82.88);
  });
  it("처치 중인 동행 대상을 다른 대원이 이동시킬 수 없음", () => {
    let g = evacReady();
    place(g, "seojin", "cedar");
    g = run(g, { kind: "escort", members: ["dohyun"], subject: "north" });
    g = queue(g, { kind: "aid", members: ["seojin"], subject: "north" });
    expect(
      commandReason(g, { kind: "move", members: ["dohyun"], to: "fork" }),
    ).toMatch("처치");
  });
  it("부상자 처치 및 동행 팀 전원 선택 필수", () => {
    let g = createCommand(0);
    place(g, "seojin", "valley");
    place(g, "minho", "valley");
    g.subjects[1].found = true;
    expect(
      commandReason(g, {
        kind: "escort",
        members: ["seojin", "minho"],
        subject: "valley",
      }),
    ).toMatch("처치");
    g = run(g, { kind: "aid", members: ["seojin"], subject: "valley" });
    g = run(g, {
      kind: "escort",
      members: ["seojin", "minho"],
      subject: "valley",
    });
    expect(
      commandReason(g, { kind: "move", members: ["seojin"], to: "bridge" }),
    ).toMatch("모두");
  });
  it("장비 공동 재고 및 대원별 3칸 제한", () => {
    expect(validFormation(defaultFormation())).toBe(true);
    expect(validFormation({ ...defaultFormation(), minho: ["drone"] })).toBe(
      false,
    );
    expect(
      validFormation({
        ...defaultFormation(),
        dohyun: ["kit", "rope", "drone", "lantern"],
      }),
    ).toBe(false);
  });
  it("기존 임무 1 공통 조난자 상태로 계속 진행", () => {
    let g = createGame(0, 1);
    g = transition(g, { type: "move", to: "gate" });
    expect(g.position).toBe("gate");
    expect(g.health).toBeCloseTo(83.2);
  });
});
describe("항공 지원", () => {
  it("왕복 예비 배터리·거리·지형 비용, 부족하면 차단", () => {
    let g = createCommand(0);
    expect(droneCost(g, "dohyun", "gate").battery).toBe(32);
    expect(droneCost(g, "dohyun", "cave").battery).toBeGreaterThan(
      droneCost(g, "dohyun", "cedar").battery,
    );
    g.drone.battery = 31;
    expect(
      commandReason(g, { kind: "drone", members: ["dohyun"], to: "gate" }),
    ).toMatch("왕복");
  });
  it("출발지 귀환, 단서만 확보, 충전 및 취소는 자원 중복 사용 없음", () => {
    let g = createCommand(0);
    place(g, "dohyun", "lookout");
    g = queue(g, { kind: "drone", members: ["dohyun"], to: "cedar" });
    const cancel = step(g, { type: "cancel", id: g.orders[0].id });
    expect(cancel.drone.battery).toBe(100);
    g = complete(g);
    expect(g.drone.uses).toBe(1);
    expect(g.drone.reports).toBe(1);
    expect(g.subjects[0].found).toBe(false);
    expect(g.clues.some((c) => c.text.includes("전나무"))).toBe(true);
    expect(member(g, "dohyun").position).toBe("lookout");
    expect(commandReason(g, { kind: "charge", members: ["dohyun"] })).toMatch(
      "본부",
    );
    g = run(g, { kind: "return", members: ["dohyun"] });
    g = run(g, { kind: "charge", members: ["dohyun"] });
    expect(g.drone.battery).toBe(100);
  });
  it("폭우·강풍에서 드론 차단, 강풍·안개·준비시간 부족 헬기 차단", () => {
    for (const elapsed of [90, 150]) {
      const g = createCommand(0);
      g.elapsed = elapsed;
      expect(
        commandReason(g, { kind: "drone", members: ["dohyun"], to: "gate" }),
      ).toMatch("불가능");
    }
    for (const elapsed of [150, 300, 340]) {
      const g = evacReady();
      g.elapsed = elapsed;
      expect(
        commandReason(g, {
          kind: "heliEvac",
          members: ["dohyun"],
          subject: "north",
        }),
      ).not.toBe("");
    }
  });
  it("비행 중 악천후는 자동 귀환, 보고 없음, 배터리는 음수가 되지 않음", () => {
    let g = createCommand(0);
    g.elapsed = 85;
    g = run(g, { kind: "drone", members: ["dohyun"], to: "lookout" });
    expect(g.elapsed).toBe(98);
    expect(g.drone.reports).toBe(0);
    expect(g.drone.battery).toBeGreaterThanOrEqual(0);
    expect(g.log.some((x) => x.includes("자동 귀환"))).toBe(true);
  });
  it("미발견·절벽·미처치 환자는 헬기 이송 불가", () => {
    let g = createCommand(1);
    place(g, "dohyun", "cave");
    expect(
      commandReason(g, {
        kind: "heliEvac",
        members: ["dohyun"],
        subject: "north",
      }),
    ).toMatch("발견");
    g.subjects[0].found = true;
    expect(
      commandReason(g, {
        kind: "heliEvac",
        members: ["dohyun"],
        subject: "north",
      }),
    ).toMatch("착륙");
    g.subjects[1].found = true;
    g.subjects[1].position = "bridge";
    place(g, "seojin", "bridge");
    expect(
      commandReason(g, {
        kind: "heliEvac",
        members: ["seojin"],
        subject: "valley",
      }),
    ).toMatch("처치");
  });
  it("도착 시 날씨 재확인, 실패 지원도 횟수 소모", () => {
    let g = evacReady();
    g.elapsed = 75;
    g = run(g, { kind: "heliEvac", members: ["dohyun"], subject: "north" });
    expect(g.heli.uses).toBe(1);
    expect(g.heli.rescues).toBe(0);
    expect(g.subjects[0].status).not.toBe("rescued");
    expect(member(g, "dohyun").position).toBe("cedar");
  });
  it("적법한 이송은 환자와 선택한 대원만 안전 귀환", () => {
    let g = evacReady();
    place(g, "minho", "west");
    g = run(g, { kind: "heliEvac", members: ["dohyun"], subject: "north" });
    expect(g.elapsed).toBe(30);
    expect(g.heli.rescues).toBe(1);
    expect(member(g, "dohyun").position).toBe("base");
    expect(member(g, "minho").position).toBe("west");
    expect(g.status).toBe("active");
    expect(step(g, { type: "finish" })).toBe(g);
    g = run(g, { kind: "return", members: ["minho"] });
    g = step(g, { type: "finish" });
    expect(g.status).toBe("partial");
    expect(grade(g)).toBe("B");
  });
  it("헬기 정찰은 지상 발견 없이 넓은 단서, 최대 2회", () => {
    let g = createCommand(0);
    g = run(g, { kind: "heliRecon", members: ["minho"], to: "fork" });
    g = run(g, { kind: "heliRecon", members: ["minho"], to: "valley" });
    expect(g.subjects.every((s) => !s.found)).toBe(true);
    expect(g.heli.reports).toBe(2);
    expect(
      commandReason(g, { kind: "heliRecon", members: ["minho"], to: "fork" }),
    ).toMatch("2회");
  });
});
describe("작전 완료 및 고정 시드 균형", () => {
  it("아무 수색 없이 대기하면 실제 시간 경과로 C등급 실패", () => {
    let g = createCommand(5);
    for (let i = 0; i < 45 && g.status === "active"; i++)
      g = run(g, { kind: "wait", members: ["dohyun"] });
    expect(g.elapsed).toBe(360);
    expect(g.status).toBe("failed");
    expect(grade(g)).toBe("C");
    expect(g.subjects[1].health).toBe(0);
  });
  it("S 평가의 시간·생존 경계와 전원 귀환 조건 일치", () => {
    const g = createCommand(0);
    g.subjects.forEach((s) => {
      s.status = "rescued";
      s.health = 50;
    });
    g.elapsed = 230;
    expect(grade(g)).toBe("S");
    g.elapsed = 231;
    expect(grade(g)).toBe("A");
    g.elapsed = 230;
    g.subjects[0].health = 49;
    expect(grade(g)).toBe("A");
    place(g, "minho", "gate");
    expect(grade(g)).toBe("C");
  });
  for (let seed = 0; seed < 27; seed++)
    it(`시드 ${seed}: 모든 위치·기상 조합에서 분산 지상 구조 가능`, () => {
      let g = createCommand(seed);
      const assigned = [
        ["dohyun", "north"],
        ["seojin", "valley"],
      ] as const;
      // Test planner knows target positions to exercise all routes; player discovers them through radio/drone clues.
      for (let turns = 0; turns < 100 && g.status === "active"; turns++) {
        for (const [id, sid] of assigned) {
          if (activeOrder(g, id)) continue;
          const m = member(g, id),
            s = g.subjects.find((s) => s.id === sid)!;
          let r: Request;
          if (m.stamina < 28) r = { kind: "rest", members: [id] };
          else if (s.status === "rescued") {
            if (m.position === "base") continue;
            r = { kind: "return", members: [id] };
          } else if (m.position !== s.position)
            r = {
              kind: "move",
              members: [id],
              to: path(m.position, s.position)[0],
            };
          else if (!s.found) r = { kind: "search", members: [id] };
          else if (!s.treated) r = { kind: "aid", members: [id], subject: sid };
          else if (s.status !== "escorting")
            r = { kind: "escort", members: [id], subject: sid };
          else r = { kind: "return", members: [id] };
          g = queue(g, r);
        }
        g = progress(g);
      }
      expect(g.status).toBe("success");
      expect(safeCrew(g)).toBe(true);
      expect(rescuedCount(g)).toBe(2);
      expect(["S", "A"]).toContain(grade(g));
      expect(g.elapsed).toBeLessThanOrEqual(360);
      expect(g.members.every((m) => m.stamina >= 0)).toBe(true);
    });
  it("생존 소진 실패도 전원 귀환 후 평가, 같은 시드 재도전 가능", () => {
    let g = createCommand(4);
    g = run(g, { kind: "move", members: ["dohyun"], to: "gate" });
    g.subjects.forEach((s) => (s.health = 0.05));
    g = run(g, { kind: "wait", members: ["dohyun"] });
    expect(g.status).toBe("active");
    expect(step(g, { type: "finish" })).toBe(g);
    g = run(g, { kind: "return", members: ["dohyun"] });
    g = step(g, { type: "finish" });
    expect(g.status).toBe("failed");
    expect(grade(g)).toBe("C");
    const retry = createCommand(4);
    expect(retry.runId).not.toBe(g.runId);
    expect(retry.subjects.map((s) => s.position)).toEqual(
      g.subjects.map((s) => s.position),
    );
    expect(retry.subjects.every((s) => s.health > 0)).toBe(true);
  });
  it("수색 제한 도달은 귀환을 잠그지 않음", () => {
    let g = createCommand(0);
    g.elapsed = 355;
    place(g, "dohyun", "gate");
    g = run(g, { kind: "wait", members: ["dohyun"] });
    expect(g.recall).toBe(true);
    expect(commandReason(g, { kind: "search", members: ["dohyun"] })).toMatch(
      "종료",
    );
    g = run(g, { kind: "return", members: ["dohyun"] });
    expect(g.status).toBe("failed");
    expect(safeCrew(g)).toBe(true);
  });
  it("전문 경험치는 3단계로 제한", () => {
    const base = createCommand(0),
      grown = createCommand(0, defaultFormation(), undefined, false, {
        dohyun: 10000,
      });
    expect(run(base, { kind: "search", members: ["dohyun"] }).elapsed).toBe(8);
    expect(run(grown, { kind: "search", members: ["dohyun"] }).elapsed).toBe(5);
  });
});
describe("4단계 저장 이전", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("v3 성장·누적 기록 보존 및 미션6 해금", () => {
    data.set(
      "summit-rescue.records.v1",
      JSON.stringify({
        version: 3,
        records: [],
        career: { xp: 450, skills: { search: 2, mountain: 1, response: 3 } },
        totals: {
          5: {
            completed: true,
            wins: 4,
            bestStars: 3,
            bestTime: 180,
            bestHealth: 90,
          },
        },
      }),
    );
    expect(isUnlocked(6)).toBe(true);
    expect(readCareer().xp).toBe(450);
    expect(readCareer().skills.response).toBe(3);
    expect(missionStats([], 5).wins).toBe(4);
    expect(readCommandCareer().xp.dohyun).toBe(0);
    let g = run(evacReady(), {
      kind: "heliEvac",
      members: ["dohyun"],
      subject: "north",
    });
    g = step(g, { type: "finish" });
    expect(saveCommandRecord(g)).toBe(true);
    expect(saveCommandRecord(g)).toBe(true);
    expect(readRecords()).toHaveLength(1);
    expect(readCommandCareer().rescued).toBe(1);
    expect(readCommandCareer().heliUses).toBe(1);
    expect(readCommandCareer().bestGrade).toBe("B");
    expect(readCareer().xp).toBe(525);
    expect(missionStats([], 5).wins).toBe(4);
    expect(JSON.parse(data.get("summit-rescue.records.v1")!).version).toBe(4);
  });
  it("훈련과 미종료 작전은 보상을 저장하지 않음", () => {
    let g = createCommand(0);
    expect(saveCommandRecord(g)).toBe(false);
    g.practice = true;
    g = step(g, { type: "finish" });
    expect(saveCommandRecord(g)).toBe(true);
    expect(readRecords()).toHaveLength(0);
  });
});
