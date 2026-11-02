import type { Builder, Role } from "./engine";
import { person, type Win } from "./draw";

// =====================================================================
//  Everybody in a window of rooms obeys one announcement at once.
//
//  The window shows only some rooms, so some guests leave it (they fade
//  into the gap their new room lies past) and some arrive from outside it
//  (they wait, unseen, in the gap their old room lies in, and walk in).
//  Call prepare() before committing the frame BEFORE the move, so that the
//  walkers-in exist there; then move() and commit the move itself.
// =====================================================================
export function obey(args: {
  win: Win;
  feet: number;
  idOf: (m: number) => string; //          the guest who started in room m
  dest: (m: number) => number; //          the room the guest of room m moves to
  src: (r: number) => number | null; //    which room's guest moves INTO room r, if any
  role?: (m: number) => Role;
  label?: (m: number) => string;
  bend?: number;
}) {
  const { win, feet, idOf, dest, src } = args;
  const role = args.role ?? (() => "guest" as Role);
  const label = args.label ?? (() => "");
  const bend = args.bend ?? 34;
  const rooms: number[] = [];
  for (const r of win.runs) for (let m = r.start; m < r.start + r.count; m++) rooms.push(m);
  const walkersIn: Array<[number, number]> = []; // [old room, new room]
  for (const r of rooms) {
    const s = src(r);
    if (s !== null && s >= 1 && !win.has(s)) walkersIn.push([s, r]);
  }
  return {
    rooms,
    prepare(b: Builder) {
      for (const [s] of walkersIn) {
        b.set(idOf(s), { ...person(win.pos(s), feet, role(s), label(s)), o: 0 });
      }
    },
    move(b: Builder) {
      for (const m of rooms) {
        const d = dest(m);
        if (b.has(idOf(m))) b.upd(idOf(m), { x: win.pos(d), y: feet, bend, o: win.has(d) ? 1 : 0, s: 1 });
      }
      for (const [s, r] of walkersIn) b.upd(idOf(s), { x: win.pos(r), y: feet, bend, o: 1 });
    },
  };
}
