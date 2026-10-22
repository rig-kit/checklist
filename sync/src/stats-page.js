// The owner's private usage page, served at /stats. Open it as /stats#YOUR-KEY (or type the key in).
export const STATS_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Checklist Usage</title>
<style>
  :root { --bg: #f4f1ea; --card: #fff; --ink: #1e2b2d; --muted: #5d6b6d; --teal: #1f7f7a; --pink: #e0567f; --line: #dfe6e5; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #131a1b; --card: #1c2526; --ink: #eef3f2; --muted: #a3b2b1; --teal: #5cc7bf; --pink: #f08aa8; --line: #2c3a3b; }
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; background: var(--bg); color: var(--ink); font: 17px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1.1rem; margin: 28px 0 10px; }
  .sub { color: var(--muted); margin: 0 0 18px; }
  .tiles { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  @media (min-width: 600px) { .tiles { grid-template-columns: repeat(4, 1fr); } }
  .tile { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; }
  .tile b { display: block; font-size: 1.9rem; line-height: 1.1; color: var(--teal); font-variant-numeric: tabular-nums; }
  .tile span { color: var(--muted); font-size: .9rem; }
  .tile.pink b { color: var(--pink); }
  .wrap { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 14px; }
  table { border-collapse: collapse; width: 100%; font-size: .92rem; font-variant-numeric: tabular-nums; }
  th, td { padding: 8px 10px; text-align: right; white-space: nowrap; border-bottom: 1px solid var(--line); }
  th:first-child, td:first-child { text-align: left; }
  th { color: var(--muted); font-weight: 600; font-size: .8rem; }
  tr:last-child td { border-bottom: 0; }
  form { display: flex; gap: 8px; flex-wrap: wrap; }
  input { flex: 1 1 220px; font: inherit; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--card); color: var(--ink); text-transform: uppercase; }
  button { font: inherit; padding: 10px 16px; border-radius: 10px; border: 0; background: var(--teal); color: #fff; font-weight: 600; }
  .msg { color: var(--pink); }
  .notes { color: var(--muted); font-size: .9rem; }
  .notes li { margin-bottom: 6px; }
</style>
</head>
<body>
<main>
  <h1>Travel Day Checklist usage</h1>
  <p class="sub" id="sub">Private. Anonymous counts only.</p>
  <form id="keyForm" hidden>
    <input id="key" placeholder="Your stats key" autocomplete="off" autocapitalize="characters" spellcheck="false">
    <button>Show stats</button>
  </form>
  <p class="msg" id="msg" hidden></p>
  <div id="out" hidden>
    <div class="tiles">
      <div class="tile"><b id="tPhones">0</b><span>Phones, all time</span></div>
      <div class="tile"><b id="tMonth">0</b><span>Phones this month</span></div>
      <div class="tile"><b id="tStarts">0</b><span>Travel days started</span></div>
      <div class="tile pink"><b id="tShares">0</b><span>Lists shared</span></div>
    </div>
    <h2>By month</h2>
    <div class="wrap"><table id="months"></table></div>
    <h2>Last 14 days</h2>
    <div class="wrap"><table id="days"></table></div>
    <h2>How these are counted</h2>
    <ul class="notes">
      <li><b>Phones</b> counts each phone or browser the first time it opens the checklist. Safari and the home screen icon keep separate storage on iPhone, so one person can count twice, and clearing website data counts a phone again.</li>
      <li><b>Phones this month / that day</b> counts each phone once per month or day it was opened. Days and months are in UTC.</li>
      <li><b>Opens</b> counts every time the checklist is opened or reloaded.</li>
      <li><b>Started</b> counts taps on "Start a new checklist" (first visit) and "Start a new travel day". <b>Finished</b> counts a phone seeing every item checked (each phone on a shared list counts).</li>
      <li><b>Shared</b> counts new share codes made. <b>Joined</b> counts phones joining a partner's list.</li>
      <li>Counting began on October 22, 2026 (earlier test use was cleared). Nothing identifies a person or phone: no IDs, cookies, IP addresses or list contents are kept.</li>
    </ul>
  </div>
</main>
<script>
(function () {
  var COLS = [["monthPhone", "Phones"], ["phone", "New phones"], ["open", "Opens"], ["start", "Started"], ["done", "Finished"], ["share", "Shared"], ["join", "Joined"]];
  var form = document.getElementById("keyForm"), msg = document.getElementById("msg");
  function show(text) { msg.textContent = text; msg.hidden = !text; }
  function num(n) { return (n || 0).toLocaleString(); }

  function table(el, rows, first, cols) {
    var h = "<tr><th>" + first + "</th>" + cols.map(function (c) { return "<th>" + c[1] + "</th>"; }).join("") + "</tr>";
    rows.forEach(function (r) {
      h += "<tr><td>" + r.label + "</td>" + cols.map(function (c) { return "<td>" + num(r[c[0]]) + "</td>"; }).join("") + "</tr>";
    });
    el.innerHTML = h;
  }

  function draw(rows) {
    var byDay = {}, byMonth = {}, total = {};
    rows.forEach(function (r) {
      (byDay[r.day] = byDay[r.day] || {})[r.name] = r.n;
      var m = r.day.slice(0, 7);
      byMonth[m] = byMonth[m] || {};
      byMonth[m][r.name] = (byMonth[m][r.name] || 0) + r.n;
      total[r.name] = (total[r.name] || 0) + r.n;
    });
    var now = new Date(), thisMonth = now.toISOString().slice(0, 7);
    document.getElementById("tPhones").textContent = num(total.phone);
    document.getElementById("tMonth").textContent = num((byMonth[thisMonth] || {}).monthPhone);
    document.getElementById("tStarts").textContent = num(total.start);
    document.getElementById("tShares").textContent = num(total.share);

    var months = Object.keys(byMonth).sort().reverse().map(function (m) {
      var r = Object.assign({}, byMonth[m]);
      r.label = new Date(m + "-15T12:00:00Z").toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
      return r;
    });
    if (!months.length) months = [{ label: "No data yet" }];
    table(document.getElementById("months"), months, "Month", COLS);

    var days = [];
    for (var i = 0; i < 14; i++) {
      var d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
      var r = Object.assign({}, byDay[d] || {});
      r.monthPhone = r.dayPhone;
      r.label = new Date(d + "T12:00:00Z").toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
      days.push(r);
    }
    table(document.getElementById("days"), days, "Day", COLS);
    document.getElementById("sub").textContent = "Private. Anonymous counts only. Updated " + now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) + ".";
    document.getElementById("out").hidden = false;
  }

  function load(key) {
    show("Loading…");
    fetch("/stats/data", { headers: { "X-Stats-Key": key }, cache: "no-store" })
      .then(function (r) {
        if (r.status === 401) throw new Error("That key didn't work. Check it and try again.");
        if (r.status === 429) throw new Error("Too many wrong keys from this connection. Try again in an hour.");
        if (!r.ok) throw new Error("Couldn't load the stats right now. Try again later.");
        return r.json();
      })
      .then(function (body) {
        show("");
        form.hidden = true;
        if (location.hash.slice(1) !== key) try { history.replaceState(null, "", "#" + key); } catch (e) {}
        draw(body.rows || []);
      }, function (e) { show(e.message); form.hidden = false; });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var k = document.getElementById("key").value.trim().toUpperCase();
    if (k) load(k);
  });
  var start = decodeURIComponent(location.hash.slice(1)).trim().toUpperCase();
  if (start) load(start); else form.hidden = false;
})();
</script>
</body>
</html>
`;
