# KrisFlyer Spontaneous Escapes Tracker

A React app that surfaces available KrisFlyer Spontaneous Escapes award seats for May 2026, with a weekly scraper to keep data fresh.

**Covered promotions:**
- Singapore Airlines (SQ) — 30% off standard miles
- Scoot (TR) — 15% off standard miles

## Features

- Fuzzy search across origin and destination simultaneously
- Filter by cabin class, airline, day of week, or specific date
- Sort by miles, destination, or number of available dates
- Expandable cards showing flight times, all open dates, and a direct booking link
- "Copy deal" button for quick sharing

## Data pipeline

Flight data lives in `data/flights.json`. A GitHub Actions workflow runs every **Sunday at 18:00 UTC** (Monday 2am SGT) to scrape both promo pages and update the file automatically.

To run the scraper locally:

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
python main.py
```

Set `AVIATIONSTACK_API_KEY` as an environment variable (or repo secret) to pull live flight schedules. Without it, the scraper falls back to the existing schedule data in `flights.json`.

## Local development

Requires Node 18+.

```bash
npm install
npm run dev
```

## Deployment

```bash
npm run build   # outputs to dist/
```

Deploy `dist/` to any static host (GitHub Pages, Netlify, Vercel, etc.).

For GitHub Pages, add a deploy step to `.github/workflows/update-data.yml` or create a separate workflow pointing at the `dist/` folder.
