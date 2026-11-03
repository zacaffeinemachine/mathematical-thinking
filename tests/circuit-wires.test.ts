// No wire in a drawn circuit passes behind a gate it does not touch.
// Run from Site/ with:  npm test
//
// Every CircuitSpec in every Circuits bank is laid out as the page lays it
// out, and every wire is routed as FixedCircuit routes it. A wire that runs
// behind a gate reads as that gate's input or output (Puzzles in Wires,
// problem 12, Nov 2026, where an AND seemed to give two outputs).

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Circuit, CircuitSpec } from "../src/components/games/circuits/model.ts";
import { BULB_PIN, gateBox, gateInputPin, layoutCircuit, routeSegments, segmentsPoints, sourcePin } from "../src/components/games/circuits/problems/layout.ts";

const BANKS = ["gates", "building", "if-then", "design-problems", "any-table", "nand", "isles", "build-it"];
const isSpec = (v: unknown): v is CircuitSpec =>
  !!v && typeof v === "object" && Array.isArray((v as CircuitSpec).inputs) && Array.isArray((v as CircuitSpec).gates) && Array.isArray((v as CircuitSpec).outputs)
  && (v as CircuitSpec).gates.length > 0 && (v as CircuitSpec).gates.every((g) => typeof g.type === "string");
function collect(v: unknown, path: string, out: [string, CircuitSpec][]) {
  if (isSpec(v)) { out.push([path, v]); return; }
  if (Array.isArray(v)) v.forEach((x, k) => collect(x, `${path}[${k}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) collect(x, `${path}.${k}`, out);
}

// The wires of a laid-out circuit that cross a gate other than their own ends.
export function hiddenWires(c: Circuit): string[] {
  const boxes = c.gates.map((g) => ({ id: g.id, box: gateBox(g) }));
  const bad: string[] = [];
  const check = (name: string, from: string, to: string | null, x1: number, y1: number, x2: number, y2: number) => {
    const others = boxes.filter((b) => b.id !== from && b.id !== to);
    const pts = segmentsPoints(routeSegments(x1, y1, x2, y2, others.map((b) => b.box), 4, c.height - 4));
    for (const p of pts) for (const b of others) {
      if (p.x > b.box.x0 + 1 && p.x < b.box.x1 - 1 && p.y > b.box.y0 + 1 && p.y < b.box.y1 - 1) { bad.push(`${name} behind ${b.id}`); return; }
    }
  };
  for (const g of c.gates) g.inputs.forEach((src, i) => {
    const s = sourcePin(c, src)!;
    const p = gateInputPin(g.type, g.inputs.length, i);
    check(`${src}->${g.id}`, src, g.id, s.x, s.y, g.x + p.x, g.y + p.y);
  });
  for (const o of c.outputs) {
    const s = sourcePin(c, o.source)!;
    check(`${o.source}->bulb ${o.id}`, o.source, null, s.x, s.y, o.x - BULB_PIN, o.y);
  }
  return bad;
}

test("wires: no wire in any drawn circuit passes behind a gate", async () => {
  const problems: string[] = [];
  let n = 0;
  for (const bank of BANKS) {
    const mod = await import(`../src/components/games/circuits/problems/banks/${bank}.ts`);
    const found: [string, CircuitSpec][] = [];
    for (const [k, v] of Object.entries(mod)) collect(v, k, found);
    for (const [name, spec] of found) {
      n++;
      const bad = hiddenWires(layoutCircuit(spec));
      if (bad.length) problems.push(`${bank} ${name}: ${bad.join("; ")}`);
    }
  }
  assert.ok(n > 100, `found ${n} circuits`);
  assert.deepEqual(problems, []);
});
