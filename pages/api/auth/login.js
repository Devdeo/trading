export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { password } = req.body;
  const correctPassword = process.env.APP_PASSWORD;

  if (!correctPassword) {
    return res.status(500).json({ message: 'Server configuration error' });
  }

  if (password === correctPassword) {
    res.setHeader('Set-Cookie', `auth_token=${Buffer.from(correctPassword).toString('base64')}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Incorrect password' });
  }
}
