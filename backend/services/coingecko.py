import time
import threading
import requests
import logging
import os
import json
from config import Config

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_local_fallback():
    """Load a local offline snapshot of top coins for startup resilience."""
    try:
        fallback_path = os.path.join(os.path.dirname(__file__), 'top50_fallback.json')
        if os.path.exists(fallback_path):
            with open(fallback_path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load local fallback JSON: {e}")
    return None

class SimpleCache:
    """Thread-safe, in-memory Cache with Time-To-Live (TTL) and stale fallback support."""
    def __init__(self, default_timeout=180):
        self._cache = {}
        self.default_timeout = default_timeout
        self._lock = threading.Lock()

    def get(self, key):
        """Retrieve active cached item. Returns None if expired or not found."""
        with self._lock:
            if key in self._cache:
                data, expiry = self._cache[key]
                if expiry > time.time():
                    return data
            return None

    def get_stale(self, key):
        """Retrieve cached item even if it is expired. Returns None if not found."""
        with self._lock:
            if key in self._cache:
                data, _ = self._cache[key]
                return data
            return None

    def set(self, key, value, timeout=None):
        """Store item in cache with a calculated expiration time."""
        timeout = timeout if timeout is not None else self.default_timeout
        expiry = time.time() + timeout
        with self._lock:
            self._cache[key] = (value, expiry)


class CoinGeckoService:
    def __init__(self):
        self.base_url = Config.COINGECKO_BASE_URL
        # Set default cache TTL to 180 seconds to reduce overall API calls
        self.cache = SimpleCache(default_timeout=180)

    def _make_request(self, endpoint, params=None):
        # Create a cache key based on the endpoint and sorted params
        param_str = ""
        if params:
            param_str = "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        cache_key = f"{endpoint}{param_str}"

        # 1. Try active cache first
        cached_data = self.cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Cache HIT for: {cache_key}")
            return cached_data

        # 2. Cache miss or expired: Call CoinGecko with rate limit resilience
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        logger.info(f"Cache MISS. Calling CoinGecko API: {url} with params {params}")
        
        retries = 3
        backoff = 1.0  # Initial wait time of 1 second
        
        for attempt in range(retries + 1):
            try:
                response = requests.get(url, params=params, timeout=15)
                
                # Check if rate-limited
                if response.status_code == 429:
                    if attempt < retries:
                        logger.warning(
                            f"CoinGecko API rate limit (429) hit for {endpoint}. "
                            f"Retrying in {backoff}s (attempt {attempt + 1}/{retries}) with exponential backoff..."
                        )
                        time.sleep(backoff)
                        backoff *= 2.0
                        continue
                    else:
                        logger.warning(f"CoinGecko API rate limit (429) hit for {endpoint}. Exhausted all {retries} retries.")
                
                response.raise_for_status()
                data = response.json()
                
                # Successfully fetched fresh data: overwrite cache
                self.cache.set(cache_key, data)
                return data
                
            except requests.exceptions.RequestException as e:
                # Handle error and check if rate limit was reached in exception object
                status_code = getattr(getattr(e, 'response', None), 'status_code', None)
                if status_code == 429 and attempt < retries:
                    logger.warning(
                        f"CoinGecko API rate limit (429) encountered via exception for {endpoint}. "
                        f"Retrying in {backoff}s (attempt {attempt + 1}/{retries}) with exponential backoff..."
                    )
                    time.sleep(backoff)
                    backoff *= 2.0
                    continue
                
                # 3. Fallback: If request failed completely or ran out of retries, check if we have stale cache data
                stale_data = self.cache.get_stale(cache_key)
                if stale_data is not None:
                    # 4. Add clear log message when fallback is triggered
                    logger.error(
                        f"CRITICAL: CoinGecko API call failed for {endpoint} after {attempt + 1} attempts. "
                        f"Triggering stale-while-revalidate fallback: returning last successfully cached data. "
                        f"Error Details: {e}"
                    )
                    return stale_data
                
                # If no stale data is available in cache and this is the top coins query, try the offline JSON snapshot
                if "coins/markets" in endpoint and "ids=" not in cache_key:
                    offline_fallback = load_local_fallback()
                    if offline_fallback is not None:
                        logger.error(
                            f"CRITICAL: CoinGecko API call failed for {endpoint} after {attempt + 1} attempts, "
                            f"and no stale cache is available. Triggering OFFLINE snapshot fallback. "
                            f"Error Details: {e}"
                        )
                        # Seed the cache so future hits succeed instantly
                        self.cache.set(cache_key, offline_fallback)
                        return offline_fallback
                
                # If no stale data or offline fallback is available, propagate the exception
                logger.error(f"CRITICAL: CoinGecko API call failed for {endpoint} and no stale cache is available. Error Details: {e}")
                raise e

    def get_top_coins(self):
        """Fetch top 50 coins by market cap with sparklines."""
        params = {
            "vs_currency": "usd",
            "order": "market_cap_desc",
            "per_page": 50,
            "page": 1,
            "sparkline": "true",
            "price_change_percentage": "24h"
        }
        return self._make_request("coins/markets", params)

    def get_coin_details(self, coin_id):
        """Fetch detailed stats of a coin by its ID."""
        params = {
            "localization": "false",
            "tickers": "false",
            "market_data": "true",
            "community_data": "false",
            "developer_data": "false",
            "sparkline": "false"
        }
        return self._make_request(f"coins/{coin_id}", params)

    def get_coin_history(self, coin_id, days):
        """Fetch historical price data for charting (e.g. 7d, 30d, 365d)."""
        params = {
            "vs_currency": "usd",
            "days": days
        }
        return self._make_request(f"coins/{coin_id}/market_chart", params)

    def get_coins_by_ids(self, coin_ids):
        """Fetch market stats for specific list of coin IDs."""
        if not coin_ids:
            return []
        params = {
            "vs_currency": "usd",
            "ids": ",".join(coin_ids),
            "sparkline": "true",
            "price_change_percentage": "24h"
        }
        return self._make_request("coins/markets", params)

# Global singleton instance
coingecko_service = CoinGeckoService()
