from flask import Blueprint, jsonify, request
from services.coingecko import coingecko_service
import logging

logger = logging.getLogger(__name__)

coins_bp = Blueprint('coins', __name__)

@coins_bp.route('/api/coins', methods=['GET'])
def get_coins():
    """Fetch top 50 cryptocurrencies with market details and sparkline data."""
    try:
        data = coingecko_service.get_top_coins()
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error fetching top coins: {e}")
        return jsonify({"error": "Failed to fetch top coins from CoinGecko", "message": str(e)}), 502

@coins_bp.route('/api/coins/<coin_id>', methods=['GET'])
def get_coin_detail(coin_id):
    """Fetch detailed statistics for a single coin by its ID."""
    try:
        data = coingecko_service.get_coin_details(coin_id)
        return jsonify(data), 200
    except Exception as e:
        logger.error(f"Error fetching coin details for {coin_id}: {e}")
        return jsonify({"error": f"Failed to fetch details for coin: {coin_id}", "message": str(e)}), 502

@coins_bp.route('/api/coins/<coin_id>/history', methods=['GET'])
def get_coin_history(coin_id):
    """Fetch historical price data for charting. Supported ranges: 7d, 30d, 1y."""
    time_range = request.args.get('range', '7d').lower()
    
    # Map range to days
    range_map = {
        '7d': '7',
        '30d': '30',
        '1y': '365'
    }
    days = range_map.get(time_range, '7')
    
    try:
        data = coingecko_service.get_coin_history(coin_id, days)
        # Parse and format the raw prices [timestamp, price] for frontend consumption
        prices = data.get("prices", [])
        formatted_history = [{"timestamp": item[0], "price": item[1]} for item in prices]
        return jsonify(formatted_history), 200
    except Exception as e:
        logger.error(f"Error fetching historical chart data for {coin_id}: {e}")
        return jsonify({"error": f"Failed to fetch historical data for coin: {coin_id}", "message": str(e)}), 502
