// Advanced pricing protection system
// Multi-layer filtering for accurate price estimation

// 1. NEGATIVE FILTERS - Blacklist words per category
export const CATEGORY_BLACKLISTS = {
  11: [ // Dom a záhrada
    "rodinný dom", "rod dom", "rekonštrukcia", "služby", "hodinový majster",
    "pozemok", "oprava", "servis", "výmena", "montáž", "stavba"
  ],
  13: [ // PC
    "rodinný dom", "rod dom", "rekonštrukcia", "služby", "hodinový majster",
    "pozemok", "oprava", "servis", "výmena", "prenájom", "kancelária"
  ],
  14: [ // Mobily
    "rodinný dom", "rod dom", "rekonštrukcia", "služby", "hodinový majster",
    "pozemok", "oprava", "servis", "výmena", "sim karta", "predplatné"
  ],
};

// 2. CATEGORY HARD LIMITS (max price caps)
export const CATEGORY_PRICE_CAPS = {
  13: 5000,  // PC max 5000€
  14: 2500,  // Mobily max 2500€
  15: 3000,  // Foto max 3000€
  16: 4000,  // Elektro max 4000€
  17: 2000,  // Šport max 2000€
  18: 3000,  // Hudba max 3000€
  19: 2000,  // Nábytok max 2000€
  20: 50,    // Dom (dekorácie, drobnosti) max 50€ (znížené z 150€)
  21: 4000,  // Stroje max 4000€
  22: 500,   // Oblečenie max 500€
  23: 200,   // Knihy max 200€
  24: 1000,  // Detské max 1000€
};

// 2b. PRODUCT-SPECIFIC SANITY CHECKS (based on keywords)
export const PRODUCT_SANITY_CHECKS = {
  // Dekorácie a drobnosti (max 50€)
  decorations: {
    keywords: ["dymový", "vodopad", "kadidlo", "vonná", "aromalampa", "sviečka", "lampáš", "dekorácia"],
    maxPrice: 50,
    reason: "Dekoračné predmety zvyčajne nepresahujú 50€"
  },
  // Príslušenstvo (max 30€)
  accessories: {
    keywords: ["kryt", "obal", "puzdro", "fólia", "sklo", "kábl", "nabíjačka", "adaptér"],
    maxPrice: 30,
    reason: "Príslušenstvo zvyčajne nepresahuje 30€"
  },
  // Knihy a médiá (max 20€)
  media: {
    keywords: ["kniha", "komiks", "cd", "dvd", "blu-ray"],
    maxPrice: 20,
    reason: "Knihy a médiá zvyčajne nepresahujú 20€"
  }
};

// Check if product matches sanity check criteria
export function checkProductSanity(productName, price) {
  const lowerName = String(productName || "").toLowerCase();
  
  for (const [checkName, check] of Object.entries(PRODUCT_SANITY_CHECKS)) {
    for (const keyword of check.keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        if (price > check.maxPrice) {
          return {
            failed: true,
            checkName,
            maxPrice: check.maxPrice,
            actualPrice: price,
            reason: check.reason,
            message: `Cena ${price}€ je príliš vysoká. ${check.reason}. Max očakávaná cena: ${check.maxPrice}€`
          };
        }
      }
    }
  }
  
  return { failed: false };
};

// 3. STATISTICAL FUNCTIONS

export function median(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 0;
  const sorted = [...arr].filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 
    ? (sorted[mid - 1] + sorted[mid]) / 2 
    : sorted[mid];
}

export function removeOutliers(prices, medianValue) {
  if (!medianValue || medianValue <= 0) return prices;
  
  return prices.filter(price => {
    // Remove prices under 5€
    if (price < 5) return false;
    
    // Remove prices over 200% of median
    if (price > medianValue * 2) return false;
    
    return true;
  });
}

// 4. BLACKLIST FILTERING

export function hasBlacklistedWords(title, categoryId) {
  const blacklist = CATEGORY_BLACKLISTS[categoryId];
  if (!blacklist || !Array.isArray(blacklist)) return false;
  
  const lowerTitle = String(title || "").toLowerCase();
  
  for (const word of blacklist) {
    if (lowerTitle.includes(word.toLowerCase())) {
      return true;
    }
  }
  
  return false;
}

export function filterAdsByBlacklist(ads, categoryId) {
  if (!categoryId || !CATEGORY_BLACKLISTS[categoryId]) {
    return ads; // No blacklist for this category
  }
  
  return ads.filter(ad => !hasBlacklistedWords(ad.title, categoryId));
}

// 5. CATEGORY PRICE CAP FILTERING

export function applyCategoryCap(ads, categoryId) {
  const cap = CATEGORY_PRICE_CAPS[categoryId];
  if (!cap) return ads; // No cap for this category
  
  return ads.filter(ad => {
    const price = Number(ad?.price || 0);
    return price > 0 && price <= cap;
  });
}

// 6. GOOGLE RETAIL ANCHOR (New price from market)

// Helper: Calculate similarity between two product names
function nameSimilarity(name1, name2) {
  const normalize = (s) => String(s || "").toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  
  const n1 = normalize(name1);
  const n2 = normalize(name2);
  
  if (n1 === n2) return 1.0; // Perfect match
  if (n1.includes(n2) || n2.includes(n1)) return 0.8; // Partial match
  
  // Count matching words
  const words1 = new Set(n1.split(/\s+/));
  const words2 = new Set(n2.split(/\s+/));
  const intersection = [...words1].filter(w => words2.has(w));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  return intersection.length / Math.max(words1.size, words2.size);
}

export async function getGoogleRetailPrice(productName) {
  // This would use SerpApi or Serper API
  // For now, return simulated data structure (to be implemented with API key)
  
  // PLACEHOLDER - will be replaced with real API call
  // const SERPER_API_KEY = process.env.SERPER_API_KEY;
  // if (!SERPER_API_KEY) return null;
  
  // const resp = await fetch("https://google.serper.dev/shopping", {
  //   method: "POST",
  //   headers: {
  //     "X-API-KEY": SERPER_API_KEY,
  //     "Content-Type": "application/json"
  //   },
  //   body: JSON.stringify({
  //     q: productName,
  //     location: "Slovakia",
  //     gl: "sk",
  //     hl: "sk",
  //     num: 20 // Get more results for better filtering
  //   })
  // });
  
  // const data = await resp.json();
  // const results = data?.shopping_results || [];
  // if (results.length === 0) return null;
  
  // // Score each result by name similarity
  // const scoredResults = results.map(r => {
  //   const price = parseFloat(String(r?.price || r?.extracted_price || "").replace(/[^\d.]/g, ""));
  //   const title = r?.title || "";
  //   const similarity = nameSimilarity(productName, title);
  //   
  //   // 5x weight for exact/close matches
  //   const weight = similarity > 0.8 ? 5 : 1;
  //   
  //   return {
  //     price,
  //     title,
  //     similarity,
  //     weight,
  //     source: r?.source || "unknown"
  //   };
  // }).filter(r => r.price > 0);
  
  // if (scoredResults.length === 0) return null;
  
  // // Sort by price
  // scoredResults.sort((a, b) => a.price - b.price);
  
  // const prices = scoredResults.map(r => r.price);
  // const minPrice = Math.min(...prices);
  // const maxPrice = Math.max(...prices);
  // const variance = maxPrice / minPrice;
  
  // // Check if variance is extreme (>300%)
  // if (variance > 3) {
  //   // Return categories for user selection
  //   const lowPrices = prices.filter(p => p <= minPrice * 1.5);
  //   const highPrices = prices.filter(p => p >= maxPrice * 0.7);
  //   const midPrices = prices.filter(p => p > minPrice * 1.5 && p < maxPrice * 0.7);
  //   
  //   return {
  //     extremeVariance: true,
  //     variance,
  //     categories: {
  //       low: {
  //         price: Math.round(median(lowPrices)),
  //         range: [Math.min(...lowPrices), Math.max(...lowPrices)],
  //         count: lowPrices.length,
  //         label: "Lacný variant / príslušenstvo"
  //       },
  //       mid: {
  //         price: Math.round(median(midPrices.length > 0 ? midPrices : prices)),
  //         range: midPrices.length > 0 ? [Math.min(...midPrices), Math.max(...midPrices)] : [minPrice, maxPrice],
  //         count: midPrices.length > 0 ? midPrices.length : prices.length,
  //         label: "Štandardná cena"
  //       },
  //       high: {
  //         price: Math.round(median(highPrices)),
  //         range: [Math.min(...highPrices), Math.max(...highPrices)],
  //         count: highPrices.length,
  //         label: "Prémiová verzia / komplet set"
  //       }
  //     },
  //     allResults: scoredResults.slice(0, 10) // Top 10 for reference
  //   };
  // }
  
  // // Normal case - calculate weighted median
  // // Apply weights by duplicating high-similarity results
  // const weightedPrices = [];
  // for (const result of scoredResults) {
  //   for (let i = 0; i < result.weight; i++) {
  //     weightedPrices.push(result.price);
  //   }
  // }
  
  // return {
  //   extremeVariance: false,
  //   price: Math.round(median(weightedPrices)),
  //   confidence: scoredResults[0].similarity > 0.8 ? 0.9 : 0.7,
  //   range: [minPrice, maxPrice],
  //   variance
  // };
  
  return null; // Placeholder - no API key configured
}

// 7. AI SANITY CHECK for Google price

export function isGooglePriceSane(googlePrice, productName, categoryId) {
  if (!googlePrice || googlePrice <= 0) return false;
  
  // Sanity check based on category
  const cap = CATEGORY_PRICE_CAPS[categoryId];
  if (cap && googlePrice > cap * 3) {
    // Google price is 3x higher than category cap = insane
    return false;
  }
  
  // Check for obvious errors (e.g., iPhone for 10,000€)
  if (categoryId === 14 && googlePrice > 5000) return false; // Mobiles
  if (categoryId === 13 && googlePrice > 10000) return false; // PC
  
  return true;
}

// 8. CROSS-CHECK LOGIC (Bazoš vs Google)

export function crossCheckPrices({ bazosMedian, googleData, categoryId }) {
  // Handle extreme variance case (Google returned categories)
  if (googleData && googleData.extremeVariance === true) {
    return {
      requiresUserSelection: true,
      priceCategories: googleData.categories,
      variance: googleData.variance,
      source: "google_categories",
      confidence: 0.0, // User must select
      message: "Našli sme rôzne cenové hladiny. Ktorá najlepšie zodpovedá vášmu produktu?"
    };
  }
  
  // Normal case - single Google price
  const googlePrice = googleData?.price || null;
  
  // If no Bazoš data
  if (!bazosMedian || bazosMedian <= 0) {
    if (googlePrice && googlePrice > 0) {
      // Use 70% of Google price as bazaar estimate
      return {
        finalPrice: Math.round(googlePrice * 0.7),
        source: "google_estimate",
        confidence: googleData?.confidence || 0.6
      };
    }
    return null;
  }
  
  // If no Google data
  if (!googlePrice || googlePrice <= 0) {
    return {
      finalPrice: Math.round(bazosMedian),
      source: "bazos_median",
      confidence: 0.8
    };
  }
  
  // Both available - cross-check
  if (bazosMedian > googlePrice * 1.2) {
    // Bazoš median is 20%+ higher than new price = suspicious
    // (probably found houses instead of products)
    return {
      finalPrice: Math.round(googlePrice * 0.7),
      source: "google_corrected",
      confidence: 0.7,
      warning: "Bazoš data suspicious (higher than new price)"
    };
  }
  
  // Bazoš data looks reasonable
  return {
    finalPrice: Math.round(bazosMedian),
    source: "bazos_verified",
    confidence: 0.9
  };
}

// 9. COMPLETE PRICING PIPELINE

export async function calculateProtectedPrice({
  productName,
  categoryId,
  bazosAds,
  condition = 90
}) {
  const result = {
    ok: true,
    price: 0,
    priceRange: { min: 0, median: 0, max: 0 },
    source: "unknown",
    confidence: 0,
    adsUsed: 0,
    adsRemoved: 0,
    warnings: [],
    fallback: false
  };
  
  // Step 1: Filter by blacklist
  let filteredAds = filterAdsByBlacklist(bazosAds, categoryId);
  const blacklistRemoved = bazosAds.length - filteredAds.length;
  if (blacklistRemoved > 0) {
    result.warnings.push(`Removed ${blacklistRemoved} blacklisted ads`);
  }
  
  // Step 2: Apply category cap
  filteredAds = applyCategoryCap(filteredAds, categoryId);
  const capRemoved = (bazosAds.length - blacklistRemoved) - filteredAds.length;
  if (capRemoved > 0) {
    result.warnings.push(`Removed ${capRemoved} ads above category cap`);
  }
  
  // Step 3: Extract prices
  const allPrices = filteredAds.map(ad => Number(ad?.price || 0)).filter(p => p > 0);
  
  // Step 3.5: Check for extreme variance (Bazoš data)
  if (allPrices.length >= 5) {
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const variance = maxPrice / minPrice;
    
    // If variance > 5x, something is very wrong (mixed products)
    if (variance > 5) {
      console.warn(`⚠️ Extreme variance in Bazoš data: ${variance.toFixed(1)}x (${minPrice}€ - ${maxPrice}€)`);
      result.warnings.push(`Extrémny rozptyl cien na Bazoši (${minPrice}€ - ${maxPrice}€). Skúste spresniť názov produktu.`);
      
      // Show user selection UI
      const lowPrices = allPrices.filter(p => p <= minPrice * 2);
      const highPrices = allPrices.filter(p => p >= maxPrice * 0.5);
      const midPrices = allPrices.filter(p => p > minPrice * 2 && p < maxPrice * 0.5);
      
      result.requiresUserSelection = true;
      result.variance = variance;
      result.message = "Našli sme príliš veľa rôznych výsledkov. Ide o kompletný set alebo len o samostatný kus? Upresnite, prosím.";
      result.priceCategories = {
        low: {
          price: Math.round(median(lowPrices.length > 0 ? lowPrices : [minPrice])),
          range: lowPrices.length > 0 ? [Math.min(...lowPrices), Math.max(...lowPrices)] : [minPrice, minPrice * 2],
          count: lowPrices.length,
          label: "Samostatný kus / príslušenstvo"
        },
        mid: {
          price: Math.round(median(midPrices.length > 0 ? midPrices : allPrices)),
          range: midPrices.length > 0 ? [Math.min(...midPrices), Math.max(...midPrices)] : [minPrice, maxPrice],
          count: midPrices.length > 0 ? midPrices.length : allPrices.length,
          label: "Štandardná cena"
        },
        high: {
          price: Math.round(median(highPrices.length > 0 ? highPrices : [maxPrice])),
          range: highPrices.length > 0 ? [Math.min(...highPrices), Math.max(...highPrices)] : [maxPrice * 0.5, maxPrice],
          count: highPrices.length,
          label: "Kompletný set / prémiová verzia"
        }
      };
      result.source = "bazos_extreme_variance";
      result.confidence = 0;
      return result;
    }
  }
  
  // Step 4: Calculate median
  const rawMedian = median(allPrices);
  
  // Step 5: Remove outliers
  const cleanPrices = removeOutliers(allPrices, rawMedian);
  const outliersRemoved = allPrices.length - cleanPrices.length;
  if (outliersRemoved > 0) {
    result.warnings.push(`Removed ${outliersRemoved} outliers`);
  }
  
  // Step 6: Final median
  const finalMedian = median(cleanPrices);
  
  result.adsUsed = cleanPrices.length;
  result.adsRemoved = bazosAds.length - cleanPrices.length;
  
  // Step 7: Get Google retail price (if available)
  const googleData = await getGoogleRetailPrice(productName);
  
  // Step 8: AI Sanity check on Google price (only for single price, not categories)
  let finalGoogleData = googleData;
  if (googleData && !googleData.extremeVariance) {
    const googleSane = isGooglePriceSane(googleData.price, productName, categoryId);
    if (!googleSane) {
      result.warnings.push("Google price rejected (sanity check failed)");
      finalGoogleData = null;
    }
  }
  
  // Step 9: Cross-check
  const crossCheck = crossCheckPrices({
    bazosMedian: finalMedian,
    googleData: finalGoogleData,
    categoryId
  });
  
  // Step 10: Fallback if no data
  if (!crossCheck) {
    result.fallback = true;
    result.warnings.push("Nedostatok overených dát z bazárov, cena odhadnutá podľa trhovej ceny nového kusu.");
    result.price = 0;
    result.confidence = 0;
    result.source = "insufficient_data";
    return result;
  }
  
  // Step 11: Check if user selection is required
  if (crossCheck.requiresUserSelection) {
    result.requiresUserSelection = true;
    result.priceCategories = crossCheck.priceCategories;
    result.variance = crossCheck.variance;
    result.message = crossCheck.message;
    result.source = "google_categories";
    result.confidence = 0;
    result.price = 0; // Will be set after user selects
    return result;
  }
  
  // Step 12: Adjust for condition
  let adjustedPrice = crossCheck.finalPrice;
  if (condition < 100) {
    adjustedPrice = Math.round(adjustedPrice * (condition / 100));
  }
  
  // Step 13: SANITY CHECK - Product-specific price validation
  const sanityCheck = checkProductSanity(productName, adjustedPrice);
  if (sanityCheck.failed) {
    console.warn(`⚠️ SANITY CHECK FAILED: ${sanityCheck.message}`);
    result.warnings.push(sanityCheck.message);
    
    // Force price to max allowed
    adjustedPrice = sanityCheck.maxPrice;
    result.sanityCapped = true;
    result.confidence = Math.max(0.3, result.confidence - 0.3); // Lower confidence
  }
  
  // Step 14: Check minimum ads requirement
  const minAdsRequired = [13, 14, 15, 16].includes(categoryId) ? 1 : 2; // Very low requirement for electronics (was 2/3)
  
  if (result.adsUsed < minAdsRequired) {
    console.warn(`⚠️ Too few ads used: ${result.adsUsed}/${minAdsRequired} - insufficient data`);
    
    // INSUFFICIENT DATA - Do not show price
    result.insufficientData = true;
    result.fallback = true;
    result.price = 0; // No price
    result.confidence = 0;
    result.source = "insufficient_data";
    result.message = `Nedostatok dát na určenie ceny. Našli sme len ${result.adsUsed} relevantných inzerátov (potrebujeme aspoň ${minAdsRequired}). Skúste zadať presnejší názov produktu (napr. "MacBook Air M2 2023" namiesto len "MacBook").`;
    result.warnings.push(result.message);
    
    return result;
  }
  
  // Step 15: Calculate range
  const minPrice = Math.round(adjustedPrice * 0.85);
  const maxPrice = Math.round(adjustedPrice * 1.15);
  
  result.price = adjustedPrice;
  result.priceRange = {
    min: minPrice,
    median: adjustedPrice,
    max: maxPrice
  };
  result.source = crossCheck.source;
  result.confidence = crossCheck.confidence;
  
  if (crossCheck.warning) {
    result.warnings.push(crossCheck.warning);
  }
  
  return result;
}


