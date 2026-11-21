import { memo, useEffect, useRef, useState } from "react";
import { adjacent, edges, point, points } from "./game";
import type { Game } from "./game";

const Contours = memo(function Contours() {
  return (
    <g fill="none" stroke="#91a98b" strokeWidth=".8" opacity=".24">
      {[
        { x: 620, y: 160, r: 190 },
        { x: 300, y: 270, r: 150 },
        { x: 790, y: 390, r: 130 },
        { x: 420, y: 650, r: 100 },
      ].flatMap((peak, j) =>
        Array.from({ length: 17 }, (_, i) => {
          const r = peak.r + i * 14;
          const coords = Array.from({ length: 65 }, (_, k) => {
            const a = (k / 64) * Math.PI * 2;
            const wobble =
              1 + 0.08 * Math.sin(a * 5 + j) + 0.04 * Math.cos(a * 9);
            return `${peak.x + Math.cos(a) * r * wobble},${peak.y + Math.sin(a) * r * 0.63 * wobble}`;
          });
          return (
            <path
              key={`${j}-${i}`}
              d={`M${coords.join(" L")} Z`}
              strokeWidth={i % 4 === 0 ? 1.5 : 0.6}
            />
          );
        }),
      )}
    </g>
  );
});
export default function MountainMap({
  game,
  selected,
  onSelect,
  busy,
  weather = "clear",
  animate = true,
}: {
  game: Game;
  selected: string;
  onSelect: (id: string) => void;
  busy: boolean;
  weather?: string;
  animate?: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapHeight, setMapHeight] = useState(800);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0)
        setMapHeight(Math.max(360, Math.min(800, (1000 * height) / width)));
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const verticalScale = (mapHeight - 38) / 800;
  const mapPoint = (id: string) => ({
    ...point(id),
    y: point(id).y * verticalScale,
  });
  const neighbors = adjacent(game.position);
  const trailLength = useRef(game.trail.length);
  const [marker, setMarker] = useState({ id: game.position, duration: 650 });
  useEffect(() => {
    const steps = game.trail.slice(trailLength.current);
    trailLength.current = game.trail.length;
    if (
      !animate ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !steps.length
    ) {
      setMarker({ id: game.position, duration: 0 });
      return;
    }
    const duration = 650 / steps.length;
    const timers = steps.map((id, i) =>
      setTimeout(() => setMarker({ id, duration }), i * duration),
    );
    return () => timers.forEach(clearTimeout);
  }, [game.trail, game.position, animate]);
  const here = mapPoint(marker.id);
  return (
    <div className={`map-wrap weather-${weather}`}>
      <div className="map-heading">
        <span className="eyebrow">작전 구역 · 백운산 국립공원</span>
        <span>북부 탐방로 / 지형도</span>
      </div>
      <svg
        ref={svgRef}
        className="terrain"
        viewBox={`${500 - 500 / zoom} ${mapHeight / 2 - mapHeight / 2 / zoom} ${1000 / zoom} ${mapHeight / zoom}`}
        aria-label="백운산 수색 지도"
        role="group"
      >
        <defs>
          <radialGradient id="land">
            <stop stopColor="#5d7158" />
            <stop offset=".55" stopColor="#354d40" />
            <stop offset="1" stopColor="#203a33" />
          </radialGradient>
          <linearGradient id="ridge" x2=".8" y2="1">
            <stop stopColor="#acb49a" stopOpacity=".35" />
            <stop offset="1" stopColor="#233d32" stopOpacity="0" />
          </linearGradient>
          <filter id="shadow">
            <feDropShadow dx="0" dy="6" stdDeviation="7" floodOpacity=".4" />
          </filter>
          <pattern
            id="grid"
            width="100"
            height="100"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M100 0H0V100"
              fill="none"
              stroke="#b4c7ad"
              strokeOpacity=".06"
            />
          </pattern>
          <pattern
            id="rain"
            width="35"
            height="45"
            patternUnits="userSpaceOnUse"
          >
            <path d="M20 0L7 25" stroke="#d1e3ed" strokeOpacity=".24" />
          </pattern>
          <pattern
            id="snow"
            width="75"
            height="70"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="15" cy="20" r="2" fill="white" opacity=".65" />
            <circle cx="58" cy="52" r="1.5" fill="white" opacity=".4" />
          </pattern>
        </defs>
        <rect width="1000" height={mapHeight} fill="url(#land)" />
        <g transform={`scale(1 ${verticalScale})`}>
          <path
            d="M150 0L335 125 415 200 620 60 720 0H900L840 125 755 260 650 310 500 420 395 380 235 280Z"
            fill="url(#ridge)"
          />
          <path
            d="M620 90L530 190 560 230 430 360M620 90L725 205 710 275M530 190L380 295 220 215"
            fill="none"
            stroke="#a4b295"
            strokeWidth="14"
            opacity=".09"
          />
          <Contours />
          <rect width="1000" height="800" fill="url(#grid)" />
          <path
            d="M960 300Q865 320 840 410T740 510Q690 560 770 610T805 800"
            stroke="#182d2a"
            strokeWidth="21"
            fill="none"
          />
          <path
            d="M960 300Q865 320 840 410T740 510Q690 560 770 610T805 800"
            stroke="#759b9c"
            strokeWidth="9"
            fill="none"
            opacity=".65"
          />
          <path
            d="M960 300Q865 320 840 410T740 510Q690 560 770 610T805 800"
            stroke="#b9d7cf"
            strokeWidth="1.5"
            fill="none"
            opacity=".5"
          />
          <g className="forest" opacity=".45">
            {Array.from({ length: 145 }, (_, i) => {
              const x = ((i * 137.53) % 940) + 30,
                y = ((i * 83.77) % 680) + 65;
              if (points.some((p) => Math.hypot(p.x - x, p.y - y) < 45))
                return null;
              return (
                <g key={i} transform={`translate(${x} ${y})`}>
                  <path
                    d="M0 -11L-7 3H-5L-10 10H10L5 3H7Z"
                    fill={i % 3 ? "#142d25" : "#92a281"}
                  />
                  <path d="M0 8V15" stroke="#182f27" strokeWidth="2" />
                </g>
              );
            })}
          </g>
          <g fill="#c4d0bb" opacity=".25" fontSize="17" letterSpacing="8">
            <text x="345" y="145" transform="rotate(-22 345 145)">
              백 운 능 선
            </text>
            <text x="110" y="400" transform="rotate(-72 110 400)">
              서쪽 원시림
            </text>
            <text x="805" y="530" transform="rotate(25 805 530)">
              물소리 계곡
            </text>
          </g>
        </g>
        {!game.found && (
          <ellipse
            cx="500"
            cy={380 * verticalScale}
            rx="180"
            ry={130 * verticalScale}
            fill="#edaa55"
            fillOpacity=".025"
            stroke="#d7b576"
            strokeDasharray="5 8"
            strokeOpacity=".3"
          />
        )}
        {edges.map((e) => {
          const a = mapPoint(e.a),
            b = mapPoint(e.b);
          const available = e.a === game.position || e.b === game.position;
          const visited = game.trail.some(
            (p, i) =>
              i > 0 &&
              ((p === e.a && game.trail[i - 1] === e.b) ||
                (p === e.b && game.trail[i - 1] === e.a)),
          );
          return (
            <g key={e.a + e.b}>
              <path
                d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                stroke="#142923"
                strokeWidth="7"
              />
              <path
                d={`M${a.x} ${a.y}L${b.x} ${b.y}`}
                fill="none"
                stroke={
                  available
                    ? "#edc78d"
                    : visited
                      ? "#a7be9c"
                      : e.steep
                        ? "#b88b68"
                        : "#89957c"
                }
                strokeWidth={available ? 3 : 2}
                strokeDasharray={visited ? "none" : e.steep ? "3 7" : "6 5"}
                opacity={available ? 1 : 0.65}
              />
            </g>
          );
        })}
        {points.map((source) => {
          const p = mapPoint(source.id);
          const current = p.id === game.position,
            chosen = p.id === selected;
          return (
            <g
              key={p.id}
              className="map-node"
              opacity={
                weather === "fog" &&
                !game.visited.includes(p.id) &&
                !neighbors.includes(p.id)
                  ? 0.4
                  : 1
              }
              role="button"
              tabIndex={busy ? -1 : 0}
              aria-label={`${p.name}, ${p.elevation}미터${current ? ", 현재 위치" : neighbors.includes(p.id) ? ", 이동 가능" : ", 인접 경로를 따라 이동"}`}
              aria-pressed={chosen}
              onClick={() => !busy && onSelect(p.id)}
              onKeyDown={(e) => {
                if (!busy && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(p.id);
                }
              }}
            >
              <circle cx={p.x} cy={p.y} r="24" fill="transparent" />
              {chosen && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="22"
                  fill="#edaa55"
                  fillOpacity=".1"
                  stroke="#ecb476"
                  strokeWidth="1"
                />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={p.kind === "base" ? 12 : 8}
                fill={
                  current
                    ? "#edaa55"
                    : game.visited.includes(p.id)
                      ? "#c7d0ba"
                      : "#2b4338"
                }
                stroke={neighbors.includes(p.id) ? "#f4ce96" : "#9cae94"}
                strokeWidth="2"
              />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontSize="12"
                fill="#163029"
                fontWeight="900"
              >
                {p.kind === "base"
                  ? "+"
                  : game.searched.includes(p.id)
                    ? "✓"
                    : ""}
              </text>
              <text
                className="node-label"
                x={p.x}
                y={p.y + 25}
                textAnchor="middle"
                fill={current ? "#ffd098" : "#d2dbc7"}
              >
                {p.name}
              </text>
              {game.clues.some((c) => c.location === p.id) && (
                <text x={p.x + 13} y={p.y - 10} fill="#f2c27c" fontSize="16">
                  ⌕
                </text>
              )}
            </g>
          );
        })}
        <g
          className="rescue-marker"
          style={{
            transform: `translate(${here.x}px, ${here.y}px)`,
            transitionDuration: `${marker.duration}ms`,
          }}
          pointerEvents="none"
        >
          <circle r="17" fill="#f5a15b" opacity=".2" className="pulse" />
          <path
            d="M-8 -13L0 -25 8 -13 0 -16Z"
            fill="#ffbe7e"
            stroke="#242d26"
            strokeWidth="2"
          />
        </g>
        <g transform={`scale(1 ${verticalScale})`}>
          {weather === "rain" && (
            <rect
              className="rain-overlay"
              width="1000"
              height="800"
              fill="url(#rain)"
              pointerEvents="none"
            />
          )}
          {weather === "snow" && (
            <rect
              className="snow-overlay"
              width="1000"
              height="800"
              fill="url(#snow)"
              pointerEvents="none"
            />
          )}
          {(weather === "fog" || weather === "cloudy") && (
            <g className="fog" pointerEvents="none">
              <ellipse cx="300" cy="280" rx="310" ry="70" fill="#d1e0d5" />
              <ellipse cx="780" cy="510" rx="260" ry="85" fill="#d1e0d5" />
            </g>
          )}
          {weather === "wind" && (
            <g
              className="wind-overlay"
              fill="none"
              stroke="#dce7dc"
              opacity=".25"
              strokeWidth="2"
              pointerEvents="none"
            >
              <path d="M80 250Q200 220 330 250M500 530Q630 490 830 520M400 90Q600 60 780 90" />
            </g>
          )}
        </g>
      </svg>
      <div className="map-compass">
        <span>북</span>
        <b>↑</b>
        <span>남</span>
      </div>
      <div className="map-tools">
        <button
          aria-label="지도 축소"
          disabled={zoom === 1}
          onClick={() => setZoom(Math.max(1, zoom - 0.25))}
        >
          −
        </button>
        <button aria-label="지도 배율 초기화" onClick={() => setZoom(1)}>
          {Math.round(zoom * 100)}%
        </button>
        <button
          aria-label="지도 확대"
          disabled={zoom >= 1.5}
          onClick={() => setZoom(Math.min(1.5, zoom + 0.25))}
        >
          +
        </button>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-line" />
          이동 가능 경로
        </span>
        <span>
          <i className="legend-dot" />
          방문 지점
        </span>
        <span>△ 위험 구간</span>
        <span className="scale">0 ━━━ 500 m</span>
      </div>
    </div>
  );
}
