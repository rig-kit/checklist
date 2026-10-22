// Checks the trip the interview agent gathered and turns it into the order JSON the planner agent and
// discover.py read (same shape as trip-planner/beta/examples/texas-order.json). Pure functions, no I/O.

export const MAX_STOPS = 8;
export const DRIVE_CHOICES = [15, 25, 35, 45, 60];
const LIMIT = 600; // characters per free-text answer

const clean = (v, max = LIMIT) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "trip";
}

export const pretty = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// `draft` is the interview agent's trip object (see INTERVIEW_SCHEMA in interview.js).
// Returns { order } or { errors: [message, ...] } written so the agent can put them to the customer.
export function buildOrder(draft, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const d = draft && typeof draft === "object" ? draft : {};
  const tripName = clean(d.trip_name, 80);
  if (!tripName) errors.push("The trip has no name yet.");

  const stops = [];
  const raw = Array.isArray(d.stops) ? d.stops.slice(0, MAX_STOPS) : [];
  raw.forEach((s, idx) => {
    const town = clean(s && s.town, 100);
    const arrive = clean(s && s.arrive, 10);
    const nights = Math.round(Number(s && s.nights));
    const label = town ? `Stop ${idx + 1} (${town})` : `Stop ${idx + 1}`;
    if (!town) return errors.push(`${label} has no town or area.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrive) || isNaN(Date.parse(arrive))) return errors.push(`${label} has no arrival date.`);
    if (arrive < addDays(today, -1)) errors.push(`${label}: the arrival date, ${pretty(arrive)}, is in the past. Today is ${pretty(today)}.`);
    if (!(nights >= 1 && nights <= 180)) return errors.push(`${label}: nights should be 1 to 180.`);
    let minutes = Math.round(Number(s.max_drive_min));
    if (!DRIVE_CHOICES.includes(minutes)) minutes = DRIVE_CHOICES.reduce((a, b) => (Math.abs(b - minutes) < Math.abs(a - minutes) ? b : a), 25);
    const key = stops.some(x => x.key === town) ? `${town} (${idx + 1})` : town;
    stops.push({ key, name: town, town, arrive, nights, max_drive_min: minutes,
      budget: clean(s.budget, 120) || "not given", notes: clean(s.notes) || null });
  });
  if (!stops.length && !errors.length) errors.push("The trip has no stops yet.");
  for (let i = 1; i < stops.length; i++) {
    const prevEnd = addDays(stops[i - 1].arrive, stops[i - 1].nights);
    if (stops[i].arrive < prevEnd) {
      errors.push(`${stops[i].town} arrives ${pretty(stops[i].arrive)}, but ${stops[i - 1].town} runs until ${pretty(prevEnd)}.`);
    }
  }
  if (errors.length) return { errors };

  const p = d.profile || {};
  const customer = [
    clean(p.rig) && `Rig: ${clean(p.rig)}.`,
    clean(p.tow) && `Tow vehicle and hitched length: ${clean(p.tow)}.`,
    clean(p.limits) && `Slide-outs and size limits: ${clean(p.limits)}.`,
    clean(p.people) && `People and pets: ${clean(p.people)}.`,
    `Hookups needed: ${clean(p.hookups) || "not given"}.`,
    clean(p.power) && `Solar or generator: ${clean(p.power)}.`,
    clean(p.internet) && `Internet: ${clean(p.internet)}.`,
    clean(p.memberships) && `Memberships: ${clean(p.memberships)}.`,
  ].filter(Boolean).join(" ");

  const w = d.wants || {};
  const list = v => (Array.isArray(v) ? v.map(x => clean(x, 80)).filter(Boolean) : []);
  const wants = [["Must-have", list(w.must)], ["Nice-to-have", list(w.nice)], ["Don't care", list(w.dont_care)]]
    .filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(", ")}.`).join(" ");

  const last = stops[stops.length - 1];
  return {
    order: {
      trip_name: tripName,
      slug: slugify(tripName),
      customer,
      budget: clean(d.budget, 200) || "not given",
      budget_split: clean(d.budget_split, 200) || null,
      move_days: clean(d.move_days, 200) || "no preference given",
      drive_day: clean(d.drive_day, 200) || "not given",
      stops,
      ends: addDays(last.arrive, last.nights),
      wants: wants || "No preferences given.",
      give_up: clean(d.give_up) || null,
      notes: clean(d.notes, 1200) || null,
    },
    profile: Object.fromEntries(["rig", "tow", "limits", "people", "hookups", "power", "internet", "memberships"].map(k => [k, clean(p[k])])),
  };
}
