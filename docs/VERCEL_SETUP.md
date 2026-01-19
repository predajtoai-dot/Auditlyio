# Modern Vercel Configuration

Tento projekt teraz používa modernú Vercel konfiguráciu:

## Zmeny

### ✅ Odstránené (deprecated):
- `"version": 2` - už nie je potrebné
- `"builds": [...]` - Vercel automaticky detekuje
- `"env": {...}` - nastavte cez Vercel Dashboard
- `"regions": [...]` - nastavte cez Vercel Dashboard

### ✅ Nová štruktúra:

```
project/
├── api/
│   └── server.js          # Serverless funkcia (wrapper pre server.mjs)
├── index.html             # Statická stránka (automaticky servedovaná)
├── main.js                # Statický JS (automaticky servedovaný)
├── styles.css             # Statický CSS (automaticky servedovaný)
├── server.mjs             # Hlavná server logika
└── vercel.json            # Minimálna konfigurácia
```

## Serverless Funkcie

Všetky API requesty (`/api/*`) sú automaticky routované na `api/server.js`

## Statické súbory

Všetky ostatné súbory v root sú automaticky servedované ako static assets.

## Deployment

```bash
# Lokálne testovanie
vercel dev

# Deploy do production
vercel --prod
```

## Environment Variables

Nastavte cez Vercel Dashboard:
- Project Settings → Environment Variables
- Add: `OPENAI_API_KEY`

## Build Settings (Vercel Dashboard)

- **Framework Preset**: Other
- **Build Command**: (empty)
- **Output Directory**: (empty) 
- **Install Command**: `npm install`

Vercel automaticky detekuje že je to Node.js projekt s API funkciami!
