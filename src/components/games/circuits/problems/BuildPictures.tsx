// Static pictures for logic-gates/build-it ("Build It Yourself"): a die with
// its dots wired in groups, the faces it must show, and the digits of a
// seven-bar display. Render with NO client directive.

import { dieGroups, DIGIT_BARS } from "./banks/build-it.ts";

// ---- the die -------------------------------------------------------------------

// Dot centres in a 60 x 60 face, and the group each dot belongs to.
//   A: the diagonal pair that shows two     B: the other diagonal pair
//   C: the middle pair of the outer columns M: the middle dot
const DOTS: { x: number; y: number; group: "A" | "B" | "C" | "M" }[] = [
  { x: 48, y: 12, group: "A" }, { x: 12, y: 48, group: "A" },
  { x: 12, y: 12, group: "B" }, { x: 48, y: 48, group: "B" },
  { x: 12, y: 30, group: "C" }, { x: 48, y: 30, group: "C" },
  { x: 30, y: 30, group: "M" },
];

const face = { fill: "var(--surface)", stroke: "var(--gate-ink)", strokeWidth: 1.6 };

// The die with every dot labelled by its group.
export function DieGroupsPicture() {
  return (
    <svg viewBox="-4 -4 68 68" width="150" height="150" role="img" aria-label="a die face with seven dots in four groups, A, B, C and M" style={{ display: "block", margin: "8px 0" }}>
      <rect x="0" y="0" width="60" height="60" rx="9" {...face} />
      {DOTS.map((d, k) => (
        <g key={k}>
          <circle cx={d.x} cy={d.y} r="6.2" fill="var(--bulb-lit, #f5c518)" stroke="var(--gate-ink)" strokeWidth="1" />
          <text x={d.x} y={d.y + 2.6} fontSize="7.5" fontWeight="700" textAnchor="middle" fill="var(--gate-ink)" fontFamily="ui-monospace, monospace">{d.group}</text>
        </g>
      ))}
    </svg>
  );
}

// The faces for 0 to 7: what the die must show for each number.
export function DieFaces() {
  return (
    <div className="not-prose" style={{ display: "flex", flexWrap: "wrap", gap: "10px 14px", margin: "8px 0 12px" }}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => {
        const on = dieGroups(n);
        return (
          <figure key={n} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <svg viewBox="-3 -3 66 66" width="46" height="46" role="img" aria-label={`the die showing ${n}`}>
              <rect x="0" y="0" width="60" height="60" rx="9" {...face} />
              {DOTS.filter((d) => on[d.group]).map((d, k) => <circle key={k} cx={d.x} cy={d.y} r="6" fill="var(--gate-ink)" />)}
            </svg>
            <figcaption style={{ fontSize: 13, fontFamily: "ui-monospace, monospace" }}>{n}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ---- a seven-bar display ------------------------------------------------------------

// Bars a to g, the usual names: a top, b top right, c bottom right, d bottom,
// e bottom left, f top left, g middle.
const BARS: Record<string, [number, number, number, number]> = {
  a: [7, 3, 23, 3], b: [27, 7, 27, 22], c: [27, 28, 27, 43], d: [7, 47, 23, 47],
  e: [3, 28, 3, 43], f: [3, 7, 3, 22], g: [7, 25, 23, 25],
};

// The digits 0 to 9, with the bar `mark` drawn in the accent colour wherever
// it is lit.
export function DigitsPicture({ mark }: { mark: string }) {
  return (
    <div className="not-prose" style={{ display: "flex", flexWrap: "wrap", gap: "8px 12px", margin: "8px 0 12px" }}>
      {DIGIT_BARS.map((lit, n) => (
        <figure key={n} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <svg viewBox="-3 -3 36 56" width="30" height="47" role="img" aria-label={`the digit ${n}`}>
            {Object.entries(BARS).map(([bar, [x1, y1, x2, y2]]) => {
              const on = lit.includes(bar);
              return (
                <line key={bar} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="4.2" strokeLinecap="round"
                  stroke={on ? (bar === mark ? "var(--accent)" : "var(--gate-ink)") : "var(--rule)"} />
              );
            })}
          </svg>
          <figcaption style={{ fontSize: 13, fontFamily: "ui-monospace, monospace" }}>{n}</figcaption>
        </figure>
      ))}
    </div>
  );
}
