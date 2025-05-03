import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

/**
 * Adjust the brightness of a hex color.
 * If factor < 1 the color is darkened; if factor > 1 the color is lightened.
 */
function adjustColorBrightness(hex, factor) {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color.split('').map(ch => ch + ch).join('');
  }
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);

  r = Math.min(255, Math.max(0, Math.floor(r * factor)));
  g = Math.min(255, Math.max(0, Math.floor(g * factor)));
  b = Math.min(255, Math.max(0, Math.floor(b * factor)));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)
    .toUpperCase()}`;
}

/**
 * For increases: map a percentage change (0 to maxPct) to a darkening factor.
 * At 0% change, factor = 1; at maxPct change, factor = 0.7.
 */
function getDarkenFactor(pct) {
  const maxPct = 0.5;
  const ratio = Math.min(pct, maxPct) / maxPct; // value between 0 and 1
  return 1 - 0.3 * ratio; // from 1 to 0.7
}

/**
 * For decreases: map a percentage change (0 to maxPct) to a lightening factor.
 * At 0% change, factor = 1; at maxPct change, factor = 1.3.
 */
function getLightenFactor(pct) {
  const maxPct = 0.5;
  const ratio = Math.min(pct, maxPct) / maxPct;
  return 1 + 0.3 * ratio; // from 1 to 1.3
}

export default function Landing() {
  const [data, setData] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState('');
  const [pcr, setPcr] = useState('');
  const [liveData, setLiveData] = useState('');
  const [volumeChartData, setVolumeChartData] = useState({
  series: [
    { name: 'CE Volume', data: [], color: '#FF69B4' }, // Pink for CE volume
    { name: 'PE Volume', data: [], color: '#4B0082' }, // Indigo for PE volume
  ],
  options: {
    chart: { 
      type: 'bar',
      height: 300
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
      rotateAlways: true,
      rotation: 270,
    },
    stroke: { show: true, width: 1, colors: ['#fff'] },
    tooltip: { shared: true, intersect: false },
    xaxis: { categories: [] },
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
      { name: 'CE Change Open Interest', data: [], color: '#FFA500' }, // Orange for change in CE
      { name: 'PE Change Open Interest', data: [], color: '#0000FF' }, // Blue for change in PE
    ],
    options: {
      chart: { 
        type: 'bar',
        height: 600
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
        rotateAlways: true,
        rotation: 270,
      },
      stroke: { show: true, width: 1, colors: ['#fff'] },
      tooltip: { shared: true, intersect: false },
      xaxis: { categories: [] },
    },
  });

  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [futuresData, setFuturesData] = useState(null);
  const [selectedFuturesExpiry, setSelectedFuturesExpiry] = useState('');
  const [filteredFuturesData, setFilteredFuturesData] = useState([]);

  // highlightMap: keys formatted as `${seriesIndex}-${dataPointIndex}`
  // Values: { type: 'increase' | 'decrease', updatedAt: timestamp, pct: percentageChange }
  const [highlightMap, setHighlightMap] = useState({});

  // Reference to previous series values.
  const prevSeriesRef = useRef([]);

  // Handler for selecting an index
  const handleIndex = (event) => {
    setSelectedIndex(event.target.value);
  };

  // Handler for selecting a symbol
  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  // Handler for futures expiry date change
  const handleFuturesExpiryChange = (event) => {
    setSelectedFuturesExpiry(event.target.value);
  };

  // Fetch data on initial load and every 5 seconds when an index is selected
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      if (!selectedIndex || !isMounted) return;
      try {
        const response = await axios.get(`/api/option-chain?symbol=${selectedIndex}`);
        if (isMounted) {
          setData(response.data);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 10000); // Increased interval to 10 seconds
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedIndex]);

  // Fetch futures data when a symbol is selected
  useEffect(() => {
    let isMounted = true;
    const fetchFuturesData = async () => {
      if (!selectedSymbol || !isMounted) return;
      try {
        const response = await axios.get(`/api/futures-data?symbol=${selectedSymbol}`);
        const response1 = await axios.get(`/api/live_data?symbol=${selectedSymbol}`);
        if (isMounted) {
          setFuturesData(response.data);
          setLiveData(response1.data);
        }
      } catch (error) {
        console.error('Error fetching futures data:', error.message);
      }
    };

    fetchFuturesData();
    const intervalId = setInterval(fetchFuturesData, 10000); // Fetch every 10 seconds

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [selectedSymbol]);

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

      // Extract strike prices from the filtered data
      const strikePrices = filteredData.map((option) => option.strikePrice);

      // Find the closest strike price to the underlying value
      const closestStrikePrice = strikePrices.reduce((prev, curr) =>
        Math.abs(curr - underlyingValue) < Math.abs(prev - underlyingValue)
          ? curr
          : prev
      );
      const currentIndex = strikePrices.indexOf(closestStrikePrice);

      // Select a range of strike prices: 3 before and 3 after (including the current strike)
      const start = Math.max(0, currentIndex -3);
      const end = Math.min(filteredData.length, currentIndex +4);
      const filteredStrikeRange = filteredData.slice(start, end)
        .sort((a, b) => a.strikePrice - b.strikePrice);

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

      // Compare with previous series values and store the percentage change.
      const newSeries = [
        { name: 'CE Open Interest', data: ceOpenInterest },
        { name: 'PE Open Interest', data: peOpenInterest },
        { name: 'CE Change Open Interest', data: ceChangeOpenInterest },
        { name: 'PE Change Open Interest', data: peChangeOpenInterest },
        { name: 'CE Volume', data: ceVolume },
        { name: 'PE Volume', data: peVolume },
      ];

      const newHighlightMap = { ...highlightMap };
      newSeries.forEach((series, seriesIndex) => {
        const newData = series.data;
        const prevData = prevSeriesRef.current[seriesIndex]?.data || [];
        newData.forEach((value, dataPointIndex) => {
          const key = `${seriesIndex}-${dataPointIndex}`;
          const oldVal = prevData[dataPointIndex];
          if (typeof oldVal === 'number' && oldVal !== 0) {
            if (value > oldVal) {
              const pct = (value - oldVal) / oldVal;
              newHighlightMap[key] = { type: 'increase', updatedAt: Date.now(), pct };
            } else if (value < oldVal) {
              const pct = (oldVal - value) / oldVal;
              newHighlightMap[key] = { type: 'decrease', updatedAt: Date.now(), pct };
            }
          }
        });
      });
      setHighlightMap(newHighlightMap);
      prevSeriesRef.current = newSeries;

      // Update the chart data with the new series and categories
      setChartData((prev) => ({
        ...prev,
        series: newSeries.slice(0, 4), // Only take OI related series
        options: {
          ...prev.options,
          xaxis: { categories: filteredStrikeRange.map(option => option.strikePrice) },
        },
      }));

      // Update volume chart
      setVolumeChartData((prev) => ({
        ...prev,
        series: [
          { name: 'CE Volume', data: ceVolume, color: '#FF69B4' },
          { name: 'PE Volume', data: peVolume, color: '#4B0082' },
        ],
        options: {
          ...prev.options,
          xaxis: { categories: filteredStrikeRange.map(option => option.strikePrice) },
        },
      }));

      // Set the calculated PCR value
      setPcr(pcrValue);
    }
  }, [filteredData, data]);

  // Update chart data when filtered futures data changes
  useEffect(() => {
    if (filteredFuturesData.length > 0) {
      // Extract strike prices from the filtered futures data
      const strikePrices = filteredFuturesData.map((item) => item.strikePrice);

      // Get the underlying value (if available)
      const underlyingValue = futuresData.records?.underlyingValue || 0;

      // Find the closest strike price to the underlying value
      const closestStrikePrice = strikePrices.reduce((prev, curr) =>
        Math.abs(curr - underlyingValue) < Math.abs(prev - underlyingValue)
          ? curr
          : prev
      );
      const currentIndex = strikePrices.indexOf(closestStrikePrice);

      // Select a range of strike prices: 3 before and 3 after (including the current strike)
      const start = Math.max(0, currentIndex - 3);
      const end = Math.min(filteredFuturesData.length, currentIndex + 4);
      const filteredStrikeRange = filteredFuturesData.slice(start, end);

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
      setChartData({
        ...chartData,
        series: [
          { name: 'CE Open Interest (Futures)', data: ceOpenInterest, color: '#FF0000' }, // Red for CE
          { name: 'PE Open Interest (Futures)', data: peOpenInterest, color: '#008000' }, // Green for PE
          { name: 'CE Change Open Interest (Futures)', data: ceChangeOpenInterest, color: '#FFA500' }, // Pink for change in CE
          { name: 'PE Change Open Interest (Futures)', data: peChangeOpenInterest, color: '#0000FF' }, // Blue for change in PE
        ],
        options: {
          ...chartData.options,
          xaxis: { categories: filteredStrikeRange.map((item) => item.strikePrice) },
        },
      });
    }
  }, [filteredFuturesData, futuresData, chartData]);

  // Handler for expiry date change
  const handleExpiryChange = (event) => {
    setSelectedExpiry(event.target.value);
  };

  // Create an array of unique expiry dates for the dropdown, sorted by date
  const expiryDates = Array.from(
    new Set((data.records?.data || []).map((option) => option.expiryDate))
  ).sort((a, b) => new Date(a) - new Date(b));

  useEffect(() => {
    if (selectedIndex || selectedSymbol) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = () => {
        if (window.TradingView) {
          new window.TradingView.widget({
            container_id: 'tradingview_chart',
            autosize: true,
            symbol: selectedIndex || selectedSymbol,
            interval: 'D',
            timezone: 'Etc/UTC',
            theme: 'light',
            style: '1',
            locale: 'en',
            toolbar_bg: '#f1f3f6',
            enable_publishing: false,
            allow_symbol_change: true,
            hide_side_toolbar: false,
          });
        } else {
          console.error('TradingView widget is not available for the selected symbol.');
        }
      };
      document.body.appendChild(script);

      return () => {
        const existingScript = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]');
        if (existingScript) {
          document.body.removeChild(existingScript);
        }
      };
    }
  }, [selectedIndex, selectedSymbol]);

  // Dynamic chart options: adjust brightness proportionally based on the stored pct value.
  const dynamicChartOptions = {
    ...chartData.options,
    colors: chartData.series.map((_, seriesIndex) => {
      return chartData.series[seriesIndex].data.map((_, dataPointIndex) => {
        const key = `${seriesIndex}-${dataPointIndex}`;
        const defaultColors = ['#FF0000', '#008000', '#FFA500', '#0000FF', '#FF69B4', '#4B0082'];
        const baseColor = defaultColors[seriesIndex];
        const highlight = highlightMap[key];
        if (highlight) {
          const elapsed = Date.now() - highlight.updatedAt;
          if (elapsed < 300000) { // within 5 minutes
            if (highlight.type === 'increase') {
              const factor = getDarkenFactor(highlight.pct); // factor from 1 to 0.7
              return adjustColorBrightness(baseColor, factor);
            } else if (highlight.type === 'decrease') {
              const factor = getLightenFactor(highlight.pct); // factor from 1 to 1.3
              return adjustColorBrightness(baseColor, factor);
            }
          }
        }
        return baseColor;
      });
    }).flat(), // Flatten the array to match ApexCharts' expected format
  };

  return (
    <div>
      <div>
        <label htmlFor="Select">
          Select Index:
          <select value={selectedIndex} onChange={handleIndex}>
            <option value="">---Select---</option>
            <option value="NIFTY">NIFTY</option>
            <option value="BANKNIFTY">BANKNIFTY</option>
            <option value="FINNIFTY">FINNIFTY</option>
            <option value="MIDCPNIFTY">MID CAP NIFTY</option>
            <option value="NIFTYNXT50">NIFTY NEXT FIFTY</option>
          </select>
        </label>
      </div>
      <div>
        <label htmlFor="expiry-date">Select Expiry Date:</label>
        <select id="expiry-date" value={selectedExpiry} onChange={handleExpiryChange}>
          <option value="">-- Select --</option>
          {expiryDates.map((date, index) => (
            <option key={index} value={date}>
              {date}
            </option>
          ))}
        </select>
      </div>
      <div className="custom_select">
        <label htmlFor="select_symbol">Select Symbol:</label>
        <select id="select_symbol" value={selectedSymbol} onChange={handleSymbolChange}>
          <option value="">Select</option>
          <option value="AARTIIND">AARTIIND</option>
          <option value="ABB">ABB</option>
          <option value="ABCAPITAL">ABCAPITAL</option>
          <option value="ABFRL">ABFRL</option>
          <option value="ACC">ACC</option>
          <option value="ADANIENSOL">ADANIENSOL</option>
          <option value="ADANIENT">ADANIENT</option>
          <option value="ADANIGREEN">ADANIGREEN</option>
          <option value="ADANIPORTS">ADANIPORTS</option>
          <option value="ALKEM">ALKEM</option>
          <option value="AMBUJACEM">AMBUJACEM</option>
          <option value="ANGELONE">ANGELONE</option>
          <option value="APLAPOLLO">APLAPOLLO</option>
          <option value="APOLLOHOSP">APOLLOHOSP</option>
          <option value="APOLLOTYRE">APOLLOTYRE</option>
          <option value="ASHOKLEY">ASHOKLEY</option>
          <option value="ASIANPAINT">ASIANPAINT</option>
          <option value="ASTRAL">ASTRAL</option>
          <option value="ATGL">ATGL</option>
          <option value="AUBANK">AUBANK</option>
          <option value="AUROPHARMA">AUROPHARMA</option>
          <option value="AXISBANK">AXISBANK</option>
          <option value="BAJAJ-AUTO">BAJAJ-AUTO</option>
          <option value="BAJAJFINSV">BAJAJFINSV</option>
          <option value="BAJFINANCE">BAJFINANCE</option>
          <option value="BALKRISIND">BALKRISIND</option>
          <option value="BANDHANBNK">BANDHANBNK</option>
          <option value="BANKBARODA">BANKBARODA</option>
          <option value="BANKINDIA">BANKINDIA</option>
          <option value="BEL">BEL</option>
          <option value="BERGEPAINT">BERGEPAINT</option>
          <option value="BHARATFORG">BHARATFORG</option>
          <option value="BHARTIARTL">BHARTIARTL</option>
          <option value="BHEL">BHEL</option>
          <option value="BIOCON">BIOCON</option>
          <option value="BOSCHLTD">BOSCHLTD</option>
          <option value="BPCL">BPCL</option>
          <option value="BRITANNIA">BRITANNIA</option>
          <option value="BSE">BSE</option>
          <option value="BSOFT">BSOFT</option>
          <option value="CAMS">CAMS</option>
          <option value="CANBK">CANBK</option>
          <option value="CDSL">CDSL</option>
          <option value="CESC">CESC</option>
          <option value="CGPOWER">CGPOWER</option>
          <option value="CHAMBLFERT">CHAMBLFERT</option>
          <option value="CHOLAFIN">CHOLAFIN</option>
          <option value="CIPLA">CIPLA</option>
          <option value="COALINDIA">COALINDIA</option>
          <option value="COFORGE">COFORGE</option>
          <option value="COLPAL">COLPAL</option>
          <option value="CONCOR">CONCOR</option>
          <option value="CROMPTON">CROMPTON</option>
          <option value="CUMMINSIND">CUMMINSIND</option>
          <option value="CYIENT">CYIENT</option>
          <option value="DABUR">DABUR</option>
          <option value="DALBHARAT">DALBHARAT</option>
          <option value="DEEPAKNTR">DEEPAKNTR</option>
          <option value="DELHIVERY">DELHIVERY</option>
          <option value="DIVISLAB">DIVISLAB</option>
          <option value="DIXON">DIXON</option>
          <option value="DLF">DLF</option>
          <option value="DMART">DMART</option>
          <option value="DRREDDY">DRREDDY</option>
          <option value="EICHERMOT">EICHERMOT</option>
          <option value="ESCORTS">ESCORTS</option>
          <option value="EXIDEIND">EXIDEIND</option>
          <option value="FEDERALBNK">FEDERALBNK</option>
          <option value="GAIL">GAIL</option>
          <option value="GLENMARK">GLENMARK</option>
          <option value="GMRAIRPORT">GMRAIRPORT</option>
          <option value="GODREJCP">GODREJCP</option>
          <option value="GODREJPROP">GODREJPROP</option>
          <option value="GRANULES">GRANULES</option>
          <option value="GRASIM">GRASIM</option>
          <option value="HAL">HAL</option>
          <option value="HAVELLS">HAVELLS</option>
          <option value="HCLTECH">HCLTECH</option>
          <option value="HDFCAMC">HDFCAMC</option>
          <option value="HDFCBANK">HDFCBANK</option>
          <option value="HDFCLIFE">HDFCLIFE</option>
          <option value="HEROMOTOCO">HEROMOTOCO</option>
          <option value="HFCL">HFCL</option>
          <option value="HINDALCO">HINDALCO</option>
          <option value="HINDCOPPER">HINDCOPPER</option>
          <option value="HINDPETRO">HINDPETRO</option>
          <option value="HINDUNILVR">HINDUNILVR</option>
          <option value="HINDZINC">HINDZINC</option>
          <option value="HUDCO">HUDCO</option>
          <option value="ICICIBANK">ICICIBANK</option>
          <option value="ICICIGI">ICICIGI</option>
          <option value="ICICIPRULI">ICICIPRULI</option>
          <option value="IDEA">IDEA</option>
          <option value="IDFCFIRSTB">IDFCFIRSTB</option>
          <option value="IEX">IEX</option>
          <option value="IGL">IGL</option>
          <option value="IIFL">IIFL</option>
          <option value="INDHOTEL">INDHOTEL</option>
          <option value="INDIANB">INDIANB</option>
          <option value="INDIGO">INDIGO</option>
          <option value="INDUSINDBK">INDUSINDBK</option>
          <option value="INDUSTOWER">INDUSTOWER</option>
          <option value="INFY">INFY</option>
          <option value="INOXWIND">INOXWIND</option>
          <option value="IOC">IOC</option>
          <option value="IRB">IRB</option>
          <option value="IRCTC">IRCTC</option>
          <option value="IREDA">IREDA</option>
          <option value="IRFC">IRFC</option>
          <option value="ITC">ITC</option>
          <option value="JINDALSTEL">JINDALSTEL</option>
          <option value="JIOFIN">JIOFIN</option>
          <option value="JSL">JSL</option>
          <option value="JSWENERGY">JSWENERGY</option>
          <option value="JSWSTEEL">JSWSTEEL</option>
          <option value="JUBLFOOD">JUBLFOOD</option>
          <option value="KALYANKJIL">KALYANKJIL</option>
          <option value="KEI">KEI</option>
          <option value="KOTAKBANK">KOTAKBANK</option>
          <option value="KPITTECH">KPITTECH</option>
          <option value="LAURUSLABS">LAURUSLABS</option>
          <option value="LICHSGFIN">LICHSGFIN</option>
          <option value="LICI">LICI</option>
          <option value="LODHA">LODHA</option>
          <option value="LT">LT</option>
          <option value="LTF">LTF</option>
          <option value="LTIM">LTIM</option>
          <option value="LUPIN">LUPIN</option>
          <option value="M&M">M&M</option>
          <option value="M&MFIN">M&MFIN</option>
          <option value="MANAPPURAM">MANAPPURAM</option>
          <option value="MARICO">MARICO</option>
          <option value="MARUTI">MARUTI</option>
          <option value="MAXHEALTH">MAXHEALTH</option>
          <option value="MCX">MCX</option>
          <option value="MFSL">MFSL</option>
          <option value="MGL">MGL</option>
          <option value="MOTHERSON">MOTHERSON</option>
          <option value="MPHASIS">MPHASIS</option>
          <option value="MRF">MRF</option>
          <option value="MUTHOOTFIN">MUTHOOTFIN</option>
          <option value="NATIONALUM">NATIONALUM</option>
          <option value="NAUKRI">NAUKRI</option>
          <option value="NBCC">NBCC</option>
          <option value="NCC">NCC</option>
          <option value="NESTLEIND">NESTLEIND</option>
          <option value="NHPC">NHPC</option>
          <option value="NMDC">NMDC</option>
          <option value="NTPC">NTPC</option>
          <option value="NYKAA">NYKAA</option>
          <option value="OBEROIRLTY">OBEROIRLTY</option>
          <option value="OFSS">OFSS</option>
          <option value="OIL">OIL</option>
          <option value="ONGC">ONGC</option>
          <option value="PAGEIND">PAGEIND</option>
          <option value="PATANJALI">PATANJALI</option>
          <option value="PAYTM">PAYTM</option>
          <option value="PEL">PEL</option>
          <option value="PERSISTENT">PERSISTENT</option>
          <option value="PETRONET">PETRONET</option>
          <option value="PFC">PFC</option>
          <option value="PHOENIXLTD">PHOENIXLTD</option>
          <option value="PIDILITIND">PIDILITIND</option>
          <option value="PIIND">PIIND</option>
          <option value="PNB">PNB</option>
          <option value="PNBHOUSING">PNBHOUSING</option>
          <option value="POLICYBZR">POLICYBZR</option>
          <option value="POLYCAB">POLYCAB</option>
          <option value="POONAWALLA">POONAWALLA</option>
          <option value="POWERGRID">POWERGRID</option>
          <option value="PRESTIGE">PRESTIGE</option>
          <option value="RAMCOCEM">RAMCOCEM</option>
          <option value="RBLBANK">RBLBANK</option>
          <option value="RECLTD">RECLTD</option>
          <option value="RELIANCE">RELIANCE</option>
          <option value="SAIL">SAIL</option>
          <option value="SBICARD">SBICARD</option>
          <option value="SBILIFE">SBILIFE</option>
          <option value="SBIN">SBIN</option>
          <option value="SHREECEM">SHREECEM</option>
          <option value="SHRIRAMFIN">SHRIRAMFIN</option>
          <option value="SIEMENS">SIEMENS</option>
          <option value="SJVN">SJVN</option>
          <option value="SOLARINDS">SOLARINDS</option>
          <option value="SONACOMS">SONACOMS</option>
          <option value="SRF">SRF</option>
          <option value="SUNPHARMA">SUNPHARMA</option>
          <option value="SUPREMEIND">SUPREMEIND</option>
          <option value="SYNGENE">SYNGENE</option>
          <option value="TATACHEM">TATACHEM</option>
          <option value="TATACOMM">TATACOMM</option>
          <option value="TATACONSUM">TATACONSUM</option>
          <option value="TATAELXSI">TATAELXSI</option>
          <option value="TATAMOTORS">TATAMOTORS</option>
          <option value="TATAPOWER">TATAPOWER</option>
          <option value="TATASTEEL">TATASTEEL</option>
          <option value="TATATECH">TATATECH</option>
          <option value="TCS">TCS</option>
          <option value="TECHM">TECHM</option>
          <option value="TIINDIA">TIINDIA</option>
          <option value="TITAGARH">TITAGARH</option>
          <option value="TITAN">TITAN</option>
          <option value="TORNTPHARM">TORNTPHARM</option>
          <option value="TORNTPOWER">TORNTPOWER</option>
          <option value="TRENT">TRENT</option>
          <option value="TVSMOTOR">TVSMOTOR</option>
          <option value="ULTRACEMCO">ULTRACEMCO</option>
          <option value="UNIONBANK">UNIONBANK</option>
          <option value="UNITDSPR">UNITDSPR</option>
          <option value="UPL">UPL</option>
          <option value="VBL">VBL</option>
          <option value="VEDL">VEDL</option>
          <option value="VOLTAS">VOLTAS</option>
          <option value="WIPRO">WIPRO</option>
          <option value="YESBANK">YESBANK</option>
          <option value="ZOMATO">ZOMATO</option>
          <option value="ZYDUSLIFE">ZYDUSLIFE</option>
        </select>
      </div>
      {futuresData && Array.isArray(futuresData.records?.expiryDates) && (
        <div>
          <label htmlFor="futures-expiry-date">Select Futures Expiry Date:</label>
          <select
            id="futures-expiry-date"
            value={selectedFuturesExpiry}
            onChange={handleFuturesExpiryChange}
          >
            <option value="">-- Select --</option>
            {futuresData.records.expiryDates.map((date, index) => (
              <option key={index} value={date}>
                {date}
              </option>
            ))}
          </select>
        </div>
      )}
      
      <div>
        <h2>Put-Call Ratio (PCR): {pcr}</h2>
      </div>
      <ReactApexChart options={dynamicChartOptions} series={chartData.series} type="bar" height={500} />
      <ReactApexChart options={volumeChartData.options} series={volumeChartData.series} type="bar" height={300} />
    
      <div>
        {liveData}
      </div>
    </div>
  );
}