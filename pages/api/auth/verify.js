import * as cookie from 'cookie';

export default function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const auth_token = cookies.auth_token;
  const correctPassword = (process.env.APP_PASSWORD || '').trim();

  if (!correctPassword) {
    return res.status(500).json({ authenticated: false });
  }

  const expectedToken = Buffer.from(correctPassword).toString('base64');

  if (auth_token === expectedToken) {
    return res.status(200).json({ authenticated: true });
  } else {
    return res.status(401).json({ authenticated: false });
  }
}
