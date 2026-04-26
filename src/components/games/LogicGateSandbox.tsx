import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  emptyCircuit,
  freshId,
  findBody,
  findJoint,
  findJointNear,
  bodyToWorld,
  worldToBody,
  incidenceWorld,
  jointWorld,
  rodEndLocal,
  outputBit,
  makeRod,
  type Circuit,
  type Body,
  type BodyId,
  type BodyKind,
  type Joint,
  type JointId,
  type JointIncidence,
  type RodBody,
  type ConnectorBody,
  type SpringBody,
  type Group,
  type Contact,
  type Vec2,
  type Orient,
} from "./logicGates/model";
import { solve, syncPosesFromDof } from "./logicGates/solver";
import {
  cloneRemapped,
  deleteGate,
  deserializeCircuit,
  loadLibrary,
  saveLibrary,
  serializeCircuit,
  upsertGate,
  type SavedGate,
} from "./logicGates/storage";

// =====================================================================
//  Constants
// =====================================================================

const GRID = 30;

// Canvas size is stateful now (see below). These are just defaults.
const DEFAULT_COLS = 24;
const DEFAULT_ROWS = 18;
const MIN_COLS = 12;
const MIN_ROWS = 10;
const MAX_COLS = 80;
const MAX_ROWS = 60;

const DEFAULTS = {
  rodLen: 6,
  inputRodLen: 6,
  outputRodLen: 6,
  springCoils: 6,
};

const INPUT_SPEED = 4; // grid units per second for input tween
const JOINT_MERGE_TOL = 0.4; // grid units
const HIT_ROD_HALF = 0.35; // rod click-tolerance (grid units)
const HIT_CONN_HALF = 0.35;

type Tool =
  | "select"
  | "drag"
  | "sleeve"
  | "rod"
  | "input"
  | "output"
  | "revolute"
  | "connector"
  | "anchor"
  | "spring"
  | "contact"
  | "bisector"
  | "delete";

const TOOL_LABELS: Record<Tool, string> = {
  select: "Select",
  drag: "Drag",
  sleeve: "Sleeve",
  rod: "Rod (2-pt)",
  input: "Input",
  output: "Output",
  revolute: "Revolute",
  connector: "Connector",
  anchor: "Anchor",
  spring: "Spring",
  contact: "Contact",
  bisector: "Bisector",
  delete: "Delete",
};

// A perpendicular-bisector guide endpoint can either reference an
// existing joint (so the guide follows the joint as bodies move) or
// be a frozen world point.
type BisectorEnd =
  | { kind: "joint"; jointId: JointId }
  | { kind: "point"; pos: Vec2 };

interface BisectorPair {
  id: string;
  a: BisectorEnd;
  b: BisectorEnd;
}

// =====================================================================
//  Coordinate helpers
// =====================================================================

function worldToSvg(p: Vec2): Vec2 {
  return { x: p.x * GRID, y: p.y * GRID };
}
function snap(v: number): number {
  return Math.round(v);
}
function snapPt(p: Vec2): Vec2 {
  return { x: snap(p.x), y: snap(p.y) };
}
// Half-unit snap: used for revolute joint placement, where the
// midpoint of a connector often lands on a 0.5-unit grid point even
// if the endpoints are on integer grid.
function snapHalf(v: number): number {
  return Math.round(v * 2) / 2;
}
function snapPtHalf(p: Vec2): Vec2 {
  return { x: snapHalf(p.x), y: snapHalf(p.y) };
}

// Distance from point P to segment AB, in world units.
function distPointSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const qx = a.x + t * dx;
  const qy = a.y + t * dy;
  return Math.hypot(p.x - qx, p.y - qy);
}

// Find the body (rod or connector) currently rendered at world point P,
// returning the topmost (last in array). Used by Revolute placement.
function hitTestBody(c: Circuit, p: Vec2): Body | null {
  for (let i = c.bodies.length - 1; i >= 0; i--) {
    const b = c.bodies[i];
    if (b.kind === "spring") continue;
    const endA =
      b.kind === "connector"
        ? bodyToWorld(b, { lx: -b.length / 2, ly: 0 })
        : bodyToWorld(b, rodEndLocal(b as RodBody, "a"));
    const endB =
      b.kind === "connector"
        ? bodyToWorld(b, { lx: b.length / 2, ly: 0 })
        : bodyToWorld(b, rodEndLocal(b as RodBody, "b"));
    const tol = b.kind === "connector" ? HIT_CONN_HALF : HIT_ROD_HALF;
    if (distPointSegment(p, endA, endB) <= tol) return b;
  }
  return null;
}

// =====================================================================
//  Component
// =====================================================================

export default function LogicGateSandbox() {
  const [circuit, setCircuit] = useState<Circuit>(() => emptyCircuit());
  // Undo history: each entry is a JSON-cloned snapshot of the circuit
  // taken *before* a user-initiated mutation. Kept in a ref so we can
  // read/write it synchronously inside setCircuit updaters without
  // triggering extra re-renders; `historyLen` drives button state.
  const historyRef = useRef<Circuit[]>([]);
  const [historyLen, setHistoryLen] = useState(0);
  const HISTORY_MAX = 50;
  const [cols, setCols] = useState<number>(DEFAULT_COLS);
  const [rows, setRows] = useState<number>(DEFAULT_ROWS);
  const canvasW = cols * GRID;
  const canvasH = rows * GRID;
  const [tool, setTool] = useState<Tool>("select");
  const [ghostAngle, setGhostAngle] = useState<Orient>(0);
  const [ghostPos, setGhostPos] = useState<Vec2 | null>(null);
  const [selected, setSelected] = useState<Set<BodyId>>(new Set());
  const [connectorFirst, setConnectorFirst] = useState<JointId | null>(null);
  const [bisectorFirst, setBisectorFirst] = useState<BisectorEnd | null>(null);
  const [bisectors, setBisectors] = useState<BisectorPair[]>([]);
  const [rodFirst, setRodFirst] = useState<Vec2 | null>(null);
  const [springFirst, setSpringFirst] = useState<JointId | null>(null);
  // First click in Contact mode — the pusher body + the click location.
  const [contactFirst, setContactFirst] = useState<
    | null
    | { bodyId: BodyId; worldPos: Vec2 }
  >(null);
  const [rubberBand, setRubberBand] = useState<
    | null
    | {
        startWorld: Vec2;
        currentWorld: Vec2;
      }
  >(null);
  const [library, setLibrary] = useState<SavedGate[]>([]);
  const [gateName, setGateName] = useState("");
  const [message, setMessage] = useState<{
    text: string;
    tone: "info" | "error";
  } | null>(null);

  // Drag state
  const [dragState, setDragState] = useState<
    | null
    | {
        kind: "body";
        bodyIds: BodyId[];
        origin: Map<BodyId, Vec2>;
        startWorld: Vec2;
      }
    | {
        kind: "joint";
        jointId: JointId;
        incidenceIdx: number;
        origin: Vec2;
        startWorld: Vec2;
      }
  >(null);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastFrame = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // -----------------------------------------------------------------
  //  Mount: load library
  // -----------------------------------------------------------------
  useEffect(() => {
    setLibrary(loadLibrary());
  }, []);

  // -----------------------------------------------------------------
  //  Animation tick: tween inputs, re-solve
  // -----------------------------------------------------------------
  useEffect(() => {
    const tick = (t: number) => {
      const last = lastFrame.current ?? t;
      const dt = Math.min(0.05, (t - last) / 1000);
      lastFrame.current = t;
      setCircuit((prev) => {
        let changed = false;
        const next: Circuit = {
          ...prev,
          bodies: prev.bodies.map((b) => {
            if (b.kind !== "input") return { ...b };
            // Passive inputs are mechanical followers — their s is
            // driven by the solver, not by the click-tween.
            if (b.passive) return { ...b };
            const tgt = b.target ?? -1;
            const diff = tgt - b.s;
            if (Math.abs(diff) < 1e-4) return { ...b };
            const step =
              Math.sign(diff) * Math.min(Math.abs(diff), INPUT_SPEED * dt);
            changed = true;
            return { ...b, s: b.s + step };
          }),
        };
        if (!changed) return prev;
        syncPosesFromDof(next);
        solve(next);
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastFrame.current = null;
    };
  }, []);

  // -----------------------------------------------------------------
  //  Re-solve on structural changes
  // -----------------------------------------------------------------
  useEffect(() => {
    setCircuit((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) => ({ ...b })),
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit.bodies.length, circuit.joints.length]);

  // -----------------------------------------------------------------
  //  Keyboard
  // -----------------------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "Escape") {
        setTool("select");
        setConnectorFirst(null);
        setBisectorFirst(null);
        setRodFirst(null);
        setSpringFirst(null);
        setContactFirst(null);
        setRubberBand(null);
        setMessage(null);
      } else if (e.key === "r" || e.key === "R") {
        setGhostAngle((a) => (a === 0 ? 90 : 0));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (selected.size > 0) deleteSelection();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // -----------------------------------------------------------------
  //  Drag: global mousemove + mouseup
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!dragState) return;
    const onMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const loc = pt.matrixTransform(ctm.inverse());
      const world: Vec2 = { x: loc.x / GRID, y: loc.y / GRID };
      const snappedWorld = snapPt(world);
      const dx = snappedWorld.x - dragState.startWorld.x;
      const dy = snappedWorld.y - dragState.startWorld.y;
      if (dragState.kind === "body") {
        setCircuit((prev) => ({
          ...prev,
          bodies: prev.bodies.map((b) => {
            if (!dragState.bodyIds.includes(b.id)) return b;
            const o = dragState.origin.get(b.id);
            if (!o) return b;
            const nb = { ...b };
            nb.restX = o.x + dx;
            nb.restY = o.y + dy;
            if (nb.kind === "sleeve" || nb.kind === "input" || nb.kind === "output") {
              const rod = nb as RodBody;
              const ux = Math.cos(rod.restTheta);
              const uy = Math.sin(rod.restTheta);
              rod.x = rod.restX + rod.s * ux;
              rod.y = rod.restY + rod.s * uy;
            } else {
              nb.x = o.x + dx;
              nb.y = o.y + dy;
            }
            return nb;
          }),
        }));
      } else if (dragState.kind === "joint") {
        setCircuit((prev) => ({
          ...prev,
          joints: prev.joints.map((j) => {
            if (j.id !== dragState.jointId) return j;
            const incs = j.incidents.map((inc, i) =>
              i === dragState.incidenceIdx
                ? {
                    ...inc,
                    lx: dragState.origin.x + dx,
                    ly: dragState.origin.y + dy,
                  }
                : inc,
            );
            return { ...j, incidents: incs };
          }),
        }));
      }
    };
    const onUp = () => {
      setCircuit((prev) => {
        const next: Circuit = {
          ...prev,
          bodies: prev.bodies.map((b) => ({ ...b })),
        };
        syncPosesFromDof(next);
        solve(next);
        return next;
      });
      setDragState(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState]);

  // -----------------------------------------------------------------
  //  Rubber-band selection
  // -----------------------------------------------------------------
  useEffect(() => {
    if (!rubberBand) return;
    const onMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const loc = pt.matrixTransform(ctm.inverse());
      const world: Vec2 = { x: loc.x / GRID, y: loc.y / GRID };
      setRubberBand((prev) => (prev ? { ...prev, currentWorld: world } : prev));
    };
    const onUp = () => {
      setRubberBand((rb) => {
        if (!rb) return null;
        const x1 = Math.min(rb.startWorld.x, rb.currentWorld.x);
        const y1 = Math.min(rb.startWorld.y, rb.currentWorld.y);
        const x2 = Math.max(rb.startWorld.x, rb.currentWorld.x);
        const y2 = Math.max(rb.startWorld.y, rb.currentWorld.y);
        const moved =
          Math.abs(rb.currentWorld.x - rb.startWorld.x) > 0.25 ||
          Math.abs(rb.currentWorld.y - rb.startWorld.y) > 0.25;
        if (moved) {
          setSelected((prev) => {
            const next = new Set(prev);
            for (const b of circuit.bodies) {
              if (b.kind === "spring") continue;
              // Use body's (x, y) centre for inclusion.
              if (
                b.x >= x1 &&
                b.x <= x2 &&
                b.y >= y1 &&
                b.y <= y2
              ) {
                next.add(b.id);
              }
            }
            return next;
          });
        }
        return null;
      });
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [rubberBand, circuit.bodies]);

  // -----------------------------------------------------------------
  //  Mutators
  // -----------------------------------------------------------------

  // Snapshot the current circuit to the undo stack *before* applying
  // `mutator`. Callers should use this wrapper (instead of plain
  // setCircuit) whenever the change is a user-initiated edit —
  // placement, deletion, toggle, etc. Internal/automatic updates (the
  // animation tick and drag-in-progress) continue to use setCircuit
  // so they don't pollute the undo stack.
  const applyUserMutation = useCallback(
    (mutator: (prev: Circuit) => Circuit) => {
      setCircuit((prev) => {
        const next = mutator(prev);
        if (next !== prev) {
          historyRef.current = [
            ...historyRef.current.slice(-(HISTORY_MAX - 1)),
            JSON.parse(JSON.stringify(prev)) as Circuit,
          ];
          setHistoryLen(historyRef.current.length);
        }
        return next;
      });
    },
    [],
  );

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const last = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    setCircuit(last);
  }, []);

  const flash = useCallback(
    (text: string, tone: "info" | "error" = "info") => {
      setMessage({ text, tone });
      setTimeout(
        () => setMessage((m) => (m?.text === text ? null : m)),
        2500,
      );
    },
    [],
  );

  function nextLabel(c: Circuit, kind: "input" | "output"): number {
    const ns = c.bodies
      .filter((b) => b.kind === kind)
      .map((b) => {
        const m = (b as RodBody).label?.match(/(\d+)$/);
        return m ? parseInt(m[1], 10) : 0;
      });
    return (ns.length ? Math.max(...ns) : 0) + 1;
  }

  function placeRod(kind: "sleeve" | "input" | "output", pos: Vec2) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: [...prev.bodies],
        joints: prev.joints,
        groups: prev.groups,
        nextId: prev.nextId,
      };
      const prefix = kind === "sleeve" ? "sl" : kind === "input" ? "in" : "ou";
      const id = freshId(next, prefix);
      const rod = makeRod(kind, id, pos, ghostAngle, DEFAULTS.rodLen);
      if (kind === "input") {
        rod.s = -1;
        rod.target = -1;
        rod.label = `IN${nextLabel(prev, "input")}`;
      } else if (kind === "output") {
        rod.s = 0;
        rod.label = `OUT${nextLabel(prev, "output")}`;
      }
      next.bodies.push(rod);
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  // Revolute: place a joint. Merge with nearby existing joint if present.
  function placeRevolute(pos: Vec2) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) => ({ ...b })),
        joints: prev.joints.map((j) => ({
          ...j,
          incidents: j.incidents.map((i) => ({ ...i })),
        })),
        groups: prev.groups,
        nextId: prev.nextId,
      };
      syncPosesFromDof(next);
      const nearBy = findJointNear(next, pos, JOINT_MERGE_TOL);
      const hit = hitTestBody(next, pos);

      // Determine the "right" incidence to add for this click.
      const incidence: JointIncidence = (() => {
        if (hit) {
          const local = worldToBody(hit, pos);
          return {
            kind: "body",
            bodyId: hit.id,
            lx: local.lx,
            ly: local.ly,
          };
        }
        return { kind: "frame", bodyId: null, lx: pos.x, ly: pos.y };
      })();

      if (nearBy) {
        // Merge if this incidence isn't already present.
        const already = nearBy.incidents.some(
          (inc) =>
            (inc.kind === "frame" && incidence.kind === "frame") ||
            (inc.kind === "body" &&
              incidence.kind === "body" &&
              inc.bodyId === incidence.bodyId),
        );
        if (already) {
          flash("This joint already has that incidence.", "info");
          return next;
        }
        const idx = next.joints.findIndex((j) => j.id === nearBy.id);
        next.joints[idx] = {
          ...next.joints[idx],
          incidents: [...next.joints[idx].incidents, incidence],
        };
        solve(next);
        return next;
      }

      const jid = freshId(next, "j");
      next.joints.push({ id: jid, incidents: [incidence] });
      solve(next);
      return next;
    });
  }

  // Connector: after picking two joints, create a new connector body
  // with incidences on both.
  function startConnector(jid: JointId) {
    setConnectorFirst(jid);
    flash("First joint chosen. Click the second joint.");
  }
  function completeConnector(second: JointId) {
    if (!connectorFirst) return;
    if (connectorFirst === second) {
      setConnectorFirst(null);
      return;
    }
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) => ({ ...b })),
        joints: prev.joints.map((j) => ({
          ...j,
          incidents: j.incidents.map((i) => ({ ...i })),
        })),
        groups: prev.groups,
        nextId: prev.nextId,
      };
      syncPosesFromDof(next);
      const j1 = findJoint(next, connectorFirst);
      const j2 = findJoint(next, second);
      if (!j1 || !j2) return next;
      const p1 = jointWorld(next, j1);
      const p2 = jointWorld(next, j2);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const length = Math.hypot(dx, dy);
      if (length < 0.5) {
        flash("Joints too close together.", "error");
        return next;
      }
      const theta = Math.atan2(dy, dx);
      const cx = (p1.x + p2.x) / 2;
      const cy = (p1.y + p2.y) / 2;
      const id = freshId(next, "cn");
      const conn: ConnectorBody = {
        id,
        kind: "connector",
        length,
        x: cx,
        y: cy,
        theta,
        restX: cx,
        restY: cy,
        restTheta: theta,
      };
      next.bodies.push(conn);
      // Add body incidences to each joint at the connector endpoints.
      const i1 = next.joints.findIndex((j) => j.id === j1.id);
      next.joints[i1] = {
        ...next.joints[i1],
        incidents: [
          ...next.joints[i1].incidents,
          { kind: "body", bodyId: id, lx: -length / 2, ly: 0 },
        ],
      };
      const i2 = next.joints.findIndex((j) => j.id === j2.id);
      next.joints[i2] = {
        ...next.joints[i2],
        incidents: [
          ...next.joints[i2].incidents,
          { kind: "body", bodyId: id, lx: +length / 2, ly: 0 },
        ],
      };
      solve(next);
      return next;
    });
    setConnectorFirst(null);
  }

  function anchorJoint(jid: JointId) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) => ({ ...b })),
        joints: prev.joints.map((j) => ({
          ...j,
          incidents: j.incidents.map((i) => ({ ...i })),
        })),
        groups: prev.groups,
        nextId: prev.nextId,
      };
      syncPosesFromDof(next);
      const j = findJoint(next, jid);
      if (!j) return next;
      const w = jointWorld(next, j);
      const idx = next.joints.findIndex((x) => x.id === jid);
      const hasFrame = j.incidents.some((i) => i.kind === "frame");
      if (hasFrame) {
        // Remove frame incidence.
        next.joints[idx] = {
          ...next.joints[idx],
          incidents: next.joints[idx].incidents.filter(
            (i) => i.kind !== "frame",
          ),
        };
        flash("Frame anchor removed.");
      } else {
        next.joints[idx] = {
          ...next.joints[idx],
          incidents: [
            ...next.joints[idx].incidents,
            { kind: "frame", bodyId: null, lx: w.x, ly: w.y },
          ],
        };
        flash("Joint anchored to frame.");
      }
      solve(next);
      return next;
    });
  }

  // Spring: two clicks on joints create a decorative spring between
  // them. The spring's rest length defaults to the current
  // end-to-end distance (natural length); the user can adjust it
  // later via the side panel to show the spring as compressed or
  // extended.
  function completeSpring(second: JointId) {
    if (!springFirst) return;
    if (springFirst === second) {
      setSpringFirst(null);
      return;
    }
    applyUserMutation((prev) => {
      const jA = findJoint(prev, springFirst);
      const jB = findJoint(prev, second);
      if (!jA || !jB) return prev;
      const pa = jointWorld(prev, jA);
      const pb = jointWorld(prev, jB);
      const len = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      if (len < 0.25) {
        flash("The two joints are too close to connect with a spring.", "error");
        return prev;
      }
      const next: Circuit = {
        ...prev,
        bodies: [...prev.bodies],
        joints: prev.joints,
        groups: prev.groups,
        nextId: prev.nextId,
      };
      const id = freshId(next, "sp");
      const spring: SpringBody = {
        id,
        kind: "spring",
        jointA: springFirst,
        jointB: second,
        restLength: len,
        coils: DEFAULTS.springCoils,
        stiffness: 0.8,
        x: (pa.x + pb.x) / 2,
        y: (pa.y + pb.y) / 2,
        theta: 0,
        restX: (pa.x + pb.x) / 2,
        restY: (pa.y + pb.y) / 2,
        restTheta: 0,
      };
      next.bodies.push(spring);
      return next;
    });
    setSpringFirst(null);
    flash("Spring placed at its natural length. Adjust in the side panel.");
  }

  // Contact placement. Two clicks:
  //   click 1: on the pusher body — must be a rod (sleeve/input/
  //            output). The click's local position on the rod is the
  //            pusher point; the rod's axis gives the push direction.
  //   click 2: on the target body (rod or connector). The click's
  //            local position on it is the target point.
  function beginContact(pusherId: BodyId, worldPos: Vec2) {
    const body = findBody(circuit, pusherId);
    if (!body) return;
    if (body.kind !== "sleeve" && body.kind !== "input" && body.kind !== "output") {
      flash(
        "The pusher must be a rod (sleeve / input / output); its axis is the push direction.",
        "error",
      );
      return;
    }
    setContactFirst({ bodyId: pusherId, worldPos });
    flash(
      "Pusher body chosen. Click the target body at the contact point.",
    );
  }
  function completeContact(targetId: BodyId, targetWorldPos: Vec2) {
    if (!contactFirst) return;
    if (contactFirst.bodyId === targetId) {
      setContactFirst(null);
      flash("Pusher and target must be different bodies.", "error");
      return;
    }
    const pusherBody = findBody(circuit, contactFirst.bodyId);
    const targetBody = findBody(circuit, targetId);
    if (!pusherBody || !targetBody) {
      setContactFirst(null);
      return;
    }
    if (targetBody.kind === "spring") {
      flash("A spring can't be a contact target.", "error");
      setContactFirst(null);
      return;
    }
    if (pusherBody.kind === "spring") {
      setContactFirst(null);
      return;
    }
    // Pusher is pinned to the rod's tip (pin a, local +rodLen/2 on x
    // in body frame) no matter where the user clicked. That's the
    // physical pusher — the end of the rod that does the pushing.
    const pusherLocal = {
      lx: (pusherBody as RodBody).rodLen / 2,
      ly: 0,
    };
    // Target's local is computed from the pusher's *current* world
    // position — so at creation, the target point sits exactly at
    // the pusher tip (gap = 0 to machine precision). This prevents
    // a spurious "tilt on placement" and means the contact is placed
    // in a consistent rest state. The user's click on the target
    // only tells us *which body* to attach to; the exact attachment
    // point is fixed by where the tip is right now.
    const pusherWorldNow = bodyToWorld(pusherBody, pusherLocal);
    const targetLocal = worldToBody(targetBody, pusherWorldNow);
    // Push direction: the pusher rod's +axis unit vector in the world
    // frame (i.e. the direction the rod's tip moves when s grows).
    const dir = {
      x: Math.cos(pusherBody.theta),
      y: Math.sin(pusherBody.theta),
    };
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        contacts: [
          ...prev.contacts,
          {
            id: `ct${prev.nextId}`,
            pusher: {
              bodyId: contactFirst.bodyId,
              lx: pusherLocal.lx,
              ly: pusherLocal.ly,
            },
            target: {
              bodyId: targetId,
              lx: targetLocal.lx,
              ly: targetLocal.ly,
            },
            dirX: dir.x,
            dirY: dir.y,
          },
        ],
        nextId: prev.nextId + 1,
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
    setContactFirst(null);
    flash("Contact placed.");
  }

  function deleteContact(id: string) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        contacts: prev.contacts.filter((c) => c.id !== id),
        bodies: prev.bodies.map((b) => ({ ...b })),
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  // Adjust a spring's rest length by a signed delta. Clamped to a
  // positive minimum so the spring doesn't invert. Triggers a solve
  // so the mechanism settles to the new equilibrium immediately.
  function nudgeSpringRestLength(id: BodyId, delta: number) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) =>
          b.kind === "spring" && b.id === id
            ? { ...b, restLength: Math.max(0.25, b.restLength + delta) }
            : { ...b },
        ),
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  function setSpringStiffness(id: BodyId, stiffness: number) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) =>
          b.kind === "spring" && b.id === id
            ? { ...b, stiffness: Math.max(0, Math.min(3, stiffness)) }
            : { ...b },
        ),
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  // Two-point rod placement. Creates a FREE RIGID BAR (connector)
  // between the two clicks, with a revolute joint automatically
  // placed at each endpoint so other pieces can pin onto it. If an
  // endpoint lands within merge tolerance of an existing joint, the
  // connector attaches to that joint instead of creating a duplicate.
  function completeRodBetween(a: Vec2, b: Vec2) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) {
      flash("The two points are too close for a rod.", "error");
      return;
    }
    const theta = Math.atan2(dy, dx);
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((x) => ({ ...x })),
        joints: prev.joints.map((j) => ({
          ...j,
          incidents: j.incidents.map((i) => ({ ...i })),
        })),
        groups: prev.groups,
        nextId: prev.nextId,
      };
      const connId = freshId(next, "cn");
      const conn: ConnectorBody = {
        id: connId,
        kind: "connector",
        length: len,
        x: center.x,
        y: center.y,
        theta,
        restX: center.x,
        restY: center.y,
        restTheta: theta,
      };
      next.bodies.push(conn);
      // Attach a joint at each endpoint, merging with any joint
      // already at that grid point.
      const attachJoint = (p: Vec2, localLx: number) => {
        const near = findJointNear(next, p, JOINT_MERGE_TOL);
        const incidence: JointIncidence = {
          kind: "body",
          bodyId: connId,
          lx: localLx,
          ly: 0,
        };
        if (near) {
          const idx = next.joints.findIndex((j) => j.id === near.id);
          next.joints[idx] = {
            ...next.joints[idx],
            incidents: [...next.joints[idx].incidents, incidence],
          };
        } else {
          const jid = freshId(next, "j");
          next.joints.push({ id: jid, incidents: [incidence] });
        }
      };
      attachJoint(a, -len / 2);
      attachJoint(b, +len / 2);
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  function toggleInput(id: BodyId) {
    applyUserMutation((prev) => ({
      ...prev,
      bodies: prev.bodies.map((b) =>
        b.kind === "input" && b.id === id && !b.passive
          ? { ...b, target: (b.target === 1 ? -1 : 1) as -1 | 1 }
          : b,
      ),
    }));
  }

  // Flip an input between user-driven (active) and mechanical-follower
  // (passive). Passive inputs get 1 DOF in the solver and are used
  // when chaining gates (e.g., the OR-gate's inputs become passive
  // once NOT mechanisms are wired in front of them).
  function toggleInputPassive(id: BodyId) {
    applyUserMutation((prev) => ({
      ...prev,
      bodies: prev.bodies.map((b) =>
        b.kind === "input" && b.id === id
          ? { ...b, passive: !b.passive }
          : b,
      ),
    }));
  }

  // Flip an output's stored s between +1 and -1. Intended for
  // pre-wiring design, when the user wants the output to start in a
  // specific state so the rest configuration of the mechanism is
  // meaningful. Once the output is constrained by the circuit, the
  // solver will override this each frame.
  function toggleOutput(id: BodyId) {
    applyUserMutation((prev) => {
      const next: Circuit = {
        ...prev,
        bodies: prev.bodies.map((b) => {
          if (b.kind !== "output" || b.id !== id) return { ...b };
          const nb = { ...b };
          nb.s = outputBit(b) === 1 ? -1 : +1;
          const ux = Math.cos(nb.restTheta);
          const uy = Math.sin(nb.restTheta);
          nb.x = nb.restX + nb.s * ux;
          nb.y = nb.restY + nb.s * uy;
          return nb;
        }),
        joints: prev.joints.map((j) => ({ ...j })),
        groups: prev.groups,
        nextId: prev.nextId,
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  // Resolve a bisector endpoint to a world position (given the
  // current circuit state).
  function bisectorEndWorld(e: BisectorEnd): Vec2 {
    if (e.kind === "point") return e.pos;
    const j = findJoint(circuit, e.jointId);
    return j ? jointWorld(circuit, j) : { x: 0, y: 0 };
  }

  // Interpret a click in bisector mode: if it lands within merge
  // tolerance of a joint, snap to that joint; otherwise use the raw
  // world point (not grid-snapped — revolutes aren't snapped either,
  // and users will usually aim at existing joints anyway).
  function bisectorEndFromClick(pos: Vec2): BisectorEnd {
    const near = findJointNear(circuit, pos, JOINT_MERGE_TOL);
    return near ? { kind: "joint", jointId: near.id } : { kind: "point", pos };
  }

  function addBisector(a: BisectorEnd, b: BisectorEnd) {
    // Reject degenerate pairs (same joint or same point).
    if (a.kind === "joint" && b.kind === "joint" && a.jointId === b.jointId) {
      flash("Pick two distinct joints for a bisector.", "error");
      return;
    }
    const pa = bisectorEndWorld(a);
    const pb = bisectorEndWorld(b);
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 0.5) {
      flash("The two points are too close — no well-defined bisector.", "error");
      return;
    }
    setBisectors((prev) => [
      ...prev,
      { id: `bi${Date.now()}-${prev.length}`, a, b },
    ]);
  }

  function clearBisectors() {
    setBisectors([]);
    setBisectorFirst(null);
  }

  function deleteSelection() {
    applyUserMutation((prev) => {
      const drop = selected;
      const bodies = prev.bodies.filter((b) => !drop.has(b.id));
      // Remove incidences pointing to dropped bodies.
      const joints = prev.joints
        .map((j) => ({
          ...j,
          incidents: j.incidents.filter(
            (inc) => inc.kind === "frame" || !drop.has(inc.bodyId ?? ""),
          ),
        }))
        // Remove empty joints.
        .filter((j) => j.incidents.length > 0);
      // Remove group memberships of deleted bodies.
      const groups = prev.groups
        .map((g) => ({
          ...g,
          bodyIds: g.bodyIds.filter((bid) => !drop.has(bid)),
          jointIds: g.jointIds.filter((jid) =>
            joints.some((j) => j.id === jid),
          ),
        }))
        .filter((g) => g.bodyIds.length > 0);
      // Remove contacts that referenced dropped bodies.
      const contacts = prev.contacts.filter(
        (co) => !drop.has(co.pusher.bodyId) && !drop.has(co.target.bodyId),
      );
      const next: Circuit = {
        bodies,
        joints,
        groups,
        contacts,
        nextId: prev.nextId,
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
    setSelected(new Set());
  }

  function deleteBody(id: BodyId) {
    setSelected(new Set([id]));
    deleteSelection();
  }
  function deleteJoint(jid: JointId) {
    applyUserMutation((prev) => {
      const joints = prev.joints.filter((j) => j.id !== jid);
      // Drop springs that referenced this joint (they'd otherwise be
      // dangling). We keep connectors; they just lose an endpoint.
      const bodies = prev.bodies
        .filter(
          (b) =>
            b.kind !== "spring" ||
            (b.jointA !== jid && b.jointB !== jid),
        )
        .map((b) => ({ ...b }));
      const groups = prev.groups.map((g) => ({
        ...g,
        jointIds: g.jointIds.filter((x) => x !== jid),
      }));
      // Contacts are referenced by body, not joint, so they're
      // preserved.
      const next: Circuit = {
        ...prev,
        bodies,
        joints,
        groups,
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
  }

  function clearAll() {
    applyUserMutation(() => emptyCircuit());
    setSelected(new Set());
    setConnectorFirst(null);
    flash("Canvas cleared.");
  }

  function makeGroup() {
    if (selected.size < 1) {
      flash("Select one or more bodies first.", "error");
      return;
    }
    const name = prompt("Group name?") ?? "";
    if (!name.trim()) return;
    applyUserMutation((prev) => {
      const chosen = [...selected];
      // Include joints that live entirely within the chosen bodies.
      const chosenSet = new Set(chosen);
      const innerJoints = prev.joints
        .filter((j) =>
          j.incidents.every(
            (inc) =>
              inc.kind === "frame" ||
              (inc.bodyId != null && chosenSet.has(inc.bodyId)),
          ),
        )
        .map((j) => j.id);
      const id = freshId({ ...prev }, "g");
      const grp: Group = {
        id,
        name: name.trim(),
        bodyIds: chosen,
        jointIds: innerJoints,
        scaffolded: false,
      };
      return {
        ...prev,
        nextId: prev.nextId + 1,
        groups: [...prev.groups, grp],
      };
    });
    setSelected(new Set());
  }

  function ungroup(groupId: string) {
    applyUserMutation((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
    }));
  }

  function toggleScaffold(groupId: string) {
    applyUserMutation((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, scaffolded: !g.scaffolded } : g,
      ),
    }));
  }

  function groupFor(bodyId: BodyId): Group | undefined {
    return circuit.groups.find((g) => g.bodyIds.includes(bodyId));
  }

  // -----------------------------------------------------------------
  //  Library (save / export / import / insert)
  // -----------------------------------------------------------------

  function saveCurrentAsGate() {
    const name = gateName.trim();
    if (!name) {
      flash("Give the gate a name first.", "error");
      return;
    }
    if (circuit.bodies.length === 0) {
      flash("Nothing to save.", "error");
      return;
    }
    const snapshot: Circuit = JSON.parse(JSON.stringify(circuit));
    const entry: SavedGate = {
      name,
      createdAt: Date.now(),
      circuit: snapshot,
    };
    const next = upsertGate(library, entry);
    saveLibrary(next);
    setLibrary(next);
    setGateName("");
    flash(`Saved "${name}".`);
  }

  function insertGate(g: SavedGate) {
    applyUserMutation((prev) => {
      const offset: Vec2 = { x: 1, y: 1 };
      const { bodies, joints, groups, contacts, nextId } = cloneRemapped(
        g.circuit,
        prev.nextId,
        offset,
      );
      const next: Circuit = {
        bodies: [...prev.bodies, ...bodies],
        joints: [...prev.joints, ...joints],
        groups: [...prev.groups, ...groups],
        contacts: [...prev.contacts, ...contacts],
        nextId,
      };
      syncPosesFromDof(next);
      solve(next);
      return next;
    });
    flash(`Inserted "${g.name}".`);
  }

  function loadGate(g: SavedGate) {
    const snapshot: Circuit = JSON.parse(JSON.stringify(g.circuit));
    syncPosesFromDof(snapshot);
    solve(snapshot);
    applyUserMutation(() => snapshot);
    setSelected(new Set());
    flash(`Loaded "${g.name}".`);
  }

  function removeGate(name: string) {
    const next = deleteGate(library, name);
    saveLibrary(next);
    setLibrary(next);
  }

  function exportCurrent() {
    const blob = new Blob([serializeCircuit(circuit)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (gateName.trim() || "circuit") + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const c = deserializeCircuit(reader.result as string);
        syncPosesFromDof(c);
        solve(c);
        applyUserMutation(() => c);
        flash("Circuit imported.");
      } catch (err) {
        flash(
          "Couldn't parse that file: " + (err as Error).message,
          "error",
        );
      }
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  // -----------------------------------------------------------------
  //  Pointer helpers
  // -----------------------------------------------------------------

  function svgCoordsFromEvent(e: React.MouseEvent): Vec2 | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const loc = pt.matrixTransform(ctm.inverse());
    return { x: loc.x / GRID, y: loc.y / GRID };
  }

  function onCanvasMove(e: React.MouseEvent) {
    const p = svgCoordsFromEvent(e);
    if (!p) return;
    setGhostPos(snapPt(p));
  }

  // Start a rubber-band selection if the user mousedowns on the SVG
  // background in Select mode.
  function onCanvasMouseDown(e: React.MouseEvent) {
    if (tool !== "select") return;
    const target = e.target as Element | null;
    if (!target) return;
    // Only fire if the target is the SVG itself (empty canvas). Clicks
    // on bodies / joints / etc. are received by their own handlers.
    if (target !== svgRef.current) return;
    const p = svgCoordsFromEvent(e);
    if (!p) return;
    setRubberBand({ startWorld: p, currentWorld: p });
    if (!e.shiftKey) setSelected(new Set());
  }

  function onCanvasClick(e: React.MouseEvent) {
    const p = svgCoordsFromEvent(e);
    if (!p) return;
    const snapped = snapPt(p);
    if (snapped.x < 0 || snapped.x > cols || snapped.y < 0 || snapped.y > rows) return;
    switch (tool) {
      case "sleeve":
        placeRod("sleeve", snapped);
        break;
      case "input":
        placeRod("input", snapped);
        break;
      case "output":
        placeRod("output", snapped);
        break;
      case "revolute":
        // Revolute clicks snap to half-unit grid. This puts joint
        // centres on clean points while still letting connectors
        // whose midpoints fall on 0.5-unit positions be reached.
        placeRevolute(snapPtHalf(p));
        break;
      case "spring":
        flash(
          "Click two revolute joints to connect a spring. Use the Revolute tool first if no joint is there yet.",
          "error",
        );
        break;
      case "rod": {
        if (!rodFirst) {
          setRodFirst(snapped);
          flash("First point chosen. Click the second point to span the rod.");
        } else {
          completeRodBetween(rodFirst, snapped);
          setRodFirst(null);
          setMessage(null);
        }
        break;
      }
      case "bisector": {
        const end = bisectorEndFromClick(p);
        if (!bisectorFirst) {
          setBisectorFirst(end);
          flash("First point chosen. Click the second point.");
        } else {
          addBisector(bisectorFirst, end);
          setBisectorFirst(null);
          setMessage(null);
        }
        break;
      }
      case "select":
        setSelected(new Set());
        break;
    }
  }

  function onBodyClick(e: React.MouseEvent, id: BodyId) {
    e.stopPropagation();
    if (tool === "delete") {
      deleteBody(id);
      return;
    }
    if (tool === "select") {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else {
          if (!e.shiftKey) next.clear();
          next.add(id);
        }
        return next;
      });
      return;
    }
    // Let Revolute placement fall through via canvas click.
    if (tool === "revolute") {
      const p = svgCoordsFromEvent(e);
      if (p) placeRevolute(snapPtHalf(p));
      return;
    }
    // Contact tool: first click picks the pusher body, second click
    // picks the target body (both clicks are on bodies).
    if (tool === "contact") {
      const p = svgCoordsFromEvent(e);
      if (!p) return;
      if (!contactFirst) beginContact(id, p);
      else completeContact(id, p);
      return;
    }
    // Spring tool now only works on joints — body clicks are
    // harmless in that mode.
  }

  function onBodyMouseDown(e: React.MouseEvent, id: BodyId) {
    if (tool !== "drag") return;
    e.stopPropagation();
    const body = findBody(circuit, id);
    if (!body || body.kind === "spring") return;
    const p = svgCoordsFromEvent(e);
    if (!p) return;
    // Snapshot pre-drag state for undo.
    historyRef.current = [
      ...historyRef.current.slice(-(HISTORY_MAX - 1)),
      JSON.parse(JSON.stringify(circuit)) as Circuit,
    ];
    setHistoryLen(historyRef.current.length);
    // Drag all bodies in the same group, if any.
    const g = groupFor(id);
    const ids = g ? g.bodyIds : [id];
    const origin = new Map<BodyId, Vec2>();
    for (const bid of ids) {
      const b = findBody(circuit, bid);
      if (b) origin.set(bid, { x: b.restX, y: b.restY });
    }
    setDragState({
      kind: "body",
      bodyIds: ids,
      origin,
      startWorld: snapPt(p),
    });
  }

  function onJointClick(e: React.MouseEvent, jid: JointId) {
    e.stopPropagation();
    if (tool === "delete") {
      deleteJoint(jid);
      return;
    }
    if (tool === "connector") {
      if (!connectorFirst) startConnector(jid);
      else completeConnector(jid);
      return;
    }
    if (tool === "anchor") {
      anchorJoint(jid);
      return;
    }
    if (tool === "revolute") {
      // Re-clicking an existing joint adds the "right" incidence —
      // same semantic as clicking in empty space at the joint's
      // location: we delegate to placeRevolute at the joint's world
      // position so merging kicks in.
      const j = findJoint(circuit, jid);
      if (j) placeRevolute(jointWorld(circuit, j));
      return;
    }
    if (tool === "bisector") {
      const end: BisectorEnd = { kind: "joint", jointId: jid };
      if (!bisectorFirst) {
        setBisectorFirst(end);
        flash("First joint chosen. Click the second point.");
      } else {
        addBisector(bisectorFirst, end);
        setBisectorFirst(null);
        setMessage(null);
      }
      return;
    }
    if (tool === "spring") {
      if (!springFirst) {
        setSpringFirst(jid);
        flash("First joint chosen. Click the second joint.");
      } else {
        completeSpring(jid);
      }
      return;
    }
  }

  function onJointMouseDown(e: React.MouseEvent, jid: JointId) {
    if (tool !== "drag") return;
    const j = findJoint(circuit, jid);
    if (!j) return;
    // Only frame-anchored joints can be dragged independently.
    const idx = j.incidents.findIndex((i) => i.kind === "frame");
    if (idx < 0) return; // body-ridden joints move with their body
    e.stopPropagation();
    const p = svgCoordsFromEvent(e);
    if (!p) return;
    // Snapshot pre-drag state for undo.
    historyRef.current = [
      ...historyRef.current.slice(-(HISTORY_MAX - 1)),
      JSON.parse(JSON.stringify(circuit)) as Circuit,
    ];
    setHistoryLen(historyRef.current.length);
    const inc = j.incidents[idx];
    setDragState({
      kind: "joint",
      jointId: jid,
      incidenceIdx: idx,
      origin: { x: inc.lx, y: inc.ly },
      startWorld: snapPt(p),
    });
  }

  function onInputKnob(e: React.MouseEvent, id: BodyId) {
    e.stopPropagation();
    // In Select mode the knob toggles the input. In every other
    // tool mode, the knob click is forwarded to onBodyClick so that
    // Contact / Revolute / Delete / etc. can pick the body up.
    if (tool === "select") {
      toggleInput(id);
    } else {
      onBodyClick(e, id);
    }
  }

  // -----------------------------------------------------------------
  //  Render
  // -----------------------------------------------------------------

  const outputs = circuit.bodies.filter(
    (b): b is RodBody => b.kind === "output",
  );

  // Bodies that should be dimmed because they're inside a scaffold.
  const hiddenBodies = new Set<BodyId>();
  const hiddenJoints = new Set<JointId>();
  const scaffoldBoxes: {
    group: Group;
    x: number;
    y: number;
    w: number;
    h: number;
  }[] = [];
  for (const g of circuit.groups) {
    if (!g.scaffolded) continue;
    // Bounding box of member bodies.
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const bid of g.bodyIds) {
      const b = findBody(circuit, bid);
      if (!b || b.kind === "spring") continue;
      const ends =
        b.kind === "connector"
          ? [
              bodyToWorld(b, { lx: -b.length / 2, ly: 0 }),
              bodyToWorld(b, { lx: +b.length / 2, ly: 0 }),
            ]
          : [
              bodyToWorld(b, rodEndLocal(b as RodBody, "a")),
              bodyToWorld(b, rodEndLocal(b as RodBody, "b")),
            ];
      for (const p of ends) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      // Hide internals, except inputs/outputs whose terminals poke out.
      if (b.kind !== "input" && b.kind !== "output") {
        hiddenBodies.add(b.id);
      }
    }
    for (const jid of g.jointIds) hiddenJoints.add(jid);
    if (isFinite(minX)) {
      const pad = 1;
      scaffoldBoxes.push({
        group: g,
        x: (minX - pad) * GRID,
        y: (minY - pad) * GRID,
        w: (maxX - minX + 2 * pad) * GRID,
        h: (maxY - minY + 2 * pad) * GRID,
      });
    }
  }

  return (
    <figure className="not-prose my-8">
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <Toolbar
            tool={tool}
            setTool={(t) => {
              setTool(t);
              setConnectorFirst(null);
              setBisectorFirst(null);
              setRodFirst(null);
              setSpringFirst(null);
              setContactFirst(null);
              setRubberBand(null);
              setMessage(null);
            }}
            ghostAngle={ghostAngle}
            rotateGhost={() =>
              setGhostAngle((a) => (a === 0 ? 90 : 0))
            }
            onUndo={undo}
            canUndo={historyLen > 0}
            onClear={clearAll}
            onDeleteSelected={deleteSelection}
            hasSelected={selected.size > 0}
            onGroup={makeGroup}
          />
          <CanvasControls
            cols={cols}
            rows={rows}
            onCols={(n) => setCols(Math.max(MIN_COLS, Math.min(MAX_COLS, n)))}
            onRows={(n) => setRows(Math.max(MIN_ROWS, Math.min(MAX_ROWS, n)))}
          />
          <div
            style={{
              border: "1px solid var(--rule)",
              borderRadius: 6,
              overflow: "auto",
              maxWidth: "100%",
              maxHeight: "75vh",
              background: "var(--surface)",
              marginTop: 8,
            }}
          >
            <svg
              ref={svgRef}
              width={canvasW}
              height={canvasH}
              viewBox={`0 0 ${canvasW} ${canvasH}`}
              onMouseMove={onCanvasMove}
              onMouseLeave={() => setGhostPos(null)}
              onMouseDown={onCanvasMouseDown}
              onClick={onCanvasClick}
              style={{
                display: "block",
                cursor:
                  tool === "select"
                    ? "default"
                    : tool === "drag"
                      ? "grab"
                      : tool === "delete"
                        ? "not-allowed"
                        : "crosshair",
                userSelect: "none",
              }}
            >
              <GridBg cols={cols} rows={rows} />
              {/* Perpendicular-bisector guides (drawn above the grid,
                  below bodies and joints). */}
              {bisectors.map((bi) => {
                const pa = bisectorEndWorld(bi.a);
                const pb = bisectorEndWorld(bi.b);
                return (
                  <BisectorLine
                    key={bi.id}
                    a={pa}
                    b={pb}
                  />
                );
              })}
              {bisectorFirst && (
                <circle
                  cx={worldToSvg(bisectorEndWorld(bisectorFirst)).x}
                  cy={worldToSvg(bisectorEndWorld(bisectorFirst)).y}
                  r={10}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  pointerEvents="none"
                />
              )}
              {/* Bodies */}
              {circuit.bodies.map((b) => (
                <BodyView
                  key={b.id}
                  body={b}
                  circuit={circuit}
                  selected={
                    selected.has(b.id) ||
                    (tool === "contact" && contactFirst?.bodyId === b.id)
                  }
                  dimmed={hiddenBodies.has(b.id)}
                  tool={tool}
                  onBodyClick={onBodyClick}
                  onBodyMouseDown={onBodyMouseDown}
                  onInputKnob={onInputKnob}
                  onOutputToggle={(e, id) => {
                    e.stopPropagation();
                    // In Select mode the readout toggles the output
                    // state. Otherwise forward to onBodyClick so the
                    // active tool (Contact / Revolute / Delete / etc.)
                    // gets the click.
                    if (tool === "select") {
                      toggleOutput(id);
                    } else {
                      onBodyClick(e, id);
                    }
                  }}
                />
              ))}
              {/* Joints */}
              {circuit.joints.map((j) => (
                <JointView
                  key={j.id}
                  joint={j}
                  circuit={circuit}
                  hidden={hiddenJoints.has(j.id)}
                  tool={tool}
                  selected={connectorFirst === j.id}
                  onJointClick={onJointClick}
                  onJointMouseDown={onJointMouseDown}
                />
              ))}
              {/* Unilateral contact markers */}
              {(circuit.contacts ?? []).map((co) => (
                <ContactView
                  key={co.id}
                  contact={co}
                  circuit={circuit}
                  tool={tool}
                  onClick={() => {
                    if (tool === "delete") deleteContact(co.id);
                  }}
                />
              ))}
              {/* Scaffold overlays */}
              {scaffoldBoxes.map((s) => (
                <g key={s.group.id} pointerEvents="none">
                  <rect
                    x={s.x}
                    y={s.y}
                    width={s.w}
                    height={s.h}
                    rx={10}
                    fill="var(--surface)"
                    fillOpacity={0.82}
                    stroke="var(--ink)"
                    strokeWidth={1.2}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={s.x + 10}
                    y={s.y + 18}
                    fontSize={12}
                    fontWeight={600}
                    fill="var(--ink)"
                  >
                    {s.group.name}
                  </text>
                </g>
              ))}
              {/* Ghost */}
              {ghostPos &&
                tool !== "select" &&
                tool !== "drag" &&
                tool !== "delete" &&
                tool !== "connector" &&
                tool !== "anchor" &&
                tool !== "spring" && (
                  <GhostPreview tool={tool} at={ghostPos} angle={ghostAngle} />
                )}
              {/* Rod first-click → live ghost from the first point
                  to the cursor. */}
              {tool === "rod" && rodFirst && ghostPos && (
                <line
                  x1={worldToSvg(rodFirst).x}
                  y1={worldToSvg(rodFirst).y}
                  x2={worldToSvg(ghostPos).x}
                  y2={worldToSvg(ghostPos).y}
                  stroke="var(--accent)"
                  strokeWidth={3}
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  pointerEvents="none"
                />
              )}
              {rubberBand &&
                (() => {
                  const x1 = Math.min(
                    rubberBand.startWorld.x,
                    rubberBand.currentWorld.x,
                  );
                  const y1 = Math.min(
                    rubberBand.startWorld.y,
                    rubberBand.currentWorld.y,
                  );
                  const x2 = Math.max(
                    rubberBand.startWorld.x,
                    rubberBand.currentWorld.x,
                  );
                  const y2 = Math.max(
                    rubberBand.startWorld.y,
                    rubberBand.currentWorld.y,
                  );
                  const p1 = worldToSvg({ x: x1, y: y1 });
                  const p2 = worldToSvg({ x: x2, y: y2 });
                  return (
                    <rect
                      x={p1.x}
                      y={p1.y}
                      width={p2.x - p1.x}
                      height={p2.y - p1.y}
                      fill="var(--accent)"
                      fillOpacity={0.12}
                      stroke="var(--accent)"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      pointerEvents="none"
                    />
                  );
                })()}
              {/* Spring first-click highlight: ring the chosen joint
                  until the second click lands. */}
              {tool === "spring" &&
                springFirst &&
                (() => {
                  const j = findJoint(circuit, springFirst);
                  if (!j) return null;
                  const p = worldToSvg(jointWorld(circuit, j));
                  return (
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={11}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={1.5}
                      strokeDasharray="3 2"
                      pointerEvents="none"
                    />
                  );
                })()}
            </svg>
          </div>
          <StatusBar
            tool={tool}
            connectorFirst={connectorFirst != null}
            bisectorFirst={bisectorFirst != null}
            rodFirst={rodFirst != null}
            springFirst={springFirst != null}
            contactFirst={contactFirst != null}
            message={message}
          />
        </div>

        <SidePanel
          inputs={circuit.bodies.filter(
            (b): b is RodBody => b.kind === "input",
          )}
          onToggleInputPassive={toggleInputPassive}
          outputs={outputs}
          springs={circuit.bodies.filter(
            (b): b is SpringBody => b.kind === "spring",
          )}
          circuit={circuit}
          onSpringRestStep={nudgeSpringRestLength}
          onSpringStiffness={setSpringStiffness}
          gateName={gateName}
          setGateName={setGateName}
          onSave={saveCurrentAsGate}
          onExport={exportCurrent}
          onImport={() => fileInputRef.current?.click()}
          library={library}
          onInsert={insertGate}
          onLoad={loadGate}
          onRemove={removeGate}
          groups={circuit.groups}
          onUngroup={ungroup}
          onToggleScaffold={toggleScaffold}
          bisectorCount={bisectors.length}
          onClearBisectors={clearBisectors}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={importFile}
        />
      </div>
    </figure>
  );
}

// =====================================================================
//  Toolbar
// =====================================================================

function Toolbar({
  tool,
  setTool,
  ghostAngle,
  rotateGhost,
  onUndo,
  canUndo,
  onClear,
  onDeleteSelected,
  hasSelected,
  onGroup,
}: {
  tool: Tool;
  setTool: (t: Tool) => void;
  ghostAngle: Orient;
  rotateGhost: () => void;
  onUndo: () => void;
  canUndo: boolean;
  onClear: () => void;
  onDeleteSelected: () => void;
  hasSelected: boolean;
  onGroup: () => void;
}) {
  const tools: Tool[] = [
    "select",
    "drag",
    "sleeve",
    "rod",
    "input",
    "output",
    "revolute",
    "connector",
    "anchor",
    "spring",
    "contact",
    "bisector",
    "delete",
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {tools.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTool(t)}
          aria-pressed={tool === t}
          style={{
            padding: "4px 10px",
            fontSize: 13,
            borderRadius: 5,
            border: "1px solid var(--rule)",
            background: tool === t ? "var(--accent)" : "var(--bg)",
            color: tool === t ? "var(--bg)" : "var(--ink)",
            cursor: "pointer",
          }}
        >
          {TOOL_LABELS[t]}
        </button>
      ))}
      <span
        style={{
          marginLeft: 12,
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        orient: {ghostAngle === 0 ? "horiz" : "vert"}{" "}
        <button
          type="button"
          onClick={rotateGhost}
          style={{
            marginLeft: 4,
            padding: "2px 6px",
            fontSize: 11,
            borderRadius: 4,
            border: "1px solid var(--rule)",
            background: "var(--bg)",
            cursor: "pointer",
          }}
        >
          R
        </button>
      </span>
      <span style={{ flex: 1 }} />
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo (Ctrl/⌘-Z)"
        style={{
          padding: "4px 10px",
          fontSize: 13,
          borderRadius: 5,
          border: "1px solid var(--rule)",
          background: "var(--bg)",
          cursor: canUndo ? "pointer" : "not-allowed",
          opacity: canUndo ? 1 : 0.5,
        }}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onGroup}
        disabled={!hasSelected}
        style={{
          padding: "4px 10px",
          fontSize: 13,
          borderRadius: 5,
          border: "1px solid var(--rule)",
          background: "var(--bg)",
          cursor: hasSelected ? "pointer" : "not-allowed",
          opacity: hasSelected ? 1 : 0.5,
        }}
      >
        Group
      </button>
      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={!hasSelected}
        style={{
          padding: "4px 10px",
          fontSize: 13,
          borderRadius: 5,
          border: "1px solid var(--rule)",
          background: "var(--bg)",
          cursor: hasSelected ? "pointer" : "not-allowed",
          opacity: hasSelected ? 1 : 0.5,
        }}
      >
        Delete selection
      </button>
      <button
        type="button"
        onClick={onClear}
        style={{
          padding: "4px 10px",
          fontSize: 13,
          borderRadius: 5,
          border: "1px solid var(--rule)",
          background: "var(--bg)",
          cursor: "pointer",
        }}
      >
        Clear
      </button>
    </div>
  );
}

// =====================================================================
//  Canvas controls (resize)
// =====================================================================

function CanvasControls({
  cols,
  rows,
  onCols,
  onRows,
}: {
  cols: number;
  rows: number;
  onCols: (n: number) => void;
  onRows: (n: number) => void;
}) {
  const stepper = (
    value: number,
    onChange: (n: number) => void,
    label: string,
  ) => (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "var(--muted)",
      }}
    >
      {label}
      <button
        type="button"
        onClick={() => onChange(value - 2)}
        style={stepperBtn}
        aria-label={`Shrink ${label}`}
      >
        −
      </button>
      <span
        style={{
          minWidth: 22,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
          color: "var(--ink)",
          fontWeight: 500,
        }}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 2)}
        style={stepperBtn}
        aria-label={`Grow ${label}`}
      >
        +
      </button>
    </span>
  );
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        marginTop: 6,
      }}
    >
      {stepper(cols, onCols, "width")}
      {stepper(rows, onRows, "height")}
    </div>
  );
}

const stepperBtn: React.CSSProperties = {
  width: 22,
  height: 22,
  padding: 0,
  fontSize: 14,
  lineHeight: "20px",
  borderRadius: 4,
  border: "1px solid var(--rule)",
  background: "var(--bg)",
  cursor: "pointer",
};

// =====================================================================
//  Status bar
// =====================================================================

function StatusBar({
  tool,
  connectorFirst,
  bisectorFirst,
  rodFirst,
  springFirst,
  contactFirst,
  message,
}: {
  tool: Tool;
  connectorFirst: boolean;
  bisectorFirst: boolean;
  rodFirst: boolean;
  springFirst: boolean;
  contactFirst: boolean;
  message: { text: string; tone: "info" | "error" } | null;
}) {
  let hint = "";
  switch (tool) {
    case "select":
      hint =
        "Click a body to select; shift-click adds; drag an empty area to rubber-band-select. Use Group in the toolbar once a selection is made.";
      break;
    case "drag":
      hint = "Click-and-drag any body (or a frame-anchored joint) to move it. Dragging one member of a group drags the whole group.";
      break;
    case "sleeve":
      hint = "Click to place a sleeve. Press R to rotate.";
      break;
    case "rod":
      hint = rodFirst
        ? "Now click the second point — a rigid bar with pivots at both ends will be placed."
        : "Click two points: a free rigid bar (pivots at both ends) spans them. Different from Sleeve, which slides.";
      break;
    case "input":
      hint = "Click to place an input terminal. Press R to rotate.";
      break;
    case "output":
      hint = "Click to place an output terminal. Press R to rotate.";
      break;
    case "revolute":
      hint =
        "Click to place a revolute joint. On a rod/connector → attached to that body. In empty space → anchored to the frame. Clicking an existing joint merges with it.";
      break;
    case "connector":
      hint = connectorFirst
        ? "Now click the second joint to draw the connector."
        : "Click two revolute joints to draw a rigid connector between them.";
      break;
    case "anchor":
      hint = "Click a joint to toggle its frame anchor.";
      break;
    case "spring":
      hint = springFirst
        ? "Now click the second revolute joint."
        : "Click two revolute joints to hang a spring between them. Adjust its rest length in the side panel.";
      break;
    case "bisector":
      hint = bisectorFirst
        ? "Now click the second point (or joint)."
        : "Click two points (or joints) to draw their perpendicular bisector.";
      break;
    case "contact":
      hint = contactFirst
        ? "Now click the target body (a connector or rod) at the contact point."
        : "Click a rod body first — its tip will be the pusher. Push direction comes from the rod's axis.";
      break;
    case "delete":
      hint = "Click any body or joint to remove it.";
      break;
  }
  return (
    <div
      style={{
        fontSize: 12,
        color: "var(--muted)",
        marginTop: 6,
        minHeight: 18,
      }}
    >
      {message ? (
        <span
          style={{
            color:
              message.tone === "error" ? "var(--accent)" : "var(--ink)",
          }}
        >
          {message.text}
        </span>
      ) : (
        hint
      )}
    </div>
  );
}

// =====================================================================
//  Side panel
// =====================================================================

function SidePanel({
  inputs,
  onToggleInputPassive,
  outputs,
  springs,
  circuit,
  onSpringRestStep,
  onSpringStiffness,
  gateName,
  setGateName,
  onSave,
  onExport,
  onImport,
  library,
  onInsert,
  onLoad,
  onRemove,
  groups,
  onUngroup,
  onToggleScaffold,
  bisectorCount,
  onClearBisectors,
}: {
  inputs: RodBody[];
  onToggleInputPassive: (id: BodyId) => void;
  outputs: RodBody[];
  springs: SpringBody[];
  circuit: Circuit;
  onSpringRestStep: (id: BodyId, delta: number) => void;
  onSpringStiffness: (id: BodyId, stiffness: number) => void;
  gateName: string;
  setGateName: (s: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  library: SavedGate[];
  onInsert: (g: SavedGate) => void;
  onLoad: (g: SavedGate) => void;
  onRemove: (name: string) => void;
  groups: Group[];
  onUngroup: (id: string) => void;
  onToggleScaffold: (id: string) => void;
  bisectorCount: number;
  onClearBisectors: () => void;
}) {
  const cellStyle: React.CSSProperties = {
    padding: "4px 8px",
    border: "1px solid var(--rule)",
    borderRadius: 5,
    marginBottom: 4,
    fontSize: 13,
  };
  const btn: React.CSSProperties = {
    padding: "3px 8px",
    fontSize: 11,
    borderRadius: 4,
    border: "1px solid var(--rule)",
    background: "var(--bg)",
    cursor: "pointer",
  };
  return (
    <div
      style={{
        flex: "0 0 240px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <section>
        <H3>Inputs</H3>
        {inputs.length === 0 ? (
          <P>No inputs yet.</P>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {inputs.map((inp) => (
              <li
                key={inp.id}
                style={{
                  ...cellStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    color: inp.passive ? "var(--muted)" : "var(--ink)",
                    fontStyle: inp.passive ? "italic" : "normal",
                  }}
                >
                  {inp.label ?? inp.id}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleInputPassive(inp.id)}
                  style={btn}
                  title={
                    inp.passive
                      ? "Make this input user-driven (clickable knob)"
                      : "Make this input a mechanical follower (no knob, 1 DOF)"
                  }
                >
                  {inp.passive ? "Passive" : "Active"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <H3>Outputs</H3>
        {outputs.length === 0 ? (
          <P>No outputs yet.</P>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {outputs.map((o) => (
              <li
                key={o.id}
                style={{
                  ...cellStyle,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>{o.label ?? o.id}</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: outputBit(o) === 1 ? "var(--accent)" : "var(--muted)",
                  }}
                >
                  {outputBit(o)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <H3>Groups</H3>
        {groups.length === 0 ? (
          <P>No groups yet.</P>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {groups.map((g) => (
              <li key={g.id} style={cellStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <strong>{g.name}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {g.bodyIds.length} parts
                  </span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    style={btn}
                    onClick={() => onToggleScaffold(g.id)}
                  >
                    {g.scaffolded ? "Unscaffold" : "Scaffold"}
                  </button>
                  <button
                    type="button"
                    style={btn}
                    onClick={() => onUngroup(g.id)}
                  >
                    Ungroup
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {springs.length > 0 && (
        <section>
          <H3>Springs</H3>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {springs.map((s) => {
              const jA = s.jointA ? findJoint(circuit, s.jointA) : null;
              const jB = s.jointB ? findJoint(circuit, s.jointB) : null;
              const currentLen =
                jA && jB
                  ? (() => {
                      const pa = jointWorld(circuit, jA);
                      const pb = jointWorld(circuit, jB);
                      return Math.hypot(pb.x - pa.x, pb.y - pa.y);
                    })()
                  : 0;
              const stretch = currentLen / Math.max(0.25, s.restLength);
              const tag =
                Math.abs(stretch - 1) < 0.03
                  ? "natural"
                  : stretch > 1
                    ? "stretched"
                    : "compressed";
              return (
                <li key={s.id} style={cellStyle}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: 4,
                    }}
                  >
                    <strong>{s.id}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 11 }}>
                      {tag}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>rest</span>
                    <button
                      type="button"
                      style={stepperBtn}
                      onClick={() => onSpringRestStep(s.id, -0.5)}
                    >
                      −
                    </button>
                    <span
                      style={{
                        minWidth: 36,
                        textAlign: "center",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {s.restLength.toFixed(1)}
                    </span>
                    <button
                      type="button"
                      style={stepperBtn}
                      onClick={() => onSpringRestStep(s.id, +0.5)}
                    >
                      +
                    </button>
                    <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                      now {currentLen.toFixed(1)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12,
                      marginTop: 4,
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>stiff</span>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={s.stiffness ?? 0.8}
                      onChange={(e) =>
                        onSpringStiffness(s.id, parseFloat(e.target.value))
                      }
                      style={{ flex: 1, minWidth: 0 }}
                    />
                    <span
                      style={{
                        minWidth: 26,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {(s.stiffness ?? 0.8).toFixed(1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {bisectorCount > 0 && (
        <section>
          <H3>Bisector guides</H3>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <span style={{ color: "var(--muted)" }}>
              {bisectorCount} {bisectorCount === 1 ? "guide" : "guides"}
            </span>
            <button type="button" onClick={onClearBisectors} style={btn}>
              Clear all
            </button>
          </div>
        </section>
      )}

      <section>
        <H3>Save as gate</H3>
        <div style={{ display: "flex", gap: 6 }}>
          <input
            type="text"
            placeholder="Gate name"
            value={gateName}
            onChange={(e) => setGateName(e.target.value)}
            style={{
              flex: 1,
              padding: "4px 8px",
              fontSize: 13,
              borderRadius: 4,
              border: "1px solid var(--rule)",
              background: "var(--bg)",
              color: "var(--ink)",
              minWidth: 0,
            }}
          />
          <button type="button" onClick={onSave} style={btn}>
            Save
          </button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={onExport}
            style={{ ...btn, flex: 1 }}
          >
            Export JSON
          </button>
          <button
            type="button"
            onClick={onImport}
            style={{ ...btn, flex: 1 }}
          >
            Import JSON
          </button>
        </div>
      </section>

      <section>
        <H3>Library</H3>
        {library.length === 0 ? (
          <P>No saved gates yet.</P>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {library.map((g) => (
              <li key={g.name} style={cellStyle}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <strong>{g.name}</strong>
                  <button
                    type="button"
                    onClick={() => onRemove(g.name)}
                    style={{
                      padding: "0 4px",
                      fontSize: 14,
                      lineHeight: 1,
                      border: "none",
                      background: "none",
                      color: "var(--muted)",
                      cursor: "pointer",
                    }}
                    aria-label={`Remove ${g.name}`}
                  >
                    ×
                  </button>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => onInsert(g)}
                    style={{ ...btn, flex: 1 }}
                  >
                    Insert
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoad(g)}
                    style={{ ...btn, flex: 1 }}
                  >
                    Open
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 12,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </h3>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>{children}</p>
  );
}

// =====================================================================
//  Grid background
// =====================================================================

function GridBg({ cols, rows }: { cols: number; rows: number }) {
  const W = cols * GRID;
  const H = rows * GRID;
  const lines = [];
  // Sub-grid at half-units (lighter).
  for (let x = 0; x <= cols * 2; x++) {
    if (x % 2 === 0) continue;
    const px = (x * GRID) / 2;
    lines.push(
      <line
        key={`sv${x}`}
        x1={px}
        y1={0}
        x2={px}
        y2={H}
        stroke="var(--ink)"
        strokeWidth={0.4}
        opacity={0.08}
      />,
    );
  }
  for (let y = 0; y <= rows * 2; y++) {
    if (y % 2 === 0) continue;
    const py = (y * GRID) / 2;
    lines.push(
      <line
        key={`sh${y}`}
        x1={0}
        y1={py}
        x2={W}
        y2={py}
        stroke="var(--ink)"
        strokeWidth={0.4}
        opacity={0.08}
      />,
    );
  }
  // Primary integer-unit grid (darker).
  for (let x = 0; x <= cols; x++) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x * GRID}
        y1={0}
        x2={x * GRID}
        y2={H}
        stroke="var(--ink)"
        strokeWidth={x % 4 === 0 ? 1.0 : 0.5}
        opacity={x % 4 === 0 ? 0.35 : 0.18}
      />,
    );
  }
  for (let y = 0; y <= rows; y++) {
    lines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y * GRID}
        x2={W}
        y2={y * GRID}
        stroke="var(--ink)"
        strokeWidth={y % 4 === 0 ? 1.0 : 0.5}
        opacity={y % 4 === 0 ? 0.35 : 0.18}
      />,
    );
  }
  // Grid lines should never catch pointer events — they'd block
  // rubber-band selection and empty-space clicks.
  return (
    <g aria-hidden="true" pointerEvents="none">
      {lines}
    </g>
  );
}

// =====================================================================
//  Body views
// =====================================================================

function BodyView({
  body,
  circuit,
  selected,
  dimmed,
  tool,
  onBodyClick,
  onBodyMouseDown,
  onInputKnob,
  onOutputToggle,
}: {
  body: Body;
  circuit: Circuit;
  selected: boolean;
  dimmed: boolean;
  tool: Tool;
  onBodyClick: (e: React.MouseEvent, id: BodyId) => void;
  onBodyMouseDown: (e: React.MouseEvent, id: BodyId) => void;
  onInputKnob: (e: React.MouseEvent, id: BodyId) => void;
  onOutputToggle: (e: React.MouseEvent, id: BodyId) => void;
}) {
  const opacity = dimmed && body.kind !== "input" && body.kind !== "output"
    ? 0.1
    : 1;
  switch (body.kind) {
    case "sleeve":
      return (
        <RodView
          body={body as RodBody}
          variant="sleeve"
          selected={selected}
          opacity={opacity}
          tool={tool}
          onBodyClick={onBodyClick}
          onBodyMouseDown={onBodyMouseDown}
        />
      );
    case "input":
      return (
        <RodView
          body={body as RodBody}
          variant="input"
          selected={selected}
          opacity={opacity}
          tool={tool}
          onBodyClick={onBodyClick}
          onBodyMouseDown={onBodyMouseDown}
          onInputKnob={onInputKnob}
        />
      );
    case "output":
      return (
        <RodView
          body={body as RodBody}
          variant="output"
          selected={selected}
          opacity={opacity}
          tool={tool}
          onBodyClick={onBodyClick}
          onBodyMouseDown={onBodyMouseDown}
          onOutputToggle={onOutputToggle}
        />
      );
    case "connector":
      return (
        <ConnectorView
          body={body as ConnectorBody}
          selected={selected}
          opacity={opacity}
          tool={tool}
          onBodyClick={onBodyClick}
          onBodyMouseDown={onBodyMouseDown}
        />
      );
    case "spring":
      return (
        <SpringView
          body={body as SpringBody}
          circuit={circuit}
          selected={selected}
          opacity={opacity}
          onBodyClick={onBodyClick}
        />
      );
  }
}

function RodView({
  body,
  variant,
  selected,
  opacity,
  tool,
  onBodyClick,
  onBodyMouseDown,
  onInputKnob,
  onOutputToggle,
}: {
  body: RodBody;
  variant: "sleeve" | "input" | "output";
  selected: boolean;
  opacity: number;
  tool: Tool;
  onBodyClick: (e: React.MouseEvent, id: BodyId) => void;
  onBodyMouseDown: (e: React.MouseEvent, id: BodyId) => void;
  onInputKnob?: (e: React.MouseEvent, id: BodyId) => void;
  onOutputToggle?: (e: React.MouseEvent, id: BodyId) => void;
}) {
  // Rod endpoints in world.
  const endA = bodyToWorld(body, rodEndLocal(body, "a"));
  const endB = bodyToWorld(body, rodEndLocal(body, "b"));
  const svgA = worldToSvg(endA);
  const svgB = worldToSvg(endB);
  // Sleeve body sits at the body's rest pose, oriented along the axis.
  const sleeveCenter = worldToSvg({ x: body.restX, y: body.restY });
  const sleeveLong = GRID * 1.0;
  const sleeveThick = GRID * 0.5;
  // Always draw the sleeve as a horizontal rectangle and rotate the
  // whole thing by the axis angle so arbitrary-angle rods work.
  const sleeveRect = {
    x: sleeveCenter.x - sleeveLong / 2,
    y: sleeveCenter.y - sleeveThick / 2,
    w: sleeveLong,
    h: sleeveThick,
  };
  const sleeveRotate = `rotate(${body.axis} ${sleeveCenter.x} ${sleeveCenter.y})`;

  // For input: knob is drawn at end B (user-facing side).
  const knob = worldToSvg(endB);
  const bit = variant === "input" ? (body.target === 1 ? 1 : 0) : 0;

  return (
    <g
      style={{ cursor: tool === "drag" ? "grab" : "pointer", opacity }}
      onMouseDown={(e) => onBodyMouseDown(e, body.id)}
    >
      {/* Rod */}
      <line
        x1={svgA.x}
        y1={svgA.y}
        x2={svgB.x}
        y2={svgB.y}
        stroke="var(--ink)"
        strokeWidth={5}
        strokeLinecap="round"
        onClick={(e) => onBodyClick(e, body.id)}
      />
      {/* Sleeve body */}
      <rect
        x={sleeveRect.x}
        y={sleeveRect.y}
        width={sleeveRect.w}
        height={sleeveRect.h}
        fill="var(--muted)"
        fillOpacity={0.35}
        stroke={selected ? "var(--accent)" : "var(--ink)"}
        strokeWidth={selected ? 2 : 1.2}
        rx={3}
        transform={sleeveRotate}
        onClick={(e) => onBodyClick(e, body.id)}
      />
      {/* Input knob — omitted for passive inputs (they are internal
          mechanical nodes, driven by constraints, not user clicks). */}
      {variant === "input" && !body.passive && (
        <g
          onClick={(e) => onInputKnob?.(e, body.id)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <circle
            cx={knob.x}
            cy={knob.y}
            r={11}
            fill={bit === 1 ? "var(--accent)" : "var(--surface)"}
            stroke="var(--ink)"
            strokeWidth={1.8}
          />
          <text
            x={knob.x}
            y={knob.y + 4}
            fontSize={11}
            textAnchor="middle"
            fill={bit === 1 ? "var(--bg)" : "var(--ink)"}
            style={{ pointerEvents: "none", fontWeight: 600 }}
          >
            {bit}
          </text>
        </g>
      )}
      {/* Output read-out — clickable (in Select mode) to toggle
          initial state before wiring. */}
      {variant === "output" && (
        <g
          onClick={(e) => onOutputToggle?.(e, body.id)}
          onMouseDown={(e) => e.stopPropagation()}
          style={{ cursor: "pointer" }}
        >
          <circle
            cx={worldToSvg(endA).x}
            cy={worldToSvg(endA).y}
            r={11}
            fill={outputBit(body) === 1 ? "var(--accent)" : "var(--surface)"}
            stroke="var(--ink)"
            strokeWidth={1.8}
            strokeDasharray="3 3"
          />
          <text
            x={worldToSvg(endA).x}
            y={worldToSvg(endA).y + 4}
            fontSize={11}
            textAnchor="middle"
            fill={outputBit(body) === 1 ? "var(--bg)" : "var(--ink)"}
            style={{ pointerEvents: "none", fontWeight: 600 }}
          >
            {outputBit(body)}
          </text>
        </g>
      )}
      {/* Label — always above the sleeve centre. */}
      {body.label && (
        <text
          x={sleeveCenter.x}
          y={sleeveCenter.y - 20}
          fontSize={11}
          textAnchor="middle"
          fill="var(--muted)"
          style={{ pointerEvents: "none" }}
        >
          {body.label}
        </text>
      )}
    </g>
  );
}

function ConnectorView({
  body,
  selected,
  opacity,
  tool,
  onBodyClick,
  onBodyMouseDown,
}: {
  body: ConnectorBody;
  selected: boolean;
  opacity: number;
  tool: Tool;
  onBodyClick: (e: React.MouseEvent, id: BodyId) => void;
  onBodyMouseDown: (e: React.MouseEvent, id: BodyId) => void;
}) {
  const endA = bodyToWorld(body, { lx: -body.length / 2, ly: 0 });
  const endB = bodyToWorld(body, { lx: +body.length / 2, ly: 0 });
  const a = worldToSvg(endA);
  const b = worldToSvg(endB);
  return (
    <g
      style={{ cursor: tool === "drag" ? "grab" : "pointer", opacity }}
      onMouseDown={(e) => onBodyMouseDown(e, body.id)}
      onClick={(e) => onBodyClick(e, body.id)}
    >
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={selected ? "var(--accent)" : "var(--ink)"}
        strokeWidth={6}
        strokeLinecap="round"
      />
    </g>
  );
}

function SpringView({
  body,
  circuit,
  selected,
  opacity,
  onBodyClick,
}: {
  body: SpringBody;
  circuit: Circuit;
  selected: boolean;
  opacity: number;
  onBodyClick: (e: React.MouseEvent, id: BodyId) => void;
}) {
  if (!body.jointA || !body.jointB) return null;
  const jA = findJoint(circuit, body.jointA);
  const jB = findJoint(circuit, body.jointB);
  if (!jA || !jB) return null;
  const wa = jointWorld(circuit, jA);
  const wb = jointWorld(circuit, jB);
  const a = worldToSvg(wa);
  const b = worldToSvg(wb);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const n = body.coils;
  // Current length in world units vs. rest length.
  const worldLen = Math.hypot(wb.x - wa.x, wb.y - wa.y) || 1;
  const rest = Math.max(0.25, body.restLength);
  const ratio = rest / worldLen; // >1 → compressed (spring wants to extend); <1 → stretched
  // Amplitude scales with √(rest / current). Clamp so the zigzag
  // doesn't go huge or vanish.
  const BASE_AMP = 7;
  const amp = Math.max(2, Math.min(14, BASE_AMP * Math.sqrt(ratio)));
  const pts: string[] = [`${a.x},${a.y}`];
  // Leave a tiny straight lead at each end so the zigzag starts a
  // short distance in from the joint.
  const lead = 0.08;
  for (let i = 1; i <= n; i++) {
    const t = lead + ((1 - 2 * lead) * i) / (n + 1);
    const side = i % 2 === 0 ? 1 : -1;
    const px = a.x + dx * t + nx * amp * side;
    const py = a.y + dy * t + ny * amp * side;
    pts.push(`${px},${py}`);
  }
  pts.push(`${b.x},${b.y}`);
  // Tint: neutral when near rest, warm when compressed, cool when
  // stretched, relative to the rest length.
  const stretch = worldLen / rest;
  const tone =
    Math.abs(stretch - 1) < 0.03
      ? "var(--muted)"
      : stretch > 1
        ? "#4a6aa8"
        : "#c77a3a";
  return (
    <g style={{ opacity }}>
      {/* Thick transparent hit stroke — lets the user click the
          spring easily (and, in Delete mode, remove it). */}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        onClick={(e) => onBodyClick(e, body.id)}
      />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={selected ? "var(--accent)" : tone}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        pointerEvents="none"
      />
    </g>
  );
}

// =====================================================================
//  Joint view
// =====================================================================

function JointView({
  joint,
  circuit,
  hidden,
  tool,
  selected,
  onJointClick,
  onJointMouseDown,
}: {
  joint: Joint;
  circuit: Circuit;
  hidden: boolean;
  tool: Tool;
  selected: boolean;
  onJointClick: (e: React.MouseEvent, jid: JointId) => void;
  onJointMouseDown: (e: React.MouseEvent, jid: JointId) => void;
}) {
  if (hidden) return null;
  const w = jointWorld(circuit, joint);
  const p = worldToSvg(w);
  const hasFrame = joint.incidents.some((i) => i.kind === "frame");
  const bigHint =
    tool === "connector" ||
    tool === "anchor" ||
    tool === "revolute" ||
    tool === "bisector" ||
    tool === "delete";
  const r = bigHint ? 8 : 5;
  // In Delete mode, broaden the hit area beyond the visible disc so
  // the user doesn't need to pixel-hunt for the joint even when it
  // sits on top of a rod.
  const hitR = tool === "delete" ? 12 : r;
  return (
    <g
      onClick={(e) => onJointClick(e, joint.id)}
      onMouseDown={(e) => onJointMouseDown(e, joint.id)}
      style={{ cursor: "pointer" }}
    >
      {/* Invisible hit circle — always drawn, larger, so the joint
          is easy to click even when it overlaps a rod. */}
      <circle
        cx={p.x}
        cy={p.y}
        r={hitR}
        fill="transparent"
        stroke="none"
      />
      <circle
        cx={p.x}
        cy={p.y}
        r={r}
        fill={
          selected
            ? "var(--accent)"
            : tool === "delete"
              ? "#c0392b"
              : hasFrame
                ? "var(--ink)"
                : "var(--surface)"
        }
        stroke="var(--ink)"
        strokeWidth={1.6}
        pointerEvents="none"
      />
      {hasFrame && (
        // Small triangle "ground" tick below the joint.
        <polygon
          points={`${p.x - 6},${p.y + 10} ${p.x + 6},${p.y + 10} ${p.x},${p.y + 3}`}
          fill="var(--ink)"
          opacity={0.75}
          pointerEvents="none"
        />
      )}
    </g>
  );
}

// =====================================================================
//  Contact marker
// =====================================================================

function ContactView({
  contact,
  circuit,
  tool,
  onClick,
}: {
  contact: Contact;
  circuit: Circuit;
  tool: Tool;
  onClick: () => void;
}) {
  const pusher = findBody(circuit, contact.pusher.bodyId);
  const target = findBody(circuit, contact.target.bodyId);
  if (!pusher || !target) return null;
  if (pusher.kind === "spring" || target.kind === "spring") return null;
  const pPos = bodyToWorld(pusher, {
    lx: contact.pusher.lx,
    ly: contact.pusher.ly,
  });
  const tPos = bodyToWorld(target, {
    lx: contact.target.lx,
    ly: contact.target.ly,
  });
  // Whether the contact is currently active. Matches the solver's
  // threshold: strictly penetrating (gap < 0) — resting contact is
  // visually "not engaged", so the target is known to be free.
  const gap =
    (tPos.x - pPos.x) * contact.dirX + (tPos.y - pPos.y) * contact.dirY;
  const active = gap < -1e-4;
  // Anchor the marker at the pusher's world position, so it sticks to
  // the input rod's tip and moves with it — no flailing midpoint.
  const anchor = worldToSvg(pPos);
  const ang = Math.atan2(contact.dirY, contact.dirX);
  const degrees = (ang * 180) / Math.PI;
  const color = active ? "#c0392b" : "var(--muted)";
  const hitColor = tool === "delete" ? "#c0392b" : "transparent";
  return (
    <g
      transform={`rotate(${degrees} ${anchor.x} ${anchor.y})`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{ cursor: tool === "delete" ? "pointer" : "default" }}
    >
      {/* Hit area */}
      <rect
        x={anchor.x - 14}
        y={anchor.y - 8}
        width={28}
        height={16}
        fill={hitColor}
        fillOpacity={tool === "delete" ? 0.12 : 0}
        stroke="none"
      />
      {/* Wedge pointing in +dir, tip sitting at the pusher world
          point. */}
      <polygon
        points={`${anchor.x - 9},${anchor.y - 5} ${anchor.x + 2},${anchor.y} ${anchor.x - 9},${anchor.y + 5}`}
        fill={color}
        stroke="var(--ink)"
        strokeWidth={0.8}
        pointerEvents="none"
      />
    </g>
  );
}

// =====================================================================
//  Perpendicular-bisector guide
// =====================================================================

function BisectorLine({ a, b }: { a: Vec2; b: Vec2 }) {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Perpendicular direction: rotate (b - a) by 90°.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const px = -dy / len;
  const py = dx / len;
  // Extend far enough that the visible line spans the canvas at any
  // reasonable canvas size.
  const T = Math.hypot(MAX_COLS, MAX_ROWS) + 4;
  const p1 = { x: mid.x + px * T, y: mid.y + py * T };
  const p2 = { x: mid.x - px * T, y: mid.y - py * T };
  const q1 = worldToSvg(p1);
  const q2 = worldToSvg(p2);
  const qMid = worldToSvg(mid);
  const qA = worldToSvg(a);
  const qB = worldToSvg(b);
  return (
    <g pointerEvents="none">
      <line
        x1={q1.x}
        y1={q1.y}
        x2={q2.x}
        y2={q2.y}
        stroke="var(--accent)"
        strokeWidth={1}
        strokeOpacity={0.55}
        strokeDasharray="6 4"
      />
      {/* Small markers at the two original points and the midpoint. */}
      <line
        x1={qA.x}
        y1={qA.y}
        x2={qB.x}
        y2={qB.y}
        stroke="var(--accent)"
        strokeWidth={0.8}
        strokeOpacity={0.35}
        strokeDasharray="2 3"
      />
      <circle
        cx={qMid.x}
        cy={qMid.y}
        r={2.5}
        fill="var(--accent)"
        fillOpacity={0.8}
      />
    </g>
  );
}

// =====================================================================
//  Ghost preview
// =====================================================================

function GhostPreview({
  tool,
  at,
  angle,
}: {
  tool: Tool;
  at: Vec2;
  angle: Orient;
}) {
  const c = worldToSvg(at);
  const len = GRID * DEFAULTS.rodLen;
  const thick = GRID * 0.5;
  if (tool === "sleeve" || tool === "input" || tool === "output") {
    const rect =
      angle === 0
        ? { x: c.x - len / 2, y: c.y - thick / 2, w: len, h: thick }
        : { x: c.x - thick / 2, y: c.y - len / 2, w: thick, h: len };
    return (
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.w}
        height={rect.h}
        fill="var(--accent)"
        fillOpacity={0.2}
        stroke="var(--accent)"
        strokeDasharray="3 3"
        pointerEvents="none"
      />
    );
  }
  if (tool === "revolute") {
    return (
      <circle
        cx={c.x}
        cy={c.y}
        r={7}
        fill="none"
        stroke="var(--accent)"
        strokeDasharray="3 2"
        pointerEvents="none"
      />
    );
  }
  if (tool === "spring") {
    return (
      <circle
        cx={c.x}
        cy={c.y}
        r={6}
        fill="none"
        stroke="var(--accent)"
        strokeDasharray="3 2"
        pointerEvents="none"
      />
    );
  }
  return null;
}
