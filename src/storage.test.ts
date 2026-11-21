import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "./game";
import { isUnlocked, readCareer, trainSkill } from "./storage";
import {
  missionStats,
  readRecords,
  readSettings,
  saveRecord,
  saveSettings,
} from "./storage";
describe("기록 저장 및 호환성", () => {
  let data: Map<string, string>;
  beforeEach(() => {
    data = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("2단계 누적 기록의 해금과 경험치를 보존하며 3단계로 이전", () => {
    data.set(
      "summit-rescue.records.v1",
      JSON.stringify({
        version: 2,
        records: [],
        totals: {
          1: {
            completed: true,
            wins: 2,
            bestStars: 3,
            bestTime: 128,
            bestHealth: 85,
          },
          2: {
            completed: true,
            wins: 1,
            bestStars: 2,
            bestTime: 190,
            bestHealth: 60,
          },
        },
      }),
    );
    expect(isUnlocked(3)).toBe(true);
    expect(isUnlocked(4)).toBe(false);
    expect(readCareer().xp).toBe(300);
    expect(trainSkill("search")).toBe(true);
    expect(readCareer().xp).toBe(200);
    expect(readCareer().skills.search).toBe(1);
    expect(missionStats([], 2).wins).toBe(1);
  });
  it("성공 보상은 한 번만 지급하고 훈련은 저장하지 않음", () => {
    const game = { ...createGame(0, 3), status: "success" as const };
    saveRecord(game);
    const xp = readCareer().xp;
    saveRecord(game);
    expect(readCareer().xp).toBe(xp);
    saveRecord({ ...createGame(1, 4, [], undefined, true), status: "success" });
    expect(readRecords()).toHaveLength(1);
    expect(isUnlocked(5)).toBe(false);
  });
  it("3단계 성장과 기록이 다시 읽어도 유지", () => {
    saveRecord({ ...createGame(2, 5), status: "success" });
    expect(trainSkill("response")).toBe(true);
    expect(readCareer().skills.response).toBe(1);
    expect(readRecords()[0].mission).toBe(5);
    expect(trainSkill("mountain")).toBe(false);
  });
  it("새 버전의 저장·중복 방지·같은 시드 재출동 기록", () => {
    const a = { ...createGame(1), status: "success" as const, elapsed: 128 };
    expect(saveRecord(a)).toBe(true);
    expect(saveRecord(a)).toBe(true);
    expect(readRecords()).toHaveLength(1);
    saveRecord({ ...createGame(1), status: "success", elapsed: 120 });
    expect(readRecords()).toHaveLength(2);
    const stats = missionStats(readRecords(), 1);
    expect(stats.wins).toBe(2);
    expect(stats.bestTime).toBe(120);
  });
  it("이전 단계 배열 기록을 보존하며 업그레이드", () => {
    data.set(
      "summit-rescue.records.v1",
      JSON.stringify([
        {
          id: "legacy",
          mission: 1,
          success: true,
          time: 128,
          health: 84,
          stamina: 30,
          clues: 2,
          stars: 3,
          date: "2026. 11. 21.",
        },
      ]),
    );
    expect(readRecords()).toHaveLength(1);
    saveRecord({ ...createGame(2, 2), status: "success", elapsed: 190 });
    expect(readRecords()).toHaveLength(2);
    expect(missionStats(readRecords(), 1).bestTime).toBe(128);
  });
  it("손상된 JSON과 잘못된 객체가 있어도 안전", () => {
    data.set("summit-rescue.records.v1", "{");
    expect(readRecords()).toEqual([]);
    data.set("summit-rescue.records.v1", '[null,{},"bad"]');
    expect(readRecords()).toEqual([]);
    data.set("summit-rescue.settings", "null");
    expect(readSettings().volume).toBe(0.3);
  });
  it("최근 기록 100개 밖의 최고 기록과 총 성공 수 보존", () => {
    for (let i = 0; i < 105; i++)
      saveRecord({
        ...createGame(i),
        status: "success",
        elapsed: i === 0 ? 50 : 128,
      });
    expect(readRecords()).toHaveLength(100);
    expect(missionStats(readRecords(), 1).wins).toBe(105);
    expect(missionStats(readRecords(), 1).bestTime).toBe(50);
  });
  it("저장 차단 시 예외 없이 실패 상태 반환", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw Error("denied");
      },
      setItem: () => {
        throw Error("quota");
      },
    });
    expect(readRecords()).toEqual([]);
    expect(saveRecord({ ...createGame(), status: "failed" })).toBe(false);
    expect(() =>
      saveSettings({ sound: true, volume: 0.5, motion: false }),
    ).not.toThrow();
  });
  it("설정 저장 후 복원 및 범위 보정", () => {
    saveSettings({ sound: true, volume: 0.5, motion: false });
    expect(readSettings()).toEqual({ sound: true, volume: 0.5, motion: false });
    data.set("summit-rescue.settings", '{"volume":999}');
    expect(readSettings().volume).toBe(1);
  });
});
