/**
 * Vercel Serverless Function - Universal API Handler
 * Routes all /api/* requests to appropriate handlers
 */

// Import helper functions and stores from server.mjs
import { MarketStore, buildSearchUrls } from '../marketStore.mjs';
import { BAZOS_CATEGORIES, getCategoryFromKeywords } from '../categories.mjs';
import { calculateProtectedPrice, median as calculateMedian } from '../pricingProtection.mjs';

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
