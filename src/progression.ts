export type Skill = "search" | "mountain" | "response";
export type SkillLevels = Record<Skill, number>;
export type Career = { xp: number; skills: SkillLevels };
export const skillInfo: { id: Skill; name: string; effect: string }[] = [
  { id: "search", name: "탐색 능력", effect: "단계당 수색 시간 −1분, 체력 −1" },
  {
    id: "mountain",
    name: "산악 이동 능력",
    effect: "단계당 험지 이동 시간 −2분, 체력 −1",
  },
  {
    id: "response",
    name: "구조 대응 능력",
    effect: "단계당 기본 응급처치 회복 +3",
  },
];
export const zeroSkills = (): SkillLevels => ({
  search: 0,
  mountain: 0,
  response: 0,
});
export const upgradeCost = (level: number) => 100 + level * 75;
export const normalizeSkills = (s?: Partial<SkillLevels>): SkillLevels =>
  Object.fromEntries(
    skillInfo.map(({ id }) => [
      id,
      Math.max(
        0,
        Math.min(3, Number.isFinite(s?.[id]) ? Math.floor(s![id]!) : 0),
      ),
    ]),
  ) as SkillLevels;
export function train(career: Career, skill: Skill): Career {
  if (
    !skillInfo.some((s) => s.id === skill) ||
    career.skills[skill] >= 3 ||
    career.xp < upgradeCost(career.skills[skill])
  )
    return career;
  return {
    xp: career.xp - upgradeCost(career.skills[skill]),
    skills: { ...career.skills, [skill]: career.skills[skill] + 1 },
  };
}
