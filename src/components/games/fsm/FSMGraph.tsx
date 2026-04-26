import type { FSM, State } from "./model";
import { edgeGroups } from "./model";

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

const NODE_STROKE = 1.8;
const EDGE_STROKE = 1.6;
const ACTIVE_EDGE_STROKE = 2.6;

function place(p: { x: number; y: number }, w: number, h: number, pad: number) {
  return {
    x: pad + p.x * (w - 2 * pad),
    y: pad + p.y * (h - 2 * pad),
  };
}

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

  const positions: Record<string, { x: number; y: number }> = {};
  for (const s of machine.states) {
    positions[s] = place(machine.layout[s], width, height, pad);
  }

  const groups = edgeGroups(machine);
  const hasReverse = (from: string, to: string) =>
    groups.some((g) => g.from === to && g.to === from && from !== to);

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

      {/* Edges — pass 1: render non-active edges. */}
      {groups.map((g, idx) => {
        const isActive =
          activeEdge !== null &&
          activeEdge.from === g.from &&
          activeEdge.to === g.to;
        if (isActive) return null;
        return renderEdge({
          group: g,
          positions,
          nodeR,
          labelFont,
          stroke: INK,
          strokeWidth: EDGE_STROKE,
          markerEnd: "url(#fsm-arrow)",
          labelColor: INK,
          hasReverse: hasReverse(g.from, g.to),
          key: idx,
        });
      })}

      {/* Edges — pass 2: render the active edge on top so it is never
          hidden by a parallel-direction sibling. The `key` is keyed off
          `pulseKey` so the wrapping <g> remounts every step — that
          restarts the CSS animation even when the active edge has not
          changed (a self-loop firing twice on the same input). */}
      {groups.map((g, idx) => {
        const isActive =
          activeEdge !== null &&
          activeEdge.from === g.from &&
          activeEdge.to === g.to;
        if (!isActive) return null;
        return renderEdge({
          group: g,
          positions,
          nodeR,
          labelFont,
          stroke: ACTIVE_EDGE,
          strokeWidth: ACTIVE_EDGE_STROKE,
          markerEnd: "url(#fsm-arrow-active)",
          labelColor: ACTIVE_EDGE,
          hasReverse: hasReverse(g.from, g.to),
          pathClassName: "fsm-active-edge",
          key: `active-${idx}-${pulseKey}`,
        });
      })}

      {/* Start arrow */}
      {(() => {
        const s = positions[machine.start];
        const sx = s.x - nodeR - 30;
        const sy = s.y;
        const ex = s.x - nodeR - 1;
        const ey = s.y;
        return (
          <path
            d={`M ${sx} ${sy} L ${ex} ${ey}`}
            stroke={INK}
            strokeWidth={EDGE_STROKE}
            fill="none"
            markerEnd="url(#fsm-arrow)"
          />
        );
      })()}

      {/* Nodes. The current node's group is keyed by `pulseKey` so React
          remounts it every step — restarting the halo + fill-flash
          animations even when the active state is unchanged (e.g. a
          self-loop firing on the same input twice). */}
      {machine.states.map((s) => {
        const p = positions[s];
        const isCurrent = currentState === s && !trapped;
        const isAccepting = machine.accepting.has(s);
        const fill = isCurrent ? CURRENT_FILL : PAPER;
        const stroke = isCurrent ? CURRENT_RING : INK;
        const label = machine.labels?.[s] ?? s;
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
              {label}
            </text>
          </g>
        );
      })}

      {/* Trap badge */}
      {trapped && (
        <g>
          <rect
            x={width - 96}
            y={10}
            width={86}
            height={24}
            rx={4}
            fill={ACTIVE_EDGE}
          />
          <text
            x={width - 53}
            y={26}
            fontSize={12}
            textAnchor="middle"
            fill="white"
            style={{
              fontFamily:
                '"Inter", system-ui, -apple-system, sans-serif',
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

interface RenderEdgeArgs {
  group: { from: State; to: State; symbols: string[] };
  positions: Record<string, { x: number; y: number }>;
  nodeR: number;
  labelFont: number;
  stroke: string;
  strokeWidth: number;
  markerEnd: string;
  labelColor: string;
  hasReverse: boolean;
  key: string | number;
  // Optional class name applied to the <path>; used to attach the
  // pulse animation when this edge is the active one.
  pathClassName?: string;
}

function renderEdge({
  group: g,
  positions,
  nodeR,
  labelFont,
  stroke,
  strokeWidth,
  markerEnd,
  labelColor,
  hasReverse,
  key,
  pathClassName,
}: RenderEdgeArgs) {
  const a = positions[g.from];
  const b = positions[g.to];
  const labelStyle = {
    fontFamily: 'ui-monospace, "JetBrains Mono", Menlo, monospace',
    fontWeight: 500 as const,
  };
  const labelText = g.symbols.join(", ");

  if (g.from === g.to) {
    // Self-loop above the node — a cubic Bézier whose two endpoints lie
    // exactly on the node circle and whose tangents at those endpoints
    // are radially outward, so the curve and the arrowhead meet the
    // circle cleanly (matching tikz's `loop above`).
    //
    // Math angles (counter-clockwise from +x with y up). We exit the
    // node at 130°, swing over the top, and re-enter at 50°.
    const startMath = (130 * Math.PI) / 180;
    const endMath = (50 * Math.PI) / 180;
    // SVG y is flipped — convert with a negation on the y component.
    const sx = a.x + nodeR * Math.cos(startMath);
    const sy = a.y - nodeR * Math.sin(startMath);
    const ex = a.x + nodeR * Math.cos(endMath);
    const ey = a.y - nodeR * Math.sin(endMath);

    const L = nodeR * 1.9;
    const cp1x = sx + L * Math.cos(startMath);
    const cp1y = sy - L * Math.sin(startMath);
    const cp2x = ex + L * Math.cos(endMath);
    const cp2y = ey - L * Math.sin(endMath);

    // Apex of the loop sits roughly at the midpoint of the control
    // points; place the label just above it.
    const apexX = (cp1x + cp2x) / 2;
    const apexY = Math.min(cp1y, cp2y) - 4;

    return (
      <g key={key}>
        <path
          d={`M ${sx} ${sy} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${ex} ${ey}`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          markerEnd={markerEnd}
          pathLength={pathClassName ? 1 : undefined}
          className={pathClassName}
        />
        <LabelChip
          x={apexX}
          y={apexY}
          text={labelText}
          fontSize={labelFont}
          color={labelColor}
          style={labelStyle}
        />
      </g>
    );
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy;
  const py = ux;

  if (!hasReverse) {
    // Straight edge along the line a→b.
    const startX = a.x + ux * nodeR;
    const startY = a.y + uy * nodeR;
    const endX = b.x - ux * nodeR;
    const endY = b.y - uy * nodeR;
    const lx = (startX + endX) / 2 + px * 14;
    const ly = (startY + endY) / 2 + py * 14;
    return (
      <g key={key}>
        <path
          d={`M ${startX} ${startY} L ${endX} ${endY}`}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          markerEnd={markerEnd}
          pathLength={pathClassName ? 1 : undefined}
          className={pathClassName}
        />
        <LabelChip
          x={lx}
          y={ly}
          text={labelText}
          fontSize={labelFont}
          color={labelColor}
          style={labelStyle}
        />
      </g>
    );
  }

  // Bent edge — exit and entry points are rotated around their nodes by
  // angle α toward the bend direction so that the forward and reverse
  // edges hit the circle at *different* points (no shared endpoint),
  // and so that each curve enters/leaves the circle along its own
  // tangent (no tiny straight segment between curve and node).
  const alpha = 0.32; // ~18.3°, matches a tikz `bend left=18` look
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);

  // Unit tangent of the curve at start (leaving a) and at end (entering b).
  const exitUx = ux * cosA + px * sinA;
  const exitUy = uy * cosA + py * sinA;
  const enterUx = ux * cosA - px * sinA;
  const enterUy = uy * cosA - py * sinA;

  const startX = a.x + nodeR * exitUx;
  const startY = a.y + nodeR * exitUy;
  const endX = b.x - nodeR * enterUx;
  const endY = b.y - nodeR * enterUy;

  // Cubic control points along those tangents — gives a smooth arc that
  // is tangent to the node circle at each end.
  const handle = dist * 0.32;
  const cp1x = startX + handle * exitUx;
  const cp1y = startY + handle * exitUy;
  const cp2x = endX - handle * enterUx;
  const cp2y = endY - handle * enterUy;

  // Place the label above the curve's midpoint, on the perpendicular.
  const midX = (cp1x + cp2x) / 2;
  const midY = (cp1y + cp2y) / 2;
  const lx = midX;
  const ly = midY;

  return (
    <g key={key}>
      <path
        d={`M ${startX} ${startY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${endX} ${endY}`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        markerEnd={markerEnd}
        pathLength={pathClassName ? 1 : undefined}
        className={pathClassName}
      />
      <LabelChip
        x={lx}
        y={ly}
        text={labelText}
        fontSize={labelFont}
        color={labelColor}
        style={labelStyle}
      />
    </g>
  );
}

// A small "chip" behind each label so it stays legible when an edge
// passes near the node it labels.
function LabelChip({
  x,
  y,
  text,
  fontSize,
  color,
  style,
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  style: React.CSSProperties;
}) {
  const padX = 4;
  const padY = 2;
  const w = Math.max(fontSize * 0.7 * text.length, fontSize);
  const h = fontSize + padY * 2;
  return (
    <g>
      <rect
        x={x - w / 2 - padX}
        y={y - h / 2}
        width={w + padX * 2}
        height={h}
        fill="var(--bg)"
        rx={3}
      />
      <text
        x={x}
        y={y}
        fontSize={fontSize}
        textAnchor="middle"
        dominantBaseline="central"
        fill={color}
        style={style}
      >
        {text}
      </text>
    </g>
  );
}
