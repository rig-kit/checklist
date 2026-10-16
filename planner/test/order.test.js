import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrder } from "../src/order.js";
import { display, parseReply } from "../src/interview.js";

const base = {
  trip_name: "Texas Winter Trip",
  profile: { rig: "2023 Airstream Flying Cloud, 28 ft", tow: "GMC 2500HD, about 50 ft hitched", limits: "no slide-outs",
    people: "2 adults, 1 small dog", hookups: "full hookups, 50 amp", power: "solar and generator", internet: "Starlink plus hotspot", memberships: "" },
  budget: "$3,000", budget_split: "", move_days: "Sat or Sun", drive_day: "250 miles comfortable, 400 max",
  wants: { must: ["Concrete pads"], nice: ["Open sky (for Starlink)"], dont_care: [] }, give_up: "", notes: "",
  stops: [
    { town: "Wimberley, TX", arrive: "2026-11-15", nights: 28, max_drive_min: 35, budget: "$1,500", notes: "" },
    { town: "Fredericksburg, TX", arrive: "2026-12-13", nights: 14, max_drive_min: 25, budget: "", notes: "near Main St" },
  ],
};

test("builds the order shape discover.py reads", () => {
  const { order, profile, errors } = buildOrder(base, "2026-10-16");
  assert.equal(errors, undefined);
  assert.equal(order.slug, "texas-winter-trip");
  assert.deepEqual(order.stops.map(s => [s.key, s.town, s.arrive, s.nights, s.max_drive_min]),
    [["Wimberley, TX", "Wimberley, TX", "2026-11-15", 28, 35], ["Fredericksburg, TX", "Fredericksburg, TX", "2026-12-13", 14, 25]]);
  assert.equal(order.stops[1].budget, "not given");
  assert.equal(order.stops[1].notes, "near Main St");
  assert.equal(order.ends, "2026-12-27");
  assert.match(order.customer, /Hookups needed: full hookups, 50 amp\./);
  assert.doesNotMatch(order.customer, /Memberships/);
  assert.equal(order.wants, "Must-have: Concrete pads. Nice-to-have: Open sky (for Starlink).");
  assert.equal(profile.internet, "Starlink plus hotspot");
});

test("reports problems the interviewer can put to the customer", () => {
  const bad = { ...base, trip_name: "", stops: [base.stops[0], { ...base.stops[1], arrive: "2026-12-01" }] };
  assert.deepEqual(buildOrder(bad, "2026-10-16").errors, [
    "The trip has no name yet.",
    "Fredericksburg, TX arrives Tue, Dec 1, 2026, but Wimberley, TX runs until Sun, Dec 13, 2026.",
  ]);
  assert.deepEqual(buildOrder({ trip_name: "x" }, "2026-10-16").errors, ["The trip has no stops yet."]);
  const past = { ...base, stops: [{ ...base.stops[0], arrive: "2026-01-01" }] };
  assert.match(buildOrder(past, "2026-10-16").errors[0], /Stop 1 \(Wimberley, TX\): the arrival date, Thu, Jan 1, 2026, is in the past\. Today is Fri, Oct 16, 2026\./);
  // A day of slack for time zones.
  assert.equal(buildOrder({ ...base, stops: [{ ...base.stops[0], arrive: "2026-10-15" }] }, "2026-10-16").errors, undefined);
});

test("drive choices snap to the nearest option and long text is cut", () => {
  const { order } = buildOrder({ ...base, notes: "x".repeat(5000), stops: [{ ...base.stops[0], max_drive_min: 50 }] }, "2026-10-16");
  assert.equal(order.stops[0].max_drive_min, 45);
  assert.equal(order.notes.length, 1200);
});

const reply = obj => ({ role: "assistant", content: [{ type: "thinking", thinking: "" }, { type: "text", text: JSON.stringify(obj) }] });

test("the browser sees the chat without our order-check notes", () => {
  const msgs = [
    { role: "user", content: "Hi" },
    reply({ say: "What rig?", quick_replies: [], trait_picker: false, ready: false, summary: [], trip: null }),
    { role: "user", content: "Airstream" },
    reply({ say: "Ready!", quick_replies: [], trait_picker: false, ready: true, summary: ["x"], trip: base }),
    { role: "user", content: "[order check, not from the customer] bad dates" },
    reply({ say: "Which date?", quick_replies: ["Nov 15"], trait_picker: false, ready: false, summary: [], trip: null }),
  ];
  const out = display(msgs);
  assert.deepEqual(out.map(m => [m.role, m.text]), [["user", "Hi"], ["assistant", "What rig?"], ["user", "Airstream"], ["assistant", "Which date?"]]);
  assert.deepEqual(out[3].quick_replies, ["Nov 15"]);
  assert.equal(parseReply([{ type: "text", text: "not json" }]), null);
  assert.equal(parseReply(reply({ say: "x", ready: true, trip: null }).content).ready, false);
});
