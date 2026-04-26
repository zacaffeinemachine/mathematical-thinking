// Static SVG renderer for the digraph of a permutation.
//
// Input: a list of cycles, each cycle a list of slot numbers, in the
// order the arrows visit them. Output: an SVG with each cycle drawn
// as a polygon of nodes with curved arrows between consecutive nodes,
// laid out left-to-right.

interface PermutationDigraphProps {
  cycles: number[][];
  // Optional caption shown beneath the SVG.
  caption?: string;
  // Optional radius hint per cycle. Otherwise auto-sized.
  width?: number;
}

const NODE_R = 14;
const PAD = 28;

function cycleLayout(len: number): { radius: number; bbox: number } {
  if (len === 1) return { radius: 0, bbox: NODE_R * 2 + 30 };
  if (len === 2) return { radius: 32, bbox: 32 * 2 + NODE_R * 2 + 24 };
  // n ≥ 3: regular polygon. Scale radius by perimeter so nodes always
  // have comfortable spacing, with a tasteful minimum for triangles.
  const r = Math.max(40, 16 * len / Math.PI + 12);
  return { radius: r, bbox: r * 2 + NODE_R * 2 + 28 };
}

export default function PermutationDigraph({
  cycles,
  caption,
  width,
}: PermutationDigraphProps) {
  // Per-cycle bounding boxes
  const layouts = cycles.map((c) => cycleLayout(c.length));
  const totalW = layouts.reduce((s, l) => s + l.bbox, 0) + PAD * (cycles.length + 1);
  const maxBox = Math.max(...layouts.map((l) => l.bbox), 80);
  const totalH = maxBox + 24;
  const W = width ?? totalW;

  // Compute each cycle's center (x, y) inside the SVG
  let cx = PAD;
  const centers: { x: number; y: number }[] = [];
  for (const l of layouts) {
    centers.push({ x: cx + l.bbox / 2, y: totalH / 2 });
    cx += l.bbox + PAD;
  }

  return (
    <div style={{ margin: "20px 0" }}>
      <svg
        viewBox={`0 0 ${totalW} ${totalH}`}
        style={{
          width: "100%",
          maxWidth: W,
          height: "auto",
          display: "block",
          margin: "0 auto",
        }}
      >
        <defs>
          {/* Stealth-style arrowhead: long, slim triangle with slight
              concave back, matching TikZ's `Stealth[length=5pt]`. */}
          <marker
            id="pdg-arrow"
            viewBox="0 0 12 10"
            refX="11"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 12 5 L 0 10 L 4 5 Z" fill="var(--ink)" />
          </marker>
        </defs>

        {cycles.map((cyc, ci) => {
          const { radius } = layouts[ci];
          const center = centers[ci];
          const n = cyc.length;

          // Compute node positions
          const nodes: { x: number; y: number; label: number }[] = [];
          if (n === 1) {
            nodes.push({ x: center.x, y: center.y, label: cyc[0] });
          } else if (n === 2) {
            nodes.push({ x: center.x - radius, y: center.y, label: cyc[0] });
            nodes.push({ x: center.x + radius, y: center.y, label: cyc[1] });
          } else {
            for (let i = 0; i < n; i++) {
              const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
              nodes.push({
                x: center.x + radius * Math.cos(a),
                y: center.y + radius * Math.sin(a),
                label: cyc[i],
              });
            }
          }

          // Build arrow paths: edge from node i to node (i+1) mod n
          const arrows: string[] = [];
          if (n === 1) {
            // TikZ-style "loop right" — a small loop coming out of the
            // upper-right of the node and re-entering on the lower-right.
            const nx = nodes[0].x;
            const ny = nodes[0].y;
            const sx = nx + NODE_R * Math.cos(-Math.PI / 6);
            const sy = ny + NODE_R * Math.sin(-Math.PI / 6);
            const ex = nx + NODE_R * Math.cos(Math.PI / 6);
            const ey = ny + NODE_R * Math.sin(Math.PI / 6);
            const cx1 = nx + NODE_R + 22;
            const cy1 = ny - 18;
            const cx2 = nx + NODE_R + 22;
            const cy2 = ny + 18;
            arrows.push(`M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${ex} ${ey}`);
          } else if (n === 2) {
            // Two arrows with mirror-image bends, both bowing outward.
            const [a, b] = nodes;
            arrows.push(curvedArrow(a, b, NODE_R, 18));
            arrows.push(curvedArrow(b, a, NODE_R, 18));
          } else {
            for (let i = 0; i < n; i++) {
              const from = nodes[i];
              const to = nodes[(i + 1) % n];
              arrows.push(curvedArrow(from, to, NODE_R, 8));
            }
          }

          return (
            <g key={ci}>
              {arrows.map((d, k) => (
                <path
                  key={k}
                  d={d}
                  fill="none"
                  stroke="var(--ink)"
                  strokeWidth={1.7}
                  strokeLinecap="round"
                  markerEnd="url(#pdg-arrow)"
                />
              ))}
              {nodes.map((nd, k) => (
                <g key={k}>
                  <circle
                    cx={nd.x}
                    cy={nd.y}
                    r={NODE_R}
                    fill="var(--surface)"
                    stroke="var(--ink)"
                    strokeWidth={1.4}
                  />
                  <text
                    x={nd.x}
                    y={nd.y + 4}
                    fontSize={12}
                    fontFamily="ui-serif, Georgia, serif"
                    fontWeight={500}
                    textAnchor="middle"
                    fill="var(--ink)"
                  >
                    {nd.label}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>

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

// A short cubic-Bezier arrow from `from` to `to`, offset so its head
// stops just outside the target circle and starts just outside the
// source. `bend` controls how much the arc bulges sideways.
function curvedArrow(
  from: { x: number; y: number },
  to: { x: number; y: number },
  nodeR: number,
  bend: number,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  // Offset start/end by node radius along the direct line
  const sx = from.x + ux * nodeR;
  const sy = from.y + uy * nodeR;
  const ex = to.x - ux * (nodeR + 2);
  const ey = to.y - uy * (nodeR + 2);
  // Perpendicular for the bend. Sign chosen so that for a clockwise
  // polygon traversal in SVG (y-down) the arc bows OUTWARD, away from
  // the cycle's centre — matching TikZ's `bend left=15`.
  const px = uy, py = -ux;
  const mx = (sx + ex) / 2 + px * bend;
  const my = (sy + ey) / 2 + py * bend;
  return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
}
