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

    // Check cache (valid for 2 minutes)
    if (
      cache.data &&
      cache.timestamp &&
      cache.symbol === symbol &&
      cache.timeframe === timeframe &&
      now - cache.timestamp < 120000
    ) {
      return res.status(200).json(cache.data);
    }

    // Map timeframe to Yahoo interval/range
    const getYahooTimeframeParams = (tf) => {
      const timeframeMap = {
        '1h': { interval: '1h', range: '7d' },
        '2h': { interval: '2h', range: '14d' },
        '5h': { interval: '5h', range: '30d' },
        '10h': { interval: '10h', range: '60d' },
        '1d': { interval: '1d', range: '1y' }
      };
      return timeframeMap[tf] || timeframeMap['1h'];
    };

    const { interval, range } = getYahooTimeframeParams(timeframe);

    // Convert symbol format (BTCUSDT -> BTC-USD, ETHUSDT -> ETH-USD)
    const getYahooSymbol = (symbol) => {
      const symbolMap = {
        'BTCUSDT': 'BTC-USD',
        'ETHUSDT': 'ETH-USD'
      };
      return symbolMap[symbol] || 'BTC-USD';
    };

    const yahooSymbol = getYahooSymbol(symbol);

    // Fetch data from Yahoo Finance API
    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}`,
      {
        params: {
          interval: interval,
          range: range
        },
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    const chart = response.data?.chart?.result?.[0];
    if (!chart || !chart.timestamp || !chart.indicators?.quote?.[0]) {
      throw new Error('Invalid data format from Yahoo Finance API');
    }

    const timestamps = chart.timestamp;
    const quote = chart.indicators.quote[0];

    // Transform Yahoo Finance data to candlestick format
    const transformedData = timestamps.map((ts, idx) => ({
      x: ts * 1000, // Yahoo timestamps are in seconds, convert to ms
      y: [
        parseFloat(quote.open[idx]),
        parseFloat(quote.high[idx]),
        parseFloat(quote.low[idx]),
        parseFloat(quote.close[idx])
      ]
    }));

    const result = {
      data: transformedData,
      symbol,
      timeframe,
      timestamp: now,
      source: 'Yahoo Finance'
    };

    // Update cache
    cache.data = result;
    cache.timestamp = now;
    cache.symbol = symbol;
    cache.timeframe = timeframe;

    console.log(`Crypto data fetched from Yahoo for ${symbol} (${timeframe}): ${transformedData.length} data points`);

    res.status(200).json(result);
  } catch (error) {
    console.error('Crypto data API error:', error.message);

    // Return cached data if available during errors
    if (
      cache.data &&
      cache.timestamp &&
      cache.symbol === req.query.symbol &&
      cache.timeframe === req.query.timeframe &&
      now - cache.timestamp < 600000
    ) {
      console.log('Returning cached crypto data due to API error');
      return res.status(200).json(cache.data);
    }

    // Error handling
    if (error.response?.status === 429) {
      res.status(503).json({
        error: 'Yahoo Finance API rate limit exceeded. Please try again later.'
      });
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      res.status(504).json({
        error: 'Yahoo Finance API connection timeout. The server may be experiencing high load.'
      });
    } else {
      res.status(500).json({
        error: 'Failed to fetch crypto data from Yahoo Finance API',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}
