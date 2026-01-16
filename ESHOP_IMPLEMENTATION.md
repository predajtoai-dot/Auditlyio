# 🛒 **E-SHOP INTEGRATION - ALZA & MALL**

**Date:** 2026-01-12  
**Status:** ✅ **IMPLEMENTED & TESTING**

---

## ✅ **ČO BOLO PRIDANÉ:**

### **1. ALZA.SK SCRAPER** 🛒
```javascript
// server.mjs ~1390-1480
async function searchAlza(query, limit = 20)
```

**Funkcie:**
- ✅ HTML scraping z Alza.sk search
- ✅ Parse product tiles (`class="browsingitem"`)
- ✅ Extract: title, price, URL, image
- ✅ Error handling + fallback
- ✅ Returns verified e-shop products

**URL Format:**
```
https://www.alza.sk/search.htm?exps={query}
```

---

### **2. MALL.SK SCRAPER** 🛒
```javascript
// server.mjs ~1482-1572
async function searchMall(query, limit = 20)
```

**Funkcie:**
- ✅ HTML scraping z Mall.sk search
- ✅ Parse product cards (`<article class="product">`)
- ✅ Extract: title, price, URL
- ✅ Error handling
- ✅ Returns verified e-shop products

**URL Format:**
```
https://www.mall.sk/hladaj?q={query}
```

---

### **3. ENHANCED RELEVANCE SCORING**

**Updated trust levels:**
```javascript
// SOURCE TRUST (30 points max)
- Google Shopping: 30 pts (international, verified)
- Alza/Mall:       29 pts (major SK e-shops) ← NOVÉ!
- Heureka:         28 pts (price aggregator)
- Bazoš:           20 pts (user ads)
- Modrý Koník:     18 pts (smaller bazaar)
```

---

### **4. UNIFIED SEARCH ENDPOINT - UPDATED**

**Nové sources:**
```http
GET /api/unified-search?query={term}&sources=bazos,google,heureka,modrykonik,alza,mall
```

**Parallel fetching z 6 zdrojov:**
1. 🏪 Bazoš.sk (used)
2. 📦 Google Shopping (international)
3. 🛒 Heureka.sk (aggregator)
4. 🐴 Modrý Koník (SK bazaar)
5. 🛒 Alza.sk (SK e-shop) ← NOVÉ!
6. 🛒 Mall.sk (SK e-shop) ← NOVÉ!

---

### **5. UI - UPDATED**

**Nová štruktúra v modale:**

```html
🛒 E-SHOPY (nové produkty):
  ☑ Alza.sk - najväčší SK e-shop
  ☑ Mall.sk - overený e-shop

🏪 BAZÁRE (použité produkty):
  ☑ Bazoš.sk - bazár (použité)
  ☐ Modrý Koník - slovenský bazár

🌍 AGGREGÁTORY:
  ☑ Google Shopping - medzinárodné obchody
  ☑ Heureka.sk - porovnávač cien
```

**Default checked:** Alza + Mall + Bazoš + Google + Heureka

---

## 🧪 **TESTOVANIE:**

### **Test Case 1: iPhone 13**

**Príkaz:**
```bash
GET http://localhost:5510/api/unified-search?query=iPhone+13&sources=bazos,alza,mall,google,heureka&limit=30
```

**Expected Output:**
```json
{
  "ok": true,
  "ads": [
    { "title": "iPhone 13 128GB", "price": 649, "source": "alza", "relevanceScore": 93 },
    { "title": "iPhone 13 128GB", "price": 669, "source": "mall", "relevanceScore": 92 },
    { "title": "iPhone 13 128GB", "price": 550, "source": "bazos", "relevanceScore": 85 }
  ],
  "sourceStats": {
    "alza": 5,
    "mall": 4,
    "bazos": 8,
    "google": 3,
    "heureka": 2
  }
}
```

---

## ⚠️ **MOŽNÉ PROBLÉMY:**

### **1. Anti-Bot Protection**
**Symptóm:** Alza/Mall vracajú prázdne výsledky alebo 403/429

**Riešenie:**
- ✅ User-Agent headers (už implementované)
- ⚠️ Rate limiting (môže byť potrebný)
- ⚠️ CAPTCHA (unlikely na search stránke)

### **2. HTML Structure Changes**
**Symptóm:** Parser prestane fungovať po zmene dizajnu e-shopu

**Riešenie:**
- Pravidelné testy
- Flexibilné regex patterns
- Fallback na iné selektory

### **3. Performance**
**Symptóm:** Slow response (6 sources = 6 requests)

**Riešenie:**
- ✅ Parallel fetching (už implementované)
- ✅ Error handling (ak jeden zdroj failne, ostatné fungujú)
- Cache (planned)

---

## 📊 **EXPECTED RESULTS:**

### **Scenario A: Nový produkt (iPhone 13)**
```
1. Alza.sk:    649€ (nové, záruka, overené) ✓
2. Mall.sk:    669€ (nové, záruka, overené) ✓
3. Bazoš:      550€ (použité, bez záruky)
4. Google:     675€ (rôzne e-shopy)
5. Heureka:    640€ (agregované ceny)
```

**= USER VIDÍ NAJLEPŠIE CENY Z E-SHOPOV I BAZÁROV!**

### **Scenario B: StarÝ/rare produkt (MacBook 2015)**
```
1. Bazoš:      350€ (použité, dostupné)
2. Alza.sk:    0 results (už nepredávajú)
3. Mall.sk:    0 results
4. Google:     1-2 results (možno refurbished)
```

**= BAZÁR JE STÁLE RELEVANTNÝ!**

---

## 🎯 **ZLOŽITOSŤ ASSESSMENT:**

| Aspekt | Zložitosť | Status |
|--------|-----------|--------|
| **Alza scraping** | 🟡 Stredná | ✅ Implemented |
| **Mall scraping** | 🟡 Stredná | ✅ Implemented |
| **Anti-bot bypass** | 🔴 Vysoká | ⏳ Čaká na test |
| **Maintenance** | 🟡 Stredná | ⏳ Long-term |
| **Performance** | 🟢 Nízka | ✅ Parallel OK |

---

## 🚀 **STATUS:**

**✅ IMPLEMENTOVANÉ:**
- ✅ Alza.sk scraper
- ✅ Mall.sk scraper
- ✅ Enhanced relevance scoring
- ✅ Updated unified endpoint
- ✅ UI with e-shop checkboxes

**⏳ ČAKÁ NA TEST:**
- ⏳ Real search na Alza.sk
- ⏳ Real search na Mall.sk
- ⏳ Anti-bot detection check
- ⏳ Performance test (6 sources)

---

## 📝 **NEXT:**

1. **OTESTOVAŤ:** http://localhost:5510
2. **Zadaj:** "iPhone 13"
3. **Klikni:** "Získať cenu"
4. **V modale:** Zaškrtni Alza + Mall
5. **Klikni:** "🔍 Hľadať vo všetkých zdrojoch"
6. **Check:** Či sa zobrazujú výsledky z Alza/Mall

---

## 💡 **ALTERNATÍVA (ak scraping failne):**

Ak Alza/Mall majú prísnu anti-bot ochranu:

**Plan B: XML Feeds**
- Mnohé e-shopy majú XML/JSON feeds
- Hľadať `/feed.xml` alebo `/sitemap.xml`
- Alebo API key (partner program)

**Plan C: Third-party APIs**
- Použiť existujúce aggregátor APIs
- Napr. Heureka API (ak máme prístup)

---

**SERVER:** http://localhost:5510 ✅ **READY FOR TESTING!**

**= SKÚSME TO! 🚀**
