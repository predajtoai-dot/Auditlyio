# 🚀 VERCEL DEPLOYMENT - RÝCHLY ŠTART

## ⏱️ Čas: 10 minút
## 💰 Cena: ZDARMA (Vercel Free Plan)

---

## 📦 KROK 1: VYTVOR ZIP

```bash
# Klikni 2x na tento súbor:
create-vercel-zip.bat
```

✅ **Výsledok:** `predajto-vercel.zip` (cca 5 MB)

---

## 🌐 KROK 2: OTVOR VERCEL

👉 **https://vercel.com/new**

### Prvýkrát na Vercel?
1. **Sign Up:**
   - GitHub (odporúčané)
   - GitLab
   - Email
2. **Vyber:** Free Plan (Hobby)
3. **Potvrď:** Email (ak cez email)

---

## 📤 KROK 3: UPLOAD ZIP

**V Vercel Dashboard:**

1. Klikni **"Add New..."**
2. Vyber **"Project"**
3. **Import ZIP:**
   - Scroll dole
   - "Deploy a Template" → Skip
   - "Browse" → Vyber `predajto-vercel.zip`

**ALEBO:**

1. Pretiahni `predajto-vercel.zip` do okna (Drag & Drop)

---

## ⚙️ KROK 4: CONFIGURE PROJECT

```
Project Name:        predajto-ai
Framework Preset:    Other
Build Command:       (leave empty)
Output Directory:    (leave empty)
Install Command:     npm install
Root Directory:      ./
Node.js Version:     18.x (default)
```

---

## 🔑 KROK 5: ENVIRONMENT VARIABLES (POVINNÉ!)

**Pred deployom klikni "Environment Variables":**

### Povinné:
```
Name:  OPENAI_API_KEY
Value: sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
```

### Voliteľné (odporúčané):
```
Name:  OPENAI_MODEL
Value: gpt-4o-mini
```

### Voliteľné (Google Shopping):
```
Name:  GOOGLE_API_KEY
Value: AIzaSyxxxxxxxxxxxxxxx

Name:  GOOGLE_CX
Value: 0123456789abcdef
```

⚠️ **BEZ OPENAI_API_KEY APLIKÁCIA NEBUDE FUNGOVAŤ!**

---

## 🚀 KROK 6: DEPLOY

1. Klikni **"Deploy"**
2. Čakaj **2-3 minúty**
3. **Done!** 🎉

**Výsledok:**
```
✅ Your project is live at:
https://predajto-ai-xxxxx.vercel.app
```

---

## 🧪 KROK 7: TEST

### Manuálne (v prehliadači):
```
1. Otvor: https://TVOJA-DOMENA.vercel.app
2. Upload fotku
3. Zadaj produkt: "MacBook 8GB 256GB"
4. Klikni "Vyskúšať"
5. Počkaj na výsledok
```

### Automaticky (CMD):
```bash
# Klikni 2x na:
test-vercel.bat

# Zadaj svoju doménu
# Výsledok: JSON response z API
```

---

## ✅ HOTOVO!

### Čo máš teraz:
- ✅ Live aplikácia na Verceli
- ✅ HTTPS automaticky
- ✅ Neobmedzené deployments
- ✅ Automatické SSL certifikáty
- ✅ CDN (rýchle loading)

### Ďalšie kroky:
1. **Custom doména:** Vercel Dashboard → Settings → Domains
2. **Analytics:** Vercel Dashboard → Analytics
3. **Logs:** Vercel Dashboard → Deployments → Logs

---

## 🆘 PROBLÉMY?

### ❌ "Build failed"
- Skontroluj logs v Vercel Dashboard
- Skontroluj či máš správny `OPENAI_API_KEY`

### ❌ "Function timeout"
- Upgrade na Vercel Pro ($20/mesiac)
- Alebo optimalizuj server.mjs

### ❌ "404 Not Found"
- Skontroluj `vercel.json` routing
- Redeployuj

---

## 📊 VERCEL LIMITS (FREE PLAN)

- ✅ **100 GB bandwidth/month**
- ✅ **100 deployments/day**
- ✅ **Unlimited projects**
- ⏱️ **10s function timeout** (zvyčajne stačí)
- 💾 **500 MB total storage**

**Pre väčšinu projektov je FREE plan viac než dosť!** 🎉

---

## 🔄 RE-DEPLOY (Po zmene kódu)

1. Uprav kód lokálne
2. Spusti `create-vercel-zip.bat`
3. Vercel Dashboard → Project → Settings → General
4. "Redeploy" → Upload nový ZIP
5. Done! ✅

**ALEBO:** Použi Git + GitHub (automatic deployments)

---

**Máš otázky? Píš!** 💬
