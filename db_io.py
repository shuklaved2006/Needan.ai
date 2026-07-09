import json
import os

DB_FILE = "live_database.json"

def get_data():
    """Reads the current active state of your database."""
    if not os.path.exists(DB_FILE) or os.path.getsize(DB_FILE) == 0:
        # If the file doesn't exist yet, initialize it with empty lists matching your plan
        initial_structure = {
            "facilities": [], "users": [], "staff": [], 
            "admissions": [], "inventory": [], "attendance_logs": []
        }
        commit_data(initial_structure)
        return initial_structure
        
    with open(DB_FILE, 'r') as f:
        return json.load(f)

def commit_data(data):
    """Saves any changes back to your database instantly."""
    with open(DB_FILE, 'w') as f:
        json.dump(data, f, indent=4)
