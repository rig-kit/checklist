import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOrder } from "../src/order.js";

const form = obj => ({ get: k => (k in obj ? obj[k] : null) });
const base = {
  trip_name: "Texas Winter Trip", email: "a@b.co", rig: "2023 Airstream Flying Cloud, 28 ft", tow: "GMC 2500HD, about 50 ft",
  people: "2 adults, 1 small dog", hookups: "full", amps: "50", internet: "Starlink plus hotspot", budget: "$3,000",
  stop1_town: "Wimberley, TX", stop1_arrive: "2026-11-15", stop1_nights: "28", stop1_drive: "35", stop1_budget: "$1,500",
  stop2_town: "Fredericksburg, TX", stop2_arrive: "2026-12-13", stop2_nights: "14", stop2_drive: "25",
  want_concrete: "must", want_open_sky: "nice",
};

test("builds the order shape discover.py reads", () => {
  const { order, email, errors } = parseOrder(form(base), "2026-10-16");
  assert.equal(errors, undefined);
  assert.equal(email, "a@b.co");
  assert.equal(order.slug, "texas-winter-trip");
  assert.deepEqual(order.stops.map(s => [s.key, s.town, s.arrive, s.nights, s.max_drive_min]),
    [["Wimberley, TX", "Wimberley, TX", "2026-11-15", 28, 35], ["Fredericksburg, TX", "Fredericksburg, TX", "2026-12-13", 14, 25]]);
  assert.equal(order.stops[1].budget, "not given");
  assert.equal(order.ends, "2026-12-27");
  assert.match(order.customer, /Hookups needed: full hookups, 50 amp\./);
  assert.match(order.wants, /^Must-have: concrete pads\. Nice-to-have: open sky \(for starlink\)\./);
});

test("reports problems instead of ordering", () => {
  const { errors } = parseOrder(form({ ...base, trip_name: "", stop2_arrive: "2026-12-01", email: "nope" }), "2026-10-16");
  assert.deepEqual(errors, [
    "Give the trip a name.",
    "That email address doesn't look right.",
    "Fredericksburg, TX: arrives Tue, Dec 1, 2026, but Wimberley, TX runs until Sun, Dec 13, 2026. Change one of the dates or the nights.",
  ]);
  assert.deepEqual(parseOrder(form({ trip_name: "x" }), "2026-10-16").errors, ["Add at least one stop."]);
  assert.match(parseOrder(form({ ...base, stop1_arrive: "2026-01-01" }), "2026-10-16").errors[0], /Stop 1 \(Wimberley, TX\): the arrival date, Thu, Jan 1, 2026, is in the past\. Check the year\./);
});

test("unknown drive choices fall back to 25 minutes and long text is cut", () => {
  const { order } = parseOrder(form({ ...base, stop1_drive: "999", notes: "x".repeat(5000) }), "2026-10-16");
  assert.equal(order.stops[0].max_drive_min, 25);
  assert.equal(order.notes.length, 600);
});
