import * as fs from "node:fs/promises";
import path from "node:path";

export function normalizeQuery(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function safeUrl(u) {
  try {
    const url = new URL(String(u || ""));
    if (!/^https?:$/.test(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
}

export function parsePrice(raw) {
  const s = String(raw || "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function parseCondition(raw, fallback = 90) {
  const n = Number(String(raw || "").replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(50, Math.min(100, Math.round(n)));
}

export function guessSourceFromUrl(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("bazos.")) return "bazos";
  if (u.includes("facebook.com/marketplace")) return "marketplace";
  if (u.includes("heureka.")) return "heureka";
  return "unknown";
}

export function buildSearchUrls(query) {
  const q = encodeURIComponent(query);
  return {
    bazos: `https://www.bazos.sk/search.php?hledat=${q}&rubriky=www&hlokalita=&humkreis=25&cenaod=&cenado=&Submit=H%C4%BEada%C5%A5&kitx=ano`,
    marketplace: `https://www.facebook.com/marketplace/search/?query=${q}`,
    heureka: `https://www.heureka.sk/?h%5Bfraze%5D=${q}`,
  };
}

export class MarketStore {
  constructor({ baseDir }) {
    this.baseDir = baseDir;
    this.file = path.join(baseDir, "market-data.json");
  }

  async _load() {
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return { queries: {}, updatedAt: Date.now() };
      if (!data.queries) data.queries = {};
      return data;
    } catch {
      return { queries: {}, updatedAt: Date.now() };
    }
  }

  async _save(data) {
    await fs.mkdir(this.baseDir, { recursive: true });
    const payload = { ...data, updatedAt: Date.now() };
    await fs.writeFile(this.file, JSON.stringify(payload, null, 2), "utf8");
  }

  async ingest({ query, ads }) {
    const q = normalizeQuery(query);
    if (!q) return { ok: false, error: "Missing query" };
    const arr = Array.isArray(ads) ? ads : [];
    const clean = [];
    for (const a of arr) {
      const url = safeUrl(a?.url);
      const title = String(a?.title || "").trim();
      const price = parsePrice(a?.price);
      const condition = parseCondition(a?.condition, 90);
      const source = (a?.source && String(a.source)) || guessSourceFromUrl(url);
      if (!url || !title || !(price > 0)) continue;
      if (source !== "bazos" && source !== "marketplace" && source !== "heureka") continue;
      clean.push({ url, title, price, condition, source, ts: Date.now() });
    }
    if (!clean.length) return { ok: false, error: "No valid ads" };

    const db = await this._load();
    const prev = Array.isArray(db.queries[q]?.ads) ? db.queries[q].ads : [];

    const byUrl = new Map(prev.map((x) => [x.url, x]));
    for (const a of clean) byUrl.set(a.url, a);

    const next = Array.from(byUrl.values()).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 200);
    db.queries[q] = { ads: next, updatedAt: Date.now() };
    await this._save(db);
    return { ok: true, query: q, count: next.length, added: clean.length };
  }

  async getSimilar({ query, limit = 20 }) {
    const q = normalizeQuery(query);
    if (!q) return [];
    const db = await this._load();
    const ads = Array.isArray(db.queries[q]?.ads) ? db.queries[q].ads : [];
    return ads.slice(0, limit);
  }
}


