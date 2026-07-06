import React, { useState, useEffect } from 'react';
import { Coins, Star, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import { getCoins, getWatchlist, addToWatchlist, removeFromWatchlist } from './services/api';
import CoinTable from './components/CoinTable';
import CoinModal from './components/CoinModal';

// Skeleton Loader for initial fetch state
const SkeletonLoader = () => (
  <div className="w-full flex flex-col gap-4 animate-pulse">
    {/* Controls line skeleton */}
    <div className="flex justify-between items-center">
      <div className="h-10 bg-slate-900 border border-slate-850 rounded-xl w-full max-w-sm"></div>
      <div className="h-10 bg-slate-900 border border-slate-850 rounded-xl w-24"></div>
    </div>
    
    {/* Table container skeleton */}
    <div className="border border-slate-850 rounded-2xl overflow-hidden glass-panel">
      <div className="h-12 bg-slate-900/60 border-b border-slate-850"></div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-16 border-b border-slate-850/60 flex items-center justify-between px-6">
          <div className="flex items-center gap-3 w-1/4">
            <div className="w-7 h-7 rounded-full bg-slate-900"></div>
            <div className="flex flex-col gap-1.5 w-full">
              <div className="h-3 bg-slate-900 rounded w-2/3"></div>
              <div className="h-2.5 bg-slate-900 rounded w-1/3"></div>
            </div>
          </div>
          <div className="h-4 bg-slate-900 rounded w-16"></div>
          <div className="h-4 bg-slate-900 rounded w-12"></div>
          <div className="h-4 bg-slate-900 rounded w-24"></div>
          <div className="h-6 bg-slate-900 rounded w-24"></div>
          <div className="h-8 bg-slate-900 rounded w-16"></div>
        </div>
      ))}
    </div>
  </div>
);

function App() {
  const [coins, setCoins] = useState([]);
  const [watchlistCoins, setWatchlistCoins] = useState([]);
  const [watchlistIds, setWatchlistIds] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'watchlist'
  const [selectedCoinId, setSelectedCoinId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [error, setError] = useState(null);

  // Core data synchronization
  const syncData = async (isBackground = false) => {
    try {
      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const [coinsRes, watchlistRes] = await Promise.all([
        getCoins(),
        getWatchlist()
      ]);

      setCoins(coinsRes.data);
      setWatchlistCoins(watchlistRes.data);
      setWatchlistIds(watchlistRes.data.map(c => c.id));
      setIsFallback(coinsRes.isFallback || watchlistRes.isFallback);
      setError(null);
    } catch (err) {
      console.error("API sync error:", err);
      setError("Unable to sync data from backend API. Please make sure the Flask server is running.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    syncData();
  }, []);

  // Handle Watchlist operations (Optimistic Updates)
  const handleToggleWatchlist = async (coinId) => {
    const isWatchlisted = watchlistIds.includes(coinId);
    
    // Save previous state for rollback if server request fails
    const prevIds = [...watchlistIds];
    const prevWatchlistCoins = [...watchlistCoins];

    try {
      if (isWatchlisted) {
        // Optimistic remove
        setWatchlistIds(watchlistIds.filter(id => id !== coinId));
        setWatchlistCoins(watchlistCoins.filter(c => c.id !== coinId));
        await removeFromWatchlist(coinId);
      } else {
        // Optimistic add
        setWatchlistIds([...watchlistIds, coinId]);
        // Find coin object from main coins list to add temporarily
        const coinObj = coins.find(c => c.id === coinId);
        if (coinObj) {
          setWatchlistCoins([...watchlistCoins, coinObj]);
        }
        await addToWatchlist(coinId);
      }
    } catch (err) {
      console.error("Watchlist action failed:", err);
      // Rollback on error
      setWatchlistIds(prevIds);
      setWatchlistCoins(prevWatchlistCoins);
      alert("Failed to update watchlist on server. Is MongoDB connected?");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/85 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-cyan-500/10">
              <Coins className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                CryptoPulse
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 border border-cyan-500/20">
                  <Sparkles className="w-2.5 h-2.5" /> Live
                </span>
              </h1>
            </div>
          </div>

          {/* Dev Cache status indicator */}
          <div className="hidden sm:flex text-xs text-slate-500 items-center gap-1.5 font-medium border border-slate-900 px-3 py-1.5 rounded-full bg-slate-900/35">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            CoinGecko Cache: Active (180s refresh)
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        
        {/* Error Alert */}
        {error && (
          <div className="p-4 bg-red-950/30 border border-red-900/50 rounded-2xl flex items-start gap-3 text-red-200 text-sm glass-panel">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold">Backend Sync Failed</h4>
              <p className="text-red-400/90 text-xs mt-1">{error}</p>
              <button 
                onClick={() => syncData()}
                className="mt-3 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-800/40 rounded-lg text-xs font-semibold transition-all"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Fallback Data Alert Banner */}
        {isFallback && !error && (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl flex items-center justify-between gap-3 text-amber-300 text-xs font-semibold animate-fade-in glass-panel">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
              <span>Showing cached database snapshot — Live prices temporarily unavailable due to API limits. Live stats will automatically refresh.</span>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            Cryptocurrency Market Board
          </h2>
          <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
            Monitor prices, market capitalization, 24-hour volume changes, and 7-day sparklines. Manage your personalized token watchlist.
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-900 w-full">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-semibold text-sm transition-all focus:outline-none ${
              activeTab === 'all'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            Top 50 Cryptos
          </button>
          
          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center gap-2 px-6 py-3.5 border-b-2 font-semibold text-sm transition-all focus:outline-none relative ${
              activeTab === 'watchlist'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-4 h-4" />
            My Watchlist
            {watchlistIds.length > 0 && (
              <span className="absolute right-0.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-slate-950 shadow">
                {watchlistIds.length}
              </span>
            )}
          </button>
        </div>

        {/* View render */}
        {loading ? (
          <SkeletonLoader />
        ) : (
          <div className="animate-fade-in">
            {activeTab === 'all' ? (
              <CoinTable
                coins={coins}
                watchlistIds={watchlistIds}
                onToggleWatchlist={handleToggleWatchlist}
                onSelectCoin={setSelectedCoinId}
                onRefresh={() => syncData(true)}
                isRefreshing={isRefreshing}
              />
            ) : (
              <div className="flex flex-col gap-4">
                {watchlistCoins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-900/10 rounded-2xl border border-slate-850/80 glass-panel">
                    <Star className="w-10 h-10 text-slate-650 mb-3" />
                    <p className="font-bold text-slate-350">Your watchlist is empty</p>
                    <p className="text-slate-500 text-xs mt-1 text-center max-w-xs px-4">
                      Tap the star icon next to any coin in the main cryptocurrency board to keep track of it here.
                    </p>
                    <button 
                      onClick={() => setActiveTab('all')}
                      className="mt-6 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-slate-100 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
                    >
                      Back to Coin Board
                    </button>
                  </div>
                ) : (
                  <CoinTable
                    coins={watchlistCoins}
                    watchlistIds={watchlistIds}
                    onToggleWatchlist={handleToggleWatchlist}
                    onSelectCoin={setSelectedCoinId}
                    onRefresh={() => syncData(true)}
                    isRefreshing={isRefreshing}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900/60 mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600 font-medium">
          <p>© {new Date().getFullYear()} CryptoPulse. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="https://www.coingecko.com" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
              Data Provided by CoinGecko API
            </a>
          </div>
        </div>
      </footer>

      {/* Details Modal */}
      {selectedCoinId && (
        <CoinModal
          coinId={selectedCoinId}
          isWatchlisted={watchlistIds.includes(selectedCoinId)}
          onToggleWatchlist={handleToggleWatchlist}
          onClose={() => setSelectedCoinId(null)}
        />
      )}
    </div>
  );
}

export default App;
