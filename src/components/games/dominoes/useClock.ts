import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A continuous clock measured in ticks, driven by requestAnimationFrame.
 *
 * The simulation is discrete — one cell per tick — but the drawing is not:
 * a tile spends most of a tick visibly mid-fall, and the sub-dominoes
 * inside a cell are staggered across the tick. So the renderer wants a
 * fractional time, not an integer step, or the cascade snaps from cell to
 * cell and reads as a moving highlight rather than as falling wood.
 */
export function useClock(lastTick: number, ticksPerSecond: number) {
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef<number | null>(null);
  const prev = useRef<number | null>(null);
  // The run is over once the last wavefront has finished falling.
  const end = lastTick + 1;

  const cancel = useCallback(() => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
    prev.current = null;
  }, []);

  const stop = useCallback(() => {
    cancel();
    setPlaying(false);
  }, [cancel]);

  const reset = useCallback(() => {
    stop();
    setTime(0);
  }, [stop]);

  const play = useCallback(() => {
    setTime((t) => (t >= end ? 0 : t));
    setPlaying(true);
  }, [end]);

  /** Jump forward exactly one tick, without running. */
  const step = useCallback(() => {
    stop();
    setTime((t) => Math.min(Math.floor(t) + 1, end));
  }, [stop, end]);

  useEffect(() => {
    if (!playing) return;
    const frame = (now: number) => {
      if (prev.current === null) prev.current = now;
      const dt = (now - prev.current) / 1000;
      prev.current = now;
      let finished = false;
      setTime((t) => {
        const next = t + dt * ticksPerSecond;
        if (next >= end) {
          finished = true;
          return end;
        }
        return next;
      });
      if (finished) {
        setPlaying(false);
        raf.current = null;
        prev.current = null;
        return;
      }
      raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    return cancel;
  }, [playing, ticksPerSecond, end, cancel]);

  // A change of board or inputs restarts the run.
  const restart = useCallback(() => {
    stop();
    setTime(0);
  }, [stop]);

  return { time, setTime, playing, play, stop, step, reset, restart, end };
}
