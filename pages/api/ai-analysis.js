import { GoogleGenAI } from "@google/genai";
import { withAuth } from '../../lib/authMiddleware';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple in-memory cache for AI analysis
let cache = new Map();

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { symbol, oiData, candlestickData, currentPrice, timeframe, sentiment } = req.body;
    
    if (!symbol || !oiData || !candlestickData) {
      return res.status(400).json({ error: 'Missing required data: symbol, oiData, and candlestickData are required' });
    }

    // Create cache key based on symbol and current data snapshot
    const dataHash = JSON.stringify({ symbol, currentPrice, timeframe, sentiment }).slice(0, 100);
    const cacheKey = `${symbol}-${dataHash}`;
    const now = Date.now();
    
    // Check cache (valid for 2 minutes for AI analysis)
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (now - cachedData.timestamp < 120000) { // 2 minutes cache
        console.log(`Using cache for ${symbol}`);
        return res.status(200).json(cachedData.data);
      }
    }

    console.log(`Performing AI analysis for ${symbol} at ${currentPrice}`);
    
    // Process and format data for AI analysis
    const analysisData = processDataForAI(symbol, oiData, candlestickData, currentPrice, timeframe, sentiment);
    
    // Create comprehensive financial analysis prompt
    const prompt = createAnalysisPrompt(analysisData);
    
    // Get AI analysis using Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      config: {
        systemInstruction: `You are an expert financial analyst specializing in options trading and technical analysis. 
        Provide precise, actionable trading recommendations based on real-time market data.
        Always include specific entry levels, stop loss, and target prices with clear reasoning.
        Focus on risk management and probability-based analysis.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object", // <-- FIX 2: Added missing type property
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
        // FIX 1: Attempt to parse the response as JSON
        aiAnalysis = JSON.parse(response.text);
    } catch (parseError) {
        console.error("AI service returned invalid JSON:", response.text);
        // Re-throw the error with a more specific message
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
        oiDataPoints: oiData.length,
        candlestickPoints: candlestickData.length,
        pcr: analysisData.pcr,
        netEffect: analysisData.netEffect
      }
    };

    // Update cache
    cache.set(cacheKey, {
      data: result,
      timestamp: now
    });

    // Clean old cache entries (keep last 20 entries)
    if (cache.size > 20) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    console.log(`AI analysis completed for ${symbol}: ${aiAnalysis.trend} with ${aiAnalysis.confidence}% confidence`);
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('AI analysis error:', error.message);
    
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
        error: 'AI analysis failed',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
}

// Process raw market data for AI analysis
function processDataForAI(symbol, oiData, candlestickData, currentPrice, timeframe, sentiment) {
  // Calculate key metrics from OI data
  const totalCEOI = oiData.ceOpenInterest?.reduce((sum, val) => sum + (val || 0), 0) || 0;
  const totalPEOI = oiData.peOpenInterest?.reduce((sum, val) => sum + (val || 0), 0) || 0;
  const pcr = totalCEOI > 0 ? (totalPEOI / totalCEOI) : 0;
  
  const ceChangeOI = oiData.ceChangeOpenInterest?.reduce((sum, val) => sum + (val || 0), 0) || 0;
  const peChangeOI = oiData.peChangeOpenInterest?.reduce((sum, val) => sum + (val || 0), 0) || 0;
  const netOIChange = peChangeOI - ceChangeOI;
  
  // Extract recent candlestick data (last 20 candles for analysis)
  const recentCandles = candlestickData.slice(-20);
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
  
  // Find recent highs and lows
  const recentHighs = prices.map(p => p.high);
  const recentLows = prices.map(p => p.low);
  const resistance = Math.max(...recentHighs);
  const support = Math.min(...recentLows);
  
  return {
    symbol,
    currentPrice,
    timeframe,
    pcr: pcr.toFixed(3),
    netEffect: sentiment?.netEffect || 0,
    sentiment: sentiment?.sentiment || 'NEUTRAL',
    oiMetrics: {
      totalCEOI,
      totalPEOI,
      ceChangeOI,
      peChangeOI,
      netOIChange
    },
    priceAction: {
      priceChange: priceChange.toFixed(2),
      sma5: sma5.toFixed(2),
      sma10: sma10.toFixed(2),
      resistance: resistance.toFixed(2),
      support: support.toFixed(2),
      currentVsResistance: ((currentPrice - resistance) / resistance * 100).toFixed(2),
      currentVsSupport: ((currentPrice - support) / support * 100).toFixed(2)
    },
    recentCandles: prices.slice(-5) // Last 5 candles for pattern analysis
  };
}

// Create comprehensive analysis prompt for AI
function createAnalysisPrompt(data) {
  return `Analyze the following real-time financial data for ${data.symbol} and provide specific trading recommendations:

CURRENT MARKET DATA:
- Symbol: ${data.symbol}
- Current Price: ₹${data.currentPrice}
- Timeframe: ${data.timeframe}
- Price Change: ${data.priceAction.priceChange}%

OPTIONS DATA (Open Interest Analysis):
- Put-Call Ratio (PCR): ${data.pcr}
- Total CE OI: ${data.oiMetrics.totalCEOI.toLocaleString()}
- Total PE OI: ${data.oiMetrics.totalPEOI.toLocaleString()}
- CE Change OI: ${data.oiMetrics.ceChangeOI}
- PE Change OI: ${data.oiMetrics.peChangeOI}
- Net OI Change: ${data.oiMetrics.netOIChange}
- Current Sentiment: ${data.sentiment}
- Net Effect: ${data.netEffect}

TECHNICAL ANALYSIS:
- 5-period SMA: ₹${data.priceAction.sma5}
- 10-period SMA: ₹${data.priceAction.sma10}
- Recent Resistance: ₹${data.priceAction.resistance}
- Recent Support: ₹${data.priceAction.support}
- Distance from Resistance: ${data.priceAction.currentVsResistance}%
- Distance from Support: ${data.priceAction.currentVsSupport}%

RECENT PRICE ACTION:
${data.recentCandles.map((candle, i) => 
  `Candle ${i+1}: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close}`
).join('\n')}

ANALYSIS REQUIREMENTS:
1. Interpret the PCR (ideal range 0.7-1.3) and OI changes for market sentiment
2. Analyze price action relative to moving averages and key levels
3. Identify current trend and momentum
4. Provide specific entry level with reasoning
5. Set appropriate stop loss (risk management)
6. Define realistic target levels (T1 and T2)
7. Calculate risk-reward ratio
8. Suggest trading strategy and time horizon
9. Assess overall risk level

Consider:
- PCR > 1.2 typically indicates oversold conditions (bullish)
- PCR < 0.7 typically indicates overbought conditions (bearish)
- High PE OI increase suggests bullish sentiment
- High CE OI increase suggests bearish sentiment
- Price above moving averages suggests uptrend
- Support/resistance levels for entry and exit points

Provide actionable insights based on current market conditions and data patterns.`;
}

export default withAuth(handler);
