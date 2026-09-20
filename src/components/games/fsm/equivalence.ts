import type { FSM } from "./model";

// ---------------------------------------------------------------------
//  Machines for "Do These Agree?" (machines/same-language)
// ---------------------------------------------------------------------
//
//  Five pairs. The reader is asked whether the two machines of a pair
//  accept exactly the same strings, and is given the XOR runner to hunt
//  with. So, three rules govern everything in this file:
//
//  1. NO `meaning` AND NO `labels`. Every state is a bare q0, q1, ... A
//     gloss on a state says what the machine is for, which is the answer.
//  2. NO MACHINE HERE MAY BE A RELABELLING OF ONE ON `fsm-intro`. That
//     page explains its machines' states in full, so a diagram reused
//     from it arrives with its language already published. `check` in the
//     session notes tests this by isomorphism, not by eye.
//  3. The comments below say what each machine accepts. They are stripped
//     from the bundle, and they are the only record of it: the page must
//     not say, and there is no answer key.
//
//  Shortest witnesses, for the record (a witness is a string accepted by
//  exactly one of the pair, so it proves the two disagree):
//
//    pair 1  none, the two agree
//    pair 2  1001
//    pair 3  none, the two agree
//    pair 4  111
//    pair 5  11011
//
//  Re-derive these with the checker after any edit. A pair that quietly
//  becomes equal, or quietly stops being equal, turns its problem into a
//  lie that nothing on the page would catch.

// --- Pair 1 -----------------------------------------------------------
//  Both accept: an even number of 1s.
//  The lesson is that a count of states is no guide at all: B carries a
//  second parity it never consults.

// Two states, the obvious way.
export const parityPlain: FSM = {
  states: ["q0", "q1"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q0"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q1", "1": "q0" },
  },
  layout: {
    q0: { x: 0.28, y: 0.5 },
    q1: { x: 0.72, y: 0.5 },
  },
};

// Four states: (parity of 1s, parity of 0s), accepting on the 1s alone.
// q0 = (even, even), q1 = (even, odd), q2 = (odd, even), q3 = (odd, odd).
export const parityPadded: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q0", "q1"]),
  delta: {
    q0: { "0": "q1", "1": "q2" },
    q1: { "0": "q0", "1": "q3" },
    q2: { "0": "q3", "1": "q0" },
    q3: { "0": "q2", "1": "q1" },
  },
  layout: {
    q0: { x: 0.22, y: 0.24 },
    q1: { x: 0.78, y: 0.24 },
    q2: { x: 0.22, y: 0.78 },
    q3: { x: 0.78, y: 0.78 },
  },
};

// --- Pair 2 -----------------------------------------------------------
//  A accepts: 101 appears as a block of three consecutive symbols.
//  B accepts: a 1, then later a 0, then later a 1, gaps allowed.
//  One arrow apart on the page. 1001 separates them.

export const substring101: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q3"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q2", "1": "q1" },
    q2: { "0": "q0", "1": "q3" },
    q3: { "0": "q3", "1": "q3" },
  },
  layout: {
    q0: { x: 0.20, y: 0.26 },
    q1: { x: 0.76, y: 0.26 },
    q2: { x: 0.76, y: 0.76 },
    q3: { x: 0.20, y: 0.76 },
  },
};

export const subsequence101: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q3"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q2", "1": "q1" },
    q2: { "0": "q2", "1": "q3" },
    q3: { "0": "q3", "1": "q3" },
  },
  layout: {
    q0: { x: 0.20, y: 0.26 },
    q1: { x: 0.76, y: 0.26 },
    q2: { x: 0.76, y: 0.76 },
    q3: { x: 0.20, y: 0.76 },
  },
};

// --- Pair 3 -----------------------------------------------------------
//  A accepts: an even number of 1s and an even number of 0s.
//  B accepts: an even number of 1s and an even length.
//  The same four circles with the same one accepting, wired differently,
//  and they agree: once the 1s are even, even length and even 0s say the
//  same thing.

// q0 = (1s even, 0s even), q1 = (even, odd), q2 = (odd, even), q3 = (odd, odd).
export const evenOnesEvenZeros: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q0"]),
  delta: {
    q0: { "0": "q1", "1": "q2" },
    q1: { "0": "q0", "1": "q3" },
    q2: { "0": "q3", "1": "q0" },
    q3: { "0": "q2", "1": "q1" },
  },
  layout: {
    q0: { x: 0.22, y: 0.24 },
    q1: { x: 0.78, y: 0.24 },
    q2: { x: 0.22, y: 0.78 },
    q3: { x: 0.78, y: 0.78 },
  },
};

// q0 = (length even, 1s even), q1 = (odd, even), q2 = (even, odd), q3 = (odd, odd).
export const evenOnesEvenLength: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q0"]),
  delta: {
    q0: { "0": "q1", "1": "q3" },
    q1: { "0": "q0", "1": "q2" },
    q2: { "0": "q3", "1": "q1" },
    q3: { "0": "q2", "1": "q0" },
  },
  layout: {
    q0: { x: 0.22, y: 0.24 },
    q1: { x: 0.78, y: 0.24 },
    q2: { x: 0.22, y: 0.78 },
    q3: { x: 0.78, y: 0.78 },
  },
};

// --- Pair 4 -----------------------------------------------------------
//  A accepts: 11 appears somewhere, i.e. some block of 1s has length 2
//  or more.
//  B accepts: some block of 1s has even length.
//  "At least two" against "an even number". 111 separates them.

export const containsEleven: FSM = {
  states: ["q0", "q1", "q2"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q2"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q0", "1": "q2" },
    q2: { "0": "q2", "1": "q2" },
  },
  layout: {
    q0: { x: 0.18, y: 0.30 },
    q1: { x: 0.55, y: 0.30 },
    q2: { x: 0.85, y: 0.78 },
  },
};

// q0 = outside a block, none of the closed blocks was even.
// q1 = inside a block, odd so far.  q2 = inside a block, even so far.
// q3 = an even block has been closed, and nothing can undo that.
export const someEvenBlockOfOnes: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q2", "q3"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q0", "1": "q2" },
    q2: { "0": "q3", "1": "q1" },
    q3: { "0": "q3", "1": "q3" },
  },
  layout: {
    q0: { x: 0.14, y: 0.28 },
    q1: { x: 0.44, y: 0.28 },
    q2: { x: 0.74, y: 0.28 },
    q3: { x: 0.62, y: 0.82 },
  },
};

// --- Pair 5 -----------------------------------------------------------
//  A accepts: 11 appears at two different starting positions, overlaps
//  counted, so 111 already contains two of them.
//  B accepts: 111 appears.
//  B's strings are all of A's, and the shortest string that is A's alone
//  is 11011, which is well past the length anyone pokes at by hand.

// q0 = no 11 yet, last symbol not 1.  q1 = no 11 yet, in a run of one 1.
// q2 = one 11 so far, last symbol is 1.  q3 = one 11 so far, last not 1.
// q4 = two, and it sticks.
export const twoElevens: FSM = {
  states: ["q0", "q1", "q2", "q3", "q4"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q4"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q0", "1": "q2" },
    q2: { "0": "q3", "1": "q4" },
    q3: { "0": "q3", "1": "q2" },
    q4: { "0": "q4", "1": "q4" },
  },
  layout: {
    q0: { x: 0.12, y: 0.30 },
    q1: { x: 0.37, y: 0.30 },
    q2: { x: 0.62, y: 0.30 },
    q3: { x: 0.62, y: 0.82 },
    q4: { x: 0.88, y: 0.56 },
  },
};

export const containsOneOneOne: FSM = {
  states: ["q0", "q1", "q2", "q3"],
  alphabet: ["0", "1"],
  start: "q0",
  accepting: new Set(["q3"]),
  delta: {
    q0: { "0": "q0", "1": "q1" },
    q1: { "0": "q0", "1": "q2" },
    q2: { "0": "q0", "1": "q3" },
    q3: { "0": "q3", "1": "q3" },
  },
  layout: {
    q0: { x: 0.12, y: 0.72 },
    q1: { x: 0.40, y: 0.24 },
    q2: { x: 0.72, y: 0.24 },
    q3: { x: 0.90, y: 0.76 },
  },
};
