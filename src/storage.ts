import type { Difficulty, StoryId } from "./experience";
import {
  commandStars,
  commandXp,
  grade,
  rescuedCount,
  safeCrew,
  type CommandGame,
} from "./command";
import { crew, type MemberId } from "./commandData";
import { missionIds } from "./conditions";
import { normalizeSkills, train, zeroSkills } from "./progression";
import type { Career, Skill } from "./progression";
import type { Game } from "./game";
import { earnedXp, stars } from "./game";
export type RecordEntry = {
  id: string;
  mission: number;
  success: boolean;
  time: number;
  health: number;
  stamina: number;
  clues: number;
  stars: number;
  date: string;
  xp?: number;
  routes?: string[];
  difficulty?: Difficulty;
  story?: StoryId;
  grade?: "S" | "A" | "B" | "C";
  rescued?: number;
  droneUses?: number;
  heliUses?: number;
};
export type MissionStats = {
  completed: boolean;
  wins: number;
  bestStars: number;
  bestTime: number | null;
  bestHealth: number;
};
type Store = {
  version: 5;
  bests: Record<string, PersonalBest>;
  command: CommandCareer;
  career: Career;
  records: RecordEntry[];
  totals: Record<string, MissionStats>;
};
const KEY = "summit-rescue.records.v1"; // Kept to migrate the Phase 1 array in place.
const emptyStats = (): MissionStats => ({
  completed: false,
  wins: 0,
  bestStars: 0,
  bestTime: null,
  bestHealth: 0,
});
function validRecord(r: unknown): r is RecordEntry {
  if (!r || typeof r !== "object") return false;
  const v = r as RecordEntry;
  return (
    typeof v.id === "string" &&
    typeof v.success === "boolean" &&
    typeof v.date === "string" &&
    missionIds.some((id) => id === v.mission) &&
    [v.time, v.health, v.stamina, v.clues, v.stars].every(
      (n) => Number.isFinite(n) && n >= 0,
    ) &&
    v.health <= 100 &&
    v.stamina <= 100 &&
    v.stars >= 1 &&
    v.stars <= 3
  );
}
function addWin(stats: MissionStats, r: RecordEntry): MissionStats {
  return r.success
    ? {
        completed: true,
        wins: stats.wins + 1,
        bestStars: Math.max(stats.bestStars, r.stars),
        bestTime: Math.min(stats.bestTime ?? Infinity, r.time),
        bestHealth: Math.max(stats.bestHealth, r.health),
      }
    : stats;
}
function fromRecords(records: RecordEntry[]): Record<string, MissionStats> {
  const totals: Record<string, MissionStats> = {
    "1": emptyStats(),
    "2": emptyStats(),
    "3": emptyStats(),
    "4": emptyStats(),
    "5": emptyStats(),
    "6": emptyStats(),
    "7": emptyStats(),
  };
  for (const r of records) totals[r.mission] = addWin(totals[r.mission], r);
  return totals;
}
function readStore(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    const candidates: unknown[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.records)
        ? raw.records
        : [];
    const records = candidates.filter(validRecord).slice(0, 100);
    const totals = fromRecords(records);
    if ([2, 3, 4, 5].includes(raw?.version) && raw?.totals)
      for (const id of missionIds) {
        const s = raw.totals[id];
        if (
          s &&
          typeof s.completed === "boolean" &&
          [s.wins, s.bestStars, s.bestHealth].every(
            (n) => Number.isFinite(n) && n >= 0,
          ) &&
          (s.bestTime === null ||
            (Number.isFinite(s.bestTime) && s.bestTime >= 0)) &&
          s.bestStars <= 3 &&
          s.bestHealth <= 100 &&
          s.wins >= totals[id].wins
        )
          totals[id] = s;
      }
    const legacyXp = Object.values(totals).reduce(
      (sum, s) => sum + s.wins * 100,
      0,
    );
    const career: Career =
      [3, 4, 5].includes(raw?.version) && raw?.career
        ? {
            xp: Math.max(0, Number.isFinite(raw.career.xp) ? raw.career.xp : 0),
            skills: normalizeSkills(raw.career.skills),
          }
        : { xp: legacyXp, skills: zeroSkills() };
    return {
      version: 5,
      bests: restoreBests(raw?.bests, records),
      records,
      totals,
      career,
      command: normalizeCommandCareer(raw?.command),
    };
  } catch {
    return {
      version: 5,
      command: normalizeCommandCareer(),
      bests: {},
      records: [],
      totals: fromRecords([]),
      career: { xp: 0, skills: zeroSkills() },
    };
  }
}
export function readRecords(): RecordEntry[] {
  return readStore().records;
}
export function saveRecord(
  game: Game,
  mission = game.mission,
  details: { difficulty?: Difficulty; rating?: number } = {},
): boolean {
  if (game.status === "active") return false;
  if (game.practice) return true;
  try {
    const store = readStore(),
      id = game.runId;
    if (store.records.some((r) => r.id === id)) return true;
    const record: RecordEntry = {
      id,
      mission,
      success: game.status === "success",
      time: game.elapsed,
      health: Math.round(game.health),
      stamina: game.stamina,
      clues: game.clues.length,
      stars: details.rating ?? stars(game),
      date: new Date().toLocaleDateString("ko-KR"),
      xp:
        details.rating === undefined
          ? earnedXp(game)
          : game.status === "success"
            ? 100 + details.rating * 25
            : 0,
      routes: game.routeReport,
      difficulty: details.difficulty ?? game.experience?.difficulty,
      story: game.experience?.story,
    };
    store.records = [record, ...store.records].slice(0, 100);
    store.bests = improveBest(store.bests, record);
    store.totals[mission] = addWin(store.totals[mission], record);
    store.career = { ...store.career, xp: store.career.xp + (record.xp ?? 0) };
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
export function missionStats(
  _records: RecordEntry[],
  mission: number,
): MissionStats {
  return readStore().totals[mission] ?? emptyStats();
}
export function readCareer(): Career {
  return readStore().career;
}
export function isUnlocked(mission: number): boolean {
  const totals = readStore().totals;
  return (
    mission === 1 ||
    mission === 7 ||
    !!totals[mission]?.completed ||
    !!totals[mission - 1]?.completed
  );
}
export function trainSkill(skill: Skill): boolean {
  try {
    const store = readStore(),
      next = train(store.career, skill);
    if (next === store.career) return false;
    store.career = next;
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}
export type Settings = {
  sound: boolean;
  volume: number;
  motion: boolean;
  skipDialogue?: boolean;
};
export function readSettings(): Settings {
  try {
    const s = JSON.parse(
      localStorage.getItem("summit-rescue.settings") || "{}",
    );
    return {
      ...(s?.skipDialogue ? { skipDialogue: true } : {}),
      sound: s?.sound === true,
      volume:
        typeof s?.volume === "number" && Number.isFinite(s.volume)
          ? Math.max(0, Math.min(1, s.volume))
          : 0.3,
      motion: s?.motion !== false,
    };
  } catch {
    return { sound: false, volume: 0.3, motion: true };
  }
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem("summit-rescue.settings", JSON.stringify(s));
  } catch {
    /* Session settings still work. */
  }
}

export type CommandCareer = {
  xp: Record<MemberId, number>;
  bestGrade: "S" | "A" | "B" | "C" | null;
  rescued: number;
  droneUses: number;
  heliUses: number;
};
function normalizeCommandCareer(raw?: Partial<CommandCareer>): CommandCareer {
  const count = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(0, Math.floor(v))
      : 0;
  return {
    xp: Object.fromEntries(
      crew.map((m) => [m.id, count(raw?.xp?.[m.id])]),
    ) as Record<MemberId, number>,
    bestGrade:
      raw?.bestGrade && ["S", "A", "B", "C"].includes(raw.bestGrade)
        ? raw.bestGrade
        : null,
    rescued: count(raw?.rescued),
    droneUses: count(raw?.droneUses),
    heliUses: count(raw?.heliUses),
  };
}
export function readCommandCareer(): CommandCareer {
  return readStore().command;
}
export function saveCommandRecord(g: CommandGame): boolean {
  if (g.status === "active" || !safeCrew(g)) return false;
  if (g.practice) return true;
  try {
    const store = readStore();
    if (store.records.some((r) => r.id === g.runId)) return true;
    const rating = grade(g),
      xp = commandXp(g);
    const record: RecordEntry = {
      id: g.runId,
      mission: 6,
      success: g.status === "success",
      time: g.elapsed,
      health: Math.round(Math.min(...g.subjects.map((s) => s.health))),
      stamina: Math.round(Math.min(...g.members.map((m) => m.stamina))),
      clues: g.clues.length,
      stars: commandStars(g),
      date: new Date().toLocaleDateString("ko-KR"),
      xp,
      grade: rating,
      rescued: rescuedCount(g),
      droneUses: g.drone.uses,
      heliUses: g.heli.uses,
      routes: g.members.map((m) => m.id + ": " + m.trail.join(" → ")),
    };
    store.records = [record, ...store.records].slice(0, 100);
    store.bests = improveBest(store.bests, record);
    store.totals[6] = addWin(store.totals[6], record);
    store.career.xp += xp;
    const c = store.command;
    c.rescued += record.rescued!;
    c.droneUses += g.drone.uses;
    c.heliUses += g.heli.uses;
    if (!c.bestGrade || "SABC".indexOf(rating) < "SABC".indexOf(c.bestGrade))
      c.bestGrade = rating;
    for (const m of g.members)
      if (m.trail.length > 1 || m.intel.length)
        c.xp[m.id] += Math.floor(xp / 2);
    localStorage.setItem(KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export type PersonalBest = {
  time: number;
  health: number;
  stamina: number;
  stars: number;
};
const recordKey = (r: Pick<RecordEntry, "mission" | "difficulty" | "story">) =>
  [r.mission, r.story ?? "legacy", r.difficulty ?? "fixed"].join(":");
function improveBest(bests: Record<string, PersonalBest>, r: RecordEntry) {
  if (!r.success) return bests;
  const key = recordKey(r),
    old = bests[key];
  return {
    ...bests,
    [key]: {
      time: Math.min(old?.time ?? Infinity, r.time),
      health: Math.max(old?.health ?? 0, r.health),
      stamina: Math.max(old?.stamina ?? 0, r.stamina),
      stars: Math.max(old?.stars ?? 0, r.stars),
    },
  };
}
function restoreBests(
  raw: unknown,
  records: RecordEntry[],
): Record<string, PersonalBest> {
  let bests: Record<string, PersonalBest> = {};
  if (raw && typeof raw === "object")
    for (const [key, value] of Object.entries(raw)) {
      const v = value as PersonalBest;
      if (
        v &&
        [v.time, v.health, v.stamina, v.stars].every(
          (n) => Number.isFinite(n) && n >= 0,
        ) &&
        v.health <= 100 &&
        v.stamina <= 100 &&
        v.stars <= 3
      )
        bests[key] = {
          time: v.time,
          health: v.health,
          stamina: v.stamina,
          stars: v.stars,
        };
    }
  for (const r of records) bests = improveBest(bests, r);
  return bests;
}
export function personalHighlights(
  g: Pick<
    Game,
    | "mission"
    | "experience"
    | "status"
    | "practice"
    | "elapsed"
    | "health"
    | "stamina"
  >,
  rating: number,
  difficulty?: Difficulty,
): string[] {
  if (g.status !== "success" || g.practice) return [];
  const best =
    readStore().bests[
      recordKey({
        mission: g.mission,
        story: g.experience?.story,
        difficulty: difficulty ?? g.experience?.difficulty,
      })
    ];
  if (!best) return ["이 조건의 첫 구조 기록"];
  return [
    g.elapsed < best.time ? "최단 구조 시간 갱신" : "",
    Math.round(g.health) > best.health ? "최고 생존 상태 갱신" : "",
    Math.round(g.stamina) > best.stamina ? "최고 잔여 체력 갱신" : "",
    rating > best.stars ? "최고 평가 갱신" : "",
  ].filter(Boolean);
}
