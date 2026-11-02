import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";

// =====================================================================
//  CantorAnimation: the deck Slides/Ch05-Infinity/05-Cantors-Book.tex,
//  played as an animation instead of a flip-book.
//
//  Three frames, in the deck's order: Cantor's Book (9 clicks), Cantor's
//  Code (29 clicks, words only in clicks 1 to 6) and Cantor's Tree (24
//  clicks, no words). Each click is one step here, except where the deck
//  spends a run of clicks on the in-between frames of one motion: the copy
//  crossing (Code clicks 9 to 18) and the copy standing up (20 to 29) are
//  one tweened step each, because the animation now draws the motion.
//
//  ALL GEOMETRY IS THE DECK'S. Coordinates below are TikZ centimetres,
//  copied from the macros in the .tex, and X()/Y() turn them into SVG units
//  of 0.01 cm with y pointing down. The Book scene is lifted 0.6 cm (BOOK_DY)
//  because the deck sets it in a shorter box above a caption band.
//
//  ALL DIGITS ARE THE DECK'S. The five big codes, the fifteen-row block, and
//  the two tree routes are typed below exactly as in the .tex, and the
//  diagonal is checked against the deck's hand-typed \diagvals and
//  \flipvals at load time.
// =====================================================================

// ---- Palette (Slides/PreambleSlides.tex and the deck) -----------------
const C = {
  darkbg: "rgb(20,24,30)",
  darkerbg: "rgb(15,18,23)",
  lightbg: "rgb(30,35,42)",
  textwhite: "rgb(230,235,240)",
  textgray: "rgb(180,185,195)",
  cream: "rgb(234,229,220)",
  accent: "rgb(220,180,100)",
  accentcool: "rgb(120,185,235)",
  heading: "rgb(150,170,200)",
  navdim: "rgb(120,128,140)",
  dimdigit: "rgb(88,126,156)",
  // textgray!45!darkbg, the deck's dashed divider
  divider: "rgb(92,96,104)",
  // textgray!40!darkbg, a tree edge
  tedge: "rgb(84,88,96)",
  // textgray!70!darkbg, a tree node
  tnode: "rgb(132,137,146)",
};

// KaTeX_Typewriter is Computer Modern typewriter, the deck's own face for
// a 0 or a 1. The site loads it globally with KaTeX's stylesheet. The
// fallbacks matter less than they look: every glyph is placed on its own.
const MONO =
  '"KaTeX_Typewriter", ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", "Liberation Mono", monospace';
const SANS = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
const HEAD = 'Montserrat, Inter, ui-sans-serif, system-ui, sans-serif';

// ---- Units -------------------------------------------------------------
const U = 100; // SVG units per TikZ centimetre
const X = (x: number) => x * U;
const Y = (y: number) => -y * U;
const PT = 3.515; // one TeX point, in SVG units

// The stage: the slide's 12.8 cm width, a banner, and the deck's \diagbb
// (-5.75,-4.00) to (5.75,3.60) underneath it.
const VB = { x: -640, y: -475, w: 1280, h: 900 };
const BANNER_BOTTOM = -380;

// ---- Small maths -------------------------------------------------------
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- The deck's data ---------------------------------------------------
// Cantor's Code, clicks 1 to 6: five codes of sixteen digits.
const BIG_CODES = [
  "0110100110110010",
  "0000000000000000",
  "0101010101010101",
  "1101000101101001",
  "1001110010100110",
];
// The click on which each big code arrives.
const BIG_ARRIVES = [1, 2, 3, 4, 4];
const BIG_ROW_Y = [2.55, 1.75, 0.95, 0.15, -0.65];

// Cantor's Code, click 7 on: fifteen rows of fifteen digits. Rows 1 to 5
// are the five codes above, cut to fifteen.
const BLOCK = [
  "011010011011001",
  "000000000000000",
  "010101010101010",
  "110100010110100",
  "100111001010011",
  "001101100101100",
  "101001110011010",
  "011100101100101",
  "110010110101001",
  "001011011010110",
  "100101001110011",
  "011001101001101",
  "110110010110010",
  "010110100110110",
  "101100110010101",
];
// The deck's \diagvals and \flipvals, typed by hand there and checked here.
const DECK_DIAG = "000111100011011";
const DECK_FLIP = "111000011100100";
const DIAG = BLOCK.map((row, j) => row[j]).join("");
const FLIP = DIAG.split("")
  .map((d) => (d === "0" ? "1" : "0"))
  .join("");
if (DIAG !== DECK_DIAG || FLIP !== DECK_FLIP) {
  console.error("CantorAnimation: the diagonal disagrees with the deck", DIAG, FLIP);
}
BIG_CODES.forEach((code, i) => {
  if (code.slice(0, 15) !== BLOCK[i]) {
    console.error(`CantorAnimation: code ${i + 1} is not row ${i + 1} of the block`);
  }
});

// Cantor's Tree: the two routes, as the child index taken at levels 1 to 4.
// A child with an even index is a left branch (mark 0), odd is right (1).
const GOLD_ROUTE = [1, 2, 5, 11];
const GOLD_TAIL = -1;
const AZURE_ROUTE = [0, 1, 3, 6];
const AZURE_TAIL = 1;
const routeDigits = (r: number[]) => r.map((c) => String(c % 2));
for (const r of [GOLD_ROUTE, AZURE_ROUTE]) {
  r.forEach((c, i) => {
    const parent = i === 0 ? 0 : r[i - 1];
    if (Math.floor(c / 2) !== parent) console.error("CantorAnimation: broken route", r);
  });
}

// ---- Steps -------------------------------------------------------------
type FrameId = "book" | "code" | "tree";

interface StepDef {
  frame: FrameId;
  /** The deck clicks this step shows, for the record. */
  clicks: string;
  /** Tween length in ms at 1x. */
  dur: number;
  /** Hold after the tween in ms at 1x, when playing. */
  hold: number;
}

const FRAMES: { id: FrameId; title: string }[] = [
  { id: "book", title: "Cantor’s Book" },
  { id: "code", title: "Cantor’s Code" },
  { id: "tree", title: "Cantor’s Tree" },
];

const STEPS: StepDef[] = [
  // Cantor's Book: one step per click.
  { frame: "book", clicks: "1", dur: 900, hold: 3600 },
  { frame: "book", clicks: "2", dur: 1000, hold: 2200 },
  { frame: "book", clicks: "3", dur: 900, hold: 4200 },
  { frame: "book", clicks: "4", dur: 900, hold: 2800 },
  { frame: "book", clicks: "5", dur: 700, hold: 2400 },
  { frame: "book", clicks: "6", dur: 1100, hold: 2200 },
  { frame: "book", clicks: "7", dur: 800, hold: 3400 },
  { frame: "book", clicks: "8", dur: 1200, hold: 3600 },
  { frame: "book", clicks: "9", dur: 800, hold: 5000 },
  // Cantor's Code.
  { frame: "code", clicks: "1", dur: 1100, hold: 4600 },
  { frame: "code", clicks: "2", dur: 1000, hold: 2400 },
  { frame: "code", clicks: "3", dur: 1000, hold: 2600 },
  { frame: "code", clicks: "4", dur: 1100, hold: 4200 },
  { frame: "code", clicks: "5", dur: 800, hold: 4000 },
  { frame: "code", clicks: "6", dur: 700, hold: 5000 },
  { frame: "code", clicks: "7", dur: 2000, hold: 1800 },
  { frame: "code", clicks: "8", dur: 2200, hold: 1400 },
  { frame: "code", clicks: "9–18", dur: 1600, hold: 1200 },
  { frame: "code", clicks: "19", dur: 1400, hold: 1200 },
  { frame: "code", clicks: "20–29", dur: 1300, hold: 3000 },
  // Cantor's Tree: one step per click.
  { frame: "tree", clicks: "1", dur: 600, hold: 900 },
  { frame: "tree", clicks: "2", dur: 800, hold: 900 },
  { frame: "tree", clicks: "3", dur: 800, hold: 900 },
  { frame: "tree", clicks: "4", dur: 900, hold: 900 },
  { frame: "tree", clicks: "5", dur: 1000, hold: 1000 },
  { frame: "tree", clicks: "6", dur: 800, hold: 1400 },
  { frame: "tree", clicks: "7", dur: 700, hold: 600 },
  { frame: "tree", clicks: "8", dur: 700, hold: 600 },
  { frame: "tree", clicks: "9", dur: 700, hold: 600 },
  { frame: "tree", clicks: "10", dur: 700, hold: 600 },
  { frame: "tree", clicks: "11", dur: 600, hold: 1600 },
  { frame: "tree", clicks: "12", dur: 700, hold: 800 },
  { frame: "tree", clicks: "13", dur: 700, hold: 800 },
  { frame: "tree", clicks: "14", dur: 800, hold: 800 },
  { frame: "tree", clicks: "15", dur: 900, hold: 1600 },
  { frame: "tree", clicks: "16", dur: 1100, hold: 900 },
  { frame: "tree", clicks: "17", dur: 1100, hold: 900 },
  { frame: "tree", clicks: "18", dur: 1100, hold: 900 },
  { frame: "tree", clicks: "19", dur: 1200, hold: 1800 },
  { frame: "tree", clicks: "20", dur: 1000, hold: 1600 },
  { frame: "tree", clicks: "21", dur: 1100, hold: 900 },
  { frame: "tree", clicks: "22", dur: 1100, hold: 900 },
  { frame: "tree", clicks: "23", dur: 1100, hold: 900 },
  { frame: "tree", clicks: "24", dur: 1300, hold: 3000 },
];

const FRAME_START: Record<FrameId, number> = {
  book: STEPS.findIndex((s) => s.frame === "book"),
  code: STEPS.findIndex((s) => s.frame === "code"),
  tree: STEPS.findIndex((s) => s.frame === "tree"),
};

const SPEEDS = [0.5, 1, 1.5, 2];

// ---- Drawing primitives -----------------------------------------------
interface DigProps {
  x: number;
  y: number;
  ch: string;
  fs: number;
  fill: string;
  bold?: boolean;
  opacity?: number;
  sy?: number;
  sx?: number;
}

/** A glyph centred on (x, y) in TikZ cm, as a TikZ node with inner sep 0. */
function Dig({ x, y, ch, fs, fill, bold, opacity = 1, sy = 1, sx = 1 }: DigProps) {
  if (opacity <= 0) return null;
  const cx = X(x);
  const cy = Y(y);
  const transform =
    sx !== 1 || sy !== 1
      ? `translate(${cx} ${cy}) scale(${sx} ${sy}) translate(${-cx} ${-cy})`
      : undefined;
  return (
    <text
      x={cx}
      y={cy + 0.31 * fs}
      fontSize={fs}
      fontFamily={MONO}
      fontWeight={bold ? 700 : 400}
      textAnchor="middle"
      fill={fill}
      opacity={opacity}
      transform={transform}
    >
      {ch}
    </text>
  );
}

/** Three dots in a row, the first centred at x0. */
function Dots({
  x0,
  y,
  gap,
  r,
  fill,
  opacity = 1,
  n = 3,
}: {
  x0: number;
  y: number;
  gap: number;
  r: number;
  fill: string;
  opacity?: number;
  n?: number;
}) {
  if (opacity <= 0) return null;
  return (
    <g opacity={opacity}>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={X(x0 + gap * i)} cy={Y(y)} r={r * U} fill={fill} />
      ))}
    </g>
  );
}

interface Run {
  t: string;
  c?: string;
  mono?: boolean;
}

/** A caption: lines of runs, centred at x = 0, first baseline at y0. */
function Caption({
  lines,
  y0,
  color,
  opacity,
}: {
  lines: Run[][];
  y0: number;
  color: string;
  opacity: number;
}) {
  if (opacity <= 0) return null;
  return (
    <text
      fontSize={36}
      fontFamily={SANS}
      textAnchor="middle"
      fill={color}
      opacity={opacity}
    >
      {lines.map((line, i) => (
        <tspan key={i} x={0} y={Y(y0 - 0.5 * i)}>
          {line.map((r, k) => (
            <tspan key={k} fill={r.c} fontFamily={r.mono ? MONO : undefined}>
              {r.t}
            </tspan>
          ))}
        </tspan>
      ))}
    </text>
  );
}

/** A TikZ Stealth arrowhead with its tip at (x, y), pointing along (dx, dy). */
function Stealth({
  x,
  y,
  dx,
  dy,
  len,
  fill,
  opacity = 1,
}: {
  x: number;
  y: number;
  dx: number;
  dy: number;
  len: number;
  fill: string;
  opacity?: number;
}) {
  const n = Math.hypot(dx, dy);
  const ux = dx / n;
  const uy = dy / n;
  const px = -uy;
  const py = ux;
  const w = len * 0.42;
  const tip = [x, y];
  const back = (k: number, side: number) => [x - ux * len * k + px * w * side, y - uy * len * k + py * w * side];
  const inner = [x - ux * len * 0.62, y - uy * len * 0.62];
  const pts = [tip, back(1, 1), inner, back(1, -1)]
    .map(([a, b]) => `${X(a)},${Y(b)}`)
    .join(" ");
  return <polygon points={pts} fill={fill} opacity={opacity} />;
}

// =====================================================================
//  CANTOR'S BOOK
// =====================================================================
const BOOK_DY = 0.6;
const px = (p: number) => 1.95 * (p - 3);

const BOOK_CAPTIONS: { lines: Run[][]; color: string }[] = [
  {
    lines: [
      [{ t: "Cantor has a book. There is a page 1, a page 2," }],
      [{ t: "a page 3, and the pages never run out." }],
    ],
    color: C.textwhite,
  },
  { lines: [[{ t: "Here are the first five of them." }]], color: C.textwhite },
  {
    // The deck has an em dash after "reading list"; it is a comma here.
    lines: [
      [{ t: "On every page he writes a " }, { t: "reading list", c: C.accent }, { t: "," }],
      [{ t: "a list of page numbers of this very book." }],
    ],
    color: C.textwhite,
  },
  { lines: [[{ t: "A reading list is allowed to run on forever." }]], color: C.textwhite },
  { lines: [[{ t: "It is allowed to be empty." }]], color: C.textwhite },
  { lines: [[{ t: "Every page carries one." }]], color: C.textwhite },
  {
    lines: [
      [{ t: "Here is a reading list." }],
      [{ t: "It is not on page 1, 2, 3, 4 or 5." }],
    ],
    color: C.textwhite,
  },
  {
    // The deck has an em dash after "further along"; it is a comma here.
    lines: [
      [{ t: "Perhaps it is written further along," }],
      [{ t: "on page 40, or page 900." }],
    ],
    color: C.textwhite,
  },
  {
    lines: [
      [{ t: "Can the book be filled so that every reading list" }],
      [{ t: "you can think of is written on some page?" }],
    ],
    color: C.cream,
  },
];

/** Text that is written out a character at a time as w goes 0 to 1. */
function written(s: string, w: number) {
  return s.slice(0, Math.round(s.length * clamp01(w)));
}

function BookPicture({ opacity }: { opacity: number }) {
  // \book{1-}{0}{2.12}{0.85}
  const ox = 0;
  const oy = 2.12 + BOOK_DY;
  const s = 0.85;
  const P = (x: number, y: number) => `${X(ox + s * x)},${Y(oy + s * y)}`;
  const leaves = [1, 2, 3].flatMap((j) => [
    [P(0, 0.4), P(-1.05 - 0.055 * j, 0.75 + 0.05 * j), P(-1.05 - 0.055 * j, -0.62 + 0.05 * j)],
    [P(0, 0.4), P(1.05 + 0.055 * j, 0.75 + 0.05 * j), P(1.05 + 0.055 * j, -0.62 + 0.05 * j)],
  ]);
  return (
    <g opacity={opacity} strokeLinejoin="round">
      {leaves.map((pts, i) => (
        <polyline key={i} points={pts.join(" ")} fill="none" stroke={C.navdim} strokeWidth={0.5 * PT} />
      ))}
      <polygon
        points={[P(0, 0.4), P(-1.05, 0.75), P(-1.05, -0.62), P(0, -0.3)].join(" ")}
        fill={C.lightbg}
        stroke={C.textgray}
        strokeWidth={0.9 * PT}
      />
      <polygon
        points={[P(0, 0.4), P(1.05, 0.75), P(1.05, -0.62), P(0, -0.3)].join(" ")}
        fill={C.lightbg}
        stroke={C.textgray}
        strokeWidth={0.9 * PT}
      />
      <polyline
        points={[P(-1.215, -0.47), P(-1.28, -0.78), P(0, -0.46), P(1.28, -0.78), P(1.215, -0.47)].join(" ")}
        fill="none"
        stroke={C.textgray}
        strokeWidth={1.1 * PT}
      />
    </g>
  );
}

function PageCard({ p, a }: { p: number; a: number }) {
  if (a <= 0) return null;
  const x = px(p);
  const sc = lerp(0.92, 1, easeOut(a));
  const cy = Y(-0.59 + BOOK_DY);
  return (
    <g opacity={a} transform={`translate(${X(x)} ${cy}) scale(${sc}) translate(${-X(x)} ${-cy})`}>
      <rect
        x={X(x - 0.84)}
        y={Y(0.6 + BOOK_DY)}
        width={168}
        height={238}
        rx={3 * PT}
        fill={C.lightbg}
        stroke={C.textgray}
        strokeWidth={1.0 * PT}
      />
      <text
        x={X(x)}
        y={Y(-1.58 + BOOK_DY) + 9}
        fontSize={26}
        fontFamily={SANS}
        textAnchor="middle"
        fill={C.navdim}
      >
        {p}
      </text>
    </g>
  );
}

/** What is written on page p, one or two lines, first baseline at 0.20. */
function PageText({ p, lines, w }: { p: number; lines: string[]; w: number }) {
  if (w <= 0) return null;
  const total = lines.reduce((n, l) => n + l.length, 0);
  let left = Math.round(total * clamp01(w));
  return (
    <text fontSize={28} fontFamily={SANS} textAnchor="middle" fill={C.accentcool}>
      {lines.map((l, i) => {
        const shown = l.slice(0, Math.max(0, left));
        left -= l.length;
        // Keep the line centred on its finished width while it is written.
        return (
          <tspan key={i} x={X(px(p))} y={Y(0.2 + BOOK_DY - 0.33 * i)}>
            <tspan>{shown}</tspan>
            <tspan fill="none">{l.slice(shown.length)}</tspan>
          </tspan>
        );
      })}
    </text>
  );
}

// The \hunt curve, lifted by BOOK_DY.
const HUNT = {
  p0: [-1.6, -2.48 + BOOK_DY],
  c1: [1.1, -2.78 + BOOK_DY],
  c2: [4.7, -2.4 + BOOK_DY],
  p1: [5.02, -1.0 + BOOK_DY],
};
const HUNT_D = `M ${X(HUNT.p0[0])} ${Y(HUNT.p0[1])} C ${X(HUNT.c1[0])} ${Y(HUNT.c1[1])} ${X(HUNT.c2[0])} ${Y(HUNT.c2[1])} ${X(HUNT.p1[0])} ${Y(HUNT.p1[1])}`;

function BookScene({ k, p }: { k: number; p: number }) {
  const pr = (j: number) => (k > j ? 1 : k === j ? p : 0);
  const huntP = pr(8);
  const pageDotsA = seg(pr(2), 0.75, 1);
  const goldDots = seg(huntP, 0.85, 1);
  return (
    <g>
      <BookPicture opacity={ease(pr(1))} />
      {[1, 2, 3, 4, 5].map((pg) => (
        <PageCard key={pg} p={pg} a={seg(pr(2), (pg - 1) * 0.13, (pg - 1) * 0.13 + 0.35)} />
      ))}
      {/* \pagerow's trailing dots, grey; lit gold by \liveellpage on click 8 */}
      <Dots x0={5.0} y={-0.59 + BOOK_DY} gap={0.1} r={0.022} fill={C.navdim} opacity={pageDotsA * (1 - goldDots)} />
      <Dots x0={5.0} y={-0.59 + BOOK_DY} gap={0.1} r={0.022} fill={C.accent} opacity={goldDots} />
      <PageText p={1} lines={["5, 10, 15"]} w={seg(pr(3), 0.1, 0.9)} />
      <PageText p={2} lines={["2, 4, 6,", "8, …"]} w={seg(pr(4), 0.1, 0.9)} />
      {pr(5) > 0 && (
        <line
          x1={X(px(3) - 0.22)}
          y1={Y(0.26 + BOOK_DY)}
          x2={X(px(3) - 0.22 + 0.44 * easeOut(seg(pr(5), 0.1, 0.9)))}
          y2={Y(0.26 + BOOK_DY)}
          stroke={C.accentcool}
          strokeWidth={1.1 * PT}
        />
      )}
      <PageText p={4} lines={["1, 2, 3"]} w={seg(pr(6), 0.05, 0.45)} />
      <PageText p={5} lines={["1, 4, 5, 6"]} w={seg(pr(6), 0.5, 0.95)} />
      {pr(7) > 0 && (
        <g
          opacity={ease(pr(7))}
          transform={`translate(0 ${(1 - easeOut(pr(7))) * 18})`}
        >
          <rect
            x={X(-4.74)}
            y={Y(-2.15 + BOOK_DY)}
            width={314}
            height={65}
            rx={3 * PT}
            fill={C.lightbg}
            stroke={C.accent}
            strokeWidth={1.1 * PT}
          />
          <text
            x={X(-3.17)}
            y={Y(-2.48 + BOOK_DY) + 12}
            fontSize={34}
            fontFamily={SANS}
            textAnchor="middle"
            fill={C.accent}
          >
            3, 6, 9, 12, …
          </text>
        </g>
      )}
      {huntP > 0 && (
        <g>
          <mask id="cantor-hunt-mask" maskUnits="userSpaceOnUse" x={VB.x} y={VB.y} width={VB.w} height={VB.h}>
            <path
              d={HUNT_D}
              fill="none"
              stroke="white"
              strokeWidth={12}
              pathLength={1}
              strokeDasharray="1 1"
              strokeDashoffset={1 - ease(seg(huntP, 0, 0.9))}
            />
          </mask>
          <path
            d={HUNT_D}
            fill="none"
            stroke={C.accent}
            strokeWidth={1.0 * PT}
            strokeDasharray={`${3 * PT} ${3 * PT}`}
            mask="url(#cantor-hunt-mask)"
          />
          <Stealth
            x={HUNT.p1[0]}
            y={HUNT.p1[1]}
            dx={HUNT.p1[0] - HUNT.c2[0]}
            dy={HUNT.p1[1] - HUNT.c2[1]}
            len={0.21}
            fill={C.accent}
            opacity={seg(huntP, 0.85, 1)}
          />
        </g>
      )}
      <Captions captions={BOOK_CAPTIONS} k={k} p={p} y0={-2.78} />
    </g>
  );
}

/** The caption of click k fading in over the caption of click k-1. */
function Captions({
  captions,
  k,
  p,
  y0,
}: {
  captions: { lines: Run[][]; color: string }[];
  k: number;
  p: number;
  y0: number;
}) {
  const out: ReactNode[] = [];
  const n = captions.length;
  const cur = k <= n ? captions[k - 1] : undefined;
  const prev = k - 1 >= 1 && k - 1 <= n ? captions[k - 2] : undefined;
  if (prev && p < 0.35) {
    out.push(
      <Caption key={`c${k - 1}`} lines={prev.lines} color={prev.color} y0={y0} opacity={1 - seg(p, 0, 0.3)} />,
    );
  }
  if (cur) {
    out.push(
      <Caption
        key={`c${k}`}
        lines={cur.lines}
        color={cur.color}
        y0={y0}
        opacity={prev ? seg(p, 0.3, 0.7) : seg(p, 0, 0.5)}
      />,
    );
  }
  return <g>{out}</g>;
}

// =====================================================================
//  CANTOR'S CODE
// =====================================================================
const cx = (k: number) => 0.42 * (k - 8.5) + 0.15; // \cxr
const bx = (c: number) => -5.4 + 0.31 * (c - 1); // the block's column
const by = (r: number) => 3.3 - 0.44 * (r - 1); // the block's row
const BIG_FS = 73; // \huge
const BLOCK_FS = 50; // \Large
const JOURNEY = 5.88;
const FLAT_Y = 0.22; // row 8's own height

const CODE_CAPTIONS: { lines: Run[][]; color: string }[] = [
  {
    lines: [
      [{ t: "A " }, { t: "code", c: C.accent }, { t: " is an endless row of digits," }],
      [
        { t: "each one a " },
        { t: "0", mono: true },
        { t: " or a " },
        { t: "1", mono: true },
        { t: ": one in position 1," },
      ],
      [{ t: "one in position 2, and on for ever." }],
    ],
    color: C.textwhite,
  },
  {
    lines: [[{ t: "Nothing but " }, { t: "0", mono: true }, { t: "s is a code." }]],
    color: C.textwhite,
  },
  { lines: [[{ t: "So is the row that alternates for ever." }]], color: C.textwhite },
  {
    lines: [
      [{ t: "And a code need follow no rule at all. Every digit" }],
      [{ t: "is free, and the choices need make no pattern." }],
    ],
    color: C.textwhite,
  },
  {
    // The deck has an em dash after "listing codes"; it is a comma here.
    lines: [
      [{ t: "Now suppose somebody starts listing codes," }],
      [{ t: "a first, a second, a third, and on down for ever." }],
    ],
    color: C.textwhite,
  },
  {
    lines: [
      [{ t: "They promise that every code you can think of is" }],
      [{ t: "somewhere on that list. Can that promise be kept?" }],
    ],
    color: C.cream,
  },
];

const digitInk = (d: string) => (d === "1" ? C.accentcool : C.dimdigit);

/** The gold copy of the diagonal: digit j sits at (x, y) given by place(j). */
function GoldDigits({
  vals,
  place,
  scaleY,
  opacity = () => 1,
}: {
  vals: string;
  place: (j: number) => [number, number];
  scaleY?: (j: number) => number;
  opacity?: (j: number) => number;
}) {
  return (
    <g>
      {vals.split("").map((d, j0) => {
        const [x, y] = place(j0 + 1);
        const o = opacity(j0 + 1);
        if (o <= 0) return null;
        return (
          <g key={j0} opacity={o}>
            <rect x={X(x - 0.155)} y={Y(y + 0.22)} width={31} height={40} fill={C.darkbg} />
            <Dig x={x} y={y} ch={d} fs={BLOCK_FS} fill={C.accent} bold sy={scaleY ? scaleY(j0 + 1) : 1} />
          </g>
        );
      })}
    </g>
  );
}

/** \diagtail: three gold dots after the 15th digit, shifted and flattened. */
function DiagTail({ shift, f, opacity = 1 }: { shift: number; f: number; opacity?: number }) {
  if (opacity <= 0) return null;
  return (
    <g opacity={opacity}>
      {[1, 2, 3].map((i) => {
        const x = -1.06 + shift + (0.155 + 0.095 * f) * i;
        const y = (1 - f) * -2.86 + f * FLAT_Y - (1 - f) * 0.22 * i;
        return (
          <g key={i}>
            <circle cx={X(x)} cy={Y(y)} r={10.5} fill={C.darkbg} />
            <circle cx={X(x)} cy={Y(y)} r={6} fill={C.accent} />
          </g>
        );
      })}
    </g>
  );
}

function CodeScene({ k, p }: { k: number; p: number }) {
  const pr = (j: number) => (k > j ? 1 : k === j ? p : 0);
  const out: ReactNode[] = [];

  // ---- Clicks 1 to 6, and the move into the block on click 7 ----------
  const m = pr(7); // the move: 0 before click 7, 1 after it
  const fadeOld = 1 - seg(m, 0, 0.18); // what does not become the block
  const move = ease(seg(m, 0.12, 0.6)); // big rows gliding into rows 1 to 5
  const later = (r: number) => seg(m, 0.5 + (r - 6) * 0.03, 0.62 + (r - 6) * 0.03); // rows 6 to 15

  if (k < 7 || (k === 7 && m < 1)) {
    BIG_CODES.forEach((code, r) => {
      const arrive = pr(BIG_ARRIVES[r]);
      if (arrive <= 0) return;
      const typed = seg(arrive, 0.05, 0.85);
      code.split("").forEach((d, i) => {
        const pos = i + 1;
        const a = seg(typed * 16, i, i + 1); // left to right
        if (a <= 0) return;
        const x = lerp(cx(pos), bx(pos), move);
        const y = lerp(BIG_ROW_Y[r], by(r + 1), move);
        const fs = lerp(BIG_FS, BLOCK_FS, move);
        const o = pos === 16 ? a * fadeOld : a;
        out.push(<Dig key={`b${r}-${i}`} x={x} y={y} ch={d} fs={fs} fill={digitInk(d)} opacity={o} />);
      });
      // \ldots after the sixteenth digit
      out.push(
        <Dots
          key={`bt${r}`}
          x0={cx(17) + 0.08}
          y={BIG_ROW_Y[r] - 0.02}
          gap={0.15}
          r={0.03}
          fill={C.dimdigit}
          opacity={seg(arrive, 0.85, 1) * fadeOld}
        />,
      );
    });
    // the names, and the dots that carry the list on down
    const names = ease(pr(5)) * fadeOld;
    if (names > 0) {
      BIG_ROW_Y.forEach((y, r) =>
        out.push(
          <text
            key={`n${r}`}
            x={X(-3.62) - 6}
            y={Y(y) + 9}
            fontSize={26}
            fontFamily={SANS}
            textAnchor="end"
            fill={C.textgray}
            opacity={names}
          >
            code {r + 1}
          </text>,
        ),
      );
    }
    const gold = seg(pr(6), 0, 0.5);
    [-1.25, -1.43, -1.61].forEach((y, i) => {
      out.push(
        <circle key={`e${i}`} cx={X(0.15)} cy={Y(y)} r={5.5} fill={C.navdim} opacity={names * (1 - gold)} />,
        <circle key={`eg${i}`} cx={X(0.15)} cy={Y(y)} r={5.5} fill={C.accent} opacity={names * gold} />,
      );
    });
    out.push(
      <g key="caps" opacity={fadeOld}>
        <Captions captions={CODE_CAPTIONS} k={Math.min(k, 6)} p={k <= 6 ? p : 1} y0={-2.42} />
      </g>,
    );
  }

  // ---- The block, from click 7 ----------------------------------------
  if (k >= 7) {
    const blockIn = (r: number) => (r <= 5 ? (k > 7 ? 1 : seg(m, 0.55, 0.7)) : later(r));
    // the dashed divider down the middle
    out.unshift(
      <line
        key="div"
        x1={0}
        y1={Y(-3.75)}
        x2={0}
        y2={Y(3.55)}
        stroke={C.divider}
        strokeWidth={0.7 * PT}
        strokeDasharray={`${2.5 * PT} ${3 * PT}`}
        opacity={seg(m, 0.6, 0.9)}
      />,
    );
    BLOCK.forEach((row, r0) => {
      const r = r0 + 1;
      // Rows 1 to 5 are drawn by the gliding big codes while click 7 runs.
      if (k > 7 || m >= 1 || r > 5) {
        const a = r <= 5 ? 1 : later(r);
        row.split("").forEach((d, c0) =>
          out.push(
            <Dig key={`k${r}-${c0}`} x={bx(c0 + 1)} y={by(r)} ch={d} fs={BLOCK_FS} fill={digitInk(d)} opacity={a} />,
          ),
        );
      }
      out.push(
        <Dots key={`kt${r}`} x0={-0.75 + 0.06} y={by(r) - 0.02} gap={0.1} r={0.022} fill={C.dimdigit} opacity={blockIn(r)} />,
      );
    });
    // \listdots: the list goes on down
    [-3.24, -3.42, -3.6].forEach((y, i) =>
      out.push(<circle key={`ld${i}`} cx={X(-3.23)} cy={Y(y)} r={5.5} fill={C.navdim} opacity={seg(m, 0.85, 1)} />),
    );
  }

  // ---- Click 8: the diagonal lights, one digit at a time --------------
  if (k >= 8) {
    const lit = pr(8);
    out.push(
      <GoldDigits
        key="diag"
        vals={DIAG}
        place={(j) => [bx(j), by(j)]}
        opacity={(j) => seg(lit, (j - 1) * 0.055, (j - 1) * 0.055 + 0.08)}
      />,
      <DiagTail key="dtail" shift={0} f={0} opacity={seg(lit, 0.86, 1)} />,
    );
  }

  // ---- Clicks 9 to 29: the copy crosses, flips, and stands up --------
  if (k >= 9) {
    const shift = JOURNEY * ease(pr(9));
    const flip = pr(10);
    const flat = ease(pr(11));
    const flipT = (j: number) => seg(flip, (j - 1) * 0.045, (j - 1) * 0.045 + 0.35);
    const vals = DIAG.split("")
      .map((d, j0) => (flipT(j0 + 1) >= 0.5 ? FLIP[j0] : d))
      .join("");
    out.push(
      <GoldDigits
        key="copy"
        vals={vals}
        place={(j) => [bx(j) + shift, lerp(by(j), FLAT_Y, flat)]}
        scaleY={(j) => {
          const t = flipT(j);
          return t <= 0 || t >= 1 ? 1 : Math.max(0.02, Math.abs(Math.cos(Math.PI * t)));
        }}
        opacity={() => 1}
      />,
      <DiagTail key="ctail" shift={shift} f={flat} />,
    );
  }

  return <g>{out}</g>;
}

// =====================================================================
//  CANTOR'S TREE
// =====================================================================
const tnx = (L: number, i: number) => -4.9 + (9.8 * (i + 0.5)) / 2 ** L;
const tny = (L: number) => 3.3 - 0.95 * L;
const GOLD_CODE_Y = -1.85;
const AZURE_CODE_Y = -2.95;
const tcx = (pos: number) => -1.46 + 0.55 * (pos - 1);
const TREE_CODE_FS = 50; // \Large
const MARK_FS = 28; // \scriptsize

/** Midpoint of the branch from (L, i) down to its child c. */
const markAt = (L: number, i: number, c: number): [number, number] => [
  0.5 * (tnx(L, i) + tnx(L + 1, c)),
  0.5 * (tny(L) + tny(L + 1)),
];

function Branch({
  L,
  i,
  c,
  g,
  stroke,
  width,
}: {
  L: number;
  i: number;
  c: number;
  g: number;
  stroke: string;
  width: number;
}) {
  if (g <= 0) return null;
  const x1 = tnx(L, i);
  const y1 = tny(L);
  const x2 = lerp(x1, tnx(L + 1, c), g);
  const y2 = lerp(y1, tny(L + 1), g);
  return <line x1={X(x1)} y1={Y(y1)} x2={X(x2)} y2={Y(y2)} stroke={stroke} strokeWidth={width} strokeLinecap="round" />;
}

function TreeCode({ y, pos, d, fill, opacity = 1 }: { y: number; pos: number; d: string; fill: string; opacity?: number }) {
  if (opacity <= 0) return null;
  const x = tcx(pos);
  return (
    <g opacity={opacity}>
      <rect x={X(x - 0.2)} y={Y(y + 0.26)} width={40} height={48} fill={C.darkbg} />
      <Dig x={x} y={y} ch={d} fs={TREE_CODE_FS} fill={fill} bold />
    </g>
  );
}

function TreeScene({ k, p }: { k: number; p: number }) {
  const pr = (j: number) => (k > j ? 1 : k === j ? p : 0);
  const lines: ReactNode[] = [];
  const nodes: ReactNode[] = [];
  const marks: ReactNode[] = [];
  const lit: ReactNode[] = [];
  const codes: ReactNode[] = [];

  // ---- Clicks 1 to 6: the tree, a level at a time ---------------------
  const root = easeOut(pr(1));
  if (root > 0) {
    nodes.push(<circle key="root" cx={X(tnx(0, 0))} cy={Y(tny(0))} r={7.5 * root} fill={C.textgray} />);
  }
  for (let L = 0; L < 4; L++) {
    const g = pr(2 + L);
    if (g <= 0) continue;
    const grow = ease(seg(g, 0, 0.85));
    for (let i = 0; i < 2 ** L; i++) {
      for (const c of [2 * i, 2 * i + 1]) {
        lines.push(<Branch key={`e${L}-${c}`} L={L} i={i} c={c} g={grow} stroke={C.tedge} width={0.5 * PT * 1.6} />);
        const pop = seg(g, 0.75, 1);
        if (pop > 0) {
          nodes.push(<circle key={`n${L + 1}-${c}`} cx={X(tnx(L + 1, c))} cy={Y(tny(L + 1))} r={5 * pop} fill={C.tnode} />);
        }
      }
    }
  }
  const stubs = ease(pr(6));
  if (stubs > 0) {
    for (let i = 0; i < 16; i++) {
      for (const s of [-1, 1]) {
        const x1 = tnx(4, i);
        const y1 = tny(4);
        lines.push(
          <line
            key={`s${i}${s}`}
            x1={X(x1)}
            y1={Y(y1)}
            x2={X(lerp(x1, x1 + s * 0.155, stubs))}
            y2={Y(lerp(y1, -0.95, stubs))}
            stroke={C.tedge}
            strokeWidth={0.5 * PT * 1.6}
          />,
        );
      }
    }
  }

  // ---- Route lines: gold on clicks 7 to 11, azure on 21 to 24 ---------
  const routeLines = (
    route: number[],
    tailDx: number,
    color: string,
    growOf: (L: number) => number,
    tailGrow: number,
    key: string,
  ) => {
    route.forEach((c, L) => {
      const parent = L === 0 ? 0 : route[L - 1];
      lines.push(<Branch key={`${key}${L}`} L={L} i={parent} c={c} g={growOf(L)} stroke={color} width={1.8 * PT} />);
    });
    if (tailGrow > 0) {
      const x1 = tnx(4, route[3]);
      const y1 = tny(4);
      lines.push(
        <line
          key={`${key}t`}
          x1={X(x1)}
          y1={Y(y1)}
          x2={X(lerp(x1, x1 + tailDx * 0.155, tailGrow))}
          y2={Y(lerp(y1, -0.95, tailGrow))}
          stroke={color}
          strokeWidth={1.8 * PT}
          strokeDasharray={`${3 * PT} ${3 * PT}`}
        />,
      );
    }
  };
  routeLines(GOLD_ROUTE, GOLD_TAIL, C.accent, (L) => ease(pr(7 + L)), ease(pr(11)), "g");
  // Azure: the digit lights first, then the branch it names grows.
  routeLines(
    AZURE_ROUTE,
    AZURE_TAIL,
    C.accentcool,
    (L) => ease(seg(pr(21 + L), 0.3, 0.8)),
    ease(seg(pr(24), 0.82, 1)),
    "a",
  );

  // ---- Clicks 12 to 15: every mark, a level of forks at a time --------
  for (let L = 0; L < 4; L++) {
    const g = pr(12 + L);
    if (g <= 0) continue;
    const n = 2 ** (L + 1);
    for (let c = 0; c < n; c++) {
      const i = Math.floor(c / 2);
      const a = easeOut(seg(g, (c / n) * 0.5, (c / n) * 0.5 + 0.5));
      if (a <= 0) continue;
      const [x, y] = markAt(L, i, c);
      marks.push(
        <g key={`m${L}-${c}`} opacity={a}>
          <circle cx={X(x)} cy={Y(y)} r={11.5} fill={C.darkbg} />
          <Dig x={x} y={y} ch={String(c % 2)} fs={MARK_FS} fill={C.dimdigit} />
        </g>,
      );
    }
  }

  const litMark = (L: number, c: number, color: string, a: number, key: string) => {
    if (a <= 0) return;
    const parent = Math.floor(c / 2);
    const [x, y] = markAt(L, parent, c);
    lit.push(
      <g key={key} opacity={a}>
        <circle cx={X(x)} cy={Y(y)} r={12.5} fill={C.darkbg} />
        <Dig x={x} y={y} ch={String(c % 2)} fs={MARK_FS} fill={color} bold />
      </g>,
    );
  };

  // ---- Clicks 16 to 19: GOLD. The route's mark lights, then drops ----
  const gd = routeDigits(GOLD_ROUTE);
  GOLD_ROUTE.forEach((c, L) => {
    const g = pr(16 + L);
    litMark(L, c, C.accent, seg(g, 0, 0.25), `gl${L}`);
    if (g <= 0) return;
    const fly = ease(seg(g, 0.25, 0.95));
    if (fly <= 0) return;
    const [mx, my] = markAt(L, L === 0 ? 0 : GOLD_ROUTE[L - 1], c);
    if (fly < 1) {
      const x = lerp(mx, tcx(L + 1), fly);
      const y = lerp(my, GOLD_CODE_Y, fly);
      codes.push(<Dig key={`gf${L}`} x={x} y={y} ch={gd[L]} fs={lerp(MARK_FS, TREE_CODE_FS, fly)} fill={C.accent} bold />);
    } else {
      codes.push(<TreeCode key={`gc${L}`} y={GOLD_CODE_Y} pos={L + 1} d={gd[L]} fill={C.accent} />);
    }
  });
  const goldTail = seg(pr(19), 0.9, 1);
  if (goldTail > 0) {
    codes.push(<Dots key="gt" x0={0.19 + 0.42} y={GOLD_CODE_Y} gap={0.42} r={0.06} fill={C.accent} opacity={goldTail} />);
  }

  // ---- Click 20: an azure code written out dim; 21 to 24 it steers ---
  const ad = routeDigits(AZURE_ROUTE);
  const written20 = pr(20);
  if (written20 > 0) {
    ad.forEach((d, i) => {
      const a = seg(written20, i * 0.18, i * 0.18 + 0.25);
      codes.push(<TreeCode key={`ad${i}`} y={AZURE_CODE_Y} pos={i + 1} d={d} fill={C.dimdigit} opacity={a} />);
    });
    const tailA = seg(written20, 0.75, 1);
    const tailLit = seg(pr(24), 0.85, 1);
    codes.push(
      <Dots key="adt" x0={0.19 + 0.42} y={AZURE_CODE_Y} gap={0.42} r={0.06} fill={C.dimdigit} opacity={tailA * (1 - tailLit)} />,
      <Dots key="alt" x0={0.19 + 0.42} y={AZURE_CODE_Y} gap={0.42} r={0.06} fill={C.accentcool} opacity={tailLit} />,
    );
  }
  AZURE_ROUTE.forEach((c, L) => {
    const g = pr(21 + L);
    if (g <= 0) return;
    const on = seg(g, 0, 0.3);
    // A brief swell while the digit lights, so the eye finds it first.
    const swell = 1 + 0.18 * Math.sin(Math.PI * on);
    const x = tcx(L + 1);
    codes.push(
      <g key={`al${L}`} opacity={on}>
        <rect x={X(x - 0.2)} y={Y(AZURE_CODE_Y + 0.26)} width={40} height={48} fill={C.darkbg} />
        <Dig x={x} y={AZURE_CODE_Y} ch={ad[L]} fs={TREE_CODE_FS} fill={C.accentcool} bold sx={swell} sy={swell} />
      </g>,
    );
    litMark(L, c, C.accentcool, seg(g, 0.75, 0.95), `alm${L}`);
  });

  return (
    <g>
      {lines}
      {nodes}
      {marks}
      {lit}
      {codes}
    </g>
  );
}

// =====================================================================
//  The component
// =====================================================================
function frameOf(step: number) {
  return STEPS[step].frame;
}

export default function CantorAnimation() {
  const N = STEPS.length;
  const [view, setView] = useState({ step: 0, p: 1 });
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [reduced, setReduced] = useState(false);

  const viewRef = useRef(view);
  viewRef.current = view;
  const holdRef = useRef(0);

  // Reduced motion, and the ?cantorStep=N link.
  useEffect(() => {
    // Ask for the typewriter face now, so the first digits do not flash in
    // a fallback font.
    document.fonts?.load('50px "KaTeX_Typewriter"').catch(() => {});
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    const raw = new URLSearchParams(window.location.search).get("cantorStep");
    const n = raw === null ? NaN : parseInt(raw, 10);
    if (Number.isFinite(n)) {
      setView({ step: Math.max(0, Math.min(N - 1, n - 1)), p: 1 });
    } else if (!mq.matches) {
      setView({ step: 0, p: 0 });
    }
    return () => mq.removeEventListener?.("change", onChange);
  }, [N]);

  const goTo = useCallback(
    (step: number, tween: boolean) => {
      holdRef.current = 0;
      setView({ step: Math.max(0, Math.min(N - 1, step)), p: tween && !reduced ? 0 : 1 });
    },
    [N, reduced],
  );

  // One loop drives both the tween and, when playing, the hold before the
  // next step. Progress is advanced by elapsed time times the speed, so a
  // change of speed in mid-move does not make anything jump.
  useEffect(() => {
    if (!playing && view.p >= 1) return;
    let raf = 0;
    let last = performance.now();
    const speed = SPEEDS[speedIdx];
    const tick = (now: number) => {
      const dt = Math.min(100, now - last) * speed;
      last = now;
      const v = viewRef.current;
      if (v.p < 1) {
        const np = reduced ? 1 : Math.min(1, v.p + dt / STEPS[v.step].dur);
        if (np >= 1) holdRef.current = 0;
        setView({ step: v.step, p: np });
      } else if (playing) {
        holdRef.current += dt;
        if (holdRef.current >= STEPS[v.step].hold) {
          holdRef.current = 0;
          if (v.step < N - 1) {
            setView({ step: v.step + 1, p: reduced ? 1 : 0 });
          } else {
            setPlaying(false);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speedIdx, reduced, view.p >= 1, N]);

  const next = useCallback(() => {
    const v = viewRef.current;
    if (v.step < N - 1) goTo(v.step + 1, true);
    else setView({ step: v.step, p: 1 });
  }, [N, goTo]);
  // Back jumps straight to the end of the step before: no tween backwards.
  const prev = useCallback(() => {
    setPlaying(false);
    goTo(viewRef.current.step - 1, false);
  }, [goTo]);
  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const v = viewRef.current;
    if (v.step >= N - 1 && v.p >= 1) goTo(0, true);
    else if (v.p >= 1) goTo(v.step + 1, true);
    setPlaying(true);
  }, [N, goTo, playing]);
  const restart = useCallback(() => {
    setPlaying(false);
    goTo(0, true);
  }, [goTo]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setPlaying(false);
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === " " || e.key === "Spacebar") {
      // A focused button handles its own Space press.
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      togglePlay();
    }
  };

  const frame = frameOf(view.step);
  const k = view.step - FRAME_START[frame] + 1; // the step's place in its frame
  const title = FRAMES.find((f) => f.id === frame)!.title;
  // The banner title fades in when a frame opens.
  const bannerA = k === 1 ? seg(view.p, 0, 0.4) : 1;

  return (
    <div
      className="not-prose"
      tabIndex={0}
      onKeyDown={onKey}
      aria-label="Cantor's Book, Cantor's Code and Cantor's Tree, animated. Right and Left arrows step, Space plays or pauses."
      style={{
        background: C.darkbg,
        borderRadius: 10,
        border: `1px solid ${C.darkerbg}`,
        overflow: "hidden",
        margin: "1.5rem 0",
        outlineColor: C.accent,
        color: C.textgray,
      }}
    >
      <svg
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        width="100%"
        style={{ display: "block" }}
        role="img"
        aria-label={`${title}, step ${view.step + 1} of ${N}`}
      >
        <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill={C.darkbg} />
        <rect x={VB.x} y={VB.y} width={VB.w} height={BANNER_BOTTOM - VB.y} fill={C.darkerbg} />
        <text
          x={VB.x + 36}
          y={-412}
          fontSize={48}
          fontFamily={HEAD}
          fontWeight={700}
          fill={C.heading}
          opacity={bannerA}
        >
          {title}
        </text>
        {frame === "book" && <BookScene k={k} p={view.p} />}
        {frame === "code" && <CodeScene k={k} p={view.p} />}
        {frame === "tree" && <TreeScene k={k} p={view.p} />}
      </svg>
      <Controls
        step={view.step}
        n={N}
        playing={playing}
        frame={frame}
        speedIdx={speedIdx}
        onRestart={restart}
        onPrev={prev}
        onPlay={togglePlay}
        onNext={() => {
          setPlaying(false);
          next();
        }}
        onFrame={(f) => {
          setPlaying(false);
          goTo(FRAME_START[f], true);
        }}
        onSpeed={setSpeedIdx}
      />
    </div>
  );
}

// ---- Controls ----------------------------------------------------------
function btn(active = false, enabled = true): CSSProperties {
  return {
    padding: "5px 11px",
    fontSize: 13,
    lineHeight: 1.2,
    borderRadius: 5,
    border: `1px solid ${active ? C.accent : "rgb(52,58,68)"}`,
    background: active ? "rgba(220,180,100,0.14)" : C.lightbg,
    color: !enabled ? C.navdim : active ? C.accent : C.textgray,
    cursor: enabled ? "pointer" : "default",
    fontFamily: SANS,
    opacity: enabled ? 1 : 0.55,
  };
}

function Controls({
  step,
  n,
  playing,
  frame,
  speedIdx,
  onRestart,
  onPrev,
  onPlay,
  onNext,
  onFrame,
  onSpeed,
}: {
  step: number;
  n: number;
  playing: boolean;
  frame: FrameId;
  speedIdx: number;
  onRestart: () => void;
  onPrev: () => void;
  onPlay: () => void;
  onNext: () => void;
  onFrame: (f: FrameId) => void;
  onSpeed: (i: number) => void;
}) {
  const group: CSSProperties = { display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" };
  const label: CSSProperties = { fontSize: 12, color: C.navdim, fontFamily: SANS, marginRight: 2 };
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "10px 18px",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: C.darkerbg,
        borderTop: "1px solid rgb(40,45,54)",
      }}
    >
      <div style={group}>
        <button type="button" style={btn()} onClick={onRestart} aria-label="Restart" title="Restart">
          {"↺"}
        </button>
        <button type="button" style={btn(false, step > 0)} disabled={step === 0} onClick={onPrev} aria-label="Step back" title="Step back (Left arrow)">
          {"◀"}
        </button>
        <button type="button" style={{ ...btn(playing), minWidth: 64 }} onClick={onPlay} aria-label={playing ? "Pause" : "Play"} title="Play or pause (Space)">
          {playing ? "❚❚ Pause" : "▶ Play"}
        </button>
        <button type="button" style={btn(false, step < n - 1)} disabled={step >= n - 1} onClick={onNext} aria-label="Step forward" title="Step forward (Right arrow)">
          {"▶"}
        </button>
        <span style={{ ...label, marginLeft: 6, fontVariantNumeric: "tabular-nums" }}>
          {step + 1} / {n}
        </span>
      </div>
      <div style={group} role="group" aria-label="Scene">
        {FRAMES.map((f) => (
          <button key={f.id} type="button" style={btn(frame === f.id)} onClick={() => onFrame(f.id)} aria-pressed={frame === f.id}>
            {f.title}
          </button>
        ))}
      </div>
      <div style={group} role="group" aria-label="Speed">
        <span style={label}>Speed</span>
        {SPEEDS.map((s, i) => (
          <button key={s} type="button" style={btn(speedIdx === i)} onClick={() => onSpeed(i)} aria-pressed={speedIdx === i}>
            {s === 0.5 ? "½×" : `${s}×`}
          </button>
        ))}
      </div>
    </div>
  );
}
