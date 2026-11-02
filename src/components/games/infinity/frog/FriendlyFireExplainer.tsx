import { useEffect, useState } from "react";
import { friendlyFrog, friendlyShot } from "./listing";
import { Controls, Drop, FrogGlyph, FrogStyle, PondAxis, Splash, useNarrow } from "./parts";
import { ease, lerp, seg, useTimeline } from "./useTimeline";

// =====================================================================
//  Friendly Fire, played out (Chapters/Infinity.tex, "Friendly Fire").
//
//  The frog sits on pad 0 and secretly picks a jump size k. At time t it
//  is on pad t k. The shooter's sheet, written before the buzzer, says
//  "at time t, target the frog that chose k = t, that is, shoot at pad
//  t * t". The student picks k, and watches every shot before time k land
//  behind the frog and the shot at time k land on it.
//
//  One step is one time. Within a step: the frog hops (p 0 to 0.4), the
//  shooter's aim appears over the pad the sheet names (0.3 to 0.45), the
//  drop falls (0.45 to 0.8) and lands (0.8 to 1).
//
//  ?ffK=4&ffT=3 opens on jump size 4 at time 3, for screenshots.
// =====================================================================

const MAXK = 10;
const SHEET = 10; // columns of the sheet shown under the pond
const SPEEDS = [0.5, 1, 2, 4];

const VB = { w: 1000, h: 290 };
const LINE_Y = 222;
const X0 = 50;
const X1 = 920;

export default function FriendlyFireExplainer() {
  const [k, setK] = useState(4);
  const tl = useTimeline({ max: k, pauseAt: [k], dur: 1700, hold: 800, speeds: SPEEDS });
  const { n, p } = tl;
  const narrow = useNarrow();
  const fs = narrow ? 1.6 : 1;

  // Read the link once, on arrival. The jump waits a render, so that the
  // clock already knows the new jump size when it is clamped.
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const qk = parseInt(q.get("ffK") ?? "", 10);
    const qt = parseInt(q.get("ffT") ?? "", 10);
    if (qk >= 1 && qk <= MAXK) setK(qk);
    if (qt >= 0) setPending(qt);
  }, []);
  useEffect(() => {
    if (pending === null) return;
    tl.jump(pending);
    setPending(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, k]);

  const choose = (v: number) => {
    setK(v);
    tl.jump(0);
  };
  const random = () => {
    let v = k;
    while (v === k) v = 1 + Math.floor(Math.random() * MAXK);
    choose(v);
  };

  // ---- Where everything is ----
  const hi = Math.max(10, k * k + Math.max(2, k));
  const X = (pad: number) => X0 + ((X1 - X0) * pad) / hi;
  const hop = n >= 1 ? ease(seg(p, 0, 0.4)) : 1;
  const from = n >= 1 ? friendlyFrog(k, n - 1) : 0;
  const to = friendlyFrog(k, n);
  const fx = lerp(X(from), X(to), hop);
  const hopH = Math.min(110, 26 + 0.35 * (X(to) - X(from)));
  const fy = LINE_Y - 24 - (n >= 1 ? hopH * Math.sin(Math.PI * hop) : 0);

  const target = n >= 1 ? friendlyShot(n) : 0;
  const aim = n >= 1 ? seg(p, 0.3, 0.45) : 0;
  const fall = n >= 1 ? seg(p, 0.45, 0.8) : 0;
  const landed = n >= 1 && p >= 0.8;
  const impact = seg(p, 0.8, 1);
  const hit = n === k && n >= 1;
  const soaked = hit && landed;
  const dropY = lerp(42, LINE_Y - 30, fall * fall);

  // Earlier shots, all of which landed behind the frog.
  const misses = [];
  for (let t = 1; t < n || (t === n && landed && t !== k); t++) {
    misses.push(
      <g key={t}>
        <circle cx={X(t * t)} cy={LINE_Y} r={9} fill="none" stroke="var(--fx-water)" strokeWidth={3} opacity={0.75} />
        <text x={X(t * t)} y={LINE_Y - 18} fontSize={17 * fs} fill="var(--fx-water)" textAnchor="middle" opacity={0.85} className="fx-num">
          {t}
        </text>
      </g>,
    );
  }
  // Where the frog has been.
  const trail = [];
  for (let t = 0; t < n; t++) {
    trail.push(<circle key={t} cx={X(friendlyFrog(k, t))} cy={LINE_Y + 1} r={5} fill="var(--fx-frog)" opacity={0.45} />);
  }

  // ---- Words ----
  let line1: string;
  let line2 = "";
  if (n === 0) {
    line1 = `The frog sits on pad 0 and has secretly picked its jump size, ${k}. The shooter does not know it.`;
    line2 = "The sheet below was written before the buzzer, and it is the same whichever number the frog picks. Press play.";
  } else {
    line1 = `Time ${n}. The shooter addresses the frog that chose ${n}, by shooting at pad ${n} × ${n} = ${target}.`;
    if (landed) {
      line1 += ` Your frog chose ${k}, and after ${n} ${n === 1 ? "jump" : "jumps"} of ${k} it sits on pad ${to}.`;
      line1 += hit ? " Splash!" : " Miss.";
    }
    line2 = hit
      ? landed
        ? `At time ${k} the sheet aims at exactly the frog that jumps by ${k}. Whatever number the frog picks, it is soaked at the time with that same number.`
        : ""
      : `Your frog jumps by ${k}, so its turn on the sheet comes at time ${k}. Until then each shot lands behind it.`;
  }

  const cols = Array.from({ length: SHEET }, (_, i) => i + 1);
  const shown = (t: number) => t < n || (t === n && landed);

  return (
    <div
      className="frogx not-prose"
      tabIndex={0}
      onKeyDown={tl.onKeyDown}
      aria-label="Friendly Fire, played out. Right and Left arrows step, Space plays or pauses, Home resets."
    >
      <FrogStyle />
      <div className="fx-pick">
        <div className="fx-group" role="group" aria-label="The frog's secret jump size">
          <span className="fx-label">The frog's secret jump size</span>
          {Array.from({ length: MAXK }, (_, i) => i + 1).map((v) => (
            <button key={v} type="button" className="fx-btn" style={{ padding: "5px 9px" }} aria-pressed={k === v} onClick={() => choose(v)}>
              {v}
            </button>
          ))}
        </div>
        <button type="button" className="fx-btn" onClick={random}>
          Pick at random
        </button>
      </div>

      <svg viewBox={`0 0 ${VB.w} ${VB.h}`} role="img" aria-label={`The pond at time ${n}. The frog is on pad ${to}.${n >= 1 ? ` The shot goes to pad ${target}.` : ""}`}>
        <text x={X0 - 20} y={44} fontSize={30 * Math.min(fs, 1.4)} fontWeight={600} fill="var(--ink)" className="fx-num">
          {n === 0 ? "Before the clock starts" : `Time ${n}`}
        </text>
        <PondAxis hi={hi} x0={X0} x1={X1} y={LINE_Y} fs={fs} />
        {trail}
        {misses}
        {n >= 1 && aim > 0 && (
          <g opacity={aim * (landed ? 1 - (hit ? 1 : 0.5) * impact : 1)}>
            <line x1={X(target)} x2={X(target)} y1={62} y2={LINE_Y - 12} stroke="var(--fx-thread)" strokeWidth={2.5} strokeDasharray="7 7" />
            <text x={X(target)} y={74 + 18 * fs} fontSize={21 * fs} fill="var(--fx-thread)" textAnchor={X(target) > 800 ? "end" : X(target) < 160 ? "start" : "middle"} fontWeight={600} className="fx-num">
              {`the sheet says pad ${target}`}
            </text>
          </g>
        )}
        {n >= 1 && fall > 0 && !landed && <Drop x={X(target)} y={dropY} r={11} />}
        {n >= 1 && landed && !hit && <Splash x={X(target)} y={LINE_Y} r={16} t={impact} />}
        <FrogGlyph x={fx} y={fy} r={22 * Math.sqrt(fs)} soaked={soaked} />
        {soaked && <Splash x={X(to)} y={LINE_Y - 14} r={26} t={impact} big />}
        {soaked && (
          <text x={X(to)} y={LINE_Y - 50 - 14 * fs} fontSize={26 * fs} fontWeight={700} fill="var(--fx-water)" textAnchor={X(to) > 820 ? "end" : "middle"}>
            Splash!
          </text>
        )}
      </svg>

      <div className="fx-cap" aria-live="polite">
        <div>{line1}</div>
        {line2 && <div style={{ color: "var(--muted)" }}>{line2}</div>}
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        <div className="fx-label" style={{ marginBottom: 6 }}>
          The shooter's sheet, written before the buzzer, and the frog's pad at each time
        </div>
        <div className="fx-scroll">
          <table className="fx-sheet">
            <tbody>
              <tr>
                <th scope="row">time</th>
                {cols.map((t) => (
                  <td key={t} className={t === n ? "fx-now" : undefined}>
                    {t}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="fx-gold">
                  shoot at pad
                </th>
                {cols.map((t) => (
                  <td key={t} className={[t === n ? "fx-now" : "", t === k && soaked ? "fx-hit" : ""].join(" ").trim() || undefined}>
                    {friendlyShot(t)}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className="fx-frogc">
                  frog is on pad
                </th>
                {cols.map((t) => (
                  <td key={t} className={[t === n ? "fx-now" : "", t === k && soaked ? "fx-hit" : "", t > k ? "fx-future" : ""].join(" ").trim() || undefined}>
                    {t > k ? "" : shown(t) ? friendlyFrog(k, t) : "?"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <Controls tl={tl} speeds={SPEEDS} timeText={n === 0 ? "before the clock" : `time ${n}`} canNext={n < k} />
    </div>
  );
}
