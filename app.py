from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv
import os
import psycopg2
from datetime import datetime
from werkzeug.utils import secure_filename
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Configuration
class Config:
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    PORT = int(os.getenv("PORT", 5000))
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB

# Initialize Flask
app = Flask(__name__, static_folder='public', static_url_path='')
app.config.from_object(Config)

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Ensure upload directory exists
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

def get_db_connection():
    try:
        return psycopg2.connect(
            host=Config.DB_HOST,
            port=Config.DB_PORT,
            database=Config.DB_NAME,
            user=Config.DB_USER,
            password=Config.DB_PASSWORD
        )
    except psycopg2.Error as e:
        logger.error(f"Database connection error: {e}")
        raise

def init_db():
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS issues (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    latitude FLOAT NOT NULL,
                    longitude FLOAT NOT NULL,
                    location TEXT,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    image TEXT,
                    status TEXT DEFAULT 'Pending'
                )
            """)
            conn.commit()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(Config.UPLOAD_FOLDER, filename)

@app.route("/api/report", methods=["POST", "OPTIONS"])
def report_issue():
    if request.method == "OPTIONS":
        return "", 200

    try:
        # Validate input
        required_fields = ["title", "description", "type", "latitude", "longitude"]
        data = {field: request.form.get(field) for field in required_fields}
        
        if not all(data.values()):
            return jsonify({
                "error": "Missing required fields",
                "missing": [f for f, v in data.items() if not v]
            }), 400

        # Handle image upload
        image_file = request.files.get("image")
        image_filename = None
        if image_file:
            if not allowed_file(image_file.filename):
                return jsonify({"error": "Invalid file type"}), 400
            
            timestamp = datetime.now().timestamp()
            filename = secure_filename(f"{timestamp}_{image_file.filename}")
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            image_file.save(image_path)
            image_filename = filename

        # Save to database
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO issues (title, description, type, latitude, longitude, 
                                      location, timestamp, image)
                    VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, %s)
                    RETURNING id, timestamp
                """, (
                    data["title"], data["description"], data["type"],
                    float(data["latitude"]), float(data["longitude"]),
                    f"{data['latitude']}, {data['longitude']}", image_filename
                ))
                
                issue_id, timestamp = cur.fetchone()
                conn.commit()

        return jsonify({
            "message": "Issue reported successfully!",
            "issue_id": issue_id,
            "timestamp": timestamp.isoformat()
        }), 201

    except ValueError as e:
        return jsonify({"error": "Invalid coordinate values"}), 400
    except Exception as e:
        logger.error(f"Error in report_issue: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/issues", methods=["GET"])
def get_issues():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        issue_type = request.args.get('type')
        status = request.args.get('status')

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                query = """
                    SELECT id, title, description, type, latitude, longitude,
                           location, timestamp, image, status
                    FROM issues
                    WHERE 1=1
                """
                params = []

                if issue_type:
                    query += " AND type = %s"
                    params.append(issue_type)
                if status:
                    query += " AND status = %s"
                    params.append(status)

                query += " ORDER BY timestamp DESC LIMIT %s OFFSET %s"
                params.extend([per_page, (page - 1) * per_page])

                cur.execute(query, params)
                rows = cur.fetchall()

                # Get total count
                count_query = "SELECT COUNT(*) FROM issues WHERE 1=1"
                if issue_type:
                    count_query += " AND type = %s"
                if status:
                    count_query += " AND status = %s"
                
                cur.execute(count_query, params[:-2] if params else [])
                total_count = cur.fetchone()[0]

        issues = [{
            "id": row[0],
            "title": row[1],
            "description": row[2],
            "type": row[3],
            "latitude": row[4],
            "longitude": row[5],
            "location": row[6],
            "timestamp": row[7].isoformat(),
            "image": f"/uploads/{row[8]}" if row[8] else None,
            "status": row[9]
        } for row in rows]

        return jsonify({
            "issues": issues,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total_count,
                "pages": (total_count + per_page - 1) // per_page
            }
        }), 200

    except Exception as e:
        logger.error(f"Error in get_issues: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    init_db()
    app.run(debug=True, port=Config.PORT)