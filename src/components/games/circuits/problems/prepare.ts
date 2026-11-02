// Turn an author's CircuitSpec into what the components draw and check.

import { useMemo } from "react";
import type { Bit, Circuit, CircuitSpec } from "../model";
import { netOf, topoOrder, type Net } from "./engine";
import { layoutCircuit } from "./layout";

export interface Prepared {
  laid: Circuit | null;
  net: Net;
  error: string | null;
  inputIds: string[];
  outputIds: string[];
  labelOf: (id: string) => string;
}

export function prepare(spec: CircuitSpec | undefined): Prepared {
  const empty: Net = { inputs: [], gates: [], outputs: [] };
  if (!spec || !Array.isArray(spec.inputs) || !Array.isArray(spec.gates) || !Array.isArray(spec.outputs))
    return { laid: null, net: empty, error: "No circuit given, or it is not in the CircuitSpec format.", inputIds: [], outputIds: [], labelOf: (x) => x };
  const net = netOf(spec);
  const known = new Set([...net.inputs, ...net.gates.map((g) => g.id)]);
  for (const g of spec.gates) {
    for (const s of g.inputs) if (!known.has(s)) return { laid: null, net, error: `Gate "${g.id}" reads "${s}", which is neither a switch nor a gate.`, inputIds: [], outputIds: [], labelOf: (x) => x };
    if (g.type === "NOT" && g.inputs.length !== 1) return { laid: null, net, error: `NOT gate "${g.id}" must have exactly one input.`, inputIds: [], outputIds: [], labelOf: (x) => x };
    if (g.type !== "NOT" && g.inputs.length < 2) return { laid: null, net, error: `Gate "${g.id}" needs at least two inputs.`, inputIds: [], outputIds: [], labelOf: (x) => x };
  }
  for (const o of spec.outputs) if (!known.has(o.source)) return { laid: null, net, error: `Bulb "${o.id}" reads "${o.source}", which is neither a switch nor a gate.`, inputIds: [], outputIds: [], labelOf: (x) => x };
  if (!topoOrder(net)) return { laid: null, net, error: "The circuit has a loop.", inputIds: [], outputIds: [], labelOf: (x) => x };
  const labels = new Map<string, string>();
  for (const i of spec.inputs) labels.set(i.id, i.label ?? i.id);
  for (const o of spec.outputs) labels.set(o.id, o.label ?? o.id);
  return {
    laid: layoutCircuit(spec),
    net,
    error: null,
    inputIds: net.inputs,
    outputIds: net.outputs.map((o) => o.id),
    labelOf: (id) => labels.get(id) ?? id,
  };
}

export function usePrepared(spec: CircuitSpec | undefined): Prepared {
  // Specs arrive as fresh objects from island props, so key on the content.
  const key = JSON.stringify(spec ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => prepare(spec), [key]);
}

// "101" or { a: 1, b: 0, c: 1 } -> { a: 1, b: 0, c: 1 }, in input order.
export function settingOf(ids: string[], s: string | Record<string, number | boolean> | undefined): Record<string, Bit> {
  const r: Record<string, Bit> = {};
  ids.forEach((id, k) => {
    const v = s === undefined ? 0 : typeof s === "string" ? (s.replace(/[\s_|]/g, "")[k] === "1" ? 1 : 0) : s[id] ? 1 : 0;
    r[id] = v as Bit;
  });
  return r;
}

export function settingText(ids: string[], labelOf: (id: string) => string, s: Record<string, Bit>): string {
  return ids.map((id) => `${labelOf(id)} = ${s[id]}`).join(", ");
}
