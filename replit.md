# Overview

This is a financial data visualization application built with Next.js and TypeScript. The application focuses on displaying financial market data, particularly options chain analysis and stock market data visualization. It fetches real-time data from various financial APIs including NSE (National Stock Exchange) India and Yahoo Finance, presenting the information through interactive charts and dashboards.

## Recent Changes (September 18, 2025)

Added Apex candlestick chart functionality below the OI (Open Interest) chart:
- **Candlestick Chart**: Real-time price data visualization using ApexCharts candlestick format
- **Multiple Timeframes**: 5-minute, 15-minute, 30-minute, and 1-hour intervals
- **Symbol Integration**: Works with both indices (NIFTY, BANKNIFTY, etc.) and individual stocks
- **Server-side Proxy**: New API endpoint `/api/candlestick-data` to handle Yahoo Finance requests and avoid CORS issues
- **Real-time Updates**: 30-second refresh interval with in-memory caching

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: Next.js 14 with React 18 for server-side rendering and static site generation
- **Language**: TypeScript with relaxed strict mode for easier development
- **Styling**: Tailwind CSS for utility-first styling approach
- **Charts**: Multiple charting libraries including ApexCharts (react-apexcharts) and Chart.js (react-chartjs-2) for comprehensive data visualization
- **Dynamic Imports**: Client-side rendering for chart components to avoid SSR issues

## Backend Architecture
- **API Routes**: Next.js API routes handling server-side data fetching and processing
- **Caching Strategy**: In-memory caching for API responses to reduce external API calls
- **Rate Limiting**: Built-in rate limiting (30 requests per minute) to prevent API abuse
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes

## Data Processing
- **Options Analysis**: Custom algorithms for calculating net effects based on open interest changes
- **Real-time Updates**: Live data fetching from financial APIs with caching mechanisms
- **Data Transformation**: Client-side processing for financial calculations and chart data formatting

## Security & Performance
- **Browser Headers**: Mimicking real browser behavior to avoid API blocking
- **Request Throttling**: Rate limiting implementation to stay within API quotas
- **SSR Optimization**: Strategic use of dynamic imports for heavy chart libraries

# External Dependencies

## Financial Data APIs
- **NSE India**: Real-time options chain data, futures data, and live market data
- **Yahoo Finance**: Stock quotes, financial data, and market information through yahoo-finance library
- **Yahoo Finance2**: Alternative Yahoo Finance API for enhanced data access

## Charting & Visualization
- **ApexCharts**: Advanced charting library for interactive financial charts
- **Chart.js**: Flexible charting library for data visualization
- **React Integration**: React wrappers for both charting libraries

## HTTP & Data Fetching
- **Axios**: HTTP client for API requests with enhanced error handling
- **Next.js API Routes**: Built-in API handling for server-side data processing

## Development Tools
- **ESLint**: Code quality and consistency with Next.js configuration
- **TypeScript**: Type safety and better development experience
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development