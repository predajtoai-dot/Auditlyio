# 🚀 Deployment Guide - Vercel

## Pred deploymentom - kontrola

✅ Skontrolujte že máte:
- [ ] `.env.local` s `OPENAI_API_KEY` (musí byť nastavený aj na Verceli!)
- [ ] Aktuálnu verziu kódu commitnutú
- [ ] Vercel CLI nainštalované (`npm i -g vercel`)

## 🎯 Rýchly deployment

### Spôsob 1: Cez Vercel CLI (odporúčané)

```bash
# 1. Prihlásiť sa do Vercel
vercel login

# 2. Deploy do production
vercel --prod

# 3. Sledovať deployment
# URL bude zobrazené v termináli (napr. https://predajto-ai.vercel.app)
```

### Spôsob 2: Cez Git + Vercel Dashboard

```bash
# 1. Commit aktuálny stav
git add .
git commit -m "Update: New purple theme, filter fixes, glassmorphism design"
git push origin main

# 2. Otvorte https://vercel.com/dashboard
# 3. Projekt sa automaticky znovu deployne
```

## ⚙️ Environment Variables na Verceli

**CRITICAL:** Musíte nastaviť na Verceli:

1. Otvorte: https://vercel.com/your-project/settings/environment-variables
2. Pridajte:
   - `OPENAI_API_KEY` = `sk-...` (váš OpenAI kľúč)
   - `NODE_ENV` = `production`

## 📋 Checklist pred deploymentom

- [ ] CSS verzia aktuálna (v=133)
- [ ] JS verzia aktuálna (v=156)
- [ ] Server.mjs funguje lokálne
- [ ] Žiadne console.log s citlivými údajmi
- [ ] `.vercelignore` obsahuje správne súbory
- [ ] `vercel.json` je správne nakonfigurovaný

## 🔧 Vercel konfigurácia (už máte)

```json
{
  "version": 2,
  "builds": [
    { "src": "server.mjs", "use": "@vercel/node" },
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "main.js", "use": "@vercel/static" },
    { "src": "styles.css", "use": "@vercel/static" }
  ],
  "rewrites": [
    { "source": "/api/:path*", "destination": "/server.mjs" },
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ]
}
```

## 🎨 Čo sa zmenilo v novej verzii

- ✅ Kompletná fialová téma (odstránené žlté farby)
- ✅ Glassmorphism dizajn
- ✅ 2-fázový workflow (fetch ads → confirm → generate)
- ✅ Opravené filtre (fungujú na prvý klik)
- ✅ Manual price calculation fallback
- ✅ Smart filter disabling
- ✅ Čistý footer bez pozadia
- ✅ Odstránené neaktívne ikony z hlavičky
- ✅ Odstránená "šálka" (iMac wrapper)

## 🐛 Ak deployment zlyhá

1. **Skontrolujte build logs** na Verceli
2. **Overte environment variables**
3. **Skúste redeploy:**
   ```bash
   vercel --prod --force
   ```

## ✅ Po deploymenti

1. Otvorte URL (napr. https://predajto-ai.vercel.app)
2. Skúste vygenerovať inzerát
3. Skontrolujte console na chyby
4. Testujte filtre

## 📞 Custom doména (voliteľné)

Ak chcete vlastnú doménu (napr. predajto.ai):

1. Vercel Dashboard → Settings → Domains
2. Pridajte vašu doménu
3. Nastavte DNS podľa inštrukcií

## 💡 Tipy

- Každý push do `main` branch spustí automatický deployment
- Preview deployments sú vytvorené pre pull requesty
- Rollback je možný cez Vercel Dashboard → Deployments
- Logy sú dostupné v real-time na Verceli

---

**Verzia:** CSS v=133, JS v=156
**Posledná aktualizácia:** 2026-01-11
