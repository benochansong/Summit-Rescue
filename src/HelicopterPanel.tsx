import {
  airNames,
  airEta,
  airRequestReason,
  airActive,
  skyLanding,
} from "./helicopter";
import {
  disasterWeather,
  disasterCost,
  safeRoute,
  type DisasterGame,
  type DisasterAction,
} from "./disaster";
import { point } from "./regions";
export default function HelicopterPanel({
  game,
  act,
  busy,
}: {
  game: DisasterGame;
  act: (a: DisasterAction) => void;
  busy: boolean;
}) {
  const a = game.air!,
    reason = airRequestReason(a, {
      at: game.elapsed,
      weather: disasterWeather(game),
      position: game.position,
      ready: game.found && game.secured && game.treated && game.carried,
      health: game.health,
    });
  const route = safeRoute(game, game.position, "base") ?? [];
  let state = game,
    total = 0;
  for (const to of route) {
    total += disasterCost(state, { type: "move", to }).time;
    state = { ...state, position: to };
  }
  return (
    <section className="panel sky-panel">
      <span className="eyebrow orange">항공 지원 · {1 - a.used}/1회 남음</span>
      <h2>{airNames[a.status]}</h2>
      <p role="status">
        {a.history.at(-1)?.message ??
          "기상과 구조 준비를 확인하고 지원을 결정하세요."}
      </p>
      <p>
        {a.onboard
          ? "조난자: 헬기 탑승 · 구조팀 별도 귀환 필요"
          : game.treated
            ? "조난자: 처치 완료 · 지상 동행 가능"
            : "조난자: 발견·처치 필요"}
      </p>
      <p>
        H: {skyLanding.map((id) => point(id, 9).name).join(" · ")}
        <br />
        개방 능선은 맑음·흐림에서만 지원
      </p>
      <p>지상 이동 최소 {total}분 · 휴식과 이후 기상 변화 별도</p>
      {airActive(a) && (
        <p>
          대상 {point(a.target, 9).name} ·{" "}
          {a.status === "returning"
            ? "복귀까지"
            : a.status === "delayed"
              ? "조건 회복 후 인계까지"
              : "예상 인계까지"}{" "}
          {a.status === "returning" ? 10 - a.phase : airEta(a)}분 · 요청 뒤
          시계가 흐르는 행동 필요
        </p>
      )}
      {!a.used && (
        <>
          <p>
            요청 2분/체력1 + 준비·비행·접근·구조·이송{" "}
            {disasterWeather(game) === "drizzle" ? 45 : 40}분. 조난자만
            이송합니다.
          </p>
          <p>{reason || "출동 가능 · 도착 때 기상과 위치 재확인"}</p>
          <button
            className="primary wide"
            disabled={busy || !!reason || game.stamina < 1}
            onClick={() => act({ type: "air-request" })}
          >
            헬기 출동 요청 · 2분 / 체력 1
          </button>
        </>
      )}
      {airActive(a) && !a.onboard && a.status !== "returning" && (
        <div className="button-row">
          <button disabled={busy} onClick={() => act({ type: "air-cancel" })}>
            지상 구조 전환 · 2분
          </button>
          <button
            disabled={
              busy ||
              !skyLanding.includes(game.position) ||
              a.target === game.position ||
              game.stamina < 1
            }
            onClick={() => act({ type: "air-retarget" })}
          >
            현재 H로 변경 · 2분 / 체력 1
          </button>
        </div>
      )}
      <button
        className="wide"
        disabled={busy}
        onClick={() => act({ type: "wait" })}
      >
        현장 대기 · 10분 / 체력 0
      </button>
    </section>
  );
}
