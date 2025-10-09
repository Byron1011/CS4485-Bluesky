# Backend

## Setup




### 0.1 Install Node dependencies
    npm install

### 0.2 Install Frontend dependencies
    cd frontend
    npm install

### 0.3 Install Python dependencies
    python install -r requirement.txt

### 1. Create '.env' in project root
    
    PORT=3000   
    MONGO_URI=mongodb+srv://<USER>:<PASS>@<CLUSTER>.mongodb.net/<DB>

### 2 Run Flask server
    python label_service.py

### 3. Run the Node.JS server
    node index.js

### Go to : "http://localhost:3000/" to visit the dashboard
