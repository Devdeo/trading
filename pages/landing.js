import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// Dynamically import LightweightChart to avoid SSR issues
const LightweightChart = dynamic(() => import('../components/LightweightChart'), { ssr: false });

/**
 * Calculates the net effect based on changes in open interest for CE and PE options.
 * @param {Array} filteredStrikeRange - Array of option data for a specific strike range.
 * @returns {number} The calculated net effect.
 */
function calculateNetEffect(filteredStrikeRange) {
  let netEffect = 0;

  filteredStrikeRange.forEach(option => {
    const ceChange = option.CE?.changeinOpenInterest || 0;
    const peChange = option.PE?.changeinOpenInterest || 0;
    const ceOI = option.CE?.openInterest || 0;
    const peOI = option.PE?.openInterest || 0;

    netEffect += (peChange * peOI) - (ceChange * ceOI) ;
  });

  return netEffect;
}

/**
 * Adjust the brightness of a hex color.
 * If factor < 1 the color is darkened; if factor > 1 the color is lightened.
 */



export default function Landing() {
  // Tab state
  const [activeTab, setActiveTab] = useState('indian-stocks');
  
  // Indian Stock Market states
  const [data, setData] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState('');
  const [pcr, setPcr] = useState('');
  const [liveData, setLiveData] = useState({ netEffect: undefined, sentiment: '' }); // Initialize liveData with netEffect and sentiment
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [futuresData, setFuturesData] = useState(null);
  const [selectedFuturesExpiry, setSelectedFuturesExpiry] = useState('');
  const [filteredFuturesData, setFilteredFuturesData] = useState([]);

  // Contract info expiry dates (from option-chain-contract-info API)
  const [contractInfoExpiries, setContractInfoExpiries] = useState([]);
  const [equityContractInfoExpiries, setEquityContractInfoExpiries] = useState([]);
  // Dynamic symbol list from master-quote
  const [dynamicSymbols, setDynamicSymbols] = useState([]);
  
  // Combined selection states
  const [searchText, setSearchText] = useState('');
  const [isIndexSelected, setIsIndexSelected] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  // Data update timestamps
  const [oiDataLastUpdate, setOiDataLastUpdate] = useState(null);
  const [candlestickDataLastUpdate, setCandlestickDataLastUpdate] = useState(null);
  const [cryptoDataLastUpdate, setCryptoDataLastUpdate] = useState(null);

  // Crypto states
  const [selectedCrypto, setSelectedCrypto] = useState('BTCUSDT');
  const [cryptoTimeframe, setCryptoTimeframe] = useState('1h');
  const [cryptoData, setCryptoData] = useState({
    series: [{
      name: 'Price',
      data: []
    }],
    options: {
      chart: {
        type: 'candlestick',
        height: 450,
        animations: {
          enabled: false
        },
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        }
      },
      title: {
        text: 'Crypto Price Chart',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333'
        }
      },
      grid: {
        show: true,
        borderColor: '#e0e0e0',
        strokeDashArray: 3,
        position: 'back'
      },
      xaxis: {
        type: 'datetime',
        labels: {
          formatter: function(val) {
            return new Date(val).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
          },
          style: {
            colors: ['#666'],
            fontSize: '12px'
          }
        }
      },
      yaxis: {
        tooltip: {
          enabled: true
        },
        labels: {
          formatter: function(val) {
            return '$' + val.toFixed(2);
          },
          style: {
            colors: ['#666'],
            fontSize: '12px'
          }
        }
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: '#00C851',
            downward: '#ff4444'
          },
          wick: {
            useFillColor: true
          }
        }
      }
    }
  });
  const [cryptoCurrentPrice, setCryptoCurrentPrice] = useState(0);
  const [cryptoAiAnalysis, setCryptoAiAnalysis] = useState({
    analysis: '',
    trend: 'NEUTRAL',
    confidence: 0,
    entryLevel: 0,
    stopLoss: 0,
    target1: 0,
    target2: 0,
    riskReward: '',
    keyLevels: { support: [], resistance: [] },
    strategy: '',
    timeHorizon: '',
    riskLevel: 'MEDIUM',
    timestamp: null,
    loading: false
  });

  // Chart controls
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [strikeRange, setStrikeRange] = useState(3); // Number of strikes before and after ATM
  
  // Candlestick chart states
  const [selectedTimeframe, setSelectedTimeframe] = useState('5m');
  const [candlestickData, setCandlestickData] = useState({
    series: [{
      name: 'Price',
      data: []
    }],
    options: {
      chart: {
        type: 'candlestick',
        height: 450,
        animations: {
          enabled: false
        },
        toolbar: {
          show: true,
          tools: {
            download: true,
            selection: true,
            zoom: true,
            zoomin: true,
            zoomout: true,
            pan: true,
            reset: true
          }
        },
        zoom: {
          enabled: true,
          type: 'x',
          autoScaleYaxis: true,
          zoomedArea: {
            fill: {
              color: '#90CAF9',
              opacity: 0.4
            },
            stroke: {
              color: '#0D47A1',
              opacity: 0.4,
              width: 1
            }
          }
        },
        pan: {
          enabled: true
        },
        selection: {
          enabled: true,
          type: 'x',
          fill: {
            color: '#24292e',
            opacity: 0.1
          },
          stroke: {
            width: 1,
            dashArray: 3,
            color: '#24292e',
            opacity: 0.4
          }
        }
      },
      title: {
        text: 'Price Chart (TradingView Style)',
        align: 'center',
        style: {
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333'
        }
      },
      grid: {
        show: true,
        borderColor: '#e0e0e0',
        strokeDashArray: 3,
        position: 'back'
      },
      xaxis: {
        type: 'datetime',
        labels: {
          formatter: function(val) {
            return new Date(val).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit'
            });
          },
          style: {
            colors: ['#666'],
            fontSize: '12px'
          }
        },
        axisBorder: {
          show: true,
          color: '#e0e0e0'
        },
        axisTicks: {
          show: true,
          color: '#e0e0e0'
        }
      },
      yaxis: {
        tooltip: {
          enabled: true
        },
        labels: {
          formatter: function(val) {
            return '₹' + val.toFixed(2);
          },
          style: {
            colors: ['#666'],
            fontSize: '12px'
          }
        },
        axisBorder: {
          show: true,
          color: '#e0e0e0'
        }
      },
      plotOptions: {
        candlestick: {
          colors: {
            upward: '#00C851',
            downward: '#ff4444'
          },
          wick: {
            useFillColor: true
          }
        }
      },
      tooltip: {
        enabled: true,
        shared: false,
        custom: function({seriesIndex, dataPointIndex, w}) {
          if (!w.globals.seriesCandleO || !w.globals.seriesCandleO[seriesIndex]) {
            return '<div class="apexcharts-tooltip-candlestick">No data available</div>';
          }
          const o = w.globals.seriesCandleO[seriesIndex][dataPointIndex];
          const h = w.globals.seriesCandleH[seriesIndex][dataPointIndex];
          const l = w.globals.seriesCandleL[seriesIndex][dataPointIndex];
          const c = w.globals.seriesCandleC[seriesIndex][dataPointIndex];
          const change = c - o;
          const changePercent = ((change / o) * 100).toFixed(2);
          const changeColor = change >= 0 ? '#00C851' : '#ff4444';
          return `<div class="apexcharts-tooltip-candlestick" style="padding: 10px; font-size: 12px;">` +
            `<div style="font-weight: bold; margin-bottom: 5px;">Price Data</div>` +
            `<div>Open: <span style="font-weight: bold;">₹${o?.toFixed(2) || 'N/A'}</span></div>` +
            `<div>High: <span style="font-weight: bold;">₹${h?.toFixed(2) || 'N/A'}</span></div>` +
            `<div>Low: <span style="font-weight: bold;">₹${l?.toFixed(2) || 'N/A'}</span></div>` +
            `<div>Close: <span style="font-weight: bold;">₹${c?.toFixed(2) || 'N/A'}</span></div>` +
            `<div style="margin-top: 5px; color: ${changeColor}; font-weight: bold;">` +
            `Change: ${change >= 0 ? '+' : ''}${change?.toFixed(2) || 'N/A'} (${changePercent}%)` +
            `</div>` +
            `</div>`;
        }
      },
      crosshairs: {
        show: true,
        position: 'back',
        stroke: {
          color: '#b6b6b6',
          width: 1,
          dashArray: 3
        }
      }
    }
  });

  // AI Analysis states
  const [aiAnalysis, setAiAnalysis] = useState({
    analysis: '',
    trend: 'NEUTRAL',
    confidence: 0,
    entryLevel: 0,
    stopLoss: 0,
    target1: 0,
    target2: 0,
    riskReward: '',
    keyLevels: { support: [], resistance: [] },
    strategy: '',
    timeHorizon: '',
    riskLevel: 'MEDIUM',
    timestamp: null,
    loading: false
  });

  // AI analysis throttling to respect rate limits
  const [lastAiCallTime, setLastAiCallTime] = useState(0);
  const [aiCallTimeout, setAiCallTimeout] = useState(null);

  const [volumeChartData, setVolumeChartData] = useState({
  series: [
    { name: 'CE Volume', data: [], color: '#FF0000' }, // Red for CE volume
    { name: 'PE Volume', data: [], color: '#008000' }, // Green for PE volume
  ],
  options: {
    chart: {
      type: 'bar'
    },
    plotOptions: {
      bar: {
        horizontal: true,
        columnWidth: '70%',
      },
    },
    dataLabels: {
      enabled: true,
      offsetY: 0,
      style: { fontSize: '10px', colors: ['#000000'] },
      rotateAlways: false,
      rotation: 0,
    },
    stroke: { show: true, width: 1, colors: ['#fff'] },
    tooltip: { shared: true, intersect: false },
      xaxis: {
        categories: [],
        min: 0
      },
      yaxis: {
        min: 0
      },
    title: {
      text: 'Volume Data',
      align: 'center',
    },
  },
});

const [chartData, setChartData] = useState({
    series: [
      { name: 'CE Open Interest', data: [], color: '#FF0000' }, // Red for CE
      { name: 'PE Open Interest', data: [], color: '#008000' }, // Green for PE
      { name: 'CE Change Open Interest', data: [], color: '#FFFF00' }, // Yellow for change in CE
      { name: 'PE Change Open Interest', data: [], color: '#0000FF' }, // Blue for change in PE
    ],
    options: {
      chart: {
        type: 'bar'
      },
      plotOptions: {
        bar: {
          horizontal: true,
          columnWidth: '70%',
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetY: 0,
        style: { fontSize: '10px', colors: ['#000000'] },
        rotateAlways: false,
        rotation: 0,
      },
      stroke: { show: true, width: 1, colors: ['#fff'] },
      tooltip: { shared: true, intersect: false },
      xaxis: {
        categories: [],
        min: 0
      },
      yaxis: {
        min: 0
      },
    },
  });



  // Combined list of indices and symbols
  const indices = [
    { value: 'NIFTY', label: 'NIFTY', type: 'index' },
    { value: 'BANKNIFTY', label: 'BANKNIFTY', type: 'index' },
    { value: 'FINNIFTY', label: 'FINNIFTY', type: 'index' },
    { value: 'MIDCPNIFTY', label: 'MID CAP NIFTY', type: 'index' },
    { value: 'NIFTYNXT50', label: 'NIFTY NEXT FIFTY', type: 'index' }
  ];

  const symbols = [
    'AARTIIND', 'ABB', 'ABCAPITAL', 'ABFRL', 'ACC', 'ADANIENSOL', 'ADANIENT', 'ADANIGREEN', 'ADANIPORTS',
    'ALKEM', 'AMBUJACEM', 'ANGELONE', 'APLAPOLLO', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT',
    'ASTRAL', 'ATGL', 'AUBANK', 'AUROPHARMA', 'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV', 'BAJFINANCE',
    'BALKRISIND', 'BANDHANBNK', 'BANKBARODA', 'BANKINDIA', 'BEL', 'BERGEPAINT', 'BHARATFORG', 'BHARTIARTL',
    'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL', 'BRITANNIA', 'BSE', 'BSOFT', 'CAMS', 'CANBK', 'CDSL', 'CESC',
    'CGPOWER', 'CHAMBLFERT', 'CHOLAFIN', 'CIPLA', 'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'CROMPTON',
    'CUMMINSIND', 'CYIENT', 'DABUR', 'DALBHARAT', 'DEEPAKNTR', 'DELHIVERY', 'DIVISLAB', 'DIXON', 'DLF',
    'DMART', 'DRREDDY', 'EICHERMOT', 'ESCORTS', 'EXIDEIND', 'FEDERALBNK', 'GAIL', 'GLENMARK', 'GMRAIRPORT',
    'GODREJCP', 'GODREJPROP', 'GRANULES', 'GRASIM', 'HAL', 'HAVELLS', 'HCLTECH', 'HDFCAMC', 'HDFCBANK',
    'HDFCLIFE', 'HEROMOTOCO', 'HFCL', 'HINDALCO', 'HINDCOPPER', 'HINDPETRO', 'HINDUNILVR', 'HINDZINC',
    'HUDCO', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDEA', 'IDFCFIRSTB', 'IEX', 'IGL', 'IIFL', 'INDHOTEL',
    'INDIANB', 'INDIGO', 'INDUSINDBK', 'INDUSTOWER', 'INFY', 'INOXWIND', 'IOC', 'IRB', 'IRCTC', 'IREDA',
    'IRFC', 'ITC', 'JINDALSTEL', 'JIOFIN', 'JSL', 'JSWENERGY', 'JSWSTEEL', 'JUBLFOOD', 'KALYANKJIL', 'KEI',
    'KOTAKBANK', 'KPITTECH', 'LAURUSLABS', 'LICHSGFIN', 'LICI', 'LODHA', 'LT', 'LTF', 'LTIM', 'LUPIN',
    'M&M', 'M&MFIN', 'MANAPPURAM', 'MARICO', 'MARUTI', 'MAXHEALTH', 'MCX', 'MFSL', 'MGL', 'MOTHERSON',
    'MPHASIS', 'MRF', 'MUTHOOTFIN', 'NATIONALUM', 'NAUKRI', 'NBCC', 'NCC', 'NESTLEIND', 'NHPC', 'NMDC',
    'NTPC', 'NYKAA', 'OBEROIRLTY', 'OFSS', 'OIL', 'ONGC', 'PAGEIND', 'PATANJALI', 'PAYTM', 'PEL',
    'PERSISTENT', 'PETRONET', 'PFC', 'PHOENIXLTD', 'PIDILITIND', 'PIIND', 'PNB', 'PNBHOUSING', 'POLICYBZR',
    'POLYCAB', 'POONAWALLA', 'POWERGRID', 'PRESTIGE', 'RAMCOCEM', 'RBLBANK', 'RECLTD', 'RELIANCE', 'SAIL',
    'SBICARD', 'SBILIFE', 'SBIN', 'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SJVN', 'SOLARINDS', 'SONACOMS',
    'SRF', 'SUNPHARMA', 'SUPREMEIND', 'SYNGENE', 'TATACHEM', 'TATACOMM', 'TATACONSUM', 'TATAELXSI',
    'TATAMOTORS', 'TATAPOWER', 'TATASTEEL', 'TATATECH', 'TCS', 'TECHM', 'TIINDIA', 'TITAGARH', 'TITAN',
    'TORNTPHARM', 'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR', 'UPL', 'VBL',
    'VEDL', 'VOLTAS', 'WIPRO', 'YESBANK', 'ZOMATO', 'ZYDUSLIFE'
  ].map(sym => ({ value: sym, label: sym, type: 'symbol' }));

  const baseSymbols = symbols;
  const allSymbolItems = dynamicSymbols.length > 0 ? dynamicSymbols : baseSymbols;
  const allItems = [...indices, ...allSymbolItems];

  // Filter items based on search text
  const filteredItems = allItems.filter(item =>
    item.label.toLowerCase().includes(searchText.toLowerCase())
  );


  // Handler for search input
  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchText(value);
    setShowDropdown(value.length > 0);
  };

  // Handler for selecting from dropdown
  const handleDropdownItemClick = (item) => {
    setSearchText(item.label);
    setShowDropdown(false);
    
    if (item.type === 'index') {
      setSelectedIndex(item.value);
      setSelectedSymbol('');
      setIsIndexSelected(true);
    } else {
      setSelectedSymbol(item.value);
      setSelectedIndex('');
      setIsIndexSelected(false);
    }
  };

  // Handler for futures expiry date change
  const handleFuturesExpiryChange = (event) => {
    setSelectedFuturesExpiry(event.target.value);
  };

  // Chart control handlers
  const toggleChartOrientation = () => {
    setIsHorizontal(!isHorizontal);
  };

  const increaseStrikeRange = () => {
    setStrikeRange(prev => Math.min(prev + 1, 10)); // Max 10 strikes each side
  };

  const decreaseStrikeRange = () => {
    setStrikeRange(prev => Math.max(prev - 1, 1)); // Min 1 strike each side
  };

  // Timeframe handler for candlestick chart
  const handleTimeframeChange = (event) => {
    setSelectedTimeframe(event.target.value);
  };

  // Tab handler
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // Crypto handlers
  const handleCryptoChange = (event) => {
    setSelectedCrypto(event.target.value);
  };

  const handleCryptoTimeframeChange = (event) => {
    setCryptoTimeframe(event.target.value);
  };

  // Function to get Yahoo Finance symbol format
  const getYahooSymbol = (symbol, isIndex = false) => {
    if (isIndex) {
      const indexMap = {
        'NIFTY': '^NSEI',
        'BANKNIFTY': '^NSEBANK', 
        'FINNIFTY': '^CNXFIN',
        'MIDCPNIFTY': '^NSEMDCP50',
        'NIFTYNXT50': '^NSENEXT'
      };
      return indexMap[symbol] || symbol;
    } else {
      // For individual stocks, add .NS suffix
      return `${symbol}.NS`;
    }
  };

  // Function to get range for timeframe
  const getTimeframeRange = (timeframe) => {
    const rangeMap = {
      '5m': { interval: '5m', range: '5d' },
      '15m': { interval: '15m', range: '5d' },
      '30m': { interval: '30m', range: '5d' },
      '1h': { interval: '1h', range: '5d' }
    };
    return rangeMap[timeframe] || rangeMap['5m'];
  };

  // Function to fetch AI analysis
  const fetchAIAnalysis = async (symbol, isIndex = false) => {
    try {
      // Check rate limiting (minimum 90 seconds between calls)
      const now = Date.now();
      const timeSinceLastCall = now - lastAiCallTime;
      const minInterval = 90000; // 90 seconds
      
      if (timeSinceLastCall < minInterval) {
        // Rate limited - skip this attempt and try again on next interval
        return;
      }

      // Prepare data for AI analysis
      const currentPrice = data.records?.underlyingValue || 0;
      if (!currentPrice || !filteredData.length || !candlestickData.series[0]?.data.length) {
        // Insufficient data - skip this attempt and try again on next interval
        return;
      }

      // All prechecks passed - set loading state before making request
      setAiAnalysis(prev => ({ ...prev, loading: true }));

      // Extract OI data for AI analysis
      const oiData = {
        ceOpenInterest: filteredData.map(option => option.CE?.openInterest || 0),
        peOpenInterest: filteredData.map(option => option.PE?.openInterest || 0),
        ceChangeOpenInterest: filteredData.map(option => option.CE?.changeinOpenInterest || 0),
        peChangeOpenInterest: filteredData.map(option => option.PE?.changeinOpenInterest || 0),
        strikePrices: filteredData.map(option => option.strikePrice)
      };

      // Use candlestick data
      const candleData = candlestickData.series[0].data;
      
      const analysisPayload = {
        symbol,
        oiData,
        candlestickData: candleData,
        currentPrice,
        timeframe: selectedTimeframe,
        sentiment: liveData
      };

      console.log(`Requesting AI analysis for ${symbol} at ₹${currentPrice}`);
      
      const response = await axios.post('/api/ai-analysis', analysisPayload);
      
      setLastAiCallTime(now);
      setAiAnalysis(prev => ({
        ...prev,
        ...response.data,
        loading: false,
        error: null
      }));
      
      console.log(`AI Analysis completed: ${response.data.trend} trend with ${response.data.confidence}% confidence`);
      
    } catch (error) {
      // Silently handle AI analysis errors - no user notification
      
      let errorMessage = 'AI analysis failed';
      
      // Handle specific error types
      if (error.response?.status === 429) {
        errorMessage = 'Rate limit exceeded. AI analysis will retry automatically in ~60 seconds.';
      } else if (error.response?.status === 503) {
        errorMessage = 'AI service temporarily overloaded. Please try again in a few minutes.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setAiAnalysis(prev => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Function to fetch candlestick data via our API endpoint
  const fetchCandlestickData = async (symbol, isIndex = false) => {
    try {
      const { interval, range } = getTimeframeRange(selectedTimeframe);
      
      const response = await axios.get(`/api/candlestick-data?symbol=${symbol}&interval=${interval}&range=${range}&isIndex=${isIndex}`);
      const result = response.data;
      
      if (result && result.data && result.data.length > 0) {
        setCandlestickData(prev => ({
          ...prev,
          series: [{
            name: `${symbol} Price`,
            data: result.data
          }],
          options: {
            ...prev.options,
            title: {
              ...prev.options.title,
              text: `${symbol} - ${selectedTimeframe.toUpperCase()} Candlestick Chart`
            }
          }
        }));
        setCandlestickDataLastUpdate(new Date());
      } else {
        // Handle no data case
        setCandlestickData(prev => ({
          ...prev,
          series: [{ name: `${symbol} Price`, data: [] }],
          options: {
            ...prev.options,
            title: {
              ...prev.options.title,
              text: `${symbol} - No Data Available`
            }
          }
        }));
      }
    } catch (error) {
      // Silently retry on next interval - reset chart data on error
      // Reset chart data on error
      setCandlestickData(prev => ({
        ...prev,
        series: [{ name: `${symbol} Price`, data: [] }],
        options: {
          ...prev.options,
          title: {
            ...prev.options.title,
            text: `${symbol} - Error Loading Data`
          }
        }
      }));
    }
  };

  // Load master-quote symbols from NSE on mount
  useEffect(() => {
    axios.get('/api/master-quote')
      .then(res => {
        const raw = res.data;
        let symbolList = [];
        if (Array.isArray(raw)) {
          symbolList = raw.map(s => (typeof s === 'string' ? s : s.symbol || s.Symbol || s.name || '')).filter(Boolean);
        } else if (raw && typeof raw === 'object') {
          symbolList = Object.keys(raw);
        }
        if (symbolList.length > 0) {
          setDynamicSymbols(symbolList.map(sym => ({ value: sym, label: sym, type: 'symbol' })));
        }
      })
      .catch(() => { /* keep static list */ });
  }, []);

  // Fetch contract-info (expiry dates) when an index is selected
  useEffect(() => {
    if (!selectedIndex) return;
    setSelectedExpiry('');
    setContractInfoExpiries([]);
    axios.get(`/api/option-chain-contract-info?symbol=${selectedIndex}`)
      .then(res => {
        const expiries = res.data?.expiryDates || res.data?.records?.expiryDates || [];
        if (expiries.length > 0) {
          setContractInfoExpiries(expiries);
          setSelectedExpiry(expiries[0]);
        }
      })
      .catch(() => {});
  }, [selectedIndex]);

  // Fetch index option-chain OI data when index + expiry are ready
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!selectedIndex || !selectedExpiry || !isMounted) return;
      try {
        const response = await axios.get(
          `/api/option-chain?symbol=${selectedIndex}&type=Indices&expiry=${encodeURIComponent(selectedExpiry)}`
        );
        if (isMounted) setData(response.data);
      } catch (error) {
        // Silently retry on next interval
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedIndex, selectedExpiry]);

  // Fetch contract-info (expiry dates) when a stock symbol is selected
  useEffect(() => {
    if (!selectedSymbol) return;
    setSelectedFuturesExpiry('');
    setEquityContractInfoExpiries([]);
    axios.get(`/api/option-chain-contract-info?symbol=${selectedSymbol}`)
      .then(res => {
        const expiries = res.data?.expiryDates || res.data?.records?.expiryDates || [];
        if (expiries.length > 0) {
          setEquityContractInfoExpiries(expiries);
          setSelectedFuturesExpiry(expiries[0]);
        }
      })
      .catch(() => {});
  }, [selectedSymbol]);

  // Fetch equity option-chain OI data when symbol + expiry are ready
  useEffect(() => {
    let isMounted = true;
    const fetchFuturesData = async () => {
      if (!selectedSymbol || !selectedFuturesExpiry || !isMounted) return;
      try {
        const response = await axios.get(
          `/api/futures-data?symbol=${selectedSymbol}&type=Equity&expiry=${encodeURIComponent(selectedFuturesExpiry)}`
        );
        if (isMounted) setFuturesData(response.data);
      } catch (error) {
        // Silently retry on next interval
      }
    };

    fetchFuturesData();
    const intervalId = setInterval(fetchFuturesData, 10000);
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedSymbol, selectedFuturesExpiry]);

  // Filter the data based on the selected expiry date
  useEffect(() => {
    if (data && selectedExpiry) {
      const options = data.records?.data || [];
      const filtered = options.filter(
        (option) => option.expiryDate === selectedExpiry
      );
      setFilteredData(filtered);
    }
  }, [selectedExpiry, data]);

  // Filter futures data based on the selected expiry date
  useEffect(() => {
    if (futuresData && selectedFuturesExpiry) {
      const filtered = futuresData.records?.data?.filter(
        (item) => item.expiryDate === selectedFuturesExpiry
      ) || [];
      setFilteredFuturesData(filtered);
    }
  }, [selectedFuturesExpiry, futuresData]);

  // Update chart data and compute PCR when filtered data changes
  useEffect(() => {
    if (filteredData.length > 0) {
      // Get the underlying value (if available)
      const underlyingValue = data.records?.underlyingValue || 0;

      // Sort filtered data by strike price in descending order first
      const sortedFilteredData = [...filteredData].sort((a, b) => b.strikePrice - a.strikePrice);

      // Extract strike prices from the sorted filtered data
      const strikePrices = sortedFilteredData.map((option) => option.strikePrice);

      // Find the closest strike price to the underlying value
      const closestStrikePrice = strikePrices.reduce((prev, curr) =>
        Math.abs(curr - underlyingValue) < Math.abs(prev - underlyingValue)
          ? curr
          : prev
      );
      const currentIndex = strikePrices.indexOf(closestStrikePrice);

      // Select a range of strike prices based on strikeRange setting
      const start = Math.max(0, currentIndex - strikeRange);
      const end = Math.min(sortedFilteredData.length, currentIndex + strikeRange + 1);
      const filteredStrikeRange = sortedFilteredData.slice(start, end);

      // Map out the open interest and change in open interest values
      const ceOpenInterest = filteredStrikeRange.map(
        (option) => option.CE?.openInterest || 0
      );
      const peOpenInterest = filteredStrikeRange.map(
        (option) => option.PE?.openInterest || 0
      );
      const ceChangeOpenInterest = filteredStrikeRange.map(
        (option) => option.CE?.changeinOpenInterest || 0
      );
      const peChangeOpenInterest = filteredStrikeRange.map(
        (option) => option.PE?.changeinOpenInterest || 0
      );
      const ceVolume = filteredStrikeRange.map(
        (option) => option.CE?.totalTradedVolume || 0
      );
      const peVolume = filteredStrikeRange.map(
        (option) => option.PE?.totalTradedVolume || 0
      );

      // Calculate total open interests and then PCR
      const totalCEOI = ceOpenInterest.reduce((sum, oi) => sum + oi, 0);
      const totalPEOI = peOpenInterest.reduce((sum, oi) => sum + oi, 0);
      const pcrValue = totalCEOI > 0 ? (totalPEOI / totalCEOI).toFixed(2) : "N/A";

      // Calculate Net Effect and Sentiment for current strike price only
      const currentStrikeData = filteredStrikeRange.find(option => option.strikePrice === closestStrikePrice);
      let netEffect = 0;
      let sentiment = "Neutral";
      
      if (currentStrikeData) {
        const ceChange = currentStrikeData.CE?.changeinOpenInterest || 0;
        const peChange = currentStrikeData.PE?.changeinOpenInterest || 0;
        const ceOI = currentStrikeData.CE?.openInterest || 0;
        const peOI = currentStrikeData.PE?.openInterest || 0;
        
        netEffect = (ceChange * ceOI) - (peChange * peOI);
        
        if (netEffect > 0) sentiment = "Bullish";
        else if (netEffect < 0) sentiment = "Bearish";
      }

      // Compare with previous series values and store the percentage change.
      const newSeries = [
        { name: 'CE Open Interest', data: ceOpenInterest, color: '#FF0000' }, // Red for CE
        { name: 'PE Open Interest', data: peOpenInterest, color: '#008000' }, // Green for PE
        { name: 'CE Change Open Interest', data: ceChangeOpenInterest, color: '#FFFF00' }, // Yellow for change in CE
        { name: 'PE Change Open Interest', data: peChangeOpenInterest, color: '#0000FF' }, // Blue for change in PE
        { name: 'CE Volume', data: ceVolume, color: '#FF0000' },
        { name: 'PE Volume', data: peVolume, color: '#008000' },
      ];


      // Update the chart data with the new series and categories
      setChartData((prev) => ({
        ...prev,
        series: newSeries.slice(0, 4), // Only take OI related series
        options: {
          ...prev.options,
          plotOptions: {
            bar: {
              horizontal: isHorizontal,
              columnWidth: '70%',
              dataLabels: { position: 'top' },
            },
          },
          dataLabels: {
            enabled: true,
            offsetY: 0,
            style: { fontSize: '10px', colors: ['#000000'] },
            rotateAlways: !isHorizontal,
            rotation: isHorizontal ? 0 : 270,
          },
          xaxis: { categories: filteredStrikeRange.map(option => option.strikePrice) },
        },
      }));
      setOiDataLastUpdate(new Date());

      // Update volume chart
      setVolumeChartData((prev) => ({
        ...prev,
        series: [
          { name: 'CE Volume', data: ceVolume, color: '#FF0000' },
          { name: 'PE Volume', data: peVolume, color: '#008000' },
        ],
        options: {
          ...prev.options,
          plotOptions: {
            bar: {
              horizontal: isHorizontal,
              columnWidth: '70%',
            },
          },
          dataLabels: {
            enabled: true,
            offsetY: 0,
            style: { fontSize: '10px', colors: ['#000000'] },
            rotateAlways: !isHorizontal,
            rotation: isHorizontal ? 0 : 270,
          },
          xaxis: { categories: filteredStrikeRange.map(option => option.strikePrice) },
        },
      }));

      // Store them in state
      setPcr(pcrValue);
      setLiveData({ netEffect, sentiment });
    }
  }, [filteredData, data, strikeRange, isHorizontal]);

  // Update chart data when filtered futures data changes
  useEffect(() => {
    if (filteredFuturesData.length > 0) {
      // Sort filtered futures data by strike price in descending order first
      const sortedFilteredFuturesData = [...filteredFuturesData].sort((a, b) => b.strikePrice - a.strikePrice);

      // Extract strike prices from the sorted filtered futures data
      const strikePrices = sortedFilteredFuturesData.map((item) => item.strikePrice);

      // Get the underlying value (if available)
      const underlyingValue = futuresData.records?.underlyingValue || 0;

      // Find the closest strike price to the underlying value
      const closestStrikePrice = strikePrices.reduce((prev, curr) =>
        Math.abs(curr - underlyingValue) < Math.abs(prev - underlyingValue)
          ? curr
          : prev
      );
      const currentIndex = strikePrices.indexOf(closestStrikePrice);

      // Select a range of strike prices based on strikeRange setting
      const start = Math.max(0, currentIndex - strikeRange);
      const end = Math.min(sortedFilteredFuturesData.length, currentIndex + strikeRange + 1);
      const filteredStrikeRange = sortedFilteredFuturesData.slice(start, end);

      // Map out the open interest and change in open interest values for CE and PE
      const ceOpenInterest = filteredStrikeRange.map(
        (item) => item.CE?.openInterest || 0
      );
      const peOpenInterest = filteredStrikeRange.map(
        (item) => item.PE?.openInterest || 0
      );
      const ceChangeOpenInterest = filteredStrikeRange.map(
        (item) => item.CE?.changeinOpenInterest || 0
      );
      const peChangeOpenInterest = filteredStrikeRange.map(
        (item) => item.PE?.changeinOpenInterest || 0
      );

      // Update the chart data with the new series and categories
      setChartData(prevChartData => ({
        ...prevChartData,
        series: [
          { name: 'CE Open Interest (Futures)', data: ceOpenInterest, color: '#FF0000' }, // Red for CE
          { name: 'PE Open Interest (Futures)', data: peOpenInterest, color: '#008000' }, // Green for PE
          { name: 'CE Change Open Interest (Futures)', data: ceChangeOpenInterest, color: '#FFFF00' }, // Yellow for change in CE
          { name: 'PE Change Open Interest (Futures)', data: peChangeOpenInterest, color: '#0000FF' }, // Blue for change in PE
        ],
        options: {
          ...prevChartData.options,
          plotOptions: {
            bar: {
              horizontal: isHorizontal,
              columnWidth: '70%',
              dataLabels: { position: 'top' },
            },
          },
          dataLabels: {
            enabled: true,
            offsetY: 0,
            style: { fontSize: '10px', colors: ['#000000'] },
            rotateAlways: !isHorizontal,
            rotation: isHorizontal ? 0 : 270,
          },
          xaxis: { categories: filteredStrikeRange.map((item) => item.strikePrice) },
        },
      }));
      setOiDataLastUpdate(new Date());
    }
  }, [filteredFuturesData, futuresData, strikeRange, isHorizontal]);

  // Update chart data when filtered data changes (for PCR and Net Effect)
  useEffect(() => {
    if (filteredData.length > 0) {
      const underlyingValue = data.records?.underlyingValue || 0;
      const sortedFilteredData = [...filteredData].sort((a, b) => b.strikePrice - a.strikePrice);
      const strikePrices = sortedFilteredData.map((option) => option.strikePrice);
      const closestStrikePrice = strikePrices.reduce((prev, curr) =>
        Math.abs(curr - underlyingValue) < Math.abs(prev - underlyingValue) ? curr : prev
      );
      const currentIndex = strikePrices.indexOf(closestStrikePrice);
      const start = Math.max(0, currentIndex - strikeRange);
      const end = Math.min(sortedFilteredData.length, currentIndex + strikeRange + 1);
      const filteredStrikeRange = sortedFilteredData.slice(start, end);

      const ceOpenInterest = filteredStrikeRange.map((option) => option.CE?.openInterest || 0);
      const peOpenInterest = filteredStrikeRange.map((option) => option.PE?.openInterest || 0);
      const totalCEOI = ceOpenInterest.reduce((sum, oi) => sum + oi, 0);
      const totalPEOI = peOpenInterest.reduce((sum, oi) => sum + oi, 0);
      const pcrValue = totalCEOI > 0 ? (totalPEOI / totalCEOI).toFixed(2) : "N/A";

      // Calculate Net Effect and Sentiment for current strike price only
      const currentStrikeData = filteredStrikeRange.find(option => option.strikePrice === closestStrikePrice);
      let netEffect = 0;
      let sentiment = "Neutral";
      
      if (currentStrikeData) {
        const ceChange = currentStrikeData.CE?.changeinOpenInterest || 0;
        const peChange = currentStrikeData.PE?.changeinOpenInterest || 0;
        const ceOI = currentStrikeData.CE?.openInterest || 0;
        const peOI = currentStrikeData.PE?.openInterest || 0;
        
        netEffect = (ceChange * ceOI) - (peChange * peOI);
        
        if (netEffect > 0) sentiment = "Bullish";
        else if (netEffect < 0) sentiment = "Bearish";
      }

      setPcr(pcrValue);
      setLiveData({ netEffect, sentiment });
    }
  }, [filteredData, data, strikeRange]);

  // Fetch candlestick data when selectedIndex, selectedSymbol, or selectedTimeframe changes
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!isMounted) return;
      
      // Determine which symbol to use and whether it's an index
      let symbolToFetch = null;
      let isIndex = false;
      
      if (selectedIndex) {
        symbolToFetch = selectedIndex;
        isIndex = true;
      } else if (selectedSymbol) {
        symbolToFetch = selectedSymbol;
        isIndex = false;
      }
      
      if (symbolToFetch) {
        await fetchCandlestickData(symbolToFetch, isIndex);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 30000); // Fetch every 30 seconds for candlestick data
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedIndex, selectedSymbol, selectedTimeframe]);

  // Function to fetch crypto data
  const fetchCryptoData = async (symbol, timeframe) => {
    try {
      const response = await axios.get(`/api/crypto-data?symbol=${symbol}&timeframe=${timeframe}`);
      const result = response.data;
      
      if (result && result.data && result.data.length > 0) {
        setCryptoData(prev => ({
          ...prev,
          series: [{
            name: `${symbol} Price`,
            data: result.data
          }],
          options: {
            ...prev.options,
            title: {
              ...prev.options.title,
              text: `${symbol} - ${timeframe.toUpperCase()} Crypto Chart`
            }
          }
        }));
        setCryptoDataLastUpdate(new Date());
        
        // Set current price from the latest data point
        const latestData = result.data[result.data.length - 1];
        if (latestData && latestData.y && latestData.y.length >= 4) {
          setCryptoCurrentPrice(latestData.y[3]); // Close price
        }
      } else {
        setCryptoData(prev => ({
          ...prev,
          series: [{ name: `${symbol} Price`, data: [] }],
          options: {
            ...prev.options,
            title: {
              ...prev.options.title,
              text: `${symbol} - No Data Available`
            }
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching crypto data:', error);
      setCryptoData(prev => ({
        ...prev,
        series: [{ name: `${symbol} Price`, data: [] }],
        options: {
          ...prev.options,
          title: {
            ...prev.options.title,
            text: `${symbol} - Error Loading Data`
          }
        }
      }));
    }
  };

  // Function to fetch crypto AI analysis
  const fetchCryptoAIAnalysis = async (symbol) => {
    try {
      if (cryptoAiAnalysis.loading) {
        return;
      }

      if (!cryptoData.series[0]?.data.length || !cryptoCurrentPrice) {
        return;
      }

      setCryptoAiAnalysis(prev => ({ ...prev, loading: true }));

      const analysisPayload = {
        symbol,
        candlestickData: cryptoData.series[0].data,
        currentPrice: cryptoCurrentPrice,
        timeframe: cryptoTimeframe,
        type: 'crypto'
      };

      console.log(`Requesting crypto AI analysis for ${symbol} at $${cryptoCurrentPrice}`);
      
      const response = await axios.post('/api/crypto-ai-analysis', analysisPayload);
      
      setCryptoAiAnalysis(prev => ({
        ...prev,
        ...response.data,
        loading: false,
        error: null
      }));
      
      console.log(`Crypto AI Analysis completed: ${response.data.trend} trend with ${response.data.confidence}% confidence`);
      
    } catch (error) {
      console.error('Crypto AI analysis error:', error);
      setCryptoAiAnalysis(prev => ({
        ...prev,
        loading: false
      }));
    }
  };

  // Manual crypto AI analysis trigger
  const handleCryptoAIAnalysis = () => {
    if (cryptoAiAnalysis.loading) {
      return;
    }
    
    if (selectedCrypto && cryptoData.series[0]?.data.length > 0) {
      fetchCryptoAIAnalysis(selectedCrypto);
    }
  };

  // Fetch crypto data when crypto parameters change
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!selectedCrypto || !cryptoTimeframe || !isMounted || activeTab !== 'crypto') return;
      
      await fetchCryptoData(selectedCrypto, cryptoTimeframe);
    };

    fetchData();
    const intervalId = setInterval(fetchData, 30000); // Fetch every 30 seconds
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedCrypto, cryptoTimeframe, activeTab]);

  // Manual AI analysis trigger
  const handleManualAIAnalysis = () => {
    // Don't allow multiple concurrent requests
    if (aiAnalysis.loading) {
      return;
    }
    
    // Determine which symbol to analyze and whether it's an index
    let symbolToAnalyze = null;
    let isIndex = false;
    
    if (selectedIndex && data.records?.data?.length > 0 && filteredData.length > 0) {
      symbolToAnalyze = selectedIndex;
      isIndex = true;
    } else if (selectedSymbol && futuresData?.records?.data?.length > 0 && filteredFuturesData.length > 0) {
      symbolToAnalyze = selectedSymbol;
      isIndex = false;
    }
    
    // Only proceed if we have both candlestick data and OI data
    if (symbolToAnalyze && candlestickData.series[0]?.data.length > 0) {
      fetchAIAnalysis(symbolToAnalyze, isIndex);
    }
  };

  // Update chart orientation when isHorizontal changes
  useEffect(() => {
    setChartData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        plotOptions: {
          bar: {
            horizontal: isHorizontal,
            columnWidth: '70%',
            dataLabels: { position: 'top' },
          },
        },
        dataLabels: {
          enabled: true,
          offsetY: 0,
          style: { fontSize: '10px', colors: ['#000000'] },
          rotateAlways: !isHorizontal,
          rotation: isHorizontal ? 0 : 270,
        },
      },
    }));

    setVolumeChartData(prev => ({
      ...prev,
      options: {
        ...prev.options,
        plotOptions: {
          bar: {
            horizontal: isHorizontal,
            columnWidth: '70%',
          },
        },
        dataLabels: {
          enabled: true,
          offsetY: 0,
          style: { fontSize: '10px', colors: ['#000000'] },
          rotateAlways: !isHorizontal,
          rotation: isHorizontal ? 0 : 270,
        },
      },
    }));
  }, [isHorizontal]);

  // Handler for expiry date change
  const handleExpiryChange = (event) => {
    setSelectedExpiry(event.target.value);
  };

  // Use contract-info expiry dates (from API) when available, fall back to extracting from data
  const expiryDates = contractInfoExpiries.length > 0
    ? contractInfoExpiries
    : Array.from(
        new Set((data.records?.data || []).map((option) => option.expiryDate))
      ).sort((a, b) => new Date(a) - new Date(b));

  



  return (
    <div>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        backgroundColor: '#f8f9fa',
        borderBottom: '2px solid #e9ecef',
        marginBottom: '20px'
      }}>
        <button
          onClick={() => handleTabChange('indian-stocks')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: activeTab === 'indian-stocks' ? '#007bff' : 'transparent',
            color: activeTab === 'indian-stocks' ? 'white' : '#007bff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.3s ease'
          }}
        >
          📊 Indian Stock Market
        </button>
        <button
          onClick={() => handleTabChange('crypto')}
          style={{
            padding: '12px 24px',
            border: 'none',
            backgroundColor: activeTab === 'crypto' ? '#007bff' : 'transparent',
            color: activeTab === 'crypto' ? 'white' : '#007bff',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.3s ease'
          }}
        >
          ₿ Crypto
        </button>
      </div>

      {/* Indian Stock Market Tab */}
      {activeTab === 'indian-stocks' && (
        <div>
          {/* Search and Expiry in One Line */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            {/* Search with Autocomplete Dropdown */}
            <div style={{ flex: '1', position: 'relative', minWidth: '200px' }}>
              <label htmlFor="search-input" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                Search Symbol or Index:
              </label>
              <input
                id="search-input"
                type="text"
                value={searchText}
                onChange={handleSearchChange}
                onFocus={() => searchText.length > 0 && setShowDropdown(true)}
                placeholder="Type to search index or symbol..."
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '2px solid #007bff',
                  borderRadius: '6px',
                  outline: 'none'
                }}
              />
              
              {/* Autocomplete Dropdown */}
              {showDropdown && filteredItems.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  marginTop: '4px'
                }}>
                  {filteredItems.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleDropdownItemClick(item)}
                      style={{
                        padding: '10px 12px',
                        cursor: 'pointer',
                        borderBottom: index < filteredItems.length - 1 ? '1px solid #f0f0f0' : 'none',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f0f8ff'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      <span style={{ fontWeight: '500' }}>{item.label}</span>
                      <span style={{
                        marginLeft: '8px',
                        fontSize: '12px',
                        color: item.type === 'index' ? '#007bff' : '#28a745',
                        backgroundColor: item.type === 'index' ? '#e7f3ff' : '#d4edda',
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {item.type === 'index' ? 'Index' : 'Stock'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* No results message */}
              {showDropdown && searchText.length > 0 && filteredItems.length === 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  width: '100%',
                  backgroundColor: 'white',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  marginTop: '4px',
                  padding: '10px 12px',
                  color: '#666'
                }}>
                  No matching symbols or indices found
                </div>
              )}
            </div>

            {/* Expiry Date Selection - Shows for both Index (Options) and Symbol (Futures) */}
            {selectedIndex && data.records && (
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label htmlFor="expiry-date" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Select Expiry Date:
                </label>
                <select 
                  id="expiry-date" 
                  value={selectedExpiry} 
                  onChange={handleExpiryChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">-- Select --</option>
                  {expiryDates.map((date, index) => (
                    <option key={index} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedSymbol && equityContractInfoExpiries.length > 0 && (
              <div style={{ flex: '1', minWidth: '200px' }}>
                <label htmlFor="futures-expiry-date" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Select Expiry Date:
                </label>
                <select
                  id="futures-expiry-date"
                  value={selectedFuturesExpiry}
                  onChange={handleFuturesExpiryChange}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">-- Select --</option>
                  {equityContractInfoExpiries.map((date, index) => (
                    <option key={index} value={date}>
                      {date}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

      <div style={{ marginTop: "20px" }}>
        <h3>PCR: {pcr}</h3>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={toggleChartOrientation}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {isHorizontal ? 'Switch to Vertical' : 'Switch to Horizontal'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Strike Range:</span>
          <button
            onClick={decreaseStrikeRange}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            -
          </button>
          <span style={{ minWidth: '20px', textAlign: 'center' }}>{strikeRange}</span>
          <button
            onClick={increaseStrikeRange}
            style={{
              padding: '4px 8px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            +
          </button>
        </div>
      </div>

      {/* PCR Display */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        margin: '20px 0',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <strong>PCR:</strong>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
            {pcr || 'N/A'}
          </div>
        </div>
      </div>

      <div>
        {/* Open Interest Chart */}
        <div style={{ marginBottom: '10px' }}>
          <ReactApexChart
            options={chartData.options}
            series={chartData.series}
            type="bar"
            height={Math.max(500, (strikeRange * 2 + 1) * 50 + 150)}
          />
          {oiDataLastUpdate && (
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#6c757d', marginTop: '5px' }}>
              Last OI Data Update: {new Date(oiDataLastUpdate).toLocaleString()}
            </div>
          )}
        </div>

        {/* AI Analysis Display */}
        <div style={{
          margin: '20px 0',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '10px',
          border: '2px solid #e9ecef'
        }}>
          <h3 style={{ 
            textAlign: 'center', 
            marginBottom: '15px',
            color: '#495057',
            fontSize: '18px',
            fontWeight: 'bold'
          }}>
            🤖 AI Market Analysis
          </h3>
          
          {/* Manual AI Analysis Button */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <button
              onClick={handleManualAIAnalysis}
              disabled={aiAnalysis.loading}
              style={{
                backgroundColor: aiAnalysis.loading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: aiAnalysis.loading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.3s ease'
              }}
            >
              {aiAnalysis.loading ? '🧠 Analyzing...' : '🔍 Analyze with AI'}
            </button>
          </div>
          
          {aiAnalysis.loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '16px', color: '#6c757d' }}>
                🧠 Analyzing market data...
              </div>
            </div>
          )}


          {!aiAnalysis.loading && aiAnalysis.analysis && (
            <div>
              {/* Trend and Confidence */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-around',
                marginBottom: '20px',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div style={{ 
                  textAlign: 'center',
                  backgroundColor: aiAnalysis.trend === 'BULLISH' ? '#d4edda' : 
                                 aiAnalysis.trend === 'BEARISH' ? '#f8d7da' : '#fff3cd',
                  padding: '10px',
                  borderRadius: '8px',
                  minWidth: '120px'
                }}>
                  <strong>Trend</strong>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    color: aiAnalysis.trend === 'BULLISH' ? '#155724' : 
                           aiAnalysis.trend === 'BEARISH' ? '#721c24' : '#856404'
                  }}>
                    {aiAnalysis.trend === 'BULLISH' ? '📈 BULLISH' : 
                     aiAnalysis.trend === 'BEARISH' ? '📉 BEARISH' : 
                     aiAnalysis.trend === 'VOLATILE' ? '⚡ VOLATILE' : '➡️ NEUTRAL'}
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', backgroundColor: '#e2e3e5', padding: '10px', borderRadius: '8px', minWidth: '120px' }}>
                  <strong>Confidence</strong>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#495057' }}>
                    {aiAnalysis.confidence}%
                  </div>
                </div>

                <div style={{ textAlign: 'center', backgroundColor: '#cce5ff', padding: '10px', borderRadius: '8px', minWidth: '120px' }}>
                  <strong>Risk Level</strong>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold',
                    color: aiAnalysis.riskLevel === 'HIGH' ? '#721c24' : 
                           aiAnalysis.riskLevel === 'MEDIUM' ? '#856404' : '#155724'
                  }}>
                    {aiAnalysis.riskLevel}
                  </div>
                </div>
              </div>

              {/* Trading Levels */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '15px',
                marginBottom: '20px'
              }}>
                <div style={{ textAlign: 'center', backgroundColor: '#d1ecf1', padding: '12px', borderRadius: '8px' }}>
                  <strong>Entry Level</strong>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0c5460' }}>
                    ₹{aiAnalysis.entryLevel?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', backgroundColor: '#f8d7da', padding: '12px', borderRadius: '8px' }}>
                  <strong>Stop Loss</strong>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#721c24' }}>
                    ₹{aiAnalysis.stopLoss?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', backgroundColor: '#d4edda', padding: '12px', borderRadius: '8px' }}>
                  <strong>Target 1</strong>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
                    ₹{aiAnalysis.target1?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                
                {aiAnalysis.target2 && aiAnalysis.target2 > 0 && (
                  <div style={{ textAlign: 'center', backgroundColor: '#d4edda', padding: '12px', borderRadius: '8px' }}>
                    <strong>Target 2</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
                      ₹{aiAnalysis.target2.toFixed(2)}
                    </div>
                  </div>
                )}
              </div>

              {/* Strategy and Analysis */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px',
                marginBottom: '15px'
              }}>
                {aiAnalysis.strategy && (
                  <div style={{ backgroundColor: '#fff3cd', padding: '12px', borderRadius: '8px' }}>
                    <strong>Strategy:</strong>
                    <div style={{ marginTop: '5px', fontSize: '14px' }}>
                      {aiAnalysis.strategy}
                    </div>
                  </div>
                )}
                
                {aiAnalysis.riskReward && (
                  <div style={{ backgroundColor: '#e2e3e5', padding: '12px', borderRadius: '8px' }}>
                    <strong>Risk:Reward Ratio:</strong>
                    <div style={{ marginTop: '5px', fontSize: '16px', fontWeight: 'bold' }}>
                      {aiAnalysis.riskReward}
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Text */}
              {aiAnalysis.analysis && (
                <div style={{
                  backgroundColor: '#ffffff',
                  padding: '15px',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}>
                  <strong>💡 Analysis:</strong>
                  <div style={{ marginTop: '8px' }}>
                    {aiAnalysis.analysis}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              {aiAnalysis.timestamp && (
                <div style={{ 
                  textAlign: 'center', 
                  fontSize: '12px', 
                  color: '#6c757d',
                  marginTop: '15px'
                }}>
                  Last Updated: {new Date(aiAnalysis.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Candlestick Chart - Lightweight Charts */}
        <div style={{ marginBottom: '10px' }}>
          {/* Timeframe Selector for Candlestick Chart */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#e8f4f8', padding: '8px', borderRadius: '4px', marginBottom: '10px' }}>
            <label htmlFor="timeframe-select" style={{ fontSize: '14px', fontWeight: 'bold' }}>
              Candlestick Timeframe:
            </label>
            <select 
              id="timeframe-select" 
              value={selectedTimeframe} 
              onChange={handleTimeframeChange}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontSize: '14px',
                backgroundColor: 'white'
              }}
            >
              <option value="5m">5 Minutes</option>
              <option value="15m">15 Minutes</option>
              <option value="30m">30 Minutes</option>
              <option value="1h">1 Hour</option>
            </select>
          </div>
          
          <LightweightChart
            data={candlestickData.series[0]?.data || []}
            title={`${candlestickData.options.title?.text || 'Price Chart'} (${selectedTimeframe})`}
            currencySymbol="₹"
          />
          {candlestickDataLastUpdate && (
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#6c757d', marginTop: '5px' }}>
              Last Candlestick Data Update: {new Date(candlestickDataLastUpdate).toLocaleString()}
            </div>
          )}
        </div>
        
        {/* Volume Chart */}
        <div>
          <ReactApexChart
            options={volumeChartData.options}
            series={volumeChartData.series}
            type="bar"
            height={Math.max(400, (strikeRange * 2 + 1) * 40 + 100)}
          />
        </div>
      </div>
        </div>
      )}

      {/* Crypto Tab */}
      {activeTab === 'crypto' && (
        <div>
          {/* Crypto AI Analysis Section */}
          <div style={{
            margin: '20px 0',
            padding: '20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '10px',
            border: '2px solid #e9ecef'
          }}>
            <h3 style={{ 
              textAlign: 'center', 
              marginBottom: '15px',
              color: '#495057',
              fontSize: '18px',
              fontWeight: 'bold'
            }}>
              🤖 Crypto AI Analysis
            </h3>
            
            {/* Manual Crypto AI Analysis Button */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <button
                onClick={handleCryptoAIAnalysis}
                disabled={cryptoAiAnalysis.loading}
                style={{
                  backgroundColor: cryptoAiAnalysis.loading ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: cryptoAiAnalysis.loading ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.3s ease'
                }}
              >
                {cryptoAiAnalysis.loading ? '🧠 Analyzing...' : '🔍 Analyze with AI'}
              </button>
            </div>
            
            {cryptoAiAnalysis.loading && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div style={{ fontSize: '16px', color: '#6c757d' }}>
                  🧠 Analyzing crypto market data...
                </div>
              </div>
            )}

            {!cryptoAiAnalysis.loading && cryptoAiAnalysis.analysis && (
              <div>
                {/* Trend and Confidence */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  marginBottom: '20px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    backgroundColor: cryptoAiAnalysis.trend === 'BULLISH' ? '#d4edda' : 
                                   cryptoAiAnalysis.trend === 'BEARISH' ? '#f8d7da' : '#fff3cd',
                    padding: '10px',
                    borderRadius: '8px',
                    minWidth: '120px'
                  }}>
                    <strong>Trend</strong>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 'bold',
                      color: cryptoAiAnalysis.trend === 'BULLISH' ? '#155724' : 
                             cryptoAiAnalysis.trend === 'BEARISH' ? '#721c24' : '#856404'
                    }}>
                      {cryptoAiAnalysis.trend === 'BULLISH' ? '📈 BULLISH' : 
                       cryptoAiAnalysis.trend === 'BEARISH' ? '📉 BEARISH' : 
                       cryptoAiAnalysis.trend === 'VOLATILE' ? '⚡ VOLATILE' : '➡️ NEUTRAL'}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center', backgroundColor: '#e2e3e5', padding: '10px', borderRadius: '8px', minWidth: '120px' }}>
                    <strong>Confidence</strong>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#495057' }}>
                      {cryptoAiAnalysis.confidence}%
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', backgroundColor: '#cce5ff', padding: '10px', borderRadius: '8px', minWidth: '120px' }}>
                    <strong>Risk Level</strong>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 'bold',
                      color: cryptoAiAnalysis.riskLevel === 'HIGH' ? '#721c24' : 
                             cryptoAiAnalysis.riskLevel === 'MEDIUM' ? '#856404' : '#155724'
                    }}>
                      {cryptoAiAnalysis.riskLevel}
                    </div>
                  </div>
                </div>

                {/* Trading Levels */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '15px',
                  marginBottom: '20px'
                }}>
                  <div style={{ textAlign: 'center', backgroundColor: '#d1ecf1', padding: '12px', borderRadius: '8px' }}>
                    <strong>Entry Level</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0c5460' }}>
                      ${cryptoAiAnalysis.entryLevel?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center', backgroundColor: '#f8d7da', padding: '12px', borderRadius: '8px' }}>
                    <strong>Stop Loss</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#721c24' }}>
                      ${cryptoAiAnalysis.stopLoss?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  
                  <div style={{ textAlign: 'center', backgroundColor: '#d4edda', padding: '12px', borderRadius: '8px' }}>
                    <strong>Target 1</strong>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
                      ${cryptoAiAnalysis.target1?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  
                  {cryptoAiAnalysis.target2 && cryptoAiAnalysis.target2 > 0 && (
                    <div style={{ textAlign: 'center', backgroundColor: '#d4edda', padding: '12px', borderRadius: '8px' }}>
                      <strong>Target 2</strong>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#155724' }}>
                        ${cryptoAiAnalysis.target2.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Strategy and Analysis */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '15px',
                  marginBottom: '15px'
                }}>
                  {cryptoAiAnalysis.strategy && (
                    <div style={{ backgroundColor: '#fff3cd', padding: '12px', borderRadius: '8px' }}>
                      <strong>Strategy:</strong>
                      <div style={{ marginTop: '5px', fontSize: '14px' }}>
                        {cryptoAiAnalysis.strategy}
                      </div>
                    </div>
                  )}
                  
                  {cryptoAiAnalysis.riskReward && (
                    <div style={{ backgroundColor: '#e2e3e5', padding: '12px', borderRadius: '8px' }}>
                      <strong>Risk:Reward Ratio:</strong>
                      <div style={{ marginTop: '5px', fontSize: '16px', fontWeight: 'bold' }}>
                        {cryptoAiAnalysis.riskReward}
                      </div>
                    </div>
                  )}
                </div>

                {/* Analysis Text */}
                {cryptoAiAnalysis.analysis && (
                  <div style={{
                    backgroundColor: '#ffffff',
                    padding: '15px',
                    borderRadius: '8px',
                    border: '1px solid #dee2e6',
                    fontSize: '14px',
                    lineHeight: '1.5'
                  }}>
                    <strong>💡 Analysis:</strong>
                    <div style={{ marginTop: '8px' }}>
                      {cryptoAiAnalysis.analysis}
                    </div>
                  </div>
                )}

                {/* Timestamp */}
                {cryptoAiAnalysis.timestamp && (
                  <div style={{ 
                    textAlign: 'center', 
                    fontSize: '12px', 
                    color: '#6c757d',
                    marginTop: '15px'
                  }}>
                    Last Updated: {new Date(cryptoAiAnalysis.timestamp).toLocaleString()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Crypto Controls */}
          <div style={{ marginBottom: '20px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label htmlFor="crypto-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
                Select Crypto:
              </label>
              <select 
                id="crypto-select" 
                value={selectedCrypto} 
                onChange={handleCryptoChange}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  minWidth: '150px'
                }}
              >
                <option value="BTCUSDT">BTC/USD</option>
                <option value="ETHUSDT">ETH/USD</option>
              </select>
            </div>

            <div>
              <label htmlFor="crypto-timeframe-select" style={{ marginRight: '10px', fontWeight: 'bold' }}>
                Timeframe:
              </label>
              <select 
                id="crypto-timeframe-select" 
                value={cryptoTimeframe} 
                onChange={handleCryptoTimeframeChange}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '14px',
                  backgroundColor: 'white',
                  minWidth: '120px'
                }}
              >
                <option value="1h">1 Hour</option>
                <option value="2h">2 Hours</option>
                <option value="5h">5 Hours</option>
                <option value="10h">10 Hours</option>
                <option value="1d">1 Day</option>
              </select>
            </div>
          </div>

          {/* Crypto Current Price Display */}
          {cryptoCurrentPrice > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '20px',
              padding: '15px',
              backgroundColor: '#f5f5f5',
              borderRadius: '8px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <strong>Current Price:</strong>
                <div style={{ 
                  fontSize: '24px', 
                  color: '#007bff',
                  fontWeight: 'bold'
                }}>
                  ${cryptoCurrentPrice.toFixed(2)}
                </div>
              </div>
            </div>
          )}

          {/* Crypto Chart */}
          <div style={{ marginBottom: '10px' }}>
            <LightweightChart
              data={cryptoData.series[0]?.data || []}
              title={cryptoData.options.title?.text || 'Crypto Price Chart'}
              currencySymbol="$"
            />
            {cryptoDataLastUpdate && (
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#6c757d', marginTop: '5px' }}>
                Last Crypto Data Update: {new Date(cryptoDataLastUpdate).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
