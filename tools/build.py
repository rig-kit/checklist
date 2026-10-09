"""Builds the website from src/app.html (the same file is published as the preview artifact).

Usage: python3 tools/build.py [output folder]   (default: site/)
"""
import pathlib
import sys
from PIL import Image

root = pathlib.Path(__file__).resolve().parent.parent
app = (root / "src" / "app.html").read_text()
site = pathlib.Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / "site"
site.mkdir(exist_ok=True)

head = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="A free, phone-friendly travel day checklist for Airstream owners. Check off hitching, hookups, inside and outside items, and keep your own custom list.">
<meta name="theme-color" content="#eceff2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111519" media="(prefers-color-scheme: dark)">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Travel Day">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}img{max-width:100%}</style>
"""
# The title, font links and styles go in <head>; the body starts at the wrapper div.
body_start = app.index('<div class="wrap">')
html = head + app[:body_start] + "</head>\n<body>\n" + app[body_start:] + "\n</body>\n</html>\n"
(site / "index.html").write_text(html)

(site / "manifest.webmanifest").write_text("""{
  "name": "Travel Day Checklist",
  "short_name": "Travel Day",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0b6577",
  "theme_color": "#0b6577",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
""")

(site / "sw.js").write_text("""// Keeps the checklist working with no signal: pages load fresh when online, everything falls back to the saved copy offline.
const CACHE = "travel-day-v5";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Pages: try the network first so updates show right away; fall back to the saved copy offline.
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(hit => hit || caches.match("index.html"))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(cache => cache.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => { if (res.ok && new URL(e.request.url).origin === location.origin) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
""")

def icon(size, path):
    # Flamingo on retro teal, rendered once to src/icon-source.png (512px, full-bleed so iOS can round the corners).
    Image.open(root / "src" / "icon-source.png").convert("RGB").resize((size, size), Image.LANCZOS).save(site / path)

icon(192, "icon-192.png")
icon(512, "icon-512.png")
icon(180, "apple-touch-icon.png")
print("built", sorted(p.name for p in site.iterdir()))
