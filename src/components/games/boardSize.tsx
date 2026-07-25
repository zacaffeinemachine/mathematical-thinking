import { useEffect, useRef, useState } from "react";

// Shared board-size preference for all knight-puzzle boards.
// The chosen size persists in localStorage and is broadcast via a window
// event so every board on the page (and on later pages) stays in step.

const STORAGE_KEY = "qrmt-board-size";
const SIZE_EVENT = "qrmt-board-size-change";

export const BOARD_SIZES = [
  { key: "S", label: "S", factor: 0.8 },
  { key: "M", label: "M", factor: 1 },
  { key: "L", label: "L", factor: 1.35 },
  { key: "XL", label: "XL", factor: 1.75 },
] as const;

export type BoardSizeKey = (typeof BOARD_SIZES)[number]["key"];

const isSizeKey = (v: unknown): v is BoardSizeKey =>
  BOARD_SIZES.some((s) => s.key === v);

export function useBoardSize() {
  const [sizeKey, setKeyState] = useState<BoardSizeKey>("M");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // storage unavailable (private mode) — fall back to default
    }
    if (isSizeKey(stored)) setKeyState(stored);

    const onChange = (e: Event) => {
      const k = (e as CustomEvent).detail;
      if (isSizeKey(k)) setKeyState(k);
    };
    window.addEventListener(SIZE_EVENT, onChange);
    return () => window.removeEventListener(SIZE_EVENT, onChange);
  }, []);

  const setSizeKey = (k: BoardSizeKey) => {
    setKeyState(k);
    try {
      window.localStorage.setItem(STORAGE_KEY, k);
    } catch {
      // storage unavailable — the choice still applies to this page
    }
    window.dispatchEvent(new CustomEvent(SIZE_EVENT, { detail: k }));
  };

  const factor =
    BOARD_SIZES.find((s) => s.key === sizeKey)?.factor ?? 1;

  return { sizeKey, factor, setSizeKey };
}

// Width actually available to the boards (the prose column, or the phone
// screen). Attach `ref` to the boards' outer wrapper.
export function useAvailableWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, width };
}

// Largest whole cell size that keeps a `cols`-wide board (8px padding each
// side + 1px border each side = 18px of chrome) inside the available width.
export function fitCell(
  desired: number,
  cols: number,
  available: number | null,
): number {
  if (available == null || available <= 0) return desired;
  return Math.max(24, Math.min(desired, Math.floor((available - 18) / cols)));
}

export function BoardSizeControl({
  sizeKey,
  onChange,
}: {
  sizeKey: BoardSizeKey;
  onChange: (k: BoardSizeKey) => void;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[var(--muted)]">Size</span>
      <span
        role="group"
        aria-label="Board size"
        className="inline-flex rounded-md border border-[var(--rule)] overflow-hidden"
      >
        {BOARD_SIZES.map((s, i) => {
          const active = s.key === sizeKey;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onChange(s.key)}
              aria-pressed={active}
              aria-label={`Board size ${s.label}`}
              className="text-xs font-semibold transition-colors"
              style={{
                padding: "6px 10px",
                border: "none",
                borderLeft: i > 0 ? "1px solid var(--rule)" : "none",
                background: active ? "var(--accent-soft)" : "transparent",
                color: active ? "var(--accent)" : "var(--muted)",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {s.label}
            </button>
          );
        })}
      </span>
    </span>
  );
}
