import { useEffect, useRef, useState } from "react";
import MountainMap from "./Map";
import {
  actionCost,
  adjacent,
  createGame,
  disabledReason,
  healthLabel,
  objective,
  point,
  points,
  stars,
  transition,
} from "./game";
import type { Action } from "./game";
import {
  missionStats,
  readRecords,
  readSettings,
  saveRecord,
  saveSettings,
} from "./storage";
import { equipment, missions, weatherAt, weatherInfo } from "./conditions";
import type { Equipment, MissionId } from "./conditions";
import {
  EncounterDialog,
  ForecastBar,
  Loadout,
  MissionSelect,
} from "./MissionPanels";

function Emblem() {
  return (
    <svg width="42" height="46" viewBox="0 0 42 46" aria-hidden="true">
      <path
        d="M21 2L39 9V29L21 43 3 29V9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M9 28L18 13 24 23 28 18 35 29H9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M21 6V12M18 9H24" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function Landscape() {
  return (
    <svg
      className="landscape"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sky" x2="0" y2="1">
          <stop stopColor="#738c8e" />
          <stop offset=".5" stopColor="#536969" />
          <stop offset="1" stopColor="#142a28" />
        </linearGradient>
        <linearGradient id="mount" x2=".5" y2="1">
          <stop stopColor="#81938b" />
          <stop offset="1" stopColor="#203a34" />
        </linearGradient>
        <linearGradient id="mist" x2="0" y2="1">
          <stop stopColor="#9fb2a7" stopOpacity="0" />
          <stop offset=".5" stopColor="#9fb2a7" stopOpacity=".18" />
          <stop offset="1" stopColor="#9fb2a7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1600" height="1000" fill="url(#sky)" />
      <path
        d="M0 520L160 310 230 350 430 155 580 340 750 190 960 430 1140 240 1320 390 1450 220 1600 390V1000H0Z"
        fill="#586e69"
      />
      <path
        d="M320 550L680 210 780 330 850 275 1200 620 1360 430 1600 580V1000H0V660Z"
        fill="url(#mount)"
      />
      <path
        d="M680 210L650 365 712 310 780 330 730 355 750 470 850 275 990 475 870 400 840 445 810 380 760 565 620 500 520 500Z"
        fill="#c3cabe"
        opacity=".38"
      />
      <path
        d="M0 620L190 470 400 660 620 490 840 750 1050 550 1260 660 1510 410 1600 520V1000H0Z"
        fill="#28453b"
      />
      <path d="M0 800Q450 620 850 780T1600 700V1000H0Z" fill="#18342c" />
      <rect y="560" width="1600" height="240" fill="url(#mist)" />
      {Array.from({ length: 75 }, (_, i) => {
        const x = i * 24,
          y = 780 + Math.sin(i * 0.6) * 50,
          h = 70 + ((i * 37) % 80);
        return (
          <path
            key={i}
            d={`M${x} ${y - h}l-18 40h8l-24 45h12l-20 35h84l-22-35h10l-23-45h8Z`}
            fill={i % 3 ? "#102b24" : "#19372d"}
          />
        );
      })}
    </svg>
  );
}
export default function App() {
  const [screen, setScreen] = useState<
    "menu" | "missions" | "briefing" | "game" | "records" | "help" | "settings"
  >("menu");
  const [mission, setMission] = useState<MissionId>(1);
  const [loadout, setLoadout] = useState<Equipment[]>([
    "kit",
    "blanket",
    "rope",
  ]);
  const [seedInput, setSeedInput] = useState("");
  const [game, setGame] = useState(() => createGame());
  const [selected, setSelected] = useState("gate");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [settings, setSettings] = useState(readSettings);
  const [notice, setNotice] = useState("");
  const [foundOpen, setFoundOpen] = useState(false);
  const [abortOpen, setAbortOpen] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    saveSettings(settings);
    document.documentElement.dataset.motion = settings.motion ? "on" : "off";
  }, [settings]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, game.runId]);
  const modalVisible =
    screen === "game" &&
    (foundOpen || abortOpen || !!game.pending || game.status !== "active");
  useEffect(() => {
    if (!modalVisible) return;
    const previous = document.activeElement as HTMLElement | null;
    const modal = document.querySelector<HTMLElement>(
      ".modal-backdrop:last-of-type .modal",
    );
    const controls = () =>
      Array.from(
        modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [tabindex="0"]',
        ) ?? [],
      );
    controls()[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = controls();
      if (!list.length) return;
      const first = list[0],
        last = list.at(-1)!;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !modal?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !modal?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus({ preventScroll: true });
    };
  }, [modalVisible, foundOpen, game.pending?.kind, game.status, busy]);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      void audio.current?.close();
    },
    [],
  );
  function beep() {
    if (!settings.sound) return;
    try {
      const ctx = audio.current ?? new AudioContext();
      audio.current = ctx;
      void ctx.resume();
      const o = ctx.createOscillator(),
        v = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(660, ctx.currentTime);
      v.gain.setValueAtTime(settings.volume * 0.1, ctx.currentTime);
      v.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.connect(v);
      v.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.2);
    } catch {
      /* Audio is optional. */
    }
  }
  function start() {
    clearTimeout(timer.current);
    lock.current = false;
    setBusy(false);
    setGame(
      createGame(
        seedInput.trim() ? Number(seedInput) >>> 0 : Date.now(),
        mission,
        loadout,
      ),
    );
    setSelected("gate");
    setNotice("");
    setFoundOpen(false);
    setAbortOpen(false);
    setScreen("game");
    beep();
  }
  function act(action: Action) {
    if (lock.current) return;
    const reason = disabledReason(game, action);
    if (reason) {
      setNotice(reason);
      return;
    }
    lock.current = true;
    setBusy(true);
    setNotice("");
    const next = transition(game, action, game.revision);
    setGame(next);
    beep();
    if (!game.found && next.found) setFoundOpen(true);
    if (next.status !== "active" && !saveRecord(next))
      setNotice(
        "브라우저 저장 공간을 사용할 수 없어 이번 기록은 저장하지 못했습니다.",
      );
    timer.current = setTimeout(
      () => {
        lock.current = false;
        setBusy(false);
      },
      settings.motion ? 650 : 250,
    );
  }
  const currentMission = missions[game.mission];
  const briefingMission = missions[mission];
  const weather = weatherAt(game.mission, game.elapsed);
  const conditions = weatherInfo[weather];
  const time = currentMission.start + game.elapsed;
  const clock = `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
  const records = screen === "records" ? readRecords() : [];
  const cost = actionCost(game, { type: "move", to: selected });
  const button = (action: Action, label: string, primary = false) => {
    const c = actionCost(game, action);
    const reason = disabledReason(game, action);
    return (
      <button
        className={`action-button ${primary ? "primary" : ""}`}
        disabled={busy || !!reason}
        title={
          reason || `${c.time}분, 체력 ${c.energy < 0 ? "+" : ""}${-c.energy}`
        }
        onClick={() => act(action)}
      >
        <strong>{label}</strong>
        <small>
          {c.time}분 · 체력 {c.energy < 0 ? "+" : ""}
          {-c.energy}
        </small>
      </button>
    );
  };
  return (
    <div className={`app ${screen === "game" ? "in-game" : "in-menu"}`}>
      <header className="brandbar">
        <button
          className="brand"
          onClick={() => {
            if (screen === "game" && game.status === "active")
              setAbortOpen(true);
            else setScreen("menu");
          }}
        >
          <Emblem />
          <span>
            <b>SUMMIT RESCUE</b>
            <small>백운산 산악구조대</small>
          </span>
        </button>
        <div className="header-right">
          <span className="status-indicator" />
          구조본부 통신 정상{" "}
          <button
            className="icon-button"
            aria-label={settings.sound ? "소리 끄기" : "소리 켜기"}
            onClick={() => setSettings({ ...settings, sound: !settings.sound })}
          >
            {settings.sound ? "소리 켜짐" : "음소거"}
          </button>
        </div>
      </header>
      {screen === "menu" && (
        <main className="menu">
          <Landscape />
          <div className="menu-shade" />
          <div className="menu-content">
            <div className="eyebrow orange">산악 구조 전략 시뮬레이션</div>
            <h1>
              SUMMIT
              <br />
              <span>RESCUE</span>
              <i>서밋 레스큐</i>
            </h1>
            <p className="tagline">
              정상에 오르는 것이 목표가 아니다.
              <br />
              <strong>모두 살아 돌아오는 것이 목표다.</strong>
            </p>
            <div className="menu-actions">
              <button
                className="primary start-button"
                onClick={() => setScreen("missions")}
              >
                <span>✚</span> 구조 임무 시작{" "}
                <small>다음 구조 작전을 준비하세요</small>
              </button>
              <div className="menu-secondary">
                <button onClick={() => setScreen("records")}>구조 기록</button>
                <button onClick={() => setScreen("help")}>게임 방법</button>
                <button onClick={() => setScreen("settings")}>설정</button>
              </div>
            </div>
            <div className="menu-caption">
              <span>백운산 국립공원</span>
              <span>해발 1,087 m · 북부 구조 관할 구역</span>
            </div>
          </div>
          <div className="menu-coordinate">
            37° 08′ N<br />
            127° 37′ E<br />
            <span>가상의 작전 구역</span>
          </div>
          <footer className="menu-footer">
            <span>산을 읽고. 흔적을 따라. 함께 돌아오다.</span>
            <span>폭풍 경보 · 02</span>
          </footer>
        </main>
      )}
      {screen === "missions" && (
        <MissionSelect
          onBack={() => setScreen("menu")}
          onSelect={(id) => {
            setMission(id);
            setScreen("briefing");
          }}
        />
      )}
      {screen === "briefing" && (
        <main className="page briefing">
          <button className="text-button" onClick={() => setScreen("menu")}>
            메인 메뉴로
          </button>
          <div className="eyebrow orange">
            긴급 구조 요청 · 임무 {mission.toString().padStart(2, "0")}
          </div>
          <h1>{briefingMission.name}</h1>
          <p className="page-lead">
            한 사람의 발자국.
            <br />그 끝에, 당신을 기다리는 누군가.
          </p>
          <div className="briefing-grid">
            <section className="panel">
              <div className="section-title">▥ 수신된 무전</div>
              <blockquote>“{briefingMission.description}”</blockquote>
              <div className="mission-stats">
                <div>
                  <small>수색 가능 시간</small>
                  <strong>
                    {briefingMission.limit} <em>분</em>
                  </strong>
                </div>
                <div>
                  <small>구조대원 체력</small>
                  <strong>
                    100 <em>%</em>
                  </strong>
                </div>
                <div>
                  <small>작전 난이도</small>
                  <strong>{briefingMission.difficulty}</strong>
                </div>
              </div>
            </section>
            <section className="panel">
              <div className="section-title">출동 전 확인</div>
              <ol className="brief-steps">
                <li>제2전망대까지 등산로를 따라 이동</li>
                <li>주변을 수색하고 단서의 방향 확인</li>
                <li>조난자 발견 후 응급처치</li>
                <li>조난자와 구조본부로 무사 귀환</li>
              </ol>
              <p className="muted">
                시간은 행동할 때만 흐릅니다. 지도를 충분히 살펴보고 결정하세요.
              </p>
              <button className="primary wide" onClick={start}>
                장비 확인 · 구조대 출동
              </button>
            </section>
          </div>
          <Loadout
            loadout={loadout}
            setLoadout={setLoadout}
            mission={mission}
            seed={seedInput}
            setSeed={setSeedInput}
          />
          <button className="primary wide" onClick={start}>
            장비 확인 · 구조대 출동
          </button>
        </main>
      )}
      {screen === "game" && (
        <main className="operation">
          <div className="mission-strip">
            <div>
              <span className="eyebrow orange">
                진행 중인 구조 작전 · 임무{" "}
                {game.mission.toString().padStart(2, "0")}
              </span>
              <h1>{currentMission.name}</h1>
            </div>
            <div className="hud">
              <div>
                <small>현지 시각</small>
                <strong>{clock}</strong>
              </div>
              <div
                className={
                  currentMission.limit - game.elapsed <= 40 ? "urgent" : ""
                }
              >
                <small>남은 시간</small>
                <strong>
                  {Math.max(0, currentMission.limit - game.elapsed)} <em>분</em>
                </strong>
              </div>
              <div>
                <small>구조대원 체력</small>
                <strong>
                  {game.stamina}
                  <em> / 100</em>
                </strong>
                <div className="meter">
                  <i style={{ width: `${game.stamina}%` }} />
                </div>
              </div>
              <div>
                <small>현재 날씨</small>
                <strong>
                  {conditions.icon} {conditions.name}
                </strong>
                <span className="weather-detail">{conditions.detail}</span>
              </div>
            </div>
          </div>
          <ForecastBar game={game} />
          <div className="operation-body">
            <div className="map-column">
              <MountainMap
                game={game}
                selected={selected}
                onSelect={setSelected}
                busy={busy}
                weather={weather}
                animate={settings.motion}
              />
              <div className="action-dock">
                <div className="location-info">
                  <select
                    aria-label="이동 지점 선택"
                    value={selected}
                    disabled={busy}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {points.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.id === game.position
                          ? " (현재)"
                          : adjacent(game.position).includes(p.id)
                            ? " (이동 가능)"
                            : ""}
                      </option>
                    ))}
                  </select>
                  <small>
                    선택한 지점 · 해발 {point(selected).elevation} m
                  </small>
                  <span>
                    {selected === game.position
                      ? "현재 위치"
                      : adjacent(game.position).includes(selected)
                        ? `이동 ${cost.time}분 · 체력 ${cost.energy} 소모`
                        : "연결된 지점을 거쳐 이동하세요"}
                  </span>
                </div>
                <div className="actions">
                  {button({ type: "move", to: selected }, "이동", true)}
                  {button({ type: "search" }, "주변 수색")}
                  {button({ type: "rest" }, "휴식")}
                  {button({ type: "aid" }, "응급처치")}
                </div>
              </div>
              <div className="action-feedback" role="status">
                <span className="orange">▥</span>
                {notice || game.log[0]}
                {busy && <span className="muted"> 처리 중…</span>}
              </div>
            </div>
            <aside className="sidebar">
              <section className="objective panel">
                <div className="section-title">
                  <span className="orange">◎</span> 현재 목표{" "}
                  <span className="pill">{game.found ? "귀환" : "수색"}</span>
                </div>
                <h2>{objective(game)}</h2>
                <p>
                  {game.found
                    ? "동행 중에는 이동 시간과 체력 소모가 증가합니다."
                    : "지도에서 연결된 지점을 선택하고 아래 이동 버튼을 누르세요."}
                </p>
                <div className="progress-steps">
                  <span className="done">접수</span>
                  <span className={!game.found ? "active" : "done"}>수색</span>
                  <span className={game.found ? "active" : ""}>구조</span>
                  <span>귀환</span>
                </div>
              </section>
              <section className="panel casualty">
                <div className="section-title">✚ 조난자 상태</div>
                <strong
                  className={game.found && game.health < 30 ? "orange" : ""}
                >
                  {game.found
                    ? `${Math.round(game.health)} · ${healthLabel(game.health)}`
                    : "위치 미확인"}
                </strong>
                <p>
                  {game.found
                    ? "조난자가 구조대와 동행합니다."
                    : `예상 위험: ${game.elapsed > 100 ? "높음" : "주의"} · 발견 전에는 상태를 정확히 알 수 없습니다.`}
                </p>
              </section>
              <section className="panel equipment-panel">
                <div className="section-title">
                  ▣ 휴대 장비{" "}
                  <span className="count">{game.equipment.length} / 3</span>
                </div>
                <div className="equipment-tags">
                  {game.equipment.map((id) => (
                    <span key={id}>
                      {equipment.find((e) => e.id === id)!.name}
                      {id === "kit"
                        ? ` · ${2 - game.kitUses}회`
                        : id === "drone"
                          ? ` · ${2 - game.droneUses}회`
                          : id === "blanket" && game.insulated
                            ? " · 보온 중"
                            : ""}
                    </span>
                  ))}
                </div>
                <div className="equipment-actions">
                  {game.equipment.includes("kit") &&
                    button({ type: "kit" }, "응급키트")}
                  {game.equipment.includes("blanket") &&
                    button({ type: "blanket" }, "방한포")}
                  {game.equipment.includes("drone") &&
                    button({ type: "drone" }, "드론 수색")}
                </div>
              </section>
              <section className="panel clues">
                <div className="section-title">
                  ⌕ 발견한 단서{" "}
                  <span className="count">
                    {game.clues.length.toString().padStart(2, "0")}
                  </span>
                </div>
                {game.clues.length ? (
                  game.clues.map((c, i) => (
                    <article key={i}>
                      <small>{point(c.location).name}</small>
                      <p>{c.text}</p>
                    </article>
                  ))
                ) : (
                  <div className="empty-clue">
                    <span>⌕</span>
                    <p>
                      산은 흔적을 남깁니다.
                      <br />
                      제2전망대에서 수색을 시작하세요.
                    </p>
                  </div>
                )}
              </section>
              <section className="panel radio">
                <div className="section-title">
                  ▥ 구조본부 무전 <span className="live">수신 중</span>
                </div>
                {game.log.slice(0, 3).map((msg, i) => (
                  <p key={`${i}-${msg}`}>
                    <span>{i === 0 ? "지금" : "기록"}</span>
                    {msg}
                  </p>
                ))}
              </section>
              <button
                className="text-button abandon"
                onClick={() => setAbortOpen(true)}
              >
                임무 중단
              </button>
            </aside>
          </div>
          {!foundOpen && game.pending && game.status === "active" && (
            <EncounterDialog game={game} act={act} busy={busy} />
          )}
          {foundOpen && game.status === "active" && (
            <div className="modal-backdrop">
              <section
                className="modal discovery"
                role="dialog"
                aria-modal="true"
                aria-labelledby="found-title"
              >
                <div className="rescue-cross">✚</div>
                <span className="eyebrow orange">생존 확인 · 구조 1팀</span>
                <h2 id="found-title">조난자를 발견했습니다!</h2>
                <p>
                  “본부, 여기는 구조 1팀. 실종자를 발견했습니다.
                  <br />
                  생존 확인, 응급처치를 시작하겠습니다.”
                </p>
                <div className="discovery-health">
                  생존 상태 <b>{Math.round(game.health)}</b>{" "}
                  {healthLabel(game.health)}
                </div>
                <button
                  className="primary wide"
                  onClick={() => setFoundOpen(false)}
                >
                  확인 · 응급처치 준비
                </button>
              </section>
            </div>
          )}
          {abortOpen && game.status === "active" && (
            <div className="modal-backdrop">
              <section
                className="modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="abort-title"
              >
                <h2 id="abort-title">이번 임무를 중단할까요?</h2>
                <p>
                  중단 결과가 기록됩니다. 휴식으로 체력을 회복하고 작전을 계속할
                  수도 있습니다.
                </p>
                <div className="button-row">
                  <button onClick={() => setAbortOpen(false)}>작전 계속</button>
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => {
                      setAbortOpen(false);
                      act({ type: "abandon" });
                    }}
                  >
                    임무 중단
                  </button>
                </div>
              </section>
            </div>
          )}
          {game.status !== "active" && (
            <div className="modal-backdrop">
              <section
                className="modal result"
                role="dialog"
                aria-modal="true"
                aria-labelledby="result-title"
              >
                <div className="rescue-cross">
                  {game.status === "success" ? "✚" : "△"}
                </div>
                <span className="eyebrow orange">
                  임무 종료 · {currentMission.name}
                </span>
                <h2 id="result-title">
                  {game.status === "success"
                    ? "전원 무사 귀환"
                    : "구조 임무 종료"}
                </h2>
                <p>{game.reason}</p>
                <small className="muted">
                  작전 시드 {game.seed} ·{" "}
                  {game.status === "failed"
                    ? "다음 출동에서는 단서를 먼저 확인하고 귀환 시간을 확보하세요."
                    : "기록이 이 브라우저에 저장됩니다."}
                </small>
                <div className="stars" aria-label={`${stars(game)}점 평가`}>
                  {"★".repeat(stars(game))}
                  <span>{"☆".repeat(3 - stars(game))}</span>
                </div>
                <div className="result-stats">
                  <div>
                    <small>소요 시간</small>
                    <strong>{game.elapsed}분</strong>
                  </div>
                  <div>
                    <small>조난자 상태</small>
                    <strong>
                      {game.found ? Math.round(game.health) : "미확인"}
                    </strong>
                  </div>
                  <div>
                    <small>남은 체력</small>
                    <strong>{game.stamina}</strong>
                  </div>
                  <div>
                    <small>발견한 단서</small>
                    <strong>{game.clues.length}개</strong>
                  </div>
                </div>
                {notice && <p role="status">{notice}</p>}
                <div className="button-row">
                  <button disabled={busy} className="primary" onClick={start}>
                    다시 도전하기
                  </button>
                  <button onClick={() => setScreen("menu")}>메인 메뉴</button>
                </div>
              </section>
            </div>
          )}
        </main>
      )}
      {(screen === "records" || screen === "help" || screen === "settings") && (
        <main className="page">
          <button className="text-button" onClick={() => setScreen("menu")}>
            메인 메뉴로
          </button>
          <span className="eyebrow orange">백운산 산악구조대</span>
          <h1>
            {screen === "records"
              ? "구조 기록"
              : screen === "help"
                ? "산에서, 함께 돌아오는 법"
                : "설정"}
          </h1>
          {screen === "records" && (
            <div className="record-summary">
              {([1, 2] as const).map((id) => {
                const stats = missionStats(records, id);
                return (
                  <section className="panel" key={id}>
                    <span className="eyebrow orange">
                      {stats.completed ? "완료한 임무" : "미완료 임무"}
                    </span>
                    <h2>{missions[id].name}</h2>
                    <p>
                      성공 {stats.wins}회 · 최고 평가 {stats.bestStars}별
                    </p>
                    <p>
                      최단 구조 {stats.bestTime ?? "—"}분 · 최고 생존 상태{" "}
                      {stats.bestHealth}
                    </p>
                  </section>
                );
              })}
            </div>
          )}
          {screen === "records" && (
            <section className="panel record-list">
              {records.length ? (
                records.map((r) => (
                  <article key={r.id}>
                    <div>
                      <strong>{r.success ? "구조 성공" : "임무 종료"}</strong>
                      <small>
                        {r.date} · 임무 {r.mission.toString().padStart(2, "0")}
                      </small>
                    </div>
                    <span>{r.time}분</span>
                    <span>생존 상태 {r.health}</span>
                    <span className="orange">{"★".repeat(r.stars)}</span>
                  </article>
                ))
              ) : (
                <p>아직 출동 기록이 없습니다. 첫 구조 임무를 시작해 보세요.</p>
              )}
            </section>
          )}
          {screen === "help" && (
            <div className="help-grid">
              {[
                [
                  "01",
                  "길을 선택하세요",
                  "현재 위치와 연결된 지점을 지도에서 선택한 뒤 이동하세요. 경로마다 시간과 체력 비용이 표시됩니다.",
                ],
                [
                  "02",
                  "흔적을 읽으세요",
                  "제2전망대에서 주변 수색을 실행하세요. 단서는 조난자가 향한 장소를 알려줍니다. 조난자 위치에 도착해서도 수색해야 발견합니다.",
                ],
                [
                  "03",
                  "안전하게 구조하세요",
                  "체력이 부족하면 휴식하세요. 응급처치는 생존 상태를 회복합니다. 시간은 행동할 때만 지나갑니다.",
                ],
                [
                  "04",
                  "함께 돌아오세요",
                  "발견만으로 끝나지 않습니다. 동행 중 이동 비용이 늘어납니다. 제한 시간 전에 구조본부에 도착해야 성공합니다.",
                ],
              ].map(([n, t, d]) => (
                <section className="panel" key={n}>
                  <span className="orange">{n}</span>
                  <h2>{t}</h2>
                  <p>{d}</p>
                </section>
              ))}
            </div>
          )}
          {screen === "settings" && (
            <section className="panel settings-panel">
              <label>
                <span>
                  <strong>효과음</strong>
                  <small>무전 수신과 행동 알림</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.sound}
                  onChange={(e) =>
                    setSettings({ ...settings, sound: e.target.checked })
                  }
                />
              </label>
              <label>
                <span>
                  <strong>소리 크기</strong>
                  <small>{Math.round(settings.volume * 100)}%</small>
                </span>
                <input
                  aria-label="소리 크기"
                  type="range"
                  min="0"
                  max="1"
                  step=".05"
                  value={settings.volume}
                  onChange={(e) =>
                    setSettings({ ...settings, volume: Number(e.target.value) })
                  }
                />
              </label>
              <label>
                <span>
                  <strong>애니메이션</strong>
                  <small>이동 및 지도 효과</small>
                </span>
                <input
                  type="checkbox"
                  checked={settings.motion}
                  onChange={(e) =>
                    setSettings({ ...settings, motion: e.target.checked })
                  }
                />
              </label>
              <p className="muted">
                설정과 구조 기록은 현재 브라우저에 저장됩니다.
              </p>
            </section>
          )}
        </main>
      )}
    </div>
  );
}
