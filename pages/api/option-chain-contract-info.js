import { withAuth } from '../../lib/authMiddleware';
import { nseGet } from '../../lib/nseSession';

const CACHE_TTL = 60 * 1000;
const cache = new Map();

async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({ error: 'symbol query param is required' });
  }

  const now = Date.now();
  const cached = cache.get(symbol);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  try {
    const response = await nseGet(
      `https://www.nseindia.com/api/option-chain-contract-info?symbol=${encodeURIComponent(symbol)}`,
      'https://www.nseindia.com/option-chain'
    );

    cache.set(symbol, { data: response.data, timestamp: now });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('NSE option-chain-contract-info error:', error.message);

    if (cached) {
      return res.status(200).json(cached.data);
    }

    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'NSE API access temporarily blocked. Please try again later.' });
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'NSE API connection timeout.' });
    }
    return res.status(500).json({ error: 'Failed to fetch option-chain-contract-info from NSE.' });
  }
}

export default withAuth(handler);
