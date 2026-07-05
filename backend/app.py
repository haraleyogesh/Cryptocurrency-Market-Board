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
app.config.from_object(Config)

# Enable CORS globally for our frontend connection
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Register blueprinted routes
app.register_blueprint(coins_bp)
app.register_blueprint(watchlist_bp)

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
    logger.info(f"Starting Flask server on {Config.HOST}:{Config.PORT}...")
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
