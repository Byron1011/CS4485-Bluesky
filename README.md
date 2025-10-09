# Backend

## Setup

### 1. Create '.env' in project root
    
    PORT=3000   
    MONGO_URI=mongodb+srv://<USER>:<PASS>@<CLUSTER>.mongodb.net/<DB>

### 2. Run the server
    node index.js

### if connected, you will see logs like:
    Connected to DB
    Server: http://localhost:3000
    Search & Save: /search-save?q=<disaster type>&limit=<~100>
    List: /posts?type=<disaster type>&from=<date>T00:00Z&to=<date>T23:59:59.999Z

#### Then, open the browser with http://localhost:3000
#### you can search and save with 
    /search-save?q=<disaster type>&limit=<~100>
#### Then, you can reads from MONGODB with filter by typing 
    /posts?type=<disaster type>&from=<date>T00:00Z&to=<date>T23:59:59.999Z 
