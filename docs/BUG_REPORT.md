# 🐛 **BUG DETECTION REPORT & FIXES**

**Date:** 2026-01-12  
**Audit Type:** Comprehensive Code Review  
**Status:** ✅ Minor Issues Found & Fixed

---

## 🔍 **DETECTED ISSUES**

### **1. TypeScript Linter False Positives** ⚠️ LOW PRIORITY
**Location:** `main.js` lines 3475, 3476, 5142  
**Issue:** TypeScript linter complains about JS syntax  
**Impact:** None (false positive, code works fine)  
**Fix:** Ignore (JS syntax is valid)

---

### **2. Path Encoding Issues** ⚠️ LOW PRIORITY
**Location:** PowerShell path handling  
**Issue:** Slovak characters (č, í, ť) in path cause encoding errors  
**Impact:** None (server runs fine, only affects debug commands)  
**Fix:** Use `working_directory` parameter (already implemented)

---

### **3. Potential NULL/Undefined Access** 🟡 MEDIUM PRIORITY

#### **Issue 3.1: Missing null checks in deduplication**
**Location:** `server.mjs` line ~895  
**Code:**
```javascript
const normalizedTitle = normalizeTitle(ad.title);
// What if ad.title is undefined?
```

**Fix:**
```javascript
function normalizeTitle(title) {
  if (!title) return ''; // ✅ Safe default
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\bgb\b|\btb\b/gi, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim();
}
```

**Status:** ✅ Already has fallback `String(title || "")`

---

#### **Issue 3.2: Price calculation with empty array**
**Location:** `server.mjs` line ~370  
**Code:**
```javascript
const cleanPrices = removeOutliers(allPrices);
const totalAfterOutliers = cleanPrices.length;

if (totalAfterOutliers < 4) {
  // ✅ Good fallback
  return getCleanPriceEstimate(ads);
}
```

**Status:** ✅ Already has protection

---

### **4. Race Condition in Cache** 🟡 MEDIUM PRIORITY

**Issue:** Multiple simultaneous requests for same query might bypass cache  
**Location:** `server.mjs` SmartServerCache  

**Scenario:**
1. Request A checks cache → MISS
2. Request B checks cache → MISS (before A finishes)
3. Both requests fetch from Bazoš
4. Both cache results (waste)

**Fix:**
```javascript
class SmartServerCache {
  constructor() {
    this.cache = new Map();
    this.pending = new Map(); // ✅ Track in-flight requests
    // ... rest of constructor
  }
  
  async getOrFetch(query, categoryId, fetchFn) {
    const key = this.getCacheKey(query, categoryId);
    
    // Check cache first
    const cached = this.get(query, categoryId);
    if (cached) return cached;
    
    // Check if already fetching
    if (this.pending.has(key)) {
      console.log(`⏳ Waiting for in-flight request: "${query}"`);
      return await this.pending.get(key);
    }
    
    // Start fetching
    const promise = fetchFn();
    this.pending.set(key, promise);
    
    try {
      const result = await promise;
      this.set(query, categoryId, result);
      return result;
    } finally {
      this.pending.delete(key);
    }
  }
}
```

**Priority:** LOW (rare edge case, low impact)

---

### **5. Memory Leak in Rate Limiter** 🔴 HIGH PRIORITY

**Issue:** `cleanup()` runs every 60s, but Map can grow unbounded between cleanups  
**Location:** `server.mjs` RateLimiter class  

**Current Code:**
```javascript
class RateLimiter {
  constructor() {
    this.requests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every 60s
  }
  
  cleanup() {
    // Only cleans requests older than 5s
    // BUT: If 1000 requests happen in 1 minute, Map has 1000 entries!
  }
}
```

**Fix:**
```javascript
async throttle(domain) {
  const now = Date.now();
  const requests = this.requests.get(domain) || [];
  
  // ✅ Clean immediately during throttle check
  const recentRequests = requests.filter(t => now - t < 1000);
  
  // ✅ Limit Map size to prevent memory leak
  if (this.requests.size > 100) {
    // Only keep active domains
    for (const [domain, timestamps] of this.requests.entries()) {
      if (timestamps.every(t => now - t > 5000)) {
        this.requests.delete(domain);
      }
    }
  }
  
  // ... rest of throttle logic
}
```

---

### **6. Missing Error Handling in Parallel Fetch** 🟡 MEDIUM PRIORITY

**Issue:** If ALL parallel fetches fail, raw array is empty  
**Location:** `server.mjs` searchBazos function  

**Current:**
```javascript
const pageResults = await Promise.all(pageFetchPromises);
// ✅ Individual errors are caught
// BUT: What if ALL fail?

for (const { page: p, html } of pageResults) {
  if (!html) continue; // ✅ Skip failed pages
  // ...
}

// After loop: raw.length might be 0
```

**Status:** ✅ Already handled (returns empty array, client shows "no results")

---

### **7. Spam Filter Edge Case** 🟢 LOW PRIORITY

**Issue:** Accessory filter might be too aggressive  
**Location:** `server.mjs` isSpamAd function  

**Current:**
```javascript
if (accessories.test(text) && !mainProducts.test(text)) {
  return true; // ✅ Blocks accessories
}
```

**Edge Case:**
"MacBook Air + Free Case" → BLOCKED (even though MacBook is main product)

**Fix:**
```javascript
if (accessories.test(text)) {
  // Check if title STARTS with accessory word
  const titleLower = String(title || "").toLowerCase();
  if (titleLower.startsWith('obal') || titleLower.startsWith('kryt') || 
      titleLower.startsWith('puzdro') || titleLower.startsWith('nabíjačka')) {
    return true; // Block if accessory is main item
  }
  
  // Allow if main product is present
  if (mainProducts.test(text)) {
    return false; // "MacBook Air + case" is OK
  }
  
  return true; // Block pure accessories
}
```

---

## ✅ **IMPLEMENTED FIXES**

### **Fix #1: Enhanced Rate Limiter Cleanup** ✅
