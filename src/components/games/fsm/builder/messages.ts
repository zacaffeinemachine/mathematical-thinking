// Every sentence a student can see from the machine builder, in one place.
// Plain English, no em-dashes, no semicolons.

const show = (w: string) => (w === "" ? "the empty string" : w);
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export const MSG = {
  // Check.
  noStart: "Add a start state first.",
  unlabeled: (n: number) =>
    n === 1
      ? "An arrow has no label yet. Double-click it to label it. It is marked."
      : `${n} arrows have no label yet. Double-click an arrow to label it. They are marked.`,
  clash: (state: string, sym: string) =>
    `Two arrows leaving ${state} are labelled ${sym}. A state may have only one arrow for each symbol. They are marked.`,
  missing: (items: string[], more: number) =>
    `Not every state has an arrow for every symbol: ${list(items)}${more > 0 ? `, and ${more} more` : ""}. The states are marked.`,
  missingItem: (state: string, sym: string) => `${state} has none for ${sym}`,
  wrong: (word: string, accepts: boolean) =>
    `Not yet. Your machine ${accepts ? "accepts" : "rejects"} ${show(word)}, but it should ${accepts ? "reject" : "accept"} it. ` +
    `That string is loaded below, so you can walk through it.`,
  right: "Correct. Your machine accepts exactly the right strings, at every length.",
  fewerPossible: "It can also be done with fewer states.",
  fewestReached: "No machine does it with fewer states.",
  shouldEnd: (accept: boolean) => (accept ? "should accept" : "should reject"),

  // Editing.
  startExists: "There is already a start state.",
  full: (n: number) => `The canvas holds at most ${n} states.`,
  edgeExists: (a: string, b: string) => `There is already an arrow from ${a} to ${b}. Double-click it to change its label.`,
  badLabel: (alphabet: string[]) => `A label may use only ${list(alphabet)}, separated by commas.`,
  badName: "A name needs at least one letter or digit.",
  nameTaken: (n: string) => `Another state is already called ${n}.`,

  // Hints under the canvas.
  emptyCanvas: "Press Add start state to begin.",
  hint: "Click a state and then another to draw an arrow. Double-click a state to rename it, or an arrow to label it. Drag a state to move it, or an arrow to bend it.",
  stateSelected: (n: string) =>
    `${n} is selected. Click another state to draw an arrow from ${n}, or click ${n} again for an arrow back to itself. Click empty space to cancel.`,
  edgeSelected: "Drag the arrow to bend it. Double-click it to label it, or press Delete to remove it.",
  resize: "Drag to make the canvas taller or shorter",

  // The tape.
  tryLabel: "Try a string",
  placeholder: "type 0s and 1s",
  atStart: (s: string) => `Not started. The machine is in ${s}, the start.`,
  midway: (k: number, n: number, s: string) => `Read ${k} of ${n}. The machine is in ${s}.`,
  endAccept: (s: string) => `It ends in ${s}, an accepting state. Accepted.`,
  endReject: (s: string) => `It ends in ${s}, which is not accepting. Rejected.`,
  stuckNone: (s: string, a: string) => `${s} has no arrow for ${a}, so the machine cannot go on.`,
  stuckTwo: (s: string, a: string) => `${s} has two arrows for ${a}, so the machine cannot choose.`,
  emptyWord: "The empty string: the machine reads nothing and stays at the start.",
} as const;
