// Where everything on the machine canvas is drawn: the arrows between
// states, the loops on a state, and the knob each arrow starts from.
//
// A state has one knob per symbol. A knob with an arrow sits at the tail of
// that arrow, on the rim, facing where the arrow goes, so dragging the knob
// is dragging the arrow. A knob with no arrow yet sits in a free gap on the
// right of its state. Loops go in the widest gap left by the other arrows,
// preferring the top. Pure TypeScript.

export const R = 24;           // state radius
export const KNOB = 7.5;       // knob radius
export const START_LEN = 34;   // length of the start arrow

export interface Pt { x: number; y: number }

export interface StatePos { id: string; x: number; y: number }

export interface ArrowDraw {
  from: string;
  sym: string;
  to: string;
  d: string;            // the curve, ending where the arrowhead's base sits
  head: string;         // the arrowhead, a filled triangle
  tail: Pt;             // where it leaves the rim (and where its knob is)
  mid: Pt;              // where its label chip goes
  samples: Pt[];        // points along it, for hit-testing
}

export interface KnobDraw { state: string; sym: string; x: number; y: number; filled: boolean }

const TAU = Math.PI * 2;
const unit = (a: number): Pt => ({ x: Math.cos(a), y: Math.sin(a) });
const add = (p: Pt, q: Pt, k = 1): Pt => ({ x: p.x + q.x * k, y: p.y + q.y * k });
const sub = (p: Pt, q: Pt): Pt => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p: Pt) => Math.hypot(p.x, p.y);
const norm = (p: Pt): Pt => { const l = len(p) || 1; return { x: p.x / l, y: p.y / l }; };
const angDist = (a: number, b: number) => { const d = Math.abs(((a - b) % TAU + TAU) % TAU); return Math.min(d, TAU - d); };
const r1 = (v: number) => Math.round(v * 10) / 10;

function arrowhead(tip: Pt, dir: Pt, size = 9): { base: Pt; path: string } {
  const u = norm(dir);
  const n = { x: -u.y, y: u.x };
  const base = add(tip, u, -size);
  const a = add(base, n, size * 0.45);
  const b = add(base, n, -size * 0.45);
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
export function curvedArrow(P: Pt, Q: Pt, h: number): Omit<ArrowDraw, "from" | "sym" | "to"> {
  let dir = sub(Q, P);
  if (len(dir) < 1) dir = { x: 1, y: 0 };
  const u = norm(dir);
  const n = { x: u.y, y: -u.x };            // left of travel, in screen coordinates (y down)
  const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  const C = add(M, n, 2 * h);
  const tail = add(P, norm(sub(C, P)), R);
  const tip = add(Q, norm(sub(C, Q)), R + 1.5);
  const { base, path } = arrowhead(tip, sub(tip, C));
  const samples = Array.from({ length: 17 }, (_, i) => quad(tail, C, tip, i / 16));
  return {
    d: `M ${r1(tail.x)} ${r1(tail.y)} Q ${r1(C.x)} ${r1(C.y)} ${r1(base.x)} ${r1(base.y)}`,
    head: path,
    tail,
    mid: quad(tail, C, tip, 0.5),
    samples,
  };
}

// A loop on the state at P, sticking out in direction `angle`.
export function loopArrow(P: Pt, angle: number): Omit<ArrowDraw, "from" | "sym" | "to"> {
  const a1 = angle - 0.42, a2 = angle + 0.42;
  const tail = add(P, unit(a1), R);
  const tip = add(P, unit(a2), R + 1.5);
  const c1 = add(P, unit(angle - 0.62), R * 2.75);
  const c2 = add(P, unit(angle + 0.62), R * 2.75);
  const { base, path } = arrowhead(tip, sub(tip, c2));
  const samples = Array.from({ length: 17 }, (_, i) => cubic(tail, c1, c2, tip, i / 16));
  return {
    d: `M ${r1(tail.x)} ${r1(tail.y)} C ${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(base.x)} ${r1(base.y)}`,
    head: path,
    tail,
    mid: cubic(tail, c1, c2, tip, 0.5),
    samples,
  };
}

// The angle from the centre of `p` at which the arrow toward the control
// point leaves, used to keep loops and empty knobs out of the way.
const angleOf = (from: Pt, to: Pt) => Math.atan2(to.y - from.y, to.x - from.x);

// The whole drawing. `arrows[s][a] = t` as in engine.ts.
export function layoutMachine(
  states: StatePos[],
  arrows: Record<string, Partial<Record<string, string>>>,
  alphabet: string[],
  start: string | null,
): { arrows: ArrowDraw[]; knobs: KnobDraw[] } {
  const pos = new Map(states.map((s) => [s.id, s]));
  const order = new Map(states.map((s, i) => [s.id, i]));
  const symIdx = (a: string) => alphabet.indexOf(a);

  // Every arrow between two different states, grouped by the pair.
  type A = { from: string; sym: string; to: string };
  const pairs = new Map<string, A[]>();
  const loops = new Map<string, A[]>();
  for (const s of states) for (const a of alphabet) {
    const t = arrows[s.id]?.[a];
    if (t === undefined || !pos.has(t)) continue;
    if (t === s.id) { const l = loops.get(s.id) ?? []; l.push({ from: s.id, sym: a, to: t }); loops.set(s.id, l); continue; }
    const [u, v] = order.get(s.id)! < order.get(t)! ? [s.id, t] : [t, s.id];
    const k = `${u}|${v}`;
    const l = pairs.get(k) ?? [];
    l.push({ from: s.id, sym: a, to: t });
    pairs.set(k, l);
  }

  const out: ArrowDraw[] = [];
  const occupied = new Map<string, number[]>(states.map((s) => [s.id, []]));
  if (start && occupied.has(start)) occupied.get(start)!.push(Math.PI);

  const GAP = 26, BASE = 15;
  for (const [k, list] of pairs) {
    const [u] = k.split("|");
    const fwd = list.filter((x) => x.from === u).sort((p, q) => symIdx(p.sym) - symIdx(q.sym));
    const bwd = list.filter((x) => x.from !== u).sort((p, q) => symIdx(p.sym) - symIdx(q.sym));
    const offs = new Map<A, number>();             // offset in the frame of u -> v
    if (bwd.length === 0) fwd.forEach((x, i) => offs.set(x, (i - (fwd.length - 1) / 2) * GAP));
    else if (fwd.length === 0) bwd.forEach((x, i) => offs.set(x, -(i - (bwd.length - 1) / 2) * GAP));
    else {
      fwd.forEach((x, i) => offs.set(x, BASE + i * GAP));
      bwd.forEach((x, i) => offs.set(x, -(BASE + i * GAP)));
    }
    for (const x of list) {
      const P = pos.get(x.from)!, Q = pos.get(x.to)!;
      const h = x.from === u ? offs.get(x)! : -offs.get(x)!;   // reversed travel flips "left"
      const g = curvedArrow(P, Q, h);
      out.push({ ...x, ...g });
      occupied.get(x.from)!.push(angleOf(P, g.tail));
      const tipDir = g.samples[g.samples.length - 1];
      occupied.get(x.to)!.push(angleOf(Q, tipDir));
    }
  }

  // Loops, each in the widest gap, nudged toward the top.
  const bestAngle = (taken: number[], prefer: number, minGap = 0) => {
    let best = prefer, score = -Infinity;
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU - Math.PI;
      const d = taken.length ? Math.min(...taken.map((t) => angDist(a, t))) : Math.PI;
      if (d < minGap) continue;
      const sc = Math.min(d, 1.4) - 0.25 * angDist(a, prefer);
      if (sc > score) { score = sc; best = a; }
    }
    return best;
  };
  for (const s of states) {
    const list = (loops.get(s.id) ?? []).sort((p, q) => symIdx(p.sym) - symIdx(q.sym));
    const taken = occupied.get(s.id)!;
    for (const x of list) {
      const a = bestAngle(taken, -Math.PI / 2);
      const g = loopArrow(s, a);
      out.push({ ...x, ...g });
      taken.push(a - 0.42, a, a + 0.42);
    }
  }

  // Knobs: at the tail of their arrow, or in a free spot on the right.
  const knobs: KnobDraw[] = [];
  for (const s of states) {
    const taken = occupied.get(s.id)!;
    alphabet.forEach((a, i) => {
      const ar = out.find((x) => x.from === s.id && x.sym === a);
      if (ar) { knobs.push({ state: s.id, sym: a, x: ar.tail.x, y: ar.tail.y, filled: true }); return; }
      const prefer = alphabet.length === 1 ? 0 : -0.75 + (1.5 * i) / (alphabet.length - 1);
      const ang = bestAngle(taken, prefer, 0.5);
      taken.push(ang);
      const p = add(s, unit(ang), R);
      knobs.push({ state: s.id, sym: a, x: p.x, y: p.y, filled: false });
    });
  }
  return { arrows: out, knobs };
}

// A dashed preview of an arrow being drawn from a knob: to a state (snapped,
// a loop if it is the knob's own state) or to the pointer.
export function previewPath(from: StatePos, knob: Pt, to: StatePos | null, pointer: Pt | null): string | null {
  if (to && to.id === from.id) return loopArrow(from, angleOf(from, knob) + 0.42).d;   // the loop leaves from the knob
  if (to) return curvedArrow(from, to, 0).d;
  if (!pointer) return null;
  return `M ${r1(knob.x)} ${r1(knob.y)} L ${r1(pointer.x)} ${r1(pointer.y)}`;
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
