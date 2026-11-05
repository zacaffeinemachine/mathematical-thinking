// Saving a student's work between visits.
//
// Key scheme:  qrmt.circuits.v1:<page>:<id>
//   <page> is the URL path below the site base with no slashes at either end,
//          e.g. "logic-gates/gates".
//   <id>   is the component's id prop, which must be unique on its page.
// The stored value is JSON { kind, data }, where kind names the component
// ("builder", "predict", "fill", "find"). A value of the wrong kind is
// ignored, so reusing an id for a different component cannot crash a page.
// A component with no id saves nothing.

import { useCallback, useEffect, useState } from "react";

const PREFIX = "qrmt.circuits.v1";

export function pagePath(): string {
  if (typeof window === "undefined") return "";
  const base = ((import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "").replace(/\/+$/, "");
  let p = window.location.pathname;
  if (base && p.startsWith(base)) p = p.slice(base.length);
  return p.replace(/^\/+|\/+$/g, "");
}

export function storageKey(id: string, prefix = PREFIX): string {
  return `${prefix}:${pagePath()}:${id}`;
}

function read(id: string, kind: string, prefix: string): unknown {
  try {
    const raw = window.localStorage.getItem(storageKey(id, prefix));
    if (!raw) return undefined;
    const v = JSON.parse(raw);
    return v && v.kind === kind ? v.data : undefined;
  } catch {
    return undefined;
  }
}

function write(id: string, kind: string, data: unknown, prefix: string) {
  try {
    window.localStorage.setItem(storageKey(id, prefix), JSON.stringify({ kind, data }));
  } catch {
    /* storage full or blocked: work simply is not saved */
  }
}

function remove(id: string, prefix: string) {
  try { window.localStorage.removeItem(storageKey(id, prefix)); } catch { /* ignore */ }
}

// useState that loads from localStorage after the first render (so the
// server HTML and the first client render agree) and saves on every change.
// `revive` checks a stored value and returns a usable state, or null to
// discard it. Returns [state, setState, reset]. `prefix` replaces
// "qrmt.circuits.v1" (the machine builder saves under "qrmt.machines.v1").
export function usePersistent<T>(
  id: string | undefined,
  kind: string,
  initial: () => T,
  revive: (stored: unknown) => T | null,
  prefix: string = PREFIX,
): [T, (u: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(initial);
  // A state flag, not a ref: the load and the "ready" flip land in the same
  // render, so the first save already sees the loaded value.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (id) {
      const stored = read(id, kind, prefix);
      if (stored !== undefined) {
        const v = revive(stored);
        if (v !== null) setState(v);
      }
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, kind]);

  useEffect(() => {
    if (id && ready) write(id, kind, state, prefix);
  }, [id, kind, state, ready, prefix]);

  const reset = useCallback(() => {
    if (id) remove(id, prefix);
    setState(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return [state, setState, reset];
}
