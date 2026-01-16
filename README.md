# predajto.ai

**AI-powered ad generator and price estimator** for Slovak marketplace (Bazoš).

---

## Features
- **AI text generation** (OpenAI GPT-4o-mini)
- **Image analysis** (product identification, condition estimation, defect detection)
- **Background removal** (@imgly/background-removal – local AI, no external API needed)
- **Real-time pricing** (based on Bazoš market data)
- **Dynamic similar ads** (scraped from Bazoš)
- Luxury glassmorphism UI, mobile-responsive

---

## Setup

### 1. Install Node.js 18+ (recommended: 20 LTS)
```bash
node -v  # should be 18.x or higher
```

### 2. Copy `env.example` to `env.local` and fill in API key

```bash
cp env.example env.local
```

#### Required:
- **`OPENAI_API_KEY`**: Get from https://platform.openai.com/api-keys

#### Default port:
- Server runs on **5510** by default (to avoid conflicts with Live Server / Cursor).

---

## Run

```bash
cd "C:\Users\marek\OneDrive\Počítač\PredajTo"
node server.mjs
```

Then open `http://127.0.0.1:5510` in your browser (or just open `index.html` via Live Server – it will connect to the backend on 5510).

---

## API Endpoints

- `GET /api/health` – server status
- `POST /api/identify` – product identification from image
- `POST /api/evaluate` – full ad generation + pricing
- `GET /api/market/search` – scrape Bazoš for real ads
- `GET /api/market/similar` – fetch stored similar ads

Note: Background removal runs **locally in browser** (no backend API needed).

---

## Tech Stack
- **Frontend**: Static HTML/CSS/JS (no framework)
- **Backend**: Node.js (built-in `http`, no Express)
- **AI**: OpenAI GPT-4o-mini (Chat Completions + Vision)
- **Background removal**: @imgly/background-removal (local AI, loaded via CDN)
- **Market data**: Bazoš scraping (no npm deps)

---

## Notes
- Cache-busting: `main.js?v=39`, `styles.css?v=30`
- Data stored in `data/market-data.json` (Bazoš ads for pricing)
- Background removal runs **fully in browser** (no external API/costs)
  - First use downloads ~5MB AI model (cached after that)
  - Processing takes 5–15 seconds depending on image size
- OpenAI costs: pay-as-you-go (typically $0.01–0.05 per ad generation)

---

## Author
Built for predajto.ai • 2026
