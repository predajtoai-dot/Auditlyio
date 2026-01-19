# 🌍 **MULTI-SOURCE SEARCH - IMPLEMENTATION PLAN**

**Date:** 2026-01-12  
**Goal:** Nájsť relevantné inzeráty **VŠADE**, nie len na Bazoši!

---

## 🎯 **ZDROJE DAT:**

### **1. BAZOŠ.SK** ✅ **DONE**
- **Typ:** Bazár (používané)
- **Coverage:** Slovensko
- **Pros:** Veľa inzerátov, detailné info
- **Cons:** Rate limit, spam, zlá kvalita
- **Status:** ✅ Implementované (sequential fetch + spam filter)

### **2. GOOGLE SHOPPING** 🔄 **NEXT**
- **Typ:** Nové produkty (obchody)
- **Coverage:** Celý svet
- **Pros:** Overené obchody, presné ceny, fotky
- **Cons:** API platené (ale scraping možný)
- **API:** Google Shopping API (platené) alebo SerpAPI
- **Status:** ⬜ Implementujem teraz

### **3. HEUREKA.SK** 🔜 **PLANNED**
- **Typ:** Porovnávač cien (nové + bazár)
- **Coverage:** Slovensko + Česko
- **Pros:** Dôveryhodné, hodnotenia obchodov
- **Cons:** API vyžaduje partnera
- **API:** Heureka API (len pre partnerov) alebo scraping
- **Status:** ⬜ Plánované

### **4. MODRY KONIK** 🔜 **PLANNED**
- **Typ:** Bazár (používané)
- **Coverage:** Slovensko
- **Pros:** Konkurencia Bazoša, iné inzeráty
- **Cons:** Menší, možný rate limit
- **Status:** ⬜ Plánované

### **5. ĎALŠIE ZDROJE (optional):**
- **Alza.sk** - pre nové produkty
- **Mall.sk** - pre nové produkty
- **Nehnutelnosti.sk** - pre nehnuteľnosti
- **Amazon.de/sk** - medzinárodné

---

## 🚀 **IMPLEMENTATION STRATEGY:**

### **PHASE 1: Google Shopping (30 min)**
```javascript
// Option A: SerpAPI (platené, ale jednoduchšie)
async function searchGoogleShopping(query) {
  const apiKey = process.env.SERPAPI_KEY;
  const url = `https://serpapi.com/search?engine=google_shopping&q=${query}&api_key=${apiKey}`;
  const response = await fetch(url);
  return response.json();
}

// Option B: Free scraping (zložitejšie, ale zadarmo)
async function scrapeGoogleShopping(query) {
  const url = `https://www.google.com/search?q=${query}&tbm=shop`;
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0...' } });
  // Parse HTML...
}
```

**Zvolím:** Option B (free scraping) + fallback na Option A ak máme budget

### **PHASE 2: Heureka.sk (45 min)**
```javascript
async function searchHeureka(query) {
  const url = `https://www.heureka.sk/?h[fraze]=${encodeURIComponent(query)}`;
  const html = await fetch(url, { headers: { 'User-Agent': '...' } });
  // Parse products...
}
```

### **PHASE 3: Modry Konik (30 min)**
```javascript
async function searchModryKonik(query) {
  const url = `https://www.modrykonik.sk/hladaj/?q=${encodeURIComponent(query)}`;
  const html = await fetch(url);
  // Parse ads...
}
```

### **PHASE 4: Unified Search Endpoint (30 min)**
```javascript
app.get('/api/unified-search', async (req, res) => {
  const query = req.query.q;
  const sources = req.query.sources?.split(',') || ['bazos', 'google', 'heureka'];
  
  const results = await Promise.allSettled([
    sources.includes('bazos') ? searchBazos(query) : [],
    sources.includes('google') ? searchGoogleShopping(query) : [],
    sources.includes('heureka') ? searchHeureka(query) : [],
    sources.includes('modrykonik') ? searchModryKonik(query) : []
  ]);
  
  // Merge + deduplicate + score relevance
  const merged = mergeAndScore(results);
  
  return res.json({ ok: true, ads: merged, sources: sources.length });
});
```

---

## 📊 **RELEVANCE SCORING:**

```javascript
function calculateRelevanceScore(ad, query) {
  let score = 0;
  const queryWords = query.toLowerCase().split(/\s+/);
  const title = (ad.title || '').toLowerCase();
  
  // 1. Title match (40 points)
  const matchedWords = queryWords.filter(w => title.includes(w)).length;
  score += (matchedWords / queryWords.length) * 40;
  
  // 2. Source trust (30 points)
  if (ad.source === 'google') score += 30; // Google Shopping = verified
  else if (ad.source === 'heureka') score += 25;
  else if (ad.source === 'bazos') score += 15;
  else score += 10;
  
  // 3. Price reasonableness (20 points)
  if (ad.price > 0 && ad.price < 10000) score += 20; // Not outlier
  
  // 4. Quality indicators (10 points)
  if (ad.verified) score += 5;
  if (ad.imageUrl) score += 5;
  
  return Math.min(100, score);
}
```

---

## 🎨 **UI CHANGES:**

### **Multi-Source Toggle:**
```html
<div class="source-selector">
  <label>
    <input type="checkbox" value="bazos" checked> Bazoš
  </label>
  <label>
    <input type="checkbox" value="google" checked> Google Shopping
  </label>
  <label>
    <input type="checkbox" value="heureka" checked> Heureka
  </label>
  <label>
    <input type="checkbox" value="modrykonik"> Modrý Koník
  </label>
</div>
```

### **Source Badge in Results:**
```html
<span class="source-badge source-google">📦 Google</span>
<span class="source-badge source-heureka">🛒 Heureka</span>
<span class="source-badge source-bazos">🏪 Bazoš</span>
```

---

## ⏱️ **TIMELINE:**

- **00:00 - 00:30** → Google Shopping scraping
- **00:30 - 01:15** → Heureka scraping
- **01:15 - 01:45** → Modry Konik scraping
- **01:45 - 02:15** → Unified endpoint
- **02:15 - 02:45** → Relevance scoring
- **02:45 - 03:15** → UI implementation
- **03:15 - 03:30** → Testing

**TOTAL: ~3.5 hours** 🚀

---

## 🏆 **EXPECTED RESULT:**

**Input:** "iPhone 13 128GB"

**Output:**
```json
{
  "ok": true,
  "ads": [
    { "title": "iPhone 13 128GB Midnight", "price": 699, "source": "google", "relevanceScore": 95, "verified": true },
    { "title": "iPhone 13 128GB modrý", "price": 650, "source": "heureka", "relevanceScore": 92 },
    { "title": "iPhone 13 128GB", "price": 550, "source": "bazos", "relevanceScore": 85 },
    { "title": "iPhone 13 Pro 256GB", "price": 799, "source": "google", "relevanceScore": 78 }
  ],
  "count": 4,
  "sources": ["bazos", "google", "heureka"]
}
```

**= NAJRELEVANTNEJŠIE VÝSLEDKY Z CELÉHO INTERNETU! 🌍**

---

## 🎯 **NEXT:**

1. ✅ Začať s Google Shopping scraping
2. ✅ Implementovať Heureka scraping
3. ✅ Vytvoriť unified endpoint
4. ✅ Pridať relevance scoring
5. ✅ UI pre multi-source

**LET'S BUILD IT! 🚀**
