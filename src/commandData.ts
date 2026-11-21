import type { Equipment } from "./conditions";
export type MemberId = "dohyun" | "seojin" | "minho";
export const crew: {
  id: MemberId;
  name: string;
  role: string;
  color: string;
  effect: string;
}[] = [
  {
    id: "dohyun",
    name: "김도현",
    role: "산악 탐색 전문가",
    color: "#efb76b",
    effect: "수색 8분 · 인접 구역의 추가 흔적 분석",
  },
  {
    id: "seojin",
    name: "이서진",
    role: "응급 구조 전문가",
    color: "#8bcbb2",
    effect: "처치 8분·회복 +12 · 동행 부담·상태 악화 감소",
  },
  {
    id: "minho",
    name: "박민호",
    role: "산악 이동 전문가",
    color: "#91bde5",
    effect: "가파른 길 체력 −4 · 위험 구간 비용 감소",
  },
];
export const supplies: Record<Equipment, number> = {
  kit: 2,
  blanket: 2,
  rope: 2,
  lantern: 2,
  drone: 1,
};
export type Formation = Record<MemberId, Equipment[]>;
export const defaultFormation = (): Formation => ({
  dohyun: ["drone", "lantern"],
  seojin: ["kit", "blanket"],
  minho: ["rope", "kit"],
});
export function validFormation(f: Formation): boolean {
  const counts: Record<string, number> = {};
  for (const m of crew) {
    const items = f[m.id];
    if (
      !Array.isArray(items) ||
      items.length > 3 ||
      new Set(items).size !== items.length
    )
      return false;
    for (const item of items) {
      if (!(item in supplies)) return false;
      counts[item] = (counts[item] ?? 0) + 1;
    }
  }
  return Object.entries(counts).every(
    ([id, count]) => count <= supplies[id as Equipment],
  );
}
export const northCandidates = ["cedar", "cave", "ridge"];
export const valleyCandidates = ["valley", "bridge", "waterfall"];
export const landingZones = ["base", "lookout", "cedar", "bridge", "pine"];
export const commandRating = {
  sMaxMinutes: 230,
  sMinHealth: 50,
  fullRescues: 2,
  partialRescues: 1,
} as const;
