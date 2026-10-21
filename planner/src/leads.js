// Website-redesign leads for the owner only. After each plan, the parks the agent looked at are sorted into
// three kinds: no website of their own, a website that looks out of date, and a website missing facts a
// camper needs. Built only from what the planner already gathered (place IDs and the parks' own sites), so it
// adds no Claude or Google calls to a plan. Nothing here ever reaches a customer's plan page.

export const KINDS = {
  no_site: "No website",
  dated: "Website looks out of date",
  missing_info: "Website missing key info",
};

const OLD_BUILDERS = /frontpage|dreamweaver|publisher|iweb|netobjects|homestead|freewebs|web\.com|website tonight|sitebuilder/i;
const ID = /^[A-Za-z0-9_-]{10,300}$/;

const has = v => v !== null && v !== undefined && v !== "" && v !== false;
const clean = (s, n = 200) => (typeof s === "string" ? s.trim().slice(0, n) : null) || null;

// What an old site looks like from its code (getpage.py's SITE SIGNALS) and the reader's own notes.
function datedWhy(r, year) {
  const s = r.site_signals || {};
  const why = [];
  if (s.mobile_viewport === false) why.push("not set up for phones");
  if (s.copyright_year && s.copyright_year <= year - 4) why.push(`copyright says ${s.copyright_year}`);
  if (s.https === false) why.push("no secure (https) address");
  if (s.table_layout) why.push("old table-based layout");
  if (s.frames_or_flash) why.push("frames, Flash or similar 2000s features");
  if (s.generator && OLD_BUILDERS.test(s.generator)) why.push(`built with ${clean(s.generator, 40)}`);
  if (r.site_problem === "fetch_error") why.push("website didn't load when we tried");
  if (clean(r.site_dated)) why.push(clean(r.site_dated, 120));
  return why;
}

// Facts a camper looks for that the park's own site didn't give.
function missingWhy(r) {
  const why = [];
  const anyRate = [r.nightly, r.weekly, r.monthly, r.other_rates].some(has);
  if (!anyRate) why.push("no rates listed");
  else if (!has(r.weekly) && !has(r.monthly)) why.push("no weekly or monthly rates");
  if (!has(r.site_length_ft) && !has(r.pad_surface)) why.push("no site length or pad surface");
  else if (!has(r.site_length_ft)) why.push("no site length");
  const major = why.length;
  if (!has(r.full_hookups) && !has(r.amps)) why.push("no hookup details");
  if (!has(r.pets)) why.push("no pet policy");
  if (!has(r.office_checkin)) why.push("no office hours or check-in times");
  if (r.online_booking === false) why.push("no online booking");
  return major ? why : []; // the small gaps alone don't make a lead
}

function asList(records) {
  if (Array.isArray(records)) return records;
  if (records && typeof records === "object") return Object.entries(records).map(([id, r]) => ({ id, ...r }));
  return [];
}

// records: the readers' merged records.json; state: run-state.json; plan: who found it.
// Returns one lead per place ID: { place_id, name, website, phone, email, reasons: {kind: [why...]}, seen }.
export function findLeads(records, state, plan, now = new Date()) {
  const year = now.getUTCFullYear();
  const out = {};
  const stopOf = {};
  for (const [stop, s] of Object.entries((state && state.stops) || {})) {
    for (const id of [...(s.kept || []), ...Object.keys(s.cut || {})]) stopOf[id] ??= stop;
  }
  const lead = id => (out[id] ??= {
    place_id: id, name: null, website: null, phone: null, email: null, reasons: {},
    seen: [{ plan_id: plan.id, trip: clean(plan.trip, 80), stop: stopOf[id] || null, date: now.toISOString().slice(0, 10) }],
  });
  const add = (id, kind, why) => {
    if (!ID.test(id || "") || !why.length) return;
    lead(id).reasons[kind] = why;
  };

  for (const s of Object.values((state && state.stops) || {})) {
    for (const id of s.no_website || []) add(id, "no_site", ["no website listed on Google"]);
    for (const id of s.listing_only || []) add(id, "no_site", ["only a Facebook or listing page, no site of its own"]);
  }
  for (const r of asList(records)) {
    if (!r || !ID.test(r.id || "") || r.status === "no_rv_camping") continue;
    if (r.site_problem === "no_website") add(r.id, "no_site", ["no website of its own"]);
    else if (r.site_problem === "listing_only") add(r.id, "no_site", ["only a Facebook or listing page, no site of its own"]);
    else if (r.site_problem !== "robots_blocked") {
      add(r.id, "dated", datedWhy(r, year));
      if (r.status === "ok" || r.status === "not_a_fit") add(r.id, "missing_info", missingWhy(r));
    }
    if (out[r.id]) {
      const l = out[r.id];
      l.name = clean(r.name, 120);
      const url = (r.url_read || [])[0];
      l.website = typeof url === "string" && /^https?:\/\//.test(url) ? url.split(/[?#]/)[0].slice(0, 300) : null;
      l.phone = clean(r.phone, 40);
      l.email = clean(r.email, 120);
    }
  }
  return Object.values(out);
}

// Folds a new sighting into what we already had for that park: newest reasons win, every plan is kept once.
export function mergeLead(old, add) {
  if (!old) return { ...add, status: "new", note: "", first: add.seen[0].date, last: add.seen[0].date };
  const seen = [...old.seen.filter(s => !add.seen.some(a => a.plan_id === s.plan_id && a.stop === s.stop)), ...add.seen].slice(-20);
  return {
    ...old,
    name: add.name || old.name, website: add.website || old.website, phone: add.phone || old.phone, email: add.email || old.email,
    reasons: { ...old.reasons, ...add.reasons },
    seen, last: add.seen[0].date,
  };
}
