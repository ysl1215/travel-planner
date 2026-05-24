#!/usr/bin/env python3
"""
Attraction scraper: Wikivoyage → LLM extraction → SQLite.

Usage:
    # Process all pending cities in the queue:
    python3 scripts/scrape_attractions.py

    # Queue and process a specific city immediately:
    python3 scripts/scrape_attractions.py --city "Lisbon" --country "Portugal"

    # Dry-run: scrape and print extracted JSON without writing to DB:
    python3 scripts/scrape_attractions.py --city "Lisbon" --dry-run

Requires:
    OPENROUTER_API_KEY (or GEMINI_API_KEY) in environment or .env.local
    pip install yt-dlp  (for YouTube transcript extraction — optional but recommended)
"""

import argparse
import json
import os
import pathlib
import re
import sqlite3
import sys
import time
import unicodedata
import urllib.request
import urllib.parse
import html.parser
import random as _random
from contextlib import closing

# ── Paths ────────────────────────────────────────────────────────────────────

ROOT    = pathlib.Path(__file__).parent.parent
DB_PATH = ROOT / "data" / "attractions.db"
ENV_PATH = ROOT / ".env.local"

# ── Load .env.local ───────────────────────────────────────────────────────────

def load_env():
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

load_env()

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    if not DB_PATH.exists():
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Run: python3 scripts/init_db.py")
        sys.exit(1)
    con = sqlite3.connect(DB_PATH)
    con.execute("PRAGMA journal_mode=WAL")
    con.row_factory = sqlite3.Row
    return con

def queue_city(con: sqlite3.Connection, city: str, country: str = ""):
    con.execute(
        "INSERT OR IGNORE INTO scrape_queue (city, country, status) VALUES (?, ?, 'pending')",
        (city, country)
    )
    con.commit()

def mark_running(con: sqlite3.Connection, city: str):
    con.execute(
        "UPDATE scrape_queue SET status='running', started_at=datetime('now') WHERE city=?",
        (city,)
    )
    con.commit()

def mark_done(con: sqlite3.Connection, city: str):
    con.execute(
        "UPDATE scrape_queue SET status='done', finished_at=datetime('now'), error=NULL WHERE city=?",
        (city,)
    )
    con.commit()

def mark_failed(con: sqlite3.Connection, city: str, error: str):
    con.execute(
        "UPDATE scrape_queue SET status='failed', finished_at=datetime('now'), error=? WHERE city=?",
        (error[:500], city)
    )
    con.commit()

def save_attractions(con: sqlite3.Connection, city: str, country: str, attractions: list[dict]):
    saved = 0
    for a in attractions:
        try:
            con.execute("""
                INSERT INTO attractions
                    (city, country, name, type, duration_min, duration_max,
                     difficulty, distance_km, highlights, best_for,
                     crowd_level, nearby, tips, source_url, confidence, trending_score)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(city, name) DO UPDATE SET
                    type=excluded.type,
                    duration_min=excluded.duration_min,
                    duration_max=excluded.duration_max,
                    difficulty=excluded.difficulty,
                    distance_km=excluded.distance_km,
                    highlights=excluded.highlights,
                    best_for=excluded.best_for,
                    crowd_level=excluded.crowd_level,
                    nearby=excluded.nearby,
                    tips=excluded.tips,
                    source_url=excluded.source_url,
                    confidence=excluded.confidence,
                    last_updated=date('now')
            """, (
                city, country,
                a.get("name", ""),
                a.get("type", "other"),
                a.get("duration_min"),
                a.get("duration_max"),
                a.get("difficulty", "N/A"),
                a.get("distance_km"),
                json.dumps(a.get("highlights", [])),
                json.dumps(a.get("best_for", [])),
                a.get("crowd_level", "moderate"),
                json.dumps(a.get("nearby", [])),
                a.get("tips", ""),
                a.get("source_url", ""),
                a.get("confidence", "estimated"),
                a.get("trending_score", 0),
            ))
            saved += 1
        except Exception as e:
            print(f"  Warning: could not save '{a.get('name')}': {e}")
    con.commit()
    return saved

# ── HTTP fetch with retry ────────────────────────────────────────────────────

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

def fetch(url: str, timeout: int = 15, retries: int = 3) -> str:
    """Fetch URL with retry and exponential backoff."""
    last_err = None
    for attempt in range(retries):
        headers = {
            "User-Agent": _random.choice(_USER_AGENTS),
            "Accept": "text/html,application/json",
            "Accept-Language": "en-US,en;q=0.9",
        }
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                charset = r.headers.get_content_charset() or "utf-8"
                return r.read().decode(charset, errors="replace")
        except Exception as e:
            last_err = e
            if attempt < retries - 1:
                delay = (2 ** attempt) + _random.uniform(0.5, 1.5)
                time.sleep(delay)
    raise RuntimeError(f"fetch failed for {url} after {retries} attempts: {last_err}")

# ── HTML → plain text ─────────────────────────────────────────────────────────

class _TextExtractor(html.parser.HTMLParser):
    SKIP_TAGS = {"script", "style", "nav", "footer", "head", "noscript"}

    def __init__(self):
        super().__init__()
        self._skip = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP_TAGS:
            self._skip += 1

    def handle_endtag(self, tag):
        if tag in self.SKIP_TAGS and self._skip > 0:
            self._skip -= 1

    def handle_data(self, data):
        if self._skip == 0:
            text = data.strip()
            if text:
                self.parts.append(text)

def html_to_text(raw: str) -> str:
    p = _TextExtractor()
    p.feed(raw)
    return "\n".join(p.parts)

# ── Shared JSON parsing helper ───────────────────────────────────────────────

VALID_TYPES = {"trail", "lake", "museum", "neighbourhood", "viewpoint", "beach", "food", "market", "other"}
VALID_DIFFICULTIES = {"easy", "moderate", "hard", "N/A"}
VALID_CROWD = {"low", "moderate", "high"}

def parse_llm_json_array(raw: str) -> list[dict]:
    """Parse an LLM response into a JSON array, handling markdown fences and validation."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)

    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1:
        raise RuntimeError(f"No JSON array in LLM response: {raw[:200]}")

    items = json.loads(raw[start:end + 1])

    # Validate and clean each item
    valid_items = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = item.get("name", "").strip()
        if not name:
            continue
        # Normalize enum fields
        if item.get("type") not in VALID_TYPES:
            item["type"] = "other"
        if item.get("difficulty") not in VALID_DIFFICULTIES:
            item["difficulty"] = "N/A"
        if item.get("crowd_level") not in VALID_CROWD:
            item["crowd_level"] = "moderate"
        item["name"] = name
        valid_items.append(item)

    return valid_items

# ── Name normalization for deduplication ─────────────────────────────────────

def normalize_name(name: str) -> str:
    """Normalize attraction name for deduplication: lowercase, strip accents, collapse whitespace."""
    name = name.lower().strip()
    name = unicodedata.normalize("NFKD", name)
    name = "".join(c for c in name if not unicodedata.combining(c))
    name = re.sub(r"[^\w\s]", "", name)
    name = re.sub(r"\s+", " ", name)
    return name

# ── Wikivoyage scraper ────────────────────────────────────────────────────────

WIKIVOYAGE_API = "https://en.wikivoyage.org/w/api.php"

def fetch_wikivoyage(city: str) -> tuple[str, str]:
    """Returns (plain_text, source_url). Raises on failure."""
    search_url = (
        f"{WIKIVOYAGE_API}?action=query&list=search"
        f"&srsearch={urllib.parse.quote(city)}&srlimit=1&format=json"
    )
    data = json.loads(fetch(search_url))
    results = data.get("query", {}).get("search", [])
    if not results:
        raise RuntimeError(f"No Wikivoyage page found for '{city}'")

    title = results[0]["title"]
    extract_url = (
        f"{WIKIVOYAGE_API}?action=query&prop=extracts&explaintext=1"
        f"&titles={urllib.parse.quote(title)}&format=json"
    )
    data = json.loads(fetch(extract_url))
    pages = data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()))
    text = page.get("extract", "")
    if not text:
        raise RuntimeError(f"Empty extract for '{city}' on Wikivoyage")

    source_url = f"https://en.wikivoyage.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))}"
    return text[:12000], source_url

# ── LLM extraction ────────────────────────────────────────────────────────────

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

EXTRACT_SYSTEM = (
    "You are a travel data extraction assistant. "
    "Extract structured attraction data from travel guide text. "
    "Output ONLY a valid JSON array. No markdown, no commentary."
)

EXTRACT_PROMPT = """Extract all attractions, sights, trails, lakes, viewpoints, neighbourhoods, and food spots from this travel guide text for {city}.

For each attraction return a JSON object with these fields:
- name: string (required)
- type: one of trail|lake|museum|neighbourhood|viewpoint|beach|food|market|other
- duration_min: integer minutes for a minimum visit (null if unknown)
- duration_max: integer minutes for a full experience (null if unknown)
- difficulty: easy|moderate|hard|N/A (for trails/hikes; N/A otherwise)
- distance_km: number (for trails; null otherwise)
- highlights: array of 2-4 short strings describing what makes it special
- best_for: array from [solo, couples, families, off-beaten-path, photography, budget]
- crowd_level: low|moderate|high
- nearby: array of other attraction names in this city that are close by (within ~30 min)
- tips: string with practical local tips (opening hours, best time, what to avoid). Empty string if none.
- confidence: "high" if duration/details came from the text, "medium" if partially inferred, "low" if mostly guessed

If duration data is not in the text, set duration_min and duration_max to null and confidence to "estimated".
Return N/A for difficulty if not a physical activity.

Travel guide text:
{text}

Return ONLY the JSON array."""

def call_openrouter(prompt: str, system: str) -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY not set")

    body = json.dumps({
        "model": os.environ.get("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": prompt},
        ],
        "max_tokens": 4096,
        "temperature": 0.2,
    }).encode()

    req = urllib.request.Request(
        OPENROUTER_URL,
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key}",
            "HTTP-Referer": "https://github.com/ysl1215/travel-planner",
            "X-Title": "Travel Planner AI",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    return data["choices"][0]["message"]["content"]

def call_gemini(prompt: str, system: str) -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    if not key:
        raise RuntimeError("GEMINI_API_KEY not set")

    body = json.dumps({
        "contents": [{"parts": [{"text": f"{system}\n\n{prompt}"}]}],
        "generationConfig": {"maxOutputTokens": 4096, "temperature": 0.2},
    }).encode()

    url = f"{GEMINI_URL}?key={key}"
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    return data["candidates"][0]["content"]["parts"][0]["text"]

def call_llm(prompt: str, system: str) -> str:
    """Call LLM with provider fallback and rate-limit delay between attempts."""
    for attempt_fn in [call_openrouter, call_gemini]:
        try:
            result = attempt_fn(prompt, system)
            return result
        except Exception as e:
            print(f"  LLM provider failed: {e}")
            time.sleep(3)
    raise RuntimeError("All LLM providers failed")

def llm_extract(city: str, text: str, source_url: str) -> list[dict]:
    """Call LLM to extract attractions from text. Returns list of dicts."""
    prompt = EXTRACT_PROMPT.format(city=city, text=text)
    raw = call_llm(prompt, EXTRACT_SYSTEM)
    attractions = parse_llm_json_array(raw)

    for a in attractions:
        a["source_url"] = source_url

    return attractions

# ── YouTube transcript extraction ────────────────────────────────────────────


def _search_video_ids_ytdlp(query: str, max_ids: int = 8) -> list[str]:
    """Search YouTube via yt-dlp and return video IDs. Returns [] if yt-dlp unavailable."""
    import subprocess
    try:
        result = subprocess.run(
            [
                "yt-dlp",
                f"ytsearch{max_ids}:{query}",
                "--flat-playlist", "--get-id",
                "--quiet", "--no-warnings",
            ],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().splitlines()[:max_ids]
    except (FileNotFoundError, subprocess.TimeoutExpired):
        pass
    return []

def _fetch_transcript_ytdlp(video_id: str) -> str | None:
    """Fetch transcript using yt-dlp. Tries English first, then any available language."""
    import subprocess, tempfile, json as _json, pathlib as _pathlib

    with tempfile.TemporaryDirectory() as tmpdir:
        out_template = str(_pathlib.Path(tmpdir) / "sub")

        for sub_args in [
            ["--write-auto-sub", "--sub-lang", "en"],
            ["--write-auto-sub", "--sub-lang", "en.*"],
            ["--write-subs", "--write-auto-sub", "--sub-lang", "all"],
        ]:
            try:
                subprocess.run(
                    [
                        "yt-dlp",
                        *sub_args,
                        "--skip-download", "--sub-format", "json3",
                        "--quiet", "--no-warnings",
                        "-o", out_template,
                        f"https://www.youtube.com/watch?v={video_id}",
                    ],
                    capture_output=True, text=True, timeout=30
                )
            except (FileNotFoundError, subprocess.TimeoutExpired):
                return None

            sub_files = list(_pathlib.Path(tmpdir).glob("*.json3"))
            if sub_files:
                break
        else:
            return None

        en_files = [f for f in sub_files if ".en" in f.name]
        chosen = en_files[0] if en_files else sub_files[0]

        try:
            data = _json.loads(chosen.read_text(encoding="utf-8"))
        except Exception:
            return None

        parts = []
        for event in data.get("events", []):
            for seg in event.get("segs", []):
                t = seg.get("utf8", "").strip()
                if t and t != "\n":
                    parts.append(t)

        text = " ".join(parts).strip()
        return text[:6000] if len(text) > 100 else None

YOUTUBE_EXTRACT_PROMPT = """The following are transcripts from YouTube travel videos about {city}.
They may be in any language — extract information regardless of language and respond in English.
Extract any mentions of specific attractions, trails, viewpoints, food spots, or activities.
For each, extract: name, type, duration mentioned (if any), tips mentioned, and whether it seems off-beaten-path.
Return a JSON array using the same schema as before (name, type, duration_min, duration_max, difficulty, distance_km, highlights, best_for, crowd_level, nearby, tips, confidence).
Set confidence to "medium" for YouTube-sourced data. If no useful attraction data, return [].

Transcripts:
{transcripts}

Return ONLY the JSON array."""

def fetch_youtube_attractions(city: str) -> list[dict]:
    """Search YouTube for travel videos about city, extract transcripts, run LLM extraction."""
    print(f"  YouTube: searching for '{city}' travel videos...")
    video_ids = _search_video_ids_ytdlp(f"{city} travel guide hidden gems", max_ids=8)
    if not video_ids:
        print("  YouTube: no video IDs found (yt-dlp not installed or no results)")
        return []

    print(f"  YouTube: found {len(video_ids)} videos, fetching transcripts via yt-dlp...")
    transcripts = []
    for vid in video_ids:
        t = _fetch_transcript_ytdlp(vid)
        if t:
            transcripts.append(f"[video:{vid}] {t}")
        time.sleep(0.5)

    if not transcripts:
        print("  YouTube: no transcripts available (yt-dlp not installed or no EN captions)")
        return []

    print(f"  YouTube: got {len(transcripts)} transcripts, extracting attractions...")
    combined = "\n\n".join(transcripts)[:14000]
    source_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(city + ' travel')}"

    try:
        prompt = YOUTUBE_EXTRACT_PROMPT.format(city=city, transcripts=combined)
        raw = call_llm(prompt, EXTRACT_SYSTEM)
        attractions = parse_llm_json_array(raw)
        for a in attractions:
            a["source_url"] = source_url
        print(f"  YouTube: extracted {len(attractions)} attractions")
        return attractions
    except Exception as e:
        print(f"  YouTube extraction failed: {e}")
        return []


# ── Trending signal (Wikipedia pageviews) ──────────────────────────────────────

_WIKI_PAGEVIEWS_URL = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
    "/en.wikipedia/all-access/all-agents/{title}/monthly/{start}/{end}"
)

def _normalize_wiki_title(name: str) -> str:
    """Convert attraction name to a Wikipedia article URL path segment."""
    title = name.strip().replace(" ", "_")
    return urllib.parse.quote(title, safe="_")


def _fetch_wikipedia_pageviews(title: str, months: int = 3) -> int:
    """Fetch total Wikipedia pageviews for the last N months. Returns 0 on failure."""
    from datetime import datetime, timedelta

    end = datetime.now()
    start = end - timedelta(days=months * 30)
    start_str = start.strftime("%Y%m01")
    end_str = end.strftime("%Y%m01")

    url = _WIKI_PAGEVIEWS_URL.format(title=title, start=start_str, end=end_str)
    try:
        headers = {
            "User-Agent": "TravelPlannerBot/1.0 (budget travel planner; no commercial use)",
            "Accept": "application/json",
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read())
        return sum(item.get("views", 0) for item in data.get("items", []))
    except Exception:
        return 0


def fetch_trending_scores(city: str, attraction_names: list[str]) -> dict[str, int]:
    """Returns {attraction_name: trending_score} using Wikipedia pageviews.

    Fetches 3-month total views for each attraction. Tries the attraction name
    directly, then falls back to Name_(City) disambiguation. Caps at 15 attractions.
    """
    scores: dict[str, int] = {}
    for name in attraction_names[:15]:
        title = _normalize_wiki_title(name)
        views = _fetch_wikipedia_pageviews(title)

        if views == 0:
            title_with_city = _normalize_wiki_title(f"{name} ({city})")
            views = _fetch_wikipedia_pageviews(title_with_city)

        scores[name] = views
        time.sleep(0.5)
    return scores


# ── OpenStreetMap Overpass (trails, viewpoints, lakes — high confidence) ───────

OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
OVERPASS_FALLBACK_URL = "https://overpass-api.de/api/interpreter"

def fetch_osm_attractions(city: str, radius_km: int = 30) -> list[dict]:
    """Query OSM Overpass for trails, viewpoints, and lakes near a city."""
    geo_url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(city)}&format=json&limit=1"
    try:
        geo_data = json.loads(fetch(geo_url, timeout=10))
        if not geo_data:
            print(f"  OSM: could not geocode '{city}'")
            return []
        lat, lon = float(geo_data[0]["lat"]), float(geo_data[0]["lon"])
    except Exception as e:
        print(f"  OSM: geocoding failed: {e}")
        return []

    print(f"  OSM: querying trails/viewpoints/lakes within {radius_km}km of {city} ({lat:.2f}, {lon:.2f})...")
    time.sleep(1)  # Nominatim rate limit: 1 req/s

    radius_m = radius_km * 1000

    # Use POST to avoid URL length issues
    queries = [
        f'[out:json][timeout:30];(node["tourism"="viewpoint"]["name"](around:{radius_m},{lat},{lon});node["natural"="peak"]["name"](around:{radius_m},{lat},{lon}););out tags;',
        f'[out:json][timeout:30];(way["natural"="water"]["name"](around:{radius_m},{lat},{lon});relation["natural"="water"]["name"](around:{radius_m},{lat},{lon}););out tags;',
        f'[out:json][timeout:30];(way["route"="hiking"]["name"](around:{radius_m},{lat},{lon}););out tags;',
    ]

    all_elements = []
    for q in queries:
        try:
            data = None
            for overpass_url in [OVERPASS_URL, OVERPASS_FALLBACK_URL]:
                try:
                    post_data = f"data={urllib.parse.quote(q)}".encode()
                    req = urllib.request.Request(
                        overpass_url,
                        data=post_data,
                        headers={"User-Agent": _random.choice(_USER_AGENTS), "Content-Type": "application/x-www-form-urlencoded"},
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=35) as r:
                        data = json.loads(r.read())
                    break
                except Exception:
                    continue
            if data:
                all_elements.extend(data.get("elements", []))
            time.sleep(2)
        except Exception:
            continue

    if not all_elements:
        print("  OSM: no results from any query")
        return []

    SAC_TO_DIFFICULTY = {
        "hiking": "easy", "mountain_hiking": "moderate", "demanding_mountain_hiking": "hard",
        "alpine_hiking": "hard", "demanding_alpine_hiking": "hard", "difficult_alpine_hiking": "hard",
    }

    attractions = []
    seen_names: set[str] = set()

    for el in all_elements:
        tags = el.get("tags", {})
        name = tags.get("name", "").strip()
        normalized = normalize_name(name)
        if not name or normalized in seen_names:
            continue
        seen_names.add(normalized)

        osm_type = "trail"
        if tags.get("tourism") == "viewpoint":
            osm_type = "viewpoint"
        elif tags.get("natural") == "peak":
            osm_type = "viewpoint"
        elif tags.get("natural") == "water":
            osm_type = "lake"

        sac = tags.get("sac_scale", "")
        difficulty = SAC_TO_DIFFICULTY.get(sac, "N/A")

        distance = None
        if tags.get("distance"):
            try:
                distance = float(re.sub(r"[^\d.]", "", tags["distance"]))
            except Exception:
                pass

        dur_min = int(distance / 4 * 60) if distance else None
        dur_max = int(dur_min * 1.5) if dur_min else None

        attractions.append({
            "name": name,
            "type": osm_type,
            "duration_min": dur_min,
            "duration_max": dur_max,
            "difficulty": difficulty,
            "distance_km": distance,
            "highlights": [],
            "best_for": ["off-beaten-path"] if difficulty in ("moderate", "hard") else [],
            "crowd_level": "low",
            "nearby": [],
            "tips": f"SAC scale: {sac}" if sac else "",
            "source_url": f"https://www.openstreetmap.org/{el.get('type','')}/{el.get('id','')}",
            "confidence": "high",
            "trending_score": 0,
        })

    print(f"  OSM: found {len(attractions)} named features")
    return attractions[:50]


# ── Per-city pipeline ─────────────────────────────────────────────────────────

def process_city(con: sqlite3.Connection, city: str, country: str, dry_run: bool = False) -> int:
    """Scrape and extract attractions for one city. Returns count saved."""
    print(f"\n{'='*50}")
    print(f"Processing: {city}{', ' + country if country else ''}")

    # 1. Wikivoyage (primary structured source)
    print("  Fetching Wikivoyage...")
    try:
        text, source_url = fetch_wikivoyage(city)
        print(f"  Got {len(text)} chars from {source_url}")
    except Exception as e:
        raise RuntimeError(f"Wikivoyage fetch failed: {e}")

    # Rate limit between LLM calls
    time.sleep(2)

    print("  Extracting attractions via LLM...")
    attractions = llm_extract(city, text, source_url)
    print(f"  Extracted {len(attractions)} attractions from Wikivoyage")

    # 2. OpenStreetMap (real distances, difficulty — high confidence)
    osm_attractions = fetch_osm_attractions(city)
    if osm_attractions:
        existing_names = {normalize_name(a.get("name", "")) for a in attractions}
        new_from_osm = [a for a in osm_attractions if normalize_name(a.get("name", "")) not in existing_names]
        attractions.extend(new_from_osm)
        print(f"  Added {len(new_from_osm)} new attractions from OSM")

    # Rate limit before YouTube LLM call
    time.sleep(3)

    # 3. YouTube transcripts (supplementary source)
    yt_attractions = fetch_youtube_attractions(city)
    if yt_attractions:
        existing_names = {normalize_name(a.get("name", "")) for a in attractions}
        new_from_yt = [a for a in yt_attractions if normalize_name(a.get("name", "")) not in existing_names]
        attractions.extend(new_from_yt)
        print(f"  Added {len(new_from_yt)} new attractions from YouTube")

    if dry_run:
        print(json.dumps(attractions, indent=2))
        return len(attractions)

    # 4. Save all attractions to DB
    saved = save_attractions(con, city, country, attractions)
    print(f"  Saved {saved} attractions to DB")

    # 5. Trending scores (Wikipedia pageviews) — update existing DB rows
    print("  Fetching trending scores (Wikipedia pageviews)...")
    names = [a.get("name", "") for a in attractions if a.get("name")]
    scores = fetch_trending_scores(city, names)

    if scores:
        updates = [(score, city, name) for name, score in scores.items()]
        con.executemany(
            "UPDATE attractions SET trending_score=? WHERE city=? AND name=? COLLATE NOCASE",
            updates
        )
        con.commit()
        nonzero = sum(1 for s in scores.values() if s > 0)
        print(f"  Updated trending scores for {nonzero}/{len(scores)} attractions")

    return saved

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Scrape attraction data for queued cities")
    parser.add_argument("--city",    help="Process a specific city immediately")
    parser.add_argument("--country", default="", help="Country for --city")
    parser.add_argument("--dry-run", action="store_true", help="Print extracted JSON, don't write to DB")
    args = parser.parse_args()

    if args.city:
        # Single city mode
        if args.dry_run:
            # Dry-run doesn't need persistent DB connection
            process_city(None, args.city, args.country, dry_run=True)  # type: ignore
            return

        with closing(get_db()) as con:
            queue_city(con, args.city, args.country)
            mark_running(con, args.city)
            try:
                process_city(con, args.city, args.country)
                mark_done(con, args.city)
                print(f"\nDone: {args.city}")
            except Exception as e:
                mark_failed(con, args.city, str(e))
                print(f"\nFailed: {args.city} — {e}")
                sys.exit(1)
        return

    # Queue mode: process all pending cities
    with closing(get_db()) as con:
        pending = con.execute(
            "SELECT city, country FROM scrape_queue WHERE status='pending' ORDER BY queued_at"
        ).fetchall()

        if not pending:
            print("No pending cities in scrape queue.")
            print("Cities are queued automatically when /api/suggest is called.")
            print("Or add one manually: python3 scripts/scrape_attractions.py --city 'Paris' --country 'France'")
            return

        print(f"Found {len(pending)} pending cities: {[r['city'] for r in pending]}")

        for row in pending:
            city, country = row["city"], row["country"] or ""
            mark_running(con, city)

            try:
                process_city(con, city, country)
                mark_done(con, city)
                print(f"  Done: {city}")
            except Exception as e:
                mark_failed(con, city, str(e))
                print(f"  Failed: {city} — {e}")

            time.sleep(3)

        print("\nAll cities processed.")

if __name__ == "__main__":
    main()
