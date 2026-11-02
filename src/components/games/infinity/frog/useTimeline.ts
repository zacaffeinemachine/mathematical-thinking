import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";

// =====================================================================
//  One clock for all three frog explainers. Time n runs 0, 1, 2, ...,
//  and p (0 to 1) is how far the move into time n has got. The loop is
//  the one CantorAnimation uses: elapsed time times the speed advances
//  the tween, then, when playing, the hold before the next step.
//
//  Under prefers-reduced-motion every move jumps straight to its end.
//  Play still steps on, one time at a time, but nothing slides.
// =====================================================================

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

export interface TimelineOpts {
  /** The last time the clock can reach. */
  max: number;
  /** Times at which Play pauses by itself, after the move has finished. */
  pauseAt?: number[];
  /** Length of one move at 1x, in ms. */
  dur: number;
  /** Pause after a move at 1x, in ms, when playing. */
  hold: number;
  speeds: number[];
  /** Index into speeds to start at. */
  speed0?: number;
}

export function useTimeline({ max, pauseAt = [], dur, hold, speeds, speed0 = 1 }: TimelineOpts) {
  const [view, setView] = useState({ n: 0, p: 1 });
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(speed0);
  const reduced = useReducedMotion();

  const viewRef = useRef(view);
  viewRef.current = view;
  const holdRef = useRef(0);
  const pauseKey = pauseAt.join(",");
  const pauseRef = useRef(pauseAt);
  pauseRef.current = pauseAt;

  const goTo = useCallback(
    (n: number, tween: boolean) => {
      holdRef.current = 0;
      setView({ n: Math.max(0, Math.min(max, n)), p: tween && !reduced ? 0 : 1 });
    },
    [max, reduced],
  );

  useEffect(() => {
    if (!playing && view.p >= 1) return;
    let raf = 0;
    let last = performance.now();
    const speed = speeds[speedIdx];
    const tick = (now: number) => {
      const dt = Math.min(100, now - last) * speed;
      last = now;
      const v = viewRef.current;
      if (v.p < 1) {
        const np = reduced ? 1 : Math.min(1, v.p + dt / dur);
        if (np >= 1) {
          holdRef.current = 0;
          if (playing && pauseRef.current.includes(v.n)) {
            setView({ n: v.n, p: 1 });
            setPlaying(false);
            return;
          }
        }
        setView({ n: v.n, p: np });
      } else if (playing) {
        holdRef.current += dt;
        if (holdRef.current >= hold) {
          holdRef.current = 0;
          if (v.n < max) {
            setView({ n: v.n + 1, p: reduced ? 1 : 0 });
            if (reduced && pauseRef.current.includes(v.n + 1)) {
              setPlaying(false);
              return;
            }
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
    // pauseKey stands in for pauseAt, which is read through a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speedIdx, reduced, view.p >= 1, max, dur, hold, pauseKey]);

  const next = useCallback(() => {
    setPlaying(false);
    const v = viewRef.current;
    if (v.n < max) goTo(v.n + 1, true);
    else setView({ n: v.n, p: 1 });
  }, [max, goTo]);
  // Back jumps to the end of the time before: nothing runs backwards.
  const prev = useCallback(() => {
    setPlaying(false);
    goTo(viewRef.current.n - 1, false);
  }, [goTo]);
  const reset = useCallback(() => {
    setPlaying(false);
    goTo(0, false);
  }, [goTo]);
  const jump = useCallback(
    (n: number) => {
      setPlaying(false);
      goTo(n, false);
    },
    [goTo],
  );
  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    const v = viewRef.current;
    const to = v.n >= max ? 1 : v.n + 1;
    if (v.p >= 1) {
      goTo(to, true);
      // With no tween to finish, a pause point has to be caught here.
      if (reduced && pauseRef.current.includes(to)) return;
    }
    setPlaying(true);
  }, [max, goTo, playing, reduced]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      reset();
    } else if (e.key === " " || e.key === "Spacebar") {
      // A focused button handles its own Space press.
      if (tag === "BUTTON") return;
      e.preventDefault();
      togglePlay();
    }
  };

  return {
    n: view.n,
    p: view.p,
    playing,
    reduced,
    speedIdx,
    setSpeedIdx,
    next,
    prev,
    reset,
    jump,
    togglePlay,
    onKeyDown,
  };
}

export type Timeline = ReturnType<typeof useTimeline>;

// ---- Small maths for the drawings ----------------------------------------
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
/** How far p has got through the stretch from a to b, as 0 to 1. */
export const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
export const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
