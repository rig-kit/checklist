"""Builds the website from src/app.html (the same file is published as the preview artifact).

Usage: python3 tools/build.py [output folder]   (default: site/)
"""
import pathlib
import sys
from PIL import Image, ImageDraw

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
  "background_color": "#eceff2",
  "theme_color": "#0c5a6b",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
""")

(site / "sw.js").write_text("""// Keeps the checklist working with no signal: serve from cache, refresh in the background.
const CACHE = "travel-day-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.open(CACHE).then(cache => cache.match(e.request).then(hit => {
    const net = fetch(e.request).then(res => { if (res.ok && new URL(e.request.url).origin === location.origin) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
""")

def icon(size, path):
    s = size
    img = Image.new("RGB", (s, s), (12, 90, 107))
    d = ImageDraw.Draw(img)
    # Aluminum trailer silhouette with a check mark.
    m = s * 0.16
    d.rounded_rectangle([m, s * 0.30, s - m, s * 0.68], radius=int(s * 0.17), fill=(226, 231, 236))
    d.ellipse([s * 0.30, s * 0.60, s * 0.44, s * 0.74], fill=(26, 36, 48))
    d.line([s - m, s * 0.62, s * 0.92, s * 0.62], fill=(226, 231, 236), width=max(2, int(s * 0.03)))
    w = max(3, int(s * 0.06))
    d.line([s * 0.40, s * 0.47, s * 0.48, s * 0.55, s * 0.64, s * 0.39], fill=(35, 117, 74), width=w, joint="curve")
    img.save(site / path)

icon(192, "icon-192.png")
icon(512, "icon-512.png")
icon(180, "apple-touch-icon.png")
print("built", sorted(p.name for p in site.iterdir()))
