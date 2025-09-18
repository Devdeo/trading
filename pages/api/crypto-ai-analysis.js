import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache for crypto AI analysis
let cache = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol, candlestickData, currentPrice, timeframe, type } = req.body;
    
    if (!symbol || !candlestickData || !currentPrice || type !== 'crypto') {
      return res.status(400).json({ error: 'Missing required data: symbol, candlestickData, currentPrice, and type=crypto are required' });
    }

    // Create cache key based on symbol and current data snapshot
    const dataHash = JSON.stringify({ symbol, currentPrice, timeframe }).slice(0, 100);
    const cacheKey = `crypto-${symbol}-${dataHash}`;
    const now = Date.now();
    
    // Check cache (valid for 3 minutes for crypto AI analysis)
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (now - cachedData.timestamp < 180000) { // 3 minutes cache
        console.log(`Using cache for crypto ${symbol}`);
        return res.status(200).json(cachedData.data);
      }
    }

    console.log(`Performing crypto AI analysis for ${symbol} at $${currentPrice}`);
    
    // Process and format crypto data for AI analysis
    const analysisData = processCryptoDataForAI(symbol, candlestickData, currentPrice, timeframe);
    
    // Create comprehensive crypto analysis prompt
    const prompt = createCryptoAnalysisPrompt(analysisData);
    
    // Get AI analysis using Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: `You are an expert cryptocurrency analyst specializing in technical analysis and trading. 
        Provide precise, actionable trading recommendations based on real-time crypto market data.
        Always include specific entry levels, stop loss, and target prices with clear reasoning.
        Focus on risk management and probability-based analysis for cryptocurrency markets.
        Consider crypto market volatility and 24/7 trading in your analysis.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            analysis: { type: "string" },
            trend: { 
              type: "string",
              enum: ["BULLISH", "BEARISH", "NEUTRAL", "VOLATILE"]
            },
            confidence: { 
              type: "number",
              minimum: 0,
              maximum: 100
            },
            entryLevel: { type: "number" },
            stopLoss: { type: "number" },
            target1: { type: "number" },
            target2: { type: "number" },
            riskReward: { type: "string" },
            keyLevels: {
              type: "object",
              properties: {
                support: { type: "array", items: { type: "number" } },
                resistance: { type: "array", items: { type: "number" } }
              }
            },
            strategy: { type: "string" },
            timeHorizon: { type: "string" },
            riskLevel: { 
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH"]
            }
          },
          required: ["analysis", "trend", "confidence", "entryLevel", "stopLoss", "target1", "strategy"]
        }
      },
      contents: prompt
    });

    let aiAnalysis;
    try {
      aiAnalysis = JSON.parse(response.text);
    } catch (parseError) {
      console.error("AI service returned invalid JSON:", response.text);
      throw new SyntaxError("AI service returned an invalid JSON format.");
    }
    
    if (!aiAnalysis || Object.keys(aiAnalysis).length === 0) {
      throw new Error("Empty or invalid response from AI model");
    }

    // Add metadata and timestamp
    const result = {
      ...aiAnalysis,
      symbol,
      currentPrice,
      timeframe,
      timestamp: new Date().toISOString(),
      dataPoints: {
        candlestickPoints: candlestickData.length,
        priceChange: analysisData.priceAction.priceChange,
        volatility: analysisData.volatility
      },
      type: 'crypto'
    };

    // Update cache
    cache.set(cacheKey, {
      data: result,
      timestamp: now
    });

    // Clean old cache entries (keep last 15 entries for crypto)
    if (cache.size > 15) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    console.log(`Crypto AI analysis completed for ${symbol}: ${aiAnalysis.trend} with ${aiAnalysis.confidence}% confidence`);
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('Crypto AI analysis error:', error.message);
    
    if (error.message.includes('API key')) {
      res.status(401).json({ 
        error: 'AI service authentication failed. Please check your API key configuration.' 
      });
    } else if (error.name === 'SyntaxError') {
      res.status(502).json({ 
        error: 'AI service returned invalid response format.' 
      });
    } else {
      res.status(500).json({ 
        error: 'Crypto AI analysis failed',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

// Process raw crypto market data for AI analysis
function processCryptoDataForAI(symbol, candlestickData, currentPrice, timeframe) {
  // Extract recent candlestick data (last 50 candles for analysis)
  const recentCandles = candlestickData.slice(-50);
  const prices = recentCandles.map(candle => ({
    time: candle.x,
    open: parseFloat(candle.y[0]),
    high: parseFloat(candle.y[1]),
    low: parseFloat(candle.y[2]),
    close: parseFloat(candle.y[3])
  }));
  
  // Calculate technical indicators
  const latestCandle = prices[prices.length - 1];
  const previousCandle = prices[prices.length - 2];
  
  const priceChange = latestCandle && previousCandle ? 
    ((latestCandle.close - previousCandle.close) / previousCandle.close * 100) : 0;
  
  // Calculate simple moving averages
  const closes = prices.map(p => p.close);
  const sma5 = closes.length >= 5 ? closes.slice(-5).reduce((a, b) => a + b) / 5 : currentPrice;
  const sma10 = closes.length >= 10 ? closes.slice(-10).reduce((a, b) => a + b) / 10 : currentPrice;
  const sma20 = closes.length >= 20 ? closes.slice(-20).reduce((a, b) => a + b) / 20 : currentPrice;
  
  // Find recent highs and lows
  const recentHighs = prices.map(p => p.high);
  const recentLows = prices.map(p => p.low);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);
  
  // Calculate volatility
  const priceChanges = [];
  for (let i = 1; i < prices.length; i++) {
    const change = ((prices[i].close - prices[i-1].close) / prices[i-1].close) * 100;
    priceChanges.push(Math.abs(change));
  }
  const volatility = priceChanges.length > 0 ? 
    (priceChanges.reduce((a, b) => a + b) / priceChanges.length).toFixed(2) : 0;

  // Calculate RSI (simplified version)
  const calculateRSI = (prices, period = 14) => {
    if (prices.length < period + 1) return 50; // neutral RSI
    
    let gains = 0;
    let losses = 0;
    
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i].close - prices[i-1].close;
      if (change > 0) {
        gains += change;
      } else {
        losses += Math.abs(change);
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));
    
    return Math.round(rsi);
  };

  const rsi = calculateRSI(prices);
  
  return {
    symbol,
    currentPrice,
    timeframe,
    volatility,
    rsi,
    priceAction: {
      priceChange: priceChange.toFixed(2),
      sma5: sma5.toFixed(2),
      sma10: sma10.toFixed(2),
      sma20: sma20.toFixed(2),
      resistance: resistance.toFixed(2),
      support: support.toFixed(2),
      currentVsResistance: ((currentPrice - resistance) / resistance * 100).toFixed(2),
      currentVsSupport: ((currentPrice - support) / support * 100).toFixed(2)
    },
    recentCandles: prices.slice(-10) // Last 10 candles for pattern analysis
  };
}

// Create comprehensive crypto analysis prompt for AI
function createCryptoAnalysisPrompt(data) {
  return `Analyze the following real-time cryptocurrency data for ${data.symbol} and provide specific trading recommendations:

CURRENT CRYPTO MARKET DATA:
- Symbol: ${data.symbol}
- Current Price: $${data.currentPrice}
- Timeframe: ${data.timeframe}
- Price Change: ${data.priceAction.priceChange}%
- Volatility: ${data.volatility}%
- RSI: ${data.rsi}

TECHNICAL ANALYSIS:
- 5-period SMA: $${data.priceAction.sma5}
- 10-period SMA: $${data.priceAction.sma10}
- 20-period SMA: $${data.priceAction.sma20}
- Recent Resistance: $${data.priceAction.resistance}
- Recent Support: $${data.priceAction.support}
- Distance from Resistance: ${data.priceAction.currentVsResistance}%
- Distance from Support: ${data.priceAction.currentVsSupport}%

RECENT PRICE ACTION:
${data.recentCandles.map((candle, i) => 
  `Candle ${i+1}: O:$${candle.open} H:$${candle.high} L:$${candle.low} C:$${candle.close}`
).join('\n')}

CRYPTO-SPECIFIC ANALYSIS REQUIREMENTS:
1. Consider the 24/7 nature of crypto markets and higher volatility
2. Analyze RSI levels (>70 overbought, <30 oversold)
3. Evaluate price action relative to moving averages and key levels
4. Identify current trend and momentum considering crypto market dynamics
5. Provide specific entry level with reasoning
6. Set appropriate stop loss considering crypto volatility (risk management)
7. Define realistic target levels (T1 and T2) accounting for crypto price swings
8. Calculate risk-reward ratio
9. Suggest trading strategy and time horizon suitable for crypto markets
10. Assess overall risk level considering crypto market volatility

CRYPTO MARKET CONSIDERATIONS:
- Crypto markets are highly volatile and trade 24/7
- Price movements can be amplified compared to traditional markets
- Consider support/resistance levels for entry and exit points
- RSI can stay overbought/oversold longer in crypto markets
- News and sentiment can cause rapid price movements
- Weekend trading continues unlike traditional markets

Provide actionable insights based on current crypto market conditions and technical patterns.`;
}
