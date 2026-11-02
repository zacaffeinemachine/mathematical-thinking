import type { ReactElement } from "react";
import { builder, type Palette, type Scene } from "./engine";
import { FONT, hotelGeom, numeralSize, roomFeet, STRIP_H } from "./draw";
import Explainer, { NumberAsk, type Answer } from "./Explainer";
import { fmt, letter } from "./math";

// =====================================================================
//  Explainer 1: a hotel with no last room.
//
//  Book: Chapters/Infinity.tex, point "A hotel with no last room". One room
//  for every counting number, no final room, tonight every room full, and a
//  sign that ought to read "No vacancies, rooms available".
//
//  The camera walks down the corridor. Its position is the var "lp", the
//  base-ten logarithm of how many rooms it has passed, so a walk out to room
//  1,000,000 shows the numbers growing digit by digit instead of as a blur.
//  The question box lets the student name any room and walk there.
// =====================================================================

const TOP = 92; //  top of the strip
const H = TOP + STRIP_H + 52;

const lpOf = (pan: number) => Math.log10(pan + 1);
const panOf = (lp: number) => Math.max(0, Math.pow(10, lp) - 1);

function story(_W: number): Scene {
  const b = builder();
  const base = { lp: 0, wave: 0, sign: 0, sign2: 0, hlo: 0, $hl: 0 };
  Object.entries(base).forEach(([k, v]) => b.setVar(k, v));
  b.commit(0);
  b.endStep("The Grand Hotel has one room for every counting number, room 1, room 2, room 3, and so on without end.");

  b.setVar("lp", lpOf(40));
  b.commit(2200);
  b.endStep("Walk down the corridor and the doors keep coming. There is no final room, no room at the end of the corridor.");

  b.setVar("lp", lpOf(999_997));
  b.commit(3400, 200);
  b.setVar("$hl", 1_000_000);
  b.setVar("hlo", 1);
  b.commit(500);
  b.endStep("Whatever room number we name, there is another one past it. Room 1,000,000 has room 1,000,001 right after it.");

  b.setVar("hlo", 0);
  b.commit(300);
  b.setVar("lp", 0);
  b.commit(2600, 150);
  b.setVar("wave", 40);
  b.commit(1600);
  b.endStep("Tonight the hotel is full. Every room has a guest in it, one guest to a room.");

  b.setVar("sign", 1);
  b.commit(900);
  b.endStep("The manager has hung out the No Vacancies sign. In an ordinary hotel, that means nobody else can be given a room.");

  b.setVar("sign2", 1);
  b.commit(900);
  b.endStep("In the Grand Hotel the two come apart. An honest sign would have to read: No vacancies, rooms available.");
  return b.scene();
}

function answer(_W: number, n: number): Answer {
  const b = builder();
  const start = { lp: 0, wave: 40, sign: 1, sign2: 1, hlo: 0, $hl: n };
  Object.entries(start).forEach(([k, v]) => b.setVar(k, v));
  b.commit(0);
  b.endStep(`Room ${fmt(n)} is somewhere down this corridor. Let us walk there.`);

  const pan = Math.max(0, n - 3);
  b.setVar("lp", lpOf(pan));
  b.commit(pan > 50 ? 3000 : 1400, 150);
  b.setVar("hlo", 1);
  b.commit(500);
  b.endStep(`Room ${fmt(n)} has a guest in it, and room ${fmt(n + 1)} is right past it.`);

  b.setVar("hlo", 0);
  b.commit(250);
  b.setVar("lp", lpOf(pan + 1));
  b.setVar("$hl", n + 1);
  b.commit(700);
  b.setVar("hlo", 1);
  b.commit(400);
  b.endStep(`One door further: room ${fmt(n + 1)} has a guest too, and room ${fmt(n + 2)} comes after it. The doors never run out.`);
  return {
    ...b.scene(),
    card: (
      <>
        Name a bigger number and the same thing happens. Room <i>n</i> always has room <i>n</i> + 1 after it, so
        no room is the last one.
      </>
    ),
  };
}

function Corridor(props: { W: number; pal: Palette; vars: Record<string, number> }): ReactElement {
  const { W, pal, vars } = props;
  const g = hotelGeom(W);
  const p = g.pitch;
  const raw = panOf(vars.lp ?? 0);
  const pan = Math.abs(raw - Math.round(raw)) < 1e-6 ? Math.round(raw) : raw;
  const c = (r: keyof Palette) => `rgb(${pal[r].map(Math.round).join(",")})`;
  const wall = c("wall");
  const first = Math.max(1, Math.floor(pan));
  const leftOf = (n: number) => g.x0 + (n - 1 - pan) * p;
  const rooms: number[] = [];
  for (let n = first; leftOf(n) < W + p; n++) rooms.push(n);
  const stripL = Math.max(pan < 0.001 ? g.x0 : -10, leftOf(1));
  const feet = roomFeet(TOP);
  const wave = vars.wave ?? 0;
  const hl = vars.$hl ?? 0;
  const hlo = vars.hlo ?? 0;

  // the sign, hanging from the ceiling near the front door
  const sign = vars.sign ?? 0;
  const sign2 = vars.sign2 ?? 0;
  const sx = g.x0 + 6;
  const sw = Math.min(176, W * 0.46);
  const drop = (1 - sign) * -70;

  return (
    <g fontFamily={FONT}>
      {/* the ceiling the sign hangs from */}
      <line x1={0} y1={8} x2={W} y2={8} stroke={c("faint")} strokeWidth={1} />
      <line x1={stripL} y1={TOP} x2={W + 10} y2={TOP} stroke={wall} strokeWidth={1.4} />
      <line x1={stripL} y1={TOP + STRIP_H} x2={W + 10} y2={TOP + STRIP_H} stroke={wall} strokeWidth={1.4} />
      {rooms.map((n) => {
        const x = leftOf(n);
        const label = fmt(n);
        const guestO = Math.max(0, Math.min(1, wave - (n - 1 - Math.floor(pan))));
        return (
          <g key={n}>
            <line x1={x} y1={TOP} x2={x} y2={TOP + STRIP_H} stroke={wall} strokeWidth={n === 1 ? 1.4 : 0.9} />
            <text
              x={x + p / 2} y={TOP - 7} fill={c("num")} fontSize={numeralSize(label, p)} textAnchor="middle"
            >
              {label}
            </text>
            {guestO > 0.01 && <Guest x={x + p / 2} y={feet} o={guestO} lab={letter(n)} pal={pal} />}
          </g>
        );
      })}
      {hlo > 0.01 && hl > 0 && (
        <g opacity={hlo}>
          <rect
            x={leftOf(hl) + 1.5} y={TOP + 1.5} width={p - 3} height={STRIP_H - 3} fill={c("accent")} fillOpacity={0.1}
            stroke={c("accent")} strokeWidth={2} rx={2}
          />
          <rect
            x={leftOf(hl + 1) + 1.5} y={TOP + 1.5} width={p - 3} height={STRIP_H - 3} fill="none"
            stroke={c("accent")} strokeWidth={1.6} strokeDasharray="4 3" rx={2}
          />
          <path
            d={`M${leftOf(hl) + p / 2},${TOP + STRIP_H + 6} Q${leftOf(hl) + p},${TOP + STRIP_H + 22} ${leftOf(hl + 1) + p / 2 - 3},${TOP + STRIP_H + 8}`}
            fill="none" stroke={c("accent")} strokeWidth={1.5}
          />
          <path
            d={`M${leftOf(hl + 1) + p / 2},${TOP + STRIP_H + 5} l-7,1 l3,5 z`}
            fill={c("accent")}
          />
          <text
            x={Math.min(leftOf(hl + 1) + p / 2, W - 60)} y={TOP + STRIP_H + 34} fill={c("accent")} fontSize={12.5}
            fontWeight={600} textAnchor="middle"
          >
            {`and then room ${fmt(hl + 1)}`}
          </text>
        </g>
      )}
      {sign > 0.01 && (
        <g opacity={sign} transform={`translate(0,${drop})`}>
          <line x1={sx + 22} y1={8} x2={sx + 22} y2={22} stroke={c("wall")} strokeWidth={1} />
          <line x1={sx + sw - 22} y1={8} x2={sx + sw - 22} y2={22} stroke={c("wall")} strokeWidth={1} />
          <rect x={sx} y={22} width={sw} height={44} rx={5} fill={c("surface")} stroke={c("ink")} strokeWidth={1.4} />
          <text x={sx + sw / 2} y={sign2 > 0.01 ? 37 : 44} fill={c("ink")} fontSize={13} fontWeight={800}
            textAnchor="middle" dominantBaseline="central" letterSpacing="0.08em">
            NO VACANCIES
          </text>
          {sign2 > 0.01 && (
            <text x={sx + sw / 2} y={55} fill={c("accent")} fontSize={12.5} fontStyle="italic" fontWeight={600}
              textAnchor="middle" dominantBaseline="central" opacity={sign2}>
              rooms available
            </text>
          )}
        </g>
      )}
    </g>
  );
}

function Guest(props: { x: number; y: number; o: number; lab: string; pal: Palette }): ReactElement {
  const { x, y, o, lab, pal } = props;
  const col = `rgb(${pal.guest.map(Math.round).join(",")})`;
  const surf = `rgb(${pal.surface.map(Math.round).join(",")})`;
  const hy = y - 23.5;
  return (
    <g opacity={o} stroke={col} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x - 5.5},${y}L${x},${y - 8.5}L${x + 5.5},${y}M${x},${y - 8.5}L${x},${y - 16}M${x - 6.5},${y - 8.5}L${x},${y - 14}L${x + 6.5},${y - 8.5}`} />
      <circle cx={x} cy={hy} r={7.5} fill={surf} />
      {lab && (
        <text x={x} y={hy + 0.4} fill={col} stroke="none" fontSize={9.2} fontWeight={700} textAnchor="middle" dominantBaseline="central">
          {lab}
        </text>
      )}
    </g>
  );
}

export default function HotelNoLastRoom(): ReactElement {
  return (
    <Explainer<number>
      id="explainer-no-last-room"
      title="A hotel with no last room"
      label="Animation: the corridor of the Grand Hotel"
      height={() => H}
      story={story}
      answer={answer}
      backdrop={({ W, pal, vars }) => <Corridor W={W} pal={pal} vars={vars} />}
      askTitle="Name any room, and walk down the corridor to it"
      ask={(ask) => (
        <NumberAsk
          modes={[{ key: "room", label: "Walk to room", chips: [37, 1000, 1_000_000], max: 1_000_000_000 }]}
          initial={1000}
          onAsk={(_m, n) => ask(n)}
        />
      )}
    />
  );
}
