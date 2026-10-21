"""Fetch a park web page as plain text, honoring robots.txt. Usage: python3 -I getpage.py URL [maxchars]
Prints ROBOTS_BLOCKED or FETCH_ERROR lines on failure. Also lists same-site links at the end."""
import sys, re, html, urllib.request, urllib.robotparser, urllib.parse
UA = "RigKitPlannerBot/0.1 (+mailto:rigkit31@gmail.com)"
url = sys.argv[1].replace("http://", "https://", 1); maxc = int(sys.argv[2]) if len(sys.argv) > 2 else 12000
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
try:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        raw = r.read(3_000_000).decode("utf-8", "replace"); final = r.geturl()
except Exception as e:
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
print("URL:", final); print(t[:maxc])
print("\nSAME-SITE LINKS:"); print("\n".join(l for l in links if not re.search(r"\.(jpg|png|webp|css|js|svg|ico)(\?|$)", l))[:3000])
