import type { Question } from "../MCQ.tsx";

// ---------------------------------------------------------------------------
//  Question banks for Chapter 2, Logical Thinking.
//
//  Every entry is keyed against a point in Chapters/Logical-Thinking.tex, named
//  in the comment above it. Check the .tex, never SUMMARY.md — the summary is
//  stale for this chapter in several places.
//
//  Two rules, both load-bearing because the student never sees an explanation:
//    • Distractors must be unambiguously wrong — refutable by a specific line
//      of the chapter. An "arguably also correct" option strands the reader.
//    • Answers are read off the text, not recalled.
//
//  `answer: number` is a single-answer question; `answer: number[]` is
//  select-all-that-apply, graded on exact set equality.
// ---------------------------------------------------------------------------

// ===========================================================================
//  §2.1 — And, Or, and Not
// ===========================================================================

export const andOrNot: Question[] = [
  {
    // Point 189 — deny "both hold" ⇒ "at least one fails", then combine with a
    // known half. Two steps; the book never runs this scenario.
    prompt:
      "A librarian's record says: *Anand returned the book and paid the fine.* The record turns out to be false. Anand did return the book. What follows?",
    options: [
      "He neither returned the book nor paid the fine",
      "He did not pay the fine",
      "He paid the fine",
      "Nothing follows about the fine",
    ],
    answer: 1,
  },
  {
    // Point 189 — deny "at least one holds" ⇒ "both fail". The tempting reading
    // is the weaker one.
    // The prompt spells out the inclusive reading on purpose. Do NOT reword
    // this as "Either the lift is working or the ramp is open": denying an
    // EXCLUSIVE or leaves "both working" open as well as "neither", so the
    // keyed answer would stop being forced and a student reading "either …
    // or" the everyday way would be marked wrong for sound reasoning.
    prompt:
      "A notice claims: *The lift is working or the ramp is open* — where *or* carries its usual meaning of at least one, possibly both. The notice turns out to be false. A visitor arrives pushing a heavy trolley. What can they count on?",
    options: [
      "At least one of the two is unavailable, but possibly not both",
      "Neither the lift nor the ramp is available",
      "The lift is unavailable, but the ramp may still be open",
      "Exactly one of the two is unavailable",
    ],
    answer: 1,
  },
  {
    // Point 146 — denial is not the opposite; a fresh claim with a wide middle.
    prompt:
      "A report states only that *the water in the tank is not cold.* Which descriptions of the water are consistent with that report?",
    options: [
      "It is cold",
      "It is lukewarm",
      "It is warm",
      "It is scalding",
    ],
    answer: [1, 2, 3],
  },
  {
    // Point 146 — the boundary the everyday reading quietly loses. Fresh
    // instance of the "not greater than five" trap.
    prompt:
      "A competition rule reads: *Entries that are not longer than 500 words will be accepted.* Meera submits an entry of exactly 500 words. What happens?",
    options: [
      "It is rejected",
      "It is accepted only if no shorter entry is submitted",
      "The rule does not settle it",
      "It is accepted",
    ],
    answer: 3,
  },
  {
    // Point 109 — the convention against the everyday instinct, which here says
    // "exactly one" because the sentence is an offer.
    prompt:
      "A canteen sign reads: *With any meal you may take a fruit or a juice.* A student takes both. Under our convention, has the student gone against the sign?",
    options: [
      "No — *or* asks for at least one, and taking both meets that",
      "Yes, unless the meal was paid for separately",
      "The sign does not say either way",
      "Yes — an offer of this kind means exactly one",
    ],
    answer: 0,
  },
  {
    // Point 189 + Point 227 — recognise De Morgan in an unfamiliar pair.
    prompt:
      "Are these two sentences the same claim? (i) *It is not true that the printer and the scanner are both working.* (ii) *The printer is not working, or the scanner is not working.*",
    options: [
      "Only when exactly one of the two machines has failed",
      "No — the first is about the pair and the second is about each machine",
      "No — the second allows both to have failed and the first does not",
      "Yes — each is true in exactly the situations where at least one machine has failed",
    ],
    answer: 3,
  },
  {
    // Point 189 — the same setup, but now the tempting misreading. Sits next to
    // the previous question deliberately.
    prompt:
      "Same two machines. Is *It is not true that the printer and the scanner are both working* the same claim as *Neither the printer nor the scanner is working*?",
    options: [
      "Yes — both say the pair has failed",
      "Yes, provided at least one machine has failed",
      "No — the second is stronger, and a working printer beside a broken scanner separates them",
      "No — the second is weaker, and a working printer beside a broken scanner separates them",
    ],
    answer: 2,
  },
  {
    // Point 146 — double denial, buried in officialese so it has to be unwound.
    prompt:
      "Minutes of a meeting record: *It is not the case that the proposal was not rejected.* What became of the proposal?",
    options: [
      "It was neither accepted nor rejected",
      "It was rejected",
      "The minutes do not settle it",
      "It was accepted",
    ],
    answer: 1,
  },
  {
    // Point 72 — the convention drops order and cause. Fresh witnesses, and the
    // question is whether two statements conflict.
    prompt:
      "Two witnesses are asked what happened. The first says *the alarm rang and the door opened.* The second says *the door opened and the alarm rang.* Under our convention, have the two witnesses said different things?",
    options: [
      "It cannot be decided without knowing the times",
      "Yes — the first suggests the alarm opened the door",
      "Yes — they disagree about which happened first",
      "No — they have made the same claim",
    ],
    answer: 3,
  },
  {
    // Points 146 + 189 chained. Genuinely multi-step: no single line of the
    // chapter answers it.
    prompt:
      "Two switches sit on a panel. It is false that switches A and B are both up. It is also false that switch B is down. What is the position of switch A?",
    options: [
      "Up",
      "Down",
      "The two claims cannot both hold",
      "Either — it is not settled",
    ],
    answer: 1,
  },
  {
    // Point 189 — what it takes to make good on a denial. The weaker accusation
    // needs less evidence than students expect.
    prompt:
      "A student claims: *I attended the seminar and I submitted the report.* The tutor replies that this is not true. Which findings, on their own, would be enough to justify the tutor?",
    options: [
      "The student attended the seminar",
      "The report was never submitted",
      "The student missed the seminar and never submitted the report",
      "The student missed the seminar",
    ],
    answer: [1, 2, 3],
  },
  {
    // Point 146 — "a claim and its denial can never both be true, nor both
    // false". Applied to a dispute rather than stated.
    prompt:
      "A tribunal must decide whether a notice was displayed. One member reports that it was displayed; another reports that it was not. Which is right?",
    options: [
      "They cannot both be right, but they could both be wrong",
      "They could both be right and they could both be wrong",
      "They could both be right, but they cannot both be wrong",
      "They cannot both be right, and they cannot both be wrong",
    ],
    answer: 3,
  },
];

// ===========================================================================
//  §2.2 — Quantifiers
// ===========================================================================

export const quantifiers: Question[] = [
  {
    // Point 417 — refuting an *every* claim takes one case, not a survey.
    prompt:
      "A warden claims: *Every locker in this corridor is locked.* You are convinced the warden is wrong. What is the least you must do to show it?",
    options: [
      "Show that no locker in the corridor is locked",
      "Find one unlocked locker",
      "Find that most of the lockers are unlocked",
      "Check every locker in the corridor",
    ],
    answer: 1,
  },
  {
    // Point 417 — refuting a *some* claim is the expensive direction.
    prompt:
      "A student claims: *Some jar on this shelf contains salt.* What would it take to show the student is wrong?",
    options: [
      "Show that most of the jars hold something other than salt",
      "Open one jar and find no salt in it",
      "Open one jar and find salt in it",
      "Open every jar on the shelf and find salt in none of them",
    ],
    answer: 3,
  },
  {
    // Point 374 — *some* carries no hint of *not all*.
    prompt:
      "A club secretary reports: *Some members have paid the fee.* It later emerges that every single member had in fact paid. Was the secretary's report false?",
    options: [
      "Yes — reporting *some* when all had paid is a false report",
      "No — *some* asks for at least one, and that leaves *all* open",
      "The report was neither true nor false",
      "Yes, unless the secretary did not know that all had paid",
    ],
    answer: 1,
  },
  {
    // Point 467 — the denial of *every* is *some … not*.
    prompt:
      "A coach announces: *Every player turned up to practice.* The captain says that is not true. What has the captain claimed?",
    options: [
      "That at least one player did not turn up",
      "That most of the players did not turn up",
      "That exactly one player did not turn up",
      "That no player turned up",
    ],
    answer: 0,
  },
  {
    // Point 467 — a wrong denial can itself be false.
    prompt:
      "In a squad of twenty, nineteen players turned up and one did not. The captain replies to the coach: *So nobody turned up!* What is wrong with that reply?",
    options: [
      "It is false only because the captain did not count the squad",
      "It is itself false — the denial claims only that at least one player was missing",
      "Nothing — it is the correct denial of the coach's announcement",
      "It is true but says less than the denial allows",
    ],
    answer: 1,
  },
  {
    // Point 437 — quantifier order, verified by exhaustion on a 5x5 matching.
    prompt:
      "A photography club owns five cameras and five lenses. Each lens fits exactly one camera, and each camera is fitted by exactly one lens. Which of these are true of the club?",
    options: [
      "There is some lens that fits every camera",
      "Every camera has some lens that fits it",
      "There is some camera that every lens fits",
      "Every lens fits some camera",
    ],
    answer: [1, 3],
  },
  {
    // Point 437 — which order the planner actually needs.
    prompt:
      "A planner wants to hold one meeting that the whole class can attend. Which claim does the planner need to be true?",
    options: [
      "Every student has some afternoon free",
      "There is some afternoon that every student has free",
      "Every afternoon is free for some student",
      "Some student has every afternoon free",
    ],
    answer: 1,
  },
  {
    // Point 467 — denying a two-quantifier sentence, one word at a time.
    prompt:
      "What would have to be the case for *There is some afternoon that every student has free* to be false?",
    options: [
      "Some afternoon has at least one student who is busy",
      "Every afternoon has at least one student who is busy",
      "Every student is busy every afternoon",
      "Some student is busy every afternoon",
    ],
    answer: 1,
  },
  {
    // Point 510 — a fresh run of agreeing cases before the claim collapses.
    // 11, 31, 41, 61, 71 and 101 are prime; 21 = 3 x 7 is not.
    prompt:
      "Someone checks 11, 31 and 41, finds all three prime, and claims that every whole number ending in 1 is prime. Which number below finishes the claim off?",
    options: [
      "21",
      "61",
      "71",
      "101",
    ],
    answer: 0,
  },
  {
    // Point 510 — agreeing cases establish nothing about the whole group.
    prompt:
      "A shopkeeper claims *every bulb in this box works.* You test three bulbs and all three work. What have you established about the claim?",
    options: [
      "That the claim is false",
      "That the claim is true of the box as a whole",
      "That the claim is true",
      "Nothing — testing part of the box cannot settle a claim about all of it",
    ],
    answer: 3,
  },
  {
    // Point 467 — the strength ordering of every / some / no.
    prompt:
      "Three notices are posted about one shelf of jars: (a) *every jar is sealed*; (b) *some jar is sealed*; (c) *no jar is sealed*. You find a single unsealed jar. Which notices does it make false?",
    options: [
      "Only (a)",
      "(a) and (c)",
      "(a) and (b)",
      "Only (c)",
    ],
    answer: 0,
  },
  {
    // Point 467 — the denial of a *no* claim.
    prompt:
      "A notice reads: *No bicycle may be parked here.* A warden reports that the notice is not being obeyed. What has the warden claimed?",
    options: [
      "That every bicycle in the college is parked there",
      "That most of the bicycles parked there should not be",
      "That at least one bicycle is parked there",
      "That no bicycle is parked there",
    ],
    answer: 2,
  },
];

// ===========================================================================
//  §2.3 — Conditionals
// ===========================================================================

export const conditionals: Question[] = [
  {
    // Point 648 — the single falsifying situation, on a fresh notice.
    prompt:
      "A nursery's sign reads: *If a plant is kept in this shade house, it is watered daily.* Which single observation would show the sign to be false?",
    options: [
      "A plant kept outside the shade house that was not watered daily",
      "A plant kept in the shade house that was not watered daily",
      "A plant kept outside the shade house that was watered daily",
      "A plant kept in the shade house that was watered daily",
    ],
    answer: 1,
  },
  {
    // Point 648 — the rows readers object to.
    prompt:
      "A plant that has never been inside the shade house turns out to have been watered daily anyway. What does that do to the sign?",
    options: [
      "Nothing — the sign says nothing about plants kept outside the shade house",
      "It makes the sign false, since the plant was watered without meeting the condition",
      "It makes the sign neither true nor false",
      "It makes the sign true only if some shade-house plant was also watered",
    ],
    answer: 0,
  },
  {
    // Point 698 — an if-part that never occurs.
    prompt:
      "A club rule reads: *If a member arrives after midnight, they must sign the late book.* No member has ever arrived after midnight. What can we say about the rule?",
    options: [
      "Nothing can make it false, and it tells us nothing about who has signed the book",
      "It is neither true nor false until somebody arrives after midnight",
      "It is true, and it tells us that nobody has signed the late book",
      "It is false, because its condition has never been met",
    ],
    answer: 0,
  },
  {
    // Point 698 — the empty collection, settled by reading it as a conditional.
    prompt:
      "A shelf holds no glass jars at all. Someone claims: *Every glass jar on this shelf is cracked.* Is the claim true?",
    options: [
      "No — there are no glass jars for it to be true of",
      "No — a claim about nothing is false",
      "Yes — no glass jar can be produced against it, so it cannot fail",
      "It is neither true nor false",
    ],
    answer: 2,
  },
  {
    // Point 698 — a then-part that always occurs.
    prompt:
      "*If you water this cactus with rainwater, it will eventually die.* Every cactus eventually dies. What is wrong with offering this as advice about rainwater?",
    options: [
      "It is true, so the advice is sound",
      "It is false, since some cacti watered with rainwater are still alive",
      "It confuses the if-part with the then-part",
      "Nothing could make it false, so it tells us nothing about rainwater",
    ],
    answer: 3,
  },
  {
    // Point 781 — affirming the consequent.
    prompt:
      "A bakery's rule: *If the bread is burnt, it is sold at half price.* You see a loaf being sold at half price. What follows?",
    options: [
      "Nothing — the rule does not say that half-price loaves are burnt",
      "The loaf is burnt",
      "The loaf is not burnt",
      "The loaf is burnt, unless it was discounted for some other reason",
    ],
    answer: 0,
  },
  {
    // Point 781 — denying the antecedent.
    prompt:
      "Same bakery, same rule. A loaf is not burnt. What follows about its price?",
    options: [
      "It is sold at half price only if the baker chooses",
      "It is not sold at half price",
      "Nothing — the rule says nothing about loaves that are not burnt",
      "It is sold at half price",
    ],
    answer: 2,
  },
  {
    // Point 841 — the contrapositive, set against the converse and the
    // converse-in-disguise. The fourth option is "P only if Q", which is the
    // converse of the rule (Point 867).
    prompt:
      "Which sentence makes the same claim as *If the bread is burnt, it is sold at half price*?",
    options: [
      "If a loaf is sold at half price, it is burnt",
      "If a loaf is not sold at half price, it is not burnt",
      "If a loaf is not burnt, it is not sold at half price",
      "A loaf is sold at half price only if it is burnt",
    ],
    answer: 1,
  },
  {
    // Point 867 — *only if* runs against the word order.
    prompt:
      "A gym notice reads: *You may use the pool only if you have a swimming cap.* What does the notice forbid?",
    options: [
      "Owning a cap without using the pool",
      "Being refused the pool while holding a cap",
      "Being in the pool without a cap",
      "Nothing — it only promises that a cap will get you in",
    ],
    answer: 2,
  },
  {
    // Point 867 — dropping *only* replaces the claim with its converse.
    prompt:
      "The notice is reworded to *You may use the pool if you have a swimming cap.* What has changed?",
    options: [
      "It now promises that a cap is enough, and no longer forbids swimming without one",
      "It now demands both that you hold a cap and that you use the pool",
      "Nothing — the two wordings make the same claim",
      "It now forbids swimming without a cap more strictly",
    ],
    answer: 0,
  },
  {
    // Point 958 — the extra situation an *exactly when* rules out.
    prompt:
      "A hostel replaces *If a resident is out after ten, they must sign the register* with *A resident signs the register exactly when they are out after ten.* What does the new rule forbid that the old one allowed?",
    options: [
      "A resident being out after ten without signing the register",
      "A resident being out after ten at all",
      "Nothing — the two rules forbid the same nights",
      "A resident signing the register on a night they were not out after ten",
    ],
    answer: 3,
  },
  {
    // Point 867 — reading *only if* forwards to a conclusion.
    prompt:
      "A scholarship rule reads: *An application is considered only if it carries two references.* Meera's application was considered. What follows?",
    options: [
      "It carried two references only if it was successful",
      "It carried two references",
      "Nothing follows about its references",
      "It did not carry two references",
    ],
    answer: 1,
  },
];

// ===========================================================================
//  §2.4 — Testing a Claim
//  A fresh layout: four delivery slips, DESTINATION on one side and SERVICE on
//  the other, visible faces Shimla / Jaipur / express / standard. Every
//  must-flip set below was computed by exhaustive search over the hidden sides.
// ===========================================================================

export const testingAClaim: Question[] = [
  {
    // Rule "if Shimla then express" -> flip Shimla and standard.
    prompt:
      "Four delivery slips lie on a desk. Each slip records a destination on one side and a service on the other. Two lie destination-up, showing *Shimla* and *Jaipur*; two lie service-up, showing *express* and *standard*. The office rule is: *If a parcel goes to Shimla, it is sent by express.* Which slips must you turn over to be certain whether the rule was followed?",
    options: [
      "The express slip",
      "The standard slip",
      "The Jaipur slip",
      "The Shimla slip",
    ],
    answer: [1, 3],
  },
  {
    prompt: "Why need you not turn the Jaipur slip?",
    options: [
      "Turning it could only confirm the rule, and confirmation is not needed",
      "The Jaipur slip is settled once the Shimla slip has been turned",
      "A Jaipur parcel is never sent by express",
      "The rule says nothing about parcels going anywhere other than Shimla",
    ],
    answer: 3,
  },
  {
    prompt: "Why need you not turn the express slip?",
    options: [
      "Because it shows express, the rule is already satisfied by that slip",
      "The rule is only about parcels sent by standard service",
      "An express parcel must be going to Shimla, so there is nothing to check",
      "The rule never requires an express parcel to be going to Shimla, so neither destination would trouble it",
    ],
    answer: 3,
  },
  {
    prompt: "Why must you turn the standard slip?",
    options: [
      "If its other side reads Jaipur, the rule is broken",
      "Because every slip showing a service must be checked",
      "If its other side reads Shimla, we have a Shimla parcel not sent by express — exactly what the rule forbids",
      "Because a standard parcel is cheaper and more likely to be misrouted",
    ],
    answer: 2,
  },
  {
    prompt:
      "A clerk turns a slip over and finds Shimla on one side and standard on the other. What does that settle?",
    options: [
      "Nothing, until the other three slips are turned",
      "That the rule should be reworded",
      "The rule was not followed",
      "The rule was followed",
    ],
    answer: 2,
  },
  {
    prompt:
      "All four slips are turned over and not one of them shows Shimla together with standard. What follows?",
    options: [
      "Nothing — four slips are too few to settle anything",
      "The rule holds for every parcel the office has ever sent",
      "The rule holds for these four parcels, and every Shimla parcel is therefore express",
      "The rule held for these four parcels, and nothing follows about any other parcel",
    ],
    answer: 3,
  },
  {
    // Point 1313 — the general rule.
    prompt:
      "In general, to test a claim of the form *if P, then Q*, which two faces must you turn over?",
    options: [
      "The face showing *not P* and the face showing Q",
      "The face showing P and the face showing Q",
      "The face showing P and the face showing *not Q*",
      "The face showing *not P* and the face showing *not Q*",
    ],
    answer: 2,
  },
  {
    // Converse rule on the same four slips -> flip Jaipur and express.
    prompt:
      "The office replaces its rule with: *If a parcel is sent by express, it goes to Shimla.* The same four slips lie on the desk. Which must you turn over now?",
    options: [
      "The Jaipur slip",
      "The express slip",
      "The standard slip",
      "The Shimla slip",
    ],
    answer: [0, 1],
  },
  {
    // Biconditional on the same four slips -> flip all four.
    prompt:
      "The office strengthens the rule once more, to: *A parcel goes to Shimla exactly when it is sent by express.* Which slips must you turn over?",
    options: [
      "The Shimla slip and the standard slip, as before",
      "The Jaipur slip and the express slip",
      "All four of them",
      "The Shimla slip and the express slip",
    ],
    answer: 2,
  },
  {
    // Point 1294 — the converse and the converse in disguise.
    prompt:
      "Return to the original rule, *If a parcel goes to Shimla, it is sent by express.* Which of these does the rule leave open?",
    options: [
      "That some parcel sent by express is going somewhere other than Shimla",
      "That some parcel going to Jaipur is sent by standard service",
      "That some parcel going to Shimla is sent by standard service",
      "That some parcel going to Jaipur is sent by express",
    ],
    answer: [0, 1, 3],
  },
  {
    // Point 1315 — the shape of the common error.
    prompt:
      "Most clerks reach first for the Shimla slip and the express slip — the two that match the words of the rule. What has gone wrong in that instinct?",
    options: [
      "They are hunting for cases that fit the rule rather than for the case that would break it",
      "They have forgotten that a slip has two sides",
      "They have taken the rule to be about every parcel rather than these four",
      "They have read *if* as *only if*",
    ],
    answer: 0,
  },
  {
    // Point 867 chained into §2.4: the reworded rule is "P only if Q", which is
    // the ORIGINAL rule again, so the must-flip set is unchanged. Sits opposite
    // the converse question above, where the rewording does change the answer.
    // Verified by the same exhaustive search: ['Shimla', 'standard'].
    prompt:
      "The office rewords its original rule to read: *A parcel goes to Shimla only if it is sent by express.* The same four slips lie on the desk. Which must you turn over now?",
    options: [
      "The Jaipur slip and the express slip",
      "All four of them",
      "The Shimla slip and the standard slip",
      "The Shimla slip and the express slip",
    ],
    answer: 2,
  },
];

// ===========================================================================
//  §2.5 — Knowing What Others Know
//  Two fresh configurations, both solved by an epistemic solver over the full
//  world set rather than by hand:
//    LINE  — front (sees nobody), middle (sees front), back (sees both);
//            hats drawn from three red and two blue, three worn.
//    CIRCLE— three logicians, each seeing the other two; hats drawn from two
//            red and two blue, the fourth left in the box and seen by nobody.
// ===========================================================================

export const knowingWhatOthersKnow: Question[] = [
  {
    prompt:
      "Three logicians stand in a line. The one at the back sees the other two; the one in the middle sees only the one in front; the one in front sees nobody. Their three hats were drawn from a pool of three red and two blue, and each knows this. The back logician is asked first and says *I do not know.* What does that rule out?",
    options: [
      "That the middle and front hats are of different colours",
      "That the middle and front hats are both blue",
      "That the back logician's own hat is red",
      "That the middle and front hats are both red",
    ],
    answer: 1,
  },
  {
    prompt:
      "Why would the back logician have known, in the case that was just ruled out?",
    options: [
      "Seeing two hats of any kind is enough to fix the third",
      "Both blue hats would have been accounted for, so the back hat would have to be red",
      "Both red hats would have been accounted for, so the back hat would have to be blue",
      "The pool contains an odd number of hats, so the back hat is determined",
    ],
    answer: 1,
  },
  {
    prompt:
      "The middle logician is asked next and also says *I do not know.* What does that establish?",
    options: [
      "The front hat is red",
      "The middle hat is blue",
      "The front hat is blue",
      "The middle hat is red",
    ],
    answer: 0,
  },
  {
    prompt:
      "Who can now name their own hat colour with certainty?",
    options: [
      "The logician in front, who can see nobody at all",
      "Nobody — the two answers are not enough",
      "The logician in the middle",
      "The logician at the back",
    ],
    answer: 0,
  },
  {
    prompt:
      "Suppose the pool had been two red and three blue instead, and the back logician again said *I do not know.* What would that rule out?",
    options: [
      "That the middle and front hats are both blue",
      "That the middle and front hats are both red",
      "That the two hats are of different colours",
      "Nothing — with that pool the back logician can never know",
    ],
    answer: 1,
  },
  {
    prompt:
      "Now a different arrangement. Three logicians stand in a circle, each able to see the other two. Their hats were drawn from two red and two blue; the fourth hat stays in the box and nobody sees it. Before anyone speaks, how many of the three can name their own hat colour?",
    options: [
      "Exactly two, whatever the arrangement",
      "Exactly one, whatever the arrangement",
      "None, whatever the arrangement",
      "It depends on the arrangement",
    ],
    answer: 1,
  },
  {
    prompt:
      "In that circle, what must a logician see in order to know their own hat colour?",
    options: [
      "Two hats of different colours",
      "At least one red hat",
      "At least one blue hat",
      "Two hats of the same colour",
    ],
    answer: 3,
  },
  {
    prompt:
      "A logician in that circle sees one red hat and one blue hat. What can they conclude about their own?",
    options: [
      "Nothing — both colours are still possible",
      "That it is red",
      "That it is the same colour as the hat left in the box",
      "That it is blue",
    ],
    answer: 0,
  },
  {
    // The governing idea of the section, .tex:1412-1419.
    prompt:
      "Why does an announcement of ignorance carry information at all?",
    options: [
      "It rules out every arrangement in which the speaker would have known, and it rules them out for everybody listening",
      "It tells the others that the speaker's own hat is the rarer colour",
      "It carries information only for the person who spoke",
      "It shows that the speaker is not a perfect logician",
    ],
    answer: 0,
  },
  {
    // Point 1478 — the step is explicitly the contrapositive.
    prompt:
      "Which tool from the chapter on conditionals carries you from *she would have known if the two hats matched* and *she does not know* to *the two hats do not match*?",
    options: [
      "The converse",
      "Vacuous truth",
      "The contrapositive",
      "The denial of an *and*",
    ],
    answer: 2,
  },
  {
    // Point 1478 — predictable answers carry nothing.
    prompt:
      "In the line of three, suppose the front logician had been asked first, before anyone else spoke. Would that answer have told the others anything?",
    options: [
      "No — everyone could have predicted it in advance, since the front logician sees nobody",
      "Yes — it would have fixed the middle logician's colour",
      "Only if the front logician had said *I know*",
      "Yes — it would have ruled out one arrangement",
    ],
    answer: 0,
  },
  {
    prompt:
      "In the line of three, the front logician ends up naming a colour without ever seeing a single hat. How is that possible?",
    options: [
      "The front logician guessed, and happened to be right",
      "The two answers given before carried all the information needed",
      "The pool of hats alone fixes the front colour, whatever anyone says",
      "The front logician could see a reflection in the wall",
    ],
    answer: 1,
  },
];

// ===========================================================================
//  §2.6 — Asking About Answers
//  A fresh three-speaker puzzle, found by exhaustive search over all boxes and
//  all oracle/chimera assignments and confirmed to have exactly one solution:
//    Elara : "If Orion were asked whether the ruby is in the Jade box,
//             he would answer yes."
//    Orion : "The ruby is in the Jade box."
//    Selene: "The ruby is not in the Onyx box."
//    Exactly one of the three is a chimera.
//    -> ruby in the Coral box; Orion is the chimera; Elara and Selene oracles.
//  Under the naive reading of Elara's sentence the puzzle has NO solution.
// ===========================================================================

export const askingAboutAnswers: Question[] = [
  {
    // Point 1728 — the reported-answer rule.
    prompt:
      "On the Isles of Paradox, Elara says: *If Orion were asked whether the ruby is in the Jade box, he would answer yes.* Exactly when is that sentence true?",
    options: [
      "When exactly one of *the ruby is in the Jade box* and *Orion is an oracle* is true",
      "When *the ruby is in the Jade box* and *Orion is an oracle* are both true or both false",
      "When Orion is an oracle",
      "When the ruby is in the Jade box",
    ],
    answer: 1,
  },
  {
    // Point 1728 — the idea in one line.
    prompt: "What is a reported answer?",
    options: [
      "A link between two unknowns, and never a statement about either one",
      "A statement about the kind of the person being reported on",
      "A claim that is true whenever the reporter is an oracle",
      "A statement about the fact being reported on",
    ],
    answer: 0,
  },
  {
    prompt:
      "The ruby is hidden in the Jade, Onyx or Coral box. Elara says the sentence above. Orion says *The ruby is in the Jade box.* Selene says *The ruby is not in the Onyx box.* Exactly one of the three is a chimera. Where is the ruby?",
    options: [
      "In the Jade box",
      "It cannot be determined",
      "In the Onyx box",
      "In the Coral box",
    ],
    answer: 3,
  },
  {
    prompt: "In that same puzzle, which of the three is the chimera?",
    options: [
      "It cannot be determined",
      "Selene",
      "Elara",
      "Orion",
    ],
    answer: 3,
  },
  {
    // Verified: under the naive reading the solution set is empty.
    prompt:
      "Suppose a reader takes Elara's sentence to mean simply *the ruby is in the Jade box.* What happens to the puzzle?",
    options: [
      "Nothing — the two readings come to the same thing",
      "It has two solutions instead of one",
      "It still has one solution, but the ruby ends up in the wrong box",
      "No arrangement of the three speakers fits at all, and the puzzle stays shut",
    ],
    answer: 3,
  },
  {
    // Point 1792 — the self-report is the embedded question.
    prompt:
      "You meet one islander and have no idea what kind they are. They volunteer: *If I were asked whether the ruby is in the Jade box, I would answer yes.* What follows?",
    options: [
      "The ruby is in the Jade box, whichever kind the islander is",
      "Nothing — the sentence is about the islander, not about the ruby",
      "The islander is an oracle",
      "The ruby is in the Jade box if the islander is an oracle, and elsewhere if not",
    ],
    answer: 0,
  },
  {
    // Point 1824 — why the chimera's answer flips to match.
    prompt: "Why does that work even on a chimera?",
    options: [
      "The question is phrased so cunningly that he does not notice it",
      "A chimera cannot answer a hypothetical question at all",
      "A chimera may answer a question about himself truthfully",
      "He is forced to lie twice about one fact, and denying a claim twice returns the claim we started with",
    ],
    answer: 3,
  },
  {
    // Point 1824 — phrasing is not what does the work.
    prompt: "Does the method depend on the particular words *would you say yes*?",
    options: [
      "No — any question at all works, however it is put",
      "Yes — that exact wording is what traps a chimera",
      "No — any question that forces one fact through the islander's own lying twice would do",
      "Yes — a chimera can evade any other phrasing",
    ],
    answer: 2,
  },
  {
    // Point 1792 — the plain question is worthless.
    prompt:
      "Why is the plain question *Is the ruby in the Jade box?* no use when you do not know the islander's kind?",
    options: [
      "A chimera would refuse to answer it",
      "It mentions only one of the boxes",
      "A yes means the Jade box from an oracle and some other box from a chimera, and you cannot tell which you are facing",
      "An islander is not obliged to answer a plain question",
    ],
    answer: 2,
  },
  {
    // Point 1840 — counting answers, not things.
    prompt:
      "The ruby is in one of three boxes and you may ask one islander a single yes-or-no question. Why can no question at all be guaranteed to find it?",
    options: [
      "Because a chimera lies differently about three boxes than about two",
      "Because no question can mention three boxes at once",
      "One question yields one of two answers, so at most two boxes could ever be named, and the ruby may be in the third",
      "Because you would first need to learn the islander's kind",
    ],
    answer: 2,
  },
  {
    // Point 1856 + exercise .tex:1926, both recomputed.
    prompt:
      "The ruby is hidden in one of nine boxes and the islander knows which. How many yes-or-no questions are always enough?",
    options: [
      "Five",
      "Three",
      "Four",
      "Nine",
    ],
    answer: 2,
  },
  {
    // Point 1878 — what would defeat the method.
    prompt:
      "You can find the ruby without ever learning whether the islander is an oracle or a chimera. What kind of islander would defeat the method entirely?",
    options: [
      "One who tells the truth sometimes and lies at other times, so there is no rule to cancel",
      "One who knows the box but refuses to speak",
      "One who always lies, since two lies are harder to undo than one",
      "One who does not know which box holds the ruby",
    ],
    answer: 0,
  },
];
