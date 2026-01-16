# 🎯 **QUALITY SCORING & PRICE COMPARISON - IMPLEMENTATION REPORT**

**Date:** 2026-01-12  
**Status:** ✅ **IMPLEMENTED**

---

## ✅ **ČO BOLO IMPLEMENTOVANÉ:**

### **1. QUALITY SCORING SYSTEM** 🏆

Každý inzerát dostane **0-100 bodový score** na základe:

#### **Negatívne faktory (znižujú score):**
- **Krátky názov** (< 10 znakov): -10 bodov
- **Reklamné slová** ("TOP", "SUPER", "AKCIA"): -5 bodov
- **Chýbajúce špecifikácie** (GB, TB, model): -5 bodov
- **Krátky popis** (< 50 znakov): -10 bodov
- **Cena outlier** (>50% od mediánu): -30 bodov
- **Podozrivé slová** ("nefunkčný", "pokazený"): -20 bodov

#### **Pozitívne faktory (zvyšujú score):**
- **Detailný popis** (>200 znakov): +5 bodov
- **Záruka/doklad** mentioned: +10 bodov
- **Nový stav**: +5 bodov

#### **Score Ranges:**
- **70-100** = ✓ **Overené** (high quality)
- **50-69** = ○ **Bežné** (medium quality)
- **0-49** = ⚠️ **Rizikové** (low quality)

---

### **2. PRICE COMPARISON DATA** 💰

Každá odpoveď teraz obsahuje:

```json
{
  "priceComparison": {
    "bazosAverage": 850,
    "bazosMedian": 800,
    "bazosMin": 400,
    "bazosMax": 1500,
    "googleShoppingUrl": "https://www.google.com/search?q=iPhone%2013%20k%C3%BApi%C5%A5%20cena&tbm=shop",
    "heurekaUrl": "https://www.heureka.sk/?h[fraze]=iPhone%2013"
  }
}
```

**Použitie:**
- Porovnať Bazoš vs Google Shopping
- Zobraziť "Porovnať s Heureka" link
- Identifikovať podozrivo lacné/drahé inzeráty

---

### **3. QUALITY STATS** 📊

Prehľad kvality všetkých inzerátov:

```json
{
  "qualityStats": {
    "highQuality": 12,
    "mediumQuality": 8,
    "lowQuality": 2,
    "averageScore": 72
  }
}
```

---

## 📋 **ŠTRUKTÚRA INZERÁTU:**

```json
{
  "title": "iPhone 13 Pro 256GB ZÁRUKA",
  "price": 799,
  "url": "https://...",
  "description": "...",
  
  // 🆕 NEW FIELDS:
  "qualityScore": 85,
  "confidence": "high",
  "badge": "✓ Overené",
  "qualityReasons": [
    "Detailný popis",
    "Záruka/doklad"
  ]
}
```

---

## 🎨 **UI IMPLEMENTATION (TODO):**

### **V Modal Window:**

```html
<div class="ad-item">
  <div class="ad-badge ${confidence}">
    ${badge}
  </div>
  <h3>${title}</h3>
  <div class="ad-price">${price}€</div>
  <div class="quality-score">
    Kvalita: <span class="score-${confidence}">${qualityScore}/100</span>
  </div>
  <div class="quality-reasons">
    ${qualityReasons.map(r => `<span>• ${r}</span>`).join('')}
  </div>
</div>
```

### **Price Comparison Section:**

```html
<div class="price-comparison">
  <h4>📊 Porovnanie cien</h4>
  <div class="price-stat">
    <span>Bazoš priemer:</span>
    <strong>${bazosAverage}€</strong>
  </div>
  <div class="price-stat">
    <span>Bazoš medián:</span>
    <strong>${bazosMedian}€</strong>
  </div>
  <a href="${googleShoppingUrl}" target="_blank">
    🔍 Porovnať s Google Shopping
  </a>
  <a href="${heurekaUrl}" target="_blank">
    🛒 Porovnať s Heureka
  </a>
</div>
```

---

## 🧪 **TESTOVACIE API:**

### **Získať kvalitné inzeráty:**
```bash
GET http://localhost:5510/api/market/search?query=iPhone+13&source=multi&limit=50
```

### **Response obsahuje:**
- `ads[]` - Každý s `qualityScore`, `badge`, `confidence`
- `priceComparison` - Štatistika cien + linky
- `qualityStats` - Prehľad kvality

---

## 📊 **EXPECTED RESULTS:**

### **High Quality (70-100):**
- "iPhone 13 Pro 256GB ZÁRUKA, TOP STAV, DOKLAD" - **85 bodov**
- "MacBook Pro M1 16GB/512GB, originál balenie" - **90 bodov**

### **Medium Quality (50-69):**
- "iPhone 13 128GB" - **60 bodov** (krátky popis)
- "MacBook Air predám" - **55 bodov** (chýbajú specs)

### **Low Quality (0-49):**
- "iPhone 13 nefunkčný na diely" - **30 bodov**
- "MacBook 5000€" - **25 bodov** (outlier price)

---

## 🏆 **BENEFITS:**

1. ✅ **Dôveryhodnosť** - Používatelia vidia ktoré inzeráty sú kvalitné
2. ✅ **Transparentnosť** - Jasné dôvody pre score
3. ✅ **Price checking** - Jednoduché porovnanie s trhom
4. ✅ **Fraud prevention** - Podozrivé inzeráty označené
5. ✅ **Heureka-level** - Profesionálne hodnotenie

---

## 🎯 **NEXT STEPS:**

1. ⏰ Počkať na reset Bazoš rate limitu (5-10 min)
2. 🧪 Otestovať quality scoring na reálnych dátach
3. 🎨 Implementovať UI pre badges a scores
4. 📊 Pridať grafické porovnanie cien

**Server:** http://localhost:5510 ✅ **READY WITH QUALITY SCORING!**
