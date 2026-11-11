// SVG pieces every circuit problem draws with. Gate bodies come from
// ../gateShapes.ts, the same shapes and theme colours as CircuitDiagram.

import type { Bit, GateType } from "../model";
import {
  GATE_FILL,
  GATE_INK,
  WIRE_ON,
  WIRE_OFF,
  gatePathSized,
  hasBubble,
  orBackX,
  xorBackPathSized,
} from "../gateShapes";
import {
  BULB_PIN,
  BULB_R,
  PIN_STUB,
  SWITCH_H,
  SWITCH_PIN,
  SWITCH_W,
  BOX_TITLE,
  boxInputPin,
  boxOutputPin,
  boxSize,
  gateInputPin,
  gateOutputPin,
  gateSize,
  wirePath,
} from "./layout";

export const MONO = 'ui-monospace, "JetBrains Mono", Menlo, monospace';
export const SANS = "ui-sans-serif, system-ui";
export const WRONG = "var(--mcq-wrong)";
export const RIGHT = "var(--mcq-right)";
export const HILITE = "var(--accent)";

// ---- wires -----------------------------------------------------------------

// value: 1 / 0 colours the wire, undefined draws it dashed (nothing reaches
// it yet), null draws it neutral (the value is being kept secret).
export function Wire({
  x1, y1, x2, y2, value, selected = false, faint = false, path,
}: {
  x1: number; y1: number; x2: number; y2: number;
  value: Bit | undefined | null;
  selected?: boolean;
  faint?: boolean;
  path?: string;          // a routed path (layout.ts, routeSegments); default the plain S-curve
}) {
  const d = path ?? wirePath(x1, y1, x2, y2);
  const stroke =
    value === 1 ? WIRE_ON : value === 0 ? WIRE_OFF : "var(--muted)";
  return (
    <g style={{ pointerEvents: "none" }}>
      {selected && <path d={d} fill="none" stroke={HILITE} strokeOpacity={0.35} strokeWidth={9} strokeLinecap="round" />}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={value === 1 ? 2.6 : 1.7}
        strokeDasharray={value === undefined ? "4 3" : undefined}
        opacity={faint ? 0.5 : 1}
      />
    </g>
  );
}

// The little 0 / 1 printed just after a source pin.
export function ValueDigit({ x, y, value }: { x: number; y: number; value: Bit | undefined }) {
  if (value === undefined) return null;
  return (
    <text
      x={x + 3}
      y={y - 5}
      fontSize={11}
      fontFamily={MONO}
      fontWeight={700}
      fill={value ? WIRE_ON : "var(--muted)"}
      style={{ pointerEvents: "none" }}
    >
      {value}
    </text>
  );
}

// ---- pins ------------------------------------------------------------------

export function PinDot({ x, y, filled, hot = false, bad = false }: { x: number; y: number; filled: boolean; hot?: boolean; bad?: boolean }) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {(hot || bad) && <circle cx={x} cy={y} r={8} fill="none" stroke={bad ? WRONG : HILITE} strokeWidth={2} />}
      <circle cx={x} cy={y} r={3.6} fill={filled ? GATE_INK : "var(--surface)"} stroke={bad ? WRONG : GATE_INK} strokeWidth={1.3} />
    </g>
  );
}

// ---- gates -----------------------------------------------------------------

// A gate with n input pins, anchored at (x, y) as in model.ts. Stubs run from
// each pin to the body, so a wire ending at the pin meets the gate.
export function GateGlyph({
  type, n, x, y, label, selected = false, showType = true,
}: {
  type: GateType; n: number; x: number; y: number;
  label?: string; selected?: boolean; showType?: boolean;
}) {
  const { w, h } = gateSize(type, n);
  const out = gateOutputPin(type, n);
  const bubble = hasBubble(type);
  const pins = Array.from({ length: type === "NOT" ? 1 : n }, (_, i) => gateInputPin(type, n, i));
  const bodyX = (py: number) => (type === "OR" || type === "NOR" || type === "XOR" ? orBackX(w, h, py) : 0);
  return (
    <g transform={`translate(${x},${y})`}>
      {selected && (
        <rect x={-14} y={-h / 2 - 8} width={out.x + 20} height={h + 16} rx={8} fill="var(--accent-soft)" stroke={HILITE} strokeWidth={1.2} strokeDasharray="4 3" />
      )}
      {pins.map((p, i) => (
        <line key={i} x1={p.x} y1={p.y} x2={bodyX(p.y) + 1} y2={p.y} stroke={GATE_INK} strokeWidth={1.4} />
      ))}
      <line x1={w + (bubble ? 6 : 0)} y1={0} x2={out.x} y2={0} stroke={GATE_INK} strokeWidth={1.4} />
      {type === "XOR" && (
        <path d={xorBackPathSized(w, h)} fill="none" stroke={GATE_INK} strokeWidth={1.5} />
      )}
      <path d={gatePathSized(type, w, h)} fill={GATE_FILL[type]} stroke={GATE_INK} strokeWidth={1.5} />
      {bubble && <circle cx={w + 3} cy={0} r={3} fill="var(--surface)" stroke={GATE_INK} strokeWidth={1.4} />}
      {showType && type !== "NOT" && (
        <text
          x={type === "OR" || type === "NOR" || type === "XOR" ? w * 0.47 : w / 2 - 2}
          y={4}
          fontSize={type === "NAND" ? 10 : 11}
          fontFamily={SANS}
          fontWeight={600}
          textAnchor="middle"
          fill={GATE_INK}
          style={{ pointerEvents: "none" }}
        >
          {type}
        </text>
      )}
      {label && (
        <text x={w / 2} y={h / 2 + 14} fontSize={10} fontFamily={MONO} textAnchor="middle" fill="var(--muted)">
          {label}
        </text>
      )}
    </g>
  );
}

// ---- boxes -------------------------------------------------------------------

// A box with labelled pins, anchored at (x, y) like a gate (the middle of its
// left edge). See boxSize in layout.ts for the geometry.
export function BoxGlyph({
  title, inputs, outputs, gap = 0, x, y, selected = false,
}: {
  title: string; inputs: string[]; outputs: string[]; gap?: number;
  x: number; y: number; selected?: boolean;
}) {
  const nI = inputs.length, nO = outputs.length;
  const { w, h } = boxSize(nI, nO, gap);
  const ins = inputs.map((_, i) => boxInputPin(nI, nO, gap, i));
  const outs = outputs.map((_, k) => boxOutputPin(nI, nO, gap, k));
  return (
    <g transform={`translate(${x},${y})`}>
      {selected && (
        <rect x={-14} y={-h / 2 - 8} width={w + 28} height={h + 16} rx={8} fill="var(--accent-soft)" stroke={HILITE} strokeWidth={1.2} strokeDasharray="4 3" />
      )}
      {ins.map((p, i) => <line key={`i${i}`} x1={p.x} y1={p.y} x2={0} y2={p.y} stroke={GATE_INK} strokeWidth={1.4} />)}
      {outs.map((p, k) => <line key={`o${k}`} x1={w} y1={p.y} x2={p.x} y2={p.y} stroke={GATE_INK} strokeWidth={1.4} />)}
      <rect x={0} y={-h / 2} width={w} height={h} rx={6} fill="var(--surface)" stroke={GATE_INK} strokeWidth={1.6} />
      <path d={`M 0 ${-h / 2 + BOX_TITLE} H ${w}`} stroke={GATE_INK} strokeWidth={1} />
      <text x={w / 2} y={-h / 2 + 14} fontSize={11} fontFamily={SANS} fontWeight={600} textAnchor="middle" fill={GATE_INK} style={{ pointerEvents: "none" }}>
        {title}
      </text>
      {ins.map((p, i) => (
        <text key={`li${i}`} x={6} y={p.y + 4} fontSize={11} fontFamily={MONO} fill={GATE_INK} style={{ pointerEvents: "none" }}>{inputs[i]}</text>
      ))}
      {outs.map((p, k) => (
        <text key={`lo${k}`} x={w - 6} y={p.y + 4} fontSize={11} fontFamily={MONO} textAnchor="end" fill={GATE_INK} style={{ pointerEvents: "none" }}>{outputs[k]}</text>
      ))}
    </g>
  );
}

// ---- switches ----------------------------------------------------------------

// A toggle switch: up is 1, down is 0. value null shows the knob in the
// middle, for a switch whose position is not yet on show.
export function SwitchGlyph({
  x, y, label, value, locked = false, bad = false, stub = true,
}: {
  x: number; y: number; label?: string; value: Bit | null; locked?: boolean; bad?: boolean; stub?: boolean;
}) {
  const ky = value === 1 ? -SWITCH_H / 2 + 8 : value === 0 ? SWITCH_H / 2 - 8 : 0;
  return (
    <g transform={`translate(${x},${y})`}>
      {stub && <line x1={SWITCH_W / 2} y1={0} x2={SWITCH_PIN} y2={0} stroke={GATE_INK} strokeWidth={1.4} />}
      <rect
        x={-SWITCH_W / 2}
        y={-SWITCH_H / 2}
        width={SWITCH_W}
        height={SWITCH_H}
        rx={SWITCH_W / 2}
        fill={value === 1 ? "var(--accent-soft)" : "var(--surface)"}
        stroke={bad ? WRONG : GATE_INK}
        strokeWidth={bad ? 2.2 : 1.4}
        strokeDasharray={locked ? "3 2" : undefined}
      />
      <circle cx={0} cy={ky} r={6.5} fill={value === 1 ? WIRE_ON : value === 0 ? WIRE_OFF : "var(--rule)"} stroke={GATE_INK} strokeWidth={1} />
      {value !== null && (
        <text y={ky + 3.2} fontSize={9} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill="#fff" style={{ pointerEvents: "none" }}>
          {value}
        </text>
      )}
      {label && (
        <text x={-SWITCH_W / 2 - 7} y={5} fontSize={13} fontFamily={MONO} textAnchor="end" fill="var(--ink)">
          {label}
        </text>
      )}
    </g>
  );
}

// ---- bulbs -------------------------------------------------------------------

export interface BulbMark { text: string; tone: "wrong" | "right" }

// A bulb with its base on the left, where the wire comes in. value 1 is lit,
// 0 is dark, null is a question mark, undefined is "not wired" (dashed).
export function BulbGlyph({
  x, y, label, value, mark, digit = false, stub = true,
}: {
  x: number; y: number; label?: string;
  value: Bit | null | undefined;
  mark?: BulbMark;
  digit?: boolean;
  stub?: boolean;
}) {
  const lit = value === 1;
  return (
    <g transform={`translate(${x},${y})`}>
      {stub && <line x1={-BULB_PIN} y1={0} x2={-BULB_R - 5} y2={0} stroke={GATE_INK} strokeWidth={1.4} />}
      {lit && <circle r={BULB_R + 8} fill="var(--bulb-glow)" />}
      <rect x={-BULB_R - 6} y={-5} width={7} height={10} rx={1.5} fill="var(--muted)" stroke={GATE_INK} strokeWidth={1} />
      <circle
        r={BULB_R}
        fill={lit ? "var(--bulb-lit)" : "var(--surface)"}
        stroke={GATE_INK}
        strokeWidth={1.4}
        strokeDasharray={value === undefined ? "3 2" : undefined}
      />
      {value === null ? (
        <text y={4.5} fontSize={13} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill="var(--ink)">?</text>
      ) : (
        <path d="M -4 3 L -2 -3 L 0 3 L 2 -3 L 4 3" fill="none" stroke={lit ? "#7a4b00" : "var(--muted)"} strokeWidth={1.1} />
      )}
      {mark && (
        <>
          <circle r={BULB_R + 6} fill="none" stroke={mark.tone === "wrong" ? WRONG : RIGHT} strokeWidth={2.2} strokeDasharray={mark.tone === "wrong" ? "4 3" : undefined} />
          <text y={BULB_R + 20} fontSize={10.5} fontFamily={SANS} fontWeight={600} textAnchor="middle" fill={mark.tone === "wrong" ? WRONG : RIGHT}>
            {mark.text}
          </text>
        </>
      )}
      {label && (
        <text x={BULB_R + 7} y={5} fontSize={13} fontFamily={MONO} textAnchor="start" fill="var(--ink)">
          {label}
        </text>
      )}
      {digit && value !== null && value !== undefined && (
        <text x={0} y={-BULB_R - 6} fontSize={11} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill={lit ? WIRE_ON : "var(--muted)"}>
          {value}
        </text>
      )}
    </g>
  );
}

// ---- wire tags -----------------------------------------------------------------

// A small labelled tag naming a wire, "p = 1", tied to the wire's source pin
// by a dotted leader. `place` says where the tag sits relative to the pin.
// Tappable when onTap is given.
export type TagPlace = "above" | "below" | "right";

export function WireTag({
  x, y, label, value, onTap, tone, maxX, place = "above",
}: {
  x: number; y: number; label: string; value: Bit | null;
  onTap?: () => void; tone?: "wrong" | "right"; maxX?: number; place?: TagPlace;
}) {
  const text = `${label} = ${value === null ? "?" : value}`;
  const w = Math.max(40, text.length * 7.2 + 14);
  const h = 22;
  let tx = place === "right" ? x + 10 : x - w / 2;
  if (maxX !== undefined) tx = Math.min(tx, maxX - w - 2);
  tx = Math.max(2, tx);
  const ty = place === "above" ? y - h - 14 : place === "below" ? y + 14 : y - h - 6;
  const lx = Math.min(Math.max(x, tx + 6), tx + w - 6);
  const ly = place === "below" ? ty : ty + h;
  const stroke = tone === "wrong" ? WRONG : tone === "right" ? RIGHT : onTap ? HILITE : "var(--muted)";
  return (
    <g
      role={onTap ? "button" : undefined}
      tabIndex={onTap ? 0 : undefined}
      aria-label={onTap ? `Wire ${label}, now ${value === null ? "unknown" : value}. Tap to change.` : undefined}
      onClick={onTap}
      onKeyDown={onTap ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onTap(); } } : undefined}
      style={{ cursor: onTap ? "pointer" : "default", outline: "none" }}
    >
      <line x1={x} y1={y} x2={lx} y2={ly} stroke={stroke} strokeWidth={1} strokeDasharray="2 2" />
      <circle cx={x} cy={y} r={2.5} fill={stroke} />
      {onTap && <rect x={tx - 6} y={ty - 6} width={w + 12} height={h + 12} fill="transparent" />}
      <rect x={tx} y={ty} width={w} height={h} rx={5} fill="var(--surface)" stroke={stroke} strokeWidth={onTap ? 1.6 : 1.1} />
      <text x={tx + w / 2} y={ty + 15} fontSize={12} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill="var(--ink)">
        {text}
      </text>
    </g>
  );
}

// ---- a gate on its own, for palettes and for problem statements --------------

export function GateIcon({ type, size = 1, title }: { type: GateType; size?: number; title?: string }) {
  const n = type === "NOT" ? 1 : 2;
  const { h } = gateSize(type, n);
  const out = gateOutputPin(type, n);
  const left = type === "XOR" ? PIN_STUB + 8 : PIN_STUB + 2;
  const W = left + out.x + 2;
  const H = h + 6;
  return (
    <svg
      viewBox={`${-left} ${-H / 2} ${W} ${H}`}
      width={W * 0.62 * size}
      height={H * 0.62 * size}
      style={{ display: "inline-block", verticalAlign: "middle" }}
      role="img"
      aria-label={title ?? `${type} gate`}
    >
      <GateGlyph type={type} n={n} x={0} y={0} />
    </svg>
  );
}
