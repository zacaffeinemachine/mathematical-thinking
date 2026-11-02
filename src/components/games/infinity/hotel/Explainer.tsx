import {
  useEffect, useId, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent, type ReactElement, type ReactNode,
} from "react";
import { ease, makeController, mix, mixVars, type Palette, type Scene } from "./engine";
import { drawEnt, FONT } from "./draw";
import { usePalette } from "./palette";

// =====================================================================
//  The frame every hotel explainer sits in: a stage that measures its own
//  width, the Play / Pause / Step / Reset controls, a caption that changes
//  with each step, and a question box underneath. Asking a question swaps
//  the story for a short answer scene in the same stage; "Back to the
//  story" puts the story back where it was.
//
//  Keys, once the explainer has focus: Right and Left step, Space plays or
//  pauses, Home resets. (Never L, which is the site's laser pointer.)
// =====================================================================

export interface Answer extends Scene {
  card?: ReactNode;
}

export interface Ctx<Q> {
  W: number;
  H: number;
  pal: Palette;
  vars: Record<string, number>;
  q: Q | null;
  ask: (q: Q) => void;
}

interface Props<Q> {
  id?: string;
  title: string;
  label: string;
  height: (W: number, q: Q | null) => number;
  story: (W: number) => Scene;
  answer: (W: number, q: Q) => Answer;
  backdrop?: (ctx: Ctx<Q>) => ReactNode;
  overlay?: (ctx: Ctx<Q>) => ReactNode;
  askTitle: string;
  ask: (ask: (q: Q) => void, q: Q | null) => ReactNode;
  /** Fade the right edge of answer scenes too (the corridor runs on past it). */
  fadeAnswer?: boolean;
}

const MIN_W = 300;
const MAX_W = 720;

/** Captions mark a letter that stands for a number with underscores: _n_ is set as n in italics. */
export function rich(s: string): ReactNode {
  const parts = s.split(/(_[^_\s][^_]*_)/g);
  return parts.map((p, i) =>
    p.length > 2 && p.startsWith("_") && p.endsWith("_") ? (
      <i key={i} style={{ fontFamily: "KaTeX_Math, 'Times New Roman', serif", fontSize: "1.08em" }}>
        {p.slice(1, -1)}
      </i>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

export function btnStyle(enabled: boolean, active = false): CSSProperties {
  return {
    padding: "5px 10px",
    fontSize: 13,
    lineHeight: 1.3,
    border: `1px solid ${active ? "var(--accent)" : "var(--rule)"}`,
    borderRadius: 6,
    background: enabled ? "var(--bg)" : "transparent",
    color: active ? "var(--accent)" : enabled ? "var(--ink)" : "var(--muted)",
    cursor: enabled ? "pointer" : "default",
    fontFamily: "ui-sans-serif, system-ui",
    fontWeight: active ? 600 : 500,
    opacity: enabled ? 1 : 0.5,
    minHeight: 32,
  };
}

export default function Explainer<Q>(props: Props<Q>): ReactElement {
  const pal = usePalette();
  const [, setTick] = useState(0);
  const ctl = useMemo(() => makeController(() => setTick((t) => t + 1)), []);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [query, setQuery] = useState<{ q: Q; nonce: number } | null>(null);
  const storyStep = useRef(0);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  // ---- width ----------------------------------------------------------
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setW(Math.max(MIN_W, Math.min(MAX_W, Math.round(w / 10) * 10)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- reduced motion -----------------------------------------------------
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    ctl.setReduce(mq.matches);
    const onChange = () => ctl.setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    return () => {
      mq.removeEventListener("change", onChange);
      ctl.dispose();
    };
  }, [ctl]);

  // ---- the scene on stage ---------------------------------------------------
  const q = query ? query.q : null;
  const scene: Answer = useMemo(
    () => (q === null ? props.story(W) : props.answer(W, q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [W, query],
  );
  const lastScene = useRef<{ scene: Answer; answer: boolean } | null>(null);
  if (!lastScene.current || lastScene.current.scene !== scene) {
    const wasAnswer = lastScene.current?.answer ?? false;
    const isAnswer = q !== null;
    let step = 0;
    if (!isAnswer) step = wasAnswer ? storyStep.current : ctl.current();
    else if (wasAnswer && lastScene.current) step = ctl.current();
    if (isAnswer && !wasAnswer) storyStep.current = ctl.current();
    ctl.setData(scene, step);
    lastScene.current = { scene, answer: isAnswer };
  }
  useEffect(() => {
    if (query) ctl.playFromStart();
  }, [query, ctl]);

  const ask = (nq: Q) => setQuery((old) => ({ q: nq, nonce: (old?.nonce ?? 0) + 1 }));
  const backToStory = () => setQuery(null);

  // ---- what to draw ---------------------------------------------------------
  const H = props.height(W, q);
  const v = ctl.view();
  const A = scene.frames[v.a];
  const B = scene.frames[v.b];
  const t = ease(Math.max(0, Math.min(1, v.t)));
  const ents = A && B ? mix(A.ents, B.ents, t, pal) : [];
  const vars = A && B ? mixVars(A.vars, B.vars, t) : {};
  const cur = ctl.current();
  const last = ctl.last();
  const step = scene.steps[cur];
  const caption = step ? step.caption : "";
  const s = ctl.state;
  const ctx: Ctx<Q> = { W, H, pal, vars, q, ask };
  const chapters = scene.chapters;
  const chapterStart = chapters ? chapters.map((_, c) => scene.steps.findIndex((st) => st.chapter === c)) : [];

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const tag = (ev.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      ctl.forward();
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      ctl.back();
    } else if (ev.key === " " && tag !== "BUTTON") {
      ev.preventDefault();
      ctl.toggle();
    } else if (ev.key === "Home") {
      ev.preventDefault();
      ctl.jump(0);
    }
  };

  const fadeId = `hhfade${uid}`;
  const maskId = `hhmask${uid}`;
  const playLabel = s.playing ? "Pause" : cur >= last && !s.anim ? "Play again" : "Play";

  return (
    <div
      id={props.id}
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label={`${props.label}. Right and Left arrows step, Space plays or pauses, Home resets.`}
      className="hotel-explainer"
      style={{
        margin: "1.75rem 0",
        border: "1px solid var(--rule)",
        borderRadius: 10,
        background: "var(--surface)",
        padding: "10px 0 12px",
        fontFamily: FONT,
        scrollMarginTop: 24,
      }}
    >
      <div
        style={{
          display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8,
          padding: "0 14px 4px", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "var(--muted)", fontWeight: 600,
        }}
      >
        <span>{props.title}</span>
        {q !== null && <span style={{ color: "var(--accent)" }}>Your question</span>}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block", touchAction: "manipulation" }}
        role="img"
        aria-label={caption.replace(/_/g, "")}
      >
        <defs>
          <linearGradient id={fadeId} x1="0" y1="0" x2="1" y2="0">
            <stop offset={(W - 46) / W} stopColor="#fff" stopOpacity={1} />
            <stop offset={1} stopColor="#fff" stopOpacity={0} />
          </linearGradient>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
            <rect x={0} y={0} width={W} height={H} fill={`url(#${fadeId})`} />
          </mask>
        </defs>
        <g mask={q !== null && props.fadeAnswer === false ? undefined : `url(#${maskId})`}>
          {props.backdrop?.(ctx)}
          {ents
            .filter(([, e]) => e.k !== "say")
            .map(([id, e]) => (
              <g key={id} opacity={e.o < 0.999 ? e.o : undefined}>
                {drawEnt(e, pal)}
              </g>
            ))}
        </g>
        {ents
          .filter(([, e]) => e.k === "say")
          .map(([id, e]) => (
            <g key={id} opacity={e.o < 0.999 ? e.o : undefined}>
              {drawEnt(e, pal)}
            </g>
          ))}
        {props.overlay?.(ctx)}
      </svg>

      <div
        style={{
          display: "flex", gap: 6, justifyContent: "center", alignItems: "center",
          marginTop: 8, flexWrap: "wrap", padding: "0 10px",
        }}
      >
        <button type="button" onClick={() => ctl.jump(0)} style={btnStyle(cur > 0)} disabled={cur === 0} aria-label="Reset to the first step">
          Reset
        </button>
        <button type="button" onClick={() => ctl.back()} style={btnStyle(cur > 0)} disabled={cur === 0} aria-label="Step back">
          ◀ Back
        </button>
        <button type="button" onClick={() => ctl.toggle()} style={{ ...btnStyle(true, true), minWidth: 78 }}>
          {playLabel}
        </button>
        <button
          type="button"
          onClick={() => ctl.forward()}
          style={btnStyle(cur < last || !!s.anim)}
          disabled={cur >= last && !s.anim}
          aria-label="Step forward"
        >
          Next ▶
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 48, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>
          {cur + 1} of {last + 1}
        </span>
      </div>

      {chapters && q === null && (
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", marginTop: 8, padding: "0 10px" }}>
          {chapters.map((name, c) => {
            const on = step?.chapter === c;
            return (
              <button
                type="button"
                key={name}
                onClick={() => ctl.jump(chapterStart[c])}
                style={{ ...btnStyle(true, on), fontSize: 12, padding: "3px 10px", minHeight: 28 }}
                aria-current={on ? "step" : undefined}
              >
                {name}
              </button>
            );
          })}
        </div>
      )}

      <div
        aria-live="polite"
        style={{
          margin: "10px 14px 0", padding: "8px 12px", minHeight: "3.4em", borderLeft: "3px solid var(--accent)",
          background: "var(--bg)", borderRadius: 4, fontSize: 15, lineHeight: 1.5, color: "var(--ink)",
        }}
      >
        {rich(caption)}
      </div>

      {q !== null && (
        <div style={{ margin: "8px 14px 0" }}>
          {scene.card && (
            <div style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink)", padding: "2px 2px 6px" }}>{scene.card}</div>
          )}
          <button type="button" onClick={backToStory} style={{ ...btnStyle(true), fontSize: 13 }}>
            ← Back to the story
          </button>
        </div>
      )}

      <div
        style={{
          margin: "12px 14px 0", padding: "10px 12px", border: "1px dashed var(--rule)", borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 6, letterSpacing: "0.04em" }}>
          {props.askTitle}
        </div>
        {props.ask(ask, q)}
      </div>
    </div>
  );
}

// =====================================================================
//  The question box: pick what to ask, type a number (or tap a ready-made
//  one), and press Show me.
// =====================================================================
export interface AskMode {
  key: string;
  label: string; //   "Follow the guest from room"
  min?: number;
  max?: number;
  chips?: number[];
}

export function NumberAsk(props: {
  modes: AskMode[];
  onAsk: (mode: string, n: number) => void;
  initial?: number;
}): ReactElement {
  const [mode, setMode] = useState(props.modes[0].key);
  const [raw, setRaw] = useState(String(props.initial ?? 37));
  const m = props.modes.find((x) => x.key === mode) ?? props.modes[0];
  const min = m.min ?? 1;
  const max = m.max ?? 1_000_000_000;
  const n = Number(raw.replace(/[,\s]/g, ""));
  const ok = Number.isInteger(n) && n >= min && n <= max;
  const go = (val: number) => {
    setRaw(String(val));
    props.onAsk(mode, val);
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) go(n);
      }}
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 }}
    >
      {props.modes.length > 1 ? (
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          aria-label="What to ask"
          style={{
            padding: "5px 8px", fontSize: 14, border: "1px solid var(--rule)", borderRadius: 6,
            background: "var(--bg)", color: "var(--ink)", minHeight: 32, maxWidth: "100%",
          }}
        >
          {props.modes.map((x) => (
            <option key={x.key} value={x.key}>
              {x.label}
            </option>
          ))}
        </select>
      ) : (
        <span>{m.label}</span>
      )}
      <input
        type="text"
        inputMode="numeric"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        aria-label="A counting number"
        aria-invalid={!ok}
        style={{
          width: 110, padding: "5px 8px", fontSize: 14, border: `1px solid ${ok ? "var(--rule)" : "var(--accent)"}`,
          borderRadius: 6, background: "var(--bg)", color: "var(--ink)", minHeight: 32,
          fontVariantNumeric: "tabular-nums",
        }}
      />
      <button type="submit" style={btnStyle(ok, ok)} disabled={!ok}>
        Show me
      </button>
      {m.chips && (
        <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>or try</span>
          {m.chips.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => go(c)}
              style={{ ...btnStyle(true), padding: "2px 9px", fontSize: 12, minHeight: 26 }}
            >
              {c.toLocaleString("en-US")}
            </button>
          ))}
        </span>
      )}
      {!ok && (
        <span style={{ fontSize: 12, color: "var(--accent)", flexBasis: "100%" }}>
          Type a counting number from {min.toLocaleString("en-US")} to {max.toLocaleString("en-US")}.
        </span>
      )}
    </form>
  );
}
