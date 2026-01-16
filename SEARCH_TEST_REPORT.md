# 🧪 **SEARCH TESTING REPORT**

**Date:** 2026-01-12  
**Status:** ⚠️ BUGS FOUND & FIXED

---

## 🐛 **BUGS DETECTED:**

### **Bug #1: Rate Limiter Memory Leak** ✅ FIXED
- **Issue:** Map grew unbounded between 60s cleanups
- **Fix:** Added immediate cleanup during throttle check + Map size limit (100)
- **Status:** ✅ FIXED

### **Bug #2: Accessory Filter Too Permissive** ✅ FIXED
- **Issue:** "Ram 4gb kabel iphone" passed as iPhone
- **Fix:** Check if accessory is in first 5 words of title
- **Status:** ✅ FIXED

### **Bug #3: Relevance Filter Too Strict** ⚠️ PARTIALLY FIXED
- **Issue:** "iPhone 13" returns 0 results (all filtered out)
- **Root Cause:** Filter removed numbers ("13"), then couldn't find "iphone" in query
- **Fix Attempt #1:** Smart product extraction (macbook, iphone, samsung)
- **Result:** Now returns 1 result, but it's "MacBook Pro 13" (WRONG!)
- **Status:** ⚠️ NEEDS MORE WORK

### **Bug #4: Intent Filter Too Aggressive** ✅ FIXED
- **Issue:** Blocked normal "PREDÁM" ads
- **Fix:** Check title FIRST, only use description as secondary signal
- **Status:** ✅ FIXED

### **Bug #5: Duplicate Variable Declarations** ✅ FIXED
- **Issue:** `brokenIntents` and `text` declared twice
- **Fix:** Removed duplicates
- **Status:** ✅ FIXED

---

## 📊 **CURRENT TEST RESULTS:**

| Query | Results | Quality | Status |
|-------|---------|---------|--------|
| MacBook Pro 16GB 512GB | 14 ads | 14/14 relevant (100%) | ✅ PASS |
| iPhone 13 | 1 ad | 0/1 relevant (0%) | ❌ FAIL |
| Samsung Galaxy S23 | 0 ads | N/A | ❌ FAIL |

---

## 🎯 **NEXT STEPS:**

1. **Fix Relevance Filter:**
   - Require EXACT product match (e.g., "iPhone" for iPhone query)
   - Don't allow "MacBook Pro 13" when searching "iPhone 13"
   - Keep numbers separate from product names

2. **Test Edge Cases:**
   - "Samsung S23" (not "Samsung Galaxy S23")
   - "iPhone 14 Pro" vs "iPhone 14"
   - "MacBook Air" vs "MacBook Pro"

3. **Add Confidence Scoring:**
   - High confidence: Title starts with exact product
   - Medium confidence: Product mentioned but with accessories
   - Low confidence: Only number match (e.g., "13")

---

## 🏆 **TARGET:**

- ✅ 100% relevant ads
- ✅ No spam/accessories
- ✅ No false positives (wrong products)
- ✅ At least 5+ results per reasonable query
