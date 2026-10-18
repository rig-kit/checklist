import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, applyChecked, cleanState, LIMITS } from "../src/state.js";

test("checks and unchecks; last change wins", () => {
  const s = emptyState();
  applyChecked(s, { t: "check", id: "h1", v: true, trip: 1 });
  applyChecked(s, { t: "check", id: "h1", v: false, trip: 1 });
  assert.deepEqual(s.checked, {});
});

test("a late check from an earlier travel day is ignored", () => {
  const s = emptyState();
  applyChecked(s, { t: "check", id: "h1", v: true, trip: 1 });
  applyChecked(s, { t: "trip", trip: 2, name: "Houston > Dallas" });
  assert.deepEqual(s.checked, {});
  assert.equal(s.name, "Houston > Dallas");
  assert.equal(applyChecked(s, { t: "check", id: "h2", v: true, trip: 1 }), false);
  assert.deepEqual(s.checked, {});
});

test("both phones starting a new day at once only resets once", () => {
  const s = emptyState();
  applyChecked(s, { t: "trip", trip: 2 });
  applyChecked(s, { t: "check", id: "h1", v: true, trip: 2 });
  assert.equal(applyChecked(s, { t: "trip", trip: 2 }), false);
  assert.deepEqual(s.checked, { h1: true });
});

test("a deleted custom item never comes back", () => {
  const s = emptyState();
  const item = { id: "uabc", section: "kitchen", text: "Coffee maker" };
  applyChecked(s, { t: "add", item });
  applyChecked(s, { t: "del", id: "uabc" });
  applyChecked(s, { t: "add", item });
  assert.deepEqual(s.custom, []);
});

test("bad or oversized input is dropped", () => {
  const s = emptyState();
  assert.equal(applyChecked(s, { t: "check", id: "<script>", v: true, trip: 1 }), false);
  assert.equal(applyChecked(s, { t: "add", item: { id: "u1", section: "kitchen", text: "x".repeat(LIMITS.text + 1) } }), false);
  assert.equal(applyChecked(s, { t: "name", v: "x".repeat(LIMITS.name + 1), trip: 1 }), false);
  assert.equal(applyChecked(s, { t: "nope" }), false);
  for (let i = 0; i < LIMITS.custom + 5; i++) applyChecked(s, { t: "add", item: { id: "u" + i, section: "kitchen", text: "item" } });
  assert.equal(s.custom.length, LIMITS.custom);
});

test("cleanState keeps only valid pieces", () => {
  const s = cleanState({ trip: 3, name: "Trip", checked: { h1: true, "bad id": true }, custom: [{ id: "u1", section: "kitchen", text: "Ok" }, { id: 5 }], extra: 1 });
  assert.deepEqual(s, { trip: 3, name: "Trip", checked: { h1: true }, hidden: {}, custom: [{ id: "u1", section: "kitchen", text: "Ok" }], deleted: {}, order: {} });
});

test("your own order is shared, can be put back, and bad orders are dropped", () => {
  const s = emptyState();
  assert.equal(applyChecked(s, { t: "order", sec: "kitchen", ids: ["c3", "c1"] }), true);
  assert.equal(applyChecked(s, { t: "order", sec: "_sections", ids: ["final", "hookups"] }), true);
  assert.deepEqual(s.order, { kitchen: ["c3", "c1"], _sections: ["final", "hookups"] });
  applyChecked(s, { t: "order", sec: "kitchen", ids: [] });
  assert.deepEqual(s.order, { _sections: ["final", "hookups"] });
  assert.equal(applyChecked(s, { t: "order", sec: "kitchen", ids: ["bad id!"] }), false);
  assert.equal(applyChecked(s, { t: "order", sec: "kitchen", ids: "c1" }), false);
  assert.equal(applyChecked(s, { t: "order", sec: "kitchen", ids: Array(LIMITS.orderIds + 1).fill("c1") }), false);
});

test("a list saved before custom order existed still takes an order", () => {
  const s = { trip: 1, name: "", checked: {}, hidden: {}, custom: [], deleted: {} };
  assert.equal(applyChecked(s, { t: "order", sec: "bath", ids: ["b2", "b1"] }), true);
  assert.deepEqual(s.order, { bath: ["b2", "b1"] });
  const c = cleanState({ order: { bath: ["b2", "b1"], "x y": ["b1"], tires: [1] } });
  assert.deepEqual(c.order, { bath: ["b2", "b1"] });
});
