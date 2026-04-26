// 2-D constraint solver for the logic-gate sandbox.
//
// State vector q lays out the free DOFs of all bodies:
//   • Rod body (sleeve / output) → 1 DOF:  s
//   • Input body               → 0 DOFs (driven; s is prescribed)
//   • Connector body           → 3 DOFs:  dx, dy, dθ  (offsets from rest)
//   • Spring                   → 0 DOFs  (decorative)
//
// Residuals f(q) come from revolute joints. A joint with k incidences
// contributes 2(k-1) equations: the world position of each non-master
// incidence must equal the master's. The solver linearises around the
// current pose, assembles J and f, and solves (JᵀJ + λI) δ = -Jᵀ f,
// iterating a few Newton steps until convergence.

import type {
  Circuit,
  Body,
  BodyId,
  ConnectorBody,
  RodBody,
  JointIncidence,
  Contact,
  SpringBody,
} from "./model";
import { bodyToWorld } from "./model";

// Constraint weights for the least-squares objective. Joints and
// active contacts are treated as effectively hard — weighting them
// 10× above any spring stiffness means the solver will pay ~100×
// more to violate a joint than to leave a spring a bit off-rest, so
// springs can never perturb the rigid structure.
const JOINT_WEIGHT = 10;
const CONTACT_WEIGHT = 10;

// Default spring weight (used only for legacy springs whose
// stiffness field is missing).
const SPRING_WEIGHT = 0.3;

// ---------------------------------------------------------------------
// DOF indexing
// ---------------------------------------------------------------------

interface DofLayout {
  // For each body, the starting index in q (or -1 if the body has no
  // free DOFs, e.g. input or spring).
  start: Map<BodyId, number>;
  // Total free DOFs.
  n: number;
}

function layoutDofs(c: Circuit, pinned?: Set<BodyId>): DofLayout {
  const start = new Map<BodyId, number>();
  let n = 0;
  for (const b of c.bodies) {
    // Pinned bodies have zero free DOFs — their current pose is
    // treated as kinematically driven.  Used while the user drags a
    // body, so that dragging propagates rigidly through any joints.
    if (pinned?.has(b.id)) {
      start.set(b.id, -1);
      continue;
    }
    if (b.kind === "sleeve" || b.kind === "output") {
      start.set(b.id, n);
      n += 1;
    } else if (b.kind === "input") {
      // Passive inputs are internal mechanical nodes with 1 DOF (like
      // a sleeve). Active (user-driven) inputs have 0 DOFs.
      if ((b as RodBody).passive) {
        start.set(b.id, n);
        n += 1;
      } else {
        start.set(b.id, -1);
      }
    } else if (b.kind === "connector") {
      start.set(b.id, n);
      n += 3;
    } else {
      start.set(b.id, -1); // spring
    }
  }
  return { start, n };
}

// ---------------------------------------------------------------------
// World position of a joint incidence + its Jacobian row contribution
// ---------------------------------------------------------------------

// For an incidence, return:
//   pos  — its world position right now
//   jac  — contribution to two rows of J: [[∂x/∂q, …], [∂y/∂q, …]] for
//          the free DOFs of the incidence's body. Returned as (dofCount
//          count) × 2 flattened entries: dxs[i], dys[i].
function incidencePose(
  c: Circuit,
  inc: JointIncidence,
  layout: DofLayout,
  bodyIdx: Map<BodyId, Body>,
): {
  pos: { x: number; y: number };
  jacStart: number; // -1 means frame (no DOFs)
  jacCount: 0 | 1 | 3;
  jac: { dx: number[]; dy: number[] }; // length jacCount each
} {
  if (inc.kind === "frame" || inc.bodyId == null) {
    return {
      pos: { x: inc.lx, y: inc.ly },
      jacStart: -1,
      jacCount: 0,
      jac: { dx: [], dy: [] },
    };
  }
  const body = bodyIdx.get(inc.bodyId);
  if (!body) {
    return {
      pos: { x: 0, y: 0 },
      jacStart: -1,
      jacCount: 0,
      jac: { dx: [], dy: [] },
    };
  }
  if (body.kind === "spring") {
    return {
      pos: { x: body.x, y: body.y },
      jacStart: -1,
      jacCount: 0,
      jac: { dx: [], dy: [] },
    };
  }
  const cTh = Math.cos(body.theta);
  const sTh = Math.sin(body.theta);
  const wx = body.x + inc.lx * cTh - inc.ly * sTh;
  const wy = body.y + inc.lx * sTh + inc.ly * cTh;

  if (body.kind === "input" && !(body as RodBody).passive) {
    // Active input has 0 free DOFs (user-driven). Its pose depends on
    // s, but s is fixed during the solve. Treat as constant.
    return {
      pos: { x: wx, y: wy },
      jacStart: -1,
      jacCount: 0,
      jac: { dx: [], dy: [] },
    };
  }

  const start = layout.start.get(body.id);
  if (start == null || start < 0) {
    return {
      pos: { x: wx, y: wy },
      jacStart: -1,
      jacCount: 0,
      jac: { dx: [], dy: [] },
    };
  }

  if (body.kind === "sleeve" || body.kind === "output" || body.kind === "input") {
    // 1 DOF: ∂pos/∂s = (cosθ, sinθ) since (x, y) = (restX + s cosθ,
    // restY + s sinθ) and θ is fixed at restTheta.
    return {
      pos: { x: wx, y: wy },
      jacStart: start,
      jacCount: 1,
      jac: {
        dx: [cTh],
        dy: [sTh],
      },
    };
  }

  // Connector: 3 DOFs (dx, dy, dθ) around (restX, restY, restTheta).
  // Partials:
  //   ∂/∂dx (wx, wy) = (1, 0)
  //   ∂/∂dy (wx, wy) = (0, 1)
  //   ∂/∂dθ (wx, wy) = (-lx sinθ - ly cosθ,  lx cosθ - ly sinθ)
  const dxTheta = -inc.lx * sTh - inc.ly * cTh;
  const dyTheta = inc.lx * cTh - inc.ly * sTh;
  return {
    pos: { x: wx, y: wy },
    jacStart: start,
    jacCount: 3,
    jac: {
      dx: [1, 0, dxTheta],
      dy: [0, 1, dyTheta],
    },
  };
}

// ---------------------------------------------------------------------
// Assemble residual and Jacobian
// ---------------------------------------------------------------------

function assemble(
  c: Circuit,
  layout: DofLayout,
  activeContacts: Contact[],
): { f: number[]; J: number[][] } {
  const bodyIdx = new Map<BodyId, Body>();
  for (const b of c.bodies) bodyIdx.set(b.id, b);

  const rows: number[][] = [];
  const res: number[] = [];

  for (const joint of c.joints) {
    if (joint.incidents.length < 2) continue;
    const master = incidencePose(c, joint.incidents[0], layout, bodyIdx);
    for (let i = 1; i < joint.incidents.length; i++) {
      const other = incidencePose(c, joint.incidents[i], layout, bodyIdx);
      const rx = other.pos.x - master.pos.x;
      const ry = other.pos.y - master.pos.y;
      const rowX = new Array<number>(layout.n).fill(0);
      const rowY = new Array<number>(layout.n).fill(0);
      for (let k = 0; k < other.jacCount; k++) {
        rowX[other.jacStart + k] += JOINT_WEIGHT * other.jac.dx[k];
        rowY[other.jacStart + k] += JOINT_WEIGHT * other.jac.dy[k];
      }
      for (let k = 0; k < master.jacCount; k++) {
        rowX[master.jacStart + k] -= JOINT_WEIGHT * master.jac.dx[k];
        rowY[master.jacStart + k] -= JOINT_WEIGHT * master.jac.dy[k];
      }
      rows.push(rowX);
      rows.push(rowY);
      res.push(JOINT_WEIGHT * rx);
      res.push(JOINT_WEIGHT * ry);
    }
  }

  // Active unilateral contacts: when active, we enforce full 2-D
  // coincidence target = pusher (so the target body can't slide
  // laterally off the pusher). The `dir` vector only serves as the
  // activation criterion: contact is active while the projected
  // gap (target − pusher) · dir is non-positive.
  for (const contact of activeContacts) {
    const pusher = incidencePose(
      c,
      {
        kind: "body",
        bodyId: contact.pusher.bodyId,
        lx: contact.pusher.lx,
        ly: contact.pusher.ly,
      },
      layout,
      bodyIdx,
    );
    const target = incidencePose(
      c,
      {
        kind: "body",
        bodyId: contact.target.bodyId,
        lx: contact.target.lx,
        ly: contact.target.ly,
      },
      layout,
      bodyIdx,
    );
    const rx = target.pos.x - pusher.pos.x;
    const ry = target.pos.y - pusher.pos.y;
    const rowX = new Array<number>(layout.n).fill(0);
    const rowY = new Array<number>(layout.n).fill(0);
    for (let k = 0; k < target.jacCount; k++) {
      rowX[target.jacStart + k] += CONTACT_WEIGHT * target.jac.dx[k];
      rowY[target.jacStart + k] += CONTACT_WEIGHT * target.jac.dy[k];
    }
    for (let k = 0; k < pusher.jacCount; k++) {
      rowX[pusher.jacStart + k] -= CONTACT_WEIGHT * pusher.jac.dx[k];
      rowY[pusher.jacStart + k] -= CONTACT_WEIGHT * pusher.jac.dy[k];
    }
    rows.push(rowX);
    rows.push(rowY);
    res.push(CONTACT_WEIGHT * rx);
    res.push(CONTACT_WEIGHT * ry);
  }

  // Springs: one soft scalar equation per spring — the Euclidean
  // distance between its two joint endpoints should equal restLength.
  // Weighted down so rigid constraints still dominate; the spring
  // only asserts itself over free DOFs.
  for (const b of c.bodies) {
    if (b.kind !== "spring") continue;
    const s = b as SpringBody;
    if (!s.jointA || !s.jointB) continue;
    const jA = c.joints.find((j) => j.id === s.jointA);
    const jB = c.joints.find((j) => j.id === s.jointB);
    if (!jA || !jB || jA.incidents.length === 0 || jB.incidents.length === 0) {
      continue;
    }
    const poseA = incidencePose(c, jA.incidents[0], layout, bodyIdx);
    const poseB = incidencePose(c, jB.incidents[0], layout, bodyIdx);
    const dx = poseB.pos.x - poseA.pos.x;
    const dy = poseB.pos.y - poseA.pos.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-4) continue;
    const ux = dx / L;
    const uy = dy / L;
    // residual: L − restLength. Weighted by per-spring stiffness.
    const w = Math.max(0, s.stiffness ?? SPRING_WEIGHT);
    if (w < 1e-6) continue;
    const row = new Array<number>(layout.n).fill(0);
    for (let k = 0; k < poseB.jacCount; k++) {
      row[poseB.jacStart + k] += w * (poseB.jac.dx[k] * ux + poseB.jac.dy[k] * uy);
    }
    for (let k = 0; k < poseA.jacCount; k++) {
      row[poseA.jacStart + k] -= w * (poseA.jac.dx[k] * ux + poseA.jac.dy[k] * uy);
    }
    rows.push(row);
    res.push(w * (L - s.restLength));
  }

  return { f: res, J: rows };
}

// Compute the current gap for a contact. Positive = separated;
// non-positive = penetrating (constraint should be active).
function contactGap(c: Circuit, contact: Contact): number {
  const pusher = c.bodies.find((b) => b.id === contact.pusher.bodyId);
  const target = c.bodies.find((b) => b.id === contact.target.bodyId);
  if (!pusher || !target) return Infinity;
  if (pusher.kind === "spring" || target.kind === "spring") return Infinity;
  const pp = bodyToWorld(pusher, {
    lx: contact.pusher.lx,
    ly: contact.pusher.ly,
  });
  const tp = bodyToWorld(target, {
    lx: contact.target.lx,
    ly: contact.target.ly,
  });
  return (tp.x - pp.x) * contact.dirX + (tp.y - pp.y) * contact.dirY;
}

// ---------------------------------------------------------------------
// Small dense linear solver: regularised normal equations via Gauss.
// ---------------------------------------------------------------------

// Solve (AᵀA + λI) x = Aᵀb  for x; returns zero-vector if A is empty.
function solveNormal(A: number[][], b: number[], lambda: number): number[] {
  const m = A.length;
  if (m === 0) return [];
  const n = A[0].length;
  if (n === 0) return [];

  // H = AᵀA + λI
  const H: number[][] = Array.from({ length: n }, () =>
    new Array<number>(n).fill(0),
  );
  const g: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const aij = A[i][j];
      if (aij === 0) continue;
      g[j] += aij * b[i];
      for (let k = j; k < n; k++) {
        H[j][k] += aij * A[i][k];
      }
    }
  }
  // Symmetrise + regularise.
  for (let j = 0; j < n; j++) {
    H[j][j] += lambda;
    for (let k = j + 1; k < n; k++) {
      H[k][j] = H[j][k];
    }
  }

  // Gaussian elimination (partial pivoting).
  const M: number[][] = H.map((r, i) => [...r, g[i]]);
  for (let i = 0; i < n; i++) {
    // pivot
    let piv = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
    }
    if (piv !== i) {
      const tmp = M[i];
      M[i] = M[piv];
      M[piv] = tmp;
    }
    const diag = M[i][i];
    if (Math.abs(diag) < 1e-14) continue; // rank-deficient column; leave 0
    for (let k = i + 1; k < n; k++) {
      const f = M[k][i] / diag;
      if (f === 0) continue;
      for (let j = i; j <= n; j++) {
        M[k][j] -= f * M[i][j];
      }
    }
  }
  // back-substitute
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) sum -= M[i][j] * x[j];
    const diag = M[i][i];
    x[i] = Math.abs(diag) < 1e-14 ? 0 : sum / diag;
  }
  return x;
}

// ---------------------------------------------------------------------
// Apply a δq update back to body poses
// ---------------------------------------------------------------------

function applyDelta(c: Circuit, layout: DofLayout, delta: number[]): void {
  for (const b of c.bodies) {
    const start = layout.start.get(b.id);
    if (start == null || start < 0) continue;
    if (b.kind === "sleeve" || b.kind === "output" || b.kind === "input") {
      const rod = b as RodBody;
      rod.s += delta[start];
      const axisUnitX = Math.cos(rod.restTheta);
      const axisUnitY = Math.sin(rod.restTheta);
      rod.x = rod.restX + rod.s * axisUnitX;
      rod.y = rod.restY + rod.s * axisUnitY;
      rod.theta = rod.restTheta;
    } else if (b.kind === "connector") {
      const conn = b as ConnectorBody;
      conn.x += delta[start];
      conn.y += delta[start + 1];
      conn.theta += delta[start + 2];
    }
  }
}

// Refresh body poses from the current DOFs (for driven input changes
// and for rod bodies whose poses must be kept consistent with `s`).
export function syncPosesFromDof(c: Circuit): void {
  for (const b of c.bodies) {
    if (b.kind === "sleeve" || b.kind === "output" || b.kind === "input") {
      const rod = b as RodBody;
      const axisUnitX = Math.cos(rod.restTheta);
      const axisUnitY = Math.sin(rod.restTheta);
      rod.x = rod.restX + rod.s * axisUnitX;
      rod.y = rod.restY + rod.s * axisUnitY;
      rod.theta = rod.restTheta;
    } else if (b.kind === "connector") {
      // leave .x/.y/.theta as-is; they're the free state
    }
  }
}

// ---------------------------------------------------------------------
// Main entry point: iterate Newton steps until convergence
// ---------------------------------------------------------------------

export interface SolveOptions {
  maxIters: number;
  tol: number;
  lambda: number;
}

const DEFAULTS: SolveOptions = { maxIters: 50, tol: 1e-6, lambda: 1e-8 };

export interface SolveResult {
  residual: number;
  iters: number;
}

// Solve constraints in place on `c`. Does NOT touch driven input `s`;
// callers should update input.s before calling. If `pinnedBodies` is
// supplied, those bodies are treated as having zero free DOFs (their
// current pose is held fixed); used while the user is dragging to make
// the mechanism follow the dragged part rigidly.
export function solve(
  c: Circuit,
  opts: Partial<SolveOptions> = {},
  pinnedBodies?: Set<BodyId>,
): SolveResult {
  const o: SolveOptions = { ...DEFAULTS, ...opts };
  syncPosesFromDof(c);
  const layout = layoutDofs(c, pinnedBodies);
  if (layout.n === 0) return { residual: 0, iters: 0 };
  let lastRes = Infinity;
  let iters = 0;
  // Contact activation tolerance — strictly negative gap (actual
  // penetration) is required. Zero or positive gap means no contact,
  // so a Contact placed in a resting configuration is *inactive* and
  // the target body is free to move (draggable, springable, etc.).
  const GAP_TOL = 1e-4;
  const STEP_CAP = 0.3; // max absolute delta per Newton iteration
  for (let i = 0; i < o.maxIters; i++) {
    iters = i + 1;
    const active: Contact[] = (c.contacts ?? []).filter(
      (co) => contactGap(c, co) < -GAP_TOL,
    );
    const { f, J } = assemble(c, layout, active);
    if (f.length === 0) {
      lastRes = 0;
      break;
    }
    let norm2 = 0;
    for (const r of f) norm2 += r * r;
    lastRes = Math.sqrt(norm2);
    if (lastRes < o.tol) break;
    const neg = f.map((r) => -r);
    const delta = solveNormal(J, neg, o.lambda);
    let maxStep = 0;
    for (const d of delta) if (Math.abs(d) > maxStep) maxStep = Math.abs(d);
    const capped =
      maxStep > STEP_CAP ? delta.map((d) => (d * STEP_CAP) / maxStep) : delta;
    applyDelta(c, layout, capped);
  }
  return { residual: lastRes, iters };
}
