import HelicopterPanel from "./HelicopterPanel";
import HelicopterScene from "./HelicopterScene";
import { airActive, airEta, skyLanding, airNames } from "./helicopter";
import CliffRescue from "./CliffRescue";
import { useEffect, useRef, useState } from "react";
import MountainMap from "./Map";
import RescueActionPanel, { RescueIllustration } from "./RescueAction";
import {
  disasterProfiles,
  disasterSchedule,
  disasterTimes,
  disasterVisibility,
  landingSites,
  scenes,
} from "./disasterData";
import {
  allRoutesSafe,
  createDisaster,
  disasterCost,
  disasterDisabled,
  disasterGoal,
  disasterRating,
  disasterTransition,
  disasterWeather,
  disasterXp,
  edgeKey,
  edgeState,
  helicopterReason,
  safeRoute,
  type DisasterAction,
  type DisasterGame,
} from "./disaster";
import { adjacent, point, regionFor } from "./regions";
import { equipment, weatherInfo, missions } from "./conditions";
import { personalHighlights, saveRecord, type Settings } from "./storage";
import { RescueAudio } from "./audio";
import type { Difficulty } from "./experience";
export function DisasterSetup({
  value,
  onChange,
  mission = 7,
}: {
  mission?: 7 | 8 | 9;
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}) {
  return (
    <section className="panel disaster-setup">
      <span className="eyebrow orange">
        신규 독립 작전 · 기존 임무를 완료하지 않아도 출동 가능
      </span>
      <h2>{missions[mission].subtitle}</h2>
      <div className="difficulty-choices">
        {(Object.keys(disasterProfiles) as Difficulty[]).map((id) => (
          <label key={id} className={value === id ? "chosen" : ""}>
            <input
              type="radio"
              name="disaster-difficulty"
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <strong>{disasterProfiles[id].name}</strong>
            <small>
              {disasterProfiles[id].limit}분 ·{" "}
              {mission === 9
                ? "항공 지원 1회 · 지상 귀환 필수"
                : `로프 안전 폭 ${disasterProfiles[id].window}%`}
            </small>
            <p>
              {id === "easy"
                ? "긴 사전 경고와 적은 체력 소모"
                : id === "normal"
                  ? "낙석·급류 대응과 현장 구조의 균형"
                  : "빠른 재난, 좁은 안전 구간, 귀환 계획 필요"}
            </p>
          </label>
        ))}
      </div>
      <p>
        {mission === 9
          ? "기상·위치·처치 상태를 확인해 항공 지원 또는 지상 귀환을 선택합니다. 조난자 항공 이송 후에도 구조팀은 본부로 돌아와야 합니다."
          : "현장 액션은 마우스·키보드·정밀 조작·자동 지원으로 진행합니다. 최종 구조를 확정할 때 비용이 적용됩니다."}{" "}
        연출과 판단 중에는 게임 시계가 멈춥니다.
      </p>
    </section>
  );
}
export default function DisasterScreen({
  initial,
  settings,
  onSettings,
  onExit,
}: {
  initial: DisasterGame;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onExit: () => void;
}) {
  const [game, setGame] = useState<DisasterGame>(() =>
      settings.skipDialogue ? { ...initial, scenes: [] } : initial,
    ),
    [selected, setSelected] = useState("gate"),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [highlights, setHighlights] = useState<string[]>([]),
    [aborting, setAborting] = useState(false);
  const lock = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    sound = useRef<RescueAudio | null>(null),
    dialogRef = useRef<HTMLDivElement>(null);
  const weather = disasterWeather(game),
    profile = disasterProfiles[game.difficulty],
    forecast = disasterSchedule(game.difficulty, game.seed, game.mission).find(
      (p) => p.at > game.elapsed,
    ),
    times = disasterTimes(game.difficulty, game.seed);
  const scene = game.scenes[0],
    modal =
      !!scene ||
      !!game.cliff?.visible ||
      !!game.action ||
      game.status !== "active" ||
      aborting;
  useEffect(() => {
    sound.current ??= new RescueAudio();
    sound.current.configure(settings);
    sound.current.rotor(
      game.air && airActive(game.air) && game.status === "active"
        ? ["approach", "hoisting"].includes(game.air.status)
          ? 1
          : game.air.status === "enroute"
            ? 0.3
            : game.air.status === "transporting"
              ? 0.15
              : 0
        : 0,
    );
    sound.current.scene(
      weather,
      game.found ? 4 : game.events.includes("rock") ? 3 : 1,
      game.status === "active",
      !!scene,
    );
  }, [
    settings,
    weather,
    scene,
    game.status,
    game.found,
    game.events,
    game.air,
  ]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) sound.current?.suspend();
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", hide);
      sound.current?.close();
    };
  }, []);
  useEffect(() => {
    if (!modal) return;
    const el = dialogRef.current,
      previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        el?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      );
    focusables()[0]?.focus({ preventScroll: true });
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables(),
        first = list[0],
        last = list.at(-1);
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !el?.contains(document.activeElement))
      ) {
        e.preventDefault();
        last?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !el?.contains(document.activeElement))
      ) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus({ preventScroll: true });
    };
  }, [modal, scene, game.action?.kind, game.status, aborting]);
  function act(a: DisasterAction) {
    if (lock.current) return;
    const reason = disasterDisabled(game, a);
    if (reason) {
      setNotice(reason);
      return;
    }
    const raw = disasterTransition(game, a, game.revision);
    if (raw === game) return;
    const next = settings.skipDialogue ? { ...raw, scenes: [] } : raw;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setGame(next);
    const event = next.scenes[0];
    const cliffMiss = a.type === "cliff" && next.cliff?.feedback === "miss";
    sound.current?.play(
      cliffMiss
        ? "risk"
        : a.type === "cliff"
          ? "rope"
          : next.status === "success"
            ? "success"
            : next.status === "failed"
              ? "failure"
              : event === "rock"
                ? "rock"
                : event === "flood"
                  ? "flood"
                  : event === "storm"
                    ? "storm"
                    : event === "found"
                      ? "found"
                      : a.type === "helicopter"
                        ? "helicopter"
                        : a.type === "move"
                          ? "move"
                          : a.type === "rope"
                            ? "rope"
                            : a.type === "carry"
                              ? "carry"
                              : "radio",
    );
    if (next.status !== "active") {
      setHighlights(
        personalHighlights(next, disasterRating(next), next.difficulty),
      );
      if (
        !saveRecord(next, next.mission, {
          bonus: next.cliffResult?.bonus ?? 0,
          air: next.air
            ? {
                used: next.air.used,
                status: next.air.status,
                crewSafe: next.position === "base",
                method: next.air.onboard ? "air" : "ground",
              }
            : undefined,
          difficulty: next.difficulty,
          rating: disasterRating(next),
        })
      )
        setNotice(
          "기록을 저장하지 못했습니다. 브라우저 저장 공간과 설정을 확인하세요.",
        );
    }
    timer.current = setTimeout(
      () => {
        lock.current = false;
        setBusy(false);
      },
      a.type === "rope" || a.type === "carry"
        ? 400
        : settings.motion
          ? 650
          : 250,
    );
  }
  function retry() {
    clearTimeout(timer.current);
    lock.current = false;
    setBusy(false);
    const next = createDisaster(
      initial.seed,
      initial.difficulty,
      initial.equipment,
      initial.skills,
      initial.practice,
      initial.mission as 7 | 8 | 9,
    );
    setGame(settings.skipDialogue ? { ...next, scenes: [] } : next);
    setSelected("gate");
    setHighlights([]);
    setNotice("");
    setAborting(false);
  }
  const control = (a: DisasterAction, label: string, primary = false) => {
    const c = disasterCost(game, a),
      reason = disasterDisabled(game, a);
    return (
      <button
        className={primary ? "primary" : ""}
        disabled={busy || !!reason}
        title={reason}
        onClick={() => act(a)}
      >
        <strong>{label}</strong>
        <small>
          {c.time}분 · 체력 {c.energy < 0 ? "+" : "−"}
          {Math.abs(c.energy)}
        </small>
      </button>
    );
  };
  const route = safeRoute(game, game.position, selected),
    goalRoute = safeRoute(
      game,
      game.position,
      game.found
        ? "base"
        : game.possible.length === 1
          ? game.possible[0]
          : "lookout",
    );
  const blocked =
    adjacent(game.position, 7).includes(selected) &&
    ["blocked", "restricted"].includes(
      edgeState(game, game.position, selected),
    );
  const objective = disasterGoal(game),
    clock = missions[game.mission].start + game.elapsed;
  return (
    <div className={`app disaster-app ${settings.motion ? "" : "motion-off"}`}>
      <header className="brandbar">
        <button
          className="brand"
          onClick={() =>
            game.status === "active" ? setAborting(true) : onExit()
          }
        >
          <span>
            <b>SUMMIT RESCUE</b>
            <small>재난 대응 · 현장 구조</small>
          </span>
        </button>
        <div className="disaster-settings">
          <button
            aria-label={settings.sound ? "소리 끄기" : "소리 켜기"}
            onClick={() => onSettings({ ...settings, sound: !settings.sound })}
          >
            {settings.sound ? "소리 켜짐" : "음소거"}
          </button>
          <button
            aria-pressed={!settings.motion}
            onClick={() =>
              onSettings({ ...settings, motion: !settings.motion })
            }
          >
            {settings.motion ? "효과 줄이기" : "효과 줄임"}
          </button>
        </div>
      </header>
      <main className="disaster-operation">
        <div className="disaster-heading">
          <div>
            <span className="eyebrow orange">
              작전 {String(game.mission).padStart(2, "0")} · {profile.name}{" "}
              {game.practice ? "· 훈련" : ""}
            </span>
            <h1>{missions[game.mission].name}</h1>
          </div>
          <div className="disaster-hud">
            <span>
              현지 시각
              <b>
                {String(Math.floor(clock / 60)).padStart(2, "0")}:
                {String(clock % 60).padStart(2, "0")}
              </b>
            </span>
            <span>
              남은 시간<b>{Math.max(0, profile.limit - game.elapsed)}분</b>
            </span>
            <span>
              대원 체력<b>{game.stamina}</b>
            </span>
            <span>
              조난자 상태
              <b>{game.found ? Math.round(game.health) : "미확인"}</b>
            </span>
          </div>
        </div>
        <div className="disaster-forecast">
          <strong>
            {weatherInfo[weather].icon} {weatherInfo[weather].name}
          </strong>
          <span>
            {weatherInfo[weather].detail}
            {!weatherInfo[weather].detail.includes(
              disasterVisibility[weather],
            ) && ` · ${disasterVisibility[weather]}`}
          </span>
          <span>
            {forecast
              ? `${forecast.at - game.elapsed}분 후 ${weatherInfo[forecast.weather].name}`
              : "추가 기상 변화 없음"}
          </span>
          <small>결정 중에는 시간이 흐르지 않습니다.</small>
        </div>
        <div className="disaster-objective">
          <span className="eyebrow orange">현재 목표</span>
          <strong>{objective}</strong>
          <span>
            {goalRoute?.length
              ? "연결 경로: " +
                goalRoute.map((id) => point(id, 7).name).join(" → ")
              : "현재 위치에서 현장 행동을 확인하세요."}
          </span>
        </div>
        <div className="disaster-layout">
          <section className="disaster-map-column">
            <MountainMap
              game={game}
              selected={selected}
              onSelect={setSelected}
              busy={busy || modal}
              weather={weather}
              animate={settings.motion}
              tactical={{
                states: Object.fromEntries(
                  regionFor(7).edges.map((e) => [
                    edgeKey(e.a, e.b),
                    edgeState(game, e.a, e.b),
                  ]),
                ),
                route: route ?? [],
                cost: (to) => disasterCost(game, { type: "move", to }),
                landingPoints: game.mission === 9 ? skyLanding : undefined,
                helicopter:
                  game.air && airActive(game.air)
                    ? {
                        target: game.air.target,
                        progress: Math.max(
                          0.05,
                          Math.min(1, 1 - airEta(game.air) / 45),
                        ),
                      }
                    : game.helicopter
                      ? {
                          target: game.helicopter.origin,
                          progress: Math.max(
                            0,
                            1 - (game.helicopter.at - game.elapsed) / 25,
                          ),
                        }
                      : undefined,
              }}
            />
            <div className="disaster-movement panel">
              <label>
                이동 지점
                <select
                  aria-label="재난 작전 이동 지점"
                  disabled={busy || modal}
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {regionFor(7).points.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.id === game.position
                        ? " (현재)"
                        : adjacent(game.position, 7).includes(p.id)
                          ? ` (${edgeState(game, game.position, p.id) === "open" ? "연결" : edgeState(game, game.position, p.id) === "warning" ? "주의" : "통제"})`
                          : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="disaster-controls">
                {control({ type: "move", to: selected }, "이동", true)}
                {control({ type: "search" }, "현장 수색")}
                {control({ type: "rest" }, "휴식")}
              </div>
              <p className="movement-reason">
                {disasterDisabled(game, { type: "move", to: selected }) ||
                  `${point(selected, 7).name} 이동 비용은 출발 시 확정됩니다.`}
              </p>
              {blocked && (
                <div className="route-response">
                  <strong>통제 경로 대응</strong>
                  <p>
                    {route?.length
                      ? "우회: " +
                        route.map((id) => point(id, 7).name).join(" → ")
                      : "같은 위치입니다."}
                  </p>
                  <div className="disaster-controls">
                    <button
                      disabled={busy || modal || !route?.length}
                      onClick={() => setSelected(route![0])}
                    >
                      우회 첫 구간 선택<small>선택만 변경 · 0분</small>
                    </button>
                    {control(
                      { type: "mitigate", to: selected, method: "rope" },
                      "로프 확보",
                    )}
                    {control(
                      { type: "mitigate", to: selected, method: "wait" },
                      "안정 대기",
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
          <aside className="disaster-sidebar">
            <section className="panel hazard-status">
              <span className="eyebrow orange">현장 통제</span>
              <h2>산의 변화를 읽으세요</h2>
              <p>
                낙석:{" "}
                {game.events.includes("rock")
                  ? edgeState(game, "fork", "cave") === "blocked"
                    ? "삼거리–바위 그늘 차단"
                    : "삼거리–바위 그늘 통행 확보"
                  : `+${times.rock}분 예상 · 사전 경고 +${times.rockWarning}분`}
              </p>
              <p>
                급류:{" "}
                {game.events.includes("flood")
                  ? `${
                      [
                        ["fork", "valley"],
                        ["bridge", "valley"],
                      ].filter(
                        ([a, b]) => edgeState(game, a, b) === "restricted",
                      ).length
                    }곳 통제 · +${times.flood + 45}분부터 주의 통행`
                  : `+${times.flood}분 예상 · 사전 경고 +${times.floodWarning}분`}
              </p>
              <small>
                {allRoutesSafe(game)
                  ? "본부와 모든 구역의 우회 연결 유지"
                  : "현재 경로 통제를 확인하세요"}
              </small>
            </section>
            <section className="panel field-actions">
              <span className="eyebrow orange">
                구조 1팀 ·{" "}
                {game.mission === 9
                  ? "박도현"
                  : game.mission === 8
                    ? "한서윤"
                    : "이재하"}{" "}
                씨 수색
              </span>
              <h2>
                {game.found
                  ? "발견 후에도, 함께 귀환까지"
                  : "남겨진 무전을 따라"}
              </h2>
              <p>
                {game.found
                  ? game.mission === 9
                    ? `현장 접근 완료 → 처치 ${game.treated ? "완료" : "대기"} → ${game.air?.onboard ? "항공 탑승 · 구조팀 귀환 필요" : "지상 동행 또는 항공 지원"}`
                    : `로프 접근 ${game.secured ? "완료" : "대기"} → 처치 ${game.treated ? "완료" : "대기"} → 이송 ${game.carried ? "완료" : "대기"}`
                  : `남은 후보: ${game.possible.map((id) => point(id, 7).name).join(" · ")}`}
              </p>
              <div className="field-buttons">
                {control({ type: "start", kind: "signal" }, "신호 탐지")}
                {game.mission === 9
                  ? null
                  : game.mission === 8
                    ? game.cliff &&
                      control(
                        { type: "cliff", command: { type: "resume" } },
                        "절벽 구조 계속",
                      )
                    : control({ type: "start", kind: "rope" }, "로프 구조")}
                {control({ type: "aid" }, "응급처치")}
                {game.mission === 7 &&
                  control({ type: "start", kind: "carry" }, "부상자 이송")}
                {game.equipment.includes("kit") &&
                  control({ type: "kit" }, `응급키트 ${2 - game.kitUses}회`)}
                {game.equipment.includes("blanket") &&
                  control({ type: "blanket" }, "방한포")}
              </div>
              <small>현장 액션은 조작 완료 시 비용 반영. 자동 지원 가능.</small>
            </section>
            {game.air ? (
              <HelicopterPanel game={game} act={act} busy={busy || modal} />
            ) : (
              <section className="panel air-panel">
                <span className="eyebrow orange">
                  항공 지원 {game.heliUses} / 2
                </span>
                <h2>하늘이 열리는 시간</h2>
                <p>
                  {helicopterReason(game) ||
                    "출동 가능 · 요청 5분 + 접근 25분 · 도착 시 기상 재확인"}
                </p>
                {game.helicopter && (
                  <progress
                    aria-label="헬기 접근"
                    max="25"
                    value={25 - (game.helicopter.at - game.elapsed)}
                  />
                )}
                <small>
                  H: {landingSites.map((id) => point(id, 7).name).join(" · ")}
                </small>
                {control({ type: "helicopter" }, "헬기 구조 요청")}
                {control({ type: "wait" }, "현장 대기")}
              </section>
            )}
            <section className="panel disaster-radio">
              <span className="eyebrow orange">구조본부 무전</span>
              <div role="status">{notice || game.log[0]}</div>
              <details>
                <summary>단서 및 무전 기록</summary>
                {[...game.clues].reverse().map((c, i) => (
                  <p key={"c" + i}>{c.text}</p>
                ))}
                {game.log.slice(1).map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </details>
            </section>
            <button
              className="text-button"
              disabled={busy || modal}
              onClick={() => setAborting(true)}
            >
              임무 중단
            </button>
          </aside>
        </div>
      </main>
      {modal && (
        <div className="modal-backdrop" ref={dialogRef}>
          {game.status !== "active" ? (
            <section
              className="modal disaster-result"
              role="dialog"
              aria-modal="true"
              aria-labelledby="disaster-result-title"
            >
              <span className="eyebrow orange">본부 보고 · 작전 종료</span>
              <h2 id="disaster-result-title">
                {game.status === "success"
                  ? "모두 살아 돌아왔습니다"
                  : "구조 작전 종료"}
              </h2>
              {game.status === "success" && (
                <RescueIllustration
                  scene={
                    game.evacuated || game.air?.status === "complete"
                      ? "helicopter"
                      : "success"
                  }
                />
              )}
              <p>{game.reason}</p>
              {game.status === "success" ? (
                <blockquote>
                  “그 목소리를 듣고 버틸 수 있었어요.”{" "}
                  {game.mission === 9
                    ? "도현"
                    : game.mission === 8
                      ? "서윤"
                      : "재하"}{" "}
                  씨가 구조대에 고개를 숙입니다.
                </blockquote>
              ) : (
                <p className="retry-tip">
                  {game.health <= 0
                    ? "신호로 수색을 줄이고, 접근 후 처치·키트·보온을 활용하세요."
                    : "차단 경로의 우회 비용과 귀환 체력을 먼저 확보하세요. 자동 구조도 안전한 선택입니다."}
                </p>
              )}
              <div className="record-highlights">
                {highlights.map((s) => (
                  <strong key={s}>{s}</strong>
                ))}
              </div>
              <div className="result-stats">
                <div>
                  <small>소요 시간</small>
                  <strong>{game.elapsed}분</strong>
                </div>
                <div>
                  <small>생존 상태 / 체력</small>
                  <strong>
                    {game.found ? Math.round(game.health) : "미확인"} /{" "}
                    {game.stamina}
                  </strong>
                </div>
                <div>
                  <small>평가</small>
                  <strong>{"★".repeat(disasterRating(game))}</strong>
                </div>
                <div>
                  <small>경험치</small>
                  <strong>+{disasterXp(game)}</strong>
                </div>
              </div>
              {game.air && (
                <p>
                  구조 방식:{" "}
                  {game.air.onboard
                    ? "항공 이송 + 구조팀 지상 귀환"
                    : "지상 동행"}{" "}
                  · 출동 {game.air.used}/1회 · 헬기 {airNames[game.air.status]}{" "}
                  · 조난자{" "}
                  {game.air.status === "complete"
                    ? "안전 인계"
                    : game.air.onboard
                      ? "항공 이송 중"
                      : game.status === "success"
                        ? "지상 안전 귀환"
                        : "현장 대기"}{" "}
                  · 구조팀 {game.position === "base" ? "본부 복귀" : "미복귀"}
                </p>
              )}
              {game.cliffResult && (
                <p>
                  절벽 액션: {game.cliffResult.grade} · 실수{" "}
                  {game.cliffResult.mistakes}회 · {game.cliffResult.time}분 /
                  체력 {game.cliffResult.energy} · 안전 귀환 보너스{" "}
                  {game.status === "success" ? game.cliffResult.bonus : 0}
                </p>
              )}
              <p>
                발생 재난:{" "}
                {game.events
                  .filter((x) => x === "rock" || x === "flood")
                  .map((x) => (x === "rock" ? "낙석" : "급류"))
                  .join(" · ") || "없음"}{" "}
                · 통제 우회 선택 {game.detours} · 주의·확보 경로 통과{" "}
                {game.crossings}
              </p>
              <p>
                기상 대응:{" "}
                {game.insulated ? "방한포로 노출 완화" : "보온 장비 미적용"} ·{" "}
                {game.evacuated
                  ? "기상 확인 후 항공 인계"
                  : game.heliUses
                    ? "항공 요청 후 지상 상황 대응"
                    : "지상 작전"}
                . 실제 이동별 날씨와 비용은 아래 판단 기록에서 확인하세요.
              </p>
              <p>
                장비:{" "}
                {game.equipment
                  .map((id) => equipment.find((e) => e.id === id)!.name)
                  .join(" · ") || "없음"}{" "}
                · 시드 {game.seed}
              </p>
              <details>
                <summary>
                  주요 판단과 구조 작업 {game.routeReport.length}건
                </summary>
                {game.routeReport.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </details>
              {notice && <p role="status">{notice}</p>}
              <p className="muted">
                {game.practice
                  ? "훈련 · 기록과 보상 미저장"
                  : "같은 난이도의 개인 기록 비교 · 완료 기록은 현재 브라우저에 저장"}
              </p>
              <div className="button-row">
                <button className="primary" disabled={busy} onClick={retry}>
                  같은 시드 재도전
                </button>
                <button onClick={onExit}>임무 선택</button>
              </div>
            </section>
          ) : aborting ? (
            <section
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="disaster-abort"
            >
              <h2 id="disaster-abort">구조대를 철수할까요?</h2>
              <p>
                중단 사유를 기록합니다. 진행 중에는 휴식과 자동 구조도 선택할 수
                있습니다.
              </p>
              <div className="button-row">
                <button onClick={() => setAborting(false)}>작전 계속</button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setAborting(false);
                    act({ type: "abandon" });
                  }}
                >
                  철수 확정
                </button>
              </div>
            </section>
          ) : scene?.startsWith("air-") ? (
            <HelicopterScene
              scene={scene}
              busy={busy}
              onContinue={() => act({ type: "ack" })}
            />
          ) : scene ? (
            <section
              className={`modal cinematic cinematic-${scene}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="scene-title"
            >
              <span className="eyebrow orange">
                {game.mission === 9 && scene === "dispatch"
                  ? "16:20 · 고산 능선 구조 신고"
                  : game.mission === 8 && scene === "dispatch"
                    ? "15:30 · 백운산 동쪽 암릉"
                    : scenes[scene].eyebrow}
              </span>
              <h2 id="scene-title">{scenes[scene].title}</h2>
              <RescueIllustration scene={scene} />
              <p>
                {game.mission === 9 && scene === "dispatch"
                  ? missions[9].description
                  : game.mission === 9 && scene === "found"
                    ? "도현 씨를 발견했습니다. 기본 응급처치 후 지상 동행 또는 H 지점 항공 지원을 선택하세요. 항공 이송 후에도 구조팀 귀환이 필요합니다."
                    : game.mission === 8 && scene === "dispatch"
                      ? missions[8].description
                      : game.mission === 8 && scene === "found"
                        ? "절벽 아래 서윤 씨를 발견했습니다. 장비를 확인하고 로프를 안정시킨 뒤 하강하세요. 안전 인양 전까지 이동할 수 없습니다."
                        : game.mission === 8 && scene === "secured"
                          ? "서윤 씨를 안전 지형으로 인양했습니다. 기본 처치 후 본부로 함께 귀환하세요."
                          : scenes[scene].text}
              </p>
              <small>
                현지 시각은 멈춰 있습니다. 지도를 확인한 뒤 결정하세요.
              </small>
              <button
                className="primary wide"
                disabled={busy}
                onClick={() => act({ type: "ack" })}
              >
                상황 확인 · 연출 건너뛰기
              </button>
            </section>
          ) : game.cliff?.visible ? (
            <CliffRescue
              game={game}
              command={(command) => act({ type: "cliff", command })}
              busy={busy}
              motion={settings.motion}
              onSound={() =>
                onSettings({ ...settings, sound: !settings.sound })
              }
            />
          ) : game.action ? (
            <RescueActionPanel
              key={game.action.kind}
              game={game}
              act={act}
              busy={busy}
              motion={settings.motion}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
