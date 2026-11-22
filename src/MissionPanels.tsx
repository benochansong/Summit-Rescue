import {
  difficulties,
  gameForecast,
  gameSchedule,
  type ExperienceOptions,
  type Difficulty,
} from "./experience";
import { disasterSchedule } from "./disasterData";
import { useState } from "react";
import { regionFor } from "./regions";
import {
  isUnlocked,
  missionStats,
  readRecords,
  readCareer,
  trainSkill,
} from "./storage";
import { skillInfo, upgradeCost } from "./progression";
import {
  equipment,
  missionIds,
  recommendations,
  evaluationRules,
  missions,
  schedule,
  weatherInfo,
} from "./conditions";
import type { Equipment, MissionId } from "./conditions";
import { choiceDisabled, choicesFor, encounterInfo } from "./game";
import type { Action, Game } from "./game";

export function MissionSelect({
  onSelect,
  onBack,
}: {
  onSelect: (id: MissionId, practice: boolean) => void;
  onBack: () => void;
}) {
  const [practice, setPractice] = useState(false),
    [career, setCareer] = useState(readCareer),
    [notice, setNotice] = useState("");
  const records = readRecords();
  return (
    <main className="page mission-page">
      <button className="text-button" onClick={onBack}>
        메인 메뉴로
      </button>
      <span className="eyebrow orange">산마다 다른 판단, 같은 목표</span>
      <h1>산악 구조 작전</h1>
      <p className="page-lead">
        안개 속에서는 정보를, 암릉에서는 경로를, 밤의 숲에서는 불빛을 읽으세요.
      </p>
      <section className="career-panel panel">
        <div>
          <h2>구조대 훈련</h2>
          <strong className="orange">보유 경험치 {career.xp}</strong>
          <p>
            임무 1~5·7~10 성공 시 100 + 별당 25 경험치. 임무 6은 S/A/B등급에
            200/150/75. 각 능력은 최대 3단계입니다.
          </p>
        </div>
        <div className="skill-cards">
          {skillInfo.map((s) => (
            <div key={s.id}>
              <strong>
                {s.name} <span>{career.skills[s.id]} / 3</span>
              </strong>
              <p>{s.effect}</p>
              <button
                disabled={
                  career.skills[s.id] >= 3 ||
                  career.xp < upgradeCost(career.skills[s.id])
                }
                onClick={() => {
                  if (trainSkill(s.id)) {
                    setCareer(readCareer());
                    setNotice(s.name + " 훈련 완료");
                  } else
                    setNotice(
                      "훈련을 저장하지 못했습니다. 경험치와 브라우저 저장 설정을 확인하세요.",
                    );
                }}
              >
                {career.skills[s.id] >= 3
                  ? "최고 단계"
                  : upgradeCost(career.skills[s.id]) + " 경험치로 훈련"}
              </button>
            </div>
          ))}
        </div>
        <span role="status">{notice}</span>
      </section>
      <label className="training-toggle">
        <input
          type="checkbox"
          checked={practice}
          onChange={(e) => setPractice(e.target.checked)}
        />
        <span>
          훈련 모드 · 모든 임무 체험{" "}
          <small>완료 기록과 경험치를 저장하지 않습니다.</small>
        </span>
      </label>
      <div className="mission-cards">
        {missionIds.map((id) => {
          const region = regionFor(id),
            stats = missionStats(records, id),
            locked = !isUnlocked(id) && !practice;
          return (
            <button
              className={
                "mission-card mission-" + id + " region-card-" + region.theme
              }
              key={id}
              disabled={locked}
              onClick={() => onSelect(id, practice)}
            >
              <div className="mission-art">
                <span>
                  {id === 3
                    ? "≋"
                    : id === 4
                      ? "△"
                      : id === 5
                        ? "☾"
                        : id === 2
                          ? "☂"
                          : "△"}
                </span>
                <div className="mini-mountains" />
                {id === 5 && <i className="cabin-light" />}
                <b>{region.name}</b>
              </div>
              <div className="mission-card-body">
                <span className="eyebrow orange">
                  임무 {String(id).padStart(2, "0")} ·{" "}
                  {id === 1
                    ? "이야기 3종 · 난이도 선택"
                    : missions[id].difficulty}
                </span>
                <h2>{missions[id].name}</h2>
                <p>{missions[id].subtitle}</p>
                <small>{region.inspiration}</small>
                <div>
                  <span>
                    제한 {id === 1 ? "270~330" : missions[id].limit}분
                  </span>
                  <span>
                    {
                      weatherInfo[id === 1 ? "cloudy" : schedule(id)[0].weather]
                        .name
                    }
                    {id === 5 ? " · 야간" : ""}
                  </span>
                </div>
                <p className="recommended">
                  권장:{" "}
                  {recommendations[id]
                    .map((item) => equipment.find((e) => e.id === item)!.name)
                    .join(" · ")}
                </p>
                <strong>
                  {locked
                    ? "이전 임무를 완료하면 열립니다"
                    : stats.completed
                      ? "완료 · 최고 " + "★".repeat(stats.bestStars)
                      : practice
                        ? "훈련 출동 가능"
                        : "첫 구조 작전 시작"}
                </strong>
              </div>
            </button>
          );
        })}
      </div>
      <p className="muted">
        실제 산에서 영감을 받은 가상 지형입니다. 실제 등산로·구조 경로로
        사용하지 마세요.
      </p>
    </main>
  );
}
export function Loadout({
  loadout,
  setLoadout,
  mission,
  seed,
  setSeed,
  experience,
  disasterDifficulty,
}: {
  loadout: Equipment[];
  setLoadout: (items: Equipment[]) => void;
  mission: MissionId;
  seed: string;
  experience?: ExperienceOptions;
  disasterDifficulty?: Difficulty;
  setSeed: (value: string) => void;
}) {
  return (
    <section className="loadout-section">
      <div className="loadout-title">
        <div>
          <span className="eyebrow orange">제한된 공간, 중요한 선택</span>
          <h2>출동 장비</h2>
        </div>
        <span className="slot-count">{loadout.length} / 3 슬롯</span>
      </div>
      <p className="muted">
        {mission === 1
          ? "부상자 동행에는 로프, 추위에는 방한포, 긴 귀환에는 응급키트가 유리합니다."
          : "빠른 계곡 길에는 로프, 늦은 귀환에는 방한포, 야간 수색에는 랜턴이 유리합니다."}{" "}
        최대 3개를 선택하세요. 권장:{" "}
        {recommendations[mission]
          .map((id) => equipment.find((e) => e.id === id)!.name)
          .join(" · ")}
      </p>
      <div className="loadout-grid">
        {equipment.map((item) => {
          const selected = loadout.includes(item.id);
          return (
            <button
              key={item.id}
              aria-pressed={selected}
              disabled={
                (!selected && loadout.length >= 3) ||
                (mission >= 7 && item.id === "drone")
              }
              className={`equipment-card ${selected ? "selected" : ""}`}
              onClick={() =>
                setLoadout(
                  selected
                    ? loadout.filter((id) => id !== item.id)
                    : [...loadout, item.id],
                )
              }
            >
              <span className="equipment-icon">{item.icon}</span>
              <strong>
                {item.name}
                <i>{selected ? "✓" : "+"}</i>
              </strong>
              <span>
                {mission >= 7 && item.id === "drone"
                  ? "이 작전에서는 사용하지 않음"
                  : item.effect}
              </span>
              <small>
                {mission >= 7 && item.id === "drone"
                  ? "전망대의 지상 신호 탐지를 사용합니다. 드론 지휘는 임무 6에서 가능합니다."
                  : item.tip}
              </small>
            </button>
          );
        })}
      </div>
      <p className="muted">
        평가 기준:{" "}
        {experience
          ? `3별: 생존 65 이상·${Math.floor(difficulties[experience.difficulty].limit * 0.9)}분 이내 / 2별: 생존 40 이상`
          : evaluationRules[mission]}
      </p>
      <label className="seed-input">
        작전 시드{" "}
        <input
          aria-label="작전 시드"
          type="number"
          min="0"
          max="4294967295"
          step="1"
          placeholder={mission >= 7 ? "비우면 0" : "자동 생성"}
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <span>같은 숫자는 같은 조난자 위치를 재현합니다.</span>
      </label>
      <div className="forecast-timeline">
        {(mission >= 7
          ? disasterSchedule(
              disasterDifficulty ?? "normal",
              Number(seed) >>> 0,
              mission,
            )
          : experience
            ? gameSchedule({
                mission,
                seed: Number(seed) >>> 0,
                experience: {
                  ...experience,
                  clueStage: 0,
                  prepared: false,
                  frontAnnounced: false,
                },
              })
            : schedule(mission, Number(seed) || 0)
        ).map((p) => (
          <span key={p.at}>
            <b>{p.at === 0 ? "출동" : `+${p.at}분`}</b>
            {weatherInfo[p.weather].icon} {weatherInfo[p.weather].name}
          </span>
        ))}
      </div>
    </section>
  );
}
export function ForecastBar({ game }: { game: Game }) {
  return (
    <div
      className={`forecast-bar ${game.elapsed >= 70 && game.mission === 2 ? "warning" : ""}`}
    >
      <span>▥ 기상 예보</span>
      <strong>{gameForecast(game)}</strong>
      <small>
        {game.elapsed >= missions[game.mission].sunset
          ? "야간 · 랜턴 없는 수색 +10분"
          : `일몰까지 ${missions[game.mission].sunset - game.elapsed}분`}{" "}
        · 행동할 때만 시간이 흐릅니다
      </small>
    </div>
  );
}
export function EncounterDialog({
  game,
  act,
  busy,
}: {
  game: Game;
  act: (a: Action) => void;
  busy: boolean;
}) {
  if (!game.pending) return null;
  const info = encounterInfo[game.pending.kind];
  return (
    <div className="modal-backdrop event-backdrop">
      <section
        className="modal event-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-title"
      >
        <span className="eyebrow orange">현장 판단 · 구조대장 지시 대기</span>
        <h2 id="event-title">{info.title}</h2>
        <p>{info.text}</p>
        <div className="event-choices">
          {choicesFor(game).map((c) => {
            const reason = choiceDisabled(game, c);
            return (
              <button
                key={c.id}
                disabled={busy || !!reason}
                title={reason}
                onClick={() => act({ type: "choose", choice: c.id })}
              >
                <strong>{c.label}</strong>
                <span>{c.detail}</span>
                <small>
                  {reason ||
                    `${c.cost.time}분 · 체력 ${Math.abs(c.cost.energy)} ${c.cost.energy < 0 ? "회복" : "소모"}`}
                </small>
              </button>
            );
          })}
        </div>
        {game.pending.to && (
          <button
            className="text-button wide"
            disabled={busy}
            onClick={() => act({ type: "choose", choice: "cancel" })}
          >
            경로 선택 취소 · 현재 위치 유지
          </button>
        )}
        <button
          className="text-button wide"
          disabled={busy}
          onClick={() => act({ type: "abandon" })}
        >
          구조대 안전을 위해 임무 중단
        </button>
      </section>
    </div>
  );
}
