import os
from flask import Blueprint, jsonify, request, current_app
from pymongo import MongoClient
from services.coingecko import coingecko_service
import logging

# Configure logger
logger = logging.getLogger(__name__)

watchlist_bp = Blueprint('watchlist', __name__)

# Global lazy references
_watchlist_col = None

def get_watchlist_col():
    """Lazily initialize the MongoDB connection only when a request arrives."""
    global _watchlist_col
    if _watchlist_col is not None:
        return _watchlist_col

    # Get connection string from current flask config, or fallback to system environment variables
    mongo_uri = current_app.config.get("MONGO_URI") or os.environ.get("MONGO_URI", "mongodb://localhost:27017/crypto_dashboard")
    
    # Redact credentials for logging security
    safe_uri = mongo_uri.split('@')[-1] if '@' in mongo_uri else mongo_uri
    logger.info(f"MongoDB: Attempting lazy connection to: {safe_uri}")

    try:
        # Initialize client with 2000ms selection timeout to prevent long delays in environment checks
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        client.admin.command('ping')
        
        db = client.get_default_database()
        _watchlist_col = db['watchlist']
        _watchlist_col.create_index("coin_id", unique=True)
        
        logger.info("MongoDB: Connection established successfully.")
    except Exception as e:
        logger.warning(f"MongoDB: Connection failed ({e}). Falling back to temporary in-memory watchlist.")
        
        # In-memory mock collection fallback
        class InMemoryWatchlist:
            def __init__(self):
                self.items = set()
                
            def find(self):
                return [{"coin_id": item} for item in self.items]
                
            def insert_one(self, document):
                coin_id = document.get("coin_id")
                if not coin_id:
                    raise Exception("Missing coin_id")
                self.items.add(coin_id)
                return type('obj', (object,), {'inserted_id': coin_id})()
                
            def delete_one(self, query):
                coin_id = query.get("coin_id")
                if coin_id in self.items:
                    self.items.remove(coin_id)
                    return type('obj', (object,), {'deleted_count': 1})()
                return type('obj', (object,), {'deleted_count': 0})()

        _watchlist_col = InMemoryWatchlist()
        
    return _watchlist_col

@watchlist_bp.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    """Fetch saved watchlist and enrich with real-time CoinGecko market data."""
    try:
        watchlist_col = get_watchlist_col()
        cursor = watchlist_col.find()
        coin_ids = [doc['coin_id'] for doc in cursor if 'coin_id' in doc]
        
        if not coin_ids:
            return jsonify([]), 200
            
        # Try to pull from cached top 50 coins first to save API quota
        top_coins = []
        try:
            top_coins = coingecko_service.get_top_coins()
        except Exception as e:
            logger.warning(f"Could not load top 50 coins for watchlist enrichment (will fallback): {e}")
            
        top_coins_map = {coin['id']: coin for coin in top_coins if 'id' in coin}
        
        enriched_data = []
        missing_ids = []
        
        for cid in coin_ids:
            if cid in top_coins_map:
                enriched_data.append(top_coins_map[cid])
            else:
                missing_ids.append(cid)
                
        # If any watchlisted coins are outside the top 50 list, fetch them separately
        if missing_ids:
            logger.info(f"Watchlist: {len(missing_ids)} coins not found in top 50 cache. Fetching dynamically: {missing_ids}")
            try:
                external_data = coingecko_service.get_coins_by_ids(missing_ids)
                enriched_data.extend(external_data)
            except Exception as e:
                logger.error(f"Watchlist: Failed to fetch missing coins {missing_ids} from CoinGecko: {e}")
                
        # Re-sort watchlist by market cap rank to maintain logical order
        enriched_data.sort(key=lambda x: x.get('market_cap_rank', 999999))
        return jsonify(enriched_data), 200
    except Exception as e:
        logger.error(f"Error fetching watchlist: {e}")
        return jsonify({"error": "Failed to retrieve watchlist", "message": str(e)}), 500

@watchlist_bp.route('/api/watchlist', methods=['POST'])
def add_to_watchlist():
    """Save a new coin ID to the watchlist."""
    data = request.get_json() or {}
    coin_id = data.get('coin_id')
    
    if not coin_id or not isinstance(coin_id, str):
        return jsonify({"error": "Invalid request", "message": "Field 'coin_id' must be a non-empty string"}), 400
        
    try:
        watchlist_col = get_watchlist_col()
        try:
            watchlist_col.insert_one({"coin_id": coin_id})
            status = "added"
        except Exception as e:
            # Handles duplicate key exception in Mongo (or set duplicate in memory)
            if "duplicate" in str(e).lower() or hasattr(watchlist_col, 'items'):
                status = "already_exists"
            else:
                raise e
                
        return jsonify({"success": True, "coin_id": coin_id, "status": status}), 201
    except Exception as e:
        logger.error(f"Error saving to watchlist: {e}")
        return jsonify({"error": "Failed to add coin to watchlist", "message": str(e)}), 500

@watchlist_bp.route('/api/watchlist/<coin_id>', methods=['DELETE'])
def remove_from_watchlist(coin_id):
    """Remove a coin ID from the watchlist."""
    try:
        watchlist_col = get_watchlist_col()
        res = watchlist_col.delete_one({"coin_id": coin_id})
        deleted_count = getattr(res, 'deleted_count', 0)
        
        if deleted_count == 0:
            return jsonify({"success": False, "message": "Coin not found in watchlist"}), 404
            
        return jsonify({"success": True, "coin_id": coin_id, "message": "Removed successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting from watchlist: {e}")
        return jsonify({"error": "Failed to remove coin from watchlist", "message": str(e)}), 500
