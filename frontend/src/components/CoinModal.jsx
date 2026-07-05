import React, { useState, useEffect } from 'react';
import { X, Star, TrendingUp, TrendingDown, Calendar, Database, Activity, Award } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { getCoinDetails, getCoinHistory } from '../services/api';

const CoinModal = ({ coinId, isWatchlisted, onToggleWatchlist, onClose }) => {
  const [activeRange, setActiveRange] = useState('7d');
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch full details on open
  useEffect(() => {
    let active = true;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = await getCoinDetails(coinId);
        if (active) {
          setDetails(data);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError('Failed to fetch detailed coin metrics.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchDetails();
    return () => { active = false; };
  }, [coinId]);

  // Fetch history when range or coinId changes
  useEffect(() => {
    let active = true;
    const fetchHistory = async () => {
      try {
        setChartLoading(true);
        const data = await getCoinHistory(coinId, activeRange);
        if (active) {
          setHistory(data);
        }
      } catch (err) {
        console.error('Error fetching coin history', err);
      } finally {
        if (active) {
          setChartLoading(false);
        }
      }
    };

    fetchHistory();
    return () => { active = false; };
  }, [coinId, activeRange]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center min-h-[500px]">
          <div className="relative flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-400 mt-4 text-sm font-medium">Loading token data...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
        <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 relative">
          <button onClick={onClose} className="absolute right-4 top-4 p-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
          <div className="text-center py-8">
            <p className="text-red-400 font-semibold text-lg">Error</p>
            <p className="text-slate-400 text-sm mt-2">{error || 'Something went wrong.'}</p>
            <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-sm font-semibold transition-all">
              Close Modal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Extract variables
  const marketData = details.market_data || {};
  const isPositive = (marketData.price_change_percentage_24h ?? 0) >= 0;
  
  // Format numbers
  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0.00';
    if (val >= 1) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatLargeNumber = (val) => {
    if (val === undefined || val === null) return 'N/A';
    return new Intl.NumberFormat('en-US').format(val);
  };

  // Strip simple tags from description
  const cleanDescription = (desc) => {
    if (!desc) return '';
    return desc.replace(/<[^>]*>/g, '').split('. ').slice(0, 3).join('. ') + '.';
  };

  // Chart configuration
  const chartColor = isPositive ? '#10b981' : '#f43f5e'; // green-500 / rose-500
  const chartGradient = isPositive ? 'url(#emeraldGrad)' : 'url(#roseGrad)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900/95 border border-slate-800/80 rounded-3xl overflow-hidden glass-panel animate-fade-in my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-850 flex justify-between items-center bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <img src={details.image?.small} alt={details.name} className="w-8 h-8 rounded-full" />
            <div>
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {details.name}
                <span className="text-xs uppercase text-slate-500 bg-slate-800 px-2 py-0.5 rounded font-mono font-medium">
                  {details.symbol}
                </span>
              </h2>
              <div className="text-xs text-slate-400 mt-0.5">
                Market Cap Rank: <span className="text-slate-200 font-semibold">#{details.market_cap_rank}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Watchlist Toggle */}
            <button
              onClick={() => onToggleWatchlist(details.id)}
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                isWatchlisted 
                  ? 'bg-yellow-950/30 text-yellow-400 border-yellow-500/30 hover:bg-yellow-950/50' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <Star className={`w-4 h-4 ${isWatchlisted ? 'fill-yellow-400 text-yellow-400' : ''}`} />
              <span className="hidden sm:inline">{isWatchlisted ? 'Watchlisted' : 'Add to Watchlist'}</span>
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* Main Price Stats */}
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Current Price</div>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl font-extrabold text-slate-100 font-mono">
                  {formatCurrency(marketData.current_price?.usd)}
                </span>
                <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md font-bold text-xs font-mono ${
                  isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {Math.abs(marketData.price_change_percentage_24h ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Range Toggle Toggles */}
            <div className="flex bg-slate-950/65 border border-slate-850 p-1 rounded-xl">
              {['7d', '30d', '1y'].map((range) => (
                <button
                  key={range}
                  onClick={() => setActiveRange(range)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    activeRange === range
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/15'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="w-full h-[280px] bg-slate-950/40 rounded-2xl border border-slate-850/80 p-4 relative overflow-hidden">
            {chartLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/10 backdrop-blur-2px">
                <div className="w-8 h-8 border-3 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
              </div>
            ) : history.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                No historical data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history} margin={{ top: 10, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="roseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(51, 65, 85, 0.15)" vertical={false} />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(tick) => new Date(tick).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={10}
                  />
                  <YAxis 
                    domain={['auto', 'auto']}
                    tickFormatter={(tick) => {
                      if (tick >= 10000) return `$${(tick / 1000).toFixed(0)}k`;
                      if (tick >= 1) return `$${tick.toFixed(2)}`;
                      return `$${tick.toFixed(4)}`;
                    }}
                    stroke="#475569"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dx={-5}
                  />
                  <Tooltip 
                    labelFormatter={(label) => new Date(label).toLocaleString()}
                    formatter={(value) => [formatCurrency(value), 'Price (USD)']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '11px', color: '#cbd5e1' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="price" 
                    stroke={chartColor} 
                    strokeWidth={2}
                    fill={chartGradient} 
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Grid Statistics Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                24h High
              </div>
              <div className="mt-1.5 font-mono text-sm text-slate-200 font-bold">
                {formatCurrency(marketData.high_24h?.usd)}
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                24h Low
              </div>
              <div className="mt-1.5 font-mono text-sm text-slate-200 font-bold">
                {formatCurrency(marketData.low_24h?.usd)}
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                24h Volume
              </div>
              <div className="mt-1.5 font-mono text-sm text-slate-200 font-bold">
                {formatCurrency(marketData.total_volume?.usd)}
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-indigo-400" />
                Circulating Supply
              </div>
              <div className="mt-1.5 font-mono text-sm text-slate-200 font-bold">
                {formatLargeNumber(marketData.circulating_supply)} <span className="text-[10px] text-slate-500 uppercase">{details.symbol}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Award className="w-3.5 h-3.5 text-yellow-500" />
                All-Time High (ATH)
              </div>
              <div className="mt-1 font-mono text-sm text-slate-200 font-bold">
                {formatCurrency(marketData.ath?.usd)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
                <Calendar className="w-3 h-3" />
                {marketData.ath_date?.usd ? new Date(marketData.ath_date.usd).toLocaleDateString() : 'N/A'}
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Award className="w-3.5 h-3.5 text-purple-400" />
                All-Time Low (ATL)
              </div>
              <div className="mt-1 font-mono text-sm text-slate-200 font-bold">
                {formatCurrency(marketData.atl?.usd)}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1 font-sans">
                <Calendar className="w-3 h-3" />
                {marketData.atl_date?.usd ? new Date(marketData.atl_date.usd).toLocaleDateString() : 'N/A'}
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Database className="w-3.5 h-3.5 text-teal-400" />
                Total Supply
              </div>
              <div className="mt-1.5 font-mono text-sm text-slate-200 font-bold">
                {marketData.total_supply ? formatLargeNumber(marketData.total_supply) : 'Unlimited'} <span className="text-[10px] text-slate-500 uppercase">{details.symbol}</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/30 border border-slate-850 rounded-xl">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5 text-pink-400" />
                Market Cap
              </div>
              <div className="mt-1.5 font-mono text-sm text-slate-200 font-bold">
                {formatCurrency(marketData.market_cap?.usd)}
              </div>
            </div>
          </div>

          {/* Description */}
          {details.description?.en && (
            <div className="p-4 bg-slate-950/20 border border-slate-850/60 rounded-2xl">
              <h3 className="text-sm font-bold text-slate-350">About {details.name}</h3>
              <p className="text-slate-400 text-xs leading-relaxed mt-2">
                {cleanDescription(details.description.en)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoinModal;
