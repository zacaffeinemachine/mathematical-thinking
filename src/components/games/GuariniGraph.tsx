import { useState } from "react";

// Cycle order of knight-move adjacency on the 3x3 board (excluding center):
// 0 - 5 - 6 - 1 - 8 - 3 - 2 - 7 - 0
const CYCLE = [0, 5, 6, 1, 8, 3, 2, 7];
const START_PIECES: Record<number, "W" | "B"> = { 0: "W", 2: "W", 6: "B", 8: "B" };
const GOAL_PIECES:  Record<number, "W" | "B"> = { 0: "B", 2: "B", 6: "W", 8: "W" };

type Pieces = Record<number, "W" | "B" | undefined>;

function shiftClockwise(pieces: Pieces): Pieces {
  // Shift each piece one step clockwise around the cycle.
  const next: Pieces = {};
  for (let i = 0; i < CYCLE.length; i++) {
    const from = CYCLE[i];
    const to = CYCLE[(i + 1) % CYCLE.length];
    if (pieces[from]) next[to] = pieces[from];
  }
  return next;
}

export default function GuariniGraph() {
  const [revealed, setRevealed] = useState(false);
  const [pieces, setPieces] = useState<Pieces>({ ...START_PIECES });

  const solved =
    pieces[0] === "B" && pieces[2] === "B" &&
    pieces[6] === "W" && pieces[8] === "W";

  const cx = 150, cy = 150, r = 110;
  const nodePos = (i: number) => {
    const theta = (2 * Math.PI * i) / CYCLE.length - Math.PI / 2;
    return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
  };

  // Board grid layout (left side of the figure).
  const boardX = 20, boardY = 50, cellSize = 50;
  const cellPos = (idx: number) => ({
    x: boardX + (idx % 3) * cellSize + cellSize / 2,
    y: boardY + Math.floor(idx / 3) * cellSize + cellSize / 2,
  });

  function reset() {
    setPieces({ ...START_PIECES });
  }

  return (
    <div className="not-prose my-8">
      <div className="flex flex-col items-center gap-4">
        <svg
          viewBox="0 0 480 300"
          className="w-full max-w-2xl border border-[var(--rule)] rounded-lg bg-white"
        >
          {/* Board (left) */}
          <g>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              const { x, y } = cellPos(i);
              const isLight = (Math.floor(i / 3) + (i % 3)) % 2 === 0;
              const piece = pieces[i];
              return (
                <g key={`cell-${i}`}>
                  <rect
                    x={x - cellSize / 2}
                    y={y - cellSize / 2}
                    width={cellSize}
                    height={cellSize}
                    fill={isLight ? "#f0ece2" : "#c9bfa8"}
                    stroke="#6b6b6b"
                    strokeWidth={0.5}
                  />
                  {piece && (
                    <text
                      x={x}
                      y={y + 10}
                      textAnchor="middle"
                      fontSize="28"
                      fill={piece === "W" ? "#1a1a1a" : "#8b2c2c"}
                    >
                      {piece === "W" ? "♘" : "♞"}
                    </text>
                  )}
                  <text
                    x={x - cellSize / 2 + 4}
                    y={y - cellSize / 2 + 12}
                    fontSize="10"
                    fill="#6b6b6b"
                  >
                    {i}
                  </text>
                </g>
              );
            })}
          </g>

          {/* Graph (right) */}
          <g transform="translate(180, 0)">
            {/* Cycle edges */}
            {CYCLE.map((_, i) => {
              const a = nodePos(i);
              const b = nodePos((i + 1) % CYCLE.length);
              return (
                <line
                  key={`edge-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#6b6b6b"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Reveal lines: node ↔ cell */}
            {revealed &&
              CYCLE.map((cellIdx, i) => {
                const n = nodePos(i);
                const c = cellPos(cellIdx);
                // Graph is translated by (180, 0) so compensate:
                return (
                  <line
                    key={`reveal-${i}`}
                    x1={n.x}
                    y1={n.y}
                    x2={c.x - 180}
                    y2={c.y}
                    stroke="#8b2c2c"
                    strokeWidth={0.8}
                    strokeDasharray="3 3"
                    opacity={0.4}
                  />
                );
              })}

            {/* Cycle nodes */}
            {CYCLE.map((cellIdx, i) => {
              const { x, y } = nodePos(i);
              const piece = pieces[cellIdx];
              return (
                <g key={`node-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={18}
                    fill="#fafaf7"
                    stroke="#1a1a1a"
                    strokeWidth={1.5}
                  />
                  {piece && (
                    <text
                      x={x}
                      y={y + 7}
                      textAnchor="middle"
                      fontSize="20"
                      fill={piece === "W" ? "#1a1a1a" : "#8b2c2c"}
                    >
                      {piece === "W" ? "♘" : "♞"}
                    </text>
                  )}
                  {!piece && (
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6b6b6b"
                    >
                      {cellIdx}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button
            onClick={() => setRevealed((r) => !r)}
            className="px-3 py-1 border border-[var(--rule)] rounded hover:border-[var(--accent)]"
          >
            {revealed ? "Hide" : "Reveal"} connections
          </button>
          <button
            onClick={() => setPieces(shiftClockwise(pieces))}
            className="px-3 py-1 border border-[var(--rule)] rounded hover:border-[var(--accent)]"
          >
            Shift ↻ clockwise
          </button>
          <button
            onClick={reset}
            className="px-3 py-1 border border-[var(--rule)] rounded hover:border-[var(--accent)]"
          >
            Reset
          </button>
          {solved && (
            <span className="text-green-700 font-medium">
              Goal reached — corners are swapped.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
