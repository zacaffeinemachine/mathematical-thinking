import { useEffect, useMemo, useState } from "react";

// Sliding-block 15 puzzle. Slots are indexed 0..15 in reading order
// (top-left = 0, bottom-right = 15). The tile array stores, for each
// slot, the tile-number sitting there; tile 0 represents the blank.

interface FifteenPuzzleProps {
  // Initial tile arrangement, in reading order, with 0 meaning blank.
  // If omitted, defaults to the "Loyd" 14-15 swap.
  initial?: number[];
  // Display label shown beneath the board.
  caption?: string;
  // Show/hide the secondary controls (Solved / 14-15 / Scramble / Reset).
  controls?: boolean;
  // Compare against this configuration to flag "solved" status. If
  // omitted, the solved arrangement [1..15, 0] is used.
  target?: number[];
}

const SOLVED: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 0];
const LOYD: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 0];
const SCRAMBLED_2156: number[] = [
  // Cycle (1, 2, 6, 5): tile 2 in slot 0, tile 6 in slot 1, tile 5 in slot 4, tile 1 in slot 5
  2, 6, 3, 4,
  5, 1, 7, 8,
  9, 10, 11, 12,
  13, 14, 15, 0,
];

function eq(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function neighbors(slot: number): number[] {
  const r = Math.floor(slot / 4), c = slot % 4;
  const out: number[] = [];
  if (r > 0) out.push(slot - 4);
  if (r < 3) out.push(slot + 4);
  if (c > 0) out.push(slot - 1);
  if (c < 3) out.push(slot + 1);
  return out;
}

export default function FifteenPuzzle({
  initial = LOYD,
  caption,
  controls = true,
  target = SOLVED,
}: FifteenPuzzleProps) {
  const [tiles, setTiles] = useState<number[]>(initial);
  const [moves, setMoves] = useState<number>(0);

  // If the parent swaps the `initial` prop in, restart from there.
  useEffect(() => {
    setTiles(initial);
    setMoves(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial.join(",")]);

  const blankSlot = useMemo(() => tiles.indexOf(0), [tiles]);
  const solved = useMemo(() => eq(tiles, target), [tiles, target]);
  const movableSlots = useMemo(() => new Set(neighbors(blankSlot)), [blankSlot]);

  function clickSlot(slot: number) {
    if (!movableSlots.has(slot)) return;
    setTiles((cur) => {
      const next = cur.slice();
      next[blankSlot] = cur[slot];
      next[slot] = 0;
      return next;
    });
    setMoves((m) => m + 1);
  }

  function load(arr: number[]) {
    setTiles(arr);
    setMoves(0);
  }

  // Light random scramble: 60 random legal slides from the solved board.
  function scramble() {
    const start = SOLVED.slice();
    let bs = start.indexOf(0);
    let prev = -1;
    for (let i = 0; i < 60; i++) {
      const opts = neighbors(bs).filter((s) => s !== prev);
      const pick = opts[Math.floor(Math.random() * opts.length)];
      [start[bs], start[pick]] = [start[pick], start[bs]];
      prev = bs;
      bs = pick;
    }
    load(start);
  }

  // Tile size and gaps tuned for a comfortable inline board.
  const SIZE = 64;
  const GAP = 4;
  const W = 4 * SIZE + 5 * GAP;

  return (
    <div style={{ margin: "20px auto", maxWidth: W }}>
      <div
        role="grid"
        aria-label="15 puzzle"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(4, ${SIZE}px)`,
          gridTemplateRows: `repeat(4, ${SIZE}px)`,
          gap: GAP,
          padding: GAP,
          background: "var(--rule)",
          borderRadius: 8,
          width: W,
          margin: "0 auto",
          userSelect: "none",
        }}
      >
        {tiles.map((t, slot) => {
          const isBlank = t === 0;
          const movable = movableSlots.has(slot) && !isBlank;
          const correct = !isBlank && t === target[slot];
          const bg = isBlank
            ? "transparent"
            : correct
            ? "var(--accent-soft)"
            : "var(--surface)";
          const border = isBlank
            ? "1px dashed var(--rule)"
            : correct
            ? "1px solid var(--accent)"
            : "1px solid var(--gate-ink)";
          return (
            <div
              key={slot}
              role="gridcell"
              onClick={() => clickSlot(slot)}
              style={{
                width: SIZE,
                height: SIZE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontSize: 22,
                fontWeight: 700,
                color: correct ? "var(--accent)" : "var(--ink)",
                background: bg,
                border,
                borderRadius: 6,
                cursor: movable ? "pointer" : "default",
                boxShadow: movable
                  ? "0 1px 0 var(--rule), inset 0 0 0 1px var(--accent-soft)"
                  : "none",
                transition: "transform 80ms ease, background 120ms ease",
                transform: movable ? "translateY(-1px)" : "none",
              }}
            >
              {isBlank ? "" : t}
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 12,
          flexWrap: "wrap",
          fontFamily: "ui-sans-serif, system-ui",
          fontSize: 13,
          color: "var(--muted)",
        }}
      >
        <span>moves: <strong style={{ color: "var(--ink)" }}>{moves}</strong></span>
        <span style={{ color: solved ? "var(--accent)" : "var(--muted)" }}>
          {solved ? "✓ solved" : ""}
        </span>
        {controls && (
          <>
            <span style={{ flexBasis: "100%", height: 0 }} />
            <button onClick={() => load(SOLVED)} style={btn}>Solved</button>
            <button onClick={() => load(LOYD)} style={btn}>14–15 swap</button>
            <button onClick={() => load(SCRAMBLED_2156)} style={btn}>4-cycle (1,2,6,5)</button>
            <button onClick={scramble} style={btn}>Scramble</button>
            <button onClick={() => load(initial)} style={btn}>Reset</button>
          </>
        )}
      </div>

      {caption && (
        <div
          style={{
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: "4px 12px",
  fontSize: 12,
  border: "1px solid var(--rule)",
  borderRadius: 4,
  background: "var(--surface)",
  color: "var(--ink)",
  cursor: "pointer",
  fontFamily: "ui-sans-serif, system-ui",
};
