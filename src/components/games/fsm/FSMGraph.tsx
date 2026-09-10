import type { FSM, State } from "./model";
import type { EdgeGeom, Pt } from "./fsmLayout";
import {
  ACTIVE_EDGE_STROKE,
  EDGE_STROKE,
  NODE_STROKE,
  computeEdges,
  place,
  placeLabels,
} from "./fsmLayout";

interface FSMGraphProps {
  machine: FSM;
  width?: number;
  height?: number;
  currentState?: State | null;
  trapped?: boolean;
  activeEdge?: { from: State; to: State } | null;
  // A monotonically-increasing counter that changes with every step the
  // runner takes. Used as a React `key` on the active edge so the trace
  // animation restarts even when the same edge fires twice in a row
  // (e.g. a self-loop pumping repeatedly on the same input).
  pulseKey?: number;
}

// Palette tuned to match the chapter's tikz figures (black-ink graph
// on paper) plus two highlight colours that stay distinct from the
// site accent: warm gold for the current state, burgundy red for the
// most-recently-traversed edge.
const INK = "var(--ink)";
const PAPER = "var(--surface)";
const CURRENT_FILL = "#e6b450";    // warm gold
const CURRENT_RING = "#7a5b14";    // darker gold for the inner ring
const ACTIVE_EDGE = "#c0392b";     // burgundy red — matches QRMT highlighted_edge

// Stealth arrowhead — slim, slightly concave at the back, the same shape
// tikz `>=Stealth` produces. Drawn in a 12x10 box.
function StealthMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 12 10"
      refX={11}
      refY={5}
      markerWidth={12}
      markerHeight={10}
      markerUnits="userSpaceOnUse"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 12 5 L 0 10 L 3.5 5 Z" fill={color} />
    </marker>
  );
}

// ---------------------------------------------------------------------

export default function FSMGraph({
  machine,
  width = 520,
  height = 320,
  currentState = null,
  trapped = false,
  activeEdge = null,
  pulseKey = 0,
}: FSMGraphProps) {
  const pad = 38;
  const nodeR = Math.max(20, Math.round(Math.min(width, height) * 0.07));
  const fontSize = Math.max(13, Math.round(Math.min(width, height) * 0.05));
  const labelFont = Math.round(fontSize * 0.85);

  const positions: Record<string, Pt> = {};
  for (const s of machine.states) {
    positions[s] = place(machine.layout[s], width, height, pad);
  }

  const edges = computeEdges(machine, positions, nodeR, labelFont, width, height);
  placeLabels(edges, machine, positions, nodeR, labelFont, width, height);

  // The start stub normally comes in from the left, which is the
  // convention. It gives that up only when the left is occupied or off
  // the canvas.
  const startStub = (() => {
    const s = positions[machine.start];
    const options: { dx: number; dy: number }[] = [
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: 1, dy: 0 },
    ];
    for (const o of options) {
      const tail = { x: s.x + o.dx * (nodeR + 30), y: s.y + o.dy * (nodeR + 30) };
      if (tail.x < 4 || tail.y < 4 || tail.x > width - 4 || tail.y > height - 4) continue;
      const blocked = machine.states.some(
        (t) =>
          t !== machine.start &&
          Math.hypot(tail.x - positions[t].x, tail.y - positions[t].y) < nodeR + 10,
      );
      if (!blocked) {
        return {
          x1: tail.x,
          y1: tail.y,
          x2: s.x + o.dx * (nodeR + 1),
          y2: s.y + o.dy * (nodeR + 1),
        };
      }
    }
    return {
      x1: s.x - nodeR - 30,
      y1: s.y,
      x2: s.x - nodeR - 1,
      y2: s.y,
    };
  })();

  const isActive = (e: EdgeGeom) =>
    activeEdge !== null && activeEdge.from === e.from && activeEdge.to === e.to;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: width, display: "block" }}
      role="img"
    >
      <defs>
        <StealthMarker id="fsm-arrow" color={INK} />
        <StealthMarker id="fsm-arrow-active" color={ACTIVE_EDGE} />
        <style>{`
          @keyframes fsm-pulse {
            0%   { stroke-dashoffset: 1; stroke-width: 4.4; opacity: 0.55; }
            55%  { stroke-dashoffset: 0; stroke-width: 4.4; opacity: 1;    }
            100% { stroke-dashoffset: 0; stroke-width: ${ACTIVE_EDGE_STROKE}; opacity: 1; }
          }
          .fsm-active-edge {
            stroke-dasharray: 1 1;
            animation: fsm-pulse 360ms ease-out forwards;
          }
          @keyframes fsm-node-halo {
            0%   { transform: scale(1);    opacity: 0.7; }
            100% { transform: scale(1.55); opacity: 0;   }
          }
          .fsm-node-halo {
            animation: fsm-node-halo 480ms ease-out forwards;
            transform-box: view-box;
          }
          @keyframes fsm-node-flash {
            0%   { fill: #fde2a3; }
            100% { fill: ${CURRENT_FILL}; }
          }
          .fsm-node-current {
            animation: fsm-node-flash 320ms ease-out forwards;
          }
        `}</style>
      </defs>

      {/* Wires, quiet ones first. */}
      {edges.map((e, i) =>
        isActive(e) ? null : (
          <path
            key={`e${i}`}
            d={e.d}
            fill="none"
            stroke={INK}
            strokeWidth={EDGE_STROKE}
            strokeLinecap="round"
            markerEnd="url(#fsm-arrow)"
          />
        ),
      )}

      {/* The wire just travelled, drawn on top so a parallel sibling can
          never hide it. Keyed on `pulseKey` so the animation restarts even
          when the same wire fires twice in a row. */}
      {edges.map((e, i) =>
        isActive(e) ? (
          <path
            key={`active-${i}-${pulseKey}`}
            d={e.d}
            fill="none"
            stroke={ACTIVE_EDGE}
            strokeWidth={ACTIVE_EDGE_STROKE}
            strokeLinecap="round"
            markerEnd="url(#fsm-arrow-active)"
            pathLength={1}
            className="fsm-active-edge"
          />
        ) : null,
      )}

      {/* Start arrow */}
      <path
        d={`M ${startStub.x1} ${startStub.y1} L ${startStub.x2} ${startStub.y2}`}
        stroke={INK}
        strokeWidth={EDGE_STROKE}
        fill="none"
        markerEnd="url(#fsm-arrow)"
      />

      {/* Nodes. The current node's group is keyed by `pulseKey` so React
          remounts it every step — restarting the halo and fill-flash
          animations even when the active state is unchanged. */}
      {machine.states.map((s) => {
        const p = positions[s];
        const isCurrent = currentState === s && !trapped;
        const isAccepting = machine.accepting.has(s);
        const fill = isCurrent ? CURRENT_FILL : PAPER;
        const stroke = isCurrent ? CURRENT_RING : INK;
        const text = machine.labels?.[s] ?? s;
        return (
          <g key={isCurrent ? `${s}-pulse-${pulseKey}` : s}>
            {isCurrent && (
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR + 1}
                fill="none"
                stroke={CURRENT_FILL}
                strokeWidth={3}
                className="fsm-node-halo"
                style={{ transformOrigin: `${p.x}px ${p.y}px` }}
              />
            )}
            <circle
              cx={p.x}
              cy={p.y}
              r={nodeR}
              fill={fill}
              stroke={stroke}
              strokeWidth={NODE_STROKE}
              className={isCurrent ? "fsm-node-current" : undefined}
            />
            {isAccepting && (
              <circle
                cx={p.x}
                cy={p.y}
                r={nodeR - 4.5}
                fill="none"
                stroke={stroke}
                strokeWidth={NODE_STROKE}
              />
            )}
            <text
              x={p.x}
              y={p.y}
              fontSize={fontSize}
              textAnchor="middle"
              dominantBaseline="central"
              fill={INK}
              style={{
                fontFamily:
                  '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
                fontWeight: 500,
              }}
            >
              {text}
            </text>
          </g>
        );
      })}

      {/* Labels last, so a wire drawn later can never cross one out. */}
      {edges.map((e, i) => (
        <LabelChip
          key={`l${i}`}
          x={e.label.x}
          y={e.label.y}
          w={e.labelW}
          h={e.labelH}
          text={e.text}
          fontSize={labelFont}
          color={isActive(e) ? ACTIVE_EDGE : INK}
        />
      ))}

      {/* Trap badge */}
      {trapped && (
        <g>
          <rect x={width - 96} y={10} width={86} height={24} rx={4} fill={ACTIVE_EDGE} />
          <text
            x={width - 53}
            y={26}
            fontSize={12}
            textAnchor="middle"
            fill="white"
            style={{
              fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            TRAPPED
          </text>
        </g>
      )}
    </svg>
  );
}

// A small "chip" behind each label so it stays legible when a wire passes
// underneath it.
function LabelChip({
  x,
  y,
  w,
  h,
  text,
  fontSize,
  color,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fontSize: number;
  color: string;
}) {
  return (
    <g>
      <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="var(--bg)" rx={3} />
      <text
        x={x}
        y={y}
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        style={{
          fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
          fontWeight: 500,
        }}
      >
        {text}
      </text>
    </g>
  );
}
