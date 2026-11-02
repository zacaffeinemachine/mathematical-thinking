import { useEffect, useState } from "react";
import { diagonalPair, diagonalPlace, ordinal, shellOf, shellPair, shellPlace } from "./listing";
import type { Order, Pair } from "./listing";
import { Controls, FrogStyle, PairGrid, useNarrow } from "./parts";
import { useTimeline } from "./useTimeline";

// =====================================================================
//  "A second way to make the list" (Chapters/Infinity.tex), drawn on the
//  same grid as the diagonals so the two can be watched side by side.
//
//  Both walks take one pair per time. The shaded cells are the diagonal,
//  or the L-shaped shell, that the walk is on. The run stops at time 36,
//  when the square-corner walk has finished the 6th shell and so the whole
//  6 by 6 square of the picture.
//
//  ?tlT=9 opens at time 9, for screenshots.
// =====================================================================

const S = 6;
const MAXT = S * S;
const SPEEDS = [0.5, 1, 2, 4];

const at = (o: Order, n: number) => (o === "diagonal" ? diagonalPair(n) : shellPair(n));
const isNeighbour = (a: Pair, b: Pair) => Math.abs(a.d - b.d) + Math.abs(a.k - b.k) === 1;

function caption(n: number): string {
  if (n === 0) return "Two lists of the same grid of pairs. Press play to walk both at once, one pair per time.";
  const dg = diagonalPair(n);
  const sh = shellPair(n);
  const s = dg.d + dg.k;
  const m = shellOf(sh);
  if (n === MAXT) {
    return (
      `Time ${n}. The square-corner walk has covered the whole ${S} by ${S} square of the picture. ` +
      `The diagonal walk has covered every pair whose two numbers add up to ${s} or less, some of them outside the picture. ` +
      "Each list reaches every pair, each at its own time."
    );
  }
  const out: string[] = [`Time ${n}.`];
  // The diagonals.
  if (n > 1 && dg.k === 1 && !isNeighbour(diagonalPair(n - 1), dg)) {
    out.push("The diagonal walk has reached the end of a diagonal and leaps back across the grid to start the next one.");
  } else if (dg.d === 1) {
    out.push(`The diagonal walk has finished the diagonal of pairs whose numbers add up to ${s}. It held ${s - 1} ${s - 1 === 1 ? "pair" : "pairs"}.`);
  } else {
    out.push(`The diagonal walk is on the diagonal of pairs whose numbers add up to ${s}.`);
  }
  // The square corners.
  if (n === m * m) {
    const odds = Array.from({ length: m }, (_, i) => 2 * i + 1);
    out.push(
      m === 1
        ? "The 1st shell of the square-corner walk is just the pair (1, 1), so it is finished at time 1."
        : `In the square-corner walk, the first ${m} shells hold ${odds.join(" + ")} = ${n} pairs between them, so the ${ordinal(m)} shell is finished exactly at time ${n}.`,
    );
  } else if (n === (m - 1) * (m - 1) + 1) {
    out.push(`The square-corner walk steps to the spot next to where the last shell ended, and starts the ${ordinal(m)} shell, the pairs whose larger entry is ${m}.`);
  } else {
    out.push(`The square-corner walk is on the ${ordinal(m)} shell, the pairs whose larger entry is ${m}.`);
  }
  return out.join(" ");
}

export default function TwoListsExplainer() {
  const tl = useTimeline({ max: MAXT, dur: 620, hold: 900, speeds: SPEEDS });
  const { n, p } = tl;
  const [query, setQuery] = useState<Pair | null>(null);
  const narrow = useNarrow();

  useEffect(() => {
    const t = parseInt(new URLSearchParams(window.location.search).get("tlT") ?? "", 10);
    if (t >= 0) tl.jump(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const panel = (order: Order, title: string) => {
    const cur = n >= 1 ? at(order, n) : null;
    return (
      <div style={{ flex: "1 1 250px", minWidth: 0 }}>
        <div style={{ fontWeight: 600, textAlign: "center", marginTop: 4 }}>{title}</div>
        <PairGrid
          order={order}
          W={S}
          H={S}
          n={n}
          p={p}
          query={query}
          onCell={setQuery}
          shadeGroup
          fs={narrow ? 1.25 : 1.35}
          label={`${title}, time ${n}.${cur ? ` The current pair is (${cur.d}, ${cur.k}).` : ""}`}
        />
        <div className="fx-num" style={{ textAlign: "center", fontSize: 14, color: "var(--muted)", minHeight: "1.5em" }}>
          {cur ? (
            <>
              {`time ${n}: `}
              <span className="fx-gold">{`(${cur.d}, ${cur.k})`}</span>
              {cur.d > S || cur.k > S ? ", off the edge of the picture" : ""}
            </>
          ) : (
            "before the clock"
          )}
        </div>
      </div>
    );
  };

  const qd = query ? diagonalPlace(query) : 0;
  const qs = query ? shellPlace(query) : 0;

  return (
    <div
      className="frogx not-prose"
      tabIndex={0}
      onKeyDown={tl.onKeyDown}
      aria-label="Two ways to list the pairs, side by side. Right and Left arrows step, Space plays or pauses, Home resets."
    >
      <FrogStyle />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px", padding: "8px 8px 4px" }}>
        {panel("diagonal", "Along the diagonals")}
        {panel("shell", "Around square corners")}
      </div>
      <div className="fx-cap" aria-live="polite">
        <div>{caption(n)}</div>
      </div>
      <Controls tl={tl} speeds={SPEEDS} timeText={n === 0 ? "before the clock" : `time ${n}`} canNext={n < MAXT} />
      <div className="fx-ask" aria-live="polite">
        {query ? (
          <>
            <div>{`The pair (${query.d}, ${query.k}) comes at time ${qd} along the diagonals and at time ${qs} around the square corners.`}</div>
            <div className="fx-group" style={{ marginTop: 8 }}>
              <button type="button" className="fx-btn" onClick={() => tl.jump(Math.min(qd, MAXT))} disabled={qd > MAXT}>
                {qd > MAXT ? `Time ${qd} is past the end of this run` : `Go to time ${qd}`}
              </button>
              <button type="button" className="fx-btn" onClick={() => tl.jump(qs)}>
                {`Go to time ${qs}`}
              </button>
            </div>
          </>
        ) : (
          <span style={{ color: "var(--muted)" }}>Tap any pair in either grid to see when each list reaches it.</span>
        )}
      </div>
    </div>
  );
}
