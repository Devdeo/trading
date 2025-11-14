import cookie from 'cookie';

export function withAuth(handler) {
  return async (req, res) => {
    const cookies = cookie.parse(req.headers.cookie || '');
    const auth_token = cookies.auth_token;
    const correctPassword = process.env.APP_PASSWORD;

    if (!correctPassword) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const expectedToken = Buffer.from(correctPassword).toString('base64');

    if (auth_token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized - Please login first' });
    }

    return handler(req, res);
  };
}
