import { test } from "node:test";
import assert from "node:assert/strict";
import { findLeads, mergeLead } from "../src/leads.js";

const now = new Date("2026-10-21T12:00:00Z");
const base = { status: "ok", url_read: ["https://oldpark.example/rates?x=1"], nightly: 45, weekly: 250, monthly: 600, site_length_ft: "65 ft",
  pad_surface: "gravel", full_hookups: true, pets: "2 dogs", office_checkin: "9 to 5", online_booking: true,
  site_signals: { https: true, mobile_viewport: true, copyright_year: 2026, table_layout: false, frames_or_flash: false, generator: null } };
const records = {
  ChIJmodern0001: { ...base, name: "Modern Park" },
  ChIJoldsite002: { ...base, name: "Old Oaks RV", phone: "(830) 555-0100",
    site_signals: { https: false, mobile_viewport: false, copyright_year: 2011, table_layout: true, frames_or_flash: false, generator: "Microsoft FrontPage 4.0" } },
  ChIJnorates003: { ...base, name: "Quiet Creek", nightly: null, weekly: null, monthly: null, site_length_ft: null, pad_surface: null },
  ChIJblocked004: { ...base, status: "cant_read", site_problem: "robots_blocked", site_signals: null },
  ChIJfbonly0005: { ...base, status: "cant_read", site_problem: "listing_only", site_signals: null },
  ChIJsmallgap06: { ...base, name: "Small Gap", pets: null, site_length_ft: null, url_read: ["https://gap.example/ (loaded as https://x)"] },
};
const state = { stops: { Wimberley: { kept: ["ChIJmodern0001", "ChIJnosite0007"], cut: { ChIJfbonly0005: "only listed on a link-only site, can't read" },
  no_website: ["ChIJnosite0007"], listing_only: ["ChIJfbonly0005"] } } };

test("sorts parks into the three lead kinds and skips good or blocked sites", () => {
  const leads = Object.fromEntries(findLeads(records, state, { id: "p1", trip: "Texas" }, now).map(l => [l.place_id, l]));
  assert.deepEqual(Object.keys(leads).sort(), ["ChIJfbonly0005", "ChIJnorates003", "ChIJnosite0007", "ChIJoldsite002"]);
  const old = leads.ChIJoldsite002;
  assert.deepEqual(Object.keys(old.reasons), ["dated"]);
  assert.match(old.reasons.dated.join(";"), /not set up for phones.*copyright says 2011.*https.*table.*FrontPage/);
  assert.equal(old.website, "https://oldpark.example/rates");
  assert.equal(old.phone, "(830) 555-0100");
  assert.deepEqual(old.seen, [{ plan_id: "p1", trip: "Texas", stop: null, date: "2026-10-21" }]);
  assert.deepEqual(leads.ChIJnorates003.reasons.missing_info, ["no rates listed", "no site length or pad surface"]);
  assert.ok(leads.ChIJnosite0007.reasons.no_site);
  assert.equal(leads.ChIJnosite0007.seen[0].stop, "Wimberley");
  assert.ok(leads.ChIJfbonly0005.reasons.no_site);
});

test("works with records as a list and merges sightings across plans", () => {
  const first = findLeads([{ id: "ChIJnorates003", ...records.ChIJnorates003 }], null, { id: "p1", trip: "A" }, now)[0];
  const a = mergeLead(null, first);
  assert.equal(a.status, "new");
  const again = findLeads([{ id: "ChIJnorates003", ...records.ChIJnorates003, nightly: 40 }], null, { id: "p2", trip: "B" }, new Date("2026-11-01"))[0];
  const b = mergeLead({ ...a, status: "contacted", note: "left a message" }, again);
  assert.equal(b.status, "contacted");
  assert.equal(b.note, "left a message");
  assert.deepEqual(b.seen.map(s => s.plan_id), ["p1", "p2"]);
  assert.equal(b.last, "2026-11-01");
  assert.deepEqual(b.reasons.missing_info, ["no weekly or monthly rates", "no site length or pad surface"]);
  assert.deepEqual(mergeLead(b, again).seen.length, 2);
  const rescan = mergeLead(b, { ...again, reasons: { dated: ["x"] } });
  assert.deepEqual(rescan.reasons, { dated: ["x"] });
});
