// Every sentence a student can see from the machine builder, in one place.
// Plain English, no em-dashes, no semicolons.

const show = (w: string) => (w === "" ? "the empty string" : w);

export const MSG = {
  // Check.
  noStates: "Add a state first.",
  missing: (n: number) =>
    n === 1
      ? "One arrow is missing. Every state needs an arrow for every symbol. The empty knob is ringed in red."
      : `${n} arrows are missing. Every state needs an arrow for every symbol. The empty knobs are ringed in red.`,
  wrong: (word: string, accepts: boolean) =>
    `Not yet. Your machine ${accepts ? "accepts" : "rejects"} ${show(word)}, but it should ${accepts ? "reject" : "accept"} it. ` +
    `That string is loaded below, so you can walk through it.`,
  right: "Correct. Your machine accepts exactly the right strings, at every length.",
  fewerPossible: "It can also be done with fewer states.",
  fewestReached: "No machine does it with fewer states.",
  shouldEnd: (accept: boolean) => (accept ? "should accept" : "should reject"),

  // Hints under the canvas.
  emptyCanvas: "Tap Add a state. The first state you add is the start.",
  hint: "Drag a coloured knob onto a state to draw that arrow. Drag a state to move it. Double-tap a state to make it accepting.",
  armed: "Now tap the state this arrow should go to, or tap empty space to cancel.",
  full: (n: number) => `The canvas holds at most ${n} states.`,

  // The tape.
  tryLabel: "Try a string",
  placeholder: "type 0s and 1s",
  atStart: (s: string) => `Not started. The machine is in ${s}, the start.`,
  midway: (k: number, n: number, s: string) => `Read ${k} of ${n}. The machine is in ${s}.`,
  endAccept: (s: string) => `It ends in ${s}, an accepting state. Accepted.`,
  endReject: (s: string) => `It ends in ${s}, which is not accepting. Rejected.`,
  stuck: (s: string, a: string) => `${s} has no arrow for ${a}, so the machine cannot go on.`,
  noStart: "There is no state yet.",
  emptyWord: "The empty string: the machine reads nothing and stays at the start.",
} as const;
