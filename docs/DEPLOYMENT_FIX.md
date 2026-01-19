# 🚨 VERCEL DEPLOYMENT - RIEŠENIE PROBLÉMU

## Problém
Vercel CLI zlyhá s chybou `UNKNOWN: unknown error, read` kvôli špeciálnym znakom v ceste (`Počítač`).

## ✅ NAJJEDNODUCHŠIE RIEŠENIE

### Metóda 1: Vercel Dashboard (ODPORÚČANÉ)

1. **Otvor** https://vercel.com/dashboard
2. **Vyber** projekt `predajto-ai`
3. **Klikni** na "Settings" → "Git"
4. **Ak nemáš Git**: Použiј "Deploy manually" → Upload ZIP

### Metóda 2: Vytvor ZIP a uploadni

```powershell
# Vytvor ZIP s potrebnými súbormi
$files = @(
    "index.html",
    "main.js",
    "styles.css",
    "server.mjs",
    "marketStore.mjs",
    "categories.mjs",
    "pricingProtection.mjs",
    "privacy.html",
    "pricing-info-styles.css",
    "package.json",
    "package-lock.json",
    "vercel.json",
    ".vercelignore",
    "api\server.js"
)

Compress-Archive -Path $files -DestinationPath "predajto-deploy.zip" -Force
```

Potom:
1. Otvor https://vercel.com/new
2. Upload `predajto-deploy.zip`
3. Nastav Environment Variables (OPENAI_API_KEY)

### Metóda 3: Nainštaluj Git a push

```powershell
# Nainštaluj Git z https://git-scm.com/download/win
# Potom:
git init
git add .
git commit -m "deploy"
git remote add origin <your-repo-url>
git push -u origin main
```

Vercel automaticky detekuje push a nasadí.

## Environment Variables

**Nezabudni nastaviť v Vercel Dashboard:**
- `OPENAI_API_KEY` - tvoj OpenAI API kľúč

## Súbory potrebné pre deployment

✅ Už správne nakonfigurované:
- `vercel.json` - modernáš config (bez "builds")
- `.vercelignore` - ignoruje node_modules, testy, atď.
- `api/server.js` - serverless funkcia wrapper
- `package.json` - dependencies

## Testovanie po deployi

1. Otvor production URL
2. Testuj upload fotky
3. Skontroluj že API funguje
4. Skontroluj Console (F12) pre chyby

---

**Odporúčam Metódu 2 (ZIP upload)** - najrýchlejšia a najspoľahlivejšia!
