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
    // Point 72 (Two claims at once) — one true row of four.
    prompt:
      "A classmate boasts: *I revised the whole syllabus and I slept at least eight hours.* There are four situations to consider. In how many of them is the boast true?",
    options: ["In exactly one", "In exactly two", "In exactly three", "In all four"],
    answer: 0,
  },
  {
    // Point 72 — "none of them is more false than another".
    prompt:
      "One classmate revised everything but slept four hours. Another slept soundly having revised nothing. Both made the boast above. Which is right?",
    options: [
      "Both boasts are false, and neither is more false than the other",
      "The first boast is closer to true, since one of its halves holds",
      "The second boast is closer to true, since sleep is the harder half",
      "Neither boast is false, since each classmate managed one half",
    ],
    answer: 0,
  },
  {
    // Point 72 — "swapping the two halves changes nothing".
    prompt:
      "Under our convention, is *The power went out and we finished the class in the corridor* the same claim as *We finished the class in the corridor and the power went out*?",
    options: [
      "Yes — since nothing beyond the two halves is claimed, swapping them changes nothing",
      "No — the first says the power cut came first",
      "No — the first also claims the power cut is what drove the class outside",
      "Only when both halves happen to be true",
    ],
    answer: 0,
  },
  {
    // Point 109 (One or the other) — the notice, inclusive convention.
    prompt:
      "A notice reads: *The scholarship goes to a student who plays a sport or edits the magazine.* A student who does both walks up to the desk. Under our convention, does she qualify?",
    options: [
      "Yes — *or* asks for at least one of the two, possibly both",
      "No — *or* asks for exactly one of the two",
      "The notice cannot be applied to her at all",
      "Only if she does one of the two better than the other",
    ],
    answer: 0,
  },
  {
    // Point 109 — "the two readings differ in exactly one row, the top one".
    prompt:
      "The *at least one* reading of *or* and the *exactly one* reading are set side by side in a four-row table. In how many rows do the two readings disagree, and which?",
    options: [
      "One row — the row where both halves are true",
      "One row — the row where both halves are false",
      "Two rows — the two where exactly one half is true",
      "Three rows — every row but the last",
    ],
    answer: 0,
  },
  {
    // Point 146 (Saying no) — denial is not the opposite.
    prompt: "Which sentence is the denial of *The tea is hot*?",
    options: [
      "The tea is not hot",
      "The tea is cold",
      "The tea is lukewarm",
      "The tea is either cold or lukewarm",
    ],
    answer: 0,
  },
  {
    // Point 146 — "a reader who concludes it is less than five has lost five itself".
    prompt:
      "A number is *not greater than five*. Which of the following values does that leave possible?",
    options: ["4", "5", "6", "7"],
    answer: [0, 1],
  },
  {
    // Point 146 — the jury.
    prompt: "A jury returns a verdict of *not guilty*. What has it done?",
    options: [
      "Denied that guilt was proved",
      "Declared the accused innocent",
      "Declared that the accused is probably innocent",
      "Said nothing at all about the case",
    ],
    answer: 0,
  },
  {
    // Point 189 (Denying a joint claim) — deny "both" ⇒ "at least one fails".
    prompt:
      "A second classmate hears the boast *I revised the whole syllabus and I slept at least eight hours* and says *that is not true*. What exactly has the second classmate claimed?",
    options: [
      "That at least one of the two halves failed",
      "That both halves failed",
      "That the revision half failed",
      "That the sleep half failed",
    ],
    answer: 0,
  },
  {
    // Point 189 — deny "at least one" ⇒ "both fail".
    prompt:
      "We are told that it is *not true* that the library is open or the reading room is free. What follows?",
    options: [
      "Both are shut",
      "At least one of the two is shut",
      "Exactly one of the two is shut",
      "The library is shut, but the reading room may be free",
    ],
    answer: 0,
  },
  {
    // §2.1 exercise, .tex:258 — the swimming-pool notice, inclusive convention.
    prompt:
      "A notice at a swimming pool reads: *Children under twelve or non-members must be accompanied by an adult.* Under our convention, which visitors must be accompanied?",
    options: [
      "A ten-year-old member",
      "A ten-year-old non-member",
      "A thirty-year-old member",
      "A thirty-year-old non-member",
    ],
    answer: [0, 1, 3],
  },
  {
    // Point 227 (The same claim in different clothes) — the criterion.
    prompt: "When are two sentences the same claim?",
    options: [
      "When they are true in exactly the same situations and false in exactly the same situations",
      "When they use the same words in a different order",
      "When they are the same length and stress the same half",
      "When each of them can be derived from the other by adding *not* twice",
    ],
    answer: 0,
  },
];

// ===========================================================================
//  §2.2 — Quantifiers
// ===========================================================================

export const quantifiers: Question[] = [
  {
    // Point 321 (What every asks for) — one true row of eight.
    prompt:
      "Three passengers sit in a compartment, and the inspector announces *Every passenger in this compartment has a ticket.* Of the eight situations, in how many is the announcement true?",
    options: ["In exactly one", "In exactly three", "In exactly seven", "In all eight"],
    answer: 0,
  },
  {
    // Point 374 (What some asks for) — seven true rows of eight.
    prompt:
      "Same compartment, same eight situations, but now the claim is *Some passenger in this compartment has a ticket.* In how many of the eight is it true?",
    options: ["In exactly seven", "In exactly one", "In exactly three", "In all eight"],
    answer: 0,
  },
  {
    // Point 417 (Swapping one word) — the refute/establish table.
    prompt: "What is needed to refute *Every passenger in this compartment has a ticket*?",
    options: [
      "One passenger without a ticket",
      "Checking all three passengers",
      "A majority of the passengers without tickets",
      "Every passenger without a ticket",
    ],
    answer: 0,
  },
  {
    // Point 417 — the same table, the other row.
    prompt: "What is needed to refute *Some passenger in this compartment has a ticket*?",
    options: [
      "Checking all three passengers and finding none with a ticket",
      "One passenger without a ticket",
      "One passenger with a ticket",
      "Two passengers without tickets",
    ],
    answer: 0,
  },
  {
    // Point 374 — some means at least one, possibly all.
    prompt:
      "Under our convention, does *Some Scottish sheep are black* contradict *Every Scottish sheep is black*?",
    options: [
      "No — *some* means at least one, and that leaves *all* open",
      "Yes — *some* carries the hint *not all*",
      "Yes, but only if there is more than one sheep in Scotland",
      "It cannot be decided without counting the sheep",
    ],
    answer: 0,
  },
  {
    // Point 437 (Which one comes first) — key chosen after the pigeonhole.
    prompt:
      "A staff room has six locked pigeonholes. The bunch by the door holds exactly six keys, and each key opens exactly one of the pigeonholes, a different one each time. Which of these claims are true of that staff room?",
    options: [
      "Every pigeonhole has some key that opens it",
      "There is some key that opens every pigeonhole",
      "Every key opens some pigeonhole",
      "There is some pigeonhole that every key opens",
    ],
    answer: [0, 2],
  },
  {
    // Point 437 — the second sentence asks for the key first.
    prompt: "What does *There is some key that opens every pigeonhole* demand?",
    options: [
      "One single key, fixed in advance, that opens all six pigeonholes",
      "That each pigeonhole be answered by a key, possibly a different one each time",
      "That every key on the hook open at least one pigeonhole",
      "That the number of keys be at least the number of pigeonholes",
    ],
    answer: 0,
  },
  {
    // Point 467 (Denying all and some) — denial of every is some…not.
    prompt: "Which sentence is the denial of *Every student here has read the book*?",
    options: [
      "Some student here has not read the book",
      "No student here has read the book",
      "Every student here has failed to read the book",
      "Some student here has read the book",
    ],
    answer: 0,
  },
  {
    // Point 467 — the class of thirty, twenty-nine readers.
    prompt:
      "In a class of thirty, twenty-nine students have read the book and one has not. Which of these are true of that room?",
    options: [
      "*Every student here has read the book* is false",
      "*Some student here has not read the book* is true",
      "*No student here has read the book* is true",
      "*Some student here has read the book* is true",
    ],
    answer: [0, 1, 3],
  },
  {
    // Point 467 — denying a two-quantifier sentence, one word at a time.
    prompt: "Which sentence is the denial of *There is a key that opens every pigeonhole*?",
    options: [
      "Every key leaves some pigeonhole shut",
      "Some pigeonhole has no key that opens it",
      "No key opens any pigeonhole",
      "Every key opens some pigeonhole",
    ],
    answer: 0,
  },
  {
    // Point 510 (On counterexamples) — 33 = 3 × 11.
    prompt:
      "Someone claims that every whole number ending in 3 is prime, and points out that 3, 13 and 23 all are. Which number finishes the claim off?",
    options: ["33", "43", "53", "63"],
    answer: 0,
  },
  {
    // Point 467 — the minister and the headline.
    prompt:
      "A minister says *It is not true that all our schools are underfunded*, and the paper reports *Minister: no school is underfunded.* What went wrong?",
    options: [
      "The minister claimed only that at least one school is adequately funded; the paper reported the far stronger claim that none is underfunded",
      "The minister claimed that no school is underfunded, and the paper reported it accurately",
      "The paper reported a weaker claim than the minister made",
      "The two sentences say the same thing, so nothing went wrong",
    ],
    answer: 0,
  },
];

// ===========================================================================
//  §2.3 — Conditionals
// ===========================================================================

export const conditionals: Question[] = [
  {
    // Point 648 (What if…then asks for) — the one false row of four.
    prompt:
      "A car park notice reads: *If a car is left in this lane after eight, it is towed away.* Which single situation makes the notice false?",
    options: [
      "A car left after eight and not towed away",
      "A car left before eight and towed away",
      "A car left before eight and not towed away",
      "A car left after eight and towed away",
    ],
    answer: 0,
  },
  {
    // Point 648 — the third row, defended at length.
    prompt:
      "A car left the lane at seven and was towed anyway, for blocking a gate. What does that do to the notice above?",
    options: [
      "Nothing — the notice is still true, since it says nothing about cars that leave before eight",
      "It makes the notice false, since the car was towed without meeting the condition",
      "It makes the notice neither true nor false",
      "It makes the notice true only if some other car was also towed after eight",
    ],
    answer: 0,
  },
  {
    // Point 698 (An astrological claim) — if-part that never occurs.
    prompt:
      "A colleague declares every year *If I win the lottery, I will take the whole office to Goa*, and has never bought a ticket. What can we say about his claim?",
    options: [
      "No event can make it false, and it carries no information",
      "It is a lie, since he has no intention of buying a ticket",
      "It is false, because the if-part never happens",
      "It is neither true nor false until he buys a ticket",
    ],
    answer: 0,
  },
  {
    // Point 698 — the vacuously true rule, and the sheep in the carriage.
    prompt:
      "A notice reads *Every red card in this pack has an even number on the back*, and the pack contains no red cards at all. Is the notice true?",
    options: [
      "Yes — no red card can be produced against it, so it cannot fail",
      "No — a claim about nothing cannot be true",
      "No — with no red cards the claim has nothing to be true of",
      "It depends on the numbers on the backs of the other cards",
    ],
    answer: 0,
  },
  {
    // Point 698 — the then-part that always occurs.
    prompt:
      "*If you marry a Manglik, then you die.* Why is this sentence true, and what does it tell us about Mangliks?",
    options: [
      "It is true because everybody dies, and it tells us nothing at all about Mangliks",
      "It is true because astrology has been confirmed, and it warns against such a marriage",
      "It is false, since some people who marry Mangliks live long lives",
      "It is true only for those who believe it",
    ],
    answer: 0,
  },
  {
    // Point 781 — reading the claim backwards.
    prompt:
      "A groundsman announces *If it rains, the match is cancelled.* The match is cancelled. What follows about the weather?",
    options: [
      "Nothing at all",
      "It rained",
      "It did not rain",
      "It rained, unless the match was cancelled for some other reason",
    ],
    answer: 0,
  },
  {
    // Point 781 — a converse must be checked separately; 15 is the witness.
    prompt:
      "*If a number ends in 0, then it is divisible by 5* is true. Its converse is *If a number is divisible by 5, then it ends in 0.* Which number shows the converse to be false?",
    options: ["15", "20", "25 and no other", "None — the converse is also true"],
    answer: 0,
  },
  {
    // Point 841 (Contrapositive) — swap and deny.
    prompt: "What is the contrapositive of *If it rains, the match is cancelled*?",
    options: [
      "If the match was not cancelled, then it did not rain",
      "If the match is cancelled, then it rained",
      "If it did not rain, the match was not cancelled",
      "If it rains, the match is not cancelled",
    ],
    answer: 0,
  },
  {
    // Point 841 — the three reversals; plus Point 867 for the "only if" option.
    prompt:
      "Which of these sentences are *different* claims from *If it rains, the match is cancelled*?",
    options: [
      "If the match is cancelled, then it rained",
      "If it did not rain, the match was not cancelled",
      "If the match was not cancelled, then it did not rain",
      "It rains only if the match is cancelled",
    ],
    answer: [0, 1],
  },
  {
    // Point 867 (What only if asks for) — the umbrella grumble.
    prompt:
      "*It rains only if I have left my umbrella at home.* Which single afternoon refutes this complaint?",
    options: [
      "Rain falling, umbrella in hand",
      "A dry afternoon with the umbrella forgotten at home",
      "A dry afternoon with the umbrella in hand",
      "Rain falling, umbrella left at home",
    ],
    answer: 0,
  },
  {
    // Point 867 — the museum sign.
    prompt:
      "A sign reads *A visitor may enter only if the visitor holds a ticket.* What does it claim?",
    options: [
      "That nobody is inside without a ticket — it does not promise that a ticket gets you in",
      "That anybody holding a ticket will be let in",
      "Both that a ticket is required and that a ticket is enough",
      "That anybody without a ticket will be turned away at the door, and nothing about ticket-holders either way",
    ],
    answer: 0,
  },
  {
    // Point 958 (What if and only if asks for) — two forbidden rows, not one.
    prompt:
      "Of the four situations for two facts, how many does *P if and only if Q* rule out, and how many does the one-way *if P then Q* rule out?",
    options: [
      "Two and one",
      "One and two",
      "Two and two",
      "Three and one",
    ],
    answer: 0,
  },
];

// ===========================================================================
//  §2.4 — Testing a Claim (the Wason selection task)
// ===========================================================================

export const testingAClaim: Question[] = [
  {
    // Point 1310 (The answer) — red and 7.
    prompt:
      "Four cards lie on the table showing red, blue, 4 and 7. The claim is *If a card is red on one side, then it has an even number on the other side.* Which cards must you turn over?",
    options: ["The red card", "The blue card", "The 4 card", "The 7 card"],
    answer: [0, 3],
  },
  {
    // Point 1294 (What the claim really says) — the converse and its disguise.
    prompt:
      "The claim is *If a card is red on one side, then it has an even number on the other side.* Which of these does it leave open — that is, which does it *not* assert?",
    options: [
      "That every even number sits opposite a red face",
      "That every blue card sits opposite an odd number",
      "That no red face has an odd number behind it",
      "That whenever a card is red on one side, an even number is hiding behind it",
    ],
    answer: [0, 1],
  },
  {
    // Point 1297 — the question to put to each card.
    prompt: "What is the right question to put to each card before deciding whether to flip it?",
    options: [
      "Could this card, by itself, prove the claim is a lie?",
      "Could this card, by itself, prove the claim is true?",
      "Does this card mention something the claim mentions?",
      "Is this card more likely than the others to break the rule?",
    ],
    answer: 0,
  },
  {
    // Point 1300 — the blue card.
    prompt: "Why need we not turn the blue card?",
    options: [
      "The claim says nothing at all about what lies behind a blue face",
      "A blue card cannot have a digit on its other side",
      "Whatever is behind it, the claim comes out false anyway",
      "The blue card has already been settled by the red card",
    ],
    answer: 0,
  },
  {
    // Point 1300 — the 4 card, "the tempting trap".
    prompt: "Why need we not turn the 4 card?",
    options: [
      "The claim never requires an even number to sit opposite a red face, so neither a red nor a blue back would trouble it",
      "The claim is only about odd numbers",
      "A red back would confirm the claim, and confirmation is not needed",
      "Because 4 is even, the claim is automatically satisfied by that card",
    ],
    answer: 0,
  },
  {
    // Point 1300 — the 7 card.
    prompt: "Why must we turn the 7 card?",
    options: [
      "If its other side is red, we would have a red face opposite an odd number — exactly what the claim forbids",
      "If its other side is blue, the claim is refuted",
      "Because 7 is odd, the claim demands that its other side be blue",
      "Because every card showing a digit must be checked",
    ],
    answer: 0,
  },
  {
    // Point 1313 — the general rule.
    prompt:
      "To test a claim of the form *if P, then Q*, which two cards must be flipped?",
    options: [
      "The card showing P and the card showing *not Q*",
      "The card showing P and the card showing Q",
      "The card showing *not P* and the card showing Q",
      "The card showing *not P* and the card showing *not Q*",
    ],
    answer: 0,
  },
  {
    // Point 1315 — the shape of the common error.
    prompt:
      "Most people first reach for the red card and the 4 card. What has gone wrong in that instinct?",
    options: [
      "They are hunting for cases that confirm the rule rather than for cases that could destroy it",
      "They have read *if* as *only if*",
      "They have forgotten that the 4 card has a colour on its other side",
      "They have taken the claim to be about all packs of cards rather than these four",
    ],
    answer: 0,
  },
  {
    // Point 1315 — Wason's 1960s experiment.
    prompt:
      "In Wason's original experiment in the 1960s, how many university students answered correctly?",
    options: ["Fewer than one in ten", "About one in three", "About half", "Nearly all of them"],
    answer: 0,
  },
  {
    // §2.4 exercise, .tex:1325 — the discount and the membership card.
    // Writing P = shows a card, Q = gets the discount, the group of "if P then Q"
    // is {a, c, f}; the group of "if Q then P" is {b, d, e}; the iff stands alone.
    prompt:
      "A shop has a rule about a discount and a membership card. Which of these say the same thing as *If a customer shows a card, the customer gets the discount*?",
    options: [
      "If a customer gets no discount, then the customer showed no card",
      "Either the customer shows no card, or the customer gets the discount",
      "A customer gets the discount only if the customer shows a card",
      "If a customer shows no card, then the customer gets no discount",
    ],
    answer: [0, 1],
  },
  {
    // §2.4 exercise, .tex:1325 — which sentence stands alone.
    prompt:
      "Among those same seven sentences about the discount, one belongs to a group of its own. Which?",
    options: [
      "A customer gets the discount if and only if the customer shows a card",
      "There is no discount without a card",
      "Either the customer shows no card, or the customer gets the discount",
      "If a customer gets no discount, then the customer showed no card",
    ],
    answer: 0,
  },
  {
    // §2.4 exercise, .tex:1378 part (3) — strengthening to "exactly when".
    prompt:
      "A friend strengthens *If a card has a vowel on one side, then the digit on the other side is a multiple of 3* to *A card has a vowel on one side exactly when the digit on the other side is a multiple of 3.* Which cards must now be turned over?",
    options: [
      "Every card on the table",
      "Only the vowel cards and the cards showing a multiple of 3",
      "The same cards as before, and no others",
      "Only the consonant cards and the cards showing a digit that is not a multiple of 3",
    ],
    answer: 0,
  },
];

// ===========================================================================
//  §2.5 — Knowing What Others Know
// ===========================================================================

export const knowingWhatOthersKnow: Question[] = [
  {
    // Point 1478 — Logicians 4 and 3 add no information.
    prompt:
      "In the Hat Hurdle, why do the answers of Logician 4 and Logician 3 add no information at all?",
    options: [
      "Everyone in the room could have predicted both answers before the warden asked",
      "Neither of them is a perfect logician",
      "They were asked before the hats were placed",
      "Nobody else could hear them answer",
    ],
    answer: 0,
  },
  {
    // Point 1478 — the rule Logician 1 is working under.
    prompt:
      "Logician 1 can see the hats of Logicians 2 and 3. Under what circumstance would Logician 1 have been able to announce their own colour?",
    options: [
      "If Logicians 2 and 3 were wearing hats of the same colour",
      "If Logicians 2 and 3 were wearing hats of different colours",
      "If Logician 3's hat were red",
      "If Logician 4 had answered first",
    ],
    answer: 0,
  },
  {
    // Point 1478 — what the silence broadcasts.
    prompt: "Logician 1 says *I do not know.* What does that tell everyone listening?",
    options: [
      "That Logicians 2 and 3 are wearing hats of different colours",
      "That Logicians 2 and 3 are wearing hats of the same colour",
      "That Logician 1's hat is red",
      "That Logician 4's hat and Logician 1's hat match",
    ],
    answer: 0,
  },
  {
    // Point 1478 — the step is explicitly the contrapositive, §2.3.
    prompt:
      "Which tool from the chapter on conditionals carries us from *Logician 1 would have known if 2 and 3 matched* to *2 and 3 do not match*?",
    options: ["The contrapositive", "The converse", "Vacuous truth", "The denial of an *or*"],
    answer: 0,
  },
  {
    // Point 1478 — how Logician 2 finishes.
    prompt: "How does Logician 2 finish the deduction?",
    options: [
      "Logician 2 looks at Logician 3's hat and announces the opposite colour",
      "Logician 2 looks at Logician 3's hat and announces the same colour",
      "Logician 2 counts the red hats already announced",
      "Logician 2 waits for Logician 4 to speak a second time",
    ],
    answer: 0,
  },
  {
    // Point 1478 — the earlier "I do not know" is consistent.
    prompt:
      "Logician 2 had already said *I do not know* earlier in the round. Why is that consistent with knowing the answer a moment later?",
    options: [
      "Logician 2 was asked before Logician 1 spoke, and it was Logician 1's answer that supplied the missing information",
      "Logician 2 was allowed one guess and used it",
      "Logician 2 had not yet looked at Logician 3's hat",
      "Logician 2 lied the first time to mislead the warden",
    ],
    answer: 0,
  },
  {
    // Point 1589 — Round 1 of the Judicious Jinx rules out r = 0 and r = 1.
    prompt:
      "In the Judicious Jinx, all three logicians say *I see at least one red hat.* Writing r for the number of red hats among the three, what does this rule out?",
    options: [
      "r = 0 and r = 1",
      "r = 0 only",
      "r = 3 only",
      "r = 1 and r = 2",
    ],
    answer: 0,
  },
  {
    // Point 1589 — Round 2, the person seeing exactly one red.
    prompt:
      "After Round 1, what would a logician who sees exactly one red hat among the other two be forced to conclude?",
    options: [
      "That their own hat is red — so they would have said so rather than *I don't know*",
      "That their own hat is blue — so they would have said so rather than *I don't know*",
      "Nothing at all, which is why they say *I don't know*",
      "That the other two must swap hats",
    ],
    answer: 0,
  },
  {
    // Point 1589 — Round 2's conclusion.
    prompt:
      "All three then say *I don't know what colour my hat is.* How many red hats does each of them therefore see among the other two?",
    options: ["Exactly two", "Exactly one", "None", "It cannot be determined"],
    answer: 0,
  },
  {
    // Point 1589 — the colours.
    prompt: "What colour is each of the three hats in the Judicious Jinx?",
    options: [
      "All three are red",
      "All three are blue",
      "Two red and one blue",
      "One red and two blue",
    ],
    answer: 0,
  },
  {
    // §2.5 exercise, .tex:1638 (Four Hats in a Chest). Two red and two blue, three
    // worn, one left unseen. A sage knows their own colour exactly when the two
    // hats they can see match. Elara sees one of each, so she does not know.
    // If Elara wears red, Phoebe sees two reds and knows; if Elara wears blue,
    // Orion sees two blues and knows. Either way exactly one sage knows.
    prompt:
      "Four hats — two red, two blue — sit in a chest. Elara, Phoebe and Orion each blindly take one and wear it; the fourth stays in the chest, unseen by all. Each sage sees the other two hats but not their own. Elara observes that Phoebe is wearing blue and Orion is wearing red. How many of the three sages know their own hat colour with certainty?",
    options: ["Exactly one", "None", "Exactly two", "All three"],
    answer: 0,
  },
  {
    // §2.5 exercise, .tex:1668 (Three Sages, Five Hats). Ariadne's "I do not know"
    // rules out Selene and Thalia both being blue. Were Thalia blue, Selene could
    // then infer her own hat is red; Selene's "I do not know" therefore rules out
    // Thalia being blue.
    prompt:
      "Ariadne, Selene and Thalia each wear a hat drawn from three red and two blue, and each sees the other two hats but not her own. Ariadne says *I do not know*; Selene then says *I do not know*; Thalia then answers correctly. What colour is Thalia's hat?",
    options: [
      "Red",
      "Blue",
      "Red if Ariadne's hat is blue, otherwise blue",
      "It cannot be determined from what was said",
    ],
    answer: 0,
  },
];

// ===========================================================================
//  §2.6 — Asking About Answers
// ===========================================================================

export const askingAboutAnswers: Question[] = [
  {
    // Point 1728 (What somebody else would say) — the four-row table.
    prompt:
      "Somebody reports: *If Selene were asked whether the ruby is in the Coral box, she would answer yes.* Exactly when does that hold?",
    options: [
      "When *the ruby is in the Coral box* and *Selene is an oracle* are both true or both false",
      "When the ruby is in the Coral box",
      "When Selene is an oracle",
      "When exactly one of *the ruby is in the Coral box* and *Selene is an oracle* is true",
    ],
    answer: 0,
  },
  {
    // Point 1728 — the section's key idea, stated flat.
    prompt: "What is a reported answer?",
    options: [
      "A link between two unknowns, and never a statement about either one",
      "A statement about the fact being reported on",
      "A statement about the kind of the person being reported on",
      "A claim that is true whenever the reporter is an oracle",
    ],
    answer: 0,
  },
  {
    // Point 1761 (Solving the puzzle) — Phoebe and Helios said the same thing.
    prompt:
      "In the opening puzzle, Phoebe reports what Selene would answer about the Coral box, and Helios says *The ruby is in the Coral box precisely when Selene is an oracle.* What follows?",
    options: [
      "Phoebe and Helios have said the same thing in different words, so they are of the same kind",
      "Phoebe and Helios have contradicted each other, so exactly one of them is a chimera",
      "Helios has told us where the ruby is, and Phoebe has not",
      "Nothing, until we know what Selene said",
    ],
    answer: 0,
  },
  {
    // Point 1761 — the answer.
    prompt:
      "Exactly two of Phoebe, Selene and Helios are oracles. Who is the chimera, and where is the ruby?",
    options: [
      "Selene is the chimera, and the ruby is in the Amber box",
      "Selene is the chimera, and the ruby is in the Coral box",
      "Phoebe is the chimera, and the ruby is in the Amber box",
      "Helios is the chimera, and the ruby is in the Coral box",
    ],
    answer: 0,
  },
  {
    // Point 1792 (A question that works on either kind) — the plain question.
    prompt:
      "One islander of unknown kind stands before two boxes. Why is the plain question *Is the ruby in the Coral box?* worthless?",
    options: [
      "A yes means the Coral box from an oracle and the Amber box from a chimera, and we cannot tell the two apart",
      "An islander is not obliged to answer a plain question",
      "A chimera would refuse to answer it at all",
      "It asks about only one of the two boxes",
    ],
    answer: 0,
  },
  {
    // Point 1792 — the embedded question, and its table.
    prompt:
      "We instead ask *If I asked you whether the ruby is in the Coral box, would you say yes?* What does the four-row table for this question show?",
    options: [
      "The two kinds answer identically in every row, and we hear yes exactly when the ruby is in the Coral box",
      "The two kinds answer identically only when the ruby is in the Coral box",
      "The two kinds still disagree, but we can now tell which kind we are facing",
      "An oracle answers yes in every row and a chimera answers no in every row",
    ],
    answer: 0,
  },
  {
    // Point 1824 (Why the two falsehoods cancel) — the double denial.
    prompt: "Why does the embedded question work on a chimera?",
    options: [
      "It forces him to lie twice about one fact, and denying a claim twice returns the claim we started with",
      "It is phrased so cunningly that he does not notice it",
      "A chimera may answer a hypothetical question truthfully",
      "A chimera cannot answer a question about himself at all",
    ],
    answer: 0,
  },
  {
    // Point 1824 — nothing depends on the phrasing.
    prompt:
      "Does the method depend on the particular phrase *would you say yes*?",
    options: [
      "No — any question that forces one fact through the islander's own lying twice would do",
      "Yes — that exact wording is what traps a chimera",
      "Yes — a chimera can evade any other phrasing",
      "No — any question at all works, however it is put",
    ],
    answer: 0,
  },
  {
    // Point 1840 (Two answers cannot separate three boxes) — counting answers.
    prompt:
      "A third box is added, and we still have one question to put to one islander. Why can no question at all settle which of the three boxes holds the ruby?",
    options: [
      "One question yields one of two answers, so at most two boxes could ever be named, and the ruby may be in the third",
      "Because a chimera would lie about a third box in a way he does not lie about two",
      "Because we would also need to learn the islander's kind first",
      "Because no question can mention three boxes at once",
    ],
    answer: 0,
  },
  {
    // Point 1856 (Two questions are enough) — the missing pair.
    prompt:
      "We ask the embedded question about the Coral box and then about the Amber box. Two questions allow four possible pairs of answers, but only three appear. Which pair never occurs?",
    options: ["Yes, yes", "No, no", "Yes, no", "No, yes"],
    answer: 0,
  },
  {
    // Point 1856 — one is sometimes enough, two are always enough, one is not
    // always enough. Plus §2.6 exercise .tex:1926 on five boxes: 2^3 = 8 ≥ 5.
    prompt:
      "The ruby is hidden in one of five boxes, and one islander of unknown kind knows which. How many questions are always enough, and how many boxes could four questions handle?",
    options: [
      "Three questions, and four questions could handle up to sixteen boxes",
      "Two questions, and four questions could handle up to eight boxes",
      "Four questions, and four questions could handle up to five boxes",
      "Five questions, and four questions could handle up to four boxes",
    ],
    answer: 0,
  },
  {
    // Point 1878 (What we never found out) — what would ruin the method.
    prompt:
      "We found the ruby without ever learning whether the islander was an oracle or a chimera. What kind of islander would defeat the method entirely?",
    options: [
      "One who tells the truth sometimes and lies at other times, so there is no rule to cancel",
      "One who always lies, since two lies are harder to undo than one",
      "One who refuses to answer questions about boxes",
      "One who does not know which box holds the ruby",
    ],
    answer: 0,
  },
];
