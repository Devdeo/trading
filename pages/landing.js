import { useEffect, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';

// Dynamically import ReactApexChart to avoid SSR issues
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

export default function Landing() {
  const [data, setData] = useState([]);
  const [selectedExpiry, setSelectedExpiry] = useState('');
  const [filteredData, setFilteredData] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState('');
  const [pcr, setPcr] = useState('');
  const [chartData, setChartData] = useState({
    series: [
      { name: 'CE Open Interest', data: [] },
      { name: 'PE Open Interest', data: [] },
      { name: 'CE Change Open Interest', data: [] },
      { name: 'PE Change Open Interest', data: [] },
    ],
    options: {
      chart: { type: 'bar' },
      plotOptions: {
        bar: {
          horizontal: true,
          dataLabels: { position: 'top' },
        },
      },
      dataLabels: {
        enabled: true,
        offsetX: -6,
        style: { fontSize: '10px', colors: ['#000000'] },
      },
      stroke: { show: true, width: 1, colors: ['#fff'] },
      tooltip: { shared: true, intersect: false },
      xaxis: { categories: [] },
    },
  });

  // Handler for selecting an index
  const handleIndex = (event) => {
    setSelectedIndex(event.target.value);
  };

  // Fetch data on initial load and every 5 seconds when an index is selected
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedIndex) return; // Skip if no index selected
      try {
        const response = await axios.get('/api/option-chain', {
          params: { key: selectedIndex },
        });
        setData(response.data);
        console.log(response.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5000);
    return () => clearInterval(intervalId);
  }, [selectedIndex]);

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
      const start = Math.max(0, currentIndex - 3);
      const end = Math.min(filteredData.length, currentIndex + 4);
      const filteredStrikeRange = filteredData.slice(start, end);

      // Map out the open interest and change in open interest values
      const ceOpenInterest = filteredStrikeRange.map(
        (option) => option.CE?.openInterest || 0
      );
      const peOpenInterest = filteredStrikeRange.map(
        (option) => option.PE?.openInterest || 0
      );
      const cechOpenInterest = filteredStrikeRange.map(
        (option) => option.CE?.changeinOpenInterest || 0
      );
      const pechOpenInterest = filteredStrikeRange.map(
        (option) => option.PE?.changeinOpenInterest || 0
      );

      // Calculate total open interests and then PCR
      const totalCEOI = ceOpenInterest.reduce((sum, oi) => sum + oi, 0);
      const totalPEOI = peOpenInterest.reduce((sum, oi) => sum + oi, 0);
      const pcrValue = totalCEOI > 0 ? (totalPEOI / totalCEOI).toFixed(2) : "N/A";

      // Update the chart data with the new series and categories
      setChartData({
        ...chartData,
        series: [
          { name: 'CE Open Interest', data: ceOpenInterest },
          { name: 'PE Open Interest', data: peOpenInterest },
          { name: 'CE Change Open Interest', data: cechOpenInterest },
          { name: 'PE Change Open Interest', data: pechOpenInterest },
        ],
        options: {
          ...chartData.options,
          xaxis: { categories: filteredStrikeRange.map(option => option.strikePrice) },
        },
      });

      // Set the calculated PCR value
      setPcr(pcrValue);
    }
  }, [filteredData, data, chartData]);

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
      <div>
        <h2>Put-Call Ratio (PCR): {pcr}</h2>
      </div>
      <ReactApexChart options={chartData.options} series={chartData.series} type="bar" height={500} />
    </div>
  );
}
