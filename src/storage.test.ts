import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGame } from "./game";
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
