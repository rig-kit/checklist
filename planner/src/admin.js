// The owner's private list of parks that could use a new website. Open it as /admin#YOUR-KEY (or type the
// key in). The key stays after the #, so only the page's own requests carry it. Never linked from any page.
import { shell } from "./pages.js";
import { KINDS } from "./leads.js";

const CSS = `
[hidden] { display:none !important; }
.wrap { max-width:860px; gap:18px; }
.keyform { display:flex; gap:8px; flex-wrap:wrap; }
.keyform input { flex:1 1 220px; font:inherit; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); text-transform:uppercase; }
.filters { display:flex; flex-wrap:wrap; gap:8px; }
.filters button { background:var(--paper); color:var(--teal); border:1px solid var(--teal); border-radius:999px; padding:6px 12px; font-size:14px; }
.filters button[aria-pressed="true"] { background:var(--teal); color:var(--paper); }
.lead { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:14px 16px; display:grid; gap:8px; }
.lead h4 { font-size:18px; }
.lead .meta { font-size:14px; color:var(--muted); }
.lead ul { margin:0; padding-left:20px; font-size:15px; }
.tag { display:inline-block; font-size:12px; font-weight:600; padding:2px 8px; border-radius:999px; margin-right:6px; background:var(--teal-soft); color:var(--teal); }
.tag.no_site { background:var(--sand); color:var(--warn); }
.tag.dated { background:var(--flamingo); color:var(--paper); }
.contact { display:flex; flex-wrap:wrap; gap:6px 16px; font-size:15px; overflow-wrap:anywhere; }
.row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
.row select, .row input { font:inherit; font-size:15px; padding:6px 8px; border:1px solid var(--line); border-radius:8px; background:var(--bg); color:var(--ink); }
.row input { flex:1 1 200px; }
.err { color:var(--warn); }
`;

export function adminPage() {
  return shell("Website Leads", `
<div class="wrap">
  <div>
    <div class="eyebrow">Private · only you</div>
    <h1>Website leads</h1>
    <p class="muted" id="sub">Parks the trip planner came across that could use a new website. Parks never see this.</p>
  </div>
  <form class="keyform" id="keyForm" hidden>
    <input id="key" placeholder="Your admin key" autocomplete="off" autocapitalize="characters" spellcheck="false">
    <button>Show leads</button>
  </form>
  <p class="err" id="msg" hidden></p>
  <div class="filters" id="filters" hidden></div>
  <div id="list" style="display:grid;gap:12px"></div>
  <p class="note">Names, addresses and Google Maps links load live from Google and aren't kept. "Seen in" is the plan that found the park. Website-look checks come from the site's code (not set up for phones, old copyright year, no https), not from looking at it, so open the site before you reach out.</p>
</div>
<script>
const KINDS = ${JSON.stringify(KINDS)};
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
let key = decodeURIComponent(location.hash.slice(1)) || (() => { try { return localStorage.getItem("rk-admin") || ""; } catch { return ""; } })();
let leads = [], filter = "all";
async function load() {
  if (!key) { $("keyForm").hidden = false; return; }
  const r = await fetch("/admin/leads", { headers: { "X-Admin-Key": key } });
  if (r.status === 401) { $("msg").textContent = "That key didn't work."; $("msg").hidden = false; $("keyForm").hidden = false; return; }
  if (!r.ok) { $("msg").textContent = "Couldn't load the leads. Try again in a minute."; $("msg").hidden = false; return; }
  try { localStorage.setItem("rk-admin", key); } catch {}
  history.replaceState(null, "", "/admin");
  $("keyForm").hidden = true; $("msg").hidden = true;
  leads = (await r.json()).leads;
  draw();
}
function draw() {
  const counts = { all: leads.length };
  for (const l of leads) for (const k of Object.keys(l.reasons)) counts[k] = (counts[k] || 0) + 1;
  const opts = [["all", "All"], ...Object.entries(KINDS), ["contacted", "Contacted"]];
  counts.contacted = leads.filter(l => l.status === "contacted").length;
  $("filters").hidden = !leads.length;
  $("filters").innerHTML = opts.map(([k, label]) => '<button data-f="' + k + '" aria-pressed="' + (filter === k) + '">' + esc(label) + " (" + (counts[k] || 0) + ")</button>").join("");
  const shown = leads.filter(l => filter === "all" || l.reasons[filter] || (filter === "contacted" && l.status === "contacted"));
  $("sub").textContent = leads.length ? leads.length + " parks so far. Strongest leads first." : "No leads yet. They appear after the next trip plan finishes.";
  $("list").innerHTML = shown.map(l => {
    const g = l.google || {};
    const name = l.name || (g.displayName && g.displayName.text) || "Unnamed park";
    const site = l.website || g.websiteUri;
    const phone = l.phone || g.nationalPhoneNumber;
    const seen = l.seen.map(s => esc(s.trip || "a plan") + (s.stop ? " · " + esc(s.stop) : "") + " (" + esc(s.date) + ")").join(", ");
    return '<div class="lead"><div>' + Object.keys(l.reasons).map(k => '<span class="tag ' + k + '">' + esc(KINDS[k]) + "</span>").join("") + "</div>" +
      "<h4>" + esc(name) + "</h4>" + (g.formattedAddress ? '<div class="meta">' + esc(g.formattedAddress) + "</div>" : "") +
      "<ul>" + Object.entries(l.reasons).map(([k, w]) => "<li><b>" + esc(KINDS[k]) + ":</b> " + esc(w.join("; ")) + "</li>").join("") + "</ul>" +
      '<div class="contact">' + (site ? '<a href="' + esc(site) + '" target="_blank" rel="noopener noreferrer">Website</a>' : "") +
      (phone ? '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, "")) + '">' + esc(phone) + "</a>" : "") +
      (l.email ? '<a href="mailto:' + esc(l.email) + '">' + esc(l.email) + "</a>" : "") +
      (g.googleMapsUri ? '<a href="' + esc(g.googleMapsUri) + '" target="_blank" rel="noopener noreferrer">Google Maps</a>' : "") + "</div>" +
      (l.booking_system ? '<div class="meta">Books through ' + esc(l.booking_system) + " (may offer its own website)</div>" : "") +
      '<div class="meta">Seen in ' + seen + "</div>" +
      '<div class="row"><select data-id="' + esc(l.place_id) + '" data-k="status">' +
      [["new", "New"], ["contacted", "Contacted"], ["interested", "Interested"], ["not_a_fit", "Not a fit"]].map(([v, t]) => '<option value="' + v + '"' + (l.status === v ? " selected" : "") + ">" + t + "</option>").join("") +
      '</select><input data-id="' + esc(l.place_id) + '" data-k="note" placeholder="Your note" value="' + esc(l.note) + '" maxlength="300"></div></div>';
  }).join("");
}
async function save(id, patch) {
  const r = await fetch("/admin/leads/" + encodeURIComponent(id), { method: "POST", headers: { "X-Admin-Key": key, "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  if (r.ok) Object.assign(leads.find(l => l.place_id === id), patch);
}
$("keyForm").onsubmit = ev => { ev.preventDefault(); key = $("key").value.trim(); load(); };
$("filters").onclick = ev => { const b = ev.target.closest("button"); if (b) { filter = b.dataset.f; draw(); } };
$("list").onchange = ev => { const t = ev.target; if (t.dataset.id) save(t.dataset.id, { [t.dataset.k]: t.value }).then(() => t.dataset.k === "status" && draw()); };
load();
</script>`, CSS, `<meta name="robots" content="noindex, nofollow">`);
}
