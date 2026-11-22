import type { Weather } from "./conditions";
export type AirStatus =
  | "idle"
  | "requested"
  | "preparing"
  | "enroute"
  | "approach"
  | "hoisting"
  | "transporting"
  | "complete"
  | "delayed"
  | "returning"
  | "cancelled";
export type AirEvent = { at: number; status: AirStatus; message: string };
export type AirState = {
  status: AirStatus;
  used: number;
  target: string;
  phase: number;
  delay: number;
  resume: AirStatus;
  rain: boolean;
  onboard: boolean;
  history: AirEvent[];
};
export const skyLanding = ["lookout", "hut", "pine", "ridge"];
export const airNames: Record<AirStatus, string> = {
  idle: "대기",
  requested: "출동 요청 접수",
  preparing: "출동 준비",
  enroute: "현장으로 이동",
  approach: "현장 접근",
  hoisting: "구조 진행",
  transporting: "이송 중",
  complete: "이송 완료",
  delayed: "접근 지연",
  returning: "복귀 중",
  cancelled: "출동 종료",
};
export const airActive = (a: AirState) =>
  !["idle", "complete", "cancelled"].includes(a.status);
export const newAir = (): AirState => ({
  status: "idle",
  used: 0,
  target: "",
  phase: 0,
  delay: 0,
  resume: "enroute",
  rain: false,
  onboard: false,
  history: [],
});
export type AirContext = {
  at: number;
  weather: Weather;
  position: string;
  ready: boolean;
  health: number;
};
export function airWeatherSafe(w: Weather, target: string) {
  return (
    ["clear", "cloudy", "drizzle"].includes(w) &&
    !(target === "ridge" && w === "drizzle")
  );
}
export function airRequestReason(a: AirState, c: AirContext) {
  if (a.used >= 1)
    return "출동 자원 1회를 사용했습니다. 지상 귀환 또는 진행 중인 항공 지원을 확인하세요.";
  if (!c.ready || c.health <= 0)
    return "조난자 발견과 응급처치·안전 지형 확보가 필요합니다.";
  if (!skyLanding.includes(c.position))
    return "이곳은 지원 불가. H 표시의 전망대·대피소·소나무 숲·개방 능선으로 이동하세요.";
  if (!airWeatherSafe(c.weather, c.position))
    return c.position === "ridge" && c.weather === "drizzle"
      ? "개방 능선은 맑음·흐림에서만 접근합니다. 다른 H 지점으로 이동하세요."
      : "현재 기상으로 출동 불가. 예보를 보고 대기하거나 지상 귀환하세요.";
  return "";
}
function stage(
  a: AirState,
  status: AirStatus,
  at: number,
  message: string,
): AirState {
  return {
    ...a,
    status,
    phase: 0,
    history: [...a.history, { at, status, message }],
  };
}
export function requestAir(a: AirState, c: AirContext) {
  if (airRequestReason(a, c)) return a;
  return stage(
    { ...a, used: 1, target: c.position, rain: c.weather === "drizzle" },
    "requested",
    c.at,
    "지원 1회 사용 · 조난자 이송 후 구조팀은 별도 귀환",
  );
}
export function cancelAir(a: AirState, at: number) {
  return airActive(a) && !a.onboard && a.status !== "returning"
    ? stage(
        a,
        "returning",
        at,
        "지상 구조 전환 · 지원 횟수는 반환되지 않습니다.",
      )
    : a;
}
export function retargetAir(a: AirState, c: AirContext) {
  if (
    !airActive(a) ||
    a.onboard ||
    a.status === "returning" ||
    !skyLanding.includes(c.position) ||
    a.target === c.position
  )
    return a;
  return stage(
    { ...a, target: c.position, rain: c.weather === "drizzle", delay: 0 },
    "enroute",
    c.at,
    "새 H 지점으로 접근 경로 변경 · 비행 시간 재산정",
  );
}
export function airDuration(a: AirState, status = a.status) {
  return status === "requested"
    ? 1
    : status === "preparing"
      ? 4
      : status === "enroute"
        ? a.rain
          ? 20
          : 15
        : status === "approach"
          ? 5
          : status === "hoisting"
            ? 5
            : status === "transporting" || status === "returning"
              ? 10
              : 0;
}
export function airEta(a: AirState) {
  const phases: AirStatus[] = [
      "requested",
      "preparing",
      "enroute",
      "approach",
      "hoisting",
      "transporting",
    ],
    status = a.status === "delayed" ? a.resume : a.status,
    i = phases.indexOf(status);
  return i < 0
    ? 0
    : phases.slice(i).reduce((n, s) => n + airDuration(a, s), 0) - a.phase;
}
// Called once per game minute by the central engine, never by animation callbacks.
export function airMinute(a: AirState, c: AirContext): AirState {
  if (!airActive(a)) return a;
  if (!a.onboard && c.health <= 0)
    return stage(a, "cancelled", c.at, "조난자 상태 소진 · 이송 불가");
  if (a.status === "returning")
    return a.phase + 1 >= 10
      ? stage(a, "cancelled", c.at, "헬기 본부 복귀 완료")
      : { ...a, phase: a.phase + 1 };
  const pending = a.status === "delayed" ? a.resume : a.status;
  const unsafe =
    !a.onboard &&
    (!c.ready ||
      !airWeatherSafe(c.weather, a.target) ||
      (["approach", "hoisting"].includes(pending) && c.position !== a.target));
  if (unsafe) {
    const n =
      a.status === "delayed"
        ? a
        : stage(
            { ...a, resume: a.status },
            "delayed",
            c.at,
            !c.ready
              ? "구조 준비 미완료 · 현장 상태 재확인 필요"
              : c.position !== a.target
                ? "구조팀 위치 불일치 · 현장 복귀 또는 H 지점 변경 필요"
                : "기상 악화 · 최대 30분 대기 후 복귀",
          );
    return n.delay + 1 >= 30
      ? stage(
          { ...n, delay: 30 },
          "returning",
          c.at,
          "접근 대기 한도 초과 · 지상 귀환을 진행하세요.",
        )
      : { ...n, delay: n.delay + 1 };
  }
  if (a.status === "delayed")
    return stage(
      { ...a, delay: 0 },
      a.resume,
      c.at,
      "조건 회복 · 해당 접근 단계를 다시 확인합니다.",
    );
  const n = { ...a, phase: a.phase + 1 };
  if (n.phase < airDuration(a)) return n;
  const next: Partial<Record<AirStatus, AirStatus>> = {
    requested: "preparing",
    preparing: "enroute",
    enroute: "approach",
    approach: "hoisting",
    hoisting: "transporting",
    transporting: "complete",
  };
  const target = next[a.status]!;
  return stage(
    { ...n, onboard: a.onboard || target === "transporting" },
    target,
    c.at,
    target === "transporting"
      ? "조난자 탑승 완료 · 구조팀은 지상 귀환"
      : target === "complete"
        ? "조난자 안전 인계 완료 · 구조팀 본부 복귀 확인 필요"
        : airNames[target],
  );
}
