import {
  equipment,
  forecast,
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
  onSelect: (id: MissionId) => void;
  onBack: () => void;
}) {
  return (
    <main className="page">
      <button className="text-button" onClick={onBack}>
        메인 메뉴로
      </button>
      <span className="eyebrow orange">구조대 출동 준비</span>
      <h1>다음 구조 작전</h1>
      <p className="page-lead">산의 상황은 달라져도, 우리의 목표는 같습니다.</p>
      <div className="mission-cards">
        {([1, 2] as const).map((id) => (
          <button
            className={`mission-card mission-${id}`}
            onClick={() => onSelect(id)}
            key={id}
          >
            <div className="mission-art">
              <span>{id === 1 ? "△" : "☂"}</span>
              <div className="mini-mountains" />
            </div>
            <div className="mission-card-body">
              <span className="eyebrow orange">
                임무 {id.toString().padStart(2, "0")} ·{" "}
                {missions[id].difficulty}
              </span>
              <h2>{missions[id].name}</h2>
              <p>
                {id === 1
                  ? "흔적을 찾고, 첫 번째 생명을 구하세요."
                  : "다가오는 폭풍. 장비와 경로가 귀환을 결정합니다."}
              </p>
              <div>
                <span>제한 {missions[id].limit}분</span>
                <span>
                  {id === 1 ? "튜토리얼 · 맑음" : "기상 변화 · 선택 이벤트"}
                </span>
              </div>
              <strong>구조 요청 확인</strong>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}
export function Loadout({
  loadout,
  setLoadout,
  mission,
  seed,
  setSeed,
}: {
  loadout: Equipment[];
  setLoadout: (items: Equipment[]) => void;
  mission: MissionId;
  seed: string;
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
          ? "첫 임무는 기본 응급처치만으로도 완료할 수 있습니다."
          : "빠른 계곡 길에는 로프, 늦은 귀환에는 방한포, 야간 수색에는 랜턴이 유리합니다."}{" "}
        최대 3개를 선택하세요.
      </p>
      <div className="loadout-grid">
        {equipment.map((item) => {
          const selected = loadout.includes(item.id);
          return (
            <button
              key={item.id}
              aria-pressed={selected}
              disabled={!selected && loadout.length >= 3}
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
              <span>{item.effect}</span>
              <small>{item.tip}</small>
            </button>
          );
        })}
      </div>
      <label className="seed-input">
        작전 시드{" "}
        <input
          aria-label="작전 시드"
          type="number"
          min="0"
          max="4294967295"
          step="1"
          placeholder="자동 생성"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
        <span>같은 숫자는 같은 조난자 위치를 재현합니다.</span>
      </label>
      <div className="forecast-timeline">
        {schedule(mission).map((p) => (
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
      <strong>{forecast(game.mission, game.elapsed)}</strong>
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
                  {reason || `${c.cost.time}분 · 체력 ${c.cost.energy} 소모`}
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
