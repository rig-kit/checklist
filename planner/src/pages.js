// HTML for the order interview and the "your plan is being built" page. The plan page itself is in render.js.
import { TRAITS as TRAITS_UI } from "./interview.js";

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

const CHAT_CSS = `
[hidden] { display:none !important; }
body { height:100dvh; }
.chat { max-width:720px; margin:0 auto; height:100dvh; display:grid; grid-template-rows:auto 1fr auto; }
.top { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px max(16px, env(safe-area-inset-right, 0px)) 10px max(16px, env(safe-area-inset-left, 0px)); border-bottom:1px solid var(--line); }
.top b { font-size:17px; }
.linkbtn { background:none; border:0; color:var(--teal); padding:6px 0; font-size:14px; font-weight:600; }
.log { overflow-y:auto; padding:16px max(16px, env(safe-area-inset-right, 0px)) 8px max(16px, env(safe-area-inset-left, 0px)); display:flex; flex-direction:column; gap:12px; }
.msg { max-width:88%; padding:10px 14px; border-radius:16px; white-space:pre-wrap; overflow-wrap:anywhere; }
.msg.assistant { align-self:flex-start; background:var(--paper); border:1px solid var(--line); border-bottom-left-radius:4px; }
.msg.user { align-self:flex-end; background:var(--teal); color:var(--paper); border-bottom-right-radius:4px; }
.intro { font-size:14px; color:var(--muted); }
.chips { display:flex; flex-wrap:wrap; gap:8px; align-self:flex-start; }
.chips button { background:var(--paper); color:var(--teal); border:1px solid var(--teal); border-radius:999px; padding:7px 14px; font-size:15px; }
.panel { align-self:stretch; background:var(--paper); border:1px solid var(--line); border-radius:14px; padding:14px; display:grid; gap:10px; }
.trait { display:grid; gap:6px; }
.trait span { font-size:15px; font-weight:600; }
.seg { display:grid; grid-template-columns:repeat(3, 1fr); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.seg button { background:transparent; color:var(--ink); border-radius:0; padding:8px 4px; font-size:13px; font-weight:600; }
.seg button + button { border-left:1px solid var(--line); }
.seg button[aria-pressed="true"] { background:var(--teal); color:var(--paper); }
.summary h4 { font-size:17px; }
.summary ul { margin:0; padding-left:20px; display:grid; gap:4px; font-size:15px; }
.summary .row { display:flex; flex-wrap:wrap; gap:8px; }
.typing { align-self:flex-start; color:var(--muted); font-size:14px; }
.bar { border-top:1px solid var(--line); padding:10px max(16px, env(safe-area-inset-right, 0px)) max(10px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px)); display:grid; grid-template-columns:1fr auto auto; gap:8px; align-items:end; background:var(--bg); }
.bar textarea { font:inherit; font-size:16px; padding:10px 12px; border:1px solid var(--line); border-radius:20px; background:var(--paper); color:var(--ink); resize:none; max-height:140px; min-height:44px; width:100%; }
.bar button { height:44px; min-width:44px; border-radius:22px; padding:0 14px; }
#mic[aria-pressed="true"] { background:var(--flamingo); }
.gate { max-width:480px; margin:0 auto; padding:40px 16px; display:grid; gap:14px; }
.gate input { font:inherit; font-size:16px; padding:10px 12px; border:1px solid var(--line); border-radius:8px; background:var(--paper); color:var(--ink); }
.err { color:var(--warn); font-size:14px; }
`;

export function chatPage() {
  return shell("RigKit Trip Planner", `
<div class="gate" id="gate" hidden>
  <div class="eyebrow">RigKit trip planner · beta</div>
  <h1>Plan an RV trip</h1>
  <p style="margin:0">Tell us about your rig and where you're headed, by typing or talking. We search every RV park around each stop, read the parks' own websites, and send you three picks per stop with what we left out and why. Nothing gets booked.</p>
  <label for="code" style="font-weight:600">Beta access code</label>
  <input id="code" autocomplete="off" autocapitalize="characters">
  <div><button id="go">Start</button></div>
  <div class="err" id="gateerr" role="alert"></div>
</div>
<div class="chat" id="chat" hidden>
  <div class="top"><b>RigKit trip planner</b><button class="linkbtn" id="restart">Start over</button></div>
  <div class="log" id="log" aria-live="polite"></div>
  <form class="bar" id="bar">
    <textarea id="text" rows="1" placeholder="Type or tap the mic" aria-label="Your answer"></textarea>
    <button type="button" class="ghost" id="mic" aria-label="Talk" aria-pressed="false" hidden>🎤</button>
    <button type="submit" id="send" aria-label="Send">Send</button>
  </form>
</div>
<script>
const TRAITS = ${JSON.stringify(TRAITS_UI)};
const LEVELS = [["must", "Must have"], ["nice", "Nice to have"], ["no", "Don't care"]];
const K = { code: "rigkit-code", chat: "rigkit-chat", profile: "rigkit-profile" };
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
const $ = id => document.getElementById(id);
const log = $("log"), text = $("text");
let state = store.get(K.chat, null); // { id, messages: [{role, text, quick_replies, trait_picker, ready, summary}] }
let busy = false;

function newId() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(20)), b => abc[b % abc.length]).join("");
}
function el(tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }
function save() { store.set(K.chat, state); }

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { "Content-Type": "application/json", "X-Access-Code": store.get(K.code, ""), ...(opts.headers || {}) } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401) { store.del(K.code); showGate("That access code isn't right."); throw new Error("code"); }
  return body;
}

function render() {
  log.replaceChildren();
  const intro = el("p", "intro", "Answer by typing or tap the mic and talk. Your conversation is saved on this phone, so you can leave and come back.");
  log.append(intro);
  const msgs = state.messages;
  msgs.forEach((m, i) => {
    log.append(el("div", "msg " + m.role, m.text));
    const last = i === msgs.length - 1 && m.role === "assistant" && !busy;
    if (!last) return;
    if (m.ready && m.summary && m.summary.length) log.append(summaryCard(m.summary));
    if (m.trait_picker) log.append(traitPicker());
    if (m.quick_replies && m.quick_replies.length) {
      const chips = el("div", "chips");
      for (const q of m.quick_replies) { const b = el("button", "", q); b.type = "button"; b.onclick = () => send(q); chips.append(b); }
      log.append(chips);
    }
  });
  if (busy) log.append(el("div", "typing", "Thinking…"));
  log.scrollTop = log.scrollHeight;
}

function traitPicker() {
  const panel = el("div", "panel");
  const picks = {};
  for (const t of TRAITS) {
    const row = el("div", "trait"); row.append(el("span", "", t));
    const seg = el("div", "seg");
    for (const [v, label] of LEVELS) {
      const b = el("button", "", label); b.type = "button"; b.setAttribute("aria-pressed", "false");
      b.onclick = () => { picks[t] = v; seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); };
      seg.append(b);
    }
    row.append(seg); panel.append(row);
  }
  const done = el("button", "", "Done"); done.type = "button";
  done.onclick = () => {
    const by = l => TRAITS.filter(t => (picks[t] || "no") === l);
    const parts = [["Must have", by("must")], ["Nice to have", by("nice")], ["Don't care", by("no")]].filter(([, v]) => v.length).map(([k, v]) => k + ": " + v.join(", "));
    send(parts.join(". ") + ".");
  };
  panel.append(done);
  return panel;
}

function summaryCard(lines) {
  const card = el("div", "panel summary");
  card.append(el("h4", "", "Here's what I heard"));
  const ul = el("ul"); for (const l of lines) ul.append(el("li", "", l)); card.append(ul);
  const row = el("div", "row");
  const start = el("button", "", "Start my plan"); start.type = "button";
  const change = el("button", "ghost", "Change something"); change.type = "button";
  change.onclick = () => text.focus();
  start.onclick = async () => {
    start.disabled = true; start.textContent = "Starting…";
    try {
      const r = await api("/chat/" + state.id + "/start", { method: "POST", body: "{}" });
      if (r.plan_url) {
        if (r.profile) store.set(K.profile, r.profile);
        store.del(K.chat);
        location.href = r.plan_url;
        return;
      }
      card.append(el("div", "err", r.error || "Couldn't start. Try again."));
    } catch {}
    start.disabled = false; start.textContent = "Start my plan";
  };
  row.append(start, change); card.append(row);
  return card;
}

async function send(t) {
  t = (t || "").trim();
  if (!t || busy) return;
  state.messages.push({ role: "user", text: t });
  busy = true; save(); render();
  text.value = ""; grow();
  try {
    const first = state.messages.filter(m => m.role === "user").length === 1;
    const r = await api("/chat/" + state.id, { method: "POST", body: JSON.stringify({ text: t, profile: first ? store.get(K.profile, null) : null }) });
    if (r.reply) state.messages.push(r.reply);
    else if (r.plan_id) { location.href = "/p/" + r.plan_id; return; }
    else state.messages.push({ role: "assistant", text: r.error || "Sorry, something went wrong. Please send that again." });
  } catch (e) {
    if (e.message !== "code") state.messages.push({ role: "assistant", text: "I couldn't reach the planner. Check your connection and send that again." });
  }
  busy = false; save(); render();
}

function begin() {
  if (!state || !state.id) state = { id: newId(), messages: [] };
  $("gate").hidden = true; $("chat").hidden = false;
  render();
  if (!state.messages.length) send("Hi, I'd like to plan a trip.");
  else api("/chat/" + state.id).then(r => {
    // The server's copy wins if this phone missed a reply (for example, the page closed mid-answer).
    if (r && Array.isArray(r.messages) && r.messages.length > state.messages.filter(m => !m.local).length) { state.messages = r.messages; save(); render(); }
    if (r && r.plan_id) location.href = "/p/" + r.plan_id;
  }).catch(() => {});
}

function showGate(msg) {
  $("chat").hidden = true; $("gate").hidden = false;
  $("gateerr").textContent = msg || "";
  $("code").focus();
}
$("go").onclick = () => { const v = $("code").value.trim(); if (v) { store.set(K.code, v); begin(); } };
$("code").addEventListener("keydown", e => { if (e.key === "Enter") $("go").click(); });
$("restart").onclick = () => { if (confirm("Start a new conversation? This one will be cleared.")) { state = null; store.del(K.chat); begin(); } };
$("bar").addEventListener("submit", e => { e.preventDefault(); send(text.value); });
function grow() { text.style.height = "auto"; text.style.height = Math.min(text.scrollHeight, 140) + "px"; }
text.addEventListener("input", grow);
text.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); send(text.value); } });

// Talking uses the phone's own speech-to-text; the words land in the box so they can be checked before sending.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $("mic"); mic.hidden = false;
  let rec = null, base = "";
  mic.onclick = () => {
    if (rec) { rec.stop(); return; }
    rec = new SR(); rec.lang = "en-US"; rec.interimResults = true; rec.continuous = true;
    base = text.value ? text.value.trim() + " " : "";
    rec.onresult = ev => { let t = ""; for (const r of ev.results) t += r[0].transcript; text.value = base + t; grow(); };
    rec.onend = () => { rec = null; mic.setAttribute("aria-pressed", "false"); };
    rec.onerror = () => { rec = null; mic.setAttribute("aria-pressed", "false"); };
    mic.setAttribute("aria-pressed", "true"); rec.start();
  };
}

if (store.get(K.code, "")) begin(); else showGate();
</script>`, CHAT_CSS);
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
  <script>try { localStorage.removeItem("rigkit-chat"); } catch {}</script>
  <p class="muted" style="font-size:14px">Ordered ${e(started)} · ${o.order.stops.length} stop${o.order.stops.length > 1 ? "s" : ""}</p>
</div>`, "", refresh);
}
