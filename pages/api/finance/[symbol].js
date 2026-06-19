import yahooFinance from 'yahoo-finance2';
import { withAuth } from '../../../lib/authMiddleware';

async function handler(req, res) {
  const { symbol } = req.query;

  try {
    const quote = await yahooFinance.quote(symbol);
    res.status(200).json(quote);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export default withAuth(handler);
