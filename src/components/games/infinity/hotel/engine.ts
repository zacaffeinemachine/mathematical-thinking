// =====================================================================
//  The animation engine shared by the Hilbert's hotel explainers.
//
//  A scene is a list of KEYFRAMES. Each keyframe is a complete picture: a
//  map from an id to a drawn thing (a guest, an arrow, a bus...), plus a few
//  named numbers ("vars") that a backdrop may read, such as how far along
//  the corridor the camera has walked. Going from one keyframe to the next
//  tweens every id present in both, fades in what is new (arrows are drawn
//  on instead) and fades out what is gone. A guest keeps the same id for as
//  long as they are the same guest, which is what makes them walk rather
//  than blink. A STEP is a run of keyframes played as one motion, and it
//  carries the caption shown while it is on screen. The controls move
//  between steps.
//
//  This is the engine of the old one-screen HilbertHotelAnimation.tsx,
//  generalised: colours are named ROLES resolved against the site theme at
//  draw time, positions are plain SVG units, and the controller can be
//  handed a new scene (a different screen width, or a question the student
//  asked) without being rebuilt.
// =====================================================================

export type Role =
  | "ink" //     strong text
  | "guest" //   a guest the hotel already had
  | "new" //     a new arrival: the traveller, the coach's passengers
  | "accent" //  the manager's instruction, the thread, whoever is being followed
  | "wall" //    the building and the buses
  | "num" //     room and seat numerals
  | "spent" //   an arrow already obeyed
  | "faint" //   background hints
  | "surface"; // the page behind the picture

export type Kind =
  | "person" //  a stick figure, feet at (x, y), with an optional label in the head
  | "arrow" //   from (x, y) to (x2, y2), optionally bent, drawn on with p
  | "rect" //    outline (and optional fill) from (x, y) to (x2, y2)
  | "disc" //    a filled circle of radius s, with an optional label
  | "ring" //    an unfilled circle of radius s
  | "text" //    a line of text
  | "tag" //     text in a small rounded box
  | "ell" //     three dots, centred at (x, y); s = 1 for a row, s = -1 for a column
  | "say" //     the manager's announcement, drawn in the band at the top
  | "hbus" //    a coach seen from the side: nose at x, roof at y, n seats of width pitch
  | "vbus" //    a bus seen from above, parked nose down: centre x, nose tip at y
  | "line"; //   a plain line from (x, y) to (x2, y2)

export interface Ent {
  k: Kind;
  z: number; //      paint order
  o: number; //      opacity
  c: Role; //        stroke / text colour
  f: Role; //        fill colour, where there is one
  fo: number; //     fill opacity
  x: number;
  y: number;
  x2: number;
  y2: number;
  s: number; //      person scale, disc radius
  w: number; //      stroke width
  p: number; //      how much of an arrow is drawn, 0..1
  bend: number; //   arrow: sideways bow. person: the dip of the arc they walk INTO this frame on
  size: number; //   font size
  n: number; //      seats on a bus
  pitch: number; //  seat width on a bus
  dash: number; //   1 for dashed
  str: string; //    text, or the label in a head
  anchor: "start" | "middle" | "end";
  bold: number;
  italic: number;
}

export const BASE: Ent = {
  k: "person", z: 5, o: 1, c: "guest", f: "surface", fo: 0, x: 0, y: 0, x2: 0, y2: 0,
  s: 1, w: 1.4, p: 1, bend: 0, size: 12, n: 0, pitch: 0, dash: 0, str: "", anchor: "middle",
  bold: 0, italic: 0,
};
export const mk = (e: Partial<Ent>): Ent => ({ ...BASE, ...e });

// ---- Scenes ---------------------------------------------------------------
export interface Frame {
  ents: Map<string, Ent>;
  vars: Record<string, number>;
  dur: number; //  ms to tween INTO this frame
  hold: number; // ms to rest on it before the next
}
export interface Step {
  end: number; //     index of the frame the step ends on
  caption: string; // the line under the picture; _x_ is set in italics
  chapter: number;
}
export interface Scene {
  frames: Frame[];
  steps: Step[];
  chapters?: string[];
}

// A small imperative builder: set things up, commit a frame, end a step.
export function builder() {
  const cur = new Map<string, Ent>();
  const vars: Record<string, number> = {};
  const frames: Frame[] = [];
  const steps: Step[] = [];
  let chapter = 0;
  const api = {
    cur,
    vars,
    set(id: string, e: Ent) {
      cur.set(id, e);
    },
    upd(id: string, patch: Partial<Ent>) {
      const e = cur.get(id);
      if (!e) throw new Error(`hotel engine: no entity ${id}`);
      cur.set(id, { ...e, ...patch });
    },
    has: (id: string) => cur.has(id),
    get: (id: string) => cur.get(id),
    del(id: string) {
      cur.delete(id);
    },
    delWhere(pred: (id: string, e: Ent) => boolean) {
      for (const [id, e] of [...cur]) if (pred(id, e)) cur.delete(id);
    },
    updWhere(pred: (id: string, e: Ent) => boolean, patch: Partial<Ent> | ((e: Ent) => Partial<Ent>)) {
      for (const [id, e] of [...cur]) {
        if (pred(id, e)) cur.set(id, { ...e, ...(typeof patch === "function" ? patch(e) : patch) });
      }
    },
    setVar(name: string, v: number) {
      vars[name] = v;
    },
    // Fresh positions should not inherit an old arc.
    straighten() {
      for (const [id, e] of [...cur]) if (e.k === "person" && e.bend) cur.set(id, { ...e, bend: 0 });
    },
    commit(dur: number, hold = 0) {
      frames.push({ ents: new Map(cur), vars: { ...vars }, dur, hold });
      api.straighten();
    },
    chapter(n: number) {
      chapter = n;
    },
    endStep(caption: string) {
      if (frames.length === 0) api.commit(0);
      steps.push({ end: frames.length - 1, caption, chapter });
    },
    scene(chapters?: string[]): Scene {
      return { frames, steps, chapters };
    },
  };
  return api;
}
export type Builder = ReturnType<typeof builder>;

// ---- Tweening -------------------------------------------------------------
const NUM_KEYS = ["o", "x2", "y2", "s", "w", "p", "size", "fo", "pitch", "n"] as const;
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export type RGB = readonly [number, number, number];
export type Palette = Record<Role, RGB>;

// What the renderer gets: an entity with its colours already resolved.
export interface Drawn extends Ent {
  col: string;
  fill: string;
}

const rgb = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const lerpRGB = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function lerpEnt(a: Ent, b: Ent, t: number, pal: Palette): Drawn {
  const r = { ...b } as Drawn;
  const ra = r as unknown as Record<string, number>;
  const aa = a as unknown as Record<string, number>;
  const bb = b as unknown as Record<string, number>;
  for (const key of NUM_KEYS) ra[key] = aa[key] + (bb[key] - aa[key]) * t;
  // A person walks along an arc when the frame they walk into asks for one.
  if (b.k === "person" && b.bend) {
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2 + b.bend;
    const u = 1 - t;
    r.x = u * u * a.x + 2 * u * t * cx + t * t * b.x;
    r.y = u * u * a.y + 2 * u * t * cy + t * t * b.y;
  } else {
    r.x = a.x + (b.x - a.x) * t;
    r.y = a.y + (b.y - a.y) * t;
  }
  r.bend = b.k === "person" ? 0 : a.bend + (b.bend - a.bend) * t;
  r.col = rgb(lerpRGB(pal[a.c], pal[b.c], t));
  r.fill = rgb(lerpRGB(pal[a.f], pal[b.f], t));
  if (t < 0.5) r.str = a.str;
  return r;
}

const resolve = (e: Ent, pal: Palette): Drawn => ({ ...e, col: rgb(pal[e.c]), fill: rgb(pal[e.f]) });

export function mix(
  a: Map<string, Ent>,
  b: Map<string, Ent>,
  t: number,
  pal: Palette,
): Array<[string, Drawn]> {
  const out: Array<[string, Drawn]> = [];
  if (a === b || t >= 1) {
    for (const [id, e] of b) out.push([id, resolve(e, pal)]);
  } else {
    for (const [id, eb] of b) {
      const ea = a.get(id);
      if (ea) out.push([id, lerpEnt(ea, eb, t, pal)]);
      else if (eb.k === "arrow") out.push([id, { ...resolve(eb, pal), p: eb.p * t }]);
      else out.push([id, { ...resolve(eb, pal), o: eb.o * t }]);
    }
    for (const [id, ea] of a) if (!b.has(id)) out.push([id, { ...resolve(ea, pal), o: ea.o * (1 - t) }]);
  }
  return out.filter(([, e]) => e.o > 0.003).sort((p, q) => p[1].z - q[1].z);
}

// A var whose name starts with "$" is a label, not a quantity: it takes the
// new value at once instead of passing through the numbers in between.
export function mixVars(a: Record<string, number>, b: Record<string, number>, t: number) {
  const out: Record<string, number> = { ...b };
  for (const key of Object.keys(b)) {
    if (key.startsWith("$")) continue;
    const va = a[key] ?? b[key];
    out[key] = va + (b[key] - va) * t;
  }
  return out;
}

// ---- Playback -------------------------------------------------------------
interface Anim {
  target: number;
  first: number;
  last: number;
  elapsed: number;
  total: number;
}

const GAP = 1100; // ms of rest between steps while playing

export function makeController(render: () => void) {
  const s = {
    data: { frames: [], steps: [] } as Scene,
    shown: 0,
    anim: null as Anim | null,
    playing: false,
    frozen: false,
    reduce: false,
    raf: 0,
    lastTs: 0,
    gap: 0 as ReturnType<typeof setTimeout> | 0,
  };
  const last = () => Math.max(0, s.data.steps.length - 1);
  const endOf = (k: number) => (k < 0 ? 0 : s.data.steps[k].end);

  const stopRaf = () => {
    if (s.raf) cancelAnimationFrame(s.raf);
    s.raf = 0;
  };
  const clearGap = () => {
    if (s.gap) clearTimeout(s.gap);
    s.gap = 0;
  };
  const scheduleNext = () => {
    clearGap();
    if (!s.playing) return;
    if (s.shown >= last()) {
      s.playing = false;
      render();
      return;
    }
    s.gap = setTimeout(() => {
      s.gap = 0;
      if (s.playing && !s.anim) start(s.shown + 1);
    }, s.reduce ? 2600 : GAP);
  };
  const complete = () => {
    if (!s.anim) return;
    s.shown = s.anim.target;
    s.anim = null;
    s.frozen = false;
    stopRaf();
    scheduleNext();
  };
  const loop = (ts: number) => {
    s.raf = 0;
    if (!s.anim || s.frozen) return;
    const dt = s.lastTs ? Math.min(ts - s.lastTs, 64) : 16;
    s.lastTs = ts;
    s.anim.elapsed += dt;
    if (s.anim.elapsed >= s.anim.total) complete();
    else s.raf = requestAnimationFrame(loop);
    render();
  };
  const kick = () => {
    if (s.raf || !s.anim || s.frozen) return;
    s.lastTs = 0;
    s.raf = requestAnimationFrame(loop);
  };
  function start(target: number) {
    if (target > last() || target < 1) return;
    if (s.reduce) {
      s.shown = target;
      s.anim = null;
      render();
      scheduleNext();
      return;
    }
    const first = endOf(target - 1) + 1;
    const lastF = endOf(target);
    let total = 0;
    for (let i = first; i <= lastF; i++) total += s.data.frames[i].dur + s.data.frames[i].hold;
    s.anim = { target, first, last: lastF, elapsed: 0, total: Math.max(total, 1) };
    s.frozen = false;
    render();
    kick();
  }
  const jump = (n: number) => {
    s.playing = false;
    clearGap();
    stopRaf();
    s.anim = null;
    s.frozen = false;
    s.shown = Math.max(0, Math.min(last(), n));
    render();
  };

  return {
    state: s,
    last,
    setData(data: Scene, step: number) {
      clearGap();
      stopRaf();
      s.anim = null;
      s.frozen = false;
      s.data = data;
      s.shown = Math.max(0, Math.min(last(), step));
    },
    view(): { a: number; b: number; t: number } {
      if (!s.anim) {
        const e = endOf(s.shown);
        return { a: e, b: e, t: 1 };
      }
      let acc = 0;
      const el = s.anim.elapsed;
      for (let i = s.anim.first; i <= s.anim.last; i++) {
        const f = s.data.frames[i];
        if (el < acc + f.dur) return { a: i - 1, b: i, t: (el - acc) / f.dur };
        acc += f.dur;
        if (el < acc + f.hold) return { a: i, b: i, t: 1 };
        acc += f.hold;
      }
      const e = endOf(s.anim.target);
      return { a: e, b: e, t: 1 };
    },
    current: () => (s.anim ? s.anim.target : s.shown),
    forward() {
      if (s.anim) {
        complete();
        render();
      } else if (s.shown < last()) {
        clearGap();
        start(s.shown + 1);
      }
    },
    back() {
      jump(s.anim ? s.anim.target - 1 : s.shown - 1);
    },
    toggle() {
      if (s.playing) {
        s.playing = false;
        clearGap();
        if (s.anim) {
          s.frozen = true;
          stopRaf();
        }
        render();
        return;
      }
      s.playing = true;
      if (s.anim) {
        s.frozen = false;
        kick();
      } else if (s.shown >= last()) {
        s.shown = 0;
        start(1);
      } else {
        start(s.shown + 1);
      }
      render();
    },
    // Play from the first step to the last, as when a question is answered.
    playFromStart() {
      jump(0);
      if (last() === 0) return;
      s.playing = true;
      start(1);
      render();
    },
    jump,
    setReduce(v: boolean) {
      s.reduce = v;
    },
    dispose() {
      stopRaf();
      clearGap();
    },
  };
}
export type Controller = ReturnType<typeof makeController>;
