import axios from 'axios';

let cache = { data: null, timestamp: null };

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 30;         // 30 requests per minute
let requestCount = 0;
let windowStart = Date.now();

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

const axiosInstance = axios.create({
  timeout: 10000,
  maxRedirects: 5,
  headers: getBrowserHeaders()
});

// infinite retry until cookies received
async function getSessionCookiesUntilSuccess(delay = 2000) {
  while (true) {
    try {
      const resp = await axiosInstance.get('https://www.nseindia.com', {
        headers: {
          ...getBrowserHeaders(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8'
        }
      });
      if (resp.headers['set-cookie']) {
        console.log('Got cookies!');
        return resp.headers['set-cookie']
          .map(c => c.split(';')[0])
          .join('; ');
      } else {
        console.log('No cookies in response, retrying…');
      }
    } catch (err) {
      console.log('Cookie fetch error, retrying…', err.message);
    }
    await new Promise(r => setTimeout(r, delay)); // wait before next try
  }
}

async function fetchOptionChain(symbol, cookies) {
  return await axiosInstance.get(
    `https://www.nseindia.com/api/option-chain-equities?symbol=${symbol}`,
    {
      headers: {
        ...getBrowserHeaders(),
        'Cookie': cookies,
        'X-Requested-With': 'XMLHttpRequest'
      }
    }
  );
}

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
    const { symbol } = req.query;
    if (!symbol) return res.status(400).json({ error: 'Symbol is required' });

    // cache check (30s)
    if (cache.data && cache.timestamp && (now - cache.timestamp < 30000)) {
      return res.status(200).json(cache.data);
    }

    // get cookies until success
    let cookies = await getSessionCookiesUntilSuccess();
    await new Promise(r => setTimeout(r, 1000)); // mimic human

    let response;
    try {
      response = await fetchOptionChain(symbol, cookies);
    } catch (err) {
      // retry once if blocked
      if (err.response && [401, 403].includes(err.response.status)) {
        console.log('API blocked first attempt, fetching cookies again…');
        cookies = await getSessionCookiesUntilSuccess();
        await new Promise(r => setTimeout(r, 1000));
        response = await fetchOptionChain(symbol, cookies);
      } else {
        throw err;
      }
    }

    cache.data = response.data;
    cache.timestamp = now;

    return res.status(200).json(response.data);
  } catch (error) {
    console.error('NSE API error:', error.message);

    if (cache.data && cache.timestamp && (now - cache.timestamp < 300000)) {
      console.log('Returning cached data due to API error');
      return res.status(200).json(cache.data);
    }

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(503).json({
        error: 'NSE API access temporarily blocked. Please try again later.'
      });
    } else if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return res.status(504).json({
        error: 'NSE API connection timeout. The server may be experiencing high load.'
      });
    } else {
      return res.status(500).json({
        error: 'Failed to fetch futures data from NSE API',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}
