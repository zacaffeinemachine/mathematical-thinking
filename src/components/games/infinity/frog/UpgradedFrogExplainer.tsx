import { useEffect, useMemo, useState } from "react";
import {
  diagonalPair,
  diagonalPlace,
  fmt,
  frogPad,
  ordinal,
  pairsBeforeDiagonal,
  runningSum,
  shotAt,
} from "./listing";
import type { Pair } from "./listing";
import { Controls, Drop, FrogGlyph, FrogStyle, PairGrid, PondAxis, Splash, useNarrow } from "./parts";
import { ease, lerp, seg, useTimeline } from "./useTimeline";

// =====================================================================
//  The upgraded frog, played out (Chapters/Infinity.tex, "Taming the
//  two-dimensional infinity").
//
//  Two linked views. Above, the grid of pairs (starting offset along the
//  bottom, jump size up the side, (1,1) in the corner as in the book's
//  figure) with the shooter's thread walking the diagonals, one pair per
//  time. Below, the pond: the frog on pad d + t k, and the shot going to
//  the pad d_n + n k_n that the current pair predicts.
//
//  The book's frog picks two NATURAL numbers, so both are at least 1, and
//  the frog sits on pad d before the clock starts. Negative values belong
//  to Exercise 1 (Hopper), which the page sets and does not solve, so they
//  are left out here on purpose.
//
//  Within a step: the thread grows to the next pair (p 0 to 0.55) while
//  the frog hops (0 to 0.4) and the pond rescales (0 to 0.3); the aim
//  appears (0.35), the drop falls (0.5 to 0.8) and lands (0.8 to 1).
//
//  ?ufD=4&ufK=3&ufT=18 opens on that frog at that time, for screenshots.
// =====================================================================

const W = 8; // starting offsets 1..W in the picture, and on the frog's dials
const H = 6; // jump sizes 1..H
const MAXT = 20000;
const ASK_MAX = 99;
const SPEEDS = [0.5, 1, 2, 4, 8];

const PV = { w: 1000, h: 236 };
const LINE_Y = 168;
const X0 = 46;
const X1 = 920;

const padsWord = (n: number) => (n === 1 ? "pair" : "pairs");

export default function UpgradedFrogExplainer() {
  const [frog, setFrog] = useState<Pair>({ d: 4, k: 3 });
  const own = diagonalPlace(frog);
  // Every time up to the frog's own place at which a shot lands on it. The
  // last is its own place; any before that is a lucky splash on a frog the
  // shooter was not aiming at.
  const hits = useMemo(() => {
    const out: number[] = [];
    for (let t = 1; t <= own; t++) if (shotAt("diagonal", t) === frogPad(frog, t)) out.push(t);
    return out;
  }, [frog, own]);
  const tl = useTimeline({ max: MAXT, pauseAt: hits, dur: 760, hold: 340, speeds: SPEEDS });
  const { n, p } = tl;

  const narrow = useNarrow();
  const fs = narrow ? 1.6 : 1;
  const [askD, setAskD] = useState("");
  const [askK, setAskK] = useState("");

  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const d = parseInt(q.get("ufD") ?? "", 10);
    const k = parseInt(q.get("ufK") ?? "", 10);
    const t = parseInt(q.get("ufT") ?? "", 10);
    if (d >= 1 && d <= W && k >= 1 && k <= H) setFrog({ d, k });
    if (t >= 0) setPending(t);
  }, []);
  useEffect(() => {
    if (pending === null) return;
    tl.jump(pending);
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const setFrogTo = (f: Pair) => {
    setFrog(f);
    tl.jump(0);
  };
  const random = () => {
    let f = frog;
    while (f.d === frog.d && f.k === frog.k) f = { d: 1 + Math.floor(Math.random() * W), k: 1 + Math.floor(Math.random() * H) };
    setFrogTo(f);
  };

  // ---- The pond at this moment ----
  const cur = n >= 1 ? diagonalPair(n) : null;
  const target = n >= 1 ? shotAt("diagonal", n) : 0;
  const frogNow = frogPad(frog, n);
  const frogBefore = n >= 1 ? frogPad(frog, n - 1) : frogNow;
  const span = (t: number) => (t <= 0 ? Math.max(20, frog.d) : Math.max(20, frogPad(frog, t), shotAt("diagonal", t)));
  const hi = lerp(span(n - 1), span(n), n >= 1 ? ease(seg(p, 0, 0.3)) : 1) * 1.1;
  const X = (pad: number) => X0 + ((X1 - X0) * pad) / hi;
  const hop = n >= 1 ? ease(seg(p, 0, 0.4)) : 1;
  const fx = lerp(X(frogBefore), X(frogNow), hop);
  const hopH = Math.min(90, 20 + 0.3 * Math.abs(X(frogNow) - X(frogBefore)));
  const fy = LINE_Y - 22 - (n >= 1 ? hopH * Math.sin(Math.PI * hop) : 0);
  const aim = n >= 1 ? seg(p, 0.35, 0.5) : 0;
  const fall = n >= 1 ? seg(p, 0.5, 0.8) : 0;
  const landed = n >= 1 && p >= 0.8;
  const impact = seg(p, 0.8, 1);
  const hitNow = n >= 1 && target === frogNow;
  const firstHit = hits[0];
  const soaked = n > firstHit || (n === firstHit && landed);
  const ownLanded = n > own || (n === own && landed);
  const dropY = lerp(30, LINE_Y - 28, fall * fall);
  const anchor = (x: number) => (x > 820 ? "end" : x < 150 ? "start" : "middle");

  // ---- Words ----
  const inPicture = (q: Pair) => q.d <= W && q.k <= H;
  let line1: string;
  let line2 = "";
  let line3 = "";
  if (n === 0 || !cur) {
    line1 = `Before the clock starts. Your frog has starting offset ${frog.d} and jump size ${frog.k}, so it sits on pad ${frog.d}.`;
    line2 = "The shooter's sheet is already written, and the shooter does not know the frog's pair.";
    line3 = `Press play to walk the list. Your frog's pair (${frog.d}, ${frog.k}) comes up at time ${own}.`;
  } else {
    line1 = `Time ${n}: aiming at the frog with starting offset ${cur.d} and jump size ${cur.k}. That frog would be on pad ${cur.d} + ${n} × ${cur.k} = ${fmt(target)}.`;
    if (!inPicture(cur)) line1 += ` The pair (${cur.d}, ${cur.k}) is off the edge of the picture.`;
    if (landed) {
      line2 = `Your frog, with starting offset ${frog.d} and jump size ${frog.k}, is on pad ${frog.d} + ${n} × ${frog.k} = ${fmt(frogNow)}`;
      line2 += hitNow ? " too. Splash!" : ". Miss.";
    }
    if (n < own) {
      line3 =
        landed && hitNow
          ? `The shooter was aiming at a different frog, and yours happened to be on the same pad. The list reaches your frog's own pair at time ${own}, so the plan does not depend on luck.`
          : n > firstHit
            ? `Your frog is already wet, by luck, from time ${firstHit}. Its own pair (${frog.d}, ${frog.k}) comes up at time ${own}.`
            : `Your frog's pair (${frog.d}, ${frog.k}) comes up at time ${own}.`;
    } else if (n === own) {
      line3 = landed
        ? `Time ${own} is where the list reaches your frog's own pair, so the shooter aims at exactly the pad your frog is on. Whatever pair the frog picks, it is soaked at the time its pair comes up.`
        : `This is your frog's own pair.`;
    } else {
      line3 = `Your frog was soaked at time ${firstHit}. The sheet goes on, one pair per time, for every other frog.`;
    }
  }

  // ---- The question "at which time is this pair tested?" ----
  const ad = parseInt(askD, 10);
  const ak = parseInt(askK, 10);
  const askOk = ad >= 1 && ak >= 1 && ad <= ASK_MAX && ak <= ASK_MAX;
  const ask: Pair | null = askOk ? { d: ad, k: ak } : null;
  let askText = "";
  let askTime = 0;
  if (ask) {
    const s = ask.d + ask.k;
    const before = pairsBeforeDiagonal(s);
    askTime = before + ask.k;
    const pad = fmt(frogPad(ask, askTime));
    const shoot = `by shooting at pad ${ask.d} + ${askTime} × ${ask.k} = ${pad}`;
    if (s === 2) {
      askText = `The pair (1, 1) is the first pair of the list, so the shooter tests it at time 1, ${shoot}.`;
    } else {
      const terms = Array.from({ length: s - 2 }, (_, i) => i + 1);
      const held = s === 3 ? "The diagonal before it holds 1 pair." : `The diagonals before it hold ${runningSum(terms)} = ${fmt(before)} pairs.`;
      askText =
        `The pair (${ask.d}, ${ask.k}) lies on the diagonal of pairs whose two numbers add up to ${s}. That diagonal holds ${s - 1} ${padsWord(s - 1)}. ${held} ` +
        `Along its own diagonal it comes ${ordinal(ask.k)}, because its jump size is ${ask.k}. ` +
        `So the shooter tests it at time ${fmt(before)} + ${ask.k} = ${fmt(askTime)}, ${shoot}.`;
    }
  }

  return (
    <div
      className="frogx not-prose"
      tabIndex={0}
      onKeyDown={tl.onKeyDown}
      aria-label="The upgraded frog, played out. Right and Left arrows step, Space plays or pauses, Home resets."
    >
      <FrogStyle />
      <div className="fx-pick">
        <span className="fx-label">The frog's secret pair</span>
        <Dial label="starting offset" value={frog.d} lo={1} hi={W} onChange={(d) => setFrogTo({ ...frog, d })} />
        <Dial label="jump size" value={frog.k} lo={1} hi={H} onChange={(k) => setFrogTo({ ...frog, k })} />
        <button type="button" className="fx-btn" onClick={random}>
          Pick at random
        </button>
      </div>

      <div style={{ padding: "8px 10px 0" }}>
        <PairGrid
          order="diagonal"
          W={W}
          H={H}
          n={n}
          p={p}
          frog={frog}
          soaked={ownLanded || soaked}
          splash={n === own ? impact : 0}
          query={ask}
          fs={fs}
          onCell={(q) => {
            setAskD(String(q.d));
            setAskK(String(q.k));
          }}
          label={`The grid of pairs, with the shooter's path along the diagonals. Time ${n}.${cur ? ` The current pair is (${cur.d}, ${cur.k}).` : ""}`}
        />
      </div>

      <svg viewBox={`0 0 ${PV.w} ${PV.h}`} role="img" aria-label={`The pond at time ${n}. Your frog is on pad ${frogNow}.${n >= 1 ? ` The shot goes to pad ${target}.` : ""}`}>
        <PondAxis hi={hi} x0={X0} x1={X1} y={LINE_Y} most={8} fs={fs} />
        {n >= 1 && aim > 0 && (
          <g opacity={aim * (landed && !hitNow ? 1 - 0.5 * impact : 1)}>
            <line x1={X(target)} x2={X(target)} y1={26 + 18 * fs} y2={LINE_Y - 12} stroke="var(--fx-thread)" strokeWidth={2.5} strokeDasharray="7 7" />
            <text x={X(target)} y={14 + 18 * fs} fontSize={21 * fs} fill="var(--fx-thread)" textAnchor={anchor(X(target))} fontWeight={600} className="fx-num">
              {`aim at pad ${fmt(target)}`}
            </text>
          </g>
        )}
        {n >= 1 && fall > 0 && !landed && <Drop x={X(target)} y={dropY} r={10} />}
        {n >= 1 && landed && !hitNow && <Splash x={X(target)} y={LINE_Y} r={15} t={impact} />}
        <FrogGlyph x={fx} y={fy} r={20 * Math.sqrt(fs)} soaked={soaked} />
        {n >= 1 && landed && hitNow && <Splash x={X(frogNow)} y={LINE_Y - 12} r={24} t={impact} big />}
        <text
          x={fx}
          y={LINE_Y - 40 - 16 * fs - (n >= 1 ? hopH * Math.sin(Math.PI * hop) : 0)}
          fontSize={19 * fs}
          fill="var(--fx-frog)"
          textAnchor={anchor(fx)}
          fontWeight={600}
          className="fx-num"
          opacity={Math.abs(X(target) - fx) < 120 && aim > 0 ? 0 : 1}
        >
          {`your frog: pad ${fmt(n >= 1 && hop < 1 ? Math.round(lerp(frogBefore, frogNow, hop)) : frogNow)}`}
        </text>
      </svg>

      <div className="fx-cap" aria-live="polite">
        <div>{line1}</div>
        {line2 && <div>{line2}</div>}
        {line3 && <div style={{ color: "var(--muted)" }}>{line3}</div>}
      </div>

      <Controls tl={tl} speeds={SPEEDS} timeText={n === 0 ? "before the clock" : `time ${fmt(n)}`} canNext={n < MAXT} />

      <div className="fx-ask">
        <div style={{ fontWeight: 600 }}>At which time does the shooter test a pair?</div>
        <div className="fx-group" style={{ gap: "6px 14px", marginTop: 6 }}>
          <label className="fx-group">
            <span className="fx-label">starting offset</span>
            <input type="number" min={1} max={ASK_MAX} inputMode="numeric" value={askD} onChange={(e) => setAskD(e.target.value)} />
          </label>
          <label className="fx-group">
            <span className="fx-label">jump size</span>
            <input type="number" min={1} max={ASK_MAX} inputMode="numeric" value={askK} onChange={(e) => setAskK(e.target.value)} />
          </label>
        </div>
        <div style={{ marginTop: 8, minHeight: "3em" }} aria-live="polite">
          {ask ? (
            <>
              <div>{askText}</div>
              <div className="fx-group" style={{ marginTop: 8 }}>
                <button type="button" className="fx-btn" onClick={() => tl.jump(askTime)}>
                  {`Go to time ${fmt(askTime)}`}
                </button>
                {inPicture(ask) && !(ask.d === frog.d && ask.k === frog.k) && (
                  <button type="button" className="fx-btn" onClick={() => setFrogTo(ask)}>
                    Give the frog this pair
                  </button>
                )}
              </div>
            </>
          ) : (
            <span style={{ color: "var(--muted)" }}>
              {askD || askK
                ? `Type two whole numbers from 1 to ${ASK_MAX}.`
                : "Tap any pair in the grid, or type one in."}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Dial({ label, value, lo, hi, onChange }: { label: string; value: number; lo: number; hi: number; onChange: (v: number) => void }) {
  return (
    <div className="fx-group" role="group" aria-label={label}>
      <span className="fx-label">{label}</span>
      <button type="button" className="fx-btn" disabled={value <= lo} onClick={() => onChange(value - 1)} aria-label={`smaller ${label}`}>
        {"−"}
      </button>
      <span className="fx-num" style={{ minWidth: "1.4em", textAlign: "center", fontWeight: 600, color: "var(--fx-frog)" }} aria-live="polite">
        {value}
      </span>
      <button type="button" className="fx-btn" disabled={value >= hi} onClick={() => onChange(value + 1)} aria-label={`larger ${label}`}>
        {"+"}
      </button>
    </div>
  );
}
