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
};
export type MissionStats = {
  completed: boolean;
  wins: number;
  bestStars: number;
  bestTime: number | null;
  bestHealth: number;
};
type Store = {
  version: 3;
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
    if ((raw?.version === 2 || raw?.version === 3) && raw?.totals)
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
      raw?.version === 3 && raw?.career
        ? {
            xp: Math.max(0, Number.isFinite(raw.career.xp) ? raw.career.xp : 0),
            skills: normalizeSkills(raw.career.skills),
          }
        : { xp: legacyXp, skills: zeroSkills() };
    return { version: 3, records, totals, career };
  } catch {
    return {
      version: 3,
      records: [],
      totals: fromRecords([]),
      career: { xp: 0, skills: zeroSkills() },
    };
  }
}
export function readRecords(): RecordEntry[] {
  return readStore().records;
}
export function saveRecord(game: Game, mission = game.mission): boolean {
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
      stars: stars(game),
      date: new Date().toLocaleDateString("ko-KR"),
      xp: earnedXp(game),
      routes: game.routeReport,
    };
    store.records = [record, ...store.records].slice(0, 100);
    store.totals[mission] = addWin(store.totals[mission], record);
    store.career = { ...store.career, xp: store.career.xp + earnedXp(game) };
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
