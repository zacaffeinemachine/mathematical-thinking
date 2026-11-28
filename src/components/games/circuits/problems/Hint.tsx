// A hint folded away under a button. Nothing of it is on show until the
// student asks. Render it with client:visible and put the hint inside:
//
//   <Hint client:visible>
//     Prose, pictures...
//   </Hint>
//
// The circuit pages carry no solutions as a rule (SITE_OVERVIEW.md, "No
// solutions in the repo"). A hint is an exception the author asks for, one
// problem at a time, and is listed there.

import { useState, type ReactNode } from "react";
import { Button } from "./ui";

export default function Hint({ label = "Hint", children }: { label?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="hint" style={{ marginTop: 12 }}>
      <Button onClick={() => setOpen((v) => !v)} pressed={open}>
        {open ? `Hide the ${label.toLowerCase()}` : `Show a ${label.toLowerCase()}`}
      </Button>
      {open && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 14px",
            borderLeft: "3px solid var(--accent)",
            background: "var(--accent-soft)",
            borderRadius: 4,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
