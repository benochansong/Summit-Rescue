import type { Scene } from "./disasterData";
export default function HelicopterScene({
  scene,
  onContinue,
  busy,
}: {
  scene: Scene;
  onContinue: () => void;
  busy: boolean;
}) {
  const approach = scene === "air-approach",
    hoist = scene === "air-hoist",
    depart = scene === "air-depart",
    done = scene === "air-complete";
  const title = approach
    ? "구조 지점 상공, 헬기 접근"
    : hoist
      ? "호버링 유지 · 조난자 인양"
      : depart
        ? "조난자 탑승 · 구조팀 귀환 개시"
        : done
          ? "조난자 안전 인계 완료"
          : scene === "air-delay"
            ? "기상과 현장을 다시 확인합니다"
            : scene === "air-return"
              ? "헬기 복귀 · 지상 작전 유지"
              : "본부, 항공 지원을 요청합니다";
  return (
    <section
      className={`modal helicopter-cinematic ${scene}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="air-title"
    >
      <span className="eyebrow orange">항공 구조 · 작전 기록 재생</span>
      <h2 id="air-title">{title}</h2>
      <svg
        viewBox="0 0 800 440"
        className="air-canvas"
        role="img"
        aria-label={title}
      >
        <defs>
          <linearGradient id="air-sky" x2="0" y2="1">
            <stop stopColor="#435f71" />
            <stop offset="1" stopColor="#102d34" />
          </linearGradient>
          <radialGradient id="air-light">
            <stop stopColor="#f8ecc5" stopOpacity=".4" />
            <stop offset="1" stopColor="#f8ecc5" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="440" fill="url(#air-sky)" />
        <g className="air-camera">
          <path
            d="M0 330L130 130 280 300 430 150 610 300 730 200 800 330V440H0Z"
            fill="#24434b"
          />
          <path
            d="M0 400L220 280 480 340 620 280 800 390V440H0Z"
            fill="#47665c"
          />
          <g className="air-cloud" opacity=".12" fill="#dbe5dc">
            <ellipse cx="500" cy="100" rx="180" ry="30" />
            <ellipse cx="100" cy="170" rx="120" ry="25" />
          </g>
          <ellipse
            cx="430"
            cy="364"
            rx="110"
            ry="17"
            fill="#071d22"
            opacity=".45"
          />
          <path
            className="air-searchlight"
            d="M410 165L325 360H540Z"
            fill="url(#air-light)"
          />
          <g className="air-dust" fill="none" stroke="#c7d6b2" opacity=".4">
            <ellipse cx="440" cy="362" rx="90" ry="12" />
            <ellipse cx="440" cy="362" rx="140" ry="22" />
          </g>
          <g className="rescue-aircraft">
            <g transform="translate(410 150)">
              <path
                d="M-90-20Q-95-45-50-48H38Q77-38 82 3L50 30H-60Q-93 18-90-20Z"
                fill="#e78946"
                stroke="#f9bc7e"
                strokeWidth="2"
              />
              <path d="M55-35L155-75 167-62 77-4Z" fill="#c8713f" />
              <path d="M-79-29Q-75-41-50-40H-25V-6H-83Z" fill="#7ac4ce" />
              <rect
                x="-16"
                y="-35"
                width="36"
                height="45"
                rx="4"
                fill="#193c48"
              />
              <path d="M31-23v25M19-11h25" stroke="#fff3cf" strokeWidth="7" />
              <path
                d="M-60 37H65M-42 24l-8 13M40 25l12 12M-5-47v-15"
                stroke="#c9d6cf"
                strokeWidth="5"
              />
              <g className="air-main-rotor">
                <path d="M-140-62H140" stroke="#e0e6d5" strokeWidth="6" />
                <ellipse cy="-62" rx="145" ry="6" fill="#dfe7d5" opacity=".2" />
              </g>
              <g transform="translate(158 -64)">
                <g className="air-tail-rotor">
                  <path
                    d="M-15 0H15M0-15V15"
                    stroke="#d6e1d4"
                    strokeWidth="4"
                  />
                </g>
              </g>
              <text x="-65" y="17" fontSize="12" fill="#fff1cc">
                RESCUE 01
              </text>
            </g>
          </g>
          {(hoist || depart) && (
            <g className="air-lift">
              <path d="M410 180V320" stroke="#dfd0aa" strokeWidth="3" />
              <g className="air-stretcher">
                <path d="M370 324h80" stroke="#dfd0aa" strokeWidth="4" />
                <rect
                  x="381"
                  y="310"
                  width="57"
                  height="12"
                  rx="5"
                  fill="#9dc9c4"
                />
                <circle cx="378" cy="314" r="7" fill="#e4bf99" />
              </g>
            </g>
          )}
          <g
            transform="translate(510 350)"
            stroke="#efa562"
            strokeWidth="9"
            strokeLinecap="round"
          >
            <circle cy="-25" r="8" fill="#ead0a7" stroke="none" />
            <path d="M0-10v24M0-3l-18-14M0-3l18-9M0 14l-11 18M0 14l12 18" />
          </g>
          <text x="30" y="411" fill="#deeadb" fontSize="14">
            조난자 이송 ≠ 임무 완료 · 지상 구조팀의 귀환을 확인하십시오
          </text>
        </g>
      </svg>
      <p>
        {depart || done
          ? "조난자는 항공 지원으로 이동합니다. 구조팀은 지상 경로로 본부에 복귀해야 전체 임무가 완료됩니다."
          : scene === "air-delay"
            ? "기상 개선을 기다리거나 지상 구조로 전환할 수 있습니다. 새로운 H 지점에서는 접근 경로를 변경할 수 있습니다."
            : "출동·접근·인양 비용과 시간은 공통 게임 시계에서 이미 계산했습니다. 연출 중에는 시간이 흐르지 않습니다."}
      </p>
      <button className="primary wide" disabled={busy} onClick={onContinue}>
        상황 확인 · 항공 연출 건너뛰기
      </button>
    </section>
  );
}
