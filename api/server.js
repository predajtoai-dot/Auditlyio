/**
 * Vercel Serverless Function - Universal API Handler
 * Routes all /api/* requests to appropriate handlers
 */

// Import helper functions and stores from server.mjs
import { MarketStore, buildSearchUrls } from '../marketStore.mjs';
import { BAZOS_CATEGORIES, getCategoryFromKeywords } from '../categories.mjs';
import { calculateProtectedPrice, median as calculateMedian } from '../pricingProtection.mjs';
import { createClient } from '@supabase/supabase-js';

// SUPABASE INITIALIZATION
const supabaseUrl = process.env.SUPABASE_URL || "https://dbbhvaokhdrgawohappo.supabase.co";
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || "sb_publishable_myBjYbRfS0G9VWj-a5mvaA_kPizADYd";
let supabase = null;

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error("❌ Failed to initialize Supabase:", err.message);
  }
}

// Helper to read request body
async function getBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      resolve(req.body);
      return;
    }
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

// Main handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathname = url.pathname;

  console.log(`[API] ${req.method} ${pathname}`);

  try {
    // Route: /api/audit/report
    if (pathname === '/api/audit/report' && req.method === 'GET') {
      const brand = url.searchParams.get('brand') || '';
      const model = url.searchParams.get('model') || '';
      
      if (!model) return res.status(400).json({ ok: false, error: 'Missing model' });
      if (!supabase) return res.status(500).json({ ok: false, error: 'Database not connected' });

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .ilike('model_name', model)
        .ilike('brand', brand)
        .maybeSingle();

      if (error) return res.status(500).json({ ok: false, error: error.message });
      if (!data) return res.status(404).json({ ok: false, error: 'Audit report not found' });

      return res.status(200).json({ ok: true, report: data });
    }

    // 💾 SAVE AUDIT TO CLOUD (STAY PERSISTENT)
    if (pathname === "/api/audits" && req.method === "POST") {
      try {
        const body = await getBody(req);
        const { report_data, risk_score, final_price_recommendation, product_id, user_email } = body;

        if (!supabase) throw new Error("Database not connected");

        const { data, error } = await supabase
          .from('audits')
          .insert({
            product_id,
            report_data,
            risk_score: risk_score || 0,
            final_price_recommendation: final_price_recommendation || 0,
            user_email: user_email || null,
            status: 'completed'
          })
          .select('id')
          .single();

        if (error) throw error;

        // If email provided, send the link (Non-blocking)
        if (user_email) {
          console.log(`📧 [API] Email collection requested for ${user_email}`);
        }

        return res.status(200).json({ ok: true, id: data.id });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // 📂 FETCH AUDIT FROM CLOUD (RELOAD BY ID)
    if (pathname.startsWith("/api/audits/") && req.method === "GET") {
      const id = pathname.split("/").pop();
      if (!id || id === "audits") return res.status(400).json({ ok: false, error: "Missing ID" });
      
      try {
        if (!supabase) throw new Error("Database not connected");

        // 1. Fetch Audit
        const { data: audit, error: auditErr } = await supabase
          .from('audits')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (auditErr) throw auditErr;
        if (!audit) return res.status(404).json({ ok: false, error: "Audit not found" });

        // 2. Fetch Product (Separate to avoid relationship cache issues)
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', audit.product_id)
          .maybeSingle();
        
        audit.products = product;

        // 🕒 CHECK EXPIRATION (30 DAYS LIMIT)
        const createdAt = new Date(audit.created_at);
        const now = new Date();
        const diffDays = Math.abs(now - createdAt) / (1000 * 60 * 60 * 24);
        
        if (diffDays > 30) {
          return res.status(410).json({ ok: false, error: "Tento odkaz na audit vypršal (platnosť 30 dní)." });
        }

        return res.status(200).json({ ok: true, audit: audit });
      } catch (err) {
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // 📩 FETCH AUDITS BY EMAIL
    if (pathname === "/api/audits-by-email" && req.method === "GET") {
      const email = url.searchParams.get("email");
      if (!email) return res.status(400).json({ ok: false, error: "Missing email" });

      try {
        if (!supabase) throw new Error("Database not connected");

        // Fetch audits
        const { data: audits, error: auditsErr } = await supabase
          .from('audits')
          .select('*')
          .eq('user_email', email)
          .order('created_at', { ascending: false });

        if (auditsErr) throw auditsErr;

        if (!audits || audits.length === 0) {
          return res.status(200).json({ ok: true, audits: [] });
        }

        // Fetch all product IDs needed
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

        return res.status(200).json({ ok: true, audits: auditsWithProducts });
      } catch (err) {
        console.error("❌ [API Audits] Fetch by email error:", err.message);
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // Route: /api/market/search
    if (pathname.startsWith('/api/market/search')) {
      const query = url.searchParams.get('query') || '';
      const source = url.searchParams.get('source') || 'bazos';
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const category = url.searchParams.get('category') || '';

      const store = new MarketStore();
      const urls = buildSearchUrls(query, category || getCategoryFromKeywords(query));
      
      console.log(`[Market Search] Query: "${query}", Limit: ${limit}`);
      
      const results = await store.searchMultiple(urls, {
        maxPages: Math.ceil(limit / 20),
        maxAds: limit
      });

      return res.status(200).json({
        ok: true,
        source,
        query,
        ads: results.slice(0, limit)
      });
    }

    // Route: /api/evaluate
    if (pathname === '/api/evaluate' && req.method === 'POST') {
      const body = await getBody(req);
      const { productName, description, imageBase64, adStyle, similarAds } = body;

      // For now, return a mock response since full evaluate logic requires OpenAI
      // The actual implementation is in server.mjs but requires significant refactoring
      
      return res.status(200).json({
        ok: true,
        seoTitle: productName || 'Produkt',
        description: description || 'Popis produktu',
        message: 'API endpoint funguje - prosím nakonfigurujte OPENAI_API_KEY v Vercel Environment Variables'
      });
    }

    // Route: /api/identify
    if (pathname === '/api/identify' && req.method === 'POST') {
      return res.status(200).json({
        ok: true,
        productName: 'Produkt',
        message: 'Identify endpoint - requires OPENAI_API_KEY'
      });
    }

    // Route: /api/google-shopping
    if (pathname === '/api/google-shopping') {
      const query = url.searchParams.get('query') || '';
      return res.status(200).json({
        ok: true,
        results: []
      });
    }

    // Route: /api/beta-signup
    if (pathname === '/api/beta-signup' && req.method === 'POST') {
      return res.status(200).json({ ok: true });
    }

    // Route: /api/feedback
    if (pathname === '/api/feedback' && req.method === 'POST') {
      return res.status(200).json({ ok: true });
    }

    // Route: /api/review-feedback
    if (pathname === '/api/review-feedback' && req.method === 'POST') {
      return res.status(200).json({ ok: true });
    }

    // Route: /api/refine-search
    if (pathname === '/api/refine-search' && req.method === 'POST') {
      const body = await getBody(req);
      return res.status(200).json({
        ok: true,
        refinedQuery: body.productName || '',
        ads: []
      });
    }

    // Route: /api/edit-ad
    if (pathname === '/api/edit-ad' && req.method === 'POST') {
      return res.status(200).json({
        ok: true,
        message: 'Edit endpoint - requires OpenAI'
      });
    }

    // Route: /api/market/sources
    if (pathname === '/api/market/sources') {
      return res.status(200).json({
        ok: true,
        sources: []
      });
    }

    // 404 for unknown routes
    return res.status(404).json({
      ok: false,
      error: `Unknown API route: ${pathname}`
    });

  } catch (error) {
    console.error('[API Error]', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
}
