import type { ReactElement } from "react";
import { builder, mk, type Builder, type Scene } from "./engine";
import {
  arrow, BusWindow, firstRooms, hbusSeatX, hotelGeom, lit, makeWin, person, roomFeet, say, StripView,
  STRIP_H, tag, type Win,
} from "./draw";
import Explainer, { NumberAsk, type Answer } from "./Explainer";
import { fmt, letter } from "./math";
import { obey } from "./moves";

// =====================================================================
//  Explainer 3: a bus full of guests.
//
//  Book: point "A bus full of guests". First the obvious idea, which fails:
//  shift everybody one door along and put seat 1 into room 1, then again
//  for seat 2, and so on. The passenger in seat k waits only k rounds, but
//  the guest who started in room 1 moves at every round and never comes to
//  rest. Then the plan that works, in two announcements:
//      "would the guest in room n please move to room 2n"
//      "would the passenger in seat k please take room 2k - 1".
//  Guests are lettered A, B, C, ... and passengers carry their seat number,
//  so the finished hotel reads 1, A, 2, B, 3, C, ... as in the book's
//  figure "Two infinite crowds into one hotel". The seats are deliberately
//  NOT drawn above the rooms of the same number: seat k goes to room 2k - 1.
// =====================================================================

const ANNOUNCE_1 = "Would the guest in room n please move to room 2n.";
const ANNOUNCE_2 = "Would the passenger in seat k please take room 2k − 1.";

interface Geo {
  band: number;
  roof: number; //  coach roof
  floor: number; // coach floor
  top: number; //   hotel strip
  feet: number;
  corr: number;
  H: number;
  busX: number; //  coach nose
  sp: number; //    seat pitch
  seats: number; // seats drawn
}
function geo(W: number): Geo {
  const g = hotelGeom(W);
  const band = W < 480 ? 68 : 50;
  const roof = band + 14;
  const floor = roof + 46;
  const top = floor + 44;
  const corr = top + STRIP_H + 50;
  const sp = g.pitch * 1.3;
  const busX = g.x0 + 2;
  const seats = Math.ceil((W - busX - 30) / sp) + 2;
  return { band, roof, floor, top, feet: roomFeet(top), corr, H: corr + 14, busX, sp, seats };
}

const seatFeet = (G: Geo) => G.floor - 3;

function placeBus(b: Builder, G: Geo, dx: number, withLoad: boolean) {
  b.set("bus", mk({ k: "hbus", z: 1, c: "wall", f: "surface", x: G.busX + dx, y: G.roof, y2: G.floor, n: G.seats, pitch: G.sp, size: 9 }));
  if (withLoad) {
    for (let k = 1; k <= G.seats; k++) {
      b.set(`p${k}`, person(hbusSeatX(G.busX, G.sp, k) + dx, seatFeet(G), "new", String(k), 0.92));
    }
  }
}

function story(W: number): Scene {
  const G = geo(W);
  const g = hotelGeom(W);
  const N = g.count + 2;
  const b = builder();
  const fullHotel = () => {
    for (let n = 1; n <= N; n++) b.set(`g${n}`, person(g.roomX(n), G.feet, "guest", letter(n)));
  };
  fullHotel();
  b.commit(0);
  b.endStep("The hotel is full again, one guest to a room.");

  placeBus(b, G, W, true);
  b.commit(0);
  placeBus(b, G, 0, true);
  b.commit(1600);
  b.endStep("At one in the morning a coach pulls up outside. It has a seat for every counting number, and every seat is taken.");

  // ---- the obvious idea, which fails -----------------------------------
  b.chapter(1);
  // room[r] is whoever is in room r now; A's counter follows A around.
  let room: string[] = [""];
  for (let n = 1; n <= N; n++) room[n] = `g${n}`;
  let movesOfA = 0;
  const counter = () => {
    const aRoom = room.indexOf("g1");
    const x = Math.min(g.roomX(aRoom), W - 70);
    const str = `A has moved ${movesOfA} ${movesOfA === 1 ? "time" : "times"}`;
    if (b.has("ctr")) b.upd("ctr", { x, str });
    else b.set("ctr", tag(x, G.top + STRIP_H + 26, str, "accent", 11.5));
  };
  const round = (k: number, dur: number) => {
    const next: string[] = [""];
    for (let r = 1; r < room.length; r++) {
      const id = room[r];
      if (!id) continue;
      b.upd(id, { x: g.roomX(r + 1), y: G.feet, bend: 30, s: 1 });
      next[r + 1] = id;
    }
    room = next;
    movesOfA++;
    counter();
    b.commit(dur);
    b.upd(`p${k}`, { x: g.roomX(1), y: G.feet, s: 1 });
    room[1] = `p${k}`;
    b.commit(dur * 0.8);
  };
  round(1, 1000);
  b.endStep("The obvious idea: shift everybody one door along, then put the passenger from seat 1 into room 1.");
  round(2, 1000);
  b.endStep("Then shift everybody again and put the passenger from seat 2 into room 1. The passenger in seat _k_ gets in after _k_ rounds, a finite wait.");
  for (let k = 3; k <= 8; k++) round(k, 420);
  b.endStep("But guest A is asked to move at every single round, so there is no room we can point to and say this is where A spent the night.");

  // ---- the plan that works ---------------------------------------------
  b.chapter(2);
  b.del("ctr");
  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { x: g.roomX(n), y: G.feet, s: 1 });
  for (let k = 1; k <= G.seats; k++) b.upd(`p${k}`, { x: hbusSeatX(G.busX, G.sp, k), y: seatFeet(G), s: 0.92 });
  b.commit(1200, 200);
  b.set("say", say(ANNOUNCE_1, W, G.band));
  b.commit(600);
  b.endStep("So the manager must free up infinitely many rooms at once, in a single announcement.");

  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { y: G.corr });
  b.commit(1000);
  for (let n = 1; 2 * n <= N + 1; n++) {
    b.set(`a${n}`, arrow(g.roomX(n) + 3, G.corr - 34, g.roomX(2 * n), G.top + STRIP_H + 3, "accent", 0, 1.3));
  }
  b.commit(900);
  b.endStep("The guest of room 1 goes to room 2, the guest of room 2 to room 4, the guest of room 3 to room 6.");

  b.updWhere((id) => /^a\d+$/.test(id), { c: "spent" });
  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { x: g.roomX(2 * n), y: G.feet });
  b.commit(1500);
  b.delWhere((id) => /^a\d+$/.test(id));
  for (let r = 1; r <= N; r += 2) {
    b.set(`lit${r}`, lit(g.roomX(r) - g.pitch / 2 + 1.5, G.top + 1.5, g.roomX(r) + g.pitch / 2 - 1.5, G.top + STRIP_H - 1.5));
  }
  b.commit(600);
  b.endStep("Everybody ends up in an even-numbered room, and every odd-numbered room is now standing empty.");

  b.upd("say", { str: ANNOUNCE_2 });
  for (let k = 1; 2 * k - 1 <= N; k++) {
    b.set(`b${k}`, arrow(hbusSeatX(G.busX, G.sp, k), G.floor + 4, g.roomX(2 * k - 1), G.top - 16, "new", 0, 1.3));
  }
  b.commit(900);
  b.endStep("That is a spare room for every counting number, which is exactly as many as the coach has passengers.");

  b.updWhere((id) => /^b\d+$/.test(id), { c: "spent" });
  for (let k = 1; k <= G.seats; k++) b.upd(`p${k}`, { x: g.roomX(2 * k - 1), y: G.feet, s: 1 });
  b.commit(1500);
  b.endStep("Seat 1 takes room 1, seat 2 takes room 3, seat 3 takes room 5, and so on up the odd numbers.");

  b.delWhere((id) => /^(b|lit)\d+$/.test(id));
  b.del("say");
  b.upd("bus", { x: G.busX - 60, o: 0 });
  b.commit(1200);
  b.endStep("The two crowds interleave, coach, guest, coach, guest, all the way along. The hotel is exactly full again, with no room wasted.");
  return b.scene(["The coach arrives", "The idea that fails", "The plan that works"]);
}

// ---- Answers ------------------------------------------------------------------
type Q = { mode: "guest" | "seat" | "who"; n: number };

interface AWins {
  bus: Win;
  hotel: Win;
  pitch: number;
}
function wins(W: number, q: Q): AWins {
  const G = geo(W);
  const g = hotelGeom(W);
  const narrow = W < 480;
  const p = Math.max(g.pitch, 40);
  const sx = G.busX + 30;
  const kind = q.mode === "who" ? (q.n % 2 === 0 ? "guest" : "seat") : q.mode;
  const n = q.mode === "who" ? (q.n % 2 === 0 ? q.n / 2 : (q.n + 1) / 2) : q.n;
  if (kind === "guest") {
    const hotel = narrow ? [1, n, 2 * n - 1, 2 * n] : [1, 2, n, n + 1, 2 * n - 1, 2 * n, 2 * n + 1];
    return { bus: makeWin([1, 2, 3], sx, p, 26), hotel: makeWin(hotel, g.x0, p, 26), pitch: p };
  }
  const bus = narrow ? [1, n, n + 1] : [1, 2, n - 1, n, n + 1];
  const hotel = narrow ? [1, 2 * n - 1, 2 * n] : [1, 2, 2 * n - 2, 2 * n - 1, 2 * n];
  return { bus: makeWin(bus, sx, p, 26), hotel: makeWin(hotel, g.x0, p, 26), pitch: p };
}

function answer(W: number, q: Q): Answer {
  const G = geo(W);
  const { bus, hotel } = wins(W, q);
  const b = builder();
  const kind = q.mode === "who" ? (q.n % 2 === 0 ? "guest" : "seat") : q.mode;
  const n = q.mode === "who" ? (q.n % 2 === 0 ? q.n / 2 : (q.n + 1) / 2) : q.n;
  const r = kind === "guest" ? 2 * n : 2 * n - 1;
  const hiGuest = kind === "guest" ? `w${n}` : "";
  const hiSeat = kind === "seat" ? `s${n}` : "";
  const room = (x: number) => lit(hotel.pos(x) - hotel.pitch / 2 + 1.5, G.top + 1.5, hotel.pos(x) + hotel.pitch / 2 - 1.5, G.top + STRIP_H - 1.5);

  const step1 = obey({
    win: hotel,
    feet: G.feet,
    idOf: (m) => `w${m}`,
    dest: (m) => 2 * m,
    src: (x) => (x % 2 === 0 ? x / 2 : null),
    role: (m) => (`w${m}` === hiGuest ? "accent" : "guest"),
    label: letter,
    bend: 40,
  });
  for (const m of step1.rooms) b.set(`w${m}`, person(hotel.pos(m), G.feet, `w${m}` === hiGuest ? "accent" : "guest", letter(m)));
  for (const run of bus.runs) {
    for (let k = run.start; k < run.start + run.count; k++) {
      b.set(`s${k}`, person(bus.pos(k), seatFeet(G), `s${k}` === hiSeat ? "accent" : "new", fmt(k), 0.92));
    }
  }
  step1.prepare(b);
  // The passengers obey the second announcement all at once too. Those whose
  // seats are off the coach window wait, unseen, in its gaps.
  const busRooms: number[] = [];
  for (const run of bus.runs) for (let k = run.start; k < run.start + run.count; k++) busRooms.push(k);
  const comers: number[] = [];
  for (const run of hotel.runs) {
    for (let x = run.start; x < run.start + run.count; x++) {
      const k = (x + 1) / 2;
      if (x % 2 === 1 && !bus.has(k)) comers.push(k);
    }
  }
  for (const k of comers) b.set(`s${k}`, { ...person(bus.pos(k), seatFeet(G), `s${k}` === hiSeat ? "accent" : "new", k < 1000 ? fmt(k) : "", 0.92), o: 0 });
  const allAboard = () => {
    for (const k of [...busRooms, ...comers]) {
      const x = 2 * k - 1;
      b.upd(`s${k}`, { x: hotel.pos(x), y: G.feet, s: 1, o: hotel.has(x) ? 1 : 0 });
    }
  };
  const tellGuest = `the guest of room ${fmt(n)}`;
  if (q.mode === "who") {
    b.set("hl", room(r));
    b.commit(0);
    b.endStep(
      kind === "guest"
        ? `Room ${fmt(r)} is even, so it will hold an old guest, not a passenger.`
        : `Room ${fmt(r)} is odd, so it will hold a passenger from the coach.`,
    );
  } else {
    b.commit(0);
    b.endStep(kind === "guest" ? `This is ${tellGuest}.` : `This is the passenger in seat ${fmt(n)}.`);
  }

  b.set("say", say(ANNOUNCE_1, W, G.band));
  step1.move(b);
  if (kind === "guest") b.set("arr", arrow(hotel.pos(n), G.top + STRIP_H + 6, hotel.pos(2 * n), G.top + STRIP_H + 6, "accent", 26, 1.6));
  b.commit(1600);
  if (kind === "guest") {
    b.set("hl", room(r));
    b.commit(400);
    b.endStep(
      q.mode === "who"
        ? `${fmt(r)} = 2 × ${fmt(n)}, so room ${fmt(r)} holds the guest who was in room ${fmt(n)}.`
        : `The guest of room ${fmt(n)} moves to room 2 × ${fmt(n)} = ${fmt(2 * n)}.`,
    );
    b.upd("say", { str: ANNOUNCE_2 });
    b.del("arr");
    allAboard();
    b.commit(1400);
    b.endStep(`The passengers only go to odd rooms, so nobody joins this guest in room ${fmt(r)}.`);
  } else {
    if (!b.has("hl")) b.set("hl", room(r));
    b.commit(400);
    b.endStep(`Every guest moves to an even room, so room ${fmt(r)} is now empty.`);
    b.upd("say", { str: ANNOUNCE_2 });
    b.set("arr", arrow(bus.pos(n), G.floor + 4, hotel.pos(r), G.top - 16, "accent", 0, 1.6));
    b.commit(700);
    allAboard();
    b.commit(1400);
    b.endStep(
      q.mode === "who"
        ? `${fmt(r)} = 2 × ${fmt(n)} − 1, so room ${fmt(r)} holds the passenger from seat ${fmt(n)}.`
        : `Seat ${fmt(n)} takes room 2 × ${fmt(n)} − 1 = ${fmt(r)}.`,
    );
  }
  const card =
    q.mode === "who" ? (
      <>
        Read the rules backwards. An even room <i>r</i> holds the guest from room <i>r</i>/2. An odd room <i>r</i>{" "}
        holds the passenger from seat (<i>r</i> + 1)/2.
      </>
    ) : kind === "guest" ? (
      <>The rule for guests: room <i>n</i> goes to room 2<i>n</i>. Here <i>n</i> = {fmt(n)}.</>
    ) : (
      <>The rule for passengers: seat <i>k</i> goes to room 2<i>k</i> − 1. Here <i>k</i> = {fmt(n)}.</>
    );
  return { ...b.scene(), card };
}

export default function HotelBusload(): ReactElement {
  return (
    <Explainer<Q>
      id="explainer-busload"
      title="A bus full of guests"
      label="Animation: seating a coach with a seat for every counting number"
      height={(W) => geo(W).H}
      story={story}
      answer={answer}
      backdrop={({ W, q, pal }) => {
        const G = geo(W);
        const g = hotelGeom(W);
        if (!q) return <StripView win={firstRooms(g.count + 3, g.x0, g.pitch)} top={G.top} h={STRIP_H} pal={pal} numbers="above" />;
        const w = wins(W, q);
        return (
          <g>
            <BusWindow win={w.bus} top={G.roof} h={G.floor - G.roof} pal={pal} />
            <StripView win={w.hotel} top={G.top} h={STRIP_H} pal={pal} numbers="above" />
          </g>
        );
      }}
      askTitle="Ask the manager"
      ask={(ask) => (
        <NumberAsk
          modes={[
            { key: "guest", label: "Follow the guest from room", chips: [3, 37, 1000] },
            { key: "seat", label: "Follow the passenger in seat", chips: [3, 37, 1000] },
            { key: "who", label: "Who ends up in room", chips: [8, 73, 1000] },
          ]}
          onAsk={(mode, n) => ask({ mode: mode as Q["mode"], n })}
        />
      )}
    />
  );
}
