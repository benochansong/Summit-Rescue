import { useMemo, useRef, useState } from "react";
import MountainMap from "./Map";
import { createGame } from "./game";
import {
  equipment,
  evaluationRules,
  missions,
  schedule,
  weatherAt,
  weatherInfo,
} from "./conditions";
import { point, regionFor } from "./regions";
import {
  crew,
  defaultFormation,
  supplies,
  validFormation,
  type Formation,
  type MemberId,
} from "./commandData";
import {
  activeOrder,
  commandEstimate,
  commandNames,
  commandReason,
  commandTransition,
  commandXp,
  createCommand,
  droneCost,
  grade,
  member,
  rescuedCount,
  safeCrew,
  type CommandAction,
  type CommandGame,
  type CommandKind,
  type Request,
} from "./command";
import { readCommandCareer, saveCommandRecord, type Settings } from "./storage";

export function FormationPanel({
  formation,
  setFormation,
  seed,
  setSeed,
}: {
  formation: Formation;
  setFormation: (f: Formation) => void;
  seed: string;
  setSeed: (s: string) => void;
}) {
  const career = readCommandCareer();
  return (
    <section className="formation panel">
      <div className="section-title">출동 편성 · 대원별 장비 3칸</div>
      <p>
        본부에서 함께 출발합니다. 같은 지점의 대원을 함께 선택하면 팀으로
        이동합니다. 키트·방한포·로프·랜턴은 각 2개, 드론은 1대입니다.
      </p>
      <div className="formation-grid">
        {crew.map((c, i) => (
          <article key={c.id} style={{ borderColor: c.color }}>
            <span className="eyebrow">
              대원 0{i + 1} · 전문 단계{" "}
              {Math.min(3, Math.floor(career.xp[c.id] / 200))}/3
            </span>
            <h2>{c.name}</h2>
            <strong>{c.role}</strong>
            <p>{c.effect}</p>
            <small>전문 경험치 {career.xp[c.id]} · 200마다 1단계</small>
            <div className="formation-items">
              {equipment.map((e) => {
                const checked = formation[c.id].includes(e.id),
                  next = {
                    ...formation,
                    [c.id]: checked
                      ? formation[c.id].filter((x) => x !== e.id)
                      : [...formation[c.id], e.id],
                  };
                const used = crew.reduce(
                  (n, m) => n + Number(formation[m.id].includes(e.id)),
                  0,
                );
                return (
                  <label key={e.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && !validFormation(next)}
                      onChange={() => setFormation(next)}
                    />
                    {e.icon} {e.name}
                    <small>
                      {used}/{supplies[e.id]}
                    </small>
                  </label>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      <label className="command-seed">
        작전 시드{" "}
        <input
          inputMode="numeric"
          type="number"
          min="0"
          step="1"
          placeholder="비워 두면 무작위"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
      </label>
      <p className="muted">
        드론: 배터리 100·왕복 비용 포함·악천후 자동 귀환. 헬기: 2회·준비
        30분·맑음/흐림·H 지점 이송. 진행 중 저장은 지원하지 않습니다.
      </p>
      <small>{evaluationRules[6]}</small>
    </section>
  );
}
const initialFormation = defaultFormation;
export { initialFormation };

export default function CommandScreen({
  initial,
  settings,
  onExit,
  onBeep,
}: {
  initial: CommandGame;
  settings: Settings;
  onExit: () => void;
  onBeep: () => void;
}) {
  const [g, setGame] = useState(initial),
    current = useRef(initial);
  const [selected, setSelected] = useState<MemberId[]>(["dohyun"]),
    [destination, setDestination] = useState("gate"),
    [subject, setSubject] = useState("north"),
    [kind, setKind] = useState<CommandKind>("move"),
    [notice, setNotice] = useState(""),
    [confirmRecall, setConfirmRecall] = useState(false);
  const lock = useRef(0);
  const baseline = useMemo(
    () => createGame(initial.seed, 6, [], initial.skills, initial.practice),
    [initial],
  );
  const leader = member(g, selected[0] ?? "dohyun"),
    weather = weatherAt(6, g.elapsed, g.seed),
    nextWeather = schedule(6, g.seed).find((w) => w.at > g.elapsed);
  const droneOperator = g.members.find((m) => m.equipment.includes("drone"));
  const projection = {
    ...baseline,
    position: leader.position,
    elapsed: g.elapsed,
    searched: g.searched,
    visited: [...new Set(g.members.flatMap((m) => m.trail))],
    trail: leader.trail,
    clues: g.clues,
    possible: [],
    health: 100,
  };
  const request: Request = {
      kind,
      members: selected,
      to: destination,
      subject,
    },
    reason = commandReason(g, request),
    estimate = commandEstimate(g, request);
  function dispatch(a: CommandAction) {
    // Suppress rapid duplicate clicks, including advances whose completed order enqueues a return leg.
    const now = performance.now();
    if (now < lock.current) return;
    lock.current = now + 180;
    const previous = current.current,
      next = commandTransition(previous, a, previous.revision);
    current.current = next;
    setGame(next);
    if (next !== previous) {
      onBeep();
      setNotice("");
      if (
        previous.status === "active" &&
        next.status !== "active" &&
        !saveCommandRecord(next)
      )
        setNotice(
          "브라우저 저장 공간을 사용할 수 없어 기록을 저장하지 못했습니다.",
        );
    }
  }
  const queue = (r: Request) => {
    const reason = commandReason(current.current, r);
    if (reason) {
      setNotice(reason);
      return;
    }
    dispatch({ type: "queue", request: r });
  };
  const clock = missions[6].start + g.elapsed;
  return (
    <main className="command-shell">
      <header className="command-top">
        <div>
          <span className="eyebrow orange">SUMMIT RESCUE / RESCUE COMMAND</span>
          <h1>
            두 개의 구조 신호 <small>{g.practice ? "훈련" : "작전 06"}</small>
          </h1>
        </div>
        <div className="command-clock">
          <strong>
            {String(Math.floor(clock / 60) % 24).padStart(2, "0")}:
            {String(clock % 60).padStart(2, "0")}
          </strong>
          <span>
            경과 {g.elapsed}분 · 수색 {Math.max(0, 360 - g.elapsed)}분
          </span>
        </div>
        <div>
          <strong>
            {weatherInfo[weather].icon} {weatherInfo[weather].name}
          </strong>
          <span>
            {nextWeather
              ? `${nextWeather.at - g.elapsed}분 뒤 ${weatherInfo[nextWeather.weather].name}`
              : "추가 기상 변화 없음"}
          </span>
        </div>
        <div>
          <strong>구조 {rescuedCount(g)} / 2</strong>
          <span>
            안전 대원 {g.members.filter((m) => m.position === "base").length} /
            3
          </span>
        </div>
      </header>
      <div className="command-layout">
        <details className="command-roster panel" open>
          <summary>구조대 · 함께 선택하면 팀 편성</summary>
          <div className="crew-cards">
            {g.members.map((m, i) => {
              const c = crew[i],
                o = activeOrder(g, m.id);
              return (
                <article
                  key={m.id}
                  className={
                    selected.includes(m.id) ? "crew-card selected" : "crew-card"
                  }
                  style={{ borderLeftColor: c.color }}
                >
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.includes(m.id)}
                      onChange={() =>
                        setSelected(
                          selected.includes(m.id)
                            ? selected.filter((id) => id !== m.id)
                            : [...selected, m.id],
                        )
                      }
                    />
                    <b>
                      {i + 1}. {c.name}
                    </b>
                    <small>{c.role}</small>
                  </label>
                  <button
                    className="text-button crew-focus"
                    onClick={() => {
                      setSelected([m.id]);
                      setDestination(m.position);
                    }}
                  >
                    ⌖ {point(m.position, 6).name}
                  </button>
                  <div className="crew-stamina">
                    <span>체력 {Math.floor(m.stamina + 0.00001)}</span>
                    <meter min="0" max="100" value={m.stamina} />
                  </div>
                  <p>
                    {o
                      ? `${commandNames[o.kind]} · ${Math.ceil(o.remaining)}분 남음`
                      : "명령 대기"}
                  </p>
                  <small>
                    {m.equipment
                      .map((id) => equipment.find((e) => e.id === id)!.name)
                      .join(" · ") || "장비 없음"}
                    {m.equipment.includes("kit")
                      ? ` (키트 ${2 - m.kitUses}회)`
                      : ""}
                  </small>
                  <details>
                    <summary>능력 · 현장 정보 {m.intel.length}</summary>
                    <p>{c.effect}</p>
                    {m.intel.slice(0, 3).map((s, j) => (
                      <p key={j}>{s}</p>
                    ))}
                  </details>
                </article>
              );
            })}
          </div>
          <p className="muted">
            ① 선택 → ② 지도·명령 지정 → ③ 예약 → ④ 작전 진행. 선택한 대원은 같은
            위치에 있어야 합니다.
          </p>
        </details>
        <section className="command-map">
          <MountainMap
            game={projection}
            selected={destination}
            onSelect={setDestination}
            busy={false}
            weather={weather}
            animate={settings.motion}
            command={g}
          />
          <div className="command-map-caption">
            <span>① 도현 · ② 서진 · ③ 민호</span>
            <span>H 착륙 가능 · + 발견 대상</span>
          </div>
        </section>
        <aside className="command-intel">
          <details className="panel" open>
            <summary>구조 대상 · 개별 상태</summary>
            {g.subjects.map((s) => (
              <button
                className={
                  "subject-card " + (subject === s.id ? "selected" : "")
                }
                key={s.id}
                onClick={() => setSubject(s.id)}
              >
                <strong>
                  {s.name}
                  <span>
                    {s.status === "rescued"
                      ? "인계 완료"
                      : s.health <= 0
                        ? "생존 소진"
                        : s.found
                          ? "발견"
                          : "미발견"}
                  </span>
                </strong>
                <small>
                  {s.found
                    ? `${point(s.position, 6).name} · 생존 ${Math.round(s.health)}`
                    : "현장 수색으로 위치와 상태 확인"}
                </small>
                {s.found && (
                  <>
                    <meter min="0" max="100" value={s.health} />
                    <small>
                      {s.treated ? "처치 완료" : "미처치"} ·{" "}
                      {s.insulated ? "보온 중" : "미보온"} ·{" "}
                      {s.carriers
                        .map((id) => crew.find((c) => c.id === id)?.name)
                        .join(",") || "동행 미편성"}
                    </small>
                  </>
                )}
              </button>
            ))}
            <small>
              북쪽: 전망대 흔적 / 계곡: 나무다리 신고
              <br />
              발견 → 처치 → 동행 편성 → 본부 귀환
            </small>
          </details>
          <details className="panel air-support" open>
            <summary>항공 지원</summary>
            <div>
              <strong>⌘ 드론 {g.drone.battery}%</strong>
              <span>
                {g.orders.some((o) => o.kind === "drone")
                  ? "비행 중 · 운용자 현장 대기"
                  : "지상 대기"}{" "}
                · 정찰 {g.drone.reports}/{g.drone.uses}
              </span>
            </div>
            <meter min="0" max="100" value={g.drone.battery} />
            <p>
              {droneOperator
                ? `선택 구역 왕복 배터리 ${droneCost(g, droneOperator.id, destination).battery} · ${point(droneOperator.position, 6).name} 출발. 귀환 예비분을 포함합니다.`
                : "드론을 소지한 대원이 없습니다."}
            </p>
            <div>
              <strong>H 헬기 {2 - g.heli.uses}회 남음</strong>
              <span>준비·도착 30분 · 맑음/흐림</span>
            </div>
            <p>
              이송은 발견·처치 후 H 지점에서 요청. 선택한 현장 대원도 함께
              이송합니다. 도착 시 조건을 다시 확인합니다.
            </p>
            <small>아래 명령 메뉴에서 정찰·충전·이송을 선택하세요.</small>
          </details>
          <details className="panel radio-panel" open>
            <summary>구조본부 무전</summary>
            <div
              className="command-radio"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {g.log.slice(0, 12).map((line, i) => (
                <p
                  key={`${g.log.length - i}-${line}`}
                  className={line.includes("긴급") ? "urgent" : ""}
                >
                  {line}
                </p>
              ))}
            </div>
          </details>
        </aside>
      </div>
      {g.status === "active" ? (
        <footer className="command-controls">
          <div className="command-pick">
            <label>
              지시할 구역
              <select
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              >
                {regionFor(6).points.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              명령
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as CommandKind)}
              >
                {Object.entries(commandNames).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              대상
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                {g.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="primary"
              disabled={!!reason}
              onClick={() => queue(request)}
            >
              명령 예약
            </button>
            <p className={reason ? "muted" : "orange"}>
              {reason ||
                `${estimate?.total}분 · ${selected.map((id) => `${crew.find((c) => c.id === id)!.name} 체력 −${estimate?.energy[id] ?? 0}`).join(" / ")}${kind === "move" || kind === "return" ? " (우천 ×1.3)" : ""}`}
            </p>
          </div>
          <div className="order-queue" aria-label="예약된 명령">
            {g.orders.length ? (
              g.orders.map((o) => (
                <div key={o.id}>
                  <strong>
                    {o.members
                      .map((id) => crew.find((c) => c.id === id)!.name)
                      .join("·")}
                  </strong>
                  <span>
                    {commandNames[o.kind]} {o.to ? point(o.to, 6).name : ""} ·{" "}
                    {Math.ceil(o.remaining)}분{o.recalled ? " · 귀환 중" : ""}
                  </span>
                  <progress value={o.total - o.remaining} max={o.total} />
                  {!o.started && (
                    <button
                      aria-label={`${commandNames[o.kind]} 예약 취소`}
                      onClick={() => dispatch({ type: "cancel", id: o.id })}
                    >
                      취소
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p>예약된 명령이 없습니다. 대원마다 하나씩 예약할 수 있습니다.</p>
            )}
          </div>
          <div className="command-run">
            <button
              className="primary"
              disabled={g.paused || !g.orders.length}
              onClick={() => dispatch({ type: "advance" })}
            >
              ▶ 작전 진행
            </button>
            <button onClick={() => dispatch({ type: "pause" })}>
              {g.paused ? "작전 재개" : "작전 일시정지"}
            </button>
            <span>
              {g.paused
                ? "일시정지 · 시간은 흐르지 않습니다."
                : "가장 먼저 끝나는 명령까지 진행합니다."}
            </span>
            <button
              className="text-button"
              onClick={() => setConfirmRecall(!confirmRecall)}
            >
              수색 종료 / 철수
            </button>
            {safeCrew(g) && (
              <button onClick={() => dispatch({ type: "finish" })}>
                작전 종료
              </button>
            )}
          </div>
          {confirmRecall && (
            <div className="recall-confirm">
              <p>
                신규 수색을 중단하고 전원 귀환한 뒤 결과를 평가합니다. 각 팀에
                본부 복귀 명령을 내려 주세요.
              </p>
              <button
                onClick={() => {
                  dispatch({ type: "recall" });
                  setConfirmRecall(false);
                }}
              >
                철수 결정
              </button>
              <button onClick={() => setConfirmRecall(false)}>계속 수색</button>
            </div>
          )}
          <p role="status">{notice}</p>
        </footer>
      ) : (
        <section
          className="command-result panel"
          aria-labelledby="command-result-title"
        >
          <span className="eyebrow orange">
            작전 종료 · {g.practice ? "훈련 기록 미저장" : "구조 보고서"}
          </span>
          <h2 id="command-result-title">
            {grade(g)} 등급 ·{" "}
            {g.status === "success"
              ? "완전 성공"
              : g.status === "partial"
                ? "부분 성공"
                : "목표 미달성"}
          </h2>
          <p>{g.reason}</p>
          <div className="command-result-grid">
            {g.subjects.map((s) => (
              <div key={s.id}>
                <strong>{s.name}</strong>
                <p>
                  {s.status === "rescued" ? "인계 완료" : "미구조"} · 최종 생존{" "}
                  {Math.round(s.health)}
                </p>
              </div>
            ))}
            <div>
              <strong>전원 안전 귀환 · {g.elapsed}분</strong>
              <p>
                경험치 +{commandXp(g)} · 단서 {g.clues.length}건
              </p>
            </div>
            <div>
              <strong>항공 지원</strong>
              <p>
                드론 유효 보고 {g.drone.reports}/{g.drone.uses} · 헬기 이송{" "}
                {g.heli.rescues}, 정찰 {g.heli.reports}/{g.heli.uses}
              </p>
            </div>
          </div>
          <details>
            <summary>수색·경로 보고</summary>
            {g.members.map((m) => (
              <p key={m.id}>
                {crew.find((c) => c.id === m.id)!.name}:{" "}
                {m.trail.map((id) => point(id, 6).name).join(" → ")}
              </p>
            ))}
            <p>{evaluationRules[6]}</p>
          </details>
          <p role="status">{notice}</p>
          <button
            className="primary"
            onClick={() => {
              const next = createCommand(
                g.seed,
                Object.fromEntries(
                  g.members.map((m) => [m.id, m.equipment]),
                ) as Formation,
                g.skills,
                g.practice,
                Object.fromEntries(g.members.map((m) => [m.id, m.xp])),
              );
              current.current = next;
              setGame(next);
              setSelected(["dohyun"]);
              setDestination("gate");
              setSubject("north");
              setKind("move");
              setConfirmRecall(false);
              setNotice("");
            }}
          >
            같은 조건으로 다시 도전
          </button>
          <button onClick={onExit}>임무 선택으로</button>
        </section>
      )}
    </main>
  );
}
