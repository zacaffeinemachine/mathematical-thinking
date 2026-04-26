// Shared FSM model used by FSMRunner (read-only) and (later) FSMBuilder.
//
// A machine is a finite set of states, an alphabet of single-character
// symbols, a transition table, a designated start state, and a set of
// accepting states. Layouts give each state a normalized [0, 1] position
// for SVG rendering.

export type State = string;
export type Symbol = string;

export interface FSM {
  states: State[];
  alphabet: Symbol[];
  start: State;
  accepting: ReadonlySet<State>;
  // delta[state][symbol] = next state. Missing entries → the machine
  // jumps to a virtual trap state and rejects.
  delta: Record<State, Record<Symbol, State>>;
  // Normalized positions in [0, 1] x [0, 1].
  layout: Record<State, { x: number; y: number }>;
  // Optional human-readable labels shown on the node.
  labels?: Record<State, string>;
}

export interface Step {
  index: number;             // index within the input string (0-based)
  symbol: Symbol;
  from: State;
  to: State | null;          // null means trapped (no transition)
}

export function step(machine: FSM, current: State, symbol: Symbol): State | null {
  const row = machine.delta[current];
  if (!row) return null;
  return row[symbol] ?? null;
}

export function run(machine: FSM, input: string): {
  trace: Step[];
  finalState: State | null;
  accepted: boolean;
} {
  const trace: Step[] = [];
  let cur: State | null = machine.start;
  for (let i = 0; i < input.length; i++) {
    const sym = input[i];
    if (cur === null) {
      trace.push({ index: i, symbol: sym, from: "(trap)", to: null });
      continue;
    }
    const next = step(machine, cur, sym);
    trace.push({ index: i, symbol: sym, from: cur, to: next });
    cur = next;
  }
  return {
    trace,
    finalState: cur,
    accepted: cur !== null && machine.accepting.has(cur),
  };
}

// Group transitions by (from, to) so multiple symbols collapse onto one
// edge with a comma-separated label.
export interface EdgeGroup {
  from: State;
  to: State;
  symbols: Symbol[];
}

export function edgeGroups(machine: FSM): EdgeGroup[] {
  const groups = new Map<string, EdgeGroup>();
  for (const from of machine.states) {
    const row = machine.delta[from];
    if (!row) continue;
    for (const sym of Object.keys(row)) {
      const to = row[sym];
      const key = `${from}${to}`;
      const g = groups.get(key);
      if (g) g.symbols.push(sym);
      else groups.set(key, { from, to, symbols: [sym] });
    }
  }
  return [...groups.values()];
}
