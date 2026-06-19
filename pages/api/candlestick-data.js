import axios from 'axios';
import { withAuth } from '../../lib/authMiddleware';

// Simple in-memory cache for candlestick data
let cache = new Map();

async function handler(req, res) {
  try {
    const { symbol, interval = '5m', range = '5d', isIndex = 'false', isCommodity = 'false' } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Create cache key
    const cacheKey = `${symbol}-${interval}-${range}-${isIndex}-${isCommodity}`;
    const now = Date.now();
    
    // Check cache (valid for 60 seconds)
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (now - cachedData.timestamp < 60000) {
        return res.status(200).json(cachedData.data);
      }
    }

    // Function to get Yahoo Finance symbol format
    const getYahooSymbol = (symbol, isIndex, isCommodity) => {
      if (isCommodity === 'true') {
        // Commodity futures: symbol is already a Yahoo Finance futures ticker (e.g. CL=F)
        return symbol;
      }
      if (isIndex === 'true') {
        const indexMap = {
          'NIFTY': '^NSEI',
          'BANKNIFTY': '^NSEBANK', 
          'FINNIFTY': '^CNXFIN',
          'MIDCPNIFTY': '^NSEMDCP50',
          'NIFTYNXT50': '^NSENEXT'
        };
        return indexMap[symbol] || symbol;
      } else {
        // For individual stocks, add .NS suffix
        return `${symbol}.NS`;
      }
    };

    const yahooSymbol = getYahooSymbol(symbol, isIndex, isCommodity);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=${interval}&range=${range}`;
    
    console.log('Fetching candlestick data from:', url);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    const result = response.data?.chart?.result?.[0];
    
    if (!result || !result.timestamp) {
      return res.status(404).json({ error: 'No data found for the specified symbol' });
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    
    if (!quotes || !quotes.open || !quotes.high || !quotes.low || !quotes.close) {
      return res.status(404).json({ error: 'Invalid data format received' });
    }

    // Format data for ApexCharts candlestick format
    const candleData = timestamps.map((timestamp, index) => ({
      x: new Date(timestamp * 1000),
      y: [
        parseFloat(quotes.open[index]?.toFixed(2)) || 0,
        parseFloat(quotes.high[index]?.toFixed(2)) || 0,
        parseFloat(quotes.low[index]?.toFixed(2)) || 0,
        parseFloat(quotes.close[index]?.toFixed(2)) || 0
      ]
    })).filter(candle => 
      // Filter out invalid candles
      candle.y[0] > 0 && candle.y[1] > 0 && candle.y[2] > 0 && candle.y[3] > 0
    );

    const responseData = {
      symbol: yahooSymbol,
      interval,
      range,
      data: candleData,
      meta: result.meta
    };

    // Update cache
    cache.set(cacheKey, {
      data: responseData,
      timestamp: now
    });

    // Clean old cache entries (keep last 50 entries)
    if (cache.size > 50) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Yahoo Finance API error:', error.message);
    
    if (error.response?.status === 404) {
      res.status(404).json({ 
        error: 'Symbol not found or no data available for the specified timeframe' 
      });
    } else if (error.code === 'ETIMEDOUT') {
      res.status(504).json({ 
        error: 'Request timeout. Yahoo Finance API may be experiencing high load.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch candlestick data',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

export default withAuth(handler);