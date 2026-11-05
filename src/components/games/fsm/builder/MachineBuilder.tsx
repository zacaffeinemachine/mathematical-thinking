// The student builds a machine on a canvas and checks it.
//
// Interaction (mouse, pen and touch all go through pointer events):
//   Add start state / Add state   put a state on the canvas (one start only)
//   click a state, then another   draw an arrow between them (the same state twice: a loop)
//   double-click a state          rename it
//   double-click an arrow         label it with the symbols it reads, e.g. "0, 1"
//   click a state, then Accepting make it accepting, or not
//   drag a state                  move it
//   drag an arrow                 bend it (a loop swings round its state)
//   click a state or an arrow     select it, then Delete removes it
//   drag the bar under the canvas make the canvas taller or shorter
//   drag empty canvas             pan the view
//   - / + / Fit canvas            zoom out, zoom in, frame the whole machine
//   Colour-code arrows            draw each arrow in the colour of its symbols instead of labelling it
//
// Below the canvas a tape runs any string through the machine as it stands.
// Check decides exactly whether the machine accepts the strings the problem
// asks for (engine.ts) and on a wrong machine loads the shortest string it
// gets wrong onto the tape. The look is deliberately neutral: ink and greys,
// with colour only in the verdict boxes.
//
// Work is saved in localStorage under qrmt.machines.v1:<page>:<id>.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePersistent } from "../../circuits/problems/storage";
import { AuthorError, Button, Row, Status } from "../../circuits/problems/ui";
import { compare, minimalDfa, missingArrows, parseLabel, runMachine, specFromEdges, type DrawnEdge } from "./engine";
import { R, START_LEN, angleThrough, bendThrough, distToSamples, layoutEdges, type Pt } from "./geometry";
import { LANGUAGES } from "./languages";
import { MSG } from "./messages";

const MONO = 'ui-monospace, "JetBrains Mono", Menlo, monospace';
const SANS = "ui-sans-serif, system-ui";
const INK = "var(--ink)";
const MUTED = "var(--muted)";
const WRONG = "var(--mcq-wrong)";
const RIGHT = "var(--mcq-right)";
const NAMES = "ABCDEFGHIJKLMNOP".split("");
const MAX_STATES = 12;
const MAX_NAME = 6;
const MAX_WORD = 32;
const TAP_PX = 6;
const DOUBLE_MS = 320;
const SNAP = 5;
const H_MIN = 220, H_MAX = 900;
const Z_MIN = 0.3, Z_MAX = 3;
const WORLD = 4000;                      // states stay within this many units of the origin
// The two symbol colours of the colour-coded view, blue and orange, which
// stay apart under every common kind of colour blindness. An arrow reading
// both is striped.
const SYM_COLOUR = ["var(--fsm-sym0)", "var(--fsm-sym1)"];
const STORE = "qrmt.machines.v1";

export interface MachineBuilderProps {
  id?: string;           // unique on the page; defaults to the language key
  language: string;      // a key of LANGUAGES in languages.ts
  width?: number;        // logical canvas width (default 600)
  height?: number;       // starting height (default 300); the student can drag it taller
}

interface BState { id: string; name: string; x: number; y: number; accepting: boolean }
interface Design { states: BState[]; start: string | null; edges: DrawnEdge[] }
interface View { cx: number; cy: number; z: number }      // centre of the view and zoom (1 = the canvas at its natural size)
interface Saved { design: Design; word: string; solved: boolean; height: number | null; colour: boolean; view: View | null }

type Target = { kind: "state"; id: string } | { kind: "edge"; index: number };
type Drag =
  | { kind: "move"; id: string; offX: number; offY: number; cx: number; cy: number; moved: boolean; before: Design }
  | { kind: "edge"; index: number; cx: number; cy: number; moved: boolean; before: Design }
  | { kind: "pan"; cx: number; cy: number; moved: boolean; from: View; scale: number };
type Editor = { kind: "name"; id: string; value: string } | { kind: "label"; index: number; value: string };

interface Verdict {
  tone: "right" | "wrong";
  text: string;
  edges: number[];
  states: string[];
  wrong?: { word: string; accepts: boolean };
}

const emptyDesign = (): Design => ({ states: [], start: null, edges: [] });
const sameTarget = (a: Target | null, b: Target) =>
  !!a && a.kind === b.kind && (a.kind === "state" ? a.id === (b as { id: string }).id : a.index === (b as { index: number }).index);

export default function MachineBuilder(props: MachineBuilderProps) {
  const lang = LANGUAGES[props.language];
  const id = props.id ?? props.language;
  const alphabet = lang?.alphabet ?? ["0", "1"];

  // ---- saved state ----
  const fresh = (): Saved => ({ design: emptyDesign(), word: "", solved: false, height: null, colour: false, view: null });
  const revive = (s: unknown): Saved | null => {
    const v = s as Saved;
    if (!v || !v.design || !Array.isArray(v.design.states) || !Array.isArray(v.design.edges)) return null;
    const states = v.design.states
      .filter((q) => q && typeof q.id === "string" && typeof q.name === "string" && Number.isFinite(q.x) && Number.isFinite(q.y))
      .slice(0, MAX_STATES)
      .map((q) => ({ id: q.id, name: q.name.slice(0, MAX_NAME) || "?", x: q.x, y: q.y, accepting: !!q.accepting }));
    const ids = new Set(states.map((q) => q.id));
    const seen = new Set<string>();
    const edges = v.design.edges
      .filter((e) => e && ids.has(e.from) && ids.has(e.to) && Array.isArray(e.label))
      .filter((e) => { const k = `${e.from}>${e.to}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((e) => ({
        from: e.from, to: e.to, label: alphabet.filter((a) => e.label.includes(a)),
        ...(Number.isFinite(e.bend) ? { bend: e.bend } : {}),
        ...(Number.isFinite(e.angle) ? { angle: e.angle } : {}),
      }));
    const start = v.design.start && ids.has(v.design.start) ? v.design.start : null;
    const word = typeof v.word === "string" ? [...v.word].filter((c) => alphabet.includes(c)).join("").slice(0, MAX_WORD) : "";
    const height = Number.isFinite(v.height) ? Math.min(H_MAX, Math.max(H_MIN, v.height as number)) : null;
    const vw = v.view;
    const view = vw && Number.isFinite(vw.cx) && Number.isFinite(vw.cy) && Number.isFinite(vw.z)
      ? { cx: vw.cx, cy: vw.cy, z: Math.min(Z_MAX, Math.max(Z_MIN, vw.z)) } : null;
    return { design: { states, start, edges }, word, solved: !!v.solved, height, colour: !!v.colour, view };
  };
  const [saved, setSaved, resetSaved] = usePersistent<Saved>(id, "machine-v2", fresh, revive, STORE);
  const design = saved.design;
  const word = saved.word;

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
  const H = saved.height ?? props.height ?? 300;
  const colour = saved.colour;
  const narrow = boxW !== null && boxW < 480;

  // ---- the view: which part of the plane the canvas shows ----
  const view: View = saved.view ?? { cx: W / 2, cy: H / 2, z: 1 };
  const vbW = W / view.z, vbH = H / view.z;
  const vbX = view.cx - vbW / 2, vbY = view.cy - vbH / 2;
  const setView = (v: View | null) => setSaved((s) => ({ ...s, view: v }));
  const world = (v: number) => Math.min(WORLD, Math.max(-WORLD, v));

  // ---- UI state ----
  const [sel, setSel] = useState<Target | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editor, setEditorState] = useState<Editor | null>(null);
  const edRef = useRef<Editor | null>(null);            // the live editor, so Enter and blur cannot both save it
  const setEditor = (e: Editor | null) => { edRef.current = e; setEditorState(e); };
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pos, setPos] = useState<number>(0);
  const [playing, setPlaying] = useState(false);
  const undo = useRef<Design[]>([]);
  // The last click, and the drawing before it if that click drew an arrow,
  // so the second click of a double-click can take the arrow back.
  const lastTap = useRef<{ target: Target; t: number; undoTo?: Design } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setPos(word.length); setPlaying(false); }, [word]);

  // ---- the machine and its drawing ----
  const stateById = useMemo(() => new Map(design.states.map((q) => [q.id, q])), [design]);
  const nameOf = (sid: string | null | undefined) => (sid ? stateById.get(sid)?.name ?? "?" : "?");
  const built = useMemo(
    () => specFromEdges(design.states.map((q) => q.id), design.start, design.states.filter((q) => q.accepting).map((q) => q.id), design.edges, alphabet),
    [design, alphabet.join("")],
  );
  const drawing = useMemo(() => layoutEdges(design.states, design.edges, design.start), [design]);
  const walk = useMemo(() => runMachine(built.spec, word), [built, word]);
  const target = useMemo(() => (lang ? minimalDfa(lang.alphabet, lang.accepts, lang.bound ?? 8) : null), [props.language]);
  const labelText = (e: DrawnEdge) => (e.label.length ? e.label.join(", ") : "?");
  const chipW = (e: DrawnEdge) => Math.max(18, labelText(e).length * 7.4 + 10);

  // ---- editing ----
  const commit = (next: Design) => {
    undo.current.push(design);
    if (undo.current.length > 60) undo.current.shift();
    setSaved((s) => ({ ...s, design: next }));
    setVerdict(null);
  };
  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    setSaved((s) => ({ ...s, design: prev }));
    setSel(null); setEditor(null); setVerdict(null); setNotice(null);
  };
  const freeSpot = (): Pt => {
    const cands: { x: number; y: number; d: number }[] = [];
    const xMin = vbX + R + START_LEN + 16, xMax = vbX + vbW - R - 14, yMin = vbY + R + 16, yMax = vbY + vbH - R - 16;
    for (let x = xMin; x <= xMax; x += 10) for (let y = yMin; y <= yMax; y += 10)
      cands.push({ x, y, d: x + 3 * Math.abs(y - view.cy) });
    cands.sort((a, b) => a.d - b.d);
    for (const gap of [4.8 * R, 3.6 * R, 2.6 * R]) {
      const c = cands.find((c) => design.states.every((q) => Math.hypot(q.x - c.x, q.y - c.y) >= gap));
      if (c) return { x: Math.round(c.x / SNAP) * SNAP, y: Math.round(c.y / SNAP) * SNAP };
    }
    return { x: Math.round(view.cx), y: Math.round(view.cy) };
  };
  const addState = (asStart: boolean) => {
    setNotice(null);
    if (asStart && design.start) { setNotice(MSG.startExists); return; }
    if (design.states.length >= MAX_STATES) { setNotice(MSG.full(MAX_STATES)); return; }
    const usedIds = new Set(design.states.map((q) => q.id));
    let k = 1;
    while (usedIds.has(`s${k}`)) k++;
    const usedNames = new Set(design.states.map((q) => q.name));
    const name = NAMES.find((n) => !usedNames.has(n)) ?? `S${k}`;
    const p = freeSpot();
    const q: BState = { id: `s${k}`, name, x: p.x, y: p.y, accepting: false };
    commit({ ...design, states: [...design.states, q], start: asStart ? q.id : design.start });
    setSel(null); setEditor(null);
  };
  const connect = (from: string, to: string): boolean => {
    const at = design.edges.findIndex((e) => e.from === from && e.to === to);
    if (at >= 0) { setSel({ kind: "edge", index: at }); setNotice(MSG.edgeExists(nameOf(from), nameOf(to))); return false; }
    commit({ ...design, edges: [...design.edges, { from, to, label: [] }] });
    setSel({ kind: "edge", index: design.edges.length });
    return true;
  };
  const toggleAccepting = (sid: string) =>
    commit({ ...design, states: design.states.map((q) => (q.id === sid ? { ...q, accepting: !q.accepting } : q)) });
  const deleteSel = () => {
    if (!sel) return;
    if (sel.kind === "state") {
      commit({
        states: design.states.filter((q) => q.id !== sel.id),
        edges: design.edges.filter((e) => e.from !== sel.id && e.to !== sel.id),
        start: design.start === sel.id ? null : design.start,
      });
    } else commit({ ...design, edges: design.edges.filter((_, i) => i !== sel.index) });
    setSel(null);
  };

  // ---- the editor for a name or a label ----
  const openEditor = (t: Target) => {
    setSel(null);
    if (t.kind === "state") { const q = stateById.get(t.id); if (q) setEditor({ kind: "name", id: q.id, value: q.name }); }
    else { const e = design.edges[t.index]; if (e) setEditor({ kind: "label", index: t.index, value: e.label.join(", ") }); }
  };
  const closeEditor = (save: boolean) => {
    const ed = edRef.current;
    if (!ed) return;
    setEditor(null);
    if (!ed || !save) return;
    if (ed.kind === "name") {
      const name = ed.value.trim().slice(0, MAX_NAME);
      if (!/[\p{L}\p{N}]/u.test(name)) { setNotice(MSG.badName); return; }
      if (design.states.some((q) => q.id !== ed.id && q.name === name)) { setNotice(MSG.nameTaken(name)); return; }
      if (stateById.get(ed.id)?.name !== name) commit({ ...design, states: design.states.map((q) => (q.id === ed.id ? { ...q, name } : q)) });
    } else {
      const label = parseLabel(ed.value, alphabet);
      if (label === null) { setNotice(MSG.badLabel(alphabet)); return; }
      const old = design.edges[ed.index];
      if (old && old.label.join() !== label.join())
        commit({ ...design, edges: design.edges.map((e, i) => (i === ed.index ? { ...e, label } : e)) });
    }
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
  const stateAt = (x: number, y: number) =>
    [...design.states].reverse().find((q) => Math.hypot(q.x - x, q.y - y) <= R + 3) ?? null;
  const edgeAt = (x: number, y: number, slack: number) => {
    let best: { index: number; d: number } | null = null;
    for (const a of drawing) {
      const e = design.edges[a.index];
      const w = chipW(e);
      const chip = !colour || e.label.length === 0;
      const inChip = chip && Math.abs(x - a.mid.x) <= w / 2 + 2 && Math.abs(y - a.mid.y) <= 11;
      const d = inChip ? 0 : distToSamples({ x, y }, a.samples);
      if (d <= slack && (!best || d < best.d)) best = { index: a.index, d };
    }
    return best?.index ?? null;
  };

  // A click acts at once. If it turns out to be the first half of a
  // double-click and it drew an arrow, the second half takes the arrow back
  // before opening the editor, so a double-click is never also two clicks.
  const tap = (t: Target) => {
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && sameTarget(prev.target, t) && now - prev.t < DOUBLE_MS) {
      lastTap.current = null;
      if (prev.undoTo) { undo.current.pop(); setSaved((s) => ({ ...s, design: prev.undoTo! })); }
      openEditor(t);
      return;
    }
    if (t.kind === "state" && sel?.kind === "state" && stateById.has(sel.id)) {
      const before = design;
      const made = connect(sel.id, t.id);
      lastTap.current = { target: t, t: now, undoTo: made ? before : undefined };
      return;
    }
    lastTap.current = { target: t, t: now };
    setSel(t);
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const { x, y, s } = toLocal(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    svgRef.current?.focus({ preventScroll: true });
    setNotice(null);
    const q = stateAt(x, y);
    if (q) { setDrag({ kind: "move", id: q.id, offX: x - q.x, offY: y - q.y, cx: e.clientX, cy: e.clientY, moved: false, before: design }); return; }
    const slack = (e.pointerType === "touch" ? 14 : 7) / s;
    const ei = edgeAt(x, y, slack);
    if (ei !== null) { setDrag({ kind: "edge", index: ei, cx: e.clientX, cy: e.clientY, moved: false, before: design }); return; }
    setDrag({ kind: "pan", cx: e.clientX, cy: e.clientY, moved: false, from: view, scale: s });
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (drag?.kind === "edge") {
      if (!drag.moved && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) <= TAP_PX) return;
      const ed = design.edges[drag.index];
      const P = ed && stateById.get(ed.from), Q = ed && stateById.get(ed.to);
      if (!ed || !P || !Q) return;
      const at = toLocal(e);
      const next = ed.from === ed.to ? { ...ed, angle: angleThrough(P, at) } : { ...ed, bend: bendThrough(P, Q, at) };
      setSaved((st) => ({ ...st, design: { ...st.design, edges: st.design.edges.map((x, i) => (i === drag.index ? next : x)) } }));
      if (!drag.moved) { setDrag({ ...drag, moved: true }); setSel({ kind: "edge", index: drag.index }); lastTap.current = null; }
      return;
    }
    if (drag?.kind === "pan") {
      const dx = e.clientX - drag.cx, dy = e.clientY - drag.cy;
      if (!drag.moved && Math.hypot(dx, dy) <= TAP_PX) return;
      setView({ ...drag.from, cx: drag.from.cx - dx / drag.scale, cy: drag.from.cy - dy / drag.scale });
      if (!drag.moved) setDrag({ ...drag, moved: true });
      return;
    }
    if (drag?.kind !== "move") return;
    const { x, y } = toLocal(e);
    if (!drag.moved && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) <= TAP_PX) return;
    const nx = world(Math.round((x - drag.offX) / SNAP) * SNAP);
    const ny = world(Math.round((y - drag.offY) / SNAP) * SNAP);
    const q = stateById.get(drag.id);
    if (q && (q.x !== nx || q.y !== ny))
      setSaved((st) => ({ ...st, design: { ...st.design, states: st.design.states.map((p) => (p.id === drag.id ? { ...p, x: nx, y: ny } : p)) } }));
    if (!drag.moved) setDrag({ ...drag, moved: true });
  };
  const onPointerUp = () => {
    const d = drag;
    setDrag(null);
    if (!d) return;
    if (d.kind === "move") {
      if (d.moved) { undo.current.push(d.before); setVerdict(null); return; }
      tap({ kind: "state", id: d.id });
      return;
    }
    if (d.kind === "edge") {
      if (d.moved) { undo.current.push(d.before); return; }
      tap({ kind: "edge", index: d.index });
      return;
    }
    lastTap.current = null;
    if (!d.moved) setSel(null);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (editor) return;
    if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); deleteSel(); }
    else if (e.key === "Escape") setSel(null);
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); }
  };

  // ---- the resize bar ----
  const resizing = useRef<{ y: number; h: number; scale: number } | null>(null);
  const onBarDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    resizing.current = { y: e.clientY, h: H, scale: svg.clientWidth / W || 1 };
  };
  const onBarMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = resizing.current;
    if (!r) return;
    const h = Math.min(H_MAX, Math.max(H_MIN, Math.round((r.h + (e.clientY - r.y) / r.scale) / 10) * 10));
    if (h !== H) setSaved((s) => ({ ...s, height: h }));
  };
  const onBarUp = () => { resizing.current = null; };

  // ---- zoom and fit ----
  const zoomBy = (f: number) => setView({ ...view, z: Math.min(Z_MAX, Math.max(Z_MIN, view.z * f)) });
  const fit = () => {
    if (design.states.length === 0) { setView(null); return; }
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const take = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const q of design.states) { take(q.x - R, q.y - R); take(q.x + R, q.y + R); }
    for (const a of drawing) { for (const p of a.samples) take(p.x, p.y); take(a.mid.x - 14, a.mid.y - 12); take(a.mid.x + 14, a.mid.y + 12); }
    const st = design.start ? stateById.get(design.start) : undefined;
    if (st) take(st.x - R - START_LEN - 4, st.y - 12);
    const pad = 24, bar = 36;                  // bar: room left under the corner buttons, in pixels
    const bw = x1 - x0 + 2 * pad;
    const z = Math.min(Z_MAX, Math.max(Z_MIN, Math.min(W / bw, (H - bar) / (y1 - y0 + 2 * pad), 1.6)));
    setView({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - bar / (2 * z), z });
  };

  // A machine drawn on a wide screen may not fit a narrow one: frame it once
  // on arrival, and again whenever the canvas changes width.
  const fitKey = `${W}|${design.states.length > 0}`;
  const lastFitKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastFitKey.current === fitKey) return;
    lastFitKey.current = fitKey;
    const out = design.states.some((q) => q.x - R < vbX || q.x + R > vbX + vbW || q.y - R < vbY || q.y + R > vbY + vbH);
    if (out) fit();
  }, [fitKey]);

  // Clear a stale selection after undo or delete.
  useEffect(() => {
    if (sel?.kind === "state" && !stateById.has(sel.id)) setSel(null);
    if (sel?.kind === "edge" && !design.edges[sel.index]) setSel(null);
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
    if (!target) return;
    setSel(null); setNotice(null); setEditor(null);
    const no = (text: string, edges: number[] = [], states: string[] = []): Verdict => ({ tone: "wrong", text, edges, states });
    let v: Verdict;
    if (!design.start) v = no(MSG.noStart);
    else if (built.unlabeled.length) v = no(MSG.unlabeled(built.unlabeled.length), built.unlabeled);
    else if (built.clashes.length) {
      const c = built.clashes[0];
      v = no(MSG.clash(nameOf(c.state), c.symbol), built.clashes.flatMap((x) => x.edges));
    } else {
      const miss = missingArrows(built.spec, alphabet);
      if (miss.length) {
        v = no(MSG.missing(miss.slice(0, 3).map((m) => MSG.missingItem(nameOf(m.state), m.symbol)), miss.length - 3), [], miss.map((m) => m.state));
      } else {
        const bad = compare(built.spec, alphabet, target);
        if (bad) {
          v = { ...no(MSG.wrong(bad.word, bad.accepts)), wrong: bad };
          setSaved((s) => ({ ...s, word: bad.word }));
          setPos(bad.word.length);
          setPlaying(false);
        } else {
          const n = design.states.length;
          v = { tone: "right", text: `${MSG.right} ${n > target.n ? MSG.fewerPossible : MSG.fewestReached}`, edges: [], states: [] };
          setSaved((s) => ({ ...s, solved: true }));
        }
      }
    }
    setVerdict(v);
  };
  const reset = () => {
    resetSaved();
    undo.current = [];
    setSel(null); setEditor(null); setVerdict(null); setNotice(null); setPlaying(false);
  };

  // ---- author errors ----
  if (!lang) return <AuthorError>MachineBuilder: no language "{props.language}" in fsm/builder/languages.ts.</AuthorError>;

  // ---- what to highlight ----
  const current = walk.path[Math.min(pos, walk.path.length - 1)] ?? null;
  const stuckNow = walk.stuckAt !== null && pos > walk.stuckAt;
  const activeEdge = (() => {
    if (pos === 0 || stuckNow) return -1;
    const from = walk.path[pos - 1], to = walk.path[pos];
    return design.edges.findIndex((e) => e.from === from && e.to === to && e.label.includes(word[pos - 1]));
  })();
  const markEdges = new Set(verdict?.edges ?? []);
  const markStates = new Set(verdict?.states ?? []);
  const endMark = verdict?.wrong && word === verdict.wrong.word && pos === word.length && current
    ? { state: current, text: MSG.shouldEnd(!verdict.wrong.accepts) }
    : null;

  const tapeLine = (() => {
    if (!design.start) return MSG.noStart;
    if (stuckNow) {
      const s = walk.path[walk.stuckAt!]!, a = word[walk.stuckAt!];
      const two = design.edges.filter((e) => e.from === s && e.label.includes(a)).length > 1;
      return two ? MSG.stuckTwo(nameOf(s), a) : MSG.stuckNone(nameOf(s), a);
    }
    const here = nameOf(current);
    const ends = stateById.get(current ?? "")?.accepting ? MSG.endAccept(here) : MSG.endReject(here);
    if (word.length === 0) return `${MSG.emptyWord} ${ends}`;
    if (pos === 0) return MSG.atStart(here);
    if (pos < word.length) return MSG.midway(pos, word.length, here);
    return ends;
  })();
  const verdictTone: "right" | "wrong" | null =
    !design.start || pos < word.length || word.length === 0 ? null : stuckNow ? "wrong" : stateById.get(current ?? "")?.accepting ? "right" : "wrong";

  const selState = sel?.kind === "state" ? stateById.get(sel.id) : undefined;
  const hint =
    design.states.length === 0 ? MSG.emptyCanvas
      : selState ? MSG.stateSelected(selState.name)
      : sel?.kind === "edge" ? MSG.edgeSelected
      : MSG.hint;

  // Where the editor box goes, in pixels inside the wrapper.
  const editorAt = (() => {
    if (!editor || !svgRef.current || !wrapRef.current) return null;
    const p = editor.kind === "name" ? stateById.get(editor.id) : drawing.find((a) => a.index === editor.index)?.mid;
    if (!p) return null;
    const m = svgRef.current.getScreenCTM();
    if (!m) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = p.x; pt.y = p.y;
    const c = pt.matrixTransform(m);
    const w = wrapRef.current.getBoundingClientRect();
    return { left: c.x - w.left, top: c.y - w.top };
  })();

  const nameSize = (n: string) => (n.length <= 2 ? 15 : n.length <= 4 ? 13 : 11);
  const gridId = `mgrid-${id.replace(/[^\w-]/g, "_")}`;

  // ---- drawing ----
  return (
    <div ref={boxRef} className="not-prose machine-builder" style={{ margin: "12px 0" }}>
      <Row style={{ marginTop: 0, marginBottom: 8 }}>
        <Button onClick={() => addState(true)} disabled={!!design.start}>Add start state</Button>
        <Button onClick={() => addState(false)}>Add state</Button>
        <Button onClick={() => selState && toggleAccepting(selState.id)} disabled={!selState}>
          {selState?.accepting ? "Not accepting" : "Accepting"}
        </Button>
        <Button onClick={deleteSel} disabled={!sel}>Delete</Button>
        <Button onClick={doUndo} disabled={undo.current.length === 0}>Undo</Button>
        <Button onClick={reset}>Reset</Button>
        <Button main onClick={check}>Check</Button>
      </Row>

      <div ref={wrapRef} style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          tabIndex={0}
          role="application"
          aria-label="Machine canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          onKeyDown={onKeyDown}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            background: "var(--surface)",
            border: `1px solid ${verdict?.tone === "right" ? RIGHT : "var(--rule)"}`,
            borderBottom: "none",
            borderRadius: "6px 6px 0 0",
            touchAction: "none",
            userSelect: "none",
            WebkitUserSelect: "none",
            outline: "none",
            cursor: drag && "moved" in drag && drag.moved ? "grabbing" : "default",
          }}
        >
          <defs>
            <pattern id={gridId} width={20} height={20} patternUnits="userSpaceOnUse">
              <circle cx={10} cy={10} r={0.9} fill="var(--rule)" />
            </pattern>
          </defs>
          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={`url(#${gridId})`} />

          {/* arrows */}
          {drawing.map((a) => {
            const isSel = sel?.kind === "edge" && sel.index === a.index;
            const isActive = activeEdge === a.index;
            const bad = markEdges.has(a.index);
            const e = design.edges[a.index];
            const syms = colour && !bad ? alphabet.map((x, i) => (e.label.includes(x) ? i : -1)).filter((i) => i >= 0 && i < SYM_COLOUR.length) : [];
            const stroke = bad ? WRONG : syms.length === 1 ? SYM_COLOUR[syms[0]] : syms.length > 1 ? SYM_COLOUR[0] : isActive ? INK : "var(--fsm-edge)";
            const width = isActive ? 3.2 : colour && syms.length ? 2.3 : 1.6;
            const head = syms.length > 1 ? INK : stroke;
            return (
              <g key={`e${a.index}`} style={{ pointerEvents: "none" }}>
                {isSel && <path d={a.d} fill="none" stroke="var(--fsm-select)" strokeWidth={10} strokeLinecap="round" />}
                {isActive && colour && syms.length > 0 && <path d={a.d} fill="none" stroke="var(--fsm-select)" strokeWidth={9} strokeLinecap="round" />}
                <path d={a.d} fill="none" stroke={stroke} strokeWidth={width} strokeDasharray={bad ? "5 3" : undefined} />
                {syms.length > 1 && <path d={a.d} fill="none" stroke={SYM_COLOUR[1]} strokeWidth={width} strokeDasharray="7 7" />}
                <path d={a.head} fill={head} stroke={head} strokeWidth={0.8} strokeLinejoin="round" />
              </g>
            );
          })}

          {/* the start arrow */}
          {design.start && stateById.get(design.start) && (() => {
            const q = stateById.get(design.start!)!;
            const x0 = q.x - R - START_LEN - 2, x1 = q.x - R - 1.5;
            return (
              <g style={{ pointerEvents: "none" }}>
                <line x1={x0} y1={q.y} x2={x1 - 8} y2={q.y} stroke={INK} strokeWidth={1.6} />
                <path d={`M ${x1} ${q.y} L ${x1 - 9} ${q.y - 4} L ${x1 - 9} ${q.y + 4} Z`} fill={INK} />
                <text x={x0} y={q.y - 7} fontSize={10.5} fontFamily={SANS} fill={MUTED}>start</text>
              </g>
            );
          })()}

          {/* states */}
          {design.states.map((q) => {
            const lit = current === q.id && !!design.start && !stuckNow;
            const isSel = sel?.kind === "state" && sel.id === q.id;
            const bad = markStates.has(q.id);
            return (
              <g key={q.id} transform={`translate(${q.x},${q.y})`} style={{ cursor: "pointer" }}>
                {isSel && <circle r={R + 7} fill="var(--fsm-select)" />}
                <circle r={R} fill={lit ? "var(--fsm-lit)" : "var(--surface)"} stroke={INK} strokeWidth={lit ? 2.4 : 1.5} />
                {q.accepting && <circle r={R - 4.5} fill="none" stroke={INK} strokeWidth={1.2} />}
                {editor?.kind === "name" && editor.id === q.id ? null : (
                  <text y={nameSize(q.name) * 0.36} fontSize={nameSize(q.name)} fontFamily={MONO} fontWeight={600} textAnchor="middle" fill={INK} style={{ pointerEvents: "none" }}>
                    {q.name}
                  </text>
                )}
                {bad && <circle r={R + 6} fill="none" stroke={WRONG} strokeWidth={1.8} strokeDasharray="4 3" />}
                {endMark && endMark.state === q.id && (
                  <>
                    <circle r={R + 7} fill="none" stroke={WRONG} strokeWidth={1.8} strokeDasharray="4 3" />
                    <text y={R + 21} fontSize={10.5} fontFamily={SANS} fontWeight={600} textAnchor="middle" fill={WRONG}>{endMark.text}</text>
                  </>
                )}
              </g>
            );
          })}

          {/* labels, on top of everything */}
          {drawing.map((a) => {
            const e = design.edges[a.index];
            if (editor?.kind === "label" && editor.index === a.index) return null;
            if (colour && e.label.length > 0) return null;      // the colour is the label
            const w = chipW(e);
            const none = e.label.length === 0;
            const bad = markEdges.has(a.index);
            return (
              <g key={`l${a.index}`} transform={`translate(${a.mid.x},${a.mid.y})`} style={{ cursor: "pointer" }}>
                <rect x={-w / 2} y={-9.5} width={w} height={19} rx={4} fill="var(--surface)"
                  stroke={bad ? WRONG : none ? MUTED : "var(--fsm-edge)"} strokeWidth={1} strokeDasharray={none ? "3 2" : undefined} />
                <text y={4.2} fontSize={12} fontFamily={MONO} fontWeight={600} textAnchor="middle" fill={none ? MUTED : INK} style={{ pointerEvents: "none" }}>
                  {labelText(e)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* view controls, in the corner of the canvas */}
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: 4, alignItems: "center", maxWidth: "calc(100% - 16px)" }}>
          <ViewButton onClick={() => setSaved((s) => ({ ...s, colour: !s.colour }))} pressed={colour} title={MSG.colourTitle}>{narrow ? MSG.colourShort : MSG.colour}</ViewButton>
          <ViewButton onClick={() => zoomBy(1 / 1.25)} disabled={view.z <= Z_MIN + 1e-6} title={MSG.zoomOut}>−</ViewButton>
          <ViewButton onClick={() => zoomBy(1.25)} disabled={view.z >= Z_MAX - 1e-6} title={MSG.zoomIn}>+</ViewButton>
          <ViewButton onClick={fit} title={MSG.fitTitle}>{narrow ? MSG.fitShort : MSG.fit}</ViewButton>
        </div>

        {/* the key to the colours, bottom left */}
        <div style={{ position: "absolute", left: 8, bottom: 22, pointerEvents: "none" }}>
          {colour && (
            <span style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 11.5, color: MUTED, background: "var(--surface)", padding: "2px 6px", borderRadius: 5, border: "1px solid var(--rule)" }}>
              {alphabet.slice(0, 2).map((x, i) => (
                <span key={x} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                  <svg width={18} height={6} aria-hidden="true"><line x1={1} y1={3} x2={17} y2={3} stroke={SYM_COLOUR[i]} strokeWidth={2.5} strokeLinecap="round" /></svg>
                  <span style={{ fontFamily: MONO, color: INK }}>{x}</span>
                </span>
              ))}
              <span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <svg width={18} height={6} aria-hidden="true">
                  <line x1={1} y1={3} x2={17} y2={3} stroke={SYM_COLOUR[0]} strokeWidth={2.5} />
                  <line x1={1} y1={3} x2={17} y2={3} stroke={SYM_COLOUR[1]} strokeWidth={2.5} strokeDasharray="4 4" />
                </svg>
                <span style={{ fontFamily: MONO, color: INK }}>both</span>
              </span>
            </span>
          )}
        </div>

        {/* the resize bar */}
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={MSG.resize}
          title={MSG.resize}
          onPointerDown={onBarDown}
          onPointerMove={onBarMove}
          onPointerUp={onBarUp}
          onPointerCancel={onBarUp}
          style={{
            height: 14,
            cursor: "ns-resize",
            touchAction: "none",
            border: `1px solid ${verdict?.tone === "right" ? RIGHT : "var(--rule)"}`,
            borderTop: "1px dashed var(--rule)",
            borderRadius: "0 0 6px 6px",
            background: "var(--surface)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width={36} height={6} aria-hidden="true">
            <line x1={2} y1={1.5} x2={34} y2={1.5} stroke={MUTED} strokeWidth={1.2} strokeLinecap="round" />
            <line x1={8} y1={4.5} x2={28} y2={4.5} stroke={MUTED} strokeWidth={1.2} strokeLinecap="round" />
          </svg>
        </div>

        {/* the name or label being typed */}
        {editor && editorAt && (
          <input
            autoFocus
            value={editor.value}
            maxLength={editor.kind === "name" ? MAX_NAME : 12}
            onChange={(e) => setEditor({ ...editor, value: e.target.value })}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); closeEditor(true); svgRef.current?.focus({ preventScroll: true }); }
              else if (e.key === "Escape") { e.preventDefault(); closeEditor(false); svgRef.current?.focus({ preventScroll: true }); }
            }}
            onBlur={() => closeEditor(true)}
            aria-label={editor.kind === "name" ? "Name of the state" : "Symbols this arrow reads, separated by commas"}
            placeholder={editor.kind === "label" ? alphabet.join(", ") : ""}
            style={{
              position: "absolute",
              left: editorAt.left,
              top: editorAt.top,
              transform: "translate(-50%, -50%)",
              width: editor.kind === "name" ? 70 : 64,
              textAlign: "center",
              fontFamily: MONO,
              fontSize: 14,
              padding: "3px 4px",
              border: `1.5px solid ${INK}`,
              borderRadius: 5,
              background: "var(--surface)",
              color: INK,
              boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
              outline: "none",
            }}
          />
        )}
      </div>

      <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6, minHeight: 18 }}>{hint}</div>

      {/* readout */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 13, marginTop: 4, alignItems: "baseline" }}>
        <span>States: <strong>{design.states.length}</strong></span>
        {saved.solved && (
          <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", padding: "1px 8px", borderRadius: 999, border: `1px solid ${RIGHT}`, color: RIGHT }}>
            solved
          </span>
        )}
      </div>

      {notice && <Status tone="wrong">{notice}</Status>}
      {verdict && !notice && <Status tone={verdict.tone}>{verdict.text}</Status>}

      {/* the tape */}
      <div style={{ marginTop: 10, padding: "10px 12px", border: "1px solid var(--rule)", borderRadius: 6, background: "var(--bg)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, color: MUTED, letterSpacing: "0.04em" }}>
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
                border: "1px solid var(--rule)", borderRadius: 5, background: "var(--surface)", color: INK,
              }}
              aria-label="A string to run through the machine"
            />
          </label>
          <Button onClick={() => { setPlaying(false); setPos(0); }} disabled={pos === 0}>Start</Button>
          <Button onClick={() => { setPlaying(false); setPos((p) => Math.max(0, p - 1)); }} disabled={pos === 0}>Back</Button>
          <Button onClick={() => { setPlaying(false); setPos((p) => Math.min(word.length, p + 1)); }} disabled={pos >= word.length}>Step</Button>
          <Button onClick={() => { if (playing) setPlaying(false); else { setPos(0); setPlaying(true); } }} disabled={word.length === 0}>
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
                    width: 24, height: 28, fontFamily: MONO, fontSize: 14, fontWeight: 600,
                    borderRadius: 4,
                    border: `1.5px solid ${next ? INK : read ? "var(--fsm-edge)" : "var(--rule)"}`,
                    background: read ? "var(--fsm-lit)" : "var(--surface)",
                    color: read ? INK : MUTED,
                    boxShadow: next ? `0 3px 0 -1px var(--ink)` : undefined,
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 13, color: verdictTone === "right" ? RIGHT : verdictTone === "wrong" ? WRONG : INK, fontWeight: verdictTone ? 600 : 400 }}>
          {tapeLine}
        </div>
      </div>

    </div>
  );
}

// A small button in the corner of the canvas, neutral, pressed shown in grey.
function ViewButton({ onClick, disabled, pressed, title, children }: {
  onClick: () => void; disabled?: boolean; pressed?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={pressed}
      className="disabled:opacity-40 disabled:cursor-not-allowed hover:border-[var(--ink)] transition-colors"
      style={{
        minWidth: 28, height: 28, padding: "0 8px", fontSize: 12.5, fontWeight: 600, lineHeight: 1,
        borderRadius: 5, border: "1px solid var(--rule)",
        background: pressed ? "var(--fsm-lit)" : "var(--surface)", color: "var(--ink)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </button>
  );
}
