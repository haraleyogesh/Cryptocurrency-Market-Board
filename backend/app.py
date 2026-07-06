import os
import threading
import time
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from routes.coins import coins_bp
from routes.watchlist import watchlist_bp
import logging

# Setup application logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Load configurations from object
app.config.from_object(Config)

# Read MONGO_URI explicitly from the environment using os.environ.get
app.config['MONGO_URI'] = os.environ.get("MONGO_URI", "mongodb://localhost:27017/crypto_dashboard")

# Enable CORS globally for our frontend connection
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Register blueprinted routes
app.register_blueprint(coins_bp)
app.register_blueprint(watchlist_bp)

def prefetch_coingecko_cache():
    """Background thread to pre-fetch and seed the CoinGecko cache on startup."""
    # Give the WSGI worker process 2 seconds to finish binding/init
    time.sleep(2)
    logger.info("Startup Pre-fetch: Initiating background cache seeding...")
    
    max_attempts = 3
    retry_delay = 5.0
    
    for attempt in range(max_attempts):
        try:
            logger.info(f"Startup Pre-fetch: Fetching top coins from CoinGecko (attempt {attempt + 1}/{max_attempts})...")
            # Import inside the function to avoid circular references during init
            from services.coingecko import coingecko_service
            coingecko_service.get_top_coins()
            logger.info("Startup Pre-fetch: Successfully fetched and cached live market data!")
            return
        except Exception as e:
            logger.warning(
                f"Startup Pre-fetch: Failed to contact CoinGecko (attempt {attempt + 1}/{max_attempts}): {e}. "
                f"Retrying in {retry_delay}s..."
            )
            time.sleep(retry_delay)
            retry_delay *= 2.0

    # If it fails completely, seed the cache with local offline snapshot data immediately
    try:
        logger.warning("Startup Pre-fetch: Unable to contact CoinGecko. Seeding cache with offline fallback JSON...")
        from services.coingecko import coingecko_service, load_local_fallback
        offline_fallback = load_local_fallback()
        if offline_fallback is not None:
            # Reconstruct the cache key exactly
            params = {
                "vs_currency": "usd",
                "order": "market_cap_desc",
                "per_page": 50,
                "page": 1,
                "sparkline": "true",
                "price_change_percentage": "24h"
            }
            param_str = "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))
            cache_key = f"coins/markets{param_str}"
            
            coingecko_service.cache.set(cache_key, offline_fallback)
            logger.info("Startup Pre-fetch: Seeded cache with local offline fallback snapshot successfully.")
    except Exception as ex:
        logger.error(f"Startup Pre-fetch: Failed to seed offline fallback: {ex}")

# Start pre-fetch worker thread in the background
threading.Thread(target=prefetch_coingecko_cache, daemon=True).start()

@app.after_request
def add_cache_headers(response):
    from flask import g
    status = getattr(g, 'cache_status', None)
    if status:
        response.headers['X-Cache-Status'] = status
        response.headers['Access-Control-Expose-Headers'] = 'X-Cache-Status'
    return response

@app.route('/health', methods=['GET'])
def health():
    """Simple API check for verification."""
    return jsonify({"status": "healthy", "service": "crypto-backend"}), 200

@app.errorhandler(404)
def page_not_found(e):
    return jsonify({"error": "Not Found", "message": "The requested resource could not be found."}), 404

@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal Server Error", "message": "An unexpected server error occurred."}), 500

if __name__ == '__main__':
    # Determine host and port from environment (or config defaults)
    host = os.environ.get("HOST", Config.HOST)
    port = int(os.environ.get("PORT", Config.PORT))
    logger.info(f"Starting Flask server on {host}:{port}...")
    app.run(host=host, port=port, debug=Config.DEBUG)
