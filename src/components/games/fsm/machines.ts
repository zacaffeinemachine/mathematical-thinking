import type { FSM } from "./model";

// A few canonical preloaded machines used by the intro page. Layouts are
// tuned to look uncluttered at the runner's default canvas size.

export const lightSwitch: FSM = {
  states: ["Off", "On"],
  alphabet: ["f"],
  start: "Off",
  accepting: new Set(["On"]),
  delta: {
    Off: { f: "On" },
    On: { f: "Off" },
  },
  layout: {
    Off: { x: 0.28, y: 0.5 },
    On: { x: 0.72, y: 0.5 },
  },
};

// Recognises binary strings ending in "01".
//
// Layout note: the states form a triangle (q1 at the top apex, q0 and q2
// at the bottom corners) so that the long q2 → q0 edge runs across the
// bottom without slicing through q1, and so that the q1 ↔ q2 bent pair
// doesn't share its visual channel with any unrelated edge.
export const endsIn01: FSM = {
  states: ["q0", "q1", "q2"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q2"]),
  delta: {
    q0: { "0": "q1", "1": "q0" },
    q1: { "0": "q1", "1": "q2" },
    q2: { "0": "q1", "1": "q0" },
  },
  layout: {
    q0: { x: 0.18, y: 0.72 },
    q1: { x: 0.5, y: 0.22 },
    q2: { x: 0.82, y: 0.72 },
  },
};

// Recognises binary strings whose number of 1s is divisible by 3.
// (Reads any 0/1 input; 0s loop in place.)
export const divisibleBy3Ones: FSM = {
  states: ["r0", "r1", "r2"],
  alphabet: ["0", "1"],
  start: "r0",
  accepting: new Set(["r0"]),
  delta: {
    r0: { "0": "r0", "1": "r1" },
    r1: { "0": "r1", "1": "r2" },
    r2: { "0": "r2", "1": "r0" },
  },
  layout: {
    r0: { x: 0.5, y: 0.18 },
    r1: { x: 0.78, y: 0.72 },
    r2: { x: 0.22, y: 0.72 },
  },
};

// Same wiring as divisibleBy3Ones but with the accepting set flipped:
// accept iff the count of 1s is *not* divisible by 3.
export const notDivisibleBy3Ones: FSM = {
  ...divisibleBy3Ones,
  accepting: new Set(["r1", "r2"]),
};

// The mystery machine from "Reading the Language" — accepts every binary
// string that contains "11" as a substring. Layout: classic triangle.
export const mysteryMachine: FSM = {
  states: ["s0", "s1", "s2"],
  alphabet: ["0", "1"],
  start: "s0",
  accepting: new Set(["s2"]),
  delta: {
    s0: { "0": "s0", "1": "s1" },
    s1: { "0": "s0", "1": "s2" },
    s2: { "0": "s2", "1": "s2" },
  },
  layout: {
    s0: { x: 0.18, y: 0.72 },
    s1: { x: 0.5, y: 0.22 },
    s2: { x: 0.82, y: 0.72 },
  },
};

// Component machine A: count of 0s, modulo 3. Accept at A0 only.
export const zerosMod3: FSM = {
  states: ["a0", "a1", "a2"],
  alphabet: ["0", "1"],
  start: "a0",
  accepting: new Set(["a0"]),
  delta: {
    a0: { "0": "a1", "1": "a0" },
    a1: { "0": "a2", "1": "a1" },
    a2: { "0": "a0", "1": "a2" },
  },
  layout: {
    a0: { x: 0.5, y: 0.2 },
    a1: { x: 0.78, y: 0.72 },
    a2: { x: 0.22, y: 0.72 },
  },
  labels: { a0: "A₀", a1: "A₁", a2: "A₂" },
};

// Component machine B: count of 1s, modulo 4. Accept at B0 only.
export const onesMod4: FSM = {
  states: ["b0", "b1", "b2", "b3"],
  alphabet: ["0", "1"],
  start: "b0",
  accepting: new Set(["b0"]),
  delta: {
    b0: { "0": "b0", "1": "b1" },
    b1: { "0": "b1", "1": "b2" },
    b2: { "0": "b2", "1": "b3" },
    b3: { "0": "b3", "1": "b0" },
  },
  layout: {
    b0: { x: 0.22, y: 0.25 },
    b1: { x: 0.78, y: 0.25 },
    b2: { x: 0.78, y: 0.78 },
    b3: { x: 0.22, y: 0.78 },
  },
  labels: { b0: "B₀", b1: "B₁", b2: "B₂", b3: "B₃" },
};

// ----- §1 examples (gallery) ------------------------------------------

// Subway turnstile. Two moods, two inputs (c = coin, p = push). No
// accepting state — the machine models continuous behaviour, not a
// yes/no language test.
export const turnstile: FSM = {
  states: ["Locked", "Unlocked"],
  alphabet: ["c", "p"],
  start: "Locked",
  accepting: new Set(),
  delta: {
    Locked: { c: "Unlocked", p: "Locked" },
    Unlocked: { c: "Unlocked", p: "Locked" },
  },
  layout: {
    Locked: { x: 0.28, y: 0.5 },
    Unlocked: { x: 0.72, y: 0.5 },
  },
};

// Accepts binary strings ending in 0.
export const endsInZero: FSM = {
  states: ["start", "accept"],
  alphabet: ["0", "1"],
  start: "start",
  accepting: new Set(["accept"]),
  delta: {
    start: { "0": "accept", "1": "start" },
    accept: { "0": "accept", "1": "start" },
  },
  layout: {
    start: { x: 0.28, y: 0.5 },
    accept: { x: 0.72, y: 0.5 },
  },
};

// Accepts binary strings with an even number of 0s. (E is start *and*
// accepting because zero is even.)
export const evenZeros: FSM = {
  states: ["E", "O"],
  alphabet: ["0", "1"],
  start: "E",
  accepting: new Set(["E"]),
  delta: {
    E: { "0": "O", "1": "E" },
    O: { "0": "E", "1": "O" },
  },
  layout: {
    E: { x: 0.28, y: 0.5 },
    O: { x: 0.72, y: 0.5 },
  },
};

// Accepts binary strings containing at least two 1s.
export const atLeastTwoOnes: FSM = {
  states: ["q0", "q1", "q2"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q2"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q1", "1": "q2" },
    q2: { "0": "q2", "1": "q2" },
  },
  layout: {
    q0: { x: 0.18, y: 0.55 },
    q1: { x: 0.5, y: 0.55 },
    q2: { x: 0.82, y: 0.55 },
  },
  labels: { q0: "start", q1: "q₁", q2: "accept" },
};

// Accepts strings of length at most 4. Alphabet kept to a single symbol
// since the only thing that matters is *how many* symbols arrive.
export const lengthAtMost4: FSM = {
  states: ["L0", "L1", "L2", "L3", "L4", "dead"],
  alphabet: ["a"],
  start: "L0",
  accepting: new Set(["L0", "L1", "L2", "L3", "L4"]),
  delta: {
    L0: { a: "L1" },
    L1: { a: "L2" },
    L2: { a: "L3" },
    L3: { a: "L4" },
    L4: { a: "dead" },
    dead: { a: "dead" },
  },
  layout: {
    L0: { x: 0.08, y: 0.3 },
    L1: { x: 0.27, y: 0.3 },
    L2: { x: 0.46, y: 0.3 },
    L3: { x: 0.65, y: 0.3 },
    L4: { x: 0.88, y: 0.3 },
    dead: { x: 0.5, y: 0.82 },
  },
  labels: {
    L0: "L₀",
    L1: "L₁",
    L2: "L₂",
    L3: "L₃",
    L4: "L₄",
    dead: "dead",
  },
};

// Accepts binary strings that start with 1 and end with 0. Demonstrates
// a dead state for "we have already broken the rule, give up."
export const startsOneEndsZero: FSM = {
  states: ["start", "a", "accept", "dead"],
  alphabet: ["0", "1"],
  start: "start",
  accepting: new Set(["accept"]),
  delta: {
    start: { "0": "dead", "1": "a" },
    a: { "0": "accept", "1": "a" },
    accept: { "0": "accept", "1": "a" },
    dead: { "0": "dead", "1": "dead" },
  },
  layout: {
    start: { x: 0.18, y: 0.28 },
    a: { x: 0.78, y: 0.28 },
    accept: { x: 0.78, y: 0.78 },
    dead: { x: 0.18, y: 0.78 },
  },
};

// Divisibility by 3 of a binary-encoded number. States A_i live on
// odd-position reads, B_i on even-position reads; both record the
// alternating-sum residue mod 3. A_i on bit b → B_{(i+b) mod 3};
// B_i on bit b → A_{(i+2b) mod 3} (using a−b ≡ a+2b mod 3).
export const divBy3Binary: FSM = {
  states: ["A0", "A1", "A2", "B0", "B1", "B2"],
  alphabet: ["0", "1"],
  start: "A0",
  accepting: new Set(["A0", "B0"]),
  delta: {
    A0: { "0": "B0", "1": "B1" },
    A1: { "0": "B1", "1": "B2" },
    A2: { "0": "B2", "1": "B0" },
    B0: { "0": "A0", "1": "A2" },
    B1: { "0": "A1", "1": "A0" },
    B2: { "0": "A2", "1": "A1" },
  },
  layout: {
    A0: { x: 0.16, y: 0.22 },
    A1: { x: 0.5, y: 0.22 },
    A2: { x: 0.84, y: 0.22 },
    B0: { x: 0.16, y: 0.78 },
    B1: { x: 0.5, y: 0.78 },
    B2: { x: 0.84, y: 0.78 },
  },
  labels: {
    A0: "A₀",
    A1: "A₁",
    A2: "A₂",
    B0: "B₀",
    B1: "B₁",
    B2: "B₂",
  },
};

// Accepts strings containing the substring "bfs". The alphabet is kept
// small: {b, f, s, x}, where x stands for "any other letter."
export const substringBfs: FSM = {
  states: ["Start", "B", "BF", "A"],
  alphabet: ["b", "f", "s", "x"],
  start: "Start",
  accepting: new Set(["A"]),
  delta: {
    Start: { b: "B", f: "Start", s: "Start", x: "Start" },
    B: { b: "B", f: "BF", s: "Start", x: "Start" },
    BF: { b: "B", f: "Start", s: "A", x: "Start" },
    A: { b: "A", f: "A", s: "A", x: "A" },
  },
  layout: {
    Start: { x: 0.12, y: 0.78 },
    B: { x: 0.4, y: 0.28 },
    BF: { x: 0.65, y: 0.28 },
    A: { x: 0.9, y: 0.78 },
  },
  labels: { Start: "Start", B: "b", BF: "bf", A: "accept" },
};

// Accepts only the exact string "qrmt". Alphabet trimmed to
// {q, r, m, t, x} where x stands for "any other letter."
export const passwordQrmt: FSM = {
  states: ["start", "alpha", "beta", "gamma", "accept", "dead"],
  alphabet: ["q", "r", "m", "t", "x"],
  start: "start",
  accepting: new Set(["accept"]),
  delta: (() => {
    const states = ["start", "alpha", "beta", "gamma", "accept", "dead"];
    const alphabet = ["q", "r", "m", "t", "x"];
    const partial: Record<string, Record<string, string>> = {
      start: { q: "alpha" },
      alpha: { r: "beta" },
      beta: { m: "gamma" },
      gamma: { t: "accept" },
    };
    const delta: Record<string, Record<string, string>> = {};
    for (const s of states) {
      delta[s] = {};
      for (const sym of alphabet) {
        delta[s][sym] = partial[s]?.[sym] ?? "dead";
      }
    }
    return delta;
  })(),
  layout: {
    start: { x: 0.07, y: 0.3 },
    alpha: { x: 0.27, y: 0.3 },
    beta: { x: 0.47, y: 0.3 },
    gamma: { x: 0.67, y: 0.3 },
    accept: { x: 0.92, y: 0.3 },
    dead: { x: 0.5, y: 0.85 },
  },
  labels: {
    start: "start",
    alpha: "α",
    beta: "β",
    gamma: "γ",
    accept: "accept",
    dead: "dead",
  },
};

// ----- §1 exercise solutions ------------------------------------------

// 1(a) Length ≥ 3 and the third symbol is 0.
export const ex1aThirdIsZero: FSM = {
  states: ["q0", "q1", "q2", "ok", "dead"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["ok"]),
  delta: {
    q0: { "0": "q1", "1": "q1" },
    q1: { "0": "q2", "1": "q2" },
    q2: { "0": "ok", "1": "dead" },
    ok: { "0": "ok", "1": "ok" },
    dead: { "0": "dead", "1": "dead" },
  },
  layout: {
    q0: { x: 0.06, y: 0.32 },
    q1: { x: 0.27, y: 0.32 },
    q2: { x: 0.48, y: 0.32 },
    ok: { x: 0.78, y: 0.32 },
    dead: { x: 0.48, y: 0.85 },
  },
  labels: { q0: "q₀", q1: "q₁", q2: "q₂", ok: "accept", dead: "dead" },
};

// 1(b) Even number of 0s AND odd number of 1s.
export const ex1bEvenZerosOddOnes: FSM = {
  states: ["EE", "OE", "EO", "OO"],
  alphabet: ["0", "1"],
  start: "EE",
  accepting: new Set(["EO"]),
  delta: {
    EE: { "0": "OE", "1": "EO" },
    OE: { "0": "EE", "1": "OO" },
    EO: { "0": "OO", "1": "EE" },
    OO: { "0": "EO", "1": "OE" },
  },
  layout: {
    EE: { x: 0.22, y: 0.25 },
    OE: { x: 0.78, y: 0.25 },
    EO: { x: 0.22, y: 0.78 },
    OO: { x: 0.78, y: 0.78 },
  },
};

// 1(c) (start with 1 AND even length) OR (start with 0 AND odd length).
// State name: f<first> _ <length parity>.  T = "started with 1",
// F = "started with 0"; trailing digit is current length mod 2.
export const ex1cStartParity: FSM = {
  states: ["start", "T0", "T1", "F0", "F1"],
  alphabet: ["0", "1"],
  start: "start",
  accepting: new Set(["T1", "F0"]),
  delta: {
    start: { "0": "F0", "1": "T0" },
    T0: { "0": "T1", "1": "T1" },
    T1: { "0": "T0", "1": "T0" },
    F0: { "0": "F1", "1": "F1" },
    F1: { "0": "F0", "1": "F0" },
  },
  layout: {
    start: { x: 0.08, y: 0.5 },
    T0: { x: 0.4, y: 0.22 },
    T1: { x: 0.78, y: 0.22 },
    F0: { x: 0.4, y: 0.78 },
    F1: { x: 0.78, y: 0.78 },
  },
};

// 1(d) Every odd-position symbol is 1.
export const ex1dOddIsOne: FSM = {
  states: ["odd", "even", "dead"],
  alphabet: ["0", "1"],
  start: "odd",
  accepting: new Set(["odd", "even"]),
  delta: {
    odd: { "0": "dead", "1": "even" },
    even: { "0": "odd", "1": "odd" },
    dead: { "0": "dead", "1": "dead" },
  },
  layout: {
    odd: { x: 0.22, y: 0.3 },
    even: { x: 0.78, y: 0.3 },
    dead: { x: 0.5, y: 0.82 },
  },
};

// 1(e) All 0s before all 1s.
export const ex1eZerosBeforeOnes: FSM = {
  states: ["zeros", "ones", "dead"],
  alphabet: ["0", "1"],
  start: "zeros",
  accepting: new Set(["zeros", "ones"]),
  delta: {
    zeros: { "0": "zeros", "1": "ones" },
    ones: { "0": "dead", "1": "ones" },
    dead: { "0": "dead", "1": "dead" },
  },
  layout: {
    zeros: { x: 0.22, y: 0.3 },
    ones: { x: 0.78, y: 0.3 },
    dead: { x: 0.5, y: 0.82 },
  },
};

// (2) HATE QRMT — accept exactly the strings "hate" and "qrmt".
// Alphabet trimmed to {a, e, h, m, q, r, t, x}; x stands for "any other
// letter."
export const exHateQrmt: FSM = {
  states: [
    "start",
    "h", "ha", "hat", "hate",
    "q", "qr", "qrm", "qrmt",
    "dead",
  ],
  alphabet: ["a", "e", "h", "m", "q", "r", "t", "x"],
  start: "start",
  accepting: new Set(["hate", "qrmt"]),
  delta: (() => {
    const states = [
      "start",
      "h", "ha", "hat", "hate",
      "q", "qr", "qrm", "qrmt",
      "dead",
    ];
    const alphabet = ["a", "e", "h", "m", "q", "r", "t", "x"];
    const partial: Record<string, Record<string, string>> = {
      start: { h: "h", q: "q" },
      h: { a: "ha" },
      ha: { t: "hat" },
      hat: { e: "hate" },
      q: { r: "qr" },
      qr: { m: "qrm" },
      qrm: { t: "qrmt" },
    };
    const out: Record<string, Record<string, string>> = {};
    for (const s of states) {
      out[s] = {};
      for (const sym of alphabet) {
        out[s][sym] = partial[s]?.[sym] ?? "dead";
      }
    }
    return out;
  })(),
  layout: {
    start: { x: 0.04, y: 0.5 },
    h: { x: 0.2, y: 0.18 },
    ha: { x: 0.38, y: 0.18 },
    hat: { x: 0.56, y: 0.18 },
    hate: { x: 0.78, y: 0.18 },
    q: { x: 0.2, y: 0.82 },
    qr: { x: 0.38, y: 0.82 },
    qrm: { x: 0.56, y: 0.82 },
    qrmt: { x: 0.78, y: 0.82 },
    dead: { x: 0.95, y: 0.5 },
  },
  labels: {
    start: "ε", h: "h", ha: "ha", hat: "hat", hate: "hate",
    q: "q", qr: "qr", qrm: "qrm", qrmt: "qrmt", dead: "dead",
  },
};

// (4) Every 0 immediately followed by 1.
export const exZeroFollowedByOne: FSM = {
  states: ["safe", "pending", "dead"],
  alphabet: ["0", "1"],
  start: "safe",
  accepting: new Set(["safe"]),
  delta: {
    safe: { "0": "pending", "1": "safe" },
    pending: { "0": "dead", "1": "safe" },
    dead: { "0": "dead", "1": "dead" },
  },
  layout: {
    safe: { x: 0.22, y: 0.3 },
    pending: { x: 0.78, y: 0.3 },
    dead: { x: 0.5, y: 0.82 },
  },
};

// (5) Length is a multiple of 3 AND the string ends in 1.
// State name: l<len mod 3>_<last symbol>.
export const exMod3EndsInOne: FSM = {
  states: ["start", "l1_0", "l1_1", "l2_0", "l2_1", "l0_0", "l0_1"],
  alphabet: ["0", "1"],
  start: "start",
  accepting: new Set(["l0_1"]),
  delta: {
    start: { "0": "l1_0", "1": "l1_1" },
    l1_0: { "0": "l2_0", "1": "l2_1" },
    l1_1: { "0": "l2_0", "1": "l2_1" },
    l2_0: { "0": "l0_0", "1": "l0_1" },
    l2_1: { "0": "l0_0", "1": "l0_1" },
    l0_0: { "0": "l1_0", "1": "l1_1" },
    l0_1: { "0": "l1_0", "1": "l1_1" },
  },
  layout: {
    start: { x: 0.05, y: 0.5 },
    l1_0: { x: 0.27, y: 0.22 },
    l1_1: { x: 0.27, y: 0.78 },
    l2_0: { x: 0.55, y: 0.22 },
    l2_1: { x: 0.55, y: 0.78 },
    l0_0: { x: 0.85, y: 0.22 },
    l0_1: { x: 0.85, y: 0.78 },
  },
  labels: {
    start: "start",
    l1_0: "1·0", l1_1: "1·1",
    l2_0: "2·0", l2_1: "2·1",
    l0_0: "0·0", l0_1: "0·1",
  },
};

// (6) Accept exactly the strings "start", "stop", "pause".
// Alphabet: {a, e, p, r, s, t, u, x} where x is "any other letter."
export const exStartStopPause: FSM = {
  states: [
    "init",
    "s", "st", "sta", "star", "start_w",
    "sto", "stop_w",
    "p", "pa", "pau", "paus", "pause_w",
    "dead",
  ],
  alphabet: ["a", "e", "o", "p", "r", "s", "t", "u", "x"],
  start: "init",
  accepting: new Set(["start_w", "stop_w", "pause_w"]),
  delta: (() => {
    const states = [
      "init",
      "s", "st", "sta", "star", "start_w",
      "sto", "stop_w",
      "p", "pa", "pau", "paus", "pause_w",
      "dead",
    ];
    const alphabet = ["a", "e", "o", "p", "r", "s", "t", "u", "x"];
    const partial: Record<string, Record<string, string>> = {
      init: { s: "s", p: "p" },
      s: { t: "st" },
      st: { a: "sta", o: "sto" },
      sta: { r: "star" },
      star: { t: "start_w" },
      sto: { p: "stop_w" },
      p: { a: "pa" },
      pa: { u: "pau" },
      pau: { s: "paus" },
      paus: { e: "pause_w" },
    };
    const out: Record<string, Record<string, string>> = {};
    for (const s of states) {
      out[s] = {};
      for (const sym of alphabet) {
        out[s][sym] = partial[s]?.[sym] ?? "dead";
      }
    }
    return out;
  })(),
  layout: {
    init: { x: 0.05, y: 0.5 },
    s: { x: 0.18, y: 0.22 },
    st: { x: 0.30, y: 0.22 },
    sta: { x: 0.43, y: 0.18 },
    star: { x: 0.57, y: 0.18 },
    start_w: { x: 0.75, y: 0.18 },
    sto: { x: 0.43, y: 0.40 },
    stop_w: { x: 0.60, y: 0.40 },
    p: { x: 0.18, y: 0.78 },
    pa: { x: 0.32, y: 0.78 },
    pau: { x: 0.46, y: 0.78 },
    paus: { x: 0.60, y: 0.78 },
    pause_w: { x: 0.78, y: 0.78 },
    dead: { x: 0.95, y: 0.5 },
  },
  labels: {
    init: "ε",
    s: "s", st: "st", sta: "sta", star: "star", start_w: "start ✓",
    sto: "sto", stop_w: "stop ✓",
    p: "p", pa: "pa", pau: "pau", paus: "paus", pause_w: "pause ✓",
    dead: "dead",
  },
};

// ----- §2 examples and reverse-engineering exercises ------------------

// Even number of 0s AND even number of 1s. Two parity bits, four states.
export const evenZerosEvenOnes: FSM = {
  states: ["EE", "OE", "EO", "OO"],
  alphabet: ["0", "1"],
  start: "EE",
  accepting: new Set(["EE"]),
  delta: {
    EE: { "0": "OE", "1": "EO" },
    OE: { "0": "EE", "1": "OO" },
    EO: { "0": "OO", "1": "EE" },
    OO: { "0": "EO", "1": "OE" },
  },
  layout: {
    EE: { x: 0.22, y: 0.25 },
    OE: { x: 0.78, y: 0.25 },
    EO: { x: 0.22, y: 0.78 },
    OO: { x: 0.78, y: 0.78 },
  },
};

// Mystery 1 — accepts strings of even length. Two states with both
// symbols toggling between them.
export const mystery1: FSM = {
  states: ["p", "q"],
  alphabet: ["0", "1"],
  start: "p",
  accepting: new Set(["p"]),
  delta: {
    p: { "0": "q", "1": "q" },
    q: { "0": "p", "1": "p" },
  },
  layout: {
    p: { x: 0.3, y: 0.5 },
    q: { x: 0.7, y: 0.5 },
  },
};

// Mystery 2 — contains the substring "00".
export const mystery2: FSM = {
  states: ["s0", "s1", "s2"],
  alphabet: ["0", "1"],
  start: "s0",
  accepting: new Set(["s2"]),
  delta: {
    s0: { "0": "s1", "1": "s0" },
    s1: { "0": "s2", "1": "s0" },
    s2: { "0": "s2", "1": "s2" },
  },
  layout: {
    s0: { x: 0.18, y: 0.72 },
    s1: { x: 0.5, y: 0.22 },
    s2: { x: 0.82, y: 0.72 },
  },
};

// Mystery 3 — count of 1s divisible by 3 (state names hide it).
export const mystery3: FSM = {
  states: ["A", "B", "C"],
  alphabet: ["0", "1"],
  start: "A",
  accepting: new Set(["A"]),
  delta: {
    A: { "0": "A", "1": "B" },
    B: { "0": "B", "1": "C" },
    C: { "0": "C", "1": "A" },
  },
  layout: {
    A: { x: 0.5, y: 0.2 },
    B: { x: 0.78, y: 0.72 },
    C: { x: 0.22, y: 0.72 },
  },
};

// Mystery 4 — accepts non-empty strings of all 0s.
export const mystery4: FSM = {
  states: ["start", "a", "dead"],
  alphabet: ["0", "1"],
  start: "start",
  accepting: new Set(["a"]),
  delta: {
    start: { "0": "a", "1": "dead" },
    a: { "0": "a", "1": "dead" },
    dead: { "0": "dead", "1": "dead" },
  },
  layout: {
    start: { x: 0.18, y: 0.3 },
    a: { x: 0.78, y: 0.3 },
    dead: { x: 0.5, y: 0.82 },
  },
};

// Mystery 5 — contains the substring "ab" (alphabet {a, b}).
export const mystery5: FSM = {
  states: ["s", "x", "y"],
  alphabet: ["a", "b"],
  start: "s",
  accepting: new Set(["y"]),
  delta: {
    s: { a: "x", b: "s" },
    x: { a: "x", b: "y" },
    y: { a: "y", b: "y" },
  },
  layout: {
    s: { x: 0.18, y: 0.72 },
    x: { x: 0.5, y: 0.22 },
    y: { x: 0.82, y: 0.72 },
  },
};

// Schematic for the Loop Lemma: q0 ──u──▶ qi ↪v↩ ──w──▶ qn.
// The "alphabet" is u/v/w — these are stand-ins for blocks of input.
export const loopSchematic: FSM = {
  states: ["q0", "qi", "qn"],
  alphabet: ["u", "v", "w"],
  start: "q0",
  accepting: new Set(["qn"]),
  delta: {
    q0: { u: "qi" },
    qi: { v: "qi", w: "qn" },
    qn: {},
  },
  layout: {
    q0: { x: 0.14, y: 0.55 },
    qi: { x: 0.5, y: 0.55 },
    qn: { x: 0.86, y: 0.55 },
  },
  labels: { q0: "q₀", qi: "qᵢ", qn: "qₙ" },
};
