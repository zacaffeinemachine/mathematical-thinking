import { useEffect, useMemo, useRef, useState } from "react";
import {
  BoardSizeControl,
  fitCell,
  useAvailableWidth,
  useBoardSize,
} from "./boardSize";

// The knight-navigation puzzle.
//
// Deliberately gives away nothing. There is no "legal moves" display: the
// reader clicks the square they believe the knight can reach, and a wrong
// click bounces off with a red flash and a tick on the wrong-tries counter.
// Reading dots off the board taught nobody the L-shape; aiming, missing and
// aiming again does.
//
// Two further devices carry the harder boards:
//   • par (shortest route, BFS) is revealed only AFTER the board is solved,
//     so it never leaks that a board is impossible;
//   • every board carries a "Say it is impossible" button, unlocked after a
//     few attempts. Some boards really are impossible, and calling one is a
//     win — the first taste of the argument Guarini's puzzle needs.

type Coord = [number, number];
type CellState = "empty" | "missing" | "forbidden";

interface Props {
  rows: number;
  cols: number;
  start: Coord;
  /** A single apple. */
  target?: Coord;
  /** Several apples, to be collected in any order. Overrides `target`. */
  targets?: Coord[];
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

// Attempts (moves + wrong tries) before the impossibility claim unlocks.
// A reader who has not tried anything has not earned the guess.
const CLAIM_AFTER = 6;

interface Snapshot {
  pos: Coord;
  mask: number; // bit i set ⇔ apple i already collected
}

export default function KnightPuzzle({
  rows, cols, start, target, targets, missing = [], forbidden = [], title, hint,
}: Props) {
  const apples: Coord[] = useMemo(
    () => targets ?? (target ? [target] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(targets ?? target ?? null)],
  );
  const FULL = (1 << apples.length) - 1;

  const missingSet = useMemo(
    () => new Set(missing.map(([r, c]) => keyOf(r, c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(missing)],
  );
  const forbiddenSet = useMemo(
    () => new Set(forbidden.map(([r, c]) => keyOf(r, c))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(forbidden)],
  );

  const cellState = (r: number, c: number): CellState => {
    if (missingSet.has(keyOf(r, c))) return "missing";
    if (forbiddenSet.has(keyOf(r, c))) return "forbidden";
    return "empty";
  };

  const landable = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && cellState(r, c) === "empty";

  // Which apples sit on this square (bit mask).
  const applesAt = (r: number, c: number) =>
    apples.reduce(
      (m, [ar, ac], i) => (ar === r && ac === c ? m | (1 << i) : m),
      0,
    );

  const initial: Snapshot = {
    pos: start,
    mask: applesAt(start[0], start[1]),
  };

  const [hist, setHist] = useState<Snapshot[]>([initial]);
  const [wrong, setWrong] = useState(0);
  const [bad, setBad] = useState<string | null>(null);
  const [claim, setClaim] = useState<null | "right" | "wrong">(null);

  const badTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (badTimer.current !== null) window.clearTimeout(badTimer.current);
    },
    [],
  );

  const cur = hist[hist.length - 1];
  const moves = hist.length - 1;
  const collected = apples.filter((_, i) => (cur.mask >> i) & 1).length;
  const solved = apples.length > 0 && cur.mask === FULL;
  const finished = solved || claim === "right";

  // Shortest route, over states (square, apples collected). Never shown
  // before the board is solved.
  const par = useMemo<number | null>(() => {
    if (apples.length === 0) return null;
    const stateId = (r: number, c: number, m: number) =>
      (r * cols + c) * (FULL + 1) + m;
    const seen = new Set<number>();
    let frontier: Snapshot[] = [initial];
    seen.add(stateId(start[0], start[1], initial.mask));
    let d = 0;
    while (frontier.length > 0) {
      const next: Snapshot[] = [];
      for (const s of frontier) {
        if (s.mask === FULL) return d;
        for (const [dr, dc] of KNIGHT_DELTAS) {
          const r = s.pos[0] + dr;
          const c = s.pos[1] + dc;
          if (!landable(r, c)) continue;
          const m = s.mask | applesAt(r, c);
          const id = stateId(r, c, m);
          if (seen.has(id)) continue;
          seen.add(id);
          next.push({ pos: [r, c], mask: m });
        }
      }
      frontier = next;
      d += 1;
    }
    return null; // unreachable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, cols, apples, missingSet, forbiddenSet, start[0], start[1]]);

  const isKnightMove = (r: number, c: number) => {
    const dr = r - cur.pos[0];
    const dc = c - cur.pos[1];
    return KNIGHT_DELTAS.some(([a, b]) => a === dr && b === dc);
  };

  const flashWrong = (k: string) => {
    setBad(k);
    setWrong((w) => w + 1);
    if (badTimer.current !== null) window.clearTimeout(badTimer.current);
    badTimer.current = window.setTimeout(() => setBad(null), 420);
  };

  const handleClick = (r: number, c: number) => {
    if (finished) return;
    if (r === cur.pos[0] && c === cur.pos[1]) return;
    if (isKnightMove(r, c) && landable(r, c)) {
      setClaim(null);
      setHist((h) => [
        ...h,
        { pos: [r, c], mask: h[h.length - 1].mask | applesAt(r, c) },
      ]);
    } else {
      flashWrong(keyOf(r, c));
    }
  };

  const undo = () => {
    setClaim(null);
    setHist((h) => (h.length > 1 ? h.slice(0, -1) : h));
  };

  const reset = () => {
    setHist([initial]);
    setWrong(0);
    setBad(null);
    setClaim(null);
  };

  const claimImpossible = () => setClaim(par === null ? "right" : "wrong");

  // Last step at which the knight stood on each square, for the faint trail.
  const trail = new Map<string, number>();
  hist.forEach((s, i) => trail.set(keyOf(s.pos[0], s.pos[1]), i));

  const { sizeKey, factor, setSizeKey } = useBoardSize();
  const { ref: sizerRef, width: availWidth } = useAvailableWidth<HTMLDivElement>();
  const cellPx = fitCell(Math.round(56 * factor), cols, availWidth);

  return (
    <figure className="not-prose my-10">
      {title && (
        <figcaption className="text-sm font-medium mb-1">{title}</figcaption>
      )}
      {hint && <p className="text-sm text-[var(--muted)] mb-4">{hint}</p>}

      <div ref={sizerRef} className="flex flex-col items-center gap-5">
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
            const isKnight = cur.pos[0] === r && cur.pos[1] === c;
            const appleBits = applesAt(r, c);
            const hasApple = appleBits !== 0 && (cur.mask & appleBits) !== appleBits;
            const isLight = (r + c) % 2 === 0;
            const isBad = bad === keyOf(r, c);
            const step = trail.get(keyOf(r, c));

            if (st === "missing") {
              return <div key={idx} aria-hidden="true" />;
            }

            const bg =
              st === "forbidden"
                ? "var(--sq-forbidden)"
                : isLight
                  ? "var(--sq-light)"
                  : "var(--sq-dark)";

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleClick(r, c)}
                disabled={finished || isKnight}
                aria-label={
                  isKnight
                    ? "knight"
                    : hasApple
                      ? "apple"
                      : st === "forbidden"
                        ? "forbidden square"
                        : `row ${r + 1} col ${c + 1}`
                }
                style={{
                  position: "relative",
                  background: bg,
                  border: "none",
                  padding: 0,
                  cursor: finished || isKnight ? "default" : "pointer",
                  outline: isKnight ? "2px solid var(--accent)" : "none",
                  outlineOffset: -2,
                  transition: "background 120ms",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                }}
              >
                {st === "forbidden" && (
                  <Skull size={Math.round(cellPx * 0.4)} />
                )}

                {hasApple && !isKnight && (
                  <span
                    aria-hidden="true"
                    style={{ fontSize: Math.round(cellPx * 0.46), lineHeight: 1 }}
                  >
                    🍎
                  </span>
                )}

                {isKnight && <Knight size={Math.round(cellPx * 0.6)} />}

                {/* Faint numbered trail of the route taken so far. */}
                {step !== undefined && step > 0 && !isKnight && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      right: 3,
                      bottom: 1,
                      fontSize: Math.round(cellPx * 0.24),
                      lineHeight: 1,
                      fontWeight: 600,
                      color: "var(--piece)",
                      opacity: 0.45,
                    }}
                  >
                    {step}
                  </span>
                )}

                {/* A wrong click bounces: red wash and a cross. */}
                {isBad && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--mcq-wrong-soft)",
                      boxShadow: "inset 0 0 0 3px var(--mcq-wrong)",
                      color: "var(--mcq-wrong)",
                      fontSize: Math.round(cellPx * 0.5),
                      fontWeight: 700,
                      lineHeight: 1,
                    }}
                  >
                    ✕
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
          <span className="text-[var(--muted)]">
            Moves: <strong className="text-[var(--ink)]">{moves}</strong>
          </span>
          <span className="text-[var(--muted)]">
            Wrong tries: <strong className="text-[var(--ink)]">{wrong}</strong>
          </span>
          {apples.length > 1 && (
            <span className="text-[var(--muted)]">
              Apples:{" "}
              <strong className="text-[var(--ink)]">
                {collected} of {apples.length}
              </strong>
            </span>
          )}
          <button
            onClick={undo}
            disabled={moves === 0 || finished}
            className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
          >
            Undo
          </button>
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
          >
            Reset
          </button>
          {!finished && moves + wrong >= CLAIM_AFTER && (
            <button
              onClick={claimImpossible}
              className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
            >
              Say it is impossible
            </button>
          )}
          <BoardSizeControl sizeKey={sizeKey} onChange={setSizeKey} />
        </div>

        {solved && (
          <p className="text-sm font-medium text-center" style={{ color: "var(--accent)" }}>
            {apples.length > 1
              ? `All ${apples.length} apples collected in ${moves} moves.`
              : `Apple reached in ${moves} ${moves === 1 ? "move" : "moves"}.`}{" "}
            {par !== null &&
              (moves === par
                ? "No route is shorter than that."
                : `The shortest route takes ${par}. Reset and hunt for it.`)}
          </p>
        )}

        {claim === "right" && (
          <p className="text-sm font-medium text-center" style={{ color: "var(--accent)" }}>
            Correct. There is no route at all. No number of moves would do it.
          </p>
        )}

        {claim === "wrong" && (
          <p className="text-sm text-center" style={{ color: "var(--mcq-wrong)" }}>
            There is a route. Keep looking.
          </p>
        )}
      </div>
    </figure>
  );
}

function Knight({ size = 34 }: { size?: number }) {
  // Minimal chess knight silhouette.
  return (
    <svg
      width={size}
      height={size}
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

function Skull({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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
