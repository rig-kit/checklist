// The plan page: the agent's picks (stored) plus Google ratings, reviews and photos (fetched live, credited).
import { e, shell } from "./pages.js";

const TAG = { fits: ["Fits budget", "ok"], over: ["Over budget", "warn"], unknown: ["Price unknown", "unk"] };
const money = n => `$${Math.round(n).toLocaleString("en-US")}`;

function excerpt(t, n = 170) {
  t = String(t).replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const m = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
  return m > 60 ? cut.slice(0, m + 1) : cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

function reviewQuote(rv, g) {
  const a = rv.authorAttribution || {};
  return `<blockquote>“${e(excerpt(rv.text.text))}” <span class="attr">· <a href="${e(a.uri || g.googleMapsUri)}" target="_blank" rel="noopener">${e(a.displayName || "Google user")}</a>, ${e(rv.relativePublishTimeDescription || "")} on Google${rv.rating ? `, ${rv.rating} ★` : ""}</span></blockquote>`;
}

function card(pk, g, photos) {
  g = g || {};
  const [tag, cls] = TAG[pk.tag] || TAG.unknown;
  const rating = g.rating
    ? `<span class="stars">${e(g.rating)}</span> <span class="muted">from ${e((g.userRatingCount || 0).toLocaleString("en-US"))} Google reviews</span>`
    : `<span class="muted">No Google rating</span>`;
  let drive = "";
  if (pk.drive_min != null) drive = pk.drive_est ? `About ${e(pk.drive_min)} min from town (estimated from distance)` : `${e(pk.drive_min)} min drive (${e(pk.drive_mi)} mi) from town`;

  const reviews = (g.reviews || []).filter(r => r.text && r.text.text);
  const good = reviews.find(r => (r.rating || 5) >= 4);
  const low = reviews.filter(r => (r.rating || 5) <= 3).sort((a, b) => a.rating - b.rating)[0];
  let says = "";
  if (g.reviewSummary && g.reviewSummary.text) {
    says += `<p class="gsum">“${e(g.reviewSummary.text.text)}” <span class="attr">${e((g.reviewSummary.disclosureText || {}).text || "Summarized with Gemini")}, from Google reviews</span></p>`;
  }
  if (good) says += reviewQuote(good, g);
  if (!says) says = `<span class="muted">No Google reviews to show.</span>`;
  let watch = pk.watch ? `<p class="site">${e(pk.watch)} <span class="attr">From the park's website.</span></p>` : "";
  if (low) watch += reviewQuote(low, g);
  if (!watch) watch = `<span class="muted">Nothing flagged on the park's site or in Google's recent reviews.</span>`;

  const pics = photos.length ? `<div class="pics">${photos.map(p => `<figure><img src="${e(p.src)}" alt="Photo of ${e(pk.park)}" loading="lazy" width="600" height="400"><figcaption>Photo: ${p.authors}</figcaption></figure>`).join("")}</div>` : "";
  const links = [];
  if (g.googleMapsUri) links.push(`<a class="btn" href="${e(g.googleMapsUri)}" target="_blank" rel="noopener">More photos on Google Maps</a>`);
  if (pk.website) links.push(`<a class="btn ghost" href="${e(pk.website)}" target="_blank" rel="noopener">Park website</a>`);
  return `
<article class="card">
  ${pics}
  <div class="slot">${e(pk.slot)}</div>
  <h4>${e(pk.park)}</h4>
  <div class="meta">${rating}</div>
  <div class="meta muted">${drive}</div>
  <div class="cost"><span class="tag ${cls}">${tag}</span> ${e(pk.cost)}</div>
  <dl>
    <dt>Pad and fit</dt><dd>${e(pk.pad)}</dd>
    <dt>Why it's here</dt><dd>${e(pk.why)}</dd>
    <dt>Guests say</dt><dd>${says}</dd>
    <dt>Watch for</dt><dd>${watch}</dd>
    <dt>Ask before booking</dt><dd><ul>${(pk.confirm || []).map(c => `<li>${e(c)}</li>`).join("")}</ul></dd>
  </dl>
  ${pk.phone ? `<div class="phone">Phone <a class="num" href="tel:${e(String(pk.phone).replace(/[^\d+]/g, ""))}">${e(pk.phone)}</a></div>` : ""}
  <div class="links">${links.join("")}</div>
</article>`;
}

function stopHtml(i, st, cards) {
  const c = st.counts || {};
  const left = (st.left || []).map(([n, code, d]) => `<tr><td>${e(n)}</td><td><span class="code">${e(code)}</span></td><td>${e(d)}</td></tr>`).join("");
  const calls = (st.calllist || []).length
    ? `<h5>Call list (websites we couldn't read)</h5><ul class="calls">${st.calllist.map(([n, ph, w]) => `<li><b>${e(n)}</b> <span class="num">${e(ph || "no phone listed")}</span> <span class="muted">· ${e(w)}</span></li>`).join("")}</ul>`
    : "";
  return `
<section class="stop" id="stop${i + 1}">
  <header class="stophead">
    <div class="milepost">Stop ${i + 1}</div>
    <h3>${e(st.name)}</h3>
    <div class="facts"><span>${e(st.dates)}</span><span>${e(st.nights)} nights</span><span>Budget share ${e(st.budget)}</span>${st.drive_in ? `<span>${e(st.drive_in)}</span>` : ""}</div>
  </header>
  ${(st.travel || []).length ? `<div class="travel"><h5>Arrival day</h5><ul>${st.travel.map(t => `<li>${e(t)}</li>`).join("")}</ul></div>` : ""}
  <div class="cards">${cards}</div>
  <div class="coverage">Google found <b>${e(c.found ?? "?")}</b> places in this area. We cut <b>${e(c.cut ?? "?")}</b> as not a fit (mobile home parks, day-use parks, cabins only, too far from town, or closed). We checked <b>${e(c.checked ?? "?")}</b> on their own websites. <b>${e(c.not_checked ?? "?")}</b> passed the filters but weren't checked this round.</div>
  ${left ? `<h5>Checked and left out</h5><div class="tablewrap"><table><thead><tr><th>Park</th><th>Reason</th><th>Detail</th></tr></thead><tbody>${left}</tbody></table></div>` : ""}
  ${calls}
</section>`;
}

// cost: { claude_usd, google_usd } list-price figures for this plan.
export async function renderPlan(plan, details, photoUrl, cost, built) {
  const trip = plan.trip || {};
  const stops = plan.stops || [];
  const stopHtmls = [];
  for (const [i, st] of stops.entries()) {
    const cards = [];
    for (const pk of st.picks || []) {
      const g = details[pk.park_id];
      const photos = [];
      for (const p of ((g && g.photos) || []).slice(0, 2)) {
        const authors = (p.authorAttributions || []).map(a => a.uri ? `<a href="${e(a.uri)}" target="_blank" rel="noopener">${e(a.displayName)}</a>` : e(a.displayName)).join(", ") || "Google Maps user";
        photos.push({ src: await photoUrl(p.name, 600), authors });
      }
      cards.push(card(pk, g, photos));
    }
    stopHtmls.push(stopHtml(i, st, cards.join("")));
  }

  const slots = (stops[0] && stops[0].picks || []).map(p => p.slot);
  const rows = slots.map((slot, idx) => {
    let lo = 0, hi = 0, unk = false;
    for (const st of stops) {
      const pk = (st.picks || [])[idx];
      if (!pk || pk.low == null) { unk = true; continue; }
      lo += pk.low; hi += pk.high ?? pk.low;
    }
    return `<tr><td>${e(slot)} picks</td><td class="num">${money(lo)} to ${money(hi)}${unk ? " + stops with prices unknown" : ""}</td></tr>`;
  }).join("");
  const route = stops.map(s => `<li><span class="dot"></span><b>${e(s.name)}</b><span class="muted">${e(s.dates)} · ${e(s.nights)} nights</span></li>`).join("");
  const costRows = [
    cost.claude_usd != null && ["Claude (planning, reading park sites) and run time", `$${cost.claude_usd.toFixed(2)}`],
    cost.google_usd != null && ["Google Maps searches and drive times", `$${cost.google_usd.toFixed(2)}`],
  ].filter(Boolean);
  const costHtml = costRows.length
    ? `<div><h5>What this plan cost to make</h5><div class="tablewrap"><table class="cost-t"><tbody>${costRows.map(([a, b]) => `<tr><td>${e(a)}</td><td class="num">${e(b)}</td></tr>`).join("")}</tbody></table><p class="costnote">At list prices, before Google's free monthly allowance.</p></div></div>`
    : "";

  return shell(`${trip.title || "Trip plan"} · RigKit`, `<div class="wrap">
  <header class="hero">
    <div class="eyebrow">RigKit trip plan · built ${e(built)}</div>
    <h1>${e(trip.title)}</h1>
    <p><b>${e(trip.dates)}</b> · ${e(trip.rig)}</p>
    <p class="note">Nothing here is booked, and no park has been emailed or called. Prices come from each park's own website${trip.read_date ? `, read ${e(trip.read_date)}` : ""}. Availability for your dates is <b>unknown</b> until you or the park confirms it. ${e(trip.electric_note || "")}</p>
  </header>
  <ol class="route">${route}</ol>
  <div class="summary">
    <div><h5>Trip totals (estimates, including electric)</h5><div class="tablewrap"><table><tbody>${rows}</tbody></table></div>
    <p class="muted" style="font-size:14px;margin:8px 0 0">Your budget is ${e(trip.budget)}. You can mix picks across stops.</p></div>
    ${costHtml}
  </div>
  ${stopHtmls.join("")}
  <footer>
    <div>Ratings, review summaries, reviews and photos are from Google Maps, credited to their authors, and load fresh each time you open this page. Review summaries are labeled by Google.</div>
    <div>Drive times are Google's driving estimates from the center of each stop's town, unless marked as estimated from distance. Drives between stops are our estimates.</div>
  </footer>
</div>`, PLAN_CSS);
}

const PLAN_CSS = `
.hero { display:grid; gap:10px; }
.hero p { margin:0; max-width:68ch; }
.route { list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); border-top:3px solid var(--teal); }
.route li { position:relative; padding:16px 12px 0 0; display:grid; gap:2px; }
.route .dot { position:absolute; top:-9px; left:0; width:15px; height:15px; border-radius:50%; background:var(--paper); border:3px solid var(--teal); }
.summary { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; }
.summary > div { min-width:0; }
table { border-collapse:collapse; width:100%; font-size:14px; }
th, td { text-align:left; vertical-align:top; padding:8px 10px; border-bottom:1px solid var(--line); }
th { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); font-weight:600; }
.tablewrap { overflow-x:auto; background:var(--paper); border-radius:10px; border:1px solid var(--line); }
.tablewrap table td:first-child { font-weight:600; min-width:150px; }
.code { font-family:var(--mono); font-size:12px; white-space:nowrap; color:var(--teal); }
.stop { display:grid; gap:16px; padding-top:8px; border-top:1px dashed var(--line); }
.stophead { display:grid; gap:4px; }
.milepost { display:inline-block; justify-self:start; font-family:var(--mono); font-size:12px; font-weight:600; background:var(--teal); color:var(--paper); padding:2px 8px; border-radius:4px; }
.facts { display:flex; flex-wrap:wrap; gap:6px 16px; color:var(--muted); font-size:14px; }
.travel ul, .calls { margin:0; padding-left:20px; display:grid; gap:4px; font-size:15px; max-width:85ch; }
.cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(290px, 1fr)); gap:16px; align-items:start; }
.card { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:18px; display:grid; gap:8px; min-width:0; }
.pics { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:-6px -6px 4px; }
.pics figure { margin:0; min-width:0; }
.pics img { width:100%; height:auto; aspect-ratio:3/2; object-fit:cover; border-radius:8px; display:block; background:var(--teal-soft); }
.pics figcaption { font-size:11px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.slot { font-family:var(--mono); font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:var(--flamingo); font-weight:600; }
.meta { font-size:14px; }
.stars { font-family:var(--mono); font-weight:600; }
.stars::after { content:" ★"; color:var(--flamingo); }
.cost { font-size:15px; font-weight:600; padding:8px 0; border-block:1px solid var(--line); }
.tag { font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; padding:2px 6px; border-radius:4px; margin-right:4px; white-space:nowrap; }
.tag.ok { background:var(--teal-soft); color:var(--teal); }
.tag.unk, .tag.warn { background:var(--sand); color:var(--warn); }
dl { margin:0; display:grid; gap:2px; font-size:14px; }
dt { font-family:var(--mono); font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin-top:8px; }
dd { margin:0; }
dd ul { margin:0; padding-left:18px; }
.gsum, .site { margin:0 0 6px; }
blockquote { margin:0 0 6px; padding-left:10px; border-left:3px solid var(--teal-soft); font-style:italic; }
.attr { font-style:normal; font-size:12px; color:var(--muted); }
.phone { font-size:14px; color:var(--muted); }
.links { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; }
.coverage { font-size:14px; color:var(--muted); max-width:85ch; }
.cost-t td:last-child { white-space:nowrap; text-align:right; }
.costnote { margin:0; padding:10px; font-size:13px; color:var(--muted); }
footer { font-size:13px; color:var(--muted); display:grid; gap:6px; max-width:85ch; }
@media (max-width:640px) { .route { grid-template-columns:1fr; border-top:0; border-left:3px solid var(--teal); gap:14px; padding-left:18px; } .route li { padding:0; } .route .dot { top:4px; left:-28px; } }
`;
