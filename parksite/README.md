# Park website template

Builds a park's website from one data file (`parks/<slug>.json`). Python 3 standard library only.

```
python3 build.py parks/shady-oaks.json                # private mockup into dist/shady-oaks/
python3 build.py parks/shady-oaks.json --final        # live site; refuses to build until the basics are known
python3 -m unittest discover -s tests
```

- **Mockup mode:** unknown facts show a "Park to confirm" tag (grouped, not repeated), the page has a preview banner and `noindex`, and `needs.json` lists the gaps. Those gaps become the questions on the park's intake page.
- **Final mode:** unknown facts are left out and search markup is added.
- **Photos:** a mockup links to the photos on the park's own website and never copies them. For a live site, use originals the park supplies (`"file": "photos/x.jpg"` beside the data file).
- **Data file:** every fact comes from the park's own website; `source_notes` records where each came from. Never fill a fact from a review site or Google.
- One scrolling page with six sections (rates, long stays, rig fit, photos, find us); the Book button goes to the park's own booking page, or a "Request a stay" email when it has none.
