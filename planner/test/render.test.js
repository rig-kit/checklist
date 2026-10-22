import { test } from "node:test";
import assert from "node:assert/strict";
import { renderPlan } from "../src/render.js";

const pick = (slot, id, extra = {}) => ({ slot, park_id: id, park: `Park ${id}`, cost: "$550 for the month", low: 600, high: 700, tag: "fits",
  drive_min: 12, drive_mi: 6.1, drive_est: false, pad: "Concrete, 70 ft", why: "Cheapest.", watch: "Shaded sites.", confirm: ["Sunday check-in"],
  phone: "(512) 555-0100", website: "https://example.com/rates", ...extra });
const plan = {
  trip: { title: "Texas <Winter> Trip", dates: "Nov 15 to Dec 27", rig: "28 ft Airstream", budget: "$3,000", electric_note: "", read_date: "Oct 16" },
  stops: [{ key: "W", name: "Wimberley", dates: "Nov 15 to Dec 13", nights: 28, budget: "$1,500", drive_in: null, travel: ["Office open Sundays."],
    picks: [pick("Best value", "aaaaaaaaaa1"), pick("Best reviewed", "aaaaaaaaaa2", { low: null })],
    left: [["Other Park", "Close call", "A bit far."]], calllist: [["Quiet Oaks", "(512) 555-0101", "site refused the connection"]],
    counts: { found: 40, cut: 20, checked: 12, not_checked: 8 } }],
};
const details = {
  aaaaaaaaaa1: { rating: 4.8, userRatingCount: 1234, googleMapsUri: "https://maps.google.com/?cid=1",
    reviews: [{ rating: 5, text: { text: "Lovely & quiet." }, authorAttribution: { displayName: "Ann", uri: "https://g/ann" }, relativePublishTimeDescription: "a month ago" },
              { rating: 2, text: { text: "Tight sites." }, authorAttribution: { displayName: "Bob" } }],
    photos: [{ name: "places/aaaaaaaaaa1/photos/p1", authorAttributions: [{ displayName: "Cy", uri: "https://g/cy" }] }] },
};

test("renders picks with live Google content credited and escapes everything", async () => {
  const res = await renderPlan(plan, details, async n => `/photo?n=${encodeURIComponent(n)}`, { claude_usd: 1.234, google_usd: 4.3 }, "Oct 17, 2026");
  const html = await res.text();
  assert.match(html, /Texas &lt;Winter&gt; Trip/);
  assert.match(html, /<span class="stars">4.8<\/span>/);
  assert.match(html, /1,234 Google reviews/);
  assert.match(html, /Lovely &amp; quiet\./);
  assert.match(html, /Tight sites\..*Bob/);
  assert.match(html, /Photo: <a href="https:\/\/g\/cy"/);
  assert.match(html, /\/photo\?n=places%2Faaaaaaaaaa1%2Fphotos%2Fp1/);
  assert.match(html, /No Google rating/); // second pick has no details
  assert.match(html, /\$600 to \$700/); // value total
  assert.match(html, /stops with prices unknown/);
  assert.match(html, /\$1\.23/);
  assert.match(html, /We checked <b>12<\/b>/);
  assert.match(html, /Quiet Oaks/);
});
