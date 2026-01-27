import http from "node:http";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { MarketStore, buildSearchUrls } from "./marketStore.mjs";
import { BAZOS_CATEGORIES, getCategoryFromKeywords } from "./categories.mjs";
import { calculateProtectedPrice, median as calculateMedian } from "./pricingProtection.mjs";
import nodemailer from "nodemailer";
import https from "node:https";
import crypto from "node:crypto";
import { ProxyAgent } from "undici";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";

const execAsync = promisify(exec);

// SUPABASE INITIALIZATION
const supabaseUrl = process.env.SUPABASE_URL || "https://dbbhvaokhdrgawohappo.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_myBjYbRfS0G9VWj-a5mvaA_kPizADYd";
let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("🔗 Supabase client initialized.");
  } catch (err) {
    console.error("❌ Failed to initialize Supabase:", err.message);
  }
} else {
  console.warn("⚠️ Supabase credentials missing. Caching disabled.");
}

// Proxy configuration
const PROXY_URL = process.env.PROXY_URL || "";
const proxyDispatcher = PROXY_URL ? new ProxyAgent(PROXY_URL) : null;

if (proxyDispatcher) {
  console.log("🛡️ Proxy support enabled (Bazoš scraping will go through proxy)");
} else {
  console.warn("⚠️ No PROXY_URL found. Scraping directly from server IP (risky).");
}

// 🆕 PRODUCTION-GRADE IN-MEMORY CACHE
class SmartServerCache {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Max 1000 cached queries
    this.ttl = 5 * 60 * 1000; // 5 minutes TTL
    this.hits = 0;
    this.misses = 0;
  }
  
  getCacheKey(query, categoryId) {
    return `${query.toLowerCase().trim()}|${categoryId}`;
  }
  
  get(query, categoryId) {
    const key = this.getCacheKey(query, categoryId);
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() - cached.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      console.log(`⏰ Cache expired: "${query}"`);
      return null;
    }
    
    this.hits++;
    console.log(`⚡ Cache HIT: "${query}" (${this.hits} hits, ${this.misses} misses, ${this.getHitRate()}% hit rate)`);
    return cached.data;
  }
  
  set(query, categoryId, data) {
    const key = this.getCacheKey(query, categoryId);
    
    // LRU eviction: If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      console.log(`🗑️ Cache eviction: removed oldest entry`);
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
    
    console.log(`💾 Cache SET: "${query}" (size: ${this.cache.size}/${this.maxSize})`);
  }
  
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log(`🧹 Cache cleared`);
  }
  
  getHitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 0 : Math.round((this.hits / total) * 100);
  }
  
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.getHitRate(),
      ttl: this.ttl
    };
  }
}

// Global cache instance
const serverCache = new SmartServerCache();

// 🆕 RATE LIMITER - Prevent IP bans
class RateLimiter {
  constructor() {
    this.requests = new Map(); // domain -> [timestamps]
    this.maxRequestsPerSecond = 2; // Max 2 requests per second to Bazoš
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup every minute
  }
  
  async throttle(domain) {
    const now = Date.now();
    const requests = this.requests.get(domain) || [];
    
    // 🔧 FIX: Remove old requests immediately (prevent memory leak)
    const recentRequests = requests.filter(t => now - t < 1000);
    
    // 🔧 FIX: Limit Map size to prevent unbounded growth
    if (this.requests.size > 100) {
      console.log(`⚠️ Rate limiter cleanup: Map has ${this.requests.size} entries`);
      for (const [d, timestamps] of this.requests.entries()) {
        const recent = timestamps.filter(t => now - t < 5000);
        if (recent.length === 0) {
          this.requests.delete(d);
        } else {
          this.requests.set(d, recent);
        }
      }
      console.log(`✅ Rate limiter cleanup: Map now has ${this.requests.size} entries`);
    }
    
    // Check if we need to wait
    if (recentRequests.length >= this.maxRequestsPerSecond) {
      const oldestRequest = Math.min(...recentRequests);
      const waitTime = 1000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`⏱️ Rate limit: waiting ${waitTime}ms for ${domain}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Add current request
    recentRequests.push(Date.now());
    this.requests.set(domain, recentRequests);
  }
  
  cleanup() {
    const now = Date.now();
    for (const [domain, requests] of this.requests.entries()) {
      const recent = requests.filter(t => now - t < 5000);
      if (recent.length === 0) {
        this.requests.delete(domain);
      } else {
        this.requests.set(domain, recent);
      }
    }
  }
}

// Global rate limiter
const rateLimiter = new RateLimiter();

function decodeHtmlEntities(s) {
  return String(s || "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#039;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

// 🆕 ENHANCED SPAM FILTER - Production-Grade (Heureka-level)
function isSpamAd(title, description, price, query = "") {
  const titleLower = String(title || "").toLowerCase();
  const descLower = String(description || "").toLowerCase();
  const q = String(query || "").toLowerCase();
  
  // 1. INTENT FILTERS - Buying/Renting/Swapping (NOT selling)
  // 🔧 FIX: Check title FIRST, only use description as secondary signal
  const buyingIntents = /\b(kúpim|kupim|hľadám|hladam|potrebujem|chcem kúpiť|chcem kupit|zaujíma|zaujima|potreboval|hladal|kupil)\b/i;
  const rentingIntents = /\b(prenájom|prenajom|nájom|najom|na akciu|na mesiac|na týždeň|na tyžden)\b/i;
  const swappingIntents = /\b(vymením|vymenim|výmena|vymena|swap|trade)\b/i;
  
  // Primary check: Title (more reliable)
  if (buyingIntents.test(titleLower) || rentingIntents.test(titleLower)) {
    console.log(`🚫 SPAM: Intent filter (title) - "${title}"`);
    return true;
  }
  
  // Secondary check: Swapping (common in descriptions, but check title too)
  if (swappingIntents.test(titleLower)) {
    console.log(`🚫 SPAM: Swapping intent (title) - "${title}"`);
    return true;
  }
  
  // Check description ONLY if title is suspicious (has "PREDÁM" without product name)
  const hasSellingWord = /\b(predám|predam|predaj)\b/i.test(titleLower);
  const text = `${titleLower} ${descLower}`;
  
  if (!hasSellingWord && (buyingIntents.test(text) || rentingIntents.test(text) || swappingIntents.test(text))) {
    console.log(`🚫 SPAM: Intent filter (full text) - "${title}"`);
    return true;
  }
  
  // 2. BROKEN / PARTS-ONLY listings
  const brokenIntents = /\b(nefunk|poškod|poskod|diely|súčias|sucijas|oprava|servis|na diely|rozobrat|nefungu|nefunguje|pokazen|defekt|na opravu|rozbite|rozbit|na nahradne|nahradny|nahradné)\b/i;
  if (brokenIntents.test(titleLower) || brokenIntents.test(descLower)) {
    console.log(`🚫 SPAM: Broken/parts - "${title}"`);
    return true;
  }
  
  // 3. ACCESSORY FILTERS - Check BOTH title AND description
  const accessories = /\b(obal|puzdro|kryt|sklo|fólia|folia|nabíjačka|nabijacka|kábel|kabel|adaptér|adapter|slúchadlá|sluchadla|remienok|powerbank|redmi|miband|airdots|ovládač|ovladac|controller)\b/i;
  const mainProducts = /(telefon|mobil|tablet|notebook|laptop|macbook|iphone|ipad|samsung|apple|watch|hodinky|xiaomi|huawei)/i;
  
  // Use existing text variable from line 189
  if (accessories.test(text)) {
    // 🔧 CRITICAL FIX: Check if accessory is MAIN subject (in first 5 words of title)
    const titleWords = titleLower.split(/\s+/);
    const firstFiveWords = titleWords.slice(0, 5).join(' ');
    
    const accessoryKeywords = ['obal', 'kryt', 'puzdro', 'sklo', 'fólia', 'folia', 'nabíjačka', 'nabijacka', 'kábel', 'kabel', 'adaptér', 'adapter', 'slúchadlá', 'sluchadla', 'remienok', 'ovládač', 'ovladac', 'controller', 'powerbank'];
    
    // If accessory keyword is in first 5 words, it's likely the MAIN item
    const hasAccessoryInStart = accessoryKeywords.some(acc => firstFiveWords.includes(acc));
    
    if (hasAccessoryInStart) {
      // Even if main product is mentioned, accessory is primary
      console.log(`🚫 SPAM: Accessory is main item - "${title}"`);
      return true;
    }
    
    // Allow ONLY if main product is ALSO in first 5 words (e.g., "MacBook Pro + free case")
    const hasMainProductInStart = mainProducts.test(firstFiveWords);
    
    if (!hasMainProductInStart) {
      console.log(`🚫 SPAM: Pure accessory - "${title}"`);
      return true;
    }
    
    // If both main product AND accessory in start, keep it (e.g., "iPhone 13 + obal")
    // But only if main product comes FIRST
    const mainProductMatch = firstFiveWords.match(mainProducts);
    const accessoryMatch = accessoryKeywords.find(acc => firstFiveWords.includes(acc));
    
    if (mainProductMatch && accessoryMatch) {
      const mainProductIndex = firstFiveWords.indexOf(mainProductMatch[0]);
      const accessoryIndex = firstFiveWords.indexOf(accessoryMatch);
      
      if (accessoryIndex < mainProductIndex) {
        // Accessory comes first = it's main item
        console.log(`🚫 SPAM: Accessory before product - "${title}"`);
        return true;
      }
    }
  }
  
  // 4. EMPTY BOX SCAMS
  const emptyBox = /\b(krabica|obal od|balenie|prázdne|prazdne|len obal|iba obal|prázdny obal|prazdny obal|bez obsahu)\b/i;
  if (emptyBox.test(text)) {
    console.log(`🚫 SPAM: Empty box - "${title}"`);
    return true;
  }
  
  // 5. REAL ESTATE - Always filter
  if (/(predám byt|prenájom byt|byt \d|izb[ový]|apartmán|rodinný dom|stavebný pozemok|nebytový priestor|garsónk[au]|kancelárie)/i.test(text)) {
    console.log(`🚫 SPAM: Real estate - "${title}"`);
    return true;
  }
  
  // 6. VEHICLES - Filter when NOT searching for vehicles
  if (!/(auto|voz[ií]dlo|motorka|bicykel|kolobežka|skúter)/i.test(q)) {
    if (/(auto|voz[ií]dlo|motorka|moto|skúter|carplay|apple.*play|android.*auto)/i.test(text)) {
      console.log(`🚫 SPAM: Vehicle - "${title}"`);
      return true;
    }
  }
  
  // 7. JOBS & SERVICES
  if (/(hľadám prácu|ponúkam služby|brigáda|adopcia|darujeme|darujem|zoznamka)/i.test(text)) {
    console.log(`🚫 SPAM: Job/service - "${title}"`);
    return true;
  }
  
  // 8. PRICE ANOMALY - Too cheap = scam or accessory
  const numPrice = Number(price || 0);
  if (numPrice > 0 && numPrice < 20) {
    // MacBook/iPhone for 5€? Definitely accessories or broken
    if (/(macbook|iphone|ipad|samsung|notebook|laptop)/i.test(q)) {
      console.log(`🚫 SPAM: Suspicious price (${numPrice}€) - "${title}"`);
      return true;
    }
  }
  
  return false;
}

// 🔧 DEPRECATED: Keep for backwards compatibility
function isAccessoryTitle(title) {
  return isSpamAd(title, "", 0);
}

function isIrrelevantListing(title, query) {
  return isSpamAd(title, "", 0, query);
}

function tokenizeForMatch(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2)
    .filter((x) => !["mobile", "mobil", "telefón", "telefon", "smartfón", "smartfon", "predam", "predám"].includes(x));
}

function relevanceScore(query, title) {
  const q = tokenizeForMatch(query);
  const t = new Set(tokenizeForMatch(title));
  if (!q.length) return 0;
  let hit = 0;
  for (const tok of q) if (t.has(tok)) hit += 1;
  // Favor numeric-ish tokens (storage/ram models) a bit more if present
  const numHits = q.filter((x) => /\d/.test(x) && t.has(x)).length;
  const base = hit / q.length;
  return clamp(base + numHits * 0.08, 0, 1);
}

function pickTopRelevantAds(productName, ads, k = 3) {
  const q = String(productName || "").trim();
  const scored = (Array.isArray(ads) ? ads : [])
    .map((a) => ({ a, score: relevanceScore(q, a?.title || "") }))
    .sort((x, y) => (y.score - x.score) || (safeNumber(y.a?.price, 0) - safeNumber(x.a?.price, 0)));
  const picked = scored.slice(0, k).map((x) => x.a);
  const avgScore = scored.slice(0, k).length
    ? scored.slice(0, k).reduce((acc, x) => acc + x.score, 0) / scored.slice(0, k).length
    : 0;
  return { picked, avgScore };
}

function median(nums) {
  const arr = (Array.isArray(nums) ? nums : []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return 0;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

// 🆕 REMOVE PRICE OUTLIERS using MAD (Median Absolute Deviation)
// More robust than Z-score, less sensitive to extreme outliers
function removeOutliers(prices) {
  if (prices.length < 4) return prices;
  
  // Step 1: Calculate median
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  // Step 2: Calculate MAD (Median Absolute Deviation)
  const deviations = sorted.map(p => Math.abs(p - median));
  const mad = deviations.sort((a, b) => a - b)[Math.floor(deviations.length / 2)];
  
  // Step 3: Filter outliers (3x MAD threshold)
  const threshold = 3 * (mad || median * 0.1); // Fallback if MAD = 0
  const filtered = sorted.filter(p => Math.abs(p - median) <= threshold);
  
  const removed = sorted.filter(p => Math.abs(p - median) > threshold);
  
  if (removed.length > 0) {
    console.log(`🔬 Outlier removal: ${sorted.length} → ${filtered.length} prices`);
    console.log(`   Median: ${median}€, MAD: ${mad.toFixed(1)}, Threshold: ${threshold.toFixed(1)}`);
    console.log(`   Removed: ${removed.join('€, ')}€`);
  }
  
  return filtered;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURE MATHEMATICAL PRICE CALCULATION - Trimmed Mean (30% + 30% trim)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Calculate clean price estimate using PURE MATH - Trimmed Mean method:
 * 1. Take first 50 prices WITHOUT text filtering
 * 2. Sort all prices
 * 3. Remove bottom 30% (extremly low prices)
 * 4. Remove top 30% (extremly high prices)
 * 5. Calculate arithmetic mean of middle 40%
 * 
 * NO TEXT CONDITIONS - ONLY NUMBERS
 * 
 * @param {Array} ads - Array of ad objects with price property
 * @returns {Object} - { fairPrice, quickSale, maxProfit, adsUsed, adsTotal, pricingMethod }
 */
function getCleanPriceEstimate(ads) {
  const adsArray = Array.isArray(ads) ? ads : [];
  const allPrices = adsArray
    .map(a => Number(a?.price || 0))
    .filter(p => p > 0)
    .sort((a, b) => a - b);
  
  const total = allPrices.length;
  
  // Check if this is Google Shopping data (e-shop prices)
  const isGoogleShopping = adsArray.length > 0 && adsArray.every(a => String(a?.source || '') === 'google_shopping');
  
  console.log(`💰 Price Calculation Input: ${total} ads, range ${allPrices[0]}€ - ${allPrices[total-1]}€${isGoogleShopping ? ' (Google Shopping - e-shop prices)' : ''}`);
  
  // Not enough data - return zero with warning
  if (total < 4) {
    console.warn(`⚠️ Insufficient data: Only ${total} ads (need at least 4)`);
    return {
      fairPrice: 0,
      quickSale: 0,
      maxProfit: 0,
      adsUsed: total,
      adsTotal: total,
      pricingMethod: 'insufficient_data',
      warning: `Nedostatok dát (${total} inzeráty)`
    };
  }
  
  // 🆕 GOOGLE SHOPPING PRICING: Use 60% of average e-shop price
  if (isGoogleShopping) {
    const sum = allPrices.reduce((acc, p) => acc + p, 0);
    const avgEshopPrice = Math.round(sum / total);
    const fairPrice = Math.round(avgEshopPrice * 0.60); // 60% of e-shop average
    const quickSale = Math.round(fairPrice * 0.90);
    const maxProfit = Math.round(fairPrice * 1.10);
    
    console.log(`🛒 Google Shopping pricing: E-shop avg ${avgEshopPrice}€ → Used price ${fairPrice}€ (60%)`);
    console.log(`   Used ${total} e-shop prices (range: ${quickSale}€ - ${maxProfit}€)`);
    
    return {
      fairPrice,
      quickSale,
      maxProfit,
      adsUsed: total,
      adsTotal: total,
      adsRemoved: 0,
      pricingMethod: 'google_shopping_60pct',
      pricingSource: 'google_shopping_eshop'
    };
  }
  
  // BAZAAR PRICING: Use Trimmed Mean (remove bottom 30% and top 30%)
  // 🆕 STEP 1: Remove statistical outliers FIRST (MAD method)
  const cleanPrices = removeOutliers(allPrices);
  const totalAfterOutliers = cleanPrices.length;
  
  if (totalAfterOutliers < 4) {
    console.warn(`⚠️ Too few prices after outlier removal (${totalAfterOutliers}), using original data`);
    return getCleanPriceEstimate(ads); // Fallback
  }
  
  // 🆕 STEP 2: Apply Trimmed Mean to cleaned data
  const trimPercent = 0.30;
  const trimCount = Math.floor(totalAfterOutliers * trimPercent);
  const startIdx = trimCount;
  const endIdx = totalAfterOutliers - trimCount;
  
  // Extract middle 40% from CLEANED prices
  const middlePrices = cleanPrices.slice(startIdx, endIdx);
  const middleCount = middlePrices.length;
  
  console.log(`✂️ Trimming: Removed ${trimCount} lowest + ${trimCount} highest prices`);
  console.log(`📊 Middle 40%: ${middleCount} ads, range ${middlePrices[0]}€ - ${middlePrices[middleCount-1]}€`);
  
  // Calculate arithmetic mean of middle 40%
  const sum = middlePrices.reduce((acc, p) => acc + p, 0);
  const fairPrice = Math.round(sum / middleCount);
  
  // Calculate spread (90% for quick sale, 110% for patient seller)
  const quickSale = Math.round(fairPrice * 0.90);
  const maxProfit = Math.round(fairPrice * 1.10);
  
  console.log(`✅ Trimmed Mean Result: ${fairPrice}€ (range: ${quickSale}€ - ${maxProfit}€)`);
  console.log(`   Used ${middleCount}/${total} ads (removed ${trimCount*2} extremes)`);
  
  return {
    fairPrice,        // Trhový štandard (arithmetic mean of middle 40%)
    quickSale,        // Rýchly odbyt (90% of fair price)
    maxProfit,        // Maximálny výnos (110% of fair price)
    adsUsed: middleCount,
    adsTotal: total,
    adsRemoved: trimCount * 2,
    pricingMethod: 'trimmed_mean_40pct',
    pricingSource: 'bazos_pure_math'
  };
}

// Get subdomain for category-specific searches
function getBazosSubdomain(categoryId) {
  // If categoryId is a string (slug), return it directly
  if (typeof categoryId === 'string' && isNaN(Number(categoryId))) {
    return categoryId;
  }

  const subdomainMap = {
    0: "www",
    13: "pc",
    14: "mobil",
    15: "foto",
    16: "elektro",
    17: "sport",
    18: "hudba",
    19: "nabytok",
    20: "dom",
    21: "stroje",
    22: "oblecenie",
    23: "knihy",
    24: "detske",
    25: "zvierata",
    26: "auto",
    27: "reality",
    28: "sluzby",
    29: "praca",
  };
  return subdomainMap[categoryId] || "www";
}

// 🆕 AUTO-DETECT CATEGORY from search query
function detectCategory(query) {
  const q = String(query || "").toLowerCase();
  
  // PC Category (13) - Notebooks, Macbooks
  if (/\b(macbook|notebook|laptop|pc|imac|mac mini|mac pro)\b/i.test(q)) {
    return 13;
  }
  
  // Mobil Category (14) - Phones, tablets
  if (/\b(iphone|samsung|xiaomi|huawei|oneplus|google pixel|telefon|mobil|smartphone|ipad|tablet)\b/i.test(q)) {
    return 14;
  }
  
  // Foto Category (15) - Cameras
  if (/\b(canon|nikon|sony alpha|olympus|fujifilm|gopro|fotak|fotoaparat|kamera)\b/i.test(q)) {
    return 15;
  }
  
  // Elektro Category (16) - TVs, monitors, appliances
  if (/\b(tv|televiz|monitor|samsung tv|lg tv|chladnicka|pracka|mikrovlnka)\b/i.test(q)) {
    return 16;
  }
  
  // Sport Category (17)
  if (/\b(bicykel|kolo|lyze|snowboard|fitness|posilnovac|golf|pneu|pneumatiky)\b/i.test(q)) {
    return 17;
  }
  
  // Default to 0 (all categories) for better results
  return 0;
}

// 🆕 Get Bazoš category path (NOT hardcoded to /notebook/)
function getBazosCategoryPath(categoryId) {
  const pathMap = {
    13: "",          // PC - ROOT path (not /notebook/)
    14: "",          // 🔧 FIX: Mobily - ROOT path (not /mobil/)
    15: "foto",      // Foto
    16: "elektro",   // Elektro
    17: "",          // 🔧 FIX: Šport - ROOT path (not /sport/)
    18: "hudba",     // Hudba
    19: "nabytok",   // Nábytok
    20: "dom",       // Dom
    21: "stroje",    // Stroje
    22: "oblecenie", // Oblečenie
    23: "knihy",     // Knihy
    24: "detske",    // Detské
  };
  return pathMap[categoryId] || "";
}

// Get category price cap
function getCategoryPriceCap(categoryId) {
  const capsMap = {
    11: 5000,   // Dom a záhrada max 5000€
    13: 5000,   // PC max 5000€
    14: 2500,   // Mobily max 2500€
    15: 3000,   // Foto max 3000€
    16: 4000,   // Elektro max 4000€
    17: 2000,   // Šport max 2000€
    18: 3000,   // Hudba max 3000€
    19: 2000,   // Nábytok max 2000€
    20: 5000,   // Dom (sprchový kút, kosačka) max 5000€
    21: 4000,   // Stroje max 4000€
    22: 500,    // Oblečenie max 500€
    23: 200,    // Knihy max 200€
    24: 1000,   // Detské max 1000€
  };
  return capsMap[categoryId] || 10000; // Default 10000€
}

// Get price anchor (new price estimate from AI/Google)
async function getPriceAnchor(productName, categoryId) {
  if (!productName || !OPENAI_API_KEY) return null;
  
  try {
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    
    const prompt = `Odhadni cenu NOVÉHO kusu produktu "${productName}" v roku 2025 na slovenskom trhu.

PRAVIDLÁ:
- Ak poznáš tento produkt, vráť jeho priemerné ceny v e-shopoch (nie bazárové).
- Ak je to starší model (2-3 roky), vráť cenu keď bol nový.
- Ak produkt nepoznáš alebo nie si si istý, vráť null.
- Cena v €, bez DPH/s DPH ako bežne v obchodoch.

Vráť JSON:
{
  "priceNew": 450,
  "confidence": 0.9,
  "note": "iPhone 13 Pro 256GB - priemerná cena v e-shopoch"
}

Ak nepoznáš:
{
  "priceNew": null,
  "confidence": 0,
  "note": "Neznámy produkt"
}`;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Si expert na ceny spotrebnej elektroniky a produktov." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });
    
    if (!resp.ok) {
      console.warn("⚠️ Price anchor API failed:", resp.status);
      return null;
    }
    
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "{}";
    const result = JSON.parse(text);
    
    const price = Number(result?.priceNew || 0);
    const confidence = Number(result?.confidence || 0);
    
    if (price > 0 && confidence > 0.6) {
      console.log(`⚓ Price anchor: ${price}€ (confidence: ${Math.round(confidence * 100)}%)`);
      return price;
    }
    
    console.log(`⚠️ No reliable price anchor found`);
    return null;
  } catch (err) {
    console.error("❌ Price anchor error:", err);
    return null;
  }
}

// 🍎 RSS FEED FETCH - FASTER & MORE RELIABLE THAN HTML
async function fetchBazosRssFeed(query, categoryId = 0) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  await rateLimiter.throttle('bazos.sk');
  
  const subdomain = getBazosSubdomain(categoryId);
  const url = `https://${subdomain}.bazos.sk/rss.php?hledat=${encodeURIComponent(q)}`;
  
  console.log(`📡 RSS Feed: ${url}`);
  
  try {
    const fetchOptions = {
      method: "GET",
      headers: { 
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept": "application/rss+xml,application/xml,text/xml",
        "referer": "https://www.bazos.sk/"
      }
    };

    if (proxyDispatcher) {
      fetchOptions.dispatcher = proxyDispatcher;
    }

    const resp = await fetch(url, fetchOptions);
    
    if (!resp.ok) {
      console.error(`❌ RSS returned ${resp.status}`);
      return [];
    }
    
    const xml = await resp.text();
    console.log(`✅ RSS returned ${xml.length} chars`);
    
    // Parse RSS XML
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1];
      
      // Extract fields
      const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/);
      const linkMatch = itemXml.match(/<link>(.*?)<\/link>/);
      const descMatch = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/);
      const priceMatch = itemXml.match(/(\d+)\s*€/);
      
      if (titleMatch && linkMatch) {
        const title = titleMatch[1].trim();
        const url = linkMatch[1].trim();
        const description = descMatch ? descMatch[1].trim() : "";
        const price = priceMatch ? parseInt(priceMatch[1]) : 0;
        
        // Extract image URL from description (if exists)
        const imgMatch = description.match(/<img[^>]+src="([^"]+)"/);
        const imageUrl = imgMatch ? imgMatch[1] : null;
        
        items.push({
          title,
          url,
          description: description.replace(/<[^>]+>/g, '').trim(),
          price,
          imageUrl,
          condition: 90,
          source: "bazos"
        });
      }
    }
    
    console.log(`📊 RSS parsed: ${items.length} items`);
    return items;
  } catch (err) {
    console.error(`❌ RSS fetch error: ${err.message}`);
    return [];
  }
}

// 🍎 RAW BAZOŠ FETCH - NO PRICE FILTERS, NO CAPS, PURE 1:1
async function fetchBazosSearchHtmlRaw(query, page, categoryId = 0) {
  const q = String(query || "").trim();
  if (!q) return "";
  
  // Rate limiting
  await rateLimiter.throttle('bazos.sk');
  
  const subdomain = getBazosSubdomain(categoryId);
  const stranaParam = page > 1 ? (page - 1) * 20 : null;
  const categoryPath = getBazosCategoryPath(categoryId);
  
  // 🍎 NO PRICE FILTER - pure search like user typing in Bazoš.sk
  const base = categoryPath 
    ? `https://${subdomain}.bazos.sk/${categoryPath}/`
    : `https://${subdomain}.bazos.sk/`;
  const searchParam = `hledat=${encodeURIComponent(q)}`;
  const pageParam = stranaParam ? `strana=${stranaParam}` : "";
  
  // 🍎 MINIMAL PARAMS - same as Bazoš.sk search bar
  const staticParams = "hlokalita=&humkreis=25&cenaod=&cenado=&Submit=Hľadať";
  
  const params = [searchParam, pageParam, staticParams].filter(Boolean).join('&');
  const url = `${base}?${params}`;
  
  console.log(`🍎 RAW Bazoš: ${url} (page ${page}, NO FILTERS)`);
  
  try {
    const fetchOptions = { 
      method: "GET", 
      headers: { 
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "sk-SK,sk;q=0.9,en;q=0.8",
        "referer": "https://www.bazos.sk/"
      },
      timeout: 10000
    };

    if (proxyDispatcher) {
      fetchOptions.dispatcher = proxyDispatcher;
    }

    const resp = await fetch(url, fetchOptions);
    
    if (!resp.ok) {
      console.error(`❌ Bazoš RAW returned ${resp.status} ${resp.statusText}`);
      return "";
    }
    
    const text = await resp.text();
    console.log(`✅ Bazoš RAW returned ${text.length} chars`);
    return text;
  } catch (err) {
    console.error(`❌ RAW fetch error: ${err.message}`);
    return "";
  }
}

async function fetchBazosSearchHtml(query, page, categoryId = 0, priceAnchor = null) {
  const q = String(query || "").trim();
  if (!q) return "";
  
  // 🆕 RATE LIMITING: Wait if needed to avoid IP ban
  await rateLimiter.throttle('bazos.sk');
  
  // Use category-specific subdomain for better results
  const subdomain = getBazosSubdomain(categoryId);
  
  // 🆕 CORRECT URL FORMAT: Bazoš uses /{category}/?hledat=query&strana=X
  // Page number: page 1 = no param, page 2 = &strana=20, page 3 = &strana=40
  const stranaParam = page > 1 ? (page - 1) * 20 : null;
  
  // 🆕 GET CATEGORY PATH (not hardcoded /notebook/)
  const categoryPath = getBazosCategoryPath(categoryId);
  
  // 🆕 ADD PRICE FILTER: Set max price to 1.5x anchor (or category cap)
  const maxPrice = priceAnchor ? Math.round(priceAnchor * 1.5) : getCategoryPriceCap(categoryId);
  
  // Build clean URL with price filter
  // Format: https://pc.bazos.sk/?hledat=macbook&cenado=1000 (ROOT path for PC, page 1)
  // Format: https://pc.bazos.sk/?hledat=macbook&cenado=1000&strana=20 (page 2)
  // Format: https://mobil.bazos.sk/mobil/?hledat=iphone&cenado=800 (WITH category path)
  const base = categoryPath 
    ? `https://${subdomain}.bazos.sk/${categoryPath}/`
    : `https://${subdomain}.bazos.sk/`;
  const searchParam = `hledat=${encodeURIComponent(q)}`;
  const priceParam = maxPrice > 0 ? `cenado=${maxPrice}` : "";
  const pageParam = stranaParam ? `strana=${stranaParam}` : "";
  
  // 🔧 FIX: Don't hardcode rubriky=pc, subdomain already defines category
  const staticParams = "hlokalita=&humkreis=25&cenaod=&Submit=Hľadať&order=&crp=&kitx=ano";
  
  // Combine params
  const params = [searchParam, priceParam, pageParam, staticParams].filter(Boolean).join('&');
  const url = `${base}?${params}`;
  
  console.log(`🔍 Searching: ${url} (page ${page}, max price: ${maxPrice}€)`);
  
  try {
    const fetchOptions = { 
      method: "GET", 
      headers: { 
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "sk-SK,sk;q=0.9,en;q=0.8",
        "referer": "https://www.bazos.sk/"
      },
      timeout: 10000
    };

    if (proxyDispatcher) {
      fetchOptions.dispatcher = proxyDispatcher;
    }

    const resp = await fetch(url, fetchOptions);
    
    if (!resp.ok) {
      console.error(`❌ Bazoš returned ${resp.status} ${resp.statusText}`);
      return "";
    }
    
    const text = await resp.text();
    console.log(`✅ Bazoš returned ${text.length} chars`);
    
    // 🆕 DEBUG: Log first 500 chars to verify HTML structure
    if (text.length > 0 && text.length < 1000) {
      console.log(`⚠️ Response might be an error page (too short): ${text.substring(0, 500)}`);
    }
    
    return text;
  } catch (err) {
    console.error(`❌ Fetch failed:`, err.message);
    return "";
  }
}

function parseBazosAdsFromHtml(html, maxItems = 200, subdomain = "www") {
  const body = String(html || "");
  const raw = [];
  
  console.log(`🔍 HTML length: ${body.length} characters`);
  
  if (body.length === 0) {
    console.error(`❌ Empty HTML body - cannot parse`);
    return raw;
  }
  
  // 🆕 DEBUG: Check if HTML contains expected patterns
  const hasTitles = body.includes('class="nadpis"') || body.includes('class=nadpis');
  const hasPrices = body.includes('class="inzeratycena"') || body.includes('class=inzeratycena');
  console.log(`🔍 HTML structure check: titles=${hasTitles}, prices=${hasPrices}`);
  
  // IMPROVED PARSING: Extract titles, descriptions, and prices separately, then match them
  // Pattern 1: Extract titles with URLs
  const titlePattern = /<h2[^>]*class="?nadpis"?[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  const titles = [];
  let titleMatch;
  while ((titleMatch = titlePattern.exec(body)) && titles.length < maxItems * 3) {
    titles.push({
      url: titleMatch[1],
      title: decodeHtmlEntities(titleMatch[2]).trim()
    });
  }
  
  console.log(`📝 Found ${titles.length} titles`);
  
  // Pattern 2: Extract descriptions (text snippets after title)
  const descPattern = /<div[^>]*class="?popis"?[^>]*>(.*?)<\/div>/gis;
  const descriptions = [];
  let descMatch;
  while ((descMatch = descPattern.exec(body)) && descriptions.length < maxItems * 3) {
    const desc = decodeHtmlEntities(descMatch[1])
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    descriptions.push(desc);
  }
  
  console.log(`📄 Found ${descriptions.length} descriptions`);
  
  // Pattern 3: Extract prices
  const pricePattern = /<div[^>]*class="?inzeratycena"?[^>]*>.*?<b>.*?(\d+(?:[ .]?\d+)*)\s*€/gi;
  const prices = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(body)) && prices.length < maxItems * 3) {
    const priceStr = priceMatch[1].replace(/[^\d]/g, '');
    const price = Number(priceStr) || 0;
    if (price > 0) prices.push(price);
  }
  
  console.log(`💰 Found ${prices.length} prices`);
  
  // Match titles, descriptions, and prices (assume same order)
  const count = Math.min(titles.length, prices.length, maxItems);
  console.log(`🔗 Matching ${count} ads (titles=${titles.length}, descriptions=${descriptions.length}, prices=${prices.length}, max=${maxItems})`);
  
  for (let i = 0; i < count; i++) {
    const adUrl = titles[i].url;
    const title = titles[i].title;
    const description = descriptions[i] || ""; // May not have description
    const price = prices[i];
    
    if (!adUrl || !title || !(price > 0)) continue;
    
    // Convert relative URL to absolute URL
    const absoluteUrl = adUrl.startsWith("http") 
      ? adUrl 
      : `https://${subdomain}.bazos.sk${adUrl.startsWith("/") ? "" : "/"}${adUrl}`;
    
    raw.push({
      url: absoluteUrl,
      title,
      description, // 🆕 Include description for better spec extraction
      price,
      condition: 90,
      source: "bazos",
    });
  }
  
  console.log(`✅ Parsed ${raw.length} ads from HTML (with descriptions)`);
  
  // 🆕 DEBUG: Log first ad for testing
  if (raw.length > 0) {
    console.log(`📝 SAMPLE AD: "${raw[0].title}" | ${raw[0].price}€`);
  }
  
  return raw;
}

// Validate ad against price anchor (remove if 3x higher than new price)
function validateAdPrice(ad, priceAnchor) {
  if (!priceAnchor || priceAnchor <= 0) return true;
  
  const adPrice = Number(ad?.price || 0);
  if (adPrice <= 0) return false;
  
  // If ad price is more than 300% of new price, it's likely irrelevant (e.g., car vs computer)
  if (adPrice > priceAnchor * 3) {
    console.log(`❌ Rejected ad (price too high): "${ad.title}" (${adPrice}€ > ${priceAnchor * 3}€)`);
    return false;
  }
  
  return true;
}

// Stop-word filter (removes accessories, services, broken items, etc.)
function hasStopWords(title) {
  const stopWords = [
    // Accessories
    "obal", "puzdro", "kryt", "sklo", "fólia", "folia",
    "nabíjačka", "nabijacka", "kábel", "kabel", "adaptér", "adapter",
    "slúchadlá", "sluchadla", "remienok",
    // Services & broken
    "servis", "oprava", "nefunkčný", "nefunkcny", "poškodený", "poskodeny",
    "diely", "súčiastky", "suciastky", "náhradné diely", "nahradne diely",
    // Trading
    "vymením", "vymenim", "kúpim", "kupim", "hľadám", "hladam",
    // Empty boxes
    "krabica", "obal od", "balenie",
  ];
  
  const lowerTitle = String(title || "").toLowerCase();
  return stopWords.some(word => lowerTitle.includes(word));
}

// Strict title match - ad title must contain main keywords from user query
function matchesStrictTitle(adTitle, userQuery) {
  // Extract main keywords from user query (remove common words)
  const commonWords = ["a", "v", "z", "na", "s", "po", "pre", "od", "do", "bez"];
  const queryWords = String(userQuery || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !commonWords.includes(w));
  
  const lowerTitle = String(adTitle || "").toLowerCase();
  
  // At least 50% of query keywords must be in the title
  if (queryWords.length === 0) return true; // No strict keywords, allow all
  const matchCount = queryWords.filter(word => lowerTitle.includes(word)).length;
  return matchCount >= Math.ceil(queryWords.length * 0.5);
}

// Smart price floor - minimum price based on category to filter out accessories
function hasMinimumPrice(ad, categoryId) {
  const price = Number(ad?.price || 0);
  if (price <= 0) return false;
  
  // Electronics and branded products need higher floor
  const priceFloors = {
    13: 50,  // PC min 50€
    14: 30,  // Mobily min 30€
    15: 30,  // Foto min 30€
    16: 20,  // Elektro min 20€
    17: 15,  // Šport min 15€
    18: 20,  // Hudba min 20€
  };
  
  const minPrice = priceFloors[categoryId] || 10; // Default 10€
  return price >= minPrice;
}

// Strict blacklist validation (removes real estate, services, etc.)
function hasStrictBlacklistWords(title) {
  const blacklist = [
    "rodinný dom", "rod dom", "rod.dom",
    "byt", "apartmán", "apartman",
    "pozemok", "stavebný pozemok",
    "kancelárie", "kancelária",
    "nebytový priestor", "nebytove priestory",
    "rekonštrukcia domu", "rekonštrukcia bytu",
    "prenájom", "prenajom",
  ];
  
  const lowerTitle = String(title || "").toLowerCase();
  
  for (const word of blacklist) {
    if (lowerTitle.includes(word.toLowerCase())) {
      console.log(`🚫 Blacklisted: "${title}" (contains: ${word})`);
      return true;
    }
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 🆕 NORMALIZE TITLE for deduplication (case-insensitive, no spaces/punctuation)
// 🆕 QUALITY SCORING SYSTEM - Heureka-level
function calculateAdQualityScore(ad, query, allAds = []) {
  let score = 100; // Start with perfect score
  const reasons = [];
  
  const title = String(ad.title || "").trim();
  const description = String(ad.description || "").trim();
  const price = Number(ad.price || 0);
  
  // 1. TITLE QUALITY (max -20)
  if (title.length < 10) {
    score -= 10;
    reasons.push("Príliš krátky názov");
  }
  if (/\b(top|super|extra|akcia|zľava|výhodne|!!!)\b/i.test(title)) {
    score -= 5;
    reasons.push("Reklamné slová");
  }
  if (!title.match(/\d+gb|\d+tb|m\d|i\d|s\d\d/i)) {
    score -= 5;
    reasons.push("Chýbajú špecifikácie");
  }
  
  // 2. DESCRIPTION QUALITY (max -15)
  if (description.length < 50) {
    score -= 10;
    reasons.push("Krátky popis");
  } else if (description.length > 200) {
    score += 5; // Bonus for detailed description
    reasons.push("Detailný popis");
  }
  
  // 3. PRICE OUTLIER DETECTION (max -30)
  if (allAds.length > 5) {
    const prices = allAds.map(a => Number(a.price || 0)).filter(p => p > 0).sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];
    const priceDeviation = Math.abs(price - median) / median;
    
    if (priceDeviation > 0.5) { // More than 50% different from median
      score -= 30;
      reasons.push(`Cena ${price > median ? 'príliš vysoká' : 'podozrivo nízka'}`);
    } else if (priceDeviation > 0.3) {
      score -= 15;
      reasons.push("Cena mimo priemer");
    }
  }
  
  // 4. SUSPICIOUS KEYWORDS (max -20)
  const suspiciousWords = /\b(nefunkčn|pokazen|na diely|rozbit|bez záruky|bez dokladu|kradnut|ukradnut)\b/i;
  if (suspiciousWords.test(title + " " + description)) {
    score -= 20;
    reasons.push("Podozrivé slová");
  }
  
  // 5. TRUST SIGNALS (bonuses)
  if (/\b(záruka|garanc|doklad|faktúra|originál)\b/i.test(title + " " + description)) {
    score += 10;
    reasons.push("Záruka/doklad");
  }
  if (/\b(nový|nerozbalený|nepoužívan|sealed)\b/i.test(title + " " + description)) {
    score += 5;
    reasons.push("Nový stav");
  }
  
  // Normalize to 0-100
  score = Math.max(0, Math.min(100, score));
  
  // Determine confidence level
  let confidence = "high";
  let badge = "✓ Overené";
  
  if (score < 50) {
    confidence = "low";
    badge = "⚠️ Rizikové";
  } else if (score < 70) {
    confidence = "medium";
    badge = "○ Bežné";
  }
  
  return {
    score,
    confidence,
    badge,
    reasons: reasons.slice(0, 3) // Top 3 reasons
  };
}

// Export for use in searchBazos
globalThis.calculateAdQualityScore = calculateAdQualityScore;

function normalizeTitle(title) {
  return String(title || "")
    .toLowerCase()
    .replace(/\s+/g, ' ') // Normalize spaces
    .replace(/\bgb\b|\btb\b/gi, '') // Remove GB/TB
    .replace(/[^\p{L}\p{N}\s]/gu, '') // Remove punctuation
    .trim();
}

// 🆕 DEDUPLICATE ADS FROM MULTIPLE SOURCES (Production-Grade)
function deduplicateAds(ads) {
  const seenUrls = new Set();
  const seenNormalizedTitles = new Set(); // ✅ Use normalized titles
  const unique = [];
  
  for (const ad of ads) {
    const url = String(ad?.url || "").trim().toLowerCase();
    const normalizedTitle = normalizeTitle(ad.title);
    const price = Number(ad?.price || 0);
    
    if (!normalizedTitle || price <= 0) continue;
    
    const titlePriceKey = `${normalizedTitle}|${price}`;
    
    // Check duplicates
    const isDuplicateUrl = url && seenUrls.has(url);
    const isDuplicateTitle = seenNormalizedTitles.has(titlePriceKey);
    
    if (isDuplicateUrl || isDuplicateTitle) {
      if (isDuplicateUrl) {
        console.log(`🔄 Duplicate (URL): "${ad.title}"`);
      } else {
        console.log(`🔄 Duplicate (title+price): "${ad.title}" (${price}€)`);
      }
      continue;
    }
    
    // Mark as seen
    if (url) seenUrls.add(url);
    seenNormalizedTitles.add(titlePriceKey);
    unique.push(ad);
  }
  
  console.log(`🔄 Deduplication: ${ads.length} → ${unique.length} unique (removed ${ads.length - unique.length} duplicates)`);
  return unique;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURE BAZOŠ ENGINE - NO TEXT FILTERING, FIRST 50 ADS ONLY
// ═══════════════════════════════════════════════════════════════════════════════

async function searchBazos(query, limit = 70, categoryId = 0, priceAnchor = null) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  // 🆕 CHECK CACHE FIRST
  const cached = serverCache.get(q, categoryId);
  if (cached && Array.isArray(cached) && cached.length > 0) {
    console.log(`⚡ Returning ${cached.length} ads from cache`);
    return cached;
  }
  
  const targetAds = Number(limit) || 100; // 🆕 Target at least 100 ads for better sample
  const raw = [];
  
  // Get subdomain for this category
  const subdomain = getBazosSubdomain(categoryId);
  
  console.log(`🔎 Bazoš Engine: "${q}" | Kategória: ${categoryId} | Subdoména: ${subdomain}`);
  
  // 🆕 MULTI-PAGE FETCH: Pull at least 3 pages (60 ads minimum)
  // Each page ~20 ads, so 3 pages = ~60 ads, 10 pages = ~200 ads
  const minPages = 3; // Minimum 3 pages (60 ads)
  const maxPages = 3; // 🆕 REDUCED: Fetch 3 pages as requested
  
  // 🆕 DEDUPLICATE DURING FETCH to avoid processing duplicates
  const seenUrls = new Set();
  const seenTitlePrice = new Set();
  
  // 🔧 SEQUENTIAL FETCHES: Fetch pages one by one to avoid 429
  // Trade-off: Slower (~6-8s) but 100% reliable
  console.log(`⏳ Sequential fetch: ${maxPages} pages (1 by 1 with 5s delay)...`);
  
  const pageResults = [];
  for (let p = 1; p <= maxPages; p++) {
    try {
      const html = await fetchBazosSearchHtml(q, p, categoryId, priceAnchor);
      pageResults.push({ page: p, html });
      
      // Wait 5s between fetches (except after last page)
      if (p < maxPages) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.warn(`⚠️ Page ${p} fetch failed:`, err.message);
      pageResults.push({ page: p, html: null });
    }
  }
  
  console.log(`✅ Sequential fetch complete: ${pageResults.length} pages fetched`);
  
  // Process all pages (deduplicate as we go)
  for (const { page: p, html } of pageResults) {
    if (!html) {
      console.log(`⚠️ No HTML for page ${p}, skipping`);
      continue;
    }
    
    const pageAds = parseBazosAdsFromHtml(html, 200, subdomain);
    
    // 🆕 DEDUPLICATE IMMEDIATELY after parsing each page
    let newUniqueAds = 0;
    for (const ad of pageAds) {
      const url = String(ad?.url || "").trim().toLowerCase();
      const title = String(ad?.title || "").trim();
      const price = Number(ad?.price || 0);
      
      if (!title || price <= 0) continue;
      
      const titlePriceKey = `${title}|${price}`;
      
      // Check if duplicate
      const isDuplicateUrl = url && seenUrls.has(url);
      const isDuplicateTitle = seenTitlePrice.has(titlePriceKey);
      
      if (isDuplicateUrl || isDuplicateTitle) {
        // Skip duplicate, don't even add to raw array
        continue;
      }
      
      // Mark as seen
      if (url) seenUrls.add(url);
      seenTitlePrice.add(titlePriceKey);
      
      // Add to results
      raw.push(ad);
      newUniqueAds++;
    }
    
    console.log(`📄 Page ${p}: ${pageAds.length} ads, ${newUniqueAds} unique, ${pageAds.length - newUniqueAds} duplicates (total unique: ${raw.length})`);
  }

  console.log(`📦 Raw Bazoš results: ${raw.length} unique ads (after deduplication during fetch)`);

  // ═══════════════════════════════════════════════════════════════════════════════
  // 🆕 PRODUCTION-GRADE SPAM FILTERING WITH PROGRESSIVE BROADENING
  // ═══════════════════════════════════════════════════════════════════════════════
  
  const beforeSpamFilter = raw.length;
  
  // 🆕 PROGRESSIVE BROADENING: Try strict filter first, then relax if needed
  let filtered = raw.filter(ad => {
    // Apply enhanced spam filter
    if (isSpamAd(ad.title, ad.description || "", ad.price, q)) {
      return false; // Remove spam
    }
    
    // 🔧 STRICT: Require exact product match in title
    const queryLower = q.toLowerCase();
    let requiredProduct = null;
    
    // Define product patterns (order matters - check specific before general)
    const productPatterns = [
      { pattern: /\bmacbook\s+pro\b/i, name: 'macbook pro', variations: ['macbook pro', 'mbp'] },
      { pattern: /\bmacbook\s+air\b/i, name: 'macbook air', variations: ['macbook air', 'mba'] },
      { pattern: /\bmacbook\b/i, name: 'macbook', variations: ['macbook'] },
      { pattern: /\biphone\b/i, name: 'iphone', variations: ['iphone'] },
      { pattern: /\bipad\s+pro\b/i, name: 'ipad pro', variations: ['ipad pro'] },
      { pattern: /\bipad\s+air\b/i, name: 'ipad air', variations: ['ipad air'] },
      { pattern: /\bipad\s+mini\b/i, name: 'ipad mini', variations: ['ipad mini'] },
      { pattern: /\bipad\b/i, name: 'ipad', variations: ['ipad'] },
      { pattern: /\bsamsung\s+galaxy\b/i, name: 'samsung', variations: ['samsung galaxy', 'samsung', 'galaxy'] },
      { pattern: /\bsamsung\b/i, name: 'samsung', variations: ['samsung'] },
      { pattern: /\bxiaomi\b/i, name: 'xiaomi', variations: ['xiaomi'] },
      { pattern: /\bhuawei\b/i, name: 'huawei', variations: ['huawei'] },
      { pattern: /\boneplus\b/i, name: 'oneplus', variations: ['oneplus', 'one plus'] },
      { pattern: /\bgoogle\s+pixel\b/i, name: 'google pixel', variations: ['google pixel', 'pixel'] },
      { pattern: /\bnokia\b/i, name: 'nokia', variations: ['nokia'] }
    ];
    
    // Find which product is being searched for
    for (const { pattern, name, variations } of productPatterns) {
      if (pattern.test(queryLower)) {
        requiredProduct = { name, variations };
        break;
      }
    }
    
    // If we found a product requirement, enforce it
    if (requiredProduct) {
      const titleLower = String(ad.title || "").toLowerCase();
      const hasInTitle = requiredProduct.variations.some(v => titleLower.includes(v));
      
      if (!hasInTitle) {
        return false; // Title doesn't have required product
      }
    }
    
    return true;
  });
  
  const strictCount = filtered.length;
  console.log(`✅ Strict filter: ${beforeSpamFilter} → ${strictCount} ads`);
  
  // 🆕 PROGRESSIVE BROADENING: If < 15 ads, relax spec requirements
  if (strictCount < 15) {
    console.log(`⚠️ Only ${strictCount} ads - applying progressive broadening...`);
    
    // Extract specs from query (RAM/SSD/Year) and remove them for broader search
    const hasSpecs = /\b\d+gb\b|\b\d+tb\b|\bm\d\b|\b(pro|max|ultra|mini|air)\b/i.test(q);
    
    if (hasSpecs) {
      // Relax: Accept ads that match base product, ignore specs
      const baseQuery = q
        .toLowerCase()
        .replace(/\b\d+gb\b|\b\d+tb\b/gi, '') // Remove RAM/SSD
        .replace(/\b(m\d|pro max|pro|max|ultra|plus|mini|air)\b/gi, '') // Remove modifiers
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log(`🔧 Broadening from "${q}" to base: "${baseQuery}"`);
      
      filtered = raw.filter(ad => {
        // Apply spam filter (always)
        if (isSpamAd(ad.title, ad.description || "", ad.price, q)) {
          return false;
        }
        
        // Check if title contains base product
        const titleLower = String(ad.title || "").toLowerCase();
        const words = baseQuery.split(/\s+/).filter(w => w.length > 2);
        
        // Require at least ONE main word from base query
        const hasMatch = words.some(word => titleLower.includes(word));
        
        return hasMatch;
      });
      
      console.log(`📈 After broadening: ${strictCount} → ${filtered.length} ads`);
    }
  }
  
  // 🆕 GUARANTEE MIN 15 ADS: If still < 15, accept more generic matches
  if (filtered.length < 15 && filtered.length < beforeSpamFilter) {
    console.log(`⚠️ Still only ${filtered.length} ads - accepting generic matches for min 15 guarantee...`);
    
    // Final fallback: Just remove spam, keep all non-spam ads
    filtered = raw.filter(ad => {
      return !isSpamAd(ad.title, ad.description || "", ad.price, q);
    });
    
    console.log(`📈 Final count: ${filtered.length} ads (removed only spam)`);
  }
  
  const spamRemoved = beforeSpamFilter - filtered.length;
  if (spamRemoved > 0) {
    console.log(`🚫 Spam filter: Removed ${spamRemoved} spam ads (${beforeSpamFilter} → ${filtered.length})`);
  }
  
  const final = filtered.slice(0, targetAds);
  
  // 🆕 ADD QUALITY SCORES to each ad
  const finalWithScores = final.map(ad => {
    const quality = calculateAdQualityScore(ad, q, final);
    return {
      ...ad,
      qualityScore: quality.score,
      confidence: quality.confidence,
      badge: quality.badge,
      qualityReasons: quality.reasons
    };
  });
  
  console.log(`✅ Final Bazoš results: ${finalWithScores.length} ads (deduplicated + spam-filtered + quality scored)`);

  // 🆕 CACHE RESULTS
  if (finalWithScores.length > 0) {
    serverCache.set(q, categoryId, finalWithScores);
  }

  return finalWithScores;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE SHOPPING FALLBACK - When Bazoš returns 0 results
// ═══════════════════════════════════════════════════════════════════════════════

async function searchGoogleShopping(query, limit = 30) {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const GOOGLE_CX = process.env.GOOGLE_CX;
  
  if (!GOOGLE_API_KEY || !GOOGLE_CX) {
    console.warn("⚠️ Google API credentials missing - skipping Google Shopping fallback");
    return [];
  }
  
  const q = String(query || "").trim();
  if (!q) return [];
  
  console.log(`🔍 Google Shopping fallback: "${q}"`);
  
  const results = [];
  const maxResults = Math.min(limit, 30); // Max 30 results (3 pages × 10 results)
  const pagesNeeded = Math.ceil(maxResults / 10);
  
  try {
    for (let page = 1; page <= pagesNeeded && results.length < maxResults; page++) {
      const startIndex = (page - 1) * 10 + 1;
      const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(q + ' kúpiť cena')}&start=${startIndex}&num=10`;
      
      const response = await new Promise((resolve, reject) => {
        https.get(url, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, data }));
          res.on('error', reject);
        }).on('error', reject);
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Google API returned ${response.status}`);
        break;
      }
      
      const json = JSON.parse(response.data);
      const items = Array.isArray(json.items) ? json.items : [];
      
      for (const item of items) {
        if (results.length >= maxResults) break;
        
        const title = String(item.title || "").trim();
        const link = String(item.link || "").trim();
        const snippet = String(item.snippet || "").trim();
        
        // Extract price from snippet or pagemap
        let price = 0;
        const priceMatch = snippet.match(/(\d+(?:[,\s]\d+)*)\s*(?:€|EUR|Kč)/i);
        if (priceMatch) {
          const priceStr = priceMatch[1].replace(/[,\s]/g, '');
          price = Number(priceStr) || 0;
        }
        
        // Try pagemap for price
        if (!price && item.pagemap?.metatags?.[0]) {
          const meta = item.pagemap.metatags[0];
          const ogPrice = meta['og:price:amount'] || meta['product:price:amount'] || '';
          if (ogPrice) {
            price = Number(String(ogPrice).replace(/[^\d.]/g, '')) || 0;
          }
        }
        
        // Try pagemap product info
        if (!price && item.pagemap?.product?.[0]) {
          const product = item.pagemap.product[0];
          if (product.price) {
            price = Number(String(product.price).replace(/[^\d.]/g, '')) || 0;
          }
        }
        
        if (title && link) {
          results.push({
            title,
            url: link,
            price: price > 0 ? Math.round(price) : 0,
            condition: 100, // E-shop = new
            source: "google_shopping",
          });
        }
      }
      
      // Rate limiting: wait a bit between requests
      if (page < pagesNeeded) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    console.log(`📊 Google Shopping found: ${results.length} results`);
    return results;
    
  } catch (err) {
    console.warn(`⚠️ Google Shopping search failed:`, err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEUREKA.SK SCRAPING - Compare prices from verified Slovak shops
// ═══════════════════════════════════════════════════════════════════════════════

async function searchHeureka(query, limit = 30) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  console.log(`🔍 Heureka.sk search: "${q}"`);
  
  const results = [];
  const url = `https://www.heureka.sk/${encodeURIComponent(q)}`;
  
  try {
    const response = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, data }));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Heureka direct returned ${response.status}, trying Google fallback...`);
      return await searchHeurekaViaGoogle(q, limit);
    }
    
    const html = response.data;
    
    // Parse product cards from Heureka HTML
    // Heureka uses class="c-product" for product cards
    const productRegex = /<article[^>]*class="[^"]*c-product[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    const matches = [...html.matchAll(productRegex)];
    
    for (const match of matches) {
      if (results.length >= limit) break;
      
      const cardHtml = match[1];
      
      // Extract title
      const titleMatch = cardHtml.match(/<h3[^>]*class="[^"]*c-product__link[^"]*"[^>]*>([\s\S]*?)<\/h3>/i) ||
                         cardHtml.match(/<a[^>]*class="[^"]*c-product__link[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      // Extract price (format: "699 €" or "699,99 €")
      const priceMatch = cardHtml.match(/(\d+(?:\s?\d+)*(?:[,\.]\d+)?)\s*€/);
      let price = 0;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
        price = Math.round(Number(priceStr) || 0);
      }
      
      // Extract URL
      const urlMatch = cardHtml.match(/href="([^"]+)"/);
      const productUrl = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : `https://www.heureka.sk${urlMatch[1]}`) : '';
      
      // Extract shop name (optional)
      const shopMatch = cardHtml.match(/<span[^>]*class="[^"]*c-product__shop[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const shop = shopMatch ? shopMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      if (title && productUrl && price > 0) {
        results.push({
          title,
          url: productUrl,
          price,
          condition: 100, // Heureka = new products from shops
          source: "heureka",
          shop: shop || "Heureka obchod",
          verified: true // Heureka = verified shops
        });
      }
    }
    
    console.log(`📊 Heureka found: ${results.length} products`);
    return results;
    
  } catch (err) {
    console.warn(`⚠️ Heureka direct failed:`, err.message);
    return await searchHeurekaViaGoogle(q, limit);
  }
}

// HEUREKA VIA GOOGLE - Bypass anti-bot
async function searchHeurekaViaGoogle(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  console.log(`🔍 Heureka via Google: "${q}"`);
  
  try {
    const googleQuery = `${q} site:heureka.sk`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&num=20`;
    
    const response = await new Promise((resolve, reject) => {
      https.get(googleUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, data }));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Google search failed`);
      return [];
    }
    
    const html = response.data;
    const results = [];
    
    // Extract Heureka URLs
    const urlRegex = /https?:\/\/(?:www\.)?heureka\.sk\/[^\s"<>)]+/gi;
    const urls = [...new Set([...html.matchAll(urlRegex)].map(m => m[0]))];
    
    console.log(`🔗 Found ${urls.length} Heureka URLs via Google`);
    
    for (const url of urls.slice(0, limit)) {
      const urlEscaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titleMatch = html.match(new RegExp(`<h3[^>]*>([^<]+)</h3>[\\s\\S]{0,500}${urlEscaped}`, 'i'));
      const title = titleMatch ? titleMatch[1].trim() : '';
      
      const snippetMatch = html.match(new RegExp(`${urlEscaped}[\\s\\S]{0,300}`, 'i'));
      const snippet = snippetMatch ? snippetMatch[0] : '';
      const priceMatch = snippet.match(/(\d+(?:\s?\d+)*)\s*€/);
      const price = priceMatch ? parseInt(priceMatch[1].replace(/\s/g, ''), 10) : 0;
      
      if (title && url) {
        results.push({
          title: title.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
          url,
          price: price || 0,
          condition: 100,
          source: "heureka",
          shop: "Heureka",
          verified: true
        });
      }
    }
    
    console.log(`📊 Heureka via Google: ${results.length} products`);
    return results;
    
  } catch (err) {
    console.warn(`⚠️ Heureka via Google failed:`, err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODRY KONIK SCRAPING - Slovak bazaar competitor
// ═══════════════════════════════════════════════════════════════════════════════

async function searchModryKonik(query, limit = 30) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  console.log(`🔍 Modrý Koník search: "${q}"`);
  
  const results = [];
  const url = `https://www.modrykonik.sk/hladaj/?q=${encodeURIComponent(q)}`;
  
  try {
    const response = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sk-SK,sk;q=0.9',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, data }));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Modrý Koník returned ${response.status}`);
      return [];
    }
    
    const html = response.data;
    
    // Parse ad listings (similar to Bazoš structure)
    const adRegex = /<div[^>]*class="[^"]*inzerat[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const matches = [...html.matchAll(adRegex)];
    
    for (const match of matches) {
      if (results.length >= limit) break;
      
      const adHtml = match[1];
      
      // Extract title
      const titleMatch = adHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) ||
                         adHtml.match(/<a[^>]*class="[^"]*nadpis[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      // Extract price
      const priceMatch = adHtml.match(/(\d+(?:\s?\d+)*)\s*€/) || adHtml.match(/(\d+(?:\s?\d+)*)\s*EUR/i);
      let price = 0;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, '');
        price = Number(priceStr) || 0;
      }
      
      // Extract URL
      const urlMatch = adHtml.match(/href="([^"]+)"/);
      const adUrl = urlMatch ? (urlMatch[1].startsWith('http') ? urlMatch[1] : `https://www.modrykonik.sk${urlMatch[1]}`) : '';
      
      // Extract description (optional)
      const descMatch = adHtml.match(/<p[^>]*class="[^"]*popis[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
      const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      if (title && adUrl && price > 0) {
        results.push({
          title,
          url: adUrl,
          price,
          description,
          condition: 50, // Used items
          source: "modrykonik",
          verified: false
        });
      }
    }
    
    console.log(`📊 Modrý Koník found: ${results.length} ads`);
    return results;
    
  } catch (err) {
    console.warn(`⚠️ Modrý Koník search failed:`, err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// E-SHOP SCRAPERS - Get prices from Slovak e-shops
// ═══════════════════════════════════════════════════════════════════════════════

// ALZA.SK - Largest Slovak e-shop
async function searchAlza(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  console.log(`🛒 Alza.sk search: "${q}"`);
  
  try {
    const url = `https://www.alza.sk/search.htm?exps=${encodeURIComponent(q)}`;
    
    const response = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'sk-SK,sk;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, data }));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Alza returned ${response.status}`);
      return [];
    }
    
    const html = response.data;
    const results = [];
    
    // Parse Alza product tiles
    // Alza uses: <div class="browsingitem" ...>
    const productRegex = /<div[^>]*class="[^"]*browsingitem[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const matches = [...html.matchAll(productRegex)];
    
    for (const match of matches) {
      if (results.length >= limit) break;
      
      const cardHtml = match[1];
      
      // Extract title (usually in <a class="name">)
      const titleMatch = cardHtml.match(/<a[^>]*class="[^"]*name[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      // Extract price (format: "XXX €" or "XXX,XX €")
      const priceMatch = cardHtml.match(/(\d+(?:\s?\d+)*(?:[,\.]\d+)?)\s*€/);
      let price = 0;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
        price = Math.round(Number(priceStr) || 0);
      }
      
      // Extract URL
      const urlMatch = cardHtml.match(/href="([^"]+)"/);
      let productUrl = urlMatch ? urlMatch[1] : '';
      if (productUrl && !productUrl.startsWith('http')) {
        productUrl = `https://www.alza.sk${productUrl}`;
      }
      
      // Extract image
      const imgMatch = cardHtml.match(/src="([^"]+\.(jpg|png|webp)[^"]*)"/i);
      const imageUrl = imgMatch ? imgMatch[1] : null;
      
      if (title && productUrl && price > 0) {
        results.push({
          title,
          url: productUrl,
          price,
          condition: 100, // Alza = new products
          source: "alza",
          shop: "Alza.sk",
          verified: true,
          imageUrl
        });
      }
    }
    
    console.log(`📊 Alza found: ${results.length} products`);
    return results;
    
  } catch (err) {
    console.warn(`⚠️ Alza search failed:`, err.message);
    return [];
  }
}

// MALL.SK - Second largest Slovak e-shop
async function searchMall(query, limit = 20) {
  const q = String(query || "").trim();
  if (!q) return [];
  
  console.log(`🛒 Mall.sk search: "${q}"`);
  
  try {
    const url = `https://www.mall.sk/hladaj?q=${encodeURIComponent(q)}`;
    
    const response = await new Promise((resolve, reject) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'sk-SK,sk;q=0.9',
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, data }));
        res.on('error', reject);
      }).on('error', reject);
    });
    
    if (!response.ok) {
      console.warn(`⚠️ Mall returned ${response.status}`);
      return [];
    }
    
    const html = response.data;
    const results = [];
    
    // Parse Mall product cards
    // Mall uses: <div class="product-box" ...>
    const productRegex = /<article[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    const matches = [...html.matchAll(productRegex)];
    
    for (const match of matches) {
      if (results.length >= limit) break;
      
      const cardHtml = match[1];
      
      // Extract title
      const titleMatch = cardHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i) ||
                         cardHtml.match(/<a[^>]*title="([^"]+)"/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      // Extract price
      const priceMatch = cardHtml.match(/(\d+(?:\s?\d+)*(?:[,\.]\d+)?)\s*€/);
      let price = 0;
      if (priceMatch) {
        const priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
        price = Math.round(Number(priceStr) || 0);
      }
      
      // Extract URL
      const urlMatch = cardHtml.match(/href="([^"]+)"/);
      let productUrl = urlMatch ? urlMatch[1] : '';
      if (productUrl && !productUrl.startsWith('http')) {
        productUrl = `https://www.mall.sk${productUrl}`;
      }
      
      if (title && productUrl && price > 0) {
        results.push({
          title,
          url: productUrl,
          price,
          condition: 100,
          source: "mall",
          shop: "Mall.sk",
          verified: true
        });
      }
    }
    
    console.log(`📊 Mall found: ${results.length} products`);
    return results;
    
  } catch (err) {
    console.warn(`⚠️ Mall search failed:`, err.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RELEVANCE SCORING - Calculate how relevant each ad is to the search query
// ═══════════════════════════════════════════════════════════════════════════════

function calculateRelevanceScore(ad, query) {
  let score = 0;
  const queryLower = query.toLowerCase().trim();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length >= 3); // Ignore short words
  const title = String(ad.title || "").toLowerCase();
  const description = String(ad.description || "").toLowerCase();
  
  // 1. TITLE MATCH (40 points max)
  const matchedWords = queryWords.filter(word => title.includes(word)).length;
  score += (matchedWords / Math.max(queryWords.length, 1)) * 40;
  
  // Bonus: exact phrase match in title
  if (title.includes(queryLower)) {
    score += 10;
  }
  
  // 2. SOURCE TRUST (30 points max)
  const source = String(ad.source || "").toLowerCase();
  if (source === 'google' || source === 'google_shopping') {
    score += 30; // Google Shopping = verified shops
  } else if (source === 'alza' || source === 'mall') {
    score += 29; // Alza/Mall = major SK e-shops, very trusted
  } else if (source === 'heureka') {
    score += 28; // Heureka = verified shops + bazaar
  } else if (source === 'bazos') {
    score += 20; // Bazoš = user ads (lower trust)
  } else if (source === 'modrykonik') {
    score += 18; // Modrý Koník = smaller bazaar
  } else {
    score += 10; // Unknown source
  }
  
  // 3. PRICE REASONABLENESS (20 points max)
  const price = Number(ad.price || 0);
  if (price > 0) {
    // Price should be > 0 and not suspiciously low/high
    if (price >= 50 && price <= 5000) {
      score += 20; // Normal price range for most products
    } else if (price > 5000 && price <= 20000) {
      score += 15; // High-end products (MacBooks, etc)
    } else if (price < 50) {
      score += 5; // Suspiciously cheap (accessories/broken)
    } else {
      score += 10; // Very expensive (maybe OK)
    }
  }
  
  // 4. QUALITY INDICATORS (10 points max)
  if (ad.verified === true) score += 3;
  if (ad.imageUrl || ad.image) score += 2;
  if (ad.qualityScore && ad.qualityScore >= 70) score += 5; // High quality ad
  
  // 5. DESCRIPTION MATCH (bonus, up to 5 points)
  if (description) {
    const descMatchedWords = queryWords.filter(word => description.includes(word)).length;
    score += Math.min(5, descMatchedWords);
  }
  
  // Cap at 100
  return Math.min(100, Math.round(score));
}

// AI-powered relevance filter for Bazoš search results
async function filterAdsWithAI(ads, query) {
  if (!OPENAI_API_KEY || !Array.isArray(ads) || ads.length === 0) {
    return ads; // Fallback to regex filtering if no API key or no ads
  }
  
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  
  // Prepare ad titles for AI analysis
  const adTitles = ads.map((ad, idx) => `${idx}. ${ad.title}`).join("\n");
  
  const prompt = `Tu je zoznam inzerátov z Bazoš.sk. Porovnaj ich s hľadaným produktom '${query}'. 

KRITICKÁ ÚLOHA: Vymaž tie inzeráty, ktoré sú evidentne niečo iné (napr. autá pri hľadaní počítača, byty pri hľadaní nábytku). 

DÔLEŽITÉ: Tieto výsledky sa používajú na výpočet ceny produktu. Ak ponecháš irelevantné inzeráty (napr. auto za 15000€ pri hľadaní mobilu za 300€), odhad ceny bude úplne skreslený a nepoužiteľný!

═══════════════════════════════════════
HĽADANÝ PRODUKT: "${query}"
═══════════════════════════════════════

NÁJDENÉ INZERÁTY:
${adTitles}

═══════════════════════════════════════
PRAVIDLÁ FILTROVANIA:
═══════════════════════════════════════

✅ PONECHAJ inzeráty, ktoré sú:
- Presne ten istý produkt (iPhone 13 → iPhone 13 Pro ✓)
- Podobný model/variant (MacBook Air → MacBook Pro ✓)
- Rovnaká kategória (bicykel Trek → bicykel Scott ✓)

❌ VYMAŽ inzeráty, ktoré sú:
- Úplne iná kategória (hľadám počítač → našiel som auto ✗)
- Nehnuteľnosti (hľadám sprchu → našiel som byt so sprchou ✗)
- Vozidlá (hľadám mobil → našiel som auto s Bluetooth ✗)
- Služby/práca/adopcie (vždy vymaž ✗)
- Len príslušenstvo (hľadám iPhone → našiel som kryt na iPhone ✗)

═══════════════════════════════════════
PRÍKLADY:
═══════════════════════════════════════

❌ ZLYHANIE:
Hľadám: "apple počítač"
Ponechal si: "Auto Škoda s Apple CarPlay"
→ Výsledok: Cena auta (15000€) skreslila odhad ceny počítača!

✅ SPRÁVNE:
Hľadám: "apple počítač"
Vymazal si: "Auto Škoda s Apple CarPlay"
Ponechal si: "MacBook Air M2", "iMac 24", "Mac Mini M1"
→ Výsledok: Odhad ceny je presný (1200€)

═══════════════════════════════════════

Vráť len relevantné výsledky vo formáte JSON:
{
  "relevant": [0, 2, 5, 8],
  "removed": [1, 3, 4, 6, 7],
  "reason": "Vymazané: idx 1 (auto), idx 3 (byt), idx 4 (služba)..."
}`;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Si inteligentný filter pre vyhľadávanie. Vraciaš len validný JSON." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!resp.ok) {
      console.warn("AI filter failed, using all ads");
      return ads;
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const relevantIndices = Array.isArray(parsed.relevant) ? parsed.relevant : [];
    const removedIndices = Array.isArray(parsed.removed) ? parsed.removed : [];
    
    // Log filtering details for debugging
    if (removedIndices.length > 0) {
      const removedTitles = removedIndices.map(idx => ads[idx]?.title).filter(Boolean);
      console.log(`[AI Filter] Query: "${query}"`);
      console.log(`[AI Filter] Kept: ${relevantIndices.length}/${ads.length} ads`);
      console.log(`[AI Filter] Removed: ${removedTitles.join(", ")}`);
      console.log(`[AI Filter] Reason: ${parsed.reason || "N/A"}`);
    }
    
    // Return only relevant ads
    const filtered = ads.filter((_, idx) => relevantIndices.includes(idx));
    
    // If AI filtered out everything, return original ads (AI might be too strict)
    if (filtered.length === 0) {
      console.warn("[AI Filter] Filtered out all ads, returning original results");
      return ads;
    }
    
    return filtered;
  } catch (err) {
    console.warn("AI filter error:", err.message);
    return ads; // Fallback to original ads
  }
}

function parseHeurekaPricesFromHtml(html, query) {
  const body = String(html || "");
  const lower = body.toLowerCase();
  // Heureka often serves bot-protection pages.
  const blocked =
    lower.includes("checking security") ||
    lower.includes("cloudflare") ||
    lower.includes("cf-browser-verification") ||
    lower.includes("attention required");
  if (blocked) return { blocked: true, prices: [], reason: "blocked" };

  // Best-effort: find occurrences of price ranges like "495,00 – 916,77 €"
  const rangeRe = /(\d[\d\s.,]*)\s*[–-]\s*(\d[\d\s.,]*)\s*€/g;
  const singleRe = /(\d[\d\s.,]*)\s*€/g;

  const norm = (x) => {
    const t = String(x || "")
      .trim()
      .replace(/\s+/g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.]/g, "");
    const parts = t.split(".").filter(Boolean);
    if (!parts.length) return 0;
    if (parts.length === 1) return Number(parts[0] || 0);
    const dec = parts.pop();
    return Number(`${parts.join("")}.${dec}`);
  };

  const candidates = [];
  let m;
  while ((m = rangeRe.exec(body))) {
    const a = norm(m[1]);
    const b = norm(m[2]);
    if (!(a > 0) || !(b > 0)) continue;
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    candidates.push({ min, max, idx: m.index });
  }

  // If we have many ranges (accessories etc.), pick the first one that appears near the query tokens.
  if (candidates.length) {
    const q = String(query || "").toLowerCase().replace(/\s+/g, " ").trim();
    const tokens = q.split(" ").filter((t) => t.length >= 2);
    const scoreAt = (idx) => {
      const win = lower.slice(Math.max(0, idx - 350), Math.min(lower.length, idx + 350));
      let s = 0;
      for (const t of tokens) if (win.includes(t)) s += 1;
      return s;
    };
    candidates.sort((x, y) => scoreAt(y.idx) - scoreAt(x.idx));
    return { blocked: false, prices: [candidates[0]] };
  }

  // Fallback to a single price if no range found
  const singles = [];
  while ((m = singleRe.exec(body)) && singles.length < 40) {
    const v = norm(m[1]);
    if (v > 0) singles.push(v);
  }
  const minSingle = singles.length ? Math.min(...singles) : 0;
  if (minSingle > 0) return { blocked: false, prices: [{ min: minSingle, max: 0 }] };

  return { blocked: false, prices: [], reason: "not_found" };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use /tmp on Vercel (serverless), local ./data in development
const isVercel = process.env.VERCEL === "1" || process.env.NOW_REGION;
const dataDir = isVercel ? "/tmp/predajto-data" : path.join(__dirname, "data");
const market = new MarketStore({ baseDir: dataDir });

async function loadLocalEnv() {
  // Lightweight dotenv-style loader (no deps). Reads "./env.local" if it exists.
  const p = path.join(__dirname, "env.local");
  try {
    const raw = await fs.readFile(p, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const s = line.trim();
      if (!s || s.startsWith("#")) continue;
      const idx = s.indexOf("=");
      if (idx <= 0) continue;
      const key = s.slice(0, idx).trim();
      let val = s.slice(idx + 1).trim();
      if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore if missing
  }
}

await loadLocalEnv();

// Default 5510 to avoid collisions with Live Server/Cursor (often uses 5500/5501).
const PORT = Number(process.env.PORT || 5510);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY || "";

// 🆕 LOGGING FOR DEPLOYMENT DEBUG
if (OPENAI_API_KEY) {
  const maskedKey = OPENAI_API_KEY.substring(0, 7) + "..." + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4);
  console.log(`🔑 OpenAI API Key loaded: ${maskedKey}`);
} else {
  console.warn("⚠️ CRITICAL: OPENAI_API_KEY is MISSING in environment variables!");
}

// Email configuration for feedback notifications
const EMAIL_CONFIG = {
  recipient: process.env.FEEDBACK_EMAIL || process.env.GMAIL_USER || "predajto.ai@gmail.com",
  from: process.env.EMAIL_FROM || "onboarding@resend.dev",
  resendApiKey: process.env.RESEND_API_KEY || "",
};

if (EMAIL_CONFIG.resendApiKey) {
  console.log("📧 Email notifications enabled (via Resend API)");
} else {
  console.warn("⚠️ Email notifications disabled (missing RESEND_API_KEY)");
}

// ============================================
// RATE LIMITING
// ============================================
// In-memory store: { IP: [timestamp1, timestamp2, ...] }
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hodina
const RATE_LIMIT_MAX_REQUESTS = 100; // max 100 generovaní za hodinu (zvýšené z 5 pre testovanie)

function getClientIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    "unknown"
  );
}

function checkRateLimit(ip) {
  const now = Date.now();
  const timestamps = rateLimitStore.get(ip) || [];
  
  // Vyčisti staré requesty (staršie ako 1 hodina)
  const validTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  
  if (validTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestRequest = Math.min(...validTimestamps);
    const resetIn = Math.ceil((oldestRequest + RATE_LIMIT_WINDOW_MS - now) / 1000 / 60);
    return { allowed: false, resetIn };
  }
  
  // Pridaj nový timestamp
  validTimestamps.push(now);
  rateLimitStore.set(ip, validTimestamps);
  
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - validTimestamps.length };
}

// Automatické čistenie starých záznamov každých 10 minút
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitStore.entries()) {
    const valid = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitStore.delete(ip);
    } else {
      rateLimitStore.set(ip, valid);
    }
  }
}, 10 * 60 * 1000);

// Send feedback email notification
async function sendFeedbackEmail(feedback) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ Resend API key missing, email NOT sent.");
    return;
  }

  const emoji = feedback.type === "positive" ? "👍" : "👎";
  const subject = `${emoji} ${feedback.type === "positive" ? "Pozitívny" : "Negatívny"} feedback - ${feedback.productName || "Neznámy produkt"}`;
  
  const pricingHtml = feedback.pricing ? `
    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
      <h3 style="margin-top: 0; color: #166534;">💰 Cenový odhad:</h3>
      <p style="margin: 5px 0;"><strong>Rýchly odbyt:</strong> ${feedback.pricing.quick} €</p>
      <p style="margin: 5px 0;"><strong>Trhový štandard:</strong> ${feedback.pricing.market} €</p>
      <p style="margin: 5px 0;"><strong>Maximálny výnos:</strong> ${feedback.pricing.premium} €</p>
    </div>
  ` : "";

  const adsCountHtml = feedback.adsUsed ? `
    <p style="margin: 10px 0; color: #6b7280; font-size: 13px;">
      📊 Vypočítané z <strong>${feedback.adsUsed}</strong> inzerátov.
    </p>
  ` : "";

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: ${feedback.type === "positive" ? "#22c55e" : "#ef4444"}; margin-top: 0;">
        ${emoji} ${feedback.type === "positive" ? "Pozitívny" : "Negatívny"} feedback
      </h2>
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Produkt:</strong> ${feedback.productName || "Neznámy"}</p>
        <p><strong>Čas:</strong> ${new Date(feedback.timestamp).toLocaleString("sk-SK")}</p>
        <p><strong>Typ:</strong> ${feedback.type}</p>
        ${feedback.userEmail ? `<p><strong>Od:</strong> ${feedback.userEmail}</p>` : ""}
        ${feedback.feedbackMessage ? `<p><strong>Správa:</strong> ${feedback.feedbackMessage}</p>` : ""}
      </div>

      ${pricingHtml}
      ${adsCountHtml}

      <div style="background: #fff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px;">
        <h3 style="margin-top: 0;">Vygenerovaný text inzerátu:</h3>
        <p style="white-space: pre-wrap; font-size: 14px; color: #374151;">${feedback.adText}</p>
      </div>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
          from: "Auditly.io <onboarding@resend.dev>", // Použi overenú doménu v Resend, ak máš
          to: [EMAIL_CONFIG.recipient],
          subject: subject,
          html: htmlBody,
          reply_to: feedback.userEmail || undefined
      })
    });
    
    if (res.ok) {
        console.log("📧 Email sent via Resend API");
    } else {
        const err = await res.text();
        console.error("❌ Resend API Error:", err);
    }
  } catch (err) {
    console.error("❌ Failed to send email via Resend:", err);
  }
}

// Send beta signup email notification
async function sendBetaSignupEmail(email, productName = "") {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const subject = `🎉 Nový beta používateľ: ${email}`;
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3b82f6;">🎉 Nový beta používateľ</h2>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
        <p><strong>Email:</strong> ${email}</p>
        ${productName ? `<p><strong>Prvý produkt:</strong> ${productName}</p>` : ""}
        <p><strong>Čas:</strong> ${new Date().toLocaleString("sk-SK")}</p>
      </div>
    </div>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
          from: "Auditly.io Beta <onboarding@resend.dev>",
          to: [EMAIL_CONFIG.recipient],
          subject: subject,
          html: htmlBody
      })
    });
  } catch (err) {
    console.error("❌ sendBetaSignupEmail error:", err);
  }
}

// Send notification about generated ad
async function sendAdGeneratedEmail(userEmail, adData, input, pricing) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const subject = `📝 Nový inzerát: ${adData.title}`;
  const similarCount = Array.isArray(input.similarAds) ? input.similarAds : [];
  
  const similarAdsHtml = similarCount.slice(0, 5).map(ad => `
    <li style="margin-bottom: 5px;">
      ${ad.title} - <strong>${ad.price}€</strong>
    </li>
  `).join('');

  const pricingHtml = pricing ? `
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="margin-top: 0; color: #166534;">💰 Cenový odhad:</h3>
      <p style="margin: 5px 0;"><strong>Trhový štandard:</strong> ${pricing.recommended} €</p>
      <p style="margin: 5px 0;"><strong>Rýchly odbyt:</strong> ${pricing.quick} €</p>
      <p style="margin: 5px 0;"><strong>Maximálny výnos:</strong> ${pricing.premium} €</p>
    </div>
  ` : "";

  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #3b82f6; margin-top: 0;">📝 Nový vygenerovaný inzerát</h2>
      
      <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>Používateľ:</strong> ${userEmail || "Neznámy (neprihlásený)"}</p>
        <p style="margin: 5px 0;"><strong>Produkt:</strong> ${input.productName || "Neznámy"}</p>
        <p style="margin: 5px 0;"><strong>Stav:</strong> ${input.notes || "neuvedené"}</p>
        <p style="margin: 5px 0;"><strong>Počet inzerátov:</strong> ${similarCount.length}</p>
      </div>

      ${pricingHtml}
      
      <div style="background: #fff; border: 1px solid #e5e7eb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="margin-top: 0; color: #374151;">Vygenerovaný text:</h3>
        <p style="font-weight: bold; font-size: 16px; margin-bottom: 10px; color: #111827;">${adData.title}</p>
        <div style="white-space: pre-wrap; font-size: 14px; color: #374151; line-height: 1.6;">${adData.desc}</div>
      </div>

      ${similarCount.length > 0 ? `
        <div style="padding: 15px; background: #f3f4f6; border-radius: 8px;">
          <h4 style="margin-top: 0; color: #4b5563;">🔍 Podobné inzeráty z analýzy:</h4>
          <ul style="padding-left: 20px; font-size: 13px; color: #6b7280;">
            ${similarAdsHtml}
          </ul>
        </div>
      ` : ""}
      
      <div style="margin-top: 20px; font-size: 11px; color: #9ca3af; text-align: center;">
        Tento e-mail bol automaticky odoslaný po vygenerovaní inzerátu na Auditly.io
      </div>
    </div>
  `;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
          from: "Auditly.io Generator <onboarding@resend.dev>",
          to: [EMAIL_CONFIG.recipient],
          subject: subject,
          html: htmlBody
      })
    });
    console.log(`📧 Notification email sent for: ${adData.title}`);
  } catch (err) {
    console.error("❌ sendAdGeneratedEmail error:", err);
  }
}

// Send review feedback email notification (ads verification)
async function sendReviewFeedbackEmail(feedbackData) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;

  const subject = `🔍 Review Feedback - ${feedbackData.query || "Neznámy produkt"}`;
  
  const removedAdsList = feedbackData.removedAds.length > 0
    ? feedbackData.removedAds.map((ad, i) => 
        `${i + 1}. ${ad.title} (${ad.price}€) - ${ad.url || "bez URL"}`
      ).join("\n")
    : "Žiadne inzeráty neboli odstránené";
  
  const htmlBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #3b82f6;">🔍 Review Feedback - Verifikácia</h2>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px;">
        <p><strong>Hľadaný produkt:</strong> ${feedbackData.query || "Neznámy"}</p>
        <p><strong>Čas:</strong> ${new Date(feedbackData.timestamp).toLocaleString("sk-SK")}</p>
        <p><strong>Odstránených inzerátov:</strong> ${feedbackData.removedAds.length}</p>
      </div>
      ${feedbackData.feedback ? `<p><strong>Správa:</strong> ${feedbackData.feedback}</p>` : ""}
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
          from: "Auditly.io Review <onboarding@resend.dev>",
          to: [EMAIL_CONFIG.recipient],
          subject: subject,
          html: htmlBody
      })
    });
    if (res.ok) console.log("📧 Review email sent via Resend");
    else console.error("❌ Resend Review Error:", await res.text());
  } catch (err) {
    console.error("❌ sendReviewFeedbackEmail error:", err);
  }
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-expose-headers": "x-predajto-server",
    "x-predajto-server": "node",
  };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...corsHeaders() });
  res.end(JSON.stringify(body));
}

// 📧 EMAIL SENDING UTILITY
async function sendAuditEmail(email, auditId, productName, forcedBaseUrl = null) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const baseUrl = (forcedBaseUrl || process.env.BASE_URL || "https://auditlyio.sk").replace(/\/+$/, "");
  const publicLink = `${baseUrl}/?report=${auditId}`;
  const privateLink = `${baseUrl}/?expert=${auditId}`;
  const dashboardLink = `${baseUrl}/?audit=${auditId}`;
  const fromEmail = process.env.EMAIL_FROM || "Auditly.io <onboarding@resend.dev>";

  const emailHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #1e293b; margin: 0;">Auditly.io</h1>
        <p style="color: #94a3b8; font-size: 14px;">Váš expertný auditný systém</p>
      </div>
      <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-bottom: 25px;">
      <p style="font-size: 16px; color: #475569;">Dobrý deň,</p>
      <p style="font-size: 16px; color: #475569;">Váš technický audit pre zariadenie <strong>${productName}</strong> bol úspešne vygenerovaný.</p>
      
      <div style="margin: 30px 0; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">🚀 Váš Celkový Expertný Report (pre Vás)</h3>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 15px;">Obsahuje kompletnú analýzu na hlavnej stránke dashboardu. Platnosť 72 hodín.</p>
        <a href="${dashboardLink}" style="display: inline-block; background-color: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Otvoriť celkový audit</a>
      </div>

      <div style="margin: 30px 0; padding: 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">🌐 Váš Verejný Certifikát (do inzerátu)</h3>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 15px;">Tento odkaz môžete vložiť do popisu inzerátu na Bazoši. Platnosť 30 dní.</p>
        <a href="${publicLink}" style="display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Otvoriť verejný report</a>
      </div>

      <div style="margin: 30px 0; padding: 20px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">🔐 Váš Súkromný Report (Modal)</h3>
        <p style="font-size: 14px; color: #64748b; margin-bottom: 15px;">Detailný report v modálnom okne. Platnosť 72 hodín.</p>
        <a href="${privateLink}" style="display: inline-block; background-color: #64748b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px;">Otvoriť súkromný report</a>
      </div>

      <div style="background: #fffbeb; padding: 15px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #fde68a;">
        <p style="font-size: 13px; color: #92400e; margin: 0; line-height: 1.5;">
          💡 <strong>Tip:</strong> K svojim auditom sa môžete kedykoľvek vrátiť na stránke <a href="${baseUrl}" style="color: #8b5cf6;">auditlyio.sk</a> kliknutím na "Moje Audity" a zadaním vášho e-mailu.
        </p>
      </div>
      
      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px;">
        Expertný report je platný 72 hodín, verejný certifikát 30 dní. © 2026 Auditly.io
      </p>
    </div>
  `;

  // 1. TRY RESEND FIRST IF API KEY EXISTS
  if (resendApiKey) {
    try {
      console.log(`📧 [Resend] Attempting to send audit links to ${email}`);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: `Váš technický audit pre ${productName} je pripravený!`,
          html: emailHtml,
        }),
      });
      if (res.ok) {
        console.log(`✅ [Resend] Audit links sent successfully to ${email}`);
        
        // Notify Admin via Resend too
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail && adminEmail !== email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: adminEmail,
              subject: `🔔 Nový audit: ${productName}`,
              html: `<h3>Nový audit bol vygenerovaný</h3><p><strong>Produkt:</strong> ${productName}</p><p><strong>Email:</strong> ${email}</p><p><strong>Private:</strong> <a href="${privateLink}">${privateLink}</a></p><p><strong>Public:</strong> <a href="${publicLink}">${publicLink}</a></p>`,
            }),
          });
        }
        return;
      } else {
        const err = await res.json();
        console.warn("⚠️ [Resend] Failed, falling back to SMTP:", err);
      }
    } catch (e) {
      console.error("❌ [Resend] Error, falling back to SMTP:", e.message);
    }
  }

  // 2. FALLBACK TO SMTP (NODEMAILER)
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn("⚠️ [Email] SMTP credentials missing and Resend failed. Email not sent.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false }
  });

  try {
    await transporter.sendMail({
    from: `"Auditly.io 🛡️" <${smtpUser}>`,
    to: email,
    subject: `Váš technický audit pre ${productName} je pripravený!`,
      html: emailHtml,
    });
    console.log(`✅ [SMTP] Audit links sent successfully to ${email}`);
  } catch (error) {
    console.error(`❌ [SMTP] Failed to send email to ${email}:`, error.message);
  }
}

// 🔐 AUTH UTILITIES
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function roundToStep(v, step) {
  if (!step || step <= 0) return Math.round(v);
  return Math.round(v / step) * step;
}

function extractEuroPricesFromText(textRaw) {
  const text = String(textRaw || "");
  if (!text) return [];
  // Matches like: "499 €", "1 299€", "1,299 €", "1299.00 EUR", "1299,00€"
  const re =
    /(\d{1,3}(?:[ \u00A0.,]\d{3})*|\d{1,6})(?:[.,](\d{1,2}))?\s*(?:€|eur|EUR)/g;
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    const intPart = String(m[1] || "")
      .replace(/[ \u00A0]/g, "")
      .replace(/\.(?=\d{3}\b)/g, "")
      .replace(/,(?=\d{3}\b)/g, "")
      .replace(/,/g, ".");
    const frac = m[2] ? `.${m[2]}` : "";
    const num = Number(`${intPart}${frac}`);
    if (!Number.isFinite(num)) continue;
    // Filter absurd values
    if (num < 10 || num > 20000) continue;
    out.push(Math.round(num));
  }
  return out;
}

function pickNewPriceFromText(textRaw) {
  const prices = extractEuroPricesFromText(textRaw);
  if (!prices.length) return 0;
  // For "od 499 €" style texts, lowest is usually the best proxy for new price.
  return Math.min(...prices);
}

// NEW: Protected pricing with multi-layer filtering
async function computePricingProtected(input) {
  const productName = String(input.productName || "").trim();
  const categoryId = safeNumber(input.categoryId, 16); // Default to Elektro
  const notes = String(input.notes || "");
  const conditionPercent = clamp(safeNumber(input.conditionPercent, 90), 70, 100);
  const batteryPercent = clamp(safeNumber(input.batteryPercent, 0), 0, 100);
  
  // Get all ads from similar ads - NO FILTERING
  const similar = Array.isArray(input.similarAds) ? input.similarAds : [];
  const bazaarAds = similar
    .filter((a) => safeNumber(a?.price, 0) > 0) // Only filter: must have valid price
    // NO TEXT FILTERING, NO SOURCE FILTERING - take ALL ads
    .map(a => ({
      title: String(a?.title || ""),
      price: safeNumber(a?.price, 0),
      condition: safeNumber(a?.condition, 90),
      source: String(a?.source || "bazos")
    }));
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // PURE MATH: Trimmed Mean (30% + 30% trim) - NO TEXT CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  const priceResult = getCleanPriceEstimate(bazaarAds);
  
  // Transform to old format for backward compatibility
  const step = safeNumber(input.step, 5);
  const min = safeNumber(input.min, 0);
  const max = safeNumber(input.max, 1_000_000);
  const newPrice = safeNumber(input.newPrice, 0);
  const isNewAvailable = Boolean(input.isNewAvailable) && newPrice > 0;
  
  // Check if insufficient data
  if (priceResult.pricingMethod === 'insufficient_data') {
    console.warn("⚠️ Insufficient data from Bazoš - cannot estimate price");
    return {
      insufficientData: true,
      message: priceResult.warning || "Nedostatok overených dát z bazárov.",
      adsUsed: priceResult.adsUsed,
      adsTotal: priceResult.adsTotal
    };
  }
  
  // Use clean price results from Trimmed Mean calculation
  let fair = clamp(roundToStep(priceResult.fairPrice, step), min, max);
  let quick = clamp(roundToStep(priceResult.quickSale, step), min, max);
  let premium = clamp(roundToStep(priceResult.maxProfit, step), min, max);
  
  // PRICE CAPS: Enforce retail price limits (if new price is available)
  let priceCapped = false;
  if (isNewAvailable && newPrice > 0) {
    const maxAllowed = Math.round(newPrice * 0.9); // Max 90% of retail
    const fallbackPrice = Math.round(newPrice * 0.7); // 70% fallback
    
    // If bazaar price exceeds retail price, use 70% fallback
    if (fair > newPrice) {
      console.warn(`⚠️ Bazaar price (${fair}€) > Retail (${newPrice}€). Enforcing 70% cap: ${fallbackPrice}€`);
      fair = fallbackPrice;
      quick = Math.round(fallbackPrice * 0.85);
      premium = Math.round(fallbackPrice * 1.1);
      priceCapped = true;
    }
    // If fair price exceeds 90% of retail, cap it
    else if (fair > maxAllowed) {
      console.warn(`⚠️ Bazaar price (${fair}€) > 90% of retail (${maxAllowed}€). Capping at 90%.`);
      fair = maxAllowed;
      quick = Math.round(maxAllowed * 0.85);
      premium = Math.round(maxAllowed * 1.05);
      priceCapped = true;
    }
    
    // Ensure premium never exceeds 90% of retail
    if (premium > maxAllowed) {
      premium = maxAllowed;
      priceCapped = true;
    }
    
    // Round to step
    fair = roundToStep(fair, step);
    quick = roundToStep(quick, step);
    premium = roundToStep(premium, step);
  }
  
  // Detect state from notes
  const isUnboxed = /(rozbalen|iba\s+rozbalen|len\s+rozbalen)/i.test(notes);
  const isUsed = /(pou[zž]ívan|pouzivan|be[zž]ne\s+pou[zž]i)/i.test(notes) || !isUnboxed;
  const stateMult = isUnboxed ? 0.85 : 1.0;
  
  const valuePct = isNewAvailable && newPrice > 0 ? Math.round((fair / newPrice) * 100) : null;
  const status = isNewAvailable ? "available" : "unavailable";
  
  return {
    fair,
    quick,
    premium,
    newPrice: isNewAvailable ? Math.round(newPrice) : null,
    valuePct,
    state: isUnboxed ? "unboxed" : "used",
    stateMult,
    bazaarUsedCount: priceResult.adsUsed,
    bazaarNeedMin: 4, // NEW: Lower threshold (was 15)
    bazaarMin: quick,
    bazaarMid: fair,
    bazaarMax: premium,
    bazaarHaveEnough: priceResult.adsUsed >= 4,
    isUnboxed,
    isUsed,
    status,
    conditionPercent,
    batteryPercent: batteryPercent || null,
    // NEW: Trimmed Mean pricing metadata
    pricingSource: priceResult.pricingSource,
    pricingMethod: priceResult.pricingMethod,
    pricingConfidence: 0.85, // Trimmed Mean is robust
    adsFiltered: priceResult.adsRemoved,
    adsTotal: priceResult.adsTotal,
    priceCapped // Price was capped due to retail limit
  };
}

// Legacy pricing algorithm (kept as fallback)
function computePricingLegacy(input) {
  const usedPrice = safeNumber(input.usedPrice, 0);
  const newPrice = safeNumber(input.newPrice, 0);
  const isNewAvailable = Boolean(input.isNewAvailable) && newPrice > 0;
  const step = safeNumber(input.step, 5);
  const min = safeNumber(input.min, 0);
  const max = safeNumber(input.max, 1_000_000);
  const conditionPercent = clamp(safeNumber(input.conditionPercent, 90), 70, 100);
  const batteryPercent = clamp(safeNumber(input.batteryPercent, 0), 0, 100);
  const notes = String(input.notes || "");

  // PRIORITA BAZOŠ: similar ads are primary source for market price.
  const similar = Array.isArray(input.similarAds) ? input.similarAds : [];
  const bazaarAll = similar
    .filter((a) => safeNumber(a?.price, 0) > 0); // Only filter: must have valid price
    // NO TEXT FILTERING, NO SOURCE FILTERING - take ALL ads
  // Prefer real Bazoš listings first, then fallback to other bazaar sources.
  const bazosAds = bazaarAll.filter((a) => String(a?.source || "") === "bazos");
  const otherBazaar = bazaarAll.filter((a) => String(a?.source || "") !== "bazos");
  const bazaar = [...bazosAds, ...otherBazaar];

  // Need at least 15-20 ads for stable min/median/max tiers
  const scored = bazaar
    .map((a) => ({ a, score: relevanceScore(input.productName || "", a?.title || "") }))
    .sort((x, y) => (y.score - x.score) || (safeNumber(y.a?.price, 0) - safeNumber(x.a?.price, 0)));
  const top15 = scored.slice(0, 30).map((x) => x.a);
  const prices15 = top15.map((a) => safeNumber(a?.price, 0)).filter((p) => p > 0);
  const have15 = prices15.length >= 15;
  const minBaz = prices15.length ? Math.min(...prices15) : 0;
  const maxBaz = prices15.length ? Math.max(...prices15) : 0;
  const midBaz = prices15.length ? median(prices15) : 0;

  const isUnboxed = /(rozbalen|iba\s+rozbalen|len\s+rozbalen)/i.test(notes);
  const isUsed = /(pou[zž]ívan|pouzivan|be[zž]ne\s+pou[zž]i)/i.test(notes) || !isUnboxed;
  const stateMult = isUnboxed ? 0.85 : 1.0;
  
  // PENALTY ZA VADY: detekcia kritických slov v poznámkach
  const criticalDefects = /(havarovan|vrak|ohnut|zlomen|rozbit|totálne\s+zničen|totalne\s+znicen|po\s+nehode|nefunk)/i;
  const isCriticallyDamaged = criticalDefects.test(notes);
  
  // Pre havarované/vrak: cena sa musí znížiť o 80% z trhovej hodnoty (max 20% ceny funkčného kusu)
  const defectPenalty = isCriticallyDamaged ? 0.2 : 1.0; // 20% z pôvodnej ceny = penalty 80%

  // Base tiers directly from Bazoš stats (min/median/max)
  let quickBase = minBaz || usedPrice;
  let marketBase = midBaz || usedPrice;
  let premiumBase = maxBaz || usedPrice;

  // Stav multiplikátor:
  // - rozbalené: Priemer(Bazoš)*0.85
  // - používané: Priemer(Bazoš)*1.0
  // - havarované/vrak: Priemer(Bazoš)*0.1 (penalty 90%)
  quickBase *= stateMult * defectPenalty;
  marketBase *= stateMult * defectPenalty;
  premiumBase *= stateMult * defectPenalty;

  // Condition impact:
  // - higher condition should move the recommended price closer to the max bazaar listing
  //   (90% noticeably closer, 100% can be near/at max).
  // Keep the effect bounded to avoid overpromising when bazaar data is weak.
  const condNorm = clamp((conditionPercent - 75) / 25, 0, 1); // 75%->0, 100%->1
  const condPull = Math.pow(condNorm, 0.65); // pulls stronger at high condition
  marketBase = marketBase * (1 - condPull) + premiumBase * condPull;
  // Quick price also lifts a bit with high condition (but stays the "fast sale" option)
  quickBase = quickBase * (1 - condPull * 0.2) + marketBase * (condPull * 0.2);

  // Battery health influences value a bit if provided (apply to all tiers mildly)
  if (batteryPercent > 0) {
    const batFactor = batteryPercent < 80 ? 0.93 : batteryPercent >= 90 ? 1.02 : 1.0;
    quickBase *= batFactor;
    marketBase *= batFactor;
    premiumBase *= batFactor;
  }

  // Premium should reflect "100% of the highest bazaar price" only when the device is truly top condition.
  // Example: 100% -> 1.00x max, 90% -> ~0.97x max, 80% -> ~0.94x max.
  const premiumCondFactor = clamp(0.7 + (conditionPercent / 100) * 0.3, 0.85, 1.0);
  premiumBase *= premiumCondFactor;

  let quick = clamp(roundToStep(quickBase, step), min, max);
  let fair = clamp(roundToStep(marketBase, step), min, max);
  // Max výnos = 100% z Bazoša (bez ďalšieho znižovania), len zaokrúhlenie/hranice slidera
  let premium = clamp(roundToStep(premiumBase, step), min, max);

  // Ensure a sensible visible spread for the slider/cards (especially for cheap items).
  // - cheap (<50€): spread in single euros
  // - mid: tens
  // - expensive: percentage-based
  const absSpread =
    fair > 0 && fair < 50 ? 5 : fair > 0 && fair < 200 ? 15 : fair > 0 ? Math.max(30, Math.round(fair * 0.12)) : 10;
  const pctSpread = fair > 0 ? Math.round(fair * 0.12) : 0;
  const spread = Math.max(absSpread, pctSpread);
  // Allow fair to reach premium only for near-perfect condition.
  if (premium <= fair && conditionPercent < 97) premium = clamp(roundToStep(fair + spread, step), min, max);
  if (quick >= fair) quick = clamp(roundToStep(Math.max(1, fair - spread), step), min, max);
  // If still collapsed due to clamping, force at least 1 step difference where possible.
  if (premium === fair && conditionPercent < 97 && fair + step <= max) premium = fair + step;
  if (quick === fair && fair - step >= min) quick = fair - step;

  // PRE VÁŽNE VADY: Posun slider "Rýchly odbyt" na minimum (reálna likvidná hodnota)
  if (isCriticallyDamaged) {
    // Rýchly odbyt = minimum (10-20 € = reálna likvidná hodnota vraku/dielov)
    quick = Math.max(5, Math.min(quick, 20));
    
    // Pre bicykle bez značky - extra nízko
    const productName = String(input.productName || "").toLowerCase();
    const isBicycle = /bicyk|bike|kolo/i.test(productName);
    const hasNoBrand = !/(trek|specialized|giant|scott|cannondale|cube)/i.test(productName);
    
    if (isBicycle && hasNoBrand) {
      quick = Math.min(quick, 15);
      fair = Math.min(fair, 50);
      premium = Math.min(premium, 50);
    }
    
    // Všeobecný strop pre havarované produkty (max 10% z novej ceny, ak je známa)
    if (newPrice > 0) {
      const maxAllowed = Math.round(newPrice * 0.1);
      quick = Math.min(quick, Math.max(10, maxAllowed));
      fair = Math.min(fair, Math.max(15, maxAllowed));
      premium = Math.min(premium, Math.max(20, maxAllowed));
    }
  }

  const valuePct = isNewAvailable && newPrice > 0 ? Math.round((fair / newPrice) * 100) : null;
  const status = isNewAvailable ? "available" : "unavailable";

  return {
    fair,
    quick,
    premium,
    newPrice: isNewAvailable ? Math.round(newPrice) : null,
    valuePct,
    state: isUnboxed ? "unboxed" : "used",
    stateMult,
    bazaarUsedCount: prices15.length,
    bazaarNeedMin: 15,
    bazaarMin: minBaz ? Math.round(minBaz) : null,
    bazaarMid: midBaz ? Math.round(midBaz) : null,
    bazaarMax: maxBaz ? Math.round(maxBaz) : null,
    bazaarHaveEnough: have15,
    isUnboxed,
    isUsed,
    status,
    conditionPercent,
    batteryPercent: batteryPercent || null,
  };
}

// Main pricing function (uses protected algorithm, falls back to legacy if needed)
async function computePricing(input) {
  try {
    return await computePricingProtected(input);
  } catch (err) {
    console.error("❌ Protected pricing error:", err);
    return computePricingLegacy(input);
  }
}

function extractUserFacts(notesRaw) {
  const notes = String(notesRaw || "");
  const facts = [];

  // Battery percent (phones commonly)
  const batteryRe = /bat(?:e|é)?ri?a?\s*(?:má|:)?\s*(\d{1,3})\s*%/i;
  const m = notes.match(batteryRe);
  if (m) {
    const pct = clamp(safeNumber(m[1], 0), 0, 100);
    if (pct > 0) facts.push({ key: "battery_percent", label: "Batéria", value: `${pct}%` });
  }

  // Purchased at/from a store/carrier (e.g., Orange)
  const boughtRe =
    /(kup(?:en[ée]|ované)|kupované)\s*(?:v|od)\s*([A-Za-z0-9ÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽáäčďéíĺľňóôŕšťúýž ._-]{2,30})/i;
  const b = notes.match(boughtRe);
  if (b) facts.push({ key: "bought_at", label: "Kupované", value: b[2].trim() });

  // Cosmetic mentions
  if (/(škraban|škrabance|odrenin|oderky)/i.test(notes)) {
    facts.push({ key: "cosmetic", label: "Vzhľad", value: "drobné kozmetické známky používania" });
  }

  return facts;
}

async function editAdWithAI({ currentAd, userRequest, productName, notes }) {
  if (!OPENAI_API_KEY) {
    return { ok: false, error: "OPENAI_API_KEY is not set" };
  }
  
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  
  const systemPrompt = `
Si expert na slovenské bazárové inzeráty. Tvojou úlohou je upraviť existujúci inzerát podľa pokynu používateľa.

⚠️ KRITICKÉ PRAVIDLO - MINIMÁLNA POTREBNÁ ZMENA:
Pri úprave inzerátu sa drž princípu minimálnej potrebnej zmeny. Uprav len tú časť, o ktorú používateľ žiada (napr. konkrétne číslo alebo vetu). Pôvodnú štruktúru, poradie sekcií a štýl textu zachovaj na 100 % identické s pôvodným návrhom.

🚨 ABSOLÚTNE ZACHOVAJ:
- Všetky odseky (line breaks, \\n)
- Všetky čiarky, bodky, pomlčky
- Všetky medzery medzi vetami
- Presné formátovanie (kapitálky, veľké písmená)
- Poradie sekcií a odsekov

PRAVIDLÁ:
1. ⭐ MINIMÁLNA ZMENA: Zmeň LEN danú informáciu (napr. cenu 450€ → 500€), zvyšok textu ponechaj slovo od slova rovnaký vrátane všetkých odsekov a line breaks.
2. ⭐ ZACHOVAJ ODSEKY: Ak je pôvodný text rozdelený do odsekov, MUSÍŠ zachovať presne tie isté line breaks (\\n) na presne tých istých miestach.
3. ⭐ ZACHOVAJ ŠTRUKTÚRU: Poradie odsekov, formátovanie a štylistika musia zostať na 100% identické.
4. ⭐ ŽIADNE REFRÁZOVANIE: Nemenít vety, ktoré používateľ nežiadal upraviť. Ani jedno slovo.
5. Ak používateľ žiada zmenu ceny → zmeň len číslo v pricing, text popisu nechaj absolútne identický.
6. Ak používateľ žiada pridať informáciu → pridaj ju presne tam, kde požaduje, ostatný text nedotýkaj (ani interpunkciu).
7. Ak používateľ žiada zmeniť tón (napr. "je to šrot na diely") → zmeň celý text zodpovedajúco, ale zachovaj štruktúru odsekov.
8. ZÁKAZ klamlivých informácií (dôchodok, zdravie, rodina) – len všeobecné dôvody predaja.
9. ⚠️ **ZAKÁZANÉ ROZPORY V ČÍSLACH:**
   - Ak používateľ uvedie "batéria 90%", MUSÍŠ písať "90%" VO VŠETKÝCH častiach textu.
   - NIKDY NESMIEŠ meniť percento na iné číslo (napr. 90% → 100%).
   - NIKDY NESMIEŠ písať jedno číslo v "Technické info" a iné v "Popis".
   - PRÍKLAD (ZAKÁZANÉ): ❌ "Batéria: 100%" + "Batéria je v 90% stave" ← ROZPOR!
   - PRÍKLAD (SPRÁVNE): ✅ "Batéria: 90%" + "Batéria je v 90% stave" ← OK
10. Vráť JSON s rovnakými poľami ako pôvodný inzerát: title, desc, benefits, pricing (fair, quick, premium).

PRÍKLAD SPRÁVNEJ MINIMÁLNEJ ZMENY:
Pokyn: "zmeň cenu na 500 eur"
Pôvodné: { pricing: { fair: 450, quick: 420, premium: 480 } }
Správne: { pricing: { fair: 500, quick: 470, premium: 530 } } ← Len čísla, text popisu zostáva identický
NESPRÁVNE: Prepísať celý popis alebo refrázovať vety

PRÍKLAD 2 - Zachovanie odsekov:
Pokyn: "pridaj že má nové pneumatiky"
Pôvodný popis: "Bicykel je v zachovalom stave.\\n\\nPoužívaný 2 roky."
Správne: "Bicykel je v zachovalom stave.\\n\\nPoužívaný 2 roky. Má nové pneumatiky." ← Presne tie isté line breaks (\\n\\n)
NESPRÁVNE: "Bicykel je v zachovalom stave. Používaný 2 roky. Má nové pneumatiky." ← Stratené odseky!
NESPRÁVNE: "Tento kvalitný bicykel je v dobrom stave s novými pneumatikami..." ← Refrázované

PRÍKLAD 3 - Zmena len jedného slova:
Pokyn: "zmeň 'dobrom' na 'výbornom'"
Pôvodný popis: "Bicykel je v dobrom stave.\\n\\nPoužívaný 2 roky."
Správne: "Bicykel je v výbornom stave.\\n\\nPoužívaný 2 roky." ← Zmenené len jedno slovo, odseky zachované
NESPRÁVNE: "Bicykel je v výbornom stave. Používaný 2 roky." ← Stratené odseky!
`.trim();

  const userPrompt = `
EXISTUJÚCI INZERÁT:
Názov: ${currentAd.title || "—"}
Popis: ${currentAd.desc || "—"}
Výhody: ${JSON.stringify(currentAd.benefits || [])}
Cena (fair): ${currentAd.pricing?.fair || currentAd.price || "—"} €

KONTEXT:
Produkt: ${productName || "—"}
Poznámky o stave: ${notes || "—"}

POKYN OD POUŽÍVATEĽA:
${userRequest}

Uprav inzerát podľa tohto pokynu. Vráť JSON s poľami:
- title: upravený názov (ak je potrebné)
- desc: upravený popis - MUSÍŠ zachovať všetky pôvodné line breaks (\\n), odseky a formátovanie!
- benefits: upravené výhody (2-5 bodov)
- pricing: { fair: číslo, quick: číslo, premium: číslo } (upravené ceny, ak je potrebné)

⚠️ KRITICKY DÔLEŽITÉ: Ak pôvodný "desc" obsahuje odseky (\\n), MUSÍŠ ich zachovať na presne tých istých miestach!

Výstup musí byť validný JSON bez ďalšieho textu.
`.trim();

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      return { ok: false, error: `OpenAI error: ${resp.status} ${errText.slice(0, 300)}` };
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);

    return {
      ok: true,
      title: String(parsed.title || currentAd.title || ""),
      desc: String(parsed.desc || currentAd.desc || ""),
      benefits: Array.isArray(parsed.benefits) ? parsed.benefits : currentAd.benefits || [],
      pricing: parsed.pricing || currentAd.pricing || { fair: 0, quick: 0, premium: 0 },
    };
  } catch (err) {
    return { ok: false, error: String(err?.message || err || "Unknown error") };
  }
}

/**
 * Analyze user feedback and refine search query
 * @param {string} originalQuery - Original product name
 * @param {string} feedback - User feedback about wrong results
 * @param {Array<string>} removedTitles - Titles of removed ads
 * @returns {Promise<string>} - Refined search query
 */
async function analyzeAndRefineQuery(originalQuery, feedback, removedTitles = []) {
  if (!OPENAI_API_KEY) return originalQuery;
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Si expert na analýzu spätnej väzby pri vyhľadávaní produktov. Tvoja úloha:

1. Analyzuj feedback od používateľa
2. Pochop, čo bolo zlé (napr. príliš široké výsledky, nesprávna kategória, zahrnuli sa príslušenstvo/služby)
3. Vytvor UPRESNENÝ vyhľadávací dopyt, ktorý vylúči nerelevantné výsledky

PRAVIDLÁ:
- **KRITICKÉ:** Používaj MAX 1 negatívny filter, NIKDY NIE VIAC!
- Pre veľké kategórie (PC, Mobily, Elektro) radšej VRÁŤ PÔVODNÝ DOPYT - už je dostatočne špecifický
- Ak feedback hovorí o autách → pridaj len "-auto" (NIE "-auto -carplay")
- Ak feedback hovorí o príslušenstve → pridaj značku produktu namiesto negatívneho filtra
- Zachovaj pôvodný zámer (napr. "MacBook Pro" ostáva "MacBook Pro")
- **DÔLEŽITÉ:** Ak si NIE SI ISTÝ alebo dopyt už je špecifický (napr. "MacBook Pro"), vráť PÔVODNÝ DOPYT
- Lepšie je vrátiť pôvodný dopyt než riskovať 0 výsledkov

Príklady:
- "golfové palice" + feedback "príliš všeobecné" → "golfové palice" (PÔVODNÝ, už je špecifický!)
- "iPhone" + feedback "sú tu autá" → "iPhone -auto" (MAX 1 filter!)
- "bicykel" + feedback "len príslušenstvo" → "bicykel" (PÔVODNÝ, negatívne filtre spôsobia 0 výsledkov!)
- "MacBook Pro" + akýkoľvek feedback → "MacBook Pro" (PÔVODNÝ, už je veľmi špecifický!)

Vráť JSON:
{
  "refinedQuery": "upravený dopyt",
  "reasoning": "prečo si to zmenil"
}`,
          },
          {
            role: "user",
            content: `
Pôvodný dopyt: "${originalQuery}"

Feedback používateľa: "${feedback}"

Odstránené inzeráty:
${removedTitles.length > 0 ? removedTitles.map((t, i) => `${i + 1}. ${t}`).join("\n") : "Žiadne"}

Vytvor lepší vyhľadávací dopyt, ktorý SA VYHNE týmto problémom.
            `.trim(),
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ analyzeAndRefineQuery failed: ${response.status}`);
      return originalQuery;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    
    const refinedQuery = String(parsed.refinedQuery || originalQuery).trim();
    const reasoning = String(parsed.reasoning || "").trim();
    
    console.log(`💡 Query refinement: "${originalQuery}" → "${refinedQuery}"`);
    if (reasoning) console.log(`   Reasoning: ${reasoning}`);
    
    return refinedQuery;
  } catch (err) {
    console.warn(`⚠️ analyzeAndRefineQuery error:`, err);
    return originalQuery;
  }
}

/**
 * Normalizes product name using AI to fix typos and extract clean product name
 * @param {string} rawName - User input (may contain typos, adjectives, etc.)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{original: string, normalized: string, keywords: string}>}
 */
async function normalizeProductName(rawName, apiKey) {
  if (!rawName || !apiKey) return { original: rawName, normalized: rawName, keywords: rawName };
  
  const cleanRaw = String(rawName).trim();
  if (cleanRaw.length < 3) return { original: cleanRaw, normalized: cleanRaw, keywords: cleanRaw };
  
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Si expert na normalizáciu názvov produktov pre vyhľadávanie. Tvoja úloha:
1. Oprav preklepy a gramatické chyby
2. Odstráň zbytočné slová (predám, lacno, krásny, atď.)
3. Zachovaj LEN: značku + model + kapacitu/veľkosť/farbu (ak je uvedená)
4. Vráť odpoveď v 1. páde (nominatív)
5. Extrahuj aj kľúčové slová pre širšie vyhľadávanie (len značka)

Príklady:
"iphne 13 pro maz" → "iPhone 13 Pro Max"
"predam lacno stacionarny bikykel" → "stacionárny bicykel"
"sprchovy kut ravak chrome 90x90" → "Ravak Chrome 90x90"
"macbok air m2 256gb" → "MacBook Air M2 256GB"

Vráť JSON:
{
  "normalized": "čistý názov produktu",
  "keywords": "značka alebo kategória pre širšie vyhľadávanie"
}`,
          },
          {
            role: "user",
            content: cleanRaw,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      console.warn(`⚠️ normalizeProductName failed: ${response.status}`);
      return { original: cleanRaw, normalized: cleanRaw, keywords: cleanRaw };
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    
    const normalized = String(parsed.normalized || cleanRaw).trim();
    const keywords = String(parsed.keywords || normalized).trim();
    
    console.log(`🔤 Product name normalization: "${cleanRaw}" → "${normalized}" (keywords: "${keywords}")`);
    
    return {
      original: cleanRaw,
      normalized,
      keywords,
    };
  } catch (err) {
    console.warn(`⚠️ normalizeProductName error:`, err);
    return { original: cleanRaw, normalized: cleanRaw, keywords: cleanRaw };
  }
}

async function identifyProductFromImage({ imageDataUrl, model, apiKey }) {
  if (!apiKey) return { name: "", confidence: 0, evidence: "" };
  if (typeof fetch !== "function") return { name: "", confidence: 0, evidence: "" };
  if (typeof imageDataUrl !== "string" || !imageDataUrl.startsWith("data:image/")) {
    return { name: "", confidence: 0, evidence: "" };
  }

  const idPrompt = `
Z fotky identifikuj produkt a jeho kategóriu.

KATEGÓRIE - použi PRESNE tieto hodnoty:
- "PC" = počítače, notebooky, MacBook, monitory
- "MOBILY" = smartfóny, iPhone, Samsung, tablety
- "FOTO" = fotoaparáty, objektívy, drony
- "ELEKTRO" = TV, konzoly, slúchadlá, reproduktory, domáce spotrebiče
- "SPORT" = bicykle, lyže, fitness zariadenia, hodinky Garmin, golfové palice, futbalové lopty, tenisové rakety
- "HUDBA" = gitary, klávesy, mikrofóny
- "NABYTOK" = gauče, stoly, stoličky, skrine
- "DOM" = záhradné náradie, kosačky, kvetináče
- "STROJE" = vŕtačky, píly, náradie, kompresory
- "OBLECENIE" = oblečenie, obuv, bundy
- "KNIHY" = knihy, učebnice
- "DETSKE" = kočíky, hračky, detské potreby

PRAVIDLÁ:
- Nehádaj. Ak nevidíš značku/model, povedz "unknown".
- Vyber NAJVHODNEJŠIU kategóriu podľa toho, čo vidíš na fotke.
- V poli "category" použi PRESNE jeden z kľúčov vyššie (napr. "PC", "MOBILY", "ELEKTRO").
- NESKLADAJ svoje názvy kategórií! Použi LEN kľúče vyššie.
- **DÔLEŽITÉ:** Vráť aj "searchQueries" - alternatívne názvy/synonymá pre vyhľadávanie
- **DÔLEŽITÉ:** Vráť aj "categoryConfidence" - istota o kategórii (0-1)

PRÍKLADY:
- iPhone → category: "MOBILY", searchQueries: ["iPhone", "Apple iPhone"]
- MacBook → category: "PC", searchQueries: ["MacBook", "Apple MacBook", "notebook"]
- Bicykel → category: "SPORT", searchQueries: ["bicykel", "bike", "horský bicykel"]
- Dymová dekorácia → category: "DOM", searchQueries: ["dymová dekorácia", "dymový vodopád", "tečúci dym", "dym kaskáda"]
- PS5 → category: "ELEKTRO", searchQueries: ["PS5", "PlayStation 5", "Sony PS5"]

Vráť JSON:
{
  "name": "značka + model (napr. iPhone 13 Pro, MacBook Air M2)",
  "confidence": 0-1,
  "evidence": "čo na fotke vidíš",
  "category": "PC",
  "categoryConfidence": 0-1 (istota o kategórii),
  "searchQueries": ["hlavný názov", "alternatíva 1", "alternatíva 2"]
}
`.trim();

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: idPrompt },
            { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!resp.ok) return { name: "", confidence: 0, evidence: "", category: null };
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  try {
    const j = JSON.parse(text);
    const name = String(j?.name || "").trim();
    const confidence = clamp(safeNumber(j?.confidence, 0), 0, 1);
    const evidence = String(j?.evidence || "").trim();
    const categoryKey = String(j?.category || "").trim().toUpperCase();
    const categoryConfidence = clamp(safeNumber(j?.categoryConfidence, 0.8), 0, 1);
    const searchQueries = Array.isArray(j?.searchQueries) 
      ? j.searchQueries.map(q => String(q).trim()).filter(Boolean)
      : [name].filter(Boolean);
    
    console.log("🔍 AI detection:", { 
      name,
      confidence,
      categoryKey, 
      categoryConfidence,
      searchQueries: searchQueries.length,
      found: !!BAZOS_CATEGORIES[categoryKey] 
    });
    
    // Get category from BAZOS_CATEGORIES or fallback to keyword matching
    let category = BAZOS_CATEGORIES[categoryKey] || null;
    if (!category && name) {
      console.log("⚠️ Category not found, using keyword matching...");
      category = getCategoryFromKeywords(name, evidence);
    }
    
    console.log("✅ Final category:", category, `(confidence: ${Math.round(categoryConfidence * 100)}%)`);
    
    if (!name || name.toLowerCase() === "unknown") {
      return { name: "", confidence, evidence, category, categoryConfidence, searchQueries: [] };
    }
    return { name, confidence, evidence, category, categoryConfidence, searchQueries };
  } catch (err) {
    console.error("❌ Failed to parse AI identification:", err);
    return { name: "", confidence: 0, evidence: "", category: null, categoryConfidence: 0, searchQueries: [] };
  }
}

// Get style-specific instructions for AI
// Get style-specific instructions for AI
// ═══════════════════════════════════════════════════════════════════════════════
// REFACTORED AD STYLE INSTRUCTIONS - Precise & Strict
// ═══════════════════════════════════════════════════════════════════════════════
function getStyleInstructions(adStyle) {
  const styles = {
    uprimny: `
═══════════════════════════════════════
ŠTÝL INZERÁTU: ÚPRIMNÝ (Priamy, úprimný tón)
═══════════════════════════════════════
Píš ako slovenský predajca na Bazoš.sk, ktorý chce rýchlo predať a nebalamúti.

ZÁKLAD:
✅ Priznaj nedostatky na rovinu (škrabance, nižšia batéria, prasklé sklo)
✅ Ak je batéria 85%, MUSÍŠ to napísať PRESNE: "Batéria má 85%"
✅ Používaj jednoduché, priame vety bez zbytočných slov
✅ POVINNÉ: Posledná veta MUSÍ byť: "Rád odpoviem na všetky vaše otázky ohľadom stavu, stačí sa opýtať."

ZAKÁZANÉ:
❌ "Vynikajúci stav" (ak má škrabance)
❌ "Ako nový" (ak má batériu 85%)
❌ Skrývanie nedostatkov

PRÍKLAD (iPhone 13 Pro, batéria 88%, škrabance):
"Predám iPhone 13 Pro 256GB. Používal som ho 2 roky, funguje bez problémov. Batéria má 88%, čo je stále solídne. Má pár drobných škrabancov na zadnej strane, ale displej je čistý. Rád odpoviem na všetky vaše otázky ohľadom stavu, stačí sa opýtať."
`,
    
    emocionalny: `
═══════════════════════════════════════
ŠTÝL INZERÁTU: EMOCIONÁLNY (Príbehový, osobný)
═══════════════════════════════════════
Píš ako človek, ktorý má k produktu vzťah a rád by ho predal niekomu, kto si ho bude vážiť.

ZÁKLAD:
✅ Rozprávaj príbeh - ako ti produkt slúžil
✅ Používaj slová: "vynikajúci spoločník", "verne slúžil", "budete mať radosť"
✅ Vytvor emocionálne spojenie: "Prešiel so mnou cez..." "Teraz hľadá nového majiteľa..."
✅ Ale STÁLE priznaj fakty: Ak má batériu 85%, musíš to napísať

ZAKÁZANÉ:
❌ Vymyslené príbehy ("mojej babke zomrel")
❌ Prehnané emócie ("budete ho milovať ako ja")
❌ Skrývanie nedostatkov za emóciami

PRÍKLAD (MacBook Air, batéria 92%, škrabance):
"Tento MacBook Air mi verne slúžil počas celého štúdia. Prešiel so mnou cez nespočetné noci písania záverečnej práce a nikdy ma nesklamal. Batéria má 92%, čo je na 3-ročný notebook výborne. Má pár drobných škrabancov na spodnej strane, ale displej je čistý. Teraz hľadá nového majiteľa, ktorému bude rovnako verným spoločníkom."
`,
    
    odborny: `
═══════════════════════════════════════
ŠTÝL INZERÁTU: ODBORNÝ (Technický, fakty)
═══════════════════════════════════════
Píš ako technický expert, ktorý predáva profesionálne zariadenie.

ZÁKLAD:
✅ ŽIADNA omáčka - len fakty a technické údaje
✅ Používaj odrážky (•) pre prehľadnosť
✅ Rozdeľ na sekcie: ŠPECIFIKÁCIE | STAV | PRÍSLUŠENSTVO | CENA
✅ Presné technické termíny (procesor, RAM, storage, rozlíšenie)
✅ Ak je batéria 85%, napíš: "• Batéria: 85% kapacita (327 cyklov)"

ZAKÁZANÉ:
❌ Emócie a príbehy
❌ Marketing ("top stav", "vynikajúca voľba")
❌ Dlhé vety

PRÍKLAD (iPhone 13 Pro, batéria 88%):
"ŠPECIFIKÁCIE:
• Model: iPhone 13 Pro 256GB Graphite
• Procesor: Apple A15 Bionic
• Displej: 6.1\" Super Retina XDR (2532×1170)
• Fotoaparát: 12MP trojitý (wide, ultra-wide, tele)

STAV:
• Batéria: 88% kapacita (412 cyklov)
• Fyzický stav: Drobné škrabance na hliníkovom ráme, displej bez poškodení
• Funkčnosť: 100% (Face ID, kamery, WiFi, 5G)

PRÍSLUŠENSTVO:
• Originálna krabica
• USB-C Lightning kábel
• Priehľadný obal

CENA: 650€ (fér cena podľa Bazoš analýzy)"
`,
    
    vtipny: `
═══════════════════════════════════════
ŠTÝL INZERÁTU: VTIPNÝ (Odľahčený, humor)
═══════════════════════════════════════
Píš ako kamarát, ktorý má dobrú náladu, ale stále hovorí pravdu.

ZÁKLAD:
✅ Používaj vtipné prirovnania: "Beží rýchlejšie ako ja na obed"
✅ Slovenský slang: "makne", "frčí", "držka"
✅ Humor len ako KORENIE - hlavné mäso sú stále fakty!
✅ Ak je batéria 85%, napíš vtipne ale presne: "Batéria má 85% (vydrží dlhšie ako moje predsavzatia)"
✅ **POVINNÉ PRVKY:**
   - Spomeň: "**Displej je bez škrabancov**" (alebo vtipne: "displej čistý ako svedomie")
   - Spomeň: "**Procesor je pripravený na prácu**" (alebo vtipne: "procesor makne všetko")
   - **VŽDY ZAKONČÍ:** "K nákupu pridávam dobrý pocit z férového obchodu. 🤝"

ZAKÁZANÉ:
❌ Humor bez faktov
❌ Vtipy, ktoré skrývajú nedostatky
❌ Prehnané prirovnania ("funguje ako NASA počítač")

PRÍKLAD (MacBook, 8GB RAM, 256GB SSD, bez škrabancov):
"Predám MacBook, ktorý funguje ako hodinky (švajčiarske, nie čínske 😄). Má 8GB RAM a 256GB SSD - na prácu to frčí ako nič. Displej je bez škrabancov, ako svedomie po celom dni doma na gauči. Procesor je pripravený na prácu a makne všetko od Office po editovanie fotiek. Používal som ho rok, nikdy ma nesklal. Cena je férová - overená podľa Bazoš trhovej analýzy (nie vymyslená z hlavy 😄). K nákupu pridávam dobrý pocit z férového obchodu. 🤝"
`
  };
  
  return styles[adStyle] || styles.uprimny; // Default to úprimný
}

async function buildPrompt(input) {
  const {
    productName,
    notes,
    usedPrice,
    newPrice,
    isNewAvailable,
    similarAds,
    detectDefects,
    dealerText,
    dealerSource,
    adStyle = "uprimny", // Default style
  } = input;

  const similar = Array.isArray(similarAds) ? similarAds : [];
  const similarSummary = similar
    .slice(0, 8)
    .map((a) => `- ${a.title} | €${a.price} | stav ${a.condition}% | zdroj ${a.source}`)
    .join("\n");

  const pricing = await computePricing(input);
  const facts = extractUserFacts(notes);
  const factsText = facts.length ? facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") : "(žiadne)";
  const dealer = String(dealerText || "").trim();
  const dealerUrl = String(dealerSource || "").trim();

  const nameLine =
    productName && String(productName).trim() && String(productName).trim() !== "Produkt"
      ? `Produkt: ${productName}`
      : `Produkt: (neurčené – IDENTIFIKUJ Z FOTKY, ak je priložená)`;

  const styleInstructions = getStyleInstructions(adStyle);
  
  return `
Si copywriter pre bazárový inzerát (predajto.ai).

${styleInstructions}

PRAVIDLÁ:
- Nikdy nekopíruj celé vety z externých webov (Heureka, e-shopy, bazáre). Text musí byť originálny.
- Heureka údaje používaj len ako faktický referenčný bod (cena/dostupnosť), nie ako zdroj viet.
- Výstup musí byť predajný, emočný, ľudský. Nie suchý technický zoznam.
 - Technické parametre nepíš ako overené citácie. Ak si nie si istý, formuluj neutrálne a pridaj poznámku na overenie.
- Poznámky od používateľa považuj za pravdivé fakty. Ak je v poznámkach číslo (napr. batéria 90%), musíš ho jasne uviesť v texte.
- Štýl: bežný jednoduchý inzerát na Bazoši (bez e‑shop fráz typu "disponuje").

VSTUP:
- ${nameLine}
- Poznámky od používateľa: ${notes || "(žiadne)"}
- Fakty od používateľa (MUSÍŠ uviesť, ak sú uvedené):\n${factsText}
- Odborný popis od predajcu (vložené používateľom): ${dealer ? `(${dealerUrl || "bez URL"})\n${dealer}` : "(žiadne)"}
- Odhad bazárovej ceny: €${usedPrice}
- Nové v obchodoch (ak je známe): ${isNewAvailable ? `€${newPrice}` : "neznáme"}
- Podobné inzeráty (na kontext):\n${similarSummary || "(žiadne)"}
- Režim analýzy vady: ${detectDefects ? "zapnuté – NESMIEŠ používať vety ako 'všetko funguje' alebo 'v poriadku', ak na fotke vidíš poškodenie. Tón musí byť úprimný/na opravu." : "vypnuté"}

ÚLOHA:
Vráť JSON s týmito poľami:
- title: krátky, predajný titulok (bez emoji)
- desc: minimálne 100 slov, rozdelené do aspoň 3 odsekov (oddelené prázdnym riadkom):
  1) Úvod - **AK SÚ UVEDENÉ VADY** v poznámkach (škrabance, batéria pod 90%, hrdza, praskliny, atď.), ZAKÁŽ používať slová:
     - "vynikajúci", "top stav", "skvelá voľba", "perfektný", "ako nový", "bezvadný"
     Namiesto toho použi úprimné výrazy:
     - "používaný stav s priznanými chybami", "adekvátny stav", "zohľadnené v cene", "férová cena vzhľadom na stav"
     AK NIESU UVEDENÉ ŽIADNE VADY, smieš písať pozitívne (ale nie prehnaný marketing).
  2) Stav a technické detaily (fakty + 3 kľúčové parametre, ak ich vieš bezpečne podložiť).
     **KRITICKÉ PRAVIDLO PRE STAV PRODUKTU:**
       → Text z poľa "Popis / poznámky" má **100% prioritu** pred vizuálnou analýzou.
       → **PRÍSNY ZÁKAZ VÁGNYCH FORMULÁCIÍ:**
         • Ak je v poznámkách "88%" → ZAKÁZANÉ: "nemám konkrétny stav", "stav neznámy", "batéria približne..."
         • POVINNÉ: "Stav batérie je 88%" alebo "Batéria má 88%"
         • Ak je v poznámkach "hrdza na ráme" → ZAKÁZANÉ: "možné známky opotrebovania"
         • POVINNÉ: "Na ráme je hrdza"
       → MUSÍŠ použiť presný údaj zadaný používateľom bez zmäkčovania alebo zovšeobecňovania.
       → Ak používateľ píše "vrak", "nefunguje", "totálne zničený", "na náhradné diely", "batéria je mŕtva", MUSÍŠ tento stav prevziať do inzerátu a zmeniť tón z pozitívneho na varovný/realistický.
       → Fotka slúži LEN na identifikáciu značky/modelu. Obsah inzerátu (najmä stav) musí vychádzať **primárne z textu používateľa**.
       
       ⚠️ **ABSOLÚTNE ZAKÁZANÉ ROZPORY V ČÍSLACH:**
         • Ak v poznámkach je "batéria 90%", MUSÍŠ písať "90%" VO VŠETKÝCH častiach textu (technické info, popis, výhody).
         • NIKDY NESMIEŠ meniť percento na iné číslo (napr. 90% → 100%).
         • NIKDY NESMIEŠ písať jedno číslo v "Technické info" a iné číslo v "Podrobný popis".
         • PRÍKLAD ROZPORU (ZAKÁZANÉ):
           ❌ "Technické info: Batéria: 100%" + "Batéria je v 90% stave" ← TOTO JE ZAKÁZANÉ!
           ✅ "Technické info: Batéria: 90%" + "Batéria je v 90% stave" ← SPRÁVNE
         • Kontroluj si KAŽDÉ percento, číslo a údaj pred vrátením JSONu.
         • Ak si nie si istý číslom, NEPÍŠ ŽIADNE. Radšej vynechaj, ako napísať nesprávne.
     
     **Rozlíš 2 zdroje informácií o vadách:**
       a) **Vady z FOTKY** (to, čo TY VIDÍŠ na obrázku): AK JE ZAPNUTÝ REŽIM ANALÝZY VÁD a VIDÍŠ reálne vady, pridaj ich do odseku "Priznaný stav a vady".
       b) **Vady z poznámok používateľa** (HLAVNÝ ZDROJ PRAVDY): Ak používateľ v poli "Popis / poznámky" píše o vadách, POVINNE ich zapracuj do opisu v 2. odseku a vyčleň do samostatného odseku "Priznaný stav a vady". Tento text bol zadaný POUŽÍVATEĽOM a má prednosť pred tvojou vizuálnou analýzou.
     
     **Ignoruj pozitívnu vizuálnu analýzu, ak používateľ píše o vážnych vadách:**
       - Ak používateľ napíše "nefunguje", "vrak", "na diely" → NESLOBODNO písať "všetko funguje ako má" alebo "v dobrom stave".
       - Tón MUSÍ byť úprimný/varovný: "Produkt je nefunkčný / poškodený. Vhodné na opravu alebo náhradné diely. Cena zodpovedá stavu."
  3) Dôvod predaja / záver (výzva na kontakt, dohoda).
  **ZÁKAZ KLAMLIVÝCH INFORMÁCIÍ:**
  - NESLOBADNO vymýšľať osobné situácie: "som na dôchodku", "mám zdravotné problémy", "presťahujem sa", "manželka chce", atď.
  - Len všeobecné dôvody: "už to nepotrebujem", "kupujem nový", "nemám na to čas", "chcem sa zbaviť" – BEZ osobných detailov.
  - Tieto vymyslené informácie môžu predajcu dostať do problémov!
  
  Štýl má byť presvedčivý (napr. „elegantný čierny remienok, ktorý sa hodí k obleku aj k športu"), ale bez marketingových fráz typu „revolučný".
  Ak je priložený odborný popis od predajcu, povinne z neho vytiahni 3–5 faktov a prirodzene ich zapracuj do 2. odseku (bez kopírovania viet).
  Ak technické parametre nepoznáš s istotou, radšej ich vynechaj alebo formuluj neutrálne („podľa modelu býva…").
- benefits: pole 2–5 krátkych praktických bodov (bez "AI", bez emoji) – nech pôsobia ako od človeka, nie reklama.
  **KRITICKÉ PRAVIDLO PRE BENEFITS:**
  - **NESMÚ obsahovať vady alebo technické nedostatky** – ak je batéria 88%, to NIE JE výhoda, ale technická info.
  - **Vady patria do "Priznaný stav a vady" alebo do technických info**, nie do benefits.
  - **AK JE PRODUKT HAVAROVANÝ/VRAK** – NESLOBODNO písať pozitívne benefits. Namiesto "Havarovaný stav s potenciálom na renováciu" ❌ píš "Vhodné len na náhradné diely" alebo "Len pre šikovné ruky – renovácia potrebná".
  
  **PRAVIDLO PRIORITY:**
  1. **Poznámky používateľa majú prednosť** – ak používateľ píše "nefunguje", "vrak", "totálne pokazený", jeden z benefits MUSÍ byť varovný (napr. "Nefunkčný – potrebuje opravu", "Vhodné len na diely").
  2. **Vady z fotky** (ak je zapnutý režim analýzy vád a VIDÍŠ vady): jeden z bodov musí byť úprimná zmienka o viditeľných vadách.
  3. **Žiadne vady** (ani z fotky, ani z poznámok): benefits môžu byť pozitívne (napr. "Zachovalý stav", "Funkčne bez problémov").
  
  **ZAKÁZANÉ v benefits:**
  - "Batéria 88%" (to nie je výhoda, to je nedostatok – daj do specs)
  - "Drobné škrabance" (to je vada, nie výhoda – daj do "Priznaný stav a vady")
  - "Havarovaný stav s potenciálom na renováciu" ❌ (havária nie je výhoda!)
  - Akékoľvek technické parametre, ktoré sú pod priemerom (napr. slabá výdrž, nižší výkon)
- specs: pole 5–10 položiek, každá je objekt { label, value } (stručné, odborné)
- specs_note: **Tabuľka parametrov v forme odrážok** (nie veta).
  - Extrahuj VŠETKY číselné údaje z poznámok (batéria %, GB, mAh, kg, palce) a vady (hrdza, škrabance, praskliny).
  - Formát: každý parameter na novom riadku s odrážkou "•"
  - Príklad: "• Batéria: 88%\n• Pamäť: 256 GB\n• Vada: Hrdza na ráme\n• Vada: Škrabance na displeji"
  - Použij presné hodnoty z poznámok BEZ zaokrúhľovania alebo zmäkčovania.
  - Ak je priložený odborný popis od predajcu, sprav z neho odrážky s 3–4 kľúčovými parametrami.
  - Ak nie sú žiadne číselné údaje ani odborný popis, specs_note môže byť prázdne.
- similarAds: pole 2–4 položiek, každá { title, price, condition, source }
  - source musí byť "bazos" alebo "marketplace"
  - price celé EUR, condition 70–100
  - MUSIA byť relevantné k produktu z fotky/názvu a odrážať poznámky (napr. stav/batéria)
  - Nehovor, že ide o reálne scrapnuté dáta; ber to ako orientačný trh (simulovaný prieskum)
- pricing: objekt s číslami (EUR, celé čísla):
  - fair: férová trhová cena
  - quick: rýchly odbyt
  - premium: maximálny výnos
  - newPrice: cena nového kusu (ak dostupné), inak null
  - valuePct: fair ako % z newPrice (ak dostupné), inak null
  - capApplied: boolean či sa uplatnil limit 70–80% z novej ceny
  - capPct: percento limitu (napr. 0.78)

- conditionPercent: číslo 70–100 (odhad stavu z fotky + poznámok, bez preháňania)

- defects: pole 0–6 položiek (iba ak je "Režim analýzy vády: zapnuté" a je priložená fotka), inak []
  - každá položka: { label, severity, bbox }
  - label: napr. "škrabanec", "prasklina", "odrenina", "hrdza", "odlúpená farba", "ryhovaný povrch"
  - severity: "low" | "medium" | "high" | "critical"
    * "low": drobné kozmetické (jemné škrabance, ľahké odreniny)
    * "medium": viditeľné (hlbšie škrabance, ryhy, značky používania)
    * "high": vážne (praskliny, hrdza, deformácia, významné poškodenia)
    * "critical": totálna deštrukcia (zlomený rám, nefunkčné hlavné časti, po vážnej nehode)
  - bbox: { x, y, w, h } v rozsahu 0–1 (relatívne k obrázku), top-left origin
  - **KRITICKÉ PRAVIDLO**: Uvádzaj LEN vady, ktoré SKUTOČNE VIDÍŠ na fotke. Ak si nie si istý, radšej defects nechaj prázdne. NESMIEŠ halucinovať vady.

- isTotalDestruction: boolean (vráť true LEN AK produkt je totálne zničený a hodí sa len na náhradné diely / železo)

Číselné odporúčanie (na konzistenciu): fair=${pricing.fair}, quick=${pricing.quick}, premium=${pricing.premium}, newPrice=${pricing.newPrice ?? "null"}.

DODATOČNÉ (ak je priložená fotka):
- Ak produkt nie je zadaný, najprv ho identifikuj (značka/model) Z FOTKY a použi ho v title.
- Ak si nevieš byť istý modelom, uveď aspoň kategóriu (napr. "iPhone", "Android telefón") a nehalucinuj presný model.
- Použi vizuálne znaky + čitateľný text/logá (OCR) z fotky: značka, nápisy na tele, text na displeji, kamerový modul.
- Odhadni vizuálny stav (70–100%) a uveď v benefits len to, čo je z fotky pravdepodobné (nehalucinuj).
- AK JE ZAPNUTÝ REŽIM ANALÝZY VÁD (kriticko-optimistický prístup):
  * NESMIEŠ halucinovať vady, ktoré na fotke NEVIDÍŠ – len reálne viditeľné poškodenia.
  * AK VIDÍŠ poškodenie (škrabance, praskliny, hrdzu, deformáciu), MUSÍŠ ich úprimne pomenovať – nemôžeš písať "všetko funguje ako má".
  * AK NEVIDÍŠ žiadne vady, smieš napísať pozitívne ("v dobrom stave", "používané bez viditeľných vád").
  * Severity musí zodpovedať realite:
    - "low": drobné kozmetické (ľahké škrabance, odreniny)
    - "medium": viditeľné poškodenia (hlbšie škrabance, ryhy, odlúpená farba)
    - "high": vážne vady (praskliny, hrdza, deformácia)
    - "critical": totálna deštrukcia (zlomené, nefunkčné hlavné časti, po nehode)
  * Tón zmeni z "prémiový/výborný" na "úprimný/bazárový realista" LEN AK sú tam reálne vady.

KRITICKÉ – HARD LIMIT PRE TOTÁLNU DEŠTRUKCIU:
AK deteguješ na fotke totálnu deštrukciu (zlomený/ohnutý rám, kolesá v neprirodzenom uhle, nefunkčné hlavné časti, policajné označenie, očividne po vážnej nehode), MUSÍŠ:
- Nastaviť isTotalDestruction: true
- V title pridať suffix "– na náhradné diely / poškodený"
- V desc pridať samostatný odsek "Priznaný stav a vady" s textom: "Produkt je po vážnej nehode / je totálne poškodený. Vymenuj konkrétne vady. Vhodné len na náhradné diely alebo železo."
- V pricing.fair nastaviť max 5–10 EUR (cena železa/náhradných dielov)
- conditionPercent nastaviť na 10–30 (nie viac)

KRITICKÉ – OSTATNÉ:
- Ak nevieš identifikovať produkt s istotou, nesnaž sa trafiť presný model. V title použi všeobecný názov (napr. "Smartfón") a do specs daj len bezpečné položky.

FORMÁT INZERÁTU:
- Použi 1. osobu: "Predám...", "Používal som...", "Všetko funguje..."
- Príklad štýlu (normálny režim): "Displej je krásne čistý, všetko funguje ako má. Používal som ho asi rok, batéria drží super."
- Príklad štýlu (používateľ píše "škrabance, batéria 88%"): "Predám telefón v používanom stave s priznanými chybami. Na zadnej strane sú škrabance, batéria už drží približne 88% pôvodnej kapacity. Displej je čistý, funkčne všetko funguje. Cena zohľadňuje stav."
- Príklad štýlu (používateľ píše "brzdy nefungujú"): "Predám bicykel, ktorý potrebuje servis bŕzd – momentálne nefungujú, takže cena je primerane nižšia. Rám je v poriadku, kolesá tiež. Hodí sa na opravu alebo ako základ pre renováciu."
- Príklad štýlu (používateľ NEUVIEDOL žiadne vady): "Predám telefón v zachovalom stave. Displej čistý, bez viditeľných poškodení. Používal som ho rok, všetko funguje ako má."

**ZLATÉ PRAVIDLO**: Buď úprimný a realistický – ani neprehliaj vady, ani ich nehalucinuj.

**KOMBINÁCIA FOTKY + POZNÁMOK (ABSOLÚTNE PRAVIDLO):**
1. **Fotka slúži len na identifikáciu značky/modelu** (napr. iPhone 13, Trek bicykel) – nie na posúdenie stavu.
2. **Poznámky používateľa sú hlavný zdroj pravdy o stave** – POVINNE ich zapracuj do textu inzerátu (v popisoch + v "Priznaný stav a vady"), **NIE do benefits**.
3. **Ak používateľ píše "vrak", "nefunguje", "totálne pokazený":**
   - NESLOBODNO písať pozitívne/optimisticky ("všetko funguje", "v dobrom stave", "vynikajúci", "top stav", "skvelá voľba").
   - Tón MUSÍ byť varovný/realistický: "Produkt je nefunkčný. Vhodné na opravu alebo náhradné diely."
   - V benefits MUSÍ byť varovná poznámka (napr. "Vyžaduje opravu", "Nefunkčný – len na diely").
4. **Ignoruj pozitívnu vizuálnu analýzu, ak používateľ píše o vážnych vadách** – text od používateľa má vždy prednosť.
5. **Ak sú uvedené AKÉKOĽVEK vady** (škrabance, batéria pod 90%, hrdza, praskliny):
   - ZAKÁŽ slová: "vynikajúci", "top stav", "skvelá voľba", "perfektný", "ako nový", "bezvadný"
   - Použi: "používaný stav s priznanými chybami", "adekvátny stav vzhľadom na cenu", "férová cena zohľadňujúca stav"
6. **Benefits nesmú obsahovať vady ani technické nedostatky** – batéria 88% nie je výhoda, ale technická info. Škrabance nie sú benefit, ale vada.

**PREČO KÚPIŤ PRÁVE TENTO KUS (POVINNÉ):**
Do poľa "whyBuyThis" vygeneruj presne 3 silné argumenty, ktoré predajcu odlíšia od konkurencie. Mus

í byť založené na reálnych údajoch z popisu:
- Príklady: "Nadštandardná 32GB RAM vhodná pre profíkov", "Transparentne priznaný stav batérie (88%)", "Čistý displej bez škrabancov", "Kompletné príslušenstvo v balení"
- NESMIEŠ halucinovať vlastnosti, ktoré nie sú uvedené v popise alebo na fotke
- Ak je produkt poškodený/nefunkčný, použi realistické argumenty: "Nízka cena vhodná na diely", "Rám v poriadku, len brzdy potrebujú servis"

**VTIPNÁ POZNÁMKA O CENE (LEN PRE VTIPNÝ ŠTÝL):**
AK je štýl inzerátu "vtipny", do poľa "funnyPriceNote" pridaj vtipnú poznámku o cene (1 veta):
- Príklady: "Cena je pevná ako moja vôľa nejesť po šiestej, ale férová voči aktuálnemu trhu.", "Cena je fixná ako môj odpor voči ranému vstávaniu – teda absolútne nereálna, ale skúsme sa o tom porozprávať.", "Cena je ako moja diéta – teoreticky pevná, ale v praxi máme priestor na diskusiu."
- MUSÍ byť vtipná, sebaironická a zároveň férová k cene
- AK štýl NIE je "vtipny", nechaj toto pole prázdne ("")

DÔLEŽITÉ: Výstup musí byť validný JSON bez ďalšieho textu.
`.trim();
}

async function callOpenAI(input) {
  if (!OPENAI_API_KEY) {
    return {
      ok: false,
      error:
        "OPENAI_API_KEY is not set. Create env.local (see env.example) or set env vars.",
    };
  }

  if (typeof fetch !== "function") {
    return {
      ok: false,
      error:
        "This Node.js version does not support global fetch. Please use Node.js 18+ (recommended 20 LTS).",
    };
  }

  const imageDataUrl = typeof input.imageDataUrl === "string" ? input.imageDataUrl : "";
  const hasImage = imageDataUrl.startsWith("data:image/");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const SYSTEM_PROMPT = `
Si expert na slovenský bazárový trh (Bazoš). Tvojou úlohou je napísať UNIKÁTNY inzerát na mieru konkrétnemu produktu.

⚠️ **ZÁKLADNÉ PRAVIDLO: KAŽDÉ GENEROVANIE JE NOVÝ ZAČIATOK** ⚠️
- Ignoruj akékoľvek predchádzajúce inštrukcie alebo kontexty z iných produktov.
- Pred každým generovaním inzerátu vymaž staré príklady z pamäte. Nemiešaj mobily s golfom.
- Každý inzerát musí byť napísaný od nuly na základe fyzických vlastností predmetu.

⚠️ **KROK 1: ANALÝZA KATEGÓRIE (POVINNÉ)** ⚠️
Najprv striktne urči kategóriu produktu.
- Ak produkt NIE JE smartfón, notebook, tablet alebo smart hodinky → **JE PRÍSNE ZAKÁZANÉ použiť slová: displej, obrazovka, škrabance na skle, procesor, batéria, software, pixely, rozlíšenie, televízia.**
- Ak generuješ inzerát na GOLFOVÉ PALICE alebo ŠPORT, správaj sa, akoby elektronika neexistovala.

⚠️ **DYNAMICKÝ TÓN PRE ŠPORT A GOLF** ⚠️
- Pre športové potreby používaj termíny ako: **shaft, grip, úderová plocha, opotrebenie materiálu, pevnosť, vyváženie.**
- Zameraj sa na to, ako sa s náradím športuje, nie ako vyzerá jeho "obrazovka".

⚠️ **STRICT RULE: TEXT OD POUŽÍVATEĽA MÁ ABSOLÚTNU PRIORITU** ⚠️
- V prípade AKÉHOKOĽVEK rozporu: **TEXT POUŽÍVATEĽA (poznámky) > FOTKA.**
- Ak používateľ napíše "ako nový", ignoruj akýkoľvek škrabanec, ktorý by si mohol vidieť na fotke.

⚠️ **ZÁKAZ HALUCINÁCIÍ** ⚠️
- Nikdy si nevymýšľaj technické parametre.
- Ak nevieš údaj (napr. dĺžku palice), radšej ho vynechaj alebo použi [placeholder].

ŠTRUKTÚRA POPISU:
1. **PÚTAVÝ ÚVOD**: Emócia + hlavná fyzická vlastnosť.
2. **PARAMETRE A STAV**: Vizuálny blok (VEĽKÉ PÍSMENÁ nadpis, odrážky •).
3. **PODROBNÝ POPIS**: Min. 80 slov. Ľudsky, bazárovo, v 1. osobe.
4. **CENA**: "💰 CENA: [suma] €".

Výstup musí byť v slovenčine a vo formáte JSON.
  `.trim();

  let identification = null;
  if (!String(input.productName || "").trim() && hasImage) {
    try {
      identification = await identifyProductFromImage({ imageDataUrl, model, apiKey: OPENAI_API_KEY });
    } catch {
      identification = { name: "", confidence: 0, evidence: "" };
    }
  }

  // If the model isn't confident, avoid hallucinating a specific product name.
  const identificationName =
    identification && identification.confidence >= 0.6 ? identification.name : "";
  
  // SIMPLE SEARCH: Use exact query as user typed it (no AI processing)
  const rawQuery = String(input.productName || "").trim() || identificationName;
  let marketAds = [];
  
  // Single Bazoš search with EXACT user query
  if (rawQuery) {
    try {
      const categoryId = input.categoryId || 0;
      
      console.log(`🔍 SIMPLE SEARCH: "${rawQuery}" (category: ${categoryId})`);
      
      // One search call - no AI, no normalization, no fallbacks
      const fresh = await searchBazos(rawQuery, 100, categoryId, null); // 🆕 Increased from 50 to 100
      
      console.log(`📊 Found ${fresh.length} ads from Bazoš`);
      
      if (fresh.length > 0) {
        marketAds = fresh;
      } else {
        console.warn(`⚠️ No ads found on Bazoš for "${rawQuery}"`);
        
        // 🆕 GOOGLE SHOPPING FALLBACK: Try Google when Bazoš returns 0 results
        console.log(`🔄 Trying Google Shopping fallback...`);
        try {
          const googleAds = await searchGoogleShopping(rawQuery, 30);
          if (googleAds.length > 0) {
            marketAds = googleAds;
            console.log(`✅ Google Shopping found ${googleAds.length} results`);
          } else {
            console.warn(`⚠️ Google Shopping also returned 0 results`);
          }
        } catch (googleErr) {
          console.warn(`⚠️ Google Shopping fallback failed:`, googleErr);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Bazoš search failed:`, err);
    }
  }
  const clientSimilar = Array.isArray(input.similarAds) ? input.similarAds : [];
  const mergedSimilarAds = [...marketAds, ...clientSimilar];
  const inputWithMarket = { ...input, similarAds: mergedSimilarAds };

  const prompt = await buildPrompt(inputWithMarket);
  const promptWithId =
    identification && !String(input.productName || "").trim()
      ? `${prompt}\n\nIDENTIFIKÁCIA Z FOTKY (negarantované): ${identificationName || "neisté/unknown"}`
      : prompt;

  // Use Chat Completions because response_format is supported here and it supports vision input.
  let resp;
  try {
    const maskedKey = OPENAI_API_KEY.substring(0, 7) + "..." + OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4);
    console.log(`📡 Calling OpenAI API (${model}) with key ${maskedKey}`);
    
    resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: hasImage
              ? [
                  { type: "text", text: promptWithId },
                  { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
                ]
              : [{ type: "text", text: promptWithId }],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.8,
      }),
    });
  } catch (e) {
    const msg = e && e.message ? String(e.message) : "Failed to fetch OpenAI";
    console.error("❌ OpenAI network error:", msg);
    return { ok: false, error: `OpenAI fetch failed: ${msg}` };
  }

  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    console.error(`❌ OpenAI API error (${resp.status}):`, t);
    return { ok: false, error: `OpenAI error: ${resp.status} ${t}` };
  }

  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "Model did not return valid JSON." };
  }

  let title = String(parsed?.title || "").trim();
  let desc = String(parsed?.desc || "").trim();
  const benefits = Array.isArray(parsed?.benefits)
    ? parsed.benefits.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const whyBuyThis = Array.isArray(parsed?.whyBuyThis)
    ? parsed.whyBuyThis.map((x) => String(x).trim()).filter(Boolean).slice(0, 3)
    : [];
  const funnyPriceNote = String(parsed?.funnyPriceNote || "").trim();
  const ai_warnings = Array.isArray(parsed?.ai_warnings)
    ? parsed.ai_warnings.map((w) => ({
        type: String(w?.type || "question").trim(),
        message: String(w?.message || "").trim(),
        suggested_action: String(w?.suggested_action || "").trim(),
      })).filter((w) => w.message)
    : [];
  let conditionPercentFromModel = clamp(safeNumber(parsed?.conditionPercent, 0), 0, 100);
  const isTotalDestruction = Boolean(parsed?.isTotalDestruction);
  const modelPricing = parsed?.pricing ?? null;
  const specs = Array.isArray(parsed?.specs)
    ? parsed.specs
        .map((s) => ({
          label: String(s?.label ?? "").trim(),
          value: String(s?.value ?? "").trim(),
        }))
        .filter((s) => s.label && s.value)
        .slice(0, 10)
    : [];
  const specs_note = String(parsed?.specs_note ?? "").trim();
  const defects =
    Array.isArray(parsed?.defects)
      ? parsed.defects
          .map((d) => {
            const bbox = d?.bbox || {};
            const x = clamp(safeNumber(bbox?.x, 0), 0, 1);
            const y = clamp(safeNumber(bbox?.y, 0), 0, 1);
            const w = clamp(safeNumber(bbox?.w, 0), 0, 1);
            const h = clamp(safeNumber(bbox?.h, 0), 0, 1);
            const label = String(d?.label ?? "").trim();
            const severityRaw = String(d?.severity ?? "").trim().toLowerCase();
            const severity =
              severityRaw === "critical" || severityRaw === "high" || severityRaw === "medium" || severityRaw === "low"
                ? severityRaw
                : "low";
            if (!label) return null;
            if (!(w > 0) || !(h > 0)) return null;
            return { label, severity, bbox: { x, y, w, h } };
          })
          .filter(Boolean)
          .slice(0, 6)
      : [];
  const defectsSafe = inputWithMarket.detectDefects && hasImage ? defects : [];
  const similarAdsOut = Array.isArray(parsed?.similarAds)
    ? parsed.similarAds
        .map((a) => ({
          title: String(a?.title ?? "").trim(),
          price: safeNumber(a?.price, 0),
          condition: safeNumber(a?.condition, 90),
          source: String(a?.source ?? "").trim(),
        }))
        .filter(
          (a) =>
            a.title &&
            a.price > 0 &&
            a.condition >= 50 &&
            (a.source === "bazos" || a.source === "marketplace")
        )
        .slice(0, 20)
    : [];

  if (!title || !desc) return { ok: false, error: "Missing title/desc in model output." };

  // Hard guarantee: if user wrote battery %, it must appear in the final text.
  const facts = extractUserFacts(inputWithMarket.notes);
  const battery = facts.find((f) => f.key === "battery_percent");
  if (battery) {
    const needed = String(battery.value);
    const hasIt = desc.includes(needed) || benefits.some((x) => x.includes(needed));
    if (!hasIt) {
      // Keep bazos tone (simple, first-person-ish sentence)
      desc = `${desc} Batéria má cca ${needed}.`.trim();
    }
  }

  // Add AI disclaimer footer to the ad description
  const disclaimerFooter = "\n\n---\n\n⚠️ Tento inzerát bol vytvorený pomocou AI. Prevádzkovateľ nezodpovedá za vecnú správnosť údajov. Pred zverejnením si text dôkladne skontrolujte.";
  desc = `${desc}${disclaimerFooter}`;

  const batteryPctNum = battery ? safeNumber(String(battery.value).replace("%", ""), 0) : 0;
  const conditionPct =
    conditionPercentFromModel >= 70
      ? conditionPercentFromModel
      : clamp(safeNumber(identification?.confidence, 0) * 100, 70, 95); // fallback: don't overpromise

  // First-pass pricing for fallback generation (avoid using variables before declaration).
  const pricing0 = await computePricing({
    ...inputWithMarket,
    similarAds: similarAdsOut.length >= 2 ? similarAdsOut : Array.isArray(inputWithMarket.similarAds) ? inputWithMarket.similarAds : [],
    conditionPercent: conditionPct,
    batteryPercent: batteryPctNum,
  });

  // Fallback: if model didn't return similar ads, generate 2–3 deterministic "market-like" items
  // based on the fair price and product name (no pretending it's scraped).
  const baseName = String(inputWithMarket.productName || "").trim() || identificationName || "Produkt";
  const seed = Array.from(baseName).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) || 42;
  const jitter = (n) => ((seed % n) + 1) / n;
  const mkPrice = (mul) =>
    Math.max(
      1,
      Math.round((pricing0.fair * mul) / safeNumber(inputWithMarket.step, 5)) * safeNumber(inputWithMarket.step, 5)
    );

  const similarAdsSafe =
    similarAdsOut.length >= 2
      ? similarAdsOut
      : [
          {
            title: `${baseName} – veľmi dobrý stav`,
            price: mkPrice(0.92 + 0.06 * jitter(7)),
            condition: Math.round(84 + 10 * jitter(9)),
            source: "bazos",
          },
          {
            title: `${baseName} – kompletné balenie`,
            price: mkPrice(0.98 + 0.08 * jitter(11)),
            condition: Math.round(82 + 12 * jitter(13)),
            source: "marketplace",
          },
          {
            title: `${baseName} – rýchly predaj`,
            price: mkPrice(0.86 + 0.05 * jitter(5)),
            condition: Math.round(78 + 12 * jitter(8)),
            source: "bazos",
          },
        ].slice(0, 3);

  // Final pricing should be based on the (model-generated or fallback) similar ads + heureka cap + condition.
  let pricing = await computePricing({
    ...inputWithMarket,
    similarAds: similarAdsSafe,
    conditionPercent: conditionPct,
    batteryPercent: batteryPctNum,
  });

  // HARD LIMIT: totálna deštrukcia override
  if (isTotalDestruction) {
    // Override title – pridaj suffix "na náhradné diely / poškodený"
    if (title && !title.toLowerCase().includes("náhradné diely") && !title.toLowerCase().includes("poškodený")) {
      title = `${title} – na náhradné diely / poškodený`;
    }
    // Override conditionPercent na 10-30 (totálna deštrukcia)
    conditionPercentFromModel = Math.min(conditionPercentFromModel, 30);
    // Override pricing – max 5-10€ (železo)
    const step = safeNumber(inputWithMarket.step, 5);
    pricing = {
      ...pricing,
      fair: Math.min(pricing.fair, step === 1 ? 10 : roundToStep(8, step)),
      quick: roundToStep(5, step),
      premium: roundToStep(10, step),
      conditionPercent: conditionPercentFromModel,
    };
    // Override desc – pridaj jasné varovanie o totálnej deštrúkcii (ak tam ešte nie je)
    if (!desc.toLowerCase().includes("po vážnej nehode") && !desc.toLowerCase().includes("totálne poškodený")) {
      const criticalDefects = defectsSafe.filter((d) => d.severity === "critical").map((d) => d.label);
      const defectsList = criticalDefects.length ? criticalDefects.join(", ") : "výrazné poškodenie hlavných častí";
      desc = `${desc}\n\n**Priznaný stav a vady:**\nProdukt je po vážnej nehode / je totálne poškodený (${defectsList}). Vhodné len na náhradné diely alebo železo.`;
    }
  }

  // Alias for frontend: keep naming simple/explicit
  const prices = {
    recommended: pricing.fair,
    quick: pricing.quick,
    market: pricing.fair,
    premium: pricing.premium,
    // Slider range keys requested by frontend:
    price_recommended: pricing.fair,
    price_quick: pricing.quick,
    price_max: pricing.premium,
    // Keep low/high aligned with the actual tiers (prevents collapsed UI like 20€ == 20€).
    price_low: pricing.quick,
    price_high: pricing.premium,
    heureka_new: pricing.newPrice,
    price_heureka: pricing.newPrice,
    price_heureka_max: safeNumber(inputWithMarket.newPriceMax, 0) > 0 ? Math.round(safeNumber(inputWithMarket.newPriceMax, 0)) : null,
    heureka_available: pricing.status === "available",
    value_pct: pricing.valuePct,
  };
  
  // 🆕 DETECT GOOGLE SHOPPING FALLBACK
  const usedGoogleFallback = marketAds.length > 0 && marketAds.every(ad => ad?.source === "google_shopping");
  const googleSearchUrl = usedGoogleFallback 
    ? `https://www.google.com/search?q=${encodeURIComponent(rawQuery + ' site:heureka.sk')}&tbm=shop`
    : null;
  
  return {
    ok: true,
    data: {
      title,
      desc,
      benefits,
      whyBuyThis,
      funnyPriceNote,
      ai_warnings: ai_warnings || [],
      specs: [],
      specs_note,
      defects: defectsSafe,
      similarAds: similarAdsSafe,
      pricing,
      prices,
      modelPricing,
      googleFallback: usedGoogleFallback, // 🆕 Flag for UI
      googleSearchUrl, // 🆕 Link to Google Shopping
      debug: {
        productNameSent: String(inputWithMarket.productName || ""),
        imageReceived: hasImage,
        imageSizeBytesApprox: hasImage ? Math.round((imageDataUrl.length * 3) / 4) : 0,
        model,
        identification,
        conditionPercent: pricing.conditionPercent,
        marketQuery: rawQuery,
        marketAdsCount: Array.isArray(marketAds) ? marketAds.length : 0,
        similarAdsUsedCount: Array.isArray(similarAdsSafe) ? similarAdsSafe.length : 0,
      },
      // REAL MARKET ADS: Return all market ads found (not just OpenAI-generated ones)
      marketAds: Array.isArray(marketAds) ? marketAds : [],
    },
  };
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".svg") return "image/svg+xml; charset=utf-8";
  return "application/octet-stream";
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let rel = url.pathname === "/" ? "/index.html" : url.pathname;
  
  // Avoid noisy console errors for missing favicon during dev.
  if (rel === "/favicon.ico") {
    res.writeHead(204, { "cache-control": "no-store", ...corsHeaders() });
    return res.end();
  }

  const safeRel = rel.replaceAll("..", "");
  let filePath = path.join(__dirname, safeRel);

  try {
    // Check if it's a directory, if so, serve index.html
    const stats = await fs.stat(filePath);
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const buf = await fs.readFile(filePath);
    res.writeHead(200, {
      "content-type": contentTypeFor(filePath),
      "cache-control": "no-store",
    });
    res.end(buf);
  } catch (err) {
    // Fallback to index.html for SPA-like behavior on unknown routes
    if (rel !== "/index.html") {
      try {
        const indexBuf = await fs.readFile(path.join(__dirname, "index.html"));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        return res.end(indexBuf);
      } catch (indexErr) {
        // ignore
      }
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

// ⚖️ CENTRAL PRICING ENGINE (Backend version)
function getFairPriceBasis(modelName, rawPrice) {
  const nameLower = modelName.toLowerCase();
  let price = Number(rawPrice || 0);

  // 1. Model-Specific Floors (Hard minimums for known models)
  if (nameLower.includes("iphone 17 pro max")) price = Math.max(price, 1150);
  else if (nameLower.includes("iphone 17 pro")) price = Math.max(price, 1050);
  else if (nameLower.includes("iphone 17")) price = Math.max(price, 920);

  else if (nameLower.includes("iphone 16 pro max")) price = Math.max(price, 1050);
  else if (nameLower.includes("iphone 16 pro")) price = Math.max(price, 920);
  else if (nameLower.includes("iphone 16")) price = Math.max(price, 720);

  else if (nameLower.includes("iphone 15 pro max")) price = Math.max(price, 850);
  else if (nameLower.includes("iphone 15 pro")) price = Math.max(price, 720);
  else if (nameLower.includes("iphone 15 plus")) price = Math.max(price, 580);
  else if (nameLower.includes("iphone 15")) price = Math.max(price, 520);

  else if (nameLower.includes("iphone 14 pro max")) price = Math.max(price, 650);
  else if (nameLower.includes("iphone 14 pro")) price = Math.max(price, 550);
  else if (nameLower.includes("iphone 14 plus")) price = Math.max(price, 450);
  else if (nameLower.includes("iphone 14")) price = Math.max(price, 420);

  else if (nameLower.includes("iphone 13 pro max")) price = Math.max(price, 520);
  else if (nameLower.includes("iphone 13 pro")) price = Math.max(price, 480);
  else if (nameLower.includes("iphone 13 mini")) price = Math.max(price, 320);
  else if (nameLower.includes("iphone 13")) price = Math.max(price, 380);

  else if (nameLower.includes("iphone 12 pro max")) price = Math.max(price, 380);
  else if (nameLower.includes("iphone 12 pro")) price = Math.max(price, 340);
  else if (nameLower.includes("iphone 12 mini")) price = Math.max(price, 240);
  else if (nameLower.includes("iphone 12")) price = Math.max(price, 290);
  else if (nameLower.includes("iphone 11 pro max")) price = Math.max(price, 280);
  else if (nameLower.includes("iphone 11 pro")) price = Math.max(price, 240);
  else if (nameLower.includes("iphone 11")) price = Math.max(price, 190);

  // 💻 MacBooks (Floors)
  if (nameLower.includes("macbook pro 16 (m3 pro)")) price = Math.max(price, 1850);
  else if (nameLower.includes("macbook pro 14 (m4")) price = Math.max(price, 1750);
  else if (nameLower.includes("macbook air 13 (m3")) price = Math.max(price, 1100);
  else if (nameLower.includes("macbook pro 14 (m3")) price = Math.max(price, 1400);
  else if (nameLower.includes("macbook air 13 (m2")) price = Math.max(price, 900);
  else if (nameLower.includes("macbook pro 14 (m1 pro")) price = Math.max(price, 1150);
  else if (nameLower.includes("macbook air (m1")) price = Math.max(price, 580);

  // 📱 iPads (Floors)
  if (nameLower.includes("ipad pro 13 (m4")) price = Math.max(price, 1100);
  else if (nameLower.includes("ipad pro 11 (m4")) price = Math.max(price, 900);
  else if (nameLower.includes("ipad pro 12.9 (m2")) price = Math.max(price, 800);
  else if (nameLower.includes("ipad pro 11 (m2")) price = Math.max(price, 650);
  else if (nameLower.includes("ipad air (m2")) price = Math.max(price, 550);
  else if (nameLower.includes("ipad air (m1")) price = Math.max(price, 420);
  else if (nameLower.includes("ipad mini 7")) price = Math.max(price, 500);
  else if (nameLower.includes("ipad mini 6")) price = Math.max(price, 350);
  else if (nameLower.includes("ipad 10")) price = Math.max(price, 320);
  else if (nameLower.includes("ipad 9")) price = Math.max(price, 240);

  // 💻 Other Laptops (Brand Floors)
  if (nameLower.includes("razer blade 16")) price = Math.max(price, 1500);
  else if (nameLower.includes("razer blade 14")) price = Math.max(price, 1200);
  else if (nameLower.includes("razer blade 15")) price = Math.max(price, 1000);
  else if (nameLower.includes("razer blade 17")) price = Math.max(price, 1100);
  else if (nameLower.includes("razer") || nameLower.includes("rog") || nameLower.includes("alienware") || nameLower.includes("msi") || nameLower.includes("omen")) {
    price = Math.max(price, 850);
  }
  else if (nameLower.includes("notebook") || nameLower.includes("laptop") || nameLower.includes("legion") || nameLower.includes("zenbook") || nameLower.includes("xps")) {
    price = Math.max(price, 400);
  }

  if (nameLower.includes("tablet") || nameLower.includes("tab") || nameLower.includes("surface") || nameLower.includes("pad")) {
    price = Math.max(price, 180);
  }

  // 🎧 Audio
  if (nameLower.includes("airpods pro 2")) price = Math.max(price, 170);
  else if (nameLower.includes("airpods pro")) price = Math.max(price, 120);
  else if (nameLower.includes("airpods 3")) price = Math.max(price, 90);
  else if (nameLower.includes("airpods 2")) price = Math.max(price, 50);
  else if (nameLower.includes("airpods 1")) price = Math.max(price, 25);
  else if (nameLower.includes("magic mouse")) price = Math.max(price, 55);

  // 2. Priority: Valid database price (if not overridden above)
  if (price > 50 && price < 2500) return price;

  return price > 50 ? price : 100;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  // LOG ALL REQUESTS TO DEBUG 404
  console.log(`[API Request] ${req.method} ${pathname}`);

  if (pathname === "/api/products/list" && req.method === "GET") {
    try {
      if (!supabase) return json(res, 500, { ok: false, error: "Database not connected" });
      const { data, error } = await supabase
        .from('products')
        .select('name, brand, model_name, category, negotiation_tips')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return json(res, 200, { ok: true, products: data });
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message });
    }
  }

  // 📄 STATIC PAGES REDIRECTS (Clean URLs)
  if (pathname === "/privacy") {
    req.url = "/privacy.html";
    return serveStatic(req, res);
  }
  if (pathname === "/about") {
    req.url = "/about.html";
    return serveStatic(req, res);
  }
  if (pathname === "/terms") {
    req.url = "/terms.html"; 
    return serveStatic(req, res);
  }
  if (pathname === "/cookies") {
    req.url = "/cookies.html"; 
    return serveStatic(req, res);
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  // 🕵️ HEUREKA SCRAPER ENDPOINT (PRIORITY with SUPABASE CACHE)
  if (pathname === "/api/heureka" && req.method === "GET") {
    const model = String(url.searchParams.get("model") || "").trim();
    const storage = String(url.searchParams.get("storage") || "").trim();
    const ram = String(url.searchParams.get("ram") || "").trim();
    const color = String(url.searchParams.get("color") || "").trim();
    
    let fullQuery = model;
    if (storage) fullQuery += ` ${storage}`;
    if (ram) fullQuery += ` ${ram} RAM`;
    if (color) fullQuery += ` ${color}`;

    if (!model) return json(res, 400, { ok: false, error: "Missing model" });

    try {
      // 1. Check Cache in Supabase
      let cached = null;
      if (supabase) {
        const { data, error: dbError } = await supabase
          .from('market_prices')
          .select('*')
          .eq('model', model)
          .eq('storage', storage)
          .eq('ram', ram)
          .eq('color', color)
          .single();
        if (!dbError) cached = data;
      }

      const CACHE_LIMIT = 24 * 60 * 60 * 1000; // 24 hours
      const now = new Date();
      
      if (cached && (now - new Date(cached.updated_at)) < CACHE_LIMIT) {
        console.log(`📦 CACHE HIT: Returning stored data for "${fullQuery}"`);
        return json(res, 200, {
          ok: true,
          priceFrom: cached.price_from,
          priceAvg: cached.price_avg,
          source: cached.source,
          date: cached.freshness_date,
          cached: true,
          queryUsed: fullQuery
        });
      }

      // 2. Cache Miss or Expired -> Run Scraper
      console.log(`🕵️ CACHE MISS: Scraping fresh data for: "${fullQuery}"`);
      const { stdout } = await execAsync(`node scripts/heureka-scraper.js "${fullQuery}"`);
      const match = stdout.match(/DATA_EXIT: priceFrom=([\d.]+) avgPrice=([\d.]+) source=(\w+) date="([^"]+)"/);
      
      if (match) {
        let priceFrom = parseFloat(match[1]);
        let priceAvg = parseFloat(match[2]);
        const source = match[3];
        const freshnessDate = match[4];

        // ⚖️ APPLY SAFETY CAPS before saving to DB
        priceAvg = getFairPriceBasis(model, priceAvg);
        priceFrom = Math.min(priceFrom, priceAvg * 0.95);

        // 🛡️ ANTI-SWAPPIE SHIELD: Kontrola anomálií oproti histórii
        let isAnomaly = false;
        let historicalAvg = 0;
        if (supabase) {
          const { data: history } = await supabase
            .from('price_history')
            .select('price_avg')
            .eq('model', model)
            .eq('storage', storage)
            .order('recorded_at', { ascending: false })
            .limit(10);
          
          if (history && history.length > 3) {
            historicalAvg = history.reduce((sum, h) => sum + Number(h.price_avg), 0) / history.length;
            if (priceAvg > historicalAvg * 1.20) {
              console.log(`🛡️ ANOMÁLIA DETEKOVANÁ: Nová cena ${priceAvg}€ je o viac ako 20% vyššia ako historický priemer ${Math.round(historicalAvg)}€`);
              isAnomaly = true;
            }
          }
        }

        // 3. Update Supabase with fresh data
        if (supabase) {
          const { error: upsertError } = await supabase
            .from('market_prices')
            .upsert({
              model,
              storage,
              ram,
              color,
              price_from: priceFrom,
              price_avg: isAnomaly ? Math.round(historicalAvg || priceAvg) : priceAvg, // Ak je anomália, radšej vrátime históriu
              source: isAnomaly ? `${source}_anomaly` : source,
              freshness_date: freshnessDate,
              updated_at: new Date().toISOString()
            }, { onConflict: 'model,storage,ram,color' });

          if (upsertError) console.error("❌ Supabase Upsert Error:", upsertError);

          // 📜 ARCHIVÁCIA: Každé nové scrapovanie uložíme do histórie
          await supabase
            .from('price_history')
            .insert({
              model,
              storage,
              ram,
              color,
              price_from: priceFrom,
              price_avg: priceAvg,
              source
            });
        }

        return json(res, 200, {
          ok: true,
          priceFrom,
          priceAvg: isAnomaly ? Math.round(historicalAvg || priceAvg) : priceAvg,
          isAnomaly,
          historicalAvg: Math.round(historicalAvg),
          source,
          date: freshnessDate,
          cached: false,
          queryUsed: fullQuery
        });
      }
      return json(res, 404, { ok: false, error: "Data not found" });
    } catch (err) {
      return json(res, 500, { ok: false, error: "Scraper/DB failed", details: err.message });
    }
  }

  if (pathname === "/api/health" && req.method === "GET") {
    return json(res, 200, {
      ok: true,
      hasKey: Boolean(OPENAI_API_KEY),
      node: process.version,
      hasFetch: typeof fetch === "function",
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      // 🆕 PRODUCTION METRICS
      cache: serverCache.getStats(),
      uptime: Math.round(process.uptime()),
      dbConnected: !!supabase,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    });
  }

  if (pathname === "/api/info" && req.method === "GET") {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (!n || n.internal) continue;
        if (n.family !== "IPv4") continue;
        ips.push({ name, address: n.address });
      }
    }
    return json(res, 200, { ok: true, port: PORT, ips });
  }

  if (pathname === "/api/health" && req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed", allowed: ["GET"], method: req.method, path: pathname });
  }

  // 💾 AUDITS API (Save & Load)
  if (pathname.startsWith("/api/audits") || pathname.startsWith("/api/audit/") || pathname.startsWith("/api/auth/")) {
    if (pathname === "/api/audits" && req.method === "POST") {
      try {
        const body = await readBody(req);
        if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });
        const { report_data, risk_score, final_price_recommendation, product_id, user_email, user_id } = body;
        if (!supabase) throw new Error("Database not connected");

        const insertData = {
          product_id,
          report_data,
          risk_score: risk_score || 0,
          final_price_recommendation: final_price_recommendation || 0,
          status: 'completed'
        };

        // Only add user_email/user_id if they exist in the body to avoid issues with missing columns
        if (user_email) insertData.user_email = user_email;
        if (user_id) insertData.user_id = user_id;

        const { data, error } = await supabase
          .from('audits')
          .insert(insertData)
          .select('id')
          .single();

        if (error) throw error;

        // 🔔 ALWAYS NOTIFY ADMIN (New Request)
        const protocol = req.headers["x-forwarded-proto"] || "https";
        let host = req.headers.host || "www.auditlyio.sk";
        if (!host.includes("www.") && !host.includes("localhost") && !host.includes("127.0.0.1") && !host.includes(".up.railway.app")) {
          host = "www." + host;
        }
        const currentBaseUrl = `${protocol}://${host}`;
        const adminEmail = process.env.ADMIN_EMAIL || "auditly.io@gmail.com";
        
        // Notify admin in background
        sendAuditEmail(adminEmail, data.id, report_data.productName || report_data.model || "Zariadenie", currentBaseUrl)
          .catch(mailErr => console.error("❌ [API Audits] Admin notification failure:", mailErr.message));

        // If user email provided, send the link to them too
        if (user_email && user_email !== adminEmail) {
          sendAuditEmail(user_email, data.id, report_data.productName || report_data.model || "Zariadenie", currentBaseUrl)
            .catch(mailErr => console.error("❌ [API Audits] User email failure:", mailErr.message));
        }

        return json(res, 200, { ok: true, id: data.id });
      } catch (err) {
        return json(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname.startsWith("/api/audits/") && req.method === "GET") {
      const id = pathname.split("/").pop();
      if (!id || id === "audits") return json(res, 400, { ok: false, error: "Chýba ID auditu." });
      
      console.log(`📡 [API Audits] Fetching audit ID: ${id}`);
      
      try {
        if (!supabase) throw new Error("Databáza nie je pripojená.");

        // 1. Fetch Audit Data
        const { data: audit, error: auditErr } = await supabase
          .from('audits')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (auditErr) {
          console.error("❌ [API Audits] DB Error:", auditErr.message);
          throw new Error("Chyba pri hľadaní auditu v databáze.");
        }
        
        if (!audit) {
          return json(res, 404, { ok: false, error: "Audit report sa nenašiel. Skontrolujte, či je ID správne." });
        }

        // 2. Fetch Product Data (Separate to avoid JOIN issues)
        let product = { name: "Neznáme zariadenie", category: "Other" };
        if (audit.product_id) {
          const { data: prodData, error: prodErr } = await supabase
            .from('products')
            .select('*')
            .eq('id', audit.product_id)
            .maybeSingle();
          if (!prodErr && prodData) product = prodData;
        }

        // 3. View Logic & Expiration
        const createdAt = new Date(audit.created_at);
        const now = new Date();
        const diffMs = Math.abs(now.getTime() - createdAt.getTime());
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffHours / 24;
        
        const viewType = url.searchParams.get("view"); 
        const authEmail = url.searchParams.get("email");

        console.log(`🕒 [API Audits] ID: ${id}, View: ${viewType || 'private'}, Age: ${diffHours.toFixed(1)}h`);

        // 🛡️ SECURITY LOCK: If audit has an owner, require email for non-public views
        const isPublic = viewType === 'public';
        if (!isPublic && audit.user_email) {
          if (!authEmail || authEmail.toLowerCase().trim() !== audit.user_email.toLowerCase().trim()) {
            // Return locked status but include basic product info for the "lock screen"
            return json(res, 403, { 
              ok: false, 
              locked: true, 
              error: "Tento audit je súkromný a chránený e-mailom majiteľa.",
              product_name: product.name 
            });
          }
        }

        if (viewType === 'public') {
          if (diffDays > 30) {
            return json(res, 410, { ok: false, error: "Tento verejný certifikát už expiroval (30 dní)." });
          }
        } else if (viewType === 'expert' || viewType === 'private' || !viewType) {
          // 72h limit for expert/private views
          if (diffHours > 72) {
            return json(res, 410, { ok: false, error: "Tento expertný report už expiroval (72 hodín)." });
          }
        }

        // 4. Increment View Count (Non-blocking)
        supabase.from('audits')
          .update({ view_count: (audit.view_count || 0) + 1 })
          .eq('id', id)
          .then(() => {})
          .catch(e => console.warn("⚠️ View count update failed:", e.message));

        // Clone audit object to ensure we can modify it
        const auditResponse = { ...audit, products: product };
        return json(res, 200, { ok: true, audit: auditResponse });

      } catch (err) {
        console.error("❌ [API Audits] Final Error:", err.message);
        return json(res, 500, { ok: false, error: "Chyba pri načítaní auditu.", details: err.message });
      }
    }

    // 📩 FETCH AUDITS BY EMAIL
    if (pathname === "/api/audits-by-email" && req.method === "GET") {
      const email = url.searchParams.get("email");
      if (!email) return json(res, 400, { ok: false, error: "Missing email" });

      try {
        if (!supabase) throw new Error("Database not connected");

        // Fetch audits (Case-insensitive)
        const { data: audits, error: auditsErr } = await supabase
          .from('audits')
          .select('*')
          .ilike('user_email', email)
          .order('created_at', { ascending: false });

        if (auditsErr) throw auditsErr;

        if (!audits || audits.length === 0) {
          return json(res, 200, { ok: true, audits: [] });
        }

        // Optimized product lookup
        const productIds = Array.from(new Set(audits.map(a => a.product_id)));
        const { data: products } = await supabase
          .from('products')
          .select('id, name, model_name')
          .in('id', productIds);

        const productsMap = (products || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {});

        const auditsWithProducts = audits.map(audit => ({
          ...audit,
          products: productsMap[audit.product_id] || { name: 'Neznáme zariadenie' }
        }));

        return json(res, 200, { ok: true, audits: auditsWithProducts });
      } catch (err) {
        console.error("❌ [API Audits] Fetch by email error:", err.message);
        return json(res, 500, { ok: false, error: err.message });
      }
    }

    // 🔗 CLAIM AUDIT (Update email for an existing audit)
    if (pathname.startsWith("/api/audits/") && req.method === "PATCH") {
      const id = pathname.split("/").pop();
      if (!id || id === "audits") return json(res, 400, { ok: false, error: "Chýba ID auditu." });

      try {
        const body = await readBody(req);
        const { email } = body;
        if (!email) return json(res, 400, { ok: false, error: "Missing email" });
        if (!supabase) throw new Error("Database not connected");

        const { data, error } = await supabase
          .from('audits')
          .update({ user_email: email })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;
        
        // Optionally send email notification
        const protocol = req.headers["x-forwarded-proto"] || "https";
        let host = req.headers.host || "www.auditlyio.sk";
        if (!host.includes("www.") && !host.includes("localhost") && !host.includes("127.0.0.1") && !host.includes(".up.railway.app")) {
          host = "www." + host;
        }
        const currentBaseUrl = `${protocol}://${host}`;

        sendAuditEmail(email, id, data.report_data?.productName || "Zariadenie", currentBaseUrl)
          .catch(err => console.warn("⚠️ [API Audits] Claim email failed:", err.message));

        return json(res, 200, { ok: true, message: "Audit priradený k e-mailu." });
      } catch (err) {
        console.error("❌ [API Audits] Patch error:", err.message);
        return json(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname === "/api/audit/report" && req.method === "GET") {
      const brand = String(url.searchParams.get("brand") || "").trim();
      const model = String(url.searchParams.get("model") || "").trim();
      if (!model) return json(res, 400, { ok: false, error: "Missing model" });
      if (!supabase) return json(res, 500, { ok: false, error: "Database not connected" });

      try {
        let query = supabase.from('products').select('*');
        
        if (brand) {
          query = query.ilike('brand', brand);
        }
        
        // Skúsime hľadať v model_name alebo v name
        const { data, error } = await query
          .or(`model_name.ilike."${model}",name.ilike."${model}"`)
          .maybeSingle();

        if (error) throw error;
        if (!data) return json(res, 404, { ok: false, error: "Audit report not found for this model" });
        return json(res, 200, { ok: true, report: data });
      } catch (err) {
        return json(res, 500, { ok: false, error: "Database query failed", details: err.message });
      }
    }

    // 🔐 AUTH API (Internal User Management)
    if (pathname === "/api/auth/register" && req.method === "POST") {
      try {
        const body = await readBody(req);
        if (!body || !body.email || !body.password) {
          return json(res, 400, { ok: false, error: "Email a heslo sú povinné." });
        }
        const { email, password } = body;
        if (!supabase) throw new Error("Database not connected");

        const hashedPassword = hashPassword(password);
        const { data, error } = await supabase
          .from('users')
          .insert({ email, password_hash: hashedPassword })
          .select('id, email')
          .single();

        if (error) {
          if (error.code === '23505') return json(res, 400, { ok: false, error: "Tento e-mail je už zaregistrovaný." });
          throw error;
        }

        return json(res, 200, { ok: true, user: data });
      } catch (err) {
        return json(res, 500, { ok: false, error: err.message });
      }
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      try {
        const body = await readBody(req);
        if (!body || !body.email || !body.password) {
          return json(res, 400, { ok: false, error: "Email a heslo sú povinné." });
        }
        const { email, password } = body;
        if (!supabase) throw new Error("Database not connected");

        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (error) throw error;
        if (!data || !verifyPassword(password, data.password_hash)) {
          return json(res, 401, { ok: false, error: "Nesprávny e-mail alebo heslo." });
        }

        return json(res, 200, { ok: true, user: { id: data.id, email: data.email } });
      } catch (err) {
        return json(res, 500, { ok: false, error: err.message });
      }
    }

    // ⚖️ [AI Porovnanie] AI-driven expert comparison
    if (pathname === "/api/audit/compare" && req.method === "POST") {
      console.log("⚖️ [AI Porovnanie] Prijatá požiadavka...");
      const body = await readBody(req);
      const { modelA, modelB, brandA, brandB } = body;

      if (!modelA || !modelB) {
        return json(res, 400, { ok: false, error: "Missing models for comparison" });
      }

      try {
        if (!supabase) throw new Error("Database not connected");

        // Fetch specs for both from DB if available to ground the AI
        const { data: specA } = await supabase.from('products').select('*').ilike('model_name', modelA).maybeSingle();
        const { data: specB } = await supabase.from('products').select('*').ilike('model_name', modelB).maybeSingle();

        const modelToUse = "gpt-4o"; // Force GPT-4o for expert technical analysis

        const comparePrompt = `
Si hlavný technický auditor bazárovej elektroniky. Vykonaj hĺbkové odborné porovnanie dvoch zariadení.
Zameraj sa na technické detaily, ktoré bežný používateľ nevidí (RAM typ, čipset, technológia displeja, reálny výkon).

ZARIADENIE A: ${modelA} (Značka: ${brandA || 'Apple'})
ZARIADENIE B: ${modelB} (Značka: ${brandB || 'Apple'})

DOPLNKOVÉ INFO Z DB (ak existuje):
A: ${specA ? JSON.stringify({ cpu: specA.display_tech, common_faults: specA.common_faults }) : 'N/A'}
B: ${specB ? JSON.stringify({ cpu: specB.display_tech, common_faults: specB.common_faults }) : 'N/A'}

PRAVIDLÁ POROVNANIA:
1. Porovnávaj RAM: Ktorý model má viac? Je tam rozdiel v generácii (napr. LPDDR4x vs LPDDR5)? Prečo je to dôležité?
2. Porovnávaj VÝKON: Reálny rozdiel v čipsetoch (napr. A14 vs A15). Koľko % výkonu naviac to reálne znamená pre bežného používateľa a pre hráča?
3. Porovnávaj DISPLEJ: Jas v nitoch (peak brightness), obnovovacia frekvencia (60Hz vs 120Hz), typ panela.
4. Porovnávaj FOTOAPARÁT: Rozlíšenie, veľkosť senzora, zoom schopnosti (optický vs digitálny).
5. Porovnávaj NABÍJANIE: Typ portu (USB-C vs Lightning), rýchlosť nabíjania (W), podpora bezdrôtového nabíjania (MagSafe).
6. Porovnávaj ŽIVOTNOSŤ: Ktorý model bude mať dlhšiu softvérovú podporu?

Vráť JSON v slovenčine:
{
  "verdict": "Jasný a stručný verdikt (1-2 vety). Pre koho je ktorý vhodnejší?",
  "specsA": {
    "cpu": "Názov čipsetu",
    "ram": "Veľkosť RAM (napr. 6 GB LPDDR5)",
    "display": "Typ a jas (napr. OLED, 1200 nitov)",
    "camera": "Hlavný snímač a zoom (napr. 48MP + 3x optický)",
    "charging": "Konektor a rýchlosť (napr. USB-C, 27W)",
    "material": "Materiál tela (napr. Titán, Hliník)"
  },
  "specsB": {
    "cpu": "Názov čipsetu",
    "ram": "Veľkosť RAM",
    "display": "Typ a jas",
    "camera": "Hlavný snímač a zoom",
    "charging": "Konektor a rýchlosť",
    "material": "Materiál tela"
  },
  "pointsA": ["Odborný bod 1 za model A", "Odborný bod 2 za model A", "Odborný bod 3 za model A"],
  "negativesA": ["Slabina 1 modelu A", "Slabina 2 modelu A"],
  "pointsB": ["Odborný bod 1 za model B", "Odborný bod 2 za model B", "Odborný bod 3 za model B"],
  "negativesB": ["Slabina 1 modelu B", "Slabina 2 modelu B"],
  "technicalWinner": "Názov modelu, ktorý je technicky vyspelejší",
  "reasoning": "Stručné odborné zdôvodnenie prečo vyhral víťaz."
}
        `.trim();

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${OPENAI_API_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [{ role: "user", content: comparePrompt }],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          throw new Error(`OpenAI API failure: ${resp.status} - ${errText}`);
        }
        
        const data = await resp.json();
        const result = JSON.parse(data.choices[0].message.content);

        console.log(`✅ [AI Porovnanie] Hotovo: ${modelA} vs ${modelB}`);
        return json(res, 200, { ok: true, result });
      } catch (err) {
        console.error("🔥 [AI Porovnanie] Chyba:", err);
        return json(res, 500, { ok: false, error: err.message });
      }
    }

    // 📸 NEW: AI MULTI-PHOTO IDENTIFICATION & CONDITION
    if (pathname === "/api/audit/identify-multi" && req.method === "POST") {
      console.log("📸 [AI Skener] Prijatá požiadavka na analýzu...");
      const body = await readBody(req);
      if (!body || !Array.isArray(body.images) || body.images.length === 0) {
        console.error("❌ [AI Skener] Chýbajúce fotky v požiadavke");
        return json(res, 400, { ok: false, error: "Missing or invalid images array" });
      }

      const images = body.images.filter(img => typeof img === "string" && img.startsWith("data:image/"));
      console.log(`📸 [AI Skener] Prijatých ${images.length} platných fotografií`);

      if (images.length === 0) {
        return json(res, 400, { ok: false, error: "No valid data:image/ URLs found" });
      }

      try {
        if (!supabase) throw new Error("Database not connected");
        
        // 1. Get list of allowed models from DB to increase accuracy and save money
        const { data: dbModels } = await supabase
          .from('products')
          .select('model_name')
          .order('model_name', { ascending: true });
        
        const allowedModels = [...new Set((dbModels || []).map(m => m.model_name))];
        const modelsListStr = allowedModels.join(", ");

        const model = "gpt-4o"; // FORCED HIGH-END MODEL FOR TERMINATOR PRECISION
        console.log(`🤖 [AI Skener] ŠTART ANALÝZY s modelom ${model} (Vysoká presnosť)...`);
        
        const idPrompt = `
SI ABSOLÚTNA ŠPIČKA V IDENTIFIKÁCII APPLE HARDVÉRU. Tvojou úlohou je neomylne rozoznať iPhone 13/14 od iPhone 15/16.

ZAMERAJ SA NA TENTO KRITICKÝ ROZDIEL (Predná strana):
- iPhone 13/14: MÁ "NOTCH" (čierny výrez, ktorý je FYZICKY SPOJENÝ s horným rámom telefónu).
- iPhone 15/16: MÁ "DYNAMIC ISLAND" (čierna pilulka, ktorá je SAMOSTATNE v displeji, nad ňou aj pod ňou svietia pixely).

AK VIDÍŠ DISPLEJ OKOLO ČIERNEHO PRVKU HORE, JE TO iPHONE 15 ALEBO 16.
AK JE ČIERNY PRVOK PRICHYTENÝ K RÁMU, JE TO iPHONE 13 ALEBO 14.

ZAMERAJ SA NA ZADNÚ STRANU:
- iPhone 15: Matné, saténové sklo, pastelové farby.
- iPhone 13: Lesklé, zrkadlové sklo, sýte farby.

VISUÁLNE CHYBY & STAV (PRÍSNE PRAVIDLÁ - TERMINATOR MODE):
- Buď extrémne prísny. Ak vidíš na displeji čo i len malú čiaru, je to PRASKLINA.
- AK JE PRASKLINA (IMPACT / PAVUČINA), STAV JE MAX 40-50%.
- 100% = Úplne nové, nerozbalené, vo fóliách. Žiadne stopy používania.
- 91-99% = TOP STAV. Žiadne viditeľné škrabance.
- 85-90% = MIKRO-ŠKRABANCE (Bežné známky používania).
- 70-75% = VLÁSOČNICOVÁ PRASKLINA (Tenká čiara).
- 40-50% = PRASKLINA / IMPACT (FAILED AUDIT).

DETEKCIA VÁD:
- Hľadaj škrabance, praskliny, odreniny na ráme alebo šošovkách.
- Buď konkrétny. Ak si nie si istý, radšej vadu nahlás.
- Tieto chyby budú zahrnuté do inzerátu, tak píš profesionálne.

ZOZNAM POVOLENÝCH MODELOV:
${modelsListStr}

Vráť JSON:
{
  "model": "PRESNÝ NÁZOV ZO ZOZNAMU",
  "category": "Mobil",
  "condition": 95,
  "defects": ["škrabanec na hornom rohu", "jemne ošúchaný lak pri konektore"],
  "confidence": 1.0,
  "evidence": "POVODNÝ DÔKAZ: [Vymenuj čo vidíš na displeji a prečo to nie je iný model. Napr: Vidím Dynamic Island, čiže je to 15, nie 13.]"
}
`.trim();

        console.log(`🤖 [AI Skener] Odosielam požiadavku do OpenAI (${model}) s vysokým rozlíšením...`);
        const messages = [
          {
            role: "user",
            content: [
              { type: "text", text: idPrompt },
              ...images.map(url => ({ type: "image_url", image_url: { url, detail: "high" } }))
            ],
          },
        ];

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            authorization: `Bearer ${OPENAI_API_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages,
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        });

        if (!resp.ok) {
          const errText = await resp.text();
          console.error("❌ [AI Skener] OpenAI API zlyhalo:", resp.status, errText);
          return json(res, 500, { ok: false, error: "OpenAI API error", details: errText });
        }

      const data = await resp.json();
      const resultText = data?.choices?.[0]?.message?.content ?? "{}";
      const result = JSON.parse(resultText);

      console.log("✅ [AI Skener] Analýza dokončená:", result.model, `(${result.condition}%)`);
      if (result.evidence) console.log("📝 [AI Dôkaz]:", result.evidence);
      
      return json(res, 200, { ok: true, result });
      } catch (err) {
        console.error("🔥 [AI Skener] Kritická chyba:", err);
        return json(res, 500, { ok: false, error: err.message });
      }
    }
  }

  // Market data endpoints (real, verifiable via URLs)
  if (pathname === "/api/market/sources" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    if (!q) return json(res, 400, { ok: false, error: "Missing query" });
    return json(res, 200, { ok: true, query: q, urls: buildSearchUrls(q) });
  }
  if (pathname === "/api/market/similar" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    if (!q) return json(res, 400, { ok: false, error: "Missing query" });
    const limit = clamp(safeNumber(url.searchParams.get("limit"), 50), 10, 100); // Changed: default 50, max 100
    const ads = await market.getSimilar({ query: q, limit });
    return json(res, 200, { ok: true, query: q, ads });
  }
  if (pathname === "/api/market/ingest" && req.method === "POST") {
    const body = await readBody(req);
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });
    const out = await market.ingest({ query: body.query, ads: body.ads });
    if (!out.ok) return json(res, 400, out);
    return json(res, 200, out);
  }

  // Best-effort real search (no deps). Currently supports Bazoš only.
  if (pathname === "/api/market/search" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    const source = String(url.searchParams.get("source") || "bazos").trim();
    const limit = clamp(safeNumber(url.searchParams.get("limit"), 70), 10, 100); // Changed: default 70 for stable pricing, max 100
    const useAI = String(url.searchParams.get("ai_filter") || "false").toLowerCase() === "true"; // Changed: AI filter OFF by default
    
    // 🆕 AUTO-DETECT CATEGORY if not provided or if 0
    let categoryId = safeNumber(url.searchParams.get("category"), 0);
    if (categoryId === 0 || !url.searchParams.has("category")) {
      categoryId = detectCategory(q);
      console.log(`🤖 Auto-detected category: ${categoryId} for query "${q}"`);
    }

  if (!q) return json(res, 400, { ok: false, error: "Missing query" });

    let ads = [];
    
    // 🆕 MULTI-SOURCE SCRAPING (Apple-level quality)
    if (source === "multi" || source === "all") {
      console.log(`🔍 Multi-source search: "${q}" (Bazoš only - Heureka disabled)`);
      
      // 🔧 SIMPLIFIED: Only Bazoš (Heureka has too much anti-bot protection)
      ads = await searchBazos(q, 100, categoryId, null);
      
      console.log(`✅ Multi-source: Bazoš ${ads.length}, Heureka 0 (disabled)`);
      
      console.log(`✅ Total unique ads: ${ads.length}`);
    } else if (source === "bazos") {
      ads = await searchBazos(q, 100, categoryId, null); // 🆕 Increased from limit to 100
    } else if (source === "heureka") {
      ads = await searchHeureka(q, limit);
    } else {
      return json(res, 400, { ok: false, error: `Unsupported source: ${source}` });
    }

    if (useAI && ads.length > 0) {
      console.log(`⚠️ AI filtering is enabled - this may remove valid ads!`);
      ads = await filterAdsWithAI(ads, q);
    }

    return json(res, 200, { 
      ok: true, 
      ads, 
      source, 
      query: q, 
      count: ads.length,
      // 🆕 ADD PRICE COMPARISON DATA
      priceComparison: ads.length > 0 ? {
        bazosAverage: Math.round(ads.reduce((sum, ad) => sum + (ad.price || 0), 0) / ads.length),
        bazosMedian: (() => {
          const prices = ads.map(a => a.price || 0).filter(p => p > 0).sort((a, b) => a - b);
          return prices[Math.floor(prices.length / 2)] || 0;
        })(),
        bazosMin: Math.min(...ads.map(a => a.price || 0).filter(p => p > 0)),
        bazosMax: Math.max(...ads.map(a => a.price || 0)),
        googleShoppingUrl: `https://www.google.com/search?q=${encodeURIComponent(q + " site:heureka.sk")}&tbm=shop`,
        heurekaUrl: `https://www.heureka.sk/?h[fraze]=${encodeURIComponent(q)}`
      } : null,
      // 🆕 QUALITY STATS
      qualityStats: ads.length > 0 ? {
        highQuality: ads.filter(a => (a.qualityScore || 0) >= 70).length,
        mediumQuality: ads.filter(a => (a.qualityScore || 0) >= 50 && (a.qualityScore || 0) < 70).length,
        lowQuality: ads.filter(a => (a.qualityScore || 0) < 50).length,
        averageScore: Math.round(ads.reduce((sum, ad) => sum + (ad.qualityScore || 0), 0) / ads.length)
      } : null
    });
  }

  // 🍎 APPLE-LEVEL RAW BAZOŠ SEARCH - NO FILTERS, PURE 1:1 RESULTS
  if (pathname === "/api/bazos-raw" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    const limit = clamp(safeNumber(url.searchParams.get("limit"), 50), 10, 100);
    
    if (!q) return json(res, 400, { ok: false, error: "Missing query" });
    
    console.log(`🍎 RAW Bazoš search: "${q}" (NO FILTERS)`);
    
    // 🍎 SMART QUERY PROCESSING: Extract base product for broader results
    // Example: "8 256 macbook" → search "macbook", but return specs for client-side filtering
    const extractedSpecs = {
      ram: null,
      ssd: null,
      year: null,
      originalQuery: q
    };
    
    // Extract RAM (8, 16, 32, 64)
    const ramMatch = q.match(/\b(8|16|32|64|128)(?:gb)?\b/i);
    if (ramMatch) extractedSpecs.ram = parseInt(ramMatch[1]);
    
    // Extract SSD (128, 256, 512, 1tb, 2tb)
    const ssdMatch = q.match(/\b(128|256|512|1024|2048|1|2|4)(?:gb|tb)?\b/i);
    if (ssdMatch) {
      let val = parseInt(ssdMatch[1]);
      // If it looks like TB (1, 2, 4), convert to GB
      if (val <= 4 && !ssdMatch[0].includes('gb')) val *= 1024;
      extractedSpecs.ssd = val;
    }
    
    // Extract year (2018-2025)
    const yearMatch = q.match(/\b(201[8-9]|202[0-5])\b/);
    if (yearMatch) extractedSpecs.year = parseInt(yearMatch[1]);
    
    // 🍎 CLEAN QUERY: Remove specs, keep only base product
    let cleanQuery = q
      .replace(/\b(8|16|32|64|128)(?:gb)?\b/gi, '') // Remove RAM
      .replace(/\b(128|256|512|1024|2048|1|2|4)(?:gb|tb)?\b/gi, '') // Remove SSD
      .replace(/\b(201[8-9]|202[0-5])\b/g, '') // Remove year
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
    
    // If query is now empty (was only specs), use original
    if (!cleanQuery || cleanQuery.length < 3) {
      cleanQuery = q;
    }
    
    // 🆕 SMART QUERY BRIDGE: Add quotes around specs for exact match
    // Example: "MacBook 16GB 256GB" → MacBook "16GB" "256GB"
    // 🔧 NORMALIZATION: Ensure specs have 'gb'/'tb' suffix
    let smartQuery = cleanQuery;
    if (extractedSpecs.ram || extractedSpecs.ssd) {
      const parts = [cleanQuery];
      
      // RAM normalization: 8 → "8gb", 16 → "16gb"
      if (extractedSpecs.ram) {
        const ramLabel = `${extractedSpecs.ram}gb`.toLowerCase();
        parts.push(`"${ramLabel}"`);
      }
      
      // SSD normalization: 256 → "256gb", 1024 → "1tb"
      if (extractedSpecs.ssd) {
        const ssdLabel = extractedSpecs.ssd >= 1024 
          ? `${extractedSpecs.ssd / 1024}tb` 
          : `${extractedSpecs.ssd}gb`;
        parts.push(`"${ssdLabel.toLowerCase()}"`);
      }
      
      smartQuery = parts.join(' ');
    }
    
    console.log(`🔍 Query transformation: "${q}" → "${cleanQuery}" → "${smartQuery}" (specs: ${JSON.stringify(extractedSpecs)})`);
    
    // Auto-detect category
    const categoryId = detectCategory(cleanQuery);
    
    try {
      // 🆕 TRY RSS FEED FIRST (faster & more reliable) - USE SMART QUERY
      console.log(`📡 Trying RSS feed with smart query: "${smartQuery}"`);
      let rssAds = await fetchBazosRssFeed(smartQuery, categoryId);
      
      // Deduplicate RSS results
      const seenUrls = new Set();
      const seenTitlePrice = new Set();
      const raw = [];
      
      for (const ad of rssAds) {
        const url = String(ad?.url || "").trim().toLowerCase();
        const title = String(ad?.title || "").trim();
        const price = Number(ad?.price || 0);
        
        if (!title || price <= 0) continue;
        
        const titlePriceKey = `${title}|${price}`;
        
        if (url && seenUrls.has(url)) continue;
        if (seenTitlePrice.has(titlePriceKey)) continue;
        
        if (url) seenUrls.add(url);
        seenTitlePrice.add(titlePriceKey);
        
        raw.push(ad);
      }
      
      console.log(`📊 RSS: ${raw.length} unique ads`);
      
      // 🆕 FALLBACK TO HTML if RSS has < 15 ads
      if (raw.length < 15) {
        console.log(`⚠️ RSS returned only ${raw.length} ads, falling back to HTML scraping...`);
        
        const subdomain = getBazosSubdomain(categoryId);
        
        // Fetch 3 pages (same as Bazoš default pagination) - USE SMART QUERY
        for (let p = 1; p <= 3; p++) {
          const html = await fetchBazosSearchHtmlRaw(smartQuery, p, categoryId);
          if (!html) continue;
          
          const pageAds = parseBazosAdsFromHtml(html, 200, subdomain);
          
          // Only deduplicate (same as Bazoš does)
          for (const ad of pageAds) {
            const url = String(ad?.url || "").trim().toLowerCase();
            const title = String(ad?.title || "").trim();
            const price = Number(ad?.price || 0);
            
            if (!title || price <= 0) continue;
            
            const titlePriceKey = `${title}|${price}`;
            
            if (url && seenUrls.has(url)) continue;
            if (seenTitlePrice.has(titlePriceKey)) continue;
            
            if (url) seenUrls.add(url);
            seenTitlePrice.add(titlePriceKey);
            
            raw.push(ad);
          }
          
          // Small delay between pages
          if (p < 3) await new Promise(resolve => setTimeout(resolve, 800));
        }
        
        console.log(`📊 HTML scraping added: ${raw.length} total ads`);
      }
      
      const source = rssAds.length >= 15 ? 'rss' : 'html';
      console.log(`✅ RAW Bazoš: ${raw.length} ads (source: ${source}, NO FILTERS)`);
      
      return json(res, 200, { 
        ok: true, 
        ads: raw.slice(0, limit),
        total: raw.length,
        query: q,
        cleanQuery,
        specs: extractedSpecs, // 🆕 Return specs for client-side filtering
        categoryId,
        filtered: false, // NO filtering applied
        source // 🆕 'rss' or 'html'
      });
    } catch (err) {
      console.error("❌ RAW Bazoš error:", err);
      return json(res, 500, { ok: false, error: err.message });
    }
  }

  // 🆕 UNIFIED MULTI-SOURCE SEARCH - Search ALL sources in parallel
  if (pathname === "/api/unified-search" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    const sourcesParam = String(url.searchParams.get("sources") || "bazos,google,heureka,modrykonik").trim();
    const limit = clamp(safeNumber(url.searchParams.get("limit"), 30), 10, 50);
    
    if (!q) return json(res, 400, { ok: false, error: "Missing query" });
    
    // Parse sources
    const requestedSources = sourcesParam.split(',').map(s => s.trim().toLowerCase());
    const enabledSources = {
      bazos: requestedSources.includes('bazos'),
      google: requestedSources.includes('google'),
      heureka: requestedSources.includes('heureka'),
      modrykonik: requestedSources.includes('modrykonik'),
      alza: requestedSources.includes('alza'),
      mall: requestedSources.includes('mall')
    };
    
    console.log(`🌍 Unified search: "${q}" from sources: ${Object.keys(enabledSources).filter(k => enabledSources[k]).join(', ')}`);
    
    // Auto-detect category for Bazoš
    const categoryId = detectCategory(q);
    
    try {
      // 🚀 PARALLEL SEARCH (all sources at once for speed)
      const searchPromises = [];
      
      if (enabledSources.bazos) {
        searchPromises.push(
          searchBazos(q, limit, categoryId, null)
            .then(ads => ({ source: 'bazos', ads }))
            .catch(err => { console.warn(`⚠️ Bazoš failed: ${err.message}`); return { source: 'bazos', ads: [] }; })
        );
      }
      
      if (enabledSources.google) {
        searchPromises.push(
          searchGoogleShopping(q, limit)
            .then(ads => ({ source: 'google', ads }))
            .catch(err => { console.warn(`⚠️ Google failed: ${err.message}`); return { source: 'google', ads: [] }; })
        );
      }
      
      if (enabledSources.heureka) {
        searchPromises.push(
          searchHeureka(q, limit)
            .then(ads => ({ source: 'heureka', ads }))
            .catch(err => { console.warn(`⚠️ Heureka failed: ${err.message}`); return { source: 'heureka', ads: [] }; })
        );
      }
      
      if (enabledSources.modrykonik) {
        searchPromises.push(
          searchModryKonik(q, limit)
            .then(ads => ({ source: 'modrykonik', ads }))
            .catch(err => { console.warn(`⚠️ Modrý Koník failed: ${err.message}`); return { source: 'modrykonik', ads: [] }; })
        );
      }
      
      if (enabledSources.alza) {
        searchPromises.push(
          searchAlza(q, limit)
            .then(ads => ({ source: 'alza', ads }))
            .catch(err => { console.warn(`⚠️ Alza failed: ${err.message}`); return { source: 'alza', ads: [] }; })
        );
      }
      
      if (enabledSources.mall) {
        searchPromises.push(
          searchMall(q, limit)
            .then(ads => ({ source: 'mall', ads }))
            .catch(err => { console.warn(`⚠️ Mall failed: ${err.message}`); return { source: 'mall', ads: [] }; })
        );
      }
      
      // Wait for all searches to complete
      const results = await Promise.all(searchPromises);
      
      // Merge all results
      let allAds = [];
      const sourceStats = {};
      
      for (const result of results) {
        sourceStats[result.source] = result.ads.length;
        allAds = allAds.concat(result.ads);
      }
      
      console.log(`📊 Source breakdown:`, sourceStats);
      
      // 🆕 CALCULATE RELEVANCE SCORE for each ad
      allAds = allAds.map(ad => {
        const relevanceScore = calculateRelevanceScore(ad, q);
        return { ...ad, relevanceScore };
      });
      
      // 🆕 SORT by relevance (highest first)
      allAds.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
      
      // 🆕 DEDUPLICATION: Remove duplicates by URL and title+price
      const seenUrls = new Set();
      const seenTitlePrice = new Set();
      const uniqueAds = [];
      
      for (const ad of allAds) {
        const url = String(ad.url || "").trim().toLowerCase();
        const title = String(ad.title || "").trim().toLowerCase();
        const price = Number(ad.price || 0);
        const key = `${title}|${price}`;
        
        if (url && seenUrls.has(url)) continue;
        if (seenTitlePrice.has(key)) continue;
        
        if (url) seenUrls.add(url);
        seenTitlePrice.add(key);
        uniqueAds.push(ad);
      }
      
      console.log(`✅ Total: ${allAds.length} ads → ${uniqueAds.length} unique (removed ${allAds.length - uniqueAds.length} duplicates)`);
      
      // Return top results
      const finalAds = uniqueAds.slice(0, limit);
      
      return json(res, 200, {
        ok: true,
        ads: finalAds,
        query: q,
        count: finalAds.length,
        sourceStats,
        averageRelevance: Math.round(finalAds.reduce((sum, ad) => sum + (ad.relevanceScore || 0), 0) / finalAds.length) || 0
      });
      
    } catch (err) {
      console.error("❌ Unified search failed:", err);
      return json(res, 500, { ok: false, error: "Unified search failed", details: err.message });
    }
  }

  // 🆕 GOOGLE SHOPPING API ENDPOINT
  if (pathname === "/api/google-shopping" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    const limit = clamp(safeNumber(url.searchParams.get("limit"), 10), 5, 30);
    
    if (!q) return json(res, 400, { ok: false, error: "Missing query" });
    
    try {
      const googleAds = await searchGoogleShopping(q, limit);
      return json(res, 200, { ok: true, ads: googleAds, source: 'google_shopping', query: q, count: googleAds.length });
    } catch (err) {
      console.error("❌ Google Shopping search failed:", err);
      return json(res, 500, { ok: false, error: "Google Shopping search failed", details: err.message });
    }
  }

  // Health check
  if (pathname === "/api/health") {
    return json(res, 200, { ok: true, status: "healthy", timestamp: Date.now() });
  }

  // Best-effort Heureka lookup (may be blocked). Returns a price range when possible.
  if (pathname === "/api/heureka/lookup" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "").trim();
    if (!q) return json(res, 400, { ok: false, error: "Missing query" });
    try {
      const hurl = `https://www.heureka.sk/?h%5Bfraze%5D=${encodeURIComponent(q)}`;
      const fetchOptions = {
        method: "GET",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          "accept-language": "sk-SK,sk;q=0.9,en;q=0.8",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "referer": "https://www.heureka.sk/"
        },
      };
      if (proxyDispatcher) {
        fetchOptions.dispatcher = proxyDispatcher;
      }
      const resp = await fetch(hurl, fetchOptions);
      const html = await resp.text();
      const parsed = parseHeurekaPricesFromHtml(html, q);
      if (parsed.blocked) {
        return json(res, 200, { ok: false, blocked: true, error: "Heureka blocked automated lookup." });
      }
      const best = parsed.prices[0] || null;
      if (!best) return json(res, 200, { ok: false, blocked: false, error: "No price found." });
      return json(res, 200, {
        ok: true,
        query: q,
        url: hurl,
        priceMin: Math.round(best.min),
        priceMax: best.max ? Math.round(best.max) : null,
        source: "heureka",
        verified: false,
      });
    } catch (e) {
      return json(res, 200, { ok: false, blocked: false, error: "Heureka lookup failed." });
    }
  }

  // Background removal now runs locally in browser (@imgly/background-removal)
  // No backend endpoint needed – keeping this comment for reference

  if (pathname === "/api/identify" && req.method === "POST") {
    const body = await readBody(req);
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });
    const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : "";
    if (!imageDataUrl.startsWith("data:image/")) {
      return json(res, 400, { ok: false, error: "Missing imageDataUrl" });
    }
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const identification = await identifyProductFromImage({
      imageDataUrl,
      model,
      apiKey: OPENAI_API_KEY,
    });
    return json(res, 200, { ok: true, identification });
  }

  if (pathname === "/api/identify" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed", allowed: ["POST"], method: req.method, path: pathname });
  }

  if (pathname === "/api/edit-ad" && req.method === "POST") {
    const body = await readBody(req);
    if (!body) {
      return json(res, 400, { ok: false, error: "Missing request body" });
    }
    
    const { currentAd, userRequest, productName, notes } = body;
    if (!currentAd || !userRequest) {
      return json(res, 400, { ok: false, error: "Missing currentAd or userRequest" });
    }
    
    // Edit the ad based on user's request
    const result = await editAdWithAI({
      currentAd,
      userRequest,
      productName: String(productName || ""),
      notes: String(notes || ""),
    });
    
    if (!result.ok) {
      return json(res, 500, { ok: false, error: result.error });
    }
    
    return json(res, 200, { ok: true, ...result });
  }

  if (pathname === "/api/edit-ad" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed", allowed: ["POST"], method: req.method, path: pathname });
  }

  // Beta signup endpoint
  if (pathname === "/api/beta-signup" && req.method === "POST") {
    const body = await readBody(req);
    if (!body || !body.email) {
      return json(res, 400, { ok: false, error: "Missing email" });
    }
    
    const email = String(body.email || "").trim();
    const productName = String(body.productName || "").trim();
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return json(res, 400, { ok: false, error: "Invalid email format" });
    }
    
    // Send email notification (silent)
    try {
      await sendBetaSignupEmail(email, productName);
    } catch (emailErr) {
      // Silent fail - don't block the whole request
    }
    
    // TODO: Save to database (e.g., SQLite, MongoDB, or append to beta-users.json file)
    
    return json(res, 200, { ok: true, message: "Beta signup recorded" });
  }

  // Refine search endpoint (AI retry based on feedback)
  if (pathname === "/api/refine-search" && req.method === "POST") {
    const body = await readBody(req);
    if (!body || !body.productName || !body.feedback) {
      return json(res, 400, { ok: false, error: "Missing productName or feedback" });
    }
    
    const productName = String(body.productName).trim();
    const feedback = String(body.feedback).trim();
    const removedTitles = Array.isArray(body.removedAds) ? body.removedAds : [];
    const categoryId = safeNumber(body.categoryId, 16);
    
    try {
      // Use AI to analyze feedback and generate refined search query
      const refinedQuery = await analyzeAndRefineQuery(productName, feedback, removedTitles);
      
      console.log(`🔄 Refining search: "${productName}" → "${refinedQuery}" (based on feedback)`);
      
      // Search with refined query
      const priceAnchor = await getPriceAnchor(refinedQuery, categoryId);
      let newAds = await searchBazos(refinedQuery, 100, categoryId, priceAnchor); // 🆕 Increased from 50 to 100
      
      // FALLBACK: If refined query returns 0 results, try original query (simpler)
      if (newAds.length === 0 && refinedQuery !== productName) {
        console.log(`⚠️ Refined query "${refinedQuery}" returned 0 results. Trying original: "${productName}"`);
        newAds = await searchBazos(productName, 100, categoryId, priceAnchor); // 🆕 Increased from 50 to 100
        
        // If still 0, try even broader search (category only)
        if (newAds.length === 0) {
          console.log(`⚠️ Original query "${productName}" returned 0 results. Trying broader category search...`);
          // Extract main keyword (first word) for very broad search
          const mainKeyword = productName.split(' ')[0];
          if (mainKeyword && mainKeyword.length > 2) {
            newAds = await searchBazos(mainKeyword, 100, categoryId, priceAnchor); // 🆕 Increased from 50 to 100
            console.log(`   Broad search for "${mainKeyword}" found ${newAds.length} results`);
          }
        }
      }
      
      if (newAds.length === 0) {
        console.warn(`❌ All search attempts failed for "${productName}" (category: ${categoryId})`);
        return json(res, 200, { ok: true, result: { newAds: [], refinedQuery, attemptedQueries: [refinedQuery, productName] } });
      }
      
      // Store in market database
      await market.ingest({ query: productName, ads: newAds });
      
      console.log(`✅ Refine search successful: ${newAds.length} ads found for "${refinedQuery}"`);
      
      return json(res, 200, { 
        ok: true, 
        result: { 
          newAds, 
          refinedQuery,
          count: newAds.length
        } 
      });
    } catch (err) {
      console.warn(`⚠️ Refine search failed:`, err);
      return json(res, 500, { ok: false, error: String(err?.message || err) });
    }
  }

  // Test search endpoint with verbose debugging
  if (pathname === "/api/test-search" && req.method === "GET") {
    const q = String(url.searchParams.get("query") || "MacBook").trim();
    const categoryId = safeNumber(url.searchParams.get("category"), 13);
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🧪 TEST SEARCH: "${q}" (category: ${categoryId})`);
    console.log("=".repeat(60));
    
    const priceAnchor = await getPriceAnchor(q, categoryId);
    console.log(`💰 Price anchor: ${priceAnchor}€`);
    
    const debugInfo = {
      query: q,
      categoryId,
      priceAnchor,
      steps: []
    };
    
    // Step 1: Raw fetch
    const html = await fetchBazosSearchHtml(q, 1, categoryId, priceAnchor);
    const htmlLength = html ? html.length : 0;
    const htmlPreview = html ? html.substring(0, 500) : "";
    
    // Build the search URL for debugging (matching fetchBazosSearchHtml logic)
    const testSubdomain = getBazosSubdomain(categoryId);
    const cenado = priceAnchor ? Math.round(priceAnchor * 1.5) : getCategoryPriceCap(categoryId);
    const catParam = testSubdomain === "www" && categoryId > 0 ? `&rubriky=${categoryId}` : "";
    const searchUrl = `https://${testSubdomain}.bazos.sk/search.php?hledat=${encodeURIComponent(q)}${catParam}&hlokalita=&humkreis=25&cenaod=&cenado=${cenado}&Submit=${encodeURIComponent("Hľadať")}`;
    
    // Check if HTML contains expected Bazoš structure
    const hasInzeratyNadpis = html ? html.includes('class="inzeratynadpis"') : false;
    const hasInzeratyCena = html ? html.includes('class="inzeratycena"') : false;
    const hasBotProtection = html ? (html.includes('cloudflare') || html.includes('checking your browser')) : false;
    
    const rawAds = parseBazosAdsFromHtml(html, 80, testSubdomain);
    debugInfo.steps.push({ 
      step: "1. Raw HTML parse", 
      count: rawAds.length,
      htmlLength,
      searchUrl,
      htmlPreview,
      hasInzeratyNadpis,
      hasInzeratyCena,
      hasBotProtection
    });
    console.log(`📄 Step 1 - Raw parse: ${rawAds.length} ads (HTML: ${htmlLength} chars, nadpis: ${hasInzeratyNadpis}, cena: ${hasInzeratyCena}, bot: ${hasBotProtection})`);
    
    // NO TEXT FILTERING - PURE MATH ONLY
    // All text-based filters removed as per requirements (accessory, blacklist, relevance)
    
    // Step 2: Price validation (only numeric check - NO TEXT FILTERING)
    const priceValidated = rawAds.filter((a) => {
      const price = Number(a?.price || 0);
      return price > 0;
    });
    debugInfo.steps.push({ step: "2. Price validation (pure math)", count: priceValidated.length, removed: rawAds.length - priceValidated.length });
    console.log(`💰 Step 2 - After price validation: ${priceValidated.length} ads (removed: ${rawAds.length - priceValidated.length})`);
    
    // NO OUTLIER REMOVAL - Let trimmed mean handle it
    const filtered = priceValidated;
    debugInfo.steps.push({ step: "3. No outlier removal (handled by trimmed mean)", count: filtered.length });
    console.log(`📊 Step 3 - Outlier removal skipped (trimmed mean will handle extremes)`);
    
    console.log(`\n✅ FINAL: ${filtered.length} ads`);
    console.log("=".repeat(60) + "\n");
    
    debugInfo.finalCount = filtered.length;
    debugInfo.sampleAds = filtered.slice(0, 5).map(a => ({ title: a.title, price: a.price, url: a.url }));
    
    return json(res, 200, { ok: true, debug: debugInfo });
  }

  // Reset rate limit (development only)
  if (pathname === "/api/reset-rate-limit" && req.method === "POST") {
    const clientIP = getClientIP(req);
    rateLimitStore.delete(clientIP);
    console.log(`🔓 Rate limit reset for IP: ${clientIP}`);
    return json(res, 200, { 
      ok: true, 
      message: "Rate limit reset successful",
      ip: clientIP 
    });
  }

  // Debug endpoint for MarketStore cache
  if (pathname === "/api/debug-market" && req.method === "GET") {
    const q = String(getQueryParam(url, "query") || "").trim();
    if (!q) {
      return json(res, 400, { ok: false, error: "Missing query parameter" });
    }
    
    const normalized = normalizeQuery(q);
    const db = await market._load();
    const cacheEntry = db.queries[normalized] || null;
    
    return json(res, 200, {
      ok: true,
      query: q,
      normalized,
      cached: cacheEntry ? {
        adsCount: cacheEntry.ads?.length || 0,
        ads: cacheEntry.ads || [],
        updatedAt: cacheEntry.updatedAt,
        age: Date.now() - (cacheEntry.updatedAt || 0),
      } : null,
      allQueries: Object.keys(db.queries),
    });
  }

  // Clear cache endpoint
  if (pathname === "/api/clear-cache" && req.method === "POST") {
    const body = await readBody(req);
    const q = body?.query;
    
    if (!q) {
      // Clear all cache
      await market._save({ queries: {}, updatedAt: Date.now() });
      return json(res, 200, { ok: true, message: "All cache cleared" });
    }
    
    // Clear specific query
    const normalized = normalizeQuery(q);
    const db = await market._load();
    delete db.queries[normalized];
    await market._save(db);
    
    return json(res, 200, { ok: true, message: `Cache cleared for: ${q}`, normalized });
  }

  // Review feedback endpoint (ads verification)
  if (pathname === "/api/review-feedback" && req.method === "POST") {
    const body = await readBody(req);
    if (!body) {
      return json(res, 400, { ok: false, error: "Invalid request body" });
    }
    
    const timestamp = new Date().toISOString();
    const feedbackData = {
      timestamp,
      query: String(body.query || "").trim(),
      categoryId: safeNumber(body.categoryId, 0),
      removedAds: Array.isArray(body.removedAds) ? body.removedAds : [],
      feedback: String(body.feedback || "").trim(),
    };
    
    // Log to file for weekly analysis (store in /tmp for Vercel or local directory)
    const isVercel = Boolean(process.env.VERCEL);
    const logDir = isVercel ? "/tmp" : "./data";
    const logFile = `${logDir}/review-feedback.jsonl`;
    
    try {
      if (!fsSync.existsSync(logDir)) {
        fsSync.mkdirSync(logDir, { recursive: true });
      }
      
      const logLine = JSON.stringify(feedbackData) + "\n";
      fsSync.appendFileSync(logFile, logLine, "utf8");
      
      console.log(`📝 Review feedback logged: ${feedbackData.removedAds.length} ads removed, query: "${feedbackData.query}"`);
    } catch (err) {
      console.warn(`⚠️ Failed to log review feedback:`, err);
    }
    
    // Send email notification if there's user feedback text
    if (feedbackData.feedback) {
      try {
        await sendReviewFeedbackEmail(feedbackData);
      } catch (emailErr) {
        console.warn(`⚠️ Failed to send review feedback email:`, emailErr);
      }
    }
    
    return json(res, 200, { ok: true, message: "Review feedback received" });
  }

  // Feedback endpoint (thumbs up/down)
  if (pathname === "/api/feedback" && req.method === "POST") {
    const body = await readBody(req);
    if (!body || !body.type) {
      return json(res, 400, { ok: false, error: "Missing feedback type" });
    }
    
    console.log("📝 Received feedback body:", JSON.stringify(body).substring(0, 200) + "...");

    // Prepare feedback entry
    const timestamp = new Date().toISOString();
    const feedbackEntry = {
      timestamp,
      type: body.type, // "positive" or "negative"
      productName: String(body.productName || "").trim(),
      adText: String(body.adText || "(Text inzerátu nebol načítaný)"), // Full text
      pricing: body.pricing || null,
      adsUsed: body.adsUsed || null,
      userEmail: String(body.userEmail || "").trim(), // User's email for reply-to
      feedbackMessage: String(body.feedbackMessage || "").trim(), // What was wrong (for negative)
    };
    
    // Send email notification (silent)
    try {
      await sendFeedbackEmail(feedbackEntry);
    } catch (emailErr) {
      console.error("❌ sendFeedbackEmail error:", emailErr);
    }
    
    return json(res, 200, { ok: true, message: "Feedback received" });
  }

  if (pathname === "/api/evaluate" && req.method === "POST") {
    try {
      // Rate limiting check - TEMPORARILY DISABLED for testing
      const clientIP = getClientIP(req);
      console.log(`✅ Evaluation request from IP: ${clientIP}`);
      
      const body = await readBody(req);
      if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

      // Pull stored market ads for this query
      const q = String(body.productName || "").trim();
      const mergedSimilarAds = Array.isArray(body.similarAds) ? body.similarAds : [];
      const storedAds = (mergedSimilarAds.length === 0 && q) 
        ? await market.getSimilar({ query: q, limit: 40 }) 
        : [];
      
      const combined = mergedSimilarAds.length > 0 ? mergedSimilarAds : storedAds;
      
      const input = {
        productName: String(body.productName || "Produkt").trim(),
        notes: String(body.notes || "").trim(),
        dealerText: String(body.dealerText || "").slice(0, 4000).trim(),
        dealerSource: String(body.dealerSource || "").slice(0, 600).trim(),
        usedPrice: safeNumber(body.usedPrice, 0),
        newPrice: safeNumber(body.newPrice, 0),
        isNewAvailable: Boolean(body.isNewAvailable),
        similarAds: combined,
        imageDataUrl: typeof body.imageDataUrl === "string" ? body.imageDataUrl : "",
        detectDefects: Boolean(body.detectDefects),
        categoryId: safeNumber(body.categoryId, 17), // 🔧 Default zmenený na 17 (Šport)
        adStyle: String(body.adStyle || "vtipny").trim(),
        step: safeNumber(body.step, 5),
        min: safeNumber(body.min, 200),
        max: safeNumber(body.max, 520),
        capPct: safeNumber(body.capPct, 0.78),
      };

      const out = await callOpenAI(input);
      if (!out.ok) {
        console.error("❌ OpenAI API Error:", out.error);
        return json(res, 500, { 
          ok: false, 
          error: "AI generovanie zlyhalo (OpenAI error)", 
          details: typeof out.error === 'string' ? out.error : JSON.stringify(out.error)
        });
      }

      // 📧 Send notification about generated ad
      const userEmail = String(body.userEmail || "").trim();
      const pricing = {
        recommended: out.recommended || 0,
        quick: out.quick || 0,
        premium: out.premium || 0
      };
      
      // ✅ VŽDY poslať mail po vygenerovaní (pre zbieranie info)
      sendAdGeneratedEmail(userEmail, out, input, pricing).catch(e => console.error("❌ Notification error:", e));

      return json(res, 200, out);
    } catch (err) {
      console.error("🔥 CRITICAL ERROR in /api/evaluate:", err);
      return json(res, 500, { 
        ok: false, 
        error: "Internal Server Error during evaluation", 
        details: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  }

  if (pathname === "/api/evaluate" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed", allowed: ["POST"], method: req.method, path: pathname });
  }

  if (pathname.startsWith("/api/")) {
    return json(res, 404, { ok: false, error: "Unknown API route" });
  }

  return serveStatic(req, res);
});

server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    // eslint-disable-next-line no-console
    console.error(
      `Port ${PORT} je už obsadený. Buď už beží predajto.ai backend, alebo iný proces.\n` +
        `Tip (Windows): netstat -ano | findstr :${PORT}  → zistíš PID, potom taskkill /PID <PID> /F\n` +
        `Alebo nastav v env.local PORT=${PORT + 1} a reštartni server.`
    );
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.error("Server error:", err);
  process.exit(1);
});

// Listen on all interfaces so the app is reachable from other devices on LAN (e.g. Live Server opened via 192.168.x.x).
// 🆕 BACKGROUND JOB: Periodic Market Price Update (Every 24h)
async function startMarketUpdateJob() {
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  
  if (!supabase) {
    console.log("⚠️ JOB: Supabase not connected. Market update job disabled.");
    return;
  }

  const runUpdate = async () => {
    console.log("⏰ JOB: Starting 24h market price update...");
    try {
      // 1. Fetch all unique models that need update
      const { data: models, error } = await supabase
        .from('market_prices')
        .select('model, storage, ram, color')
        .order('updated_at', { ascending: true }); // Process oldest first

      if (error) throw error;
      if (!models || models.length === 0) {
        console.log("⏰ JOB: No models found in database to update.");
        return;
      }

      console.log(`⏰ JOB: Updating ${models.length} models...`);

      for (const item of models) {
        let fullQuery = item.model;
        if (item.storage) fullQuery += ` ${item.storage}`;
        if (item.ram) fullQuery += ` ${item.ram} RAM`;
        if (item.color) fullQuery += ` ${item.color}`;

        console.log(`🕵️ JOB: Scraping "${fullQuery}"...`);
        try {
          const { stdout } = await execAsync(`node scripts/heureka-scraper.js "${fullQuery}"`);
          const match = stdout.match(/DATA_EXIT: priceFrom=([\d.]+) avgPrice=([\d.]+) source=(\w+) date="([^"]+)"/);
          
          if (match) {
            let priceFrom = parseFloat(match[1]);
            let priceAvg = parseFloat(match[2]);
            const source = match[3];
            const freshnessDate = match[4];

            // ⚖️ APPLY SAFETY CAPS before saving to DB (Sync with main API)
            priceAvg = getFairPriceBasis(item.model, priceAvg);
            priceFrom = Math.min(priceFrom, priceAvg * 0.95);

            await supabase
              .from('market_prices')
              .upsert({
                model: item.model,
                storage: item.storage,
                ram: item.ram,
                color: item.color,
                price_from: priceFrom,
                price_avg: priceAvg,
                source,
                freshness_date: freshnessDate,
                updated_at: new Date().toISOString()
              }, { onConflict: 'model,storage,ram,color' });

            // 📜 ARCHIVÁCIA: Uložiť záznam do histórie pre grafy
            await supabase
              .from('price_history')
              .insert({
                model: item.model,
                storage: item.storage,
                ram: item.ram,
                color: item.color,
                price_from: priceFrom,
                price_avg: priceAvg,
                source
              });
            
            console.log(`✅ JOB: Updated & Archived "${fullQuery}" -> ${priceAvg}€`);
          }
          // Sleep a bit between scrapes to avoid bans
          await new Promise(r => setTimeout(r, 5000));
        } catch (scrapeErr) {
          console.error(`❌ JOB: Failed to update "${fullQuery}":`, scrapeErr.message);
        }
      }
      console.log("✅ JOB: 24h market update finished.");
    } catch (err) {
      console.error("🔥 JOB: Critical error in market update job:", err.message);
    }
  };

  // Run immediately on start
  runUpdate();
  // Then every 24h
  setInterval(runUpdate, TWENTY_FOUR_HOURS);
}

// Start the job
startMarketUpdateJob();

server.listen(PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`predajto.ai dev server running on http://127.0.0.1:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`🚀 Auditlyio Server Running on port ${PORT}`);
  console.log(`Routes: 
    GET  /api/audit/report
    POST /api/audit/compare (Expert AI)
    POST /api/audit/identify-multi (AI Scanner)
    POST /api/audits (Save audit)
    ... and more`);
});

// Graceful shutdown for Railway/Vercel/Docker
process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, closing server gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});


