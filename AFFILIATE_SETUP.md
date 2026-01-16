# 💰 **AFFILIATE MONETIZATION SETUP**

**Status:** ✅ **READY FOR IMPLEMENTATION**  
**Expected Revenue:** €500-5,000/mesiac (pri 1,000-10,000 users)

---

## 🎯 **IMPLEMENTED FEATURES:**

✅ **Heureka link** pri každom inzeráte  
✅ **Helper functions** pre affiliate tracking  
✅ **Partner ID ready** - len pridať do `.env.local`  
✅ **Multi-platform support** (Heureka, Alza, Mall, Google)

---

## 📋 **SETUP INSTRUCTIONS:**

### **STEP 1: Registrácia do Heureka Partner Program**

1. **Navštív:** https://www.heureka.sk/partneri/
2. **Vyplň formulár:**
   - Názov webu: **PredajTo.ai**
   - URL: **https://predajto.ai** (alebo tvoja doména)
   - Kategória: **Price comparison / E-commerce tool**
   - Expected traffic: **1,000-10,000 users/mesiac**
3. **Čakaj na schválenie** (1-3 dni)
4. **Dostaneš Partner ID** (napr. `12345`)

---

### **STEP 2: Pridaj Partner ID do projektu**

V súbore `.env.local` (vytvor ak neexistuje):

```bash
# 💰 HEUREKA AFFILIATE
HEUREKA_PARTNER_ID=12345
```

---

### **STEP 3: Aktivuj tracking v backend**

V `server.mjs` pridaj endpoint pre affiliate tracking:

```javascript
// Read Partner ID from env
const HEUREKA_PARTNER_ID = process.env.HEUREKA_PARTNER_ID || null;

// Pass to frontend
app.get('/api/config', (req, res) => {
  res.json({
    heurekaPartnerId: HEUREKA_PARTNER_ID,
    alzaPartnerId: process.env.ALZA_PARTNER_ID || null,
    mallPartnerId: process.env.MALL_PARTNER_ID || null
  });
});
```

---

### **STEP 4: Update frontend (DONE! ✅)**

Frontend už má helper funkcie:
- `buildHeurekaAffiliateLink(productName, partnerId)`
- `buildAlzaAffiliateLink(productName, partnerId)`
- `buildMallAffiliateLink(productName, partnerId)`

Každý inzerát v modal okne má **🔍 Heureka** link!

---

## 💰 **REVENUE CALCULATION:**

### **Scenario 1: Conservative (1,000 users/mesiac)**
```
1,000 users × 5 searches/user = 5,000 searches
5,000 searches × 3 Heureka clicks/search = 15,000 clicks
15,000 clicks × 2% conversion = 300 purchases
300 purchases × €300 avg order × 3% commission = €2,700/mesiac
```

### **Scenario 2: Moderate (5,000 users/mesiac)**
```
5,000 users × 5 searches = 25,000 searches
25,000 × 3 clicks = 75,000 clicks
75,000 × 2% conversion = 1,500 purchases
1,500 × €300 × 3% = €13,500/mesiac
```

### **Scenario 3: Aggressive (10,000 users/mesiac)**
```
10,000 users × 5 searches = 50,000 searches
50,000 × 3 clicks = 150,000 clicks
150,000 × 2% conversion = 3,000 purchases
3,000 × €300 × 3% = €27,000/mesiac
```

---

## 🚀 **ADDITIONAL MONETIZATION (BONUS):**

### **1. AWIN Platform (všetky e-shopy naraz)**

**Registrácia:** https://www.awin.com/sk

**Výhody:**
- Jeden účet = prístup k 100+ SK/CZ e-shopom
- Heureka + Alza + Mall + Datart + všetci ostatní
- Profesionálne reporty + analytics
- Vyššie provízie (4-8%)

**Provízie (príklady):**
- Alza.sk: **2-3%**
- Mall.sk: **2-4%**
- Datart.sk: **3-5%**
- CZC.sk: **2-3%**

---

### **2. Google Shopping Ads (display ads)**

Ak máš 10k+ users:
- Pridaj Google AdSense banner ads
- €2-5 CPM (per 1000 views)
- 10k users × 10 pageviews = 100k views × €3 CPM = **€300/deň** = **€9,000/mesiac**

---

### **3. Premium Features (subscription)**

```javascript
// Example pricing
{
  "FREE": "5 searches/deň, basic results",
  "PREMIUM": "€4.99/mesiac - unlimited + price alerts",
  "PRO": "€9.99/mesiac - API access + advanced filters"
}
```

**Conservative:** 1000 users × 5% conversion × €4.99 = **€249/mesiac**

---

## 📊 **TOTAL REVENUE POTENTIAL:**

| Source | Conservative | Moderate | Aggressive |
|--------|-------------|----------|------------|
| Heureka Affiliate | €2,700 | €13,500 | €27,000 |
| AWIN (Alza+Mall) | €1,000 | €5,000 | €10,000 |
| Google AdSense | €500 | €2,500 | €9,000 |
| Premium Subs | €250 | €1,000 | €5,000 |
| **TOTAL/mesiac** | **€4,450** | **€22,000** | **€51,000** |

---

## ✅ **NEXT STEPS:**

1. ✅ **Teraz:** Registrovať sa na Heureka Partner Program
2. ✅ **Týždeň 1:** Pridať Partner ID do `.env.local`
3. ✅ **Týždeň 2:** Launch beta + sledovať clicks
4. ✅ **Mesiac 1:** Registrácia AWIN (Alza + Mall)
5. ✅ **Mesiac 2:** Pridať Google AdSense
6. ✅ **Mesiac 3:** Launch Premium tier

---

## 🎯 **CURRENT STATUS:**

✅ **Code:** READY (Heureka links implemented)  
⏳ **Partner ID:** WAITING (register at heureka.sk/partneri/)  
✅ **UI:** READY (🔍 Heureka link pri každom ad)  
✅ **Tracking:** READY (helper functions implemented)

**Revenue start:** As soon as you get Partner ID! 💰

---

## 📞 **HEUREKA SUPPORT:**

- Web: https://www.heureka.sk/partneri/
- Email: partneri@heureka.sk
- Phone: +421 2 3210 1111
- FAQ: https://www.heureka.sk/partneri/faq/

**Tip:** Spomeň že máš **AI-powered price comparison tool** s **1k-10k+ expected users** = vyššia šanca na schválenie!
