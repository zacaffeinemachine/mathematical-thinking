import type { ReactElement } from "react";
import { mk, type Drawn, type Ent, type Palette, type Role } from "./engine";
import { fmt } from "./math";

// =====================================================================
//  Drawing pieces shared by the hotel explainers: the guests, the arrows,
//  the corridor of rooms, the coaches, and the manager's announcement.
//  Everything is in plain SVG units, y downwards. The explainers measure
//  their own width and use one unit per screen pixel, so a font size here
//  is a font size on the screen.
// =====================================================================

export const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const rgb = (c: readonly number[]) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
export const roleColor = (pal: Palette, r: Role) => rgb(pal[r]);

// ---- Entity constructors ----------------------------------------------------
export const person = (x: number, y: number, c: Role, lab = "", s = 1, z = 6): Ent =>
  mk({ k: "person", x, y, c, str: lab, s, z, f: "surface" });
export const arrow = (x: number, y: number, x2: number, y2: number, c: Role, bend = 0, w = 1.5): Ent =>
  mk({ k: "arrow", z: 4, x, y, x2, y2, c, bend, w });
export const text = (x: number, y: number, str: string, c: Role = "num", size = 12, extra: Partial<Ent> = {}): Ent =>
  mk({ k: "text", z: 7, x, y, str, c, size, ...extra });
export const tag = (x: number, y: number, str: string, c: Role = "accent", size = 12, extra: Partial<Ent> = {}): Ent =>
  mk({ k: "tag", z: 8, x, y, str, c, size, f: "surface", fo: 1, ...extra });
export const lit = (x: number, y: number, x2: number, y2: number, c: Role = "accent"): Ent =>
  mk({ k: "rect", z: 3, x, y, x2, y2, c, f: c, fo: 0.1, w: 2 });
export const disc = (x: number, y: number, r: number, c: Role, lab = "", extra: Partial<Ent> = {}): Ent =>
  mk({ k: "disc", z: 6, x, y, s: r, c, f: c, fo: 1, str: lab, ...extra });
export const ring = (x: number, y: number, r: number, c: Role, w = 2): Ent =>
  mk({ k: "ring", z: 7, x, y, s: r, c, w });
export const dots = (x: number, y: number, c: Role = "num", vertical = false): Ent =>
  mk({ k: "ell", z: 2, x, y, c, s: vertical ? -1 : 1 });
export const say = (str: string, W: number, bandH: number): Ent =>
  mk({ k: "say", z: 9, x: 8, y: 6, x2: W - 8, y2: bandH - 6, str, c: "ink", size: 13.5 });

// ---- The stick figure -------------------------------------------------------
// Feet at (x, y). Thirty units tall at scale 1, head of radius 7.5 with room
// for a letter or a number in it.
export const PERSON_H = 31;
export const headY = (y: number, s: number) => y - 23.5 * s;

function drawPerson(e: Drawn): ReactElement {
  const { x, y, s } = e;
  const P = (px: number, py: number) => `${(x + px * s).toFixed(2)},${(y + py * s).toFixed(2)}`;
  const d =
    `M${P(-5.5, 0)}L${P(0, -8.5)}L${P(5.5, 0)}` +
    `M${P(0, -8.5)}L${P(0, -16)}` +
    `M${P(-6.5, -8.5)}L${P(0, -14)}L${P(6.5, -8.5)}`;
  const hy = headY(y, s);
  const lab = e.str;
  const fs = (lab.length >= 3 ? 6.4 : lab.length === 2 ? 7.6 : 9.2) * s;
  return (
    <g>
      <path d={d} stroke={e.col} strokeWidth={1.5 * Math.max(0.8, s)} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x} cy={hy} r={7.5 * s} fill={e.fill} stroke={e.col} strokeWidth={1.5 * Math.max(0.8, s)} />
      {lab && (
        <text
          x={x} y={hy + 0.4} fill={e.col} fontSize={fs} fontWeight={700} fontFamily={FONT}
          textAnchor="middle" dominantBaseline="central"
        >
          {lab}
        </text>
      )}
    </g>
  );
}

// ---- Arrows -------------------------------------------------------------------
// A quadratic curve from (x, y) to (x2, y2), bowed sideways by `bend`, drawn
// on from the start as p runs from 0 to 1, with its head at the drawn end.
function drawArrow(e: Drawn): ReactElement | null {
  const dx = e.x2 - e.x;
  const dy = e.y2 - e.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-6 || e.p <= 0.001) return null;
  const nx = -dy / L;
  const ny = dx / L;
  const cx = (e.x + e.x2) / 2 + nx * e.bend;
  const cy = (e.y + e.y2) / 2 + ny * e.bend;
  const p = Math.min(1, e.p);
  // de Casteljau: the part of the curve from 0 to p
  const ax = e.x + (cx - e.x) * p;
  const ay = e.y + (cy - e.y) * p;
  const bx = cx + (e.x2 - cx) * p;
  const by = cy + (e.y2 - cy) * p;
  const tx = ax + (bx - ax) * p;
  const ty = ay + (by - ay) * p;
  let ux = bx - ax;
  let uy = by - ay;
  const ul = Math.hypot(ux, uy) || 1;
  ux /= ul;
  uy /= ul;
  const hl = Math.min(4 + 2.6 * e.w, L * p);
  const hw = hl * 0.75;
  const back = 0.7 * hl;
  return (
    <g>
      <path
        d={`M${e.x.toFixed(2)},${e.y.toFixed(2)}Q${ax.toFixed(2)},${ay.toFixed(2)} ${(tx - ux * back).toFixed(2)},${(ty - uy * back).toFixed(2)}`}
        stroke={e.col} strokeWidth={e.w} fill="none" strokeDasharray={e.dash ? "5 4" : undefined} strokeLinecap="round"
      />
      <path
        fill={e.col}
        d={
          `M${tx.toFixed(2)},${ty.toFixed(2)}` +
          `L${(tx - ux * hl - uy * hw * 0.5).toFixed(2)},${(ty - uy * hl + ux * hw * 0.5).toFixed(2)}` +
          `L${(tx - ux * hl * 0.65).toFixed(2)},${(ty - uy * hl * 0.65).toFixed(2)}` +
          `L${(tx - ux * hl + uy * hw * 0.5).toFixed(2)},${(ty - uy * hl - ux * hw * 0.5).toFixed(2)}Z`
        }
      />
    </g>
  );
}

// ---- The announcement band ------------------------------------------------------
export function wrap(str: string, width: number, size: number): string[] {
  const max = Math.max(12, Math.floor(width / (size * 0.48)));
  const words = str.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawSay(e: Drawn, pal: Palette): ReactElement {
  const w = e.x2 - e.x;
  const h = e.y2 - e.y;
  const lines = wrap(e.str, w - 52, e.size);
  const lh = e.size * 1.32;
  const cy = e.y + h / 2;
  const top = cy - ((lines.length - 1) * lh) / 2;
  const ix = e.x + 20;
  const acc = rgb(pal.accent);
  return (
    <g>
      <rect x={e.x} y={e.y} width={w} height={h} rx={8} fill={rgb(pal.surface)} stroke={acc} strokeWidth={1.2} />
      {/* a little loudspeaker: the manager is on the intercom */}
      <g stroke={acc} fill="none" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
        <path d={`M${ix - 8},${cy - 3.5}h4l5,-4.5v16l-5,-4.5h-4z`} fill={acc} />
        <path d={`M${ix + 4},${cy - 4}q3,4 0,8`} />
        <path d={`M${ix + 7},${cy - 7}q5.5,7 0,14`} />
      </g>
      {lines.map((ln, i) => (
        <text
          key={i} x={e.x + 40} y={top + i * lh} fill={e.col} fontSize={e.size} fontStyle="italic"
          fontFamily={FONT} dominantBaseline="central"
        >
          {ln}
        </text>
      ))}
    </g>
  );
}

// ---- Coaches ------------------------------------------------------------------------
// A coach seen from the side, facing left: nose at x, roof at y, floor at y2.
// It has a seat for every counting number, so it never ends: draw enough
// seats to run off the right of the picture.
export const NOSE = 30;
export const hbusSeatX = (nose: number, pitch: number, k: number) => nose + NOSE + (k - 0.5) * pitch;

function drawHBus(e: Drawn): ReactElement {
  const x = e.x;
  const roof = e.y;
  const floor = e.y2;
  const h = floor - roof;
  const n = Math.round(e.n);
  const end = x + NOSE + n * e.pitch + 30;
  const wheels: number[] = [x + 14];
  for (let k = 3; k <= n; k += 4) wheels.push(x + NOSE + (k - 0.5) * e.pitch);
  const r = Math.min(7, h * 0.16);
  return (
    <g stroke={e.col} fill="none" strokeWidth={1.4} strokeLinejoin="round">
      <line x1={x} y1={floor} x2={end} y2={floor} />
      <line x1={x + NOSE * 0.62} y1={roof} x2={end} y2={roof} />
      <polyline points={`${x},${floor} ${x},${roof + h * 0.38} ${x + NOSE * 0.62},${roof}`} />
      {Array.from({ length: n + 1 }, (_, k) => (
        <line key={k} x1={x + NOSE + k * e.pitch} y1={roof} x2={x + NOSE + k * e.pitch} y2={floor} strokeWidth={0.9} />
      ))}
      {wheels.map((wx) => (
        <circle key={wx} cx={wx} cy={floor + r * 0.9} r={r} fill={e.fill} strokeWidth={1.3} />
      ))}
      {e.size > 0 &&
        Array.from({ length: n }, (_, k) => (
          <text
            key={`n${k}`} x={x + NOSE + k * e.pitch + 3} y={roof + 2} fill={e.col} stroke="none"
            fontSize={e.size} fontFamily={FONT} dominantBaseline="hanging"
          >
            {k + 1}
          </text>
        ))}
    </g>
  );
}

// A bus seen from above, parked nose down: centre x, the tip of its nose at
// y, seat j's middle at y - NOSE_V - (j - 0.5) pitch. Open at the top.
export const NOSE_V = 16;
export const vbusSeatY = (tip: number, pitch: number, j: number) => tip - NOSE_V - (j - 0.5) * pitch;

function drawVBus(e: Drawn): ReactElement {
  const x = e.x;
  const tip = e.y;
  const hw = e.s / 2;
  const n = Math.round(e.n);
  const top = tip - NOSE_V - n * e.pitch - 14;
  const base = tip - NOSE_V;
  return (
    <g stroke={e.col} fill="none" strokeWidth={1.3} strokeLinejoin="round">
      <path d={`M${x - hw},${top}V${base}Q${x - hw},${tip} ${x},${tip}Q${x + hw},${tip} ${x + hw},${base}V${top}`} />
      {Array.from({ length: n + 1 }, (_, k) => (
        <line key={k} x1={x - hw} y1={base - k * e.pitch} x2={x + hw} y2={base - k * e.pitch} strokeWidth={0.8} />
      ))}
      <circle cx={x} cy={tip - NOSE_V * 0.5} r={3} fill={e.col} stroke="none" />
    </g>
  );
}

// ---- Dispatch -------------------------------------------------------------------------
export function drawEnt(e: Drawn, pal: Palette): ReactElement | null {
  switch (e.k) {
    case "person":
      return drawPerson(e);
    case "arrow":
      return drawArrow(e);
    case "say":
      return drawSay(e, pal);
    case "hbus":
      return drawHBus(e);
    case "vbus":
      return drawVBus(e);
    case "ell": {
      const v = e.s < 0;
      return (
        <g fill={e.col}>
          {[-6, 0, 6].map((d) => (
            <circle key={d} cx={v ? e.x : e.x + d} cy={v ? e.y + d : e.y} r={1.6} />
          ))}
        </g>
      );
    }
    case "ring":
      return <circle cx={e.x} cy={e.y} r={e.s} fill="none" stroke={e.col} strokeWidth={e.w} />;
    case "disc":
      return (
        <g>
          <circle cx={e.x} cy={e.y} r={e.s} fill={e.fill} fillOpacity={e.fo} stroke={e.col} strokeWidth={1.3} />
          {e.str && (
            <text
              x={e.x} y={e.y + 0.4} fill={rgb(pal.surface)} fontSize={e.s * (e.str.length > 2 ? 0.8 : e.str.length > 1 ? 0.95 : 1.15)}
              fontWeight={700} fontFamily={FONT} textAnchor="middle" dominantBaseline="central"
            >
              {e.str}
            </text>
          )}
        </g>
      );
    case "rect":
      return (
        <rect
          x={Math.min(e.x, e.x2)} y={Math.min(e.y, e.y2)} width={Math.abs(e.x2 - e.x)} height={Math.abs(e.y2 - e.y)}
          fill={e.fill} fillOpacity={e.fo} stroke={e.col} strokeWidth={e.w} rx={2}
        />
      );
    case "line":
      return (
        <line
          x1={e.x} y1={e.y} x2={e.x2} y2={e.y2} stroke={e.col} strokeWidth={e.w}
          strokeDasharray={e.dash ? "4 4" : undefined}
        />
      );
    case "text":
      return (
        <text
          x={e.x} y={e.y} fill={e.col} fontSize={e.size} fontFamily={FONT} textAnchor={e.anchor}
          dominantBaseline="central" fontWeight={e.bold ? 700 : 400} fontStyle={e.italic ? "italic" : undefined}
        >
          {e.str}
        </text>
      );
    case "tag": {
      const w = e.str.length * e.size * 0.56 + 12;
      const h = e.size + 9;
      const left = e.anchor === "start" ? e.x : e.anchor === "end" ? e.x - w : e.x - w / 2;
      return (
        <g>
          <rect x={left} y={e.y - h / 2} width={w} height={h} rx={h / 2} fill={e.fill} fillOpacity={e.fo} stroke={e.col} strokeWidth={1.2} />
          <text
            x={left + w / 2} y={e.y + 0.5} fill={e.col} fontSize={e.size} fontFamily={FONT} textAnchor="middle"
            dominantBaseline="central" fontWeight={600}
          >
            {e.str}
          </text>
        </g>
      );
    }
  }
}

// =====================================================================
//  Windows onto an endless corridor
//
//  A picture can only show finitely many rooms. To follow the guest of room
//  1000 we show a few rooms near the start, a few near 1000 and a few near
//  where they are going, with a gap between each stretch. A window is that
//  list of rooms, laid out left to right.
// =====================================================================
export interface Run {
  start: number;
  count: number;
  x: number; // left edge
}
export interface Win {
  runs: Run[];
  pitch: number;
  gaps: number[]; // centres of the gaps between runs
  right: number; //  right edge of the last run
  pos: (n: number) => number; // centre of room n; off-window numbers land in the nearest gap
  has: (n: number) => boolean;
}

export function makeWin(nums: number[], x0: number, pitch: number, gapW: number): Win {
  const sorted = [...new Set(nums.filter((n) => n >= 1).map(Math.round))].sort((a, b) => a - b);
  const runs: Run[] = [];
  const gaps: number[] = [];
  let x = x0;
  for (const n of sorted) {
    const r = runs[runs.length - 1];
    if (r && n === r.start + r.count) r.count++;
    else {
      if (r) {
        gaps.push(x + gapW / 2);
        x += gapW;
      }
      runs.push({ start: n, count: 1, x });
    }
    x += pitch;
  }
  const right = x;
  const pos = (n: number) => {
    for (let i = 0; i < runs.length; i++) {
      const r = runs[i];
      if (n >= r.start && n < r.start + r.count) return r.x + (n - r.start + 0.5) * pitch;
      if (n < r.start) return i === 0 ? r.x - pitch * 0.8 : gaps[i - 1];
    }
    return right + gapW * 0.6;
  };
  const has = (n: number) => runs.some((r) => n >= r.start && n < r.start + r.count);
  return { runs, pitch, gaps, right, pos, has };
}

/** The rooms 1, 2, ..., count in an unbroken stretch. */
export const firstRooms = (count: number, x0: number, pitch: number) =>
  makeWin(Array.from({ length: count }, (_, i) => i + 1), x0, pitch, 0);

export function numeralSize(label: string, pitch: number, base = 11.5) {
  return Math.max(6.5, Math.min(base, (pitch * 1.75) / Math.max(1, label.length)));
}

// A stretch of rooms (or of seats) drawn as one strip with shared walls. The
// first wall is drawn only at room 1, the true start of the corridor. No
// stretch is ever closed on the right: there is no last room.
export function StripView(props: {
  win: Win;
  top: number;
  h: number;
  pal: Palette;
  numbers: "above" | "corner" | "none";
  trail?: boolean; // dots after the last stretch
  W?: number;
}): ReactElement {
  const { win, top, h, pal, numbers } = props;
  const wall = rgb(pal.wall);
  const numc = rgb(pal.num);
  const p = win.pitch;
  const out: ReactElement[] = [];
  win.runs.forEach((r, ri) => {
    const left = r.x;
    const right = r.x + r.count * p;
    const openL = r.start !== 1;
    const lx = openL ? left - 7 : left;
    const rx = right + 7;
    out.push(
      <line key={`t${ri}`} x1={lx} y1={top} x2={rx} y2={top} stroke={wall} strokeWidth={1.4} />,
      <line key={`b${ri}`} x1={lx} y1={top + h} x2={rx} y2={top + h} stroke={wall} strokeWidth={1.4} />,
    );
    for (let k = openL ? 0 : 0; k <= r.count; k++) {
      if (k === 0 && openL) {
        out.push(<line key={`d${ri}_${k}`} x1={left} y1={top} x2={left} y2={top + h} stroke={wall} strokeWidth={0.9} />);
        continue;
      }
      out.push(
        <line
          key={`d${ri}_${k}`} x1={left + k * p} y1={top} x2={left + k * p} y2={top + h} stroke={wall}
          strokeWidth={k === 0 ? 1.4 : 0.9}
        />,
      );
    }
    if (numbers !== "none") {
      for (let k = 0; k < r.count; k++) {
        const label = fmt(r.start + k);
        const fs = numeralSize(label, p, numbers === "corner" ? 9.5 : 11.5);
        out.push(
          numbers === "above" ? (
            <text
              key={`n${ri}_${k}`} x={left + (k + 0.5) * p} y={top - 7} fill={numc} fontSize={fs} fontFamily={FONT}
              textAnchor="middle"
            >
              {label}
            </text>
          ) : (
            <text
              key={`n${ri}_${k}`} x={left + k * p + 3} y={top + 3} fill={numc} fontSize={fs} fontFamily={FONT}
              dominantBaseline="hanging"
            >
              {label}
            </text>
          ),
        );
      }
    }
  });
  win.gaps.forEach((g, i) => {
    out.push(<Dots key={`g${i}`} x={g} y={top + h / 2} color={numc} />);
  });
  if (props.trail !== false) {
    out.push(<Dots key="trail" x={win.right + 18} y={top + h / 2} color={numc} />);
  }
  return <g>{out}</g>;
}

export function Dots(props: { x: number; y: number; color: string; vertical?: boolean }): ReactElement {
  const { x, y, color, vertical } = props;
  return (
    <g fill={color}>
      {[-6, 0, 6].map((d) => (
        <circle key={d} cx={vertical ? x : x + d} cy={vertical ? y + d : y} r={1.6} />
      ))}
    </g>
  );
}

// =====================================================================
//  The hotel's own geometry, worked out from the width of the picture.
//  Rooms are about 40 units wide, so a phone shows eight or nine of them
//  and a desktop column about thirteen.
// =====================================================================
export interface HotelGeom {
  x0: number; //    left wall of room 1
  pitch: number;
  count: number; // rooms drawn (the corridor runs on past the picture)
  roomX: (n: number) => number;
}
export function hotelGeom(W: number, left = 18, right = 26): HotelGeom {
  const pitch = Math.max(36, Math.min(46, (W - left - right) / 13));
  const count = Math.floor((W - left - right) / pitch);
  return { x0: left, pitch, count, roomX: (n: number) => left + (n - 0.5) * pitch };
}

export const STRIP_H = 50;
/** Feet of a guest standing in a room whose strip starts at `top`. */
export const roomFeet = (top: number) => top + STRIP_H - 5;

// A window onto an endless coach, drawn like the corridor: seats in stretches
// with gaps between them, the seat number in each seat's corner, and the
// coach's nose in front of seat 1.
export function BusWindow(props: { win: Win; top: number; h: number; pal: Palette }): ReactElement {
  const { win, top, h, pal } = props;
  const wall = rgb(pal.wall);
  const first = win.runs[0];
  const showNose = first && first.start === 1;
  const x = first ? first.x : 0;
  const r = Math.min(7, h * 0.16);
  const wheels: number[] = [];
  if (showNose) wheels.push(x - NOSE + 14);
  for (const run of win.runs) {
    for (let k = 0; k < run.count; k += 3) wheels.push(run.x + (k + 0.5) * win.pitch);
  }
  return (
    <g>
      <StripView win={win} top={top} h={h} pal={pal} numbers="corner" />
      {showNose && (
        <g stroke={wall} fill="none" strokeWidth={1.4} strokeLinejoin="round">
          <polyline points={`${x},${top + h} ${x - NOSE},${top + h} ${x - NOSE},${top + h * 0.38} ${x - NOSE * 0.38},${top} ${x},${top}`} />
        </g>
      )}
      {wheels.map((wx) => (
        <circle key={wx} cx={wx} cy={top + h + r * 0.9} r={r} fill={rgb(pal.surface)} stroke={wall} strokeWidth={1.3} />
      ))}
    </g>
  );
}
