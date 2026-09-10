// Pure geometry for the machine diagrams: where each wire runs and where
// each label sits. No JSX here on purpose, so the layout can be audited by
// a plain script without a browser. `scratch/geom.mjs` in the session notes
// does exactly that, and it is how the routing was fixed in the first
// place: run it after touching anything in this file.

import type { FSM, State } from "./model";
import { edgeGroups } from "./model";

export const NODE_STROKE = 1.8;
export const EDGE_STROKE = 1.6;
export const ACTIVE_EDGE_STROKE = 2.6;

// How close a wire or a label may come to a circle it has no business
// touching, over and above the circle's own radius.
const NODE_CLEARANCE = 6;

export interface Pt {
  x: number;
  y: number;
}

export function place(p: Pt, w: number, h: number, pad: number): Pt {
  return {
    x: pad + p.x * (w - 2 * pad),
    y: pad + p.y * (h - 2 * pad),
  };
}

// ---------------------------------------------------------------------
//  Geometry
// ---------------------------------------------------------------------
//
//  Every wire is worked out before anything is drawn, because two of the
//  three decisions need to see the whole picture:
//
//    * which way a self-loop should stick out (away from the crowd, and
//      not off the edge of the canvas);
//    * whether a straight wire would run through some third circle, and
//      which way to bend it if so;
//    * where each label can sit without landing on a circle or on another
//      label.
//
//  Drawing each edge in isolation, which is what this file used to do,
//  gets all three wrong the moment a diagram has more than four states.

export type EdgeKind = "loop" | "straight" | "bent";

export interface EdgeGeom {
  from: State;
  to: State;
  text: string;
  kind: EdgeKind;
  d: string;
  // Points sampled along the wire, used for clearance tests and for
  // hanging the label off the wire.
  samples: Pt[];
  // Unit normals at those samples, so a label can be offset sideways.
  normals: Pt[];
  // Filled in by the label pass.
  label: Pt;
  labelW: number;
  labelH: number;
}

function cubic(p0: Pt, c1: Pt, c2: Pt, p3: Pt, n = 40): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    });
  }
  return out;
}

function normalsOf(pts: Pt[]): Pt[] {
  return pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy) || 1;
    return { x: -dy / d, y: dx / d };
  });
}

// The direction a self-loop should stick out in. Twelve candidates, scored
// on how much room each one has: distance from the other circles, and
// whether the loop would fall off the canvas.
function loopDirection(
  machine: FSM,
  state: State,
  positions: Record<string, Pt>,
  nodeR: number,
  width: number,
  height: number,
): number {
  const p = positions[state];
  const reach = nodeR * 2.7;
  let best = Math.PI / 2; // up, the old default, which stays the winner in a tie
  let bestScore = -Infinity;

  for (let k = 0; k < 12; k++) {
    const dir = (k * Math.PI) / 6;
    const apex = { x: p.x + reach * Math.cos(dir), y: p.y - reach * Math.sin(dir) };
    let score = 0;

    // Falling off the canvas is disqualifying rather than merely bad.
    const margin = nodeR * 0.9;
    if (
      apex.x < margin ||
      apex.y < margin ||
      apex.x > width - margin ||
      apex.y > height - margin
    ) {
      score -= 1000;
    }

    for (const s of machine.states) {
      if (s === state) continue;
      const q = positions[s];
      score += Math.min(Math.hypot(apex.x - q.x, apex.y - q.y), 200);
    }
    // A gentle thumb on the scale for "up", so diagrams that were already
    // fine keep the look they had.
    if (k === 3) score += 30;

    if (score > bestScore) {
      bestScore = score;
      best = dir;
    }
  }
  return best;
}

function loopGeom(center: Pt, nodeR: number, dir: number): { d: string; samples: Pt[] } {
  // Leave and re-enter the circle 40 degrees either side of `dir`, with the
  // tangents radial at both ends so the curve meets the circle cleanly.
  const spread = (40 * Math.PI) / 180;
  const a1 = dir + spread;
  const a2 = dir - spread;
  const s = { x: center.x + nodeR * Math.cos(a1), y: center.y - nodeR * Math.sin(a1) };
  const e = { x: center.x + nodeR * Math.cos(a2), y: center.y - nodeR * Math.sin(a2) };
  const L = nodeR * 1.9;
  const c1 = { x: s.x + L * Math.cos(a1), y: s.y - L * Math.sin(a1) };
  const c2 = { x: e.x + L * Math.cos(a2), y: e.y - L * Math.sin(a2) };
  return {
    d: `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`,
    samples: cubic(s, c1, c2, e),
  };
}

function straightGeom(a: Pt, b: Pt, nodeR: number): { d: string; samples: Pt[] } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const s = { x: a.x + ux * nodeR, y: a.y + uy * nodeR };
  const e = { x: b.x - ux * nodeR, y: b.y - uy * nodeR };
  const samples: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    samples.push({ x: s.x + (e.x - s.x) * (i / 40), y: s.y + (e.y - s.y) * (i / 40) });
  }
  return { d: `M ${s.x} ${s.y} L ${e.x} ${e.y}`, samples };
}

// A wire that leaves and arrives along tangents rotated by `alpha` toward
// one side. Used for a pair of opposite arrows, so the two curve apart, and
// for stepping around a circle that a straight wire would run into.
function bentGeom(
  a: Pt,
  b: Pt,
  nodeR: number,
  alpha: number,
  side: 1 | -1,
): { d: string; samples: Pt[] } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist;
  const uy = dy / dist;
  const px = -uy * side;
  const py = ux * side;
  const cosA = Math.cos(alpha);
  const sinA = Math.sin(alpha);

  const exU = { x: ux * cosA + px * sinA, y: uy * cosA + py * sinA };
  const enU = { x: ux * cosA - px * sinA, y: uy * cosA - py * sinA };
  const s = { x: a.x + nodeR * exU.x, y: a.y + nodeR * exU.y };
  const e = { x: b.x - nodeR * enU.x, y: b.y - nodeR * enU.y };
  const handle = dist * (0.32 + alpha * 0.35);
  const c1 = { x: s.x + handle * exU.x, y: s.y + handle * exU.y };
  const c2 = { x: e.x - handle * enU.x, y: e.y - handle * enU.y };
  return {
    d: `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${e.x} ${e.y}`,
    samples: cubic(s, c1, c2, e),
  };
}

// Smallest distance from a run of sampled points to any circle that is not
// one of the wire's own endpoints.
function clearance(
  samples: Pt[],
  machine: FSM,
  positions: Record<string, Pt>,
  skip: State[],
): { worst: number; culprit: State | null } {
  let worst = Infinity;
  let culprit: State | null = null;
  for (const s of machine.states) {
    if (skip.includes(s)) continue;
    const q = positions[s];
    for (const pt of samples) {
      const d = Math.hypot(pt.x - q.x, pt.y - q.y);
      if (d < worst) {
        worst = d;
        culprit = s;
      }
    }
  }
  return { worst, culprit };
}

export function computeEdges(
  machine: FSM,
  positions: Record<string, Pt>,
  nodeR: number,
  labelFont: number,
  width: number,
  height: number,
): EdgeGeom[] {
  const groups = edgeGroups(machine);
  const hasReverse = (from: State, to: State) =>
    groups.some((g) => g.from === to && g.to === from && from !== to);

  return groups.map((g) => {
    const text = g.symbols.join(", ");
    const labelW = Math.max(labelFont * 0.7 * text.length, labelFont) + 8;
    const labelH = labelFont + 4;
    const base = { from: g.from, to: g.to, text, labelW, labelH, label: { x: 0, y: 0 } };

    if (g.from === g.to) {
      const dir = loopDirection(machine, g.from, positions, nodeR, width, height);
      const { d, samples } = loopGeom(positions[g.from], nodeR, dir);
      return { ...base, kind: "loop" as const, d, samples, normals: normalsOf(samples) };
    }

    const a = positions[g.from];
    const b = positions[g.to];

    if (hasReverse(g.from, g.to)) {
      // A pair of opposite arrows always bends to the same side in its own
      // frame, which is what makes the two curve apart rather than sit on
      // top of each other. Only how far it bows is free, so pick the bow
      // that keeps the widest berth from every other circle.
      let best = bentGeom(a, b, nodeR, 0.32, 1);
      let bestWorst = clearance(best.samples, machine, positions, [g.from, g.to]).worst;
      for (const alpha of [0.22, 0.42, 0.55]) {
        const cand = bentGeom(a, b, nodeR, alpha, 1);
        const inside = cand.samples.every(
          (p) => p.x > 2 && p.y > 2 && p.x < width - 2 && p.y < height - 2,
        );
        if (!inside) continue;
        const w = clearance(cand.samples, machine, positions, [g.from, g.to]).worst;
        if (w > bestWorst) {
          bestWorst = w;
          best = cand;
        }
      }
      return {
        ...base,
        kind: "bent" as const,
        d: best.d,
        samples: best.samples,
        normals: normalsOf(best.samples),
      };
    }

    // A straight wire is the first choice. It is only given up when it
    // would run into some third circle, and then it steps around on the
    // side away from that circle, bending as little as will clear it.
    const straight = straightGeom(a, b, nodeR);
    const own = [g.from, g.to];
    const near = clearance(straight.samples, machine, positions, own);
    if (near.worst >= nodeR + NODE_CLEARANCE) {
      return { ...base, kind: "straight" as const, d: straight.d, samples: straight.samples, normals: normalsOf(straight.samples) };
    }

    // Which side is the obstacle on? Bend the other way.
    const q = positions[near.culprit as State];
    const cross = (b.x - a.x) * (q.y - a.y) - (b.y - a.y) * (q.x - a.x);
    const side: 1 | -1 = cross > 0 ? -1 : 1;

    let bestD = straight.d;
    let bestSamples = straight.samples;
    let bestWorst = near.worst;
    for (const alpha of [0.34, 0.5, 0.68, 0.86]) {
      const cand = bentGeom(a, b, nodeR, alpha, side);
      const inside = cand.samples.every(
        (p) => p.x > 2 && p.y > 2 && p.x < width - 2 && p.y < height - 2,
      );
      if (!inside) continue;
      const c = clearance(cand.samples, machine, positions, own);
      if (c.worst > bestWorst) {
        bestWorst = c.worst;
        bestD = cand.d;
        bestSamples = cand.samples;
      }
      if (c.worst >= nodeR + NODE_CLEARANCE) break;
    }
    return { ...base, kind: "bent" as const, d: bestD, samples: bestSamples, normals: normalsOf(bestSamples) };
  });
}

// ---------------------------------------------------------------------
//  Labels
// ---------------------------------------------------------------------

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function boxHitsCircle(box: Box, c: Pt, r: number): boolean {
  const dx = Math.max(Math.abs(box.x - c.x) - box.w / 2, 0);
  const dy = Math.max(Math.abs(box.y - c.y) - box.h / 2, 0);
  return dx * dx + dy * dy < r * r;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}

// Hang each label off its own wire at the first spot that is clear of every
// circle, of the canvas edge, and of every label already placed. Candidates
// run from the middle of the wire outwards, and try both sides, because the
// middle of the wire is where a reader looks first.
export function placeLabels(
  edges: EdgeGeom[],
  machine: FSM,
  positions: Record<string, Pt>,
  nodeR: number,
  labelFont: number,
  width: number,
  height: number,
) {
  const placed: Box[] = [];

  // Short wires first: they have the fewest places to put a label, so they
  // should get their pick before a long wire hogs the spot.
  const order = [...edges].sort((a, b) => {
    const la = Math.hypot(
      a.samples[a.samples.length - 1].x - a.samples[0].x,
      a.samples[a.samples.length - 1].y - a.samples[0].y,
    );
    const lb = Math.hypot(
      b.samples[b.samples.length - 1].x - b.samples[0].x,
      b.samples[b.samples.length - 1].y - b.samples[0].y,
    );
    return la - lb;
  });

  for (const e of order) {
    const candidates: Pt[] = [];
    const n = e.samples.length - 1;

    if (e.kind === "loop") {
      // Straight out past the apex of the loop, then a little further, then
      // shuffled around the arc either way.
      for (const t of [0.5, 0.38, 0.62, 0.28, 0.72]) {
        const i = Math.round(t * n);
        const p = e.samples[i];
        const c = positions[e.from];
        const dx = p.x - c.x;
        const dy = p.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        for (const push of [labelFont * 0.75, labelFont * 1.5]) {
          candidates.push({ x: p.x + (dx / d) * push, y: p.y + (dy / d) * push });
        }
      }
    } else {
      for (const t of [0.5, 0.38, 0.62, 0.27, 0.73]) {
        const i = Math.round(t * n);
        const p = e.samples[i];
        const nrm = e.normals[i];
        for (const off of [14, -14, 22, -22, 30, -30]) {
          candidates.push({ x: p.x + nrm.x * off, y: p.y + nrm.y * off });
        }
      }
    }

    let best = candidates[0];
    let bestPenalty = Infinity;
    for (const cand of candidates) {
      const box: Box = { x: cand.x, y: cand.y, w: e.labelW, h: e.labelH };
      let penalty = 0;

      if (
        box.x - box.w / 2 < 2 ||
        box.y - box.h / 2 < 2 ||
        box.x + box.w / 2 > width - 2 ||
        box.y + box.h / 2 > height - 2
      ) {
        penalty += 100;
      }
      for (const s of machine.states) {
        if (boxHitsCircle(box, positions[s], nodeR + 3)) penalty += 60;
      }
      for (const p of placed) {
        if (boxesOverlap(box, p)) penalty += 40;
      }

      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        best = cand;
        if (penalty === 0) break;
      }
    }

    e.label = best;
    placed.push({ x: best.x, y: best.y, w: e.labelW, h: e.labelH });
  }
}

