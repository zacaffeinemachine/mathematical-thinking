import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { pairAt, pairsBeforeDiagonal, placeOf, shellOf } from "./listing";
import type { Order, Pair } from "./listing";
import type { Timeline } from "./useTimeline";
import { ease, easeOut, lerp, seg } from "./useTimeline";

// =====================================================================
//  Shared pieces of the three frog explainers.
//
//  COLOURS follow deck 03's code, carried over to the site's two themes:
//  gold is the shooter's ink (the plan, the thread through the grid, the
//  pair being aimed at now), azure is water (the shot, the splash, a
//  soaked frog), green is the frog, and grey is the world at rest. The
//  site's --accent (red in the light theme) is kept for the controls only,
//  as on every other page. The gold and azure are scoped to .frogx below,
//  with a light and a dark value each, because global.css has no gold.
// =====================================================================

export const FROG_CSS = `
.frogx {
  --fx-thread: #a16207; --fx-thread-soft: rgba(161, 98, 7, 0.13); --fx-on-thread: #ffffff;
  --fx-water: #0b6bbd; --fx-water-soft: rgba(11, 107, 189, 0.13); --fx-pond: rgba(11, 107, 189, 0.06);
  --fx-frog: #5c9b47; --fx-frog-line: #2c5221; --fx-pad: #b9dbaa; --fx-pad-line: #79a866;
  border: 1px solid var(--rule); border-radius: 10px; background: var(--surface);
  margin: 1.5rem 0; overflow: hidden; color: var(--ink); font-size: 0.95rem; line-height: 1.55;
}
:root[data-theme="dark"] .frogx {
  --fx-thread: #dcb464; --fx-thread-soft: rgba(220, 180, 100, 0.17); --fx-on-thread: #17171a;
  --fx-water: #78b9eb; --fx-water-soft: rgba(120, 185, 235, 0.2); --fx-pond: rgba(120, 185, 235, 0.07);
  --fx-frog: #6fae5a; --fx-frog-line: #cfe9c2; --fx-pad: #284d24; --fx-pad-line: #4f8a45;
}
.frogx:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.frogx svg { display: block; width: 100%; height: auto; user-select: none; -webkit-user-select: none; }
.frogx .fx-btn {
  padding: 5px 11px; font-size: 13px; line-height: 1.2; border-radius: 5px; min-height: 32px; min-width: 32px;
  border: 1px solid var(--rule); background: var(--bg); color: var(--ink); cursor: pointer; font-family: inherit;
}
.frogx .fx-btn[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.frogx .fx-btn:disabled { opacity: 0.45; cursor: default; }
.frogx .fx-btn:focus-visible, .frogx input:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.frogx .fx-bar {
  display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; justify-content: space-between;
  padding: 10px 14px; border-top: 1px solid var(--rule); background: var(--bg);
}
.frogx .fx-pick { padding: 10px 14px; border-bottom: 1px solid var(--rule); background: var(--bg); display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; }
.frogx .fx-group { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.frogx .fx-label { font-size: 12.5px; color: var(--muted); }
.frogx .fx-cap { padding: 12px 16px; border-top: 1px solid var(--rule); min-height: 5.2em; }
.frogx .fx-cap > div + div { margin-top: 0.35em; }
.frogx .fx-num { font-variant-numeric: tabular-nums; }
.frogx .fx-gold { color: var(--fx-thread); font-weight: 600; }
.frogx .fx-blue { color: var(--fx-water); font-weight: 600; }
.frogx .fx-frogc { color: var(--fx-frog); font-weight: 600; }
.frogx input[type="number"] {
  width: 4.4em; padding: 4px 6px; border: 1px solid var(--rule); border-radius: 5px;
  background: var(--bg); color: var(--ink); font: inherit; font-variant-numeric: tabular-nums;
}
.frogx .fx-ask { padding: 12px 16px; border-top: 1px solid var(--rule); background: var(--bg); }
.frogx .fx-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
.frogx table.fx-sheet { border-collapse: collapse; font-variant-numeric: tabular-nums; font-size: 13.5px; margin: 0; }
.frogx table.fx-sheet th, .frogx table.fx-sheet td { border: 1px solid var(--rule); padding: 3px 8px; text-align: center; white-space: nowrap; }
.frogx table.fx-sheet th { font-weight: 500; color: var(--muted); text-align: left; background: var(--bg); }
.frogx table.fx-sheet td.fx-now { outline: 2px solid var(--fx-thread); outline-offset: -2px; }
.frogx table.fx-sheet td.fx-hit { background: var(--fx-water-soft); color: var(--fx-water); font-weight: 700; }
.frogx table.fx-sheet td.fx-future { color: var(--muted); }
`;

/** True on a phone-sized screen, where the drawings need larger text. */
export function useNarrow(px = 560) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${px}px)`);
    setNarrow(mq.matches);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [px]);
  return narrow;
}

export function FrogStyle() {
  return <style>{FROG_CSS}</style>;
}

// ---- Controls ------------------------------------------------------------
export function Controls({
  tl,
  speeds,
  timeText,
  canNext,
  extra,
}: {
  tl: Timeline;
  speeds: number[];
  timeText: ReactNode;
  canNext: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="fx-bar">
      <div className="fx-group">
        <button type="button" className="fx-btn" onClick={tl.reset} title="Reset (Home)">
          {"↺ Reset"}
        </button>
        <button type="button" className="fx-btn" onClick={tl.prev} disabled={tl.n === 0} aria-label="Step back" title="Step back (Left arrow)">
          {"◀"}
        </button>
        <button type="button" className="fx-btn" style={{ minWidth: 78 }} onClick={tl.togglePlay} aria-pressed={tl.playing} title="Play or pause (Space)">
          {tl.playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button type="button" className="fx-btn" onClick={tl.next} disabled={!canNext} aria-label="Step forward" title="Step forward (Right arrow)">
          {"▶"}
        </button>
        <span className="fx-label fx-num" style={{ marginLeft: 4 }}>
          {timeText}
        </span>
      </div>
      {extra}
      <div className="fx-group" role="group" aria-label="Speed">
        <span className="fx-label">Speed</span>
        {speeds.map((s, i) => (
          <button key={s} type="button" className="fx-btn" style={{ padding: "5px 8px" }} aria-pressed={tl.speedIdx === i} onClick={() => tl.setSpeedIdx(i)}>
            {s === 0.5 ? "½×" : `${s}×`}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- The frog, the shot, the splash --------------------------------------
/** A frog seen from above-front, centred on (x, y), r across half its body. */
export function FrogGlyph({ x, y, r, soaked = false, opacity = 1 }: { x: number; y: number; r: number; soaked?: boolean; opacity?: number }) {
  const body = soaked ? "var(--fx-water)" : "var(--fx-frog)";
  const line = "var(--fx-frog-line)";
  const sw = r * 0.09;
  return (
    <g opacity={opacity}>
      <ellipse cx={x - r * 0.78} cy={y + r * 0.5} rx={r * 0.42} ry={r * 0.24} fill={body} stroke={line} strokeWidth={sw} />
      <ellipse cx={x + r * 0.78} cy={y + r * 0.5} rx={r * 0.42} ry={r * 0.24} fill={body} stroke={line} strokeWidth={sw} />
      <ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill={body} stroke={line} strokeWidth={sw} />
      <circle cx={x - r * 0.45} cy={y - r * 0.62} r={r * 0.3} fill="#ffffff" stroke={line} strokeWidth={sw} />
      <circle cx={x + r * 0.45} cy={y - r * 0.62} r={r * 0.3} fill="#ffffff" stroke={line} strokeWidth={sw} />
      <circle cx={x - r * 0.42} cy={y - r * 0.6} r={r * 0.13} fill="#1b1b1b" />
      <circle cx={x + r * 0.48} cy={y - r * 0.6} r={r * 0.13} fill="#1b1b1b" />
      <path
        d={`M ${x - r * 0.42} ${y + r * 0.12} Q ${x} ${y + r * 0.42} ${x + r * 0.42} ${y + r * 0.12}`}
        fill="none"
        stroke={line}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </g>
  );
}

/** A falling drop of water, its tip at the top, centred on (x, y). */
export function Drop({ x, y, r, opacity = 1 }: { x: number; y: number; r: number; opacity?: number }) {
  return (
    <path
      d={`M ${x} ${y - 1.5 * r} C ${x + 0.9 * r} ${y - 0.3 * r} ${x + r} ${y + r} ${x} ${y + r} C ${x - r} ${y + r} ${x - 0.9 * r} ${y - 0.3 * r} ${x} ${y - 1.5 * r} Z`}
      fill="var(--fx-water)"
      opacity={opacity}
    />
  );
}

/** Rings and droplets spreading from (x, y) as t runs 0 to 1. */
export function Splash({ x, y, r, t, big = false }: { x: number; y: number; r: number; t: number; big?: boolean }) {
  if (t <= 0) return null;
  const a = easeOut(t);
  const fade = big ? 1 - 0.55 * t : 1 - t;
  const drops = big ? 7 : 0;
  return (
    <g pointerEvents="none">
      <ellipse cx={x} cy={y} rx={r * (0.4 + 1.6 * a)} ry={r * (0.15 + 0.5 * a)} fill="none" stroke="var(--fx-water)" strokeWidth={r * 0.14} opacity={fade} />
      {big && (
        <ellipse cx={x} cy={y} rx={r * (0.2 + 2.6 * a)} ry={r * (0.1 + 0.8 * a)} fill="none" stroke="var(--fx-water)" strokeWidth={r * 0.08} opacity={fade * 0.7} />
      )}
      {Array.from({ length: drops }, (_, i) => {
        const ang = Math.PI * (0.12 + (0.76 * i) / (drops - 1));
        const dist = r * (0.6 + 1.9 * a);
        return (
          <circle
            key={i}
            cx={x - Math.cos(ang) * dist}
            cy={y - Math.sin(ang) * dist * 1.1 + r * 1.6 * a * a}
            r={r * 0.16 * (1 - 0.4 * t)}
            fill="var(--fx-water)"
            opacity={fade}
          />
        );
      })}
    </g>
  );
}

// ---- The pond -------------------------------------------------------------
/** A step for labels on a pond running from 0 to hi, at most `most` labels. */
export function niceStep(hi: number, most: number) {
  const raw = hi / most;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-9))));
  for (const m of [1, 2, 5, 10]) if (m * mag >= raw) return Math.max(1, m * mag);
  return 10 * mag;
}

/**
 * The water, the pads and their numbers, from pad 0 to pad hi across
 * x0..x1. Pads are drawn one by one when there is room, otherwise as ticks.
 */
export function PondAxis({ hi, x0, x1, y, most = 10, fs = 1 }: { hi: number; x0: number; x1: number; y: number; most?: number; fs?: number }) {
  const per = (x1 - x0) / hi;
  const X = (pad: number) => x0 + pad * per;
  const step = niceStep(hi, fs > 1 ? Math.max(4, Math.round(most / fs)) : most);
  const each = per >= 16;
  const pads: ReactNode[] = [];
  const top = Math.floor(hi);
  if (each) {
    for (let i = 0; i <= top; i++) {
      pads.push(<ellipse key={i} cx={X(i)} cy={y} rx={Math.min(per * 0.42, 22)} ry={Math.min(per * 0.16, 8)} fill="var(--fx-pad)" stroke="var(--fx-pad-line)" strokeWidth={1.2} />);
    }
  } else {
    const minor = niceStep(hi, 60);
    for (let i = 0; i <= top; i += minor) {
      pads.push(<line key={i} x1={X(i)} x2={X(i)} y1={y - 5} y2={y + 5} stroke="var(--fx-pad-line)" strokeWidth={1.4} />);
    }
  }
  const labels: ReactNode[] = [];
  for (let i = 0; i <= top; i += step) {
    labels.push(
      <text key={i} x={X(i)} y={y + 18 + 16 * fs} fontSize={22 * fs} fill="var(--muted)" textAnchor="middle" className="fx-num">
        {i.toLocaleString("en-GB")}
      </text>,
    );
  }
  return (
    <g>
      <rect x={x0 - 30} y={y - 16} width={x1 - x0 + 60} height={32} rx={14} fill="var(--fx-pond)" />
      <line x1={x0 - 20} x2={x1 + 20} y1={y} y2={y} stroke="var(--fx-pad-line)" strokeWidth={1.2} opacity={0.6} />
      {pads}
      {labels}
      <text x={x1 + 34} y={y + 7} fontSize={22} fill="var(--muted)" textAnchor="start">
        {"…"}
      </text>
    </g>
  );
}

// ---- The grid of pairs ----------------------------------------------------
export interface GridProps {
  order: Order;
  /** Columns are starting offsets 1..W, rows are jump sizes 1..H. */
  W: number;
  H: number;
  n: number;
  p: number;
  frog?: Pair | null;
  soaked?: boolean;
  /** 0 to 1 while the splash on the frog's cell plays. */
  splash?: number;
  query?: Pair | null;
  onCell?: (p: Pair) => void;
  /** Shade the diagonal or shell that the current pair sits on. */
  shadeGroup?: boolean;
  label: string;
  /** Text size for the numbers round the edge, larger when the grid is drawn small. */
  fs?: number;
}

const C = 100; // one cell, in SVG units
const GL = 78; // room on the left for the row numbers and "jump size"
const GT = 30; // room above for the dots that say "and so on"
const GR = 46; // room on the right for the same
const GB = 84; // room below for the column numbers and "starting offset"

export function gridSize(W: number, H: number, fs = 1) {
  return { w: GL + W * C + GR, h: GT + H * C + GB + 34 * (fs - 1) };
}

export function PairGrid({ order, W, H, n, p, frog, soaked, splash = 0, query, onCell, shadeGroup, label, fs = 1 }: GridProps) {
  const { w, h } = gridSize(W, H, fs);
  const cx = (d: number) => GL + (d - 0.5) * C;
  const cy = (k: number) => GT + (H - k + 0.5) * C;
  const inView = (q: Pair) => q.d >= 1 && q.d <= W && q.k >= 1 && q.k <= H;
  const clipId = `fxclip-${order}-${W}-${H}`;

  // Past this place no step of the walk can cross the window.
  const limit =
    order === "diagonal" ? pairsBeforeDiagonal(W + H + 3) : (Math.max(W, H) + 1) * (Math.max(W, H) + 1);
  const shown = Math.min(n, limit);
  // The move into time n: the thread grows over the first half, the new
  // disc lands over the second.
  const grow = ease(seg(p, 0, 0.55));
  const land = seg(p, 0.45, 0.8);

  const segs: ReactNode[] = [];
  for (let i = 2; i <= shown; i++) {
    const a = pairAt(order, i - 1);
    const b = pairAt(order, i);
    const leap = Math.abs(a.d - b.d) + Math.abs(a.k - b.k) > 2;
    const t = i === n ? grow : 1;
    const x1 = cx(a.d), y1 = cy(a.k);
    const x2 = lerp(x1, cx(b.d), t), y2 = lerp(y1, cy(b.k), t);
    const current = i === n;
    segs.push(
      <line
        key={i}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="var(--fx-thread)"
        strokeWidth={leap ? 3 : current ? 7 : 5}
        strokeDasharray={leap ? "10 9" : undefined}
        strokeLinecap="round"
        opacity={leap ? 0.55 : current ? 1 : 0.8}
      />,
    );
    if (current && t > 0.05) {
      const ang = Math.atan2(cy(b.k) - y1, cx(b.d) - x1);
      const hx = x2, hy = y2;
      const s = 16;
      segs.push(
        <polygon
          key="head"
          points={`${hx},${hy} ${hx - s * Math.cos(ang - 0.45)},${hy - s * Math.sin(ang - 0.45)} ${hx - s * Math.cos(ang + 0.45)},${hy - s * Math.sin(ang + 0.45)}`}
          fill="var(--fx-thread)"
        />,
      );
    }
  }

  const cur = n >= 1 ? pairAt(order, n) : null;
  const cells: ReactNode[] = [];
  const shades: ReactNode[] = [];
  const groupOf = (q: Pair) => (order === "diagonal" ? q.d + q.k : shellOf(q));
  for (let k = 1; k <= H; k++) {
    for (let d = 1; d <= W; d++) {
      const q = { d, k };
      const place = placeOf(order, q);
      const isFrog = frog && frog.d === d && frog.k === k;
      if (shadeGroup && cur && groupOf(q) === groupOf(cur)) {
        shades.push(<rect key={`s${d},${k}`} x={cx(d) - 0.47 * C} y={cy(k) - 0.47 * C} width={0.94 * C} height={0.94 * C} rx={14} fill="var(--fx-thread-soft)" />);
      }
      let mark: ReactNode;
      if (place < n || (place === n && land > 0)) {
        const pop = place === n ? 0.6 + 0.4 * easeOut(land) : 1;
        const big = place >= 100;
        mark = (
          <g>
            <circle cx={cx(d)} cy={cy(k)} r={31 * pop} fill="var(--fx-thread)" opacity={place === n ? land : 1} />
            <text x={cx(d)} y={cy(k) + (big ? 8 : 9.5)} fontSize={big ? 23 : 28} fontWeight={700} fill="var(--fx-on-thread)" textAnchor="middle" className="fx-num" opacity={place === n ? land : 1}>
              {place}
            </text>
          </g>
        );
      } else {
        mark = <circle cx={cx(d)} cy={cy(k)} r={6} fill="var(--muted)" opacity={0.7} />;
      }
      cells.push(
        <g key={`${d},${k}`}>
          {!isFrog && mark}
          {onCell && (
            <rect
              x={cx(d) - C / 2}
              y={cy(k) - C / 2}
              width={C}
              height={C}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => onCell(q)}
            >
              <title>{`Pair (${d}, ${k})`}</title>
            </rect>
          )}
        </g>,
      );
    }
  }

  const ring =
    cur && inView(cur) ? (
      <circle cx={cx(cur.d)} cy={cy(cur.k)} r={43} fill="none" stroke="var(--fx-thread)" strokeWidth={6} opacity={land} pointerEvents="none" />
    ) : null;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}>
      <defs>
        <clipPath id={clipId}>
          <rect x={GL} y={GT} width={W * C} height={H * C} />
        </clipPath>
      </defs>
      {shades}
      {query && inView(query) && (
        <rect
          x={cx(query.d) - 0.48 * C}
          y={cy(query.k) - 0.48 * C}
          width={0.96 * C}
          height={0.96 * C}
          rx={12}
          fill="none"
          stroke="var(--ink)"
          strokeWidth={3}
          strokeDasharray="9 7"
          pointerEvents="none"
        />
      )}
      <g clipPath={`url(#${clipId})`} pointerEvents="none">
        {segs}
      </g>
      {cells}
      {ring}
      {frog && inView(frog) && (
        <g pointerEvents="none">
          <FrogGlyph x={cx(frog.d)} y={cy(frog.k) + 4} r={29} soaked={soaked} />
          <Splash x={cx(frog.d)} y={cy(frog.k) + 10} r={30} t={splash} big />
        </g>
      )}
      {/* Row and column numbers, and the dots that say the grid goes on. */}
      {Array.from({ length: W }, (_, i) => (
        <g key={`c${i}`}>
          <text x={cx(i + 1)} y={GT + H * C + 26 + 8 * fs} fontSize={26 * fs} fill="var(--muted)" textAnchor="middle" className="fx-num">
            {i + 1}
          </text>
          <text x={cx(i + 1)} y={GT - 4} fontSize={26} fill="var(--muted)" textAnchor="middle">
            {"⋮"}
          </text>
        </g>
      ))}
      {Array.from({ length: H }, (_, i) => (
        <g key={`r${i}`}>
          <text x={GL - 18} y={cy(i + 1) + 9 * fs} fontSize={26 * fs} fill="var(--muted)" textAnchor="end" className="fx-num">
            {i + 1}
          </text>
          <text x={GL + W * C + 12} y={cy(i + 1) + 9} fontSize={26} fill="var(--muted)" textAnchor="start">
            {"…"}
          </text>
        </g>
      ))}
      <text x={GL + (W * C) / 2} y={GT + H * C + 40 + 32 * fs} fontSize={27 * fs} fill="var(--ink)" textAnchor="middle">
        {"starting offset →"}
      </text>
      <text x={14 + 6 * fs} y={GT + (H * C) / 2} fontSize={27 * fs} fill="var(--ink)" textAnchor="middle" transform={`rotate(-90 ${14 + 6 * fs} ${GT + (H * C) / 2})`}>
        {"jump size →"}
      </text>
    </svg>
  );
}
