// Tiny combinational-circuit model.
//
// A circuit has named inputs, named outputs, and a list of gates. Every
// gate consumes one or two source ids (input ids or other gate ids) and
// produces a single bit. Evaluation is topological: gates are listed in
// dependency order so that a single forward pass fills every node.

export type Bit = 0 | 1;

export type GateType = "NOT" | "AND" | "OR" | "XOR" | "NAND" | "NOR";

export interface InputNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface OutputNode {
  id: string;
  label: string;
  x: number;
  y: number;
  source: string;
}

export interface Gate {
  id: string;
  type: GateType;
  x: number;
  y: number;
  inputs: string[]; // exactly 1 for NOT, exactly 2 for the rest
  label?: string;   // optional small label drawn under the gate
}

export interface Wire {
  // optional extra waypoint between source and target for nicer routing
  from: string;
  to: string;     // either gate id (with portIdx) or output id
  portIdx?: 0 | 1;
  via?: { x: number; y: number }[];
}

export interface Circuit {
  width: number;
  height: number;
  inputs: InputNode[];
  gates: Gate[];        // already in topological order
  outputs: OutputNode[];
  wires?: Wire[];       // optional explicit wires; otherwise auto-routed
}

export function evalGate(t: GateType, a: Bit, b: Bit): Bit {
  switch (t) {
    case "NOT":  return (a ^ 1) as Bit;
    case "AND":  return (a & b) as Bit;
    case "OR":   return (a | b) as Bit;
    case "XOR":  return (a ^ b) as Bit;
    case "NAND": return ((a & b) ^ 1) as Bit;
    case "NOR":  return ((a | b) ^ 1) as Bit;
  }
}

// Evaluate the whole circuit, given a value for each input id.
// Returns a map node-id -> bit, covering inputs and gates.
export function evaluate(c: Circuit, inputs: Record<string, Bit>): Record<string, Bit> {
  const v: Record<string, Bit> = { ...inputs };
  for (const g of c.gates) {
    const a = v[g.inputs[0]] ?? 0;
    const b = (v[g.inputs[1]] ?? 0) as Bit;
    v[g.id] = evalGate(g.type, a as Bit, b);
  }
  return v;
}

// Step-by-step evaluation: returns the value map after evaluating the
// first `step` gates in topological order.
export function evaluateUpTo(
  c: Circuit,
  inputs: Record<string, Bit>,
  step: number,
): Record<string, Bit> {
  const v: Record<string, Bit> = { ...inputs };
  for (let i = 0; i < step && i < c.gates.length; i++) {
    const g = c.gates[i];
    const a = v[g.inputs[0]] ?? 0;
    const b = (v[g.inputs[1]] ?? 0) as Bit;
    v[g.id] = evalGate(g.type, a as Bit, b);
  }
  return v;
}
