// Persistence + deep-clone-with-remap for the logic-gate sandbox.

import type {
  Circuit,
  Body,
  BodyId,
  Joint,
  JointId,
  Vec2,
  Group,
  Contact,
} from "./model";

const LS_KEY = "qrmt.logic-gates.library.v2";

export interface SavedGate {
  name: string;
  createdAt: number;
  circuit: Circuit;
}

// ---------------------------------------------------------------------
// localStorage library
// ---------------------------------------------------------------------

export function loadLibrary(): SavedGate[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as SavedGate[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveLibrary(lib: SavedGate[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(lib));
}

export function upsertGate(lib: SavedGate[], g: SavedGate): SavedGate[] {
  const filtered = lib.filter((x) => x.name !== g.name);
  return [...filtered, g].sort((a, b) => a.name.localeCompare(b.name));
}

export function deleteGate(lib: SavedGate[], name: string): SavedGate[] {
  return lib.filter((g) => g.name !== name);
}

// ---------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------

export function serializeCircuit(c: Circuit): string {
  return JSON.stringify({ version: 2, circuit: c }, null, 2);
}

export function deserializeCircuit(json: string): Circuit {
  const parsed = JSON.parse(json) as { version?: number; circuit?: Circuit };
  if (!parsed.circuit) throw new Error("Not a circuit file");
  const c = parsed.circuit;
  if (!Array.isArray(c.bodies) || !Array.isArray(c.joints))
    throw new Error("Malformed circuit");
  if (!Array.isArray(c.groups)) (c as Circuit).groups = [];
  if (!Array.isArray((c as Circuit).contacts)) (c as Circuit).contacts = [];
  return c;
}

// ---------------------------------------------------------------------
// Deep clone with ID remap — used for Insert
// ---------------------------------------------------------------------

export function cloneRemapped(
  src: Circuit,
  nextIdStart: number,
  offset: Vec2,
): {
  bodies: Body[];
  joints: Joint[];
  groups: Group[];
  nextId: number;
} {
  let next = nextIdStart;
  const bodyMap = new Map<BodyId, BodyId>();
  const jointMap = new Map<JointId, JointId>();

  const prefixFor = (k: Body["kind"]): string =>
    k === "sleeve"
      ? "sl"
      : k === "input"
        ? "in"
        : k === "output"
          ? "ou"
          : k === "connector"
            ? "cn"
            : "sp";

  const bodies: Body[] = src.bodies.map((b) => {
    const fresh = `${prefixFor(b.kind)}${next++}`;
    bodyMap.set(b.id, fresh);
    const copy: Body = JSON.parse(JSON.stringify(b));
    copy.id = fresh;
    copy.x += offset.x;
    copy.y += offset.y;
    copy.restX += offset.x;
    copy.restY += offset.y;
    // spring jointA/jointB are remapped below (after jointMap is built)
    return copy;
  });

  const joints: Joint[] = src.joints.map((j) => {
    const fresh = `j${next++}`;
    jointMap.set(j.id, fresh);
    return {
      id: fresh,
      incidents: j.incidents.map((inc) => {
        if (inc.kind === "frame") {
          return {
            kind: "frame" as const,
            bodyId: null,
            lx: inc.lx + offset.x,
            ly: inc.ly + offset.y,
          };
        }
        return {
          kind: "body" as const,
          bodyId: inc.bodyId != null ? (bodyMap.get(inc.bodyId) ?? inc.bodyId) : null,
          lx: inc.lx,
          ly: inc.ly,
        };
      }),
    };
  });

  // Remap spring joint references after joint IDs are known.
  for (const b of bodies) {
    if (b.kind === "spring") {
      if (b.jointA != null)
        b.jointA = jointMap.get(b.jointA) ?? b.jointA;
      if (b.jointB != null)
        b.jointB = jointMap.get(b.jointB) ?? b.jointB;
    }
  }

  const groups: Group[] = src.groups.map((g) => ({
    id: `g${next++}`,
    name: g.name,
    bodyIds: g.bodyIds.map((bid) => bodyMap.get(bid) ?? bid),
    jointIds: g.jointIds.map((jid) => jointMap.get(jid) ?? jid),
    scaffolded: g.scaffolded,
  }));

  const contacts: Contact[] = (src.contacts ?? []).map((co) => ({
    id: `ct${next++}`,
    pusher: {
      bodyId: bodyMap.get(co.pusher.bodyId) ?? co.pusher.bodyId,
      lx: co.pusher.lx,
      ly: co.pusher.ly,
    },
    target: {
      bodyId: bodyMap.get(co.target.bodyId) ?? co.target.bodyId,
      lx: co.target.lx,
      ly: co.target.ly,
    },
    dirX: co.dirX,
    dirY: co.dirY,
  }));

  return { bodies, joints, groups, contacts, nextId: next };
}
