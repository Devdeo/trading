import yahooFinance from 'yahoo-finance';

export default async function handler(req, res) {
  const { symbol } = req.query;

  try {
    // Fetching live quote data
    const quotes = await yahooFinance.quote({
      symbol: symbol,
      modules: ['price', 'summaryDetail', 'financialData'], // Add more modules as needed for live data
    });

    res.status(200).json(quotes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
