import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

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

  // Chart controls
  const [isHorizontal, setIsHorizontal] = useState(true);
  const [strikeRange, setStrikeRange] = useState(3); // Number of strikes before and after ATM

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
        { name: 'CE Open Interest', data: ceOpenInterest },
        { name: 'PE Open Interest', data: peOpenInterest },
        { name: 'CE Change Open Interest', data: ceChangeOpenInterest },
        { name: 'PE Change Open Interest', data: peChangeOpenInterest },
        { name: 'CE Volume', data: ceVolume },
        { name: 'PE Volume', data: peVolume },
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

  // Create an array of unique expiry dates for the dropdown, sorted by date
  const expiryDates = Array.from(
    new Set((data.records?.data || []).map((option) => option.expiryDate))
  ).sort((a, b) => new Date(a) - new Date(b));

  



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

      <div style={{ marginTop: "20px" }}>
        <h3>PCR: {pcr}</h3>
        {liveData?.netEffect !== undefined && (
          <>
            <h3>Net Effect: {liveData.netEffect.toLocaleString()}</h3>
            <h3>Sentiment: {liveData.sentiment}</h3>
          </>
        )}
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
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

      {/* Net Effect and Sentiment Display */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '20px', 
        margin: '20px 0',
        padding: '15px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <strong>Current Strike Net Effect:</strong>
          <div style={{ 
            fontSize: '18px', 
            color: liveData.netEffect > 0 ? '#28a745' : liveData.netEffect < 0 ? '#dc3545' : '#6c757d',
            fontWeight: 'bold'
          }}>
            {liveData.netEffect?.toFixed(2) || 'N/A'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <strong>Current Strike Sentiment:</strong>
          <div style={{ 
            fontSize: '18px', 
            color: liveData.sentiment === 'Bullish' ? '#28a745' : liveData.sentiment === 'Bearish' ? '#dc3545' : '#6c757d',
            fontWeight: 'bold'
          }}>
            {liveData.sentiment || 'Neutral'}
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <strong>PCR:</strong>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>
            {pcr || 'N/A'}
          </div>
        </div>
      </div>

      <div>
        <div>
          <ReactApexChart
            options={chartData.options}
            series={chartData.series}
            type="bar"
            height={Math.max(500, (strikeRange * 2 + 1) * 50 + 150)}
          />
        </div>
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
  );
}
