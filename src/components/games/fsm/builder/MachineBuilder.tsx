// The student builds a machine on a canvas, in the look of the circuit
// builder (circuits/problems/CircuitBuilder.tsx): states are tinted
// circles, each with one coloured knob per symbol, and an arrow is drawn by
// dragging a knob onto a state. A state can never have two arrows for one
// symbol, because each knob carries exactly one arrow.
//
// Below the canvas a tape runs any string through the machine as it stands:
// the state the machine is in lights up like a bulb, and the arrow it just
// took glows. Check decides exactly whether the machine accepts the strings
// the problem asks for (engine.ts), and on a wrong machine loads the
// shortest string it gets wrong onto the tape.
//
// Interaction (mouse, pen and touch all go through pointer events):
//   tap Add a state            put a state on the canvas (the first is the start)
//   drag a knob onto a state   draw that symbol's arrow (onto its own state: a loop)
//   tap a knob, then a state   the same, without dragging
//   drag a knob into space     delete its arrow
//   drag a state               move it
//   double-tap a state         make it accepting, or not
//   tap a state or an arrow    select it, then its x badge (or Delete)
// Work is saved in localStorage under qrmt.machines.v1:<page>:<id>.

import { useEffect, useMemo, useRef, useState } from "react";
import { GATE_INK } from "../../circuits/gateShapes";
import { usePersistent } from "../../circuits/problems/storage";
import { AuthorError, Button, Row, Status } from "../../circuits/problems/ui";
import { checkMachine, minimalDfa, runMachine, type CheckResult, type MachineSpec } from "./engine";
import { KNOB, R, START_LEN, distToSamples, layoutMachine, previewPath, type Pt } from "./geometry";
import { LANGUAGES } from "./languages";
import { MSG } from "./messages";

const MONO = 'ui-monospace, "JetBrains Mono", Menlo, monospace';
const SANS = "ui-sans-serif, system-ui";
const WRONG = "var(--mcq-wrong)";
const RIGHT = "var(--mcq-right)";
const HILITE = "var(--accent)";
const SYM_COLOR = ["var(--fsm-sym-a)", "var(--fsm-sym-b)", "#b45309"];
const NAMES = "ABCDEFGHIJKL".split("");
const MAX_STATES = 10;
const MAX_WORD = 32;
const TAP_PX = 6;
const SNAP = 5;
const STORE = "qrmt.machines.v1";

export interface MachineBuilderProps {
  id?: string;           // unique on the page; defaults to the language key
  language: string;      // a key of LANGUAGES in languages.ts
  width?: number;        // logical canvas size (default 600 by 300)
  height?: number;
}

interface BState { id: string; x: number; y: number; accepting: boolean }
interface Design { states: BState[]; start: string | null; arrows: Record<string, Record<string, string>> }
interface Saved { design: Design; word: string; solved: boolean }

type Drag =
  | { kind: "move"; id: string; offX: number; offY: number; cx: number; cy: number; moved: boolean; before: Design }
  | { kind: "knob"; state: string; sym: string; cx: number; cy: number; moved: boolean };
type Sel = { kind: "state"; id: string } | { kind: "arrow"; from: string; sym: string } | null;
type Knob = { state: string; sym: string };

const emptyDesign = (): Design => ({ states: [], start: null, arrows: {} });

export default function MachineBuilder(props: MachineBuilderProps) {
  const lang = LANGUAGES[props.language];
  const id = props.id ?? props.language;
  const alphabet = lang?.alphabet ?? ["0", "1"];
  const symColor = (a: string) => SYM_COLOR[Math.max(0, alphabet.indexOf(a))] ?? GATE_INK;

  // ---- canvas geometry (narrow screens get fewer units across, as in the circuit builder) ----
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
  const W = boxW !== null && boxW < fullW * 0.8 ? Math.min(fullW, Math.max(360, Math.round(boxW / 0.8))) : fullW;
  const H = props.height ?? 300;
  const xMin = R + START_LEN + 16, xMax = W - R - 14, yMin = R + 16, yMax = H - R - 16;
  const clampX = (x: number) => Math.min(Math.max(xMin, x), xMax);
  const clampY = (y: number) => Math.min(Math.max(yMin, y), yMax);

  // ---- saved state ----
  const fresh = (): Saved => ({ design: emptyDesign(), word: "", solved: false });
  const revive = (s: unknown): Saved | null => {
    const v = s as Saved;
    if (!v || !v.design || !Array.isArray(v.design.states)) return null;
    const states = v.design.states
      .filter((q) => q && typeof q.id === "string" && Number.isFinite(q.x) && Number.isFinite(q.y))
      .slice(0, MAX_STATES)
      .map((q) => ({ id: q.id, x: q.x, y: q.y, accepting: !!q.accepting }));
    const ids = new Set(states.map((q) => q.id));
    const arrows: Design["arrows"] = {};
    for (const q of states) {
      arrows[q.id] = {};
      for (const a of alphabet) {
        const t = v.design.arrows?.[q.id]?.[a];
        if (typeof t === "string" && ids.has(t)) arrows[q.id][a] = t;
      }
    }
    const start = v.design.start && ids.has(v.design.start) ? v.design.start : states[0]?.id ?? null;
    const word = typeof v.word === "string" ? [...v.word].filter((c) => alphabet.includes(c)).join("").slice(0, MAX_WORD) : "";
    return { design: { states, start, arrows }, word, solved: !!v.solved };
  };
  const [saved, setSaved, resetSaved] = usePersistent<Saved>(id, "machine", fresh, revive, STORE);
  const design = saved.design;
  const word = saved.word;

  // ---- UI state ----
  const [sel, setSel] = useState<Sel>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [armed, setArmed] = useState<Knob | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [pointer, setPointer] = useState<Pt | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pos, setPos] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const undo = useRef<Design[]>([]);
  const lastTap = useRef<{ id: string; t: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // The tape shows the end of the walk whenever the word changes.
  useEffect(() => { setPos(word.length); setPlaying(false); }, [word]);

  // ---- the machine and its drawing ----
  const spec: MachineSpec = useMemo(() => ({
    states: design.states.map((q) => q.id),
    start: design.start,
    accepting: design.states.filter((q) => q.accepting).map((q) => q.id),
    arrows: design.arrows,
  }), [design]);
  const drawing = useMemo(() => layoutMachine(design.states, design.arrows, alphabet, design.start), [design, alphabet.join("")]);
  const stateById = useMemo(() => new Map(design.states.map((q) => [q.id, q])), [design]);
  const walk = useMemo(() => runMachine(spec, word), [spec, word]);
  const target = useMemo(() => (lang ? minimalDfa(lang.alphabet, lang.accepts, lang.bound ?? 8) : null), [props.language]);

  // ---- editing ----
  const commit = (next: Design) => {
    undo.current.push(design);
    if (undo.current.length > 60) undo.current.shift();
    setSaved((s) => ({ ...s, design: next }));
    setResult(null);
  };
  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    setSaved((s) => ({ ...s, design: prev }));
    setSel(null); setArmed(null); setResult(null); setNotice(null);
  };
  const freeSpot = (): Pt => {
    const cands: { x: number; y: number; d: number }[] = [];
    for (let x = xMin; x <= xMax; x += 10) for (let y = yMin; y <= yMax; y += 10)
      cands.push({ x, y, d: x + 3 * Math.abs(y - H / 2) });   // a row across the middle first, then above and below
    cands.sort((a, b) => a.d - b.d);
    for (const gap of [4.8 * R, 3.6 * R, 2.6 * R]) {
      const c = cands.find((c) => design.states.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= gap));
      if (c) return { x: Math.round(c.x / SNAP) * SNAP, y: Math.round(c.y / SNAP) * SNAP };
    }
    return { x: (xMin + xMax) / 2, y: H / 2 };
  };
  const addState = () => {
    if (design.states.length >= MAX_STATES) { setNotice(MSG.full(MAX_STATES)); return; }
    const used = new Set(design.states.map((q) => q.id));
    const name = NAMES.find((n) => !used.has(n))!;
    const p = freeSpot();
    commit({
      states: [...design.states, { id: name, x: p.x, y: p.y, accepting: false }],
      start: design.start ?? name,
      arrows: { ...design.arrows, [name]: {} },
    });
    setSel({ kind: "state", id: name });
    setArmed(null); setNotice(null);
  };
  const setArrow = (from: string, sym: string, to: string | null) => {
    const row = { ...(design.arrows[from] ?? {}) };
    if (to === null) delete row[sym]; else row[sym] = to;
    commit({ ...design, arrows: { ...design.arrows, [from]: row } });
  };
  const toggleAccepting = (sid: string) =>
    commit({ ...design, states: design.states.map((q) => (q.id === sid ? { ...q, accepting: !q.accepting } : q)) });
  const makeStart = (sid: string) => { if (design.start !== sid) commit({ ...design, start: sid }); };
  const deleteSel = () => {
    if (!sel) return;
    if (sel.kind === "state") {
      const states = design.states.filter((q) => q.id !== sel.id);
      const arrows: Design["arrows"] = {};
      for (const q of states) {
        arrows[q.id] = {};
        for (const [a, t] of Object.entries(design.arrows[q.id] ?? {})) if (t !== sel.id) arrows[q.id][a] = t;
      }
      commit({ states, arrows, start: design.start === sel.id ? states[0]?.id ?? null : design.start });
    } else setArrow(sel.from, sel.sym, null);
    setSel(null);
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
  const radius = (e: React.PointerEvent, s: number) => (e.pointerType === "touch" ? 20 : e.pointerType === "pen" ? 13 : 10) / s;
  const stateAt = (x: number, y: number, slack = 2) =>
    [...design.states].reverse().find((q) => Math.hypot(q.x - x, q.y - y) <= R + slack) ?? null;
  const badgePos = (): Pt | null => {
    if (!sel) return null;
    if (sel.kind === "state") {
      const q = stateById.get(sel.id);
      return q ? { x: q.x + R * 0.8 + 6, y: q.y - R * 0.8 - 6 } : null;
    }
    const a = drawing.arrows.find((x) => x.from === sel.from && x.sym === sel.sym);
    return a ? { x: a.mid.x, y: a.mid.y - 14 } : null;
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const { x, y, s } = toLocal(e);
    const Rh = radius(e, s);
    svgRef.current?.setPointerCapture(e.pointerId);
    svgRef.current?.focus({ preventScroll: true });
    setPointer({ x, y });
    setNotice(null);

    // 1. the delete badge
    const bp = badgePos();
    if (bp && Math.hypot(bp.x - x, bp.y - y) <= Math.max(11, Rh * 0.8)) { deleteSel(); return; }

    // 2. a knob, unless the press is well inside a state
    let knob: { k: (typeof drawing.knobs)[number]; d: number } | null = null;
    for (const k of drawing.knobs) {
      const d = Math.hypot(k.x - x, k.y - y);
      if (d <= Math.max(KNOB + 2, Rh) && (!knob || d < knob.d)) knob = { k, d };
    }
    const inside = stateAt(x, y, -9);
    if (knob && (!inside || knob.d <= KNOB)) {
      setArmed(null); setSel(null);
      setDrag({ kind: "knob", state: knob.k.state, sym: knob.k.sym, cx: e.clientX, cy: e.clientY, moved: false });
      return;
    }

    // 3. a state
    const q = stateAt(x, y);
    if (q) {
      if (armed) { setArrow(armed.state, armed.sym, q.id); setArmed(null); setHot(null); return; }
      setSel({ kind: "state", id: q.id });
      setDrag({ kind: "move", id: q.id, offX: x - q.x, offY: y - q.y, cx: e.clientX, cy: e.clientY, moved: false, before: design });
      return;
    }
    setArmed(null);

    // 4. an arrow
    let best: { a: (typeof drawing.arrows)[number]; d: number } | null = null;
    for (const a of drawing.arrows) {
      const d = distToSamples({ x, y }, a.samples);
      if (d <= Math.max(6, Rh * 0.6) && (!best || d < best.d)) best = { a, d };
    }
    if (best) { setSel({ kind: "arrow", from: best.a.from, sym: best.a.sym }); return; }

    // 5. empty canvas
    setSel(null);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const { x, y } = toLocal(e);
    setPointer({ x, y });
    const far = (d: { cx: number; cy: number }) => Math.hypot(e.clientX - d.cx, e.clientY - d.cy) > TAP_PX;
    if (!drag) { if (armed) setHot(stateAt(x, y, 10)?.id ?? null); return; }
    if (drag.kind === "move") {
      if (!drag.moved && !far(drag)) return;
      const nx = clampX(Math.round((x - drag.offX) / SNAP) * SNAP);
      const ny = clampY(Math.round((y - drag.offY) / SNAP) * SNAP);
      const q = stateById.get(drag.id);
      if (q && (q.x !== nx || q.y !== ny))
        setSaved((st) => ({ ...st, design: { ...st.design, states: st.design.states.map((p) => (p.id === drag.id ? { ...p, x: nx, y: ny } : p)) } }));
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (!drag.moved && far(drag)) setDrag({ ...drag, moved: true });
    setHot(stateAt(x, y, 10)?.id ?? null);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = drag;
    setDrag(null);
    setHot(null);
    if (!d) return;
    const { x, y } = toLocal(e);
    if (d.kind === "move") {
      if (d.moved) { undo.current.push(d.before); return; }
      const now = Date.now();
      if (lastTap.current && lastTap.current.id === d.id && now - lastTap.current.t < 400) {
        toggleAccepting(d.id);
        lastTap.current = null;
      } else lastTap.current = { id: d.id, t: now };
      return;
    }
    if (!d.moved) { setArmed({ state: d.state, sym: d.sym }); return; }
    const q = stateAt(x, y, 10);
    if (q) setArrow(d.state, d.sym, q.id);
    else if (design.arrows[d.state]?.[d.sym] !== undefined) setArrow(d.state, d.sym, null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSel(); }
    else if (e.key === "Escape") { setArmed(null); setSel(null); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); }
  };

  // Keep every state inside the canvas when it narrows.
  useEffect(() => {
    if (design.states.some((q) => clampX(q.x) !== q.x || clampY(q.y) !== q.y))
      setSaved((st) => ({ ...st, design: { ...st.design, states: st.design.states.map((q) => ({ ...q, x: clampX(q.x), y: clampY(q.y) })) } }));
  }, [W, H, design]);

  // Clear a stale selection after undo or delete.
  useEffect(() => {
    if (sel?.kind === "state" && !stateById.has(sel.id)) setSel(null);
    if (sel?.kind === "arrow" && design.arrows[sel.from]?.[sel.sym] === undefined) setSel(null);
  }, [design]);

  // Play: walk the tape one symbol at a time.
  useEffect(() => {
    if (!playing) return;
    if (pos >= word.length) { setPlaying(false); return; }
    const t = setTimeout(() => setPos((p) => p + 1), 600);
    return () => clearTimeout(t);
  }, [playing, pos, word]);

  // ---- check ----
  const check = () => {
    if (!target || !lang) return;
    setArmed(null); setSel(null); setNotice(null);
    const r = checkMachine(spec, alphabet, target);
    setResult(r);
    if (r.status === "wrong") {
      setSaved((s) => ({ ...s, word: r.word }));
      setPos(r.word.length);
      setPlaying(false);
    }
    if (r.status === "ok") setSaved((s) => ({ ...s, solved: true }));
  };
  const reset = () => {
    resetSaved();
    undo.current = [];
    setSel(null); setArmed(null); setResult(null); setNotice(null); setPlaying(false);
  };

  // ---- author errors ----
  if (!lang) return <AuthorError>MachineBuilder: no language "{props.language}" in fsm/builder/languages.ts.</AuthorError>;

  // ---- what to highlight ----
  const current = walk.path[Math.min(pos, walk.path.length - 1)] ?? null;
  const stuckNow = walk.stuckAt !== null && pos > walk.stuckAt;
  const activeArrow = pos > 0 && !stuckNow && walk.path[pos - 1] ? { from: walk.path[pos - 1]!, sym: word[pos - 1] } : null;
  const badKnobs = new Set(result?.status === "missing" ? result.missing.map((m) => `${m.state}:${m.symbol}`) : []);
  const endMark = result?.status === "wrong" && word === result.word && pos === word.length && current
    ? { state: current, text: MSG.shouldEnd(!result.accepts) }
    : null;
  const dragKnob = drag?.kind === "knob" && drag.moved ? drag : null;
  const pending = dragKnob ?? (armed && !drag ? { ...armed } : null);

  const statusText = (r: CheckResult): { tone: "right" | "wrong"; text: string } => {
    switch (r.status) {
      case "no-states": return { tone: "wrong", text: MSG.noStates };
      case "missing": return { tone: "wrong", text: MSG.missing(r.missing.length) };
      case "wrong": return { tone: "wrong", text: MSG.wrong(r.word, r.accepts) };
      case "ok": return { tone: "right", text: `${MSG.right} ${r.states > r.fewest ? MSG.fewerPossible : MSG.fewestReached}` };
    }
  };

  const tapeLine = (() => {
    if (!design.start) return MSG.noStart;
    if (stuckNow) return MSG.stuck(walk.path[walk.stuckAt!]!, word[walk.stuckAt!]);
    if (word.length === 0) return `${MSG.emptyWord} ${stateById.get(current!)?.accepting ? MSG.endAccept(current!) : MSG.endReject(current!)}`;
    if (pos === 0) return MSG.atStart(current!);
    if (pos < word.length) return MSG.midway(pos, word.length, current!);
    return stateById.get(current!)?.accepting ? MSG.endAccept(current!) : MSG.endReject(current!);
  })();
  const verdictTone: "right" | "wrong" | null =
    !design.start || pos < word.length || word.length === 0 ? null : stuckNow ? "wrong" : stateById.get(current ?? "")?.accepting ? "right" : "wrong";

  const selState = sel?.kind === "state" ? stateById.get(sel.id) : undefined;
  const badge = badgePos();

  // ---- drawing ----
  return (
    <div ref={boxRef} className="not-prose machine-builder" style={{ margin: "12px 0" }}>
      {/* palette and key */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 6 }}>
        <button
          type="button"
          onClick={addState}
          className="rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px 3px 5px", background: "var(--surface)", fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}
        >
          <svg width={18} height={18} viewBox="-10 -10 20 20" aria-hidden="true">
            <circle r={8} fill="var(--fsm-state)" stroke={GATE_INK} strokeWidth={1.3} />
          </svg>
          Add a state
        </button>
        <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>
          {alphabet.map((a) => (
            <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
              <svg width={30} height={14} viewBox="0 0 30 14" aria-hidden="true">
                <line x1={2} y1={7} x2={22} y2={7} stroke={symColor(a)} strokeWidth={2} />
                <path d="M 28 7 L 20 3 L 20 11 Z" fill={symColor(a)} />
              </svg>
              arrow for <code style={{ fontFamily: MONO, color: symColor(a), fontWeight: 700 }}>{a}</code>
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <svg width={18} height={18} viewBox="-10 -10 20 20" aria-hidden="true">
              <circle r={8.5} fill="var(--fsm-state-accept)" stroke={GATE_INK} strokeWidth={1.2} />
              <circle r={5.5} fill="none" stroke={GATE_INK} strokeWidth={1} />
            </svg>
            accepting
          </span>
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        tabIndex={0}
        role="application"
        aria-label="Machine canvas"
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
          border: `1px solid ${result?.status === "ok" ? RIGHT : "var(--rule)"}`,
          borderRadius: 6,
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          outline: "none",
          cursor: drag?.kind === "move" ? "grabbing" : "default",
        }}
      >
        <defs>
          <pattern id={`mgrid-${id.replace(/[^\w-]/g, "_")}`} width={20} height={20} patternUnits="userSpaceOnUse">
            <circle cx={10} cy={10} r={0.9} fill="var(--rule)" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={W} height={H} fill={`url(#mgrid-${id.replace(/[^\w-]/g, "_")})`} />

        {/* arrows */}
        {drawing.arrows.map((a) => {
          const isSel = sel?.kind === "arrow" && sel.from === a.from && sel.sym === a.sym;
          const isActive = activeArrow && activeArrow.from === a.from && activeArrow.sym === a.sym;
          const lifted = dragKnob && dragKnob.state === a.from && dragKnob.sym === a.sym;
          const c = symColor(a.sym);
          return (
            <g key={`${a.from}:${a.sym}`} style={{ pointerEvents: "none" }} opacity={lifted ? 0.25 : 1}>
              {isSel && <path d={a.d} fill="none" stroke={HILITE} strokeOpacity={0.35} strokeWidth={10} strokeLinecap="round" />}
              {isActive && <path d={a.d} fill="none" stroke="var(--bulb-glow)" strokeWidth={11} strokeLinecap="round" />}
              <path d={a.d} fill="none" stroke={c} strokeWidth={isActive ? 3.2 : 1.9} />
              <path d={a.head} fill={c} stroke={c} strokeWidth={isActive ? 1.5 : 0.6} strokeLinejoin="round" />
            </g>
          );
        })}

        {/* the start arrow */}
        {design.start && stateById.get(design.start) && (() => {
          const q = stateById.get(design.start!)!;
          const x0 = q.x - R - START_LEN - 2, x1 = q.x - R - 1.5;
          return (
            <g style={{ pointerEvents: "none" }}>
              <line x1={x0} y1={q.y} x2={x1 - 8} y2={q.y} stroke={GATE_INK} strokeWidth={1.8} />
              <path d={`M ${x1} ${q.y} L ${x1 - 9} ${q.y - 4.5} L ${x1 - 9} ${q.y + 4.5} Z`} fill={GATE_INK} />
              <text x={x0} y={q.y - 7} fontSize={10.5} fontFamily={SANS} fill="var(--muted)">start</text>
            </g>
          );
        })()}

        {/* states */}
        {design.states.map((q) => {
          const lit = current === q.id && !!design.start;
          const isSel = sel?.kind === "state" && sel.id === q.id;
          const isHot = hot === q.id && !!pending;
          return (
            <g key={q.id} transform={`translate(${q.x},${q.y})`} style={{ cursor: "grab" }}>
              {isSel && <circle r={R + 7} fill="var(--accent-soft)" stroke={HILITE} strokeWidth={1.2} strokeDasharray="4 3" />}
              {lit && <circle r={R + 9} fill="var(--bulb-glow)" />}
              <circle r={R} fill={lit ? "var(--bulb-lit)" : q.accepting ? "var(--fsm-state-accept)" : "var(--fsm-state)"} stroke={GATE_INK} strokeWidth={1.5} />
              {q.accepting && <circle r={R - 4.5} fill="none" stroke={lit ? "#1A1008" : GATE_INK} strokeWidth={1.3} />}
              {isHot && <circle r={R + 5} fill="none" stroke={HILITE} strokeWidth={2.2} />}
              <text y={5} fontSize={15} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill={lit ? "#1A1008" : GATE_INK} style={{ pointerEvents: "none" }}>
                {q.id}
              </text>
              {endMark && endMark.state === q.id && (
                <>
                  <circle r={R + 8} fill="none" stroke={WRONG} strokeWidth={2.2} strokeDasharray="4 3" />
                  <text y={R + 22} fontSize={10.5} fontFamily={SANS} fontWeight={600} textAnchor="middle" fill={WRONG}>{endMark.text}</text>
                </>
              )}
            </g>
          );
        })}

        {/* knobs */}
        {drawing.knobs.map((k) => {
          const c = symColor(k.sym);
          const isPending = pending && pending.state === k.state && pending.sym === k.sym;
          const bad = badKnobs.has(`${k.state}:${k.sym}`);
          return (
            <g key={`k-${k.state}:${k.sym}`} transform={`translate(${k.x},${k.y})`} style={{ cursor: "crosshair" }}>
              {(bad || isPending) && <circle r={KNOB + 4.5} fill="none" stroke={bad ? WRONG : HILITE} strokeWidth={2} />}
              <circle r={KNOB} fill={k.filled ? c : "var(--surface)"} stroke={k.filled ? "var(--surface)" : c} strokeWidth={k.filled ? 1.3 : 1.7} />
              <text y={3.4} fontSize={9.5} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill={k.filled ? "var(--surface)" : c} style={{ pointerEvents: "none" }}>
                {k.sym}
              </text>
            </g>
          );
        })}

        {/* the arrow being drawn */}
        {pending && (() => {
          const from = stateById.get(pending.state);
          const k = drawing.knobs.find((x) => x.state === pending.state && x.sym === pending.sym);
          if (!from || !k) return null;
          const to = hot ? stateById.get(hot) ?? null : null;
          const d = previewPath(from, k, to, dragKnob ? pointer : null);
          return d ? <path d={d} fill="none" stroke={symColor(pending.sym)} strokeWidth={2} strokeDasharray="5 4" style={{ pointerEvents: "none" }} /> : null;
        })()}

        {/* delete badge */}
        {badge && (
          <g style={{ cursor: "pointer" }} aria-label="Delete the selected item">
            <circle cx={badge.x} cy={badge.y} r={10} fill="var(--surface)" stroke={WRONG} strokeWidth={1.6} />
            <path d={`M ${badge.x - 4} ${badge.y - 4} L ${badge.x + 4} ${badge.y + 4} M ${badge.x + 4} ${badge.y - 4} L ${badge.x - 4} ${badge.y + 4}`} stroke={WRONG} strokeWidth={1.8} />
          </g>
        )}
      </svg>

      <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6, minHeight: 18 }}>
        {armed ? MSG.armed : design.states.length === 0 ? MSG.emptyCanvas : MSG.hint}
      </div>

      {/* the tape */}
      <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 6, background: "var(--bg)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: "var(--muted)", letterSpacing: "0.04em" }}>
            {MSG.tryLabel}{" "}
            <input
              type="text"
              inputMode="numeric"
              value={word}
              placeholder={MSG.placeholder}
              onChange={(e) => {
                const w = [...e.target.value].filter((c) => alphabet.includes(c)).join("").slice(0, MAX_WORD);
                setSaved((s) => ({ ...s, word: w }));
              }}
              style={{
                fontFamily: MONO, fontSize: 14, padding: "3px 8px", width: 170, marginLeft: 4,
                border: "1px solid var(--rule)", borderRadius: 5, background: "var(--surface)", color: "var(--ink)",
              }}
              aria-label="A string to run through the machine"
            />
          </label>
          <Button onClick={() => { setPlaying(false); setPos(0); }} disabled={pos === 0}>Start</Button>
          <Button onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} disabled={pos === 0}>Back</Button>
          <Button onClick={() => { setPlaying(false); setPos((p) => Math.min(word.length, p + 1)); }} disabled={pos >= word.length}>Step</Button>
          <Button onClick={() => { if (playing) setPlaying(false); else { setPos(0); setPlaying(true); } }} disabled={word.length === 0} pressed={playing}>
            {playing ? "Pause" : "Play"}
          </Button>
        </div>
        {word.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 9 }} aria-label="The tape">
            {[...word].map((c, i) => {
              const read = i < pos;
              const next = i === pos;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setPlaying(false); setPos(i + 1); }}
                  title={`Show the machine after reading ${i + 1} symbol${i === 0 ? "" : "s"}`}
                  style={{
                    width: 24, height: 28, fontFamily: MONO, fontSize: 14, fontWeight: 700,
                    borderRadius: 4,
                    border: `1.5px solid ${next ? HILITE : read ? symColor(c) : "var(--rule)"}`,
                    background: read ? "var(--surface)" : "transparent",
                    color: read ? symColor(c) : "var(--muted)",
                    boxShadow: next ? "0 3px 0 -1px var(--accent)" : undefined,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 13, color: verdictTone === "right" ? RIGHT : verdictTone === "wrong" ? WRONG : "var(--ink)", fontWeight: verdictTone ? 600 : 400 }}>
          {tapeLine}
        </div>
      </div>

      {/* readout */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, marginTop: 8, alignItems: "baseline" }}>
        <span>States: <strong>{design.states.length}</strong></span>
        {saved.solved && (
          <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", padding: "1px 8px", borderRadius: 999, border: `1px solid ${RIGHT}`, color: RIGHT }}>
            solved
          </span>
        )}
      </div>

      <Row>
        <Button main onClick={check}>Check</Button>
        <Button onClick={doUndo} disabled={undo.current.length === 0}>Undo</Button>
        <Button onClick={deleteSel} disabled={!sel}>Delete</Button>
        <Button onClick={() => selState && toggleAccepting(selState.id)} disabled={!selState} pressed={!!selState?.accepting}>Accepting</Button>
        <Button onClick={() => selState && makeStart(selState.id)} disabled={!selState || selState.id === design.start}>Make it the start</Button>
        <Button onClick={reset}>Reset</Button>
      </Row>

      {notice && <Status tone="wrong">{notice}</Status>}
      {result && !notice && <Status tone={statusText(result).tone}>{statusText(result).text}</Status>}
    </div>
  );
}
