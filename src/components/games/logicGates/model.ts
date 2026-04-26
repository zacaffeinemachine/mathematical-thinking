// Data model for the mechanical logic-gate sandbox (2D-linkage edition).
//
// Every movable piece in the world is a rigid body with 3 degrees of
// freedom (x, y, θ). The "frame" — the immovable workbench the sleeves
// are bolted to — is implicit, at pose (0, 0, 0).
//
// Rod-like bodies (sleeves, inputs, outputs) are additionally
// constrained by a *prismatic* joint against the frame, pinning their
// rotation to the sleeve axis and their perpendicular motion to zero;
// this leaves them with one effective DOF, the axial displacement `s`.
//
// Free 2-D bodies (connectors) have all three DOFs unconstrained
// except by whatever revolute joints they participate in.
//
// A revolute joint is a point in the world that multiple bodies
// (and optionally the frame) must agree on. Each "incidence" stores
// the joint's local coordinates on the body it sits on, so the joint
// rides with the body as the body moves. When a joint has two or more
// incidences we get 2(k-1) constraint equations: the world position of
// every non-master incidence must equal the master's world position.
//
// The solver (solver.ts) handles the rest.

// ---------------------------------------------------------------------
// Basic types
// ---------------------------------------------------------------------

export type Vec2 = { x: number; y: number };

// Rod-like bodies snap to horizontal or vertical for pedagogical clarity.
export type Orient = 0 | 90;

// ---------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------

export type BodyId = string;

export type BodyKind = "sleeve" | "input" | "output" | "connector" | "spring";

interface BodyBase {
  id: BodyId;
  kind: BodyKind;
  // Current world pose (mutated by the solver every frame).
  x: number;
  y: number;
  theta: number; // radians
  // Rest pose: where the body sits when the whole mechanism is at its
  // neutral (all DOFs = 0) configuration. Updated when the user drags
  // a body or a joint that rides on one.
  restX: number;
  restY: number;
  restTheta: number;
}

// Sleeve / Input / Output — a rod that slides along one axis.
// `axis` is the axis-angle in degrees; 0 and 90 are the common
// snap-to-grid cases, but arbitrary angles are supported (e.g. when
// a rod is placed between two click-points).
export interface RodBody extends BodyBase {
  kind: "sleeve" | "input" | "output";
  axis: number;
  rodLen: number; // visual length of the rod, grid units
  s: number; // axial displacement from rest
  label?: string;
  target?: -1 | 1; // only inputs
  // Inputs only. When true, this input is an internal mechanical node:
  // it has 1 free DOF (like a sleeve) and is no longer user-clickable.
  // Used to chain gates (e.g., put a NOT in front of an OR's input pin).
  passive?: boolean;
}

// A free 2-D rigid rod connecting two revolute joints. At rest, its
// local frame is oriented so that its two endpoint anchors lie at
// (-length/2, 0) and (+length/2, 0).
export interface ConnectorBody extends BodyBase {
  kind: "connector";
  length: number; // distance between its two endpoint joints
}

// Spring: a zigzag between two revolute joints. Contributes a soft
// equality constraint (|P_B − P_A| = restLength) to the solver with
// weight `stiffness`. Rigid constraints (joints, connectors) stay
// hard; the spring only asserts itself over otherwise-free DOFs.
// `stiffness = 0` makes the spring purely decorative; higher values
// let it dominate over other springs and the regulariser, and
// eventually even push back against soft connector DOFs.
export interface SpringBody extends BodyBase {
  kind: "spring";
  jointA: JointId | null;
  jointB: JointId | null;
  restLength: number;
  coils: number;
  stiffness: number;
}

export type Body = RodBody | ConnectorBody | SpringBody;

// ---------------------------------------------------------------------
// Revolute joints
// ---------------------------------------------------------------------

export type JointId = string;

// A joint incidence records: on which body (or the frame), and at
// which local-to-body coordinates the joint sits.
//   - kind === "frame":  (lx, ly) are absolute world coordinates.
//   - kind === "body":   (lx, ly) are local coords on bodyId.
export interface JointIncidence {
  kind: "frame" | "body";
  bodyId: BodyId | null;
  lx: number;
  ly: number;
}

export interface Joint {
  id: JointId;
  incidents: JointIncidence[];
}

// ---------------------------------------------------------------------
// Unilateral contacts
// ---------------------------------------------------------------------

// A Contact is a one-way constraint: the `pusher` point on one body
// can push the `target` point on another body along `dir` (a unit
// vector in world frame), but cannot pull it back.
//
// Representation:
//   gap = (target.world − pusher.world) · dir
//     gap > 0 : pusher is behind target along dir  → no constraint
//     gap ≤ 0 : pusher has reached or passed target → constraint
//                active, enforced as (gap = 0).
//
// The solver activates contacts whose current gap is negative and
// linearises `gap = 0` as an additional equation each Newton step.
export interface Contact {
  id: string;
  pusher: { bodyId: BodyId; lx: number; ly: number };
  target: { bodyId: BodyId; lx: number; ly: number };
  dirX: number;
  dirY: number;
}

// ---------------------------------------------------------------------
// Groups and scaffolds
// ---------------------------------------------------------------------

// A group is simply a named bundle of bodies (and the joints that live
// entirely inside it). Dragging a group translates every member in
// lockstep; saving a group produces a self-contained subcircuit.
export interface Group {
  id: string;
  name: string;
  bodyIds: BodyId[];
  jointIds: JointId[];
  scaffolded: boolean;
}

// ---------------------------------------------------------------------
// Circuit
// ---------------------------------------------------------------------

export interface Circuit {
  bodies: Body[];
  joints: Joint[];
  groups: Group[];
  contacts: Contact[];
  nextId: number;
}

export function emptyCircuit(): Circuit {
  return { bodies: [], joints: [], groups: [], contacts: [], nextId: 1 };
}

export function freshId(c: Circuit, prefix: string): string {
  const id = `${prefix}${c.nextId}`;
  c.nextId += 1;
  return id;
}

// ---------------------------------------------------------------------
// Pose transforms
// ---------------------------------------------------------------------

// Convert a body-local point to world coordinates given the body's pose.
export function bodyToWorld(
  pose: { x: number; y: number; theta: number },
  local: { lx: number; ly: number },
): Vec2 {
  const c = Math.cos(pose.theta);
  const s = Math.sin(pose.theta);
  return {
    x: pose.x + local.lx * c - local.ly * s,
    y: pose.y + local.lx * s + local.ly * c,
  };
}

// Inverse of the above.
export function worldToBody(
  pose: { x: number; y: number; theta: number },
  world: Vec2,
): { lx: number; ly: number } {
  const dx = world.x - pose.x;
  const dy = world.y - pose.y;
  const c = Math.cos(pose.theta);
  const s = Math.sin(pose.theta);
  return {
    lx: dx * c + dy * s,
    ly: -dx * s + dy * c,
  };
}

// The world-space position of an incidence given current body poses.
export function incidenceWorld(c: Circuit, inc: JointIncidence): Vec2 {
  if (inc.kind === "frame" || inc.bodyId == null) {
    return { x: inc.lx, y: inc.ly };
  }
  const body = findBody(c, inc.bodyId);
  if (!body) return { x: inc.lx, y: inc.ly };
  return bodyToWorld(body, { lx: inc.lx, ly: inc.ly });
}

// ---------------------------------------------------------------------
// Look-ups
// ---------------------------------------------------------------------

export function findBody(c: Circuit, id: BodyId): Body | undefined {
  return c.bodies.find((b) => b.id === id);
}

export function findJoint(c: Circuit, id: JointId): Joint | undefined {
  return c.joints.find((j) => j.id === id);
}

// ---------------------------------------------------------------------
// Rod helpers
// ---------------------------------------------------------------------

// Initialise a rod body with its pose set from a neutral grid placement.
export function makeRod(
  kind: "sleeve" | "input" | "output",
  id: BodyId,
  center: Vec2,
  axisDeg: number,
  rodLen: number,
  extras: Partial<RodBody> = {},
): RodBody {
  const theta = (axisDeg * Math.PI) / 180;
  return {
    id,
    kind,
    axis: axisDeg,
    rodLen,
    s: 0,
    x: center.x,
    y: center.y,
    theta,
    restX: center.x,
    restY: center.y,
    restTheta: theta,
    ...extras,
  };
}

export function rodEndLocal(body: RodBody, end: "a" | "b"): {
  lx: number;
  ly: number;
} {
  const sign = end === "a" ? 1 : -1;
  return { lx: sign * (body.rodLen / 2), ly: 0 };
}

// Axial-unit vector for a rod, as (cos θ, sin θ).
export function rodAxisUnit(body: RodBody): Vec2 {
  return { x: Math.cos(body.theta), y: Math.sin(body.theta) };
}

// ---------------------------------------------------------------------
// Output bit convention
// ---------------------------------------------------------------------

export function outputBit(b: RodBody): 0 | 1 {
  return b.s > 0 ? 1 : 0;
}

// ---------------------------------------------------------------------
// Geometry helpers for UI (joint merging, click-testing)
// ---------------------------------------------------------------------

// Find a joint whose world position is within `tol` grid units of p,
// given the current circuit pose. Used for joint-merging on placement.
export function findJointNear(
  c: Circuit,
  p: Vec2,
  tol: number,
): Joint | undefined {
  for (const j of c.joints) {
    const inc = j.incidents[0];
    if (!inc) continue;
    const w = incidenceWorld(c, inc);
    const dx = w.x - p.x;
    const dy = w.y - p.y;
    if (dx * dx + dy * dy <= tol * tol) return j;
  }
  return undefined;
}

// The "primary" world position of a joint: the position of its first
// incidence (used for drawing).
export function jointWorld(c: Circuit, j: Joint): Vec2 {
  if (j.incidents.length === 0) return { x: 0, y: 0 };
  return incidenceWorld(c, j.incidents[0]);
}
