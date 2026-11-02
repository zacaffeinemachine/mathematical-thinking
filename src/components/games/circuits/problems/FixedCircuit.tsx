// Draws a fixed (author-given) circuit. Every non-builder component uses
// this, and so does the static <CircuitPicture> helper. It holds no state:
// the caller decides what each switch, wire and bulb shows.

import type { Bit, Circuit } from "../model";
import { BULB_PIN, gateInputPin, sourcePin } from "./layout";
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
}

export default function FixedCircuit({
  circuit: c,
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
}: FixedViewProps) {
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

  return (
    <svg viewBox={vb} style={svgBox(c.width, scale)} role="group" aria-label={label}>
      {/* wires into gates */}
      {c.gates.map((g) =>
        g.inputs.map((src, i) => {
          const s = sourcePin(c, src);
          if (!s) return null;
          const p = gateInputPin(g.type, g.inputs.length, i);
          return <Wire key={`${g.id}-${i}`} x1={s.x} y1={s.y} x2={g.x + p.x} y2={g.y + p.y} value={wireVal(src)} />;
        }),
      )}
      {/* wires into bulbs */}
      {c.outputs.map((o) => {
        const s = sourcePin(c, o.source);
        if (!s) return null;
        return <Wire key={`o-${o.id}`} x1={s.x} y1={s.y} x2={o.x - BULB_PIN} y2={o.y} value={wireVal(o.source)} />;
      })}

      {c.gates.map((g) => (
        <GateGlyph key={g.id} type={g.type} n={g.inputs.length} x={g.x} y={g.y} label={g.label} />
      ))}

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
}
