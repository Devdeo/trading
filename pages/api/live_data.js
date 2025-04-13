import axios from 'axios';

// Simple in-memory cache
let cache = {
  data: null,
  timestamp: null,
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
    const { symbol } = req.query;

    if (!symbol) {
      return res.status(400).json({ error: 'Symbol is required' });
    }

    // Check cache (valid for 5 seconds)
    if (cache.data && cache.timestamp && now - cache.timestamp < 5000) {
      return res.status(200).json(cache.data);
    }

    // First get the cookies with retry mechanism
    let cookieResponse;
    let retries = 3;

    while (retries > 0) {
      try {
        cookieResponse = await axios.get('https://www.nseindia.com', {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
          timeout: 5000,
        });
        break;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to fetch cookies:', error.message);
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const cookies = cookieResponse.headers['set-cookie'];

    // Then make the actual request with cookies
    const response = await axios.get(`https://www.nseindia.com/api/quote-equity?symbol==${symbol}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.131 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'Cookie': cookies.join('; '),
        'Referer': 'https://www.nseindia.com/',
      },
      timeout: 5000,
    });

    // Update cache
    cache.data = response.data;
    cache.timestamp = now;

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching futures data:', error.message);
    res.status(500).json({ error: 'Failed to fetch futures data' });
  }
}
