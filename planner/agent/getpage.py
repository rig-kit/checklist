"""Fetch a park web page as plain text, honoring robots.txt. Usage: python3 -I getpage.py URL [maxchars]
Prints ROBOTS_BLOCKED or FETCH_ERROR lines on failure. Also prints a SITE SIGNALS line (how modern the site
looks from its code) and lists same-site links at the end."""
import sys, re, json, html, datetime, urllib.request, urllib.robotparser, urllib.parse
UA = "RigKitPlannerBot/0.1 (+mailto:rigkit31@gmail.com)"
given = sys.argv[1]; url = given.replace("http://", "https://", 1); maxc = int(sys.argv[2]) if len(sys.argv) > 2 else 12000
u = urllib.parse.urlparse(url)
rp = urllib.robotparser.RobotFileParser()
try:
    req = urllib.request.Request(f"{u.scheme}://{u.netloc}/robots.txt", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as r:
        rp.parse(r.read().decode("utf-8", "replace").splitlines())
    if not rp.can_fetch(UA, url):
        print("ROBOTS_BLOCKED", url); sys.exit(0)
except Exception:
    pass  # no robots.txt -> allowed
def fetch(link):
    req = urllib.request.Request(link, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read(3_000_000).decode("utf-8", "replace"), r.geturl()
try:
    raw, final = fetch(url)
except Exception as e:
    try:  # some small parks' sites still have no https
        if not given.startswith("http://"): raise
        raw, final = fetch(given)
    except Exception:
        print("FETCH_ERROR", url, e); sys.exit(0)
links = sorted({urllib.parse.urljoin(final, h) for h in re.findall(r'href=["\']([^"\'#]+)', raw)
                if urllib.parse.urlparse(urllib.parse.urljoin(final, h)).netloc.endswith(u.netloc.replace("www.", ""))})
t = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw)
t = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d)>", "\n", t)
t = html.unescape(re.sub(r"<[^>]+>", " ", t))
t = re.sub(r"[ \t]+", " ", t)
seen = set(); keep = []
for line in t.splitlines():
    k = line.strip()
    if k and (k not in seen or len(k) > 60):
        seen.add(k); keep.append(k)
t = "\n".join(keep)
# Signs of an old site, read from the code (free: no extra requests). Text-only reading can't see the design.
years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\D{0,12}(?:(?:19|20)\d\d\s*[-–]\s*)?((?:19|20)\d\d)", raw, re.I)
         if 1995 <= int(y) <= datetime.date.today().year]
gen = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']{1,60})', raw, re.I)
sig = {"https": final.startswith("https://"),
       "mobile_viewport": bool(re.search(r'<meta[^>]+name=["\']viewport', raw, re.I)),
       "copyright_year": max(years) if years else None,
       "table_layout": len(re.findall(r"<table", raw, re.I)) >= 4 and not re.search(r"<(nav|header|section)\b", raw, re.I),
       "frames_or_flash": bool(re.search(r"<frameset|\.swf\b|<marquee|best viewed", raw, re.I)),
       "generator": gen.group(1) if gen else None}
print("URL:", final); print("SITE SIGNALS:", json.dumps(sig)); print(t[:maxc])
print("\nSAME-SITE LINKS:"); print("\n".join(l for l in links if not re.search(r"\.(jpg|png|webp|css|js|svg|ico)(\?|$)", l))[:3000])
