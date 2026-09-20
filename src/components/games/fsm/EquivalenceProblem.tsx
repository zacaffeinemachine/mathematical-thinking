import type { ReactNode } from "react";
import type { FSM } from "./model";
import { Problem } from "./Problem";
import DualMachineRunner from "./DualMachineRunner";

// One question of "Do These Agree?": two machines, and the runner locked
// to the rule that accepts when exactly one of them accepts.
//
// The lock is the page. With that rule chosen, the two machines together
// behave as a single machine whose language is exactly the strings they
// disagree about, so the question "are these the same machine?" turns
// into "can this combined machine accept anything at all?". Leaving the
// other two rules reachable would invite the reader to poke at "A or B"
// and "A and B", which answer a different question.
//
// No answer is recorded here or anywhere on the page, in keeping with
// the rest of the problem bank. The standing note below is furniture and
// says the same words under every question: a reader who lands on one of
// them should not have to scroll to learn what the runner is doing, and
// five hand-written copies in the MDX would drift apart.

export default function EquivalenceProblem({
  n,
  title,
  machineA,
  machineB,
  defaultInput,
  examples = [],
  hard = false,
  graphWidth = 300,
  children,
}: {
  n: number;
  title: string;
  machineA: FSM;
  machineB: FSM;
  defaultInput?: string;
  // Strings to seed the hunt with. Every one of them must be a string the
  // two machines agree about: an example that happens to separate them
  // would answer the question on sight. The checker enforces this.
  examples?: string[];
  hard?: boolean;
  graphWidth?: number;
  children?: ReactNode;
}) {
  return (
    <Problem n={n} title={title} hard={hard}>
      {children}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid var(--rule)",
          fontSize: 13.5,
          color: "var(--muted)",
          lineHeight: 1.55,
        }}
      >
        The runner is set to accept when <strong>exactly one</strong> of the two
        machines accepts. So a string it accepts is a string the two machines
        disagree about, and one of those is enough to settle the question. Take
        care over the other direction: not finding one is not the same as there
        not being one.
      </div>
      <DualMachineRunner
        machineA={machineA}
        machineB={machineB}
        rules={["XOR"]}
        initialRule="XOR"
        defaultInput={defaultInput}
        examples={examples}
        graphWidth={graphWidth}
      />
    </Problem>
  );
}
