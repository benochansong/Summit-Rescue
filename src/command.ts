import { missions, weatherAt, type Equipment } from "./conditions";
import {
  adjacent,
  connection,
  graphDistance,
  point,
  regionFor,
} from "./regions";
import { decayHealth, type RescueSubject } from "./casualties";
import {
  crew,
  defaultFormation,
  validFormation,
  northCandidates,
  valleyCandidates,
  landingZones,
  commandRating,
  type Formation,
  type MemberId,
} from "./commandData";
import { normalizeSkills, zeroSkills, type SkillLevels } from "./progression";

export type CommandKind =
  | "move"
  | "return"
  | "search"
  | "rest"
  | "aid"
  | "kit"
  | "blanket"
  | "escort"
  | "wait"
  | "drone"
  | "charge"
  | "heliEvac"
  | "heliRecon";
export type Request = {
  kind: CommandKind;
  members: MemberId[];
  to?: string;
  subject?: string;
};
export type Member = {
  id: MemberId;
  position: string;
  stamina: number;
  equipment: Equipment[];
  kitUses: number;
  intel: string[];
  trail: string[];
  xp: number;
};
export type Order = Request & {
  id: number;
  origin: string;
  remaining: number;
  total: number;
  energy: Partial<Record<MemberId, number>>;
  route: string[];
  started: boolean;
  recalled: boolean;
};
export type CommandGame = {
  seed: number;
  runId: string;
  elapsed: number;
  revision: number;
  members: Member[];
  subjects: RescueSubject[];
  orders: Order[];
  nextOrder: number;
  log: string[];
  searched: string[];
  clues: { location: string; text: string }[];
  drone: { battery: number; uses: number; reports: number };
  heli: { uses: number; rescues: number; reports: number };
  paused: boolean;
  recall: boolean;
  status: "active" | "success" | "partial" | "failed";
  reason: string;
  practice: boolean;
  skills: SkillLevels;
};
export type CommandAction =
  | { type: "queue"; request: Request }
  | { type: "advance" }
  | { type: "pause" }
  | { type: "cancel"; id: number }
  | { type: "recall" }
  | { type: "finish" };
export const commandNames: Record<CommandKind, string> = {
  move: "이동",
  return: "본부 복귀",
  search: "수색",
  rest: "휴식",
  aid: "기본 처치",
  kit: "응급키트",
  blanket: "보온",
  escort: "동행 편성",
  wait: "대기",
  drone: "드론 정찰",
  charge: "드론 충전",
  heliEvac: "헬기 이송",
  heliRecon: "헬기 정찰",
};
export function createCommand(
  seed = Date.now(),
  formation: Formation = defaultFormation(),
  skills: SkillLevels = zeroSkills(),
  practice = false,
  xp: Partial<Record<MemberId, number>> = {},
): CommandGame {
  seed = seed >>> 0;
  if (!validFormation(formation)) throw new Error("장비 편성을 확인하세요.");
  const subject = (
    id: string,
    name: string,
    position: string,
    type: RescueSubject["type"],
  ): RescueSubject => ({
    id,
    name,
    position,
    type,
    found: false,
    health: type === "injured" ? 88 : 100,
    treated: false,
    insulated: false,
    carriers: [],
    status: "waiting",
  });
  return {
    seed,
    runId: globalThis.crypto.randomUUID(),
    elapsed: 0,
    revision: 0,
    nextOrder: 1,
    members: crew.map((m) => ({
      id: m.id,
      position: "base",
      stamina: 100,
      equipment: [...formation[m.id]],
      kitUses: 0,
      intel: [],
      trail: ["base"],
      xp: Math.max(0, xp[m.id] ?? 0),
    })),
    subjects: [
      subject("north", "북쪽 실종자", northCandidates[seed % 3], "lost"),
      subject(
        "valley",
        "계곡 부상자",
        valleyCandidates[Math.floor(seed / 3) % 3],
        "injured",
      ),
    ],
    orders: [],
    log: [
      "[본부] 90분 뒤 비구름 접근. 전망대와 나무다리에서 신고 흔적을 확인하십시오. 명령을 예약하고 작전 진행을 누르세요.",
    ],
    searched: [],
    clues: [],
    drone: { battery: 100, uses: 0, reports: 0 },
    heli: { uses: 0, rescues: 0, reports: 0 },
    paused: false,
    recall: false,
    status: "active",
    reason: "",
    practice,
    skills: normalizeSkills(skills),
  };
}
export const member = (g: CommandGame, id: MemberId) =>
  g.members.find((m) => m.id === id)!;
export const activeOrder = (g: CommandGame, id: MemberId) =>
  g.orders.find((o) => o.members.includes(id));
export const safeCrew = (g: CommandGame) =>
  g.members.every((m) => m.position === "base") && !g.orders.length;
export const rescuedCount = (g: CommandGame) =>
  g.subjects.filter((s) => s.status === "rescued" && s.health > 0).length;
const airborne = (kind: CommandKind) =>
  kind === "heliEvac" || kind === "heliRecon";
const airWeather = (g: CommandGame) =>
  ["clear", "cloudy"].includes(weatherAt(6, g.elapsed, g.seed));
const level = (m: Member) => Math.min(3, Math.floor(m.xp / 200));
const report = (g: CommandGame, text: string, ids: MemberId[] = []) => {
  g.log.unshift(
    `[${g.elapsed}분 · ${ids.map((id) => crew.find((m) => m.id === id)!.name).join("·") || "본부"}] ${text}`,
  );
  g.log = g.log.slice(0, 80);
};
export function routeHome(from: string): string[] {
  const queue = [[from]],
    seen = new Set([from]);
  while (queue.length) {
    const path = queue.shift()!;
    if (path.at(-1) === "base") return path.slice(1);
    for (const n of adjacent(path.at(-1)!, 6))
      if (!seen.has(n)) {
        seen.add(n);
        queue.push([...path, n]);
      }
  }
  return [];
}
export function travelCost(g: CommandGame, ids: MemberId[], to: string) {
  const origin = member(g, ids[0]).position,
    e = connection(origin, to, 6)!;
  const subjects = g.subjects.filter(
    (s) =>
      s.status === "escorting" &&
      s.carriers.some((id) => ids.includes(id as MemberId)),
  );
  const injured = subjects.some((s) => s.type === "injured"),
    escorting = subjects.length > 0,
    medical = ids.includes("seojin");
  const costs = ids.map((id) => {
    const m = member(g, id),
      mountain = g.skills.mountain;
    let time = Math.max(6, (e.time ?? (e.steep ? 20 : 10)) - mountain * 2);
    let energy = Math.max(
      2,
      (e.energy ?? (e.steep ? 12 : 5)) -
        mountain -
        (e.steep && m.equipment.includes("rope") ? 4 : 0) -
        (e.steep && id === "minho" ? 4 : 0) -
        (e.risk && id === "minho" ? 1 + level(m) : 0),
    );
    if (escorting) {
      time *= injured ? (medical ? 1.25 : 1.5) : medical ? 1.1 : 1.2;
      energy *= injured ? (medical ? 1.3 : 1.6) : 1.4;
    }
    return { id, time: Math.ceil(time), energy: Math.ceil(energy) };
  });
  return {
    time: Math.max(...costs.map((c) => c.time)),
    energy: Object.fromEntries(costs.map((c) => [c.id, c.energy])) as Partial<
      Record<MemberId, number>
    >,
  };
}
export function droneCost(g: CommandGame, id: MemberId, to: string) {
  const distance = graphDistance(member(g, id).position, to, 6);
  return {
    distance,
    battery:
      20 +
      distance * 12 +
      (point(to, 6).kind === "cliff" || point(to, 6).elevation >= 900 ? 10 : 0),
    time: 10 + distance * 4,
  };
}
export function commandReason(g: CommandGame, r: Request): string {
  if (g.status !== "active") return "종료된 작전입니다.";
  if (
    !r.members.length ||
    new Set(r.members).size !== r.members.length ||
    r.members.some((id) => !g.members.some((m) => m.id === id))
  )
    return "대원을 선택하세요.";
  if (r.members.some((id) => activeOrder(g, id)))
    return "선택한 대원은 이미 명령을 수행 중입니다.";
  const ms = r.members.map((id) => member(g, id)),
    origin = ms[0].position,
    s = g.subjects.find((s) => s.id === r.subject);
  if (ms.some((m) => m.position !== origin))
    return "같은 위치의 대원만 팀을 편성할 수 있습니다.";
  if (r.to && !regionFor(6).points.some((p) => p.id === r.to))
    return "존재하지 않는 구역입니다.";
  if (g.recall && ["search", "drone", "heliRecon", "escort"].includes(r.kind))
    return "수색이 종료되었습니다. 동행 중인 대상과 대원을 귀환시키세요.";
  if (["move", "return"].includes(r.kind)) {
    const to = r.kind === "return" ? routeHome(origin)[0] : r.to;
    if (!to || !connection(origin, to, 6)) return "연결된 경로를 선택하세요.";
    for (const patient of g.subjects.filter(
      (s) =>
        s.status === "escorting" &&
        s.carriers.some((id) => r.members.includes(id as MemberId)),
    )) {
      if (g.orders.some((o) => o.subject === patient.id))
        return "동행 대상의 처치 또는 이송 명령을 먼저 완료하세요.";
      if (!patient.carriers.every((id) => r.members.includes(id as MemberId)))
        return "동행 담당 대원을 모두 선택하세요.";
      if (patient.type === "injured" && !patient.treated)
        return "부상자를 먼저 처치하세요.";
    }
    const c = travelCost(g, r.members, to);
    if (ms.some((m) => m.stamina + 0.001 < (c.energy[m.id] ?? 0) * 1.3))
      return "체력이 부족합니다. 우천 여유분을 포함해 휴식 후 이동하세요.";
  }
  if (["aid", "kit", "blanket", "escort"].includes(r.kind)) {
    if (
      !s ||
      !s.found ||
      s.position !== origin ||
      s.status === "rescued" ||
      s.health <= 0
    )
      return "현장에 발견한 생존 대상이 있어야 합니다.";
    if (g.orders.some((o) => o.subject === s.id))
      return "이 대상에게 이미 명령이 배정되었습니다.";
    if (s.carriers.some((id) => activeOrder(g, id as MemberId)))
      return "대상의 동행 팀이 행동 중입니다.";
    if (r.kind === "aid" && s.treated)
      return "기본 처치를 완료했습니다. 추가 회복은 응급키트를 사용하세요.";
    if (
      r.kind === "kit" &&
      !ms.some((m) => m.equipment.includes("kit") && m.kitUses < 2)
    )
      return "현장 대원의 응급키트가 필요합니다. 키트당 2회 사용할 수 있습니다.";
    if (
      r.kind === "blanket" &&
      (!ms.some((m) => m.equipment.includes("blanket")) || s.insulated)
    )
      return "미보온 대상과 현장 대원의 방한포가 필요합니다.";
    if (r.kind === "escort" && s.type === "injured" && !s.treated)
      return "부상자는 처치 후 동행할 수 있습니다.";
    if (
      r.kind === "escort" &&
      g.subjects.some(
        (p) =>
          p.id !== s.id &&
          p.status === "escorting" &&
          p.carriers.some((id) => r.members.includes(id as MemberId)),
      )
    )
      return "한 대원은 한 대상의 동행만 담당합니다.";
  }
  if (r.kind === "drone" || r.kind === "charge") {
    if (ms.length !== 1 || !ms[0].equipment.includes("drone"))
      return "드론을 소지한 대원 한 명을 선택하세요.";
    if (g.orders.some((o) => o.kind === "drone" || o.kind === "charge"))
      return "드론은 이미 운용 중입니다.";
    if (
      r.kind === "charge" &&
      origin !== "base" &&
      point(origin, 6).kind !== "shelter"
    )
      return "본부 또는 대피소에서만 충전할 수 있습니다.";
    if (r.kind === "charge" && g.drone.battery >= 100)
      return "배터리가 가득 찼습니다.";
    if (r.kind === "drone") {
      if (!r.to) return "정찰 구역을 선택하세요.";
      if (["wind", "rain", "snow"].includes(weatherAt(6, g.elapsed, g.seed)))
        return "강풍·폭우·폭설에서는 드론 출동이 불가능합니다.";
      const c = droneCost(g, ms[0].id, r.to);
      if (c.distance > 4) return "드론 정찰 반경은 연결 경로 4구간입니다.";
      if (c.battery > g.drone.battery)
        return `왕복 및 비상 귀환 배터리 ${c.battery}가 필요합니다.`;
    }
  }
  if (airborne(r.kind)) {
    if (!airWeather(g))
      return "기상 악화로 헬기 접근이 불가능합니다. 지상 귀환 경로를 확보하세요.";
    if (g.heli.uses >= 2 || g.orders.some((o) => airborne(o.kind)))
      return "헬기는 한 번에 1대, 임무당 2회만 지원합니다.";
    if (g.elapsed + 30 > missions[6].limit)
      return "출동 준비·도착 30분을 확보할 수 없습니다.";
    if (r.kind === "heliEvac") {
      if (
        !s ||
        !s.found ||
        s.health <= 0 ||
        s.status === "rescued" ||
        s.position !== origin
      )
        return "발견한 생존 대상과 현장 대원이 필요합니다.";
      if (!landingZones.includes(origin))
        return "이곳은 착륙할 수 없습니다. 지도 H 지점으로 이동하세요.";
      if (s.type === "injured" && !s.treated)
        return "부상자 처치를 먼저 완료하세요.";
      if (
        g.orders.some((o) => o.subject === s.id) ||
        s.carriers.some((id) => activeOrder(g, id as MemberId))
      )
        return "대상의 다른 명령을 먼저 완료하세요.";
    } else if (!r.to) return "헬기 정찰 구역을 선택하세요.";
  }
  if (
    !["move", "return", "rest", "wait", "charge"].includes(r.kind) &&
    ms.some((m) => m.stamina < 3)
  )
    return "체력이 부족합니다. 먼저 휴식하세요.";
  return "";
}
function makeOrder(g: CommandGame, r: Request): Order {
  const origin = member(g, r.members[0]).position,
    ms = r.members.map((id) => member(g, id));
  let time = 10,
    energy: Partial<Record<MemberId, number>> = Object.fromEntries(
      r.members.map((id) => [id, 3]),
    );
  const route = r.kind === "return" ? routeHome(origin) : [];
  const to =
    r.kind === "return"
      ? route[0]
      : r.kind === "heliEvac"
        ? origin
        : ["move", "drone", "heliRecon"].includes(r.kind)
          ? r.to
          : undefined;
  if (r.kind === "move" || r.kind === "return") {
    const c = travelCost(g, r.members, to!);
    time = c.time;
    energy = c.energy;
  } else if (r.kind === "search")
    time =
      Math.max(
        5,
        (r.members.includes("dohyun") ? 8 - level(member(g, "dohyun")) : 15) -
          g.skills.search,
      ) +
      (weatherAt(6, g.elapsed, g.seed) === "fog" ? 5 : 0) +
      (g.elapsed >= 100 && !ms.some((m) => m.equipment.includes("lantern"))
        ? 10
        : 0);
  else if (r.kind === "rest") {
    time = 20;
    energy = {};
  } else if (r.kind === "wait") {
    time = 10;
    energy = {};
  } else if (r.kind === "aid" || r.kind === "kit")
    time = r.members.includes("seojin") ? 8 : 10;
  else if (r.kind === "escort" || r.kind === "blanket") time = 3;
  else if (r.kind === "drone") time = droneCost(g, r.members[0], to!).time;
  else if (r.kind === "charge") {
    time = 20;
    energy = {};
  } else if (airborne(r.kind)) time = 30;
  return {
    ...r,
    subject: ["aid", "kit", "blanket", "escort", "heliEvac"].includes(r.kind)
      ? r.subject
      : undefined,
    to,
    id: g.nextOrder++,
    origin,
    remaining: time,
    total: time,
    energy,
    route,
    started: false,
    recalled: false,
  };
}
export function commandEstimate(g: CommandGame, r: Request) {
  return commandReason(g, r) ? null : makeOrder(structuredClone(g), r);
}
function clue(g: CommandGame, location: string, text: string, ids: MemberId[]) {
  g.clues.push({ location, text });
  for (const id of ids) member(g, id).intel.unshift(text);
  report(g, text, ids);
}
function reconnaissance(
  g: CommandGame,
  to: string,
  ids: MemberId[],
  radius: number,
) {
  const suspects = g.subjects.filter(
    (s) =>
      s.status !== "rescued" &&
      !s.found &&
      graphDistance(to, s.position, 6) <= radius,
  );
  const names = suspects.map((s) => point(s.position, 6).name);
  clue(
    g,
    to,
    names.length
      ? `${point(to, 6).name} 주변 열원·흔적: ${names.join(" / ")}. 사람인지는 지상 수색으로 확인하십시오.`
      : `${point(to, 6).name} 주변 ${radius}구간 내 미발견 대상의 추가 흔적 없음.`,
    ids,
  );
  const risky = regionFor(6).edges.filter(
    (e) => (e.a === to || e.b === to) && e.risk,
  ).length;
  if (risky)
    report(
      g,
      `정찰 구역 인접 위험 경로 ${risky}개. 우천 이동 체력 여유를 확보하십시오.`,
      ids,
    );
}
function finishOrder(g: CommandGame, o: Order) {
  const ms = o.members.map((id) => member(g, id)),
    s = g.subjects.find((s) => s.id === o.subject);
  if (o.kind === "move" || o.kind === "return") {
    for (const m of ms) {
      m.position = o.to!;
      m.trail.push(o.to!);
    }
    for (const p of g.subjects.filter(
      (p) =>
        p.status === "escorting" &&
        p.carriers.every((id) => o.members.includes(id as MemberId)),
    )) {
      p.position = o.to!;
      if (p.position === "base") {
        p.status = "rescued";
        p.carriers = [];
        report(g, `${p.name}, 본부 인계 완료.`, o.members);
      }
    }
    report(g, `${point(o.to!, 6).name} 도착.`, o.members);
    if (o.kind === "return" && o.to !== "base") {
      const r: Request = { kind: "return", members: o.members };
      // The completed leg is removed before checking the next leg.
      const reason = commandReason(g, r);
      if (!reason) g.orders.push(makeOrder(g, r));
      else report(g, `복귀 도중 정지: ${reason}`, o.members);
    }
  } else if (o.kind === "search") {
    if (!g.searched.includes(o.origin)) g.searched.push(o.origin);
    const found = g.subjects.filter(
      (s) => s.position === o.origin && !s.found && s.health > 0,
    );
    for (const p of found) {
      p.found = true;
      clue(
        g,
        o.origin,
        `${p.name} 발견. 생존 ${Math.round(p.health)}. 처치·동행 또는 항공 이송을 지시하십시오.`,
        o.members,
      );
    }
    if (o.origin === "lookout")
      clue(
        g,
        o.origin,
        `북쪽 신고자의 발자국이 ${point(g.subjects[0].position, 6).name} 방향으로 이어집니다.`,
        o.members,
      );
    else if (o.origin === "bridge")
      clue(
        g,
        o.origin,
        `계곡 신고 확인: ${point(g.subjects[1].position, 6).name} 부근에서 도움 요청.`,
        o.members,
      );
    else if (!found.length)
      report(
        g,
        `${point(o.origin, 6).name} 수색 완료. 생존 대상 미확인.`,
        o.members,
      );
    if (o.members.includes("dohyun")) reconnaissance(g, o.origin, o.members, 1);
  } else if (o.kind === "rest") {
    for (const m of ms) m.stamina = Math.min(100, m.stamina + 25);
    report(g, "휴식 완료. 체력 25 회복.", o.members);
  } else if (o.kind === "aid" || o.kind === "kit") {
    if (s && s.health > 0) {
      s.health = Math.min(
        100,
        s.health +
          (o.kind === "kit" ? 25 : 22) +
          (o.members.includes("seojin")
            ? 12 + level(member(g, "seojin")) * 2
            : 0) +
          g.skills.response * 3,
      );
      if (o.kind === "aid") s.treated = true;
      else
        ms.find((m) => m.equipment.includes("kit") && m.kitUses < 2)!.kitUses++;
      report(
        g,
        `${s.name} 처치 완료. 생존 ${Math.round(s.health)}.`,
        o.members,
      );
    }
  } else if (o.kind === "blanket" && s && s.health > 0) {
    s.insulated = true;
    report(g, `${s.name} 보온 완료.`, o.members);
  } else if (o.kind === "escort" && s && s.health > 0) {
    s.carriers = [...o.members];
    s.status = "escorting";
    report(
      g,
      `${s.name} 동행 편성 완료. 담당 대원을 함께 이동시키세요.`,
      o.members,
    );
  } else if (o.kind === "drone") {
    if (!o.recalled) {
      reconnaissance(g, o.to!, o.members, 1);
      g.drone.reports++;
    }
    report(
      g,
      `드론 ${point(o.origin, 6).name} 귀환 완료${o.recalled ? " · 기상 악화로 정찰 중단" : ""}.`,
      o.members,
    );
  } else if (o.kind === "charge") {
    g.drone.battery = Math.min(100, g.drone.battery + 50);
    report(g, "드론 배터리 50 충전 완료.", o.members);
  } else if (airborne(o.kind)) {
    if (!airWeather(g))
      report(
        g,
        "긴급: 도착 시 기상 악화. 헬기 회항, 지원 횟수는 복구되지 않습니다.",
      );
    else if (o.kind === "heliRecon") {
      reconnaissance(g, o.to!, o.members, 2);
      g.heli.reports++;
    } else if (
      s &&
      s.found &&
      s.health > 0 &&
      s.position === o.origin &&
      landingZones.includes(s.position) &&
      (s.type !== "injured" || s.treated) &&
      ms.every((m) => m.position === o.origin)
    ) {
      s.status = "rescued";
      s.position = "base";
      s.carriers = [];
      for (const m of ms) {
        m.position = "base";
        m.trail.push("base");
      }
      g.heli.rescues++;
      report(g, `${s.name} 및 현장 대원 공식 항공 이송 완료.`, o.members);
    } else report(g, "긴급: 이송 대상 또는 현장 조건 불충족. 헬기 회항.");
  } else report(g, "대기 완료.", o.members);
}
export function grade(g: CommandGame): "S" | "A" | "B" | "C" {
  if (!safeCrew(g)) return "C";
  const count = rescuedCount(g);
  if (count >= commandRating.fullRescues)
    return g.elapsed <= commandRating.sMaxMinutes &&
      g.subjects.every((s) => s.health >= commandRating.sMinHealth)
      ? "S"
      : "A";
  return count >= commandRating.partialRescues ? "B" : "C";
}
export const commandStars = (g: CommandGame) =>
  ({ S: 3, A: 2, B: 1, C: 1 })[grade(g)];
export const commandXp = (g: CommandGame) =>
  g.practice ? 0 : { S: 200, A: 150, B: 75, C: 0 }[grade(g)];
function finish(g: CommandGame) {
  if (!safeCrew(g)) return;
  const count = rescuedCount(g);
  g.status = count === 2 ? "success" : count === 1 ? "partial" : "failed";
  g.reason =
    count === 2
      ? "두 대상 인계 및 대원 전원 귀환 완료."
      : `${count}명 구조. ${g.subjects
          .filter((s) => s.status !== "rescued")
          .map(
            (s) => `${s.name}: ${s.health <= 0 ? "생존 상태 소진" : "미구조"}`,
          )
          .join(" / ")}. 수색·처치·귀환 시간 배분을 다시 검토하십시오.`;
  report(g, g.reason);
}
export function commandTransition(
  g: CommandGame,
  a: CommandAction,
  revision = g.revision,
): CommandGame {
  if (g.status !== "active" || revision !== g.revision) return g;
  if (a.type === "queue" && commandReason(g, a.request)) return g;
  if (a.type === "advance" && (g.paused || !g.orders.length)) return g;
  if (a.type === "finish" && !safeCrew(g)) return g;
  if (a.type === "cancel" && !g.orders.some((o) => o.id === a.id && !o.started))
    return g;
  const n = structuredClone(g);
  n.revision++;
  if (a.type === "pause") {
    n.paused = !n.paused;
    return n;
  }
  if (a.type === "recall") {
    n.recall = true;
    report(n, "수색 종료. 대원 전원을 본부로 복귀시키십시오.");
    if (safeCrew(n)) finish(n);
    return n;
  }
  if (a.type === "finish") {
    finish(n);
    return n;
  }
  if (a.type === "cancel") {
    n.orders = n.orders.filter((o) => o.id !== a.id);
    return n;
  }
  if (a.type === "queue") {
    n.orders.push(makeOrder(n, a.request));
    return n;
  }
  // One global minute integrates all active orders, weather and subjects exactly once.
  for (const o of n.orders)
    if (!o.started) {
      o.started = true;
      if (o.kind === "drone") {
        n.drone.battery -= droneCost(n, o.members[0], o.to!).battery;
        n.drone.uses++;
      }
      if (airborne(o.kind)) n.heli.uses++;
    }
  for (let ticks = 0; ticks < 2000; ticks++) {
    const weather = weatherAt(6, n.elapsed, n.seed);
    for (const p of n.subjects) {
      if (p.status === "rescued" || p.health <= 0) continue;
      const medic =
        p.carriers.includes("seojin") &&
        member(n, "seojin").position === p.position;
      p.health = decayHealth(
        p.health,
        p.type === "injured" && !p.treated ? 0.2 : 0.14,
        weather,
        n.elapsed >= 100,
        p.insulated,
        false,
        medic ? 0.25 : 0,
      );
      if (p.health <= 0) {
        p.status = "deceased";
        p.carriers = [];
        report(n, `긴급: ${p.name}의 생존 상태가 소진되었습니다.`);
        n.paused = true;
      }
    }
    for (const o of n.orders) {
      if (
        o.kind === "drone" &&
        ["wind", "rain", "snow"].includes(weather) &&
        !o.recalled
      ) {
        o.recalled = true;
        o.remaining = Math.min(o.remaining, 8);
        report(
          n,
          "긴급: 기상 악화로 드론 자동 귀환. 정찰 자료 미확보.",
          o.members,
        );
      }
      const movement = o.kind === "move" || o.kind === "return",
        work = Math.min(
          o.remaining,
          movement && weather === "snow" ? 1 / 1.3 : 1,
        );
      o.remaining = Math.max(0, o.remaining - work);
      for (const id of o.members) {
        const m = member(n, id);
        m.stamina = Math.max(
          0,
          m.stamina -
            ((o.energy[id] ?? 0) / o.total) *
              work *
              (movement && weather === "rain" ? 1.3 : 1),
        );
      }
    }
    n.elapsed++;
    const done = n.orders.filter((o) => o.remaining < 0.00001);
    n.orders = n.orders.filter((o) => o.remaining >= 0.00001);
    for (const o of done) finishOrder(n, o);
    if (n.elapsed >= missions[6].limit && !n.recall) {
      n.recall = true;
      n.paused = true;
      report(
        n,
        "긴급: 수색 시간 종료. 신규 수색은 중지합니다. 귀환·처치는 계속할 수 있습니다.",
      );
    }
    if (rescuedCount(n) === 2 && safeCrew(n)) {
      finish(n);
      break;
    }
    if (n.recall && safeCrew(n)) {
      finish(n);
      break;
    }
    if (weatherAt(6, n.elapsed, n.seed) !== weather) {
      n.paused = true;
      report(
        n,
        "긴급: 기상이 바뀌었습니다. 남은 명령과 항공 지원을 확인하고 재개하세요.",
      );
      break;
    }
    if (done.length || n.paused) break;
  }
  return n;
}
