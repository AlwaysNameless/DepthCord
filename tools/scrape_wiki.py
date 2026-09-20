"""Scrape every page from the Deepwoken Fandom wiki into local files."""

import json
import time
import sys
from pathlib import Path

import requests

API = "https://deepwoken.fandom.com/api.php"
USER_AGENT = "DepthCord-Scraper/1.0 (personal project)"
OUT_DIR = Path("wiki_dump")
PAGES_FILE = OUT_DIR / "pages.jsonl"
META_FILE = OUT_DIR / "meta.json"

BATCH_SIZE = 50
REQUEST_DELAY = 1.0
MAX_RETRIES = 5
BACKOFF_BASE = 3

session = requests.Session()
session.headers.update({"User-Agent": USER_AGENT})


def api_get(params, retries=MAX_RETRIES):
    params = {**params, "format": "json", "origin": "*"}
    for attempt in range(retries):
        try:
            r = session.get(API, params=params, timeout=60)
        except requests.RequestException as e:
            print(f"  network error: {e}", file=sys.stderr)
            time.sleep(BACKOFF_BASE * (2 ** attempt))
            continue

        if r.status_code == 200:
            return r.json()

        if r.status_code == 429 or 500 <= r.status_code < 600:
            wait = BACKOFF_BASE * (2 ** attempt)
            print(f"  {r.status_code}, waiting {wait}s...", file=sys.stderr)
            time.sleep(wait)
            continue

        print(f"  HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)
        r.raise_for_status()

    raise RuntimeError(f"Gave up after {retries} retries")


def fetch_all_page_titles():
    apcontinue = None
    while True:
        params = {
            "action": "query",
            "list": "allpages",
            "aplimit": "500",
        }
        if apcontinue:
            params["apcontinue"] = apcontinue

        data = api_get(params)
        for page in data["query"]["allpages"]:
            yield page["title"]

        if "continue" not in data:
            break
        apcontinue = data["continue"]["apcontinue"]
        time.sleep(REQUEST_DELAY)


def fetch_batch_wikitext(titles):
    """Fetch up to 50 pages in one API request. Returns dict of title -> wikitext."""
    data = api_get({
        "action": "query",
        "prop": "revisions",
        "titles": "|".join(titles),
        "rvprop": "content",
        "rvslots": "main",
        "redirects": "1",
    })
    result = {}
    pages = data.get("query", {}).get("pages", {})
    for page_id, page in pages.items():
        if page_id == "-1":
            continue
        revs = page.get("revisions")
        if not revs:
            continue
        title = page.get("title")
        result[title] = revs[0]["slots"]["main"]["*"]

    return result


def load_done_titles():
    if not PAGES_FILE.exists():
        return set()
    done = set()
    with PAGES_FILE.open() as f:
        for line in f:
            try:
                done.add(json.loads(line)["title"])
            except Exception:
                pass
    return done


def main():
    OUT_DIR.mkdir(exist_ok=True)
    done = load_done_titles()
    print(f"Resuming — {len(done)} pages already done")

    print("Fetching page list...")
    all_titles = []
    for title in fetch_all_page_titles():
        all_titles.append(title)
        if len(all_titles) % 500 == 0:
            print(f"  {len(all_titles)} titles so far...")
    print(f"Total pages: {len(all_titles)}")

    META_FILE.write_text(json.dumps({
        "total_titles": len(all_titles),
        "scraped_at": time.time(),
    }, indent=2))

    remaining = [t for t in all_titles if t not in done]
    batches = [
        remaining[i:i + BATCH_SIZE]
        for i in range(0, len(remaining), BATCH_SIZE)
    ]

    print(f"Fetching {len(remaining)} pages in {len(batches)} batches of {BATCH_SIZE}...")

    with PAGES_FILE.open("a", encoding="utf-8") as out:
        for i, batch in enumerate(batches, 1):
            try:
                result = fetch_batch_wikitext(batch)
            except Exception as e:
                print(f"[batch {i}/{len(batches)}] FAILED: {e}", file=sys.stderr)
                continue

            for title, wikitext in result.items():
                out.write(json.dumps({"title": title, "wikitext": wikitext}) + "\n")
            out.flush()

            print(f"[batch {i}/{len(batches)}] got {len(result)} pages")
            time.sleep(REQUEST_DELAY)

    print("Done.")


if __name__ == "__main__":
    main()
