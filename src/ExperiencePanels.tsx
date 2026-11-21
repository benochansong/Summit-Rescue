import type { Action, Game } from "./game";
import { disabledReason } from "./game";
import {
  difficulties,
  stories,
  nextStep,
  tension,
  type Difficulty,
  type ExperienceOptions,
  type StoryId,
  type Feedback,
} from "./experience";
export function ExperienceSetup({
  value,
  onChange,
}: {
  value: ExperienceOptions;
  onChange: (v: ExperienceOptions) => void;
}) {
  return (
    <section className="experience-setup panel">
      <span className="eyebrow orange">
        첫 구조 · 같은 산, 세 사람의 이야기
      </span>
      <h2>누군가의 안부를 찾아서</h2>
      <fieldset>
        <legend>구조 이야기</legend>
        <div className="story-choices">
          {(Object.keys(stories) as StoryId[]).map((id) => (
            <label className={value.story === id ? "chosen" : ""} key={id}>
              <input
                type="radio"
                name="story"
                value={id}
                checked={value.story === id}
                onChange={() => onChange({ ...value, story: id })}
              />
              <strong>{stories[id].name}</strong>
              <small>{stories[id].person}</small>
              <p>{stories[id].intro}</p>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>작전 난이도</legend>
        <div className="difficulty-choices">
          {(Object.keys(difficulties) as Difficulty[]).map((id) => (
            <label className={value.difficulty === id ? "chosen" : ""} key={id}>
              <input
                type="radio"
                name="difficulty"
                checked={value.difficulty === id}
                onChange={() => onChange({ ...value, difficulty: id })}
              />
              <strong>{difficulties[id].name}</strong>
              <small>{difficulties[id].limit}분</small>
              <p>{difficulties[id].description}</p>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="story-tip">{stories[value.story].tip}</p>
      <small>
        이 선택은 첫 임무에 적용됩니다. 임무 2~6의 고유 규칙은 유지됩니다.
      </small>
    </section>
  );
}
export function ExperienceBar({
  game,
  feedback,
  tutorial,
  onTutorial,
  act,
  busy,
}: {
  game: Game;
  feedback: Feedback | null;
  tutorial: boolean;
  onTutorial: () => void;
  act: (a: Action) => void;
  busy: boolean;
}) {
  const stage = tension(game),
    guide = nextStep(game),
    reason = guide.action ? disabledReason(game, guide.action) : "";
  return (
    <div className={`experience-bar stage-${stage.stage}`}>
      <div className="tension-label">
        <span>0{stage.stage} / 04</span>
        <strong>{stage.title}</strong>
        <small>{stage.text}</small>
        <button className="text-button" onClick={onTutorial}>
          {tutorial ? "안내 접기" : "튜토리얼 다시 보기"}
        </button>
      </div>
      {tutorial && (
        <div className="next-guidance">
          <span>다음 행동</span>
          <p>{guide.text}</p>
          {guide.action && (
            <button
              disabled={busy || !!reason}
              title={reason}
              onClick={() => act(guide.action!)}
            >
              {guide.action.type === "move"
                ? "안내된 길로 이동"
                : guide.action.type === "aid"
                  ? "응급처치"
                  : guide.action.type === "blanket"
                    ? "보온하기"
                    : "이곳 수색"}
            </button>
          )}
          {reason && <small className="orange">{reason}</small>}
        </div>
      )}
      {feedback && (
        <div
          key={game.revision}
          className={`action-feedback feedback-${feedback.kind}`}
          role="status"
        >
          <strong>{feedback.title}</strong>
          <span>{feedback.detail}</span>
        </div>
      )}
    </div>
  );
}
