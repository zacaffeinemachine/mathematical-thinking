import type { ReactElement } from "react";
import { builder, type Builder, type Scene } from "./engine";
import {
  arrow, firstRooms, hotelGeom, lit, makeWin, person, roomFeet, say, StripView, STRIP_H, tag, type Win,
} from "./draw";
import Explainer, { NumberAsk, type Answer } from "./Explainer";
import { fmt, letter } from "./math";

// =====================================================================
//  Explainer 2: one more guest.
//
//  Book: point "One more guest". The traveller arrives at midnight; the
//  manager's one announcement ("would every guest please step out into the
//  corridor, and then go back in to the room one door along"); the guest of
//  room n into room n + 1; room 1 free for the traveller. Guests are
//  lettered A, B, C, ... and the traveller is a star, as in the book's
//  figure "Making room for one more".
// =====================================================================

const ANNOUNCE =
  "Would every guest please step out into the corridor, and then go back in to the room one door along.";

interface Geo {
  W: number;
  band: number;
  street: number; // feet of the traveller
  top: number; //    top of the strip
  feet: number; //   feet of a guest in a room
  corr: number; //   feet of a guest in the corridor
  H: number;
}
function geo(W: number): Geo {
  const band = W < 480 ? 68 : 50;
  const street = band + 52;
  const top = street + 30;
  const feet = roomFeet(top);
  const corr = top + STRIP_H + 50;
  return { W, band, street, top, feet, corr, H: corr + 12 };
}

function story(W: number): Scene {
  const G = geo(W);
  const g = hotelGeom(W);
  const N = g.count + 2;
  const b = builder();
  for (let n = 1; n <= N; n++) b.set(`g${n}`, person(g.roomX(n), G.feet, "guest", letter(n)));
  b.commit(0);
  b.endStep("Tonight the hotel is full. Every room has a guest in it, one guest to a room.");

  b.set("star", person(-30, G.street, "new", "★", 1.1));
  b.commit(0);
  b.upd("star", { x: g.roomX(1) });
  b.commit(1400);
  b.endStep("At midnight a traveller walks in and asks for a room.");

  b.set("say", say(ANNOUNCE, W, G.band));
  b.commit(700);
  b.endStep("The manager is unconcerned. She picks up the intercom and makes a single announcement to the whole hotel.");

  for (let n = 1; n <= N; n++) b.upd(`g${n}`, { y: G.corr });
  b.commit(1100);
  b.endStep("Every guest steps out into the corridor.");

  for (let n = 1; n <= N; n++) {
    b.set(`a${n}`, arrow(g.roomX(n) + 4, G.corr - 34, g.roomX(n + 1) - 2, G.top + STRIP_H + 3, "accent", 0, 1.3));
  }
  b.commit(900);
  b.endStep("The guest of room 1 is to go into room 2, the guest of room 2 into room 3, and in general the guest of room _n_ into room _n_ + 1.");

  for (let n = 1; n <= N; n++) {
    b.upd(`a${n}`, { c: "spent" });
    b.upd(`g${n}`, { x: g.roomX(n + 1), y: G.feet });
  }
  b.commit(1400);
  b.delWhere((id) => id.startsWith("a"));
  b.set("lit1", lit(g.x0 + 1.5, G.top + 1.5, g.x0 + g.pitch - 1.5, G.top + STRIP_H - 1.5));
  b.commit(500);
  b.endStep("Everybody moves at once: one instruction, issued once, obeyed by everybody simultaneously. Room 1 is now empty.");

  b.set("starA", arrow(g.roomX(1) + 10, G.street - 8, g.roomX(1) + 2, G.top + 6, "new", -12, 1.4));
  b.commit(500);
  b.upd("starA", { c: "spent" });
  b.upd("star", { y: G.feet, s: 1 });
  b.del("say");
  b.commit(1100);
  b.delWhere((id) => id === "starA" || id === "lit1");
  b.commit(300);
  b.endStep("The traveller takes room 1, and everybody sleeps.");

  const lastSeen = g.count;
  b.set("t1", tag(g.roomX(lastSeen), G.top + STRIP_H + 22, `${letter(lastSeen - 1)} went to room ${lastSeen}`, "accent", 11.5, { anchor: "end" }));
  b.set("t2", tag(g.roomX(1), G.top + STRIP_H + 22, "★ took room 1", "new", 11.5, { anchor: "start" }));
  b.commit(600);
  b.endStep("Nobody is left without a room: room _n_ + 1 is always a room of the hotel, because there is no last room. And no room holds two people.");
  return b.scene();
}

// ---- Answers ------------------------------------------------------------------
type Q = { mode: "follow" | "who"; n: number };

function answerWin(W: number, q: Q): Win {
  const g = hotelGeom(W);
  const narrow = W < 480;
  const p = Math.max(g.pitch, 40);
  const k = q.mode === "follow" ? q.n : Math.max(1, q.n - 1);
  const nums = [1, 2, ...(narrow ? [] : [3]), k - 1, k, k + 1, k + 2, ...(narrow ? [] : [k + 3])];
  return makeWin(nums, g.x0, p, 30);
}

// Everybody in the window moves one door along. Guests whose new room is off
// the window fade into the gap, and guests from just outside a stretch walk in.
function shiftAll(b: Builder, win: Win, feet: number, hi: string) {
  for (const r of win.runs) {
    for (let m = r.start; m < r.start + r.count; m++) {
      const id = `w${m}`;
      const into = m + 1;
      b.upd(id, { x: win.pos(into), y: feet, bend: 34, o: win.has(into) ? 1 : 0, c: id === hi ? "accent" : "guest" });
    }
    if (r.start > 1) {
      const m = r.start - 1;
      b.upd(`w${m}`, { x: win.pos(r.start), y: feet, bend: 34, o: 1 });
    }
  }
}

function answer(W: number, q: Q): Answer {
  const G = geo(W);
  const win = answerWin(W, q);
  const b = builder();
  const feet = G.feet;
  const roomRect = (n: number, c: "accent" | "new" = "accent") =>
    lit(win.pos(n) - win.pitch / 2 + 1.5, G.top + 1.5, win.pos(n) + win.pitch / 2 - 1.5, G.top + STRIP_H - 1.5, c);
  const hi = q.mode === "follow" ? `w${q.n}` : q.n >= 2 ? `w${q.n - 1}` : "";
  for (const r of win.runs) {
    for (let m = r.start; m < r.start + r.count; m++) {
      b.set(`w${m}`, person(win.pos(m), feet, `w${m}` === hi ? "accent" : "guest", letter(m)));
    }
  }
  b.set("star", person(win.pos(1), G.street, "new", "★", 1.1));
  // The guests just outside each stretch wait, unseen, in the gap, so that
  // they can walk in when everybody moves.
  for (const r of win.runs) {
    if (r.start > 1) {
      const m = r.start - 1;
      b.set(`w${m}`, { ...person(win.pos(m), feet, `w${m}` === hi ? "accent" : "guest", letter(m)), o: 0 });
    }
  }
  const n = q.n;
  if (q.mode === "follow") {
    b.set("hl", roomRect(n));
    b.commit(0);
    b.endStep(`This is the guest of room ${fmt(n)}.`);
  } else {
    b.set("hl", roomRect(n, n === 1 ? "new" : "accent"));
    b.commit(0);
    b.endStep(`Room ${fmt(n)} is lit. Watch who arrives there after the announcement.`);
  }
  shiftAll(b, win, feet, hi);
  if (q.mode === "follow" || n >= 2) b.upd("star", { y: feet, s: 1 });
  if (q.mode === "follow") {
    b.set("arr", arrow(win.pos(n), G.top + STRIP_H + 6, win.pos(n + 1), G.top + STRIP_H + 6, "accent", 18, 1.6));
    b.commit(1500);
    b.set("hl", roomRect(n + 1));
    b.commit(400);
    b.endStep(`The guest of room ${fmt(n)} goes into room ${fmt(n)} + 1 = ${fmt(n + 1)}.`);
    b.set("t", tag(win.pos(n + 1), G.top + STRIP_H + 30, `only from ${fmt(n)}`, "accent", 11.5));
    b.commit(500);
    b.endStep(`Nobody else lands in room ${fmt(n + 1)}: a guest from room _m_ arrives there only if _m_ + 1 = ${fmt(n + 1)}, and that means _m_ = ${fmt(n)}.`);
  } else if (n === 1) {
    b.commit(1500);
    b.endStep("Nobody moves into room 1. A guest arrives in room 1 only if _n_ + 1 = 1, which would need a room 0, and there is no room 0.");
    b.upd("star", { y: feet, s: 1 });
    b.commit(1100);
    b.endStep("So room 1 holds the traveller.");
  } else {
    b.set("arr", arrow(win.pos(n - 1), G.top + STRIP_H + 6, win.pos(n), G.top + STRIP_H + 6, "accent", 18, 1.6));
    b.commit(1500);
    b.endStep(`Room ${fmt(n)} is filled by the guest who was in room ${fmt(n - 1)}, since ${fmt(n - 1)} + 1 = ${fmt(n)}.`);
  }
  return {
    ...b.scene(),
    card:
      q.mode === "follow" ? (
        <>The rule: room <i>n</i> goes to room <i>n</i> + 1. Here <i>n</i> = {fmt(n)}.</>
      ) : (
        <>Read the rule backwards: room <i>k</i> is filled from room <i>k</i> − 1, and room 1 is left for the traveller.</>
      ),
  };
}

export default function HotelOneMoreGuest(): ReactElement {
  return (
    <Explainer<Q>
      id="explainer-one-more-guest"
      title="One more guest"
      label="Animation: making room for one more guest"
      height={(W) => geo(W).H}
      story={story}
      answer={answer}
      backdrop={({ W, q, pal }) => {
        const G = geo(W);
        const g = hotelGeom(W);
        const win = q ? answerWin(W, q) : firstRooms(g.count + 3, g.x0, g.pitch);
        return <StripView win={win} top={G.top} h={STRIP_H} pal={pal} numbers="above" />;
      }}
      askTitle="Ask the manager"
      ask={(ask) => (
        <NumberAsk
          modes={[
            { key: "follow", label: "Follow the guest from room", chips: [3, 37, 1000] },
            { key: "who", label: "Who ends up in room", chips: [1, 38, 1001] },
          ]}
          onAsk={(mode, n) => ask({ mode: mode as Q["mode"], n })}
        />
      )}
    />
  );
}

