import { useState, type CSSProperties, type ReactElement } from "react";
import { builder, mk, type Builder, type Ent, type Scene } from "./engine";
import {
  arrow, BusWindow, disc, dots, firstRooms, hbusSeatX, headY, hotelGeom, lit, makeWin, person, ring,
  roomFeet, say, StripView, STRIP_H, tag, text, vbusSeatY, type Win,
} from "./draw";
import Explainer, { btnStyle, type Answer } from "./Explainer";
import { before, fmt, letter, ordinal, threadAt, threadPos } from "./math";

// =====================================================================
//  Explainer 4: a fleet of buses.
//
//  Book: point "A fleet of buses" and its figure "Emptying the fleet into
//  one coach". Passenger (i, j) is seat j of bus i. The fleet is parked as
//  a grid seen from above, ONE COLUMN PER BUS AND ONE ROW PER SEAT, seat 1
//  at the bottom, exactly as the book draws it (the class slides stack the
//  buses as rows; the book is the authority here). The diagonal thread
//  visits (1,1), (2,1), (1,2), (3,1), (2,2), (1,3), ... and the passenger
//  at position n of the thread takes seat n of one empty coach. The coach
//  shows the pairs under its seats, as in the book's figure. Then the two
//  one o'clock announcements finish the night.
// =====================================================================

const ANNOUNCE_COACH = "The passenger at position n of the thread takes seat n.";
const ANNOUNCE_1 = "Would the guest in room n please move to room 2n.";
const ANNOUNCE_2 = "Would the passenger in seat k please take room 2k − 1.";
const ROWS = 5;
const RP = 30; // row pitch of the car park
const DISC = 8.5;

interface Geo {
  W: number;
  narrow: boolean;
  band: number;
  cols: number;
  cp: number;
  colX: (i: number) => number;
  tip: number; //    noses of the parked buses
  rowY: (j: number) => number;
  busW: number;
  roof: number; //   the coach
  floor: number;
  cx0: number; //    coach nose
  csp: number; //    coach seat pitch
  cseats: number; // coach seats drawn
  cvis: number; //   coach seats fully on screen
  top: number; //    hotel strip
  feet: number;
  H: number;
}
function geo(W: number): Geo {
  const narrow = W < 480;
  const band = narrow ? 68 : 50;
  const cols = narrow ? 5 : 7;
  const left = 50;
  const cp = Math.min(76, (W - left - 22) / cols);
  const colX = (i: number) => left + (i - 0.5) * cp;
  const tip = band + 22 + ROWS * RP + 16;
  const rowY = (j: number) => vbusSeatY(tip, RP, j);
  const roof = tip + 30;
  const floor = roof + 44;
  const cx0 = 18;
  const csp = narrow ? 42 : 50;
  const cseats = Math.ceil((W - cx0 - 30) / csp) + 2;
  const cvis = Math.floor((W - cx0 - 30 - 20) / csp);
  const top = floor + 52;
  return {
    W, narrow, band, cols, cp, colX, tip, rowY, busW: Math.min(32, cp * 0.55), roof, floor, cx0, csp, cseats, cvis,
    top, feet: roomFeet(top), H: top + STRIP_H + 44,
  };
}

const seatX = (G: Geo, n: number) => hbusSeatX(G.cx0, G.csp, n);
const seatFeet = (G: Geo) => G.floor - 3;
const inGrid = (G: Geo, i: number, j: number) => i >= 1 && j >= 1 && i <= G.cols && j <= ROWS;
const pairStr = (i: number, j: number) => `(${fmt(i)}, ${fmt(j)})`;

// A step of the thread, pulled back at both ends so it runs between the discs.
function edge(ax: number, ay: number, bx: number, by: number, dashed = false): Ent {
  const L = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / L;
  const uy = (by - ay) / L;
  const sh = DISC + 2.5;
  return { ...arrow(ax + ux * sh, ay + uy * sh, bx - ux * sh, by - uy * sh, "accent", 0, 1.3), z: 5, dash: dashed ? 1 : 0 };
}

function parkFleet(b: Builder, G: Geo, dy: number, o = 1) {
  for (let i = 1; i <= G.cols + 1; i++) {
    b.set(`bus${i}`, mk({ k: "vbus", z: 1, c: "wall", x: G.colX(i), y: G.tip + dy, s: G.busW, n: ROWS + 3, pitch: RP, o }));
    for (let j = 1; j <= ROWS + 2; j++) {
      b.set(`d${i}_${j}`, { ...disc(G.colX(i), G.rowY(j) + dy, DISC, "new"), fo: 0.22, o });
    }
  }
}

function story(W: number): Scene {
  const G = geo(W);
  const g = hotelGeom(W);
  const N = g.count + 2;
  const b = builder();
  b.setVar("hotelO", 1);
  for (let n = 1; n <= N; n++) b.set(`g${n}`, person(g.roomX(n), G.feet, "guest", letter(n)));
  // the car park outside, its bays marked out and empty
  for (let i = 0; i <= G.cols + 1; i++) {
    const x = G.colX(i) + G.cp / 2;
    b.set(`bay${i}`, mk({ k: "line", z: 0, c: "faint", x, y: G.band + 30, x2: x, y2: G.tip + 2, w: 1.2, dash: 1 }));
  }
  b.set("park", text(G.colX(1) - G.cp / 2 + 6, G.band + 22, "the car park", "num", 11, { anchor: "start", italic: 1 }));
  b.commit(0);
  b.endStep("The hotel is full, one guest to a room. At two in the morning it gets worse.");

  // ---- the fleet arrives -----------------------------------------------------
  parkFleet(b, G, -320);
  b.del("park");
  b.commit(0);
  parkFleet(b, G, 0);
  for (let i = 1; i <= G.cols; i++) b.set(`bl${i}`, text(G.colX(i), G.tip + 11, `bus ${i}`, "num", 10.5));
  b.commit(1700);
  b.endStep("A whole fleet arrives, bus 1, bus 2, bus 3, one for every counting number. Here they are parked, seen from above.");

  for (let j = 1; j <= ROWS; j++) b.set(`sl${j}`, text(6, G.rowY(j), `seat ${j}`, "num", 10.5, { anchor: "start" }));
  b.commit(700);
  b.endStep("Each bus has a seat for every counting number, seat 1 at the front, and on every bus every seat is taken.");

  b.setVar("hotelO", 0.3);
  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { o: 0.3 });
  b.commit(800);
  b.endStep("Running the one o'clock plan bus after bus fails for the same reason as before. The move that works is to stop looking at the hotel.");

  // ---- the grid -----------------------------------------------------------
  b.chapter(1);
  const ex = [3, 2] as const;
  b.set("colband", mk({ k: "rect", z: 0, c: "faint", f: "faint", fo: 0.5, w: 0, x: G.colX(ex[0]) - G.cp * 0.45, x2: G.colX(ex[0]) + G.cp * 0.45, y: G.band + 18, y2: G.tip + 18 }));
  b.set("rowband", mk({ k: "rect", z: 0, c: "faint", f: "faint", fo: 0.5, w: 0, x: 4, x2: W - 4, y: G.rowY(ex[1]) - RP * 0.45, y2: G.rowY(ex[1]) + RP * 0.45 }));
  b.set("exring", ring(G.colX(ex[0]), G.rowY(ex[1]), DISC + 4, "accent", 2));
  b.set("extag", tag(G.colX(ex[0]) + DISC + 8, G.rowY(ex[1]) - 1, "(3, 2)", "accent", 12, { anchor: "start", z: 9 }));
  b.commit(800);
  b.endStep("Write (_i_, _j_) for the passenger in seat _j_ of bus _i_. This one is (3, 2), in seat 2 of bus 3.");

  b.delWhere((id) => id === "colband" || id === "rowband" || id === "exring" || id === "extag");
  for (let i = 1; i <= G.cols + 1; i++) b.upd(`bus${i}`, { c: "faint" });
  b.commit(800);
  b.endStep("So the passengers of the fleet form a grid, one column for each bus and one row for each seat. It is the grid of pairs from the upgraded frog.");

  // ---- the thread -----------------------------------------------------------
  // tn[n] is where the n-th passenger on the thread is drawn right now.
  const LAST = 11;
  const tn: Array<[number, number]> = [[0, 0]];
  for (let n = 1; n <= LAST; n++) {
    const [i, j] = threadAt(n);
    tn[n] = [G.colX(i), G.rowY(j)];
  }
  const mark = (n: number) => {
    const [i, j] = threadAt(n);
    b.upd(`d${i}_${j}`, { c: "accent", f: "accent", fo: 1, str: String(n), z: 6 });
  };
  const grow = (from: number, to: number) => {
    for (let n = from; n <= to; n++) {
      if (n > 1) {
        b.set(`te${n - 1}`, edge(tn[n - 1][0], tn[n - 1][1], tn[n][0], tn[n][1]));
        b.commit(380);
      }
      mark(n);
      b.commit(220, 80);
    }
  };
  grow(1, 3);
  b.endStep("We list them by going along the diagonals of the grid, as we did for the frog: (1, 1), then (2, 1), then (1, 2).");
  grow(4, 6);
  b.endStep("Each diagonal holds only a few passengers, so the thread finishes it and moves on to the next.");
  grow(7, LAST);
  const [ti, tj] = threadAt(LAST + 1);
  b.set("tail", edge(tn[LAST][0], tn[LAST][1], G.colX(ti), G.rowY(tj), true));
  b.commit(380);
  b.endStep("The thread visits every pair exactly once, and every pair is somewhere on it.");

  // ---- one coach ------------------------------------------------------------
  b.chapter(2);
  const coach = (dx: number) =>
    mk({ k: "hbus", z: 1, c: "wall", f: "surface", x: G.cx0 + dx, y: G.roof, y2: G.floor, n: G.cseats, pitch: G.csp, size: 9 });
  b.set("coach", coach(W));
  b.commit(0);
  b.upd("coach", { x: G.cx0 });
  b.set("say", say(ANNOUNCE_COACH, W, G.band));
  b.commit(1500);
  b.endStep("The manager sends an empty coach round to the fleet with one instruction.");

  const cheadY = headY(seatFeet(G), 0.9);
  const refresh = () => {
    for (let n = 1; n < LAST; n++) {
      const e = edge(tn[n][0], tn[n][1], tn[n + 1][0], tn[n + 1][1]);
      b.upd(`te${n}`, { x: e.x, y: e.y, x2: e.x2, y2: e.y2 });
    }
    const e = edge(tn[LAST][0], tn[LAST][1], G.colX(ti), G.rowY(tj), true);
    b.upd("tail", { x: e.x, y: e.y });
  };
  const board = (n: number, dur: number) => {
    const [i, j] = threadAt(n);
    // the passenger appears, unseen, where their disc is, then walks to the seat
    b.set(`c${n}`, { ...person(G.colX(i), G.rowY(j) + 23 * 0.9, "new", String(n), 0.9), o: 0 });
    b.commit(0);
    const vis = n <= G.cvis + 1;
    b.upd(`c${n}`, { x: seatX(G, n), y: seatFeet(G), o: vis ? 1 : 0 });
    b.upd(`d${i}_${j}`, { x: seatX(G, n), y: cheadY, o: 0 });
    tn[n] = [seatX(G, n), cheadY];
    refresh();
    b.set(`pl${n}`, text(seatX(G, n), G.floor + 23, pairStr(i, j), "ink", G.narrow ? 9.5 : 10.5));
    b.commit(dur, 120);
  };
  board(1, 1100);
  b.endStep("Seat 1 holds the passenger (1, 1).");
  board(2, 1000);
  b.endStep("Seat 2 holds (2, 1), the second passenger the thread reaches.");
  for (let n = 3; n <= LAST; n++) board(n, 520);
  // and everybody else in the picture, further along the thread, to seats further along the coach
  b.delWhere((id) => /^te\d+$/.test(id) || id === "tail");
  for (let i = 1; i <= G.cols + 1; i++) {
    for (let j = 1; j <= ROWS + 2; j++) {
      const n = threadPos(i, j);
      if (n > LAST) b.upd(`d${i}_${j}`, { x: seatX(G, n), y: cheadY, o: 0 });
    }
  }
  b.set("cdots", dots(Math.min(W - 16, seatX(G, G.cvis) + G.csp * 0.9), G.floor + 23));
  b.commit(1300);
  b.endStep("Every passenger gets a seat, because every pair is somewhere on the thread. No seat gets two, because no pair is on the thread twice.");

  // ---- the one o'clock problem, word for word -------------------------------
  b.chapter(3);
  b.del("say");
  for (let i = 1; i <= G.cols + 1; i++) b.upd(`bus${i}`, { y: G.tip - 330, o: 0 });
  b.delWhere((id) => /^(bl|sl|bay)\d+$/.test(id) || id === "park" || /^d\d+_\d+$/.test(id));
  b.setVar("hotelO", 1);
  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { o: 1 });
  b.commit(1400);
  b.endStep("The fleet drives away empty. One full coach stands outside one full hotel: the one o'clock problem, word for word.");

  b.set("say", say(ANNOUNCE_1, W, G.band));
  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { x: g.roomX(2 * n), bend: 44 });
  b.commit(1600);
  for (let r = 1; r <= N; r += 2) {
    b.set(`lit${r}`, lit(g.roomX(r) - g.pitch / 2 + 1.5, G.top + 1.5, g.roomX(r) + g.pitch / 2 - 1.5, G.top + STRIP_H - 1.5));
  }
  b.commit(500);
  b.endStep("So she makes the first announcement of one o'clock, and every odd-numbered room empties.");

  b.upd("say", { str: ANNOUNCE_2 });
  for (let n = 1; n <= LAST; n++) b.upd(`c${n}`, { x: g.roomX(2 * n - 1), y: G.feet, s: 1, o: 2 * n - 1 <= N + 1 ? 1 : 0 });
  b.commit(1600);
  b.delWhere((id) => /^lit\d+$/.test(id));
  b.commit(300);
  b.endStep("Then the second, and by half past two everybody in the fleet is asleep in a room of their own.");
  return b.scene(["The fleet", "The thread", "One coach", "One o'clock again"]);
}

// ---- Answers ------------------------------------------------------------------
type Q = { mode: "pair"; i: number; j: number } | { mode: "seat"; n: number };

const pairOf = (q: Q): [number, number] => (q.mode === "pair" ? [q.i, q.j] : threadAt(q.n));

function wins(G: Geo, q: Q): { coach: Win; hotel: Win } {
  const [i, j] = pairOf(q);
  const n = threadPos(i, j);
  const r = 2 * n - 1;
  const g = hotelGeom(G.W);
  const coachNums = G.narrow ? [1, n, n + 1] : [1, 2, n - 1, n, n + 1];
  const hotelNums = G.narrow ? [1, r, r + 1] : [1, 2, r - 1, r, r + 1];
  return {
    coach: makeWin(coachNums, G.cx0 + 30, Math.max(G.csp, 44), 26),
    hotel: makeWin(hotelNums, g.x0, Math.max(g.pitch, 40), 26),
  };
}

function answer(W: number, q: Q): Answer {
  const G = geo(W);
  const [i, j] = pairOf(q);
  const n = threadPos(i, j);
  const r = 2 * n - 1;
  const { coach, hotel } = wins(G, q);
  const b = builder();
  const d = i + j - 2; // diagonals before this one
  const inside = inGrid(G, i, j);

  // the grid, faint, and the passenger asked about
  for (let a = 1; a <= G.cols; a++) {
    for (let c = 1; c <= ROWS; c++) b.set(`d${a}_${c}`, { ...disc(G.colX(a), G.rowY(c), DISC, "new"), fo: 0.15, o: 0.8 });
  }
  for (let a = 1; a <= G.cols; a++) b.set(`bl${a}`, text(G.colX(a), G.tip + 11, `bus ${a}`, "num", 10.5));
  for (let c = 1; c <= ROWS; c++) b.set(`sl${c}`, text(6, G.rowY(c), `seat ${c}`, "num", 10.5, { anchor: "start" }));
  const far: [number, number] = [W - 30, G.band + 26];
  const [px, py] = inside ? [G.colX(i), G.rowY(j)] : far;
  b.set("me", { ...disc(px, py, DISC + 1, "accent"), fo: 1, z: 8 });
  b.set("meTag", tag(inside ? px + DISC + 8 : px - DISC - 8, py, pairStr(i, j), "accent", 12, { anchor: inside ? "start" : "end", z: 9 }));
  b.commit(0);
  b.endStep(
    q.mode === "seat"
      ? `Seat ${fmt(q.n)} of the coach goes to the ${ordinal(q.n)} passenger on the thread, and that is ${pairStr(i, j)}: seat ${fmt(j)} of bus ${fmt(i)}.`
      : inside
        ? `Seat ${fmt(j)} of bus ${fmt(i)} is the spot in column ${fmt(i)} and row ${fmt(j)}.`
        : `Seat ${fmt(j)} of bus ${fmt(i)} is far out in the grid, in column ${fmt(i)} and row ${fmt(j)}.`,
  );

  // number every spot the thread reaches first
  for (let a = 1; a <= G.cols; a++) {
    for (let c = 1; c <= ROWS; c++) {
      const m = threadPos(a, c);
      if (m < n) b.upd(`d${a}_${c}`, { c: "accent", f: "accent", fo: 0.55, o: 1, str: String(m) });
    }
  }
  b.upd("me", { str: n < 1000 ? String(n) : "" });
  b.commit(1200);
  const sum =
    d === 0
      ? "No diagonal comes before this one"
      : d <= 5
        ? `The diagonals before this one hold ${Array.from({ length: d }, (_, k) => k + 1).join(" + ")} = ${fmt(before(i, j))} passengers`
        : `The ${fmt(d)} diagonals before this one hold 1 + 2 + ⋯ + ${fmt(d)} = ${fmt(before(i, j))} passengers`;
  b.endStep(
    `${sum}. On its own diagonal the thread starts at seat 1 and climbs, reaching seat ${fmt(j)} at its ${ordinal(j)} stop. So ${pairStr(i, j)} is number ${fmt(before(i, j))} + ${fmt(j)} = ${fmt(n)} on the thread.`,
  );

  b.set("you", { ...person(px, py + 22, "accent", "", 0.9), o: 0 });
  b.commit(0);
  b.set("say", say(ANNOUNCE_COACH, W, G.band));
  b.upd("you", { x: coach.pos(n), y: seatFeet(G), o: 1, str: n < 1000 ? String(n) : "" });
  b.upd("me", { x: coach.pos(n), y: headY(seatFeet(G), 0.9), o: 0 });
  b.upd("meTag", { x: coach.pos(n), y: G.floor + 23, anchor: "middle", size: 10.5 });
  b.commit(1400);
  b.endStep(`So ${pairStr(i, j)} takes seat ${fmt(n)} of the coach. It is the ${ordinal(n)} passenger to board.`);

  b.upd("say", { str: ANNOUNCE_2 });
  b.set("hl", lit(hotel.pos(r) - hotel.pitch / 2 + 1.5, G.top + 1.5, hotel.pos(r) + hotel.pitch / 2 - 1.5, G.top + STRIP_H - 1.5));
  b.set("arr", arrow(coach.pos(n), G.floor + 34, hotel.pos(r), G.top - 16, "accent", 0, 1.6));
  b.commit(700);
  b.upd("you", { x: hotel.pos(r), y: G.feet, s: 1 });
  // everybody else in these rooms at half past two: guests in the even rooms, the coach in the odd
  for (const run of hotel.runs) {
    for (let x = run.start; x < run.start + run.count; x++) {
      if (x === r) continue;
      const lab = x % 2 === 0 ? letter(x / 2) : (x + 1) / 2 < 1000 ? String((x + 1) / 2) : "";
      b.set(`h${x}`, { ...person(hotel.pos(x), G.feet, x % 2 === 0 ? "guest" : "new", lab), o: 0.55 });
    }
  }
  b.commit(1300);
  b.endStep(`At half past two, seat ${fmt(n)} of the coach takes room 2 × ${fmt(n)} − 1 = ${fmt(r)}.`);

  const card = (
    <>
      The whole journey in one line: room (<i>i</i> + <i>j</i> − 2)(<i>i</i> + <i>j</i> − 1) + 2<i>j</i> − 1 ={" "}
      ({fmt(i + j - 2)})({fmt(i + j - 1)}) + {fmt(2 * j - 1)} = <b>{fmt(r)}</b>.
    </>
  );
  return { ...b.scene(), card };
}

// ---- The question box -------------------------------------------------------------
function FleetAsk(props: { ask: (q: Q) => void }): ReactElement {
  const [bus, setBus] = useState("3");
  const [seat, setSeat] = useState("2");
  const [cs, setCs] = useState("20");
  const MAX = 100_000;
  const parse = (s: string) => Number(s.replace(/[,\s]/g, ""));
  const ok = (v: number, max: number) => Number.isInteger(v) && v >= 1 && v <= max;
  const bi = parse(bus);
  const sj = parse(seat);
  const cn = parse(cs);
  const box = (val: string, set: (s: string) => void, label: string, good: boolean) => (
    <input
      type="text" inputMode="numeric" value={val} onChange={(e) => set(e.target.value)} aria-label={label}
      aria-invalid={!good}
      style={{
        width: 76, padding: "5px 8px", fontSize: 14, border: `1px solid ${good ? "var(--rule)" : "var(--accent)"}`,
        borderRadius: 6, background: "var(--bg)", color: "var(--ink)", minHeight: 32, fontVariantNumeric: "tabular-nums",
      }}
    />
  );
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <form
        style={row}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok(bi, MAX) && ok(sj, MAX)) props.ask({ mode: "pair", i: bi, j: sj });
        }}
      >
        <span>Follow the passenger in bus</span>
        {box(bus, setBus, "Bus number", ok(bi, MAX))}
        <span>seat</span>
        {box(seat, setSeat, "Seat number", ok(sj, MAX))}
        <button type="submit" style={btnStyle(ok(bi, MAX) && ok(sj, MAX), true)} disabled={!(ok(bi, MAX) && ok(sj, MAX))}>
          Show me
        </button>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>or tap a passenger in the picture</span>
      </form>
      <form
        style={row}
        onSubmit={(e) => {
          e.preventDefault();
          if (ok(cn, 1_000_000)) props.ask({ mode: "seat", n: cn });
        }}
      >
        <span>Who boards the coach at seat</span>
        {box(cs, setCs, "Coach seat number", ok(cn, 1_000_000))}
        <button type="submit" style={btnStyle(ok(cn, 1_000_000), true)} disabled={!ok(cn, 1_000_000)}>
          Show me
        </button>
      </form>
      {(!ok(bi, MAX) || !ok(sj, MAX)) && (
        <span style={{ fontSize: 12, color: "var(--accent)" }}>Bus and seat are counting numbers up to 100,000.</span>
      )}
    </div>
  );
}

export default function HotelFleet(): ReactElement {
  return (
    <Explainer<Q>
      id="explainer-fleet"
      title="A fleet of buses"
      label="Animation: emptying a fleet of buses into one coach"
      height={(W) => geo(W).H}
      story={story}
      answer={answer}
      backdrop={({ W, q, pal, vars }) => {
        const G = geo(W);
        const g = hotelGeom(W);
        if (!q) {
          return (
            <g opacity={vars.hotelO ?? 1}>
              <StripView win={firstRooms(g.count + 3, g.x0, g.pitch)} top={G.top} h={STRIP_H} pal={pal} numbers="above" />
            </g>
          );
        }
        const w = wins(G, q);
        return (
          <g>
            <BusWindow win={w.coach} top={G.roof} h={G.floor - G.roof} pal={pal} />
            <StripView win={w.hotel} top={G.top} h={STRIP_H} pal={pal} numbers="above" />
          </g>
        );
      }}
      overlay={({ W, ask }) => {
        const G = geo(W);
        const spots: ReactElement[] = [];
        for (let i = 1; i <= G.cols; i++) {
          for (let j = 1; j <= ROWS; j++) {
            spots.push(
              <circle
                key={`${i}_${j}`} cx={G.colX(i)} cy={G.rowY(j)} r={13} fill="transparent" style={{ cursor: "pointer" }}
                onClick={() => ask({ mode: "pair", i, j })}
              >
                <title>{`Follow seat ${j} of bus ${i}`}</title>
              </circle>,
            );
          }
        }
        return <g>{spots}</g>;
      }}
      askTitle="Ask the manager"
      ask={(ask) => <FleetAsk ask={ask} />}
    />
  );
}
