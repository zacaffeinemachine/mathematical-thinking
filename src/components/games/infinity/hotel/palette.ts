import { useEffect, useState } from "react";
import type { Palette, RGB } from "./engine";

// =====================================================================
//  The explainers draw in the site's own colours, so they follow the
//  light/dark toggle. The roles are read off the CSS variables in
//  global.css (--ink, --muted, --accent, --surface, --bg) and mixed; the
//  one colour the theme does not have, a blue for new arrivals, is picked
//  per theme here. The slides use the same split: grey for the guests the
//  hotel already had, blue for whoever has just arrived, and the accent for
//  the manager's instruction and the thread.
// =====================================================================

const LIGHT = {
  ink: "#18181b", muted: "#71717a", accent: "#b91c1c", surface: "#ffffff", bg: "#fafafa",
  newc: "#1d6fb8",
};
const DARK_NEW = "#7cc0f0";

function parse(c: string, fallback: string): RGB {
  const s = c.trim() || fallback;
  if (s.startsWith("#")) {
    const h = s.slice(1);
    const full = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h.slice(0, 6);
    const n = parseInt(full, 16);
    if (Number.isFinite(n)) return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  }
  return s === fallback ? [128, 128, 128] : parse(fallback, fallback);
}

const mixc = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

function build(v: typeof LIGHT): Palette {
  const ink = parse(v.ink, LIGHT.ink);
  const muted = parse(v.muted, LIGHT.muted);
  const accent = parse(v.accent, LIGHT.accent);
  const surface = parse(v.surface, LIGHT.surface);
  const bg = parse(v.bg, LIGHT.bg);
  return {
    ink,
    guest: mixc(ink, muted, 0.45),
    new: parse(v.newc, LIGHT.newc),
    accent,
    wall: mixc(muted, surface, 0.1),
    num: muted,
    spent: mixc(muted, surface, 0.62),
    faint: mixc(muted, surface, 0.8),
    surface: mixc(surface, bg, 0.3),
  };
}

export const LIGHT_PALETTE = build(LIGHT);

function read(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  return build({
    ink: cs.getPropertyValue("--ink"),
    muted: cs.getPropertyValue("--muted"),
    accent: cs.getPropertyValue("--accent"),
    surface: cs.getPropertyValue("--surface"),
    bg: cs.getPropertyValue("--bg"),
    newc: dark ? DARK_NEW : LIGHT.newc,
  });
}

export function usePalette(): Palette {
  const [pal, setPal] = useState<Palette>(LIGHT_PALETTE);
  useEffect(() => {
    setPal(read());
    // The theme toggle flips data-theme on <html>. The CSS variables change
    // with a 150 ms transition on the page, so read again a moment later too.
    let late: ReturnType<typeof setTimeout> | 0 = 0;
    const obs = new MutationObserver(() => {
      setPal(read());
      if (late) clearTimeout(late);
      late = setTimeout(() => setPal(read()), 200);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      obs.disconnect();
      if (late) clearTimeout(late);
    };
  }, []);
  return pal;
}
