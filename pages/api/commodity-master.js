import { withAuth } from '../../lib/authMiddleware';
import { nseGet } from '../../lib/nseSession';

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes — rarely changes
let cache = null;

const OPTION_TYPES = new Set(['OPTFUT', 'OPTBLN', 'OPTBAS', 'OPTFUTENR']);

async function handler(req, res) {
  const now = Date.now();

  if (cache && now - cache.timestamp < CACHE_TTL) {
    return res.status(200).json(cache.data);
  }

  try {
    const response = await nseGet(
      'https://www.nseindia.com/api/quotes-commodity-derivatives-master',
      'https://www.nseindia.com/market-data/commodity-derivatives'
    );

    const raw = response.data;
    // Build list of symbols that have an option chain instrument type
    const symbols = [];
    for (const [symbol, instruments] of Object.entries(raw)) {
      const hasOptions = instruments.some(i => OPTION_TYPES.has(i.instrumentType));
      if (hasOptions) {
        // Get option-chain expiry dates (from the OPTFUT/OPTBLN entry)
        const optEntry = instruments.find(i => OPTION_TYPES.has(i.instrumentType));
        const expiries = optEntry?.expiryDates || [];
        // Deduplicate expiry dates (some repeat)
        const uniqueExpiries = [...new Set(expiries)].sort(
          (a, b) => new Date(a.split('-').reverse().join('-')) - new Date(b.split('-').reverse().join('-'))
        );
        symbols.push({ symbol, expiries: uniqueExpiries });
      }
    }

    const result = { symbols };
    cache = { data: result, timestamp: now };
    return res.status(200).json(result);
  } catch (error) {
    console.error('NSE commodity-master error:', error.message);
    if (cache) return res.status(200).json(cache.data);
    return res.status(500).json({ error: 'Failed to fetch commodity master data.' });
  }
}

export default withAuth(handler);
