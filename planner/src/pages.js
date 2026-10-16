// HTML for the order form and the "your plan is being built" page. The plan page itself is in render.js.
import { MAX_STOPS, DRIVE_CHOICES, TRAITS } from "./order.js";

export const e = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const BASE_CSS = `
:root { --bg:#eef1f1; --paper:#ffffff; --ink:#1b2628; --muted:#5b6b6e; --line:#d3dbdc;
  --teal:#1d6f6c; --teal-soft:#dcecea; --flamingo:#c8466b; --sand:#f4ead8; --warn:#9a5a00;
  --body:"Overpass", "Segoe UI", system-ui, sans-serif; --mono:"Overpass Mono", ui-monospace, Menlo, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --bg:#111819; --paper:#182224; --ink:#e4ecec; --muted:#9aaeb0; --line:#2c3a3c;
  --teal:#5fc0b9; --teal-soft:#1d3634; --flamingo:#ef7f9d; --sand:#2a2519; --warn:#f0b35a; color-scheme:dark; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--ink); font-family:var(--body); font-size:16px; line-height:1.55; }
.wrap { max-width:1080px; margin:0 auto; padding:28px max(16px, env(safe-area-inset-right, 0px)) 64px max(16px, env(safe-area-inset-left, 0px)); display:grid; gap:28px; }
a { color:var(--teal); }
a:focus-visible, .btn:focus-visible, button:focus-visible { outline:3px solid var(--flamingo); outline-offset:2px; }
.muted { color:var(--muted); }
.num { font-family:var(--mono); font-variant-numeric:tabular-nums; }
.eyebrow { font-family:var(--mono); font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--flamingo); }
h1, h3, h4 { text-wrap:balance; margin:0; }
h1 { font-size:clamp(30px, 6vw, 46px); font-weight:800; line-height:1.05; }
h2 { font-size:20px; margin:0; }
h3 { font-size:26px; font-weight:800; }
h4 { font-size:19px; font-weight:800; line-height:1.2; }
h5 { font-size:12px; font-family:var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:0 0 8px; }
.note { background:var(--sand); border-radius:10px; padding:12px 16px; font-size:14px; max-width:80ch; margin:0; }
.btn, button { display:inline-block; font:inherit; font-size:15px; font-weight:600; text-decoration:none; padding:9px 14px; border-radius:8px; background:var(--teal); color:var(--paper); border:0; cursor:pointer; }
.btn.ghost, button.ghost { background:transparent; color:var(--teal); border:1px solid var(--teal); }
`;

export function shell(title, body, extraCss = "", head = "") {
  return new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${e(title)}</title>${head}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Overpass:wght@400;600;800&family=Overpass+Mono:wght@400;600&display=swap">
<style>${BASE_CSS}${extraCss}</style></head>
<body>${body}</body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}

const FORM_CSS = `
form { display:grid; gap:20px; }
fieldset { border:1px solid var(--line); border-radius:12px; background:var(--paper); padding:16px; margin:0; display:grid; gap:12px; min-width:0; }
legend { font-weight:800; padding:0 6px; }
label { display:grid; gap:4px; font-size:14px; font-weight:600; }
label small, .hint { font-weight:400; color:var(--muted); font-size:13px; }
input, select, textarea { font:inherit; font-size:16px; padding:9px 10px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); width:100%; }
textarea { min-height:70px; }
.row { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; }
.stop[hidden] { display:none; }
.traits { display:grid; gap:6px; }
.traits div { display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center; font-size:15px; }
.traits select { width:auto; }
.errors { background:var(--sand); color:var(--warn); border-radius:10px; padding:12px 16px; }
.errors ul { margin:0; padding-left:20px; }
`;

function stopFields(i) {
  const opts = DRIVE_CHOICES.map(m => `<option value="${m}"${m === 25 ? " selected" : ""}>Within ${m} minutes</option>`).join("");
  return `<fieldset class="stop" id="stop${i}"${i > 1 ? " hidden" : ""}><legend>Stop ${i}</legend>
  <label>Town or area<input name="stop${i}_town" autocomplete="off" placeholder="Wimberley, TX"></label>
  <div class="row">
    <label>Arrive<input type="date" name="stop${i}_arrive"></label>
    <label>Nights<input type="number" name="stop${i}_nights" min="1" max="180" inputmode="numeric"></label>
  </div>
  <label>How close to town?<select name="stop${i}_drive">${opts}</select><small>Drive time from the town center. A wider area finds more parks.</small></label>
  <label>Budget for this stop<input name="stop${i}_budget" placeholder="$700 to $900, or about $40 a night"></label>
</fieldset>`;
}

export function orderPage(errors = [], url = "") {
  const traits = TRAITS.map(([k, label]) => `<div><span>${e(label)}</span><select name="want_${k}" aria-label="${e(label)}">
    <option value="no">Don't care</option><option value="nice">Nice to have</option><option value="must">Must have</option></select></div>`).join("");
  const stops = Array.from({ length: MAX_STOPS }, (_, i) => stopFields(i + 1)).join("");
  const errHtml = errors.length ? `<div class="errors" role="alert"><b>Please fix these:</b><ul>${errors.map(m => `<li>${e(m)}</li>`).join("")}</ul></div>` : "";
  return shell("RigKit Trip Planner", `<div class="wrap" style="max-width:720px">
  <header style="display:grid;gap:10px">
    <div class="eyebrow">RigKit trip planner · beta</div>
    <h1>Plan an RV trip</h1>
    <p style="margin:0">Tell us your rig and your stops. We search every RV park and campground around each stop, read the parks' own websites for prices, pad sizes and rules, and send you three picks per stop with what we left out and why.</p>
    <p class="note">Nothing gets booked and no park is contacted. A plan takes about an hour to build. Keep the link you get next; it shows your plan when it's ready.</p>
  </header>
  ${errHtml}
  <form method="post" action="/orders">
    <fieldset><legend>Beta access</legend>
      <label>Access code<input name="code" required autocomplete="off" autocapitalize="characters"></label>
      <label>Email for your plan link <small>(optional)</small><input type="email" name="email" autocomplete="email"></label>
    </fieldset>
    <fieldset><legend>You and your rig</legend>
      <label>Rig<input name="rig" placeholder="2023 Airstream Flying Cloud travel trailer, 28 ft"></label>
      <label>Tow vehicle and hitched length<input name="tow" placeholder="2024 GMC 2500HD, about 50 ft hitched"></label>
      <label>Slide-outs or size limits<input name="limits" placeholder="No slides, 10 ft tall"></label>
      <label>People and pets<input name="people" placeholder="2 adults, 1 small dog (mini schnauzer)"></label>
      <div class="row">
        <label>Hookups<select name="hookups"><option value="full">Full hookups</option><option value="we">Water and electric</option><option value="none">None, boondocking is fine</option></select></label>
        <label>Amps<select name="amps"><option value="30">30 amp</option><option value="50">50 amp</option><option value="">Either</option></select></label>
      </div>
      <label>Solar or generator<input name="power" placeholder="Solar plus a generator"></label>
      <label>Internet<input name="internet" placeholder="Starlink (needs open sky) plus a hotspot"></label>
      <label>Memberships<input name="memberships" placeholder="Passport America, Good Sam, Thousand Trails"></label>
    </fieldset>
    <fieldset><legend>Trip</legend>
      <label>Trip name<input name="trip_name" required placeholder="Texas Winter Trip"></label>
      <label>Whole-trip budget<input name="budget" placeholder="$2,800 to $3,600 for all 8 weeks"></label>
      <label>OK to spend more at one stop than another?<input name="budget_split" placeholder="Yes, more on the coast is fine"></label>
    </fieldset>
    ${stops}
    <div><button type="button" class="ghost" id="addstop">Add a stop</button></div>
    <fieldset><legend>What matters</legend>
      <div class="traits">${traits}</div>
      <label>What would you give up to save money or get a better spot?<textarea name="give_up"></textarea></label>
    </fieldset>
    <fieldset><legend>Travel days</legend>
      <label>Move days<input name="move_days" placeholder="Saturday or Sunday; I'd shift a day or two for a better park"></label>
      <label>Drive days<input name="drive_day" placeholder="Comfortable 300 miles, hard max 500"></label>
    </fieldset>
    <fieldset><legend>Anything else</legend>
      <label>The vibe you want, places you love or want to avoid<textarea name="notes"></textarea></label>
    </fieldset>
    <div><button type="submit">Build my plan</button></div>
  </form>
</div>
<script>
const add = document.getElementById("addstop");
const shown = () => [...document.querySelectorAll(".stop")].filter(s => !s.hidden || s.querySelector("input").value);
shown().forEach(s => s.hidden = false);
add.addEventListener("click", () => {
  const next = document.querySelector(".stop[hidden]");
  if (next) { next.hidden = false; next.querySelector("input").focus(); }
  if (!document.querySelector(".stop[hidden]")) add.hidden = true;
});
</script>`, FORM_CSS);
}

const STATUS_TEXT = {
  queued: "Your order is in. The planner is starting up.",
  running: "The planner is searching for parks and reading their websites. This usually takes about an hour.",
  failed: "Something went wrong building this plan.",
};

export function statusPage(o) {
  const refresh = o.status === "failed" ? "" : `<meta http-equiv="refresh" content="60">`;
  const started = new Date(o.created).toUTCString().replace(/:\d\d GMT$/, " UTC");
  const extra = o.status === "failed"
    ? `<p>${e(o.error || "The planner stopped before it finished.")}</p><p>Nothing was booked or sent. Reply to the person who gave you the access code and they'll take a look.</p>`
    : `<p class="muted">This page checks again every minute. You can close it and come back to the same link later${o.email ? "; we'll also email you when it's ready" : ""}.</p>`;
  return shell(`${o.order.trip_name} · RigKit`, `<div class="wrap" style="max-width:720px">
  <div class="eyebrow">RigKit trip plan</div>
  <h1>${e(o.order.trip_name)}</h1>
  <p class="note"><b>${e(STATUS_TEXT[o.status] || STATUS_TEXT.running)}</b></p>
  ${extra}
  <p class="muted" style="font-size:14px">Ordered ${e(started)} · ${o.order.stops.length} stop${o.order.stops.length > 1 ? "s" : ""}</p>
</div>`, "", refresh);
}
