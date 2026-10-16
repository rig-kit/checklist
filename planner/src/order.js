// Turns the order form into the order JSON the planner agent and discover.py read
// (same shape as trip-planner/beta/examples/texas-order.json). Pure functions, no I/O.

export const MAX_STOPS = 6;
export const DRIVE_CHOICES = [15, 25, 35, 45, 60];
export const TRAITS = [
  ["concrete", "Concrete pads"],
  ["pull_through", "Pull-through sites"],
  ["full_hookups", "Full hookups"],
  ["open_sky", "Open sky (for Starlink)"],
  ["dog_area", "Dog park or fenced area"],
  ["quiet", "Quiet or adults only"],
  ["pool", "Pool or clubhouse"],
  ["state_parks", "State parks"],
  ["waterfront", "Waterfront"],
  ["near_town", "Near town"],
];
const LEVELS = { must: "must-have", nice: "nice-to-have", no: "don't care" };
const LIMIT = 600; // characters per free-text answer

function text(form, name, max = LIMIT) {
  const v = form.get(name);
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "trip";
}

function addDays(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Returns { order } or { errors: [message, ...] }. `form` is a FormData (or anything with get()).
export function parseOrder(form, today = new Date().toISOString().slice(0, 10)) {
  const errors = [];
  const tripName = text(form, "trip_name", 80);
  if (!tripName) errors.push("Give the trip a name.");
  const email = text(form, "email", 200);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("That email address doesn't look right.");

  const stops = [];
  for (let i = 1; i <= MAX_STOPS; i++) {
    const town = text(form, `stop${i}_town`, 100);
    const arrive = text(form, `stop${i}_arrive`, 10);
    const nights = parseInt(text(form, `stop${i}_nights`, 4), 10);
    if (!town && !arrive && !nights) continue;
    const label = `Stop ${i}`;
    if (!town) { errors.push(`${label}: say which town or area.`); continue; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(arrive)) { errors.push(`${label}: pick an arrival date.`); continue; }
    if (arrive < today) errors.push(`${label}: the arrival date is in the past.`);
    if (!(nights >= 1 && nights <= 180)) { errors.push(`${label}: nights should be 1 to 180.`); continue; }
    let minutes = parseInt(text(form, `stop${i}_drive`, 3), 10);
    if (!DRIVE_CHOICES.includes(minutes)) minutes = 25;
    const key = stops.some(s => s.key === town) ? `${town} (${i})` : town;
    stops.push({ key, name: town, town, arrive, nights, max_drive_min: minutes, budget: text(form, `stop${i}_budget`, 80) || "not given" });
  }
  if (!stops.length) errors.push("Add at least one stop.");
  for (let i = 1; i < stops.length; i++) {
    const prevEnd = addDays(stops[i - 1].arrive, stops[i - 1].nights);
    if (stops[i].arrive < prevEnd) errors.push(`${stops[i].town}: arrives before the previous stop ends (${prevEnd}).`);
  }
  if (errors.length) return { errors };

  const wants = { "must-have": [], "nice-to-have": [], "don't care": [] };
  for (const [k, label] of TRAITS) {
    const lvl = LEVELS[text(form, `want_${k}`, 4)] || "don't care";
    wants[lvl].push(label.toLowerCase());
  }
  const wantLine = Object.entries(wants).filter(([, v]) => v.length).map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)}: ${v.join(", ")}.`).join(" ");

  const customer = [
    text(form, "rig") && `Rig: ${text(form, "rig")}.`,
    text(form, "tow") && `Tow vehicle and hitched length: ${text(form, "tow")}.`,
    text(form, "limits") && `Slide-outs and size limits: ${text(form, "limits")}.`,
    text(form, "people") && `People and pets: ${text(form, "people")}.`,
    `Hookups needed: ${{ full: "full hookups", we: "water and electric", none: "none (boondocking is fine)" }[text(form, "hookups", 4)] || "not given"}${text(form, "amps", 3) ? `, ${text(form, "amps", 3)} amp` : ""}.`,
    text(form, "power") && `Solar or generator: ${text(form, "power")}.`,
    text(form, "internet") && `Internet: ${text(form, "internet")}.`,
    text(form, "memberships") && `Memberships: ${text(form, "memberships")}.`,
  ].filter(Boolean).join(" ");

  const last = stops[stops.length - 1];
  return {
    order: {
      trip_name: tripName,
      slug: slugify(tripName),
      customer,
      budget: text(form, "budget", 200) || "not given",
      budget_split: text(form, "budget_split", 200) || null,
      move_days: text(form, "move_days", 200) || "no preference given",
      drive_day: text(form, "drive_day", 200) || "not given",
      stops,
      ends: addDays(last.arrive, last.nights),
      wants: wantLine,
      give_up: text(form, "give_up") || null,
      notes: text(form, "notes") || null,
    },
    email: email || null,
  };
}
