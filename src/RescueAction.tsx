import { useEffect, useRef, useState } from "react";
import {
  carryTerrain,
  disasterCost,
  disasterDisabled,
  signalPower,
  type DisasterAction,
  type DisasterGame,
} from "./disaster";
import { disasterProfiles, type Scene } from "./disasterData";
export function RescueIllustration({
  scene,
}: {
  scene: Scene | "rope" | "carry" | "signal" | "success";
}) {
  return (
    <svg
      className={`rescue-illustration scene-${scene}`}
      viewBox="0 0 720 300"
      role="img"
      aria-label={
        scene === "success"
          ? "조난자와 구조대의 안전한 귀환"
          : scene === "helicopter"
            ? "산 위로 접근하는 구조 헬기"
            : "암릉과 계곡의 구조 현장"
      }
    >
      <defs>
        <linearGradient id="scene-sky" x2="0" y2="1">
          <stop stopColor="#526b78" />
          <stop offset="1" stopColor="#152b31" />
        </linearGradient>
        <linearGradient id="scene-rock" x2=".8" y2="1">
          <stop stopColor="#78928b" />
          <stop offset="1" stopColor="#243f40" />
        </linearGradient>
      </defs>
      <rect width="720" height="300" fill="url(#scene-sky)" />
      <circle cx="590" cy="65" r="42" fill="#e7c997" opacity=".25" />
      <path
        d="M0 200L120 65 210 155 350 32 480 155 590 80 720 178V300H0Z"
        fill="#203e45"
      />
      <path
        d="M0 230L110 135 255 198 360 60 455 132 398 300H0Z"
        fill="url(#scene-rock)"
      />
      <path
        d="M360 60L365 165 322 215 330 300M110 135L145 230 255 198"
        stroke="#c7d4c1"
        strokeWidth="3"
        fill="none"
        opacity=".3"
      />
      <path
        className="scene-water"
        d="M720 220Q540 200 480 260T340 300"
        stroke="#6da8b0"
        strokeWidth={scene === "flood" ? 35 : 12}
        fill="none"
      />
      {scene === "rock" && (
        <g className="falling-rocks" fill="#a8a492">
          <path d="M420 80l18-8 17 14-9 19-24-7Z" />
          <path d="M449 115l12-9 17 8-5 20-20-3Z" />
          <path d="M401 135l11-9 18 6-7 20-15 2Z" />
          <ellipse
            cx="440"
            cy="205"
            rx="70"
            ry="25"
            fill="#c7b893"
            opacity=".3"
          />
        </g>
      )}
      {["found", "rope", "secured"].includes(scene) && (
        <>
          <path
            d="M358 78Q395 130 390 223"
            fill="none"
            stroke="#f2be7c"
            strokeWidth="3"
          />
          <g className="rope-rescuer" transform="translate(389 165)">
            <circle cy="-14" r="8" fill="#f4c48f" />
            <path
              d="M0-5v28M0 3l-15 12M0 3l13-8M0 23l-10 18M0 23l14 15"
              stroke="#f3a45f"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </g>
          <g transform="translate(421 250)">
            <circle r="8" fill="#ddd0b0" />
            <path
              d="M0 10l20 10 15 0"
              fill="none"
              stroke="#94bdc7"
              strokeWidth="12"
            />
          </g>
        </>
      )}
      {["carry", "success"].includes(scene) && (
        <g transform="translate(220 230)" strokeLinecap="round">
          <path d="M0 0l280 24" stroke="#778c7e" strokeWidth="9" />
          {[55, 175].map((x) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <circle cy="-45" r="9" fill="#e4c29e" />
              <path
                d="M0-30v28M0-19l24 12M0-2l-13 25M0-2l16 26"
                stroke="#f2a25e"
                strokeWidth="10"
              />
            </g>
          ))}
          <path d="M82-10h94" stroke="#ceceab" strokeWidth="5" />
          <path d="M100-18h60" stroke="#86b6b4" strokeWidth="14" />
        </g>
      )}
      {scene === "helicopter" && (
        <g className="scene-helicopter" transform="translate(440 100)">
          <path d="M-45 0h85l-12 28h-56Z" fill="#e5ad6c" />
          <path
            d="M25 0l70-23 3 8-61 29M-35-10h85M0-10v-12M-60-22H60M-35 35h70"
            stroke="#dae1d4"
            strokeWidth="4"
          />
          <path d="M-13 4H8v18h-21Z" fill="#274f58" />
          <path d="M0 30v88" stroke="#d7c8a8" strokeWidth="2" />
        </g>
      )}
      {scene === "signal" &&
        [40, 75, 110].map((r) => (
          <circle
            key={r}
            cx="360"
            cy="160"
            r={r}
            fill="none"
            stroke="#92d2bc"
            opacity=".4"
            strokeDasharray="5 9"
          />
        ))}
    </svg>
  );
}
export default function RescueActionPanel({
  game,
  act,
  busy,
  motion,
}: {
  game: DisasterGame;
  act: (a: DisasterAction) => void;
  busy: boolean;
  motion: boolean;
}) {
  const session = game.action!,
    [angle, setAngle] = useState(0),
    [gauge, setGauge] = useState(0),
    [manualPrecision, setPrecision] = useState(false),
    [reducedMotion, setReducedMotion] = useState(
      () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [speed, setSpeed] = useState<"careful" | "steady">("careful");
  const started = useRef(0),
    value = useRef(0);
  const precision = !motion || reducedMotion || manualPrecision;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (session.kind !== "rope" || precision) return;
    let frame = 0;
    started.current = 0;
    const tick = (now: number) => {
      if (!started.current || document.hidden) started.current = now;
      const v = (((now - started.current) / 6500) % 1) * 100;
      value.current = v;
      setGauge(v);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session.kind, session.round, precision]);
  const title =
    session.kind === "signal"
      ? "구조 신호 탐지"
      : session.kind === "rope"
        ? "절벽 로프 구조"
        : "부상자 이송";
  const autoCost = disasterCost(game, { type: "auto" }),
    terrain = carryTerrain(game),
    zone = disasterProfiles[game.difficulty].window;
  const manualReason =
    session.kind === "rope"
      ? disasterDisabled(game, { type: "rope", value: gauge })
      : "";
  return (
    <section
      className="modal action-scene"
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-title"
    >
      <span className="eyebrow orange">
        현장 구조 · 게임 시간은 완료 시 반영
      </span>
      <h2 id="action-title">{title}</h2>
      <RescueIllustration scene={session.kind} />
      {game.mission === 10 && session.kind === "signal" && (
        <p>
          정확한 수동 분석: 후보 1곳·기본 8분. 자동 분석: 후보 최대 2곳·16분.
          수동 실패 3회: 부분 정보·20분.
        </p>
      )}
      <div className="action-progress" aria-live="polite">
        진행{" "}
        {(game.mission === 8 || game.mission === 10) &&
        session.kind === "signal"
          ? (session.steady ?? 0)
          : session.round}{" "}
        /{" "}
        {(game.mission === 8 || game.mission === 10) &&
        session.kind === "signal"
          ? 2
          : 3}{" "}
        ·{" "}
        {session.mistakes
          ? `실수 ${session.mistakes}회 · 추가 비용으로 계속 진행합니다`
          : "안전하게 진행 중"}
      </div>
      {session.kind === "rope" && (
        <>
          <p>
            안전 구간에서 장력을 고정하세요. 3회 조작 · 실수당 +4분/체력 3. 한
            번의 실수로 구조가 취소되지 않습니다.
          </p>
          <div
            className="tension-gauge"
            role="meter"
            aria-label="로프 장력"
            aria-valuenow={Math.round(gauge)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="safe-band"
              style={{ left: `${50 - zone / 2}%`, width: `${zone}%` }}
            />
            <i style={{ left: `${gauge}%` }} />
          </div>
          <label className="precision-toggle">
            <input
              type="checkbox"
              checked={precision}
              onChange={(e) => setPrecision(e.target.checked)}
              disabled={!motion || reducedMotion}
            />{" "}
            정밀 조작 · 움직임 없이 슬라이더로 장력 조절
          </label>
          {precision && (
            <input
              type="range"
              aria-label="장력 조절"
              min="0"
              max="100"
              value={gauge}
              onChange={(e) => {
                value.current = Number(e.target.value);
                setGauge(value.current);
              }}
            />
          )}
          <button
            className="primary wide"
            disabled={busy || !!manualReason}
            onClick={() => act({ type: "rope", value: value.current })}
          >
            장력 고정 · Space / Enter
          </button>
          {manualReason && <p className="orange">{manualReason}</p>}
        </>
      )}
      {session.kind === "signal" && (
        <>
          <p>
            방향을 돌려 신호가 가장 선명해지는 곳을 찾으세요. 0° 북쪽 · 90° 동쪽
            · 180° 남쪽 · 270° 서쪽.{" "}
            {game.mission === 8 || game.mission === 10
              ? "강한 신호를 2회 연속 확인하세요. 실패하면 연속 포착이 초기화됩니다."
              : "세 번 분석하면 지원팀이 교차 확인합니다."}
          </p>
          <div
            className="signal-dial"
            style={{ "--bearing": `${angle}deg` } as React.CSSProperties}
          >
            <i />
            <strong>
              {signalPower(game, angle)}%<small>신호 선명도</small>
            </strong>
          </div>
          <label>
            안테나 방향 {angle}°
            <input
              aria-label="안테나 방향"
              type="range"
              min="0"
              max="359"
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
          </label>
          <button
            className="primary wide"
            disabled={busy}
            onClick={() => act({ type: "signal", angle })}
          >
            현재 방향 분석
          </button>
        </>
      )}
      {session.kind === "carry" && (
        <>
          <p>
            장애물을 피하고 좁은 길에서는 천천히 이동하세요. 실수는 +4분/체력 3,
            신중한 속도는 구간당 +2분입니다.
          </p>
          <label>
            이송 속도{" "}
            <select
              aria-label="이송 속도"
              value={speed}
              onChange={(e) => setSpeed(e.target.value as typeof speed)}
            >
              <option value="careful">신중하게 · 좁은 길 안전</option>
              <option value="steady">보통 속도 · 넓은 길 권장</option>
            </select>
          </label>
          <div className="carry-lanes">
            {["왼쪽", "가운데", "오른쪽"].map((name, i) => (
              <button
                key={name}
                disabled={busy}
                onClick={() => act({ type: "carry", lane: i, speed })}
              >
                <b>{name} 경로</b>
                <span>
                  {i === terrain.blocked
                    ? "낙석 잔해 · 피하세요"
                    : i === terrain.narrow
                      ? "좁은 발판 · 신중한 속도"
                      : "넓은 길 · 통행 가능"}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        className="text-button wide"
        disabled={busy || !!disasterDisabled(game, { type: "auto" })}
        onClick={() => act({ type: "auto" })}
      >
        자동 구조로 완료 · {autoCost.time}분 / 체력 {autoCost.energy}
      </button>
      <small>
        자동 지원도 정상 구조로 인정됩니다. 지금까지 완료하지 않은 액션의 비용은
        완료 시 한 번만 적용합니다.
      </small>
    </section>
  );
}
