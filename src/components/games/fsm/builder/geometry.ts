// Where everything on the machine canvas is drawn: the arrows between
// states, the loops on a state, and the label on each arrow.
//
// An arrow joins two states (or a state to itself) and carries a label, the
// symbols it reads. Two arrows between the same pair, one each way, bow
// apart. A loop goes in the widest gap left by the other arrows, preferring
// the top. Pure TypeScript.

export const R = 25;           // state radius
export const START_LEN = 34;   // length of the start arrow

export interface Pt { x: number; y: number }
export interface StatePos { id: string; x: number; y: number }
export interface Edge { from: string; to: string; label: string[] }

export interface EdgeDraw extends Edge {
  index: number;        // position in the edge list
  d: string;            // the curve, ending where the arrowhead's base sits
  head: string;         // the arrowhead, a filled triangle
  mid: Pt;              // where the label goes
  samples: Pt[];        // points along it, for hit-testing
}

const TAU = Math.PI * 2;
const unit = (a: number): Pt => ({ x: Math.cos(a), y: Math.sin(a) });
const add = (p: Pt, q: Pt, k = 1): Pt => ({ x: p.x + q.x * k, y: p.y + q.y * k });
const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p: Pt) => Math.hypot(p.x, p.y);
const norm = (p: Pt): Pt => { const l = len(p) || 1; return { x: p.x / l, y: p.y / l }; };
const angDist = (a: number, b: number) => { const d = Math.abs(((a - b) % TAU + TAU) % TAU); return Math.min(d, TAU - d); };
const r1 = (v: number) => Math.round(v * 10) / 10;
const angleOf = (from: Pt, to: Pt) => Math.atan2(to.y - from.y, to.x - from.x);

function arrowhead(tip: Pt, dir: Pt, size = 9): { base: Pt; path: string } {
  const u = norm(dir);
  const n = { x: -u.y, y: u.x };
  const base = add(tip, u, -size);
  const a = add(base, n, size * 0.42);
  const b = add(base, n, -size * 0.42);
  return { base, path: `M ${r1(tip.x)} ${r1(tip.y)} L ${r1(a.x)} ${r1(a.y)} L ${r1(b.x)} ${r1(b.y)} Z` };
}

const quad = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t;
  return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p1.y };
};
const cubic = (p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
};

// An arrow from the state at P to the state at Q, bowed sideways by h (to the
// left of the direction of travel when h > 0).
export function curvedArrow(P: Pt, Q: Pt, h: number) {
  let dir = sub(Q, P);
  if (len(dir) < 1) dir = { x: 1, y: 0 };
  const u = norm(dir);
  const n = { x: u.y, y: -u.x };            // left of travel on screen (y points down)
  const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const C = add(M, n, 2 * h);
  const tail = add(P, norm(sub(C, P)), R + 1);
  const tip = add(Q, norm(sub(C, Q)), R + 1.5);
  const { base, path } = arrowhead(tip, sub(tip, C));
  return {
    d: `M ${r1(tail.x)} ${r1(tail.y)} Q ${r1(C.x)} ${r1(C.y)} ${r1(base.x)} ${r1(base.y)}`,
    head: path,
    mid: quad(tail, C, tip, 0.5),
    samples: Array.from({ length: 17 }, (_, i) => quad(tail, C, tip, i / 16)),
    tailAngle: angleOf(P, tail),
    tipAngle: angleOf(Q, tip),
  };
}

// A loop on the state at P, sticking out in direction `angle`.
export function loopArrow(P: Pt, angle: number) {
  const a1 = angle - 0.42, a2 = angle + 0.42;
  const tail = add(P, unit(a1), R + 1);
  const tip = add(P, unit(a2), R + 1.5);
  const c1 = add(P, unit(angle - 0.62), R * 2.7);
  const c2 = add(P, unit(angle + 0.62), R * 2.7);
  const { base, path } = arrowhead(tip, sub(tip, c2));
  return {
    d: `M ${r1(tail.x)} ${r1(tail.y)} C ${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(base.x)} ${r1(base.y)}`,
    head: path,
    mid: cubic(tail, c1, c2, tip, 0.5),
    samples: Array.from({ length: 17 }, (_, i) => cubic(tail, c1, c2, tip, i / 16)),
  };
}

// The whole drawing.
export function layoutEdges(states: StatePos[], edges: Edge[], start: string | null): EdgeDraw[] {
  const pos = new Map(states.map((s) => [s.id, s]));
  const occupied = new Map<string, number[]>(states.map((s) => [s.id, []]));
  if (start && occupied.has(start)) occupied.get(start)!.push(Math.PI);
  const out: EdgeDraw[] = [];
  const has = (a: string, b: string) => edges.some((e) => e.from === a && e.to === b);

  edges.forEach((e, index) => {
    if (e.from === e.to) return;
    const P = pos.get(e.from), Q = pos.get(e.to);
    if (!P || !Q) return;
    const g = curvedArrow(P, Q, has(e.to, e.from) ? 16 : 0);
    out.push({ ...e, index, d: g.d, head: g.head, mid: g.mid, samples: g.samples });
    occupied.get(e.from)!.push(g.tailAngle);
    occupied.get(e.to)!.push(g.tipAngle);
  });

  edges.forEach((e, index) => {
    if (e.from !== e.to) return;
    const P = pos.get(e.from);
    if (!P) return;
    const taken = occupied.get(e.from)!;
    let best = -Math.PI / 2, score = -Infinity;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU - Math.PI;
      const d = taken.length ? Math.min(...taken.map((t) => angDist(a, t))) : Math.PI;
      const sc = Math.min(d, 1.4) - 0.25 * angDist(a, -Math.PI / 2);
      if (sc > score) { score = sc; best = a; }
    }
    const g = loopArrow(P, best);
    out.push({ ...e, index, ...g });
    taken.push(best - 0.42, best, best + 0.42);
  });
  return out;
}

export function distToSamples(p: Pt, samples: Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < samples.length; i++) {
    const a = samples[i], b = samples[i + 1];
    const ab = sub(b, a);
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
    best = Math.min(best, Math.hypot(p.x - (a.x + t * ab.x), p.y - (a.y + t * ab.y)));
  }
  return best;
}
