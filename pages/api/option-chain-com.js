import { withAuth } from '../../lib/authMiddleware';
import { nseGet } from '../../lib/nseSession';

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 30;
let requestCount = 0;
let windowStart = Date.now();

const CACHE_TTL = 3 * 60 * 1000;    // 3 minutes
const FALLBACK_TTL = 30 * 60 * 1000; // 30 minutes
const cache = new Map();

async function handler(req, res) {
  const now = Date.now();

  if (now - windowStart > RATE_LIMIT_WINDOW) { requestCount = 0; windowStart = now; }
  if (requestCount >= MAX_REQUESTS) return res.status(429).json({ error: 'Too many requests.' });
  requestCount++;

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

  const cacheKey = symbol.toUpperCase();
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const url = `https://www.nseindia.com/api/option-chain-com?symbol=${encodeURIComponent(symbol.toUpperCase())}`;
    const response = await nseGet(url, 'https://www.nseindia.com/market-data/commodity-derivatives');

    cache.set(cacheKey, { data: response.data, timestamp: now });
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('NSE option-chain-com error:', error.message);

    if (cached && now - cached.timestamp < FALLBACK_TTL) {
      return res.status(200).json(cached.data);
    }

    const status = error.response?.status;
    if (status === 401 || status === 403) return res.status(503).json({ error: 'NSE API access temporarily blocked.' });
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') return res.status(504).json({ error: 'NSE API timeout.' });
    return res.status(500).json({ error: 'Failed to fetch commodity option-chain data.' });
  }
}

export default withAuth(handler);
