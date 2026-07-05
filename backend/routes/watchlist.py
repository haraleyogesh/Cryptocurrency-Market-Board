from flask import Blueprint, jsonify, request
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
from config import Config
from services.coingecko import coingecko_service
import logging

logger = logging.getLogger(__name__)

watchlist_bp = Blueprint('watchlist', __name__)

# Initialize MongoDB connection with a fallback mechanism
mongo_available = False
watchlist_col = None

try:
    # Set a 2000ms timeout so Flask starts up quickly even if MongoDB is offline
    client = MongoClient(Config.MONGO_URI, serverSelectionTimeoutMS=2000)
    # Verify the connection
    client.admin.command('ping')
    
    # Get database (uses the database name from the connection string, or defaults)
    db = client.get_default_database()
    watchlist_col = db['watchlist']
    # Create unique index on coin_id to avoid duplicates
    watchlist_col.create_index("coin_id", unique=True)
    
    mongo_available = True
    logger.info("MongoDB: Connection established successfully.")
except (ConnectionFailure, ServerSelectionTimeoutError, Exception) as e:
    logger.warning(f"MongoDB: Connection failed ({e}). Watchlist will run in temporary in-memory fallback mode.")
    
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

    watchlist_col = InMemoryWatchlist()

@watchlist_bp.route('/api/watchlist', methods=['GET'])
def get_watchlist():
    """Fetch saved watchlist and enrich with real-time CoinGecko market data."""
    try:
        # Retrieve all coin_ids from MongoDB/fallback
        cursor = watchlist_col.find()
        coin_ids = [doc['coin_id'] for doc in cursor if 'coin_id' in doc]
        
        if not coin_ids:
            return jsonify([]), 200
            
        # Enrich the watchlist by querying CoinGecko for these specific coin IDs
        enriched_data = coingecko_service.get_coins_by_ids(coin_ids)
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
        # Check if already exists in database (or insert)
        # Using insert_one for simple flow (ignore if database raises DuplicateKeyError)
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
        res = watchlist_col.delete_one({"coin_id": coin_id})
        deleted_count = getattr(res, 'deleted_count', 0)
        
        if deleted_count == 0:
            return jsonify({"success": False, "message": "Coin not found in watchlist"}), 404
            
        return jsonify({"success": True, "coin_id": coin_id, "message": "Removed successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting from watchlist: {e}")
        return jsonify({"error": "Failed to remove coin from watchlist", "message": str(e)}), 500
