import { useMemo, useState } from "react";

type Coord = [number, number];
type CellState = "empty" | "missing" | "forbidden";

interface Props {
  rows: number;
  cols: number;
  start: Coord;
  target: Coord;
  missing?: Coord[];
  forbidden?: Coord[];
  title?: string;
  hint?: string;
}

const KNIGHT_DELTAS: Coord[] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const keyOf = (r: number, c: number) => `${r},${c}`;

export default function KnightPuzzle({
  rows, cols, start, target, missing = [], forbidden = [], title, hint,
}: Props) {
  const missingSet = useMemo(
    () => new Set(missing.map(([r, c]) => keyOf(r, c))),
    [missing],
  );
  const forbiddenSet = useMemo(
    () => new Set(forbidden.map(([r, c]) => keyOf(r, c))),
    [forbidden],
  );

  const [pos, setPos] = useState<Coord>(start);
  const [moves, setMoves] = useState(0);
  const [selected, setSelected] = useState(true); // start pre-selected as a hint

  const cellState = (r: number, c: number): CellState => {
    if (missingSet.has(keyOf(r, c))) return "missing";
    if (forbiddenSet.has(keyOf(r, c))) return "forbidden";
    return "empty";
  };

  const isLegalMove = (r: number, c: number) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    const st = cellState(r, c);
    if (st !== "empty") return false;
    const dr = r - pos[0];
    const dc = c - pos[1];
    return KNIGHT_DELTAS.some(([a, b]) => a === dr && b === dc);
  };

  const solved = pos[0] === target[0] && pos[1] === target[1];

  const handleClick = (r: number, c: number) => {
    if (solved) return;
    if (r === pos[0] && c === pos[1]) {
      setSelected((s) => !s);
      return;
    }
    if (selected && isLegalMove(r, c)) {
      setPos([r, c]);
      setMoves((m) => m + 1);
      setSelected(true);
    }
  };

  const reset = () => {
    setPos(start);
    setMoves(0);
    setSelected(true);
  };

  const cellPx = 56;

  return (
    <figure className="not-prose my-10">
      {title && (
        <figcaption className="text-sm font-medium mb-1">{title}</figcaption>
      )}
      {hint && (
        <p className="text-sm text-[var(--muted)] mb-4">{hint}</p>
      )}

      <div className="flex flex-col items-center gap-5">
        <div
          className="rounded-xl"
          style={{
            padding: 8,
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
            gridTemplateRows: `repeat(${rows}, ${cellPx}px)`,
            gap: 0,
            width: cols * cellPx + 16,
            maxWidth: "95vw",
          }}
        >
          {Array.from({ length: rows * cols }, (_, idx) => {
            const r = Math.floor(idx / cols);
            const c = idx % cols;
            const st = cellState(r, c);
            const isKnight = pos[0] === r && pos[1] === c;
            const isTarget = target[0] === r && target[1] === c;
            const isLight = (r + c) % 2 === 0;
            const isLegal = selected && isLegalMove(r, c);

            if (st === "missing") {
              return <div key={idx} aria-hidden="true" />;
            }

            const bg =
              st === "forbidden"
                ? "var(--sq-forbidden)"
                : isLight
                  ? "var(--sq-light)"
                  : "var(--sq-dark)";

            const interactive =
              st === "empty" && !solved && (isKnight || isLegal);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleClick(r, c)}
                disabled={!interactive}
                aria-label={
                  isKnight
                    ? "knight"
                    : isTarget
                      ? "target (apple)"
                      : st === "forbidden"
                        ? "forbidden square"
                        : `row ${r + 1} col ${c + 1}`
                }
                style={{
                  position: "relative",
                  background: bg,
                  border: "none",
                  padding: 0,
                  cursor: interactive ? "pointer" : "default",
                  outline: isKnight && selected ? "2px solid var(--accent)" : "none",
                  outlineOffset: -2,
                  transition: "background 120ms, outline 120ms",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                {st === "forbidden" && <Skull />}

                {isTarget && !isKnight && (
                  <span aria-hidden="true" style={{ fontSize: 26, lineHeight: 1 }}>
                    🍎
                  </span>
                )}

                {isKnight && <Knight />}

                {isLegal && !isKnight && (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "var(--accent)",
                      opacity: 0.55,
                      position: "absolute",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-sm">
          <span className="text-[var(--muted)]">
            Moves: <strong className="text-[var(--ink)]">{moves}</strong>
          </span>
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
          >
            Reset
          </button>
          {solved && (
            <span className="font-medium" style={{ color: "var(--accent)" }}>
              Apple reached in {moves} {moves === 1 ? "move" : "moves"}.
            </span>
          )}
        </div>
      </div>
    </figure>
  );
}

function Knight() {
  // Minimal chess knight silhouette.
  return (
    <svg
      width="34"
      height="34"
      viewBox="0 0 45 45"
      aria-hidden="true"
      style={{ color: "var(--piece)" }}
    >
      <g
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22,10 C32.5,11 38.5,18 38,39 L15,39 C15,30 25,32.5 23,18" />
        <path d="M24,18 C24.38,20.91 18.45,25.37 16,27 C13,29 13.18,31.34 11,31 C9.958,30.06 12.41,27.96 11,28 C10,28 11.19,29.23 10,30 C9,30 5.997,31 6,26 C6,24 12,14 12,14 C12,14 13.89,12.1 14,10.5 C13.27,9.506 13.5,8.5 13.5,7.5 C14.5,5.5 16.5,4 16.5,4 C16.5,4 18.5,4 19,5 L20,5 C20,5 22,8 22,10" />
        <path
          d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
          fill="var(--surface)"
          stroke="var(--surface)"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

function Skull() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ color: "#a1a1aa" }}
    >
      <g fill="currentColor">
        <path d="M12 2C7.6 2 4 5.6 4 10c0 2.3 1 4.4 2.5 5.8V18c0 .6.4 1 1 1h1v2h1v-2h5v2h1v-2h1c.6 0 1-.4 1-1v-2.2c1.5-1.4 2.5-3.5 2.5-5.8 0-4.4-3.6-8-8-8zm-3 9a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-4.5 4h3v-2h-3v2z" />
      </g>
    </svg>
  );
}
