import React, { useState } from 'react';
import { Star, Search, ArrowUpRight, ArrowDownRight, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

// Custom lightweight SVG Sparkline component for performance
const Sparkline = ({ data, positive }) => {
  if (!data || data.length === 0) return <div className="text-xs text-slate-500">N/A</div>;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  
  const width = 100;
  const height = 30;
  const padding = 2;
  
  const points = data.map((val, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (val - min) / range) * (height - padding * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  
  const strokeColor = positive ? '#22c55e' : '#ef4444'; // Green or Red
  const fillColor = positive ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)';
  
  const areaPoints = `${padding},${height - padding} ${points} ${width - padding},${height - padding}`;
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polygon points={areaPoints} fill={fillColor} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};

const CoinTable = ({ coins, watchlistIds, onToggleWatchlist, onSelectCoin, onRefresh, isRefreshing }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('market_cap_rank');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc'); // Default to descending when changing sort fields
    }
  };

  // Filter & Search
  const filteredCoins = coins.filter(coin => 
    coin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Sorting
  const sortedCoins = [...filteredCoins].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    // Handle nested or edge-case structures
    if (sortBy === 'price_change_percentage_24h') {
      valA = a.price_change_percentage_24h ?? 0;
      valB = b.price_change_percentage_24h ?? 0;
    }

    if (valA === undefined || valA === null) return 1;
    if (valB === undefined || valB === null) return -1;

    if (typeof valA === 'string') {
      return sortOrder === 'asc' 
        ? valA.localeCompare(valB) 
        : valB.localeCompare(valA);
    } else {
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    }
  });

  // Helpers for display
  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '$0.00';
    if (val >= 1) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    // For cheap coins (e.g. Shiba Inu) show more decimals
    return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
  };

  const formatMarketCap = (val) => {
    if (val === undefined || val === null) return '$0';
    if (val >= 1.0e12) return `$${(val / 1.0e12).toFixed(2)}T`;
    if (val >= 1.0e9) return `$${(val / 1.0e9).toFixed(2)}B`;
    if (val >= 1.0e6) return `$${(val / 1.0e6).toFixed(2)}M`;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  };

  const SortHeader = ({ field, label }) => {
    const isCurrent = sortBy === field;
    return (
      <button 
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-slate-200 transition-colors focus:outline-none font-semibold text-xs tracking-wider uppercase text-slate-400"
      >
        {label}
        {isCurrent && (
          sortOrder === 'asc' 
            ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> 
            : <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
        )}
      </button>
    );
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
        {/* Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search coin name or symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all text-sm"
          />
        </div>
        
        {/* Refresh Action */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 disabled:opacity-50 text-slate-300 hover:text-slate-100 rounded-xl text-sm font-medium transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          {isRefreshing ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* Main Table for Desktop / Cards for Mobile */}
      {sortedCoins.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-slate-900/30 rounded-2xl border border-slate-850 glass-panel">
          <p className="text-slate-400 text-sm">No cryptocurrencies match your search.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-850 glass-panel">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/80 bg-slate-900/40">
                    <th className="py-4 px-4 w-12 text-center text-slate-400"></th>
                    <th className="py-4 px-4 w-16 text-slate-400"><SortHeader field="market_cap_rank" label="#" /></th>
                    <th className="py-4 px-6 text-slate-400"><SortHeader field="name" label="Coin" /></th>
                    <th className="py-4 px-6 text-right text-slate-400"><SortHeader field="current_price" label="Price" /></th>
                    <th className="py-4 px-6 text-right text-slate-400"><SortHeader field="price_change_percentage_24h" label="24h Change" /></th>
                    <th className="py-4 px-6 text-right text-slate-400"><SortHeader field="market_cap" label="Market Cap" /></th>
                    <th className="py-4 px-6 text-center text-slate-400">Last 7 Days</th>
                    <th className="py-4 px-6 text-center text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {sortedCoins.map((coin) => {
                    const isWatchlisted = watchlistIds.includes(coin.id);
                    const isPositive = (coin.price_change_percentage_24h ?? 0) >= 0;
                    return (
                      <tr 
                        key={coin.id}
                        className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                        onClick={() => onSelectCoin(coin.id)}
                      >
                        {/* Watchlist Toggle */}
                        <td 
                          className="py-4 px-4 text-center"
                          onClick={(e) => {
                            e.stopPropagation(); // Avoid opening modal
                            onToggleWatchlist(coin.id);
                          }}
                        >
                          <button className="text-slate-600 hover:text-yellow-400 transition-colors focus:outline-none">
                            <Star 
                              className={`w-4 h-4 ${isWatchlisted ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500 hover:scale-110'}`} 
                            />
                          </button>
                        </td>
                        
                        {/* Market Cap Rank */}
                        <td className="py-4 px-4 text-slate-400 font-mono text-sm">{coin.market_cap_rank}</td>
                        
                        {/* Name and Image */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full" />
                            <div>
                              <div className="font-semibold text-slate-200 group-hover:text-cyan-400 transition-colors flex items-center gap-1.5">
                                {coin.name}
                              </div>
                              <div className="text-xs text-slate-500 uppercase font-medium">{coin.symbol}</div>
                            </div>
                          </div>
                        </td>
                        
                        {/* Price */}
                        <td className="py-4 px-6 text-right font-mono text-sm text-slate-200 font-semibold">
                          {formatCurrency(coin.current_price)}
                        </td>
                        
                        {/* 24h Change */}
                        <td className="py-4 px-6 text-right font-mono text-sm">
                          <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md font-medium text-xs ${
                            isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                            {Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                          </span>
                        </td>
                        
                        {/* Market Cap */}
                        <td className="py-4 px-6 text-right font-mono text-sm text-slate-300">
                          {formatMarketCap(coin.market_cap)}
                        </td>
                        
                        {/* Sparkline mini-chart */}
                        <td className="py-4 px-6" align="center">
                          <div className="flex justify-center">
                            <Sparkline 
                              data={coin.sparkline_in_7d?.price} 
                              positive={isPositive} 
                            />
                          </div>
                        </td>
                        
                        {/* View Details Action */}
                        <td className="py-4 px-6 text-center">
                          <button className="px-3 py-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 bg-cyan-950/30 hover:bg-cyan-950/60 border border-cyan-800/40 rounded-lg transition-all focus:outline-none">
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Grid/Cards View */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {sortedCoins.map((coin) => {
              const isWatchlisted = watchlistIds.includes(coin.id);
              const isPositive = (coin.price_change_percentage_24h ?? 0) >= 0;
              return (
                <div 
                  key={coin.id}
                  onClick={() => onSelectCoin(coin.id)}
                  className="p-4 rounded-xl border border-slate-850 glass-panel hover:border-slate-800 transition-colors flex flex-col gap-3 relative cursor-pointer"
                >
                  {/* Top card bar (Rank, Avatar, Name, Watchlist toggle) */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                      <div>
                        <div className="font-semibold text-slate-200 text-sm flex items-center gap-1.5">
                          {coin.name}
                          <span className="text-[10px] bg-slate-850 text-slate-400 px-1.5 py-0.5 rounded font-mono font-normal">
                            #{coin.market_cap_rank}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 uppercase font-medium">{coin.symbol}</div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Stop opening detail modal
                        onToggleWatchlist(coin.id);
                      }}
                      className="p-1 text-slate-600 hover:text-yellow-400 transition-colors"
                    >
                      <Star 
                        className={`w-5 h-5 ${isWatchlisted ? 'fill-yellow-400 text-yellow-400' : 'text-slate-600'}`} 
                      />
                    </button>
                  </div>

                  {/* Mid card bar (Price, Change, Sparkline) */}
                  <div className="flex justify-between items-center mt-1">
                    <div>
                      <div className="font-mono text-base text-slate-100 font-bold">
                        {formatCurrency(coin.current_price)}
                      </div>
                      <div className="mt-0.5">
                        <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold ${
                          isPositive ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(coin.price_change_percentage_24h ?? 0).toFixed(2)}%
                        </span>
                      </div>
                    </div>

                    <div className="h-10 flex items-center pr-2">
                      <Sparkline 
                        data={coin.sparkline_in_7d?.price} 
                        positive={isPositive} 
                      />
                    </div>
                  </div>

                  {/* Bottom details (Market Cap and quick tap trigger) */}
                  <div className="flex justify-between items-center pt-2.5 border-t border-slate-850 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500">Market Cap:</span> <span className="font-mono">{formatMarketCap(coin.market_cap)}</span>
                    </div>
                    <span className="text-cyan-400 font-semibold">Tap for details &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default CoinTable;
