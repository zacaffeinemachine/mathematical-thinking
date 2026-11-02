import { useState, type CSSProperties, type ReactElement } from "react";
import { builder, type Palette, type Scene } from "./engine";
import { FONT, lit, text } from "./draw";
import Explainer, { btnStyle, type Answer } from "./Explainer";
import { fleetRoom, fmt, letter, ordinal, threadAt } from "./math";

// =====================================================================
//  Explainer 5: reducing to a problem already solved.
//
//  Book: point "Reducing to a problem already solved". The kettle joke (the
//  mathematician empties a full kettle back onto the floor), then the same
//  move at two o'clock: fleet -> one coach -> the hotel, and the register
//  printed from one formula,
//      seat j of bus i  ->  room (i + j - 2)(i + j - 1) + 2j - 1,
//      the guest of room n  ->  room 2n.
//  The question box prints a page of that register around any room the
//  student names, or finds any passenger of the fleet in it.
// =====================================================================

const H = 322;
const FLOOR = 132;
// The kettle scene is drawn at a larger scale than the pipeline under it.
const kscale = (W: number) => (W >= 560 ? 1.32 : 1.08);

interface KGeo {
  tx: number; // the tap
  fx: number; // the spot on the floor
  sx: number; // the stove
  counter: number;
  stoveTop: number;
}
const kgeo = (W: number): KGeo => ({
  tx: Math.max(70, W * 0.17),
  fx: W * 0.5,
  sx: Math.min(W - 64, W * 0.82),
  counter: 98,
  stoveTop: 92,
});

function story(W: number): Scene {
  const K = kgeo(W / kscale(W));
  const b = builder();
  const v = (o: Record<string, number>) => Object.entries(o).forEach(([k, x]) => b.setVar(k, x));
  const atFloor = { kx: K.fx, ky: FLOOR };
  const atTap = { kx: K.tx + 18, ky: K.counter };
  const atStove = { kx: K.sx, ky: K.stoveTop };
  const atSink = { kx: K.tx - 2, ky: K.counter - 34 };
  v({ ...atFloor, water: 0, stream: 0, flame: 0, tilt: 0, spill: 0, tagP: 0, tagM: 0, solved: 0, p1: 0, p2: 0, p3: 0, form: 0, emptied: 0 });
  b.commit(0);
  b.endStep("A mathematician and a physicist are each shown an empty kettle standing on the floor and asked to boil some water.");

  v(atTap);
  b.commit(900, 100);
  v({ stream: 1 });
  b.commit(250);
  v({ water: 1 });
  b.commit(1000);
  v({ stream: 0 });
  b.commit(250, 100);
  v(atStove);
  b.commit(1100, 100);
  v({ flame: 1 });
  b.commit(500);
  b.endStep("Both fill the kettle at the tap, set it on the stove, and light the stove.");

  v({ flame: 0 });
  b.commit(500);
  b.endStep("Then each is shown a kettle that is already full and already standing on the stove, and asked again.");

  v({ tagP: 1 });
  b.commit(400);
  v({ flame: 1 });
  b.commit(500);
  b.endStep("The physicist lights the stove.");

  v({ flame: 0, tagP: 0 });
  b.commit(500);
  v({ tagM: 1 });
  b.commit(400);
  v(atSink);
  b.commit(1100);
  v({ tilt: 1 });
  b.commit(500);
  v({ spill: 1 });
  b.commit(150);
  v({ water: 0 });
  b.commit(900);
  v({ spill: 0 });
  b.commit(150);
  v({ tilt: 0 });
  b.commit(400);
  v(atFloor);
  b.commit(1100);
  b.endStep("The mathematician takes the kettle off the stove, empties it into the sink, and sets it back down on the floor.");

  v({ solved: 1 });
  b.commit(500);
  b.endStep("Then she remarks that the problem has been reduced to one already solved.");

  v({ tagM: 0, p1: 1 });
  b.commit(700);
  b.endStep("We have just done what the joke describes. Faced with the fleet, we did not look for a rooming plan for the fleet.");

  v({ p2: 1, emptied: 1 });
  b.commit(900);
  b.endStep("We emptied the fleet into one coach, which left us facing the problem of one o'clock.");

  v({ p3: 1 });
  b.commit(900);
  b.endStep("Then we made the two announcements of one o'clock word for word.");

  v({ form: 1 });
  b.commit(700);
  b.endStep("Put the two together and the whole night's arrangement fits in one line. The manager can print the whole register from a formula.");
  return b.scene();
}

// ---- The kettle scene and the pipeline ---------------------------------------
function KettleScene(props: { W: number; pal: Palette; vars: Record<string, number> }): ReactElement {
  const { W: fullW, pal, vars: V } = props;
  const ks = kscale(fullW);
  const W = fullW / ks;
  const K = kgeo(W);
  const c = (r: keyof Palette) => `rgb(${pal[r].map(Math.round).join(",")})`;
  const wall = c("wall");
  const kx = V.kx ?? K.fx;
  const ky = V.ky ?? FLOOR;
  const water = V.water ?? 0;
  const tilt = (V.tilt ?? 0) * 62;
  const flame = V.flame ?? 0;
  const narrow = W < 480;
  // the kettle: base 46 wide, 36 tall, standing on (kx, ky)
  const kw = 46;
  const kh = 36;
  const body = `M${-kw / 2},0 L${kw / 2},0 L${kw / 2 - 5},${-kh + 8} Q${0},${-kh - 4} ${-kw / 2 + 5},${-kh + 8} Z`;
  const clipId = `kclip${Math.round(W)}`;
  return (
    <g fontFamily={FONT}>
      <g transform={`scale(${ks})`}>
      <line x1={8} y1={FLOOR} x2={W - 8} y2={FLOOR} stroke={wall} strokeWidth={1.4} />
      {/* the tap above the sink */}
      <g stroke={wall} strokeWidth={1.4} fill="none" strokeLinejoin="round">
        <path d={`M${K.tx - 30},14 H${K.tx + 14} Q${K.tx + 22},14 ${K.tx + 22},22 V34`} strokeWidth={5} strokeLinecap="round" />
        <line x1={K.tx - 50} y1={K.counter} x2={K.tx + 60} y2={K.counter} />
        <path d={`M${K.tx - 24},${K.counter} L${K.tx - 18},${K.counter + 20} H${K.tx + 18} L${K.tx + 24},${K.counter}`} />
        <line x1={K.tx - 46} y1={K.counter} x2={K.tx - 46} y2={FLOOR} />
        <line x1={K.tx + 56} y1={K.counter} x2={K.tx + 56} y2={FLOOR} />
      </g>
      {(V.stream ?? 0) > 0.01 && (
        <line x1={K.tx + 22} y1={36} x2={K.tx + 22} y2={K.counter - 20 - water * 8} stroke={c("new")} strokeWidth={3}
          opacity={V.stream} strokeLinecap="round" />
      )}
      <text x={K.tx + 5} y={FLOOR + 14} fill={c("num")} fontSize={10.5} textAnchor="middle">tap and sink</text>
      {/* the stove */}
      <g stroke={wall} strokeWidth={1.4} fill="none">
        <rect x={K.sx - 40} y={K.stoveTop} width={80} height={FLOOR - K.stoveTop} rx={2} />
        <circle cx={K.sx - 20} cy={K.stoveTop + 22} r={4} />
        <circle cx={K.sx + 20} cy={K.stoveTop + 22} r={4} />
      </g>
      <text x={K.sx} y={FLOOR + 14} fill={c("num")} fontSize={10.5} textAnchor="middle">stove</text>
      <text x={K.fx} y={FLOOR + 14} fill={c("num")} fontSize={10.5} textAnchor="middle">floor</text>
      {flame > 0.01 && (
        <g fill={c("accent")} opacity={flame}>
          {[-14, 0, 14].map((d) => (
            <path key={d} d={`M${K.sx + d - 4},${K.stoveTop} Q${K.sx + d},${K.stoveTop - 14 * flame} ${K.sx + d + 4},${K.stoveTop} Z`} />
          ))}
        </g>
      )}
      {/* the kettle */}
      <g transform={`translate(${kx},${ky - (flame > 0.01 && Math.abs(kx - K.sx) < 2 ? 4 : 0)}) rotate(${tilt},0,${-kh / 2})`}>
        <defs>
          <clipPath id={clipId}>
            <path d={body} />
          </clipPath>
        </defs>
        <rect x={-kw / 2} y={-(kh - 2) * water} width={kw} height={kh} fill={c("new")} opacity={0.45} clipPath={`url(#${clipId})`} />
        <path d={body} fill="none" stroke={c("ink")} strokeWidth={1.6} strokeLinejoin="round" />
        <path d={`M${kw / 2 - 4},${-10} L${kw / 2 + 12},${-26} L${kw / 2 + 14},${-22} L${kw / 2 - 1},${-4}`} fill={c("surface")} stroke={c("ink")} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={`M${-kw / 2 + 4},${-8} Q${-kw / 2 - 14},${-18} ${-kw / 2 + 6},${-28}`} fill="none" stroke={c("ink")} strokeWidth={1.6} />
        <circle cx={0} cy={-kh - 1} r={3.5} fill={c("surface")} stroke={c("ink")} strokeWidth={1.4} />
      </g>
      {(V.spill ?? 0) > 0.01 && (
        <path d={`M${kx + 28},${ky - 4} Q${kx + 30},${K.counter + 2} ${K.tx - 2},${K.counter + 16}`} fill="none"
          stroke={c("new")} strokeWidth={3} opacity={V.spill} strokeLinecap="round" />
      )}
      {(V.tagP ?? 0) > 0.01 && <Who x={K.fx} label="the physicist" o={V.tagP} pal={pal} />}
      {(V.tagM ?? 0) > 0.01 && <Who x={K.fx} label="the mathematician" o={V.tagM} pal={pal} />}
      {(V.solved ?? 0) > 0.01 && (
        <g opacity={V.solved} transform={`translate(${K.fx + 30 - (narrow ? 112 : 132) / 2},${FLOOR - 64}) rotate(-6)`}>
          <rect x={0} y={-12} width={narrow ? 112 : 132} height={24} rx={4} fill={c("surface")} stroke={c("accent")} strokeWidth={1.8} />
          <text x={(narrow ? 112 : 132) / 2} y={0.5} fill={c("accent")} fontSize={narrow ? 11 : 12.5} fontWeight={800}
            textAnchor="middle" dominantBaseline="central" letterSpacing="0.06em">
            ALREADY SOLVED
          </text>
        </g>
      )}
      </g>
      <Pipeline W={fullW} pal={pal} V={V} />
    </g>
  );
}

function Who(props: { x: number; label: string; o: number; pal: Palette }): ReactElement {
  const { x, label, o, pal } = props;
  const c = (r: keyof Palette) => `rgb(${pal[r].map(Math.round).join(",")})`;
  const w = label.length * 7.4 + 20;
  return (
    <g opacity={o}>
      <rect x={x - w / 2} y={10} width={w} height={24} rx={12} fill={c("surface")} stroke={c("ink")} strokeWidth={1.2} />
      <text x={x} y={22.5} fill={c("ink")} fontSize={13} fontWeight={600} textAnchor="middle" dominantBaseline="central">
        {label}
      </text>
    </g>
  );
}

function Pipeline(props: { W: number; pal: Palette; V: Record<string, number> }): ReactElement {
  const { W, pal, V } = props;
  const c = (r: keyof Palette) => `rgb(${pal[r].map(Math.round).join(",")})`;
  const wall = c("wall");
  const y = 228; // middle of the icons
  const xs = [W * 0.15, W * 0.5, W * 0.85];
  const narrow = W < 480;
  const p1 = V.p1 ?? 0;
  const p2 = V.p2 ?? 0;
  const p3 = V.p3 ?? 0;
  const form = V.form ?? 0;
  const emptied = V.emptied ?? 0;
  const label = (x: number, s: string, o: number) => (
    <text x={x} y={y + 38} fill={c("num")} fontSize={11.5} textAnchor="middle" opacity={o}>
      {s}
    </text>
  );
  const arrowTo = (x1: number, x2: number, s: string, o: number) => (
    <g opacity={o}>
      <line x1={x1} y1={y} x2={x2 - 6} y2={y} stroke={c("accent")} strokeWidth={1.6} />
      <path d={`M${x2},${y} l-8,-4.5 l2,4.5 l-2,4.5 z`} fill={c("accent")} />
      <text x={(x1 + x2) / 2} y={y - (narrow ? 22 : 10)} fill={c("accent")} fontSize={narrow ? 10 : 11} textAnchor="middle" fontWeight={600}>
        {s}
      </text>
    </g>
  );
  return (
    <g>
      {p1 > 0.01 && (
        <g opacity={p1}>
          {[-14, 0, 14].map((d) => (
            <g key={d}>
              <rect x={xs[0] + d - 5} y={y - 26} width={10} height={44} rx={4} fill="none" stroke={wall} strokeWidth={1.3} />
              {[0, 1, 2, 3].map((k) => (
                <circle key={k} cx={xs[0] + d} cy={y + 12 - k * 10} r={2.6} fill={c("new")} opacity={1 - emptied * 0.85} />
              ))}
            </g>
          ))}
          <text x={xs[0] + 26} y={y - 4} fill={c("num")} fontSize={11}>⋯</text>
          {label(xs[0], "the fleet", 1)}
        </g>
      )}
      {arrowTo(xs[0] + 34, xs[1] - 42, "the thread", p2)}
      {p2 > 0.01 && (
        <g opacity={p2}>
          <path d={`M${xs[1] - 36},${y + 10} V${y - 2} L${xs[1] - 28},${y - 10} H${xs[1] + 36}`} fill="none" stroke={wall} strokeWidth={1.3} />
          <line x1={xs[1] - 36} y1={y + 10} x2={xs[1] + 36} y2={y + 10} stroke={wall} strokeWidth={1.3} />
          {[0, 1, 2, 3, 4].map((k) => (
            <circle key={k} cx={xs[1] - 18 + k * 11} cy={y} r={2.6} fill={c("new")} />
          ))}
          <circle cx={xs[1] - 24} cy={y + 13} r={3.5} fill={c("surface")} stroke={wall} strokeWidth={1.2} />
          <circle cx={xs[1] + 20} cy={y + 13} r={3.5} fill={c("surface")} stroke={wall} strokeWidth={1.2} />
          {label(xs[1], "one coach", 1)}
        </g>
      )}
      {arrowTo(xs[1] + 42, xs[2] - 40, narrow ? "one o'clock" : "the two announcements", p3)}
      {p3 > 0.01 && (
        <g opacity={p3}>
          <rect x={xs[2] - 34} y={y - 12} width={68} height={24} fill="none" stroke={wall} strokeWidth={1.3} />
          {[1, 2, 3, 4, 5].map((k) => (
            <g key={k}>
              {k < 5 && <line x1={xs[2] - 34 + k * 13.6} y1={y - 12} x2={xs[2] - 34 + k * 13.6} y2={y + 12} stroke={wall} strokeWidth={0.8} />}
              <circle cx={xs[2] - 34 + (k - 0.5) * 13.6} cy={y} r={2.6} fill={k % 2 === 1 ? c("new") : c("guest")} />
            </g>
          ))}
          {label(xs[2], "the hotel", 1)}
        </g>
      )}
      {form > 0.01 && (
        <g opacity={form} fill={c("ink")} fontSize={narrow ? 11.5 : 13}>
          <text x={W / 2} y={y + 64} textAnchor="middle">
            seat <tspan fontStyle="italic">j</tspan> of bus <tspan fontStyle="italic">i</tspan>  →  room (<tspan fontStyle="italic">i</tspan> + <tspan fontStyle="italic">j</tspan> − 2)(<tspan fontStyle="italic">i</tspan> + <tspan fontStyle="italic">j</tspan> − 1) + 2<tspan fontStyle="italic">j</tspan> − 1
          </text>
          <text x={W / 2} y={y + 86} textAnchor="middle">
            the guest of room <tspan fontStyle="italic">n</tspan>  →  room 2<tspan fontStyle="italic">n</tspan>
          </text>
        </g>
      )}
    </g>
  );
}

// ---- The register -------------------------------------------------------------
type Q = { mode: "room"; r: number } | { mode: "pair"; i: number; j: number };

const ROWS = 9;
const ROW_H = 26;
const REG_TOP = 48;

function occupant(x: number, narrow: boolean): [string, string] {
  if (x % 2 === 0) {
    const n = x / 2;
    const L = letter(n);
    if (narrow) return [L ? `guest ${L}, from room ${fmt(n)}` : `the guest of room ${fmt(n)}`, ""];
    return [L ? `guest ${L}, who was in room ${fmt(n)}` : `the guest who was in room ${fmt(n)}`, ""];
  }
  const m = (x + 1) / 2;
  const [i, j] = threadAt(m);
  return [`seat ${fmt(j)} of bus ${fmt(i)}`, narrow ? "" : `coach seat ${fmt(m)}`];
}

function regStart(q: Q): [number, number] {
  const r = q.mode === "room" ? q.r : fleetRoom(q.i, q.j);
  return [r, Math.max(1, r - 3)];
}

function answer(W: number, q: Q): Answer {
  const narrow = W < 480;
  const [r, start] = regStart(q);
  const b = builder();
  const colRoom = 16;
  const fs = narrow ? 12.5 : 13;
  // the occupant column starts just past the longest room number on the page
  const colWho = Math.max(narrow ? 92 : 124, colRoom + `Room ${fmt(start + ROWS - 1)}`.length * fs * 0.6 + 12);
  b.set("head", text(colRoom, REG_TOP - 22, "The register at half past two", "ink", 14, { anchor: "start", bold: 1 }));
  b.commit(0);
  b.endStep(
    q.mode === "room"
      ? `The manager prints the page of the register with room ${fmt(r)} on it.`
      : `The manager looks up seat ${fmt(q.j)} of bus ${fmt(q.i)} in the register.`,
  );
  for (let k = 0; k < ROWS; k++) {
    const x = start + k;
    const y = REG_TOP + (k + 0.5) * ROW_H;
    const [who, via] = occupant(x, narrow);
    const hot = x === r;
    b.set(`rr${x}`, text(colRoom, y, `Room ${fmt(x)}`, hot ? "accent" : "num", fs, { anchor: "start", bold: hot ? 1 : 0 }));
    b.set(`rw${x}`, text(colWho, y, who, hot ? "accent" : x % 2 === 0 ? "guest" : "new", fs, { anchor: "start", bold: hot ? 1 : 0 }));
    if (via) b.set(`rv${x}`, text(W - 14, y, via, "num", 11, { anchor: "end" }));
    b.commit(150);
  }
  b.set("hl", lit(6, REG_TOP + (r - start) * ROW_H + 1, W - 6, REG_TOP + (r - start + 1) * ROW_H - 1));
  b.commit(400);
  let why: string;
  if (r % 2 === 0) {
    why = `Room ${fmt(r)} is even, so it holds the guest who was in room ${fmt(r)}/2 = ${fmt(r / 2)} before the announcements.`;
  } else {
    const m = (r + 1) / 2;
    const [i, j] = threadAt(m);
    why =
      q.mode === "pair"
        ? `Seat ${fmt(j)} of bus ${fmt(i)} is number ${fmt(m)} on the thread, so it boards at coach seat ${fmt(m)} and sleeps in room 2 × ${fmt(m)} − 1 = ${fmt(r)}.`
        : `Room ${fmt(r)} is odd, so it holds coach seat (${fmt(r)} + 1)/2 = ${fmt(m)}, and the ${ordinal(m)} passenger on the thread is seat ${fmt(j)} of bus ${fmt(i)}.`;
  }
  b.endStep(why);

  let card: ReactElement;
  if (r % 2 === 0) {
    card = <>The rule for the old guests: room <i>n</i> goes to room 2<i>n</i>, so room {fmt(r)} came from room {fmt(r / 2)}.</>;
  } else {
    const [i, j] = threadAt((r + 1) / 2);
    card = (
      <>
        Check with the formula: (<i>i</i> + <i>j</i> − 2)(<i>i</i> + <i>j</i> − 1) + 2<i>j</i> − 1 with <i>i</i> = {fmt(i)} and{" "}
        <i>j</i> = {fmt(j)} gives ({fmt(i + j - 2)})({fmt(i + j - 1)}) + {fmt(2 * j - 1)} = <b>{fmt(fleetRoom(i, j))}</b>.
      </>
    );
  }
  return { ...b.scene(), card };
}

function RegisterLines(props: { W: number; pal: Palette; q: Q }): ReactElement {
  const { W, pal } = props;
  const c = (r: keyof Palette) => `rgb(${pal[r].map(Math.round).join(",")})`;
  return (
    <g>
      <rect x={4} y={REG_TOP - 40} width={W - 8} height={ROWS * ROW_H + 52} rx={6} fill="none" stroke={c("faint")} strokeWidth={1.2} />
      {Array.from({ length: ROWS + 1 }, (_, k) => (
        <line key={k} x1={10} y1={REG_TOP + k * ROW_H} x2={W - 10} y2={REG_TOP + k * ROW_H} stroke={c("faint")} strokeWidth={k === 0 ? 1.4 : 0.8} />
      ))}
      <text x={W / 2} y={REG_TOP + ROWS * ROW_H + 8} fill={c("num")} fontSize={11} textAnchor="middle" dominantBaseline="hanging">
        ⋯ and so on, a line for every room ⋯
      </text>
    </g>
  );
}

function RegisterAsk(props: { ask: (q: Q) => void }): ReactElement {
  const [room, setRoom] = useState("15");
  const [bus, setBus] = useState("2");
  const [seat, setSeat] = useState("1000");
  const parse = (s: string) => Number(s.replace(/[,\s]/g, ""));
  const ok = (v: number, max: number) => Number.isInteger(v) && v >= 1 && v <= max;
  const ro = parse(room);
  const bi = parse(bus);
  const sj = parse(seat);
  const box = (val: string, set: (s: string) => void, label: string, good: boolean, w = 90) => (
    <input
      type="text" inputMode="numeric" value={val} onChange={(e) => set(e.target.value)} aria-label={label} aria-invalid={!good}
      style={{
        width: w, padding: "5px 8px", fontSize: 14, border: `1px solid ${good ? "var(--rule)" : "var(--accent)"}`,
        borderRadius: 6, background: "var(--bg)", color: "var(--ink)", minHeight: 32, fontVariantNumeric: "tabular-nums",
      }}
    />
  );
  const row: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 14 };
  const roomOk = ok(ro, 1_000_000_000);
  const pairOk = ok(bi, 100_000) && ok(sj, 100_000);
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <form style={row} onSubmit={(e) => { e.preventDefault(); if (roomOk) props.ask({ mode: "room", r: ro }); }}>
        <span>Who sleeps in room</span>
        {box(room, setRoom, "Room number", roomOk, 110)}
        <button type="submit" style={btnStyle(roomOk, true)} disabled={!roomOk}>Print the page</button>
      </form>
      <form style={row} onSubmit={(e) => { e.preventDefault(); if (pairOk) props.ask({ mode: "pair", i: bi, j: sj }); }}>
        <span>Where does bus</span>
        {box(bus, setBus, "Bus number", ok(bi, 100_000), 76)}
        <span>seat</span>
        {box(seat, setSeat, "Seat number", ok(sj, 100_000), 76)}
        <span>sleep</span>
        <button type="submit" style={btnStyle(pairOk, true)} disabled={!pairOk}>Look it up</button>
      </form>
      {(!roomOk || !pairOk) && (
        <span style={{ fontSize: 12, color: "var(--accent)" }}>
          Rooms go up to 1,000,000,000 here, and bus and seat numbers up to 100,000.
        </span>
      )}
    </div>
  );
}

export default function HotelReduction(): ReactElement {
  return (
    <Explainer<Q>
      id="explainer-reduction"
      title="Reducing to a problem already solved"
      label="Animation: the kettle joke, and the night's register"
      height={() => H}
      story={story}
      answer={answer}
      backdrop={({ W, pal, vars, q }) =>
        q ? <RegisterLines W={W} pal={pal} q={q} /> : <KettleScene W={W} pal={pal} vars={vars} />
      }
      fadeAnswer={false}
      askTitle="Print the register"
      ask={(ask) => <RegisterAsk ask={ask} />}
    />
  );
}
