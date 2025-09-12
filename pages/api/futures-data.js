import axios from 'axios';

// Simple in-memory cache
let cache = {
  data: null,
  timestamp: null
};

// Rate limiting
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30; // 30 requests per minute
let requestCount = 0;
let windowStart = Date.now();

// Enhanced headers to mimic real browser behavior
const getBrowserHeaders = () => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'Referer': 'https://www.nseindia.com/option-chain'
});

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
    const { symbol } = req.query;
    
    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }
    
    // Check cache (valid for 30 seconds)
    if (cache.data && cache.timestamp && (now - cache.timestamp < 30000)) {
      return res.status(200).json(cache.data);
    }

    // Create axios instance with default config
    const axiosInstance = axios.create({
      timeout: 10000,
      maxRedirects: 5,
      headers: getBrowserHeaders()
    });

    // First, establish session by visiting the main page
    let sessionCookies = '';
    try {
      const sessionResponse = await axiosInstance.get('https://www.nseindia.com', {
        headers: {
          ...getBrowserHeaders(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
        }
      });
      
      if (sessionResponse.headers['set-cookie']) {
        sessionCookies = sessionResponse.headers['set-cookie']
          .map(cookie => cookie.split(';')[0])
          .join('; ');
      }
    } catch (sessionError) {
      console.log('Session establishment failed, proceeding without cookies');
    }

    // Wait a moment to mimic human behavior
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Now make the actual API request for equities option chain
    const response = await axiosInstance.get(
      `https://www.nseindia.com/api/option-chain-equities?symbol=${symbol}`, 
      {
        headers: {
          ...getBrowserHeaders(),
          'Cookie': sessionCookies,
          'X-Requested-With': 'XMLHttpRequest'
        }
      }
    );

    // Update cache
    cache.data = response.data;
    cache.timestamp = now;

    res.status(200).json(response.data);
  } catch (error) {
    console.error('NSE Futures API error:', error.message);
    
    // Return cached data if available during errors
    if (cache.data && cache.timestamp && (now - cache.timestamp < 300000)) { // 5 minute fallback
      console.log('Returning cached futures data due to API error');
      return res.status(200).json(cache.data);
    }
    
    // More specific error handling
    if (error.response?.status === 401 || error.response?.status === 403) {
      res.status(503).json({ 
        error: 'NSE API access temporarily blocked. This is a known issue with NSE servers blocking automated requests. Please try again later.' 
      });
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      res.status(504).json({ 
        error: 'NSE API connection timeout. The server may be experiencing high load.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to fetch futures data from NSE API',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}