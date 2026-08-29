import { useMemo, useState } from "react";
import {
  BoardSizeControl,
  fitCell,
  useAvailableWidth,
  useBoardSize,
} from "./boardSize";

// "Where can it land?" — the drill that actually teaches the move.
//
// The knight is dropped on a square and the reader marks every square it can
// reach in one hop, then presses Check. Nothing is revealed until then: a
// board that shows the legal moves lets a reader finish every puzzle on the
// page without ever learning the L-shape, which is what this replaces.
//
// Each Next deals a fresh random square, so the drill never runs out. The
// first square is fixed rather than random, because the island is rendered
// on the server too and a random one would not survive hydration.

type Coord = [number, number];
type CellState = "empty" | "missing" | "forbidden";

interface Props {
  rows: number;
  cols: number;
  /** The opening square. Fixed, so server and browser agree. */
  first: Coord;
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

export default function KnightTargetDrill({
  rows, cols, first, missing = [], forbidden = [], title, hint,
}: Props) {
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

  const answerFor = (p: Coord) => {
    const out = new Set<string>();
    for (const [dr, dc] of KNIGHT_DELTAS) {
      const r = p[0] + dr;
      const c = p[1] + dc;
      if (landable(r, c)) out.add(keyOf(r, c));
    }
    return out;
  };

  const [knight, setKnight] = useState<Coord>(first);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const [rounds, setRounds] = useState(0);
  const [perfect, setPerfect] = useState(0);
  const [streak, setStreak] = useState(0);

  const answer = answerFor(knight);
  const wasRight =
    checked &&
    picked.size === answer.size &&
    [...picked].every((k) => answer.has(k));

  const toggle = (r: number, c: number) => {
    if (checked) return;
    if (r === knight[0] && c === knight[1]) return;
    const k = keyOf(r, c);
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const check = () => {
    if (checked || picked.size === 0) return;
    const right =
      picked.size === answer.size && [...picked].every((k) => answer.has(k));
    setChecked(true);
    setRounds((n) => n + 1);
    if (right) {
      setPerfect((n) => n + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  // A fresh square: any landable square with at least one legal move, and
  // never the one just used.
  const next = () => {
    const pool: Coord[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!landable(r, c)) continue;
        if (r === knight[0] && c === knight[1]) continue;
        if (answerFor([r, c]).size === 0) continue;
        pool.push([r, c]);
      }
    }
    if (pool.length > 0) {
      setKnight(pool[Math.floor(Math.random() * pool.length)]);
    }
    setPicked(new Set());
    setChecked(false);
  };

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
            const k = keyOf(r, c);
            const isKnight = knight[0] === r && knight[1] === c;
            const isLight = (r + c) % 2 === 0;
            const isPicked = picked.has(k);
            const inAnswer = answer.has(k);

            if (st === "missing") {
              return <div key={idx} aria-hidden="true" />;
            }

            const bg =
              st === "forbidden"
                ? "var(--sq-forbidden)"
                : isLight
                  ? "var(--sq-light)"
                  : "var(--sq-dark)";

            // After Check: right pick, wrong pick, or a square that was
            // missed altogether.
            const verdict = !checked
              ? null
              : isPicked && inAnswer
                ? "right"
                : isPicked && !inAnswer
                  ? "wrong"
                  : !isPicked && inAnswer
                    ? "missed"
                    : null;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => toggle(r, c)}
                disabled={checked || isKnight}
                aria-label={
                  isKnight
                    ? "knight"
                    : st === "forbidden"
                      ? "forbidden square"
                      : `row ${r + 1} col ${c + 1}${isPicked ? ", marked" : ""}`
                }
                aria-pressed={isKnight ? undefined : isPicked}
                style={{
                  position: "relative",
                  background: bg,
                  border: "none",
                  padding: 0,
                  cursor: checked || isKnight ? "default" : "pointer",
                  outline: isKnight ? "2px solid var(--accent)" : "none",
                  outlineOffset: -2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {st === "forbidden" && <Skull size={Math.round(cellPx * 0.4)} />}
                {isKnight && <Knight size={Math.round(cellPx * 0.6)} />}

                {/* Before Check: a neutral mark, saying nothing about
                    whether the guess is any good. */}
                {isPicked && !checked && !isKnight && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "var(--mcq-pick-soft)",
                      boxShadow: "inset 0 0 0 3px var(--mcq-pick)",
                    }}
                  />
                )}

                {verdict && !isKnight && (
                  <span
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        verdict === "wrong"
                          ? "var(--mcq-wrong-soft)"
                          : "var(--mcq-right-soft)",
                      boxShadow:
                        verdict === "missed"
                          ? "inset 0 0 0 3px var(--mcq-right)"
                          : `inset 0 0 0 3px ${
                              verdict === "wrong"
                                ? "var(--mcq-wrong)"
                                : "var(--mcq-right)"
                            }`,
                      color:
                        verdict === "wrong"
                          ? "var(--mcq-wrong)"
                          : "var(--mcq-right)",
                      fontSize: Math.round(cellPx * 0.5),
                      fontWeight: 700,
                      lineHeight: 1,
                      opacity: verdict === "missed" ? 0.85 : 1,
                    }}
                  >
                    {verdict === "wrong" ? "✕" : verdict === "right" ? "✓" : "?"}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
          <span className="text-[var(--muted)]">
            Marked: <strong className="text-[var(--ink)]">{picked.size}</strong>
          </span>
          {!checked ? (
            <>
              <button
                onClick={check}
                disabled={picked.size === 0}
                className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
              >
                Check
              </button>
              <button
                onClick={() => setPicked(new Set())}
                disabled={picked.size === 0}
                className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors disabled:opacity-40"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              onClick={next}
              className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
            >
              Next square
            </button>
          )}
          <span className="text-[var(--muted)]">
            Exactly right:{" "}
            <strong className="text-[var(--ink)]">
              {perfect} of {rounds}
            </strong>
            {streak >= 3 && (
              <strong style={{ color: "var(--accent)" }}> · {streak} in a row</strong>
            )}
          </span>
          <BoardSizeControl sizeKey={sizeKey} onChange={setSizeKey} />
        </div>

        {checked && (
          <p
            className="text-sm font-medium text-center"
            style={{ color: wasRight ? "var(--mcq-right)" : "var(--mcq-wrong)" }}
          >
            {wasRight
              ? `All ${answer.size} of them, and nothing else.`
              : `Not quite. The knight has ${answer.size} ${
                  answer.size === 1 ? "square" : "squares"
                } to land on here: a tick marks one you found, a question mark one you missed, a cross a square the knight cannot reach.`}
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
