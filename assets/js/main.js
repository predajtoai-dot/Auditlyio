document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Systém Auditlyio inicializovaný (Verzia 165)");
  const qs = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

  // 🔗 SUPABASE INITIALIZATION
  const supabaseUrl = "https://dbbhvaokhdrgawohappo.supabase.co";
  const supabaseKey = "sb_publishable_myBjYbRfS0G9VWj-a5mvaA_kPizADYd"; // Use anon/public key for client
  const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

  if (supabase) {
    console.log("✅ Supabase Auth prepojené.");
  } else {
    console.error("❌ Supabase knižnica nenájdená.");
  }

  // Backend base URL (keep in one place so fetch + error messages never diverge)
  // - In production (HTTPS), use relative URLs (same origin)
  // - In development (localhost), use http://localhost:5510
  // - You can override by setting window.PREDAJTO_API_BASE in DevTools if needed.
  const API_PORT = 5510;
  const API_HOSTS = (() => {
    const override = typeof window !== "undefined" ? window.PREDAJTO_API_BASE : "";
    if (override) return [String(override).replace(/\/+$/, "")];
    
    // Development detection (localhost/127.0.0.1/local IP)
    const isDevelopment = 
      window.location.hostname === "localhost" || 
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.startsWith("192.168.") ||
      window.location.hostname.startsWith("10.") ||
      window.location.hostname.includes(".local");
    
    // Production: Use relative URLs (Railway, Vercel, custom domain)
    if (!isDevelopment) {
      return [""]; // Relative URLs: /api/health, /api/evaluate, etc.
    }
    
    // Development: Use localhost with port
    const hosts = [window.location.hostname, "127.0.0.1", "localhost"]
      .map((h) => String(h || "").trim())
      .filter(Boolean);
    return Array.from(new Set(hosts)).map((h) => `http://${h}:${API_PORT}`);
  })();

  const API_BASE = API_HOSTS[0];

  /**
   * 📱 DEVICE CATALOG: Technical specifications for expert audits
   */
  const DEVICE_CATALOG = {
    "iphone 17": { cpu: "A19 (3nm)", display: "6.1\" OLED (120Hz LTPO, 2000 nits)", ram: "8 GB", camera: "48MP + AF UltraWide", charging: "USB-C (30W)", material: "Hliník + Matné sklo", battery_cap: "4000 mAh", charging_time: "55 min na 100%", battery_life: "24 hodín videa" },
    "iphone 16 pro max": { cpu: "A18 Pro (3nm)", display: "6.9\" OLED (120Hz, 2000 nits peak)", ram: "8 GB", camera: "48MP Main + 5x Opt. Zoom", charging: "USB-C (USB 3.0, 27W)", material: "Titán Grade 5", battery_cap: "4676 mAh", charging_time: "65 min na 100%", battery_life: "33 hodín videa" },
    "iphone 16 pro": { cpu: "A18 Pro (3nm)", display: "6.3\" OLED (120Hz, 2000 nits peak)", ram: "8 GB", camera: "48MP Main + 5x Opt. Zoom", charging: "USB-C (USB 3.0, 27W)", material: "Titán Grade 5", battery_cap: "3582 mAh", charging_time: "60 min na 100%", battery_life: "27 hodín videa" },
    "iphone 16": { cpu: "A18 (3nm)", display: "6.1\" OLED (60Hz, 2000 nits peak)", ram: "8 GB", camera: "48MP Dual System", charging: "USB-C (USB 2.0, 25W)", material: "Hliník + Matné sklo", battery_cap: "3561 mAh", charging_time: "60 min na 100%", battery_life: "22 hodín videa" },
    "iphone 15 pro max": { cpu: "A17 Pro (3nm)", display: "6.7\" OLED (120Hz, 1000 nit / 2000 nit peak)", ram: "8 GB", camera: "48MP Main + 5x Opt. Zoom", charging: "USB-C (USB 3.0, 27W)", material: "Titán Grade 5", battery_cap: "4441 mAh", charging_time: "70 min na 100%", battery_life: "29 hodín videa" },
    "iphone 15 pro": { cpu: "A17 Pro (3nm)", display: "6.1\" OLED (120Hz, 1000 nit / 2000 nit peak)", ram: "8 GB", camera: "48MP Main + 3x Opt. Zoom", charging: "USB-C (USB 3.0, 27W)", material: "Titán Grade 5", battery_cap: "3274 mAh", charging_time: "65 min na 100%", battery_life: "23 hodín videa" },
    "iphone 15 plus": { cpu: "A16 Bionic", display: "6.7\" OLED (60Hz, 1000 nit / 2000 nit peak)", ram: "6 GB", camera: "48MP Dual System", charging: "USB-C (USB 2.0, 20W)", material: "Hliník + Matné sklo", battery_cap: "4383 mAh", charging_time: "80 min na 100%", battery_life: "26 hodín videa" },
    "iphone 15": { cpu: "A16 Bionic", display: "6.1\" OLED (60Hz, 1000 nit / 2000 nit peak)", ram: "6 GB", camera: "48MP Dual System", charging: "USB-C (USB 2.0, 20W)", material: "Hliník + Matné sklo", battery_cap: "3349 mAh", charging_time: "75 min na 100%", battery_life: "20 hodín videa" },
    "iphone 14 pro max": { cpu: "A16 Bionic", display: "6.7\" OLED (120Hz, 2000 nits)", ram: "6 GB", camera: "48MP Main + 3x Opt. Zoom", charging: "Lightning (20W)", material: "Oceľ", battery_cap: "4323 mAh", charging_time: "90 min na 100%", battery_life: "29 hodín videa" },
    "iphone 14 pro": { cpu: "A16 Bionic", display: "6.1\" OLED (120Hz, 2000 nits)", ram: "6 GB", camera: "48MP Main + 3x Opt. Zoom", charging: "Lightning (20W)", material: "Oceľ", battery_cap: "3200 mAh", charging_time: "85 min na 100%", battery_life: "23 hodín videa" },
    "iphone 14 plus": { cpu: "A15 Bionic (5-core GPU)", display: "6.7\" OLED (60Hz, 1200 nits)", ram: "6 GB", camera: "12MP Dual System", charging: "Lightning (20W)", material: "Hliník", battery_cap: "4325 mAh", charging_time: "90 min na 100%", battery_life: "26 hodín videa" },
    "iphone 14": { cpu: "A15 Bionic (5-core GPU)", display: "6.1\" OLED (60Hz, 1200 nits)", ram: "6 GB", camera: "12MP Dual System", charging: "Lightning (20W)", material: "Hliník", battery_cap: "3279 mAh", charging_time: "80 min na 100%", battery_life: "20 hodín videa" },
    "iphone 13 pro max": { cpu: "A15 Bionic", display: "6.7\" OLED (120Hz, 1200 nits)", ram: "6 GB", camera: "12MP Main + 3x Opt. Zoom", charging: "Lightning (20W)", material: "Oceľ", battery_cap: "4352 mAh", charging_time: "100 min na 100%", battery_life: "28 hodín videa" },
    "iphone 13 pro": { cpu: "A15 Bionic", display: "6.1\" OLED (120Hz, 1200 nits)", ram: "6 GB", camera: "12MP Main + 3x Opt. Zoom", charging: "Lightning (20W)", material: "Oceľ", battery_cap: "3095 mAh", charging_time: "90 min na 100%", battery_life: "22 hodín videa" },
    "iphone 13": { cpu: "A15 Bionic", display: "6.1\" OLED (60Hz, 800 nits)", ram: "4 GB", camera: "12MP Dual System", charging: "Lightning (20W)", material: "Hliník", battery_cap: "3227 mAh", charging_time: "85 min na 100%", battery_life: "19 hodín videa" },
    "iphone 12 pro max": { cpu: "A14 Bionic", display: "6.7\" OLED (60Hz, 800 nits)", ram: "6 GB", camera: "12MP + 2.5x Opt. Zoom", charging: "Lightning (20W)", material: "Oceľ", battery_cap: "3687 mAh", charging_time: "95 min na 100%", battery_life: "20 hodín videa" },
    "iphone 12 pro": { cpu: "A14 Bionic", display: "6.1\" OLED (60Hz, 800 nits)", ram: "6 GB", camera: "12MP + 2x Opt. Zoom", charging: "Lightning (20W)", material: "Oceľ", battery_cap: "2815 mAh", charging_time: "90 min na 100%", battery_life: "17 hodín videa" },
    "iphone 12": { cpu: "A14 Bionic", display: "6.1\" OLED (60Hz, 625 nits)", ram: "4 GB", camera: "12MP Dual System", charging: "Lightning (20W)", material: "Hliník", battery_cap: "2815 mAh", charging_time: "90 min na 100%", battery_life: "17 hodín videa" },
    "ps5": { cpu: "AMD Ryzen Zen 2", display: "HDMI 2.1 (4K/120Hz)", ram: "16 GB GDDR6", camera: "N/A", charging: "AC Power", material: "Plast", battery_cap: "N/A", charging_time: "N/A", battery_life: "N/A" },
    "ps5 slim": { cpu: "AMD Ryzen Zen 2", display: "HDMI 2.1 (4K/120Hz)", ram: "16 GB GDDR6", camera: "N/A", charging: "AC Power", material: "Plast", battery_cap: "N/A", charging_time: "N/A", battery_life: "N/A" },
    "xbox series x": { cpu: "Custom Zen 2", display: "4K/120Hz", ram: "16 GB GDDR6", camera: "N/A", charging: "AC Power", material: "Plast", battery_cap: "N/A", charging_time: "N/A", battery_life: "N/A" },
    "macbook air m2": { cpu: "Apple M2 (8-core)", display: "13.6\" Liquid Retina (500 nits)", ram: "8/16/24 GB", camera: "1080p FaceTime HD", charging: "MagSafe 3 / USB-C", material: "Hliník", battery_cap: "52.6 Wh", charging_time: "90 min na 100%", battery_life: "18 hodín videa" },
    "macbook pro m3": { cpu: "Apple M3 (8-core)", display: "14.2\" Liquid Retina XDR (1600 nits)", ram: "8/16/24 GB", camera: "1080p FaceTime HD", charging: "MagSafe 3 / USB-C", material: "Hliník", battery_cap: "70 Wh", charging_time: "80 min na 100%", battery_life: "22 hodín videa" },
    "razer blade 16": { cpu: "Intel Core i9-14900HX", display: "16\" Dual UHD+ Mini-LED (120Hz/240Hz)", ram: "32 GB DDR5", camera: "1080p Windows Hello", charging: "330W GaN Adapter", material: "Hliník (CNC)", battery_cap: "95.2 Wh", charging_time: "90 min na 100%", battery_life: "5-6 hodín" },
    "razer blade 14": { cpu: "AMD Ryzen 9 8945HS", display: "14\" QHD+ (240Hz)", ram: "16/32 GB DDR5", camera: "1080p", charging: "230W", material: "Hliník (CNC)", battery_cap: "68.1 Wh", charging_time: "80 min na 100%", battery_life: "6-8 hodín" },
    "razer blade": { cpu: "Intel Core i7/i9 (High-end)", display: "QHD+ / UHD+ (144Hz+)", ram: "16/32 GB DDR5", camera: "1080p HD", charging: "Power Adapter", material: "Hliník (CNC)", battery_cap: "80+ Wh", charging_time: "90 min", battery_life: "6 hodín" },
    "notebook": { cpu: "Moderný mobilný procesor (Intel/AMD)", display: "Full HD / QHD IPS panel", ram: "8 / 16 / 32 GB", camera: "720p / 1080p HD", charging: "USB-C PD / DC Adapter", material: "Hliník / ABS Plast", battery_cap: "50-99 Wh", charging_time: "120 min", battery_life: "6-10 hodín" },
    "laptop": { cpu: "Moderný mobilný čipset", display: "Full HD / QHD IPS panel", ram: "8 / 16 GB", camera: "720p / 1080p", charging: "USB-C PD / DC Adapter", material: "Hliník / ABS Plast", battery_cap: "50-80 Wh", charging_time: "120 min", battery_life: "6-10 hodín" },
    "lenovo legion 5": { cpu: "AMD Ryzen 7 / Intel i7", display: "15.6\" WQHD (165Hz)", ram: "16 GB DDR5", camera: "720p with Shutter", charging: "230W / 300W", material: "Plast / Hliník", battery_cap: "80 Wh", charging_time: "60 min (Rapid Charge)", battery_life: "5 hodín" },
    "asus rog zephyrus g14": { cpu: "AMD Ryzen 9", display: "14\" Nebula HDR (120Hz)", ram: "16/32 GB", camera: "1080p IR", charging: "USB-C / DC", material: "Horčík / Hliník", battery_cap: "76 Wh", charging_time: "90 min", battery_life: "8-10 hodín" },
    "dell xps 13": { cpu: "Intel Core Ultra 7", display: "13.4\" InfinityEdge touch", ram: "16 GB LPDDR5x", camera: "1080p", charging: "USB-C (60W)", material: "Hliník / Karbón", battery_cap: "55 Wh", charging_time: "100 min", battery_life: "12 hodín" },
    "ipad pro 12.9 m2": { cpu: "Apple M2", display: "12.9\" Mini-LED (1600 nits)", ram: "8/16 GB", camera: "12MP Wide + 10MP UW + LiDAR", charging: "USB-C (Thunderbolt)", material: "Hliník", battery_cap: "10758 mAh", charging_time: "150 min na 100%", battery_life: "10 hodín webu" },
    "apple watch ultra 2": { cpu: "S9 SiP", display: "LTPO OLED (3000 nits)", ram: "N/A", camera: "N/A", charging: "Rýchle bezdrôtové", material: "Titán", battery_cap: "564 mAh", charging_time: "90 min na 100%", battery_life: "36-72 hodín" },
    "airpods pro (2nd gen)": { cpu: "H2 Chip", display: "N/A", ram: "N/A", camera: "N/A", charging: "MagSafe / USB-C", material: "Plast", battery_cap: "49.7 mAh", charging_time: "60 min na 100%", battery_life: "6 hodín" }
  };

  // Helper to find best match in catalog
  const findDeviceInCatalog = (name) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    // Try exact match first
    if (DEVICE_CATALOG[lower]) return DEVICE_CATALOG[lower];
    // Try to find if any key is contained in the name (e.g. "iPhone 14 Plus" contains "iphone 14 plus")
    const keys = Object.keys(DEVICE_CATALOG).sort((a, b) => b.length - a.length); // Longest first
    for (const key of keys) {
      if (lower.includes(key)) return DEVICE_CATALOG[key];
    }
    // Deep search: check if name contains key or key contains name
    for (const key of keys) {
      if (key.includes(lower)) return DEVICE_CATALOG[key];
    }
    
    // 🆕 FALLBACK: If notebook and still nothing, return generic notebook specs
    if (lower.includes("notebook") || lower.includes("laptop") || lower.includes("macbook") || lower.includes("blade") || lower.includes("legion")) {
      return DEVICE_CATALOG["notebook"];
    }
    
    return null;
  };

  // ⚖️ CENTRAL PRICING ENGINE: Ensures consistent fair prices across all components
  const getFairPriceBasis = (modelName, dbPrice = 0, heurekaPrice = 0) => {
    const nameLower = modelName.toLowerCase();
    let finalPrice = Number(dbPrice || 0);

    // 1. Safety Overrides: Hard caps for common older models to avoid Heureka "new/refurbished" pricing
    // These take priority over DB if the DB price is suspiciously high or if we want to enforce a specific price
    if (nameLower.includes("iphone 17 pro max")) return 1150;
    if (nameLower.includes("iphone 17 pro")) return 1050;
    if (nameLower.includes("iphone 17")) return 920;

    if (nameLower.includes("iphone 16 pro max")) return 1020;
    if (nameLower.includes("iphone 16 pro")) return 890;
    if (nameLower.includes("iphone 16")) return 690;

    if (nameLower.includes("iphone 15 pro max")) return 650;
    if (nameLower.includes("iphone 15 pro")) return 580;
    if (nameLower.includes("iphone 15 plus")) return 480;
    if (nameLower.includes("iphone 15")) return 440;

    if (nameLower.includes("iphone 14 pro max")) return 480;
    if (nameLower.includes("iphone 14 pro")) return 400;
    if (nameLower.includes("iphone 14 plus")) return 350;
    if (nameLower.includes("iphone 14")) return 320;

    if (nameLower.includes("iphone 13 pro max")) return 390;
    if (nameLower.includes("iphone 13 pro")) return 350;
    if (nameLower.includes("iphone 13 mini")) return 240;
    if (nameLower.includes("iphone 13")) return 290;

    if (nameLower.includes("iphone 12 pro max")) return 290;
    if (nameLower.includes("iphone 12 pro")) return 260;
    if (nameLower.includes("iphone 12 mini")) return 170;
    if (nameLower.includes("iphone 12")) return 210;
    if (nameLower.includes("iphone 11 pro max")) return 220;
    if (nameLower.includes("iphone 11 pro")) return 190;
    if (nameLower.includes("iphone 11")) return 160;

    // 🎧 Audio
    if (nameLower.includes("airpods pro 2")) return 170;
    if (nameLower.includes("airpods pro")) return 120;
    if (nameLower.includes("airpods max")) return 320;
    if (nameLower.includes("airpods 3")) return 90;
    if (nameLower.includes("airpods 2")) return 50;
    if (nameLower.includes("airpods 1")) return 25;
    if (nameLower.includes("airpods")) return 80;

    // 🎮 Consoles
    if (nameLower.includes("ps5 slim") || nameLower.includes("playstation 5 slim")) return 380;
    if (nameLower.includes("ps5 pro") || nameLower.includes("playstation 5 pro")) return 650;
    if (nameLower.includes("ps5") || nameLower.includes("playstation 5")) return 340;
    if (nameLower.includes("xbox series x")) return 320;
    if (nameLower.includes("xbox series s")) return 180;
    if (nameLower.includes("nintendo switch oled")) return 220;
    if (nameLower.includes("nintendo switch")) return 160;
    
    // 2. Priority: Valid database price (if not overridden above)
    if (finalPrice > 0 && finalPrice < 1500) return finalPrice;

    // 3. Fallback: Heureka price (if reasonable)
    if (heurekaPrice > 0 && heurekaPrice < 1500) return heurekaPrice;
    if (window.heurekaData?.priceAvg > 0 && window.heurekaData?.priceAvg < 1500) return window.heurekaData.priceAvg;

    // 4. Ultimate fallback (absolute minimum for any electronic device we audit)
    return 100; 
  };

  // Edit counter constants (used in multiple places)
  const FREE_EDITS_LIMIT = 3;
  const STORAGE_KEY_EDITS = "predajto_edit_count";
  const STORAGE_KEY_PREMIUM = "predajto_premium";
  const STORAGE_KEY_TEST_PAID = "auditly_test_paid";

  let isTestPaid = localStorage.getItem(STORAGE_KEY_TEST_PAID) === "true";
  
  // 🔐 LOCK MECHANISM: Prevents accidental parameter changes after payment
  const handleLockCheck = (onConfirm, onCancel) => {
    if (isTestPaid) {
      const discard = confirm("⚠️ Pozor! Zmenou kategórie, modelu alebo kapacity zahodíte svoj aktuálny zaplatený report. Chcete pokračovať?");
      if (!discard) {
        if (onCancel) onCancel();
        return false;
      }

      // Discard current report state
      isTestPaid = false;
      localStorage.removeItem(STORAGE_KEY_TEST_PAID);
      
      // Hide results and show overlay
      const resultsCol = qs("[data-results-column]");
      if (resultsCol) resultsCol.classList.remove("is-visible");
      
      const overlay = qs("[data-report-overlay]");
      if (overlay) {
        overlay.classList.remove("is-hidden");
        const text = qs(".reportOverlay__text", overlay);
        if (text) {
          text.hidden = false;
          text.textContent = "Čakám na spustenie analýzy...";
        }
      }
      console.log("🗑️ Report zahodený kvôli zmene parametrov.");
    }
    if (onConfirm) onConfirm();
    return true;
  };

  const apiFetch = async (path, init) => {
    let lastErr = null;
    
    // 🆕 CIRCUIT BREAKER: Track consecutive failures
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      for (const base of API_HOSTS) {
        try {
          const resp = await fetch(`${base}${path}`, init);
          
          // 🆕 ERROR RECOVERY: Handle specific HTTP errors
          if (!resp.ok) {
            if (resp.status === 403) {
              console.warn(`⚠️ 403 Forbidden from ${base}${path} - trying next host...`);
              continue; // Try next host
            }
            if (resp.status === 404) {
              console.warn(`⚠️ 404 Not Found: ${base}${path}`);
              return resp; // Return 404 to caller (not an error)
            }
            if (resp.status >= 500) {
              console.warn(`⚠️ Server error ${resp.status} from ${base}${path} - retrying...`);
              throw new Error(`Server error: ${resp.status}`);
            }
          }
          
          return resp;
        } catch (e) {
          console.warn(`⚠️ Fetch failed (attempt ${attempt + 1}/${maxRetries}):`, e);
          lastErr = e;
        }
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`🔄 Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    
    // All retries exhausted
    console.error(`❌ All fetch attempts failed for ${path}`);
    throw lastErr || new TypeError("Failed to fetch");
  };

  const burger = qs("[data-burger]");
  const mobileMenu = qs("[data-mobile-menu]");

  if (burger && mobileMenu) {
    burger.addEventListener("click", () => {
      const isHidden = mobileMenu.hasAttribute("hidden");
      if (isHidden) {
        mobileMenu.removeAttribute("hidden");
        burger.classList.add("is-active");
      } else {
        mobileMenu.setAttribute("hidden", "");
        burger.classList.remove("is-active");
      }
    });
  }

  const range = qs("[data-range]");
  const price = qs("[data-price]");
  const segmentsWrap = qs("[data-segments]");
  const segBtns = segmentsWrap ? Array.from(segmentsWrap.querySelectorAll("[data-seg]")) : [];
  const quickPriceEl = qs("[data-quick-price]");
  const marketPriceEl = qs("[data-market-price]");
  const premiumPriceEl = qs("[data-premium-price]");
  const liveResultPriceEl = qs("[data-result-price]");
  const heurekaPriceEl = qs("[data-heureka-price]");
  const usedPriceEl = qs("[data-used-price]");
  const valuePctEl = qs("[data-value-pct]");
  const savePctEl = qs("[data-save-pct]");
  const heurekaStatusEl = qs("[data-heureka-status]");
  const axis = qs("[data-axis]");
  const adEls = Array.from(document.querySelectorAll(".similarItem[data-ad-price]"));
  if (range && price) {
    // Single source of truth: backend sets the segment prices + slider range.
    // Slider only controls the currently selected price and UI highlight/fill.
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const roundToStep = (v) => {
      const st = Number(range.step || 5) || 5;
      return Math.round(v / st) * st;
    };
    const setFill = () => {
      const v = Number(range.value || 0);
      const mn = Number(range.min || 0);
      const mx = Number(range.max || 100);
      const pct = mx === mn ? 0 : ((v - mn) / (mx - mn)) * 100;
      range.style.setProperty("--p", `${clamp(pct, 0, 100).toFixed(2)}%`);
    };
    const setActiveSeg = (v) => {
      if (!segBtns.length) return;
      const q = Number(quickPriceEl?.textContent || 0);
      const m = Number(marketPriceEl?.textContent || 0);
      const p = Number(premiumPriceEl?.textContent || 0);
      // Use thresholds around market so it doesn't drift with min/max changes.
      const t1 = (q + m) / 2 || m;
      const t2 = (m + p) / 2 || m;
      const active = v <= t1 ? "quick" : v >= t2 ? "premium" : "market";
      segBtns.forEach((b) => b.classList.toggle("is-active", b.dataset.seg === active));
    };
    const pulse = () => {
      price.classList.remove("is-pulse");
      // eslint-disable-next-line no-unused-expressions
      price.offsetWidth;
      price.classList.add("is-pulse");
    };
    const sync = (doPulse = true) => {
      const mn = Number(range.min || 0);
      const mx = Number(range.max || 0);
      let v = Number(range.value || 0);
      v = clamp(roundToStep(v), mn, mx);
      range.value = String(v);
      price.textContent = String(v);
      if (liveResultPriceEl) liveResultPriceEl.textContent = String(v);
      if (usedPriceEl) usedPriceEl.textContent = String(v);
      setFill();
      setActiveSeg(v);
      if (doPulse) pulse();
    };

    range.addEventListener("input", () => sync(true));
    segBtns.forEach((b) => {
      b.addEventListener("click", () => {
        const kind = b.dataset.seg;
        const q = Number(quickPriceEl?.textContent || 0);
        const m = Number(marketPriceEl?.textContent || 0);
        const p = Number(premiumPriceEl?.textContent || 0);
        const next = kind === "quick" ? q : kind === "premium" ? p : m;
        if (Number.isFinite(next) && next > 0) range.value = String(next);
        sync(true);
      });
    });

    // Initial fill
    sync(false);
  }

  const toast = qs("[data-toast]");
  const toastText = qs("[data-toast-text]");
  const toastIcon = qs("[data-toast-icon]");
  const ICONS = {
    success:
      "<svg viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M9.2 16.6 4.9 12.3l1.4-1.4 2.9 2.9 8-8 1.4 1.4-9.4 9.4Z'/></svg>",
    error:
      "<svg viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5h2v2h-2v-2Zm0-10h2v8h-2V5Z'/></svg>",
    info:
      "<svg viewBox='0 0 24 24' aria-hidden='true'><path fill='currentColor' d='M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-3h2v-6h-2v6Zm0-8h2V7h-2v2Z'/></svg>",
  };

  const showToast = (text, { type = "info", duration = 3200 } = {}) => {
    if (!toast || !toastText || !toastIcon) return;
    toastText.textContent = text;
    toastIcon.innerHTML = ICONS[type] ?? ICONS.info;
    toast.classList.toggle("is-error", type === "error");
    toast.classList.toggle("is-success", type === "success");
    toast.removeAttribute("hidden");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => {
      toast.setAttribute("hidden", "");
      toast.classList.remove("is-error", "is-success");
    }, duration);
  };
  window.showToast = showToast; // Make it global

  // Image upload + lightweight client-side resize
  const uploadTile = qs("[data-upload-tile]");
  const imageInput = qs("[data-image-input]");
  const imageClearBtn = qs("[data-image-clear]");
  const imageOverlay = qs("[data-image-overlay]");
  const toggleBgEl = qs("[data-toggle-bg]");
  const toggleDefectsEl = qs("[data-toggle-defects]");
  const toggleHighlightEl = qs("[data-toggle-highlight]");
  let uploadedImageDataUrl = "";
  let originalImageDataUrl = "";
  let bgRemovedImageDataUrl = "";
  let lastBenefits = [];
  let lastDefects = [];
  let autoEvalTimer = 0;
  let autoRecalcTimer = 0;
  let isEvaluating = false;
  let lastIdentification = null;
  let autoYesTimer = 0;
  
  // 🆕 GLOBAL FILTER HANDLER REATTACHMENT
  let globalAttachFilterHandlers = null;

  // Modal elements (confirm product)
  const modal = qs("[data-modal]");
  const modalProduct = qs("[data-modal-product]");
  const modalSubtitle = qs("[data-modal-subtitle]");
  const modalHint = qs("[data-modal-hint]");
  const modalField = qs("[data-modal-field]");
  const modalInput = qs("[data-modal-input]");
  const modalCategorySelect = qs("[data-modal-category]");
  const modalCategoryField = qs("[data-modal-category-field]");
  const modalYes = qs("[data-modal-yes]");
  const modalNo = qs("[data-modal-no]");
  const modalCloseEls = Array.from(document.querySelectorAll("[data-modal-close]"));
  
  // Category storage
  let selectedCategory = null;
  let selectedCatType = 'Mobil'; // Predvolená kategória Mobil
  
  // Available categories for selection
  const CATEGORIES = [
    { id: 13, key: "PC", name: "Počítače" },
    { id: 14, key: "MOBILY", name: "Mobilné telefóny" },
    { id: 15, key: "FOTO", name: "Foto" },
    { id: 16, key: "ELEKTRO", name: "Elektro" },
    { id: 17, key: "SPORT", name: "Šport" },
    { id: 18, key: "HUDBA", name: "Hudba" },
    { id: 19, key: "NABYTOK", name: "Nábytok" },
    { id: 20, key: "DOM", name: "Dom a záhrada" },
    { id: 21, key: "STROJE", name: "Stroje a náradie" },
    { id: 22, key: "OBLECENIE", name: "Oblečenie" },
    { id: 23, key: "KNIHY", name: "Knihy" },
    { id: 24, key: "DETSKE", name: "Detské" },
  ];

  const populateCategories = (suggestedCategoryId) => {
    console.log("🔧 populateCategories called with suggestedId:", suggestedCategoryId);
    console.log("📦 modalCategorySelect element:", modalCategorySelect);
    
    if (!modalCategorySelect) {
      console.error("❌ modalCategorySelect not found!");
      return;
    }
    
    // Clear existing options
    modalCategorySelect.innerHTML = "";
    
    // Default to Elektro if no suggestion
    const defaultId = CATEGORIES[3].id; // Elektro (16)
    const selectedId = suggestedCategoryId || defaultId;
    
    console.log("🎯 Selected category ID:", selectedId, "Default:", defaultId);
    
    // Add categories
    CATEGORIES.forEach(cat => {
      const option = document.createElement("option");
      option.value = cat.id;
      
      // Add visual indicator for AI suggestion
      if (cat.id === suggestedCategoryId && suggestedCategoryId) {
        option.textContent = `${cat.name} ✨ (navrhnuté AI)`;
        option.selected = true;
        console.log("✨ AI suggested category:", cat.name, "ID:", cat.id);
      } else {
        option.textContent = cat.name;
        if (cat.id === selectedId) {
          option.selected = true;
        }
      }
      
      modalCategorySelect.appendChild(option);
    });
    
    console.log("✅ Categories populated. Select value:", modalCategorySelect.value);
    console.log("📋 Total options:", modalCategorySelect.options.length);
    
    // Set initial selected category
    selectedCategory = selectedId;
  };
  
  const openModal = () => {
    if (!modal) return;
    modal.removeAttribute("hidden");
    // Prevent body scroll but don't add padding to avoid layout shift
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = "0px";
    
    // Make background inert to prevent focus issues
    const imac = document.querySelector(".imac");
    if (imac) imac.setAttribute("inert", "");
    
    // Populate categories with AI suggestion
    const suggestedId = lastIdentification?.category?.id || null;
    console.log("🏷️ Opening modal with category:", { 
      lastIdentification, 
      category: lastIdentification?.category, 
      suggestedId 
    });
    populateCategories(suggestedId);
  };
  const closeModal = () => {
    if (!modal) return;
    modal.setAttribute("hidden", "");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
    window.clearTimeout(autoYesTimer);
    
    // Remove inert from background
    const imac = document.querySelector(".imac");
    if (imac) imac.removeAttribute("inert");
  };
  modalCloseEls.forEach((el) => el.addEventListener("click", closeModal));

  const compressImageToDataUrl = async (dataUrl, { maxSide = 1024, quality = 0.85 } = {}) => {
    const img = new Image();
    img.decoding = "async";
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Image load failed"));
    });
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) return dataUrl;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const cw = Math.max(1, Math.round(w * scale));
    const ch = Math.max(1, Math.round(h * scale));
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, cw, ch);
    // Prefer JPEG for photos to reduce size
    return canvas.toDataURL("image/jpeg", quality);
  };

  const setUploadPreview = (dataUrl) => {
    if (!uploadTile) return;
    if (!dataUrl) {
      uploadTile.classList.remove("hasImage");
      uploadTile.style.backgroundImage = "";
      if (imageOverlay) {
        imageOverlay.innerHTML = "";
        imageOverlay.setAttribute("hidden", "");
      }
      return;
    }
    uploadTile.classList.add("hasImage");
    uploadTile.style.backgroundImage = `url("${dataUrl}")`;
  };

  const clearDefectOverlay = () => {
    if (!imageOverlay) return;
    imageOverlay.innerHTML = "";
    imageOverlay.setAttribute("hidden", "");
  };

  const renderDefectOverlay = (defects) => {
    if (!imageOverlay || !uploadTile) return;
    const arr = Array.isArray(defects) ? defects : [];
    imageOverlay.innerHTML = "";
    if (!arr.length) {
      imageOverlay.setAttribute("hidden", "");
      return;
    }
    imageOverlay.removeAttribute("hidden");
    for (const d of arr.slice(0, 6)) {
      const label = String(d?.label || "").trim();
      const b = d?.bbox || {};
      const x = Math.max(0, Math.min(1, Number(b.x || 0)));
      const y = Math.max(0, Math.min(1, Number(b.y || 0)));
      const w = Math.max(0.01, Math.min(1, Number(b.w || 0.1)));
      const h = Math.max(0.01, Math.min(1, Number(b.h || 0.1)));

      const box = document.createElement("div");
      box.className = "defectBox";
      box.style.left = `${(x * 100).toFixed(2)}%`;
      box.style.top = `${(y * 100).toFixed(2)}%`;
      box.style.width = `${(w * 100).toFixed(2)}%`;
      box.style.height = `${(h * 100).toFixed(2)}%`;
      if (label) {
        const pill = document.createElement("div");
        pill.className = "defectBox__label";
        pill.textContent = label;
        box.appendChild(pill);
      }
      imageOverlay.appendChild(box);
    }
  };

  // Blur background while keeping product sharp (simple edge-based detection)
  const blurBackgroundLocally = async (dataUrl) => {
    const img = new Image();
    img.src = dataUrl;
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
    });
    
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("Invalid image dimensions");
    
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas context failed");
    
    // Draw original image
    ctx.drawImage(img, 0, 0, w, h);
    const originalData = ctx.getImageData(0, 0, w, h);
    
    // Step 1: Detect product region (center-weighted edge detection)
    const mask = detectProductMask(originalData);
    
    // Step 2: Apply blur to background only
    ctx.filter = "blur(12px)";
    ctx.drawImage(img, 0, 0, w, h);
    const blurredData = ctx.getImageData(0, 0, w, h);
    ctx.filter = "none";
    
    // Step 3: Composite - blend original (product) with blurred (background) using mask
    const output = ctx.createImageData(w, h);
    for (let i = 0; i < originalData.data.length; i += 4) {
      const alpha = mask[i / 4]; // 0 = background (blur), 1 = product (sharp)
      output.data[i] = originalData.data[i] * alpha + blurredData.data[i] * (1 - alpha);
      output.data[i + 1] = originalData.data[i + 1] * alpha + blurredData.data[i + 1] * (1 - alpha);
      output.data[i + 2] = originalData.data[i + 2] * alpha + blurredData.data[i + 2] * (1 - alpha);
      output.data[i + 3] = 255;
    }
    
    ctx.putImageData(output, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.9);
  };
  
  // Simple product detection: assumes product is in center with high contrast/edges
  const detectProductMask = (imageData) => {
    const w = imageData.width;
    const h = imageData.height;
    const d = imageData.data;
    const mask = new Float32Array(w * h);
    
    // Step 1: Edge detection (simplified Sobel)
    const edges = new Float32Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const gx = 
          -d[i - 4 - w * 4] - 2 * d[i - w * 4] - d[i + 4 - w * 4] +
          d[i - 4 + w * 4] + 2 * d[i + w * 4] + d[i + 4 + w * 4];
        const gy = 
          -d[i - 4 - w * 4] - 2 * d[i - 4] - d[i - 4 + w * 4] +
          d[i + 4 - w * 4] + 2 * d[i + 4] + d[i + 4 + w * 4];
        edges[y * w + x] = Math.sqrt(gx * gx + gy * gy) / 1000;
      }
    }
    
    // Step 2: Find center region with high edge density (product is likely here)
    const cx = w / 2;
    const cy = h / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);
    
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
        
        // Combine edge strength + center bias
        const edgeStrength = Math.min(1, edges[idx] * 3);
        const centerBias = Math.max(0, 1 - dist * 1.2); // Strong center bias
        
        // Product mask: high in center + high edges
        mask[idx] = Math.min(1, (edgeStrength * 0.6 + centerBias * 0.4) * 1.5);
      }
    }
    
    // Step 3: Smooth mask (feather edges)
    const smoothed = new Float32Array(w * h);
    const radius = Math.floor(Math.min(w, h) * 0.02); // 2% smoothing
    for (let y = radius; y < h - radius; y++) {
      for (let x = radius; x < w - radius; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            sum += mask[(y + dy) * w + (x + dx)];
            count++;
          }
        }
        smoothed[y * w + x] = sum / count;
      }
    }
    
    return smoothed;
  };

  const applyBackgroundBlurIfEnabled = async () => {
    if (!toggleBgEl?.checked) return;
    if (!originalImageDataUrl) return;
    
    // Show loading state
    if (uploadTile) uploadTile.classList.add("uploadTile--loading");
    showToast("Rozmazávam pozadie…", { type: "info" });
    
    try {
      bgRemovedImageDataUrl = await blurBackgroundLocally(originalImageDataUrl);
      uploadedImageDataUrl = bgRemovedImageDataUrl;
      setUploadPreview(bgRemovedImageDataUrl);
      showToast("Pozadie rozmazané – produkt v popredí.", { type: "success" });
    } catch (e) {
      bgRemovedImageDataUrl = "";
      uploadedImageDataUrl = originalImageDataUrl;
      setUploadPreview(originalImageDataUrl);
      const msg = String(e?.message || e || "");
      showToast(`Nepodarilo sa rozmazať pozadie: ${msg.slice(0, 120)}`, { type: "error" });
    } finally {
      // Remove loading state
      if (uploadTile) uploadTile.classList.remove("uploadTile--loading");
    }
  };

  const clearCurrentImage = () => {
    uploadedImageDataUrl = "";
    originalImageDataUrl = "";
    bgRemovedImageDataUrl = "";
    lastIdentification = null;
    window.clearTimeout(autoEvalTimer);
    window.clearTimeout(autoYesTimer);
    setUploadPreview("");
    clearDefectOverlay();
    if (imageInput) imageInput.value = "";

    // Clear product name so nothing stale remains
    const nameInp = qs("[data-product-name]");
    const notesInp = qs("[data-product-notes]");
    if (nameInp) nameInp.value = "";
    if (notesInp) notesInp.value = "";

    // Hide result so old content doesn't linger
    const result = qs("[data-result]");
    if (result) result.setAttribute("hidden", "");

    showToast("Obrázok odstránený.", { type: "info" });
  };

  imageClearBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    clearCurrentImage();
  });

  const callIdentifyApi = async () => {
    const resp = await apiFetch("/api/identify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ imageDataUrl: uploadedImageDataUrl || null }),
    });
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      throw new Error(`API ${resp.status}: ${t.slice(0, 200)}`);
    }
    const data = await resp.json();
    if (!data?.ok) throw new Error(data?.error || "API error");
    return data.identification || null;
  };

  const showProductConfirm = async () => {
    if (!uploadedImageDataUrl) return;
    lastIdentification = null;
    if (modalHint) modalHint.setAttribute("hidden", "");
    if (modalField) modalField.setAttribute("hidden", "");
    if (modalInput) modalInput.value = "";

    openModal();
    if (modalProduct) modalProduct.textContent = "…";

    try {
      const id = await callIdentifyApi();
      lastIdentification = id;
      console.log("🔍 Received identification:", id);
      console.log("📦 Category data:", id?.category);
      const name = String(id?.name || "").trim();
      const conf = Number(id?.confidence || 0);
      
      // Update categories with AI suggestion NOW that we have the data
      const suggestedId = id?.category?.id || null;
      console.log("🔄 Updating categories with suggestedId:", suggestedId);
      populateCategories(suggestedId);
      
      // If we are not confident about the exact model, put a hint into the product name field
      // and let the user type the precise model; we'll auto-recalculate once they do.
      if (name && conf < 0.78) {
        setProductNameHint(name);
        closeModal();
        showToast(`Rozpoznal som ${name}. Doplňte presný model pre lepšiu cenu.`, { type: "info" });
        return;
      }
      if (name && conf >= 0.6) {
        if (modalProduct) modalProduct.textContent = name;
        if (modalHint) {
          modalHint.textContent = `Istota: ${Math.round(conf * 100)}% • ${String(id?.evidence || "").trim()} • Ak je správne, kliknite ÁNO.`;
          modalHint.removeAttribute("hidden");
        }
        // Always show the input field so user can edit if needed
        if (modalField) {
          modalField.removeAttribute("hidden");
          if (modalInput) {
            modalInput.value = name;
            modalInput.focus();
            modalInput.select();
          }
        }

        // Never auto-confirm - always wait for manual confirmation
        // User must explicitly click YES or edit name and click YES
      } else {
        if (modalProduct) modalProduct.textContent = "Neisté / nerozpoznané";
        if (modalHint) {
          modalHint.textContent =
            "Fotka sa nedala spoľahlivo rozpoznať. Prosím zadajte názov produktu presne (značka + model). " +
            "Napr: 'iPhone 13 Pro 256GB', 'Sprchový kút Ravak 90x90', 'Bicykel Trek Marlin 7 2023'";
          modalHint.removeAttribute("hidden");
        }
        if (modalField) modalField.removeAttribute("hidden");
        modalInput?.focus();
      }
    } catch {
      if (modalProduct) modalProduct.textContent = "Nedostupné";
      if (modalHint) {
        modalHint.textContent = "Nepodarilo sa overiť produkt. Skontrolujte, že beží `node server.mjs`.";
        modalHint.removeAttribute("hidden");
      }
      if (modalField) modalField.removeAttribute("hidden");
      modalInput?.focus();
    }
  };

  uploadTile?.addEventListener("click", () => {
    imageInput?.click();
  });
  imageInput?.addEventListener("change", async () => {
    const f = imageInput.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      showToast("Prosím vyberte obrázok (JPG/PNG).", { type: "error" });
      return;
    }
    const reader = new FileReader();
    const rawDataUrl = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(f);
    });
    try {
      uploadedImageDataUrl = await compressImageToDataUrl(rawDataUrl, { maxSide: 1536, quality: 0.88 });
      originalImageDataUrl = uploadedImageDataUrl;
      setUploadPreview(uploadedImageDataUrl);
      showToast("Obrázok pridaný – pripravené na analýzu.", { type: "success" });
    } catch {
      uploadedImageDataUrl = rawDataUrl;
      originalImageDataUrl = uploadedImageDataUrl;
      setUploadPreview(uploadedImageDataUrl);
      showToast("Obrázok pridaný.", { type: "success" });
    }

    // Clear old AI results immediately when new image is added
    const result = qs("[data-result]");
    if (result) result.setAttribute("hidden", "");
    const titleEl = qs("[data-result-title]");
    const descEl = qs("[data-result-desc]");
    if (titleEl) titleEl.textContent = "";
    if (descEl) descEl.textContent = "";
    lastBenefits = [];
    lastDefects = [];
    renderBenefits([]);
    clearDefectOverlay();

    if (toggleBgEl?.checked) {
      await applyBackgroundBlurIfEnabled();
    } else {
      bgRemovedImageDataUrl = "";
      uploadedImageDataUrl = originalImageDataUrl;
    }

    // Show product confirmation modal with AI detection
    window.clearTimeout(autoEvalTimer);
    autoEvalTimer = window.setTimeout(() => {
      void showProductConfirm();
    }, 250);
  });

  const generateBtn = qs("[data-generate]");
  const evaluateBtn = qs("[data-evaluate]");
  const resetBtn = qs("[data-reset]");
  const batteryHealthInput = qs("[data-battery-health]");
  const batteryField = qs("[data-battery-field]");
  const specsRow = qs("[data-specs-row]");
  const sellerPriceInput = qs("[data-seller-price]");
  const productNameInput = qs("[data-product-name]");
  const categoryButtons = document.querySelectorAll(".catItem");
  const result = qs("[data-result]");

  // 🆕 AUDITLYIO: Category Selection Logic
  
  categoryButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      handleLockCheck(() => {
      const catType = btn.dataset.catType; // E.g. "Mobil", "Konzola"...

      // Update UI: Toggle active state
      categoryButtons.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      // Sync with dropdown
      if (categorySelect) {
        categorySelect.value = catType;
          // Trigger the UI updates directly to avoid double lock check
          performCategoryChange();
          savePrevValue(categorySelect);
      }

      // Update placeholder dynamically
      if (productNameInput) {
        let placeholder = "Napr. iPhone 15 Pro";
        const catLower = catType.toLowerCase();
        if (catLower === "mobil") placeholder = "Napr. iPhone 15 Pro 128GB";
        else if (catLower === "konzola") placeholder = "Napr. PlayStation 5 Disc Edition";
        else if (catLower === "notebook") placeholder = "Napr. MacBook Air M2 13\" 2022";
        else if (catLower === "hodinky") placeholder = "Napr. Apple Watch Ultra 2";
        else if (catLower === "iné") placeholder = "Zadajte názov a model zariadenia...";
        
        productNameInput.placeholder = placeholder;
      }

      console.log(`🏷️ Category changed to: ${catType}`);
      });
    });
  });

  // 🆕 AUDITLYIO: Mode Toggle Logic (Kupujem / Predávam)
  const modeInputs = document.querySelectorAll('input[name="auditMode"]');
  const buyFields = qs("[data-mode-buy-fields]");
  const sellFields = qs("[data-mode-sell-fields]");

  modeInputs.forEach(input => {
    input.addEventListener("change", (e) => {
      handleLockCheck(() => {
      const mode = e.target.value;
      console.log(`🔄 Mode switched to: ${mode}`);
      
      if (generateBtn) {
          generateBtn.textContent = "SPUSTIŤ ANALÝZU RIZÍK";
      }

      const generateAdBtn = qs("[data-generate-ad]");
      if (generateAdBtn) {
        generateAdBtn.hidden = mode === "buy";
        generateAdBtn.style.display = mode === "buy" ? "none" : "flex";
      }

      // 💡 Mode-Specific Guidance Toasts
      if (mode === "buy") {
        showToast("🔍 V režime KÚPA overujeme pôvodnú konfiguráciu a hľadáme skryté riziká.", { type: "info", duration: 4000 });
      } else {
        showToast("📈 V režime PREDAJ optimalizujeme cenu a generujeme podklady pre inzerát.", { type: "success", duration: 4000 });
      }

      // Toggle field visibility
      if (buyFields && sellFields) {
        if (mode === "buy") {
          buyFields.hidden = false;
          sellFields.hidden = true;
          buyFields.style.display = "flex";
          sellFields.style.display = "none";
        } else {
          buyFields.hidden = true;
          sellFields.hidden = false;
          buyFields.style.display = "none";
          sellFields.style.display = "flex";
        }
      }

      // Dynamically update battery field visibility based on category
      const catBtn = qs(".catItem.is-active");
      const category = categorySelect?.value || catBtn?.dataset.catType || "";
      const catLower = category.toLowerCase();
      const isConsole = catLower === "konzola" || catLower === "console";
      const isWatch = catLower === "hodinky" || catLower === "watch";
      const isAudio = catLower === "slúchadlá" || catLower === "audio";
      
      const needsBattery = (catLower === "mobil" || catLower === "notebook" || catLower === "tablet" || catLower === "mobile" || catLower === "laptop" || isWatch) && !isConsole && !isAudio;
      
      const batBuy = qs("[data-battery-field]");
      const batSell = qs("[data-battery-field-sell]");
      
      if (batBuy) batBuy.style.display = (mode === "buy" && needsBattery) ? "block" : "none";
      if (batSell) batSell.style.display = (mode === "sell" && needsBattery) ? "block" : "none";

      // 🎮 CONSOLE SPECIFIC: Toggle console fields on mode change
      const consoleOnlyFields = document.querySelectorAll("[data-console-only]");
      consoleOnlyFields.forEach(f => {
        const isConsoleMode = (catLower === "konzola" || catLower === "console") && mode === "sell";
        f.hidden = !isConsoleMode;
        f.style.display = isConsoleMode ? "block" : "none";
      });

      // 🔄 Trigger recalculation on mode switch
      fetchHeurekaPrice();
      }, () => {
        // Revert radio button if cancel
        const currentMode = input.value === "buy" ? "sell" : "buy";
        const otherInput = Array.from(modeInputs).find(i => i.value === currentMode);
        if (otherInput) otherInput.checked = true;
      });
    });
  });

  // 🎮 CONTROLLER CYCLING LOGIC
  const controllerBox = qs("[data-controller-cycle]");
  const controllerVal = qs("[data-controller-value]");
  const controllerVisual = qs("[data-controller-visual]");
  let controllerCount = 0; // 0, 1, 2

  if (controllerBox) {
    controllerBox.addEventListener("click", () => {
      controllerCount = (controllerCount + 1) % 3; // Cycle: 0 -> 1 -> 2 -> 0
      
      if (controllerVal) {
        if (controllerCount === 0) controllerVal.textContent = "Bez ovládača";
        else if (controllerCount === 1) controllerVal.textContent = "1 ovládač";
        else if (controllerCount === 2) controllerVal.textContent = "2 ovládače";
      }

      if (controllerVisual) {
        controllerVisual.innerHTML = "";
        for (let i = 0; i < controllerCount; i++) {
          const icon = document.createElement("span");
          icon.className = "controller-mini-icon";
          icon.textContent = "🎮";
          controllerVisual.appendChild(icon);
        }
      }

      console.log(`🎮 Controller count set to: ${controllerCount}`);
    });
  }

  // 📥 PDF & SHARE ACTIONS
  const downloadPdfBtn = qs("[data-download-pdf]");
  const shareResultBtn = qs("[data-share-result]");

// Global helper for copy to clipboard
window.copyToClipboard = (elementId) => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`❌ Element with ID ${elementId} not found.`);
    return;
  }
  
  const text = element.innerText || element.textContent;
  
  // Use navigator.clipboard with a fallback for non-secure contexts
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      if (window.showToast) window.showToast("✅ Skopírované do schránky!", { type: "success" });
      else alert("Skopírované!");
    }).catch(err => {
      console.error('Failed to copy: ', err);
      fallbackCopyToClipboard(text);
    });
  } else {
    fallbackCopyToClipboard(text);
  }
};

const fallbackCopyToClipboard = (text) => {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    // Ensure textarea is not visible
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    
    if (successful) {
      if (window.showToast) window.showToast("✅ Skopírované do schránky!", { type: "success" });
      else alert("Skopírované!");
    } else {
      throw new Error('Fallback copy failed');
    }
  } catch (err) {
    console.error('Fallback copy failed', err);
    alert("Kopírovanie zlyhalo. Skúste text vybrať a skopírovať ručne.");
  }
};

  downloadPdfBtn?.addEventListener("click", () => {
    showToast("Pripravujem PDF certifikát auditu...", { type: "info" });
    setTimeout(() => {
      showToast("PDF audit úspešne vygenerovaný!", { type: "success" });
    }, 2000);
  });

  // Pre-select first category or default
  const initialCatBtn = qs('.catItem.is-active') || categoryButtons[0];

  // 🕵️ HEUREKA FETCH HELPER
  const fetchHeurekaPrice = async () => {
    const model = qs("[data-product-name]")?.value?.trim();
    const storage = qs("[data-storage-select]")?.value || "";
    const ram = qs("[data-ram-select]")?.value || "";
    const color = qs("[data-color-select]")?.value || "";

    if (!model) return;

    // 💳 PAYMENT GATE: Do not fetch or update anything on the right until paid
    if (!isTestPaid) {
      console.log("⏳ Skryté načítavanie: Platba sa vyžaduje pred zobrazením dát.");
      return;
    }
    
    console.log(`🕵️ Frontend: Fetching Heureka price for "${model} ${storage} ${ram} ${color}"...`);
    
    // 🆕 VISUAL FEEDBACK: Show mini-loaders in cards during fetch
    const priceDisplay = qs("#expertRecommendedPrice");
    const specList = qs('.specList');
    const checkList = qs(".checkList");
    const verdictBadge = qs(".verdictBox__badge");
    
    if (priceDisplay) priceDisplay.innerHTML = `<span class="spinner-mini"></span>`;
    if (specList) specList.innerHTML = `<div style="padding:20px; text-align:center;"><div class="spinner-mini"></div></div>`;
    if (checkList) checkList.innerHTML = `<div style="padding:20px; text-align:center;"><div class="spinner-mini"></div></div>`;
    if (verdictBadge) verdictBadge.innerHTML = `<span class="spinner-mini"></span>`;

    try {
      const url = `${API_BASE}/api/heureka?model=${encodeURIComponent(model)}&storage=${encodeURIComponent(storage)}&ram=${encodeURIComponent(ram)}&color=${encodeURIComponent(color)}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      
      if (data.ok) {
        console.log("💰 Heureka Data Received:", data);
        window.heurekaData = data; 
      saveAppState(); // 💾 Save state after successful price fetch

        // 🆕 FETCH EXPERT REPORT (FOR RISKS PREVIEW)
        let brand = "Apple";
        const modelLower = model.toLowerCase();
        if (modelLower.includes("ps5") || modelLower.includes("sony") || modelLower.includes("playstation")) brand = "Sony";
        if (modelLower.includes("xbox") || modelLower.includes("microsoft") || modelLower.includes("surface")) brand = "Microsoft";
        if (modelLower.includes("nintendo") || modelLower.includes("switch")) brand = "Nintendo";
        if (modelLower.includes("samsung") || modelLower.includes("galaxy")) brand = "Samsung";
        if (modelLower.includes("msi")) brand = "MSI";
        if (modelLower.includes("acer")) brand = "Acer";
        if (modelLower.includes("asus")) brand = "ASUS";
        if (modelLower.includes("razer")) brand = "Razer";
        if (modelLower.includes("lenovo")) brand = "Lenovo";
        if (modelLower.includes("dell")) brand = "Dell";

        try {
          const reportResp = await fetch(`${API_BASE}/api/audit/report?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`);
          const reportData = await reportResp.json();
          if (reportData.ok) {
            const r = reportData.report;
            
            // 💰 SYNC PRICE: Use Central Pricing Engine (Source of truth)
            data.priceAvg = getFairPriceBasis(model, r.base_price_recommended, data.priceAvg);
              data.priceFrom = data.priceAvg * 0.9;

            const checkList = qs(".checkList");
            if (checkList) {
              const risks = typeof r.common_faults === 'string' ? JSON.parse(r.common_faults) : r.common_faults;
              checkList.innerHTML = risks.slice(0, 3).map(f => `
                <div class="checkItem is-bad"><span>⚠️</span> ${f}</div>
              `).join('') + `
                <div class="cardActionHint" style="margin-top:10px; color: var(--purple-main); font-weight:800">
                  + Ďalšie riziká v Master Reporte
                </div>
              `;
            }
          }
        } catch (e) { console.warn("Risks fetch failed", e); }
        
        const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
        const batteryInput = currentMode === "sell" ? qs("[data-battery-health-sell]") : qs("[data-battery-health]");
        const batteryVal = Number(batteryInput?.value) || 100;
        const warrantyInput = currentMode === "sell" ? qs("[data-has-warranty-sell]") : qs("[data-has-warranty]");
        const hasWarranty = warrantyInput?.checked;

        // 🆕 UPDATE CARD 1: SPECS (RELEVANT ONLY)
        const specList = qs('.specList');
        if (specList) {
          const deviceSpecs = findDeviceInCatalog(model);
          const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
          const batteryInput = currentMode === "sell" ? qs("[data-battery-health-sell]") : qs("[data-battery-health]");
          const batteryVal = batteryInput?.value || "100";
          const warrantyInput = currentMode === "sell" ? qs("[data-has-warranty-sell]") : qs("[data-has-warranty]");
          const hasWarranty = warrantyInput?.checked;

          let html = `<div class="specItem"><span>Model</span> <strong>${model}</strong></div>`;
          
          if (storage && storage !== "—") {
            html += `<div class="specItem"><span>Kapacita</span> <strong>${storage}</strong></div>`;
          }

          if (deviceSpecs) {
            html += `
              <div class="specItem"><span>Procesor</span> <strong>${deviceSpecs.cpu}</strong></div>
              <div class="specItem"><span>Displej</span> <strong>${deviceSpecs.display}</strong></div>
            `;
          }

          if (Number(batteryVal) < 100) {
            html += `<div class="specItem"><span>Batéria</span> <strong style="color: ${batteryVal < 85 ? '#ef4444' : '#f59e0b'}">${batteryVal}%</strong></div>`;
          }

          const conditionInput = qs("[data-device-condition]");
          const conditionPct = Number(conditionInput?.value) || 100;
          if (conditionPct < 100) {
            html += `<div class="specItem"><span>Stav</span> <strong style="color: ${conditionPct < 85 ? '#ef4444' : '#f59e0b'}">${conditionPct}%</strong></div>`;
          }

          if (hasWarranty) {
            html += `<div class="specItem"><span>Záruka</span> <strong style="color: #10b981">Áno</strong></div>`;
          }

          specList.innerHTML = html;
        }

        // ⚖️ CALCULATE FAIR PRICE ADJUSTMENTS
        let fairPriceAvg = data.priceAvg;
        
        // 1. Granular Battery Penalty
        let batteryPenalty = 0;
        if (batteryVal < 100) {
          if (batteryVal >= 95) batteryPenalty = 0;
          else if (batteryVal >= 90) batteryPenalty = 25;
          else if (batteryVal >= 85) batteryPenalty = 50;
          else if (batteryVal >= 80) batteryPenalty = 80;
          else batteryPenalty = 120;
        }
        fairPriceAvg -= batteryPenalty;

        // 2. Accessories Penalty (If missing)
        const hasBox = qs("[data-acc='box']")?.checked;
        const hasCharger = qs("[data-acc='charger']")?.checked;
        const hasReceipt = qs("[data-acc='receipt']")?.checked;
        
        if (!hasBox) fairPriceAvg -= 20;
        if (!hasCharger) fairPriceAvg -= 15;
        if (!hasReceipt) fairPriceAvg -= 30;

        // 3. Condition Penalty (ONLY for Sell Mode or if condition input is visible)
        if (currentMode === "sell") {
          const conditionInput = qs("[data-device-condition]");
          const conditionPct = Number(conditionInput?.value) || 100;
          fairPriceAvg = Math.round(fairPriceAvg * (conditionPct / 100));
          console.log(`⚖️ Live Sync: Condition (${conditionPct}%) applied. New fair price: ${fairPriceAvg}€`);
        }

        if (hasWarranty) fairPriceAvg += 30;

        const bars = document.querySelectorAll('.priceChart__bar');
        const labels = document.querySelectorAll('.priceChart__bar span');
        
        if (labels.length >= 3) {
          const marketFrom = data.priceFrom;
          const marketAvg = Math.max(data.priceAvg, marketFrom); // 🛡️ Fix: Market average cannot be lower than 'price from'
          let displayFairPrice = Math.round(fairPriceAvg);

          // 🆕 DYNAMIC ORDERING: Ensure bars always go from LOWEST to HIGHEST for logic
          // Points: [Our Price, Market From, Market Top]
          const points = [
            { val: displayFairPrice, label: "Férová", active: true, title: "Vaša férová cena (zohľadňuje stav)" },
            { val: Math.round(marketFrom), label: "Trh od", active: false, title: "Bežná najnižšia ponuka na trhu" },
            { val: Math.round(marketAvg), label: "TOP stav", active: false, title: "Trhový priemer za 100% stav" }
          ];

          // Sort points by value to ensure the visual chart always makes sense (ascending)
          points.sort((a, b) => a.val - b.val);

          const highestPoint = points[2].val;
          const getH = (p) => Math.max(15, Math.round((p / highestPoint) * 90));

          points.forEach((pt, idx) => {
            labels[idx].innerHTML = `<small>${pt.label}</small> ${pt.val}€`;
            bars[idx].style.height = `${getH(pt.val)}%`;
            bars[idx].title = pt.title;
            if (pt.active) {
              bars[idx].classList.add("is-active");
            } else {
              bars[idx].classList.remove("is-active");
            }
          });
        }

        // Update freshness info in UI
        const freshnessEl = document.querySelector('[data-market-freshness]');
        if (freshnessEl && data.date) {
          freshnessEl.innerText = `Aktualizované: ${data.date}`;
        }

        // 🆕 UPDATE VERDICT BASED ON PRICE
        const verdictBadge = qs(".verdictBox__badge");
        const verdictText = qs(".verdictBox__text");
        const sellerPrice = Number(qs(currentMode === "sell" ? "[data-expected-price]" : "[data-seller-price]")?.value || 0);

        if (verdictBadge && verdictText) {
          if (sellerPrice > 0) {
            const diff = fairPriceAvg - sellerPrice;
            const isSell = currentMode === "sell";

            if (diff > 20) {
              verdictBadge.innerText = isSell ? "RÝCHLY PREDAJ" : "VÝHODNÁ KÚPA";
              verdictBadge.style.background = "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
              verdictText.innerText = isSell 
                ? `Cena je pod aktuálnym trhovým priemerom. Zariadenie má vysoký predajný potenciál.`
                : `Aktuálna predajná cena je nižšia ako férová trhová hodnota. Ponuka je z finančného hľadiska výhodná.`;
            } else if (diff < -20) {
              verdictBadge.innerText = isSell ? "NAD PRIEMEROM" : "NEVÝHODNÉ";
              verdictBadge.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
              verdictText.innerText = isSell
                ? `Požadovaná cena prevyšuje trhový priemer. Úspešný predaj si môže vyžadovať úpravu ceny alebo časovú rezervu.`
                : `Cena prevyšuje aktuálnu férovú hodnotu na trhu. Odporúčame preveriť stav alebo vyjednať cenovú úpravu.`;
            } else {
              verdictBadge.innerText = isSell ? "OPTIMÁLNA CENA" : "FÉROVÁ CENA";
              verdictBadge.style.background = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)";
              verdictText.innerText = isSell
                ? `Stanovená cena presne korešponduje s aktuálnym dopytom a technickým stavom zariadenia.`
                : `Cena zodpovedá technickému stavu a aktuálnej situácii na sekundárnom trhu.`;
            }
          } else {
            // Predavam mode or no price entered
            verdictBadge.innerText = "ANALÝZA HOTOVÁ";
            const isSellMode = currentMode === "sell";
              const deviceConditionInput = qs("[data-device-condition]");
              const conditionPct = Number(deviceConditionInput?.value) || 100;

            if (isSellMode) {
              const batteryInput = qs("[data-battery-health-sell]");
              const batteryValSell = Number(batteryInput?.value) || 100;
              
              verdictText.innerHTML = `Vaša odporúčaná predajná cena je <strong>${Math.round(fairPriceAvg)}€</strong>.<br>
                <span style="font-size: 11px; opacity: 0.7; margin-top: 5px; display: block;">
                  💡 Výpočet zohľadňuje vami zadaný vizuálny stav (${conditionPct}%) a batériu (${batteryValSell}%).
                </span>`;
            } else {
              verdictText.innerHTML = `Férová bazárová cena pre toto zariadenie je približne <strong>${Math.round(fairPriceAvg)}€</strong>.<br>
                <span style="font-size: 11px; opacity: 0.7; margin-top: 5px; display: block;">
                  💡 Táto cena zohľadňuje aktuálny technický stav (${conditionPct}%). Trhový priemer za 100% stav je ${Math.round(data.priceAvg)}€.
                </span>`;
            }
          }
        }

        // 🚥 Update Deal Meter
        updateDealMeter(sellerPrice, fairPriceAvg);

        showToast(`Trh: Férová cena ${Math.round(fairPriceAvg)}€ (Batéria: ${batteryVal}%)`, { type: "info" });

        // 🛡️ ANTI-SWAPPIE ALERT
        if (data.isAnomaly) {
          showToast(`🛡️ Anti-Swappie: Detekovaná prestrelená trhová cena (${data.priceAvg}€). Používam historický priemer.`, { type: "warning", duration: 6000 });
          const freshnessEl = document.querySelector('[data-market-freshness]');
          if (freshnessEl) freshnessEl.innerHTML += ` <span style="color: #ff4d4d;">(Chránené históriou)</span>`;
        }
      }
    } catch (err) {
      console.warn("⚠️ Heureka fetch failed:", err);
    }
  };

  if (initialCatBtn) {
    const catId = Number(initialCatBtn.dataset.catId);
    selectedCategory = catId;
    selectedCatType = initialCatBtn.dataset.catType || 'Mobil';

    // 🎮 Initial visibility for console fields
    const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
    const consoleOnlyFields = document.querySelectorAll("[data-console-only]");
    consoleOnlyFields.forEach(f => {
      f.hidden = !(selectedCatType === "console" && currentMode === "sell");
      f.style.display = (selectedCatType === "console" && currentMode === "sell") ? "block" : "none";
    });
  }
  const notesTextarea = qs("[data-product-notes]");

  // AI Scanner logic initialized at the end of the script to ensure all dependencies are loaded.

  // Validation: require min 10 chars in notes before allowing generation
  const validateNotesAndUpdateButtons = () => {
    // 🆕 AUDITLYIO: Bypass notes validation for clean UI
    const isValid = true; 
    if (generateBtn) {
      generateBtn.disabled = !isValid;
      generateBtn.classList.toggle("is-disabled", !isValid);
    }
  };

  // Dynamic placeholder based on detected product/price
  const updateNotesPlaceholder = ({ isOldOrCheap = false } = {}) => {
    if (!notesTextarea) return;
    if (isOldOrCheap) {
      notesTextarea.placeholder = "Vypíšte vady (napr. hrdza, nefunkčné brzdy, škrabance, odreniny...)";
    } else {
      notesTextarea.placeholder = "Napr. Batéria 90%, kupované v Orange, drobné škrabance na zadnej strane…";
    }
  };

  // Listen to notes changes
  notesTextarea?.addEventListener("input", validateNotesAndUpdateButtons);
  notesTextarea?.addEventListener("change", validateNotesAndUpdateButtons);

  // Initial validation
  validateNotesAndUpdateButtons();
  const resultPrice = qs("[data-result-price]");
  const copyBtn = qs("[data-copy]");
  const titleEl = qs("[data-result-title]");
  const descEl = qs("[data-result-desc]");
  const priceNoteEl = qs("[data-price-note]");
  const similarCountEl = qs("[data-similar-count]");
  const benefitsTitleEl = qs("[data-benefits-title]");
  const benefitsTextEl = qs("[data-benefits-text]");
  const techLineEl = qs("[data-techline]");
  const techLineTextEl = qs("[data-techline-text]");
  const titleFull = titleEl?.textContent ?? "";
  const descFull = descEl?.textContent ?? "";
  const marketSourcesBtn = qs("[data-market-sources]");
  const marketSearchBtn = qs("[data-market-search]");
  const heurekaOpenEls = Array.from(document.querySelectorAll("[data-heureka-open]"));

  const getProductQuery = () => {
    // Prefer user-entered product text (prompt input) if present.
    const nameEl = qs("[data-product-name]");
    const promptRaw = (nameEl?.value ?? "").trim();
    // If the input currently holds a hint message, ignore it (don't send as product name).
    if (
      nameEl &&
      (nameEl.dataset.hint === "true" ||
        /^rozpoznal som\s+/i.test(promptRaw) ||
        /dopl[nň]te\s+pros[ií]m/i.test(promptRaw))
    ) {
      return "";
    }
    const normalize = (s) =>
      s
        .replace(/^\s*(napr\.?|například|pr\.\s*|example:)\s*/i, "")
        .replace(/\s+/g, " ")
        .trim();

    const pickFrom = (s) => {
      const raw = normalize(s);
      if (!raw) return "";
      // Take the first segment before dash/comma/pipe — usually the product name.
      const first = raw.split("–")[0].split(" - ")[0].split(",")[0].split("|")[0].trim();
      // If user typed a full sentence, keep it short-ish (product names are typically concise)
      return first.length <= 80 ? first : first.slice(0, 80).trim();
    };

    const fromPrompt = pickFrom(promptRaw);
    // Never fall back to the old title (prevents stale default Garmin)
    return fromPrompt;
  };

  const setProductNameHint = (detectedName) => {
    const inp = qs("[data-product-name]");
    if (!inp) return;
    const current = (inp.value || "").trim();
    // Only overwrite if user hasn't typed a real model yet or it's an older hint
    if (current && inp.dataset.hint !== "true") return;
    const label = String(detectedName || "produkt").trim() || "produkt";
    inp.dataset.hint = "true";
    inp.value = `Rozpoznal som ${label}, doplňte prosím presný model pre lepšiu cenu...`;
  };

  const clearProductNameHintIfNeeded = () => {
    const inp = qs("[data-product-name]");
    if (!inp) return;
    if (inp.dataset.hint === "true") {
      inp.value = "";
      delete inp.dataset.hint;
    }
  };

  const buildHeurekaUrl = (q) => {
    const enc = encodeURIComponent(q);
    return `https://www.heureka.sk/?h%5Bfraze%5D=${enc}`;
  };

  const updateHeurekaLinks = () => {
    const q = getProductQuery();
    const url = q ? buildHeurekaUrl(q) : "https://www.heureka.sk/";
    heurekaOpenEls.forEach((el) => {
      if (el instanceof HTMLAnchorElement) el.href = url;
    });
    return url;
  };

  // Initialize links immediately
  updateHeurekaLinks();

  // 🆕 REFACTORED EDIT SUBMIT HANDLER
  const handleEditSubmitAction = async (userRequest) => {
    if (isEditingAd) return;
    
    userRequest = (userRequest || "").trim();
    if (!userRequest) {
      showToast("Napíšte pokyn na úpravu (napr. 'daj cenu 10 eur').", { type: "info" });
      return;
    }
    
    if (userRequest.length < 5) {
      showToast("❌ Pokyn je príliš krátky. Napíšte konkrétne čo chcete zmeniť.", { type: "error", duration: 4000 });
      return;
    }
    
    if (!currentAdData) {
      showToast("Najprv vygenerujte inzerát.", { type: "info" });
      return;
    }
    
    isEditingAd = true;
    const submitBtn = document.querySelector("[data-edit-submit]");
    const originalBtnText = submitBtn?.querySelector(".editAdSection__btnText")?.textContent || "Upraviť";
    
    if (submitBtn) submitBtn.classList.add("is-loading");
    const btnText = submitBtn?.querySelector(".editAdSection__btnText");
    if (btnText) btnText.textContent = "Upravujem…";
    
    previousAdData = currentAdData ? { ...currentAdData } : null;
    
    try {
      const productName = (qs("[data-product-name]")?.value ?? "").trim();
      const notes = (qs("[data-product-notes]")?.value ?? "").trim();
      
      const resp = await apiFetch("/api/edit-ad", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentAd: currentAdData,
          userRequest,
          productName,
          notes,
        }),
      });
      
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      
      const data = await resp.json();
      if (!data?.ok) throw new Error(data?.error || "API error");
      
      // Update UI
      const titleEl = qs("[data-result-title]");
      const descEl = qs("[data-result-desc]");
      if (titleEl) titleEl.textContent = data.title || "";
      if (descEl) descEl.textContent = data.desc || "";
      renderBenefits(data.benefits || []);
      if (data.pricing) applyPricesToUI(data.pricing);
      
      currentAdData = {
        title: data.title || "",
        desc: data.desc || "",
        benefits: data.benefits || [],
        pricing: data.pricing || { fair: 0, quick: 0, premium: 0 },
        price: data.pricing?.fair || 0,
      };
      
      const undoBtn = document.querySelector("[data-edit-undo]");
      if (undoBtn && previousAdData) undoBtn.removeAttribute("hidden");
      
      incrementEditCount();
      const input = document.querySelector("[data-edit-request]");
      if (input) input.value = "";
      updateEditUI();
      
      showToast("✅ Inzerát upravený!", { type: "success" });
    } catch (err) {
      showToast(`Úprava zlyhala: ${err.message}`, { type: "error" });
    } finally {
      isEditingAd = false;
      if (submitBtn) submitBtn.classList.remove("is-loading");
      if (btnText) btnText.textContent = originalBtnText;
    }
  };

  // Expose to window for global access
  window.handleEditSubmitAction = handleEditSubmitAction;

  // 🆕 GLOBAL KEYPRESS FOR EDIT INPUT
  document.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && e.target.closest("[data-edit-request]")) {
      e.preventDefault();
      const input = e.target;
      if (input && input.value) {
        if (typeof window.handleEditSubmitAction === 'function') {
          window.handleEditSubmitAction(input.value);
        }
      }
    }
  });

  const getMarketQuery = () => {
    const fromInput = getProductQuery();
    if (fromInput) return fromInput;
    const fromTitle = (titleEl?.textContent ?? "").trim();
    return fromTitle && fromTitle !== "—" ? fromTitle : "";
  };

  // Ensure click always opens in a new tab (even if the element is later changed)
  heurekaOpenEls.forEach((el) => {
    el.addEventListener("click", (e) => {
      const url = updateHeurekaLinks();
      // Always open explicitly (more reliable than relying on default anchor behavior).
      e.preventDefault();
      if (el instanceof HTMLAnchorElement) {
        el.href = url;
        el.target = "_blank";
        el.rel = "noreferrer noopener";
      }
      const w = window.open(url, "_blank", "noopener,noreferrer");
      if (!w) {
        showToast("Prehliadač zablokoval otvorenie novej karty. Skontrolujte blokovanie vyskakovacích okien.", {
          type: "error",
        });
        return;
      }

      // No in-app Heureka price lookup: verification only via opened Heureka tab.
      // Best-effort: try to keep focus on the current tab (some browsers ignore this by design).
      try {
        w.blur();
      } catch {
        // ignore
      }
      try {
        window.focus();
      } catch {
        // ignore
      }
    });
  });

  const typewriter = async (el, fullText, { speed = 18, startDelay = 120 } = {}) => {
    if (!el) return;
    el.classList.add("is-typing");
    el.textContent = "";
    await new Promise((r) => window.setTimeout(r, startDelay));
    for (let i = 0; i < fullText.length; i += 1) {
      el.textContent += fullText[i];
      // small jitter so it feels less robotic
      const jitter = fullText[i] === " " ? 0 : Math.random() * 10;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => window.setTimeout(r, speed + jitter));
    }
    el.classList.remove("is-typing");
  };

  const generateSellingCopy = () => {
    const product = getProductQuery() || "Produkt";
    const notes = (qs("[data-product-notes]")?.value ?? "").trim();
    const v = Number(qs("[data-price]")?.textContent ?? 0);
    const condition = Number(document.querySelector(".similarItem[data-ad-id='garmin45']")?.dataset.adCondition ?? 90);

    // IMPORTANT: Do not copy text from external sites. Use Heureka only as a factual reference (price/availability),
    // and write unique, emotional, sales-focused copy.
    const openers = [
      `Predám ${product} v krásnom stave – pripravené na používanie hneď.`,
      `${product} v top stave – ideálne, ak chceš kvalitu bez ceny nového kusu.`,
      `Ponúkam ${product} pre niekoho, kto chce spoľahlivosť a komfort každý deň.`,
    ];
    const closer = Number.isFinite(v) && v > 0 ? `Odporúčaná cena je nastavená férovo na €${v}.` : "";
    const extra = notes ? `Poznámka: ${notes}` : "";

    const benefitPools = [
      ["Ideálne na beh a tréning", "GPS/športové funkcie pre motiváciu", "Prehľadné štatistiky a ciele"],
      ["Pohodlné na celodenné nosenie", "Jednoduché ovládanie", "Rýchla synchronizácia s mobilom"],
      ["Vizuálne čistý stav", "Pripravené na predaj (vyčistené)", "Vhodné aj ako darček"],
    ];
    const pickedPool = benefitPools[Math.floor(Math.random() * benefitPools.length)];
    const benefits = [
      `Stav približne ${Math.min(99, Math.max(70, condition))} % – pôsobí veľmi zachovalo`,
      ...pickedPool,
      "Šetríš oproti novému kusu, bez kompromisu na použiteľnosti",
    ].slice(0, 4);

    const desc = [openers[Math.floor(Math.random() * openers.length)], extra, closer]
      .filter(Boolean)
      .join(" ");

    return { title: product, desc, benefits };
  };

  const renderBenefits = (items) => {
    if (!benefitsTextEl) return;
    const arr = Array.isArray(items) ? items : [];
    lastBenefits = arr.slice(0, 8).map((x) => String(x || "").trim()).filter(Boolean);
    const highlight = Boolean(toggleHighlightEl?.checked);
    benefitsTextEl.classList.toggle("is-highlight", highlight);
    if (!highlight) {
      // Compact mode
      const text = lastBenefits.slice(0, 5).join(" • ");
      benefitsTextEl.textContent = text || "";
      return;
    }
    const esc = (s) =>
      String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    benefitsTextEl.innerHTML = lastBenefits
      .slice(0, 6)
      .map((b) => `<div class="benefitsText__item">• ${esc(b)}</div>`)
      .join("");
  };

  const renderWhyBuyThis = (items) => {
    const whyBuySection = qs("[data-why-buy-section]");
    const whyBuyList = qs("[data-why-buy-list]");
    if (!whyBuySection || !whyBuyList) return;
    
    const arr = Array.isArray(items) ? items : [];
    const filtered = arr.slice(0, 3).map((x) => String(x || "").trim()).filter(Boolean);
    
    if (filtered.length === 0) {
      whyBuySection.setAttribute("hidden", "");
      return;
    }
    
    whyBuySection.removeAttribute("hidden");
    const esc = (s) =>
      String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    whyBuyList.innerHTML = filtered
      .map((item) => `<div class="whyBuyList__item">✓ ${esc(item)}</div>`)
      .join("");
  };

  const renderFunnyPriceNote = (note) => {
    const funnyNoteEl = qs("[data-funny-price-note]");
    if (!funnyNoteEl) return;
    
    const text = String(note || "").trim();
    if (!text) {
      funnyNoteEl.setAttribute("hidden", "");
      return;
    }
    
    funnyNoteEl.removeAttribute("hidden");
    const esc = (s) =>
      String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    funnyNoteEl.innerHTML = `<div class="funnyPriceNote__icon">😄</div><div class="funnyPriceNote__text">${esc(text)}</div>`;
  };

  const renderSpecs = (specs, note = "") => {
    // Bazoš style: show a single short line, not an e-shop spec table.
    if (!techLineEl || !techLineTextEl) return;
    const arr = Array.isArray(specs) ? specs : [];
    const parts = arr
      .slice(0, 6)
      .map((s) => {
        const k = String(s?.label ?? "").trim();
        const v = String(s?.value ?? "").trim();
        if (!k || !v) return "";
        return `${k}: ${v}`;
      })
      .filter(Boolean);

    const noteText = String(note || "").trim();
    if (!parts.length && !noteText) {
      techLineEl.setAttribute("hidden", "");
      techLineTextEl.textContent = "";
      return;
    }
    techLineTextEl.textContent = parts.length ? parts.join(" • ") : noteText;
    techLineEl.removeAttribute("hidden");
  };

  const refreshAxisFromDom = () => {
    const axis = qs("[data-axis]");
    if (!axis || !range) return;
    const min = Number(range.min || 0);
    const max = Number(range.max || 100);
    const items = Array.from(document.querySelectorAll(".similarItem[data-ad-id][data-ad-price]"));
    axis.innerHTML = "";
    for (const el of items) {
      const price = Number(el.dataset.adPrice || 0);
      if (!Number.isFinite(price) || price <= 0) continue;
      const cond = Number(el.dataset.adCondition || 90);
      const id = el.dataset.adId || "";
      const pct = max === min ? 0 : ((price - min) / (max - min)) * 100;
      const marker = document.createElement("span");
      const isHeureka = el.dataset.adSource === "heureka";
      marker.className = isHeureka ? "axis__marker axis__marker--heureka" : "axis__marker";
      marker.style.left = `${Math.min(100, Math.max(0, pct)).toFixed(2)}%`;
      const s = Math.min(1.15, Math.max(0.75, (Number.isFinite(cond) ? cond : 90) / 100));
      marker.style.transform = `translateX(-50%) scale(${s.toFixed(2)})`;
      marker.dataset.adId = id;
      axis.appendChild(marker);
    }
  };

  // Delegate click on similar ads to flash the matching axis point
  const similarList = qs(".similarList");
  similarList?.addEventListener("click", (e) => {
    const a = e.target?.closest?.(".similarItem");
    if (!a) return;
    const id = a.dataset.adId;
    if (!id) return;
    const marker = document.querySelector(`.axis__marker[data-ad-id="${CSS.escape(id)}"]`);
    if (marker) {
      marker.classList.remove("is-flash");
      // eslint-disable-next-line no-unused-expressions
      marker.offsetWidth;
      marker.classList.add("is-flash");
    }
  });

  // Heureka: verification only via opening the search page (no price shown in-app).
  const getHeurekaState = () => ({ isAvailable: false, newPrice: 0, newPriceMax: 0 });
  const heurekaTechEl = null;

  const getSimilarAdsPayload = () => {
    const els = Array.from(document.querySelectorAll(".similarItem[data-ad-price]"));
    return els
      .map((el) => ({
        id: el.dataset.adId || "",
        title: (el.querySelector(".similarItem__name")?.textContent || "").trim(),
        price: Number(el.dataset.adPrice || 0),
        condition: Number(el.dataset.adCondition || 100),
        source: el.dataset.adSource || "unknown",
      }))
      .filter((a) => Number.isFinite(a.price) && a.price > 0);
  };

  const callEvaluateApi = async (freshAds = null) => {
    const promptRaw = (qs("[data-product-name]")?.value ?? "").trim();
    // If user didn't type a name and we have an image, let backend auto-detect from the photo
    const productName = promptRaw ? getProductQuery() : "";
    const notes = (qs("[data-product-notes]")?.value ?? "").trim();
    const usedPrice = Number(range?.value || 0);
    const { isAvailable, newPrice, newPriceMax } = getHeurekaState();
    // Use freshAds if provided, otherwise fall back to UI payload
    const similarAds = freshAds || getSimilarAdsPayload();

    const detectDefects = Boolean(toggleDefectsEl?.checked);
    const adStyle = "odborny"; // Fixed style for Auditlyio expert reports
    
    // Manual category override (Auditlyio: using selectedCategory from buttons)
    const finalCategory = selectedCategory || 16;
    
    // Get category name for debug info
    const categoryName = CATEGORIES.find(c => c.id === finalCategory)?.name || "Elektro";
    
    console.log(`📤 Hľadám v kategórii: ${categoryName} (ID: ${finalCategory}) pre výraz: "${productName || '(z fotky)'}"`);
    console.log("   Štýl:", adStyle);
    
    const resp = await apiFetch("/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        productName,
        notes,
        batteryHealth,
        sellerPrice,
        usedPrice,
        newPrice,
        newPriceMax,
        isNewAvailable: isAvailable,
        similarAds,
        imageDataUrl: (toggleBgEl?.checked ? bgRemovedImageDataUrl || uploadedImageDataUrl : uploadedImageDataUrl) || null,
        detectDefects,
        categoryId: finalCategory, // Use manual category if selected, otherwise AI category
        adStyle, // Send ad style for AI prompt customization
        step: Number(range?.step || 5),
        // Don't artificially clamp pricing for cheap items; server enforces its own sanity + step.
        min: Number.isFinite(Number(range?.min)) ? Number(range.min) : 0,
        max: Number.isFinite(Number(range?.max)) ? Number(range.max) : 1_000_000,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      const server = resp.headers.get("x-predajto-server") || "";
      const ct = resp.headers.get("content-type") || "";
      const meta = `${server ? ` server=${server}` : ""}${ct ? ` ct=${ct}` : ""}`;
      const body = t ? t.slice(0, 280) : "(empty body)";
      throw new Error(`API ${resp.status}:${meta} ${body}`);
    }
    const data = await resp.json();
    if (!data?.ok) throw new Error(data?.error || "API error");
    return data.data;
  };

  const updateDealMeter = (sellerPrice, recommended) => {
    const dealStatusEl = qs("[data-deal-status]");
    const meterFillEl = qs("[data-meter-fill]");
    const dealLabelEl = qs(".dealMeter__label");
    const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";

    if (!dealStatusEl || !meterFillEl) return;

    if (sellerPrice > 0 && recommended > 0) {
      const diff = ((sellerPrice - recommended) / recommended) * 100;
      let status = "FÉROVÁ CENA";
      let color = "var(--orange)";

      if (dealLabelEl) {
        dealLabelEl.textContent = currentMode === "sell" ? "Výhodnosť Predaja" : "Výhodnosť Kúpy";
      }
      
      let posPct = 50 - (diff * 2); 
      posPct = Math.min(95, Math.max(5, posPct));

      if (diff < -5) {
        status = currentMode === "sell" ? "RÝCHLY PREDAJ" : `SKVELÁ CENA (Ušetríš ${Math.round(recommended - sellerPrice)}€)`;
        color = "var(--green)";
      } else if (diff > 5) {
        status = currentMode === "sell" ? "NÍZKA ŠANCA NA PREDAJ" : "PREDRAŽENÉ";
        color = "var(--red)";
      }

      dealStatusEl.textContent = status;
      dealStatusEl.style.color = color;
      meterFillEl.style.left = `${posPct}%`;
      console.log(`🚥 Deal Meter Updated: Pos=${posPct}%, Status=${status}`);
    } else {
      dealStatusEl.textContent = "ZADAJTE ÚDAJE...";
      dealStatusEl.style.color = "var(--muted)";
      meterFillEl.style.left = "0%";
    }
  };

  const applyPricesToUI = (prices) => {
    console.log("💰 applyPricesToUI called with:", prices);
    
    if (!prices) {
      console.warn("⚠️ No prices provided to applyPricesToUI");
      return;
    }
    
    // Check for insufficient data
    if (prices.insufficientData === true) {
      console.log("⚠️ Insufficient data - not showing price");
      
      // Show "—" instead of price
      const mainPriceEl = qs("[data-price]");
      const resultPriceEl = qs("[data-result-price]");
      const currencyEls = document.querySelectorAll(".estimate__currency, .result__eur, .seg__eur");
      
      if (mainPriceEl) mainPriceEl.textContent = "—";
      if (resultPriceEl) resultPriceEl.textContent = "—";
      
      // Hide currency symbols
      currencyEls.forEach(el => el.setAttribute("hidden", ""));
      
      // Hide price disclaimer
      const disclaimerEl = qs(".result__priceDisclaimer");
      if (disclaimerEl) disclaimerEl.setAttribute("hidden", "");
      
      // Keep slider and edit section ACTIVE
      if (range) {
        range.removeAttribute("disabled");
        range.value = "0";
      }
      if (editRequestInput) editRequestInput.disabled = false;
      if (editSubmitBtn) editSubmitBtn.disabled = false;
      
      // Clear segmented cards
      if (quickPriceEl) quickPriceEl.textContent = "—";
      if (marketPriceEl) marketPriceEl.textContent = "—";
      if (premiumPriceEl) premiumPriceEl.textContent = "—";
      
      return;
    }
    
    const recommended = Number(
      prices.price_recommended ?? prices.recommended ?? prices.fair ?? prices.market ?? 0
    );
    const quick = Number(prices.price_quick ?? prices.quick ?? prices.price_low ?? 0);
    const premium = Number(prices.price_max ?? prices.premium ?? prices.price_high ?? 0);
    const market = Math.max(Number(prices.market ?? recommended), quick); // 🛡️ Fix: Market price cannot be lower than 'price from' (quick)
    
    console.log(`✅ Applying prices: Quick=${quick}€, Market=${market}€, Premium=${premium}€, Recommended=${recommended}€`);
    
    const rangeMinLabel = qs("[data-range-min-label]");
    const rangeMaxLabel = qs("[data-range-max-label]");

    // Show currency symbols (in case they were hidden)
    const currencyEls = document.querySelectorAll(".estimate__currency, .result__eur, .seg__eur");
    currencyEls.forEach(el => {
      el.removeAttribute("hidden");
      console.log("🔓 Currency symbol shown:", el);
    });
    
    // Show price disclaimer
    const disclaimerEl = qs(".result__priceDisclaimer");
    if (disclaimerEl) {
      disclaimerEl.removeAttribute("hidden");
      console.log("🔓 Price disclaimer shown");
    }
    
    // Enable slider
    if (range) {
      range.removeAttribute("disabled");
    }

    if (range) {
      // Requested: slider range derived from backend prices
      const step = Number(range.step || 5) || 5;
      const roundToStep = (v) => Math.round(v / step) * step;
      const min = Number.isFinite(quick) && quick > 0 ? Math.max(0, roundToStep(quick - 50)) : Number(range.min || 0);
      const max = Number.isFinite(premium) && premium > 0 ? Math.max(min + step, roundToStep(premium + 50)) : Number(range.max || 0);
      if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
        range.min = String(min);
        range.max = String(max);
        if (rangeMinLabel) rangeMinLabel.textContent = `${min} €`;
        if (rangeMaxLabel) rangeMaxLabel.textContent = `${max} €`;
      }
      if (Number.isFinite(recommended) && recommended > 0) {
        range.value = String(roundToStep(recommended));
      }
    }

    // Main price (in result section AND estimate section)
    const mainPriceEl = qs("[data-price]");
    const resultPriceEl = qs("[data-result-price]");
    if (mainPriceEl && Number.isFinite(recommended) && recommended > 0) {
      mainPriceEl.textContent = String(recommended);
    }
    if (resultPriceEl && Number.isFinite(recommended) && recommended > 0) {
      resultPriceEl.textContent = String(recommended);
    }

    // 🆕 UPDATE 4-CARD GRID BARS TOO
    const bars = document.querySelectorAll('.priceChart__bar');
    const labels = document.querySelectorAll('.priceChart__bar span');
    if (labels.length >= 3) {
      const maxPrice = Math.max(market, recommended, quick) || 1;
      const getH = (p) => Math.round((p / maxPrice) * 90);

      labels[0].innerText = `${Math.round(quick)}€`;
      bars[0].style.height = `${getH(quick)}%`;
      
      labels[1].innerText = `${Math.round(recommended)}€`;
      bars[1].style.height = `${getH(recommended)}%`;
      
      labels[2].innerText = `${Math.round(market)}€`;
      bars[2].style.height = `${getH(market)}%`;
    }

    // 🆕 UPDATE VERDICT IN 4-CARD GRID
    const verdictBadge = qs(".verdictBox__badge");
    const verdictText = qs(".verdictBox__text");
    const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
    const sellerPrice = Number(qs(currentMode === "sell" ? "[data-expected-price]" : "[data-seller-price]")?.value || 0);

    if (verdictBadge && verdictText) {
      if (sellerPrice > 0) {
        const diff = recommended - sellerPrice;
        const isSell = currentMode === "sell";

        if (diff > 20) {
          verdictBadge.innerText = isSell ? "RÝCHLY PREDAJ" : "TOP PONUKA";
          verdictBadge.style.background = "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
          verdictBadge.style.color = "#ffffff";
          verdictText.innerText = isSell 
            ? `Vaša cena je o ${Math.round(diff)}€ nižšia ako trhový priemer. Zariadenie predáte veľmi rýchlo.`
            : `Toto zariadenie odporúčame kúpiť. Vaša cena je o ${Math.round(diff)}€ nižšia ako férová trhová cena.`;
        } else if (diff < -20) {
          verdictBadge.innerText = isSell ? "VYSOKÁ CENA" : "PREDRAŽENÉ";
          verdictBadge.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
          verdictBadge.style.color = "#ffffff";
          verdictText.innerText = isSell
            ? `Vaša cena je o ${Math.round(Math.abs(diff))}€ vyššia ako odporúčaná predajná cena. Skúste urobiť kompromis.`
            : `Cena je o ${Math.round(Math.abs(diff))}€ vyššia ako férová trhová cena. Skúste vyjednať zľavu.`;
        } else {
          verdictBadge.innerText = isSell ? "OPTIMÁLNA CENA" : "DOBRÁ CENA";
          verdictBadge.style.background = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)";
          verdictBadge.style.color = "#ffffff";
          verdictText.innerText = isSell
            ? `Vaša cena presne zodpovedá stavu a situácii na trhu. Ideálny balans pre predaj.`
            : `Cena zodpovedá aktuálnemu stavu zariadenia a situácii na trhu.`;
        }
      } else {
        verdictBadge.innerText = "ANALÝZA HOTOVÁ";
        const isSellMode = currentMode === "sell";
        if (isSellMode) {
          const deviceConditionInput = qs("[data-device-condition]");
          const conditionPct = Number(deviceConditionInput?.value) || 100;
          const batteryInput = qs("[data-battery-health-sell]");
          const batteryVal = Number(batteryInput?.value) || 100;

          verdictText.innerHTML = `Vaša odporúčaná predajná cena je <strong>${Math.round(recommended)}€</strong>.<br>
            <span style="font-size: 11px; opacity: 0.7; margin-top: 5px; display: block;">
              💡 Výpočet zohľadňuje vami zadaný vizuálny stav (${conditionPct}%) a zdravie batérie (${batteryVal}%).
            </span>`;
        } else {
          verdictText.innerHTML = `Férová bazárová cena pre toto zariadenie je približne <strong>${Math.round(recommended)}€</strong>.<br>
            <span style="font-size: 11px; opacity: 0.7; margin-top: 5px; display: block;">
              💡 Táto cena platí pre model v <strong>TOP stave</strong> (bez škrabancov, batéria 100 %). Ak je telefón obúchaný alebo má slabšiu batériu, odporúčaná cena úmerne klesá.
            </span>`;
        }
      }
    }

    // 🚥 Update Deal Meter
    updateDealMeter(sellerPrice, recommended);

    // Segmented cards under slider
    if (quickPriceEl && Number.isFinite(quick) && quick > 0) quickPriceEl.textContent = String(quick);
    if (marketPriceEl && Number.isFinite(market) && market > 0) marketPriceEl.textContent = String(market);
    if (premiumPriceEl && Number.isFinite(premium) && premium > 0) premiumPriceEl.textContent = String(premium);

    // 🆕 UPDATE GOOGLE SHOPPING LINK (Focus on Heureka results via Google)
    const googleShoppingLink = qs("[data-google-shopping-link]");
    if (googleShoppingLink) {
      const productName = (qs("[data-product-name]")?.value ?? "").trim();
      if (productName) {
        // Query focused on finding Heureka listings through Google Shopping/Search
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(productName + ' site:heureka.sk')}&tbm=shop`;
        googleShoppingLink.href = googleUrl;
        googleShoppingLink.hidden = false;
        
        // Also update text to mention Heureka explicitly if it fits the UI
        if (googleShoppingLink.querySelector(".btn-text")) {
          googleShoppingLink.querySelector(".btn-text").textContent = "Overiť na Heureke (cez Google)";
        }
        
        console.log(`🔗 Google-to-Heureka link updated: ${googleUrl}`);
      } else {
        googleShoppingLink.hidden = true;
      }
    }

    // Re-run local sync so slider fill / pct / active card update consistently
    if (range) range.dispatchEvent(new Event("input", { bubbles: true }));
    refreshAxisFromDom();
  };

  const applySimilarAdsToUI = (similarAds, options = {}) => {
    // NO FILTERING - show ALL ads (removed Heureka filter)
    const arr = Array.isArray(similarAds) ? similarAds : [];
    const list = qs("[data-similar-list]");
    const section = qs("[data-similar-section]");
    if (!list) return;
    
    // Clear list
    list.innerHTML = "";

    if (arr.length === 0) {
      if (section) section.setAttribute("hidden", "");
      return;
    }

    if (section) section.removeAttribute("hidden");
    
    // 🆕 ULTRA AGGRESSIVE DEDUPLICATION
    const uniqueAds = [];
    const seenKeys = new Set();
    
    // Helper: Normalize text for comparison
    const normalize = (text) => {
      return String(text || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')           // Multiple spaces → single space
        .replace(/[|:;,\-–—]/g, ' ')    // Special chars → space
        .replace(/\s+/g, ' ')           // Clean up again
        .replace(/[^\w\s]/g, '')        // Remove all non-alphanumeric except spaces
        .trim();
    };
    
    for (const ad of arr) {
      const url = String(ad?.url || "").trim().toLowerCase();
      const title = String(ad?.title || "").trim();
      const price = Number(ad?.price || 0);
      
      if (!title || price <= 0) continue;
      
      // Create normalized key for aggressive matching
      const normalizedTitle = normalize(title);
      const titlePriceKey = `${normalizedTitle}_${price}`;
      
      // Multiple deduplication strategies
      const isDuplicate = 
        (url && seenKeys.has(`url_${url}`)) ||           // 1. Same URL
        seenKeys.has(`tp_${titlePriceKey}`) ||           // 2. Same normalized title + price
        seenKeys.has(`t_${normalizedTitle}`);            // 3. Same normalized title (regardless of price)
      
      if (isDuplicate) {
        console.log(`🚫 Duplicate: "${title}" (${price}€)`);
        continue;
      }
      
      if (url) seenKeys.add(`url_${url}`);
      seenKeys.add(`tp_${titlePriceKey}`);
      seenKeys.add(`t_${normalizedTitle}`);
      uniqueAds.push(ad);
    }

    // Populate list with premium cards
    uniqueAds.slice(0, 6).forEach(ad => {
      const card = document.createElement("div");
      card.className = "similarCardPremium";
      card.innerHTML = `
        <div class="similarCardPremium__price">${ad.price} €</div>
        <div class="similarCardPremium__title">${ad.title}</div>
      `;
      if (ad.url) {
        card.addEventListener("click", () => window.open(ad.url, "_blank"));
      }
      list.appendChild(card);
    });

    console.log(`🔍 ULTRA Deduplicated: `, uniqueAds.length);
    
    // 🆕 GOOGLE SHOPPING FALLBACK NOTICE
    const googleNotice = qs("[data-google-notice]");
    const googleLink = qs("[data-google-link]");
    if (googleNotice && options.googleFallback) {
      googleNotice.hidden = false;
      if (googleLink && options.googleSearchUrl) {
        googleLink.href = options.googleSearchUrl;
      }
    } else if (googleNotice) {
      googleNotice.hidden = true;
    }

    const heurekaCard = list.querySelector(".similarItem[data-ad-source='heureka']");
    const moreBtn = Array.from(list.children).find((n) => n?.classList?.contains("ghostBtn")) || null;

    // Remove old similar items
    Array.from(list.querySelectorAll(".similarItem")).forEach((el) => el.remove());

    const makeSourceChip = (source) => {
      const chip = document.createElement("div");
      chip.className = "similarItem__source";
      chip.setAttribute("aria-label", `Zdroj: ${source === "bazos" ? "Bazoš" : "Marketplace"}`);
      const icon = document.createElement("span");
      icon.className = "sourceIcon";
      icon.setAttribute("aria-hidden", "true");
      icon.innerHTML =
        source === "bazos"
          ? "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm7 9c0 .7-.1 1.3-.3 1.9h-3.3a16 16 0 0 0 0-3.8h3.3c.2.6.3 1.2.3 1.9ZM10.1 5.4c-.8 1.1-1.4 2.7-1.7 4.7H5.3a7 7 0 0 1 4.8-4.7ZM5.3 13.9h3.1c.3 2 .9 3.6 1.7 4.7a7 7 0 0 1-4.8-4.7Zm6.7 4.9c-1 0-2-1.9-2.4-4.9h4.8c-.4 3-1.4 4.9-2.4 4.9Zm2.4-8.7H9.6c.4-3 1.4-4.9 2.4-4.9s2 1.9 2.4 4.9Zm2.3-4.7a7 7 0 0 1 2 4.7h-3.1c-.3-2-.9-3.6-1.7-4.7.9.3 1.9.8 2.8 1.7Zm-2.8 13.2c.8-1.1 1.4-2.7 1.7-4.7h3.1a7 7 0 0 1-4.8 4.7Zm.7-8.7a14 14 0 0 1 0 3.8H9.4a14 14 0 0 1 0-3.8h5.2Z'/></svg>"
          : "<svg viewBox='0 0 24 24'><path fill='currentColor' d='M7 7V6a5 5 0 0 1 10 0v1h2a1 1 0 0 1 1 1l-1.2 12a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 8a1 1 0 0 1 1-1h2Zm2 0h6V6a3 3 0 0 0-6 0v1Zm-2.9 2 1 10.2c0 .4.4.8.9.8h9.6c.5 0 .9-.4.9-.8L19 9H6.1Z'/></svg>";
      const txt = document.createElement("span");
      txt.className = "sourceText";
      txt.textContent = source === "bazos" ? "Bazoš" : "Marketplace";
      chip.appendChild(icon);
      chip.appendChild(txt);
      return chip;
    };

    const makeCard = (a, idx) => {
      const title = String(a?.title || "").trim();
      const price = Number(a?.price || 0);
      const cond = Number(a?.condition || 90);
      const source =
        a?.source === "marketplace" ? "marketplace" : a?.source === "bazos" ? "bazos" : "bazos";
      if (!title || !Number.isFinite(price) || price <= 0) return null;

      // Check if ad matches user's specific query (e.g. "Pro" vs "Air")
      const userQuery = (qs("[data-product-name]")?.value ?? "").trim().toLowerCase();
      const titleLower = title.toLowerCase();
      const queryWords = userQuery.split(/\s+/).filter(w => w.length > 2);
      
      // If user specified specific model keywords, check if this ad matches
      const specificKeywords = ["pro", "air", "mini", "max", "plus", "ultra"];
      const userSpecificWords = queryWords.filter(w => specificKeywords.includes(w));
      let isSimilar = false;
      
      if (userSpecificWords.length > 0) {
        // User specified a specific model (e.g. "Pro")
        // Check if this ad has that model
        const hasAllSpecificWords = userSpecificWords.every(w => titleLower.includes(w));
        isSimilar = !hasAllSpecificWords; // Mark as similar if it doesn't match specific model
      }

      // If backend provides real URL, use it (verifiable). Otherwise fall back to search.
      const url = String(a?.url || "").trim();
      const q = encodeURIComponent(title);
      const href = url
        ? url
        : source === "bazos"
          ? `https://www.bazos.sk/hledat/?hledat=${q}`
          : `https://www.facebook.com/marketplace/search/?query=${q}`;

      const card = document.createElement("a");
      card.className = isSimilar ? "similarItem similarItem--similar" : "similarItem";
      card.href = href;
      card.target = "_blank";
      card.rel = "noreferrer noopener";
      card.setAttribute("role", "listitem");
      card.setAttribute("aria-label", `${title} ${isSimilar ? "(podobný inzerát)" : ""}`);
      card.dataset.adId = `${source}-${idx + 1}`;
      card.dataset.adPrice = String(Math.round(price));
      card.dataset.adCondition = String(Math.round(cond));
      card.dataset.adSource = source;
      card.dataset.isSimilar = isSimilar ? "true" : "false";

      const thumb = document.createElement("span");
      thumb.className = "thumb";
      thumb.setAttribute("aria-hidden", "true");
      const ring = document.createElement("span");
      ring.className = "thumb__ring";
      thumb.appendChild(ring);

      const meta = document.createElement("div");
      meta.className = "similarItem__meta";
      const left = document.createElement("div");
      left.className = "similarItem__left";
      const nameEl = document.createElement("div");
      nameEl.className = "similarItem__name";
      nameEl.textContent = title;
      const row = document.createElement("div");
      row.className = "similarItem__row";
      const badge = document.createElement("div");
      badge.className = "similarItem__badge";
      badge.textContent = `Stav: ${Math.round(cond)} %`;
      row.appendChild(badge);
      row.appendChild(makeSourceChip(source));
      
      // Add "Podobné" badge for similar (not exact match) ads
      if (isSimilar) {
        const similarBadge = document.createElement("div");
        similarBadge.className = "similarItem__badge similarItem__badge--similar";
        similarBadge.textContent = "⚡ Podobné";
        similarBadge.title = "Tento inzerát neobsahuje všetky špecifické kľúčové slová z vášho vyhľadávania";
        row.appendChild(similarBadge);
      }
      
      left.appendChild(nameEl);
      left.appendChild(row);

      const priceEl = document.createElement("div");
      priceEl.className = "similarItem__price";
      priceEl.textContent = `${Math.round(price)} €`;

      meta.appendChild(left);
      meta.appendChild(priceEl);

      card.appendChild(thumb);
      card.appendChild(meta);
      return card;
    };

    // 🔧 FIX: Use deduplicated array
    const toInsert = uniqueAds.slice(0, 20).map(makeCard).filter(Boolean);

    // Insert after heureka card (if present), before "Zobraziť viac"
    const anchor = moreBtn || null;
    for (const el of toInsert) {
      if (anchor) list.insertBefore(el, anchor);
      else list.appendChild(el);
    }
    if (heurekaCard && anchor) {
      // ensure heureka stays on top
      list.insertBefore(heurekaCard, list.firstChild);
    }

    refreshAxisFromDom();
  };

  // Beta email gate helper
  const getBetaEmail = () => {
    const emailInput = qs("[data-beta-email]");
    const email = emailInput?.value?.trim() || "";
    return email;
  };

  const saveBetaEmail = (email) => {
    try {
      localStorage.setItem("predajto_beta_email", email);
    } catch {}
  };

  const loadBetaEmail = () => {
    try {
      const saved = localStorage.getItem("predajto_beta_email");
      if (saved) {
        const emailInput = qs("[data-beta-email]");
        if (emailInput) emailInput.value = saved;
      }
      return saved || "";
    } catch {
      return "";
    }
  };
  
  // GDPR consent helper
  const isGdprConsentGiven = () => {
    const checkbox = qs("[data-gdpr-checkbox]");
    return checkbox?.checked || false;
  };

  const validateEmail = (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  // Send beta signup notification to backend (only once per email)
  const sendBetaSignupNotification = async (email) => {
    // Check if we already sent notification for this email
    const notifiedKey = "predajto_beta_notified";
    try {
      const alreadyNotified = localStorage.getItem(notifiedKey);
      if (alreadyNotified === email) {
        return; // Already notified
      }
    } catch {}

    // Get product name if available
    const productName = qs("[data-product-name]")?.value?.trim() || "";

    try {
      const response = await apiFetch("/api/beta-signup", {
        method: "POST",
        body: JSON.stringify({ email, productName }),
      });

      if (response.ok) {
        // Mark as notified
        try {
          localStorage.setItem(notifiedKey, email);
        } catch {}
      }
    } catch (err) {
      // Silent fail - this is background operation
    }
  };

  // Load saved email on page load
  loadBetaEmail();

  // Tooltip/hint on hover over generate button
  generateBtn?.addEventListener("mouseenter", () => {
    const email = getBetaEmail();
    const productName = qs("[data-product-name]")?.value?.trim() || "";
    const productNotes = qs("[data-product-notes]")?.value?.trim() || "";
    const hasImage = !!uploadedImageDataUrl;
    const gdprConsent = isGdprConsentGiven();
    
    const missing = [];
    if (!hasImage) missing.push("fotku produktu");
    if (!productName) missing.push("názov produktu");
    if (productNotes.length < 10) missing.push("popis produktu (min. 10 znakov)");
    if (!email) missing.push("email");
    else if (!validateEmail(email)) missing.push("platný email");
    if (!gdprConsent) missing.push("súhlas so spracovaním údajov");
    
    if (missing.length > 0) {
      const msg = `💡 Doplňte: ${missing.join(", ")} a pokračujte`;
      showToast(msg, { type: "info", duration: 3000 });
    }
  });

  generateBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    
    if (generateBtn.disabled) return;

    // ⚠️ VALIDATION: Category and Model must be selected
    const currentCat = categorySelect?.value || qs(".catItem.is-active")?.dataset.catType;
    const currentModel = modelSelect?.value;

    if (!currentCat || !currentModel) {
      showToast("⚠️ Prosím, vyberte kategóriu a model zariadenia.", { type: "error" });
      // Shake the inputs for visual feedback
      const wrapper = qs(".model-selection-wrapper");
      if (wrapper) {
        wrapper.style.animation = "shake 0.5s ease";
        setTimeout(() => wrapper.style.animation = "", 500);
      }
      return;
    }

    // 💳 PAYMENT CHECK (TEST MODE) - Vždy vyžadovať pre testovacie účely
    if (!isTestPaid) {
      openPricingModal();
      window._pendingAnalysis = true; // Flag to resume this specific analysis
      return;
    }
    
    // 🆕 AUDITLYIO: Loading Overlay Logic
    const overlay = qs("[data-report-overlay]");
    const overlayIcon = qs(".reportOverlay__icon", overlay);
    const overlayText = qs(".reportOverlay__text", overlay);
    const overlayLoader = qs(".reportOverlay__loader", overlay);

    if (overlay) {
      // 1. Show loader with clear visual feedback
      if (overlayIcon) overlayIcon.hidden = true;
      if (overlayText) overlayText.hidden = true;
      if (overlayLoader) {
        overlayLoader.hidden = false;
        overlayLoader.style.display = "flex";
        overlayLoader.style.flexDirection = "column";
        overlayLoader.style.alignItems = "center";
        overlayLoader.style.justifyContent = "center";
      }
      overlay.classList.remove("is-hidden"); // Ensure it's visible
    }

    // Add loading class to button
    generateBtn.classList.add("is-loading");
    const originalBtnText = generateBtn.textContent;
    generateBtn.innerHTML = `<span class="spinner-mini"></span> Analyzujem...`;
    generateBtn.disabled = true;

    // Beta gate: require email before first generation
    const email = getBetaEmail();
    
    if (!email) {
      if (overlay) {
        if (overlayIcon) overlayIcon.hidden = false;
        if (overlayText) overlayText.hidden = false;
        if (overlayLoader) overlayLoader.hidden = true;
      }
      showToast("📧 Zadajte email a pokračujte v beta verzii zadarmo.", { type: "error", duration: 4000 });
      const emailInput = qs("[data-beta-email]");
      emailInput?.focus();
      return;
    }
    
    if (!validateEmail(email)) {
      if (overlay) {
        if (overlayIcon) overlayIcon.hidden = false;
        if (overlayText) overlayText.hidden = false;
        if (overlayLoader) overlayLoader.hidden = true;
      }
      showToast("❌ Prosím, zadajte platnú emailovú adresu.", { type: "error", duration: 3000 });
      const emailInput = qs("[data-beta-email]");
      emailInput?.focus();
      return;
    }
    
    // GDPR consent check
    if (!isGdprConsentGiven()) {
      if (overlay) {
        if (overlayIcon) overlayIcon.hidden = false;
        if (overlayText) overlayText.hidden = false;
        if (overlayLoader) overlayLoader.hidden = true;
      }
      showToast("⚖️ Prosím, súhlaste so spracovaním osobných údajov.", { type: "error", duration: 4000 });
      const gdprCheckbox = qs("[data-gdpr-checkbox]");
      gdprCheckbox?.focus();
      return;
    }

    // 🆕 AUDITLYIO: Scroll to results on mobile
    if (window.innerWidth <= 1024) {
      qs(".rightCol")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 2. Simulate analysis delay (1.5 seconds as requested)
    await sleep(1500);

    // 3. Reveal results
    if (overlay) {
      overlay.classList.add("is-hidden");
    }

    // Reset button state
    generateBtn.classList.remove("is-loading");
    generateBtn.textContent = originalBtnText;
    generateBtn.disabled = false;

    const resultsCol = qs("[data-results-column]");
    if (resultsCol) {
      resultsCol.classList.add("is-visible");
      
      // Optional: Hide empty state if it's there
      const emptyState = qs(".reportEmptyState");
      if (emptyState) emptyState.style.display = "none";

      // Show the public audit button if in sell mode
      const currentAuditMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
      const isSellMode = currentAuditMode === "sell";
      const directPreviewBtn = qs("[data-preview-public-direct]");
      if (directPreviewBtn) {
        directPreviewBtn.hidden = !isSellMode;
        directPreviewBtn.style.display = isSellMode ? "block" : "none";
      }
    }
    
    // Save email for future use
    saveBetaEmail(email);
    
    // Send beta signup notification to backend
    sendBetaSignupNotification(email);
    
    // 🆕 AUDITLYIO: Input Validation
    const batteryVal = Number(batteryHealthInput?.value);
    const priceVal = Number(sellerPriceInput?.value);
    const catBtn = qs(".catItem.is-active");
    const catType = catBtn?.dataset.catType;

    if ((catType === "mobile" || catType === "laptop") && batteryHealthInput?.value) {
      if (batteryVal < 0 || batteryVal > 100) {
        showToast("⚠️ Zdravie batérie musí byť medzi 0 a 100%", { type: "error" });
        batteryHealthInput.focus();
        // Show overlay back if error
        if (overlay) {
          overlay.classList.remove("is-hidden");
          if (overlayIcon) overlayIcon.hidden = false;
          if (overlayText) overlayText.hidden = false;
          if (overlayLoader) overlayLoader.hidden = true;
        }
        return;
      }
    }

    if (sellerPriceInput?.value && priceVal < 0) {
      showToast("⚠️ Cena predajcu nemôže byť záporná", { type: "error" });
      sellerPriceInput.focus();
      // Show overlay back if error
      if (overlay) {
        overlay.classList.remove("is-hidden");
        if (overlayIcon) overlayIcon.hidden = false;
        if (overlayText) overlayText.hidden = false;
        if (overlayLoader) overlayLoader.hidden = true;
      }
      return;
    }

    // Continue with generation
    fetchHeurekaPrice();
    
    void evaluateFlow({ mode: "manual" });
  });

  // 📱 HIDE RAM FOR IPHONES
  const ramSelect = qs("[data-ram-select]");

  productNameInput?.addEventListener("input", (e) => {
    const val = e.target.value.toLowerCase();
    if (ramSelect) {
      if (val.includes("iphone")) {
        ramSelect.style.display = "none";
        ramSelect.value = ""; // Reset value
      } else {
        ramSelect.style.display = "block";
      }
    }
  });
  
  evaluateBtn?.addEventListener("click", (e) => {
    e.preventDefault(); // Prevent any default behavior
    e.stopPropagation(); // Stop event bubbling
    
    // Beta gate: require email before first generation
    const email = getBetaEmail();
    
    if (!email) {
      showToast("📧 Zadajte email a pokračujte v beta verzii zadarmo.", { type: "error", duration: 4000 });
      const emailInput = qs("[data-beta-email]");
      emailInput?.focus();
      return;
    }
    
    if (!validateEmail(email)) {
      showToast("❌ Prosím, zadajte platnú emailovú adresu.", { type: "error", duration: 3000 });
      const emailInput = qs("[data-beta-email]");
      emailInput?.focus();
      return;
    }
    
    // GDPR consent check
    if (!isGdprConsentGiven()) {
      showToast("⚖️ Prosím, súhlaste so spracovaním osobných údajov.", { type: "error", duration: 4000 });
      const gdprCheckbox = qs("[data-gdpr-checkbox]");
      gdprCheckbox?.focus();
      return;
    }

    // 🆕 AUDITLYIO: Scroll to results on mobile
    if (window.innerWidth <= 1024) {
      qs(".rightCol")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    // 🆕 AUDITLYIO: Trigger fade-in for right column
    const resultsCol = qs("[data-results-column]");
    if (resultsCol) {
      resultsCol.classList.add("is-visible");
      
      // Optional: Hide empty state if it's there
      const emptyState = qs(".reportEmptyState");
      if (emptyState) emptyState.style.display = "none";
    }
    
    // Save email for future use
    saveBetaEmail(email);
    
    // Send beta signup notification to backend
    sendBetaSignupNotification(email);
    
    // 🆕 AUDITLYIO: Input Validation
    const batteryVal = Number(batteryHealthInput?.value);
    const priceVal = Number(sellerPriceInput?.value);
    const catBtn = qs(".catItem.is-active");
    const catType = catBtn?.dataset.catType;

    if ((catType === "mobile" || catType === "laptop") && batteryHealthInput?.value) {
      if (batteryVal < 0 || batteryVal > 100) {
        showToast("⚠️ Zdravie batérie musí byť medzi 0 a 100%", { type: "error" });
        batteryHealthInput.focus();
        return;
      }
    }

    if (sellerPriceInput?.value && priceVal < 0) {
      showToast("⚠️ Cena predajcu nemôže byť záporná", { type: "error" });
      sellerPriceInput.focus();
      return;
    }

    evaluateFlow({ mode: "manual" });
  });

  /**
   * Price Category Selection Modal - For extreme price variance
   */
  const priceCategoryModal = qs("[data-price-category-modal]");
  const priceCategoryList = qs("[data-price-category-list]");
  const priceCategoryCancelBtn = qs("[data-price-category-cancel]");
  const priceCategoryCloseEls = document.querySelectorAll("[data-price-category-close]");
  
  const showPriceCategoryModal = (pricing) => {
    return new Promise((resolve) => {
      if (!priceCategoryModal || !priceCategoryList) {
        console.warn("Price category modal not found");
        resolve(null);
        return;
      }
      
      const categories = pricing.priceCategories;
      if (!categories) {
        console.warn("No price categories provided");
        resolve(null);
        return;
      }
      
      // Render category options
      priceCategoryList.innerHTML = "";
      
      const categoryKeys = ["low", "mid", "high"];
      const categoryIcons = {
        low: "🏃 ",
        mid: "⭐ ",
        high: "💎 "
      };
      
      for (const key of categoryKeys) {
        const cat = categories[key];
        if (!cat || !cat.price) continue;
        
        const option = document.createElement("div");
        option.className = "priceCategoryOption";
        option.dataset.categoryKey = key;
        
        const icon = categoryIcons[key] || "";
        const rangeText = cat.range && cat.range.length === 2 
          ? `€${cat.range[0]} - €${cat.range[1]}`
          : "";
        const countText = cat.count ? `${cat.count} výsledkov` : "";
        
        option.innerHTML = `
          <div class="priceCategoryOption__header">
            <span class="priceCategoryOption__label">${icon}${cat.label || key}</span>
            <span class="priceCategoryOption__price">€${cat.price}</span>
          </div>
          <div class="priceCategoryOption__details">
            ${rangeText ? `<div class="priceCategoryOption__range">Rozsah: ${rangeText}</div>` : ""}
            ${countText ? `<div class="priceCategoryOption__count">Založené na: ${countText}</div>` : ""}
          </div>
        `;
        
        option.addEventListener("click", () => {
          // Close modal
          if (priceCategoryModal) priceCategoryModal.setAttribute("hidden", "");
          document.body.style.overflow = "";
          
          // Resolve with selected category
          resolve({
            key,
            price: cat.price,
            range: cat.range,
            label: cat.label,
            count: cat.count
          });
        });
        
        priceCategoryList.appendChild(option);
      }
      
      // Open modal
      priceCategoryModal.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      
      // Handle cancel
      const handleCancel = () => {
        if (priceCategoryModal) priceCategoryModal.setAttribute("hidden", "");
        document.body.style.overflow = "";
        resolve(null);
      };
      
      priceCategoryCancelBtn?.addEventListener("click", handleCancel, { once: true });
      priceCategoryCloseEls.forEach(el => {
        el.addEventListener("click", handleCancel, { once: true });
      });
    });
  };
  
  /**
   * Review Modal - Let user verify and filter similar ads before final price calculation
   */
  const reviewModal = qs("[data-review-modal]");
  const reviewList = qs("[data-review-list]");
  const reviewPrice = qs("[data-review-price]");
  const reviewCount = qs("[data-review-count]");
  const reviewWarning = qs("[data-review-warning]");
  const reviewFeedback = qs("[data-review-feedback]");
  const reviewBadge = qs("[data-review-badge]");
  const reviewConfirmBtn = qs("[data-review-confirm]");
  const reviewCancelBtn = qs("[data-review-cancel]");
  const reviewCloseEls = document.querySelectorAll("[data-review-close]");
  const reopenFiltersBtn = qs("[data-reopen-filters]"); // 🆕 Button to reopen filters after generation
  
  let reviewData = null; // Store current review data
  let _filteredAdsInternal = []; // Ads after user filtering (internal)
  let retryCount = 0; // Track retry attempts
  const MAX_RETRIES = 2;
  let lastGeneratedData = null; // 🆕 Store last generation result (for re-filtering without regeneration)
  let currentActiveFilters = { ram: null, ssd: null, year: null }; // 🆕 Store current filter state
  let currentApiResponse = null; // 🆕 Store current API response for reactive updates
  let currentCondition = 'used'; // 🆕 Device condition (new, used, damaged)
  
  // 🆕 BLACKLIST: Store removed ads permanently (never show again)
  const removedAdsBlacklist = new Set(); // Store URLs of removed ads
  
  // 🆕 PRICE FLOOR: Minimum price based on user's manual selection
  let minPriceFloor = 0; // If user removes cheap ads, don't show them again
  
  // 🆕 HELPER: Filter out blacklisted ads
  const filterBlacklisted = (ads) => {
    if (removedAdsBlacklist.size === 0) return ads;
    const filtered = ads.filter(ad => !removedAdsBlacklist.has(ad?.url));
    if (filtered.length < ads.length) {
      console.log(`🚫 Filtered out ${ads.length - filtered.length} blacklisted ads`);
    }
    return filtered;
  };
  
  // 🆕 CALCULATE PRICE BASED ON CONDITION
  const calculatePriceByCondition = (prices, condition) => {
    if (prices.length < 4) {
      // Not enough data for trimming - use simple average
      const sum = prices.reduce((acc, p) => acc + p, 0);
      return {
        fairPrice: Math.round(sum / prices.length),
        adsUsed: prices.length,
        method: 'simple_average'
      };
    }
    
    const trimPercent = 0.30;
    const trimCount = Math.floor(prices.length * trimPercent);
    const lowerPrices = prices.slice(0, trimCount); // Bottom 30%
    const middlePrices = prices.slice(trimCount, prices.length - trimCount); // Middle 40%
    const upperPrices = prices.slice(prices.length - trimCount); // Top 30%
    
    let fairPrice, adsUsed, method;
    
    if (condition === 'new') {
      // ✨ AS NEW (A+): Use upper half of middle prices
      const upperMiddle = middlePrices.slice(Math.floor(middlePrices.length / 2));
      const sum = upperMiddle.reduce((acc, p) => acc + p, 0);
      fairPrice = Math.round(sum / upperMiddle.length);
      adsUsed = upperMiddle.length;
      method = 'upper_middle';
      console.log(`✨ AS NEW: Using upper middle range (${fairPrice}€ from ${adsUsed} ads)`);
    } else if (condition === 'damaged') {
      // ⚠️ DAMAGED (C): Use bottom 30% prices (much lower price)
      const sum = lowerPrices.reduce((acc, p) => acc + p, 0);
      const avgLower = sum / lowerPrices.length;
      fairPrice = Math.round(avgLower * 0.85); // Additional 15% discount
      adsUsed = lowerPrices.length;
      method = 'bottom_30pct_discounted';
      console.log(`⚠️ DAMAGED: Using bottom 30% with 15% discount (${fairPrice}€ from ${adsUsed} ads)`);
    } else {
      // ✓ USED (B): Use standard trimmed mean
      const sum = middlePrices.reduce((acc, p) => acc + p, 0);
      fairPrice = Math.round(sum / middlePrices.length);
      adsUsed = middlePrices.length;
      method = 'trimmed_mean_30pct';
      console.log(`✓ USED: Using trimmed mean (${fairPrice}€ from ${adsUsed} ads)`);
    }
    
    return { fairPrice, adsUsed, method };
  };
  
  // 🆕 SMART FILTER FUNCTIONS
  
  // Analyze data and get available specs from all fetched ads
  const getAvailableSpecs = (ads) => {
    const specs = {
      ram: new Set(),
      ssd: new Set(),
      year: new Set()
    };
    
    ads.forEach(ad => {
      const extracted = extractAdSpecs(ad.title, ad.description);
      if (extracted.ram) specs.ram.add(extracted.ram);
      if (extracted.ssd) specs.ssd.add(extracted.ssd);
      if (extracted.year) specs.year.add(extracted.year);
    });
    
    return {
      ram: Array.from(specs.ram).sort((a, b) => a - b),
      ssd: Array.from(specs.ssd).sort((a, b) => a - b),
      year: Array.from(specs.year).sort((a, b) => b - a)
    };
  };
  
  // Count occurrences of each spec value in ads
  const countOccurrences = (ads) => {
    const counts = {
      ram: {},
      ssd: {},
      year: {}
    };
    
    ads.forEach(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      if (specs.ram) {
        counts.ram[specs.ram] = (counts.ram[specs.ram] || 0) + 1;
      }
      if (specs.ssd) {
        counts.ssd[specs.ssd] = (counts.ssd[specs.ssd] || 0) + 1;
      }
      if (specs.year) {
        counts.year[specs.year] = (counts.year[specs.year] || 0) + 1;
      }
    });
    
    return counts;
  };
  
  // Update filter button states based on available data
  const refreshFilterStatus = (availableSpecs, counts) => {
    console.log(`🔧 refreshFilterStatus called`, { availableSpecs, counts });
    
    // Update RAM filters
    document.querySelectorAll("[data-filter-ram]").forEach(btn => {
      const value = parseInt(btn.dataset.filterRam, 10);
      const count = counts.ram[value] || 0;
      const isAvailable = availableSpecs.ram.includes(value);
      
      // Update count in button
      const countSpan = btn.querySelector('span');
      if (countSpan) {
        countSpan.textContent = `(${count})`;
      }
      
      // Disable if count is 0
      if (count === 0 || !isAvailable) {
        btn.disabled = true;
        btn.classList.add('disabled');
      } else {
        btn.disabled = false;
        btn.classList.remove('disabled');
      }
    });
    
    // Update SSD filters
    document.querySelectorAll("[data-filter-ssd]").forEach(btn => {
      const value = parseInt(btn.dataset.filterSsd, 10);
      const count = counts.ssd[value] || 0;
      const isAvailable = availableSpecs.ssd.includes(value);
      
      // Update count in button
      const countSpan = btn.querySelector('span');
      if (countSpan) {
        countSpan.textContent = `(${count})`;
      }
      
      // Disable if count is 0
      if (count === 0 || !isAvailable) {
        btn.disabled = true;
        btn.classList.add('disabled');
      } else {
        btn.disabled = false;
        btn.classList.remove('disabled');
      }
    });
    
    // Update Year filters
    document.querySelectorAll("[data-filter-year]").forEach(btn => {
      const value = parseInt(btn.dataset.filterYear, 10);
      const count = counts.year[value] || 0;
      const isAvailable = availableSpecs.year.includes(value);
      
      // Update count in button
      const countSpan = btn.querySelector('span');
      if (countSpan) {
        countSpan.textContent = `(${count})`;
      }
      
      // Disable if count is 0
      if (count === 0 || !isAvailable) {
        btn.disabled = true;
        btn.classList.add('disabled');
      } else {
        btn.disabled = false;
        btn.classList.remove('disabled');
      }
    });
    
    console.log(`✅ Filter status refreshed`);
  };
  
  // 🆕 DATA SEPARATION (CRITICAL!)
  // Global arrays that never mix:
  let allFetchedAds = []; // IMMUTABLE after fetch - source of truth
  let filteredAds = [];   // DERIVED from allFetchedAds - changes with filters
  let _allAdsForFiltering = []; // Legacy variable (keep for compatibility)
  
  // Current filter state
  let currentFilters = {
    ram: null,
    ssd: null,
    year: null,
    condition: 'used' // default
  };
  
  // 🆕 MASTER UPDATE FUNCTION - SINGLE SOURCE OF TRUTH
  // This is the ONLY function that should update the UI and price
  const updateMarketData = async () => {
    console.log(`🔄 updateMarketData START - Filters:`, currentFilters);
    
    // STEP A: Read current UI filters (already in currentFilters)
    const { ram, ssd, year, condition } = currentFilters;
    
    // STEP B: Filter allFetchedAds → filteredAds
    if (!allFetchedAds || allFetchedAds.length === 0) {
      console.warn(`⚠️ No ads available (allFetchedAds is empty)`);
      
      // Show "Not enough data"
      const priceEl = qs("[data-market-price]");
      const reviewPriceEl = qs("[data-review-price]");
      if (priceEl) priceEl.textContent = "Nedostatok dát";
      if (reviewPriceEl) reviewPriceEl.textContent = "Nedostatok dát";
      
      filteredAds = [];
      return;
    }
    
    // Apply filters
    filteredAds = allFetchedAds.filter(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      const matchesRam = !ram || specs.ram === ram;
      const matchesSsd = !ssd || specs.ssd === ssd;
      const matchesYear = !year || specs.year === year;
      return matchesRam && matchesSsd && matchesYear;
    });
    
    console.log(`✅ STEP B: Filtered ${filteredAds.length}/${allFetchedAds.length} ads`);
    
    // STEP C: Re-render the ads list (right column) using ONLY filteredAds
    applySimilarAdsToUI(filteredAds, {
      googleFallback: currentApiResponse?.googleFallback || false,
      googleSearchUrl: currentApiResponse?.googleSearchUrl || null
    });
    
    // Update count
    const similarCountEl = qs("[data-similar-count]");
    if (similarCountEl) {
      similarCountEl.textContent = String(filteredAds.length);
    }
    
    // Update modal list
    renderReviewAdsList();
    
    console.log(`✅ STEP C: Rendered ${filteredAds.length} ads in UI`);
    
    // Wait for DOM to fully update
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // STEP D: ONLY NOW calculate price from FINAL filteredAds
    if (filteredAds.length === 0) {
      // Show "Not enough data" instead of hiding
      const priceEl = qs("[data-market-price]");
      const reviewPriceEl = qs("[data-review-price]");
      if (priceEl) {
        priceEl.textContent = "Nedostatok dát";
        priceEl.style.display = "";
        priceEl.removeAttribute("hidden");
      }
      if (reviewPriceEl) {
        reviewPriceEl.textContent = "Nedostatok dát";
        reviewPriceEl.style.display = "";
        reviewPriceEl.removeAttribute("hidden");
      }
      
      console.log(`⚠️ STEP D: No ads after filtering - showing "Nedostatok dát"`);
      return;
    }
    
    if (filteredAds.length < 4) {
      const priceEl = qs("[data-market-price]");
      const reviewPriceEl = qs("[data-review-price]");
      if (priceEl) priceEl.textContent = "Málo dát (min. 4)";
      if (reviewPriceEl) reviewPriceEl.textContent = "Málo dát (min. 4)";
      
      console.log(`⚠️ STEP D: Only ${filteredAds.length} ads - not enough for calculation`);
      return;
    }
    
    // Extract prices from FINAL filteredAds
    const prices = filteredAds
      .map(ad => Number(ad.price || 0))
      .filter(p => p > 0)
      .sort((a, b) => a - b);
    
    if (prices.length < 4) {
      const priceEl = qs("[data-market-price]");
      const reviewPriceEl = qs("[data-review-price]");
      if (priceEl) priceEl.textContent = "Málo cien";
      if (reviewPriceEl) reviewPriceEl.textContent = "Málo cien";
      
      console.log(`⚠️ STEP D: Only ${prices.length} valid prices`);
      return;
    }
    
    // Calculate price based on condition
    const result = calculatePriceByCondition(prices, condition);
    
    if (result.fairPrice > 0) {
      // Update main UI price
      const pricing = {
        price_recommended: result.fairPrice,
        price_low: Math.round(result.fairPrice * 0.90),
        price_high: Math.round(result.fairPrice * 1.10),
        quick: Math.round(result.fairPrice * 0.90),
        market: result.fairPrice,
        premium: Math.round(result.fairPrice * 1.10)
      };
      
      applyPricesToUI(pricing);
      
      // Update modal price
      const reviewPriceEl = qs("[data-review-price]");
      if (reviewPriceEl) {
        reviewPriceEl.textContent = `${result.fairPrice}€`;
        reviewPriceEl.style.display = "";
        reviewPriceEl.removeAttribute("hidden");
      }
      
      // Ensure price elements are visible
      const priceEl = qs("[data-market-price]");
      const estimateCard = qs(".estimateCard");
      if (priceEl) {
        priceEl.style.display = "";
        priceEl.removeAttribute("hidden");
      }
      if (estimateCard) {
        estimateCard.style.display = "";
        estimateCard.removeAttribute("hidden");
      }
      
      const conditionLabel = condition === 'new' ? 'Ako nový' : condition === 'damaged' ? 'Poškodený' : 'Používaný';
      console.log(`✅ STEP D: Price calculated: ${result.fairPrice}€ (${conditionLabel}, ${result.method}, from ${filteredAds.length} ads)`);
    } else {
      console.warn(`⚠️ STEP D: Price calculation failed`);
    }
    
    console.log(`✅ updateMarketData COMPLETE`);
  };
  
  const filteredAdsProxy = {
    get value() {
      return _filteredAdsInternal;
    },
    set value(newAds) {
      _filteredAdsInternal = newAds;
      console.log(`🔄 filteredAds changed: ${newAds.length} ads`);
      
      // 🆕 AUTOMATIC SIDE EFFECTS (like useEffect)
      this.updateUI();
      this.updatePrice();
    },
    
    // Update UI with current filtered ads
    updateUI() {
      const similarCountEl = qs("[data-similar-count]");
      
      // Update main ads list
      applySimilarAdsToUI(_filteredAdsInternal, {
        googleFallback: currentApiResponse?.googleFallback || false,
        googleSearchUrl: currentApiResponse?.googleSearchUrl || null
      });
      
      // Update count
      if (similarCountEl) {
        similarCountEl.textContent = String(_filteredAdsInternal.length);
      }
      
      // Update modal list
      renderReviewAdsList();
      updateReviewPrice();
      
      console.log(`📋 UI updated with ${_filteredAdsInternal.length} ads`);
    },
    
    // Calculate and update price from current filtered ads
    async updatePrice() {
      // 🆕 DEDUPLICATE BEFORE PRICE CALCULATION
      const seenUrls = new Set();
      const seenTitlePrice = new Set();
      const uniqueAds = [];
      
      for (const ad of _filteredAdsInternal) {
        const url = String(ad?.url || "").trim().toLowerCase();
        const title = String(ad?.title || "").trim();
        const price = Number(ad?.price || 0);
        
        if (!title || price <= 0) continue;
        
        const titlePriceKey = `${title}|${price}`;
        
        // Check duplicates
        if ((url && seenUrls.has(url)) || seenTitlePrice.has(titlePriceKey)) {
          continue; // Skip duplicate
        }
        
        // Mark as seen
        if (url) seenUrls.add(url);
        seenTitlePrice.add(titlePriceKey);
        uniqueAds.push(ad);
      }
      
      console.log(`💰 Price calculation: ${_filteredAdsInternal.length} → ${uniqueAds.length} unique ads (removed ${_filteredAdsInternal.length - uniqueAds.length} duplicates)`);
      
      let effectiveAds = [...uniqueAds]; // Use ONLY unique ads for pricing
      
      // 🆕 AUTOMATIC GOOGLE SHOPPING FALLBACK (< 5 ads)
      if (effectiveAds.length < 5 && effectiveAds.length > 0) {
        console.log(`⚠️ Only ${effectiveAds.length} bazaar ads - fetching Google Shopping for better accuracy`);
        
        try {
          const productName = (qs("[data-product-name]")?.value ?? "").trim();
          if (productName) {
            showToast(`🔍 Hľadám nové kusy na Google (${effectiveAds.length} bazárových je málo)...`, { type: "info", duration: 3000 });
            
            // Fetch Google Shopping results
            const googleUrl = `/api/google-shopping?query=${encodeURIComponent(productName)}&limit=10`;
            const resp = await apiFetch(googleUrl, { method: "GET" });
            
            if (resp.ok) {
              const data = await resp.json();
              if (data?.ok && Array.isArray(data.ads) && data.ads.length > 0) {
                // Add Google Shopping results with 60% coefficient
                const googleAdsAdjusted = data.ads.map(ad => ({
                  ...ad,
                  price: Math.round(ad.price * 0.60), // 60% of new price
                  source: 'google_shopping',
                  adjusted: true
                }));
                
                effectiveAds = [...effectiveAds, ...googleAdsAdjusted];
                console.log(`✅ Added ${googleAdsAdjusted.length} Google Shopping results (60% adjusted) → total ${effectiveAds.length} ads`);
                showToast(`✅ Pridaných ${googleAdsAdjusted.length} e-shop cien (60% koef.) pre presnejší odhad`, { type: "success", duration: 3000 });
              }
            }
          }
        } catch (err) {
          console.warn("⚠️ Failed to fetch Google Shopping fallback:", err);
        }
      }
      
      if (effectiveAds.length < 4) {
        console.log(`⚠️ Not enough ads (${effectiveAds.length}) for price calculation even after Google fallback`);
        return;
      }
      
      const prices = effectiveAds
        .map(ad => Number(ad.price || 0))
        .filter(p => p > 0)
        .sort((a, b) => a - b);
      
      // 🆕 USE CONDITION-BASED CALCULATION
      const result = calculatePriceByCondition(prices, currentCondition);
      
      if (result.fairPrice > 0) {
        // Update main UI with calculated price
        const pricing = {
          price_recommended: result.fairPrice,
          price_low: Math.round(result.fairPrice * 0.90),
          price_high: Math.round(result.fairPrice * 1.10),
          quick: Math.round(result.fairPrice * 0.90),
          market: result.fairPrice,
          premium: Math.round(result.fairPrice * 1.10)
        };
        
        applyPricesToUI(pricing);
        
        const bazaarCount = uniqueAds.length; // 🔧 FIX: Use deduplicated count
        const googleCount = effectiveAds.length - bazaarCount;
        const conditionLabel = currentCondition === 'new' ? 'Ako nový' : currentCondition === 'damaged' ? 'Poškodený' : 'Používaný';
        console.log(`💰 Price auto-calculated: ${result.fairPrice}€ (${conditionLabel}, ${result.method}, from ${result.adsUsed}/${effectiveAds.length} ads: ${bazaarCount} unique bazaar + ${googleCount} Google@60%)`);
      }
    }
  };
  
  // Helper to access filteredAds (for backwards compatibility)
  Object.defineProperty(window, 'filteredAds', {
    get() { return filteredAdsProxy.value; },
    set(newValue) { filteredAdsProxy.value = newValue; }
  });
  
  // 🆕 SMART CACHING (WOW Feature - Instant Results)
  const SmartCache = {
    cache: new Map(),
    ttl: 5 * 60 * 1000, // 5 minutes
    
    get(key) {
      const item = this.cache.get(key);
      if (!item) return null;
      
      const age = Date.now() - item.timestamp;
      if (age > this.ttl) {
        this.cache.delete(key);
        return null;
      }
      
      console.log(`💾 Cache HIT: "${key}" (age: ${Math.round(age/1000)}s)`);
      return item.data;
    },
    
    set(key, data) {
      this.cache.set(key, {
        data,
        timestamp: Date.now()
      });
      console.log(`💾 Cache SET: "${key}" (${data.length} ads)`);
      
      // Cleanup old entries (max 50)
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    },
    
    clear() {
      this.cache.clear();
      console.log(`💾 Cache CLEARED`);
    },
    
    getCacheKey(query, filters) {
      return `${query}:${filters.ram || 'any'}:${filters.ssd || 'any'}:${filters.year || 'any'}`;
    }
  };
  
  // 🆕 PROGRESS BAR (WOW Feature - Visual Feedback)
  const ProgressBar = {
    show(text = 'Načítavam...') {
      const bar = qs('[data-progress-bar]');
      const textEl = qs('[data-progress-text]');
      const percentEl = qs('[data-progress-percent]');
      const fillEl = qs('[data-progress-fill]');
      
      if (bar) bar.hidden = false;
      if (textEl) textEl.textContent = text;
      if (percentEl) percentEl.textContent = '0%';
      if (fillEl) fillEl.style.width = '0%';
    },
    
    update(percent, text) {
      const textEl = qs('[data-progress-text]');
      const percentEl = qs('[data-progress-percent]');
      const fillEl = qs('[data-progress-fill]');
      
      if (textEl && text) textEl.textContent = text;
      if (percentEl) percentEl.textContent = `${Math.round(percent)}%`;
      if (fillEl) fillEl.style.width = `${percent}%`;
    },
    
    hide() {
      const bar = qs('[data-progress-bar]');
      if (bar) bar.hidden = true;
    }
  };
  
  // 🆕 PROGRESSIVE FILTERING (WOW Feature - Auto-Relax)
  const applyProgressiveFilter = (ads, filters) => {
    const minResults = 5; // Target minimum
    
    // ATTEMPT 1: Exact match (strictness = 1.0)
    let filtered = ads.filter(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      return (
        (!filters.ram || specs.ram === filters.ram) &&
        (!filters.ssd || specs.ssd === filters.ssd) &&
        (!filters.year || specs.year === filters.year)
      );
    });
    
    if (filtered.length >= minResults) {
      return {
        result: filtered,
        method: 'exact_match',
        relaxed: false,
        message: `✅ Našlo sa ${filtered.length} presných zhôd`
      };
    }
    
    console.log(`⚡ Exact match: ${filtered.length} ads (< ${minResults}), trying fuzzy...`);
    
    // ATTEMPT 2: Fuzzy match (±1 level tolerance)
    // 8GB → accept 4GB, 8GB, 16GB
    // 256GB → accept 128GB, 256GB, 512GB
    filtered = ads.filter(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      
      const ramMatch = !filters.ram || (
        specs.ram && (
          specs.ram === filters.ram ||
          specs.ram === filters.ram / 2 ||
          specs.ram === filters.ram * 2
        )
      );
      
      const ssdMatch = !filters.ssd || (
        specs.ssd && (
          specs.ssd === filters.ssd ||
          specs.ssd === filters.ssd / 2 ||
          specs.ssd === filters.ssd * 2
        )
      );
      
      const yearMatch = !filters.year || (
        specs.year && Math.abs(specs.year - filters.year) <= 1
      );
      
      return ramMatch && ssdMatch && yearMatch;
    });
    
    if (filtered.length >= minResults) {
      return {
        result: filtered,
        method: 'fuzzy_match',
        relaxed: true,
        message: `⚡ Našlo sa ${filtered.length} podobných (±1 úroveň)`
      };
    }
    
    console.log(`⚡ Fuzzy match: ${filtered.length} ads (< ${minResults}), trying broad...`);
    
    // ATTEMPT 3: Broad match (any 2 of 3 filters)
    filtered = ads.filter(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      
      let matches = 0;
      if (!filters.ram || specs.ram) matches++;
      if (!filters.ssd || specs.ssd) matches++;
      if (!filters.year || specs.year) matches++;
      
      return matches >= 2; // At least 2 filters match
    });
    
    return {
      result: filtered,
      method: 'broad_match',
      relaxed: true,
      message: `📊 Našlo sa ${filtered.length} širších zhôd (relaxed filter)`
    };
  };
  
  // 🆕 Expose to window for access from event handlers
  window.applyProgressiveFilter = applyProgressiveFilter;
  
  // 🆕 CONFIDENCE SCORING ENGINE (Apple-level quality)
  const calculateAdConfidence = (ad, allAds) => {
    let score = 100;
    const reasons = [];
    
    try {
      // 1. PRICE OUTLIER DETECTION (Z-score statistical analysis)
      const prices = allAds.map(a => Number(a.price || 0)).filter(p => p > 0);
      if (prices.length >= 5) {
        const mean = prices.reduce((a,b) => a+b, 0) / prices.length;
        const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
        const std = Math.sqrt(variance);
        
        if (std > 0) {
          const zScore = Math.abs((ad.price - mean) / std);
          
          if (zScore > 3) {
            score -= 40;
            reasons.push('extreme_price_outlier');
          } else if (zScore > 2) {
            score -= 20;
            reasons.push('price_outlier');
          }
        }
      }
      
      // 2. DESCRIPTION QUALITY
      const desc = String(ad.description || '');
      if (!desc || desc.length < 30) {
        score -= 15;
        reasons.push('poor_description');
      } else if (desc.length > 200) {
        score += 5; // Bonus for detailed description
        reasons.push('detailed_description');
      }
      
      // 3. SUSPICIOUS KEYWORDS (damaged, broken, iCloud locked)
      const suspiciousWords = [
        'nefunguje', 'poškodený', 'poškodeny', 'prasklý', 'prasklina',
        'display crack', 'broken', 'damaged', 'icloud lock', 'locked',
        'na diely', 'parts only', 'nezapiná', 'nenaštartuje'
      ];
      const titleLower = String(ad.title || '').toLowerCase();
      const descLower = desc.toLowerCase();
      const foundSuspicious = suspiciousWords.filter(w => 
        titleLower.includes(w) || descLower.includes(w)
      );
      
      if (foundSuspicious.length > 0) {
        score -= 25;
        reasons.push(`suspicious_keywords: ${foundSuspicious.join(', ')}`);
      }
      
      // 4. UNREALISTICALLY LOW PRICE (< 30% of mean)
      if (prices.length >= 5) {
        const mean = prices.reduce((a,b) => a+b, 0) / prices.length;
        if (ad.price < mean * 0.30) {
          score -= 30;
          reasons.push('suspiciously_cheap');
        }
      }
      
      // 5. TITLE QUALITY (length and detail)
      const titleLength = String(ad.title || '').length;
      if (titleLength < 20) {
        score -= 10;
        reasons.push('short_title');
      } else if (titleLength > 60) {
        score += 5; // Bonus for detailed title
      }
      
      // 6. SOURCE RELIABILITY
      if (ad.source === 'google_shopping') {
        score += 10; // E-shops are more reliable
        reasons.push('trusted_eshop');
      }
      
    } catch (err) {
      console.warn('⚠️ Confidence calculation error:', err);
      return { score: 50, reasons: ['calculation_error'], tier: 'medium' };
    }
    
    // Clamp score between 0-100
    score = Math.max(0, Math.min(100, score));
    
    // Determine tier
    let tier = 'low';
    if (score >= 80) tier = 'high';
    else if (score >= 60) tier = 'medium';
    
    return { score, reasons, tier };
  };
  
  // 🆕 EXTRACT RAM/SSD/YEAR FROM AD TITLE AND DESCRIPTION
  const extractAdSpecs = (title, description = "") => {
    // Combine title and description for better detection
    let t = String(title || "") + " " + String(description || "");
    
    // 🔧 FIX: Remove prices before parsing (e.g., "1650 €" should not match as "16" GB)
    t = t.replace(/\b\d+\s*(?:€|EUR|eur|E|e)\b/g, ''); // Remove "1650 €", "1650€", "1650 EUR", "1650 e"
    
    const specs = { ram: null, ssd: null, year: null };
    
    // 🆕 BENEVOLENT REGEX: Accept various formats (8GB, 8 GB, 8G, 8g, 8 g)
    // 🔧 WITH PRICE PROTECTION: Prices removed above
    
    // 🔧 SMART PATTERN DETECTION: Prioritize "RAM/SSD" patterns first
    // Pattern: "16GB/256GB", "8GB RAM/256GB SSD", "16/256"
    const comboPattern = /\b(\d+)\s*(?:GB|G)?(?:\s*RAM)?\s*[\/\|]\s*(\d+)\s*(?:GB|G|TB|T)/i;
    const comboMatch = t.match(comboPattern);
    
    if (comboMatch) {
      // First number is RAM, second is SSD
      const ramValue = parseInt(comboMatch[1], 10);
      const ssdValue = parseInt(comboMatch[2], 10);
      
      if ([4, 8, 16, 32, 64, 96, 128].includes(ramValue)) {
        specs.ram = ramValue;
      }
      
      // SSD can be in GB or TB
      const isTB = /[tT]/.test(comboMatch[2]);
      const ssdFinal = isTB ? ssdValue * 1024 : ssdValue;
      if (ssdFinal >= 64 && ssdFinal <= 8192) {
        specs.ssd = ssdFinal;
      }
      
      // Skip individual patterns if combo matched
      if (specs.ram && specs.ssd) {
        return specs;
      }
    }
    
    // RAM: Benevolent patterns - accept with/without space, with/without "B"
    // Examples: "8GB", "8 GB", "8G", "8 g", "8gb", "M1 8GB"
    const ramPatterns = [
      /\b(\d+)\s*GB\s*(RAM|Pamäť|Memory)\b/i,           // Explicit: "8GB RAM", "8 GB RAM"
      /\b(\d+)\s*G\s*(RAM|Pamäť|Memory)\b/i,            // Short: "8G RAM"
      /\bM[123]\s+(\d+)\s*(?:GB|G)\b/i,                 // Apple Silicon: "M1 8GB", "M2 16G"
    ];
    
    for (const pattern of ramPatterns) {
      const match = t.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        // Only accept typical RAM sizes (4, 8, 16, 32, 64, 96, 128)
        if ([4, 8, 16, 32, 64, 96, 128].includes(value)) {
          specs.ram = value;
          break; // Found RAM, stop searching
        }
      }
    }
    
    // SSD: Benevolent patterns - accept with/without space, with/without "B"
    // Examples: "256GB", "256 GB", "256G", "256g", "1TB", "1 TB", "1T"
    const ssdPatterns = [
      /\b(\d+)\s*(?:GB|G)\s*(SSD|Storage|Disk|úložisko)\b/i,  // Explicit: "256GB SSD", "256G SSD"
      /\b(\d+)\s*(?:TB|T)\s*(SSD|Storage|Disk|úložisko)?\b/i, // TB format: "1TB SSD", "2T"
      /\/(\d+)\s*(?:GB|G|TB|T)\b/i,                            // After slash: "/256GB", "/1TB"
      /\b(\d+)\s*(?:GB|G)(?!\s*RAM)\b/i,                       // Standalone GB (not followed by RAM): "256GB"
    ];
    
    for (const pattern of ssdPatterns) {
      const match = t.match(pattern);
      if (match) {
        const value = parseInt(match[1], 10);
        // Check if it's TB or GB
        const isTB = /[tT]/.test(match[0]);
        const ssdValue = isTB ? value * 1024 : value;
        
        // Only accept typical SSD sizes (64GB - 8TB)
        if (ssdValue >= 64 && ssdValue <= 8192) {
          // Avoid confusing RAM with SSD (RAM is usually ≤ 128GB)
          if (ssdValue > 128 || isTB) {
            specs.ssd = ssdValue;
            break; // Found SSD, stop searching
          }
        }
      }
    }
    
    // Year: 2015-2026 (strict 4-digit year)
    const yearMatch = t.match(/\b(20[12]\d)\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      // Only years 2015-2026
      if (year >= 2015 && year <= 2026) {
        specs.year = year;
      }
    }
    
    return specs;
  };
  
  // 🆕 BUILD ADVANCED FILTERS FROM ADS
  const buildAdvancedFilters = (ads) => {
    const ramValues = new Set();
    const ssdValues = new Set();
    const yearValues = new Set();
    
    ads.forEach(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      if (specs.ram) ramValues.add(specs.ram);
      if (specs.ssd) ssdValues.add(specs.ssd);
      if (specs.year) yearValues.add(specs.year);
    });
    
    return {
      ram: Array.from(ramValues).sort((a, b) => a - b),
      ssd: Array.from(ssdValues).sort((a, b) => a - b),
      year: Array.from(yearValues).sort((a, b) => b - a) // Newest first
    };
  };
  
  // 🆕 COUNT ADS MATCHING FILTER
  const countAdsMatchingFilter = (ads, filterType, filterValue, activeFilters) => {
    return ads.filter(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      
      // Check if ad matches ALL active filters + this one
      const matchesRam = !activeFilters.ram || activeFilters.ram === specs.ram;
      const matchesSsd = !activeFilters.ssd || activeFilters.ssd === specs.ssd;
      const matchesYear = !activeFilters.year || activeFilters.year === specs.year;
      
      // Now check if ad matches the filter we're counting
      const matchesThisFilter = filterType === 'ram' ? specs.ram === filterValue 
        : filterType === 'ssd' ? specs.ssd === filterValue 
        : specs.year === filterValue;
      
      return matchesThisFilter && 
        (filterType === 'ram' ? matchesSsd && matchesYear : true) &&
        (filterType === 'ssd' ? matchesRam && matchesYear : true) &&
        (filterType === 'year' ? matchesRam && matchesSsd : true);
    }).length;
  };

  // 🆕 CENTRAL RECALCULATION FUNCTION
  // This is the SINGLE source of truth for filtering and price calculation
  const recalculateEverything = async (activeFilters = { ram: null, ssd: null, year: null }) => {
    console.log(`🔄 recalculateEverything called with filters:`, activeFilters);
    
    // STEP 0: RESET STATE - Clear old price and ads display FIRST
    const priceEl = qs("[data-market-price]");
    const reviewPriceEl = qs("[data-review-price]");
    if (priceEl) priceEl.textContent = "—";
    if (reviewPriceEl) reviewPriceEl.textContent = "—";
    
    // Show loading state
    const estimateCard = qs(".estimateCard");
    if (estimateCard) {
      estimateCard.style.opacity = "0.6";
      estimateCard.style.pointerEvents = "none";
    }
    
    // Wait for DOM update (crucial for timing!)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // STEP 1: Filter allAds based on current filters
    const allAdsRef = _allAdsForFiltering;
    if (!allAdsRef || allAdsRef.length === 0) {
      console.warn(`⚠️ No ads available for filtering`);
      if (estimateCard) {
        estimateCard.style.opacity = "1";
        estimateCard.style.pointerEvents = "auto";
      }
      return;
    }
    
    let filtered = allAdsRef.filter(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      const matchesRam = !activeFilters.ram || specs.ram === activeFilters.ram;
      const matchesSsd = !activeFilters.ssd || specs.ssd === activeFilters.ssd;
      const matchesYear = !activeFilters.year || specs.year === activeFilters.year;
      return matchesRam && matchesSsd && matchesYear;
    });
    
    console.log(`✅ Filtered: ${filtered.length}/${allAdsRef.length} ads match (RAM: ${activeFilters.ram || 'any'}, SSD: ${activeFilters.ssd || 'any'}, Year: ${activeFilters.year || 'any'})`);
    
    // STEP 2: Update filteredAds (this will trigger UI update via proxy)
    filteredAdsProxy.value = filtered;
    
    // Wait for UI to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // STEP 3: Ensure price is visible and updated
    if (priceEl) {
      priceEl.style.display = ""; // Remove any display:none
      priceEl.removeAttribute("hidden");
    }
    if (estimateCard) {
      estimateCard.style.display = ""; // Ensure card is visible
      estimateCard.removeAttribute("hidden");
      estimateCard.style.opacity = "1";
      estimateCard.style.pointerEvents = "auto";
    }
    
    console.log(`✅ recalculateEverything completed: ${filtered.length} ads, price visible`);
    
    // 🆕 RENDER MODAL ADS LIST if modal is open
    if (typeof renderReviewAdsList === 'function') {
      renderReviewAdsList();
    }
  };

  const showReviewModal = (apiResponse, isRetry = false, restoreFilters = false) => {
    return new Promise((resolve, reject) => {
      reviewData = apiResponse;
      currentApiResponse = apiResponse; // 🆕 Store for reactive updates
      
      // 🔧 CRITICAL: Set ALL three filtered arrays (IMMUTABLE source of truth)
      // 🆕 FILTER OUT BLACKLISTED ADS
      const rawAds = apiResponse?.similarAds || [];
      allFetchedAds = filterBlacklisted([...rawAds]);
      filteredAds = [...allFetchedAds]; // Start with all ads
      _allAdsForFiltering = allFetchedAds; // Keep for compatibility
      
      console.log(`🔍 Loaded ${rawAds.length} ads, ${allFetchedAds.length} after blacklist filter`);
      
      console.log(`🔵 showReviewModal: Initializing with ${allFetchedAds.length} ads from backend`);
      console.log(`📊 Backend response:`, {
        similarAdsCount: apiResponse?.similarAds?.length || 0,
        hasGoogleFallback: apiResponse?.googleFallback || false,
        hasPricing: !!apiResponse?.pricing
      });
      
      // 🆕 RESTORE PREVIOUS FILTERS (when reopening after generation)
      if (restoreFilters && currentActiveFilters) {
        currentFilters = { ...currentActiveFilters };
      } else {
        currentFilters = { ram: null, ssd: null, year: null, condition: currentCondition || 'used' };
      }
      
      let activeFilters = currentFilters; // Local reference for event handlers
      
      // Open modal
      if (reviewModal) reviewModal.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      
      // 🔄 SETUP RECALCULATE BUTTON
      setupRecalculateButton();
      
      // 🆕 GOOGLE SHOPPING LINK
      const googlePriceLink = qs("[data-google-price-link]");
      if (googlePriceLink && apiResponse?.googleSearchUrl) {
        googlePriceLink.href = apiResponse.googleSearchUrl;
        googlePriceLink.hidden = false;
      } else if (googlePriceLink) {
        googlePriceLink.hidden = true;
      }
      
      // 🆕 BUILD ADVANCED FILTERS
      const availableFilters = buildAdvancedFilters(allFetchedAds);
      const hasFilters = availableFilters.ram.length > 0 || availableFilters.ssd.length > 0 || availableFilters.year.length > 0;
      
      console.log(`🔧 Building filters from ${allFetchedAds.length} ads:`, availableFilters);
      
      const advancedFiltersContainer = qs("[data-advanced-filters]");
      if (advancedFiltersContainer && hasFilters) {
        advancedFiltersContainer.hidden = false;
        
        // Render RAM filters
        const ramGroup = qs("[data-filter-group='ram']");
        const ramFiltersContainer = qs("[data-ram-filters]");
        if (ramGroup && ramFiltersContainer) {
          if (availableFilters.ram.length > 0) {
            ramGroup.hidden = false;
            
            // 🔧 ALWAYS re-render to ensure all values are shown
            ramFiltersContainer.innerHTML = availableFilters.ram.map(value => {
              const count = countAdsMatchingFilter(allFetchedAds, 'ram', value, activeFilters);
              const isActive = restoreFilters && activeFilters.ram === value;
              return `<button type="button" class="advFilterBtn ${isActive ? 'is-active' : ''}" data-filter-ram="${value}" style="padding: 4px 8px; font-size: 11px; border: 1px solid rgba(52,43,35,.2); border-radius: 4px; background: white; cursor: pointer;">${value}GB <span style="color: rgba(52,43,35,.5);">(${count})</span></button>`;
            }).join('');
            
            console.log(`✅ Rendered ${availableFilters.ram.length} RAM filters`);
          } else {
            ramGroup.hidden = true;
          }
        }
        
        // Render SSD filters
        const ssdGroup = qs("[data-filter-group='ssd']");
        const ssdFiltersContainer = qs("[data-ssd-filters]");
        if (ssdGroup && ssdFiltersContainer) {
          if (availableFilters.ssd.length > 0) {
            ssdGroup.hidden = false;
            
            // 🔧 ALWAYS re-render to ensure all values are shown
            ssdFiltersContainer.innerHTML = availableFilters.ssd.map(value => {
              const count = countAdsMatchingFilter(allFetchedAds, 'ssd', value, activeFilters);
              const label = value >= 1024 ? `${value / 1024}TB` : `${value}GB`;
              const isActive = restoreFilters && activeFilters.ssd === value;
              return `<button type="button" class="advFilterBtn ${isActive ? 'is-active' : ''}" data-filter-ssd="${value}" style="padding: 4px 8px; font-size: 11px; border: 1px solid rgba(52,43,35,.2); border-radius: 4px; background: white; cursor: pointer;">${label} <span style="color: rgba(52,43,35,.5);">(${count})</span></button>`;
            }).join('');
            
            console.log(`✅ Rendered ${availableFilters.ssd.length} SSD filters`);
          } else {
            ssdGroup.hidden = true;
          }
        }
        
        // Render Year filters
        const yearGroup = qs("[data-filter-group='year']");
        const yearFiltersContainer = qs("[data-year-filters]");
        if (yearGroup && yearFiltersContainer) {
          if (availableFilters.year.length > 0) {
            yearGroup.hidden = false;
            
            // 🔧 ALWAYS re-render to ensure all values are shown
            yearFiltersContainer.innerHTML = availableFilters.year.map(value => {
              const count = countAdsMatchingFilter(allFetchedAds, 'year', value, activeFilters);
              const isActive = restoreFilters && activeFilters.year === value;
              return `<button type="button" class="advFilterBtn ${isActive ? 'is-active' : ''}" data-filter-year="${value}" style="padding: 4px 8px; font-size: 11px; border: 1px solid rgba(52,43,35,.2); border-radius: 4px; background: white; cursor: pointer;">${value} <span style="color: rgba(52,43,35,.5);">(${count})</span></button>`;
            }).join('');
            
            console.log(`✅ Rendered ${availableFilters.year.length} Year filters`);
          } else {
            yearGroup.hidden = true;
          }
        }
      } else if (advancedFiltersContainer) {
        advancedFiltersContainer.hidden = true;
      }
      
      // 🆕 NOTE: Event delegation doesn't need re-attachment!
      // Handlers are attached to STABLE parent, so they work even after re-render
      
      // 🆕 SMART FILTER STATUS UPDATE
      // Analyze available specs and update button states
      const availableSpecs = getAvailableSpecs(allFetchedAds);
      const occurrenceCounts = countOccurrences(allFetchedAds);
      
      console.log(`📊 Available specs:`, availableSpecs);
      console.log(`📊 Occurrence counts:`, occurrenceCounts);
      
      // Wait for buttons to be rendered, then refresh their status
      setTimeout(() => {
        refreshFilterStatus(availableSpecs, occurrenceCounts);
      }, 50);
      
      // 🆕 APPLY ADVANCED FILTERS
      const applyAdvancedFilters = async () => {
        const fetchingIndicator = qs("[data-fetching-indicator]");
        const fetchingText = qs("[data-fetching-text]");
        
        // 🔧 FIX: Use global allAds reference
        const allAdsRef = _allAdsForFiltering;
        
        let filtered = allAdsRef.filter(ad => {
          const specs = extractAdSpecs(ad.title, ad.description);
          const matchesRam = !activeFilters.ram || specs.ram === activeFilters.ram;
          const matchesSsd = !activeFilters.ssd || specs.ssd === activeFilters.ssd;
          const matchesYear = !activeFilters.year || specs.year === activeFilters.year;
          return matchesRam && matchesSsd && matchesYear;
        });
        
        console.log(`🔍 Filter applied: ${filtered.length}/${allAdsRef.length} ads match (RAM: ${activeFilters.ram || 'any'}, SSD: ${activeFilters.ssd || 'any'}, Year: ${activeFilters.year || 'any'})`);
        
        // 🆕 HYBRID B: If < 20 unique results after deduplication, fetch more with REAL filters
        if (filtered.length > 0 && filtered.length < 20) {
          console.warn(`⚠️ Only ${filtered.length} unique ads after filtering - triggering server-side filtered search...`);
          
          // Show loading indicator
          if (fetchingIndicator) {
            fetchingIndicator.hidden = false;
            if (fetchingText) fetchingText.textContent = `Našiel som len ${filtered.length} inzerátov, hľadám presnejšie...`;
          }
          
          showToast(`🔄 Menej ako 20 výsledkov, hľadám presnejšie na Bazoši...`, { type: "info", duration: 3000 });
          
          try {
            // Build EXACT Bazoš query with specs from filters
            const baseQuery = (qs("[data-product-name]")?.value ?? "").trim();
            const queryParts = [baseQuery];
            
            // Add filter values as search terms (Bazoš will match these in titles/descriptions)
            if (activeFilters.ram) queryParts.push(`${activeFilters.ram}gb`);
            if (activeFilters.ssd) {
              const ssdLabel = activeFilters.ssd >= 1024 ? `${activeFilters.ssd / 1024}tb` : `${activeFilters.ssd}gb`;
              queryParts.push(ssdLabel);
            }
            if (activeFilters.year) queryParts.push(`${activeFilters.year}`);
            
            const enhancedQuery = queryParts.join(' ');
            console.log(`📡 Server-side filtered query: "${enhancedQuery}" (from: "${baseQuery}")`);
            
            // Fetch MORE ads from backend with FILTERED query
            let apiUrl = `/api/market/search?source=multi&limit=100&query=${encodeURIComponent(enhancedQuery)}`;
            if (selectedCategory) {
              apiUrl += `&category=${selectedCategory}`;
            }
            
            const resp = await apiFetch(apiUrl, { method: "GET" });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.ok && Array.isArray(data.ads) && data.ads.length > 0) {
                console.log(`✅ Backend returned ${data.ads.length} additional ads`);
                
                // Merge new ads with existing (avoid duplicates by URL)
                const existingUrls = new Set(allAdsRef.map(ad => ad.url));
                const newAds = data.ads.filter(ad => !existingUrls.has(ad.url));
                
                if (newAds.length > 0) {
                  _allAdsForFiltering.push(...newAds); // 🔧 FIX: Update global reference
                  console.log(`✅ Added ${newAds.length} new unique ads (total now: ${_allAdsForFiltering.length})`);
                  
                  // Re-filter with expanded dataset
                  filtered = _allAdsForFiltering.filter(ad => {
                    const specs = extractAdSpecs(ad.title, ad.description);
                    const matchesRam = !activeFilters.ram || specs.ram === activeFilters.ram;
                    const matchesSsd = !activeFilters.ssd || specs.ssd === activeFilters.ssd;
                    const matchesYear = !activeFilters.year || specs.year === activeFilters.year;
                    return matchesRam && matchesSsd && matchesYear;
                  });
                  
                  console.log(`✅ After re-filter: ${filtered.length} ads match`);
                  showToast(`✅ Našiel som ${filtered.length} inzerátov pre tento filter`, { type: "success", duration: 2000 });
                  
                  // 🆕 RECALCULATE EVERYTHING to update filter buttons with new data
                  await recalculateEverything(activeFilters);
                  
                  // 🆕 RENDER ads in modal with new data
                  _filteredAdsInternal = filtered;
                  filteredAds = filtered;
                  renderReviewAdsList();
                  updateReviewPrice();
                } else {
                  console.warn(`⚠️ All ${data.ads.length} new ads were duplicates`);
                  showToast(`⚠️ Nenašli sa ďalšie unikátne inzeráty`, { type: "warning", duration: 2000 });
                }
              } else {
                console.warn(`⚠️ Backend returned no ads for enhanced query`);
              }
            }
          } catch (err) {
            console.warn("⚠️ Failed to fetch additional ads:", err);
            showToast("⚠️ Nepodarilo sa načítať ďalšie inzeráty", { type: "warning", duration: 2000 });
          } finally {
            // Hide loading indicator
            if (fetchingIndicator) fetchingIndicator.hidden = true;
          }
        }
        
        // 🆕 FALLBACK: If still 0 results after fetching, show all ads as "similar"
        if (filtered.length === 0) {
          console.warn("⚠️ Filter returned 0 results even after backend fetch - showing all ads as similar");
          showToast("🔍 Presná zhoda nenájdená, zobrazujem podobné ponuky", { type: "info", duration: 3000 });
          
          // Show warning
          if (reviewWarning) {
            reviewWarning.textContent = "⚠️ Presná zhoda pre váš filter nebola nájdená. Zobrazujem podobné ponuky.";
            reviewWarning.hidden = false;
          }
          
          // Keep original ads but mark them as "similar"
          filtered = _allAdsForFiltering.map(ad => ({ ...ad, isSimilar: true }));
        } else {
          // Hide warning
          if (reviewWarning) reviewWarning.hidden = true;
        }
        
        console.log(`✅ applyAdvancedFilters: Setting filteredAds to ${filtered.length} ads`);
        
        // 🔧 CRITICAL: Update BOTH filtered arrays for compatibility
        filteredAds = filtered; // For updateMarketData()
        filteredAdsProxy.value = filtered; // For legacy code
        
        renderReviewAdsList(); // Update modal list
        updateReviewPrice(); // Recalculate price with 30% trim
        
        // 🆕 UPDATE MAIN UI ADS LIST IMMEDIATELY (not waiting for modal confirm)
        // This ensures the main "Podobné inzeráty" section shows only filtered ads
        applySimilarAdsToUI(filtered, {
          googleFallback: apiResponse?.googleFallback || false,
          googleSearchUrl: apiResponse?.googleSearchUrl || null
        });
        
        // Update similar count in main UI
        const similarCountEl = qs("[data-similar-count]");
        if (similarCountEl) {
          similarCountEl.textContent = String(filtered.length);
        }
        
        console.log(`📋 Updated main ads list: ${filtered.length} ads displayed (filter: RAM ${activeFilters.ram || 'any'}, SSD ${activeFilters.ssd || 'any'}, Year ${activeFilters.year || 'any'})`);
        
        // 🆕 UPDATE MAIN UI PRICE (not just modal)
        if (filtered.length >= 4) {
          const prices = filtered
            .map(ad => Number(ad.price || 0))
            .filter(p => p > 0)
            .sort((a, b) => a - b);
          
          // 🆕 USE CONDITION-BASED CALCULATION
          const result = calculatePriceByCondition(prices, currentCondition);
          
          if (result.fairPrice > 0) {
            // Update main UI with new price
            const pricing = {
              price_recommended: result.fairPrice,
              price_low: Math.round(result.fairPrice * 0.90),
              price_high: Math.round(result.fairPrice * 1.10),
              quick: Math.round(result.fairPrice * 0.90),
              market: result.fairPrice,
              premium: Math.round(result.fairPrice * 1.10)
            };
            
            applyPricesToUI(pricing);
            const conditionLabel = currentCondition === 'new' ? 'Ako nový' : currentCondition === 'damaged' ? 'Poškodený' : 'Používaný';
            console.log(`💰 Updated main UI price: ${result.fairPrice}€ (${conditionLabel}, ${result.method}, from ${result.adsUsed}/${filtered.length} ads)`);
          }
        }
        
        // Update filter button counts
        const updateFilterCounts = () => {
          availableFilters.ram.forEach(value => {
            const btn = qs(`[data-filter-ram="${value}"]`);
            if (btn) {
              const count = countAdsMatchingFilter(allFetchedAds, 'ram', value, activeFilters);
              btn.querySelector('span').textContent = `(${count})`;
            }
          });
          
          availableFilters.ssd.forEach(value => {
            const btn = qs(`[data-filter-ssd="${value}"]`);
            if (btn) {
              const count = countAdsMatchingFilter(allFetchedAds, 'ssd', value, activeFilters);
              btn.querySelector('span').textContent = `(${count})`;
            }
          });
          
          availableFilters.year.forEach(value => {
            const btn = qs(`[data-filter-year="${value}"]`);
            if (btn) {
              const count = countAdsMatchingFilter(allFetchedAds, 'year', value, activeFilters);
              btn.querySelector('span').textContent = `(${count})`;
            }
          });
        };
        
        updateFilterCounts();
      };
      
      // Setup filter buttons
      const filterExactBtn = qs("[data-filter-exact]");
      const filterSimilarBtn = qs("[data-filter-similar]");
      let currentFilter = "all"; // "all" or "exact"
      
      const applyFilter = (filter) => {
        currentFilter = filter;
        const items = document.querySelectorAll(".reviewAdItem");
        
        items.forEach(item => {
          if (filter === "exact" && item.dataset.isExactMatch === "false") {
            item.style.display = "none";
          } else {
            item.style.display = "flex";
          }
        });
        
        // Update button states
        if (filter === "all") {
          filterExactBtn?.classList.add("reviewModal__filterBtn--active");
          filterSimilarBtn?.classList.remove("reviewModal__filterBtn--active");
        } else {
          filterExactBtn?.classList.remove("reviewModal__filterBtn--active");
          filterSimilarBtn?.classList.add("reviewModal__filterBtn--active");
        }
      };
      
      filterExactBtn?.addEventListener("click", () => applyFilter("all"));
      filterSimilarBtn?.addEventListener("click", () => applyFilter("exact"));
      
      // 🆕 SMART QUERY BRIDGE: Update Bazoš search input when filters change
      const updateBazosSearchQuery = async (autoSearch = false) => {
        const bazosSearchInput = qs("[data-bazos-search-input]");
        if (!bazosSearchInput) return;
        
        // Get base query from main input
        const baseQuery = qs("[data-product-name]")?.value?.trim() || "";
        const queryParts = [baseQuery.split(/\s+/)[0]]; // Take only first word (product name)
        
        // 🆕 IMPROVED: Add filters WITHOUT "gb" suffix for broader search
        if (currentFilters.ram) {
          queryParts.push(`${currentFilters.ram}`);
        }
        if (currentFilters.ssd) {
          if (currentFilters.ssd >= 1024) {
            queryParts.push(`${currentFilters.ssd / 1024}`);
          } else {
            queryParts.push(`${currentFilters.ssd}`);
          }
        }
        if (currentFilters.year) queryParts.push(`${currentFilters.year}`);
        
        const newQuery = queryParts.filter(Boolean).join(' ');
        bazosSearchInput.value = newQuery;
        console.log(`🔄 Smart Query Bridge: Updated search to "${newQuery}"`);
        
        // 🆕 AUTO-SEARCH: Automatically trigger new Bazoš search if enabled
        if (autoSearch) {
          console.log(`🔍 Auto-triggering Bazoš search for: "${newQuery}"`);
          
          // 🆕 CHECK CACHE FIRST
          const cacheKey = SmartCache.getCacheKey(newQuery, currentFilters);
          const cachedAds = SmartCache.get(cacheKey);
          
          if (cachedAds && cachedAds.length > 0) {
            console.log(`⚡ Using cached results (${cachedAds.length} ads)`);
            // 🆕 FILTER BLACKLIST
            const cleanAds = filterBlacklisted([...cachedAds]);
            _allAdsForFiltering = cleanAds;
            allFetchedAds = cleanAds;
            await recalculateEverything(allFetchedAds, true);
            showToast(`⚡ Instant výsledok: ${cleanAds.length} inzerátov (cache)`, { type: "success", duration: 2000 });
            return;
          }
          
          // 🆕 RESET DEDUPLICATION
          console.log(`🧹 RESET: Clearing old ads (was: ${allFetchedAds.length} ads)`);
          allFetchedAds = [];
          _allAdsForFiltering = [];
          
          const fetchingIndicator = qs("[data-fetching-indicator]");
          const fetchingText = qs("[data-fetching-text]");
          
          // 🆕 SHOW PROGRESS BAR
          ProgressBar.show(`Hľadám "${newQuery}"...`);
          
          if (fetchingIndicator) {
            fetchingIndicator.hidden = false;
            if (fetchingText) fetchingText.textContent = `Hľadám "${newQuery}" na Bazoši...`;
          }
          
          try {
            ProgressBar.update(30, 'Sťahujem z Bazoš...');
            
            let apiUrl = `/api/market/search?source=multi&limit=100&query=${encodeURIComponent(newQuery)}`;
            if (selectedCategory) {
              apiUrl += `&category=${selectedCategory}`;
            }
            
            const resp = await apiFetch(apiUrl, { method: "GET" });
            
            ProgressBar.update(60, 'Spracovávam výsledky...');
            
            if (resp.ok) {
              const data = await resp.json();
              if (data?.ok && Array.isArray(data.ads) && data.ads.length > 0) {
                console.log(`✅ Auto-search returned ${data.ads.length} ads`);
                
                ProgressBar.update(80, 'Filtrujem inzeráty...');
                
                const filteredBySpecs = window.applyProgressiveFilter(data.ads, currentFilters);
                
                console.log(`🔍 Filtered by specs: ${data.ads.length} → ${filteredBySpecs.result.length} (${filteredBySpecs.method})`);
                
                if (filteredBySpecs.result.length === 0) {
                  ProgressBar.hide();
                  showToast(`⚠️ Žiadne inzeráty pre "${newQuery}" s týmito filtrami`, { type: "warning", duration: 3000 });
                  return;
                }
                
                if (filteredBySpecs.relaxed) {
                  showToast(`⚡ ${filteredBySpecs.message}`, { type: "info", duration: 3000 });
                }
                
                // 🆕 FILTER BLACKLIST
                const cleanAds = filterBlacklisted([...filteredBySpecs.result]);
                _allAdsForFiltering = cleanAds;
                allFetchedAds = cleanAds;
                
                SmartCache.set(cacheKey, filteredBySpecs.result);
                
                ProgressBar.update(100, 'Hotovo!');
                setTimeout(() => ProgressBar.hide(), 500);
                
                await recalculateEverything(allFetchedAds, true);
                
                showToast(`✅ Našiel som ${filteredBySpecs.result.length} inzerátov pre "${newQuery}"`, { type: "success", duration: 2000 });
              } else {
                ProgressBar.hide();
                showToast(`⚠️ Nenašli sa žiadne inzeráty pre "${newQuery}"`, { type: "warning", duration: 3000 });
              }
            }
          } catch (err) {
            ProgressBar.hide();
            console.error("❌ Auto-search failed:", err);
            showToast("❌ Chyba pri automatickom vyhľadávaní", { type: "error", duration: 3000 });
          } finally {
            if (fetchingIndicator) fetchingIndicator.hidden = true;
          }
        }
      };
      
      // 🆕 FUNCTION TO ATTACH FILTER HANDLERS (call after each re-render)
      // ⚡ USING EVENT DELEGATION (Professional Pattern - Google/React style)
      const attachFilterHandlers = () => {
        console.log(`🔧 Attaching filter handlers via EVENT DELEGATION...`);
        
        // Find the STABLE parent container (never re-rendered)
        const advancedFiltersContainer = qs('[data-advanced-filters]');
        if (!advancedFiltersContainer) {
          console.warn('⚠️ Advanced filters container not found');
          return;
        }
        
        // Remove old delegated listener (if exists)
        if (advancedFiltersContainer._filterDelegateHandler) {
          advancedFiltersContainer.removeEventListener('click', advancedFiltersContainer._filterDelegateHandler);
        }
        
        // 🆕 SINGLE DELEGATED HANDLER (handles ALL filter clicks)
        const filterDelegateHandler = async (e) => {
          console.log(`🖱️ Click detected on:`, e.target);
          
          const target = e.target.closest('[data-filter-ram], [data-filter-ssd], [data-filter-year]');
          if (!target) {
            console.log(`⚠️ Not a filter button, ignoring`);
            return; // Not a filter button
          }
          
          console.log(`✅ Filter button detected:`, target);
          
          e.preventDefault();
          e.stopPropagation();
          
          // Determine filter type and value
          const filterType = target.dataset.filterRam ? 'ram' :
                            target.dataset.filterSsd ? 'ssd' :
                            target.dataset.filterYear ? 'year' : null;
          
          if (!filterType) return;
          
          const value = parseInt(target.dataset[`filter${filterType.charAt(0).toUpperCase() + filterType.slice(1)}`], 10);
          const isActive = currentFilters[filterType] === value;
          
          // Update filter state
          currentFilters[filterType] = isActive ? null : value;
          activeFilters[filterType] = currentFilters[filterType];
          currentActiveFilters[filterType] = currentFilters[filterType];
          
          console.log(`🎯 ${filterType.toUpperCase()} filter clicked: ${value}, new value: ${currentFilters[filterType]}`);
          
          // Update button styles (ALL buttons of this type)
          document.querySelectorAll(`[data-filter-${filterType}]`).forEach(b => b.classList.remove('is-active'));
          if (!isActive) target.classList.add('is-active');
          
          // 🆕 NO AUTO-REFRESH: User must click "Prepočítať" button to apply changes
          // Just update the query input, but don't trigger search
          await updateBazosSearchQuery(false); // false = no auto-search
          
          // Show hint to user
          showToast(`🎯 Filter ${filterType.toUpperCase()} nastavený na ${value}. Klikni "Prepočítať" pre aplikovanie.`, { 
            type: "info", 
            duration: 2500 
          });
        };
        
        // Store reference for cleanup
        advancedFiltersContainer._filterDelegateHandler = filterDelegateHandler;
        
        // Attach the SINGLE listener to PARENT
        advancedFiltersContainer.addEventListener('click', filterDelegateHandler);
        
        console.log(`✅ Event delegation attached to parent container`);
      };
      
      // 🆕 SET GLOBAL REFERENCE so modal can re-attach handlers
      globalAttachFilterHandlers = attachFilterHandlers;
      
      // 🆕 NOTE: Don't call attachFilterHandlers() here!
      // It will be called AFTER modal DOM is created (see line ~3280)
      
      // 🆕 CONDITION FILTER HANDLERS
      document.querySelectorAll("[data-condition]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const condition = btn.dataset.condition;
          currentCondition = condition;
          currentFilters.condition = condition;
          
          // Update button states
          document.querySelectorAll("[data-condition]").forEach(b => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          
          console.log(`🔧 Condition changed to: ${condition}`);
          
          // 🔧 CRITICAL: Use master update function
          await updateMarketData();
          
          console.log(`✅ Price updated for condition: ${condition}`);
        });
      });
      
      // 🆕 BAZOS SEARCH HANDLER
      const bazosSearchInput = qs("[data-bazos-search-input]");
      const bazosSearchBtn = qs("[data-bazos-search-btn]");
      
      if (bazosSearchInput && bazosSearchBtn) {
        // Pre-fill with current query
        const currentQuery = qs("[data-product-name]")?.value?.trim() || "";
        bazosSearchInput.value = currentQuery;
        
        // 🔧 FIX: Remove old listeners before adding new one
        const newBtn = bazosSearchBtn.cloneNode(true);
        bazosSearchBtn.parentNode.replaceChild(newBtn, bazosSearchBtn);
        
        newBtn.addEventListener("click", async () => {
          const searchQuery = bazosSearchInput.value.trim();
          if (!searchQuery) {
            showToast("❌ Zadajte vyhľadávací dotaz", { type: "error", duration: 2000 });
            return;
          }
          
          console.log(`🔍 Bazoš search button clicked: "${searchQuery}"`);
          
          // 🆕 CALL SHARED FUNCTION (same as Recalculate button)
          await reloadAndRecalculate(searchQuery);
        });
        
        // Keep old code for reference
        // OLD CODE REMOVED - now using shared function
        
        // Allow Enter key to trigger search
        bazosSearchInput.addEventListener("keypress", (e) => {
          if (e.key === "Enter") {
            bazosSearchBtn.click();
          }
        });
      }

      // 🆕 UNIFIED MULTI-SOURCE SEARCH HANDLER
      const unifiedSearchBtn = qs("[data-unified-search-btn]");
      if (unifiedSearchBtn) {
        unifiedSearchBtn.addEventListener("click", async () => {
          // Get search query from product name field
          const searchQuery = (qs("[data-product-name]")?.value || "").trim();
          if (!searchQuery) {
            showToast("❌ Zadajte produkt ktorý hľadáte", { type: "error", duration: 2000 });
            return;
          }
          
          // Get selected sources
          const sourceCheckboxes = qsa("[data-source]");
          const selectedSources = Array.from(sourceCheckboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.source);
          
          if (selectedSources.length === 0) {
            showToast("❌ Vyberte aspoň jeden zdroj", { type: "error", duration: 2000 });
            return;
          }
          
          console.log(`🌍 Unified search: "${searchQuery}" from sources: ${selectedSources.join(', ')}`);
          
          // 🆕 RESET DEDUPLICATION
          console.log(`🧹 UNIFIED SEARCH RESET: Clearing old ads (was: ${allFetchedAds.length} ads)`);
          allFetchedAds = [];
          _allAdsForFiltering = [];
          _filteredAdsInternal = [];
          
          showToast(`🌍 Hľadám "${searchQuery}" vo všetkých zdrojoch...`, { type: "info", duration: 3000 });
          
          const fetchingIndicator = qs("[data-fetching-indicator]");
          const fetchingText = qs("[data-fetching-text]");
          
          if (fetchingIndicator) {
            fetchingIndicator.hidden = false;
            if (fetchingText) fetchingText.textContent = `Hľadám vo všetkých zdrojoch...`;
          }
          
          try {
            // Fetch from unified endpoint
            const apiUrl = `/api/unified-search?query=${encodeURIComponent(searchQuery)}&sources=${selectedSources.join(',')}&limit=50`;
            
            const resp = await apiFetch(apiUrl, { method: "GET" });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.ok && Array.isArray(data.ads) && data.ads.length > 0) {
                console.log(`✅ Unified search returned ${data.ads.length} ads from ${Object.keys(data.sourceStats || {}).length} sources`);
                console.log(`📊 Source breakdown:`, data.sourceStats);
                console.log(`📊 Average relevance: ${data.averageRelevance}%`);
                
                // Replace ALL ads with new search results
                // 🆕 FILTER BLACKLIST
                const cleanAds = filterBlacklisted([...data.ads]);
                _allAdsForFiltering = cleanAds;
                allFetchedAds = cleanAds;
                
                // Reset filters and recalculate
                currentFilters = { ram: null, ssd: null, year: null, condition: currentCondition || 'used' };
                activeFilters = { ...currentFilters };
                
                // Rebuild filters and render
                await recalculateEverything(allFetchedAds, true);
                
                // Show detailed toast with source breakdown
                const sourceBreakdown = Object.entries(data.sourceStats || {})
                  .map(([src, count]) => `${src}: ${count}`)
                  .join(', ');
                showToast(`✅ Našiel som ${data.ads.length} inzerátov (${sourceBreakdown})`, { type: "success", duration: 4000 });
              } else {
                showToast("❌ Nenašiel som žiadne inzeráty", { type: "error", duration: 2000 });
              }
            }
          } catch (err) {
            console.error("❌ Unified search failed:", err);
            showToast("❌ Vyhľadávanie zlyhalo", { type: "error", duration: 2000 });
          } finally {
            if (fetchingIndicator) fetchingIndicator.hidden = true;
          }
        });
      }
      
      // 🆕 SIMPLIFIED: No auto-refresh on modal open
      setTimeout(async () => {
        console.log(`📋 Initializing modal with ${allFetchedAds.length} ads`);
        
        // 🔧 REMOVED: applyAdvancedFilters() auto-call - user must explicitly click button
        // Just render what we already have
        renderReviewAdsList();
        updateReviewPrice();
        
        console.log(`✅ Modal initialized (no auto-refresh)`);
        
        // 🔧 CRITICAL: Re-attach event delegation AFTER modal DOM is created
        if (typeof globalAttachFilterHandlers === 'function') {
          console.log(`🔧 Initializing event delegation (AFTER modal is ready)...`);
          globalAttachFilterHandlers();
          console.log(`✅ Event delegation ready - filters are now clickable`);
        } else {
          console.error(`❌ globalAttachFilterHandlers is not defined!`);
        }
      }, 150); // Small delay to ensure handlers are registered
      
      // Handle confirm
      const handleConfirm = async () => {
        const feedbackText = reviewFeedback?.value?.trim() || "";
        
        // Send feedback if provided or if any ads were removed
        const removedAds = (apiResponse?.similarAds || []).filter(ad => 
          !filteredAds.find(f => f.url === ad.url && f.title === ad.title)
        );
        
        // AI RETRY LOGIC: If user provided critical feedback, try to find better ads
        if (feedbackText && feedbackText.length > 15 && retryCount < MAX_RETRIES) {
          retryCount++;
          
          // Close current modal
          if (reviewModal) reviewModal.setAttribute("hidden", "");
          document.body.style.overflow = "";
          
          // Show loading toast
          showToast(`🔄 Hľadám lepšie inzeráty (pokus ${retryCount}/${MAX_RETRIES})...`, { type: "info", duration: 4000 });
          
          try {
            // Call AI to refine search based on feedback
            const productName = (qs("[data-product-name]")?.value ?? "").trim();
            const refinedSearch = await refineSearchWithFeedback(productName, feedbackText, removedAds);
            
            if (refinedSearch && refinedSearch.newAds && refinedSearch.newAds.length > 0) {
              // ONLY UPDATE similarAds, DO NOT TOUCH AI-generated text (title, description, etc.)
              const updatedResponse = {
                ...apiResponse,
                similarAds: refinedSearch.newAds
              };
              
              console.log(`✅ Refine search successful: ${refinedSearch.newAds.length} new ads found`);
              console.log(`   Original query: "${productName}", Refined: "${refinedSearch.refinedQuery}"`);
              
              // Show toast about improvements
              showToast(`✅ Našli sme ${refinedSearch.newAds.length} nových inzerátov podľa vašich požiadaviek`, { type: "success", duration: 3000 });
              
              // Clean up listeners before retry
              reviewConfirmBtn?.removeEventListener("click", handleConfirm);
              reviewCancelBtn?.removeEventListener("click", handleCancel);
              reviewCloseEls.forEach(el => el.removeEventListener("click", handleCancel));
              
              // Clear feedback field for next iteration
              if (reviewFeedback) reviewFeedback.value = "";
              
              // Reopen modal with new ads (recursive call) - ONLY similarAds changed
              const result = await showReviewModal(updatedResponse, true);
              resolve(result);
              return;
            } else {
              console.warn(`⚠️ Refine search returned 0 results. Query: "${refinedSearch?.refinedQuery || productName}"`);
              showToast(`⚠️ Nenašli sme nové inzeráty pre: "${refinedSearch?.refinedQuery || productName}". Skúste upraviť feedback alebo pokračujte s aktuálnymi.`, { type: "warning", duration: 4000 });
            }
          } catch (err) {
            console.warn("Failed to refine search:", err);
            showToast(`❌ Nepodarilo sa nájsť lepšie inzeráty. Pokračujeme s aktuálnymi.`, { type: "error", duration: 3000 });
          }
          
          // Reopen modal if retry failed
          if (reviewModal) reviewModal.removeAttribute("hidden");
          document.body.style.overflow = "hidden";
        }
        
        // Send feedback to backend (for logging & analysis)
        if (feedbackText || removedAds.length > 0) {
          try {
            const productName = (qs("[data-product-name]")?.value ?? "").trim();
            await apiFetch("/api/review-feedback", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                query: productName,
                categoryId: selectedCategory || 16,
                removedAds: removedAds.map(ad => ({
                  title: ad.title,
                  price: ad.price,
                  url: ad.url
                })),
                feedback: feedbackText,
                retryCount,
                timestamp: new Date().toISOString()
              })
            });
          } catch (err) {
            console.warn("Failed to send review feedback:", err);
          }
        }
        
        // 🎯 NO AUTO-RECALCULATE: Use current filtered ads as-is (user's manual selection)
        console.log(`✅ Confirming with ${filteredAds.length} ads (user's selection preserved)`);
        
        // If user manually removed ads (via X button), those are already excluded from filteredAds
        // No need to recalculate - respect user's choices!
        
        // Update API response with filtered ads
        if (reviewData) {
          reviewData.similarAds = filteredAds;
        }
        
        // 🆕 ENSURE MAIN UI SHOWS FILTERED ADS (not all original ads)
        applySimilarAdsToUI(filteredAds, {
          googleFallback: apiResponse?.googleFallback || false,
          googleSearchUrl: apiResponse?.googleSearchUrl || null
        });
        const similarCountEl = qs("[data-similar-count]");
        if (similarCountEl) {
          similarCountEl.textContent = String(filteredAds.length);
        }
        console.log(`✅ Confirmed with ${filteredAds.length} filtered ads (final state)`);
        
        // Close modal
        if (reviewModal) reviewModal.setAttribute("hidden", "");
        document.body.style.overflow = "";
        
        // Clean up listeners
        reviewConfirmBtn?.removeEventListener("click", handleConfirm);
        reviewCancelBtn?.removeEventListener("click", handleCancel);
        reviewCloseEls.forEach(el => el.removeEventListener("click", handleCancel));
        
        // Reset retry count for next generation
        retryCount = 0;
        
        // 🆕 STORE GENERATION DATA (for re-filtering without regeneration)
        lastGeneratedData = {
          ...reviewData,
          allAds: [...allFetchedAds] // Keep all ads for re-filtering
        };
        
        resolve(reviewData);
      };
      
      const handleCancel = () => {
        if (reviewModal) reviewModal.setAttribute("hidden", "");
        document.body.style.overflow = "";
        
        // Clean up listeners
        reviewConfirmBtn?.removeEventListener("click", handleConfirm);
        reviewCancelBtn?.removeEventListener("click", handleCancel);
        reviewCloseEls.forEach(el => el.removeEventListener("click", handleCancel));
        
        reject(new Error("Review cancelled by user"));
      };
      
      // Attach event listeners
      reviewConfirmBtn?.addEventListener("click", handleConfirm);
      reviewCancelBtn?.addEventListener("click", handleCancel);
      reviewCloseEls.forEach(el => el.addEventListener("click", handleCancel));
    });
  };
  
  // 🆕 SHARED FUNCTION: Reload + Recalculate (used by both buttons)
  const reloadAndRecalculate = async (searchQuery) => {
    console.log(`🔄 Reload & Recalculate: "${searchQuery}"`);
    
    // Reset old data
    console.log(`🧹 Clearing old ads (was: ${allFetchedAds.length} ads)`);
    allFetchedAds = [];
    _allAdsForFiltering = [];
    _filteredAdsInternal = [];
    
    showToast(`🔍 Načítavam nové inzeráty...`, { type: "info", duration: 2000 });
    
    const reviewList = qs("[data-review-list]");
    if (reviewList) {
      reviewList.style.opacity = "0.4";
      reviewList.style.pointerEvents = "none";
      reviewList.innerHTML = '<div style="text-align: center; padding: 40px; color: rgba(139,92,246,.9);"><div class="spinner" style="margin: 0 auto 16px;"></div><div>Načítavam...</div></div>';
    }
    
    try {
      // Fetch new data from Bazoš (10 pages = ~200 ads)
      const apiUrl = `/api/bazos-raw?query=${encodeURIComponent(searchQuery)}&limit=200`;
      const resp = await apiFetch(apiUrl, { method: "GET" });
      
      if (resp.ok) {
        const data = await resp.json();
        if (data?.ok && Array.isArray(data.ads) && data.ads.length > 0) {
          console.log(`✅ Loaded ${data.ads.length} ads`);
          
          // Filter blacklist
          const cleanAds = filterBlacklisted([...data.ads]);
          allFetchedAds = cleanAds;
          _allAdsForFiltering = cleanAds;
          
          // Apply current filters
          const filters = currentFilters;
          let filtered = cleanAds.filter(ad => {
            const specs = extractAdSpecs(ad.title, ad.description);
            const matchesRam = !filters.ram || specs.ram === filters.ram;
            const matchesSsd = !filters.ssd || specs.ssd === filters.ssd;
            const matchesYear = !filters.year || specs.year === filters.year;
            return matchesRam && matchesSsd && matchesYear;
          });
          
          // LAX mode if < 20
          if (filtered.length < 20 && cleanAds.length > filtered.length) {
            console.warn(`⚠️ LAX mode: ${filtered.length} → showing all (max 1000€)`);
            filtered = cleanAds.filter(ad => {
              const price = ad.price || 0;
              return price > 0 && price <= 1000;
            });
          }
          
          // Sanity check
          const prices = filtered.map(a => a.price || 0).filter(p => p > 0).sort((a, b) => a - b);
          if (prices.length > 3) {
            const median = prices[Math.floor(prices.length / 2)];
            const maxSane = median * 2;
            const beforeSanity = filtered.length;
            
            filtered = filtered.filter(ad => {
              const price = ad.price || 0;
              return price <= maxSane;
            });
            
            const removed = beforeSanity - filtered.length;
            if (removed > 0) {
              console.log(`✂️ Sanity check: Removed ${removed} outliers`);
            }
          }
          
          // 🆕 PRICE FLOOR: Don't show ads cheaper than user's manual selection
          if (minPriceFloor > 0) {
            const beforeFloor = filtered.length;
            filtered = filtered.filter(ad => {
              const price = ad.price || 0;
              return price >= minPriceFloor;
            });
            const removedByFloor = beforeFloor - filtered.length;
            if (removedByFloor > 0) {
              console.log(`💰 Price floor (${minPriceFloor}€): Removed ${removedByFloor} cheap ads`);
            }
          }
          
          // Update state
          filteredAds = filtered;
          _filteredAdsInternal = filtered;
          
          // Render
          if (reviewList) {
            reviewList.style.opacity = "1";
            reviewList.style.pointerEvents = "auto";
          }
          renderReviewAdsList();
          updateReviewPrice();
          
          showToast(`✅ ${filtered.length} inzerátov načítaných a prepočítaných`, { type: "success", duration: 2000 });
        } else {
          throw new Error("No ads found");
        }
      } else {
        throw new Error("API error");
      }
    } catch (err) {
      console.error("❌ Reload error:", err);
      if (reviewList) {
        reviewList.style.opacity = "1";
        reviewList.style.pointerEvents = "auto";
      }
      showToast("❌ Chyba pri načítavaní", { type: "error", duration: 2000 });
    }
  };
  
  // 🔄 RECALCULATE BUTTON HANDLER
  const setupRecalculateButton = () => {
    const recalcBtn = qs("[data-recalculate-btn]");
    if (!recalcBtn) return;
    
    const recalcIcon = qs("[data-recalc-icon]");
    const recalcText = qs("[data-recalc-text]");
    
    recalcBtn.addEventListener("click", async () => {
      // Prevent double-click
      if (recalcBtn.disabled) return;
      recalcBtn.disabled = true;
      
      // Visual feedback: Change to loading state
      if (recalcIcon) recalcIcon.textContent = "⏳";
      if (recalcText) recalcText.textContent = "Načítavam...";
      recalcBtn.style.opacity = "0.7";
      recalcBtn.style.cursor = "wait";
      
      console.log(`🔄 Recalculate button clicked`);
      
      try {
        // Get current search query
        const searchQuery = qs("[data-bazos-search-input]")?.value?.trim() || 
                           qs("[data-product-name]")?.value?.trim() || "";
        
        if (!searchQuery) {
          showToast("❌ Zadajte vyhľadávací dotaz", { type: "error", duration: 2000 });
          return;
        }
        
        // Call shared function
        await reloadAndRecalculate(searchQuery);
      } catch (err) {
        console.error("❌ Error:", err);
        showToast("❌ Chyba", { type: "error", duration: 2000 });
      } finally {
        // Restore button state
        if (recalcIcon) recalcIcon.textContent = "🔄";
        if (recalcText) recalcText.textContent = "Prepočítať a aktualizovať";
        recalcBtn.style.opacity = "1";
        recalcBtn.style.cursor = "pointer";
        recalcBtn.disabled = false;
      }
    });
  };
  
  // OLD CODE REMOVED

  // 🔗 AFFILIATE LINK BUILDERS (monetization ready)
  const buildHeurekaAffiliateLink = (productName, partnerId = null) => {
    const query = encodeURIComponent(String(productName || 'produkt').trim());
    const baseUrl = `https://www.heureka.sk/?h%5Bfraze%5D=${query}`;
    
    // 🆕 ADD PARTNER ID when registered
    // Example: https://www.heureka.sk/?h[fraze]=macbook&partner_id=YOUR_ID
    if (partnerId) {
      return `${baseUrl}&partner_id=${partnerId}`;
    }
    
    return baseUrl;
  };
  
  const buildGoogleShoppingAffiliateLink = (productName) => {
    const query = encodeURIComponent(String(productName || 'produkt').trim() + ' kúpiť cena');
    return `https://www.google.com/search?q=${query}&tbm=shop`;
  };
  
  const buildAlzaAffiliateLink = (productName, partnerId = null) => {
    const query = encodeURIComponent(String(productName || 'produkt').trim());
    const baseUrl = `https://www.alza.sk/search.htm?exps=${query}`;
    
    // 🆕 ADD ALZA PARTNER ID when registered
    if (partnerId) {
      return `${baseUrl}&partnerId=${partnerId}`;
    }
    
    return baseUrl;
  };
  
  const buildMallAffiliateLink = (productName, partnerId = null) => {
    const query = encodeURIComponent(String(productName || 'produkt').trim());
    const baseUrl = `https://www.mall.sk/hladaj?q=${query}`;
    
    // 🆕 ADD MALL PARTNER ID when registered
    if (partnerId) {
      return `${baseUrl}&aid=${partnerId}`;
    }
    
    return baseUrl;
  };

  const renderReviewAdsList = () => {
    if (!reviewList) return;
    
    reviewList.innerHTML = "";
    
    // 🔧 FIX: Check both filteredAds arrays
    const adsToRender = filteredAds.length > 0 ? filteredAds : _filteredAdsInternal;
    
    console.log(`🔍 Modal rendering: ${adsToRender.length} ads to process`);
    
    // 🆕 STRICT DEDUPLICATION: Only remove TRUE duplicates
    // Duplicate = Same URL OR (EXACT same title AND same price)
    const seenUrls = new Set();
    const seenTitlePrice = new Set();
    const uniqueAds = [];
    
    for (const ad of adsToRender) {
      const url = String(ad?.url || "").trim().toLowerCase();
      const title = String(ad?.title || "").trim(); // Keep original case & formatting
      const price = Number(ad?.price || 0);
      
      if (!title || price <= 0) continue;
      
      // Create exact match key (no normalization!)
      const titlePriceKey = `${title}|${price}`;
      
      // Check for duplicates
      let isDuplicate = false;
      let duplicateReason = "";
      
      // 1. Duplicate by URL
      if (url && seenUrls.has(url)) {
        isDuplicate = true;
        duplicateReason = "URL";
      }
      
      // 2. Duplicate by EXACT title+price
      if (!isDuplicate && seenTitlePrice.has(titlePriceKey)) {
        isDuplicate = true;
        duplicateReason = "title+price";
      }
      
      if (isDuplicate) {
        console.log(`🚫 Duplicate by ${duplicateReason}: "${title}" (${price}€)`);
        continue;
      }
      
      // Mark as seen
      if (url) seenUrls.add(url);
      seenTitlePrice.add(titlePriceKey);
      
      // 🆕 CALCULATE CONFIDENCE SCORE for this ad
      ad.confidence = calculateAdConfidence(ad, adsToRender);
      
      uniqueAds.push(ad);
    }
    
    console.log(`✅ FINAL UNIQUE ADS: ${adsToRender.length} → ${uniqueAds.length} (removed ${adsToRender.length - uniqueAds.length} duplicates)`);
    
    // 🆕 LOG CONFIDENCE DISTRIBUTION
    const highConf = uniqueAds.filter(a => a.confidence?.tier === 'high').length;
    const medConf = uniqueAds.filter(a => a.confidence?.tier === 'medium').length;
    const lowConf = uniqueAds.filter(a => a.confidence?.tier === 'low').length;
    console.log(`🎯 Confidence: ${highConf} high, ${medConf} medium, ${lowConf} low`);
    
    if (uniqueAds.length === 0) {
      reviewList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: rgba(52,43,35,.55);">
          <p style="font-size: 16px; margin-bottom: 8px;">🔍 Žiadne inzeráty na kontrolu</p>
          <p style="font-size: 13px;">Pridajte inzeráty alebo pokračujte bez nich.</p>
        </div>
      `;
      return;
    }
    
    // Get search query for matching
    const searchQuery = (qs("[data-product-name]")?.value ?? "").trim().toLowerCase();
    const queryWords = searchQuery.split(/\s+/).filter(w => w.length >= 3); // Ignore short words like "mi", "v", "s"
    
    // 🆕 CALCULATE SIMILARITY SCORE for visual highlighting
    const adsWithSimilarity = uniqueAds.map(ad => {
      const specs = extractAdSpecs(ad.title, ad.description);
      const title = (ad.title || "").toLowerCase();
      let similarityScore = 0;
      
      // Score based on query words match
      const matchedWords = queryWords.filter(qWord => title.includes(qWord)).length;
      similarityScore += (matchedWords / Math.max(queryWords.length, 1)) * 40;
      
      // Score based on specs (if user searched with specs)
      const querySpecs = extractAdSpecs(searchQuery);
      if (querySpecs.ram && specs.ram === querySpecs.ram) similarityScore += 20;
      if (querySpecs.ssd && specs.ssd === querySpecs.ssd) similarityScore += 20;
      if (querySpecs.year && specs.year === querySpecs.year) similarityScore += 20;
      
      return { ...ad, similarityScore };
    });
    
    console.log(`📋 Rendering ${adsWithSimilarity.length} ads in modal`);
    
    adsWithSimilarity.forEach((ad, index) => {
      const item = document.createElement("div");
      item.className = "reviewAdItem";
      item.dataset.adIndex = index;
      
      const thumb = ad.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Crect fill='%23f5f5f5' width='60' height='60'/%3E%3C/svg%3E";
      
      // Check if ad title matches search query (for "Similar" badge)
      const title = (ad.title || "").toLowerCase();
      const isExactMatch = queryWords.length === 0 || queryWords.some(qWord => title.includes(qWord));
      const isSimilar = ad.isSimilar || false; // From Google fallback
      const similarBadge = (!isExactMatch || isSimilar) ? '<span class="reviewAdItem__badge" style="background: rgba(255,200,0,.2); color: rgba(100,60,0,.88); padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-left: 6px;">⚡ Podobné</span>' : '';
      
      // 🆕 CONFIDENCE BADGE (Apple-level quality indicator)
      const conf = ad.confidence || { tier: 'medium', score: 50 };
      let confidenceBadge = '';
      let confidenceColor = '';
      
      if (conf.tier === 'high') {
        confidenceBadge = '<span style="background: rgba(52,199,89,.15); color: rgba(30,130,50,.95); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-left: 6px;">✓ Overené</span>';
        confidenceColor = 'border-left: 3px solid rgba(52,199,89,0.6);';
      } else if (conf.tier === 'low') {
        confidenceBadge = '<span style="background: rgba(255,59,48,.15); color: rgba(200,30,20,.95); padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-left: 6px;">⚠️ Rizikové</span>';
        confidenceColor = 'border-left: 3px solid rgba(255,59,48,0.6);';
      }
      
      // 🆕 VISUAL HIGHLIGHTING: Blue border for high similarity (>= 60 score)
      const isHighSimilarity = ad.similarityScore >= 60;
      const highlightStyle = isHighSimilarity ? 'border-left: 3px solid rgba(66, 133, 244, 0.8); background: rgba(66, 133, 244, 0.03);' : confidenceColor;
      
      // 🔗 HEUREKA LINK (ready for future affiliate integration)
      // Uncomment when you have Partner ID:
      // const heurekaUrl = buildHeurekaAffiliateLink(ad.title || searchQuery);
      // const heurekaLink = `<a href="${heurekaUrl}" ...>🔍 Heureka</a>`;
      
      item.innerHTML = `
        <img class="reviewAdItem__thumb" src="${thumb}" alt="${ad.title || 'Produkt'}" />
        <div class="reviewAdItem__info">
          <a href="${ad.url || '#'}" target="_blank" rel="noopener noreferrer" class="reviewAdItem__title" style="text-decoration: none; color: inherit; display: block;">
            ${ad.title || "Bez názvu"}${similarBadge}${confidenceBadge}
          </a>
          <div class="reviewAdItem__price">${ad.price ? `${ad.price} €` : "—"}</div>
          <div class="reviewAdItem__source">${ad.source || "neznáme"}${conf.score ? ` • Spoľahlivosť: ${conf.score}%` : ''}</div>
        </div>
        <button class="reviewAdItem__remove" type="button" data-remove-ad="${index}" aria-label="Odstrániť">
          ×
        </button>
      `;
      
      // Apply highlight style
      if (highlightStyle) {
        item.style.cssText = highlightStyle;
      }
      
      // Add data attribute for filtering
      item.dataset.isExactMatch = isExactMatch ? "true" : "false";
      
      reviewList.appendChild(item);
      
      // Attach remove handler
      const removeBtn = item.querySelector(`[data-remove-ad="${index}"]`);
      removeBtn?.addEventListener("click", () => {
        item.classList.add("is-removing");
        setTimeout(() => {
          const adToRemove = uniqueAds[index];
          
          // 🆕 ADD TO PERMANENT BLACKLIST (never show again)
          if (adToRemove?.url) {
            removedAdsBlacklist.add(adToRemove.url);
            console.log(`🚫 Blacklisted: "${adToRemove.title}" (${adToRemove.url})`);
          }
          
          // Remove from ALL arrays
          const removeFromArray = (arr) => {
            const idx = arr.findIndex(a => a.url === adToRemove.url);
            if (idx !== -1) arr.splice(idx, 1);
          };
          
          removeFromArray(filteredAds);
          removeFromArray(allFetchedAds);
          removeFromArray(_allAdsForFiltering);
          
          // 🆕 UPDATE PRICE FLOOR: Don't show ads cheaper than the cheapest remaining ad
          const remainingPrices = filteredAds.map(a => a.price || 0).filter(p => p > 0);
          if (remainingPrices.length > 0) {
            const newFloor = Math.min(...remainingPrices);
            if (newFloor > minPriceFloor) {
              minPriceFloor = newFloor;
              console.log(`💰 Price floor updated: ${minPriceFloor}€ (won't show cheaper ads)`);
            }
          }
          
          renderReviewAdsList();
          updateReviewPrice();
          
          showToast(`🗑️ Inzerát odstránený natrvalo`, { type: "info", duration: 2000 });
        }, 250);
      });
    });
    
    console.log(`✅ Modal rendered with ${reviewList.children.length} items`);
  };
  
  const updateReviewPrice = () => {
    const count = filteredAds.length;
    
    // 🆕 CALCULATE PRICE USING CONDITION-BASED LOGIC
    const prices = filteredAds
      .map(ad => Number(ad.price || 0))
      .filter(p => p > 0)
      .sort((a, b) => a - b);
    
    let fairPrice = 0;
    let adsUsed = 0;
    let pricingMethod = 'insufficient_data';
    
    if (prices.length > 0) {
      const result = calculatePriceByCondition(prices, currentCondition);
      fairPrice = result.fairPrice;
      adsUsed = result.adsUsed;
      pricingMethod = result.method;
    }
    
    // Update UI
    if (reviewPrice) {
      reviewPrice.textContent = fairPrice > 0 ? `${fairPrice} €` : "—";
    }
    
    if (reviewCount) {
      // 🎯 SIMPLIFIED: Just show count without confusing details
      reviewCount.textContent = count === 1 
        ? "Na základe 1 inzerátu" 
        : `Na základe ${count} inzerátov`;
    }
    
    if (reviewBadge) {
      reviewBadge.textContent = count === 1 ? "1 inzerát" : `${count} inzerátov`;
    }
    
    // Show warning if less than 4 ads (can't use trimmed mean)
    if (reviewWarning) {
      if (count < 4 && count > 0 && !reviewWarning.textContent.includes("Presná zhoda")) {
        reviewWarning.textContent = "⚠️ Pozor, nízky počet inzerátov môže skresliť výslednú cenu";
        reviewWarning.removeAttribute("hidden");
      } else if (count >= 4 && !reviewWarning.textContent.includes("Presná zhoda")) {
        reviewWarning.setAttribute("hidden", "");
      }
    }
    
    // 🆕 UPDATE MARKET CONTEXT with real Google Shopping data
    updateMarketContext();
  };
  
  /**
   * 🆕 UPDATE MARKET CONTEXT: Fetch real new model prices from Google Shopping
   */
  const updateMarketContext = async () => {
    const contextTexts = document.querySelectorAll("[data-market-context-text]");
    const contextBoxes = document.querySelectorAll("[data-market-context]");
    
    if (contextTexts.length === 0 || contextBoxes.length === 0) return;
    
    const setAllText = (html) => contextTexts.forEach(el => el.innerHTML = html);
    const setAllHidden = (hidden) => contextBoxes.forEach(el => {
      if (hidden) el.setAttribute("hidden", "");
      else el.removeAttribute("hidden");
    });

    try {
      const productName = productNameInput?.value?.trim() || "";
      
      if (!productName) {
        setAllHidden(true);
        return;
      }
      
      setAllText(`<span style="opacity: 0.6;">Hľadám ceny (Heureka)...</span>`);
      setAllHidden(false);
      
      // 1. Try Heureka Lookup first
      try {
        const hResp = await apiFetch(`/api/heureka/lookup?query=${encodeURIComponent(productName)}`, { method: "GET" });
        if (hResp.ok) {
          const hData = await hResp.json();
          if (hData?.ok && hData.priceMin > 0) {
            const min = hData.priceMin;
            const max = hData.priceMax;
            
            let text = "";
            if (max && max > min * 1.1) {
              text = `${min} € - ${max} € (Heureka)`;
            } else {
              text = `od ${min} € (Heureka)`;
            }
            setAllText(text);
            console.log(`✅ Heureka context: ${min}€ - ${max}€`);
            return;
          }
        }
      } catch (hErr) {
        console.warn("⚠️ Heureka lookup failed, trying Google...", hErr);
      }

      // 2. Fallback to Google Shopping
      setAllText(`<span style="opacity: 0.6;">Hľadám ceny (Google)...</span>`);
      const gResp = await apiFetch(`/api/google-shopping?query=${encodeURIComponent(productName)}&limit=5`, { method: "GET" });
      
      if (gResp.ok) {
        const gData = await gResp.json();
        if (gData?.ok && Array.isArray(gData.results) && gData.results.length > 0) {
          const prices = gData.results.map(item => item.price || 0).filter(p => p > 0).sort((a, b) => a - b);
          if (prices.length > 0) {
            const min = prices[0];
            const max = prices[prices.length - 1];
            let text = "";
            if (prices.length > 1 && max > min * 1.2) {
              text = `${min} € - ${max} € (Google Shopping)`;
            } else {
              text = `od ${min} € (Google)`;
            }
            setAllText(text);
            return;
          }
        }
      }
      
      setAllHidden(true);
    } catch (err) {
      console.error("❌ Market context error:", err);
      setAllHidden(true);
    }
  };
  
  /**
   * Refine search based on user feedback using AI
   */
  const refineSearchWithFeedback = async (productName, feedback, removedAds) => {
    try {
      const resp = await apiFetch("/api/refine-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productName,
          feedback,
          removedAds: removedAds.map(ad => ad.title),
          categoryId: selectedCategory || 16
        })
      });
      
      if (!resp.ok) {
        throw new Error(`API ${resp.status}`);
      }
      
      const data = await resp.json();
      if (!data?.ok) {
        throw new Error(data?.error || "API error");
      }
      
      return data.result; // { newAds: [...], refinedQuery: "..." }
    } catch (err) {
      console.warn("refineSearchWithFeedback failed:", err);
      return null;
    }
  };

  // 🆕 REOPEN FILTERS: Allow user to adjust filters after generation without regenerating text
  const reopenFiltersModal = async () => {
    if (!lastGeneratedData) {
      console.warn("⚠️ No generation data to reopen filters");
      showToast("Najprv vygenerujte inzerát", { type: "warning" });
      return;
    }
    
    console.log("🔄 Reopening filters modal with saved data (no regeneration)");
    showToast("🔧 Upravujete filtre - text inzerátu zostane rovnaký, zmení sa len cena", { type: "info", duration: 3000 });
    
    try {
      // Reopen modal with last generated data and restore filters
      const result = await showReviewModal(lastGeneratedData, false, true);
      
      // 🔧 Calculate price from approved ads (manual calculation)
      const approvedAds = result?.similarAds || [];
      
      if (approvedAds.length >= 3) {
        // Calculate Trimmed Mean (remove top/bottom 15%)
        const prices = approvedAds
          .map(ad => Number(ad.price))
          .filter(p => Number.isFinite(p) && p > 0)
          .sort((a, b) => a - b);
        
        const trimCount = Math.floor(prices.length * 0.15);
        const trimmedPrices = prices.slice(trimCount, -trimCount || undefined);
        
        const sum = trimmedPrices.reduce((acc, p) => acc + p, 0);
        const recommended = Math.round(sum / trimmedPrices.length);
        const quick = Math.round(recommended * 0.85);
        const premium = Math.round(recommended * 1.15);
        
        const pricing = {
          price_recommended: recommended,
          price_quick: quick,
          price_max: premium,
          market: recommended,
          adsUsed: approvedAds.length,
          pricingSource: "client_trimmed_mean_refiltered",
          insufficientData: false
        };
        
        applyPricesToUI(pricing);
        console.log(`✅ Price updated from re-filtered ads: ${recommended}€ from ${approvedAds.length} ads (text unchanged)`);
        showToast(`✅ Cena aktualizovaná: ${recommended}€ (z ${approvedAds.length} inzerátov)`, { type: "success", duration: 2000 });
        
        // Update similar ads in UI
        applySimilarAdsToUI(approvedAds, {
          googleFallback: lastGeneratedData?.googleFallback || false,
          googleSearchUrl: lastGeneratedData?.googleSearchUrl || null
        });
        const similarCountEl = qs("[data-similar-count]");
        if (similarCountEl) similarCountEl.textContent = String(approvedAds.length);
        
        // Update last generated data with new filtered ads
        lastGeneratedData = {
          ...lastGeneratedData,
          similarAds: approvedAds,
          pricing: pricing
        };
      } else {
        showToast("⚠️ Príliš málo inzerátov na výpočet ceny", { type: "warning" });
      }
      
    } catch (err) {
      console.warn("⚠️ Filter adjustment cancelled:", err);
    }
  };
  
  // 🆕 ATTACH EVENT LISTENER TO "UPRAVIŤ FILTRE" BUTTON
  if (reopenFiltersBtn) {
    reopenFiltersBtn.addEventListener("click", reopenFiltersModal);
  }

  const evaluateFlow = async ({ mode }) => {
    if (!evaluateBtn) return;
    if (isEvaluating) return;
    isEvaluating = true;

    const originalText =
      evaluateBtn.querySelector(".cta__text")?.textContent || "Vytvoriť expertný audit";
    evaluateBtn.classList.add("is-loading");
    evaluateBtn.setAttribute("disabled", "");
    const t = evaluateBtn.querySelector(".cta__text");
    if (t) t.textContent = "Analyzujem dáta…";

    if (mode === "auto") {
      showToast("Spúšťam technický audit…", { type: "info" });
    } else {
      showToast("Spúšťam technický audit…", { type: "info" });
    }

    updateHeurekaLinks();

    try {
      if (!uploadedImageDataUrl) {
        showToast("Najprv pridajte fotku produktu (klik na +).", { type: "error" });
        return;
      }
      
      // 🔧 PHASE 1: Fetch ads → Show modal → Get user confirmation
      const productQuery = getProductQuery();
      let freshAds = [];
      if (productQuery) {
        console.log(`🔍 PHASE 1: Fetching fresh ads for: "${productQuery}"`);
        if (t) t.textContent = "📊 Hľadám 60+ inzerátov...";
        showToast("📊 Hľadám 60+ inzerátov pre presný odhad ceny...", { type: "info", duration: 3000 });
        try {
          // Fetch fresh ads directly from API
          let apiUrl = `/api/market/search?source=multi&limit=15&query=${encodeURIComponent(productQuery)}`;
          if (selectedCategory) {
            apiUrl += `&category=${selectedCategory}`;
          }
          const resp = await apiFetch(apiUrl, { method: "GET" });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.ok && Array.isArray(data.ads)) {
              freshAds = data.ads;
              console.log(`✅ Fetched ${freshAds.length} fresh ads for pricing`);
              if (freshAds.length < 40) {
                console.warn(`⚠️ Only ${freshAds.length} ads found - target is 60+`);
                showToast(`⚠️ Našiel som len ${freshAds.length} inzerátov (ideál je 60+)`, { type: "warning", duration: 3000 });
              } else {
                showToast(`✅ Našiel som ${freshAds.length} inzerátov`, { type: "success", duration: 2000 });
              }
            }
          }
        } catch (searchErr) {
          console.warn("⚠️ Failed to fetch fresh ads:", searchErr);
          showToast("⚠️ Chyba pri načítaní inzerátov", { type: "warning", duration: 3000 });
        }
      }
      
      if (freshAds.length === 0) {
        showToast("❌ Nenašiel som žiadne podobné inzeráty. Skúste upraviť názov produktu.", { type: "error", duration: 5000 });
        return;
      }
      
      // 🆕 SHOW MODAL FIRST (before AI generation)
      console.log(`🔵 PHASE 1 COMPLETE: Opening modal with ${freshAds.length} ads`);
      if (t) t.textContent = "Skontrolujte inzeráty...";
      
      // Create a temporary response object for the modal (without AI-generated text yet)
      const tempResponse = {
        similarAds: freshAds,
        googleFallback: false,
        googleSearchUrl: null
      };
      
      // Open modal and wait for user confirmation
      const reviewedData = await showReviewModal(tempResponse);
      
      if (!reviewedData || !reviewedData.similarAds || reviewedData.similarAds.length === 0) {
        showToast("❌ Generovanie zrušené - žiadne inzeráty na výpočet ceny.", { type: "error" });
        return;
      }
      
      // 🤖 PHASE 2: After user confirmation, NOW generate AI text
      console.log(`🔵 PHASE 2: User confirmed ${reviewedData.similarAds.length} ads - NOW generating AI text`);
      if (t) t.textContent = "Generujem inzerát...";
      showToast("🤖 Generujem profesionálny inzerát...", { type: "info", duration: 3000 });
      
      // 🔧 FIX: DO NOT OVERWRITE #output grid!
      // We keep the grid and just update parts of it.
      
      const out = await callEvaluateApi(reviewedData.similarAds);
      
      // 🔍 DEBUG: Check what API returned
      console.log("🔍 API Response:", {
        hasPricing: !!out?.pricing,
        hasPrices: !!out?.prices,
        pricing: out?.pricing,
        prices: out?.prices
      });
      
      // Quick visibility: ensure backend actually received the image
      if (out?.debug?.imageReceived === false) {
        showToast("Backend nedostal fotku – skúste ju pridať znova.", { type: "error" });
      }
      if (out?.debug?.identification && out.debug.identification.confidence < 0.6) {
        showToast("Fotku sa nepodarilo spoľahlivo rozpoznať. Skúste dopísať názov (napr. iPhone 13).", { type: "info" });
      }
      
      // CHECK: If insufficient data (< 3 relevant ads)
      const pricing = out?.pricing || out?.prices || {};
      if (pricing.insufficientData) {
        console.warn("⚠️ Insufficient data - cannot estimate price");
        
        // Show warning toast
        showToast("⚠️ " + (pricing.message || "Nedostatok dát na určenie ceny. Našli sme príliš málo relevantných inzerátov."), { type: "error", duration: 8000 });
        
        // Show tip
        showToast("💡 Tip: Skúste zadať presnejší názov produktu (napr. 'iPhone 13 Pro' namiesto len 'mobil') alebo vyberte správnu kategóriu.", { type: "info", duration: 10000 });
        
        // Continue to show the ad text, but WITHOUT price
        // applyPricesToUI will handle showing "—" instead of price
      }
      
      // CHECK: If pricing requires user selection (extreme variance)
      if (pricing.requiresUserSelection) {
        console.log("💰 Extreme price variance detected - showing category selection modal");
        const selectedCategory = await showPriceCategoryModal(pricing);
        
        if (!selectedCategory) {
          // User cancelled
          showToast("Generovanie inzerátu zrušené.", { type: "info" });
          return;
        }
        
        // Recalculate with selected price category
        pricing.price_recommended = selectedCategory.price;
        pricing.price_low = Math.round(selectedCategory.price * 0.85);
        pricing.price_high = Math.round(selectedCategory.price * 1.15);
        pricing.pricingSource = "user_selected_category";
        pricing.pricingConfidence = 0.95; // High confidence since user confirmed
        
        // Update out object
        out.pricing = pricing;
        out.prices = pricing;
        
        showToast(`✅ Cena nastavená na ${selectedCategory.label}: €${selectedCategory.price}`, { type: "success", duration: 4000 });
      }
      
      // 🔧 NO SECOND MODAL - we already showed it before generation!
      // Now just apply prices and show the approved ads
      
      // 🔧 MANUAL PRICE CALCULATION from approved ads (if backend didn't calculate)
      let finalPricing = out?.pricing || out?.prices;
      
      if (!finalPricing || !finalPricing.price_recommended) {
        console.log("⚠️ Backend didn't return pricing - calculating manually from approved ads");
        const approvedAds = reviewedData?.similarAds || [];
        
        if (approvedAds.length >= 3) {
          // Calculate Trimmed Mean (remove top/bottom 15%)
          const prices = approvedAds
            .map(ad => Number(ad.price))
            .filter(p => Number.isFinite(p) && p > 0)
            .sort((a, b) => a - b);
          
          const trimCount = Math.floor(prices.length * 0.15);
          const trimmedPrices = prices.slice(trimCount, -trimCount || undefined);
          
          const sum = trimmedPrices.reduce((acc, p) => acc + p, 0);
          const recommended = Math.round(sum / trimmedPrices.length);

          finalPricing = {
            price_recommended: recommended,
            price_quick: Math.round(recommended * 0.85),
            price_max: Math.round(recommended * 1.15),
            market: recommended,
            adsUsed: approvedAds.length,
            pricingSource: "client_trimmed_mean",
            insufficientData: false
          };
          
          console.log(`✅ Calculated price manually: ${recommended}€ from ${approvedAds.length} ads`);
        } else {
          console.warn("⚠️ Not enough ads for pricing");
          finalPricing = { insufficientData: true };
        }
      }

      // ⚖️ APPLY GLOBAL ADJUSTMENTS (Condition, Battery, Warranty)
      const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
      if (finalPricing && !finalPricing.insufficientData) {
        let recommended = finalPricing.price_recommended;
        
        const deviceConditionInput = qs("[data-device-condition]");
        const conditionPct = Number(deviceConditionInput?.value) || 100;
        
        const batteryInput = currentMode === "sell" ? qs("[data-battery-health-sell]") : qs("[data-battery-health]");
        const batteryVal = Number(batteryInput?.value) || 100;
        
        const warrantyInput = currentMode === "sell" ? qs("[data-has-warranty-sell]") : qs("[data-has-warranty]");
        const hasWarranty = warrantyInput?.checked;

        if (currentMode === "sell") {
          // 1. Condition Adjustment
          recommended = Math.round(recommended * (conditionPct / 100));
          console.log(`⚖️ Condition Adjustment: ${conditionPct}%, Recommended=${recommended}€`);

          // 2. Battery Penalty (Granular)
          let batteryPenalty = 0;
          if (batteryVal < 100) {
            if (batteryVal >= 95) batteryPenalty = 0;
            else if (batteryVal >= 90) batteryPenalty = 25;
            else if (batteryVal >= 85) batteryPenalty = 50;
            else if (batteryVal >= 80) batteryPenalty = 80;
            else batteryPenalty = 120; // Nutná výmena
          }
          recommended -= batteryPenalty;
          console.log(`🔋 Battery Penalty: ${batteryVal}%, Recommended=${recommended}€ (-${batteryPenalty}€)`);

          // 3. Warranty Bonus
          if (hasWarranty) {
            recommended += 30;
            console.log(`⚖️ Warranty Bonus: +30€, Recommended=${recommended}€`);
          }

          // Update finalPricing object with adjusted values
          finalPricing.price_recommended = recommended;
          finalPricing.price_quick = Math.round(recommended * 0.85);
          finalPricing.price_max = Math.round(recommended * 1.15);
          finalPricing.market = recommended;
        }

        // 📋 UPDATE CHECKLIST
        const checkList = qs(".checkList");
        if (checkList) {
          // Clear mock items or previous results
          checkList.innerHTML = "";
          
          if (currentMode === "sell") {
            // 1. Cosmetic issues if condition < 90%
            if (conditionPct < 90) {
              const warningItem = document.createElement("div");
              warningItem.className = "checkItem is-bad";
              warningItem.innerHTML = "<span>⚠️</span> Nutné upozorniť na kozmetické vady";
              checkList.appendChild(warningItem);
            }

            // 2. Battery Health
            if (batteryVal > 90) {
              const item = document.createElement("div");
              item.className = "checkItem is-good";
              item.innerHTML = "<span>✔️</span> Nadštandardná kapacita batérie";
              checkList.appendChild(item);
            } else if (batteryVal < 86) {
              const item = document.createElement("div");
              item.className = "checkItem is-bad";
              item.innerHTML = "<span>🪫</span> Slabá batéria (nutná výmena)";
              checkList.appendChild(item);
            }

            // 3. Accessories
            const hasBox = qs("[data-acc='box']")?.checked;
            if (hasBox) {
              const item = document.createElement("div");
              item.className = "checkItem is-good";
              item.innerHTML = "<span>📦</span> Kompletné balenie zvyšuje hodnotu";
              checkList.appendChild(item);
            }

            // 4. Visual Condition
            if (conditionPct > 95) {
              const item = document.createElement("div");
              item.className = "checkItem is-good";
              item.innerHTML = "<span>✨</span> Vizuálny stav nového zariadenia";
              checkList.appendChild(item);
            }

            // 5. Warranty
            if (hasWarranty) {
              const item = document.createElement("div");
              item.className = "checkItem is-good";
              item.innerHTML = "<span>📄</span> Zariadenie je v platnej záruke";
              checkList.appendChild(item);
            }
          } else {
            // Buy mode: add some default checks if needed
            checkList.innerHTML = `
              <div class="checkItem is-good"><span>✔️</span> Pôvodný displej</div>
              <div class="checkItem is-good"><span>✔️</span> FaceID funkčné</div>
              <div class="checkItem is-good"><span>✔️</span> Bez blokovania iCloud</div>
            `;
          }
        }
      }
      
      applyPricesToUI(finalPricing);
      
      // Show the ads that user already approved in the modal
      const approvedAds = reviewedData?.similarAds || [];
      applySimilarAdsToUI(approvedAds, {
        googleFallback: reviewedData?.googleFallback || false,
        googleSearchUrl: reviewedData?.googleSearchUrl || null
      });
      if (similarCountEl) similarCountEl.textContent = String(approvedAds.length);
      
      // 🆕 SHOW "UPRAVIŤ FILTRE" BUTTON (allow price adjustment without regeneration)
      if (reopenFiltersBtn && approvedAds.length > 0) {
        reopenFiltersBtn.hidden = false;
        console.log("✅ 'Upraviť filtre' button enabled");
      }
      
      // Check if AI determined product is old/cheap and update placeholder accordingly
      const p = out?.pricing || out?.prices || null;
      const isOldOrCheap = p && (p.price_recommended < 50 || p.state === "destroyed");
      updateNotesPlaceholder({ isOldOrCheap });
      // Pricing transparency: show how many market ads were used + whether Heureka cap applied
      if (priceNoteEl || similarCountEl) {
        const ads = Array.from(document.querySelectorAll(".similarItem[data-ad-price]")).map((el) => ({
          source: el.dataset.adSource || "",
        }));
        const usedAds = ads.filter((a) => String(a?.source || "") !== "heureka");
        const n = usedAds.length;
        if (similarCountEl) similarCountEl.textContent = String(n);
        const p = out?.pricing || null;
        const benchLine =
          p && (p.bazaarMin || p.bazaarMid || p.bazaarMax)
            ? ` • Bazoš (min/median/max z ${p.bazaarUsedCount ?? 0}/${p.bazaarNeedMin ?? 15}): €${p.bazaarMin ?? "—"} / €${p.bazaarMid ?? "—"} / €${p.bazaarMax ?? "—"}.`
            : "";
        const noteLine =
          p && p.state === "unboxed"
            ? " • Stav: rozbalené (×0.85)."
            : p && p.state === "used"
              ? " • Stav: používané (×1.0)."
              : "";
        const warnLine = p && p.bazaarHaveEnough === false ? " • Pozor: málo inzerátov na Bazoši (cieľ je aspoň 15) – odhad je menej stabilný." : "";
        if (priceNoteEl) {
          // Keep it human and short (no technical jargon).
          priceNoteEl.textContent = `Cena vypočítaná z ${n} podobných inzerátov.${benchLine}${noteLine}${warnLine}`;
        }
      }
      
      // NEW: Display search debug info (category + query)
      const searchInfoEl = qs("[data-search-info]");
      const searchCategoryEl = qs("[data-search-category]");
      const searchQueryEl = qs("[data-search-query]");
      
      if (searchInfoEl && searchCategoryEl && searchQueryEl) {
        const productName = out?.productName || out?.data?.title || "";
        const finalCategory = selectedCategory || 16;
        const categoryName = CATEGORIES.find(c => c.id === finalCategory)?.name || "Elektro";
        
        searchInfoEl.removeAttribute("hidden");
        searchCategoryEl.innerHTML = `🔍 <strong>Kategória:</strong> ${categoryName}`;
        searchQueryEl.innerHTML = `📝 <strong>Výraz:</strong> ${productName || "(z fotky)"}`;
      }
      
      // NEW: Display pricing protection metadata
      const pricingInfoEl = qs("[data-pricing-info]");
      const pricingSourceEl = qs("[data-pricing-source]");
      const pricingAdsEl = qs("[data-pricing-ads]");
      
      if (pricingInfoEl && pricingSourceEl && pricingAdsEl) {
        const p = out?.pricing || null;
        
        if (p && (p.pricingSource || p.adsUsed !== undefined)) {
          // Show pricing info section
          pricingInfoEl.removeAttribute("hidden");
          
          // Format source info (NEW: Trimmed Mean method)
          const sourceMap = {
            "bazos_trimmed_mean": "Robustná matematika (Trimmed Mean 50%)",
            "bazos_verified": "Overené Bazoš dáta",
            "bazos_median": "Medián z Bazoš inzerátov",
            "google_estimate": "Odhad z trhovej ceny (70%)",
            "google_corrected": "Opravené podľa trhovej ceny",
            "unknown": "Inteligentný odhad AI"
          };
          const sourceName = sourceMap[p.pricingSource] || "Inteligentný odhad AI";
          const confidence = p.pricingConfidence ? Math.round(p.pricingConfidence * 100) : 0;
          const confidenceText = confidence > 0 ? ` (spoľahlivosť: ${confidence}%)` : "";
          
          pricingSourceEl.innerHTML = `<strong>Zdroj ceny:</strong> ${sourceName}${confidenceText}`;
          
          // Format ads info (NEW: Trimmed Mean explanation)
          const adsUsed = p.adsUsed || p.bazaarUsedCount || 0;
          const adsTotal = p.adsTotal || adsUsed;
          const adsRemoved = p.adsFiltered || (adsTotal - adsUsed);
          
          // NEW TEXT: "Analyzovaných {n} inzerátov z Bazoša. Extrémy boli matematicky odstránené pre vyššiu presnosť."
          const adsText = adsRemoved > 0 
            ? `Analyzovaných ${adsTotal} inzerátov z Bazoša. Extrémy (${adsRemoved}) boli matematicky odstránené pre vyššiu presnosť.`
            : `Analyzovaných ${adsUsed} inzerátov z Bazoša.`;
          
          pricingAdsEl.innerHTML = `<strong>📊</strong> ${adsText}`;
          
          // Show warnings if any
          if (p.pricingWarnings && Array.isArray(p.pricingWarnings) && p.pricingWarnings.length > 0) {
            for (const warning of p.pricingWarnings) {
              showToast(`ℹ️ ${warning}`, { type: "info", duration: 6000 });
            }
          }
          
          // Show fallback notice if applicable
          if (p.pricingFallback) {
            showToast("⚠️ Nedostatok overených dát z bazárov. Cena odhadnutá podľa trhovej ceny nového kusu.", { type: "info", duration: 8000 });
          }
        } else {
          // Hide pricing info if not available
          pricingInfoEl.setAttribute("hidden", "");
        }
      }
      if (benefitsTitleEl) benefitsTitleEl.textContent = "Hlavné výhody";
      renderBenefits(out.benefits || []);
      renderWhyBuyThis(out.whyBuyThis || []);
      renderFunnyPriceNote(out.funnyPriceNote || "");
      renderSpecs(out.specs || [], out.specs_note || "");
      lastDefects = Array.isArray(out.defects) ? out.defects : [];
      if (toggleDefectsEl?.checked) renderDefectOverlay(lastDefects);
      else clearDefectOverlay();
      
      // Display AI warnings if any
      if (out.ai_warnings && out.ai_warnings.length > 0) {
        for (const warning of out.ai_warnings) {
          showToast(warning.message, { type: "info", duration: 8000 });
        }
      }
      // 🆕 Render full result HTML directly into #output
      const renderResultToOutput = (data) => {
        const outputContainer = document.getElementById("output");
        if (!outputContainer) return;
        
        const escapeHtml = (str) => String(str || "").replace(/[&<>"']/g, (m) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
        
        const whyBuyHtml = (data.whyBuyThis && Array.isArray(data.whyBuyThis) && data.whyBuyThis.length > 0)
          ? `<div class="result__whyBuySection" style="margin: 16px 0;">
              <div class="result__sectionTitle" style="margin-bottom: 10px;">✨ Prečo kúpiť práve tento kus</div>
              <div class="whyBuyList" style="display: flex; flex-direction: column; gap: 8px;">
                ${data.whyBuyThis.map(item => `<div class="whyBuyList__item">${escapeHtml(item)}</div>`).join('')}
              </div>
            </div>`
          : '';
        
        const funnyNoteHtml = data.funnyPriceNote
          ? `<div class="funnyPriceNote" style="margin: 16px 0; padding: 12px 16px; background: rgba(255, 200, 0, 0.1); border-left: 3px solid rgba(255, 180, 0, 0.8); border-radius: 6px; display: flex; align-items: center; gap: 12px; font-size: 14px;">
              <span class="funnyPriceNote__icon" style="font-size: 24px;">😄</span>
              <span class="funnyPriceNote__text" style="flex: 1; line-height: 1.5; font-style: italic;">${escapeHtml(data.funnyPriceNote)}</span>
            </div>`
          : '';
        
        const techHtml = (data.specs && Array.isArray(data.specs) && data.specs.length > 0)
          ? `<div class="techLine" style="margin: 12px 0; padding: 10px; background: rgba(52, 152, 219, 0.05); border-left: 3px solid rgba(52, 152, 219, 0.3); border-radius: 4px;">
              <span class="techLine__label" style="font-weight: 600; color: rgba(52, 43, 35, 0.88);">Technické info:</span>
              <span class="techLine__text">${data.specs.map(escapeHtml).join(' • ')}</span>
            </div>`
          : '';
        
        const pricing = data.pricing || data.prices || {};
        const priceValue = pricing.price_recommended || pricing.price || "—";
        
        outputContainer.innerHTML = `
          <div class="result">
            <div class="result__top">
              <div class="result__badge">Váš návrh inzerátu</div>
              <div class="result__meta">
                <span class="result__chip">SEO titulok</span>
                <span class="result__chip">Prémiový popis</span>
                <span class="result__chip">Cena</span>
              </div>
            </div>
            <div class="result__instruction">
              📋 Váš návrh inzerátu je pripravený. Skontrolujte ho, skopírujte a publikujte.
            </div>
            <div class="result__title" data-result-title>${escapeHtml(data.title || "")}</div>
            <div class="result__desc" data-result-desc>${escapeHtml(data.desc || "")}</div>
            ${techHtml}
            <div class="result__sectionTitle">Praktické výhody</div>
            <div class="benefitsText">${(data.benefits || []).map(escapeHtml).join(' • ')}</div>
            ${whyBuyHtml}
            ${funnyNoteHtml}
            <div class="aiWarning">
              <div class="aiWarning__icon">⚠️</div>
              <div class="aiWarning__text">
                <strong>AI sa môže mýliť.</strong> Pred zverejnením inzerátu si, prosím, skontrolujte technické údaje (napr. stav batérie a cenu). 
                Ak niečo nesedí, napíšte mi to do chatu nižšie a ja to opravím.
              </div>
            </div>
            <div class="legalDisclaimer">
              <div class="legalDisclaimer__icon">⚖️</div>
              <div class="legalDisclaimer__text">
                <strong>Upozornenie:</strong> Tento text a odhad ceny slúžia výhradne ako koncept vygenerovaný umelou inteligenciou. 
                Pred zverejnením inzerátu si, prosím, dôkladne skontrolujte a opravte všetky údaje (najmä technické 
                parametre a cenu), aby na 100 % súhlasili s realitou. <strong>Odhadovaná cena je len orientačná a nezohľadňuje 
                všetky individuálne faktory.</strong> Platforma PREDAJTO.AI nenesie žiadnu zodpovednosť za správnosť 
                vygenerovaného textu, odhadovanej ceny ani za ich následné použitie.
                <br><br>
                <strong>Predajto.ai nie je spojené, sponzorované ani schválené spoločnosťou Bazoš alebo Heureka.</strong> 
                Ide o nezávislý treťostranový nástroj.
              </div>
            </div>
            <div class="confirmBox">
              <label class="confirmBox__label">
                <input type="checkbox" class="confirmBox__checkbox" data-confirm-checkbox />
                <span class="confirmBox__text">
                  Beriem na vedomie, že ide o AI koncept (vrátane odhadu ceny) a potvrdzujem, že som inzerát a cenu skontroloval a súhlasí s realitou.
                </span>
              </label>
            </div>
            <div class="result__bottom">
              <div class="result__actions">
                <button class="ghostBtn" type="button" data-copy>Skopírovať text</button>
                <div class="feedbackBtns">
                  <button class="feedbackBtn feedbackBtn--up" type="button" data-feedback="positive" title="Dobrý inzerát">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/>
                    </svg>
                  </button>
                  <button class="feedbackBtn feedbackBtn--down" type="button" data-feedback="negative" title="Potrebuje opravu">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17 14V2M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="editAdSection">
              <div class="editAdSection__hint">💡 Niečo nesedí? Napíš pokyn a AI to opraví</div>
              <div class="editAdSection__row">
                <input 
                  type="text" 
                  class="editAdSection__input" 
                  placeholder="Napr. 'Prestaň písať o renovácii, je to vrak. Daj cenu 10 eur.'"
                  data-edit-request
                />
                <button class="editAdSection__btn" data-edit-submit>
                  <span class="editAdSection__btnText">Upraviť</span>
                </button>
              </div>
              <button class="editAdSection__undo" data-edit-undo hidden>
                <span class="editAdSection__undoIcon">↩️</span>
                <span class="editAdSection__undoText">Vrátiť späť</span>
              </button>
            </div>
          </div>
        `;
      };
      
      // Call the render function
      renderResultToOutput(out);
      
      // Persist detected name back to name input so future runs + Heureka links stay aligned
      const inp = qs("[data-product-name]");
      if (inp && !inp.value.trim() && out.title) inp.value = out.title;
      updateHeurekaLinks();
      
      // Store current ad for editing
      if (window.storeCurrentAd) {
        window.storeCurrentAd({
          title: out.title || titleFull,
          desc: out.desc || descFull,
          benefits: out.benefits || [],
          pricing: out.pricing || out.prices || {},
        });
      }
      
      // Reset edit counter on new generation (user gets 3 new free edits)
      if (window.resetEditCounter) {
        window.resetEditCounter();
      }
      
      showToast("Hotovo – vygenerované.", { type: "success" });
    } catch (err) {
      const msg = String(err?.message || "");
      // Show the actual error (trimmed) to make debugging immediate.
      const brief = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg || "Neznáma chyba";
      if (msg.includes("API 404")) {
        showToast(`AI API sa nenašlo. Skontrolujte, že beží: ${API_BASE}`, { type: "error" });
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        showToast(
          `Nepodarilo sa pripojiť na backend. Skúšané: ${API_HOSTS.join(", ")}. Skontrolujte \`node server.mjs\`.`,
          { type: "error" }
        );
      } else {
        showToast(brief, { type: "error" });
      }
    } finally {
      evaluateBtn.classList.remove("is-loading");
      evaluateBtn.removeAttribute("disabled");
      const tt = evaluateBtn.querySelector(".cta__text");
      if (tt) tt.textContent = originalText;
      isEvaluating = false;
    }
  };

  // Auto re-calc after user refines the product model (no re-upload needed)
  productNameInput?.addEventListener("focus", () => {
    clearProductNameHintIfNeeded();
  });
  productNameInput?.addEventListener("input", () => {
    clearProductNameHintIfNeeded();
    if (!uploadedImageDataUrl) return;
    const q = getProductQuery();
    if (!q || q.length < 3) return;
    window.clearTimeout(autoRecalcTimer);
    autoRecalcTimer = window.setTimeout(() => {
      evaluateFlow({ mode: "auto" });
    }, 650);
  });

  // Toggles behavior
  toggleBgEl?.addEventListener("change", async () => {
    if (!originalImageDataUrl) return;
    if (toggleBgEl.checked) {
      // Apply blur - await to ensure it completes
      await applyBackgroundBlurIfEnabled();
    } else {
      // Restore original
      bgRemovedImageDataUrl = "";
      uploadedImageDataUrl = originalImageDataUrl;
      setUploadPreview(originalImageDataUrl);
      showToast("Pozadie ponechané.", { type: "info" });
    }
  });
  toggleHighlightEl?.addEventListener("change", () => {
    // Re-render current benefits without calling backend
    renderBenefits(lastBenefits);
  });
  toggleDefectsEl?.addEventListener("change", () => {
    if (!toggleDefectsEl.checked) {
      lastDefects = [];
      clearDefectOverlay();
      return;
    }
    if (!uploadedImageDataUrl) {
      showToast("Najprv nahrajte fotku, potom skúste detekciu vád.", { type: "info" });
      return;
    }
    // Defect detection will run when user clicks "Generovať" – no auto-evaluation.
    showToast("Detekcia vád bude zahrnutá pri generovaní inzerátu.", { type: "info" });
  });

  // Cache helper functions (12h cache for Bazoš data to respect their server)
  const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
  const CACHE_PREFIX = "predajto_cache_bazos_";

  const getCachedBazosData = (query) => {
    try {
      const cacheKey = CACHE_PREFIX + encodeURIComponent(query.toLowerCase().trim());
      const cached = localStorage.getItem(cacheKey);
      if (!cached) return null;
      const { timestamp, data } = JSON.parse(cached);
      const now = Date.now();
      if (now - timestamp > CACHE_DURATION) {
        // Cache expired, remove it
        localStorage.removeItem(cacheKey);
        return null;
      }
      return data;
    } catch {
      return null;
    }
  };

  const setCachedBazosData = (query, data) => {
    try {
      const cacheKey = CACHE_PREFIX + encodeURIComponent(query.toLowerCase().trim());
      const cacheEntry = {
        timestamp: Date.now(),
        data: data
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (err) {
      // localStorage full or disabled, silently fail
    }
  };

  // Real ads search (best-effort): fetches real Bazoš results with URLs & prices and uses them for pricing immediately.
  const searchMarketAds = async ({ silent = false, forceRefresh = false } = {}) => {
    const query = getMarketQuery();
    if (!query) {
      if (!silent) showToast("Najprv zadajte názov produktu (napr. iPhone 13).", { type: "error" });
      return;
    }

    // Check cache first (unless forced refresh)
    if (!forceRefresh) {
      const cachedAds = getCachedBazosData(query);
      if (cachedAds) {
        applySimilarAdsToUI(cachedAds);
        if (similarCountEl) similarCountEl.textContent = String(cachedAds.length);
        
        // Apply pricing from cached data
        if (cachedAds.length) {
          let sum = 0;
          let wsum = 0;
          for (const a of cachedAds) {
            const p = Number(a?.price || 0);
            if (!(p > 0)) continue;
            const cond = Number(a?.condition || 90);
            const w = Math.min(1.2, Math.max(0.4, cond / 100));
            sum += p * w;
            wsum += w;
          }
          const fair = wsum ? Math.round(sum / wsum) : 0;
          if (fair > 0) {
            const step = Number(range?.step || 5) || 5;
            const roundTo = (v) => Math.round(v / step) * step;
            const prices = {
              price_recommended: roundTo(fair),
              price_low: roundTo(fair * 0.85),
              price_high: roundTo(fair * 1.15),
              quick: roundTo(fair * 0.85),
              market: roundTo(fair),
              premium: roundTo(fair * 1.1),
            };
            applyPricesToUI(prices);
          }
        }
        
        if (!silent) showToast(`Načítané z cache (${cachedAds.length} inzerátov). Rešpektujeme Bazoš server.`, { type: "success" });
        return;
      }
    }

    if (!silent) showToast("🔍 Hľadám (Bazoš + Heureka cez Google)...", { type: "info" });
    
    // Build API URL with category filter
    let apiUrl = `/api/market/search?source=multi&limit=70&query=${encodeURIComponent(query)}`; // Changed: 70 ads for better price calculation (target 30+ after filtering)
    if (selectedCategory) {
      apiUrl += `&category=${selectedCategory}`;
    }
    
    const resp = await apiFetch(apiUrl, { method: "GET" });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    if (!data?.ok) throw new Error(data?.error || "API error");
    const ads = Array.isArray(data.ads) ? data.ads : [];
    
    // Cache the results for 12 hours
    setCachedBazosData(query, ads);
    
    applySimilarAdsToUI(ads);
    if (similarCountEl) similarCountEl.textContent = String(ads.length);

    // Immediate "facts" pricing from the real ads (no image needed).
    if (ads.length) {
      let sum = 0;
      let wsum = 0;
      for (const a of ads) {
        const p = Number(a?.price || 0);
        if (!(p > 0)) continue;
        const cond = Number(a?.condition || 90);
        const w = Math.min(1.2, Math.max(0.4, cond / 100));
        sum += p * w;
        wsum += w;
      }
      const fair = wsum ? Math.round(sum / wsum) : 0;
      if (fair > 0) {
        const step = Number(range?.step || 5) || 5;
        const roundTo = (v) => Math.round(v / step) * step;
        const prices = {
          price_recommended: roundTo(fair),
          price_low: roundTo(fair * 0.85),
          price_high: roundTo(fair * 1.15),
          quick: roundTo(fair * 0.85),
          market: roundTo(fair),
          premium: roundTo(fair * 1.1),
        };
        applyPricesToUI(prices);
      }
    }
    if (!silent) showToast(`Našiel som ${ads.length} reálnych inzerátov (cache 12h).`, { type: "success" });
  };

  const openMarketSources = async () => {
    const query = getMarketQuery();
    if (!query) {
      showToast("Najprv zadajte názov produktu (dopyt).", { type: "error" });
      return;
    }
    const resp = await apiFetch(`/api/market/sources?query=${encodeURIComponent(query)}`, { method: "GET" });
    if (!resp.ok) throw new Error(`API ${resp.status}`);
    const data = await resp.json();
    if (!data?.ok) throw new Error(data?.error || "API error");
    const urls = data.urls || {};
    const toOpen = [urls.bazos, urls.marketplace, urls.heureka].filter(Boolean);
    toOpen.forEach((u) => window.open(u, "_blank", "noopener,noreferrer"));
  };
  marketSourcesBtn?.addEventListener("click", () => {
    void openMarketSources().catch((e) => showToast(String(e?.message || e || "Chyba"), { type: "error" }));
  });
  marketSearchBtn?.addEventListener("click", () => {
    void searchMarketAds().catch((e) => showToast(String(e?.message || e || "Chyba"), { type: "error" }));
  });

  // Category select change handler
  modalCategorySelect?.addEventListener("change", (e) => {
    selectedCategory = Number(e.target.value) || null;
  });
  
  modalYes?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use the value from modal input (if edited by user) or the detected name
    const inp = qs("[data-product-name]");
    const manualName = String(modalInput?.value || "").trim();
    const detected = String(lastIdentification?.name || "").trim();
    const conf = Number(lastIdentification?.confidence || 0);
    
    // Prefer manual input over detected name
    const finalName = manualName || detected;
    
    if (inp && finalName) {
      inp.value = finalName;
      // Clear any hint text if present
      inp.classList.remove("is-hint");
      inp.removeAttribute("data-hint");
    }
    
    // Save selected category
    if (modalCategorySelect) {
      selectedCategory = Number(modalCategorySelect.value) || null;
    }

    // Immediate visual feedback even before API returns
    const placeholder = qs("[data-result-placeholder]");
    if (placeholder) placeholder.setAttribute("hidden", "");
    if (titleEl && finalName) titleEl.textContent = finalName;
    if (descEl) descEl.textContent = "⏳ Pripravené na generovanie";
    if (result) result.removeAttribute("hidden");
    updateHeurekaLinks();
    closeModal();
    // No auto-evaluation – user must fill notes and click "Generovať".
    if (notesTextarea) {
      notesTextarea.focus();
      showToast("✅ Produkt potvrdený! Teraz vyplňte poznámky (min. 10 znakov) a kliknite 'Generovať inzerát'.", { type: "success", duration: 6000 });
    }
  });

  modalNo?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Require manual name; open input in modal.
    window.clearTimeout(autoYesTimer);
    if (modalField) modalField.removeAttribute("hidden");
    if (modalHint) {
      modalHint.textContent = "Zadajte názov produktu presne (značka + model), potom potvrďte Áno.";
      modalHint.removeAttribute("hidden");
    }
    modalInput?.focus();
  });

  modalInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const v = (modalInput.value || "").trim();
      if (!v) return;
      const inp = qs("[data-product-name]");
      if (inp) {
        inp.value = v;
        // Clear any hint text if present
        inp.classList.remove("is-hint");
        inp.removeAttribute("data-hint");
      }
      
      // Update title element immediately
      const placeholder = qs("[data-result-placeholder]");
      if (placeholder) placeholder.setAttribute("hidden", "");
      if (titleEl) titleEl.textContent = v;
      if (descEl) descEl.textContent = "Analyzujem fotku…";
      if (result) result.removeAttribute("hidden");
      updateHeurekaLinks();
      
      closeModal();
      // No auto-evaluation – user must fill notes and click "Generovať".
      if (notesTextarea) {
        notesTextarea.focus();
        showToast("Teraz vyplňte poznámky o stave a vadách (min. 10 znakov), potom kliknite 'Generovať inzerát'.", { type: "info", duration: 5000 });
      }
    }
  });

  // Allow keyboard confirm/cancel
  document.addEventListener("keydown", (e) => {
    if (!modal || modal.hasAttribute("hidden")) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
    if (e.key === "Enter" && (modalField?.hasAttribute("hidden") ?? true)) {
      // If the manual field isn't shown, Enter = Yes
      e.preventDefault();
      modalYes?.click();
    }
  });

  copyBtn?.addEventListener("click", async () => {
    // Check if confirmation checkbox is checked
    const confirmCheckbox = qs("[data-confirm-checkbox]");
    if (!confirmCheckbox?.checked) {
      showToast("⚠️ Prosím, potvrďte, že ste skontrolovali inzerát pred skopírovaním.");
      return;
    }

    const descEl = qs("[data-result-desc]");
    const desc = descEl?.textContent?.trim() ?? "";
    const benefits = (qs("[data-benefits-text]")?.textContent ?? "").trim();
    const tech = (qs("[data-techline-text]")?.textContent ?? "").trim();
    // Copy: description + practical advantages + optional tech line (all as plain text)
    const text = [desc, benefits, tech ? `Technické info: ${tech}` : ""].filter(Boolean).join("\n\n");

    const tryExecCopy = (t) => {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      return ok;
    };

    const selectManual = () => {
      if (!descEl) return;
      try {
        const r = document.createRange();
        const list = qs(".result__list");
        if (list) {
          r.setStartBefore(descEl);
          r.setEndAfter(list);
        } else {
          r.selectNodeContents(descEl);
        }
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(r);
      } catch {
        // ignore
      }
    };
    try {
      if (!text) {
        showToast("Najprv vygenerujte popis.", { type: "info" });
        return;
      }
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text.trim());
        
        // Success animation: change button to checkmark
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Skopírované';
        copyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        copyBtn.style.transform = 'scale(1.05)';
        copyBtn.style.transition = 'all 0.3s ease';
        
        showToast("✅ Inzerát skopírovaný! Môžete ho teraz publikovať.", { type: "success", duration: 4000 });
        
        // Reset button after 3 seconds
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.style.background = '';
          copyBtn.style.transform = '';
        }, 3000);
        return;
      }
      // Fallback for non-secure contexts (e.g. LAN IP over http)
      if (tryExecCopy(text.trim())) {
        // Success animation
        const originalHTML = copyBtn.innerHTML;
        copyBtn.innerHTML = '✓ Skopírované';
        copyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        copyBtn.style.transform = 'scale(1.05)';
        copyBtn.style.transition = 'all 0.3s ease';
        
        showToast("✅ Inzerát skopírovaný! Môžete ho teraz publikovať.", { type: "success", duration: 4000 });
        
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.style.background = '';
          copyBtn.style.transform = '';
        }, 3000);
        return;
      }
      throw new Error("Copy blocked");
    } catch {
      selectManual();
      showToast("Prehliadač blokuje kopírovanie. Označte text manuálne.", { type: "error" });
    }
  });

  // Feedback buttons (thumbs up/down)
  const feedbackBtns = Array.from(document.querySelectorAll("[data-feedback]"));
  feedbackBtns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const feedbackType = btn.dataset.feedback; // "positive" or "negative"
      const titleEl = qs("[data-result-title]");
      const descEl = qs("[data-result-desc]");
      const productName = titleEl?.textContent?.trim() || "";
      const adText = descEl?.textContent?.trim() || "";
      
      // Toggle active state
      feedbackBtns.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      
      let feedbackMessage = "";
      
      if (feedbackType === "positive") {
        showToast("✅ Ďakujeme za spätnú väzbu!", { type: "success", duration: 2000 });
      } else {
        // Thumbs down - ask what was wrong
        feedbackMessage = prompt(
          "📝 Čo bolo zlé?\n\nPomôžte nám vylepšiť AI tým, že nám napíšete, čo sa vám nepáčilo alebo čo bolo nesprávne:",
          ""
        );
        
        if (feedbackMessage === null) {
          // User cancelled
          feedbackBtns.forEach(b => b.classList.remove("is-active"));
          return;
        }
        
        showToast("📝 Spätná väzba zaznamenaná. Ďakujeme!", { type: "info", duration: 3000 });
      }
      
      // Send feedback to server
      try {
        const userEmail = getBetaEmail(); // Get user's email from localStorage
        await apiFetch("/api/feedback", {
          method: "POST",
          body: JSON.stringify({
            type: feedbackType,
            productName,
            adText: adText.substring(0, 500), // first 500 chars
            userEmail: userEmail || "", // Include user email for reply-to
            feedbackMessage: feedbackMessage || "", // What was wrong (for negative feedback)
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (err) {
        // Silent fail
      }
    });
  });

  // Edit ad functionality
  const editRequestInput = qs("[data-edit-request]");
  const editSubmitBtn = qs("[data-edit-submit]");
  const editUndoBtn = qs("[data-edit-undo]");
  let currentAdData = null;
  let previousAdData = null; // Backup before edit for undo
  let isEditingAd = false;
  
  // Free edits counter (3 free per session, then Premium required)
  // Uses sessionStorage - resets on new page load / tab close
  const getEditCount = () => {
    try {
      // sessionStorage resets on page reload or tab close
      return parseInt(sessionStorage.getItem(STORAGE_KEY_EDITS) || "0", 10);
    } catch {
      return 0;
    }
  };
  
  const incrementEditCount = () => {
    try {
      const count = getEditCount() + 1;
      // sessionStorage - data cleared when tab/window is closed
      sessionStorage.setItem(STORAGE_KEY_EDITS, String(count));
      return count;
    } catch {
      return getEditCount();
    }
  };
  
  const hasPremium = () => {
    try {
      // localStorage persists across sessions (survives page reload)
      return localStorage.getItem(STORAGE_KEY_PREMIUM) === "true";
    } catch {
      return false;
    }
  };
  
  const setPremium = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY_PREMIUM, value ? "true" : "false");
      updateEditUI();
    } catch {
      // Silent fail
    }
  };
  
  const updateEditUI = () => {
    const count = getEditCount();
    const isPremium = hasPremium();
    const remaining = Math.max(0, FREE_EDITS_LIMIT - count);
    
    if (isPremium) {
      // Premium user - unlimited edits
      if (editRequestInput) editRequestInput.disabled = false;
      if (editSubmitBtn) editSubmitBtn.disabled = false;
      const hint = qs(".editAdSection__hint");
      if (hint) hint.textContent = "✨ Premium: Neobmedzené úpravy";
      return;
    }
    
    if (count >= FREE_EDITS_LIMIT) {
      // Free limit reached - show Premium upgrade
      if (editRequestInput) {
        editRequestInput.disabled = true;
        editRequestInput.placeholder = "Vyčerpaných 3 úprav. Vygeneruj nový inzerát alebo kúp Premium.";
      }
      if (editSubmitBtn) {
        editSubmitBtn.style.display = "none";
      }
      
      // Show Premium button
      let premiumBtn = qs(".editAdSection__premium");
      if (!premiumBtn) {
        premiumBtn = document.createElement("a");
        premiumBtn.className = "editAdSection__premium";
        premiumBtn.href = "#premium"; // TODO: Replace with Stripe checkout URL
        premiumBtn.innerHTML = `
          <span class="editAdSection__premiumIcon">✨</span>
          <span class="editAdSection__premiumText">Získať Premium (2,99 €) a 3 inzeráty</span>
        `;
        premiumBtn.addEventListener("click", (e) => {
          e.preventDefault();
          showToast("Stripe integrácia pripravovaná. Zatiaľ kontaktujte auditly.io@gmail.com", { type: "info", duration: 4000 });
        });
        const row = qs(".editAdSection__row");
        if (row) row.appendChild(premiumBtn);
      }
      premiumBtn.style.display = "flex";
      
      // Show "Buy more edits" button as alternative
      let buyMoreBtn = qs(".editAdSection__buyMore");
      if (!buyMoreBtn) {
        buyMoreBtn = document.createElement("button");
        buyMoreBtn.className = "editAdSection__buyMore";
        buyMoreBtn.type = "button";
        buyMoreBtn.innerHTML = `
          <span class="editAdSection__buyMoreIcon">🔓</span>
          <span class="editAdSection__buyMoreText">Dokúpiť 10 úprav (1,99 €)</span>
        `;
        buyMoreBtn.addEventListener("click", () => {
          showToast("Stripe integrácia pripravovaná. Zatiaľ kontaktujte auditly.io@gmail.com", { type: "info", duration: 4000 });
        });
        const row = qs(".editAdSection__row");
        if (row) row.appendChild(buyMoreBtn);
      }
      buyMoreBtn.style.display = "flex";
    } else {
      // Still has free edits
      if (editRequestInput) editRequestInput.disabled = false;
      if (editSubmitBtn) editSubmitBtn.disabled = false;
      const hint = qs(".editAdSection__hint");
      if (hint) hint.textContent = `💡 Niečo nesedí? Napíš pokyn a AI to opraví (${remaining}/${FREE_EDITS_LIMIT} bezplatných úprav)`;
    }
  };
  
  // Initialize UI
  updateEditUI();
  
  // Expose updateEditUI globally so it can be called from evaluateFlow
  window.updateEditUI = updateEditUI;
  
  // Expose manual reset for debugging (console: debugResetEdits())
  window.debugResetEdits = () => {
    sessionStorage.removeItem(STORAGE_KEY_EDITS);
    updateEditUI();
    showToast("✅ Edit counter resetovaný! Máte 3 nové úpravy.", { type: "success" });
  };

  // 🆕 COPY TEXT FUNCTIONALITY
  const handleCopyText = () => {
    const title = qs("[data-result-title]")?.textContent?.trim() || "";
    const desc = qs("[data-result-desc]")?.textContent?.trim() || "";
    const benefits = Array.from(document.querySelectorAll(".benefits__item"))
      .map(el => "✅ " + el.textContent.trim())
      .join("\n");
    
    if (!title && !desc) {
      showToast("❌ Nie je čo kopírovať. Najprv vygenerujte inzerát.", { type: "error" });
      return;
    }

    const fullText = `${title}\n\n${desc}\n\n${benefits}\n\nOverené cez Auditly.io`.trim();

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(fullText)
        .then(() => showToast("📋 Text skopírovaný!", { type: "success", duration: 2000 }))
        .catch(() => showToast("❌ Nepodarilo sa skopírovať text.", { type: "error" }));
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = fullText;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        showToast("📋 Text skopírovaný!", { type: "success", duration: 2000 });
      } catch (err) {
        showToast("❌ Nepodarilo sa skopírovať text.", { type: "error" });
      }
      document.body.removeChild(textArea);
    }
  };

  // ⚡ GLOBÁLNY DISPEČER KLIKNUTÍ (EVENT DELEGATION) - RIEŠENIE PRE DYNAMICKÉ HTML
  document.addEventListener("click", async (e) => {
    const target = e.target;

    // 1. KLIK NA PALEC (FEEDBACK)
    const feedbackBtn = target.closest("[data-feedback]");
    if (feedbackBtn) {
        e.preventDefault();
        const type = feedbackBtn.dataset.feedback;
        console.log(`👍 Feedback clicked: ${type}`);
        
        // Vizuálna odozva (aktivácia palca)
        const parent = feedbackBtn.parentElement;
        if (parent) {
            parent.querySelectorAll("[data-feedback]").forEach(b => b.classList.remove("is-active"));
        }
        feedbackBtn.classList.add("is-active");
        
        // Ak je negatívny, spýtaj sa na dôvod
        let msg = "";
        if (type === "negative") {
            msg = prompt("📝 Čo by sme mali zlepšiť?", "");
            if (msg === null) {
                feedbackBtn.classList.remove("is-active");
                return;
            }
        }

        showToast("✅ Ďakujeme za spätnú väzbu!", { type: "success" });

        try {
            const title = document.querySelector("[data-result-title]")?.innerText || "";
            const desc = document.querySelector("[data-result-desc]")?.innerText || "";
            const tech = document.querySelector(".techLine")?.innerText || "";
            const benefits = document.querySelector(".benefitsText")?.innerText || "";
            const whyBuy = document.querySelector(".whyBuyList")?.innerText || "";
            
            // Full ad context for feedback
            const fullAdText = `${title}\n\n${desc}\n\n${tech}\n\n${benefits}\n\n${whyBuy}`.trim();
            
            // Price estimates
            const prices = {
                quick: document.querySelector("[data-quick-price]")?.innerText || "—",
                market: document.querySelector("[data-market-price]")?.innerText || "—",
                premium: document.querySelector("[data-premium-price]")?.innerText || "—"
            };

            // Get number of ads used from UI text
            const reviewCountEl = document.querySelector("#reviewCount");
            const adsCount = reviewCountEl ? reviewCountEl.innerText : "—";

            await fetch(`${API_BASE}/api/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    type: type,
                    productName: title,
                    adText: fullAdText || "Nenačítaný text",
                    pricing: prices,
                    adsUsed: adsCount,
                    feedbackMessage: msg,
                    userEmail: (typeof getBetaEmail === 'function' ? getBetaEmail() : ""),
                    timestamp: new Date().toISOString()
                })
            });
        } catch (err) {
            console.warn("⚠️ Feedback fail:", err);
        }
        return;
    }

    // 2. KLIK NA KOPÍROVANIE
    const copyBtn = target.closest("[data-copy]");
    if (copyBtn) {
        e.preventDefault();
        console.log("📋 Copy clicked");
        
        const title = qs("[data-result-title]")?.innerText || "";
        const desc = qs("[data-result-desc]")?.innerText || "";
        const tech = qs(".techLine")?.innerText || "";
        const benefits = qs(".benefitsText")?.innerText || "";
        const whyBuy = qs(".whyBuyList")?.innerText || "";
        
        const textToCopy = `${title}\n\n${desc}\n\n${tech}\n\n${benefits}\n\n${whyBuy}\n\nOverené cez Auditly.io`.trim();
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            showToast("📋 Inzerát skopírovaný!", { type: "success" });
        } catch (err) {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand("copy");
            document.body.removeChild(textArea);
            showToast("📋 Inzerát skopírovaný!", { type: "success" });
        }
        return;
    }

    // 3. KLIK NA UPRAVIŤ (AI REFINE)
    const refineBtn = target.closest("[data-edit-submit]");
    if (refineBtn) {
        e.preventDefault();
        const input = qs("[data-edit-request]");
        const val = input?.value?.trim();
        if (!val || val.length < 3) {
            showToast("📝 Napíš pokyn na úpravu.", { type: "info" });
            return;
        }
        if (typeof window.handleEditSubmitAction === 'function') {
            window.handleEditSubmitAction(val);
        }
        return;
    }

    // 4. KLIK NA VRÁTIŤ SPÄŤ (UNDO)
    if (target.closest("[data-edit-undo]")) {
        e.preventDefault();
        if (typeof window.handleEditUndo === 'function') {
            window.handleEditUndo();
        }
        return;
    }

    // 5. KLIK NA PREPOČÍTAŤ (RECALCULATE)
    if (target.closest("#updateBtn") || target.closest("[data-recalculate]")) {
        e.preventDefault();
        if (typeof window.reloadAndRecalculate === 'function') {
            window.reloadAndRecalculate();
        }
    }
  });

  const handleAdRefine = () => {
    const input = qs("[data-edit-request]");
    const val = input?.value?.trim();
    if (!val || val.length < 3) { showToast("📝 Napíš pokyn na úpravu.", { type: "info" }); return; }
    if (typeof window.handleEditSubmitAction === 'function') window.handleEditSubmitAction(val);
  };
  
  window.resetEditCounter = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY_EDITS);
      updateEditUI();
    } catch (err) {
      // Silent fail
    }
  };

  // Store current ad data after generation
  window.storeCurrentAd = (data) => {
    currentAdData = {
      title: data.title || "",
      desc: data.desc || "",
      benefits: data.benefits || [],
      pricing: data.pricing || data.prices || { fair: 0, quick: 0, premium: 0 },
      price: data.pricing?.fair || data.prices?.price_recommended || 0,
    };
    // Hide undo button on new generation
    if (editUndoBtn) editUndoBtn.setAttribute("hidden", "");
    previousAdData = null;
  };

  // Undo button handler
  editUndoBtn?.addEventListener("click", () => {
    if (!previousAdData) {
      showToast("Nie je čo vrátiť späť.", { type: "info" });
      return;
    }
    
    // Restore previous ad data
    const titleEl = qs("[data-result-title]");
    const descEl = qs("[data-result-desc]");
    if (titleEl) titleEl.textContent = previousAdData.title || "";
    if (descEl) descEl.textContent = previousAdData.desc || "";
    renderBenefits(previousAdData.benefits || []);
    
    // Restore pricing if available
    if (previousAdData.pricing) {
      applyPricesToUI(previousAdData.pricing);
    }
    
    // Restore current ad data
    currentAdData = { ...previousAdData };
    previousAdData = null;
    
    // Hide undo button
    if (editUndoBtn) editUndoBtn.setAttribute("hidden", "");
    
    showToast("✅ Inzerát vrátený na predošlú verziu.", { type: "success" });
  });

  editSubmitBtn?.addEventListener("click", async () => {
    if (isEditingAd) return;
    
    const userRequest = (editRequestInput?.value ?? "").trim();
    if (!userRequest) {
      showToast("Napíšte pokyn na úpravu (napr. 'daj cenu 10 eur').", { type: "info" });
      return;
    }
    
    // Validate: request must be meaningful (min 5 characters and not just generic words)
    if (userRequest.length < 5) {
      showToast("❌ Pokyn je príliš krátky. Napíšte konkrétne čo chcete zmeniť (napr. 'zmeň cenu na 450€').", { type: "error", duration: 4000 });
      editRequestInput?.focus();
      return;
    }
    
    // Check for meaningless requests
    const meaninglessPatterns = /^(ok|ano|nie|no|yes|neviem|dobre|zle|ano|áno)$/i;
    if (meaninglessPatterns.test(userRequest)) {
      showToast("❌ Toto nemôžem zobrať, neviem čo tým myslíš. Popíš konkrétnejšie čo chceš zmeniť (napr. 'pridaj do popisu že má nové pneumatiky').", { type: "error", duration: 5000 });
      editRequestInput?.focus();
      return;
    }
    
    if (!currentAdData) {
      showToast("Najprv vygenerujte inzerát.", { type: "info" });
      return;
    }
    
    isEditingAd = true;
    const originalBtnText = editSubmitBtn.querySelector(".editAdSection__btnText")?.textContent || "Upraviť";
    if (editSubmitBtn) editSubmitBtn.classList.add("is-loading");
    const btnText = editSubmitBtn.querySelector(".editAdSection__btnText");
    if (btnText) btnText.textContent = "Upravujem…";
    
    // Backup current ad data before edit (for undo)
    previousAdData = currentAdData ? { ...currentAdData } : null;
    
    try {
      const productName = (qs("[data-product-name]")?.value ?? "").trim();
      const notes = (qs("[data-product-notes]")?.value ?? "").trim();
      
      const resp = await apiFetch("/api/edit-ad", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          currentAd: currentAdData,
          userRequest,
          productName,
          notes,
        }),
      });
      
      if (!resp.ok) {
        const t = await resp.text().catch(() => "");
        throw new Error(`API ${resp.status}: ${t.slice(0, 200)}`);
      }
      
      const data = await resp.json();
      if (!data?.ok) throw new Error(data?.error || "API error");
      
      // Update UI with edited ad
      const titleEl = qs("[data-result-title]");
      const descEl = qs("[data-result-desc]");
      if (titleEl) titleEl.textContent = data.title || "";
      if (descEl) descEl.textContent = data.desc || "";
      renderBenefits(data.benefits || []);
      
      // Update pricing if changed
      if (data.pricing) {
        applyPricesToUI(data.pricing);
      }
      
      // Store updated ad for future edits (but keep previousAdData for undo)
      currentAdData = {
        title: data.title || "",
        desc: data.desc || "",
        benefits: data.benefits || [],
        pricing: data.pricing || { fair: 0, quick: 0, premium: 0 },
        price: data.pricing?.fair || 0,
      };
      
      // Show undo button
      if (editUndoBtn && previousAdData) {
        editUndoBtn.removeAttribute("hidden");
      }
      
      // Increment edit counter
      const newCount = incrementEditCount();
      
      // Clear input
      if (editRequestInput) editRequestInput.value = "";
      
      // Update UI based on new count
      updateEditUI();
      
      const remaining = Math.max(0, FREE_EDITS_LIMIT - newCount);
      if (remaining > 0 && !hasPremium()) {
        showToast(`Inzerát upravený. Zostáva ${remaining} bezplatných úprav.`, { type: "success" });
      } else if (remaining === 0 && !hasPremium()) {
        showToast("Inzerát upravený. Limit bezplatných úprav vyčerpaný – zakúpte Premium.", { type: "info" });
      } else {
        showToast("Inzerát upravený podľa vášho pokynu.", { type: "success" });
      }
    } catch (err) {
      const msg = String(err?.message || "");
      const brief = msg.length > 140 ? `${msg.slice(0, 140)}…` : msg || "Neznáma chyba";
      showToast(`Úprava zlyhala: ${brief}`, { type: "error" });
    } finally {
      isEditingAd = false;
      if (editSubmitBtn) editSubmitBtn.classList.remove("is-loading");
      if (btnText) btnText.textContent = originalBtnText;
    }
  });

  // Privacy Policy Modal
  const privacyModal = qs("[data-privacy-modal]");
  const privacyOverlay = qs("[data-privacy-overlay]");
  const privacyCloseBtns = Array.from(document.querySelectorAll("[data-privacy-close]"));
  const openPrivacyLinks = Array.from(document.querySelectorAll("[data-open-privacy]"));

  const openPrivacyModal = () => {
    if (privacyModal) {
      privacyModal.hidden = false;
      document.body.style.overflow = "hidden";
      
      // Make background inert to prevent focus issues
      const imac = document.querySelector(".imac");
      if (imac) imac.setAttribute("inert", "");
    }
  };

  const closePrivacyModal = () => {
    if (privacyModal) {
      privacyModal.hidden = true;
      document.body.style.overflow = "";
      
      // Remove inert from background
      const imac = document.querySelector(".imac");
      if (imac) imac.removeAttribute("inert");
    }
  };

  openPrivacyLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      openPrivacyModal();
    });
  });

  privacyCloseBtns.forEach((btn) => {
    btn.addEventListener("click", closePrivacyModal);
  });

  privacyOverlay?.addEventListener("click", closePrivacyModal);

  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && privacyModal && !privacyModal.hidden) {
      closePrivacyModal();
    }
  });

  // 📈 TREND CHART LOGIC
  const trendModal = qs("[data-trend-modal]");
  const openTrendBtn = qs("[data-open-trend]");
  const closeTrendBtns = document.querySelectorAll("[data-close-trend]");
  let trendChartInstance = null;

  // Dáta pre kategórie
  const categoryTrendData = {
    mobile: {
      title: "iPhone 15 Pro (128GB)",
      subtitle: "Trend (používané)",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [1250, 1230, 1200, 1180, 1150, 1120, 1100, 1085, 1040, 1010, 975, 950],
      currentPrice: "950 €",
      drop: "− 12%",
      tip: "Bazárová cena iPhonov klesá najviac pred predstavením nového modelu v septembri."
    },
    console: {
      title: "PlayStation 5 Disc Edition",
      subtitle: "Trend (používané)",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [520, 510, 490, 480, 480, 470, 460, 450, 450, 440, 430, 420],
      currentPrice: "420 €",
      drop: "− 8%",
      tip: "Konzoly si držia bazárovú cenu lepšie, pokles je pomalší než u mobilov."
    },
    laptop: {
      title: "MacBook Air M2 (2022)",
      subtitle: "Trend (používané)",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [1150, 1120, 1100, 1080, 1050, 1020, 1000, 980, 960, 940, 920, 900],
      currentPrice: "900 €",
      drop: "− 15%",
      tip: "Bazárové notebooky strácajú hodnotu skokovo po vydaní novej generácie procesorov."
    },
    other: {
      title: "Elektronika (Priemer)",
      subtitle: "Trend (používané)",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [500, 490, 480, 470, 460, 450, 440, 430, 420, 410, 400, 390],
      currentPrice: "390 €",
      drop: "− 10%",
      tip: "Všeobecná elektronika stráca bazárovú hodnotu cca 1-2% mesačne."
    }
  };

  const initTrendChart = () => {
    const ctx = document.getElementById('priceTrendChart')?.getContext('2d');
    if (!ctx) return;

    const modelName = productNameHidden?.value || "Zariadenie";
    const basePrice = window.heurekaData?.priceAvg || 850;
    
    // 📈 REALISTIC TREND ANCHORING
    const labels = ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'];
    const prices = [];
    
    // We want the last point (Jan) to be EXACTLY the current basePrice
    // We work backwards: Jan = basePrice, Dec = basePrice + 1.2%, etc.
    let current = basePrice;
    for (let i = 11; i >= 0; i--) {
      prices[i] = Math.round(current);
      current += (basePrice * 0.013); // Reverse the drop
    }

    // Update texts in modal
    const modalTitle = qs(".trendModal__title", trendModal);
    const modalSubtitle = qs(".trendModal__subtitle", trendModal);
    const currentPriceVal = qs(".trendInfo__value:not(.is-drop)", trendModal);
    const dropVal = qs(".trendInfo__value.is-drop", trendModal);
    const tipVal = qs(".trendModal__tip", trendModal);

    if (modalTitle) modalTitle.textContent = `Historický vývoj bazárovej ceny`;
    if (modalSubtitle) modalSubtitle.textContent = `${modelName} • Trend (používané)`;
    if (currentPriceVal) currentPriceVal.textContent = `${Math.round(basePrice)} €`;
    
    // Calculate real drop for the label
    const totalDropPct = Math.round(((prices[0] - prices[11]) / prices[0]) * 100);
    if (dropVal) dropVal.textContent = `− ${totalDropPct}%`;
    if (tipVal) tipVal.textContent = `💡 Bazárová cena elektroniky klesá najviac pred predstavením nového modelu.`;

    // Gradient setup
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

    const data = {
      labels: labels,
      datasets: [{
        label: 'Auditly férová cena (€)',
        data: prices,
        fill: true,
        backgroundColor: gradient,
        borderColor: '#a855f7',
        borderWidth: 4,
        pointBackgroundColor: '#ffffff',
        pointBorderColor: '#a855f7',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.4, // Smooth curve
      }]
    };

    const config = {
      type: 'line',
      data: data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(2, 6, 23, 0.9)',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '800' },
            bodyFont: { family: 'Plus Jakarta Sans', size: 14, weight: '700' },
            padding: 12,
            cornerRadius: 12,
            displayColors: false,
            callbacks: {
              label: (context) => `Cena: ${context.parsed.y} €`
            }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
            ticks: { 
              color: 'rgba(255, 255, 255, 0.5)', 
              font: { family: 'Plus Jakarta Sans', size: 11 },
              callback: (value) => `${value}€`
            }
          },
          x: {
            grid: { display: false, drawBorder: false },
            ticks: { 
              color: 'rgba(255, 255, 255, 0.5)', 
              font: { family: 'Plus Jakarta Sans', size: 11 }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index',
        }
      }
    };

    if (trendChartInstance) {
      trendChartInstance.destroy();
    }
    trendChartInstance = new Chart(ctx, config);
  };

  openTrendBtn?.addEventListener("click", () => {
    if (trendModal) {
      trendModal.hidden = false;
      document.body.style.overflow = "hidden";
      // Delay initialization to ensure canvas has dimensions
      setTimeout(initTrendChart, 50);
    }
  });

  const closeTrendModal = () => {
    if (trendModal) {
      trendModal.hidden = true;
      document.body.style.overflow = "";
    }
  };

  closeTrendBtns.forEach(btn => {
    btn.addEventListener("click", closeTrendModal);
  });

  // Close trend modal on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && trendModal && !trendModal.hidden) {
      closeTrendModal();
    }
  });

  // ✍️ GENERATE AD TEXT LOGIC
  const adOverlay = qs("#adReportOverlay");
  const closeAdBtn = qs("#closeAdReport");
  
  const getConditionGrade = (pct) => {
    const p = Number(pct || 100);
    if (p >= 98) return "A+ (Ako nový)";
    if (p >= 90) return "A (Vynikajúci)";
    if (p >= 80) return "B+ (Veľmi dobrý)";
    if (p >= 70) return "B (Dobrý)";
    return "C (Opotrebovaný)";
  };

  // Attach listener once to the document to handle dynamic buttons if necessary
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-generate-ad]");
    if (!btn) return;

    e.preventDefault();
    console.log("✍️ Generating ad...");
    
    // Ensure we have an audit ID before showing the modal
    if (!expertOverlay.dataset.currentAuditId) {
      console.log("⏳ Saving audit first...");
      try {
        await handleOpenExpertReport(null, { showMain: false });
      } catch (err) {
        console.error("❌ Failed to save audit before ad generation:", err);
      }
    }

    const adOverlay = document.getElementById("adReportOverlay");
    if (!adOverlay) {
      console.error("❌ Modal #adReportOverlay not found in DOM!");
      return;
    }

    const productName = qs("[data-product-name]")?.value?.trim() || "Zariadenie";
    const storage = qs("[data-storage-select]")?.value || "Základná";
    const battery = qs("[data-battery-health-sell]")?.value || "100";
    const conditionPct = qs("[data-device-condition]")?.value || "100";
    
    // Get price
    let price = "Dohodou";
    const priceDisplay = qs("[data-price]");
    if (priceDisplay && priceDisplay.textContent) {
      price = priceDisplay.textContent.replace(/[^\d]/g, '');
    }
    
    const grade = getConditionGrade(conditionPct);
    
    // Accessories
    const accList = [];
    if (document.querySelector("[data-acc='box']")?.checked) accList.push("Originálna krabica");
    if (document.querySelector("[data-acc='charger']")?.checked) accList.push("Nabíjačka/Kábel");
    if (document.querySelector("[data-acc='receipt']")?.checked) accList.push("Doklad o kúpe/Faktúra");
    const accText = accList.length > 0 ? accList.join(", ") : "Základné príslušenstvo";

    // 🕵️ DETECTED DEFECTS (from AI)
    let defectsText = "";
    if (window.lastAIDefects && window.lastAIDefects.length > 0) {
      defectsText = `\n\n🔍 Zistené vizuálne nedostatky:\n` + window.lastAIDefects.map(d => `▪️ ${d}`).join("\n");
    }

    // 🔗 Share Link (current audit)
    // 🛡️ User Request: Ensure real public link is used
    const urlParams = new URLSearchParams(window.location.search);
    const reportParam = urlParams.get('report');
    const auditId = reportParam || expertOverlay.dataset.currentAuditId || "";
    
    // Determine the base URL for sharing
    // If on localhost, try to provide the production URL for convenience, 
    // but fallback to current origin if not available.
    const productionDomain = "https://auditlyio.sk"; // Update this to your actual domain if different
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const shareBase = isLocal ? productionDomain : window.location.origin;
    
    const shareUrl = auditId ? `${shareBase}/?report=${auditId}` : "";
    const shareText = shareUrl ? `\n\n🔗 ${shareUrl}` : "";

    // Build Template (Link-First Model)
    const subject = `${productName} (${storage}) | Overený stav cez Auditly.io 🛡️`;
    
    const body = `Na predaj ${productName} v ${storage} verzii. Zariadenie je plne funkčné a odhlásené zo všetkých účtov.

Všetky technické detaily, potvrdenie záruky a kompletnú vizuálnu diagnostiku nájdete v tomto nezávislom reporte (platný 30 dní):
${shareText}

Základné info:
▪️ Model: ${productName}
▪️ Pamäť: ${storage}
▪️ Stav: Overený digitálnym auditom (viď link vyššie)
▪️ Záruka: Možnosť overiť cez sériové číslo

Cena: ${price} €

Preferujem osobný odber, aby ste si mohli stav z auditu porovnať s realitou. V prípade záujmu píšte správu.`;

    // Populate Modal
    const adSubEl = document.getElementById("adSubject");
    const adBodyEl = document.getElementById("adBody");
    if (adSubEl) adSubEl.textContent = subject;
    if (adBodyEl) adBodyEl.textContent = body;

    // Show Modal
    adOverlay.hidden = false;
    adOverlay.style.display = "flex"; // Ensure it's visible if CSS uses flex
    document.body.style.overflow = "hidden";
    console.log("✅ Ad modal opened successfully.");
  });

  closeAdBtn?.addEventListener("click", () => {
    const adOverlay = document.getElementById("adReportOverlay");
    if (adOverlay) {
      adOverlay.hidden = true;
      adOverlay.style.display = "none";
      document.body.style.overflow = "";
    }
  });

  // 📋 EXPERT MASTER REPORT (FROM DB)
  const expertOverlay = qs("#expertReportOverlay");
  const closeExpertBtn = qs("#closeExpertReport");
  const openExpertBtns = document.querySelectorAll("[data-open-master-report]");
  const shareLinkPrivate = qs("#expertShareLinkPrivate");
  const shareLinkPublic = qs("#expertShareLinkPublic");

  // 🔗 SHARE AUDIT LINK LOGIC
  window.copyPrivateLink = () => {
    const auditId = expertOverlay.dataset.currentAuditId;
    if (!auditId) return;
    const productionDomain = "https://auditlyio.sk";
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const shareBase = isLocal ? productionDomain : window.location.origin;
    
    const shareUrl = `${shareBase}/?audit=${auditId}`; // Private link uses ?audit
    
    const onDone = () => {
      const shareBtn = qs("#expertShareLinkPrivate");
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = "✅ Súkromný odkaz skopírovaný!";
      shareBtn.style.color = "#10b981";
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
        shareBtn.style.color = "#a78bfa";
      }, 2500);
      showToast("✅ Súkromný odkaz bol skopírovaný!", { type: "success" });
    };
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(onDone);
    } else {
      fallbackCopyToClipboard(shareUrl);
      onDone();
    }
  };

  window.copyPublicLinkExpert = () => {
    const auditId = expertOverlay.dataset.currentAuditId;
    if (!auditId) return;
    const productionDomain = "https://auditlyio.sk";
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const shareBase = isLocal ? productionDomain : window.location.origin;
    
    const shareUrl = `${shareBase}/?report=${auditId}`; // Public link uses ?report
    
    const onDone = () => {
      const shareBtn = qs("#expertShareLinkPublic");
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = "✅ Verejný odkaz skopírovaný!";
      shareBtn.style.color = "#10b981";
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
        shareBtn.style.color = "#a78bfa";
      }, 2500);
      showToast("✅ Verejný odkaz bol skopírovaný!", { type: "success" });
    };
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(onDone);
    } else {
      fallbackCopyToClipboard(shareUrl);
      onDone();
    }
  };
  
  // 📱 DYNAMIC MODEL SELECTION LOGIC
  const categorySelect = qs("[data-category-select]");
  const modelSelect = qs("[data-model-select]");
  const storageSelect = qs("[data-storage-select]");
  const productNameHidden = qs("[data-product-name]");

  let DB_CATALOG = {};

  const loadDatabaseCatalog = async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/products/list`);
      const data = await resp.json();
      if (data.ok) {
        // Mapping from DB categories (English) to UI categories (Slovak)
        const mapping = {
          'Mobile': 'Mobil',
          'Watch': 'Hodinky',
          'Audio': 'Slúchadlá',
          'Tablet': 'Tablet',
          'Laptop': 'Notebook',
          'Console': 'Konzola',
          'Other': 'Iné'
        };

        const catalog = {};
        data.products.forEach(p => {
          let cat = mapping[p.category] || p.category;
          const nameLower = p.name.toLowerCase();

          // 🛡️ ENFORCED SEPARATION: Ensure no overlap between Mobiles, Watches and Headphones
          if (cat === 'Mobil' && (nameLower.includes('watch') || nameLower.includes('hodinky'))) {
            cat = 'Hodinky';
          }
          if (cat === 'Mobil' && (nameLower.includes('airpods') || nameLower.includes('slúchadlá') || nameLower.includes('headphone'))) {
            cat = 'Slúchadlá';
          }
          if (cat === 'Hodinky' && nameLower.includes('iphone')) {
            cat = 'Mobil';
          }

          if (!catalog[cat]) catalog[cat] = [];
          
          let storages = ["—"];
          if (p.name.includes("GB") || p.name.includes("TB")) {
             const match = p.name.match(/(\d+)(GB|TB)/g);
             if (match) storages = match;
          }

          catalog[cat].push({ name: p.name, storage: storages });
        });
        DB_CATALOG = catalog;
        console.log("✅ Catalog loaded from DB (Mapped):", DB_CATALOG);
        updateCategoryDropdown();
      }
    } catch (e) {
      console.warn("Failed to load DB catalog, using hardcoded fallback", e);
    }
  };

  const updateCategoryDropdown = () => {
    if (!categorySelect) return;
    const currentVal = categorySelect.value;
    // Standard Slovak Categories Order
    const cats = ["Mobil", "Hodinky", "Slúchadlá", "Tablet", "Notebook", "Konzola", "Iné"];
      categorySelect.innerHTML = `<option value="" disabled selected>Vyberte kategóriu</option>` +
        cats.map(c => `<option value="${c}">${c}</option>`).join('');
    
    if (currentVal) categorySelect.value = currentVal;
  };

  loadDatabaseCatalog();

  const CATALOG = {
    "Mobil": [
      { name: "iPhone 17 Pro Max", storage: ["256GB", "512GB", "1TB"] },
      { name: "iPhone 17 Pro", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 17", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 16 Pro Max", storage: ["256GB", "512GB", "1TB"] },
      { name: "iPhone 16 Pro", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 16", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 15 Pro Max", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 15 Pro", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 15", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 14 Pro Max", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 14 Pro", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 14", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 13 Pro Max", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 13 Pro", storage: ["128GB", "256GB", "512GB", "1TB"] },
      { name: "iPhone 13", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 12 Pro Max", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 12 Pro", storage: ["128GB", "256GB", "512GB"] },
      { name: "iPhone 12", storage: ["64GB", "128GB", "256GB"] },
      { name: "iPhone 12 mini", storage: ["64GB", "128GB", "256GB"] },
      { name: "iPhone 11 Pro Max", storage: ["64GB", "256GB", "512GB"] },
      { name: "iPhone 11 Pro", storage: ["64GB", "256GB", "512GB"] },
      { name: "iPhone 11", storage: ["64GB", "128GB", "256GB"] },
      { name: "iPhone SE (3rd Gen)", storage: ["64GB", "128GB", "256GB"] },
      { name: "iPhone SE (2nd Gen)", storage: ["64GB", "128GB", "256GB"] }
    ],
    "Hodinky": [
      { name: "Apple Watch Ultra 2", storage: ["64GB"] },
      { name: "Apple Watch Ultra", storage: ["32GB"] },
      { name: "Apple Watch Series 9", storage: ["32GB", "64GB"] },
      { name: "Apple Watch Series 8", storage: ["32GB"] },
      { name: "Apple Watch SE (2nd Gen)", storage: ["32GB"] }
    ],
    "Slúchadlá": [
      { name: "AirPods Pro (2nd Gen)", storage: ["—"] },
      { name: "AirPods (3rd Gen)", storage: ["—"] },
      { name: "AirPods Max", storage: ["—"] }
    ],
    "Notebook": [
      { name: "MacBook Pro 14 (M3 Pro)", storage: ["512GB", "1TB"] },
      { name: "MacBook Air 13 (M3)", storage: ["256GB", "512GB"] },
      { name: "MacBook Air 13 (M2)", storage: ["256GB", "512GB"] },
      { name: "MacBook Air 13 (M1)", storage: ["256GB", "512GB"] },
      { name: "Herný notebook (všeobecný)", storage: ["512GB", "1TB", "2TB"] },
      { name: "Pracovný notebook (všeobecný)", storage: ["256GB", "512GB", "1TB"] }
    ],
    "Tablet": [
      { name: "iPad Pro 12.9 (M2)", storage: ["128GB", "256GB", "512GB", "1TB", "2TB"] },
      { name: "iPad Pro 11 (M2)", storage: ["128GB", "256GB", "512GB", "1TB", "2TB"] },
      { name: "iPad Air (5th Gen)", storage: ["64GB", "256GB"] },
      { name: "iPad (10th Gen)", storage: ["64GB", "256GB"] },
      { name: "Samsung Galaxy Tab S9", storage: ["128GB", "256GB"] }
    ],
    "Konzola": [
      { name: "PlayStation 5 Pro", storage: ["2TB"] },
      { name: "PlayStation 5 Slim", storage: ["1TB"] },
      { name: "PlayStation 5 (Disc)", storage: ["825GB"] },
      { name: "PlayStation 4 Pro", storage: ["1TB"] },
      { name: "Xbox Series X", storage: ["1TB"] },
      { name: "Xbox Series S", storage: ["512GB", "1TB"] },
      { name: "Nintendo Switch OLED", storage: ["64GB"] }
    ]
  };

  // 🔐 LOCK HELPERS: Save previous values to revert if cancel
  const savePrevValue = (el) => { el.dataset.prevValue = el.value; };
  const revertValue = (el) => { el.value = el.dataset.prevValue || ""; };

  // 🖱️ Event Listeners for Dropdowns
  categorySelect?.addEventListener("change", (e) => {
    // If triggered from icon click, detail.lockedChecked will be true
    if (e.detail?.lockedChecked) {
      performCategoryChange();
      savePrevValue(categorySelect);
      return;
    }

    handleLockCheck(() => {
      performCategoryChange();
      savePrevValue(categorySelect);
    }, () => revertValue(categorySelect));
  });

  const performCategoryChange = () => {
    if (!categorySelect || !modelSelect) return;
    const category = categorySelect.value;

    console.log(`📂 Category Change Triggered: ${category}`);

    // Sync back to icons
    categoryButtons.forEach(btn => {
      if (btn.getAttribute("data-cat-type") === category) {
        btn.classList.add("is-active");
      } else {
        btn.classList.remove("is-active");
      }
    });

    // 🔋 Update battery field visibility
    const catLower = (category || "").toLowerCase();
    const isConsole = catLower === "konzola" || catLower === "console";
    const isWatch = catLower === "hodinky" || catLower === "watch";
    const isAudio = catLower === "slúchadlá" || catLower === "audio";
    
    // Needs battery: Mobiles, Laptops, Tablets, Watches. NOT Consoles, NOT Headphones.
    const needsBattery = (catLower === "mobil" || catLower === "notebook" || catLower === "tablet" || catLower === "mobile" || catLower === "laptop" || isWatch) && !isConsole && !isAudio;
    
    const mode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
    const batBuy = qs("[data-battery-field]");
    const batSell = qs("[data-battery-field-sell]");
    
    if (batBuy) batBuy.style.display = (mode === "buy" && needsBattery) ? "block" : "none";
    if (batSell) batSell.style.display = (mode === "sell" && needsBattery) ? "block" : "none";

    // 🍎 APPLE & CATEGORY LOGIC: Hide RAM where not relevant
    const ramSelectWrap = qs("[data-ram-select]")?.closest(".select-spec") || qs("[data-ram-select]");
    if (ramSelectWrap) {
      ramSelectWrap.style.display = (isConsole || isWatch || isAudio) ? "none" : "block";
    }

    // 🎮 Console specific fields
    const consoleOnlyFields = document.querySelectorAll("[data-console-only]");
    consoleOnlyFields.forEach(f => {
      f.hidden = !(category === "Konzola" && mode === "sell");
      f.style.display = (category === "Konzola" && mode === "sell") ? "block" : "none";
    });

    const modelsFromDB = DB_CATALOG[category] || [];
    const modelsFromHardcoded = CATALOG[category] || [];
    
    // Merge and unique by name
    const allModels = [...modelsFromDB];
    modelsFromHardcoded.forEach(hm => {
      if (!allModels.find(m => m.name === hm.name)) {
        allModels.push(hm);
      }
    });

    modelSelect.innerHTML = `<option value="" disabled selected>Vyberte model</option>` + 
      allModels.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    modelSelect.disabled = false;
    storageSelect.disabled = true;
    storageSelect.innerHTML = `<option value="" disabled selected>Kapacita</option>`;
    productNameHidden.value = "";
  };

  modelSelect?.addEventListener("change", async () => {
    handleLockCheck(() => {
      performModelChange();
      savePrevValue(modelSelect);
    }, () => revertValue(modelSelect));
  });

  const performModelChange = async () => {
    const category = categorySelect.value || qs(".catItem.is-active")?.dataset.catType;
    const modelName = modelSelect.value;
    if (!modelName) return;

    console.log(`📱 Model selected: ${modelName} in category: ${category}`);

    // Try to find model in both catalogs
    const dbModelData = DB_CATALOG[category]?.find(m => m.name === modelName);
    
    // Hardcoded catalog lookup with fallback to common category if specific one is empty
    const hardcodedModels = CATALOG[category] || [];
    const hardcodedModelData = hardcodedModels.find(m => 
      m.name === modelName || 
      modelName.toLowerCase().includes(m.name.toLowerCase()) ||
      m.name.toLowerCase().includes(modelName.toLowerCase())
    );
    
    let storages = [];
    
    // Prefer hardcoded storage list if it exists (usually more complete for UI)
    if (hardcodedModelData && hardcodedModelData.storage) {
      storages = hardcodedModelData.storage;
    } else if (dbModelData && dbModelData.storage && dbModelData.storage[0] !== "—") {
      storages = dbModelData.storage;
    }

    // 🆕 FALLBACK: Provide standard capacities if missing in catalog
    if (storages.length === 0 || (storages.length === 1 && storages[0] === "—")) {
      const modelLower = modelName.toLowerCase();
      const catLower = (category || "").toLowerCase();

      if (modelLower.includes("iphone")) {
        storages = ["64GB", "128GB", "256GB", "512GB", "1TB"];
      } else if (catLower === "notebook" || modelLower.includes("macbook") || modelLower.includes("laptop")) {
        storages = ["128GB", "256GB", "512GB", "1TB", "2TB"];
      } else if (catLower === "tablet" || modelLower.includes("ipad")) {
        storages = ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"];
      } else if (catLower === "konzola" || modelLower.includes("ps5") || modelLower.includes("ps4") || modelLower.includes("xbox")) {
        storages = ["500GB", "825GB", "1TB", "2TB"];
      }
    }

    if (storages.length === 0) storages = ["—"];
    
    storageSelect.innerHTML = `<option value="" disabled selected>Kapacita</option>` + 
      storages.map(s => `<option value="${s}">${s}</option>`).join('');
    
    storageSelect.disabled = false;
    productNameHidden.value = modelName;

    // 🍎 APPLE & CATEGORY LOGIC: Hide RAM where not relevant
    const ramSelectWrap = qs("[data-ram-select]")?.closest(".select-spec") || qs("[data-ram-select]");
    if (ramSelectWrap) {
      const modelLower = modelName.toLowerCase();
      const categoryLower = (category || "").toLowerCase();
      
      const isApple = modelLower.includes("iphone") || 
                      modelLower.includes("ipad") || 
                      modelLower.includes("macbook") || 
                      modelLower.includes("watch") || 
                      modelLower.includes("airpods");
      
      const isConsole = categoryLower === "konzola" || categoryLower === "console";
      const isWatch = categoryLower === "hodinky" || categoryLower === "watch";
      const isAudio = categoryLower === "slúchadlá" || categoryLower === "audio";

      // Hide RAM for Apple, Consoles, Watches, Headphones
      ramSelectWrap.style.display = (isApple || isConsole || isWatch || isAudio) ? "none" : "block";
    }

    // 📋 IMMEDIATE SPECS: Load and show basic specs on main screen
    // 💳 PAYMENT GATE: Do not show any specs preview until paid
    if (!isTestPaid) {
      console.log("⏳ Immediate specs preview skipped (requires payment)");
      return;
    }

    try {
      let brand = "Apple";
      const modelLower = modelName.toLowerCase();
      if (modelLower.includes("ps5") || modelLower.includes("sony") || modelLower.includes("playstation")) brand = "Sony";
      if (modelLower.includes("xbox") || modelLower.includes("microsoft") || modelLower.includes("surface")) brand = "Microsoft";
      if (modelLower.includes("nintendo") || modelLower.includes("switch")) brand = "Nintendo";
      if (modelLower.includes("samsung") || modelLower.includes("galaxy")) brand = "Samsung";
      if (modelLower.includes("msi")) brand = "MSI";
      if (modelLower.includes("acer")) brand = "Acer";
      if (modelLower.includes("asus")) brand = "ASUS";
      if (modelLower.includes("razer")) brand = "Razer";
      if (modelLower.includes("lenovo")) brand = "Lenovo";
      if (modelLower.includes("dell")) brand = "Dell";
      
      const response = await fetch(`${API_BASE}/api/audit/report?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(modelName)}`);
      const data = await response.json();
      if (data.ok) {
        const r = data.report;
        const miniSpecList = qs("#miniSpecList");
        if (miniSpecList) {
          miniSpecList.innerHTML = `
            <div class="specItem"><span>Model</span> <strong>${r.name}</strong></div>
            <div class="specItem"><span>Displej</span> <strong>${r.display_tech || 'N/A'}</strong></div>
            <div class="specItem"><span>Materiál</span> <strong>${r.frame_material || 'N/A'}</strong></div>
            <div class="specItem"><span>Kategória</span> <strong>${r.category}</strong></div>
          `;
        }
        
        // Update Risks Preview on main card
        const risks = (typeof r.common_faults === 'string' ? JSON.parse(r.common_faults) : r.common_faults) || [];
        const risksPreview = qs(".checkList");
        if (risksPreview && risks.length > 0) {
          risksPreview.innerHTML = risks.slice(0, 4).map(f => `
            <div class="checkItem is-good"><span>✔️</span> ${f.split(':')[0]}</div>
          `).join('');
        }
      }
    } catch (e) { console.warn("Failed to load immediate specs", e); }
    
    // Auto-trigger Heureka price fetch when model is selected
    fetchHeurekaPrice();
  };

  storageSelect?.addEventListener("change", () => {
    handleLockCheck(() => {
    fetchHeurekaPrice();
      savePrevValue(storageSelect);
    }, () => revertValue(storageSelect));
  });

  // 🆕 LIVE RECALCULATION ON INPUT CHANGE
  qs("[data-device-condition]")?.addEventListener("input", fetchHeurekaPrice);
  qs("[data-battery-health-sell]")?.addEventListener("input", fetchHeurekaPrice);
  qs("[data-battery-health]")?.addEventListener("input", fetchHeurekaPrice);
  qs("[data-expected-price]")?.addEventListener("input", fetchHeurekaPrice);
  qs("[data-seller-price]")?.addEventListener("input", fetchHeurekaPrice);
  qs("[data-has-warranty]")?.addEventListener("change", fetchHeurekaPrice);
  qs("[data-has-warranty-sell]")?.addEventListener("change", fetchHeurekaPrice);
  
  // Accessories change triggers recalculation
  document.querySelectorAll("[data-acc]").forEach(acc => {
    acc.addEventListener("change", fetchHeurekaPrice);
  });

  const expertContent = qs("#expertReportContent");
  const expertLoader = qs("#expertReportLoader");

  const handleOpenExpertReport = async (forcedId = null, options = { showMain: true }) => {
    let rawModel = productNameHidden?.value?.trim();
    if (!rawModel && !forcedId) {
      showToast("❌ Prosím, najprv vyberte kategóriu a model.", { type: "error" });
      return;
    }

    // 💳 PAYMENT CHECK (TEST MODE)
    if (!forcedId && !isTestPaid) {
      openPricingModal();
      // Store current request in window to resume after "payment"
      window._pendingReport = { forcedId, options };
      return;
    }

    // 📡 OFFLINE CHECK
    if (!navigator.onLine && !forcedId) {
      const saved = localStorage.getItem("auditly_last_report");
      if (saved) {
        const savedData = JSON.parse(saved);
        if (savedData.data.report && savedData.data.report.name.toLowerCase().includes(rawModel.toLowerCase())) {
          showToast("ℹ️ Používam uložený report (offline režim).", { type: "info" });
          renderOfflineReport(savedData.data);
          return;
        }
      }
      showToast("❌ Ste offline. Pre generovanie nového reportu je potrebné pripojenie.", { type: "error" });
      return;
    }

    if (options.showMain) {
      expertOverlay.hidden = false;
      expertContent.hidden = true;
      expertLoader.hidden = false;
      if (shareLinkPrivate) shareLinkPrivate.style.display = "none";
      if (shareLinkPublic) shareLinkPublic.style.display = "none";
      
      // Close auth modal if open
      if (authOverlay) authOverlay.style.display = "none";
      
      // Clear old countdown
      const existingTimer = qs("#auditTimer");
      if (existingTimer) existingTimer.remove();
    }

    try {
      let r, rd = {}, auditId, createdAt;

      if (forcedId) {
        // LOAD EXISTING AUDIT
        console.log(`📡 Fetching existing audit: ${forcedId}`);
        
        // Add a timeout to fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        let fetchedData;
        try {
          const resp = await fetch(`${API_BASE}/api/audits/${forcedId}`, { signal: controller.signal });
          clearTimeout(timeoutId);
          
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error(errData.error || `Server vrátil chybu ${resp.status}`);
          }
          
          fetchedData = await resp.json();
          if (!fetchedData.ok) throw new Error(fetchedData.error || "Audit sa nepodarilo načítať.");
          
          r = fetchedData.audit.products; // Joined product data
          rd = fetchedData.audit.report_data || {};
          auditId = forcedId;
          createdAt = fetchedData.audit.created_at;
        } catch (fErr) {
          clearTimeout(timeoutId);
          if (fErr.name === 'AbortError') throw new Error("Požiadavka na server vypršala. Skúste to prosím znova.");
          throw fErr;
        }

        // ⚖️ Final Price Recommendation: Use saved or calculate if 0
        if (fetchedData && fetchedData.audit.final_price_recommendation > 0) {
          r.base_price_recommended = fetchedData.audit.final_price_recommendation;
        } else {
          // If recommendation is 0, we take the base price and apply penalties manually
          const base = getFairPriceBasis(r.name, r.base_price_recommended, 0);
          const conditionPct = Number(rd.condition || 100);
          r.base_price_recommended = Math.round(base * (conditionPct / 100));
        }
      } else {
        // ... (generate new audit logic) ...
        // GENERATE NEW AUDIT
        let brand = "Apple";
        const modelLower = rawModel.toLowerCase();
        if (modelLower.includes("ps5") || modelLower.includes("sony") || modelLower.includes("playstation")) brand = "Sony";
        if (modelLower.includes("xbox") || modelLower.includes("microsoft") || modelLower.includes("surface")) brand = "Microsoft";
        if (modelLower.includes("nintendo") || modelLower.includes("switch")) brand = "Nintendo";
        if (modelLower.includes("samsung") || modelLower.includes("galaxy")) brand = "Samsung";
        if (modelLower.includes("msi")) brand = "MSI";
        if (modelLower.includes("acer")) brand = "Acer";
        if (modelLower.includes("asus")) brand = "ASUS";
        if (modelLower.includes("razer")) brand = "Razer";
        if (modelLower.includes("lenovo")) brand = "Lenovo";
        if (modelLower.includes("dell")) brand = "Dell";

        const response = await fetch(`${API_BASE}/api/audit/report?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(rawModel)}`);
        const data = await response.json();
        if (!data.ok) throw new Error(data.error || "Model sa nenachádza v expertných auditoch.");
        r = data.report;

        // ⚖️ Use Central Pricing Engine for Main Report (passing Heureka price if we have it)
        const currentHeurekaPrice = window.heurekaData?.priceAvg || 0;
        r.base_price_recommended = getFairPriceBasis(rawModel, r.base_price_recommended, currentHeurekaPrice);

        expertOverlay.dataset.productId = r.id; // Store for later save
        console.log("📦 Data received from DB:", r);
        createdAt = new Date().toISOString();
        
        // 💾 Save for Offline
        saveAuditOffline({ report: r, auditId: null, createdAt });

        // Save audit to history and get unique ID
        try {
          const mode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
          const currentBattery = mode === "buy" ? qs("[data-battery-health]")?.value : qs("[data-battery-health-sell]")?.value;
          const currentCondition = qs("[data-device-condition]")?.value || "100";
          const currentStorage = storageSelect?.value || "";
          const userEmail = localStorage.getItem("auditly_user_email");

          // Populate rd for rendering
          rd = { mode, battery: currentBattery, condition: currentCondition, storage: currentStorage };

          const saveResp = await fetch(`${API_BASE}/api/audits`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              product_id: r.id,
              user_email: userEmail,
              report_data: { 
                model: r.name, 
                specs: r.display_tech, 
                category: r.category,
                mode: mode,
                battery: currentBattery || "100",
                condition: currentCondition,
                storage: currentStorage,
                generated_at: new Date().toISOString()
              },
              risk_score: 95, 
              final_price_recommendation: r.base_price_recommended
            })
          });
          const saveData = await saveResp.json();
          if (saveData.ok) {
            auditId = saveData.id;
            expertOverlay.dataset.currentAuditId = auditId;
            console.log("✅ Audit saved successfully with ID:", auditId);
          }
        } catch (e) { console.warn("Failed to save audit history", e); }
      }

      if (auditId && (shareLinkPrivate || shareLinkPublic)) {
        expertOverlay.dataset.currentAuditId = auditId;
        if (shareLinkPrivate) shareLinkPrivate.style.display = "block";
        if (shareLinkPublic) shareLinkPublic.style.display = "block";
        saveAppState(); // 💾 Save state when audit is created
      }

      qs("#expertReportName").textContent = r.name;
      
      // ⚖️ The price is already calculated via getFairPriceBasis above
      let displayPrice = r.base_price_recommended || 0;
      qs("#expertRecommendedPrice").textContent = `${Number(displayPrice).toFixed(0)} €`;
      
      // Build Specs HTML (Minimal style for visual area)
      const mode = rd?.mode || document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
      const batteryVal = rd?.battery || (mode === "buy" ? qs("[data-battery-health]")?.value : qs("[data-battery-health-sell]")?.value) || "100";
      const conditionPct = rd?.condition || qs("[data-device-condition]")?.value || "100";

      qs("#expertReportSpecs").innerHTML = `
        <div class="expert-spec-item"><span class="expert-spec-label">Displej</span><span class="expert-spec-value">${r.display_tech || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Materiál</span><span class="expert-spec-value">${r.frame_material || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Kategória</span><span class="expert-spec-value">${r.category}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Stav batérie</span><span class="expert-spec-value">${batteryVal}%</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Vizuálny stav</span><span class="expert-spec-value">${conditionPct}%</span></div>
      `;

      // Build Risks HTML
      const risks = (typeof r.common_faults === 'string' ? JSON.parse(r.common_faults) : r.common_faults) || [];
      const risksHtml = risks.map(f => `
        <div class="expert-risk-item">
          <span class="expert-risk-icon">⚠️</span>
          <span style="font-weight: 700;">${f}</span>
        </div>
      `).join('');
      qs("#expertReportRisks").innerHTML = risksHtml;

      // Build Calculator & Strategy
      const strategyText = r.negotiation_tips || "";
      const strategyLines = strategyText.includes('\n') ? strategyText.split('\n') : [strategyText];
      const filteredStrategyLines = strategyLines
        .filter(l => l.trim().length > 3)
        .filter(l => {
          const lower = l.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Remove accents for better matching
          return !lower.includes("inzerovana cena") && 
                 !lower.includes("inzerovana") &&
                 !lower.includes("realna hodnota"); 
        });
      
      const calcHtml = filteredStrategyLines.map(line => {
        let icon = "✔️";
        let hint = "Expertné odporúčanie.";
        let cleanLine = line.trim();
        let priceDrop = 0;

        if (cleanLine.toLowerCase().includes("veta")) { icon = "🤝"; hint = "Veta pre vyjednávanie."; }
        
        // Extract price drop if present (e.g., "-70 €")
        const priceMatch = cleanLine.match(/-?\s*(\d+)\s*€/);
        if (priceMatch) {
          icon = "🏷️";
          hint = "Kliknutím odpočítate z ceny (ak vada existuje).";
          priceDrop = parseInt(priceMatch[1]);
        }

        return `
          <div class="expert-check-item" data-hint="${hint}" data-price-drop="${priceDrop}" style="cursor: ${priceDrop > 0 ? 'pointer' : 'default'}">
            <span class="expert-check-icon">${icon}</span>
            <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-weight: 700;">${cleanLine.replace(/^[✔️❌🤝🏷️🧮•\-\s⚠️!]+/, '').trim()}</span>
              ${priceDrop > 0 ? `<span class="price-impact-badge">-${priceDrop} €</span>` : ''}
            </div>
          </div>
        `;
      }).join('');
      qs("#expertReportCalculator").innerHTML = calcHtml;

      // ⚖️ Interactive Pricing Logic for Calculator
      window._baseFairPrice = displayPrice;
      const calcItems = document.querySelectorAll("#expertReportCalculator .expert-check-item");
      calcItems.forEach(item => {
        const drop = parseInt(item.dataset.priceDrop || 0);
        if (drop > 0) {
          item.addEventListener("click", () => {
            item.classList.toggle("is-checked");
            recalculateExpertPrice();
          });
        }
      });

      function recalculateExpertPrice() {
        let current = window._baseFairPrice;
        document.querySelectorAll("#expertReportCalculator .expert-check-item.is-checked").forEach(checked => {
          current -= parseInt(checked.dataset.priceDrop || 0);
        });
        qs("#expertRecommendedPrice").textContent = `${Math.round(current)} €`;
      }

      // Build Manual Checks HTML
      const checkHints = {
        "Pôvodný displej": "True Tone Check: V ovládacom centre podržte jas. Ak chýba True Tone, displej nie je originálny.",
        "FaceID funkčné": "FaceID Check: Otestujte registráciu tváre v nastaveniach.",
        "Kozmetické vady": "Pentalobe Skrutky: Skontrolujte skrutky pri porte. Ak sú doškriabané, mobil bol otváraný.",
        "Bez blokovania": "iCloud Check: Overte, či je Find My iPhone úplne odhlásený.",
        "Batéria": "Battery Spoofing: Porovnajte zdravie s cyklami. Nad 800 cyklov nemôže byť zdravie 95%.",
        "Kamera": "Lidar & Focus: Skúste zaostriť v tme. Ak neustále preostruje, Lidar je poškodený.",
        "Displej": "OLED Burn-in: Na čisto bielom obrázku hľadajte vypálené ikony alebo žlté mapy.",
        "GPS": "GPS & Gyro: V Mapách sa otočte. Ak sa šípka neotáča plynule, senzor je chybný.",
        "Tlačidlá": "Clicky Buttons: Stlačte všetky tlačidlá. Musia mať jasný mechanický klik.",
        "Mikrofón": "Trojitý Mikrofón: Nahrajte selfie video, zadné video a diktafón. Musia hrať všetky."
      };

      const manualItems = Array.from(document.querySelectorAll(".checkItem"))
        .map(el => {
          const text = el.textContent.replace(/[✔️❌]/g, '').trim();
          return {
            text: text,
            isGood: el.classList.contains("is-good"),
            icon: el.querySelector("span")?.textContent || (el.classList.contains("is-good") ? "✔️" : "❌"),
            hint: checkHints[text] || "Vizuálna kontrola stavu komponentu."
          };
        })
        .filter(item => item.text && item.text !== "—" && item.text.length > 2); 
      
      const manualHtml = manualItems.map(item => `
        <div class="expert-check-item" data-hint="${item.hint}" style="cursor: pointer;" onclick="this.classList.toggle('is-checked')">
          <span class="expert-check-icon" style="color: ${item.isGood ? '#10b981' : '#ef4444'}">${item.icon}</span>
          <span style="font-weight: 700;">${item.text}</span>
        </div>
      `).join('');
      qs("#expertReportManual").innerHTML = manualHtml;

      // Set Full Text for Master Report
      const fullReportText = r.full_report || "Hĺbkový report pre tento model sa pripravuje.";
      const formattedFullReport = fullReportText.split('\n')
        .filter(p => p.trim() !== '')
        .filter(p => {
          const lower = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          // 🛡️ Filter out advertised price and real value
          if (lower.includes("inzerovana cena") || lower.includes("inzerovana") || lower.includes("realna hodnota")) {
            return false;
          }
          return true;
        })
        .map(p => `<p style="margin-bottom: 20px; line-height: 1.8; color: rgba(255,255,255,0.8); font-size: 15px; font-weight: 500;">${p.trim()}</p>`).join('');
      qs("#expertReportFullText").innerHTML = formattedFullReport;

      expertLoader.hidden = true;
      expertContent.hidden = false;

      // ⏳ COUNTDOWN TIMER LOGIC
      if (createdAt) {
        const expiryDate = new Date(createdAt);
        expiryDate.setHours(expiryDate.getHours() + 62);
        
        const timerDiv = document.createElement("div");
        timerDiv.id = "auditTimer";
        timerDiv.style = "position:absolute; top:20px; right:70px; background:rgba(239,68,68,0.1); color:#ef4444; padding:6px 12px; border-radius:20px; font-size:11px; font-weight:800; border:1px solid rgba(239,68,68,0.2); z-index:100;";
        
        const updateTimer = () => {
          const now = new Date();
          const diff = expiryDate - now;
          if (diff <= 0) {
            timerDiv.textContent = "⏳ Audit expiroval";
            return;
          }
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const mins = Math.floor((diff / (1000 * 60)) % 60);
          timerDiv.textContent = `⏳ Expiruje o: ${hours}h ${mins}m`;
        };
        
        updateTimer();
        setInterval(updateTimer, 60000);
        const windowEl = qs(".expert-report-window");
        if (windowEl) windowEl.appendChild(timerDiv);
      }

      // 🆕 FILL RISKS MODAL SPECIFICALLY
      const risksOverlay = qs("#risksReportOverlay");
      if (risksOverlay && !risksOverlay.hidden) {
        qs("#risksReportName").textContent = r.name;
        qs("#risksReportRisks").innerHTML = risksHtml;
        qs("#risksReportManual").innerHTML = manualHtml;
        qs("#risksReportCalculator").innerHTML = calcHtml;
        
        // Extract only relevant "How to test" sections for Risks Modal
        const testingFullText = r.full_report || "";
        let relevantParts = [];
        
        // Find the "SEKUNDÁRNY AUDIT" part if it exists
        if (testingFullText.includes("SEKUNDÁRNY AUDIT")) {
          const split = testingFullText.split("SEKUNDÁRNY AUDIT");
          relevantParts = split[1].split('\n');
        } else {
          relevantParts = testingFullText.split('\n');
        }

        const testingSections = relevantParts
          .filter(p => p.trim() !== '')
          .filter(p => {
             const lower = p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
             // 🛡️ Filter out advertised price and real value
             if (lower.includes("inzerovana cena") || lower.includes("inzerovana") || lower.includes("realna hodnota")) {
               return false;
             }
             // Keep headers OR lines starting with bullets/checkmarks
             const isHeader = p.includes("🔍") || p.includes("🧪") || p.includes("🕵️‍♂️") || p.includes("🧼") || p.includes("📋") || p.includes("📉") || p.includes("💬") || p.includes("✅") || p.includes("⚡");
             const isContent = p.trim().startsWith("•") || p.trim().startsWith("-") || p.trim().startsWith("[") || p.trim().startsWith("Focus:");
             return isHeader || isContent;
          })
          .map(p => {
             const trimmed = p.trim();
             const isHeader = trimmed.includes("🔍") || trimmed.includes("🧪") || trimmed.includes("🕵️‍♂️") || trimmed.includes("🧼") || trimmed.includes("📋") || trimmed.includes("📉") || trimmed.includes("💬") || trimmed.includes("✅") || trimmed.includes("🧼");
             if (isHeader) {
               return `<h4 style="color: #a78bfa; margin-top: 25px; margin-bottom: 15px; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${trimmed}</h4>`;
             }
             return `<p style="margin-bottom: 10px; line-height: 1.6; color: rgba(255,255,255,0.7); font-size: 14px; font-weight: 600; padding-left: 10px;">${trimmed}</p>`;
          })
          .join('');
          
        qs("#risksReportFullText").innerHTML = testingSections || "<p>Pre tento model nie sú k dispozícii dodatočné testovacie inštrukcie.</p>";
        
        qs("#risksReportLoader").hidden = true;
        qs("#risksReportContent").hidden = false;
      }
    } catch (err) {
      console.error(err);
      qs("#expertReportName").textContent = "Audit nedostupný";
      expertLoader.innerHTML = `
        <div style="padding:40px">
          <p style="color:#ef4444; font-weight:900; font-size:18px">❌ CHYBA: ${err.message}</p>
          <button onclick="document.getElementById('expertReportOverlay').hidden = true" style="margin-top:25px; padding:15px 30px; background:#f1f5f9; border:none; border-radius:15px; font-weight:800; cursor:pointer">ZAVRIEŤ</button>
        </div>
      `;
    }
  };

  // 🔗 PUBLIC REPORT RENDERING LOGIC
  const renderPublicAudit = async (reportId) => {
    console.log("📂 [Public Audit] Rendering report:", reportId);
    const publicOverlay = qs("#publicAuditOverlay");
    if (!publicOverlay) {
      console.error("❌ [Public Audit] Overlay element #publicAuditOverlay not found!");
      return;
    }

    // Prepare UI
    publicOverlay.hidden = false;
    publicOverlay.style.display = "flex";
    
    // Close auth modal if open
    if (authOverlay) authOverlay.style.display = "none";
    
    // Only lock body scroll if NOT in full-page standalone mode
    if (!document.body.classList.contains('is-public-report')) {
    document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = ""; // Ensure it's scrollable in standalone mode
    }

    const factSheet = qs("#publicFactSheet");
    if (factSheet) {
      factSheet.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 40px;"><div class="loader-spinner"></div></div>`;
    }

    try {
      const url = `${API_BASE}/api/audits/${reportId}`;
      console.log("📡 [Public Audit] Fetching from:", url);
      const resp = await fetch(url);
      const data = await resp.json();
      
      if (!data.ok) {
        throw new Error(data.error || "Report sa nepodarilo načítať.");
      }

      const audit = data.audit;
      if (!audit) throw new Error("Audit data missing in response");
      
      const p = audit.products; 
      if (!p) throw new Error("Product data missing in audit report");

      const rd = audit.report_data || {}; 

      // Fill basic info
      const nameEl = qs("#publicAuditName");
      const idEl = qs("#publicAuditID");
      if (nameEl) nameEl.textContent = p.name;
      if (idEl) idEl.textContent = `ID Reportu: #AUD-${reportId.substring(0, 6).toUpperCase()}`;

      // 💾 Save for Offline
      saveAuditOffline({ audit: audit, publicMode: true });

      // View Counter
      const viewCounter = qs("#publicViewCounter");
      const viewNumber = qs("#viewCountNumber");
      if (viewCounter && viewNumber && audit.view_count !== undefined) {
        viewNumber.textContent = audit.view_count;
        viewCounter.style.display = "inline-flex";
      }

      // 1. Fact Sheet
      const catalogData = findDeviceInCatalog(p.name);
      
      // Get a potential predecessor and specific wins
      let predecessor = "predchádzajúce modely";
      let comparisonWin = "Vylepšený výkon a efektivita";
      let saleHighlights = [];

      const modelLower = p.name.toLowerCase();
      
      if (modelLower.includes("iphone 17")) { 
        predecessor = "iPhone 15/16"; 
        comparisonWin = "A19 čip: o 35% rýchlejší ako A16";
        saleHighlights = [
          { title: "🔝 Najnovšia technológia", desc: "Aktuálne najvýkonnejší smartfón na trhu s podporou Apple Intelligence Pro." },
          { title: "📸 Pro-Level video", desc: "Podpora 8K videa v ProRes kvalite pre náročných tvorcov." }
        ];
      }
      else if (modelLower.includes("iphone 16")) { 
        predecessor = "iPhone 14/15"; 
        comparisonWin = "A18 čip: nová generácia s podporou Apple Intelligence";
        saleHighlights = [
          { title: "🤖 Apple Intelligence", desc: "Plná podpora nových AI funkcií, ktoré nie sú dostupné na starších modeloch." },
          { title: "🔋 Extrémna výdrž", desc: "Vylepšená batéria a tepelný manažment pre dlhší herný výkon." }
        ];
      }
      else if (modelLower.includes("iphone 15")) { 
        predecessor = "iPhone 13/14"; 
        comparisonWin = "A16 Bionic: 4nm čip a moderný Ray Tracing";
        saleHighlights = [
          { title: "🔌 USB-C port", desc: "Oproti iPhonu 14 už ponúka univerzálne nabíjanie jedným káblom pre MacBook aj iPad." },
          { title: "🏝️ Dynamic Island", desc: "Interaktívny prvok namiesto výrezu, rovnaký ako na najnovšom iPhone 16." }
        ];
      }
      else if (modelLower.includes("iphone 14 pro")) {
        predecessor = "iPhone 13 Pro";
        comparisonWin = "A16 Bionic a 48MPx hlavný snímač";
        saleHighlights = [
          { title: "📱 Always-On displej", desc: "Prvý iPhone s funkciou stále zapnutého displeja a novým Dynamic Island." },
          { title: "⭐ Prémiová hodnota", desc: "Model, ktorý si drží cenu najlepšie a ponúka takmer rovnaký výkon ako iPhone 15." }
        ];
      }
      else if (modelLower.includes("iphone 14")) { 
        predecessor = "iPhone 13"; 
        comparisonWin = "Vylepšená vnútorná architektúra";
        saleHighlights = [
          { title: "🛠️ Servisná výhoda", desc: "Oproti iPhonu 13 má tento model kompletne prerobený vnútorný dizajn, ktorý umožňuje oveľa lacnejšiu výmenu zadného skla bez nutnosti rozoberania celého mobilu." },
          { title: "📡 Bezpečnosť", desc: "Prvá generácia iPhone (spolu s 14 Pro), ktorá obsahuje hardvérovú detekciu autonehody a satelitnú SOS komunikáciu." }
        ];
      }
      else if (modelLower.includes("iphone 13")) { 
        predecessor = "iPhone 11/12"; 
        comparisonWin = "A15 Bionic: plynulý systém aj v roku 2026";
        saleHighlights = [
          { title: "📉 Pomer cena/výkon", desc: "Oproti iPhonu 12 ponúka o 25% dlhšiu výdrž batérie a menší výrez (notch) v displeji." },
          { title: "📸 Cinematic Mode", desc: "Prvý model s filmovým režimom pre automatické rozostrenie pozadia vo videu." }
        ];
      }
      else if (modelLower.includes("iphone 12")) { 
        predecessor = "iPhone 11"; 
        comparisonWin = "A14 Bionic: prvý 5nm čip na svete";
        saleHighlights = [
          { title: "📺 OLED Displej", desc: "Obrovský skok oproti iPhonu 11 – ponúka jemný OLED panel namiesto staršieho LCD." },
          { title: "📐 Moderný dizajn", desc: "Návrat k obľúbeným hranatým tvarom a výrazne odolnejšiemu sklu Ceramic Shield." }
        ];
      }
      else if (modelLower.includes("s24")) { 
        predecessor = "S22/S23"; 
        comparisonWin = "Snapdragon 8 Gen 3: špičkový Ray Tracing";
        saleHighlights = [
          { title: "✨ Galaxy AI", desc: "Integrovaná umelá inteligencia pre preklad, úpravu fotiek a vyhľadávanie." },
          { title: "📅 7 rokov podpory", desc: "Samsung garantuje aktualizácie systému až do roku 2031." }
        ];
      }
      else if (modelLower.includes("s23")) {
        predecessor = "S21/S22";
        comparisonWin = "Snapdragon 8 Gen 2 for Galaxy";
        saleHighlights = [
          { title: "🏆 Najstabilnejší model", desc: "Legendárna výdrž batérie a stabilný výkon vďaka čipu Snapdragon." },
          { title: "🤳 Nightography", desc: "Výrazne lepšie nočné fotky v porovnaní s generáciou S22." }
        ];
      }
      else if (modelLower.includes("ps5")) { 
        predecessor = "PS4 Pro"; 
        comparisonWin = "SSD disk: nahrávanie hier za sekundy";
        saleHighlights = [
          { title: "🎮 DualSense feedback", desc: "Haptická odozva a adaptívne triggery, ktoré PS4 neponúka." },
          { title: "💿 Spätná kompatibilita", desc: "Spustíte na nej takmer všetky svoje hry z PlayStation 4." }
        ];
      }
      else {
        saleHighlights = [
          { title: "✅ Overená spoľahlivosť", desc: "Technicky preverený model s výbornou reputáciou medzi používateľmi." },
          { title: "💰 Výhodná kúpa", desc: "Aktuálna trhová cena zodpovedá technickej hodnote a výkonu zariadenia." }
        ];
      }

      if (factSheet) {
        factSheet.innerHTML = `
          <div class="fact-item">
            <span class="fact-label">🚀 Čipset & Výkon</span>
            <span class="fact-value">${catalogData?.cpu || p.display_tech.split('|')[0] || 'A-series Bionic'}</span>
            <span style="font-size: 11px; color: #10b981; font-weight: 800; background: rgba(16, 185, 129, 0.1); padding: 4px 8px; border-radius: 6px; margin-top: 5px; display: inline-block;">
              ⚡ ${comparisonWin} vs ${predecessor}
            </span>
          </div>
          <div class="fact-item">
            <span class="fact-label">📺 Displej</span>
            <span class="fact-value">${catalogData?.display || p.display_tech || 'OLED Retina'}</span>
            <span style="font-size: 11px; color: #60a5fa; font-weight: 700;">Dokonalé farby a vysoký jas</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">📸 Fotoaparát</span>
            <span class="fact-value">${catalogData?.camera || 'Pro Camera System'}</span>
            <span style="font-size: 11px; color: #a78bfa; font-weight: 700;">Profesionálne 4K video a portréty</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">🔋 Batéria & Výdrž</span>
            <span class="fact-value">${catalogData?.battery_cap || '4000+ mAh'}</span>
            <span style="font-size: 11px; color: #fbbf24; font-weight: 700;">Výdrž: ${catalogData?.battery_life || 'Celý deň'}</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">⚡ Nabíjanie</span>
            <span class="fact-value">${catalogData?.charging || 'Fast Charging'}</span>
            <span style="font-size: 11px; color: #34d399; font-weight: 700;">Rýchlosť: ${catalogData?.charging_time || 'cca 60 min'}</span>
          </div>
          <div class="fact-item">
            <span class="fact-label">🧠 Pamäť & RAM</span>
            <span class="fact-value">${rd.storage || '128GB'} | ${catalogData?.ram || '6GB'} RAM</span>
            <span style="font-size: 11px; color: #94a3b8; font-weight: 700;">Rýchle úložisko typu NVMe</span>
          </div>
        `;
      }

      // 2. Intro Text
      const introEl = qs("#publicIntroText");
      if (introEl) {
        introEl.innerHTML = `Na predaj <strong>${p.name}</strong> v konfigurácii <strong>${rd.storage || ''}</strong>. Zariadenie prešlo kompletným digitálnym preverením cez platformu Auditly.io. Nekupujte „mačku vo vreci“ – stavte na transparentnosť.`;
      }

      // 3. Why Better (AI Points)
      const comparisonGrid = qs("#publicComparisonPoints");
      if (comparisonGrid) {
        try {
          const aiResp = await fetch(`${API_BASE}/api/audit/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelA: p.name, modelB: predecessor })
          });
          const aiData = await aiResp.json();
          if (aiData.ok && aiData.result.pointsA) {
            comparisonGrid.innerHTML = aiData.result.pointsA.map(pt => {
              const colonIndex = pt.indexOf(':');
              const title = colonIndex !== -1 ? pt.substring(0, colonIndex).trim() : "Technický detail";
              const desc = colonIndex !== -1 ? pt.substring(colonIndex + 1).trim() : pt.trim();
              return `
                <div class="comp-point">
                  <strong class="comp-title">${title}</strong>
                  <p class="comp-desc">${desc}</p>
                </div>
              `;
            }).join('');
          } else { throw new Error(); }
        } catch (e) {
          const cpu = catalogData?.cpu || (modelLower.includes("iphone") ? "A-series Bionic" : "High-end procesor");
          const cam = catalogData?.camera || "Profesionálny systém kamier";
          const disp = catalogData?.display || "Vysoký dynamický rozsah";
          
          comparisonGrid.innerHTML = `
            <div class="comp-point">
              <strong class="comp-title">🚀 Architektúra: ${cpu}</strong>
              <p class="comp-desc">Tento čipset bol navrhnutý pre maximálnu efektivitu. V porovnaní s ${predecessor} ponúka o poznanie plynulejší chod systému a lepšiu správu energie.</p>
            </div>
            <div class="comp-point">
              <strong class="comp-title">📸 Optika: ${cam.split('|')[0]}</strong>
              <p class="comp-desc">Pokročilý hardvér v kombinácii s výpočtovou fotografiou zaručuje ostré zábery aj v náročných svetelných podmienkach.</p>
            </div>
            <div class="comp-point">
              <strong class="comp-title">☀️ Displej: ${disp.split('|')[0]}</strong>
              <p class="comp-desc">Technológia panelu s vysokým kontrastom zabezpečuje verné zobrazenie farieb, čo oceníte pri sledovaní videí aj práci na priamom slnku.</p>
            </div>
          `;
        }
      }

      // 4. Verified Params
      const paramsGrid = qs("#publicVerifiedParams");
      if (paramsGrid) {
        const mode = rd.mode || "sell";
        // 🛡️ User Request: "originalne komponenty overte na oficialnej stranke apple"
        const buyCheck = mode === "buy" ? "✅ Overená konfigurácia" : "🛡️ Originálne komponenty (overte na webe Apple)";
        const auditDate = new Date(audit.created_at).toLocaleDateString("sk-SK");
        
        // 🔋 Battery: Use rd.battery (user input)
        const batteryVal = rd.battery || "100";
        
        // 💎 Visual Status: Use rd.condition (%)
        const conditionPct = rd.condition || "100";
        const safetyCheck = mode === "buy" ? "🔍 Forenzný checklist" : `💎 Vizuálny stav: ${conditionPct}%`;

        paramsGrid.innerHTML = `
          <div class="verified-param"><span>🛡️</span> ${buyCheck}</div>
          <div class="verified-param"><span>📺</span> Displej: ${catalogData?.display || 'Super Retina XDR OLED'}</div>
          <div class="verified-param"><span>💧</span> Odolnosť: IP68 / Ceramic Shield</div>
          <div class="verified-param"><span>🔋</span> Batéria: ${batteryVal}% Health (k dátumu ${auditDate})</div>
          <div class="verified-param"><span>🔎</span> ${safetyCheck}</div>
        `;
      }

      // 5. Audit Rule & Disclaimer
      const ruleBox = qs("#publicAuditRuleBox");
      const ruleText = qs("#publicAuditRuleText");
      if (ruleBox && ruleText) {
        let text = "";
        if (p.name.includes("iPhone 15") || p.name.includes("iPhone 16") || p.name.includes("iPhone 17")) {
          text = `${p.name} je model, ktorý priamo v menu Nastavenia (Batéria -> Zdravie batérie) ukazuje presný počet cyklov batérie a dátum výroby. To umožňuje dokonalú kontrolu opotrebenia bez externých aplikácií.`;
        } else if (p.name.includes("iPhone")) {
          text = "Pri starších modeloch iPhone odporúčame v rámci auditu skontrolovať zdravie batérie a či nebol menený displej (hláška v Nastaveniach). Tento report overuje pôvodnú konfiguráciu.";
        }
        
        // Add Disclaimer: "napisat ze za pravost tychto informacii zodpoveda on nie ja"
        text += `<br><br><span style="font-size: 11px; opacity: 0.8; font-weight: 400; line-height: 1.6; display: block; background: rgba(2, 6, 23, 0.2); padding: 10px; border-radius: 10px;">⚠️ <strong>Právne upozornenie:</strong> Za skutočný technický stav a pravosť údajov o batérii zodpovedá výhradne predávajúci. Auditly.io je sprostredkovateľom týchto informácií a vykonáva digitálne overenie špecifikácií na základe vstupných dát. Odporúčame vizuálnu kontrolu pri osobnom stretnutí.</span>`;
        
        ruleText.innerHTML = text;
          ruleBox.style.display = "block";
      }

      // 6. Sale Highlights
      const highlightsGrid = qs("#publicSaleHighlights");
      if (highlightsGrid && saleHighlights.length > 0) {
        highlightsGrid.innerHTML = saleHighlights.map(h => `
          <div class="public-card" style="padding: 20px;">
            <strong style="color: #10b981; font-size: 14px; display: block; margin-bottom: 5px;">${h.title}</strong>
            <p style="font-size: 13px; color: #cbd5e1; line-height: 1.5; margin: 0;">${h.desc}</p>
          </div>
        `).join('');
      } else if (highlightsGrid) {
        highlightsGrid.innerHTML = "<p style='grid-column: 1/-1; text-align: center; opacity: 0.5;'>Špecifické výhody pre tento kus sa načítavajú...</p>";
      }

      // Final UI cleanup
      const loader = qs("#publicAuditLoader");
      const content = qs("#publicAuditContent");
      if (loader) loader.hidden = true;
      if (content) content.hidden = false;

      // 🛡️ Floating Verified Badge
      const existingBadge = document.querySelector(".verified-floating-badge");
      if (existingBadge) existingBadge.remove();
      const badge = document.createElement("div");
      badge.className = "verified-floating-badge";
      badge.innerHTML = `<span>🛡️</span> VERIFIKOVANÝ AUDIT`;
      document.body.appendChild(badge);

    } catch (err) {
      console.error("❌ [Public Audit] Render error:", err);
      showToast("❌ Report sa nepodarilo načítať. Skúste to neskôr.", { type: "error" });
      
      // If we are in public report mode, show a friendly error on screen
      if (document.body.classList.contains('is-public-report')) {
        publicOverlay.innerHTML = `
          <div style="text-align:center; padding: 100px 20px; color: white;">
            <h1 style="font-size: 64px;">📂</h1>
            <h2 style="margin: 20px 0;">Report expiroval alebo neexistuje</h2>
            <p style="opacity: 0.6; margin-bottom: 30px;">Odkaz na tento technický audit už nie je platný (limit 30 dní) alebo bol odstránený.</p>
            <a href="/" style="padding: 15px 30px; background: #a78bfa; color: white; border-radius: 12px; font-weight: 700; text-decoration: none;">Späť na Auditly.io</a>
          </div>
        `;
      }
    }
  };

  // 🔗 COPY PUBLIC LINK LOGIC
  qs("#copyPublicLink")?.addEventListener("click", () => {
    // Get current report ID from the UI subtitle or state
    const reportIdMatch = qs("#publicAuditID").textContent.match(/#AUD-([A-Z0-9]+)/);
    const reportParam = new URLSearchParams(window.location.search).get('report');
    const actualId = reportParam || expertOverlay.dataset.currentAuditId;

    if (!actualId) {
      showToast("❌ ID reportu nebolo nájdené.", { type: "error" });
      return;
    }

    const productionDomain = "https://auditlyio.sk";
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const shareBase = isLocal ? productionDomain : window.location.origin;

    const shareUrl = `${shareBase}/?report=${actualId}`;
    
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast("✅ Odkaz na tento report bol skopírovaný!", { type: "success" });
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast("✅ Odkaz na tento report bol skopírovaný!", { type: "success" });
    }
  });

  qs("#closePublicAudit")?.addEventListener("click", () => {
    if (document.body.classList.contains('is-public-report')) {
      // If public, don't just hide, maybe redirect or show "Generated by Auditly"
      window.location.href = window.location.origin;
      return;
    }
    const publicOverlay = qs("#publicAuditOverlay");
    publicOverlay.hidden = true;
    publicOverlay.style.display = "none";
    document.body.style.overflow = "";
    const url = new URL(window.location.href);
    url.searchParams.delete('report');
    window.history.replaceState({}, '', url);
  });

  // 🚀 STARTUP LOGIC
  const urlParams = new URLSearchParams(window.location.search);
  const auditParam = urlParams.get('audit');
  const reportParam = urlParams.get('report');

  console.log("🔍 Startup Params - audit:", auditParam, "report:", reportParam);

  const runOnboarding = () => {
    console.log("🚀 Spúšťam onboarding...");
    const overlay = document.getElementById("welcomeOverlay");
    if (overlay) {
      overlay.style.display = "flex";
      // Ensure all children are visible
      const content = overlay.querySelector('.expert-report-window');
      if (content) content.style.display = "block";
      
      document.body.style.overflow = "hidden";
    } else {
      console.warn("⚠️ welcomeOverlay nenájdený, spúšťam toasty.");
      startOnboardingToasts();
    }
  };

  const startOnboardingToasts = () => {
    setTimeout(() => {
      showToast("1️⃣ Začnite výberom kategórie a modelu zariadenia.", { type: "info", duration: 5000 });
      setTimeout(() => {
        showToast("📸 Alebo skúste AI skener pre inteligentný odhad stavu.", { type: "info", duration: 5000 });
        setTimeout(() => {
          showToast("🛡️ Získajte expertný report a férovú trhovú cenu.", { type: "success", duration: 5000 });
          setTimeout(() => {
            showToast("🔗 Nakoniec vygenerujte inzerát s unikátnym Live Reportom.", { type: "info", duration: 5000 });
          }, 5500);
        }, 5500);
      }, 5500);
    }, 1000);
  };

  const welcomeOverlay = qs("#welcomeOverlay");
  const closeWelcomeBtn = qs("#closeWelcomeBtn");

  if (reportParam) {
    console.log("📑 Loading Public Report View for ID:", reportParam);
    // PUBLIC REPORT VIEW: Hide everything else for maximum professional look
    document.body.classList.add('is-public-report');
    const mainPage = qs('.page');
    if (mainPage) mainPage.style.display = 'none';
    
    // Ensure expert is hidden
    if (expertOverlay) expertOverlay.hidden = true;
    
    // Show overlay immediately
    const publicOverlay = qs("#publicAuditOverlay");
    if (publicOverlay) {
      publicOverlay.hidden = false;
      publicOverlay.style.display = "flex";
    }
    
    setTimeout(() => renderPublicAudit(reportParam), 50);
  } else if (auditParam) {
    console.log("🔐 Loading Expert Report View for ID:", auditParam);
    // EXPERT REPORT VIEW (Internal/Shared): Also hide everything else
    document.body.classList.add('is-public-report');
    const mainPage = qs('.page');
    if (mainPage) mainPage.style.display = 'none';

    // Ensure public is hidden
    const publicOverlay = qs("#publicAuditOverlay");
    if (publicOverlay) publicOverlay.hidden = true;

    // Show overlay immediately
    if (expertOverlay) {
      expertOverlay.hidden = false;
      expertOverlay.style.display = "flex";
    }
    
    setTimeout(() => handleOpenExpertReport(auditParam), 50);
  } else {
    // Check if first visit
    const hasVisited = localStorage.getItem("auditly_visited");
    if (!hasVisited && welcomeOverlay) {
      runOnboarding();
    }
  }


  closeWelcomeBtn?.addEventListener("click", () => {
    if (welcomeOverlay) {
      welcomeOverlay.style.display = "none";
    }
    document.body.style.overflow = "";
    localStorage.setItem("auditly_visited", "true");
    startOnboardingToasts();
  });

  qs("#startTourBtn")?.addEventListener("click", () => {
    runOnboarding();
  });

  // Smooth Scroll for Navigation Links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === "#" || href === "") return;
      
      const targetId = href.substring(1);
      const target = document.getElementById(targetId);
      
      if (target) {
        e.preventDefault();
        const headerOffset = 100;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        });

        // Close mobile menu if open
        if (qs("[data-mobile-menu]")) {
          qs("[data-mobile-menu]").hidden = true;
          qs("[data-hamburger]").classList.remove("is-active");
        }
      }
    });
  });

  // Preview buttons
  const triggerPublicPreview = async () => {
    // Ensure we have an ID
    if (!expertOverlay.dataset.currentAuditId) {
      console.log("⏳ Saving audit for preview...");
      try {
        await handleOpenExpertReport(null, { showMain: false });
      } catch (err) {
        console.error("❌ Failed to save audit for preview:", err);
        return;
      }
    }
    
    const reportId = expertOverlay.dataset.currentAuditId;
    if (reportId) {
      renderPublicAudit(reportId);
    } else {
      showToast("❌ Nepodarilo sa vygenerovať ID reportu.", { type: "error" });
    }
  };

  qs("#previewPublicReportBtn")?.addEventListener("click", triggerPublicPreview);
  qs("[data-preview-public-direct]")?.addEventListener("click", triggerPublicPreview);

  const openRisksBtn = qs("[data-open-risks-modal]");
  const risksOverlay = qs("#risksReportOverlay");
  const closeRisksBtn = qs("#closeRisksReport");

  const handleOpenRisksReport = async () => {
    if (!risksOverlay) return;
    risksOverlay.hidden = false;
    qs("#risksReportLoader").hidden = false;
    qs("#risksReportContent").hidden = true;
    
    await handleOpenExpertReport(null, { showMain: false });
  };

  openRisksBtn?.addEventListener("click", handleOpenRisksReport);
  closeRisksBtn?.addEventListener("click", () => risksOverlay.hidden = true);
  risksOverlay?.addEventListener("click", (e) => {
    if (e.target === risksOverlay) risksOverlay.hidden = true;
  });

  openExpertBtns.forEach(btn => btn.addEventListener("click", () => handleOpenExpertReport()));
  closeExpertBtn?.addEventListener("click", () => {
    if (document.body.classList.contains('is-public-report')) {
      window.location.href = window.location.origin;
      return;
    }
    expertOverlay.hidden = true;
  });
  
  expertOverlay?.addEventListener("click", (e) => {
    if (e.target === expertOverlay) expertOverlay.hidden = true;
  });

  // 💾 STATE PERSISTENCE: Save and restore app state
  const saveAppState = () => {
    try {
      const modeInput = document.querySelector('input[name="auditMode"]:checked');
      if (!modeInput) return;
      const mode = modeInput.value;
      const state = {
        category: categorySelect?.value,
        model: modelSelect?.value,
        storage: storageSelect?.value,
        ram: qs("[data-ram-select]")?.value,
        color: qs("[data-color-select]")?.value,
        battery: mode === "sell" ? qs("[data-battery-health-sell]")?.value : qs("[data-battery-health]")?.value,
        condition: qs("[data-device-condition]")?.value,
        mode: mode,
        auditId: expertOverlay?.dataset?.currentAuditId,
        timestamp: Date.now()
      };
      localStorage.setItem("auditly_last_audit_state", JSON.stringify(state));
      console.log("💾 App state persisted.");
    } catch (e) { console.warn("Failed to save app state", e); }
  };

  const loadAppState = async () => {
    try {
      const saved = localStorage.getItem("auditly_last_audit_state");
      if (!saved) return;
      
      const state = JSON.parse(saved);
      // Only restore if not older than 4 hours
      if (Date.now() - state.timestamp > 4 * 60 * 60 * 1000) {
        localStorage.removeItem("auditly_last_audit_state");
        return;
      }

      console.log("📂 Restoring app state...", state);

      if (state.mode) {
        const modeInput = document.querySelector(`input[name="auditMode"][value="${state.mode}"]`);
        if (modeInput) {
          modeInput.checked = true;
          modeInput.dispatchEvent(new Event("change"));
        }
      }

      if (state.category) {
        categorySelect.value = state.category;
        categorySelect.dispatchEvent(new Event("change"));
        
        // Wait for models to populate
        await new Promise(r => setTimeout(r, 100));
        
        if (state.model) {
          modelSelect.value = state.model;
          modelSelect.dispatchEvent(new Event("change"));
          
          await new Promise(r => setTimeout(r, 100));
          if (state.storage) storageSelect.value = state.storage;
          if (state.ram) {
            const ramEl = qs("[data-ram-select]");
            if (ramEl) ramEl.value = state.ram;
          }
          if (state.color) {
            const colorEl = qs("[data-color-select]");
            if (colorEl) colorEl.value = state.color;
          }
        }
      }

      if (state.battery) {
        const batEl = state.mode === "sell" ? qs("[data-battery-health-sell]") : qs("[data-battery-health]");
        if (batEl) batEl.value = state.battery;
      }

      if (state.condition) {
        const condEl = qs("[data-device-condition]");
        if (condEl) condEl.value = state.condition;
      }

      if (state.auditId) {
        expertOverlay.dataset.currentAuditId = state.auditId;
        // Trigger price fetch to show the card
        fetchHeurekaPrice();
      }
    } catch (e) { console.warn("Failed to load app state", e); }
  };

  // ⚖️ COMPARISON SYSTEM LOGIC
  const compareOverlay = qs("#compareReportOverlay");
  const openCompareBtn = qs("[data-open-compare-modal]");
  const closeCompareBtn = qs("#closeCompareReport");

  const getViralSlogan = (cat, type) => {
    // Falls back to window.VIRAL_SLOGANS from slogans.js
    const list = window.VIRAL_SLOGANS?.[cat]?.[type] || ["Neznámy parameter pre neznámy život."];
    return list[Math.floor(Math.random() * list.length)];
  };

  const compareCats = { a: qs("[data-compare-cat-a]"), b: qs("[data-compare-cat-b]") };
  const compareModels = { a: qs("[data-compare-model-a]"), b: qs("[data-compare-model-b]") };
  const compareContents = { a: qs("#compareContentA"), b: qs("#compareContentB") };

  const updateCompareModels = (side) => {
    const cat = compareCats[side].value;
    const models = DB_CATALOG[cat] || CATALOG[cat] || [];
    compareModels[side].innerHTML = `<option value="" disabled selected>Vyberte model</option>` +
      models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    compareModels[side].disabled = false;
  };

  const fetchCompareData = async (side) => {
    const model = compareModels[side].value;
    const cat = compareCats[side].value;
    if (!model) return;

    compareContents[side].innerHTML = `<div style="padding:40px; text-align:center"><div class="loader-spinner"></div></div>`;

    try {
      let brand = "Apple";
      const mLower = model.toLowerCase();
      if (mLower.includes("ps5") || mLower.includes("sony") || mLower.includes("playstation")) brand = "Sony";
      else if (mLower.includes("xbox") || mLower.includes("microsoft")) brand = "Microsoft";
      else if (mLower.includes("nintendo") || mLower.includes("switch")) brand = "Nintendo";
      else if (mLower.includes("samsung")) brand = "Samsung";
      else if (mLower.includes("hp")) brand = "HP";
      else if (mLower.includes("acer")) brand = "Acer";
      else if (mLower.includes("msi")) brand = "MSI";
      else if (mLower.includes("lenovo") || mLower.includes("legion") || mLower.includes("thinkpad")) brand = "Lenovo";
      else if (mLower.includes("dell") || mLower.includes("xps") || mLower.includes("alienware")) brand = "Dell";
      else if (mLower.includes("asus") || mLower.includes("rog") || mLower.includes("zenbook") || mLower.includes("vivobook")) brand = "ASUS";
      else if (mLower.includes("razer") || mLower.includes("blade")) brand = "Razer";
      else if (mLower.includes("gigabyte") || mLower.includes("aorus")) brand = "Gigabyte";
      else if (mLower.includes("huawei") || mLower.includes("matebook")) brand = "Huawei";
      else if (mLower.includes("xiaomi") || mLower.includes("redmibook")) brand = "Xiaomi";
      
      // If category is Notebook and brand is still Apple but name doesn't have MacBook, set generic
      if (cat === "Notebook" && brand === "Apple" && !mLower.includes("macbook")) brand = "Notebook";
      
      const resp = await fetch(`${API_BASE}/api/audit/report?brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`);
      const data = await resp.json();
      
      if (data.ok) {
        const priceResp = await fetch(`${API_BASE}/api/heureka?model=${encodeURIComponent(model)}`);
        const priceData = await priceResp.json();
        const finalReport = data.report;
        
        // ⚖️ Use Central Pricing Engine for Comparison
        finalReport.base_price_recommended = getFairPriceBasis(
          model, 
          finalReport.base_price_recommended, 
          priceData.ok ? priceData.priceAvg : 0
        );

        // Store report in dataset for re-rendering if needed
        compareContents[side].dataset.rawReport = JSON.stringify(finalReport);

        renderCompareSide(side, finalReport);

        // Re-render the OTHER side if it's already loaded to sync slogans (Serious vs Humorous)
        const otherSide = side === 'a' ? 'b' : 'a';
        if (compareContents[otherSide].dataset.loaded && compareContents[otherSide].dataset.rawReport) {
          renderCompareSide(otherSide, JSON.parse(compareContents[otherSide].dataset.rawReport));
        }

        await checkCompareComplete();
      } else {
        throw new Error("Model nebol nájdený v databáze.");
      }
    } catch (e) {
      console.error(e);
      compareContents[side].innerHTML = `<p style="color:#ef4444; padding: 20px; font-weight: 700;">⚠️ ${e.message}</p>`;
    }
  };

  const renderCompareSide = (side, r) => {
    const risks = (typeof r.common_faults === 'string' ? JSON.parse(r.common_faults) : r.common_faults) || [];
    let price = r.base_price_recommended || 0;
    const catalogData = findDeviceInCatalog(r.name);
    const cat = compareCats[side].value;

    // Detect if we are in "Humorous" or "Serious" mode
    const otherSide = side === 'a' ? 'b' : 'a';
    const otherCat = compareCats[otherSide]?.value;
    const isSameCategory = cat === otherCat;
    
    let color = "#a78bfa";
        let icon = "📦";
    let title = "Technické Špecifikácie";

    if (cat === "Mobil") { color = "#f472b6"; icon = "🤳"; title = isSameCategory ? "Mobilné Zariadenie" : "📱 Mobilná Realita"; }
    else if (cat === "Konzola") { color = "#3b82f6"; icon = "🎧"; title = isSameCategory ? "Herná Konzola" : "🎮 Gamer Life"; }
    else if (cat === "Notebook") { color = "#10b981"; icon = "☕"; title = isSameCategory ? "Prenosný Počítač" : "💻 Workaholic Mode"; }
    else if (cat === "Tablet") { color = "#f59e0b"; icon = "🎨"; title = isSameCategory ? "Multimediálny Tablet" : "✍️ Tablet Life"; }
    else if (cat === "Hodinky") { color = "#ef4444"; icon = "⌚"; title = isSameCategory ? "Smart Hodinky" : "🏃‍♂️ Sport Mode"; }
    else if (cat === "Slúchadlá") { color = "#06b6d4"; icon = "🎵"; title = isSameCategory ? "Audio Príslušenstvo" : "🎧 Audio World"; }

    let infoHtml = `
      <div class="info-card" style="border-left: 4px solid ${color};">
            <span class="compare-section-title" style="color: ${color};">${title}</span>
        ${!isSameCategory ? `
        <p style="font-size: 13px; font-weight: 600; color: #ffffff; margin-bottom: 12px; line-height: 1.4;">
          "${getViralSlogan(cat, 'info')}"
        </p>` : ''}
        <div class="expert-spec-item"><span class="expert-spec-label">Čipset</span><span class="expert-spec-value">${catalogData?.cpu || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">RAM</span><span class="expert-spec-value">${catalogData?.ram || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Displej</span><span class="expert-spec-value">${catalogData?.display || r.display_tech || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Fotoaparát</span><span class="expert-spec-value">${catalogData?.camera || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Nabíjanie</span><span class="expert-spec-value">${catalogData?.charging || 'N/A'}</span></div>
        <div class="expert-spec-item"><span class="expert-spec-label">Materiál</span><span class="expert-spec-value">${catalogData?.material || r.frame_material || 'N/A'}</span></div>
          </div>
        `;

    let risksHtml = '';
    if (!isSameCategory) {
        risksHtml = `
        <div class="expert-risk-item" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05); padding: 12px; margin-bottom: 10px;">
            <span class="expert-risk-icon">${icon}</span>
          <span style="font-size: 12px; font-weight: 700; color: #fca5a5;">"${getViralSlogan(cat, 'risks')}"</span>
          </div>
        `;
    }
    
    risksHtml += risks.slice(0, 3).map(f => `
      <div class="expert-risk-item" style="padding: 10px 15px; font-size: 12px; margin-bottom: 8px;">
        <span class="expert-risk-icon">⚠️</span>
        <span>${f}</span>
      </div>
    `).join('');

    compareContents[side].innerHTML = `
      <div class="compare-price-box">
        <span class="compare-section-title">Odporúčaná cena</span>
        <div class="compare-price-value">${Number(price).toFixed(0)} €</div>
      </div>
      ${infoHtml}
      <div class="info-card">
        <span class="compare-section-title">Expertná Analýza</span>
        ${risksHtml}
      </div>
    `;
    compareContents[side].dataset.loaded = "true";
    compareContents[side].dataset.modelName = r.name;
    compareContents[side].dataset.price = price;
    compareContents[side].dataset.cpu = catalogData?.cpu || '';
    compareContents[side].dataset.ram = catalogData?.ram || '';
    compareContents[side].dataset.cat = cat;
  };

  const checkCompareComplete = async () => {
    if (compareContents.a.dataset.loaded && compareContents.b.dataset.loaded) {
      const summaryBox = qs("#compareSummarySection");
      const sumA = qs("#summaryA");
      const sumB = qs("#summaryB");

      const nameA = compareContents.a.dataset.modelName;
      const nameB = compareContents.b.dataset.modelName;
      const priceA = Number(compareContents.a.dataset.price);
      const priceB = Number(compareContents.b.dataset.price);
      const catA = compareContents.a.dataset.cat;
      const catB = compareContents.b.dataset.cat;

      summaryBox.hidden = false;
      
      // Loading state for AI summary
      sumA.innerHTML = `<div style="padding:20px; text-align:center;"><div class="loader-spinner"></div><p style="font-size:12px; margin-top:10px; color:#94a3b8;">AI analyzuje technické rozdiely...</p></div>`;
      sumB.innerHTML = `<div style="padding:20px; text-align:center;"><div class="loader-spinner"></div><p style="font-size:12px; margin-top:10px; color:#94a3b8;">Pripravujem expertný verdikt...</p></div>`;
      
      if (catA !== catB) {
        let verdict = "Porovnávaš neporovnateľné, ale aspoň je vidieť, že máš fantáziu. Vyber si to drahšie, nech máš pocit, že si niečo dosiahol.";
        const isGame = catA === "Konzola" || catB === "Konzola";
        const isMobile = catA === "Mobil" || catB === "Mobil";
        const isLaptop = catA === "Notebook" || catB === "Notebook";
        const isWatch = catA === "Hodinky" || catB === "Hodinky";

        if (isMobile && isGame) {
          verdict = "Vyber si konzolu. Aj tak nemáš kamarátov a toto ti aspoň zaručí, že 24/7 na tom gauči nebudeš sedieť len tak naprázdno.";
        } else if (isMobile && isLaptop) {
          verdict = "Vyber si MacBook. Na iPhone už máš aj tak vybudovanú závislosť, tak aspoň predstieraj, že na tom notebooku aj niečo robíš.";
        } else if (isWatch && isMobile) {
          verdict = "Vyber si hodinky. Aspoň ti budú pripomínať, že tvoj čas plynie, kým ty len bezcieľne skroluješ ten iPhone.";
        }

        sumA.innerHTML = `<strong>💀 Úprimný Verdikt</strong> 
          <p style="font-size: 16px; font-weight: 800; color: #a78bfa; line-height: 1.6;">"${verdict}"</p>`;
        sumB.innerHTML = `<strong>🚀 Prečo toto porovnanie?</strong>
          <p style="font-size: 14px; color: #94a3b8;">Report bol upravený pre maximálny virálny potenciál. Zdieľaj ho, kým ťa mama nezavolá na večeru.</p>`;
        return;
      }

      // --- AI-DRIVEN SAME-CATEGORY COMPARISON ---
      try {
        // 🆕 CACHE CHECK
        const cacheKey = `compare_${nameA}_vs_${nameB}`.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const cached = localStorage.getItem(cacheKey);
        
        let res;
        if (cached) {
          console.log("💎 Using cached AI comparison results.");
          res = JSON.parse(cached);
        } else {
          console.log("🤖 Fetching fresh AI comparison results...");
          const resp = await fetch(`${API_BASE}/api/audit/compare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modelA: nameA, modelB: nameB })
          });
          const data = await resp.json();
          if (!data.ok) throw new Error("AI Comparison failed");
          res = data.result;
          // Save to cache
          localStorage.setItem(cacheKey, JSON.stringify(res));
        }

        // 🆕 UPDATE TECH SPECS WITH AI DATA (GROUNDING)
          const updateSpecs = (side, specs) => {
            const content = compareContents[side];
            if (!content || !specs) return;
            const specItems = content.querySelectorAll(".expert-spec-item");
            if (specItems.length >= 6) {
              specItems[0].querySelector(".expert-spec-value").textContent = specs.cpu || 'N/A';
              specItems[1].querySelector(".expert-spec-value").textContent = specs.ram || 'N/A';
              specItems[2].querySelector(".expert-spec-value").textContent = specs.display || 'N/A';
              specItems[3].querySelector(".expert-spec-value").textContent = specs.camera || 'N/A';
              specItems[4].querySelector(".expert-spec-value").textContent = specs.charging || 'N/A';
              specItems[5].querySelector(".expert-spec-value").textContent = specs.material || 'N/A';
            }
          };

          updateSpecs('a', res.specsA);
          updateSpecs('b', res.specsB);

          const renderPoints = (positives, negatives) => {
            let html = `<ul style="padding-left: 20px; margin-top: 15px; list-style-type: '👉 '; color: #cbd5e1;">`;
            html += positives.map(p => `<li style="margin-bottom: 10px;">${p}</li>`).join('');
            html += `</ul>`;
            
            if (negatives && negatives.length > 0) {
              html += `<div style="margin-top: 15px; padding: 10px; background: rgba(239, 68, 68, 0.05); border-radius: 8px; border-left: 3px solid #ef4444;">`;
              html += `<div style="font-size: 11px; text-transform: uppercase; color: #fca5a5; font-weight: 800; margin-bottom: 5px;">⚠️ Slabšie stránky</div>`;
              html += `<ul style="padding-left: 15px; margin: 0; list-style-type: '• '; font-size: 13px; color: #fca5a5;">`;
              html += negatives.map(n => `<li style="margin-bottom: 3px;">${n}</li>`).join('');
              html += `</ul></div>`;
            }
            return html;
          };

          sumA.innerHTML = `<strong>🏆 Prečo si vybrať ${nameA}?</strong> ${renderPoints(res.pointsA, res.negativesA)}`;

          sumB.innerHTML = `<strong>🎯 Prečo si vybrať ${nameB}?</strong> ${renderPoints(res.pointsB, res.negativesB)}
            <div style="margin-top:20px; padding:15px; background:rgba(167, 139, 250, 0.1); border-radius:12px; border: 1px solid rgba(167, 139, 250, 0.3);">
              <div style="font-size:12px; text-transform:uppercase; color:#a78bfa; font-weight:800; margin-bottom:5px;">💡 Expertný Verdikt</div>
              <p style="font-size:14px; color:#ffffff; font-weight:600; line-height:1.4;">${res.verdict}</p>
            </div>`;
      } catch (e) {
        console.warn("AI Comparison failed, falling back to basic logic", e);
        // Fallback logic (original hardcoded logic)
        let cpuA = compareContents.a.dataset.cpu;
        let cpuB = compareContents.b.dataset.cpu;
        let pointsA = [
          `${priceA < priceB ? '<b>Ekonomická výhoda:</b> Ušetríš približne ' + Math.round(priceB - priceA) + ' €' : '<b>Prémiový model:</b> Najlepšia dostupná výbava'}`,
          `${cpuA.includes("Pro") || cpuA.includes("M3") ? '<b>Vysoký výkon:</b> Čipset ' + cpuA + ' je stavaný na náročné úlohy' : 'Stabilný a overený výkon'}`,
          `${nameA.toLowerCase().includes("plus") || nameA.toLowerCase().includes("max") ? '<b>Excelentná výdrž:</b> Väčšie telo = viac batérie' : 'Kompaktná ergonómia'}`
        ];
        let pointsB = [
          `${priceB < priceA ? '<b>Výhodnejšia kúpa:</b> Ušetríš ' + Math.round(priceA - priceB) + ' €' : '<b>Vyšší level:</b> Modernejšia technológia'}`,
          `${cpuB.includes("Pro") || cpuB.includes("M3") ? '<b>Top-tier procesor:</b> ' + cpuB : 'Efektívny manažment energie'}`,
          `${nameB.toLowerCase().includes("plus") || nameB.toLowerCase().includes("max") ? '<b>Maximálny displej:</b> Viac plochy pre prácu' : 'Praktická veľkosť do vrecka'}`
        ];

      sumA.innerHTML = `<strong>🏆 Prečo si vybrať ${nameA}?</strong> 
        <ul style="padding-left: 20px; margin-top: 15px; list-style-type: '👉 '; color: #cbd5e1;">
            ${pointsA.map(p => `<li style="margin-bottom: 10px;">${p}</li>`).join('')}
        </ul>`;
      sumB.innerHTML = `<strong>🎯 Prečo si vybrať ${nameB}?</strong> 
        <ul style="padding-left: 20px; margin-top: 15px; list-style-type: '👉 '; color: #cbd5e1;">
            ${pointsB.map(p => `<li style="margin-bottom: 10px;">${p}</li>`).join('')}
        </ul>`;
      }
    }
  };

  openCompareBtn?.addEventListener("click", () => {
    compareOverlay.hidden = false;
    document.body.style.overflow = "hidden";
    
    // Side A is FIXED to current selection
    const currentModel = productNameHidden?.value;
    const currentCat = categorySelect?.value;
    
    if (currentModel && currentCat) {
        compareCats.a.value = currentCat;
      // Force Side A to be the stable one
      const models = DB_CATALOG[currentCat] || CATALOG[currentCat] || [];
      compareModels.a.innerHTML = `<option value="${currentModel}">${currentModel}</option>`;
        compareModels.a.value = currentModel;
        fetchCompareData('a');
      }
    
    // Reset Side B
    compareCats.b.value = "";
    compareModels.b.innerHTML = `<option value="" disabled selected>Vyberte model</option>`;
    compareModels.b.disabled = true;
    compareContents.b.innerHTML = `<div style="padding:40px; text-align:center; color:rgba(255,255,255,0.3)">Vyberte model na porovnanie</div>`;
    delete compareContents.b.dataset.loaded;
    qs("#compareSummarySection").hidden = true;
  });

  closeCompareBtn?.addEventListener("click", () => {
    compareOverlay.hidden = true;
    document.body.style.overflow = "";
  });

  compareCats.b?.addEventListener("change", () => updateCompareModels('b'));
  compareModels.b?.addEventListener("change", () => fetchCompareData('b'));

  compareOverlay?.addEventListener("click", (e) => {
    if (e.target === compareOverlay) {
      compareOverlay.hidden = true;
      document.body.style.overflow = "";
    }
  });

  // 📸 AI SCANNER LOGIC (UX MAGIC & DETERMINISM)
  const aiScannerOverlay = qs("#aiScannerOverlay");
  const aiPhotoInput = qs("#ai-photo-input");
  const btnPhoto = qs(".btnPhoto");
  const scannerImg = qs("#scannerImg");
  const scannerPlaceholder = qs("#scannerPlaceholder");
  const scannerLaser = qs("#scannerLaser");
  const scannerDots = qs("#scanningDots");
  const scannerTitle = qs("#scannerTitle");
  const scannerDesc = qs("#scannerDesc");
  const scannerActionBtn = qs("#scannerActionBtn");
  const scannerResult = qs("#scannerResult");
  const scannerFooter = qs("#scannerFooter");
  const scannerConfirmFooter = qs("#scannerConfirmFooter");
  const scannerClose = qs("#scannerClose");

  let scannerStep = 1; // 1: Back, 2: Front, 3: Processing/Result
  let scannedFiles = [];

  const initAIScanner = () => {
    if (!btnPhoto || !aiScannerOverlay) return;

    btnPhoto.addEventListener("click", (e) => {
      e.preventDefault();
      resetScanner();
      aiScannerOverlay.style.display = "flex";
    });

    // Close on X
    scannerClose?.addEventListener("click", () => {
      aiScannerOverlay.style.display = "none";
    });

    // Close on click outside
    aiScannerOverlay?.addEventListener("click", (e) => {
      if (e.target === aiScannerOverlay) {
        aiScannerOverlay.style.display = "none";
      }
    });

    scannerActionBtn.addEventListener("click", () => {
      aiPhotoInput.click();
    });

    aiPhotoInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      scannedFiles.push(file);
      
      // Update Preview
      const reader = new FileReader();
      reader.onload = (re) => {
        scannerImg.src = reader.result;
        scannerImg.style.display = "block";
        scannerPlaceholder.style.display = "none";
      };
      reader.readAsDataURL(file);

      if (scannerStep === 1) {
        // Step 1 Completed (Back side)
        scannerStep = 2;
        updateScannerUI();
      } else if (scannerStep === 2) {
        // Step 2 Completed (Front side)
        scannerStep = 3;
        await startAIAnalysis();
      }
    });

    qs("#scannerConfirmBtn")?.addEventListener("click", () => {
      applyAIResult();
      aiScannerOverlay.style.display = "none";
    });

    qs("#scannerManualBtn")?.addEventListener("click", () => {
      aiScannerOverlay.style.display = "none";
      showToast("Môžete pokračovať manuálnym výberom.", { type: "info" });
    });
  };

  const resetScanner = () => {
    scannerStep = 1;
    scannedFiles = [];
    scannerImg.style.display = "none";
    scannerPlaceholder.style.display = "block";
    scannerResult.style.display = "none";
    scannerFooter.style.display = "flex";
    scannerConfirmFooter.style.display = "none";
    scannerLaser.style.display = "none";
    scannerDots.innerHTML = "";
    updateScannerUI();
  };

  const updateScannerUI = () => {
    const dots = document.querySelectorAll(".progress-dot");
    dots.forEach((d, i) => d.classList.toggle("active", i + 1 === scannerStep));

    if (scannerStep === 1) {
      scannerTitle.textContent = "Skenovanie ZADNEJ strany";
      scannerDesc.textContent = "Umiestnite zariadenie tak, aby bolo vidieť celé telo a šošovky.";
      scannerActionBtn.textContent = "Odfotiť Zadnú Stranu";
      scannerImg.style.display = "none";
      scannerPlaceholder.style.display = "block";
    } else if (scannerStep === 2) {
      scannerTitle.textContent = "Skenovanie PREDNEJ strany";
      scannerDesc.textContent = "Otočte zariadenie displejom k sebe. Skontrolujte čistotu skla.";
      scannerActionBtn.textContent = "Odfotiť Prednú Stranu";
      // Keep previous image visible for a split second or just clear it
    } else if (scannerStep === 3) {
      scannerTitle.textContent = "AI Analýza v procese...";
      scannerDesc.textContent = "Porovnávame vizuálne body s databázou modelov 2026.";
      scannerFooter.style.display = "none";
    }
  };

  const resizeImage = (dataUrl, maxWidth = 1024, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
            width *= maxWidth / height;
            height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = dataUrl;
    });
  };

  const startAIAnalysis = async () => {
    updateScannerUI();
    scannerLaser.style.display = "block";
    
    // Add some random "scanning points"
    for (let i = 0; i < 12; i++) {
      const dot = document.createElement("div");
      dot.className = "scan-point";
      dot.style.top = Math.random() * 80 + 10 + "%";
      dot.style.left = Math.random() * 80 + 10 + "%";
      dot.style.animationDelay = i * 0.2 + "s";
      scannerDots.appendChild(dot);
    }

    try {
      // 1. Convert files to data URLs and RESIZE
      const images = await Promise.all(scannedFiles.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = async (re) => {
            const resized = await resizeImage(re.target.result, 1600, 0.9);
            resolve(resized);
          };
          reader.readAsDataURL(file);
        });
      }));

      console.log(`📤 Odosielam ${images.length} zmenšených fotiek na analýzu...`);

      // 🆕 2. CACHE CHECK (Using first image data as part of key)
      const cacheKey = `ai_scan_${images[0].substring(100, 200).replace(/[^a-z0-9]/g, '')}`;
      const cachedScan = localStorage.getItem(cacheKey);
      if (cachedScan) {
        console.log("💎 Using cached AI scan results.");
        const result = JSON.parse(cachedScan);
        applyScannerResultToUI(result);
        return;
      }

      // 3. Real API Call
      const resp = await fetch(`${API_BASE}/api/audit/identify-multi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images })
      });

      if (!resp.ok) throw new Error("AI API failed");
      
      const data = await resp.json();
      if (!data.ok) {
        const errorMsg = data.details || data.error || "Neznáma chyba AI";
        throw new Error(errorMsg);
      }
      
      const result = data.result;

      // 🛡️ CHECK IF MODEL IS SUPPORTED
      if (result.model === "NOT_IN_LIST") {
        showScannerError(
          "Zariadenie nie je v zozname",
          "Ľutujeme, vaše zariadenie buď nie je v našom zozname expertných auditov, alebo sa nám ho nepodarilo presne identifikovať. Skúste údaje zadať ručne."
        );
        return;
      }
      
      // Save to cache
      localStorage.setItem(cacheKey, JSON.stringify(result));

      applyScannerResultToUI(result);
    } catch (err) {
      console.error("❌ AI Analysis error:", err);
      scannerLaser.style.display = "none";
      scannerTitle.textContent = "Ups! Chyba analýzy";
      scannerDesc.textContent = "Nepodarilo sa nám spracovať fotky. Skúste to znova alebo zadajte údaje ručne.";
      scannerFooter.style.display = "flex";
      scannerActionBtn.textContent = "Skúsiť znova";
      scannerStep = 1; // Reset to start
      showToast("❌ AI analýza zlyhala. Skúste to manuálne.", { type: "error" });
      scannedFiles = []; // Clear files on error
    }
  };

  const applyScannerResultToUI = (result) => {
    // Show result
    scannerLaser.style.display = "none";
    scannerTitle.textContent = "AI odhad pripravený! 🎉";
    scannerDesc.textContent = "Tento odhad je založený na vizuálnej analýze fotografií.";
    
    qs("#aiModelName").textContent = result.model;
    qs("#aiConditionScore").textContent = result.condition + "%";
    qs("#aiCategory").textContent = result.category;
    
    // Display detected defects
    const defectsContainer = qs("#aiDefectsContainer");
    const defectsList = qs("#aiDefectsList");
    if (defectsContainer && defectsList) {
      if (Array.isArray(result.defects) && result.defects.length > 0) {
        scannerTitle.textContent = "Zariadenie rozpoznané! 🔍";
        scannerDesc.textContent = "Našli sme pár drobných nedostatkov, skontrolujte ich nižšie.";
        defectsList.innerHTML = result.defects.map(d => `<li style="margin-bottom:4px;">${d}</li>`).join("");
        defectsContainer.style.display = "block";
        window.lastAIDefects = result.defects; // Store for ad generation
      } else {
        scannerTitle.textContent = "Zariadenie rozpoznané! 🎉";
        scannerDesc.textContent = "Skontrolujte, či údaje súhlasia s vaším zariadením.";
        defectsContainer.style.display = "none";
        window.lastAIDefects = [];
      }
    }
    
    scannerResult.style.display = "block";
    scannerConfirmFooter.style.display = "flex";
  };

  const showScannerError = (title, desc) => {
    scannerLaser.style.display = "none";
    scannerTitle.textContent = title;
    scannerDesc.textContent = desc;
    scannerFooter.style.display = "flex";
    scannerActionBtn.textContent = "Skúsiť znova";
    scannerStep = 1;
    scannedFiles = [];
  };

  const applyAIResult = () => {
    const modelVal = qs("#aiModelName").textContent;
    const conditionVal = parseInt(qs("#aiConditionScore").textContent);
    const categoryVal = qs("#aiCategory").textContent;

    // Set Category first to trigger dependencies
    if (categorySelect) {
      categorySelect.value = categoryVal;
      categorySelect.dispatchEvent(new Event("change"));
    }

    // Set Model (Wait a bit for the dropdown to populate)
    setTimeout(() => {
      if (modelSelect) {
        console.log("🎯 AI setting model to:", modelVal);
        let found = false;
        // Try exact match first
        for (let opt of modelSelect.options) {
          if (opt.text.toLowerCase().trim() === modelVal.toLowerCase().trim()) {
            modelSelect.value = opt.value;
            found = true;
            break;
          }
        }
        // Try partial match if exact failed
        if (!found) {
          for (let opt of modelSelect.options) {
            if (opt.text.toLowerCase().includes(modelVal.toLowerCase()) || 
                modelVal.toLowerCase().includes(opt.text.toLowerCase())) {
              modelSelect.value = opt.value;
              found = true;
              break;
            }
          }
        }
        
        if (found) {
          modelSelect.dispatchEvent(new Event("change"));
        } else {
          console.warn("⚠️ AI model not found in dropdown:", modelVal);
        }
      }
    }, 200);

    // Set Condition
    const condInput = qs("[data-device-condition]");
    if (condInput) {
      condInput.value = conditionVal;
    }

    showToast(`✅ AI úspešne nastavila: ${modelVal}`, { type: "success" });
    if (aiScannerOverlay) {
      aiScannerOverlay.style.display = "none";
      document.body.style.overflow = "";
    }
  };

  // ==========================================================================
  // 🔐 SUPABASE AUTH & PROFILE LOGIC
  // ==========================================================================
  const authOverlay = qs("#authOverlay");
  const loginView = qs("#loginView");
  const registerView = qs("#registerView");
  const profileView = qs("#profileView");
  const pricingOverlay = qs("#pricingOverlay");
  const openPricingBtn = qs("#openPricingModal");
  const openPricingBtnMobile = qs("#openPricingModalMobile");
  const closePricingBtn = qs("#closePricingModalBtn");
  
  const authEmailInput = qs("#authEmail");
  const authPassInput = qs("#authPassword");
  const regEmailInput = qs("#regEmail");
  const regPassInput = qs("#regPassword");
  
  const btnSubmitLogin = qs("#btnSubmitLogin");
  const btnSubmitRegister = qs("#btnSubmitRegister");
  const btnSignOut = qs("#btnSignOut");
  
  const switchToRegister = qs("#switchToRegister");
  const switchToLogin = qs("#switchToLogin");
  const closeAuthModal = qs("#closeAuthModal");

  const openPricingModal = () => {
    if (pricingOverlay) {
      pricingOverlay.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
  };

  const closePricingModal = () => {
    if (pricingOverlay) {
      pricingOverlay.style.display = "none";
      document.body.style.overflow = "";
    }
  };

  // Re-attach Pricing Listeners
  openPricingBtn?.addEventListener("click", (e) => { e.preventDefault(); openPricingModal(); });
  openPricingBtnMobile?.addEventListener("click", (e) => { e.preventDefault(); openPricingModal(); });
  closePricingBtn?.addEventListener("click", () => { closePricingModal(); });
  pricingOverlay?.addEventListener("click", (e) => { if (e.target === pricingOverlay) closePricingModal(); });

  const openAuth = (mode = "login") => {
    if (!authOverlay) return;
    authOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    
    loginView.style.display = mode === "login" ? "block" : "none";
    registerView.style.display = mode === "register" ? "block" : "none";
    profileView.style.display = "none";
  };

  const openProfile = async () => {
    const userEmail = localStorage.getItem("auditly_user_email");
    if (!userEmail) return openAuth("login");

    authOverlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    loginView.style.display = "none";
    registerView.style.display = "none";
    profileView.style.display = "block";
    qs("#auditOptionsView").style.display = "none";
    
    qs("#userDisplayEmail").textContent = userEmail;
    loadUserAudits(userEmail);
  };

  window.openAuditOptions = (auditId, auditName) => {
    window._currentOptionAuditId = auditId;
    profileView.style.display = "none";
    qs("#auditOptionsView").style.display = "block";
    qs("#optionsAuditName").textContent = auditName;
  };

  qs("#backToHistory")?.addEventListener("click", () => {
    qs("#auditOptionsView").style.display = "none";
    profileView.style.display = "block";
  });

  const loadUserAudits = async (email) => {
    const listEl = qs("#historyList");
    const countEl = qs("#auditCount");
    if (!listEl) return;
    
    listEl.innerHTML = '<p style="text-align: center; color: #64748b; font-size: 13px; padding: 20px;">Načítavam vaše audity...</p>';

    try {
      const resp = await fetch(`${API_BASE}/api/audits-by-email?email=${encodeURIComponent(email)}`);
      if (!resp.ok) throw new Error(`Chyba servera: ${resp.status}`);
      
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Chyba pri načítaní dát.");

      if (countEl) countEl.textContent = data.audits.length;
      
      if (!data.audits || data.audits.length === 0) {
        listEl.innerHTML = '<p style="text-align: center; color: #64748b; font-size: 13px; padding: 20px;">Zatiaľ nemáte žiadne audity priradené k tomuto e-mailu.</p>';
      } else {
        listEl.innerHTML = data.audits.map(audit => {
          const rd = audit.report_data || {};
          const name = rd.productName || rd.model || (audit.products ? audit.products.name : 'Zariadenie');
          const battery = rd.battery ? `${rd.battery}%` : '---';
          const condition = rd.condition ? `${rd.condition}%` : '---';
          
          return `
            <div class="history-item" onclick="openAuditOptions('${audit.id}', '${name}')">
              <div style="text-align: left;">
                <div style="font-weight: 700; font-size: 14px; color: #fff;">${name}</div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
                  📅 ${new Date(audit.created_at).toLocaleDateString('sk-SK')} • 🔋 ${battery} • 💎 ${condition}
                </div>
              </div>
              <div style="font-weight: 800; color: #a78bfa;">${audit.final_price_recommendation || '---'} €</div>
            </div>
          `;
        }).join('');
      }
    } catch (err) {
      console.error("❌ loadUserAudits error:", err);
      listEl.innerHTML = `<p style="text-align: center; color: #ef4444; font-size: 12px; padding: 20px;">Chyba pri načítaní: ${err.message}</p>`;
    }
  };

  // Update Navigation Buttons based on Auth State
  const updateAuthUI = (email) => {
    document.querySelectorAll(".btnLogin").forEach(btn => {
      if (email) {
        btn.textContent = "Moje Audity";
        btn.dataset.authMode = "profile";
      } else {
        btn.textContent = "Moje Audity";
        btn.dataset.authMode = "login";
      }
    });
  };

  // Auth Event Listeners
  const initAuthEvents = () => {
    // Event delegation for login/profile buttons
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btnLogin");
      if (!btn) return;
      
      e.preventDefault();
      const mode = btn.dataset.authMode || "login";
      if (mode === "profile") {
        openProfile();
      } else {
        openAuth("login");
      }
    });

    switchToRegister?.addEventListener("click", (e) => { e.preventDefault(); openAuth("register"); });
    switchToLogin?.addEventListener("click", (e) => { e.preventDefault(); openAuth("login"); });
    closeAuthModal?.addEventListener("click", () => { authOverlay.style.display = "none"; document.body.style.overflow = ""; });

    btnSubmitLogin?.addEventListener("click", async () => {
      const email = authEmailInput?.value?.trim();
      if (!email || !email.includes("@")) return showToast("❌ Zadajte platný e-mail.", { type: "error" });

      btnSubmitLogin.disabled = true;
      btnSubmitLogin.textContent = "Hľadám audity...";
      
      try {
        localStorage.setItem("auditly_user_email", email);
        showToast("✅ E-mail overený!", { type: "success" });
        updateAuthUI(email);
        openProfile(); // This will now use the stored email
      } catch (error) {
        showToast(`❌ ${error.message}`, { type: "error" });
      } finally {
        btnSubmitLogin.disabled = false;
        btnSubmitLogin.textContent = "Zobraziť moje audity";
      }
    });

    btnSubmitRegister?.addEventListener("click", () => {
       // Register is now the same as login in this simplified flow
       btnSubmitLogin?.click();
    });

    btnSignOut?.addEventListener("click", async () => {
      localStorage.removeItem("auditly_user_email");
      updateAuthUI(null);
      authOverlay.style.display = "none";
      document.body.style.overflow = "";
      showToast("👋 Boli ste odhlásení.", { type: "info" });
    });
  };
  initAuthEvents();
  
  // Check for existing email session
  const savedEmail = localStorage.getItem("auditly_user_email");
  if (savedEmail) {
    updateAuthUI(savedEmail);
  }

  // Action Buttons (Save Audit)
  shareResultBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const auditId = expertOverlay?.dataset?.currentAuditId;
    if (!auditId) {
      showToast("❌ Najprv spustite analýzu rizík.", { type: "error" });
      return;
    }

    const userEmail = localStorage.getItem("auditly_user_email");
    if (userEmail) {
      // Already has email, we can show share links or re-save
      showToast("🔗 Audit je priradený k vášmu e-mailu.", { type: "success" });
      openProfile();
    } else {
      openAuth("login");
    }
  });

  async function saveAuditToAccount(user) {
    const productName = (qs("[data-product-name]")?.value || qs("[data-model-select]")?.options[qs("[data-model-select]")?.selectedIndex]?.text || "Zariadenie");
    const productId = expertOverlay?.dataset?.productId || 1;
    const currentPrice = qs("[data-seller-price]")?.value || qs("[data-expected-price]")?.value || 0;
    const recommendedPrice = expertOverlay?.dataset?.recommendedPrice || 0;
    
    // 🆕 Capture current analysis state for the saved report
    const mode = document.querySelector('input[name="auditMode"]:checked')?.value || "sell";
    const currentBattery = mode === "buy" ? qs("[data-battery-health]")?.value : qs("[data-battery-health-sell]")?.value;
    const currentCondition = qs("[data-device-condition]")?.value || "100";
    const currentStorage = storageSelect?.value || "";
    
    showToast("💾 Ukladám audit do vášho účtu...", { type: "info" });

    try {
      const resp = await fetch(`${API_BASE}/api/audits`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          report_data: { 
            productName, 
            sellerPrice: currentPrice, 
            recommendedPrice: recommendedPrice,
            battery: currentBattery || "100",
            condition: currentCondition,
            storage: currentStorage,
            mode: mode
          },
          user_id: user.id,
          user_email: user.email,
          risk_score: 95,
          final_price_recommendation: recommendedPrice
        })
      });

      const data = await resp.json();
      if (data.ok) {
        showToast("✅ Audit bol úspešne uložený!", { type: "success" });
        
        const productionDomain = "https://auditlyio.sk";
        const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const shareBase = isLocal ? productionDomain : window.location.origin;
        
        const shareUrl = `${shareBase}/?report=${data.id}`;
            await copyToClipboardFallback(shareUrl);
        } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showToast(`❌ Chyba pri ukladaní: ${err.message}`, { type: "error" });
    }
  }

  async function copyToClipboardFallback(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showToast("🔗 Odkaz skopírovaný!", { type: "info" });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast("🔗 Odkaz skopírovaný!", { type: "info" });
    }
  }

  // 📖 GUIDE MODAL LOGIC
  window.openGuide = (type) => {
    const overlay = qs("#guideOverlay");
    const sellerContent = qs("#sellerGuideContent");
    const buyerContent = qs("#buyerGuideContent");
    
    if (!overlay) return;
    
    overlay.hidden = false;
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    
    if (type === 'seller') {
      sellerContent.hidden = false;
      buyerContent.hidden = true;
    } else {
      sellerContent.hidden = true;
      buyerContent.hidden = false;
    }
  };

  window.closeGuide = () => {
    const overlay = qs("#guideOverlay");
    if (overlay) {
      overlay.hidden = true;
      overlay.style.display = "none";
      document.body.style.overflow = "";
    }
  };

  // Initial UI logic setup
  const initUrevents = () => {
    // Nav links scroll
    const howLinks = document.querySelectorAll('a[href="#how-it-works"]');
    howLinks.forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        qs("#how-it-works")?.scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Tour / Onboarding
    qs("#startTourBtn")?.addEventListener("click", (e) => {
      e.preventDefault();
      runOnboarding();
    });

    // Pricing
    const openPricingBtn = qs("#openPricingModal");
    const openPricingBtnMobile = qs("#openPricingModalMobile");
    const closePricingBtn = qs("#closePricingModalBtn");
    
    openPricingBtn?.addEventListener("click", (e) => { e.preventDefault(); openPricingModal(); });
    openPricingBtnMobile?.addEventListener("click", (e) => { e.preventDefault(); openPricingModal(); });
    closePricingBtn?.addEventListener("click", () => { closePricingModal(); });
    if (pricingOverlay) {
      pricingOverlay.addEventListener("click", (e) => { if (e.target === pricingOverlay) closePricingModal(); });
    }

    // 💳 TEST PAYMENT FLOW
    document.querySelectorAll(".btn-buy-test").forEach(btn => {
      btn.addEventListener("click", () => {
        closePricingModal();
        const confirmOverlay = qs("#paymentConfirmOverlay");
        if (confirmOverlay) confirmOverlay.style.display = "flex";
      });
    });

    // ⚖️ INPUT LIMITS ENFORCEMENT
    const enforceLimits = (selector, min, max, name) => {
      const el = qs(selector);
      if (!el) return;
      el.addEventListener("input", () => {
        let val = parseInt(el.value);
        if (val > max) el.value = max;
      });
      el.addEventListener("blur", () => {
        let val = parseInt(el.value);
        if (isNaN(val)) return;
        if (val < min) {
          el.value = min;
          showToast(`⚠️ Minimálna hodnota pre ${name} je ${min}%. Nižšie hodnoty sú považované za zariadenie na diely.`, { type: "info" });
        }
      });
    };

    enforceLimits("[data-battery-health]", 40, 100, "zdravie batérie");
    enforceLimits("[data-battery-health-sell]", 40, 100, "zdravie batérie");
    enforceLimits("[data-device-condition]", 40, 100, "vizuálny stav");

    qs("#btnConfirmFree")?.addEventListener("click", () => {
      const confirmOverlay = qs("#paymentConfirmOverlay");
      if (confirmOverlay) confirmOverlay.style.display = "none";
      
      const emailOverlay = qs("#emailCollectionOverlay");
      if (emailOverlay) {
        emailOverlay.style.display = "flex";
      } else {
        // Fallback if overlay not found
        completePaymentFlow();
      }
    });

    qs("#btnSubmitEmailAudit")?.addEventListener("click", () => {
      const email = qs("#collectEmailInput")?.value.trim();
      if (!email || !email.includes("@")) {
        showToast("❌ Prosím, zadajte platný e-mail.", { type: "error" });
        return;
      }
      localStorage.setItem("auditly_user_email", email);
      completePaymentFlow(email);
    });

    qs("#btnSkipEmailAudit")?.addEventListener("click", () => {
      completePaymentFlow();
    });

    const completePaymentFlow = (email = null) => {
      const emailOverlay = qs("#emailCollectionOverlay");
      if (emailOverlay) emailOverlay.style.display = "none";

      isTestPaid = true;
      localStorage.setItem(STORAGE_KEY_TEST_PAID, "true");
      showToast("✅ Platba prijatá (Test Mode)", { type: "success" });

      // Resume pending report if any
      if (window._pendingReport) {
        const { forcedId, options } = window._pendingReport;
        window._pendingReport = null;
        handleOpenExpertReport(forcedId, options);
      }

      // Resume pending main analysis if any
      if (window._pendingAnalysis) {
        window._pendingAnalysis = false;
        generateBtn?.click(); // Re-trigger the click
      }
    };
  };

  const renderOfflineReport = (savedData) => {
    const { report, createdAt } = savedData;
    expertOverlay.hidden = false;
    expertContent.hidden = false;
    expertLoader.hidden = true;
    
    // Fill the UI with saved data
    qs("#expertReportName").textContent = report.name;
    qs("#expertRecommendedPrice").textContent = `${Number(report.base_price_recommended || 0).toFixed(0)} €`;
    
    // Build Specs HTML
    const rd = savedData.report_data || {};
    const mode = rd.mode || "buy";
    const batteryVal = rd.battery || "100";
    const conditionPct = rd.condition || "100";

    qs("#expertReportSpecs").innerHTML = `
      <div class="expert-spec-item"><span class="expert-spec-label">Displej</span><span class="expert-spec-value">${report.display_tech || 'N/A'}</span></div>
      <div class="expert-spec-item"><span class="expert-spec-label">Materiál</span><span class="expert-spec-value">${report.frame_material || 'N/A'}</span></div>
      <div class="expert-spec-item"><span class="expert-spec-label">Kategória</span><span class="expert-spec-value">${report.category}</span></div>
      <div class="expert-spec-item"><span class="expert-spec-label">Stav batérie</span><span class="expert-spec-value">${batteryVal}%</span></div>
      <div class="expert-spec-item"><span class="expert-spec-label">Vizuálny stav</span><span class="expert-spec-value">${conditionPct}%</span></div>
    `;

    // Build Risks
    const risks = (typeof report.common_faults === 'string' ? JSON.parse(report.common_faults) : report.common_faults) || [];
    qs("#expertReportRisks").innerHTML = risks.map(f => `
      <div class="expert-risk-item">
        <span class="expert-risk-icon">⚠️</span>
        <span style="font-weight: 700;">${f}</span>
      </div>
    `).join('');

    // Strategy
    const strategyText = report.negotiation_tips || "";
    qs("#expertReportCalculator").innerHTML = strategyText.split('\n')
      .filter(l => l.trim().length > 3)
      .map(line => `
        <div class="expert-check-item">
          <span class="expert-check-icon">✔️</span>
          <span style="font-weight: 700;">${line.trim()}</span>
        </div>
      `).join('');

    qs("#expertReportFullText").innerHTML = (report.full_report || "")
      .split('\n')
      .filter(p => p.trim() !== '')
      .map(p => `<p style="margin-bottom: 20px; line-height: 1.8; color: rgba(255,255,255,0.8); font-size: 15px;">${p.trim()}</p>`)
      .join('');

    const shareLinkPrivate = qs("#expertShareLinkPrivate");
  const shareLinkPublic = qs("#expertShareLinkPublic");
    if (shareLinkPrivate) shareLinkPrivate.style.display = "none"; 
    if (shareLinkPublic) shareLinkPublic.style.display = "none"; // Share doesn't work offline anyway
  };

  // 📡 OFFLINE SUPPORT (IndexedDB / localStorage fallback)
  const syncOfflineStatus = () => {
    const isOnline = navigator.onLine;
    const indicator = document.getElementById("offlineIndicator");
    
    if (!isOnline) {
      if (!indicator) {
        const div = document.createElement("div");
        div.id = "offlineIndicator";
        div.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#ef4444; color:white; padding:8px 20px; border-radius:30px; font-weight:800; font-size:12px; z-index:10000; box-shadow:0 10px 25px rgba(239, 68, 68, 0.3); border:2px solid rgba(255,255,255,0.2); display:flex; align-items:center; gap:8px;";
        div.innerHTML = `<span>⚠️</span> STE OFFLINE (Používate uložené dáta)`;
        document.body.appendChild(div);
      }
    } else {
      if (indicator) indicator.remove();
    }
  };

  window.addEventListener('online', syncOfflineStatus);
  window.addEventListener('offline', syncOfflineStatus);
  syncOfflineStatus();

  // Save current audit to offline storage whenever it's rendered
  const saveAuditOffline = (auditData) => {
    try {
      localStorage.setItem("auditly_last_report", JSON.stringify({
        data: auditData,
        timestamp: new Date().getTime()
      }));
      console.log("💾 Report uložený pre offline prístup.");
    } catch (e) {
      console.warn("Nepodarilo sa uložiť report pre offline.", e);
    }
  };

  // Check for offline report on startup if network fails
  const checkOfflineReport = () => {
    if (!navigator.onLine) {
      const saved = localStorage.getItem("auditly_last_report");
      if (saved) {
        showToast("ℹ️ Načítavam posledný uložený report (režim offline).", { type: "info" });
        // We could automatically show it here if needed
      }
    }
  };
  checkOfflineReport();

  const runInit = async () => {
    initUrevents();
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser();
      updateAuthUI(user);
    }
    
    // 🔐 INITIAL LOCK STATE: Save values for revert logic
    savePrevValue(categorySelect);
    savePrevValue(modelSelect);
    savePrevValue(storageSelect);

    console.log("💳 Platobný stav (Test Mode):", isTestPaid ? "ZAPLATENÉ" : "NEZAPLATENÉ");

    // 🛡️ ENSURE OVERLAY IS VISIBLE
    const overlay = qs("[data-report-overlay]");
    if (overlay && !isTestPaid) {
      overlay.classList.remove("is-hidden");
      const icon = qs(".reportOverlay__icon", overlay);
      const text = qs(".reportOverlay__text", overlay);
      const loader = qs(".reportOverlay__loader", overlay);
      if (icon) icon.hidden = false;
      if (text) {
        text.hidden = false;
        text.textContent = "Čakám na spustenie analýzy...";
      }
      if (loader) loader.hidden = true;
    }
  };
  runInit();

  initAIScanner();
  loadAppState();

  // 🛡️ ACCIDENTAL RELOAD PROTECTION
  window.addEventListener("beforeunload", (e) => {
    if (isTestPaid) {
      // Standard browser way to prevent accidental loss of paid report
      e.preventDefault();
      // For most modern browsers, the message is ignored, but some still use it
      e.returnValue = "Máte rozpracovaný zaplatený report. Ak stránku opustíte, prídete oň.";
      return e.returnValue;
    }
  });
});


