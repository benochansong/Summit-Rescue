import type { MissionId } from "./conditions";
export type Point = {
  id: string;
  name: string;
  x: number;
  y: number;
  elevation: number;
  kind?: "base" | "shelter" | "lookout" | "cliff";
};
const basePoints: Point[] = [
  {
    id: "base",
    name: "구조본부",
    x: 175,
    y: 665,
    elevation: 320,
    kind: "base",
  },
  { id: "gate", name: "북쪽 등산로", x: 290, y: 575, elevation: 410 },
  {
    id: "lookout",
    name: "제2전망대",
    x: 420,
    y: 475,
    elevation: 580,
    kind: "lookout",
  },
  { id: "fork", name: "삼거리 이정표", x: 535, y: 370, elevation: 650 },
  {
    id: "cedar",
    name: "전나무 쉼터",
    x: 375,
    y: 290,
    elevation: 690,
    kind: "shelter",
  },
  { id: "valley", name: "물소리 계곡", x: 670, y: 465, elevation: 520 },
  {
    id: "cave",
    name: "바위 그늘",
    x: 710,
    y: 265,
    elevation: 740,
    kind: "cliff",
  },
  { id: "west", name: "서쪽 숲길", x: 150, y: 465, elevation: 460 },
  { id: "spring", name: "옹달샘", x: 235, y: 345, elevation: 530 },
  {
    id: "hut",
    name: "백운 대피소",
    x: 210,
    y: 225,
    elevation: 640,
    kind: "shelter",
  },
  {
    id: "ridge",
    name: "칼바람 능선",
    x: 525,
    y: 190,
    elevation: 890,
    kind: "cliff",
  },
  {
    id: "summit",
    name: "백운산 정상",
    x: 650,
    y: 95,
    elevation: 1087,
    kind: "lookout",
  },
  {
    id: "east",
    name: "동쪽 암릉",
    x: 835,
    y: 170,
    elevation: 920,
    kind: "cliff",
  },
  { id: "bridge", name: "계곡 나무다리", x: 770, y: 590, elevation: 400 },
  { id: "pine", name: "소나무 숲", x: 525, y: 620, elevation: 400 },
  { id: "lower", name: "하부 탐방로", x: 375, y: 705, elevation: 340 },
  { id: "waterfall", name: "작은 폭포", x: 855, y: 405, elevation: 500 },
];
export type Edge = {
  a: string;
  b: string;
  steep?: boolean;
  time?: number;
  energy?: number;
  ropeOnlyInWind?: boolean;
  risk?: "river" | "ridge";
};
const baseEdges: Edge[] = [
  { a: "base", b: "gate" },
  { a: "gate", b: "lookout" },
  { a: "lookout", b: "fork" },
  { a: "fork", b: "cedar" },
  { a: "fork", b: "valley", risk: "river" },
  { a: "fork", b: "cave", risk: "ridge" },
  { a: "base", b: "west" },
  { a: "west", b: "spring" },
  { a: "spring", b: "hut" },
  { a: "hut", b: "cedar" },
  { a: "spring", b: "lookout" },
  { a: "cedar", b: "ridge", steep: true, risk: "ridge" },
  { a: "ridge", b: "summit", steep: true, risk: "ridge" },
  { a: "summit", b: "east", steep: true, risk: "ridge" },
  { a: "east", b: "cave", steep: true },
  { a: "base", b: "lower" },
  { a: "lower", b: "pine" },
  { a: "pine", b: "lookout" },
  { a: "pine", b: "bridge" },
  { a: "bridge", b: "valley" },
  { a: "valley", b: "waterfall" },
  { a: "waterfall", b: "cave" },
];
const baseCandidates = ["cedar", "valley", "cave"];
export type Region = {
  id: "baegun" | "mist" | "granite" | "night";
  name: string;
  inspiration: string;
  theme: string;
  points: Point[];
  edges: Edge[];
  candidates: string[];
  initialHint: string;
  briefing: string;
  terrainWords: [string, string, string];
};
const p = (
  id: string,
  name: string,
  x: number,
  y: number,
  elevation: number,
  kind?: Point["kind"],
): Point => ({ id, name, x, y, elevation, kind });
const e = (a: string, b: string, extra: Partial<Edge> = {}): Edge => ({
  a,
  b,
  ...extra,
});
const mist: Region = {
  id: "mist",
  name: "안개 능선",
  inspiration: "계룡산 모티브 · 가상 구조 구역",
  theme: "mist",
  points: [
    p("base", "안개 구조본부", 120, 690, 230, "base"),
    p("gate", "숲 입구", 235, 600, 310),
    p("listening", "청음 전망대", 350, 500, 450, "lookout"),
    p("fork", "안개 삼거리", 500, 440, 520),
    p("stream", "물소리 굴곡", 650, 550, 430),
    p("grove", "이끼 암반", 670, 320, 610),
    p("hollow", "북쪽 오목골", 470, 240, 580),
    p("echo", "메아리 바위", 260, 310, 500),
    p("radioWest", "서쪽 수신점", 220, 450, 420),
    p("bridge", "낙엽 다리", 510, 620, 350),
    p("hut", "숲속 대피소", 380, 680, 300, "shelter"),
    p("saddle", "바람재", 540, 110, 750, "cliff"),
    p("ledge", "장군바위", 790, 200, 710, "cliff"),
    p("marsh", "습지 갈림길", 850, 470, 480),
    p("oldpath", "옛 숲길", 800, 650, 360),
    p("cairn", "돌탑 고개", 350, 150, 650),
    p("spring", "서쪽 샘터", 110, 240, 460),
  ],
  edges: [
    e("base", "gate"),
    e("gate", "listening"),
    e("listening", "fork"),
    e("fork", "stream"),
    e("fork", "grove"),
    e("fork", "hollow"),
    e("gate", "radioWest"),
    e("radioWest", "echo"),
    e("echo", "hollow"),
    e("radioWest", "spring"),
    e("spring", "cairn"),
    e("cairn", "hollow"),
    e("hollow", "saddle", { steep: true }),
    e("saddle", "ledge", { steep: true }),
    e("ledge", "grove"),
    e("grove", "marsh"),
    e("marsh", "stream"),
    e("stream", "bridge"),
    e("bridge", "hut"),
    e("hut", "base"),
    e("bridge", "oldpath"),
    e("oldpath", "marsh"),
    e("listening", "hut"),
    e("listening", "radioWest"),
  ],
  candidates: ["stream", "grove", "hollow"],
  initialHint: "listening",
  briefing:
    "청음 전망대에서 흔적을 확인하고 무전 신호를 분석하세요. 다른 지점의 신호와 비교하면 세 후보 구역을 좁힐 수 있습니다.",
  terrainWords: ["안 개 능 선", "깊은 숲", "메아리 골짜기"],
};
const granite: Region = {
  id: "granite",
  name: "바람의 암릉",
  inspiration: "설악산 모티브 · 가상 구조 구역",
  theme: "granite",
  points: [
    p("base", "암릉 구조본부", 140, 700, 620, "base"),
    p("gate", "암벽 진입로", 260, 600, 750),
    p("shelter", "계곡 대피소", 220, 440, 800, "shelter"),
    p("pass", "안전 고갯길", 350, 340, 940),
    p("lookout", "암릉 관측소", 450, 270, 1120, "lookout"),
    p("spire", "첨봉 안부", 480, 140, 1290, "cliff"),
    p("eagle", "독수리 바위", 670, 220, 1250, "cliff"),
    p("ledge", "동쪽 테라스", 830, 320, 1160, "cliff"),
    p("spine", "칼날 구간", 540, 380, 1170, "cliff"),
    p("basin", "너른 분지", 640, 510, 850),
    p("trail", "너덜 우회로", 800, 450, 970),
    p("lowerhut", "남쪽 산장", 420, 670, 650, "shelter"),
    p("valley", "백석 계곡", 600, 690, 640),
    p("river", "돌다리", 820, 620, 690),
    p("snowgate", "북쪽 너덜길", 310, 180, 1050),
    p("summit", "구름 봉우리", 460, 70, 1430, "lookout"),
    p("north", "바람 관측점", 760, 100, 1390),
  ],
  edges: [
    e("base", "gate"),
    e("gate", "lookout", {
      steep: true,
      time: 12,
      energy: 13,
      risk: "ridge",
      ropeOnlyInWind: true,
    }),
    e("gate", "shelter", { time: 12, energy: 3 }),
    e("shelter", "pass", { time: 12, energy: 3 }),
    e("pass", "lookout", { time: 12, energy: 3 }),
    e("lookout", "spire", {
      steep: true,
      time: 10,
      energy: 12,
      risk: "ridge",
      ropeOnlyInWind: true,
    }),
    e("lookout", "spine", {
      steep: true,
      time: 8,
      energy: 11,
      risk: "ridge",
      ropeOnlyInWind: true,
    }),
    e("spine", "eagle", {
      steep: true,
      time: 8,
      energy: 11,
      risk: "ridge",
      ropeOnlyInWind: true,
    }),
    e("spine", "ledge", {
      steep: true,
      time: 10,
      energy: 12,
      risk: "ridge",
      ropeOnlyInWind: true,
    }),
    e("pass", "snowgate", { time: 12, energy: 3 }),
    e("snowgate", "summit", { time: 12, energy: 3 }),
    e("summit", "spire", { time: 12, energy: 3 }),
    e("pass", "basin", { time: 12, energy: 3 }),
    e("basin", "trail", { time: 12, energy: 3 }),
    e("trail", "ledge", { time: 12, energy: 3 }),
    e("ledge", "eagle", { time: 12, energy: 3 }),
    e("eagle", "north", { steep: true }),
    e("north", "summit", { steep: true }),
    e("base", "lowerhut", { time: 12, energy: 3 }),
    e("lowerhut", "valley", { time: 12, energy: 3 }),
    e("valley", "river", { time: 12, energy: 3 }),
    e("river", "trail", { time: 12, energy: 3 }),
    e("lowerhut", "basin", { time: 12, energy: 3 }),
  ],
  candidates: ["spire", "eagle", "ledge"],
  initialHint: "lookout",
  briefing:
    "암릉 관측소의 신고 기록을 확인하세요. 강풍 중 노출 암릉은 로프 없이 통과할 수 없습니다. 다친 조난자는 기본 응급처치 후에만 이동할 수 있습니다.",
  terrainWords: ["바 람 의 암 릉", "백석 절벽", "깊은 계곡"],
};
const night: Region = {
  id: "night",
  name: "밤의 숲길",
  inspiration: "지리산 모티브 · 가상 구조 구역",
  theme: "night",
  points: [
    p("base", "야간 구조본부", 120, 650, 360, "base"),
    p("gate", "저녁 숲 입구", 220, 530, 430),
    p("hut", "첫빛 대피소", 360, 610, 490, "shelter"),
    p("lookout", "별빛 전망대", 450, 430, 610, "lookout"),
    p("creek", "달그림자 계곡", 590, 590, 480),
    p("cedar", "삼나무 공터", 730, 460, 580),
    p("pool", "검은못 쉼터", 800, 280, 640),
    p("pine", "깊은 잣나무숲", 580, 190, 790),
    p("nighthut", "능선 대피소", 440, 270, 760, "shelter"),
    p("ridge", "달빛 고개", 300, 170, 860, "cliff"),
    p("west", "서쪽 숲길", 170, 340, 520),
    p("spring", "반딧불 샘", 280, 310, 570),
    p("bridge", "작은 목교", 660, 690, 410),
    p("lower", "하부 숲길", 400, 710, 390),
    p("east", "동쪽 방화선", 880, 600, 450),
    p("moss", "이끼 통로", 700, 110, 840),
    p("summit", "밤하늘 봉우리", 410, 80, 1020, "lookout"),
  ],
  edges: [
    e("base", "gate"),
    e("gate", "hut"),
    e("hut", "lookout"),
    e("lookout", "creek"),
    e("creek", "cedar"),
    e("cedar", "pool"),
    e("pool", "pine"),
    e("pine", "nighthut"),
    e("nighthut", "lookout"),
    e("nighthut", "ridge"),
    e("ridge", "spring"),
    e("spring", "west"),
    e("west", "gate"),
    e("spring", "lookout"),
    e("hut", "lower"),
    e("lower", "base"),
    e("lower", "bridge"),
    e("bridge", "creek"),
    e("bridge", "east"),
    e("east", "cedar"),
    e("pool", "moss"),
    e("moss", "summit", { steep: true }),
    e("summit", "ridge", { steep: true }),
  ],
  candidates: ["cedar", "pool", "pine"],
  initialHint: "hut",
  briefing:
    "첫빛 대피소의 숙박 기록을 수색하세요. 30분 뒤 일몰입니다. 불빛 관측과 후보 구역을 비교하고, 귀환 중 대피소에서 보온 정비를 하세요.",
  terrainWords: ["밤 의 숲 길", "깊은 산림", "달그림자 계곡"],
};
const baegun: Region = {
  id: "baegun",
  name: "백운산 북부",
  inspiration: "백운산 모티브 · 가상 구조 구역",
  theme: "baegun",
  points: basePoints,
  edges: baseEdges,
  candidates: baseCandidates,
  initialHint: "lookout",
  briefing:
    "제2전망대가 마지막 목격 장소입니다. 북쪽 등산로를 따라 이동하십시오.",
  terrainWords: ["백 운 능 선", "서쪽 원시림", "물소리 계곡"],
};
export const regions = { baegun, mist, granite, night };
export const regionFor = (mission: MissionId): Region =>
  mission === 3
    ? mist
    : mission === 4
      ? granite
      : mission === 5
        ? night
        : baegun;
export const point = (id: string, mission: MissionId = 1) =>
  regionFor(mission).points.find((p) => p.id === id)!;
export const connection = (a: string, b: string, mission: MissionId = 1) =>
  regionFor(mission).edges.find(
    (e) => (e.a === a && e.b === b) || (e.a === b && e.b === a),
  );
export const adjacent = (id: string, mission: MissionId = 1) =>
  regionFor(mission)
    .edges.filter((e) => e.a === id || e.b === id)
    .map((e) => (e.a === id ? e.b : e.a));
export function graphDistance(
  from: string,
  to: string,
  mission: MissionId,
): number {
  const queue = [{ id: from, d: 0 }],
    seen = new Set([from]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.id === to) return current.d;
    for (const id of adjacent(current.id, mission))
      if (!seen.has(id)) {
        seen.add(id);
        queue.push({ id, d: current.d + 1 });
      }
  }
  return Infinity;
}
