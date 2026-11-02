import { useEffect, useId, useMemo, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";

// =====================================================================
//  Hilbert's hotel, animated.
//
//  A replay of Slides/Ch05-Infinity/04-Hilbert-Hotel.tex. Same scenes, same
//  order, same moves, and the same coordinates: everything below is in the
//  deck's own centimetres (x to the right, y up), read off its TikZ macros,
//  and only turned into SVG units at the very end. Read the deck's header
//  comment before changing any choreography here.
//
//  The model is a list of KEYFRAMES. Each keyframe is a complete picture: a
//  map from an id to a drawn thing (a person, an arrow, a ring, a bus...).
//  Going from one keyframe to the next tweens every id present in both, fades
//  in what is new (arrows are drawn on instead) and fades out what is gone.
//  A person keeps the same id for as long as they are the same person, which
//  is what makes them walk rather than blink. A STEP is a run of keyframes,
//  played as one motion; the controls move between steps.
// =====================================================================

type RGB = readonly [number, number, number];

const GRAY: RGB = [180, 185, 195]; //    textgray: the building, the guests it already had
const GOLD: RGB = [220, 180, 100]; //    accent: the instruction, the thread, the driver
const AZURE: RGB = [120, 185, 235]; //   accentcool: a new arrival
const HEADING: RGB = [150, 170, 200]; // headingcolor: the banner
const NAVDIM: RGB = [120, 128, 140]; //  room numerals and trailing dots
const SPENT: RGB = [74, 80, 90]; //      an arrow already obeyed
const BURGUNDY: RGB = [188, 72, 88]; //  the second busload of "Two Buses"
const BG = "rgb(20,24,30)";
const LIGHTBG = "rgb(30,35,42)";
const DARKERBG = "rgb(15,18,23)";

// ---- The deck's geometry, in centimetres -------------------------------
const roomX = (n: number) => 0.72 * (n - 8);
const corrX = (n: number) => 0.72 * (n - 7.5);
const seatX = (k: number) => -3.95 + 0.86 * (k - 1);
const gX = seatX; // the lattice's columns are the bus's seats
const gY = (r: number) => 1.4 + 0.68 * (r - 1);
const ROOM_FEET = -1.97;
const CORR_FEET = -3.3;

// The kit's thread: cell n of the dovetail is CELLS[n-1] = [column, row].
const CELLS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [2, 1], [1, 2], [3, 1], [2, 2], [1, 3], [4, 1], [3, 2], [2, 3], [1, 4], [5, 1],
];
const TAIL: readonly [number, number] = [4, 2];

const SCENES = ["The Hotel", "One Guest", "A Bus", "Two Buses", "A Fleet", "One Bus"] as const;

// ---- Drawn things -------------------------------------------------------
type Kind = "person" | "arrow" | "rect" | "ring" | "disc" | "text" | "ell" | "bus" | "balloon";

interface Ent {
  k: Kind;
  z: number; //        paint order
  o: number; //        opacity
  c: RGB; //           colour
  x: number; //        anchor (feet of a person, start of an arrow, centre of a ring...)
  y: number;
  x2: number; //       end of an arrow, far corner of a rect
  y2: number;
  s: number; //        person scale, ring or disc radius
  w: number; //        stroke width in pt
  p: number; //        how much of an arrow is drawn, 0..1
  head: number; //     arrowhead length in pt, 0 for none
  dash: number; //     1 for dashed
  shorten: number; //  cm taken off both ends of an arrow
  str: string; //      text, or a balloon's words
  size: number; //     font size in cm
  bw: number; //       balloon width in cm
  inside: number; //   1 for the balloon over room one
  f: number; //        a bus's floor
}

const BASE: Ent = {
  k: "person", z: 0, o: 1, c: GRAY, x: 0, y: 0, x2: 0, y2: 0, s: 1, w: 0.7, p: 1,
  head: 0, dash: 0, shorten: 0, str: "", size: 0.28, bw: 0, inside: 0, f: 0,
};
const mk = (e: Partial<Ent>): Ent => ({ ...BASE, ...e });

const person = (x: number, y: number, c: RGB, s: number): Ent => mk({ k: "person", z: 6, x, y, c, s });
const arrow = (
  x: number, y: number, x2: number, y2: number, c: RGB,
  w = 0.9, head = 5, shorten = 0, dash = 0,
): Ent => mk({ k: "arrow", z: 4, x, y, x2, y2, c, w, head, shorten, dash });
const ell = (x: number, y: number, c: RGB): Ent => mk({ k: "ell", z: 2, x, y, c });
const ring = (x: number, y: number, c: RGB, w: number, z = 5): Ent => mk({ k: "ring", z, x, y, c, w, s: 0.105 });
const label = (x: number, y: number, str: string): Ent =>
  mk({ k: "text", z: 7, x, y, c: GOLD, str, size: 0.27 });
const lit = (n: number): Ent =>
  mk({ k: "rect", z: 3, x: roomX(n) - 0.36, y: -2.05, x2: roomX(n) + 0.36, y2: -1.2, c: GOLD, w: 1.1 });
const busBody = (f: number, dx: number): Ent => mk({ k: "bus", z: 1, x: dx, f, c: GRAY });

// The four balloons, with the widths the deck's boxes come out at.
const BALLOON_W: Record<string, number> = {
  "Where do I go?": 2.68,
  "well ok…": 1.92,
  "Be gentle": 1.8,
  "Bed bugs!": 1.9,
};
const balloon = (str: string, inside: boolean): Ent =>
  mk({
    k: "balloon", z: 8, str, bw: BALLOON_W[str], inside: inside ? 1 : 0,
    x: inside ? -4.78 : -4.55, y: inside ? 0.34 : 2.62,
  });

// Where a thread number sits beside its lattice cell: below and to the
// left, as \latnum anchors it (north east at gx-0.06, gy-0.13).
const latLabelPos = (n: number): [number, number] => {
  const [c, r] = CELLS[n - 1];
  const digits = n >= 10 ? 2 : 1;
  return [gX(c) - 0.095 - 0.078 * digits, gY(r) - 0.27];
};

// ---- Keyframes and steps ------------------------------------------------
interface Frame {
  ents: Map<string, Ent>;
  banner: string;
  dur: number; //  ms to tween INTO this frame
  hold: number; // ms to rest on it before the next
}
interface Step {
  end: number; //  index of the frame the step ends on
  scene: number;
}

function build(): { frames: Frame[]; steps: Step[] } {
  const cur = new Map<string, Ent>();
  const frames: Frame[] = [];
  const steps: Step[] = [];
  let banner = "";
  let scene = 0;

  const set = (id: string, e: Ent) => void cur.set(id, e);
  const upd = (id: string, patch: Partial<Ent>) => {
    const e = cur.get(id);
    if (!e) throw new Error(`HilbertHotelAnimation: no entity ${id}`);
    cur.set(id, { ...e, ...patch });
  };
  const del = (id: string) => void cur.delete(id);
  const delWhere = (pred: (id: string) => boolean) => {
    for (const id of [...cur.keys()]) if (pred(id)) cur.delete(id);
  };
  const commit = (dur: number, hold = 0) => {
    frames.push({ ents: new Map(cur), banner, dur, hold });
  };
  const endStep = () => void steps.push({ end: frames.length - 1, scene });

  // occ[n] is the id of whoever is in room n right now.
  const occ: string[] = new Array(16).fill("");

  // A bus, and its load if it has one, with the whole thing shifted dx.
  const putBus = (id: string, f: number, load: RGB | null, dx: number) => {
    set(id, busBody(f, dx));
    if (load) {
      for (let k = 1; k <= 11; k++) set(`${id}.${k}`, person(seatX(k) + dx, f + 0.06, load, 1.15));
      set(`${id}.dots`, ell(5.3 + dx, f + 0.4, NAVDIM));
    }
  };
  // The bus faces left, so it comes in nose first from the right.
  const driveIn = (id: string, f: number, load: RGB | null) => {
    putBus(id, f, load, 13);
    commit(0);
    putBus(id, f, load, 0);
    commit(1500, 150);
  };
  // A bus has no right-hand end, so it cannot drive off the screen whole:
  // it pulls away to the left and fades. Its passengers stay where they are.
  const busAway = (id: string) => upd(id, { x: -2.5, o: 0 });

  // A new frame of the deck: the hotel full of grey guests, and nothing else.
  const sceneReset = () => {
    const keep = new Set(occ.filter(Boolean));
    keep.add("roomell");
    delWhere((id) => !keep.has(id));
    for (let n = 1; n <= 15; n++) upd(occ[n], { c: GRAY, x: roomX(n), y: ROOM_FEET, s: 1.2, o: 1 });
    upd("roomell", { c: NAVDIM });
  };

  const arrowsOut = () => {
    for (let n = 1; n <= 15; n++) set(`out${n}`, arrow(roomX(n), -2.13, corrX(n), -2.5, GRAY, 0.8));
  };
  // Everybody out into the corridor, half a pitch along. The guest of room
  // fifteen becomes the corridor's trailing dots, as in the deck.
  const walkOut = (): string[] => {
    const corr: string[] = [""];
    for (let n = 1; n <= 15; n++) upd(`out${n}`, { c: SPENT });
    for (let n = 1; n <= 14; n++) {
      upd(occ[n], { x: corrX(n), y: CORR_FEET });
      corr[n] = occ[n];
    }
    const last = occ[15];
    upd(last, { x: corrX(15), y: CORR_FEET, o: 0 });
    set("corrdots", ell(corrX(15), -3.0, NAVDIM));
    occ.fill("");
    commit(1100);
    del(last);
    return corr;
  };

  // =================================================================
  //  1. THE HOTEL
  // =================================================================
  banner = "A Hotel With No Last Room";
  set("roomell", ell(5.78, -1.62, NAVDIM));
  commit(0);
  endStep(); //                                                   1
  for (let n = 1; n <= 15; n++) {
    occ[n] = `g${n}`;
    set(occ[n], person(roomX(n), ROOM_FEET, GRAY, 1.2));
  }
  commit(800);
  endStep(); //                                                   2
  set("new", person(-7.0, 1.94, AZURE, 1.55));
  commit(0);
  upd("new", { x: -5.45 });
  commit(1000);
  endStep(); //                                                   3
  set("bal.where", balloon("Where do I go?", false));
  commit(500);
  endStep(); //                                                   4

  // =================================================================
  //  2. ONE GUEST
  // =================================================================
  scene = 1;
  banner = "One More Guest";
  del("bal.where");
  set("bal.ok", balloon("well ok…", false));
  arrowsOut();
  commit(800);
  endStep(); //                                                   5  fifteen arrows out
  del("bal.ok");
  let corr = walkOut();
  endStep(); //                                                   6  everybody out
  delWhere((id) => id.startsWith("out"));
  for (let n = 1; n <= 14; n++) set(`in${n}`, arrow(corrX(n), -2.5, 0.72 * (n - 7), -2.13, GOLD, 0.8));
  set("away", arrow(corrX(15), -2.5, 5.7, -2.13, GOLD, 0.8));
  commit(800);
  endStep(); //                                                   7  arrows in, one along
  for (let n = 1; n <= 14; n++) upd(`in${n}`, { c: SPENT });
  upd("away", { c: SPENT });
  for (let j = 1; j <= 14; j++) {
    upd(corr[j], { x: roomX(j + 1), y: ROOM_FEET });
    occ[j + 1] = corr[j];
  }
  upd("corrdots", { x: 6.4, y: -2.05, o: 0 });
  commit(1200);
  del("corrdots");
  set("lit", lit(1));
  upd("roomell", { c: GOLD });
  commit(400);
  endStep(); //                                                   8  everybody one along
  delWhere((id) => id.startsWith("in") || id === "away" || id === "lit");
  upd("roomell", { c: NAVDIM });
  set("newarrow", arrow(-5.45, 1.94, roomX(1), -1.12, AZURE, 0.9));
  set("bal.gentle", balloon("Be gentle", false));
  commit(800);
  endStep(); //                                                   9
  upd("newarrow", { c: SPENT });
  del("bal.gentle");
  upd("new", { x: roomX(1), y: ROOM_FEET, s: 1.2 });
  occ[1] = "new";
  commit(1200);
  set("bal.bugs", balloon("Bed bugs!", true));
  commit(500);
  endStep(); //                                                   10

  // =================================================================
  //  3. A BUS
  // =================================================================
  scene = 2;
  banner = "A Busload";
  sceneReset();
  commit(600);
  endStep(); //                                                   11
  driveIn("bus", 0.05, AZURE);
  endStep(); //                                                   12 the bus arrives
  busAway("bus");
  commit(1100);
  endStep(); //                                                   13 the bus leaves, its load stays
  del("bus");
  arrowsOut();
  commit(800);
  endStep(); //                                                   14
  corr = walkOut();
  endStep(); //                                                   15

  banner = "Odd Rooms and Even Rooms";
  delWhere((id) => id.startsWith("out"));
  commit(500);
  endStep(); //                                                   16
  // Room n: odd from the bus (seat k -> room 2k-1), even from the corridor
  // (spot j -> room 2j). The arrow first, with the room lit; then the move.
  const zipRoom = (n: number) => {
    del(`za${n - 1}`);
    let mover: string;
    if (n % 2 === 1) {
      const k = (n + 1) / 2;
      mover = `bus.${k}`;
      set(`za${n}`, arrow(seatX(k), 0.02, roomX(n), -1.12, AZURE));
    } else {
      const j = n / 2;
      mover = corr[j];
      set(`za${n}`, arrow(corrX(j), -2.4, roomX(n), -2.13, GRAY));
    }
    set("lit", lit(n));
    commit(450, 150);
    upd(`za${n}`, { c: SPENT });
    upd(mover, { x: roomX(n), y: ROOM_FEET, s: 1.2 });
    occ[n] = mover;
    commit(800, 150);
  };
  zipRoom(1);
  endStep(); //                                                   17
  zipRoom(2);
  endStep(); //                                                   18
  for (let n = 3; n <= 15; n++) zipRoom(n);
  upd("roomell", { c: GOLD });
  commit(400);
  endStep(); //                                                   19

  // =================================================================
  //  4. TWO BUSES
  // =================================================================
  scene = 3;
  banner = "Two Busloads at Once";
  sceneReset();
  commit(600);
  putBus("near", 1.45, AZURE, 13);
  putBus("far", -0.35, BURGUNDY, 13);
  commit(0);
  putBus("near", 1.45, AZURE, 0);
  putBus("far", -0.35, BURGUNDY, 0);
  commit(1500, 150);
  endStep(); //                                                   20
  driveIn("eb", 3.25, null);
  endStep(); //                                                   21 an empty bus
  // Near seat k -> new seat 2k-1, far seat k -> new seat 2k.
  let prev = "";
  const transfer = (near: boolean, k: number) => {
    if (prev) del(prev);
    const to = near ? 2 * k - 1 : 2 * k;
    const id = near ? `tn${k}` : `tf${k}`;
    set(
      id,
      near
        ? arrow(seatX(k), 2.31, seatX(to), 3.19, AZURE)
        : arrow(seatX(k), 0.51, seatX(to), 3.19, BURGUNDY),
    );
    commit(450, 150);
    upd(id, { c: SPENT });
    upd(near ? `near.${k}` : `far.${k}`, { x: seatX(to), y: 3.25 + 0.06 });
    commit(900, 150);
    prev = id;
  };
  transfer(true, 1);
  endStep(); //                                                   22
  transfer(false, 1);
  endStep(); //                                                   23
  for (let k = 2; k <= 6; k++) {
    transfer(true, k);
    if (k <= 5) transfer(false, k);
  }
  endStep(); //                                                   24
  // Everybody else, whose seats are off the screen, to seats off the screen.
  del(prev);
  for (let k = 7; k <= 11; k++) upd(`near.${k}`, { x: seatX(2 * k - 1), y: 3.31, o: 0 });
  for (let k = 6; k <= 11; k++) upd(`far.${k}`, { x: seatX(2 * k), y: 3.31, o: 0 });
  upd("near.dots", { o: 0 });
  upd("far.dots", { o: 0 });
  set("eb.dots", ell(5.3, 3.65, NAVDIM));
  commit(1300);
  endStep(); //                                                   25
  busAway("near");
  busAway("far");
  commit(1100);
  upd("roomell", { c: GOLD });
  commit(400);
  endStep(); //                                                   26

  // =================================================================
  //  5. A FLEET
  // =================================================================
  scene = 4;
  banner = "A Bus for Every Number";
  sceneReset();
  commit(600);
  driveIn("b1", 0.05, AZURE);
  endStep(); //                                                   27
  driveIn("b2", 1.3, AZURE);
  endStep(); //                                                   28
  driveIn("b3", 2.55, AZURE);
  endStep(); //                                                   29
  [3.78, 3.94, 4.1].forEach((y, i) => {
    set(`mb${i}`, mk({ k: "disc", z: 2, x: seatX(1), y, s: 0.06, c: GRAY }));
    commit(250);
  });
  endStep(); //                                                   30

  banner = "Everybody Out Again";
  busAway("b1");
  busAway("b2");
  busAway("b3");
  commit(1100);
  endStep(); //                                                   31
  // Up into the lattice: bus r becomes row r, seat c column c, directly
  // above where they sat. The head lands on the ring.
  for (let r = 1; r <= 3; r++) {
    for (let c = 1; c <= 11; c++) upd(`b${r}.${c}`, { x: gX(c), y: gY(r) - 0.558 });
    upd(`b${r}.dots`, { y: gY(r) });
  }
  commit(1100, 100);
  delWhere((id) => /^b[123]\.\d+$/.test(id));
  for (let r = 1; r <= 4; r++)
    for (let c = 1; c <= 11; c++) set(`lat${c}_${r}`, ring(gX(c), gY(r), AZURE, 0.7, 2));
  set("b4.dots", ell(5.3, gY(4), NAVDIM));
  commit(600);
  endStep(); //                                                   32

  banner = "The Same Thread";
  const tn: Array<[number, number]> = [[0, 0]];
  const mark = (n: number) => {
    const [c, r] = CELLS[n - 1];
    tn[n] = [gX(c), gY(r)];
    const [lx, ly] = latLabelPos(n);
    set(`tm${n}`, ring(gX(c), gY(r), GOLD, 0.9));
    set(`tl${n}`, label(lx, ly, String(n)));
  };
  const edge = (i: number) =>
    set(`te${i}`, arrow(tn[i][0], tn[i][1], tn[i + 1][0], tn[i + 1][1], GOLD, 0.8, 4.5, 0.18));
  const extendTo = (upto: number, from: number) => {
    for (let n = from; n <= upto; n++) {
      const [c, r] = CELLS[n - 1];
      tn[n] = [gX(c), gY(r)];
      edge(n - 1);
      commit(450);
      mark(n);
      commit(250, 100);
    }
  };
  mark(1);
  commit(500);
  endStep(); //                                                   33
  extendTo(3, 2);
  endStep(); //                                                   34
  extendTo(6, 4);
  endStep(); //                                                   35
  extendTo(10, 7);
  endStep(); //                                                   36
  extendTo(11, 11);
  const tailTo: [number, number] = [gX(TAIL[0]), gY(TAIL[1])];
  set("tail", arrow(tn[11][0], tn[11][1], tailTo[0], tailTo[1], GOLD, 0.8, 4.5, 0.18, 1));
  commit(450);
  endStep(); //                                                   37

  // =================================================================
  //  6. ONE BUS
  // =================================================================
  scene = 5;
  banner = "One Bus After All";
  driveIn("ob", 0.05, null);
  endStep(); //                                                   38
  // Passenger n walks down into seat n, and the two steps of the thread
  // that touch them go with them: the thread stays one line.
  const refreshEdges = () => {
    for (let i = 1; i <= 10; i++)
      upd(`te${i}`, { x: tn[i][0], y: tn[i][1], x2: tn[i + 1][0], y2: tn[i + 1][1] });
    upd("tail", { x: tn[11][0], y: tn[11][1] });
  };
  const board = (n: number) => {
    const [c, r] = CELLS[n - 1];
    tn[n] = [seatX(n), 0.05 + 0.618];
    upd(`tm${n}`, { x: tn[n][0], y: tn[n][1] });
    upd(`tl${n}`, { x: seatX(n), y: 0.35 });
    del(`lat${c}_${r}`);
  };
  const boardOne = (n: number) => {
    board(n);
    refreshEdges();
    commit(1100, 200);
  };
  boardOne(1);
  endStep(); //                                                   39
  boardOne(2);
  endStep(); //                                                   40
  for (let n = 3; n <= 5; n++) boardOne(n);
  endStep(); //                                                   41
  // And the rest of the thread follows, and the whole fleet is one busload.
  for (let n = 6; n <= 11; n++) board(n);
  refreshEdges();
  delWhere((id) => id.startsWith("lat") || /^b\d\.dots$/.test(id) || id.startsWith("mb") || id === "tail");
  commit(1200, 150);
  delWhere((id) => /^t[mle]\d+$/.test(id));
  for (let k = 1; k <= 11; k++) set(`ob.${k}`, person(seatX(k), 0.11, AZURE, 1.15));
  set("ob.dots", ell(5.3, 0.45, NAVDIM));
  upd("roomell", { c: GOLD });
  commit(700);
  endStep(); //                                                   42

  return { frames, steps };
}

const DATA = build();
const LAST = DATA.steps.length - 1;
const endOf = (s: number) => (s < 0 ? 0 : DATA.steps[s].end);
const FIRST_OF_SCENE = SCENES.map((_, sc) => DATA.steps.findIndex((s) => s.scene === sc));

// ---- Tweening -----------------------------------------------------------
const NUM_KEYS = ["o", "x", "y", "x2", "y2", "s", "w", "p", "shorten", "size", "f", "bw"] as const;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function lerpEnt(a: Ent, b: Ent, t: number): Ent {
  const r: Ent = { ...b };
  const ra = r as unknown as Record<string, number>;
  const aa = a as unknown as Record<string, number>;
  const bb = b as unknown as Record<string, number>;
  for (const key of NUM_KEYS) ra[key] = aa[key] + (bb[key] - aa[key]) * t;
  r.c = [a.c[0] + (b.c[0] - a.c[0]) * t, a.c[1] + (b.c[1] - a.c[1]) * t, a.c[2] + (b.c[2] - a.c[2]) * t];
  return r;
}

function mix(a: Map<string, Ent>, b: Map<string, Ent>, t: number): Array<[string, Ent]> {
  const out: Array<[string, Ent]> = [];
  if (a === b || t >= 1) {
    for (const [id, e] of b) out.push([id, e]);
  } else {
    for (const [id, eb] of b) {
      const ea = a.get(id);
      if (ea) out.push([id, lerpEnt(ea, eb, t)]);
      else if (eb.k === "arrow") out.push([id, { ...eb, p: eb.p * t }]); // drawn on
      else out.push([id, { ...eb, o: eb.o * t }]);
    }
    for (const [id, ea] of a) if (!b.has(id)) out.push([id, { ...ea, o: ea.o * (1 - t) }]);
  }
  return out.filter(([, e]) => e.o > 0.003).sort((p, q) => p[1].z - q[1].z);
}

// ---- Playback controller -----------------------------------------------
interface Anim {
  target: number;
  first: number;
  last: number;
  elapsed: number;
  total: number;
}

const GAP = 900; // ms of rest between steps when playing

function makeController(render: () => void) {
  const s = {
    shown: 0,
    anim: null as Anim | null,
    playing: false,
    frozen: false,
    speed: 1,
    reduce: false,
    raf: 0,
    lastTs: 0,
    gap: 0 as ReturnType<typeof setTimeout> | 0,
  };

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
    if (s.shown >= LAST) {
      s.playing = false;
      return;
    }
    s.gap = setTimeout(() => {
      s.gap = 0;
      if (s.playing && !s.anim) start(s.shown + 1);
    }, (s.reduce ? 1600 : GAP) / s.speed);
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
    s.anim.elapsed += dt * s.speed;
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
    if (target > LAST || target < 1) return;
    if (s.reduce) {
      s.shown = target;
      s.anim = null;
      render();
      scheduleNext();
      return;
    }
    const first = endOf(target - 1) + 1;
    const last = endOf(target);
    let total = 0;
    for (let i = first; i <= last; i++) total += DATA.frames[i].dur + DATA.frames[i].hold;
    s.anim = { target, first, last, elapsed: 0, total };
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
    s.shown = Math.max(0, Math.min(LAST, n));
    render();
  };

  return {
    state: s,
    view(): { a: number; b: number; t: number } {
      if (!s.anim) {
        const e = endOf(s.shown);
        return { a: e, b: e, t: 1 };
      }
      let acc = 0;
      const el = s.anim.elapsed;
      for (let i = s.anim.first; i <= s.anim.last; i++) {
        const f = DATA.frames[i];
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
      } else if (s.shown < LAST) {
        clearGap();
        start(s.shown + 1);
      }
    },
    back() {
      const to = s.anim ? s.anim.target - 1 : s.shown - 1;
      jump(to);
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
      } else if (s.shown >= LAST) {
        s.shown = 0;
        start(1);
      } else {
        start(s.shown + 1);
      }
      render();
    },
    jump,
    setSpeed(v: number) {
      s.speed = v;
      render();
    },
    setReduce(v: boolean) {
      s.reduce = v;
    },
    dispose() {
      stopRaf();
      clearGap();
    },
  };
}

// ---- Drawing ------------------------------------------------------------
const U = 100; // SVG units per centimetre
const X = (x: number) => Math.round(x * U * 100) / 100;
const Y = (y: number) => Math.round(-y * U * 100) / 100;
const PT = 0.03515; // cm per point
const SW = (pt: number) => pt * PT * U * 1.15; // a touch heavier than print
const col = (c: RGB) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const TITLE_FONT = "Montserrat, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function drawPerson(e: Ent): ReactElement {
  const { x, y, s } = e;
  const P = (px: number, py: number) => `${X(x + px * s)},${Y(y + py * s)}`;
  const d =
    `M${P(-0.11, 0)}L${P(0, 0.2)}L${P(0.11, 0)}` +
    `M${P(0, 0.2)}L${P(0, 0.4)}` +
    `M${P(-0.15, 0.2)}L${P(0, 0.355)}L${P(0.15, 0.2)}`;
  return (
    <g stroke={col(e.c)} strokeWidth={SW(0.7)} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
      <circle cx={X(x)} cy={Y(y + 0.485 * s)} r={0.085 * s * U} />
    </g>
  );
}

function drawArrow(e: Ent): ReactElement | null {
  const dx = e.x2 - e.x;
  const dy = e.y2 - e.y;
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return null;
  const ux = dx / L;
  const uy = dy / L;
  const sx = e.x + ux * e.shorten;
  const sy = e.y + uy * e.shorten;
  const len = Math.max(0, L - 2 * e.shorten) * e.p;
  if (len < 0.005) return null;
  const tx = sx + ux * len;
  const ty = sy + uy * len;
  const stroke = col(e.c);
  const hl = Math.min(e.head * PT * 1.15, len);
  const hw = hl * 0.8;
  const nx = -uy;
  const ny = ux;
  const lineEnd = e.head ? 0.6 * hl : 0;
  return (
    <g>
      <line
        x1={X(sx)} y1={Y(sy)} x2={X(tx - ux * lineEnd)} y2={Y(ty - uy * lineEnd)}
        stroke={stroke} strokeWidth={SW(e.w)} strokeDasharray={e.dash ? "10.5 10.5" : undefined}
      />
      {e.head > 0 && (
        <path
          fill={stroke}
          d={
            `M${X(tx)},${Y(ty)}` +
            `L${X(tx - ux * hl + (nx * hw) / 2)},${Y(ty - uy * hl + (ny * hw) / 2)}` +
            `L${X(tx - ux * hl * 0.7)},${Y(ty - uy * hl * 0.7)}` +
            `L${X(tx - ux * hl - (nx * hw) / 2)},${Y(ty - uy * hl - (ny * hw) / 2)}Z`
          }
        />
      )}
    </g>
  );
}

function drawEll(e: Ent): ReactElement {
  return (
    <g fill={col(e.c)}>
      {[-0.13, 0, 0.13].map((d) => (
        <circle key={d} cx={X(e.x + d)} cy={Y(e.y)} r={2.4} />
      ))}
    </g>
  );
}

function drawBus(e: Ent): ReactElement {
  const f = e.f;
  const dx = e.x;
  const right = Math.max(5.75 + dx, 5.75); // the rails never stop short of where the deck ends them
  const stroke = col(e.c);
  const dividers: number[] = [];
  for (let k = 1; k <= 11; k++) dividers.push(seatX(k) - 0.43);
  dividers.push(seatX(11) + 0.43);
  return (
    <g stroke={stroke} fill="none">
      <line x1={X(-5.4 + dx)} y1={Y(f)} x2={X(right)} y2={Y(f)} strokeWidth={SW(0.7)} />
      <line x1={X(-4.85 + dx)} y1={Y(f + 0.8)} x2={X(right)} y2={Y(f + 0.8)} strokeWidth={SW(0.7)} />
      <polyline
        points={`${X(-5.4 + dx)},${Y(f)} ${X(-5.4 + dx)},${Y(f + 0.26)} ${X(-4.85 + dx)},${Y(f + 0.8)}`}
        strokeWidth={SW(0.7)} strokeLinejoin="round"
      />
      {dividers.map((d) => (
        <line key={d} x1={X(d + dx)} y1={Y(f)} x2={X(d + dx)} y2={Y(f + 0.8)} strokeWidth={SW(0.5)} />
      ))}
      {[-4.55, -1.75, 1.05, 3.85].map((w) => (
        <circle key={w} cx={X(w + dx)} cy={Y(f - 0.18)} r={0.18 * U} strokeWidth={SW(0.8)} />
      ))}
      {drawPerson(person(-4.72 + dx, f + 0.06, GOLD, 1.05))}
    </g>
  );
}

function drawBalloon(e: Ent): ReactElement {
  const h = 0.75;
  const dots = e.inside
    ? [1, 2, 3].map((i) => [-5.06 + 0.06 * i, -0.8 + 0.19 * i, [0.05, 0.07, 0.09][i - 1]])
    : [1, 2, 3].map((i) => [-5.2 + 0.2 * i, 2.32 + 0.09 * i, [0.055, 0.075, 0.095][i - 1]]);
  return (
    <g>
      {dots.map(([cx, cy, r]) => (
        <circle key={cx} cx={X(cx)} cy={Y(cy)} r={r * U} fill="none" stroke={col(GRAY)} strokeWidth={SW(0.5)} />
      ))}
      <rect
        x={X(e.x)} y={Y(e.y + h / 2)} width={e.bw * U} height={h * U} rx={21} ry={21}
        fill={LIGHTBG} stroke={col(GRAY)} strokeWidth={SW(0.5)}
      />
      <text
        x={X(e.x + e.bw / 2)} y={Y(e.y)} fill={col(GOLD)} fontSize={34} fontFamily={FONT}
        textAnchor="middle" dominantBaseline="central"
      >
        {e.str}
      </text>
    </g>
  );
}

function drawEnt(e: Ent): ReactElement | null {
  switch (e.k) {
    case "person":
      return drawPerson(e);
    case "arrow":
      return drawArrow(e);
    case "ell":
      return drawEll(e);
    case "bus":
      return drawBus(e);
    case "balloon":
      return drawBalloon(e);
    case "ring":
      return <circle cx={X(e.x)} cy={Y(e.y)} r={e.s * U} fill="none" stroke={col(e.c)} strokeWidth={SW(e.w)} />;
    case "disc":
      return <circle cx={X(e.x)} cy={Y(e.y)} r={e.s * U} fill={col(e.c)} />;
    case "rect":
      return (
        <rect
          x={X(e.x)} y={Y(e.y2)} width={(e.x2 - e.x) * U} height={(e.y2 - e.y) * U}
          fill="none" stroke={col(e.c)} strokeWidth={SW(e.w)}
        />
      );
    case "text":
      return (
        <text
          x={X(e.x)} y={Y(e.y)} fill={col(e.c)} fontSize={e.size * U} fontWeight={700} fontFamily={FONT}
          textAnchor="middle" dominantBaseline="central"
        >
          {e.str}
        </text>
      );
  }
}

// The hotel never moves, so it is drawn once and outside the keyframes.
function Hotel(): ReactElement {
  const stroke = col(GRAY);
  return (
    <g>
      <rect x={X(-5.4)} y={Y(-1.2)} width={10.8 * U} height={0.85 * U} fill="none" stroke={stroke} strokeWidth={SW(0.6)} />
      {Array.from({ length: 14 }, (_, i) => i + 1).map((w) => (
        <line
          key={w} x1={X(0.72 * (w - 7.5))} y1={Y(-2.05)} x2={X(0.72 * (w - 7.5))} y2={Y(-1.2)}
          stroke={stroke} strokeWidth={SW(0.5)}
        />
      ))}
      {Array.from({ length: 15 }, (_, i) => i + 1).map((n) => (
        <text
          key={n} x={X(roomX(n))} y={Y(-0.98)} fill={col(NAVDIM)} fontSize={28} fontFamily={FONT}
          textAnchor="middle" dominantBaseline="central"
        >
          {n}
        </text>
      ))}
    </g>
  );
}

// ---- The component ------------------------------------------------------
const SPEEDS = [
  { label: "0.5×", v: 0.5 },
  { label: "1×", v: 1 },
  { label: "1.5×", v: 1.5 },
  { label: "2×", v: 2 },
];

function btn(enabled: boolean, active = false): CSSProperties {
  return {
    padding: "4px 12px",
    fontSize: 13,
    border: `1px solid ${active ? "var(--accent)" : "var(--rule)"}`,
    borderRadius: 4,
    background: enabled ? "var(--surface)" : "transparent",
    color: active ? "var(--accent)" : enabled ? "var(--ink)" : "var(--muted)",
    cursor: enabled ? "pointer" : "default",
    fontFamily: "ui-sans-serif, system-ui",
    fontWeight: active ? 600 : 400,
    opacity: enabled ? 1 : 0.55,
  };
}

// Stage: the slide is 12.8 cm wide. The banner strip sits on top, and the
// picture below it runs from y = 4.20 down to y = -3.55, as \stagebb does.
const VB_TOP = -525;
const VB_H = 895;
const STAGE_TOP = -435;

export default function HilbertHotelAnimation(): ReactElement {
  const [, setTick] = useState(0);
  const ctl = useMemo(() => makeController(() => setTick((t) => t + 1)), []);
  const clipId = `hh-clip-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    ctl.setReduce(mq.matches);
    const onChange = () => ctl.setReduce(mq.matches);
    mq.addEventListener("change", onChange);
    const raw = new URLSearchParams(window.location.search).get("hotelStep");
    const n = raw === null ? NaN : parseInt(raw, 10);
    if (Number.isFinite(n)) ctl.jump(n - 1);
    return () => {
      mq.removeEventListener("change", onChange);
      ctl.dispose();
    };
  }, [ctl]);

  const v = ctl.view();
  const A = DATA.frames[v.a];
  const B = DATA.frames[v.b];
  const t = ease(Math.max(0, Math.min(1, v.t)));
  const ents = mix(A.ents, B.ents, t);
  const banner = v.a === v.b || v.t > 0 ? B.banner : A.banner;
  const cur = ctl.current();
  const scene = DATA.steps[cur].scene;
  const s = ctl.state;

  const onKeyDown = (ev: KeyboardEvent<HTMLDivElement>) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const tag = (ev.target as HTMLElement).tagName;
    if (ev.key === "ArrowRight") {
      ev.preventDefault();
      ctl.forward();
    } else if (ev.key === "ArrowLeft") {
      ev.preventDefault();
      ctl.back();
    } else if (ev.key === " " && tag !== "BUTTON") {
      ev.preventDefault();
      ctl.toggle();
    }
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Hilbert's hotel animation. Right and Left arrows step, Space plays or pauses."
      style={{ margin: "1.5rem 0", borderRadius: 8 }}
      className="hilbert-hotel-animation"
    >
      <svg
        viewBox={`-640 ${VB_TOP} 1280 ${VB_H}`}
        style={{ width: "100%", height: "auto", display: "block", background: BG, borderRadius: 8 }}
        role="img"
        aria-label={`${banner}. Step ${cur + 1} of ${LAST + 1}.`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={-640} y={STAGE_TOP} width={1280} height={VB_TOP + VB_H - STAGE_TOP} />
          </clipPath>
        </defs>
        <rect x={-640} y={VB_TOP} width={1280} height={STAGE_TOP - VB_TOP} fill={DARKERBG} />
        <text
          x={-600} y={(VB_TOP + STAGE_TOP) / 2} fill={col(HEADING)} fontSize={44} fontWeight={700}
          fontFamily={TITLE_FONT} dominantBaseline="central"
        >
          {banner}
        </text>
        <g clipPath={`url(#${clipId})`}>
          <Hotel />
          {ents.map(([id, e]) => (
            <g key={id} opacity={e.o < 0.999 ? e.o : undefined}>
              {drawEnt(e)}
            </g>
          ))}
        </g>
      </svg>

      <div
        style={{
          display: "flex", gap: 8, justifyContent: "center", alignItems: "center",
          marginTop: 12, flexWrap: "wrap",
        }}
      >
        <button onClick={() => ctl.jump(0)} style={btn(cur > 0)} disabled={cur === 0} aria-label="Restart">
          Restart
        </button>
        <button onClick={() => ctl.back()} style={btn(cur > 0)} disabled={cur === 0} aria-label="Step back">
          Back
        </button>
        <button onClick={() => ctl.toggle()} style={{ ...btn(true), minWidth: 72 }}>
          {s.playing ? "Pause" : cur >= LAST && !s.anim ? "Play again" : "Play"}
        </button>
        <button
          onClick={() => ctl.forward()}
          style={btn(cur < LAST || !!s.anim)}
          disabled={cur >= LAST && !s.anim}
          aria-label="Step forward"
        >
          Next
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)", minWidth: 84, textAlign: "center" }}>
          Step {cur + 1} of {LAST + 1}
        </span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--muted)", marginRight: 2 }}>Speed</span>
          {SPEEDS.map((sp) => (
            <button
              key={sp.label}
              onClick={() => ctl.setSpeed(sp.v)}
              style={{ ...btn(true, s.speed === sp.v), padding: "4px 8px", fontSize: 12 }}
              aria-pressed={s.speed === sp.v}
            >
              {sp.label}
            </button>
          ))}
        </span>
      </div>

      <div
        style={{
          display: "flex", gap: 6, justifyContent: "center", alignItems: "center",
          marginTop: 8, flexWrap: "wrap",
        }}
        role="group"
        aria-label="Scenes"
      >
        {SCENES.map((name, i) => (
          <button
            key={name}
            onClick={() => ctl.jump(FIRST_OF_SCENE[i])}
            style={{ ...btn(true, i === scene), fontSize: 12 }}
            aria-current={i === scene ? "step" : undefined}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}
