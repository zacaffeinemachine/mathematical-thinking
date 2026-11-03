// Draws a fixed (author-given) circuit. Every non-builder component uses
// this, and so does the static <CircuitPicture> helper. The caller decides
// what each switch, wire and bulb shows. The only state it holds is where the
// reader has dragged the gates to, when `movable` is set: the circuit itself
// never changes, only the picture, and the positions are forgotten on reload.

import { useRef, useState } from "react";
import type { Bit, Circuit } from "../model";
import { BULB_PIN, gateBox, gateInputPin, gateSize, routeSegments, segmentsPath, sourcePin } from "./layout";
import { MSG } from "./messages";
import { BulbGlyph, GateGlyph, SwitchGlyph, ValueDigit, Wire, WireTag, type BulbMark, type TagPlace } from "./glyphs";
import { svgBox } from "./ui";

export interface TagSpec {
  wire: string;          // the id of the switch or gate whose output wire is tagged
  label: string;
  value: Bit | null;
  onTap?: () => void;
  tone?: "wrong" | "right";
  place?: TagPlace;      // where the tag sits: "above" (default), "below" or "right" of the pin
}

export interface FixedViewProps {
  circuit: Circuit;                                 // laid out (see layoutCircuit)
  switches: Record<string, Bit | null>;             // null: knob in the middle
  values: Record<string, Bit | undefined> | null;   // wire values, or null to keep them secret
  bulbs: Record<string, Bit | null | undefined>;    // null: "?"
  onSwitch?: (id: string) => void;                  // makes switches tappable
  locked?: string[];                                // switches drawn dashed and not tappable
  onBulb?: (id: string) => void;                    // makes bulbs tappable
  bulbMarks?: Record<string, BulbMark>;
  bulbDigits?: boolean;
  tags?: TagSpec[];
  scale?: number;
  label?: string;                                   // aria label
  movable?: boolean;                                // the reader may drag the gates (needs a hydrated caller)
}

export default function FixedCircuit({
  circuit: c0,
  switches,
  values,
  bulbs,
  onSwitch,
  locked = [],
  onBulb,
  bulbMarks = {},
  bulbDigits = false,
  tags = [],
  scale = 1.15,
  label = "Circuit diagram",
  movable = false,
}: FixedViewProps) {
  // ---- dragging gates ----
  const [moved, setMoved] = useState<Record<string, { x: number; y: number }>>({});
  const drag = useRef<{ id: string; pointer: number; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const c: Circuit = movable && Object.keys(moved).length
    ? { ...c0, gates: c0.gates.map((g) => (moved[g.id] ? { ...g, ...moved[g.id] } : g)) }
    : c0;
  const toLocal = (e: React.PointerEvent) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const grab = (id: string, gx: number, gy: number) => (e: React.PointerEvent) => {
    const p = toLocal(e);
    if (!p) return;
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag.current = { id, pointer: e.pointerId, dx: p.x - gx, dy: p.y - gy };
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    const p = toLocal(e);
    if (!p) return;
    const g = c0.gates.find((x) => x.id === d.id)!;
    const { w, h } = gateSize(g.type, g.inputs.length);
    // Keep the whole gate, pins included, inside the picture.
    const x = Math.min(Math.max(p.x - d.dx, 16), c0.width - w - 22);
    const y = Math.min(Math.max(p.y - d.dy, h / 2 + 2), c0.height - h / 2 - 2);
    setMoved((m) => ({ ...m, [d.id]: { x, y } }));
  };
  const drop = (e: React.PointerEvent) => {
    if (drag.current?.pointer === e.pointerId) drag.current = null;
  };

  const wireVal = (src: string): Bit | undefined | null => (values ? values[src] : null);
  // Room above the top row and below the bottom row for tags and marks.
  const topPad = tags.some((t) => (t.place ?? "above") !== "below") ? 34 : 0;
  const markPad = Math.max(Object.keys(bulbMarks).length ? 18 : 0, tags.some((t) => t.place === "below") ? 34 : 0);
  const vb = `0 ${-topPad} ${c.width} ${c.height + topPad + markPad}`;

  const tap = (fn?: () => void) =>
    fn
      ? {
          role: "button" as const,
          tabIndex: 0,
          onClick: fn,
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(); }
          },
          style: { cursor: "pointer", outline: "none" },
        }
      : {};

  const boxes = c.gates.map((g) => ({ id: g.id, box: gateBox(g) }));
  const route = (from: string, to: string | null, x1: number, y1: number, x2: number, y2: number) =>
    segmentsPath(routeSegments(x1, y1, x2, y2, boxes.filter((b) => b.id !== from && b.id !== to).map((b) => b.box), 4, c.height - 4));

  const picture = (
    <svg ref={svgRef} viewBox={vb} style={svgBox(c.width, scale)} role="group" aria-label={label}>
      {/* wires into gates, each routed round the gates it does not touch */}
      {c.gates.map((g) =>
        g.inputs.map((src, i) => {
          const s = sourcePin(c, src);
          if (!s) return null;
          const p = gateInputPin(g.type, g.inputs.length, i);
          const path = route(src, g.id, s.x, s.y, g.x + p.x, g.y + p.y);
          return <Wire key={`${g.id}-${i}`} x1={s.x} y1={s.y} x2={g.x + p.x} y2={g.y + p.y} value={wireVal(src)} path={path} />;
        }),
      )}
      {/* wires into bulbs */}
      {c.outputs.map((o) => {
        const s = sourcePin(c, o.source);
        if (!s) return null;
        const path = route(o.source, null, s.x, s.y, o.x - BULB_PIN, o.y);
        return <Wire key={`o-${o.id}`} x1={s.x} y1={s.y} x2={o.x - BULB_PIN} y2={o.y} value={wireVal(o.source)} path={path} />;
      })}

      {c.gates.map((g) => {
        if (!movable) return <GateGlyph key={g.id} type={g.type} n={g.inputs.length} x={g.x} y={g.y} label={g.label} />;
        const { w, h } = gateSize(g.type, g.inputs.length);
        return (
          <g key={g.id} onPointerDown={grab(g.id, g.x, g.y)} onPointerMove={move} onPointerUp={drop} onPointerCancel={drop}
            style={{ cursor: drag.current?.id === g.id ? "grabbing" : "grab", touchAction: "none" }}>
            <rect x={g.x - 4} y={g.y - h / 2 - 4} width={w + 12} height={h + 8} fill="transparent" />
            <GateGlyph type={g.type} n={g.inputs.length} x={g.x} y={g.y} label={g.label} />
          </g>
        );
      })}

      {/* value digits after every source pin */}
      {values &&
        [...c.inputs.map((i) => i.id), ...c.gates.map((g) => g.id)].map((id) => {
          const p = sourcePin(c, id)!;
          return <ValueDigit key={`v-${id}`} x={p.x} y={p.y} value={values[id]} />;
        })}

      {c.inputs.map((inp) => {
        const isLocked = locked.includes(inp.id);
        const fn = onSwitch && !isLocked ? () => onSwitch(inp.id) : undefined;
        return (
          <g key={inp.id} {...tap(fn)} aria-label={fn ? `Switch ${inp.label}, ${switches[inp.id] === 1 ? "up" : "down"}. Tap to flip.` : undefined}>
            {/* generous invisible hit area for fingers */}
            {fn && <rect x={inp.x - 22} y={inp.y - 22} width={40} height={44} fill="transparent" />}
            <SwitchGlyph x={inp.x} y={inp.y} label={inp.label} value={switches[inp.id] ?? null} locked={isLocked} />
          </g>
        );
      })}

      {c.outputs.map((o) => {
        const fn = onBulb ? () => onBulb(o.id) : undefined;
        return (
          <g key={o.id} {...tap(fn)} aria-label={fn ? `Bulb ${o.label}. Tap to change your answer.` : undefined}>
            {fn && <rect x={o.x - 16} y={o.y - 20} width={36} height={40} fill="transparent" />}
            <BulbGlyph x={o.x} y={o.y} label={o.label} value={bulbs[o.id]} mark={bulbMarks[o.id]} digit={bulbDigits} />
          </g>
        );
      })}

      {tags.map((t) => {
        const p = sourcePin(c, t.wire);
        if (!p) return null;
        return <WireTag key={`t-${t.wire}`} x={p.x + 4} y={p.y} label={t.label} value={t.value} onTap={t.onTap} tone={t.tone} maxX={c.width} place={t.place} />;
      })}
    </svg>
  );
  if (!movable || c0.gates.length === 0) return picture;
  return (
    <>
      {picture}
      <div style={{ fontSize: 12.5, color: "var(--muted)", textAlign: "center", marginTop: 4 }}>
        {MSG.dragGates}{" "}
        {Object.keys(moved).length > 0 && (
          <button type="button" onClick={() => setMoved({})}
            style={{ font: "inherit", color: "var(--accent)", background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline" }}>
            {MSG.dragReset}
          </button>
        )}
      </div>
    </>
  );
}
