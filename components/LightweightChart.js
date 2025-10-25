'use client';

import { useEffect, useRef } from 'react';

export default function LightweightChart({ data, title, currencySymbol = '₹' }) {
  const chartContainerRef = useRef();
  const chartRef = useRef();
  const candlestickSeriesRef = useRef();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    let chart;
    let candlestickSeries;
    let resizeHandler;

    import('lightweight-charts').then(({ createChart, CandlestickSeries }) => {
      if (!chartContainerRef.current) return;

      chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth,
        height: 500,
        layout: {
          background: { type: 'solid', color: '#ffffff' },
          textColor: '#333',
        },
        grid: {
          vertLines: { color: '#e0e0e0' },
          horzLines: { color: '#e0e0e0' },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            width: 1,
            color: '#b6b6b6',
            style: 3,
          },
          horzLine: {
            width: 1,
            color: '#b6b6b6',
            style: 3,
          },
        },
        rightPriceScale: {
          borderColor: '#e0e0e0',
        },
        timeScale: {
          borderColor: '#e0e0e0',
          timeVisible: true,
          secondsVisible: false,
        },
      });

      candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00C851',
        downColor: '#ff4444',
        borderUpColor: '#00C851',
        borderDownColor: '#ff4444',
        wickUpColor: '#00C851',
        wickDownColor: '#ff4444',
      });

      chartRef.current = chart;
      candlestickSeriesRef.current = candlestickSeries;

      resizeHandler = () => {
        if (chartContainerRef.current && chartRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
          });
        }
      };

      window.addEventListener('resize', resizeHandler);
    }).catch(error => {
      console.error('Error loading lightweight-charts:', error);
    });

    return () => {
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
      }
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !data || data.length === 0) return;

    try {
      const formattedData = data
        .map(candle => {
          if (!candle || !candle.x || !candle.y || !Array.isArray(candle.y) || candle.y.length < 4) {
            return null;
          }
          
          const timestamp = typeof candle.x === 'number' ? candle.x : new Date(candle.x).getTime();
          
          if (isNaN(timestamp)) {
            return null;
          }

          return {
            time: Math.floor(timestamp / 1000),
            open: candle.y[0],
            high: candle.y[1],
            low: candle.y[2],
            close: candle.y[3],
          };
        })
        .filter(candle => candle !== null)
        .sort((a, b) => a.time - b.time);

      if (formattedData.length > 0) {
        candlestickSeriesRef.current.setData(formattedData);

        if (chartRef.current) {
          chartRef.current.timeScale().fitContent();
        }
      }
    } catch (error) {
      console.error('Error updating chart data:', error);
    }
  }, [data]);

  return (
    <div style={{ marginBottom: '30px', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '10px' }}>
      {title && (
        <h3 style={{ 
          textAlign: 'center', 
          marginBottom: '10px',
          fontSize: '18px',
          fontWeight: 'bold',
          color: '#333'
        }}>
          {title}
        </h3>
      )}
      <div ref={chartContainerRef} style={{ position: 'relative' }} />
    </div>
  );
}
