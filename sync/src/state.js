// The shared list for one trailer, and how each change applies to it.
// src/app.html carries a copy of applyOp (search "keep in step with sync/src/state.js"); change both together.

export const LIMITS = { custom: 100, text: 120, name: 60, deleted: 1000, phones: 8, ops: 200, message: 32768 };

export function emptyState() {
  return { trip: 1, name: "", checked: {}, hidden: {}, custom: [], deleted: {} };
}

// Last change to reach the server wins, item by item. Returns true if the list changed.
export function applyOp(s, op) {
  switch (op.t) {
    case "check":
      if (op.trip !== s.trip) return false; // a late tap from an earlier travel day
      if (op.v) s.checked[op.id] = true; else delete s.checked[op.id];
      return true;
    case "hide":
      if (op.v) { s.hidden[op.id] = true; delete s.checked[op.id]; } else delete s.hidden[op.id];
      return true;
    case "showall":
      s.hidden = {};
      return true;
    case "add":
      if (s.deleted[op.item.id] || s.custom.some(c => c.id === op.item.id)) return false;
      s.custom.push(op.item);
      return true;
    case "del":
      s.deleted[op.id] = true;
      s.custom = s.custom.filter(c => c.id !== op.id);
      delete s.checked[op.id];
      return true;
    case "name":
      if (op.trip !== s.trip) return false;
      s.name = op.v;
      return true;
    case "trip": // start a new travel day
      if (op.trip <= s.trip) return false; // the other phone already started it
      s.trip = op.trip; s.checked = {}; s.name = op.name || "";
      return true;
  }
  return false;
}

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const str = (v, max) => typeof v === "string" && v.length <= max;
const trip = v => Number.isInteger(v) && v > 0 && v < 1e9;

// Anything a phone sends is checked here first; bad input is dropped, never stored.
export function validOp(op) {
  if (!op || typeof op !== "object") return false;
  switch (op.t) {
    case "check": return ID.test(op.id) && typeof op.v === "boolean" && trip(op.trip);
    case "hide": return ID.test(op.id) && typeof op.v === "boolean";
    case "showall": return true;
    case "add": return !!op.item && ID.test(op.item.id) && ID.test(op.item.section) && str(op.item.text, LIMITS.text) && op.item.text.trim() !== "";
    case "del": return ID.test(op.id);
    case "name": return str(op.v, LIMITS.name) && trip(op.trip);
    case "trip": return trip(op.trip) && (op.name == null || str(op.name, LIMITS.name));
  }
  return false;
}

// Apply a validated op, then keep the list inside its size limits.
export function applyChecked(s, op) {
  if (!validOp(op)) return false;
  if (op.t === "add") {
    if (s.custom.length >= LIMITS.custom) return false;
    op = { t: "add", item: { id: op.item.id, section: op.item.section, text: op.item.text.trim() } };
  }
  const changed = applyOp(s, op);
  if (Object.keys(s.deleted).length > LIMITS.deleted) s.deleted = {};
  return changed;
}

// A list handed over when a trailer is first shared: rebuilt field by field from valid pieces only.
export function cleanState(input) {
  const s = emptyState();
  if (!input || typeof input !== "object") return s;
  if (trip(input.trip)) s.trip = input.trip;
  if (str(input.name, LIMITS.name)) s.name = input.name;
  for (const k of ["checked", "hidden", "deleted"]) {
    if (input[k] && typeof input[k] === "object") {
      for (const id of Object.keys(input[k]).slice(0, LIMITS.deleted)) if (ID.test(id) && input[k][id]) s[k][id] = true;
    }
  }
  if (Array.isArray(input.custom)) {
    for (const item of input.custom.slice(0, LIMITS.custom)) applyChecked(s, { t: "add", item });
  }
  return s;
}
