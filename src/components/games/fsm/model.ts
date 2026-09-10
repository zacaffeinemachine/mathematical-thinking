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
  // Optional plain-English gloss for each state: what the machine is
  // remembering while it sits there. The runner prints the gloss of the
  // current state as the machine walks, which is the whole point of the
  // exercise. Leave it out on a mystery machine, where saying what a
  // state remembers would hand over the answer.
  meaning?: Record<State, string>;
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

// ---------------------------------------------------------------------
//  Helpers used by the runners and by the "many inputs at once" panels.
// ---------------------------------------------------------------------

// Where the machine stands after reading the whole input. `null` means it
// fell off the diagram on some symbol and never came back.
export function finalState(machine: FSM, input: string): State | null {
  return run(machine, input).finalState;
}

export function accepts(machine: FSM, input: string): boolean {
  return run(machine, input).accepted;
}

// Every string over the alphabet of length 0, 1, 2, ... up to maxLen, in
// the order a patient experimenter would try them: shortest first, and
// within a length, in the order the alphabet is written.
//
// `cap` stops the obvious explosion on a large alphabet. It truncates,
// which is the honest thing to do: the panel that uses this says how many
// strings it is showing.
export function shortlexUpTo(
  alphabet: Symbol[],
  maxLen: number,
  cap = 128,
): string[] {
  const out: string[] = [];
  let level: string[] = [""];
  for (let len = 0; len <= maxLen; len++) {
    for (const s of level) {
      if (out.length >= cap) return out;
      out.push(s);
    }
    const next: string[] = [];
    for (const s of level) for (const a of alphabet) next.push(s + a);
    level = next;
  }
  return out;
}
