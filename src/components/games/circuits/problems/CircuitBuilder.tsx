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
// Work is saved in localStorage under the id prop (see storage.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Bit, GateType } from "../model";
import {
  ALL_GATES,
  checkNet,
  circuitDepth,
  evaluateNet,
  resolveTarget,
  rowCount,
  rowIndex,
  tableOfNet,
  wouldLoop,
  type CheckResult,
  type Net,
  type TargetSpec,
} from "./engine";
import {
  BULB_PIN,
  SWITCH_PIN,
  distToWire,
  gateInputPin,
  gateOutputPin,
  gateSize,
  wirePath,
  wirePoint,
} from "./layout";
import { BulbGlyph, GateGlyph, GateIcon, HILITE, PinDot, SwitchGlyph, ValueDigit, Wire, WRONG, type BulbMark } from "./glyphs";
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
  width?: number;                              // logical canvas size (default 600 wide)
  height?: number;
}

interface BGate { id: string; type: GateType; x: number; y: number; n: number }
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
  const H = props.height ?? Math.max(240, 64 * Math.max(ins.length, outs.length) + 64);
  const inLabelW = Math.max(8, ...ins.map((i) => i.label.length * 8));
  const outLabelW = Math.max(8, ...outs.map((o) => o.label.length * 8));
  const switchX = Math.round(inLabelW + 30);
  const bulbX = Math.round(W - outLabelW - 30);
  const spread = (k: number, n: number) => (n === 1 ? H / 2 : 44 + (k * (H - 88)) / (n - 1));
  const sw = useMemo(() => Object.fromEntries(ins.map((i, k) => [i.id, { x: switchX, y: Math.round(spread(k, ins.length)) }])), [ins, switchX, H]);
  const bl = useMemo(() => Object.fromEntries(outs.map((o, k) => [o.id, { x: bulbX, y: Math.round(spread(k, outs.length)) }])), [outs, bulbX, H]);

  // ---- the target, resolved once ----
  const resolved = useMemo(() => resolveTarget(target, inIds, outIds), [JSON.stringify(target ?? null), inIds.join(","), outIds.join(",")]);

  // ---- saved state ----
  const startDesign = useCallback((): Design => ({
    gates: (start?.gates ?? []).map((g) => ({ id: g.id, type: g.type, x: g.x, y: g.y, n: g.type === "NOT" ? 1 : Math.max(2, g.inputs ?? 2) })),
    wires: (start?.wires ?? []).map((w) => ({ from: w.from, to: w.to, pin: w.pin ?? 0 })),
  }), [start]);
  const fresh = (): Saved => ({ design: startDesign(), switches: Object.fromEntries(inIds.map((i) => [i, 0 as Bit])), solved: false });
  const revive = (s: unknown): Saved | null => {
    const v = s as Saved;
    if (!v || !v.design || !Array.isArray(v.design.gates) || !Array.isArray(v.design.wires)) return null;
    const gates = v.design.gates.filter((g) => g && typeof g.id === "string" && ALL_GATES.includes(g.type) && Number.isFinite(g.x) && Number.isFinite(g.y))
      .map((g) => ({ ...g, n: g.type === "NOT" ? 1 : Math.min(Math.max(2, g.n | 0), Math.max(2, maxFanIn)) }));
    const gIds = new Map(gates.map((g) => [g.id, g]));
    const wires = v.design.wires.filter((w) =>
      w && (inIds.includes(w.from) || gIds.has(w.from)) &&
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
    return {
      inputs: inIds,
      gates: design.gates.map((g) => ({ id: g.id, type: g.type, inputs: ins[g.id] })),
      outputs: outIds.map((o) => ({ id: o, source: outSrc[o] })),
    };
  }, [design, inIds.join(","), outIds.join(",")]);
  const values = useMemo(() => evaluateNet(net, saved.switches), [net, saved.switches]);
  const depth = useMemo(() => circuitDepth(net), [net]);

  // ---- geometry of pins ----
  const gateById = useMemo(() => new Map(design.gates.map((g) => [g.id, g])), [design]);
  const srcPos = (sid: string): { x: number; y: number } | null => {
    if (sw[sid]) return { x: sw[sid].x + SWITCH_PIN, y: sw[sid].y };
    const g = gateById.get(sid);
    if (g) return { x: g.x + gateOutputPin(g.type, g.n).x, y: g.y };
    return null;
  };
  const snkPos = (to: string, pin: number): { x: number; y: number } | null => {
    if (bl[to]) return { x: bl[to].x - BULB_PIN, y: bl[to].y };
    const g = gateById.get(to);
    if (g) { const p = gateInputPin(g.type, g.n, pin); return { x: g.x + p.x, y: g.y + p.y }; }
    return null;
  };
  const endPos = (e: End) => (e.kind === "src" ? srcPos(e.id) : snkPos(e.to, e.pin));
  const allEnds = (): End[] => {
    const r: End[] = [];
    for (const i of inIds) r.push({ kind: "src", id: i });
    for (const g of design.gates) {
      r.push({ kind: "src", id: g.id });
      for (let p = 0; p < g.n; p++) r.push({ kind: "snk", to: g.id, pin: p });
    }
    for (const o of outIds) r.push({ kind: "snk", to: o, pin: 0 });
    return r;
  };
  const gateBox = (g: BGate) => {
    const { w, h } = gateSize(g.type, g.n);
    return { x0: g.x - 2, y0: g.y - h / 2 - 4, x1: g.x + w + 8, y1: g.y + h / 2 + 4 };
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

  const freeSpot = (type: GateType): { x: number; y: number } => {
    const { w, h } = gateSize(type, type === "NOT" ? 1 : 2);
    const xMin = switchX + 50, xMax = bulbX - 60 - w;
    const cands: { x: number; y: number; d: number }[] = [];
    for (let x = xMin; x <= xMax; x += 20) for (let y = 30; y <= H - 30; y += 20)
      cands.push({ x, y, d: Math.hypot(x - (xMin + xMax) / 2, (y - H / 2) * 1.6) });
    cands.sort((a, b) => a.d - b.d);
    const clear = (c: { x: number; y: number }) => design.gates.every((g) => {
      const b = gateBox(g);
      return c.x + w + 30 < b.x0 || c.x > b.x1 + 30 || c.y + h / 2 + 14 < b.y0 || c.y - h / 2 - 14 > b.y1;
    });
    const c = cands.find(clear) ?? cands[0] ?? { x: (xMin + xMax) / 2, y: H / 2 };
    return { x: Math.round(c.x / SNAP) * SNAP, y: Math.round(c.y / SNAP) * SNAP };
  };
  const addGate = (type: GateType) => {
    const taken = new Set([...inIds, ...outIds, ...design.gates.map((g) => g.id)]);
    let k = 1;
    while (taken.has(`g${k}`)) k++;
    const p = freeSpot(type);
    const g: BGate = { id: `g${k}`, type, x: p.x, y: p.y, n: type === "NOT" ? 1 : 2 };
    commit({ ...design, gates: [...design.gates, g] });
    setSel({ kind: "gate", id: g.id });
    setArmed(null); setNotice(null);
  };
  const deleteSel = () => {
    if (!sel) return;
    if (sel.kind === "gate") {
      commit({ gates: design.gates.filter((g) => g.id !== sel.id), wires: design.wires.filter((w) => w.from !== sel.id && w.to !== sel.id) });
    } else {
      commit({ ...design, wires: design.wires.filter((w) => !(w.to === sel.to && w.pin === sel.pin)) });
    }
    setSel(null);
  };
  const setFanIn = (gid: string, n: number) => {
    const g = gateById.get(gid);
    if (!g || g.type === "NOT") return;
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
    if (gateById.has(snk.to) && wouldLoop(net, src.id, snk.to)) { setNotice(MSG.loop); return false; }
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
    const m = wirePoint(a.x, a.y, b.x, b.y, 0.5);
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
      const d = distToWire(x, y, a.x, a.y, b.x, b.y);
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
      const { w, h } = gateSize(g.type, g.n);
      const nx = Math.min(Math.max(switchX + 34, Math.round((x - drag.offX) / SNAP) * SNAP), W - w - 20);
      const ny = Math.min(Math.max(h / 2 + 6, Math.round((y - drag.offY) / SNAP) * SNAP), H - h / 2 - 6);
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
    const fix = (g: BGate) => Math.min(g.x, W - gateSize(g.type, g.n).w - 20);
    if (design.gates.some((g) => fix(g) !== g.x))
      setSaved((st) => ({ ...st, design: { ...st.design, gates: st.design.gates.map((g) => ({ ...g, x: Math.max(switchX + 34, fix(g)) })) } }));
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
    const r = checkNet(net, resolved.cols, { allowed: palette, maxGates, maxDepth, maxPerType, maxFanIn });
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
  if (!id) return <AuthorError>CircuitBuilder needs an id, unique on the page.</AuthorError>;
  if (ins.length === 0 || ins.length > 6) return <AuthorError>CircuitBuilder takes 1 to 6 switches.</AuthorError>;
  const clash = [...inIds, ...outIds].find((x, i, a) => a.indexOf(x) !== i);
  if (clash) return <AuthorError>The id "{clash}" is used twice among switches and bulbs.</AuthorError>;

  // ---- marks from the last check ----
  const bulbMarks: Record<string, BulbMark> = {};
  const badPins = new Set<string>();
  if (result?.status === "wrong") for (const w of result.wrong) bulbMarks[w.output] = { text: MSG.shouldBe(w.want), tone: "wrong" };
  if (result?.status === "unwired-output") for (const o of result.outputs) bulbMarks[o] = { text: "not wired", tone: "wrong" };
  if (result?.status === "empty-pin") for (const g of net.gates) if (result.gates.includes(g.id)) g.inputs.forEach((s, p) => { if (s == null) badPins.add(`${g.id}:${p}`); });
  if (result?.status === "ok") for (const o of outIds) bulbMarks[o] = { text: "", tone: "right" };

  const labelOf = (x: string) => ins.find((i) => i.id === x)?.label ?? outs.find((o) => o.id === x)?.label ?? x;
  const statusText = (r: CheckResult): { tone: "right" | "wrong"; text: string } => {
    switch (r.status) {
      case "ok": return { tone: "right", text: MSG.builderRight(r.rows) + (fewest === undefined ? "" : r.gates > fewest ? ` ${MSG.fewerPossible}` : ` ${MSG.fewestReached}`) };
      case "unwired-output": return { tone: "wrong", text: MSG.unwired(r.outputs.map(labelOf)) };
      case "empty-pin": return { tone: "wrong", text: MSG.emptyPin };
      case "loop": return { tone: "wrong", text: MSG.loop };
      case "wrong": return { tone: "wrong", text: MSG.counterexample(ins.map((i) => `${i.label} = ${r.setting[i.id]}`).join(", ")) };
      case "not-allowed": return { tone: "wrong", text: MSG.notAllowed(r.type) };
      case "too-many-inputs": return { tone: "wrong", text: MSG.tooManyInputs(r.inputs, r.limit) };
      case "too-many-gates": return { tone: "wrong", text: MSG.tooManyGates(r.gates, r.limit) };
      case "too-deep": return { tone: "wrong", text: MSG.tooDeep(r.depth, r.limit) };
      case "too-many-of-type": return { tone: "wrong", text: MSG.tooManyOfType(r.type, r.count, r.limit) };
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
  const count = design.gates.length;

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
          return <Wire key={`${w.to}:${w.pin}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} value={values[w.from]} selected={isSel} />;
        })}

        {/* gates */}
        {design.gates.map((g) => (
          <GateGlyph key={g.id} type={g.type} n={g.n} x={g.x} y={g.y} selected={sel?.kind === "gate" && sel.id === g.id} />
        ))}

        {/* switches */}
        {ins.map((i) => (
          <g key={i.id} style={{ cursor: "pointer" }}>
            <SwitchGlyph x={sw[i.id].x} y={sw[i.id].y} label={i.label} value={saved.switches[i.id]} />
          </g>
        ))}

        {/* bulbs */}
        {outs.map((o) => {
          const src = net.outputs.find((x) => x.id === o.id)!.source;
          return <BulbGlyph key={o.id} x={bl[o.id].x} y={bl[o.id].y} label={o.label} value={src == null ? undefined : values[src]} mark={bulbMarks[o.id]} />;
        })}

        {/* live digits */}
        {[...inIds, ...design.gates.map((g) => g.id)].map((sid) => {
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
        {selGate && selGate.type !== "NOT" && maxFanIn > 2 && (
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
