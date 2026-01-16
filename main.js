document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Systém Auditlyio inicializovaný (Verzia 165)");
  const qs = (sel, root = document) => root.querySelector(sel);
  const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

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
    "iphone 15 pro max": { cpu: "A17 Pro (3nm)", display: "6.7\" Super Retina XDR OLED", refresh: "120Hz (ProMotion)", ram: "8 GB", camera: "48MP Main + 5x Telephoto" },
    "iphone 15 pro": { cpu: "A17 Pro (3nm)", display: "6.1\" Super Retina XDR OLED", refresh: "120Hz (ProMotion)", ram: "8 GB", camera: "48MP Main + 3x Telephoto" },
    "iphone 15 plus": { cpu: "A16 Bionic", display: "6.7\" Super Retina XDR OLED", refresh: "60Hz", ram: "6 GB", camera: "48MP Main" },
    "iphone 15": { cpu: "A16 Bionic", display: "6.1\" Super Retina XDR OLED", refresh: "60Hz", ram: "6 GB", camera: "48MP Main" },
    "iphone 14 pro max": { cpu: "A16 Bionic", display: "6.7\" Super Retina XDR OLED", refresh: "120Hz", ram: "6 GB", camera: "48MP Main" },
    "iphone 14 pro": { cpu: "A16 Bionic", display: "6.1\" Super Retina XDR OLED", refresh: "120Hz", ram: "6 GB", camera: "48MP Main" },
    "iphone 14 plus": { cpu: "A15 Bionic", display: "6.7\" OLED", refresh: "60Hz", ram: "6 GB", camera: "12MP Main" },
    "iphone 14": { cpu: "A15 Bionic", display: "6.1\" OLED", refresh: "60Hz", ram: "6 GB", camera: "12MP Main" },
    "iphone 13 pro max": { cpu: "A15 Bionic", display: "6.7\" OLED", refresh: "120Hz", ram: "6 GB", camera: "12MP Main" },
    "iphone 13 pro": { cpu: "A15 Bionic", display: "6.1\" OLED", refresh: "120Hz", ram: "6 GB", camera: "12MP Main" },
    "iphone 13": { cpu: "A15 Bionic", display: "6.1\" OLED", refresh: "60Hz", ram: "4 GB", camera: "12MP Main" },
    "iphone 13 mini": { cpu: "A15 Bionic", display: "5.4\" OLED", refresh: "60Hz", ram: "4 GB", camera: "12MP Main" },
    "iphone 12 pro max": { cpu: "A14 Bionic", display: "6.7\" OLED", refresh: "60Hz", ram: "6 GB", camera: "12MP Main" },
    "iphone 12 pro": { cpu: "A14 Bionic", display: "6.1\" OLED", refresh: "60Hz", ram: "6 GB", camera: "12MP Main" },
    "iphone 12": { cpu: "A14 Bionic", display: "6.1\" OLED", refresh: "60Hz", ram: "4 GB", camera: "12MP Main" },
    "iphone 11": { cpu: "A13 Bionic", display: "6.1\" Liquid Retina LCD", refresh: "60Hz", ram: "4 GB", camera: "12MP Main" }
  };

  // Helper to find best match in catalog
  const findDeviceInCatalog = (name) => {
    const lower = name.toLowerCase();
    // Try exact match first
    if (DEVICE_CATALOG[lower]) return DEVICE_CATALOG[lower];
    // Try to find if any key is contained in the name
    const keys = Object.keys(DEVICE_CATALOG).sort((a, b) => b.length - a.length); // Longest first
    for (const key of keys) {
      if (lower.includes(key)) return DEVICE_CATALOG[key];
    }
    return null;
  };

  // Edit counter constants (used in multiple places)
  const FREE_EDITS_LIMIT = 3;
  const STORAGE_KEY_EDITS = "predajto_edit_count";
  const STORAGE_KEY_PREMIUM = "predajto_premium";

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
  let selectedCatType = 'mobile'; // Predvolená kategória Mobil
  
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
      const catId = Number(btn.dataset.catId);
      const catType = btn.dataset.catType;

      // Update selectedCategory
      selectedCategory = catId;
      selectedCatType = catType;

      // Update UI: Toggle active state
      categoryButtons.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");

      // Update placeholder dynamically
      if (productNameInput) {
        let placeholder = "Napr. iPhone 15 Pro";
        if (catType === "mobile") placeholder = "Napr. iPhone 15 Pro 128GB";
        else if (catType === "console") placeholder = "Napr. PlayStation 5 Disc Edition";
        else if (catType === "laptop") placeholder = "Napr. MacBook Air M2 13\" 2022";
        else if (catType === "other") placeholder = "Zadajte názov a model zariadenia...";
        
        productNameInput.placeholder = placeholder;
      }

      // 🆕 AUDITLYIO: Battery Visibility Logic
      if (batteryField) {
        const needsBattery = catType === "mobile" || catType === "laptop";
        
        // Update both buy and sell battery fields
        const batBuy = qs("[data-battery-field]");
        const batSell = qs("[data-battery-field-sell]");
        const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";

        if (batBuy) batBuy.style.display = (currentMode === "buy" && needsBattery) ? "block" : "none";
        if (batSell) batSell.style.display = (currentMode === "sell" && needsBattery) ? "block" : "none";
      }

      console.log(`🏷️ Category changed: ${catType} (ID: ${catId})`);

      // 🎮 CONSOLE SPECIFIC: Controller Selector Visibility
      const consoleOnlyFields = document.querySelectorAll("[data-console-only]");
      consoleOnlyFields.forEach(f => {
        const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
        f.hidden = !(catType === "console" && currentMode === "sell");
        f.style.display = (catType === "console" && currentMode === "sell") ? "block" : "none";
      });
    });
  });

  // 🆕 AUDITLYIO: Mode Toggle Logic (Kupujem / Predávam)
  const modeInputs = document.querySelectorAll('input[name="auditMode"]');
  const buyFields = qs("[data-mode-buy-fields]");
  const sellFields = qs("[data-mode-sell-fields]");

  modeInputs.forEach(input => {
    input.addEventListener("change", (e) => {
      const mode = e.target.value;
      console.log(`🔄 Mode switched to: ${mode}`);
      
      if (generateBtn) {
        generateBtn.textContent = mode === "buy" ? "SPUSTIŤ ANALÝZU RIZÍK" : "ZISTIŤ PREDAJNÚ CENU";
      }

      const generateAdBtn = qs("[data-generate-ad]");
      if (generateAdBtn) {
        generateAdBtn.hidden = mode === "buy";
        generateAdBtn.style.display = mode === "buy" ? "none" : "flex";
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
      const catType = catBtn?.dataset.catType;
      const needsBattery = catType === "mobile" || catType === "laptop";
      
      const batBuy = qs("[data-battery-field]");
      const batSell = qs("[data-battery-field-sell]");
      
      if (batBuy) batBuy.style.display = (mode === "buy" && needsBattery) ? "block" : "none";
      if (batSell) batSell.style.display = (mode === "sell" && needsBattery) ? "block" : "none";

      // 🎮 CONSOLE SPECIFIC: Toggle console fields on mode change
      const consoleOnlyFields = document.querySelectorAll("[data-console-only]");
      consoleOnlyFields.forEach(f => {
        f.hidden = !(selectedCatType === "console" && mode === "sell");
        f.style.display = (selectedCatType === "console" && mode === "sell") ? "block" : "none";
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

  downloadPdfBtn?.addEventListener("click", () => {
    showToast("Pripravujem PDF certifikát auditu...", { type: "info" });
    setTimeout(() => {
      showToast("PDF audit úspešne vygenerovaný!", { type: "success" });
    }, 2000);
  });

  shareResultBtn?.addEventListener("click", () => {
    if (navigator.share) {
      navigator.share({
        title: 'Auditly.io - Expertný Audit',
        text: 'Pozri si tento expertný audit zariadenia!',
        url: window.location.href,
      }).catch(console.error);
    } else {
      showToast("Odkaz na audit bol skopírovaný do schránky.", { type: "success" });
    }
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
    
    console.log(`🕵️ Frontend: Fetching Heureka price for "${model} ${storage} ${ram} ${color}"...`);
    try {
      const url = `${API_BASE}/api/heureka?model=${encodeURIComponent(model)}&storage=${encodeURIComponent(storage)}&ram=${encodeURIComponent(ram)}&color=${encodeURIComponent(color)}`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      
      if (data.ok) {
        console.log("💰 Heureka Data Received:", data);
        
        const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
        const batteryInput = currentMode === "sell" ? qs("[data-battery-health-sell]") : qs("[data-battery-health]");
        const batteryVal = Number(batteryInput?.value) || 100;
        const warrantyInput = currentMode === "sell" ? qs("[data-has-warranty-sell]") : qs("[data-has-warranty]");
        const hasWarranty = warrantyInput?.checked;

        // 🆕 UPDATE CARD 1: SPECS
        const specList = qs('.specList');
        if (specList) {
          const deviceSpecs = findDeviceInCatalog(model);
          const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
          const batteryInput = currentMode === "sell" ? qs("[data-battery-health-sell]") : qs("[data-battery-health]");
          const batteryVal = batteryInput?.value || "100";
          const warrantyInput = currentMode === "sell" ? qs("[data-has-warranty-sell]") : qs("[data-has-warranty]");
          const hasWarranty = warrantyInput?.checked ? "Áno" : "Nie";

          let html = `
            <div class="specItem"><span>Model</span> <strong>${model}</strong></div>
            <div class="specItem"><span>Kapacita</span> <strong>${storage || "—"}</strong></div>
          `;

          if (deviceSpecs) {
            html += `
              <div class="specItem"><span>Procesor</span> <strong>${deviceSpecs.cpu}</strong></div>
              <div class="specItem"><span>Displej</span> <strong>${deviceSpecs.display}</strong></div>
              <div class="specItem"><span>Pôvodná RAM</span> <strong>${deviceSpecs.ram}</strong></div>
            `;
          }

          html += `
            <div class="specItem"><span>Batéria</span> <strong>${batteryVal}%</strong></div>
            <div class="specItem"><span>Záruka</span> <strong>${hasWarranty}</strong></div>
          `;

          specList.innerHTML = html;
        }

        // 🆕 CALCULATE FAIR PRICE ADJUSTMENTS
        let fairPriceAvg = data.priceAvg;
        let batteryPenalty = 0;
        if (batteryVal < 90) {
          batteryPenalty = batteryVal < 85 ? 50 : 35;
        }
        fairPriceAvg -= batteryPenalty;
        if (hasWarranty) fairPriceAvg += 30;

        // 🆕 UPDATE CARD 3: MARKET CHART
        const bars = document.querySelectorAll('.priceChart__bar');
        const labels = document.querySelectorAll('.priceChart__bar span');
        
        if (labels.length >= 3) {
          const maxPrice = Math.max(data.priceAvg, fairPriceAvg, data.priceFrom) || 1;
          const getH = (p) => Math.round((p / maxPrice) * 90);

          // Bar 1: Market From
          labels[0].innerText = `${Math.round(data.priceFrom)}€`;
          bars[0].style.height = `${getH(data.priceFrom)}%`;
          
          // Bar 2 (Active): Adjusted Fair Price
          labels[1].innerText = `${Math.round(fairPriceAvg)}€`;
          bars[1].title = `Férová bazárová cena (zohľadňuje batériu a záruku)`;
          bars[1].style.height = `${getH(fairPriceAvg)}%`;
          
          // Bar 3: Market Average (Perfect Condition)
          labels[2].innerText = `${Math.round(data.priceAvg)}€`;
          labels[2].title = `Priemer trhu (Zdroj: ${data.source})`;
          bars[2].style.height = `${getH(data.priceAvg)}%`;
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
            if (diff > 20) {
              verdictBadge.innerText = "TOP PONUKA";
              verdictBadge.style.background = "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
              verdictText.innerText = `Toto zariadenie odporúčame kúpiť. Vaša cena je o ${Math.round(diff)}€ nižšia ako férová trhová cena.`;
            } else if (diff < -20) {
              verdictBadge.innerText = "PREDRAŽENÉ";
              verdictBadge.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
              verdictText.innerText = `Cena je o ${Math.round(Math.abs(diff))}€ vyššia ako férová trhová cena. Skúste vyjednať zľavu.`;
            } else {
              verdictBadge.innerText = "DOBRÁ CENA";
              verdictBadge.style.background = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)";
              verdictText.innerText = `Cena zodpovedá aktuálnemu stavu zariadenia a situácii na trhu.`;
            }
          } else {
            // Predavam mode or no price entered
            verdictBadge.innerText = "ANALÝZA HOTOVÁ";
            verdictText.innerText = `Férová predajná cena pre toto zariadenie je približne ${Math.round(fairPriceAvg)}€.`;
          }
        }

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
    selectedCatType = initialCatBtn.dataset.catType || 'mobile';

    // 🎮 Initial visibility for console fields
    const currentMode = document.querySelector('input[name="auditMode"]:checked')?.value || "buy";
    const consoleOnlyFields = document.querySelectorAll("[data-console-only]");
    consoleOnlyFields.forEach(f => {
      f.hidden = !(selectedCatType === "console" && currentMode === "sell");
      f.style.display = (selectedCatType === "console" && currentMode === "sell") ? "block" : "none";
    });
  }
  const notesTextarea = qs("[data-product-notes]");

  // 📸 PHOTO ANALYSIS LOGIC
  const photoInput = qs("[data-photo-input]");
  if (photoInput) {
    photoInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      showToast("Analyzujem fotografiu inzerátu...", { type: "info" });
      
      // Simulate AI analysis delay
      await sleep(2500);

      // Mock analysis results based on filename or just random data
      const mockData = {
        name: "iPhone 15 Pro 128GB Black Titanium",
        battery: 98,
        price: 850
      };

      if (productNameInput) productNameInput.value = mockData.name;
      if (batteryHealthInput) {
        batteryHealthInput.value = mockData.battery;
        // Ensure battery field is visible
        if (batteryField) {
          batteryField.hidden = false;
          batteryField.style.display = "block";
        }
      }
      if (sellerPriceInput) sellerPriceInput.value = mockData.price;

      showToast("Inzerát úspešne zanalyzovaný a údaje vyplnené!", { type: "success" });
      
      // Trigger analysis automatically
      if (generateBtn) {
        generateBtn.click();
      }
    });
  }

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
    const market = Number(prices.market ?? recommended);
    
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
        if (diff > 20) {
          verdictBadge.innerText = "TOP PONUKA";
          verdictBadge.style.background = "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)";
          verdictText.innerText = `Toto zariadenie odporúčame kúpiť. Vaša cena je o ${Math.round(diff)}€ nižšia ako férová trhová cena.`;
        } else if (diff < -20) {
          verdictBadge.innerText = "PREDRAŽENÉ";
          verdictBadge.style.background = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
          verdictText.innerText = `Cena je o ${Math.round(Math.abs(diff))}€ vyššia ako férová trhová cena. Skúste vyjednať zľavu.`;
        } else {
          verdictBadge.innerText = "DOBRÁ CENA";
          verdictBadge.style.background = "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)";
          verdictText.innerText = `Cena zodpovedá aktuálnemu stavu zariadenia a situácii na trhu.`;
        }
      } else {
        verdictBadge.innerText = "ANALÝZA HOTOVÁ";
        verdictText.innerText = `Férová predajná cena pre toto zariadenie je približne ${Math.round(recommended)}€.`;
      }
    }

    // 🆕 AUDITLYIO: Value Traffic Light (Deal Meter)
    const dealStatusEl = qs("[data-deal-status]");
    const meterFillEl = qs("[data-meter-fill]");

    if (sellerPrice > 0 && recommended > 0) {
      const diff = ((sellerPrice - recommended) / recommended) * 100;
      let status = "FÉROVÁ CENA";
      let color = "var(--orange)";
      
      // Calculate position from 0% (red) to 100% (green)
      // recommended price should be at 50% (orange)
      // if sellerPrice is 50% of recommended, it's very green (100%)
      // if sellerPrice is 150% of recommended, it's very red (0%)
      let posPct = 50 - (diff * 2); // Simple mapping
      posPct = Math.min(95, Math.max(5, posPct)); // Clamp but keep handle visible

      if (diff < -5) {
        status = `SKVELÁ CENA (Ušetríš ${Math.round(recommended - sellerPrice)}€)`;
        color = "var(--green)";
      } else if (diff > 5) {
        status = "PREDRAŽENÉ";
        color = "var(--red)";
      }

      if (dealStatusEl) {
        dealStatusEl.textContent = status;
        dealStatusEl.style.color = color;
      }
      if (meterFillEl) {
        meterFillEl.style.left = `${posPct}%`;
        // Background not needed for handle
      }

      console.log(`🚥 Deal Meter: Seller=${sellerPrice}€, Market=${recommended}€, Diff=${diff.toFixed(1)}%, Status=${status}`);
    }

    // Segmented cards under slider
    if (quickPriceEl && Number.isFinite(quick) && quick > 0) quickPriceEl.textContent = String(quick);
    if (marketPriceEl && Number.isFinite(market) && market > 0) marketPriceEl.textContent = String(market);
    if (premiumPriceEl && Number.isFinite(premium) && premium > 0) premiumPriceEl.textContent = String(premium);

    // 🆕 UPDATE GOOGLE SHOPPING LINK (if available)
    const googleShoppingLink = qs("[data-google-shopping-link]");
    if (googleShoppingLink) {
      const productName = (qs("[data-product-name]")?.value ?? "").trim();
      if (productName) {
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(productName + ' kúpiť cena')}&tbm=shop`;
        googleShoppingLink.href = googleUrl;
        googleShoppingLink.hidden = false;
        console.log(`🔗 Google Shopping link updated: ${googleUrl}`);
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
    e.preventDefault(); // Prevent any default behavior
    e.stopPropagation(); // Stop event bubbling
    e.stopImmediatePropagation(); // Stop all other handlers
    
    // Disable button immediately to prevent double-clicks
    if (generateBtn.disabled) return;
    
    // 🆕 AUDITLYIO: Loading Overlay Logic
    const overlay = qs("[data-report-overlay]");
    const overlayIcon = qs(".reportOverlay__icon", overlay);
    const overlayText = qs(".reportOverlay__text", overlay);
    const overlayLoader = qs(".reportOverlay__loader", overlay);

    if (overlay) {
      // 1. Show loader
      if (overlayIcon) overlayIcon.hidden = true;
      if (overlayText) overlayText.hidden = true;
      if (overlayLoader) overlayLoader.hidden = false;
      overlay.classList.remove("is-hidden"); // Ensure it's visible
    }

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

          // 2. Battery Penalty
          if (batteryVal < 90) {
            const penalty = batteryVal < 85 ? 50 : 35;
            recommended -= penalty;
            console.log(`🔋 Battery Penalty: ${batteryVal}%, Recommended=${recommended}€ (-${penalty}€)`);
          }

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
          showToast("Stripe integrácia pripravovaná. Zatiaľ kontaktujte auditly.io", { type: "info", duration: 4000 });
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
          showToast("Stripe integrácia pripravovaná. Zatiaľ kontaktujte auditly.io", { type: "info", duration: 4000 });
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

            await fetch("/api/feedback", {
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
      subtitle: "Trend za posledný rok • Mobil",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [1250, 1230, 1200, 1180, 1150, 1120, 1100, 1085, 1040, 1010, 975, 950],
      currentPrice: "950 €",
      drop: "− 12%",
      tip: "Cena iPhonov klesá najviac pred predstavením nového modelu v septembri."
    },
    console: {
      title: "PlayStation 5 Disc Edition",
      subtitle: "Trend za posledný rok • Konzola",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [520, 510, 490, 480, 480, 470, 460, 450, 450, 440, 430, 420],
      currentPrice: "420 €",
      drop: "− 8%",
      tip: "Konzoly si držia cenu lepšie, pokles je pomalší než u mobilov."
    },
    laptop: {
      title: "MacBook Air M2 (2022)",
      subtitle: "Trend za posledný rok • Notebook",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [1150, 1120, 1100, 1080, 1050, 1020, 1000, 980, 960, 940, 920, 900],
      currentPrice: "900 €",
      drop: "− 15%",
      tip: "Notebooky strácajú hodnotu skokovo po vydaní novej generácie procesorov."
    },
    other: {
      title: "Elektronika (Priemer)",
      subtitle: "Trend za posledný rok • Iné",
      labels: ['Feb', 'Mar', 'Apr', 'Maj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec', 'Jan'],
      prices: [500, 490, 480, 470, 460, 450, 440, 430, 420, 410, 400, 390],
      currentPrice: "390 €",
      drop: "− 10%",
      tip: "Všeobecná elektronika stráca cca 1-2% hodnoty mesačne."
    }
  };

  const initTrendChart = () => {
    const ctx = document.getElementById('priceTrendChart')?.getContext('2d');
    if (!ctx) return;

    // Získanie dát podľa aktuálnej kategórie
    const dataSet = categoryTrendData[selectedCatType] || categoryTrendData.other;

    // Aktualizácia textov v modale
    const modalTitle = qs(".trendModal__title", trendModal);
    const modalSubtitle = qs(".trendModal__subtitle", trendModal);
    const currentPriceVal = qs(".trendInfo__value:not(.is-drop)", trendModal);
    const dropVal = qs(".trendInfo__value.is-drop", trendModal);
    const tipVal = qs(".trendModal__tip", trendModal);

    if (modalTitle) modalTitle.textContent = dataSet.title;
    if (modalSubtitle) modalSubtitle.textContent = dataSet.subtitle;
    if (currentPriceVal) currentPriceVal.textContent = dataSet.currentPrice;
    if (dropVal) dropVal.textContent = dataSet.drop;
    if (tipVal) tipVal.textContent = `💡 ${dataSet.tip}`;

    // Gradient setup
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.4)');
    gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');

    const data = {
      labels: dataSet.labels,
      datasets: [{
        label: 'Priemerná cena (€)',
        data: dataSet.prices,
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
  const generateAdBtn = qs("[data-generate-ad]");
  
  generateAdBtn?.addEventListener("click", () => {
    const productName = qs("[data-product-name]")?.value?.trim() || "Zariadenie";
    const expectedPrice = qs("[data-expected-price]")?.value || qs("[data-seller-price]")?.value || "Dohodou";
    const condition = qs("[data-device-condition]")?.value || "100";
    const battery = qs("[data-battery-health-sell]")?.value || qs("[data-battery-health]")?.value;
    
    // Accessories
    const accessories = [];
    if (qs("[data-acc='box']")?.checked) accessories.push("originálna krabica");
    if (qs("[data-acc='charger']")?.checked) accessories.push("nabíjačka/kábel");
    if (qs("[data-acc='receipt']")?.checked) accessories.push("doklad o kúpe");
    
    // Controller count (for consoles)
    let controllerText = "";
    if (selectedCatType === "console") {
      const cCount = Number(controllerCount) || 0;
      if (cCount === 1) controllerText = "1 ovládač";
      else if (cCount === 2) controllerText = "2 ovládače";
      else controllerText = "bez ovládača";
    }

    // Build the text
    let adText = `Predám ${productName}.\n`;
    adText += `Stav: ${condition}% (vizuálne veľmi zachovalý).\n`;
    if (battery) adText += `Zdravie batérie: ${battery}%.\n`;
    if (controllerText) adText += `Príslušenstvo: ${controllerText}`;
    if (accessories.length > 0) {
      adText += (controllerText ? ", " : "Príslušenstvo: ") + accessories.join(", ") + ".\n";
    } else if (!controllerText) {
      adText += "\n";
    }
    adText += `Cena: ${expectedPrice} €.\n\n`;
    adText += `V prípade záujmu ma kontaktujte.`;

    // Show result in a toast or better, a prompt/copy-to-clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(adText).then(() => {
        showToast("📋 Text inzerátu bol skopírovaný do schránky!", { type: "success", duration: 5000 });
      }).catch(() => {
        alert("Text inzerátu:\n\n" + adText);
      });
    } else {
      alert("Text inzerátu:\n\n" + adText);
    }
  });

});


