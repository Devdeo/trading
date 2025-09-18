import axios from 'axios';

// Simple in-memory cache
let cache = {
  data: null,
  timestamp: null,
  symbol: null,
  timeframe: null
};

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
let requestCount = 0;
let windowStart = Date.now();

export default async function handler(req, res) {
  // Rate limiting check
  const now = Date.now();
  if (now - windowStart > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    windowStart = now;
  }

  if (requestCount >= MAX_REQUESTS) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  requestCount++;

  try {
    const { symbol, timeframe } = req.query;

    if (!symbol || !timeframe) {
      return res.status(400).json({ error: 'Symbol and timeframe are required' });
    }

    // Check cache (valid for 2 minutes for crypto data)
    if (cache.data && cache.timestamp && 
        cache.symbol === symbol && 
        cache.timeframe === timeframe &&
        now - cache.timestamp < 120000) {
      return res.status(200).json(cache.data);
    }

    // Map timeframes to appropriate intervals and ranges
    const getTimeframeParams = (tf) => {
      const timeframeMap = {
        '1h': { interval: '1h', days: '7' },
        '2h': { interval: '2h', days: '14' }, 
        '5h': { interval: '5h', days: '30' },
        '10h': { interval: '10h', days: '60' },
        '1d': { interval: '1d', days: '365' }
      };
      return timeframeMap[tf] || timeframeMap['1h'];
    };

    const { interval, days } = getTimeframeParams(timeframe);

    // Convert symbol format (BTCUSDT -> bitcoin, ETHUSDT -> ethereum)
    const getCoinId = (symbol) => {
      const symbolMap = {
        'BTCUSDT': 'bitcoin',
        'ETHUSDT': 'ethereum'
      };
      return symbolMap[symbol] || 'bitcoin';
    };

    const coinId = getCoinId(symbol);

    // Use CoinGecko API for crypto data (free tier)
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc`,
      {
        params: {
          vs_currency: 'usd',
          days: days
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }
    );

    const ohlcData = response.data;

    if (!ohlcData || !Array.isArray(ohlcData)) {
      throw new Error('Invalid data format from CoinGecko API');
    }

    // Transform data to match our candlestick format
    // CoinGecko returns: [timestamp, open, high, low, close]
    // We need: { x: timestamp, y: [open, high, low, close] }
    const transformedData = ohlcData.map(candle => ({
      x: candle[0], // timestamp
      y: [
        parseFloat(candle[1]), // open
        parseFloat(candle[2]), // high
        parseFloat(candle[3]), // low
        parseFloat(candle[4])  // close
      ]
    }));

    // Filter data based on timeframe to reduce noise
    const filterDataByTimeframe = (data, timeframe) => {
      if (!data || data.length === 0) return data;
      
      const now = Date.now();
      let cutoffTime;
      
      switch(timeframe) {
        case '1h':
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days
          break;
        case '2h':
          cutoffTime = now - (14 * 24 * 60 * 60 * 1000); // 14 days
          break;
        case '5h':
          cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days
          break;
        case '10h':
          cutoffTime = now - (60 * 24 * 60 * 60 * 1000); // 60 days
          break;
        case '1d':
          cutoffTime = now - (365 * 24 * 60 * 60 * 1000); // 365 days
          break;
        default:
          cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // Default 7 days
      }
      
      return data.filter(candle => candle.x >= cutoffTime);
    };

    const filteredData = filterDataByTimeframe(transformedData, timeframe);

    const result = {
      data: filteredData,
      symbol,
      timeframe,
      timestamp: now,
      source: 'CoinGecko'
    };

    // Update cache
    cache.data = result;
    cache.timestamp = now;
    cache.symbol = symbol;
    cache.timeframe = timeframe;

    console.log(`Crypto data fetched for ${symbol} (${timeframe}): ${filteredData.length} data points`);

    res.status(200).json(result);
  } catch (error) {
    console.error('Crypto data API error:', error.message);
    
    // Return cached data if available during errors
    if (cache.data && cache.timestamp && 
        cache.symbol === req.query.symbol && 
        cache.timeframe === req.query.timeframe &&
        now - cache.timestamp < 600000) { // 10 minute fallback
      console.log('Returning cached crypto data due to API error');
      return res.status(200).json(cache.data);
    }
    
    // More specific error handling
    if (error.response?.status === 429) {
      res.status(503).json({ 
        error: 'CoinGecko API rate limit exceeded. Please try again in a few minutes.' 
      });
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      res.status(504).json({ 
        error: 'CoinGecko API connection timeout. The server may be experiencing high load.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch crypto data from CoinGecko API',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}