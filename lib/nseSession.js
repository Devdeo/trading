import axios from 'axios';

const SESSION_TTL = 5 * 60 * 1000; // 5 minutes

let sessionCache = {
  cookies: '',
  timestamp: null,
};

export const getBrowserHeaders = (extraHeaders = {}) => ({
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'X-Requested-With': 'XMLHttpRequest',
  ...extraHeaders,
});

export async function getNseSession() {
  const now = Date.now();

  if (sessionCache.cookies && sessionCache.timestamp && (now - sessionCache.timestamp < SESSION_TTL)) {
    return sessionCache.cookies;
  }

  const axiosInstance = axios.create({ timeout: 15000, maxRedirects: 5 });

  try {
    const resp = await axiosInstance.get('https://www.nseindia.com', {
      headers: {
        ...getBrowserHeaders(),
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
      },
    });

    if (resp.headers['set-cookie']) {
      sessionCache.cookies = resp.headers['set-cookie']
        .map(c => c.split(';')[0])
        .join('; ');
      sessionCache.timestamp = now;
    }
  } catch {
    console.warn('NSE session establishment failed, proceeding without cookies');
  }

  return sessionCache.cookies;
}

export async function nseGet(url, referer = 'https://www.nseindia.com/option-chain') {
  const cookies = await getNseSession();
  await new Promise(r => setTimeout(r, 500));

  const response = await axios.get(url, {
    timeout: 15000,
    maxRedirects: 5,
    headers: {
      ...getBrowserHeaders({ Referer: referer }),
      Cookie: cookies,
    },
  });

  return response;
}
