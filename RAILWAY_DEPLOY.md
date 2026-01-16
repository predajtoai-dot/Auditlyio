# 🚂 RAILWAY DEPLOYMENT - KROK PO KROKU

## ⏱️ Čas: 5 minút
## 💰 Cena: $5 ZDARMA credit/mesiac

---

## 📦 PRÍPRAVA (HOTOVO ✅)

- ✅ `Procfile` vytvorený
- ✅ `package.json` skontrolovaný
- ✅ `.railwayignore` vytvorený

---

## 🚀 DEPLOYMENT

### **MOŽNOSŤ 1: CEZ WEB UI (NAJJEDNODUCHŠIE)**

1. **Otvor:** https://railway.app/new

2. **Sign Up/Login:**
   - GitHub (odporúčané)
   - ALEBO Email

3. **Deploy from GitHub:**
   - Klikni **"Deploy from GitHub repo"**
   - Authorize Railway
   - Vyber repository (alebo vytvor nový)

4. **Environment Variables:**
   ```
   OPENAI_API_KEY=sk-proj-xxxxx...
   OPENAI_MODEL=gpt-4o-mini
   PORT=5510
   ```
   
   **Voliteľné:**
   ```
   GOOGLE_API_KEY=xxxxx
   GOOGLE_CX=xxxxx
   ```

5. **Deploy:**
   - Klikni **"Deploy Now"**
   - Čakaj ~2 minúty
   - Done! ✅

6. **Custom Domain:**
   - Settings → Generate Domain
   - Dostaneš: `https://predajto-ai-production.up.railway.app`

---

### **MOŽNOSŤ 2: CEZ CLI (PRE QUICK UPDATES)**

#### **1. Nainštaluj Railway CLI:**

```bash
npm install -g @railway/cli
```

#### **2. Prihlás sa:**

```bash
railway login
```

#### **3. Inicializuj projekt:**

```bash
# V priečinku projektu:
cd "c:\Users\marek\OneDrive\Počítač\PredajTo"

# Link na Railway projekt:
railway link
```

#### **4. Nastav Environment Variables:**

```bash
railway variables set OPENAI_API_KEY=sk-proj-xxxxx...
railway variables set OPENAI_MODEL=gpt-4o-mini
railway variables set PORT=5510
```

#### **5. Deploy:**

```bash
railway up
```

✅ **Deploy za ~1 minútu!**

#### **6. Otvor v prehliadači:**

```bash
railway open
```

---

## 🔄 RE-DEPLOY (PO ZMENE KÓDU)

### **S GitHub (automatický):**
```bash
git add .
git commit -m "Update"
git push
```
✅ Railway automaticky redeployuje!

### **S CLI (manuálny):**
```bash
railway up
```

---

## 📊 VÝHODY RAILWAY

- ✅ **$5 free credit/mesiac** (dosť pre malé projekty)
- ✅ **Automatické deployments** z GitHub
- ✅ **Built-in Database** (PostgreSQL, MySQL, MongoDB)
- ✅ **Custom domains** zadarmo
- ✅ **SSL certifikáty** automaticky
- ✅ **Jednoduchšie** ako Vercel pre Node.js backend

---

## 🆘 TROUBLESHOOTING

### ❌ "Build failed"
- Skontroluj logs: `railway logs`
- Skontroluj Environment Variables

### ❌ "Port already in use"
- Railway automaticky nastaví `PORT` env variable
- `server.mjs` používa `process.env.PORT || 5510` ✅

### ❌ "Module not found"
- Skontroluj `package.json` dependencies
- Spusti: `railway run npm install`

---

## 📊 LIMITY (FREE TIER)

- ✅ **$5 credit/mesiac**
- ✅ **500 hours runtime** (~20 dní non-stop)
- ✅ **100 GB bandwidth**
- ✅ **Unlimited projects**
- ⏱️ **No timeout** (na rozdiel od Vercel!)

**Pre väčšinu projektov je FREE tier viac než dosť!** 🎉

---

## 🔗 UŽITOČNÉ LINKY

- **Railway Dashboard:** https://railway.app/dashboard
- **Docs:** https://docs.railway.app/
- **CLI Docs:** https://docs.railway.app/develop/cli

---

**Máš otázky? Píš!** 💬
