import time
import threading
import requests
import logging
from config import Config

# Configure logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleCache:
    """Thread-safe, in-memory Cache with Time-To-Live (TTL)."""
    def __init__(self, default_timeout=60):
        self._cache = {}
        self.default_timeout = default_timeout
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            if key in self._cache:
                data, expiry = self._cache[key]
                if expiry > time.time():
                    return data
                else:
                    del self._cache[key]
            return None

    def set(self, key, value, timeout=None):
        timeout = timeout if timeout is not None else self.default_timeout
        expiry = time.time() + timeout
        with self._lock:
            self._cache[key] = (value, expiry)


class CoinGeckoService:
    def __init__(self):
        self.base_url = Config.COINGECKO_BASE_URL
        self.cache = SimpleCache(default_timeout=60)

    def _make_request(self, endpoint, params=None):
        # Create a cache key based on the endpoint and sorted params
        param_str = ""
        if params:
            param_str = "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
        cache_key = f"{endpoint}{param_str}"

        # Try cache first
        cached_data = self.cache.get(cache_key)
        if cached_data is not None:
            logger.info(f"Cache HIT for: {cache_key}")
            return cached_data

        # If cache miss, make the HTTP request
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"
        logger.info(f"Cache MISS. Calling CoinGecko API: {url} with params {params}")
        try:
            response = requests.get(url, params=params, timeout=15)
            if response.status_code == 429:
                logger.warning("CoinGecko API rate limit (429) hit!")
                response.raise_for_status()
            
            response.raise_for_status()
            data = response.json()
            
            # Save to cache
            self.cache.set(cache_key, data)
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Error communicating with CoinGecko: {e}")
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
