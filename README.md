# Travel Day Checklist

A free, phone-friendly travel day checklist for Airstream owners: https://rig-kit.github.io/checklist/

- `src/app.html` is the source. The checklist items live in the `SECTIONS` array in its script.
- `python3 tools/build.py .` rebuilds the published files (index.html, manifest, service worker, icons) at the repository root.
- `sync/` is the optional sharing service (Cloudflare Worker) that lets two phones share one list. See `sync/README.md`.
