# 🧪 **MULTI-SOURCE SEARCH TEST REPORT**

**Date:** 2026-01-12  
**Test:** Bazoš + Heureka + Google Integration  
**Server:** ✅ Running on port 5510

---

## ✅ **SERVER STATUS**

```json
{
  "ok": true,
  "node": "v24.11.1",
  "cache": {
    "size": 0,
    "hitRate": 0,
    "ttl": 300000
  },
  "uptime": 31,
  "memory": {
    "used": "9 MB",
    "total": "11 MB"
  }
}
```

---

## 🧪 **TEST CASES**

### **Test 1: Multi-Source Search - MacBook**

**Command:**
```bash
GET /api/market/search?source=multi&query=MacBook&limit=50&category=13
```

**Expected Results:**
- ✅ Bazoš ads (parallel fetch, 5 pages)
- ✅ Heureka ads (via Google proxy)
- ✅ Deduplication across sources
- ✅ Spam filtering applied
- ✅ Outlier removal
- ✅ Cached for 5 minutes

**Console Logs to Watch:**
```javascript
🔍 Multi-source search: "MacBook"
⚡ Parallel fetch: 5 pages simultaneously...
🔎 Bazoš Engine: "MacBook" | Kategória: 13
🛍️ Heureka search via Google: "MacBook"
✅ Parallel fetch complete: 5 pages fetched
🚫 Spam filter: Removed X spam ads
🔄 Deduplication: X → Y unique
💾 Cache SET: "MacBook" (size: 1/1000)
```

---

### **Test 2: Cache Performance**

**Command:**
```bash
# First request (no cache)
GET /api/market/search?source=multi&query=iPhone&limit=20

# Second request (cached)
GET /api/market/search?source=multi&query=iPhone&limit=20
```

**Expected:**
- ✅ First request: 2-3 seconds
- ✅ Second request: <50ms (from cache)
- ✅ Hit rate increases

**Console Logs:**
```javascript
// First request
🔍 Multi-source search: "iPhone"
⚡ Parallel fetch: 5 pages simultaneously...
💾 Cache SET: "iPhone"

// Second request
⚡ Cache HIT: "iPhone" (1 hits, 0 misses, 100% hit rate)
⚡ Returning X ads from cache (0.05s)
```

---

### **Test 3: Heureka Integration (Google Proxy)**

**Expected:**
- ✅ Google search for "MacBook site:heureka.sk/bazosy"
- ✅ Extract Heureka URLs from Google results
- ✅ Parse title + price from Google snippets
- ✅ Fallback if Google blocks

**Console Logs:**
```javascript
🛍️ Heureka search via Google: "MacBook" (limit: 50)
🔍 Fetching via Google: https://www.google.com/search?q=...
✅ Google returned 12345 chars
🔗 Found 15 Heureka URLs from Google
✅ Heureka via Google: 15 ads (8 with prices)
```

---

### **Test 4: Spam Filter Across Sources**

**Expected:**
- ✅ Removes accessories from Bazoš
- ✅ Removes accessories from Heureka
- ✅ Removes "kúpim", "prenájom", broken items
- ✅ Only relevant ads remain

**Console Logs:**
```javascript
🚫 SPAM: Accessory - "MacBook nabíjačka"
🚫 SPAM: Intent filter - "Kúpim MacBook"
🚫 Spam filter: Removed 12 spam ads (85 → 73)
```

---

### **Test 5: Cross-Source Deduplication**

**Scenario:** Same ad appears on both Bazoš and Heureka

**Expected:**
- ✅ Normalized title comparison
- ✅ Same price detected
- ✅ Only one ad kept

**Console Logs:**
```javascript
🔄 Duplicate (title+price): "macbook pro 16 512" (800€)
🔄 Deduplication: 73 → 65 unique (removed 8 duplicates)
```

---

## 📊 **PERFORMANCE METRICS**

| Metric | Target | Status |
|--------|--------|--------|
| **Response Time (first)** | <3s | ⏱️ Testing |
| **Response Time (cached)** | <50ms | ⏱️ Testing |
| **Bazoš Ads** | 80-100 | ⏱️ Testing |
| **Heureka Ads** | 10-20 | ⏱️ Testing |
| **Spam Removal** | >10% | ⏱️ Testing |
| **Deduplication** | >5% | ⏱️ Testing |
| **Cache Hit Rate** | >50% | ⏱️ Testing |

---

## 🚀 **NEXT STEPS**

1. **Open browser:** http://localhost:5510
2. **Search:** "MacBook"
3. **Open DevTools Console** (F12)
4. **Watch logs** for multi-source fetching
5. **Search "MacBook" again** to test cache
6. **Check results** for quality and diversity

---

## 📞 **READY FOR TESTING**

✅ Server running  
✅ Multi-source enabled  
✅ Cache active  
✅ Spam filter active  
✅ Rate limiting active  

**Server:** http://localhost:5510  
**Health:** http://localhost:5510/api/health  

**Test endpointy pomocou browsera alebo Console log na hlavnej stránke!** 🎯
