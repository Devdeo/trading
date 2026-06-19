import { withAuth } from '../../lib/authMiddleware';
import { nseGet } from '../../lib/nseSession';

const RATE_LIMIT_WINDOW = 60000;
const MAX_REQUESTS = 30;
let requestCount = 0;
let windowStart = Date.now();

const CACHE_TTL = 30 * 1000;
const FALLBACK_TTL = 5 * 60 * 1000;
const cache = new Map();

async function handler(req, res) {
  const now = Date.now();

  if (now - windowStart > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }
  if (requestCount >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  requestCount++;

  const { symbol, type, expiry } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'Symbol is required' });
  }

  const cacheKey = `${symbol}:${type || 'Equity'}:${expiry || ''}`;
  const cached = cache.get(cacheKey);

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    let url;
    if (expiry) {
      url = `https://www.nseindia.com/api/option-chain-v3?type=${encodeURIComponent(type || 'Equity')}&symbol=${encodeURIComponent(symbol)}&expiry=${encodeURIComponent(expiry)}`;
    } else {
      url = `https://www.nseindia.com/api/option-chain-v3?type=${encodeURIComponent(type || 'Equity')}&symbol=${encodeURIComponent(symbol)}`;
    }

    const response = await nseGet(url, 'https://www.nseindia.com/option-chain');

    cache.set(cacheKey, { data: response.data, timestamp: now });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('NSE futures-data error:', error.message);

    if (cached && now - cached.timestamp < FALLBACK_TTL) {
      return res.status(200).json(cached.data);
    }

    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'NSE API access temporarily blocked. Please try again later.' });
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'NSE API connection timeout.' });
    }
    return res.status(500).json({ error: 'Failed to fetch futures data from NSE.', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
}

export default withAuth(handler);
