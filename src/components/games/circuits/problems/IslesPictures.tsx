// Static pictures for the oracle and chimera pages (logic-gates/isles and
// logic-gates/isles-build): islanders with speech bubbles, a ring of
// islanders, radios, and the two ruby boxes. Render with NO client
// directive. They ship no JavaScript. The CSS classes (isles-*) live in
// src/styles/global.css.

const ROBES = ["var(--gate-and)", "var(--gate-or)", "var(--gate-xor)", "var(--gate-nand)"];

export interface PicturedIslander {
  name: string;
  sw?: string;        // the switch letter, printed under the name
  says?: string;      // her sentence, without quotation marks
}

function Figure({ x = 0, y = 0, robe, s = 1 }: { x?: number; y?: number; robe: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-17 40 L-11 6 Q0 -2 11 6 L17 40 Z" fill={robe} stroke="var(--gate-ink)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="0" cy="-8" r="10" fill="var(--surface)" stroke="var(--gate-ink)" strokeWidth="1.4" />
      <text x="0" y="29" fontSize="15" fontWeight="700" textAnchor="middle" fill="var(--gate-ink)" fontFamily="ui-monospace, monospace">?</text>
    </g>
  );
}

export function Islanders({ people }: { people: PicturedIslander[] }) {
  return (
    <div className="not-prose isles-row">
      {people.map((p, k) => (
        <figure className="isles-person" key={k}>
          {p.says && <div className="isles-bubble">&ldquo;{p.says}&rdquo;</div>}
          <svg viewBox="-22 -22 44 66" width="52" height="78" role="img" aria-label={`${p.name}, an oracle or a chimera`}>
            <Figure robe={ROBES[k % ROBES.length]} />
          </svg>
          <figcaption><strong>{p.name}</strong>{p.sw && <span className="isles-sw">switch <code>{p.sw}</code></span>}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// Islanders in a circle, each speaking about the next one round. `word` is
// printed on every arrow (what each one says the next one is).
export function Ring({ people, word = "chimera" }: { people: PicturedIslander[]; word?: string }) {
  const n = people.length, R = n === 3 ? 104 : 118, cx = 170, cy = n === 3 ? 142 : 156;
  const pos = people.map((_, k) => {
    const t = -Math.PI / 2 + (2 * Math.PI * k) / n;
    return [cx + R * Math.cos(t), cy + R * Math.sin(t)];
  });
  const marker = `isles-arrow-${n}-${word.replace(/\W/g, "")}`;
  return (
    <svg className="isles-ring" viewBox={`0 0 340 ${n === 3 ? 278 : 330}`} width="340" role="img" aria-label={`${n} islanders in a circle, each speaking about the next`}>
      <defs>
        <marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--accent)" />
        </marker>
      </defs>
      {pos.map(([x1, y1], k) => {
        const [x2, y2] = pos[(k + 1) % n];
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        const ml = Math.hypot(mx - cx, my - cy), ox = (mx - cx) / ml, oy = (my - cy) / ml;
        const c1 = [x1, y1 - 6], c2 = [x2, y2 - 6];
        const sx = c1[0] + (c2[0] - c1[0]) * 0.28, sy = c1[1] + (c2[1] - c1[1]) * 0.28;
        const ex = c1[0] + (c2[0] - c1[0]) * 0.72, ey = c1[1] + (c2[1] - c1[1]) * 0.72;
        return (
          <g key={k}>
            <path d={`M${sx} ${sy} Q${mx + ox * 16} ${my - 6 + oy * 16} ${ex} ${ey}`} fill="none" stroke="var(--accent)" strokeWidth="1.8" markerEnd={`url(#${marker})`} />
            <text x={mx + ox * 36} y={my - 6 + oy * 36 + 4} fontSize="12" textAnchor="middle" fill="var(--accent)" fontStyle="italic">{word}</text>
          </g>
        );
      })}
      {pos.map(([x, y], k) => (
        <g key={`p${k}`}>
          <Figure x={x} y={y - 16} robe={ROBES[k % ROBES.length]} s={0.8} />
          <text x={x} y={y + 31} fontSize="12.5" fontWeight="700" textAnchor="middle" fill="var(--ink)">{people[k].name}</text>
          <text x={x} y={y + 45} fontSize="11" textAnchor="middle" fill="var(--muted)">switch <tspan fontFamily="ui-monospace, monospace" fill="var(--ink)">{people[k].sw}</tspan></text>
        </g>
      ))}
    </svg>
  );
}

function Radio({ x, y, name }: { x: number; y: number; name: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="10" y1="-16" x2="20" y2="-34" stroke="var(--gate-ink)" strokeWidth="1.6" />
      <circle cx="20" cy="-34" r="2.4" fill="var(--gate-ink)" />
      <rect x="-24" y="-16" width="48" height="32" rx="6" fill="var(--gate-nand)" stroke="var(--gate-ink)" strokeWidth="1.4" />
      <circle cx="-10" cy="0" r="8" fill="var(--surface)" stroke="var(--gate-ink)" strokeWidth="1.2" />
      <line x1="-10" y1="0" x2="-10" y2="-6" stroke="var(--gate-ink)" strokeWidth="1.6" />
      <text x="11" y="5" fontSize="15" fontWeight="700" textAnchor="middle" fill="var(--gate-ink)" fontFamily="ui-monospace, monospace">{name}</text>
    </g>
  );
}

// Radios with a report for each listed pair. `names` is "ABC" or "ABCD";
// the pairs default to neighbours round the ring, and `pairs` (like
// ["AB", "BC", "CD", "DA", "AC"]) adds or replaces them.
export function Radios({ names, pairs }: { names: string; pairs?: string[] }) {
  const n = names.length;
  const pos: [number, number][] = n === 3 ? [[150, 50], [240, 190], [60, 190]] : [[70, 50], [230, 50], [230, 190], [70, 190]];
  const where = (ch: string) => pos[names.indexOf(ch)];
  const links = pairs ?? [...names].map((c, k) => c + names[(k + 1) % n]);
  return (
    <svg className="isles-ring" viewBox="0 0 300 240" width="300" role="img" aria-label={`${n} radios, a report for each of ${links.length} pairs`}>
      {links.map((lab) => {
        const [x1, y1] = where(lab[0]), [x2, y2] = where(lab[1]);
        // A diagonal's label sits off centre so two diagonals would not collide.
        const t = Math.abs(names.indexOf(lab[0]) - names.indexOf(lab[1])) === 2 && n === 4 ? 0.35 : 0.5;
        const mx = x1 + (x2 - x1) * t, my = y1 + (y2 - y1) * t;
        return (
          <g key={lab}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth="1.6" strokeDasharray="5 4" />
            <rect x={mx - 19} y={my - 11} width="38" height="22" rx="5" fill="var(--surface)" stroke="var(--muted)" />
            <text x={mx} y={my + 5} fontSize="13" fontWeight="700" textAnchor="middle" fill="var(--ink)" fontFamily="ui-monospace, monospace">{lab}</text>
          </g>
        );
      })}
      {pos.map(([x, y], k) => <Radio key={k} x={x} y={y} name={names[k]} />)}
    </svg>
  );
}

export function RubyBoxes() {
  const boxes: [string, string, number][] = [["Coral", "#f08a7a", 20], ["Amber", "#f5b82e", 130]];
  return (
    <svg viewBox="0 0 230 74" width="230" role="img" aria-label="the Coral box and the Amber box">
      {boxes.map(([name, fill, x]) => (
        <g key={name}>
          <rect x={x} y="22" width="80" height="34" rx="4" fill={fill} stroke="var(--gate-ink)" strokeWidth="1.4" />
          <path d={`M${x} 22 Q${x + 40} 2 ${x + 80} 22`} fill={fill} stroke="var(--gate-ink)" strokeWidth="1.4" />
          <rect x={x + 34} y="30" width="12" height="10" rx="2" fill="var(--surface)" stroke="var(--gate-ink)" />
          <text x={x + 40} y="70" fontSize="12.5" fontWeight="700" textAnchor="middle" fill="var(--ink)">{name}</text>
        </g>
      ))}
    </svg>
  );
}
