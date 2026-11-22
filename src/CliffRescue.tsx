import { useEffect, useRef, useState } from "react";
import {
  cliffResult,
  cliffRules,
  cliffStageNames,
  tensionAt,
  type CliffCommand,
} from "./rescueActions";
import { disasterWeather, type DisasterGame } from "./disaster";
import { weatherInfo, missions } from "./conditions";
function Person({ casualty = false }: { casualty?: boolean }) {
  return (
    <g strokeLinecap="round">
      <rect
        x="-16"
        y="-2"
        width="12"
        height="25"
        rx="4"
        fill={casualty ? "#537e94" : "#405965"}
      />
      <circle cy="-14" r="9" fill="#edc4a0" />
      <path d="M-10-16Q0-35 10-16Z" fill={casualty ? "#9bc2c2" : "#f7c75d"} />
      <path
        d="M0-3v25M0 4l-14 10M0 4l14-12M0 22l-10 19M0 22l14 18"
        fill="none"
        stroke={casualty ? "#9dcac9" : "#ed9455"}
        strokeWidth="9"
      />
      <path d="M-6 16h12" stroke="#f3dfb4" strokeWidth="4" />
    </g>
  );
}
export default function CliffRescue({
  game,
  command,
  busy,
  motion,
  onSound,
}: {
  game: DisasterGame;
  command: (c: CliffCommand) => void;
  busy: boolean;
  motion: boolean;
  onSound: () => void;
}) {
  const s = game.cliff!,
    w = disasterWeather(game),
    rules = cliffRules(game.difficulty, w),
    rope = game.equipment.includes("rope");
  const [gauge, setGauge] = useState(5),
    [speed, setSpeed] = useState(50),
    [help, setHelp] = useState(false),
    [staticInput, setStaticInput] = useState(false),
    [shake, setShake] = useState(false),
    [osReduced, setOsReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  const sample = useRef(5),
    elapsed = useRef(0),
    precision = !motion || osReduced || staticInput,
    paused = s.paused || !s.visible;
  useEffect(() => {
    const m = matchMedia("(prefers-reduced-motion: reduce)"),
      f = () => setOsReduced(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);
  useEffect(() => {
    if (s.stage !== "tension" || precision || paused || busy) return;
    let frame = 0,
      last = 0;
    const tick = (now: number) => {
      if (!document.hidden) {
        if (last) elapsed.current += Math.min(50, now - last);
        sample.current = tensionAt(elapsed.current, game.difficulty, w);
        setGauge(sample.current);
      }
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [
    s.stage,
    s.hits,
    s.mistakes,
    precision,
    paused,
    busy,
    game.difficulty,
    w,
  ]);
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && !s.paused) command({ type: "pause" });
    };
    document.addEventListener("visibilitychange", hidden);
    return () => document.removeEventListener("visibilitychange", hidden);
  }, [command, s.paused]);
  const result = cliffResult(s, false, rope),
    auto = cliffResult(s, true, rope),
    y =
      s.stage === "hoist"
        ? 100
        : s.stage === "approach"
          ? 310
          : s.stage === "descent"
            ? 140 + s.descent * 55
            : 125;
  return (
    <section
      className={`modal cliff-scene weather-${w} ${precision ? "cliff-static" : ""} ${s.paused ? "cliff-paused" : ""} ${shake ? "cliff-shake" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cliff-title"
    >
      <span className="eyebrow orange">
        {missions[game.mission].name} · 현장 구조
      </span>
      <h2 id="cliff-title">{cliffStageNames[s.stage]}</h2>
      <div className="cliff-hud">
        <span>
          {weatherInfo[w].icon} {weatherInfo[w].name}
        </span>
        <span>대원 체력 {game.stamina}</span>
        <span>조난자 {Math.round(game.health)}</span>
        <span>안정성 {s.stability}%</span>
      </div>
      <svg
        className="cliff-art"
        viewBox="0 0 720 410"
        role="img"
        aria-label={`절벽 현장 · ${cliffStageNames[s.stage]} · 하강 ${s.descent}/3`}
      >
        <defs>
          <linearGradient id="cliff-sky" x2="0" y2="1">
            <stop stopColor="#496479" />
            <stop offset="1" stopColor="#152c35" />
          </linearGradient>
          <pattern
            id="cliff-rain"
            width="35"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path d="M20 0l-8 22" stroke="#bfd7dd" opacity=".35" />
          </pattern>
        </defs>
        <rect width="720" height="410" fill="url(#cliff-sky)" />
        <g className="cliff-clouds" fill="#c7d9d7" opacity=".13">
          <ellipse cx="540" cy="70" rx="150" ry="28" />
          <ellipse cx="150" cy="45" rx="180" ry="35" />
        </g>
        <g
          className="cliff-wall"
          style={{ transform: `translateY(${-s.descent * 4}px)` }}
        >
          <path
            d="M0 65L205 45 300 100 330 240 290 315 350 410H0Z"
            fill={w === "rain" ? "#34464b" : "#526b68"}
          />
          <path
            d="M80 75L110 210 85 350M210 90L230 230 190 330M300 100l-45 100 40 80"
            fill="none"
            stroke="#80938b"
            strokeWidth="3"
          />
          <path d="M260 350h180l40 60H210Z" fill="#637b73" />
        </g>
        <path
          d="M440 410Q540 310 720 370"
          stroke="#72aab3"
          strokeWidth="12"
          fill="none"
        />
        <g className="cliff-rope">
          <path
            d={`M270 72Q${w === "wind" ? 365 : 345} 160 365 ${y + 10}`}
            fill="none"
            stroke="#efcf8a"
            strokeWidth="4"
          />
          <circle cx="270" cy="72" r="9" fill="#efcf8a" />
        </g>
        <g
          style={{ transform: `translate(365px, ${y}px)` }}
          className="cliff-rescuer"
        >
          <Person />
          {s.stage === "hoist" && (
            <g transform="translate(34 10)">
              <Person casualty />
            </g>
          )}
        </g>
        {s.stage !== "hoist" && (
          <g transform="translate(405 319)">
            <Person casualty />
            <path
              className="cliff-signal"
              d="M23-18q18-10 0-20m8 25q30-18 0-35"
              fill="none"
              stroke="#bde7d8"
              strokeWidth="2"
            />
          </g>
        )}
        {(w === "rain" || w === "drizzle") && (
          <rect
            className="rain-overlay"
            width="720"
            height="410"
            fill="url(#cliff-rain)"
          />
        )}
        {game.events.includes("rock") && (
          <g className="cliff-stones" fill="#b1ab8c">
            <path d="M280 140l10-8 8 11-11 10Z" />
            <path d="M298 215l6-4 5 8-7 4Z" />
          </g>
        )}
        <text x="30" y="385" fill="#d2e1d9" fontSize="13">
          동쪽 암릉 · 게임 시계 정지 · 구조 완료 시 비용 반영
        </text>
      </svg>
      <div className="cliff-toolbar">
        <button onClick={() => command({ type: "pause" })} disabled={busy}>
          {paused ? "조작 재개" : "일시정지"}
        </button>
        <button onClick={() => setHelp(!help)}>
          조작 설명 {help ? "닫기" : "다시 보기"}
        </button>
        <button onClick={onSound}>효과음 전환</button>
        <label>
          <input
            type="checkbox"
            checked={shake}
            onChange={(e) => setShake(e.target.checked)}
          />
          짧은 흔들림 허용
        </label>
      </div>
      {help && (
        <p>
          장력 바늘이 초록 안전 구간에 들어오면 고정 버튼을 클릭하거나 버튼에
          초점을 두고 Space/Enter를 누르세요. 하강은 슬라이더·좌우 방향키로
          속도를 고른 뒤 한 구간씩 진행합니다. 정밀 조작과 자동 구조도 사용할 수
          있습니다.
        </p>
      )}
      {paused ? (
        <p className="cliff-feedback">
          일시정지 중 · 단계·비용·게이지 진행을 보존합니다.
        </p>
      ) : (
        <>
          <p className={`cliff-feedback feedback-${s.feedback}`} role="status">
            {s.feedback === "miss"
              ? "안정성이 낮아졌습니다. 숨을 고르고 안전 구간을 확인하세요."
              : s.feedback === "good"
                ? "지지점 확보. 안정적인 움직임입니다."
                : "조작 전 장비와 기상을 확인하세요."}
          </p>
          {s.stage === "prepare" && (
            <>
              <p>
                {rope
                  ? "구조 로프 확인 완료"
                  : "구조 로프 미보유 · 지원팀 장비로 자동 구조 가능"}
                . 악천후에는 안전 구간이 좁아지고 바늘이 빨라집니다. 기본 성공
                10분/체력 5, 실수당 +3분/체력 2.
              </p>
              <button
                className="primary wide"
                disabled={busy || !rope}
                onClick={() => command({ type: "begin" })}
              >
                로프 확인 · 구조 시작
              </button>
            </>
          )}
          {s.stage === "tension" && (
            <>
              <p>
                안전 고정 {s.hits}/3 · 안전 폭 {rules.width}% · 실수{" "}
                {s.mistakes}회
              </p>
              <div
                className="tension-gauge"
                role="meter"
                aria-label="절벽 로프 장력"
                aria-valuenow={Math.round(gauge)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span className="caution-band" />
                <span
                  className="safe-band"
                  style={{
                    left: `${50 - rules.width / 2}%`,
                    width: `${rules.width}%`,
                  }}
                />
                <i style={{ left: `${gauge}%` }} />
              </div>
              <div className="gauge-legend">
                위험 · 주의 · <strong>초록 = 안전</strong> · 주의 · 위험
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={precision}
                  disabled={!motion || osReduced}
                  onChange={(e) => setStaticInput(e.target.checked)}
                />
                정밀 조작 · 움직임 없이 장력 선택
              </label>
              {precision && (
                <input
                  type="range"
                  aria-label="절벽 장력 조절"
                  min="0"
                  max="100"
                  value={gauge}
                  onChange={(e) => {
                    sample.current = Number(e.target.value);
                    setGauge(sample.current);
                  }}
                />
              )}
              <button
                className="primary wide"
                disabled={busy}
                onClick={() =>
                  command({ type: "tension", value: sample.current })
                }
              >
                안전 구간에서 고정 · Space / Enter
              </button>
            </>
          )}
          {s.stage === "recover" && (
            <>
              <p>
                지지점에서 안전하게 멈췄습니다. 재정비는 +4분이며 최대 2회
                가능합니다. 자동 구조는 언제든 선택할 수 있습니다.
              </p>
              <button
                disabled={busy || s.retries >= 2}
                onClick={() => command({ type: "retry" })}
              >
                안전 재시도 {s.retries}/2
              </button>
            </>
          )}
          {s.stage === "descent" && (
            <>
              <p>
                하강 {s.descent}/3 · 35~65 적정 속도. 느리면 +2분, 빠르면 안정성
                −15 및 +2분/체력 2.
              </p>
              <label>
                하강 속도 {speed}
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="절벽 하강 속도"
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                />
              </label>
              <button
                className="primary wide"
                disabled={busy}
                onClick={() => command({ type: "descend", speed })}
              >
                다음 지지점까지 하강
              </button>
            </>
          )}
          {s.stage === "approach" && (
            <>
              <blockquote>
                “서윤 씨, 이제 함께 올라갑니다. 손을 놓지 마세요.”
                <br />
                “네, 기다리고 있었어요.”
              </blockquote>
              <button
                className="primary wide"
                disabled={busy}
                onClick={() => command({ type: "approach" })}
              >
                상태 확인 · 함께 인양
              </button>
            </>
          )}
          {s.stage === "hoist" && (
            <>
              <p>
                {result.grade} · {result.time}분 / 체력 {result.energy} · 성공
                귀환 시 추가 경험치 {result.bonus}
              </p>
              <button
                className="primary wide"
                disabled={busy || game.stamina < result.energy}
                onClick={() => command({ type: "finish" })}
              >
                안전 인양 확정 · 연출 건너뛰기
              </button>
            </>
          )}
          <button
            className="text-button wide"
            disabled={busy || game.stamina < auto.energy}
            onClick={() => command({ type: "auto" })}
          >
            지원팀 자동 구조 · {auto.time}분 / 체력 {auto.energy}
          </button>
        </>
      )}
      {game.stamina < auto.energy && (
        <p>체력이 부족합니다. 지도로 돌아가 휴식한 뒤 이어서 구조하세요.</p>
      )}
      <button
        className="text-button wide"
        disabled={busy}
        onClick={() => command({ type: "suspend" })}
      >
        지도로 잠시 복귀 · 진행 보존
      </button>
    </section>
  );
}
