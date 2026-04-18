import { useMemo, useState } from "react";

// Board indices:
//   0 1 2
//   3 4 5
//   6 7 8
// Knight-move adjacency on 3x3 (center 4 is isolated — no knight move lands there):
const MOVES: Record<number, number[]> = {
  0: [5, 7],
  1: [6, 8],
  2: [3, 7],
  3: [2, 8],
  4: [],
  5: [0, 6],
  6: [1, 5],
  7: [0, 2],
  8: [1, 3],
};

type Piece = "W" | "B" | null;

const START: Piece[] = ["W", null, "W", null, null, null, "B", null, "B"];
const GOAL: Piece[]  = ["B", null, "B", null, null, null, "W", null, "W"];

function boardsEqual(a: Piece[], b: Piece[]) {
  return a.every((v, i) => v === b[i]);
}

export default function GuariniBoard() {
  const [board, setBoard] = useState<Piece[]>(START);
  const [selected, setSelected] = useState<number | null>(null);
  const [moveCount, setMoveCount] = useState(0);

  const legalTargets = useMemo(() => {
    if (selected === null) return new Set<number>();
    return new Set(MOVES[selected].filter((i) => board[i] === null));
  }, [selected, board]);

  const solved = boardsEqual(board, GOAL);

  function handleClick(i: number) {
    if (solved) return;
    if (selected === null) {
      if (board[i]) setSelected(i);
      return;
    }
    if (i === selected) {
      setSelected(null);
      return;
    }
    if (legalTargets.has(i)) {
      const next = [...board];
      next[i] = board[selected];
      next[selected] = null;
      setBoard(next);
      setSelected(null);
      setMoveCount((n) => n + 1);
    } else if (board[i]) {
      setSelected(i);
    } else {
      setSelected(null);
    }
  }

  function reset() {
    setBoard(START);
    setSelected(null);
    setMoveCount(0);
  }

  return (
    <div className="not-prose my-8 flex flex-col items-center gap-4">
      <div className="text-sm text-[var(--muted)]">
        Swap the white and black knights. Click a knight, then a highlighted square.
      </div>

      <div
        className="grid grid-cols-3 gap-1 p-2 bg-[var(--rule)] rounded-lg"
        style={{ width: "min(320px, 90vw)" }}
      >
        {board.map((cell, i) => {
          const isLight = (Math.floor(i / 3) + (i % 3)) % 2 === 0;
          const isSelected = selected === i;
          const isLegal = legalTargets.has(i);
          return (
            <button
              key={i}
              onClick={() => handleClick(i)}
              className={[
                "aspect-square flex items-center justify-center text-4xl font-semibold transition-all rounded",
                isLight ? "bg-[#f0ece2]" : "bg-[#c9bfa8]",
                isSelected ? "ring-4 ring-[var(--accent)]" : "",
                isLegal ? "ring-2 ring-green-600/70" : "",
                cell || isLegal ? "cursor-pointer" : "cursor-default",
              ].join(" ")}
              aria-label={`square ${i}${cell ? `, ${cell === "W" ? "white" : "black"} knight` : ""}`}
            >
              {cell === "W" && <span style={{ color: "#1a1a1a" }}>♘</span>}
              {cell === "B" && <span style={{ color: "#8b2c2c" }}>♞</span>}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="text-[var(--muted)]">Moves: <strong>{moveCount}</strong></span>
        <button
          onClick={reset}
          className="px-3 py-1 border border-[var(--rule)] rounded hover:border-[var(--accent)]"
        >
          Reset
        </button>
        {solved && (
          <span className="text-green-700 font-medium">
            Solved in {moveCount} moves!
          </span>
        )}
      </div>
    </div>
  );
}
