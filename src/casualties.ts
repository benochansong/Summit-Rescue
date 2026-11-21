import type { CasualtyType, Weather } from "./conditions";
export type RescueSubject = {
  id: string;
  name: string;
  position: string;
  found: boolean;
  health: number;
  type: CasualtyType;
  treated: boolean;
  insulated: boolean;
  carriers: string[];
  status: "waiting" | "escorting" | "rescued" | "deceased";
};
export function decayHealth(
  health: number,
  base: number,
  weather: Weather,
  night: boolean,
  insulated: boolean,
  cold = false,
  protection = 0,
): number {
  const exposure =
    (cold ? 0.07 : 0) +
    (weather === "snow"
      ? 0.18
      : weather === "rain"
        ? 0.1
        : weather === "wind"
          ? 0.06
          : 0) +
    (night ? 0.06 : 0);
  return Math.max(
    0,
    health - (base + exposure * (insulated ? 0.45 : 1)) * (1 - protection),
  );
}
// The original single-rescuer missions expose the same subject shape without duplicating mutable health.
export function singleSubject(g: {
  position: string;
  target: string;
  found: boolean;
  health: number;
  casualtyType: CasualtyType;
  treated: boolean;
  insulated: boolean;
  status: string;
}): RescueSubject {
  return {
    id: "subject-1",
    name: "구조 대상",
    position: g.found ? g.position : g.target,
    found: g.found,
    health: g.health,
    type: g.casualtyType,
    treated: g.treated,
    insulated: g.insulated,
    carriers: g.found ? ["leader"] : [],
    status:
      g.status === "success"
        ? "rescued"
        : g.health <= 0
          ? "deceased"
          : g.found
            ? "escorting"
            : "waiting",
  };
}
