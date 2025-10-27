# Backend

## Setup




### 0.1 Install Node dependencies
    npm install

### 0.2 Install Frontend dependencies (don't forget to then go back to root directory)
    cd frontend
    npm install

### 0.3 Install Python dependencies
    python install -r requirement.txt

### 1. Create '.env' in project root
    
    PORT=3000
    PYTHON_PORT=5001   
    MONGO_URI=mongodb+srv://<USER>:<PASS>@<CLUSTER>.mongodb.net/<DB>

### 2. Build the Project (do each time before running)
    cd frontend
    npm run build

### 3. Run Flask server
    python label_service.py

### 4. Run the Node.JS server
    node index.js

### Go to : "http://localhost:3000/" to visit the dashboard
