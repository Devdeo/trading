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
  const [chartData, setChartData] = useState({
    series: [
      { name: 'CE Open Interest', data: [] },
      { name: 'PE Open Interest', data: [] },
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

  const handleIndex = (event) => {
    setSelectedIndex(event.target.value);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedIndex) return; // Skip fetching if no index is selected
      try {
        // Use params to include the query parameter in the request
        const response = await axios.get('/api/option-chain',{params: { key: selectedIndex },});
        setData(response.data);
        console.log(response.data)
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData(); // Fetch data initially

    const intervalId = setInterval(fetchData, 5000); // Fetch data every 5 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(intervalId);
  }, [selectedIndex]); // Add selectedIndex to dependencies to refetch when it changes

  useEffect(() => {
  useEffect(() => {
  if (data && selectedExpiry) {
    const options = data.records?.data || [];
    const filtered = options.filter((option) => option.expiryDate === selectedExpiry);
    setFilteredData(filtered);
  }
}, [selectedExpiry, data]);

useEffect(() => {
  if (filteredData.length > 0) {
    // Get the underlying value (this may vary depending on your API structure)
    const underlyingValue = data.records?.underlyingValue || 0;

    // Get an array of strike prices
    const strikePrices = filteredData.map((option) => option.strikePrice);

    // Find the closest strike price to the underlying value
    const closestStrikePrice = strikePrices.reduce((prev, curr) => 
      Math.abs(curr - underlyingValue) < Math.abs(prev - underlyingValue) ? curr : prev
    );

    // Find the index of the closest strike price
    const currentIndex = strikePrices.indexOf(closestStrikePrice);

    // Get 3 strike prices before and 3 after the current strike price
    const start = Math.max(0, currentIndex - 3);
    const end = Math.min(filteredData.length, currentIndex + 4); // +4 to include current strike price and 3 after

    // Filter the options for the selected strike prices
    const filteredStrikeRange = filteredData.slice(start, end);

    // Map values from the filtered range
    const ceOpenInterest = filteredStrikeRange.map((option) => option.CE?.openInterest || 0);
    const peOpenInterest = filteredStrikeRange.map((option) => option.PE?.openInterest || 0);
    const cechOpenInterest = filteredStrikeRange.map((option) => option.CE?.changeinOpenInterest || 0);
    const pechOpenInterest = filteredStrikeRange.map((option) => option.PE?.changeinOpenInterest || 0);

    // Update chart data
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
  }
}, [filteredData]);


  const handleExpiryChange = (event) => {
    setSelectedExpiry(event.target.value);
  };

  // Populate expiry dates for the dropdown
  const expiryDates = Array.from(new Set((data.records?.data || []).map((option) => option.expiryDate))).sort(
    (a, b) => new Date(a) - new Date(b)
  );

  return (
    <div>
      
      <div>
        <label htmlFor="Select">Select Index:
          <select value={selectedIndex} onChange={handleIndex}>
            <option>---Select---</option>
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
      <ReactApexChart options={chartData.options} series={chartData.series} type="bar" height={10800} />
    </div>
  );
}
