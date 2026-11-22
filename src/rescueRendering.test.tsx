import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import DisasterScreen from "./DisasterScreen";
import CliffRescue from "./CliffRescue";
import HelicopterScene from "./HelicopterScene";
import { createDisaster, type DisasterGame } from "./disaster";
import { beginCliff, cliffStageNames } from "./rescueActions";
import type { CliffStage } from "./rescueActions";
import type { Scene } from "./disasterData";
const noop = () => {};
const render = (g: DisasterGame) =>
  renderToStaticMarkup(
    <DisasterScreen
      initial={g}
      settings={{
        sound: false,
        volume: 0.3,
        motion: false,
        skipDialogue: true,
      }}
      onSettings={noop}
      onExit={noop}
    />,
  );
afterEach(() => vi.unstubAllGlobals());
describe("React 서버 렌더 검증 (실제 브라우저 플레이 아님)", () => {
  for (const mission of [8, 9, 10] as const)
    it(`임무 ${mission} 지도와 현재 목표 렌더`, () => {
      const markup = render(
        createDisaster(3, "normal", undefined, undefined, false, mission),
      );
      expect(markup).toContain("현재 목표");
      expect(markup).toContain("현장 수색");
      if (mission === 10) {
        expect(markup).toContain("ACT 1");
        expect(markup).toContain("최후의 구조 작전");
        expect(markup).toContain("입구에서");
      }
    });
  for (const stage of Object.keys(cliffStageNames) as CliffStage[])
    it(`절벽 ${stage} 단계 렌더`, () => {
      vi.stubGlobal("matchMedia", () => ({ matches: true }));
      const game = {
        ...createDisaster(0, "normal", undefined, undefined, false, 10),
        found: true,
        cliff: { ...beginCliff(), stage },
      };
      const markup = renderToStaticMarkup(
        <CliffRescue
          game={game}
          command={noop}
          busy={false}
          motion={false}
          onSound={noop}
        />,
      );
      expect(markup).toContain(cliffStageNames[stage]);
      expect(markup).toContain("자동");
      if (stage === "approach") {
        expect(markup).toContain("하늘");
        expect(markup).not.toContain("서윤");
      }
    });
  for (const scene of [
    "air-request",
    "air-approach",
    "air-hoist",
    "air-depart",
    "air-complete",
    "air-delay",
    "air-return",
  ] as Scene[])
    it(`헬기 ${scene} 렌더`, () => {
      const markup = renderToStaticMarkup(
        <HelicopterScene scene={scene} busy={false} onContinue={noop} />,
      );
      expect(markup).toContain('role="dialog"');
      expect(markup).toContain("건너뛰기");
      expect(markup).toContain("<svg");
    });
  it("통합 임무 현장 인양 재개와 대피·최종 결과 표시", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const game = {
      ...createDisaster(0, "normal", undefined, undefined, false, 10),
      scenes: [],
      found: true,
      cliff: { ...beginCliff(), visible: false, paused: true },
    };
    expect(render(game)).toContain("절벽 구조 계속");
    const ready = {
      ...game,
      cliff: undefined,
      secured: true,
      carried: true,
      treated: true,
      position: "hut",
    };
    expect(render(ready)).toContain("대피소 보호 대기");
    const ended = {
      ...ready,
      position: "base",
      status: "success" as const,
      reason: "모두 안전 귀환",
    };
    const markup = render(ended);
    expect(markup).toContain("같은 시드 재도전");
    expect(markup).toContain("구조팀 본부 복귀");
    expect(markup).toContain("하늘");
  });
});
