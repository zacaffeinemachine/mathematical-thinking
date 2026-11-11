// A sum written out the way it is done on paper, in switches and bulbs: the
// first number on a row of switches a_(n-1) ... a_0, the second on a row
// b_(n-1) ... b_0 below it with a "+", a rule, and the sum on a row of bulbs
// s_n ... s_0, so that a_i, b_i and s_i share a column. The sum is computed
// here from the two rows, so the picture cannot show a wrong total.
// Static: it ships no JavaScript.

import type { Bit } from "../model";
import { BulbGlyph, MONO, SwitchGlyph } from "./glyphs";

const SUB = ["₀", "₁", "₂", "₃", "₄", "₅"];

export default function AdditionPicture({ a, b, caption }: { a: string; b: string; caption?: string }) {
  const n = a.length;
  const val = (s: string) => [...s].reduce((v, ch) => 2 * v + (ch === "1" ? 1 : 0), 0);
  const total = val(a) + val(b);
  const bit = (s: string, i: number) => (s[n - 1 - i] === "1" ? 1 : 0) as Bit;  // i counts from the right
  const COL = 78;
  const x = (c: number) => 46 + c * COL;          // column 0 is the carry column
  const W = x(n) + 34, H = 182;
  const yA = 26, yB = 76, yRule = 106, yS = 138;
  return (
    <figure style={{ display: "inline-block", margin: "6px 10px 6px 0", verticalAlign: "top", textAlign: "center" }}>
      <svg viewBox={`0 0 ${W} ${H - 20}`} width={W} height={H - 20} style={{ maxWidth: "100%", height: "auto", display: "block" }} role="img"
        aria-label={`${val(a)} plus ${val(b)} is ${total}, written in switches and bulbs`}>
        {Array.from({ length: n }, (_, k) => {
          const i = n - 1 - k, c = k + 1;
          return (
            <g key={`ab${i}`}>
              <SwitchGlyph x={x(c)} y={yA} value={bit(a, i)} label={`a${SUB[i]}`} stub={false} />
              <SwitchGlyph x={x(c)} y={yB} value={bit(b, i)} label={`b${SUB[i]}`} stub={false} />
            </g>
          );
        })}
        <text x={x(0)} y={yB + 7} fontSize={22} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill="var(--muted)">+</text>
        <line x1={x(0) - 22} y1={yRule} x2={x(n) + 26} y2={yRule} stroke="var(--gate-ink)" strokeWidth={1.4} />
        {Array.from({ length: n + 1 }, (_, c) => {
          const i = n - c;
          return <BulbGlyph key={`s${i}`} x={x(c) - 4} y={yS} value={((total >> i) & 1) as Bit} label={`s${SUB[i]}`} stub={false} />;
        })}
      </svg>
      {caption && <figcaption style={{ fontSize: 12, color: "var(--muted)" }}>{caption}</figcaption>}
    </figure>
  );
}
