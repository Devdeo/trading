import { withAuth } from '../../lib/authMiddleware';
import { nseGet } from '../../lib/nseSession';

const CACHE_TTL = 30 * 1000;
let cache = { data: null, timestamp: null };

async function handler(req, res) {
  const now = Date.now();

  if (cache.data && cache.timestamp && now - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    const response = await nseGet(
      'https://www.nseindia.com/api/master-quote',
      'https://www.nseindia.com/'
    );

    cache.data = response.data;
    cache.timestamp = now;

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('NSE master-quote error:', error.message);

    if (cache.data) {
      return res.status(200).json(cache.data);
    }

    const status = error.response?.status;
    if (status === 401 || status === 403) {
      return res.status(503).json({ error: 'NSE API access temporarily blocked. Please try again later.' });
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'NSE API connection timeout.' });
    }
    return res.status(500).json({ error: 'Failed to fetch master-quote from NSE.' });
  }
}

export default withAuth(handler);
