// The student builds a circuit on a canvas: switches on the left, bulbs on
// the right, gates from a palette in between. Every wire shows its live value
// as the switches are flipped. Check compares the complete truth table with
// the target, then the limits. On a wrong table the switches jump to the
// first wrong row and the wrong bulb is marked.
//
// Interaction (mouse, pen and touch all go through pointer events):
//   tap a palette gate          add it to the canvas
//   drag a gate                 move it
//   drag from a pin to a pin    draw a wire (either direction)
//   tap a pin, then a pin       draw a wire without dragging
//   drag a wire's input end     move it to another pin, or drop it to delete
//   tap a gate or a wire        select it, then tap its x badge (or Delete)
//   tap a switch                flip it
//
// A problem may also offer boxes (the `boxes` prop): sealed parts with several
// labelled pins in and out, such as an adder, placed and wired like gates. A
// box is not a gate and does not count toward the gate count. Each output pin
// of a box is a source whose id is "<box id>.<k>".
// Work is saved in localStorage under the id prop (see storage.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bit, GateType } from "../model";
import {
  ALL_GATES,
  checkNet,
  parseColumn,
  circuitDepth,
  evaluateNet,
  resolveTarget,
  rowCount,
  rowIndex,
  tableOfNet,
  wouldLoop,
  type CheckResult,
  type Column,
  type Net,
  type NetGate,
  type TargetSpec,
} from "./engine";
import {
  BULB_PIN,
  SWITCH_PIN,
  boxInputPin,
  boxOutputPin,
  boxSize,
  distToWire,
  gateInputPin,
  gateOutputPin,
  gateSize,
  wirePath,
  wirePoint,
} from "./layout";
import { BoxGlyph, BulbGlyph, GateGlyph, GateIcon, HILITE, MONO, PinDot, SwitchGlyph, ValueDigit, Wire, WRONG, type BulbMark } from "./glyphs";
import { TableView } from "./helpers";
import { MSG } from "./messages";
import { usePersistent } from "./storage";
import { AuthorError, Button, Row, Status } from "./ui";

// ---- types -------------------------------------------------------------------

type Named = string | { id: string; label?: string };

export interface StartDesign {
  gates: { id: string; type: GateType; x: number; y: number; inputs?: number }[];
  wires: { from: string; to: string; pin?: number }[];
}

// A sealed part with several pins in and out. Its behaviour is a table: one
// column per output pin, over every setting of its input pins in the usual
// row order (the first input pin listed changes slowest).
export interface BoxPart {
  type: string;          // key, unique among the boxes of one problem; saved work refers to it
  title: string;         // drawn in the box's title band and on its palette button
  inputs: string[];      // input pin labels, top to bottom
  outputs: string[];     // output pin labels, top to bottom
  table: Column[];       // one column per output pin
  gap?: number;          // leave a small space after this many input pins (default none)
  max?: number;          // most of these on the canvas at once (default 1)
  required?: boolean;    // a right table is accepted only once a box of this kind is in use
}

// Switches in rows and bulbs in a row along the bottom, column by column, as
// in written addition. Each switch and each bulb appears exactly once. A cell
// is a switch id, null for an empty cell, or { text } for a sign such as "+".
export type GridCell = string | null | { text: string };
export interface BuilderGrid {
  rows: GridCell[][];          // switch rows, top to bottom
  bulbs: (string | null)[];    // the bulb row, in the same columns
}

export interface CircuitBuilderProps {
  id: string;                                  // unique on the page; work is saved under it
  inputs: Named[];                             // switches, top to bottom, in truth-table order
  outputs?: Named[];                           // bulbs, top to bottom (default one bulb "out")
  target: TargetSpec;                          // see engine.ts; in MDX use a string, an object of strings, or tableOf(...)
  gates?: GateType[];                          // the palette (default NOT, AND, OR, XOR)
  maxGates?: number;
  fewest?: number;                             // the proven smallest gate count; no limit, but a right answer
                                               // with more gates is told that fewer will do
  maxDepth?: number;
  maxPerType?: Partial<Record<GateType, number>>;
  maxFanIn?: number;                           // default 2; above 2 a selected gate can grow more inputs
  showDepth?: boolean;                         // show the depth even with no depth limit
  showTarget?: boolean;                        // print the target table above the canvas
  start?: StartDesign;                         // gates and wires already on the canvas at the start
  boxes?: BoxPart[];                           // sealed parts offered beside the gates
  grid?: BuilderGrid;                          // switches and bulbs in aligned columns instead of two side columns
  width?: number;                              // logical canvas size (default 600 wide)
  height?: number;
}

interface BGate { id: string; type: GateType | "BOX"; x: number; y: number; n: number; box?: string }
interface BWire { from: string; to: string; pin: number }
interface Design { gates: BGate[]; wires: BWire[] }
interface Saved { design: Design; switches: Record<string, Bit>; solved: boolean }

type Src = { kind: "src"; id: string };
type Snk = { kind: "snk"; to: string; pin: number };
type End = Src | Snk;

type Drag =
  | { kind: "move"; id: string; offX: number; offY: number; cx: number; cy: number; moved: boolean; before: Design }
  | { kind: "wire"; end: End; cx: number; cy: number; moved: boolean }
  | { kind: "grab"; wire: BWire; cx: number; cy: number }   // pressed on a wired input pin
  | { kind: "switch"; id: string; cx: number; cy: number; moved: boolean };

type Sel = { kind: "gate"; id: string } | { kind: "wire"; to: string; pin: number } | null;

const DEFAULT_PALETTE: GateType[] = ["NOT", "AND", "OR", "XOR"];
const TAP_PX = 6;
const SNAP = 5;

const named = (x: Named) => (typeof x === "string" ? { id: x, label: x } : { id: x.id, label: x.label ?? x.id });
// "g3" is gate g3's output. "g3.1" is output pin 1 of box g3.
const splitSrc = (sid: string): { gid: string; k: number } => {
  const i = sid.indexOf(".");
  return i < 0 ? { gid: sid, k: 0 } : { gid: sid.slice(0, i), k: Number(sid.slice(i + 1)) };
};
const sameEnd = (a: End | null, b: End | null) =>
  !!a && !!b && (a.kind === "src" && b.kind === "src" ? a.id === b.id : a.kind === "snk" && b.kind === "snk" ? a.to === b.to && a.pin === b.pin : false);

// ---- component -----------------------------------------------------------------

export default function CircuitBuilder(props: CircuitBuilderProps) {
  const {
    id, target, gates: palette = DEFAULT_PALETTE, maxGates, fewest, maxDepth, maxPerType, maxFanIn = 2,
    showDepth = false, showTarget = false, start,
  } = props;
  const ins = useMemo(() => (props.inputs ?? []).map(named), [props.inputs]);
  const outs = useMemo(() => (props.outputs ?? ["out"]).map(named), [props.outputs]);
  const inIds = ins.map((i) => i.id);
  const outIds = outs.map((o) => o.id);

  // ---- canvas geometry ----
  // On a narrow screen the canvas gets fewer logical units across, so the
  // gates are drawn bigger instead of being shrunk to fit. Gates that would
  // fall off the right edge are pulled back in (see the effect below).
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState<number | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const fullW = props.width ?? 600;
  const W = boxW !== null && boxW < fullW * 0.8 ? Math.min(fullW, Math.max(380, Math.round(boxW / 0.8))) : fullW;
  const grid = props.grid;
  const gCols = grid ? Math.max(1, grid.bulbs.length, ...grid.rows.map((r) => r.length)) : 0;
  const GRID_ROW = 58;
  const bandTop = grid ? 30 + grid.rows.length * GRID_ROW : 0;
  const H = props.height ?? (grid ? bandTop + 130 + 40 * gCols + 74 : Math.max(240, 64 * Math.max(ins.length, outs.length) + 64));
  const inLabelW = Math.max(8, ...ins.map((i) => i.label.length * 8));
  const outLabelW = Math.max(8, ...outs.map((o) => o.label.length * 8));
  const switchX = Math.round(inLabelW + 30);
  const bulbX = Math.round(W - outLabelW - 30);
  const spread = (k: number, n: number) => (n === 1 ? H / 2 : 44 + (k * (H - 88)) / (n - 1));
  // Grid mode: column centres, switch rows from the top, the bulb row at the bottom.
  const bulbRowY = H - 44;
  const colX = (c: number) => {
    // Columns at most 150 apart, the grid centred, as a sum is set out on paper.
    const L = inLabelW + 40, R = W - outLabelW - 34;
    const gap = gCols === 1 ? 0 : Math.min(150, (R - L) / (gCols - 1));
    return Math.round((L + R) / 2 - (gap * (gCols - 1)) / 2 + c * gap);
  };
  const rowY = (r: number) => 44 + r * GRID_ROW;
  const sw = useMemo(() => {
    if (!grid) return Object.fromEntries(ins.map((i, k) => [i.id, { x: switchX, y: Math.round(spread(k, ins.length)) }]));
    const m: Record<string, { x: number; y: number }> = {};
    grid.rows.forEach((row, r) => row.forEach((cell, c) => { if (typeof cell === "string") m[cell] = { x: colX(c), y: rowY(r) }; }));
    return m;
  }, [ins, switchX, H, W, JSON.stringify(grid ?? null)]);
  const bl = useMemo(() => {
    if (!grid) return Object.fromEntries(outs.map((o, k) => [o.id, { x: bulbX, y: Math.round(spread(k, outs.length)) }]));
    const m: Record<string, { x: number; y: number }> = {};
    grid.bulbs.forEach((id, c) => { if (id) m[id] = { x: colX(c), y: bulbRowY }; });
    return m;
  }, [outs, bulbX, H, W, JSON.stringify(grid ?? null)]);
  // Where gates may sit: their left edge from x0, their body between y0 and y1.
  const gateArea = grid ? { x0: 24, y0: bandTop, y1: bulbRowY - 30 } : { x0: switchX + 34, y0: 6, y1: H - 6 };
  const gridError = (() => {
    if (!grid) return null;
    const cells = grid.rows.flat().filter((c): c is string => typeof c === "string");
    for (const i of ins) if (cells.filter((c) => c === i.id).length !== 1) return `The grid must hold the switch "${i.id}" exactly once.`;
    const stray = cells.find((c) => !ins.some((i) => i.id === c));
    if (stray) return `The grid holds "${stray}", which is not a switch.`;
    for (const o of outs) if (grid.bulbs.filter((b) => b === o.id).length !== 1) return `The grid's bulb row must hold the bulb "${o.id}" exactly once.`;
    const strayB = grid.bulbs.find((b) => b && !outs.some((o) => o.id === b));
    if (strayB) return `The grid's bulb row holds "${strayB}", which is not a bulb.`;
    return null;
  })();

  // ---- the target, resolved once ----
  const resolved = useMemo(() => resolveTarget(target, inIds, outIds), [JSON.stringify(target ?? null), inIds.join(","), outIds.join(",")]);

  // ---- boxes ----
  const boxList = props.boxes ?? [];
  const boxKey = JSON.stringify(boxList);
  const parts = useMemo(() => new Map(boxList.map((b) => [b.type, b])), [boxKey]);
  const boxTables = useMemo((): { ok: true; luts: Map<string, Bit[][]> } | { ok: false; error: string } => {
    const luts = new Map<string, Bit[][]>();
    for (const b of boxList) {
      if (!b.type || b.type.includes(".")) return { ok: false, error: `A box needs a type with no dot in it, got "${b.type}".` };
      if (luts.has(b.type)) return { ok: false, error: `Two boxes have the type "${b.type}".` };
      if (b.inputs.length < 1 || b.inputs.length > 8) return { ok: false, error: `The box "${b.type}" needs 1 to 8 input pins.` };
      if (b.table.length !== b.outputs.length) return { ok: false, error: `The box "${b.type}" has ${b.outputs.length} output pins but ${b.table.length} table columns.` };
      const cols: Bit[][] = [];
      for (let k = 0; k < b.table.length; k++) {
        const c = parseColumn(b.table[k], 1 << b.inputs.length, `${b.type} pin ${b.outputs[k]}`);
        if (typeof c === "string") return { ok: false, error: c };
        cols.push(c);
      }
      luts.set(b.type, cols);
    }
    return { ok: true, luts };
  }, [boxKey]);
  const partOf = (g: BGate): BoxPart | undefined => (g.type === "BOX" && g.box ? parts.get(g.box) : undefined);
  const sizeOf = (g: BGate) => {
    const p = partOf(g);
    return p ? boxSize(p.inputs.length, p.outputs.length, p.gap ?? 0) : gateSize(g.type as GateType, g.n);
  };
  const inPinOf = (g: BGate, pin: number) => {
    const p = partOf(g);
    return p ? boxInputPin(p.inputs.length, p.outputs.length, p.gap ?? 0, pin) : gateInputPin(g.type as GateType, g.n, pin);
  };
  const outPinOf = (g: BGate, k: number) => {
    const p = partOf(g);
    return p ? boxOutputPin(p.inputs.length, p.outputs.length, p.gap ?? 0, k) : gateOutputPin(g.type as GateType, g.n);
  };
  // The source ids a gate or box drives.
  const srcIdsOf = (g: BGate): string[] => {
    const p = partOf(g);
    return p ? p.outputs.map((_, k) => `${g.id}.${k}`) : [g.id];
  };

  // ---- saved state ----
  const startDesign = useCallback((): Design => ({
    gates: (start?.gates ?? []).map((g) => ({ id: g.id, type: g.type, x: g.x, y: g.y, n: g.type === "NOT" ? 1 : Math.max(2, g.inputs ?? 2) })),
    wires: (start?.wires ?? []).map((w) => ({ from: w.from, to: w.to, pin: w.pin ?? 0 })),
  }), [start]);
  const fresh = (): Saved => ({ design: startDesign(), switches: Object.fromEntries(inIds.map((i) => [i, 0 as Bit])), solved: false });
  const revive = (s: unknown): Saved | null => {
    const v = s as Saved;
    if (!v || !v.design || !Array.isArray(v.design.gates) || !Array.isArray(v.design.wires)) return null;
    const seen = new Map<string, number>();
    const gates = v.design.gates.filter((g) => {
      if (!g || typeof g.id !== "string" || g.id.includes(".") || !Number.isFinite(g.x) || !Number.isFinite(g.y)) return false;
      if (g.type !== "BOX") return ALL_GATES.includes(g.type);
      const p = typeof g.box === "string" ? parts.get(g.box) : undefined;
      if (!p) return false;
      const k = (seen.get(p.type) ?? 0) + 1;
      seen.set(p.type, k);
      return k <= (p.max ?? 1);
    }).map((g) => (g.type === "BOX"
      ? { id: g.id, type: "BOX" as const, x: g.x, y: g.y, box: g.box, n: parts.get(g.box!)!.inputs.length }
      : { ...g, n: g.type === "NOT" ? 1 : Math.min(Math.max(2, g.n | 0), Math.max(2, maxFanIn)) }));
    const gIds = new Map(gates.map((g) => [g.id, g]));
    const validSrc = (from: unknown) => {
      if (typeof from !== "string") return false;
      if (inIds.includes(from)) return true;
      const { gid, k } = splitSrc(from);
      const g = gIds.get(gid);
      if (!g) return false;
      if (g.type !== "BOX") return from === gid;
      return from !== gid && Number.isInteger(k) && k >= 0 && k < parts.get(g.box!)!.outputs.length;
    };
    const wires = v.design.wires.filter((w) =>
      w && validSrc(w.from) &&
      ((outIds.includes(w.to) && w.pin === 0) || (gIds.has(w.to) && w.pin >= 0 && w.pin < gIds.get(w.to)!.n)));
    const switches = Object.fromEntries(inIds.map((i) => [i, (v.switches?.[i] === 1 ? 1 : 0) as Bit]));
    return { design: { gates, wires }, switches, solved: !!v.solved };
  };
  const [saved, setSaved, resetSaved] = usePersistent<Saved>(id, "builder", fresh, revive);
  const design = saved.design;

  // ---- UI state ----
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [armed, setArmed] = useState<End | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hot, setHot] = useState<End | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showMine, setShowMine] = useState(false);
  const undo = useRef<Design[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // ---- the net and its live values ----
  const net: Net = useMemo(() => {
    const ins: Record<string, (string | null)[]> = {};
    for (const g of design.gates) ins[g.id] = Array(g.n).fill(null);
    const outSrc: Record<string, string | null> = Object.fromEntries(outIds.map((o) => [o, null]));
    for (const w of design.wires) {
      if (ins[w.to]) ins[w.to][w.pin] = w.from;
      else if (w.to in outSrc) outSrc[w.to] = w.from;
    }
    const luts = boxTables.ok ? boxTables.luts : new Map<string, Bit[][]>();
    return {
      inputs: inIds,
      gates: design.gates.flatMap((g): NetGate[] => {
        const p = partOf(g);
        if (!p) return [{ id: g.id, type: g.type as GateType, inputs: ins[g.id] }];
        const cols = luts.get(p.type) ?? [];
        return p.outputs.map((_, k) => ({ id: `${g.id}.${k}`, type: "AND" as GateType, inputs: [...ins[g.id]], lut: cols[k], part: g.id }));
      }),
      outputs: outIds.map((o) => ({ id: o, source: outSrc[o] })),
    };
  }, [design, inIds.join(","), outIds.join(","), boxTables, parts]);
  const values = useMemo(() => evaluateNet(net, saved.switches), [net, saved.switches]);
  const depth = useMemo(() => circuitDepth(net), [net]);

  // ---- geometry of pins ----
  const gateById = useMemo(() => new Map(design.gates.map((g) => [g.id, g])), [design]);
  const srcPos = (sid: string): { x: number; y: number } | null => {
    if (sw[sid]) return { x: sw[sid].x + SWITCH_PIN, y: sw[sid].y };
    const { gid, k } = splitSrc(sid);
    const g = gateById.get(gid);
    if (g) { const p = outPinOf(g, k); return { x: g.x + p.x, y: g.y + p.y }; }
    return null;
  };
  const snkPos = (to: string, pin: number): { x: number; y: number } | null => {
    if (bl[to]) return { x: bl[to].x - BULB_PIN, y: bl[to].y };
    const g = gateById.get(to);
    if (g) { const p = inPinOf(g, pin); return { x: g.x + p.x, y: g.y + p.y }; }
    return null;
  };
  const endPos = (e: End) => (e.kind === "src" ? srcPos(e.id) : snkPos(e.to, e.pin));
  const allEnds = (): End[] => {
    const r: End[] = [];
    for (const i of inIds) r.push({ kind: "src", id: i });
    for (const g of design.gates) {
      for (const sid of srcIdsOf(g)) r.push({ kind: "src", id: sid });
      for (let p = 0; p < g.n; p++) r.push({ kind: "snk", to: g.id, pin: p });
    }
    for (const o of outIds) r.push({ kind: "snk", to: o, pin: 0 });
    return r;
  };
  const gateBox = (g: BGate) => {
    const { w, h } = sizeOf(g);
    return { x0: g.x - 2, y0: g.y - h / 2 - 4, x1: g.x + w + 8, y1: g.y + h / 2 + 4 };
  };
  // In grid mode a wire from a switch with another switch below it would
  // drop straight through that switch. It runs instead right into the lane
  // between columns, down past the last switch row, and then curves to its
  // pin. `pts` samples the route, for hit-testing and the delete badge.
  const wireGeom = (from: string, a: { x: number; y: number }, b: { x: number; y: number }): { d: string; pts: { x: number; y: number }[] } | null => {
    if (!grid || !sw[from]) return null;
    const lastY = rowY(grid.rows.length - 1);
    if (sw[from].y >= lastY - 1) return null;
    const yExit = lastY + 24, lx = a.x + 22;
    const k = Math.max(24, (b.y - yExit) * 0.5);
    const dx = Math.max(18, Math.abs(b.x - lx) * 0.45);
    const d = `M ${a.x} ${a.y} H ${lx - 6} Q ${lx} ${a.y} ${lx} ${a.y + 6} V ${yExit} C ${lx} ${yExit + k}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 6; i++) pts.push({ x: a.x + ((lx - a.x) * i) / 6, y: a.y });
    for (let i = 1; i <= 10; i++) pts.push({ x: lx, y: a.y + ((yExit - a.y) * i) / 10 });
    for (let i = 1; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      pts.push({
        x: u * u * u * lx + 3 * u * u * t * lx + 3 * u * t * t * (b.x - dx) + t * t * t * b.x,
        y: u * u * u * yExit + 3 * u * u * t * (yExit + k) + 3 * u * t * t * b.y + t * t * t * b.y,
      });
    }
    return { d, pts };
  };
  const wireAt = (to: string, pin: number) => design.wires.find((w) => w.to === to && w.pin === pin);

  // ---- editing ----
  const commit = (next: Design, keepResult = false) => {
    undo.current.push(design);
    if (undo.current.length > 60) undo.current.shift();
    setSaved((s) => ({ ...s, design: next }));
    if (!keepResult) setResult(null);
  };
  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    setSaved((s) => ({ ...s, design: prev }));
    setSel(null); setArmed(null); setResult(null); setNotice(null);
  };

  const freeSpot = ({ w, h }: { w: number; h: number }): { x: number; y: number } => {
    const xMin = grid ? 40 : switchX + 50, xMax = grid ? W - 40 - w : bulbX - 60 - w;
    const yMin = grid ? gateArea.y0 + h / 2 + 4 : 30, yMax = grid ? gateArea.y1 - h / 2 - 4 : H - 30;
    const cands: { x: number; y: number; d: number }[] = [];
    for (let x = xMin; x <= xMax; x += 20) for (let y = yMin; y <= yMax; y += 20)
      cands.push({ x, y, d: Math.hypot(x - (xMin + xMax) / 2, (y - (yMin + yMax) / 2) * 1.6) });
    cands.sort((a, b) => a.d - b.d);
    const clear = (c: { x: number; y: number }) => design.gates.every((g) => {
      const b = gateBox(g);
      return c.x + w + 30 < b.x0 || c.x > b.x1 + 30 || c.y + h / 2 + 14 < b.y0 || c.y - h / 2 - 14 > b.y1;
    });
    const c = cands.find(clear) ?? cands[0] ?? { x: (xMin + xMax) / 2, y: (yMin + yMax) / 2 };
    return { x: Math.round(c.x / SNAP) * SNAP, y: Math.round(c.y / SNAP) * SNAP };
  };
  const newGateId = () => {
    const taken = new Set([...inIds, ...outIds, ...design.gates.map((g) => g.id)]);
    let k = 1;
    while (taken.has(`g${k}`)) k++;
    return `g${k}`;
  };
  const place = (g: BGate) => {
    commit({ ...design, gates: [...design.gates, g] });
    setSel({ kind: "gate", id: g.id });
    setArmed(null); setNotice(null);
  };
  const addGate = (type: GateType) => {
    const n = type === "NOT" ? 1 : 2;
    const p = freeSpot(gateSize(type, n));
    place({ id: newGateId(), type, x: p.x, y: p.y, n });
  };
  const boxesOf = (t: string) => design.gates.filter((g) => g.type === "BOX" && g.box === t).length;
  const addBox = (b: BoxPart) => {
    if (boxesOf(b.type) >= (b.max ?? 1)) return;
    const p = freeSpot(boxSize(b.inputs.length, b.outputs.length, b.gap ?? 0));
    place({ id: newGateId(), type: "BOX", box: b.type, x: p.x, y: p.y, n: b.inputs.length });
  };
  const deleteSel = () => {
    if (!sel) return;
    if (sel.kind === "gate") {
      commit({ gates: design.gates.filter((g) => g.id !== sel.id), wires: design.wires.filter((w) => splitSrc(w.from).gid !== sel.id && w.to !== sel.id) });
    } else {
      commit({ ...design, wires: design.wires.filter((w) => !(w.to === sel.to && w.pin === sel.pin)) });
    }
    setSel(null);
  };
  const setFanIn = (gid: string, n: number) => {
    const g = gateById.get(gid);
    if (!g || g.type === "NOT" || g.type === "BOX") return;
    const m = Math.min(Math.max(2, n), Math.max(2, maxFanIn));
    if (m === g.n) return;
    commit({
      gates: design.gates.map((x) => (x.id === gid ? { ...x, n: m } : x)),
      wires: design.wires.filter((w) => !(w.to === gid && w.pin >= m)),
    });
  };
  const connect = (a: End, b: End): boolean => {
    const src = a.kind === "src" ? a : b.kind === "src" ? b : null;
    const snk = a.kind === "snk" ? a : b.kind === "snk" ? b : null;
    if (!src || !snk) return false;
    const sinkGate = gateById.get(snk.to);
    if (sinkGate && srcIdsOf(sinkGate).some((t) => wouldLoop(net, src.id, t))) { setNotice(MSG.loop); return false; }
    const wires = design.wires.filter((w) => !(w.to === snk.to && w.pin === snk.pin));
    wires.push({ from: src.id, to: snk.to, pin: snk.pin });
    commit({ ...design, wires });
    setNotice(null);
    return true;
  };
  const flip = (sid: string) => {
    setSaved((s) => ({ ...s, switches: { ...s.switches, [sid]: (s.switches[sid] ^ 1) as Bit } }));
    setResult(null);
  };

  // ---- pointer handling ----
  const toLocal = (e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM();
    if (!m) return { x: 0, y: 0, s: 1 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y, s: m.a || 1 };
  };
  const radius = (e: React.PointerEvent, s: number) => (e.pointerType === "touch" ? 22 : e.pointerType === "pen" ? 14 : 11) / s;
  const nearestEnd = (x: number, y: number, R: number, want?: "src" | "snk"): { end: End; d: number } | null => {
    let best: { end: End; d: number } | null = null;
    for (const end of allEnds()) {
      if (want && end.kind !== want) continue;
      const p = endPos(end)!;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= R && (!best || d < best.d)) best = { end, d };
    }
    return best;
  };
  const badgePos = (): { x: number; y: number } | null => {
    if (!sel) return null;
    if (sel.kind === "gate") {
      const g = gateById.get(sel.id);
      if (!g) return null;
      const b = gateBox(g);
      return { x: b.x1 + 2, y: b.y0 - 6 };
    }
    const w = wireAt(sel.to, sel.pin);
    if (!w) return null;
    const a = srcPos(w.from), b = snkPos(w.to, w.pin);
    if (!a || !b) return null;
    const geom = wireGeom(w.from, a, b);
    const m = geom ? geom.pts[Math.floor(geom.pts.length * 0.6)] : wirePoint(a.x, a.y, b.x, b.y, 0.5);
    return { x: m.x, y: m.y - 14 };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const { x, y, s } = toLocal(e);
    const R = radius(e, s);
    svgRef.current?.setPointerCapture(e.pointerId);
    svgRef.current?.focus({ preventScroll: true });
    setPointer({ x, y });
    setNotice(null);

    // 1. the delete badge of the selection
    const bp = badgePos();
    if (bp && Math.hypot(bp.x - x, bp.y - y) <= Math.max(11, R * 0.8)) { deleteSel(); return; }

    // 2. pins, unless the press is well inside a gate body
    const near = nearestEnd(x, y, R);
    const inBody = design.gates.find((g) => { const b = gateBox(g); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; });
    const pinWins = near && (!inBody || near.d <= 9);
    if (armed) {
      if (pinWins && near) {
        if (sameEnd(near.end, armed)) { setArmed(null); return; }
        if (near.end.kind !== armed.kind) { connect(armed, near.end); setArmed(null); return; }
      }
      setArmed(null);
    }
    if (pinWins && near) {
      setSel(null);
      const end = near.end;
      if (end.kind === "snk") {
        const w = wireAt(end.to, end.pin);
        if (w) { setDrag({ kind: "grab", wire: w, cx: e.clientX, cy: e.clientY }); return; }
      }
      setDrag({ kind: "wire", end, cx: e.clientX, cy: e.clientY, moved: false });
      return;
    }

    // 3. a switch
    for (const i of inIds) {
      const p = sw[i];
      if (x >= p.x - 22 && x <= p.x + 13 && y >= p.y - 20 && y <= p.y + 20) {
        setDrag({ kind: "switch", id: i, cx: e.clientX, cy: e.clientY, moved: false });
        return;
      }
    }

    // 4. a gate body (topmost first)
    if (inBody) {
      const g = [...design.gates].reverse().find((g) => { const b = gateBox(g); return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; })!;
      setSel({ kind: "gate", id: g.id });
      setDrag({ kind: "move", id: g.id, offX: x - g.x, offY: y - g.y, cx: e.clientX, cy: e.clientY, moved: false, before: design });
      return;
    }

    // 5. a wire
    let bestW: { w: BWire; d: number } | null = null;
    for (const w of design.wires) {
      const a = srcPos(w.from), b = snkPos(w.to, w.pin);
      if (!a || !b) continue;
      const geom = wireGeom(w.from, a, b);
      const d = geom ? Math.min(...geom.pts.map((p) => Math.hypot(p.x - x, p.y - y))) : distToWire(x, y, a.x, a.y, b.x, b.y);
      if (d <= Math.max(6, R * 0.6) && (!bestW || d < bestW.d)) bestW = { w, d };
    }
    if (bestW) { setSel({ kind: "wire", to: bestW.w.to, pin: bestW.w.pin }); return; }

    // 6. empty canvas
    setSel(null);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y, s } = toLocal(e);
    setPointer({ x, y });
    const far = (d: { cx: number; cy: number }) => Math.hypot(e.clientX - d.cx, e.clientY - d.cy) > TAP_PX;
    if (!drag) {
      if (armed) { const n = nearestEnd(x, y, radius(e, s), armed.kind === "src" ? "snk" : "src"); setHot(n ? n.end : null); }
      return;
    }
    if (drag.kind === "move") {
      if (!drag.moved && !far(drag)) return;
      const g = gateById.get(drag.id);
      if (!g) return;
      const { w, h } = sizeOf(g);
      const nx = Math.min(Math.max(gateArea.x0, Math.round((x - drag.offX) / SNAP) * SNAP), W - w - 20);
      const ny = Math.min(Math.max(gateArea.y0 + h / 2, Math.round((y - drag.offY) / SNAP) * SNAP), gateArea.y1 - h / 2);
      if (nx !== g.x || ny !== g.y)
        setSaved((st) => ({ ...st, design: { ...st.design, gates: st.design.gates.map((q) => (q.id === g.id ? { ...q, x: nx, y: ny } : q)) } }));
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag.kind === "grab") {
      if (!far(drag)) return;
      // Lift the wire off its pin: from now on it is a wire being drawn from its source.
      commit({ ...design, wires: design.wires.filter((w) => w !== drag.wire) });
      setDrag({ kind: "wire", end: { kind: "src", id: drag.wire.from }, cx: drag.cx, cy: drag.cy, moved: true });
      return;
    }
    if (drag.kind === "wire") {
      if (!drag.moved && far(drag)) setDrag({ ...drag, moved: true });
      const n = nearestEnd(x, y, radius(e, s), drag.end.kind === "src" ? "snk" : "src");
      setHot(n ? n.end : null);
      return;
    }
    if (drag.kind === "switch" && !drag.moved && far(drag)) setDrag({ ...drag, moved: true });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag;
    setDrag(null);
    setHot(null);
    if (!d) return;
    const { x, y, s } = toLocal(e);
    if (d.kind === "move") {
      if (d.moved) { undo.current.push(d.before); setResult(null); }
      return;
    }
    if (d.kind === "grab") { setSel({ kind: "wire", to: d.wire.to, pin: d.wire.pin }); return; }
    if (d.kind === "switch") { if (!d.moved) flip(d.id); return; }
    if (d.kind === "wire") {
      if (!d.moved) { setArmed(d.end); return; }
      const n = nearestEnd(x, y, radius(e, s), d.end.kind === "src" ? "snk" : "src");
      if (n) connect(d.end, n.end);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSel(); }
    else if (e.key === "Escape") { setArmed(null); setSel(null); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); }
  };

  // Keep every gate inside the canvas when the canvas narrows.
  useEffect(() => {
    const fix = (g: BGate) => Math.min(g.x, W - sizeOf(g).w - 20);
    if (design.gates.some((g) => fix(g) !== g.x))
      setSaved((st) => ({ ...st, design: { ...st.design, gates: st.design.gates.map((g) => ({ ...g, x: Math.max(gateArea.x0, fix(g)) })) } }));
  }, [W, design]);

  // Clear a stale selection after undo or delete.
  useEffect(() => {
    if (sel?.kind === "gate" && !gateById.has(sel.id)) setSel(null);
    if (sel?.kind === "wire" && !wireAt(sel.to, sel.pin)) setSel(null);
  }, [design]);

  // ---- check ----
  const check = () => {
    if (!resolved.ok) return;
    setArmed(null); setSel(null); setNotice(null);
    const r = checkNet(net, resolved.cols, { allowed: palette, maxGates, maxDepth, maxPerType, maxFanIn, needBox: boxList.some((b) => b.required) });
    setResult(r);
    if (r.status === "wrong") setSaved((s) => ({ ...s, switches: r.setting }));
    if (r.status === "ok") setSaved((s) => ({ ...s, solved: true }));
  };
  const reset = () => {
    resetSaved();
    undo.current = [];
    setSel(null); setArmed(null); setResult(null); setNotice(null);
  };

  // ---- author errors ----
  if (!resolved.ok) return <AuthorError>{resolved.error}</AuthorError>;
  if (!boxTables.ok) return <AuthorError>{boxTables.error}</AuthorError>;
  if (gridError) return <AuthorError>{gridError}</AuthorError>;
  if (!id) return <AuthorError>CircuitBuilder needs an id, unique on the page.</AuthorError>;
  if (ins.length === 0 || ins.length > 6) return <AuthorError>CircuitBuilder takes 1 to 6 switches.</AuthorError>;
  const clash = [...inIds, ...outIds].find((x, i, a) => a.indexOf(x) !== i);
  if (clash) return <AuthorError>The id "{clash}" is used twice among switches and bulbs.</AuthorError>;

  // ---- marks from the last check ----
  const bulbMarks: Record<string, BulbMark> = {};
  const badPins = new Set<string>();
  if (result?.status === "wrong") for (const w of result.wrong) bulbMarks[w.output] = { text: MSG.shouldBe(w.want), tone: "wrong" };
  if (result?.status === "unwired-output") for (const o of result.outputs) bulbMarks[o] = { text: "not wired", tone: "wrong" };
  if (result?.status === "empty-pin") for (const g of net.gates) if (result.gates.includes(g.id)) g.inputs.forEach((s, p) => { if (s == null) badPins.add(`${g.part ?? g.id}:${p}`); });
  if (result?.status === "ok") for (const o of outIds) bulbMarks[o] = { text: "", tone: "right" };

  const labelOf = (x: string) => ins.find((i) => i.id === x)?.label ?? outs.find((o) => o.id === x)?.label ?? x;
  const statusText = (r: CheckResult): { tone: "right" | "wrong"; text: string } => {
    switch (r.status) {
      case "ok": return { tone: "right", text: MSG.builderRight(r.rows) + (fewest === undefined ? "" : r.gates > fewest ? ` ${MSG.fewerPossible}` : ` ${MSG.fewestReached}`) };
      case "unwired-output": return { tone: "wrong", text: MSG.unwired(r.outputs.map(labelOf)) };
      case "empty-pin": return { tone: "wrong", text: boxList.length ? MSG.emptyPinBox : MSG.emptyPin };
      case "loop": return { tone: "wrong", text: MSG.loop };
      case "wrong": return { tone: "wrong", text: MSG.counterexample(ins.map((i) => `${i.label} = ${r.setting[i.id]}`).join(", ")) };
      case "not-allowed": return { tone: "wrong", text: MSG.notAllowed(r.type) };
      case "too-many-inputs": return { tone: "wrong", text: MSG.tooManyInputs(r.inputs, r.limit) };
      case "too-many-gates": return { tone: "wrong", text: MSG.tooManyGates(r.gates, r.limit) };
      case "too-deep": return { tone: "wrong", text: MSG.tooDeep(r.depth, r.limit) };
      case "too-many-of-type": return { tone: "wrong", text: MSG.tooManyOfType(r.type, r.count, r.limit) };
      case "box-unused": return { tone: "wrong", text: MSG.boxUnused };
      case "too-many-boxes": return { tone: "wrong", text: MSG.tooManyBoxes(r.boxes, r.limit) };
    }
  };

  // ---- drawing ----
  // The dashed wire that follows the pointer while a wire is being drawn,
  // and snaps to the pin it would connect to.
  const rubber = (() => {
    const end = drag?.kind === "wire" ? drag.end : !drag ? armed : null;
    if (!end) return null;
    const p = endPos(end);
    const q = hot ? endPos(hot) : pointer;
    if (!p || !q) return null;
    return end.kind === "src" ? wirePath(p.x, p.y, q.x, q.y) : wirePath(q.x, q.y, p.x, p.y);
  })();
  const selGate = sel?.kind === "gate" ? gateById.get(sel.id) : undefined;
  const badge = badgePos();
  const rowNow = rowIndex(inIds, saved.switches);
  const count = design.gates.filter((g) => g.type !== "BOX").length;

  return (
    <div ref={boxRef} className="not-prose circuit-builder" style={{ margin: "12px 0" }}>
      {showTarget && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
          <TableView
            inLabels={ins.map((i) => i.label)}
            cols={outs.map((o) => ({ label: o.label, bits: resolved.cols[o.id] }))}
            shown={Array.from({ length: rowCount(inIds) }, (_, r) => r)}
            highlight={[rowNow]}
            caption="The table to build. The tinted row is where the switches are now."
            compact
          />
        </div>
      )}

      {/* palette */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 2 }}>Add a gate:</span>
        {palette.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => addGate(t)}
            aria-label={`Add a ${t} gate`}
            className="rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
            style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px 2px 4px", background: "var(--surface)", fontSize: 12, fontWeight: 600, color: "var(--ink)" }}
          >
            <GateIcon type={t} size={0.9} />
            {t}
          </button>
        ))}
        {boxList.map((b) => (
          <button
            key={`box-${b.type}`}
            type="button"
            onClick={() => addBox(b)}
            disabled={boxesOf(b.type) >= (b.max ?? 1)}
            aria-label={`Add the box ${b.title}`}
            title={boxesOf(b.type) >= (b.max ?? 1) ? MSG.boxPlaced : undefined}
            className="rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors disabled:opacity-50 disabled:hover:border-[var(--rule)]"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px 2px 6px", background: "var(--surface)", fontSize: 12, fontWeight: 600, color: "var(--ink)" }}
          >
            <svg width={16} height={14} viewBox="0 0 16 14" aria-hidden="true">
              <rect x={1} y={1} width={14} height={12} rx={2} fill="var(--surface)" stroke="var(--gate-ink)" strokeWidth={1.3} />
              <path d="M 1 5 H 15" stroke="var(--gate-ink)" strokeWidth={1} />
            </svg>
            {b.title}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        tabIndex={0}
        role="application"
        aria-label="Circuit canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { setDrag(null); setHot(null); }}
        onPointerLeave={() => { if (!drag) setHot(null); }}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          maxWidth: W * 1.1,
          height: "auto",
          display: "block",
          margin: "0 auto",
          background: "var(--surface)",
          border: `1px solid ${result?.status === "ok" ? "var(--mcq-right)" : "var(--rule)"}`,
          borderRadius: 6,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          outline: "none",
          cursor: drag?.kind === "move" ? "grabbing" : "default",
        }}
      >
        <defs>
          <pattern id={`grid-${id}`} width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={10} cy={10} r={0.9} fill="var(--rule)" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill={`url(#grid-${id})`} />

        {/* wires */}
        {design.wires.map((w) => {
          const a = srcPos(w.from), b = snkPos(w.to, w.pin);
          if (!a || !b) return null;
          const isSel = sel?.kind === "wire" && sel.to === w.to && sel.pin === w.pin;
          return <Wire key={`${w.to}:${w.pin}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} value={values[w.from]} selected={isSel} path={wireGeom(w.from, a, b)?.d} />;
        })}

        {/* gates */}
        {design.gates.map((g) => {
          const isSel = sel?.kind === "gate" && sel.id === g.id;
          const p = partOf(g);
          return p
            ? <BoxGlyph key={g.id} title={p.title} inputs={p.inputs} outputs={p.outputs} gap={p.gap ?? 0} x={g.x} y={g.y} selected={isSel} />
            : <GateGlyph key={g.id} type={g.type as GateType} n={g.n} x={g.x} y={g.y} selected={isSel} />;
        })}

        {/* switches */}
        {ins.map((i) => (
          <g key={i.id} style={{ cursor: "pointer" }}>
            <SwitchGlyph x={sw[i.id].x} y={sw[i.id].y} label={i.label} value={saved.switches[i.id]} />
          </g>
        ))}

        {/* signs in the grid, such as the "+" of a written sum */}
        {grid?.rows.map((row, r) => row.map((cell, c) => (cell && typeof cell === "object" ? (
          <text key={`sign-${r}-${c}`} x={colX(c)} y={rowY(r) + 7} fontSize={22} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill="var(--muted)" style={{ pointerEvents: "none" }}>
            {cell.text}
          </text>
        ) : null)))}

        {/* bulbs */}
        {outs.map((o) => {
          const src = net.outputs.find((x) => x.id === o.id)!.source;
          return <BulbGlyph key={o.id} x={bl[o.id].x} y={bl[o.id].y} label={o.label} value={src == null ? undefined : values[src]} mark={bulbMarks[o.id]} />;
        })}

        {/* live digits */}
        {[...inIds, ...design.gates.flatMap(srcIdsOf)].map((sid) => {
          const p = srcPos(sid)!;
          return <ValueDigit key={`v-${sid}`} x={p.x} y={p.y} value={values[sid]} />;
        })}

        {/* pins */}
        {allEnds().map((end) => {
          const p = endPos(end)!;
          const k = end.kind === "src" ? `s:${end.id}` : `k:${end.to}:${end.pin}`;
          const filled = end.kind === "src" ? true : !!wireAt(end.to, end.pin);
          const isHot = sameEnd(end, hot) || sameEnd(end, armed);
          const bad = end.kind === "snk" && badPins.has(`${end.to}:${end.pin}`);
          return <PinDot key={k} x={p.x} y={p.y} filled={filled} hot={isHot} bad={bad} />;
        })}

        {/* the wire being drawn */}
        {rubber && <path d={rubber} fill="none" stroke={HILITE} strokeWidth={2} strokeDasharray="5 4" style={{ pointerEvents: "none" }} />}

        {/* delete badge */}
        {badge && (
          <g style={{ cursor: "pointer" }} aria-label="Delete the selected item">
            <circle cx={badge.x} cy={badge.y} r={10} fill="var(--surface)" stroke={WRONG} strokeWidth={1.6} />
            <path d={`M ${badge.x - 4} ${badge.y - 4} L ${badge.x + 4} ${badge.y + 4} M ${badge.x + 4} ${badge.y - 4} L ${badge.x - 4} ${badge.y + 4}`} stroke={WRONG} strokeWidth={1.8} />
          </g>
        )}
      </svg>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, minHeight: 18 }}>
        {armed ? MSG.wireHint : count === 0 ? MSG.emptyCanvas : MSG.builderHint}
      </div>

      {/* readouts */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, marginTop: 6, alignItems: "baseline" }}>
        <span>
          Gates: <strong style={{ color: maxGates !== undefined && count > maxGates ? WRONG : "var(--ink)" }}>{count}</strong>
          {maxGates !== undefined && <span style={{ color: "var(--muted)" }}> (at most {maxGates})</span>}
        </span>
        {(showDepth || maxDepth !== undefined) && (
          <span>
            Depth: <strong style={{ color: maxDepth !== undefined && depth > maxDepth ? WRONG : "var(--ink)" }}>{depth}</strong>
            {maxDepth !== undefined && <span style={{ color: "var(--muted)" }}> (at most {maxDepth})</span>}
          </span>
        )}
        {maxPerType && Object.entries(maxPerType).map(([t, lim]) => (
          <span key={t} style={{ color: "var(--muted)" }}>at most {lim} {t}</span>
        ))}
        {saved.solved && (
          <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", padding: "1px 8px", borderRadius: 999, border: "1px solid var(--mcq-right)", color: "var(--mcq-right)" }}>
            solved
          </span>
        )}
      </div>

      <Row>
        <Button main onClick={check}>Check</Button>
        <Button onClick={doUndo} disabled={undo.current.length === 0}>Undo</Button>
        <Button onClick={deleteSel} disabled={!sel}>Delete</Button>
        {selGate && selGate.type !== "NOT" && selGate.type !== "BOX" && maxFanIn > 2 && (
          <>
            <Button onClick={() => setFanIn(selGate.id, selGate.n + 1)} disabled={selGate.n >= maxFanIn}>More inputs</Button>
            <Button onClick={() => setFanIn(selGate.id, selGate.n - 1)} disabled={selGate.n <= 2}>Fewer inputs</Button>
          </>
        )}
        <Button onClick={() => setShowMine((v) => !v)} pressed={showMine}>My table</Button>
        <Button onClick={reset}>Reset</Button>
      </Row>

      {notice && <Status tone="wrong">{notice}</Status>}
      {result && !notice && <Status tone={statusText(result).tone}>{statusText(result).text}</Status>}

      {showMine && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
          <MineTable net={net} ins={ins} outs={outs} target={showTarget ? resolved.cols : null} rowNow={rowNow} />
        </div>
      )}
    </div>
  );
}

// The student's own table, computed from the circuit as it stands. A dot
// marks a row where a bulb is not yet reached by a complete path. When the
// target is on show anyway, cells that disagree with it are tinted.
function MineTable({
  net, ins, outs, target, rowNow,
}: {
  net: Net;
  ins: { id: string; label: string }[];
  outs: { id: string; label: string }[];
  target: Record<string, Bit[]> | null;
  rowNow: number;
}) {
  const t = tableOfNet(net);
  return (
    <TableView
      inLabels={ins.map((i) => i.label)}
      cols={outs.map((o) => ({ label: `${o.label} (yours)`, bits: t[o.id], tint: target ? target[o.id] : undefined }))}
      shown={Array.from({ length: rowCount(net.inputs) }, (_, r) => r)}
      highlight={[rowNow]}
      caption="What your circuit does on every row."
      compact
    />
  );
}
